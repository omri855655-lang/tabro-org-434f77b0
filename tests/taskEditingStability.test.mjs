import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import * as refreshPolicy from '../src/lib/dashboardRefresh.ts';

const source = fs.readFileSync(new URL("../src/hooks/useTasks.ts", import.meta.url), "utf8");
function setup(client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), userId = 'user') {
  const effects = [], requests = [];
  let realtime, observer, unsubscribe;
  const fakeReact = {
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect(fn) { effects.push(fn); },
  };
  const chain = {
    select() { return chain; }, eq() { return chain; }, order() { return chain; }, abortSignal() { return chain; },
    then(resolve, reject) { return new Promise(done => requests.push(done)).then(resolve, reject); },
  };
  const channel = { on(_event, _filter, callback) { realtime = callback; return channel; }, subscribe() { return channel; } };
  const exports = {};
  const imports = {
    react: fakeReact,
    '@/lib/dashboardRefresh': refreshPolicy,
    '@tanstack/react-query': {useQueryClient: () => client, useQuery(options) {
      observer = new QueryObserver(client, options); unsubscribe = observer.subscribe(() => {}); return observer.getCurrentResult();
    }},
    "@/integrations/supabase/client": { supabase: { from: () => chain, channel: () => channel, removeChannel() {} } },
    "@/hooks/useAuth": { useAuth: () => ({ user: { id: userId } }) },
    "@/hooks/useActivityEvents": { useActivityEvents: () => ({ reportActivity() {} }) },
    sonner: { toast: { error() {} } },
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => imports[name], console, Date });
  const hook = exports.useTasks("personal");
  const flush = () => new Promise(resolve => setImmediate(resolve));
  effects.forEach(effect => effect());
  return { hook, result: () => observer.getCurrentResult(), client, unsubscribe, requests, flush, refresh: () => realtime() };
}

test("realtime refresh retains the mounted task table instead of showing a loading screen", async () => {
  const app = setup();
  await app.flush();
  assert.equal(app.result().isLoading, true);
  app.requests.shift()({ data: [], error: null });
  await app.flush();
  assert.equal(app.result().isLoading, false);
  app.refresh();
  await app.flush();
  assert.equal(app.result().isLoading, false);
  app.requests.shift()({ data: [], error: null });
  await app.flush();
  assert.equal(app.result().isLoading, false);
  app.unsubscribe(); app.client.clear();
});

test("out-of-order refresh responses cannot restore stale task values", async () => {
  const app = setup();
  await app.flush(); app.requests.shift()({data: [], error: null}); await app.flush();
  const first = app.hook.refetch(); await app.flush(); const second = app.hook.refetch();
  await app.flush();
  app.requests[1]({ data: [{ id: "latest", description: "New draft", status: "טרם החל" }], error: null });
  await second;
  app.requests[0]({ data: [{ id: "stale", description: "Old draft", status: "טרם החל" }], error: null });
  await first;
  assert.equal(app.result().data[0].id, "latest");
  app.unsubscribe(); app.client.clear();
});

test('returning to a fresh board reuses rows, a stale board refreshes in background, another account starts empty', async () => {
  const a = setup(); await a.flush(); a.requests.shift()({data:[{id:'first'}],error:null}); await a.flush(); a.unsubscribe();
  const b = setup(a.client); await b.flush(); assert.equal(b.requests.length,0); assert.equal(b.result().data[0].id,'first'); b.unsubscribe();
  const key = a.client.getQueryCache().getAll()[0].queryKey;
  a.client.setQueryData(key, b.result().data, {updatedAt: Date.now()-refreshPolicy.FIVE_MINUTES-1});
  const c = setup(a.client); await c.flush(); assert.equal(c.requests.length,1); assert.equal(c.result().isLoading,false); c.unsubscribe();
  const d = setup(a.client,'other'); await d.flush(); assert.equal(d.result().data,undefined); assert.equal(d.requests.length,1); d.unsubscribe(); a.client.clear();
});

test("cell editors have stable component identities and ignore blur after Enter or Escape", () => {
  const table = fs.readFileSync(new URL("../src/components/TaskSpreadsheetDb.tsx", import.meta.url), "utf8");
  const parent = table.indexOf("const TaskSpreadsheetDb =");
  assert.ok(table.indexOf("const EditableCellWithSuggestions =") < parent);
  assert.ok(table.indexOf("const EditableCellInput =") < parent);
  assert.equal((table.slice(0, parent).match(/const settled = useRef\(false\)/g) || []).length, 2);
  assert.match(table, /key=\{\x60\$\{taskId\}:\$\{field\}\x60\}/);
});
