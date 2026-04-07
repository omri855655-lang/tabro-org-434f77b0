import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SitePreferences {
  themeId?: string;
  mode?: "light" | "dark";
  fontId?: string;
  layout?: string;
  showHebrewDate?: boolean;
  customColors?: Record<string, any>;
  lang?: string;
}

const STORAGE_KEYS = {
  theme: "site-theme-id",
  mode: "site-theme-mode",
  font: "site-font-id",
  layout: "site-layout-mode",
  hebrewDate: "site-show-hebrew-date",
  customColors: "site-custom-colors",
  lang: "ui-language",
};

function getLocalPrefs(): SitePreferences {
  try {
    return {
      themeId: localStorage.getItem(STORAGE_KEYS.theme) || "default",
      mode: (localStorage.getItem(STORAGE_KEYS.mode) as "light" | "dark") || "light",
      fontId: localStorage.getItem(STORAGE_KEYS.font) || "rubik",
      layout: localStorage.getItem(STORAGE_KEYS.layout) || "tabs",
      showHebrewDate: localStorage.getItem(STORAGE_KEYS.hebrewDate) === "true",
      customColors: JSON.parse(localStorage.getItem(STORAGE_KEYS.customColors) || "{}"),
      lang: localStorage.getItem(STORAGE_KEYS.lang) || "he",
    };
  } catch {
    return {};
  }
}

function applyPrefsToLocal(prefs: SitePreferences) {
  if (prefs.themeId) localStorage.setItem(STORAGE_KEYS.theme, prefs.themeId);
  if (prefs.mode) localStorage.setItem(STORAGE_KEYS.mode, prefs.mode);
  if (prefs.fontId) localStorage.setItem(STORAGE_KEYS.font, prefs.fontId);
  if (prefs.layout) localStorage.setItem(STORAGE_KEYS.layout, prefs.layout);
  if (prefs.showHebrewDate !== undefined) localStorage.setItem(STORAGE_KEYS.hebrewDate, String(prefs.showHebrewDate));
  if (prefs.customColors) localStorage.setItem(STORAGE_KEYS.customColors, JSON.stringify(prefs.customColors));
  if (prefs.lang) localStorage.setItem(STORAGE_KEYS.lang, prefs.lang);
}

export function useSyncedPreferences() {
  const { user } = useAuth();
  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load from DB on login
  useEffect(() => {
    if (!user || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("site_preferences")
        .eq("user_id", user.id)
        .single();

      if (data?.site_preferences && typeof data.site_preferences === "object") {
        const dbPrefs = data.site_preferences as SitePreferences;
        // Only apply if DB has non-empty prefs
        if (dbPrefs.themeId || dbPrefs.layout || dbPrefs.lang) {
          applyPrefsToLocal(dbPrefs);
          // Trigger re-render by dispatching storage event
          window.dispatchEvent(new CustomEvent("site-appearance-change"));
          // Reload to apply all settings cleanly
          window.location.reload();
        }
      }
    })();
  }, [user]);

  // Save to DB when local prefs change (debounced)
  const saveToDb = useCallback(() => {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const prefs = getLocalPrefs();
      await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          site_preferences: prefs as any,
        }, { onConflict: "user_id" });
    }, 1500);
  }, [user]);

  // Listen for appearance changes and save
  useEffect(() => {
    if (!user) return;

    const handler = () => saveToDb();
    window.addEventListener("site-appearance-change", handler);
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("site-appearance-change", handler);
      window.removeEventListener("storage", handler);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [user, saveToDb]);
}
