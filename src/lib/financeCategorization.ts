export type FinanceDirection = "income" | "expense";

type CategoryRule = {
  category: string;
  keywords: string[];
};

const EXPENSE_RULES: CategoryRule[] = [
  { category: "סופר", keywords: ["שופרסל", "רמי לוי", "יוחננוף", "ויקטורי", "אושר עד", "חצי חינם", "קרפור", "מגה", "טיב טעם", "super", "market", "grocery"] },
  { category: "אוכל", keywords: ["מסעד", "קפה", "ארומה", "מקדונלד", "וולט", "תן ביס", "משלוחה", "פיצה", "סושי", "restaurant", "cafe", "coffee", "wolt"] },
  { category: "דלק", keywords: ["פז", "סונול", "דלק", "דור אלון", "טן ", "yellow", "gas station", "fuel"] },
  { category: "תחבורה", keywords: ["רכבת", "אגד", "דן ", "רב קו", "מוביט", "פנגו", "סלופארק", "חניה", "כביש 6", "gett", "uber", "taxi", "parking"] },
  { category: "דיור", keywords: ["שכר דירה", "ועד בית", "ארנונה", "משכנת", "rent", "mortgage"] },
  { category: "חשבונות", keywords: ["חשמל", "מי ", "מים", "גז", "בזק", "סלקום", "פרטנר", "הוט", "012", "019", "חשבון", "electric", "water", "cellcom", "partner", "telecom"] },
  { category: "ביטוחים", keywords: ["ביטוח", "הראל", "מגדל", "כלל", "הפניקס", "מנורה", "איילון", "insurance"] },
  { category: "בריאות", keywords: ["סופר פארם", "סופר-פארם", "בית מרקחת", "מכבי", "כללית", "מאוחדת", "לאומית", "רופא", "מרפאה", "pharm", "health"] },
  { category: "חינוך", keywords: ["אוניברסיט", "מכללה", "קורס", "לימוד", "בית ספר", "udemy", "coursera", "education"] },
  { category: "בילויים", keywords: ["נטפליקס", "ספוטיפיי", "דיסני", "יס פלאנט", "סינמה", "קולנוע", "תיאטרון", "כרטיסים", "netflix", "spotify", "cinema", "ticketmaster"] },
  { category: "קניות", keywords: ["אמזון", "אליאקספרס", "איקאה", "זארה", "קסטרו", "רנואר", "פוקס", "קניון", "terminal x", "amazon", "aliexpress", "ikea", "zara", "ebay", "shein"] },
  { category: "נסיעות", keywords: ["אל על", "ישראייר", "ארקיע", "בוקינג", "איירבנב", "מלון", "booking", "airbnb", "hotel", "airlines", "ryanair", "wizz"] },
  { category: "עמלות ומסים", keywords: ["עמלה", "ריבית", "מס הכנסה", "ביטוח לאומי", "commission", "fee", "interest", "tax"] },
  { category: "העברות", keywords: ["העברה", "bit", "פייבוקס", "paybox", "הפקדה", "משיכה", "transfer", "atm"] },
  { category: "כרטיס אשראי", keywords: ["ישראכרט", "כאל", "מקס איט", "max ", "american express", "credit card"] },
];

const INCOME_RULES: CategoryRule[] = [
  { category: "משכורת", keywords: ["משכורת", "שכר", "salary", "payroll"] },
  { category: "קצבה", keywords: ["ביטוח לאומי", "קצבה", "פנסיה", "allowance", "pension"] },
  { category: "החזר", keywords: ["זיכוי", "החזר", "refund", "cashback"] },
  { category: "העברות", keywords: ["העברה", "bit", "פייבוקס", "paybox", "transfer"] },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("he")
    .replace(/[\u200e\u200f]/g, "")
    .replace(/[-_/.,'"()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferFinanceCategory(
  description: string | null | undefined,
  direction: FinanceDirection,
) {
  const value = normalize(description || "");
  const rules = direction === "income" ? INCOME_RULES : EXPENSE_RULES;
  const match = rules.find((rule) => rule.keywords.some((keyword) => value.includes(normalize(keyword))));
  return match?.category || (direction === "income" ? "הכנסה אחרת" : "אחר");
}

const CATEGORY_ALIASES: Record<string, string> = {
  groceries: "סופר",
  food: "אוכל",
  transport: "תחבורה",
  bills: "חשבונות",
  shopping: "קניות",
  health: "בריאות",
  entertainment: "בילויים",
  housing: "דיור",
  insurance: "ביטוחים",
  education: "חינוך",
  travel: "נסיעות",
  fees: "עמלות ומסים",
  transfer: "העברות",
  other: "אחר",
};

export function normalizeFinanceCategory(
  category: string | null | undefined,
  description: string | null | undefined,
  direction: FinanceDirection,
) {
  const existing = String(category || "").trim();
  if (!existing) return inferFinanceCategory(description, direction);
  return CATEGORY_ALIASES[existing.toLocaleLowerCase("en")] || existing;
}

export function cleanMerchantName(value: string | null | undefined) {
  const cleaned = String(value || "עסקה ללא שם")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/[*/#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "עסקה ללא שם";
}
