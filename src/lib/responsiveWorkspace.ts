export const COMPACT_WORKSPACE_QUERY = '(max-width: 1023px)';
export const PHONE_QUERY = '(max-width: 767px)';
export const MOBILE_PRIMARY_TABS = ['dashboard', 'tasks', 'planner', 'payments'] as const;

export function mobilePrimaryTabs<T extends { id: string }>(tabs: T[]): T[] {
  return MOBILE_PRIMARY_TABS.flatMap(id => {
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
