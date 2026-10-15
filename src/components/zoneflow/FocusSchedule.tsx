import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { planningToolsCopy } from '@/lib/planningToolsCopy';

type Schedule = { start: string; minutes: number; started: boolean };
export function FocusSchedule({ active, canStart, onToggle }: { active: boolean; canStart: boolean; onToggle: () => Promise<void> }) {
  const { user } = useAuth();
  return <ScheduleForm key={user?.id || 'guest'} storageKey={`focus-schedule:${user?.id || 'guest'}`} active={active} canStart={canStart} onToggle={onToggle} />;
}
function ScheduleForm({ storageKey: key, active, canStart, onToggle }: { storageKey: string; active: boolean; canStart: boolean; onToggle: () => Promise<void> }) {
  const { lang, dir } = useLanguage();
  const copy = planningToolsCopy[lang];
  const [schedule, setSchedule] = useState<Schedule | null>(() => safeLocalStorage.getJSON(key, null));
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState(25);
  const latest = useRef({ active, canStart, onToggle });
  latest.current = { active, canStart, onToggle };
  useEffect(() => { safeLocalStorage.setJSON(key, schedule); }, [key, schedule]);
  useEffect(() => {
    const tick = () => {
      if (!schedule) return;
      const begins = new Date(schedule.start).getTime();
      const ends = begins + schedule.minutes * 60000;
      if (Date.now() >= ends) {
        setSchedule(null);
        if (schedule.started && latest.current.active) void latest.current.onToggle();
      } else if (Date.now() >= begins && !schedule.started && latest.current.canStart && !latest.current.active) {
        setSchedule({ ...schedule, started: true });
        void latest.current.onToggle();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [schedule]);
  return <div className="rounded-2xl border bg-card p-4 text-card-foreground" dir={dir}>
    <h3 className="font-semibold">{copy.schedule}</h3><p className="my-2 text-xs text-muted-foreground">{copy.scheduleHint}</p>
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm">{copy.start}<Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label className="text-sm">{copy.minutes}<Input type="number" min="5" max="240" value={minutes} onChange={e => setMinutes(Math.min(240, Math.max(5, Number(e.target.value) || 25)))} className="w-24" /></label><Button disabled={!canStart || !start || !Number.isFinite(new Date(start).getTime()) || new Date(start).getTime() <= Date.now()} onClick={() => setSchedule({ start: new Date(start).toISOString(), minutes, started: false })}>{copy.saveSchedule}</Button></div>
    {schedule && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>{schedule.started ? copy.started : `${copy.start}: ${new Date(schedule.start).toLocaleString(lang)}`} · {schedule.minutes} {copy.minutes}</span><Button variant="outline" size="sm" onClick={() => { setSchedule(null); if (schedule.started && active) void onToggle(); }}>{copy.cancelSchedule}</Button></div>}
  </div>;
}
