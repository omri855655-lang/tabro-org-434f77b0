import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CircleHelp, CreditCard, Landmark, Store, Tags, WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyzeFinanceInsights, financeCalendarDate, financeEntryCurrency, type FinanceInsightEntry } from "@/lib/financeInsights";
import { buildFinanceCoach, type RefundSelection } from "@/lib/financeCoach";
import FinanceCoach from "./FinanceCoach";

export type { FinanceInsightEntry } from "@/lib/financeInsights";

interface FinanceInsightsProps {
  entries: FinanceInsightEntry[];
  isRtl: boolean;
  selectedMonth?: string;
  onCreateRecurring?: (entry: FinanceInsightEntry, expectedDate: string) => void;
  onCategorySelect?: (category: string, currency: string) => void;
  onMerchantSelect?: (merchant: string, currency: string) => void;
  confirmedRecurringSourceIds?: string[];
  onConfirmRefund?: (creditId: string, selection: RefundSelection) => Promise<void>;
}

const FinanceInsights = ({ entries, isRtl, selectedMonth, onCreateRecurring, onCategorySelect, onMerchantSelect, onConfirmRefund, confirmedRecurringSourceIds = [] }: FinanceInsightsProps) => {
  const [currency, setCurrency] = useState("ILS");
  const currencies = [...new Set(entries.filter(entry => !entry.hidden).map(financeEntryCurrency))].sort();
  const activeCurrency = currencies.includes(currency) ? currency : currencies[0] || "ILS";
  const month = selectedMonth || financeCalendarDate(new Date())!.slice(0, 7);
  const analysis = useMemo(() => analyzeFinanceInsights(entries, month, activeCurrency), [entries, month, activeCurrency]);
  const coach = useMemo(() => buildFinanceCoach(entries, month, activeCurrency), [entries, month, activeCurrency]);
  const money = (value: number) => activeCurrency === "UNKNOWN"
    ? value.toLocaleString(isRtl ? "he-IL" : "en-US", { maximumFractionDigits: 2 })
    : new Intl.NumberFormat(isRtl ? "he-IL" : "en-US", { style: "currency", currency: activeCurrency, maximumFractionDigits: 2 }).format(value);
  const dateLabel = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  const periodLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(isRtl ? "he-IL" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const changeIsUp = (analysis.change || 0) > 0;
  const channelLabels = {
    credit_card: isRtl ? "כרטיסי אשראי" : "Credit cards",
    bank: isRtl ? "בנק, העברות והוראות קבע" : "Bank and transfers",
    manual: isRtl ? "רישום ידני" : "Manual entries",
  };

  if (!entries.length) return null;

  return (
    <section className="space-y-4 rounded-2xl border bg-gradient-to-br from-sky-50/60 via-background to-background p-4 sm:p-5 dark:from-sky-950/10" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary">{isRtl ? "התמונה הפיננסית שלך" : "Your financial picture"} · {periodLabel}</p>
          <h3 className="text-lg font-semibold">{isRtl ? "פילוח ותובנות, במקום אחד" : "Breakdowns and insights, together"}</h3>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{isRtl ? "מבוסס על תנועות ששולמו עד היום. כל מטבע מוצג בנפרד, ללא המרה משוערת." : "Based on paid transactions through today. Currencies are shown separately, without estimated conversion."}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {isRtl ? "מטבע לפילוח" : "Analysis currency"}
          <Select value={activeCurrency} onValueChange={setCurrency}>
            <SelectTrigger className="h-9 w-28" aria-label={isRtl ? "מטבע לפילוח" : "Analysis currency"}><SelectValue /></SelectTrigger>
            <SelectContent>{currencies.map(value => <SelectItem key={value} value={value}>{value === "UNKNOWN" ? (isRtl ? "לא מזוהה" : "Unknown") : value}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-emerald-200/70 bg-emerald-50/60 dark:bg-emerald-950/10"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "הכנסות וזיכויים בתקופה" : "Period income and credits"}</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">{money(analysis.currentIncome)}</p>
        </CardContent></Card>
        <Card className="border-orange-200/70 bg-orange-50/60 dark:bg-orange-950/10"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "הוצאות לפני זיכויים" : "Spending before refunds"}</p>
          <p className="mt-1 text-xl font-semibold text-orange-700 dark:text-orange-400">{money(analysis.currentSpend)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "ממוצע הוצאה יומי" : "Daily spending average"}</p>
          <p className="mt-1 text-xl font-semibold">{money(analysis.dailyAverage)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{isRtl ? "מול התקופה הקודמת" : "Versus previous period"}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {analysis.change === null ? <CircleHelp className="h-5 w-5 text-muted-foreground" /> : changeIsUp ? <ArrowUpRight className="h-5 w-5 text-red-500" /> : <ArrowDownRight className="h-5 w-5 text-emerald-500" />}
            <span className={`text-xl font-semibold ${analysis.change === null ? "" : changeIsUp ? "text-red-600" : "text-emerald-600"}`}>
              {analysis.change === null ? (isRtl ? "אין בסיס להשוואה" : "No baseline") : `${Math.abs(analysis.change).toFixed(0)}%`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{analysis.comparisonIsPartial
            ? (isRtl ? `ימים 1–${analysis.previousDays} בחודש הקודם` : `Days 1–${analysis.previousDays} of last month`)
            : (isRtl ? "השוואת חודשים מלאים" : "Full-month comparison")}</p>
          <p className="text-[11px] text-muted-foreground">{isRtl ? "בסיס ההשוואה: " : "Comparison baseline: "}{money(analysis.previousSpend)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="breakdown" dir={isRtl ? "rtl" : "ltr"}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="breakdown">{isRtl ? "קטגוריות ובתי עסק" : "Categories & merchants"}</TabsTrigger>
          <TabsTrigger value="sources">{isRtl ? "כרטיסים ומקורות" : "Cards & sources"}</TabsTrigger>
          <TabsTrigger value="recurring">{isRtl ? "חיובים חוזרים לבדיקה" : "Recurring charges to review"} · {analysis.recurring.length}</TabsTrigger>
          <TabsTrigger value="coach">{isRtl ? "זיכויים וחיסכון" : "Refunds & savings"}</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="mt-4 grid gap-4 lg:grid-cols-2 data-[state=inactive]:hidden">
          <Card><CardContent className="p-5">
            <h4 className="mb-4 flex items-center gap-2 font-semibold"><Tags className="h-4 w-4 text-primary" />{isRtl ? "קטגוריות לפני זיכויים" : "Categories before refunds"}</h4>
            <div className="space-y-3">{analysis.topCategories.map(category => (
              <button type="button" key={category.name} className="block w-full rounded-xl border border-border/60 p-3 text-start transition-colors hover:border-primary/50 hover:bg-muted/30" onClick={() => onCategorySelect?.(category.name, activeCurrency)}>
                <div className="mb-1 flex justify-between gap-3 text-sm"><strong>{category.name}</strong><strong>{money(category.total)}</strong></div>
                <Progress value={analysis.currentSpend > 0 ? category.total / analysis.currentSpend * 100 : 0} className="h-2" />
                <div className="mt-2 flex flex-wrap gap-1.5">{category.subcategories.map(([name, value]) => <span key={name} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{name} · {money(value)}</span>)}</div>
              </button>
            ))}{!analysis.topCategories.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין הוצאות בתקופה ובמטבע שנבחרו." : "No expenses for this period and currency."}</p>}</div>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h4 className="mb-4 flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-primary" />{isRtl ? "בתי עסק מובילים" : "Top merchants"}</h4>
            <div className="divide-y divide-border/60">{analysis.topMerchants.map(([name, value], index) => (
              <button type="button" key={name} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-start text-sm hover:bg-muted/30" onClick={() => onMerchantSelect?.(name, activeCurrency)}>
                <span className="min-w-0 truncate"><span className="me-2 text-xs text-muted-foreground">{index + 1}</span>{name}</span><strong className="shrink-0">{money(value)}</strong>
              </button>
            ))}{!analysis.topMerchants.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין בתי עסק להצגה בתקופה זו." : "No merchants for this period."}</p>}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-4 grid gap-4 lg:grid-cols-2 data-[state=inactive]:hidden">
          <Card><CardContent className="p-5">
            <h4 className="mb-4 flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-primary" />{isRtl ? "מקורות החיוב" : "Spending sources"}</h4>
            <div className="space-y-3">{analysis.channelTotals.map(([channel, value]) => {
              const Icon = channel === "credit_card" ? CreditCard : channel === "bank" ? Landmark : WalletCards;
              return <div key={channel} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-sm"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{channelLabels[channel]}</span><strong>{money(value)} · {(value / analysis.currentSpend * 100).toFixed(0)}%</strong></div>;
            })}{!analysis.channelTotals.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין חיובים להצגה." : "No charges to show."}</p>}</div>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h4 className="mb-4 flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4 text-primary" />{isRtl ? "פילוח לפי כרטיס" : "Credit card breakdown"}</h4>
            <div className="divide-y divide-border/60">{analysis.cardTotals.map(([name, value]) => <div key={name} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate">{name}</span><strong>{money(value)}</strong></div>)}{!analysis.cardTotals.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין הוצאות כרטיס בתקופה זו." : "No card spending for this period."}</p>}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <Card><CardContent className="space-y-4 p-5">
            <div><h4 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-primary" />{isRtl ? "דפוסים שדורשים אישור שלך" : "Patterns that need your confirmation"}</h4>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{isRtl ? "על בסיס תנועות מיובאות: לפחות שלושה חודשים רצופים, חיוב אחד בחודש ובאותו חשבון ומטבע. תשלומים וחיוב בנק של חברת אשראי אינם מוצעים כמנוי חדש. אלה הצעות בלבד, לא חיובים מאושרים." : "Based on imported transactions: at least three consecutive months, one charge per month, in the same account and currency. Installments and bank card settlements are not suggested as new subscriptions. These are suggestions, not confirmed bills."}</p></div>
            {analysis.recurring.slice(0, 8).map(item => {
              const confirmed = item.historyIds.some(id => confirmedRecurringSourceIds.includes(id));
              return <div key={item.key} className="rounded-xl border border-border/70 bg-muted/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><strong className="block break-words text-sm">{item.name}</strong><p className="mt-1 text-xs text-muted-foreground">{[item.entry.account_label || item.entry.payment_method, item.entry.account_last_four ? `•••• ${item.entry.account_last_four}` : "", `${item.months} ${isRtl ? "חודשים רצופים" : "consecutive months"}`].filter(Boolean).join(" · ")}</p></div><strong className="text-base">{money(item.entry.amount)}</strong></div>
                <p className="mt-3 text-xs text-muted-foreground">{isRtl ? "המועד הבא לפי הדפוס, משוער: " : "Next pattern-based date, estimated: "}{dateLabel(item.nextExpectedDate)}</p>
                {item.increase !== null && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{isRtl ? "הסכום עלה לעומת החיוב הרגיל: " : "Amount increased from the usual charge: "}{money(item.previousAmount)} → {money(item.entry.amount)}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{isRtl ? "אין שינוי בתחזית ללא אישור" : "Forecast unchanged until confirmed"}</span>{confirmed
                  ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">{isRtl ? "כבר אושר" : "Already confirmed"}</span>
                  : onCreateRecurring && activeCurrency === "ILS" && <Button size="sm" variant="outline" onClick={() => onCreateRecurring(item.entry, item.nextExpectedDate)}>{isRtl ? "בדוק ואשר כהוצאה קבועה" : "Review & confirm recurring"}</Button>}</div>
              </div>;
            })}
            {!analysis.recurring.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{isRtl ? "אין כרגע מספיק ראיות לדפוס חודשי יציב. לא נוצרה הוצאה קבועה חדשה." : "Not enough evidence of a stable monthly pattern. No recurring payment was created."}</p>}
            {activeCurrency !== "ILS" && <p className="text-xs text-muted-foreground">{isRtl ? "התחזית הקיימת היא בשקלים; חיוב במטבע אחר לא יתווסף אליה ללא המרה מאומתת." : "The existing forecast is in ILS; foreign-currency charges are not added without a verified conversion."}</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="coach" className="mt-4">
          <FinanceCoach key={`${month}:${activeCurrency}`} analysis={coach} isRtl={isRtl} onConfirmRefund={onConfirmRefund} onCategorySelect={onCategorySelect} />
        </TabsContent>
      </Tabs>

      {(analysis.uncategorized > 0 || analysis.invalidCount > 0) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 text-xs dark:bg-amber-950/10"><p>{isRtl ? `${analysis.uncategorized} תנועות בתקופה דורשות סיווג · ${analysis.invalidCount} רשומות עם סכום או תאריך לא תקין לא נכללו בחישוב.` : `${analysis.uncategorized} period transactions need a category · ${analysis.invalidCount} invalid amount/date records excluded from calculations.`}</p>{analysis.uncategorized > 0 && <Button size="sm" variant="outline" onClick={() => onCategorySelect?.("אחר", activeCurrency)}>{isRtl ? "פתח תנועות לבדיקה" : "Review transactions"}</Button>}</div>}
    </section>
  );
};

export default FinanceInsights;
