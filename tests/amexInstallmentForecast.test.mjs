import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastAmexInstallments } from '../src/lib/amexInstallmentForecast.ts';

const row=(number,total=4,extra={})=>({id:`id-${number}`,external_transaction_id:`amex-csv-v1:${JSON.stringify(['voucher','ILS','expense','1234',`${number}/${total}`,''])}`,provider:'amex',source_type:'credit_card_import',source_connection_id:'card-a',direction:'expense',amount:100,currency:'ILS',installment_number:number,installment_total:total,raw_data:{billing_date:`2026-${String(8+number).padStart(2,'0')}-02`},...extra});
const run=rows=>forecastAmexInstallments(rows,'2026-10-26','2027-01-24');
test('only future remaining installments are estimated without modifying the source',()=>{
  const rows=[row(2)],before=structuredClone(rows);
  assert.deepEqual(run(rows).map(r=>[r.date,r.amount,r.installment]),[['2026-11-02',100,3],['2026-12-02',100,4]]);
  assert.deepEqual(rows,before);
  assert.equal(run([row(4)]).length,0);
});
test('a reported later installment replaces its projection rather than doubling it',()=>{
  assert.deepEqual(run([row(2),row(3)]).map(r=>r.installment),[4]);
  assert.equal(run([row(2),row(3),row(4)]).length,0);
});
test('missing, hidden, duplicate and conflicting evidence is not guessed',()=>{
  assert.equal(run([row(2,{})]).length,0);
  assert.equal(run([row(2,4,{raw_data:{}})]).length,0);
  assert.equal(run([row(2,4,{hidden:true})]).length,0);
  assert.equal(run([row(2),row(2)]).length,0);
  assert.equal(run([row(2),row(3,6)]).length,0);
  assert.equal(run([row(2,4,{external_transaction_id:'amex-csv-v1:["2026-09-01|Shop|100","ILS","expense","1234","2/4",""]'})]).length,0);
  const repeat=row(2);repeat.external_transaction_id+=':2';assert.equal(run([row(2),repeat]).length,0);
});
test('refund evidence suppresses the series and separate cards remain isolated',()=>{
  const refund=row(2,4,{direction:'income'});
  assert.equal(run([row(2),refund]).length,0);
  assert.equal(run([row(2),row(2,4,{source_connection_id:'card-b'})]).length,4);
  assert.equal(run([row(2,4,{source_type:'cloud_scraper'})]).length,0);
});
test('month ends are clamped and foreign estimates keep their currency',()=>{
  const result=forecastAmexInstallments([row(1,3,{raw_data:{billing_date:'2027-01-31'},currency:'USD'})],'2027-02-01','2027-03-31');
  assert.deepEqual(result.map(r=>[r.date,r.currency]),[['2027-02-28','USD'],['2027-03-31','USD']]);
});
