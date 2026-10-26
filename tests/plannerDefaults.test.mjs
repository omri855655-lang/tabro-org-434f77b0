import test from "node:test";
import assert from "node:assert/strict";
import { plannerStartNow, plannerScrollTop, hasMatchingPlannerTask } from "../src/lib/plannerDefaults.ts";
import { createPlannerTask } from "../src/lib/plannerTaskCreation.ts";

test("new activity uses today's local minute without mutating the clock", () => {
  const now = new Date(2026, 9, 26, 23, 58, 42, 101);
  const start = plannerStartNow(now);
  assert.equal(start.getDate(), 26);
  assert.equal(start.getHours(), 23);
  assert.equal(start.getMinutes(), 58);
  assert.equal(start.getSeconds(), 0);
  assert.equal(now.getSeconds(), 42);
  assert.equal(new Date(start.getTime() + 30 * 60000).getDate(), 27);
});

test("initial timeline offset follows now and respects resized hours", () => {
  assert.equal(plannerScrollTop(new Date(2026, 9, 26, 12, 30), 60), 690);
  assert.equal(plannerScrollTop(new Date(2026, 9, 26, 12, 30), 60, { 0: 120, 12: 120 }), 780);
  assert.equal(plannerScrollTop(new Date(2026, 9, 26, 0, 0), 60), 0);
});

test("task matching normalizes whitespace but doesn't confuse a partial title", () => {
  assert.equal(hasMatchingPlannerTask("  Learn  English ", [null, "learn english"]), true);
  assert.equal(hasMatchingPlannerTask("Learn", ["Learn English"]), false);
  assert.equal(hasMatchingPlannerTask("", [""]), false);
});

const event = { id: "event-1", userId: "owner", title: "Read chapter", description: "Notes", category: "Study", endTime: "2026-10-26T13:30:00+02:00", sourceId: null };
function clientMock(error = null, existing = true) {
  const calls = [];
  const client = { from(table) {
    const chain = {
      insert(row) { calls.push({ table, row }); return Promise.resolve({ error }); },
      select() { return chain; },
      eq(field, value) { calls.push({ field, value }); return chain; },
      maybeSingle() { return Promise.resolve({ data: existing ? { id: event.id } : null, error: null }); },
    };
    return chain;
  }};
  return { client, calls };
}
for (const type of ["personal", "work", "board", "project"]) {
  test(`creates one ${type} task with stable retry identity and original notes`, async () => {
    const { client, calls } = clientMock();
    const link = await createPlannerTask(client, event, "owner", { type, id: "destination", status: "Todo" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].row.id, event.id);
    assert.equal(calls[0].row.user_id, "owner");
    assert.equal(calls[0].row.notes ?? calls[0].row.status_notes, "Notes");
    assert.equal(link.sourceType, type);
  });
}
test("retries only accept a conflict belonging to the same owner and destination", async () => {
  const { client, calls } = clientMock({ code: "23505" });
  await createPlannerTask(client, event, "owner", { type: "board", id: "board-1", status: "Todo" });
  assert.ok(calls.some(call => call.field === "user_id" && call.value === "owner"));
  assert.ok(calls.some(call => call.field === "board_id" && call.value === "board-1"));
  await assert.rejects(createPlannerTask(clientMock({ code: "23505" }, false).client, event, "owner", { type: "work" }));
});
test("permission and network failures do not masquerade as success", async () => {
  await assert.rejects(createPlannerTask(clientMock({ code: "42501" }).client, event, "owner", { type: "work" }));
  const { client, calls } = clientMock();
  await assert.rejects(createPlannerTask(client, event, "other-user", { type: "personal" }));
  await assert.rejects(createPlannerTask(client, { ...event, sourceId: "existing-task" }, "owner", { type: "personal" }));
  assert.equal(calls.length, 0);
});
