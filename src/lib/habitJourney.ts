export interface HabitPlan {
  id: string;
  user_id: string;
  title: string;
  direction: 'build' | 'reduce';
  cue: string;
  action: string;
  weekdays: number[];
  target_days: number;
  created_at: string;
}

export interface HabitEntry {
  id: string;
  user_id: string;
  habit_id: string;
  kind: 'checkin' | 'urge';
  entry_date: string;
  outcome: 'done' | 'partial' | 'missed' | null;
  intensity: number | null;
  trigger: string;
  response: string;
  created_at: string;
}

// Local calendar dates, not UTC: a late evening check-in belongs to today.
export function habitDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function habitStats(plan: HabitPlan, entries: HabitEntry[], now = new Date()) {
  const checkins = entries.filter(entry => entry.habit_id === plan.id && entry.kind === 'checkin');
  const days = new Set(checkins.filter(entry => entry.outcome === 'done' && entry.entry_date <= habitDate(now)).map(entry => entry.entry_date));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(habitDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  // Scheduled rest days neither increase nor reset a streak.
  for (let scanned = 0; scanned < 3660; scanned++) {
    if (habitDate(cursor) < habitDate(new Date(plan.created_at))) break;
    if (plan.weekdays.includes(cursor.getDay())) {
      if (!days.has(habitDate(cursor))) break;
      streak++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return { completed: days.size, streak, progress: Math.min(100, days.size / plan.target_days * 100), today: checkins.find(entry => entry.entry_date === habitDate(now))?.outcome };
}

export const HABIT_MILESTONES = [1, 3, 7, 14, 30, 60, 90];
