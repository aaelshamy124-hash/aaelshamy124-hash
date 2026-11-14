import React, { useState } from "react";
import { 
  Globe, Search, Award, Anchor, CheckCircle2, ChevronRight, ChevronDown, ChevronUp,
  Users, Sparkles, Building2, Mail, Phone, ExternalLink, ShieldCheck, Zap,
  TrendingUp, ArrowUpRight, BarChart2
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { Country, ProspectBuyer } from "../types";
import { VERIFIED_GLOBAL_BUYERS } from "../data/verifiedBuyers";
import { useLanguage } from "../context/LanguageContext";
import { getCountryExportTrend, MonthlyExportPoint } from "../data/countryTrends";

interface CountriesProps {
  countries: Country[];
  onSelectCountryForSearch?: (country: Country) => void;
  onAddProspectToCRM?: (prospect: ProspectBuyer) => void;
}

interface SparklineTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  lang: string;
}

function SparklineTooltip({ active, payload, lang }: SparklineTooltipProps) {
  if (active && payload && payload.length) {
    const data: MonthlyExportPoint = payload[0].payload;
    return (
      <div className="bg-slate-900/95 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700/80 pointer-events-none backdrop-blur-xs z-50">
        <div className="font-semibold text-teal-300 flex items-center justify-between gap-3">
          <span>{lang === "ar" ? data.monthAr : data.month} 2026</span>
          <span className="text-emerald-400 font-mono font-bold">+{data.growthFromPrevPct}%</span>
        </div>
        <div className="text-slate-200 mt-0.5 font-mono">
          <span className="font-bold text-white">{data.volumeMT.toLocaleString()}</span> {lang === "ar" ? "طن متري" : "MT"}
          <span className="text-slate-400 text-[9px] ms-1">({data.containersFCL} {lang === "ar" ? "حاوية" : "FCL"})</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function Countries({ countries, onSelectCountryForSearch, onAddProspectToCRM }: CountriesProps) {
  const { lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVibe, setFilterVibe] = useState<"All" | "Excellent" | "Good" | "Competitive">("All");
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(null);
  const [selectedBuyerModal, setSelectedBuyerModal] = useState<ProspectBuyer | null>(null);

  const filtered = countries.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.currency.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterVibe === "All" ? true : c.marketVibe === filterVibe;
    return matchesSearch && matchesFilter;
  });

  // Calculate statistics across all countries
  const totalVerifiedBuyers = VERIFIED_GLOBAL_BUYERS.length;
  const totalNewBuyers = VERIFIED_GLOBAL_BUYERS.filter(b => b.isNew || b.status === "New Lead").length;

  return (
    <div className="space-y-6" id="countries-tab">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-display text-slate-900">
              {lang === "ar" ? "الأسواق والوجهات التصديرية العالمية" : "Target Global Markets"}
            </h1>
            <span className="bg-teal-50 border border-teal-200 text-teal-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {countries.length} {lang === "ar" ? "دولة مستهدفة" : "Markets"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === "ar" 
              ? "استعراض كافة الدول المستوردة وعملاء كل بلد المعتمدين، مع تمييز احترافي وفوري للعملاء الجدد المستكشفين حديثاً." 
              : "Explore all target import markets and their verified buyers, with prominent professional badges for newly discovered leads."}
          </p>
        </div>

        {/* Global Summary Stats */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs shadow-xs border border-slate-800">
          <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3">
            <Users size={14} className="text-teal-400" />
            <span className="text-slate-300">{lang === "ar" ? "إجمالي العملاء:" : "Total Buyers:"}</span>
            <strong className="text-teal-300 font-mono text-sm">{totalVerifiedBuyers}</strong>
          </div>
          <div className="flex items-center gap-1.5 pl-1.5">
            <Sparkles size={14} className="text-emerald-400 animate-pulse" />
            <span className="text-slate-300">{lang === "ar" ? "العملاء الجدد:" : "Fresh Leads:"}</span>
            <strong className="text-emerald-300 font-mono text-sm">+{totalNewBuyers}</strong>
          </div>
        </div>
      </div>

      {/* Filtering Options */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs flex-1">
          <Search className="text-slate-400 shrink-0" size={15} />
          <input 
            type="text" 
            placeholder={lang === "ar" ? "بحث باسم الدولة، العملة، أو اللغة..." : "Search country, currency, or language..."}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs bg-transparent border-none outline-none w-full text-slate-800"
          />
        </div>
        
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["All", "Excellent", "Good", "Competitive"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterVibe(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                filterVibe === tab 
                  ? "bg-white text-teal-800 shadow-xs" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "All" && (lang === "ar" ? "كافة الأسواق" : "All Markets")}
              {tab === "Excellent" && (lang === "ar" ? "أسواق ممتازة" : "Excellent")}
              {tab === "Good" && (lang === "ar" ? "أسواق جيدة" : "Good")}
              {tab === "Competitive" && (lang === "ar" ? "تنافسية عالية" : "Competitive")}
            </button>
          ))}
        </div>
      </div>

      {/* Countries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(c => {
          // Fetch verified buyers for this country
          const countryBuyers = VERIFIED_GLOBAL_BUYERS.filter(
            b => b.country.toLowerCase() === c.name.toLowerCase()
          );
          const newBuyersCount = countryBuyers.filter(b => b.isNew || b.status === "New Lead").length;
          const isExpanded = expandedCountryId === c.id;
          const trendData = getCountryExportTrend(c);

          return (
            <div 
              key={c.id} 
              className={`bg-white rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs ${
                isExpanded ? "border-teal-500 ring-2 ring-teal-500/20 md:col-span-3" : "border-slate-200/90 hover:border-teal-300"
              }`}
            >
              {/* Country Header */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl shrink-0">{c.flag}</span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base font-display flex items-center gap-2">
                        <span>{c.name}</span>
                        {/* New Buyers Indicator for this Country */}
                        {newBuyersCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                            <Sparkles size={10} className="text-amber-200" />
                            <span>+{newBuyersCount} {lang === "ar" ? "جديد" : "NEW"}</span>
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">ISO: {c.code}</p>
                    </div>
                  </div>
                  
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    c.marketVibe === "Excellent" ? "bg-teal-50 text-teal-700 border border-teal-100" :
                    c.marketVibe === "Good" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                    "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}>
                    {c.marketVibe} {lang === "ar" ? "سوق" : "Market"}
                  </span>
                </div>

                {/* Economic parameters */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100/70">
                  <div className="text-center border-r border-slate-200/60">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">{lang === "ar" ? "السكان" : "Pop"}</p>
                    <p className="font-bold text-slate-700 mt-0.5">{c.population}</p>
                  </div>
                  <div className="text-center border-r border-slate-200/60">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">{lang === "ar" ? "واردات أغذية" : "Food Imp."}</p>
                    <p className="font-bold text-slate-700 mt-0.5">{c.foodImportValue}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">{lang === "ar" ? "التعرفة" : "Tariff"}</p>
                    <p className="font-bold text-slate-700 mt-0.5">{c.tariffRate}</p>
                  </div>
                </div>

                {/* Core Port Infrastructure */}
                <div className="mt-3.5 space-y-2 text-xs">
                  <div className="flex items-start gap-1.5 text-slate-600">
                    <Anchor size={13} className="text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">{lang === "ar" ? "الموانئ الرئيسية" : "Primary Sea Ports"}</p>
                      <p className="text-[11px] font-medium text-slate-700">{c.ports.join(", ")}</p>
                    </div>
                  </div>
                </div>

                {/* Mini-Trend Indicator (Sparkline): 6-Month Export Activity Growth */}
                <div className="mt-3.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <TrendingUp size={13} className="text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-800">
                        {lang === "ar" ? "نشاط الصادرات (آخر 6 أشهر)" : "6-Mo Export Activity"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded shadow-2xs font-mono">
                        <ArrowUpRight size={10} className="text-emerald-600" />
                        +{trendData.growthRatePct}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium font-mono">
                        {trendData.latestMonthlyVolumeMT.toLocaleString()} {lang === "ar" ? "طن/شهر" : "MT/mo"}
                      </span>
                    </div>
                  </div>

                  {/* Recharts Area Sparkline */}
                  <div className="h-11 w-full relative bg-slate-50/80 hover:bg-slate-50 rounded-lg border border-slate-100 p-0.5 transition-colors">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData.trend} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
                        <defs>
                          <linearGradient id={`sparkline-grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0d9488" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <Tooltip 
                          content={<SparklineTooltip lang={lang} />} 
                          cursor={{ stroke: '#0d9488', strokeWidth: 1, strokeDasharray: '2 2' }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="volumeMT" 
                          stroke="#0d9488" 
                          strokeWidth={2} 
                          fill={`url(#sparkline-grad-${c.id})`}
                          isAnimationActive={false}
                          activeDot={{ r: 3.5, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 1.5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Period & Volume progression legend */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 font-mono px-0.5">
                    <span>
                      {lang === "ar" ? trendData.trend[0].monthAr : trendData.trend[0].month}: {trendData.trend[0].volumeMT} MT
                    </span>
                    <span className="text-slate-300">··········</span>
                    <span className="text-slate-600 font-bold">
                      {lang === "ar" ? trendData.trend[5].monthAr : trendData.trend[5].month}: {trendData.trend[5].volumeMT} MT
                    </span>
                  </div>
                </div>

                {/* Buyers Quick Preview Strip */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">
                      {countryBuyers.length} {lang === "ar" ? "عميل ومستورد معتمد" : "Verified Importers"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedCountryId(isExpanded ? null : c.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100/80 px-2.5 py-1 rounded-lg border border-teal-200/80 transition cursor-pointer"
                  >
                    <span>{isExpanded ? (lang === "ar" ? "إخفاء العملاء" : "Hide Buyers") : (lang === "ar" ? "عرض جميع العملاء" : "View All Buyers")}</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Quality Certifications Required */}
              <div className="p-4 bg-slate-50/50 flex flex-col justify-between border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                    <Award size={11} className="text-teal-600" />
                    <span>{lang === "ar" ? "الشهادات الإلزامية المطلوبة" : "Mandatory Import Certificates"}</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {c.certificates.map(cert => (
                      <span 
                        key={cert}
                        className="bg-white text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-1"
                      >
                        <span className="w-1 h-1 rounded-full bg-teal-500"></span>
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Customs details summary */}
                <div className="mt-3 pt-3 border-t border-slate-200/40 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{lang === "ar" ? "العملة:" : "Currency:"} <strong className="text-slate-700">{c.currency}</strong></span>
                  <span>{lang === "ar" ? "اللغة:" : "Language:"} <strong className="text-slate-700">{c.language}</strong></span>
                </div>
              </div>

              {/* EXPANDED FULL BUYERS DIRECTORY FOR THIS COUNTRY */}
              {isExpanded && (
                <div className="p-5 bg-gradient-to-b from-slate-50 to-white border-t border-teal-200 space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{c.flag}</span>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          <span>{lang === "ar" ? `قائمة عملاء ومستوردي ${c.name} المعتمدين` : `Verified Buyers Directory: ${c.name}`}</span>
                          <span className="bg-teal-100 text-teal-800 text-[11px] font-mono px-2 py-0.5 rounded-full">
                            {countryBuyers.length} {lang === "ar" ? "شركة" : "entities"}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {lang === "ar" 
                            ? "جميع بيانات الاتصال، سلاسل الإمداد، المسؤول المباشر، وشروط الشحن موثقة بسجل رسمي." 
                            : "Direct commercial procurement contacts, cold storage specs, and verified procurement leads."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onSelectCountryForSearch && (
                        <button
                          type="button"
                          onClick={() => onSelectCountryForSearch(c)}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                        >
                          <Zap size={13} />
                          <span>{lang === "ar" ? `فتح تحليل سوق ${c.name}` : `Analyze Market`}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 6-Month Export Growth Performance Banner */}
                  <div className="bg-white rounded-xl border border-teal-200/90 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-teal-50 rounded-xl text-teal-700 shrink-0 border border-teal-100">
                        <BarChart2 size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">
                            {lang === "ar" ? `مؤشرات نمو الصادرات إلى ${c.name}:` : `Export Activity & Demand Momentum: ${c.name}`}
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] border border-emerald-200 font-mono">
                            <TrendingUp size={12} className="text-emerald-600" />
                            +{trendData.growthRatePct}% {lang === "ar" ? "نمو تراكمي (6 أشهر)" : "6-Month Growth"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {lang === "ar" ? "أبرز المحاصيل الزراعية المصدرة:" : "Primary Sourced Produce:"} <strong className="text-slate-800 font-semibold">{lang === "ar" ? trendData.primaryExportCropAr : trendData.primaryExportCrop}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-100 shrink-0">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">{lang === "ar" ? "إجمالي 6 أشهر" : "6-Mo Cumulative"}</span>
                        <span className="font-bold text-slate-800">{trendData.totalSixMonthVolumeMT.toLocaleString()} MT</span>
                      </div>
                      <div className="border-s border-slate-200/80 ps-4">
                        <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">{lang === "ar" ? "معدل الشهر الحالي" : "Latest Month (Oct)"}</span>
                        <span className="font-bold text-teal-700">{trendData.latestMonthlyVolumeMT.toLocaleString()} MT/mo</span>
                      </div>
                    </div>
                  </div>

                  {/* Buyers Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {countryBuyers.map((buyer, bIdx) => {
                      const isNew = buyer.isNew || buyer.status === "New Lead";

                      return (
                        <div 
                          key={`${buyer.id || 'country-buyer'}-${bIdx}`}
                          className={`rounded-xl border p-4 flex flex-col justify-between transition-all duration-200 relative bg-white ${
                            isNew 
                              ? "border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm" 
                              : "border-slate-200 hover:border-teal-300 shadow-xs"
                          }`}
                        >
                          {/* Top Badges: Brand New Tag */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {isNew ? (
                                <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs mb-1.5 animate-pulse">
                                  <Sparkles size={11} className="text-amber-300" />
                                  <span>{lang === "ar" ? "✨ عميل جديد مستكشف" : "✨ NEW VERIFIED LEAD"}</span>
                                  {buyer.discoveryDate && (
                                    <span className="opacity-80 font-mono text-[9px]">({buyer.discoveryDate})</span>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5 border border-slate-200/80">
                                  <ShieldCheck size={11} className="text-teal-600" />
                                  <span>{lang === "ar" ? "عميل معتمد مسجل" : "Verified Client"}</span>
                                </div>
                              )}

                              <h5 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                                {buyer.name}
                              </h5>
                              <p className="text-[10px] text-teal-700 font-semibold mt-0.5">
                                {buyer.sourcingChannel || buyer.importerType} • {buyer.city}
                              </p>
                            </div>

                            <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 shrink-0">
                              {buyer.aiScore}%
                            </span>
                          </div>

                          {/* Contact & Procurement Lead */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs space-y-1.5">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                {lang === "ar" ? "مدير المشتريات المعتمد:" : "Purchasing Lead:"}
                              </span>
                              <p className="font-bold text-slate-800 text-[11px] truncate">
                                {buyer.purchasingManager || "Director of Global Procurement"}
                              </p>
                              {buyer.procurementRole && (
                                <p className="text-[10px] text-slate-500 truncate">
                                  {buyer.procurementRole}
                                </p>
                              )}
                            </div>

                            {/* Direct Communication Channels */}
                            <div className="flex flex-col gap-1 pt-1 text-[11px]">
                              {buyer.procurementEmail && (
                                <a 
                                  href={`mailto:${buyer.procurementEmail}`}
                                  className="flex items-center gap-1.5 text-teal-700 hover:text-teal-900 font-mono font-semibold truncate hover:underline"
                                >
                                  <Mail size={11} className="text-teal-600 shrink-0" />
                                  <span className="truncate">{buyer.procurementEmail}</span>
                                </a>
                              )}

                              {buyer.phone && (
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="flex items-center gap-1.5 font-mono text-[10px]">
                                    <Phone size={11} className="text-slate-400 shrink-0" />
                                    <span>{buyer.phone}</span>
                                  </span>
                                  <a
                                    href={`https://wa.me/${buyer.phone.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold"
                                    title="WhatsApp"
                                  >
                                    💬
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Required Crops */}
                            {buyer.requiredCrops && buyer.requiredCrops.length > 0 && (
                              <div className="pt-1.5">
                                <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">
                                  {lang === "ar" ? "المحاصيل المطلوبة:" : "Target Crops:"}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {buyer.requiredCrops.slice(0, 3).map((crop, cidx) => (
                                    <span key={cidx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium">
                                      {crop}
                                    </span>
                                  ))}
                                  {buyer.requiredCrops.length > 3 && (
                                    <span className="text-[9px] text-slate-400">+{buyer.requiredCrops.length - 3}</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Logistics & Ports */}
                            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                              <span>🚢 {buyer.incoterms || `CFR Port`}</span>
                              <span>📦 {buyer.annualImportVolume?.split('/')[0] || "60-120 Reefers"}</span>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                            {buyer.website && (
                              <a
                                href={buyer.website.startsWith("http") ? buyer.website : `https://${buyer.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 hover:text-teal-900 hover:underline"
                              >
                                <Globe size={11} className="text-teal-600" />
                                <span className="truncate max-w-[110px] font-mono">{buyer.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                <ExternalLink size={9} className="opacity-70" />
                              </a>
                            )}

                            <div className="flex items-center gap-1.5">
                              {onAddProspectToCRM && (
                                <button
                                  type="button"
                                  onClick={() => onAddProspectToCRM(buyer)}
                                  className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-1 rounded transition cursor-pointer"
                                >
                                  {lang === "ar" ? "+ الـ CRM" : "+ CRM"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedBuyerModal(buyer)}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer"
                              >
                                {lang === "ar" ? "الملف الكامل" : "Dossier"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DOSSIER FOR SELECTED BUYER */}
      {selectedBuyerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(selectedBuyerModal.isNew || selectedBuyerModal.status === "New Lead") ? (
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                      <Sparkles size={11} className="text-amber-200" />
                      <span>{lang === "ar" ? "✨ عميل جديد مستكشف حديثاً" : "✨ FRESH NEW LEAD"}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                      <ShieldCheck size={12} className="text-teal-600" />
                      <span>{lang === "ar" ? "عميل معتمد وموثق" : "Verified Client"}</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-bold">
                    📍 {selectedBuyerModal.city}, {selectedBuyerModal.country}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedBuyerModal.name}</h3>
                <p className="text-xs text-teal-700 font-semibold">{selectedBuyerModal.sourcingChannel || selectedBuyerModal.importerType}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBuyerModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Dossier Content */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === "ar" ? "مدير المشتريات المباشر" : "Purchasing Lead"}</span>
                <p className="font-bold text-slate-800">{selectedBuyerModal.purchasingManager}</p>
                <p className="text-slate-600 text-[11px]">{selectedBuyerModal.procurementRole}</p>
                <p className="font-mono text-teal-700 font-semibold pt-1">{selectedBuyerModal.procurementEmail}</p>
                <p className="font-mono text-slate-700">{selectedBuyerModal.phone}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === "ar" ? "اللوجستيات والشحن المبرد" : "Logistics & Incoterms"}</span>
                <p className="text-slate-700"><strong>Incoterms:</strong> {selectedBuyerModal.incoterms}</p>
                <p className="text-slate-700"><strong>Payment:</strong> {selectedBuyerModal.paymentTerms}</p>
                <p className="text-slate-700"><strong>Port:</strong> {selectedBuyerModal.destinationPort}</p>
                <p className="text-slate-700"><strong>Volume:</strong> {selectedBuyerModal.annualImportVolume}</p>
              </div>
            </div>

            {/* Crops & Certs */}
            <div className="space-y-2 text-xs">
              <div>
                <strong className="text-slate-700 block mb-1">{lang === "ar" ? "المحاصيل المطلوبة:" : "Required Crops:"}</strong>
                <div className="flex flex-wrap gap-1">
                  {selectedBuyerModal.requiredCrops?.map((c, i) => (
                    <span key={i} className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded text-[11px] font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <strong className="text-slate-700 block mb-1">{lang === "ar" ? "الشهادات الإلزامية:" : "Mandatory Certifications:"}</strong>
                <div className="flex flex-wrap gap-1">
                  {selectedBuyerModal.certificationsRequired?.map((c, i) => (
                    <span key={i} className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Commercial Opportunity */}
            {selectedBuyerModal.competitiveOpportunity && (
              <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100 text-xs">
                <strong className="text-teal-900 block mb-1">{lang === "ar" ? "الفرصة التنافسية لشركة جالينا:" : "Export Opportunity Rationale:"}</strong>
                <p className="text-slate-700 italic leading-relaxed">"{selectedBuyerModal.competitiveOpportunity}"</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {onAddProspectToCRM && (
                <button
                  type="button"
                  onClick={() => {
                    onAddProspectToCRM(selectedBuyerModal);
                    setSelectedBuyerModal(null);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  {lang === "ar" ? "استيراد للـ CRM وبدء التواصل" : "Add to CRM"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedBuyerModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
              >
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
