import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeAvatar,encodeAvatar,normalizeAvatarStyle} from '../src/lib/focusAvatar.ts';
test('custom avatar encoding preserves each combination independently',()=>{
  for(let shirt=0;shirt<8;shirt++)for(let skin=0;skin<4;skin++)for(let hair=0;hair<4;hair++)for(let cut=0;cut<3;cut++)for(let accessory=0;accessory<3;accessory++)for(let pants=0;pants<4;pants++){
    const design={shirt,skin,hair,cut,accessory,pants};
    assert.deepEqual(decodeAvatar(encodeAvatar(design)),design);
  }
});
test('legacy presets retain their identity and malformed remote styles use a default',()=>{
  for(let shirt=0;shirt<8;shirt++)assert.equal(decodeAvatar(shirt).shirt,shirt);
  for(const value of [NaN,Infinity,-1,4616,'12',null,{}])assert.equal(normalizeAvatarStyle(value),0);
});
