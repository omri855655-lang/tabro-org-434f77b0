import { useCallback, useEffect, useState } from "react";

export type SiteAppearanceMode = "light" | "dark";

export interface SiteThemePreset {
  id: string;
  name: string;
  description: string;
}

export const SITE_THEME_PRESETS: SiteThemePreset[] = [
  { id: "default", name: "נקי", description: "מראה בהיר ונעים עם כחול קלאסי" },
  { id: "paper", name: "לבן צלול", description: "מסך לבן ובהיר במיוחד עם תחושה נקייה" },
  { id: "ocean", name: "אוקיינוס", description: "כחול-טורקיז מרגיע עם עומק" },
  { id: "mint", name: "מנטה", description: "ירקרק רך וחד לעבודה יומיומית" },
  { id: "ember", name: "אמבר", description: "חם, מודגש ומעוצב בגוונים כתומים-אדמדמים" },
  { id: "sunset", name: "שקיעה", description: "חם, אנרגטי ועם ניגודיות גבוהה" },
  { id: "lavender", name: "לבנדר", description: "רגוע, אלגנטי ומעט יצירתי" },
  { id: "graphite", name: "גרפיט", description: "אפור-פחם מקצועי וממוקד" },
];

const STORAGE_THEME_KEY = "site-theme-id";
const STORAGE_MODE_KEY = "site-theme-mode";
const SITE_APPEARANCE_EVENT = "site-appearance-change";

const getStoredThemeId = () => {
  if (typeof window === "undefined") return "default";
  const saved = window.localStorage.getItem(STORAGE_THEME_KEY);
  return SITE_THEME_PRESETS.some((theme) => theme.id === saved) ? saved! : "default";
};

const getStoredMode = (): SiteAppearanceMode => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_MODE_KEY);
  return saved === "dark" ? "dark" : "light";
};

export const applySiteAppearance = (themeId: string, mode: SiteAppearanceMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.siteTheme = themeId;
  root.classList.toggle("dark", mode === "dark");
};

export const initializeSiteAppearance = () => {
  applySiteAppearance(getStoredThemeId(), getStoredMode());
};

const persistSiteAppearance = (themeId: string, mode: SiteAppearanceMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_THEME_KEY, themeId);
  window.localStorage.setItem(STORAGE_MODE_KEY, mode);
  applySiteAppearance(themeId, mode);
  window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT));
};

export function useSiteAppearance() {
  const [themeId, setThemeIdState] = useState(getStoredThemeId);
  const [mode, setModeState] = useState<SiteAppearanceMode>(getStoredMode);

  useEffect(() => {
    initializeSiteAppearance();

    const syncAppearance = () => {
      setThemeIdState(getStoredThemeId());
      setModeState(getStoredMode());
    };

    window.addEventListener("storage", syncAppearance);
    window.addEventListener(SITE_APPEARANCE_EVENT, syncAppearance);

    return () => {
      window.removeEventListener("storage", syncAppearance);
      window.removeEventListener(SITE_APPEARANCE_EVENT, syncAppearance);
    };
  }, []);

  const setThemeId = useCallback((nextThemeId: string) => {
    persistSiteAppearance(nextThemeId, mode);
    setThemeIdState(nextThemeId);
  }, [mode]);

  const setMode = useCallback((nextMode: SiteAppearanceMode) => {
    persistSiteAppearance(themeId, nextMode);
    setModeState(nextMode);
  }, [themeId]);

  const toggleMode = useCallback(() => {
    const nextMode: SiteAppearanceMode = mode === "dark" ? "light" : "dark";
    persistSiteAppearance(themeId, nextMode);
    setModeState(nextMode);
  }, [mode, themeId]);

  const currentTheme = SITE_THEME_PRESETS.find((theme) => theme.id === themeId) || SITE_THEME_PRESETS[0];

  return {
    themeId,
    mode,
    isDark: mode === "dark",
    themes: SITE_THEME_PRESETS,
    currentTheme,
    setThemeId,
    setMode,
    toggleMode,
  };
}