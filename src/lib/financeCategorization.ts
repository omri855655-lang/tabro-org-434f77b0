export type FinanceDirection = "income" | "expense";

type CategoryRule = {
  category: string;
  keywords: string[];
};

type SubcategoryRule = {
  category: string;
  subcategory: string;
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

const EXPENSE_SUBCATEGORY_RULES: SubcategoryRule[] = [
  { category: "מזון", subcategory: "סופר", keywords: ["שופרסל", "רמי לוי", "יוחננוף", "ויקטורי", "אושר עד", "חצי חינם", "קרפור", "מגה", "טיב טעם", "super", "market", "grocery"] },
  { category: "מזון", subcategory: "מסעדות ובתי קפה", keywords: ["מסעד", "קפה", "ארומה", "מקדונלד", "וולט", "תן ביס", "משלוחה", "פיצה", "סושי", "restaurant", "cafe", "coffee", "wolt"] },
  { category: "תחבורה", subcategory: "דלק", keywords: ["פז", "סונול", "דלק", "דור אלון", "טן ", "yellow", "gas station", "fuel"] },
  { category: "תחבורה", subcategory: "תחבורה ציבורית", keywords: ["רכבת", "אגד", "דן ", "רב קו", "מוביט", "train", "bus"] },
  { category: "תחבורה", subcategory: "רכב, חניה וכבישים", keywords: ["פנגו", "סלופארק", "חניה", "כביש 6", "parking"] },
  { category: "תחבורה", subcategory: "מוניות", keywords: ["gett", "uber", "taxi", "מונית"] },
  { category: "דיור", subcategory: "שכירות", keywords: ["שכר דירה", "rent"] },
  { category: "דיור", subcategory: "משכנתא", keywords: ["משכנת", "mortgage"] },
  { category: "דיור", subcategory: "ארנונה ואחזקת בית", keywords: ["ועד בית", "ארנונה"] },
  { category: "חשבונות", subcategory: "חשמל ומים", keywords: ["חשמל", "מים", "electric", "water"] },
  { category: "חשבונות", subcategory: "תקשורת", keywords: ["בזק", "סלקום", "פרטנר", "הוט", "012", "019", "cellcom", "partner", "telecom"] },
  { category: "קניות", subcategory: "אופנה", keywords: ["זארה", "קסטרו", "רנואר", "פוקס", "terminal x", "zara", "shein"] },
  { category: "קניות", subcategory: "קניות אונליין", keywords: ["אמזון", "אליאקספרס", "amazon", "aliexpress", "ebay"] },
  { category: "בילויים", subcategory: "מנויים דיגיטליים", keywords: ["נטפליקס", "ספוטיפיי", "דיסני", "storytel", "openai", "chatgpt", "netflix", "spotify"] },
  { category: "בילויים", subcategory: "תרבות וכרטיסים", keywords: ["יס פלאנט", "סינמה", "קולנוע", "תיאטרון", "כרטיסים", "cinema", "ticketmaster"] },
  { category: "בריאות", subcategory: "פארם ובתי מרקחת", keywords: ["סופר פארם", "סופר-פארם", "בית מרקחת", "pharm"] },
  { category: "בריאות", subcategory: "קופות וטיפולים", keywords: ["מכבי", "כללית", "מאוחדת", "לאומית", "רופא", "מרפאה"] },
  { category: "נסיעות", subcategory: "טיסות", keywords: ["אל על", "ישראייר", "ארקיע", "emirates", "airlines", "ryanair", "wizz"] },
  { category: "נסיעות", subcategory: "מלונות ואירוח", keywords: ["בוקינג", "איירבנב", "מלון", "booking", "airbnb", "hotel"] },
  { category: "העברות", subcategory: "העברה בנקאית", keywords: ["הע.", "העברה", "transfer"] },
  { category: "העברות", subcategory: "אפליקציות תשלום", keywords: ["bit", "פייבוקס", "paybox"] },
  { category: "העברות", subcategory: "מזומן", keywords: ["כספומט", "משיכה", "atm"] },
];

const CATEGORY_GROUPS: Record<string, string> = {
  "סופר": "מזון",
  "אוכל": "מזון",
  "מזון ומשקאות": "מזון",
  "מסעדות": "מזון",
  "מזון מהיר": "מזון",
  "דלק": "תחבורה",
  "fuel": "תחבורה",
  "תחבורה": "תחבורה",
  "רכב ותחבורה": "תחבורה",
  "דיור": "דיור",
  "שכירות": "דיור",
  "משכנתא": "דיור",
  "ריהוט ובית": "דיור ובית",
  "חשמל": "חשבונות",
  "מים": "חשבונות",
  "גז": "חשבונות",
  "אינטרנט": "חשבונות",
  "טלפון": "חשבונות",
  "חשבונות": "חשבונות",
  "אנרגיה": "חשבונות",
  "תקשורת ומחשבים": "חשבונות ותקשורת",
  "ביטוח ופיננסים": "ביטוחים ופיננסים",
  "ביטוחים": "ביטוחים ופיננסים",
  "פנאי בילוי": "בילויים",
  "בילויים": "בילויים",
  "תיירות": "נסיעות ואירוח",
  "נסיעות": "נסיעות ואירוח",
  "מלונאות ואירוח": "נסיעות ואירוח",
  "רפואה ובריאות": "בריאות",
  "בריאות": "בריאות",
};

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

export function inferFinanceSubcategory(
  description: string | null | undefined,
  category: string | null | undefined,
) {
  const value = normalize(description || "");
  const match = EXPENSE_SUBCATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => value.includes(normalize(keyword))),
  );
  if (match) return match.subcategory;

  const normalizedCategory = normalizeFinanceCategory(category, description, "expense");
  if (normalizedCategory === "סופר") return "סופר";
  if (normalizedCategory === "אוכל") return "מסעדות ובתי קפה";
  if (normalizedCategory === "דלק") return "דלק";
  return normalizedCategory || "אחר";
}

export function getFinanceCategoryGroup(category: string | null | undefined) {
  const value = String(category || "אחר").trim() || "אחר";
  return CATEGORY_GROUPS[value] || value;
}

export function cleanMerchantName(value: string | null | undefined) {
  const cleaned = String(value || "עסקה ללא שם")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/[*/#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "עסקה ללא שם";
}
