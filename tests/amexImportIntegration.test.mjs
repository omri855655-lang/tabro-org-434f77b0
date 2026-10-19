import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parseAmexStatement } from "../src/lib/amexStatement.ts";
import { sanitizeStatementRows, applyStatementBillingDate } from "../src/lib/cardStatement.ts";

function harness() {
  const stored = [];
  const supabase = { from(table) {
    assert.equal(table, "financial_transactions");
    const filters = {};
    const query = {
      select() { return query; },
      eq(key, value) { filters[key] = value; return query; },
      async in(key, values) { return { data: stored.filter(row => Object.entries(filters).every(([k, v]) => row[k] === v) && values.includes(row[key])), error: null }; },
      async insert(rows) { stored.push(...structuredClone(rows)); return { error: null }; },
    };
    return query;
  } };
  const javascript = ts.transpileModule(readFileSync(new URL("../src/lib/financialImport.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(javascript, { exports, require: () => ({ supabase }) });
  return { stored, run: exports.importParsedFinancialTransactions };
}

test("actual shared importer preserves duplicate occurrences, skips reimport and retains reviewed categories", async () => {
  const { run, stored } = harness();
  const rows = parseAmexStatement([
    ["2026-10-01", "Shop", "100", "ILS", "1234"],
    ["2026-10-01", "Shop", "100", "ILS", "1234"],
    ["2026-10-02", "Refund", "-20", "ILS", "1234"],
    ["2026-10-03", "Netflix", "12.50", "USD", "1234"],
  ], ["Date", "Description", "Amount", "Currency", "Card Number"]).transactions;
  rows[0].category = "Reviewed category";
  const parsed = sanitizeStatementRows(applyStatementBillingDate(rows, "2026-11-02"));
  const input = { userId: "user-a", parsed, provider: "amex", sourceType: "credit_card_import", sourceConnectionId: "card-a", accountExternalId: "csv-card:card-a" };
  const first = await run(input);
  assert.equal(first.imported, 4);
  assert.equal(new Set(stored.map(row => row.external_transaction_id)).size, 4);
  assert.equal(stored[0].category, "Reviewed category");
  assert.equal(stored[2].direction, "income");
  assert.equal(stored[2].raw_data.statement_credit, true);
  assert.equal(stored[3].currency, "USD");
  assert.equal(stored[0].raw_data.billing_date, "2026-11-02");
  assert.equal(stored[0].raw_data.account_external_id, "csv-card:card-a");
  assert.equal(stored[0].raw_data["card ending"], undefined);
  const again = await run(input);
  assert.equal(again.imported, 0);
  assert.equal(again.skipped, 4);
  assert.equal(stored.length, 4);
  assert.equal(stored[0].category, "Reviewed category");
  assert.equal((await run({ ...input, sourceConnectionId: "card-b" })).imported, 4);
  assert.equal((await run({ ...input, userId: "user-b" })).imported, 4);
});
