import { useMemo } from "react";
import { useRecurringTasks } from "@/hooks/useRecurringTasks";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Target, Flame, TrendingUp, CalendarDays } from "lucide-react";
import { format, subDays } from "date-fns";
import { he, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";

export default function ProductivityDashboard() {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const { tasks, completions, getTaskStats } = useRecurringTasks();
  const { events } = useCalendarEvents();
  const copy = isHebrew ? {
    title: "פרודוקטיביות",
    completions30: "השלמות (30 יום)",
    avgPerDay: "ממוצע ליום",
    scheduledEvents: "אירועים מתוכננים",
    bestStreak: "שיא רצף",
    lastWeek: "שבוע אחרון",
    dailyCompletions: "השלמות יומי",
    calendarEvents: "אירועי לוח",
    streaksTitle: "רצפים ושיעורי הצלחה",
    streak: "רצף",
    peak: "שיא",
    success: "הצלחה",
  } : {
    title: "Productivity",
    completions30: "Completions (30d)",
    avgPerDay: "Average / day",
    scheduledEvents: "Scheduled events",
    bestStreak: "Best streak",
    lastWeek: "Last week",
    dailyCompletions: "Daily completions",
    calendarEvents: "Calendar events",
    streaksTitle: "Streaks & success rates",
    streak: "Streak",
    peak: "Peak",
    success: "Success",
  };

  // Weekly completion data (last 7 days)
  const weeklyData = useMemo(() => {
    const data: { day: string; completed: number; scheduled: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayLabel = format(date, "EEEEEE", { locale: isHebrew ? he : enUS });

      const completedCount = completions.filter((c) => c.completedDate === dateStr).length;
      const scheduledCount = events.filter(
        (e) => format(new Date(e.startTime), "yyyy-MM-dd") === dateStr
      ).length;

      data.push({ day: dayLabel, completed: completedCount, scheduled: scheduledCount });
    }
    return data;
  }, [completions, events, isHebrew]);

  // Top streaks
  const topStreaks = useMemo(() => {
    return tasks
      .map((task) => {
        const stats = getTaskStats(task, 30);
        return { title: task.title, ...stats };
      })
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 5);
  }, [tasks, getTaskStats]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalCompletions = completions.length;
    const avgPerDay = totalCompletions > 0 ? (totalCompletions / 30).toFixed(1) : "0";
    const totalScheduled = events.length;
    const bestTask = topStreaks.length > 0 ? topStreaks[0] : null;

    return {
      totalCompletions,
      avgPerDay,
      totalScheduled,
      bestStreak: bestTask?.longestStreak || 0,
      bestStreakName: bestTask?.title || "-",
    };
  }, [completions, events, topStreaks]);

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">{copy.title}</h3>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-primary">{overallStats.totalCompletions}</div>
            <div className="text-xs text-muted-foreground mt-1">{copy.completions30}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold">{overallStats.avgPerDay}</div>
            <div className="text-xs text-muted-foreground mt-1">{copy.avgPerDay}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold">{overallStats.totalScheduled}</div>
            <div className="text-xs text-muted-foreground mt-1">
              <CalendarDays className="h-3 w-3 inline ml-1" />
              {copy.scheduledEvents}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-amber-500 flex items-center justify-center gap-1">
              <Flame className="h-5 w-5" />
              {overallStats.bestStreak}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate">{copy.bestStreak}: {overallStats.bestStreakName}</div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {copy.lastWeek}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={34} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value,
                  name === "completed" ? copy.dailyCompletions : copy.calendarEvents,
                ]}
              />
              <Bar dataKey="completed" name="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="scheduled" name="scheduled" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top streaks */}
      {topStreaks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4" />
              {copy.streaksTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topStreaks.map((task) => (
                <div key={task.title} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{task.title}</div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{copy.streak}: {task.currentStreak}</span>
                      <span>{copy.peak}: {task.longestStreak}</span>
                      <span>{task.successRate}% {copy.success}</span>
                    </div>
                  </div>
                  <div className="h-2 w-20 bg-muted rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${task.successRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
