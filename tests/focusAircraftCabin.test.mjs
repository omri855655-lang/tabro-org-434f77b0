import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {buildAircraftCabin} from '../src/components/zoneflow/focusAircraftCabin.ts';
import {focusFlightTimeCopy,parseFocusFlightTime} from '../src/lib/focusFlightTime.ts';

test('day and night are independent flight settings with complete six-language labels',()=>{
  assert.equal(parseFocusFlightTime('night'),'night');
  for(const value of [undefined,null,'invalid','day',{},42])assert.equal(parseFocusFlightTime(value),'day');
  assert.deepEqual(Object.keys(focusFlightTimeCopy).sort(),['ar','en','es','he','ru','zh']);
  for(const labels of Object.values(focusFlightTimeCopy)){assert.equal(labels.length,3);assert.ok(labels.every(label=>label.trim()));}
});

for(const business of [false,true])test(`cabin architecture stays finite, bounded and disposable (${business?'business':'standard'})`,()=>{
  const scene=new THREE.Scene(),sharedGeometry=new THREE.BoxGeometry(),sharedMaterial=new THREE.MeshStandardMaterial();
  const b={box:(parent,color,at,size)=>{const mesh=new THREE.Mesh(sharedGeometry,sharedMaterial);mesh.position.fromArray(at);mesh.scale.fromArray(size);parent.add(mesh);return mesh;}};
  const cabin=buildAircraftCabin(scene,b,business,-12,13,5.8);
  const resources=new Set(),meshes=[];
  cabin.root.traverse(object=>{
    if(!object.isMesh)return;meshes.push(object);
    assert.ok([...object.position.toArray(),...object.scale.toArray()].every(Number.isFinite));
    if(object.geometry!==sharedGeometry)resources.add(object.geometry);
    if(object.material!==sharedMaterial)resources.add(object.material);
    const vertices=object.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)assert.ok(Number.isFinite(vertices.getX(i))&&Number.isFinite(vertices.getY(i))&&Number.isFinite(vertices.getZ(i)));
  });
  assert.ok(meshes.length<200,'cabin details retain a bounded draw-call budget');
  assert.equal(meshes.filter(mesh=>mesh.name==='overhead-service-panel').length,18);
  const bounds=new THREE.Box3().setFromObject(cabin.root);
  assert.ok(bounds.min.z>=-12.1&&bounds.max.z<=13.1);
  assert.ok(bounds.max.y<=5.2);
  let disposed=0;resources.forEach(resource=>resource.addEventListener('dispose',()=>disposed++));
  cabin.dispose();assert.equal(cabin.root.parent,null);assert.equal(disposed,resources.size);
  sharedGeometry.dispose();sharedMaterial.dispose();
});
