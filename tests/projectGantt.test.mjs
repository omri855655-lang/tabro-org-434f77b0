import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomaticSchedule,
  createScheduleDates,
  formatProjectTaskTitle,
  getGanttTaskPeriod,
  parseLocalDate,
} from "../src/lib/projectGantt.ts";

test("createScheduleDates spreads work through the project target", () => {
  const dates = createScheduleDates(3, new Date(2026, 9, 10), new Date(2026, 9, 20));
  assert.deepEqual(dates, ["2026-10-10", "2026-10-15", "2026-10-20"]);
});

test("legacy AI task JSON is displayed as a readable title", () => {
  assert.equal(formatProjectTaskTitle('{"title":"בדיקות לפני השקה","description":"פרטים"}'), "בדיקות לפני השקה");
  assert.equal(formatProjectTaskTitle('"title": "הכנת תוצר",'), "הכנת תוצר");
  assert.equal(formatProjectTaskTitle("משימה רגילה"), "משימה רגילה");
});

test("createScheduleDates keeps one day per task when the target is too close", () => {
  const dates = createScheduleDates(4, new Date(2026, 9, 10), new Date(2026, 9, 11));
  assert.equal(dates.length, 4);
  assert.equal(dates[0], "2026-10-10");
  assert.equal(new Set(dates).size, 4);
});

test("automatic scheduling ignores completed tasks and respects sort order", () => {
  const result = buildAutomaticSchedule([
    { id: "later", completed: false, due_date: null, sort_order: 2 },
    { id: "done", completed: true, due_date: null, sort_order: 0 },
    { id: "first", completed: false, due_date: null, sort_order: 1 },
  ], new Date(2026, 9, 10), new Date(2026, 9, 14));

  assert.deepEqual(result.map((entry) => entry.id), ["first", "later"]);
  assert.deepEqual(result.map((entry) => entry.due_date), ["2026-10-10", "2026-10-14"]);
});

test("task periods use real due dates and estimate undated work", () => {
  const dated = getGanttTaskPeriod({ due_date: "2026-10-20" }, new Date(2026, 9, 10), 0);
  const estimated = getGanttTaskPeriod({ due_date: null }, new Date(2026, 9, 10), 2);

  assert.equal(dated.isEstimated, false);
  assert.equal(dated.start.getDate(), 18);
  assert.equal(parseLocalDate("2026-10-20")?.getDate(), 20);
  assert.equal(estimated.isEstimated, true);
  assert.equal(estimated.start.getDate(), 14);
});

