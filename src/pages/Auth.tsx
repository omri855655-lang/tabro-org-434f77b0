import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Tv, Lock } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email("אימייל לא תקין"),
        password: z
          .string()
          .trim()
          .min(6, "סיסמה חייבת להכיל לפחות 6 תווים")
          .max(128, "סיסמה ארוכה מדי"),
      }),
    []
  );

  useEffect(() => {
    document.title = mode === "login" ? "התחברות | מערכת ניהול אישית" : "הרשמה | מערכת ניהול אישית";
  }, [mode]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate("/personal");
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "שגיאה בטופס");
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (mode === "signup") {
      if (normalizedFirstName.length < 2) {
        toast.error("שם פרטי חייב להכיל לפחות 2 תווים");
        return;
      }
      if (normalizedLastName.length < 2) {
        toast.error("שם משפחה חייב להכיל לפחות 2 תווים");
        return;
      }
    }

    setIsLoading(true);

    if (mode === "signup") {
      const { supabase } = await import("@/integrations/supabase/client");
      const username = parsed.data.email.split("@")[0].toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin + "/personal",
          data: {
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            username,
            display_name: `${normalizedFirstName} ${normalizedLastName}`,
          },
        },
      });
      setIsLoading(false);

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("המייל הזה כבר רשום, נסה להתחבר");
        } else {
          toast.error("שגיאה בהרשמה: " + error.message);
        }
        return;
      }

      // If email confirmation is required, user won't have a session yet
      if (data?.user && !data.session) {
        toast.success("נרשמת בהצלחה! בדוק את המייל שלך לאישור החשבון");
        return;
      }

      toast.success("נרשמת בהצלחה!");
      navigate("/personal");
    } else {
      const { error } = await signIn(parsed.data.email, parsed.data.password);
      setIsLoading(false);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("אימייל או סיסמה שגויים");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("יש לאשר את המייל לפני התחברות");
        } else {
          toast.error("שגיאה בהתחברות: " + error.message);
        }
        return;
      }

      toast.success("התחברת בהצלחה!");
      navigate("/personal");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">טוען...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center gap-2 text-primary">
            <BookOpen className="h-8 w-8" />
            <Tv className="h-8 w-8" />
            <Lock className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {mode === "login" ? "התחברות" : "הרשמה"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "הזן את פרטי ההתחברות שלך"
              : "צור חשבון חדש כדי להתחיל"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">לפחות 6 תווים</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? mode === "login"
                  ? "מתחבר..."
                  : "נרשם..."
                : mode === "login"
                ? "התחבר"
                : "הירשם"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm"
            >
              {mode === "login"
                ? "אין לך חשבון? הירשם"
                : "כבר יש לך חשבון? התחבר"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
