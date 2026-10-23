import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMealEstimate,mealTotals,scaleMealItem} from '../src/lib/mealEstimate.ts';
import {summarizeHealthRecords} from '../src/lib/healthImport.ts';
import {mealPhotoCopy,healthImportCopy} from '../src/lib/nutritionFeaturesCopy.ts';
const food={name:'Rice',grams:200,calories:260,protein:5,carbs:56,fat:1};
test('meal quantities scale reviewed nutrients and reject malformed analysis',()=>{
  const half=scaleMealItem(food,100);assert.equal(half.calories,130);assert.equal(half.carbs,28);
  assert.equal(mealTotals([half,half]).calories,260);
  assert.deepEqual(parseMealEstimate({items:[food]}).items,[food]);
  for(const data of [null,{items:[]},{items:[{...food,calories:NaN}]},{items:[{...food,grams:-2}]},{items:[{...food,name:''}]}])assert.throws(()=>parseMealEstimate(data));
  assert.throws(()=>scaleMealItem(food,Infinity));
});
test('health import avoids duplicate step sources and overlapping sleep stages',()=>{
  const step=(sourceName,value)=>({type:'HKQuantityTypeIdentifierStepCount',sourceName,value,startDate:'2026-10-22 12:00:00 +0300',endDate:'2026-10-22 13:00:00 +0300'});
  const sleep=(value,startDate,endDate)=>({type:'HKCategoryTypeIdentifierSleepAnalysis',sourceName:'Watch',value,startDate,endDate});
  const rows=[step('Watch','6000'),step('Watch','6000'),step('Phone','4000'),step('Bad','-2'),
    sleep('HKCategoryValueSleepAnalysisAsleep','2026-10-21 23:00:00 +0300','2026-10-22 07:00:00 +0300'),
    sleep('HKCategoryValueSleepAnalysisAsleepCore','2026-10-22 01:00:00 +0300','2026-10-22 03:00:00 +0300'),
    sleep('HKCategoryValueSleepAnalysisAsleepDeep','2026-10-21 23:00:00 +0300','2026-10-21 23:30:00 +0300'),
    sleep('HKCategoryValueSleepAnalysisInBed','2026-10-21 22:00:00 +0300','2026-10-22 08:00:00 +0300')];
  const result=summarizeHealthRecords(rows);assert.equal(result.length,1);assert.equal(result[0].steps,6000);assert.equal(result[0].sleepHours,8);
  assert.deepEqual(summarizeHealthRecords([step('Bad','NaN')]),[]);
});
test('new nutrition and health labels are complete in six languages',()=>{
  for(const lang of ['he','en','es','ar','ru','zh']){assert.equal(mealPhotoCopy[lang].length,19);assert.equal(healthImportCopy[lang].length,8);assert.ok([...mealPhotoCopy[lang],...healthImportCopy[lang]].every(Boolean));}
});
test('meal-photo edge function bundles the same meal validator as the app',async()=>{
  const {readFile}=await import('node:fs/promises');
  assert.equal(await readFile(new URL('../supabase/functions/task-ai-helper/mealEstimate.ts',import.meta.url),'utf8'),await readFile(new URL('../src/lib/mealEstimate.ts',import.meta.url),'utf8'));
});
