import { financeCalendarDate, financeEntryCurrency } from "./financeInsights.ts";

export interface CashflowCardAccount {
  id: string;
  external_account_id: string;
  provider_name: string | null;
  account_type: string | null;
  display_name: string | null;
  masked_number: string | null;
  currency: string | null;
  last_synced_at?: string | null;
  backend?: "legacy" | "cloud";
  connection_id?: string | null;
}

export interface CardCashflowTransaction {
  id: string;
  source_type: string;
  source_connection_id?: string | null;
  account_external_id?: string | null;
  transaction_date: string;
  posted_date?: string | null;
  created_at: string;
  direction: string;
  amount: number;
  currency?: string | null;
  hidden?: boolean;
  backend?: "legacy" | "cloud";
  raw_data?: { account_external_id?: string | null; billing_date?: string | null; statement_credit?: boolean; status?: string | null } | null;
}

export interface CardCashflowCharge {
  date: string;
  amount: number;
  credit: number;
  estimated: boolean;
  transactions: number;
}

export interface CardCashflow {
  key: string;
  account: CashflowCardAccount;
  charges: CardCashflowCharge[];
  undated: number;
  foreignCurrencies: string[];
  billingDay?: number;
}

export function cardIssuer(value: string | null) {
  const name = (value || "").toLowerCase();
  if (/amex|american|אמריקן/.test(name)) return "amex";
  if (/isracard|ישראכרט|ישראקארט/.test(name)) return "isracard";
  if (/visa.?cal|^cal$|כאל/.test(name)) return "cal";
  if (/^max$|מקס/.test(name)) return "max";
  return name;
}

export function cashflowCardKey(account: CashflowCardAccount) {
  const suffix = account.masked_number?.match(/\d{4}$/)?.[0];
  return `${cardIssuer(account.provider_name)}:${suffix || account.external_account_id}:${financeEntryCurrency(account)}`;
}

function inferredBillingDate(purchase: string, billingDay: number) {
  const [year, month, day] = purchase.split("-").map(Number);
  const candidate = (offset: number) => {
    const first = new Date(Date.UTC(year, month - 1 + offset, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(billingDay, last));
    return first.toISOString().slice(0, 10);
  };
  return day < Number(candidate(0).slice(8)) ? candidate(0) : candidate(1);
}

/** Never repeat a card balance monthly or multiply a charge by its installment count. */
export function buildCardCashflows(
  accounts: CashflowCardAccount[], transactions: CardCashflowTransaction[],
  from: string, through: string, billingDays: Record<string, number> = {},
): CardCashflow[] {
  const groups = new Map<string, CashflowCardAccount[]>();
  const cutoff = new Date(`${from}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 31);
  const oldestUndatedPurchase = cutoff.toISOString().slice(0, 10);
  for (const account of accounts) {
    if (account.account_type?.toUpperCase() !== "CARD") continue;
    const key = cashflowCardKey(account);
    groups.set(key, [...(groups.get(key) || []), account]);
  }
  return [...groups].map(([key, sources]) => {
    const matches = (account: CashflowCardAccount, row: CardCashflowTransaction) => {
      const external = row.account_external_id || row.raw_data?.account_external_id
        || (row.source_type === "credit_card_import" ? `csv-card:${row.source_connection_id}` : null);
      return external === account.external_account_id && (!row.backend || !account.backend || row.backend === account.backend)
        && (!account.connection_id || !row.source_connection_id || account.connection_id === row.source_connection_id);
    };
    const sourceTime = (account: CashflowCardAccount) => Math.max(
      new Date(account.last_synced_at || 0).getTime() || 0,
      ...transactions.filter(row => matches(account, row)).map(row => new Date(row.created_at).getTime() || 0),
    );
    const account = [...sources].sort((a, b) => sourceTime(b) - sourceTime(a))[0];
    const preference = `${account.provider_name || "card"}:${account.external_account_id}`;
    const selectedDay = billingDays[key] ?? billingDays[preference];
    const billingDay = Number.isInteger(selectedDay) && selectedDay >= 1 && selectedDay <= 31 ? selectedDay : undefined;
    const dated = new Map<string, { cents: number; estimated: boolean; transactions: number }>();
    const seen = new Set<string>();
    const foreign = new Set<string>();
    let undated = 0;
    for (const row of transactions) {
      if (!matches(account, row) || row.hidden || seen.has(row.id) || !Number.isFinite(row.amount) || row.amount <= 0) continue;
      seen.add(row.id);
      if (/cancelled|canceled|void|בוטל/i.test(row.raw_data?.status || "")) continue;
      if (row.direction !== "expense" && !(row.direction === "income"
        && (row.source_type === "cloud_scraper" || row.raw_data?.statement_credit))) continue;
      const currency = financeEntryCurrency(row);
      const posted = financeCalendarDate(row.posted_date || "");
      // Some issuers use processedDate for purchase processing, not the debit cycle.
      // A past processing date must not override a user-selected future estimate.
      const explicit = financeCalendarDate(row.raw_data?.billing_date || "")
        || (row.source_type === "cloud_scraper" && posted && posted >= from ? posted : null);
      const purchase = financeCalendarDate(row.transaction_date);
      if (!explicit && purchase && purchase < oldestUndatedPurchase) continue;
      const date = explicit || (purchase && billingDay ? inferredBillingDate(purchase, billingDay) : null);
      if (date && (date < from || date > through)) continue;
      if (currency !== "ILS" || financeEntryCurrency(account) !== "ILS") { foreign.add(currency); continue; }
      if (!date) { undated += 1; continue; }
      const group = dated.get(date) || { cents: 0, estimated: false, transactions: 0 };
      group.cents += Math.round(row.amount * 100) * (row.direction === "income" ? -1 : 1);
      group.estimated ||= !explicit;
      group.transactions += 1;
      dated.set(date, group);
    }
    return {
      key, account, billingDay, undated, foreignCurrencies: [...foreign],
      charges: [...dated].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
        date, amount: Math.max(0, value.cents) / 100, credit: Math.max(0, -value.cents) / 100,
        estimated: value.estimated, transactions: value.transactions,
      })),
    };
  });
}
