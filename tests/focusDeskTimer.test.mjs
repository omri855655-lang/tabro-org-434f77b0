import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeskTimer } from '../src/components/zoneflow/focusDeskTimer.ts';
import { focusDeviceCopy } from '../src/lib/focusDeviceCopy.ts';

test('desk screen uses supplied timer, repaints only changes and releases shared GPU resources once', () => {
  const texts = [];
  const context = { fillRect() {}, fillText(text) { texts.push(text); }, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {} };
  const timer = createDeskTimer({ getContext: () => context });
  const first = timer.createScreen(), second = timer.createScreen();
  assert.equal(first.visible, false); assert.equal(first.rotation.y, Math.PI);
  assert.equal(first.material, second.material); assert.equal(first.geometry, second.geometry);
  timer.update('25:00', false); assert.equal(texts.at(-1), '25:00');
  const version = first.material.map.version;
  timer.update('25:00', false); assert.equal(first.material.map.version, version);
  timer.update('25:00', true); assert.ok(first.material.map.version > version);
  timer.update('24:59', true); assert.equal(texts.at(-1), '24:59');
  timer.update('25:00', false); assert.equal(texts.at(-1), '25:00');
  timer.update('1:02:03', true); assert.equal(texts.at(-1), '1:02:03');
  timer.update('bad', true); assert.equal(texts.at(-1), '--:--');
  const disposed = [0, 0, 0];
  [first.geometry, first.material, first.material.map].forEach((resource, i) => resource.addEventListener('dispose', () => disposed[i]++));
  timer.dispose(); timer.dispose(); assert.deepEqual(disposed, [1, 1, 1]);
  const count = texts.length; timer.update('00:00', false); assert.equal(texts.length, count);
});

test('phone recommendation is available in all six languages', () => {
  assert.equal(Object.keys(focusDeviceCopy).length, 6);
  for (const copy of Object.values(focusDeviceCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), ['hint', 'keep', 'light']);
    assert.ok(Object.values(copy).every(value => value.trim().length > 0));
  }
});
