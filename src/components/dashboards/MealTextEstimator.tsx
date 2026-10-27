import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { mealTextCopy, mealTextPrompt, parseMealTextResult } from '@/lib/mealTextEstimate';
import type { MealEstimate } from '@/lib/mealEstimate';

export function MealTextEstimator({ userId, busy, draft, onBusy, onEstimate }: {
  userId?: string; busy: boolean; draft: MealEstimate | null;
  onBusy: (busy: boolean) => void; onEstimate: (meal: MealEstimate) => void;
}) {
  const { lang } = useLanguage();
  const copy = mealTextCopy[lang];
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const draftText = draft?.items.filter(item => item.name.trim()).map(item => `${item.name}: ${item.grams} g`).join('; ') || '';
  const estimate = async (description: string) => {
    if (busy || request.current || !userId) return;
    const controller = new AbortController();
    request.current = controller; onBusy(true); setError(false);
    try {
      const { data, error } = await supabase.functions.invoke('task-ai-helper', {
        signal: controller.signal, timeout: 60000,
        body: { type: 'custom', customPrompt: mealTextPrompt(description, lang) },
      });
      if (error || data?.error) throw error || new Error('Estimate unavailable');
      const meal = parseMealTextResult(data?.result || data?.suggestion);
      if (!controller.signal.aborted) onEstimate(meal);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) onBusy(false); request.current = null; }
  };
  return <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
    <label className="block text-sm font-medium">{copy[0]}<textarea disabled={busy} maxLength={1500} value={text} onChange={event => setText(event.target.value)} placeholder={copy[1]} className="mt-2 min-h-20 w-full rounded-lg border bg-background p-3 text-sm" /></label>
    <p className="text-xs leading-5 text-muted-foreground">{copy[3]}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || !userId || !text.trim()} onClick={() => void estimate(text)}>{busy ? copy[5] : copy[2]}</Button>
      {draftText && <Button type="button" variant="outline" disabled={busy || !userId || draftText.length > 1500} onClick={() => void estimate(draftText)}>{copy[6]}</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{copy[4]}</p>}
  </div>;
}
