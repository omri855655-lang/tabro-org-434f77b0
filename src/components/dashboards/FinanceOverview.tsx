import { useState } from "react";
import { Building2, ChevronDown, CreditCard, Landmark, Wallet } from "lucide-react";
import { summarizeLiquidBalances } from "@/lib/financeBalances";
import { financeCalendarDate, financeEntryCurrency, formatFinanceMoney } from "@/lib/financeInsights";

interface OverviewEntry {
  id: string;
  title: string;
  amount: number;
  currency?: string | null;
  category: string | null;
  payment_type: "income" | "expense";
  created_at: string;
  paid: boolean;
  hidden?: boolean;
}
interface OverviewAccount {
  external_account_id: string;
  provider_name: string | null;
  account_type: string | null;
  display_name: string | null;
  masked_number: string | null;
  currency: string | null;
  current_balance: number | null;
  available_balance: number | null;
}
interface FinanceOverviewProps {
  entries: OverviewEntry[];
  accounts: OverviewAccount[];
  isRtl: boolean;
  selectedMonth: string;
}

export default function FinanceOverview({ entries, accounts, isRtl, selectedMonth }: FinanceOverviewProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayMonth, setDayMonth] = useState(selectedMonth);
  const activeDay = dayMonth === selectedMonth ? selectedDay : null;
  const today = financeCalendarDate(new Date())!;
  const seen = new Set<string>();
  const actual = entries.filter(entry => {
    const date = financeCalendarDate(entry.created_at);
    if (seen.has(entry.id) || entry.hidden || !entry.paid || !date || date > today || !Number.isFinite(entry.amount) || entry.amount < 0 || financeEntryCurrency(entry) !== "ILS") return false;
    seen.add(entry.id);
    return true;
  });
  const current = actual.filter(entry => financeCalendarDate(entry.created_at)!.startsWith(selectedMonth));
  const sum = (items: OverviewEntry[]) => items.reduce((total, entry) => total + Math.round(entry.amount * 100), 0) / 100;
  const income = sum(current.filter(entry => entry.payment_type === "income"));
  const expenses = sum(current.filter(entry => entry.payment_type === "expense"));
  const incomeMonths = new Map<string, number>();
  actual.filter(entry => entry.payment_type === "income").forEach(entry => {
    const key = financeCalendarDate(entry.created_at)!.slice(0, 7);
    incomeMonths.set(key, (incomeMonths.get(key) || 0) + entry.amount);
  });
  const averageIncome = incomeMonths.size ? [...incomeMonths.values()].reduce((total, value) => total + value, 0) / incomeMonths.size : 0;
  const uniqueAccounts = new Map<string, OverviewAccount>();
  accounts.forEach(account => {
    const key = `${account.provider_name || ""}:${account.external_account_id}`;
    if (!uniqueAccounts.has(key)) uniqueAccounts.set(key, account);
  });
  const accountList = [...uniqueAccounts.values()];
  const liquid = summarizeLiquidBalances(accountList);
  const hasLiquidBalance = accountList.some(account => account.account_type?.toUpperCase() !== "CARD"
    && (!account.currency || account.currency === "ILS")
    && (account.available_balance ?? account.current_balance) != null
    && Number.isFinite(account.available_balance ?? account.current_balance));
  const money = (value: number, currency = "ILS") => formatFinanceMoney(value, currency, isRtl ? "he-IL" : "en-US");
  const monthDate = new Date(`${selectedMonth}-01T12:00:00Z`);
  const previousMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const previous = actual.filter(entry => financeCalendarDate(entry.created_at)!.startsWith(previousMonth));
  const previousIncome = sum(previous.filter(entry => entry.payment_type === "income"));
  const previousExpenses = sum(previous.filter(entry => entry.payment_type === "expense"));
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const expensesByDay = new Map<number, number>();
  current.filter(entry => entry.payment_type === "expense").forEach(entry => {
    const day = Number(financeCalendarDate(entry.created_at)!.slice(8, 10));
    expensesByDay.set(day, (expensesByDay.get(day) || 0) + entry.amount);
  });
  const maxDaySpend = Math.max(...expensesByDay.values(), 1);
  const recent = [...actual].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  const selectedTransactions = current.filter(entry => Number(financeCalendarDate(entry.created_at)!.slice(8, 10)) === activeDay);
  const detailClass = "group rounded-2xl border bg-background open:shadow-sm";
  const summaryClass = "flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden";

  return <section className="space-y-4" dir={isRtl ? "rtl" : "ltr"} aria-label={isRtl ? "סיכום כספי" : "Financial summary"}>
    <div className="space-y-3 rounded-3xl border bg-background p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{monthDate.toLocaleDateString(isRtl ? "he-IL" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{isRtl ? "תנועות ששולמו · שקלים" : "Paid transactions · ILS"}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: isRtl ? "הכנסות וזיכויים" : "Income & credits", value: income, color: "text-emerald-700 dark:text-emerald-400", background: "bg-emerald-50/60 dark:bg-emerald-950/20" },
          { label: isRtl ? "הוצאות לפני זיכויים" : "Spending before refunds", value: expenses, color: "text-rose-700 dark:text-rose-400", background: "bg-rose-50/50 dark:bg-rose-950/20" },
          { label: isRtl ? "הפרש תנועות בתקופה" : "Period transaction difference", value: income - expenses, color: "text-foreground", background: "bg-muted/40" },
        ].map(item => <div key={item.label} className={`flex items-center justify-between gap-3 rounded-2xl p-4 sm:block ${item.background}`}><p className="text-xs text-muted-foreground">{item.label}</p><strong className={`block text-xl tabular-nums sm:mt-2 sm:text-2xl ${item.color}`}>{money(item.value)}</strong></div>)}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{isRtl ? "הפרש התנועות אינו יתרת הבנק. מטבעות אחרים מופיעים בנפרד בפילוחים; חיוב בנק מרוכז אינו מקוזז אוטומטית מפירוט הכרטיס." : "The transaction difference is not your bank balance. Other currencies are separate in insights; bank settlements are not automatically netted against card purchases."}</p>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200/60 bg-sky-50/40 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-background p-2.5"><Wallet className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden="true" /></span><div><p className="text-sm font-semibold">{isRtl ? "יתרה נזילה מדווחת" : "Reported liquid balance"}</p><p className="text-xs text-muted-foreground">{isRtl ? "חשבונות שקליים בלבד, ללא מסגרת כרטיס" : "ILS accounts only, excluding card limits"}</p></div></div>
      <strong className="text-xl tabular-nums">{hasLiquidBalance ? money(liquid.liquid) : (isRtl ? "אין נתון זמין" : "No balance available")}</strong>
    </div>

    <div className="grid items-start gap-3 sm:grid-cols-2">
      <details className={detailClass}>
        <summary className={summaryClass}><span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{isRtl ? "חשבונות ויתרות" : "Accounts & balances"} <span className="text-xs font-normal text-muted-foreground">({accountList.length})</span></span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="space-y-2 border-t p-4">
          {accountList.map(account => {
            const isCard = account.account_type?.toUpperCase() === "CARD";
            const value = account.available_balance ?? account.current_balance;
            const currency = financeEntryCurrency(account);
            return <div key={`${account.provider_name}:${account.external_account_id}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3 text-sm"><span className="flex min-w-0 items-center gap-2">{isCard ? <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />}<span className="min-w-0"><strong className="block break-words">{account.display_name || account.provider_name || (isRtl ? "חשבון" : "Account")}</strong><small className="text-muted-foreground">{account.masked_number || account.provider_name}</small></span></span><span className="text-end"><strong>{value != null && Number.isFinite(value) ? money(value, currency) : (isRtl ? "לא דווח" : "Not reported")}</strong>{isCard && <small className="block text-[10px] text-muted-foreground">{isRtl ? "נתון ספק, לא סכום לפירעון" : "Provider value, not amount due"}</small>}</span></div>;
          })}
          {!accountList.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין חשבונות מחוברים להצגה. אפשר להוסיף מקור בבנק ואשראי." : "No connected accounts. Add a source in Bank & cards."}</p>}
          {hasLiquidBalance && <p className="text-xs text-muted-foreground">{isRtl ? "יתרות חיוביות" : "Positive balances"}: {money(liquid.available)} · {isRtl ? "מינוס בחשבונות" : "Account overdraft"}: {money(liquid.debt)}</p>}
        </div>
      </details>
      <details className={detailClass}>
        <summary className={summaryClass}><span>{isRtl ? "מפת הוצאות ופעילות אחרונה" : "Spending map & recent activity"}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="space-y-4 border-t p-4">
          <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold">{isRtl ? "מפת ימי ההוצאה בחודש שנבחר" : "Daily spending in selected month"}</h4>{activeDay && <button type="button" className="text-xs text-primary" onClick={() => setSelectedDay(null)}>{isRtl ? "נקה בחירה" : "Clear"}</button>}</div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: monthDate.getUTCDay() }, (_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const amount = expensesByDay.get(day) || 0;
              return <button key={day} type="button" aria-label={`${day}: ${money(amount)}`} aria-pressed={activeDay === day} onClick={() => { setDayMonth(selectedMonth); setSelectedDay(day); }} className={`aspect-square rounded-lg border text-xs focus-visible:ring-2 focus-visible:ring-ring ${activeDay === day ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: amount ? `hsl(4 78% ${92 - amount / maxDaySpend * 38}%)` : "hsl(var(--muted) / 0.45)", color: amount ? "#311313" : undefined }}>{day}</button>;
            })}
          </div>
          {activeDay && <div className="space-y-2">{selectedTransactions.map(entry => <div key={entry.id} className="flex justify-between gap-2 text-xs"><span>{entry.title}</span><strong className="shrink-0">{entry.payment_type === "income" ? "+" : "-"}{money(entry.amount)}</strong></div>)}{!selectedTransactions.length && <p className="text-xs text-muted-foreground">{isRtl ? "אין תנועות ביום הזה." : "No transactions on this day."}</p>}</div>}
          <div className="border-t pt-3"><h4 className="mb-2 text-xs font-semibold">{isRtl ? "תנועות אחרונות מכל התקופות · שקלים" : "Recent transactions across all periods · ILS"}</h4><div className="max-h-64 divide-y overflow-auto">{recent.map(entry => <div key={entry.id} className="flex justify-between gap-2 py-2 text-xs"><span className="min-w-0"><strong className="block truncate">{entry.title}</strong><span className="text-muted-foreground">{financeCalendarDate(entry.created_at)} · {entry.category || (isRtl ? "אחר" : "Other")}</span></span><strong className={`shrink-0 ${entry.payment_type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{entry.payment_type === "income" ? "+" : "-"}{money(entry.amount)}</strong></div>)}</div>{!recent.length && <p className="text-xs text-muted-foreground">{isRtl ? "אין תנועות להצגה." : "No transactions to show."}</p>}</div>
          <p className="text-xs text-muted-foreground">{isRtl ? "ממוצע הכנסות וזיכויים בחודשים עם נתוני הכנסה" : "Average income & credits in months with income data"}: {money(averageIncome)}</p>
          <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground"><h4 className="font-semibold text-foreground">{isRtl ? "נתוני החודש הקודם" : "Previous month totals"} · {previousMonth}</h4><p>{isRtl ? "הכנסות וזיכויים" : "Income & credits"}: {money(previousIncome)}</p><p>{isRtl ? "הוצאות לפני זיכויים" : "Spending before refunds"}: {money(previousExpenses)}</p><p>{isRtl ? "הפרש תנועות" : "Transaction difference"}: {money(previousIncome - previousExpenses)}</p><p>{isRtl ? "הסכומים כוללים רק נתונים ששולמו וזמינים. השוואת הוצאות לתקופה מקבילה נמצאת בפילוחים." : "Only available paid entries are included. Like-for-like spending comparisons are in Insights."}</p></div>
        </div>
      </details>
    </div>
  </section>;
}
