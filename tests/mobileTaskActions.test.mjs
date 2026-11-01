import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

for (const view of ['ListView', 'CardsView']) test(`${view}: portalled status selection does not bubble into task details`, () => {
  const source = read(`src/components/views/${view}.tsx`);
  assert.match(source, /<SelectContent onClick=\{\(e\) => e.stopPropagation\(\)\}/);
  assert.match(source, /onPointerUp=\{\(e\) => e.stopPropagation\(\)\}/);
  assert.match(source, /h-11 sm:h-7/);
});

test('mobile task drawer has explicit scheduling and filters, not touch-start dragging', () => {
  const source = read('src/components/PersonalPlanner.tsx');
  const mobile = source.slice(source.indexOf('{isMobile && (\n        <Sheet'), source.indexOf('{/* Left side - Calendar */}'));
  assert.ok(mobile.includes('שיבוץ בלוז'));
  assert.ok(mobile.includes('סינון משימות ולוחות'));
  assert.ok(mobile.includes('selectedBoardIds'));
  assert.ok(mobile.includes('mode: "full"'));
  assert.ok(mobile.includes('setSidebarOpen(false)'));
  assert.doesNotMatch(mobile, /onTouchStart|onTouchMove|onTouchEnd|draggable/);
});

test('notification settings register the device, not only permission', () => {
  const source = read('src/components/NotificationSettings.tsx');
  assert.ok(source.includes('push.subscribe()'));
  assert.doesNotMatch(source, /Notification.requestPermission/);
  const hook = read('src/hooks/usePushNotifications.ts');
  assert.ok(hook.includes('.eq("user_id", user.id).eq("endpoint", subscription.endpoint).maybeSingle()'));
  assert.ok(hook.includes('זו בדיקה מקומית בלבד'));
});
