// Financial CSV provider parsers for Israeli credit cards and banks

export interface ParsedTransaction {
  transaction_date: string;
  posted_date?: string;
  billing_date?: string;
  amount: number;
  currency: string;
  direction: "income" | "expense";
  description: string;
  merchant?: string;
  category?: string;
  external_transaction_id?: string;
  installment_total?: number;
  installment_number?: number;
  raw_data?: Record<string, any>;
}

export interface FinancialProvider {
  id: string;
  name: string;
  nameHe: string;
  detect: (headers: string[], firstRows: string[][]) => boolean;
  parse: (rows: string[][], headers: string[]) => ParsedTransaction[];
}

// Helper to parse dd/MM/yyyy or yyyy-MM-dd dates
export function parseFinancialDate(val: string): string {
  const value = val?.trim();
  if (!value) return "";
  // dd/MM/yyyy
  const dmy = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (date.getFullYear() === Number(dmy[3]) && date.getMonth() === Number(dmy[2]) - 1 && date.getDate() === Number(dmy[1])) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
  }
  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) return value;
  }
  return "";
}

const parseDate = parseFinancialDate;

const ilsBillingAmountIndex = (headers: string[]) => headers.findIndex(h =>
  /סכום\s*חיוב.*(?:ש["״]ח|שקל|ILS|NIS)|(?:ש["״]ח|שקל|ILS|NIS).*סכום\s*חיוב/i.test(h));

function parseAmount(val: string): number {
  return parseFloat(val.replace(/[₪$€,\s]/g, "").replace(/[()]/g, "")) || 0;
}

// Auto-categorize by keyword
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: ["שופרסל", "רמי לוי", "מגה", "יוחננוף", "אושר עד", "חצי חינם", "סופר", "פרש"],
  fuel: ["פז", "סונול", "דלק", "אלון", "דור אלון", "ten"],
  food: ["מקדונלד", "ארומה", "קפה", "מסעדה", "פיצה", "סושי", "בורגר", "אוכל"],
  transport: ["מוניות", "גט", "uber", "רכבת", "אגד", "דן", "חניה"],
  health: ["סופר-פארם", "בית מרקחת", "מכבי", "כללית", "לאומית", "רופא"],
  shopping: ["אמזון", "עלי אקספרס", "שיין", "zara", "h&m", "fox", "קניון"],
  bills: ["חשמל", "חברת חשמל", "מים", "ארנונה", "עירייה", "בזק", "פרטנר", "סלקום", "הוט"],
  entertainment: ["נטפליקס", "ספוטיפיי", "סינמה", "כרטיס", "הצגה"],
  insurance: ["ביטוח", "הראל", "מגדל", "כלל", "הפניקס", "מנורה"],
};

export function autoCategorize(description: string): string | undefined {
  const lower = description.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) return cat;
  }
  return undefined;
}

// Isracard CSV parser
const isracardProvider: FinancialProvider = {
  id: "isracard",
  name: "Isracard",
  nameHe: "ישראכרט",
  detect: (headers) => {
    const joined = headers.join(",").toLowerCase();
    return joined.includes("תאריך עסקה") || joined.includes("שם בית העסק") || joined.includes("isracard");
  },
  parse: (rows, headers) => {
    const dateIdx = headers.findIndex(h => h.includes("תאריך עסקה") || h.includes("תאריך"));
    const descIdx = headers.findIndex(h => h.includes("שם בית העסק") || h.includes("שם") || h.includes("תיאור"));
    const billedIdx = ilsBillingAmountIndex(headers);
    const amtIdx = billedIdx >= 0 ? billedIdx : headers.findIndex(h => h.includes("סכום חיוב") || h.includes("סכום"));
    const currIdx = headers.findIndex(h => h.includes("מטבע"));

    return rows.map(row => ({
      transaction_date: parseDate(row[dateIdx] || ""),
      amount: Math.abs(parseAmount(row[amtIdx] || "0")),
      currency: billedIdx >= 0 ? "ILS" : row[currIdx]?.trim() || "ILS",
      direction: "expense" as const,
      description: row[descIdx]?.trim() || "",
      merchant: row[descIdx]?.trim(),
      category: autoCategorize(row[descIdx] || ""),
      external_transaction_id: `isracard_${row[dateIdx]}_${row[descIdx]}_${row[amtIdx]}`.replace(/\s/g, ""),
      raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
    }));
  },
};

// MAX (Leumi Card) CSV parser
const maxProvider: FinancialProvider = {
  id: "max",
  name: "MAX",
  nameHe: "מקס",
  detect: (headers) => {
    const joined = headers.join(",").toLowerCase();
    return joined.includes("תאריך רכישה") || joined.includes("max") || joined.includes("לאומי קארד");
  },
  parse: (rows, headers) => {
    const dateIdx = headers.findIndex(h => h.includes("תאריך רכישה") || h.includes("תאריך"));
    const descIdx = headers.findIndex(h => h.includes("שם בית עסק") || h.includes("שם"));
    const billedIdx = ilsBillingAmountIndex(headers);
    const amtIdx = billedIdx >= 0 ? billedIdx : headers.findIndex(h => h.includes("סכום חיוב") || h.includes("סכום"));
    const currIdx = headers.findIndex(h => h.includes("מטבע"));

    return rows.map(row => ({
      transaction_date: parseDate(row[dateIdx] || ""),
      amount: Math.abs(parseAmount(row[amtIdx] || "0")),
      currency: billedIdx >= 0 ? "ILS" : row[currIdx]?.trim() || "ILS",
      direction: "expense" as const,
      description: row[descIdx]?.trim() || "",
      merchant: row[descIdx]?.trim(),
      category: autoCategorize(row[descIdx] || ""),
      external_transaction_id: `max_${row[dateIdx]}_${row[descIdx]}_${row[amtIdx]}`.replace(/\s/g, ""),
      raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
    }));
  },
};

// CAL (Visa Cal) CSV parser
const calProvider: FinancialProvider = {
  id: "cal",
  name: "CAL",
  nameHe: "כאל",
  detect: (headers) => {
    const joined = headers.join(",").toLowerCase();
    return joined.includes("תאריך העסקה") || joined.includes("cal") || joined.includes("כאל");
  },
  parse: (rows, headers) => {
    const dateIdx = headers.findIndex(h => h.includes("תאריך") && h.includes("עסקה"));
    const descIdx = headers.findIndex(h => h.includes("שם") || h.includes("עסק") || h.includes("תיאור"));
    const billedIdx = ilsBillingAmountIndex(headers);
    const amtIdx = billedIdx >= 0 ? billedIdx : headers.findIndex(h => h.includes("סכום חיוב") || h.includes("סכום") || h.includes("חיוב"));
    const currIdx = headers.findIndex(h => h.includes("מטבע"));

    return rows.map(row => ({
      transaction_date: parseDate(row[dateIdx >= 0 ? dateIdx : 0] || ""),
      amount: Math.abs(parseAmount(row[amtIdx >= 0 ? amtIdx : 2] || "0")),
      currency: billedIdx >= 0 ? "ILS" : row[currIdx]?.trim() || "ILS",
      direction: "expense" as const,
      description: row[descIdx >= 0 ? descIdx : 1]?.trim() || "",
      merchant: row[descIdx >= 0 ? descIdx : 1]?.trim(),
      category: autoCategorize(row[descIdx >= 0 ? descIdx : 1] || ""),
      external_transaction_id: `cal_${row[dateIdx >= 0 ? dateIdx : 0]}_${row[descIdx >= 0 ? descIdx : 1]}_${row[amtIdx >= 0 ? amtIdx : 2]}`.replace(/\s/g, ""),
      raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
    }));
  },
};

// Generic bank CSV parser
const genericBankProvider: FinancialProvider = {
  id: "generic_bank",
  name: "Generic Bank",
  nameHe: "בנק כללי",
  detect: (headers) => {
    const joined = headers.join(",").toLowerCase();
    return (joined.includes("תאריך") && (joined.includes("סכום") || joined.includes("זכות") || joined.includes("חובה")));
  },
  parse: (rows, headers) => {
    const dateIdx = headers.findIndex(h => h.includes("תאריך"));
    const descIdx = headers.findIndex(h => h.includes("תיאור") || h.includes("פעולה") || h.includes("אסמכתא"));
    const debitIdx = headers.findIndex(h => h.includes("חובה") || h.includes("הוצאה"));
    const creditIdx = headers.findIndex(h => h.includes("זכות") || h.includes("הכנסה"));
    const amtIdx = headers.findIndex(h => h.includes("סכום"));

    return rows.map(row => {
      const debit = debitIdx >= 0 ? parseAmount(row[debitIdx] || "0") : 0;
      const credit = creditIdx >= 0 ? parseAmount(row[creditIdx] || "0") : 0;
      const amount = amtIdx >= 0 ? parseAmount(row[amtIdx] || "0") : (debit || credit);
      const direction = credit > 0 ? "income" : "expense";

      return {
        transaction_date: parseDate(row[dateIdx] || ""),
        amount: Math.abs(amount || debit || credit),
        currency: "ILS",
        direction: direction as "income" | "expense",
        description: row[descIdx >= 0 ? descIdx : 1]?.trim() || "",
        merchant: row[descIdx >= 0 ? descIdx : 1]?.trim(),
        category: autoCategorize(row[descIdx >= 0 ? descIdx : 1] || ""),
        external_transaction_id: `bank_${row[dateIdx]}_${row[descIdx >= 0 ? descIdx : 1]}_${amount}`.replace(/\s/g, ""),
        raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
      };
    });
  },
};

// Custom CSV — expects: date, description, amount columns
const customCsvProvider: FinancialProvider = {
  id: "custom",
  name: "Custom CSV",
  nameHe: "CSV מותאם אישית",
  detect: () => false, // manual selection only
  parse: (rows, headers) => {
    const dateIdx = headers.findIndex(h => /date|תאריך/i.test(h));
    const descIdx = headers.findIndex(h => /desc|תיאור|description|name|שם/i.test(h));
    const amtIdx = headers.findIndex(h => /amount|סכום|sum/i.test(h));
    const dirIdx = headers.findIndex(h => /type|סוג|direction/i.test(h));
    const debitIdx = headers.findIndex(h => /debit|חובה|הוצאה|charge|חיוב/i.test(h));
    const creditIdx = headers.findIndex(h => /credit|זכות|הכנסה/i.test(h));

    return rows.map(row => {
      const dirVal = dirIdx >= 0 ? row[dirIdx]?.toLowerCase() : "";
      const rawAmount = parseFloat((row[amtIdx >= 0 ? amtIdx : 2] || "0").replace(/[₪$€,\s]/g, "").replace(/[()]/g, "")) || 0;
      const debit = debitIdx >= 0 ? parseAmount(row[debitIdx] || "0") : 0;
      const credit = creditIdx >= 0 ? parseAmount(row[creditIdx] || "0") : 0;

      let direction: "income" | "expense" = "expense";
      let amount = Math.abs(rawAmount);

      if (dirVal.includes("income") || dirVal.includes("הכנסה") || dirVal.includes("זכות")) {
        direction = "income";
      } else if (dirVal.includes("expense") || dirVal.includes("הוצאה") || dirVal.includes("חובה")) {
        direction = "expense";
      } else if (debitIdx >= 0 && creditIdx >= 0) {
        direction = credit > 0 ? "income" : "expense";
        amount = Math.abs(credit > 0 ? credit : debit);
      } else if (rawAmount > 0 && amtIdx >= 0) {
        // Positive amounts in a single-column CSV are typically expenses (credit card charges)
        direction = "expense";
      } else if (rawAmount < 0) {
        direction = "expense";
      }

      return {
        transaction_date: parseDate(row[dateIdx >= 0 ? dateIdx : 0] || ""),
        amount,
        currency: "ILS",
        direction,
        description: row[descIdx >= 0 ? descIdx : 1]?.trim() || "",
        category: autoCategorize(row[descIdx >= 0 ? descIdx : 1] || ""),
        external_transaction_id: `custom_${row[dateIdx >= 0 ? dateIdx : 0]}_${row[descIdx >= 0 ? descIdx : 1]}_${rawAmount}`.replace(/\s/g, ""),
        raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
      };
    });
  },
};

export const financialProviders: FinancialProvider[] = [
  isracardProvider,
  maxProvider,
  calProvider,
  genericBankProvider,
  customCsvProvider,
];

export function detectProvider(headers: string[], firstRows: string[][]): FinancialProvider | null {
  return financialProviders.find(p => p.detect(headers, firstRows)) || null;
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const separatorCounts = { "\t": 0, ";": 0, ",": 0 };
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in separatorCounts) separatorCounts[char as keyof typeof separatorCounts] += 1;
  }
  const delimiter = (Object.entries(separatorCounts) as Array<[keyof typeof separatorCounts, number]>)
    .sort((a, b) => b[1] - a[1])[0][0];
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value)) records.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value)) records.push(row);
  if (records.length < 2) return { headers: [], rows: [] };
  return { headers: records[0], rows: records.slice(1) };
}
