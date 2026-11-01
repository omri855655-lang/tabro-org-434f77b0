import { triageEmail, type MailPreferences } from "../../supabase/functions/_shared/emailTriage.ts";

export type BriefingMode = "morning" | "urgent";
export type BriefingTask = { id: string; description: string; status: string | null; planned_end: string | null; urgent: boolean | null; overdue: boolean | null; archived: boolean; responsible: string | null; task_type: string; progress?: string | null };
export type BriefingEvent = { id: string; title: string; start_time: string; end_time: string; location: string | null; all_day: boolean | null; description?: string | null };
export type BriefingMail = { email_subject: string | null; email_from: string | null; email_date: string | null; category: string | null };

export function recurringBriefingTasks(tasks: { id: string; title: string; description: string | null; frequency: string; day_of_week: number | null; day_of_month: number | null; reminder_time: string | null }[], completedIds: string[], now = new Date()): BriefingTask[] {
  const today = israelDate(now);
  const day = new Date(`${today}T12:00:00Z`);
  return tasks.filter(task => !completedIds.includes(task.id) && (task.frequency === "daily" || (task.frequency === "weekly" && task.day_of_week === day.getUTCDay()) || (task.frequency === "monthly" && task.day_of_month === day.getUTCDate())))
    .map(task => ({ id: `recurring:${task.id}`, description: task.title, status: null, planned_end: today, urgent: false, overdue: false, archived: false, responsible: null, task_type: "recurring", progress: [task.reminder_time ? `שעה מתוכננת: ${task.reminder_time}` : "", task.description].filter(Boolean).join(" · ") }));
}

export function israelDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function makeDailyBriefing(tasks: BriefingTask[], events: BriefingEvent[], emails: BriefingMail[], mode: BriefingMode, now = new Date(), prefs?: MailPreferences) {
  const today = israelDate(now);
  const dueDay = (value: string | null) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : israelDate(date);
  };
  const selectedTasks = tasks.filter(task => {
    if (task.archived || ["בוצע", "completed", "done", "cancelled", "בוטל"].includes((task.status || "").toLowerCase())) return false;
    const due = dueDay(task.planned_end);
    return mode === "urgent" ? task.urgent || (due !== null && due <= today) : task.urgent || (due !== null && due <= today);
  }).sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)) || (dueDay(a.planned_end) || "9999").localeCompare(dueDay(b.planned_end) || "9999"));
  const selectedEvents = events.filter(event => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start && israelDate(start) <= today && israelDate(new Date(end.getTime() - 1)) >= today && (mode === "morning" || end > now);
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const importantMail = emails.map(email => ({ ...email, ...triageEmail({ ...email, category: email.category || "personal" }, prefs) }))
    .filter(email => {
      const received = new Date(email.email_date || "");
      return !Number.isNaN(received.getTime()) && received <= now && now.getTime() - received.getTime() <= 7 * 86400000 && email.priority >= 4;
    }).sort((a, b) => b.priority - a.priority).slice(0, 10);
  const rows: string[][] = [];
  for (const task of selectedTasks) rows.push([
    task.urgent ? "משימה דחופה" : "משימה להיום / באיחור", task.description,
    task.planned_end || "לא הוגדר מועד", task.responsible || "לא הוגדר איש קשר",
    task.progress?.trim() || "הצעה: הגדר את הצעד הבא ובדוק מול האחראי מה חסר להשלמה.",
  ]);
  for (const event of selectedEvents) rows.push([
    "לו״ז", event.title,
    event.all_day ? "כל היום" : new Date(event.start_time).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }),
    event.location || "לא הוגדר מיקום", event.description || "הצעה: הכן מראש את החומרים והקצה זמן הגעה במידת הצורך.",
  ]);
  for (const email of importantMail) rows.push([
    "מייל שעשוי לדרוש טיפול", email.email_subject || "ללא נושא", email.email_date || "", email.email_from || "שולח לא ידוע",
    email.security ? "בדוק באתר הרשמי; אל תמסור סיסמאות או קודי אימות בתגובה." : "בדוק את ההודעה המקורית לפני פעולה; הסיווג מבוסס על נושא ושולח בלבד.",
  ]);
  return {
    date: today, mode, rows,
    title: mode === "morning" ? "Tabro · היום שלך" : "Tabro · דחופים להמשך היום",
    summary: `${selectedTasks.length} משימות · ${selectedEvents.length} אירועים · ${importantMail.length} מיילים חשובים פוטנציאליים`,
    recommendation: selectedTasks.some(task => task.urgent)
      ? "הצעה: התחל במשימה הדחופה ביותר, אשר מי האחראי והקצה לה חלון ביומן."
      : "הצעה: בדוק את הלו״ז והדד־ליינים, ובחר צעד אחד ברור לביצוע הבא.",
  };
}
