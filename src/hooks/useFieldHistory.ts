import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY_PREFIX = "field-history-";
const MAX_ITEMS = 50;

/**
 * Stores and retrieves previously entered values for autocomplete suggestions.
 * Uses localStorage, grouped by field name.
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

  const addToHistory = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setHistory(prev => {
      const filtered = prev.filter(v => v.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

  const getSuggestions = useCallback((query: string): string[] => {
    if (!query.trim()) return history.slice(0, 10);
    const q = query.toLowerCase().trim();
    return history.filter(v => v.toLowerCase().includes(q)).slice(0, 10);
  }, [history]);

  return { history, addToHistory, getSuggestions };
}
