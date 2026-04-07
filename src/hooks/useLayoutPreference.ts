import { useState, useCallback } from "react";

export type LayoutMode = "tabs" | "sidebar" | "compact" | "bottom-nav" | "hamburger" | "dashboard-cards" | "split-view";

const STORAGE_KEY = "site-layout-mode";

const VALID_MODES: LayoutMode[] = ["tabs", "sidebar", "compact", "bottom-nav", "hamburger", "dashboard-cards", "split-view"];

const getStored = (): LayoutMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && VALID_MODES.includes(v as LayoutMode)) return v as LayoutMode;
  } catch {}
  return "tabs";
};

export function useLayoutPreference() {
  const [layout, setLayoutState] = useState<LayoutMode>(getStored);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("site-appearance-change"));
  }, []);

  return { layout, setLayout };
}
