import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Target, Flame, Star, Zap, TrendingUp, Award, CheckCircle2, Clock, BookOpen, Briefcase, CalendarCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import SessionHistory from "./challenges/SessionHistory";
import { useLanguage } from "@/hooks/useLanguage";

interface DailyStats {
  tasksCompleted: number;
  tasksCreated: number;
  routineCompleted: number;
  pomodoroSessions: number;
  booksActive: number;
  projectsActive: number;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
  category: "tasks" | "routine" | "focus" | "streaks" | "general";
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  icon: string;
  type: "daily" | "weekly";
  expiresLabel: string;
}

const ChallengesManager = () => {
  const { user } = useAuth();
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const [stats, setStats] = useState<DailyStats>({ tasksCompleted: 0, tasksCreated: 0, routineCompleted: 0, pomodoroSessions: 0, booksActive: 0, projectsActive: 0 });
  const [weeklyStats, setWeeklyStats] = useState<{ tasksCompleted: number; routineCompleted: number; daysActive: number }>({ tasksCompleted: 0, routineCompleted: 0, daysActive: 0 });
  const [allTimeStats, setAllTimeStats] = useState<{ totalTasks: number; totalRoutine: number; totalBooks: number; totalProjects: number }>({ totalTasks: 0, totalRoutine: 0, totalBooks: 0, totalProjects: 0 });
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).toISOString();
      
      // Parallel fetches
      const [tasksRes, routineRes, booksRes, projectsRes, weekTasksRes, weekRoutineRes, allTasksRes, allRoutineRes, allBooksRes, allProjectsRes] = await Promise.all([
        // Today's tasks completed
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "הושלם").gte("updated_at", startOfDay),
        // Today's routine
        supabase.from("recurring_task_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("completed_at", startOfDay),
        // Active books
        supabase.from("books").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "קורא עכשיו"),
        // Active projects
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "פעיל"),
        // Weekly tasks
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "הושלם").gte("updated_at", startOfWeek),
        // Weekly routine
        supabase.from("recurring_task_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("completed_at", startOfWeek),
        // All time tasks
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "הושלם"),
        // All time routine
        supabase.from("recurring_task_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        // All books
        supabase.from("books").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        // All projects
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      // Today's created tasks
      const { count: createdCount } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfDay);

      // Pomodoro sessions from localStorage
      const savedSessions = localStorage.getItem("zoneflow-sessions") || localStorage.getItem("deeply-sessions");
      const sessions = savedSessions ? JSON.parse(savedSessions) : [];
      const todaySessions = sessions.filter((s: any) => new Date(s.timestamp).toDateString() === today.toDateString());

      setStats({
        tasksCompleted: tasksRes.count || 0,
        tasksCreated: createdCount || 0,
        routineCompleted: routineRes.count || 0,
        pomodoroSessions: todaySessions.length,
        booksActive: booksRes.count || 0,
        projectsActive: projectsRes.count || 0,
      });

      setWeeklyStats({
        tasksCompleted: weekTasksRes.count || 0,
        routineCompleted: weekRoutineRes.count || 0,
        daysActive: Math.min(7, new Set(sessions.filter((s: any) => new Date(s.timestamp) >= new Date(startOfWeek)).map((s: any) => new Date(s.timestamp).toDateString())).size),
      });

      setAllTimeStats({
        totalTasks: allTasksRes.count || 0,
        totalRoutine: allRoutineRes.count || 0,
        totalBooks: allBooksRes.count || 0,
        totalProjects: allProjectsRes.count || 0,
      });

      // Calculate streak
      let currentStreak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split("T")[0];
        const { count } = await supabase.from("recurring_task_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("completed_date", dayStr);
        if ((count || 0) > 0) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
      }
      setStreak(currentStreak);

    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Generate achievements
  const achievements: Achievement[] = useMemo(() => [
    { id: "first-task", icon: "✅", title: "צעד ראשון", description: "השלם משימה אחת", unlocked: allTimeStats.totalTasks >= 1, progress: Math.min(allTimeStats.totalTasks, 1), target: 1, category: "tasks" },
    { id: "task-10", icon: "🎯", title: "מתמיד", description: "השלם 10 משימות", unlocked: allTimeStats.totalTasks >= 10, progress: Math.min(allTimeStats.totalTasks, 10), target: 10, category: "tasks" },
    { id: "task-50", icon: "💪", title: "מכונת ביצוע", description: "השלם 50 משימות", unlocked: allTimeStats.totalTasks >= 50, progress: Math.min(allTimeStats.totalTasks, 50), target: 50, category: "tasks" },
    { id: "task-100", icon: "🏆", title: "אגדה", description: "השלם 100 משימות", unlocked: allTimeStats.totalTasks >= 100, progress: Math.min(allTimeStats.totalTasks, 100), target: 100, category: "tasks" },
    { id: "task-500", icon: "👑", title: "מלך הביצוע", description: "השלם 500 משימות", unlocked: allTimeStats.totalTasks >= 500, progress: Math.min(allTimeStats.totalTasks, 500), target: 500, category: "tasks" },
    { id: "routine-streak-3", icon: "🔥", title: "3 ימים ברצף", description: "בצע שגרה 3 ימים רצופים", unlocked: streak >= 3, progress: Math.min(streak, 3), target: 3, category: "streaks" },
    { id: "routine-streak-7", icon: "⚡", title: "שבוע שלם!", description: "שגרה 7 ימים ברצף", unlocked: streak >= 7, progress: Math.min(streak, 7), target: 7, category: "streaks" },
    { id: "routine-streak-30", icon: "💎", title: "חודש ברצף!", description: "שגרה 30 ימים ברצף", unlocked: streak >= 30, progress: Math.min(streak, 30), target: 30, category: "streaks" },
    { id: "routine-total-50", icon: "📋", title: "שגרתן מתחיל", description: "בצע 50 משימות שגרה", unlocked: allTimeStats.totalRoutine >= 50, progress: Math.min(allTimeStats.totalRoutine, 50), target: 50, category: "routine" },
    { id: "routine-total-200", icon: "🌟", title: "שגרתן מקצועי", description: "בצע 200 משימות שגרה", unlocked: allTimeStats.totalRoutine >= 200, progress: Math.min(allTimeStats.totalRoutine, 200), target: 200, category: "routine" },
    { id: "book-1", icon: "📚", title: "קורא מתחיל", description: "הוסף ספר ראשון", unlocked: allTimeStats.totalBooks >= 1, progress: Math.min(allTimeStats.totalBooks, 1), target: 1, category: "general" },
    { id: "book-5", icon: "📖", title: "תולעת ספרים", description: "הוסף 5 ספרים", unlocked: allTimeStats.totalBooks >= 5, progress: Math.min(allTimeStats.totalBooks, 5), target: 5, category: "general" },
    { id: "project-1", icon: "🚀", title: "יזם", description: "צור פרויקט ראשון", unlocked: allTimeStats.totalProjects >= 1, progress: Math.min(allTimeStats.totalProjects, 1), target: 1, category: "general" },
    { id: "project-5", icon: "🏗️", title: "בונה עולמות", description: "צור 5 פרויקטים", unlocked: allTimeStats.totalProjects >= 5, progress: Math.min(allTimeStats.totalProjects, 5), target: 5, category: "general" },
    { id: "focus-5", icon: "🍅", title: "מתמקד", description: "5 סשנים ב-ZoneFlow", unlocked: (() => { try { const s = JSON.parse(localStorage.getItem("zoneflow-sessions") || localStorage.getItem("deeply-sessions") || "[]"); return s.length >= 5; } catch { return false; } })(), progress: Math.min((() => { try { return JSON.parse(localStorage.getItem("zoneflow-sessions") || localStorage.getItem("deeply-sessions") || "[]").length; } catch { return 0; } })(), 5), target: 5, category: "focus" },
    { id: "focus-25", icon: "🧘", title: "זן מאסטר", description: "25 סשנים ב-ZoneFlow", unlocked: (() => { try { const s = JSON.parse(localStorage.getItem("zoneflow-sessions") || localStorage.getItem("deeply-sessions") || "[]"); return s.length >= 25; } catch { return false; } })(), progress: Math.min((() => { try { return JSON.parse(localStorage.getItem("zoneflow-sessions") || localStorage.getItem("deeply-sessions") || "[]").length; } catch { return 0; } })(), 25), target: 25, category: "focus" },
  ], [allTimeStats, streak]);

  // Generate challenges based on yesterday's performance
  const challenges: Challenge[] = useMemo(() => {
    const yesterday = stats; // Use today's stats as baseline for challenges
    const result: Challenge[] = [];

    // Daily challenges
    result.push({
      id: "daily-tasks",
      title: `השלם ${Math.max(2, (yesterday.tasksCompleted || 0) + 1)} משימות היום`,
      description: yesterday.tasksCompleted > 0 ? `אתמול השלמת ${yesterday.tasksCompleted}, היום תעלה רמה!` : "בוא נתחיל עם משימות היום!",
      target: Math.max(2, (yesterday.tasksCompleted || 0) + 1),
      current: stats.tasksCompleted,
      icon: "🎯",
      type: "daily",
      expiresLabel: "היום",
    });

    result.push({
      id: "daily-routine",
      title: `בצע ${Math.max(3, (yesterday.routineCompleted || 0) + 1)} פעולות שגרה`,
      description: "שמור על השגרה שלך!",
      target: Math.max(3, (yesterday.routineCompleted || 0) + 1),
      current: stats.routineCompleted,
      icon: "📋",
      type: "daily",
      expiresLabel: "היום",
    });

    result.push({
      id: "daily-pomodoro",
      title: `עשה ${Math.max(2, stats.pomodoroSessions + 1)} סשני פומודורו`,
      description: "ריכוז עמוק עם טיימר",
      target: Math.max(2, stats.pomodoroSessions + 1),
      current: stats.pomodoroSessions,
      icon: "🍅",
      type: "daily",
      expiresLabel: "היום",
    });

    result.push({
      id: "daily-create",
      title: `צור ${Math.max(1, (yesterday.tasksCreated || 0))} משימות חדשות`,
      description: "תכנן את היום שלך",
      target: Math.max(1, yesterday.tasksCreated || 1),
      current: stats.tasksCreated,
      icon: "✏️",
      type: "daily",
      expiresLabel: "היום",
    });

    // Weekly challenges
    result.push({
      id: "weekly-tasks",
      title: `השלם ${Math.max(10, weeklyStats.tasksCompleted + 5)} משימות השבוע`,
      description: `עד כה: ${weeklyStats.tasksCompleted} משימות`,
      target: Math.max(10, weeklyStats.tasksCompleted + 5),
      current: weeklyStats.tasksCompleted,
      icon: "🏅",
      type: "weekly",
      expiresLabel: "השבוע",
    });

    result.push({
      id: "weekly-streak",
      title: `שמור על רצף של ${Math.max(3, streak + 1)} ימים`,
      description: `רצף נוכחי: ${streak} ימים`,
      target: Math.max(3, streak + 1),
      current: streak,
      icon: "🔥",
      type: "weekly",
      expiresLabel: "השבוע",
    });

    result.push({
      id: "weekly-active",
      title: `היה פעיל ${Math.max(5, weeklyStats.daysActive + 1)} ימים השבוע`,
      description: `עד כה: ${weeklyStats.daysActive} ימים`,
      target: Math.max(5, weeklyStats.daysActive + 1),
      current: weeklyStats.daysActive,
      icon: "⚡",
      type: "weekly",
      expiresLabel: "השבוע",
    });

    return result;
  }, [stats, weeklyStats, streak]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const completedChallenges = challenges.filter(c => c.current >= c.target).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">{isHebrew ? "טוען אנליטיקה..." : "Loading analytics..."}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-6" dir={dir}>
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 text-violet-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-violet-400">{unlockedCount}/{achievements.length}</p>
            <p className="text-xs text-muted-foreground">הישגים</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <Flame className="h-6 w-6 text-orange-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-400">{streak}</p>
            <p className="text-xs text-muted-foreground">ימי רצף</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{allTimeStats.totalTasks}</p>
            <p className="text-xs text-muted-foreground">משימות הושלמו</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Target className="h-6 w-6 text-cyan-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-cyan-400">{completedChallenges}/{challenges.length}</p>
            <p className="text-xs text-muted-foreground">אתגרים</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            סטטיסטיקות היום
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: "משימות הושלמו", value: stats.tasksCompleted, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
              { label: "משימות נוצרו", value: stats.tasksCreated, icon: <Target className="h-4 w-4 text-blue-500" /> },
              { label: "שגרה יומית", value: stats.routineCompleted, icon: <CalendarCheck className="h-4 w-4 text-orange-500" /> },
              { label: "סשני פוקוס", value: stats.pomodoroSessions, icon: <Clock className="h-4 w-4 text-violet-500" /> },
              { label: "ספרים פעילים", value: stats.booksActive, icon: <BookOpen className="h-4 w-4 text-rose-500" /> },
              { label: "פרויקטים", value: stats.projectsActive, icon: <Briefcase className="h-4 w-4 text-cyan-500" /> },
            ].map((item, i) => (
              <div key={i} className="text-center p-3 rounded-xl bg-muted/50">
                <div className="flex justify-center mb-1">{item.icon}</div>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Challenges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            אתגרים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-400" /> אתגרים יומיים
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {challenges.filter(c => c.type === "daily").map(challenge => {
                const pct = Math.min(100, Math.round((challenge.current / challenge.target) * 100));
                const done = challenge.current >= challenge.target;
                return (
                  <div key={challenge.id} className={`p-3 rounded-xl border transition-all ${done ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted/30 border-border"}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-lg">{challenge.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{challenge.title}</p>
                        <p className="text-xs text-muted-foreground">{challenge.description}</p>
                      </div>
                      {done && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-[10px] text-muted-foreground mt-1 text-left">{challenge.current}/{challenge.target}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-violet-400" /> אתגרים שבועיים
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {challenges.filter(c => c.type === "weekly").map(challenge => {
                const pct = Math.min(100, Math.round((challenge.current / challenge.target) * 100));
                const done = challenge.current >= challenge.target;
                return (
                  <div key={challenge.id} className={`p-3 rounded-xl border transition-all ${done ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted/30 border-border"}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-lg">{challenge.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{challenge.title}</p>
                        <p className="text-xs text-muted-foreground">{challenge.description}</p>
                      </div>
                      {done && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-[10px] text-muted-foreground mt-1 text-left">{challenge.current}/{challenge.target}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session History - Pomodoro & Stopwatch */}
      <SessionHistory />

      {/* Achievements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            הישגים ({unlockedCount}/{achievements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {achievements.map(ach => {
              const pct = Math.min(100, Math.round((ach.progress / ach.target) * 100));
              return (
                <div key={ach.id} className={`p-3 rounded-xl border transition-all ${ach.unlocked ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/20 border-border opacity-70"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xl ${ach.unlocked ? "" : "grayscale opacity-50"}`}>{ach.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ach.title}</p>
                      <p className="text-xs text-muted-foreground">{ach.description}</p>
                    </div>
                    {ach.unlocked && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1 text-left">{ach.progress}/{ach.target}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Refresh */}
      <div className="flex justify-center pb-4">
        <Button variant="outline" size="sm" onClick={fetchAnalytics} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          רענן נתונים
        </Button>
      </div>
    </div>
  );
};

export default ChallengesManager;
