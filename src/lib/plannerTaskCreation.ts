import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export type PlannerTaskDestination =
  | { type: "personal" | "work" }
  | { type: "board"; id: string; status: string }
  | { type: "project"; id: string };

// A calendar event keeps one task identity across retries, including a lost
// response after a successful insert. Existing rows are never overwritten.
export async function createPlannerTask(client: SupabaseClient<Database>, event: CalendarEvent, userId: string, destination: PlannerTaskDestination) {
  if (!userId || event.userId !== userId || event.sourceId) throw new Error("Invalid task source");
  const end = new Date(event.endTime);
  if (!event.title.trim() || Number.isNaN(end.getTime())) throw new Error("Invalid event");
  const due = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const notes = [event.description, event.location, event.meetingUrl].filter(Boolean).join("\n");
  const table = destination.type === "board" ? "custom_board_items" : destination.type === "project" ? "project_tasks" : "tasks";
  const common = { id: event.id, user_id: userId };
  const result = destination.type === "board"
    ? await client.from("custom_board_items").insert({ ...common, board_id: destination.id, title: event.title.trim(), notes, category: event.category, status: destination.status, sheet_name: "ראשי" })
    : destination.type === "project"
      ? await client.from("project_tasks").insert({ ...common, project_id: destination.id, title: event.title.trim(), notes, due_date: due, status: "לא התחיל", completed: false })
      : await client.from("tasks").insert({ ...common, description: event.title.trim(), category: event.category, status_notes: notes, planned_end: due, status: "טרם החל", task_type: destination.type, sheet_name: String(end.getFullYear()) });
  if (result.error) {
    if (result.error.code !== "23505") throw result.error;
    // Verify a uniqueness conflict is our own previous insert in this destination.
    if (destination.type === "board") {
      const existing = await client.from("custom_board_items").select("id").eq("id", event.id).eq("user_id", userId).eq("board_id", destination.id).maybeSingle();
      if (existing.error || !existing.data) throw result.error;
    } else if (destination.type === "project") {
      const existing = await client.from("project_tasks").select("id").eq("id", event.id).eq("user_id", userId).eq("project_id", destination.id).maybeSingle();
      if (existing.error || !existing.data) throw result.error;
    } else {
      const existing = await client.from("tasks").select("id").eq("id", event.id).eq("user_id", userId).eq("task_type", destination.type).maybeSingle();
      if (existing.error || !existing.data) throw result.error;
    }
  }
  return { sourceId: event.id, sourceType: destination.type, table };
}
