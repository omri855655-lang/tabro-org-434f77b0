import { useCallback, useEffect, useState } from "react";

export type SiteAppearanceMode = "light" | "dark";

export interface SiteThemePreset {
  id: string;
  name: string;
  description: string;
}

export const SITE_THEME_PRESETS: SiteThemePreset[] = [
  { id: "default", name: "נקי", description: "מראה בהיר ונעים עם כחול קלאסי" },
  { id: "focus", name: "Focus", description: "עבודה עמוקה — כהה ומינימלי, בהשראת Linear ו-Arc" },
  { id: "clarity", name: "Clarity", description: "בהיר, נקי ומסודר — בהשראת Notion ו-Things 3" },
  { id: "flow", name: "Flow", description: "חמים ואנרגטי — בהשראת Monday.com ו-Asana" },
  { id: "paper", name: "לבן צלול", description: "מסך לבן ובהיר במיוחד עם תחושה נקייה" },
  { id: "executive", name: "אקסקיוטיב", description: "מראה בוגר, רגוע ומקצועי עם ניווט שמתאים לעבודה יומיומית" },
  { id: "corporate", name: "קורפורייט", description: "עיצוב עסקי מודרני בגוונים כהים עם דגשי זהב" },
  { id: "nordic", name: "נורדי", description: "מינימליסטי וצלול בהשראת עיצוב סקנדינבי" },
  { id: "ocean", name: "אוקיינוס", description: "כחול-טורקיז מרגיע עם עומק" },
  { id: "mint", name: "מנטה", description: "ירקרק רך וחד לעבודה יומיומית" },
  { id: "ember", name: "אמבר", description: "חם, מודגש ומעוצב בגוונים כתומים-אדמדמים" },
  { id: "sunset", name: "שקיעה", description: "חם, אנרגטי ועם ניגודיות גבוהה" },
  { id: "lavender", name: "לבנדר", description: "רגוע, אלגנטי ומעט יצירתי" },
  { id: "graphite", name: "גרפיט", description: "אפור-פחם מקצועי וממוקד" },
  { id: "mint-bg", name: "רקע מנטה", description: "רקע ירקרק רענן עם גווני מנטה" },
  { id: "peach-bg", name: "רקע אפרסק", description: "רקע חמים בגווני אפרסק ורוד רך" },
  { id: "sky-bg", name: "רקע שמיים", description: "רקע תכלת בהיר כמו שמיים" },
  { id: "sand-bg", name: "רקע חול", description: "רקע חמים בגווני חול וקרם" },
  { id: "rose-bg", name: "רקע ורוד", description: "רקע ורוד רך ועדין" },
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

export interface CustomColorOverrides {
  primary?: string;
  background?: string;
  card?: string;
}

const STORAGE_CUSTOM_COLORS_KEY = "site-custom-colors";

const getStoredCustomColors = (): Record<string, CustomColorOverrides> => {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(STORAGE_CUSTOM_COLORS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

const hexToHsl = (hex: string): string | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const applyCustomColors = (themeId: string, customColors: Record<string, CustomColorOverrides>) => {
  if (typeof document === "undefined") return;
  const overrides = customColors[themeId];
  const root = document.documentElement;
  // Clear previous custom overrides
  root.style.removeProperty("--primary");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--background");
  root.style.removeProperty("--card");
  if (!overrides) return;
  if (overrides.primary) {
    const hsl = hexToHsl(overrides.primary);
    if (hsl) { root.style.setProperty("--primary", hsl); root.style.setProperty("--ring", hsl); }
  }
  if (overrides.background) {
    const hsl = hexToHsl(overrides.background);
    if (hsl) root.style.setProperty("--background", hsl);
  }
  if (overrides.card) {
    const hsl = hexToHsl(overrides.card);
    if (hsl) root.style.setProperty("--card", hsl);
  }
};

export const applySiteAppearance = (themeId: string, mode: SiteAppearanceMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.siteTheme = themeId;
  root.classList.toggle("dark", mode === "dark");
  applyCustomColors(themeId, getStoredCustomColors());
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

  const [customColors, setCustomColorsState] = useState<Record<string, CustomColorOverrides>>(getStoredCustomColors);

  const setCustomColor = useCallback((token: keyof CustomColorOverrides, hex: string) => {
    setCustomColorsState(prev => {
      const next = { ...prev, [themeId]: { ...(prev[themeId] || {}), [token]: hex } };
      window.localStorage.setItem(STORAGE_CUSTOM_COLORS_KEY, JSON.stringify(next));
      applyCustomColors(themeId, next);
      window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT));
      return next;
    });
  }, [themeId]);

  const resetCustomColors = useCallback(() => {
    setCustomColorsState(prev => {
      const next = { ...prev };
      delete next[themeId];
      window.localStorage.setItem(STORAGE_CUSTOM_COLORS_KEY, JSON.stringify(next));
      applyCustomColors(themeId, next);
      window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT));
      return next;
    });
  }, [themeId]);

  const currentTheme = SITE_THEME_PRESETS.find((theme) => theme.id === themeId) || SITE_THEME_PRESETS[0];
  const currentCustomColors = customColors[themeId] || {};

  return {
    themeId,
    mode,
    isDark: mode === "dark",
    themes: SITE_THEME_PRESETS,
    currentTheme,
    setThemeId,
    setMode,
    toggleMode,
    customColors: currentCustomColors,
    setCustomColor,
    resetCustomColors,
  };
}