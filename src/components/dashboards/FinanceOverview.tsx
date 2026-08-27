import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, CreditCard, Landmark, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OverviewEntry {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  payment_type: "income" | "expense";
  source_channel: "credit_card" | "bank" | "manual";
  account_label: string | null;
  account_last_four: string | null;
  created_at: string;
  paid: boolean;
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
}

const money = (value: number, currency = "ILS") => new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency,
  maximumFractionDigits: 0,
}).format(value);

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

const FinanceOverview = ({ entries, accounts, isRtl }: FinanceOverviewProps) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const analysis = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now);
    const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const actual = entries.filter((entry) => entry.paid);
    const current = actual.filter((entry) => monthKey(new Date(entry.created_at)) === currentKey);
    const previous = actual.filter((entry) => monthKey(new Date(entry.created_at)) === previousKey);
    const summarize = (items: OverviewEntry[]) => {
      const income = items.filter((entry) => entry.payment_type === "income").reduce((sum, entry) => sum + entry.amount, 0);
      const expenses = items.filter((entry) => entry.payment_type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
      return { income, expenses, net: income - expenses };
    };
    const currentSummary = summarize(current);
    const previousSummary = summarize(previous);
    const monthlyIncome = new Map<string, number>();
    actual.filter((entry) => entry.payment_type === "income").forEach((entry) => {
      const key = monthKey(new Date(entry.created_at));
      monthlyIncome.set(key, (monthlyIncome.get(key) || 0) + entry.amount);
    });
    const averageIncome = monthlyIncome.size
      ? [...monthlyIncome.values()].reduce((sum, amount) => sum + amount, 0) / monthlyIncome.size
      : 0;

    const uniqueAccounts = new Map<string, OverviewAccount>();
    accounts.forEach((account) => {
      const key = `${account.provider_name || ""}:${account.external_account_id}`;
      if (!uniqueAccounts.has(key)) uniqueAccounts.set(key, account);
    });
    const accountList = [...uniqueAccounts.values()];
    let available = 0;
    let debt = 0;
    accountList.filter((account) => !account.currency || account.currency === "ILS").forEach((account) => {
      const value = account.available_balance ?? account.current_balance ?? 0;
      if (account.account_type?.toUpperCase() === "CARD") debt += Math.abs(value);
      else if (value >= 0) available += value;
      else debt += Math.abs(value);
    });

    const expensesByDay = new Map<number, number>();
    current.filter((entry) => entry.payment_type === "expense").forEach((entry) => {
      const day = new Date(entry.created_at).getDate();
      expensesByDay.set(day, (expensesByDay.get(day) || 0) + entry.amount);
    });
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const maxDaySpend = Math.max(...expensesByDay.values(), 1);
    const heatmap = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      amount: expensesByDay.get(index + 1) || 0,
    }));
    const recent = [...actual].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);
    const selectedTransactions = selectedDay
      ? current.filter((entry) => new Date(entry.created_at).getDate() === selectedDay)
      : [];

    return { currentSummary, previousSummary, averageIncome, accountList, available, debt, heatmap, firstDay, maxDaySpend, recent, selectedTransactions };
  }, [accounts, entries, selectedDay]);

  const percentageChange = (current: number, previous: number) => previous > 0 ? ((current - previous) / previous) * 100 : null;
  const incomeChange = percentageChange(analysis.currentSummary.income, analysis.previousSummary.income);
  const expenseChange = percentageChange(analysis.currentSummary.expenses, analysis.previousSummary.expenses);
  const liquidNet = analysis.available - analysis.debt;
  const availableShare = analysis.available + analysis.debt > 0 ? (analysis.available / (analysis.available + analysis.debt)) * 100 : 100;

  return (
    <section className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-xl">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs text-sky-200">{isRtl ? "מצב נזיל" : "Liquid position"}</p><strong className="mt-1 block text-4xl">{money(liquidNet)}</strong></div>
              <div className="rounded-2xl bg-white/10 p-3"><Wallet className="h-6 w-6 text-sky-200" /></div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-red-400/80"><div className="h-full bg-emerald-400" style={{ width: `${availableShare}%` }} /></div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-emerald-300">● {isRtl ? "כסף זמין" : "Available"} {money(analysis.available)}</span>
              <span className="text-red-300">● {isRtl ? "אשראי ומינוס" : "Credit and overdraft"} {money(analysis.debt)}</span>
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{isRtl ? "חשבונות" : "Accounts"}</h3><Building2 className="h-4 w-4 text-primary" /></div>
          <div className="max-h-52 space-y-2 overflow-y-auto pe-1">
            {analysis.accountList.map((account) => {
              const isCard = account.account_type?.toUpperCase() === "CARD";
              const value = account.available_balance ?? account.current_balance ?? 0;
              return <div key={`${account.provider_name}:${account.external_account_id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">{isCard ? <CreditCard className="h-4 w-4 text-violet-500" /> : <Landmark className="h-4 w-4 text-sky-500" />}<span className="min-w-0"><strong className="block truncate">{account.display_name || account.provider_name || (isRtl ? "חשבון" : "Account")}</strong><small className="text-muted-foreground">{account.masked_number || account.provider_name}</small></span></span>
                <strong className={isCard || value < 0 ? "text-red-600" : "text-emerald-600"}>{money(value, account.currency || "ILS")}</strong>
              </div>;
            })}
            {!analysis.accountList.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין חשבונות מחוברים להצגה." : "No connected accounts to show."}</p>}
          </div>
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{isRtl ? "החודש" : "This month"}</h3><span className="text-xs text-muted-foreground">{isRtl ? "מול החודש הקודם" : "vs previous month"}</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: isRtl ? "נטו" : "Net", value: analysis.currentSummary.net, change: percentageChange(analysis.currentSummary.net, analysis.previousSummary.net) },
            { label: isRtl ? "הכנסות" : "Income", value: analysis.currentSummary.income, change: incomeChange },
            { label: isRtl ? "הוצאות" : "Expenses", value: analysis.currentSummary.expenses, change: expenseChange },
            { label: isRtl ? "ממוצע הכנסה חודשי" : "Average monthly income", value: analysis.averageIncome, change: null },
          ].map((item) => <div key={item.label} className="rounded-2xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{item.label}</p><strong className="mt-1 block text-xl">{money(item.value)}</strong>{item.change !== null && <small className={`mt-1 flex items-center gap-1 ${item.change > 0 ? "text-emerald-600" : "text-red-600"}`}>{item.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(item.change).toFixed(0)}%</small>}</div>)}
        </div>
      </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card><CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{isRtl ? "מפת ימי ההוצאה" : "Spending heatmap"}</h3>{selectedDay && <button className="text-xs text-primary" onClick={() => setSelectedDay(null)}>{isRtl ? "נקה בחירה" : "Clear"}</button>}</div>
          <div className="grid grid-cols-7 gap-1.5" style={{ paddingInlineStart: `${analysis.firstDay * 0.25}rem` }}>
            {Array.from({ length: analysis.firstDay }).map((_, index) => <span key={`empty-${index}`} />)}
            {analysis.heatmap.map((item) => {
              const intensity = item.amount / analysis.maxDaySpend;
              return <button key={item.day} type="button" title={`${item.day}: ${money(item.amount)}`} onClick={() => setSelectedDay(item.day)} className={`aspect-square rounded-md border text-[10px] transition-transform hover:scale-110 ${selectedDay === item.day ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: item.amount ? `hsl(4 78% ${92 - intensity * 38}%)` : "hsl(var(--muted) / 0.45)" }}>{item.day}</button>;
            })}
          </div>
          {selectedDay && <div className="mt-4 space-y-1 border-t pt-3">{analysis.selectedTransactions.map((entry) => <div key={entry.id} className="flex justify-between gap-2 text-xs"><span className="truncate">{entry.title}</span><strong>{entry.payment_type === "income" ? "+" : "-"}{money(entry.amount)}</strong></div>)}{!analysis.selectedTransactions.length && <p className="text-xs text-muted-foreground">{isRtl ? "אין תנועות ביום הזה." : "No transactions on this day."}</p>}</div>}
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <h3 className="mb-3 font-semibold">{isRtl ? "תנועות אחרונות" : "Recent transactions"}</h3>
          <div className="max-h-72 divide-y overflow-y-auto pe-1">{analysis.recent.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0"><strong className="block truncate">{entry.title}</strong><small className="text-muted-foreground">{new Date(entry.created_at).toLocaleDateString(isRtl ? "he-IL" : "en-US")} · {entry.category || (isRtl ? "אחר" : "Other")}</small></span><strong className={entry.payment_type === "income" ? "text-emerald-600" : "text-red-600"}>{entry.payment_type === "income" ? "+" : "-"}{money(entry.amount)}</strong></div>)}</div>
        </CardContent></Card>
      </div>
    </section>
  );
};

export default FinanceOverview;
