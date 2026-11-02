// Pure rules for scheduled planner notifications (event reminders, completion check-ins,
// morning summary and next-day deadline pushes). Shared by send-push-notifications and
// tests. Every decision is driven by the user's saved settings; wall-clock decisions use
// Asia/Jerusalem through the IANA database (DST-safe).
import { exceedsDailyLimit, isWithinQuietHours } from "./briefingSchedule.ts";

export const VALID_REMINDER_MINUTES = [1, 5, 10, 15, 30, 60] as const;
// Used only when the user never saved reminder minutes (missing, not an empty list).
export const DEFAULT_REMINDER_MINUTES = [1, 10, 60];
export const REMINDER_LOOKAHEAD_MS = 61 * 60_000;
export const COMPLETION_WINDOW_MS = 10 * 60_000;
export const PLANNER_MAX_ATTEMPTS = 3;
export const PLANNER_LEASE_SECONDS = 90;
export const MORNING_WINDOW = { start: 7 * 60, end: 8 * 60 };
export const DEADLINE_WINDOW = { start: 12 * 60, end: 13 * 60 };

export type PlannerChannel = "push" | "email";
export type PlannerKind = "planner_reminder" | "planner_completion" | "planner_morning" | "planner_deadline";
export const PLANNER_KINDS: PlannerKind[] = ["planner_reminder", "planner_completion", "planner_morning", "planner_deadline"];

export interface PlannerEvent {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string | null;
  all_day?: boolean | null;
}

type Settings = Record<string, any>;
const asSettings = (raw: unknown): Settings => raw && typeof raw === "object" ? raw as Settings : {};

// Missing => defaults. An explicit list (even empty) is respected; unsupported values dropped.
export function reminderOffsets(raw: unknown): number[] {
  const value = asSettings(raw).planner?.reminderMinutes;
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_MINUTES];
  const valid = new Set<number>();
  for (const item of value) {
    const n = typeof item === "number" ? item : typeof item === "string" && item.trim() !== "" ? Number(item) : NaN;
    if ((VALID_REMINDER_MINUTES as readonly number[]).includes(n)) valid.add(n);
  }
  return [...valid].sort((a, b) => a - b);
}

// How late (after its exact moment) a reminder may still be sent, so a delayed or
// retried tick still delivers it but a stale one is never backfilled.
export function reminderGraceMs(offset: number): number {
  return Math.min(5, Math.max(1, Math.ceil(offset / 3))) * 60_000;
}

const parseMs = (value: unknown): number | null => {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};
const isoOf = (ms: number) => new Date(ms).toISOString();

export interface DueReminder { offset: number; remainingMinutes: number; itemKey: string; startIso: string }

// At most one reminder per event per tick: the smallest saved offset whose moment has
// arrived, if it is still within its grace period. Larger offsets that were missed are
// superseded (no stacked "in 60 minutes" + "in 15 minutes" bursts).
export function dueReminder(event: PlannerEvent, nowMs: number, offsets: number[]): DueReminder | null {
  if (event.all_day === true || !offsets.length) return null;
  const startMs = parseMs(event.start_time);
  if (startMs === null) return null;
  const remaining = startMs - nowMs;
  if (remaining <= 0) return null; // already started: never remind
  const offset = [...offsets].sort((a, b) => a - b).find(o => remaining <= o * 60_000);
  if (offset === undefined) return null;
  const lateness = offset * 60_000 - remaining;
  if (lateness > reminderGraceMs(offset)) return null;
  const startIso = isoOf(startMs);
  return {
    offset,
    remainingMinutes: Math.max(1, Math.round(remaining / 60_000)),
    // Identity includes the start instant: a rescheduled event gets fresh reminders,
    // while repeated ticks for the same schedule can never send twice.
    itemKey: `${event.id}|${startIso}|${offset}`,
    startIso,
  };
}

export interface DueCompletion { itemKey: string; endIso: string }

export function dueCompletion(event: PlannerEvent, nowMs: number): DueCompletion | null {
  if (event.all_day === true) return null;
  const endMs = parseMs(event.end_time);
  const startMs = parseMs(event.start_time);
  if (endMs === null || (startMs !== null && endMs <= startMs)) return null;
  if (endMs > nowMs || nowMs - endMs > COMPLETION_WINDOW_MS) return null;
  const endIso = isoOf(endMs);
  return { itemKey: `${event.id}|${endIso}`, endIso };
}

export function remainingLabel(minutes: number): string {
  if (minutes <= 1) return "דקה";
  if (minutes === 2) return "שתי דקות";
  if (minutes === 60) return "שעה";
  return `${minutes} דקות`;
}

// Legacy notification_type values shown by the in-app bell.
export function legacyReminderType(offset: number): string {
  return offset === 60 ? "event_1hour" : `event_${offset}min`;
}

type ChannelChoice = "app" | "email" | "both" | "off";
const choiceAllows = (choice: ChannelChoice, channel: PlannerChannel) =>
  choice === "both" || (channel === "push" ? choice === "app" : choice === "email");

function reminderChoice(planner: Settings): ChannelChoice {
  if (typeof planner.sameDayChannel === "string") return planner.sameDayChannel as ChannelChoice;
  const push = planner.pushEnabled !== false;
  const email = planner.emailEnabled !== false;
  return push && email ? "both" : push ? "app" : email ? "email" : "off";
}

function completionChoice(planner: Settings): ChannelChoice {
  if (typeof planner.completionChannel === "string") return planner.completionChannel as ChannelChoice;
  return planner.completionEnabled === false ? "off" : "app";
}

export interface ChannelContext { israelMinutes: number; acceptedToday: number }

// Whether this user's saved settings allow `kind` on `channel` right now.
export function plannerChannelAllowed(raw: unknown, kind: PlannerKind, channel: PlannerChannel, ctx: ChannelContext): boolean {
  const settings = asSettings(raw);
  const channelSettings = asSettings(settings[channel]);
  if (channelSettings.enabled === false) return false;
  const content = channelSettings.content;
  const needs = kind === "planner_morning" || kind === "planner_deadline" ? "tasks" : "calendar";
  if (Array.isArray(content) && !content.includes(needs)) return false;
  if (settings.quietHoursEnabled === true && isWithinQuietHours(ctx.israelMinutes, settings.quietHoursStart, settings.quietHoursEnd)) return false;
  if (exceedsDailyLimit(settings.dailyLimit, ctx.acceptedToday)) return false;
  if (kind === "planner_morning" || kind === "planner_deadline") return channel === "push";
  const planner = asSettings(settings.planner);
  if (planner.enabled === false) return false;
  return choiceAllows(kind === "planner_reminder" ? reminderChoice(planner) : completionChoice(planner), channel);
}

export function inWindow(israelMinutes: number, window: { start: number; end: number }): boolean {
  return israelMinutes >= window.start && israelMinutes < window.end;
}

// Next calendar date for a YYYY-MM-DD local date (no time zone involved).
export function nextLocalDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type PushSummary = { devicesFound: number; providerAccepted: number; expired: number; rejected: number; retryable: number };
export type DeliveryFinish = { status: "accepted" | "failed" | "skipped"; retryable: boolean };

// Accepted if any device accepted; retry later only for transient provider failures.
export function pushFinish(s: PushSummary): DeliveryFinish {
  if (s.providerAccepted > 0) return { status: "accepted", retryable: false };
  if (s.retryable > 0) return { status: "failed", retryable: true };
  return { status: s.devicesFound > 0 && s.expired === s.devicesFound ? "skipped" : "failed", retryable: false };
}

// A ledger row is final for its own channel only; a failed push never blocks email or vice versa.
export function deliveryFinished(row: { status: string; retryable: boolean | null; attempts: number | null }, maxAttempts = PLANNER_MAX_ATTEMPTS): boolean {
  if (row.status === "accepted" || row.status === "skipped") return true;
  if (row.status === "failed") return !row.retryable || (row.attempts ?? 0) >= maxAttempts;
  return false; // "sending": the claim function decides (lease)
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
