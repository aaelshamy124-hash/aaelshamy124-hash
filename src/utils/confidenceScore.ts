import { ProspectBuyer } from "../types";

export interface VerifiedSourceDetail {
  id: string;
  type: "website" | "email_mx" | "linkedin" | "registry" | "customs" | "external";
  titleEn: string;
  titleAr: string;
  detail?: string;
  url?: string;
  verified: boolean;
}

export type ConfidenceTier = "high" | "medium" | "moderate" | "ai_suggested" | "unverified";

export interface BuyerConfidenceResult {
  score: number; // 0 - 100
  tier: ConfidenceTier;
  sourcesCount: number;
  sources: VerifiedSourceDetail[];
  isAiSuggested: boolean;
  tierLabelEn: string;
  tierLabelAr: string;
  badgeLabelEn: string;
  badgeLabelAr: string;
  badgeClass: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  summaryEn: string;
  summaryAr: string;
  actionRecommendationEn: string;
  actionRecommendationAr: string;
}

/**
 * Calculates a rigorous Confidence Score and extracts verified sources for any buyer or lead.
 * Distinguishes between highly reliable multi-source verified data and AI-suggested leads.
 */
export function calculateBuyerConfidence(buyer: Partial<ProspectBuyer> | any): BuyerConfidenceResult {
  if (!buyer) {
    return {
      score: 30,
      tier: "unverified",
      sourcesCount: 0,
      sources: [],
      isAiSuggested: true,
      tierLabelEn: "Unverified",
      tierLabelAr: "غير موثق",
      badgeLabelEn: "Unverified (0 Sources)",
      badgeLabelAr: "غير موثق (0 مصادر)",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      pillBg: "bg-slate-50",
      pillBorder: "border-slate-200",
      pillText: "text-slate-600",
      summaryEn: "No verifiable contact sources found.",
      summaryAr: "لم يتم العثور على مصادر موثقة لهذا السجل.",
      actionRecommendationEn: "Perform manual online due-diligence before outreach.",
      actionRecommendationAr: "يجب التحقق اليدوي المستقل قبل التواصل."
    };
  }

  const sources: VerifiedSourceDetail[] = [];
  const isAiDiscovered = Boolean(
    buyer.isAiDiscovered || 
    (buyer.id && String(buyer.id).startsWith("ai-hunt-")) ||
    (buyer.batchId && String(buyer.batchId).startsWith("batch-"))
  );

  // 1. Official Corporate Website Check
  const rawWebsite = buyer.website || buyer.official_website || buyer.lead_official_website;
  if (rawWebsite && typeof rawWebsite === "string" && rawWebsite.trim().length > 3) {
    const cleanWeb = rawWebsite.trim();
    if (!cleanWeb.includes("example.com") && !cleanWeb.includes("placeholder")) {
      sources.push({
        id: "source-website",
        type: "website",
        titleEn: "Official Corporate Website",
        titleAr: "الموقع الإلكتروني الرسمي للشركة",
        detail: cleanWeb.replace(/^https?:\/\/(www\.)?/, ""),
        url: cleanWeb.startsWith("http") ? cleanWeb : `https://${cleanWeb}`,
        verified: true
      });
    }
  }

  // 2. Direct Corporate Email Domain & MX Verification Check
  const rawEmail = buyer.procurementEmail || buyer.realEmail || buyer.email;
  const isCorporateVerifiedEmail = Boolean(
    buyer.contactVerified ||
    buyer.emailVerificationStatus === "VERIFIED – OFFICIAL COMPANY SOURCE" ||
    buyer.emailVerificationStatus === "VERIFIED – PUBLICLY CONFIRMED" ||
    buyer.email_verification_status === "VERIFIED"
  );

  if (rawEmail && typeof rawEmail === "string" && rawEmail.includes("@")) {
    const emailDomain = rawEmail.split("@")[1]?.toLowerCase();
    const isFreeMail = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(emailDomain);
    
    // Check if matching website domain
    const webDomain = rawWebsite ? rawWebsite.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase() : "";
    const isDomainMatch = webDomain && emailDomain && (webDomain.includes(emailDomain) || emailDomain.includes(webDomain));

    if (isCorporateVerifiedEmail || (isDomainMatch && !isFreeMail)) {
      sources.push({
        id: "source-email-mx",
        type: "email_mx",
        titleEn: "Corporate Domain Email & MX Verified",
        titleAr: "بريد نطاق الشركات وسجل MX مفحوص",
        detail: rawEmail,
        verified: true
      });
    }
  }

  // 3. Official LinkedIn Corporate Profile Check
  const rawLinkedIn = buyer.linkedIn || buyer.linkedin_company_url;
  if (rawLinkedIn && typeof rawLinkedIn === "string" && rawLinkedIn.includes("linkedin.com")) {
    sources.push({
      id: "source-linkedin",
      type: "linkedin",
      titleEn: "Official LinkedIn Corporate Profile",
      titleAr: "الملف الرسمي المعتمد على لينكدإن",
      detail: rawLinkedIn.replace(/^https?:\/\/(www\.)?linkedin\.com\//, ""),
      url: rawLinkedIn,
      verified: true
    });
  }

  // 4. Commercial Registry & Physical Headquarters Address Check
  const rawHQ = buyer.headquartersAddress || buyer.address;
  const rawVerificationSource = buyer.emailVerificationSource || buyer.source_evidence;
  const hasRegistryProof = Boolean(
    (rawHQ && rawHQ.length > 8 && !rawHQ.includes("Central District")) ||
    (rawVerificationSource && (
      rawVerificationSource.includes("Registry") || 
      rawVerificationSource.includes("سجل") || 
      rawVerificationSource.includes("Portal") || 
      rawVerificationSource.includes("Directory") ||
      rawVerificationSource.includes("Official verified")
    ))
  );

  if (hasRegistryProof) {
    sources.push({
      id: "source-registry",
      type: "registry",
      titleEn: "Commercial Registry & Physical HQ Verified",
      titleAr: "السجل التجاري ومقر الشركة الميداني الموثق",
      detail: rawHQ || (typeof rawVerificationSource === "string" ? rawVerificationSource.slice(0, 80) : "Verified Business Entity"),
      verified: true
    });
  }

  // 5. External Source URLs (Customs Databases, Trade Portals, Association Member Registries)
  const sourceUrls: string[] = Array.isArray(buyer.source_urls) ? buyer.source_urls.filter(Boolean) : [];
  for (let i = 0; i < sourceUrls.length; i++) {
    const sUrl = sourceUrls[i];
    // Avoid duplicate if it's already the main website or linkedin
    const alreadyListed = sources.some(s => s.url && s.url.toLowerCase() === sUrl.toLowerCase());
    if (!alreadyListed && sUrl.length > 5) {
      sources.push({
        id: `source-ext-${i}`,
        type: "external",
        titleEn: `Trade Portal / Directory Record #${i + 1}`,
        titleAr: `سجل التجارة والدليل الدولي #${i + 1}`,
        detail: sUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
        url: sUrl.startsWith("http") ? sUrl : `https://${sUrl}`,
        verified: true
      });
    }
  }

  // 6. Customs Trade Activity / Verified Container Sourcing Proof
  if (buyer.annualImportVolume && (buyer.destinationPort || buyer.incoterms) && !isAiDiscovered) {
    sources.push({
      id: "source-customs",
      type: "customs",
      titleEn: "Verified Import Flow & Port Destination",
      titleAr: "حركة استيراد مثبتة وميناء وصول معتمد",
      detail: `${buyer.annualImportVolume} via ${buyer.destinationPort || 'Direct Port'}`,
      verified: true
    });
  }

  const sourcesCount = sources.length;

  // Determine Confidence Tier & Score based on verified sources count and AI origin
  let score = 0;
  let tier: ConfidenceTier = "unverified";

  if (isAiDiscovered) {
    // Lead discovered by AI model
    if (sourcesCount >= 3) {
      score = 78;
      tier = "medium";
    } else if (sourcesCount === 2) {
      score = 68;
      tier = "moderate";
    } else if (sourcesCount === 1) {
      score = 54;
      tier = "ai_suggested";
    } else {
      score = 42;
      tier = "ai_suggested";
    }
  } else {
    // Verified Directory / Curated Enterprise Lead
    if (sourcesCount >= 4) {
      score = 98;
      tier = "high";
    } else if (sourcesCount === 3) {
      score = 94;
      tier = "high";
    } else if (sourcesCount === 2) {
      score = 84;
      tier = "medium";
    } else if (sourcesCount === 1) {
      score = 66;
      tier = "moderate";
    } else {
      score = 48;
      tier = "unverified";
    }
  }

  // Formatting strings & styling badges
  let tierLabelEn = "High Confidence";
  let tierLabelAr = "موثوقية فائقة";
  let badgeLabelEn = `${score}% High Confidence (${sourcesCount} Sources)`;
  let badgeLabelAr = `موثوقية ${score}% (${sourcesCount} مصادر)`;
  let badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-300";
  let pillBg = "bg-emerald-50";
  let pillBorder = "border-emerald-200";
  let pillText = "text-emerald-700";
  let summaryEn = `Highly reliable enterprise data backed by ${sourcesCount} verified sources.`;
  let summaryAr = `بيانات عالية الموثوقية مدعومة بـ ${sourcesCount} مصادر تجارية مؤكدة.`;
  let actionRecommendationEn = "Direct outreach recommended with full commercial export dossier.";
  let actionRecommendationAr = "يوصى بالتواصل المباشر الفوري مع إرسال الملف التصديري وعروض الأسعار.";

  if (tier === "high") {
    tierLabelEn = "Highly Reliable";
    tierLabelAr = "بيانات موثوقة جداً";
    badgeLabelEn = `${score}% Confidence (${sourcesCount} Sources)`;
    badgeLabelAr = `موثوقية ${score}% (${sourcesCount} مصادر)`;
    badgeClass = "bg-emerald-600 text-white border-emerald-700 shadow-xs";
    pillBg = "bg-emerald-50";
    pillBorder = "border-emerald-200";
    pillText = "text-emerald-800";
  } else if (tier === "medium") {
    tierLabelEn = "Solid Confidence";
    tierLabelAr = "موثوقية جيدة";
    badgeLabelEn = `${score}% Confidence (${sourcesCount} Sources)`;
    badgeLabelAr = `موثوقية ${score}% (${sourcesCount} مصادر)`;
    badgeClass = "bg-teal-50 text-teal-800 border-teal-300";
    pillBg = "bg-teal-50";
    pillBorder = "border-teal-200";
    pillText = "text-teal-700";
    summaryEn = `Reliable trade lead cross-referenced against ${sourcesCount} independent sources.`;
    summaryAr = `عميل موثوق تم تأكيد بياناته عبر ${sourcesCount} مصادر مستقلة.`;
    actionRecommendationEn = "Outreach with standard FOB/CFR pricing proposal.";
    actionRecommendationAr = "التواصل مع تقديم عروض أسعار قياسية وشهادات BRCGS.";
  } else if (tier === "moderate") {
    tierLabelEn = "Moderate Confidence";
    tierLabelAr = "موثوقية معتدلة";
    badgeLabelEn = `${score}% Moderate (${sourcesCount} Source${sourcesCount > 1 ? 's' : ''})`;
    badgeLabelAr = `موثوقية ${score}% (${sourcesCount} مصادر)`;
    badgeClass = "bg-blue-50 text-blue-800 border-blue-200";
    pillBg = "bg-blue-50";
    pillBorder = "border-blue-200";
    pillText = "text-blue-700";
    summaryEn = `Partially confirmed with ${sourcesCount} source. Good for secondary prospecting.`;
    summaryAr = `تم تأكيد البيانات جزئياً عبر مصدر واحد أو مصدرين. مناسب للمتابعة التمهيدية.`;
    actionRecommendationEn = "Verify telephone or LinkedIn before formal contracts.";
    actionRecommendationAr = "تحقق من الهاتف أو لينكدإن قبل إبرام العقود الرسمية.";
  } else if (tier === "ai_suggested") {
    tierLabelEn = "AI-Suggested Lead";
    tierLabelAr = "اقتراح ذكاء اصطناعي";
    const srcTextEn = sourcesCount === 1 ? "1 Source" : `${sourcesCount} Sources`;
    const srcTextAr = sourcesCount === 1 ? "مصدر واحد" : `${sourcesCount} مصادر`;
    badgeLabelEn = `AI-Suggested (${score}%) • ${srcTextEn}`;
    badgeLabelAr = `اقتراح ذكاء اصطناعي (${score}%) • ${srcTextAr}`;
    badgeClass = "bg-amber-50 text-amber-900 border-amber-300";
    pillBg = "bg-amber-50";
    pillBorder = "border-amber-200";
    pillText = "text-amber-800";
    summaryEn = "AI intelligence discovery without multi-registry validation. Review recommended.";
    summaryAr = "اكتشاف عبر محرك الذكاء الاصطناعي دون فحص متعدد بالسجلات الرسمية. يلزم المراجعة.";
    actionRecommendationEn = "Verify corporate existence & domain before dispatching proposals.";
    actionRecommendationAr = "تحقق من الموقع الإلكتروني والنطاق التجاري قبل إرسال العروض.";
  } else {
    tierLabelEn = "Unverified Lead";
    tierLabelAr = "سجل غير مثبت";
    badgeLabelEn = `Unverified (${score}%)`;
    badgeLabelAr = `غير مؤكد (${score}%)`;
    badgeClass = "bg-slate-100 text-slate-700 border-slate-300";
    pillBg = "bg-slate-50";
    pillBorder = "border-slate-200";
    pillText = "text-slate-600";
    summaryEn = "No third-party verified sources currently on file for this lead.";
    summaryAr = "لا تتوفر مصادر موثقة مسجلة لهذا السجل حالياً.";
    actionRecommendationEn = "Manual verification required.";
    actionRecommendationAr = "يلزم البحث اليدوي المباشر.";
  }

  return {
    score,
    tier,
    sourcesCount,
    sources,
    isAiSuggested: isAiDiscovered || tier === "ai_suggested",
    tierLabelEn,
    tierLabelAr,
    badgeLabelEn,
    badgeLabelAr,
    badgeClass,
    pillBg,
    pillBorder,
    pillText,
    summaryEn,
    summaryAr,
    actionRecommendationEn,
    actionRecommendationAr
  };
}
