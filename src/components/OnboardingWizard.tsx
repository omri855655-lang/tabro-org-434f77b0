import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteAppearance } from "@/hooks/useSiteAppearance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ListTodo, CalendarDays, Focus, FolderKanban, Bot, ShoppingCart,
  StickyNote, BookOpen, Trophy, Target, CreditCard, Apple,
  ChevronLeft, ChevronRight, Sparkles, Check,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: "ברוכים הבאים ל-Tabro! 🎉",
    subtitle: "בוא נתאים את המערכת בדיוק בשבילך",
    type: "welcome" as const,
  },
  {
    title: "הכלים הבסיסיים שלך",
    subtitle: "אלה מופעלים כברירת מחדל — תמיד זמינים",
    type: "core" as const,
  },
  {
    title: "דשבורדים נוספים",
    subtitle: "בחר אילו דשבורדים להפעיל (אפשר לשנות בכל עת מההגדרות)",
    type: "optional" as const,
  },
  {
    title: "הסוכן החכם שלך",
    subtitle: "הכר את הסוכן AI שמנהל הכל בשבילך",
    type: "ai" as const,
  },
  {
    title: "הכל מוכן!",
    subtitle: "אתה מוכן להתחיל לנהל את החיים בצורה חכמה",
    type: "done" as const,
  },
];

const CORE_FEATURES = [
  { icon: ListTodo, name: "משימות עבודה ואישיות", desc: "גליונות, סטטוסים, קטגוריות, שיתוף וסינון" },
  { icon: CalendarDays, name: "מתכנן יומי + לוז", desc: "AI שמכיר את המשימות, יומן אירועים, חגים ותזכורות" },
  { icon: Focus, name: "Deeply — מצב ריכוז", desc: "מוזיקת רקע, תדרים, פומודורו ומאמן AI" },
  { icon: FolderKanban, name: "פרויקטים", desc: "צוות, משימות, קישורים ואבני דרך AI" },
  { icon: BookOpen, name: "ספרים, סדרות, פודקאסטים וקורסים", desc: "מעקב מדיה מלא" },
  { icon: Trophy, name: "אתגרים ורצפים", desc: "אנליטיקה ואתגרים מותאמים אישית" },
  { icon: Bot, name: "סוכן AI", desc: "שולח פקודות טקסט והסוכן מבצע" },
];

const DASHBOARD_OPTIONS = [
  { key: "tasks", icon: ListTodo, name: "משימות אישיות", desc: "ניהול המשימות האישיות שלך" },
  { key: "work", icon: FolderKanban, name: "משימות עבודה", desc: "ניהול משימות לעבודה ולצוות" },
  { key: "routine", icon: CalendarDays, name: "לוז יומי", desc: "ניהול שגרה, אירועים ותזכורות" },
  { key: "projects", icon: FolderKanban, name: "פרויקטים", desc: "פרויקטים, צוות ומשימות מרובות אחראים" },
  { key: "courses", icon: BookOpen, name: "קורסים", desc: "מעקב לימודים ושיעורים" },
  { key: "deeply", icon: Focus, name: "Deeply", desc: "ריכוז, מוזיקה ותדרים" },
  { key: "shopping", icon: ShoppingCart, name: "רשימת קניות", desc: "קטלוג קבוע, קטגוריות, שיתוף והיסטוריה" },
  { key: "notes", icon: StickyNote, name: "פתקים", desc: "פתקים מהירים עם חיפוש וקטגוריות" },
  { key: "payments", icon: CreditCard, name: "ניהול תשלומים", desc: "הכנסות, הוצאות ותשלומים חוזרים" },
  { key: "dreams", icon: Target, name: "מפת חלומות", desc: "חזון, אבני דרך וסנכרון ללוז" },
  { key: "nutrition", icon: Apple, name: "תזונה ובריאות", desc: "מעקב ארוחות והרגלים" },
];

const AI_EXAMPLES = [
  "\"תוסיף משימה: לסיים מצגת עד יום חמישי\"",
  "\"תזכיר לי ביום הולדת של אמא ב-15 ביוני\"",
  "\"צור פתק: רשימת רעיונות לנסיעה\"",
  "\"מה המשימות הדחופות שלי?\"",
  "\"תוסיף חג פסח ליומן\"",
];

const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { user } = useAuth();
  const { themeId, themes, setThemeId } = useSiteAppearance();
  const [step, setStep] = useState(0);
  const [selectedDashboards, setSelectedDashboards] = useState<Set<string>>(new Set(["tasks", "work", "routine", "projects", "shopping", "notes"]));

  const toggleDashboard = (key: string) => {
    setSelectedDashboards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const finish = async () => {
    const allOptionalKeys = DASHBOARD_OPTIONS.map(d => d.key);
    const hiddenTabs = allOptionalKeys.filter(k => !selectedDashboards.has(k));

    if (user) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        hidden_tabs: hiddenTabs as any,
      }, { onConflict: "user_id" });
    }

    // Mark onboarding complete in localStorage
    localStorage.setItem("tabro_onboarded", "true");
    toast.success("המערכת מוכנה בשבילך");
    onComplete();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">{current.title}</h2>
            <p className="text-muted-foreground">{current.subtitle}</p>
          </div>

          {/* Content */}
          {current.type === "welcome" && (
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tabro היא מערכת ניהול חיים מלאה עם AI מובנה.
                <br />
                במסך הזה תבחר אילו דשבורדים להציג ואיזה עיצוב הכי נוח לך.
              </p>
              <div className="space-y-2 text-right">
                <Label>בחר עיצוב התחלתי</Label>
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
            </div>
          )}

          {current.type === "core" && (
            <div className="space-y-2 max-h-[350px] overflow-auto">
              {CORE_FEATURES.map(({ icon: Icon, name, desc }) => (
                <div key={name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-1 mr-auto" />
                </div>
              ))}
            </div>
          )}

          {current.type === "optional" && (
            <div className="space-y-2 max-h-[350px] overflow-auto">
              {DASHBOARD_OPTIONS.map(({ key, icon: Icon, name, desc }) => {
                const selected = selectedDashboards.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleDashboard(key)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-right ${
                      selected
                        ? "bg-primary/5 border-primary/40"
                        : "bg-muted/30 border-border/50 opacity-70"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? "bg-primary/15" : "bg-muted"
                    }`}>
                      <Icon className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                      selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}>
                      {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground text-center pt-2">
                אפשר להדליק או להסתיר כל דשבורד גם אחר כך מההגדרות
              </p>
            </div>
          )}

          {current.type === "ai" && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                הסוכן החכם יושב בפינה השמאלית התחתונה של המסך.
                <br />
                אפשר לבקש ממנו להוסיף משימות, פתקים, אירועים, חגים ותזכורות:
              </p>
              <div className="space-y-2">
                {AI_EXAMPLES.map((ex) => (
                  <div key={ex} className="text-xs bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-muted-foreground">
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          )}

          {current.type === "done" && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-10 w-10 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                המערכת מוכנה! אפשר תמיד לשנות הגדרות, להוסיף דשבורדים ולהתאים את הכל מחדש.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
                <ChevronRight className="h-4 w-4" />
                הקודם
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { localStorage.setItem("tabro_onboarded", "true"); onComplete(); }} className="text-muted-foreground">
                דלג
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                הבא
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={finish} className="gap-1 shadow-lg shadow-primary/20">
                <Sparkles className="h-4 w-4" />
                בוא נתחיל!
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
