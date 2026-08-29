import { useEffect, useMemo, useRef, useState } from "react";
import { Award, BarChart3, Check, Clock3, Coins, Flame, Leaf, Pause, Play, RotateCcw, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import type { AudioPreset } from "./zoneflowAudioPresets";
import { ZoneFlowFocusRoom } from "./ZoneFlowFocusRoom";

export type FocusMode = "simple" | "gamified";

export interface UnifiedFocusSession {
  id: string;
  type: string;
  duration: number;
  plannedDuration?: number;
  frequency: string;
  timestamp: Date | string;
  mode?: FocusMode | "stopwatch";
  completed?: boolean;
}

interface ZoneFlowFocusDeckProps {
  sessions: UnifiedFocusSession[];
  rewardBalance: number;
  activeSoundId: string | null;
  isSoundPlaying: boolean;
  isSoundLoading: boolean;
  soundVolume: number;
  soundOptions: AudioPreset[];
  onSoundToggle: (preset: AudioPreset) => void;
  onSoundVolumeChange: (volume: number) => void;
  onSessionLogged: (session: UnifiedFocusSession) => void;
}

const FOCUS_PRESETS = [25, 45, 60, 90];

const readStoredNumber = (key: string, fallback: number) => {
  const value = Number(safeLocalStorage.getString(key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
};

const sessionId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `focus-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const dateKey = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const sessionDate = (session: UnifiedFocusSession) => new Date(session.timestamp);

export function ZoneFlowFocusDeck({
  sessions,
  rewardBalance,
  activeSoundId,
  isSoundPlaying,
  isSoundLoading,
  soundVolume,
  soundOptions,
  onSoundToggle,
  onSoundVolumeChange,
  onSessionLogged,
}: ZoneFlowFocusDeckProps) {
  const [mode, setMode] = useState<FocusMode>(() => safeLocalStorage.getString("zoneflow-focus-mode", "simple") === "gamified" ? "gamified" : "simple");
  const [focusMinutes, setFocusMinutes] = useState(() => Math.max(1, readStoredNumber("zoneflow-focus-minutes", 25)));
  const [breakMinutes, setBreakMinutes] = useState(() => Math.max(1, readStoredNumber("zoneflow-break-minutes", 5)));
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
  const [timeLeft, setTimeLeft] = useState(focusMinutes * 60);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [lastSummary, setLastSummary] = useState<{ minutes: number; coins: number } | null>(null);
  const targetEndRef = useRef<number | null>(null);
  const initialSeconds = (phase === "focus" ? focusMinutes : breakMinutes) * 60;
  const elapsedSeconds = Math.max(0, initialSeconds - timeLeft);
  const progress = initialSeconds > 0 ? Math.min(100, (elapsedSeconds / initialSeconds) * 100) : 0;

  useEffect(() => { safeLocalStorage.setString("zoneflow-focus-mode", mode); }, [mode]);
  useEffect(() => { safeLocalStorage.setString("zoneflow-focus-minutes", String(focusMinutes)); }, [focusMinutes]);
  useEffect(() => { safeLocalStorage.setString("zoneflow-break-minutes", String(breakMinutes)); }, [breakMinutes]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("zoneflow-focus-state", { detail: { active: status === "running", mode, phase } }));
  }, [mode, phase, status]);

  useEffect(() => {
    if (status !== "running") return;
    const interval = window.setInterval(() => {
      if (!targetEndRef.current) return;
      setTimeLeft(Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== "running" || timeLeft !== 0) return;
    setStatus("idle");
    if (phase === "break") {
      setPhase("focus");
      setTimeLeft(focusMinutes * 60);
      return;
    }

    const completedSession: UnifiedFocusSession = {
      id: sessionId(),
      type: "focus",
      duration: focusMinutes,
      plannedDuration: focusMinutes,
      frequency: activeSoundId || "none",
      timestamp: new Date(),
      mode,
      completed: true,
    };
    onSessionLogged(completedSession);
    const earnedCoins = mode === "gamified" ? focusMinutes : 0;
    setLastSummary({ minutes: focusMinutes, coins: earnedCoins });
    setSummaryOpen(true);
    targetEndRef.current = null;
  }, [activeSoundId, focusMinutes, mode, onSessionLogged, phase, status, timeLeft]);

  const completedSessions = useMemo(() => sessions.filter((session) => session.completed !== false), [sessions]);
  const stats = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const minutesSince = (start: Date) => completedSessions.filter((session) => sessionDate(session) >= start).reduce((sum, session) => sum + session.duration, 0);
    const activeDays = new Set(completedSessions.map((session) => dateKey(sessionDate(session))));
    let streak = 0;
    const cursor = new Date(dayStart);
    while (activeDays.has(dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { today: minutesSince(dayStart), week: minutesSince(weekStart), month: minutesSince(monthStart), streak };
  }, [completedSessions]);

  const gamifiedMinutes = completedSessions.filter((session) => session.mode === "gamified").reduce((sum, session) => sum + session.duration, 0);
  const level = Math.floor(gamifiedMinutes / 120) + 1;
  const levelProgress = ((gamifiedMinutes % 120) / 120) * 100;

  const resetTimer = (nextPhase = phase) => {
    setStatus("idle");
    setPhase(nextPhase);
    setTimeLeft((nextPhase === "focus" ? focusMinutes : breakMinutes) * 60);
    targetEndRef.current = null;
  };

  const startOrPause = () => {
    if (status === "running") {
      setStatus("paused");
      targetEndRef.current = null;
      return;
    }
    targetEndRef.current = Date.now() + timeLeft * 1000;
    setStatus("running");
  };

  const stopSession = () => {
    if (phase === "focus" && elapsedSeconds >= 30) {
      onSessionLogged({
        id: sessionId(),
        type: "focus",
        duration: Math.max(1, Math.floor(elapsedSeconds / 60)),
        plannedDuration: focusMinutes,
        frequency: activeSoundId || "none",
        timestamp: new Date(),
        mode,
        completed: false,
      });
    }
    resetTimer("focus");
  };

  const updateFocusDuration = (minutes: number) => {
    if (status !== "idle") return;
    const normalized = Math.max(1, Math.min(240, minutes));
    setFocusMinutes(normalized);
    if (phase === "focus") setTimeLeft(normalized * 60);
  };

  const switchMode = (nextMode: FocusMode) => {
    if (status !== "idle" || elapsedSeconds > 0) return;
    setMode(nextMode);
  };

  const beginBreak = () => {
    setSummaryOpen(false);
    resetTimer("break");
  };

  const beginNewSession = () => {
    setSummaryOpen(false);
    resetTimer("focus");
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(243,248,246,0.96))] text-slate-900 shadow-[0_24px_70px_rgba(20,55,50,0.16)] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(18,35,34,0.98),rgba(9,21,21,0.98))] dark:text-white" dir="rtl">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:px-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-emerald-700 dark:text-emerald-300"><Leaf className="h-4 w-4" /> ZONEFLOW FOCUS</div>
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">מרחב עבודה שקט, בקצב שלך</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-white/55">אותו טיימר ואותה היסטוריה, עם חוויה נקייה או מסלול התקדמות חי.</p>
          </div>
          <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-white/5">
            <button className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${mode === "simple" ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white"}`} onClick={() => switchMode("simple")} disabled={status !== "idle" || elapsedSeconds > 0}>פשוט ונקי</button>
            <button className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${mode === "gamified" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white"}`} onClick={() => switchMode("gamified")} disabled={status !== "idle" || elapsedSeconds > 0}><Sparkles className="ms-1 inline h-4 w-4" />מסלול צמיחה</button>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 p-5 sm:p-7 ${mode === "gamified" ? "lg:grid-cols-[1.05fr_0.95fr]" : "lg:grid-cols-[1fr_0.72fr]"}`}>
        <div className="space-y-5">
          {mode === "gamified" && <ZoneFlowFocusRoom running={status === "running"} progress={progress} level={level} />}
          <div className={`rounded-[1.75rem] border p-5 sm:p-7 ${mode === "simple" ? "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]" : "border-emerald-900/15 bg-emerald-950 text-white shadow-[0_18px_50px_rgba(6,78,59,0.22)]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-medium ${mode === "simple" ? "text-slate-500 dark:text-white/50" : "text-emerald-200/75"}`}>{phase === "focus" ? "זמן ריכוז" : "הפסקה מכוונת"}</p>
                <div className="mt-1 font-mono text-6xl font-semibold tabular-nums tracking-[-0.08em] sm:text-7xl">{formatClock(timeLeft)}</div>
              </div>
              <div className={`rounded-2xl px-3 py-2 text-xs ${mode === "simple" ? "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/60" : "bg-white/10 text-white/75"}`}>
                {status === "running" ? "בפוקוס עכשיו" : status === "paused" ? "מושהה, אפשר להמשיך" : "מוכן להתחלה"}
              </div>
            </div>
            <div className={`mt-5 h-2 overflow-hidden rounded-full ${mode === "simple" ? "bg-slate-100 dark:bg-white/10" : "bg-white/10"}`}><div className={`h-full rounded-full transition-[width] duration-700 ${mode === "simple" ? "bg-slate-900 dark:bg-emerald-300" : "bg-gradient-to-r from-amber-200 to-emerald-300"}`} style={{ width: `${progress}%` }} /></div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button onClick={startOrPause} className={`h-12 min-w-36 rounded-xl text-base ${mode === "gamified" ? "bg-emerald-300 text-emerald-950 hover:bg-emerald-200" : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"}`}>
                {status === "running" ? <><Pause className="ms-2 h-4 w-4" />השהה</> : <><Play className="ms-2 h-4 w-4 fill-current" />{status === "paused" ? "המשך" : "התחל"}</>}
              </Button>
              <Button variant="outline" className={`h-12 rounded-xl ${mode === "gamified" ? "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" : ""}`} onClick={stopSession} disabled={status === "idle" && elapsedSeconds === 0}><Square className="ms-2 h-4 w-4" />סיום מוקדם</Button>
              <Button variant="ghost" size="icon" className={`h-12 w-12 rounded-xl ${mode === "gamified" ? "text-white/60 hover:bg-white/10 hover:text-white" : ""}`} onClick={() => resetTimer()} title="איפוס"><RotateCcw className="h-4 w-4" /></Button>
            </div>
            {mode === "gamified" && <p className="mt-4 text-xs leading-6 text-emerald-100/65">עזיבה מוקדמת נרשמת בהיסטוריה, אך מטבעות הסשן אינם מתווספים. השהיה אינה מבטלת את ההתקדמות.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-semibold text-slate-500 dark:text-white/50">משך הסשן</p>
            <div className="mt-3 grid grid-cols-4 gap-2">{FOCUS_PRESETS.map((minutes) => <button key={minutes} disabled={status !== "idle"} onClick={() => updateFocusDuration(minutes)} className={`rounded-xl border py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${focusMinutes === minutes ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200" : "border-slate-200 hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"}`}>{minutes}</button>)}</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500 dark:text-white/50">ריכוז בדקות<input type="number" min={1} max={240} value={focusMinutes} disabled={status !== "idle"} onChange={(event) => updateFocusDuration(Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-base font-semibold outline-none focus:border-emerald-500 dark:border-white/10" /></label>
              <label className="text-xs text-slate-500 dark:text-white/50">הפסקה בדקות<input type="number" min={1} max={60} value={breakMinutes} disabled={status !== "idle"} onChange={(event) => setBreakMinutes(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-base font-semibold outline-none focus:border-emerald-500 dark:border-white/10" /></label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="h-4 w-4 text-emerald-600" />צליל רקע</p><span className="text-xs text-slate-400">{Math.round(soundVolume * 100)}%</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => activeSoundId && onSoundToggle(soundOptions.find((option) => option.id === activeSoundId) || soundOptions[0])} className={`rounded-xl border px-3 py-2 text-sm ${!isSoundPlaying && !isSoundLoading ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" : "border-slate-200 dark:border-white/10"}`}><VolumeX className="ms-1 inline h-4 w-4" />שקט</button>{soundOptions.slice(0, 3).map((preset) => <button key={preset.id} onClick={() => onSoundToggle(preset)} className={`rounded-xl border px-3 py-2 text-sm transition-colors ${activeSoundId === preset.id && (isSoundPlaying || isSoundLoading) ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" : "border-slate-200 hover:border-slate-400 dark:border-white/10"}`}>♪ {preset.nameHe || preset.name}</button>)}</div>
            <input aria-label="עוצמת צליל" type="range" min={0} max={1} step={0.05} value={soundVolume} onChange={(event) => onSoundVolumeChange(Number(event.target.value))} className="mt-4 w-full accent-emerald-600" />
          </div>

          {mode === "gamified" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-200/15 dark:bg-amber-300/[0.07]"><div className="flex items-center justify-between"><div><p className="text-xs text-amber-700 dark:text-amber-200/70">רמת הגן</p><strong className="text-xl">שלב {level}</strong></div><div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-amber-800 shadow-sm dark:bg-white/10 dark:text-amber-100"><Coins className="h-4 w-4" />{gamifiedMinutes}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${levelProgress}%` }} /></div><p className="mt-2 text-xs text-amber-700/75 dark:text-amber-100/55">עוד {120 - (gamifiedMinutes % 120)} דקות לפתיחת השלב הבא · יתרת פרסים כללית: {rewardBalance}</p></div>}
        </div>
      </div>

      <div className="grid border-t border-slate-200/70 bg-slate-50/70 dark:border-white/10 dark:bg-black/10 sm:grid-cols-4">
        {[{ label: "היום", value: `${stats.today} דק׳`, icon: Clock3 }, { label: "השבוע", value: `${stats.week} דק׳`, icon: BarChart3 }, { label: "החודש", value: `${stats.month} דק׳`, icon: Award }, { label: "רצף", value: `${stats.streak} ימים`, icon: Flame }].map(({ label, value, icon: Icon }, index) => <div key={label} className={`flex items-center gap-3 px-5 py-4 ${index ? "border-t border-slate-200/70 dark:border-white/10 sm:border-r sm:border-t-0" : ""}`}><div className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/5"><Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /></div><div><p className="text-xs text-slate-500 dark:text-white/45">{label}</p><strong>{value}</strong></div></div>)}
      </div>

      <div className="border-t border-slate-200/70 p-5 dark:border-white/10 sm:px-7">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">סשנים אחרונים</h3><span className="text-xs text-slate-400">משותף לשני המצבים</span></div>
        {sessions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-sm text-slate-400 dark:border-white/10">הסשן הראשון שלך יופיע כאן</p> : <div className="grid gap-2 md:grid-cols-2">{sessions.slice(0, 6).map((session) => <div key={session.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"><div className={`rounded-full p-1.5 ${session.completed === false ? "bg-rose-100 text-rose-600 dark:bg-rose-400/10" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"}`}>{session.completed === false ? <Square className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.mode === "gamified" ? "מסלול צמיחה" : session.mode === "stopwatch" ? "סטופר" : "פוקוס פשוט"}</p><p className="text-xs text-slate-400">{sessionDate(session).toLocaleDateString("he-IL")} · {session.duration} דקות</p></div><span className="text-xs text-slate-400">{session.completed === false ? "לא הושלם" : "הושלם"}</span></div>)}</div>}
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="overflow-hidden border-0 bg-[linear-gradient(145deg,#f9fbf7,#eef7f1)] text-slate-900 sm:max-w-md" dir="rtl">
          <div className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full bg-amber-200/50 blur-2xl" />
          <DialogHeader className="relative items-center text-center"><div className="mb-3 rounded-full bg-emerald-700 p-4 text-white shadow-[0_12px_30px_rgba(4,120,87,0.28)]"><Award className="h-8 w-8" /></div><DialogTitle className="font-serif text-3xl">סשן הושלם בהצלחה</DialogTitle><DialogDescription className="text-center">שמירה על הקצב חשובה יותר משלמות. ההתקדמות נשמרה בהיסטוריה.</DialogDescription></DialogHeader>
          <div className="relative my-5 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white p-3 text-center shadow-sm"><strong className="block text-2xl">{lastSummary?.minutes || 0}</strong><span className="text-xs text-slate-500">דקות</span></div><div className="rounded-2xl bg-white p-3 text-center shadow-sm"><strong className="block text-2xl">{stats.today}</strong><span className="text-xs text-slate-500">היום</span></div><div className="rounded-2xl bg-white p-3 text-center shadow-sm"><strong className="block text-2xl">{stats.streak}</strong><span className="text-xs text-slate-500">רצף</span></div></div>
          {lastSummary?.coins ? <p className="relative mb-4 rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-medium text-amber-900"><Coins className="ms-1 inline h-4 w-4" />נוספו {lastSummary.coins} מטבעות צמיחה</p> : null}
          <div className="relative grid grid-cols-2 gap-2"><Button variant="outline" className="h-11" onClick={beginNewSession}>סשן נוסף</Button><Button className="h-11 bg-emerald-700 hover:bg-emerald-800" onClick={beginBreak}>התחל הפסקה</Button></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
