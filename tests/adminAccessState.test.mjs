import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canLoadAdminData } from '../src/lib/adminAccessState.ts';
test('password typing while locked cannot authorize or trigger admin data loads', () => {
  for (const draft of ['', 'a', 'ab', 'abc']) assert.equal(canLoadAdminData(false, true, false), false, draft);
  assert.equal(canLoadAdminData(true, true, true), false);
  assert.equal(canLoadAdminData(false, false, true), false);
  assert.equal(canLoadAdminData(false, true, true), true);
});
test('admin effect checks the lock before fetching and submission has its own busy state', () => {
  const source = fs.readFileSync(new URL('../src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(!canLoadAdminData\(authLoading, Boolean\(user\), passUnlocked\)\).*?return;.*?\n\s*fetchStats\(\)/s);
  assert.match(source, /disabled=\{passSubmitting\}/);
  assert.match(source, /finally \{ setPassSubmitting\(false\); \}/);
  assert.ok(!source.includes('Admin password expired or changed.'));
});
