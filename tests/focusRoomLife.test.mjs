import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneryTargets,roomLifeCopy} from '../src/lib/focusRoomLife.ts';
test('scenery has stable rest periods and follows perimeter stops',()=>{
  assert.deepEqual(sceneryTargets(0),sceneryTargets(23));
  assert.notDeepEqual(sceneryTargets(23),sceneryTargets(24));
  assert.deepEqual(sceneryTargets(0),sceneryTargets(96));
  for(let second=0;second<100;second++)for(const point of sceneryTargets(second))assert.ok(point.x===12||point.x===88);
  for(const labels of Object.values(roomLifeCopy))assert.ok(labels.length===5&&labels.every(Boolean));
});
