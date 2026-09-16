import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundle = await readFile(path.join(root, "node_modules/@sergienko4/israeli-bank-scrapers/lib/index.mjs"), "utf8");

test("Discount and Visa Cal start directly at their official login applications", () => {
  assert.match(bundle, /\["discount" \/\* Discount \*\/\]: defineBank\("https:\/\/start\.telebank\.co\.il\/login\/"/);
  assert.match(bundle, /var DISCOUNT_LOGIN = \{\s+loginUrl: "https:\/\/start\.telebank\.co\.il\/login\/"/);
  assert.match(bundle, /\["visaCal" \/\* VisaCal \*\/\]: calConfig\("https:\/\/digital-web\.cal-online\.co\.il\/"/);
  assert.match(bundle, /!\["visaCal", "discount"\]\.includes\(state\.options\.companyId\)/);
});

test("unaffected providers keep their own login configuration", () => {
  assert.match(bundle, /\["amex" \/\* Amex \*\/\]: \{\s+urls: \{ base: "https:\/\/www\.americanexpress\.co\.il" \}/);
  assert.match(bundle, /\["hapoalim" \/\* Hapoalim \*\/\]: defineBank\("https:\/\/www\.bankhapoalim\.co\.il"/);
});
