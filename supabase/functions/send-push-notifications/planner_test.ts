import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dueReminder, plannerChannelAllowed, reminderOffsets } from "../_shared/plannerReminders.ts";

// Deno-side regression for the reported event: every-minute ticks deliver 60/15/5/1 once each.
Deno.test("every-minute cron delivers each saved offset once, including one minute", () => {
  const event = { id: "e", user_id: "u", start_time: "2026-11-02T09:28:00Z" };
  const offsets = reminderOffsets({ planner: { reminderMinutes: [1, 5, 15, 60] } });
  const seen = new Map<string, number>();
  for (let t = Date.parse("2026-11-02T08:00:00Z") + 300; t < Date.parse("2026-11-02T09:40:00Z"); t += 60_000) {
    const due = dueReminder(event, t, offsets);
    if (due) seen.set(due.itemKey, (seen.get(due.itemKey) || 0) + 1);
  }
  assertEquals([...seen.keys()].map(k => Number(k.split("|")[2])).sort((a, b) => a - b), [1, 5, 15, 60]);
});

Deno.test("quiet hours block both channels", () => {
  const s = { quietHoursEnabled: true, quietHoursStart: "23:00", quietHoursEnd: "05:00" };
  assertEquals(plannerChannelAllowed(s, "planner_reminder", "push", { israelMinutes: 60, acceptedToday: 0 }), false);
  assertEquals(plannerChannelAllowed(s, "planner_reminder", "email", { israelMinutes: 60, acceptedToday: 0 }), false);
  assertEquals(plannerChannelAllowed(s, "planner_reminder", "push", { israelMinutes: 600, acceptedToday: 0 }), true);
});
