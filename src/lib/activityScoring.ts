export type ActivitySource = "zoneflow_core" | "zoneflow_together" | "digital_wellbeing" | "zoneflow_mind" | "books" | "tasks" | "goals" | "challenges";
export type ActivityEventType =
  | "focus_session_started" | "focus_session_completed" | "focus_session_cancelled"
  | "wellbeing_session_completed" | "pomodoro_completed" | "book_completed"
  | "task_completed" | "goal_progress_recorded" | "mind_exercise_completed"
  | "journey_day_completed" | "challenge_completed" | "achievement_unlocked";

interface FallbackRule {
  base: number;
  pointsPerUnit?: number;
  unitMinutes?: number;
  minimumMinutes?: number;
  maximumMinutes?: number;
}

const FALLBACK_RULES: Partial<Record<ActivityEventType, FallbackRule>> = {
  focus_session_completed: { base: 0, pointsPerUnit: 1, unitMinutes: 3, minimumMinutes: 3, maximumMinutes: 180 },
  wellbeing_session_completed: { base: 1, pointsPerUnit: 1, unitMinutes: 3, minimumMinutes: 3, maximumMinutes: 180 },
  pomodoro_completed: { base: 2, pointsPerUnit: 1, unitMinutes: 5, minimumMinutes: 10, maximumMinutes: 120 },
  book_completed: { base: 5, pointsPerUnit: 1, unitMinutes: 25 },
  task_completed: { base: 2 },
  goal_progress_recorded: { base: 1 },
  mind_exercise_completed: { base: 5 },
  journey_day_completed: { base: 5 },
  challenge_completed: { base: 5 },
  achievement_unlocked: { base: 10 },
};

export function calculateFallbackPoints(eventType: ActivityEventType, durationMinutes?: number, amount?: number): number {
  const rule = FALLBACK_RULES[eventType];
  if (!rule) return 0;
  if (rule.minimumMinutes && (durationMinutes ?? 0) < rule.minimumMinutes) return 0;
  const measured = eventType === "book_completed" ? amount : durationMinutes;
  const capped = Math.min(Math.max(0, measured ?? 0), rule.maximumMinutes ?? Number.MAX_SAFE_INTEGER);
  const units = rule.pointsPerUnit && rule.unitMinutes ? Math.floor(capped / rule.unitMinutes) * rule.pointsPerUnit : 0;
  return Math.max(0, rule.base + units);
}
