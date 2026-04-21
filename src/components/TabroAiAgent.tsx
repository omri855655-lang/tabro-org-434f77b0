import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, Loader2, Trash2, History, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTabroAiHistory } from "@/hooks/useTabroAiHistory";
import { useLanguage } from "@/hooks/useLanguage";

interface Message {
  role: "user" | "assistant";
  content: string;
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

interface AgentModeShortcut {
  key: string;
  titleHe: string;
  titleEn: string;
  descHe: string;
  descEn: string;
  promptHe: string;
  promptEn: string;
}

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
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const {
    messages,
    setMessages,
    conversationHistory,
    clearAndArchive,
    loadConversation,
  } = useTabroAiHistory();
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const copy = isHebrew ? {
    chatCleared: "השיחה נוקתה ונשמרה בהיסטוריה",
    noAnswer: "לא הצלחתי לענות",
    actionDone: "✅ הפעולה בוצעה!",
    commError: "שגיאה בתקשורת. נסה שוב.",
    title: "Tabro AI",
    history: "היסטוריית שיחות",
    clearChat: "נקה שיחה",
    previousChats: "שיחות קודמות",
    noHistory: "אין היסטוריה",
    hello: "שלום! אני Tabro AI 👋",
    intro: "אני יכול לנהל את כל הנתונים שלך - משימות, לוח זמנים, ספרים, קניות, פרויקטים ועוד.",
    prompt: "מה תרצה לעשות?",
    suggestions: [
      "סיימתי את המשימה הראשונה",
      "תוסיף משימה בעבודה",
      "מה הסטטוס של הפרויקטים?",
      "תשים אירוע מחר ב-10:00",
      "תסמן קניתי חלב",
      "מה יש לי היום בלוז?",
    ],
  } : {
    chatCleared: "Chat cleared and saved to history",
    noAnswer: "I couldn't answer that",
    actionDone: "✅ Action completed!",
    commError: "Communication error. Please try again.",
    title: "Tabro AI",
    history: "Conversation history",
    clearChat: "Clear chat",
    previousChats: "Previous chats",
    noHistory: "No history yet",
    hello: "Hi! I'm Tabro AI 👋",
    intro: "I can help manage your data — tasks, schedule, books, shopping, projects and more.",
    prompt: "What would you like to do?",
    suggestions: [
      "I finished the first task",
      "Add a task at work",
      "What's the status of my projects?",
      "Add an event tomorrow at 10:00",
      "Mark milk as bought",
      "What do I have today?",
    ],
  };

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

      const nextPrefs = (data?.notification_settings as any)?.ai;
      if (nextPrefs) {
        setAiPrefs((prev) => ({ ...prev, ...nextPrefs }));
      }
    };

    void loadAiPrefs();
  }, [user]);

  const clearChat = () => {
    if (messages.length === 0) return;
    clearAndArchive();
    toast.success(copy.chatCleared);
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
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("tabro-ai-agent", {
        body: {
          message: userMsg.content,
          conversationHistory: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          userId: user.id,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          aiPreferences: aiPrefs,
        },
      });

      if (error) throw error;

      const responseText = data?.response || copy.noAnswer;
      setMessages(prev => [...prev, { role: "assistant", content: responseText }]);

      if (data?.action?.success) {
        toast.success((isHebrew ? ACTION_LABELS[data.action.type] : null) || copy.actionDone);
      }
    } catch (e: any) {
      console.error("Tabro AI error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: copy.commError }]);
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

  const quickPrompts = [
    aiPrefs.dailyBriefingEnabled
      ? (isHebrew
          ? "תן לי תדריך בוקר מלא וקבוע על היום שלי: פוקוס עיקרי, משימות דחופות, אירועים, מיילים חשובים ודברים שדורשים החלטה."
          : "Give me a structured morning briefing for today: main focus, urgent tasks, events, important emails, and decisions needed.")
      : null,
    aiPrefs.emailDigestEnabled
      ? (isHebrew
          ? "סכם לי את המיילים האחרונים שסונכרנו לפי קטגוריות, מה דורש תגובה, ומה הכי חשוב לטפל בו קודם."
          : "Summarize the latest synced emails by category, what needs a reply, and what matters most first.")
      : null,
    aiPrefs.newsBriefingEnabled
      ? (isHebrew
          ? `בנה לי תדריך חדשות בוקר לפי תחומי העניין שלי: ${aiPrefs.newsTopics || "חדשות כלליות"}. אם אין לך פיד חדשות חי, תגיד לי בדיוק מה חסר כדי להשלים את זה.`
          : `Build me a morning news briefing for my interests: ${aiPrefs.newsTopics || "general news"}. If no live news source is available, tell me exactly what's missing.`)
      : null,
    aiPrefs.reminderEnabled
      ? (isHebrew
          ? `תזכיר לי מה חשוב לי היום סביב ${aiPrefs.reminderTime}, ותן לי תדריך מסודר לקראת השעה הזו.`
          : `Remind me what matters today around ${aiPrefs.reminderTime} and give me a structured prep briefing.`)
      : null,
  ].filter(Boolean) as string[];

  const agentModes: AgentModeShortcut[] = [
    {
      key: "project-review",
      titleHe: "סקירת פרויקטים",
      titleEn: "Project review",
      descHe: "מה תקוע, מה דחוף, ומה דורש החלטה",
      descEn: "What's blocked, urgent, and needs a decision",
      promptHe: "תן לי סקירת פרויקטים ניהולית: מה תקוע, מה באיחור, מה דחוף, ואיזה פרויקט דורש החלטה שלי היום.",
      promptEn: "Give me a managerial projects review: what's blocked, overdue, urgent, and which project needs my decision today.",
    },
    {
      key: "inbox-triage",
      titleHe: "טריאז׳ מיילים",
      titleEn: "Inbox triage",
      descHe: "מה דורש תשובה מיידית ומה אפשר לדחות",
      descEn: "What needs a response now and what can wait",
      promptHe: "עשה לי טריאז׳ מלא למיילים: מה דורש תגובה מיידית, מה אפשר לדחות, ומה אפשר לארכב בלי לפגוע בכלום.",
      promptEn: "Triage my inbox: what needs an immediate response, what can wait, and what can be archived safely.",
    },
    {
      key: "meeting-prep",
      titleHe: "הכנה לפגישה",
      titleEn: "Meeting prep",
      descHe: "תדריך קצר לפני שיחה או ישיבה",
      descEn: "Quick prep before a conversation or meeting",
      promptHe: "תכין לי תדריך קצר לפגישה: מה הרקע, מה המטרות, מה כדאי לשאול, ומה לא לשכוח להגיד.",
      promptEn: "Prepare a short meeting brief: background, goals, questions to ask, and what not to forget to say.",
    },
    {
      key: "focus-coach",
      titleHe: "מאמן פוקוס",
      titleEn: "Focus coach",
      descHe: "מה הכי חשוב לי עכשיו ואיך להיכנס לפעולה",
      descEn: "What matters most right now and how to start",
      promptHe: "פעל כמאמן פוקוס: קח את כל מה שיש לי היום ותגיד לי מה הכי חשוב, מה להוריד מהרעש, ואיך להתחיל ב-20 הדקות הקרובות.",
      promptEn: "Act as a focus coach: use everything on my plate today and tell me what matters most, what to ignore, and how to start in the next 20 minutes.",
    },
    {
      key: "executive-summary",
      titleHe: "סיכום מנהלים",
      titleEn: "Executive summary",
      descHe: "מצב מהיר של היום, השבוע, והסיכונים",
      descEn: "Fast status on today, this week, and risks",
      promptHe: "תן לי סיכום מנהלים קצר: מצב היום, השבוע, דחופים, סיכונים, ומה דורש תשומת לב מיוחדת.",
      promptEn: "Give me a short executive summary: today, this week, urgent items, risks, and what needs special attention.",
    },
  ];

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
        <div className="fixed left-4 bottom-20 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" dir={dir}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm flex-1">{copy.title}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)} title={copy.history}>
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title={copy.clearChat} disabled={messages.length === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* History sidebar */}
          {showHistory && (
            <div className="border-b border-border bg-muted/30 max-h-[200px] overflow-auto">
              <div className="p-2 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground px-1">{copy.previousChats}</p>
                {conversationHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{copy.noHistory}</p>
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

          <div className="px-3 py-2 border-b border-border bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              {aiPrefs.dailyBriefingEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt(isHebrew
                    ? "תן לי עכשיו תדריך בוקר מלא וקבוע: פוקוס עיקרי, משימות דחופות, אירועים להיום, מיילים חשובים לפי קטגוריות, דברים שדורשים החלטה, ומה לעשות ראשון."
                    : "Give me a structured morning briefing now: main focus, urgent tasks, today's events, important emails by category, decisions needed, and what to do first.")}
                >
                  <span className="block text-xs font-semibold">{isHebrew ? "תדריך היום" : "Today's briefing"}</span>
                  <span className="block text-[10px] text-muted-foreground">{isHebrew ? "סדר יום, דחופים והמלצה מה קודם" : "Agenda, urgent items, and what to tackle first"}</span>
                </button>
              )}
              {aiPrefs.emailDigestEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt(isHebrew
                    ? "סכם לי עכשיו את המיילים האחרונים שסונכרנו לפי קטגוריות, מה דורש תגובה, מה אפשר לדחות, ומה הכי חשוב לי לטפל בו קודם."
                    : "Summarize the latest synced emails by category, what needs a reply, what can wait, and what I should handle first.")}
                >
                  <span className="block text-xs font-semibold">{isHebrew ? "סיכום מיילים" : "Email summary"}</span>
                  <span className="block text-[10px] text-muted-foreground">{isHebrew ? "מה חשוב, מה דחוף, ומה ממתין" : "What's important, urgent, or waiting"}</span>
                </button>
              )}
              {aiPrefs.newsBriefingEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt(isHebrew
                    ? `בנה לי תדריך חדשות בוקר לפי תחומי העניין שלי: ${aiPrefs.newsTopics || "חדשות כלליות"}. אם אין מקור חדשות חי, תגיד לי בקצרה מה חסר.`
                    : `Build me a morning news briefing for my interests: ${aiPrefs.newsTopics || "general news"}. If no live source exists, briefly tell me what's missing.`)}
                >
                  <span className="block text-xs font-semibold">{isHebrew ? "תדריך חדשות" : "News briefing"}</span>
                  <span className="block text-[10px] text-muted-foreground">{aiPrefs.newsTopics || (isHebrew ? "לא הוגדרו תחומים" : "No topics set")}</span>
                </button>
              )}
              {aiPrefs.reminderEnabled && (
                <button
                  className="rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2 text-right"
                  onClick={() => void runQuickPrompt(isHebrew
                    ? `תן לי תזכורת מסודרת סביב ${aiPrefs.reminderTime}, כולל מה חשוב לי לא לפספס היום.`
                    : `Give me a structured reminder around ${aiPrefs.reminderTime}, including what I shouldn't miss today.`)}
                >
                  <span className="block text-xs font-semibold">{isHebrew ? "תזכורת AI" : "AI reminder"}</span>
                  <span className="block text-[10px] text-muted-foreground">{isHebrew ? `שמורה לשעה ${aiPrefs.reminderTime}` : `Saved for ${aiPrefs.reminderTime}`}</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
                  <Bot className="h-10 w-10 mx-auto text-primary/40" />
                  <p>{copy.hello}</p>
                  <p className="text-xs">{copy.intro}</p>
                  <div className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 max-w-[270px] mx-auto">
                    {aiPrefs.reminderEnabled
                      ? (isHebrew ? `תזכורת ה-AI שלך שמורה לשעה ${aiPrefs.reminderTime}` : `Your AI reminder is saved for ${aiPrefs.reminderTime}`)
                      : (isHebrew ? "אפשר להפעיל תזכורות ותדריכי AI מתוך ההגדרות" : "You can enable AI reminders and briefings in settings")}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center mt-3">
                    {copy.suggestions.map(s => (
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
                      <p className="text-[10px] font-semibold text-muted-foreground">{isHebrew ? "קיצורי דרך לפי ההגדרות שלך" : "Quick actions from your settings"}</p>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            className="text-[10px] px-2 py-1 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                            onClick={() => queuePrompt(prompt)}
                          >
                            {prompt.includes("מיילים") || prompt.includes("emails")
                              ? (isHebrew ? "סיכום מיילים" : "Email summary")
                              : prompt.includes("חדשות") || prompt.includes("news")
                                ? (isHebrew ? "תדריך חדשות" : "News briefing")
                                : prompt.includes("תזכיר") || prompt.includes("Remind")
                                  ? (isHebrew ? "תזכורת יומית" : "Daily reminder")
                                  : (isHebrew ? "תדריך היום" : "Today's briefing")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 mt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground">{isHebrew ? "מצבי סוכן חכמים" : "Agent modes"}</p>
                    <div className="grid gap-2 text-right">
                      {agentModes.map((mode) => (
                        <button
                          key={mode.key}
                          className="rounded-lg border border-border bg-background/70 px-3 py-2 text-right transition-colors hover:bg-muted"
                          onClick={() => queuePrompt(isHebrew ? mode.promptHe : mode.promptEn)}
                        >
                          <span className="block text-xs font-semibold">{isHebrew ? mode.titleHe : mode.titleEn}</span>
                          <span className="block text-[10px] text-muted-foreground">{isHebrew ? mode.descHe : mode.descEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
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
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder={copy.prompt}
                className="flex-1 text-sm"
                disabled={loading}
              />
              <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim()} className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TabroAiAgent;
