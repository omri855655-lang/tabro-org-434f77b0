import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AutocompleteInput from "@/components/AutocompleteInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Check, X, LayoutGrid, List, Palette, Grid3X3, Clock, AlignJustify, CreditCard, Archive, ArchiveRestore, FolderPlus, FileText, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { type BoardTheme, BOARD_THEMES } from "@/hooks/useCustomBoards";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BoardItem {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  created_at: string;
  archived: boolean;
  category: string | null;
  sheet_name: string;
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
  const base = {
    columnBorder: "border-2 border-border bg-muted/20",
    columnBorderOver: "border-primary bg-primary/5",
    columnHeader: "bg-muted/40",
    card: "border bg-card shadow-sm",
    tableHeader: "",
    wrapper: "",
  };
  switch (theme) {
    case "colorful":
      return { ...base, columnBorder: "border-2 border-blue-400/50", columnBorderOver: "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20", columnHeader: "bg-gradient-to-l from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 text-blue-800 dark:text-blue-200", card: "border-blue-200/60 dark:border-blue-700/40 bg-card shadow-md hover:shadow-lg transition-shadow", tableHeader: "bg-gradient-to-l from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30", wrapper: "" };
    case "minimal":
      return { ...base, columnBorder: "border border-border/50", columnBorderOver: "border-foreground/30 bg-muted/10", columnHeader: "bg-transparent border-b border-border/50", card: "border-border/30 bg-transparent shadow-none hover:bg-muted/20 transition-colors", tableHeader: "bg-transparent", wrapper: "" };
    case "gradient":
      return { ...base, columnBorder: "border-0 bg-gradient-to-b from-primary/5 to-primary/10 rounded-xl", columnBorderOver: "from-primary/10 to-primary/20", columnHeader: "bg-primary/10 text-primary font-bold", card: "border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg hover:scale-[1.02] transition-transform", tableHeader: "bg-primary/5", wrapper: "bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-xl p-3" };
    case "dark":
      return { ...base, columnBorder: "border-2 border-zinc-700 bg-zinc-900/50 dark:bg-zinc-900/80", columnBorderOver: "border-zinc-500 bg-zinc-800/60", columnHeader: "bg-zinc-800 text-zinc-100 dark:bg-zinc-800", card: "border-zinc-700 bg-zinc-800/80 text-zinc-100 shadow-md dark:bg-zinc-800/90", tableHeader: "bg-zinc-800 text-zinc-200", wrapper: "bg-zinc-900/30 dark:bg-zinc-900/60 rounded-xl p-3" };
    case "pastel":
      return { ...base, columnBorder: "border-2 border-pink-200/60 bg-pink-50/20 dark:border-pink-800/40 dark:bg-pink-950/10", columnBorderOver: "border-pink-300 bg-pink-50/40 dark:bg-pink-950/20", columnHeader: "bg-gradient-to-l from-pink-100 to-amber-100 dark:from-pink-900/30 dark:to-amber-900/30 text-pink-700 dark:text-pink-300", card: "border-pink-200/50 dark:border-pink-800/30 bg-white/80 dark:bg-card shadow-sm", tableHeader: "bg-gradient-to-l from-pink-50 to-amber-50 dark:from-pink-950/20 dark:to-amber-950/20", wrapper: "bg-gradient-to-br from-pink-50/30 to-amber-50/30 dark:from-pink-950/10 dark:to-amber-950/10 rounded-xl p-3" };
    case "ocean":
      return { ...base, columnBorder: "border-2 border-cyan-300/50 bg-cyan-50/10 dark:border-cyan-700/40 dark:bg-cyan-950/10", columnBorderOver: "border-cyan-400 bg-cyan-50/30", columnHeader: "bg-gradient-to-l from-cyan-100 to-sky-100 dark:from-cyan-900/40 dark:to-sky-900/40 text-cyan-800 dark:text-cyan-200", card: "border-cyan-200/50 dark:border-cyan-800/30 bg-white/80 dark:bg-card shadow-sm", tableHeader: "bg-gradient-to-l from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20", wrapper: "bg-gradient-to-br from-cyan-50/20 to-sky-50/20 dark:from-cyan-950/10 dark:to-sky-950/10 rounded-xl p-3" };
    case "forest":
      return { ...base, columnBorder: "border-2 border-emerald-300/50 bg-emerald-50/10 dark:border-emerald-700/40 dark:bg-emerald-950/10", columnBorderOver: "border-emerald-400 bg-emerald-50/30", columnHeader: "bg-gradient-to-l from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 text-emerald-800 dark:text-emerald-200", card: "border-emerald-200/50 dark:border-emerald-800/30 bg-white/80 dark:bg-card shadow-sm", tableHeader: "bg-gradient-to-l from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20", wrapper: "bg-gradient-to-br from-emerald-50/20 to-green-50/20 dark:from-emerald-950/10 dark:to-green-950/10 rounded-xl p-3" };
    case "sunset":
      return { ...base, columnBorder: "border-2 border-orange-300/50 bg-orange-50/10 dark:border-orange-700/40 dark:bg-orange-950/10", columnBorderOver: "border-orange-400 bg-orange-50/30", columnHeader: "bg-gradient-to-l from-orange-100 to-rose-100 dark:from-orange-900/40 dark:to-rose-900/40 text-orange-800 dark:text-orange-200", card: "border-orange-200/50 dark:border-orange-800/30 bg-white/80 dark:bg-card shadow-sm", tableHeader: "bg-gradient-to-l from-orange-50 to-rose-50 dark:from-orange-950/20 dark:to-rose-950/20", wrapper: "bg-gradient-to-br from-orange-50/20 to-rose-50/20 dark:from-orange-950/10 dark:to-rose-950/10 rounded-xl p-3" };
    case "notion":
      return { ...base, columnBorder: "border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50", columnBorderOver: "border-neutral-400 bg-neutral-100 dark:bg-neutral-800", columnHeader: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium text-xs uppercase tracking-wider", card: "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-none hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-colors", tableHeader: "bg-neutral-50 dark:bg-neutral-900", wrapper: "" };
    case "trello":
      return { ...base, columnBorder: "border-0 bg-neutral-200/80 dark:bg-neutral-800/80 rounded-xl", columnBorderOver: "bg-neutral-300/80 dark:bg-neutral-700/80", columnHeader: "bg-transparent text-neutral-700 dark:text-neutral-200 font-bold px-2", card: "border-0 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md transition-shadow rounded-lg", tableHeader: "bg-blue-600 text-white", wrapper: "bg-gradient-to-br from-blue-600/10 to-blue-700/10 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3" };
    case "glass":
      return { ...base, columnBorder: "border border-white/20 dark:border-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-xl", columnBorderOver: "border-white/40 bg-white/20", columnHeader: "bg-white/20 dark:bg-white/10 backdrop-blur-sm text-foreground", card: "border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm shadow-lg hover:bg-white/40 dark:hover:bg-white/10 transition-all", tableHeader: "bg-white/10 backdrop-blur-sm", wrapper: "bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 backdrop-blur-sm rounded-xl p-3" };
    default:
      return base;
  }
};

/* ───────── Kanban Column ───────── */
const KanbanColumn = ({
  status, items, onDrop, onDelete, onEditNotes, onArchive, draggedId, setDraggedId, themeStyles,
}: {
  status: string; items: BoardItem[]; onDrop: (itemId: string, newStatus: string) => void;
  onDelete: (id: string) => void; onEditNotes: (item: BoardItem) => void; onArchive: (id: string) => void;
  draggedId: string | null; setDraggedId: (id: string | null) => void; themeStyles: ReturnType<typeof getThemeStyles>;
}) => {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`flex-1 min-w-[200px] rounded-lg transition-colors ${over ? themeStyles.columnBorderOver : themeStyles.columnBorder}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDrop(id, status); }}
    >
      <div className={`p-3 border-b font-semibold text-sm text-center rounded-t-lg ${themeStyles.columnHeader}`}>
        {status} <span className="text-xs opacity-60 mr-1">({items.length})</span>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {items.map((item) => (
          <div key={item.id} draggable
            onDragStart={(e) => { setDraggedId(item.id); e.dataTransfer.setData("text/plain", item.id); }}
            onDragEnd={() => setDraggedId(null)}
            className={`p-3 rounded-md cursor-grab active:cursor-grabbing transition-opacity ${themeStyles.card} ${draggedId === item.id ? "opacity-40" : ""}`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{item.title}</span>
                {item.category && <Badge variant="outline" className="text-[10px] mr-1 px-1.5 py-0">{item.category}</Badge>}
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEditNotes(item)}><Edit2 className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onArchive(item.id)} title="העבר לארכיב"><Archive className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            {item.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.notes}</p>}
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
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<BoardItem>>({});
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "list" | "cards" | "timeline" | "compact">(statuses.length >= 3 ? "kanban" : "table");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [activeSheet, setActiveSheet] = useState("ראשי");
  const [sheets, setSheets] = useState<string[]>(["ראשי"]);
  const [newSheetName, setNewSheetName] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const themeStyles = getThemeStyles(theme);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("custom_board_items")
      .select("*")
      .eq("board_id", boardId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const mapped = (data as any[]).map(d => ({ ...d, archived: d.archived ?? false, category: d.category ?? null, sheet_name: d.sheet_name ?? "ראשי" }));
      setItems(mapped);
      const uniqueSheets = [...new Set(mapped.map(i => i.sheet_name))];
      if (!uniqueSheets.includes("ראשי")) uniqueSheets.unshift("ראשי");
      setSheets(uniqueSheets);
    }
    setLoading(false);
  }, [user, boardId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const activeItems = items.filter(i => i.sheet_name === activeSheet && !i.archived);
  const archivedItems = items.filter(i => i.sheet_name === activeSheet && i.archived);
  const categories = [...new Set(activeItems.map(i => i.category).filter(Boolean))] as string[];

  const addItem = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("custom_board_items").insert({
      board_id: boardId, user_id: user.id, title: newTitle.trim(),
      status: statuses[0] || "לביצוע", sheet_name: activeSheet,
      category: newCategory.trim() || null,
    } as any);
    if (error) { toast.error("שגיאה בהוספה"); return; }
    setNewTitle(""); setNewCategory("");
    fetchItems(); toast.success("נוסף בהצלחה");
  };

  const updateItem = async (id: string, updates: Partial<BoardItem>) => {
    const { error } = await supabase.from("custom_board_items").update(updates as any).eq("id", id);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    setEditingId(null); fetchItems();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("custom_board_items").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    fetchItems();
  };

  const archiveItem = (id: string) => updateItem(id, { archived: true } as any);
  const unarchiveItem = (id: string) => updateItem(id, { archived: false } as any);

  const startEdit = (item: BoardItem) => {
    setEditingId(item.id);
    setEditValues({ title: item.title, notes: item.notes || "", category: item.category || "" });
  };

  const addSheet = () => {
    if (!newSheetName.trim()) return;
    if (sheets.includes(newSheetName.trim())) { toast.error("גליון בשם זה כבר קיים"); return; }
    setSheets([...sheets, newSheetName.trim()]);
    setActiveSheet(newSheetName.trim());
    setNewSheetName(""); setShowAddSheet(false);
    toast.success("גליון חדש נוצר");
  };

  const deleteSheet = (name: string) => {
    if (name === "ראשי") { toast.error("לא ניתן למחוק את הגליון הראשי"); return; }
    const sheetItems = items.filter(i => i.sheet_name === name);
    if (sheetItems.length > 0 && !confirm(`הגליון "${name}" מכיל ${sheetItems.length} פריטים. למחוק?`)) return;
    sheetItems.forEach(i => deleteItem(i.id));
    setSheets(sheets.filter(s => s !== name));
    if (activeSheet === name) setActiveSheet("ראשי");
    toast.success("גליון נמחק");
  };

  const renderItemActions = (item: BoardItem, compact = false) => (
    <div className="flex gap-0.5 shrink-0">
      <Button size="icon" variant="ghost" className={compact ? "h-5 w-5" : "h-6 w-6"} onClick={() => startEdit(item)}><Edit2 className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /></Button>
      <Button size="icon" variant="ghost" className={compact ? "h-5 w-5" : "h-6 w-6"} onClick={() => archiveItem(item.id)} title="ארכיב"><Archive className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /></Button>
      <Button size="icon" variant="ghost" className={`${compact ? "h-5 w-5" : "h-6 w-6"} text-destructive`} onClick={() => deleteItem(item.id)}><Trash2 className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /></Button>
    </div>
  );

  const renderCategoryBadge = (item: BoardItem) => item.category ? (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 mr-1">{item.category}</Badge>
  ) : null;

  const renderItemsGrouped = (itemsList: BoardItem[], renderFn: (items: BoardItem[]) => React.ReactNode) => {
    if (!groupByCategory || categories.length === 0) return renderFn(itemsList);
    const uncategorized = itemsList.filter(i => !i.category);
    return (
      <div className="space-y-4">
        {categories.map(cat => {
          const catItems = itemsList.filter(i => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <Collapsible key={cat} defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-right p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-sm">{cat}</span>
                <Badge variant="secondary" className="text-[10px]">{catItems.length}</Badge>
                <ChevronDown className="h-3.5 w-3.5 mr-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent>{renderFn(catItems)}</CollapsibleContent>
            </Collapsible>
          );
        })}
        {uncategorized.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground px-2 pb-1">ללא קטגוריה</p>
            {renderFn(uncategorized)}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-xl font-bold">{boardName}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {onThemeChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"><Palette className="h-3.5 w-3.5" />עיצוב</Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 max-h-[300px] overflow-y-auto" align="end">
                <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">בחר עיצוב</p>
                {BOARD_THEMES.map((t) => (
                  <button key={t.value} onClick={() => onThemeChange(t.value)}
                    className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${theme === t.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                    <span>{t.label}</span><span className="text-xs text-muted-foreground">{t.description}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <Button size="sm" variant={groupByCategory ? "default" : "outline"} className="h-7 gap-1 text-xs" onClick={() => setGroupByCategory(!groupByCategory)}>
            <Tag className="h-3.5 w-3.5" />קבוצות
          </Button>
          <div className="flex gap-1 border rounded-lg p-0.5 flex-wrap">
            {([
              ["table", List, "טבלה"], ["kanban", LayoutGrid, "קנבן"], ["list", AlignJustify, "רשימה"],
              ["cards", CreditCard, "כרטיסים"], ["timeline", Clock, "ציר זמן"], ["compact", Grid3X3, "קומפקט"],
            ] as const).map(([mode, Icon, label]) => (
              <Button key={mode} size="sm" variant={viewMode === mode ? "default" : "ghost"} className="h-7 gap-1 text-xs" onClick={() => setViewMode(mode as any)}>
                <Icon className="h-3.5 w-3.5" />{label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Sheets tabs */}
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto">
        {sheets.map(sheet => (
          <div key={sheet} className="flex items-center gap-0.5">
            <Button size="sm" variant={activeSheet === sheet ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setActiveSheet(sheet)}>
              <FileText className="h-3 w-3" />{sheet}
              {items.filter(i => i.sheet_name === sheet && !i.archived).length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1 h-4">{items.filter(i => i.sheet_name === sheet && !i.archived).length}</Badge>
              )}
            </Button>
            {sheet !== "ראשי" && activeSheet === sheet && (
              <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteSheet(sheet)}><X className="h-3 w-3" /></Button>
            )}
          </div>
        ))}
        {showAddSheet ? (
          <div className="flex items-center gap-1">
            <Input className="h-7 w-28 text-xs" placeholder="שם הגליון..." value={newSheetName} onChange={e => setNewSheetName(e.target.value)} onKeyDown={e => e.key === "Enter" && addSheet()} autoFocus />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addSheet}><Check className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setShowAddSheet(false); setNewSheetName(""); }}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddSheet(true)}>
            <FolderPlus className="h-3 w-3" />גליון חדש
          </Button>
        )}
      </div>

      {/* Add new item */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="הוסף פריט חדש..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} className="flex-1 min-w-[150px]" />
            <AutocompleteInput fieldName={`board-category-${boardId}`} value={newCategory} onChange={setNewCategory} placeholder="קטגוריה (אופציונלי)" className="w-36" />
            <Button onClick={addItem} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit overlay for kanban */}
      {editingId && (
        <Card className="border-primary">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">עריכת פריט</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
            </div>
            <Input value={editValues.title || ""} onChange={e => setEditValues({ ...editValues, title: e.target.value })} placeholder="שם" />
            <AutocompleteInput fieldName={`board-category-${boardId}`} value={editValues.category || ""} onChange={(v) => setEditValues({ ...editValues, category: v })} placeholder="קטגוריה" />
            <Textarea value={editValues.notes || ""} onChange={e => setEditValues({ ...editValues, notes: e.target.value })} placeholder="הערות..." className="min-h-[60px]" />
            <Button size="sm" onClick={() => updateItem(editingId, editValues)} className="gap-1"><Check className="h-3 w-3" />שמור</Button>
          </CardContent>
        </Card>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className={`flex gap-3 overflow-x-auto pb-2 ${themeStyles.wrapper}`}>
          {statuses.map(status => (
            <KanbanColumn key={status} status={status} items={activeItems.filter(i => i.status === status)}
              onDrop={(id, s) => updateItem(id, { status: s })} onDelete={deleteItem} onEditNotes={startEdit} onArchive={archiveItem}
              draggedId={draggedId} setDraggedId={setDraggedId} themeStyles={themeStyles} />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && renderItemsGrouped(activeItems, (itemsList) => (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className={themeStyles.tableHeader}>
                  <TableHead>שם</TableHead><TableHead>קטגוריה</TableHead><TableHead>סטטוס</TableHead><TableHead>הערות</TableHead><TableHead className="w-[120px]">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsList.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין פריטים</TableCell></TableRow>
                ) : itemsList.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{editingId === item.id ? <Input value={editValues.title || ""} onChange={e => setEditValues({ ...editValues, title: e.target.value })} className="h-8" /> : item.title}</TableCell>
                    <TableCell>{editingId === item.id ? <Input value={editValues.category || ""} onChange={e => setEditValues({ ...editValues, category: e.target.value })} className="h-8 w-24" /> : <span className="text-xs text-muted-foreground">{item.category || "-"}</span>}</TableCell>
                    <TableCell>
                      <Select value={item.status} onValueChange={val => updateItem(item.id, { status: val })}>
                        <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{editingId === item.id ? <Textarea value={editValues.notes || ""} onChange={e => setEditValues({ ...editValues, notes: e.target.value })} className="h-8 min-h-[32px]" /> : <span className="text-sm text-muted-foreground">{item.notes || "-"}</span>}</TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateItem(item.id, editValues)}><Check className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : renderItemActions(item)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* List View */}
      {viewMode === "list" && renderItemsGrouped(activeItems, (itemsList) => (
        <div className={`space-y-1 ${themeStyles.wrapper}`}>
          {itemsList.length === 0 ? <p className="text-center text-muted-foreground py-8">אין פריטים</p> : itemsList.map(item => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${themeStyles.card}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  {renderCategoryBadge(item)}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${themeStyles.columnHeader}`}>{item.status}</span>
                </div>
                {item.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>}
              </div>
              <Select value={item.status} onValueChange={val => updateItem(item.id, { status: val })}>
                <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              {renderItemActions(item)}
            </div>
          ))}
        </div>
      ))}

      {/* Cards View */}
      {viewMode === "cards" && renderItemsGrouped(activeItems, (itemsList) => (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${themeStyles.wrapper}`}>
          {itemsList.length === 0 ? <p className="text-center text-muted-foreground py-8 col-span-full">אין פריטים</p> : itemsList.map(item => (
            <Card key={item.id} className={`${themeStyles.card} overflow-hidden`}>
              <div className={`px-3 py-1.5 text-[11px] font-semibold ${themeStyles.columnHeader}`}>{item.status}</div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-semibold text-sm leading-tight">{item.title}</h3>{renderCategoryBadge(item)}</div>
                  {renderItemActions(item)}
                </div>
                {item.notes && <p className="text-xs text-muted-foreground line-clamp-3">{item.notes}</p>}
                <Select value={item.status} onValueChange={val => updateItem(item.id, { status: val })}>
                  <SelectTrigger className="h-7 text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {/* Timeline View */}
      {viewMode === "timeline" && renderItemsGrouped(activeItems, (itemsList) => (
        <div className={`relative pr-6 space-y-0 ${themeStyles.wrapper}`}>
          <div className="absolute right-2 top-0 bottom-0 w-0.5 bg-border" />
          {itemsList.length === 0 ? <p className="text-center text-muted-foreground py-8">אין פריטים</p> : itemsList.map(item => (
            <div key={item.id} className="relative flex items-start gap-3 pb-4">
              <div className="absolute right-[3px] top-2 w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
              <div className={`flex-1 p-3 rounded-lg border ${themeStyles.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.title}</span>
                      {renderCategoryBadge(item)}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${themeStyles.columnHeader}`}>{item.status}</span>
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                  </div>
                  {renderItemActions(item)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Compact View */}
      {viewMode === "compact" && renderItemsGrouped(activeItems, (itemsList) => (
        <div className={`border rounded-lg overflow-hidden ${themeStyles.wrapper}`}>
          {itemsList.length === 0 ? <p className="text-center text-muted-foreground py-8">אין פריטים</p> : itemsList.map((item, idx) => (
            <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${idx !== itemsList.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}>
              <span className="font-medium flex-1 truncate">{item.title}</span>
              {item.category && <span className="text-[10px] text-muted-foreground hidden sm:inline">{item.category}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${themeStyles.columnHeader}`}>{item.status}</span>
              {renderItemActions(item, true)}
            </div>
          ))}
        </div>
      ))}

      {/* Archive Section */}
      <Collapsible open={showArchive} onOpenChange={setShowArchive}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Archive className="h-4 w-4" />ארכיב ({archivedItems.length})</span>
            {showArchive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {archivedItems.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">הארכיב ריק</p>
          ) : (
            <div className="space-y-1 mt-2">
              {archivedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 opacity-70">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm line-through">{item.title}</span>
                    {item.category && <Badge variant="outline" className="text-[10px] mr-1 px-1.5 py-0">{item.category}</Badge>}
                    {item.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => unarchiveItem(item.id)}>
                    <ArchiveRestore className="h-3 w-3" />שחזר
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default CustomBoardManager;
