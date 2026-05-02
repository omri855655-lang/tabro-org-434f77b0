import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY,
  ADMIN_MAIL_SUPABASE_URL,
} from "@/integrations/supabase/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users, LogIn, ClipboardList, ShieldCheck, ArrowRight,
  UserPlus, Trash2, RefreshCw, Crown, Mail, Loader2, FileText, Save,
  Search, Send
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/useLanguage";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Stats {
  totalUsers: number;
  recentSignups: number;
  recentLogins: number;
  activeUsers30d?: number;
  loginEvents30d?: number;
  totalTasks: number;
  totalLoginLogs: number;
  loginLogs: { user_email: string; logged_in_at: string }[];
  loginByUser?: { user_email: string; count: number; last_login_at: string }[];
  adminEmails: { email: string; user_id: string; created_at: string }[];
  userList: { email: string; created_at: string; last_sign_in_at: string | null }[];
  mailboxAddress: string;
  recentEmailLog: {
    message_id: string | null;
    template_name: string;
    recipient_email: string;
    status: string;
    error_message: string | null;
    created_at: string;
    metadata?: {
      subject?: string;
      category?: string;
      userEmail?: string;
      from?: string;
      messagePreview?: string;
      body_preview?: string;
      body?: string;
      messageBody?: string;
      sent_by?: string;
      reply_to?: string;
      followUpSuggested?: string;
    } | null;
  }[];
}

interface MailboxData {
  mailboxAddress: string;
  recentEmailLog: Stats["recentEmailLog"];
  inboxCount: number;
  outboxCount: number;
}

const ADMIN_PASS_KEY = "tabro_admin_unlocked";
const ADMIN_PASS_VALUE_KEY = "tabro_admin_password";
const ADMIN_MAIL_UI_VERSION = "admin-mail-ui-2026-04-18-v1";

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [mailbox, setMailbox] = useState<MailboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [passUnlocked, setPassUnlocked] = useState(() => sessionStorage.getItem(ADMIN_PASS_KEY) === "1" || localStorage.getItem(ADMIN_PASS_KEY) === "1");
  const [passInput, setPassInput] = useState(() => sessionStorage.getItem(ADMIN_PASS_VALUE_KEY) || localStorage.getItem(ADMIN_PASS_VALUE_KEY) || "");
  const [passError, setPassError] = useState(false);
  const [landingContent, setLandingContent] = useState<Record<string, { he: string; en: string }>>({});
  const [landingEditing, setLandingEditing] = useState<Record<string, { he: string; en: string }>>({});
  const [savingLanding, setSavingLanding] = useState(false);
  // Mailbox state
  const [emailSearch, setEmailSearch] = useState("");
  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [emailTab, setEmailTab] = useState<"inbox" | "outbox">("inbox");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeStatus, setComposeStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Stats["recentEmailLog"][number] | null>(null);

  const callAppAdminAnalytics = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-analytics", { body });
    return { data, ok: !error && !data?.error, error: error?.message || data?.error || null };
  }, []);

  const callAdminAnalytics = useCallback(async (body: Record<string, unknown>, includePassword = true) => {
    const password = passInput || sessionStorage.getItem(ADMIN_PASS_VALUE_KEY) || localStorage.getItem(ADMIN_PASS_VALUE_KEY) || "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY}`,
    };

    if (includePassword && password) {
      headers["x-admin-password"] = password;
    }

    const res = await fetch(`${ADMIN_MAIL_SUPABASE_URL}/functions/v1/admin-analytics`, {
      method: "POST",
      headers,
      body: JSON.stringify(includePassword && password ? { ...body, admin_password: password } : body),
    });

    const data = await res.json().catch(() => null);
    return { data, ok: res.ok };
  }, [passInput]);

  const fetchMailbox = useCallback(async () => {
    const { data: mailboxData, ok: mailOk } = await callAdminAnalytics({ action: "mailbox" });
    if (!mailOk || mailboxData?.error) {
      return;
    }
    setMailbox({
      mailboxAddress: mailboxData?.mailboxAddress || "info@tabro.org",
      recentEmailLog: mailboxData?.recentEmailLog || [],
      inboxCount: mailboxData?.inboxCount || 0,
      outboxCount: mailboxData?.outboxCount || 0,
    });
  }, [callAdminAnalytics]);
  const isHe = dir === "rtl";
  const parseMailRow = useCallback((row: Stats["recentEmailLog"][number]) => {
    const metadata = row.metadata || {};
    return {
      subject: metadata.subject || (isHe ? "ללא נושא" : "No subject"),
      from: metadata.userEmail || metadata.from || metadata.sent_by || row.recipient_email,
      body: metadata.messageBody || metadata.body || metadata.messagePreview || metadata.body_preview || "",
      preview: metadata.messagePreview || metadata.body_preview || metadata.messageBody || metadata.body || "",
      category: metadata.category || "",
      followUpSuggested: metadata.followUpSuggested || "",
      replyTo: metadata.reply_to || metadata.userEmail || metadata.from || "",
    };
  }, [isHe]);

  const buildMailboxSearchText = useCallback((row: Stats["recentEmailLog"][number]) => {
    const parsed = parseMailRow(row);
    return [
      row.template_name,
      row.recipient_email,
      parsed.subject,
      parsed.from,
      parsed.preview,
      parsed.body,
      parsed.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }, [parseMailRow]);

  const openReplyComposer = useCallback((row: Stats["recentEmailLog"][number]) => {
    const parsed = parseMailRow(row);
    const replyTarget = String(parsed.replyTo || "").trim();
    if (!replyTarget || replyTarget === "אנונימי" || replyTarget === "Anonymous") {
      toast.error(isHe ? "אין כתובת מענה זמינה לפנייה הזו." : "No reply address is available for this message.");
      return;
    }
    setComposeTo(replyTarget);
    setComposeSubject(`${isHe ? "Re: " : "Re: "}${parsed.subject}`);
    setComposeBody(parsed.body ? `\n\n---\n${parsed.body}` : "");
    setEmailTab("outbox");
  }, [isHe, parseMailRow]);
  const copy = isHe
    ? {
        adminAccess: "גישה לאדמין",
        enterPassword: "הכנס סיסמת אדמין",
        wrongPassword: "סיסמה שגויה",
        unlock: "פתח גישה",
        noPermission: "אין לך הרשאה לצפות בדף זה",
        backToPersonal: "חזרה לאזור האישי",
        creatorDashboard: "דשבורד יוצר",
        refresh: "רענן",
        backToPersonalShort: "חזרה לאזור האישי",
        addAdminSuccess: "מנהל נוסף בהצלחה",
        removeAdminSuccess: "מנהל הוסר",
        emailSent: "המייל נשלח!",
      }
    : {
        adminAccess: "Admin Access",
        enterPassword: "Enter admin password",
        wrongPassword: "Wrong password",
        unlock: "Unlock",
        noPermission: "You don't have permission to view this page",
        backToPersonal: "Back to Personal Area",
        creatorDashboard: "Creator Dashboard",
        refresh: "Refresh",
        backToPersonalShort: "Back to Personal",
        addAdminSuccess: "Admin added successfully",
        removeAdminSuccess: "Admin removed",
        emailSent: "Email sent!",
      };

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: appData, ok: appOk, error: appError }, { data: mailboxData, ok: mailOk }] = await Promise.all([
      callAppAdminAnalytics({ action: "stats" }),
      callAdminAnalytics({ action: "mailbox" }),
    ]);

    if (!appOk) {
      if (appData?.error === "Forbidden") {
        setIsAdmin(false);
      } else {
        toast.error(appError || t("error" as any));
      }
      setLoading(false);
      return;
    }

    if (!mailOk || mailboxData?.error) {
      if (mailboxData?.error === "Unauthorized") {
        setPassUnlocked(false);
        sessionStorage.removeItem(ADMIN_PASS_KEY);
        sessionStorage.removeItem(ADMIN_PASS_VALUE_KEY);
        localStorage.removeItem(ADMIN_PASS_KEY);
        localStorage.removeItem(ADMIN_PASS_VALUE_KEY);
        toast.error(isHe ? "סיסמת האדמין התיישנה או שונתה. יש להזין אותה מחדש." : "Admin password expired or changed. Please enter it again.");
      } else {
        toast.error(isHe ? "נתוני הדואר באדמין לא נטענו כרגע." : "Admin mailbox data failed to load.");
      }
      setLoading(false);
      return;
    }

    const normalizedUserList = appData?.userList || [];
    const normalizedLoginLogs = appData?.loginLogs || [];
    const derivedTotalUsers = Math.max(appData?.totalUsers || 0, normalizedUserList.length);
    const derivedRecentSignups = Math.max(
      appData?.recentSignups || 0,
      normalizedUserList.filter((user: any) => {
        const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
        const sinceTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return createdAt >= sinceTs;
      }).length,
    );
    const derivedActiveUsers30d = Math.max(
      appData?.activeUsers30d || 0,
      normalizedUserList.filter((user: any) => {
        const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
        const sinceTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return lastSignIn >= sinceTs;
      }).length,
    );
    const derivedLoginEvents30d = Math.max(
      appData?.loginEvents30d || 0,
      normalizedLoginLogs.filter((log: any) => {
        const when = log?.logged_in_at ? new Date(log.logged_in_at).getTime() : 0;
        const sinceTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return when >= sinceTs;
      }).length,
    );

    const data: Stats = {
      ...appData,
      totalUsers: derivedTotalUsers,
      recentSignups: derivedRecentSignups,
      activeUsers30d: derivedActiveUsers30d,
      loginEvents30d: derivedLoginEvents30d,
      mailboxAddress: mailboxData?.mailboxAddress || "info@tabro.org",
      recentEmailLog: mailboxData?.recentEmailLog || [],
    };

    setIsAdmin(true);
    setStats(data);
    setMailbox({
      mailboxAddress: mailboxData?.mailboxAddress || "info@tabro.org",
      recentEmailLog: mailboxData?.recentEmailLog || [],
      inboxCount: mailboxData?.inboxCount || 0,
      outboxCount: mailboxData?.outboxCount || 0,
    });
    // Fetch landing content
    const { data: lc } = await supabase.from("landing_content").select("key, value_he, value_en");
    if (lc) {
      const map: Record<string, { he: string; en: string }> = {};
      const editMap: Record<string, { he: string; en: string }> = {};
      lc.forEach((row: any) => { map[row.key] = { he: row.value_he, en: row.value_en }; editMap[row.key] = { he: row.value_he, en: row.value_en }; });
      setLandingContent(map);
      setLandingEditing(editMap);
    }
    setLoading(false);
  }, [user, callAdminAnalytics, callAppAdminAnalytics, isHe, t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    fetchStats();
  }, [user, authLoading, navigate, fetchStats]);

  useEffect(() => {
    if (!passUnlocked || !user) return;
    const interval = window.setInterval(() => {
      fetchMailbox();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [passUnlocked, user, fetchMailbox]);

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    const { data, ok } = await callAppAdminAnalytics({ action: "add_admin", email: newAdminEmail.trim() });
    setAddingAdmin(false);
    if (!ok || data?.error) {
      toast.error(data?.error || t("error" as any));
      return;
    }
    toast.success(copy.addAdminSuccess);
    setNewAdminEmail("");
    fetchStats();
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { data, ok } = await callAppAdminAnalytics({ action: "remove_admin", user_id: userId });
    if (!ok || data?.error) {
      toast.error(data?.error || t("error" as any));
      return;
    }
    toast.success(copy.removeAdminSuccess);
    fetchStats();
  };

  const handlePassSubmit = async () => {
    try {
      const { data } = await callAdminAnalytics({ action: "verify_password", password: passInput }, false);
      if (data?.ok) {
        sessionStorage.setItem(ADMIN_PASS_KEY, "1");
        sessionStorage.setItem(ADMIN_PASS_VALUE_KEY, passInput);
        localStorage.setItem(ADMIN_PASS_KEY, "1");
        localStorage.setItem(ADMIN_PASS_VALUE_KEY, passInput);
        setPassUnlocked(true);
        setPassError(false);
        return;
      }

      setPassError(true);
    } catch {
      setPassError(true);
      toast.error(isHe ? "שגיאה בבדיקת סיסמת האדמין" : "Error verifying admin password");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!passUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={dir}>
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-lg font-bold">{copy.adminAccess}</h2>
            <Input
              type="password"
              placeholder={copy.enterPassword}
              value={passInput}
              onChange={(e) => { setPassInput(e.target.value); setPassError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handlePassSubmit()}
              dir="ltr"
            />
            {passError && <p className="text-sm text-destructive">{copy.wrongPassword}</p>}
            <Button onClick={handlePassSubmit} className="w-full">{copy.unlock}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={dir}>
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldCheck className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-xl font-bold">{copy.noPermission}</h2>
            <Button onClick={() => navigate("/personal")} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              {copy.backToPersonal}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(dir === "rtl" ? "he-IL" : "en-US", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir={dir}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">{copy.creatorDashboard}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchStats(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> {copy.refresh}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/personal")}>
              {copy.backToPersonalShort}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "משתמשים רשומים" : "Registered Users"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeUsers30d ?? stats?.recentSignups ?? 0}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "משתמשים פעילים (30 יום)" : "Active Users (30d)"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <LogIn className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.loginEvents30d ?? stats?.recentLogins ?? 0}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "אירועי כניסה (30 יום)" : "Login Events (30d)"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalTasks ?? 0}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "משימות במערכת" : "Total Tasks"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" /> {isHe ? "פעילות משתמשים" : "User Activity"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.loginByUser?.length ? (
              <p className="text-sm text-muted-foreground">{isHe ? "אין נתוני כניסה זמינים כרגע." : "No login activity available yet."}</p>
            ) : (
              <div className="overflow-auto max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isHe ? "משתמש" : "User"}</TableHead>
                      <TableHead>{isHe ? "כניסות (30 יום)" : "Logins (30d)"}</TableHead>
                      <TableHead>{isHe ? "כניסה אחרונה" : "Last login"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.loginByUser.map((entry, i) => (
                      <TableRow key={`${entry.user_email}-${i}`}>
                        <TableCell dir="ltr">{entry.user_email}</TableCell>
                        <TableCell>{entry.count}</TableCell>
                        <TableCell>{formatDate(entry.last_login_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> {isHe ? "ניהול מנהלים" : "Admin Management"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={isHe ? "אימייל של מנהל חדש..." : "New admin email..."}
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                dir="ltr"
                className="max-w-sm"
              />
              <Button onClick={handleAddAdmin} disabled={addingAdmin || !newAdminEmail.trim()}>
                {addingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : (isHe ? "הוסף מנהל" : "Add Admin")}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isHe ? "אימייל" : "Email"}</TableHead>
                  <TableHead>{isHe ? "נוסף בתאריך" : "Added"}</TableHead>
                  <TableHead>{isHe ? "פעולות" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.adminEmails?.map((admin) => (
                  <TableRow key={admin.user_id}>
                    <TableCell dir="ltr">{admin.email}</TableCell>
                    <TableCell>{formatDate(admin.created_at)}</TableCell>
                    <TableCell>
                      {admin.email !== user?.email ? (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveAdmin(admin.user_id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{isHe ? "את/ה" : "You"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> {isHe ? "רשימת משתמשים" : "User List"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isHe ? "אימייל" : "Email"}</TableHead>
                    <TableHead>{isHe ? "תאריך הרשמה" : "Registered"}</TableHead>
                    <TableHead>{isHe ? "כניסה אחרונה" : "Last Login"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.userList?.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell dir="ltr">{u.email}</TableCell>
                      <TableCell>{formatDate(u.created_at)}</TableCell>
                      <TableCell>{formatDate(u.last_sign_in_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {/* Landing Page Content Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> {isHe ? "עריכת דף נחיתה" : "Landing Page Editor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(landingEditing).length === 0 ? (
              <p className="text-sm text-muted-foreground">{isHe ? "טוען תוכן..." : "Loading content..."}</p>
            ) : (
              <>
                {Object.entries(landingEditing).map(([key, val]) => (
                  <div key={key} className="space-y-2 p-3 rounded-lg border bg-muted/30">
                    <p className="text-xs font-mono text-muted-foreground">{key}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">עברית</label>
                        <Input
                          value={val.he}
                          onChange={(e) => setLandingEditing(prev => ({ ...prev, [key]: { ...prev[key], he: e.target.value } }))}
                          dir="rtl"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">English</label>
                        <Input
                          value={val.en}
                          onChange={(e) => setLandingEditing(prev => ({ ...prev, [key]: { ...prev[key], en: e.target.value } }))}
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={async () => {
                    setSavingLanding(true);
                    for (const [key, val] of Object.entries(landingEditing)) {
                      await supabase.from("landing_content").upsert({ key, value_he: val.he, value_en: val.en }, { onConflict: "key" });
                    }
                    setSavingLanding(false);
                    toast.success(isHe ? "דף נחיתה עודכן!" : "Landing page updated!");
                  }}
                  disabled={savingLanding}
                  className="gap-2"
                >
                  {savingLanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isHe ? "שמור שינויים" : "Save Changes"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
          </div>

        {/* Company Mailbox */}
        <div className="xl:sticky xl:top-6 h-fit">
        <Card className="card-surface" dir={dir}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isHe ? "text-right" : "text-left"}`}>
              <Mail className="h-5 w-5" /> {isHe ? "תיבת מייל של החברה" : "Company Mailbox"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-foreground">
                {isHe ? `כתובת התיבה: ${mailbox?.mailboxAddress || stats?.mailboxAddress || "info@tabro.org"}` : `Mailbox address: ${mailbox?.mailboxAddress || stats?.mailboxAddress || "info@tabro.org"}`}
              </p>
              <p className="mt-1 text-muted-foreground">
                {isHe
                  ? "הפניות מטופס האתר והשליחה היוצאת מוצגות כאן יחד. מייל חיצוני רגיל ל-info@tabro.org עדיין דורש חיבור inbox נכנס מלא, והוא לא זהה לפניות האתר."
                  : "Website contact submissions and outgoing messages are shown here together. Regular external email sent to info@tabro.org still requires a full inbound inbox pipeline and is not the same as website contact submissions."}
              </p>
            </div>
            {/* Inbox / Outbox tabs */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setEmailTab("inbox")} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${emailTab === "inbox" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {isHe ? `📥 דואר נכנס (${mailbox?.inboxCount ?? 0})` : `📥 Inbox (${mailbox?.inboxCount ?? 0})`}
              </button>
              <button onClick={() => setEmailTab("outbox")} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${emailTab === "outbox" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {isHe ? `📤 דואר יוצא (${mailbox?.outboxCount ?? 0})` : `📤 Outbox (${mailbox?.outboxCount ?? 0})`}
              </button>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder={isHe ? "חיפוש לפי נמען או תבנית..." : "Search by recipient or template..."} value={emailSearch} onChange={e => setEmailSearch(e.target.value)} className="pr-9" dir="ltr" />
              </div>
              <Select value={emailStatusFilter} onValueChange={setEmailStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHe ? "כל הסטטוסים" : "All statuses"}</SelectItem>
                  <SelectItem value="sent">{isHe ? "נשלח" : "Sent"}</SelectItem>
                  <SelectItem value="failed">{isHe ? "נכשל" : "Failed"}</SelectItem>
                  <SelectItem value="pending">{isHe ? "ממתין" : "Pending"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {emailTab === "inbox" ? (
              /* Inbox — contact form submissions */
              (() => {
                const inboxEmails = (mailbox?.recentEmailLog || []).filter(e => e.template_name === "contact-form" || e.template_name === "contact_form");
                const filteredInbox = inboxEmails.filter(e => {
                  const matchSearch = !emailSearch || buildMailboxSearchText(e).includes(emailSearch.toLowerCase());
                  const matchStatus = emailStatusFilter === "all" || e.status === emailStatusFilter;
                  return matchSearch && matchStatus;
                });
                return filteredInbox.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{isHe ? "אין פניות שנכנסו עדיין." : "No incoming messages yet."}</p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isHe ? "פתח" : "Open"}</TableHead>
                          <TableHead>{isHe ? "נושא" : "Subject"}</TableHead>
                          <TableHead>{isHe ? "שולח" : "From"}</TableHead>
                          <TableHead>{isHe ? "סוג" : "Category"}</TableHead>
                          <TableHead>{isHe ? "תאריך" : "Date"}</TableHead>
                          <TableHead>{isHe ? "סטטוס" : "Status"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInbox.map((e, index) => {
                          const parsed = parseMailRow(e);
                          return (
                          <TableRow key={`${e.message_id || e.created_at}-${index}`}>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedEmail(e)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell className="max-w-[280px]">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  {parsed.subject}
                                </p>
                                {parsed.preview && (
                                  <p className="line-clamp-2 text-xs text-muted-foreground">
                                    {parsed.preview}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm" dir="ltr">
                              {parsed.from}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {parsed.category || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString(isHe ? "he-IL" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                            <TableCell>
                              <Badge variant={e.status === "sent" ? "default" : e.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
                              {parsed.followUpSuggested && (
                                <p className="mt-1 text-[10px] text-primary">{parsed.followUpSuggested}</p>
                              )}
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()
            ) : (
              /* Outbox — all sent emails */
              <>
                {!(mailbox?.recentEmailLog?.length) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{isHe ? "עדיין אין אירועי מייל שנשמרו במערכת." : "No email events have been logged yet."}</p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-96">
                    <Table>
                        <TableHeader>
                          <TableRow>
                          <TableHead>{isHe ? "פתח" : "Open"}</TableHead>
                          <TableHead>{isHe ? "תבנית" : "Template"}</TableHead>
                          <TableHead>{isHe ? "נושא" : "Subject"}</TableHead>
                          <TableHead>{isHe ? "נמען" : "Recipient"}</TableHead>
                          <TableHead>{isHe ? "תאריך" : "Date"}</TableHead>
                          <TableHead>{isHe ? "סטטוס" : "Status"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(mailbox?.recentEmailLog || [])
                          .filter(e => {
                            const matchSearch = !emailSearch || buildMailboxSearchText(e).includes(emailSearch.toLowerCase());
                            const matchStatus = emailStatusFilter === "all" || e.status === emailStatusFilter;
                            return matchSearch && matchStatus;
                          })
                          .map((e, index) => {
                          const parsed = parseMailRow(e);
                          return (
                          <TableRow key={`${e.message_id || e.created_at}-${index}`}>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedEmail(e)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell className="text-sm">{e.template_name}</TableCell>
                            <TableCell className="max-w-[220px]">
                              <div className="text-sm font-medium">{parsed.subject}</div>
                              {parsed.preview && <div className="line-clamp-2 text-xs text-muted-foreground">{parsed.preview}</div>}
                            </TableCell>
                            <TableCell className="text-sm" dir="ltr">{e.recipient_email}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString(isHe ? "he-IL" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                            <TableCell>
                              <Badge variant={e.status === "sent" ? "default" : e.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
                              {e.error_message && <p className="text-[10px] text-destructive mt-1 truncate max-w-[200px]">{e.error_message}</p>}
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}

            {selectedEmail && (() => {
              const parsed = parseMailRow(selectedEmail);
              return (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold">{parsed.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(selectedEmail.created_at).toLocaleString(isHe ? "he-IL" : "en-US")}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                      {isHe ? "סגור" : "Close"}
                    </Button>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div><span className="font-medium">{isHe ? "מאת:" : "From:"}</span> <span dir="ltr">{parsed.from || "—"}</span></div>
                    <div><span className="font-medium">{isHe ? "אל:" : "To:"}</span> <span dir="ltr">{selectedEmail.recipient_email || "—"}</span></div>
                    {parsed.category ? <div><span className="font-medium">{isHe ? "סוג:" : "Category:"}</span> {parsed.category}</div> : null}
                    {parsed.followUpSuggested ? <div><span className="font-medium">{isHe ? "המשך מומלץ:" : "Suggested follow-up:"}</span> {parsed.followUpSuggested}</div> : null}
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3 text-sm whitespace-pre-wrap leading-6 min-h-[120px]">
                    {parsed.body || parsed.preview || (isHe ? "אין תוכן מלא זמין להצגה כרגע." : "No full message body is available yet.")}
                  </div>
                  {emailTab === "inbox" && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openReplyComposer(selectedEmail)}>
                        {isHe ? "השב לפנייה" : "Reply"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Compose email */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Send className="h-4 w-4" /> {isHe ? "שלח מייל" : "Compose Email"}</h4>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {ADMIN_MAIL_UI_VERSION}
                </Badge>
              </div>
              <Input placeholder={isHe ? "נמען (אימייל)" : "Recipient email"} value={composeTo} onChange={e => { setComposeTo(e.target.value); setComposeStatus(null); }} dir="ltr" />
              <Input placeholder={isHe ? "נושא" : "Subject"} value={composeSubject} onChange={e => { setComposeSubject(e.target.value); setComposeStatus(null); }} />
              <Textarea placeholder={isHe ? "תוכן ההודעה..." : "Message body..."} value={composeBody} onChange={e => { setComposeBody(e.target.value); setComposeStatus(null); }} rows={4} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                  onClick={async () => {
                    setComposeSending(true);
                    setComposeStatus(null);
                    const controller = new AbortController();
                    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
                    const payload = {
                      action: "send_email",
                      to: composeTo.trim(),
                      subject: composeSubject.trim(),
                      body: composeBody.trim(),
                      admin_password: passInput || sessionStorage.getItem(ADMIN_PASS_VALUE_KEY) || localStorage.getItem(ADMIN_PASS_VALUE_KEY) || "",
                    };

                    const finishSuccess = async () => {
                      const successMsg = isHe ? "נשלח בהצלחה" : "Sent successfully";
                      setComposeStatus({ type: "success", message: successMsg });
                      toast.success(copy.emailSent);
                      setComposeTo("");
                      setComposeSubject("");
                      setComposeBody("");
                      await fetchStats();
                    };

                    const showSendError = (errMsg: string) => {
                      if (errMsg === "Unauthorized") {
                        sessionStorage.removeItem(ADMIN_PASS_KEY);
                        sessionStorage.removeItem(ADMIN_PASS_VALUE_KEY);
                        localStorage.removeItem(ADMIN_PASS_KEY);
                        localStorage.removeItem(ADMIN_PASS_VALUE_KEY);
                        setPassUnlocked(false);
                        setPassInput("");
                        setPassError(true);
                      }
                      const displayMsg = errMsg.includes("Sandbox") || errMsg.includes("not verified")
                        ? (isHe ? "שגיאה: הדומיין עדיין לא אומת לשליחה חיצונית." : "Error: sender domain is not yet verified for external delivery.")
                        : errMsg === "Unauthorized"
                          ? (isHe ? "סיסמת האדמין התיישנה או שונתה. יש להזין אותה מחדש." : "Admin password expired or changed. Please enter it again.")
                          : errMsg;
                      setComposeStatus({ type: "error", message: displayMsg });
                      toast.error(displayMsg, { duration: 8000 });
                    };

                    try {
                      const password = passInput || sessionStorage.getItem(ADMIN_PASS_VALUE_KEY) || localStorage.getItem(ADMIN_PASS_VALUE_KEY) || "";
                      const res = await fetch(`${ADMIN_MAIL_SUPABASE_URL}/functions/v1/admin-analytics`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          apikey: ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY,
                          Authorization: `Bearer ${ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY}`,
                          "x-admin-password": password,
                        },
                        body: JSON.stringify({ ...payload, admin_password: password }),
                        signal: controller.signal,
                      });

                      let data: any = null;
                      let error: { message?: string } | null = null;

                      try {
                        data = await res.json();
                      } catch {
                        error = { message: `HTTP ${res.status}` };
                      }

                      if (!res.ok && !data?.error) {
                        error = { message: `HTTP ${res.status}` };
                      }

                      if (error || data?.error) {
                        const errMsg = data?.error || error?.message || "Error sending email";
                        showSendError(errMsg);
                        return;
                      }

                      await finishSuccess();
                    } catch (error) {
                      const message =
                        error instanceof DOMException && error.name === "AbortError"
                          ? (isHe ? "השליחה נתקעה או לקחה יותר מדי זמן. נסה שוב." : "Sending timed out. Please try again.")
                          : (isHe ? "שגיאת רשת בזמן שליחה. בדוק חיבור ונסה שוב." : "Network error while sending. Please try again.");
                      setComposeStatus({ type: "error", message });
                      toast.error(message, { duration: 8000 });
                    } finally {
                      window.clearTimeout(timeoutId);
                      setComposeSending(false);
                    }
                  }}
                  className="gap-2"
                >
                  {composeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isHe ? "שלח" : "Send"}
                </Button>
                {composeStatus ? (
                  <Badge variant={composeStatus.type === "error" ? "destructive" : "default"} className="max-w-full whitespace-normal text-xs">
                    {composeStatus.message}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
