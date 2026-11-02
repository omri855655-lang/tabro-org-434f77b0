// Pure helpers for the private, revocable calendar subscription (token format,
// hashing, feed window and feed body). Shared by calendar-feed and
// calendar-feed-manage; the app only uses the scope constants and URL builder.
import { createCalendarExport, type ExportCalendarEvent } from "./calendarExport.ts";

export const FEED_DAYS_BACK = 7;
export const FEED_DAYS_AHEAD = 180;
export const FEED_MAX_EVENTS = 2000;
export const FEED_TIME_ZONE = "Asia/Jerusalem";
export const FEED_FUNCTION = "calendar-feed";

/** 32 random bytes as base64url (43 chars) = 256 bits. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface FeedFieldOptions {
  include_description: boolean;
  include_location: boolean;
  include_meeting_url: boolean;
}

export function generateFeedToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashFeedToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Extracts the token from `/…/calendar-feed/<token>[.ics]`; null for anything else. */
export function parseFeedToken(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.lastIndexOf(FEED_FUNCTION);
  if (index < 0 || index !== parts.length - 2) return null;
  const token = parts[index + 1].replace(/\.ics$/i, "");
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function feedWindow(now: Date) {
  const day = 86_400_000;
  return { from: new Date(now.getTime() - FEED_DAYS_BACK * day), to: new Date(now.getTime() + FEED_DAYS_AHEAD * day) };
}

/** Only boolean `true` opts a field in; anything else stays off. */
export function normalizeFieldOptions(input: unknown): FeedFieldOptions {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    include_description: o.include_description === true,
    include_location: o.include_location === true,
    include_meeting_url: o.include_meeting_url === true,
  };
}

export function buildFeedUrls(backendUrl: string, token: string) {
  const base = backendUrl.replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base) || !TOKEN_PATTERN.test(token)) throw new Error("invalid feed url input");
  const https = `${base}/functions/v1/${FEED_FUNCTION}/${token}.ics`;
  return { https, webcal: https.replace(/^https:/i, "webcal:") };
}

export interface FeedRow {
  id: string; title: string; start_time: string; end_time: string; all_day: boolean | null;
  updated_at: string | null; description?: string | null; location?: string | null; meeting_url?: string | null;
}

/** Builds the feed. `rows` must already be owner-scoped and range-bounded (fetched with limit MAX+1). */
export function buildFeedBody(rows: FeedRow[], options: FeedFieldOptions, now: Date) {
  const truncated = rows.length > FEED_MAX_EVENTS;
  const kept = rows.slice(0, FEED_MAX_EVENTS);
  const events: ExportCalendarEvent[] = kept.map(row => ({
    id: row.id, title: row.title, startTime: row.start_time, endTime: row.end_time, allDay: row.all_day,
    updatedAt: row.updated_at,
    description: options.include_description ? row.description : null,
    location: options.include_location ? row.location : null,
    meetingUrl: options.include_meeting_url ? row.meeting_url : null,
  }));
  const result = createCalendarExport(events, {
    now, timeZone: FEED_TIME_ZONE, calendarName: "Tabro",
    calendarDescription: truncated
      ? `Tabro planner: first ${FEED_MAX_EVENTS} events from ${FEED_DAYS_BACK} days ago (limit reached; later events omitted)`
      : `Tabro planner: ${FEED_DAYS_BACK} days back to ${FEED_DAYS_AHEAD} days ahead`,
    refreshMinutes: 60,
    fields: { description: options.include_description, location: options.include_location, meetingUrl: options.include_meeting_url, category: false },
  });
  return { ...result, truncated };
}
