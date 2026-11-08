import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { habitDate, type HabitEntry, type HabitPlan } from '@/lib/habitJourney';

type Table<Row> = { Row: { [K in keyof Row]: Row[K] }; Insert: { [K in keyof Row]?: Row[K] }; Update: { [K in keyof Row]?: Row[K] }; Relationships: [] };
type HabitDatabase = { public: { Tables: { zoneflow_habits: Table<HabitPlan>; zoneflow_habit_entries: Table<HabitEntry> }; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };
const db = supabase as unknown as SupabaseClient<HabitDatabase>;

export function useHabitJourney(userId?: string) {
  const [plans, setPlans] = useState<HabitPlan[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    if (!userId) { setPlans([]); setEntries([]); setLoading(false); return; }
    setLoading(true); setError(false);
    try {
      const result = await db.from('zoneflow_habits').select('*').eq('user_id', userId).order('created_at').returns<HabitPlan[]>();
      if (result.error) throw result.error;
      // Paginate rather than silently clipping at the Data API's 1000-row cap.
      const journal: HabitEntry[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await db.from('zoneflow_habit_entries').select('*').eq('user_id', userId).order('created_at').order('id').range(offset, offset + 499).returns<HabitEntry[]>();
        if (page.error) throw page.error;
        journal.push(...(page.data || []));
        if ((page.data || []).length < 500) break;
      }
      if (generation.current !== request) return;
      setPlans(result.data || []); setEntries(journal);
    } catch { if (generation.current === request) setError(true); }
    finally { if (generation.current === request) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible' && !lock.current) void load(); };
    document.addEventListener('visibilitychange', refresh);
    const counter = generation;
    return () => { counter.current++; document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const mutate = async (action: () => Promise<void>) => {
    if (!userId || lock.current) return false;
    generation.current++;
    lock.current = true; setLoading(false); setBusy(true); setError(false);
    try { await action(); return true; }
    catch { setError(true); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const addPlan = (plan: Pick<HabitPlan, 'title'|'direction'|'cue'|'action'|'weekdays'|'target_days'>) => mutate(async () => {
    const { data, error } = await db.from('zoneflow_habits').insert({ ...plan, user_id: userId }).select().returns<HabitPlan[]>().single();
    if (error) throw error;
    setPlans(value => [...value, data]);
  });
  const checkin = (habitId: string, outcome: HabitEntry['outcome']) => mutate(async () => {
    const today = habitDate();
    const old = entries.find(entry => entry.habit_id === habitId && entry.kind === 'checkin' && entry.entry_date === today);
    const payload = { user_id: userId, habit_id: habitId, kind: 'checkin' as const, entry_date: today, outcome };
    const result = old
      ? await db.from('zoneflow_habit_entries').update({ outcome }).eq('id', old.id).eq('user_id', userId!).select().returns<HabitEntry[]>().single()
      : await db.from('zoneflow_habit_entries').insert(payload).select().returns<HabitEntry[]>().single();
    if (result.error) throw result.error;
    const entry = result.data;
    setEntries(value => [...value.filter(item => item.id !== entry.id), entry]);
  });
  const recordUrge = (habitId: string, intensity: number, trigger: string, response: string) => mutate(async () => {
    const { data, error } = await db.from('zoneflow_habit_entries').insert({ user_id: userId, habit_id: habitId, kind: 'urge', entry_date: habitDate(), intensity, trigger, response }).select().returns<HabitEntry[]>().single();
    if (error) throw error;
    setEntries(value => [...value, data]);
  });
  const remove = (id: string) => mutate(async () => {
    const { error } = await db.from('zoneflow_habits').delete().eq('id', id).eq('user_id', userId!);
    if (error) throw error;
    setPlans(value => value.filter(plan => plan.id !== id));
    setEntries(value => value.filter(entry => entry.habit_id !== id));
  });
  return { plans, entries, loading, error, busy, load, addPlan, checkin, recordUrge, remove };
}
