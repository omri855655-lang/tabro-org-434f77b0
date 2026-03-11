import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  dayOfWeek: number | null; // 0-6 for weekly tasks
  dayOfMonth: number | null; // 1-31 for monthly/yearly tasks (for yearly, also used as month via dayOfWeek as month index 0-11)
  createdAt: string;
}

export interface RecurringTaskCompletion {
  id: string;
  recurringTaskId: string;
  completedDate: string;
  completedAt: string;
}

interface DbRecurringTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  created_at: string;
  updated_at: string;
}

interface DbCompletion {
  id: string;
  recurring_task_id: string;
  user_id: string;
  completed_date: string;
  completed_at: string;
}

const mapDbToRecurringTask = (db: DbRecurringTask): RecurringTask => ({
  id: db.id,
  title: db.title,
  description: db.description,
  frequency: db.frequency as RecurringTask["frequency"],
  dayOfWeek: db.day_of_week,
  dayOfMonth: db.day_of_month,
  createdAt: db.created_at,
});

const mapDbToCompletion = (db: DbCompletion): RecurringTaskCompletion => ({
  id: db.id,
  recurringTaskId: db.recurring_task_id,
  completedDate: db.completed_date,
  completedAt: db.completed_at,
});

export function useRecurringTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [completions, setCompletions] = useState<RecurringTaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setCompletions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("recurring_tasks")
        .select("*")
        .order("created_at", { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch completions for the past 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: completionsData, error: completionsError } = await supabase
        .from("recurring_task_completions")
        .select("*")
        .gte("completed_date", thirtyDaysAgo.toISOString().split("T")[0]);

      if (completionsError) throw completionsError;

      setTasks((tasksData as DbRecurringTask[]).map(mapDbToRecurringTask));
      setCompletions((completionsData as DbCompletion[]).map(mapDbToCompletion));
    } catch (error: any) {
      console.error("Error fetching recurring tasks:", error);
      toast.error("שגיאה בטעינת משימות קבועות");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addTask = useCallback(
    async (task: {
      title: string;
      description?: string;
      frequency: "daily" | "weekly" | "monthly" | "yearly";
      dayOfWeek?: number;
      dayOfMonth?: number;
    }) => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from("recurring_tasks")
          .insert({
            user_id: user.id,
            title: task.title,
            description: task.description || null,
            frequency: task.frequency,
            day_of_week: task.dayOfWeek ?? null,
            day_of_month: task.dayOfMonth ?? null,
          })
          .select()
          .single();

        if (error) throw error;

        const newTask = mapDbToRecurringTask(data as DbRecurringTask);
        setTasks((prev) => [...prev, newTask]);
        toast.success("המשימה נוספה בהצלחה");
        return newTask;
      } catch (error: any) {
        console.error("Error adding recurring task:", error);
        toast.error("שגיאה בהוספת משימה");
        return null;
      }
    },
    [user]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Omit<RecurringTask, "id" | "createdAt">>) => {
      if (!user) return;

      const dbUpdates: Record<string, any> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
      if (updates.dayOfWeek !== undefined) dbUpdates.day_of_week = updates.dayOfWeek;
      if (updates.dayOfMonth !== undefined) dbUpdates.day_of_month = updates.dayOfMonth;

      try {
        const { error } = await supabase
          .from("recurring_tasks")
          .update(dbUpdates)
          .eq("id", taskId);

        if (error) throw error;

        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
        );
      } catch (error: any) {
        console.error("Error updating recurring task:", error);
        toast.error("שגיאה בעדכון משימה");
      }
    },
    [user]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user) return;

      try {
        const { error } = await supabase
          .from("recurring_tasks")
          .delete()
          .eq("id", taskId);

        if (error) throw error;

        setTasks((prev) => prev.filter((task) => task.id !== taskId));
        toast.success("המשימה נמחקה");
      } catch (error: any) {
        console.error("Error deleting recurring task:", error);
        toast.error("שגיאה במחיקת משימה");
      }
    },
    [user]
  );

  const toggleCompletion = useCallback(
    async (taskId: string, date: string) => {
      if (!user) return;

      const existingCompletion = completions.find(
        (c) => c.recurringTaskId === taskId && c.completedDate === date
      );

      try {
        if (existingCompletion) {
          // Remove completion
          const { error } = await supabase
            .from("recurring_task_completions")
            .delete()
            .eq("id", existingCompletion.id);

          if (error) throw error;

          setCompletions((prev) => prev.filter((c) => c.id !== existingCompletion.id));
        } else {
          // Add completion
          const { data, error } = await supabase
            .from("recurring_task_completions")
            .insert({
              recurring_task_id: taskId,
              user_id: user.id,
              completed_date: date,
            })
            .select()
            .single();

          if (error) throw error;

          const newCompletion = mapDbToCompletion(data as DbCompletion);
          setCompletions((prev) => [...prev, newCompletion]);
        }
      } catch (error: any) {
        console.error("Error toggling completion:", error);
        toast.error("שגיאה בעדכון השלמה");
      }
    },
    [user, completions]
  );

  const isTaskDueToday = useCallback((task: RecurringTask): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();
    const month = today.getMonth();

    switch (task.frequency) {
      case "daily":
        return true;
      case "weekly":
        if (task.dayOfWeek === null) return true; // flexible
        return task.dayOfWeek === dayOfWeek;
      case "monthly":
        if (task.dayOfMonth === null) return true; // flexible
        return task.dayOfMonth === dayOfMonth;
      case "yearly":
        if (task.dayOfMonth === null && task.dayOfWeek === null) return true; // flexible
        // For yearly: dayOfWeek stores month (0-11), dayOfMonth stores day
        return task.dayOfWeek === month && task.dayOfMonth === dayOfMonth;
      default:
        return false;
    }
  }, []);

  const isTaskCompletedToday = useCallback(
    (taskId: string): boolean => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      
      // Check if completed today
      const completedToday = completions.some(
        (c) => c.recurringTaskId === taskId && c.completedDate === todayStr
      );
      if (completedToday) return true;

      const task = tasks.find(t => t.id === taskId);
      if (!task) return false;

      // For flexible weekly tasks, check if completed this week
      if (task.frequency === "weekly" && task.dayOfWeek === null) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekStartStr = weekStart.toISOString().split("T")[0];
        return completions.some(
          (c) => c.recurringTaskId === taskId && c.completedDate >= weekStartStr && c.completedDate <= todayStr
        );
      }

      // For flexible monthly tasks, check if completed this month
      if (task.frequency === "monthly" && task.dayOfMonth === null) {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split("T")[0];
        return completions.some(
          (c) => c.recurringTaskId === taskId && c.completedDate >= monthStartStr && c.completedDate <= todayStr
        );
      }

      // For flexible yearly tasks, check if completed this year
      if (task.frequency === "yearly" && task.dayOfMonth === null && task.dayOfWeek === null) {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearStartStr = yearStart.toISOString().split("T")[0];
        return completions.some(
          (c) => c.recurringTaskId === taskId && c.completedDate >= yearStartStr && c.completedDate <= todayStr
        );
      }

      return false;
    },
    [completions, tasks]
  );

  const getCompletionHistory = useCallback(
    (taskId: string, days: number = 7): { date: string; completed: boolean }[] => {
      const history: { date: string; completed: boolean }[] = [];
      const today = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        history.push({
          date: dateStr,
          completed: completions.some(
            (c) => c.recurringTaskId === taskId && c.completedDate === dateStr
          ),
        });
      }

      return history.reverse();
    },
    [completions]
  );

  // Calculate task statistics for tracking
  const getTaskStats = useCallback(
    (task: RecurringTask, days: number = 30): {
      completedCount: number;
      expectedCount: number;
      successRate: number;
      currentStreak: number;
      longestStreak: number;
    } => {
      const today = new Date();
      let completedCount = 0;
      let expectedCount = 0;
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      let streakBroken = false;

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayOfWeek = date.getDay();
        const dayOfMonth = date.getDate();

        // Check if task was due on this date
        let isDue = false;
        switch (task.frequency) {
          case "daily":
            isDue = true;
            break;
          case "weekly":
            isDue = task.dayOfWeek === dayOfWeek;
            break;
          case "monthly":
            isDue = task.dayOfMonth === dayOfMonth;
            break;
        }

        if (isDue) {
          expectedCount++;
          const wasCompleted = completions.some(
            (c) => c.recurringTaskId === task.id && c.completedDate === dateStr
          );

          if (wasCompleted) {
            completedCount++;
            tempStreak++;
            if (!streakBroken) {
              currentStreak = tempStreak;
            }
            longestStreak = Math.max(longestStreak, tempStreak);
          } else {
            tempStreak = 0;
            if (i > 0) streakBroken = true; // Only break streak if not today
          }
        }
      }

      const successRate = expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0;

      return {
        completedCount,
        expectedCount,
        successRate,
        currentStreak,
        longestStreak,
      };
    },
    [completions]
  );

  return {
    tasks,
    completions,
    loading,
    addTask,
    updateTask,
    deleteTask,
    toggleCompletion,
    isTaskDueToday,
    isTaskCompletedToday,
    getCompletionHistory,
    getTaskStats,
    refetch: fetchData,
  };
}
