import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { analyzeBudgetPeriod } from "@/lib/financeBudget";
import { formatFinanceMoney, type FinanceInsightEntry } from "@/lib/financeInsights";
import { Button } from "@/components/ui/button";

export function FinancePeriodBrief({ entries, isRtl, refreshKey, onBudget }: {
  entries: FinanceInsightEntry[]; isRtl: boolean; refreshKey: string;
  onBudget: (period: "weekly" | "monthly") => void;
}) {
  const { user } = useAuth();
  const [limits, setLimits] = useState<{ owner: string; values: Record<string, number> } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user) { setLimits(null); return; }
    setUnavailable(false);
    void supabase.from("budget_targets").select("period,amount,updated_at").eq("user_id", user.id)
      .is("category", null).in("period", ["weekly", "monthly"]).order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setLimits(null); setUnavailable(true); return; }
        const values: Record<string, number> = {};
        for (const row of data || []) if (!(row.period in values) && Number.isFinite(row.amount) && row.amount > 0) values[row.period] = row.amount;
        setLimits({ owner: user.id, values });
      });
    return () => { active = false; };
  }, [user, refreshKey]);
  const summaries = (["weekly", "monthly"] as const).map(period => ({ period, ...analyzeBudgetPeriod(entries, period), limit: limits?.owner === user?.id ? limits?.values[period] : undefined }));
  const exceeded = summaries.some(summary => summary.limit && summary.net > summary.limit);
  const money = (value: number) => formatFinanceMoney(value, "ILS", isRtl ? "he-IL" : "en-US");
  return <details className="rounded-2xl border bg-background p-4">
    <summary className="cursor-pointer text-sm font-semibold">{isRtl ? "השבוע והחודש · תנועות ותקציב" : "This week and month · movements & budget"}{exceeded && <span className="ms-2 text-destructive" role="status">{isRtl ? "חריגה מהיעד" : "Over target"}</span>}</summary>
    <p className="my-3 text-xs leading-5 text-muted-foreground">{isRtl ? "כל התנועות היוצאות שבוצעו בשקלים, כולל קבועות, חיסכון והעברות, בניכוי זיכויים מזוהים. זו אינה מדידת צריכה: חיוב כרטיס בבנק ופירוט הרכישות עלולים להיספר שניהם. השבוע מתחיל ביום ראשון; מטבעות אחרים אינם מומרים. הנתונים לפי מה שיובא, ולא בהכרח תמונה מלאה." : "All recorded ILS outflows, including recurring payments, savings and transfers, less identified refunds. This is not consumption: bank card settlements and purchases can both be counted. Weeks start Sunday; other currencies are not converted. Imported data may be incomplete."}</p>
    {unavailable && <p role="status" className="text-sm">{isRtl ? "יעדי התקציב לא נטענו; אין כרגע אישור שאתה בתוך היעד." : "Budget targets could not load; target status is unknown."}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{summaries.map(summary => <section key={summary.period} className="rounded-xl border p-3 space-y-2">
      <h3 className="font-semibold">{summary.period === "weekly" ? (isRtl ? "השבוע" : "This week") : (isRtl ? "החודש" : "This month")}</h3>
      <p className="text-xs text-muted-foreground" dir="ltr">{summary.start} – {summary.end}</p>
      <p className="text-xl font-semibold">{money(summary.net)}</p>
      <p className="text-xs">{isRtl ? "יוצאות" : "Outflows"}: {money(summary.outgoing)} · {isRtl ? "זיכויים" : "Refunds"}: {money(summary.refunds)}</p>
      <p className="text-xs text-muted-foreground">{summary.change === null ? (isRtl ? "אין בסיס חיובי להשוואה לתקופה קודמת" : "No positive prior-period comparison") : `${summary.change > 0 ? "+" : ""}${summary.change}% ${isRtl ? "לעומת אותו חלק בתקופה הקודמת" : "vs. the same part of the previous period"}`}</p>
      {summary.limit ? <p role="status" className={summary.net > summary.limit ? "text-sm text-destructive" : "text-sm"}>{summary.net > summary.limit ? (isRtl ? "חריגה" : "Over") : (isRtl ? "נותר עד היעד" : "Remaining")}: {money(Math.abs(summary.limit - summary.net))}</p> : null}
      <ul className="text-xs space-y-1">{summary.categories.slice(0, 3).map(category => <li key={category.name} className="flex justify-between gap-2"><span>{category.name}</span><span>{money(category.amount)}</span></li>)}</ul>
      <Button variant="outline" size="sm" onClick={() => onBudget(summary.period)}>{isRtl ? "הגדרת יעד ובדיקת התקציב" : "Set target and review budget"}</Button>
    </section>)}</div>
  </details>;
}
