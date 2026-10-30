import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PUBLIC_APP_ORIGIN } from "../src/lib/publicSite.ts";

test("public task, project and Gantt links always use the primary Tabro domain", () => {
  assert.equal(PUBLIC_APP_ORIGIN, "https://tabro.org");
  for (const file of ["PublicTaskIntakeLink.tsx", "projects/ProjectTaskIntakeLink.tsx", "projects/ProjectGanttShareLink.tsx"]) {
    const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), "utf8");
    assert.match(source, /\$\{PUBLIC_APP_ORIGIN\}/);
    assert.doesNotMatch(source, /window\.location\.origin/);
  }
});

test("finance CORS supports both owned domains and rejects lookalike origins", () => {
  const source = readFileSync(new URL("../supabase/functions/finance-scraper-connect/index.ts", import.meta.url), "utf8");
  const headersOnly = source.slice(source.indexOf("const allowedOrigins"), source.indexOf("const providers"));
  const context = {};
  vm.runInNewContext(ts.transpileModule(headersOnly, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const headers = origin => context.responseHeaders(new Request("https://example.test", { headers: { Origin: origin } }));
  for (const origin of ["https://tabro.org", "https://www.tabro.org", "https://omrigabayexcel.site", "https://www.omrigabayexcel.site"]) {
    assert.equal(headers(origin)["Access-Control-Allow-Origin"], origin);
    assert.equal(headers(origin).Vary, "Origin");
    assert.equal(headers(origin)["Cache-Control"], "no-store");
  }
  for (const origin of ["https://tabro.org.evil.test", "https://evil.test", "http://tabro.org", "null"]) {
    assert.notEqual(headers(origin)["Access-Control-Allow-Origin"], origin);
    assert.notEqual(headers(origin)["Access-Control-Allow-Origin"], "*");
  }
});
