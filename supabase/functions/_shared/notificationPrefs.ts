import { plannerChannelAllowed, reminderOffsets } from "./plannerReminders.ts";

// Compatibility wrapper: planner email decisions now come from the shared planner rules
// (saved reminder minutes, channel choices, calendar content, quiet hours, daily limit).
export type PlannerEmailKind = "reminder" | "completion";

export function plannerEmailAllowed(
  notificationSettings: unknown,
  kind: PlannerEmailKind,
  israelMinutes: number,
  minutesBefore?: number,
  emailsSentToday = 0,
): boolean {
  const ctx = { israelMinutes, acceptedToday: emailsSentToday };
  if (kind === "completion") return plannerChannelAllowed(notificationSettings, "planner_completion", "email", ctx);
  if (typeof minutesBefore !== "number" || !reminderOffsets(notificationSettings).includes(minutesBefore)) return false;
  return plannerChannelAllowed(notificationSettings, "planner_reminder", "email", ctx);
}
