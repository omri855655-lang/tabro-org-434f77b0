import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks, Task } from "@/hooks/useTasks";
import { useCalendarEvents, CalendarEvent, getCategoryColor } from "@/hooks/useCalendarEvents";
import { useCustomCategories, COLOR_PALETTE, CustomCategory } from "@/hooks/useCustomCategories";
import { useRecurringTasks } from "@/hooks/useRecurringTasks";
import { useCustomBoards } from "@/hooks/useCustomBoards";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addYears, subYears, startOfYear, endOfYear, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, addHours, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks, isWithinInterval, differenceInMinutes, setHours, setMinutes, addMinutes, eachDayOfInterval, getDay } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Plus, GripVertical, Clock, Trash2, Download, Flame, AlertTriangle, CalendarRange, RotateCcw, ZoomIn, ZoomOut, Filter, Tv, Film } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getHolidaysForDate } from "@/data/holidays";

interface AggregatedTask {
  id: string;
  title: string;
  source: "work" | "personal" | "project" | "recurring" | "show" | "course" | "podcast" | "book";
  overdue: boolean;
  urgent: boolean;
  status: string;
  plannedEnd: string;
  createdAt: string;
  category: string;
  showType?: string;
}

type TaskFilter = "all" | "work" | "personal" | "project" | "recurring" | "overdue" | "today" | "week" | "urgent" | "shows_series" | "shows_movies" | "courses" | "podcasts" | "books";


type ViewMode = "day" | "week" | "month" | "year";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DEFAULT_HOUR_HEIGHT = 60; // px per hour
const SNAP_MINUTES = 15; // snap to 15-min intervals
const MIN_HOUR_HEIGHT = 30;
const MAX_HOUR_HEIGHT = 120;

const PersonalPlanner = () => {
  const { user } = useAuth();
  const { tasks: personalTasks } = useTasks("personal");
  const { tasks: workTasks } = useTasks("work");
  const { tasks: recurringTasks, isTaskDueToday, isTaskCompletedToday } = useRecurringTasks();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { categories, categoryNames, addCategory, removeCategory, getCategoryColor: getDynCategoryColor } = useCustomCategories();
  const { boards: customBoards } = useCustomBoards();

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");

  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [showShowsInPlanner, setShowShowsInPlanner] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<TaskFilter>>(new Set(["all"]));
  const [customBoardItems, setCustomBoardItems] = useState<any[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
  const [courseLessons, setCourseLessons] = useState<any[]>([]);
  const [showCoursesInPlanner, setShowCoursesInPlanner] = useState(true);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [showPodcastsInPlanner, setShowPodcastsInPlanner] = useState(false);
  const [books, setBooks] = useState<any[]>([]);
  const [showBooksInPlanner, setShowBooksInPlanner] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(null);
  const [hourHeights, setHourHeights] = useState<Record<number, number>>({});
  const [resizingHour, setResizingHour] = useState<{ hour: number; startY: number; startHeight: number } | null>(null);
  const [draggedTask, setDraggedTask] = useState<AggregatedTask | null>(null);
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showLinkToDashboard, setShowLinkToDashboard] = useState(false);
  const [pendingLinkEvent, setPendingLinkEvent] = useState<CalendarEvent | null>(null);
  const [newEventData, setNewEventData] = useState({
    title: "",
    description: "",
    category: "משימה",
    startTime: "",
    endTime: "",
    color: "" as string,
    sourceType: "custom" as string,
    sourceId: null as string | null,
  });

  // Resize state
  const [resizingEvent, setResizingEvent] = useState<{ eventId: string; startY: number; originalEndTime: string } | null>(null);
  const [resizePreviewHeight, setResizePreviewHeight] = useState<number | null>(null);

  // Drag-to-create state (drag from sidebar and stretch across hours)
  const [dragCreateState, setDragCreateState] = useState<{
    day: Date;
    startHour: number;
    startMinute: number;
    currentHour: number;
    currentMinute: number;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Touch drag state for mobile
  const touchDragRef = useRef<{
    task: AggregatedTask;
    ghostEl: HTMLDivElement | null;
    lastSlotEl: HTMLElement | null;
  } | null>(null);

  

  // Fetch project tasks & shows
  useEffect(() => {
    if (!user) return;
    const fetchProjects = async () => {
      const { data } = await supabase
        .from("project_tasks")
        .select("*, projects(title)")
        .eq("user_id", user.id)
        .eq("completed", false);
      if (data) setProjectTasks(data);
    };
    const fetchShows = async () => {
      const { data } = await supabase
        .from("shows")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["בצפייה", "לצפות"]);
      if (data) setShows(data);
    };
    const fetchBoardItems = async () => {
      const { data } = await supabase
        .from("custom_board_items")
        .select("*, custom_boards(name)")
        .eq("user_id", user.id)
        .eq("archived", false);
      if (data) setCustomBoardItems(data);
    };
    const fetchCourseLessons = async () => {
      const { data } = await supabase
        .from("course_lessons")
        .select("*, courses(title, status)")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("sort_order", { ascending: true });
      if (data) setCourseLessons(data);
    };
    const fetchPodcasts = async () => {
      const { data } = await supabase
        .from("podcasts")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["להאזין", "מאזין"]);
      if (data) setPodcasts(data);
    };
    const fetchBooks = async () => {
      const { data } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["לקרוא", "קורא"]);
      if (data) setBooks(data);
    };
    fetchProjects();
    fetchShows();
    fetchBoardItems();
    fetchCourseLessons();
    fetchPodcasts();
    fetchBooks();
  }, [user]);

  // Aggregate all tasks
  const allTasks = useMemo((): AggregatedTask[] => {
    const tasks: AggregatedTask[] = [];

    personalTasks
      .filter((t) => t.status !== "בוצע" && !t.archived)
      .forEach((t) =>
        tasks.push({
          id: t.id,
          title: t.description,
          source: "personal",
          overdue: t.overdue,
          urgent: t.urgent,
          status: t.status,
          plannedEnd: t.plannedEnd,
          createdAt: t.createdAt,
          category: t.category || "אישי",
        })
      );

    workTasks
      .filter((t) => t.status !== "בוצע" && !t.archived)
      .forEach((t) =>
        tasks.push({
          id: t.id,
          title: t.description,
          source: "work",
          overdue: t.overdue,
          urgent: t.urgent,
          status: t.status,
          plannedEnd: t.plannedEnd,
          createdAt: t.createdAt,
          category: t.category || "עבודה",
        })
      );

    projectTasks.forEach((pt: any) =>
      tasks.push({
        id: pt.id,
        title: `${pt.projects?.title || "פרויקט"}: ${pt.title}`,
        source: "project",
        overdue: false,
        urgent: false,
        status: "בטיפול",
        plannedEnd: "",
        createdAt: pt.created_at,
        category: "פרויקט",
      })
    );

    recurringTasks
      .filter((t) => isTaskDueToday(t) && !isTaskCompletedToday(t.id))
      .forEach((t) =>
        tasks.push({
          id: t.id,
          title: t.title,
          source: "recurring",
          overdue: false,
          urgent: false,
          status: "יומי",
          plannedEnd: "",
          createdAt: t.createdAt,
          category: "לוז יומי",
        })
      );

    // Shows (only if enabled)
    if (showShowsInPlanner) {
      shows.forEach((s: any) =>
        tasks.push({
          id: s.id,
          title: s.title,
          source: "show",
          overdue: false,
          urgent: false,
          status: s.status || "לצפות",
          plannedEnd: "",
          createdAt: s.created_at,
          category: s.type === "סרט" ? "סרט" : "סדרה",
          showType: s.type,
        })
      );
    }

    // Custom board items (only selected boards)
    if (selectedBoardIds.size > 0) {
      customBoardItems
        .filter((item: any) => selectedBoardIds.has(item.board_id) && item.status !== "הושלם")
        .forEach((item: any) =>
          tasks.push({
            id: item.id,
            title: item.title,
            source: "personal",
            overdue: false,
            urgent: false,
            status: item.status || "לביצוע",
            plannedEnd: "",
            createdAt: item.created_at,
            category: item.custom_boards?.name || "דשבורד",
          })
        );
    }

    // Courses - show next uncompleted lesson per active course
    if (showCoursesInPlanner) {
      const courseMap = new Map<string, any>();
      courseLessons.forEach((lesson: any) => {
        if (!lesson.courses || lesson.courses.status === 'הושלם') return;
        if (!courseMap.has(lesson.course_id)) {
          courseMap.set(lesson.course_id, lesson);
        }
      });
      courseMap.forEach((lesson: any) => {
        tasks.push({
          id: lesson.id,
          title: `📚 ${lesson.courses?.title || "קורס"}: ${lesson.title}`,
          source: "course",
          overdue: lesson.scheduled_date ? new Date(lesson.scheduled_date) < new Date() : false,
          urgent: false,
          status: "שיעור הבא",
          plannedEnd: lesson.scheduled_date || "",
          createdAt: lesson.created_at,
          category: "קורס",
        });
      });
    }

    // Podcasts
    if (showPodcastsInPlanner) {
      podcasts.forEach((p: any) =>
        tasks.push({
          id: p.id,
          title: `🎧 ${p.title}${p.host ? ` - ${p.host}` : ""}`,
          source: "podcast",
          overdue: false,
          urgent: false,
          status: p.status || "להאזין",
          plannedEnd: "",
          createdAt: p.created_at,
          category: "פודקאסט",
        })
      );
    }

    // Books
    if (showBooksInPlanner) {
      books.forEach((b: any) =>
        tasks.push({
          id: b.id,
          title: `📖 ${b.title}${b.author ? ` - ${b.author}` : ""}`,
          source: "book",
          overdue: false,
          urgent: false,
          status: b.status || "לקרוא",
          plannedEnd: "",
          createdAt: b.created_at,
          category: "ספר",
        })
      );
    }

    return tasks.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [personalTasks, workTasks, projectTasks, recurringTasks, isTaskDueToday, isTaskCompletedToday, shows, showShowsInPlanner, customBoardItems, selectedBoardIds, courseLessons, showCoursesInPlanner, podcasts, showPodcastsInPlanner, books, showBooksInPlanner]);

  // Filtered tasks based on active filters
  const filteredTasks = useMemo(() => {
    if (activeFilters.has("all") && activeFilters.size === 1) return allTasks;

    const today = new Date();
    const weekFromNow = addDays(today, 7);

    // Separate source filters from status filters
    const sourceFilters = ["work", "personal", "project", "recurring", "shows_series", "shows_movies", "courses", "podcasts", "books"].filter(f => activeFilters.has(f as TaskFilter));
    const statusFilters = ["overdue", "urgent", "today", "week"].filter(f => activeFilters.has(f as TaskFilter));

    return allTasks.filter((task) => {
      // Check source match (if any source filters active)
      let sourceMatch = true;
      if (sourceFilters.length > 0) {
        sourceMatch = false;
        if (activeFilters.has("work") && task.source === "work") sourceMatch = true;
        if (activeFilters.has("personal") && task.source === "personal") sourceMatch = true;
        if (activeFilters.has("project") && task.source === "project") sourceMatch = true;
        if (activeFilters.has("recurring") && task.source === "recurring") sourceMatch = true;
        if (activeFilters.has("shows_series") && task.source === "show" && task.showType === "סדרה") sourceMatch = true;
        if (activeFilters.has("shows_movies") && task.source === "show" && task.showType === "סרט") sourceMatch = true;
        if (activeFilters.has("courses") && task.source === "course") sourceMatch = true;
        if (activeFilters.has("podcasts") && task.source === "podcast") sourceMatch = true;
        if (activeFilters.has("books") && task.source === "book") sourceMatch = true;
      }

      // Check status match (if any status filters active) - AND with source
      let statusMatch = true;
      if (statusFilters.length > 0) {
        statusMatch = false;
        if (activeFilters.has("overdue") && task.overdue) statusMatch = true;
        if (activeFilters.has("urgent") && task.urgent) statusMatch = true;
        if (activeFilters.has("today") && task.plannedEnd) {
          if (isSameDay(new Date(task.plannedEnd), today)) statusMatch = true;
        }
        if (activeFilters.has("week") && task.plannedEnd) {
          const end = new Date(task.plannedEnd);
          if (end <= weekFromNow && end >= today) statusMatch = true;
        }
      }

      // AND: must match both source AND status
      return sourceMatch && statusMatch;
    });
  }, [allTasks, activeFilters]);

  const toggleFilter = (filter: TaskFilter) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (filter === "all") {
        return new Set(["all"]);
      }
      next.delete("all");
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      if (next.size === 0) return new Set(["all"]);
      return next;
    });
  };

  // Calendar date ranges
  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate), days: [currentDate] };
    }
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { start, end, days };
    }
    if (viewMode === "year") {
      const start = startOfYear(currentDate);
      const end = endOfYear(currentDate);
      return { start, end, days: eachDayOfInterval({ start, end }) };
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const monthStart = startOfWeek(start, { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = monthStart;
    while (d <= end || days.length % 7 !== 0) {
      days.push(d);
      d = addDays(d, 1);
    }
    return { start, end, days };
  }, [currentDate, viewMode]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const eventStart = new Date(e.startTime);
      const eventEnd = new Date(e.endTime);
      return (
        isWithinInterval(eventStart, { start: dateRange.start, end: dateRange.end }) ||
        isWithinInterval(eventEnd, { start: dateRange.start, end: dateRange.end })
      );
    });
  }, [events, dateRange]);

  const navigate = (dir: number) => {
    if (viewMode === "day") setCurrentDate((d) => addDays(d, dir));
    else if (viewMode === "week") setCurrentDate((d) => addWeeks(d, dir));
    else if (viewMode === "month") setCurrentDate((d) => addMonths(d, dir));
    else setCurrentDate((d) => dir > 0 ? addYears(d, 1) : subYears(d, 1));
  };

  // Snap to 15-minute intervals
  const snapMinutes = (minutes: number) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

  const getHourHeight = (h: number) => hourHeights[h] || hourHeight;

  const handleHourResizeStart = (e: React.MouseEvent, h: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingHour({ hour: h, startY: e.clientY, startHeight: getHourHeight(h) });
  };

  // Get hour and minute from Y position relative to grid
  const getTimeFromY = (y: number): { hour: number; minute: number } => {
    const totalMinutes = (y / hourHeight) * 60;
    const hour = Math.floor(totalMinutes / 60);
    const minute = snapMinutes(totalMinutes % 60);
    return { hour: Math.max(0, Math.min(23, hour)), minute: Math.min(45, minute) };
  };

  const handleDragStart = (task: AggregatedTask) => {
    setDraggedTask(task);
  };

  // Handle dragover on hour slots to track position for stretch-drag
  const handleSlotDragOver = (e: React.DragEvent, day: Date, slotHour: number) => {
    e.preventDefault();
    if (!draggedTask && !draggingEvent) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const yInSlot = e.clientY - rect.top;
    const minute = snapMinutes((yInSlot / hourHeight) * 60);
    const currentHour = slotHour;
    const currentMinute = Math.min(45, minute);

    if (!dragCreateState) {
      // First entry - set start
      setDragCreateState({
        day,
        startHour: currentHour,
        startMinute: currentMinute,
        currentHour,
        currentMinute,
      });
    } else if (isSameDay(dragCreateState.day, day)) {
      // Update current position
      setDragCreateState((prev) =>
        prev ? { ...prev, currentHour, currentMinute } : null
      );
    }
  };

  const handleDrop = (day: Date, hour?: number, e?: React.DragEvent) => {
    // Handle moving existing event
    if (draggingEvent) {
      const duration = differenceInMinutes(new Date(draggingEvent.endTime), new Date(draggingEvent.startTime));
      let newStart: Date;

      if (dragCreateState) {
        newStart = setMinutes(setHours(day, dragCreateState.currentHour), dragCreateState.currentMinute);
      } else {
        newStart = hour !== undefined
          ? setMinutes(setHours(day, hour), 0)
          : setMinutes(setHours(day, 9), 0);
      }

      const newEnd = addMinutes(newStart, duration);
      updateEvent(draggingEvent.id, {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      });
      setDraggingEvent(null);
      setDragCreateState(null);
      toast.success("האירוע הוזז בהצלחה");
      return;
    }

    if (!draggedTask) return;

    let start: Date;
    let end: Date;

    if (dragCreateState && isSameDay(dragCreateState.day, day)) {
      const sH = dragCreateState.startHour;
      const sM = dragCreateState.startMinute;
      const cH = dragCreateState.currentHour;
      const cM = dragCreateState.currentMinute;

      const startTotal = sH * 60 + sM;
      const endTotal = cH * 60 + cM;

      if (endTotal > startTotal) {
        start = setMinutes(setHours(day, sH), sM);
        end = setMinutes(setHours(day, cH), cM);
        if (differenceInMinutes(end, start) < 15) {
          end = addMinutes(start, 30);
        }
      } else {
        start = hour !== undefined
          ? setMinutes(setHours(day, hour), 0)
          : setMinutes(setHours(day, 9), 0);
        end = addHours(start, 1);
      }
    } else {
      start = hour !== undefined
        ? setMinutes(setHours(day, hour), 0)
        : setMinutes(setHours(day, 9), 0);
      end = addHours(start, 1);
    }

    const sourceType = draggedTask.source === "work"
      ? "work_task"
      : draggedTask.source === "personal"
        ? "personal_task"
        : draggedTask.source === "recurring"
          ? "recurring_task"
          : "project_task";

    setNewEventData({
      title: draggedTask.title,
      description: "",
      category: draggedTask.source === "work" ? "עבודה" : draggedTask.source === "project" ? "פרויקט" : draggedTask.source === "recurring" ? "לוז יומי" : "אישי",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      color: "",
      sourceType,
      sourceId: draggedTask.id,
    });
    setEditingEvent(null);
    setShowEventDialog(true);
    setDraggedTask(null);
    setDragCreateState(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragCreateState(null);
    setDraggingEvent(null);
  };

  // --- Touch drag handlers for mobile (iOS) ---
  const handleTouchStart = (e: React.TouchEvent, task: AggregatedTask) => {
    const touch = e.touches[0];
    const ghost = document.createElement("div");
    ghost.className = "fixed z-[9999] pointer-events-none bg-primary/80 text-primary-foreground text-xs rounded-lg px-3 py-2 shadow-lg max-w-[200px] truncate";
    ghost.textContent = task.title || "(ללא כותרת)";
    ghost.style.left = `${touch.clientX - 50}px`;
    ghost.style.top = `${touch.clientY - 30}px`;
    document.body.appendChild(ghost);
    touchDragRef.current = { task, ghostEl: ghost, lastSlotEl: null };
    setDraggedTask(task);
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const ghost = touchDragRef.current.ghostEl;
    if (ghost) {
      ghost.style.left = `${touch.clientX - 50}px`;
      ghost.style.top = `${touch.clientY - 30}px`;
    }

    if (ghost) ghost.style.display = "none";
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (ghost) ghost.style.display = "";

    const slotEl = elementBelow?.closest("[data-slot-day]") as HTMLElement | null;
    if (slotEl) {
      if (touchDragRef.current.lastSlotEl && touchDragRef.current.lastSlotEl !== slotEl) {
        touchDragRef.current.lastSlotEl.classList.remove("bg-primary/10");
      }
      slotEl.classList.add("bg-primary/10");
      touchDragRef.current.lastSlotEl = slotEl;

      const dayStr = slotEl.getAttribute("data-slot-day");
      const slotHour = parseInt(slotEl.getAttribute("data-slot-hour") || "0");
      if (dayStr) {
        const day = new Date(dayStr);
        const rect = slotEl.getBoundingClientRect();
        const yInSlot = touch.clientY - rect.top;
        const minute = snapMinutes((yInSlot / hourHeight) * 60);
        const currentMinute = Math.min(45, minute);

        setDragCreateState((prev) => {
          if (!prev) {
            return {
              day,
              startHour: slotHour,
              startMinute: currentMinute,
              currentHour: slotHour,
              currentMinute,
            };
          }
          return { ...prev, currentHour: slotHour, currentMinute };
        });
      }
    }
  }, [snapMinutes]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    const ref = touchDragRef.current;
    if (ref.ghostEl) ref.ghostEl.remove();
    if (ref.lastSlotEl) ref.lastSlotEl.classList.remove("bg-primary/10");

    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const slotEl = elementBelow?.closest("[data-slot-day]") as HTMLElement | null;

    if (slotEl) {
      const dayStr = slotEl.getAttribute("data-slot-day");
      const slotHour = parseInt(slotEl.getAttribute("data-slot-hour") || "0");
      if (dayStr) {
        const day = new Date(dayStr);
        handleDrop(day, slotHour);
      }
    }

    touchDragRef.current = null;
    setDraggedTask(null);
    setDragCreateState(null);
  }, [handleDrop]);


  const handleResizeStart = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingEvent({
      eventId: event.id,
      startY: e.clientY,
      originalEndTime: event.endTime,
    });

    const duration = differenceInMinutes(new Date(event.endTime), new Date(event.startTime));
    setResizePreviewHeight((duration / 60) * hourHeight);
  };

  useEffect(() => {
    if (!resizingEvent) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingEvent.startY;
      const deltaMinutes = snapMinutes((deltaY / hourHeight) * 60);
      const originalDuration = differenceInMinutes(
        new Date(resizingEvent.originalEndTime),
        new Date(events.find((ev) => ev.id === resizingEvent.eventId)?.startTime || "")
      );
      const newDuration = Math.max(15, originalDuration + deltaMinutes);
      setResizePreviewHeight((newDuration / 60) * hourHeight);
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const deltaY = e.clientY - resizingEvent.startY;
      const deltaMinutes = snapMinutes((deltaY / hourHeight) * 60);
      const event = events.find((ev) => ev.id === resizingEvent.eventId);

      if (event) {
        const originalDuration = differenceInMinutes(
          new Date(resizingEvent.originalEndTime),
          new Date(event.startTime)
        );
        const newDuration = Math.max(15, originalDuration + deltaMinutes);
        const newEnd = addMinutes(new Date(event.startTime), newDuration);
        await updateEvent(resizingEvent.eventId, { endTime: newEnd.toISOString() });
      }

      setResizingEvent(null);
      setResizePreviewHeight(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingEvent, events, updateEvent]);

  // Hour row drag-to-resize effect
  useEffect(() => {
    if (!resizingHour) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientY - resizingHour.startY;
      const newHeight = Math.max(30, Math.min(300, resizingHour.startHeight + delta));
      setHourHeights(prev => ({ ...prev, [resizingHour.hour]: newHeight }));
    };
    const handleUp = () => setResizingHour(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
  }, [resizingHour]);

   const handleSaveEvent = async () => {
    if (!newEventData.title.trim()) {
      toast.error("יש להזין כותרת");
      return;
    }

    if (editingEvent) {
      await updateEvent(editingEvent.id, {
        title: newEventData.title,
        description: newEventData.description,
        category: newEventData.category,
        startTime: newEventData.startTime,
        endTime: newEventData.endTime,
        color: newEventData.color || getDynCategoryColor(newEventData.category),
      });
    } else {
      const isCustom = !newEventData.sourceId && (newEventData.sourceType === "custom" || !newEventData.sourceType);
      
      // Check for duplicate tasks
      if (isCustom) {
        const titleLower = newEventData.title.toLowerCase().trim();
        const allTaskTitles = [
          ...personalTasks.filter(t => !t.archived).map(t => t.description?.toLowerCase().trim()),
          ...workTasks.filter(t => !t.archived).map(t => t.description?.toLowerCase().trim()),
        ];
        const duplicate = allTaskTitles.find(t => t && (t === titleLower || t.includes(titleLower) || titleLower.includes(t)));
        if (duplicate) {
          const proceed = confirm(`⚠️ נמצאה משימה דומה: "${duplicate}"\nהאם להמשיך בכל זאת?`);
          if (!proceed) return;
        }
      }

      const savedEvent = await addEvent({
        title: newEventData.title,
        description: newEventData.description,
        category: newEventData.category,
        startTime: newEventData.startTime,
        endTime: newEventData.endTime,
        color: newEventData.color || getDynCategoryColor(newEventData.category),
        sourceType: newEventData.sourceType,
        sourceId: newEventData.sourceId,
      });

      // If it's a custom event (not linked), ask user if they want to link to dashboard
      if (isCustom && savedEvent) {
        setPendingLinkEvent(savedEvent);
        setShowLinkToDashboard(true);
      }
    }

    setShowEventDialog(false);
    setEditingEvent(null);
  };

  const handleLinkToDashboard = async (taskType: "personal" | "work") => {
    // Capture values immediately to avoid race conditions with dialog closing
    const eventToLink = pendingLinkEvent;
    if (!user || !eventToLink) {
      console.error("handleLinkToDashboard: no user or no pending event");
      return;
    }

    // Close dialog immediately for better UX
    setShowLinkToDashboard(false);
    setPendingLinkEvent(null);

    try {
      const plannedEnd = eventToLink.endTime ? eventToLink.endTime.split("T")[0] : null;
      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert([{
          user_id: user.id,
          description: eventToLink.title || "משימה חדשה",
          category: eventToLink.category || null,
          status: "טרם החל",
          planned_end: plannedEnd,
          task_type: taskType,
          sheet_name: String(new Date().getFullYear()),
        }])
        .select()
        .single();

      if (error) throw error;

      // Update the calendar event to link to this task
      const sourceType = taskType === "personal" ? "personal_task" : "work_task";
      await supabase
        .from("calendar_events")
        .update({ source_type: sourceType, source_id: newTask.id })
        .eq("id", eventToLink.id)
        .eq("user_id", user.id);

      toast.success(`✅ המשימה "${eventToLink.title}" נוספה לדשבורד ${taskType === "personal" ? "אישי" : "עבודה"}`);
    } catch (e: any) {
      console.error("Error linking event to dashboard:", e);
      toast.error("שגיאה בהוספת משימה לדשבורד");
    }
  };

  const handleClickEvent = (event: CalendarEvent) => {
    if (resizingEvent) return; // Don't open dialog while resizing
    setEditingEvent(event);
    setNewEventData({
      title: event.title,
      description: event.description,
      category: event.category,
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color || "",
      sourceType: event.sourceType || "custom",
      sourceId: event.sourceId,
    });
    setShowEventDialog(true);
  };

  const handleAddCustomEvent = () => {
    const start = setMinutes(setHours(new Date(), 9), 0);
    const end = addHours(start, 1);
    setEditingEvent(null);
    setNewEventData({
      title: "",
      description: "",
      category: "אחר",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      color: "",
      sourceType: "custom",
      sourceId: null,
    });
    setShowEventDialog(true);
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    await deleteEvent(editingEvent.id);
    setShowEventDialog(false);
    setEditingEvent(null);
  };

  // Export to Word
  const exportToWord = () => {
    const title = viewMode === "day"
      ? format(currentDate, "dd/MM/yyyy")
      : viewMode === "week"
        ? `${format(dateRange.start, "dd/MM")} - ${format(dateRange.end, "dd/MM/yyyy")}`
        : format(currentDate, "MMMM yyyy", { locale: he });

    const eventsInRange = filteredEvents.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let html = `<html dir="rtl"><head><meta charset="utf-8"><style>
      body { font-family: Arial; direction: rtl; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
      th { background: #f0f0f0; }
      h1 { color: #333; }
    </style></head><body>
    <h1>לוח זמנים - ${title}</h1>
    <table>
      <tr><th>שעה</th><th>כותרת</th><th>קטגוריה</th><th>הערות</th></tr>`;

    eventsInRange.forEach((e) => {
      const start = format(new Date(e.startTime), "HH:mm");
      const end = format(new Date(e.endTime), "HH:mm");
      html += `<tr><td>${start}-${end}</td><td>${e.title}</td><td>${e.category}</td><td>${e.description}</td></tr>`;
    });

    html += "</table></body></html>";

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `לוח-זמנים-${title}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ הורד בהצלחה");
  };

  // Export to ICS (calendar file)
  const exportToICS = () => {
    const eventsInRange = filteredEvents.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Personal Planner//NONSGML v1.0//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";

    eventsInRange.forEach((e) => {
      const start = format(new Date(e.startTime), "yyyyMMdd'T'HHmmss");
      const end = format(new Date(e.endTime), "yyyyMMdd'T'HHmmss");
      const now = format(new Date(), "yyyyMMdd'T'HHmmss");

      ics += "BEGIN:VEVENT\r\n";
      ics += `DTSTART:${start}\r\n`;
      ics += `DTEND:${end}\r\n`;
      ics += `DTSTAMP:${now}\r\n`;
      ics += `UID:${e.id}@personal-planner\r\n`;
      ics += `SUMMARY:${e.title.replace(/[,;\\]/g, " ")}\r\n`;
      if (e.description) ics += `DESCRIPTION:${e.description.replace(/\n/g, "\\n").replace(/[,;\\]/g, " ")}\r\n`;
      ics += `CATEGORIES:${e.category}\r\n`;
      ics += "END:VEVENT\r\n";
    });

    ics += "END:VCALENDAR\r\n";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const title = viewMode === "day"
      ? format(currentDate, "dd-MM-yyyy")
      : viewMode === "week"
        ? `${format(dateRange.start, "dd-MM")}-${format(dateRange.end, "dd-MM-yyyy")}`
        : format(currentDate, "MM-yyyy");

    a.download = `schedule-${title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("קובץ לוח שנה הורד - ניתן לשלוח במייל ולייבא ליומן העבודה");
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "work": return "עבודה";
      case "personal": return "אישי";
      case "project": return "פרויקט";
      case "recurring": return "יומי";
      case "show": return "צפייה";
      case "course": return "קורס";
      case "podcast": return "פודקאסט";
      case "book": return "ספר";
      default: return source;
    }
  };

  const getSourceBg = (source: string) => {
    switch (source) {
      case "work": return "bg-orange-100 dark:bg-orange-900/30 border-orange-300";
      case "personal": return "bg-purple-100 dark:bg-purple-900/30 border-purple-300";
      case "project": return "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300";
      case "recurring": return "bg-green-100 dark:bg-green-900/30 border-green-300";
      case "show": return "bg-pink-100 dark:bg-pink-900/30 border-pink-300";
      case "course": return "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300";
      case "podcast": return "bg-amber-100 dark:bg-amber-900/30 border-amber-300";
      case "book": return "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300";
      default: return "bg-muted border-border";
    }
  };

  // Render time grid for day/week view
  const renderTimeGrid = () => {
    const days = viewMode === "day" ? [currentDate] : dateRange.days;

    return (
      <div className="flex flex-1 min-h-0 overflow-auto" ref={gridRef}>
        {/* Time column */}
        <div className="w-16 flex-shrink-0 border-l border-border">
          <div className="h-10 border-b border-border" />
          {HOURS.map((h) => {
            const hHeight = getHourHeight(h);
            return (
              <div
                key={h}
                className="border-b border-border text-xs text-muted-foreground flex flex-col items-center pt-1 relative select-none"
                style={{ height: hHeight }}
              >
                <span className="font-medium">{String(h).padStart(2, "0")}:00</span>
                {hHeight >= 80 && [15, 30, 45].map(m => (
                  <div key={m} className="absolute right-0 left-0 flex items-center pointer-events-none" style={{ top: `${(m / 60) * 100}%` }}>
                    <span className="text-[9px] text-muted-foreground/40 w-full text-center">:{String(m).padStart(2, "0")}</span>
                  </div>
                ))}
                {viewMode === "day" && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize hover:bg-primary/30 active:bg-primary/40 transition-colors rounded-b"
                    onMouseDown={(e) => handleHourResizeStart(e, h)}
                    title="גרור כדי לשנות גובה השעה"
                  >
                    <div className="w-6 h-0.5 rounded-full bg-muted-foreground/30 mx-auto mt-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        <div className="flex flex-1">
          {days.map((day, dayIndex) => {
            const isExpanded = expandedDayIndex === dayIndex;
            const dayEventCount = filteredEvents.filter(e => isSameDay(new Date(e.startTime), day)).length;
            return (
            <div
              key={day.toISOString()}
              className={`border-l border-border min-w-[100px] relative transition-all duration-200 ${isExpanded ? "flex-[3]" : "flex-1"}`}
              style={isExpanded ? { minWidth: 250 } : undefined}
            >
              {/* Day header */}
              <div
                className={`min-h-[40px] border-b border-border flex flex-col items-center justify-center text-sm sticky top-0 bg-card z-10 cursor-pointer hover:bg-muted/50 transition-colors ${isSameDay(day, new Date()) ? "bg-primary/10 font-bold" : ""}`}
                onClick={() => viewMode === "week" && setExpandedDayIndex(isExpanded ? null : dayIndex)}
                title={viewMode === "week" ? (isExpanded ? "לחץ לכווץ" : `לחץ להרחיב (${dayEventCount} אירועים)`) : undefined}
              >
                <span>{format(day, "EEEE", { locale: he })}</span>
                <span className="text-xs text-muted-foreground">{format(day, "dd/MM")}</span>
                {getHolidaysForDate(format(day, "yyyy-MM-dd")).map((h, i) => (
                  <span key={i} className="text-[9px] px-1.5 rounded-full font-medium mt-0.5" style={{ backgroundColor: h.color + "22", color: h.color }}>
                    {h.name}
                  </span>
                ))}
              </div>

              {/* Hour slots */}
              {HOURS.map((h) => {
                const slotEvents = filteredEvents.filter((e) => {
                  const eStart = new Date(e.startTime);
                  return isSameDay(eStart, day) && eStart.getHours() === h;
                });

                // Calculate overlapping groups for side-by-side display
                const allDayEvents = filteredEvents.filter((e) => {
                  const eStart = new Date(e.startTime);
                  const eEnd = new Date(e.endTime);
                  const slotStart = setMinutes(setHours(new Date(day), h), 0);
                  const slotEnd = addHours(slotStart, 1);
                  return isSameDay(eStart, day) && eStart < slotEnd && eEnd > slotStart;
                });

                // Drag preview for this slot
                const showDragPreview = draggedTask && dragCreateState && isSameDay(dragCreateState.day, day) && (() => {
                  const startTotal = dragCreateState.startHour * 60 + dragCreateState.startMinute;
                  const endTotal = dragCreateState.currentHour * 60 + dragCreateState.currentMinute;
                  const slotStart = h * 60;
                  const slotEnd = (h + 1) * 60;
                  return startTotal < slotEnd && endTotal >= slotStart && endTotal > startTotal;
                })();

                return (
                  <div
                    key={h}
                    className="border-b border-border/50 relative group hover:bg-muted/30 transition-colors"
                    style={{ height: getHourHeight(h) }}
                    data-slot-day={day.toISOString()}
                    data-slot-hour={h}
                    onDragOver={(e) => handleSlotDragOver(e, day, h)}
                    onDrop={(e) => handleDrop(day, h, e)}
                    onDragLeave={() => {}}
                  >
                    {/* Minute marks */}
                    {getHourHeight(h) >= 80 && [15, 30, 45].map(m => (
                      <div key={m} className="absolute w-full border-t border-dashed border-border/20 pointer-events-none" style={{ top: `${(m / 60) * 100}%` }} />
                    ))}
                    {/* Drag stretch preview */}
                    {showDragPreview && dragCreateState && h === dragCreateState.startHour && (
                      <div
                        className="absolute inset-x-1 rounded-md bg-primary/20 border-2 border-dashed border-primary z-30 pointer-events-none"
                        style={{
                          top: (dragCreateState.startMinute / 60) * getHourHeight(h),
                          height: Math.max(
                            ((dragCreateState.currentHour * 60 + dragCreateState.currentMinute) -
                              (dragCreateState.startHour * 60 + dragCreateState.startMinute)) / 60 * getHourHeight(h),
                            15
                          ),
                        }}
                      >
                        <div className="text-[10px] text-primary font-medium px-1 pt-0.5">
                          {String(dragCreateState.startHour).padStart(2, "0")}:{String(dragCreateState.startMinute).padStart(2, "0")}
                          {" - "}
                          {String(dragCreateState.currentHour).padStart(2, "0")}:{String(dragCreateState.currentMinute).padStart(2, "0")}
                        </div>
                      </div>
                    )}

                    {/* Events - side by side when overlapping */}
                    {slotEvents.map((event) => {
                      const startMin = new Date(event.startTime).getMinutes();
                      const duration = differenceInMinutes(
                        new Date(event.endTime),
                        new Date(event.startTime)
                      );
                      const currentHourHeight = getHourHeight(h);
                      const isResizing = resizingEvent?.eventId === event.id;
                      const height = isResizing && resizePreviewHeight !== null
                        ? resizePreviewHeight
                        : (duration / 60) * currentHourHeight;
                      const top = (startMin / 60) * currentHourHeight;

                      // Only side-by-side for truly overlapping events
                      const evStart = new Date(event.startTime);
                      const evEnd = new Date(event.endTime);
                      const trueOverlaps = allDayEvents.filter(other => {
                        const oStart = new Date(other.startTime);
                        const oEnd = new Date(other.endTime);
                        return oStart < evEnd && oEnd > evStart;
                      });
                      const overlapIndex = trueOverlaps.findIndex(e => e.id === event.id);
                      const overlapCount = trueOverlaps.length;
                      const widthPercent = overlapCount > 1 ? (100 / overlapCount) : 100;
                      const leftPercent = overlapCount > 1 ? (overlapIndex * widthPercent) : 0;

                      return (
                        <div
                          key={event.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggingEvent(event);
                            setDraggedTask(null);
                          }}
                          onDragEnd={() => setDraggingEvent(null)}
                          className={`absolute rounded-md px-2 py-1 text-xs cursor-grab active:cursor-grabbing overflow-hidden z-20 shadow-sm hover:shadow-md transition-shadow border select-none ${draggingEvent?.id === event.id ? "opacity-50" : ""}`}
                          style={{
                            top,
                            height: Math.max(height, 20),
                            backgroundColor: event.color + "22",
                            borderColor: event.color,
                            borderRightWidth: 3,
                            left: `${leftPercent}%`,
                            width: `${widthPercent - 1}%`,
                          }}
                          onClick={() => handleClickEvent(event)}
                        >
                          <div className="font-medium truncate" style={{ color: event.color }}>
                            {event.title}
                          </div>
                          {height >= 36 && (
                            <div className="text-muted-foreground truncate">
                              {format(new Date(event.startTime), "HH:mm")}-{format(new Date(event.endTime), "HH:mm")}
                            </div>
                          )}

                          {/* Resize handle */}
                          <div
                            draggable={false}
                            className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-b-md transition-colors group/resize"
                            onMouseDown={(e) => handleResizeStart(e, event)}
                          >
                            <div className="w-8 h-1 rounded-full bg-current opacity-0 group-hover/resize:opacity-40 transition-opacity" style={{ color: event.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            );
          })}

        </div>
      </div>
    );
  };

  // Render month grid
  const renderMonthGrid = () => {
    const weeks: Date[][] = [];
    for (let i = 0; i < dateRange.days.length; i += 7) {
      weeks.push(dateRange.days.slice(i, i + 7));
    }

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-card z-10">
          {["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].map((d) => (
            <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground border-l border-border">
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 min-h-[100px]">
            {week.map((day) => {
              const dayEvents = filteredEvents.filter((e) =>
                isSameDay(new Date(e.startTime), day)
              );
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();

              return (
                <div
                  key={day.toISOString()}
                  className={`border-l border-b border-border p-1 ${!isCurrentMonth ? "bg-muted/30" : ""} ${isSameDay(day, new Date()) ? "bg-primary/10" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(day)}
                >
                  <div className="text-xs font-medium mb-1">{format(day, "d")}</div>
                  {getHolidaysForDate(format(day, "yyyy-MM-dd")).map((h, i) => (
                    <div key={`h-${i}`} className="text-[9px] truncate rounded px-1 mb-0.5" style={{ backgroundColor: h.color + "22", color: h.color }}>
                      {h.name}
                    </div>
                  ))}
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggingEvent(event);
                        setDraggedTask(null);
                      }}
                      onDragEnd={() => setDraggingEvent(null)}
                      className={`text-xs truncate rounded px-1 mb-0.5 cursor-grab active:cursor-grabbing hover:opacity-80 ${draggingEvent?.id === event.id ? "opacity-50" : ""}`}
                      style={{ backgroundColor: event.color + "33", color: event.color }}
                      onClick={() => handleClickEvent(event)}
                    >
                      {format(new Date(event.startTime), "HH:mm")} {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} נוספים</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Render year grid
  const renderYearGrid = () => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
          {months.map((monthDate) => {
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            const firstDay = startOfWeek(monthStart, { weekStartsOn: 0 });
            const calendarDays: Date[] = [];
            let d = firstDay;
            while (d <= monthEnd || calendarDays.length % 7 !== 0) {
              calendarDays.push(d);
              d = addDays(d, 1);
            }

            const monthEvents = events.filter((e) => {
              const eDate = new Date(e.startTime);
              return eDate.getMonth() === monthDate.getMonth() && eDate.getFullYear() === year;
            });

            return (
              <div
                key={monthDate.toISOString()}
                className="border border-border rounded-lg p-2 bg-card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setCurrentDate(monthDate);
                  setViewMode("month");
                }}
              >
                <h3 className="text-sm font-bold text-center mb-2">
                  {format(monthDate, "MMMM", { locale: he })}
                </h3>

                {/* Mini day headers */}
                <div className="grid grid-cols-7 gap-px mb-1">
                  {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d) => (
                    <div key={d} className="text-[9px] text-muted-foreground text-center">{d}</div>
                  ))}
                </div>

                {/* Mini calendar days */}
                <div className="grid grid-cols-7 gap-px">
                  {calendarDays.map((day, i) => {
                    const isCurrentMonthDay = isSameMonth(day, monthDate);
                    const isToday = isSameDay(day, new Date());
                    const dayEventCount = monthEvents.filter((e) => isSameDay(new Date(e.startTime), day)).length;

                    return (
                      <div
                        key={i}
                        className={`text-[10px] text-center rounded aspect-square flex items-center justify-center relative ${
                          !isCurrentMonthDay ? "text-muted-foreground/30" : ""
                        } ${isToday ? "bg-primary text-primary-foreground font-bold" : ""}`}
                      >
                        {format(day, "d")}
                        {dayEventCount > 0 && isCurrentMonthDay && (
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Event count */}
                <div className="text-[10px] text-muted-foreground text-center mt-1.5 border-t border-border pt-1">
                  {monthEvents.length > 0 ? `${monthEvents.length} אירועים` : "ללא אירועים"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full" dir="rtl">
      {/* Right sidebar - Task list */}
      <div className="w-80 border-l border-border flex flex-col bg-card flex-shrink-0">
        <div className="p-3 border-b border-border">
          <h3 className="font-bold text-sm mb-1">משימות ({filteredTasks.length}/{allTasks.length})</h3>
          <p className="text-[10px] text-muted-foreground">גרור משימה ללוח ומתח לפי השעות</p>
        </div>

        {/* Filters */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-xs h-8 rounded-none border-b border-border">
              <Filter className="h-3.5 w-3.5" />
              סינון {activeFilters.has("all") ? "" : `(${activeFilters.size})`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-b border-border p-2 space-y-2">
            {/* Source filters */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground">לפי מקור:</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { key: "all" as TaskFilter, label: "הכל" },
                  { key: "personal" as TaskFilter, label: "אישי" },
                  { key: "work" as TaskFilter, label: "עבודה" },
                  { key: "project" as TaskFilter, label: "פרויקט" },
                  { key: "recurring" as TaskFilter, label: "יומי" },
                ]).map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={activeFilters.has(key) ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => toggleFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Status filters */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground">לפי סטטוס:</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { key: "overdue" as TaskFilter, label: "חריגה בתאריך", icon: <AlertTriangle className="h-3 w-3" /> },
                  { key: "today" as TaskFilter, label: "היום" },
                  { key: "week" as TaskFilter, label: "השבוע הקרוב" },
                  { key: "urgent" as TaskFilter, label: "דחוף", icon: <Flame className="h-3 w-3" /> },
                ]).map(({ key, label, icon }) => (
                  <Button
                    key={key}
                    variant={activeFilters.has(key) ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-0.5"
                    onClick={() => toggleFilter(key)}
                  >
                    {icon}
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom boards */}
            {customBoards.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">דשבורדים:</p>
                <div className="flex flex-wrap gap-1">
                  {customBoards.map(board => (
                    <Button
                      key={board.id}
                      variant={selectedBoardIds.has(board.id) ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectedBoardIds(prev => {
                        const next = new Set(prev);
                        next.has(board.id) ? next.delete(board.id) : next.add(board.id);
                        return next;
                      })}
                    >
                      {board.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Shows toggle */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showShows"
                  checked={showShowsInPlanner}
                  onCheckedChange={(c) => setShowShowsInPlanner(!!c)}
                />
                <label htmlFor="showShows" className="text-[10px] font-bold text-muted-foreground cursor-pointer">
                  הצג סדרות/סרטים
                </label>
              </div>
              {showShowsInPlanner && (
                <div className="flex gap-1 mr-5">
                  <Button
                    variant={activeFilters.has("shows_series") ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-0.5"
                    onClick={() => toggleFilter("shows_series")}
                  >
                    <Tv className="h-3 w-3" />
                    סדרות
                  </Button>
                  <Button
                    variant={activeFilters.has("shows_movies") ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-0.5"
                    onClick={() => toggleFilter("shows_movies")}
                  >
                    <Film className="h-3 w-3" />
                    סרטים
                  </Button>
                </div>
              )}
            </div>

            {/* Courses toggle */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showCourses"
                  checked={showCoursesInPlanner}
                  onCheckedChange={(c) => setShowCoursesInPlanner(!!c)}
                />
                <label htmlFor="showCourses" className="text-[10px] font-bold text-muted-foreground cursor-pointer">
                  📚 הצג קורסים (שיעור הבא)
                </label>
              </div>
              {showCoursesInPlanner && (
                <div className="flex gap-1 mr-5">
                  <Button
                    variant={activeFilters.has("courses") ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-0.5"
                    onClick={() => toggleFilter("courses")}
                  >
                    🎓 רק קורסים
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {filteredTasks.map((task) => (
              <div
                key={`${task.source}-${task.id}`}
                draggable
                onDragStart={() => handleDragStart(task)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, task)}
                onTouchMove={(e) => handleTouchMove(e)}
                onTouchEnd={(e) => handleTouchEnd(e)}
                className={`p-2 rounded-lg border cursor-grab active:cursor-grabbing text-sm transition-colors hover:shadow-sm ${getSourceBg(task.source)} ${task.overdue ? "ring-1 ring-red-400" : ""}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className={`text-[10px] px-1.5 rounded-full font-medium ${task.source === "work" ? "bg-orange-200 text-orange-800" : task.source === "personal" ? "bg-purple-200 text-purple-800" : task.source === "recurring" ? "bg-green-200 text-green-800" : task.source === "show" ? "bg-pink-200 text-pink-800" : task.source === "course" ? "bg-indigo-200 text-indigo-800" : "bg-cyan-200 text-cyan-800"}`}>
                    {getSourceLabel(task.source)}
                  </span>
                  {task.source === "recurring" && <RotateCcw className="h-3 w-3 text-green-600" />}
                  {task.source === "show" && (task.showType === "סרט" ? <Film className="h-3 w-3 text-pink-600" /> : <Tv className="h-3 w-3 text-pink-600" />)}
                  {task.urgent && <Flame className="h-3 w-3 text-destructive" />}
                  {task.overdue && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                </div>
                <div className="text-xs font-medium line-clamp-2 pr-4">{task.title || "(ללא כותרת)"}</div>
                {task.plannedEnd && (
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {format(new Date(task.plannedEnd), "dd/MM/yyyy")}
                  </div>
                )}
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                {activeFilters.has("all") ? "אין משימות פתוחות" : "אין משימות לפי הסינון"}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Left side - Calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Calendar header */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-card flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>
              היום
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="font-bold text-lg min-w-[150px]">
            {viewMode === "day" && format(currentDate, "EEEE, dd MMMM yyyy", { locale: he })}
            {viewMode === "week" && `${format(dateRange.start, "dd/MM")} - ${format(dateRange.end, "dd/MM/yyyy")}`}
            {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: he })}
            {viewMode === "year" && format(currentDate, "yyyy")}
          </h2>

          <div className="mr-auto flex items-center gap-2">
            <div className="flex border border-border rounded-md overflow-hidden">
              {(["day", "week", "month", "year"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {mode === "day" ? "יומי" : mode === "week" ? "שבועי" : mode === "month" ? "חודשי" : "שנתי"}
                </button>
              ))}
            </div>

            {/* Zoom control for day/week view */}
            {(viewMode === "day" || viewMode === "week") && (
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHourHeight(h => Math.max(MIN_HOUR_HEIGHT, h - 10))}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Slider
                  value={[hourHeight]}
                  onValueChange={(v) => setHourHeight(v[0])}
                  min={MIN_HOUR_HEIGHT}
                  max={MAX_HOUR_HEIGHT}
                  step={5}
                  className="w-20"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHourHeight(h => Math.min(MAX_HOUR_HEIGHT, h + 10))}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Button variant="outline" size="sm" className="gap-1 h-8" onClick={handleAddCustomEvent}>
              <Plus className="h-3.5 w-3.5" />
              אירוע
            </Button>

            <Button variant="outline" size="sm" className="gap-1 h-8" onClick={exportToWord}>
              <Download className="h-3.5 w-3.5" />
              Word
            </Button>

            <Button variant="outline" size="sm" className="gap-1 h-8" onClick={exportToICS}>
              <CalendarRange className="h-3.5 w-3.5" />
              ICS
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        {viewMode === "year" ? renderYearGrid() : viewMode === "month" ? renderMonthGrid() : renderTimeGrid()}
      </div>

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "עריכת אירוע" : "אירוע חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">כותרת</label>
              <Input
                value={newEventData.title}
                onChange={(e) => setNewEventData((p) => ({ ...p, title: e.target.value }))}
                placeholder="כותרת האירוע"
              />
            </div>

            <div>
              <label className="text-sm font-medium">קטגוריה</label>
              <div className="flex gap-2 items-center">
                <Select value={newEventData.category} onValueChange={(v) => setNewEventData((p) => ({ ...p, category: v, color: getDynCategoryColor(v) }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryNames.map((c) => (
                      <SelectItem key={c} value={c}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getDynCategoryColor(c) }} />
                          {c}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" className="text-xs shrink-0" onClick={() => setShowCategoryManager(true)}>
                  ⚙️ ניהול
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">שעת התחלה</label>
                <div className="flex gap-1 items-center" dir="ltr">
                  <Select
                    value={newEventData.startTime ? String(new Date(newEventData.startTime).getHours()) : "9"}
                    onValueChange={(v) => {
                      const d = new Date(newEventData.startTime || new Date());
                      d.setHours(parseInt(v));
                      setNewEventData((p) => ({ ...p, startTime: d.toISOString() }));
                    }}
                  >
                    <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 24 }, (_, i) => i).map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}</SelectItem>)}</SelectContent>
                  </Select>
                  <span>:</span>
                  <Select
                    value={newEventData.startTime ? String(new Date(newEventData.startTime).getMinutes()) : "0"}
                    onValueChange={(v) => {
                      const d = new Date(newEventData.startTime || new Date());
                      d.setMinutes(parseInt(v));
                      setNewEventData((p) => ({ ...p, startTime: d.toISOString() }));
                    }}
                  >
                    <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 60 }, (_, i) => i).map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input
                  type="date"
                  value={newEventData.startTime ? format(new Date(newEventData.startTime), "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const d = new Date(newEventData.startTime || new Date());
                    const [y, m, day] = e.target.value.split("-").map(Number);
                    d.setFullYear(y, m - 1, day);
                    setNewEventData((p) => ({ ...p, startTime: d.toISOString() }));
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">שעת סיום</label>
                <div className="flex gap-1 items-center" dir="ltr">
                  <Select
                    value={newEventData.endTime ? String(new Date(newEventData.endTime).getHours()) : "10"}
                    onValueChange={(v) => {
                      const d = new Date(newEventData.endTime || new Date());
                      d.setHours(parseInt(v));
                      setNewEventData((p) => ({ ...p, endTime: d.toISOString() }));
                    }}
                  >
                    <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 24 }, (_, i) => i).map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}</SelectItem>)}</SelectContent>
                  </Select>
                  <span>:</span>
                  <Select
                    value={newEventData.endTime ? String(new Date(newEventData.endTime).getMinutes()) : "0"}
                    onValueChange={(v) => {
                      const d = new Date(newEventData.endTime || new Date());
                      d.setMinutes(parseInt(v));
                      setNewEventData((p) => ({ ...p, endTime: d.toISOString() }));
                    }}
                  >
                    <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 60 }, (_, i) => i).map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input
                  type="date"
                  value={newEventData.endTime ? format(new Date(newEventData.endTime), "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const d = new Date(newEventData.endTime || new Date());
                    const [y, m, day] = e.target.value.split("-").map(Number);
                    d.setFullYear(y, m - 1, day);
                    setNewEventData((p) => ({ ...p, endTime: d.toISOString() }));
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">הערות</label>
              <Textarea
                value={newEventData.description}
                onChange={(e) => setNewEventData((p) => ({ ...p, description: e.target.value }))}
                placeholder="הערות נוספות..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {editingEvent && (
              <Button variant="destructive" size="sm" onClick={handleDeleteEvent} className="gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                מחק
              </Button>
            )}
            <Button onClick={handleSaveEvent}>{editingEvent ? "עדכן" : "הוסף"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Dashboard Dialog */}
      <Dialog open={showLinkToDashboard} onOpenChange={(open) => {
        if (!open) {
          setShowLinkToDashboard(false);
          setPendingLinkEvent(null);
        }
      }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספה לדשבורד משימות</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            רוצה לצרף את <strong>"{pendingLinkEvent?.title}"</strong> לדשבורד משימות? כך תקבל מעקב מלא והתראות סיום.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={() => handleLinkToDashboard("personal")} className="gap-2">
              📋 משימות אישיות
            </Button>
            <Button onClick={() => handleLinkToDashboard("work")} variant="outline" className="gap-2">
              💼 משימות עבודה
            </Button>
            <Button variant="ghost" onClick={() => { setShowLinkToDashboard(false); setPendingLinkEvent(null); }}>
              לא, תודה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Manager Dialog */}
      <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>ניהול קטגוריות</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing categories */}
            <div className="space-y-2">
              <label className="text-sm font-medium">קטגוריות קיימות</label>
              <div className="space-y-1.5 max-h-[200px] overflow-auto">
                {categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                    <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm flex-1">{cat.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeCategory(cat.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add new category */}
            <div className="space-y-2 border-t border-border pt-3">
              <label className="text-sm font-medium">הוסף קטגוריה חדשה</label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="שם הקטגוריה..."
              />
              <label className="text-sm font-medium">בחר צבע</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-all ${newCatColor === c ? "border-foreground scale-110 ring-2 ring-foreground/20" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewCatColor(c)}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  if (newCatName.trim()) {
                    addCategory(newCatName.trim(), newCatColor);
                    setNewCatName("");
                  }
                }}
                disabled={!newCatName.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                הוסף קטגוריה
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalPlanner;
