import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mobilePrimaryTabs, filterWorkspaceTabs, normalizeDisplayPrefs, workspaceView, COMPACT_WORKSPACE_QUERY } from '../src/lib/responsiveWorkspace.ts';
import { mobileWorkspaceCopy } from '../src/lib/mobileWorkspaceCopy.ts';

test('mobile shortcuts retain visible dashboards only, with every other tab searchable', () => {
  const tabs = ['dashboard', 'work', 'planner', 'zoneflow', 'shared-1', 'board-1'].map(id => ({ id, label: id }));
  assert.deepEqual(mobilePrimaryTabs(tabs).map(tab => tab.id), ['dashboard', 'planner']);
  assert.equal(filterWorkspaceTabs(tabs, '').length, tabs.length);
  assert.deepEqual(filterWorkspaceTabs(tabs, '  SHARED-1 '), [tabs[4]]);
  assert.deepEqual(filterWorkspaceTabs([{ id: 'a', label: 'משימות עבודה' }, { id: 'b', label: 'תזונה ושינה' }], 'עבודה').map(tab => tab.id), ['a']);
  assert.equal(COMPACT_WORKSPACE_QUERY, '(max-width: 1023px)');
});
test('phone view does not overwrite the desktop view, theme or legacy preferences', () => {
  const saved = normalizeDisplayPrefs({ viewMode: 'kanban', themeKey: 'forest' });
  assert.equal(workspaceView(saved, false, 'list'), 'kanban');
  assert.equal(workspaceView(saved, true, 'list'), 'list');
  const chosen = { ...saved, mobileViewMode: 'table' };
  assert.equal(workspaceView(chosen, true, 'list'), 'table');
  assert.equal(workspaceView(chosen, false, 'list'), 'kanban');
  assert.equal(chosen.themeKey, 'forest');
  assert.equal(workspaceView(saved, true), 'kanban');
  assert.deepEqual(normalizeDisplayPrefs({ viewMode: 'unknown', mobileViewMode: 'invalid' }), { viewMode: 'table', themeKey: 'default' });
  assert.deepEqual(normalizeDisplayPrefs(null), { viewMode: 'table', themeKey: 'default' });
});
test('mobile navigation and tools are translated in all app languages', () => {
  const keys = Object.keys(mobileWorkspaceCopy.he).sort();
  assert.equal(Object.keys(mobileWorkspaceCopy).length, 6);
  for (const copy of Object.values(mobileWorkspaceCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.ok(Object.values(copy).every(value => value.trim()));
  }
});
test('viewport permits zoom and responsive overlays are bounded, rather than clipping data', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1\.0/);
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /safe-area-inset-bottom/); assert.match(css, /--tabro-viewport-height/);
  assert.doesNotMatch(css, /table td, table th\s*\{[\s\S]*?white-space: normal !important/);
  // Desktop too: a long dialog must stay within the window so its close button and final action are reachable.
  assert.match(css, /:where\(\.responsive-dialog\)\s*\{[^}]*max-height: calc\(100dvh - 2rem\);[^}]*overflow-y: auto/);
  const layout = await readFile(new URL('../src/components/layouts/MobileWorkspaceLayout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /viewport\.scale > 1\.05/);
  assert.match(layout, /removeEventListener\('resize', update\)/);
  assert.doesNotMatch(layout, /localStorage\.setItem/);
});
