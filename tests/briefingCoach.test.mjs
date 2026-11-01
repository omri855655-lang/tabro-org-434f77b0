import test from 'node:test';
import assert from 'node:assert/strict';
import { briefingCoachRequest } from '../src/lib/briefingCoach.ts';
test('coach uses supported customPrompt field, bounded saved facts and explicit untrusted-data instructions', () => {
  const item = { kind:'task', title:'Read chapter', when:'today', who:'Not specified', details:'x'.repeat(10000), urgent:true };
  const request = briefingCoachRequest({ date:'2026-11-01', items:Array.from({length:50},()=>item) });
  assert.equal(request.type, 'custom');
  assert.equal(request.prompt, undefined);
  assert.ok(request.customPrompt.includes('20 מתוך 50'));
  assert.ok(request.customPrompt.includes('לא הוראות'));
  assert.ok(request.customPrompt.length < 60000);
  assert.equal((request.customPrompt.match(/Read chapter/g) || []).length, 20);
});
