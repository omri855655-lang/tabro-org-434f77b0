import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {attachRoomAssets} from '../src/components/zoneflow/focusRoomAssets.ts';

function fixture() {
  const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
  const furniture=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());root.add(furniture);
  const floor=new THREE.Mesh(),wall=new THREE.Mesh(),window=new THREE.Mesh();
  const renderer={capabilities:{getMaxAnisotropy:()=>4}};
  return {scene,root,furniture,floor,wall,window,renderer};
}

test('cafe loads its own furniture, restores surfaces, and disposes only once',async t=>{
  const f=fixture(),urls=[],counts=[];
  const watch=resource=>{const count={value:0};counts.push(count);resource.addEventListener('dispose',()=>count.value++);return resource;};
  t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{
    urls.push(url);const scene=new THREE.Group();
    scene.add(new THREE.Mesh(watch(new THREE.BoxGeometry()),watch(new THREE.MeshStandardMaterial())));return {scene};
  });
  t.mock.method(RGBELoader.prototype,'loadAsync',async()=>{throw new Error('HDR unavailable');});
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>watch(new THREE.Texture()));
  const previous=f.floor.material,environment=new THREE.Texture();f.scene.environment=environment;
  const lamp=new THREE.Object3D();lamp.userData.roomAccessory=true;f.root.add(lamp);
  const assets=attachRoomAssets(f.scene,f.renderer,[{root:f.root,furniture:[f.furniture,lamp]}],[],[],[f.window],'city-cafe',{floor:f.floor,walls:[f.wall]});
  assert.equal((await assets.ready).loaded,false);
  assert.deepEqual(urls.sort(),['/focus-assets/WoodenChair_01/model.gltf','/focus-assets/round_wooden_table_02/model.gltf'].sort());
  assert.equal(f.furniture.visible,false);assert.equal(lamp.visible,true);assert.notEqual(f.floor.material,previous);
  assets.dispose();assets.dispose();
  assert.equal(f.furniture.visible,true);assert.equal(lamp.visible,true);assert.equal(f.root.children.length,2);
  assert.equal(f.floor.material,previous);assert.equal(f.scene.environment,environment);
  assert.ok(counts.every(count=>count.value===1));
});

test('assets finishing after room disposal never attach and release their GPU resources',async t=>{
  const f=fixture(),pending=[],counts=[];
  const watch=resource=>{const count={value:0};counts.push(count);resource.addEventListener('dispose',()=>count.value++);return resource;};
  t.mock.method(GLTFLoader.prototype,'loadAsync',()=>new Promise(resolve=>pending.push(()=>{
    const scene=new THREE.Group();scene.add(new THREE.Mesh(watch(new THREE.BoxGeometry()),watch(new THREE.MeshStandardMaterial())));resolve({scene});
  })));
  t.mock.method(RGBELoader.prototype,'loadAsync',()=>new Promise(resolve=>pending.push(()=>resolve(watch(new THREE.Texture())))));
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',()=>new Promise(resolve=>pending.push(()=>resolve(watch(new THREE.Texture())))));
  const assets=attachRoomAssets(f.scene,f.renderer,[{root:f.root,furniture:[f.furniture]}],[],[],[f.window],'library',{floor:f.floor,walls:[f.wall]});
  assets.dispose();pending.forEach(resolve=>resolve());await assets.ready;
  assert.equal(f.root.children.length,1);assert.equal(f.furniture.visible,true);
  assert.equal(f.scene.environment,null);assert.ok(counts.every(count=>count.value===1));
});
