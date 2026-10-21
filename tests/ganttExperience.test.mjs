import assert from 'node:assert/strict';
import test from 'node:test';
import {parseLocalDate,scheduledLessonDay,toLocalDateKey} from '../src/lib/projectGantt.ts';
import {normalizePublicGantt,validGanttToken} from '../src/lib/publicGantt.ts';
import {ganttCopy,templateCopy} from '../src/lib/ganttCopy.ts';

test('Gantt dates reject rollover, malformed dates and invalid leap days instead of inventing another day',()=>{
  for(const input of ['2026-02-30','2026-02-29','2026-13-01','2026-00-10','2026-01-00','2026-1-2','2026-10-21junk','0000-01-01',''])assert.equal(parseLocalDate(input),null,input);
  assert.equal(toLocalDateKey(parseLocalDate('2024-02-29')),'2024-02-29');
  assert.equal(toLocalDateKey(parseLocalDate('0099-01-02')),'0099-01-02');
});
test('course Gantt uses the local lesson day, not the UTC date prefix',()=>{
  const before=process.env.TZ;process.env.TZ='Asia/Jerusalem';
  try{
    assert.equal(scheduledLessonDay('2026-10-21T22:30:00Z'),'2026-10-22');
    assert.equal(scheduledLessonDay('2026-10-22'),'2026-10-22');
    assert.equal(scheduledLessonDay('2026-02-30T01:00:00Z'),null);
    assert.equal(scheduledLessonDay('not a date'),null);
  }finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
test('public timeline projects only allowed display fields and reports skipped malformed or duplicate tasks',()=>{
  const payload=normalizePublicGantt({owner_display_name:null,private_key:'not copied',project:{id:'p',title:'A project',description:'Notes',target_date:'2026-02-30',user_id:'not copied'},tasks:[null,{id:'one',title:'A task',completed:'false',urgent:false,due_date:'2026-02-30',assigned_email:'not copied'},{id:'one',title:'Duplicate'},{id:'two',title:'Second',completed:true,sort_order:Infinity},{}]});
  assert.equal(payload.tasks.length,2);assert.equal(payload.omittedTaskCount,3);
  assert.equal(payload.tasks[0].completed,false);assert.equal(payload.tasks[0].due_date,null);
  assert.equal(payload.project.target_date,null);assert.equal(payload.owner_display_name,'Tabro');
  assert.doesNotMatch(JSON.stringify(payload),/not copied|assigned_email|user_id|private_key/);
  for(const value of [null,[],{project:{id:'p',title:'x'},tasks:{}},{project:{id:5,title:'x'},tasks:[]}])assert.equal(normalizePublicGantt(value),null);
});
test('only UUID capability tokens are sent to the public timeline RPC',()=>{
  assert.equal(validGanttToken('00000000-0000-0000-0000-000000000000'),true);
  for(const token of ['', '../private','bad-token','00000000-0000-0000-0000-000000000000?x=1'])assert.equal(validGanttToken(token),false);
});
test('all six Gantt interfaces, print labels, sharing controls and templates have complete translations',()=>{
  const keys=Object.keys(ganttCopy.en).sort(),ids=Object.keys(templateCopy.en).sort();
  for(const [lang,copy] of Object.entries(ganttCopy)){
    assert.deepEqual(Object.keys(copy).sort(),keys);
    for(const value of Object.values(copy)){assert.ok(value.trim());if(lang!=='he')assert.doesNotMatch(value,/[\u0590-\u05ff]/);}
    assert.deepEqual(Object.keys(templateCopy[lang]).sort(),ids);
    for(const value of Object.values(templateCopy[lang])){assert.equal(value.tasks.length,6);assert.ok(value.label);for(const title of value.tasks)assert.ok(title.trim());}
  }
});
