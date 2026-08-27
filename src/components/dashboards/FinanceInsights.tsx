import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CircleHelp, CreditCard, Landmark, Store, Tags, WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cleanMerchantName, getFinanceCategoryGroup } from "@/lib/financeCategorization";

export interface FinanceInsightEntry {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  payment_type: "income" | "expense";
  source_channel: "credit_card" | "bank" | "manual";
  account_label: string | null;
  account_last_four: string | null;
  payment_method: string | null;
  created_at: string;
  recurring: boolean;
  paid: boolean;
}

interface FinanceInsightsProps {
  entries: FinanceInsightEntry[];
  isRtl: boolean;
  onCreateRecurring?: (entry: FinanceInsightEntry) => void;
}

const money = (value: number) => `₪${Math.round(value).toLocaleString("he-IL")}`;

function monthKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const FinanceInsights = ({ entries, isRtl, onCreateRecurring }: FinanceInsightsProps) => {
  const analysis = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    const actual = entries.filter((entry) => entry.paid);
    const expenses = actual.filter((entry) => entry.payment_type === "expense");
    const currentExpenses = expenses.filter((entry) => monthKey(entry.created_at) === currentKey);
    const previousExpenses = expenses.filter((entry) => monthKey(entry.created_at) === previousKey);
    const currentIncome = actual
      .filter((entry) => entry.payment_type === "income" && monthKey(entry.created_at) === currentKey)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const currentSpend = currentExpenses.reduce((sum, entry) => sum + entry.amount, 0);
    const previousSpend = previousExpenses.reduce((sum, entry) => sum + entry.amount, 0);
    const change = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : null;

    const categories = new Map<string, { total: number; subcategories: Map<string, number> }>();
    const merchants = new Map<string, number>();
    const channels = new Map<FinanceInsightEntry["source_channel"], number>();
    const cards = new Map<string, number>();
    for (const entry of currentExpenses) {
      const category = getFinanceCategoryGroup(entry.category);
      const currentCategory = categories.get(category) || { total: 0, subcategories: new Map<string, number>() };
      currentCategory.total += entry.amount;
      const subcategory = entry.subcategory || entry.category || "אחר";
      currentCategory.subcategories.set(subcategory, (currentCategory.subcategories.get(subcategory) || 0) + entry.amount);
      categories.set(category, currentCategory);
      const merchant = cleanMerchantName(entry.title);
      merchants.set(merchant, (merchants.get(merchant) || 0) + entry.amount);
      channels.set(entry.source_channel, (channels.get(entry.source_channel) || 0) + entry.amount);
      if (entry.source_channel === "credit_card") {
        const cardName = [entry.account_label || entry.payment_method || "כרטיס אשראי", entry.account_last_four ? `•••• ${entry.account_last_four}` : ""]
          .filter(Boolean)
          .join(" ");
        cards.set(cardName, (cards.get(cardName) || 0) + entry.amount);
      }
    }

    const topCategories = [...categories.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([name, value]) => ({
        name,
        total: value.total,
        subcategories: [...value.subcategories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      }));
    const topMerchants = [...merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const channelTotals = [...channels.entries()].sort((a, b) => b[1] - a[1]);
    const cardTotals = [...cards.entries()].sort((a, b) => b[1] - a[1]);
    const uncategorized = expenses.filter((entry) => !entry.category || entry.category === "אחר").length;

    const recurringCandidates = new Map<string, { entries: FinanceInsightEntry[]; months: Set<string> }>();
    for (const entry of expenses) {
      const merchant = cleanMerchantName(entry.title);
      const candidate = recurringCandidates.get(merchant) || { entries: [], months: new Set<string>() };
      candidate.entries.push(entry);
      candidate.months.add(monthKey(entry.created_at));
      recurringCandidates.set(merchant, candidate);
    }
    const recurring = [...recurringCandidates.entries()]
      .map(([name, value]) => {
        const amounts = value.entries.map((entry) => entry.amount);
        const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        const amountSpread = Math.max(...amounts) - Math.min(...amounts);
        const days = value.entries.map((entry) => new Date(entry.created_at).getDate());
        const daySpread = Math.max(...days) - Math.min(...days);
        const entry = [...value.entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return { name, average, months: value.months.size, amountSpread, daySpread, entry };
      })
      .filter((value) => value.months >= 2 && value.amountSpread <= Math.max(15, value.average * 0.15) && value.daySpread <= 7)
      .sort((a, b) => b.months - a.months || b.average - a.average)
      .slice(0, 4)

    return {
      currentIncome,
      currentSpend,
      previousSpend,
      change,
      topCategories,
      topMerchants,
      channelTotals,
      cardTotals,
      uncategorized,
      recurring,
      dailyAverage: currentSpend / Math.max(now.getDate(), 1),
    };
  }, [entries]);

  if (!entries.length) return null;

  const maxCategory = analysis.topCategories[0]?.total || 1;
  const changeIsUp = (analysis.change || 0) > 0;
  const channelLabels = {
    credit_card: isRtl ? "כרטיסי אשראי" : "Credit cards",
    bank: isRtl ? "בנק, העברות והוראות קבע" : "Bank and transfers",
    manual: isRtl ? "תכנון ידני" : "Manual planning",
  };

  return (
    <section className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">{isRtl ? "התמונה הפיננסית שלך" : "Your financial picture"}</p>
          <h3 className="text-lg font-semibold">{isRtl ? "פילוח אוטומטי מהתנועות שסונכרנו" : "Automatic synced transaction insights"}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{isRtl ? "מתעדכן בכל סנכרון" : "Updates after every sync"}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-emerald-200/70 bg-emerald-50/60 dark:bg-emerald-950/10"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "הכנסות החודש" : "Income this month"}</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">{money(analysis.currentIncome)}</p>
        </CardContent></Card>
        <Card className="border-orange-200/70 bg-orange-50/60 dark:bg-orange-950/10"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "הוצאות החודש" : "Spending this month"}</p>
          <p className="mt-1 text-xl font-semibold text-orange-700 dark:text-orange-400">{money(analysis.currentSpend)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "ממוצע הוצאה יומי" : "Daily spending average"}</p>
          <p className="mt-1 text-xl font-semibold">{money(analysis.dailyAverage)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "מול החודש הקודם" : "Versus last month"}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {analysis.change === null ? <CircleHelp className="h-5 w-5 text-muted-foreground" /> : changeIsUp ? <ArrowUpRight className="h-5 w-5 text-red-500" /> : <ArrowDownRight className="h-5 w-5 text-emerald-500" />}
            <span className={`text-xl font-semibold ${analysis.change === null ? "" : changeIsUp ? "text-red-600" : "text-emerald-600"}`}>
              {analysis.change === null ? (isRtl ? "אין בסיס להשוואה" : "No baseline") : `${Math.abs(analysis.change).toFixed(0)}%`}
            </span>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-5">
          <h4 className="mb-4 flex items-center gap-2 font-semibold"><Tags className="h-4 w-4 text-primary" />{isRtl ? "קטגוריות מובילות החודש" : "Top categories this month"}</h4>
          <div className="space-y-3">
            {analysis.topCategories.map((category) => (
              <div key={category.name} className="rounded-xl border border-border/60 p-3">
                <div className="mb-1 flex justify-between gap-3 text-sm"><strong>{category.name}</strong><strong>{money(category.total)}</strong></div>
                <Progress value={(category.total / maxCategory) * 100} className="h-2" />
                {category.subcategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {category.subcategories.map(([name, value]) => (
                      <span key={name} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        {name} · {money(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!analysis.topCategories.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין הוצאות בחודש הנוכחי." : "No expenses this month."}</p>}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h4 className="mb-4 flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-primary" />{isRtl ? "בתי עסק מובילים החודש" : "Top merchants this month"}</h4>
          <div className="divide-y divide-border/60">
            {analysis.topMerchants.map(([name, value], index) => (
              <div key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate"><span className="me-2 text-xs text-muted-foreground">{index + 1}</span>{name}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
            {!analysis.topMerchants.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין עדיין בתי עסק להצגה." : "No merchants to show yet."}</p>}
          </div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-5">
          <h4 className="mb-4 flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-primary" />{isRtl ? "מאיפה יצא הכסף" : "Where the money came from"}</h4>
          <div className="space-y-3">
            {analysis.channelTotals.map(([channel, value]) => {
              const Icon = channel === "credit_card" ? CreditCard : channel === "bank" ? Landmark : WalletCards;
              const share = analysis.currentSpend > 0 ? (value / analysis.currentSpend) * 100 : 0;
              return <div key={channel} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{channelLabels[channel]}</span>
                  <strong>{money(value)} · {share.toFixed(0)}%</strong>
                </div>
              </div>;
            })}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h4 className="mb-4 flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4 text-primary" />{isRtl ? "פילוח לפי כרטיס אשראי" : "Credit card breakdown"}</h4>
          <div className="divide-y divide-border/60">
            {analysis.cardTotals.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">{name}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
            {!analysis.cardTotals.length && <p className="text-sm text-muted-foreground">{isRtl ? "לא נמצאו החודש הוצאות ששויכו לכרטיס אשראי." : "No credit card expenses were identified this month."}</p>}
          </div>
        </CardContent></Card>
      </div>

      {(analysis.recurring.length > 0 || analysis.uncategorized > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {analysis.recurring.length > 0 && <Card><CardContent className="p-5">
            <h4 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-primary" />{isRtl ? "חיובים קבועים שזוהו" : "Detected recurring charges"}</h4>
            <div className="space-y-2 text-sm">{analysis.recurring.map((item) => <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-2.5"><span className="min-w-0 flex-1 truncate">{item.name} <small className="text-muted-foreground">({item.months} {isRtl ? "חודשים" : "months"})</small></span><strong>~{money(item.average)}</strong>{onCreateRecurring && !item.entry.recurring && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCreateRecurring(item.entry)}>{isRtl ? "אשר כהוצאה קבועה" : "Confirm recurring"}</Button>}</div>)}</div>
          </CardContent></Card>}
          {analysis.uncategorized > 0 && <Card className="border-amber-200/70"><CardContent className="p-5">
            <h4 className="font-semibold">{isRtl ? "עסקאות שדורשות בדיקה" : "Transactions to review"}</h4>
            <p className="mt-2 text-sm text-muted-foreground">{isRtl ? `${analysis.uncategorized} עסקאות עדיין מסווגות כ״אחר״. אפשר לערוך קטגוריה מתוך רשימת התנועות, והפילוחים יתעדכנו מיד.` : `${analysis.uncategorized} transactions are still categorized as Other. Edit them in the transaction list to update all insights.`}</p>
          </CardContent></Card>}
        </div>
      )}
    </section>
  );
};

export default FinanceInsights;
