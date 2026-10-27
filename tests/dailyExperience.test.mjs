import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pickLearningTopic, learningDrawCopy } from '../src/lib/learningDraw.ts';
import { LEARNING_PATHS, learningLabels } from '../src/lib/learningCopy.ts';
import { mealTextPrompt, parseMealTextResult, mealTextCopy } from '../src/lib/mealTextEstimate.ts';
import { safeLocalStorage } from '../src/lib/safeLocalStorage.ts';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const food = { name: 'Example food', grams: 100, calories: 120, protein: 5, carbs: 20, fat: 2 };

test('random selection picks an actual category and its subtopic, including endpoints', () => {
  for (const value of [0, 0.2, 0.5, 0.999999, 1]) {
    const topic = pickLearningTopic(LEARNING_PATHS, () => value);
    assert.ok(LEARNING_PATHS[topic.category].includes(topic.subtopic));
  }
  assert.throws(() => pickLearningTopic({ empty: [] }));
});

test('food estimation requires bounded text, uses portions and never promises verified label data', () => {
  for (const lang of Object.keys(mealTextCopy)) {
    const prompt = mealTextPrompt('2 ביצים and bread', lang);
    assert.ok(prompt.includes(JSON.stringify('2 ביצים and bread')));
    assert.match(prompt, /ENTIRE described portion, NOT per 100g/);
    assert.match(prompt, /No diet or medical advice/);
    assert.match(prompt, /Never claim verified/);
    assert.equal(mealTextCopy[lang].length, 7);
    assert.equal(learningDrawCopy[lang].length, 2);
    assert.ok(mealTextCopy[lang].every(Boolean));
  }
  for (const text of ['', '  ', 'x'.repeat(1501)]) assert.throws(() => mealTextPrompt(text, 'he'));
});

test('food JSON must include a positive portion and assumptions, and rejects malformed quantities', () => {
  const meal = { title: 'Draft', assumptions: 'An estimated 100g portion; check the label.', items: [food] };
  assert.deepEqual(parseMealTextResult('```json\n' + JSON.stringify(meal) + '\n```'), meal);
  for (const input of ['invalid', '{}', JSON.stringify({ ...meal, assumptions: '' }), JSON.stringify({ ...meal, items: [{ ...food, grams: 0 }] }), JSON.stringify({ ...meal, items: [{ ...food, calories: -10 }] })]) {
    assert.throws(() => parseMealTextResult(input));
  }
});

test('storage privacy restrictions do not crash the guide or dashboard', () => {
  const previous = globalThis.window;
  globalThis.window = Object.defineProperty({}, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  try {
    assert.equal(safeLocalStorage.getJSON('guide', false), false);
    assert.doesNotThrow(() => safeLocalStorage.setJSON('guide', true));
    assert.doesNotThrow(() => safeLocalStorage.remove('guide'));
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

const nativeRequire = createRequire(import.meta.url);
function loadComponent(file, mocks, globals = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require: id => mocks[id] || nativeRequire(id), ...globals });
  return module.exports;
}

test('guide sections start compact, restore owner-scoped state and retain hidden content', () => {
  const stored = new Map();
  const reads = [];
  const { ZoneFlowGuide } = loadComponent('src/components/zoneflow/ZoneFlowGuide.tsx', {
    '@/hooks/useLanguage': { useLanguage: () => ({ lang: 'en' }) },
    '@/lib/safeLocalStorage': { safeLocalStorage: { getJSON: (key, fallback) => { reads.push(key); return stored.get(key) ?? fallback; }, setJSON: (key, value) => stored.set(key, value) } },
  });
  const render = userId => renderToStaticMarkup(React.createElement(ZoneFlowGuide, { userId, id: 'sleep', title: 'Sleep' }, 'Preserved guide content'));
  assert.doesNotMatch(render('a'), /Preserved guide content/);
  stored.set('zoneflow-guide:v1:a:sleep', true);
  assert.match(render('a'), /Preserved guide content/);
  assert.doesNotMatch(render('b'), /Preserved guide content/);
  stored.set('zoneflow-guide:v1:a:sleep', 'malformed');
  assert.doesNotMatch(render('a'), /Preserved guide content/);
  assert.ok(reads.includes('zoneflow-guide:v1:b:sleep'));
});

test('reduced-motion draw renders the actual winner in an accessible status', () => {
  const { LearningTopicDraw } = loadComponent('src/components/zoneflow/LearningTopicDraw.tsx', {
    '@/lib/learningCopy': { LEARNING_PATHS, learningLabels }, '@/lib/learningDraw': { learningDrawCopy },
  }, { window: { matchMedia: () => ({ matches: true }) } });
  const topic = pickLearningTopic(LEARNING_PATHS, () => 0);
  const html = renderToStaticMarkup(React.createElement(LearningTopicDraw, { ...topic, lang: 'en' }));
  assert.match(html, /role="status"/);
  assert.ok(html.includes(learningLabels('en', topic.category, topic.subtopic).subtopic));
  assert.match(html, /Your selected topic/);
});

test('meal estimation is a draft only, and all five main guide groups remain available', () => {
  const estimator = source('src/components/dashboards/MealTextEstimator.tsx');
  assert.doesNotMatch(estimator, /saveMeals|\.insert\(|\.upsert\(/);
  assert.match(estimator, /controller\.signal\.aborted/);
  const journal = source('src/components/dashboards/MealPhotoJournal.tsx');
  assert.match(journal, /<fieldset disabled=\{busy\}/);
  const dashboard = source('src/components/zoneflow/ZoneFlowDashboard.tsx');
  for (const id of ['morning', 'work', 'sleep', 'nutrition', 'short']) assert.ok(dashboard.includes(`<ZoneFlowGuide id="${id}"`));
});

test('statement mismatch confirmation is enforced before any import request and reset with each file', () => {
  const importer = source('src/components/dashboards/CreditCardImport.tsx');
  assert.match(importer, /importPending\.current \|\| mismatchNeedsReview\) return/);
  assert.match(importer, /setAcceptMismatch\(false\)/);
  assert.match(importer, /reconciliation\.some\(check => !check.matches\) && !acceptMismatch/);
});
