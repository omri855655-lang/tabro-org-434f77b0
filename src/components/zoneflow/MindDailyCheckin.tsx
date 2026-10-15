import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { useAuth } from '@/hooks/useAuth';
import { printDocument } from '@/lib/printDocument';

type Entry = { date: string; mood: number; thought: string; action: string };
export function MindDailyCheckin() {
  const { user } = useAuth();
  const key = `mind-checkin:${user?.id || 'guest'}`;
  const [entries, setEntries] = useState<Entry[]>(() => safeLocalStorage.getJSON(key, []));
  const [mood, setMood] = useState(3);
  const [thought, setThought] = useState('');
  const [action, setAction] = useState('');
  return <details className="rounded-2xl border bg-card p-5 text-card-foreground">
    <summary className="cursor-pointer text-lg font-semibold">עצירה יומית · מה עובר עליי ומה הצעד הבא?</summary>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label>איך אני מרגיש עכשיו? {mood}/5<Input type="range" min="1" max="5" value={mood} onChange={e => setMood(Number(e.target.value))} /></label><label>צעד קטן שאפשר לעשות היום<Input value={action} onChange={e => setAction(e.target.value)} maxLength={300} /></label></div>
    <Textarea value={thought} onChange={e => setThought(e.target.value)} maxLength={3000} placeholder="מה מעסיק אותי? מה יעזור לי כרגע?" className="my-3" />
    <div className="flex gap-2"><Button disabled={!thought.trim() || !action.trim()} onClick={() => { const next = [{ date: new Date().toISOString(), mood, thought: thought.trim(), action: action.trim() }, ...entries].slice(0, 180); setEntries(next); safeLocalStorage.setJSON(key, next); setThought(''); setAction(''); }}>שמור ביומן האישי</Button><Button variant="outline" disabled={!entries.length} onClick={() => printDocument('יומן אישי · ZoneFlow Mind', ['תאריך', 'תחושה', 'מחשבה', 'הצעד שלי'], entries.map(e => [new Date(e.date).toLocaleString('he-IL'), `${e.mood}/5`, e.thought, e.action]))}>הדפס יומן</Button></div>
    <p className="mt-2 text-xs text-muted-foreground">הרשומות נשמרות במכשיר הזה בלבד.</p>
    <div className="mt-4 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">{entries.map(e => <article key={e.date} className="rounded-xl border p-3 text-sm"><time>{new Date(e.date).toLocaleDateString('he-IL')} · {e.mood}/5</time><p className="my-2 whitespace-pre-wrap">{e.thought}</p><strong>{e.action}</strong></article>)}</div>
  </details>;
}
