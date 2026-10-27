import { parseFinancialDate, type ParsedTransaction } from "./financialProviders.ts";
import { normalizeFinanceCategory } from "./financeCategorization.ts";

const clean = (value: string) => value.replace(/[\u200e\u200f\u202a-\u202e\uFEFF]/g, "").trim();
const currencyCode = (value: string) => {
  const code = clean(value).toUpperCase();
  if (/^(ILS|NIS|₪|ש["״']?ח|שקל(?: חדש)?)$/.test(code)) return "ILS";
  if (/^(USD|US\$|\$|דולר)$/.test(code)) return "USD";
  if (/^(EUR|€|אירו|יורו)$/.test(code)) return "EUR";
  if (/^(GBP|£)$/.test(code)) return "GBP";
  return /^[A-Z]{3}$/.test(code) ? code : "UNKNOWN";
};

export function parseAmexAmount(value: string): number | null {
  const text = clean(value).replace(/[₪$€£\s]/g, "");
  if (!/^(?:\([\d,.]+\)|-?[\d,.]+|[\d,.]+-)$/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text) || /-$/.test(text);
  const number = text.replace(/[()-]/g, "");
  // Reject ambiguous decimal-comma formats instead of importing 12,50 as 1250.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(number)) return null;
  const amount = Number(number.replace(/,/g, ""));
  return Number.isFinite(amount) ? (negative ? -amount : amount) : null;
}

export function decodeStatementText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("windows-1255").decode(buffer); }
}

export interface AmexLegacyCorrection { legacyExternalId: string; next: ParsedTransaction | null }
interface AmexParseResult {
  transactions: ParsedTransaction[]; skipped: number; unsupported: boolean;
  legacyCorrections: AmexLegacyCorrection[]; pending: ParsedTransaction[];
}

function billedHeaderIndex(rows: string[][]) {
  return rows.findIndex(row => row.some(value => /תאריך\s*(?:ה?עסקה|רכישה)|^(?:transaction date|purchase date|date)$/i.test(clean(value)))
    && row.some(value => /סכום\s*(?:ה?חיוב|לחיוב)|billing\s*amount|amount\s*billed/i.test(clean(value))));
}

export function parseAmexStatement(rows: string[][], originalHeaders: string[], legacy = false): AmexParseResult {
  const billedSection = billedHeaderIndex(rows);
  const startsWithBilled = originalHeaders.some(value => /סכום\s*(?:ה?חיוב|לחיוב)|billing\s*amount|amount\s*billed/i.test(clean(value)));
  if (!legacy && !startsWithBilled && billedSection >= 0) {
    const result = parseAmexStatement(rows.slice(billedSection + 1), rows[billedSection]);
    const occurrences = new Map<string, number>();
    // Reproduce old IDs from the same file, never fuzzy-match merchant names in stored history.
    rows.forEach((row, index) => {
      const old = parseAmexStatement([row], originalHeaders, true).transactions[0];
      if (!old?.external_transaction_id) return;
      const occurrence = (occurrences.get(old.external_transaction_id) || 0) + 1;
      occurrences.set(old.external_transaction_id, occurrence);
      const next = index > billedSection ? parseAmexStatement([row], rows[billedSection], true).transactions[0] : null;
      if (index < billedSection) result.pending.push(old);
      if (next || index < billedSection) result.legacyCorrections.push({
        legacyExternalId: occurrence === 1 ? old.external_transaction_id : `${old.external_transaction_id}:${occurrence}`,
        next: next || null,
      });
    });
    return result;
  }
  const headers = originalHeaders.map(clean);
  const index = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const date = index(/תאריך\s*(?:ה?עסקה|רכישה)|^(?:transaction\s*date|purchase\s*date|date)$/i);
  const merchant = index(/שם\s*בית\s*(?:ה?עסק)|תיאור|^(?:description|merchant|merchant name|name)$/i);
  const ilsBilled = index(/(?:סכום\s*(?:ה?חיוב|לחיוב)).*(?:ILS|NIS|₪|ש["״]ח)/i);
  const billed = ilsBilled >= 0 ? ilsBilled : index(/סכום\s*(?:ה?חיוב|לחיוב)|billing\s*amount|amount\s*billed/i);
  const original = index(/סכום\s*(?:ה?עסקה|מקורי)|^(?:amount|transaction amount|original amount)$/i);
  const billedCurrency = index(/מטבע\s*(?:ה?חיוב)|billing\s*currency/i);
  const originalCurrency = index(/מטבע\s*(?:ה?עסקה)|^(?:currency|original currency|transaction currency)$/i);
  const due = index(/תאריך\s*(?:ה?חיוב|פ[יר]רעון|פרעון)|מועד\s*(?:ה?חיוב|פירעון)|^(?:billing date|payment date|due date)$/i);
  const category = index(/קטגוריה|ענף|^category$/i);
  const card = index(/מספר\s*כרטיס|ספרות\s*אחרונות|^כרטיס$|card\s*(?:number|ending|last)|last\s*(?:4|four)/i);
  const reference = index(/מספר\s*אסמכת|מס[׳']?\s*שובר|^reference$|transaction\s*id/i);
  const installmentField = index(/תשלומים|תשלום|installment/i);
  const installments = installmentField >= 0 ? installmentField : index(/פירוט\s*נוסף|^details$/i);
  const installmentNumber = index(/מספר\s*תשלום|^installment number$/i);
  const installmentTotal = index(/סה[״"]?כ\s*תשלומים|מספר\s*תשלומים|^total installments$/i);
  const type = index(/סוג\s*(?:עסקה|פעולה)|transaction\s*type|חיוב\s*\/\s*זיכוי/i);
  const status = index(/סטטוס|^status$/i);
  const transactions: ParsedTransaction[] = [];
  let skipped = 0;
  if (date < 0 || merchant < 0 || (billed < 0 && original < 0)) {
    return { transactions, skipped: rows.length, unsupported: true, legacyCorrections: [], pending: [] };
  }
  for (const row of rows) {
    const get = (i: number) => clean(row[i] || "");
    const transactionDate = parseFinancialDate(get(date));
    const description = get(merchant);
    const amountIndex = get(billed) ? billed : original;
    const signedAmount = parseAmexAmount(get(amountIndex));
    const headerCurrency = headers[amountIndex]?.match(/ILS|NIS|USD|EUR|GBP|₪|ש["״]ח/i)?.[0];
    const currency = currencyCode(headerCurrency || get(amountIndex === billed ? billedCurrency : originalCurrency));
    if (!transactionDate || !description || signedAmount === null || signedAmount === 0 || currency === "UNKNOWN"
      || /בוטל|cancelled|canceled|void/i.test(get(status))) {
      skipped += 1;
      continue;
    }
    const credit = signedAmount < 0 || /זיכוי|refund|credit/i.test(get(type));
    const installmentMatch = get(installments).match(/(?:תשלום\s*)?(\d+)\s*(?:מתוך|מ-|\/|of)\s*(\d+)/i);
    const number = Number(get(installmentNumber)) || Number(installmentMatch?.[1]);
    const total = Number(get(installmentTotal)) || Number(installmentMatch?.[2]);
    const validInstallments = Number.isInteger(number) && Number.isInteger(total) && number > 0 && number <= total && total <= 600;
    const billingDate = parseFinancialDate(get(due)) || undefined;
    const lastFour = get(card).replace(/\D/g, "").slice(-4);
    const direction = credit ? "income" : "expense";
    // Keep issuer references when available. Otherwise, repeat occurrences are numbered by the shared importer.
    const identity = [get(reference) || [transactionDate, description, Math.abs(signedAmount)].join("|"), currency,
      direction, lastFour, validInstallments ? `${number}/${total}` : "", billingDate || ""];
    transactions.push({
      transaction_date: transactionDate, amount: Math.abs(signedAmount), currency, direction, description,
      merchant: description, category: normalizeFinanceCategory(get(category) || (credit ? "החזר" : ""), description, direction),
      billing_date: billingDate,
      installment_number: validInstallments ? number : undefined,
      installment_total: validInstallments ? total : undefined,
      external_transaction_id: `amex-csv-v1:${JSON.stringify(identity)}`,
      // Store only known metadata, never the original full card or arbitrary authentication columns.
      raw_data: { ...(lastFour.length === 4 ? { "card ending": lastFour } : {}), statement_provider: "amex",
        ...(credit ? { statement_credit: true } : {}) },
    });
  }
  return { transactions, skipped, unsupported: false, legacyCorrections: [], pending: [] };
}

export function summarizeAmexStatement(rows: ParsedTransaction[]) {
  const totals = new Map<string, { currency: string; expenses: number; credits: number; net: number }>();
  for (const row of rows) {
    const total = totals.get(row.currency) || { currency: row.currency, expenses: 0, credits: 0, net: 0 };
    if (row.direction === "income") total.credits += row.amount;
    else total.expenses += row.amount;
    total.net = Math.round((total.expenses - total.credits) * 100) / 100;
    totals.set(row.currency, total);
  }
  return [...totals.values()];
}

export function reconcileAmexStatement(rows: string[][], headers: string[], transactions: ParsedTransaction[]) {
  const billedSection = billedHeaderIndex(rows);
  if (billedSection >= 0 && !headers.some(header => /סכום\s*(?:ה?חיוב|לחיוב)|billing\s*amount|amount\s*billed/i.test(clean(header)))) {
    return reconcileAmexStatement(rows.slice(billedSection + 1), rows[billedSection], transactions);
  }
  const amountIndex = headers.findIndex(header => /סכום\s*(?:ה?חיוב|לחיוב)/.test(clean(header)));
  const currencyIndex = headers.findIndex(header => /מטבע\s*(?:ה?חיוב)/.test(clean(header)));
  if (amountIndex < 0) return [];
  const reported = new Map<string, number[]>();
  for (const row of rows) {
    const label = row.find(value => /סה["״]?כ\s+לחיוב\s+החודש\s+בכרטיס/.test(clean(value)));
    if (!label) continue;
    const amount = parseAmexAmount(row[amountIndex] || '');
    const currency = currencyCode(row[currencyIndex] || (/בש["״]?ח/.test(label) ? 'ILS' : ''));
    if (amount === null || currency === 'UNKNOWN') continue;
    reported.set(currency, [...(reported.get(currency) || []), amount]);
  }
  const totals = summarizeAmexStatement(transactions);
  // Multiple totals for a currency can belong to different sections/cards; never add them blindly.
  return [...reported].filter(([, amounts]) => amounts.length === 1).map(([currency, amounts]) => {
    const parsed = totals.find(total => total.currency === currency)?.net || 0;
    const difference = Math.round((parsed - amounts[0]) * 100) / 100;
    return { currency, reported: amounts[0], parsed, difference, matches: difference === 0 };
  });
}

export const AMEX_CSV_TEMPLATE = '\uFEFFתאריך עסקה,שם בית העסק,סכום חיוב,מטבע חיוב,מספר כרטיס,תאריך חיוב,תשלומים,קטגוריה\r\n';
