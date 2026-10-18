import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { financeCalendarDate } from "@/lib/financeInsights";

export interface RecurringPaymentDraft {
  entryId: string;
  amount: string;
  dueDate: string;
}

interface Props {
  draft: RecurringPaymentDraft | null;
  title?: string;
  isRtl: boolean;
  saving: boolean;
  onChange: (draft: RecurringPaymentDraft) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function RecurringPaymentReview({ draft, title, isRtl, saving, onChange, onClose, onConfirm }: Props) {
  return <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent dir={isRtl ? "rtl" : "ltr"}>
      <DialogHeader>
        <DialogTitle>{isRtl ? "בדיקת הוצאה קבועה" : "Review recurring payment"}</DialogTitle>
        <DialogDescription>{isRtl ? "זהו תכנון חודשי בלבד, לא חיוב ולא העברת כסף. אשר את הסכום ואת מועד הפירעון הבא." : "This is a monthly plan, not a charge or money transfer. Confirm the amount and next due date."}</DialogDescription>
      </DialogHeader>
      {draft && <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!saving) void onConfirm(); }}>
        <p className="font-medium">{title}</p>
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{isRtl ? "אם החיוב כבר כלול בפירוט אשראי עתידי או בתכנון קיים, אין להוסיף אותו פעם נוספת. מועד משוער מהדפוס אינו בהכרח מועד חיוב הכרטיס." : "Do not add a charge again if it is already included in a future card statement or existing plan. A pattern-based date is not necessarily the card billing date."}</p>
        <label className="block space-y-2 text-sm"><span>{isRtl ? "סכום בשקלים" : "Amount in ILS"}</span><Input type="number" min="0.01" step="0.01" required disabled={saving} value={draft.amount} onChange={event => onChange({ ...draft, amount: event.target.value })} /></label>
        <label className="block space-y-2 text-sm"><span>{isRtl ? "מועד הפירעון הבא" : "Next due date"}</span><Input type="date" required disabled={saving} min={financeCalendarDate(new Date())!} value={draft.dueDate} onInput={event => onChange({ ...draft, dueDate: event.currentTarget.value })} onChange={event => onChange({ ...draft, dueDate: event.target.value })} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{isRtl ? "ביטול" : "Cancel"}</Button><Button type="submit" disabled={saving}>{saving ? (isRtl ? "שומר…" : "Saving…") : (isRtl ? "אשר תכנון חודשי" : "Confirm monthly plan")}</Button></div>
      </form>}
    </DialogContent>
  </Dialog>;
}
