import { triageEmail, type MailPreferences } from "./emailTriage.ts";

// Pure, deterministic briefing builder shared by the app preview and the scheduled
// email function. No AI calls: suggestions are rule-based and only reuse data the
// user saved (responsible person, notes, instructions, dates). Nothing is invented.

export type BriefingMode = "morning" | "urgent";
export type BriefingTask = {
  id: string;
  description: string;
  status: string | null;
  planned_end: string | null;
  urgent: boolean | null;
  overdue: boolean | null;
  archived: boolean;
  responsible: string | null;
  task_type: string;
  progress?: string | null;
  notes?: string | null;
};
export type BriefingEvent = { id: string; title: string; start_time: string; end_time: string; location: string | null; all_day: boolean | null; description?: string | null };
export type BriefingMail = { email_subject: string | null; email_from: string | null; email_date: string | null; category: string | null };
export type BriefingItemKind = "task" | "event" | "mail";
export interface BriefingItem {
  kind: BriefingItemKind;
  label: string;
  title: string;
  when: string;
  who: string;
  details: string;
  suggestion: string;
  urgent: boolean;
}
export interface BriefingOptions {
  includeTasks?: boolean;
  includeEvents?: boolean;
  includeMail?: boolean;
  includeSuggestions?: boolean;
}
export type RecurringSource = { id: string; title: string; description: string | null; frequency: string; day_of_week: number | null; day_of_month: number | null; reminder_time: string | null };
export type ProjectTaskSource = { id: string; title: string; status: string | null; due_date: string | null; urgent: boolean | null; completed: boolean | null; assigned_email?: string | null; instructions?: string | null; notes?: string | null };

const DONE_STATUSES = ["בוצע", "הושלם", "completed", "done", "cancelled", "canceled", "בוטל"];
const NO_CONTACT = "לא הוגדר איש קשר";

export function israelDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function recurringBriefingTasks(tasks: RecurringSource[], completedIds: string[], now = new Date()): BriefingTask[] {
  const today = israelDate(now);
  const day = new Date(`${today}T12:00:00Z`);
  return tasks.filter(task => !completedIds.includes(task.id) && (task.frequency === "daily" || (task.frequency === "weekly" && task.day_of_week === day.getUTCDay()) || (task.frequency === "monthly" && task.day_of_month === day.getUTCDate())))
    .map(task => ({ id: `recurring:${task.id}`, description: task.title, status: null, planned_end: today, urgent: false, overdue: false, archived: false, responsible: null, task_type: "recurring", progress: [task.reminder_time ? `שעה מתוכננת: ${task.reminder_time}` : "", task.description].filter(Boolean).join(" · ") }));
}

// Project tasks owned by the user. assigned_to is an internal user id, so only a real
// saved email is shown as the contact; completed tasks are marked done and filtered later.
export function projectBriefingTasks(tasks: ProjectTaskSource[]): BriefingTask[] {
  return tasks.map(task => ({
    id: `project:${task.id}`, description: task.title, status: task.completed ? "בוצע" : task.status,
    planned_end: task.due_date, urgent: task.urgent, overdue: false, archived: false,
    responsible: task.assigned_email?.trim() || null, task_type: "project",
    progress: task.instructions?.trim() ? `הנחיות שנשמרו: ${task.instructions.trim()}` : null,
    notes: task.notes?.trim() || null,
  }));
}

const clip = (value: string | null | undefined, max = 400) => {
  const text = (value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

export function formatIsraelDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day;
}

// Plain words instead of dash/comma separators keep mixed Hebrew and numbers in the
// correct reading order in both the PDF and plain-text email clients.
export function israelTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function formatSender(from: string | null): string {
  const raw = clip(from, 160);
  if (!raw) return "שולח לא ידוע";
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
  if (!match) return raw;
  const name = match[1].trim();
  return name && name.toLowerCase() !== match[2].trim().toLowerCase() ? `${name} · ${match[2].trim()}` : match[2].trim();
}

function taskSuggestion(task: BriefingTask, due: string | null, today: string): string {
  const who = task.responsible?.trim();
  if (due && due < today) return `הצעה: המועד ${formatIsraelDay(due)} עבר. עדכן מועד חדש או סמן כבוצע אם המשימה הושלמה.`;
  if (who) return `הצעה: בדוק עם ${who} מה חסר להשלמה וקבע את הצעד הבא.`;
  if (task.urgent) return "הצעה: שריין לזה חלון זמן ביומן היום והגדר צעד ראשון קטן.";
  return "הצעה: הגדר צעד הבא ברור ומי אחראי לביצוע.";
}

export function makeDailyBriefing(tasks: BriefingTask[], events: BriefingEvent[], emails: BriefingMail[], mode: BriefingMode, now = new Date(), prefs?: Partial<MailPreferences>, options: BriefingOptions = {}) {
  const includeTasks = options.includeTasks !== false;
  const includeEvents = options.includeEvents !== false;
  const includeMail = options.includeMail ?? mode === "morning";
  const includeSuggestions = options.includeSuggestions !== false;
  const today = israelDate(now);
  const dueDay = (value: string | null) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : israelDate(date);
  };
  const selectedTasks = !includeTasks ? [] : tasks.filter(task => {
    if (task.archived || DONE_STATUSES.includes((task.status || "").trim().toLowerCase())) return false;
    const due = dueDay(task.planned_end);
    return Boolean(task.urgent) || Boolean(task.overdue) || (due !== null && due <= today);
  }).sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)) || (dueDay(a.planned_end) || "9999").localeCompare(dueDay(b.planned_end) || "9999"));
  const selectedEvents = !includeEvents ? [] : events.filter(event => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start && israelDate(start) <= today && israelDate(new Date(end.getTime() - 1)) >= today && (mode === "morning" || end > now);
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const importantMail = !includeMail ? [] : emails.map(email => ({ ...email, ...triageEmail({ ...email, category: email.category || "personal" }, prefs as MailPreferences | undefined) }))
    .filter(email => {
      const received = new Date(email.email_date || "");
      return !Number.isNaN(received.getTime()) && received <= now && now.getTime() - received.getTime() <= 7 * 86400000 && email.priority >= 4;
    }).sort((a, b) => b.priority - a.priority).slice(0, 10);

  const items: BriefingItem[] = [];
  for (const task of selectedTasks) {
    const due = dueDay(task.planned_end);
    const late = due !== null && due < today;
    items.push({
      kind: "task",
      label: task.urgent ? "משימה דחופה" : late || task.overdue ? "משימה באיחור" : "משימה להיום",
      title: clip(task.description, 300) || "משימה ללא כותרת",
      when: due ? (late ? `באיחור מאז ${formatIsraelDay(due)}` : formatIsraelDay(due)) : "לא הוגדר מועד",
      who: task.responsible?.trim() || NO_CONTACT,
      details: [clip(task.progress), task.notes ? `הערות שנשמרו: ${clip(task.notes, 300)}` : ""].filter(Boolean).join(" · "),
      suggestion: includeSuggestions ? taskSuggestion(task, due, today) : "",
      urgent: Boolean(task.urgent) || late,
    });
  }
  for (const event of selectedEvents) {
    items.push({
      kind: "event",
      label: "לו״ז",
      title: clip(event.title, 300) || "אירוע ללא כותרת",
      when: event.all_day ? "כל היום" : `${israelTime(event.start_time)} עד ${israelTime(event.end_time)}`,
      who: event.location?.trim() || "לא הוגדר מיקום",
      details: clip(event.description, 300),
      suggestion: includeSuggestions ? (event.location?.trim() ? "הצעה: הכן מראש את החומרים והקצה זמן הגעה." : "הצעה: הכן מראש את החומרים לאירוע.") : "",
      urgent: false,
    });
  }
  for (const email of importantMail) {
    items.push({
      kind: "mail",
      label: "מייל שעשוי לדרוש טיפול",
      title: clip(email.email_subject, 200) || "ללא נושא",
      when: email.email_date ? `${formatIsraelDay(israelDate(new Date(email.email_date)))} בשעה ${israelTime(email.email_date)}` : "",
      who: formatSender(email.email_from),
      details: "",
      // Always shown: classification is metadata-only and never proves authenticity.
      suggestion: email.security ? "בדוק באתר הרשמי; אל תמסור סיסמאות או קודי אימות בתגובה." : "בדוק את ההודעה המקורית לפני פעולה; הסיווג מבוסס על נושא ושולח בלבד.",
      urgent: email.priority >= 5,
    });
  }
  const rows = items.map(item => [item.label, item.title, item.when, item.who, [item.details, item.suggestion].filter(Boolean).join(" · ") || "—"]);
  return {
    date: today, mode, rows, items,
    counts: { tasks: selectedTasks.length, events: selectedEvents.length, mail: importantMail.length },
    title: mode === "morning" ? "Tabro · היום שלך" : "Tabro · דחופים להמשך היום",
    summary: `${selectedTasks.length} משימות · ${selectedEvents.length} אירועים${includeMail ? ` · ${importantMail.length} מיילים חשובים פוטנציאליים` : ""}`,
    recommendation: !includeSuggestions ? "" : selectedTasks.some(task => task.urgent)
      ? "הצעה: התחל במשימה הדחופה ביותר, אשר מי האחראי והקצה לה חלון ביומן."
      : "הצעה: בדוק את הלו״ז והדד־ליינים, ובחר צעד אחד ברור לביצוע הבא.",
  };
}

export type DailyBriefing = ReturnType<typeof makeDailyBriefing>;
