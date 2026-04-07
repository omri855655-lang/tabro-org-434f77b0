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
  const loadedForUserRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load from DB on login
  useEffect(() => {
    if (!user) {
      loadedForUserRef.current = null;
      return;
    }

    if (loadedForUserRef.current === user.id) return;
    loadedForUserRef.current = user.id;

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("site_preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || !data?.site_preferences || typeof data.site_preferences !== "object") {
        return;
      }

      const dbPrefs = data.site_preferences as SitePreferences;
      applyPrefsToLocal({
        ...getLocalPrefs(),
        ...dbPrefs,
      });
      window.dispatchEvent(new CustomEvent("site-appearance-change"));
    })();

    return () => {
      cancelled = true;
    };
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
