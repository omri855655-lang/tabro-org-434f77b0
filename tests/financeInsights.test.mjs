import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { analyzeFinanceInsights, financeCalendarDate, financeEntryCurrency, formatFinanceMoney } from "../src/lib/financeInsights.ts";
import { cleanMerchantName, getFinanceCategoryGroup } from "../src/lib/financeCategorization.ts";

const now = new Date("2026-10-18T09:00:00Z");
const entry = (date, overrides = {}) => ({
  id: date, title: "Example subscription", amount: 100, currency: "ILS", category: "בילויים", subcategory: "מנויים",
  payment_type: "expense", source_channel: "credit_card", account_label: "Test issuer", account_last_four: "1234",
  account_external_id: "account-a", payment_method: "test-provider", created_at: date, recurring: false, paid: true,
  ...overrides,
});
const history = (overrides = {}) => ["2026-08-10", "2026-09-10", "2026-10-10"].map(date => entry(date, overrides));
const analyze = (entries, month = "2026-10", currency = "ILS") => analyzeFinanceInsights(entries, month, currency, now);

test("selected historical month is used, not wall-clock month", () => {
  const result = analyze([entry("2026-08-10"), entry("2026-09-10", { amount: 300 }), entry("2026-10-10", { amount: 900 })], "2026-09");
  assert.equal(result.currentSpend, 300);
  assert.equal(result.previousSpend, 100);
  assert.equal(result.change, 200);
  assert.equal(result.comparisonIsPartial, false);
});

test("current-month comparison uses like-for-like elapsed days", () => {
  const result = analyze([entry("2026-09-18"), entry("2026-09-19", { amount: 500 }), entry("2026-10-18", { amount: 200 }), entry("2026-10-19", { amount: 500 })]);
  assert.equal(result.currentSpend, 200);
  assert.equal(result.previousSpend, 100);
  assert.equal(result.previousDays, 18);
  assert.equal(result.dailyAverage, 200 / 18);
});

test("closed-month comparison includes all 31 days of preceding month", () => {
  const result = analyze([entry("2026-08-31"), entry("2026-09-30", { amount: 200 })], "2026-09");
  assert.equal(result.previousSpend, 100);
  assert.equal(result.previousDays, 31);
  assert.equal(result.dailyAverage, 200 / 30);
});

test("year rollover and future periods are explicit", () => {
  assert.equal(analyze([entry("2025-12-31")], "2026-01").previousSpend, 100);
  const future = analyze(history(), "2026-11");
  assert.equal(future.currentSpend, 0);
  assert.equal(future.comparableDays, 0);
  assert.equal(future.change, null);
  assert.throws(() => analyze([], "2026-13"), /Invalid/);
});

test("hidden, unpaid, invalid and duplicate-ID rows do not inflate actual spending", () => {
  const result = analyze([
    entry("2026-10-10"), entry("2026-10-10"),
    entry("2026-10-11", { hidden: true }), entry("2026-10-12", { paid: false }),
    entry("2026-02-30"), entry("2026-10-13", { amount: NaN }), entry("2026-10-14", { amount: -5 }),
    entry("2026-10-15", { payment_type: "income", amount: 1000 }),
  ]);
  assert.equal(result.currentSpend, 100);
  assert.equal(result.currentIncome, 1000);
  assert.equal(result.invalidCount, 3);
});

test("Jerusalem calendar dates handle midnight and invalid rollover", () => {
  assert.equal(financeCalendarDate("2026-09-30T22:30:00Z"), "2026-10-01");
  assert.equal(financeCalendarDate("2026-10-31T22:30:00Z"), "2026-11-01");
  assert.equal(financeCalendarDate("2026-02-30T10:00:00Z"), null);
  assert.equal(financeCalendarDate("2026-02-28"), "2026-02-28");
  assert.equal(financeCalendarDate("not a date"), null);
});

test("currencies stay separate, legacy ILS is explicit and malformed currency is unknown", () => {
  const entries = [entry("2026-10-01", { amount: 10 }), entry("2026-10-02", { currency: " usd ", amount: 20 }), entry("2026-10-03", { currency: null, amount: 30 }), entry("2026-10-04", { currency: "???", amount: 40 })];
  assert.equal(analyze(entries).currentSpend, 40);
  assert.equal(analyze(entries, "2026-10", "USD").currentSpend, 20);
  assert.equal(analyze(entries, "2026-10", "UNKNOWN").currentSpend, 40);
  assert.equal(financeEntryCurrency({}), "ILS");
  assert.equal(financeEntryCurrency({ currency: "POINTS" }), "UNKNOWN");
  assert.match(formatFinanceMoney(20, "USD", "en-US"), /\$20/);
  assert.doesNotMatch(formatFinanceMoney(20, "UNKNOWN"), /₪/);
});

test("cent arithmetic, grouped categories, sources and merchants reconcile", () => {
  const result = analyze([entry("2026-10-01", { title: "Cafe", category: "אוכל", amount: 0.1 }), entry("2026-10-02", { title: "Grocer", category: "סופר", amount: 0.2 }), entry("2026-10-03", { title: "Other", category: null, amount: 10, source_channel: "manual" })]);
  assert.equal(result.currentSpend, 10.3);
  assert.equal(result.topCategories.find(group => group.name === "מזון").total, 0.3);
  assert.equal(result.cardTotals[0][1], 0.3);
  assert.equal(result.uncategorized, 1);
  assert.equal(analyze([entry("2026-08-01", { category: null })]).uncategorized, 0);
});

test("three consecutive monthly charges produce evidence and a next-date estimate", () => {
  const result = analyze(history()).recurring;
  assert.equal(result.length, 1);
  assert.equal(result[0].months, 3);
  assert.equal(result[0].nextExpectedDate, "2026-11-10");
  assert.deepEqual(result[0].historyIds.sort(), history().map(item => item.id).sort());
});

test("two months, gaps, duplicate-month visits and stale history are not subscriptions", () => {
  for (const entries of [history().slice(1), [entry("2026-07-10"), ...history().slice(1)], [...history(), entry("2026-09-11")], [entry("2026-04-10"), entry("2026-05-10"), entry("2026-06-10")]]) {
    assert.equal(analyze(entries).recurring.length, 0);
  }
});

test("recurring evidence isolates accounts, providers and currencies", () => {
  for (const field of ["account_external_id", "payment_method", "currency"]) {
    const entries = history();
    entries[1] = { ...entries[1], [field]: field === "currency" ? "USD" : "different" };
    assert.equal(analyze(entries).recurring.length, 0, field);
  }
  assert.equal(analyze(history({ account_external_id: null, account_last_four: null })).recurring.length, 0);
  assert.equal(analyze(history({ source_channel: "manual", account_external_id: null, account_last_four: null })).recurring.length, 0);
});

test("installments and bank card settlements never become subscription suggestions", () => {
  for (const overrides of [
    { installment_total: 12 }, { title: "רכישה תשלום 2 מתוך 12" }, { title: "Example installment" }, { recurring: true },
    { title: "כאל חיוב חודשי", source_channel: "bank", amount: 11000 },
  ]) assert.equal(analyze(history(overrides)).recurring.length, 0);
  assert.equal(analyze(history({ title: "כאל חיוב חודשי", source_channel: "bank", amount: 11000 })).currentSpend, 11000);
});

test("monthly dates must align; end-of-month charges survive February", () => {
  assert.equal(analyze([entry("2026-08-01"), entry("2026-09-15"), entry("2026-10-10")]).recurring.length, 0);
  const end = analyze([entry("2026-02-28"), entry("2026-03-31"), entry("2026-04-30")], "2026-04").recurring;
  assert.equal(end.length, 1);
  assert.equal(end[0].nextExpectedDate, "2026-05-31");
});

test("price increases are flagged against stable prior charges, random amounts are not", () => {
  const entries = history();
  entries[2].amount = 130;
  assert.equal(analyze(entries).recurring[0].increase, 30);
  assert.equal(analyze(entries).recurring[0].previousAmount, 100);
  entries[1].amount = 220;
  assert.equal(analyze(entries).recurring.length, 0);
});

function dashboardCallback(name, globals) {
  const source = readFileSync(new URL("../src/components/dashboards/PaymentDashboard.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("PaymentDashboard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      expression = node.initializer;
      if (ts.isCallExpression(expression)) expression = expression.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression, `Missing ${name}`);
  const javascript = ts.transpileModule(`const callback = ${expression.getText(tree)}; callback;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(javascript, globals);
}

test("actual recurring callback opens review before any database write; approval preserves original", async () => {
  const writes = [];
  let draft;
  const globals = {
    user: { id: "owner" }, payments: [], transactions: [], isRtl: true,
    financeEntryCurrency, financeCalendarDate, cleanMerchantName, format: () => "2026-11-10", nextMonthlyOccurrence: () => now,
    toast: { info() {}, success() {}, error() {} }, t: value => value,
    setRecurringReview: value => { draft = value; }, fetchFinanceData: async () => {},
    supabase: { from(table) { assert.equal(table, "payment_tracking"); return { async insert(value) { writes.push(value); return { error: null }; } }; } },
  };
  const callback = dashboardCallback("handleToggleRecurring", globals);
  const source = { ...entry("2026-10-10"), source: "cloud_financial_transactions", due_date: "2026-10-10" };
  assert.equal(await callback(source), false);
  assert.equal(draft.entryId, source.id);
  assert.equal(writes.length, 0);
  for (const invalidPlan of [{ amount: NaN, dueDate: "2026-11-11" }, { amount: 100, dueDate: "2026-02-30" }, { amount: 100, dueDate: "2000-01-01" }]) {
    assert.equal(await callback(source, invalidPlan), false);
  }
  assert.equal(await callback({ ...source, currency: "USD" }, { amount: 30, dueDate: "2026-11-11" }), false);
  assert.equal(writes.length, 0);
  assert.equal(await callback(source, { amount: 110, dueDate: "2026-11-11" }), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].user_id, "owner");
  assert.equal(writes[0].amount, 110);
  assert.equal(writes[0].due_date, "2026-11-11");
  assert.equal(writes[0].recurrence_source_transaction_id, source.id);
  assert.equal(writes[0].paid, false);
  assert.equal(source.amount, 100);
});

test("actual category drilldown resolves grouped categories and preserves currency scope", () => {
  const rows = [entry("2026-10-10", { category: "סופר" }), entry("2026-10-11", { category: "אוכל", currency: "USD" }), entry("2026-10-12", { category: "אוכל", paid: false })];
  const callback = dashboardCallback("filteredViewEntries", {
    dashboardEntries: rows, viewMonth: "2026-10", accountFilter: "all", categoryFilter: "מזון", sourceFilter: "all",
    transactionSearch: "", lang: "he", isRtl: true, showHidden: false, insightCurrencyFilter: "ILS",
    financeEntryCurrency, financeCalendarDate, getFinanceCategoryGroup,
  });
  assert.equal(callback().length, 1);
  assert.equal(callback()[0].id, "2026-10-10");
});

test("cloud list selects currency and installment evidence without exposing extra raw data", () => {
  const source = readFileSync(new URL("../supabase/functions/finance-scraper-connect/index.ts", import.meta.url), "utf8");
  const selects = [...source.matchAll(/\.select\("(id, amount,[^"]+)"\)/g)];
  assert.equal(selects.length, 2);
  for (const [, fields] of selects) {
    for (const field of ["currency", "installment_total", "source_connection_id"]) assert.ok(fields.split(", ").includes(field));
  }
  assert.match(source, /account_external_id/);
});

test("actual monthly history keeps foreign rows but does not label their total as ILS", () => {
  const callback = dashboardCallback("monthlyHistory", {
    dashboardEntries: [entry("2026-10-10", { amount: 100 }), entry("2026-10-11", { currency: "USD", amount: 20 })],
    financeEntryCurrency,
  });
  const [[month, result]] = callback();
  assert.equal(month, "2026-10");
  assert.equal(result.expenses, 100);
  assert.equal(result.items.length, 2);
});
