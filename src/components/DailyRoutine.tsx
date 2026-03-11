import { useState } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, CalendarCheck, History, Loader2, Flame, Calendar, RefreshCw, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const {
    tasks,
    loading,
    addTask,
    deleteTask,
    toggleCompletion,
    isTaskDueToday,
    isTaskCompletedToday,
    getCompletionHistory,
    getTaskStats,
  } = useRecurringTasks();

  const [activeTab, setActiveTab] = useState<"today" | "all" | "history">("today");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    frequency: "daily" as "daily" | "weekly" | "monthly" | "yearly",
    dayOfWeek: -1,
    dayOfMonth: -1,
    yearMonth: 0,
  });

  const todayDate = new Date().toISOString().split("T")[0];
  const todayTasks = tasks.filter(isTaskDueToday);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("נא להזין שם משימה");
      return;
    }

    await addTask({
      title: newTask.title,
      description: newTask.description || undefined,
      frequency: newTask.frequency,
      dayOfWeek: newTask.frequency === "weekly" ? (newTask.dayOfWeek === -1 ? undefined : newTask.dayOfWeek) : undefined,
      dayOfMonth: newTask.frequency === "monthly" ? newTask.dayOfMonth : undefined,
    });

    setNewTask({
      title: "",
      description: "",
      frequency: "daily",
      dayOfWeek: -1,
      dayOfMonth: 1,
    });
    setAddDialogOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2 text-muted-foreground">טוען לוז יומי...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <CalendarCheck className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">לוז משימות קבוע</h2>
        <span className="text-sm text-muted-foreground">
          ({todayTasks.length} משימות להיום)
        </span>
        <Button onClick={() => setAddDialogOpen(true)} className="mr-auto">
          <Plus className="h-4 w-4 ml-1" />
          הוסף משימה קבועה
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mb-4 flex-shrink-0">
          <TabsTrigger value="today" className="gap-2">
            <Flame className="h-4 w-4" />
            להיום ({todayTasks.filter((t) => !isTaskCompletedToday(t.id)).length})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="h-4 w-4" />
            כל המשימות ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            מעקב
          </TabsTrigger>
        </TabsList>

        {/* Today's Tasks */}
        <TabsContent value="today" className="flex-1 overflow-auto m-0">
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg">אין משימות קבועות להיום</p>
              <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף משימה ראשונה
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
                      "flex items-center gap-3 p-4 rounded-lg border transition-all",
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
                          : task.frequency === "weekly"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      )}
                    >
                      {FREQUENCY_LABELS[task.frequency]}
                    </span>
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
                  <TableHead className="text-right">משימה</TableHead>
                  <TableHead className="text-right">תדירות</TableHead>
                  <TableHead className="text-right">יום</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      אין משימות קבועות עדיין
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
                              : task.frequency === "weekly"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                              : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          )}
                        >
                          {FREQUENCY_LABELS[task.frequency]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.frequency === "weekly" && task.dayOfWeek !== null
                          ? DAYS_OF_WEEK.find((d) => d.value === task.dayOfWeek)?.label
                          : task.frequency === "weekly" && task.dayOfWeek === null
                          ? "גמיש"
                          : task.frequency === "monthly" && task.dayOfMonth !== null
                          ? `${task.dayOfMonth} בחודש`
                          : "-"}
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
                              : task.frequency === "weekly"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                              : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          )}
                        >
                          {FREQUENCY_LABELS[task.frequency]}
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
                        <span className="text-muted-foreground">רצף נוכחי:</span>
                        <span className="font-medium">{stats.currentStreak}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">שיא:</span>
                        <span className="font-medium">{stats.longestStreak}</span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {stats.completedCount} מתוך {stats.expectedCount} ב-30 יום אחרונים
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
                <p className="text-lg">אין משימות למעקב</p>
                <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 ml-1" />
                  הוסף משימה ראשונה
                </Button>
              </div>
            )}

            {/* Full History Table */}
            {tasks.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-muted/50 border-b">
                  <h4 className="font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    היסטוריית 7 ימים אחרונים
                  </h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">משימה</TableHead>
                      {Array.from({ length: 7 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - (6 - i));
                        return (
                          <TableHead key={i} className="text-center w-16">
                            {formatDate(date.toISOString().split("T")[0])}
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
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              הוסף משימה קבועה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">שם המשימה</label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="לדוגמה: ספורט בוקר"
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium">תיאור (אופציונלי)</label>
              <Input
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="פרטים נוספים..."
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium">תדירות</label>
              <Select
                value={newTask.frequency}
                onValueChange={(v) =>
                  setNewTask({ ...newTask, frequency: v as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">יומי - כל יום</SelectItem>
                  <SelectItem value="weekly">שבועי - פעם בשבוע</SelectItem>
                  <SelectItem value="monthly">חודשי - פעם בחודש</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newTask.frequency === "weekly" && (
              <div>
                <label className="text-sm font-medium">באיזה יום?</label>
                <Select
                  value={String(newTask.dayOfWeek)}
                  onValueChange={(v) => setNewTask({ ...newTask, dayOfWeek: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">גמיש - בכל יום עד שמושלם</SelectItem>
                    {DAYS_OF_WEEK.map((day) => (
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
                <label className="text-sm font-medium">באיזה יום בחודש?</label>
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleAddTask}>הוסף משימה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyRoutine;
