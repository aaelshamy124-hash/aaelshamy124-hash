import { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  Unsubscribe,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  AppSettings,
  EmailVerificationStatusEnum,
  LeadQualityGrade,
  LeadRecord,
  LeadVerificationStatus,
  Product,
  ProspectBuyer,
  Supplier,
} from "../types";
import { INITIAL_BUYERS, INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from "../data";
import { DEFAULT_APP_SETTINGS, leadDatabase, normalizeDomain, normalizeCompanyName } from "./leadDatabase";

const VALID_EMAIL_STATUS_ENUMS = new Set<EmailVerificationStatusEnum>([
  "VERIFIED",
  "LIKELY_VALID",
  "UNVERIFIED",
  "INVALID",
  "NOT_FOUND",
]);

const VALID_QUALITY_GRADES = new Set<LeadQualityGrade>([
  "EXCELLENT",
  "VERY GOOD",
  "GOOD",
  "MEDIUM",
  "LOW",
]);

const VALID_VERIFICATION_STATUSES = new Set<LeadVerificationStatus>([
  "NEW",
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "NEEDS_REVIEW",
  "DUPLICATE",
  "REJECTED",
  "ARCHIVED",
]);

const VALID_CRM_STATUSES = new Set<ProspectBuyer["status"]>([
  "New Lead",
  "Contacted",
  "Negotiation",
  "Quotation",
  "Sample Sent",
  "Waiting",
  "Won",
  "Lost",
]);

export function sanitizeDocId(rawId: string, prefix = "doc"): string {
  const cleaned = String(rawId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/^_+|_+$/g, "");
  const combined = cleaned ? cleaned : `${prefix}_${Date.now()}`;
  return combined.slice(0, 128);
}

function clampStr(val: unknown, maxLen: number, fallback = ""): string {
  const s = typeof val === "string" ? val : val == null ? fallback : String(val);
  return s.trim().slice(0, maxLen);
}

function clampStringArray(val: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const item of val) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim().slice(0, maxItemLen));
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === "number" && Number.isFinite(val) ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function buildFirestoreBuyerDocId(uid: string, buyerId: string): string {
  return sanitizeDocId(`${uid}_${buyerId}`, "buyer");
}

export function buildFirestoreLeadDocId(uid: string, leadId: string): string {
  return sanitizeDocId(`${uid}_${leadId}`, "lead");
}

export function serializeLeadForCreate(uid: string, lead: LeadRecord) {
  const leadId = sanitizeDocId(lead.lead_id, "lead");
  const emailVerStatus: EmailVerificationStatusEnum = VALID_EMAIL_STATUS_ENUMS.has(
    lead.email_verification_status
  )
    ? lead.email_verification_status
    : "UNVERIFIED";
  const qualityGrade: LeadQualityGrade = VALID_QUALITY_GRADES.has(lead.lead_quality_grade)
    ? lead.lead_quality_grade
    : "MEDIUM";
  const verifStatus: LeadVerificationStatus = VALID_VERIFICATION_STATUSES.has(
    lead.verification_status
  )
    ? lead.verification_status
    : "NEW";

  const payload: Record<string, unknown> = {
    leadId,
    ownerUid: uid,
    companyName: clampStr(lead.company_name, 200, "Enterprise Buyer"),
    normalizedCompanyName: clampStr(
      lead.normalized_company_name || normalizeCompanyName(lead.company_name),
      200
    ),
    country: clampStr(lead.country, 100, "International"),
    countryCode: clampStr(lead.country_code || lead.country?.slice(0, 2).toUpperCase(), 10, "XX"),
    officialWebsite: clampStr(lead.official_website, 512),
    normalizedDomain: clampStr(
      lead.normalized_domain || normalizeDomain(lead.official_website),
      253
    ),
    email: clampStr(lead.email || "NO VERIFIED EMAIL FOUND", 320),
    emailNormalized: clampStr(lead.email_normalized, 320),
    emailVerificationStatus: emailVerStatus,
    leadQualityScore: clampNum(lead.lead_quality_score, 0, 100, 50),
    leadQualityGrade: qualityGrade,
    verificationStatus: verifStatus,
    verificationDate: clampStr(lead.verification_date || new Date().toISOString().split("T")[0], 32),
    sourceUrls: clampStringArray(lead.source_urls, 20, 512),
    productCategories: clampStringArray(
      lead.product_categories && lead.product_categories.length > 0
        ? lead.product_categories
        : [lead.product_category || "IQF Produce"],
      30,
      120
    ),
    isAiDiscovered: Boolean(
      lead.lead_source?.toLowerCase().includes("ai") ||
        lead.source_evidence?.toLowerCase().includes("ai")
    ),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (lead.city) payload.city = clampStr(lead.city, 120);
  if (lead.address) payload.address = clampStr(lead.address, 400);
  if (lead.business_type) payload.businessType = clampStr(lead.business_type, 120);
  if (lead.email_verification_reason) {
    payload.emailVerificationReason = clampStr(lead.email_verification_reason, 500);
  }
  if (lead.phone) payload.phone = clampStr(lead.phone, 80);
  if (lead.contact_person) payload.contactPerson = clampStr(lead.contact_person, 160);
  if (lead.contact_job_title) payload.contactJobTitle = clampStr(lead.contact_job_title, 160);
  if (lead.source_evidence) payload.sourceEvidence = clampStr(lead.source_evidence, 1000);
  if (lead.notes) payload.notes = clampStr(lead.notes, 2000);

  return { docId: buildFirestoreLeadDocId(uid, leadId), leadId, payload };
}

export function serializeBuyerForCreate(uid: string, buyer: ProspectBuyer) {
  const buyerId = sanitizeDocId(buyer.id, "buyer");
  const status: ProspectBuyer["status"] = VALID_CRM_STATUSES.has(buyer.status)
    ? buyer.status
    : "New Lead";

  const payload: Record<string, unknown> = {
    buyerId,
    ownerUid: uid,
    name: clampStr(buyer.name, 200, "Enterprise Importer"),
    country: clampStr(buyer.country, 100, "International"),
    website: clampStr(buyer.website, 512),
    email: clampStr(buyer.email || "NO VERIFIED EMAIL FOUND", 320),
    status,
    emailsSentCount: clampNum(buyer.emailsSentCount, 0, 10000, 0),
    aiScore: clampNum(buyer.aiScore, 0, 100, 75),
    isAiDiscovered: Boolean(buyer.isAiDiscovered),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (buyer.city) payload.city = clampStr(buyer.city, 120);
  if (buyer.procurementEmail) payload.procurementEmail = clampStr(buyer.procurementEmail, 320);
  if (buyer.phone) payload.phone = clampStr(buyer.phone, 80);
  if (buyer.purchasingManager) payload.purchasingManager = clampStr(buyer.purchasingManager, 160);
  if (buyer.procurementRole) payload.procurementRole = clampStr(buyer.procurementRole, 160);
  if (buyer.importerType) payload.importerType = clampStr(buyer.importerType, 120);
  if (buyer.companySize && ["Small", "Medium", "Large"].includes(buyer.companySize)) {
    payload.companySize = buyer.companySize;
  }
  if (buyer.notes) payload.notes = clampStr(buyer.notes, 2000);
  if (buyer.lastContactDate) payload.lastContactDate = clampStr(buyer.lastContactDate, 32);
  if (buyer.emailVerificationStatus) {
    payload.emailVerificationStatus = clampStr(buyer.emailVerificationStatus, 80);
  }
  if (buyer.emailVerificationSource) {
    payload.emailVerificationSource = clampStr(buyer.emailVerificationSource, 500);
  }
  if (Array.isArray(buyer.source_urls)) {
    payload.sourceUrls = clampStringArray(buyer.source_urls, 20, 512);
  }
  if (Array.isArray(buyer.requiredCrops)) {
    payload.requiredCrops = clampStringArray(buyer.requiredCrops, 25, 120);
  }

  return { docId: buildFirestoreBuyerDocId(uid, buyerId), buyerId, payload };
}

function deserializeCrmBuyer(data: Record<string, any>, fallbackMap: Map<string, ProspectBuyer>): ProspectBuyer {
  const base = fallbackMap.get(data.buyerId) || ({} as Partial<ProspectBuyer>);
  const updatedIso =
    data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : new Date().toISOString();

  return {
    ...base,
    id: data.buyerId || base.id || "",
    name: data.name || base.name || "",
    country: data.country || base.country || "",
    city: data.city || base.city || "",
    website: data.website || base.website || "",
    email: data.email || base.email || "",
    procurementEmail: data.procurementEmail || base.procurementEmail || "",
    phone: data.phone || base.phone || "",
    linkedIn: base.linkedIn || "",
    purchasingManager: data.purchasingManager || base.purchasingManager || "Procurement Department",
    procurementRole: data.procurementRole || base.procurementRole || "",
    importerType: data.importerType || base.importerType || "Importer",
    companySize: data.companySize || base.companySize || "Medium",
    employees: base.employees || 120,
    yearsInBusiness: base.yearsInBusiness || 12,
    importsFromEgypt: base.importsFromEgypt ?? true,
    importsFromTurkey: base.importsFromTurkey ?? false,
    importsFromChina: base.importsFromChina ?? false,
    importsFromIndia: base.importsFromIndia ?? false,
    competitiveOpportunity: base.competitiveOpportunity || "",
    aiScore: typeof data.aiScore === "number" ? data.aiScore : base.aiScore || 80,
    status: data.status || base.status || "New Lead",
    notes: data.notes ?? base.notes ?? "",
    lastContactDate: data.lastContactDate || base.lastContactDate,
    emailsSentCount: typeof data.emailsSentCount === "number" ? data.emailsSentCount : 0,
    emailVerificationStatus: data.emailVerificationStatus || base.emailVerificationStatus,
    emailVerificationSource: data.emailVerificationSource || base.emailVerificationSource,
    source_urls: Array.isArray(data.sourceUrls) ? data.sourceUrls : base.source_urls || [],
    requiredCrops: Array.isArray(data.requiredCrops) ? data.requiredCrops : base.requiredCrops || [],
    isAiDiscovered: Boolean(data.isAiDiscovered ?? base.isAiDiscovered),
    discoveryDate: updatedIso,
  };
}

function deserializeLeadRecord(data: Record<string, any>, fallbackMap: Map<string, LeadRecord>): LeadRecord {
  const base = fallbackMap.get(data.leadId) || ({} as Partial<LeadRecord>);
  const updatedIso =
    data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : new Date().toISOString();

  return {
    lead_id: data.leadId,
    company_name: data.companyName,
    normalized_company_name: data.normalizedCompanyName || "",
    country: data.country,
    country_code: data.countryCode || "XX",
    city: data.city || base.city || "",
    address: data.address || base.address || "",
    business_type: data.businessType || base.business_type || "Importer",
    industry: base.industry || "Agro-Food Sourcing & Cold-Chain Logistics",
    product_category: data.productCategories?.[0] || base.product_category || "IQF Produce",
    product_categories: data.productCategories || base.product_categories || [],
    buyer_type: base.buyer_type || data.businessType || "Direct Importer",
    importer_status: base.importer_status || "Confirmed Importer",
    official_website: data.officialWebsite || "",
    normalized_domain: data.normalizedDomain || "",
    email: data.email || "NO VERIFIED EMAIL FOUND",
    email_normalized: data.emailNormalized || "",
    email_verification_status: data.emailVerificationStatus || "UNVERIFIED",
    email_verification_reason: data.emailVerificationReason || "",
    phone: data.phone || "",
    normalized_phone: base.normalized_phone || "",
    contact_person: data.contactPerson || "Not Publicly Disclosed",
    contact_job_title: data.contactJobTitle || "Procurement",
    lead_quality_score: data.leadQualityScore ?? 50,
    lead_quality_grade: data.leadQualityGrade || "MEDIUM",
    duplicate_risk_score: base.duplicate_risk_score ?? 0,
    duplicate_status: base.duplicate_status || "UNIQUE_CANDIDATE",
    verification_status: data.verificationStatus || "NEW",
    verification_date: data.verificationDate || "",
    application_domain: base.application_domain || DEFAULT_APP_SETTINGS.official_company_domain,
    source_evidence: data.sourceEvidence || base.source_evidence || "",
    source_urls: Array.isArray(data.sourceUrls) ? data.sourceUrls : [],
    reason_for_buyer_relevance: base.reason_for_buyer_relevance || "",
    data_freshness: base.data_freshness || "CURRENT",
    last_checked_at: updatedIso,
    first_discovered_at: base.first_discovered_at || updatedIso,
    last_updated_at: updatedIso,
    notes: data.notes || "",
  };
}

/**
 * Ensures /users/{uid} and /users/{uid}/private/profile exist cleanly in sequence
 * (parent created/awaited before child subcollections per Master Gate rules).
 */
export async function ensureUserDocuments(user: User, settings: AppSettings): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: sanitizeDocId(user.uid, "uid"),
        displayName: clampStr(user.displayName || user.email?.split("@")[0] || "Export Advisor User", 120),
        role: "USER",
        photoUrl: clampStr(user.photoURL || "", 512),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: clampStr(user.displayName || user.email?.split("@")[0] || "Export Advisor User", 120),
        photoUrl: clampStr(user.photoURL || "", 512),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  const privatePath = `users/${user.uid}/private/profile`;
  const privateRef = doc(db, "users", user.uid, "private", "profile");
  try {
    const privSnap = await getDoc(privateRef);
    if (!privSnap.exists()) {
      await setDoc(privateRef, {
        ownerUid: user.uid,
        email: clampStr(user.email || "", 254),
        officialCompanyDomain: clampStr(settings.official_company_domain, 253, "galina-eg.com"),
        officialCompanyName: clampStr(settings.official_company_name, 160, "Galina Agro-Export Group"),
        officialCompanyWebsite: clampStr(settings.official_company_website, 512, "https://galina-eg.com"),
        migratedAt: new Date().toISOString().slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }
}

export async function updateUserPrivateSettings(user: User, settings: AppSettings): Promise<void> {
  const privatePath = `users/${user.uid}/private/profile`;
  const privateRef = doc(db, "users", user.uid, "private", "profile");
  try {
    await updateDoc(privateRef, {
      officialCompanyDomain: clampStr(settings.official_company_domain, 253, "galina-eg.com"),
      officialCompanyName: clampStr(settings.official_company_name, 160, "Galina Agro-Export Group"),
      officialCompanyWebsite: clampStr(settings.official_company_website, 512, "https://galina-eg.com"),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, privatePath);
  }
}

export interface LocalWorkspaceSnapshot {
  buyers: ProspectBuyer[];
  leads: LeadRecord[];
  products: Product[];
  suppliers: Supplier[];
  settings: AppSettings;
}

export interface CloudWorkspaceResult {
  buyers: ProspectBuyer[];
  leads: LeadRecord[];
  products: Product[];
  suppliers: Supplier[];
  migratedCount: number;
}

/**
 * Idempotently seeds verified buyers/products/suppliers and syncs browser localStorage data
 * to Firestore on first sign-in without duplicating existing cloud records.
 */
export async function migrateAndSyncWorkspace(
  user: User,
  local: LocalWorkspaceSnapshot
): Promise<CloudWorkspaceResult> {
  await ensureUserDocuments(user, local.settings);

  let migratedCount = 0;

  // 1. Sync CRM Buyers (/crmBuyers)
  let cloudBuyersMap = new Map<string, Record<string, any>>();
  try {
    const buyersQuery = query(collection(db, "crmBuyers"), where("ownerUid", "==", user.uid));
    const buyerSnaps = await getDocs(buyersQuery);
    buyerSnaps.forEach((d) => cloudBuyersMap.set(d.id, d.data()));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "crmBuyers");
  }

  const buyerSourceList = [...local.buyers];
  for (const seedBuyer of INITIAL_BUYERS) {
    if (!buyerSourceList.some((b) => b.id === seedBuyer.id)) {
      buyerSourceList.push(seedBuyer);
    }
  }

  for (const buyer of buyerSourceList) {
    const { docId, payload } = serializeBuyerForCreate(user.uid, buyer);
    if (!cloudBuyersMap.has(docId)) {
      try {
        await setDoc(doc(db, "crmBuyers", docId), payload);
        cloudBuyersMap.set(docId, { ...payload, updatedAt: Timestamp.now() });
        migratedCount++;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `crmBuyers/${docId}`);
      }
    }
  }

  // 2. Sync Lead Intelligence Records (/leads)
  const cloudLeadsMap = new Map<string, Record<string, any>>();
  try {
    const leadsQuery = query(collection(db, "leads"), where("ownerUid", "==", user.uid));
    const leadSnaps = await getDocs(leadsQuery);
    leadSnaps.forEach((d) => cloudLeadsMap.set(d.id, d.data()));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "leads");
  }

  for (const lead of local.leads) {
    const { docId, payload } = serializeLeadForCreate(user.uid, lead);
    if (!cloudLeadsMap.has(docId)) {
      try {
        await setDoc(doc(db, "leads", docId), payload);
        cloudLeadsMap.set(docId, { ...payload, updatedAt: Timestamp.now() });
        migratedCount++;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `leads/${docId}`);
      }
    }
  }

  // 3. Sync Export Products (/users/{uid}/products)
  const cloudProductsMap = new Map<string, Product>();
  try {
    const prodQuery = query(
      collection(db, "users", user.uid, "products"),
      where("ownerUid", "==", user.uid)
    );
    const prodSnaps = await getDocs(prodQuery);
    prodSnaps.forEach((d) => {
      const data = d.data();
      cloudProductsMap.set(data.productId, {
        id: data.productId,
        name: data.name,
        code: data.code,
        category: data.category,
        seasonStart: data.seasonStart,
        seasonEnd: data.seasonEnd,
        targetTemp: data.targetTemp,
        description: data.description,
        hsCode: data.hsCode,
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/products`);
  }

  const productList = local.products.length > 0 ? local.products : INITIAL_PRODUCTS;
  for (const p of productList) {
    const productId = sanitizeDocId(p.id, "prod");
    if (!cloudProductsMap.has(productId)) {
      const path = `users/${user.uid}/products/${productId}`;
      try {
        await setDoc(doc(db, "users", user.uid, "products", productId), {
          productId,
          ownerUid: user.uid,
          name: clampStr(p.name, 160, "IQF Crop"),
          code: clampStr(p.code, 40, "GAL"),
          category: ["Fruit", "Vegetable", "Mixed"].includes(p.category) ? p.category : "Mixed",
          seasonStart: clampStr(p.seasonStart, 40),
          seasonEnd: clampStr(p.seasonEnd, 40),
          targetTemp: clampStr(p.targetTemp, 40, "-18°C"),
          description: clampStr(p.description, 1000),
          hsCode: clampStr(p.hsCode, 32),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        cloudProductsMap.set(productId, { ...p, id: productId });
        migratedCount++;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  }

  // 4. Sync Suppliers (/users/{uid}/suppliers)
  const cloudSuppliersMap = new Map<string, Supplier>();
  try {
    const supQuery = query(
      collection(db, "users", user.uid, "suppliers"),
      where("ownerUid", "==", user.uid)
    );
    const supSnaps = await getDocs(supQuery);
    supSnaps.forEach((d) => {
      const data = d.data();
      cloudSuppliersMap.set(data.supplierId, {
        id: data.supplierId,
        name: data.name,
        type: data.type,
        location: data.location,
        rating: data.rating,
        certificates: data.certificates || [],
        productsSourced: data.productsSourced || [],
        contactPerson: data.contactPerson,
        phone: data.phone,
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/suppliers`);
  }

  const supplierList = local.suppliers.length > 0 ? local.suppliers : INITIAL_SUPPLIERS;
  for (const s of supplierList) {
    const supplierId = sanitizeDocId(s.id, "sup");
    if (!cloudSuppliersMap.has(supplierId)) {
      const path = `users/${user.uid}/suppliers/${supplierId}`;
      try {
        await setDoc(doc(db, "users", user.uid, "suppliers", supplierId), {
          supplierId,
          ownerUid: user.uid,
          name: clampStr(s.name, 160, "Export Partner"),
          type: ["Farm", "Packaging", "Logistics"].includes(s.type) ? s.type : "Farm",
          location: clampStr(s.location, 160),
          rating: clampNum(s.rating, 0, 5, 4.5),
          certificates: clampStringArray(s.certificates, 20, 120),
          productsSourced: clampStringArray(s.productsSourced, 30, 120),
          contactPerson: clampStr(s.contactPerson, 160),
          phone: clampStr(s.phone, 80),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        cloudSuppliersMap.set(supplierId, { ...s, id: supplierId });
        migratedCount++;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  }

  const buyerFallbackMap = new Map<string, ProspectBuyer>();
  buyerSourceList.forEach((b) => buyerFallbackMap.set(sanitizeDocId(b.id, "buyer"), b));

  const leadFallbackMap = new Map<string, LeadRecord>();
  local.leads.forEach((l) => leadFallbackMap.set(sanitizeDocId(l.lead_id, "lead"), l));

  const hydratedBuyers = Array.from(cloudBuyersMap.values()).map((d) =>
    deserializeCrmBuyer(d, buyerFallbackMap)
  );
  const hydratedLeads = Array.from(cloudLeadsMap.values()).map((d) =>
    deserializeLeadRecord(d, leadFallbackMap)
  );

  leadDatabase.mergeCloudLeads(hydratedLeads);

  return {
    buyers: hydratedBuyers,
    leads: leadDatabase.getAllLeads(),
    products: Array.from(cloudProductsMap.values()),
    suppliers: Array.from(cloudSuppliersMap.values()),
    migratedCount,
  };
}

export function subscribeWorkspaceCollections(
  uid: string,
  localFallbackBuyers: ProspectBuyer[],
  callbacks: {
    onBuyers: (buyers: ProspectBuyer[]) => void;
    onLeads: (leads: LeadRecord[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const buyerFallbackMap = new Map<string, ProspectBuyer>();
  [...INITIAL_BUYERS, ...localFallbackBuyers].forEach((b) =>
    buyerFallbackMap.set(sanitizeDocId(b.id, "buyer"), b)
  );

  const leadFallbackMap = new Map<string, LeadRecord>();
  leadDatabase.getAllLeads().forEach((l) =>
    leadFallbackMap.set(sanitizeDocId(l.lead_id, "lead"), l)
  );

  const buyersQ = query(collection(db, "crmBuyers"), where("ownerUid", "==", uid));
  const unsubBuyers = onSnapshot(
    buyersQ,
    (snapshot) => {
      const next = snapshot.docs.map((d) => deserializeCrmBuyer(d.data(), buyerFallbackMap));
      if (next.length > 0) {
        callbacks.onBuyers(next);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "crmBuyers");
      } catch (wrapped: any) {
        callbacks.onError(wrapped);
      }
    }
  );

  const leadsQ = query(collection(db, "leads"), where("ownerUid", "==", uid));
  const unsubLeads = onSnapshot(
    leadsQ,
    (snapshot) => {
      const nextLeads = snapshot.docs.map((d) => deserializeLeadRecord(d.data(), leadFallbackMap));
      if (nextLeads.length > 0) {
        leadDatabase.mergeCloudLeads(nextLeads);
        callbacks.onLeads(leadDatabase.getAllLeads());
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "leads");
      } catch (wrapped: any) {
        callbacks.onError(wrapped);
      }
    }
  );

  return () => {
    unsubBuyers();
    unsubLeads();
  };
}

export async function syncCreateBuyer(uid: string, buyer: ProspectBuyer): Promise<void> {
  const { docId, payload } = serializeBuyerForCreate(uid, buyer);
  const path = `crmBuyers/${docId}`;
  try {
    await setDoc(doc(db, "crmBuyers", docId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncBuyerStatus(
  uid: string,
  buyerId: string,
  status: ProspectBuyer["status"],
  lastContactDate: string
): Promise<void> {
  const docId = buildFirestoreBuyerDocId(uid, buyerId);
  const path = `crmBuyers/${docId}`;
  try {
    await updateDoc(doc(db, "crmBuyers", docId), {
      status,
      lastContactDate: clampStr(lastContactDate, 32),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncBuyerNotes(uid: string, buyerId: string, notes: string): Promise<void> {
  const docId = buildFirestoreBuyerDocId(uid, buyerId);
  const path = `crmBuyers/${docId}`;
  try {
    await updateDoc(doc(db, "crmBuyers", docId), {
      notes: clampStr(notes, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncBuyerEmailOutreach(
  uid: string,
  buyerId: string,
  emailsSentCount: number,
  lastContactDate: string,
  notes: string
): Promise<void> {
  const docId = buildFirestoreBuyerDocId(uid, buyerId);
  const path = `crmBuyers/${docId}`;
  try {
    await updateDoc(doc(db, "crmBuyers", docId), {
      emailsSentCount: clampNum(emailsSentCount, 0, 10000, 0),
      lastContactDate: clampStr(lastContactDate, 32),
      notes: clampStr(notes, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncDeleteBuyer(uid: string, buyerId: string): Promise<void> {
  const docId = buildFirestoreBuyerDocId(uid, buyerId);
  const path = `crmBuyers/${docId}`;
  try {
    await deleteDoc(doc(db, "crmBuyers", docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncUpsertLeadReverification(
  uid: string,
  lead: LeadRecord,
  mx?: { mxVerified?: boolean; mxHosts?: string[] }
): Promise<void> {
  const { docId, payload } = serializeLeadForCreate(uid, lead);
  const path = `leads/${docId}`;
  const ref = doc(db, "leads", docId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        ...(typeof mx?.mxVerified === "boolean" ? { mxVerified: mx.mxVerified } : {}),
        ...(Array.isArray(mx?.mxHosts) ? { mxHosts: clampStringArray(mx.mxHosts, 15, 253) } : {}),
      });
    } else {
      const updatePayload: Record<string, unknown> = {
        email: payload.email,
        emailNormalized: payload.emailNormalized,
        emailVerificationStatus: payload.emailVerificationStatus,
        verificationStatus: payload.verificationStatus,
        verificationDate: payload.verificationDate,
        leadQualityScore: payload.leadQualityScore,
        leadQualityGrade: payload.leadQualityGrade,
        sourceUrls: payload.sourceUrls,
        updatedAt: serverTimestamp(),
      };
      if (payload.emailVerificationReason) {
        updatePayload.emailVerificationReason = payload.emailVerificationReason;
      }
      if (payload.sourceEvidence) {
        updatePayload.sourceEvidence = payload.sourceEvidence;
      }
      if (typeof mx?.mxVerified === "boolean") updatePayload.mxVerified = mx.mxVerified;
      if (Array.isArray(mx?.mxHosts)) {
        updatePayload.mxHosts = clampStringArray(mx.mxHosts, 15, 253);
      }
      await updateDoc(ref, updatePayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncCreateProduct(uid: string, product: Product): Promise<void> {
  const productId = sanitizeDocId(product.id, "prod");
  const path = `users/${uid}/products/${productId}`;
  try {
    await setDoc(doc(db, "users", uid, "products", productId), {
      productId,
      ownerUid: uid,
      name: clampStr(product.name, 160),
      code: clampStr(product.code, 40),
      category: ["Fruit", "Vegetable", "Mixed"].includes(product.category) ? product.category : "Mixed",
      seasonStart: clampStr(product.seasonStart, 40),
      seasonEnd: clampStr(product.seasonEnd, 40),
      targetTemp: clampStr(product.targetTemp, 40),
      description: clampStr(product.description, 1000),
      hsCode: clampStr(product.hsCode, 32),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncCreateSupplier(uid: string, supplier: Supplier): Promise<void> {
  const supplierId = sanitizeDocId(supplier.id, "sup");
  const path = `users/${uid}/suppliers/${supplierId}`;
  try {
    await setDoc(doc(db, "users", uid, "suppliers", supplierId), {
      supplierId,
      ownerUid: uid,
      name: clampStr(supplier.name, 160),
      type: ["Farm", "Packaging", "Logistics"].includes(supplier.type) ? supplier.type : "Farm",
      location: clampStr(supplier.location, 160),
      rating: clampNum(supplier.rating, 0, 5, 4.5),
      certificates: clampStringArray(supplier.certificates, 20, 120),
      productsSourced: clampStringArray(supplier.productsSourced, 30, 120),
      contactPerson: clampStr(supplier.contactPerson, 160),
      phone: clampStr(supplier.phone, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
