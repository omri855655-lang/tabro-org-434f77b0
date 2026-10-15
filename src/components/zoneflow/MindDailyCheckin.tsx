import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { useAuth } from '@/hooks/useAuth';
import { printDocument } from '@/lib/printDocument';
import { useLanguage } from '@/hooks/useLanguage';
import { planningToolsCopy } from '@/lib/planningToolsCopy';

type Entry = { date: string; mood: number; thought: string; action: string };
export function MindDailyCheckin() {
  const { user } = useAuth();
  return <Journal key={user?.id || 'guest'} storageKey={`mind-checkin:${user?.id || 'guest'}`} />;
}
function Journal({ storageKey: key }: { storageKey: string }) {
  const { lang, dir } = useLanguage();
  const copy = planningToolsCopy[lang];
  const [entries, setEntries] = useState<Entry[]>(() => safeLocalStorage.getJSON(key, []));
  const [mood, setMood] = useState(3);
  const [thought, setThought] = useState('');
  const [action, setAction] = useState('');
  return <details className="rounded-2xl border bg-card p-5 text-card-foreground" dir={dir}>
    <summary className="cursor-pointer text-lg font-semibold">{copy.journal}</summary>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label>{copy.mood} {mood}/5<Input type="range" min="1" max="5" value={mood} onChange={e => setMood(Number(e.target.value))} /></label><label>{copy.action}<Input value={action} onChange={e => setAction(e.target.value)} maxLength={300} /></label></div>
    <Textarea value={thought} onChange={e => setThought(e.target.value)} maxLength={3000} placeholder={copy.thought} className="my-3" />
    <div className="flex flex-wrap gap-2"><Button disabled={!thought.trim() || !action.trim()} onClick={() => { const next = [{ date: new Date().toISOString(), mood, thought: thought.trim(), action: action.trim() }, ...entries].slice(0, 180); setEntries(next); safeLocalStorage.setJSON(key, next); setThought(''); setAction(''); }}>{copy.save}</Button><Button variant="outline" disabled={!entries.length} onClick={() => printDocument(`${copy.journalTitle} · ZoneFlow Mind`, [copy.date, copy.feeling, copy.thoughtTitle, copy.step], entries.map(e => [new Date(e.date).toLocaleString(lang), `${e.mood}/5`, e.thought, e.action]), '', { lang, dir })}>{copy.printJournal}</Button></div>
    <p className="mt-2 text-xs text-muted-foreground">{copy.local}</p>
    <div className="mt-4 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">{entries.map(e => <article key={e.date} className="rounded-xl border p-3 text-sm"><time>{new Date(e.date).toLocaleDateString(lang)} · {e.mood}/5</time><p className="my-2 whitespace-pre-wrap">{e.thought}</p><strong>{e.action}</strong></article>)}</div>
  </details>;
}
