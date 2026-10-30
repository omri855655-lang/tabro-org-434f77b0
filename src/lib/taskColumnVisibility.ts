export const OPTIONAL_TASK_COLUMNS = ["index", "category", "responsible", "status", "statusNotes", "progress", "plannedEnd", "overdue", "createdAt", "updatedAt", "ai"] as const;

export function normalizeHiddenTaskColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((key): key is string => typeof key === "string" && OPTIONAL_TASK_COLUMNS.some(allowed => allowed === key)))];
}

export function taskColumnStorageKey(userId: string, ownerId: string, taskType: string, sheet: string | null) {
  return `tabro-task-columns:v1:${JSON.stringify([userId, ownerId, taskType, sheet])}`;
}
