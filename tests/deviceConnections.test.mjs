import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describePushEnvironment, withPushTimeout } from '../src/lib/pushEnvironment.ts';

const browser = { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, standalone: true, secure: true, serviceWorker: true, pushManager: true, notifications: true };
test('iPhone requires a Home Screen app and explains missing browser APIs', () => {
  assert.equal(describePushEnvironment(browser).reason, null);
  assert.equal(describePushEnvironment({ ...browser, standalone: false, notifications: false }).reason, 'home-screen');
  assert.equal(describePushEnvironment({ ...browser, notifications: false }).reason, 'unsupported');
  assert.equal(describePushEnvironment({ ...browser, secure: false }).reason, 'insecure');
});
test('desktop-mode iPad is identified but a touch-free Mac is not treated as an iPhone', () => {
  const desktop = { ...browser, userAgent: 'Mozilla Macintosh', platform: 'MacIntel', standalone: false };
  assert.equal(describePushEnvironment(desktop).reason, 'home-screen');
  assert.equal(describePushEnvironment({ ...desktop, maxTouchPoints: 0 }).reason, null);
  assert.equal(describePushEnvironment({ ...browser, userAgent: 'Android', platform: 'Linux', standalone: false }).reason, null);
});
test('worker setup resolves normally or times out instead of disabling controls forever', async () => {
  assert.equal(await withPushTimeout(Promise.resolve('ready'), 20), 'ready');
  await assert.rejects(withPushTimeout(new Promise(() => {}), 5), /push_setup_timeout/);
});
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('permission is requested directly from the button before asynchronous worker setup', () => {
  const subscribe = read('src/hooks/usePushNotifications.ts').split('const subscribe = useCallback')[1];
  assert.ok(subscribe.indexOf('Notification.requestPermission()') < subscribe.indexOf('await getOrRegisterSW()'));
  assert.ok(subscribe.includes('Notification.permission === "denied"'));
  assert.ok(subscribe.includes('readPushEnvironment()'));
  assert.ok(read('src/hooks/usePushNotifications.ts').includes('withPushTimeout(navigator.serviceWorker.getRegistration'));
  assert.ok(!read('src/components/PushNotificationToggle.tsx').includes('if (!isSupported) return null'));
  const repair = read('src/components/PushDeliveryTest.tsx').split('const reRegister = async')[1];
  assert.ok(repair.indexOf('await push.subscribe()') < repair.indexOf('await navigator.serviceWorker.getRegistration'));
});
test('device setup is first in settings and calendar connection is outside hidden mobile tools', () => {
  const settings = read('src/components/SettingsPanel.tsx');
  assert.ok(settings.indexOf('<DeviceConnectionSettings />') < settings.indexOf('{/* Profile Name Card */}'));
  const panel = read('src/components/DeviceConnectionSettings.tsx');
  assert.ok(panel.includes('<AppleCalendarGuide />'));
  assert.ok(panel.includes('push.setupError'));
  assert.ok(panel.includes('disabled={push.loading}'));
  assert.ok(!panel.includes('requestPermission'));
  const planner = read('src/components/PersonalPlanner.tsx');
  assert.ok(planner.indexOf('<AppleCalendarGuide onExport={exportToICS} />') < planner.indexOf('${isMobile && !mobileToolsOpen'));
  assert.equal(planner.split('<AppleCalendarGuide onExport={exportToICS} />').length, 2);
});
