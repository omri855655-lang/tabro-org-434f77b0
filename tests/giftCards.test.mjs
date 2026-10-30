import test from 'node:test';
import assert from 'node:assert/strict';
import { giftCardInput, giftCardStatus, GIFT_CARD_PROVIDERS } from '../src/lib/giftCards.ts';
import { summarizeLiquidBalances } from '../src/lib/financeBalances.ts';
test('gift wallet accepts zero, unknown expiry, and only valid amounts and dates', () => {
  assert.deepEqual(giftCardInput('  מתנה  ','BUYME','0',''),{name:'מתנה',provider:'BUYME',balance:0,expiry:null});
  for(const amount of ['','-1','NaN','Infinity','1e3','1.234','1000001']) assert.throws(()=>giftCardInput('Gift','BUYME',amount,''));
  for(const date of ['2026-02-30','wrong','2026-13-01']) assert.throws(()=>giftCardInput('Gift','BUYME','10',date));
  assert.throws(()=>giftCardInput('Gift','unknown','10',''));
});
test('gift status treats today as valid and approaching expiry separately',()=>{
  assert.equal(giftCardStatus('2026-10-29',10,'2026-10-30'),'expired');
  assert.equal(giftCardStatus('2026-10-30',10,'2026-10-30'),'soon');
  assert.equal(giftCardStatus(null,0,'2026-10-30'),'empty');
  assert.equal(giftCardStatus(null,10,'2026-10-30'),'active');
  assert.equal(giftCardStatus('2027-01-01',10,'2026-10-30'),'active');
});
test('gift cards never increase liquid bank balances and issuer URLs contain no redemption data',()=>{
  const base={provider_name:'bank',currency:'ILS',available_balance:null};
  assert.equal(summarizeLiquidBalances([{...base,account_type:'CHECKING',external_account_id:'a',current_balance:100},{...base,account_type:'GIFT_CARD',external_account_id:'b',current_balance:900}]).liquid,100);
  for(const provider of GIFT_CARD_PROVIDERS.filter(item=>item.url)) {const url=new URL(provider.url);assert.equal(url.protocol,'https:');assert.equal(url.search,'');assert.equal(url.hash,'');}
});
