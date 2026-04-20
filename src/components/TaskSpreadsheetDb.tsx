import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Download, Check, Clock, AlertCircle, Loader2, Sparkles, ArrowUpDown, Flame, MoveRight, Archive, ArchiveRestore, Brain, Users, Palette, LayoutGrid, List as ListIcon, AlignJustify, CreditCard, Grid3X3 } from "lucide-react";
import { BOARD_THEMES, type BoardTheme } from "@/hooks/useCustomBoards";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDashboardDisplay, type DashboardViewMode } from "@/hooks/useDashboardDisplay";
import { cn } from "@/lib/utils";
import { useTasks, Task } from "@/hooks/useTasks";
import ListView from "@/components/views/ListView";
import CardsView from "@/components/views/CardsView";
import KanbanView from "@/components/views/KanbanView";
import CompactView from "@/components/views/CompactView";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import YearSelector from "@/components/YearSelector";
import TaskTabs from "@/components/TaskTabs";
import MentalDifficultyHelper from "@/components/MentalDifficultyHelper";
import SheetSharingDialog from "@/components/SheetSharingDialog";
import FileImport from "@/components/FileImport";
import ItemDetailDialog from "@/components/ItemDetailDialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface TaskSpreadsheetDbProps {
  title: string;
  taskType: "personal" | "work";
  readOnly?: boolean;
  showYearSelector?: boolean;
  fixedSheetName?: string | null;
  fixedSheetOwnerId?: string;
  ownerDisplayName?: string;
}

interface TaskEditHistoryEntry {
  id: string;
  action_type: string;
  changed_count: number;
  changed_fields: Record<string, { from?: unknown; to?: unknown }>;
  created_at: string;
  edited_by_email: string | null;
  edited_by_name: string | null;
  edited_by_username: string | null;
}

const statusColors: Record<string, string> = {
  "בוצע": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "טרם החל": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  "בטיפול": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const statusIcons: Record<string, typeof Check> = {
  "בוצע": Check,
  "טרם החל": Clock,
  "בטיפול": AlertCircle,
};

const statusOrder: Record<string, number> = {
  "טרם החל": 0,
  "בטיפול": 1,
  "בוצע": 2,
};

type SortOption = "none" | "status" | "plannedEnd" | "overdue" | "createdAt" | "urgent";

type TaskColumnKey =
  | "index"
  | "description"
  | "category"
  | "responsible"
  | "status"
  | "statusNotes"
  | "progress"
  | "plannedEnd"
  | "overdue"
  | "createdAt"
  | "updatedAt"
  | "ai";

const TASK_TABLE_COLUMNS: Array<{ key: TaskColumnKey; label: string; defaultWidth: number }> = [
  { key: "index", label: "דחוף / #", defaultWidth: 90 },
  { key: "description", label: "תיאור המשימה", defaultWidth: 380 },
  { key: "category", label: "סיווג", defaultWidth: 120 },
  { key: "responsible", label: "אחריות", defaultWidth: 130 },
  { key: "status", label: "סטטוס", defaultWidth: 130 },
  { key: "statusNotes", label: "היכן זה עומד", defaultWidth: 240 },
  { key: "progress", label: "משימות שבוצעו", defaultWidth: 240 },
  { key: "plannedEnd", label: "סיום מתוכנן", defaultWidth: 130 },
  { key: "overdue", label: "חריגה", defaultWidth: 90 },
  { key: "createdAt", label: "נוצר", defaultWidth: 150 },
  { key: "updatedAt", label: "עודכן", defaultWidth: 150 },
  { key: "ai", label: "AI", defaultWidth: 200 },
];

const MIN_COLUMN_WIDTH = 72;
const MAX_COLUMN_WIDTH = 520;

const TASK_HISTORY_LABELS: Record<string, string> = {
  description: "תיאור המשימה",
  category: "סיווג",
  responsible: "אחריות",
  status: "סטטוס",
  status_notes: "היכן זה עומד",
  progress: "משימות שבוצעו",
  planned_end: "סיום מתוכנן",
  overdue: "חריגה",
  urgent: "דחוף",
  archived: "ארכוב",
  sheet_name: "גליון",
};

const TASK_ACTION_LABELS: Record<string, string> = {
  created: "יצירה",
  updated: "עריכה",
  archived: "ארכוב",
  restored: "שחזור",
  deleted: "מחיקה",
};

const TaskSpreadsheetDb = ({ title, taskType, readOnly = false, showYearSelector = false, fixedSheetName, fixedSheetOwnerId, ownerDisplayName }: TaskSpreadsheetDbProps) => {
  const isSharedSheet = !!fixedSheetOwnerId;
  const [sharedCollapsed, setSharedCollapsed] = useState(false);
  const { user } = useAuth();
  const { viewMode: dashViewMode, themeKey: dashTheme, setViewMode: setDashViewMode, setTheme: setDashTheme } = useDashboardDisplay(`tasks-${taskType}`);
  const currentYear = String(new Date().getFullYear());
  const MAIN_SHEET_NAME = "ראשי";
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  // null means "all sheets", a string means specific sheet
  const [selectedSheet, setSelectedSheet] = useState<string | null>(fixedSheetName !== undefined ? fixedSheetName : null);
  const effectiveSheet = fixedSheetName !== undefined ? fixedSheetName : selectedSheet;
  const effectiveOwnerId = fixedSheetOwnerId ?? user?.id;
  const { tasks, loading, addTask, updateTask, deleteTask, refetch } = useTasks(taskType, effectiveSheet, effectiveOwnerId);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: string; field: keyof Task } | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedTaskForAi, setSelectedTaskForAi] = useState<Task | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("none");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [taskToMove, setTaskToMove] = useState<Task | null>(null);
  const [targetSheet, setTargetSheet] = useState<string>(currentYear);
  const [activeTaskTab, setActiveTaskTab] = useState<string>("active");
  const [mentalDialogOpen, setMentalDialogOpen] = useState(false);
  const [mentalTask, setMentalTask] = useState<Task | null>(null);
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const stickyHeaderScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"table" | "header" | null>(null);
  const [pendingScrollTaskId, setPendingScrollTaskId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<TaskColumnKey, number>>(() => {
    const defaults = TASK_TABLE_COLUMNS.reduce((acc, column) => {
      acc[column.key] = column.defaultWidth;
      return acc;
    }, {} as Record<TaskColumnKey, number>);

    try {
      const raw = localStorage.getItem(`task-table-widths-${taskType}`);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return TASK_TABLE_COLUMNS.reduce((acc, column) => {
        const value = Number(parsed?.[column.key]);
        acc[column.key] = Number.isFinite(value)
          ? Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, value))
          : defaults[column.key];
        return acc;
      }, {} as Record<TaskColumnKey, number>);
    } catch {
      return defaults;
    }
  });
  const [activeResize, setActiveResize] = useState<{ key: TaskColumnKey; startX: number; startWidth: number } | null>(null);
  const [hideCreatorInfo, setHideCreatorInfo] = useState(() => {
    return localStorage.getItem("hide-creator-info") === "true";
  });
  const [detailHistory, setDetailHistory] = useState<TaskEditHistoryEntry[]>([]);
  const [detailHistoryLoading, setDetailHistoryLoading] = useState(false);

  useEffect(() => {
    if (!pendingScrollTaskId) return;

    const timeoutId = window.setTimeout(() => {
      const row = document.querySelector(`[data-task-row="${pendingScrollTaskId}"]`) as HTMLElement | null;

      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "end" });
      } else if (tableScrollRef.current) {
        tableScrollRef.current.scrollTo({
          top: tableScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }

      setPendingScrollTaskId(null);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [pendingScrollTaskId, tasks, activeTaskTab]);

  useEffect(() => {
    localStorage.setItem(`task-table-widths-${taskType}`, JSON.stringify(columnWidths));
  }, [columnWidths, taskType]);

  useEffect(() => {
    const tableNode = tableScrollRef.current;
    const headerNode = stickyHeaderScrollRef.current;
    if (!tableNode || !headerNode) return;

    const syncFromTable = () => {
      if (syncingScrollRef.current === "header") return;
      syncingScrollRef.current = "table";
      headerNode.scrollLeft = tableNode.scrollLeft;
      window.requestAnimationFrame(() => {
        syncingScrollRef.current = null;
      });
    };

    const syncFromHeader = () => {
      if (syncingScrollRef.current === "table") return;
      syncingScrollRef.current = "header";
      tableNode.scrollLeft = headerNode.scrollLeft;
      window.requestAnimationFrame(() => {
        syncingScrollRef.current = null;
      });
    };

    tableNode.addEventListener("scroll", syncFromTable, { passive: true });
    headerNode.addEventListener("scroll", syncFromHeader, { passive: true });
    return () => {
      tableNode.removeEventListener("scroll", syncFromTable);
      headerNode.removeEventListener("scroll", syncFromHeader);
    };
  }, []);

  useEffect(() => {
    if (!activeResize) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, activeResize.startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [activeResize.key]: nextWidth }));
    };

    const handleMouseUp = () => setActiveResize(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeResize]);

  useEffect(() => {
    if (!detailTask) {
      setDetailHistory([]);
      setDetailHistoryLoading(false);
      return;
    }

    let cancelled = false;

    const fetchTaskHistory = async () => {
      setDetailHistoryLoading(true);
      const { data, error } = await supabase
        .from("task_edit_history")
        .select("id, action_type, changed_count, changed_fields, created_at, edited_by_email, edited_by_name, edited_by_username")
        .eq("task_id", detailTask.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;

      if (error) {
        console.error("Error fetching task edit history:", error);
        setDetailHistory([]);
      } else {
        setDetailHistory((data || []) as TaskEditHistoryEntry[]);
      }
      setDetailHistoryLoading(false);
    };

    void fetchTaskHistory();

    return () => {
      cancelled = true;
    };
  }, [detailTask]);

  const compareSheetNames = useCallback((a: string, b: string) => {
    if (a === MAIN_SHEET_NAME && b !== MAIN_SHEET_NAME) return -1;
    if (b === MAIN_SHEET_NAME && a !== MAIN_SHEET_NAME) return 1;

    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    const aIsNum = !isNaN(aNum);
    const bIsNum = !isNaN(bNum);

    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.localeCompare(b, "he");
  }, []);

  // Fetch available sheets from the task_sheets table (persisted)
  const fetchAvailableSheets = useCallback(async () => {
    if (!user || !showYearSelector) {
      setSheetsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("task_sheets")
        .select("sheet_name")
        .eq("task_type", taskType)
        .eq("user_id", user.id);

      if (error) throw error;

      const sheetNames = [...new Set(data?.map((s) => s.sheet_name?.trim()) || [])].filter(Boolean) as string[];

      if (!sheetNames.includes(MAIN_SHEET_NAME)) {
        sheetNames.push(MAIN_SHEET_NAME);
      }

      if (!sheetNames.includes(currentYear)) {
        sheetNames.push(currentYear);
      }

      setAvailableSheets(sheetNames.sort(compareSheetNames));
    } catch (error) {
      console.error("Error fetching sheets:", error);
      setAvailableSheets([MAIN_SHEET_NAME, currentYear]);
    } finally {
      setSheetsLoading(false);
    }
  }, [user, showYearSelector, taskType, currentYear, compareSheetNames]);

  useEffect(() => {
    fetchAvailableSheets();
  }, [fetchAvailableSheets]);

  const handleAddSheet = async (sheetName: string) => {
    if (availableSheets.includes(sheetName)) {
      // Sheet already exists, just switch to it
      setSelectedSheet(sheetName);
      return;
    }

    if (!user) {
      toast.error("יש להתחבר כדי ליצור גליון חדש");
      return;
    }

    try {
      // Insert new sheet into database
      const { error } = await supabase
        .from("task_sheets")
        .insert([{
          user_id: user.id,
          task_type: taskType,
          sheet_name: sheetName,
        }]);

      if (error) throw error;

      // Update local state
      setAvailableSheets((prev) => [...new Set([...prev, sheetName])].sort(compareSheetNames));
      setSelectedSheet(sheetName);
      toast.success(`גליון "${sheetName}" נוצר בהצלחה`);
    } catch (error: any) {
      console.error("Error adding sheet:", error);
      toast.error("שגיאה ביצירת גליון חדש");
    }
  };

  const handleDeleteSheet = async (sheetName: string) => {
    try {
      // Delete all tasks for this sheet first
      const { error: tasksError } = await supabase
        .from("tasks")
        .delete()
        .eq("task_type", taskType)
        .eq("sheet_name", sheetName);

      if (tasksError) throw tasksError;

      // Delete the sheet record
      const { error: sheetError } = await supabase
        .from("task_sheets")
        .delete()
        .eq("task_type", taskType)
        .eq("sheet_name", sheetName);

      if (sheetError) throw sheetError;

      // Remove sheet from local state
      setAvailableSheets(prev => prev.filter(s => s !== sheetName));
      
      // If currently viewing this sheet, switch to "all"
      if (selectedSheet === sheetName) {
        setSelectedSheet(null);
      }
      
      toast.success(`גליון "${sheetName}" נמחק בהצלחה`);
      refetch();
    } catch (error: any) {
      console.error("Error deleting sheet:", error);
      toast.error("שגיאה במחיקת הגליון");
    }
  };

  // Similar task suggestions
  const getSimilarTasks = useMemo(() => {
    if (!descriptionInput.trim() || descriptionInput.length < 2) return [];
    const input = descriptionInput.toLowerCase();
    return tasks.filter(
      (task) => 
        task.id !== editingTaskId &&
        task.description.toLowerCase().includes(input)
    ).slice(0, 5);
  }, [descriptionInput, tasks, editingTaskId]);

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    if (sortBy === "none") return tasks;
    
    return [...tasks].sort((a, b) => {
      switch (sortBy) {
        case "status":
          const orderA = statusOrder[a.status] ?? 1;
          const orderB = statusOrder[b.status] ?? 1;
          return orderA - orderB;
        case "plannedEnd":
          // Tasks without planned end go to the bottom
          if (!a.plannedEnd && !b.plannedEnd) return 0;
          if (!a.plannedEnd) return 1;
          if (!b.plannedEnd) return -1;
          return new Date(a.plannedEnd).getTime() - new Date(b.plannedEnd).getTime();
        case "overdue":
          // Overdue tasks first, then non-overdue
          const aOverdue = a.overdue && a.status !== "בוצע" ? 0 : 1;
          const bOverdue = b.overdue && b.status !== "בוצע" ? 0 : 1;
          return aOverdue - bOverdue;
        case "createdAt":
          // Newest first
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "urgent":
          // Urgent tasks first
          const aUrgent = a.urgent ? 0 : 1;
          const bUrgent = b.urgent ? 0 : 1;
          return aUrgent - bUrgent;
        default:
          return 0;
      }
    });
  }, [tasks, sortBy]);

  const handleCellChange = useCallback(
    (taskId: string, field: keyof Task, value: string) => {
      updateTask(taskId, { [field]: value });
    },
    [updateTask]
  );

  const handleStatusChange = useCallback(
    (taskId: string, status: Task["status"]) => {
      updateTask(taskId, { status });
    },
    [updateTask]
  );

  // Fetch user profile for auto-responsible
  const [userProfileName, setUserProfileName] = useState<string>("");
  
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const name = data.display_name || 
          [data.first_name, data.last_name].filter(Boolean).join(' ') || 
          data.username || user.email || "";
        setUserProfileName(name);
      } else {
        setUserProfileName(user.email || "");
      }
    };
    fetchProfile();
  }, [user]);

  const handleAddTask = async () => {
    const defaultResponsible = taskType === "work" ? userProfileName : "";
    setActiveTaskTab("active");
    const newTask = await addTask(selectedSheet ?? currentYear, { responsible: defaultResponsible });
    if (!newTask) return;
    setSelectedRow(newTask.id);
    setPendingScrollTaskId(newTask.id);
  };

  const handleDeleteTask = async () => {
    if (selectedRow) {
      await deleteTask(selectedRow);
      setSelectedRow(null);
    }
  };

  const handleMoveTask = async () => {
    if (!taskToMove) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ sheet_name: targetSheet })
        .eq("id", taskToMove.id);

      if (error) throw error;

      toast.success(`המשימה הועברה לגליון "${targetSheet}"`);
      setMoveDialogOpen(false);
      setTaskToMove(null);
      refetch();
    } catch (error: any) {
      console.error("Error moving task:", error);
      toast.error("שגיאה בהעברת משימה");
    }
  };

  const handleArchiveTask = async (task: Task) => {
    try {
      await updateTask(task.id, { archived: !task.archived });
      toast.success(task.archived ? "המשימה הוחזרה מהארכיון" : "המשימה הועברה לארכיון");
    } catch (error: any) {
      console.error("Error archiving task:", error);
      toast.error("שגיאה בארכוב משימה");
    }
  };

  const handleSaveTaskDetails = async () => {
    if (!detailTask) return;
    await updateTask(detailTask.id, {
      description: detailTask.description,
      category: detailTask.category,
      responsible: detailTask.responsible,
      status: detailTask.status,
      statusNotes: detailTask.statusNotes,
      progress: detailTask.progress,
      plannedEnd: detailTask.plannedEnd,
      urgent: detailTask.urgent,
    });
    setDetailTask(null);
    toast.success("פרטי המשימה נשמרו");
  };

  const handleAiHelp = async (task: Task) => {
    if (!task.description.trim()) {
      toast.error("נא להזין תיאור משימה לפני בקשת עזרה מ-AI");
      return;
    }
    
    setSelectedTaskForAi(task);
    setAiDialogOpen(true);
    setAiLoading(true);
    setAiSuggestion("");

    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: { taskDescription: task.description, taskCategory: task.category },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAiSuggestion(data.suggestion || "לא התקבלה תגובה מה-AI");
    } catch (error: any) {
      console.error("AI error:", error);
      toast.error(error.message || "שגיאה בקבלת עזרה מ-AI");
      setAiDialogOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const renderHistoryChangeSummary = (entry: TaskEditHistoryEntry) => {
    const fieldKeys = Object.keys(entry.changed_fields || {});
    if (fieldKeys.length === 0) {
      return TASK_ACTION_LABELS[entry.action_type] || entry.action_type;
    }
    return fieldKeys
      .map((key) => TASK_HISTORY_LABELS[key] || key)
      .join(" ,");
  };

  const exportToCSV = () => {
    const headers = taskHeaders.join(",");
    const rows = tasks.map((task, index) =>
      [
        index + 1,
        `"${task.description}"`,
        `"${task.category}"`,
        `"${task.responsible}"`,
        `"${task.status}"`,
        `"${task.statusNotes}"`,
        `"${task.progress}"`,
        `"${task.plannedEnd}"`,
        task.overdue ? "כן" : "לא",
      ].join(",")
    );
    const csvContent = [headers, ...rows].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.csv`;
    link.click();
  };

  const handleImportTasks = async (rows: Record<string, string>[]) => {
    if (!user) return;
    for (const row of rows) {
      const desc = row['תיאור'] || row['משימה'] || row['description'] || row['title'] || Object.values(row)[0] || '';
      if (!desc.trim()) continue;
      await addTask(effectiveSheet ?? undefined, { description: desc.trim() });
    }
    refetch();
  };

  const completedCount = tasks.filter((t) => t.status === "בוצע").length;
  const pendingCount = tasks.filter((t) => t.status === "טרם החל").length;
  const inProgressCount = tasks.filter((t) => t.status === "בטיפול").length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const getColumnStyle = useCallback((key: TaskColumnKey) => ({
    width: columnWidths[key],
    minWidth: columnWidths[key],
  }), [columnWidths]);

  // Editable cell with suggestions for description
  const EditableCellWithSuggestions = ({
    value,
    taskId,
    className,
    onSave,
    onCancel,
  }: {
    value: string;
    taskId: string;
    className: string;
    onSave: (value: string) => void;
    onCancel: () => void;
  }) => {
    const [editValue, setEditValue] = useState(value);
    const [showSuggestionsLocal, setShowSuggestionsLocal] = useState(false);

    const similarTasks = useMemo(() => {
      if (!editValue.trim() || editValue.length < 2) return [];
      const input = editValue.toLowerCase();
      return tasks.filter(
        (task) => 
          task.id !== taskId &&
          task.description.toLowerCase().includes(input)
      ).slice(0, 5);
    }, [editValue, taskId]);

    return (
      <div className="relative">
        <textarea
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setShowSuggestionsLocal(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowSuggestionsLocal(false);
              onSave(editValue);
            }, 200);
          }}
          onKeyDown={(e) => {
            // Ctrl+K or Ctrl+Enter for new line
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'Enter')) {
              e.preventDefault();
              const target = e.target as HTMLTextAreaElement;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const newValue = editValue.substring(0, start) + '\n' + editValue.substring(end);
              setEditValue(newValue);
              // Set cursor position after the newline
              setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 1;
              }, 0);
              return;
            }
            if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
              e.preventDefault();
              setShowSuggestionsLocal(false);
              onSave(editValue);
            } else if (e.key === "Escape") {
              setShowSuggestionsLocal(false);
              onCancel();
            }
          }}
          className={cn(
            "w-full bg-transparent outline-none ring-2 ring-primary rounded px-1 resize-none min-h-[32px]",
            className
          )}
          autoFocus
          dir="rtl"
          rows={Math.max(1, editValue.split('\n').length)}
        />
        {showSuggestionsLocal && similarTasks.length > 0 && (
          <div className="absolute top-full right-0 left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
            <div className="p-2 text-xs text-muted-foreground border-b">משימות דומות:</div>
            {similarTasks.map((task) => (
              <div
                key={task.id}
                className="px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setEditValue(task.description);
                }}
              >
                <span className="font-medium">{task.description}</span>
                <span className={cn(
                  "mr-2 text-xs px-1.5 py-0.5 rounded",
                  statusColors[task.status]
                )}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Fetch ALL unique values for category and responsible across ALL tasks (not just current sheet)
  // sorted by most recent usage
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allResponsibles, setAllResponsibles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAllValues = async () => {
      // Fetch all tasks for this user, ordered by updated_at desc
      const { data } = await supabase
        .from("tasks")
        .select("category, responsible, updated_at")
        .order("updated_at", { ascending: false });

      if (data) {
        // Build unique lists preserving most-recent-first order
        const catsSeen = new Set<string>();
        const respsSeen = new Set<string>();
        const cats: string[] = [];
        const resps: string[] = [];
        for (const row of data) {
          if (row.category && !catsSeen.has(row.category)) {
            catsSeen.add(row.category);
            cats.push(row.category);
          }
          if (row.responsible && !respsSeen.has(row.responsible)) {
            respsSeen.add(row.responsible);
            resps.push(row.responsible);
          }
        }
        setAllCategories(cats);
        setAllResponsibles(resps);
      }
    };
    fetchAllValues();
  }, [user, tasks]); // re-fetch when tasks change too

  const existingCategories = allCategories;
  const existingResponsibles = allResponsibles;

  const EditableCellInput = ({
    value,
    field,
    className,
    onSave,
    onCancel,
  }: {
    value: string;
    field: keyof Task;
    className: string;
    onSave: (value: string) => void;
    onCancel: () => void;
  }) => {
    const [editValue, setEditValue] = useState(value);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const suggestions = useMemo(() => {
      if (field !== "category" && field !== "responsible") return [];
      const list = field === "category" ? existingCategories : existingResponsibles;
      if (!editValue.trim()) return list;
      const lower = editValue.toLowerCase();
      // Show startsWith matches first, then includes matches
      const startsWith = list.filter(item => item.toLowerCase().startsWith(lower));
      const includes = list.filter(item => !item.toLowerCase().startsWith(lower) && item.toLowerCase().includes(lower));
      return [...startsWith, ...includes];
    }, [editValue, field]);

    // For date fields, use input type date
    if (field === "plannedEnd") {
      return (
        <input
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => onSave(editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(editValue);
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          className={cn(
            "w-full bg-transparent outline-none ring-2 ring-primary rounded px-1",
            className
          )}
          autoFocus
          dir="auto"
        />
      );
    }

    // For category/responsible fields, show autocomplete
    if (field === "category" || field === "responsible") {
      return (
        <div className="relative">
          <input
            type="text"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowSuggestions(false);
                onSave(editValue);
              }, 200);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setShowSuggestions(false);
                onSave(editValue);
              } else if (e.key === "Escape") {
                setShowSuggestions(false);
                onCancel();
              }
            }}
            className={cn(
              "w-full bg-transparent outline-none ring-2 ring-primary rounded px-1 h-8",
              className
            )}
            autoFocus
            dir="auto"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-36 overflow-auto">
              {suggestions.map((item, index) => (
                <div
                  key={index}
                  className="px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEditValue(item);
                    setShowSuggestions(false);
                    onSave(item);
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // For text fields, use textarea to support multiline with Ctrl+K
    return (
      <textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => {
          // Ctrl+K or Ctrl+Enter for new line
          if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'Enter')) {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newValue = editValue.substring(0, start) + '\n' + editValue.substring(end);
            setEditValue(newValue);
            setTimeout(() => {
              target.selectionStart = target.selectionEnd = start + 1;
            }, 0);
            return;
          }
          if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            onSave(editValue);
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className={cn(
          "w-full bg-transparent outline-none ring-2 ring-primary rounded px-1 resize-none min-h-[32px]",
          className
        )}
        autoFocus
        dir="auto"
        rows={Math.max(1, editValue.split('\n').length)}
      />
    );
  };

  const renderEditableCell = (
    value: string,
    taskId: string,
    field: keyof Task,
    className: string = ""
  ) => {
    const isEditing = editingCell?.row === taskId && editingCell?.field === field;

    if (isEditing) {
      // Use special component with suggestions for description field
      if (field === "description") {
        return (
          <EditableCellWithSuggestions
            value={value}
            taskId={taskId}
            className={className}
            onSave={(newValue) => {
              handleCellChange(taskId, field, newValue);
              setEditingCell(null);
            }}
            onCancel={() => setEditingCell(null)}
          />
        );
      }

      return (
        <EditableCellInput
          value={value}
          field={field}
          className={className}
          onSave={(newValue) => {
            handleCellChange(taskId, field, newValue);
            setEditingCell(null);
          }}
          onCancel={() => setEditingCell(null)}
        />
      );
    }

    return (
      <span
        className={cn(readOnly ? "cursor-default" : "cursor-text", className)}
        onDoubleClick={() => {
          if (readOnly) return;
          setEditingCell({ row: taskId, field });
        }}
        dir="auto"
      >
        {value || "-"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2 text-muted-foreground">טוען משימות...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" dir="rtl">
      {/* Shared sheet collapse toggle */}
      {isSharedSheet && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/30 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSharedCollapsed(!sharedCollapsed)}
            className="gap-1"
          >
            {sharedCollapsed ? "▸" : "▾"}
            <span className="text-sm font-medium">{title}</span>
          </Button>
          {ownerDisplayName && (
            <span className="text-xs text-muted-foreground">משותף מ: {ownerDisplayName}</span>
          )}
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            readOnly ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}>
            {readOnly ? "צפייה בלבד" : "עריכה"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newVal = !hideCreatorInfo;
              setHideCreatorInfo(newVal);
              localStorage.setItem("hide-creator-info", String(newVal));
            }}
            className="text-xs gap-1 mr-auto"
          >
            <Users className="h-3 w-3" />
            {hideCreatorInfo ? "הצג יוצר" : "הסתר יוצר"}
          </Button>
        </div>
      )}
      {/* Show creator toggle also for owned sheets (not shared) */}
      {!isSharedSheet && showYearSelector && (
        <div className="flex items-center justify-end px-4 py-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newVal = !hideCreatorInfo;
              setHideCreatorInfo(newVal);
              localStorage.setItem("hide-creator-info", String(newVal));
            }}
            className="text-xs gap-1"
          >
            <Users className="h-3 w-3" />
            {hideCreatorInfo ? "הצג יוצר/עורך" : "הסתר יוצר/עורך"}
          </Button>
        </div>
      )}
      {isSharedSheet && sharedCollapsed ? null : (
        <>
      {/* Sheet Selector */}
      {showYearSelector && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <YearSelector 
              selectedYear={selectedSheet} 
              onYearChange={setSelectedSheet}
              years={availableSheets}
              onAddYear={handleAddSheet}
              onDeleteYear={handleDeleteSheet}
            />
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const sheetToShare = selectedSheet ?? MAIN_SHEET_NAME;
                if (!user) return;

                const { error } = await supabase.from("task_sheets").upsert(
                  {
                    user_id: user.id,
                    task_type: taskType,
                    sheet_name: sheetToShare,
                  },
                  { onConflict: "user_id,task_type,sheet_name" }
                );

                if (error) {
                  toast.error("שגיאה בפתיחת שיתוף הגליון");
                  return;
                }

                setSharingDialogOpen(true);
              }}
              className="gap-1 ml-2 mr-2 shrink-0"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">שתף</span>
            </Button>
          )}
        </div>
      )}

      {/* Stats Bar - sticky */}
      <div className="flex items-center gap-6 px-4 py-3 bg-card border-b border-border sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">בוצע: {completedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-sm text-muted-foreground">טרם החל: {pendingCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-muted-foreground">בטיפול: {inProgressCount}</span>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className="text-sm font-medium">אחוז ביצוע:</span>
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <span className="text-sm font-bold text-primary">{completionRate}%</span>
        </div>
      </div>

      {/* Toolbar - sticky below stats */}
      <div className="border-b border-border bg-muted/30 sticky top-[52px] z-20">
        <div className="flex items-center gap-2 p-3">
        <h2 className="text-lg font-semibold text-foreground ml-4">{title}</h2>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleAddTask}>
              <Plus className="h-4 w-4 ml-1" />
              משימה חדשה
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteTask}
              disabled={selectedRow === null}
            >
              <Trash2 className="h-4 w-4 ml-1" />
              מחק משימה
            </Button>
          </div>
        )}
        <div className="mr-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[160px] h-8">
              <ArrowUpDown className="h-4 w-4 ml-1" />
              <SelectValue placeholder="מיון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא מיון</SelectItem>
              <SelectItem value="status">לפי סטטוס</SelectItem>
              <SelectItem value="plannedEnd">לפי סיום מתוכנן</SelectItem>
              <SelectItem value="createdAt">לפי תאריך יצירה</SelectItem>
              <SelectItem value="overdue">לפי חריגה</SelectItem>
              <SelectItem value="urgent">לפי דחיפות</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 ml-1" />
            ייצוא
          </Button>
          {!readOnly && <FileImport onImport={handleImportTasks} label="ייבוא משימות" />}
          {/* View mode buttons */}
          <div className="flex items-center border rounded-md overflow-hidden h-8">
            {([
              { mode: "table" as DashboardViewMode, icon: Grid3X3, label: "טבלה" },
              { mode: "list" as DashboardViewMode, icon: ListIcon, label: "רשימה" },
              { mode: "cards" as DashboardViewMode, icon: LayoutGrid, label: "כרטיסים" },
              { mode: "kanban" as DashboardViewMode, icon: CreditCard, label: "קנבן" },
              { mode: "compact" as DashboardViewMode, icon: AlignJustify, label: "קומפקט" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setDashViewMode(mode)}
                className={cn(
                  "px-2 h-full flex items-center gap-1 text-xs transition-colors",
                  dashViewMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          {/* Dashboard display controls */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                <Palette className="h-3.5 w-3.5" />עיצוב
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 max-h-[300px] overflow-y-auto" align="end">
              <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">בחר עיצוב</p>
              {BOARD_THEMES.map((t) => (
                <button key={t.value} onClick={() => setDashTheme(t.value)}
                  className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${dashTheme === t.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                  <span>{t.label}</span><span className="text-xs text-muted-foreground">{t.description}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        </div>
        {/* Sticky category/column headers bar */}
        <div ref={stickyHeaderScrollRef} className="overflow-x-auto border-t border-border/50">
          <div className="flex items-stretch bg-muted/50 text-[11px] text-muted-foreground min-w-max">
            {TASK_TABLE_COLUMNS.map((column) => (
              <div
                key={column.key}
                className="relative shrink-0 px-3 py-1.5 border-l border-border/40 font-medium"
                style={getColumnStyle(column.key)}
              >
                <span>{column.label}</span>
                <button
                  type="button"
                  className="absolute left-0 top-0 h-full w-2 cursor-col-resize opacity-30 hover:opacity-100 focus:opacity-100 bg-primary/20"
                  aria-label={`שנה רוחב עמודת ${column.label}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setActiveResize({
                      key: column.key,
                      startX: event.clientX,
                      startWidth: columnWidths[column.key],
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Tabs with Table */}
      <TaskTabs 
        tasks={tasks} 
        activeTab={activeTaskTab} 
        onTabChange={setActiveTaskTab}
      >
        {(filteredTasks, viewMode) => {
          // Sort the filtered tasks
          const displayTasks = [...filteredTasks].sort((a, b) => {
            if (sortBy === "none") return 0;
            switch (sortBy) {
              case "status":
                const orderA = statusOrder[a.status] ?? 1;
                const orderB = statusOrder[b.status] ?? 1;
                return orderA - orderB;
              case "plannedEnd":
                if (!a.plannedEnd && !b.plannedEnd) return 0;
                if (!a.plannedEnd) return 1;
                if (!b.plannedEnd) return -1;
                return new Date(a.plannedEnd).getTime() - new Date(b.plannedEnd).getTime();
              case "overdue":
                const aOverdue = a.overdue && a.status !== "בוצע" ? 0 : 1;
                const bOverdue = b.overdue && b.status !== "בוצע" ? 0 : 1;
                return aOverdue - bOverdue;
              case "createdAt":
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              case "urgent":
                const aUrgent = a.urgent ? 0 : 1;
                const bUrgent = b.urgent ? 0 : 1;
                return aUrgent - bUrgent;
              default:
                return 0;
            }
          });

          if (filteredTasks.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-lg">
                  {viewMode === "archive" ? "אין משימות בארכיון" : 
                   viewMode === "completed" ? "אין משימות שבוצעו" : 
                   "אין משימות עדיין"}
                </p>
                {!readOnly && viewMode === "active" && (
                  <Button variant="outline" className="mt-4" onClick={handleAddTask}>
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף משימה ראשונה
                  </Button>
                )}
              </div>
            );
          }

          const taskStatusOptions = [
            { value: "טרם החל", label: "טרם החל" },
            { value: "בטיפול", label: "בטיפול" },
            { value: "בוצע", label: "בוצע" },
          ];

          const kanbanColumns = [
            { value: "טרם החל", label: "טרם החל", color: "bg-muted" },
            { value: "בטיפול", label: "בטיפול", color: "bg-amber-100 dark:bg-amber-900/30" },
            { value: "בוצע", label: "בוצע", color: "bg-green-100 dark:bg-green-900/30" },
          ];

          // Non-table view modes
          if (dashViewMode === "list") {
            return (
              <div className="p-3 overflow-auto h-full">
                <ListView
                  items={displayTasks.map(t => ({
                    id: t.id,
                    title: t.description || "(ללא תיאור)",
                    subtitle: [t.category, t.responsible].filter(Boolean).join(" · ") || null,
                    status: t.status,
                    statusOptions: taskStatusOptions,
                    notes: t.statusNotes || t.progress || null,
                    meta: t.plannedEnd || undefined,
                    urgent: t.urgent,
                  }))}
                  onStatusChange={(id, status) => handleStatusChange(id, status as Task["status"])}
                  onDelete={readOnly ? undefined : (id) => { deleteTask(id); }}
                  onNotesChange={readOnly ? undefined : (id, val) => updateTask(id, { statusNotes: val })}
                  onClick={(id) => setSelectedRow(id)}
                />
              </div>
            );
          }

          if (dashViewMode === "cards") {
            return (
              <div className="p-3 overflow-auto h-full">
                <CardsView
                  items={displayTasks.map(t => ({
                    id: t.id,
                    title: t.description || "(ללא תיאור)",
                    subtitle: [t.category, t.responsible].filter(Boolean).join(" · ") || null,
                    status: t.status,
                    statusOptions: taskStatusOptions,
                    notes: t.statusNotes || t.progress || null,
                    meta: t.plannedEnd || undefined,
                    urgent: t.urgent,
                  }))}
                  onStatusChange={(id, status) => handleStatusChange(id, status as Task["status"])}
                  onDelete={readOnly ? undefined : (id) => { deleteTask(id); }}
                  onNotesChange={readOnly ? undefined : (id, val) => updateTask(id, { statusNotes: val })}
                  onClick={(id) => setSelectedRow(id)}
                />
              </div>
            );
          }

          if (dashViewMode === "kanban") {
            return (
              <div className="p-3 overflow-auto h-full">
                <KanbanView
                  items={displayTasks.map(t => ({
                    id: t.id,
                    title: t.description || "(ללא תיאור)",
                    subtitle: [t.category, t.responsible].filter(Boolean).join(" · ") || null,
                    status: t.status,
                    notes: t.statusNotes || null,
                    urgent: t.urgent,
                  }))}
                  columns={kanbanColumns}
                  onStatusChange={(id, status) => handleStatusChange(id, status as Task["status"])}
                  onDelete={readOnly ? undefined : (id) => { deleteTask(id); }}
                  onNotesChange={readOnly ? undefined : (id, val) => updateTask(id, { statusNotes: val })}
                  onClick={(id) => setSelectedRow(id)}
                />
              </div>
            );
          }

          if (dashViewMode === "compact") {
            return (
              <div className="p-3 overflow-auto h-full">
                <CompactView
                  items={displayTasks.map(t => ({
                    id: t.id,
                    title: t.description || "(ללא תיאור)",
                    status: t.status,
                    subtitle: t.category || null,
                    urgent: t.urgent,
                  }))}
                  onDelete={readOnly ? undefined : (id) => { deleteTask(id); }}
                  onClick={(id) => setSelectedRow(id)}
                />
              </div>
            );
          }
          
            return (
            <div ref={tableScrollRef} data-task-table className="min-h-0 h-full overflow-auto scroll-smooth">
              <table className="w-full border-collapse min-w-[1200px]">
            <colgroup>
              {TASK_TABLE_COLUMNS.map((column) => (
                <col key={column.key} style={{ width: columnWidths[column.key] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted">
                {TASK_TABLE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-right text-sm font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                    style={getColumnStyle(column.key)}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((task, rowIndex) => {
                const StatusIcon = statusIcons[task.status] || Clock;
                return (
                  <tr
                    key={task.id}
                    data-task-row={task.id}
                    className={cn(
                      "border-b border-border hover:bg-accent/30 transition-colors cursor-pointer",
                      selectedRow === task.id && "bg-primary/10",
                      task.urgent && "bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500",
                      task.overdue && task.status !== "בוצע" && !task.urgent && "bg-destructive/5"
                    )}
                    onClick={() => setSelectedRow(task.id)}
                    onDoubleClick={() => setDetailTask(task)}
                  >
                    <td className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-1" style={getColumnStyle("index")}>
                      {task.urgent && <Flame className="h-4 w-4 text-red-500" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (readOnly) return;
                          updateTask(task.id, { urgent: !task.urgent });
                        }}
                        className={cn(
                          "w-6 h-6 rounded border flex items-center justify-center transition-colors",
                          task.urgent 
                            ? "bg-red-500 border-red-500 text-white" 
                            : "border-muted-foreground/30 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
                          readOnly && "cursor-default opacity-50"
                        )}
                        title={task.urgent ? "בטל דחיפות" : "סמן כדחוף"}
                        disabled={readOnly}
                      >
                        <Flame className={cn("h-3 w-3", task.urgent ? "text-white" : "text-muted-foreground")} />
                      </button>
                      <span>{rowIndex + 1}</span>
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("description")}>
                      {renderEditableCell(task.description, task.id, "description")}
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("category")}>
                      {renderEditableCell(task.category, task.id, "category", "text-muted-foreground")}
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("responsible")}>
                      {renderEditableCell(task.responsible, task.id, "responsible")}
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("status")}>
                      <Select
                        value={task.status}
                        disabled={readOnly}
                        onValueChange={(value) => {
                          if (readOnly) return;
                          handleStatusChange(task.id, value as Task["status"]);
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-[110px] h-7 text-xs border-0",
                            statusColors[task.status] || statusColors["טרם החל"]
                          )}
                        >
                          <StatusIcon className="h-3 w-3 ml-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="בוצע">
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3" /> בוצע
                            </span>
                          </SelectItem>
                          <SelectItem value="טרם החל">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> טרם החל
                            </span>
                          </SelectItem>
                          <SelectItem value="בטיפול">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> בטיפול
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("statusNotes")}>
                      {renderEditableCell(task.statusNotes, task.id, "statusNotes", "text-muted-foreground text-xs")}
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("progress")}>
                      {renderEditableCell(task.progress, task.id, "progress", "text-muted-foreground text-xs")}
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap" style={getColumnStyle("plannedEnd")}>
                      {renderEditableCell(task.plannedEnd, task.id, "plannedEnd")}
                    </td>
                    <td className="px-3 py-2 text-sm text-center" style={getColumnStyle("overdue")}>
                      {task.overdue && task.status !== "בוצע" ? (
                        <span className="text-destructive font-medium">חריגה</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    {/* Creator info moved under date columns - no separate column needed */}
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap" style={getColumnStyle("createdAt")}>
                      <div>{task.createdAt ? new Date(task.createdAt).toLocaleDateString('he-IL') + ' ' + new Date(task.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                      {/* Always show AI attribution, respect hideCreatorInfo for human users */}
                      {task.creatorEmail === 'ai@tabro.app' && (
                        <div className="text-[10px] text-purple-500/80 mt-0.5 flex items-center gap-0.5">
                          🤖 נוסף ע״י Tabro AI
                        </div>
                      )}
                      {!hideCreatorInfo && task.creatorName && task.creatorEmail !== user?.email && task.creatorEmail !== 'ai@tabro.app' && (
                        <div className="text-[10px] text-primary/70 mt-0.5">
                          נוצר ע״י: {task.creatorName || task.creatorEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap" style={getColumnStyle("updatedAt")}>
                      <div>{task.updatedAt ? new Date(task.updatedAt).toLocaleDateString('he-IL') + ' ' + new Date(task.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                      {task.lastEditorEmail === 'ai@tabro.app' && (
                        <div className="text-[10px] text-purple-500/80 mt-0.5 flex items-center gap-0.5">
                          🤖 עודכן ע״י Tabro AI
                        </div>
                      )}
                      {!hideCreatorInfo && task.lastEditorName && task.lastEditorEmail !== user?.email && task.lastEditorEmail !== 'ai@tabro.app' && (
                        <div className="text-[10px] text-blue-500/70 mt-0.5">
                          עודכן ע״י: {task.lastEditorName || task.lastEditorEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm" style={getColumnStyle("ai")}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAiHelp(task);
                          }}
                          className="h-7 gap-1 text-primary hover:text-primary"
                          title="קבל עזרה מ-AI"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="text-xs">AI</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMentalTask(task);
                            setMentalDialogOpen(true);
                          }}
                          className="h-7 gap-1 text-purple-500 hover:text-purple-600"
                          title="עזרה מנטלית"
                        >
                          <Brain className="h-3.5 w-3.5" />
                        </Button>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveTask(task);
                            }}
                            className="h-7 gap-1 text-muted-foreground hover:text-foreground"
                            title={task.archived ? "החזר מארכיון" : "העבר לארכיון"}
                          >
                            {task.archived ? (
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {showYearSelector && !readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskToMove(task);
                              setMoveDialogOpen(true);
                            }}
                            className="h-7 gap-1 text-muted-foreground hover:text-foreground"
                            title="העבר לשנה אחרת"
                          >
                            <MoveRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
              <div className="h-48 shrink-0" aria-hidden="true" />
            </div>
          );
        }}
      </TaskTabs>

      {/* Compact View Detail Dialog */}
      {dashViewMode === "compact" && (() => {
        const selectedTask = tasks.find(t => t.id === selectedRow);
        return (
          <ItemDetailDialog
            item={selectedTask ? {
              id: selectedTask.id,
              title: selectedTask.description || "(ללא תיאור)",
              subtitle: selectedTask.category || null,
              status: selectedTask.status || null,
              notes: selectedTask.statusNotes || null,
              statusOptions: [
                { value: "טרם החל", label: "טרם החל" },
                { value: "בטיפול", label: "בטיפול" },
                { value: "בוצע", label: "בוצע" },
              ],
            } : null}
            open={!!selectedRow && dashViewMode === "compact"}
            onClose={() => setSelectedRow(null)}
            onSave={(id, updates) => {
              const taskUpdates: Partial<Task> = {};
              if (updates.title !== undefined) taskUpdates.description = updates.title;
              if (updates.status !== undefined) taskUpdates.status = updates.status as Task["status"];
              if (updates.notes !== undefined) taskUpdates.statusNotes = updates.notes;
              updateTask(id, taskUpdates);
            }}
            onDelete={readOnly ? undefined : (id) => { deleteTask(id); setSelectedRow(null); }}
          />
        );
      })()}

      {/* AI Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              עזרה מ-AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTaskForAi && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">משימה:</p>
                <p className="text-sm text-muted-foreground">{selectedTaskForAi.description}</p>
              </div>
            )}
            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2 text-muted-foreground">מקבל הצעות...</span>
              </div>
            ) : (
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg whitespace-pre-wrap text-sm">
                {aiSuggestion}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Move Task Dialog */}
      {mentalTask && (
        <MentalDifficultyHelper
          task={mentalTask}
          open={mentalDialogOpen}
          onOpenChange={(open) => {
            setMentalDialogOpen(open);
            if (!open) setMentalTask(null);
          }}
        />
      )}

      {/* Move Task Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" />
              העבר משימה לגליון אחר
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {taskToMove && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">משימה:</p>
                <p className="text-sm text-muted-foreground">{taskToMove.description || "(ללא תיאור)"}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">העבר לגליון:</label>
              <Select
                value={targetSheet}
                onValueChange={(v) => setTargetSheet(v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSheets.map((sheet) => (
                    <SelectItem key={sheet} value={sheet}>
                      {sheet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleMoveTask}>העבר משימה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Sharing Dialog */}
      <SheetSharingDialog
        open={sharingDialogOpen}
        onOpenChange={setSharingDialogOpen}
        sheetName={selectedSheet ?? MAIN_SHEET_NAME}
        taskType={taskType}
        availableSheets={availableSheets}
      />

      <Dialog open={!!detailTask} onOpenChange={(open) => { if (!open) setDetailTask(null); }}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי משימה מלאים</DialogTitle>
          </DialogHeader>
          {detailTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>תיאור המשימה</Label>
                  <Textarea
                    value={detailTask.description}
                    onChange={(e) => setDetailTask({ ...detailTask, description: e.target.value })}
                    className="min-h-[90px]"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>סיווג</Label>
                    <Input value={detailTask.category} onChange={(e) => setDetailTask({ ...detailTask, category: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>אחריות</Label>
                    <Input value={detailTask.responsible} onChange={(e) => setDetailTask({ ...detailTask, responsible: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>סיום מתוכנן</Label>
                    <Input type="date" value={detailTask.plannedEnd || ""} onChange={(e) => setDetailTask({ ...detailTask, plannedEnd: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>סטטוס</Label>
                  <Select value={detailTask.status} onValueChange={(value) => setDetailTask({ ...detailTask, status: value as Task["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="טרם החל">טרם החל</SelectItem>
                      <SelectItem value="בטיפול">בטיפול</SelectItem>
                      <SelectItem value="בוצע">בוצע</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>דחוף</Label>
                  <Button variant={detailTask.urgent ? "default" : "outline"} onClick={() => setDetailTask({ ...detailTask, urgent: !detailTask.urgent })}>
                    {detailTask.urgent ? "כן, מסומן כדחוף" : "לא דחוף"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label>גליון</Label>
                  <Input value={detailTask.sheetName} disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>היכן זה עומד</Label>
                  <Textarea
                    value={detailTask.statusNotes}
                    onChange={(e) => setDetailTask({ ...detailTask, statusNotes: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label>משימות שבוצעו / התקדמות</Label>
                  <Textarea
                    value={detailTask.progress}
                    onChange={(e) => setDetailTask({ ...detailTask, progress: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-sm">
                <div className="font-semibold">מעקב עריכות</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground">נוצר על ידי</div>
                    <div>{detailTask.creatorName || detailTask.creatorEmail || "לא ידוע"}</div>
                    <div>{detailTask.createdAt ? new Date(detailTask.createdAt).toLocaleString('he-IL') : "-"}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">עודכן לאחרונה על ידי</div>
                    <div>{detailTask.lastEditorName || detailTask.lastEditorEmail || "לא ידוע"}</div>
                    <div>{detailTask.updatedAt ? new Date(detailTask.updatedAt).toLocaleString('he-IL') : "-"}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-foreground">יומן עריכות מלא</div>
                    <div className="text-xs text-muted-foreground">
                      {detailHistory.length === 0
                        ? "אין עדיין עריכות שמורות"
                        : `${detailHistory.filter((entry) => entry.action_type !== "created").length} עריכות שמורות`}
                    </div>
                  </div>
                  {detailHistoryLoading ? (
                    <div className="text-xs text-muted-foreground">טוען היסטוריית עריכות...</div>
                  ) : detailHistory.length === 0 ? (
                    <div className="text-xs text-muted-foreground">עדיין אין יומן עריכות מפורט למשימה הזו.</div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-auto">
                      {detailHistory.map((entry) => (
                        <div key={entry.id} className="rounded-md border border-border/70 bg-background px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="font-medium text-foreground">
                              {TASK_ACTION_LABELS[entry.action_type] || entry.action_type}
                              {entry.changed_count > 0 ? ` · ${entry.changed_count} שדות` : ""}
                            </div>
                            <div className="text-muted-foreground">
                              {entry.created_at ? new Date(entry.created_at).toLocaleString("he-IL") : "-"}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            על ידי {entry.edited_by_name || entry.edited_by_email || entry.edited_by_username || "לא ידוע"}
                          </div>
                          <div className="mt-1 text-xs text-foreground/80">
                            {renderHistoryChangeSummary(entry)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailTask(null)}>סגור</Button>
                <Button onClick={handleSaveTaskDetails}>שמור שינויים</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
};

export default TaskSpreadsheetDb;
