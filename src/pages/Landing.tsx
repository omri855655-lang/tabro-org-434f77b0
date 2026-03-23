import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  Lock,
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
} from "lucide-react";

const FEATURES = [
  { icon: ListTodo, title: "משימות חכמות", desc: "נהל משימות אישיות ועבודה עם סטטוסים, קטגוריות ו-AI", color: "from-blue-500 to-cyan-500" },
  { icon: CalendarDays, title: "מתכנן יומי AI", desc: "תכנן את היום שלך עם עוזר חכם שמכיר את המשימות שלך", color: "from-violet-500 to-purple-500" },
  { icon: Focus, title: "Deeply — מצב ריכוז", desc: "תדרים, פומודורו, מוזיקה ומאמן AI לעבודה עמוקה", color: "from-emerald-500 to-teal-500" },
  { icon: Trophy, title: "אתגרים והישגים", desc: "אנליטיקה, רצפים ואתגרים מותאמים אישית שדוחפים קדימה", color: "from-amber-500 to-orange-500" },
  { icon: BookOpen, title: "ספרים ומדיה", desc: "עקוב אחרי ספרים, סדרות, פודקאסטים וקורסים", color: "from-rose-500 to-pink-500" },
  { icon: FolderKanban, title: "פרויקטים", desc: "נהל פרויקטים עם צוות, משימות, קישורים ותאריכי יעד", color: "from-sky-500 to-indigo-500" },
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
      {/* Animated background blobs */}
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
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              Tabro
            </span>
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
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            מערכת ניהול חיים חכמה עם AI
          </div>

          {/* Main heading */}
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
            משימות, פרויקטים, לו״ז, ספרים, קורסים, שגרה יומית ו-
            <span className="text-foreground font-medium">עוזר AI חכם</span> — הכל
            בפלטפורמה אחת שעוזרת לך להיות הגרסה הטובה ביותר של עצמך.
          </p>

          {/* CTA Buttons */}
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

          {/* Scroll indicator */}
          <div className="pt-8 flex justify-center">
            <ChevronDown className="h-6 w-6 text-muted-foreground/50 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            הכל מה שצריך, <span className="text-primary">בדיוק במקום אחד</span>
          </h2>
          <p className="text-muted-foreground text-lg">כלים חזקים שעוזרים לך להפוך מחשבות לפעולה</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 space-y-4 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 -z-10`} />
            </div>
          ))}
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: "∞", label: "משימות ופרויקטים" },
              { value: "AI", label: "מתכנן ומאמן חכם" },
              { value: "24/7", label: "גישה מכל מכשיר" },
              { value: "🔒", label: "מאובטח ופרטי" },
            ].map(({ value, label }) => (
              <div key={label} className="space-y-1">
                <p className="text-3xl font-extrabold text-primary">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            מוכן להתחיל? 🚀
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
