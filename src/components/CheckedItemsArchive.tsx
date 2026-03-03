import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CheckedItem {
  id: string;
  title: string;
  notes: string | null;
  checked_at: string;
}

export default function CheckedItemsArchive() {
  const { user } = useAuth();
  const [items, setItems] = useState<CheckedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(true);

  const fetchItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("checked_items")
      .select("id, title, notes, checked_at")
      .eq("user_id", user.id)
      .order("checked_at", { ascending: false });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const addItem = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("checked_items").insert({
      user_id: user.id,
      title: newTitle.trim(),
      notes: newNotes.trim() || null,
    });
    if (error) {
      toast.error("שגיאה בהוספה");
    } else {
      toast.success("נוסף בהצלחה");
      setNewTitle("");
      setNewNotes("");
      setShowAdd(false);
      fetchItems();
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from("checked_items")
      .update({ notes: notes || null })
      .eq("id", id);
    if (!error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));
      setEditingId(null);
      toast.success("עודכן");
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("checked_items").delete().eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("נמחק");
    }
  };

  const filtered = search
    ? items.filter(
        (i) =>
          i.title.includes(search) ||
          (i.notes && i.notes.includes(search))
      )
    : items;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            דברים שנבדקו ({items.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-3">
          {/* Add new */}
          {showAdd && (
            <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
              <Input
                placeholder="מה בדקת?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                dir="rtl"
              />
              <Textarea
                placeholder="הערות / מה זה היה... (אופציונלי)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                dir="rtl"
                className="min-h-[60px]"
              />
              <Button size="sm" onClick={addItem} disabled={!newTitle.trim()}>
                הוסף
              </Button>
            </div>
          )}

          {/* Search */}
          {items.length > 3 && (
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir="rtl"
                className="pr-9"
              />
            </div>
          )}

          {loading ? (
            <div className="text-sm text-muted-foreground">טוען…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              {items.length === 0 ? "אין דברים שנבדקו עדיין" : "לא נמצאו תוצאות"}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-3 bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(item.checked_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {editingId === item.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        dir="rtl"
                        className="min-h-[50px] text-sm"
                        placeholder="כתוב הערה..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => updateNotes(item.id, editNotes)}>
                          שמור
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mt-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditNotes(item.notes || "");
                      }}
                    >
                      {item.notes || "לחץ להוספת הערה..."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
