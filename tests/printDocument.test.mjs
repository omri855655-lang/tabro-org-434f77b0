import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/printDocument.ts', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);

test('print report renders event text in an isolated document and escapes supplied HTML', () => {
  let html = '', printed = false, appended = false;
  const frame = { style: {}, contentDocument: { open() {}, write(value) { html = value; }, close() {} }, contentWindow: { addEventListener() {}, requestAnimationFrame(fn) { fn(); }, focus() {}, print() { printed = true; } }, remove() {} };
  globalThis.document = { createElement: () => frame, body: { append() { appended = true; } } };
  try {
    module.printDocument('יומן', ['אירוע', 'פרטים'], [['פגישה', '<script>alert(1)</script>']]);
    assert.ok(appended && printed);
    assert.ok(html.includes('פגישה'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('visibility:hidden'));
  } finally { delete globalThis.document; }
});

test('print report respects selected language, direction and escaped empty-state text', () => {
  let html = '';
  const frame = { style: {}, contentDocument: { open() {}, write(value) { html = value; }, close() {} }, contentWindow: { addEventListener() {}, requestAnimationFrame(fn) { fn(); }, focus() {}, print() {} }, remove() {} };
  globalThis.document = { createElement: () => frame, body: { append() {} } };
  try {
    module.printDocument('Plan', ['Task'], [], '', { lang: 'es', dir: 'ltr', emptyMessage: '<Empty>' });
    assert.ok(html.includes('lang="es" dir="ltr"'));
    assert.ok(html.includes('&lt;Empty&gt;'));
    assert.ok(!html.includes('<Empty>'));
  } finally { delete globalThis.document; }
});
