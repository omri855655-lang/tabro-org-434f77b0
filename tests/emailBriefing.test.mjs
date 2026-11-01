import test from 'node:test';
import assert from 'node:assert/strict';
import { triageEmail } from '../supabase/functions/_shared/emailTriage.ts';
import { makeDailyBriefing, israelDate, recurringBriefingTasks } from '../src/lib/dailyBriefing.ts';

const mail = (subject, category = 'personal') => ({ email_subject: subject, email_from: 'Service <team@example.com>', category });
test('urgent and security messages are not buried by promotional labels', () => {
  assert.equal(triageEmail(mail('Urgent: action required today', 'newsletter')).bucket, 'action');
  assert.equal(triageEmail(mail('קוד אימות לחשבון שלך', 'newsletter')).security, true);
  assert.equal(triageEmail(mail('Security alert: suspicious sign in')).bucket, 'action');
});
test('financial receipts beat broad promotion classification without matching substring sale', () => {
  assert.equal(triageEmail(mail('Your invoice', 'newsletter')).bucket, 'finance');
  assert.equal(triageEmail(mail('Wholesale team notes')).bucket, 'personal');
  assert.equal(triageEmail(mail('Sale: 20% discount')).bucket, 'promotions');
  assert.equal(triageEmail(mail('פגישה מחר', 'meeting')).bucket, 'action');
});
test('user categories override heuristics and partial preference records are supported', () => {
  assert.equal(triageEmail(mail('Urgent'), { senderBuckets: { 'example.com': 'low' } }).bucket, 'low');
  assert.ok(triageEmail(mail('Hello'), { vipSenders: ['example.com'] }).priority > 4);
  assert.equal(triageEmail(mail('Hello'), {}).reason, 'unclassified');
});
test('clear marketing beats legacy task/payment labels, but real action and manual labels win', () => {
  assert.equal(triageEmail(mail('E★X★T★R★A 50% Off Clearance', 'task')).bucket, 'promotions');
  assert.equal(triageEmail(mail('מקדימים קניות לחג | פרסומת', 'payment')).bucket, 'promotions');
  assert.equal(triageEmail(mail('Urgent 50% OFF sale', 'task')).bucket, 'promotions');
  assert.equal(triageEmail(mail('Action required: invoice overdue', 'newsletter')).bucket, 'action');
  assert.equal(triageEmail(mail('50% OFF', 'task'), { senderBuckets: { 'example.com': 'action' } }).bucket, 'action');
});
test('old verification codes are not current action items; recent security messages remain prominent', () => {
  const now = Date.parse('2026-11-01T08:00:00Z');
  const old = triageEmail({ ...mail('Your verification code'), email_date:'2026-08-30T08:00:00Z' }, undefined, now);
  assert.equal(old.bucket, 'updates');
  assert.equal(old.requiresAction, false);
  assert.ok(old.priority < 4);
  assert.equal(triageEmail({ ...mail('Your verification code'), email_date:'2026-11-01T07:55:00Z' }, undefined, now).bucket, 'action');
});

const now = new Date('2026-11-01T14:00:00Z');
test('includes due recurring tasks once and omits completed or not due occurrences', () => {
  const recurring = (id, frequency, day_of_week = null, day_of_month = null) => ({ id, title:id, frequency, day_of_week, day_of_month, description:null, reminder_time:'16:00' });
  const tasks = recurringBriefingTasks([recurring('daily', 'daily'), recurring('done', 'daily'), recurring('sunday', 'weekly', 0), recurring('monday', 'weekly', 1), recurring('first', 'monthly', null, 1)], ['done'], now);
  assert.deepEqual(tasks.map(task => task.id), ['recurring:daily', 'recurring:sunday', 'recurring:first']);
  assert.ok(tasks.every(task => task.progress.includes('16:00')));
});
const task = (id, patch = {}) => ({ id, description: id, status: 'בטיפול', planned_end: '2026-11-01', urgent: false, overdue: false, archived: false, responsible: null, task_type: 'work', ...patch });
const event = (id, start, end) => ({ id, title: id, start_time: start, end_time: end, location: null, all_day: false });
test('uses Israel date at midnight and summer DST', () => {
  assert.equal(israelDate(new Date('2026-11-01T22:30:00Z')), '2026-11-02');
  assert.equal(israelDate(new Date('2026-07-01T21:30:00Z')), '2026-07-02');
});
test('briefing excludes completed, archived and future nonurgent tasks; does not mutate input', () => {
  const tasks = [task('today'), task('future', { planned_end: '2026-12-01' }), task('done', { status: 'בוצע' }), task('archived', { archived: true }), task('urgent', { urgent: true, planned_end: null }), task('old', { planned_end: '2026-10-31' })];
  const report = makeDailyBriefing(tasks, [], [], 'morning', now);
  assert.deepEqual(report.rows.map(row => row[1]), ['urgent', 'old', 'today']);
  assert.equal(tasks[0].id, 'today');
  assert.equal(report.rows[0][3], 'לא הוגדר איש קשר');
});
test('afternoon drops ended meetings but morning includes today and overlapping events', () => {
  const events = [event('morning', '2026-11-01T07:00:00Z', '2026-11-01T08:00:00Z'), event('later', '2026-11-01T15:00:00Z', '2026-11-01T16:00:00Z'), event('ended-midnight', '2026-10-31T18:00:00Z', '2026-10-31T22:00:00Z'), event('invalid', 'bad', 'bad')];
  assert.deepEqual(makeDailyBriefing([], events, [], 'morning', now).rows.map(row => row[1]), ['morning', 'later']);
  assert.deepEqual(makeDailyBriefing([], events, [], 'urgent', now).rows.map(row => row[1]), ['later']);
});
test('mail is recent, priority-filtered, capped and never declared safe', () => {
  const emails = [...Array.from({ length: 12 }, (_, i) => ({ ...mail(`Urgent ${i}`), email_date: '2026-11-01T10:00:00Z' })), { ...mail('Urgent stale'), email_date: '2026-09-01' }, { ...mail('Sale'), email_date: '2026-11-01T10:00:00Z' }];
  const report = makeDailyBriefing([], [], emails, 'morning', now);
  assert.equal(report.rows.length, 10);
  assert.ok(report.rows.every(row => row[4].includes('ההודעה המקורית')));
});

// ---- Scheduled briefing email rules ----
import { BRIEFING_SLOTS, briefingSkipReason, dueBriefingSlot, exceedsDailyLimit, israelClock, israelDayStartUtc, isRetryableProviderStatus, isWithinQuietHours, normalizeBriefingSettings } from '../supabase/functions/_shared/briefingSchedule.ts';
import { plannerEmailAllowed } from '../supabase/functions/_shared/notificationPrefs.ts';
import { projectBriefingTasks } from '../src/lib/dailyBriefing.ts';

test('briefing slots are 08:00 and 16:00 Israel time in winter and summer (DST)', () => {
  assert.equal(BRIEFING_SLOTS.morning.time, '08:00');
  assert.equal(BRIEFING_SLOTS.afternoon.time, '16:00');
  // Winter (UTC+2): 08:00 local = 06:00Z, 16:00 local = 14:00Z
  assert.deepEqual(dueBriefingSlot(new Date('2026-12-15T06:00:00Z')), { slot: 'morning', date: '2026-12-15' });
  assert.deepEqual(dueBriefingSlot(new Date('2026-12-15T14:00:00Z')), { slot: 'afternoon', date: '2026-12-15' });
  assert.equal(dueBriefingSlot(new Date('2026-12-15T05:50:00Z')), null);
  // Summer (UTC+3): 08:00 local = 05:00Z
  assert.deepEqual(dueBriefingSlot(new Date('2026-07-01T05:00:00Z')), { slot: 'morning', date: '2026-07-01' });
  assert.equal(dueBriefingSlot(new Date('2026-07-01T06:00:00Z')), null);
  assert.deepEqual(dueBriefingSlot(new Date('2026-07-01T13:10:00Z')), { slot: 'afternoon', date: '2026-07-01' });
});
test('DST transition days still map to local 08:00', () => {
  // Israel DST 2026 starts Fri 27 Mar and ends Sun 25 Oct.
  assert.deepEqual(dueBriefingSlot(new Date('2026-03-27T05:00:00Z')), { slot: 'morning', date: '2026-03-27' });
  assert.equal(dueBriefingSlot(new Date('2026-03-27T06:00:00Z')), null);
  assert.deepEqual(dueBriefingSlot(new Date('2026-10-25T06:00:00Z')), { slot: 'morning', date: '2026-10-25' });
  assert.equal(israelDayStartUtc('2026-07-01').toISOString(), '2026-06-30T21:00:00.000Z');
  assert.equal(israelDayStartUtc('2026-12-01').toISOString(), '2026-11-30T22:00:00.000Z');
  assert.equal(israelClock(new Date('2026-12-01T22:30:00Z')).date, '2026-12-02');
});
test('slot window closes after one hour so stale briefings are not sent late', () => {
  assert.equal(dueBriefingSlot(new Date('2026-12-15T06:59:00Z'))?.slot, 'morning');
  assert.equal(dueBriefingSlot(new Date('2026-12-15T07:00:00Z')), null);
});
test('briefing email is opt-in only and keeps slot choices', () => {
  assert.equal(normalizeBriefingSettings(undefined).enabled, false);
  assert.equal(normalizeBriefingSettings({ enabled: 'true' }).enabled, false);
  assert.deepEqual(normalizeBriefingSettings({ enabled: true, afternoon: false }), { enabled: true, morning: true, afternoon: false, includeTasks: true, includePlanner: true, includeMail: true, includeSuggestions: true, attachPdf: true });
  assert.equal(briefingSkipReason({ email: { enabled: true } }, 'morning'), 'not_opted_in');
  assert.equal(briefingSkipReason({ dailyBriefingEmail: { enabled: true, afternoon: false } }, 'afternoon'), 'slot_disabled');
  assert.equal(briefingSkipReason({ dailyBriefingEmail: { enabled: true }, email: { enabled: false } }, 'morning'), 'email_disabled');
  assert.equal(briefingSkipReason({ dailyBriefingEmail: { enabled: true }, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '09:00' }, 'morning'), 'quiet_hours');
  assert.equal(briefingSkipReason({ dailyBriefingEmail: { enabled: true }, quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '05:00' }, 'morning'), null);
  assert.equal(briefingSkipReason({ dailyBriefingEmail: { enabled: true }, quietHoursEnabled: false, quietHoursStart: '07:00', quietHoursEnd: '09:00' }, 'morning'), null);
});
test('quiet hours, daily limit and retry classification', () => {
  assert.equal(isWithinQuietHours(16 * 60, '15:00', '17:00'), true);
  assert.equal(isWithinQuietHours(16 * 60, '23:00', '05:00'), false);
  assert.equal(isWithinQuietHours(2 * 60, '23:00', '05:00'), true);
  assert.equal(exceedsDailyLimit(0, 99), false);
  assert.equal(exceedsDailyLimit(3, 3), true);
  assert.equal(exceedsDailyLimit(3, 2), false);
  for (const status of [0, 409, 429, 500, 503]) assert.equal(isRetryableProviderStatus(status), true);
  for (const status of [400, 401, 403, 422]) assert.equal(isRetryableProviderStatus(status), false);
});
test('planner emails follow the saved channel, minutes and quiet hours', () => {
  assert.equal(plannerEmailAllowed({}, 'reminder', 600, 10), true);
  assert.equal(plannerEmailAllowed({}, 'completion', 600), false);
  assert.equal(plannerEmailAllowed({ planner: { reminderMinutes: [1, 15, 60] } }, 'reminder', 600, 10), false);
  assert.equal(plannerEmailAllowed({ planner: { sameDayChannel: 'app' } }, 'reminder', 600, 60), false);
  assert.equal(plannerEmailAllowed({ email: { enabled: false } }, 'reminder', 600, 60), false);
  assert.equal(plannerEmailAllowed({ planner: { completionChannel: 'both' } }, 'completion', 600), true);
  assert.equal(plannerEmailAllowed({ quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '05:00' }, 'reminder', 60, 60), false);
  assert.equal(plannerEmailAllowed({ dailyLimit: 2 }, 'reminder', 600, 60, 2), false);
});
test('project tasks show only a real saved contact and exclude completed ones', () => {
  const mapped = projectBriefingTasks([{ id: 'p', title: 'Step', status: 'בטיפול', due_date: '2026-11-01', urgent: false, completed: false, assigned_email: null, instructions: null }, { id: 'q', title: 'Done', status: 'בטיפול', due_date: '2026-11-01', urgent: true, completed: true, assigned_email: 'a@b.co', instructions: 'x' }]);
  const report = makeDailyBriefing(mapped, [], [], 'urgent', now);
  assert.deepEqual(report.items.map(item => item.title), ['Step']);
  assert.equal(report.items[0].who, 'לא הוגדר איש קשר');
  assert.ok(report.items.every(item => !item.suggestion || item.suggestion.startsWith('הצעה:')));
});
test('afternoon briefing excludes mail by default; overdue suggestion uses the real saved date', () => {
  const emails = [{ ...mail('Urgent: action required'), email_date: '2026-11-01T10:00:00Z' }];
  assert.equal(makeDailyBriefing([], [], emails, 'urgent', now).items.length, 0);
  const report = makeDailyBriefing([task('late', { planned_end: '2026-10-28' })], [], [], 'urgent', now);
  assert.ok(report.items[0].suggestion.includes('28.10.2026'));
  assert.ok(report.items[0].when.includes('28.10.2026'));
});
