import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFlightClouds, buildFlightLandscape, flightLandscapePose, isWingWindow, RUNWAY_HALF_WIDTH } from '../src/components/zoneflow/focusFlightLandscape.ts';

test('aircraft has one wing-bearing window per side, not repeated wings in adjacent windows', () => {
  const positions=Array.from({length:9},(_,i)=>-10+i*2.5);
  assert.deepEqual(positions.filter(isWingWindow),[0]);
  assert.equal(isWingWindow(NaN),false);
});

test('takeoff terrain progresses continuously past the former loop boundary', () => {
  assert.ok(flightLandscapePose(.5,40.1).forward>flightLandscapePose(.5,39.9).forward);
  assert.equal(flightLandscapePose(0,0).altitude,0);
  assert.equal(flightLandscapePose(1,100).altitude,85);
  assert.ok(flightLandscapePose(1,100).lookDown>flightLandscapePose(0,0).lookDown);
  for(const value of [-1,NaN,Infinity])assert.ok(Object.values(flightLandscapePose(value,value)).every(Number.isFinite));
  assert.equal(flightLandscapePose(1,100000).forward,900);
});

test('continuous airport landscape covers the distant horizon with bounded draw calls and disposes once', () => {
  const scene=new THREE.Scene(),landscape=buildFlightLandscape(scene);
  assert.equal(scene.children[0].name,'continuous-flight-landscape');
  assert.ok(landscape.root.children.length<30);
  const bounds=new THREE.Box3().setFromObject(landscape.root);
  assert.ok(bounds.max.x-bounds.min.x>=3200);assert.ok(bounds.max.z-bounds.min.z>=3200);
  const counts=[];
  for(const mesh of landscape.root.children){
    const count={n:0};counts.push(count);mesh.geometry.addEventListener('dispose',()=>count.n++);
    const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
  }
  landscape.dispose();landscape.dispose();assert.equal(scene.children.length,0);assert.ok(counts.every(c=>c.n===1));
});

test('cruise view still looks over neighbourhoods, and taxiway connectors stop at the runway edge', () => {
  const scene=new THREE.Scene(),landscape=buildFlightLandscape(scene);
  const byColor=hex=>landscape.root.children.find(mesh=>mesh.material.color.getHex()===hex);
  // Terrain advances at most 900; buildings must continue well past the camera at that point.
  const buildings=new THREE.Box3().setFromObject(byColor(0x9b9c90));assert.ok(buildings.min.z<=-1800,`buildings end at ${buildings.min.z}`);
  const connectors=new THREE.Box3().setFromObject(byColor(0x737e7e));assert.ok(connectors.min.x>=RUNWAY_HALF_WIDTH,`connector reaches x=${connectors.min.x}`);
  landscape.dispose();
});

test('flight clouds are soft billboards high above the ground that dispose once', () => {
  const parent=new THREE.Group(),clouds=buildFlightClouds(parent);
  assert.ok(clouds.root.children.length>=20);
  for(const cloud of clouds.root.children){assert.ok(cloud.isSprite);assert.ok(cloud.position.y>=50,'clouds never lie on the runway');assert.ok(cloud.position.toArray().every(Number.isFinite));}
  let released=0;clouds.material.addEventListener('dispose',()=>released++);
  clouds.dispose();clouds.dispose();assert.equal(parent.children.length,0);assert.equal(released,1);
});
