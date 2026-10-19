import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REFUND_CATEGORY_OPTIONS, type FinanceCoachAnalysis, type RefundSelection } from "@/lib/financeCoach";
import { formatFinanceMoney } from "@/lib/financeInsights";

interface Props {
  analysis: FinanceCoachAnalysis;
  isRtl: boolean;
  onConfirmRefund?: (creditId: string, selection: RefundSelection) => Promise<void>;
  onCategorySelect?: (category: string, currency: string) => void;
}

export default function FinanceCoach({ analysis, isRtl, onConfirmRefund, onCategorySelect }: Props) {
  const [percent, setPercent] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [refundCategories, setRefundCategories] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const money = (amount: number) => formatFinanceMoney(amount, analysis.currency, isRtl ? "he-IL" : "en-US");
  const scenario = analysis.scenarioCategories.find(item => item.name === selectedCategory);
  const lastPage = Math.max(0, Math.ceil(analysis.refunds.length / 5) - 1);
  const currentPage = Math.min(page, lastPage);
  const confirm = async (id: string, selection: RefundSelection) => {
    if (!onConfirmRefund || busy) return;
    setBusy(id); setError("");
    try { await onConfirmRefund(id, selection); }
    catch { setError(isRtl ? "השיוך לא נשמר. נסה שוב; הנתונים הקיימים לא הוחלפו." : "Could not save the classification. Try again; existing data was not replaced."); }
    finally { setBusy(""); }
  };
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        [isRtl ? "הוצאות לפני זיכויים" : "Expenses before refunds", analysis.grossSpend],
        [isRtl ? "זיכויי כרטיס בתקופה" : "Card refunds this period", analysis.refundsTotal],
        [isRtl ? "הוצאה נטו בתקופה" : "Net period spending", analysis.netSpend],
      ].map(([label, amount]) => <div key={String(label)} className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{money(Number(amount))}</p></div>)}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{isRtl
      ? "תנועות ששולמו במטבע הנבחר בלבד. הזיכוי נספר בחודש שבו התקבל, גם אם הרכישה מחודש קודם; הוא אינו משכורת או הכנסה חדשה. זהו סיכום התנועות שהוזנו, לא תמונה מובטחת של כל ההוצאות שלך."
      : "Paid transactions in the selected currency only. Refunds count in the month received, even for an earlier purchase; they are not salary or new earnings. This covers recorded transactions, not necessarily all your spending."}</p>
    <details className="rounded-xl border bg-background p-4">
      <summary className="cursor-pointer text-sm font-semibold">{isRtl ? "פילוח נטו לפי קטגוריה" : "Net category breakdown"}</summary>
      <div className="mt-3 divide-y text-sm">{analysis.netCategories.map(item => <div key={item.name} className="flex justify-between gap-3 py-2"><span>{item.name}</span><strong>{money(item.amount)}</strong></div>)}
        {analysis.unresolvedCount > 0 && <div className="flex justify-between gap-3 py-2 text-amber-700"><span>{isRtl ? "זיכויים שטרם סווגו (מופחתים מהסך בלבד)" : "Unclassified refunds (total only)"}</span><strong>{money(-analysis.refunds.filter(item => item.status !== "confirmed" && item.status !== "categorized").reduce((total, item) => total + item.credit.amount, 0))}</strong></div>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{isRtl ? "רק שיוך שאישרת מפחית את קטגוריית ההוצאה. ערך שלילי אפשרי כשמתקבל החזר על רכישה מחודש קודם; החודש המקורי לא נכתב מחדש." : "Only your confirmed classification reduces an expense category. Negative values can occur for refunds on earlier-month purchases; the original month is not rewritten."}</p>
    </details>
    {analysis.hasSettlements && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs">{isRtl
      ? "נמצאו חיובי בנק מרוכזים של כרטיסי אשראי: ייתכן שהם חופפים לפירוט הרכישות. תרחישי חיסכון כספיים הושהו כדי לא לחשב קיצוץ על סכום כפול."
      : "Bank card settlements may overlap itemized purchases. Monetary savings scenarios are paused to avoid using duplicated spending."}</p>}

    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h4 className="font-semibold">{isRtl ? "זיכויים והוצאה מקורית" : "Refunds and original purchases"}</h4>
      <details className="text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer">{isRtl ? "איך נבדקה ההתאמה?" : "How was the match checked?"}</summary><p className="mt-2">{isRtl
        ? "אותו בית עסק אינו הוכחה לאותה רכישה. מוצעת רק התאמה יחידה באותו כרטיס, ספק ומטבע, עד 180 ימים לאחור, ובסכום שאינו עולה על הרכישה לאחר זיכויים שכבר שויכו. אפשר במקום זאת לאשר קטגוריה בלבד, ללא טענה שזוהתה הרכישה."
        : "The same merchant does not prove the same purchase. Only one compatible purchase in the same card, provider and currency within 180 days is suggested, capped by its remaining unrefunded amount. You can instead confirm a category without claiming a purchase match."}</p></details>
      {analysis.refunds.slice(currentPage * 5, (currentPage + 1) * 5).map(item => {
        const resolved = item.status === "confirmed" || item.status === "categorized";
        return <div key={item.credit.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><strong className="break-words">{item.credit.title}</strong><strong>{money(item.credit.amount)}</strong></div>
          <p className="text-xs text-muted-foreground">{item.credit.created_at} · {item.credit.account_label} {item.credit.account_last_four ? `••••${item.credit.account_last_four}` : ""}</p>
          {resolved ? <div><p className="text-xs text-emerald-700">{item.status === "confirmed"
            ? (isRtl ? `שויך באישורך לרכישה מ־${item.expense?.created_at}` : `Linked by your confirmation to purchase on ${item.expense?.created_at}`)
            : (isRtl ? "הקטגוריה אושרה; הרכישה המקורית לא זוהתה" : "Category confirmed; original purchase not identified")} · {item.category}</p>{onConfirmRefund && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void confirm(item.credit.id, { clear: true })}>{isRtl ? "בטל שיוך" : "Clear classification"}</Button>}</div>
            : <>
              {item.expense ? <p className="text-xs">{isRtl ? "הצעה לבדיקה, טרם שויך: " : "Suggestion, not yet linked: "}{item.expense.title} · {item.expense.created_at} · {money(item.expense.amount)}</p>
                : <p className="text-xs text-amber-700">{isRtl ? "לא נמצאה רכישה יחידה מתאימה. הזיכוי מקוזז מהסך הכולל, אך לא מקטגוריה עד לאישור שלך." : "No unique purchase match. The refund reduces the total, but not a category until you confirm."}</p>}
              {onConfirmRefund && <div className="flex flex-wrap items-center gap-2">
                {item.status === "suggested" && item.expense && <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void confirm(item.credit.id, { expenseId: item.expense!.id })}>{isRtl ? "אשר שיוך לרכישה" : "Confirm purchase link"}</Button>}
                <select aria-label={`${isRtl ? "קטגוריית זיכוי" : "Refund category"} ${item.credit.title}`} value={refundCategories[item.credit.id] || ""}
                  onChange={event => setRefundCategories(current => ({ ...current, [item.credit.id]: event.target.value }))} disabled={Boolean(busy)} className="h-9 max-w-full rounded-md border bg-background px-2 text-xs">
                  <option value="">{isRtl ? "או בחר קטגוריית הוצאה" : "Or choose an expense category"}</option>
                  {REFUND_CATEGORY_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
                <Button size="sm" variant="outline" disabled={Boolean(busy) || !refundCategories[item.credit.id]} onClick={() => void confirm(item.credit.id, { category: refundCategories[item.credit.id] })}>{isRtl ? "אשר קטגוריה בלבד" : "Confirm category only"}</Button>
              </div>}
            </>}
        </div>;
      })}
      {lastPage > 0 && <div className="flex items-center justify-between gap-2 text-xs"><Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{isRtl ? "הקודם" : "Previous"}</Button><span>{currentPage + 1} / {lastPage + 1}</span><Button size="sm" variant="ghost" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>{isRtl ? "הבא" : "Next"}</Button></div>}
      {!analysis.refunds.length && <p className="text-sm text-muted-foreground">{isRtl ? "אין זיכויי כרטיס מזוהים בחודש ובמטבע שנבחרו. זיכוי שלא סומן כך במקור לא ינוחש מתוך הכותרת." : "No identified card refunds in this month and currency. Refunds are not guessed from transaction titles."}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>

    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h4 className="font-semibold">{isRtl ? "איפה אפשר לבדוק חיסכון?" : "Where could you explore savings?"}</h4>
      <p className="text-xs leading-5 text-muted-foreground">{isRtl
        ? "בחר בעצמך קטגוריה ושיעור הפחתה כדי לראות תרחיש, לא הבטחה לחיסכון. הבסיס כולל רק רכישות מתאימות לבדיקה, לא תשלומים או התחייבויות שסומנו. גם קניות או בילויים יכולים להיות חיוניים לך. לא מוצע קיצוץ אוטומטי בבריאות, דיור, חינוך או ביטוח."
        : "Choose a category and reduction to explore a scenario, not a savings promise. The base includes only eligible purchases, not marked installments or commitments. Shopping or leisure can still be essential to you. No automatic cuts to health, housing, education or insurance are suggested."}</p>
      {analysis.scenarioCategories.length > 0 ? <>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs">{isRtl ? "קטגוריה לבדיקה" : "Category to explore"}<select aria-label={isRtl ? "קטגוריה לבדיקה" : "Category to explore"} className="ms-2 h-9 max-w-full rounded-md border bg-background px-2" value={scenario ? selectedCategory : ""} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="">{isRtl ? "בחר קטגוריה" : "Choose category"}</option>{analysis.scenarioCategories.map(item => <option key={item.name} value={item.name}>{item.name} · {money(item.amount)}</option>)}
          </select></label>
          <label className="text-xs">{isRtl ? "תרחיש הפחתה" : "Reduction scenario"}<select aria-label={isRtl ? "תרחיש הפחתה" : "Reduction scenario"} className="ms-2 h-9 rounded-md border bg-background px-2" value={percent} onChange={e => setPercent(Number(e.target.value))}>{[0, 5, 10, 15, 20].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
        </div>
        {scenario && <div className="rounded-lg bg-sky-50/60 p-3 text-sm dark:bg-sky-950/20"><p>{isRtl ? `הפחתה של ${percent}% מהסכום המתועד בתקופה: ` : `${percent}% less than the recorded period amount: `}<strong>{money(Math.round(scenario.amount * percent) / 100)}</strong></p><p className="mt-1 text-xs text-muted-foreground">{isRtl ? "זהו חישוב לתקופה שנבחרה, לא תחזית שנתית. בדוק אילו רכישות באמת ניתן לשנות." : "This is a selected-period calculation, not an annual forecast. Check which purchases can actually change."}</p>{onCategorySelect && <Button className="mt-2" size="sm" variant="outline" onClick={() => onCategorySelect(scenario.name, analysis.currency)}>{isRtl ? "פתח רכישות (לפני זיכוי)" : "Open purchases (before refunds)"}</Button>}</div>}
      </> : <p className="rounded-lg bg-muted/40 p-3 text-xs">{analysis.unresolvedCount > 0 || analysis.uncategorized > 0
        ? (isRtl ? "קודם נשלים שיוך זיכויים וסיווג הוצאות. בינתיים לא מוצג סכום חיסכון שעלול להתבסס על פילוח שגוי." : "Classify refunds and expenses first. No savings amount is shown on an uncertain breakdown.")
        : (isRtl ? "אין כרגע בסיס נקי לתרחיש בקטגוריות המתאימות. לא נניח שחסרה לך הכנסה או שכל הוצאה ניתנת לביטול." : "No clean basis for a scenario in eligible categories yet. We will not assume income is missing or every expense is avoidable.")}</p>}
      {analysis.partial && <p className="text-xs text-muted-foreground">{isRtl ? "החודש עדיין חלקי. אין להסיק ממנו לבדו על חודש שלם." : "The month is partial; do not treat it as a full-month result."}</p>}
      <p className="text-xs text-muted-foreground">{isRtl ? `${analysis.recurringReviewCount} דפוסים חודשיים זמינים בלשונית החיובים החוזרים. בדוק שימוש ותנאי ביטול לפני שינוי מנוי.` : `${analysis.recurringReviewCount} monthly patterns available in the recurring tab. Check usage and cancellation terms before changing a subscription.`}</p>
    </section>

    <details className="rounded-xl border bg-background p-4">
      <summary className="cursor-pointer text-sm font-semibold">{isRtl ? "ללמוד מההוצאות: שלושה עקרונות" : "Learn from spending: three principles"}</summary>
      <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
        <p>{isRtl ? "1. הפרד חיוני מגמיש לפי החיים שלך, לא רק שם הקטגוריה. בחר שינוי קטן אחד ובדוק אותו בסוף החודש." : "1. Separate essentials from flexible spending based on your life, not just a category label. Try one small change and review it at month end."}</p>
        <p>{isRtl ? "2. זיכוי מחזיר כסף שכבר יצא; הוא אינו שכר נוסף. הוצאה בתשלומים אינה הופכת להכנסה פנויה בגלל חודש קטן יותר." : "2. A refund returns money already spent; it is not extra salary. A smaller installment this month does not create new disposable income."}</p>
        <p>{isRtl ? "3. עקוב אחר הוצאות בפועל, מועדי חיוב והוצאות לא חודשיות. הקצה יעד חיסכון שמתאים לך, בלי כלל אחוזים מחייב." : "3. Track actual spending, due dates and non-monthly costs. Choose a savings goal that fits you, without a mandatory percentage rule."}</p>
        <a className="block underline" href="https://www.consumerfinance.gov/consumer-tools/educator-tool/your-money-your-goals/toolkit/" target="_blank" rel="noreferrer">{isRtl ? "כלי למידה ותקצוב של CFPB (אנגלית)" : "CFPB budgeting and learning tools"}</a>
        <p>{isRtl ? "הסברים כלליים לתכנון תקציב, לא ייעוץ השקעות, מס או אשראי. החישובים כאן מקומיים; פתיחת הלשונית אינה שולחת את העסקאות לשירות AI." : "General budgeting education, not investment, tax or credit advice. Calculations run locally; opening this tab does not send transactions to an AI service."}</p>
      </div>
    </details>
  </div>;
}
