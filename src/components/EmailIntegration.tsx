import { useState } from "react";
import { useEmailIntegration } from "@/hooks/useEmailIntegration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Trash2, RefreshCw, Loader2, Inbox, CreditCard, ListTodo, ShoppingCart, FileText, User, Sparkles, Eye } from "lucide-react";
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
  const [showAllEmails, setShowAllEmails] = useState(false);

  const isHe = lang === "he" || lang === "ar";

  const handleSync = async (connId: string) => {
    setSyncing(connId);
    await syncEmails(connId);
    setSyncing(null);
  };

  const recentEmails = analyses.filter((a) => {
    if (!a.email_date) return false;
    return isAfter(new Date(a.email_date), subDays(new Date(), 14));
  });

  const displayEmails = showAllEmails ? recentEmails : recentEmails.slice(0, 10);

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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("emailAccounts" as any) || "חשבונות מייל"}
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
              <Plus className="h-3 w-3" />
              {t("addConnection" as any) || "חבר חשבון"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t("noEmailConnections" as any) || "אין חשבונות מייל מחוברים"}</p>
              <p className="text-xs mt-1">{t("connectEmailDesc" as any) || "חבר Gmail, Outlook או IMAP לניתוח אוטומטי"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conn.email_address}</p>
                    <p className="text-xs text-muted-foreground">
                      {conn.provider.toUpperCase()} · {conn.last_sync
                        ? `${t("lastSync" as any) || "סנכרון אחרון"}: ${format(new Date(conn.last_sync), "dd/MM HH:mm")}`
                        : t("neverSynced" as any) || "לא סונכרן"
                      }
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing === conn.id}
                    className="gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing === conn.id ? "animate-spin" : ""}`} />
                    {t("sync" as any) || "סנכרן"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      if (confirm(t("confirmDisconnect" as any) || "לנתק את חשבון המייל?")) removeConnection(conn.id);
                    }}
                  >
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("emailSummary" as any) || "סיכום מיילים"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categorySummary).map(([cat, count]) => {
                const Icon = CATEGORY_ICONS[cat] || Mail;
                return (
                  <Badge key={cat} variant="outline" className={`gap-1 ${CATEGORY_COLORS[cat] || ""}`}>
                    <Icon className="h-3 w-3" />
                    {cat}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Emails (last 14 days) with AI Review */}
      {recentEmails.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {isHe ? `מיילים אחרונים (14 יום) — ${recentEmails.length}` : `Recent Emails (14 days) — ${recentEmails.length}`}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReviewEmails}
                disabled={reviewing}
                className="gap-1"
              >
                {reviewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {isHe ? "סקור מיילים עם AI" : "AI Email Review"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* AI Review Result */}
            {reviewResult && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm whitespace-pre-wrap">
                <div className="flex items-center gap-2 mb-2 font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  {isHe ? "סקירת AI" : "AI Review"}
                </div>
                {reviewResult}
              </div>
            )}

            {/* Email List */}
            <div className="space-y-1">
              {displayEmails.map((a) => {
                const Icon = CATEGORY_ICONS[a.category] || Mail;
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.email_subject || (isHe ? "(ללא נושא)" : "(No subject)")}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{a.email_from}</span>
                    {a.email_date && (
                      <span className="text-[10px] text-muted-foreground">{format(new Date(a.email_date), "dd/MM")}</span>
                    )}
                    <Badge variant="outline" className={`text-[9px] ${CATEGORY_COLORS[a.category] || ""}`}>
                      {a.category}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {recentEmails.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllEmails(!showAllEmails)}
                className="w-full text-xs"
              >
                {showAllEmails
                  ? (isHe ? "הצג פחות" : "Show less")
                  : (isHe ? `הצג את כל ${recentEmails.length} המיילים` : `Show all ${recentEmails.length} emails`)}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Old analyses that are older than 14 days */}
      {analyses.length > 0 && recentEmails.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("recentEmails" as any) || "מיילים אחרונים"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {analyses.slice(0, 20).map((a) => {
                const Icon = CATEGORY_ICONS[a.category] || Mail;
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{a.email_subject || "(ללא נושא)"}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{a.email_from}</span>
                    <Badge variant="outline" className={`text-[9px] ${CATEGORY_COLORS[a.category] || ""}`}>
                      {a.category}
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
