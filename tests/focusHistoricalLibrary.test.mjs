import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildHistoricalLibrary} from '../src/components/zoneflow/focusHistoricalLibrary.ts';
for(const monastery of [false,true])test(`historical library has distinct architecture and restores owned surfaces: ${monastery}`,()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),floor=new THREE.Mesh(geometry,material),wall=new THREE.Mesh(geometry,material);
  const box=(parent,color,at,size)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(at);mesh.scale.fromArray(size);parent.add(mesh);return mesh;};
  const result=buildHistoricalLibrary(scene,{box},monastery,-12,10,{floor,walls:[wall]});
  assert.equal(scene.children[0].name,monastery?'stone-monastery-library':'historic-wood-library');
  if(monastery)assert.notEqual(floor.material,material);
  scene.traverse(object=>{if(!object.isMesh)return;const positions=object.geometry.getAttribute('position');for(let i=0;i<positions.count;i++)assert.ok(Number.isFinite(positions.getX(i))&&Number.isFinite(positions.getY(i))&&Number.isFinite(positions.getZ(i)));});
  result.dispose();assert.equal(scene.children.length,0);assert.equal(floor.material,material);assert.equal(wall.material,material);geometry.dispose();material.dispose();
});
