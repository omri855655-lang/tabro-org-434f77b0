import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { togetherCopy } from '../src/lib/togetherCopy.ts';
import { focusRoomCopy } from '../src/lib/focusRoomCopy.ts';
import { clampRoomPosition } from '../src/lib/focusRoom.ts';

const require = createRequire(import.meta.url);
const element = tag => ({ children, onValueChange: _onValueChange, ...props }) => React.createElement(tag, props, children);

function loadComponent(filename, tab = 'rooms') {
  const source = fs.readFileSync(new URL(`../src/components/zoneflow/${filename}.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    if (name === 'react') return { ...React, useState: initial => React.useState(initial === 'rooms' ? tab : initial) };
    if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ lang: 'he', dir: 'rtl' }) };
    if (name === '@/hooks/useAuth') return { useAuth: () => ({ user: null }) };
    if (name === '@/hooks/useZoneFlowRewards') return { useZoneFlowRewards: () => ({ balance: 12 }) };
    if (name === '@/hooks/useActivityEvents') return { useActivityEvents: () => ({ reportActivity: async () => ({ awardedPoints: 0 }) }) };
    if (name === '@/integrations/supabase/client') return { supabase: {} };
    if (name === '@/lib/safeLocalStorage') return { safeLocalStorage: { getJSON: (_key, fallback) => fallback, getString: (_key, fallback) => fallback } };
    if (name === '@/lib/appBlocking') return {};
    if (name === '@/lib/togetherCopy') return { togetherCopy };
    if (name === '@/lib/focusRoomCopy') return { focusRoomCopy };
    if (name === '@/lib/focusRoom') return { clampRoomPosition };
    if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name === './TogetherProfile') return loadComponent('TogetherProfile', tab);
    if (name === './FocusRoomInterior') return { FocusRoomInterior: () => null };
    if (name.startsWith('@/components/ui/')) return {
      Button: element('button'), Input: element('input'), Card: element('div'), CardContent: element('div'),
      CardHeader: element('div'), CardTitle: element('h3'), Tabs: element('div'), TabsList: element('div'), TabsTrigger: element('button'),
    };
    return require(name);
  } });
  return exports;
}

test('Together profile keeps all eight avatars in a collapsed, labelled settings panel', () => {
  const { TogetherProfile } = loadComponent('TogetherProfile');
  const html = renderToStaticMarkup(React.createElement(TogetherProfile, {
    title: 'Together', subtitle: 'Focus', labels: { username: 'שם', points: 'נקודות', unlock: 'פתיחה', minutes: 'דקות' },
    username: '<script>fixture</script>', avatarStyle: 2, points: 12, unlockMinutes: 12, onUsernameChange() {}, onAvatarChange() {},
  }));
  assert.ok(html.includes('<details'));
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:=|>)/);
  assert.equal((html.match(/aria-label="דמות /g) || []).length, 8);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<label for='));
});

test('progress starts with zero measured minutes and separates manual reporting', () => {
  const { ZoneFlowTogetherStudio } = loadComponent('ZoneFlowTogetherStudio', 'progress');
  const html = renderToStaticMarkup(React.createElement(ZoneFlowTogetherStudio, { isLight: true }));
  assert.ok(html.includes(togetherCopy.he.measured));
  assert.ok(html.includes(togetherCopy.he.manual));
  assert.ok(html.includes(togetherCopy.he.selectRoom));
  assert.ok(html.includes('0 דקות'));
  assert.doesNotMatch(html, /value="90"/);
});

test('challenge cards show personal counters rather than invented worldwide totals', () => {
  const { ZoneFlowTogetherStudio } = loadComponent('ZoneFlowTogetherStudio', 'competitions');
  const html = renderToStaticMarkup(React.createElement(ZoneFlowTogetherStudio, { isLight: true }));
  assert.ok(html.includes('0 דקות'));
  assert.ok(html.includes('12 דקות'));
  assert.ok(html.includes(togetherCopy.he.personal));
  assert.ok(!html.includes('1,284'));
  assert.ok(!html.includes('684 שעות'));
});

test('all six languages cover profile, measured progress and honest challenge labels', () => {
  assert.deepEqual(Object.keys(togetherCopy).sort(), ['ar', 'en', 'es', 'he', 'ru', 'zh']);
  for (const dictionary of Object.values(togetherCopy)) {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(togetherCopy.en).sort());
    for (const label of Object.values(dictionary)) assert.ok(label.trim());
  }
});
