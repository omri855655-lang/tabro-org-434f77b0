import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual callbacks with fake services, never production data.
function callbackFromFile(path, name, globals) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      expression = node.initializer;
      if (ts.isCallExpression(expression) && expression.expression.getText(tree) === "useCallback") {
        expression = expression.arguments[0];
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression, `Missing callback ${name}`);
  const javascript = ts.transpileModule(`const callback = ${expression.getText(tree)}; callback;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(javascript, globals);
}

test("ordinary tasks omit optional columns; subtasks and colors are preserved", () => {
  const insert = callbackFromFile("../src/hooks/useTasks.ts", "mapTaskToDbInsert", {});
  const plain = insert({ description: "Test" }, "user-a", "personal", "2026");
  assert.equal(plain.user_id, "user-a");
  assert.equal(plain.description, "Test");
  assert.equal(Object.hasOwn(plain, "parent_task_id"), false);
  assert.equal(Object.hasOwn(plain, "text_color"), false);
  const child = insert({ parentTaskId: "parent", textColor: "#abcdef" }, "user-a", "work", "2026");
  assert.equal(child.parent_task_id, "parent");
  assert.equal(child.text_color, "#abcdef");
});

function financeHarness() {
  const state = { loading: false, unavailable: false, transactions: ["existing"], accounts: ["existing"] };
  let fail = true;
  const globals = {
    user: { id: "user-a" },
    console: { warn() {} },
    setLoading: (value) => { state.loading = value; },
    setFinanceUnavailable: (value) => { state.unavailable = value; },
    setPayments: () => {},
    setTransactions: (value) => { state.transactions = value; },
    setFinancialAccounts: (value) => { state.accounts = value; },
    transactionDisplayKey: (value) => value.id,
    supabase: {
      from() {
        const query = {
          select() { return query; },
          eq(column, value) { if (column === "user_id") assert.equal(value, "user-a"); return query; },
          order() { return query; },
          then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
        };
        return query;
      },
    },
    invokeFinanceBackend: async (action) => {
      assert.equal(action, "list");
      if (fail) throw new Error("Service unavailable");
      return { transactions: [{ id: "tx" }], accounts: [{ id: "account", current_balance: 125 }] };
    },
  };
  return {
    state,
    recover: () => { fail = false; },
    load: callbackFromFile("../src/components/dashboards/PaymentDashboard.tsx", "fetchFinanceData", globals),
  };
}

test("finance outage is not converted to an empty account or transaction list", async () => {
  const { state, load } = financeHarness();
  await load();
  assert.equal(state.unavailable, true);
  assert.equal(state.loading, false);
  assert.deepEqual(state.accounts, ["existing"]);
  assert.deepEqual(state.transactions, ["existing"]);
});

test("retry after recovery loads cloud data and clears the error", async () => {
  const { state, load, recover } = financeHarness();
  await load();
  recover();
  await load();
  assert.equal(state.unavailable, false);
  assert.equal(state.loading, false);
  assert.equal(state.accounts[0].current_balance, 125);
  assert.equal(state.transactions[0].id, "cloud:tx");
});
