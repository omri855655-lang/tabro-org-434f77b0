import { useState } from "react";
import { createRoot } from "react-dom/client";
import FinanceInsights from "../../src/components/dashboards/FinanceInsights";
import RecurringPaymentReview, { type RecurringPaymentDraft } from "../../src/components/dashboards/RecurringPaymentReview";
import { financeCalendarDate, type FinanceInsightEntry } from "../../src/lib/financeInsights";
import "../../src/index.css";

const today = financeCalendarDate(new Date())!;
const month = today.slice(0, 7);
const monthBefore = (offset: number) => {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - offset);
  return date.toISOString().slice(0, 7);
};
const entry = (id: string, title: string, amount: number, category: string, overrides: Partial<FinanceInsightEntry> = {}): FinanceInsightEntry => ({
  id, title, amount, currency: "ILS", category, subcategory: category, payment_type: "expense", source_channel: "credit_card",
  account_label: "כרטיס הדגמה", account_last_four: "1234", account_external_id: "fake-card", payment_method: "demo",
  created_at: `${month}-01`, paid: true, recurring: false, ...overrides,
});
const entries = [
  entry("salary", "משכורת לדוגמה", 14000, "משכורת", { payment_type: "income", source_channel: "bank" }),
  entry("groceries", "קניות בסופר", 870, "סופר"), entry("food", "בית קפה", 130, "אוכל"),
  entry("transport", "תחבורה ציבורית", 230, "תחבורה"), entry("house", "שכירות לדוגמה", 4000, "דיור", { source_channel: "bank" }),
  entry("unknown", "בית עסק לבדיקה", 75, "אחר"), entry("usd", "Digital service", 20, "בילויים", { currency: "USD" }),
  ...[0, 1, 2].map(offset => entry(`subscription-${offset}`, "מנוי לימודים", offset === 0 ? 130 : 100, "חינוך", { created_at: `${monthBefore(offset)}-01` })),
];

export default function Preview() {
  const [isRtl, setIsRtl] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [action, setAction] = useState("");
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [draft, setDraft] = useState<RecurringPaymentDraft | null>(null);
  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8" dir={isRtl ? "rtl" : "ltr"}>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Tabro</h1><p className="text-sm text-muted-foreground">סביבת בדיקה בלבד · כל הנתונים בדויים</p></div><div className="flex flex-wrap gap-3"><button className="rounded-lg border px-3 py-2" onClick={() => setIsRtl(!isRtl)}>HE / EN</button><label>חודש <input type="month" aria-label="חודש לבדיקה" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /></label></div></header>
    <FinanceInsights entries={entries} isRtl={isRtl} selectedMonth={selectedMonth} confirmedRecurringSourceIds={confirmed}
      onCategorySelect={(value, currency) => setAction(`category:${value}:${currency}`)}
      onMerchantSelect={(value, currency) => setAction(`merchant:${value}:${currency}`)}
      onCreateRecurring={(value, expectedDate) => { setAction(`review:${value.id}:${expectedDate}`); setDraft({ entryId: value.id, amount: String(value.amount), dueDate: expectedDate }); }} />
    <RecurringPaymentReview draft={draft} title={entries.find(item => item.id === draft?.entryId)?.title} isRtl={isRtl} saving={false} onChange={setDraft} onClose={() => setDraft(null)} onConfirm={async () => {
      if (!draft) return;
      setConfirmed([draft.entryId]); setAction(`confirmed:${draft.amount}:${draft.dueDate}`); setDraft(null);
    }} />
    <output aria-label="תוצאת לחיצה" className="block rounded-xl border p-3 text-sm">{action || "לא בוצעה פעולה"}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
