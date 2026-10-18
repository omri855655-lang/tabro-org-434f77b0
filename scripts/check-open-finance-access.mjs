import { pathToFileURL } from 'node:url';

const API_ORIGIN = 'https://api.open-finance.ai';
const REQUIRED_ENV = ['OPEN_FINANCE_CLIENT_ID', 'OPEN_FINANCE_CLIENT_SECRET', 'OPEN_FINANCE_USER_ID'];
const SAFE_CODES = new Set(['INVALID_RESPONSE', 'RESPONSE_TOO_LARGE']);

function result(status, details = {}) {
  return { status, financialDataRead: false, accountConnectionTested: false, ...details };
}

export function configurationStatus(env) {
  const missing = REQUIRED_ENV.filter(name => typeof env[name] !== 'string' || !env[name].trim());
  return { configured: missing.length === 0, missing };
}

async function parseJson(response, maximumBytes) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('INVALID_RESPONSE');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) throw new Error('RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('INVALID_RESPONSE'); }
}

function providersFrom(payload) {
  const providers = Array.isArray(payload) ? payload
    : payload?.items ?? payload?.providers ?? payload?.data?.items ?? payload?.data?.providers ?? payload?.data;
  if (!Array.isArray(providers) || providers.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('INVALID_RESPONSE');
  }
  return providers;
}

export function isExplicitAmexProvider(provider) {
  const id = String(provider.providerFriendlyId ?? '').toLowerCase().replace(/[ _-]/g, '');
  if (['amex', 'americanexpress'].includes(id)) return true;
  return [provider.name, provider.nameNativeLanguage].some(name => typeof name === 'string' && (
    /\bamex\b|\bamerican\s+express\b/i.test(name) || /אמריקן\s+אקספרס/.test(name)
  ));
}

function providerSummary(provider) {
  const fields = ['providerFriendlyId', 'name', 'nameNativeLanguage', 'mode', 'type'];
  return Object.fromEntries(fields.filter(key => typeof provider[key] === 'string')
    .map(key => [key, provider[key].slice(0, 160)]));
}

function httpFailure(status, stage) {
  const code = status === 401 ? 'AUTHENTICATION_REJECTED'
    : status === 403 ? 'ACCESS_DENIED_CHECK_PLAN_AND_PERMISSIONS'
      : status === 429 ? 'RATE_LIMITED' : 'PROVIDER_HTTP_ERROR';
  return result(code, { stage, httpStatus: status });
}

// Only authentication and reference-data discovery are permitted here.
// Never use this probe for payments, paid refresh, consent creation or account data.
export async function checkOpenFinanceAccess(env, fetchImpl = fetch) {
  const configuration = configurationStatus(env);
  if (!configuration.configured) return result('CONFIGURATION_REQUIRED', configuration);
  let stage = 'authentication';
  const request = (path, options = {}) => fetchImpl(`${API_ORIGIN}${path}`, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  try {
    const authentication = await request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: env.OPEN_FINANCE_CLIENT_ID,
        clientSecret: env.OPEN_FINANCE_CLIENT_SECRET,
        userId: env.OPEN_FINANCE_USER_ID,
      }),
    });
    if (!authentication.ok) {
      await authentication.body?.cancel().catch(() => undefined);
      return httpFailure(authentication.status, stage);
    }
    const authenticationBody = await parseJson(authentication, 16384);
    const token = authenticationBody?.accessToken;
    if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) throw new Error('INVALID_RESPONSE');

    stage = 'provider_catalog';
    const response = await request('/v2/providers?includeFakeProviders=false', {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return httpFailure(response.status, stage);
    }
    const providers = providersFrom(await parseJson(response, 262144));
    const matches = providers.filter(isExplicitAmexProvider).map(providerSummary);
    return result(matches.length ? 'AMEX_LISTED_NOT_CONNECTION_VERIFIED' : 'AMEX_NOT_EXPLICITLY_LISTED', {
      stage, catalogAccessible: true, providerCount: providers.length, matches,
      consentJourney: 'Confirm Financy UI or separately contracted B2B access before integration',
    });
  } catch (error) {
    return result(SAFE_CODES.has(error?.message) ? error.message : 'PROVIDER_UNREACHABLE', { stage });
  }
}

export async function main(args, env = process.env, fetchImpl = fetch, write = console.log) {
  if (args.length !== 1 || !['--check-config', '--live'].includes(args[0])) {
    write('Usage: node scripts/check-open-finance-access.mjs --check-config | --live');
    return 2;
  }
  const output = args[0] === '--check-config'
    ? result('CONFIGURATION_ONLY_NOT_TESTED', configurationStatus(env))
    : await checkOpenFinanceAccess(env, fetchImpl);
  write(JSON.stringify(output, null, 2));
  return output.status === 'AMEX_LISTED_NOT_CONNECTION_VERIFIED' || (args[0] === '--check-config' && output.configured) ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
