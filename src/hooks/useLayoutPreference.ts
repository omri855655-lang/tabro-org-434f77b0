import { useState, useCallback } from "react";

export type LayoutMode = "tabs" | "sidebar" | "compact";

const STORAGE_KEY = "site-layout-mode";

const getStored = (): LayoutMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "sidebar" || v === "compact") return v;
  } catch {}
  return "tabs";
};

export function useLayoutPreference() {
  const [layout, setLayoutState] = useState<LayoutMode>(getStored);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  return { layout, setLayout };
}
