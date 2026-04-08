import { useState, useMemo } from "react";
import { useEmailIntegration } from "@/hooks/useEmailIntegration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Plus, Trash2, RefreshCw, Loader2, Inbox, CreditCard, ListTodo, ShoppingCart, FileText, User, Sparkles, Eye, ArrowUpDown } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import EmailConnectionDialog from "@/components/EmailConnectionDialog";
import { format, subDays, isAfter } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

const EmailIntegration = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { connections, analyses, loading, removeConnection, syncEmails, categorySummary } = useEmailIntegration();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "sender">("newest");

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

  const handleSync = async (connId: string) => {
    setSyncing(connId);
    await syncEmails(connId);
    setSyncing(null);
  };

  const recentEmails = useMemo(() => {
    let filtered = analyses.filter((a) => {
      if (!a.email_date) return false;
      return isAfter(new Date(a.email_date), subDays(new Date(), 14));
    });
    if (categoryFilter !== "all") {
      filtered = filtered.filter(a => a.category === categoryFilter);
    }
    // Sort
    if (sortMode === "oldest") {
      filtered.sort((a, b) => new Date(a.email_date!).getTime() - new Date(b.email_date!).getTime());
    } else if (sortMode === "sender") {
      filtered.sort((a, b) => (a.email_from || "").localeCompare(b.email_from || ""));
    }
    // newest is default order from DB
    return filtered;
  }, [analyses, categoryFilter, sortMode]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Connected Accounts */}
      <Card className="card-surface">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("emailAccounts" as any)}
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
              <Plus className="h-3 w-3" />
              {t("addConnection" as any)}
            </Button>
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

      {/* Recent Emails with filters */}
      {(recentEmails.length > 0 || categoryFilter !== "all") && (
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
                const isSent = a.email_from && connectedEmails.includes(a.email_from.toLowerCase());
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.email_subject || (isHe ? "(ללא נושא)" : "(No subject)")}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{a.email_from}</span>
                    {isSent && <Badge variant="secondary" className="text-[9px]">{t("sent" as any)}</Badge>}
                    {a.email_date && (
                      <span className="text-[10px] text-muted-foreground">{format(new Date(a.email_date), "dd/MM")}</span>
                    )}
                    <Badge variant="outline" className={`text-[9px] ${CATEGORY_COLORS[a.category] || ""}`}>
                      {getCategoryLabel(a.category)}
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
