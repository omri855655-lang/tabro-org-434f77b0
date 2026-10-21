import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {normalizeLearningEntries,mergeLearningEntries,learningHistoryKey,createLearningHistoryStore} from '../src/lib/learningHistory.ts';
import {learningCopy,learningLabels,LEARNING_PATHS} from '../src/lib/learningCopy.ts';
const entry={id:'lesson-1',date:'2026-10-21T10:00:00Z',title:'A lesson',category:'פיזיקה',summary:'My own summary',content:'Original lesson'};
test('legacy local entries survive normalization while malformed records and oversized fields are bounded',()=>{
  const rows=normalizeLearningEntries([entry,null,{id:'invalid'},{...entry,id:'long',summary:'x'.repeat(20000)}]);
  assert.equal(rows.length,2);assert.equal(rows[1].summary.length,10000);assert.equal(rows[0].content,entry.content);
});
test('merging remote and local lessons is idempotent, chronological and does not lose a new entry at the limit',()=>{
  assert.equal(mergeLearningEntries([entry],[entry]).length,1);
  const old=Array.from({length:1000},(_,i)=>({...entry,id:`old-${i}`,date:'2026-10-20T10:00:00Z'}));
  const merged=mergeLearningEntries(old,[{...entry,id:'new'}]);assert.equal(merged.length,1000);assert.equal(merged[0].id,'new');
  assert.notEqual(learningHistoryKey('a'),learningHistoryKey('b'));assert.notEqual(learningHistoryKey(),learningHistoryKey('a'));
});
test('cloud reads are owner-scoped and writes never trust an owner from imported content',async()=>{
  const calls=[];
  const query={eq(k,v){calls.push([k,v]);return this;},order(){return this;},limit(){return this;},then(resolve){return Promise.resolve({data:[{...entry,user_id:'other',completed_at:entry.date},{...entry,user_id:'owner',completed_at:entry.date}],error:null}).then(resolve);}};
  const client={from(table){assert.equal(table,'zoneflow_learning_history');return {select(){return query;},async upsert(rows,opts){calls.push({rows,opts});return {error:null};}};}};
  const store=createLearningHistoryStore(client);
  assert.equal((await store.read('owner')).length,1);assert.deepEqual(calls[0],['user_id','owner']);
  await store.save('owner',[{...entry,user_id:'other'}]);assert.equal(calls[1].rows[0].user_id,'owner');assert.equal(calls[1].opts.onConflict,'user_id,id');
  await assert.rejects(store.read('')); await assert.rejects(store.save('',[entry]));
});
test('learning migration protects SELECT, INSERT and UPDATE and grants no anonymous access or deletes',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261020180000_private_learning_history.sql',import.meta.url),'utf8');
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/REVOKE ALL .* FROM anon/);
  assert.equal(sql.match(/user_id = auth.uid\(\)/g).length,4);assert.doesNotMatch(sql,/GRANT.*DELETE|TO anon|USING\s*\(true\)/i);
});
test('all six languages fully cover learning controls, category names and every path',()=>{
  const keys=Object.keys(learningCopy.en).sort();
  for(const [lang,copy] of Object.entries(learningCopy)){
    assert.deepEqual(Object.keys(copy).sort(),keys);for(const value of Object.values(copy))assert.ok(Array.isArray(value)?value.length===3:typeof value==='string'&&value.length);
    for(const [category,paths] of Object.entries(LEARNING_PATHS))for(const path of paths){const labels=learningLabels(lang,category,path);assert.ok(labels.category&&labels.subtopic);if(lang!=='he')assert.doesNotMatch(labels.category+labels.subtopic,/[\u0590-\u05ff]/);}
  }
});
