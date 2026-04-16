import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Tv, Lock } from "lucide-react";
import { useSiteAppearance } from "@/hooks/useSiteAppearance";
import { useLanguage } from "@/hooks/useLanguage";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, user, loading } = useAuth();
  const { themeId, themes, setThemeId } = useSiteAppearance();
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"he" | "en">("he");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email(isHebrew ? "אימייל לא תקין" : "Invalid email"),
        password: z
          .string()
          .trim()
          .min(6, isHebrew ? "סיסמה חייבת להכיל לפחות 6 תווים" : "Password must contain at least 6 characters")
          .max(128, isHebrew ? "סיסמה ארוכה מדי" : "Password is too long"),
      }),
    [isHebrew]
  );

  const copy = isHebrew ? {
    loginTitle: "התחברות | מערכת ניהול אישית",
    signupTitle: "הרשמה | מערכת ניהול אישית",
    formError: "שגיאה בטופס",
    firstNameTooShort: "שם פרטי חייב להכיל לפחות 2 תווים",
    lastNameTooShort: "שם משפחה חייב להכיל לפחות 2 תווים",
    emailExists: "המייל הזה כבר רשום, נסה להתחבר",
    signupError: "שגיאה בהרשמה: ",
    signupSuccessConfirm: "נרשמת בהצלחה! בדוק את המייל שלך לאישור החשבון וגם בתיקיית ספאם/קידומי מכירות",
    signupSuccess: "נרשמת בהצלחה!",
    invalidLogin: "אימייל או סיסמה שגויים",
    emailNotConfirmed: "יש לאשר את המייל לפני התחברות",
    loginError: "שגיאה בהתחברות: ",
    loginSuccess: "התחברת בהצלחה!",
    loading: "טוען...",
    login: "התחברות",
    signup: "הרשמה",
    loginDesc: "הזן את פרטי ההתחברות שלך",
    signupDesc: "צור חשבון חדש כדי להתחיל",
    firstName: "שם פרטי",
    lastName: "שם משפחה",
    firstNamePlaceholder: "ישראל",
    lastNamePlaceholder: "ישראלי",
    preferredLanguage: "שפה מועדפת / Preferred Language",
    starterTheme: "עיצוב התחלתי",
    email: "אימייל",
    password: "סיסמה",
    minPassword: "לפחות 6 תווים",
    signingIn: "מתחבר...",
    signingUp: "נרשם...",
    loginAction: "התחבר",
    signupAction: "הירשם",
    enterEmailFirst: "הזן אימייל קודם",
    resetError: "שגיאה: ",
    resetSent: "נשלח מייל לאיפוס סיסמה",
    forgotPassword: "שכחתי סיסמה",
    noAccount: "אין לך חשבון? הירשם",
    hasAccount: "כבר יש לך חשבון? התחבר",
  } : {
    loginTitle: "Sign In | Personal Management System",
    signupTitle: "Sign Up | Personal Management System",
    formError: "Form error",
    firstNameTooShort: "First name must contain at least 2 characters",
    lastNameTooShort: "Last name must contain at least 2 characters",
    emailExists: "This email is already registered, try signing in",
    signupError: "Sign-up error: ",
    signupSuccessConfirm: "Signed up successfully! Check your email to confirm the account, including spam/promotions.",
    signupSuccess: "Signed up successfully!",
    invalidLogin: "Incorrect email or password",
    emailNotConfirmed: "Please confirm your email before signing in",
    loginError: "Sign-in error: ",
    loginSuccess: "Signed in successfully!",
    loading: "Loading...",
    login: "Sign In",
    signup: "Sign Up",
    loginDesc: "Enter your sign-in details",
    signupDesc: "Create a new account to get started",
    firstName: "First name",
    lastName: "Last name",
    firstNamePlaceholder: "Israel",
    lastNamePlaceholder: "Israeli",
    preferredLanguage: "Preferred Language",
    starterTheme: "Starter theme",
    email: "Email",
    password: "Password",
    minPassword: "At least 6 characters",
    signingIn: "Signing in...",
    signingUp: "Signing up...",
    loginAction: "Sign in",
    signupAction: "Sign up",
    enterEmailFirst: "Enter your email first",
    resetError: "Error: ",
    resetSent: "Password reset email sent",
    forgotPassword: "Forgot password",
    noAccount: "Don't have an account? Sign up",
    hasAccount: "Already have an account? Sign in",
  };

  useEffect(() => {
    document.title = mode === "login" ? copy.loginTitle : copy.signupTitle;
  }, [mode, copy.loginTitle, copy.signupTitle]);

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
      toast.error(parsed.error.issues[0]?.message ?? copy.formError);
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (mode === "signup") {
      if (normalizedFirstName.length < 2) {
        toast.error(copy.firstNameTooShort);
        return;
      }
      if (normalizedLastName.length < 2) {
        toast.error(copy.lastNameTooShort);
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
          emailRedirectTo: window.location.origin,
          data: {
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            username,
            display_name: `${normalizedFirstName} ${normalizedLastName}`,
            preferred_language: preferredLanguage,
          },
        },
      });
      setIsLoading(false);

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error(copy.emailExists);
        } else {
          toast.error(copy.signupError + error.message);
        }
        return;
      }

      // If email confirmation is required, user won't have a session yet
      if (data?.user && !data.session) {
        toast.success(copy.signupSuccessConfirm);
        return;
      }

      toast.success(copy.signupSuccess);
      navigate("/personal");
    } else {
      const { error } = await signIn(parsed.data.email, parsed.data.password);
      setIsLoading(false);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error(copy.invalidLogin);
        } else if (error.message.includes("Email not confirmed")) {
          toast.error(copy.emailNotConfirmed);
        } else {
          toast.error(copy.loginError + error.message);
        }
        return;
      }

      toast.success(copy.loginSuccess);
      navigate("/personal");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{copy.loading}</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4"
      dir={dir}
    >
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center gap-2 text-primary">
            <BookOpen className="h-8 w-8" />
            <Tv className="h-8 w-8" />
            <Lock className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {mode === "login" ? copy.login : copy.signup}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? copy.loginDesc
              : copy.signupDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{copy.firstName}</Label>
                  <Input
                    id="firstName"
                    placeholder={copy.firstNamePlaceholder}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{copy.lastName}</Label>
                  <Input
                    id="lastName"
                    placeholder={copy.lastNamePlaceholder}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{copy.preferredLanguage}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={preferredLanguage === "he" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreferredLanguage("he")}
                  >
                    עברית
                  </Button>
                  <Button
                    type="button"
                    variant={preferredLanguage === "en" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreferredLanguage("en")}
                  >
                    English
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{copy.starterTheme}</Label>
                <Select value={themeId} onValueChange={setThemeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.name} — {theme.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{copy.email}</Label>
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
              <Label htmlFor="password">{copy.password}</Label>
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
                <p className="text-xs text-muted-foreground">{copy.minPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? mode === "login"
                  ? copy.signingIn
                  : copy.signingUp
                : mode === "login"
                ? copy.loginAction
                : copy.signupAction}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-1">
            {mode === "login" && (
              <Button
                variant="link"
                onClick={async () => {
                  if (!email.trim()) { toast.error(copy.enterEmailFirst); return; }
                  const { error } = await (await import("@/integrations/supabase/client")).supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: window.location.origin + "/reset-password",
                  });
                  if (error) toast.error(copy.resetError + error.message);
                  else toast.success(copy.resetSent);
                }}
                className="text-sm"
              >
                {copy.forgotPassword}
              </Button>
            )}
            <Button
              variant="link"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm"
            >
              {mode === "login"
                ? copy.noAccount
                : copy.hasAccount}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
