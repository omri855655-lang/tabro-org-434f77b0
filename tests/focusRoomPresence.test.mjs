import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFocusPresence } from '../src/lib/focusRoomPresence.ts';

const me={userId:'owner',displayName:'Me',x:50,y:69,status:'focusing',seated:true,activity:'book',durationMinutes:50};
test('room presence preserves the current local activity during subscription sync',()=>{
  const result=normalizeFocusPresence({owner:[{...me,seated:false,activity:'computer',status:'setting-up'}]},me);
  assert.equal(result.length,1); assert.equal(result[0].activity,'book'); assert.equal(result[0].seated,true); assert.equal(result[0].isMe,true);
});
test('joining and leaving peers follows the authoritative channel snapshot',()=>{
  const peer={userId:'peer',displayName:'Reader',x:24,y:46,status:'focusing',seated:true,activity:'book'};
  assert.equal(normalizeFocusPresence({peer:[peer]},me).length,2);
  assert.equal(normalizeFocusPresence({},me).length,1);
});
test('multiple tabs do not create duplicate avatars and newest update wins',()=>{
  const peer={userId:'peer',x:24,y:46,displayName:'Reader'};
  const result=normalizeFocusPresence({a:[{...peer,activity:'notebook',onlineAt:'2026-10-22T10:02:00Z'}],b:[{...peer,activity:'book',onlineAt:'2026-10-22T10:01:00Z'}]},me);
  assert.equal(result.length,2);assert.equal(result[0].activity,'notebook');
});
test('malformed peer data cannot crash the room or claim the local avatar',()=>{
  const result=normalizeFocusPresence({bad:null,a:[null,7,{userId:'bad',x:NaN,y:Infinity,avatarStyle:-4,status:'admin',isMe:true,seated:'true',displayName:{},durationMinutes:9999}]},me);
  assert.deepEqual(result[0],{userId:'bad',displayName:'Tabro learner',x:50,y:62,status:'setting-up',avatarStyle:0,activity:'computer',seated:false,durationMinutes:240,isMe:false});
  assert.deepEqual(normalizeFocusPresence(null,me),[{...me,isMe:true}]);
});
