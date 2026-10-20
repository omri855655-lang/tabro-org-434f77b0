import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const nativeRequire = createRequire(filename);
  const require = id => {
    if (!id.startsWith(".") && !id.startsWith("@/")) return nativeRequire(id);
    const base = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(filename), id);
    const target = [base, `${base}.tsx`, `${base}.ts`].find(value => existsSync(value));
    assert.ok(target, `Missing module ${id}`);
    return load(target);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require, console, Intl, Date, Set, Map }, { filename });
  return module.exports;
}
const Overview = load("src/components/dashboards/FinanceOverview.tsx").default;
const Workspace = load("src/components/dashboards/FinanceWorkspace.tsx").default;
const CardOverview = load("src/components/dashboards/CardCashflowOverview.tsx").default;
const paymentSource = readFileSync(path.join(root, "src/components/dashboards/PaymentDashboard.tsx"), "utf8");
const paymentAst = ts.createSourceFile("PaymentDashboard.tsx", paymentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(paymentAst);
const panels = nodes.filter(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(paymentAst) === "TabsContent");
const panelValue = node => node.openingElement.attributes.properties.find(prop => prop.name?.getText(paymentAst) === "value")?.initializer?.text;
const expectedPanels = ["overview", "transactions", "insights", "forecast", "credit-cards", "add", "budget", "history", "ai", "guides", "clubs"];
const renderOverview = (entries = [], accounts = []) => renderToStaticMarkup(React.createElement(Overview, { entries, accounts, isRtl: true, selectedMonth: "2026-09" }));
const entry = (id, amount, overrides = {}) => ({ id, title: id, amount, currency: "ILS", category: "קניות", payment_type: "expense", created_at: "2026-09-01", paid: true, ...overrides });

test("card overview shows real next debit, unknown months, estimates and reversible hiding", () => {
  const card = { key: 'max:1234:ILS', account: { display_name:'MAX', masked_number:'****1234', external_account_id:'max:1234' }, charges:[{ date:'2026-11-10', amount:123.45, credit:0, estimated:true }], undated:0, foreignCurrencies:[] };
  const props = { cards:[card], hiddenKeys:[], onVisibility(){}, onBillingDay(){}, saving:false, isRtl:true };
  const html = renderToStaticMarkup(React.createElement(CardOverview, props));
  assert.match(html,/123\.45/);
  assert.match(html,/אומדן לפי יום פירעון/);
  assert.match(html,/ללא אומדן/);
  assert.match(html,/הסר מהתצוגה/);
  const hidden = renderToStaticMarkup(React.createElement(CardOverview,{...props,hiddenKeys:[card.key]}));
  assert.doesNotMatch(hidden,/123\.45/);
  assert.match(hidden,/ההיסטוריה נשמרת וחיובים ידועים ממשיכים/);
  assert.match(hidden,/החזר/);
});

test("actual card visibility callback persists preferences only, retaining forecast inputs", async () => {
  const declaration=nodes.find(node=>ts.isVariableDeclaration(node)&&node.name.getText(paymentAst)==='setCardVisibility');
  const js=ts.transpileModule(`const callback=${declaration.initializer.getText(paymentAst)}; callback;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const writes=[];
  const callback=vm.runInNewContext(js,{hiddenCardKeys:['old'],Set,isRtl:true,toast:{success(){}},saveCardPreference:async patch=>{writes.push(JSON.parse(JSON.stringify(patch)));return true;}});
  await callback('card',true);
  assert.deepEqual(writes,[{hiddenCardKeys:['old','card']}]);
  assert.doesNotMatch(paymentSource,/hiddenCardKeys\.includes\([^)]*\).*creditCardUpcoming/);
});

test("actual preference write preserves notification settings and never touches financial records", async () => {
  const declaration=nodes.find(node=>ts.isVariableDeclaration(node)&&node.name.getText(paymentAst)==='saveCardPreference');
  const js=ts.transpileModule(`const callback=${declaration.initializer.arguments[0].getText(paymentAst)}; callback;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const saved=[];
  const states=[];
  const supabase={from(table){assert.equal(table,'user_preferences');return {select(){return this;},eq(column,value){assert.equal(column,'user_id');assert.equal(value,'owner');return this;},async maybeSingle(){return {data:{notification_settings:{push:true,financeForecast:{other:'keep'}}},error:null};},async upsert(value){saved.push(value);return {error:null};}};}};
  const callback=vm.runInNewContext(js,{user:{id:'owner'},savingCardPreferences:false,setSavingCardPreferences(){},setHiddenCardKeys:value=>states.push([...value]),setCardBillingDays(){},supabase,withFinanceReadTimeout:promise=>promise,isRtl:true,toast:{error(){assert.fail('unexpected save error');}}});
  assert.equal(await callback({hiddenCardKeys:['card']}),true);
  assert.equal(saved[0].notification_settings.push,true);
  assert.equal(saved[0].notification_settings.financeForecast.other,'keep');
  assert.deepEqual(states,[['card']]);
});

test("every finance capability keeps exactly one reachable tab panel", () => {
  assert.deepEqual(panels.map(panelValue).sort(), [...expectedPanels].sort());
  const html = renderToStaticMarkup(React.createElement(Workspace, { isRtl: true, activeTab: "overview", onTabChange() {}, onImport() {}, monthControl: "month", exportControl: "export" }));
  for (const value of expectedPanels) assert.ok(html.includes(`trigger-${value}`), value);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /ייבוא Amex/);
  assert.match(html, /הוספת תנועה/);
});

test("the default overview no longer mounts forecasts, filters, budgets or AI", () => {
  const overview = panels.find(node => panelValue(node) === "overview").getText(paymentAst);
  assert.match(overview, /<FinanceOverview/);
  for (const component of ["FinanceInsights", "BudgetCharts", "BankConnect", "AiChatPanel", "CreditCardImport"]) assert.ok(!overview.includes(`<${component}`), component);
  assert.ok(!overview.includes("cashFlowForecast"));
  for (const component of ["FinanceInsights", "BudgetCharts", "BankConnect", "AiChatPanel", "CreditCardImport"]) assert.ok(paymentSource.includes(`<${component}`), component);
  assert.match(panels.find(node => panelValue(node) === "add").getText(paymentAst), /onClick=\{addPayment\}/);
});

test("category and merchant drilldowns actually navigate to the ledger and preserve currency", () => {
  const insights = nodes.find(node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(paymentAst) === "FinanceInsights");
  for (const name of ["onCategorySelect", "onMerchantSelect"]) {
    const prop = insights.attributes.properties.find(item => item.name?.getText(paymentAst) === name);
    const calls = {};
    const scope = Object.fromEntries(["CategoryFilter", "TransactionSearch", "AccountFilter", "SourceFilter", "InsightCurrencyFilter", "ActiveTab"].map(key => [`set${key}`, value => { calls[key] = value; }]));
    const callback = vm.runInNewContext(`(${prop.initializer.expression.getText(paymentAst)})`, scope);
    callback("test", "USD");
    assert.equal(calls.ActiveTab, "transactions");
    assert.equal(calls.InsightCurrencyFilter, "USD");
    assert.equal(calls.AccountFilter, "all");
    assert.equal(calls.SourceFilter, "all");
    assert.equal(calls[name === "onCategorySelect" ? "CategoryFilter" : "TransactionSearch"], "test");
  }
});

test("Amex shortcut selects the import panel, retaining provider and fallback behavior", () => {
  const declaration = nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(paymentAst) === "openCsvFallback");
  const expression = declaration.initializer.arguments[0].getText(paymentAst);
  const calls = {};
  const js = ts.transpileModule(`const callback = ${expression}; callback;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const callback = vm.runInNewContext(js, { setRequestedCsvProvider: value => { calls.provider = value; }, setShowCsvFallback: value => { calls.open = value; }, setActiveTab: value => { calls.tab = value; }, window: { setTimeout() {} } });
  callback("amex");
  assert.deepEqual(calls, { provider: "amex", open: true, tab: "credit-cards" });
});

test("overview avoids invented liquid balances while a reported zero remains a real value", () => {
  assert.match(renderOverview(), /אין נתון זמין/);
  const account = { external_account_id: "test", provider_name: "test", account_type: "CHECKING", display_name: "Test", masked_number: null, currency: "ILS", current_balance: null, available_balance: null };
  assert.match(renderOverview([], [account]), /אין נתון זמין/);
  assert.doesNotMatch(renderOverview([], [{ ...account, current_balance: 0 }]), /אין נתון זמין/);
  assert.match(renderOverview([], [{ ...account, account_type: "CARD", available_balance: 20000 }]), /אין נתון זמין/);
  assert.match(renderOverview([], [{ ...account, currency: "USD", current_balance: 200 }]), /אין נתון זמין/);
});

test("overview totals isolate currencies, exclude invalid/hidden/future entries and identify credits honestly", () => {
  const html = renderOverview([
    entry("purchase", 100), entry("purchase", 100), entry("usd", 99000, { currency: "USD" }),
    entry("hidden", 88000, { hidden: true }), entry("unpaid", 77000, { paid: false }),
    entry("future", 66000, { created_at: "2099-09-01" }), entry("invalid", 55000, { created_at: "2026-02-30" }),
    entry("salary", 500, { payment_type: "income" }), entry("credit", 20, { payment_type: "income" }),
  ]);
  assert.match(html, /520\.00/);
  assert.match(html, /100\.00/);
  assert.match(html, /420\.00/);
  assert.doesNotMatch(html, /99,000|88,000|77,000|66,000|55,000/);
  assert.match(html, /הכנסות וזיכויים/);
  assert.match(html, /הפרש התנועות אינו יתרת הבנק/);
  assert.equal((html.match(/<details/g) || []).length, 2);
  assert.ok(!html.includes("<details open"));
});
