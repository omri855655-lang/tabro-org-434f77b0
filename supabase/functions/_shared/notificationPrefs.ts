import { exceedsDailyLimit, isWithinQuietHours } from "./briefingSchedule.ts";

// Mirrors the defaults shown in the app's notification settings so scheduled planner
// emails only go to people whose saved choices allow them.
export type PlannerEmailKind = "reminder" | "completion";
const DEFAULT_REMINDER_MINUTES = [1, 10, 60];

export function plannerEmailAllowed(
  notificationSettings: unknown,
  kind: PlannerEmailKind,
  israelMinutes: number,
  minutesBefore?: number,
  emailsSentToday = 0,
): boolean {
  const settings = notificationSettings && typeof notificationSettings === "object" ? notificationSettings as Record<string, any> : {};
  if (settings.email?.enabled === false) return false;
  const planner = settings.planner && typeof settings.planner === "object" ? settings.planner : {};
  if (planner.enabled === false) return false;
  if (settings.quietHoursEnabled === true && isWithinQuietHours(israelMinutes, settings.quietHoursStart, settings.quietHoursEnd)) return false;
  if (exceedsDailyLimit(settings.dailyLimit, emailsSentToday)) return false;
  if (kind === "completion") {
    const channel = planner.completionChannel || (planner.completionEnabled === false ? "off" : "app");
    return channel === "email" || channel === "both";
  }
  const channel = planner.sameDayChannel || (planner.emailEnabled === false ? "app" : "both");
  if (channel !== "email" && channel !== "both") return false;
  const minutes = Array.isArray(planner.reminderMinutes) && planner.reminderMinutes.length ? planner.reminderMinutes : DEFAULT_REMINDER_MINUTES;
  return typeof minutesBefore === "number" && minutes.includes(minutesBefore);
}
