import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { habitDate, habitStats } from '../src/lib/habitJourney.ts';
import { habitCopy } from '../src/lib/habitCopy.ts';
import { routineCopy, routineText } from '../src/lib/routineCopy.ts';

const plan = { id:'habit', user_id:'owner', title:'Read', direction:'build', cue:'After tea', action:'Read one page', weekdays:[0,1,2,3,4,5], target_days:7, created_at:'2026-11-01T10:00:00Z' };
const entry = (date, outcome='done') => ({ id:date, habit_id:'habit', user_id:'owner', kind:'checkin', entry_date:date, outcome, intensity:null, trigger:'',response:'',created_at:`${date}T10:00:00Z` });
test('practice streaks skip scheduled rest days and do not require today before it is over', () => {
  const stats = habitStats(plan,[entry('2026-11-05'),entry('2026-11-06')], new Date(2026,10,8,12));
  assert.equal(stats.streak,2); assert.equal(stats.completed,2); assert.equal(stats.today,undefined);
});
test('partial and missed days are recorded honestly and future dates do not increase progress', () => {
  const stats = habitStats(plan,[entry('2026-11-05'),entry('2026-11-06','partial'),entry('2026-11-09')],new Date(2026,10,8,12));
  assert.equal(stats.streak,0);assert.equal(stats.completed,1);
});
test('duplicate checkins, other habits and urge journals never inflate completed days', () => {
  const stats = habitStats(plan,[entry('2026-11-08'),entry('2026-11-08'),{...entry('2026-11-07'),habit_id:'other'},{...entry('2026-11-06'),kind:'urge'}],new Date(2026,10,8,12));
  assert.equal(stats.completed,1);assert.equal(stats.today,'done');
});
test('local calendar dates are built from local date parts, not UTC', () => {
  const date = new Date(2026,10,8,0,5);
  assert.equal(habitDate(date),'2026-11-08');
  assert.doesNotMatch(habitDate.toString(),/toISOString/);
});
test('all six languages cover every habit field and recurring day control without Hebrew leakage', () => {
  for (const [lang,copy] of Object.entries(habitCopy)) {
    assert.deepEqual(Object.keys(copy).sort(),Object.keys(habitCopy.en).sort());
    assert.equal(copy.weekdays.length,7);
    if (lang !== 'he') assert.doesNotMatch(JSON.stringify(copy),/[\u0590-\u05ff]/);
    for (const field of Object.values(routineCopy[lang])) assert.ok(field.length);
    assert.ok(routineText(lang,'תדירות'));
    if (lang !== 'he') assert.doesNotMatch(routineText(lang,'תדירות'),/[\u0590-\u05ff]/);
  }
});
test('cloud schema isolates owners, forbids anonymous reads and binds journal owner to habit owner', () => {
  const sql = readFileSync(new URL('../drizzle/migrations/0022_habit_journeys.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,2);
  assert.equal((sql.match(/WITH CHECK \(\(SELECT auth.uid\(\)\) = user_id\)/g)||[]).length,2);
  assert.match(sql,/FOREIGN KEY \(habit_id, user_id\)/);
  assert.match(sql,/REVOKE ALL .* FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/UNIQUE INDEX .*entry_date\) WHERE kind = 'checkin'/);
  assert.doesNotMatch(sql,/TO anon|SECURITY DEFINER|USING \(true\)/);
});
test('journals use authenticated cloud storage, no local caches, AI requests or content logging', () => {
  const hook = readFileSync(new URL('../src/hooks/useHabitJourney.ts',import.meta.url),'utf8');
  assert.doesNotMatch(hook,/localStorage|console\.|functions.invoke/);
  assert.match(hook,/\.eq\('user_id', userId\)/);
  const ui = readFileSync(new URL('../src/components/zoneflow/ZoneFlowHabitStudio.tsx',import.meta.url),'utf8');
  assert.match(ui,/description: text.trim\(\)/);
  assert.doesNotMatch(ui,/description:.*(?:trigger|response|plan.title)/);
});
test('selected weekdays retain legacy bitmask compatibility but remove the three-day UI cap', () => {
  const ui = readFileSync(new URL('../src/components/DailyRoutine.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(ui,/selectedCount < 3/);
  assert.match(ui,/dayOfWeek: 63/);assert.match(ui,/dayOfWeek: 127/);
  assert.match(ui,/newTask.dayOfWeek <= 0/);
  const hook = readFileSync(new URL('../src/hooks/useRecurringTasks.ts',import.meta.url),'utf8');
  assert.doesNotMatch(hook,/toISOString/);
});
test('topic reel slows down, samples subtopics and honors reduced motion', () => {
  const source = readFileSync(new URL('../src/components/zoneflow/LearningTopicDraw.tsx',import.meta.url),'utf8');
  assert.match(source,/prefers-reduced-motion/);
  assert.match(source,/index \* index/);
  assert.match(source,/flatMap/);
  assert.match(source,/aria-busy/);
  assert.doesNotMatch(source,/Math.random/);
});
