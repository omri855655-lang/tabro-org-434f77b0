import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { analyzeBudgetPeriod } from "@/lib/financeBudget";
import { getFinanceCategoryGroup } from "@/lib/financeCategorization";
import { formatFinanceMoney, type FinanceInsightEntry } from "@/lib/financeInsights";
import { toast } from "sonner";

const groups = {
  leisure: ["בילויים", "פנאי", "קניות"],
  food: ["מזון"],
};
type Group = keyof typeof groups;
type Entry = FinanceInsightEntry & { due_date?: string | null };

export default function WeeklySpendingChallenge({ userId, entries, isRtl, incomplete }: {
  userId: string; entries: Entry[]; isRtl: boolean; incomplete: boolean;
}) {
  const week = analyzeBudgetPeriod([], "weekly");
  const [group, setGroup] = useState<Group>("leisure");
  const [input, setInput] = useState("");
  const [limit, setLimit] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const category = `challenge:${week.start}:${group}`;
  const display = (value: number) => formatFinanceMoney(value, "ILS", isRtl ? "he-IL" : "en-US");
  const spent = analyzeBudgetPeriod(entries.filter(entry => groups[group].includes(
    getFinanceCategoryGroup(entry.payment_type === "income" ? entry.refund_category : entry.category),
  )), "weekly").net;

  useEffect(() => {
    let current = true;
    setReady(false);
    setLimit(0);
    setInput("");
    void supabase.from("budget_targets").select("amount").eq("user_id", userId).eq("period", "weekly")
      .eq("category", category).maybeSingle().then(({ data, error }) => {
        if (!current) return;
        if (error) {
          toast.error(isRtl ? "לא הצלחנו לטעון את האתגר השבועי" : "Could not load the weekly challenge");
          return;
        }
        const amount = Number(data?.amount || 0);
        setLimit(amount);
        setInput(amount > 0 ? String(amount) : "");
        setReady(true);
      });
    return () => { current = false; };
  }, [category, userId, isRtl]);

  const save = async () => {
    const amount = Math.round(Number(input) * 100) / 100;
    if (!ready || saving || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("budget_targets").upsert(
        { user_id: userId, category, period: "weekly", amount }, { onConflict: "user_id,period,category" },
      );
      if (error) throw error;
      setLimit(amount);
    } catch { toast.error(isRtl ? "לא הצלחנו לשמור את היעד" : "Could not save the target"); }
    finally { setSaving(false); }
  };

  return <section className="space-y-3 rounded-2xl border bg-background p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-primary" />{isRtl ? "אתגר ההוצאות השבועי" : "Weekly spending challenge"}</h3>
      <span className="text-xs text-muted-foreground"><bdi>{week.start}</bdi> · {isRtl ? "שבוע שמתחיל ביום ראשון" : "Week starts Sunday"}</span>
    </div>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="grid gap-1 text-xs">{isRtl ? "קטגוריה" : "Category"}
        <select className="h-9 rounded-md border bg-background px-2" value={group} disabled={saving} onChange={event => { setReady(false); setGroup(event.target.value as Group); }}>
          <option value="leisure">{isRtl ? "פנאי וקניות" : "Leisure & shopping"}</option>
          <option value="food">{isRtl ? "אוכל ומזון" : "Food & groceries"}</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs">{isRtl ? "יעד בש״ח" : "Target in ILS"}
        <Input className="w-28" type="number" min="0.01" max="1000000" step="0.01" placeholder="500" value={input} disabled={!ready || saving} onChange={event => setInput(event.target.value)} required />
      </label>
      <Button type="submit" size="sm" disabled={!ready || saving}>{isRtl ? "שמור יעד" : "Save target"}</Button>
    </form>
    {ready && limit > 0 && <div className="space-y-2 text-sm">
      <Progress value={Math.min(100, Math.max(0, spent / limit * 100))} aria-label={isRtl ? "התקדמות עד היעד" : "Progress toward target"} />
      <p>{isRtl ? "הוצאות שנרשמו" : "Recorded spending"} {display(spent)} / {display(limit)} · <strong>{spent > limit ? (isRtl ? "חריגה" : "Over target") : (isRtl ? "נותר לפי הנתונים" : "Remaining based on available data")} {display(Math.abs(limit - spent))}</strong></p>
    </div>}
    {incomplete && <p className="text-xs text-muted-foreground">{isRtl ? "חלק מהחיבורים דורשים טיפול. ייתכן שחסרות הוצאות מהשבוע." : "Some connections need attention. Recent spending may be missing."}</p>}
  </section>;
}
