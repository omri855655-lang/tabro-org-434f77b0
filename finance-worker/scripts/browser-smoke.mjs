import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { loadAmexDependencies } from '../src/amex-adapter.mjs';

const executablePath = process.env.FINANCE_BROWSER_EXECUTABLE;
assert.ok(executablePath, 'Container Chromium executable is required');

for (const [engine, launch] of [
  ['legacy-playwright', options => chromium.launch(options)],
  ['amex-puppeteer', loadAmexDependencies().launch],
]) {
  const browser = await launch({
    executablePath, headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('data:text/html,<title>Tabro finance smoke</title>');
    assert.equal(await page.title(), 'Tabro finance smoke');
    console.log(JSON.stringify({ engine, browser: await browser.version(), smoke: 'passed' }));
  } finally { await browser.close(); }
}
