import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import XLSX from "xlsx";
import { parseAmexStatement, reconcileAmexStatement } from "../src/lib/amexStatement.ts";
import { findStatementTable, applyStatementBillingDate, sanitizeStatementRows } from "../src/lib/cardStatement.ts";
import { parseCSV } from "../src/lib/financialProviders.ts";
import { forecastAmexInstallments } from "../src/lib/amexInstallmentForecast.ts";

const pendingHeaders = ["תאריך רכישה", "שם בית עסק", "סכום עסקה", "מטבע עסקה"];
const billedHeaders = [...pendingHeaders, "סכום חיוב", "מטבע חיוב", "מס' שובר", "פירוט נוסף"];
const rows = [
  ["2026-10-20", "Pending example", "30", "₪"],
  ["", 'סה"כ עסקאות שטרם נקלטו', "30", "₪"],
  ["עסקאות למועד חיוב"],
  billedHeaders,
  ["2026-10-10", "Example shop", "12", "₪", "12", "₪", "ref-a", ""],
  ["2026-10-08", "Example overseas", "1000", "din.", "40", "₪", "ref-b", ""],
  ["2026-09-07", "Example installments", "400", "₪", "100", "₪", "ref-c", "תשלום 3 מתוך 4"],
  ["", 'סה"כ לחיוב החודש בכרטיס בש"ח', "", "", "152", "₪"],
];
const parsed = () => parseAmexStatement(rows, pendingHeaders);
const input = () => ({
  userId: "owner", provider: "amex", sourceType: "credit_card_import", sourceConnectionId: "card-a",
  parsed: sanitizeStatementRows(applyStatementBillingDate(parsed().transactions, "2026-11-02")),
  legacyCorrections: parsed().legacyCorrections,
});
function harness(options = {}) {
  const stored = [];
  const readValue = (row,key) => key === "raw_data->>statement_canonical_id" ? row.raw_data?.statement_canonical_id : row[key];
  const supabase = { from() {
    const filters = {};
    let patch;
    const matches = row => Object.entries(filters).every(([key,value]) => key === "raw_data" && typeof value === "string" ? JSON.stringify(row[key]) === value : row[key] === value);
    const query = {
      eq(key,value) { filters[key]=value; return query; },
      is(key,value) { filters[key]=value; return query; },
      update(value) { patch=value; return query; },
      select() {
        if (!patch) return query;
        options.beforeUpdate?.(stored);
        const selected=stored.filter(matches);
        for(const row of selected) Object.assign(row,structuredClone(patch));
        return Promise.resolve({data:selected.map(row=>({id:row.id})),error:null});
      },
      async in(key,values) { return {data:structuredClone(stored.filter(row=>matches(row)&&values.includes(readValue(row,key)))),error:null}; },
      async insert(values) { for(const row of values) stored.push({...structuredClone(row),id:`id-${stored.length}`}); return {error:null}; },
    };
    return query;
  }};
  function load(file) {
    const exports={};
    const js=ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(js,{exports,require:()=>({supabase})});
    return exports;
  }
  return {stored,...load("../src/lib/amexImportRepair.ts"),...load("../src/lib/financialImport.ts")};
}
async function seed(h) {
  await h.importParsedFinancialTransactions({...input(),parsed:sanitizeStatementRows(applyStatementBillingDate(parseAmexStatement(rows,pendingHeaders,true).transactions,"2026-11-02"))});
  for(const row of h.stored){row.category="User category";row.raw_data.refund_expense_id="preserved-link";}
}

test("mixed pending/billed XLSX uses billed columns, retains installments and reconciles",()=>{
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["לחיוב ב-02.11.2026"],["עסקאות שטרם נקלטו"],pendingHeaders,...rows]),"Statement");
  const loaded=XLSX.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}));
  const table=findStatementTable(parseCSV(XLSX.utils.sheet_to_csv(loaded.Sheets.Statement)));
  const result=parseAmexStatement(table.rows,table.headers);
  assert.equal(result.transactions.length,3);
  assert.deepEqual(result.transactions.map(row=>row.amount),[12,40,100]);
  assert.equal(result.pending.length,1);
  assert.equal(result.transactions[2].installment_number,3);
  assert.deepEqual(reconcileAmexStatement(table.rows,table.headers,result.transactions),[{currency:"ILS",reported:152,parsed:152,difference:0,matches:true}]);
  assert.equal(parseAmexStatement(rows,pendingHeaders,true).transactions.reduce((sum,row)=>sum+row.amount,0),442);
});

test("reviewed repair preserves IDs, categories and refund links and repeated imports do not duplicate",async()=>{
  const h=harness();await seed(h);
  const before=structuredClone(h.stored);
  const draft=await h.previewAmexImportRepairs(input());
  assert.equal(draft.length,3);
  assert.deepEqual(h.stored,before,"Preview is read-only");
  const result=await h.applyAmexImportRepairs(input(),draft);
  assert.equal(result.updated,3);assert.equal(result.conflicts,0);
  assert.equal(h.stored[0].raw_data.statement_excluded,true);
  assert.equal(h.stored[0].raw_data.billing_date,null);
  assert.equal(h.stored[2].amount,100);
  assert.equal(h.stored[2].installment_number,3);
  for(let i=0;i<3;i++){
    assert.equal(h.stored[i].id,before[i].id);
    assert.equal(h.stored[i].external_transaction_id,before[i].external_transaction_id);
    assert.equal(h.stored[i].category,"User category");
    assert.equal(h.stored[i].raw_data.refund_expense_id,"preserved-link");
  }
  assert.equal((await h.importParsedFinancialTransactions(input())).imported,1,"Previously missed foreign billed row added");
  assert.equal((await h.importParsedFinancialTransactions(input())).imported,0);
  assert.equal(h.stored.length,4);
  assert.equal(h.stored.filter(row=>!row.raw_data.statement_excluded).reduce((sum,row)=>sum+row.amount,0),152);
  assert.equal((await h.previewAmexImportRepairs(input())).length,0);
  const estimates=forecastAmexInstallments(h.stored.map(row=>({...row,hidden:row.raw_data.statement_excluded===true})),"2026-11-03","2027-01-01");
  assert.equal(estimates.length,1);assert.equal(estimates[0].amount,100);assert.equal(estimates[0].date,"2026-12-02");
});

test("old approvals, concurrent changes, and other owners/cards cannot be patched",async()=>{
  const h=harness();await seed(h);
  const draft=await h.previewAmexImportRepairs(input());
  const original=h.stored[2].amount;
  h.stored[2].amount=original+1;
  const result=await h.applyAmexImportRepairs(input(),draft);
  assert.equal(result.conflicts,1);
  assert.equal(h.stored[2].amount,original+1);
  assert.equal((await h.previewAmexImportRepairs({...input(),userId:"other"})).length,0);
  assert.equal((await h.previewAmexImportRepairs({...input(),sourceConnectionId:"other"})).length,0);
  const raced=harness({beforeUpdate:stored=>{for(const row of stored)row.raw_data.concurrent="new";}});
  await seed(raced);
  const stale=await raced.previewAmexImportRepairs(input());
  const applied=await raced.applyAmexImportRepairs(input(),stale);
  assert.equal(applied.updated,0);
  assert.equal(applied.conflicts,3);
  assert.equal(raced.stored[2].amount,400);
});

test("ambiguous canonical rows and an already imported competing identity block repair",async()=>{
  const h=harness();await seed(h);
  const current=input();
  await assert.rejects(h.previewAmexImportRepairs({...current,parsed:[...current.parsed,current.parsed[0]]}),/Ambiguous/);
  await h.importParsedFinancialTransactions(current);
  await assert.rejects(h.previewAmexImportRepairs(current),/Conflicting/);
  assert.equal(h.stored[2].amount,400);
});
