import { financeCalendarDate, financeEntryCurrency, type FinanceInsightEntry } from "./financeInsights.ts";
import { getFinanceCategoryGroup } from "./financeCategorization.ts";

type Entry = FinanceInsightEntry & { due_date?: string | null };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (value: string, days: number) => { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
const money = (value: number) => Math.round(value * 100) / 100;

export function summarizeBudgetMovements(entries: Entry[], today = financeCalendarDate(new Date())!) {
  let outgoing = 0, refunds = 0;
  const groups = new Map<string, number>();
  const seen = new Set<string>();
  for (const entry of entries) {
    const date = financeCalendarDate(entry.due_date || entry.created_at);
    if (!entry.paid || entry.hidden || seen.has(entry.id) || !date || date > today || financeEntryCurrency(entry) !== "ILS" || !Number.isFinite(entry.amount) || entry.amount <= 0) continue;
    seen.add(entry.id);
    if (entry.payment_type === "expense") {
      outgoing += Math.round(entry.amount * 100);
      const group = getFinanceCategoryGroup(entry.category);
      groups.set(group, (groups.get(group) || 0) + Math.round(entry.amount * 100));
    } else if (entry.statement_credit || entry.refund_expense_id || entry.refund_category) refunds += Math.round(entry.amount * 100);
  }
  return { outgoing: outgoing / 100, refunds: refunds / 100, net: (outgoing - refunds) / 100,
    categories: [...groups].sort((a, b) => b[1] - a[1]).map(([name, cents]) => ({ name, amount: cents / 100 })) };
}

export function analyzeBudgetPeriod(entries: Entry[], period: "weekly" | "monthly", today = financeCalendarDate(new Date())!) {
  if (!financeCalendarDate(today)) throw new Error("Invalid budget date");
  const date = new Date(`${today}T12:00:00Z`);
  const start = period === "weekly" ? shift(today, -date.getUTCDay()) : `${today.slice(0, 7)}-01`;
  const elapsed = Math.round((Date.parse(today) - Date.parse(start)) / 86400000);
  const previousStart = period === "weekly" ? shift(start, -7) : iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
  const previousEnd = period === "weekly" ? shift(previousStart, elapsed)
    : [shift(previousStart, elapsed), shift(start, -1)].sort()[0];
  const within = (from: string, through: string) => entries.filter(entry => {
    const day = financeCalendarDate(entry.due_date || entry.created_at);
    return day && day >= from && day <= through;
  });
  const current = summarizeBudgetMovements(within(start, today), today);
  const previous = summarizeBudgetMovements(within(previousStart, previousEnd), previousEnd);
  return { ...current, start, end: today, previousNet: previous.net,
    change: previous.net > 0 ? money((current.net - previous.net) / previous.net * 100) : null };
}
