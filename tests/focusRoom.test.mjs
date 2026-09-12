import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/components/zoneflow/FocusRoomInterior.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require: (name) => {
    if (name.endsWith('.png')) return { default: 'room.png' };
    if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name === '@/components/ui/button') return { Button: ({ children, ...props }) => React.createElement('button', props, children) };
    return require(name);
  },
});

for (const scene of ['cafe', 'plane', 'library', 'office']) {
  test(`${scene}: seated activity and selected duration remain visible`, () => {
    for (const [activity, label] of [['computer', 'מחשב'], ['notebook', 'מחברת'], ['book', 'ספר']]) {
      const html = renderToStaticMarkup(React.createElement(exports.FocusRoomInterior, {
        scene, name: 'Test room', topic: 'Focus', timer: '24:10', active: true, activity,
        participants: [{ userId: 'fixture', displayName: 'Learner', x: 50, y: 62, isMe: true,
          status: 'focusing', seated: true, activity, durationMinutes: 50, avatarStyle: -1 }],
        onToggle() {}, onReset() {}, onLeave() {}, onMove() {}, onSit() {}, onActivityChange() {},
      }));
      assert.ok(html.includes(`${label} · 50 דקות`));
      assert.ok(html.includes('24:10'));
      assert.ok(html.includes('zoneflow-avatar-seated'));
      assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    }
  });
}
