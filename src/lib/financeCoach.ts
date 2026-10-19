import { analyzeFinanceInsights, financeCalendarDate, financeEntryCurrency, type FinanceInsightEntry } from "./financeInsights.ts";
import { getFinanceCategoryGroup } from "./financeCategorization.ts";

const cents = (amount: number) => Math.round(amount * 100);
const merchantKey = (entry: FinanceInsightEntry) => entry.title.normalize("NFKC").toLowerCase()
  .replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
const scope = (entry: FinanceInsightEntry) => entry.account_external_id
  ? JSON.stringify([entry.account_external_id, entry.payment_method, financeEntryCurrency(entry)]) : null;
const isCredit = (entry: FinanceInsightEntry) => entry.payment_type === "income" && entry.statement_credit === true;
const category = (entry: FinanceInsightEntry) => getFinanceCategoryGroup(entry.category);
const isSettlement = (entry: FinanceInsightEntry) => entry.source_channel === "bank"
  && /כרטיס.*אשראי|ישראכרט|כאל|אמריקן|\b(?:amex|isracard|max|visa|credit card)\b/i.test(`${entry.title} ${entry.category || ""}`);
const flexible = (entry: FinanceInsightEntry) => {
  if (entry.recurring || Number(entry.installment_total) > 1) return false;
  const group = getFinanceCategoryGroup(entry.category);
  if (group === "מזון") return entry.subcategory === "מסעדות ובתי קפה";
  return ["קניות", "בילויים"].includes(group)
    && ["אופנה", "קניות אונליין", "מנויים דיגיטליים", "תרבות וכרטיסים", "קניות", "בילויים"]
      .includes(entry.subcategory || entry.category || "");
};

export const REFUND_CATEGORY_OPTIONS = ["מזון", "תחבורה", "דיור", "חשבונות", "ביטוחים ופיננסים", "בריאות", "חינוך", "בילויים", "קניות", "נסיעות ואירוח", "עמלות ומסים"];
export type RefundSelection = { expenseId: string } | { category: string } | { clear: true };
interface RefundReview {
  credit: FinanceInsightEntry;
  expense?: FinanceInsightEntry;
  status: "confirmed" | "categorized" | "suggested" | "unmatched";
  category?: string;
}

function validEntries(entries: FinanceInsightEntry[], asOf: string, currency: string) {
  const seen = new Set<string>();
  return entries.flatMap(entry => {
    if (seen.has(entry.id) || entry.hidden || !entry.paid || financeEntryCurrency(entry) !== currency
      || !Number.isFinite(entry.amount) || entry.amount <= 0) return [];
    const date = financeCalendarDate(entry.created_at);
    if (!date || date > asOf) return [];
    seen.add(entry.id);
    return [{ ...entry, created_at: date }];
  });
}

function compatible(credit: FinanceInsightEntry, expense: FinanceInsightEntry) {
  return isCredit(credit) && expense.payment_type === "expense" && Boolean(scope(credit))
    && scope(credit) === scope(expense) && expense.created_at <= credit.created_at;
}

export function reconcileFinanceRefunds(entries: FinanceInsightEntry[]) {
  const expenses = entries.filter(entry => entry.payment_type === "expense");
  const byId = new Map(expenses.map(entry => [entry.id, entry]));
  const allocated = new Map<string, number>();
  const credits = entries.filter(isCredit).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const results: RefundReview[] = credits.map(credit => {
    if (!credit.refund_expense_id && credit.refund_category && REFUND_CATEGORY_OPTIONS.includes(credit.refund_category)) {
      return { credit, status: "categorized", category: credit.refund_category };
    }
    const expense = credit.refund_expense_id ? byId.get(credit.refund_expense_id) : undefined;
    if (expense && compatible(credit, expense)) {
      const total = (allocated.get(expense.id) || 0) + cents(credit.amount);
      if (total <= cents(expense.amount)) {
        allocated.set(expense.id, total);
        return { credit, expense, status: "confirmed", category: category(expense) };
      }
    }
    return { credit, status: "unmatched" };
  });
  // Reserve capacity only for confirmed links. A similar merchant is a suggestion,
  // never permission to rewrite an expense or persist a link automatically.
  for (const result of results) {
    if (result.status === "confirmed" || result.status === "categorized") continue;
    const earliest = new Date(`${result.credit.created_at}T12:00:00Z`);
    earliest.setUTCDate(earliest.getUTCDate() - 180);
    const candidates = expenses.filter(expense => compatible(result.credit, expense)
      && expense.created_at >= earliest.toISOString().slice(0, 10)
      && merchantKey(expense) === merchantKey(result.credit)
      && cents(result.credit.amount) <= cents(expense.amount) - (allocated.get(expense.id) || 0));
    if (candidates.length === 1) { result.expense = candidates[0]; result.status = "suggested"; }
  }
  return results;
}

export function canConfirmFinanceRefund(entries: FinanceInsightEntry[], creditId: string, selection: RefundSelection, now = new Date()) {
  const today = financeCalendarDate(now);
  if (!today) return false;
  const credit = entries.find(entry => entry.id === creditId);
  if (!credit) return false;
  const valid = validEntries(entries, today, financeEntryCurrency(credit));
  const proposed = reconcileFinanceRefunds(valid).find(item => item.credit.id === creditId);
  if ("clear" in selection) return Boolean(proposed && (proposed.credit.refund_expense_id || proposed.credit.refund_category));
  if (!proposed || proposed.status === "confirmed" || proposed.status === "categorized") return false;
  if ("category" in selection) return REFUND_CATEGORY_OPTIONS.includes(selection.category);
  return proposed.status === "suggested" && proposed.expense?.id === selection.expenseId;
}

export function buildFinanceCoach(entries: FinanceInsightEntry[], month: string, currency = "ILS", now = new Date()) {
  const analysis = analyzeFinanceInsights(entries, month, currency, now);
  const actual = validEntries(entries, analysis.asOf, currency);
  const current = actual.filter(entry => entry.created_at.startsWith(month));
  const refunds = reconcileFinanceRefunds(actual).filter(item => item.credit.created_at.startsWith(month));
  const unresolved = refunds.filter(item => item.status !== "confirmed" && item.status !== "categorized");
  const refundsCents = refunds.reduce((total, item) => total + cents(item.credit.amount), 0);
  const realIncome = current.filter(entry => entry.payment_type === "income" && !isCredit(entry))
    .reduce((total, entry) => total + cents(entry.amount), 0) / 100;
  const netCategories = new Map<string, number>();
  const flexibleCategories = new Map<string, number>();
  for (const entry of current.filter(entry => entry.payment_type === "expense")) {
    netCategories.set(category(entry), (netCategories.get(category(entry)) || 0) + cents(entry.amount));
    if (flexible(entry)) flexibleCategories.set(category(entry), (flexibleCategories.get(category(entry)) || 0) + cents(entry.amount));
  }
  for (const item of refunds) {
    if (!item.category || (item.status !== "confirmed" && item.status !== "categorized")) continue;
    const key = item.category;
    netCategories.set(key, (netCategories.get(key) || 0) - cents(item.credit.amount));
    if (item.expense ? flexible(item.expense) : true) flexibleCategories.set(key, (flexibleCategories.get(key) || 0) - cents(item.credit.amount));
  }
  const hasSettlements = current.some(entry => entry.payment_type === "expense" && isSettlement(entry));
  const uncategorized = current.filter(entry => entry.payment_type === "expense" && ["אחר", "other", ""].includes((entry.category || "").toLowerCase())).length;
  const reliableForScenario = currency !== "UNKNOWN" && !hasSettlements && unresolved.length === 0 && uncategorized === 0;
  return {
    month, currency, asOf: analysis.asOf, partial: analysis.comparisonIsPartial,
    grossSpend: analysis.currentSpend, refundsTotal: refundsCents / 100,
    netSpend: (cents(analysis.currentSpend) - refundsCents) / 100, realIncome,
    refunds, unresolvedCount: unresolved.length, hasSettlements, uncategorized,
    netCategories: [...netCategories].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount: amount / 100 })),
    // This is a user-selected what-if, not a claim that spending is unnecessary.
    scenarioCategories: reliableForScenario ? [...flexibleCategories].filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount: amount / 100 })) : [],
    recurringReviewCount: analysis.recurring.filter(item => !refunds.some(refund => scope(refund.credit) === scope(item.entry)
      && merchantKey(refund.credit) === merchantKey(item.entry))).length,
  };
}

export type FinanceCoachAnalysis = ReturnType<typeof buildFinanceCoach>;
