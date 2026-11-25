import { useState, useCallback, useEffect } from "react";
import { useCompactWorkspace } from '@/hooks/use-mobile';
import { normalizeDisplayPrefs, workspaceView, type DashboardDisplayPrefs, type DashboardViewMode } from '@/lib/responsiveWorkspace';
export type { DashboardDisplayPrefs, DashboardViewMode } from '@/lib/responsiveWorkspace';

const STORAGE_KEY = "dashboard-display-prefs";

export function seedBoardView(boardId: string, viewMode: DashboardViewMode) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    all[`custom-board:${boardId}`] = { viewMode };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* Keep the board's normal default if storage is unavailable. */ }
}

/**
 * Per-tab display preferences (view mode + theme) for built-in dashboards.
 * Stored in localStorage keyed by dashboardId.
 */
export function useDashboardDisplay(dashboardId: string, mobileDefault?: DashboardViewMode, defaultView: DashboardViewMode = "table") {
  const mobile = useCompactWorkspace();
  const read = () => {
    try { return normalizeDisplayPrefs({ viewMode: defaultView, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')?.[dashboardId] }); }
    catch { return normalizeDisplayPrefs({ viewMode: defaultView }); }
  };
  const [preferences, setPreferences] = useState<DashboardDisplayPrefs>(read);

  // Load on mount
  useEffect(() => {
    const refresh = () => setPreferences(read());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [dashboardId, defaultView]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((changes: Partial<DashboardDisplayPrefs>) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const all = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      const next = { ...normalizeDisplayPrefs({ viewMode: defaultView, ...all[dashboardId] }), ...changes };
      all[dashboardId] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setPreferences(next);
    } catch { setPreferences(previous => ({ ...previous, ...changes })); }
  }, [dashboardId, defaultView]);

  const updateViewMode = useCallback((vm: DashboardViewMode) => {
    persist(mobile && mobileDefault ? { mobileViewMode: vm } : { viewMode: vm });
  }, [mobile, mobileDefault, persist]);

  const updateTheme = useCallback((tk: string) => {
    persist({ themeKey: tk });
  }, [persist]);

  return { viewMode: workspaceView(preferences, mobile, mobileDefault), themeKey: preferences.themeKey, setViewMode: updateViewMode, setTheme: updateTheme };
}
