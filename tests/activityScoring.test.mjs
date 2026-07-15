import assert from "node:assert/strict";
import test from "node:test";

import { calculateFallbackPoints } from "../src/lib/activityScoring.ts";

test("short focus sessions are recorded without points", () => {
  assert.equal(calculateFallbackPoints("focus_session_completed", 2), 0);
});

test("focus points scale by complete three-minute units", () => {
  assert.equal(calculateFallbackPoints("focus_session_completed", 25), 8);
});

test("focus rewards stop growing after the configured maximum", () => {
  assert.equal(calculateFallbackPoints("focus_session_completed", 180), 60);
  assert.equal(calculateFallbackPoints("focus_session_completed", 500), 60);
});

test("book points use page count rather than client-provided points", () => {
  assert.equal(calculateFallbackPoints("book_completed", undefined, 24), 5);
  assert.equal(calculateFallbackPoints("book_completed", undefined, 250), 15);
});

test("events without a scoring rule do not produce points", () => {
  assert.equal(calculateFallbackPoints("focus_session_started"), 0);
});

test("important tasks receive the configured bonus", () => {
  assert.equal(calculateFallbackPoints("important_task_completed"), 3);
});

test("completed goals receive a meaningful milestone reward", () => {
  assert.equal(calculateFallbackPoints("goal_completed"), 15);
});
