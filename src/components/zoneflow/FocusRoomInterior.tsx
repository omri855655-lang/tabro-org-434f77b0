import { type KeyboardEvent, type MouseEvent } from "react";
import { Coffee, Library, LogOut, MicOff, Pause, Plane, Play, RotateCcw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      className={cn("relative isolate min-h-[540px] overflow-hidden rounded-[2rem] bg-gradient-to-br text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60", config.sky)}
      aria-label={name}
      tabIndex={0}
      onKeyDown={moveFromKeyboard}
    >
      <div className={cn("absolute -start-24 -top-24 h-72 w-72 rounded-full blur-3xl", config.glow)} />
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {scene === "library" && <div className="absolute inset-x-6 top-24 grid grid-cols-2 gap-8 opacity-70"><div className="h-40 rounded-xl border-[12px] border-[#512d18] bg-[repeating-linear-gradient(0deg,#b56c35_0_12px,#f2bd6e_12px_19px)]" /><div className="h-40 rounded-xl border-[12px] border-[#512d18] bg-[repeating-linear-gradient(0deg,#6d3728_0_13px,#d7924d_13px_20px)]" /></div>}
      {scene === "plane" && <div className="absolute inset-x-10 top-24 flex justify-around">{[0, 1, 2, 3].map((item) => <div key={item} className="h-20 w-28 rounded-[45%] border-8 border-white/25 bg-sky-100/70 shadow-inner" />)}</div>}
      {(scene === "cafe" || scene === "office") && <div className="absolute inset-x-10 top-20 grid grid-cols-4 gap-5">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-t-[3rem] border-4 border-white/15 bg-black/15" />)}</div>}

      <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div><div className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> LIVE · {config.label}</div><h2 className="mt-3 text-2xl font-black sm:text-3xl">{name}</h2><p className="mt-1 text-sm text-white/75">{topic}</p></div>
        <div className="flex gap-2"><Button size="icon" variant="secondary" className="rounded-full bg-white/15 text-white hover:bg-white/25" title="חדר שקט. קול יתווסף רק בחדרים ייעודיים"><MicOff className="h-4 w-4" /></Button><Button size="icon" variant="secondary" className="rounded-full bg-white/15 text-white hover:bg-white/25" onClick={onLeave} aria-label="צא מהחדר"><LogOut className="h-4 w-4" /></Button></div>
      </div>

      <div className="absolute inset-x-4 bottom-28 top-24 z-10 cursor-crosshair overflow-hidden rounded-[1.5rem]" onClick={moveFromPointer} aria-label="מרחב החדר. לחץ כדי להזיז את הדמות">
        <div className="absolute inset-x-[4%] bottom-[4%] top-[42%] rounded-[45%] border border-white/10 bg-black/15 shadow-[inset_0_30px_80px_rgba(255,255,255,0.08)]" />
        {[18, 38, 58, 78].map((x) => <div key={x} className="absolute top-[59%] h-3 w-20 -translate-x-1/2 rounded-full bg-black/25" style={{ left: `${x}%` }} />)}
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-[left,top] duration-500 ease-out"
            style={{ left: `${participant.x}%`, top: `${participant.y}%` }}
          >
            <div className="mb-1 max-w-24 truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] backdrop-blur">{participant.displayName}</div>
            <div className={cn("relative h-12 w-12 rounded-full border-4 shadow-xl", participant.isMe ? "border-cyan-300 ring-4 ring-cyan-300/25" : "border-white/60", participant.color || "bg-sky-300")}><div className="absolute inset-x-2 top-3.5 h-2 rounded-full bg-slate-800/75" /><div className="absolute -bottom-5 left-1/2 h-8 w-14 -translate-x-1/2 rounded-t-[2rem] bg-slate-900" /></div>
            <div className={cn("mt-5 rounded-full px-2 py-0.5 text-[9px]", participant.status === "focusing" ? "bg-emerald-400/90 text-emerald-950" : "bg-white/20")}>{STATUS_LABELS[participant.status]}</div>
          </div>
        ))}
        {participants.length <= 1 && <div className="absolute inset-x-0 top-[46%] text-center text-xs text-white/55">החדר פתוח. משתתפים אמיתיים יופיעו כאן כשהם יצטרפו.</div>}
        <div className="absolute bottom-2 start-3 rounded-full bg-black/35 px-3 py-1 text-[10px] text-white/65">לחץ במרחב או השתמש בחצים כדי לזוז</div>
      </div>

      <div className="absolute inset-x-0 bottom-4 z-30 mx-auto flex w-[min(92%,620px)] flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/15 bg-slate-950/80 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3"><SceneIcon className="h-5 w-5 text-cyan-300" /><div><div className="font-mono text-3xl font-black tracking-tight sm:text-4xl">{timer}</div><div className="text-xs text-white/55">{participants.length} מחוברים עכשיו</div></div></div>
        <div className="flex gap-2"><Button onClick={onToggle} className="rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{active ? "השהה" : "התחל פוקוס"}</Button><Button size="icon" variant="secondary" className="rounded-full" onClick={onReset}><RotateCcw className="h-4 w-4" /></Button></div>
      </div>
    </section>
  );
}
