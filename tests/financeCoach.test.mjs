import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { buildFinanceCoach, canConfirmFinanceRefund } from "../src/lib/financeCoach.ts";
import { getFinanceCategoryGroup } from "../src/lib/financeCategorization.ts";
import { formatFinanceMoney, financeEntryCurrency } from "../src/lib/financeInsights.ts";

const now = new Date("2026-10-19T09:00:00Z");
const entry = (id, overrides = {}) => ({ id, title: "Shop", amount: 100, currency: "ILS", category: "קניות", subcategory: "קניות אונליין",
  payment_type: "expense", source_channel: "credit_card", account_label: "Amex", account_last_four: "1234",
  account_external_id: "csv-card:a", payment_method: "amex", created_at: "2026-10-01", recurring: false, paid: true, ...overrides });
const credit = (id, overrides = {}) => entry(id, { payment_type: "income", amount: 20, created_at: "2026-10-10", statement_credit: true, category: "החזר", ...overrides });
const analyze = (entries, month = "2026-10", currency = "ILS") => buildFinanceCoach(entries, month, currency, now);

test("a unique same-card merchant purchase is suggested, not persisted or treated as confirmed", () => {
  const entries = [entry("p"), credit("r")];
  const result = analyze(entries);
  assert.equal(result.grossSpend, 100);
  assert.equal(result.refundsTotal, 20);
  assert.equal(result.netSpend, 80);
  assert.equal(result.realIncome, 0);
  assert.equal(result.refunds[0].status, "suggested");
  assert.equal(result.refunds[0].expense.id, "p");
  assert.equal(result.unresolvedCount, 1);
  assert.equal(result.netCategories[0].amount, 100);
  assert.deepEqual(result.scenarioCategories, []);
  assert.equal(entries[1].refund_expense_id, undefined);
  assert.equal(canConfirmFinanceRefund(entries, "r", { expenseId: "p" }, now), true);
});

test("confirmed partial refunds reduce the original category without changing either amount", () => {
  const entries = [entry("p"), credit("r", { refund_expense_id: "p" }), entry("salary", { payment_type: "income", statement_credit: false, amount: 1000 })];
  const result = analyze(entries);
  assert.equal(result.realIncome, 1000);
  assert.equal(result.netCategories[0].amount, 80);
  assert.equal(result.scenarioCategories[0].amount, 80);
  assert.equal(result.unresolvedCount, 0);
  assert.equal(entries[0].amount, 100);
  assert.equal(entries[1].amount, 20);
});

test("full refunds and several valid partial credits never leave a fictitious savings opportunity", () => {
  const full = analyze([entry("p"), credit("r", { amount: 100, refund_expense_id: "p" })]);
  assert.equal(full.netSpend, 0);
  assert.equal(full.netCategories[0].amount, 0);
  assert.deepEqual(full.scenarioCategories, []);
  const partials = analyze([entry("p"), credit("r1", { amount: 20, refund_expense_id: "p" }), credit("r2", { amount: 30, refund_expense_id: "p" })]);
  assert.equal(partials.netSpend, 50);
  assert.equal(partials.netCategories[0].amount, 50);
  assert.equal(partials.unresolvedCount, 0);
});

test("credits are cash movements in the month received, including negative net categories", () => {
  const entries = [entry("p", { created_at: "2026-09-01" }), credit("r", { refund_expense_id: "p" })];
  assert.equal(analyze(entries).netSpend, -20);
  assert.equal(analyze(entries).netCategories[0].amount, -20);
  assert.equal(analyze(entries, "2026-09").netSpend, 100);
  assert.equal(analyze(entries, "2026-09").refundsTotal, 0);
  assert.deepEqual(analyze(entries).scenarioCategories, []);
});

test("ambiguous purchases, unrelated merchants, later purchases and old history are not guessed", () => {
  for (const entries of [
    [entry("a"), entry("b"), credit("r")],
    [entry("p", { title: "Different merchant" }), credit("r")],
    [entry("p", { created_at: "2026-10-11" }), credit("r")],
    [entry("p", { created_at: "2026-01-01" }), credit("r")],
  ]) {
    assert.equal(analyze(entries).refunds[0].status, "unmatched");
    assert.equal(canConfirmFinanceRefund(entries, "r", { expenseId: entries[0].id }, now), false);
  }
});

test("account, provider, currency and missing identity prevent cross-account matches", () => {
  for (const overrides of [{ account_external_id: "b" }, { payment_method: "cal" }, { currency: "USD" }, { account_external_id: null }]) {
    assert.equal(analyze([entry("p", overrides), credit("r")]).refunds[0].status, "unmatched");
  }
  const result = analyze([entry("p"), credit("r", { currency: "USD" })], "2026-10", "USD");
  assert.equal(result.grossSpend, 0);
  assert.equal(result.netSpend, -20);
});

test("multiple partial refunds cannot be confirmed beyond the purchase amount", () => {
  const entries = [entry("p"), credit("r1", { amount: 70, refund_expense_id: "p" }), credit("r2", { amount: 40 })];
  assert.equal(canConfirmFinanceRefund(entries, "r2", { expenseId: "p" }, now), false);
  assert.equal(analyze(entries).refunds.find(item => item.credit.id === "r2").status, "unmatched");
  entries[2].refund_expense_id = "p";
  assert.equal(analyze(entries).unresolvedCount, 1);
});

test("explicit category confirmation works without pretending an original purchase was identified", () => {
  const entries = [entry("p", { title: "Another shop" }), credit("r", { refund_category: "קניות" })];
  const result = analyze(entries);
  assert.equal(result.refunds[0].status, "categorized");
  assert.equal(result.refunds[0].expense, undefined);
  assert.equal(result.netCategories[0].amount, 80);
  assert.equal(result.scenarioCategories[0].amount, 80);
  assert.equal(canConfirmFinanceRefund([credit("r")], "r", { category: "קניות" }, now), true);
  assert.equal(canConfirmFinanceRefund([credit("r")], "r", { category: "החזר" }, now), false);
});

test("clearing a reviewed link is allowed but unclassified records have nothing to clear", () => {
  const linked = [entry("p"), credit("r", { refund_expense_id: "p" })];
  assert.equal(canConfirmFinanceRefund(linked, "r", { clear: true }, now), true);
  assert.equal(canConfirmFinanceRefund([credit("r")], "r", { clear: true }, now), false);
  linked[1].refund_expense_id = null;
  assert.equal(analyze(linked).unresolvedCount, 1);
  assert.equal(analyze(linked).netCategories[0].amount, 100);
});

test("income titles are never sufficient evidence of a card refund", () => {
  const result = analyze([entry("p"), credit("salary", { title: "refund", statement_credit: false, amount: 1000 })]);
  assert.equal(result.realIncome, 1000);
  assert.equal(result.refundsTotal, 0);
});

test("hidden, unpaid, invalid, duplicated and future entries are excluded", () => {
  const entries = [entry("p"), entry("p"), credit("hidden", { hidden: true }), credit("unpaid", { paid: false }),
    credit("bad", { created_at: "2026-02-31" }), credit("future", { created_at: "2026-10-20" }), credit("nan", { amount: NaN })];
  const result = analyze(entries);
  assert.equal(result.grossSpend, 100);
  assert.equal(result.refundsTotal, 0);
  assert.equal(canConfirmFinanceRefund(entries, "hidden", { category: "קניות" }, now), false);
});

test("essential spending and installment commitments are not savings scenarios", () => {
  for (const overrides of [{ category: "בריאות", subcategory: "טיפול" }, { category: "בריאות", subcategory: "קניות" }, { category: "חינוך", subcategory: "תואר" },
    { category: "דיור", subcategory: "שכירות" }, { category: "ביטוחים", subcategory: "ביטוחים" }, { installment_total: 3 }, { recurring: true }]) {
    assert.deepEqual(analyze([entry("p", overrides)]).scenarioCategories, []);
  }
});

test("possible settlement overlap, unknown currency or missing categorization blocks monetary scenarios", () => {
  assert.deepEqual(analyze([entry("p"), entry("bank", { title: "כאל חיוב חודשי", source_channel: "bank" })]).scenarioCategories, []);
  assert.deepEqual(analyze([entry("p", { category: "אחר" })]).scenarioCategories, []);
  assert.deepEqual(analyze([entry("p", { currency: "???" })], "2026-10", "UNKNOWN").scenarioCategories, []);
});

test("cent arithmetic reconciles net total with confirmed and unclassified category amounts", () => {
  const result = analyze([entry("p", { amount: 0.3 }), credit("r", { amount: 0.1, refund_expense_id: "p" }), credit("u", { amount: 0.05, title: "Unknown" })]);
  assert.equal(result.netSpend, 0.15);
  assert.equal(result.netCategories[0].amount, 0.2);
  assert.equal(result.refundsTotal, 0.15);
});

function actualCallback(name, globals) {
  const source = readFileSync(new URL("../src/components/dashboards/PaymentDashboard.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("dashboard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression);
  return vm.runInNewContext(ts.transpileModule(`const callback = ${expression.getText(tree)}; callback;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, globals);
}

function confirmationHarness({ accept = true, fail = false, empty = false } = {}) {
  let writes = 0;
  let updated = false;
  let update;
  const entries = [entry("p", { source: "financial_transactions" }), credit("r", { source: "financial_transactions" })];
  const filters = {};
  return {
    entries, state: () => ({ writes, updated, update, filters }),
    confirm: actualCallback("confirmRefundClassification", {
      user: { id: "user-a" }, dashboardEntries: entries,
      canConfirmFinanceRefund: (items, id, selection) => canConfirmFinanceRefund(items, id, selection, now),
      transactions: [{ id: "r", raw_data: { statement_credit: true, billing_date: "2026-11-02", account_external_id: "csv-card:a" } }],
      getFinanceCategoryGroup, formatFinanceMoney, financeEntryCurrency, isRtl: true, window: { confirm: () => accept },
      setTransactions: () => { updated = true; }, toast: { success() {} },
      supabase: { from(table) { assert.equal(table, "financial_transactions"); return { update(value) { writes++; update = value; const query = {
        eq(key, value) { filters[key] = value; return query; }, async select() { return { data: empty ? [] : [{ id: "r" }], error: fail ? new Error("failure") : null }; },
      }; return query; } }; } },
    }),
  };
}

test("actual confirmation writes only metadata after user approval and scopes the write to its owner", async () => {
  const h = confirmationHarness();
  await h.confirm("r", { expenseId: "p" });
  const result = h.state();
  assert.equal(result.writes, 1);
  assert.equal(result.updated, true);
  assert.equal(result.filters.user_id, "user-a");
  assert.equal(result.filters.id, "r");
  assert.deepEqual(Object.keys(result.update), ["raw_data"]);
  assert.equal(result.update.raw_data.refund_expense_id, "p");
  assert.equal(result.update.raw_data.billing_date, "2026-11-02");
  assert.equal(result.update.raw_data.statement_credit, true);
});

test("cancelled, invalid, rejected or zero-row confirmation never changes local records", async () => {
  const cancelled = confirmationHarness({ accept: false });
  await cancelled.confirm("r", { expenseId: "p" });
  assert.equal(cancelled.state().writes, 0);
  for (const options of [{ fail: true }, { empty: true }]) {
    const h = confirmationHarness(options);
    await assert.rejects(h.confirm("r", { expenseId: "p" }));
    assert.equal(h.state().updated, false);
  }
  const h = confirmationHarness();
  await assert.rejects(h.confirm("r", { expenseId: "different" }));
  assert.equal(h.state().writes, 0);
});

test("actual clear action removes only classification metadata, preserving dates and amounts", async () => {
  const h = confirmationHarness();
  h.entries[1].refund_expense_id = "p";
  await h.confirm("r", { clear: true });
  const result = h.state();
  assert.equal(result.update.raw_data.refund_expense_id, null);
  assert.equal(result.update.raw_data.refund_category, null);
  assert.equal(result.update.raw_data.billing_date, "2026-11-02");
  assert.deepEqual(Object.keys(result.update), ["raw_data"]);
});

test("actual AI chat receives a scoped refund-aware aggregate, not card IDs or merchant history", async () => {
  let request;
  const send = actualCallback("sendAiMessage", {
    dashboardEntries: [entry("private-purchase-id", { title: "Private merchant" }), credit("private-refund-id", { title: "Private merchant", refund_expense_id: "private-purchase-id" })],
    viewMonth: "2026-10", lang: "he", buildFinanceCoach: (entries, month, currency) => buildFinanceCoach(entries, month, currency, now),
    aiChatHistory: { messages: [], setMessages() {} }, setAiLoading() {}, t: () => "Error",
    supabase: { functions: { async invoke(name, input) { assert.equal(name, "task-ai-helper"); request = input.body; return { data: { suggestion: "Test" }, error: null }; } } },
  });
  await send("איך אפשר לחסוך?");
  assert.ok(request);
  assert.match(request.customPrompt, /"recordedNetSpending":80/);
  assert.match(request.customPrompt, /"recordedIncomeExcludingCardRefunds":0/);
  assert.doesNotMatch(request.customPrompt, /private-purchase-id|private-refund-id|Private merchant|csv-card:a|1234/);
});
