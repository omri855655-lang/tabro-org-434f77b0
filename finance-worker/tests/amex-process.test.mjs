import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { scrapeAmexIsolated } from '../src/amex-process.mjs';

test('Amex runs out of process without inherited service credentials or credential arguments', async () => {
  let captured;
  const credentials = { password: 'fixture-secret' };
  const result = await scrapeAmexIsolated(credentials, { executablePath: '/fixture' }, {
    forkProcess: (_module, args, config) => {
      captured = { args, config };
      const child = new EventEmitter();
      child.send = payload => {
        assert.equal(payload.credentials, credentials);
        setImmediate(() => {
          child.emit('message', { success: true, accounts: [{ accountNumber: '0000' }] });
          child.emit('exit', 0);
        });
      };
      return child;
    },
  });
  assert.equal(result.success, true);
  assert.deepEqual(captured.args, []);
  assert.deepEqual(captured.config.stdio, ['ignore', 'ignore', 'ignore', 'ipc']);
  assert.equal(captured.config.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(captured.config.env.FINANCE_CREDENTIALS_KEY, undefined);
  assert.equal(captured.config.env.DEBUG, undefined);
  assert.equal(JSON.stringify(captured).includes('fixture-secret'), false);
});

test('a crashed Amex child returns a sanitized failure without changing the parent timezone', async () => {
  const before = process.env.TZ;
  const result = await scrapeAmexIsolated({}, {}, {
    forkProcess: () => {
      const child = new EventEmitter();
      child.send = () => setImmediate(() => child.emit('exit', 1));
      return child;
    },
  });
  assert.equal(result.success, false);
  assert.equal(result.errorType, 'AMEX_SYNC_FAILED');
  assert.equal(process.env.TZ, before);
});

test('an Amex child deadline stops the child and does not retry', async () => {
  const killed = [];
  let sends = 0;
  const result = await scrapeAmexIsolated({}, {}, {
    timeoutMs: 10,
    forkProcess: () => {
      const child = new EventEmitter();
      child.send = () => { sends++; };
      child.kill = signal => { killed.push(signal); setImmediate(() => child.emit('exit', 1)); };
      return child;
    },
  });
  assert.equal(result.errorType, 'TIMEOUT');
  assert.deepEqual(killed, ['SIGTERM']);
  assert.equal(sends, 1);
});

test('the actual child starts and reports a missing browser without network or bank access', async () => {
  const result = await scrapeAmexIsolated({ password: 'fixture-secret' }, {
    executablePath: '/fixture/this-browser-does-not-exist',
  }, { timeoutMs: 10_000 });
  assert.equal(result.success, false);
  assert.equal(result.errorType, 'AMEX_SYNC_FAILED');
  assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
});
