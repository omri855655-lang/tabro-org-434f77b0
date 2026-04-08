import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSiteAppearance, SITE_THEME_PRESETS } from "@/hooks/useSiteAppearance";
import {
  LogIn, UserPlus, BookOpen, FolderKanban, CalendarDays, Focus,
  Trophy, ListTodo, ChevronDown, Sparkles, ShoppingCart, StickyNote,
  CreditCard, Target, Apple, Bot, Users, Shield, Zap, Globe, Palette,
  Moon, Sun, Mail,
} from "lucide-react";

type LandingLang = "he" | "en";

const FEATURES_HE = [
  { icon: ListTodo, title: "משימות חכמות", desc: "נהל משימות אישיות ועבודה עם סטטוסים, קטגוריות, שיתוף גליונות, תאריכי יעד ו-AI שמציע ומנתח", color: "from-blue-500 to-cyan-500" },
  { icon: CalendarDays, title: "מתכנן יומי + לוז", desc: "תכנן את היום עם AI, נהל אירועים ביומן כולל חגים, תזכורות לפני אירוע ושליחה במספר שעות", color: "from-violet-500 to-purple-500" },
  { icon: Focus, title: "ZoneFlow — מצב ריכוז", desc: "תדרים בינאורליים, פומודורו, מוזיקת רקע ומאמן AI לעבודה עמוקה", color: "from-emerald-500 to-teal-500" },
  { icon: FolderKanban, title: "ניהול פרויקטים", desc: "פרויקטים עם צוות, סטטוסים, תאריכי יעד, אבני דרך AI וסנכרון", color: "from-sky-500 to-indigo-500" },
  { icon: Bot, title: "סוכן AI חכם", desc: "סוכן שמבין את כל המערכת — מוסיף משימות, פתקים, אירועים ותזכורות בשבילך", color: "from-fuchsia-500 to-pink-500" },
  { icon: ShoppingCart, title: "רשימת קניות", desc: "קטלוג קבוע לפי קטגוריות, הוספה מהירה, היסטוריה, סל מחזור ושיתוף", color: "from-orange-500 to-red-500" },
  { icon: StickyNote, title: "פתקים", desc: "פתקים צבעוניים עם הצמדה, ארכיון, קטגוריות וחיפוש", color: "from-yellow-500 to-amber-500" },
  { icon: BookOpen, title: "ספרים ומדיה", desc: "עקוב אחרי ספרים, סדרות, פודקאסטים וקורסים עם סילבוס ושיעורים", color: "from-rose-500 to-pink-500" },
  { icon: Trophy, title: "אתגרים והישגים", desc: "רצפים, אתגרים מותאמים אישית ואנליטיקה שדוחפים אותך קדימה", color: "from-amber-500 to-orange-500" },
  { icon: Target, title: "מפת דרכים לחלומות", desc: "הגדר חלומות, צור אבני דרך עם AI, סנכרן ללוז ועקוב אחרי ההתקדמות", color: "from-indigo-500 to-violet-500" },
  { icon: CreditCard, title: "ניהול תשלומים", desc: "מעקב הכנסות והוצאות, ייבוא CSV/Excel, קטגוריות וניתוח תקציב AI", color: "from-green-500 to-emerald-500" },
  { icon: Apple, title: "תזונה ושגרה", desc: "מעקב ארוחות, חישוב קלוריות AI, שגרה יומית חוזרת, סטופר וסטטיסטיקות", color: "from-lime-500 to-green-500" },
];

const FEATURES_EN = [
  { icon: ListTodo, title: "Smart Tasks", desc: "Manage personal & work tasks with statuses, categories, sheet sharing, deadlines and AI analysis", color: "from-blue-500 to-cyan-500" },
  { icon: CalendarDays, title: "Daily Planner + Calendar", desc: "Plan your day with AI, manage calendar events including holidays and smart reminders", color: "from-violet-500 to-purple-500" },
  { icon: Focus, title: "ZoneFlow — Focus Mode", desc: "Binaural frequencies, Pomodoro, background music and an AI coach for deep work", color: "from-emerald-500 to-teal-500" },
  { icon: FolderKanban, title: "Project Management", desc: "Team projects with statuses, deadlines, AI milestones and sync", color: "from-sky-500 to-indigo-500" },
  { icon: Bot, title: "Smart AI Agent", desc: "An agent that understands the system — adds tasks, notes, events and reminders for you", color: "from-fuchsia-500 to-pink-500" },
  { icon: ShoppingCart, title: "Shopping List", desc: "Permanent catalog by categories, quick add, history, recycle bin and sharing", color: "from-orange-500 to-red-500" },
  { icon: StickyNote, title: "Notes", desc: "Colorful sticky notes with pinning, archive, categories and search", color: "from-yellow-500 to-amber-500" },
  { icon: BookOpen, title: "Books & Media", desc: "Track books, shows, podcasts and courses with syllabus and lessons", color: "from-rose-500 to-pink-500" },
  { icon: Trophy, title: "Challenges & Streaks", desc: "Custom challenges, streak tracking and analytics to push you forward", color: "from-amber-500 to-orange-500" },
  { icon: Target, title: "Dream Roadmap", desc: "Set dreams, create AI milestones, sync to calendar and track progress", color: "from-indigo-500 to-violet-500" },
  { icon: CreditCard, title: "Payment Tracking", desc: "Track income & expenses, import CSV/Excel, categories and AI budget analysis", color: "from-green-500 to-emerald-500" },
  { icon: Apple, title: "Nutrition & Routine", desc: "Meal tracking, AI calorie calculation, daily routine, stopwatch and statistics", color: "from-lime-500 to-green-500" },
];

const HIGHLIGHTS_HE = [
  { icon: Bot, text: "סוכן AI שמנהל הכל" },
  { icon: Users, text: "שיתוף עם צוות ומשפחה" },
  { icon: Shield, text: "מאובטח עם PIN וגישה פרטית" },
  { icon: Zap, text: "ללא הגבלת משימות ופרויקטים" },
  { icon: Globe, text: "עברית ואנגלית, מכל מכשיר" },
  { icon: Sparkles, text: "AI מובנה ללא הגדרות" },
];

const HIGHLIGHTS_EN = [
  { icon: Bot, text: "AI agent that manages everything" },
  { icon: Users, text: "Share with teams & family" },
  { icon: Shield, text: "Secured with PIN & private access" },
  { icon: Zap, text: "Unlimited tasks & projects" },
  { icon: Globe, text: "Hebrew & English, any device" },
  { icon: Sparkles, text: "Built-in AI, zero setup" },
];

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const { themeId, setThemeId, isDark, toggleMode } = useSiteAppearance();
  const [landingLang, setLandingLang] = useState<LandingLang>(() => {
    const stored = localStorage.getItem("landing-lang") as LandingLang | null;
    return stored || "he";
  });
  const [landingContent, setLandingContent] = useState<Record<string, { value_he: string; value_en: string }>>({});

  const isHe = landingLang === "he";
  const isRtl = isHe;

  useEffect(() => {
    if (!loading && user) navigate("/personal", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("landing-lang", landingLang);
  }, [landingLang]);

  // Fetch admin-editable landing content
  useEffect(() => {
    supabase.from("landing_content").select("key, value_he, value_en").then(({ data }) => {
      if (data) {
        const map: Record<string, { value_he: string; value_en: string }> = {};
        data.forEach((row: any) => { map[row.key] = { value_he: row.value_he, value_en: row.value_en }; });
        setLandingContent(map);
      }
    });
  }, []);

  const lc = (key: string, fallbackHe: string, fallbackEn: string) => {
    const entry = landingContent[key];
    if (entry) return isHe ? entry.value_he : entry.value_en;
    return isHe ? fallbackHe : fallbackEn;
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{isHe ? "טוען..." : "Loading..."}</div>
      </div>
    );
  }

  const FEATURES = isHe ? FEATURES_HE : FEATURES_EN;
  const HIGHLIGHTS = isHe ? HIGHLIGHTS_HE : HIGHLIGHTS_EN;

  return (
    <div className="min-h-screen bg-background overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.07] blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent/[0.08] blur-[100px] animate-pulse" style={{ animationDuration: "10s", animationDelay: "2s" }} />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-primary/[0.05] blur-[80px] animate-pulse" style={{ animationDuration: "12s", animationDelay: "4s" }} />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-card/90 backdrop-blur-xl shadow-sm border-b border-border/50" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/tabro-logo.png" alt="Tabro" className="h-8" />
            <span className="text-xl font-extrabold tracking-tight text-foreground">Tabro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLandingLang(isHe ? "en" : "he")} className="text-xs gap-1">
              <Globe className="h-3.5 w-3.5" />
              {isHe ? "EN" : "עב"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/auth")} className="gap-2 text-muted-foreground hover:text-foreground">
              <LogIn className="h-4 w-4" />
              {isHe ? "התחברות" : "Sign In"}
            </Button>
            <Button onClick={() => navigate("/auth?mode=signup")} className="gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4" />
              {isHe ? "הרשמה" : "Sign Up"}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center relative">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            {isHe ? "מערכת ניהול חיים חכמה עם AI" : "Smart Life Management System with AI"}
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.1] tracking-tight">
            {isHe ? (
              <>נהל את{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-l from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                    {lc("hero_title", "כל החיים שלך במקום אחד", "Your Entire Life in One Place").split(" ").slice(0, 3).join(" ")}
                  </span>
                  <span className="absolute bottom-2 left-0 right-0 h-3 bg-primary/15 -z-0 rounded-full" />
                </span>
                <br />{lc("hero_title", "כל החיים שלך במקום אחד", "Your Entire Life in One Place").split(" ").slice(3).join(" ")}
              </>
            ) : (
              <>
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                    {lc("hero_title", "כל החיים שלך במקום אחד", "Manage Your Entire Life")}
                  </span>
                  <span className="absolute bottom-2 left-0 right-0 h-3 bg-primary/15 -z-0 rounded-full" />
                </span>
              </>
            )}
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {lc("hero_subtitle",
              "משימות, פרויקטים, לו״ז, קניות, פתקים, ספרים, תשלומים, תזונה וסוכן AI חכם — הכל בפלטפורמה אחת",
              "Tasks, projects, calendar, shopping, notes, books, payments, nutrition and a smart AI agent — all in one platform"
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto text-right">
            <div className="rounded-2xl bg-card/70 p-4 backdrop-blur-sm shadow-sm">
              <h3 className="font-semibold text-foreground mb-1">{isHe ? "כניסה מודרכת" : "Guided Onboarding"}</h3>
              <p className="text-sm text-muted-foreground">{isHe ? "משתמש חדש מקבל מדריך מסודר, בחירת דשבורדים ובחירת עיצוב כבר בתחילת הדרך." : "New users get a guided setup — choose dashboards and design from the start."}</p>
            </div>
            <div className="rounded-2xl bg-card/70 p-4 backdrop-blur-sm shadow-sm">
              <h3 className="font-semibold text-foreground mb-1">{isHe ? "עבודה אישית או צוותית" : "Personal or Team Work"}</h3>
              <p className="text-sm text-muted-foreground">{isHe ? "משימות, פרויקטים, ריבוי אחראים, שיתופים והיסטוריה במקום אחד." : "Tasks, projects, multiple assignees, sharing and history in one place."}</p>
            </div>
            <div className="rounded-2xl bg-card/70 p-4 backdrop-blur-sm shadow-sm">
              <h3 className="font-semibold text-foreground mb-1">{isHe ? "AI שמבצע" : "AI That Acts"}</h3>
              <p className="text-sm text-muted-foreground">{isHe ? "הסוכן מופיע בפינה השמאלית התחתונה ומקבל ממך הוראות בשפה טבעית." : "The agent sits in the bottom-left corner and takes natural language instructions."}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="gap-2 text-base px-8 h-12 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]">
              <UserPlus className="h-5 w-5" />
              {lc("cta_text", "התחל בחינם", "Start for Free")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="gap-2 text-base px-8 h-12 hover:scale-[1.02] transition-all">
              <LogIn className="h-5 w-5" />
              {isHe ? "כבר יש לי חשבון" : "I already have an account"}
            </Button>
          </div>

          <div className="pt-8 flex justify-center">
            <ChevronDown className="h-6 w-6 text-muted-foreground/50 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Highlights strip */}
      <section className="bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            {lc("features_title", "כל מה שצריך, בדיוק במקום אחד", "Everything You Need, In One Place").split(",")[0]},{" "}
            <span className="text-primary">{lc("features_title", "כל מה שצריך, בדיוק במקום אחד", "Everything You Need, In One Place").split(",")[1]}</span>
          </h2>
          <p className="text-muted-foreground text-lg">{lc("features_subtitle", "12 מודולים חזקים שעוזרים לך להפוך מחשבות לפעולה", "12 powerful modules that turn thoughts into action")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="group relative rounded-2xl bg-card/80 backdrop-blur-sm p-5 space-y-3 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 shadow-sm">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 -z-10`} />
            </div>
          ))}
        </div>
      </section>

      {/* Theme Customization */}
      <section className="bg-card/50 backdrop-blur-sm py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium">
              <Palette className="h-4 w-4" />
              {isHe ? "התאמה אישית" : "Customization"}
            </div>
            <h2 className="text-3xl font-bold text-foreground">
              {isHe ? <>עצב את המערכת <span className="text-primary">כמו שנוח לך</span></> : <>Design it <span className="text-primary">your way</span></>}
            </h2>
            <p className="text-muted-foreground">{isHe ? "בחר ערכת עיצוב, שנה בין מצב בהיר לכהה — הכל מתעדכן מיד" : "Choose a theme, switch between light and dark — everything updates instantly"}</p>
          </div>

          <div className="flex justify-center mb-6">
            <Button variant="outline" size="sm" className="gap-2" onClick={toggleMode}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? (isHe ? "מצב בהיר" : "Light Mode") : (isHe ? "מצב כהה" : "Dark Mode")}
            </Button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {SITE_THEME_PRESETS.slice(0, 12).map((theme) => (
              <button key={theme.id} onClick={() => setThemeId(theme.id)} className={`p-2.5 rounded-xl border text-center transition-all text-xs font-medium ${themeId === theme.id ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-muted"}`}>
                {theme.name}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">+ {isHe ? `עוד ${SITE_THEME_PRESETS.length - 12} ערכות עיצוב זמינות בהגדרות` : `${SITE_THEME_PRESETS.length - 12} more themes available in settings`}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card/50 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{isHe ? "איך זה עובד?" : "How It Works"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {(isHe ? [
              { step: "1", title: "נרשמים ומאשרים מייל", desc: "פותחים חשבון, מאשרים את האימייל ונכנסים לאזור האישי" },
              { step: "2", title: "בוחרים דשבורדים ועיצוב", desc: "מגדירים איזה מסכים להציג ואיזה מראה נוח יותר לעבודה שלך" },
              { step: "3", title: "מתחילים לעבוד עם הסוכן", desc: "הסוכן בפינה השמאלית התחתונה ועוזר לך להוסיף, לעדכן ולתכנן" },
            ] : [
              { step: "1", title: "Sign Up & Confirm Email", desc: "Create an account, confirm your email and enter your personal area" },
              { step: "2", title: "Choose Dashboards & Design", desc: "Configure which screens to display and which look suits your workflow" },
              { step: "3", title: "Start Working with the Agent", desc: "The agent sits at the bottom-left corner and helps you add, update and plan" },
            ]).map(({ step, title, desc }) => (
              <div key={step} className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary">{step}</div>
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{isHe ? "מוכן להתחיל?" : "Ready to Start?"}</h2>
          <p className="text-muted-foreground text-lg">{isHe ? "הצטרף עכשיו בחינם ותתחיל לנהל את החיים שלך בצורה חכמה יותר" : "Join now for free and start managing your life smarter"}</p>
          <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="gap-2 text-base px-10 h-13 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]">
            <Sparkles className="h-5 w-5" />
            {lc("cta_text", "צור חשבון בחינם", "Create Free Account")}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground space-y-4">
        <div>
          <span className="font-medium text-foreground">Tabro</span> — {isHe ? "מערכת ניהול אישית" : "Personal Management System"} © {new Date().getFullYear()}
        </div>
        <div className="flex justify-center gap-4 text-xs">
          <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">{isHe ? "תנאי שימוש" : "Terms"}</button>
          <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">{isHe ? "מדיניות פרטיות" : "Privacy"}</button>
          <button onClick={() => navigate("/accessibility")} className="hover:text-foreground transition-colors">{isHe ? "נגישות" : "Accessibility"}</button>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs">
          <a href="mailto:info@tabro.org" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Mail className="h-3 w-3" />info@tabro.org
          </a>
          <a href="mailto:tabro855@gmail.com" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Mail className="h-3 w-3" />tabro855@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
