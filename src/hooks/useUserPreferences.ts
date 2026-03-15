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
  { id: "deeply", name: "Deeply", removable: true },
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
      setHiddenTabs((data.hidden_tabs as string[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

  const toggleTab = useCallback(async (tabId: string) => {
    if (!user) return;
    
    const newHidden = hiddenTabs.includes(tabId)
      ? hiddenTabs.filter(t => t !== tabId)
      : [...hiddenTabs, tabId];

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
    return !hiddenTabs.includes(tabId);
  }, [hiddenTabs]);

  return { hiddenTabs, loading, toggleTab, isTabVisible };
}
