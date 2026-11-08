import { useRef, useState } from "react";
import { useRecurringTasks, RecurringTask } from "@/hooks/useRecurringTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, CalendarCheck, History, Loader2, Flame, Calendar, RefreshCw, TrendingUp, Award, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { routineCopy, routineText } from "@/lib/routineCopy";
import { habitDate } from "@/lib/habitJourney";

const DAYS_OF_WEEK = [
  { value: 0, label: "ראשון" },
  { value: 1, label: "שני" },
  { value: 2, label: "שלישי" },
  { value: 3, label: "רביעי" },
  { value: 4, label: "חמישי" },
  { value: 5, label: "שישי" },
  { value: 6, label: "שבת" },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "יומי",
  thrice_weekly: "ימים קבועים בשבוע",
  weekly: "שבועי",
  monthly: "חודשי",
  yearly: "שנתי",
};

const MONTHS = [
  { value: 0, label: "ינואר" },
  { value: 1, label: "פברואר" },
  { value: 2, label: "מרץ" },
  { value: 3, label: "אפריל" },
  { value: 4, label: "מאי" },
  { value: 5, label: "יוני" },
  { value: 6, label: "יולי" },
  { value: 7, label: "אוגוסט" },
  { value: 8, label: "ספטמבר" },
  { value: 9, label: "אוקטובר" },
  { value: 10, label: "נובמבר" },
  { value: 11, label: "דצמבר" },
];

const DailyRoutine = () => {
  const { lang, dir } = useLanguage();
  const copy = routineCopy[lang];
  const rt = (source: string) => routineText(lang, source);
  const weekdays = DAYS_OF_WEEK.map(day => ({ ...day, label: new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2026, 10, 1 + day.value)) }));
  const months = MONTHS.map(month => ({ ...month, label: new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2026, month.value, 1)) }));
  const {
    tasks,
    loading,
    addTask,
    deleteTask,
    toggleCompletion,
    toggleSkipForDate,
    isTaskDueToday,
    isTaskCompletedToday,
    getCompletionHistory,
    getTaskStats,
  } = useRecurringTasks();

  const [activeTab, setActiveTab] = useState<"today" | "all" | "history">("today");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    frequency: "daily" as "daily" | "weekly" | "monthly" | "yearly" | "thrice_weekly",
    dayOfWeek: -1,
    dayOfMonth: -1,
    yearMonth: 0,
    reminderTime: "",
  });

  const todayDate = habitDate();
  const todayTasks = tasks.filter(isTaskDueToday);

  const handleAddTask = async () => {
    if (saveLock.current) return;
    if (!newTask.title.trim()) {
      toast.error(rt("נא להזין שם משימה"));
      return;
    }
    if (newTask.frequency === "thrice_weekly" && newTask.dayOfWeek <= 0) {
      toast.error(copy.required);
      return;
    }

    saveLock.current = true;
    setSaving(true);
    let createdTask: RecurringTask | null = null;
    try { createdTask = await addTask({
      title: newTask.title,
      description: newTask.description || undefined,
      frequency: newTask.frequency,
      dayOfWeek: newTask.frequency === "thrice_weekly"
        ? (newTask.dayOfWeek > 0 ? newTask.dayOfWeek : undefined)
        : newTask.frequency === "weekly"
        ? (newTask.dayOfWeek === -1 ? undefined : newTask.dayOfWeek)
        : newTask.frequency === "yearly" && newTask.dayOfMonth !== -1
        ? newTask.yearMonth
        : undefined,
      dayOfMonth: newTask.frequency === "monthly"
        ? (newTask.dayOfMonth === -1 ? undefined : newTask.dayOfMonth)
        : newTask.frequency === "yearly"
        ? (newTask.dayOfMonth === -1 ? undefined : newTask.dayOfMonth)
        : undefined,
      reminderTime: newTask.reminderTime || undefined,
    }); } finally { saveLock.current = false; setSaving(false); }

    if (!createdTask) {
      return;
    }

    setNewTask({
      title: "",
      description: "",
      frequency: "daily",
      dayOfWeek: -1,
      dayOfMonth: -1,
      yearMonth: 0,
      reminderTime: "",
    });
    setAddDialogOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2 text-muted-foreground">{rt("טוען לוז יומי...")}</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
        <CalendarCheck className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">{copy.title}</h2>
        <span className="text-sm text-muted-foreground">
          ({todayTasks.length} {rt("משימות להיום")})
        </span>
        <Button onClick={() => setAddDialogOpen(true)} className="mr-auto">
          <Plus className="h-4 w-4 ml-1" />
          {rt("הוסף משימה קבועה")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mb-4 flex-shrink-0">
          <TabsTrigger value="today" className="gap-2">
            <Flame className="h-4 w-4" />
            {rt("להיום")} ({todayTasks.filter((t) => !isTaskCompletedToday(t.id)).length})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="h-4 w-4" />
            {rt("כל המשימות")} ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {rt("מעקב")}
          </TabsTrigger>
        </TabsList>

        {/* Today's Tasks */}
        <TabsContent value="today" className="flex-1 overflow-auto m-0">
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg">{rt("אין משימות קבועות להיום")}</p>
              <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />
                {rt("הוסף משימה ראשונה")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => {
                const completed = isTaskCompletedToday(task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 p-4 rounded-lg border transition-all",
                      completed
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    <Checkbox
                      checked={completed}
                      onCheckedChange={() => toggleCompletion(task.id, todayDate)}
                      className="h-5 w-5"
                    />
                    <div className="flex-1">
                      <p
                        className={cn(
                          "font-medium",
                          completed && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                         "text-xs px-2 py-1 rounded",
                        task.frequency === "daily"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : task.frequency === "thrice_weekly"
                          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : task.frequency === "weekly"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                          : task.frequency === "yearly"
                          ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      )}
                    >
                      {task.frequency === 'thrice_weekly' ? copy.selected : rt(FREQUENCY_LABELS[task.frequency])}
                    </span>
                    {task.reminderTime && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        🔔 {task.reminderTime}
                      </span>
                    )}
                    {!completed && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-muted-foreground"
                        onClick={() => toggleSkipForDate(task.id, todayDate)}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        {rt("דלג רק להיום")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* All Tasks */}
        <TabsContent value="all" className="flex-1 overflow-auto m-0">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{rt("משימה")}</TableHead>
                  <TableHead className="text-start">{rt("תדירות")}</TableHead>
                  <TableHead className="text-start">{rt("יום")}</TableHead>
                  <TableHead className="text-start">{rt("תזכורת")}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {rt("אין משימות קבועות עדיין")}
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded",
                            task.frequency === "daily"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              : task.frequency === "thrice_weekly"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                              : task.frequency === "weekly"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                              : task.frequency === "yearly"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400"
                              : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          )}
                        >
                          {task.frequency === 'thrice_weekly' ? copy.selected : rt(FREQUENCY_LABELS[task.frequency])}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.frequency === "thrice_weekly" && task.dayOfWeek !== null
                          ? weekdays.filter(d => (task.dayOfWeek! & (1 << d.value)) !== 0).map(d => d.label).join(", ")
                          : task.frequency === "weekly" && task.dayOfWeek !== null
                          ? weekdays.find((d) => d.value === task.dayOfWeek)?.label
                          : task.frequency === "weekly" && task.dayOfWeek === null
                          ? rt("גמיש")
                          : task.frequency === "monthly" && task.dayOfMonth !== null
                          ? `${task.dayOfMonth} ${rt("בחודש")}`
                          : task.frequency === "monthly" && task.dayOfMonth === null
                          ? rt("גמיש")
                          : task.frequency === "yearly" && task.dayOfMonth !== null && task.dayOfWeek !== null
                          ? `${task.dayOfMonth} ${months.find(m => m.value === task.dayOfWeek)?.label || ""}`
                          : task.frequency === "yearly"
                          ? rt("גמיש")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {task.reminderTime ? (
                          <span className="text-xs">🔔 {task.reminderTime}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTask(task.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* History & Stats */}
        <TabsContent value="history" className="flex-1 overflow-auto m-0">
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => {
                const stats = getTaskStats(task, 30);
                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg border bg-card space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{task.title}</h4>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            task.frequency === "daily"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              : task.frequency === "thrice_weekly"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                              : task.frequency === "weekly"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                              : task.frequency === "yearly"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400"
                              : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          )}
                        >
                          {task.frequency === 'thrice_weekly' ? copy.selected : rt(FREQUENCY_LABELS[task.frequency])}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "text-2xl font-bold",
                          stats.successRate >= 80
                            ? "text-green-600 dark:text-green-400"
                            : stats.successRate >= 50
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {stats.successRate}%
                      </div>
                    </div>

                    <Progress value={stats.successRate} className="h-2" />

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{rt("רצף נוכחי:")}</span>
                        <span className="font-medium">{stats.currentStreak}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{rt("שיא:")}</span>
                        <span className="font-medium">{stats.longestStreak}</span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {stats.completedCount} {rt("מתוך")} {stats.expectedCount} {rt("ב-30 יום אחרונים")}
                    </div>

                    {/* Mini calendar for last 7 days */}
                    <div className="flex gap-1 justify-center pt-2 border-t">
                      {getCompletionHistory(task.id, 7).map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                            day.completed
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground"
                          )}
                          title={formatDate(day.date)}
                        >
                          {day.completed ? "✓" : new Date(day.date).getDate()}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg">{rt("אין משימות למעקב")}</p>
                <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 ml-1" />
                  {rt("הוסף משימה ראשונה")}
                </Button>
              </div>
            )}

            {/* Full History Table */}
            {tasks.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-muted/50 border-b">
                  <h4 className="font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {rt("היסטוריית 7 ימים אחרונים")}
                  </h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{rt("משימה")}</TableHead>
                      {Array.from({ length: 7 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - (6 - i));
                        return (
                          <TableHead key={i} className="text-center w-16">
                            {formatDate(habitDate(date))}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const history = getCompletionHistory(task.id, 7);
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          {history.map((day, i) => (
                            <TableCell key={i} className="text-center">
                              <div
                                className={cn(
                                  "w-6 h-6 rounded-full mx-auto flex items-center justify-center",
                                  day.completed
                                    ? "bg-green-500 text-white"
                                    : "bg-muted"
                                )}
                              >
                                {day.completed && "✓"}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Task Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent dir={dir} className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              {rt("הוסף משימה קבועה")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {rt("יצירת משימה קבועה חדשה ללוז היומי עם תדירות, שעה ותיאור.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{rt("שם המשימה")}</label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder={rt("לדוגמה: תפילין, מדיטציה, אימון...")}
                dir={dir}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{rt("תיאור (אופציונלי)")}</label>
              <Input
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder={rt("פרטים נוספים...")}
                dir={dir}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{rt("תדירות")}</label>
              <Select
                value={newTask.frequency}
                onValueChange={(v) =>
                  setNewTask({ ...newTask, frequency: v as RecurringTask['frequency'], dayOfWeek: v === "thrice_weekly" ? 0 : -1, dayOfMonth: -1 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{rt("יומי - כל יום")}</SelectItem>
                  <SelectItem value="thrice_weekly">{copy.selected}</SelectItem>
                  <SelectItem value="weekly">{rt("שבועי - פעם בשבוע")}</SelectItem>
                  <SelectItem value="monthly">{rt("חודשי - פעם בחודש")}</SelectItem>
                  <SelectItem value="yearly">{rt("שנתי - פעם בשנה")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newTask.frequency === "thrice_weekly" && (
              <div>
                <label className="text-sm font-medium">{copy.choose}</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewTask({ ...newTask, dayOfWeek: 63 })}>{copy.sunFri}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewTask({ ...newTask, dayOfWeek: 31 })}>{copy.sunThu}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewTask({ ...newTask, dayOfWeek: 127 })}>{copy.every}</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{copy.holidays}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {weekdays.map((day) => {
                    const isSelected = (newTask.dayOfWeek & (1 << day.value)) !== 0;
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (isSelected) {
                            setNewTask({ ...newTask, dayOfWeek: newTask.dayOfWeek & ~(1 << day.value) });
                          } else {
                            setNewTask({ ...newTask, dayOfWeek: newTask.dayOfWeek | (1 << day.value) });
                          }
                        }}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm border transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted border-border hover:bg-accent"
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {newTask.frequency === "weekly" && (
              <div>
                <label className="text-sm font-medium">{rt("באיזה יום?")}</label>
                <Select
                  value={String(newTask.dayOfWeek)}
                  onValueChange={(v) => setNewTask({ ...newTask, dayOfWeek: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">{rt("גמיש - בכל יום עד שמושלם")}</SelectItem>
                    {weekdays.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newTask.frequency === "monthly" && (
              <div>
                <label className="text-sm font-medium">{rt("באיזה יום בחודש?")}</label>
                <Select
                  value={String(newTask.dayOfMonth)}
                  onValueChange={(v) => setNewTask({ ...newTask, dayOfMonth: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">{rt("גמיש - בכל יום עד שמושלם")}</SelectItem>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newTask.frequency === "yearly" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">{rt("גמיש או תאריך קבוע?")}</label>
                  <Select
                    value={newTask.dayOfMonth === -1 ? "flexible" : "fixed"}
                    onValueChange={(v) => {
                      if (v === "flexible") {
                        setNewTask({ ...newTask, dayOfMonth: -1, yearMonth: 0 });
                      } else {
                        setNewTask({ ...newTask, dayOfMonth: 1, yearMonth: 0 });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flexible">{rt("גמיש - בכל יום עד שמושלם")}</SelectItem>
                      <SelectItem value="fixed">{rt("תאריך קבוע")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newTask.dayOfMonth !== -1 && (
                  <>
                    <div>
                      <label className="text-sm font-medium">{rt("באיזה חודש?")}</label>
                      <Select
                        value={String(newTask.yearMonth)}
                        onValueChange={(v) => setNewTask({ ...newTask, yearMonth: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((m) => (
                            <SelectItem key={m.value} value={String(m.value)}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{rt("באיזה יום?")}</label>
                      <Select
                        value={String(newTask.dayOfMonth)}
                        onValueChange={(v) => setNewTask({ ...newTask, dayOfMonth: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{rt("שעת תזכורת (אופציונלי)")}</label>
              <Input
                type="time"
                value={newTask.reminderTime}
                onChange={(e) => setNewTask({ ...newTask, reminderTime: e.target.value })}
                placeholder="08:00"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">{rt("אם תוגדר שעה, המשימה תופיע במתכנן הלוז ותישלח תזכורת")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {rt("ביטול")}
            </Button>
            <Button disabled={saving} onClick={handleAddTask}>{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{rt("הוסף משימה")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyRoutine;
