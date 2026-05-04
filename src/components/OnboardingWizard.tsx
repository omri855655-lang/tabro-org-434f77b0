import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteAppearance } from "@/hooks/useSiteAppearance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import {
  ListTodo, CalendarDays, Focus, FolderKanban, Bot, ShoppingCart,
  StickyNote, BookOpen, Trophy, Target, CreditCard, Apple,
  ChevronLeft, ChevronRight, Sparkles, Check, ArrowLeft,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEPS_HE = [
  { title: "ברוכים הבאים ל-Tabro!", subtitle: "בוא נתאים את המערכת בדיוק בשבילך — זה ייקח פחות מדקה", type: "welcome" as const },
  { title: "בחר עיצוב", subtitle: "בחר את העיצוב שהכי נוח לך. אפשר לשנות בכל עת מההגדרות", type: "theme" as const },
  { title: "הכלים שמופעלים אוטומטית", subtitle: "אלה הכלים הבסיסיים שתמיד זמינים ואי אפשר להסתיר", type: "core" as const },
  { title: "בחר אילו דשבורדים להציג", subtitle: "לחץ כדי להפעיל או לכבות. כל מה שכבוי לא יופיע בתפריט", type: "optional" as const },
  { title: "חיבור מיילים ותקציב", subtitle: "חבר Gmail לניתוח אוטומטי וייבא פירוט אשראי לניהול תקציב", type: "email_budget" as const },
  { title: "הסוכן החכם שלך", subtitle: "בפינה השמאלית התחתונה יושב סוכן AI שמבצע בשבילך פעולות", type: "ai" as const },
  { title: "הכל מוכן!", subtitle: "המערכת מותאמת אישית ומוכנה לשימוש", type: "done" as const },
];

const STEPS_EN = [
  { title: "Welcome to Tabro!", subtitle: "Let's customize the system for you — it takes less than a minute", type: "welcome" as const },
  { title: "Choose a Theme", subtitle: "Pick the design that's most comfortable for you. You can always change it later.", type: "theme" as const },
  { title: "Core Features", subtitle: "These core tools are always available and can't be hidden", type: "core" as const },
  { title: "Choose Dashboards", subtitle: "Click to enable or disable. Disabled items won't appear in the menu", type: "optional" as const },
  { title: "Email & Budget Setup", subtitle: "Connect Gmail for automatic analysis and import credit card statements for budget tracking", type: "email_budget" as const },
  { title: "Your Smart Agent", subtitle: "The AI agent sits at the bottom-left corner and performs actions for you", type: "ai" as const },
  { title: "All Set!", subtitle: "The system is personalized and ready to use", type: "done" as const },
];

const CORE_FEATURES_HE = [
  { icon: ListTodo, name: "משימות עבודה ואישיות", desc: "גליונות עם סטטוסים, קטגוריות, סינון, מעקב התקדמות ושיתוף עם אחרים" },
  { icon: CalendarDays, name: "מתכנן יומי + לוז אירועים", desc: "AI שמתכנן את היום לפי המשימות, יומן אירועים, חגים מכל הדתות ותזכורות" },
  { icon: Focus, name: "ZoneFlow — מצב ריכוז", desc: "תדרים בינאורליים, מוזיקת רקע, פומודורו ומאמן AI לעבודה עמוקה" },
  { icon: FolderKanban, name: "פרויקטים וצוותים", desc: "ניהול פרויקטים עם חברי צוות, ריבוי אחראים למשימה, קישורים ואבני דרך AI" },
  { icon: BookOpen, name: "ספרים, סדרות, פודקאסטים וקורסים", desc: "מעקב מדיה מלא עם סטטוסים, הערות וסילבוס לקורסים" },
  { icon: Trophy, name: "אתגרים ורצפים", desc: "אתגרים מותאמים אישית, מעקב רצפים ואנליטיקה" },
  { icon: Bot, name: "סוכן AI", desc: "מקבל הוראות בשפה טבעית ומבצע — הוספת משימות, פתקים, אירועים ועוד" },
];

const CORE_FEATURES_EN = [
  { icon: ListTodo, name: "Work & Personal Tasks", desc: "Sheets with statuses, categories, filters, progress tracking and sharing" },
  { icon: CalendarDays, name: "Daily Planner + Calendar", desc: "AI-powered day planning, calendar events, holidays and reminders" },
  { icon: Focus, name: "ZoneFlow — Focus Mode", desc: "Binaural beats, background music, Pomodoro and AI coaching for deep work" },
  { icon: FolderKanban, name: "Projects & Teams", desc: "Team projects with multiple assignees, links and AI milestones" },
  { icon: BookOpen, name: "Books, Shows, Podcasts & Courses", desc: "Full media tracking with statuses, notes and course syllabi" },
  { icon: Trophy, name: "Challenges & Streaks", desc: "Custom challenges, streak tracking and analytics" },
  { icon: Bot, name: "AI Agent", desc: "Takes natural language instructions — adds tasks, notes, events and more" },
];

const DASHBOARD_OPTIONS = [
  { key: "tasks", icon: ListTodo, name: "משימות אישיות", desc: "ניהול המשימות האישיות שלך", defaultOn: true },
  { key: "work", icon: FolderKanban, name: "משימות עבודה", desc: "ניהול משימות לעבודה ולצוות", defaultOn: true },
  { key: "routine", icon: CalendarDays, name: "לוז יומי", desc: "ניהול שגרה, אירועים ותזכורות", defaultOn: true },
  { key: "projects", icon: FolderKanban, name: "פרויקטים", desc: "פרויקטים, צוות ומשימות מרובות אחראים", defaultOn: true },
  { key: "courses", icon: BookOpen, name: "קורסים", desc: "מעקב לימודים ושיעורים", defaultOn: false },
  { key: "zoneflow", icon: Focus, name: "ZoneFlow — ריכוז", desc: "ריכוז, מוזיקה ותדרים", defaultOn: false },
  { key: "shopping", icon: ShoppingCart, name: "רשימת קניות", desc: "קטלוג קבוע, קטגוריות, סל מחזור ושיתוף", defaultOn: true },
  { key: "notes", icon: StickyNote, name: "פתקים", desc: "פתקים צבעוניים עם חיפוש, קטגוריות והצמדה", defaultOn: true },
  { key: "payments", icon: CreditCard, name: "ניהול תשלומים", desc: "הכנסות, הוצאות ותשלומים חוזרים", defaultOn: false },
  { key: "dreams", icon: Target, name: "מפת חלומות", desc: "חזון, אבני דרך וסנכרון ללוז", defaultOn: false },
  { key: "nutrition", icon: Apple, name: "תזונה ובריאות", desc: "מעקב ארוחות והרגלים", defaultOn: false },
];

const AI_EXAMPLES = [
  { cmd: "תוסיף משימה: לסיים מצגת עד יום חמישי", what: "מוסיף משימה עם תאריך יעד" },
  { cmd: "תזכיר לי ביום הולדת של אמא ב-15 ביוני", what: "יוצר אירוע בלוז עם תזכורת" },
  { cmd: "צור פתק: רשימת רעיונות לנסיעה", what: "פותח פתק חדש בדשבורד הפתקים" },
  { cmd: "מה המשימות הדחופות שלי?", what: "מציג סיכום משימות דחופות" },
  { cmd: "תוסיף ערב פסח ליומן", what: "מוסיף חג/אירוע ללוז" },
];

const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { user } = useAuth();
  const { themeId, themes, setThemeId } = useSiteAppearance();
  const { lang, dir } = useLanguage();
  const [step, setStep] = useState(0);
  const [selectedDashboards, setSelectedDashboards] = useState<Set<string>>(
    new Set(DASHBOARD_OPTIONS.filter(d => d.defaultOn).map(d => d.key))
  );

  const isHe = lang === "he" || lang === "ar";
  const STEPS = isHe ? STEPS_HE : STEPS_EN;
  const CORE_FEATURES = isHe ? CORE_FEATURES_HE : CORE_FEATURES_EN;

  const toggleDashboard = (key: string) => {
    setSelectedDashboards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedDashboards(new Set(DASHBOARD_OPTIONS.map(d => d.key)));
  const deselectAll = () => setSelectedDashboards(new Set());

  const finish = async () => {
    const allOptionalKeys = DASHBOARD_OPTIONS.map(d => d.key);
    const hiddenTabs = allOptionalKeys.filter(k => !selectedDashboards.has(k));

    if (user) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        hidden_tabs: hiddenTabs as any,
      }, { onConflict: "user_id" });
    }

    localStorage.setItem("tabro_onboarded", "true");
    toast.success(isHe ? "המערכת מוכנה בשבילך!" : "The system is ready for you!");
    onComplete();
  };

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-bold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>

          {/* Content */}
          {current.type === "welcome" && (
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2 text-right bg-muted/30 rounded-xl p-4 border border-border/50">
                <p className="font-medium text-foreground">{isHe ? "מה זה Tabro?" : "What is Tabro?"}</p>
                <p>{isHe ? "מערכת ניהול חיים מלאה — משימות, פרויקטים, לוז, קניות, פתקים, תשלומים ועוד." : "A complete life management system — tasks, projects, planner, shopping, notes, payments and more."}</p>
                <p>{isHe ? "בדשבורד המשימות: דאבל־קליק על שורה פותח עריכה מהירה, ו־3 קליקים פותחים את כל פרטי המשימה." : "In the task dashboard: double-click a row for quick editing, and triple-click to open full task details."}</p>
                <p>{isHe ? "בעזרת סוכן AI מובנה, אפשר לבצע פעולות בהוראה פשוטה בטקסט." : "With a built-in AI agent, you can perform actions with simple natural-language text."}</p>
                <p>{isHe ? "בשלבים הבאים תבחר עיצוב ותפעיל את הדשבורדים שמתאימים לך." : "In the next steps you'll choose a design and enable the dashboards that fit you best."}</p>
              </div>
            </div>
          )}

          {current.type === "theme" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isHe ? "בחר עיצוב" : "Choose a design"}</Label>
                <Select value={themeId} onValueChange={setThemeId}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        <div className="flex flex-col items-start py-0.5">
                          <span className="font-medium">{theme.name}</span>
                          <span className="text-xs text-muted-foreground">{theme.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2">
                <p className="text-sm font-medium text-foreground">{isHe ? "טיפ:" : "Tip:"}</p>
                <p className="text-xs text-muted-foreground">
                  {isHe
                    ? 'העיצוב "אקסקיוטיב" מציע מראה מקצועי עם סרגל צד כהה, בלי אימוג\'ים — מתאים למי שרוצה ממשק בוגר ורגוע. אפשר תמיד לשנות את העיצוב מההגדרות.'
                    : 'The "Executive" theme offers a professional look with a dark sidebar and no emojis — ideal for a calmer, more mature workspace. You can always change the design later in Settings.'}
                </p>
              </div>
            </div>
          )}

          {current.type === "core" && (
            <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
              {CORE_FEATURES.map(({ icon: Icon, name, desc }) => (
                <div key={name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                  <Check className="h-4 w-4 text-accent shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}

          {current.type === "optional" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7 px-2">
                  {isHe ? "הפעל הכל" : "Enable all"}
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7 px-2">
                  {isHe ? "כבה הכל" : "Disable all"}
                </Button>
              </div>
              <div className="space-y-2 max-h-[290px] overflow-auto pr-1">
                {DASHBOARD_OPTIONS.map(({ key, icon: Icon, name, desc }) => {
                  const selected = selectedDashboards.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleDashboard(key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-right ${
                        selected
                          ? "bg-primary/5 border-primary/40"
                          : "bg-muted/20 border-border/40 opacity-60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selected ? "bg-primary/15" : "bg-muted"
                      }`}>
                        <Icon className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {isHe ? "אפשר לשנות בכל עת מההגדרות — דשבורדים שכבויים לא מופיעים בתפריט" : "You can change this anytime in Settings — disabled dashboards won't appear in the menu."}
              </p>
            </div>
          )}

          {current.type === "ai" && (
            <div className="space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Bot className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2 text-right">
                <p className="text-sm font-medium text-foreground">איך משתמשים?</p>
                <p className="text-xs text-muted-foreground">
                  לחץ על כפתור הסוכן בפינה <strong>השמאלית התחתונה</strong> של המסך. כתוב הוראה בטקסט רגיל והסוכן יבצע.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">דוגמאות:</p>
                {AI_EXAMPLES.map(({ cmd, what }) => (
                  <div key={cmd} className="flex items-start gap-2 text-xs bg-muted/40 border border-border/40 rounded-lg px-3 py-2">
                    <ArrowLeft className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-foreground font-medium">{cmd}</span>
                      <span className="text-muted-foreground mr-1"> — {what}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {current.type === "email_budget" && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2 text-right">
                <p className="text-sm font-medium text-foreground">{isHe ? "📧 חיבור מייל" : "📧 Email Connection"}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "חבר את Gmail שלך מדשבורד המיילים כדי לקבל ניתוח אוטומטי, סיווג ותזכורות על מיילים חשובים." : "Connect your Gmail from the Email dashboard to get automatic analysis, classification and reminders for important emails."}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-2 text-right">
                <p className="text-sm font-medium text-foreground">{isHe ? "💰 ניהול תקציב" : "💰 Budget Management"}</p>
                <p className="text-xs text-muted-foreground">{isHe ? "ייבא פירוט אשראי (CSV/Excel), הגדר יעד תקציב שבועי/חודשי, וקבל ניתוח AI על ההוצאות שלך." : "Import credit card statements (CSV/Excel), set weekly/monthly budget targets, and get AI analysis of your spending."}</p>
              </div>
            </div>
          )}

          {current.type === "done" && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                <Check className="h-10 w-10 text-accent" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-foreground font-medium">
                  {selectedDashboards.size} {isHe ? "דשבורדים מופעלים" : "dashboards enabled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isHe ? "אפשר תמיד לשנות הגדרות, להוסיף דשבורדים ולהתאים את העיצוב מההגדרות." : "You can always change settings, add dashboards and customize the design from Settings."}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
                <ChevronRight className="h-4 w-4" />
                {isHe ? "הקודם" : "Previous"}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { localStorage.setItem("tabro_onboarded", "true"); onComplete(); }} className="text-muted-foreground text-xs">
                {isHe ? "דלג על ההדרכה" : "Skip guide"}
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                {isHe ? "הבא" : "Next"}
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={finish} className="gap-1 shadow-lg shadow-primary/20">
                <Sparkles className="h-4 w-4" />
                {isHe ? "בוא נתחיל!" : "Let's go!"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
