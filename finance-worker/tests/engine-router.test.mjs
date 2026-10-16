import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOUD_PROVIDER_IDS } from '../src/scraper-policy.mjs';
import { engineForProvider, scrapeWithProviderEngine } from '../src/engine-router.mjs';

test('the new engine is exclusive to Amex; every other bank retains the same credential object and legacy call', async () => {
  for (const companyId of CLOUD_PROVIDER_IDS.filter(value => value !== 'amex')) {
    const credentials = { username: 'fixture', password: 'not-a-real-password' };
    const result = { success: true, accounts: [{ accountNumber: 'fixture' }] };
    let calls = 0;
    assert.equal(engineForProvider(companyId, 'puppeteer-digitalv3'), 'legacy-playwright');
    const actual = await scrapeWithProviderEngine(companyId, credentials, {
      amexEngine: 'puppeteer-digitalv3',
      legacyScrape: async (provider, value) => {
        calls++; assert.equal(provider, companyId); assert.equal(value, credentials); return result;
      },
      amexScrape: () => { throw new Error('other banks must never load Amex'); },
    });
    assert.equal(actual, result); assert.equal(calls, 1);
  }
});

test('Amex routes to its isolated adapter exactly once', async () => {
  let calls = 0;
  const credentials = { id: 'fixture', card6Digits: 'fixture', password: 'fixture' };
  const result = { success: true };
  assert.equal(await scrapeWithProviderEngine('amex', credentials, {
    amexEngine: 'puppeteer-digitalv3',
    legacyScrape: () => { throw new Error('legacy Amex must not run'); },
    amexScrape: async value => { calls++; assert.equal(value, credentials); return result; },
  }), result);
  assert.equal(calls, 1);
});

test('a failed Amex request never falls back or submits credentials twice', async () => {
  let calls = 0;
  await assert.rejects(scrapeWithProviderEngine('amex', {}, {
    amexEngine: 'puppeteer-digitalv3',
    legacyScrape: () => { throw new Error('unexpected fallback'); },
    amexScrape: async () => { calls++; throw new Error('WAF_BLOCKED'); },
  }), /WAF_BLOCKED/);
  assert.equal(calls, 1);
});

test('Amex has an explicit rollback and bad Amex configuration cannot affect the other banks', async () => {
  assert.equal(engineForProvider('amex', 'legacy'), 'legacy-playwright');
  assert.throws(() => engineForProvider('amex', 'invalid'), /AMEX_ENGINE_NOT_CONFIGURED/);
  assert.equal(engineForProvider('visaCal', 'invalid'), 'legacy-playwright');
  assert.equal(engineForProvider('discount', 'invalid'), 'legacy-playwright');
});
