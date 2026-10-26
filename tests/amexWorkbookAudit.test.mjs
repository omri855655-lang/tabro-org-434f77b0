import assert from 'node:assert/strict';
import test from 'node:test';
import XLSX from 'xlsx';
import { parseCSV } from '../src/lib/financialProviders.ts';
import { findStatementTable, statementBillingDate } from '../src/lib/cardStatement.ts';
import { parseAmexStatement, reconcileAmexStatement } from '../src/lib/amexStatement.ts';

test('workbook pipeline detects the preamble and reconciles billed amounts, not foreign originals',()=>{
  const records=[['פירוט עסקאות'],['לחיוב ב-02.10.2026'],[],['תאריך רכישה','שם בית עסק','סכום עסקה','מטבע עסקה','סכום חיוב','מטבע חיוב',"מס' שובר",'פירוט נוסף'],['15.09.26','Example shop',30,'$',110,'₪','ref-a',''],['07.09.26','Example installments',300,'₪',100,'₪','ref-b','תשלום 2 מתוך 3'],['10.09.26','Example refund',-10,'₪',-10,'₪','ref-c',''],['','סה"כ לחיוב החודש בכרטיס בש"ח','','',200,'₪']];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(records),'Statement');
  const loaded=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}));
  const table=findStatementTable(parseCSV(XLSX.utils.sheet_to_csv(loaded.Sheets[loaded.SheetNames[0]])));
  const parsed=parseAmexStatement(table.rows,table.headers);
  assert.equal(parsed.transactions.length,3);
  assert.equal(statementBillingDate(table.preamble,parsed.transactions,'1234_10_2026.xlsx'),'2026-10-02');
  assert.deepEqual(reconcileAmexStatement(table.rows,table.headers,parsed.transactions),[{currency:'ILS',reported:200,parsed:200,difference:0,matches:true}]);
  assert.equal(reconcileAmexStatement(table.rows,table.headers,parsed.transactions.slice(1))[0].matches,false);
  assert.equal(parsed.transactions[0].amount,110);
  assert.equal(parsed.transactions[1].installment_number,2);
});
test('ambiguous section totals are not presented as a successful reconciliation',()=>{
  const headers=['תיאור','סכום חיוב','מטבע חיוב'];
  const rows=[['סה"כ לחיוב החודש בכרטיס בש"ח','100','₪'],['סה"כ לחיוב החודש בכרטיס בש"ח','100','₪']];
  assert.deepEqual(reconcileAmexStatement(rows,headers,[]),[]);
});
