import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/lib/registerPushWorker.ts', import.meta.url), 'utf8');
const { ensurePushWorker, registerPushWorker } = await import(`data:text/javascript,${encodeURIComponent(source.replace(': Promise<ServiceWorkerRegistration>', ''))}`);

test('legacy root workers are replaced by the canonical push script without unregistering', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const calls = [];
  const registration = { active: { scriptURL: 'https://tabro.org/sw-push.js' } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: {
    async getRegistration() { throw new Error('Must not reuse an unknown worker'); },
    async register(...args) { calls.push(args); return registration; },
  } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true } });
  try {
    assert.equal(await ensurePushWorker(), registration);
    await registerPushWorker();
    assert.equal(calls.length, 2);
    for (const call of calls) assert.deepEqual(call, ['/sw-push.js', { scope: '/', updateViaCache: 'none' }]);
    assert.ok(!source.includes('requestPermission'));
    assert.ok(!source.includes('unregister'));
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
  }
});
