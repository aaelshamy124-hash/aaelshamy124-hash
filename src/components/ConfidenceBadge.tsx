import React, { useState } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  ExternalLink, 
  Sparkles, 
  Globe, 
  Mail, 
  Linkedin, 
  Building2, 
  Ship, 
  Info,
  ChevronDown
} from "lucide-react";
import { calculateBuyerConfidence, BuyerConfidenceResult, VerifiedSourceDetail } from "../utils/confidenceScore";

interface ConfidenceBadgeProps {
  buyer: any;
  lang?: "ar" | "en";
  variant?: "badge" | "compact" | "pill" | "dossier";
  className?: string;
  onViewSources?: () => void;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  buyer,
  lang = "ar",
  variant = "badge",
  className = "",
  onViewSources
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isAr = lang === "ar";
  const confidence: BuyerConfidenceResult = calculateBuyerConfidence(buyer);

  const getSourceIcon = (type: VerifiedSourceDetail["type"]) => {
    switch (type) {
      case "website":
        return <Globe size={12} className="text-teal-600 shrink-0" />;
      case "email_mx":
        return <Mail size={12} className="text-emerald-600 shrink-0" />;
      case "linkedin":
        return <Linkedin size={12} className="text-blue-600 shrink-0" />;
      case "registry":
        return <Building2 size={12} className="text-indigo-600 shrink-0" />;
      case "customs":
        return <Ship size={12} className="text-amber-600 shrink-0" />;
      default:
        return <CheckCircle2 size={12} className="text-teal-600 shrink-0" />;
    }
  };

  // 1. Detailed Dossier Variant (Used inside Buyer Dossier Modal)
  if (variant === "dossier") {
    return (
      <div className={`rounded-xl border p-4 space-y-3 transition-all ${
        confidence.tier === "high" 
          ? "bg-emerald-50/50 border-emerald-200" 
          : confidence.tier === "medium"
          ? "bg-teal-50/50 border-teal-200"
          : confidence.tier === "ai_suggested"
          ? "bg-amber-50/60 border-amber-300"
          : "bg-slate-50 border-slate-200"
      } ${className}`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              confidence.tier === "high"
                ? "bg-emerald-600 text-white shadow-xs"
                : confidence.tier === "medium"
                ? "bg-teal-600 text-white"
                : confidence.tier === "ai_suggested"
                ? "bg-amber-500 text-white"
                : "bg-slate-400 text-white"
            }`}>
              {confidence.tier === "high" ? (
                <ShieldCheck size={18} />
              ) : confidence.tier === "ai_suggested" ? (
                <Sparkles size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-800">
                  {isAr ? "درجة الموثوقية (Confidence Score)" : "Confidence Score"}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  confidence.tier === "high"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : confidence.tier === "medium"
                    ? "bg-teal-100 text-teal-800 border-teal-300"
                    : confidence.tier === "ai_suggested"
                    ? "bg-amber-100 text-amber-900 border-amber-300 font-extrabold"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}>
                  {isAr ? confidence.tierLabelAr : confidence.tierLabelEn}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isAr ? confidence.summaryAr : confidence.summaryEn}
              </p>
            </div>
          </div>

          {/* Large Score Metric */}
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black font-display ${
                confidence.tier === "high"
                  ? "text-emerald-700"
                  : confidence.tier === "medium"
                  ? "text-teal-700"
                  : confidence.tier === "ai_suggested"
                  ? "text-amber-800"
                  : "text-slate-700"
              }`}>
                {confidence.score}%
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {isAr ? `(من ${confidence.sourcesCount} مصادر)` : `(${confidence.sourcesCount} sources)`}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                confidence.tier === "high"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : confidence.tier === "medium"
                  ? "bg-gradient-to-r from-teal-500 to-cyan-500"
                  : confidence.tier === "ai_suggested"
                  ? "bg-gradient-to-r from-amber-400 to-orange-500"
                  : "bg-slate-400"
              }`}
              style={{ width: `${confidence.score}%` }}
            />
          </div>
        </div>

        {/* Verified Sources Breakdown List */}
        <div className="pt-2 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>{isAr ? "المصادر المثبتة التي تم فحصها:" : "Verified Evidence Sources Found:"}</span>
              <span className="bg-slate-200/70 text-slate-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                {confidence.sourcesCount}
              </span>
            </span>
          </div>

          {confidence.sources.length === 0 ? (
            <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <ShieldAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {isAr 
                    ? "هذا العميل مقترح بواسطة خوارزمية الذكاء الاصطناعي دون فحص مسبق في السجلات الخارجية." 
                    : "This lead was discovered dynamically by AI intelligence without prior cross-registry verification."}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {isAr ? confidence.actionRecommendationAr : confidence.actionRecommendationEn}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {confidence.sources.map((src) => (
                <div 
                  key={src.id}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/80 hover:border-slate-300 transition shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getSourceIcon(src.type)}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate text-[11px]">
                        {isAr ? src.titleAr : src.titleEn}
                      </p>
                      {src.detail && (
                        <p className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">
                          {src.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-800 p-1 hover:bg-teal-50 rounded transition shrink-0"
                      title={src.url}
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded shrink-0">
                      ✔ {isAr ? "مثبت" : "Verified"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Guidance Banner */}
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5 bg-white/70 p-2 rounded-md border border-slate-100">
            <Info size={12} className="text-slate-400 shrink-0" />
            <span>
              {isAr ? confidence.actionRecommendationAr : confidence.actionRecommendationEn}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Compact Pill Variant (For tables and tight headers)
  if (variant === "compact" || variant === "pill") {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <button
          type="button"
          onClick={() => {
            setShowTooltip(!showTooltip);
            if (onViewSources) onViewSources();
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer select-none ${
            confidence.tier === "high"
              ? "bg-emerald-100/90 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
              : confidence.tier === "medium"
              ? "bg-teal-100/80 text-teal-900 border-teal-300 hover:bg-teal-200"
              : confidence.tier === "moderate"
              ? "bg-blue-100/80 text-blue-900 border-blue-200 hover:bg-blue-200"
              : confidence.tier === "ai_suggested"
              ? "bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200"
              : "bg-slate-100 text-slate-700 border-slate-300"
          }`}
          title={isAr ? confidence.summaryAr : confidence.summaryEn}
        >
          {confidence.tier === "high" ? (
            <ShieldCheck size={11} className="text-emerald-700 shrink-0" />
          ) : confidence.tier === "ai_suggested" ? (
            <Sparkles size={11} className="text-amber-700 shrink-0" />
          ) : (
            <CheckCircle2 size={11} className="text-teal-700 shrink-0" />
          )}

          <span className="font-mono">{confidence.score}%</span>
          <span className="opacity-60">•</span>
          <span>
            {isAr 
              ? (confidence.tier === "ai_suggested" 
                  ? (confidence.sourcesCount === 1 ? "مصدر واحد" : `${confidence.sourcesCount} مصادر`)
                  : `${confidence.sourcesCount} مصادر`)
              : `${confidence.sourcesCount} ${confidence.sourcesCount === 1 ? 'src' : 'sources'}`
            }
          </span>
        </button>

        {/* Hover / Click Tooltip Flyout */}
        {showTooltip && (
          <div 
            className={`absolute z-50 bottom-full mb-1.5 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-xl text-left border border-slate-700 pointer-events-none transition-all ${
              isAr ? "right-0 text-right" : "left-0 text-left"
            }`}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                {isAr ? "مستوى التحقق والمصادر" : "Confidence & Sources"}
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                confidence.tier === "high"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : confidence.tier === "ai_suggested"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-teal-500/20 text-teal-300 border border-teal-500/30"
              }`}>
                {confidence.score}% {isAr ? confidence.tierLabelAr : confidence.tierLabelEn}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
              {isAr ? confidence.summaryAr : confidence.summaryEn}
            </p>

            <div className="mt-2 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {isAr ? `المصادر المكتشفة (${confidence.sourcesCount}):` : `Verified Sources (${confidence.sourcesCount}):`}
              </p>
              {confidence.sources.length === 0 ? (
                <p className="text-[10px] text-amber-300 italic">
                  {isAr ? "لا توجد مصادر خارجية موثقة (اقتراح ذكاء اصطناعي)" : "No external registry verified yet (AI Suggested)"}
                </p>
              ) : (
                confidence.sources.slice(0, 3).map(s => (
                  <div key={s.id} className="text-[10px] text-slate-300 flex items-center gap-1.5">
                    <span className="text-emerald-400">✔</span>
                    <span className="truncate">{isAr ? s.titleAr : s.titleEn}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Default Badge Variant (Prominent, clean, displays tier + count)
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div 
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => {
          setShowTooltip(!showTooltip);
          if (onViewSources) onViewSources();
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition shadow-2xs cursor-pointer select-none ${
          confidence.tier === "high"
            ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400"
            : confidence.tier === "medium"
            ? "bg-teal-50 text-teal-900 border-teal-300 hover:bg-teal-100"
            : confidence.tier === "moderate"
            ? "bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100"
            : confidence.tier === "ai_suggested"
            ? "bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100"
            : "bg-slate-100 text-slate-700 border-slate-300"
        }`}
      >
        {confidence.tier === "high" ? (
          <ShieldCheck size={13} className="text-emerald-700 shrink-0" />
        ) : confidence.tier === "ai_suggested" ? (
          <Sparkles size={13} className="text-amber-700 shrink-0" />
        ) : (
          <CheckCircle2 size={13} className="text-teal-700 shrink-0" />
        )}

        <div className="flex items-center gap-1 text-[11px]">
          <span className="font-extrabold font-display">
            {confidence.score}%
          </span>
          <span className="opacity-50">|</span>
          <span className="text-[10px] font-semibold">
            {isAr ? confidence.tierLabelAr : confidence.tierLabelEn}
          </span>
          <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
            confidence.tier === "high"
              ? "bg-emerald-200/60 text-emerald-900"
              : confidence.tier === "ai_suggested"
              ? "bg-amber-200/60 text-amber-950"
              : "bg-slate-200/60 text-slate-800"
          }`}>
            {confidence.sourcesCount} {isAr ? "مصادر" : "src"}
          </span>
        </div>
      </div>

      {/* Flyout details on hover */}
      {showTooltip && (
        <div 
          className={`absolute z-50 bottom-full mb-1.5 w-72 p-3 bg-slate-900 text-white rounded-xl shadow-2xl text-left border border-slate-700 transition-all ${
            isAr ? "right-0 text-right" : "left-0 text-left"
          }`}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              {isAr ? "مستوى الثقة والمصادر المثبتة" : "Confidence Score Audit"}
            </span>
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
              confidence.tier === "high"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : confidence.tier === "ai_suggested"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-teal-500/20 text-teal-300 border border-teal-500/30"
            }`}>
              {confidence.score}%
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
            {isAr ? confidence.summaryAr : confidence.summaryEn}
          </p>

          <div className="mt-2 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {isAr ? `المصادر التي تم فحصها (${confidence.sourcesCount}):` : `Verified Sources Found (${confidence.sourcesCount}):`}
            </p>
            {confidence.sources.length === 0 ? (
              <p className="text-[10px] text-amber-300 italic">
                {isAr ? "اقتراح ذكاء اصطناعي – يلزم الفحص في السجلات الرسمية" : "AI-suggested lead – needs cross-verification before outreach"}
              </p>
            ) : (
              confidence.sources.map(s => (
                <div key={s.id} className="text-[10px] text-slate-200 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-emerald-400">✔</span>
                    <span className="truncate">{isAr ? s.titleAr : s.titleEn}</span>
                  </div>
                  {s.url && (
                    <a 
                      href={s.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-teal-400 hover:underline shrink-0 text-[9px]"
                      onClick={e => e.stopPropagation()}
                    >
                      {isAr ? "عرض" : "Link"}
                    </a>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
            {isAr ? confidence.actionRecommendationAr : confidence.actionRecommendationEn}
          </div>
        </div>
      )}
    </div>
  );
};
