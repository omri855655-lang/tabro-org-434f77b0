import { useEffect, useRef, useState } from 'react';
import { Check, Flag, Leaf, Plus, Shield, Trash2, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useHabitJourney } from '@/hooks/useHabitJourney';
import { useTasks } from '@/hooks/useTasks';
import { HABIT_MILESTONES, habitStats, type HabitPlan } from '@/lib/habitJourney';
import { habitCopy, habitHistoryLabels, habitTemplates } from '@/lib/habitCopy';
import { toast } from 'sonner';

export function ZoneFlowHabitStudio() {
  const { user } = useAuth();
  return <HabitStudio key={user?.id || 'guest'} userId={user?.id} />;
}

function TaskBridge({ action }: { action: string }) {
  const { lang } = useLanguage();
  const c = habitCopy[lang];
  const personal = useTasks('personal');
  const work = useTasks('work');
  const [text, setText] = useState(action);
  const [type, setType] = useState<'personal'|'work'>('personal');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const lock = useRef(false);
  const add = async () => {
    if (lock.current || !text.trim() || added) return;
    lock.current = true; setBusy(true);
    try {
      const task = await (type === 'personal' ? personal : work).addTask(undefined, { description: text.trim() });
      if (task) { setAdded(true); toast.success(c.taskAdded); }
    } finally { setBusy(false); lock.current = false; }
  };
  return <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-white p-4 text-slate-900">
    <p className="text-xs leading-6 text-slate-600">{c.taskHint}</p>
    <Input aria-label={c.action} value={text} maxLength={500} onChange={e => { setText(e.target.value); setAdded(false); }} />
    <select aria-label={c.task} className="h-11 rounded-lg border px-3" value={type} onChange={e => setType(e.target.value as typeof type)}><option value="personal">{c.personal}</option><option value="work">{c.work}</option></select>
    <Button className="ms-2" disabled={busy || added || !text.trim()} onClick={() => void add()}>{added ? c.taskAdded : c.add}</Button>
  </div>;
}

function HabitStudio({ userId }: { userId?: string }) {
  const store = useHabitJourney(userId);
  return <HabitJourneyContent userId={userId} store={store} />;
}

export function HabitJourneyContent({ userId, store }: { userId?: string; store: ReturnType<typeof useHabitJourney> }) {
  const { lang, dir } = useLanguage();
  const c = habitCopy[lang];
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState({ title: '', direction: 'build' as HabitPlan['direction'], cue: '', action: '', weekdays: [0,1,2,3,4,5,6], target_days: 30 });
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [showTask, setShowTask] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const deadline = useRef(0);
  const timerRunning = remaining !== null;
  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left || null);
    }, 250);
    return () => window.clearInterval(timer);
  }, [timerRunning]);
  const plan = store.plans.find(item => item.id === selected) || store.plans[0];
  const stats = plan ? habitStats(plan, store.entries) : null;
  const moments = store.entries.filter(entry => entry.habit_id === plan?.id && entry.kind === 'urge').sort((a,b) => b.created_at.localeCompare(a.created_at));
  const checkins = store.entries.filter(entry => entry.habit_id === plan?.id && entry.kind === 'checkin').sort((a,b) => b.entry_date.localeCompare(a.entry_date));
  const panel = 'rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm';
  const save = async () => {
    if (!draft.title.trim() || !draft.action.trim() || !draft.weekdays.length) { toast.error(c.invalid); return; }
    if (await store.addPlan({ ...draft, title: draft.title.trim(), action: draft.action.trim() })) {
      setCreating(false); setDraft({ title:'',direction:'build',cue:'',action:'',weekdays:[0,1,2,3,4,5,6],target_days:30 });
      toast.success(c.saved);
    }
  };
  return <section dir={dir} className="rounded-3xl bg-[#f5f7f2] p-4 text-slate-900 sm:p-6">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-800"><Leaf className="h-4 w-4" />ZoneFlow / {c.nav}</span><h2 className="mt-3 text-2xl font-semibold sm:text-3xl">{c.title}</h2><p className="mt-2 text-sm leading-7 text-slate-600">{c.intro}</p></div>
      <Button disabled={!userId || store.loading || store.busy} className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => setCreating(value => !value)}><Plus className="me-2 h-4 w-4" />{c.new}</Button>
    </header>
    <p className="mb-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-950"><Shield className="mt-1 h-4 w-4 shrink-0" />{c.privacy}</p>
    {store.error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{c.failed}<Button variant="outline" className="ms-3" disabled={store.busy} onClick={() => void store.load()}>{c.retry}</Button></div>}
    {creating && <form onSubmit={e => { e.preventDefault(); void save(); }} className={`${panel} mb-6 grid gap-4 sm:grid-cols-2`}>
      <div className="flex flex-wrap gap-2 sm:col-span-2">{habitTemplates[lang].map(([title,cue,action,direction]) => <Button key={title} type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft,title,cue,action,direction })}>{title}</Button>)}</div>
      <label className="space-y-2 text-sm">{c.name}<Input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title:e.target.value })} /></label>
      <fieldset className="flex gap-2"><legend className="sr-only">{c.new}</legend>{(['build','reduce'] as const).map(value => <Button type="button" key={value} variant={draft.direction === value ? 'default' : 'outline'} aria-pressed={draft.direction === value} onClick={() => setDraft({ ...draft, direction:value })}>{c[value]}</Button>)}</fieldset>
      <label className="space-y-2 text-sm">{c.cue}<Input maxLength={500} value={draft.cue} onChange={e => setDraft({ ...draft, cue:e.target.value })} /></label>
      <label className="space-y-2 text-sm">{c.action}<Input required maxLength={500} value={draft.action} onChange={e => setDraft({ ...draft, action:e.target.value })} /></label>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm">{c.days}</legend><div className="flex flex-wrap gap-2">{c.weekdays.map((day,index) => <button type="button" className={`min-h-11 rounded-full border px-3 text-xs ${draft.weekdays.includes(index) ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-slate-300 bg-white'}`} aria-pressed={draft.weekdays.includes(index)} key={index} onClick={() => setDraft({ ...draft, weekdays:draft.weekdays.includes(index) ? draft.weekdays.filter(value => value !== index) : [...draft.weekdays,index] })}>{day}</button>)}</div></fieldset>
      <label className="space-y-2 text-sm">{c.target}<select className="block h-11 w-full rounded-lg border bg-white px-3" value={draft.target_days} onChange={e => setDraft({ ...draft, target_days:Number(e.target.value) })}>{[7,14,30,60,90].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <div className="flex gap-2 sm:col-span-2"><Button disabled={store.busy || !draft.weekdays.length} type="submit">{c.save}</Button><Button type="button" variant="ghost" disabled={store.busy} onClick={() => setCreating(false)}>{c.cancel}</Button></div>
    </form>}
    {store.loading ? <p role="status" className="py-8">{c.loading}</p> : !plan ? <div className={`${panel} py-12 text-center`}><Leaf className="mx-auto mb-3 h-10 w-10 text-emerald-700" /><p>{c.empty}</p></div> : <>
      <nav aria-label={c.nav} className="mb-5 flex flex-wrap gap-2">{store.plans.map(item => <button key={item.id} aria-pressed={plan.id === item.id} className={`min-h-11 rounded-full border px-4 text-sm ${plan.id === item.id ? 'border-emerald-900 bg-emerald-900 text-white' : 'bg-white'}`} onClick={() => { setSelected(item.id); setShowTask(false); setTrigger(''); setResponse(''); }}>{item.title}</button>)}</nav>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <article className={panel}>
            <span className="text-xs font-medium text-emerald-800">{c[plan.direction]}</span><h3 className="mt-2 text-xl font-semibold">{plan.title}</h3>
            {plan.cue && <p className="mt-3 text-sm text-slate-600">{c.cue} {plan.cue}</p>}<p className="mt-2 rounded-xl bg-[#f2f5ed] p-4 text-base font-medium">{plan.action}</p>
            <p className="mt-3 text-xs text-slate-500">{plan.weekdays.map(day => c.weekdays[day]).join(' · ')}</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-4"><strong className="block text-3xl text-emerald-900">{stats!.completed} / {plan.target_days}</strong><span className="text-xs text-slate-600">{c.completed}</span></div><div className="rounded-xl bg-amber-50 p-4"><strong className="block text-3xl text-amber-900">{stats!.streak}</strong><span className="text-xs text-slate-600">{c.streak}</span></div></div>
            <h4 className="mb-2 mt-5 text-sm font-semibold">{c.today}</h4><div className="flex flex-wrap gap-2">{(['done','partial','missed'] as const).map(outcome => <Button key={outcome} variant={stats!.today === outcome ? 'default' : 'outline'} aria-pressed={stats!.today === outcome} disabled={store.busy || !plan.weekdays.includes(new Date().getDay())} onClick={() => void store.checkin(plan.id,outcome)}>{stats!.today === outcome && <Check className="me-1 h-4 w-4" />}{c[outcome]}</Button>)}</div>
            {!plan.weekdays.includes(new Date().getDay()) && <p className="mt-2 text-xs text-slate-500">{c.rest}</p>}
            <details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-emerald-900" onClick={() => setShowTask(value => !value)}>{c.task}</summary>{showTask && <TaskBridge key={plan.id} action={plan.action} />}</details>
          </article>
          <article className={panel}><h3 className="flex items-center gap-2 font-semibold"><Flag className="h-4 w-4 text-emerald-700" />{c.milestone}</h3><div className="my-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700 transition-[width] motion-reduce:transition-none" style={{ width:`${stats!.progress}%` }} /></div><div className="flex flex-wrap gap-2">{HABIT_MILESTONES.filter(value => value <= plan.target_days).map(value => <span key={value} className={`rounded-full border px-3 py-2 text-xs ${stats!.completed >= value ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500'}`}>{stats!.completed >= value ? '✓ ' : ''}{value}</span>)}</div></article>
          {!!checkins.length && <details className={panel}><summary className="cursor-pointer font-semibold">{habitHistoryLabels[lang]} ({checkins.length})</summary><div className="mt-3 max-h-64 space-y-2 overflow-auto">{checkins.map(entry => <div key={entry.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"><time>{new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(lang)}</time><span className={entry.outcome === 'done' ? 'text-emerald-800' : 'text-slate-600'}>{entry.outcome ? c[entry.outcome] : ''}</span></div>)}</div></details>}
          <article className={panel}><h3 className="font-semibold">{c.history}</h3>{!moments.length && <p className="mt-3 text-sm text-slate-500">{c.noHistory}</p>}<div className="mt-3 max-h-80 space-y-3 overflow-auto">{moments.map(entry => <div key={entry.id} className="rounded-xl bg-slate-50 p-3 text-sm"><time className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString(lang)}</time><p className="mt-1 font-medium">{c.intensity}: {entry.intensity}</p>{entry.trigger && <p className="mt-2 whitespace-pre-wrap">{entry.trigger}</p>}{entry.response && <p className="mt-2 whitespace-pre-wrap text-emerald-800">{entry.response}</p>}</div>)}</div></article>
        </div>
        <div className="space-y-5">
          <form className={panel} onSubmit={async e => { e.preventDefault(); if (await store.recordUrge(plan.id,intensity,trigger.trim(),response.trim())) { setTrigger('');setResponse('');toast.success(c.saved); } }}><h3 className="mb-4 flex items-center gap-2 font-semibold"><Waves className="h-5 w-5 text-sky-700" />{c.urge}</h3><label className="block text-sm">{c.intensity}: <strong>{intensity}</strong><input className="my-4 block w-full accent-emerald-800" type="range" min="1" max="10" value={intensity} onChange={e => setIntensity(Number(e.target.value))} /></label><label className="mb-4 block space-y-2 text-sm">{c.trigger}<Textarea maxLength={1000} value={trigger} onChange={e => setTrigger(e.target.value)} /></label><label className="mb-4 block space-y-2 text-sm">{c.response}<Textarea maxLength={1000} value={response} onChange={e => setResponse(e.target.value)} /></label><Button disabled={store.busy} type="submit">{c.record}</Button></form>
          <article className={`${panel} !bg-[#183d35] text-white`}><h3 className="text-lg font-semibold">{c.tools}</h3><h4 className="mt-4 font-medium">{c.pause}</h4><p className="mt-2 text-sm leading-7 text-emerald-100">{c.pauseHint}</p>{remaining !== null && <p role="timer" className="my-4 font-mono text-4xl">{remaining}</p>}<Button className="mt-3 bg-white text-emerald-950 hover:bg-emerald-50" onClick={() => { if (remaining !== null) setRemaining(null); else { deadline.current = Date.now()+60000;setRemaining(60); } }}>{remaining !== null ? c.stop : c.start}</Button><details className="mt-5 border-t border-white/20 pt-4"><summary className="cursor-pointer">{c.ground}</summary><p className="mt-2 text-sm leading-7 text-emerald-100">{c.groundHint}</p></details><details className="mt-4 border-t border-white/20 pt-4"><summary className="cursor-pointer">{c.connect}</summary><p className="mt-2 text-sm leading-7 text-emerald-100">{c.connectHint}</p></details></article>
          <Button variant="ghost" className="text-rose-800" disabled={store.busy} onClick={async () => { if (window.confirm(c.confirm)) await store.remove(plan.id); }}><Trash2 className="me-2 h-4 w-4" />{c.delete}</Button>
        </div>
      </div>
    </>}
    <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-600">{c.support}</p>
  </section>;
}
