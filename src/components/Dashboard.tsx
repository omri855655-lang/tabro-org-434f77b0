import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomBoards } from '@/hooks/useCustomBoards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Tv, CheckCircle, Clock, Eye, TrendingUp, LayoutGrid, CalendarDays } from 'lucide-react';
import { getHebrewDate } from '@/lib/hebrewDate';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import TasksDashboards from '@/components/dashboard/TasksDashboards';
import ProductivityDashboard from '@/components/dashboard/ProductivityDashboard';
import CheckedItemsArchive from '@/components/CheckedItemsArchive';
import SampleDataImport from '@/components/SampleDataImport';

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

const COLORS = ['#3b82f6', '#f59e0b', '#22c55e'];

const Dashboard = () => {
  const { user } = useAuth();
  const { boards: customBoards } = useCustomBoards();
  const [customBoardStats, setCustomBoardStats] = useState<Record<string, { total: number; byStatus: Record<string, number> }>>({});
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0,
    booksToRead: 0,
    booksReading: 0,
    booksRead: 0,
    totalShows: 0,
    showsToWatch: 0,
    showsWatching: 0,
    showsWatched: 0,
  });
  const [loading, setLoading] = useState(true);

  // Fetch custom board stats
  useEffect(() => {
    if (!user) return;
    const dashboardBoards = customBoards.filter(b => b.show_in_dashboard);
    if (dashboardBoards.length === 0) { setCustomBoardStats({}); return; }
    
    Promise.all(dashboardBoards.map(async (board) => {
      const { data } = await supabase
        .from("custom_board_items")
        .select("status")
        .eq("board_id", board.id)
        .eq("user_id", user.id);
      const items = data || [];
      const byStatus: Record<string, number> = {};
      for (const s of board.statuses) byStatus[s] = 0;
      items.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
      return [board.id, { total: items.length, byStatus }] as const;
    })).then(entries => {
      setCustomBoardStats(Object.fromEntries(entries));
    });
  }, [user, customBoards]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    // Fetch books stats
    const { data: books } = await supabase.from('books').select('status');
    
    // Fetch shows stats
    const { data: shows } = await supabase.from('shows').select('status');

    if (books && shows) {
      setStats({
        totalBooks: books.length,
        booksToRead: books.filter((b) => b.status === 'לקרוא').length,
        booksReading: books.filter((b) => b.status === 'בקריאה').length,
        booksRead: books.filter((b) => b.status === 'נקרא').length,
        totalShows: shows.length,
        showsToWatch: shows.filter((s) => s.status === 'לצפות').length,
        showsWatching: shows.filter((s) => s.status === 'בצפייה').length,
        showsWatched: shows.filter((s) => s.status === 'נצפה').length,
      });
    }
    setLoading(false);
  };

  const booksChartData = [
    { name: 'לקרוא', value: stats.booksToRead, color: COLORS[0] },
    { name: 'בקריאה', value: stats.booksReading, color: COLORS[1] },
    { name: 'נקרא', value: stats.booksRead, color: COLORS[2] },
  ].filter(item => item.value > 0);

  const showsChartData = [
    { name: 'לצפות', value: stats.showsToWatch, color: COLORS[0] },
    { name: 'בצפייה', value: stats.showsWatching, color: COLORS[1] },
    { name: 'נצפה', value: stats.showsWatched, color: COLORS[2] },
  ].filter(item => item.value > 0);

  const comparisonData = [
    { name: 'ספרים', total: stats.totalBooks, completed: stats.booksRead },
    { name: 'סדרות/סרטים', total: stats.totalShows, completed: stats.showsWatched },
  ];

  const hebrewDate = getHebrewDate(new Date());
  const today = new Date();
  const gregorianDate = today.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען נתונים...</div>;
  }

  return (
    <div className="p-4 space-y-6">
      {/* Hebrew & Gregorian Date */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{hebrewDate.display}</span>
          </div>
          <p className="text-sm text-muted-foreground">{gregorianDate}</p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">דשבורד</h2>
        </div>
        {stats.totalBooks === 0 && stats.totalShows === 0 && (
          <div className="flex gap-2 flex-wrap">
            <SampleDataImport type="books" />
            <SampleDataImport type="shows" />
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              סה"כ ספרים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBooks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              ספרים שנקראו
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{stats.booksRead}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tv className="h-4 w-4" />
              סה"כ סדרות/סרטים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-accent" />
              נצפו
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{stats.showsWatched}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Dashboards */}
      <TasksDashboards />

      {/* Checked Items Archive */}
      <CheckedItemsArchive />

      {/* Productivity Dashboard */}
      <ProductivityDashboard />

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Books Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              התפלגות ספרים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {booksChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={booksChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {booksChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                אין ספרים עדיין
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shows Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5" />
              התפלגות סדרות/סרטים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={showsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {showsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                אין סדרות או סרטים עדיין
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>השוואה כללית</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="סה״כ" fill="#3b82f6" />
              <Bar dataKey="completed" name="הושלמו" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Progress Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">התקדמות קריאה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>בקריאה</span>
                <span className="font-medium">{stats.booksReading}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{
                    width: stats.totalBooks > 0 ? `${(stats.booksReading / stats.totalBooks) * 100}%` : '0%',
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>ממתינים לקריאה</span>
                <span className="font-medium">{stats.booksToRead}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: stats.totalBooks > 0 ? `${(stats.booksToRead / stats.totalBooks) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">התקדמות צפייה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>בצפייה</span>
                <span className="font-medium">{stats.showsWatching}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{
                    width: stats.totalShows > 0 ? `${(stats.showsWatching / stats.totalShows) * 100}%` : '0%',
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>ממתינים לצפייה</span>
                <span className="font-medium">{stats.showsToWatch}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: stats.totalShows > 0 ? `${(stats.showsToWatch / stats.totalShows) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Board Stats */}
      {customBoards.filter(b => b.show_in_dashboard).map((board) => {
        const stats = customBoardStats[board.id];
        if (!stats) return null;
        return (
          <Card key={board.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                {board.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">סה"כ</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <div className="text-sm text-muted-foreground">{status}</div>
                    <div className="text-lg font-semibold">{count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default Dashboard;
