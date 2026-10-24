import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAI } from '../supabase/functions/_shared/directAI.ts';

test('direct AI keeps tools, images, streaming and JSON requests while normalizing provider model names', async () => {
  const env={get:name=>({GEMINI_API_KEY:'test-key',AI_MAX_OUTPUT_TOKENS:'2048'})[name]};
  for (const model of ['google/gemini-2.5-flash','google/gemini-2.5-pro']) {
    let calls=0;
    const body={model,messages:[{role:'user',content:[{type:'image_url',image_url:{url:'data:image/png;base64,AA=='}}]}],tools:[{type:'function',function:{name:'schedule'}}],stream:true,response_format:{type:'json_object'},max_tokens:9000};
    const response=await fetchAI({method:'POST',body:JSON.stringify(body)},env,async (url,options)=>{
      calls++;
      assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      const sent=JSON.parse(options.body);assert.equal(sent.model,model.replace('google/',''));assert.equal(sent.max_tokens,2048);
      assert.deepEqual(sent.tools,body.tools);assert.deepEqual(sent.messages,body.messages);assert.equal(sent.stream,true);
      assert.equal(options.headers.Authorization,'Bearer test-key');assert.ok(options.signal);
      return new Response('stream');
    });
    assert.equal(await response.text(),'stream');assert.equal(calls,1);
  }
});
test('missing key, disabled AI and invalid caps fail before making a paid request', async () => {
  let calls=0;const send=async()=>{calls++;throw new Error('must not send');};
  const body=JSON.stringify({model:'google/gemini-2.5-flash',messages:[]});
  for(const values of [{},{GEMINI_API_KEY:'test',AI_ENABLED:'false'},{GEMINI_API_KEY:'test',AI_MAX_OUTPUT_TOKENS:'NaN'}]) {
    await assert.rejects(fetchAI({method:'POST',body},{get:name=>values[name]},send));
  }
  assert.equal(calls,0);
});
