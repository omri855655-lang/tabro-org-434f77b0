import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomBoards } from '@/hooks/useCustomBoards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Tv, CheckCircle, Clock, Eye, TrendingUp, LayoutGrid, CalendarDays, Settings2, ChevronUp, ChevronDown, EyeOff, RotateCcw, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon } from 'lucide-react';
import { getHebrewDate } from '@/lib/hebrewDate';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useSiteAppearance } from '@/hooks/useSiteAppearance';
import TasksDashboards from '@/components/dashboard/TasksDashboards';
import ProductivityDashboard from '@/components/dashboard/ProductivityDashboard';
import CheckedItemsArchive from '@/components/CheckedItemsArchive';
import SampleDataImport from '@/components/SampleDataImport';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';

interface Stats {
  totalBooks: number;
  booksToRead: number;
  booksReading: number;
  booksRead: number;
  totalShows: number;
  showsToWatch: number;
  showsWatching: number;
  showsWatched: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))'];

type ChartType = "pie" | "bar" | "line";

const getChartType = (key: string): ChartType => {
  return (localStorage.getItem(`chart_type_${key}`) as ChartType) || "pie";
};
const setChartType = (key: string, type: ChartType) => {
  localStorage.setItem(`chart_type_${key}`, type);
};

const ChartToggle = ({ widgetKey, value, onChange }: { widgetKey: string; value: ChartType; onChange: (v: ChartType) => void }) => (
  <div className="flex gap-1">
    <Button variant={value === "bar" ? "default" : "ghost"} size="icon" className="h-6 w-6" onClick={() => onChange("bar")}><BarChart3 className="h-3 w-3" /></Button>
    <Button variant={value === "line" ? "default" : "ghost"} size="icon" className="h-6 w-6" onClick={() => onChange("line")}><LineChartIcon className="h-3 w-3" /></Button>
    <Button variant={value === "pie" ? "default" : "ghost"} size="icon" className="h-6 w-6" onClick={() => onChange("pie")}><PieChartIcon className="h-3 w-3" /></Button>
  </div>
);

const RenderChart = ({ data, chartType, height }: { data: { name: string; value: number; color: string }[]; chartType: ChartType; height: number }) => {
  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <XAxis dataKey="name" /><YAxis /><Tooltip />
          <Bar dataKey="value" fill="hsl(var(--primary))">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <XAxis dataKey="name" /><YAxis /><Tooltip />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={height > 150 ? 40 : 20} outerRadius={height > 150 ? 80 : 50} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const isHe = dir === "rtl";
  const { boards: customBoards } = useCustomBoards();
  const [customBoardStats, setCustomBoardStats] = useState<Record<string, { total: number; byStatus: Record<string, number> }>>({});
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0, booksToRead: 0, booksReading: 0, booksRead: 0,
    totalShows: 0, showsToWatch: 0, showsWatching: 0, showsWatched: 0,
  });
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { sections, toggleVisibility, setViewMode, moveSection, resetToDefault } = useDashboardConfig();

  // Chart type state
  const [booksChartType, setBooksChartType] = useState<ChartType>(() => getChartType("booksChart"));
  const [showsChartType, setShowsChartType] = useState<ChartType>(() => getChartType("showsChart"));
  const [compChartType, setCompChartType] = useState<ChartType>(() => getChartType("comparison"));

  useEffect(() => {
    if (!user) return;
    const dashboardBoards = customBoards.filter(b => b.show_in_dashboard);
    if (dashboardBoards.length === 0) { setCustomBoardStats({}); return; }
    Promise.all(dashboardBoards.map(async (board) => {
      const { data } = await supabase.from("custom_board_items").select("status").eq("board_id", board.id).eq("user_id", user.id);
      const items = data || [];
      const byStatus: Record<string, number> = {};
      for (const s of board.statuses) byStatus[s] = 0;
      items.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
      return [board.id, { total: items.length, byStatus }] as const;
    })).then(entries => setCustomBoardStats(Object.fromEntries(entries)));
  }, [user, customBoards]);

  useEffect(() => { if (user) fetchStats(); }, [user]);

  const fetchStats = async () => {
    const { data: books } = await supabase.from('books').select('status');
    const { data: shows } = await supabase.from('shows').select('status');
    if (books && shows) {
      setStats({
        totalBooks: books.length,
        booksToRead: books.filter(b => b.status === 'לקרוא').length,
        booksReading: books.filter(b => b.status === 'בקריאה').length,
        booksRead: books.filter(b => b.status === 'נקרא').length,
        totalShows: shows.length,
        showsToWatch: shows.filter(s => s.status === 'לצפות').length,
        showsWatching: shows.filter(s => s.status === 'בצפייה').length,
        showsWatched: shows.filter(s => s.status === 'נצפה').length,
      });
    }
    setLoading(false);
  };

  const booksChartData = [
    { name: t("toRead" as any), value: stats.booksToRead, color: COLORS[0] },
    { name: t("reading" as any), value: stats.booksReading, color: COLORS[1] },
    { name: t("read" as any), value: stats.booksRead, color: COLORS[2] },
  ].filter(item => item.value > 0);

  const showsChartData = [
    { name: t("toWatch" as any), value: stats.showsToWatch, color: COLORS[0] },
    { name: t("watching" as any), value: stats.showsWatching, color: COLORS[1] },
    { name: t("watched" as any), value: stats.showsWatched, color: COLORS[2] },
  ].filter(item => item.value > 0);

  const comparisonData = [
    { name: t("books" as any), total: stats.totalBooks, completed: stats.booksRead },
    { name: t("seriesFilms" as any), total: stats.totalShows, completed: stats.showsWatched },
  ];

  const { showHebrewDate } = useSiteAppearance();
  const hebrewDate = getHebrewDate(new Date());
  const today = new Date();
  const gregorianDate = today.toLocaleDateString(isHe ? "he-IL" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = today.toLocaleTimeString(isHe ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" });

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("loading" as any)}</div>;

  const isVisible = (id: string) => sections.find(s => s.id === id)?.visible ?? true;
  const getViewMode = (id: string) => sections.find(s => s.id === id)?.viewMode ?? "default";

  const renderSection = (sectionId: string) => {
    if (!isVisible(sectionId)) return null;
    const vm = getViewMode(sectionId);

    switch (sectionId) {
      case "date":
        return (
          <Card key="date" className="card-surface bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className={cn("text-center", vm === "compact" ? "py-2" : "py-4")}>
              {showHebrewDate && (
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <span className={cn("font-bold text-foreground", vm === "compact" ? "text-base" : "text-lg")}>{hebrewDate.display}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">{gregorianDate}</p>
              <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>
            </CardContent>
          </Card>
        );

      case "quickStats":
        if (vm === "compact") {
          return (
            <div key="quickStats" className="flex gap-4 flex-wrap">
              <span className="text-sm"><BookOpen className="h-4 w-4 inline mr-1" />{stats.totalBooks} {t("books" as any)} ({stats.booksRead} {t("read" as any)})</span>
              <span className="text-sm"><Tv className="h-4 w-4 inline mr-1" />{stats.totalShows} {t("shows" as any)} ({stats.showsWatched} {t("watched" as any)})</span>
            </div>
          );
        }
        if (vm === "cards") {
          return (
            <div key="quickStats" className="grid grid-cols-2 gap-3">
              <Card className="card-surface border-l-[3px] border-l-brand-primary p-3 text-center">
                <BookOpen className="h-5 w-5 mx-auto text-primary mb-1" />
                <div className="text-xl font-bold">{stats.totalBooks}</div>
                <div className="text-xs text-muted-foreground">{t("books" as any)}</div>
              </Card>
              <Card className="card-surface border-l-[3px] border-l-brand-accent p-3 text-center">
                <CheckCircle className="h-5 w-5 mx-auto text-accent-foreground mb-1" />
                <div className="text-xl font-bold text-accent-foreground">{stats.booksRead}</div>
                <div className="text-xs text-muted-foreground">{t("read" as any)}</div>
              </Card>
              <Card className="card-surface border-l-[3px] border-l-brand-primary p-3 text-center">
                <Tv className="h-5 w-5 mx-auto text-primary mb-1" />
                <div className="text-xl font-bold">{stats.totalShows}</div>
                <div className="text-xs text-muted-foreground">{t("seriesFilms" as any)}</div>
              </Card>
              <Card className="card-surface border-l-[3px] border-l-brand-accent p-3 text-center">
                <Eye className="h-5 w-5 mx-auto text-accent-foreground mb-1" />
                <div className="text-xl font-bold text-accent-foreground">{stats.showsWatched}</div>
                <div className="text-xs text-muted-foreground">{t("watched" as any)}</div>
              </Card>
            </div>
          );
        }
        return (
          <div key="quickStats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="card-surface border-l-[3px] border-l-brand-primary"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" />{t("totalBooks" as any)}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalBooks}</div></CardContent></Card>
            <Card className="card-surface border-l-[3px] border-l-brand-accent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent-foreground" />{t("booksRead" as any)}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-accent-foreground">{stats.booksRead}</div></CardContent></Card>
            <Card className="card-surface border-l-[3px] border-l-brand-primary"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Tv className="h-4 w-4" />{t("totalSeriesFilms" as any)}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalShows}</div></CardContent></Card>
            <Card className="card-surface border-l-[3px] border-l-brand-accent"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Eye className="h-4 w-4 text-accent-foreground" />{t("watchedCount" as any)}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-accent-foreground">{stats.showsWatched}</div></CardContent></Card>
          </div>
        );

      case "tasks":
        return <TasksDashboards key="tasks" />;

      case "checkedItems":
        return <CheckedItemsArchive key="checkedItems" />;

      case "productivity":
        return <ProductivityDashboard key="productivity" />;

      case "booksChart":
        return (
          <Card key="booksChart" className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />{t("booksDistribution" as any)}</CardTitle>
                <ChartToggle widgetKey="booksChart" value={booksChartType} onChange={(v) => { setBooksChartType(v); setChartType("booksChart", v); }} />
              </div>
            </CardHeader>
            <CardContent>
              {booksChartData.length > 0 ? (
                <RenderChart data={booksChartData} chartType={booksChartType} height={vm === "compact" ? 120 : 200} />
              ) : <div className="h-[120px] flex items-center justify-center text-muted-foreground">{t("noBooksYet" as any)}</div>}
            </CardContent>
          </Card>
        );

      case "showsChart":
        return (
          <Card key="showsChart" className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Tv className="h-5 w-5" />{t("showsDistribution" as any)}</CardTitle>
                <ChartToggle widgetKey="showsChart" value={showsChartType} onChange={(v) => { setShowsChartType(v); setChartType("showsChart", v); }} />
              </div>
            </CardHeader>
            <CardContent>
              {showsChartData.length > 0 ? (
                <RenderChart data={showsChartData} chartType={showsChartType} height={vm === "compact" ? 120 : 200} />
              ) : <div className="h-[120px] flex items-center justify-center text-muted-foreground">{t("noSeriesYet" as any)}</div>}
            </CardContent>
          </Card>
        );

      case "comparison":
        return (
          <Card key="comparison" className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("generalComparison" as any)}</CardTitle>
                <ChartToggle widgetKey="comparison" value={compChartType} onChange={(v) => { setCompChartType(v); setChartType("comparison", v); }} />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={vm === "compact" ? 120 : 200}>
                <BarChart data={comparisonData} layout="vertical">
                  <XAxis type="number" /><YAxis dataKey="name" type="category" width={100} />
                  <Tooltip /><Legend />
                  <Bar dataKey="total" name={t("total" as any)} fill="hsl(var(--primary))" />
                  <Bar dataKey="completed" name={t("completedLabel" as any)} fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );

      case "progress":
        return (
          <div key="progress" className="grid md:grid-cols-2 gap-4">
            <Card className="card-surface">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("readingProgress" as any)}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>{t("reading" as any)}</span><span className="font-medium">{stats.booksReading}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: stats.totalBooks > 0 ? `${(stats.booksReading / stats.totalBooks) * 100}%` : '0%' }} /></div>
                  <div className="flex justify-between text-sm"><span>{t("pending" as any)}</span><span className="font-medium">{stats.booksToRead}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: stats.totalBooks > 0 ? `${(stats.booksToRead / stats.totalBooks) * 100}%` : '0%' }} /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("watchProgress" as any)}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>{t("watching" as any)}</span><span className="font-medium">{stats.showsWatching}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: stats.totalShows > 0 ? `${(stats.showsWatching / stats.totalShows) * 100}%` : '0%' }} /></div>
                  <div className="flex justify-between text-sm"><span>{t("pending" as any)}</span><span className="font-medium">{stats.showsToWatch}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: stats.totalShows > 0 ? `${(stats.showsToWatch / stats.totalShows) * 100}%` : '0%' }} /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "customBoards":
        return (
          <div key="customBoards">
            {customBoards.filter(b => b.show_in_dashboard).map(board => {
              const bs = customBoardStats[board.id];
              if (!bs) return null;
              return (
                <Card key={board.id} className="card-surface mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" />{board.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><div className="text-sm text-muted-foreground">{t("total" as any)}</div><div className="text-2xl font-bold">{bs.total}</div></div>
                      {Object.entries(bs.byStatus).map(([status, count]) => (
                        <div key={status}><div className="text-sm text-muted-foreground">{status}</div><div className="text-lg font-semibold">{count}</div></div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">{t("dashboard" as any)}</h2>
        </div>
        <div className="flex gap-2">
          {stats.totalBooks === 0 && stats.totalShows === 0 && (
            <div className="flex gap-2 flex-wrap">
              <SampleDataImport type="books" />
              <SampleDataImport type="shows" />
            </div>
          )}
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setSettingsOpen(!settingsOpen)}>
            <Settings2 className="h-3.5 w-3.5" />
            {t("customizeDashboard" as any)}
          </Button>
        </div>
      </div>

      {/* Dashboard Customization Panel */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleContent>
          <Card className="mb-4 card-surface border-l-[3px] border-l-brand-primary">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{t("customizeDashboard" as any)}</span>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={resetToDefault}>
                  <RotateCcw className="h-3 w-3" />
                  {t("reset" as any)}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {sections.map((section, idx) => (
                <div key={section.id} className={cn(
                  "flex items-center gap-2 p-2 rounded-md text-sm",
                  section.visible ? "bg-card" : "bg-muted/30 opacity-60"
                )}>
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveSection(section.id, "up")}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === sections.length - 1} onClick={() => moveSection(section.id, "down")}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleVisibility(section.id)}
                  >
                    {section.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <span className="flex-1 font-medium">{section.label}</span>
                  <Select
                    value={section.viewMode}
                    onValueChange={(v) => setViewMode(section.id, v as any)}
                  >
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("normal" as any)}</SelectItem>
                      <SelectItem value="compact">{t("compact" as any)}</SelectItem>
                      <SelectItem value="cards">{t("cardsView" as any)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Render sections in order */}
      {sections.map(section => renderSection(section.id))}
    </div>
  );
};

export default Dashboard;
