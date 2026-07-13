import { Coffee, Library, LogOut, Mic, MicOff, Pause, Plane, Play, RotateCcw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Scene = "library" | "plane" | "cafe" | "office";

const SCENES = {
  library: { icon: Library, sky: "from-[#20140f] via-[#714224] to-[#d39a59]", glow: "bg-amber-200/35", label: "Tabro Library" },
  plane: { icon: Plane, sky: "from-[#071c39] via-[#184d77] to-[#86d2e8]", glow: "bg-cyan-100/40", label: "Focus Flight" },
  cafe: { icon: Coffee, sky: "from-[#341d2a] via-[#9a4f48] to-[#f0b66f]", glow: "bg-orange-100/35", label: "Quiet Cafe" },
  office: { icon: Users, sky: "from-[#10263b] via-[#276b73] to-[#9dd5c2]", glow: "bg-emerald-100/35", label: "Tabro Cowork" },
} as const;

const COLORS = ["bg-rose-300", "bg-sky-300", "bg-amber-300", "bg-emerald-300", "bg-violet-300", "bg-orange-300"];

export function FocusRoomInterior({ scene, name, topic, username, people, timer, active, onToggle, onReset, onLeave }: {
  scene: Scene; name: string; topic: string; username: string; people: number; timer: string; active: boolean;
  onToggle: () => void; onReset: () => void; onLeave: () => void;
}) {
  const config = SCENES[scene];
  const SceneIcon = config.icon;
  const participants = Math.max(4, Math.min(8, people || 6));

  return (
    <section className={cn("relative isolate min-h-[430px] overflow-hidden rounded-[2rem] bg-gradient-to-br text-white shadow-xl", config.sky)} aria-label={name}>
      <div className={cn("absolute -start-24 -top-24 h-72 w-72 rounded-full blur-3xl", config.glow)} />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
      {scene === "library" && <div className="absolute inset-x-6 top-24 grid grid-cols-2 gap-8 opacity-70"><div className="h-40 rounded-xl border-[12px] border-[#512d18] bg-[repeating-linear-gradient(0deg,#b56c35_0_12px,#f2bd6e_12px_19px)]" /><div className="h-40 rounded-xl border-[12px] border-[#512d18] bg-[repeating-linear-gradient(0deg,#6d3728_0_13px,#d7924d_13px_20px)]" /></div>}
      {scene === "plane" && <div className="absolute inset-x-10 top-24 flex justify-around">{[0, 1, 2, 3].map((item) => <div key={item} className="h-20 w-28 rounded-[45%] border-8 border-white/25 bg-sky-100/70 shadow-inner" />)}</div>}
      {(scene === "cafe" || scene === "office") && <div className="absolute inset-x-10 top-20 grid grid-cols-4 gap-5">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-t-[3rem] border-4 border-white/15 bg-black/15" />)}</div>}

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div><div className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> LIVE · {config.label}</div><h2 className="mt-3 text-2xl font-black sm:text-3xl">{name}</h2><p className="mt-1 text-sm text-white/75">{topic}</p></div>
        <div className="flex gap-2"><Button size="icon" variant="secondary" className="rounded-full bg-white/15 text-white hover:bg-white/25" title="מיקרופון יופעל רק לאחר הרשאה"><MicOff className="h-4 w-4" /></Button><Button size="icon" variant="secondary" className="rounded-full bg-white/15 text-white hover:bg-white/25" onClick={onLeave} aria-label="צא מהחדר"><LogOut className="h-4 w-4" /></Button></div>
      </div>

      <div className="relative z-10 mx-auto mt-10 flex max-w-4xl flex-wrap items-end justify-center gap-4 px-4 sm:gap-7">
        {Array.from({ length: participants }).map((_, index) => {
          const isMe = index === Math.floor(participants / 2);
          const label = isMe ? (username.trim() || "אני") : ["Noa", "Sam", "Maya", "Leo", "Ari", "Lina", "Dan"][index % 7];
          return <div key={`${label}-${index}`} className="group flex w-20 flex-col items-center">
            <div className="mb-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] backdrop-blur">{label}</div>
            <div className={cn("relative h-14 w-14 rounded-full border-4 shadow-lg", isMe ? "border-cyan-300 ring-4 ring-cyan-300/25" : "border-white/60", COLORS[index % COLORS.length])}><div className="absolute inset-x-2 top-4 h-2 rounded-full bg-slate-800/75" /><div className="absolute -bottom-5 left-1/2 h-8 w-16 -translate-x-1/2 rounded-t-[2rem] bg-slate-900" /></div>
            <div className="mt-4 h-4 w-20 rounded-t-xl bg-amber-900/80 shadow" />
          </div>;
        })}
      </div>

      <div className="relative z-20 mx-auto mt-9 flex w-[min(92%,620px)] flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/15 bg-slate-950/75 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3"><SceneIcon className="h-5 w-5 text-cyan-300" /><div><div className="font-mono text-3xl font-black tracking-tight sm:text-4xl">{timer}</div><div className="text-xs text-white/55">{participants} מתרכזים עכשיו</div></div></div>
        <div className="flex gap-2"><Button onClick={onToggle} className="rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{active ? "השהה" : "התחל יחד"}</Button><Button size="icon" variant="secondary" className="rounded-full" onClick={onReset}><RotateCcw className="h-4 w-4" /></Button></div>
      </div>
      <div className="relative z-10 mt-3 pb-4 text-center text-[11px] text-white/55"><Mic className="me-1 inline h-3 w-3" />קול הוא אופציונלי ודורש אישור מפורש</div>
    </section>
  );
}
