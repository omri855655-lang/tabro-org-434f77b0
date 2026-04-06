import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface RecycleBinItem {
  id: string;
  source_table: string;
  source_id: string;
  item_data: Record<string, any>;
  deleted_at: string;
  expires_at: string;
}

export function useRecycleBin() {
  const { user } = useAuth();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("recycle_bin")
        .select("*")
        .eq("user_id", user.id)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      setItems((data as any[]) || []);
    } catch (e: any) {
      console.error("Error fetching recycle bin:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const softDelete = useCallback(async (sourceTable: string, sourceId: string, itemData: Record<string, any>) => {
    if (!user) return false;
    try {
      // Insert into recycle bin
      const { error: binError } = await supabase.from("recycle_bin").insert({
        user_id: user.id,
        source_table: sourceTable,
        source_id: sourceId,
        item_data: itemData,
      } as any);
      if (binError) throw binError;

      // Delete from source table
      const { error: delError } = await supabase.from(sourceTable as any).delete().eq("id", sourceId);
      if (delError) throw delError;

      await fetchItems();
      return true;
    } catch (e: any) {
      console.error("Soft delete error:", e);
      toast.error("שגיאה במחיקה");
      return false;
    }
  }, [user, fetchItems]);

  const restore = useCallback(async (binItem: RecycleBinItem) => {
    if (!user) return false;
    try {
      const { id, source_table, source_id, item_data } = binItem;

      // Re-insert into source table
      const { error: insertError } = await supabase.from(source_table as any).insert(item_data as any);
      if (insertError) throw insertError;

      // Remove from recycle bin
      const { error: delError } = await supabase.from("recycle_bin").delete().eq("id", id);
      if (delError) throw delError;

      await fetchItems();
      toast.success("הפריט שוחזר בהצלחה");
      return true;
    } catch (e: any) {
      console.error("Restore error:", e);
      toast.error("שגיאה בשחזור");
      return false;
    }
  }, [user, fetchItems]);

  const permanentDelete = useCallback(async (binId: string) => {
    try {
      const { error } = await supabase.from("recycle_bin").delete().eq("id", binId);
      if (error) throw error;
      await fetchItems();
      toast.success("נמחק לצמיתות");
    } catch (e: any) {
      toast.error("שגיאה במחיקה");
    }
  }, [fetchItems]);

  const emptyBin = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("recycle_bin").delete().eq("user_id", user.id);
      if (error) throw error;
      setItems([]);
      toast.success("סל המחזור רוקן");
    } catch (e: any) {
      toast.error("שגיאה בריקון סל המחזור");
    }
  }, [user]);

  return { items, loading, softDelete, restore, permanentDelete, emptyBin, refetch: fetchItems };
}
