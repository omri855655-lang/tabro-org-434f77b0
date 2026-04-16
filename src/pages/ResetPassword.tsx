import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const copy = isHebrew ? {
    minPassword: "סיסמה חייבת להכיל לפחות 6 תווים",
    mismatch: "הסיסמאות לא תואמות",
    error: "שגיאה באיפוס הסיסמה: ",
    success: "הסיסמה שונתה בהצלחה!",
    loading: "טוען... אם העמוד לא נטען, נסה ללחוץ על הקישור שוב מהמייל.",
    title: "איפוס סיסמה",
    newPassword: "סיסמה חדשה",
    confirmPassword: "אימות סיסמה",
    changing: "משנה...",
    changePassword: "שנה סיסמה",
  } : {
    minPassword: "Password must contain at least 6 characters",
    mismatch: "Passwords do not match",
    error: "Password reset error: ",
    success: "Password changed successfully!",
    loading: "Loading... If the page does not load, try clicking the link again from the email.",
    title: "Reset password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    changing: "Updating...",
    changePassword: "Change password",
  };

  useEffect(() => {
    // Check for recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check hash
    if (window.location.hash.includes("type=recovery")) {
      setReady(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error(copy.minPassword); return; }
    if (password !== confirm) { toast.error(copy.mismatch); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(copy.error + error.message);
      return;
    }
    toast.success(copy.success);
    navigate("/personal");
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={dir}>
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-muted-foreground">
            {copy.loading}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4" dir={dir}>
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="text-center">
          <Lock className="h-8 w-8 mx-auto text-primary" />
          <CardTitle className="text-2xl font-bold">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{copy.newPassword}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" dir="ltr" required />
            </div>
            <div className="space-y-2">
              <Label>{copy.confirmPassword}</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" dir="ltr" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? copy.changing : copy.changePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
