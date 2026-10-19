import { useState } from "react";
import { createRoot } from "react-dom/client";
import FinanceWorkspace from "../../src/components/dashboards/FinanceWorkspace";
import FinanceOverview from "../../src/components/dashboards/FinanceOverview";
import FinanceInsights from "../../src/components/dashboards/FinanceInsights";
import { TabsContent } from "../../src/components/ui/tabs";
import { Button } from "../../src/components/ui/button";
import { financeCalendarDate, type FinanceInsightEntry } from "../../src/lib/financeInsights";
import "../../src/index.css";

const month = financeCalendarDate(new Date())!.slice(0, 7);
const entries: FinanceInsightEntry[] = [
  { id: "salary", title: "משכורת לדוגמה", amount: 14000, payment_type: "income", category: "משכורת", source_channel: "bank" },
  { id: "food", title: "קניות בסופר", amount: 870, payment_type: "expense", category: "סופר", source_channel: "credit_card" },
  { id: "rent", title: "שכירות לדוגמה", amount: 4000, payment_type: "expense", category: "דיור", source_channel: "bank" },
  { id: "shopping", title: "Amazon Demo", amount: 600, payment_type: "expense", category: "קניות", source_channel: "credit_card" },
  { id: "refund", title: "Amazon Demo", amount: 120, payment_type: "income", category: "החזר", source_channel: "credit_card", statement_credit: true },
].map(entry => ({ ...entry, currency: "ILS", subcategory: null, account_label: "חשבון הדגמה", account_last_four: "1234", payment_method: "demo", created_at: `${month}-01`, paid: true, recurring: false } as FinanceInsightEntry));
const accounts = [{ external_account_id: "demo-bank", provider_name: "Demo", account_type: "CHECKING", display_name: "חשבון הדגמה", masked_number: "••••1234", currency: "ILS", current_balance: 12500, available_balance: 12500 }];

export default function Preview() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [isRtl, setIsRtl] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [action, setAction] = useState("");
  return <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>סביבת בדיקה · נתונים בדויים בלבד · אין שמירה או חיבור לבנק</span><div className="flex gap-2"><button className="rounded-lg border p-2" onClick={() => setIsRtl(!isRtl)}>HE / EN</button><button className="rounded-lg border p-2" onClick={() => setEmpty(!empty)}>נתונים / ריק</button></div></div>
    <FinanceWorkspace isRtl={isRtl} activeTab={activeTab} onTabChange={setActiveTab} onImport={() => { setActiveTab("credit-cards"); setAction("Amex import opened"); }}
      monthControl={<input className="block rounded-xl border bg-background p-2 text-sm text-foreground" type="month" aria-label="חודש לסיכום ולפילוח" value={selectedMonth} onInput={event => setSelectedMonth(event.currentTarget.value)} onChange={event => setSelectedMonth(event.target.value)} />}
      exportControl={<Button variant="outline" size="sm" onClick={() => setAction("Export selected")}>{isRtl ? "ייצוא" : "Export"}</Button>}>
      <TabsContent value="overview"><FinanceOverview entries={empty ? [] : entries} accounts={empty ? [] : accounts} isRtl={isRtl} selectedMonth={selectedMonth} /></TabsContent>
      <TabsContent value="insights"><FinanceInsights entries={empty ? [] : entries} isRtl={isRtl} selectedMonth={selectedMonth} onCategorySelect={(category, currency) => { setActiveTab("transactions"); setAction(`${category}:${currency}`); }} /></TabsContent>
      <TabsContent value="transactions"><h3 className="mb-3 font-semibold">{isRtl ? "תנועות בתקופה שנבחרה" : "Selected transactions"}</h3>{entries.map(entry => <p key={entry.id} className="flex justify-between border-b p-3 text-sm"><span>{entry.title}</span><strong>{entry.amount} ILS</strong></p>)}</TabsContent>
      {["forecast", "credit-cards", "add", "budget", "history", "ai", "guides", "clubs"].map(value => <TabsContent key={value} value={value}><p className="rounded-2xl border p-6 text-sm">{isRtl ? "בדיקת מעבר לאזור: " : "Navigation check: "}{value}</p></TabsContent>)}
    </FinanceWorkspace>
    <output aria-label="תוצאת בדיקה" className="block text-xs text-muted-foreground">{action}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
