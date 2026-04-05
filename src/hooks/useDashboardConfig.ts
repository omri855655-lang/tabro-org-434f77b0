import { useState, useCallback, useEffect } from "react";

export type DashboardSectionViewMode = "default" | "compact" | "cards";

export interface DashboardSectionConfig {
  id: string;
  label: string;
  visible: boolean;
  viewMode: DashboardSectionViewMode;
}

const DEFAULT_SECTIONS: DashboardSectionConfig[] = [
  { id: "date", label: "תאריך ושעה", visible: true, viewMode: "default" },
  { id: "quickStats", label: "סטטיסטיקות מהירות", visible: true, viewMode: "default" },
  { id: "tasks", label: "דשבורד משימות", visible: true, viewMode: "default" },
  { id: "checkedItems", label: "ארכיון פריטים שסומנו", visible: true, viewMode: "default" },
  { id: "productivity", label: "דשבורד פרודוקטיביות", visible: true, viewMode: "default" },
  { id: "booksChart", label: "התפלגות ספרים", visible: true, viewMode: "default" },
  { id: "showsChart", label: "התפלגות סדרות/סרטים", visible: true, viewMode: "default" },
  { id: "comparison", label: "השוואה כללית", visible: true, viewMode: "default" },
  { id: "progress", label: "התקדמות קריאה וצפייה", visible: true, viewMode: "default" },
  { id: "customBoards", label: "לוחות מותאמים", visible: true, viewMode: "default" },
];

const STORAGE_KEY = "dashboard-section-config";

export function useDashboardConfig() {
  const [sections, setSections] = useState<DashboardSectionConfig[]>(DEFAULT_SECTIONS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: DashboardSectionConfig[] = JSON.parse(raw);
        // Merge with defaults to handle new sections
        const merged = DEFAULT_SECTIONS.map(def => {
          const found = saved.find(s => s.id === def.id);
          return found ? { ...def, visible: found.visible, viewMode: found.viewMode } : def;
        });
        // Reorder based on saved order
        const orderedIds = saved.map(s => s.id);
        merged.sort((a, b) => {
          const aIdx = orderedIds.indexOf(a.id);
          const bIdx = orderedIds.indexOf(b.id);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
        setSections(merged);
      }
    } catch {}
  }, []);

  const persist = useCallback((next: DashboardSectionConfig[]) => {
    setSections(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    persist(sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  }, [sections, persist]);

  const setViewMode = useCallback((id: string, viewMode: DashboardSectionViewMode) => {
    persist(sections.map(s => s.id === id ? { ...s, viewMode } : s));
  }, [sections, persist]);

  const moveSection = useCallback((id: string, direction: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    persist(next);
  }, [sections, persist]);

  const resetToDefault = useCallback(() => {
    persist([...DEFAULT_SECTIONS]);
  }, [persist]);

  return { sections, toggleVisibility, setViewMode, moveSection, resetToDefault };
}
