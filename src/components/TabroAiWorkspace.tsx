import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useTabroAiHistory } from "@/hooks/useTabroAiHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Briefcase, CalendarRange, FileText, Inbox, Loader2, Newspaper, Paperclip, Send, Sparkles, Target, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AgentMode = "general" | "daily" | "email" | "projects" | "meeting" | "focus" | "files" | "reply" | "executive" | "planner";

type AttachmentContext = {
  id: string;
  name: string;
  type: string;
  size: number;
  extractedText?: string;
  preview: string;
};

const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".csv", ".ts", ".tsx", ".js", ".jsx", ".html", ".css"];
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12000;

const MODE_PRESETS: Record<AgentMode, { title: string; prompt: string; icon: typeof Sparkles }> = {
  general: {
    title: "שיחה פתוחה",
    prompt: "",
    icon: Sparkles,
  },
  daily: {
    title: "תדריך בוקר מלא",
    prompt: "תן לי תדריך מלא על היום שלי: סדר עדיפויות, דחופים, פגישות, מיילים חשובים ומה כדאי להתחיל ראשון.",
    icon: CalendarRange,
  },
  email: {
    title: "טריאז׳ מיילים",
    prompt: "סכם לי את המיילים האחרונים לפי קטגוריות, מה דורש תגובה, מה אפשר לדחות, ומה צריך טיפול מיידי.",
    icon: Inbox,
  },
  projects: {
    title: "סקירת פרויקטים",
    prompt: "תן לי תמונת מצב של כל הפרויקטים: מה תקוע, מה באיחור, מה כדאי לקדם השבוע ואיפה צריך החלטה.",
    icon: Briefcase,
  },
  meeting: {
    title: "הכנה / סיכום פגישה",
    prompt: "עזור לי להתכונן לפגישה או לסכם אותה בצורה מסודרת: מטרות, שאלות, החלטות, משימות המשך ומייל follow-up.",
    icon: Target,
  },
  focus: {
    title: "מאמן פוקוס",
    prompt: "עזור לי להיכנס לפוקוס: מה המשימה המרכזית, מה להסיר כרעש, ואיך לחלק את העבודה לספרינטים קצרים.",
    icon: Target,
  },
  files: {
    title: "סיכום קבצים",
    prompt: "נתח את הקבצים שהעליתי, תן תקציר ברור, הוצא תובנות, משימות והמלצות פעולה.",
    icon: FileText,
  },
  reply: {
    title: "תשובה למייל / הודעה",
    prompt: "נסח לי תשובה מקצועית, ברורה וקצרה למייל או להודעה, עם טון מתאים, נקודות פעולה, וסגירה נכונה.",
    icon: Send,
  },
  executive: {
    title: "סיכום מנהלים",
    prompt: "תן לי סיכום מנהלים קצר וברור: מה דחוף, מה תקוע, מה הושלם, ומה דורש החלטה ממני.",
    icon: Briefcase,
  },
  planner: {
    title: "תכנון ביצוע",
    prompt: "בנה לי תוכנית ביצוע מעשית להיום או לשבוע: סדר עדיפויות, חלוקת זמן, אבני דרך, ומה אפשר לדחות.",
    icon: Target,
  },
};

const canReadAsText = (file: File) => {
  if (file.type.startsWith("text/")) return true;
  const lowerName = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

export default function TabroAiWorkspace() {
  const { user } = useAuth();
  const { dir } = useLanguage();
  const { messages, setMessages, conversationHistory, clearAndArchive, loadConversation } = useTabroAiHistory();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>("general");
  const [attachments, setAttachments] = useState<AttachmentContext[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const modeCards = useMemo(
    () =>
      Object.entries(MODE_PRESETS).map(([key, preset]) => ({
        key: key as AgentMode,
        ...preset,
      })),
    [],
  );

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const nextFiles = await Promise.all(
        Array.from(fileList).map(async (file) => {
          let extractedText = "";
          if (canReadAsText(file) && file.size <= MAX_TEXT_BYTES) {
            try {
              extractedText = (await file.text()).slice(0, MAX_EXTRACTED_CHARS);
            } catch (error) {
              console.error("Failed reading file as text", error);
            }
          }

          const preview = extractedText
            ? extractedText.slice(0, 280)
            : `קובץ ${file.name} (${formatFileSize(file.size)}) הועלה. כרגע אפשר להשתמש בשם, בסוג ובגודל גם אם התוכן אינו קריא ישירות.`;

          return {
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type || "unknown",
            size: file.size,
            extractedText: extractedText || undefined,
            preview,
          } satisfies AttachmentContext;
        }),
      );

      setAttachments((prev) => [...prev, ...nextFiles]);
      toast.success(`${nextFiles.length} קבצים נוספו ל-AI`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== id));
  };

  const sendMessage = async (overridePrompt?: string) => {
    const finalInput = (overridePrompt ?? input).trim() || (attachments.length ? MODE_PRESETS.files.prompt : "");
    if (!finalInput || !user || loading) return;

    const userMessage: Message = { role: "user", content: finalInput };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("tabro-ai-agent", {
        body: {
          message: userMessage.content,
          conversationHistory: nextMessages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
          userId: user.id,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          agentMode,
          attachments: attachments.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            preview: file.preview,
            extractedText: file.extractedText,
          })),
        },
      });

      if (error) throw error;

      setMessages((prev) => [...prev, { role: "assistant", content: data?.response || "לא הצלחתי לענות כרגע." }]);
      if (data?.action?.success) {
        toast.success("הפעולה בוצעה בהצלחה");
      }
      setAttachments([]);
    } catch (error) {
      console.error("Tabro AI workspace error", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "הייתה שגיאת תקשורת עם הסוכן. נסה שוב בעוד רגע." }]);
      toast.error("שגיאה בשליחת הבקשה ל-AI");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4" dir={dir}>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary" />
            מרכז AI
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            מרחב עבודה מלא לסוכן: שיחה חופשית, תדריכי בוקר, טריאז׳ מיילים, הכנה לפגישות, העלאת קבצים ועוד.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {modeCards.map((mode) => {
              const Icon = mode.icon;
              const active = mode.key === agentMode;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => {
                    setAgentMode(mode.key);
                    if (mode.prompt) setInput(mode.prompt);
                  }}
                  className={`rounded-xl border p-3 text-right transition-colors ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    {mode.title}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_360px]">
            <Card className="min-h-[520px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">שיחה מלאה עם הסוכן</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={clearAndArchive} disabled={!messages.length}>
                      <Trash2 className="h-4 w-4" />
                      נקה שיחה
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScrollArea className="h-[360px] rounded-xl border bg-muted/20 p-3">
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                        <Bot className="h-10 w-10 text-primary/50" />
                        <div className="space-y-1">
                          <p className="font-medium">אפשר לדבר כאן עם הסוכן בצורה מלאה</p>
                          <p className="text-sm">לבקש תדריך, לנתח מיילים, לנסח תשובות, לעבוד על קבצים או להכין פגישה.</p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                            {message.content}
                          </div>
                        </div>
                      ))
                    )}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="rounded-xl border bg-card px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="space-y-3 rounded-xl border bg-background p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">קבצים ותוכן עזר</p>
                      <p className="text-xs text-muted-foreground">אפשר לצרף מסמכי טקסט, CSV, JSON, קבצי קוד ועוד. קבצים לא טקסטואליים יישלחו לסוכן כמטא־דאטה כרגע.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => void handleFilesSelected(event.target.files)}
                      />
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        העלה קבצים
                      </Button>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((file) => (
                          <Badge key={file.id} variant="secondary" className="gap-2 py-1">
                            <Paperclip className="h-3 w-3" />
                            {file.name}
                            <button type="button" onClick={() => removeAttachment(file.id)} className="rounded-full hover:bg-background/60 p-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {attachments.map((file) => (
                          <div key={`${file.id}-preview`} className="rounded-lg border bg-muted/20 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{file.name}</span>
                              <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{file.preview}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="כתוב כאן מה תרצה מהסוכן: תדריך בוקר, סיכום קבצים, ניתוח מיילים, הכנת פגישה, ניסוח תשובה ועוד."
                    className="min-h-[130px]"
                  />

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-wrap gap-2">
                      {["תן לי תדריך בוקר", "מה הכי דחוף לי היום?", "נסח לי מייל המשך", "סכם את הקבצים שהעליתי", "תן לי סיכום מנהלים", "בנה לי תוכנית עבודה להיום"].map((prompt) => (
                        <Button key={prompt} variant="ghost" size="sm" onClick={() => setInput(prompt)} className="text-xs">
                          {prompt}
                        </Button>
                      ))}
                    </div>
                    <Button onClick={() => void sendMessage()} disabled={loading || (!input.trim() && !attachments.length)} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      שלח לסוכן
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">יכולות מהירות</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { icon: CalendarRange, text: "תדריך בוקר מסודר על היום, אירועים ודחופים" },
                    { icon: Inbox, text: "סיכום מיילים לפי קטגוריות וטריאז׳" },
                    { icon: Briefcase, text: "סקירת פרויקטים עם המלצות פעולה" },
                    { icon: FileText, text: "סיכום קבצים, מסמכים וטיוטות" },
                    { icon: Send, text: "ניסוח תשובה למיילים, follow-up והודעות המשך" },
                    { icon: Target, text: "בניית תוכנית עבודה יומית/שבועית עם סדר עדיפויות" },
                    { icon: Newspaper, text: "תדריך חדשות לפי תחומי עניין כשהמקור זמין" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.text} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2 text-xs text-muted-foreground">
                        <Icon className="mt-0.5 h-3.5 w-3.5 text-primary" />
                        <span>{item.text}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">שיחות קודמות</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {conversationHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">עדיין אין היסטוריית שיחות שמורה.</p>
                  ) : (
                    conversationHistory.slice(0, 8).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => loadConversation(entry)}
                        className="w-full rounded-lg border bg-muted/20 p-3 text-right hover:bg-muted/40"
                      >
                        <p className="text-xs font-medium truncate">{entry.preview}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{entry.date}</p>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
