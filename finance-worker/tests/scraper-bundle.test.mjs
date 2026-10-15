import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from 'node:vm';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundle = await readFile(path.join(root, "node_modules/@sergienko4/israeli-bank-scrapers/lib/index.mjs"), "utf8");

test("American Express, Discount and Visa Cal start directly at their official login applications", () => {
  assert.match(bundle, /\["discount" \/\* Discount \*\/\]: defineBank\("https:\/\/start\.telebank\.co\.il\/login\/"/);
  assert.match(bundle, /var DISCOUNT_LOGIN = \{\s+loginUrl: "https:\/\/start\.telebank\.co\.il\/login\/"/);
  assert.match(bundle, /\["visaCal" \/\* VisaCal \*\/\]: calConfig\("https:\/\/digital-web\.cal-online\.co\.il\/"/);
  assert.match(bundle, /var AMEX_LOGIN = \{\s+loginUrl: "https:\/\/he\.americanexpress\.co\.il\/personalarea\/login\/"/);
  assert.match(bundle, /\["amex" \/\* Amex \*\/\]: \{\s+urls: \{ base: "https:\/\/he\.americanexpress\.co\.il\/personalarea\/login\/" \}/);
  assert.match(bundle, /!\["visaCal", "discount", "amex"\]\.includes\(state\.options\.companyId\)/);
  const amexPipeline = bundle.match(/function buildAmexPipeline\(options\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(amexPipeline, /withPreLogin/);
  assert.match(amexPipeline, /withDeclarativeLogin\(AMEX_LOGIN\)/);
  const login = bundle.match(/var AMEX_LOGIN = \{([\s\S]*?)\n\};/)?.[1] || '';
  assert.match(login, /#flip/);
  assert.match(login, /#otpLoginPwd/);
  assert.match(login, /#otpLoginId_ID/);
  assert.match(login, /#cardnum/);
  assert.doesNotMatch(login, /selectors: \[\]/);
});

test("unaffected providers keep their own login configuration", () => {
  assert.match(bundle, /\["hapoalim" \/\* Hapoalim \*\/\]: defineBank\("https:\/\/www\.bankhapoalim\.co\.il"/);
});

test('Amex preAction navigates away from marketing homepage before looking for password controls', async () => {
  const block = bundle.match(/var AMEX_LOGIN = (\{[\s\S]*?\n\});/)?.[1];
  assert.ok(block);
  const config = vm.runInNewContext(`(${block})`, { URL });
  const events = [];
  const page = {
    url: () => 'https://www.americanexpress.co.il/',
    goto: async url => { events.push(['navigate', url]); return { status: () => 200 }; },
    locator: selector => ({
      first() { return this; },
      waitFor: async options => events.push(['wait', selector, options.state]),
      isVisible: async () => false,
      click: async () => events.push(['click', selector]),
    }),
  };
  await config.preAction(page);
  assert.deepEqual(events[0], ['navigate', 'https://he.americanexpress.co.il/personalarea/login/']);
  assert.ok(events.some(event => event[0] === 'click' && event[1] === '#flip'));
  assert.deepEqual(events.at(-1), ['wait', '#otpLoginPwd', 'visible']);
});

test('Amex stops on HTTP blocks and never touches password fields', async () => {
  const block = bundle.match(/var AMEX_LOGIN = (\{[\s\S]*?\n\});/)?.[1];
  const config = vm.runInNewContext(`(${block})`, { URL });
  let accessedField = false;
  await assert.rejects(config.preAction({
    url: () => 'https://www.americanexpress.co.il/',
    goto: async () => ({ status: () => 403 }),
    locator: () => { accessedField = true; throw new Error('unexpected field access'); },
  }), /WAF_BLOCKED/);
  assert.equal(accessedField, false);
});

test('Amex detects an HTML block without including page content in errors', async () => {
  const block = bundle.match(/var AMEX_LOGIN = (\{[\s\S]*?\n\});/)?.[1];
  const config = vm.runInNewContext(`(${block})`, { URL });
  await assert.rejects(config.preAction({
    url: () => 'https://he.americanexpress.co.il/personalarea/login/',
    locator: () => ({ first() { return this; }, waitFor: async () => { throw new Error('Timeout'); },
      innerText: async () => 'Sorry, you have been blocked. Private request reference: fixture-secret',
    }),
  }), error => /WAF_BLOCKED/.test(error.message) && !error.message.includes('fixture-secret'));
});

test('Amex never fills credentials after an unrelated-origin redirect', async () => {
  const block = bundle.match(/var AMEX_LOGIN = (\{[\s\S]*?\n\});/)?.[1];
  const config = vm.runInNewContext(`(${block})`, { URL });
  await assert.rejects(config.preAction({
    url: () => 'https://unexpected.example/login', goto: async () => ({ status: () => 200 }),
    locator: () => { throw new Error('unexpected field access'); },
  }), /LOGIN_UNTRUSTED_REDIRECT/);
});
