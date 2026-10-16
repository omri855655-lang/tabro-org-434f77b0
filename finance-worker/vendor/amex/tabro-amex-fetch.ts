import { type Page } from 'puppeteer';
import { assertAmexPage } from './tabro-amex-browser';

const ALLOWED_ENDPOINTS = new Set([
  'https://he.americanexpress.co.il/services/ProxyRequestHandler.ashx?reqName=ValidateIdData',
  'https://he.americanexpress.co.il/services/ProxyRequestHandler.ashx?reqName=performLogonI',
  ...['GetCardList', 'GetMonthlyBilling', 'GetTransactionsList'].map(
    name => `https://web.americanexpress.co.il/ocp/transactions/DigitalV3.Transactions/${name}`,
  ),
]);

export async function fetchPostWithinPage<T>(
  page: Page, url: string, data: unknown, headers: Record<string, string> = {},
): Promise<T> {
  if (!ALLOWED_ENDPOINTS.has(url)) throw new Error('AMEX_ENDPOINT_NOT_ALLOWED');
  await assertAmexPage(page);
  const response = await page.evaluate(async ({ target, payload, extraHeaders }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const result = await fetch(target, {
        method: 'POST', credentials: 'include', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(payload),
      });
      return { status: result.status, text: await result.text() };
    } finally { clearTimeout(timeout); }
  }, { target: url, payload: data, extraHeaders: headers });
  if ([403, 429].includes(response.status)
    || /block automation|bot detection|sorry.{0,30}blocked|attention required|verify you are human/i.test(response.text)) {
    throw new Error('WAF_BLOCKED: institution refused automated access');
  }
  if (response.status < 200 || response.status >= 300) throw new Error('AMEX_REQUEST_FAILED');
  try { return JSON.parse(response.text) as T; }
  catch { throw new Error('AMEX_INVALID_RESPONSE'); }
}
