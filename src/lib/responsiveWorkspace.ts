export const COMPACT_WORKSPACE_QUERY = '(max-width: 1023px)';
export const PHONE_QUERY = '(max-width: 767px)';
export const MOBILE_PRIMARY_TABS = ['dashboard', 'tasks', 'planner', 'payments', 'zoneflow'] as const;

export function normalizeMobileShortcuts(value: unknown): string[] {
  if (!Array.isArray(value)) return [...MOBILE_PRIMARY_TABS];
  const used = new Set<string>();
  return MOBILE_PRIMARY_TABS.map((_, index) => {
    const id = value[index];
    if (typeof id !== 'string' || !id || used.has(id)) return '';
    used.add(id);
    return id;
  });
}

export function setMobileShortcut(slots: readonly string[], position: number, id: string): string[] {
  const next = normalizeMobileShortcuts(slots);
  if (!Number.isInteger(position) || position < 0 || position >= next.length) return next;
  const existing = id ? next.indexOf(id) : -1;
  if (existing >= 0) next[existing] = next[position];
  next[position] = id;
  return next;
}

export function mobilePrimaryTabs<T extends { id: string }>(tabs: T[], shortcuts: readonly string[] = MOBILE_PRIMARY_TABS): T[] {
  return shortcuts.flatMap(id => {
    const tab = tabs.find(item => item.id === id);
    return tab ? [tab] : [];
  });
}
export function filterWorkspaceTabs<T extends { label: string }>(tabs: T[], search: string): T[] {
  const query = search.trim().normalize('NFKC').toLocaleLowerCase();
  return query ? tabs.filter(tab => tab.label.normalize('NFKC').toLocaleLowerCase().includes(query)) : tabs;
}
export type DashboardViewMode = 'table' | 'kanban' | 'list' | 'cards' | 'compact' | 'timeline' | 'summary' | 'deep';
const VIEWS: DashboardViewMode[] = ['table', 'kanban', 'list', 'cards', 'compact', 'timeline', 'summary', 'deep'];
export interface DashboardDisplayPrefs { viewMode: DashboardViewMode; themeKey: string; mobileViewMode?: DashboardViewMode }
export function normalizeDisplayPrefs(value: unknown): DashboardDisplayPrefs {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { viewMode: VIEWS.includes(row.viewMode as DashboardViewMode) ? row.viewMode as DashboardViewMode : 'table', themeKey: typeof row.themeKey === 'string' ? row.themeKey : 'default', ...(VIEWS.includes(row.mobileViewMode as DashboardViewMode) ? { mobileViewMode: row.mobileViewMode as DashboardViewMode } : {}) };
}
export function workspaceView(preferences: DashboardDisplayPrefs, mobile: boolean, mobileDefault?: DashboardViewMode): DashboardViewMode {
  return mobile && mobileDefault ? preferences.mobileViewMode || mobileDefault : preferences.viewMode;
}
