import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueEmailMessages } from '../src/lib/emailMessageIdentity.ts';
const row = { connection_id:'gmail', email_subject:'Same subject', email_from:'sender@example.com', email_date:'2026-11-01T12:00:00Z' };
test('distinct provider IDs are not collapsed just because metadata matches', () => {
  const rows = uniqueEmailMessages([{...row,external_message_id:'one'},{...row,external_message_id:'two'},{...row,external_message_id:'one'}]);
  assert.equal(rows.length, 2);
});
test('identified messages replace matching legacy display copies without deleting database data', () => {
  const old = {...row, id:'legacy'}, fresh = {...row,id:'fresh',external_message_id:'one'};
  assert.deepEqual(uniqueEmailMessages([old,old,fresh]), [fresh]);
  assert.equal(uniqueEmailMessages([old,old]).length, 1);
  assert.equal(uniqueEmailMessages([fresh,{...fresh,connection_id:'other'}]).length, 2);
});
