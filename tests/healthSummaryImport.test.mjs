import test from 'node:test';
import assert from 'node:assert/strict';
import { HEALTH_SUMMARY_TEMPLATE, parseHealthSummary, mergeHealthDays } from '../src/lib/healthSummaryImport.ts';

test('watch interchange validates dates, units and duplicate days without partial import', () => {
  const rows = parseHealthSummary(HEALTH_SUMMARY_TEMPLATE, 'csv');
  assert.equal(rows[0].steps, 6500);
  assert.equal(rows[0].sleepHours, 7.5);
  assert.deepEqual(parseHealthSummary(JSON.stringify(rows), 'json'), rows);
  for (const invalid of [[{ ...rows[0], date: '2026-02-30' }], [{ ...rows[0], steps: -1 }], [{ ...rows[0], sleepHours: 25 }], [rows[0], rows[0]], [{ date: '2026-10-25' }]]) assert.throws(() => parseHealthSummary(JSON.stringify(invalid), 'json'));
  assert.throws(() => parseHealthSummary('date,calories\n2026-10-25,100', 'csv'));
});
test('reimport updates rather than adding steps and preserves missing fields and other days', () => {
  const rows = parseHealthSummary(HEALTH_SUMMARY_TEMPLATE, 'csv');
  const result = mergeHealthDays(rows, [{ date: rows[0].date, steps: 7000, sleepHours: null }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].steps, 7000);
  assert.equal(result[0].sleepHours, 7.5);
  assert.deepEqual(mergeHealthDays(result, result), result);
});
