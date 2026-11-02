import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appleCalendarCopy } from '../src/components/appleCalendarCopy.ts';
import { createCalendarExport as appExport } from '../src/lib/calendarExport.ts';
import { createCalendarExport as sharedExport } from '../supabase/functions/_shared/calendarExport.ts';
import { buildFeedUrls, normalizeFieldOptions } from '../supabase/functions/_shared/calendarFeed.ts';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const panel = read('../src/components/AppleCalendarGuide.tsx');

test('all six languages have every panel string, including the iPhone setup steps and privacy warnings', () => {
  const keys = Object.keys(appleCalendarCopy.en);
  for (const lang of ['he', 'en', 'es', 'zh', 'ar', 'ru']) {
    assert.deepEqual(Object.keys(appleCalendarCopy[lang]).sort(), [...keys].sort(), lang);
    assert.equal(appleCalendarCopy[lang].setupSteps.length, 3, lang);
    assert.equal(appleCalendarCopy[lang].privacy.length, 5, lang);
  }
  assert.ok(appleCalendarCopy.en.warning.includes('one-time copy, not automatic sync'));
  assert.ok(appleCalendarCopy.en.warning.includes('may create calendar duplicates'));
  assert.ok(appleCalendarCopy.en.privacy[0].includes('Anyone who has the link'));
  assert.ok(appleCalendarCopy.en.privacy[3].includes('cannot erase'));
});

test('the subscription is opt-in: consent unchecked and every extra field off by default', () => {
  assert.match(panel, /useState\(false\);\s*const \[fields, setFields\] = useState<FeedFieldOptions>\(NO_FIELDS\)/);
  assert.match(panel, /disabled=\{!consent \|\| busy\}/);
  assert.deepEqual(normalizeFieldOptions(undefined), { include_description: false, include_location: false, include_meeting_url: false });
  assert.ok(!panel.includes('useEffect(() => { if (open) void run('), 'opening the panel must never create a link');
});

test('the raw link stays in memory only and is never persisted or logged', () => {
  for (const banned of ['localStorage', 'sessionStorage', 'console.', 'window.open', 'location.href']) assert.ok(!panel.includes(banned), banned);
  assert.match(panel, /if \(!next\) \{ setToken\(null\)/);
  assert.ok(panel.includes('dialogGeneration.current++'));
  assert.ok(panel.includes('if (generation !== dialogGeneration.current) return;'));
  assert.ok(!panel.includes('user_id'));
});

test('regenerate and revoke go through confirmation dialogs; manual download stays as fallback', () => {
  assert.match(panel, /run\("regenerate", \{ consent: true, confirm: true/);
  assert.match(panel, /run\("revoke", \{ confirm: true \}\)/);
  assert.equal((panel.match(/<AlertDialogAction/g) || []).length, 2);
  assert.ok(panel.includes('onClick={onExport}'));
  const planner = read('../src/components/PersonalPlanner.tsx');
  assert.ok(planner.includes('<AppleCalendarGuide onExport={exportToICS} />'));
  assert.ok(planner.includes('const eventsInRange = [...filteredEvents].sort('));
});

test('app ICS export is the shared serializer (no drift) and keeps full fields for manual downloads', () => {
  assert.equal(appExport, sharedExport);
  assert.match(read('../src/lib/calendarExport.ts'), /export \* from "\.\.\/\.\.\/supabase\/functions\/_shared\/calendarExport\.ts"/);
  const ev = { id: 'a', title: 'T', description: 'D', location: 'L', category: 'C', meetingUrl: 'https://m.example/x', startTime: '2026-11-03T08:00:00Z', endTime: '2026-11-03T09:00:00Z' };
  const full = appExport([ev], { timeZone: 'Asia/Jerusalem' }).text;
  for (const p of ['DESCRIPTION:D', 'LOCATION:L', 'CATEGORIES:C', 'URL:https://m.example/x']) assert.ok(full.includes(p), p);
  const minimal = appExport([ev], { timeZone: 'Asia/Jerusalem', fields: { description: false, location: false, category: false, meetingUrl: false } }).text;
  assert.doesNotMatch(minimal, /DESCRIPTION|LOCATION|CATEGORIES|URL:/);
});

test('feed links point at the backend over https with a webcal twin, so both site domains work without redirects', () => {
  const token = 'A'.repeat(43);
  const urls = buildFeedUrls('https://isnhgyycowmnlxtmbmwm.supabase.co', token);
  assert.equal(urls.https, `https://isnhgyycowmnlxtmbmwm.supabase.co/functions/v1/calendar-feed/${token}.ics`);
  assert.equal(urls.webcal, `webcal://isnhgyycowmnlxtmbmwm.supabase.co/functions/v1/calendar-feed/${token}.ics`);
  assert.throws(() => buildFeedUrls('https://x.example', 'short'));
});
