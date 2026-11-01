import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  importantMailDecision, importantMailChannelPlan, normalizeImportantMailAlerts, normalizeMailPreferences, importantMailPushPayload,
} from '../supabase/functions/_shared/importantMailAlerts.ts';
import { classifyPushResponse, pushServiceName, vapidDiagnostics, summarizePushResults } from '../supabase/functions/_shared/pushDiagnostics.ts';
import { syncGmailConnection } from '../supabase/functions/_shared/gmailSync.ts';
import { APP_VAPID_PUBLIC_KEY } from '../supabase/functions/push-delivery-test/appKey.ts';
import { buildImportantMailEmail } from '../supabase/functions/important-mail-alerts/emailContent.ts';

const NOW = Date.parse('2026-11-01T12:00:00Z');
const on = normalizeImportantMailAlerts({ enabled: true, since: '2026-11-01T08:00:00Z' });
const noPrefs = normalizeMailPreferences({});
const mail = (subject, extra = {}) => ({ email_subject: subject, email_from: 'Dana <dana@client.co.il>', email_date: '2026-11-01T11:50:00Z', category: 'personal', ...extra });

test('alerts are opt-in: missing, false or since-less settings stay off', () => {
  assert.equal(normalizeImportantMailAlerts(undefined).enabled, false);
  assert.equal(normalizeImportantMailAlerts({ enabled: 'true', since: '2026-11-01T08:00:00Z' }).enabled, false);
  assert.equal(normalizeImportantMailAlerts({ enabled: true }).enabled, false);
  assert.equal(on.enabled, true);
  assert.equal(on.push, true);
  assert.equal(on.email, false);
  assert.equal(importantMailDecision(mail('Action required: sign contract'), noPrefs, normalizeImportantMailAlerts({}), NOW).reason, 'disabled');
});

test('subject action/security signals alert; mail before opt-in or older than 12h never does', () => {
  assert.deepEqual(importantMailDecision(mail('נדרשת פעולה: חתימה על החוזה'), noPrefs, on, NOW), { alert: true, reason: 'action' });
  assert.deepEqual(importantMailDecision(mail('Security alert: suspicious sign-in'), noPrefs, on, NOW), { alert: true, reason: 'security' });
  assert.equal(importantMailDecision(mail('Action required', { email_date: '2026-11-01T07:59:00Z' }), noPrefs, on, NOW).reason, 'before_opt_in');
  const longAgo = normalizeImportantMailAlerts({ enabled: true, since: '2026-10-01T00:00:00Z' });
  assert.equal(importantMailDecision(mail('Action required', { email_date: '2026-10-31T23:00:00Z' }), noPrefs, longAgo, NOW).reason, 'too_old');
  assert.equal(importantMailDecision(mail('Action required', { email_date: '2026-11-02T12:00:00Z' }), noPrefs, on, NOW).reason, 'future_date');
});

test('verification codes (fresh or old) and marketing labelled as tasks do not alert', () => {
  assert.equal(importantMailDecision(mail('Your verification code is 123456'), noPrefs, on, NOW).reason, 'verification_code');
  assert.equal(importantMailDecision(mail('קוד אימות לכניסה'), noPrefs, on, NOW).reason, 'verification_code');
  assert.equal(importantMailDecision(mail('Weekly reminder: top styles', { category: 'task' }), noPrefs, on, NOW).alert, false);
  assert.equal(importantMailDecision(mail('Urgent: 50% off today only', { category: 'task' }), noPrefs, on, NOW).alert, false);
  assert.equal(importantMailDecision(mail('Action required: last chance', { category: 'newsletter' }), noPrefs, on, NOW).reason, 'promotion');
  assert.equal(importantMailDecision(mail('Your order shipped'), noPrefs, on, NOW).alert, false);
});

test("Tabro's own briefings and bare 'today' digests never alert", () => {
  assert.equal(importantMailDecision(mail('מה נשאר להיום · 90 משימות', { email_from: 'Tabro <noreply@tabro.org>' }), noPrefs, on, NOW).reason, 'self_notification');
  assert.equal(importantMailDecision(mail('Reminder', { email_from: 'x@notify.tabro.org' }), noPrefs, on, NOW).reason, 'self_notification');
  assert.equal(importantMailDecision(mail('Your summary for today'), noPrefs, on, NOW).alert, false);
  assert.equal(importantMailDecision(mail('מה קורה היום בעיר'), noPrefs, on, NOW).alert, false);
  assert.equal(importantMailDecision(mail('דחוף: נא להשיב היום'), noPrefs, on, NOW).alert, true);
});

test('saved VIP, keywords, sender buckets and low-priority senders are respected', () => {
  const prefs = normalizeMailPreferences({
    vipSenders: ['client.co.il'], importantKeywords: ['ארנונה'], ignoredKeywords: ['webinar'],
    lowPrioritySenders: ['spammy.com'], senderBuckets: { 'bank.co.il': 'action', 'news.com': 'promotions', 'bad.com': 'not-a-bucket' },
  });
  assert.deepEqual(importantMailDecision(mail('hello'), prefs, on, NOW), { alert: true, reason: 'vip' });
  assert.deepEqual(importantMailDecision(mail('תשלום ארנונה', { email_from: 'city@muni.gov.il' }), prefs, on, NOW), { alert: true, reason: 'keyword' });
  assert.deepEqual(importantMailDecision(mail('statement', { email_from: 'x@bank.co.il' }), prefs, on, NOW), { alert: true, reason: 'preference' });
  assert.equal(importantMailDecision(mail('Action required now', { email_from: 'a@news.com' }), prefs, on, NOW).reason, 'learned_quiet');
  assert.equal(importantMailDecision(mail('Action required now', { email_from: 'a@spammy.com' }), prefs, on, NOW).reason, 'low_priority_sender');
  assert.equal(importantMailDecision(mail('Join our webinar - action required'), prefs, on, NOW).reason, 'ignored_keyword');
  assert.equal(prefs.senderBuckets['bad.com'], undefined);
});

test('channel plan honours quiet hours, daily limits and channel toggles', () => {
  const base = { importantMailAlerts: { enabled: true, push: true, email: true, since: '2026-11-01T08:00:00Z' }, quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '05:00', dailyLimit: 0 };
  assert.deepEqual(importantMailChannelPlan(base, 12 * 60, 0), { push: true, email: true, deferred: null });
  assert.equal(importantMailChannelPlan(base, 23 * 60 + 30, 0).deferred, 'quiet_hours');
  assert.equal(importantMailChannelPlan(base, 4 * 60, 0).deferred, 'quiet_hours');
  assert.equal(importantMailChannelPlan({ ...base, dailyLimit: 2 }, 12 * 60, 2).deferred, 'daily_limit');
  assert.equal(importantMailChannelPlan(base, 12 * 60, 12).deferred, 'daily_limit');
  assert.deepEqual(importantMailChannelPlan({ ...base, push: { enabled: false } }, 12 * 60, 0), { push: false, email: true, deferred: null });
  assert.deepEqual(importantMailChannelPlan({ ...base, email: { enabled: false } }, 12 * 60, 0), { push: true, email: false, deferred: null });
  assert.deepEqual(importantMailChannelPlan({}, 12 * 60, 0), { push: false, email: false, deferred: null });
});

test('lock-screen text is generic and never includes sender or subject', () => {
  const payload = importantMailPushPayload(3);
  assert.match(payload.body, /3/);
  assert.doesNotMatch(JSON.stringify(payload), /dana|client|contract/i);
});

test('push responses are classified without leaking provider bodies', () => {
  assert.equal(classifyPushResponse(201).outcome, 'accepted');
  assert.deepEqual(classifyPushResponse(410, '{"reason":"Unregistered"}'), { outcome: 'expired', status: 410, reason: 'Unregistered' });
  assert.deepEqual(classifyPushResponse(403, '{"reason":"BadJwtToken"}'), { outcome: 'rejected', status: 403, reason: 'BadJwtToken' });
  assert.deepEqual(classifyPushResponse(400, 'VapidPkHashMismatch'), { outcome: 'rejected', status: 400, reason: 'VapidPkHashMismatch' });
  assert.equal(classifyPushResponse(400, '<html>secret https://x</html>').reason, 'unknown');
  assert.equal(classifyPushResponse(503).outcome, 'retryable');
  assert.equal(classifyPushResponse(0).reason, 'network_error');
  assert.equal(pushServiceName('https://web.push.apple.com/abc'), 'apple');
  assert.equal(pushServiceName('https://fcm.googleapis.com/fcm/send/x'), 'google');
  assert.equal(pushServiceName('not a url'), 'other');
  assert.deepEqual(summarizePushResults([{ outcome: 'accepted' }, { outcome: 'expired' }, { outcome: 'rejected' }]), { devicesFound: 3, providerAccepted: 1, expired: 1, rejected: 1, retryable: 0 });
});

const b64url = (buf) => Buffer.from(buf).toString('base64url');
async function keyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { pub: b64url(raw), priv: jwk.d };
}

test('VAPID diagnostics detect a mismatched pair, bad formats and app-key drift', async () => {
  const a = await keyPair();
  const b = await keyPair();
  const good = await vapidDiagnostics(a.pub, a.priv, a.pub);
  assert.deepEqual(good, { configured: true, publicKeyFormatValid: true, privateKeyFormatValid: true, pairValid: true, matchesAppKey: true });
  const mismatch = await vapidDiagnostics(a.pub, b.priv, b.pub);
  assert.equal(mismatch.pairValid, false);
  assert.equal(mismatch.matchesAppKey, false);
  const missing = await vapidDiagnostics(undefined, undefined, a.pub);
  assert.equal(missing.configured, false);
  assert.equal((await vapidDiagnostics('short', 'bad!', a.pub)).publicKeyFormatValid, false);
});

test('edge copy of the app VAPID public key matches the web app', () => {
  const hook = readFileSync(new URL('../src/hooks/usePushNotifications.ts', import.meta.url), 'utf8');
  assert.equal(hook.match(/VAPID_PUBLIC_KEY = "([^"]+)"/)[1], APP_VAPID_PUBLIC_KEY);
});

// ---- Gmail read-only sync ----
function fakeStore({ existing = [], failUpsert = new Set(), failTokenStore = false } = {}) {
  const writes = [];
  const tokenUpdates = [];
  return {
    writes, tokenUpdates,
    from(table) {
      if (table === 'email_connections') {
        return { update(v) { tokenUpdates.push(v); const r = { error: failTokenStore ? { code: 'x' } : null }; return { eq() { return { eq: async () => r }; } }; } };
      }
      return {
        select() { return { eq() { return { in: async (_c, ids) => ({ data: ids.filter((id) => existing.includes(id)).map((id) => ({ external_message_id: id })), error: null }) }; } }; },
        async upsert(row, opts) { writes.push({ row, opts }); return { error: failUpsert.has(row.external_message_id) ? { code: '23505' } : null }; },
      };
    },
  };
}
const conn = { id: 'c1', user_id: 'u1', access_token: 'old', refresh_token: 'r', settings: { token_expiry: NOW + 100000 } };
const env = (fetchImpl) => ({ clientId: 'id', clientSecret: 'secret', fetch: fetchImpl, now: () => NOW });
const meta = (id, subject = 'Hello', labels = []) => ({ id, labelIds: labels, internalDate: String(NOW - 60000), payload: { headers: [{ name: 'Subject', value: subject }, { name: 'From', value: 'a@b.com' }] } });
const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

test('Gmail sync refreshes once on 401, stores the new token and retries', async () => {
  const calls = [];
  let first = true;
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('oauth2')) return ok({ access_token: 'fresh' });
    if (first) { first = false; return new Response('', { status: 401 }); }
    assert.equal(init.headers.Authorization, 'Bearer fresh');
    if (String(url).includes('/messages?')) return ok({ messages: [{ id: 'msg000001' }] });
    return ok(meta('msg000001'));
  };
  const store = fakeStore();
  const result = await syncGmailConnection(store, conn, { query: 'newer_than:1d', maxResults: 25, onlyNew: true }, env(fetchImpl));
  assert.equal(result.ok, true);
  assert.equal(result.processed, 1);
  assert.equal(store.tokenUpdates[0].access_token, 'fresh');
  assert.equal(calls.filter((u) => u.includes('oauth2')).length, 1);
  assert.equal(store.writes[0].opts.onConflict, 'connection_id,external_message_id');
});

test('Gmail sync reports reconnect after a second 401 or a revoked grant', async () => {
  const always401 = async (url) => String(url).includes('oauth2') ? ok({ access_token: 'fresh' }) : new Response('', { status: 401 });
  assert.equal((await syncGmailConnection(fakeStore(), conn, { query: 'q', maxResults: 5, onlyNew: false }, env(always401))).error, 'reconnect');
  const revoked = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  const expired = { ...conn, access_token: null };
  const r = await syncGmailConnection(fakeStore(), expired, { query: 'q', maxResults: 5, onlyNew: false }, env(revoked));
  assert.equal(r.error, 'reconnect');
  assert.equal(r.ok, false);
});

test('Gmail sync never counts failed writes or malformed messages as success, and skips stored ids', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('/messages?')) return ok({ messages: [{ id: 'stored0001' }, { id: 'bad0000001' }, { id: 'fail000001' }, { id: 'good000001' }, { id: '../evil' }] });
    if (String(url).includes('bad0000001')) return ok({ id: 'bad0000001', payload: 'oops' });
    return ok(meta(String(url).match(/messages\/(\w+)/)[1]));
  };
  const store = fakeStore({ existing: ['stored0001'], failUpsert: new Set(['fail000001']) });
  const r = await syncGmailConnection(store, conn, { query: 'q', maxResults: 25, onlyNew: true }, env(fetchImpl));
  assert.equal(r.ok, false);
  assert.equal(r.skippedExisting, 1);
  assert.equal(r.failed, 2);
  assert.equal(r.processed, 1);
  assert.deepEqual(r.newMessageIds, ['good000001']);
  const malformedList = async () => ok({ messages: 'nope' });
  assert.equal((await syncGmailConnection(fakeStore(), conn, { query: 'q', maxResults: 5, onlyNew: false }, env(malformedList))).error, 'malformed_list');
  const empty = await syncGmailConnection(fakeStore(), conn, { query: 'q', maxResults: 5, onlyNew: false }, env(async () => ok({ resultSizeEstimate: 0 })));
  assert.equal(empty.ok, true);
});

test('alert email escapes metadata and links to tabro.org settings', () => {
  const content = buildImportantMailEmail([{ email_subject: '<script>x</script>', email_from: 'Eve <e@x.com>' }]);
  assert.doesNotMatch(content.html, /<script>/);
  assert.match(content.html, /https:\/\/tabro\.org\/personal/);
  assert.match(content.html, /אינו מאמת/);
});
