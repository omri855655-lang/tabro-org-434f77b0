import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { assertFinanceListResponse, withFinanceReadTimeout } from "../src/lib/financeRequest.ts";
import { isModuleLoadFailure } from "../src/lib/moduleRecovery.ts";

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
  const state = { loading: false, refreshing: false, unavailable: false, transactions: ["existing"], accounts: ["existing"] };
  let fail = true;
  const globals = {
    user: { id: "user-a" },
    console: { warn() {} },
    setLoading: (value) => { state.loading = value; },
    setRefreshingFinance: value => { state.refreshing = value; },
    withFinanceReadTimeout,
    setFinanceUnavailable: (value) => { state.unavailable = value; },
    setPayments: () => {},
    setCsvCardSources: () => {},
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

test("read deadlines reject stalled requests without waiting forever", async () => {
  await assert.rejects(withFinanceReadTimeout(new Promise(() => {}), 5), /FINANCE_READ_TIMEOUT/);
  assert.equal(await withFinanceReadTimeout(Promise.resolve(7), 100), 7);
  await assert.rejects(withFinanceReadTimeout(Promise.reject(new Error("read failed")), 100), /read failed/);
});

test("a missing or malformed list is never presented as an empty financial account", () => {
  for (const value of [null, {}, [], { accounts: [], transactions: [] }, { accounts: {}, transactions: [], connections: [] }, { accounts: [null], transactions: [], connections: [] }]) {
    assert.throws(() => assertFinanceListResponse(value), /INVALID_FINANCE_RESPONSE/);
  }
  assert.doesNotThrow(() => assertFinanceListResponse({ accounts: [], transactions: [], connections: [] }));
});

function connectorHarness() {
  const state = { loading: false, providers: {}, connections: ["saved"], unavailable: false, connectionError: false, changed: 0 };
  const invocations = [];
  let status = "syncing";
  let failed = false;
  const load = callbackFromFile("../src/components/dashboards/CloudFinanceConnector.tsx", "load", {
    setLoading: value => { state.loading = value; },
    setProviders: value => { state.providers = value; },
    setConnections: value => { state.connections = value; },
    setServiceUnavailable: value => { state.unavailable = value; },
    setConnectionsUnavailable: value => { state.connectionError = value; },
    previousConnections: { current: [] },
    onChanged: async () => { state.changed += 1; },
    console: { warn() {} },
    invoke: async action => {
      invocations.push(action);
      if (action === "providers") return { providers: { max: { name: "MAX", fields: ["username", "password"] } } };
      if (action === "list") {
        if (failed) throw new Error("Network down");
        return { connections: [{ id: "test", status }] };
      }
      throw new Error("Worker health must not gate saved-data reads");
    },
  });
  return { state, invocations, load, complete: () => { status = "active"; }, fail: () => { failed = true; } };
}

test("connection status reads do not wait for worker health or submit credentials", async () => {
  const { state, invocations, load } = connectorHarness();
  await load();
  assert.deepEqual(invocations, ["providers", "list"]);
  assert.equal(state.connections[0].status, "syncing");
  assert.equal(state.unavailable, false);
  assert.equal(state.connectionError, false);
});

test("polling a completed background MAX sync refreshes the ledger once", async () => {
  const { state, load, complete } = connectorHarness();
  await load(); complete(); await load(true); await load(true);
  assert.equal(state.changed, 1);
  assert.equal(state.connections[0].status, "active");
});

test("a failed connection-list refresh keeps prior records and marks status unknown", async () => {
  const { state, load, fail } = connectorHarness();
  await load(); fail(); await load();
  assert.equal(state.connections[0].id, "test");
  assert.equal(state.connectionError, true);
  assert.equal(state.unavailable, false);
  assert.equal(state.loading, false);
});

test("cached lazy-import errors are distinguished from ordinary rendering failures", () => {
  assert.equal(isModuleLoadFailure(new TypeError("Failed to fetch dynamically imported module: https://example.test/assets/PaymentDashboard-old.js")), true);
  assert.equal(isModuleLoadFailure(new Error("Importing a module script failed.")), true);
  assert.equal(isModuleLoadFailure(new Error("Invalid time value")), false);
  assert.equal(isModuleLoadFailure(new Error("Bank password rejected")), false);
});

test("actual panel retry reloads a failed lazy module rather than reusing its cached rejection", () => {
  const source = readFileSync(new URL("../src/components/WorkspacePanelBoundary.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("boundary.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onClick" && node.initializer?.expression?.getText(tree).includes("moduleFailure")) handler = node.initializer.expression.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(handler);
  let reloads = 0;
  let resets = 0;
  const create = vm.runInNewContext(`(function () { return ${handler}; })`, { window: { location: { reload() { reloads += 1; } } } });
  create.call({ state: { moduleFailure: true }, setState() { resets += 1; } })();
  assert.equal(reloads, 1);
  assert.equal(resets, 0);
  create.call({ state: { moduleFailure: false }, setState() { resets += 1; } })();
  assert.equal(resets, 1);
  assert.equal(reloads, 1);
});
