import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Download, Check, Clock, AlertCircle, Loader2, Sparkles, ArrowUpDown, Flame, MoveRight, Archive, ArchiveRestore, Brain, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasks, Task } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { taskHeaders } from "@/data/initialTasks";
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

interface TaskSpreadsheetDbProps {
  title: string;
  taskType: "personal" | "work";
  readOnly?: boolean;
  showYearSelector?: boolean;
  fixedSheetName?: string | null;
  fixedSheetOwnerId?: string;
  ownerDisplayName?: string;
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

const TaskSpreadsheetDb = ({ title, taskType, readOnly = false, showYearSelector = false, fixedSheetName, fixedSheetOwnerId, ownerDisplayName }: TaskSpreadsheetDbProps) => {
  const isSharedSheet = !!fixedSheetOwnerId;
  const [sharedCollapsed, setSharedCollapsed] = useState(false);
  const { user } = useAuth();
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
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [pendingScrollTaskId, setPendingScrollTaskId] = useState<string | null>(null);
  const [hideCreatorInfo, setHideCreatorInfo] = useState(() => {
    return localStorage.getItem("hide-creator-info") === "true";
  });

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

  const completedCount = tasks.filter((t) => t.status === "בוצע").length;
  const pendingCount = tasks.filter((t) => t.status === "טרם החל").length;
  const inProgressCount = tasks.filter((t) => t.status === "בטיפול").length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

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

      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-4 py-3 bg-card border-b border-border">
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

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
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
          
            return (
            <div ref={tableScrollRef} data-task-table className="min-h-0 h-full overflow-auto scroll-smooth">
              <table className="w-full border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted">
                {taskHeaders.map((header, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-right text-sm font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                  >
                    {header}
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
                  >
                    <td className="px-3 py-2 text-sm text-muted-foreground w-12 flex items-center gap-1">
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
                    <td className="px-3 py-2 text-sm max-w-[300px]">
                      {renderEditableCell(task.description, task.id, "description")}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {renderEditableCell(task.category, task.id, "category", "text-muted-foreground")}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {renderEditableCell(task.responsible, task.id, "responsible")}
                    </td>
                    <td className="px-3 py-2 text-sm">
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
                    <td className="px-3 py-2 text-sm max-w-[200px]">
                      {renderEditableCell(task.statusNotes, task.id, "statusNotes", "text-muted-foreground text-xs")}
                    </td>
                    <td className="px-3 py-2 text-sm max-w-[200px]">
                      {renderEditableCell(task.progress, task.id, "progress", "text-muted-foreground text-xs")}
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">
                      {renderEditableCell(task.plannedEnd, task.id, "plannedEnd")}
                    </td>
                    <td className="px-3 py-2 text-sm text-center">
                      {task.overdue && task.status !== "בוצע" ? (
                        <span className="text-destructive font-medium">חריגה</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    {/* Creator info moved under date columns - no separate column needed */}
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
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
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
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
                    <td className="px-3 py-2 text-sm">
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
      </>
      )}
    </div>
  );
};

export default TaskSpreadsheetDb;
