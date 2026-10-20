import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCardCashflows, cashflowCardKey } from '../src/lib/cardCashflow.ts';

const account = { id: 'cloud:a', external_account_id: 'max:1234', provider_name: 'Max', display_name: 'MAX', account_type: 'CARD', masked_number: '****1234', currency: 'ILS', backend: 'cloud', last_synced_at: '2026-10-20T12:00:00Z' };
const row = (id, amount, extra = {}) => ({ id, amount, direction: 'expense', currency: 'ILS', source_type: 'cloud_scraper', account_external_id: 'max:1234', backend: 'cloud', transaction_date: '2026-10-18', posted_date: '2026-11-10', created_at: '2026-10-20T12:00:00Z', ...extra });
const run = (rows, days = {}, accounts = [account]) => buildCardCashflows(accounts, rows, '2026-10-20', '2027-01-18', days);

test('synced debit dates are grouped by card and month with refunds netted', () => {
  const [card] = run([row('a',100), row('b',40), row('c',25,{direction:'income'}), row('d',80,{posted_date:'2026-12-10'})]);
  assert.deepEqual(card.charges.map(x => [x.date,x.amount,x.estimated]), [['2026-11-10',115,false],['2026-12-10',80,false]]);
});
test('card and bank balances never create invented monthly charges', () => {
  assert.equal(run([],{},[{...account,current_balance:11000}])[0].charges.length,0);
  assert.equal(run([],{},[{...account,account_type:'CHECKING'}]).length,0);
});
test('past debit cycles, hidden, canceled, nonfinite and other card rows are excluded', () => {
  const [card] = run([row('a',10,{raw_data:{billing_date:'2026-10-10'}}),row('b',20,{hidden:true}),row('c',20,{raw_data:{status:'cancelled'}}),row('d',NaN),row('e',20,{account_external_id:'max:9999'})]);
  assert.equal(card.charges.length,0);
});
test('a known debit is included today and only once within the horizon', () => {
  const r=row('a',12.34,{posted_date:'2026-10-20'});
  assert.equal(run([r,r,row('b',100,{posted_date:'2027-02-10'})])[0].charges[0].amount,12.34);
});
test('current purchases without a future date require a billing day, never reuse history', () => {
  const rows=[row('a',100,{posted_date:'2026-10-18'}),row('b',900,{transaction_date:'2025-10-18',posted_date:'2025-10-18'})];
  assert.equal(run(rows)[0].undated,1);
  assert.equal(run(rows)[0].charges.length,0);
  const [card]=run(rows,{[cashflowCardKey(account)]:10});
  assert.deepEqual(card.charges.map(x=>[x.date,x.amount,x.estimated]),[['2026-11-10',100,true]]);
});
test('preferred billing day does not move an explicit statement billing date', () => {
  assert.equal(run([row('a',10,{raw_data:{billing_date:'2026-12-02'}})],{[cashflowCardKey(account)]:10})[0].charges[0].date,'2026-12-02');
});
test('foreign charges are not converted or summed into shekel forecast', () => {
  const [card]=run([row('a',30,{currency:'USD'}),row('b',10)]);
  assert.equal(card.charges[0].amount,10);
  assert.deepEqual(card.foreignCurrencies,['USD']);
});
test('installment counts never multiply the actual debit and unknown months stay unknown', () => {
  const [card]=run([row('a',100,{installment_total:12})]);
  assert.equal(card.charges.length,1);
  assert.equal(card.charges[0].amount,100);
});
test('net credit remains a credit balance, not invented cash income', () => {
  const [card]=run([row('a',20),row('b',50,{direction:'income'})]);
  assert.equal(card.charges[0].amount,0);
  assert.equal(card.charges[0].credit,30);
});
test('CSV sources use confirmed dates and approved statement refunds only', () => {
  const csv={...account,id:'csv-card:x',external_account_id:'csv-card:x',provider_name:'amex',backend:'legacy'};
  const t=(id,amount,extra={})=>row(id,amount,{source_type:'credit_card_import',source_connection_id:'x',account_external_id:null,backend:'legacy',posted_date:null,raw_data:{billing_date:'2026-11-10'},...extra});
  const [card]=run([t('a',100),t('b',20,{direction:'income',raw_data:{billing_date:'2026-11-10',statement_credit:true}}),t('c',70,{direction:'income'})],{},[csv]);
  assert.equal(card.charges[0].amount,80);
});
test('same issuer and suffix are represented once using the freshest source', () => {
  const old={...account,id:'old',backend:'legacy',last_synced_at:'2025-01-01'};
  const [card]=run([row('a',100),row('b',100,{backend:'legacy',created_at:'2025-01-01'})],{},[old,account]);
  assert.equal(card.account.id,'cloud:a');
  assert.equal(card.charges[0].amount,100);
});
test('month-end billing day is clamped and legacy preferences remain readable', () => {
  const [card]=buildCardCashflows([account],[row('a',100,{posted_date:null,transaction_date:'2027-02-01'})],'2027-02-02','2027-03-31',{'Max:max:1234':31});
  assert.equal(card.charges[0].date,'2027-02-28');
});
