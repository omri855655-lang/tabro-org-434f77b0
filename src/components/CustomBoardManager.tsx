import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Check, X, LayoutGrid, List, Palette } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { type BoardTheme, BOARD_THEMES } from "@/hooks/useCustomBoards";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface BoardItem {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface CustomBoardManagerProps {
  boardId: string;
  boardName: string;
  statuses: string[];
}

/* ───────── Kanban Column ───────── */
const KanbanColumn = ({
  status,
  items,
  onDrop,
  onDelete,
  onEditNotes,
  draggedId,
  setDraggedId,
}: {
  status: string;
  items: BoardItem[];
  onDrop: (itemId: string, newStatus: string) => void;
  onDelete: (id: string) => void;
  onEditNotes: (item: BoardItem) => void;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
}) => {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex-1 min-w-[200px] rounded-lg border-2 transition-colors ${
        over ? "border-primary bg-primary/5" : "border-border bg-muted/20"
      }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id, status);
      }}
    >
      <div className="p-3 border-b font-semibold text-sm text-center bg-muted/40 rounded-t-lg">
        {status}
        <span className="text-xs text-muted-foreground mr-1">({items.length})</span>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDraggedId(item.id);
              e.dataTransfer.setData("text/plain", item.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDraggedId(null)}
            className={`p-3 rounded-md border bg-card shadow-sm cursor-grab active:cursor-grabbing transition-opacity ${
              draggedId === item.id ? "opacity-40" : "opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-sm font-medium flex-1">{item.title}</span>
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEditNotes(item)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────── Main Component ───────── */
const CustomBoardManager = ({ boardId, boardName, statuses }: CustomBoardManagerProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<BoardItem>>({});
  const [viewMode, setViewMode] = useState<"table" | "kanban">(statuses.length >= 3 ? "kanban" : "table");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("custom_board_items")
      .select("*")
      .eq("board_id", boardId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setItems(data || []);
    setLoading(false);
  }, [user, boardId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("custom_board_items").insert({
      board_id: boardId,
      user_id: user.id,
      title: newTitle.trim(),
      status: statuses[0] || "לביצוע",
    });
    if (error) { toast.error("שגיאה בהוספה"); return; }
    setNewTitle("");
    fetchItems();
    toast.success("נוסף בהצלחה");
  };

  const updateItem = async (id: string, updates: Partial<BoardItem>) => {
    const { error } = await supabase.from("custom_board_items").update(updates).eq("id", id);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    setEditingId(null);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("custom_board_items").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    fetchItems();
  };

  const startEdit = (item: BoardItem) => {
    setEditingId(item.id);
    setEditValues({ title: item.title, notes: item.notes || "" });
  };

  const handleKanbanDrop = (itemId: string, newStatus: string) => {
    updateItem(itemId, { status: newStatus });
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{boardName}</h2>
        <div className="flex gap-1 border rounded-lg p-0.5">
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="h-7 gap-1 text-xs"
            onClick={() => setViewMode("table")}
          >
            <List className="h-3.5 w-3.5" />
            טבלה
          </Button>
          <Button
            size="sm"
            variant={viewMode === "kanban" ? "default" : "ghost"}
            className="h-7 gap-1 text-xs"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            קנבן
          </Button>
        </div>
      </div>

      {/* Add new item */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="הוסף פריט חדש..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
            />
            <Button onClick={addItem} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit modal overlay */}
      {editingId && viewMode === "kanban" && (
        <Card className="border-primary">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">עריכת פריט</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={editValues.title || ""}
              onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
              placeholder="שם הפריט"
            />
            <Textarea
              value={editValues.notes || ""}
              onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
              placeholder="הערות..."
              className="min-h-[60px]"
            />
            <Button size="sm" onClick={() => updateItem(editingId, editValues)} className="gap-1">
              <Check className="h-3 w-3" />שמור
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {statuses.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              items={items.filter((i) => i.status === status)}
              onDrop={handleKanbanDrop}
              onDelete={deleteItem}
              onEditNotes={startEdit}
              draggedId={draggedId}
              setDraggedId={setDraggedId}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>הערות</TableHead>
                  <TableHead className="w-[100px]">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      אין פריטים עדיין
                    </TableCell>
                  </TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input
                          value={editValues.title || ""}
                          onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                          className="h-8"
                        />
                      ) : item.title}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        onValueChange={(val) => updateItem(item.id, { status: val })}
                      >
                        <SelectTrigger className="h-8 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Textarea
                          value={editValues.notes || ""}
                          onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                          className="h-8 min-h-[32px]"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{item.notes || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {editingId === item.id ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => updateItem(item.id, editValues)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setEditingId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => startEdit(item)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => deleteItem(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomBoardManager;
