import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Check, X, LayoutGrid, List, Palette, Grid3X3, Clock, AlignJustify, CreditCard } from "lucide-react";
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
  theme?: BoardTheme;
  onThemeChange?: (theme: BoardTheme) => void;
}

/* ───────── Theme Styles ───────── */
const getThemeStyles = (theme: BoardTheme) => {
  switch (theme) {
    case "colorful":
      return {
        columnBorder: "border-2 border-blue-400/50",
        columnBorderOver: "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20",
        columnHeader: "bg-gradient-to-l from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 text-blue-800 dark:text-blue-200",
        card: "border-blue-200/60 dark:border-blue-700/40 bg-card shadow-md hover:shadow-lg transition-shadow",
        tableHeader: "bg-gradient-to-l from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30",
        wrapper: "",
      };
    case "minimal":
      return {
        columnBorder: "border border-border/50",
        columnBorderOver: "border-foreground/30 bg-muted/10",
        columnHeader: "bg-transparent border-b border-border/50",
        card: "border-border/30 bg-transparent shadow-none hover:bg-muted/20 transition-colors",
        tableHeader: "bg-transparent",
        wrapper: "",
      };
    case "gradient":
      return {
        columnBorder: "border-0 bg-gradient-to-b from-primary/5 to-primary/10 rounded-xl",
        columnBorderOver: "from-primary/10 to-primary/20",
        columnHeader: "bg-primary/10 text-primary font-bold",
        card: "border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg hover:scale-[1.02] transition-transform",
        tableHeader: "bg-primary/5",
        wrapper: "bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-xl p-3",
      };
    case "dark":
      return {
        columnBorder: "border-2 border-zinc-700 bg-zinc-900/50 dark:bg-zinc-900/80",
        columnBorderOver: "border-zinc-500 bg-zinc-800/60",
        columnHeader: "bg-zinc-800 text-zinc-100 dark:bg-zinc-800",
        card: "border-zinc-700 bg-zinc-800/80 text-zinc-100 shadow-md dark:bg-zinc-800/90",
        tableHeader: "bg-zinc-800 text-zinc-200",
        wrapper: "bg-zinc-900/30 dark:bg-zinc-900/60 rounded-xl p-3",
      };
    case "pastel":
      return {
        columnBorder: "border-2 border-pink-200/60 bg-pink-50/20 dark:border-pink-800/40 dark:bg-pink-950/10",
        columnBorderOver: "border-pink-300 bg-pink-50/40 dark:bg-pink-950/20",
        columnHeader: "bg-gradient-to-l from-pink-100 to-amber-100 dark:from-pink-900/30 dark:to-amber-900/30 text-pink-700 dark:text-pink-300",
        card: "border-pink-200/50 dark:border-pink-800/30 bg-white/80 dark:bg-card shadow-sm",
        tableHeader: "bg-gradient-to-l from-pink-50 to-amber-50 dark:from-pink-950/20 dark:to-amber-950/20",
        wrapper: "bg-gradient-to-br from-pink-50/30 to-amber-50/30 dark:from-pink-950/10 dark:to-amber-950/10 rounded-xl p-3",
      };
    default:
      return {
        columnBorder: "border-2 border-border bg-muted/20",
        columnBorderOver: "border-primary bg-primary/5",
        columnHeader: "bg-muted/40",
        card: "border bg-card shadow-sm",
        tableHeader: "",
        wrapper: "",
      };
  }
};

/* ───────── Kanban Column ───────── */
const KanbanColumn = ({
  status,
  items,
  onDrop,
  onDelete,
  onEditNotes,
  draggedId,
  setDraggedId,
  themeStyles,
}: {
  status: string;
  items: BoardItem[];
  onDrop: (itemId: string, newStatus: string) => void;
  onDelete: (id: string) => void;
  onEditNotes: (item: BoardItem) => void;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  themeStyles: ReturnType<typeof getThemeStyles>;
}) => {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex-1 min-w-[200px] rounded-lg transition-colors ${
        over ? themeStyles.columnBorderOver : themeStyles.columnBorder
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
      <div className={`p-3 border-b font-semibold text-sm text-center rounded-t-lg ${themeStyles.columnHeader}`}>
        {status}
        <span className="text-xs opacity-60 mr-1">({items.length})</span>
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
            className={`p-3 rounded-md cursor-grab active:cursor-grabbing transition-opacity ${themeStyles.card} ${
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
const CustomBoardManager = ({ boardId, boardName, statuses, theme = "default", onThemeChange }: CustomBoardManagerProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<BoardItem>>({});
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "list" | "cards" | "timeline" | "compact">(statuses.length >= 3 ? "kanban" : "table");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const themeStyles = getThemeStyles(theme);

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
       <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold">{boardName}</h2>
        <div className="flex items-center gap-2">
          {/* Theme Picker */}
          {onThemeChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                  <Palette className="h-3.5 w-3.5" />
                  עיצוב
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">בחר עיצוב</p>
                  {BOARD_THEMES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => onThemeChange(t.value)}
                      className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                        theme === t.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <div className="flex gap-1 border rounded-lg p-0.5 flex-wrap">
          <Button size="sm" variant={viewMode === "table" ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode("table")}>
            <List className="h-3.5 w-3.5" />טבלה
          </Button>
          <Button size="sm" variant={viewMode === "kanban" ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode("kanban")}>
            <LayoutGrid className="h-3.5 w-3.5" />קנבן
          </Button>
          <Button size="sm" variant={viewMode === "list" ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode("list")}>
            <AlignJustify className="h-3.5 w-3.5" />רשימה
          </Button>
          <Button size="sm" variant={viewMode === "cards" ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode("cards")}>
            <CreditCard className="h-3.5 w-3.5" />כרטיסים
          </Button>
          <Button size="sm" variant={viewMode === "timeline" ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode("timeline")}>
            <Clock className="h-3.5 w-3.5" />ציר זמן
          </Button>
          <Button size="sm" variant={viewMode === "compact" ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode("compact")}>
            <Grid3X3 className="h-3.5 w-3.5" />קומפקט
          </Button>
          </div>
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
      {viewMode === "kanban" && (
        <div className={`flex gap-3 overflow-x-auto pb-2 ${themeStyles.wrapper}`}>
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
              themeStyles={themeStyles}
            />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
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
                        <Input value={editValues.title || ""} onChange={(e) => setEditValues({ ...editValues, title: e.target.value })} className="h-8" />
                      ) : item.title}
                    </TableCell>
                    <TableCell>
                      <Select value={item.status} onValueChange={(val) => updateItem(item.id, { status: val })}>
                        <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Textarea value={editValues.notes || ""} onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })} className="h-8 min-h-[32px]" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{item.notes || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {editingId === item.id ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateItem(item.id, editValues)}><Check className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
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

      {/* List View - Simple checklist style */}
      {viewMode === "list" && (
        <div className={`space-y-1 ${themeStyles.wrapper}`}>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין פריטים עדיין</p>
          ) : items.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${themeStyles.card}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${themeStyles.columnHeader}`}>
                    {item.status}
                  </span>
                </div>
                {item.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>}
              </div>
              <Select value={item.status} onValueChange={(val) => updateItem(item.id, { status: val })}>
                <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards Grid View */}
      {viewMode === "cards" && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${themeStyles.wrapper}`}>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 col-span-full">אין פריטים עדיין</p>
          ) : items.map((item) => (
            <Card key={item.id} className={`${themeStyles.card} overflow-hidden`}>
              <div className={`px-3 py-1.5 text-[11px] font-semibold ${themeStyles.columnHeader}`}>
                {item.status}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm leading-tight">{item.title}</h3>
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {item.notes && <p className="text-xs text-muted-foreground line-clamp-3">{item.notes}</p>}
                <Select value={item.status} onValueChange={(val) => updateItem(item.id, { status: val })}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <div className={`relative pr-6 space-y-0 ${themeStyles.wrapper}`}>
          <div className="absolute right-2 top-0 bottom-0 w-0.5 bg-border" />
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין פריטים עדיין</p>
          ) : items.map((item, idx) => (
            <div key={item.id} className="relative flex items-start gap-3 pb-4">
              <div className="absolute right-[3px] top-2 w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
              <div className={`flex-1 p-3 rounded-lg border ${themeStyles.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${themeStyles.columnHeader}`}>
                        {item.status}
                      </span>
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleDateString("he-IL")} • {new Date(item.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compact View - Dense rows */}
      {viewMode === "compact" && (
        <div className={`border rounded-lg overflow-hidden ${themeStyles.wrapper}`}>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין פריטים עדיין</p>
          ) : items.map((item, idx) => (
            <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${idx !== items.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}>
              <span className="font-medium flex-1 truncate">{item.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${themeStyles.columnHeader}`}>
                {item.status}
              </span>
              {item.notes && <span className="text-muted-foreground truncate max-w-[120px] hidden sm:inline">{item.notes}</span>}
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startEdit(item)}><Edit2 className="h-2.5 w-2.5" /></Button>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomBoardManager;
