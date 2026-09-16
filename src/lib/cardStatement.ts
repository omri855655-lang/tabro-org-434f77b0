import { parseFinancialDate, type ParsedTransaction } from "./financialProviders.ts";

const CARD_NUMBER_HEADER = /מספר\s*כרטיס|כרטיס\s*אשראי|^כרטיס$|ספרות\s*אחרונות|card\s*(?:#|number|num|pan|no\.?|last|ending)|last\s*(?:4|four)/i;
const BILLING_DATE_HEADER = /תאריך\s*חיוב|מועד\s*חיוב|תאריך\s*פירעון|תאריך\s*פרעון|billing\s*date|payment\s*date|due\s*date/i;
const TRANSACTION_DATE_HEADER = /תאריך\s*(?:עסקה|רכישה)|transaction\s*date|purchase\s*date/i;
const TRANSACTION_TYPE_HEADER = /סוג\s*(?:עסקה|פעולה)|transaction\s*type|חיוב\s*\/\s*זיכוי/i;
const TRANSACTION_STATUS_HEADER = /סטטוס|status/i;
const SENSITIVE_HEADER = /מספר\s*כרטיס|כרטיס\s*אשראי|^כרטיס$|ספרות\s*אחרונות|card\s*(?:#|number|num|pan|no\.?|last|ending)|last\s*(?:4|four)|cvv|cvc|pin|סיסמ|קוד\s*סודי|תעודת\s*זהות|national\s*id/i;

export interface StatementChargeInput {
  source_type: string;
  source_connection_id?: string | null;
  account_external_id?: string | null;
  direction: string;
  amount: number;
  raw_data?: { billing_date?: string | null } | null;
}

export function cardLastFour(rawData: Record<string, unknown> | undefined): string | null {
  if (!rawData) return null;
  for (const [header, value] of Object.entries(rawData)) {
    if (!CARD_NUMBER_HEADER.test(header)) continue;
    const digits = String(value ?? "").replace(/\D/g, "");
    if (digits.length >= 4) return digits.slice(-4);
  }
  return null;
}

export function statementRows(parsed: ParsedTransaction[]) {
  return parsed.map((transaction) => {
    const fields = Object.entries(transaction.raw_data || {});
    const billingValue = fields.find(([header]) => BILLING_DATE_HEADER.test(header))?.[1];
    const transactionValue = fields.find(([header]) => TRANSACTION_DATE_HEADER.test(header))?.[1];
    const transactionDate = transactionValue == null
      ? parseFinancialDate(transaction.transaction_date)
      : parseFinancialDate(String(transactionValue));
    const billingDate = billingValue == null ? "" : parseFinancialDate(String(billingValue));
    const currency = String(transaction.currency || "ILS").trim();
    const isIls = /^(ILS|NIS|₪|שח|ש["״]ח|שקל חדש)$/i.test(currency);
    return {
      ...transaction,
      transaction_date: transactionDate,
      billing_date: billingDate || undefined,
      currency: isIls ? "ILS" : currency,
    };
  }).filter((transaction) => {
    const fields = Object.entries(transaction.raw_data || {});
    const kind = fields.find(([header]) => TRANSACTION_TYPE_HEADER.test(header))?.[1];
    const status = fields.find(([header]) => TRANSACTION_STATUS_HEADER.test(header))?.[1];
    return transaction.transaction_date && transaction.amount > 0 && transaction.direction === "expense" && transaction.currency === "ILS"
      && !/זיכוי|refund|credit/i.test(String(kind || ""))
      && !/בוטל|cancelled|canceled|void/i.test(String(status || ""));
  });
}

export function selectCardRows(parsed: ParsedTransaction[], lastFour: string) {
  const matching: ParsedTransaction[] = [];
  const unidentified: ParsedTransaction[] = [];
  let excluded = 0;
  for (const transaction of parsed) {
    const suffix = cardLastFour(transaction.raw_data);
    if (suffix === lastFour) matching.push(transaction);
    else if (suffix) excluded += 1;
    else unidentified.push(transaction);
  }
  return { matching, unidentified, excluded };
}

export function sanitizeStatementRows(rows: ParsedTransaction[]) {
  return rows.map((transaction) => ({
    ...transaction,
    raw_data: Object.fromEntries(Object.entries(transaction.raw_data || {})
      .filter(([header]) => !SENSITIVE_HEADER.test(header))),
  }));
}

export function futureStatementCharges(
  transactions: StatementChargeInput[],
  accountExternalId: string,
  fromDate: string,
  throughDate: string,
) {
  const charges = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.source_type !== "credit_card_import" || transaction.direction !== "expense") continue;
    const accountId = transaction.account_external_id || (transaction.source_connection_id
      ? `csv-card:${transaction.source_connection_id}` : null);
    if (accountId !== accountExternalId) continue;
    const billingDate = transaction.raw_data?.billing_date;
    if (!billingDate || parseFinancialDate(billingDate) !== billingDate || billingDate < fromDate || billingDate > throughDate) continue;
    charges.set(billingDate, (charges.get(billingDate) || 0) + Math.abs(transaction.amount));
  }
  return [...charges].map(([billingDate, amount]) => ({ billingDate, amount }));
}

export function nextCsvBillingEstimateDate(today: string, billingDay: number) {
  const [year, month] = today.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(Math.trunc(billingDay), 1), lastDay);
  return `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
