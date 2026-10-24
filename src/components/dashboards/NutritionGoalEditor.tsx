import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import type { NutritionJournal } from '@/hooks/useNutritionJournal';
import { nutritionTarget, type NutritionProfile } from '@/lib/nutritionPlan';
import { nutritionWorkspaceCopy } from '@/lib/nutritionWorkspaceCopy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function NutritionGoalEditor({ profile, journal }: { profile: NutritionProfile; journal: NutritionJournal }) {
  const { lang } = useLanguage(), c = nutritionWorkspaceCopy[lang];
  const [value, setValue] = useState(String(journal.preferences.dailyCalories ?? ''));
  const [error, setError] = useState(false);
  return <form className="space-y-2 rounded-xl border p-3" onSubmit={event => {
    event.preventDefault();
    const next = { ...journal.preferences, dailyCalories: value.trim() ? Number(value) : undefined };
    if (next.dailyCalories !== undefined && nutritionTarget(profile, next).status !== 'ready') { setError(true); return; }
    setError(false); journal.savePreferences(next);
  }}>
    <label className="block text-sm">{c[0]}<Input className="mt-2" type="number" min={1500} max={5000} step={1} inputMode="numeric" value={value} onChange={e => { setValue(e.target.value); setError(false); }} placeholder={c[1]} /></label>
    <div className="flex flex-wrap gap-2"><Button type="submit" size="sm">{c[2]}</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setValue(''); setError(false); journal.savePreferences({ ...journal.preferences, dailyCalories: undefined }); }}>{c[3]}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{c[4]}</p>}
  </form>;
}
