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

  const clearChat = () => {
    if (messages.length === 0) return;
    clearAndArchive();
    toast.success(copy.chatCleared);
  };

  const handleLoadConversation = (entry: { id: string; date: string; preview: string; messages: Message[] }) => {
    loadConversation(entry);
    setShowHistory(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
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

          {/* Messages */}
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
                  <Bot className="h-10 w-10 mx-auto text-primary/40" />
                  <p>{copy.hello}</p>
                  <p className="text-xs">{copy.intro}</p>
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
