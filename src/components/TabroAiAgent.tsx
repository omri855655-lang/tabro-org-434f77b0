import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, X, Send, Loader2, Trash2, History, ChevronRight, Flame, Clock3, CalendarDays, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { useTabroAiHistory } from "@/hooks/useTabroAiHistory";
import type { Json } from "@/integrations/supabase/types";
import { estimateTaskDuration, formatDurationLabel } from "@/lib/planningDurationHeuristics";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TaskInsight {
  id: string;
  title: string;
  taskType: "work" | "personal";
  urgent: boolean;
  overdue: boolean;
  plannedEnd?: string | null;
  estimatedMinutes: number;
  estimateReason: string;
}

interface AgentContextSummary {
  urgentCount: number;
  overdueCount: number;
  pendingEmailCount: number;
  todayEventCount: number;
  shortTasks: TaskInsight[];
  deepTasks: TaskInsight[];
}

interface AiAgentPreferences {
  enabled: boolean;
  dailyBriefingEnabled: boolean;
  emailDigestEnabled: boolean;
  newsBriefingEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  newsTopics: string;
}

type AssistantMode = "general" | "planning_agent";

interface NotificationSettings {
  ai?: Partial<AiAgentPreferences>;
}

type PendingAction = Json;

const shouldAutoExecutePlanning = (text: string) => {
  const normalized = text.trim();
  return [
    "תשבץ",
    "תשבץ לי",
    "תכניס למתכנן",
    "תכניס ללוז",
    "תבצע",
    "תבנה ותשבץ",
    "תכנן ותשבץ",
    "תכנן ותכניס",
    "תעשה את זה בלוז",
    "תיצור אירועים",
  ].some((phrase) => normalized.includes(phrase));
};

const ACTION_LABELS: Record<string, string> = {
  add_task: "המשימה נוספה בהצלחה",
  update_task: "המשימה עודכנה",
  add_event: "האירוע נוסף ללוח הזמנים",
  update_event: "האירוע עודכן",
  delete_event: "האירוע נמחק",
  add_book: "הספר נוסף בהצלחה",
  update_book: "סטטוס הספר עודכן",
  add_shopping: "הפריט נוסף לרשימת הקניות",
  update_shopping: "פריט הקניות עודכן",
  update_project: "הפרויקט עודכן",
  toggle_project_task: "משימת הפרויקט עודכנה",
  add_project_task: "משימה נוספה לפרויקט",
  update_show: "הסדרה/סרט עודכנו",
  add_board_item: "פריט נוסף לרשימה",
  update_course: "הקורס עודכן",
  add_note: "הפתק נוסף",
  update_note: "הפתק עודכן",
  add_payment: "ההוצאה/הכנסה נוספה",
  update_payment: "התשלום עודכן",
  multi: "כל הפעולות בוצעו",
};

const TabroAiAgent = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("general");
  const {
    messages,
    setMessages,
    conversationHistory,
    clearAndArchive,
    loadConversation,
  } = useTabroAiHistory("tabro-ai");
  const [aiPrefs, setAiPrefs] = useState<AiAgentPreferences>({
    enabled: true,
    dailyBriefingEnabled: true,
    emailDigestEnabled: true,
    newsBriefingEnabled: false,
    reminderEnabled: false,
    reminderTime: "08:00",
    newsTopics: "",
  });
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [contextSummary, setContextSummary] = useState<AgentContextSummary>({
    urgentCount: 0,
    overdueCount: 0,
    pendingEmailCount: 0,
    todayEventCount: 0,
    shortTasks: [],
    deepTasks: [],
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    const loadAiPrefs = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("notification_settings")
        .eq("user_id", user.id)
        .maybeSingle();

      const nextPrefs = (data?.notification_settings as Json as NotificationSettings | null)?.ai;
      if (nextPrefs) {
        setAiPrefs((prev) => ({ ...prev, ...nextPrefs }));
      }
    };

    loadAiPrefs();
  }, [user]);

  useEffect(() => {
    if (!user || !open) return;

    const loadContextSummary = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: tasks }, { data: emails }, { data: events }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, description, task_type, urgent, overdue, planned_end, status")
          .eq("user_id", user.id)
          .eq("archived", false)
          .neq("status", "בוצע")
          .limit(250),
        supabase
          .from("email_analyses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_processed", false),
        supabase
          .from("calendar_events")
          .select("id")
          .eq("user_id", user.id)
          .gte("start_time", `${today}T00:00:00`)
          .lte("start_time", `${today}T23:59:59`),
      ]);

      const normalizedTasks: TaskInsight[] = (tasks || []).map((task) => {
        const estimate = estimateTaskDuration(task.description || "", task.task_type === "work" ? "עבודה" : "אישי");
        return {
          id: task.id,
          title: task.description || "(ללא כותרת)",
          taskType: task.task_type === "work" ? "work" : "personal",
          urgent: Boolean(task.urgent),
          overdue: Boolean(task.overdue),
          plannedEnd: task.planned_end,
          estimatedMinutes: estimate.minutes,
          estimateReason: estimate.reason,
        };
      });

      const sortedTasks = [...normalizedTasks].sort((left, right) => {
        const leftScore = (left.overdue ? 4 : 0) + (left.urgent ? 2 : 0) + (left.plannedEnd ? 1 : 0);
        const rightScore = (right.overdue ? 4 : 0) + (right.urgent ? 2 : 0) + (right.plannedEnd ? 1 : 0);
        if (rightScore !== leftScore) return rightScore - leftScore;
        return left.estimatedMinutes - right.estimatedMinutes;
      });

      setContextSummary({
        urgentCount: normalizedTasks.filter((task) => task.urgent).length,
        overdueCount: normalizedTasks.filter((task) => task.overdue).length,
        pendingEmailCount: emails?.length ?? 0,
        todayEventCount: events?.length ?? 0,
        shortTasks: sortedTasks.filter((task) => task.estimatedMinutes <= 15).slice(0, 4),
        deepTasks: sortedTasks.filter((task) => task.estimatedMinutes >= 45).slice(0, 3),
      });
    };

    void loadContextSummary();
  }, [open, user]);

  const clearChat = () => {
    if (messages.length === 0) return;
    clearAndArchive();
    toast.success("השיחה נוקתה ונשמרה בהיסטוריה");
  };

  const handleLoadConversation = (entry: { id: string; date: string; preview: string; messages: Message[] }) => {
    loadConversation(entry);
    setShowHistory(false);
  };

  const sendMessage = async (overrideInput?: string) => {
    const finalInput = (overrideInput ?? input).trim();
    if (!finalInput || !user || loading) return;
    const userMsg: Message = { role: "user", content: finalInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingAction(null);
    setLoading(true);

    try {
      const executeImmediately = assistantMode === "planning_agent" && shouldAutoExecutePlanning(userMsg.content);
      const { data, error } = await supabase.functions.invoke("tabro-ai-agent", {
        body: {
          message: userMsg.content,
          conversationHistory: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          userId: user.id,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          aiPreferences: aiPrefs,
          assistantMode,
          dryRunActions: assistantMode === "planning_agent" && !executeImmediately,
        },
      });

      if (error) throw error;

      const responseText = data?.response || "לא הצלחתי לענות";
      setMessages(prev => [...prev, { role: "assistant", content: responseText }]);

      if (data?.pendingAction) {
        setPendingAction(data.pendingAction as PendingAction);
        toast.success("התוכנית מוכנה. אפשר לאשר ביצוע.");
      }

      if (data?.action?.success) {
        toast.success(ACTION_LABELS[data.action.type] || "✅ הפעולה בוצעה!");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Tabro AI error:", errorMessage);
      setMessages(prev => [...prev, { role: "assistant", content: "שגיאה בתקשורת. נסה שוב." }]);
    }
    setLoading(false);
  };

  const confirmPendingAction = async () => {
    if (!user || !pendingAction || loading) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tabro-ai-agent", {
        body: {
          userId: user.id,
          prebuiltAction: pendingAction,
          assistantMode,
        },
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: "assistant", content: data?.response || "אישרתי וביצעתי את הפעולה." }]);
      setPendingAction(null);

      if (data?.action?.success) {
        toast.success(ACTION_LABELS[data.action.type] || "הפעולה בוצעה");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Tabro AI confirmation error:", errorMessage);
      setMessages(prev => [...prev, { role: "assistant", content: "לא הצלחתי לאשר את הפעולה כרגע." }]);
    }
    setLoading(false);
  };

  const queuePrompt = (prompt: string) => {
    setInput(prompt);
    if (!open) setOpen(true);
  };

  const runQuickPrompt = async (prompt: string) => {
    if (!open) setOpen(true);
    await sendMessage(prompt);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const shortTaskPrompt = useMemo(() => {
    if (contextSummary.shortTasks.length === 0) {
      return "תגיד לי אילו משימות קצרות אפשר לסגור ב-15 דקות או פחות לפי מה שפתוח כרגע.";
    }

    return `יש לי עכשיו כמה משימות קצרות. תגיד לי מה הכי נכון לסגור קודם מבין: ${contextSummary.shortTasks.map((task) => `"${task.title}" (${formatDurationLabel(task.estimatedMinutes)})`).join(", ")}.`;
  }, [contextSummary.shortTasks]);

  const deepTaskPrompt = useMemo(() => {
    if (contextSummary.deepTasks.length === 0) {
      return "איזו משימה עמוקה כדאי לי לקחת לבלוק של שעה עד שעתיים עכשיו?";
    }

    return `אם יש לי בלוק פוקוס של שעה-שעתיים, מה הכי נכון לקחת מבין: ${contextSummary.deepTasks.map((task) => `"${task.title}" (${formatDurationLabel(task.estimatedMinutes)})`).join(", ")}?`;
  }, [contextSummary.deepTasks]);

  const quickPrompts = assistantMode === "planning_agent"
    ? [
        "תכנן לי את היום לפי דחיפות, משך משימה סביר, ואילוצים. אם חסר מידע - תשאל אותי שאלות קצרות.",
        "תכנן לי את מחר. תשאל אותי אם אני עובד, מאיזה שעה עד איזה שעה, ומה האילוצים הקבועים.",
        "תכנן לי שבוע קדימה לפי משימות פתוחות, אירועים קיימים, ומה שדחוף קודם.",
        "בדוק אילו מיילים הכי דורשים מענה, ואיך לשבץ אותם בלוז שלי.",
      ]
    : ([
        aiPrefs.dailyBriefingEnabled
          ? `תן לי תדריך בוקר מלא וקבוע על היום שלי: פוקוס עיקרי, משימות דחופות, אירועים, מיילים חשובים ודברים שדורשים החלטה.`
          : null,
        aiPrefs.emailDigestEnabled
          ? `סכם לי את המיילים האחרונים שסונכרנו לפי קטגוריות, מה דורש תגובה, ומה הכי חשוב לטפל בו קודם.`
          : null,
        aiPrefs.newsBriefingEnabled
          ? `בנה לי תדריך חדשות בוקר לפי תחומי העניין שלי: ${aiPrefs.newsTopics || "חדשות כלליות"}. אם אין לך פיד חדשות חי, תגיד לי בדיוק מה חסר כדי להשלים את זה.`
          : null,
        aiPrefs.reminderEnabled
          ? `תזכיר לי מה חשוב לי היום סביב ${aiPrefs.reminderTime}, ותן לי תדריך מסודר לקראת השעה הזו.`
          : null,
      ].filter(Boolean) as string[]);

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 bottom-20 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          title="Tabro AI"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed left-4 bottom-20 z-50 w-[440px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-5rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
            <Bot className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm block">
                {assistantMode === "planning_agent" ? "סוכן תכנון AI" : "Tabro AI"}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {assistantMode === "planning_agent"
                  ? "מתכנן יום ושבוע, מזהה דחיפות ומשכי משימות"
                  : "עוזר כללי למשימות, לוז, מיילים ונתוני המערכת"}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)} title="היסטוריית שיחות">
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="נקה שיחה" disabled={messages.length === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 py-2 border-b border-border bg-background/70">
            <Select value={assistantMode} onValueChange={(value: AssistantMode) => setAssistantMode(value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="בחר מצב AI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Tabro AI כללי</SelectItem>
                <SelectItem value="planning_agent">סוכן תכנון ולוז</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="px-3 py-3 border-b border-border bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-xl border border-border bg-background px-3 py-2 text-right hover:bg-muted/60 transition-colors"
                onClick={() => queuePrompt("מה הכי דחוף לי לעשות עכשיו לפי מה שמסומן דחוף/באיחור ואירועי היום?")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Flame className="h-4 w-4 text-orange-500" />
                  דחוף ובאיחור
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  דחוף {contextSummary.urgentCount} · באיחור {contextSummary.overdueCount}
                </div>
              </button>
              <button
                className="rounded-xl border border-border bg-background px-3 py-2 text-right hover:bg-muted/60 transition-colors"
                onClick={() => queuePrompt(shortTaskPrompt)}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Clock3 className="h-4 w-4 text-emerald-600" />
                  משימות קצרות
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  עד 15 דק' · {contextSummary.shortTasks.length} מועמדות
                </div>
              </button>
              <button
                className="rounded-xl border border-border bg-background px-3 py-2 text-right hover:bg-muted/60 transition-colors"
                onClick={() => queuePrompt(deepTaskPrompt)}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <BrainCircuit className="h-4 w-4 text-blue-600" />
                  בלוק פוקוס
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  45-120 דק' · {contextSummary.deepTasks.length} משימות עומק
                </div>
              </button>
              <button
                className="rounded-xl border border-border bg-background px-3 py-2 text-right hover:bg-muted/60 transition-colors"
                onClick={() => queuePrompt("תן לי תמונת מצב: כמה מיילים ממתינים, כמה אירועים יש לי היום, ומה הכי נכון לשלב קודם.")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CalendarDays className="h-4 w-4 text-violet-600" />
                  היום שלי
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {contextSummary.todayEventCount} אירועים · {contextSummary.pendingEmailCount} מיילים ממתינים
                </div>
              </button>
            </div>

            {(contextSummary.shortTasks.length > 0 || contextSummary.deepTasks.length > 0) && (
              <div className="mt-3 space-y-2">
                {contextSummary.shortTasks.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold text-muted-foreground">קצרות שאפשר לסגור מהר</div>
                    <div className="flex flex-wrap gap-1">
                      {contextSummary.shortTasks.map((task) => (
                        <button
                          key={`short-${task.id}`}
                          className="rounded-full border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                          onClick={() => queuePrompt(`האם כדאי לי לסגור עכשיו את "${task.title}"? זה נראה כמו משימה של ${formatDurationLabel(task.estimatedMinutes)}.`)}
                        >
                          {task.title.length > 26 ? `${task.title.slice(0, 26)}…` : task.title} · {formatDurationLabel(task.estimatedMinutes)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {contextSummary.deepTasks.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold text-muted-foreground">מועמדות לבלוק עומק</div>
                    <div className="flex flex-wrap gap-1">
                      {contextSummary.deepTasks.map((task) => (
                        <button
                          key={`deep-${task.id}`}
                          className="rounded-full border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                          onClick={() => queuePrompt(`אם אני נותן עכשיו בלוק פוקוס, תבחן את "${task.title}" כמשימה של בערך ${formatDurationLabel(task.estimatedMinutes)}.`)}
                        >
                          {task.title.length > 24 ? `${task.title.slice(0, 24)}…` : task.title} · {formatDurationLabel(task.estimatedMinutes)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History sidebar */}
          {showHistory && (
            <div className="border-b border-border bg-muted/30 max-h-[200px] overflow-auto">
              <div className="p-2 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground px-1">שיחות קודמות</p>
                {conversationHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">אין היסטוריה</p>
                ) : (
                  conversationHistory.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => handleLoadConversation(entry)}
                      className="w-full text-right px-2 py-1.5 rounded-md hover:bg-accent text-xs flex items-center gap-2 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{entry.preview}</span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* AI actions */}
          <div className="px-3 py-2 border-b border-border bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              {assistantMode === "planning_agent" ? (
                <>
                  <button
                    className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                    onClick={() => void runQuickPrompt("תכנן לי את היום לפי המשימות הדחופות, אירועים שכבר קיימים, והזמן הסביר של כל משימה. אם חסרים לך אילוצים - תשאל אותי קודם.")}
                  >
                    <span className="block text-xs font-semibold">תכנון היום</span>
                    <span className="block text-[10px] text-muted-foreground">דחיפות, משכים ואילוצים</span>
                  </button>
                  <button
                    className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                    onClick={() => void runQuickPrompt("תכנן לי שבוע קדימה. תשאל אותי מה ימי העבודה שלי, אילו אילוצים קבועים יש לי, ומה חייב להיכנס קודם.")}
                  >
                    <span className="block text-xs font-semibold">תכנון שבועי</span>
                    <span className="block text-[10px] text-muted-foreground">שבוע עבודה, בית וקבועים</span>
                  </button>
                  <button
                    className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                    onClick={() => void runQuickPrompt("בדוק לי אילו מיילים צריכים מענה, כמה זמן צפוי לטפל בכל אחד, ואיך כדאי לשבץ אותם בלוז.")}
                  >
                    <span className="block text-xs font-semibold">מיילים לטיפול</span>
                    <span className="block text-[10px] text-muted-foreground">מי דורש תגובה ומתי</span>
                  </button>
                  <button
                    className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                    onClick={() => void runQuickPrompt("תכנן לי את מחר ותשאל אותי קודם אם אני עובד, מאיזה שעה עד איזה שעה, והאם יש אימון או אילוץ קבוע.")}
                  >
                    <span className="block text-xs font-semibold">תכנון למחר</span>
                    <span className="block text-[10px] text-muted-foreground">שאלות מקדימות ואחר כך שיבוץ</span>
                  </button>
                </>
              ) : (
                <>
              {aiPrefs.dailyBriefingEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt("תן לי עכשיו תדריך בוקר מלא וקבוע: פוקוס עיקרי, משימות דחופות, אירועים להיום, מיילים חשובים לפי קטגוריות, דברים שדורשים החלטה, ומה לעשות ראשון.")}
                >
                  <span className="block text-xs font-semibold">תדריך היום</span>
                  <span className="block text-[10px] text-muted-foreground">סדר יום, דחופים והמלצה מה קודם</span>
                </button>
              )}
              {aiPrefs.emailDigestEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt("סכם לי עכשיו את המיילים האחרונים שסונכרנו לפי קטגוריות, מה דורש תגובה, מה אפשר לדחות, ומה הכי חשוב לי לטפל בו קודם.")}
                >
                  <span className="block text-xs font-semibold">סיכום מיילים</span>
                  <span className="block text-[10px] text-muted-foreground">מה חשוב, מה דחוף, ומה ממתין</span>
                </button>
              )}
              {aiPrefs.newsBriefingEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt(`בנה לי תדריך חדשות בוקר לפי תחומי העניין שלי: ${aiPrefs.newsTopics || "חדשות כלליות"}. אם אין מקור חדשות חי, תגיד לי בקצרה מה חסר.`)}
                >
                  <span className="block text-xs font-semibold">תדריך חדשות</span>
                  <span className="block text-[10px] text-muted-foreground">{aiPrefs.newsTopics || "לא הוגדרו תחומים"}</span>
                </button>
              )}
              {aiPrefs.reminderEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt(`תן לי תזכורת מסודרת סביב ${aiPrefs.reminderTime}, כולל מה חשוב לי לא לפספס היום.`)}
                >
                  <span className="block text-xs font-semibold">תזכורת AI</span>
                  <span className="block text-[10px] text-muted-foreground">שמורה לשעה {aiPrefs.reminderTime}</span>
                </button>
              )}
                </>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
                  <Bot className="h-10 w-10 mx-auto text-primary/40" />
                  <p>{assistantMode === "planning_agent" ? "שלום! אני סוכן התכנון שלך" : "שלום! אני Tabro AI 👋"}</p>
                  <p className="text-xs">
                    {assistantMode === "planning_agent"
                      ? "אני יכול לתכנן לך יום או שבוע, לשאול על אילוצים, להעריך כמה זמן משימות ייקחו, ולבנות סדר עבודה חכם."
                      : "אני יכול לנהל את כל הנתונים שלך - משימות, לוח זמנים, ספרים, קניות, פרויקטים ועוד."}
                  </p>
                  <div className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 max-w-[270px] mx-auto">
                    {assistantMode === "planning_agent"
                      ? "כדי שאשבץ טוב יותר, אפשר לספר לי שעות עבודה, ימי חופש, אימונים, וזמני בית."
                      : aiPrefs.reminderEnabled
                      ? `תזכורת ה-AI שלך שמורה לשעה ${aiPrefs.reminderTime}`
                      : "אפשר להפעיל תזכורות ותדריכי AI מתוך ההגדרות"}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center mt-3">
                    {(assistantMode === "planning_agent"
                      ? [
                          "תכנן לי את היום",
                          "מה 3 הדברים הכי דחופים?",
                          "איזה משימות קצרות אפשר לסגור ב-15 דקות?",
                          "תן לי בלוק פוקוס של שעה",
                          "תכנן לי את מחר לפי שעות עבודה",
                          "תכנן לי שבוע קדימה",
                          "איזה מיילים צריכים מענה?",
                          "תשבץ לי את המשימות הדחופות",
                          "אני בחופש מחר, תבנה לי לו\"ז",
                        ]
                      : [
                          "סיימתי את המשימה הראשונה",
                          "תוסיף משימה בעבודה",
                          "מה הסטטוס של הפרויקטים?",
                          "תשים אירוע מחר ב-10:00",
                          "תסמן קניתי חלב",
                          "מה יש לי היום בלוז?",
                        ]).map(s => (
                      <button
                        key={s}
                        className="text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                        onClick={() => setInput(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {quickPrompts.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[10px] font-semibold text-muted-foreground">קיצורי דרך לפי ההגדרות שלך</p>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            className="text-[10px] px-2 py-1 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                            onClick={() => queuePrompt(prompt)}
                          >
                            {assistantMode === "planning_agent"
                              ? prompt.includes("שבוע")
                                ? "תכנון שבועי"
                                : prompt.includes("מחר")
                                  ? "תכנון למחר"
                                  : prompt.includes("מיילים")
                                    ? "מיילים לטיפול"
                                    : "תכנון היום"
                              : prompt.includes("מיילים")
                              ? "סיכום מיילים"
                              : prompt.includes("חדשות")
                                ? "תדריך חדשות"
                                : prompt.includes("תזכיר")
                                  ? "תזכורת יומית"
                                  : "תדריך היום"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            {pendingAction && assistantMode === "planning_agent" && (
              <div className="mb-2 flex gap-2">
                <Button className="flex-1" size="sm" onClick={confirmPendingAction} disabled={loading}>
                  אשר ושבץ
                </Button>
                <Button className="flex-1" variant="outline" size="sm" onClick={() => setPendingAction(null)} disabled={loading}>
                  בטל
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={assistantMode === "planning_agent" ? "כתוב מה אתה רוצה לתכנן, מה דחוף, כמה זמן יש לך, ואם אתה רוצה רק הצעה או שיבוץ ממשי..." : "כתוב מה תרצה שהסוכן יעשה, יסכם, יתעדף או יתכנן..."}
                className="min-h-[88px] resize-none text-sm"
                disabled={loading}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  <button
                    className="rounded-full border border-border px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                    onClick={() => queuePrompt("מה הכי נכון לי לעשות ב-30 הדקות הקרובות?")}
                  >
                    חצי שעה פנויה
                  </button>
                  <button
                    className="rounded-full border border-border px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                    onClick={() => queuePrompt("תחשוב לפי דחוף, באיחור, ומשך משוער. מה כדאי ראשון?")}
                  >
                    מה קודם?
                  </button>
                  <button
                    className="rounded-full border border-border px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                    onClick={() => queuePrompt("חלק לי את המשימות שלי לקצרות, בינוניות ועמוקות עם זמן משוער לכל אחת.")}
                  >
                    חלוקת זמנים
                  </button>
                </div>
                <Button onClick={sendMessage} disabled={loading || !input.trim()} className="shrink-0">
                  <Send className="ml-2 h-4 w-4" />
                  שלח
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TabroAiAgent;
