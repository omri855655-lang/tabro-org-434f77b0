import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type BoardTheme = "default" | "colorful" | "minimal" | "gradient" | "dark" | "pastel" | "ocean" | "forest" | "sunset" | "notion" | "trello" | "glass";

export const BOARD_THEMES: { value: BoardTheme; label: string; description: string }[] = [
  { value: "default", label: "קלאסי", description: "עיצוב רגיל" },
  { value: "colorful", label: "צבעוני", description: "גבולות וכותרות צבעוניים" },
  { value: "minimal", label: "מינימלי", description: "נקי ופשוט" },
  { value: "gradient", label: "גרדיאנט", description: "רקע עם מעברי צבע" },
  { value: "dark", label: "כהה", description: "גוונים כהים" },
  { value: "pastel", label: "פסטל", description: "צבעי פסטל רכים" },
  { value: "ocean", label: "אוקיינוס", description: "גווני כחול ותכלת" },
  { value: "forest", label: "יער", description: "גווני ירוק טבעיים" },
  { value: "sunset", label: "שקיעה", description: "כתום וורוד חם" },
  { value: "notion", label: "Notion", description: "סגנון נוטיון נקי" },
  { value: "trello", label: "Trello", description: "סגנון טרלו" },
  { value: "glass", label: "זכוכית", description: "אפקט שקיפות" },
];

export interface CustomBoard {
  id: string;
  name: string;
  icon: string;
  statuses: string[];
  show_in_dashboard: boolean;
  sort_order: number;
  theme: BoardTheme;
}

export function useCustomBoards() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<CustomBoard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoards = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("custom_boards")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order");
    if (!error && data) {
      setBoards(data.map((b: any) => ({
        ...b,
        statuses: Array.isArray(b.statuses) ? b.statuses : JSON.parse(b.statuses || "[]"),
        theme: b.theme || "default",
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  const addBoard = async (name: string, statuses: string[], showInDashboard: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("custom_boards").insert({
      user_id: user.id,
      name,
      statuses: JSON.stringify(statuses),
      show_in_dashboard: showInDashboard,
      sort_order: boards.length,
    });
    if (error) throw error;
    await fetchBoards();
  };

  const deleteBoard = async (id: string) => {
    const { error } = await supabase.from("custom_boards").delete().eq("id", id);
    if (error) throw error;
    await fetchBoards();
  };

  const updateBoard = async (id: string, updates: Partial<CustomBoard>) => {
    const toUpdate: any = { ...updates };
    if (updates.statuses) toUpdate.statuses = JSON.stringify(updates.statuses);
    const { error } = await supabase.from("custom_boards").update(toUpdate).eq("id", id);
    if (error) throw error;
    await fetchBoards();
  };

  return { boards, loading, addBoard, deleteBoard, updateBoard, refetch: fetchBoards };
}
