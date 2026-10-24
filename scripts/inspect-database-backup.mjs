import { open, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

export function inspectRestoreList(list) {
  const dataTables = [...list.matchAll(/^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+/gm)].map(match => `${match[1]}.${match[2]}`);
  const required = ['auth.users', 'auth.identities', 'public.tasks', 'public.profiles', 'public.projects'];
  return { dataTables: [...new Set(dataTables)].sort(), missingRequired: required.filter(name => !dataTables.includes(name)) };
}

export async function inspectBackup(file, pgRestore = process.env.PG_RESTORE_BIN || 'pg_restore') {
  const info = await stat(file);
  if (!info.isFile() || info.size < 20) throw new Error('Expected a nonempty database archive');
  const handle = await open(file, 'r');
  const header = Buffer.alloc(5);
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  if (header.toString('ascii') !== 'PGDMP') throw new Error('Expected a PostgreSQL custom archive (PGDMP); do not execute an unknown file');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  // Listing does not connect to a database or execute the archive's SQL.
  const { stdout } = await promisify(execFile)(pgRestore, ['--list', file], { maxBuffer: 16 * 1024 * 1024, timeout: 60000 });
  const report = inspectRestoreList(stdout);
  return { sizeBytes: info.size, sha256: hash.digest('hex'), ...report, readyForRestoreReview: report.missingRequired.length === 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Provide the downloaded archive path');
    const report = await inspectBackup(process.argv[2]);
    console.log(JSON.stringify(report, null, 2));
    if (!report.readyForRestoreReview) process.exitCode = 1;
  } catch (error) {
    // Child-process diagnostics can contain archive comments; keep them out of shared output.
    console.error(error.code === 'ENOENT' ? 'PostgreSQL restore tool or archive is missing' : error.code ? 'Archive inspection failed; review the local archive/tool version' : error.message);
    process.exitCode = 1;
  }
}
