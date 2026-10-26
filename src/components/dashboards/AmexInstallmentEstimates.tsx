import type { InstallmentEstimate } from '@/lib/amexInstallmentForecast';
import { formatFinanceMoney } from '@/lib/financeInsights';

export default function AmexInstallmentEstimates({ rows, isRtl }: { rows: InstallmentEstimate[]; isRtl: boolean }) {
  return <details className="rounded-2xl border bg-card p-4">
    <summary className="cursor-pointer font-semibold">{isRtl ? `אומדן תשלומים שנותרו ב־Amex (${rows.length})` : `Remaining Amex installment estimates (${rows.length})`}</summary>
    <p className="my-3 text-xs leading-5 text-muted-foreground">{isRtl ? 'אומדן נפרד לפי מספר התשלום, הסכום ומועד החיוב בדוח האחרון. אינו הוצאה שבוצעה ואינו כלול ביתרה החזויה למעלה. דוח חדש מחליף את האומדן לתשלום שדווח. ללא אסמכתה או עם נתונים סותרים לא מוצג אומדן. אין המרת מטבעות.' : 'Separate estimate using the last reported installment, amount and billing date. Not actual spending or included in the projected balance above. A newer reported installment replaces its estimate. Missing references or conflicting data are not projected. No currency conversion.'}</p>
    {!rows.length && <p className="text-sm text-muted-foreground">{isRtl ? 'אין כרגע מספיק נתונים לתשלומים נוספים בטווח התחזית.' : 'No further installments with sufficient evidence in this forecast window.'}</p>}
    <div className="max-h-80 space-y-2 overflow-auto">{rows.map(row => <div key={row.key} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm"><span className="min-w-0 break-words">{row.description}<small className="block text-muted-foreground">{row.date} · {isRtl ? 'תשלום' : 'Installment'} {row.installment}/{row.total} · {isRtl ? 'משוער' : 'Estimated'}</small></span><strong className="tabular-nums">{formatFinanceMoney(row.amount, row.currency, isRtl ? 'he-IL' : 'en-US')}</strong></div>)}</div>
  </details>;
}
