import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { LEARNING_PATHS, learningLabels, type learningCopy } from '@/lib/learningCopy';
import { learningDrawCopy } from '@/lib/learningDraw';

export function LearningTopicDraw({ category, subtopic, lang }: {
  category: string; subtopic: string; lang: keyof typeof learningCopy;
}) {
  const [frame, setFrame] = useState(0);
  const [done, setDone] = useState(() => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (done) return;
    // Slow down towards the already selected result; animation never redraws it.
    const delays = Array.from({ length: 24 }, (_, index) => 55 + index * index * 0.8);
    let elapsed = 0;
    const timers = delays.map((delay, index) => {
      elapsed += delay;
      return window.setTimeout(() => setFrame(index + 1), elapsed);
    });
    timers.push(window.setTimeout(() => setDone(true), elapsed + 240));
    return () => timers.forEach(window.clearTimeout);
  }, [done]);
  const categories = Object.keys(LEARNING_PATHS);
  const topics = categories.flatMap(key => LEARNING_PATHS[key].map(topic => ({ category: key, subtopic: topic })));
  const preview = topics[(frame * 17) % topics.length];
  const label = learningLabels(lang, done ? category : preview.category, done ? subtopic : preview.subtopic);
  return <div aria-busy={!done} className="mb-4 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 text-center text-amber-950">
    <Sparkles aria-hidden="true" className="mx-auto mb-2 h-5 w-5" />
    <p className="text-xs" role="status">{learningDrawCopy[lang][done ? 1 : 0]}{done ? `: ${label.category} · ${label.subtopic}` : ''}</p>
    <div aria-hidden="true" className="relative mt-3 rounded-xl border-y border-amber-200 bg-white/80 py-3">
      {!done && <p className="truncate text-xs opacity-40">{learningLabels(lang, topics[(frame * 17 + 1) % topics.length].category, topics[(frame * 17 + 1) % topics.length].subtopic).subtopic}</p>}
      <p className="py-2 text-xl font-semibold">{label.category} · {label.subtopic}</p>
      {!done && <p className="truncate text-xs opacity-40">{learningLabels(lang, topics[(frame * 17 + 2) % topics.length].category, topics[(frame * 17 + 2) % topics.length].subtopic).subtopic}</p>}
    </div>
  </div>;
}
