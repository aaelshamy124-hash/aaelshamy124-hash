import { Country } from "../types";

export interface MonthlyExportPoint {
  month: string;
  monthAr: string;
  volumeMT: number; // Metric Tons exported
  containersFCL: number; // Estimated 40ft reefer containers (approx 22-25 MT each)
  growthFromPrevPct: number;
}

export interface CountryTrendData {
  countryId: string;
  trend: MonthlyExportPoint[];
  growthRatePct: number;
  totalSixMonthVolumeMT: number;
  latestMonthlyVolumeMT: number;
  primaryExportCrop: string;
  primaryExportCropAr: string;
}

export const COUNTRY_EXPORT_TRENDS: Record<string, CountryTrendData> = {
  "c-usa": {
    countryId: "c-usa",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 820, containersFCL: 34, growthFromPrevPct: 4.2 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 890, containersFCL: 37, growthFromPrevPct: 8.5 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 980, containersFCL: 41, growthFromPrevPct: 10.1 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 1090, containersFCL: 45, growthFromPrevPct: 11.2 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 1220, containersFCL: 51, growthFromPrevPct: 11.9 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1350, containersFCL: 56, growthFromPrevPct: 10.7 },
    ],
    growthRatePct: 64.6,
    totalSixMonthVolumeMT: 6350,
    latestMonthlyVolumeMT: 1350,
    primaryExportCrop: "IQF Strawberries & Artichoke Bottoms",
    primaryExportCropAr: "فراولة مجمدة وأرضي شوكي"
  },
  "c-canada": {
    countryId: "c-canada",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 310, containersFCL: 13, growthFromPrevPct: 3.8 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 345, containersFCL: 14, growthFromPrevPct: 11.3 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 390, containersFCL: 16, growthFromPrevPct: 13.0 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 430, containersFCL: 18, growthFromPrevPct: 10.3 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 485, containersFCL: 20, growthFromPrevPct: 12.8 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 540, containersFCL: 22, growthFromPrevPct: 11.3 },
    ],
    growthRatePct: 74.2,
    totalSixMonthVolumeMT: 2500,
    latestMonthlyVolumeMT: 540,
    primaryExportCrop: "IQF Broccoli Florets & Cut Green Beans",
    primaryExportCropAr: "بروكلي وفاصوليا خضراء مجمدة"
  },
  "c-germany": {
    countryId: "c-germany",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 950, containersFCL: 40, growthFromPrevPct: 5.6 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 1040, containersFCL: 43, growthFromPrevPct: 9.5 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 1130, containersFCL: 47, growthFromPrevPct: 8.7 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 1260, containersFCL: 52, growthFromPrevPct: 11.5 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 1410, containersFCL: 59, growthFromPrevPct: 11.9 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1540, containersFCL: 64, growthFromPrevPct: 9.2 },
    ],
    growthRatePct: 62.1,
    totalSixMonthVolumeMT: 7330,
    latestMonthlyVolumeMT: 1540,
    primaryExportCrop: "IQF Strawberries (Senga Sengana & Festival)",
    primaryExportCropAr: "فراولة مجمدة ومحاصيل بروكلي"
  },
  "c-france": {
    countryId: "c-france",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 620, containersFCL: 26, growthFromPrevPct: 4.1 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 670, containersFCL: 28, growthFromPrevPct: 8.1 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 730, containersFCL: 30, growthFromPrevPct: 9.0 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 800, containersFCL: 33, growthFromPrevPct: 9.6 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 875, containersFCL: 36, growthFromPrevPct: 9.4 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 940, containersFCL: 39, growthFromPrevPct: 7.4 },
    ],
    growthRatePct: 51.6,
    totalSixMonthVolumeMT: 4635,
    latestMonthlyVolumeMT: 940,
    primaryExportCrop: "IQF Artichoke Quarters & Okra Extra",
    primaryExportCropAr: "أرضي شوكي وبامية إكسترا مجمدة"
  },
  "c-italy": {
    countryId: "c-italy",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 580, containersFCL: 24, growthFromPrevPct: 5.2 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 630, containersFCL: 26, growthFromPrevPct: 8.6 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 695, containersFCL: 29, growthFromPrevPct: 10.3 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 760, containersFCL: 32, growthFromPrevPct: 9.4 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 840, containersFCL: 35, growthFromPrevPct: 10.5 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 915, containersFCL: 38, growthFromPrevPct: 8.9 },
    ],
    growthRatePct: 57.8,
    totalSixMonthVolumeMT: 4420,
    latestMonthlyVolumeMT: 915,
    primaryExportCrop: "IQF Whole Strawberries & Diced Tomatoes",
    primaryExportCropAr: "فراولة كاملة ومكعبات طماطم مجمدة"
  },
  "c-spain": {
    countryId: "c-spain",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 430, containersFCL: 18, growthFromPrevPct: 4.8 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 470, containersFCL: 20, growthFromPrevPct: 9.3 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 515, containersFCL: 21, growthFromPrevPct: 9.6 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 565, containersFCL: 23, growthFromPrevPct: 9.7 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 625, containersFCL: 26, growthFromPrevPct: 10.6 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 680, containersFCL: 28, growthFromPrevPct: 8.8 },
    ],
    growthRatePct: 58.1,
    totalSixMonthVolumeMT: 3285,
    latestMonthlyVolumeMT: 680,
    primaryExportCrop: "IQF Pomegranate Arils & Orange Segments",
    primaryExportCropAr: "حبات رمان وفصوص برتقال مجمدة"
  },
  "c-poland": {
    countryId: "c-poland",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 710, containersFCL: 30, growthFromPrevPct: 7.2 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 790, containersFCL: 33, growthFromPrevPct: 11.3 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 895, containersFCL: 37, growthFromPrevPct: 13.3 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 1010, containersFCL: 42, growthFromPrevPct: 12.8 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 1160, containersFCL: 48, growthFromPrevPct: 14.8 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1320, containersFCL: 55, growthFromPrevPct: 13.8 },
    ],
    growthRatePct: 85.9,
    totalSixMonthVolumeMT: 5885,
    latestMonthlyVolumeMT: 1320,
    primaryExportCrop: "IQF Strawberries (Offsetting EU shortfalls)",
    primaryExportCropAr: "فراولة مجمدة لسد عجز الإنتاج البولندي"
  },
  "c-uk": {
    countryId: "c-uk",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 760, containersFCL: 32, growthFromPrevPct: 4.5 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 820, containersFCL: 34, growthFromPrevPct: 7.9 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 890, containersFCL: 37, growthFromPrevPct: 8.5 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 970, containersFCL: 40, growthFromPrevPct: 9.0 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 1060, containersFCL: 44, growthFromPrevPct: 9.3 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1150, containersFCL: 48, growthFromPrevPct: 8.5 },
    ],
    growthRatePct: 51.3,
    totalSixMonthVolumeMT: 5650,
    latestMonthlyVolumeMT: 1150,
    primaryExportCrop: "IQF Mixed Vegetables & Sweet Corn",
    primaryExportCropAr: "خضار مشكل وذرة حلوة مجمدة"
  },
  "c-saudi": {
    countryId: "c-saudi",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 1180, containersFCL: 49, growthFromPrevPct: 6.2 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 1270, containersFCL: 53, growthFromPrevPct: 7.6 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 1380, containersFCL: 57, growthFromPrevPct: 8.7 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 1510, containersFCL: 63, growthFromPrevPct: 9.4 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 1650, containersFCL: 69, growthFromPrevPct: 9.3 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1790, containersFCL: 75, growthFromPrevPct: 8.5 },
    ],
    growthRatePct: 51.7,
    totalSixMonthVolumeMT: 8780,
    latestMonthlyVolumeMT: 1790,
    primaryExportCrop: "IQF Okra, Molokhia, Strawberries & Peas",
    primaryExportCropAr: "بامية وملوخية وفراولة وبازلاء خضراء"
  },
  "c-uae": {
    countryId: "c-uae",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 690, containersFCL: 29, growthFromPrevPct: 5.8 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 745, containersFCL: 31, growthFromPrevPct: 8.0 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 810, containersFCL: 34, growthFromPrevPct: 8.7 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 885, containersFCL: 37, growthFromPrevPct: 9.3 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 960, containersFCL: 40, growthFromPrevPct: 8.5 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1030, containersFCL: 43, growthFromPrevPct: 7.3 },
    ],
    growthRatePct: 49.3,
    totalSixMonthVolumeMT: 5120,
    latestMonthlyVolumeMT: 1030,
    primaryExportCrop: "Foodservice Bulk IQF Fruits & Purees",
    primaryExportCropAr: "فواكه مجمدة ومركزات للمطاعم والفنادق"
  },
  "c-japan": {
    countryId: "c-japan",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 270, containersFCL: 11, growthFromPrevPct: 6.2 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 305, containersFCL: 13, growthFromPrevPct: 13.0 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 345, containersFCL: 14, growthFromPrevPct: 13.1 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 390, containersFCL: 16, growthFromPrevPct: 13.0 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 440, containersFCL: 18, growthFromPrevPct: 12.8 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 490, containersFCL: 20, growthFromPrevPct: 11.4 },
    ],
    growthRatePct: 81.5,
    totalSixMonthVolumeMT: 2240,
    latestMonthlyVolumeMT: 490,
    primaryExportCrop: "Zero-Pesticide IQF Strawberries & Spinach",
    primaryExportCropAr: "فراولة وسبانخ مطابقة لمواصفات اليابان الصارمة"
  },
  "c-korea": {
    countryId: "c-korea",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 215, containersFCL: 9, growthFromPrevPct: 5.1 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 245, containersFCL: 10, growthFromPrevPct: 14.0 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 280, containersFCL: 12, growthFromPrevPct: 14.3 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 320, containersFCL: 13, growthFromPrevPct: 14.3 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 365, containersFCL: 15, growthFromPrevPct: 14.1 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 410, containersFCL: 17, growthFromPrevPct: 12.3 },
    ],
    growthRatePct: 90.7,
    totalSixMonthVolumeMT: 1835,
    latestMonthlyVolumeMT: 410,
    primaryExportCrop: "IQF Strawberry Dices for Dairy & Bakery",
    primaryExportCropAr: "قطع فراولة مجمدة لمصانع الألبان والمخبوزات"
  },
  "c-brazil": {
    countryId: "c-brazil",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 350, containersFCL: 15, growthFromPrevPct: 4.8 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 380, containersFCL: 16, growthFromPrevPct: 8.6 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 415, containersFCL: 17, growthFromPrevPct: 9.2 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 455, containersFCL: 19, growthFromPrevPct: 9.6 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 505, containersFCL: 21, growthFromPrevPct: 11.0 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 550, containersFCL: 23, growthFromPrevPct: 8.9 },
    ],
    growthRatePct: 57.1,
    totalSixMonthVolumeMT: 2655,
    latestMonthlyVolumeMT: 550,
    primaryExportCrop: "IQF Artichoke Hearts & Frozen Garlic",
    primaryExportCropAr: "قلوب أرضي شوكي وثوم مجمد"
  },
  "c-netherlands": {
    countryId: "c-netherlands",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 910, containersFCL: 38, growthFromPrevPct: 5.8 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 990, containersFCL: 41, growthFromPrevPct: 8.8 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 1085, containersFCL: 45, growthFromPrevPct: 9.6 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 1205, containersFCL: 50, growthFromPrevPct: 11.1 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 1340, containersFCL: 56, growthFromPrevPct: 11.2 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 1470, containersFCL: 61, growthFromPrevPct: 9.7 },
    ],
    growthRatePct: 61.5,
    totalSixMonthVolumeMT: 7000,
    latestMonthlyVolumeMT: 1470,
    primaryExportCrop: "Bulk IQF Strawberries for Re-export via Rotterdam",
    primaryExportCropAr: "فراولة مجمدة صب لإعادة التصدير عبر روتردام"
  },
  "c-belgium": {
    countryId: "c-belgium",
    trend: [
      { month: "May", monthAr: "مايو", volumeMT: 510, containersFCL: 21, growthFromPrevPct: 4.9 },
      { month: "Jun", monthAr: "يونيو", volumeMT: 555, containersFCL: 23, growthFromPrevPct: 8.8 },
      { month: "Jul", monthAr: "يوليو", volumeMT: 605, containersFCL: 25, growthFromPrevPct: 9.0 },
      { month: "Aug", monthAr: "أغسطس", volumeMT: 670, containersFCL: 28, growthFromPrevPct: 10.7 },
      { month: "Sep", monthAr: "سبتمبر", volumeMT: 745, containersFCL: 31, growthFromPrevPct: 11.2 },
      { month: "Oct", monthAr: "أكتوبر", volumeMT: 820, containersFCL: 34, growthFromPrevPct: 10.1 },
    ],
    growthRatePct: 60.8,
    totalSixMonthVolumeMT: 3905,
    latestMonthlyVolumeMT: 820,
    primaryExportCrop: "IQF Frozen Peas, Diced Carrots & Sweet Corn",
    primaryExportCropAr: "بازلاء وجزر مكعبات وذرة سكرية مجمدة"
  }
};

/**
 * Returns authentic or deterministic 6-month export trend for any country
 */
export function getCountryExportTrend(country: Country): CountryTrendData {
  if (COUNTRY_EXPORT_TRENDS[country.id]) {
    return COUNTRY_EXPORT_TRENDS[country.id];
  }

  // Fallback for custom or newly added countries
  const baseFactor = country.marketVibe === "Excellent" ? 1.5 : country.marketVibe === "Good" ? 1.2 : 1.0;
  const hash = country.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseVolume = 300 + (hash % 400);

  const months = [
    { month: "May", monthAr: "مايو", growth: 1.0 },
    { month: "Jun", monthAr: "يونيو", growth: 1.08 },
    { month: "Jul", monthAr: "يوليو", growth: 1.18 },
    { month: "Aug", monthAr: "أغسطس", growth: 1.29 },
    { month: "Sep", monthAr: "سبتمبر", growth: 1.42 },
    { month: "Oct", monthAr: "أكتوبر", growth: 1.55 * baseFactor },
  ];

  const trend: MonthlyExportPoint[] = months.map((m, idx) => {
    const vol = Math.round(baseVolume * m.growth);
    const prevVol = idx === 0 ? Math.round(baseVolume * 0.95) : Math.round(baseVolume * months[idx - 1].growth);
    const growthFromPrev = Math.round(((vol - prevVol) / prevVol) * 1000) / 10;
    return {
      month: m.month,
      monthAr: m.monthAr,
      volumeMT: vol,
      containersFCL: Math.round(vol / 24),
      growthFromPrevPct: growthFromPrev
    };
  });

  const first = trend[0].volumeMT;
  const last = trend[trend.length - 1].volumeMT;
  const growthRatePct = Math.round(((last - first) / first) * 1000) / 10;

  return {
    countryId: country.id,
    trend,
    growthRatePct,
    totalSixMonthVolumeMT: trend.reduce((s, p) => s + p.volumeMT, 0),
    latestMonthlyVolumeMT: last,
    primaryExportCrop: "IQF Fruits & Vegetables",
    primaryExportCropAr: "خضراوات وفواكه مجمدة"
  };
}
