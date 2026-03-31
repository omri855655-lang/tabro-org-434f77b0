import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LogIn,
  UserPlus,
  BookOpen,
  FolderKanban,
  CalendarDays,
  Focus,
  Trophy,
  ListTodo,
  ChevronDown,
  Sparkles,
  ShoppingCart,
  StickyNote,
  CreditCard,
  Target,
  Apple,
  Bot,
  Users,
  Shield,
  Zap,
  Globe,
  ArrowLeft,
} from "lucide-react";

const FEATURES = [
  { icon: ListTodo, title: "משימות חכמות", desc: "נהל משימות אישיות ועבודה עם סטטוסים, קטגוריות, שיתוף גליונות ו-AI שמציע ומנתח", color: "from-blue-500 to-cyan-500" },
  { icon: CalendarDays, title: "מתכנן יומי + לוז", desc: "תכנן את היום עם AI, נהל אירועים ביומן כולל ימי הולדת, חגים ותזכורות", color: "from-violet-500 to-purple-500" },
  { icon: Focus, title: "Deeply — מצב ריכוז", desc: "תדרים בינאורליים, פומודורו, מוזיקת רקע ומאמן AI לעבודה עמוקה", color: "from-emerald-500 to-teal-500" },
  { icon: FolderKanban, title: "ניהול פרויקטים", desc: "פרויקטים עם צוות, ריבוי אחראים למשימה, קישורים, אבני דרך AI וסנכרון לדשבורדים", color: "from-sky-500 to-indigo-500" },
  { icon: Bot, title: "סוכן AI חכם", desc: "סוכן שמבין את כל המערכת — מוסיף משימות, פתקים, אירועים ותזכורות בשבילך", color: "from-fuchsia-500 to-pink-500" },
  { icon: ShoppingCart, title: "רשימת קניות", desc: "קטלוג קבוע לפי קטגוריות, הוספה מהירה, היסטוריה, סל מחזור ושיתוף", color: "from-orange-500 to-red-500" },
  { icon: StickyNote, title: "פתקים", desc: "פתקים צבעוניים עם הצמדה, ארכיון, קטגוריות וחיפוש — כמו לוח מודעות דיגיטלי", color: "from-yellow-500 to-amber-500" },
  { icon: BookOpen, title: "ספרים ומדיה", desc: "עקוב אחרי ספרים, סדרות, פודקאסטים וקורסים עם סילבוס ושיעורים", color: "from-rose-500 to-pink-500" },
  { icon: Trophy, title: "אתגרים והישגים", desc: "רצפים, אתגרים מותאמים אישית ואנליטיקה שדוחפים אותך קדימה", color: "from-amber-500 to-orange-500" },
  { icon: Target, title: "מפת דרכים לחלומות", desc: "הגדר חלומות, צור אבני דרך עם AI, סנכרן ללוז ועקוב אחרי ההתקדמות", color: "from-indigo-500 to-violet-500" },
  { icon: CreditCard, title: "ניהול תשלומים", desc: "מעקב הכנסות והוצאות, תשלומים חוזרים, קטגוריות וניתוח תקציב AI", color: "from-green-500 to-emerald-500" },
  { icon: Apple, title: "תזונה וסט חיים", desc: "מעקב ארוחות, חישוב קלוריות AI, שגרה יומית חוזרת וסטופר יומי", color: "from-lime-500 to-green-500" },
];

const HIGHLIGHTS = [
  { icon: Bot, text: "סוכן AI שמנהל הכל" },
  { icon: Users, text: "שיתוף עם צוות ומשפחה" },
  { icon: Shield, text: "מאובטח עם PIN וגישה פרטית" },
  { icon: Zap, text: "ללא הגבלת משימות ופרויקטים" },
  { icon: Globe, text: "עברית ואנגלית, מכל מכשיר" },
  { icon: Sparkles, text: "AI מובנה ללא הגדרות" },
];

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/personal", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">טוען...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden" dir="rtl">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.07] blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent/[0.08] blur-[100px] animate-pulse" style={{ animationDuration: "10s", animationDelay: "2s" }} />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-violet-500/[0.05] blur-[80px] animate-pulse" style={{ animationDuration: "12s", animationDelay: "4s" }} />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-card/90 backdrop-blur-xl shadow-sm border-b border-border/50" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/tabro-logo.png" alt="Tabro" className="h-8" />
            <span className="text-xl font-extrabold tracking-tight text-foreground">Tabro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="gap-2 text-muted-foreground hover:text-foreground">
              <LogIn className="h-4 w-4" />
              התחברות
            </Button>
            <Button onClick={() => navigate("/auth?mode=signup")} className="gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4" />
              הרשמה
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center relative">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            מערכת ניהול חיים חכמה עם AI
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.1] tracking-tight">
            נהל את{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-l from-primary via-violet-500 to-primary bg-clip-text text-transparent">
                כל החיים שלך
              </span>
              <span className="absolute bottom-2 left-0 right-0 h-3 bg-primary/15 -z-0 rounded-full" />
            </span>
            <br />
            במקום אחד
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            משימות, פרויקטים, לו״ז, קניות, פתקים, ספרים, תשלומים, תזונה ו-
            <span className="text-foreground font-medium">סוכן AI חכם</span> — הכל בפלטפורמה אחת
             שעוזרת לך לנהל את החיים בצורה חכמה, מסודרת וברורה יותר.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto text-right">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
              <h3 className="font-semibold text-foreground mb-1">כניסה מודרכת</h3>
              <p className="text-sm text-muted-foreground">משתמש חדש מקבל מדריך מסודר, בחירת דשבורדים ובחירת עיצוב כבר בתחילת הדרך.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
              <h3 className="font-semibold text-foreground mb-1">עבודה אישית או צוותית</h3>
              <p className="text-sm text-muted-foreground">משימות, פרויקטים, ריבוי אחראים, שיתופים והיסטוריה במקום אחד.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
              <h3 className="font-semibold text-foreground mb-1">AI שמבצע</h3>
              <p className="text-sm text-muted-foreground">הסוכן מופיע בפינה השמאלית התחתונה ומקבל ממך הוראות בשפה טבעית.</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={() => navigate("/auth?mode=signup")}
              className="gap-2 text-base px-8 h-12 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
            >
              <UserPlus className="h-5 w-5" />
              התחל בחינם
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="gap-2 text-base px-8 h-12 hover:scale-[1.02] transition-all"
            >
              <LogIn className="h-5 w-5" />
              כבר יש לי חשבון
            </Button>
          </div>

          <div className="pt-8 flex justify-center">
            <ChevronDown className="h-6 w-6 text-muted-foreground/50 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Highlights strip */}
      <section className="border-y border-border/50 bg-card/50 backdrop-blur-sm">
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
            כל מה שצריך, <span className="text-primary">בדיוק במקום אחד</span>
          </h2>
          <p className="text-muted-foreground text-lg">12 מודולים חזקים שעוזרים לך להפוך מחשבות לפעולה</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 space-y-3 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
            >
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

      {/* How it works */}
      <section className="bg-card/50 border-y border-border/50 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">איך זה עובד?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
               { step: "1", title: "נרשמים ומאשרים מייל", desc: "פותחים חשבון, מאשרים את האימייל ונכנסים לאזור האישי" },
               { step: "2", title: "בוחרים דשבורדים ועיצוב", desc: "מגדירים איזה מסכים להציג ואיזה מראה נוח יותר לעבודה שלך" },
               { step: "3", title: "מתחילים לעבוד עם הסוכן", desc: "הסוכן בפינה השמאלית התחתונה ועוזר לך להוסיף, לעדכן ולתכנן" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary">
                  {step}
                </div>
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
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
             מוכן להתחיל?
          </h2>
          <p className="text-muted-foreground text-lg">
            הצטרף עכשיו בחינם ותתחיל לנהל את החיים שלך בצורה חכמה יותר
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth?mode=signup")}
            className="gap-2 text-base px-10 h-13 shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="h-5 w-5" />
            צור חשבון בחינם
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Tabro</span> — מערכת ניהול אישית © {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Landing;
