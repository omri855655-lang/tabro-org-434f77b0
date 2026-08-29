import { type KeyboardEvent, type MouseEvent } from "react";
import { Coffee, Headphones, Library, LogOut, MicOff, Pause, Plane, Play, Radio, RotateCcw, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import cozyLibraryRoom from "@/assets/zoneflow/cozy-library-room-v2.png";

export type FocusRoomScene = "library" | "plane" | "cafe" | "office";

export interface FocusRoomParticipant {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  status: "setting-up" | "focusing" | "break" | "away";
  color?: string;
  isMe?: boolean;
}

const SCENES = {
  library: { icon: Library, sky: "from-[#20140f] via-[#714224] to-[#d39a59]", glow: "bg-amber-200/35", label: "Tabro Library" },
  plane: { icon: Plane, sky: "from-[#071c39] via-[#184d77] to-[#86d2e8]", glow: "bg-cyan-100/40", label: "Focus Flight" },
  cafe: { icon: Coffee, sky: "from-[#341d2a] via-[#9a4f48] to-[#f0b66f]", glow: "bg-orange-100/35", label: "Quiet Cafe" },
  office: { icon: Users, sky: "from-[#10263b] via-[#276b73] to-[#9dd5c2]", glow: "bg-emerald-100/35", label: "Tabro Cowork" },
} as const;

const STATUS_LABELS = { "setting-up": "מתארגן", focusing: "בפוקוס", break: "בהפסקה", away: "לא זמין" } as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function FocusRoomInterior({ scene, name, topic, participants, timer, active, onToggle, onReset, onLeave, onMove }: {
  scene: FocusRoomScene;
  name: string;
  topic: string;
  participants: FocusRoomParticipant[];
  timer: string;
  active: boolean;
  onToggle: () => void;
  onReset: () => void;
  onLeave: () => void;
  onMove: (position: { x: number; y: number }) => void;
}) {
  const config = SCENES[scene];
  const SceneIcon = config.icon;
  const me = participants.find((participant) => participant.isMe);

  const moveFromPointer = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onMove({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 7, 93),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 28, 77),
    });
  };

  const moveFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!me || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const delta = 4;
    onMove({
      x: clamp(me.x + (event.key === "ArrowRight" ? delta : event.key === "ArrowLeft" ? -delta : 0), 7, 93),
      y: clamp(me.y + (event.key === "ArrowDown" ? delta : event.key === "ArrowUp" ? -delta : 0), 28, 77),
    });
  };

  return (
    <section
      className={cn("relative isolate min-h-[640px] overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br text-white shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60", config.sky, scene === "plane" && "zoneflow-flight-cabin")}
      aria-label={name}
      tabIndex={0}
      onKeyDown={moveFromKeyboard}
    >
      {scene === "library" && (
        <>
          <img src={cozyLibraryRoom} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#120b08]/25 via-transparent to-[#090605]/75" />
          <div className="zoneflow-library-light absolute left-[13%] top-[19%] h-64 w-32 -rotate-12 bg-gradient-to-b from-amber-100/30 to-transparent blur-2xl" />
          {Array.from({ length: 14 }, (_, index) => (
            <span
              key={`library-dust-${index}`}
              className="zoneflow-library-dust absolute h-1.5 w-1.5 rounded-full bg-amber-100/80 shadow-[0_0_8px_rgba(254,243,199,.9)]"
              style={{ left: `${8 + ((index * 17) % 82)}%`, top: `${25 + ((index * 23) % 48)}%`, animationDelay: `${index * -0.72}s`, animationDuration: `${7 + (index % 5)}s` }}
            />
          ))}
        </>
      )}
      <div className={cn("absolute -start-24 -top-24 h-72 w-72 rounded-full blur-3xl", config.glow)} />
      <div className="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      {scene === "plane" && <>
        <div className="absolute inset-x-6 top-24 flex justify-around">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="relative h-20 w-24 overflow-hidden rounded-[45%] border-8 border-slate-200/75 bg-gradient-to-b from-sky-100 via-sky-300 to-sky-500 shadow-[inset_0_0_25px_rgba(255,255,255,.8)]">
            <div className="zoneflow-flight-cloud absolute top-5 h-5 w-14 rounded-full bg-white/90 blur-[1px]" style={{ animationDelay: `${item * -1.8}s` }}><span className="absolute -top-2 start-3 h-6 w-7 rounded-full bg-white" /></div>
            <div className="absolute inset-x-0 bottom-3 h-px bg-white/70" />
          </div>)}
        </div>
        <div className="absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-2xl border border-cyan-100/20 bg-slate-950/55 px-4 py-2 text-center text-[10px] font-bold tracking-[0.18em] text-cyan-100 shadow-xl backdrop-blur-md">
          TABRO 270 · FOCUS FLIGHT<br /><span className="text-white/55">35,000 FT · DEEP WORK MODE</span>
        </div>
        <div className="absolute inset-x-[18%] bottom-28 top-52 rounded-t-[45%] border-x-8 border-white/10 bg-gradient-to-b from-slate-700/20 to-slate-950/45 shadow-[inset_0_30px_80px_rgba(125,211,252,.09)]" />
        <div className="zoneflow-flight-route absolute bottom-32 left-1/2 top-56 w-1 -translate-x-1/2 bg-gradient-to-b from-cyan-200/10 via-cyan-200/65 to-cyan-200/10 shadow-[0_0_20px_rgba(103,232,249,.55)]" />
      </>}
      {scene === "cafe" && <><div className="absolute inset-x-10 top-24 grid grid-cols-4 gap-5">{[0, 1, 2, 3].map((item) => <div key={item} className="h-32 rounded-t-[3rem] border-4 border-amber-100/20 bg-black/20 shadow-inner" />)}</div><div className="absolute end-8 top-52 h-40 w-36 rounded-2xl border border-white/10 bg-[#2a1714]/80 shadow-2xl"><div className="m-4 h-8 rounded bg-amber-300/60" /><div className="mx-4 mt-3 grid grid-cols-3 gap-2">{[0,1,2,3,4,5].map(i => <div key={i} className="h-5 rounded bg-white/15" />)}</div></div></>}
      {scene === "office" && <><div className="absolute inset-x-8 top-24 grid grid-cols-5 gap-4">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-t-3xl border border-white/15 bg-gradient-to-b from-cyan-100/20 to-slate-950/10" />)}</div><div className="absolute start-10 top-44 h-48 w-20 rounded-full bg-emerald-300/20 blur-xl" /></>}

      <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div><div className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> LIVE · {config.label}</div><h2 className="mt-3 text-2xl font-black sm:text-3xl">{name}</h2><p className="mt-1 text-sm text-white/75">{topic}</p></div>
        <div className="flex flex-wrap gap-2"><div className="hidden items-center gap-2 rounded-full bg-black/25 px-3 py-2 text-xs backdrop-blur sm:flex"><Radio className="h-4 w-4 text-amber-300" />Ambient focus</div><Button size="icon" variant="secondary" className="rounded-full bg-white/15 text-white hover:bg-white/25" title="חדר שקט. קול יתווסף רק בחדרים ייעודיים"><MicOff className="h-4 w-4" /></Button><Button size="icon" variant="secondary" className="rounded-full bg-white/15 text-white hover:bg-white/25" onClick={onLeave} aria-label="צא מהחדר"><LogOut className="h-4 w-4" /></Button></div>
      </div>

      <div className="absolute bottom-28 end-3 top-28 z-30 hidden w-52 rounded-3xl border border-white/15 bg-slate-950/65 p-3 backdrop-blur-xl lg:block"><div className="flex items-center justify-between text-xs font-bold"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" />בחדר עכשיו</span><span>{participants.length}</span></div><div className="mt-3 space-y-2">{participants.map((participant) => <div key={participant.userId} className="flex items-center gap-2 rounded-xl bg-white/8 p-2"><div className={cn("h-8 w-8 rounded-full border-2 border-white/30", participant.color || "bg-sky-300")} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{participant.displayName}</div><div className="text-[9px] text-white/55">{STATUS_LABELS[participant.status]}</div></div>{participant.status === "focusing" && <Headphones className="h-3.5 w-3.5 text-emerald-300" />}</div>)}</div><div className="mt-4 rounded-2xl bg-white/8 p-3 text-[10px] leading-5 text-white/60"><Sparkles className="mb-1 h-4 w-4 text-amber-300" />עובדים יחד בשקט. אפשר לזוז לשולחן אחר בלי להפריע לאחרים.</div></div>

      <div className="absolute bottom-28 end-4 start-4 top-24 z-10 cursor-crosshair overflow-hidden rounded-[1.5rem] lg:end-60" onClick={moveFromPointer} aria-label="מרחב החדר. לחץ כדי להזיז את הדמות">
        <div className={cn("absolute inset-x-[4%] bottom-[3%] top-[38%] border border-white/10 shadow-[inset_0_30px_80px_rgba(255,255,255,0.08)]", scene === "plane" ? "rounded-[50%_50%_20%_20%] bg-black/15" : scene === "library" ? "rounded-[42%] bg-transparent" : "rounded-[42%] bg-black/15")} />
        {scene !== "plane" && scene !== "library" && [18, 40, 62, 82].map((x, index) => <div key={x} className="absolute h-12 w-24 -translate-x-1/2 rounded-md border-t-4 border-amber-100/25 bg-[#3b241d]/80 shadow-xl" style={{ left: `${x}%`, top: `${55 + (index % 2) * 16}%` }}><div className="mx-auto -mt-5 h-8 w-14 rounded-t-lg bg-slate-900/80" /></div>)}
        {scene === "plane" && [25, 42, 58, 75].flatMap((y) => [28, 72].map((x) => <div key={`${x}-${y}`} className="absolute h-12 w-16 -translate-x-1/2 rounded-t-2xl border border-cyan-100/20 bg-gradient-to-b from-slate-600 to-slate-900 shadow-[0_8px_18px_rgba(0,0,0,.4)]" style={{ left: `${x}%`, top: `${y}%` }}><div className="mx-auto mt-2 h-5 w-10 rounded-t-xl border border-white/10 bg-slate-800" /></div>))}
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-[left,top] duration-500 ease-out"
            style={{ left: `${participant.x}%`, top: `${participant.y}%` }}
          >
            <div className="mb-1 max-w-24 truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] backdrop-blur">{participant.displayName}</div>
            <div className="zoneflow-avatar-idle relative">
              <div className={cn("relative h-12 w-12 rounded-full border-4 shadow-xl", participant.isMe ? "border-cyan-300 ring-4 ring-cyan-300/25" : "border-white/60", participant.color || "bg-sky-300")}><div className="absolute start-2.5 top-3 h-1.5 w-1.5 rounded-full bg-slate-900" /><div className="absolute end-2.5 top-3 h-1.5 w-1.5 rounded-full bg-slate-900" /><div className="absolute inset-x-3 top-7 h-1 rounded-full bg-slate-800/65" /><div className="absolute -bottom-5 left-1/2 h-8 w-14 -translate-x-1/2 rounded-t-[2rem] bg-slate-900" /></div>
              {participant.status === "focusing" && <span className="absolute -end-2 -top-2 h-3 w-3 animate-ping rounded-full bg-emerald-300" />}
            </div>
            <div className={cn("mt-5 rounded-full px-2 py-0.5 text-[9px]", participant.status === "focusing" ? "bg-emerald-400/90 text-emerald-950" : "bg-white/20")}>{STATUS_LABELS[participant.status]}</div>
          </div>
        ))}
        {participants.length <= 1 && <div className="absolute inset-x-0 top-[46%] text-center text-xs text-white/55">החדר פתוח. משתתפים אמיתיים יופיעו כאן כשהם יצטרפו.</div>}
        <div className="absolute bottom-2 start-3 rounded-full bg-black/35 px-3 py-1 text-[10px] text-white/65">{scene === "plane" ? "הטיסה בעיצומה · בחר מושב והתחל פוקוס" : "לחץ במרחב או השתמש בחצים כדי לזוז"}</div>
      </div>

      <div className="absolute inset-x-0 bottom-4 z-30 mx-auto flex w-[min(92%,620px)] flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/15 bg-slate-950/80 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3"><SceneIcon className="h-5 w-5 text-cyan-300" /><div><div className="font-mono text-3xl font-black tracking-tight sm:text-4xl">{timer}</div><div className="text-xs text-white/55">{participants.length} מחוברים עכשיו</div></div></div>
        <div className="flex gap-2"><Button onClick={onToggle} className="rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{active ? "השהה" : "התחל פוקוס"}</Button><Button size="icon" variant="secondary" className="rounded-full" onClick={onReset}><RotateCcw className="h-4 w-4" /></Button></div>
      </div>
    </section>
  );
}
