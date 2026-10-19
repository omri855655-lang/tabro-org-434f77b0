import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AmexStatementPreview } from "../../src/components/dashboards/AmexStatementPreview";
import { parseAmexStatement } from "../../src/lib/amexStatement";
import { applyStatementBillingDate, futureStatementCharges, sanitizeStatementRows } from "../../src/lib/cardStatement";
import "../../src/index.css";

const parsed = parseAmexStatement([
  ["01/10/2026", "שופרסל · נתוני הדגמה", "420", "ILS", "1234", ""],
  ["03/10/2026", "Amazon · נתוני הדגמה", "240", "ILS", "1234", "2/3"],
  ["05/10/2026", "החזר מבית עסק · הדגמה", "-20", "ILS", "1234", ""],
  ["06/10/2026", "Netflix · demo", "12.50", "USD", "1234", ""],
], ["תאריך עסקה", "שם בית העסק", "סכום חיוב", "מטבע חיוב", "מספר כרטיס", "תשלומים"]);

function Preview() {
  const [rows, setRows] = useState(parsed.transactions);
  const [date, setDate] = useState("2026-11-02");
  const [isHe, setIsHe] = useState(true);
  const [result, setResult] = useState("");
  return <main dir={isHe ? "rtl" : "ltr"} className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <header className="flex items-start justify-between gap-3"><div><p className="text-sm text-sky-700">Tabro · American Express</p><h1 className="mt-1 text-2xl font-bold">{isHe ? "סקירת פירוט לפני ייבוא" : "Review before importing"}</h1><p className="mt-2 text-xs text-muted-foreground">{isHe ? "בדיקה בלבד · נתונים בדויים · ללא מסד נתונים" : "Test only · fake data · no database"}</p></div><button className="rounded-md border p-2" onClick={() => setIsHe(!isHe)}>HE / EN</button></header>
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
      <label className="block text-sm">{isHe ? "מועד פירעון לאישור" : "Confirm due date"}<input type="date" className="mt-2 block rounded-md border p-2" value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} /></label>
      <AmexStatementPreview rows={rows} isHe={isHe} onCategoryChange={(row, category) => setRows(current => current.map(item => item === row ? { ...item, category } : item))} />
      <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={() => {
        const imported = sanitizeStatementRows(applyStatementBillingDate(rows, date)).filter(row => row.currency === "ILS").map(row => ({ ...row,
          source_type: "credit_card_import", source_connection_id: "fake-card", raw_data: { ...row.raw_data, billing_date: row.billing_date } }));
        const forecast = futureStatementCharges(imported, "csv-card:fake-card", "2026-10-19", "2027-01-19");
        setResult(JSON.stringify({ forecast, categories: rows.map(row => row.category) }));
      }}>{isHe ? "בדיקת חיוב עתידי (ללא שמירה)" : "Test forecast (no save)"}</button>
      <output aria-label="Test result" className="block break-all text-xs" dir="ltr">{result}</output>
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
