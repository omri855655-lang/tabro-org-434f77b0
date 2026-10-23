import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve('public/focus-assets');
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));

test('bundled focus assets match their official checksums and fit the download budget',()=>{
  assert.equal(manifest.license,'CC0');
  assert.ok(manifest.files.reduce((sum,file)=>sum+file.bytes,0)<20_000_000);
  for(const file of manifest.files){
    const path=resolve(root,file.path);assert.ok(path.startsWith(root+sep));
    assert.equal(new URL(file.source).hostname,'dl.polyhaven.org');
    const data=readFileSync(path);assert.equal(data.length,file.bytes);
    assert.equal(createHash('md5').update(data).digest('hex'),file.md5);
  }
});

test('every glTF buffer and texture is bundled locally without runtime third-party requests',()=>{
  const paths=new Set(manifest.files.map(file=>resolve(root,file.path)));
  for(const file of manifest.files.filter(file=>file.path.endsWith('.gltf'))){
    const path=resolve(root,file.path),model=JSON.parse(readFileSync(path,'utf8'));
    for(const reference of [...model.buffers,...model.images]){
      assert.ok(!/^(?:https?:|data:|\/)/.test(reference.uri));
      assert.ok(paths.has(resolve(dirname(path),reference.uri)));
    }
  }
});
