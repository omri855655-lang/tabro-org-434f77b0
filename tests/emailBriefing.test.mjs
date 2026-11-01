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
