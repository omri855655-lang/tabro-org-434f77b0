import assert from "node:assert/strict";
import test from "node:test";

import { eventOverlapsRange } from "../src/lib/plannerEvents.ts";

const rangeStart = new Date("2026-10-11T00:00:00.000Z");
const rangeEnd = new Date("2026-10-17T23:59:59.999Z");

test("keeps an event that starts and ends inside the range", () => {
  assert.equal(eventOverlapsRange({
    startTime: "2026-10-13T08:00:00.000Z",
    endTime: "2026-10-13T09:00:00.000Z",
  }, rangeStart, rangeEnd), true);
});

test("keeps an event that spans the entire visible range", () => {
  assert.equal(eventOverlapsRange({
    startTime: "2026-10-01T08:00:00.000Z",
    endTime: "2026-10-30T09:00:00.000Z",
  }, rangeStart, rangeEnd), true);
});

test("drops an event that ends before the visible range", () => {
  assert.equal(eventOverlapsRange({
    startTime: "2026-10-01T08:00:00.000Z",
    endTime: "2026-10-10T23:59:59.999Z",
  }, rangeStart, rangeEnd), false);
});

test("drops malformed event dates", () => {
  assert.equal(eventOverlapsRange({ startTime: "invalid", endTime: "invalid" }, rangeStart, rangeEnd), false);
});

