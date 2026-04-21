import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// All available default tabs
export const DEFAULT_TABS = [
  { id: "dashboard", name: "דשבורד", removable: false },
  { id: "tasks", name: "משימות אישיות", removable: true },
  { id: "work", name: "משימות עבודה", removable: true },
  { id: "books", name: "ספרים", removable: true },
  { id: "shows", name: "סדרות", removable: true },
  { id: "podcasts", name: "פודקאסטים", removable: true },
  { id: "routine", name: "לוז יומי", removable: true },
  { id: "projects", name: "פרויקטים", removable: true },
  { id: "courses", name: "קורסים", removable: true },
  { id: "planner", name: "מתכנן לוז", removable: true },
  { id: "zoneflow", name: "ZoneFlow", removable: true },
  { id: "nutrition", name: "תזונה ושינה", removable: true },
  { id: "dreams", name: "מפת חלומות", removable: true },
  { id: "shopping", name: "קניות", removable: true },
  { id: "payments", name: "הכנסות והוצאות", removable: true },
  { id: "settings", name: "הגדרות", removable: false },
];

export function useUserPreferences() {
  const { user } = useAuth();
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    
    const { data } = await supabase
      .from("user_preferences")
      .select("hidden_tabs")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const normalized = ((data.hidden_tabs as string[]) || []).map((tab) => tab === "deeply" ? "zoneflow" : tab);
      setHiddenTabs(normalized);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

  const toggleTab = useCallback(async (tabId: string) => {
    if (!user) return;
    
    const normalizedTabId = tabId === "deeply" ? "zoneflow" : tabId;
    const newHidden = hiddenTabs.includes(normalizedTabId)
      ? hiddenTabs.filter(t => t !== normalizedTabId)
      : [...hiddenTabs.filter(t => t !== "deeply"), normalizedTabId];

    setHiddenTabs(newHidden);

    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        hidden_tabs: newHidden,
      }, { onConflict: "user_id" });

    if (error) console.error("Error saving preferences:", error);
  }, [user, hiddenTabs]);

  const isTabVisible = useCallback((tabId: string) => {
    const normalizedTabId = tabId === "deeply" ? "zoneflow" : tabId;
    return !hiddenTabs.includes(normalizedTabId) && !hiddenTabs.includes("deeply");
  }, [hiddenTabs]);

  return { hiddenTabs, loading, toggleTab, isTabVisible };
}
