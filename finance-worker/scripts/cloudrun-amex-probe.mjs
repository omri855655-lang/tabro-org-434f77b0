import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const LOGIN_URL = 'https://he.americanexpress.co.il/personalarea/Login';
const SAFE_CODES = new Set(['WAF_BLOCKED', 'LOGIN_UNTRUSTED_REDIRECT', 'AMEX_BROWSER_UNSUPPORTED']);

function dependencies() {
  const require = createRequire(`${process.cwd()}/package.json`);
  const isolatedRequire = createRequire(require.resolve('amex-scraper/package.json'));
  const helpers = isolatedRequire('./lib/helpers/tabro-amex-browser.js');
  return {
    launch: options => isolatedRequire('puppeteer-core').launch(options),
    preparePage: helpers.prepareAmexPage,
    assertPage: helpers.assertAmexPage,
  };
}

export async function probePublicAmexLogin(executablePath, providedDependencies) {
  const outcome = { credentialFree: true, loginFormReady: false, httpStatus: null, code: 'PUBLIC_LOGIN_FORM_NOT_READY' };
  let browser;
  try {
    if (!executablePath) throw new Error('AMEX_BROWSER_UNSUPPORTED');
    const tools = providedDependencies || dependencies();
    browser = await tools.launch({
      executablePath, headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'],
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: process.env.HOME || '/home/node', LANG: 'C.UTF-8', TMPDIR: '/tmp' },
    });
    const page = await browser.newPage();
    await tools.preparePage(page);
    const response = await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    outcome.httpStatus = response?.status() ?? null;
    if ([403, 429].includes(outcome.httpStatus)) throw new Error('WAF_BLOCKED');
    await tools.assertPage(page);
    if (!response?.ok()) throw new Error('PUBLIC_LOGIN_FORM_NOT_READY');
    await page.waitForSelector('input[type="password"]', { timeout: 20000 });
    await tools.assertPage(page);
    outcome.loginFormReady = true;
    outcome.code = 'PUBLIC_LOGIN_FORM_READY';
  } catch (error) {
    const code = String(error?.message || '').split(':')[0];
    outcome.code = SAFE_CODES.has(code) ? code : 'PUBLIC_LOGIN_FORM_NOT_READY';
  } finally {
    await browser?.close().catch(() => undefined);
  }
  return outcome;
}

export function isProbeRevision(environment) {
  return environment.K_SERVICE === 'tabro-finance-worker-secure'
    && /^tabro-finance-worker-secure-amex-probe-[a-z0-9-]+$/.test(environment.K_REVISION || '');
}

// This diagnostic never imports the worker server, database client or credential code.
if (isProbeRevision(process.env)) {
  const result = await probePublicAmexLogin(process.env.FINANCE_BROWSER_EXECUTABLE);
  const report = { event: 'amex_public_login_probe', diagnosticOnly: true, runtime: 'cloud-run', checkedAt: new Date().toISOString(), ...result };
  console.log(JSON.stringify(report));
  createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404);
      response.end(JSON.stringify({ diagnosticOnly: true, error: 'Not found' }));
      return;
    }
    response.end(JSON.stringify(report));
  }).listen(Number(process.env.PORT || 8080), '0.0.0.0');
}
