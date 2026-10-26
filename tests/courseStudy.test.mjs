import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newCourseLessons, parseStudyProfile, courseStudyContext } from '../src/lib/courseStudy.ts';
import { courseStudyCopy, studyModeInstructions } from '../src/lib/courseStudyCopy.ts';

test('lesson draft deduplication preserves existing progress and dates', () => {
  const existing = [{ title: 'Policy   analysis', completed: true, scheduled_date: '2026-11-01' }];
  const before = structuredClone(existing);
  const draft = newCourseLessons([{ title: ' POLICY analysis ' }, { title: 'Budget', duration_minutes: 999 }, { title: 'budget' }, { title: '   ' }], existing);
  assert.deepEqual(draft, [{ title: 'Budget', duration_minutes: 300 }]);
  assert.deepEqual(existing, before);
  assert.deepEqual(newCourseLessons(draft, [...existing, ...draft]), []);
});
test('profile is bounded and validates calendar dates', () => {
  assert.equal(parseStudyProfile(null).weeklyHours, 4);
  assert.equal(parseStudyProfile({ weeklyHours: Infinity }).weeklyHours, 4);
  assert.equal(parseStudyProfile({ weeklyHours: 100 }).weeklyHours, 40);
  assert.equal(parseStudyProfile({ examDate: '2026-02-30' }).examDate, '');
  assert.equal(parseStudyProfile({ examDate: '2028-02-29' }).examDate, '2028-02-29');
  assert.equal(parseStudyProfile({ materials: 'x'.repeat(5000) }).materials.length, 2500);
});
test('context distinguishes source coverage and optional enrichment', () => {
  const context = JSON.parse(courseStudyContext('x'.repeat(20000), Array.from({length:50}, () => ({title:'Policy'})), parseStudyProfile({difficulties:'Statistics'})));
  assert.equal(context.sourceCoverage.syllabusTruncated, true);
  assert.equal(context.lessons.length, 40);
  assert.equal(context.sourceCoverage.lessonsTotal, 50);
  assert.match(context.purpose, /Do not invent citations/);
  assert.equal(context.profile.difficulties, 'Statistics');
});
test('all six languages expose all five study modes and draft labels', () => {
  assert.equal(Object.keys(courseStudyCopy).length, 6);
  assert.equal(studyModeInstructions.length, 5);
  for (const copy of Object.values(courseStudyCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(courseStudyCopy.en).sort());
    assert.equal(copy.modes.length, 5);
    for (const value of Object.values(copy).flat()) assert.ok(value.trim());
  }
});
test('course generation stages a draft without deleting existing lessons', () => {
  const source = readFileSync(new URL('../src/components/CoursesManager.tsx', import.meta.url), 'utf8');
  const generation = source.slice(source.indexOf('const generateLessonsFromSyllabus'), source.indexOf('const getAiRecommendations'));
  assert.match(generation, /setLessonDraft/);
  assert.doesNotMatch(generation, /addReviewedLessons|\.insert\(|\.delete\(/);
  const saving = source.slice(source.indexOf('const addReviewedLessons'), source.indexOf('const generateLessonsFromSyllabus'));
  assert.doesNotMatch(saving, /\.delete\(/);
  assert.match(saving, /eq\('user_id', user.id\)/);
  assert.match(saving, /newCourseLessons/);
});
