import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export type DashboardViewMode = "table" | "kanban" | "list" | "cards" | "compact" | "timeline" | "summary" | "deep";

export interface DashboardDisplayPrefs {
  viewMode: DashboardViewMode;
  themeKey: string; // matches BOARD_THEMES values
}

const STORAGE_KEY = "dashboard-display-prefs";

/**
 * Per-tab display preferences (view mode + theme) for built-in dashboards.
 * Stored in localStorage keyed by dashboardId.
 */
export function useDashboardDisplay(dashboardId: string) {
  const [viewMode, setViewMode] = useState<DashboardViewMode>("table");
  const [themeKey, setThemeKey] = useState("default");

  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw);
        if (all[dashboardId]) {
          setViewMode(all[dashboardId].viewMode || "table");
          setThemeKey(all[dashboardId].themeKey || "default");
        }
      }
    } catch {}
  }, [dashboardId]);

  const persist = useCallback((vm: DashboardViewMode, tk: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[dashboardId] = { viewMode: vm, themeKey: tk };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }, [dashboardId]);

  const updateViewMode = useCallback((vm: DashboardViewMode) => {
    setViewMode(vm);
    persist(vm, themeKey);
  }, [themeKey, persist]);

  const updateTheme = useCallback((tk: string) => {
    setThemeKey(tk);
    persist(viewMode, tk);
  }, [viewMode, persist]);

  return { viewMode, themeKey, setViewMode: updateViewMode, setTheme: updateTheme };
}
