import { type Page } from 'puppeteer';

const PAGE_ORIGINS = new Set(['https://he.americanexpress.co.il', 'https://web.americanexpress.co.il']);

export function assertAmexOrigin(value: string): void {
  const url = new URL(value);
  if (!PAGE_ORIGINS.has(url.origin) || url.username || url.password) {
    throw new Error('LOGIN_UNTRUSTED_REDIRECT: credentials were not submitted');
  }
}

export async function assertAmexPage(page: Page): Promise<void> {
  assertAmexOrigin(page.url());
  const text = await page.evaluate(() => document.body?.innerText ?? '');
  if (/access denied|sorry.{0,30}blocked|request rejected|attention required|verify you are human/i.test(text)) {
    throw new Error('WAF_BLOCKED: institution refused automated access');
  }
}

// Adapted from upstream PR #1186. Keep the actual OS and Chromium version;
// do not copy its hardcoded Windows identity onto the Linux worker.
export async function prepareAmexPage(page: Page): Promise<void> {
  const browser = page.browser();
  const version = (await browser.version()).match(/(?:Chrome|Chromium)\/(\d+)/)?.[1];
  const original = await browser.userAgent();
  if (!version) throw new Error('AMEX_BROWSER_UNSUPPORTED');
  const userAgent = original.replace('HeadlessChrome/', 'Chrome/');
  const platform = /Windows/.test(original) ? 'Windows' : /Macintosh/.test(original) ? 'macOS' : 'Linux';
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({
    'sec-ch-ua': `"Chromium";v="${version}", "Not_A Brand";v="99"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': `"${platform}"`,
    'accept-language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  });
}
