import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SAFE_CODES = new Set([
  'INVALID_PASSWORD', 'CHANGE_PASSWORD', 'ACCOUNT_BLOCKED', 'TIMEOUT',
  'TWO_FACTOR_RETRIEVER_MISSING', 'INVALID_OTP', 'WAF_BLOCKED',
  'LOGIN_UNTRUSTED_REDIRECT', 'LOGIN_NOT_COMPLETED', 'AMEX_NO_ACCOUNTS',
  'AMEX_REQUEST_FAILED', 'AMEX_INVALID_RESPONSE', 'AMEX_ENDPOINT_NOT_ALLOWED',
  'AMEX_BROWSER_UNSUPPORTED',
]);

export function amexCalendarDate(value) {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('AMEX_INVALID_RESPONSE');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function safeAmexFailure(error) {
  const message = String(error?.errorMessage ?? error?.message ?? '');
  const type = String(error?.errorType ?? '');
  const code = SAFE_CODES.has(type) ? type : [...SAFE_CODES].find(value => message.startsWith(`${value}:`) || message === value);
  return { success: false, errorType: code || 'AMEX_SYNC_FAILED', errorMessage: code || 'AMEX_SYNC_FAILED' };
}

export function loadAmexDependencies() {
  const isolatedRequire = createRequire(require.resolve('amex-scraper/package.json'));
  return {
    launch: options => isolatedRequire('puppeteer-core').launch(options),
    Scraper: isolatedRequire('./lib/scrapers/amex.js').default,
  };
}

export async function scrapeAmex(credentials, options, dependencies = loadAmexDependencies()) {
  let browser;
  try {
    if (!options.executablePath) throw new Error('AMEX_BROWSER_UNSUPPORTED');
    browser = await dependencies.launch({
      executablePath: options.executablePath,
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
    const scraper = new dependencies.Scraper({
      companyId: 'amex', startDate: options.startDate, futureMonthsToScrape: 1,
      combineInstallments: false, includeRawTransaction: false, verbose: false,
      showBrowser: false, timeout: 60_000, defaultTimeout: 60_000, browser, skipCloseBrowser: true,
    });
    const result = await scraper.scrape(credentials);
    if (!result?.success) return safeAmexFailure(result);
    if (!Array.isArray(result.accounts) || result.accounts.length === 0) {
      return safeAmexFailure({ errorType: 'AMEX_NO_ACCOUNTS' });
    }
    // The shared persistence contract consumes calendar dates, not UTC instants.
    // Israeli midnight otherwise becomes the previous charge day when sliced in UTC.
    return {
      ...result,
      accounts: result.accounts.map(account => ({
        ...account, balanceDate: amexCalendarDate(account.balanceDate),
        txns: (account.txns || []).map(transaction => ({
          ...transaction, date: amexCalendarDate(transaction.date),
          processedDate: amexCalendarDate(transaction.processedDate),
        })),
      })),
    };
  } catch (error) {
    return safeAmexFailure(error);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
