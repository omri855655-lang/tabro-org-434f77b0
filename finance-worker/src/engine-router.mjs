export function engineForProvider(companyId, amexEngine = 'legacy') {
  if (companyId !== 'amex') return 'legacy-playwright';
  if (amexEngine === 'legacy') return 'legacy-playwright';
  if (amexEngine === 'puppeteer-digitalv3') return 'amex-puppeteer-digitalv3';
  throw new Error('AMEX_ENGINE_NOT_CONFIGURED');
}

export async function scrapeWithProviderEngine(companyId, credentials, options) {
  if (engineForProvider(companyId, options.amexEngine) === 'amex-puppeteer-digitalv3') {
    // Never retry credentials through another engine after a failed login.
    return options.amexScrape(credentials);
  }
  return options.legacyScrape(companyId, credentials);
}
