import assert from 'node:assert/strict';
import test from 'node:test';
import { createCalendarExport, foldCalendarLine } from '../src/lib/calendarExport.ts';
const event={id:'meeting',title:'פגישה, עם צוות; תכנון',description:'Line one\nLine two \\ details',category:'work',startTime:'2026-10-21T09:00:00+03:00',endTime:'2026-10-21T10:00:00+03:00'};
const options={now:new Date('2026-10-21T00:00:00Z'),timeZone:'Asia/Jerusalem'};
test('calendar export uses exact UTC instants rather than floating local times',()=>{
  const {text,exported}=createCalendarExport([event],options);
  assert.equal(exported,1); assert.match(text,/DTSTART:20261021T060000Z\r\n/); assert.match(text,/DTEND:20261021T070000Z\r\n/);
  assert.match(text,/SUMMARY:פגישה\\, עם צוות\\; תכנון/); assert.match(text,/DESCRIPTION:Line one\\nLine two \\\\ details/);
});
test('calendar data cannot inject properties or another event through newlines',()=>{
  const {text}=createCalendarExport([{...event,id:'bad\r\nATTENDEE:secret',title:'Title\r\nBEGIN:VEVENT',category:'x\nATTENDEE:bad',meetingUrl:'https://example.com\r\nATTENDEE:bad'}],options);
  assert.equal(text.match(/^BEGIN:VEVENT$/gm)?.length,1); assert.doesNotMatch(text,/^ATTENDEE:/m); assert.doesNotMatch(text,/^URL:/m);
});
test('all-day exports have date-only values and exclusive end, including midnight boundaries',()=>{
  const first=createCalendarExport([{...event,allDay:true,startTime:'2026-10-21T00:00:00+03:00',endTime:'2026-10-21T23:59:00+03:00'}],options).text;
  assert.match(first,/DTSTART;VALUE=DATE:20261021/); assert.match(first,/DTEND;VALUE=DATE:20261022/);
  const exclusive=createCalendarExport([{...event,allDay:true,startTime:'2026-10-21T00:00:00+03:00',endTime:'2026-10-23T00:00:00+03:00'}],options).text;
  assert.match(exclusive,/DTEND;VALUE=DATE:20261023/);
});
test('folding preserves Hebrew and emoji and every content line is at most 75 UTF-8 bytes',()=>{
  const line='SUMMARY:'+('עברית 🙂 '.repeat(50)); const folded=foldCalendarLine(line);
  assert.equal(folded.replace(/\r\n /g,''),line);
  for(const part of folded.split('\r\n')) assert.ok(Buffer.byteLength(part)<=75);
});
test('malformed and duplicate events are skipped; recurrence rows do not generate duplicate RRULEs',()=>{
  const result=createCalendarExport([event,event,{...event,id:'bad',startTime:'invalid'}],options);
  assert.equal(result.exported,1);assert.equal(result.skipped,2);assert.doesNotMatch(result.text,/RRULE/);
});
test('reminders are optional and bounded and unsafe meeting links are omitted',()=>{
  assert.match(createCalendarExport([event],{...options,reminderMinutes:15}).text,/TRIGGER:-PT15M/);
  assert.doesNotMatch(createCalendarExport([{...event,meetingUrl:'javascript:alert(1)'}],options).text,/VALARM|^URL:/m);
});
