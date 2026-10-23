import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockCost} from '../src/lib/unlockPricing.ts';
import {LEARNING_PATHS,learningLabels} from '../src/lib/learningCopy.ts';
test('unlock minutes cost ten points each and reject invalid durations',()=>{
  assert.equal(unlockCost(1),10);assert.equal(unlockCost(5),50);assert.equal(unlockCost(120),1200);
  for(const minutes of [0,-1,1.5,121,NaN,Infinity])assert.throws(()=>unlockCost(minutes));
});
test('politics policy and concepts have translated learning paths in all six languages',()=>{
  for(const category of ['מדעי המדינה','מדיניות ציבורית','מושגים']){
    assert.equal(LEARNING_PATHS[category].length,5);
    for(const lang of ['he','en','es','zh','ar','ru'])for(const topic of LEARNING_PATHS[category]){
      const labels=learningLabels(lang,category,topic);assert.ok(labels.category&&labels.subtopic);
      if(lang!=='he'){assert.notEqual(labels.category,category);assert.notEqual(labels.subtopic,topic);}
    }
  }
});
