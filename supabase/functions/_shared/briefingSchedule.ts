// Pure scheduling rules for the personal daily briefing email. Shared by the edge
// function and the app settings UI. All wall-clock decisions use Asia/Jerusalem via
// the IANA time zone database, so DST changes are handled by Intl.

export type BriefingSlot = "morning" | "afternoon";
export const BRIEFING_SLOTS: Record<BriefingSlot, { time: string; minutes: number; mode: "morning" | "urgent" }> = {
  morning: { time: "08:00", minutes: 8 * 60, mode: "morning" },
  afternoon: { time: "16:00", minutes: 16 * 60, mode: "urgent" },
};
// A slot stays eligible for retries during this many minutes after its start time,
// so a late or failed tick never sends a stale morning briefing in the afternoon.
export const BRIEFING_WINDOW_MINUTES = 60;
export const BRIEFING_MAX_ATTEMPTS = 4;
export const BRIEFING_TEST_LIMIT_PER_DAY = 3;

export interface BriefingEmailSettings {
  enabled: boolean;
  morning: boolean;
  afternoon: boolean;
  includeTasks: boolean;
  includePlanner: boolean;
  includeMail: boolean;
  includeSuggestions: boolean;
  attachPdf: boolean;
}

export const DEFAULT_BRIEFING_EMAIL: BriefingEmailSettings = {
  enabled: false,
  morning: true,
  afternoon: true,
  includeTasks: true,
  includePlanner: true,
  includeMail: true,
  includeSuggestions: true,
  attachPdf: true,
};

// Opt-in only: anything other than an explicit `enabled: true` keeps the email off.
export function normalizeBriefingSettings(raw: unknown): BriefingEmailSettings {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const flag = (key: keyof BriefingEmailSettings) => typeof value[key] === "boolean" ? value[key] as boolean : DEFAULT_BRIEFING_EMAIL[key];
  return {
    enabled: value.enabled === true,
    morning: flag("morning"),
    afternoon: flag("afternoon"),
    includeTasks: flag("includeTasks"),
    includePlanner: flag("includePlanner"),
    includeMail: flag("includeMail"),
    includeSuggestions: flag("includeSuggestions"),
    attachPdf: flag("attachPdf"),
  };
}

export function israelClock(now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value || "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

// UTC instant of 00:00 in Israel on the given local date (handles +02:00 / +03:00).
export function israelDayStartUtc(date: string): Date {
  for (const offset of ["+02:00", "+03:00"]) {
    const candidate = new Date(`${date}T00:00:00${offset}`);
    const clock = israelClock(candidate);
    if (clock.date === date && clock.minutes === 0) return candidate;
  }
  return new Date(`${date}T00:00:00+02:00`);
}

export function dueBriefingSlot(now: Date): { slot: BriefingSlot; date: string } | null {
  const clock = israelClock(now);
  for (const slot of Object.keys(BRIEFING_SLOTS) as BriefingSlot[]) {
    const start = BRIEFING_SLOTS[slot].minutes;
    if (clock.minutes >= start && clock.minutes < start + BRIEFING_WINDOW_MINUTES) return { slot, date: clock.date };
  }
  return null;
}

const toMinutes = (value: unknown): number | null => {
  const match = typeof value === "string" ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
};

export function isWithinQuietHours(minutes: number, start: unknown, end: unknown): boolean {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === null || to === null || from === to) return false;
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

export type BriefingSkipReason = "not_opted_in" | "slot_disabled" | "email_disabled" | "quiet_hours" | "daily_limit" | "suppressed" | "no_verified_email" | "nothing_remaining";

// Decide from saved preferences alone whether this user should get this slot.
export function briefingSkipReason(notificationSettings: unknown, slot: BriefingSlot): BriefingSkipReason | null {
  const settings = notificationSettings && typeof notificationSettings === "object" ? notificationSettings as Record<string, any> : {};
  const briefing = normalizeBriefingSettings(settings.dailyBriefingEmail);
  if (!briefing.enabled) return "not_opted_in";
  if (!briefing[slot]) return "slot_disabled";
  if (settings.email && settings.email.enabled === false) return "email_disabled";
  if (settings.quietHoursEnabled === true && isWithinQuietHours(BRIEFING_SLOTS[slot].minutes, settings.quietHoursStart, settings.quietHoursEnd)) return "quiet_hours";
  return null;
}

export function exceedsDailyLimit(limit: unknown, alreadySentToday: number): boolean {
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0 && alreadySentToday >= limit;
}

export function briefingIdempotencyKey(userId: string, date: string, slot: BriefingSlot): string {
  return `tabro-briefing/${userId}/${date}/${slot}`;
}

// Provider responses that are safe to retry with the same idempotency key.
export function isRetryableProviderStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 409 || status === 429 || status >= 500;
}
