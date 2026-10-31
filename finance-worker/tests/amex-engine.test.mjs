import test from 'node:test';
import assert from 'node:assert/strict';
import { engineForProvider, protectAmexPage, scrapeOfficialAmex } from '../src/amex-engine.mjs';
import { CLOUD_PROVIDER_IDS } from '../src/scraper-policy.mjs';

test('only Amex uses the official engine; rollback cannot redirect other companies', () => {
  for (const id of CLOUD_PROVIDER_IDS.filter(id => id !== 'amex')) {
    assert.equal(engineForProvider(id), 'existing');
    assert.equal(engineForProvider(id, 'invalid'), 'existing');
  }
  assert.equal(engineForProvider('amex'), 'official-amex');
  assert.equal(engineForProvider('amex', 'legacy'), 'existing');
  assert.throws(() => engineForProvider('amex', 'invalid'));
});

function fakeEngine(scrape) {
  const observed = { closed: 0 };
  const browser = { newPage: async () => ({}), close: async () => { observed.closed++; } };
  return { observed, loadEngine: async () => ({ launch: async () => browser, createScraper: options => { observed.options = options; return { scrape: credentials => { observed.credentials = credentials; return scrape(); } }; } }) };
}
const credentials = { id: 'fixture-id', card6Digits: '123456', password: 'fixture-secret', unrelated: 'omit' };

test('official engine preserves installments, limits credentials and closes its browser', async () => {
  const result = {success:true,accounts:[{accountNumber:'1193',txns:[{chargedAmount:-25,installments:{number:2,total:4}}]}]};
  const fixture = fakeEngine(async () => result);
  assert.equal(await scrapeOfficialAmex(credentials, {...fixture,executablePath:'/fixture/chromium'}), result);
  assert.equal(fixture.observed.options.companyId, 'amex');
  assert.equal(fixture.observed.options.combineInstallments, false);
  assert.equal(fixture.observed.options.skipCloseBrowser, true);
  assert.equal(fixture.observed.closed, 1);
  assert.deepEqual(Object.keys(fixture.observed.credentials), ['id','password','card6Digits']);
});
test('no raw errors or credentials escape on failure, empty accounts or timeout', async () => {
  for (const scrape of [async () => {throw new Error('fixture-secret');}, async () => ({success:false,errorType:'GENERIC',errorMessage:'fixture-secret'}), async () => ({success:true,accounts:[]}), () => new Promise(() => {})]) {
    const fixture = fakeEngine(scrape);
    const result = await scrapeOfficialAmex(credentials,{...fixture,executablePath:'/fixture/chromium',timeoutMs:10});
    assert.equal(result.success,false);
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret/);
    assert.equal(fixture.observed.closed,1);
  }
});
test('missing credentials never start a browser', async () => {
  const result = await scrapeOfficialAmex({}, {executablePath:'/fixture/chromium',loadEngine:()=>{throw new Error('must not load');}});
  assert.equal(result.errorType, 'INVALID_INPUT');
});
test('origin and block guard stop credential POSTs, while cooperating with official interception', async () => {
  const handlers = {}, main = {}, events = [];
  const page = { setRequestInterception: async () => {}, on: (name, cb) => {handlers[name]=cb;}, mainFrame:()=>main };
  const state = {blocked:false,untrusted:false};
  await protectAmexPage(page,state);
  const request = (url,method='POST',navigation=false) => ({url:()=>url,method:()=>method,isInterceptResolutionHandled:()=>false,isNavigationRequest:()=>navigation,frame:()=>main,abort:async (_,priority)=>events.push(['abort',priority]),continue:async (_,priority)=>events.push(['continue',priority])});
  handlers.request(request('https://telemetry.example/event'));
  assert.deepEqual(events.pop(),['abort',1000]);
  assert.equal(state.untrusted,false);
  handlers.request({...request('https://he.americanexpress.co.il/'),isInterceptResolutionHandled:()=>true});
  assert.equal(events.length,0);
  handlers.request(request('https://he.americanexpress.co.il/services/ProxyRequestHandler.ashx'));
  assert.deepEqual(events.pop(),['continue',-100]);
  handlers.response({url:()=> 'https://he.americanexpress.co.il/personalarea/Login', status:()=>403});
  handlers.request(request('https://he.americanexpress.co.il/services/ProxyRequestHandler.ashx'));
  assert.deepEqual(events.pop(),['abort',1000]);
  handlers.request(request('https://evil.example/login','GET',true));
  assert.equal(state.untrusted,true);
  assert.deepEqual(events.pop(),['abort',1000]);
});

test('block diagnostics distinguish login phases without retaining private query data', async () => {
  for (const [path, stage, resource] of [
    ['/personalarea/Login?private=fixture-secret', 'login-page', 'document'],
    ['/services/ProxyRequestHandler.ashx?reqName=ValidateIdData&id=fixture-secret', 'identity-validation', 'fetch'],
    ['/services/ProxyRequestHandler.ashx?reqName=performLogonI&password=fixture-secret', 'password-login', 'xhr'],
    ['/services/ProxyRequestHandler.ashx?reqName=private-fixture-secret', 'issuer-api', 'xhr'],
    ['/private-fixture-secret.css', 'other-resource', 'stylesheet'],
  ]) {
    const handlers = {}, state = {};
    await protectAmexPage({ setRequestInterception: async () => {}, on: (name, cb) => { handlers[name] = cb; } }, state);
    handlers.response({ url: () => `https://he.americanexpress.co.il${path}`, status: () => 403,
      request: () => ({ resourceType: () => resource }) });
    assert.deepEqual(state.blockDetail, { status: 403, stage, resource, passwordRequestObserved: false });
    assert.doesNotMatch(JSON.stringify(state), /fixture-secret/);
    handlers.response({ url: () => 'https://he.americanexpress.co.il/later', status: () => 429 });
    assert.equal(state.blockDetail.stage, stage, 'retain the first rejection');
  }
});

test('HTTP rejection diagnostics survive scraper throws and contain no raw error', async () => {
  let closed = false;
  const handlers = {};
  const page = { setRequestInterception: async () => {}, on: (name, cb) => { handlers[name] = cb; } };
  const browser = { newPage: async () => page, close: async () => { closed = true; } };
  const loadEngine = async () => ({ launch: async () => browser, createScraper: () => ({ scrape: async () => {
    await browser.newPage();
    handlers.response({ url: () => 'https://he.americanexpress.co.il/personalarea/Login?secret=fixture-secret', status: () => 429,
      request: () => ({ resourceType: () => 'document' }) });
    throw new Error('fixture-secret');
  } }) });
  const result = await scrapeOfficialAmex(credentials, { executablePath: '/fixture/chromium', loadEngine });
  assert.equal(result.errorType, 'WAF_BLOCKED');
  assert.match(result.errorMessage, /HTTP_429; stage=login-page; resource=document; password_request=not-observed/);
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret/);
  assert.equal(closed, true);
});
