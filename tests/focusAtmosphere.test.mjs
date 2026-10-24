import test from 'node:test';
import assert from 'node:assert/strict';
import { atmosphereCopy, parseRoomDaylight, parseRoomWeather, resolveRoomDaylight, roomCameraFov, roomPixelRatio } from '../src/lib/focusAtmosphere.ts';

test('local clock ambience handles day boundaries and manual overrides', () => {
  for (const [hour, expected] of [[0,'night'],[6,'night'],[7,'day'],[16,'day'],[17,'sunset'],[19,'sunset'],[20,'night'],[23,'night']]) assert.equal(resolveRoomDaylight('auto',hour),expected);
  assert.equal(resolveRoomDaylight('day',23),'day'); assert.equal(resolveRoomDaylight('night',12),'night');
  assert.equal(parseRoomDaylight('bad-storage'),'auto'); assert.equal(parseRoomWeather('snow'),'clear');
  assert.equal(parseRoomWeather('rain'),'rain');
});
test('detail resolution scales for phones and large screens within a GPU pixel budget', () => {
  assert.equal(roomPixelRatio(3,390,560,true),2);
  assert.equal(roomPixelRatio(2,1000,600,false),1.5);
  const ratio=roomPixelRatio(3,2200,900,true); assert.ok(ratio<1.3); assert.ok(2200*900*ratio*ratio<=2_800_001);
  assert.ok(Number.isFinite(roomPixelRatio(1,0,0,true)));
});
test('portrait phones get a wider camera so the room is not cropped to the centre aisle', () => {
  assert.equal(roomCameraFov(1440/585),62);
  assert.equal(roomCameraFov(1),62);
  const phone=roomCameraFov(390/506); assert.ok(phone>75&&phone<=84,`phone fov ${phone}`);
  const horizontal=2*Math.atan(Math.tan(phone*Math.PI/360)*(390/506))*180/Math.PI; assert.ok(Math.abs(horizontal-64)<0.5);
  assert.equal(roomCameraFov(.2),84);
  for (const bad of [0,-1,NaN,Infinity]) assert.equal(roomCameraFov(bad),62);
});
test('atmosphere controls are available in all six app languages', () => {
  const keys=Object.keys(atmosphereCopy.en).sort();
  for (const copy of Object.values(atmosphereCopy)) { assert.deepEqual(Object.keys(copy).sort(),keys); assert.ok(Object.values(copy).every(value=>value.length>0)); }
});
