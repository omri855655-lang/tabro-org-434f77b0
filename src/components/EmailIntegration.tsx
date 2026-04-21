import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmailIntegration } from "@/hooks/useEmailIntegration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Plus, Trash2, RefreshCw, Loader2, Inbox, CreditCard, ListTodo, ShoppingCart, FileText, User, Sparkles, Eye, ArrowUpDown, MessageCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import EmailConnectionDialog from "@/components/EmailConnectionDialog";
import { format, subDays, isAfter } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AiChatPanel from "@/components/AiChatPanel";

type SmartBucket = "action" | "finance" | "shopping" | "updates" | "personal" | "low";

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  payment: CreditCard,
  task: ListTodo,
  shopping: ShoppingCart,
  bill: FileText,
  personal: User,
};

const CATEGORY_COLORS: Record<string, string> = {
  payment: "bg-blue-500/15 text-blue-700",
  task: "bg-amber-500/15 text-amber-700",
  shopping: "bg-green-500/15 text-green-700",
  bill: "bg-red-500/15 text-red-700",
  personal: "bg-gray-500/15 text-gray-700",
};

const SMART_BUCKET_META: Record<SmartBucket, { icon: typeof Mail; color: string }> = {
  action: { icon: ListTodo, color: "bg-rose-500/12 text-rose-700" },
  finance: { icon: CreditCard, color: "bg-blue-500/12 text-blue-700" },
  shopping: { icon: ShoppingCart, color: "bg-green-500/12 text-green-700" },
  updates: { icon: FileText, color: "bg-violet-500/12 text-violet-700" },
  personal: { icon: User, color: "bg-slate-500/12 text-slate-700" },
  low: { icon: Mail, color: "bg-muted text-muted-foreground" },
};

const extractSenderDomain = (from?: string | null) => {
  if (!from) return "";
  const match = from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1]?.toLowerCase() || "";
};

const includesAny = (value: string, keywords: string[]) => keywords.some((keyword) => value.includes(keyword));

const getSmartBucket = (analysis: { category: string; email_subject: string | null; email_from: string | null }): SmartBucket => {
  const subject = (analysis.email_subject || "").toLowerCase();
  const sender = (analysis.email_from || "").toLowerCase();
  const senderDomain = extractSenderDomain(analysis.email_from);
  const haystack = `${subject} ${sender} ${senderDomain}`;

  if (
    analysis.category === "task" ||
    includesAny(haystack, ["action required", "follow up", "reply needed", "meeting", "deadline", "urgent", "asap", "דחוף", "פגישה", "לטיפול", "משימה"])
  ) {
    return "action";
  }

  if (
    analysis.category === "payment" ||
    analysis.category === "bill" ||
    includesAny(haystack, ["invoice", "payment", "receipt", "charge", "billing", "due", "statement", "חשבון", "חשבונית", "תשלום", "חיוב", "קבלה"])
  ) {
    return "finance";
  }

  if (
    analysis.category === "shopping" ||
    includesAny(haystack, ["order", "shipping", "delivery", "amazon", "purchase", "shop", "tracking", "משלוח", "הזמנה", "קניה", "קנייה"])
  ) {
    return "shopping";
  }

  if (
    analysis.category === "newsletter" ||
    analysis.category === "social" ||
    includesAny(haystack, ["unsubscribe", "newsletter", "digest", "weekly update", "social", "promotion", "promotions", "mailchimp", "substack"])
  ) {
    return "low";
  }

  if (
    includesAny(haystack, ["update", "status", "summary", "digest", "notification", "report", "alert", "system", "עדכון", "התראה", "סיכום"])
  ) {
    return "updates";
  }

  return "personal";
};

const getSmartPriority = (
  analysis: { email_subject: string | null; email_from: string | null; category: string },
  smartBucket: SmartBucket
) => {
  const haystack = `${analysis.email_subject || ""} ${analysis.email_from || ""}`.toLowerCase();
  const hasUrgency = includesAny(haystack, ["urgent", "asap", "today", "deadline", "דחוף", "היום", "בהקדם"]);
  const hasDue = includesAny(haystack, ["invoice", "payment", "bill", "due", "receipt", "תשלום", "חשבונית", "חיוב"]);

  if (smartBucket === "action") return hasUrgency ? 5 : 4;
  if (smartBucket === "finance") return hasDue ? 4 : 3;
  if (smartBucket === "shopping") return 2.5;
  if (smartBucket === "updates") return 2;
  if (smartBucket === "personal") return 2.2;
  return 1;
};

const getSmartHeadline = (bucket: SmartBucket, isHe: boolean) => {
  const labels: Record<SmartBucket, string> = isHe
    ? {
        action: "מה דורש טיפול עכשיו",
        finance: "פיננסים ותשלומים",
        shopping: "קניות ומשלוחים",
        updates: "עדכונים שכדאי לסרוק",
        personal: "אישי ושוטף",
        low: "מיילים ברעש נמוך",
      }
    : {
        action: "What needs action now",
        finance: "Finance and bills",
        shopping: "Orders and deliveries",
        updates: "Updates worth scanning",
        personal: "Personal flow",
        low: "Low-noise email",
      };
  return labels[bucket];
};

const EmailIntegration = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { connections, analyses, loading, removeConnection, syncEmails, categorySummary } = useEmailIntegration();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(50);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [smartFilter, setSmartFilter] = useState<"all" | SmartBucket>("all");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "sender">("newest");
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    return localStorage.getItem("email-auto-sync-enabled") !== "false";
  });
  const aiChatHistory = useDashboardChatHistory("email-insights");

  const isHe = lang === "he" || lang === "ar";

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      payment: t("catPayment" as any),
      task: t("catTask" as any),
      newsletter: t("catNewsletter" as any),
      social: t("catSocial" as any),
      other: t("catOtherEmail" as any),
      bill: t("catPayment" as any),
      personal: t("catOtherEmail" as any),
      shopping: t("catShopping" as any),
    };
    return map[cat] || cat;
  };

  const getSmartLabel = (bucket: SmartBucket) => {
    if (isHe) {
      const labels: Record<SmartBucket, string> = {
        action: "דורש פעולה",
        finance: "פיננסים וחשבונות",
        shopping: "קניות ומשלוחים",
        updates: "עדכונים ומערכות",
        personal: "אישי ושוטף",
        low: "רעש נמוך",
      };
      return labels[bucket];
    }

    const labels: Record<SmartBucket, string> = {
      action: "Needs action",
      finance: "Finance",
      shopping: "Shopping",
      updates: "Updates",
      personal: "Personal",
      low: "Low priority",
    };
    return labels[bucket];
  };

  const handleSync = async (connId: string) => {
    setSyncing(connId);
    await syncEmails(connId);
    setSyncing(null);
  };

  const autoSyncConnections = useCallback(async () => {
    if (!autoSyncEnabled || loading || syncing) return;
    const now = Date.now();
    for (const conn of connections) {
      const lastSyncTs = conn.last_sync ? new Date(conn.last_sync).getTime() : 0;
      const staleEnough = !lastSyncTs || now - lastSyncTs > 10 * 60 * 1000;
      if (!staleEnough) continue;
      setSyncing(conn.id);
      await syncEmails(conn.id);
      setSyncing(null);
    }
  }, [autoSyncEnabled, loading, syncing, connections, syncEmails]);

  useEffect(() => {
    localStorage.setItem("email-auto-sync-enabled", String(autoSyncEnabled));
  }, [autoSyncEnabled]);

  useEffect(() => {
    if (!connections.length || !autoSyncEnabled) return;
    autoSyncConnections();
    const timer = window.setInterval(() => {
      autoSyncConnections();
    }, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [connections.length, autoSyncEnabled, autoSyncConnections]);

  const baseRecentEmails = useMemo(() => {
    return analyses.filter((a) => {
      if (!a.email_date) return false;
      return isAfter(new Date(a.email_date), subDays(new Date(), 14));
    });
  }, [analyses]);

  const smartInbox = useMemo(() => {
    const enriched = baseRecentEmails.map((analysis) => {
      const smartBucket = getSmartBucket(analysis);
      const smartPriority = getSmartPriority(analysis, smartBucket);
      const senderDomain = extractSenderDomain(analysis.email_from);
      return {
        ...analysis,
        smartBucket,
        smartPriority,
        senderDomain,
      };
    });

    const smartSummary = enriched.reduce((acc, email) => {
      acc[email.smartBucket] = (acc[email.smartBucket] || 0) + 1;
      return acc;
    }, {} as Record<SmartBucket, number>);

    const priorityQueue = [...enriched]
      .filter((email) => email.smartPriority >= 3)
      .sort((a, b) => {
        if (b.smartPriority !== a.smartPriority) return b.smartPriority - a.smartPriority;
        return new Date(b.email_date || 0).getTime() - new Date(a.email_date || 0).getTime();
      })
      .slice(0, 6);

    const senderDomains = Object.entries(
      enriched.reduce((acc, email) => {
        const key = email.senderDomain || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .filter(([domain]) => domain !== "unknown")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const bucketHighlights = (Object.keys(SMART_BUCKET_META) as SmartBucket[]).reduce((acc, bucket) => {
      acc[bucket] = enriched
        .filter((email) => email.smartBucket === bucket)
        .sort((a, b) => {
          if (b.smartPriority !== a.smartPriority) return b.smartPriority - a.smartPriority;
          return new Date(b.email_date || 0).getTime() - new Date(a.email_date || 0).getTime();
        })
        .slice(0, bucket === "low" ? 2 : 4);
      return acc;
    }, {} as Record<SmartBucket, typeof enriched>);

    const smartDigest = {
      actionDueNow: enriched.filter((email) => email.smartBucket === "action" && email.smartPriority >= 4).length,
      financeWatch: enriched.filter((email) => email.smartBucket === "finance").length,
      deliveryTrack: enriched.filter((email) => email.smartBucket === "shopping").length,
      lowNoise: enriched.filter((email) => email.smartBucket === "low").length,
    };

    return { enriched, smartSummary, priorityQueue, senderDomains, bucketHighlights, smartDigest };
  }, [baseRecentEmails]);

  const recentEmails = useMemo(() => {
    let filtered = [...smartInbox.enriched];
    if (categoryFilter !== "all") {
      filtered = filtered.filter(a => a.category === categoryFilter);
    }
    if (smartFilter !== "all") {
      filtered = filtered.filter(a => a.smartBucket === smartFilter);
    }
    if (sortMode === "oldest") {
      filtered.sort((a, b) => new Date(a.email_date!).getTime() - new Date(b.email_date!).getTime());
    } else if (sortMode === "sender") {
      filtered.sort((a, b) => (a.senderDomain || a.email_from || "").localeCompare(b.senderDomain || b.email_from || ""));
    } else {
      filtered.sort((a, b) => new Date(b.email_date!).getTime() - new Date(a.email_date!).getTime());
    }
    return filtered;
  }, [smartInbox.enriched, categoryFilter, smartFilter, sortMode]);

  const displayEmails = recentEmails.slice(0, displayCount);

  // Check if email is "sent" by the user
  const connectedEmails = connections.map(c => c.email_address.toLowerCase());

  const handleReviewEmails = async () => {
    if (recentEmails.length === 0) return;
    setReviewing(true);
    setReviewResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(isHe ? "יש להתחבר מחדש" : "Please sign in again"); return; }

      const emailSummary = recentEmails.slice(0, 30).map(e => ({
        subject: e.email_subject,
        from: e.email_from,
        date: e.email_date,
        category: e.category,
      }));

      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          type: "custom",
          prompt: lang === "he"
            ? `סקור את 14 הימים האחרונים של המיילים שלי ותן לי סיכום: מה חשוב, מה דורש תשומת לב, ומה אפשר להתעלם ממנו. הנה המיילים:\n${JSON.stringify(emailSummary, null, 2)}`
            : `Review my last 14 days of emails and give me a summary: what's important, what needs attention, and what can be ignored. Here are the emails:\n${JSON.stringify(emailSummary, null, 2)}`,
        },
      });
      if (error) throw error;
      setReviewResult(data?.result || data?.suggestion || (isHe ? "לא התקבלה תשובה" : "No response received"));
    } catch (e) {
      console.error("Review error:", e);
      toast.error(isHe ? "שגיאה בסקירת המיילים" : "Error reviewing emails");
    } finally {
      setReviewing(false);
    }
  };

  const sendAiMessage = async (chatInput: string) => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    aiChatHistory.setMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const emailSummary = recentEmails.slice(0, 30).map(e => ({
        subject: e.email_subject,
        from: e.email_from,
        date: e.email_date,
        category: e.category,
      }));

      const context = `הנה סיכום מיילים אחרונים (14 יום אחרונים):\n${JSON.stringify(emailSummary, null, 2)}`;

      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: chatInput,
          conversationHistory: [...aiChatHistory.messages, userMsg].slice(-20),
          customPrompt: `אתה עוזר אישי חכם שמנתח מיילים. ${context}\n\nהמשתמש שואל: ${chatInput}\n\nענה בעברית, השתמש באימוג'ים, תן תובנות מועילות.`,
        },
      });
      if (error) throw error;
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || "אין תשובה" }]);
    } catch {
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: isHe ? "שגיאה בקבלת תשובה" : "Error getting response" }]);
    }
    setAiLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* AI Chat Toggle */}
      <div className="flex justify-end">
        <Button size="sm" variant={showAiChat ? "default" : "outline"} onClick={() => setShowAiChat(!showAiChat)} className="gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          {isHe ? "שיחה עם AI" : "AI Chat"}
        </Button>
      </div>

      {showAiChat && (
        <AiChatPanel
          title={isHe ? "עוזר מיילים AI" : "Email AI Assistant"}
          messages={aiChatHistory.messages}
          loaded={aiChatHistory.loaded}
          aiLoading={aiLoading}
          archive={aiChatHistory.archive}
          onSend={sendAiMessage}
          onClearAndArchive={aiChatHistory.clearAndArchive}
          onLoadConversation={aiChatHistory.loadConversation}
          placeholder={isHe ? "שאל על המיילים שלך..." : "Ask about your emails..."}
          emptyText={isHe ? "שאל אותי על המיילים שלך ואני אעזור לך לנתח ולסדר אותם" : "Ask me about your emails and I'll help analyze them"}
        />
      )}
      <Card className="card-surface">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("emailAccounts" as any)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                <span>{isHe ? "סנכרון אוטומטי" : "Auto sync"}</span>
                <Button
                  variant={autoSyncEnabled ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setAutoSyncEnabled((prev) => !prev)}
                >
                  {autoSyncEnabled ? (isHe ? "פעיל" : "On") : (isHe ? "כבוי" : "Off")}
                </Button>
              </div>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
                <Plus className="h-3 w-3" />
                {t("addConnection" as any)}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t("noEmailConnections" as any)}</p>
              <p className="text-xs mt-1">{t("connectEmailDesc" as any)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conn.email_address}</p>
                    <p className="text-xs text-muted-foreground">
                      {conn.provider.toUpperCase()} · {conn.last_sync
                        ? `${t("lastSync" as any)}: ${format(new Date(conn.last_sync), "dd/MM HH:mm")}`
                        : t("neverSynced" as any)
                      }
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleSync(conn.id)} disabled={syncing === conn.id} className="gap-1">
                    <RefreshCw className={`h-3 w-3 ${syncing === conn.id ? "animate-spin" : ""}`} />
                    {t("sync" as any)}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                    if (confirm(t("confirmDisconnect" as any))) removeConnection(conn.id);
                  }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {Object.keys(categorySummary).length > 0 && (
        <Card className="card-surface">
          <CardHeader>
            <CardTitle className="text-sm">{t("emailSummary" as any)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categorySummary).map(([cat, count]) => {
                const Icon = CATEGORY_ICONS[cat] || Mail;
                return (
                  <Badge key={cat} variant="outline" className={`gap-1 ${CATEGORY_COLORS[cat] || ""}`}>
                    <Icon className="h-3 w-3" />
                    {getCategoryLabel(cat)}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {baseRecentEmails.length > 0 && (
        <Card className="card-surface">
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                {isHe ? "מיון אוטומטי חכם של המיילים" : "Smart automatic mail sorting"}
              </CardTitle>
              <Select value={smartFilter} onValueChange={(value) => setSmartFilter(value as "all" | SmartBucket)}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHe ? "כל המסלולים" : "All lanes"}</SelectItem>
                  {(Object.keys(SMART_BUCKET_META) as SmartBucket[]).map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>{getSmartLabel(bucket)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-background p-3">
                <div className="text-xs text-muted-foreground">{isHe ? "צריך טיפול מיידי" : "Action now"}</div>
                <div className="mt-1 text-2xl font-semibold">{smartInbox.smartDigest.actionDueNow}</div>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <div className="text-xs text-muted-foreground">{isHe ? "מעקב פיננסי" : "Finance watch"}</div>
                <div className="mt-1 text-2xl font-semibold">{smartInbox.smartDigest.financeWatch}</div>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <div className="text-xs text-muted-foreground">{isHe ? "משלוחים והזמנות" : "Orders & shipping"}</div>
                <div className="mt-1 text-2xl font-semibold">{smartInbox.smartDigest.deliveryTrack}</div>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <div className="text-xs text-muted-foreground">{isHe ? "רעש נמוך" : "Low-noise mail"}</div>
                <div className="mt-1 text-2xl font-semibold">{smartInbox.smartDigest.lowNoise}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(SMART_BUCKET_META) as SmartBucket[]).map((bucket) => {
                const Icon = SMART_BUCKET_META[bucket].icon;
                const count = smartInbox.smartSummary[bucket] || 0;
                return (
                  <Badge key={bucket} variant="outline" className={`gap-1 ${SMART_BUCKET_META[bucket].color}`}>
                    <Icon className="h-3 w-3" />
                    {getSmartLabel(bucket)}: {count}
                  </Badge>
                );
              })}
            </div>

            {smartInbox.priorityQueue.length > 0 && (
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-2 text-sm font-medium">{isHe ? "תור תשומת לב מיידית" : "Needs attention now"}</div>
                <div className="space-y-2">
                  {smartInbox.priorityQueue.map((email) => {
                    const Icon = SMART_BUCKET_META[email.smartBucket].icon;
                    return (
                      <div key={email.id} className="flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-sm">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{email.email_subject || (isHe ? "(ללא נושא)" : "(No subject)")}</div>
                          <div className="text-xs text-muted-foreground">
                            {email.email_from || "-"} {email.senderDomain ? `· ${email.senderDomain}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${SMART_BUCKET_META[email.smartBucket].color}`}>
                          {getSmartLabel(email.smartBucket)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {smartInbox.senderDomains.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {smartInbox.senderDomains.map(([domain, count]) => (
                  <span key={domain} className="rounded-full border bg-background px-3 py-1 text-muted-foreground">
                    {domain} · {count}
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-3 xl:grid-cols-3">
              {(Object.keys(SMART_BUCKET_META) as SmartBucket[])
                .filter((bucket) => (smartInbox.bucketHighlights[bucket] || []).length > 0)
                .map((bucket) => {
                  const Icon = SMART_BUCKET_META[bucket].icon;
                  return (
                    <div key={bucket} className="rounded-xl border bg-background p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <div className={`rounded-lg p-2 ${SMART_BUCKET_META[bucket].color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{getSmartHeadline(bucket, isHe)}</div>
                          <div className="text-xs text-muted-foreground">{getSmartLabel(bucket)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {smartInbox.bucketHighlights[bucket].map((email) => (
                          <div key={email.id} className="rounded-lg border bg-muted/20 px-3 py-2">
                            <div className="truncate text-sm font-medium">
                              {email.email_subject || (isHe ? "(ללא נושא)" : "(No subject)")}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">{email.senderDomain || email.email_from || "-"}</span>
                              <span>{email.email_date ? format(new Date(email.email_date), "dd/MM") : "-"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Emails with filters */}
      {(recentEmails.length > 0 || categoryFilter !== "all" || smartFilter !== "all") && (
        <Card className="card-surface">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {isHe ? `מיילים אחרונים (14 יום) — ${recentEmails.length}` : `Recent Emails (14 days) — ${recentEmails.length}`}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {/* Category filter */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all" as any)}</SelectItem>
                    <SelectItem value="payment">{t("catPayment" as any)}</SelectItem>
                    <SelectItem value="task">{t("catTask" as any)}</SelectItem>
                    <SelectItem value="newsletter">{t("catNewsletter" as any)}</SelectItem>
                    <SelectItem value="social">{t("catSocial" as any)}</SelectItem>
                    <SelectItem value="personal">{t("catOtherEmail" as any)}</SelectItem>
                  </SelectContent>
                </Select>
                {/* Sort */}
                <Select value={sortMode} onValueChange={(v) => setSortMode(v as any)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{t("newestFirst" as any)}</SelectItem>
                    <SelectItem value="oldest">{t("oldestFirst" as any)}</SelectItem>
                    <SelectItem value="sender">{t("bySender" as any)}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={handleReviewEmails} disabled={reviewing} className="gap-1 h-8">
                  {reviewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {isHe ? "סקור AI" : "AI Review"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewResult && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm whitespace-pre-wrap">
                <div className="flex items-center gap-2 mb-2 font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  {isHe ? "סקירת AI" : "AI Review"}
                </div>
                {reviewResult}
              </div>
            )}

            <div className="space-y-1">
              {displayEmails.map((a) => {
                const Icon = CATEGORY_ICONS[a.category] || Mail;
                const SmartIcon = SMART_BUCKET_META[a.smartBucket].icon;
                const isSent = a.email_from && connectedEmails.includes(a.email_from.toLowerCase());
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.email_subject || (isHe ? "(ללא נושא)" : "(No subject)")}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{a.email_from}</span>
                    {a.senderDomain && (
                      <span className="text-[10px] text-muted-foreground">{a.senderDomain}</span>
                    )}
                    {isSent && <Badge variant="secondary" className="text-[9px]">{t("sent" as any)}</Badge>}
                    {a.email_date && (
                      <span className="text-[10px] text-muted-foreground">{format(new Date(a.email_date), "dd/MM")}</span>
                    )}
                    <Badge variant="outline" className={`text-[9px] ${CATEGORY_COLORS[a.category] || ""}`}>
                      {getCategoryLabel(a.category)}
                    </Badge>
                    <Badge variant="outline" className={`gap-1 text-[9px] ${SMART_BUCKET_META[a.smartBucket].color}`}>
                      <SmartIcon className="h-3 w-3" />
                      {getSmartLabel(a.smartBucket)}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {recentEmails.length > displayCount && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisplayCount(prev => prev + 30)}
                className="w-full text-xs"
              >
                {t("showMore" as any)} ({recentEmails.length - displayCount} {isHe ? "נותרו" : "remaining"})
              </Button>
            )}
            {displayCount > 30 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisplayCount(30)}
                className="w-full text-xs"
              >
                {t("showLess" as any)}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Old analyses */}
      {analyses.length > 0 && recentEmails.length === 0 && categoryFilter === "all" && (
        <Card className="card-surface">
          <CardHeader>
            <CardTitle className="text-sm">{t("recentEmails" as any)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {analyses.slice(0, 20).map((a) => {
                const Icon = CATEGORY_ICONS[a.category] || Mail;
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.email_subject || (isHe ? "(ללא נושא)" : "(No subject)")}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{a.email_from}</span>
                    <Badge variant="outline" className={`text-[9px] ${CATEGORY_COLORS[a.category] || ""}`}>
                      {getCategoryLabel(a.category)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <EmailConnectionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default EmailIntegration;
