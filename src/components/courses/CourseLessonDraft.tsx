import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { courseStudyCopy } from '@/lib/courseStudyCopy';
import type { LessonDraft } from '@/lib/courseStudy';

export function CourseLessonDraft({ lessons, onChange, onConfirm, onCancel, busy }: {
  lessons: LessonDraft[] | null; onChange: (lessons: LessonDraft[]) => void;
  onConfirm: () => void; onCancel: () => void; busy: boolean;
}) {
  const { lang, dir } = useLanguage();
  const copy = courseStudyCopy[lang];
  return <Dialog open={lessons !== null} onOpenChange={open => { if (!open && !busy) onCancel(); }}>
    <DialogContent className="max-h-[85dvh] max-w-2xl overflow-auto" dir={dir}>
      <DialogHeader><DialogTitle>{copy.draft}</DialogTitle><DialogDescription>{copy.draftHint}</DialogDescription></DialogHeader>
      <div className="space-y-3">{lessons?.map((row, index) => <div key={index} className="flex flex-wrap items-end gap-2 rounded-xl border p-3">
        <label className="min-w-40 flex-1 text-sm">{copy.lesson}<Input maxLength={300} disabled={busy} value={row.title} onChange={e => onChange(lessons.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} /></label>
        <label className="w-28 text-sm">{copy.minutes}<Input type="number" min={5} max={300} disabled={busy} value={row.duration_minutes} onChange={e => onChange(lessons.map((item, i) => i === index ? { ...item, duration_minutes: Number(e.target.value) } : item))} /></label>
        <Button variant="ghost" disabled={busy} aria-label={`${copy.remove} ${index + 1}`} onClick={() => onChange(lessons.filter((_, i) => i !== index))}>{copy.remove}</Button>
      </div>)}</div>
      {!lessons?.length && <p role="status">{copy.empty}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={onCancel}>{copy.cancel}</Button><Button disabled={busy || !lessons?.some(row => row.title.trim())} onClick={onConfirm}>{copy.confirm}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
