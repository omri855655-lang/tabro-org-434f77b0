export interface LearningEntry {
  id: string; date: string; category: string; subtopic?: string; level?: string;
  title: string; content?: string; summary: string; feedback?: string;
}

export function normalizeLearningEntries(value: unknown): LearningEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2000).flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || row.id.length > 120
      || typeof row.date !== "string" || !Number.isFinite(new Date(row.date).getTime())
      || typeof row.title !== "string" || !row.title.trim() || typeof row.summary !== "string") return [];
    const text = (key: string, max: number) => typeof row[key] === "string" ? String(row[key]).slice(0, max) : "";
    return [{ id: row.id, date: new Date(row.date).toISOString(), title: text("title", 500),
      category: text("category", 200), subtopic: text("subtopic", 200), level: text("level", 40),
      content: text("content", 20000), summary: text("summary", 10000), feedback: text("feedback", 10000) }];
  });
}

export function mergeLearningEntries(local: LearningEntry[], remote: LearningEntry[]) {
  const merged = new Map<string, LearningEntry>();
  for (const entry of normalizeLearningEntries([...local, ...remote])) merged.set(entry.id, entry);
  return [...merged.values()].sort((a,b) => b.date.localeCompare(a.date)).slice(0,1000);
}

export const learningHistoryKey = (userId?: string) => `zoneflow-learning-history-${userId || "guest"}`;

export interface LearningRow {
  user_id: string; id: string; completed_at: string; category: string; subtopic: string;
  level: string; title: string; content: string; summary: string; feedback: string;
}
interface HistoryQuery extends PromiseLike<{ data: LearningRow[] | null; error: unknown }> {
  eq(column: string, value: string): HistoryQuery;
  order(column: string, options: { ascending: boolean }): HistoryQuery;
  limit(value: number): HistoryQuery;
}
export interface LearningHistoryClient {
  from(table: "zoneflow_learning_history"): {
    select(columns: string): HistoryQuery;
    upsert(rows: LearningRow[], options: { onConflict: string }): PromiseLike<{ error: unknown }>;
  };
}

export function createLearningHistoryStore(client: LearningHistoryClient) {
  return {
    async read(userId: string) {
      if (!userId) throw new Error("Authentication required");
      const { data, error } = await client.from("zoneflow_learning_history").select("*")
        .eq("user_id", userId).order("completed_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return normalizeLearningEntries((data || []).filter(row => row.user_id === userId)
        .map(({ completed_at, ...row }) => ({ ...row, date: completed_at })));
    },
    async save(userId: string, entries: LearningEntry[]) {
      if (!userId) throw new Error("Authentication required");
      const rows = normalizeLearningEntries(entries).map(entry => ({
        user_id: userId, id: entry.id, completed_at: entry.date, category: entry.category,
        title: entry.title, subtopic: entry.subtopic || "", level: entry.level || "",
        content: entry.content || "", summary: entry.summary, feedback: entry.feedback || "",
      }));
      if (!rows.length) return;
      const { error } = await client.from("zoneflow_learning_history").upsert(rows, { onConflict: "user_id,id" });
      if (error) throw error;
    },
  };
}
