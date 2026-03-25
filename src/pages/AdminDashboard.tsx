import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Users, LogIn, ClipboardList, ShieldCheck, ArrowRight,
  UserPlus, Trash2, RefreshCw, Crown
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Stats {
  totalUsers: number;
  recentSignups: number;
  recentLogins: number;
  totalTasks: number;
  totalLoginLogs: number;
  loginLogs: { user_email: string; logged_in_at: string }[];
  adminEmails: { email: string; user_id: string; created_at: string }[];
  userList: { email: string; created_at: string; last_sign_in_at: string | null }[];
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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
        toast.error("שגיאה בטעינת נתונים");
      }
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    setStats(data);
    setLoading(false);
  }, [user]);

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
      toast.error(data?.error || "שגיאה בהוספת מנהל");
      return;
    }
    toast.success("מנהל נוסף בהצלחה!");
    setNewAdminEmail("");
    fetchStats();
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-analytics", {
      body: { action: "remove_admin", user_id: userId },
    });
    if (error || data?.error) {
      toast.error(data?.error || "שגיאה בהסרת מנהל");
      return;
    }
    toast.success("מנהל הוסר בהצלחה");
    fetchStats();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">טוען...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldCheck className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-xl font-bold">אין לך הרשאה לצפות בדף זה</h2>
            <Button onClick={() => navigate("/personal")} className="gap-2">
              <ArrowRight className="h-4 w-4" /> חזרה לאזור האישי
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("he-IL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">דשבורד יוצר</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStats} className="gap-2">
              <RefreshCw className="h-4 w-4" /> רענן
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/personal")}>
              חזרה לאזור האישי
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
                <p className="text-xs text-muted-foreground">משתמשים רשומים</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.recentSignups ?? 0}</p>
                <p className="text-xs text-muted-foreground">הרשמות (30 יום)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <LogIn className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.recentLogins ?? 0}</p>
                <p className="text-xs text-muted-foreground">כניסות (30 יום)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalTasks ?? 0}</p>
                <p className="text-xs text-muted-foreground">משימות במערכת</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> ניהול מנהלים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="אימייל של מנהל חדש..."
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                dir="ltr"
                className="max-w-sm"
              />
              <Button onClick={handleAddAdmin} disabled={addingAdmin || !newAdminEmail.trim()}>
                {addingAdmin ? "מוסיף..." : "הוסף מנהל"}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>אימייל</TableHead>
                  <TableHead>נוסף בתאריך</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.adminEmails?.map((admin) => (
                  <TableRow key={admin.user_id}>
                    <TableCell dir="ltr">{admin.email}</TableCell>
                    <TableCell>{formatDate(admin.created_at)}</TableCell>
                    <TableCell>
                      {admin.email !== user?.email ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAdmin(admin.user_id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">את/ה</span>
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
              <Users className="h-5 w-5" /> רשימת משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>אימייל</TableHead>
                    <TableHead>תאריך הרשמה</TableHead>
                    <TableHead>כניסה אחרונה</TableHead>
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
