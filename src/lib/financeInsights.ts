import { cleanMerchantName, getFinanceCategoryGroup } from "./financeCategorization.ts";

export interface FinanceInsightEntry {
  id: string;
  title: string;
  amount: number;
  currency?: string | null;
  category: string | null;
  subcategory: string | null;
  payment_type: "income" | "expense";
  source_channel: "credit_card" | "bank" | "manual";
  account_label: string | null;
  account_last_four: string | null;
  account_external_id?: string | null;
  payment_method: string | null;
  created_at: string;
  recurring: boolean;
  paid: boolean;
  hidden?: boolean;
  installment_total?: number | null;
}

const calendar = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
});

export function financeCalendarDate(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  if (typeof value === "string" && !financeCalendarDate(value.slice(0, 10))) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function financeEntryCurrency(entry: Pick<FinanceInsightEntry, "currency">) {
  const value = entry.currency?.trim().toUpperCase();
  return !value ? "ILS" : /^[A-Z]{3}$/.test(value) ? value : "UNKNOWN";
}

export function formatFinanceMoney(value: number, currency: string, locale = "he-IL") {
  if (currency === "UNKNOWN") return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} (${locale.startsWith("he") ? "מטבע לא מזוהה" : "unknown currency"})`;
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (entries: FinanceInsightEntry[]) => entries.reduce((total, entry) => total + Math.round(entry.amount * 100), 0) / 100;
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
const monthFromIndex = (index: number) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const day = (date: string) => Number(date.slice(8, 10));
const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

function identity(entry: FinanceInsightEntry) {
  const merchant = cleanMerchantName(entry.title).normalize("NFKC").toLowerCase()
    .replace(/[\u200e\u200f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const account = entry.account_external_id || (entry.account_last_four
    ? `${entry.account_label || entry.payment_method}:${entry.account_last_four}` : null);
  if (!merchant || merchant === "עסקה ללא שם" || (entry.source_channel !== "manual" && !account)) return null;
  return JSON.stringify([merchant, entry.source_channel, entry.payment_method, account, financeEntryCurrency(entry)]);
}

function mayBeSubscription(entry: FinanceInsightEntry) {
  if (entry.recurring || Number(entry.installment_total) > 1) return false;
  if (/תשלום\s*\d+\s*(?:מתוך|\/|מ-)\s*\d+|\binstallment\b/i.test(entry.title)) return false;
  // A bank settlement is not a new merchant subscription. Keep it in the ledger.
  return !(entry.source_channel === "bank" && /כרטיס.*אשראי|ישראכרט|כאל|אמריקן|\b(?:amex|isracard|max|visa|credit card)\b/i.test(`${entry.title} ${entry.category || ""}`));
}

function recurringEvidence(entries: FinanceInsightEntry[], asOf: string) {
  const groups = new Map<string, FinanceInsightEntry[]>();
  for (const entry of entries) {
    if (!mayBeSubscription(entry)) continue;
    const key = identity(entry);
    if (key) {
      const group = groups.get(key);
      if (group) group.push(entry); else groups.set(key, [entry]);
    }
  }
  const candidates = [];
  for (const [key, history] of groups) {
    const ordered = [...history].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const byMonth = new Map<string, FinanceInsightEntry[]>();
    ordered.forEach(entry => {
      const month = entry.created_at.slice(0, 7);
      const group = byMonth.get(month);
      if (group) group.push(entry); else byMonth.set(month, [entry]);
    });
    const latest = ordered[0];
    const latestMonth = monthIndex(latest.created_at);
    if (monthIndex(asOf) - latestMonth > 1) continue;
    const samples: FinanceInsightEntry[] = [];
    // Require one actual charge in each consecutive calendar month, not just
    // several visits to a merchant. Ambiguous/duplicate months stop the evidence.
    for (let index = latestMonth; samples.length < 6; index--) {
      const items = byMonth.get(monthFromIndex(index));
      if (items?.length !== 1) break;
      samples.push(items[0]);
    }
    if (samples.length < 3) continue;
    const days = samples.map(entry => day(entry.created_at));
    const monthEnd = samples.every(entry => daysInMonth(entry.created_at.slice(0, 7)) - day(entry.created_at) <= 3);
    if (!monthEnd && Math.max(...days) - Math.min(...days) > 4) continue;
    const amounts = samples.map(entry => entry.amount);
    const typical = median(amounts);
    const stable = Math.max(...amounts) - Math.min(...amounts) <= Math.max(1, typical * 0.15);
    const previous = median(amounts.slice(1));
    const previousStable = Math.max(...amounts.slice(1)) - Math.min(...amounts.slice(1)) <= Math.max(1, previous * 0.15);
    const increase = previousStable && latest.amount - previous >= Math.max(5, previous * 0.2);
    if (!stable && !increase) continue;
    const nextMonth = monthFromIndex(latestMonth + 1);
    const expectedDay = monthEnd ? daysInMonth(nextMonth) : Math.min(Math.round(median(days)), daysInMonth(nextMonth));
    candidates.push({
      key, name: cleanMerchantName(latest.title), entry: latest,
      historyIds: history.map(entry => entry.id), months: samples.length,
      average: round(typical), previousAmount: round(previous),
      increase: increase ? round(latest.amount - previous) : null,
      nextExpectedDate: `${nextMonth}-${String(expectedDay).padStart(2, "0")}`,
    });
  }
  return candidates.sort((a, b) => b.months - a.months || b.average - a.average);
}

export function analyzeFinanceInsights(entries: FinanceInsightEntry[], selectedMonth: string, currency = "ILS", now = new Date()) {
  const today = financeCalendarDate(now);
  if (!today || !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) throw new Error("Invalid finance analysis period");
  const monthEnd = `${selectedMonth}-${daysInMonth(selectedMonth)}`;
  const asOf = monthEnd < today ? monthEnd : today;
  const comparableDays = selectedMonth === today.slice(0, 7) ? day(today) : selectedMonth > today.slice(0, 7) ? 0 : daysInMonth(selectedMonth);
  const previousMonth = monthFromIndex(monthIndex(selectedMonth) - 1);
  const previousDays = selectedMonth < today.slice(0, 7) ? daysInMonth(previousMonth) : Math.min(comparableDays, daysInMonth(previousMonth));
  let invalidCount = 0;
  const seen = new Set<string>();
  const actual = entries.flatMap(entry => {
    if (!entry.paid || entry.hidden || financeEntryCurrency(entry) !== currency || seen.has(entry.id)) return [];
    seen.add(entry.id);
    const date = financeCalendarDate(entry.created_at);
    if (!date || !Number.isFinite(entry.amount) || entry.amount <= 0) { invalidCount++; return []; }
    return date <= asOf ? [{ ...entry, created_at: date }] : [];
  });
  const expenses = actual.filter(entry => entry.payment_type === "expense");
  const currentExpenses = expenses.filter(entry => entry.created_at.startsWith(selectedMonth));
  const previousExpenses = expenses.filter(entry => entry.created_at.startsWith(previousMonth) && day(entry.created_at) <= previousDays);
  const currentIncome = sum(actual.filter(entry => entry.payment_type === "income" && entry.created_at.startsWith(selectedMonth)));
  const currentSpend = sum(currentExpenses);
  const previousSpend = sum(previousExpenses);
  const categories = new Map<string, { total: number; subcategories: Map<string, number> }>();
  const merchants = new Map<string, number>();
  const channels = new Map<FinanceInsightEntry["source_channel"], number>();
  const cards = new Map<string, number>();
  for (const entry of currentExpenses) {
    const category = getFinanceCategoryGroup(entry.category);
    const group = categories.get(category) || { total: 0, subcategories: new Map<string, number>() };
    group.total = round(group.total + entry.amount);
    const subcategory = entry.subcategory || entry.category || "אחר";
    group.subcategories.set(subcategory, round((group.subcategories.get(subcategory) || 0) + entry.amount));
    categories.set(category, group);
    const merchant = cleanMerchantName(entry.title);
    merchants.set(merchant, round((merchants.get(merchant) || 0) + entry.amount));
    channels.set(entry.source_channel, round((channels.get(entry.source_channel) || 0) + entry.amount));
    if (entry.source_channel === "credit_card") {
      const card = [entry.account_label || entry.payment_method || "כרטיס אשראי", entry.account_last_four ? `•••• ${entry.account_last_four}` : ""].filter(Boolean).join(" ");
      cards.set(card, round((cards.get(card) || 0) + entry.amount));
    }
  }
  return {
    currentIncome, currentSpend, previousSpend, comparableDays, previousDays, previousMonth, invalidCount,
    asOf, comparisonIsPartial: selectedMonth === today.slice(0, 7),
    change: previousSpend > 0 && comparableDays > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : null,
    topCategories: [...categories].sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([name, value]) => ({
      name, total: value.total, subcategories: [...value.subcategories].sort((a, b) => b[1] - a[1]).slice(0, 4),
    })),
    topMerchants: [...merchants].sort((a, b) => b[1] - a[1]).slice(0, 5),
    channelTotals: [...channels].sort((a, b) => b[1] - a[1]),
    cardTotals: [...cards].sort((a, b) => b[1] - a[1]),
    uncategorized: currentExpenses.filter(entry => !entry.category || ["אחר", "other"].includes(entry.category.toLowerCase())).length,
    recurring: recurringEvidence(expenses, asOf),
    dailyAverage: comparableDays > 0 ? currentSpend / comparableDays : 0,
  };
}
