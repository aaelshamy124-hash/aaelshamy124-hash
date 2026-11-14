import { promises as dns } from "node:dns";
import {
  EmailVerificationLayerReport,
  parseAndNormalizeEmail,
} from "../src/utils/emailValidation";
import { EmailVerificationStatus, EmailVerificationStatusEnum } from "../src/types";

interface CachedDomainDns {
  checkedAtMs: number;
  reachable: boolean;
  mxVerified: boolean;
  mxHosts: string[];
  hasDnsFallback: boolean;
  reason: string;
}

const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const DNS_TIMEOUT_MS = 2500;
const domainDnsCache = new Map<string, CachedDomainDns>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function normalizeHostDomain(urlOrDomain?: string): string {
  if (!urlOrDomain) return "";
  return urlOrDomain
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .replace(/:\d+$/, "");
}

export async function checkDomainMxRecords(domain: string): Promise<CachedDomainDns> {
  const cleanDomain = normalizeHostDomain(domain);
  if (!cleanDomain) {
    return {
      checkedAtMs: Date.now(),
      reachable: false,
      mxVerified: false,
      mxHosts: [],
      hasDnsFallback: false,
      reason: "Empty domain",
    };
  }

  const cached = domainDnsCache.get(cleanDomain);
  if (cached && Date.now() - cached.checkedAtMs < DNS_CACHE_TTL_MS) {
    return cached;
  }

  try {
    const mxRecords = await withTimeout(dns.resolveMx(cleanDomain), DNS_TIMEOUT_MS, "MX lookup");
    const sortedHosts = (mxRecords || [])
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange.replace(/\.+$/, "").toLowerCase())
      .filter(Boolean);

    if (sortedHosts.length > 0) {
      const result: CachedDomainDns = {
        checkedAtMs: Date.now(),
        reachable: true,
        mxVerified: true,
        mxHosts: sortedHosts.slice(0, 10),
        hasDnsFallback: false,
        reason: `Verified ${sortedHosts.length} active MX record(s): ${sortedHosts[0]}`,
      };
      domainDnsCache.set(cleanDomain, result);
      return result;
    }
  } catch (mxErr: any) {
    // Fall through to A/AAAA check per RFC 5321 implicit MX fallback
    const code = mxErr?.code || mxErr?.message || "MX_ERROR";
    if (code === "ENOTFOUND" || code === "NXDOMAIN") {
      const missing: CachedDomainDns = {
        checkedAtMs: Date.now(),
        reachable: false,
        mxVerified: false,
        mxHosts: [],
        hasDnsFallback: false,
        reason: `Domain '${cleanDomain}' does not resolve in public DNS (${code})`,
      };
      domainDnsCache.set(cleanDomain, missing);
      return missing;
    }
  }

  // Try A / AAAA DNS fallback
  try {
    const [v4, v6] = await Promise.allSettled([
      withTimeout(dns.resolve4(cleanDomain), DNS_TIMEOUT_MS, "A lookup"),
      withTimeout(dns.resolve6(cleanDomain), DNS_TIMEOUT_MS, "AAAA lookup"),
    ]);
    const hasA = v4.status === "fulfilled" && v4.value.length > 0;
    const hasAAAA = v6.status === "fulfilled" && v6.value.length > 0;

    if (hasA || hasAAAA) {
      const fallbackResult: CachedDomainDns = {
        checkedAtMs: Date.now(),
        reachable: true,
        mxVerified: false,
        mxHosts: [],
        hasDnsFallback: true,
        reason: `Domain resolves via DNS (${hasA ? "A" : "AAAA"}), but no dedicated MX mail exchange records were found`,
      };
      domainDnsCache.set(cleanDomain, fallbackResult);
      return fallbackResult;
    }
  } catch {
    // ignore fallback error
  }

  const unreachable: CachedDomainDns = {
    checkedAtMs: Date.now(),
    reachable: false,
    mxVerified: false,
    mxHosts: [],
    hasDnsFallback: false,
    reason: `No MX or DNS A/AAAA records resolved for '${cleanDomain}'`,
  };
  domainDnsCache.set(cleanDomain, unreachable);
  return unreachable;
}

export function buildLayerClassification(params: {
  syntaxValid: boolean;
  isNotFound: boolean;
  mxVerified: boolean;
  domainReachable: boolean;
  hasPublicSource: boolean;
  isOfficialSource?: boolean;
  domainMatch: boolean | null;
}): { statusEnum: EmailVerificationStatusEnum; classification: EmailVerificationStatus } {
  if (params.isNotFound) {
    return {
      statusEnum: "NOT_FOUND",
      classification: "NO VERIFIED EMAIL FOUND",
    };
  }
  if (!params.syntaxValid) {
    return {
      statusEnum: "INVALID",
      classification: "NOT VERIFIED",
    };
  }
  if (params.hasPublicSource && (params.mxVerified || params.isOfficialSource)) {
    return {
      statusEnum: "VERIFIED",
      classification: params.isOfficialSource
        ? "VERIFIED – OFFICIAL COMPANY SOURCE"
        : "VERIFIED – PUBLICLY CONFIRMED",
    };
  }
  if (params.mxVerified && params.domainMatch !== false) {
    return {
      statusEnum: "LIKELY_VALID",
      classification: "DOMAIN/MX VERIFIED – EMAIL NOT CONFIRMED",
    };
  }
  if (params.mxVerified || params.domainReachable) {
    return {
      statusEnum: "UNVERIFIED",
      classification: "DOMAIN/MX VERIFIED – EMAIL NOT CONFIRMED",
    };
  }
  return {
    statusEnum: "UNVERIFIED",
    classification: "NOT VERIFIED",
  };
}

export async function verifyEmailTechnical(
  rawEmail: string,
  options?: {
    expectedDomain?: string;
    publicSourceUrl?: string;
    isOfficialSource?: boolean;
  }
): Promise<EmailVerificationLayerReport> {
  const parsed = parseAndNormalizeEmail(rawEmail);
  const nowIso = new Date().toISOString();
  const hasPublicSource = Boolean(
    options?.publicSourceUrl &&
      /^https?:\/\//i.test(options.publicSourceUrl.trim())
  );

  if (parsed.kind === "NOT_FOUND") {
    return {
      rawInput: rawEmail,
      emailNormalized: "",
      allEmails: [],
      domain: "",
      isFreeMail: false,
      syntax: { valid: false, reason: parsed.reason },
      domainMx: {
        checked: false,
        reachable: false,
        mxVerified: false,
        mxHosts: [],
        hasDnsFallback: false,
        reason: "Skipped DNS lookup (no email recorded)",
      },
      publicSource: {
        confirmed: hasPublicSource,
        sourceUrl: options?.publicSourceUrl,
        reason: hasPublicSource ? `Public source provided: ${options?.publicSourceUrl}` : "No public contact source linked",
      },
      mailboxDelivery: {
        status: "NOT_PROBED",
        note: "Mailbox delivery is never assumed without an actual SMTP probe or verified outreach.",
      },
      domainMatch: null,
      statusEnum: "NOT_FOUND",
      classification: "NO VERIFIED EMAIL FOUND",
      checkedAt: nowIso,
    };
  }

  if (parsed.kind === "INVALID_SYNTAX") {
    return {
      rawInput: rawEmail,
      emailNormalized: parsed.primaryEmail,
      allEmails: [],
      domain: parsed.domain,
      isFreeMail: false,
      syntax: { valid: false, reason: parsed.reason },
      domainMx: {
        checked: false,
        reachable: false,
        mxVerified: false,
        mxHosts: [],
        hasDnsFallback: false,
        reason: "Skipped DNS lookup due to invalid email syntax",
      },
      publicSource: {
        confirmed: hasPublicSource,
        sourceUrl: options?.publicSourceUrl,
        reason: hasPublicSource ? `Public source provided: ${options?.publicSourceUrl}` : "No public contact source linked",
      },
      mailboxDelivery: {
        status: "NOT_PROBED",
        note: "Mailbox delivery check skipped (invalid syntax).",
      },
      domainMatch: null,
      statusEnum: "INVALID",
      classification: "NOT VERIFIED",
      checkedAt: nowIso,
    };
  }

  const dnsResult = await checkDomainMxRecords(parsed.domain);
  const expectedNorm = normalizeHostDomain(options?.expectedDomain);
  const domainMatch = expectedNorm
    ? parsed.domain === expectedNorm || parsed.domain.endsWith(`.${expectedNorm}`) || expectedNorm.endsWith(`.${parsed.domain}`)
    : null;

  const { statusEnum, classification } = buildLayerClassification({
    syntaxValid: true,
    isNotFound: false,
    mxVerified: dnsResult.mxVerified,
    domainReachable: dnsResult.reachable,
    hasPublicSource,
    isOfficialSource: options?.isOfficialSource,
    domainMatch,
  });

  return {
    rawInput: rawEmail,
    emailNormalized: parsed.primaryEmail,
    allEmails: parsed.allEmails,
    domain: parsed.domain,
    isFreeMail: parsed.isFreeMail,
    syntax: {
      valid: true,
      reason: parsed.reason,
    },
    domainMx: {
      checked: true,
      reachable: dnsResult.reachable,
      mxVerified: dnsResult.mxVerified,
      mxHosts: dnsResult.mxHosts,
      hasDnsFallback: dnsResult.hasDnsFallback,
      reason: dnsResult.reason,
    },
    publicSource: {
      confirmed: hasPublicSource,
      sourceUrl: options?.publicSourceUrl,
      reason: hasPublicSource
        ? `Confirmed against URL: ${options?.publicSourceUrl}`
        : "Not yet matched to a public corporate contact URL",
    },
    mailboxDelivery: {
      status: "NOT_PROBED",
      note: "DNS/MX reachability does not prove individual mailbox existence; real delivery requires outbound verification.",
    },
    domainMatch,
    statusEnum,
    classification,
    checkedAt: nowIso,
  };
}
