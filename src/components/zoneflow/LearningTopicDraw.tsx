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
    const interval = window.setInterval(() => setFrame(value => value + 1), 120);
    const finish = window.setTimeout(() => setDone(true), 960);
    return () => { window.clearInterval(interval); window.clearTimeout(finish); };
  }, [done]);
  const categories = Object.keys(LEARNING_PATHS);
  const preview = categories[frame % categories.length];
  const label = learningLabels(lang, done ? category : preview, done ? subtopic : LEARNING_PATHS[preview][0]);
  return <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center text-amber-950">
    <Sparkles aria-hidden="true" className="mx-auto mb-2 h-5 w-5" />
    <p className="text-xs" role="status">{learningDrawCopy[lang][done ? 1 : 0]}{done ? `: ${label.category} · ${label.subtopic}` : ''}</p>
    <p aria-hidden="true" className="mt-2 text-lg font-semibold">{label.category} · {label.subtopic}</p>
  </div>;
}
