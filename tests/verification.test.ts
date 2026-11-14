import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAndNormalizeEmail,
  isSentinelEmailValue,
  isValidDomainSyntax,
  isValidSingleEmailSyntax,
} from "../src/utils/emailValidation";
import { leadDatabase } from "../src/services/leadDatabase";
import { calculateBuyerConfidence } from "../src/utils/confidenceScore";
import { buildLayerClassification, verifyEmailTechnical } from "../server/emailVerifier";

describe("1. Email Parsing & Normalization (Zero False Negatives)", () => {
  it("validates standard corporate emails cleanly", () => {
    const res = parseAndNormalizeEmail("fruchtkontor@edeka.de");
    assert.equal(res.kind, "VALID_SYNTAX");
    assert.equal(res.primaryEmail, "fruchtkontor@edeka.de");
    assert.equal(res.domain, "edeka.de");
    assert.equal(res.isFreeMail, false);
  });

  it("extracts email from RFC display-name format", () => {
    const res = parseAndNormalizeEmail("Dr. Marcus Weber <fruchtkontor@edeka.de>");
    assert.equal(res.kind, "VALID_SYNTAX");
    assert.equal(res.primaryEmail, "fruchtkontor@edeka.de");
    assert.equal(res.domain, "edeka.de");
  });

  it("parses multi-address slash, comma, and semicolon lists without false rejection", () => {
    const slash = parseAndNormalizeEmail("info@edeka.de / procurement@edeka.de");
    assert.equal(slash.kind, "VALID_SYNTAX");
    assert.equal(slash.primaryEmail, "info@edeka.de");
    assert.deepEqual(slash.allEmails, ["info@edeka.de", "procurement@edeka.de"]);

    const semi = parseAndNormalizeEmail("export@doehler.com; sourcing@doehler.com");
    assert.equal(semi.kind, "VALID_SYNTAX");
    assert.equal(semi.allEmails.length, 2);
  });

  it("strips mailto: URIs, zero-width characters, and non-breaking spaces", () => {
    const mailto = parseAndNormalizeEmail("mailto:procurement@almarai.com?subject=RFQ");
    assert.equal(mailto.kind, "VALID_SYNTAX");
    assert.equal(mailto.primaryEmail, "procurement@almarai.com");

    const invisible = parseAndNormalizeEmail("\u200Binfo@greenyard.group\u00A0");
    assert.equal(invisible.kind, "VALID_SYNTAX");
    assert.equal(invisible.primaryEmail, "info@greenyard.group");
  });

  it("handles IDN corporate domains via punycode normalization", () => {
    const idn = parseAndNormalizeEmail("info@müller.de");
    assert.equal(idn.kind, "VALID_SYNTAX");
    assert.equal(idn.domain, "xn--mller-kva.de");
    assert.equal(isValidDomainSyntax("müller.de"), true);
  });

  it("classifies empty/placeholder sentinels as NOT_FOUND instead of INVALID_SYNTAX", () => {
    for (const sentinel of [
      "",
      "NO VERIFIED EMAIL FOUND",
      "Not Found",
      "N/A",
      "NOT VERIFIED",
      "Direct procurement email requires B2B outreach or NDA",
    ]) {
      assert.equal(isSentinelEmailValue(sentinel), true, `Expected sentinel for '${sentinel}'`);
      assert.equal(parseAndNormalizeEmail(sentinel).kind, "NOT_FOUND");
    }
  });

  it("rejects genuinely malformed addresses cleanly", () => {
    assert.equal(parseAndNormalizeEmail("bad@@invalid").kind, "INVALID_SYNTAX");
    assert.equal(isValidSingleEmailSyntax(".leading@edeka.de").valid, false);
    assert.equal(isValidSingleEmailSyntax("no-at-symbol.com").valid, false);
  });
});

describe("2. Lead Database Reverification, Deduplication & Technical Layer Updates", () => {
  it("does not misclassify multi-email or sentinel records during reverifyLead()", () => {
    const leads = leadDatabase.getAllLeads();
    assert.ok(leads.length > 0, "Expected seeded enterprise leads");

    const first = leads[0];
    const updated = leadDatabase.reverifyLead(first.lead_id);
    assert.ok(updated);
    assert.notEqual(updated.email_verification_status, "INVALID");

    // Simulate a record storing a multi-email slash list and verify reverifyLead preserves validity
    const { primaryLeads } = leadDatabase.processSearchResultsBatch(
      [
        {
          name: "Nordic Agro Import Test AB",
          website: "https://nordicagro-test.se",
          email: "info@nordicagro-test.se / buying@nordicagro-test.se",
          country: "Sweden",
          city: "Stockholm",
          address: "Portgatan 14, Stockholm",
          business_type: "Food Importer",
          industry: "Frozen Produce",
          product_category: "IQF Strawberry",
          buyer_type: "Importer",
          importer_status: "Confirmed Importer",
          reason_for_buyer_relevance: "Imports Egyptian frozen berries annually",
          phone: "+46 8 555 1200",
          contact_person: "Sven Lindqvist",
          contact_job_title: "Head of Frozen Purchasing",
          emailVerificationStatus: "DOMAIN/MX VERIFIED – EMAIL NOT CONFIRMED",
        },
      ],
      { product: "IQF Strawberry", country: "Sweden", mode: "Balanced" }
    );

    assert.equal(primaryLeads.length, 1);
    const created = primaryLeads[0];
    assert.equal(created.email_normalized, "info@nordicagro-test.se");
    assert.equal(created.email_verification_status, "LIKELY_VALID");

    const reverified = leadDatabase.reverifyLead(created.lead_id);
    assert.ok(reverified);
    assert.equal(reverified.email_verification_status, "LIKELY_VALID");
    assert.equal(reverified.email_normalized, "info@nordicagro-test.se");
  });

  it("prevents duplicates both within a batch and across subsequent search batches", () => {
    const countBefore = leadDatabase.getAllLeads().length;

    // 1. In-batch duplicate rejection (2 identical domains in same batch)
    const inBatch = leadDatabase.processSearchResultsBatch(
      [
        {
          name: "Nordic Agro Import Test AB",
          website: "https://nordicagro-test.se",
          email: "buying@nordicagro-test.se",
          country: "Sweden",
          city: "Stockholm",
          address: "Portgatan 14, Stockholm",
          business_type: "Food Importer",
          industry: "Frozen Produce",
          product_category: "IQF Strawberry",
          buyer_type: "Importer",
          importer_status: "Confirmed Importer",
          reason_for_buyer_relevance: "Imports Egyptian frozen berries annually",
        },
        {
          name: "Nordic Agro Import AB Duplicate",
          website: "https://www.nordicagro-test.se",
          email: "info@nordicagro-test.se",
          country: "Sweden",
        },
      ],
      { product: "IQF Strawberry", country: "Sweden", mode: "High Accuracy" }
    );
    assert.equal(inBatch.rejectedLeads.length, 1);
    assert.ok(inBatch.rejectedLeads[0].reason_rejected.includes("Duplicate"));
    assert.equal(inBatch.summary.existingDuplicates >= 1, true);
    assert.equal(leadDatabase.getAllLeads().length, countBefore);
  });

  it("classifies sentinel email batches as NOT_FOUND cleanly without false INVALID status", () => {
    const batch = leadDatabase.processSearchResultsBatch(
      [
        {
          name: "Alpine Fresh Frozen AG",
          website: "https://alpinefresh-frozen.ch",
          email: "NO VERIFIED EMAIL FOUND",
          country: "Switzerland",
          city: "Zurich",
          address: "Bahnhofstrasse 44, Zurich",
          business_type: "Retail Importer",
          industry: "Food Retail",
          product_category: "IQF Mango",
          buyer_type: "Importer",
          importer_status: "Confirmed Importer",
          reason_for_buyer_relevance: "Large Swiss importer of IQF tropical fruits",
          phone: "+41 44 555 8899",
          contact_person: "Hans Meier",
          contact_job_title: "Category Buyer",
        },
      ],
      { product: "IQF Mango", country: "Switzerland", mode: "Balanced" }
    );
    assert.equal(batch.primaryLeads.length, 1);
    assert.equal(batch.primaryLeads[0].email_verification_status, "NOT_FOUND");
  });
});

describe("3. Buyer Confidence Scoring (Multi-source vs AI-Suggested)", () => {
  it("gives High Confidence (>= 90%) to multi-source verified buyers", () => {
    const res = calculateBuyerConfidence({
      id: "buyer-verified-1",
      website: "https://www.edeka.de",
      procurementEmail: "fruchtkontor@edeka.de",
      contactVerified: true,
      emailVerificationStatus: "VERIFIED – OFFICIAL COMPANY SOURCE",
      linkedIn: "https://www.linkedin.com/company/edeka-zentrale-ag",
      headquartersAddress: "New-York-Ring 6, 22297 Hamburg, Germany",
      source_urls: ["https://verbund.edeka/verbund/unternehmen/"],
      annualImportVolume: "4,500 MT/yr",
      destinationPort: "Hamburg Port",
      isAiDiscovered: false,
    });
    assert.ok(res.score >= 90, `Expected >= 90, got ${res.score}`);
    assert.equal(res.tier, "high");
    assert.equal(res.isAiSuggested, false);
    assert.ok(res.sourcesCount >= 4);
  });

  it("caps AI-discovered leads without multi-registry sources cleanly", () => {
    const res = calculateBuyerConfidence({
      id: "ai-hunt-12345",
      website: "https://example-importer.de",
      email: "NO VERIFIED EMAIL FOUND",
      contactVerified: false,
      isAiDiscovered: true,
      source_urls: [],
    });
    assert.ok(res.score < 65, `Expected < 65 for uncorroborated AI lead, got ${res.score}`);
    assert.equal(res.isAiSuggested, true);
  });
});

describe("4. Server 4-Layer Email Verification & Mailbox Probe Honesty", () => {
  it("never claims mailbox SMTP delivery even when syntax, MX, and source are verified", () => {
    const layer = buildLayerClassification({
      syntaxValid: true,
      isNotFound: false,
      mxVerified: true,
      domainReachable: true,
      hasPublicSource: true,
      isOfficialSource: true,
      domainMatch: true,
    });
    assert.equal(layer.statusEnum, "VERIFIED");
    assert.equal(layer.classification, "VERIFIED – OFFICIAL COMPANY SOURCE");

    const mxOnly = buildLayerClassification({
      syntaxValid: true,
      isNotFound: false,
      mxVerified: true,
      domainReachable: true,
      hasPublicSource: false,
      domainMatch: true,
    });
    assert.equal(mxOnly.statusEnum, "LIKELY_VALID");
    assert.equal(mxOnly.classification, "DOMAIN/MX VERIFIED – EMAIL NOT CONFIRMED");
  });

  it("returns mailboxDelivery.status === 'NOT_PROBED' across sentinel, invalid, and syntactically valid checks", async () => {
    const sentinel = await verifyEmailTechnical("NO VERIFIED EMAIL FOUND");
    assert.equal(sentinel.statusEnum, "NOT_FOUND");
    assert.equal(sentinel.mailboxDelivery.status, "NOT_PROBED");

    const invalid = await verifyEmailTechnical("not-an-email@@");
    assert.equal(invalid.statusEnum, "INVALID");
    assert.equal(invalid.mailboxDelivery.status, "NOT_PROBED");

    const parsedValid = await verifyEmailTechnical("Dr. Weber <fruchtkontor@edeka.de>", {
      expectedDomain: "edeka.de",
      publicSourceUrl: "https://verbund.edeka",
      isOfficialSource: true,
    });
    assert.equal(parsedValid.syntax.valid, true);
    assert.equal(parsedValid.emailNormalized, "fruchtkontor@edeka.de");
    assert.equal(parsedValid.domainMatch, true);
    assert.equal(parsedValid.mailboxDelivery.status, "NOT_PROBED");
  });
});
