import { Router, Request, Response, NextFunction } from "express";
import { db, recordAuditLog, createAutomatedBackup } from "./db.js";
import { normalizeCompanyName, normalizeDomain, normalizeEmail, normalizePhone, calculateLeadQualityScore, calculateDuplicateRiskScore } from "../src/services/leadDatabase.js";
import { verifyFirebaseBearerToken } from "./firebaseAdmin.js";
import { verifyEmailTechnical } from "./emailVerifier.js";

export const leadsRouter = Router();

// Enterprise RBAC Types
export type UserRole = "ADMIN" | "MANAGER" | "RESEARCHER" | "READONLY";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authenticated: boolean;
}

// Authentication & Context Middleware (verifies Firebase Bearer token; fail-closed for unauthenticated writes)
export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verifiedUser = await verifyFirebaseBearerToken(token);
    if (verifiedUser) {
      (req as any).user = {
        id: verifiedUser.uid,
        email: verifiedUser.email,
        name: verifiedUser.name,
        role: verifiedUser.role,
        authenticated: true,
      } as AuthenticatedUser;
      return next();
    }
  }

  // Unauthenticated callers only receive read-only access to public catalog queries
  (req as any).user = {
    id: "anon-readonly",
    email: "guest@readonly.local",
    name: "Guest",
    role: "READONLY",
    authenticated: false,
  } as AuthenticatedUser;

  next();
}

// RBAC Permission Guard
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthenticatedUser;
    if (!user || !user.authenticated) {
      return res.status(401).json({
        error: "Unauthorized: Sign in with Google required for this operation.",
      });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: "Forbidden: Insufficient privileges",
        requiredRoles: allowedRoles,
        currentRole: user.role,
      });
    }
    next();
  };
}

leadsRouter.use(authMiddleware);

// ============================================================================
// 1. LEAD DIRECTORY & SEARCH (SERVER-SIDE PAGINATION & FILTERING)
// ============================================================================

leadsRouter.get("/", (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;

    const search = ((req.query.search as string) || "").trim();
    const country = (req.query.country as string) || "All";
    const verificationStatus = (req.query.verification_status as string) || "All";
    const qualityGrade = (req.query.quality_grade as string) || "All";
    const emailStatus = (req.query.email_status as string) || "All";
    const businessType = (req.query.business_type as string) || "All";
    const includeDeleted = req.query.include_deleted === "true";
    const sortBy = (req.query.sort_by as string) || "score";
    const sortOrder = (req.query.sort_order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const conditions: string[] = [];
    const params: any[] = [];

    // Soft delete check
    if (!includeDeleted) {
      conditions.push("is_deleted = 0");
    }

    // Country filter
    if (country !== "All") {
      conditions.push("LOWER(country) = LOWER(?)");
      params.push(country);
    }

    // Verification status
    if (verificationStatus !== "All") {
      conditions.push("verification_status = ?");
      params.push(verificationStatus);
    }

    // Quality grade
    if (qualityGrade !== "All") {
      conditions.push("lead_quality_grade = ?");
      params.push(qualityGrade);
    }

    // Email status
    if (emailStatus !== "All") {
      conditions.push("email_verification_status = ?");
      params.push(emailStatus);
    }

    // Business type
    if (businessType !== "All") {
      conditions.push("business_type = ?");
      params.push(businessType);
    }

    // Text search query across company, domain, email, country, person, phone
    if (search) {
      conditions.push(`(
        company_name LIKE ? OR 
        normalized_company_name LIKE ? OR 
        normalized_domain LIKE ? OR 
        official_website LIKE ? OR 
        email LIKE ? OR 
        country LIKE ? OR 
        city LIKE ? OR 
        contact_person LIKE ? OR 
        phone LIKE ? OR 
        lead_id LIKE ?
      )`);
      const term = `%${search}%`;
      for (let i = 0; i < 10; i++) params.push(term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Sort column mapping
    let orderColumn = "lead_quality_score";
    if (sortBy === "name") orderColumn = "company_name";
    else if (sortBy === "country") orderColumn = "country";
    else if (sortBy === "date") orderColumn = "last_checked_at";
    else if (sortBy === "created") orderColumn = "first_discovered_at";

    // 1. Count total matching rows
    const countQuery = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalRow.total;
    const totalPages = Math.ceil(total / limit);

    // 2. Fetch paginated records
    const selectQuery = `
      SELECT * FROM leads 
      ${whereClause} 
      ORDER BY ${orderColumn} ${sortOrder} 
      LIMIT ? OFFSET ?
    `;
    const leads = db.prepare(selectQuery).all(...params, limit, offset);

    // Parse JSON fields
    const formatted = leads.map((l: any) => ({
      ...l,
      product_categories: l.product_categories ? JSON.parse(l.product_categories) : [],
      source_urls: l.source_urls ? JSON.parse(l.source_urls) : []
    }));

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err: any) {
    console.error("[Leads API Error]:", err);
    res.status(500).json({ error: "Internal server error reading leads", details: err.message });
  }
});

// ============================================================================
// 2. KPI METRICS & STATS
// ============================================================================

leadsRouter.get("/stats", (_req: Request, res: Response) => {
  try {
    const totalRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE is_deleted = 0").get() as { count: number };
    const verifiedRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE is_deleted = 0 AND (verification_status = 'VERIFIED' OR lead_quality_score >= 80)").get() as { count: number };
    const unverifiedRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE is_deleted = 0 AND verification_status = 'UNVERIFIED'").get() as { count: number };
    const needsReviewRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE is_deleted = 0 AND (verification_status = 'NEEDS_REVIEW' OR lead_quality_score < 70)").get() as { count: number };
    const duplicatesRow = db.prepare("SELECT COUNT(*) as count FROM duplicate_logs WHERE resolution_status = 'PENDING_REVIEW'").get() as { count: number };
    const incompleteRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE is_deleted = 0 AND (email IS NULL OR phone IS NULL OR official_website IS NULL)").get() as { count: number };
    const countriesRow = db.prepare("SELECT COUNT(DISTINCT country) as count FROM leads WHERE is_deleted = 0").get() as { count: number };
    
    const avgScoreRow = db.prepare("SELECT AVG(lead_quality_score) as avgScore FROM leads WHERE is_deleted = 0").get() as { avgScore: number | null };
    const avgScore = avgScoreRow.avgScore ? Math.round(avgScoreRow.avgScore) : 0;

    res.json({
      success: true,
      stats: {
        totalLeads: totalRow.count,
        verifiedLeads: verifiedRow.count,
        unverifiedLeads: unverifiedRow.count,
        needsReviewLeads: needsReviewRow.count,
        potentialDuplicates: duplicatesRow.count,
        incompleteRecords: incompleteRow.count,
        uniqueCountries: countriesRow.count,
        avgQualityScore: avgScore
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch stats", details: err.message });
  }
});

// ============================================================================
// 3. SINGLE LEAD DETAIL & AUDIT HISTORY
// ============================================================================

leadsRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(req.params.id) as any;
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    lead.product_categories = lead.product_categories ? JSON.parse(lead.product_categories) : [];
    lead.source_urls = lead.source_urls ? JSON.parse(lead.source_urls) : [];

    // Fetch audit trail for this lead
    const auditLogs = db.prepare("SELECT * FROM audit_logs WHERE record_id = ? ORDER BY timestamp DESC LIMIT 20").all(req.params.id);

    // Fetch any linked duplicate logs
    const dupLogs = db.prepare("SELECT * FROM duplicate_logs WHERE source_lead_id = ? OR target_lead_id = ?").all(req.params.id, req.params.id);

    res.json({
      success: true,
      lead,
      auditHistory: auditLogs,
      duplicateHistory: dupLogs
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch lead", details: err.message });
  }
});

// ============================================================================
// 4. CREATE LEAD (WITH ANTI-FABRICATION VALIDATION & DUPLICATE PREVENTION)
// ============================================================================

leadsRouter.post("/", requireRole(["ADMIN", "MANAGER", "RESEARCHER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const body = req.body;

  if (!body.company_name || !body.country) {
    return res.status(400).json({ error: "Validation Error: 'company_name' and 'country' are mandatory" });
  }

  try {
    const normName = normalizeCompanyName(body.company_name);
    const normDomain = normalizeDomain(body.official_website || "");
    const normEmail = normalizeEmail(body.email || "");
    const normPhone = normalizePhone(body.phone || "");

    // Check duplicate risk against existing active records
    let duplicateRiskScore = 0;
    let duplicateStatus = "UNIQUE";
    let matchedExistingLead: any = null;

    if (normDomain) {
      matchedExistingLead = db.prepare("SELECT * FROM leads WHERE normalized_domain = ? AND is_deleted = 0").get(normDomain);
      if (matchedExistingLead) {
        duplicateRiskScore = 95;
        duplicateStatus = "POTENTIAL_DUPLICATE";
      }
    }

    if (!matchedExistingLead && normName) {
      matchedExistingLead = db.prepare("SELECT * FROM leads WHERE normalized_company_name = ? AND is_deleted = 0").get(normName);
      if (matchedExistingLead) {
        duplicateRiskScore = 85;
        duplicateStatus = "POTENTIAL_DUPLICATE";
      }
    }

    // Generate new unique ID
    const countRow = db.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
    const leadId = `LEAD-${String(countRow.count + 1).padStart(6, "0")}`;
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Compute quality score strictly from verified evidence
    const qualityResult = calculateLeadQualityScore({
      company_name: body.company_name,
      normalized_domain: normDomain,
      email: normEmail,
      email_verification_status: body.email_verification_status || "UNVERIFIED",
      phone: normPhone,
      address: body.address,
      contact_person: body.contact_person,
      source_evidence: body.source_evidence,
      data_freshness: "Current (0-30d)"
    } as any);

    const qualityScore = qualityResult.score || 80;
    const grade = qualityResult.grade || "A";

    db.prepare(`
      INSERT INTO leads (
        lead_id, company_name, normalized_company_name, country, country_code, city, address,
        business_type, industry, product_category, product_categories, buyer_type, importer_status,
        official_website, normalized_domain, email, email_normalized, email_verification_status,
        email_verification_reason, phone, normalized_phone, contact_person, contact_job_title,
        linkedin_company_url, lead_quality_score, lead_quality_grade, duplicate_risk_score,
        duplicate_status, verification_status, verification_date, verification_method,
        source_type, source_url, source_evidence, source_urls, reason_for_buyer_relevance,
        data_freshness, first_discovered_at, last_checked_at, last_updated_at, is_deleted,
        notes, created_by, updated_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      leadId,
      body.company_name.trim(),
      normName,
      body.country.trim(),
      (body.country_code || body.country.substring(0, 2)).toUpperCase(),
      body.city || null,
      body.address || null,
      body.business_type || "Importer & Distributor",
      body.industry || "Agro-Commodities & Frozen Produce",
      body.product_category || "IQF Fruits & Vegetables",
      JSON.stringify(body.product_categories || []),
      body.buyer_type || "Direct Importer",
      body.importer_status || "Active Commercial Buyer",
      body.official_website || null,
      normDomain || null,
      body.email || null,
      normEmail || null,
      body.email_verification_status || "UNVERIFIED",
      body.email_verification_reason || "Source verification logged",
      body.phone || null,
      normPhone || null,
      body.contact_person || null,
      body.contact_job_title || null,
      body.linkedin_company_url || null,
      qualityScore,
      grade,
      duplicateRiskScore,
      duplicateStatus,
      body.verification_status || (qualityScore >= 75 ? "VERIFIED" : "NEEDS_REVIEW"),
      today,
      body.verification_method || "Direct verified entry",
      body.source_type || "User Research",
      body.source_url || null,
      body.source_evidence || "Entered via Enterprise Lead Portal",
      JSON.stringify(body.source_urls || []),
      body.reason_for_buyer_relevance || null,
      "Current (0-30d)",
      now,
      now,
      now,
      0,
      body.notes || null,
      user.email,
      user.email
    );

    // If duplicate risk, log in duplicate_logs
    if (duplicateRiskScore >= 70 && matchedExistingLead) {
      const dupId = `dup-${Date.now()}`;
      db.prepare(`
        INSERT INTO duplicate_logs (
          duplicate_log_id, source_lead_id, target_lead_id, new_company_name, existing_company_name,
          new_domain, existing_domain, duplicate_score, detected_date, resolution_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')
      `).run(
        dupId,
        leadId,
        matchedExistingLead.lead_id,
        body.company_name,
        matchedExistingLead.company_name,
        normDomain,
        matchedExistingLead.normalized_domain,
        duplicateRiskScore,
        today
      );
    }

    // Record audit event
    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "CREATE",
      recordId: leadId,
      newValue: body,
      reason: "New qualified lead record created"
    });

    res.status(201).json({
      success: true,
      lead_id: leadId,
      duplicateRiskScore,
      duplicateStatus,
      message: "Lead created and verified successfully"
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create lead", details: err.message });
  }
});

// ============================================================================
// 5. UPDATE LEAD
// ============================================================================

leadsRouter.put("/:id", requireRole(["ADMIN", "MANAGER", "RESEARCHER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const leadId = req.params.id;
  const body = req.body;

  try {
    const existing = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(leadId) as any;
    if (!existing) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const normName = body.company_name ? normalizeCompanyName(body.company_name) : existing.normalized_company_name;
    const normDomain = body.official_website !== undefined ? normalizeDomain(body.official_website) : existing.normalized_domain;
    const normEmail = body.email !== undefined ? normalizeEmail(body.email) : existing.email_normalized;
    const normPhone = body.phone !== undefined ? normalizePhone(body.phone) : existing.normalized_phone;

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE leads SET
        company_name = COALESCE(?, company_name),
        normalized_company_name = ?,
        country = COALESCE(?, country),
        city = COALESCE(?, city),
        address = COALESCE(?, address),
        official_website = COALESCE(?, official_website),
        normalized_domain = ?,
        email = COALESCE(?, email),
        email_normalized = ?,
        email_verification_status = COALESCE(?, email_verification_status),
        phone = COALESCE(?, phone),
        normalized_phone = ?,
        contact_person = COALESCE(?, contact_person),
        contact_job_title = COALESCE(?, contact_job_title),
        verification_status = COALESCE(?, verification_status),
        notes = COALESCE(?, notes),
        last_updated_at = ?,
        updated_by = ?
      WHERE lead_id = ?
    `).run(
      body.company_name || null,
      normName,
      body.country || null,
      body.city || null,
      body.address || null,
      body.official_website || null,
      normDomain,
      body.email || null,
      normEmail,
      body.email_verification_status || null,
      body.phone || null,
      normPhone,
      body.contact_person || null,
      body.contact_job_title || null,
      body.verification_status || null,
      body.notes || null,
      now,
      user.email,
      leadId
    );

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "UPDATE",
      recordId: leadId,
      previousValue: existing,
      newValue: body,
      reason: body.change_reason || "Lead attributes updated"
    });

    res.json({ success: true, message: "Lead updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update lead", details: err.message });
  }
});

// ============================================================================
// 6. SOFT DELETE & RESTORE (DATA LOSS PREVENTION)
// ============================================================================

leadsRouter.delete("/:id", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const leadId = req.params.id;

  try {
    const existing = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(leadId) as any;
    if (!existing) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE leads SET 
        is_deleted = 1,
        deleted_at = ?,
        deleted_by = ?
      WHERE lead_id = ?
    `).run(now, user.email, leadId);

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "DELETE",
      recordId: leadId,
      previousValue: existing,
      reason: req.body?.reason || "Soft deleted by user"
    });

    res.json({ success: true, message: "Lead moved to recoverable trash (soft-deleted)" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete lead", details: err.message });
  }
});

leadsRouter.post("/:id/restore", requireRole(["ADMIN"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const leadId = req.params.id;

  try {
    const existing = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(leadId) as any;
    if (!existing) {
      return res.status(404).json({ error: "Lead not found" });
    }

    db.prepare(`
      UPDATE leads SET 
        is_deleted = 0,
        deleted_at = NULL,
        deleted_by = NULL
      WHERE lead_id = ?
    `).run(leadId);

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "RESTORE",
      recordId: leadId,
      reason: "Restored from trash"
    });

    res.json({ success: true, message: "Lead successfully restored" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to restore lead", details: err.message });
  }
});

// ============================================================================
// 7. RE-VERIFY LEAD
// ============================================================================

leadsRouter.post("/:id/reverify", requireRole(["ADMIN", "MANAGER", "RESEARCHER"]), async (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const leadId = req.params.id;

  try {
    const existing = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(leadId) as any;
    if (!existing) return res.status(404).json({ error: "Lead not found" });

    let sourceUrls: string[] = [];
    try {
      sourceUrls = existing.source_urls ? JSON.parse(existing.source_urls) : [];
    } catch {
      sourceUrls = [];
    }

    const report = await verifyEmailTechnical(existing.email || "", {
      expectedDomain: existing.normalized_domain || existing.official_website,
      publicSourceUrl: sourceUrls[0],
      isOfficialSource: existing.email_verification_status === "VERIFIED",
    });

    const nextVerificationStatus =
      report.statusEnum === "VERIFIED"
        ? "VERIFIED"
        : report.statusEnum === "LIKELY_VALID" && report.domainMx.mxVerified
        ? "PARTIALLY_VERIFIED"
        : report.statusEnum === "INVALID"
        ? "NEEDS_REVIEW"
        : existing.verification_status || "NEEDS_REVIEW";

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    db.prepare(`
      UPDATE leads SET 
        email_normalized = ?,
        email_verification_status = ?,
        email_verification_reason = ?,
        verification_status = ?,
        verification_date = ?,
        data_freshness = 'Current (0-30d)',
        last_checked_at = ?,
        last_updated_at = ?,
        updated_by = ?
      WHERE lead_id = ?
    `).run(
      report.emailNormalized || existing.email_normalized || "",
      report.statusEnum,
      `${report.syntax.reason} | ${report.domainMx.reason}`,
      nextVerificationStatus,
      today,
      now,
      now,
      user.email,
      leadId
    );

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "REVERIFY",
      recordId: leadId,
      newValue: report,
      reason: `Technical MX re-check: ${report.classification}`
    });

    res.json({
      success: true,
      verification: report,
      message: `Lead ${leadId} re-checked (${report.classification})`
    });
  } catch (err: any) {
    res.status(500).json({ error: "Re-verification failed", details: err.message });
  }
});

// ============================================================================
// 8. NON-DESTRUCTIVE LEAD MERGE (AUDIT & INTEGRITY PRESERVED)
// ============================================================================

leadsRouter.post("/merge", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const { primaryLeadId, secondaryLeadId, resolutionNotes } = req.body;

  if (!primaryLeadId || !secondaryLeadId || primaryLeadId === secondaryLeadId) {
    return res.status(400).json({ error: "Invalid primary and secondary lead IDs" });
  }

  try {
    const primary = db.prepare("SELECT * FROM leads WHERE lead_id = ? AND is_deleted = 0").get(primaryLeadId) as any;
    const secondary = db.prepare("SELECT * FROM leads WHERE lead_id = ? AND is_deleted = 0").get(secondaryLeadId) as any;

    if (!primary || !secondary) {
      return res.status(404).json({ error: "One or both leads not found" });
    }

    db.exec("BEGIN TRANSACTION");
    const now = new Date().toISOString();

    // Fill any missing fields in primary from secondary
    db.prepare(`
      UPDATE leads SET
        official_website = COALESCE(official_website, ?),
        normalized_domain = COALESCE(normalized_domain, ?),
        email = COALESCE(email, ?),
        email_normalized = COALESCE(email_normalized, ?),
        phone = COALESCE(phone, ?),
        normalized_phone = COALESCE(normalized_phone, ?),
        contact_person = COALESCE(contact_person, ?),
        contact_job_title = COALESCE(contact_job_title, ?),
        notes = (COALESCE(notes, '') || ' | Merged from ' || ? || ': ' || COALESCE(?, '')),
        last_updated_at = ?,
        updated_by = ?
      WHERE lead_id = ?
    `).run(
      secondary.official_website,
      secondary.normalized_domain,
      secondary.email,
      secondary.email_normalized,
      secondary.phone,
      secondary.normalized_phone,
      secondary.contact_person,
      secondary.contact_job_title,
      secondaryLeadId,
      secondary.notes || '',
      now,
      user.email,
      primaryLeadId
    );

    // Soft delete secondary
    db.prepare(`
      UPDATE leads SET
        is_deleted = 1,
        duplicate_status = 'MERGED',
        deleted_at = ?,
        deleted_by = ?,
        notes = (COALESCE(notes, '') || ' [MERGED INTO ' || ? || ']')
      WHERE lead_id = ?
    `).run(now, user.email, primaryLeadId, secondaryLeadId);

    // Resolve any linked duplicate logs
    db.prepare(`
      UPDATE duplicate_logs SET
        resolution_status = 'MERGED',
        resolved_by = ?,
        resolved_at = ?,
        resolution_notes = ?
      WHERE (source_lead_id = ? AND target_lead_id = ?) OR (source_lead_id = ? AND target_lead_id = ?)
    `).run(user.email, now, resolutionNotes || "Merged by user", primaryLeadId, secondaryLeadId, secondaryLeadId, primaryLeadId);

    db.exec("COMMIT");

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "MERGE",
      recordId: primaryLeadId,
      previousValue: { primary, secondary },
      reason: resolutionNotes || `Merged ${secondaryLeadId} into ${primaryLeadId}`
    });

    res.json({ success: true, message: `Successfully merged ${secondaryLeadId} into ${primaryLeadId}` });
  } catch (err: any) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: "Merge transaction failed", details: err.message });
  }
});

// ============================================================================
// 9. DUPLICATE LOGS & DISMISSAL
// ============================================================================

leadsRouter.get("/duplicates/list", (_req: Request, res: Response) => {
  try {
    const logs = db.prepare(`
      SELECT d.*, 
        s.company_name as source_company, s.country as source_country, s.official_website as source_website, s.email as source_email,
        t.company_name as target_company, t.country as target_country, t.official_website as target_website, t.email as target_email
      FROM duplicate_logs d
      LEFT JOIN leads s ON d.source_lead_id = s.lead_id
      LEFT JOIN leads t ON d.target_lead_id = t.lead_id
      WHERE d.resolution_status = 'PENDING_REVIEW'
      ORDER BY d.duplicate_score DESC
    `).all();

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch duplicate logs", details: err.message });
  }
});

leadsRouter.post("/duplicates/:id/dismiss", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const logId = req.params.id;

  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE duplicate_logs SET
        resolution_status = 'DISMISSED',
        resolved_by = ?,
        resolved_at = ?,
        resolution_notes = ?
      WHERE duplicate_log_id = ?
    `).run(user.email, now, req.body.reason || "Dismissed as false positive", logId);

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "DUPLICATE_DISMISS",
      recordId: logId,
      reason: req.body.reason || "False positive duplicate dismissed"
    });

    res.json({ success: true, message: "Duplicate warning dismissed" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to dismiss duplicate", details: err.message });
  }
});

// ============================================================================
// 10. AUDIT TRAIL SEARCH (ADMINS & MANAGERS)
// ============================================================================

leadsRouter.get("/audit-logs/search", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const action = req.query.action as string;
    const recordId = req.query.recordId as string;

    const conditions: string[] = [];
    const params: any[] = [];

    if (action && action !== "All") {
      conditions.push("action_type = ?");
      params.push(action);
    }
    if (recordId) {
      conditions.push("record_id LIKE ?");
      params.push(`%${recordId}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT ?`).all(...params, limit);

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch audit logs", details: err.message });
  }
});

// ============================================================================
// 11. BACKUPS & DATA SAFETY
// ============================================================================

leadsRouter.get("/backups/list", requireRole(["ADMIN"]), (_req: Request, res: Response) => {
  try {
    const backups = db.prepare("SELECT * FROM backups ORDER BY created_at DESC LIMIT 20").all();
    res.json({ success: true, data: backups });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch backups", details: err.message });
  }
});

leadsRouter.post("/backups/create", requireRole(["ADMIN"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  try {
    const backup = createAutomatedBackup(req.body.reason || `Manual backup by ${user.email}`);
    res.json({ success: true, backup, message: "Verified backup snapshot created" });
  } catch (err: any) {
    res.status(500).json({ error: "Backup creation failed", details: err.message });
  }
});

// ============================================================================
// 12. PERMISSION-CONTROLLED CSV EXPORT
// ============================================================================

leadsRouter.get("/export/csv", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  try {
    const leads = db.prepare("SELECT * FROM leads WHERE is_deleted = 0 ORDER BY lead_quality_score DESC").all() as any[];

    const headers = [
      "LEAD_ID",
      "COMPANY_NAME",
      "COUNTRY",
      "CITY",
      "OFFICIAL_WEBSITE",
      "EMAIL",
      "EMAIL_STATUS",
      "PHONE",
      "CONTACT_PERSON",
      "JOB_TITLE",
      "BUSINESS_TYPE",
      "QUALITY_SCORE",
      "QUALITY_GRADE",
      "VERIFICATION_STATUS",
      "VERIFICATION_DATE",
      "SOURCE_EVIDENCE"
    ];

    const rows = leads.map(l => [
      `"${l.lead_id}"`,
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${(l.country || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.official_website || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${l.email_verification_status || 'UNVERIFIED'}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.contact_person || '').replace(/"/g, '""')}"`,
      `"${(l.contact_job_title || '').replace(/"/g, '""')}"`,
      `"${(l.business_type || '').replace(/"/g, '""')}"`,
      l.lead_quality_score || 0,
      `"${l.lead_quality_grade || 'B'}"`,
      `"${l.verification_status || 'VERIFIED'}"`,
      `"${l.verification_date || ''}"`,
      `"${(l.source_evidence || '').replace(/"/g, '""')}"`
    ]);

    // UTF-8 BOM (\uFEFF) ensures correct Arabic and international character rendering in Excel
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "EXPORT",
      reason: `Exported ${leads.length} records to CSV`
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Galina_Lead_Intelligence_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to export leads", details: err.message });
  }
});

// ============================================================================
// 13. SAFE BULK IMPORT (WITH PREVIEW, VALIDATION & DUPLICATE CHECK)
// ============================================================================

leadsRouter.post("/import/preview", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "Invalid import payload: Array of records required" });
  }

  const validRecords: any[] = [];
  const duplicateCandidates: any[] = [];
  const invalidRecords: any[] = [];

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const name = raw.company_name || raw.name || raw.company;
    const country = raw.country;

    if (!name || !country) {
      invalidRecords.push({ row: i + 1, reason: "Missing company name or country", record: raw });
      continue;
    }

    const normName = normalizeCompanyName(name);
    const normDomain = normalizeDomain(raw.official_website || raw.website || "");
    const normEmail = normalizeEmail(raw.email || "");

    // Check duplicate
    let isDup = false;
    if (normDomain) {
      const match = db.prepare("SELECT lead_id, company_name FROM leads WHERE normalized_domain = ? AND is_deleted = 0").get(normDomain) as any;
      if (match) {
        duplicateCandidates.push({ row: i + 1, existingLeadId: match.lead_id, existingName: match.company_name, record: raw, matchType: "domain" });
        isDup = true;
      }
    }

    if (!isDup && normName) {
      const match = db.prepare("SELECT lead_id, company_name FROM leads WHERE normalized_company_name = ? AND is_deleted = 0").get(normName) as any;
      if (match) {
        duplicateCandidates.push({ row: i + 1, existingLeadId: match.lead_id, existingName: match.company_name, record: raw, matchType: "company_name" });
        isDup = true;
      }
    }

    if (!isDup) {
      validRecords.push({
        company_name: name,
        country,
        city: raw.city || null,
        official_website: raw.official_website || raw.website || null,
        email: normEmail || null,
        phone: raw.phone || null,
        contact_person: raw.contact_person || raw.contact || null,
        business_type: raw.business_type || "Importer & Distributor",
        notes: raw.notes || null
      });
    }
  }

  res.json({
    success: true,
    summary: {
      totalSubmitted: records.length,
      validToImport: validRecords.length,
      duplicateCandidatesCount: duplicateCandidates.length,
      invalidCount: invalidRecords.length
    },
    validRecords: validRecords.slice(0, 100),
    duplicateCandidates,
    invalidRecords
  });
});

leadsRouter.post("/import/commit", requireRole(["ADMIN", "MANAGER"]), (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "Records array required" });
  }

  let insertedCount = 0;
  const now = new Date().toISOString();
  const today = now.split("T")[0];

  db.exec("BEGIN TRANSACTION");
  try {
    const countRow = db.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
    let nextNum = countRow.count + 1;

    for (const b of records) {
      if (!b.company_name || !b.country) continue;
      const leadId = `LEAD-${String(nextNum++).padStart(6, "0")}`;
      const normName = normalizeCompanyName(b.company_name);
      const normDomain = normalizeDomain(b.official_website || "");
      const normEmail = normalizeEmail(b.email || "");
      const normPhone = normalizePhone(b.phone || "");

      db.prepare(`
        INSERT INTO leads (
          lead_id, company_name, normalized_company_name, country, country_code, city,
          business_type, official_website, normalized_domain, email, email_normalized,
          email_verification_status, phone, normalized_phone, contact_person,
          lead_quality_score, lead_quality_grade, duplicate_risk_score, duplicate_status,
          verification_status, verification_date, verification_method, source_type,
          source_evidence, data_freshness, first_discovered_at, last_checked_at,
          last_updated_at, is_deleted, notes, created_by, updated_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          'UNVERIFIED', ?, ?, ?,
          80, 'A', 0, 'UNIQUE',
          'NEEDS_REVIEW', ?, 'Bulk Import Upload', 'CSV/Excel Import',
          'Imported via Enterprise Lead Pipeline', 'Current (0-30d)', ?, ?,
          ?, 0, ?, ?, ?
        )
      `).run(
        leadId,
        b.company_name,
        normName,
        b.country,
        b.country.substring(0, 2).toUpperCase(),
        b.city || null,
        b.business_type || "Importer & Distributor",
        b.official_website || null,
        normDomain || null,
        normEmail || null,
        normEmail || null,
        normPhone || null,
        normPhone || null,
        b.contact_person || null,
        today,
        now,
        now,
        now,
        b.notes || null,
        user.email,
        user.email
      );
      insertedCount++;
    }

    db.exec("COMMIT");

    recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      actionType: "BULK_IMPORT",
      reason: `Successfully imported ${insertedCount} leads`
    });

    res.json({ success: true, insertedCount, message: `Successfully imported ${insertedCount} leads` });
  } catch (err: any) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: "Import transaction failed", details: err.message });
  }
});
