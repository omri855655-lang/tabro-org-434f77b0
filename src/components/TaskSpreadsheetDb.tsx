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
import ItemDetailDialog from "@/components/ItemDetailDialog";
import { useLanguage } from "@/hooks/useLanguage";

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

const getTaskThemeStyles = (theme: BoardTheme) => {
  const base = {
    shell: "bg-background",
    topBar: "bg-card border-b border-border",
    toolbar: "bg-muted/30 border-b border-border",
    accentBar: "bg-muted/50 border-t border-border/50",
    panel: "bg-card border border-border shadow-sm",
    card: "bg-card border border-border shadow-sm",
    tableHeader: "bg-muted",
    rowHover: "hover:bg-accent/30",
  };

  switch (theme) {
    case "gradient":
      return {
        ...base,
        shell: "bg-gradient-to-br from-primary/5 via-background to-accent/5",
        topBar: "bg-background/90 backdrop-blur border-b border-primary/15",
        toolbar: "bg-primary/5 border-b border-primary/10 backdrop-blur",
        accentBar: "bg-accent/5 border-t border-primary/10",
        panel: "bg-card/85 backdrop-blur border border-primary/15 shadow-lg",
        card: "bg-card/90 backdrop-blur border border-primary/15 shadow-md",
        tableHeader: "bg-primary/5",
        rowHover: "hover:bg-primary/5",
      };
    case "dark":
      return {
        ...base,
        shell: "bg-zinc-950 text-zinc-100",
        topBar: "bg-zinc-900 border-b border-zinc-800",
        toolbar: "bg-zinc-900/95 border-b border-zinc-800",
        accentBar: "bg-zinc-900 border-t border-zinc-800 text-zinc-400",
        panel: "bg-zinc-900 border border-zinc-800 shadow-lg",
        card: "bg-zinc-900 border border-zinc-800 shadow-md",
        tableHeader: "bg-zinc-900",
        rowHover: "hover:bg-zinc-800/70",
      };
    case "pastel":
      return {
        ...base,
        shell: "bg-gradient-to-br from-pink-50/50 via-background to-amber-50/40 dark:from-pink-950/10 dark:to-amber-950/10",
        topBar: "bg-white/90 dark:bg-card/90 backdrop-blur border-b border-pink-200/40 dark:border-pink-800/20",
        toolbar: "bg-pink-50/50 dark:bg-pink-950/10 border-b border-pink-200/30 dark:border-pink-800/20",
        accentBar: "bg-amber-50/50 dark:bg-amber-950/10 border-t border-pink-200/30 dark:border-pink-800/20",
        panel: "bg-white/90 dark:bg-card/90 border border-pink-200/40 dark:border-pink-800/30 shadow-sm",
        card: "bg-white/90 dark:bg-card/90 border border-pink-200/40 dark:border-pink-800/30 shadow-sm",
        tableHeader: "bg-pink-50/60 dark:bg-pink-950/10",
        rowHover: "hover:bg-pink-50/50 dark:hover:bg-pink-950/10",
      };
    case "ocean":
      return {
        ...base,
        shell: "bg-gradient-to-br from-cyan-50/40 via-background to-sky-50/50 dark:from-cyan-950/10 dark:to-sky-950/10",
        topBar: "bg-white/90 dark:bg-card/90 backdrop-blur border-b border-cyan-200/40 dark:border-cyan-800/20",
        toolbar: "bg-cyan-50/50 dark:bg-cyan-950/10 border-b border-cyan-200/30 dark:border-cyan-800/20",
        accentBar: "bg-sky-50/60 dark:bg-sky-950/10 border-t border-cyan-200/30 dark:border-cyan-800/20",
        panel: "bg-white/90 dark:bg-card/90 border border-cyan-200/40 dark:border-cyan-800/30 shadow-sm",
        card: "bg-white/90 dark:bg-card/90 border border-cyan-200/40 dark:border-cyan-800/30 shadow-sm",
        tableHeader: "bg-cyan-50/60 dark:bg-cyan-950/10",
        rowHover: "hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10",
      };
    case "forest":
      return {
        ...base,
        shell: "bg-gradient-to-br from-emerald-50/40 via-background to-lime-50/40 dark:from-emerald-950/10 dark:to-lime-950/10",
        topBar: "bg-white/90 dark:bg-card/90 backdrop-blur border-b border-emerald-200/40 dark:border-emerald-800/20",
        toolbar: "bg-emerald-50/50 dark:bg-emerald-950/10 border-b border-emerald-200/30 dark:border-emerald-800/20",
        accentBar: "bg-lime-50/50 dark:bg-lime-950/10 border-t border-emerald-200/30 dark:border-emerald-800/20",
        panel: "bg-white/90 dark:bg-card/90 border border-emerald-200/40 dark:border-emerald-800/30 shadow-sm",
        card: "bg-white/90 dark:bg-card/90 border border-emerald-200/40 dark:border-emerald-800/30 shadow-sm",
        tableHeader: "bg-emerald-50/60 dark:bg-emerald-950/10",
        rowHover: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10",
      };
    case "sunset":
      return {
        ...base,
        shell: "bg-gradient-to-br from-orange-50/40 via-background to-rose-50/50 dark:from-orange-950/10 dark:to-rose-950/10",
        topBar: "bg-white/90 dark:bg-card/90 backdrop-blur border-b border-orange-200/40 dark:border-orange-800/20",
        toolbar: "bg-orange-50/50 dark:bg-orange-950/10 border-b border-orange-200/30 dark:border-orange-800/20",
        accentBar: "bg-rose-50/50 dark:bg-rose-950/10 border-t border-orange-200/30 dark:border-orange-800/20",
        panel: "bg-white/90 dark:bg-card/90 border border-orange-200/40 dark:border-orange-800/30 shadow-sm",
        card: "bg-white/90 dark:bg-card/90 border border-orange-200/40 dark:border-orange-800/30 shadow-sm",
        tableHeader: "bg-orange-50/60 dark:bg-orange-950/10",
        rowHover: "hover:bg-orange-50/50 dark:hover:bg-orange-950/10",
      };
    case "notion":
      return {
        ...base,
        shell: "bg-background",
        topBar: "bg-background border-b border-border",
        toolbar: "bg-background border-b border-border",
        accentBar: "bg-muted/30 border-t border-border/60 text-muted-foreground",
        panel: "bg-background border border-border shadow-none",
        card: "bg-background border border-border shadow-none",
        tableHeader: "bg-background",
        rowHover: "hover:bg-muted/40",
      };
    case "trello":
      return {
        ...base,
        shell: "bg-gradient-to-br from-blue-600/10 via-background to-sky-500/10",
        topBar: "bg-blue-600 text-white border-b border-blue-700",
        toolbar: "bg-blue-50/80 dark:bg-blue-950/20 border-b border-blue-200/30 dark:border-blue-900/30",
        accentBar: "bg-white/70 dark:bg-card/70 border-t border-blue-200/30 dark:border-blue-900/30",
        panel: "bg-white/90 dark:bg-card border border-blue-200/40 dark:border-blue-900/30 shadow-sm",
        card: "bg-white dark:bg-card border-0 shadow-md",
        tableHeader: "bg-blue-50/70 dark:bg-blue-950/10",
        rowHover: "hover:bg-blue-50/60 dark:hover:bg-blue-950/10",
      };
    case "glass":
      return {
        ...base,
        shell: "bg-gradient-to-br from-primary/10 via-background to-accent/10",
        topBar: "bg-white/45 dark:bg-white/5 backdrop-blur-xl border-b border-white/20 dark:border-white/10",
        toolbar: "bg-white/35 dark:bg-white/5 backdrop-blur-xl border-b border-white/20 dark:border-white/10",
        accentBar: "bg-white/25 dark:bg-white/5 backdrop-blur-xl border-t border-white/20 dark:border-white/10",
        panel: "bg-white/35 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg",
        card: "bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-md",
        tableHeader: "bg-white/30 dark:bg-white/5 backdrop-blur-xl",
        rowHover: "hover:bg-white/30 dark:hover:bg-white/5",
      };
    case "minimal":
      return {
        ...base,
        shell: "bg-background",
        topBar: "bg-background border-b border-border/50",
        toolbar: "bg-background border-b border-border/50",
        accentBar: "bg-background border-t border-border/50 text-muted-foreground",
        panel: "bg-transparent border border-border/40 shadow-none",
        card: "bg-transparent border border-border/40 shadow-none",
        tableHeader: "bg-background",
        rowHover: "hover:bg-muted/20",
      };
    case "colorful":
      return {
        ...base,
        shell: "bg-gradient-to-br from-blue-50/30 via-background to-purple-50/30 dark:from-blue-950/10 dark:to-purple-950/10",
        topBar: "bg-white/90 dark:bg-card/90 backdrop-blur border-b border-blue-200/30 dark:border-blue-800/20",
        toolbar: "bg-gradient-to-r from-blue-50/70 to-purple-50/70 dark:from-blue-950/10 dark:to-purple-950/10 border-b border-blue-200/30 dark:border-blue-800/20",
        accentBar: "bg-gradient-to-r from-cyan-50/60 to-violet-50/60 dark:from-cyan-950/10 dark:to-violet-950/10 border-t border-blue-200/30 dark:border-blue-800/20",
        panel: "bg-white/90 dark:bg-card/90 border border-blue-200/40 dark:border-blue-800/30 shadow-sm",
        card: "bg-white/95 dark:bg-card/90 border border-blue-200/40 dark:border-blue-800/30 shadow-md",
        tableHeader: "bg-gradient-to-r from-blue-50/70 to-purple-50/70 dark:from-blue-950/10 dark:to-purple-950/10",
        rowHover: "hover:bg-blue-50/40 dark:hover:bg-blue-950/10",
      };
    default:
      return base;
  }
};

type SortOption = "none" | "status" | "plannedEnd" | "overdue" | "createdAt" | "urgent";

const TaskSpreadsheetDb = ({ title, taskType, readOnly = false, showYearSelector = false, fixedSheetName, fixedSheetOwnerId, ownerDisplayName }: TaskSpreadsheetDbProps) => {
  const { lang, dir } = useLanguage();
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
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [pendingScrollTaskId, setPendingScrollTaskId] = useState<string | null>(null);
  const [hideCreatorInfo, setHideCreatorInfo] = useState(() => {
    return localStorage.getItem("hide-creator-info") === "true";
  });
  const taskThemeStyles = getTaskThemeStyles(dashTheme);
  const isHebrew = lang === "he";
  const copy = isHebrew ? {
    loading: "טוען משימות...",
    creatorFrom: "משותף מ:",
    readOnly: "צפייה בלבד",
    editMode: "עריכה",
    showCreator: "הצג יוצר",
    hideCreator: "הסתר יוצר",
    showCreatorEditor: "הצג יוצר/עורך",
    hideCreatorEditor: "הסתר יוצר/עורך",
    done: "בוצע",
    notStarted: "טרם החל",
    inProgress: "בטיפול",
    completionRate: "אחוז ביצוע:",
    newTask: "משימה חדשה",
    deleteTask: "מחק משימה",
    sort: "מיון",
    noSort: "ללא מיון",
    byStatus: "לפי סטטוס",
    byPlannedEnd: "לפי סיום מתוכנן",
    byCreatedAt: "לפי תאריך יצירה",
    byOverdue: "לפי חריגה",
    byUrgent: "לפי דחיפות",
    export: "ייצוא",
    importTasks: "ייבוא משימות",
    design: "עיצוב",
    chooseDesign: "בחר עיצוב",
    table: "טבלה",
    list: "רשימה",
    cards: "כרטיסים",
    kanban: "קנבן",
    compact: "קומפקט",
    timeline: "ציר זמן",
    summary: "סיכום מנהלים",
    deep: "Deep Work",
    stickyUrgent: "דחוף / #",
    stickyDescription: "תיאור המשימה",
    stickyCategory: "סיווג",
    stickyResponsible: "אחריות",
    stickyStatus: "סטטוס",
    stickyProgress: "היכן זה עומד",
    stickyCompleted: "משימות שבוצעו",
    stickyPlanned: "סיום מתוכנן",
    stickyOverdue: "חריגה",
    stickyCreated: "נוצר",
    stickyUpdated: "עודכן",
    stickyAi: "AI",
    noArchivedTasks: "אין משימות בארכיון",
    noCompletedTasks: "אין משימות שבוצעו",
    noTasksYet: "אין משימות עדיין",
    addFirstTask: "הוסף משימה ראשונה",
    similarTasks: "משימות דומות:",
    shareError: "שגיאה בפתיחת שיתוף הגליון",
    share: "שתף",
    createSheetLogin: "יש להתחבר כדי ליצור גליון חדש",
    sheetCreated: "נוצר בהצלחה",
    sheetDeleted: "נמחק בהצלחה",
    deleteSheetError: "שגיאה במחיקת הגליון",
    moveTaskSuccess: "המשימה הועברה לגליון",
    moveTaskError: "שגיאה בהעברת משימה",
    archived: "המשימה הועברה לארכיון",
    restored: "המשימה הוחזרה מהארכיון",
    archiveError: "שגיאה בארכוב משימה",
    aiNeedDescription: "נא להזין תיאור משימה לפני בקשת עזרה מ-AI",
    aiNoResponse: "לא התקבלה תגובה מה-AI",
    aiError: "שגיאה בקבלת עזרה מ-AI",
    cancelUrgent: "בטל דחיפות",
    markUrgent: "סמן כדחוף",
    timelineTitle: "Timeline + Kanban",
    timelineDesc: "ציר זמן לפי תאריך יעד, עם מעבר מהיר בין עומסים, משימות דחופות והשלמות.",
    noDateBucket: "ללא תאריך יעד",
    todayBucket: "היום",
    weekBucket: "השבוע הקרוב",
    laterBucket: "בהמשך",
    overdueBucket: "באיחור",
    items: "פריטים",
    summaryTitle: "Executive Summary",
    summaryDesc: "מבט-על מהיר על עומסים, צווארי בקבוק, בעלי אחריות ומשימות שדורשות תשומת לב.",
    urgentFocus: "מה דורש תשומת לב עכשיו",
    bottlenecks: "צווארי בקבוק",
    topOwners: "חלוקת אחריות",
    overdueItems: "משימות באיחור",
    emptySummary: "אין מספיק משימות להצגת סיכום עדיין",
    deepTitle: "Deep Work",
    deepDesc: "רשימת פוקוס שקטה למשימות שכדאי לסיים עכשיו בלי הסחות דעת.",
    primaryFocus: "פוקוס ראשי",
    secondaryQueue: "תור משני",
    quietBoard: "לוח שקט",
    noFocusTasks: "אין כרגע משימות לפוקוס עמוק",
  } : {
    loading: "Loading tasks...",
    creatorFrom: "Shared from:",
    readOnly: "Read only",
    editMode: "Editing",
    showCreator: "Show creator",
    hideCreator: "Hide creator",
    showCreatorEditor: "Show creator/editor",
    hideCreatorEditor: "Hide creator/editor",
    done: "Done",
    notStarted: "Not started",
    inProgress: "In progress",
    completionRate: "Completion rate:",
    newTask: "New task",
    deleteTask: "Delete task",
    sort: "Sort",
    noSort: "No sort",
    byStatus: "By status",
    byPlannedEnd: "By planned end",
    byCreatedAt: "By created date",
    byOverdue: "By overdue",
    byUrgent: "By urgency",
    export: "Export",
    importTasks: "Import tasks",
    design: "Design",
    chooseDesign: "Choose design",
    table: "Table",
    list: "List",
    cards: "Cards",
    kanban: "Kanban",
    compact: "Compact",
    timeline: "Timeline",
    summary: "Executive Summary",
    deep: "Deep Work",
    stickyUrgent: "Urgent / #",
    stickyDescription: "Task description",
    stickyCategory: "Category",
    stickyResponsible: "Responsible",
    stickyStatus: "Status",
    stickyProgress: "Progress notes",
    stickyCompleted: "Completed work",
    stickyPlanned: "Planned end",
    stickyOverdue: "Overdue",
    stickyCreated: "Created",
    stickyUpdated: "Updated",
    stickyAi: "AI",
    noArchivedTasks: "No archived tasks",
    noCompletedTasks: "No completed tasks",
    noTasksYet: "No tasks yet",
    addFirstTask: "Add your first task",
    similarTasks: "Similar tasks:",
    shareError: "Error opening sheet sharing",
    share: "Share",
    createSheetLogin: "You need to sign in to create a new sheet",
    sheetCreated: "created successfully",
    sheetDeleted: "deleted successfully",
    deleteSheetError: "Error deleting sheet",
    moveTaskSuccess: "Task moved to sheet",
    moveTaskError: "Error moving task",
    archived: "Task moved to archive",
    restored: "Task restored from archive",
    archiveError: "Error archiving task",
    aiNeedDescription: "Please add a task description before asking AI for help",
    aiNoResponse: "No response was received from AI",
    aiError: "Error getting AI help",
    cancelUrgent: "Remove urgency",
    markUrgent: "Mark as urgent",
    timelineTitle: "Timeline + Kanban",
    timelineDesc: "A date-driven workload view with quick prioritization and momentum tracking.",
    noDateBucket: "No due date",
    todayBucket: "Today",
    weekBucket: "This week",
    laterBucket: "Later",
    overdueBucket: "Overdue",
    items: "items",
    summaryTitle: "Executive Summary",
    summaryDesc: "A fast overview of workload, bottlenecks, owners and what needs attention.",
    urgentFocus: "Needs attention now",
    bottlenecks: "Bottlenecks",
    topOwners: "Ownership split",
    overdueItems: "Overdue tasks",
    emptySummary: "There are not enough tasks yet to build a summary",
    deepTitle: "Deep Work",
    deepDesc: "A quiet focus queue for the tasks most worth finishing right now.",
    primaryFocus: "Primary focus",
    secondaryQueue: "Secondary queue",
    quietBoard: "Quiet board",
    noFocusTasks: "No deep focus tasks right now",
  };

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
      toast.error(copy.createSheetLogin);
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
      toast.success(`${isHebrew ? `גליון "${sheetName}" ${copy.sheetCreated}` : `Sheet "${sheetName}" ${copy.sheetCreated}`}`);
    } catch (error: any) {
      console.error("Error adding sheet:", error);
      toast.error(isHebrew ? "שגיאה ביצירת גליון חדש" : "Error creating sheet");
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
      
      toast.success(`${isHebrew ? `גליון "${sheetName}" ${copy.sheetDeleted}` : `Sheet "${sheetName}" ${copy.sheetDeleted}`}`);
      refetch();
    } catch (error: any) {
      console.error("Error deleting sheet:", error);
      toast.error(copy.deleteSheetError);
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

      toast.success(`${copy.moveTaskSuccess} "${targetSheet}"`);
      setMoveDialogOpen(false);
      setTaskToMove(null);
      refetch();
    } catch (error: any) {
      console.error("Error moving task:", error);
      toast.error(copy.moveTaskError);
    }
  };

  const handleArchiveTask = async (task: Task) => {
    try {
      await updateTask(task.id, { archived: !task.archived });
      toast.success(task.archived ? copy.restored : copy.archived);
    } catch (error: any) {
      console.error("Error archiving task:", error);
      toast.error(copy.archiveError);
    }
  };

  const handleAiHelp = async (task: Task) => {
    if (!task.description.trim()) {
      toast.error(copy.aiNeedDescription);
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

      setAiSuggestion(data.suggestion || copy.aiNoResponse);
    } catch (error: any) {
      console.error("AI error:", error);
      toast.error(error.message || copy.aiError);
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
  const taskStatusOptions = [
    { value: "טרם החל", label: copy.notStarted },
    { value: "בטיפול", label: copy.inProgress },
    { value: "בוצע", label: copy.done },
  ];

  const kanbanColumns = [
    { value: "טרם החל", label: copy.notStarted, color: "bg-muted" },
    { value: "בטיפול", label: copy.inProgress, color: "bg-amber-100 dark:bg-amber-900/30" },
    { value: "בוצע", label: copy.done, color: "bg-green-100 dark:bg-green-900/30" },
  ];

  const getTimelineBucket = (task: Task) => {
    if (task.overdue && task.status !== "בוצע") return copy.overdueBucket;
    if (!task.plannedEnd) return copy.noDateBucket;
    const due = new Date(task.plannedEnd);
    const today = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(today.getDate() + 7);
    if (due.toDateString() === today.toDateString()) return copy.todayBucket;
    if (due <= endOfWeek) return copy.weekBucket;
    return copy.laterBucket;
  };

  const bucketWeight = (label: string) => {
    if (label === copy.overdueBucket) return 0;
    if (label === copy.todayBucket) return 1;
    if (label === copy.weekBucket) return 2;
    if (label === copy.laterBucket) return 3;
    return 4;
  };

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
            <div className="p-2 text-xs text-muted-foreground border-b">{copy.similarTasks}</div>
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
        <span className="mr-2 text-muted-foreground">{copy.loading}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", taskThemeStyles.shell)} dir={dir}>
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
            <span className="text-xs text-muted-foreground">{copy.creatorFrom} {ownerDisplayName}</span>
          )}
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            readOnly ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}>
            {readOnly ? copy.readOnly : copy.editMode}
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
            {hideCreatorInfo ? copy.showCreator : copy.hideCreator}
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
            {hideCreatorInfo ? copy.showCreatorEditor : copy.hideCreatorEditor}
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
                  toast.error(copy.shareError);
                  return;
                }

                setSharingDialogOpen(true);
              }}
              className="gap-1 ml-2 mr-2 shrink-0"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{copy.share}</span>
            </Button>
          )}
        </div>
      )}

      {/* Stats Bar - sticky */}
      <div className={cn("flex items-center gap-6 px-4 py-3 sticky top-0 z-20", taskThemeStyles.topBar)}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">{copy.done}: {completedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-sm text-muted-foreground">{copy.notStarted}: {pendingCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-muted-foreground">{copy.inProgress}: {inProgressCount}</span>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className="text-sm font-medium">{copy.completionRate}</span>
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
      <div className={cn("sticky top-[52px] z-20", taskThemeStyles.toolbar)}>
        <div className="flex items-center gap-2 p-3">
        <h2 className="text-lg font-semibold text-foreground ml-4">{title}</h2>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleAddTask}>
              <Plus className="h-4 w-4 ml-1" />
              {copy.newTask}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteTask}
              disabled={selectedRow === null}
            >
              <Trash2 className="h-4 w-4 ml-1" />
              {copy.deleteTask}
            </Button>
          </div>
        )}
        <div className="mr-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[160px] h-8">
              <ArrowUpDown className="h-4 w-4 ml-1" />
              <SelectValue placeholder={copy.sort} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{copy.noSort}</SelectItem>
              <SelectItem value="status">{copy.byStatus}</SelectItem>
              <SelectItem value="plannedEnd">{copy.byPlannedEnd}</SelectItem>
              <SelectItem value="createdAt">{copy.byCreatedAt}</SelectItem>
              <SelectItem value="overdue">{copy.byOverdue}</SelectItem>
              <SelectItem value="urgent">{copy.byUrgent}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 ml-1" />
            {copy.export}
          </Button>
          {!readOnly && <FileImport onImport={handleImportTasks} label={copy.importTasks} />}
          {/* View mode buttons */}
          <div className="flex items-center border rounded-md overflow-hidden h-8">
            {([
              { mode: "table" as DashboardViewMode, icon: Grid3X3, label: copy.table },
              { mode: "list" as DashboardViewMode, icon: ListIcon, label: copy.list },
              { mode: "cards" as DashboardViewMode, icon: LayoutGrid, label: copy.cards },
              { mode: "kanban" as DashboardViewMode, icon: CreditCard, label: copy.kanban },
              { mode: "timeline" as DashboardViewMode, icon: Clock, label: copy.timeline },
              { mode: "summary" as DashboardViewMode, icon: Brain, label: copy.summary },
              { mode: "deep" as DashboardViewMode, icon: Sparkles, label: copy.deep },
              { mode: "compact" as DashboardViewMode, icon: AlignJustify, label: copy.compact },
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
                <Palette className="h-3.5 w-3.5" />{copy.design}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 max-h-[300px] overflow-y-auto" align="end">
              <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">{copy.chooseDesign}</p>
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
        {/* Sticky info bar */}
        {dashViewMode !== "table" && (
        <div className={cn("flex items-center gap-3 px-4 py-1.5 text-[11px] text-muted-foreground overflow-x-auto", taskThemeStyles.accentBar)}>
          <span className="font-medium min-w-[60px]">{copy.stickyUrgent}</span>
          <span className="font-medium min-w-[200px] flex-1">{copy.stickyDescription}</span>
          <span className="font-medium min-w-[80px]">{copy.stickyCategory}</span>
          <span className="font-medium min-w-[80px]">{copy.stickyResponsible}</span>
          <span className="font-medium min-w-[80px]">{copy.stickyStatus}</span>
          <span className="font-medium min-w-[100px]">{copy.stickyProgress}</span>
          <span className="font-medium min-w-[100px]">{copy.stickyCompleted}</span>
          <span className="font-medium min-w-[90px]">{copy.stickyPlanned}</span>
          <span className="font-medium min-w-[60px]">{copy.stickyOverdue}</span>
          <span className="font-medium min-w-[70px]">{copy.stickyCreated}</span>
          <span className="font-medium min-w-[70px]">{copy.stickyUpdated}</span>
          <span className="font-medium min-w-[50px]">{copy.stickyAi}</span>
        </div>
        )}
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
                  {viewMode === "archive" ? copy.noArchivedTasks : 
                   viewMode === "completed" ? copy.noCompletedTasks : 
                   copy.noTasksYet}
                </p>
                {!readOnly && viewMode === "active" && (
                  <Button variant="outline" className="mt-4" onClick={handleAddTask}>
                    <Plus className="h-4 w-4 ml-1" />
                    {copy.addFirstTask}
                  </Button>
                )}
              </div>
            );
          }

          // Non-table view modes
          if (dashViewMode === "list") {
            return (
              <div className={cn("p-3 overflow-auto h-full", taskThemeStyles.shell)}>
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
              <div className={cn("p-3 overflow-auto h-full", taskThemeStyles.shell)}>
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
              <div className={cn("p-3 overflow-auto h-full", taskThemeStyles.shell)}>
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
              <div className={cn("p-3 overflow-auto h-full", taskThemeStyles.shell)}>
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

          if (dashViewMode === "timeline") {
            const timelineBuckets = displayTasks.reduce<Record<string, Task[]>>((acc, task) => {
              const bucket = getTimelineBucket(task);
              if (!acc[bucket]) acc[bucket] = [];
              acc[bucket].push(task);
              return acc;
            }, {});

            const orderedBuckets = Object.entries(timelineBuckets).sort((a, b) => bucketWeight(a[0]) - bucketWeight(b[0]));

            return (
              <div className={cn("p-4 overflow-auto h-full space-y-4", taskThemeStyles.shell)}>
                <div className={cn("rounded-2xl p-4", taskThemeStyles.panel)}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-lg font-semibold">{copy.timelineTitle}</h3>
                      <p className="text-sm text-muted-foreground">{copy.timelineDesc}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {orderedBuckets.map(([bucket, items]) => (
                        <span key={bucket} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                          {bucket} · {items.length}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {orderedBuckets.map(([bucket, items]) => (
                  <div key={bucket} className={cn("rounded-2xl overflow-hidden", taskThemeStyles.panel)}>
                    <div className={cn("px-4 py-3 flex items-center justify-between", taskThemeStyles.accentBar)}>
                      <h4 className="font-semibold">{bucket}</h4>
                      <span className="text-xs text-muted-foreground">{items.length} {copy.items}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {items.map((task) => (
                        <div key={task.id} className={cn("rounded-xl p-4 hover:shadow-md transition-shadow", taskThemeStyles.card)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {task.urgent && <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium">{copy.urgent}</span>}
                                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusColors[task.status] || "bg-muted text-foreground")}>
                                  {task.status === "בוצע" ? copy.done : task.status === "בטיפול" ? copy.inProgress : copy.notStarted}
                                </span>
                                {task.overdue && task.status !== "בוצע" && (
                                  <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium">{copy.overdue}</span>
                                )}
                              </div>
                              <p className="mt-2 text-sm font-semibold">{task.description || copy.noTasksYet}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[task.category, task.responsible, task.plannedEnd].filter(Boolean).join(" • ")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          if (dashViewMode === "summary") {
            const urgentTasks = displayTasks.filter((t) => t.urgent && t.status !== "בוצע").slice(0, 5);
            const overdueTasks = displayTasks.filter((t) => t.overdue && t.status !== "בוצע").slice(0, 5);
            const bottlenecks = displayTasks.filter((t) => t.status === "בטיפול").slice(0, 5);
            const ownerStats = displayTasks.reduce<Record<string, number>>((acc, task) => {
              const owner = task.responsible?.trim() || (isHebrew ? "ללא אחראי" : "Unassigned");
              acc[owner] = (acc[owner] || 0) + 1;
              return acc;
            }, {});
            const topOwners = Object.entries(ownerStats).sort((a, b) => b[1] - a[1]).slice(0, 5);

            return (
              <div className={cn("p-4 overflow-auto h-full space-y-4", taskThemeStyles.shell)}>
                <div className={cn("rounded-3xl p-5", taskThemeStyles.panel)}>
                  <h3 className="text-xl font-semibold">{copy.summaryTitle}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{copy.summaryDesc}</p>
                  <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className={cn("rounded-2xl p-4", taskThemeStyles.card)}>
                      <p className="text-xs text-muted-foreground">{copy.done}</p>
                      <p className="text-2xl font-bold">{completedCount}</p>
                    </div>
                    <div className={cn("rounded-2xl p-4", taskThemeStyles.card)}>
                      <p className="text-xs text-muted-foreground">{copy.inProgress}</p>
                      <p className="text-2xl font-bold">{inProgressCount}</p>
                    </div>
                    <div className={cn("rounded-2xl p-4", taskThemeStyles.card)}>
                      <p className="text-xs text-muted-foreground">{copy.urgentFocus}</p>
                      <p className="text-2xl font-bold">{urgentTasks.length}</p>
                    </div>
                    <div className={cn("rounded-2xl p-4", taskThemeStyles.card)}>
                      <p className="text-xs text-muted-foreground">{copy.overdueItems}</p>
                      <p className="text-2xl font-bold">{overdueTasks.length}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {[
                    { title: copy.urgentFocus, items: urgentTasks },
                    { title: copy.bottlenecks, items: bottlenecks },
                    { title: copy.overdueItems, items: overdueTasks },
                  ].map((section) => (
                    <div key={section.title} className={cn("rounded-2xl p-4", taskThemeStyles.panel)}>
                      <h4 className="font-semibold mb-3">{section.title}</h4>
                      <div className="space-y-2">
                        {section.items.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{copy.emptySummary}</p>
                        ) : section.items.map((task) => (
                          <div key={task.id} className={cn("rounded-xl p-3", taskThemeStyles.card)}>
                            <p className="text-sm font-medium">{task.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">{[task.category, task.responsible].filter(Boolean).join(" • ")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={cn("rounded-2xl p-4", taskThemeStyles.panel)}>
                  <h4 className="font-semibold mb-3">{copy.topOwners}</h4>
                  <div className="space-y-2">
                    {topOwners.map(([owner, count]) => (
                      <div key={owner} className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((count / Math.max(displayTasks.length, 1)) * 100, 8)}%` }} />
                        </div>
                        <span className="text-sm min-w-[140px] truncate">{owner}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (dashViewMode === "deep") {
            const focusTasks = [...displayTasks]
              .filter((task) => task.status !== "בוצע")
              .sort((a, b) => {
                const score = (task: Task) => (task.urgent ? 0 : 1) + (task.overdue ? 0 : 2) + (task.status === "בטיפול" ? 0 : 3);
                return score(a) - score(b);
              });
            const primaryFocus = focusTasks.slice(0, 3);
            const secondaryQueue = focusTasks.slice(3, 9);

            return (
              <div className={cn("p-4 overflow-auto h-full", taskThemeStyles.shell)}>
                <div className={cn("rounded-[28px] p-5", taskThemeStyles.panel)}>
                  <h3 className="text-xl font-semibold">{copy.deepTitle}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{copy.deepDesc}</p>
                </div>

                {focusTasks.length === 0 ? (
                  <div className={cn("mt-4 rounded-3xl border border-dashed p-10 text-center text-muted-foreground", taskThemeStyles.panel)}>
                    {copy.noFocusTasks}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
                    <div className={cn("rounded-3xl p-4", taskThemeStyles.panel)}>
                      <h4 className="font-semibold mb-4">{copy.primaryFocus}</h4>
                      <div className="space-y-3">
                        {primaryFocus.map((task, index) => (
                          <div key={task.id} className={cn("rounded-2xl p-4", taskThemeStyles.card)}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-primary">#{index + 1}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusColors[task.status] || "bg-muted text-foreground")}>
                                {task.status === "בוצע" ? copy.done : task.status === "בטיפול" ? copy.inProgress : copy.notStarted}
                              </span>
                            </div>
                            <p className="mt-3 text-base font-semibold">{task.description}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{[task.category, task.responsible, task.plannedEnd].filter(Boolean).join(" • ")}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={cn("rounded-3xl p-4", taskThemeStyles.panel)}>
                        <h4 className="font-semibold mb-3">{copy.secondaryQueue}</h4>
                        <div className="space-y-2">
                          {secondaryQueue.map((task) => (
                            <div key={task.id} className={cn("rounded-xl p-3", taskThemeStyles.card)}>
                              <p className="text-sm font-medium">{task.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">{[task.category, task.responsible].filter(Boolean).join(" • ")}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={cn("rounded-3xl p-4", taskThemeStyles.panel)}>
                        <h4 className="font-semibold mb-3">{copy.quietBoard}</h4>
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>{copy.urgentFocus}: {displayTasks.filter((t) => t.urgent && t.status !== "בוצע").length}</p>
                          <p>{copy.overdueItems}: {displayTasks.filter((t) => t.overdue && t.status !== "בוצע").length}</p>
                          <p>{copy.inProgress}: {displayTasks.filter((t) => t.status === "בטיפול").length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          
            return (
            <div ref={tableScrollRef} data-task-table className={cn("min-h-0 h-full overflow-auto scroll-smooth", taskThemeStyles.shell)}>
              <table className="w-full border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10">
              <tr className={taskThemeStyles.tableHeader}>
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
                      "border-b border-border transition-colors cursor-pointer",
                      taskThemeStyles.rowHover,
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
      </>
      )}
    </div>
  );
};

export default TaskSpreadsheetDb;
