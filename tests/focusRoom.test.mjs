import assert from 'node:assert/strict';
import test from 'node:test';
import { FOCUS_SEATS, occupiedFocusSeat, clampRoomPosition } from '../src/lib/focusRoom.ts';
import { focusRoomCopy } from '../src/lib/focusRoomCopy.ts';
import { planningToolsCopy } from '../src/lib/planningToolsCopy.ts';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/components/zoneflow/FocusRoomInterior.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: name => {
  if (name.endsWith('.png')) return { default: 'room.png' };
  if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
  if (name === '@/lib/focusRoomCopy') return { focusRoomCopy };
  if (name === '@/lib/focusRoom') return { FOCUS_SEATS, occupiedFocusSeat };
  if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ lang: 'he', dir: 'rtl' }) };
  if (name === '@/components/ui/button') return { Button: ({ children, ...props }) => React.createElement('button', props, children) };
  return require(name);
} });

for (const scene of ['cafe', 'plane', 'library', 'office']) {
  test(`${scene}: seated activity and selected duration remain visible`, () => {
    for (const [activity, label] of [['computer', 'מחשב'], ['notebook', 'כתיבה'], ['book', 'קריאה']]) {
      const html = renderToStaticMarkup(React.createElement(exports.FocusRoomInterior, {
        scene, name: 'Test room', topic: 'Focus', timer: '24:10', active: true, activity,
        participants: [{ userId: 'fixture', displayName: 'Learner', x: 50, y: 62, isMe: true,
          status: 'focusing', seated: true, activity, durationMinutes: 50, avatarStyle: -1 }],
        onToggle() {}, onReset() {}, onLeave() {}, onMove() {}, onSit() {}, onActivityChange() {}, onSelectSeat() {},
      }));
      assert.ok(html.includes(`${label} · 50 דקות`));
      assert.ok(html.includes('24:10'));
      assert.ok(html.includes('zoneflow-avatar-seated'));
      assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
      assert.equal((html.match(/aria-label="שולחן /g) || []).length, 6);
    }
  });
}

test('room coordinates clamp malformed and out-of-bounds presence safely', () => {
  assert.deepEqual(clampRoomPosition({ x: NaN, y: Infinity }), { x: 50, y: 62 });
  assert.deepEqual(clampRoomPosition({ x: -100, y: 400 }), { x: 7, y: 77 });
});

test('six desks are reachable and seated peers reserve nearby desks', () => {
  assert.equal(FOCUS_SEATS.length, 6);
  for (const seat of FOCUS_SEATS) assert.deepEqual(clampRoomPosition(seat), seat);
  const seat = FOCUS_SEATS[0];
  assert.equal(occupiedFocusSeat(seat, [{ ...seat, seated: true }]), true);
  assert.equal(occupiedFocusSeat(seat, [{ ...seat, seated: false }]), false);
  assert.equal(occupiedFocusSeat(seat, [{ ...seat, seated: true, isMe: true }]), false);
  assert.equal(occupiedFocusSeat(FOCUS_SEATS[5], [{ ...seat, seated: true }]), false);
});

test('focus room and planning tools include every label in all six languages', () => {
  for (const dictionary of [focusRoomCopy, planningToolsCopy]) {
    assert.deepEqual(Object.keys(dictionary).sort(), ['ar', 'en', 'es', 'he', 'ru', 'zh']);
    for (const labels of Object.values(dictionary)) {
      assert.deepEqual(Object.keys(labels).sort(), Object.keys(dictionary.en).sort());
      for (const label of Object.values(labels)) assert.ok(label.trim());
    }
  }
});
