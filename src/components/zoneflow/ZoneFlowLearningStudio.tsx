import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, BrainCircuit, CheckCircle2, Clock3, Flame, History, Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { toast } from "sonner";

const LEARNING_PATHS: Record<string, string[]> = {
  פיזיקה: ["כוחות ותנועה", "אנרגיה", "גלים ואור", "חשמל", "פיזיקה מודרנית"],
  היסטוריה: ["העולם העתיק", "ימי הביניים", "העת החדשה", "המאה העשרים", "היסטוריה ישראלית"],
  כימיה: ["אטומים ויסודות", "קשרים כימיים", "תגובות", "חומצות ובסיסים", "כימיה אורגנית"],
  ביולוגיה: ["התא", "גנטיקה", "מערכות הגוף", "אבולוציה", "אקולוגיה"],
  פילוסופיה: ["לוגיקה", "מוסר", "תורת ההכרה", "פילוסופיה פוליטית", "פילוסופיית המדע"],
  כלכלה: ["מחסור ותמריצים", "היצע וביקוש", "אינפלציה וריבית", "שוק העבודה", "כלכלה התנהגותית"],
  פסיכולוגיה: ["זיכרון ולמידה", "רגשות", "קבלת החלטות", "פסיכולוגיה חברתית", "הרגלים"],
  טכנולוגיה: ["איך האינטרנט עובד", "תכנות", "אבטחת מידע", "בינה מלאכותית", "מחשוב ענן"],
};
const CATEGORIES = Object.keys(LEARNING_PATHS);
const LEVELS = [
  { id: "beginner", label: "מתחיל/ה", instruction: "הסבר מהבסיס, ללא הנחת ידע קודם" },
  { id: "intermediate", label: "ביניים", instruction: "הנח היכרות בסיסית והעמק במנגנון" },
  { id: "advanced", label: "מתקדם/ת", instruction: "הצג דיוק, הסתייגויות וקשרים מורכבים" },
] as const;
const FALLBACK_TOPICS: Record<string, { title: string; content: string }> = {
  פיזיקה: { title: "למה השמיים כחולים?", content: "אור השמש נראה לבן, אך הוא מורכב מצבעים בעלי אורכי גל שונים. כשהאור נכנס לאטמוספרה, מולקולות האוויר מפזרות אור כחול יותר מאור אדום. הפיזור נקרא פיזור ריילי. בשקיעה האור עובר דרך ארוכה יותר באטמוספרה, רוב הכחול מתפזר הצידה ולכן מגיעים לעינינו יותר אדום וכתום." },
  היסטוריה: { title: "איך הכתב שינה את החברה?", content: "הכתב אפשר לחברות לשמור מידע מעבר לזיכרון האנושי: חוקים, מסים, מסחר וסיפורים. הרשומות הראשונות במסופוטמיה היו בעיקר כלכליות. בהמשך הכתב יצר מנהל ציבורי מורכב, אפשר העברת ידע בין דורות ושינה את מאזן הכוח בין מי שידעו לקרוא לבין מי שלא." },
  פסיכולוגיה: { title: "אפקט המרווח בלמידה", content: "אנחנו זוכרים טוב יותר כאשר מפזרים את הלמידה על פני זמן במקום לדחוס אותה בפעם אחת. כל חזרה שמתרחשת אחרי שכבר התחילה שכחה מחזקת את שליפת המידע. לכן עדיף לחזור בקצרה היום, בעוד יומיים ובעוד שבוע מאשר ללמוד שעה רצופה אחת." },
  כימיה: { title: "למה מלח נמס במים?", content: "מלח שולחן בנוי מיונים חיוביים ושליליים שמוחזקים בסריג. מולקולת מים היא קוטבית: צד אחד מעט שלילי והצד האחר מעט חיובי. המים מקיפים את היונים, מחלישים את המשיכה ביניהם ומפזרים אותם בתמיסה. זו דוגמה להמסה, לא להיעלמות החומר." },
  ביולוגיה: { title: "קרום התא: שומר הסף הבררני", content: "קרום התא בנוי בעיקר משכבה כפולה של שומנים וחלבונים. הוא אינו קיר אטום: חומרים קטנים מסוימים עוברים ישירות, ואחרים זקוקים לתעלות או לנשאים. הבררנות מאפשרת לתא לשמור על סביבה פנימית יציבה גם כשהסביבה החיצונית משתנה." },
  פילוסופיה: { title: "מה הופך טיעון לתקף?", content: "טיעון תקף הוא טיעון שבו, אם ההנחות נכונות, המסקנה חייבת להיות נכונה. תקפות אינה אומרת שההנחות אכן נכונות. למשל: כל הציפורים מדברות; דרור הוא ציפור; לכן דרור מדבר. המבנה תקף, אף שההנחה הראשונה שגויה." },
  כלכלה: { title: "עלות אלטרנטיבית", content: "לכל בחירה יש מחיר שאינו מופיע תמיד בחשבון: האפשרות הטובה ביותר שעליה ויתרנו. אם בחרנו ללמוד שעה, העלות האלטרנטיבית עשויה להיות שעה של עבודה או מנוחה. המושג עוזר להשוות החלטות לפי מה שמפסידים, לא רק לפי מה שמשלמים." },
  טכנולוגיה: { title: "מה קורה כשמקלידים כתובת אתר?", content: "הדפדפן מבקש משרת DNS לתרגם את שם האתר לכתובת מספרית, יוצר חיבור מוצפן לשרת, שולח בקשת HTTP ומקבל קבצים כמו HTML, CSS ו-JavaScript. לאחר מכן הוא מפרש אותם ומצייר את העמוד. כל שלב יכול להישמר במטמון כדי להאיץ ביקורים חוזרים." },
};

interface LearningEntry { id: string; date: string; category: string; subtopic?: string; level?: string; title: string; summary: string; feedback?: string }

const formatClock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function ZoneFlowLearningStudio({ userId }: { userId?: string }) {
  const storageKey = `zoneflow-learning-history-${userId || "guest"}`;
  const [category, setCategory] = useState("פסיכולוגיה");
  const [subtopic, setSubtopic] = useState(LEARNING_PATHS["פסיכולוגיה"][0]);
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("beginner");
  const [topic, setTopic] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<LearningEntry[]>(() => safeLocalStorage.getJSON(storageKey, []));
  const targetEnd = useRef<number | null>(null);

  useEffect(() => safeLocalStorage.setJSON(storageKey, history), [history, storageKey]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (!targetEnd.current) return;
      const next = Math.max(0, Math.ceil((targetEnd.current - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) setRunning(false);
    }, 250);
    return () => window.clearInterval(timer);
  }, [running]);

  const stats = useMemo(() => {
    const days = new Set(history.map((entry) => new Date(entry.date).toDateString()));
    let streak = 0;
    const cursor = new Date();
    while (days.has(cursor.toDateString())) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    const byCategory = history.reduce<Record<string, number>>((acc, entry) => { acc[entry.category] = (acc[entry.category] || 0) + 1; return acc; }, {});
    return { streak, byCategory };
  }, [history]);

  const generateTopic = async (requestedCategory = category) => {
    const selected = requestedCategory === "הפתעה" ? CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)] : requestedCategory;
    const selectedSubtopic = requestedCategory === "הפתעה" ? LEARNING_PATHS[selected][Math.floor(Math.random() * LEARNING_PATHS[selected].length)] : subtopic;
    setCategory(selected);
    setSubtopic(selectedSubtopic);
    setLoading(true);
    setTopic(null);
    setSummary("");
    setFeedback("");
    setSecondsLeft(600);
    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          type: "custom",
          prompt: `צור שיעור יומי קצר בעברית בתחום ${selected}, במסלול ${selectedSubtopic}. רמה: ${LEVELS.find((item) => item.id === level)?.instruction}. בחר מושג אחד ספציפי ולא "מבוא כללי". החזר בדיוק JSON עם title ו-content. התוכן יתאים לכ-5 דקות קריאה ויכלול הגדרה פשוטה, למה זה חשוב, דוגמה מחיי היום יום, טעות נפוצה ושאלת בדיקה. ללא Markdown וללא ייעוץ אישי.`,
        },
      });
      if (error) throw error;
      const raw = String(data?.result || data?.suggestion || "").replace(/^```json\s*|```$/g, "").trim();
      const parsed = JSON.parse(raw);
      if (!parsed.title || !parsed.content) throw new Error("Invalid lesson format");
      setTopic({ title: String(parsed.title), content: String(parsed.content) });
    } catch (error) {
      console.error("Learning topic generation failed:", error);
      setTopic(FALLBACK_TOPICS[selected] || { title: selectedSubtopic, content: `המושג היומי הוא ${selectedSubtopic}. התחילו בהגדרה קצרה, מצאו דוגמה אחת מחיי היום־יום, ואז נסחו במילים שלכם מה המושג מסביר ומה עדיין לא ברור. השיעור נשמר בהיסטוריה כדי שהשלב הבא יוכל להמשיך ממנו.` });
      toast.info("הוצג שיעור חלופי שמור; אפשר לנסות ליצור שיעור חדש מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    if (!topic) return;
    targetEnd.current = Date.now() + secondsLeft * 1000;
    setRunning(true);
  };

  const completeLesson = async () => {
    if (!topic || summary.trim().length < 30) {
      toast.error("הסיכום צריך לכלול לפחות 30 תווים במילים שלך.");
      return;
    }
    let nextFeedback = "הסיכום נשמר. נסה לחזור עליו שוב מחר במשפט אחד.";
    try {
      const { data } = await supabase.functions.invoke("task-ai-helper", {
        body: { type: "custom", prompt: `תן משוב קצר, תומך ומדויק בעברית על סיכום תלמיד. ציין נקודה אחת שכוסתה ונקודה אחת שאפשר לחדד. נושא: ${topic.title}\nתוכן: ${topic.content}\nסיכום: ${summary}` },
      });
      nextFeedback = data?.result || data?.suggestion || nextFeedback;
    } catch (error) {
      console.error("Learning feedback failed:", error);
    }
    const entry = { id: crypto.randomUUID(), date: new Date().toISOString(), category, subtopic, level, title: topic.title, summary: summary.trim(), feedback: nextFeedback };
    setHistory((current) => [entry, ...current]);
    setFeedback(nextFeedback);
    toast.success("השיעור והסיכום נשמרו בהיסטוריה");
  };

  return (
    <div className="space-y-5 rounded-[2rem] bg-[radial-gradient(circle_at_15%_5%,rgba(251,191,36,.16),transparent_25%),linear-gradient(145deg,#f8f5ec,#eef5ef)] p-4 text-slate-900 sm:p-6" dir="rtl">
      <section className="overflow-hidden rounded-[2rem] border border-[#dbcda9] bg-[#fffdf7] shadow-[0_24px_70px_rgba(80,63,35,.12)]">
        <div className="grid gap-6 p-5 lg:grid-cols-[.7fr_1.3fr] sm:p-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[.15em] text-amber-700"><BrainCircuit className="h-4 w-4" />DAILY DISCOVERY</div>
            <h2 className="mt-3 font-serif text-3xl font-semibold">למד דבר חדש בכל יום</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">עשר דקות של קריאה ממוקדת, ואז סיכום קצר במילים שלך. הידע נשמר ונבנה למסלול.</p>
            <div className="mt-5 flex flex-wrap gap-2">{CATEGORIES.map((item) => <button key={item} onClick={() => { setCategory(item); setSubtopic(LEARNING_PATHS[item][0]); }} className={`rounded-full border px-3 py-1.5 text-xs transition ${category === item ? "border-amber-700 bg-amber-700 text-white" : "border-[#dfd5bd] bg-white hover:bg-amber-50"}`}>{item}</button>)}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">מאיפה להתחיל<select value={subtopic} onChange={(event) => setSubtopic(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#dfd5bd] bg-white px-3 text-sm">{LEARNING_PATHS[category].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-600">רמת השיעור<select value={level} onChange={(event) => setLevel(event.target.value as typeof level)} className="mt-1 h-10 w-full rounded-xl border border-[#dfd5bd] bg-white px-3 text-sm">{LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </div>
            <div className="mt-4 flex gap-2"><Button onClick={() => void generateTopic(category)} disabled={loading} className="bg-[#263f38] text-white hover:bg-[#36584e]">{loading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Sparkles className="ms-2 h-4 w-4" />}צור שיעור יומי</Button><Button variant="outline" onClick={() => void generateTopic("הפתעה")} disabled={loading}>הפתעה אותי</Button></div>
          </div>
          <div className="rounded-[1.6rem] border border-[#e2d8c2] bg-white p-5 shadow-sm">
            {!topic && !loading && <div className="grid min-h-60 place-items-center text-center text-slate-400"><div><BookOpenCheck className="mx-auto h-10 w-10" /><p className="mt-3 text-sm">בחר תחום וצור את השיעור של היום</p></div></div>}
            {loading && <div className="grid min-h-60 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-amber-700" /></div>}
            {topic && <><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-medium text-amber-700">{category} · {subtopic} · {LEVELS.find((item) => item.id === level)?.label}</span><h3 className="mt-1 text-2xl font-semibold">{topic.title}</h3></div><div className="rounded-xl bg-[#263f38] px-3 py-2 font-mono text-lg text-white">{formatClock(secondsLeft)}</div></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{topic.content}</p><div className="mt-5 flex gap-2"><Button onClick={startTimer} disabled={running || secondsLeft === 0}><Play className="ms-1 h-4 w-4" />{running ? "לומדים עכשיו" : secondsLeft < 600 ? "המשך טיימר" : "התחל 10 דקות"}</Button><Button variant="ghost" size="icon" onClick={() => { setRunning(false); setSecondsLeft(600); targetEnd.current = null; }}><RotateCcw className="h-4 w-4" /></Button></div></>}
          </div>
        </div>
      </section>

      {topic && <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-[1.6rem] border border-slate-200 bg-white p-5"><h3 className="font-semibold">מה הבנת מהשיעור?</h3><p className="mt-1 text-xs text-slate-500">חובה לנסח במילים שלך. אין כפתור “סיימתי” ללא סיכום.</p><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-3 min-h-32" placeholder="כתוב כאן את הרעיון המרכזי, דוגמה ושאלה שנשארה לך..." /><Button className="mt-3" onClick={() => void completeLesson()} disabled={summary.trim().length < 30}><CheckCircle2 className="ms-1 h-4 w-4" />שמור וקבל משוב</Button>{feedback && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">{feedback}</div>}</div><div className="grid grid-cols-2 gap-3"><div className="rounded-[1.6rem] border bg-white p-4"><Flame className="h-5 w-5 text-orange-500" /><strong className="mt-3 block text-3xl">{stats.streak}</strong><span className="text-xs text-slate-500">ימי למידה ברצף</span></div><div className="rounded-[1.6rem] border bg-white p-4"><Clock3 className="h-5 w-5 text-sky-600" /><strong className="mt-3 block text-3xl">{history.length}</strong><span className="text-xs text-slate-500">נושאים שנלמדו</span></div><div className="col-span-2 rounded-[1.6rem] border bg-white p-4"><p className="text-sm font-semibold">התקדמות לפי תחום</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(stats.byCategory).map(([name, count]) => <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{name} · {count}</span>)}</div></div></div></section>}

      {history.length > 0 && <section className="rounded-[1.6rem] border bg-white p-5"><div className="flex items-center gap-2"><History className="h-5 w-5 text-slate-500" /><h3 className="font-semibold">היסטוריית למידה</h3></div><div className="mt-4 grid gap-3 md:grid-cols-2">{history.slice(0, 12).map((entry) => <article key={entry.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{entry.title}</strong><span className="text-[11px] text-slate-400">{new Date(entry.date).toLocaleDateString("he-IL")}</span></div><span className="mt-1 block text-xs text-amber-700">{entry.category}</span><p className="mt-3 text-xs leading-6 text-slate-600">{entry.summary}</p></article>)}</div></section>}
    </div>
  );
}
