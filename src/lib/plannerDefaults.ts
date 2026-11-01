export function plannerStartNow(now = new Date()): Date {
  const start = new Date(now);
  start.setSeconds(0, 0);
  return start;
}

export function plannerTaskDraft(task: { id: string; title: string; category: string; source: string }, day: Date, now = new Date()) {
  const start = plannerStartNow(now);
  start.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  const linkedSources: Record<string, string> = {
    work: "work_task", personal: "personal_task", recurring: "recurring_task", project: "project_task",
  };
  return {
    start,
    end: new Date(start.getTime() + 30 * 60_000),
    title: task.title,
    category: task.category || (task.source === "work" ? "עבודה" : "אישי"),
    sourceType: linkedSources[task.source] || task.source,
    sourceId: task.id,
  };
}

export function plannerScrollTop(now: Date, hourHeight: number, overrides: Record<number, number> = {}): number {
  let offset = 40;
  for (let hour = 0; hour < now.getHours(); hour++) offset += overrides[hour] || hourHeight;
  offset += now.getMinutes() / 60 * (overrides[now.getHours()] || hourHeight);
  return Math.max(0, offset - 100);
}

export function hasMatchingPlannerTask(title: string, taskTitles: Array<string | null | undefined>): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const target = normalize(title);
  return Boolean(target) && taskTitles.some(value => value && normalize(value) === target);
}
