import assert from 'node:assert/strict';
import test from 'node:test';
import { isProbeRevision, probePublicAmexLogin } from '../scripts/cloudrun-amex-probe.mjs';

function fixture({ status = 200, error, closeFails = false } = {}) {
  const calls = [];
  let closed = 0;
  const page = {
    goto: async (url, options) => { calls.push(['goto', url, options]); return { status: () => status, ok: () => status === 200 }; },
    waitForSelector: async (selector, options) => { calls.push(['selector', selector, options]); },
  };
  return {
    calls, closed: () => closed,
    tools: {
      launch: async options => { calls.push(['launch', options]); return { newPage: async () => page, close: async () => { closed++; if (closeFails) throw new Error('private fixture'); } }; },
      preparePage: async () => { calls.push(['prepare']); },
      assertPage: async () => { calls.push(['assert']); if (error) throw error; },
    },
  };
}

test('public probe visits only the official login and never uses credentials or login APIs', async () => {
  const value = fixture();
  const result = await probePublicAmexLogin('/fixture/chromium', value.tools);
  assert.deepEqual(result, { credentialFree: true, loginFormReady: true, httpStatus: 200, code: 'PUBLIC_LOGIN_FORM_READY' });
  assert.equal(value.calls.filter(([type]) => type === 'goto').length, 1);
  assert.equal(value.calls.find(([type]) => type === 'goto')[1], 'https://he.americanexpress.co.il/personalarea/Login');
  assert.equal(value.closed(), 1);
  assert.ok(value.calls.some(([type, selector]) => type === 'selector' && selector === 'input[type="password"]'));
});

test('HTTP blocks stop before password selectors, without retrying', async () => {
  for (const status of [403, 429]) {
    const value = fixture({ status });
    const result = await probePublicAmexLogin('/fixture/chromium', value.tools);
    assert.equal(result.code, 'WAF_BLOCKED');
    assert.equal(result.httpStatus, status);
    assert.equal(result.loginFormReady, false);
    assert.equal(value.calls.some(([type]) => type === 'selector'), false);
    assert.equal(value.closed(), 1);
  }
});

test('HTML blocks and untrusted redirects retain only safe codes', async () => {
  for (const code of ['WAF_BLOCKED', 'LOGIN_UNTRUSTED_REDIRECT']) {
    const value = fixture({ error: new Error(`${code}: private fixture`) });
    const result = await probePublicAmexLogin('/fixture/chromium', value.tools);
    assert.equal(result.code, code);
    assert.equal(JSON.stringify(result).includes('private fixture'), false);
    assert.equal(value.calls.some(([type]) => type === 'selector'), false);
  }
});

test('unexpected page errors are sanitized and browser cleanup is guaranteed', async () => {
  const value = fixture({ error: new Error('private fixture'), closeFails: true });
  assert.equal((await probePublicAmexLogin('/fixture/chromium', value.tools)).code, 'PUBLIC_LOGIN_FORM_NOT_READY');
  assert.equal(value.closed(), 1);
  const serverError = fixture({ status: 500 });
  assert.equal((await probePublicAmexLogin('/fixture/chromium', serverError.tools)).loginFormReady, false);
  assert.equal(serverError.calls.some(([type]) => type === 'selector'), false);
});

test('missing browser path fails before launching anything', async () => {
  const value = fixture();
  assert.equal((await probePublicAmexLogin(undefined, value.tools)).code, 'AMEX_BROWSER_UNSUPPORTED');
  assert.equal(value.closed(), 0);
  assert.equal(value.calls.length, 0);
});

test('browser environment does not inherit worker keys, proxy settings or Node hooks', async () => {
  const value = fixture();
  await probePublicAmexLogin('/fixture/chromium', value.tools);
  const environment = value.calls.find(([type]) => type === 'launch')[1].env;
  assert.deepEqual(Object.keys(environment).sort(), ['HOME', 'LANG', 'PATH', 'TMPDIR']);
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'FINANCE_CREDENTIALS_KEY', 'FINANCE_WORKER_SECRET', 'HTTP_PROXY', 'HTTPS_PROXY', 'NODE_OPTIONS']) {
    assert.equal(Object.hasOwn(environment, key), false);
  }
});

test('diagnostic entrypoint is restricted to its named Cloud Run probe revision', () => {
  assert.equal(isProbeRevision({}), false);
  assert.equal(isProbeRevision({ K_SERVICE: 'other', K_REVISION: 'tabro-finance-worker-secure-amex-probe-1019' }), false);
  assert.equal(isProbeRevision({ K_SERVICE: 'tabro-finance-worker-secure', K_REVISION: 'tabro-finance-worker-secure-00018-qd5' }), false);
  assert.equal(isProbeRevision({ K_SERVICE: 'tabro-finance-worker-secure', K_REVISION: 'tabro-finance-worker-secure-amex-probe-1019' }), true);
});
