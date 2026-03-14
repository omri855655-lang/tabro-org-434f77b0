import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DbTask {
  id: string;
  user_id: string;
  description: string;
  category: string | null;
  responsible: string | null;
  status: string;
  status_notes: string | null;
  progress: string | null;
  planned_end: string | null;
  overdue: boolean;
  task_type: "personal" | "work";
  sheet_name: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  userId: string;
  description: string;
  category: string;
  responsible: string;
  status: "בוצע" | "טרם החל" | "בטיפול";
  statusNotes: string;
  progress: string;
  plannedEnd: string;
  overdue: boolean;
  urgent: boolean;
  sheetName: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const mapDbTaskToTask = (dbTask: DbTask & { urgent?: boolean }): Task => ({
  id: dbTask.id,
  userId: dbTask.user_id,
  description: dbTask.description,
  category: dbTask.category || "",
  responsible: dbTask.responsible || "",
  status: (dbTask.status as Task["status"]) || "טרם החל",
  statusNotes: dbTask.status_notes || "",
  progress: dbTask.progress || "",
  plannedEnd: dbTask.planned_end || "",
  overdue: dbTask.overdue,
  urgent: dbTask.urgent || false,
  sheetName: dbTask.sheet_name || String(new Date().getFullYear()),
  archived: dbTask.archived || false,
  createdAt: dbTask.created_at,
  updatedAt: dbTask.updated_at,
});

const mapTaskToDbInsert = (
  task: Partial<Task>,
  userId: string,
  taskType: "personal" | "work",
  sheetName: string
) => ({
  user_id: userId,
  description: task.description || "",
  category: task.category || null,
  responsible: task.responsible || null,
  status: task.status || "טרם החל",
  status_notes: task.statusNotes || null,
  progress: task.progress || null,
  planned_end: task.plannedEnd || null,
  overdue: task.overdue || false,
  urgent: task.urgent || false,
  archived: task.archived || false,
  task_type: taskType,
  sheet_name: sheetName,
});

export function useTasks(
  taskType: "personal" | "work",
  sheetName?: string | null,
  ownerId?: string
) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("task_type", taskType)
        .order("created_at", { ascending: true });

      if (sheetName !== null && sheetName !== undefined) {
        query = query.eq("sheet_name", sheetName);
      }

      if (ownerId) {
        query = query.eq("user_id", ownerId);
      } else if (taskType === "personal") {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mappedTasks = (data as unknown as DbTask[]).map((dbTask) => {
        const task = mapDbTaskToTask(dbTask);

        if (task.plannedEnd && task.status !== "בוצע") {
          const plannedDate = new Date(task.plannedEnd);
          plannedDate.setHours(0, 0, 0, 0);
          task.overdue = plannedDate < today;
        } else {
          task.overdue = false;
        }

        return task;
      });

      setTasks(mappedTasks);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      toast.error("שגיאה בטעינת משימות");
    } finally {
      setLoading(false);
    }
  }, [user, taskType, sheetName, ownerId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(
    async (targetSheetName?: string, initialValues?: Partial<Task>): Promise<Task | null> => {
      if (!user) return null;

      const taskSheetName = targetSheetName ?? sheetName ?? String(new Date().getFullYear());
      const insertOwnerId = ownerId ?? user.id;

      const newDbTask = mapTaskToDbInsert(
        {
          description: "",
          category: "",
          responsible: "",
          status: "טרם החל",
          statusNotes: "",
          progress: "",
          plannedEnd: "",
          overdue: false,
          urgent: false,
          archived: false,
          ...initialValues,
        },
        insertOwnerId,
        taskType,
        taskSheetName
      );

      try {
        const { data, error } = await supabase
          .from("tasks")
          .insert([newDbTask])
          .select()
          .single();

        if (error) throw error;

        const newTask = mapDbTaskToTask(data as unknown as DbTask);
        setTasks((prev) => [...prev, newTask]);
        return newTask;
      } catch (error: any) {
        console.error("Error adding task:", error);
        toast.error("שגיאה בהוספת משימה");
        return null;
      }
    },
    [user, taskType, sheetName, ownerId]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      if (!user) return;

      const currentTask = tasks.find((t) => t.id === taskId);

      const dbUpdates: Record<string, any> = {};
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.category !== undefined) dbUpdates.category = updates.category || null;
      if (updates.responsible !== undefined) dbUpdates.responsible = updates.responsible || null;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.statusNotes !== undefined) dbUpdates.status_notes = updates.statusNotes || null;
      if (updates.progress !== undefined) dbUpdates.progress = updates.progress || null;
      if (updates.plannedEnd !== undefined) dbUpdates.planned_end = updates.plannedEnd || null;
      if (updates.overdue !== undefined) dbUpdates.overdue = updates.overdue;
      if (updates.urgent !== undefined) dbUpdates.urgent = updates.urgent;
      if (updates.archived !== undefined) dbUpdates.archived = updates.archived;

      const newPlannedEnd = updates.plannedEnd !== undefined ? updates.plannedEnd : currentTask?.plannedEnd;
      const newStatus = updates.status !== undefined ? updates.status : currentTask?.status;

      if (newPlannedEnd && newStatus !== "בוצע") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const plannedDate = new Date(newPlannedEnd);
        plannedDate.setHours(0, 0, 0, 0);
        dbUpdates.overdue = plannedDate < today;
        updates.overdue = dbUpdates.overdue;
      } else if (newStatus === "בוצע" || !newPlannedEnd) {
        dbUpdates.overdue = false;
        updates.overdue = false;
      }

      try {
        let query = supabase.from("tasks").update(dbUpdates).eq("id", taskId);
        if (ownerId) query = query.eq("user_id", ownerId);
        const { data, error } = await query.select("id").maybeSingle();

        if (error) throw error;
        if (!data) {
          toast.error("אין הרשאה לעדכן את המשימה");
          return;
        }

        setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
      } catch (error: any) {
        console.error("Error updating task:", error);
        toast.error("שגיאה בעדכון משימה");
      }
    },
    [user, tasks, ownerId]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user) return;

      try {
        let query = supabase.from("tasks").delete().eq("id", taskId);
        if (ownerId) query = query.eq("user_id", ownerId);
        const { data, error } = await query.select("id").maybeSingle();

        if (error) throw error;
        if (!data) {
          toast.error("אין הרשאה למחוק את המשימה");
          return;
        }

        setTasks((prev) => prev.filter((task) => task.id !== taskId));
      } catch (error: any) {
        console.error("Error deleting task:", error);
        toast.error("שגיאה במחיקת משימה");
      }
    },
    [user, ownerId]
  );

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  };
}
