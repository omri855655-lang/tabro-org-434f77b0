import { ChevronLeft, ChevronRight, SlidersHorizontal, Utensils } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import type { NutritionJournal } from '@/hooks/useNutritionJournal';
import { dailyNutrition, localDay, nutritionTarget, validDay, type NutritionProfile, type NutritionGoal } from '@/lib/nutritionPlan';
import { nutritionTrackerCopy } from '@/lib/nutritionTrackerCopy';
import { mealPhotoCopy } from '@/lib/nutritionFeaturesCopy';
import { Button } from '@/components/ui/button';
import { NutritionGoalEditor } from './NutritionGoalEditor';

export function NutritionDailySummary({ profile, journal, onEditProfile }: { profile: NutritionProfile; journal: NutritionJournal; onEditProfile: () => void }) {
  const { lang } = useLanguage(), c = nutritionTrackerCopy[lang], m = mealPhotoCopy[lang];
  const target = nutritionTarget(profile, journal.preferences);
  const summary = dailyNutrition(journal.history, journal.day, target);
  const number = (value: number) => Math.round(value).toLocaleString(lang);
  const move = (delta: number) => {
    const date = new Date(`${journal.day}T12:00:00`); date.setDate(date.getDate() + delta);
    journal.selectDay(localDay(date));
  };
  return <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground" aria-labelledby="nutrition-daily-title">
    <div className="border-b bg-gradient-to-br from-emerald-500/10 via-background to-amber-500/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-medium uppercase tracking-widest text-emerald-700 dark:text-emerald-300">TABRO / NUTRITION</p><h3 id="nutrition-daily-title" className="mt-2 text-2xl font-semibold">{c.title}</h3><p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p></div>
        <Button size="sm" variant="outline" onClick={onEditProfile}><SlidersHorizontal className="me-2 h-4 w-4" />{c.editProfile}</Button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => move(-1)} aria-label={c.previous}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
        <label className="text-xs"><span className="sr-only">{c.day}</span><input aria-label={c.day} type="date" className="min-h-10 rounded-lg border bg-background px-3" value={journal.day} max={journal.today} onChange={e => { if (validDay(e.target.value) && e.target.value <= journal.today) journal.selectDay(e.target.value); }} /></label>
        <Button size="icon" variant="outline" disabled={journal.day >= journal.today} onClick={() => move(1)} aria-label={c.next}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
        <Button size="sm" variant="ghost" onClick={() => journal.selectDay(journal.today)}>{c.today}</Button>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
        {[{ label: c.target, value: target.status === 'ready' ? number(target.calories) : '—' }, { label: c.logged, value: number(summary.calories) }, { label: summary.remaining !== null && summary.remaining < 0 ? c.above : c.remaining, value: summary.remaining === null ? '—' : number(Math.abs(summary.remaining)) }].map(({ label, value }) => <div key={label} className="rounded-xl border bg-background/85 p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{value}<span className="ms-2 text-xs font-normal">{c.kcal}</span></dd></div>)}
      </dl>
      {target.status === 'ready' && <progress className="mt-4 h-2 w-full accent-emerald-600" max={target.calories} value={Math.min(summary.calories, target.calories)} aria-label={c.logged} />}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">{(['protein', 'carbs', 'fat'] as const).map((field, i) => <span key={field} className="rounded-full border bg-background px-3 py-1">{m[10 + i]}: {number(summary[field])} g</span>)}</div>
      {!summary.entries.length && <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Utensils className="h-4 w-4 shrink-0" />{c.noMeals}</p>}
    </div>
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3"><label className="text-sm">{c.goal}<select value={journal.preferences.goal} onChange={e => journal.savePreferences({ ...journal.preferences, goal: e.target.value as NutritionGoal })} className="ms-2 min-h-10 rounded-lg border bg-background px-3">{(['maintain', 'lose', 'gain'] as const).map(goal => <option key={goal} value={goal}>{c[goal]}</option>)}</select></label></div>
      <label className="flex items-start gap-2 text-xs leading-relaxed"><input className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" type="checkbox" checked={journal.preferences.eligible} onChange={e => journal.savePreferences({ ...journal.preferences, eligible: e.target.checked })} />{c.eligibility}</label>
      <NutritionGoalEditor key={journal.preferences.dailyCalories ?? 'automatic'} profile={profile} journal={journal} />
      {target.status !== 'ready' && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{target.status === 'incomplete' ? c.profileNeeded : target.status === 'specialist' ? c.specialist : c.unsupported}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">{c.estimate}</p>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">{c.method}</summary><p className="my-2 leading-relaxed">{c.methodBody}</p><div className="flex flex-wrap gap-3"><a className="underline" target="_blank" rel="noreferrer" href="https://pubmed.ncbi.nlm.nih.gov/2305711/">Mifflin–St Jeor</a><a className="underline" target="_blank" rel="noreferrer" href="https://www.niddk.nih.gov/bwp">NIDDK · {c.sources}</a></div></details>
      <p className="text-xs text-muted-foreground">{c.storage}</p>
      {journal.storageError && <p role="alert" className="text-sm text-destructive">{c.saveError}</p>}
    </div>
  </section>;
}
