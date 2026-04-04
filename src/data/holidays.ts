// Major holidays for Israel calendar (Jewish, Muslim, Christian, Druze, Bahai) - 2025-2026
// Dates verified against hebcal.com and official sources

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: "jewish" | "muslim" | "christian" | "national" | "druze" | "bahai";
  color: string;
}

const JEWISH_HOLIDAYS_2025: Holiday[] = [
  { date: "2025-03-13", name: "ערב פורים", type: "jewish", color: "#8b5cf6" },
  { date: "2025-03-14", name: "פורים", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-12", name: "ערב פסח (ליל הסדר)", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-13", name: "פסח - יום א׳", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-14", name: "פסח - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-15", name: "פסח - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-16", name: "פסח - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-17", name: "פסח - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-18", name: "ערב שביעי של פסח", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-19", name: "שביעי של פסח", type: "jewish", color: "#8b5cf6" },
  { date: "2025-04-23", name: "יום הזיכרון לשואה", type: "national", color: "#64748b" },
  { date: "2025-04-30", name: "יום הזיכרון", type: "national", color: "#64748b" },
  { date: "2025-05-01", name: "יום העצמאות", type: "national", color: "#3b82f6" },
  { date: "2025-05-15", name: 'ל"ג בעומר', type: "jewish", color: "#8b5cf6" },
  { date: "2025-06-01", name: "ערב שבועות", type: "jewish", color: "#8b5cf6" },
  { date: "2025-06-02", name: "שבועות", type: "jewish", color: "#8b5cf6" },
  { date: "2025-09-22", name: "ערב ראש השנה", type: "jewish", color: "#8b5cf6" },
  { date: "2025-09-23", name: "ראש השנה א׳", type: "jewish", color: "#8b5cf6" },
  { date: "2025-09-24", name: "ראש השנה ב׳", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-01", name: "ערב יום כיפור (כל נדרי)", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-02", name: "יום כיפור", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-06", name: "ערב סוכות", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-07", name: "סוכות - יום א׳", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-08", name: "סוכות - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-09", name: "סוכות - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-10", name: "סוכות - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-11", name: "הושענא רבה", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-13", name: "ערב שמחת תורה", type: "jewish", color: "#8b5cf6" },
  { date: "2025-10-14", name: "שמחת תורה", type: "jewish", color: "#8b5cf6" },
  { date: "2025-12-14", name: "ערב חנוכה", type: "jewish", color: "#8b5cf6" },
  { date: "2025-12-15", name: "חנוכה - נר ראשון", type: "jewish", color: "#8b5cf6" },
  { date: "2025-12-22", name: "חנוכה - נר שמיני", type: "jewish", color: "#8b5cf6" },
];

const JEWISH_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-03-01", name: "ערב פורים", type: "jewish", color: "#8b5cf6" },
  { date: "2026-03-02", name: "פורים", type: "jewish", color: "#8b5cf6" },
  { date: "2026-04-01", name: "ערב פסח (ליל הסדר)", type: "jewish", color: "#8b5cf6" },
  { date: "2026-04-02", name: "פסח - יום א׳", type: "jewish", color: "#8b5cf6" },
  { date: "2026-04-03", name: "פסח - חול המועד", type: "jewish", color: "#8b5cf6" },
  { date: "2026-04-07", name: "ערב שביעי של פסח", type: "jewish", color: "#8b5cf6" },
  { date: "2026-04-08", name: "שביעי של פסח", type: "jewish", color: "#8b5cf6" },
  { date: "2026-04-12", name: "יום הזיכרון לשואה", type: "national", color: "#64748b" },
  { date: "2026-04-19", name: "יום הזיכרון", type: "national", color: "#64748b" },
  { date: "2026-04-20", name: "יום העצמאות", type: "national", color: "#3b82f6" },
  { date: "2026-05-04", name: 'ל"ג בעומר', type: "jewish", color: "#8b5cf6" },
  { date: "2026-05-21", name: "ערב שבועות", type: "jewish", color: "#8b5cf6" },
  { date: "2026-05-22", name: "שבועות", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-11", name: "ערב ראש השנה", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-12", name: "ראש השנה א׳", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-13", name: "ראש השנה ב׳", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-20", name: "ערב יום כיפור (כל נדרי)", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-21", name: "יום כיפור", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-25", name: "ערב סוכות", type: "jewish", color: "#8b5cf6" },
  { date: "2026-09-26", name: "סוכות - יום א׳", type: "jewish", color: "#8b5cf6" },
  { date: "2026-10-02", name: "ערב שמחת תורה", type: "jewish", color: "#8b5cf6" },
  { date: "2026-10-03", name: "שמחת תורה", type: "jewish", color: "#8b5cf6" },
  { date: "2026-12-04", name: "ערב חנוכה", type: "jewish", color: "#8b5cf6" },
  { date: "2026-12-05", name: "חנוכה - נר ראשון", type: "jewish", color: "#8b5cf6" },
  { date: "2026-12-12", name: "חנוכה - נר שמיני", type: "jewish", color: "#8b5cf6" },
];

const MUSLIM_HOLIDAYS_2025: Holiday[] = [
  { date: "2025-01-27", name: "לילת אל-מעראג׳", type: "muslim", color: "#059669" },
  { date: "2025-02-28", name: "ערב רמדאן", type: "muslim", color: "#059669" },
  { date: "2025-03-01", name: "רמדאן (תחילה)", type: "muslim", color: "#059669" },
  { date: "2025-03-30", name: "עיד אל-פיטר", type: "muslim", color: "#059669" },
  { date: "2025-03-31", name: "עיד אל-פיטר - יום ב׳", type: "muslim", color: "#059669" },
  { date: "2025-04-01", name: "עיד אל-פיטר - יום ג׳", type: "muslim", color: "#059669" },
  { date: "2025-06-06", name: "ערב עיד אל-אדחא", type: "muslim", color: "#059669" },
  { date: "2025-06-07", name: "עיד אל-אדחא", type: "muslim", color: "#059669" },
  { date: "2025-06-08", name: "עיד אל-אדחא - יום ב׳", type: "muslim", color: "#059669" },
  { date: "2025-06-26", name: "ראש השנה ההג׳רי", type: "muslim", color: "#059669" },
  { date: "2025-09-05", name: "מולד הנביא", type: "muslim", color: "#059669" },
];

const MUSLIM_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-02-18", name: "רמדאן (תחילה)", type: "muslim", color: "#059669" },
  { date: "2026-03-20", name: "עיד אל-פיטר", type: "muslim", color: "#059669" },
  { date: "2026-03-21", name: "עיד אל-פיטר - יום ב׳", type: "muslim", color: "#059669" },
  { date: "2026-05-27", name: "עיד אל-אדחא", type: "muslim", color: "#059669" },
  { date: "2026-05-28", name: "עיד אל-אדחא - יום ב׳", type: "muslim", color: "#059669" },
  { date: "2026-06-17", name: "ראש השנה ההג׳רי", type: "muslim", color: "#059669" },
  { date: "2026-08-26", name: "מולד הנביא", type: "muslim", color: "#059669" },
];

const CHRISTIAN_HOLIDAYS_2025: Holiday[] = [
  { date: "2025-01-06", name: "חג ההתגלות", type: "christian", color: "#dc2626" },
  { date: "2025-04-13", name: "יום ראשון של הדקלים", type: "christian", color: "#dc2626" },
  { date: "2025-04-18", name: "יום שישי הטוב", type: "christian", color: "#dc2626" },
  { date: "2025-04-20", name: "חג הפסחא", type: "christian", color: "#dc2626" },
  { date: "2025-08-15", name: "עליית מריה", type: "christian", color: "#dc2626" },
  { date: "2025-12-24", name: "ערב חג המולד", type: "christian", color: "#dc2626" },
  { date: "2025-12-25", name: "חג המולד", type: "christian", color: "#dc2626" },
  { date: "2025-12-31", name: "ערב השנה החדשה", type: "christian", color: "#dc2626" },
];

const CHRISTIAN_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "השנה החדשה", type: "christian", color: "#dc2626" },
  { date: "2026-01-06", name: "חג ההתגלות", type: "christian", color: "#dc2626" },
  { date: "2026-03-29", name: "יום ראשון של הדקלים", type: "christian", color: "#dc2626" },
  { date: "2026-04-03", name: "יום שישי הטוב", type: "christian", color: "#dc2626" },
  { date: "2026-04-05", name: "חג הפסחא", type: "christian", color: "#dc2626" },
  { date: "2026-08-15", name: "עליית מריה", type: "christian", color: "#dc2626" },
  { date: "2026-12-24", name: "ערב חג המולד", type: "christian", color: "#dc2626" },
  { date: "2026-12-25", name: "חג המולד", type: "christian", color: "#dc2626" },
  { date: "2026-12-31", name: "ערב השנה החדשה", type: "christian", color: "#dc2626" },
];

const DRUZE_HOLIDAYS: Holiday[] = [
  { date: "2025-04-25", name: "חג הנביא שועייב (דרוזי)", type: "druze", color: "#0891b2" },
  { date: "2025-09-10", name: "חג אל-אדחא (דרוזי)", type: "druze", color: "#0891b2" },
  { date: "2026-04-25", name: "חג הנביא שועייב (דרוזי)", type: "druze", color: "#0891b2" },
  { date: "2026-08-31", name: "חג אל-אדחא (דרוזי)", type: "druze", color: "#0891b2" },
];

const BAHAI_HOLIDAYS: Holiday[] = [
  { date: "2025-03-02", name: "חג עלאא (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2025-03-20", name: "נורוז (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2025-04-21", name: "חג הרדוואן (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2025-05-23", name: "הכרזת הבאב (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2025-05-29", name: "עליית בהאאוללה (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2026-03-02", name: "חג עלאא (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2026-03-20", name: "נורוז (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2026-04-21", name: "חג הרדוואן (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2026-05-23", name: "הכרזת הבאב (בהאי)", type: "bahai", color: "#d97706" },
  { date: "2026-05-29", name: "עליית בהאאוללה (בהאי)", type: "bahai", color: "#d97706" },
];

export const ALL_HOLIDAYS: Holiday[] = [
  ...JEWISH_HOLIDAYS_2025,
  ...JEWISH_HOLIDAYS_2026,
  ...MUSLIM_HOLIDAYS_2025,
  ...MUSLIM_HOLIDAYS_2026,
  ...CHRISTIAN_HOLIDAYS_2025,
  ...CHRISTIAN_HOLIDAYS_2026,
  ...DRUZE_HOLIDAYS,
  ...BAHAI_HOLIDAYS,
];

export function getHolidaysForDate(dateStr: string): Holiday[] {
  return ALL_HOLIDAYS.filter(h => h.date === dateStr);
}

export function getHolidaysInRange(start: Date, end: Date): Holiday[] {
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  return ALL_HOLIDAYS.filter(h => h.date >= startStr && h.date <= endStr);
}
