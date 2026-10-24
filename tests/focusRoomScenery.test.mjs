import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
import * as atmosphere from '../src/lib/focusAtmosphere.ts';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const require = createRequire(import.meta.url), exports = {};
const source=fs.readFileSync(new URL('../src/components/zoneflow/focusRoomScenery.ts',import.meta.url),'utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>name==='@/lib/focusAtmosphere'?atmosphere:require(name)});

test('outdoor views share a bounded target, freeze motion, react to lighting, and restore windows',async t=>{
  t.mock.method(RGBELoader.prototype,'loadAsync',async()=>{throw new Error('Offline fixture');});
  for (const kind of ['library','heritage-library','city-cafe','airport','office']) {
    let target=null,calls=0,lastScene;
    const renderer={capabilities:{maxTextureSize:2048},getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render:scene=>{calls++;lastScene=scene;}};
    const geometry=new THREE.PlaneGeometry(2,4),material=new THREE.MeshBasicMaterial();
    const windows=Array.from({length:3},()=>new THREE.Mesh(geometry,material));
    const scenery=exports.createRoomScenery(renderer,windows,kind,'natural');
    assert.equal(windows[0].material.map,windows[2].material.map);
    assert.ok(windows.every(window=>window.geometry!==geometry));
    const uv=windows[2].geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)assert.ok(uv.getX(i)>=.66&&uv.getX(i)<=1);
    scenery.update(.1,'day','clear',false);assert.equal(calls,1);assert.equal(target,null);
    scenery.update(.1,'day','clear',false);assert.equal(calls,1);
    scenery.update(.1,'night','rain',false);assert.equal(calls,2);assert.ok(lastScene.children.find(object=>object.isPoints).visible);
    assert.ok(lastScene.children.filter(object=>object.isMesh).length<30);
    for(let i=0;i<5;i++)scenery.update(.1,'night','rain',true);assert.ok(calls>2);
    scenery.dispose();scenery.dispose();assert.ok(windows.every(window=>window.geometry===geometry&&window.material===material));
    const count=calls;scenery.update(.1,'day','clear',true);assert.equal(calls,count);
    geometry.dispose();material.dispose();
  }
});
