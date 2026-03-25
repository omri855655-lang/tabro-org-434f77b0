import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY_PREFIX = "field-history-";
const MAX_ITEMS = 50;

/**
 * Stores and retrieves previously entered values for autocomplete suggestions.
 * Uses localStorage as primary store, with optional Supabase persistence.
 */
export function useFieldHistory(fieldName: string) {
  const storageKey = STORAGE_KEY_PREFIX + fieldName;

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Sync from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("user_preferences")
          .select("custom_categories")
          .eq("user_id", user.id)
          .single();

        if (data) {
          const prefs = data.custom_categories as any;
          if (prefs && typeof prefs === 'object' && !Array.isArray(prefs) && prefs[`field_history_${fieldName}`]) {
            const supabaseHistory = prefs[`field_history_${fieldName}`] as string[];
            if (Array.isArray(supabaseHistory) && supabaseHistory.length > 0) {
              setHistory(prev => {
                const merged = [...new Set([...supabaseHistory, ...prev])].slice(0, MAX_ITEMS);
                localStorage.setItem(storageKey, JSON.stringify(merged));
                return merged;
              });
            }
          }
        }
      } catch {
        // silently fail - localStorage still works
      }
    };
    loadFromSupabase();
  }, [fieldName, storageKey]);

  const addToHistory = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setHistory(prev => {
      const filtered = prev.filter(v => v.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      // Also persist to Supabase
      (async () => {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Get existing preferences
          const { data: existing } = await supabase
            .from("user_preferences")
            .select("custom_categories")
            .eq("user_id", user.id)
            .single();

          let currentPrefs: any = {};
          if (existing?.custom_categories && typeof existing.custom_categories === 'object' && !Array.isArray(existing.custom_categories)) {
            currentPrefs = existing.custom_categories;
          }

          currentPrefs[`field_history_${fieldName}`] = updated;

          await supabase
            .from("user_preferences")
            .upsert({
              user_id: user.id,
              custom_categories: currentPrefs as any,
            } as any, { onConflict: "user_id" });
        } catch {
          // silently fail
        }
      })();

      return updated;
    });
  }, [storageKey, fieldName]);

  const getSuggestions = useCallback((query: string): string[] => {
    if (!query.trim()) return history.slice(0, 10);
    const q = query.toLowerCase().trim();
    return history.filter(v => v.toLowerCase().includes(q)).slice(0, 10);
  }, [history]);

  return { history, addToHistory, getSuggestions };
}
