import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(file, supabase) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, require: () => ({ supabase }) });
  return exports;
}

test("real Supabase SDK preserves quoted JSON IDs in repair, reimport and alias requests", async () => {
  const oldId = 'amex-csv-v1:' + JSON.stringify(['2026-10-01|Shop "A", \\ branch|100', 'ILS', 'expense', '', '', '']);
  const newId = 'amex-csv-v1:' + JSON.stringify(['reference-1', 'ILS', 'expense', '', '', '']);
  let mode = 'repair';
  const requests = [];
  const old = { id: 'old-row', external_transaction_id: oldId, amount: 100, currency: 'ILS', installment_number: null, installment_total: null, raw_data: {} };
  const supabase = createClient('https://test.invalid', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      assert.equal(options.method, 'GET', 'A known import must never insert again');
      const params = new URL(url).searchParams;
      assert.equal(params.get('user_id'), 'eq.owner');
      assert.equal(params.get('source_connection_id'), 'eq.card-a');
      const key = params.has('external_transaction_id') ? 'external_transaction_id' : 'raw_data->>statement_canonical_id';
      const filter = params.get(key);
      assert.ok(filter.startsWith('in.('));
      // Decode the quoted list as PostgREST requires, not as the in-memory importer mock did.
      const ids = JSON.parse(`[${filter.slice(4, -1)}]`);
      requests.push({ key, ids });
      let data = [];
      if (mode === 'repair' && ids.includes(oldId)) data = [old];
      if (mode === 'direct' && key === 'external_transaction_id') data = [{ ...old, external_transaction_id: newId }];
      if (mode === 'alias' && key === 'raw_data->>statement_canonical_id') data = [{ ...old, raw_data: { statement_canonical_id: newId } }];
      return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
    } },
  });
  const parsed = [{ external_transaction_id: newId, transaction_date: '2026-10-01', description: 'Example', amount: 25, currency: 'ILS', direction: 'expense' }];
  const input = { userId: 'owner', sourceConnectionId: 'card-a', provider: 'amex', sourceType: 'credit_card_import', parsed, legacyCorrections: [{ legacyExternalId: oldId, next: parsed[0] }] };
  const repair = load('../src/lib/amexImportRepair.ts', supabase);
  const importer = load('../src/lib/financialImport.ts', supabase);
  assert.equal((await repair.previewAmexImportRepairs(input)).length, 1);
  assert.deepEqual(requests[0].ids, [oldId, newId]);
  for (mode of ['direct', 'alias']) {
    const result = await importer.importParsedFinancialTransactions(input);
    assert.equal(result.imported, 0);
    assert.equal(result.skipped, 1);
  }
});
