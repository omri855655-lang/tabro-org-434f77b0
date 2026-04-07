import { useState, useEffect, useCallback, useMemo } from "react";
import BankConnect from "@/components/dashboards/BankConnect";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AutocompleteInput from "@/components/AutocompleteInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CreditCard, TrendingUp, TrendingDown, DollarSign, Check, Calendar, Sparkles, MessageCircle, ChevronDown, ChevronUp, BookOpen, PiggyBank, AlertTriangle, Lightbulb, Wallet, BarChart3, Download, History } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import SampleDataImport from "@/components/SampleDataImport";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AiChatPanel from "@/components/AiChatPanel";
import BudgetCharts from "@/components/dashboards/BudgetCharts";
import DashboardDisplayToolbar from "@/components/DashboardDisplayToolbar";
import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";
import FinancialCsvImport from "@/components/FinancialCsvImport";
import ManualTransactionForm from "@/components/ManualTransactionForm";

interface Payment {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  payment_type: string;
  payment_method: string | null;
  due_date: string | null;
  paid: boolean;
  recurring: boolean;
  recurring_frequency: string | null;
  notes: string | null;
  sheet_name: string;
  archived: boolean;
  created_at: string;
}

const CATEGORY_KEYS = [
  "catSalary", "catFreelance", "catHousing", "catRent", "catMortgage", "catGroceries", "catFood", "catFuel", "catTransport", "catElectricity", "catWater", "catGas", "catInternet", "catPhone", "catInsurance", "catBills", "catShopping", "catEntertainment", "catEducation", "catHealth", "catSavings", "catInvestments", "catOther"
] as const;

const CATEGORY_IDS = [
  "משכורת", "פרילנס", "דיור", "שכירות", "משכנתא", "סופר", "אוכל", "דלק", "תחבורה", "חשמל", "מים", "גז", "אינטרנט", "טלפון", "ביטוחים", "חשבונות", "קניות", "בילויים", "חינוך", "בריאות", "חיסכון", "השקעות", "אחר"
];

const GUIDE_DEFS = [
  {
    id: "saving", icon: PiggyBank, titleKey: "guideSaving", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/20",
    sections: [
      { titleKey: "guide503020Rule", contentKey: "guide503020Text" },
      { titleKey: "guidePayYourselfFirst", contentKey: "guidePayYourselfFirstText" },
      { titleKey: "guide24HourRule", contentKey: "guide24HourRuleText" },
      { titleKey: "guide52WeekChallenge", contentKey: "guide52WeekChallengeText" },
    ]
  },
  {
    id: "invest", icon: TrendingUp, titleKey: "guideInvest", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/20",
    sections: [
      { titleKey: "guideEmergencyFund", contentKey: "guideEmergencyFundText" },
      { titleKey: "guideCompoundInterest", contentKey: "guideCompoundInterestText" },
      { titleKey: "guideETF", contentKey: "guideETFText" },
    ]
  },
  {
    id: "impulse", icon: AlertTriangle, titleKey: "guideImpulse", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/20",
    sections: [
      { titleKey: "guideIdentifyTriggers", contentKey: "guideIdentifyTriggersText" },
      { titleKey: "guideWorkHours", contentKey: "guideWorkHoursText" },
      { titleKey: "guideDeleteApps", contentKey: "guideDeleteAppsText" },
    ]
  },
  {
    id: "tips", icon: Lightbulb, titleKey: "guideTips", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/20",
    sections: [
      { titleKey: "guideAutomation", contentKey: "guideAutomationText" },
      { titleKey: "guideAvalanche", contentKey: "guideAvalancheText" },
      { titleKey: "guideDisclaimer", contentKey: "guideDisclaimerText" },
    ]
  },
];

const PaymentDashboard = () => {
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("payments");
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isRtl = lang === "he" || lang === "ar";
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newType, setNewType] = useState("expense");
  const [newMethod, setNewMethod] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [aiChat, setAiChat] = useState("");
  const aiChatHistory = useDashboardChatHistory("payments");
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState("");
  const [budgetTarget, setBudgetTarget] = useState<number>(0);
  const [budgetPeriod, setBudgetPeriod] = useState("monthly");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  // Fetch budget target
  useEffect(() => {
    if (!user) return;
    supabase.from("budget_targets").select("*").eq("user_id", user.id).eq("period", budgetPeriod).is("category", null).maybeSingle().then(({ data }) => {
      if (data) { setBudgetTarget(data.amount); setBudgetInput(String(data.amount)); }
      else { setBudgetTarget(0); setBudgetInput(""); }
    });
  }, [user, budgetPeriod]);

  const saveBudgetTarget = async () => {
    if (!user) return;
    const amount = parseFloat(budgetInput);
    if (isNaN(amount) || amount <= 0) return;
    const { error } = await supabase.from("budget_targets").upsert({ user_id: user.id, period: budgetPeriod, amount, category: null }, { onConflict: "user_id,period,category" });
    if (!error) { setBudgetTarget(amount); setEditingBudget(false); toast.success(t("budgetSaved" as any)); }
  };

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payment_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    setPayments((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const addPayment = async () => {
    if (!user || !newTitle.trim() || !newAmount) return;
    const { error } = await supabase.from("payment_tracking").insert({
      user_id: user.id,
      title: newTitle.trim(),
      amount: parseFloat(newAmount),
      category: newCategory || null,
      payment_type: newType,
      payment_method: newMethod.trim() || null,
      due_date: newDueDate || null,
      recurring: newRecurring,
    });
    if (error) { toast.error(t("error" as any)); return; }
    setNewTitle(""); setNewAmount(""); setNewCategory(""); setNewMethod(""); setNewDueDate("");
    toast.success(newType === "income" ? t("incomeAdded" as any) : t("expenseAdded" as any));
    fetchPayments();
  };

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from("payment_tracking").update({ paid: !paid }).eq("id", id);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, paid: !paid } : p));
  };

  const deletePayment = async (id: string) => {
    await supabase.from("payment_tracking").delete().eq("id", id);
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  // Financial calculations
  const totalExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense").reduce((s, p) => s + p.amount, 0), [payments]);
  const totalIncome = useMemo(() => payments.filter(p => p.payment_type === "income").reduce((s, p) => s + p.amount, 0), [payments]);
  const balance = totalIncome - totalExpenses;
  const unpaidExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense" && !p.paid).reduce((s, p) => s + p.amount, 0), [payments]);
  const fixedExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense" && p.recurring).reduce((s, p) => s + p.amount, 0), [payments]);
  const variableExpenses = totalExpenses - fixedExpenses;
  
  const overdue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return payments.filter(p => !p.paid && p.due_date && p.due_date < today);
  }, [payments]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    payments.filter(p => p.payment_type === "expense").forEach(p => {
      const cat = p.category || "אחר";
      cats[cat] = (cats[cat] || 0) + p.amount;
    });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, [payments]);

  // 50/30/20 rule calculation
  const needsPercent = totalIncome > 0 ? Math.round((fixedExpenses / totalIncome) * 100) : 0;
  const wantsPercent = totalIncome > 0 ? Math.round((variableExpenses / totalIncome) * 100) : 0;
  const savingsPercent = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;

  // Monthly history breakdown
  const monthlyHistory = useMemo(() => {
    const months: Record<string, { income: number; expenses: number; items: Payment[] }> = {};
    payments.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { income: 0, expenses: 0, items: [] };
      months[key].items.push(p);
      if (p.payment_type === "income") months[key].income += p.amount;
      else months[key].expenses += p.amount;
    });
    return Object.entries(months).sort(([a], [b]) => b.localeCompare(a));
  }, [payments]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const monthKeys = ["january","february","march","april","may","june","july","august","september","october","november","december"] as const;
    return `${t(monthKeys[parseInt(m) - 1] as any)} ${y}`;
  };

  const sendAiMessage = async (chatInput: string) => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    aiChatHistory.setMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const catBreakdown = categoryBreakdown.map(([cat, amt]) => `${cat}: ₪${amt.toLocaleString()}`).join(", ");
      const context = `
הכנסות חודשיות: ₪${totalIncome.toLocaleString()}
הוצאות חודשיות: ₪${totalExpenses.toLocaleString()}
מאזן (נותר): ₪${balance.toLocaleString()}
הוצאות קבועות: ₪${fixedExpenses.toLocaleString()}
הוצאות משתנות: ₪${variableExpenses.toLocaleString()}
לא שולמו: ₪${unpaidExpenses.toLocaleString()}
באיחור: ${overdue.length} תשלומים
פילוח קטגוריות: ${catBreakdown}
כלל 50/30/20 - צרכים: ${needsPercent}%, רצונות: ${wantsPercent}%, חיסכון: ${savingsPercent}%`;

      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: chatInput,
          conversationHistory: [...aiChatHistory.messages, userMsg].slice(-20),
          customPrompt: `אתה יועץ פיננסי חכם ומקצועי. הנה המצב הפיננסי המפורט של המשתמש:
${context}

בסיס הידע שלך כולל: The Psychology of Money (מורגן האוסל), Rich Dad Poor Dad (קיוסאקי), I Will Teach You to Be Rich (רמית סתי), The Almanack of Naval Ravikant.

חובה עליך:
1. לנתח את המצב הפיננסי ולהגיד מה טוב ומה לא טוב
2. לתת עצות ספציפיות מבוססות על הנתונים
3. להציע שיפורים ליעד החיסכון
4. לציין הוצאות חריגות אם יש
5. להשוות לכלל 50/30/20

השתמש באימוג'ים. דבר בעברית. ציין שזו המלצה בלבד ולא ייעוץ מקצועי.

המשתמש שואל: ${chatInput}`,
        },
      });
      if (error) throw error;
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || "אין תשובה" }]);
    } catch {
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: "שגיאה בקבלת תשובה" }]);
    }
    setAiLoading(false);
  };

  const getMonthlyInsight = () => {
    sendAiMessage("תן לי סיכום חודשי מפורט: מה הייתי צריך לשפר, מה עשיתי טוב, ומה הצעדים הבאים שלי. תתייחס להוצאות הגדולות ביותר ותציע איך לחסוך.");
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">{t("loading" as any)}</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Wallet className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">{t("incomeAndExpenses" as any)}</h2>
        <div className="flex-1" />
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          payments.map(p => ({ title: p.title, amount: p.amount, type: p.payment_type === 'income' ? t("incomeType" as any) : t("expenseType" as any), category: p.category || '', paid: p.paid, due_date: p.due_date || '', recurring: p.recurring, method: p.payment_method || '' })),
          [{ key: 'title', label: t("descriptionCol" as any) }, { key: 'amount', label: t("amountCol" as any) }, { key: 'type', label: t("typeCol" as any) }, { key: 'category', label: t("categoryCol" as any) }, { key: 'paid', label: t("paidCol" as any) }, { key: 'due_date', label: t("dateCol" as any) }, { key: 'recurring', label: t("recurringCol" as any) }, { key: 'method', label: t("methodCol" as any) }],
          t("paymentsSheet" as any)
        )}>
          <Download className="h-3.5 w-3.5" />{t("exportLabel" as any)}
        </Button>
      </div>

      {/* Hero balance card */}
      <Card className={`${balance >= 0 ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200" : "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200"}`}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">{t("totalRemaining" as any)}</p>
          <p className={`text-4xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
            ₪{Math.abs(balance).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{balance >= 0 ? t("excellentSurplus" as any) : t("warningOverspend" as any)}</p>
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t("income" as any)}</p>
              <p className="font-semibold text-green-600">₪{totalIncome.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <TrendingDown className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t("expenses" as any)}</p>
              <p className="font-semibold text-red-600">₪{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <Calendar className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t("overdue" as any)}</p>
              <p className="font-semibold text-amber-600">{overdue.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Target */}
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><PiggyBank className="h-4 w-4 text-primary" />{t("budgetTarget" as any)}</h3>
            <div className="flex gap-1">
              {(["weekly", "monthly", "quarterly", "yearly"] as const).map(p => (
                <button key={p} onClick={() => setBudgetPeriod(p)} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${budgetPeriod === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {p === "weekly" ? t("weeklyPeriod" as any) : p === "monthly" ? t("monthlyPeriod" as any) : p === "quarterly" ? t("quarterlyPeriod" as any) : t("yearlyPeriod" as any)}
                </button>
              ))}
            </div>
          </div>
          {editingBudget ? (
            <div className="flex gap-2">
              <Input placeholder={t("amount" as any)} type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} dir="ltr" className="flex-1" />
              <Button size="sm" onClick={saveBudgetTarget}>{t("saveBudget" as any)}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingBudget(false)}>{t("cancelBudget" as any)}</Button>
            </div>
          ) : budgetTarget > 0 ? (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{t("expensesLabel" as any)}: ₪{totalExpenses.toLocaleString()}</span>
                <span>{t("targetLabel" as any)}: ₪{budgetTarget.toLocaleString()}</span>
              </div>
              <Progress value={Math.min((totalExpenses / budgetTarget) * 100, 100)} className={`h-3 ${totalExpenses > budgetTarget ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
              <div className="flex justify-between mt-2">
                <span className={`text-sm font-semibold ${totalExpenses > budgetTarget ? "text-red-600" : "text-green-600"}`}>
                  {totalExpenses > budgetTarget ? `${t("budgetExceeded" as any)} ₪${(totalExpenses - budgetTarget).toLocaleString()} ⚠️` : `${t("budgetRemaining" as any)} ₪${(budgetTarget - totalExpenses).toLocaleString()} ✅`}
                </span>
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => { setEditingBudget(true); setBudgetInput(String(budgetTarget)); }}>{t("editing" as any)}</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setEditingBudget(true)}>
              <Plus className="h-3 w-3" />{t("setBudgetTarget" as any)} {budgetPeriod === "weekly" ? t("weeklyPeriod" as any) : budgetPeriod === "monthly" ? t("monthlyPeriod" as any) : budgetPeriod === "quarterly" ? t("quarterlyPeriod" as any) : t("yearlyPeriod" as any)}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 50/30/20 Rule visual */}
      {totalIncome > 0 && (
         <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 text-center">{t("rule503020" as any)}</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="relative mx-auto w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className={`${needsPercent <= 50 ? "text-green-500" : "text-red-500"}`} strokeWidth="3" strokeDasharray={`${Math.min(needsPercent, 100) * 0.94} 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{needsPercent}%</span>
                </div>
                <p className="text-xs font-medium mt-1">{t("needs" as any)}</p>
                <p className="text-[10px] text-muted-foreground">{t("targetPercent" as any)}: 50%</p>
              </div>
              <div>
                <div className="relative mx-auto w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className={`${wantsPercent <= 30 ? "text-blue-500" : "text-amber-500"}`} strokeWidth="3" strokeDasharray={`${Math.min(wantsPercent, 100) * 0.94} 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{wantsPercent}%</span>
                </div>
                <p className="text-xs font-medium mt-1">{t("wants" as any)}</p>
                <p className="text-[10px] text-muted-foreground">{t("targetPercent" as any)}: 30%</p>
              </div>
              <div>
                <div className="relative mx-auto w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className={`${savingsPercent >= 20 ? "text-green-500" : "text-red-500"}`} strokeWidth="3" strokeDasharray={`${Math.min(Math.max(savingsPercent, 0), 100) * 0.94} 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{savingsPercent}%</span>
                </div>
                <p className="text-xs font-medium mt-1">{t("savings" as any)}</p>
                <p className="text-[10px] text-muted-foreground">{t("targetPercent" as any)}: 20%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" />פילוח הוצאות</h3>
            <div className="space-y-2">
              {categoryBreakdown.map(([cat, amt]) => {
                const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{cat}</span>
                      <span className="font-medium">₪{amt.toLocaleString()} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts - Pie, Bar comparison, Trend */}
      <BudgetCharts payments={payments as any} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="overview" className="flex-1">הכנסות והוצאות</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1"><History className="h-3 w-3" />היסטוריה</TabsTrigger>
          <TabsTrigger value="add" className="flex-1 gap-1"><Plus className="h-3 w-3" />הוסף</TabsTrigger>
          <TabsTrigger value="guides" className="flex-1 gap-1"><BookOpen className="h-3 w-3" />מדריכים</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3 w-3" />יועץ AI</TabsTrigger>
          <TabsTrigger value="credit-cards" className="flex-1 gap-1"><CreditCard className="h-3 w-3" />בנק ואשראי</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          {monthlyHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין עדיין נתונים. הוסף הכנסות והוצאות כדי לראות היסטוריה חודשית.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {monthlyHistory.map(([key, data]) => {
                  const balance = data.income - data.expenses;
                  const isCurrent = key === currentMonthKey;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedHistoryMonth(selectedHistoryMonth === key ? "" : key)}
                      className={`p-3 rounded-lg border text-right transition-all ${
                        selectedHistoryMonth === key ? "border-primary bg-primary/10" :
                        isCurrent ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">
                        {formatMonthLabel(key)}
                        {isCurrent && <Badge variant="outline" className="mr-1 text-[9px] px-1">נוכחי</Badge>}
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-green-600">+₪{data.income.toLocaleString()}</span>
                        <span className="text-red-600">-₪{data.expenses.toLocaleString()}</span>
                      </div>
                      <div className={`text-xs font-bold mt-1 ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {balance >= 0 ? "+" : ""}₪{balance.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedHistoryMonth && (() => {
                const monthData = monthlyHistory.find(([k]) => k === selectedHistoryMonth);
                if (!monthData) return null;
                const [, data] = monthData;
                const monthCats: Record<string, number> = {};
                data.items.filter(p => p.payment_type === "expense").forEach(p => {
                  const cat = p.category || "אחר";
                  monthCats[cat] = (monthCats[cat] || 0) + p.amount;
                });
                const sortedCats = Object.entries(monthCats).sort(([, a], [, b]) => b - a);

                return (
                  <Card>
                    <CardContent className="py-4 space-y-4">
                      <h3 className="text-sm font-semibold">{formatMonthLabel(selectedHistoryMonth)} — פירוט</h3>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">הכנסות</p>
                          <p className="font-bold text-green-600">₪{data.income.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">הוצאות</p>
                          <p className="font-bold text-red-600">₪{data.expenses.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">מאזן</p>
                          <p className={`font-bold ${data.income - data.expenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₪{(data.income - data.expenses).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {sortedCats.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground">פילוח הוצאות</h4>
                          {sortedCats.map(([cat, amt]) => {
                            const pct = data.expenses > 0 ? Math.round((amt / data.expenses) * 100) : 0;
                            return (
                              <div key={cat}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{cat}</span>
                                  <span className="font-medium">₪{amt.toLocaleString()} ({pct}%)</span>
                                </div>
                                <Progress value={pct} className="h-2" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        <h4 className="text-xs font-semibold text-muted-foreground">כל הפריטים</h4>
                        {data.items.map(p => (
                          <div key={p.id} className="flex items-center justify-between py-1 text-sm border-b border-border/50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span>{p.title}</span>
                              {p.category && <Badge variant="outline" className="text-[9px]">{p.category}</Badge>}
                            </div>
                            <span className={`font-medium ${p.payment_type === "income" ? "text-green-600" : "text-red-600"}`}>
                              {p.payment_type === "income" ? "+" : "-"}₪{p.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-2">
          {/* Fixed expenses */}
          {payments.filter(p => p.recurring && p.payment_type === "expense").length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">הוצאות קבועות</h3>
              {payments.filter(p => p.recurring && p.payment_type === "expense").map(p => (
                <Card key={p.id} className="border-muted">
                  <CardContent className="py-2 px-3 flex items-center gap-3">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                      {p.paid ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                        {p.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(p.due_date), "dd/MM/yy")}</span>}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-red-600 whitespace-nowrap">-₪{p.amount.toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deletePayment(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Variable expenses */}
          {payments.filter(p => !p.recurring && p.payment_type === "expense").length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground mt-3">הוצאות משתנות</h3>
              {payments.filter(p => !p.recurring && p.payment_type === "expense").map(p => (
                <Card key={p.id}>
                  <CardContent className="py-2 px-3 flex items-center gap-3">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                      {p.paid ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                        {p.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(p.due_date), "dd/MM/yy")}</span>}
                        {p.payment_method && <span className="text-[10px] text-muted-foreground">{p.payment_method}</span>}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-red-600 whitespace-nowrap">-₪{p.amount.toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deletePayment(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Income */}
          {payments.filter(p => p.payment_type === "income").length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground mt-3">הכנסות</h3>
              {payments.filter(p => p.payment_type === "income").map(p => (
                <Card key={p.id} className="border-green-200 dark:border-green-800">
                  <CardContent className="py-2 px-3 flex items-center gap-3">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                      {p.paid ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                      {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    </div>
                    <span className="font-bold text-sm text-green-600 whitespace-nowrap">+₪{p.amount.toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deletePayment(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {payments.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">אין תשלומים עדיין. הוסף הכנסה או הוצאה כדי להתחיל!</p>
              <SampleDataImport type="payments" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Type selector - prominent */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant={newType === "income" ? "default" : "outline"} className={`gap-2 ${newType === "income" ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={() => setNewType("income")}>
                  <TrendingUp className="h-4 w-4" />הכנסה
                </Button>
                <Button variant={newType === "expense" ? "default" : "outline"} className={`gap-2 ${newType === "expense" ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={() => setNewType("expense")}>
                  <TrendingDown className="h-4 w-4" />הוצאה
                </Button>
              </div>
              <AutocompleteInput fieldName="payment-title" value={newTitle} onChange={setNewTitle} placeholder={newType === "income" ? "שם ההכנסה (משכורת, פרילנס...)" : "שם ההוצאה (שכירות, חשמל...)"} />
              <Input placeholder="סכום" type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} dir="ltr" />
              <AutocompleteInput fieldName="payment-method" value={newMethod} onChange={setNewMethod} placeholder="אמצעי תשלום (אשראי, מזומן...)" />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} dir="ltr" className="flex-1" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)} className="rounded" />
                הוצאה/הכנסה קבועה (חוזרת כל חודש)
              </label>
              <Button onClick={addPayment} className={`w-full gap-2 ${newType === "income" ? "bg-green-600 hover:bg-green-700" : ""}`}>
                <Plus className="h-4 w-4" />{newType === "income" ? "הוסף הכנסה" : "הוסף הוצאה"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guides" className="space-y-3">
          {FINANCIAL_GUIDES.map(guide => (
            <Collapsible key={guide.id} open={expandedGuide === guide.id} onOpenChange={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}>
              <CollapsibleTrigger className="w-full">
                <Card className={`${guide.bgColor} cursor-pointer hover:shadow-md transition-all`}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <guide.icon className={`h-6 w-6 ${guide.color} shrink-0`} />
                    <span className="font-semibold flex-1 text-right">{guide.title}</span>
                    {expandedGuide === guide.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2 px-2">
                  {guide.sections.map((section, i) => (
                    <Card key={i} className="border-muted">
                      <CardContent className="py-3 px-4">
                        <h4 className="font-semibold text-sm mb-1">{section.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </TabsContent>

        <TabsContent value="ai">
          <AiChatPanel
            title="יועץ פיננסי AI"
            messages={aiChatHistory.messages}
            loaded={aiChatHistory.loaded}
            aiLoading={aiLoading}
            archive={aiChatHistory.archive}
            onSend={sendAiMessage}
            onClearAndArchive={aiChatHistory.clearAndArchive}
            onLoadConversation={aiChatHistory.loadConversation}
            placeholder="שאל שאלה על הכסף שלך..."
            emptyText="לחץ 'סיכום חודשי' לקבל ניתוח מלא, או שאל שאלה..."
            extraActions={
              <Button size="sm" variant="outline" onClick={getMonthlyInsight} disabled={aiLoading} className="text-xs gap-1 h-7">
                <BarChart3 className="h-3 w-3" />סיכום חודשי
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="credit-cards" className="space-y-4">
          <BankConnect />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentDashboard;
