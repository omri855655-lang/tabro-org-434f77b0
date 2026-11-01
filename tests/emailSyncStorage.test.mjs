import test from 'node:test';
import assert from 'node:assert/strict';
import { gmailMessageDate, saveSyncedEmail } from '../supabase/functions/_shared/emailSyncStorage.ts';

test('Gmail internal receive time takes precedence over a misleading Date header', () => {
  assert.equal(gmailMessageDate(String(Date.parse('2026-11-01T12:00:00Z')), 'bad header'), '2026-11-01T12:00:00.000Z');
  assert.equal(gmailMessageDate(null, '2026-10-31T12:00:00Z'), '2026-10-31T12:00:00.000Z');
  assert.throws(() => gmailMessageDate(null, 'not a date'));
});
test('storage errors are not counted as successful syncs', async () => {
  const row = { user_id:'owner', connection_id:'connection', external_message_id:'gmail-message' };
  const calls = [];
  const store = { from(table) { return { async upsert(value, options) { calls.push({ table, value, options }); return { error:null }; } }; } };
  await saveSyncedEmail(store, row);
  assert.equal(calls[0].options.onConflict, 'connection_id,external_message_id');
  assert.equal(calls[0].value.user_id, 'owner');
  await assert.rejects(saveSyncedEmail({ from() { return { async upsert() { return { error:{ code:'PGRST204' } }; } }; } }, row), /PGRST204/);
  await assert.rejects(saveSyncedEmail(store, { ...row, external_message_id:null }), /identity/);
});
