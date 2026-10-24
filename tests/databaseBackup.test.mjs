import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRestoreList, inspectBackup } from '../scripts/inspect-database-backup.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('backup review requires auth user and identity data, not only public application tables', () => {
  const toc = names => names.map((name, i) => `${i + 1}; 0 123 TABLE DATA ${name.replace('.', ' ')} postgres`).join('\n');
  const partial = inspectRestoreList(toc(['public.tasks','public.profiles','public.projects']));
  assert.deepEqual(partial.missingRequired, ['auth.users','auth.identities']);
  const full = inspectRestoreList('; comments are ignored\n' + toc(['auth.users','auth.identities',...partial.dataTables]));
  assert.deepEqual(full.missingRequired, []);
  assert.ok(!inspectRestoreList('1; 0 123 TABLE auth users postgres').dataTables.length);
});
test('unknown backup files are rejected before invoking restore tools', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'tabro-backup-test-'));
  try {
    const file = join(folder, 'wrong.backup'); await writeFile(file, 'not a PostgreSQL archive at all');
    await assert.rejects(inspectBackup(file, 'not-a-real-command'), /PGDMP/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
