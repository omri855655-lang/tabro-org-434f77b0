import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAirportAircraft } from '../src/components/zoneflow/focusAirportAircraft.ts';

test('airport aircraft has two swept main wings, two engines and a separate tail assembly', () => {
  const parent = new THREE.Group(), resources = new Set();
  const root = buildAirportAircraft(parent, resources);
  assert.equal(root.children.filter(item => item.name.startsWith('main-wing-')).length, 2);
  assert.equal(root.children.filter(item => /^engine-[-]?1$/.test(item.name)).length, 2);
  assert.equal(root.children.filter(item => item.name.startsWith('cabin-window-')).length, 32);
  assert.ok(root.getObjectByName('vertical-tail'));
  assert.equal(root.children.filter(item => item.name.startsWith('wheel-')).length, 6);
  for (const wheel of root.children.filter(item => item.name.startsWith('wheel-'))) assert.ok(Math.abs(new THREE.Box3().setFromObject(wheel).min.y - .05) < .001, 'tyres meet the apron rather than floating above it');
  const body = root.getObjectByName('fuselage');
  assert.deepEqual(body.scale.toArray(), [8,1.1,1.1]);
  const before = resources.size;
  const clone = parent.clone(true);
  assert.ok(clone.getObjectByName('airport-airframe'));
  assert.equal(resources.size, before);
  root.traverse(item => { if (item.isMesh) assert.ok(resources.has(item.geometry) && resources.has(item.material)); });
  resources.forEach(item => item.dispose());
});
