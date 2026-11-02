import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Apple calendar export is explicit, range scoped and never sold as automatic sync', () => {
  const source = fs.readFileSync(new URL('../src/components/AppleCalendarGuide.tsx', import.meta.url), 'utf8');
  for (const lang of ['he', 'en', 'es', 'zh', 'ar', 'ru']) assert.ok(source.includes(`${lang}: { button:`));
  assert.ok(source.includes('one-time copy, not automatic sync'));
  assert.ok(source.includes('may create calendar duplicates'));
  assert.ok(source.includes('onClick={onExport}'));
  assert.ok(!source.includes('supabase'));
  assert.ok(!source.includes('webcal:'));
  const planner = fs.readFileSync(new URL('../src/components/PersonalPlanner.tsx', import.meta.url), 'utf8');
  assert.ok(planner.includes('<AppleCalendarGuide onExport={exportToICS} />'));
  assert.ok(planner.includes('const eventsInRange = [...filteredEvents].sort('));
});
