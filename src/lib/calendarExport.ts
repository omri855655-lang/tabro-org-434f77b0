export interface ExportCalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category?: string;
  location?: string;
  meetingUrl?: string;
  allDay?: boolean;
  updatedAt?: string;
}

const escapeText = (value: string) => [...value].filter(char => {
  const code=char.charCodeAt(0); return (code >= 32 && code !== 127) || [9,10,13].includes(code);
}).join("").replace(/\r\n?|\n/g, "\n")
  .replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function calendarDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("");
}
function nextDay(day: string) {
  const value = new Date(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0,10).replace(/-/g, "");
}

// RFC 5545 content lines are folded at 75 octets, never inside a UTF-8 character.
export function foldCalendarLine(line: string) {
  const encoder = new TextEncoder();
  let result = "", current = "", length = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (length + size > 75) { result += `${current}\r\n`; current = " "; length = 1; }
    current += char; length += size;
  }
  return result + current;
}

export function createCalendarExport(events: ExportCalendarEvent[], options: { now?: Date; timeZone?: string; reminderMinutes?: number } = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tabro//Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const seen = new Set<string>();
  let exported = 0, skipped = 0;
  for (const event of [...events].sort((a,b) => a.startTime.localeCompare(b.startTime))) {
    const start = new Date(event.startTime), end = new Date(event.endTime);
    if (!event.id || seen.has(event.id) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { skipped++; continue; }
    seen.add(event.id);
    lines.push("BEGIN:VEVENT", `UID:${encodeURIComponent(event.id)}@tabro.org`, `DTSTAMP:${utc(now)}`);
    if (event.allDay) {
      const startDay = calendarDay(start, timeZone), endDay = calendarDay(end, timeZone);
      const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(end);
      const exclusiveEnd = endDay > startDay && clock === "00:00:00" ? endDay : nextDay(endDay);
      lines.push(`DTSTART;VALUE=DATE:${startDay}`, `DTEND;VALUE=DATE:${exclusiveEnd}`);
    } else lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`);
    lines.push(`SUMMARY:${escapeText(event.title || "Event")}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.category) lines.push(`CATEGORIES:${escapeText(event.category)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.meetingUrl && /^https:\/\/\S+$/i.test(event.meetingUrl)) {
      try { const url = new URL(event.meetingUrl); if (!url.username && !url.password) lines.push(`URL:${url.href}`); } catch { /* Invalid links never become calendar properties. */ }
    }
    const updated = new Date(event.updatedAt || "");
    if (Number.isFinite(updated.getTime())) lines.push(`LAST-MODIFIED:${utc(updated)}`);
    const reminder = options.reminderMinutes;
    if (Number.isInteger(reminder) && reminder! > 0 && reminder! <= 10080) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${reminder}M`, `DESCRIPTION:${escapeText(event.title || "Event")}`, "END:VALARM");
    }
    // Planner recurrences are materialized rows; emitting RRULE here duplicates them.
    lines.push("END:VEVENT"); exported++;
  }
  lines.push("END:VCALENDAR");
  return { text: lines.map(foldCalendarLine).join("\r\n") + "\r\n", exported, skipped };
}
