import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRecurringTasks } from "@/hooks/useRecurringTasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, CalendarCheck, ListTodo } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

type TaskRow = {
  status: string | null;
  overdue: boolean | null;
  urgent: boolean | null;
  archived: boolean;
};

function computeTaskStats(rows: TaskRow[]) {
  const active = rows.filter((r) => !r.archived);
  const total = active.length;
  const completed = active.filter((r) => r.status === "בוצע").length;
  const open = active.filter((r) => r.status !== "בוצע");
  const urgent = open.filter((r) => !!r.urgent).length;
  const overdue = open.filter((r) => !!r.overdue).length;

  return { total, completed, urgent, overdue };
}

function Stat({ label, value, valueClassName }: { label: string; value: number; valueClassName?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={valueClassName ?? "text-sm font-semibold text-foreground"}>{value}</span>
    </div>
  );
}

export default function TasksDashboards() {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const { user } = useAuth();
  const { tasks: recurringTasks, loading: recurringLoading, isTaskDueToday, isTaskCompletedToday } = useRecurringTasks();

  const [loading, setLoading] = useState(true);
  const [personalRows, setPersonalRows] = useState<TaskRow[]>([]);
  const [workRows, setWorkRows] = useState<TaskRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const [personalRes, workRes] = await Promise.all([
          user
            ? supabase
                .from("tasks")
                .select("status, overdue, urgent, archived")
                .eq("task_type", "personal")
                .eq("user_id", user.id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from("tasks")
            .select("status, overdue, urgent, archived")
            .eq("task_type", "work"),
        ]);

        if (cancelled) return;

        if (personalRes.error) throw personalRes.error;
        if (workRes.error) throw workRes.error;

        setPersonalRows((personalRes.data as TaskRow[]) ?? []);
        setWorkRows((workRes.data as TaskRow[]) ?? []);
      } catch (e) {
        console.error("Failed to load task dashboards", e);
        setPersonalRows([]);
        setWorkRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const personalStats = useMemo(() => computeTaskStats(personalRows), [personalRows]);
  const workStats = useMemo(() => computeTaskStats(workRows), [workRows]);

  const routineStats = useMemo(() => {
    const dueToday = recurringTasks.filter(isTaskDueToday);
    const completedToday = dueToday.filter((t) => isTaskCompletedToday(t.id));
    return {
      total: recurringTasks.length,
      dueToday: dueToday.length,
      completedToday: completedToday.length,
      pendingToday: Math.max(0, dueToday.length - completedToday.length),
    };
  }, [recurringTasks, isTaskDueToday, isTaskCompletedToday]);

  const isAnyLoading = loading || recurringLoading;
  const copy = isHebrew ? {
    personalTasks: "משימות אישיות",
    routine: "לוז יומי (משימות קבועות)",
    workTasks: "משימות עבודה",
    loading: "טוען…",
    signInNeeded: "יש להתחבר כדי לראות נתונים",
    totalActive: 'סה"כ פעיל',
    done: "בוצעו",
    urgent: "דחופות",
    overdue: "באיחור",
    totalTasks: 'סה"כ משימות',
    dueToday: "מגיעות היום",
    completedToday: "הושלמו היום",
    remainingToday: "נותרו היום",
  } : {
    personalTasks: "Personal tasks",
    routine: "Daily routine (recurring tasks)",
    workTasks: "Work tasks",
    loading: "Loading…",
    signInNeeded: "Sign in to view data",
    totalActive: "Total active",
    done: "Completed",
    urgent: "Urgent",
    overdue: "Overdue",
    totalTasks: "Total tasks",
    dueToday: "Due today",
    completedToday: "Completed today",
    remainingToday: "Remaining today",
  };

  return (
    <div className="space-y-4" dir={dir}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              {copy.personalTasks}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isAnyLoading ? (
              <div className="text-sm text-muted-foreground">{copy.loading}</div>
            ) : !user ? (
              <div className="text-sm text-muted-foreground">{copy.signInNeeded}</div>
            ) : (
              <>
                <Stat label={copy.totalActive} value={personalStats.total} />
                <Stat label={copy.done} value={personalStats.completed} valueClassName="text-sm font-semibold text-primary" />
                <Stat label={copy.urgent} value={personalStats.urgent} />
                <Stat label={copy.overdue} value={personalStats.overdue} valueClassName="text-sm font-semibold text-destructive" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {copy.routine}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isAnyLoading ? (
              <div className="text-sm text-muted-foreground">{copy.loading}</div>
            ) : !user ? (
              <div className="text-sm text-muted-foreground">{copy.signInNeeded}</div>
            ) : (
              <>
                <Stat label={copy.totalTasks} value={routineStats.total} />
                <Stat label={copy.dueToday} value={routineStats.dueToday} />
                <Stat label={copy.completedToday} value={routineStats.completedToday} valueClassName="text-sm font-semibold text-primary" />
                <Stat label={copy.remainingToday} value={routineStats.pendingToday} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              {copy.workTasks}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isAnyLoading ? (
              <div className="text-sm text-muted-foreground">{copy.loading}</div>
            ) : (
              <>
                <Stat label={copy.totalActive} value={workStats.total} />
                <Stat label={copy.done} value={workStats.completed} valueClassName="text-sm font-semibold text-primary" />
                <Stat label={copy.urgent} value={workStats.urgent} />
                <Stat label={copy.overdue} value={workStats.overdue} valueClassName="text-sm font-semibold text-destructive" />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
