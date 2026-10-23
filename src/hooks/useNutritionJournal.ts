import { useEffect, useState } from 'react';
import { DEFAULT_NUTRITION_PREFERENCES, localDay, parseMealHistory, parseNutritionPreferences, type NutritionPreferences } from '@/lib/nutritionPlan';
import type { SavedMeal } from '@/lib/mealEstimate';

export function useNutritionJournal(userId?: string) {
  const mealsKey = `tabro-meals:${userId || 'guest'}`;
  const preferencesKey = `tabro-nutrition-plan:${userId || 'guest'}`;
  const readMeals = () => parseMealHistory(JSON.parse(window.localStorage.getItem(mealsKey) || '[]'));
  const [history, setHistory] = useState<SavedMeal[]>(() => { try { return readMeals(); } catch { return []; } });
  const [preferences, setPreferences] = useState<NutritionPreferences>(() => {
    try { return parseNutritionPreferences(JSON.parse(window.localStorage.getItem(preferencesKey) || '{}')); } catch { return DEFAULT_NUTRITION_PREFERENCES; }
  });
  const [storageError, setStorageError] = useState(false);
  const [today, setToday] = useState(localDay);
  const [day, setDay] = useState(localDay);
  const [followToday, setFollowToday] = useState(true);
  useEffect(() => {
    const refresh = () => setToday(localDay());
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => { if (followToday) setDay(today); }, [today, followToday]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      try {
        if (event.key === mealsKey || event.key === null) setHistory(readMeals());
        if (event.key === preferencesKey || event.key === null) setPreferences(parseNutritionPreferences(JSON.parse(window.localStorage.getItem(preferencesKey) || '{}')));
      } catch { setStorageError(true); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [mealsKey, preferencesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveMeals = (update: (current: SavedMeal[]) => SavedMeal[]) => {
    try {
      // Read the latest browser value so an edit does not erase another tab's new meals.
      const next = update(readMeals());
      if (next.length > 5000) throw new Error('Journal capacity reached');
      window.localStorage.setItem(mealsKey, JSON.stringify(next));
      setHistory(next); setStorageError(false); return true;
    } catch { setStorageError(true); return false; }
  };
  const savePreferences = (next: NutritionPreferences) => {
    try {
      const parsed = parseNutritionPreferences(next);
      window.localStorage.setItem(preferencesKey, JSON.stringify(parsed));
      setPreferences(parsed); setStorageError(false);
    } catch { setStorageError(true); }
  };
  return { history, preferences, saveMeals, savePreferences, storageError, today, day, selectDay: (value: string) => { setDay(value); setFollowToday(value === localDay()); } };
}
export type NutritionJournal = ReturnType<typeof useNutritionJournal>;
