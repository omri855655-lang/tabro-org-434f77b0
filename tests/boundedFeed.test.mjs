import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedFeed } from '../supabase/functions/_shared/bounded-feed.ts';

test('feed size limit measures streamed bytes and preserves split UTF-8 characters', async()=>{
  const encoded=new TextEncoder().encode('שלום 🌿');
  const body=new ReadableStream({start(controller){controller.enqueue(encoded.slice(0,3));controller.enqueue(encoded.slice(3));controller.close();}});
  assert.equal(await readBoundedFeed(new Response(body),encoded.length),'שלום 🌿');
});
test('oversized advertised feed is rejected before reading its body', async()=>{
  let cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(readBoundedFeed(new Response(body,{headers:{'content-length':'100'}}),10),/size limit/);
  assert.equal(cancelled,true);
});
test('unadvertised oversized streams are cancelled at the byte limit', async()=>{
  let cancelled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(11));},cancel(){cancelled=true;}});
  await assert.rejects(readBoundedFeed(new Response(body),10),/size limit/);
  assert.equal(cancelled,true);
});
