import { useEffect, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { focusRoomCopy } from '@/lib/focusRoomCopy';
import { clampRoomPosition } from '@/lib/focusRoom';
import { FocusRoomInterior, type FocusActivity } from './FocusRoomInterior';

export function ZoneFlowFocusRoom({ running, progress, level, timer, onToggle, onReset }: {
  running: boolean; progress: number; level: number; timer: string; onToggle: () => void; onReset: () => void;
}) {
  const { lang } = useLanguage();
  const copy = focusRoomCopy[lang];
  const [position, setPosition] = useState(() => clampRoomPosition(safeLocalStorage.getJSON('zoneflow-room-position', { x: 50, y: 69 })));
  const [activity, setActivity] = useState<FocusActivity>(() => {
    const stored = safeLocalStorage.getJSON<string>('zoneflow-room-activity', 'computer');
    return stored === 'notebook' ? stored : stored === 'reading' || stored === 'book' ? 'book' : 'computer';
  });
  const [seated, setSeated] = useState(false);
  useEffect(() => safeLocalStorage.setJSON('zoneflow-room-position', position), [position]);
  useEffect(() => safeLocalStorage.setJSON('zoneflow-room-activity', activity), [activity]);
  return <div className="space-y-3">
    <FocusRoomInterior scene="library" name={copy.personal} topic={copy.personalHint}
      participants={[{ userId: 'local-user', displayName: copy.me, ...position, status: running ? 'focusing' : 'setting-up', isMe: true, activity, seated }]}
      timer={timer} active={running} onToggle={onToggle} onReset={onReset}
      onMove={next => { setPosition(clampRoomPosition(next)); setSeated(false); }} activity={activity} onActivityChange={setActivity}
      onSit={() => setSeated(true)} onSelectSeat={next => { setPosition(next); setSeated(true); }} />
    <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{copy.level} {level}</span><progress className="h-2 flex-1" max={100} value={progress} aria-label={`${Math.round(progress)}%`} /><span>{Math.round(progress)}%</span></div>
  </div>;
}
