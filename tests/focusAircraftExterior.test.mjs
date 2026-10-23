import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildAircraftExterior} from '../src/components/zoneflow/focusAircraftExterior.ts';
test('aircraft exterior has finite geometry and cleans shared resources after animation',()=>{
  const parent=new THREE.Group(),exterior=buildAircraftExterior(parent,false),resources=new Set();
  exterior.root.traverse(object=>{
    if(!object.isMesh)return;
    resources.add(object.geometry);resources.add(object.material);
    const vertices=object.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)assert.ok(Number.isFinite(vertices.getX(i))&&Number.isFinite(vertices.getY(i))&&Number.isFinite(vertices.getZ(i)));
  });
  exterior.update(12);
  let released=0;resources.forEach(resource=>resource.addEventListener('dispose',()=>released++));
  exterior.dispose();assert.equal(parent.children.length,0);assert.equal(released,resources.size);
});
