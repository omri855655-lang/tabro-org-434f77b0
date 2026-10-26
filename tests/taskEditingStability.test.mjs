import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/hooks/useTasks.ts", import.meta.url), "utf8");
function setup() {
  const states = [], effects = [], requests = [];
  let stateIndex = 0, realtime;
  const fakeReact = {
    useState(initial) { const index = stateIndex++; states[index] = initial; return [initial, next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
    useRef(value) { return { current: value }; },
    useCallback(fn) { return fn; },
    useEffect(fn) { effects.push(fn); },
  };
  const chain = {
    select() { return chain; }, eq() { return chain; }, order() { return chain; },
    then(resolve, reject) { return new Promise(done => requests.push(done)).then(resolve, reject); },
  };
  const channel = { on(_event, _filter, callback) { realtime = callback; return channel; }, subscribe() { return channel; } };
  const exports = {};
  const imports = {
    react: fakeReact,
    "@/integrations/supabase/client": { supabase: { from: () => chain, channel: () => channel, removeChannel() {} } },
    "@/hooks/useAuth": { useAuth: () => ({ user: { id: "user" } }) },
    "@/hooks/useActivityEvents": { useActivityEvents: () => ({ reportActivity() {} }) },
    sonner: { toast: { error() {} } },
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => imports[name], console, Date });
  const hook = exports.useTasks("personal");
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { hook, states, effects, requests, flush, refresh: () => realtime() };
}

test("realtime refresh retains the mounted task table instead of showing a loading screen", async () => {
  const app = setup();
  app.effects[0]();
  app.effects[1]();
  await app.flush();
  assert.equal(app.states[1], true);
  app.requests.shift()({ data: [], error: null });
  await app.flush();
  assert.equal(app.states[1], false);
  app.refresh();
  await app.flush();
  assert.equal(app.states[1], false);
  app.requests.shift()({ data: [], error: null });
  await app.flush();
  assert.equal(app.states[1], false);
});

test("out-of-order refresh responses cannot restore stale task values", async () => {
  const app = setup();
  const first = app.hook.refetch(), second = app.hook.refetch();
  await app.flush();
  app.requests[1]({ data: [{ id: "latest", description: "New draft", status: "טרם החל" }], error: null });
  await second;
  app.requests[0]({ data: [{ id: "stale", description: "Old draft", status: "טרם החל" }], error: null });
  await first;
  assert.equal(app.states[0][0].id, "latest");
});

test("cell editors have stable component identities and ignore blur after Enter or Escape", () => {
  const table = fs.readFileSync(new URL("../src/components/TaskSpreadsheetDb.tsx", import.meta.url), "utf8");
  const parent = table.indexOf("const TaskSpreadsheetDb =");
  assert.ok(table.indexOf("const EditableCellWithSuggestions =") < parent);
  assert.ok(table.indexOf("const EditableCellInput =") < parent);
  assert.equal((table.slice(0, parent).match(/const settled = useRef\(false\)/g) || []).length, 2);
  assert.match(table, /key=\{\x60\$\{taskId\}:\$\{field\}\x60\}/);
});
