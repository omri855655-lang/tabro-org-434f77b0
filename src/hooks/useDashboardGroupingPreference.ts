import { useCallback, useEffect, useState } from "react";

export type DashboardGroupingMode = "flat" | "grouped";

const STORAGE_KEY = "dashboard-grouping-mode";
const VALID_MODES: DashboardGroupingMode[] = ["flat", "grouped"];

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
