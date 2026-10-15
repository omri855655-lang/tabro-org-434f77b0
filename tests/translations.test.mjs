import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

test('all six shared dictionaries cover the same keys after complements', async () => {
  const source = ts.createSourceFile('useLanguage.tsx', fs.readFileSync(new URL('../src/hooks/useLanguage.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let dictionaries;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'translations') dictionaries = node.initializer.expression;
    ts.forEachChild(node, visit);
  }
  visit(source);
  const keys = Object.fromEntries(dictionaries.properties.map(language => [language.name.getText(source), language.initializer.properties.map(p => p.name.getText(source))]));
  const supplements = fs.readFileSync(new URL('../src/lib/translationComplements.ts', import.meta.url), 'utf8');
  const { translationComplements } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(supplements, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`);
  for (const [lang, entries] of Object.entries(keys)) {
    const available = new Set([...entries, ...Object.keys(translationComplements[lang] || {})]);
    assert.deepEqual(keys.he.filter(key => !available.has(key)), [], lang);
  }
});
