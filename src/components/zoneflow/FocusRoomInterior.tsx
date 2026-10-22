import { lazy, Suspense, type KeyboardEvent, type MouseEvent, useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Laptop, LogOut, Maximize2, MicOff, Minus, NotebookPen, Pause, Play, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { focusRoomCopy } from '@/lib/focusRoomCopy';
import { FOCUS_SEATS, safeFloorPosition, nearestAvailableFocusSeat, occupiedFocusSeat } from '@/lib/focusRoom';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import { zoneflowExperienceCopy } from '@/lib/zoneflowExperienceCopy';
import { FocusRoomWorld } from './FocusRoomWorld';
import { focusRoomViewCopy } from '@/lib/focusRoomViewCopy';
import { FOCUS_FLIGHTS, flightPhase, roomJourneyCopy, type RoomAtmosphere } from '@/lib/focusRoomJourney';

const FocusRoomImmersive = lazy(() => import('./FocusRoomImmersive'));

export type FocusRoomScene = 'library' | 'plane' | 'cafe' | 'office';
export type FocusActivity = 'computer' | 'notebook' | 'book';
const ACTIVITIES = { computer: Laptop, notebook: NotebookPen, book: BookOpen };
export interface FocusRoomParticipant {
  userId: string; displayName: string; x: number; y: number;
  status: 'setting-up' | 'focusing' | 'break' | 'away';
  color?: string; avatarStyle?: number; isMe?: boolean; activity?: FocusActivity; seated?: boolean; durationMinutes?: number;
}

export function FocusRoomInterior({ scene, name, topic, participants, timer, active, onToggle, onReset, onLeave, onMove, activity, onActivityChange, onSelectSeat, onDurationChange }: {
  scene: FocusRoomScene; name: string; topic: string; participants: FocusRoomParticipant[];
  timer: string; active: boolean; onToggle: () => void; onReset: () => void; onLeave?: () => void;
  onMove: (position: { x: number; y: number }) => void; activity: FocusActivity;
  onActivityChange: (activity: FocusActivity) => void; onSelectSeat: (position: { x: number; y: number }) => void;
  onDurationChange?: (minutes: number) => void;
}) {
  const { lang, dir } = useLanguage();
  const copy = focusRoomCopy[lang];
  const experience=zoneflowExperienceCopy[lang];
  const viewCopy = focusRoomViewCopy[lang];
  const journey = roomJourneyCopy[lang];
  const [atmosphere, setAtmosphere] = useState<RoomAtmosphere>(scene);
  const [flightId, setFlightId] = useState<string>(FOCUS_FLIGHTS[0].id);
  const flight = FOCUS_FLIGHTS.find(route => route.id === flightId)!;
  const [view, setView] = useState<'eye' | 'follow' | 'map'>(() => {
    const saved = safeLocalStorage.getString('zoneflow-room-camera');
    return saved === 'map' || saved === 'follow' ? saved : 'eye';
  });
  const [unavailable, setUnavailable] = useState(false);
  const [look,setLook]=useState(()=>{const value=safeLocalStorage.getString('zoneflow-room-look');return value==='pixel'||value==='depth'?value:'illustrated';});
  const peopleId = useId();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [walking, setWalking] = useState(false);
  const walkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const me = participants.find(person => person.isMe);
  const seconds = timer.split(':').map(Number).reduce((total, value) => total * 60 + value, 0);
  const duration = (me?.durationMinutes || 25) * 60;
  const elapsed = Math.max(0, duration - (Number.isFinite(seconds) ? seconds : duration));
  const started = active || elapsed > 0;
  const selectedSeat = me?.seated ? FOCUS_SEATS.findIndex(seat => Math.hypot(seat.x - me.x, seat.y - me.y) < 12) : -1;
  const statusLabels = { 'setting-up': copy.preparing, focusing: copy.focusing, break: copy.break, away: copy.away };
  useEffect(() => () => { if (walkingTimer.current) clearTimeout(walkingTimer.current); }, []);

  const animateWalk = () => {
    setWalking(true);
    if (walkingTimer.current) clearTimeout(walkingTimer.current);
    walkingTimer.current = setTimeout(() => setWalking(false), 650);
  };
  const chooseSeat = (seat: typeof FOCUS_SEATS[number]) => {
    if (occupiedFocusSeat(seat, participants)) return;
    animateWalk();
    onSelectSeat(seat);
  };
  const move = (position: { x: number; y: number }) => {
    animateWalk();
    onMove(safeFloorPosition(position, view === 'map' ? false : atmosphere === 'plane' ? 'forward' : true));
  };
  const moveFromPointer = (event: MouseEvent<HTMLDivElement>) => {
    const deskIndex = (event.target as Element).closest('[data-seat-index]')?.getAttribute('data-seat-index');
    if (deskIndex !== null && deskIndex !== undefined) {
      const seat = FOCUS_SEATS[Number(deskIndex)];
      if (seat) chooseSeat(seat);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    move({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 });
  };
  const moveFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input, textarea, select, [contenteditable="true"]')) return;
    if (!me || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move({ x: me.x + (event.key === 'ArrowRight' ? 4 : event.key === 'ArrowLeft' ? -4 : 0), y: me.y + (event.key === 'ArrowDown' ? 4 : event.key === 'ArrowUp' ? -4 : 0) });
  };
  const toggle = () => {
    if (!active && selectedSeat < 0) {
      const seat = nearestAvailableFocusSeat(me || { x: 50, y: 70 }, participants);
      if (seat) chooseSeat(seat);
    }
    onToggle();
  };

  return <section data-room-look={look} className="focus-room-studio overflow-hidden rounded-[1.75rem] border shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60" aria-label={name} tabIndex={0} dir={dir} onKeyDown={moveFromKeyboard}>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dce3d7] bg-[#fcfaf4] px-4 py-4 sm:px-6">
      <div className="min-w-0"><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#527063]"><span className="h-1.5 w-1.5 rounded-full bg-[#4d9278]" />ZONEFLOW / {scene}</div><h2 className="text-xl font-bold tracking-tight text-[#2c473d] sm:text-2xl">{name}</h2><p className="mt-1 max-w-lg text-xs text-[#65786a]">{topic}</p></div>
      <div className="flex items-center gap-1.5"><Button variant="ghost" className="gap-2 rounded-full text-[#38594b]" onClick={() => setPeopleOpen(value => !value)} aria-expanded={peopleOpen} aria-controls={peopleId}><Users className="h-4 w-4" />{copy.people} · {participants.length}</Button><span className="p-2 text-[#7b8c7d]" title={copy.quiet}><MicOff aria-label={copy.quiet} className="h-4 w-4" /></span>{onLeave && <Button size="icon" variant="ghost" className="rounded-full text-[#65786a]" onClick={onLeave} aria-label={copy.leave}><LogOut className="h-4 w-4" /></Button>}</div>
    </header>
    {peopleOpen && <aside id={peopleId} className="border-b border-[#dce3d7] bg-[#f4f5eb] px-4 py-3"><div className="flex flex-wrap gap-2">{participants.map(person => <div key={person.userId} className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs text-[#38594b]"><span className={cn('h-2 w-2 rounded-full', person.status === 'focusing' ? 'bg-emerald-500' : 'bg-amber-400')} /><span>{person.displayName}</span><span className="text-[#79897b]">{statusLabels[person.status]}</span></div>)}</div><p className="mt-2 text-xs text-[#738171]">{copy.quiet}</p></aside>}
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f3f3e9] px-4 py-3 sm:px-6">
      <label className="flex items-center gap-2 text-xs text-[#38594b]">{viewCopy.camera}<select value={view} onChange={event=>{const value=event.target.value as typeof view;setView(value);safeLocalStorage.setString('zoneflow-room-camera',value);}} className="rounded-xl border bg-white px-3 py-2">{(['eye','follow','map'] as const).map(value=><option key={value} value={value} disabled={unavailable&&value!=='map'}>{viewCopy[value]}</option>)}</select></label>
      {view === 'map' && <label className="flex items-center gap-2 text-xs text-[#38594b]">{experience.look}<select value={look} onChange={event=>{setLook(event.target.value);safeLocalStorage.setString('zoneflow-room-look',event.target.value);}} className="rounded-xl border bg-white px-3 py-2">{(['illustrated','pixel','depth'] as const).map(value=><option key={value} value={value}>{experience[value]}</option>)}</select></label>}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-white/80 p-1">{(Object.keys(ACTIVITIES) as FocusActivity[]).map(value => {
        const Icon = ACTIVITIES[value];
        return <Button key={value} size="sm" variant="ghost" aria-pressed={activity === value} onClick={() => onActivityChange(value)} className={cn('gap-1.5 rounded-xl text-[#607568] hover:text-[#2c5744]', activity === value && 'bg-[#dce9dd] text-[#2c5744] hover:bg-[#d4e2d4]')}><Icon className="h-3.5 w-3.5" />{copy[value]}</Button>;
      })}</div>
      {view === 'map' && <Button size="sm" variant="ghost" className="gap-2 rounded-full text-[#527063]" aria-label={zoomed ? copy.zoomOut : copy.zoomIn} aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? <Minus className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{zoomed ? '100%' : '150%'}</Button>}
    </div>
    {unavailable && <p role="status" className="bg-amber-50 px-4 py-3 text-sm text-amber-900">{viewCopy.unavailable}</p>}
    <div className="space-y-3 border-t border-[#dce3d7] bg-[#faf8ef] px-4 py-3 text-sm text-[#38594b] sm:px-6">
      <label className="flex flex-wrap items-center gap-3">{journey[0]}<select className="rounded-xl border bg-white p-2" value={atmosphere} onChange={event => setAtmosphere(event.target.value as RoomAtmosphere)}>{(['library','grand','intimate','plane','airport','cafe','office'] as const).map((value, index) => <option key={value} value={value}>{journey[index + 1]}</option>)}</select></label>
      {atmosphere === 'plane' && <div className="flex flex-wrap items-center gap-3">
        <label>{journey[8]} <select className="rounded-xl border bg-white p-2" value={flightId} disabled={started} onChange={event => setFlightId(event.target.value)}>{FOCUS_FLIGHTS.map(route => <option key={route.id} value={route.id}>{route.from} → {route.to} · {route.minutes} {journey[10]}</option>)}</select></label>
        {onDurationChange && <Button variant="outline" disabled={started} onClick={() => onDurationChange(flight.minutes)}>{journey[9]}</Button>}
        <span role="status" className="rounded-full bg-[#e0ebe8] px-3 py-1">{journey[flightPhase(elapsed, duration, started)]}</span>
        {started && <span className="text-xs">{journey[16]}</span>}
      </div>}
      <p className="max-w-3xl text-xs text-[#65786a]">{journey[11]}</p>
    </div>
    {view !== 'map' ? <Suspense fallback={<p role="status" className="p-12 text-center">{viewCopy.loading}</p>}><FocusRoomImmersive scene={scene} atmosphere={atmosphere} elapsed={elapsed} started={started} running={active} participants={participants} mode={view} onMove={move} onSeat={chooseSeat} onUnavailable={()=>{setUnavailable(true);setView('map');}}/></Suspense> : <div className="overflow-auto bg-[#e4d9c0]" dir="ltr">
      <div className="relative mx-auto cursor-crosshair" style={{ width: zoomed ? '150%' : '100%', maxWidth: zoomed ? undefined : '900px' }} onClick={moveFromPointer} aria-label={copy.space}>
        <FocusRoomWorld scene={scene} participants={participants} walking={walking} deskLabel={copy.desk} selectedSeat={selectedSeat} />
      </div>
    </div>}
    <div className="border-t border-[#dce3d7] bg-[#fcfaf4] px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#65786a]"><span>{copy.chooseDesk}</span><span>{selectedSeat >= 0 ? `${copy.desk} ${selectedSeat + 1} · ${copy[activity]} · ${me?.durationMinutes || 25} ${copy.minutes}` : copy.move}</span></div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{FOCUS_SEATS.map((seat, index) => {
        const occupied = occupiedFocusSeat(seat, participants);
        return <button key={index} type="button" disabled={occupied} aria-current={selectedSeat === index ? 'true' : undefined}
          onClick={() => chooseSeat(seat)} aria-label={`${copy.desk} ${index + 1}: ${occupied ? copy.occupied : copy.sit}`}
          className={cn('rounded-xl border border-[#dae1d4] px-2 py-2.5 text-xs text-[#5f7566] transition-colors hover:bg-[#e9eee1] disabled:cursor-not-allowed disabled:opacity-45', selectedSeat === index && 'border-[#68917c] bg-[#dce9dd] font-semibold text-[#28553e]')}>
          {copy.desk} {index + 1}{occupied ? ` · ${copy.occupied}` : ''}
        </button>;
      })}</div>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#dce3d7] bg-[#eef1e6] px-4 py-4 sm:px-6">
      <div className="flex items-center gap-4"><div className="font-mono text-3xl font-semibold tracking-tight text-[#304c3e] sm:text-4xl" role="timer">{timer}</div><div className="text-[11px] leading-5 text-[#6d816f]"><div>{active ? copy.focusing : copy.preparing}</div><div>{participants.length} {copy.connected}</div></div></div>
      <div className="flex gap-2"><Button onClick={toggle} className="gap-2 rounded-full bg-[#365f49] px-5 text-[#fffcf1] hover:bg-[#284d3a]">{active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{active ? copy.pause : copy.start}</Button><Button size="icon" variant="ghost" className="rounded-full text-[#607568]" onClick={onReset} aria-label={copy.reset}><RotateCcw className="h-4 w-4" /></Button></div>
    </footer>
  </section>;
}
