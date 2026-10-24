import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRoomCraft } from '../src/components/zoneflow/focusRoomCraft.ts';

test('every room detail layer has valid geometry, bounded draw calls and releases its resources', () => {
  for (const kind of ['library','grand','intimate','modern-library','heritage-library','monastery-library','plane','business-plane','airport','cafe','city-cafe','office']) {
    const scene=new THREE.Scene(), geometry=new THREE.BoxGeometry(), materials=new Map();
    const shape=(parent,color,at,size)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.position.fromArray(at);mesh.scale.fromArray(size);parent.add(mesh);return mesh;};
    const result=buildRoomCraft(scene,kind,{box:shape,ball:shape},kind.includes('plane')?5.8:10,10,-12,10);
    assert.equal(scene.children[0].name,`room-craft-${kind}`);
    const meshes=scene.children[0].children; assert.ok(meshes.length>0); assert.ok(meshes.length<30,`${kind}: ${meshes.length} draw calls`);
    const disposed=[];
    meshes.forEach(mesh=>{const count={value:0};disposed.push(count);mesh.geometry.addEventListener('dispose',()=>count.value++);const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));});
    result.dispose();result.dispose();assert.equal(scene.children.length,0);assert.ok(disposed.every(item=>item.value===1));
    geometry.dispose();materials.forEach(material=>material.dispose());
  }
});
