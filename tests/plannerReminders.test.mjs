import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reminderOffsets, dueReminder, dueCompletion, plannerChannelAllowed, remainingLabel, legacyReminderType,
  nextLocalDate, inWindow, MORNING_WINDOW, DEADLINE_WINDOW, pushFinish, deliveryFinished, escapeHtml,
} from '../supabase/functions/_shared/plannerReminders.ts';
import { israelClock } from '../supabase/functions/_shared/briefingSchedule.ts';
import { plannerEmailAllowed } from '../supabase/functions/_shared/notificationPrefs.ts';

const MIN = 60_000;
const ev = (start, extra = {}) => ({ id: 'e1', user_id: 'u1', start_time: start, end_time: new Date(Date.parse(start) + 60 * MIN).toISOString(), ...extra });
// Mirrors the user's saved settings (offsets 1/5/15/60, email+push, both channels, quiet 23-05).
const userSettings = {
  email: { enabled: true, content: ['tasks', 'calendar'] },
  push: { enabled: true, content: ['tasks', 'calendar'] },
  planner: { enabled: true, reminderMinutes: [1, 5, 15, 60], sameDayChannel: 'both', completionChannel: 'both' },
  quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '05:00', dailyLimit: 0,
};
const allowed = (settings, kind, channel, israelMinutes = 600, acceptedToday = 0) =>
  plannerChannelAllowed(settings, kind, channel, { israelMinutes, acceptedToday });

// Every-minute cron ticks (a fraction of a second after the minute), collecting each
// reminder identity once, as the delivery ledger would.
function simulate(event, offsets, fromIso, toIso, stepMin = 1) {
  const sent = [];
  const seen = new Set();
  for (let t = Date.parse(fromIso) + 250; t <= Date.parse(toIso); t += stepMin * MIN) {
    const due = dueReminder(event, t, offsets);
    if (due && !seen.has(due.itemKey)) { seen.add(due.itemKey); sent.push({ at: new Date(t - 250).toISOString().slice(11, 16), offset: due.offset, remaining: due.remainingMinutes }); }
  }
  return sent;
}

test('one-minute reminder fires on an every-minute cron (the reported 09:28 event)', () => {
  const sent = simulate(ev('2026-11-02T09:28:00Z'), [1, 5, 15, 60], '2026-11-02T08:20:00Z', '2026-11-02T09:35:00Z');
  assert.deepEqual(sent, [
    { at: '08:28', offset: 60, remaining: 60 },
    { at: '09:13', offset: 15, remaining: 15 },
    { at: '09:23', offset: 5, remaining: 5 },
    { at: '09:27', offset: 1, remaining: 1 },
  ]);
});

test('the old five-minute cron could not deliver the one-minute reminder for that event', () => {
  const sent = simulate(ev('2026-11-02T09:28:00Z'), [1], '2026-11-02T09:20:00Z', '2026-11-02T09:35:00Z', 5);
  assert.deepEqual(sent, []);
});

test('event starting mid-minute still gets its one-minute reminder with truthful wording', () => {
  const sent = simulate(ev('2026-11-02T09:28:30Z'), [1], '2026-11-02T09:20:00Z', '2026-11-02T09:35:00Z');
  assert.deepEqual(sent, [{ at: '09:28', offset: 1, remaining: 1 }]);
});

test('five and fifteen minute offsets are honoured', () => {
  const sent = simulate(ev('2026-11-02T12:00:00Z'), [5, 15], '2026-11-02T11:00:00Z', '2026-11-02T12:05:00Z');
  assert.deepEqual(sent.map(s => [s.at, s.offset]), [['11:45', 15], ['11:55', 5]]);
});

test('a late tick still sends within grace using the real remaining minutes', () => {
  const due = dueReminder(ev('2026-11-02T12:00:00Z'), Date.parse('2026-11-02T11:48:00Z'), [15]);
  assert.equal(due.offset, 15);
  assert.equal(due.remainingMinutes, 12);
  assert.equal(remainingLabel(12), '12 דקות');
  assert.equal(remainingLabel(1), 'דקה');
  assert.equal(remainingLabel(60), 'שעה');
});

test('no stale backfill: missed larger offsets are dropped, not stacked', () => {
  // Created 20 minutes before start with only a 60-minute reminder: nothing is sent.
  assert.deepEqual(simulate(ev('2026-11-02T12:00:00Z'), [60], '2026-11-02T11:40:00Z', '2026-11-02T12:05:00Z'), []);
  // Created 20 minutes before start with 60 and 15: only the 15-minute one is sent.
  assert.deepEqual(simulate(ev('2026-11-02T12:00:00Z'), [15, 60], '2026-11-02T11:40:00Z', '2026-11-02T12:05:00Z').map(s => s.offset), [15]);
});

test('never remind after the event started or for all-day events', () => {
  assert.equal(dueReminder(ev('2026-11-02T12:00:00Z'), Date.parse('2026-11-02T12:00:10Z'), [1, 5]), null);
  assert.equal(dueReminder(ev('2026-11-02T12:00:00Z', { all_day: true }), Date.parse('2026-11-02T11:59:30Z'), [1]), null);
  assert.equal(dueReminder({ id: 'e1', user_id: 'u1', start_time: 'not-a-date' }, Date.now(), [1]), null);
});

test('missing reminder minutes use defaults, an explicit empty list means none', () => {
  assert.deepEqual(reminderOffsets({}), [1, 10, 60]);
  assert.deepEqual(reminderOffsets({ planner: {} }), [1, 10, 60]);
  assert.deepEqual(reminderOffsets({ planner: { reminderMinutes: [] } }), []);
  assert.deepEqual(reminderOffsets({ planner: { reminderMinutes: [60, '5', 99, 15, 15, -1, null] } }), [5, 15, 60]);
  assert.equal(dueReminder(ev('2026-11-02T12:00:00Z'), Date.parse('2026-11-02T11:59:30Z'), reminderOffsets({ planner: { reminderMinutes: [] } })), null);
});

test('rescheduling creates a new identity; the same instant in another format does not', () => {
  const a = dueReminder(ev('2026-11-02T09:28:00Z'), Date.parse('2026-11-02T09:27:00Z'), [1]);
  const sameInstant = dueReminder(ev('2026-11-02T11:28:00+02:00'), Date.parse('2026-11-02T09:27:00Z'), [1]);
  const moved = dueReminder(ev('2026-11-02T10:00:00Z'), Date.parse('2026-11-02T09:59:00Z'), [1]);
  assert.equal(a.itemKey, sameInstant.itemKey);
  assert.notEqual(a.itemKey, moved.itemKey);
  assert.equal(a.itemKey, 'e1|2026-11-02T09:28:00.000Z|1');
});

test('completion check-in only within ten minutes after a timed event ends', () => {
  const e = ev('2026-11-02T09:00:00Z');
  assert.equal(dueCompletion(e, Date.parse('2026-11-02T09:59:00Z')), null);
  assert.equal(dueCompletion(e, Date.parse('2026-11-02T10:03:00Z')).itemKey, 'e1|2026-11-02T10:00:00.000Z');
  assert.equal(dueCompletion(e, Date.parse('2026-11-02T10:11:00Z')), null);
  assert.equal(dueCompletion({ ...e, all_day: true }, Date.parse('2026-11-02T10:03:00Z')), null);
});

test("user's saved channels: push and email both allowed outside quiet hours", () => {
  for (const kind of ['planner_reminder', 'planner_completion']) {
    assert.equal(allowed(userSettings, kind, 'push'), true);
    assert.equal(allowed(userSettings, kind, 'email'), true);
    assert.equal(allowed(userSettings, kind, 'push', 23 * 60 + 30), false);
    assert.equal(allowed(userSettings, kind, 'email', 4 * 60), false);
  }
});

test('disabled settings block the matching channel only', () => {
  const s = (patch) => ({ ...userSettings, ...patch });
  assert.equal(allowed(s({ planner: { ...userSettings.planner, enabled: false } }), 'planner_reminder', 'push'), false);
  assert.equal(allowed(s({ push: { enabled: false } }), 'planner_reminder', 'push'), false);
  assert.equal(allowed(s({ push: { enabled: false } }), 'planner_reminder', 'email'), true);
  assert.equal(allowed(s({ push: { enabled: true, content: ['tasks'] } }), 'planner_reminder', 'push'), false);
  assert.equal(allowed(s({ push: { enabled: true, content: [] } }), 'planner_morning', 'push'), false);
  const app = s({ planner: { ...userSettings.planner, sameDayChannel: 'app', completionChannel: 'email' } });
  assert.equal(allowed(app, 'planner_reminder', 'push'), true);
  assert.equal(allowed(app, 'planner_reminder', 'email'), false);
  assert.equal(allowed(app, 'planner_completion', 'push'), false);
  assert.equal(allowed(app, 'planner_completion', 'email'), true);
  const off = s({ planner: { ...userSettings.planner, sameDayChannel: 'off', completionChannel: 'off' } });
  assert.equal(allowed(off, 'planner_reminder', 'push'), false);
  assert.equal(allowed(off, 'planner_completion', 'email'), false);
  assert.equal(allowed(s({ dailyLimit: 3 }), 'planner_reminder', 'push', 600, 3), false);
  assert.equal(allowed(s({ dailyLimit: 3 }), 'planner_reminder', 'push', 600, 2), true);
  // Morning / deadline summaries are push-only.
  assert.equal(allowed(userSettings, 'planner_morning', 'push', 7 * 60), true);
  assert.equal(allowed(userSettings, 'planner_morning', 'email', 7 * 60), false);
  // Legacy email wrapper agrees with the shared rules.
  assert.equal(plannerEmailAllowed(userSettings, 'reminder', 600, 5), true);
  assert.equal(plannerEmailAllowed(userSettings, 'reminder', 600, 10), false);
});

test('email success never suppresses a failed push retry (per-channel finality)', () => {
  const email = { status: 'accepted', retryable: false, attempts: 1 };
  const push = { status: 'failed', retryable: true, attempts: 1 };
  assert.equal(deliveryFinished(email), true);
  assert.equal(deliveryFinished(push), false);
  assert.equal(deliveryFinished({ ...push, attempts: 3 }), true);
  assert.equal(deliveryFinished({ status: 'failed', retryable: false, attempts: 1 }), true);
  assert.equal(deliveryFinished({ status: 'sending', retryable: true, attempts: 1 }), false);
  assert.deepEqual(pushFinish({ devicesFound: 2, providerAccepted: 1, expired: 1, rejected: 0, retryable: 0 }), { status: 'accepted', retryable: false });
  assert.deepEqual(pushFinish({ devicesFound: 2, providerAccepted: 0, expired: 0, rejected: 1, retryable: 1 }), { status: 'failed', retryable: true });
  assert.deepEqual(pushFinish({ devicesFound: 1, providerAccepted: 0, expired: 1, rejected: 0, retryable: 0 }), { status: 'skipped', retryable: false });
});

test('Israel DST boundaries: morning window and local dates follow Asia/Jerusalem', () => {
  const morning = (iso) => inWindow(israelClock(new Date(iso)).minutes, MORNING_WINDOW);
  assert.equal(morning('2026-03-26T05:00:00Z'), true);  // winter +02:00 -> 07:00
  assert.equal(morning('2026-03-27T04:00:00Z'), true);  // summer starts -> 07:00
  assert.equal(morning('2026-03-27T05:00:00Z'), false); // 08:00
  assert.equal(morning('2026-10-24T04:00:00Z'), true);  // summer -> 07:00
  assert.equal(morning('2026-10-25T04:00:00Z'), false); // winter again -> 06:00
  assert.equal(morning('2026-10-25T05:00:00Z'), true);
  assert.equal(inWindow(israelClock(new Date('2026-11-02T10:00:00Z')).minutes, DEADLINE_WINDOW), true);
  assert.equal(israelClock(new Date('2026-10-24T21:30:00Z')).date, '2026-10-25');
  assert.equal(nextLocalDate('2026-10-24'), '2026-10-25');
  assert.equal(nextLocalDate('2026-10-25'), '2026-10-26');
  assert.equal(nextLocalDate('2026-12-31'), '2027-01-01');
});

test('legacy bell types and escaping', () => {
  assert.equal(legacyReminderType(60), 'event_1hour');
  assert.equal(legacyReminderType(5), 'event_5min');
  assert.equal(escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});
