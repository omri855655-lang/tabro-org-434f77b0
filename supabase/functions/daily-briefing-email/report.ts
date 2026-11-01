import { israelDate, makeDailyBriefing, projectBriefingTasks, recurringBriefingTasks, type BriefingTask } from "../_shared/dailyBriefing.ts";
import { BRIEFING_SLOTS, type BriefingEmailSettings, type BriefingSlot } from "../_shared/briefingSchedule.ts";

// Loads only the given user's own rows (every query is scoped by user_id) and builds
// the briefing. Any failed query throws so a partial report is never sent.
// deno-lint-ignore no-explicit-any
type Admin = any;

export async function buildReport(admin: Admin, userId: string, slot: BriefingSlot, now: Date, settings: Record<string, any>, briefing: BriefingEmailSettings) {
  const today = israelDate(now);
  const mode = BRIEFING_SLOTS[slot].mode;
  const includeMail = briefing.includeMail && mode === "morning";
  const [tasks, events, mail, recurring, completions, projects] = await Promise.all([
    briefing.includeTasks
      ? admin.from("tasks").select("id,description,status,status_notes,planned_end,urgent,overdue,archived,responsible,task_type,progress")
        .eq("user_id", userId).eq("archived", false).or("status.is.null,status.neq.בוצע")
        .order("planned_end", { ascending: true, nullsFirst: true }).limit(2000)
      : { data: [], error: null },
    briefing.includePlanner
      ? admin.from("calendar_events").select("id,title,start_time,end_time,location,all_day,description")
        .eq("user_id", userId).gte("end_time", new Date(now.getTime() - 36 * 3600000).toISOString())
        .lte("start_time", new Date(now.getTime() + 36 * 3600000).toISOString()).order("start_time").limit(500)
      : { data: [], error: null },
    includeMail
      ? admin.from("email_analyses").select("email_subject,email_from,email_date,category")
        .eq("user_id", userId).gte("email_date", new Date(now.getTime() - 7 * 86400000).toISOString())
        .order("email_date", { ascending: false }).limit(1000)
      : { data: [], error: null },
    briefing.includeTasks ? admin.from("recurring_tasks").select("id,title,description,frequency,day_of_week,day_of_month,reminder_time").eq("user_id", userId).limit(1000) : { data: [], error: null },
    briefing.includeTasks ? admin.from("recurring_task_completions").select("recurring_task_id").eq("user_id", userId).eq("completed_date", today).limit(1000) : { data: [], error: null },
    briefing.includeTasks ? admin.from("project_tasks").select("id,title,status,due_date,urgent,completed,assigned_email,instructions,notes").eq("user_id", userId).eq("completed", false).limit(2000) : { data: [], error: null },
  ]);
  for (const [name, result] of Object.entries({ tasks, events, mail, recurring, completions, projects })) {
    if (result.error) throw new Error(`${name}: ${result.error.message}`);
  }
  const combined: BriefingTask[] = [
    ...(tasks.data || []).map((task: any) => ({ ...task, notes: task.status_notes })),
    ...recurringBriefingTasks(recurring.data || [], (completions.data || []).map((row: any) => row.recurring_task_id), now),
    ...projectBriefingTasks(projects.data || []),
  ];
  return makeDailyBriefing(combined, events.data || [], mail.data || [], mode, now, settings.emailTriage, {
    includeTasks: briefing.includeTasks, includeEvents: briefing.includePlanner, includeMail, includeSuggestions: briefing.includeSuggestions,
  });
}

