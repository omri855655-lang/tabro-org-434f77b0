import { useState, useEffect, useCallback, useMemo } from "react";
import { CloudFinanceConnector } from "@/components/dashboards/CloudFinanceConnector";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { invokeFinanceBackend } from "@/lib/financeBackend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AutocompleteInput from "@/components/AutocompleteInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CreditCard, TrendingUp, TrendingDown, DollarSign, Check, Calendar, Sparkles, MessageCircle, ChevronDown, ChevronUp, BookOpen, PiggyBank, AlertTriangle, Lightbulb, Wallet, BarChart3, Download, History, Pencil, X } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import SampleDataImport from "@/components/SampleDataImport";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AiChatPanel from "@/components/AiChatPanel";
import BudgetCharts from "@/components/dashboards/BudgetCharts";
import ManualTransactionForm from "@/components/ManualTransactionForm";
import FinanceInsights from "@/components/dashboards/FinanceInsights";
import FinanceOverview from "@/components/dashboards/FinanceOverview";
import { inferFinanceSubcategory, normalizeFinanceCategory } from "@/lib/financeCategorization";

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
  subcategory?: string | null;
  direction: "income" | "expense";
  description: string | null;
  merchant: string | null;
  transaction_date: string;
  created_at: string;
  provider: string | null;
  source_type: string;
  account_external_id?: string | null;
  raw_data?: { account_external_id?: string | null } | null;
  backend?: "legacy" | "cloud";
}

interface FinancialAccount {
  id: string;
  external_account_id: string;
  provider_name: string | null;
  account_type: string | null;
  display_name: string | null;
  masked_number: string | null;
  currency: string | null;
  current_balance: number | null;
  available_balance: number | null;
  backend?: "legacy" | "cloud";
}

interface DashboardEntry {
  id: string;
  source: "payment_tracking" | "financial_transactions" | "cloud_financial_transactions";
  title: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  payment_type: "income" | "expense";
  payment_method: string | null;
  source_channel: "credit_card" | "bank" | "manual";
  account_label: string | null;
  account_last_four: string | null;
  due_date: string | null;
  paid: boolean;
  recurring: boolean;
  recurring_frequency: string | null;
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

function nextMonthlyOccurrence(value: string | null | undefined, from = new Date()) {
  const sourceDate = value ? new Date(value) : from;
  const preferredDay = Number.isNaN(sourceDate.getTime()) ? from.getDate() : sourceDate.getDate();
  const candidate = new Date(from.getFullYear(), from.getMonth(), Math.min(preferredDay, new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()));
  candidate.setHours(12, 0, 0, 0);
  if (candidate < from) {
    const nextMonthLastDay = new Date(from.getFullYear(), from.getMonth() + 2, 0).getDate();
    candidate.setMonth(candidate.getMonth() + 1, Math.min(preferredDay, nextMonthLastDay));
  }
  return candidate;
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
}

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
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isRtl = lang === "he" || lang === "ar";
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
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
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [newRecurringFrequency, setNewRecurringFrequency] = useState("monthly");

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

    const [paymentsResult, transactionsResult, accountsResult, cloudFinanceResult] = await Promise.all([
      supabase
        .from("payment_tracking")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_transactions")
        .select("id, amount, category, subcategory, direction, description, merchant, transaction_date, created_at, provider, source_type, raw_data")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false }),
      supabase
        .from("financial_accounts")
        .select("id, external_account_id, provider_name, account_type, display_name, masked_number, currency, current_balance, available_balance")
        .eq("user_id", user.id),
      invokeFinanceBackend<{ transactions?: FinancialTransaction[]; accounts?: FinancialAccount[] }>("list")
        .catch(() => ({ transactions: [], accounts: [] })),
    ]);

    if (paymentsResult.error || transactionsResult.error) {
      toast.error(t("error" as any));
      setLoading(false);
      return;
    }

    setPayments((paymentsResult.data as any[]) || []);
    const legacyTransactions = ((transactionsResult.data as FinancialTransaction[]) || []).map((item) => ({
      ...item,
      account_external_id: item.raw_data?.account_external_id || null,
      backend: "legacy" as const,
    }));
    const cloudTransactions = (cloudFinanceResult.transactions || []).map((item) => ({
      ...item,
      id: `cloud:${item.id}`,
      backend: "cloud" as const,
    }));
    setTransactions([...cloudTransactions, ...legacyTransactions]);
    const legacyAccounts = ((accountsResult.data as FinancialAccount[]) || []).map((item) => ({
      ...item,
      backend: "legacy" as const,
    }));
    const cloudAccounts = (cloudFinanceResult.accounts || []).map((item) => ({
      ...item,
      id: `cloud:${item.id}`,
      backend: "cloud" as const,
    }));
    setFinancialAccounts([...cloudAccounts, ...legacyAccounts]);
    setLoading(false);
  }, [user, t]);

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
      recurring_frequency: newRecurring ? newRecurringFrequency : null,
    });
    if (error) { toast.error(t("error" as any)); return; }
    setNewTitle(""); setNewAmount(""); setNewCategory(""); setNewMethod(""); setNewDueDate(""); setNewRecurringFrequency("monthly");
    toast.success(newType === "income" ? t("incomeAdded" as any) : t("expenseAdded" as any));
    fetchFinanceData();
  };

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from("payment_tracking").update({ paid: !paid }).eq("id", id);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, paid: !paid } : p));
  };

  const deleteEntry = async (entry: DashboardEntry) => {
    if (entry.source === "cloud_financial_transactions") {
      await invokeFinanceBackend("delete_transaction", { transactionId: entry.id.replace(/^cloud:/, "") });
      setTransactions(prev => prev.filter(item => item.id !== entry.id));
      return;
    }
    if (entry.source === "financial_transactions") {
      await supabase.from("financial_transactions").delete().eq("id", entry.id);
      setTransactions(prev => prev.filter(item => item.id !== entry.id));
      return;
    }

    await supabase.from("payment_tracking").delete().eq("id", entry.id);
    setPayments(prev => prev.filter(item => item.id !== entry.id));
  };

  const saveEntryEdit = async (entry: DashboardEntry) => {
    const parsedAmount = editAmount ? parseFloat(editAmount) : null;
    if (entry.source === "payment_tracking") {
      const updates: any = { category: editCategory || null, notes: editNotes || null };
      if (parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0) updates.amount = parsedAmount;
      await supabase.from("payment_tracking").update(updates).eq("id", entry.id);
      setPayments(prev => prev.map(p => p.id === entry.id ? { ...p, ...updates } : p));
    } else if (entry.source === "cloud_financial_transactions") {
      const updates: Record<string, unknown> = { category: editCategory || null };
      if (parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0) updates.amount = parsedAmount;
      await invokeFinanceBackend("update_transaction", {
        transactionId: entry.id.replace(/^cloud:/, ""),
        ...updates,
      });
      setTransactions(prev => prev.map(item => item.id === entry.id ? { ...item, ...updates } : item));
    } else {
      const updates: any = { category: editCategory || null };
      if (parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0) updates.amount = parsedAmount;
      await supabase.from("financial_transactions").update(updates).eq("id", entry.id);
      setTransactions(prev => prev.map(t => t.id === entry.id ? { ...t, ...updates } : t));
    }
    setEditingEntryId(null);
    toast.success(t("save" as any));
  };

  const handleToggleRecurring = async (entry: DashboardEntry) => {
    if (entry.source === "payment_tracking") {
      const newRecurring = !entry.recurring;
      await supabase.from("payment_tracking").update({ recurring: newRecurring }).eq("id", entry.id);
      setPayments(prev => prev.map(p => p.id === entry.id ? { ...p, recurring: newRecurring } : p));
      toast.success(newRecurring ? t("fixedPayment" as any) : t("variableExpenses" as any));
    } else if (entry.source === "financial_transactions" || entry.source === "cloud_financial_transactions") {
      if (payments.some((payment) => payment.recurring && payment.title === entry.title)) {
        toast.info(isRtl ? "כבר קיים תכנון קבוע עבור תנועה זו." : "A recurring plan already exists for this transaction.");
        return;
      }
      const nextDueDate = nextMonthlyOccurrence(entry.due_date).toISOString().slice(0, 10);
      const { error: insertErr } = await supabase.from("payment_tracking").insert({
        user_id: user!.id,
        title: entry.title,
        amount: entry.amount,
        category: entry.category,
        payment_type: entry.payment_type,
        payment_method: entry.payment_method,
        due_date: nextDueDate,
        recurring: true,
        recurring_frequency: "monthly",
        paid: false,
        notes: isRtl ? "זוהה ואושר כתנועה חודשית קבועה" : "Detected and approved as a monthly recurring transaction",
      });
      if (insertErr) { toast.error(t("error" as any)); return; }
      toast.success(isRtl ? "נוסף לתחזית כהוצאה קבועה. התנועה המקורית נשמרה." : "Added to the forecast. The original transaction was preserved.");
      fetchFinanceData();
    }
  };

  const dashboardEntries = useMemo<DashboardEntry[]>(() => {
    const plannedEntries: DashboardEntry[] = payments.map((payment) => ({
      id: payment.id,
      source: "payment_tracking",
      title: payment.title,
      amount: payment.amount,
      category: payment.category,
      subcategory: payment.category,
      payment_type: payment.payment_type === "income" ? "income" : "expense",
      payment_method: payment.payment_method,
      source_channel: "manual",
      account_label: null,
      account_last_four: null,
      due_date: payment.due_date,
      paid: payment.paid,
      recurring: payment.recurring,
      recurring_frequency: payment.recurring_frequency || null,
      notes: payment.notes,
      sheet_name: payment.sheet_name,
      archived: payment.archived,
      created_at: payment.due_date || payment.created_at,
    }));

    const accountByExternalId = new Map(financialAccounts.map((account) => [account.external_account_id, account]));
    const importedEntries: DashboardEntry[] = transactions.map((transaction) => {
      const account = transaction.account_external_id
        ? accountByExternalId.get(transaction.account_external_id)
        : undefined;
      const normalizedCategory = normalizeFinanceCategory(
        transaction.category,
        transaction.description || transaction.merchant,
        transaction.direction,
      );
      const providerLooksLikeCard = /cal|כאל|visa|ישראכרט|isracard|max|amex|american express/i.test(
        `${transaction.provider || ""} ${transaction.source_type || ""}`,
      );
      const sourceChannel = account?.account_type?.toUpperCase() === "CARD" || providerLooksLikeCard
        ? "credit_card"
        : "bank";

      return ({
      id: transaction.id,
      source: transaction.backend === "cloud" ? "cloud_financial_transactions" : "financial_transactions",
      title: transaction.description || transaction.merchant || (transaction.direction === "income" ? t("incomeType" as any) : t("expenseType" as any)),
      amount: transaction.amount,
      category: normalizedCategory,
      subcategory: transaction.direction === "expense"
        ? transaction.subcategory || inferFinanceSubcategory(transaction.description || transaction.merchant, normalizedCategory)
        : normalizedCategory,
      payment_type: transaction.direction,
      payment_method: transaction.provider || transaction.source_type,
      source_channel: sourceChannel,
      account_label: account?.display_name || account?.provider_name || transaction.provider || null,
      account_last_four: account?.masked_number?.match(/\d{4}$/)?.[0] || null,
      due_date: transaction.transaction_date,
      paid: true,
      recurring: false,
      recurring_frequency: null,
      notes: null,
      sheet_name: "actual",
      archived: false,
      created_at: transaction.transaction_date || transaction.created_at,
      });
    });

    return [...importedEntries, ...plannedEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [payments, transactions, financialAccounts, t]);

  // Filter entries by budget period for accurate budget calculations
  // Get current week range (Sunday-Saturday) for display
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: `${format(start, "dd/MM")} - ${format(end, "dd/MM")}` };
  }, []);

  const periodFilteredEntries = useMemo(() => {
    const now = new Date();
    return dashboardEntries.filter(entry => {
      // Use due_date (actual transaction/payment date) instead of created_at
      const dateStr = entry.due_date || entry.created_at;
      const entryDate = new Date(dateStr);
      if (budgetPeriod === "weekly") {
        return entryDate >= weekRange.start && entryDate <= weekRange.end;
      }
      if (budgetPeriod === "monthly") {
        return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      }
      if (budgetPeriod === "quarterly") {
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999);
        return entryDate >= qStart && entryDate <= qEnd;
      }
      return entryDate.getFullYear() === now.getFullYear();
    });
  }, [dashboardEntries, budgetPeriod, weekRange]);

  // Financial calculations
  const totalExpenses = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense").reduce((s, p) => s + p.amount, 0), [dashboardEntries]);
  const totalIncome = useMemo(() => dashboardEntries.filter(p => p.payment_type === "income").reduce((s, p) => s + p.amount, 0), [dashboardEntries]);
  const totalSpending = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category)).reduce((s, p) => s + p.amount, 0), [dashboardEntries, isSavingsCategory]);
  // Period-filtered spending for budget comparison (excludes fixed/recurring)
  const periodSpending = useMemo(() => periodFilteredEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category) && !p.recurring).reduce((s, p) => s + p.amount, 0), [periodFilteredEntries, isSavingsCategory]);
  const dedicatedSavings = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && isSavingsCategory(p.category)).reduce((s, p) => s + p.amount, 0), [dashboardEntries, isSavingsCategory]);
  const balance = totalIncome - totalExpenses;
  const availableToSave = totalIncome - totalSpending;
  const unpaidExpenses = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && !p.paid).reduce((s, p) => s + p.amount, 0), [dashboardEntries]);
  const fixedExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense" && p.recurring).reduce((s, p) => s + p.amount, 0), [payments]);
  const variableExpenses = Math.max(totalSpending - fixedExpenses, 0);
  const recurringExpenseEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && p.recurring), [dashboardEntries]);
  const spendingEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category) && !p.recurring), [dashboardEntries, isSavingsCategory]);
  const incomeEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "income"), [dashboardEntries]);

  const cashFlowForecast = useMemo(() => {
    const now = dateOnly(new Date());
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const uniqueAccounts = new Map<string, FinancialAccount>();
    financialAccounts.forEach((account) => {
      const key = `${account.provider_name || ""}:${account.external_account_id}`;
      if (!uniqueAccounts.has(key)) uniqueAccounts.set(key, account);
    });
    const liquidBalance = [...uniqueAccounts.values()]
      .filter((account) => account.account_type?.toUpperCase() !== "CARD" && (!account.currency || account.currency === "ILS"))
      .reduce((sum, account) => sum + (account.available_balance ?? account.current_balance ?? 0), 0);

    const upcoming = payments.flatMap((payment) => {
      if (payment.paid || !payment.due_date) return [];
      const sourceDate = dateOnly(new Date(payment.due_date));
      if (Number.isNaN(sourceDate.getTime())) return [];
      const occurrence = payment.recurring && payment.recurring_frequency === "monthly"
        ? nextMonthlyOccurrence(payment.due_date, now)
        : sourceDate;
      if (occurrence < now || occurrence > monthEnd) return [];
      return [{ payment, occurrence }];
    }).sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());

    const plannedIncome = upcoming
      .filter(({ payment }) => payment.payment_type === "income")
      .reduce((sum, { payment }) => sum + payment.amount, 0);
    const recurringExpenses = upcoming
      .filter(({ payment }) => payment.payment_type === "expense" && payment.recurring)
      .reduce((sum, { payment }) => sum + payment.amount, 0);
    const oneOffExpenses = upcoming
      .filter(({ payment }) => payment.payment_type === "expense" && !payment.recurring)
      .reduce((sum, { payment }) => sum + payment.amount, 0);

    return {
      liquidBalance,
      plannedIncome,
      recurringExpenses,
      oneOffExpenses,
      projectedBalance: liquidBalance + plannedIncome - recurringExpenses - oneOffExpenses,
      upcoming,
    };
  }, [financialAccounts, payments]);

  const proactiveFinanceInsights = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const actualExpenses = dashboardEntries.filter((entry) => entry.paid && entry.payment_type === "expense");
    const currentExpenses = actualExpenses.filter((entry) => new Date(entry.created_at) >= currentMonthStart);
    const historicalExpenses = actualExpenses.filter((entry) => new Date(entry.created_at) < currentMonthStart);
    const historicalByCategory = new Map<string, { total: number; months: Set<string> }>();
    historicalExpenses.forEach((entry) => {
      const category = entry.category || "אחר";
      const date = new Date(entry.created_at);
      const month = `${date.getFullYear()}-${date.getMonth()}`;
      const current = historicalByCategory.get(category) || { total: 0, months: new Set<string>() };
      current.total += entry.amount;
      current.months.add(month);
      historicalByCategory.set(category, current);
    });
    const currentByCategory = new Map<string, number>();
    currentExpenses.forEach((entry) => {
      const category = entry.category || "אחר";
      currentByCategory.set(category, (currentByCategory.get(category) || 0) + entry.amount);
    });
    const categoryAnomaly = [...currentByCategory.entries()]
      .map(([category, current]) => {
        const history = historicalByCategory.get(category);
        const average = history && history.months.size > 0 ? history.total / history.months.size : 0;
        return { category, current, average, ratio: average > 0 ? current / average : 0 };
      })
      .filter((item) => item.average >= 50 && item.current >= item.average + 100 && item.ratio >= 1.4)
      .sort((a, b) => b.ratio - a.ratio)[0] || null;

    const merchantHistory = new Map<string, number[]>();
    historicalExpenses.forEach((entry) => {
      const key = entry.title.trim().toLowerCase();
      merchantHistory.set(key, [...(merchantHistory.get(key) || []), entry.amount]);
    });
    const unusualExpense = currentExpenses
      .map((entry) => {
        const history = merchantHistory.get(entry.title.trim().toLowerCase()) || [];
        const average = history.length ? history.reduce((sum, amount) => sum + amount, 0) / history.length : 0;
        return { entry, average, ratio: average > 0 ? entry.amount / average : 0 };
      })
      .filter((item) => item.average >= 20 && item.entry.amount >= item.average + 75 && item.ratio >= 1.75)
      .sort((a, b) => b.ratio - a.ratio)[0] || null;

    return {
      categoryAnomaly,
      unusualExpense,
      nextUpcoming: cashFlowForecast.upcoming[0] || null,
      requiresAttention: Boolean(categoryAnomaly || unusualExpense || cashFlowForecast.projectedBalance < 0),
    };
  }, [cashFlowForecast, dashboardEntries]);
  
  const overdue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return dashboardEntries.filter(p => !p.paid && p.due_date && p.due_date < today);
  }, [dashboardEntries]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    dashboardEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category)).forEach(p => {
      const cat = p.category || t("catOther" as any);
      cats[cat] = (cats[cat] || 0) + p.amount;
    });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, [dashboardEntries, isSavingsCategory, t]);

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
      "משכורת": "catSalary", "פרילנס": "catFreelance", "דיור": "catHousing", "שכירות": "catRent", "משכנתא": "catMortgage", "סופר": "catGroceries", "אוכל": "catFood", "דלק": "catFuel", "תחבורה": "catTransport", "חשמל": "catElectricity", "מים": "catWater", "גז": "catGas", "אינטרנט": "catInternet", "טלפון": "catPhone", "ביטוחים": "catInsurance", "חשבונות": "catBills", "קניות": "catShopping", "בילויים": "catEntertainment", "חינוך": "catEducation", "בריאות": "catHealth", "חיסכון": "catSavings", "השקעות": "catInvestments", "אחר": "catOther",
      "Salary": "catSalary", "Freelance": "catFreelance", "Housing": "catHousing", "Rent": "catRent", "Mortgage": "catMortgage", "Groceries": "catGroceries", "Food": "catFood", "Fuel": "catFuel", "Transport": "catTransport", "Electricity": "catElectricity", "Water": "catWater", "Gas": "catGas", "Internet": "catInternet", "Phone": "catPhone", "Insurance": "catInsurance", "Bills": "catBills", "Shopping": "catShopping", "Entertainment": "catEntertainment", "Education": "catEducation", "Health": "catHealth", "Savings": "catSavings", "Investments": "catInvestments", "Other": "catOther",
    };

    const key = categoryKeyMap[category];
    return key ? t(key as any) : category;
  };

  const getBudgetPeriodLabel = (p: string) => {
    if (p === "weekly") return t("weeklyPeriod" as any);
    if (p === "monthly") return t("monthlyPeriod" as any);
    if (p === "quarterly") return t("quarterlyPeriod" as any);
    return t("yearlyPeriod" as any);
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
יתרה נזילה כעת: ₪${cashFlowForecast.liquidBalance.toLocaleString()}
תחזית לסוף החודש: ₪${cashFlowForecast.projectedBalance.toLocaleString()}
הוצאות קבועות מתוכננות עד סוף החודש: ₪${cashFlowForecast.recurringExpenses.toLocaleString()}
הוצאות חד-פעמיות מתוכננות עד סוף החודש: ₪${cashFlowForecast.oneOffExpenses.toLocaleString()}
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
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: t("error" as any) }]);
    }
    setAiLoading(false);
  };

  const getMonthlyInsight = () => {
    sendAiMessage(t("monthlySummaryPrompt" as any));
  };

  // Render a single entry row with inline edit
  const renderEntryRow = (p: DashboardEntry, colorClass: string) => {
    const isEditing = editingEntryId === p.id;
    return (
      <Card key={p.id} className={p.payment_type === "income" ? "border-green-200 dark:border-green-800" : p.recurring ? "border-muted" : ""}>
        <CardContent className="py-2 px-3 space-y-0">
          <div className="flex items-center gap-3" dir={isRtl ? "rtl" : "ltr"}>
            {p.source === "payment_tracking" ? (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                {p.paid ? <Check className="h-4 w-4 text-primary" /> : <div className="h-4 w-4 border-2 rounded" />}
              </Button>
            ) : <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">₪</div>}
            <div className="flex-1 min-w-0" style={{ textAlign: isRtl ? "right" : "left" }}>
              <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
              <div className="flex gap-2 items-center flex-wrap">
                {p.category && <Badge variant="outline" className="text-[10px]">{getCategoryLabel(p.category)}</Badge>}
                {p.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(p.due_date), "dd/MM/yy")}</span>}
                {p.payment_method && <span className="text-[10px] text-muted-foreground">{p.payment_method}</span>}
                <Badge variant="secondary" className="text-[9px]">
                  {p.source !== "payment_tracking" ? t("importedLabel" as any) : t("plannedLabel" as any)}
                </Badge>
                {p.recurring && <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600">{t("fixedPayment" as any)}{p.recurring_frequency ? ` (${getBudgetPeriodLabel(p.recurring_frequency)})` : ""}</Badge>}
              </div>
            </div>
            <span className={`font-bold text-sm whitespace-nowrap ${colorClass}`}>
              {p.payment_type === "income" ? "+" : "-"}₪{p.amount.toLocaleString()}
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
              if (isEditing) { setEditingEntryId(null); }
              else { setEditingEntryId(p.id); setEditCategory(p.category || ""); setEditNotes(p.notes || ""); setEditAmount(String(p.amount)); }
            }}>
              {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3 text-muted-foreground" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteEntry(p)}><Trash2 className="h-3 w-3" /></Button>
          </div>
          {isEditing && (
            <div className="mt-2 flex gap-2 items-end flex-wrap border-t pt-2" dir={isRtl ? "rtl" : "ltr"}>
              <Input placeholder={t("amount" as any)} type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-8 text-xs w-[100px]" dir="ltr" />
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder={t("chooseCategory" as any)} /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_IDS.map((c, i) => <SelectItem key={c} value={c}>{t(CATEGORY_KEYS[i] as any)}</SelectItem>)}
                </SelectContent>
              </Select>
              {(p.source === "payment_tracking" || p.source === "financial_transactions" || p.source === "cloud_financial_transactions") && (
                <Input placeholder={t("notes" as any)} value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-8 text-xs flex-1 min-w-[120px]" />
              )}
              {/* Mark as fixed/recurring - works for both payment_tracking AND imported transactions */}
              <Button size="sm" variant={p.recurring ? "default" : "outline"} className="h-8 text-[10px] gap-1" onClick={() => handleToggleRecurring(p)}>
                {t("fixedPayment" as any)}
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => saveEntryEdit(p)}>{t("save" as any)}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">{t("loading" as any)}</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Wallet className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">{t("incomeAndExpenses" as any)}</h2>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          dashboardEntries.map(p => ({ title: p.title, amount: p.amount, type: p.payment_type === 'income' ? t("incomeType" as any) : t("expenseType" as any), category: p.category || '', paid: p.paid, due_date: p.due_date || '', recurring: p.recurring, method: p.payment_method || '', source: p.source !== 'payment_tracking' ? t("importedLabel" as any) : t("plannedLabel" as any) })),
          [{ key: 'title', label: t("descriptionCol" as any) }, { key: 'amount', label: t("amountCol" as any) }, { key: 'type', label: t("typeCol" as any) }, { key: 'category', label: t("categoryCol" as any) }, { key: 'paid', label: t("paidCol" as any) }, { key: 'due_date', label: t("dateCol" as any) }, { key: 'recurring', label: t("recurringCol" as any) }, { key: 'method', label: t("methodCol" as any) }],
          t("paymentsSheet" as any)
        )}>
          <Download className="h-3.5 w-3.5" />{t("exportLabel" as any)}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto mb-4">
          <TabsTrigger value="overview" className="flex-1">{t("incomeTab" as any)}</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1"><History className="h-3 w-3" />{t("historyTab" as any)}</TabsTrigger>
          <TabsTrigger value="add" className="flex-1 gap-1"><Plus className="h-3 w-3" />{t("addTab" as any)}</TabsTrigger>
          <TabsTrigger value="guides" className="flex-1 gap-1"><BookOpen className="h-3 w-3" />{t("guidesTab" as any)}</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3 w-3" />{t("aiAdvisor" as any)}</TabsTrigger>
          <TabsTrigger value="credit-cards" className="flex-1 gap-1"><CreditCard className="h-3 w-3" />{t("bankCreditTab" as any)}</TabsTrigger>
        </TabsList>

      {/* SINGLE overview tab — hero + budget + 50/30/20 + charts + transaction lists */}
      <TabsContent value="overview" className="space-y-4">
        <FinanceOverview entries={dashboardEntries} accounts={financialAccounts} isRtl={isRtl} />

        <Card className="border-sky-200/70 bg-sky-50/40 dark:bg-sky-950/10">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-sky-700 dark:text-sky-300">{isRtl ? "תכנון בלבד, לא הוצאה בפועל" : "Forecast only, not actual spending"}</p>
                <h3 className="text-lg font-semibold">{isRtl ? "תחזית עד סוף החודש" : "End-of-month forecast"}</h3>
              </div>
              <div className={`text-2xl font-bold ${cashFlowForecast.projectedBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                ₪{cashFlowForecast.projectedBalance.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "יתרה נזילה כעת" : "Liquid now"}</p><strong>₪{cashFlowForecast.liquidBalance.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "הכנסות מתוכננות" : "Planned income"}</p><strong className="text-emerald-600">+₪{cashFlowForecast.plannedIncome.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "הוצאות קבועות" : "Recurring expenses"}</p><strong className="text-red-600">-₪{cashFlowForecast.recurringExpenses.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "הוצאות חד־פעמיות" : "One-off expenses"}</p><strong className="text-red-600">-₪{cashFlowForecast.oneOffExpenses.toLocaleString()}</strong></div>
            </div>
            {cashFlowForecast.upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{isRtl ? "האירועים הבאים שנכללו בתחזית" : "Upcoming items included in the forecast"}</p>
                {cashFlowForecast.upcoming.slice(0, 5).map(({ payment, occurrence }) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm">
                    <span className="truncate">{payment.title} · {format(occurrence, "dd/MM")}</span>
                    <strong className={payment.payment_type === "income" ? "text-emerald-600" : "text-red-600"}>{payment.payment_type === "income" ? "+" : "-"}₪{payment.amount.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <FinanceInsights
          entries={dashboardEntries}
          isRtl={isRtl}
          onCreateRecurring={(entry) => {
            const fullEntry = dashboardEntries.find((candidate) => candidate.id === entry.id);
            if (fullEntry) void handleToggleRecurring(fullEntry);
          }}
        />

        {/* Budget Target */}
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><PiggyBank className="h-4 w-4 text-primary" />{t("budgetTarget" as any)}</h3>
              <div className="flex gap-1">
                {(["weekly", "monthly", "quarterly", "yearly"] as const).map(p => (
                  <button key={p} onClick={() => setBudgetPeriod(p)} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${budgetPeriod === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {getBudgetPeriodLabel(p)}
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
                  <span>{t("spentLabel" as any)}: ₪{periodSpending.toLocaleString()}</span>
                  <span>{t("targetLabel" as any)}: ₪{budgetTarget.toLocaleString()}</span>
                </div>
                <Progress value={Math.min((periodSpending / budgetTarget) * 100, 100)} className={`h-3 ${periodSpending > budgetTarget ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
                <div className="flex justify-between mt-2">
                  <span className={`text-sm font-semibold ${periodSpending > budgetTarget ? "text-destructive" : "text-primary"}`}>
                    {periodSpending > budgetTarget ? `${t("budgetExceeded" as any)} ₪${(periodSpending - budgetTarget).toLocaleString()} ⚠️` : `${t("budgetRemaining" as any)} ₪${(budgetTarget - periodSpending).toLocaleString()} ✅`}
                  </span>
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => { setEditingBudget(true); setBudgetInput(String(budgetTarget)); }}>{t("editing" as any)}</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("savingsNotCounted" as any)}
                </p>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setEditingBudget(true)}>
                <Plus className="h-3 w-3" />{t("setBudgetTarget" as any)} {getBudgetPeriodLabel(budgetPeriod)}
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
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" />{t("expenseBreakdown" as any)}</h3>
              <div className="space-y-2">
                {categoryBreakdown.map(([cat, amt]) => {
                  const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
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
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <BudgetCharts payments={dashboardEntries.filter(entry => entry.payment_type === "income" || !isSavingsCategory(entry.category)) as any} />

        {/* Fixed expenses */}
        {recurringExpenseEntries.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2" style={{ textAlign: isRtl ? "right" : "left" }}>
              {t("fixedExpenses" as any)}
              <Badge variant="outline" className="text-[10px]">{recurringExpenseEntries.length} | ₪{recurringExpenseEntries.reduce((s, p) => s + p.amount, 0).toLocaleString()}</Badge>
            </h3>
            {recurringExpenseEntries.map(p => renderEntryRow(p, "text-red-600"))}
          </div>
        )}

        {/* Variable expenses */}
        {spendingEntries.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground mt-3">{t("spendingAndTransactions" as any)}</h3>
            {spendingEntries.map(p => renderEntryRow(p, "text-red-600"))}
          </div>
        )}

        {/* Income */}
        {incomeEntries.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground mt-3">{t("income" as any)}</h3>
            {incomeEntries.map(p => renderEntryRow(p, "text-green-600"))}
          </div>
        )}

        {dashboardEntries.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <p className="text-muted-foreground">{t("noPaymentsYet" as any)}</p>
            <SampleDataImport type="payments" />
          </div>
        )}
      </TabsContent>

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
                  const cat = p.category || t("catOther" as any);
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

        <TabsContent value="add">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 border-amber-200 p-3 text-start"
                  onClick={() => {
                    setNewType("expense");
                    setNewRecurring(true);
                    setNewRecurringFrequency("monthly");
                    setNewDueDate(nextMonthlyOccurrence(null).toISOString().slice(0, 10));
                  }}
                >
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span><strong className="block">{isRtl ? "הוצאה קבועה חיצונית" : "External recurring expense"}</strong><small className="font-normal text-muted-foreground">{isRtl ? "הלוואה, שכירות או חיוב שלא מופיע בחיבור" : "A loan, rent or unconnected charge"}</small></span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 border-sky-200 p-3 text-start"
                  onClick={() => {
                    setNewType("expense");
                    setNewRecurring(false);
                    setNewDueDate("");
                  }}
                >
                  <Lightbulb className="h-4 w-4 text-sky-600" />
                  <span><strong className="block">{isRtl ? "הוצאה עתידית חד־פעמית" : "One-off future expense"}</strong><small className="font-normal text-muted-foreground">{isRtl ? "טיסה, רכישה גדולה או אירוע עתידי" : "A flight, major purchase or future event"}</small></span>
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{isRtl ? "הפריטים ייכנסו לתחזית בלבד. הם ייחשבו כהוצאה בפועל רק לאחר סימון ששולמו." : "These items affect the forecast only and become actual spending only after being marked paid."}</p>
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
              {newRecurring && (
                <Select value={newRecurringFrequency} onValueChange={setNewRecurringFrequency}>
                  <SelectTrigger><SelectValue placeholder={t("frequency" as any) || "תדירות"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("monthlyPeriod" as any) || "חודשי"}</SelectItem>
                    <SelectItem value="weekly">{t("weeklyPeriod" as any) || "שבועי"}</SelectItem>
                    <SelectItem value="quarterly">{t("quarterlyPeriod" as any) || "רבעוני"}</SelectItem>
                    <SelectItem value="yearly">{t("yearlyPeriod" as any) || "שנתי"}</SelectItem>
                  </SelectContent>
                </Select>
              )}
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

        <TabsContent value="ai" className="space-y-4">
          <Card className={proactiveFinanceInsights.requiresAttention ? "border-amber-200/80" : "border-emerald-200/80"}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2 ${proactiveFinanceInsights.requiresAttention ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {proactiveFinanceInsights.requiresAttention ? <AlertTriangle className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-primary">{isRtl ? "בדיקה אוטומטית" : "Automatic check"}</p>
                  <h3 className="font-semibold">{proactiveFinanceInsights.requiresAttention ? (isRtl ? "מצאתי נקודות שכדאי לבדוק" : "I found items worth reviewing") : (isRtl ? "לא מצאתי החלטה דחופה שדורשת אותך היום" : "No urgent decision needs you today")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{isRtl ? "התובנות מחושבות מהתנועות המסונכרנות ומהתכנון שהזנת, בלי לבצע פעולה בחשבון." : "Insights use synced transactions and your plans without taking any account action."}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{isRtl ? "יתרה חזויה בסוף החודש" : "Projected month-end balance"}</p>
                  <strong className={`mt-1 block text-lg ${cashFlowForecast.projectedBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>₪{cashFlowForecast.projectedBalance.toLocaleString()}</strong>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{isRtl ? "החיוב המתוכנן הקרוב" : "Next planned charge"}</p>
                  {proactiveFinanceInsights.nextUpcoming ? <><strong className="mt-1 block truncate">{proactiveFinanceInsights.nextUpcoming.payment.title}</strong><small className="text-muted-foreground">{format(proactiveFinanceInsights.nextUpcoming.occurrence, "dd/MM")} · ₪{proactiveFinanceInsights.nextUpcoming.payment.amount.toLocaleString()}</small></> : <strong className="mt-1 block text-emerald-600">{isRtl ? "אין חיוב מתוכנן" : "No planned charge"}</strong>}
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{isRtl ? "בדיקת חריגות" : "Anomaly check"}</p>
                  {proactiveFinanceInsights.categoryAnomaly ? <><strong className="mt-1 block truncate">{proactiveFinanceInsights.categoryAnomaly.category}</strong><small className="text-amber-700">{proactiveFinanceInsights.categoryAnomaly.ratio.toFixed(1)}× {isRtl ? "מהממוצע החודשי" : "monthly average"}</small></> : <strong className="mt-1 block text-emerald-600">{isRtl ? "לא זוהתה חריגה מהותית" : "No material anomaly"}</strong>}
                </div>
              </div>
              {proactiveFinanceInsights.unusualExpense && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/10">
                  <strong>{isRtl ? "הוצאה חריגה אצל ספק מוכר: " : "Unusual spend at a known merchant: "}{proactiveFinanceInsights.unusualExpense.entry.title}</strong>
                  <p className="mt-1 text-muted-foreground">₪{proactiveFinanceInsights.unusualExpense.entry.amount.toLocaleString()} {isRtl ? "לעומת ממוצע קודם של" : "versus a prior average of"} ₪{proactiveFinanceInsights.unusualExpense.average.toLocaleString(undefined, { maximumFractionDigits: 0 })}.</p>
                </div>
              )}
            </CardContent>
          </Card>
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
            <CloudFinanceConnector onChanged={fetchFinanceData} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentDashboard;
