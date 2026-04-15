import { useCallback, useEffect, useState } from "react";

export type DashboardGroupingMode = "flat" | "grouped";
export type DashboardCategoryKey = "focus" | "media" | "life" | "money" | "admin";
export type DashboardGroupingAssignments = Record<string, DashboardCategoryKey>;

const STORAGE_KEY = "dashboard-grouping-mode";
const ASSIGNMENTS_STORAGE_KEY = "dashboard-grouping-assignments";
const VALID_MODES: DashboardGroupingMode[] = ["flat", "grouped"];
const VALID_CATEGORIES: DashboardCategoryKey[] = ["focus", "media", "life", "money", "admin"];

const getStored = (): DashboardGroupingMode => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && VALID_MODES.includes(value as DashboardGroupingMode)) {
      return value as DashboardGroupingMode;
    }
  } catch {}
  return "flat";
};

export function useDashboardGroupingPreference() {
  const [groupingMode, setGroupingModeState] = useState<DashboardGroupingMode>(getStored);

  useEffect(() => {
    const sync = () => setGroupingModeState(getStored());
    window.addEventListener("storage", sync);
    window.addEventListener("site-appearance-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("site-appearance-change", sync);
    };
  }, []);

  const setGroupingMode = useCallback((mode: DashboardGroupingMode) => {
    setGroupingModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("site-appearance-change"));
  }, []);

  return { groupingMode, setGroupingMode };
}

const getStoredAssignments = (): DashboardGroupingAssignments => {
  try {
    const value = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    if (!value) return {};
    const parsed = JSON.parse(value) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, category]) => VALID_CATEGORIES.includes(category as DashboardCategoryKey))
    ) as DashboardGroupingAssignments;
  } catch {
    return {};
  }
};

export function useDashboardGroupingAssignments() {
  const [assignments, setAssignmentsState] = useState<DashboardGroupingAssignments>(getStoredAssignments);

  useEffect(() => {
    const sync = () => setAssignmentsState(getStoredAssignments());
    window.addEventListener("storage", sync);
    window.addEventListener("site-appearance-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("site-appearance-change", sync);
    };
  }, []);

  const setAssignment = useCallback((tabId: string, category: DashboardCategoryKey) => {
    setAssignmentsState((prev) => {
      const next = { ...prev, [tabId]: category };
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("site-appearance-change"));
      return next;
    });
  }, []);

  const resetAssignments = useCallback(() => {
    setAssignmentsState({});
    localStorage.removeItem(ASSIGNMENTS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("site-appearance-change"));
  }, []);

  return { assignments, setAssignment, resetAssignments };
}
