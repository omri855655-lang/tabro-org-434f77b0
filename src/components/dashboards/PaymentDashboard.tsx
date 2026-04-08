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
import CreditCardConnect from "@/components/dashboards/CreditCardConnect";
import CreditCardImport from "@/components/dashboards/CreditCardImport";

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

interface FinancialTransaction {
  id: string;
  amount: number;
  category: string | null;
  direction: "income" | "expense";
  description: string | null;
  merchant: string | null;
  transaction_date: string;
  created_at: string;
  provider: string | null;
  source_type: string;
}

interface DashboardEntry {
  id: string;
  source: "payment_tracking" | "financial_transactions";
  title: string;
  amount: number;
  category: string | null;
  payment_type: "income" | "expense";
  payment_method: string | null;
  due_date: string | null;
  paid: boolean;
  recurring: boolean;
  notes: string | null;
  sheet_name: string;
  archived: boolean;
  created_at: string;
}

const SAVINGS_CATEGORIES = new Set(["חיסכון", "Savings", "savings", "השקעות", "Investments", "investments"]);

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
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
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

  const isSavingsCategory = useCallback((category: string | null) => {
    return category ? SAVINGS_CATEGORIES.has(category) : false;
  }, []);

  const fetchFinanceData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [paymentsResult, transactionsResult] = await Promise.all([
      supabase
        .from("payment_tracking")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_transactions")
        .select("id, amount, category, direction, description, merchant, transaction_date, created_at, provider, source_type")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false }),
    ]);

    if (paymentsResult.error || transactionsResult.error) {
      toast.error(isRtl ? "שגיאה בטעינת נתוני הכספים" : "Error loading financial data");
      setLoading(false);
      return;
    }

    setPayments((paymentsResult.data as any[]) || []);
    setTransactions((transactionsResult.data as any[]) || []);
    setLoading(false);
  }, [user, isRtl]);

  useEffect(() => { fetchFinanceData(); }, [fetchFinanceData]);

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
    fetchFinanceData();
  };

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from("payment_tracking").update({ paid: !paid }).eq("id", id);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, paid: !paid } : p));
  };

  const deleteEntry = async (entry: DashboardEntry) => {
    if (entry.source === "financial_transactions") {
      await supabase.from("financial_transactions").delete().eq("id", entry.id);
      setTransactions(prev => prev.filter(item => item.id !== entry.id));
      return;
    }

    await supabase.from("payment_tracking").delete().eq("id", entry.id);
    setPayments(prev => prev.filter(item => item.id !== entry.id));
  };

  const dashboardEntries = useMemo<DashboardEntry[]>(() => {
    const plannedEntries: DashboardEntry[] = payments.map((payment) => ({
      id: payment.id,
      source: "payment_tracking",
      title: payment.title,
      amount: payment.amount,
      category: payment.category,
      payment_type: payment.payment_type === "income" ? "income" : "expense",
      payment_method: payment.payment_method,
      due_date: payment.due_date,
      paid: payment.paid,
      recurring: payment.recurring,
      notes: payment.notes,
      sheet_name: payment.sheet_name,
      archived: payment.archived,
      created_at: payment.due_date || payment.created_at,
    }));

    const importedEntries: DashboardEntry[] = transactions.map((transaction) => ({
      id: transaction.id,
      source: "financial_transactions",
      title: transaction.description || transaction.merchant || (transaction.direction === "income" ? (isRtl ? "הכנסה מיובאת" : "Imported income") : (isRtl ? "הוצאה מיובאת" : "Imported expense")),
      amount: transaction.amount,
      category: transaction.category,
      payment_type: transaction.direction,
      payment_method: transaction.provider || transaction.source_type,
      due_date: transaction.transaction_date,
      paid: true,
      recurring: false,
      notes: null,
      sheet_name: "actual",
      archived: false,
      created_at: transaction.transaction_date || transaction.created_at,
    }));

    return [...importedEntries, ...plannedEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [payments, transactions, isRtl]);

  // Financial calculations
  const totalExpenses = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense").reduce((s, p) => s + p.amount, 0), [dashboardEntries]);
  const totalIncome = useMemo(() => dashboardEntries.filter(p => p.payment_type === "income").reduce((s, p) => s + p.amount, 0), [dashboardEntries]);
  const totalSpending = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category)).reduce((s, p) => s + p.amount, 0), [dashboardEntries, isSavingsCategory]);
  const dedicatedSavings = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && isSavingsCategory(p.category)).reduce((s, p) => s + p.amount, 0), [dashboardEntries, isSavingsCategory]);
  const balance = totalIncome - totalExpenses;
  const availableToSave = totalIncome - totalSpending;
  const unpaidExpenses = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && !p.paid).reduce((s, p) => s + p.amount, 0), [dashboardEntries]);
  const fixedExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense" && p.recurring).reduce((s, p) => s + p.amount, 0), [payments]);
  const variableExpenses = Math.max(totalSpending - fixedExpenses, 0);
  const recurringExpenseEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && p.recurring), [dashboardEntries]);
  const spendingEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category) && !p.recurring), [dashboardEntries, isSavingsCategory]);
  const incomeEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "income"), [dashboardEntries]);
  
  const overdue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return dashboardEntries.filter(p => !p.paid && p.due_date && p.due_date < today);
  }, [dashboardEntries]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    dashboardEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category)).forEach(p => {
      const cat = p.category || (isRtl ? "אחר" : "Other");
      cats[cat] = (cats[cat] || 0) + p.amount;
    });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, [dashboardEntries, isSavingsCategory]);

  // 50/30/20 rule calculation
  const needsPercent = totalIncome > 0 ? Math.round((fixedExpenses / totalIncome) * 100) : 0;
  const wantsPercent = totalIncome > 0 ? Math.round((variableExpenses / totalIncome) * 100) : 0;
  const savingsPercent = totalIncome > 0 ? Math.round((Math.max(availableToSave, 0) / totalIncome) * 100) : 0;

  // Monthly history breakdown
  const monthlyHistory = useMemo(() => {
    const months: Record<string, { income: number; expenses: number; items: DashboardEntry[] }> = {};
    dashboardEntries.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { income: 0, expenses: 0, items: [] };
      months[key].items.push(p);
      if (p.payment_type === "income") months[key].income += p.amount;
      else months[key].expenses += p.amount;
    });
    return Object.entries(months).sort(([a], [b]) => b.localeCompare(a));
  }, [dashboardEntries]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const monthKeys = ["january","february","march","april","may","june","july","august","september","october","november","december"] as const;
    return `${t(monthKeys[parseInt(m) - 1] as any)} ${y}`;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "-";

    const categoryKeyMap: Record<string, string> = {
      "משכורת": "catSalary",
      "פרילנס": "catFreelance",
      "דיור": "catHousing",
      "שכירות": "catRent",
      "משכנתא": "catMortgage",
      "סופר": "catGroceries",
      "אוכל": "catFood",
      "דלק": "catFuel",
      "תחבורה": "catTransport",
      "חשמל": "catElectricity",
      "מים": "catWater",
      "גז": "catGas",
      "אינטרנט": "catInternet",
      "טלפון": "catPhone",
      "ביטוחים": "catInsurance",
      "חשבונות": "catBills",
      "קניות": "catShopping",
      "בילויים": "catEntertainment",
      "חינוך": "catEducation",
      "בריאות": "catHealth",
      "חיסכון": "catSavings",
      "השקעות": "catInvestments",
      "אחר": "catOther",
      "Salary": "catSalary",
      "Freelance": "catFreelance",
      "Housing": "catHousing",
      "Rent": "catRent",
      "Mortgage": "catMortgage",
      "Groceries": "catGroceries",
      "Food": "catFood",
      "Fuel": "catFuel",
      "Transport": "catTransport",
      "Electricity": "catElectricity",
      "Water": "catWater",
      "Gas": "catGas",
      "Internet": "catInternet",
      "Phone": "catPhone",
      "Insurance": "catInsurance",
      "Bills": "catBills",
      "Shopping": "catShopping",
      "Entertainment": "catEntertainment",
      "Education": "catEducation",
      "Health": "catHealth",
      "Savings": "catSavings",
      "Investments": "catInvestments",
      "Other": "catOther",
    };

    const key = categoryKeyMap[category];
    return key ? t(key as any) : category;
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
 הוצאות כוללות: ₪${totalExpenses.toLocaleString()}
 בזבוז בפועל: ₪${totalSpending.toLocaleString()}
 פנוי לחיסכון: ₪${availableToSave.toLocaleString()}
 מאזן נטו: ₪${balance.toLocaleString()}
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
          dashboardEntries.map(p => ({ title: p.title, amount: p.amount, type: p.payment_type === 'income' ? t("incomeType" as any) : t("expenseType" as any), category: p.category || '', paid: p.paid, due_date: p.due_date || '', recurring: p.recurring, method: p.payment_method || '', source: p.source === 'financial_transactions' ? (isRtl ? 'מיובא' : 'Imported') : (isRtl ? 'מתוכנן' : 'Planned') })),
          [{ key: 'title', label: t("descriptionCol" as any) }, { key: 'amount', label: t("amountCol" as any) }, { key: 'type', label: t("typeCol" as any) }, { key: 'category', label: t("categoryCol" as any) }, { key: 'paid', label: t("paidCol" as any) }, { key: 'due_date', label: t("dateCol" as any) }, { key: 'recurring', label: t("recurringCol" as any) }, { key: 'method', label: t("methodCol" as any) }],
          t("paymentsSheet" as any)
        )}>
          <Download className="h-3.5 w-3.5" />{t("exportLabel" as any)}
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-primary/5 to-accent/10 shadow-sm">
        <CardContent className="py-6 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {isRtl ? "פנוי לחיסכון" : "Available to save"}
              </p>
              <p className="text-4xl font-bold text-foreground">₪{Math.abs(availableToSave).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {availableToSave >= 0
                  ? (isRtl ? "זה הסכום שנשאר לך אחרי בזבוזים בפועל." : "This is what remains after real spending.")
                  : (isRtl ? "כרגע הבזבוזים שלך גבוהים מההכנסות." : "Right now spending is higher than income.")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">{t("income" as any)}</p>
                <p className="mt-1 text-lg font-semibold">₪{totalIncome.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">{isRtl ? "בזבוז" : "Spending"}</p>
                <p className="mt-1 text-lg font-semibold">₪{totalSpending.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">{isRtl ? "סומן לחיסכון" : "Marked as savings"}</p>
                <p className="mt-1 text-lg font-semibold">₪{dedicatedSavings.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">{t("overdue" as any)}</p>
                <p className="mt-1 text-lg font-semibold">{overdue.length}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                {isRtl ? "יעד: להכניס ולשמור" : "Goal: earn and keep"}
              </div>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {isRtl ? "הכנסה לא נספרת כבזבוז. הדשבורד מחשב כמה באמת הוצאת וכמה נשאר לשמור." : "Income is not treated as spending. The dashboard separates real spending from money left to keep."}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PiggyBank className="h-4 w-4 text-primary" />
                {isRtl ? "מאזן נטו" : "Net balance"}
              </div>
              <p className="mt-2 text-2xl font-semibold">₪{balance.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                {isRtl ? "הוצאות שלא שולמו" : "Unpaid planned expenses"}
              </div>
              <p className="mt-2 text-2xl font-semibold">₪{unpaidExpenses.toLocaleString()}</p>
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
                <span>{isRtl ? "בוזבז בפועל" : "Spent"}: ₪{totalSpending.toLocaleString()}</span>
                <span>{t("targetLabel" as any)}: ₪{budgetTarget.toLocaleString()}</span>
              </div>
              <Progress value={Math.min((totalSpending / budgetTarget) * 100, 100)} className={`h-3 ${totalSpending > budgetTarget ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
              <div className="flex justify-between mt-2">
                <span className={`text-sm font-semibold ${totalSpending > budgetTarget ? "text-destructive" : "text-primary"}`}>
                  {totalSpending > budgetTarget ? `${t("budgetExceeded" as any)} ₪${(totalSpending - budgetTarget).toLocaleString()} ⚠️` : `${t("budgetRemaining" as any)} ₪${(budgetTarget - totalSpending).toLocaleString()} ✅`}
                </span>
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => { setEditingBudget(true); setBudgetInput(String(budgetTarget)); }}>{t("editing" as any)}</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {isRtl ? "קטגוריות חיסכון/השקעה לא נספרות כבזבוז בתקציב." : "Savings/investment categories are not counted as spending against the budget."}
              </p>
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
      <BudgetCharts payments={dashboardEntries.filter(entry => entry.payment_type === "income" || !isSavingsCategory(entry.category)) as any} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="overview" className="flex-1">{t("incomeTab" as any)}</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1"><History className="h-3 w-3" />{t("historyTab" as any)}</TabsTrigger>
          <TabsTrigger value="add" className="flex-1 gap-1"><Plus className="h-3 w-3" />{t("addTab" as any)}</TabsTrigger>
          <TabsTrigger value="guides" className="flex-1 gap-1"><BookOpen className="h-3 w-3" />{t("guidesTab" as any)}</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3 w-3" />{t("aiAdvisor" as any)}</TabsTrigger>
          <TabsTrigger value="credit-cards" className="flex-1 gap-1"><CreditCard className="h-3 w-3" />{t("bankCreditTab" as any)}</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          {monthlyHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noHistoryYet" as any)}</p>
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
                        {isCurrent && <Badge variant="outline" className="mr-1 text-[9px] px-1">{t("current" as any)}</Badge>}
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
                      <h3 className="text-sm font-semibold">{formatMonthLabel(selectedHistoryMonth)} — {t("detail" as any)}</h3>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("income" as any)}</p>
                          <p className="font-bold text-green-600">₪{data.income.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("expenses" as any)}</p>
                          <p className="font-bold text-red-600">₪{data.expenses.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("balance" as any)}</p>
                          <p className={`font-bold ${data.income - data.expenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₪{(data.income - data.expenses).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {sortedCats.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground">{t("expenseBreakdown" as any)}</h4>
                          {sortedCats.map(([cat, amt]) => {
                            const pct = data.expenses > 0 ? Math.round((amt / data.expenses) * 100) : 0;
                            return (
                              <div key={cat}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>{getCategoryLabel(cat)}</span>
                                  <span className="font-medium">₪{amt.toLocaleString()} ({pct}%)</span>
                                </div>
                                <Progress value={pct} className="h-2" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        <h4 className="text-xs font-semibold text-muted-foreground">{t("allItems" as any)}</h4>
                        {data.items.map(p => (
                          <div key={p.id} className="flex items-center justify-between py-1 text-sm border-b border-border/50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span>{p.title}</span>
                              {p.category && <Badge variant="outline" className="text-[9px]">{getCategoryLabel(p.category)}</Badge>}
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
          {recurringExpenseEntries.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">{t("fixedExpenses" as any)}</h3>
              {recurringExpenseEntries.map(p => (
                <Card key={p.id} className="border-muted">
                  <CardContent className="py-2 px-3 flex items-center gap-3">
                    {p.source === "payment_tracking" ? (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                        {p.paid ? <Check className="h-4 w-4 text-primary" /> : <div className="h-4 w-4 border-2 rounded" />}
                      </Button>
                    ) : <div className="h-6 w-6" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        {p.category && <Badge variant="outline" className="text-[10px]">{getCategoryLabel(p.category)}</Badge>}
                        {p.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(p.due_date), "dd/MM/yy")}</span>}
                        {p.source === "payment_tracking" && <Badge variant="secondary" className="text-[9px]">{isRtl ? "מתוכנן" : "Planned"}</Badge>}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-red-600 whitespace-nowrap">-₪{p.amount.toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteEntry(p)}><Trash2 className="h-3 w-3" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Variable expenses */}
          {spendingEntries.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground mt-3">{isRtl ? "בזבוזים ותנועות" : "Spending & transactions"}</h3>
              {spendingEntries.map(p => (
                <Card key={p.id}>
                  <CardContent className="py-2 px-3 flex items-center gap-3">
                    {p.source === "payment_tracking" ? (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                        {p.paid ? <Check className="h-4 w-4 text-primary" /> : <div className="h-4 w-4 border-2 rounded" />}
                      </Button>
                    ) : <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">₪</div>}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        {p.category && <Badge variant="outline" className="text-[10px]">{getCategoryLabel(p.category)}</Badge>}
                        {p.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(p.due_date), "dd/MM/yy")}</span>}
                        {p.payment_method && <span className="text-[10px] text-muted-foreground">{p.payment_method}</span>}
                        <Badge variant="secondary" className="text-[9px]">{p.source === "financial_transactions" ? (isRtl ? "מיובא" : "Imported") : (isRtl ? "מתוכנן" : "Planned")}</Badge>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-red-600 whitespace-nowrap">-₪{p.amount.toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteEntry(p)}><Trash2 className="h-3 w-3" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Income */}
          {incomeEntries.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground mt-3">{t("income" as any)}</h3>
              {incomeEntries.map(p => (
                <Card key={p.id} className="border-green-200 dark:border-green-800">
                  <CardContent className="py-2 px-3 flex items-center gap-3">
                    {p.source === "payment_tracking" ? (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                        {p.paid ? <Check className="h-4 w-4 text-primary" /> : <div className="h-4 w-4 border-2 rounded" />}
                      </Button>
                    ) : <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">₪</div>}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        {p.category && <Badge variant="outline" className="text-[10px]">{getCategoryLabel(p.category)}</Badge>}
                        <Badge variant="secondary" className="text-[9px]">{p.source === "financial_transactions" ? (isRtl ? "מיובא" : "Imported") : (isRtl ? "מתוכנן" : "Planned")}</Badge>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-green-600 whitespace-nowrap">+₪{p.amount.toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteEntry(p)}><Trash2 className="h-3 w-3" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {dashboardEntries.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">{t("noPaymentsYet" as any)}</p>
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
                  <TrendingUp className="h-4 w-4" />{t("incomeType" as any)}
                </Button>
                <Button variant={newType === "expense" ? "default" : "outline"} className={`gap-2 ${newType === "expense" ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={() => setNewType("expense")}>
                  <TrendingDown className="h-4 w-4" />{t("expenseType" as any)}
                </Button>
              </div>
              <AutocompleteInput fieldName="payment-title" value={newTitle} onChange={setNewTitle} placeholder={newType === "income" ? t("incomeName" as any) : t("expenseName" as any)} />
              <Input placeholder={t("amount" as any)} type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} dir="ltr" />
              <AutocompleteInput fieldName="payment-method" value={newMethod} onChange={setNewMethod} placeholder={t("paymentMethod" as any)} />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger><SelectValue placeholder={t("chooseCategory" as any)} /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_IDS.map((c, i) => <SelectItem key={c} value={c}>{t(CATEGORY_KEYS[i] as any)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} dir="ltr" className="flex-1" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)} className="rounded" />
                {t("recurringExpense" as any)}
              </label>
              <Button onClick={addPayment} className={`w-full gap-2 ${newType === "income" ? "bg-green-600 hover:bg-green-700" : ""}`}>
                <Plus className="h-4 w-4" />{newType === "income" ? t("addIncome" as any) : t("addExpense" as any)}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guides" className="space-y-3">
          {GUIDE_DEFS.map(guide => (
            <Collapsible key={guide.id} open={expandedGuide === guide.id} onOpenChange={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}>
              <CollapsibleTrigger className="w-full">
                <Card className={`${guide.bgColor} cursor-pointer hover:shadow-md transition-all`}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <guide.icon className={`h-6 w-6 ${guide.color} shrink-0`} />
                    <span className={`font-semibold flex-1 ${isRtl ? "text-right" : "text-left"}`}>{t(guide.titleKey as any)}</span>
                    {expandedGuide === guide.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2 px-2">
                  {guide.sections.map((section, i) => (
                    <Card key={i} className="border-muted">
                      <CardContent className="py-3 px-4">
                        <h4 className="font-semibold text-sm mb-1">{t(section.titleKey as any)}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{t(section.contentKey as any)}</p>
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
            title={t("aiFinancialAdvisor" as any)}
            messages={aiChatHistory.messages}
            loaded={aiChatHistory.loaded}
            aiLoading={aiLoading}
            archive={aiChatHistory.archive}
            onSend={sendAiMessage}
            onClearAndArchive={aiChatHistory.clearAndArchive}
            onLoadConversation={aiChatHistory.loadConversation}
            placeholder={t("askAboutMoney" as any)}
            emptyText={t("monthlySummaryPrompt" as any)}
            extraActions={
              <Button size="sm" variant="outline" onClick={getMonthlyInsight} disabled={aiLoading} className="text-xs gap-1 h-7">
                <BarChart3 className="h-3 w-3" />{t("monthlySummaryBtn" as any)}
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="credit-cards" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <BankConnect />
            <CreditCardConnect />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FinancialCsvImport />
            <CreditCardImport />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentDashboard;
