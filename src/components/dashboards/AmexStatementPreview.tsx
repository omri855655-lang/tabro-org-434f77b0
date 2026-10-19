import type { ParsedTransaction } from "@/lib/financialProviders";
import { summarizeAmexStatement } from "@/lib/amexStatement";
import { useState } from "react";

interface Props {
  rows: ParsedTransaction[];
  isHe: boolean;
  onCategoryChange: (row: ParsedTransaction, category: string) => void;
}

export function AmexStatementPreview({ rows, isHe, onCategoryChange }: Props) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(rows.length / 20) - 1);
  const currentPage = Math.min(page, lastPage);
  const money = (amount: number, currency: string) => new Intl.NumberFormat(isHe ? "he-IL" : "en-US", {
    style: "currency", currency,
  }).format(amount);
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      {summarizeAmexStatement(rows).map((total) => <div key={total.currency} className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/20">
        <p className="text-xs text-muted-foreground">{isHe ? "חיוב נטו לפי הקובץ" : "Net statement amount"} · {total.currency}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">{money(total.net, total.currency)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{isHe ? "הוצאות" : "Expenses"}: {money(total.expenses, total.currency)} · {isHe ? "זיכויים" : "Credits"}: {money(total.credits, total.currency)}</p>
      </div>)}
    </div>
    <p className="text-xs text-muted-foreground">{isHe
      ? "הקטגוריות מוצעות לפי שם העסק ואפשר לתקן אותן לפני השמירה. זיכויים נשמרים כהחזר ומקוזזים מהחיוב העתידי; הדוחות מציגים אותם בצד ההכנסות. מטבע זר נשאר בנפרד ואינו נכלל בתחזית השקלית."
      : "Categories are suggested by merchant and editable before saving. Credits are stored as refunds, reduce the future charge, and appear on the income side of reports. Foreign currencies stay separate from the ILS forecast."}</p>
    <div className="max-h-80 overflow-y-auto rounded-xl border divide-y">
      {rows.slice(currentPage * 20, (currentPage + 1) * 20).map((row, i) => <div key={i} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{row.description}</p>
          <p className="text-xs text-muted-foreground">{row.transaction_date}{row.installment_total ? ` · ${isHe ? "תשלום" : "Installment"} ${row.installment_number}/${row.installment_total}` : ""}{row.direction === "income" ? ` · ${isHe ? "זיכוי" : "Credit"}` : ""}</p>
          {row.billing_date && <p className="text-xs text-muted-foreground">{isHe ? "מועד חיוב לעסקה" : "Transaction due date"}: {row.billing_date}</p>}
          <label className="mt-2 flex items-center gap-2 text-xs">
            {isHe ? "קטגוריה" : "Category"}
            <input aria-label={`${isHe ? "קטגוריה עבור" : "Category for"} ${row.description}`} value={row.category || ""}
              onChange={(event) => onCategoryChange(row, event.target.value)} maxLength={80}
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" />
          </label>
        </div>
        <span className={`text-sm font-medium tabular-nums ${row.direction === "income" ? "text-emerald-700" : ""}`} dir="ltr">{row.direction === "income" ? "+" : "−"}{money(row.amount, row.currency)}</span>
      </div>)}
    </div>
    {lastPage > 0 && <nav aria-label={isHe ? "עמודי עסקאות" : "Transaction pages"} className="flex items-center justify-between gap-2 text-xs">
      <button type="button" className="rounded-md border px-3 py-2 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{isHe ? "הקודם" : "Previous"}</button>
      <span>{currentPage + 1} / {lastPage + 1}</span>
      <button type="button" className="rounded-md border px-3 py-2 disabled:opacity-40" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>{isHe ? "הבא" : "Next"}</button>
    </nav>}
  </div>;
}
