import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users, LogIn, ClipboardList, ShieldCheck, ArrowRight,
  UserPlus, Trash2, RefreshCw, Crown, Mail, Loader2, Sparkles
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/useLanguage";

interface Stats {
  totalUsers: number;
  recentSignups: number;
  recentLogins: number;
  totalTasks: number;
  totalLoginLogs: number;
  loginLogs: { user_email: string; logged_in_at: string }[];
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
  }[];
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-analytics", {
      body: { action: "stats" },
    });
    if (error || data?.error) {
      if (data?.error === "Forbidden") {
        setIsAdmin(false);
      } else {
        toast.error(t("error" as any));
      }
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    setStats(data);
    setLoading(false);
  }, [user, t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    fetchStats();
  }, [user, authLoading, navigate, fetchStats]);

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    const { data, error } = await supabase.functions.invoke("admin-analytics", {
      body: { action: "add_admin", email: newAdminEmail.trim() },
    });
    setAddingAdmin(false);
    if (error || data?.error) {
      toast.error(data?.error || t("error" as any));
      return;
    }
    toast.success("Admin added successfully!");
    setNewAdminEmail("");
    fetchStats();
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-analytics", {
      body: { action: "remove_admin", user_id: userId },
    });
    if (error || data?.error) {
      toast.error(data?.error || t("error" as any));
      return;
    }
    toast.success("Admin removed");
    fetchStats();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={dir}>
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldCheck className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-xl font-bold">
              {dir === "rtl" ? "אין לך הרשאה לצפות בדף זה" : "You don't have permission to view this page"}
            </h2>
            <Button onClick={() => navigate("/personal")} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              {dir === "rtl" ? "חזרה לאזור האישי" : "Back to Personal Area"}
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

  const isHe = dir === "rtl";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir={dir}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">{isHe ? "דשבורד יוצר" : "Creator Dashboard"}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchStats(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> {isHe ? "רענן" : "Refresh"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/personal")}>
              {isHe ? "חזרה לאזור האישי" : "Back to Personal"}
            </Button>
          </div>
        </div>

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
                <p className="text-2xl font-bold">{stats?.recentSignups ?? 0}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "הרשמות (30 יום)" : "Signups (30d)"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <LogIn className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.recentLogins ?? 0}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "כניסות (30 יום)" : "Logins (30d)"}</p>
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

        {/* Email Inbox for Admin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> {isHe ? "תיבת מייל" : "Email Inbox"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{isHe ? "מייל ראשי:" : "Primary inbox:"}</span>{" "}
              <span dir="ltr">{stats?.mailboxAddress || "info@tabro.org"}</span>
            </div>
            {!(stats?.recentEmailLog?.length) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{isHe ? "עדיין אין אירועי מייל שנשמרו במערכת." : "No email events have been logged yet."}</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-auto">
                {stats.recentEmailLog.map((e, index) => (
                  <div key={`${e.message_id || e.created_at}-${index}`} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{e.template_name}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[170px]" dir="ltr">{e.recipient_email}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleDateString(isHe ? "he-IL" : "en-US", { day: "2-digit", month: "2-digit" })}</span>
                    <Badge variant={e.status === "sent" ? "default" : "secondary"} className="text-[9px]">{e.status}</Badge>
                  </div>
                ))}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
