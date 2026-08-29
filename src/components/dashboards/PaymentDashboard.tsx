import { useState, useEffect, useCallback, useMemo } from "react";
import { CloudFinanceConnector } from "@/components/dashboards/CloudFinanceConnector";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { invokeFinanceBackend } from "@/lib/financeBackend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AutocompleteInput from "@/components/AutocompleteInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CreditCard, TrendingUp, TrendingDown, DollarSign, Check, Calendar, Sparkles, MessageCircle, ChevronDown, ChevronUp, BookOpen, PiggyBank, AlertTriangle, Lightbulb, Wallet, BarChart3, Download, History, Pencil, X, EyeOff, Eye, Filter, Search, Gift, Ticket, Coins } from "lucide-react";
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
  recurrence_status: string;
  recurrence_end_date: string | null;
  recurrence_source_transaction_id: string | null;
  notes: string | null;
  sheet_name: string;
  archived: boolean;
  hidden: boolean;
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
  hidden?: boolean;
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
  recurrence_status: string | null;
  recurrence_end_date: string | null;
  recurrence_source_transaction_id: string | null;
  notes: string | null;
  sheet_name: string;
  archived: boolean;
  created_at: string;
}

interface ClubAsset {
  id: string;
  provider_name: string;
  asset_type: "voucher" | "points" | "benefit";
  label: string;
  balance: number;
  currency: string;
  expiry_date: string | null;
  notes: string | null;
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

function addForecastInterval(value: Date, frequency: string | null) {
  const next = new Date(value);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return dateOnly(next);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizeSalarySource(value: string) {
  return value
    .toLocaleLowerCase("he")
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transactionDisplayKey(transaction: FinancialTransaction) {
  const title = `${transaction.description || transaction.merchant || ""}`.toLocaleLowerCase("he").replace(/\s+/g, " ").trim();
  return [transaction.transaction_date?.slice(0, 10), transaction.direction, Number(transaction.amount).toFixed(2), title].join("|");
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
  {
    id: "monthly-review", icon: Calendar, title: { he: "בדיקה פיננסית חודשית", en: "Monthly money review" }, color: "text-cyan-700", bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
    sections: [
      { title: { he: "בדיקת עשר דקות", en: "Ten-minute review" }, content: { he: "עברו על החריגות, החיובים הקבועים והתחזית ל־90 יום. אשרו רק תנועות חוזרות שאתם מזהים ועדכנו הוצאה מתוכננת שהשתנתה.", en: "Review anomalies, recurring charges and the 90-day forecast. Confirm only recurring movements you recognize and update changed plans." } },
      { title: { he: "יעד אחד לחודש הבא", en: "One target for next month" }, content: { he: "בחרו קטגוריה אחת בלבד לצמצום וקבעו סכום מדיד. יעד ממוקד קל יותר לביצוע מקיצוץ כללי בכל ההוצאות.", en: "Choose one category to reduce and set a measurable amount. A focused target is easier than broad cuts." } },
    ],
  },
  {
    id: "fixed-costs", icon: Wallet, title: { he: "צמצום הוצאות קבועות", en: "Reduce fixed costs" }, color: "text-rose-700", bgColor: "bg-rose-50 dark:bg-rose-950/20",
    sections: [
      { title: { he: "מנויים וביטוחים", en: "Subscriptions and insurance" }, content: { he: "רכזו חיובים חוזרים לפי ספק, בטלו כפילויות ובקשו הצעה חדשה אחת לשנה. אל תבטלו ביטוח בלי לבדוק את הכיסוי החלופי.", en: "Group recurring charges by merchant, cancel duplicates and request new quotes annually. Do not cancel insurance before checking replacement coverage." } },
      { title: { he: "חובות בריבית גבוהה", en: "High-interest debt" }, content: { he: "הפנו עודף קודם לחוב היקר ביותר, תוך שמירה על כרית חירום בסיסית. בדקו עמלות פירעון לפני שינוי הלוואה.", en: "Direct surplus to the highest-cost debt while keeping a basic emergency buffer. Check early-repayment fees first." } },
    ],
  },
  {
    id: "income-growth", icon: TrendingUp, title: { he: "רעיונות להגדלת הכנסה", en: "Ideas to grow income" }, color: "text-emerald-700", bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    sections: [
      { title: { he: "הכנסה מהמיומנות הקיימת", en: "Monetize an existing skill" }, content: { he: "בחרו שירות קטן שאפשר לספק בערב או בסוף שבוע, הגדירו תוצאה ומחיר קבועים ופנו לשלושה לקוחות פוטנציאליים בשבוע.", en: "Package one existing skill into a small fixed-scope service and contact three potential customers each week." } },
      { title: { he: "שיפור שכר בעבודה", en: "Improve employment income" }, content: { he: "תעדו הישגים כספיים או תפעוליים במשך חודש, השוו שכר שוק ובקשו שיחת שכר עם יעד מספרי ותוכנית חלופית.", en: "Document measurable results for a month, benchmark the market and request a salary discussion with a numeric target and fallback plan." } },
      { title: { he: "זהירות מהבטחות מהירות", en: "Avoid quick-money promises" }, content: { he: "העדיפו הכנסה המבוססת על לקוח, מוצר או עבודה אמיתיים. אל תעבירו כסף מראש להצעה שמבטיחה תשואה או הכנסה ללא סיכון.", en: "Prefer income tied to real work, customers or products. Avoid offers requiring upfront payment for risk-free returns." } },
    ],
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
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState("");
  const [newRecurringFrequency, setNewRecurringFrequency] = useState("monthly");
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [clubAssets, setClubAssets] = useState<ClubAsset[]>([]);
  const [clubProvider, setClubProvider] = useState("");
  const [clubAssetType, setClubAssetType] = useState<ClubAsset["asset_type"]>("voucher");
  const [clubLabel, setClubLabel] = useState("");
  const [clubBalance, setClubBalance] = useState("");
  const [clubExpiry, setClubExpiry] = useState("");

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

    const [paymentsResult, accountsResult, cloudFinanceResult] = await Promise.all([
      supabase
        .from("payment_tracking")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_accounts")
        .select("id, external_account_id, provider_name, account_type, display_name, masked_number, currency, current_balance, available_balance")
        .eq("user_id", user.id),
      invokeFinanceBackend<{ transactions?: FinancialTransaction[]; accounts?: FinancialAccount[] }>("list")
        .catch(() => ({ transactions: [], accounts: [] })),
    ]);

    let transactionsResult = await supabase
      .from("financial_transactions")
      .select("id, amount, category, subcategory, direction, description, merchant, transaction_date, created_at, provider, source_type, raw_data, hidden")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });

    // The original Tabro database may not have the display-only `hidden` column.
    // Falling back keeps historical and cloud data visible without mutating either store.
    if (transactionsResult.error) {
      const fallbackResult = await supabase
        .from("financial_transactions")
        .select("id, amount, category, subcategory, direction, description, merchant, transaction_date, created_at, provider, source_type, raw_data")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });
      transactionsResult = {
        ...fallbackResult,
        data: fallbackResult.data?.map((transaction) => ({ ...transaction, hidden: false })) ?? null,
      } as typeof transactionsResult;
    }

    if (paymentsResult.error) console.warn("Payment tracking is unavailable; continuing with synced finance data", paymentsResult.error);
    if (transactionsResult.error) console.warn("Legacy finance history is unavailable; continuing with cloud finance data", transactionsResult.error);
    if (accountsResult.error) console.warn("Legacy finance accounts are unavailable; continuing with cloud finance data", accountsResult.error);

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
    const deduplicatedTransactions = new Map<string, FinancialTransaction>();
    [...cloudTransactions, ...legacyTransactions].forEach((transaction) => {
      const key = transactionDisplayKey(transaction);
      if (!deduplicatedTransactions.has(key)) deduplicatedTransactions.set(key, transaction);
    });
    setTransactions([...deduplicatedTransactions.values()]);
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
  }, [user]);

  useEffect(() => { fetchFinanceData(); }, [fetchFinanceData]);

  const fetchClubAssets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("finance_club_assets").select("*").eq("user_id", user.id).eq("archived", false).order("expiry_date", { ascending: true, nullsFirst: false });
    setClubAssets((data as ClubAsset[]) || []);
  }, [user]);

  useEffect(() => { void fetchClubAssets(); }, [fetchClubAssets]);

  const addClubAsset = async () => {
    if (!user || !clubProvider.trim() || !clubLabel.trim()) return;
    const { error } = await supabase.from("finance_club_assets").insert({
      user_id: user.id,
      provider_name: clubProvider.trim(),
      asset_type: clubAssetType,
      label: clubLabel.trim(),
      balance: Number(clubBalance) || 0,
      currency: clubAssetType === "points" ? "POINTS" : "ILS",
      expiry_date: clubExpiry || null,
    });
    if (error) { toast.error(t("error" as any)); return; }
    setClubProvider(""); setClubLabel(""); setClubBalance(""); setClubExpiry("");
    await fetchClubAssets();
    toast.success(isRtl ? "התו או ההטבה נוספו" : "Club asset added");
  };

  const removeClubAsset = async (id: string) => {
    await supabase.from("finance_club_assets").update({ archived: true }).eq("id", id);
    setClubAssets((current) => current.filter((asset) => asset.id !== id));
  };

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
      const updates: any = { category: editCategory || null, notes: editNotes || null, recurrence_end_date: editRecurrenceEndDate || null };
      if (parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0) updates.amount = parsedAmount;
      await supabase.from("payment_tracking").update(updates).eq("id", entry.id);
      setPayments(prev => prev.map(p => p.id === entry.id ? { ...p, ...updates } : p));
    } else if (entry.source === "cloud_financial_transactions") {
      const updates: Record<string, unknown> = { category: editCategory || null, subcategory: editSubcategory || null };
      if (parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0) updates.amount = parsedAmount;
      await invokeFinanceBackend("update_transaction", {
        transactionId: entry.id.replace(/^cloud:/, ""),
        ...updates,
      });
      setTransactions(prev => prev.map(item => item.id === entry.id ? { ...item, ...updates } : item));
    } else {
      const updates: any = { category: editCategory || null, subcategory: editSubcategory || null };
      if (parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0) updates.amount = parsedAmount;
      await supabase.from("financial_transactions").update(updates).eq("id", entry.id);
      setTransactions(prev => prev.map(t => t.id === entry.id ? { ...t, ...updates } : t));
    }
    setEditingEntryId(null);
    toast.success(t("save" as any));
  };

  const setTransactionHidden = async (entry: DashboardEntry, hidden: boolean) => {
    if (entry.source === "payment_tracking") return;
    if (entry.source === "cloud_financial_transactions") {
      await invokeFinanceBackend("update_transaction", { transactionId: entry.id.replace(/^cloud:/, ""), hidden });
    } else {
      await supabase.from("financial_transactions").update({ hidden }).eq("id", entry.id);
    }
    setTransactions((current) => current.map((item) => item.id === entry.id ? { ...item, hidden } : item));
    toast.success(hidden ? (isRtl ? "התנועה הוסתרה מהדוחות" : "Transaction hidden from reports") : (isRtl ? "התנועה הוחזרה לדוחות" : "Transaction restored"));
  };

  const handleToggleRecurring = async (entry: DashboardEntry) => {
    if (entry.source === "payment_tracking") {
      const newRecurring = !entry.recurring;
      const recurrenceStatus = newRecurring ? "active" : "paused";
      await supabase.from("payment_tracking").update({ recurring: newRecurring, recurrence_status: recurrenceStatus }).eq("id", entry.id);
      setPayments(prev => prev.map(p => p.id === entry.id ? { ...p, recurring: newRecurring, recurrence_status: recurrenceStatus } : p));
      toast.success(newRecurring ? t("fixedPayment" as any) : t("variableExpenses" as any));
    } else if (entry.source === "financial_transactions" || entry.source === "cloud_financial_transactions") {
      if (payments.some((payment) => payment.recurring && (payment.recurrence_source_transaction_id === entry.id || payment.title === entry.title))) {
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
        recurrence_status: "active",
        recurrence_source_transaction_id: entry.id,
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
      recurrence_status: payment.recurrence_status || (payment.recurring ? "active" : null),
      recurrence_end_date: payment.recurrence_end_date || null,
      recurrence_source_transaction_id: payment.recurrence_source_transaction_id || null,
      notes: payment.notes,
      sheet_name: payment.sheet_name,
      archived: payment.archived,
      hidden: false,
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
      recurrence_status: null,
      recurrence_end_date: null,
      recurrence_source_transaction_id: null,
      notes: null,
      sheet_name: "actual",
      archived: false,
      hidden: Boolean(transaction.hidden),
      created_at: transaction.transaction_date || transaction.created_at,
      });
    });

    return [...importedEntries, ...plannedEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [payments, transactions, financialAccounts, t]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([viewMonth]);
    dashboardEntries.forEach((entry) => {
      const date = new Date(entry.due_date || entry.created_at);
      if (!Number.isNaN(date.getTime())) keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    });
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [dashboardEntries, viewMonth]);

  const accountOptions = useMemo(() => [...new Set(dashboardEntries
    .filter((entry) => entry.account_label || entry.account_last_four)
    .map((entry) => `${entry.account_label || (isRtl ? "חשבון" : "Account")}${entry.account_last_four ? ` •••• ${entry.account_last_four}` : ""}`))]
    .sort(), [dashboardEntries, isRtl]);

  const categoryOptions = useMemo(() => [...new Set(dashboardEntries.map((entry) => entry.category).filter(Boolean) as string[])].sort(), [dashboardEntries]);

  const filteredViewEntries = useMemo(() => {
    const query = transactionSearch.trim().toLocaleLowerCase(lang === "he" ? "he" : "en");
    return dashboardEntries.filter((entry) => {
      const date = new Date(entry.due_date || entry.created_at);
      const entryMonth = Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const accountName = `${entry.account_label || (isRtl ? "חשבון" : "Account")}${entry.account_last_four ? ` •••• ${entry.account_last_four}` : ""}`;
      if (entryMonth !== viewMonth) return false;
      if (!showHidden && entry.hidden) return false;
      if (sourceFilter !== "all" && entry.source_channel !== sourceFilter) return false;
      if (accountFilter !== "all" && accountName !== accountFilter) return false;
      if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
      if (query && !`${entry.title} ${entry.category || ""} ${entry.subcategory || ""} ${accountName}`.toLocaleLowerCase(lang === "he" ? "he" : "en").includes(query)) return false;
      return true;
    });
  }, [accountFilter, categoryFilter, dashboardEntries, isRtl, lang, showHidden, sourceFilter, transactionSearch, viewMonth]);

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
      if (entry.hidden) return false;
      // Use due_date (actual transaction/payment date) instead of created_at
      const dateStr = entry.due_date || entry.created_at;
      const entryDate = new Date(dateStr);
      if (budgetPeriod === "weekly") {
        return entryDate >= weekRange.start && entryDate <= weekRange.end;
      }
      if (budgetPeriod === "monthly") {
        return `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}` === viewMonth;
      }
      if (budgetPeriod === "quarterly") {
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999);
        return entryDate >= qStart && entryDate <= qEnd;
      }
      return entryDate.getFullYear() === now.getFullYear();
    });
  }, [dashboardEntries, budgetPeriod, viewMonth, weekRange]);

  // Financial calculations
  const visiblePeriodEntries = useMemo(() => periodFilteredEntries.filter((entry) => !entry.hidden), [periodFilteredEntries]);
  const totalExpenses = useMemo(() => visiblePeriodEntries.filter(p => p.payment_type === "expense").reduce((s, p) => s + p.amount, 0), [visiblePeriodEntries]);
  const totalIncome = useMemo(() => visiblePeriodEntries.filter(p => p.payment_type === "income").reduce((s, p) => s + p.amount, 0), [visiblePeriodEntries]);
  const totalSpending = useMemo(() => visiblePeriodEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category)).reduce((s, p) => s + p.amount, 0), [visiblePeriodEntries, isSavingsCategory]);
  // Period-filtered spending for budget comparison (excludes fixed/recurring)
  const periodSpending = useMemo(() => periodFilteredEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category) && !p.recurring).reduce((s, p) => s + p.amount, 0), [periodFilteredEntries, isSavingsCategory]);
  const dedicatedSavings = useMemo(() => visiblePeriodEntries.filter(p => p.payment_type === "expense" && isSavingsCategory(p.category)).reduce((s, p) => s + p.amount, 0), [visiblePeriodEntries, isSavingsCategory]);
  const balance = totalIncome - totalExpenses;
  const availableToSave = totalIncome - totalSpending;
  const unpaidExpenses = useMemo(() => visiblePeriodEntries.filter(p => p.payment_type === "expense" && !p.paid).reduce((s, p) => s + p.amount, 0), [visiblePeriodEntries]);
  const fixedExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense" && p.recurring && p.recurrence_status !== "paused" && p.recurrence_status !== "ended").reduce((s, p) => s + p.amount, 0), [payments]);
  const variableExpenses = Math.max(totalSpending - fixedExpenses, 0);
  const recurringExpenseEntries = useMemo(() => dashboardEntries.filter(p => p.payment_type === "expense" && p.recurring), [dashboardEntries]);

  const estimatedSalary = useMemo(() => {
    const salaryPattern = /משכורת|שכר|salary|payroll|עובדי\s*מדינ/i;
    const historicalIncome = dashboardEntries
      .filter((entry) => {
        if (entry.hidden || !entry.paid || entry.payment_type !== "income") return false;
        const date = new Date(entry.due_date || entry.created_at);
        if (Number.isNaN(date.getTime()) || date > new Date()) return false;
        return Math.abs(entry.amount) >= 500;
      })
      .sort((a, b) => new Date(b.due_date || b.created_at).getTime() - new Date(a.due_date || a.created_at).getTime());

    const grouped = new Map<string, DashboardEntry[]>();
    historicalIncome.forEach((entry) => {
      const searchable = `${entry.title} ${entry.category || ""} ${entry.subcategory || ""}`;
      const normalized = normalizeSalarySource(entry.title)
        .toLocaleLowerCase()
        .replace(/\d+/g, "")
        .replace(/[^\p{L}]+/gu, " ")
        .trim();
      const key = salaryPattern.test(searchable) ? `salary:${normalized || "known"}` : `income:${normalized}`;
      grouped.set(key, [...(grouped.get(key) || []), entry]);
    });

    const candidates = [...grouped.entries()].map(([key, entries]) => {
      const byMonth = new Map<string, DashboardEntry>();
      entries.forEach((entry) => {
        const date = new Date(entry.due_date || entry.created_at);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const current = byMonth.get(monthKey);
        if (!current || Math.abs(entry.amount) > Math.abs(current.amount)) byMonth.set(monthKey, entry);
      });
      const samples = [...byMonth.values()]
        .sort((a, b) => new Date(b.due_date || b.created_at).getTime() - new Date(a.due_date || a.created_at).getTime())
        .slice(0, 6);
      return { key, samples, explicit: key.startsWith("salary:") };
    }).filter((candidate) => candidate.samples.length >= (candidate.explicit ? 1 : 2));

    const chosen = candidates.sort((a, b) => Number(b.explicit) - Number(a.explicit)
      || b.samples.length - a.samples.length
      || Math.abs(b.samples[0]?.amount || 0) - Math.abs(a.samples[0]?.amount || 0))[0];
    if (!chosen) return null;
    const samples = chosen.samples;
    const amounts = samples.map((entry) => Math.abs(entry.amount));
    const typicalAmount = median(amounts);
    const spread = Math.max(...amounts) - Math.min(...amounts);
    if (typicalAmount <= 0 || (!chosen.explicit && spread / typicalAmount > 0.6)) return null;

    const latest = samples[0];
    return {
      amount: Math.round(typicalAmount * 100) / 100,
      day: Math.round(median(samples.map((entry) => new Date(entry.due_date || entry.created_at).getDate()))),
      source: normalizeSalarySource(latest.title) || (isRtl ? "משכורת" : "Salary"),
      samples: samples.length,
    };
  }, [dashboardEntries, isRtl]);

  const cashFlowForecast = useMemo(() => {
    const salaryPattern = /משכורת|שכר|salary|payroll|עובדי\s*מדינ/i;
    const now = dateOnly(new Date());
    const horizonEnd = dateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90));
    const uniqueAccounts = new Map<string, FinancialAccount>();
    financialAccounts.forEach((account) => {
      const key = `${account.provider_name || ""}:${account.external_account_id}`;
      if (!uniqueAccounts.has(key)) uniqueAccounts.set(key, account);
    });
    const liquidBalance = [...uniqueAccounts.values()]
      .filter((account) => account.account_type?.toUpperCase() !== "CARD" && (!account.currency || account.currency === "ILS"))
      .reduce((sum, account) => sum + (account.available_balance ?? account.current_balance ?? 0), 0);

    const plannedUpcoming = payments.flatMap((payment) => {
      if (payment.recurrence_status === "paused" || payment.recurrence_status === "ended") return [];
      if (!payment.due_date || (!payment.recurring && payment.paid)) return [];
      const sourceDate = dateOnly(new Date(payment.due_date));
      if (Number.isNaN(sourceDate.getTime())) return [];
      if (!payment.recurring) {
        return sourceDate >= now && sourceDate <= horizonEnd ? [{ payment, occurrence: sourceDate }] : [];
      }

      let occurrence = payment.recurring_frequency === "monthly"
        ? nextMonthlyOccurrence(payment.due_date, now)
        : sourceDate;
      while (occurrence < now) occurrence = addForecastInterval(occurrence, payment.recurring_frequency);
      const occurrences = [];
      const recurrenceEnd = payment.recurrence_end_date ? dateOnly(new Date(payment.recurrence_end_date)) : null;
      while (occurrence <= horizonEnd && (!recurrenceEnd || occurrence <= recurrenceEnd)) {
        occurrences.push({ payment, occurrence });
        occurrence = addForecastInterval(occurrence, payment.recurring_frequency);
      }
      return occurrences;
    });

    const estimatedSalaryUpcoming: Array<{ payment: Payment; occurrence: Date }> = [];
    if (estimatedSalary) {
      let occurrence = new Date(now.getFullYear(), now.getMonth(), Math.min(estimatedSalary.day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()), 12);
      if (occurrence < now) occurrence = addForecastInterval(occurrence, "monthly");
      while (occurrence <= horizonEnd) {
        const monthHasPlannedSalary = plannedUpcoming.some(({ payment, occurrence: plannedDate }) =>
          payment.payment_type === "income"
          && plannedDate.getFullYear() === occurrence.getFullYear()
          && plannedDate.getMonth() === occurrence.getMonth()
          && (salaryPattern.test(`${payment.title} ${payment.category || ""}`)
            || Math.abs(payment.amount - estimatedSalary.amount) <= estimatedSalary.amount * 0.35),
        );
        if (!monthHasPlannedSalary) {
          estimatedSalaryUpcoming.push({
            payment: {
              id: `estimated-salary-${format(occurrence, "yyyy-MM")}`,
              title: isRtl ? `משכורת משוערת · ${estimatedSalary.source}` : `Estimated salary · ${estimatedSalary.source}`,
              amount: estimatedSalary.amount,
              currency: "ILS",
              category: isRtl ? "משכורת" : "Salary",
              payment_type: "income",
              payment_method: "forecast",
              due_date: format(occurrence, "yyyy-MM-dd"),
              paid: false,
              recurring: true,
              recurring_frequency: "monthly",
              recurrence_status: "estimated",
              recurrence_end_date: null,
              recurrence_source_transaction_id: null,
              notes: isRtl ? `ממוצע של ${estimatedSalary.samples} חודשי משכורת` : `Average of ${estimatedSalary.samples} salary months`,
              sheet_name: "forecast",
              archived: false,
              hidden: false,
              created_at: new Date().toISOString(),
            },
            occurrence: new Date(occurrence),
          });
        }
        occurrence = addForecastInterval(occurrence, "monthly");
      }
    }

    const upcoming = [...plannedUpcoming, ...estimatedSalaryUpcoming]
      .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());

    let runningBalance = liquidBalance;
    const timeline = upcoming.map((item) => {
      runningBalance += item.payment.payment_type === "income" ? item.payment.amount : -item.payment.amount;
      return { ...item, runningBalance };
    });
    const projectedAt = (days: number) => {
      const end = new Date(now);
      end.setDate(end.getDate() + days);
      return timeline.filter((item) => item.occurrence <= end).at(-1)?.runningBalance ?? liquidBalance;
    };
    const plannedIncome = upcoming
      .filter(({ payment }) => payment.payment_type === "income")
      .reduce((sum, { payment }) => sum + payment.amount, 0);
    const recurringExpenses = upcoming
      .filter(({ payment }) => payment.payment_type === "expense" && payment.recurring)
      .reduce((sum, { payment }) => sum + payment.amount, 0);
    const oneOffExpenses = upcoming
      .filter(({ payment }) => payment.payment_type === "expense" && !payment.recurring)
      .reduce((sum, { payment }) => sum + payment.amount, 0);

    const lowestPoint = timeline.reduce(
      (lowest, item) => item.runningBalance < lowest.balance
        ? { balance: item.runningBalance, date: item.occurrence }
        : lowest,
      { balance: liquidBalance, date: now },
    );
    const todayItems = timeline.filter((item) => item.occurrence.getTime() === now.getTime());
    const tomorrow = dateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const tomorrowItems = timeline.filter((item) => item.occurrence.getTime() === tomorrow.getTime());

    return {
      liquidBalance,
      plannedIncome,
      recurringExpenses,
      oneOffExpenses,
      projectedBalance: projectedAt(90),
      upcoming: timeline,
      projected30: projectedAt(30),
      projected60: projectedAt(60),
      projected90: projectedAt(90),
      lowestPoint,
      todayItems,
      tomorrowItems,
      estimatedSalary,
    };
  }, [estimatedSalary, financialAccounts, isRtl, payments]);

  const proactiveFinanceInsights = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const actualExpenses = dashboardEntries.filter((entry) => !entry.hidden && entry.paid && entry.payment_type === "expense");
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
    visiblePeriodEntries.filter(p => p.payment_type === "expense" && !isSavingsCategory(p.category)).forEach(p => {
      const cat = p.category || t("catOther" as any);
      cats[cat] = (cats[cat] || 0) + p.amount;
    });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, [visiblePeriodEntries, isSavingsCategory, t]);

  // 50/30/20 rule calculation
  const needsPercent = totalIncome > 0 ? Math.round((fixedExpenses / totalIncome) * 100) : 0;
  const wantsPercent = totalIncome > 0 ? Math.round((variableExpenses / totalIncome) * 100) : 0;
  const savingsPercent = totalIncome > 0 ? Math.round((Math.max(availableToSave, 0) / totalIncome) * 100) : 0;

  // Monthly history breakdown
  const monthlyHistory = useMemo(() => {
    const months: Record<string, { income: number; expenses: number; items: DashboardEntry[] }> = {};
    dashboardEntries.filter((entry) => !entry.hidden).forEach(p => {
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
תחזית ל־90 יום: ₪${cashFlowForecast.projectedBalance.toLocaleString()}
הכנסות מתוכננות ומשוערות ל־90 יום: ₪${cashFlowForecast.plannedIncome.toLocaleString()}
הוצאות קבועות מתוכננות ל־90 יום: ₪${cashFlowForecast.recurringExpenses.toLocaleString()}
הוצאות חד-פעמיות מתוכננות ל־90 יום: ₪${cashFlowForecast.oneOffExpenses.toLocaleString()}
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
                {p.recurring && p.recurrence_status === "active" && <Badge className="bg-emerald-600 text-[9px]">{isRtl ? "אושר" : "Confirmed"}</Badge>}
                {p.recurrence_status === "paused" && <Badge variant="secondary" className="text-[9px]">{isRtl ? "מושהה" : "Paused"}</Badge>}
                {p.recurrence_end_date && <span className="text-[10px] text-muted-foreground">{isRtl ? "עד" : "Until"} {format(new Date(p.recurrence_end_date), "dd/MM/yy")}</span>}
                {p.hidden && <Badge variant="secondary" className="text-[9px]"><EyeOff className="me-1 h-3 w-3" />{isRtl ? "מוסתר" : "Hidden"}</Badge>}
              </div>
            </div>
            <span className={`font-bold text-sm whitespace-nowrap ${colorClass}`}>
              {p.payment_type === "income" ? "+" : "-"}₪{p.amount.toLocaleString()}
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
              if (isEditing) { setEditingEntryId(null); }
              else { setEditingEntryId(p.id); setEditCategory(p.category || ""); setEditSubcategory(p.subcategory || ""); setEditNotes(p.notes || ""); setEditAmount(String(p.amount)); setEditRecurrenceEndDate(p.recurrence_end_date || ""); }
            }}>
              {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3 text-muted-foreground" />}
            </Button>
            {p.source === "payment_tracking" ? (
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteEntry(p)}><Trash2 className="h-3 w-3" /></Button>
            ) : (
              <Button size="icon" variant="ghost" className="h-6 w-6" title={p.hidden ? (isRtl ? "הצג בדוחות" : "Show in reports") : (isRtl ? "הסתר מהדוחות" : "Hide from reports")} onClick={() => setTransactionHidden(p, !p.hidden)}>{p.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</Button>
            )}
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
              <Input placeholder={isRtl ? "תת־קטגוריה" : "Subcategory"} value={editSubcategory} onChange={e => setEditSubcategory(e.target.value)} className="h-8 text-xs w-[150px]" />
              {(p.source === "payment_tracking" || p.source === "financial_transactions" || p.source === "cloud_financial_transactions") && (
                <Input placeholder={t("notes" as any)} value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-8 text-xs flex-1 min-w-[120px]" />
              )}
              {/* Mark as fixed/recurring - works for both payment_tracking AND imported transactions */}
              <Button size="sm" variant={p.recurring ? "default" : "outline"} className="h-8 text-[10px] gap-1" onClick={() => handleToggleRecurring(p)}>
                {p.recurring ? (isRtl ? "השהה חיוב קבוע" : "Pause recurring") : t("fixedPayment" as any)}
              </Button>
              {p.source === "payment_tracking" && p.recurring && <Input type="date" title={isRtl ? "תאריך סיום" : "End date"} value={editRecurrenceEndDate} onChange={e => setEditRecurrenceEndDate(e.target.value)} className="h-8 text-xs w-[145px]" dir="ltr" />}
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
          <TabsTrigger value="clubs" className="flex-1 gap-1"><Gift className="h-3 w-3" />{isRtl ? "מועדונים ותווים" : "Clubs & vouchers"}</TabsTrigger>
        </TabsList>

      {/* SINGLE overview tab — hero + budget + 50/30/20 + charts + transaction lists */}
      <TabsContent value="overview" className="space-y-4">
        <Card className="border-primary/15">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-primary" />{isRtl ? "תצוגה וסינון" : "View and filters"}</h3>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSourceFilter("all"); setAccountFilter("all"); setCategoryFilter("all"); setTransactionSearch(""); setShowHidden(false); }}>{isRtl ? "נקה מסננים" : "Clear filters"}</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={viewMonth} onValueChange={setViewMonth}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map((month) => <SelectItem key={month} value={month}>{formatMonthLabel(month)}</SelectItem>)}</SelectContent></Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{isRtl ? "כל המקורות" : "All sources"}</SelectItem><SelectItem value="credit_card">{isRtl ? "כרטיסי אשראי" : "Credit cards"}</SelectItem><SelectItem value="bank">{isRtl ? "בנק והעברות" : "Bank and transfers"}</SelectItem><SelectItem value="manual">{isRtl ? "תכנון ידני" : "Manual plans"}</SelectItem></SelectContent></Select>
              <Select value={accountFilter} onValueChange={setAccountFilter}><SelectTrigger className="h-9"><SelectValue placeholder={isRtl ? "כל החשבונות והכרטיסים" : "All accounts and cards"} /></SelectTrigger><SelectContent><SelectItem value="all">{isRtl ? "כל החשבונות והכרטיסים" : "All accounts and cards"}</SelectItem>{accountOptions.map((account) => <SelectItem key={account} value={account}>{account}</SelectItem>)}</SelectContent></Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-9"><SelectValue placeholder={isRtl ? "כל הקטגוריות" : "All categories"} /></SelectTrigger><SelectContent><SelectItem value="all">{isRtl ? "כל הקטגוריות" : "All categories"}</SelectItem>{categoryOptions.map((category) => <SelectItem key={category} value={category}>{getCategoryLabel(category)}</SelectItem>)}</SelectContent></Select>
              <div className="relative"><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder={isRtl ? "חיפוש ספק או עסקה" : "Search merchant"} className="h-9 ps-9" /></div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />{isRtl ? "הצג גם תנועות שהוסתרו" : "Include hidden transactions"}</label>
          </CardContent>
        </Card>

        <FinanceOverview entries={dashboardEntries.filter((entry) => !entry.hidden)} accounts={financialAccounts} isRtl={isRtl} selectedMonth={viewMonth} />

        <Card className="border-sky-200/70 bg-sky-50/40 dark:bg-sky-950/10">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-sky-700 dark:text-sky-300">{isRtl ? "תכנון בלבד, לא הוצאה בפועל" : "Forecast only, not actual spending"}</p>
                <h3 className="text-lg font-semibold">{isRtl ? "תחזית תזרים ל־90 יום" : "90-day cash-flow forecast"}</h3>
              </div>
              <div className={`text-2xl font-bold ${cashFlowForecast.projectedBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                ₪{cashFlowForecast.projectedBalance.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "יתרה נזילה כעת" : "Liquid now"}</p><strong>₪{cashFlowForecast.liquidBalance.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "הכנסות צפויות ב־90 יום" : "Expected income · 90 days"}</p><strong className="text-emerald-600">+₪{cashFlowForecast.plannedIncome.toLocaleString()}</strong>{cashFlowForecast.estimatedSalary && <small className="mt-1 block text-emerald-700">{isRtl ? `כולל משכורת משוערת לפי ${cashFlowForecast.estimatedSalary.samples} חודשים` : `Includes salary estimate from ${cashFlowForecast.estimatedSalary.samples} months`}</small>}</div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "הוצאות קבועות ב־90 יום" : "Recurring expenses · 90 days"}</p><strong className="text-red-600">-₪{cashFlowForecast.recurringExpenses.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "הוצאות חד־פעמיות ב־90 יום" : "One-off expenses · 90 days"}</p><strong className="text-red-600">-₪{cashFlowForecast.oneOffExpenses.toLocaleString()}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "בעוד 30 יום" : "In 30 days"}</p><strong className={cashFlowForecast.projected30 >= 0 ? "text-emerald-600" : "text-red-600"}>₪{cashFlowForecast.projected30.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "בעוד 60 יום" : "In 60 days"}</p><strong className={cashFlowForecast.projected60 >= 0 ? "text-emerald-600" : "text-red-600"}>₪{cashFlowForecast.projected60.toLocaleString()}</strong></div>
              <div className="rounded-xl border bg-background/80 p-3"><p className="text-xs text-muted-foreground">{isRtl ? "בעוד 90 יום" : "In 90 days"}</p><strong className={cashFlowForecast.projected90 >= 0 ? "text-emerald-600" : "text-red-600"}>₪{cashFlowForecast.projected90.toLocaleString()}</strong></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:bg-amber-950/20"><p className="text-xs text-amber-700">{isRtl ? "נקודת שפל צפויה" : "Projected low point"}</p><strong className={cashFlowForecast.lowestPoint.balance >= 0 ? "text-amber-700" : "text-red-600"}>₪{cashFlowForecast.lowestPoint.balance.toLocaleString()}</strong><small className="block text-muted-foreground">{format(cashFlowForecast.lowestPoint.date, "dd/MM/yyyy")}</small></div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                { label: isRtl ? "היום" : "Today", items: cashFlowForecast.todayItems },
                { label: isRtl ? "מחר" : "Tomorrow", items: cashFlowForecast.tomorrowItems },
              ].map((period) => (
                <div key={period.label} className="rounded-xl border bg-background/80 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{period.label}</p>
                  {period.items.length ? period.items.map(({ payment, occurrence }) => (
                    <div key={`${payment.id}:${occurrence.toISOString()}`} className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{payment.title}</span>
                      <strong className={payment.payment_type === "income" ? "text-emerald-600" : "text-red-600"}>{payment.payment_type === "income" ? "+" : "-"}₪{payment.amount.toLocaleString()}</strong>
                    </div>
                  )) : <p className="mt-2 text-sm text-emerald-700">{isRtl ? "אין תנועה מתוכננת" : "No planned movement"}</p>}
                </div>
              ))}
            </div>
            {cashFlowForecast.upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{isRtl ? "צפי תנועות ויתרה לאחר כל תנועה" : "Expected movements and running balance"}</p>
                {cashFlowForecast.upcoming.slice(0, 10).map(({ payment, occurrence, runningBalance }) => (
                  <div key={`${payment.id}:${occurrence.toISOString()}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground">{format(occurrence, "dd/MM")}</span>
                    <span className="truncate">{payment.title}</span>
                    <span className="text-end"><strong className={payment.payment_type === "income" ? "text-emerald-600" : "text-red-600"}>{payment.payment_type === "income" ? "+" : "-"}₪{payment.amount.toLocaleString()}</strong><small className="block text-muted-foreground">{isRtl ? "יתרה" : "Balance"} ₪{runningBalance.toLocaleString()}</small></span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{isRtl ? "התחזית כוללת רק חיובים והכנסות קבועים או מתוכננים שאושרו. הוצאות משתנות אינן מחושבות." : "The forecast includes only confirmed recurring or planned movements. Variable spending is not included."}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <FinanceInsights
          entries={dashboardEntries.filter((entry) => !entry.hidden)}
          isRtl={isRtl}
          confirmedRecurringTitles={payments.filter((payment) => payment.recurring && payment.recurrence_status === "active").map((payment) => payment.title)}
          onCategorySelect={(category) => { setCategoryFilter("all"); setTransactionSearch(category); setTransactionsOpen(true); }}
          onCreateRecurring={(entry) => {
            const fullEntry = dashboardEntries.find((candidate) => candidate.id === entry.id);
            if (fullEntry) void handleToggleRecurring(fullEntry);
          }}
        />

        <Collapsible open={transactionsOpen} onOpenChange={setTransactionsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-between p-4 text-start">
                <span><strong className="block">{isRtl ? "תנועות בתקופה שנבחרה" : "Transactions in selected period"}</strong><small className="text-muted-foreground">{filteredViewEntries.length} {isRtl ? "תנועות לאחר סינון" : "filtered transactions"}</small></span>
                {transactionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2 border-t pt-4">
                {filteredViewEntries.slice(0, 100).map((entry) => renderEntryRow(entry, entry.payment_type === "income" ? "text-emerald-600" : "text-red-600"))}
                {!filteredViewEntries.length && <p className="py-6 text-center text-sm text-muted-foreground">{isRtl ? "לא נמצאו תנועות במסננים שנבחרו." : "No transactions match the selected filters."}</p>}
                {filteredViewEntries.length > 100 && <p className="text-center text-xs text-muted-foreground">{isRtl ? "מוצגות 100 התנועות הראשונות. צמצם את המסננים להצגה מדויקת יותר." : "Showing the first 100 transactions. Narrow the filters for more detail."}</p>}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

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
                {categoryBreakdown.slice(0, 8).map(([cat, amt]) => {
                  const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                  return (
                    <button type="button" key={cat} className="block w-full rounded-lg p-1 text-start hover:bg-muted/50" onClick={() => { setCategoryFilter(cat); setTransactionSearch(""); setTransactionsOpen(true); }}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{getCategoryLabel(cat)}</span>
                        <span className="font-medium">₪{amt.toLocaleString()} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <BudgetCharts payments={visiblePeriodEntries.filter(entry => entry.payment_type === "income" || !isSavingsCategory(entry.category)) as any} />

        {/* Fixed expenses */}
        {recurringExpenseEntries.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2" style={{ textAlign: isRtl ? "right" : "left" }}>
              {t("fixedExpenses" as any)}
              <Badge variant="outline" className="text-[10px]">{recurringExpenseEntries.length} | ₪{recurringExpenseEntries.reduce((s, p) => s + p.amount, 0).toLocaleString()}</Badge>
            </h3>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pe-1">{recurringExpenseEntries.map(p => renderEntryRow(p, "text-red-600"))}</div>
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
                    <span className={`font-semibold flex-1 ${isRtl ? "text-right" : "text-left"}`}>{"title" in guide ? guide.title[isRtl ? "he" : "en"] : t(guide.titleKey as any)}</span>
                    {expandedGuide === guide.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2 px-2">
                  {guide.sections.map((section, i) => (
                    <Card key={i} className="border-muted">
                      <CardContent className="py-3 px-4">
                        <h4 className="font-semibold text-sm mb-1">{"title" in section ? section.title[isRtl ? "he" : "en"] : t(section.titleKey as any)}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{"content" in section ? section.content[isRtl ? "he" : "en"] : t(section.contentKey as any)}</p>
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

        <TabsContent value="clubs" className="space-y-4">
          <Card className="overflow-hidden border-amber-200/70">
            <CardHeader className="bg-gradient-to-l from-amber-50 to-background">
              <CardTitle className="flex items-center gap-2 text-base"><Gift className="h-5 w-5 text-amber-600" />{isRtl ? "מועדונים, תווים ונקודות" : "Clubs, vouchers and points"}</CardTitle>
              <CardDescription>{isRtl ? "החיבורים המסונכרנים נשארים באזור בנק ואשראי. כאן מנהלים יתרות והטבות שלא מגיעות כתנועה בנקאית." : "Synced connections remain under Bank & Credit. Track benefits that do not appear as bank transactions here."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Input value={clubProvider} onChange={(event) => setClubProvider(event.target.value)} placeholder={isRtl ? "שם המועדון, למשל ביחד בשבילך" : "Club name"} />
                <Select value={clubAssetType} onValueChange={(value) => setClubAssetType(value as ClubAsset["asset_type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="voucher">{isRtl ? "תו כספי" : "Voucher"}</SelectItem><SelectItem value="points">{isRtl ? "נקודות" : "Points"}</SelectItem><SelectItem value="benefit">{isRtl ? "הטבה" : "Benefit"}</SelectItem></SelectContent></Select>
                <Input value={clubLabel} onChange={(event) => setClubLabel(event.target.value)} placeholder={isRtl ? "שם התו או ההטבה" : "Asset label"} />
                <Input type="number" value={clubBalance} onChange={(event) => setClubBalance(event.target.value)} placeholder={isRtl ? "יתרה או נקודות" : "Balance or points"} dir="ltr" />
                <Input type="date" value={clubExpiry} onChange={(event) => setClubExpiry(event.target.value)} title={isRtl ? "תאריך תפוגה" : "Expiry date"} dir="ltr" />
              </div>
              <Button onClick={addClubAsset} disabled={!clubProvider.trim() || !clubLabel.trim()} className="gap-2"><Plus className="h-4 w-4" />{isRtl ? "הוסף למועדונים שלי" : "Add club asset"}</Button>
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubAssets.map((asset) => {
              const Icon = asset.asset_type === "points" ? Coins : asset.asset_type === "voucher" ? Ticket : Gift;
              const expired = asset.expiry_date ? new Date(asset.expiry_date) < new Date() : false;
              return <Card key={asset.id} className={expired ? "border-red-200 opacity-75" : "border-amber-200/60"}><CardContent className="p-4">
                <div className="flex items-start justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><Icon className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate">{asset.label}</strong><small className="text-muted-foreground">{asset.provider_name}</small></span></span><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeClubAsset(asset.id)}><Trash2 className="h-3.5 w-3" /></Button></div>
                <p className="mt-4 text-2xl font-bold">{asset.asset_type === "points" ? `${asset.balance.toLocaleString()} ${isRtl ? "נק׳" : "pts"}` : `₪${asset.balance.toLocaleString()}`}</p>
                {asset.expiry_date && <p className={`mt-1 text-xs ${expired ? "text-red-600" : "text-muted-foreground"}`}>{expired ? (isRtl ? "פג תוקף" : "Expired") : (isRtl ? "בתוקף עד" : "Valid until")} {new Date(asset.expiry_date).toLocaleDateString(isRtl ? "he-IL" : "en-US")}</p>}
              </CardContent></Card>;
            })}
            {!clubAssets.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{isRtl ? "עדיין לא הוספת תווים, נקודות או הטבות." : "No vouchers, points or benefits yet."}</p>}
          </div>
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
