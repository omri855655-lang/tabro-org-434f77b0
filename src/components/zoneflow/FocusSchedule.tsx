import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { useAuth } from '@/hooks/useAuth';

type Schedule = { start: string; minutes: number; started: boolean };
export function FocusSchedule({ active, canStart, onToggle }: { active: boolean; canStart: boolean; onToggle: () => Promise<void> }) {
  const { user } = useAuth();
  const key = `focus-schedule:${user?.id || 'guest'}`;
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
  return <div className="rounded-2xl border bg-card p-4 text-card-foreground">
    <h3 className="font-semibold">תזמון סשן פוקוס</h3><p className="my-2 text-xs text-muted-foreground">הסשן יתחיל כשהמסך הזה פתוח. חסימת אפליקציות בפועל תלויה ברכיב המערכת ובהרשאה שמוצגים למעלה; סגירת האתר אינה מפעילה חסימה מתוזמנת.</p>
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm">תחילה<Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label className="text-sm">דקות<Input type="number" min="5" max="240" value={minutes} onChange={e => setMinutes(Math.min(240, Math.max(5, Number(e.target.value) || 25)))} className="w-24" /></label><Button disabled={!canStart || !start || new Date(start).getTime() <= Date.now()} onClick={() => setSchedule({ start: new Date(start).toISOString(), minutes, started: false })}>שמור תזמון</Button></div>
    {schedule && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>{schedule.started ? 'הסשן המתוזמן התחיל' : `תחילה: ${new Date(schedule.start).toLocaleString('he-IL')}`} · {schedule.minutes} דקות</span><Button variant="outline" size="sm" onClick={() => { setSchedule(null); if (schedule.started && active) void onToggle(); }}>בטל תזמון</Button></div>}
  </div>;
}
