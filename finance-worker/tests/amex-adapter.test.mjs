import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { amexCalendarDate, loadAmexDependencies, safeAmexFailure, scrapeAmex } from '../src/amex-adapter.mjs';

const require = createRequire(import.meta.url);
const amexRequire = createRequire(require.resolve('amex-scraper/package.json'));
const browserHelpers = amexRequire('./lib/helpers/tabro-amex-browser.js');
const { fetchPostWithinPage } = amexRequire('./lib/helpers/tabro-amex-fetch.js');
const mapping = amexRequire('./lib/scrapers/base-isracard/base-isracard-utils.js');

test('the Amex alias and old shared scraper remain independent pinned packages', async () => {
  const metadata = amexRequire('./package.json');
  assert.equal(metadata.name, 'israeli-bank-scrapers-core');
  assert.equal(metadata.version, '6.12.2');
  const legacy = JSON.parse(await readFile(new URL('../node_modules/@sergienko4/israeli-bank-scrapers/package.json', import.meta.url)));
  assert.equal(legacy.version, '8.7.4');
  assert.equal(typeof loadAmexDependencies().Scraper, 'function');
});

test('Amex closes the browser on success, rejected credentials and exceptions', async () => {
  for (const mode of ['success', 'rejected', 'exception']) {
    let closed = 0;
    let captured;
    const result = await scrapeAmex({ password: 'fixture-secret' }, { executablePath: '/fixture/chromium' }, {
      launch: async () => ({ close: async () => { closed++; } }),
      Scraper: class {
        constructor(options) { captured = options; }
        async scrape() {
          if (mode === 'exception') throw new Error('private response fixture-secret');
          if (mode === 'rejected') return { success: false, errorType: 'INVALID_PASSWORD', errorMessage: 'fixture-secret' };
          return { success: true, accounts: [{ accountNumber: '0000', txns: [] }] };
        }
      },
    });
    assert.equal(closed, 1);
    assert.equal(captured.companyId, 'amex');
    assert.equal(captured.combineInstallments, false);
    assert.equal(captured.futureMonthsToScrape, 1);
    assert.equal(captured.includeRawTransaction, false);
    assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
    assert.equal(result.success, mode === 'success');
  }
});

test('an empty account list is never reported as successful synchronization', async () => {
  const result = await scrapeAmex({}, { executablePath: '/fixture/chromium' }, {
    launch: async () => ({ close: async () => {} }),
    Scraper: class { async scrape() { return { success: true, accounts: [] }; } },
  });
  assert.equal(result.success, false);
  assert.equal(result.errorType, 'AMEX_NO_ACCOUNTS');
});

test('Amex errors retain safe actionable codes, not bank responses or secrets', () => {
  for (const code of ['WAF_BLOCKED', 'LOGIN_UNTRUSTED_REDIRECT', 'LOGIN_NOT_COMPLETED']) {
    assert.equal(safeAmexFailure(new Error(`${code}: fixture-secret`)).errorType, code);
  }
  assert.equal(safeAmexFailure(new Error('fixture-secret')).errorMessage, 'AMEX_SYNC_FAILED');
});

test('Israeli midnight and daylight-saving dates keep the bank calendar charge day', () => {
  assert.equal(amexCalendarDate('2026-11-09T22:00:00.000Z'), '2026-11-10');
  assert.equal(amexCalendarDate('2026-10-01T21:00:00.000Z'), '2026-10-02');
  assert.equal(amexCalendarDate('2026-11-10'), '2026-11-10');
  assert.throws(() => amexCalendarDate('invalid'), /AMEX_INVALID_RESPONSE/);
});

test('browser metadata follows the actual OS and Chromium, with no CAPTCHA or security-script suppression', async () => {
  const calls = [];
  await browserHelpers.prepareAmexPage({
    browser: () => ({ version: async () => 'Chrome/149.0.0.0', userAgent: async () => 'Linux HeadlessChrome/149.0.0.0' }),
    setUserAgent: async value => calls.push(value),
    setExtraHTTPHeaders: async value => calls.push(value),
  });
  assert.equal(calls[0], 'Linux Chrome/149.0.0.0');
  assert.match(calls[1]['sec-ch-ua'], /149/);
  assert.equal(calls[1]['sec-ch-ua-platform'], '"Linux"');
  const source = await readFile(new URL('../vendor/amex/base-isracard.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /request\.abort|detector-dom|evaluateOnNewDocument/);
});

test('off-origin pages and unapproved endpoints are stopped before credentials enter a request', async () => {
  let evaluated = 0;
  const page = { url: () => 'https://unexpected.example/login', evaluate: async () => { evaluated++; } };
  const endpoint = 'https://he.americanexpress.co.il/services/ProxyRequestHandler.ashx?reqName=performLogonI';
  await assert.rejects(fetchPostWithinPage(page, endpoint, { password: 'fixture' }), /LOGIN_UNTRUSTED_REDIRECT/);
  await assert.rejects(fetchPostWithinPage(page, 'https://unexpected.example', {}), /AMEX_ENDPOINT_NOT_ALLOWED/);
  assert.equal(evaluated, 0);
});

test('blocked and malformed API responses are sanitized, without raw JSON or HTML in failures', async () => {
  for (const [status, text, expected] of [
    [403, 'fixture-secret', 'WAF_BLOCKED'],
    [429, 'fixture-secret', 'WAF_BLOCKED'],
    [200, 'Sorry, you have been blocked fixture-secret', 'WAF_BLOCKED'],
    [200, '<html>fixture-secret</html>', 'AMEX_INVALID_RESPONSE'],
  ]) {
    const page = {
      url: () => 'https://he.americanexpress.co.il/personalarea/Login',
      evaluate: async (_callback, argument) => argument ? { status, text } : 'Login form',
    };
    await assert.rejects(fetchPostWithinPage(page,
      'https://he.americanexpress.co.il/services/ProxyRequestHandler.ashx?reqName=performLogonI', {}),
    error => error.message === expected || error.message.startsWith(`${expected}:`));
  }
});

test('DigitalV3 mapping keeps ILS charged amount separate from foreign currency and retains installments and billing date', () => {
  const fixture = {
    purchaseDate: '01/10/2026', purchaseTime: null, businessName: ' Fixture ',
    originalAmount: 10, originalCurrencyIso: 'USD', billingAmount: 38.4,
    seqVoucherNumber: 'fixture-1', currentInstallmentNum: 2, numberOfInstallment: 3,
  };
  const value = mapping.convertVoucher(fixture, '2026-11-10T00:00:00.000Z');
  assert.equal(value.originalAmount, -10);
  assert.equal(value.originalCurrency, 'USD');
  assert.equal(value.chargedAmount, -38.4);
  assert.equal(value.chargedCurrency, 'ILS');
  assert.equal(value.processedDate, '2026-11-10T00:00:00.000Z');
  assert.deepEqual(value.installments, { number: 2, total: 3 });
  assert.equal(value.rawTransaction, undefined);
});

test('the actual isolated scraper completes mocked login, card discovery and DigitalV3 transaction fetch', async () => {
  const waiting = amexRequire('./lib/helpers/waiting.js');
  const previousDelay = waiting.randomDelay;
  waiting.randomDelay = async () => {};
  try {
    const calls = [];
    let url = 'about:blank';
    const page = {
      browser: () => ({ version: async () => 'Chrome/149.0.0.0', userAgent: async () => 'Linux HeadlessChrome/149.0.0.0' }),
      setUserAgent: async () => {}, setExtraHTTPHeaders: async () => {},
      setCacheEnabled: async () => {}, setDefaultTimeout: () => {}, setViewport: async () => {},
      on: () => {}, close: async () => {}, url: () => url,
      goto: async target => { url = target; return { status: () => 200, ok: () => true }; },
      evaluate: async (_callback, argument) => {
        if (!argument) return 'Account';
        calls.push(argument.target);
        let value;
        if (argument.target.includes('ValidateIdData')) {
          value = { Header: { Status: '1' }, ValidateIdDataBean: { returnCode: '1', userName: 'fixture' } };
        } else if (argument.target.includes('performLogonI')) value = { status: '1' };
        else if (argument.target.endsWith('GetCardList')) value = { isSuccess: true, data: { cardsList: [
          { companyCode: '77', cardSuffix: '0000', cardStatus: '1', serviceType: '1', isActive: true, isBlock: false, isPartner: false },
          { companyCode: '11', cardSuffix: '9999', isActive: true, isBlock: false },
        ] } };
        else if (argument.target.endsWith('GetMonthlyBilling')) {
          value = { isSuccess: true, data: { cards: { '0000': { billingDate: '10/11/2026' } } } };
        } else if (argument.target.endsWith('GetTransactionsList')) value = { isSuccess: true, data: {
          approvals: { approvedTransactions: [] },
          israelAbroadVouchers: { vouchers: { israelAbroadVouchersList: [{
            purchaseDate: '01/10/2026', businessName: 'Fixture merchant', originalAmount: 10,
            originalCurrencyIso: 'USD', billingAmount: 38.4, seqVoucherNumber: 'fixture-voucher',
          }] }, outOfStatementChargeDateVouchers: [] },
        } };
        else throw new Error('unexpected endpoint');
        return { status: 200, text: JSON.stringify(value) };
      },
    };
    const { Scraper } = loadAmexDependencies();
    const scraper = new Scraper({
      companyId: 'amex', browser: { newPage: async () => page }, skipCloseBrowser: true,
      startDate: new Date(), futureMonthsToScrape: 0, combineInstallments: false,
      outputData: { enableTransactionsFilterByDate: false },
    });
    const result = await scraper.scrape({ id: 'fixture', card6Digits: 'fixture', password: 'fixture' });
    assert.equal(result.success, true, result.errorMessage);
    assert.equal(result.accounts.length, 1);
    assert.equal(result.accounts[0].accountNumber, '0000');
    assert.ok(calls.some(value => value.endsWith('GetMonthlyBilling')));
    const txn = result.accounts[0].txns[0];
    assert.equal(txn.chargedAmount, -38.4);
    assert.equal(txn.processedDate.slice(0, 10), '2026-11-09'); // Midnight Israel is previous day in UTC.
  } finally { waiting.randomDelay = previousDelay; }
});

test('a real scraper navigation block stops before either login API request', async () => {
  const { Scraper } = loadAmexDependencies();
  const scraper = new Scraper({ companyId: 'amex' });
  let submitted = false;
  scraper.page = {
    browser: () => ({ version: async () => 'Chrome/149', userAgent: async () => 'Linux HeadlessChrome/149' }),
    setUserAgent: async () => {}, setExtraHTTPHeaders: async () => {},
    goto: async () => ({ status: () => 403 }),
    evaluate: async () => { submitted = true; throw new Error('unexpected credentials request'); },
  };
  await assert.rejects(scraper.login({ id: 'fixture', card6Digits: 'fixture', password: 'fixture' }), /WAF_BLOCKED/);
  assert.equal(submitted, false);
});
