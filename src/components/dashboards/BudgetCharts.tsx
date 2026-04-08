import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

interface Payment {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  payment_type: string;
  created_at: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--foreground) / 0.82)",
  "hsl(var(--primary) / 0.75)",
  "hsl(var(--accent) / 0.75)",
  "hsl(var(--muted-foreground))",
  "hsl(var(--primary) / 0.55)",
  "hsl(var(--accent) / 0.55)",
  "hsl(var(--foreground) / 0.6)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--accent) / 0.4)",
  "hsl(var(--foreground) / 0.4)",
];

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

interface BudgetChartsProps {
  payments: Payment[];
}

const BudgetCharts = ({ payments }: BudgetChartsProps) => {
  // Category pie chart data
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    payments.filter(p => p.payment_type === "expense").forEach(p => {
      const cat = p.category || "אחר";
      cats[cat] = (cats[cat] || 0) + p.amount;
    });
    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [payments]);

  // Monthly comparison bar data
  const monthlyBarData = useMemo(() => {
    const months: Record<string, { income: number; expenses: number }> = {};
    payments.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { income: 0, expenses: 0 };
      if (p.payment_type === "income") months[key].income += p.amount;
      else months[key].expenses += p.amount;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([key, data]) => {
        const [y, m] = key.split("-");
        return {
          name: `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`,
          הכנסות: data.income,
          הוצאות: data.expenses,
          מאזן: data.income - data.expenses,
        };
      });
  }, [payments]);

  // Trend line data (cumulative balance)
  const trendData = useMemo(() => {
    const months: Record<string, number> = {};
    payments.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = 0;
      months[key] += p.payment_type === "income" ? p.amount : -p.amount;
    });
    let cumulative = 0;
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, balance]) => {
        cumulative += balance;
        const [y, m] = key.split("-");
        return {
          name: `${MONTH_NAMES[parseInt(m) - 1]}`,
          מאזן_חודשי: balance,
          מאזן_מצטבר: cumulative,
        };
      });
  }, [payments]);

  if (payments.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-lg shadow-lg p-2 text-xs" dir="rtl">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: ₪{entry.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Category Pie Chart */}
      {categoryData.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 text-center">פילוח הוצאות לפי קטגוריה</h3>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center">
                {categoryData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span>{entry.name}</span>
                    <span className="text-muted-foreground">₪{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Comparison Bar Chart */}
      {monthlyBarData.length > 1 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 text-center">השוואה חודשית</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyBarData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="הכנסות" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="הוצאות" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trend Line Chart */}
      {trendData.length > 1 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 text-center">מגמת מאזן</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="מאזן_חודשי" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="מאזן_מצטבר" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BudgetCharts;
