import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOpenFinanceAccess, configurationStatus, isExplicitAmexProvider, main } from '../scripts/check-open-finance-access.mjs';

const env = {
  OPEN_FINANCE_CLIENT_ID: 'fixture-client',
  OPEN_FINANCE_CLIENT_SECRET: 'fixture-client-secret',
  OPEN_FINANCE_USER_ID: 'fixture-provider-user',
};
const token = 'fixture-private-access-token';
const json = value => new Response(JSON.stringify(value), { status: 200 });

function harness(catalog) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? json({ accessToken: token }) : json(catalog);
    },
  };
}

test('missing credentials or provider-issued user ID never initiate network access', async () => {
  const configuration = configurationStatus({ ...env, OPEN_FINANCE_USER_ID: ' ' });
  assert.deepEqual(configuration.missing, ['OPEN_FINANCE_USER_ID']);
  const output = await checkOpenFinanceAccess({}, () => assert.fail('Unexpected request'));
  assert.equal(output.status, 'CONFIGURATION_REQUIRED');
  assert.equal(JSON.stringify(output).includes(env.OPEN_FINANCE_CLIENT_SECRET), false);
});

test('configuration checks never contact the API even when credentials exist', async () => {
  const output = [];
  assert.equal(await main(['--check-config'], env, () => assert.fail('Unexpected request'), value => output.push(value)), 0);
  assert.equal(JSON.parse(output[0]).status, 'CONFIGURATION_ONLY_NOT_TESTED');
  assert.equal(output[0].includes(env.OPEN_FINANCE_CLIENT_SECRET), false);
});

test('the probe authenticates once, reads only the provider catalog, and never claims account connectivity', async () => {
  const api = harness([{ providerFriendlyId: 'amex', name: 'American Express', type: 'CARD', secret: 'fixture-hidden' }]);
  const output = await checkOpenFinanceAccess(env, api.fetch);
  assert.equal(output.status, 'AMEX_LISTED_NOT_CONNECTION_VERIFIED');
  assert.equal(output.accountConnectionTested, false);
  assert.equal(output.financialDataRead, false);
  assert.deepEqual(api.calls.map(call => [call.url, call.options.method]), [
    ['https://api.open-finance.ai/oauth/token', 'POST'],
    ['https://api.open-finance.ai/v2/providers?includeFakeProviders=false', 'GET'],
  ]);
  assert.deepEqual(JSON.parse(api.calls[0].options.body), {
    clientId: env.OPEN_FINANCE_CLIENT_ID, clientSecret: env.OPEN_FINANCE_CLIENT_SECRET, userId: env.OPEN_FINANCE_USER_ID,
  });
  assert.equal(api.calls[1].options.headers.Authorization, `Bearer ${token}`);
  assert.ok(api.calls.every(call => call.options.redirect === 'error' && call.options.signal instanceof AbortSignal));
  const serialized = JSON.stringify(output);
  for (const secret of [token, env.OPEN_FINANCE_CLIENT_SECRET, env.OPEN_FINANCE_USER_ID, 'fixture-hidden']) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('Isracard alone and unrelated names are not evidence of Amex support', async () => {
  for (const provider of [
    { providerFriendlyId: 'isracard', name: 'Isracard', nameNativeLanguage: 'ישראכרט' },
    { name: 'American Expressway' },
    { providerFriendlyId: 'notamex', image: 'https://example.test/amex.png' },
  ]) assert.equal(isExplicitAmexProvider(provider), false);
  assert.equal(isExplicitAmexProvider({ nameNativeLanguage: 'אמריקן אקספרס' }), true);
  const api = harness([{ providerFriendlyId: 'isracard' }]);
  assert.equal((await checkOpenFinanceAccess(env, api.fetch)).status, 'AMEX_NOT_EXPLICITLY_LISTED');
});

test('documented arrays and recognized envelopes are accepted, malformed catalogs are not treated as empty support lists', async () => {
  for (const catalog of [[{ providerFriendlyId: 'amex' }], { items: [{ providerFriendlyId: 'amex' }] }]) {
    const api = harness(catalog);
    assert.equal((await checkOpenFinanceAccess(env, api.fetch)).status, 'AMEX_LISTED_NOT_CONNECTION_VERIFIED');
  }
  for (const catalog of [{ message: 'fixture-secret' }, { providers: [null] }, { items: [[]] }]) {
    const api = harness(catalog);
    assert.equal((await checkOpenFinanceAccess(env, api.fetch)).status, 'INVALID_RESPONSE');
  }
});

test('HTTP and transport failures never echo response bodies, tokens, credentials or retry login', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const output = await checkOpenFinanceAccess(env, async () => {
      calls++;
      return new Response(`${token} ${env.OPEN_FINANCE_CLIENT_SECRET}`, { status });
    });
    assert.equal(calls, 1);
    assert.equal(output.httpStatus, status);
    assert.equal(JSON.stringify(output).includes(token), false);
  }
  const output = await checkOpenFinanceAccess(env, async () => { throw new Error(env.OPEN_FINANCE_CLIENT_SECRET); });
  assert.equal(output.status, 'PROVIDER_UNREACHABLE');
  assert.equal(JSON.stringify(output).includes(env.OPEN_FINANCE_CLIENT_SECRET), false);
});

test('paid-plan or catalog access rejection is distinct from authentication rejection', async () => {
  let calls = 0;
  const output = await checkOpenFinanceAccess(env, async () => {
    calls++;
    return calls === 1 ? json({ accessToken: token }) : new Response('NOT_AVAILABLE_ON_PLAN fixture-secret', { status: 403 });
  });
  assert.equal(output.stage, 'provider_catalog');
  assert.equal(output.status, 'ACCESS_DENIED_CHECK_PLAN_AND_PERMISSIONS');
  assert.equal(calls, 2);
});

test('invalid and oversized responses are bounded and sanitized', async () => {
  for (const body of ['<html>fixture-secret</html>', JSON.stringify({ accessToken: 'x'.repeat(17000) })]) {
    const output = await checkOpenFinanceAccess(env, async () => new Response(body));
    assert.ok(['INVALID_RESPONSE', 'RESPONSE_TOO_LARGE'].includes(output.status));
    assert.equal(JSON.stringify(output).includes('fixture-secret'), false);
  }
  const api = harness([{ providerFriendlyId: 'amex', name: 'x'.repeat(263000) }]);
  assert.equal((await checkOpenFinanceAccess(env, api.fetch)).status, 'RESPONSE_TOO_LARGE');
});

test('invalid CLI arguments do not trigger a live probe', async () => {
  assert.equal(await main([], env, () => assert.fail('Unexpected request'), () => {}), 2);
});

test('missing, malformed and line-breaking tokens never reach the catalog endpoint', async () => {
  for (const authentication of [{}, { accessToken: 123 }, { accessToken: 'fixture\r\nsecret' }]) {
    let calls = 0;
    const output = await checkOpenFinanceAccess(env, async () => { calls++; return json(authentication); });
    assert.equal(output.status, 'INVALID_RESPONSE');
    assert.equal(calls, 1);
  }
});

test('redirect responses do not redirect credentials or tokens to another host', async () => {
  let calls = 0;
  const output = await checkOpenFinanceAccess(env, async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'error');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example.test/' } });
  });
  assert.equal(output.status, 'PROVIDER_HTTP_ERROR');
  assert.equal(calls, 1);
});
