import { useEffect, useState } from "react";
import { LockKeyhole, Move, Sparkles } from "lucide-react";
import { safeLocalStorage } from "@/lib/safeLocalStorage";

interface Position { x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ZoneFlowFocusRoom({ running, progress, level }: { running: boolean; progress: number; level: number }) {
  const [position, setPosition] = useState<Position>(() => safeLocalStorage.getJSON("zoneflow-room-position", { x: 52, y: 69 }));

  useEffect(() => safeLocalStorage.setJSON("zoneflow-room-position", position), [position]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setPosition((current) => ({
        x: clamp(current.x + (["ArrowRight", "d"].includes(event.key) ? 3 : ["ArrowLeft", "a"].includes(event.key) ? -3 : 0), 8, 92),
        y: clamp(current.y + (["ArrowDown", "s"].includes(event.key) ? 3 : ["ArrowUp", "w"].includes(event.key) ? -3 : 0), 42, 86),
      }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      role="application"
      aria-label="חדר ריכוז דו ממדי. אפשר להזיז את הדמות באמצעות החצים או לחיצה בחדר"
      tabIndex={0}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        setPosition({
          x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 8, 92),
          y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 42, 86),
        });
      }}
      className="group relative h-[22rem] cursor-crosshair overflow-hidden rounded-[2rem] border border-[#f7dfb4]/30 bg-[#122d2a] shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_24px_65px_rgba(8,31,28,.34)] outline-none ring-emerald-300/60 focus-visible:ring-2 sm:h-[27rem]"
    >
      <div className="absolute inset-x-0 top-0 h-[41%] bg-[linear-gradient(180deg,#173a38,#244944)]" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[#8b5f42] [background-image:linear-gradient(90deg,rgba(55,31,20,.22)_1px,transparent_1px),linear-gradient(rgba(55,31,20,.18)_1px,transparent_1px)] [background-size:42px_42px] [transform:perspective(420px)_rotateX(7deg)] [transform-origin:bottom]" />
      <div className="absolute inset-x-[12%] top-[28%] h-3 rounded-full bg-[#6a3f2b] shadow-[0_5px_0_#4d2f23]" />

      {[18, 43, 68].map((left) => <div key={left} className="absolute top-[7%] h-[20%] w-[18%] rounded-t-[1.4rem] border-[6px] border-[#603e2d] bg-[linear-gradient(180deg,#90cbd0_0_45%,#e7bd6b_46%_49%,#587e72_50%)] shadow-[inset_0_0_25px_rgba(255,245,194,.35)]" style={{ left: `${left}%` }}><div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-[#603e2d]" /></div>)}

      <div className="absolute left-[4%] top-[5%] h-[31%] w-[10%] rounded bg-[#4b2d22] p-1.5 shadow-xl">
        <div className="grid h-full grid-cols-3 gap-1">{Array.from({ length: 18 }).map((_, index) => <span key={index} className={`rounded-sm ${index % 4 === 0 ? "bg-[#d6a25c]" : index % 3 === 0 ? "bg-[#587868]" : "bg-[#a84f3e]"}`} />)}</div>
      </div>
      <div className="absolute right-[4%] top-[5%] h-[31%] w-[10%] rounded bg-[#4b2d22] p-1.5 shadow-xl">
        <div className="grid h-full grid-cols-3 gap-1">{Array.from({ length: 18 }).map((_, index) => <span key={index} className={`rounded-sm ${index % 4 === 0 ? "bg-[#d6a25c]" : index % 3 === 0 ? "bg-[#587868]" : "bg-[#a84f3e]"}`} />)}</div>
      </div>

      {[24, 58].map((left, index) => <div key={left} className="absolute top-[48%] h-[18%] w-[22%] rounded-md bg-[#75472f] shadow-[0_10px_0_#4e3024,0_18px_22px_rgba(37,21,15,.34)]" style={{ left: `${left}%` }}><div className="absolute -top-4 right-5 h-6 w-8 rounded bg-[#d8cdbd] shadow-md" /><div className={`absolute -top-7 left-7 h-8 w-8 rounded-full ${running ? "animate-pulse bg-[#ffe69a] shadow-[0_0_28px_#ffd86b]" : "bg-[#c9b271]"}`} /><div className="absolute -top-1 left-[29px] h-5 w-1 bg-[#b08b56]" />{index === 1 && level < 2 && <div className="absolute inset-0 grid place-items-center rounded-md bg-black/45 text-[11px] text-white"><LockKeyhole className="me-1 inline h-3 w-3" />רמה 2</div>}</div>)}

      {level >= 2 && <div className="absolute bottom-[8%] left-[8%] h-[22%] w-[15%]"><div className="absolute bottom-0 left-1/2 h-[42%] w-10 -translate-x-1/2 rounded-b-xl bg-[#9b6242]" /><div className={`absolute left-1/2 top-0 h-[70%] w-[72%] -translate-x-1/2 rounded-[50%] bg-[#4b8a62] ${running ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}`} /></div>}
      {level >= 3 && <div className="absolute bottom-[7%] right-[18%] h-[22%] w-[20%] rounded-[50%] border-4 border-[#cf9f63]/70 bg-[radial-gradient(circle,#d6bc78_0_15%,#8f5842_16%_35%,#315a50_36%)] opacity-90" />}

      <div className="absolute transition-[left,top] duration-200 ease-out" style={{ left: `${position.x}%`, top: `${position.y}%`, transform: "translate(-50%, -72%)" }}>
        <div className={`relative h-16 w-12 ${running ? "animate-[bounce_1.8s_ease-in-out_infinite]" : ""}`}>
          <div className="absolute left-1/2 top-0 h-9 w-9 -translate-x-1/2 rounded-[46%_46%_42%_42%] bg-[#dba77e] shadow-[inset_0_-3px_0_rgba(103,55,39,.16)]" />
          <div className="absolute left-1/2 top-0 h-4 w-10 -translate-x-1/2 rounded-t-full bg-[#33251f]" />
          <div className="absolute left-1/2 top-8 h-8 w-11 -translate-x-1/2 rounded-t-xl bg-[#d7a84c] shadow-lg" />
          <span className="absolute left-[15px] top-[19px] h-1 w-1 rounded-full bg-[#31231f]" /><span className="absolute right-[15px] top-[19px] h-1 w-1 rounded-full bg-[#31231f]" />
        </div>
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-[#102522]/80 px-2 py-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur">YOU</div>
      </div>

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-2 text-[11px] text-white/80 backdrop-blur-md"><Move className="h-3.5 w-3.5" />חצים / WASD / לחיצה</div>
      <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/20 px-3 py-2 text-[11px] text-white/80 backdrop-blur-md"><Sparkles className="me-1 inline h-3.5 w-3.5" />חדר רמה {level}</div>
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-[#0a211e]/75 p-3 text-white backdrop-blur-md">
        <div className="flex items-center justify-between text-[11px] text-white/70"><span>{running ? "החדר חי איתך בזמן הריכוז" : "התחל סשן כדי להאיר את החדר"}</span><strong>{Math.round(progress)}%</strong></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#f7cf77] via-[#9fdb9b] to-[#4fb8a7] transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
      </div>
      {running && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,221,139,.12),transparent_45%)] animate-pulse [animation-duration:4s]" />}
    </div>
  );
}
