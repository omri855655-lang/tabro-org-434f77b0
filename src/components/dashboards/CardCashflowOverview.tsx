import { CreditCard, EyeOff, RotateCcw } from "lucide-react";
import { formatFinanceMoney } from "@/lib/financeInsights";
import type { CardCashflow } from "@/lib/cardCashflow";

export default function CardCashflowOverview({ cards, hiddenKeys, onVisibility, onBillingDay, saving, isRtl }: {
  cards: CardCashflow[];
  hiddenKeys: string[];
  onVisibility: (key: string, hidden: boolean) => void;
  onBillingDay: (key: string, day: number | null) => void;
  saving: boolean;
  isRtl: boolean;
}) {
  const visible = cards.filter(card => !hiddenKeys.includes(card.key));
  const hidden = cards.filter(card => hiddenKeys.includes(card.key));
  const locale = isRtl ? "he-IL" : "en-US";
  const money = (amount: number) => formatFinanceMoney(amount, "ILS", locale);
  const label = (card: CardCashflow) => `${card.account.display_name || card.account.provider_name || (isRtl ? "כרטיס" : "Card")} ${card.account.masked_number || ""}`;
  const today = new Date();
  const months = Array.from({ length: 4 }, (_, i) => new Date(Date.UTC(today.getFullYear(), today.getMonth() + i, 1)).toISOString().slice(0, 7));
  return <section className="space-y-3 rounded-3xl border bg-background p-4 sm:p-5" aria-label={isRtl ? "חיובי האשראי הקרובים" : "Upcoming card charges"} dir={isRtl ? "rtl" : "ltr"}>
    <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" aria-hidden="true" /><h3 className="font-semibold">{isRtl ? "האשראי שלך · מה צפוי לרדת" : "Your cards · upcoming debits"}</h3></div>
    <p className="text-xs leading-5 text-muted-foreground">{isRtl ? "לפי תאריכי החיוב בתנועות שסונכרנו או בפירוט שייבאת. כשאין תאריך, בחירת יום פירעון תיצור אומדן בלבד. חודשים ללא נתון אינם אפס." : "Based on dates in synced transactions or imported statements. Selecting a billing day estimates undated charges. Missing months do not mean zero."}</p>
    <div className="grid gap-3 lg:grid-cols-2">
      {visible.map(card => {
        const next = card.charges[0];
        return <article key={card.key} className="space-y-3 rounded-2xl border bg-muted/15 p-4">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words font-semibold">{label(card)}</h4><span className="text-xs text-muted-foreground">{card.account.external_account_id.startsWith("csv-card:") ? (isRtl ? "קובץ מיובא" : "Statement import") : (isRtl ? "מקור מסונכרן" : "Synced source")}</span></div><button type="button" disabled={saving} onClick={() => onVisibility(card.key, true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" aria-label={`${isRtl ? "הסר מהתצוגה" : "Hide from view"} ${label(card)}`} title={isRtl ? "הסרה מהתצוגה בלבד; ההיסטוריה והתחזית נשמרות" : "Hide only; history and forecast remain"}><EyeOff className="h-4 w-4" /></button></div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-xs text-muted-foreground">{isRtl ? "החיוב הקרוב לפי הנתונים הקיימים" : "Next debit from available data"}</p>
            {next ? <><strong className="mt-1 block text-xl tabular-nums">{next.credit ? `${isRtl ? "יתרת זיכוי" : "Credit balance"} ${money(next.credit)}` : money(next.amount)}</strong><span className="text-xs">{new Date(`${next.date}T12:00:00`).toLocaleDateString(locale)} · {next.estimated ? (isRtl ? "אומדן לפי יום פירעון" : "Billing-day estimate") : (isRtl ? "לפי התנועות שדווחו, לא בהכרח חיוב סופי" : "Reported transactions, not necessarily final")}</span></> : <strong className="mt-1 block text-sm">{isRtl ? "אין חיוב עתידי ידוע" : "No upcoming charge known"}</strong>}
          </div>
          {card.undated > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{isRtl ? `${card.undated} תנועות ללא מועד חיוב לא נכללו בתחזית.` : `${card.undated} undated transactions excluded from the forecast.`}</p>}
          {card.foreignCurrencies.length > 0 && <p className="text-xs text-muted-foreground">{isRtl ? "מטבעות נפרדים, ללא המרה משוערת:" : "Separate currencies, no estimated conversion:"} {card.foreignCurrencies.join(", ")}</p>}
          <details className="rounded-xl border bg-background/50 p-3">
          <summary className="cursor-pointer text-xs font-medium">{isRtl ? "חודשים נוספים והגדרת יום פירעון" : "More months and billing day"}</summary>
          <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{months.map(month => {
            const charges = card.charges.filter(charge => charge.date.startsWith(month));
            return <div key={month} className="rounded-xl border p-2 text-xs"><span className="block text-muted-foreground">{new Date(`${month}-01T12:00:00`).toLocaleDateString(locale, { month: "short", year: "2-digit" })}</span><strong className="mt-1 block tabular-nums">{charges.length ? money(charges.reduce((sum, charge) => sum + charge.amount, 0)) : (isRtl ? "לא דווח" : "Not reported")}</strong>{charges.some(charge => charge.estimated) && <small>{isRtl ? "אומדן" : "Estimate"}</small>}</div>;
          })}</div>
          <label className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{isRtl ? "יום פירעון לתנועות ללא תאריך" : "Billing day for undated transactions"}</span><select className="h-9 rounded-lg border bg-background px-2" aria-label={`${isRtl ? "יום פירעון" : "Billing day"} ${label(card)}`} disabled={saving} value={card.billingDay || ""} onChange={event => onBillingDay(card.key, event.target.value ? Number(event.target.value) : null)}><option value="">{isRtl ? "ללא אומדן" : "No estimate"}</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
          <p className="text-xs leading-5 text-muted-foreground">{isRtl ? "יום הפירעון משמש רק כשאין תאריך בעסקה. הוא אינו משנה תאריך שנקרא מהדוח. תיקון תאריך בדוח שכבר יובא נעשה בייבוא חוזר ובאישור טיוטת העדכון." : "The billing day only estimates undated transactions. It does not override statement dates. Reimport and approve the update draft to correct an imported date."}</p>
          </div></details>
        </article>;
      })}
    </div>
    {!visible.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין כרטיסים להצגה. אפשר להוסיף מקור בבנק ואשראי או להחזיר כרטיס שהוסתר." : "No visible cards. Add a source in Bank & cards or restore a hidden card."}</p>}
    {hidden.length > 0 && <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm">{isRtl ? `כרטיסים שהוסרו מהתצוגה (${hidden.length})` : `Hidden cards (${hidden.length})`}</summary><p className="my-2 text-xs text-muted-foreground">{isRtl ? "ההיסטוריה נשמרת וחיובים ידועים ממשיכים להיכלל בתחזית. הסרה זו אינה מנתקת סנכרון." : "History and known forecast charges remain. Hiding does not disconnect sync."}</p>{hidden.map(card => <div key={card.key} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{label(card)}</span><button type="button" disabled={saving} onClick={() => onVisibility(card.key, false)} className="flex items-center gap-1 rounded-lg border px-2 py-1"><RotateCcw className="h-3 w-3" />{isRtl ? "החזר" : "Restore"}</button></div>)}</details>}
  </section>;
}
