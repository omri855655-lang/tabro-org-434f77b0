import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parseAmexStatement } from "../src/lib/amexStatement.ts";
import { sanitizeStatementRows, applyStatementBillingDate } from "../src/lib/cardStatement.ts";

function harness(options = {}) {
  const stored = [];
  const supabase = { from(table) {
    assert.equal(table, "financial_transactions");
    const filters = {};
    let updateFields;
    const matches = row => Object.entries(filters).every(([k,v]) => k === 'raw_data' && typeof v === 'string' ? JSON.stringify(row[k]) === v : row[k] === v);
    const query = {
      select() {
        if (!updateFields) return query;
        options.beforeUpdate?.(stored);
        const selected = stored.filter(matches);
        selected.forEach(row => Object.assign(row, structuredClone(updateFields)));
        return Promise.resolve({data:selected.map(row=>({id:row.id})),error:null});
      },
      eq(key, value) { filters[key] = value; return query; },
      is(key, value) { filters[key] = value; return query; },
      update(values) { updateFields=values; return query; },
      async in(key, values) { return { data: stored.filter(row => Object.entries(filters).every(([k, v]) => row[k] === v) && values.includes(row[key])), error: null }; },
      filter(key, operator, value) { assert.equal(operator, "in"); return query.in(key, JSON.parse(`[${value.slice(1,-1)}]`)); },
      async insert(rows) { for (const row of structuredClone(rows)) stored.push({...row,id:`row-${stored.length}`}); return { error: null }; },
    };
    return query;
  } };
  const javascript = ts.transpileModule(readFileSync(new URL("../src/lib/financialImport.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(javascript, { exports, require: () => ({ supabase }) });
  return { stored, run: exports.importParsedFinancialTransactions, preview:exports.previewBillingDateChanges };
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
  stored[2].raw_data.refund_expense_id = stored[0].external_transaction_id;
  const again = await run(input);
  assert.equal(again.imported, 0);
  assert.equal(again.skipped, 4);
  assert.equal(stored.length, 4);
  assert.equal(stored[0].category, "Reviewed category");
  assert.equal(stored[2].raw_data.refund_expense_id, stored[0].external_transaction_id);
  assert.equal((await run({ ...input, sourceConnectionId: "card-b" })).imported, 4);
  assert.equal((await run({ ...input, userId: "user-b" })).imported, 4);
});

const billingInput = date => ({userId:'owner',provider:'amex',sourceType:'credit_card_import',sourceConnectionId:'card-a',accountExternalId:'csv-card:card-a',parsed:applyStatementBillingDate(parseAmexStatement([['2026-09-10','Shop','100','ILS']],['Date','Description','Amount','Currency']).transactions,date)});
test('date updates require approval and preserve manual classification and refund metadata',async()=>{
  const {stored,run,preview}=harness();
  await run(billingInput('2026-10-10'));
  stored[0].category='Manually reviewed';stored[0].raw_data.refund_expense_id='linked-refund';
  const input=billingInput('2026-10-02');
  const draft=await preview(input);
  assert.equal(draft.length,1);assert.equal(draft[0].previousDate,'2026-10-10');assert.equal(draft[0].nextDate,'2026-10-02');
  assert.equal(stored[0].raw_data.billing_date,'2026-10-10','Preview does not write');
  assert.equal((await run(input)).updated,0,'No silent updates');
  const result=await run({...input,approvedBillingDateChanges:draft});
  assert.equal(result.imported,0);assert.equal(result.updated,1);assert.equal(stored.length,1);
  assert.equal(stored[0].raw_data.billing_date,'2026-10-02');
  assert.equal(stored[0].category,'Manually reviewed');assert.equal(stored[0].raw_data.refund_expense_id,'linked-refund');
  assert.equal((await preview(input)).length,0);
});
test('stale approvals and changes made during a write never overwrite newer metadata',async()=>{
  const h=harness();await h.run(billingInput('2026-10-10'));
  const input=billingInput('2026-10-02'),draft=await h.preview(input);
  h.stored[0].raw_data.billing_date='2026-10-05';
  assert.equal((await h.run({...input,approvedBillingDateChanges:draft})).conflicts,1);
  assert.equal(h.stored[0].raw_data.billing_date,'2026-10-05');
  const raced=harness({beforeUpdate:stored=>{stored[0].raw_data.refund_expense_id='new-link';}});
  await raced.run(billingInput('2026-10-10'));
  const approval=await raced.preview(input);
  const result=await raced.run({...input,approvedBillingDateChanges:approval});
  assert.equal(result.conflicts,1);assert.equal(result.updated,0);
  assert.equal(raced.stored[0].raw_data.billing_date,'2026-10-10');assert.equal(raced.stored[0].raw_data.refund_expense_id,'new-link');
});
test('approval cannot cross user or card scope and an empty date never erases a known date',async()=>{
  const h=harness();await h.run(billingInput('2026-10-10'));
  const input=billingInput('2026-10-02'),draft=await h.preview(input);
  assert.equal((await h.preview(billingInput(''))).length,0);
  assert.equal((await h.preview({...input,provider:'max'})).length,0);
  assert.equal((await h.run({...input,userId:'another-owner',approvedBillingDateChanges:draft})).updated,0);
  assert.equal(h.stored[0].raw_data.billing_date,'2026-10-10');
});
