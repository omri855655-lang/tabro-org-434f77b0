import { useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, CheckCircle2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { safeLocalStorage } from "@/lib/safeLocalStorage";

type Pattern = "clarity" | "fear" | "energy" | "overload" | "distraction";
type Answers = Record<string, number>;

const QUESTIONS: Array<{ id: string; text: string; pattern: Pattern }> = [
  { id: "q1", text: "כשאני דוחה, לרוב לא ברור לי מהו הצעד הראשון.", pattern: "clarity" },
  { id: "q2", text: "אני מחכה שאוכל לעשות את המשימה בצורה מושלמת.", pattern: "fear" },
  { id: "q3", text: "גם משימה קטנה מרגישה כבדה כשאין לי אנרגיה.", pattern: "energy" },
  { id: "q4", text: "יש לי יותר מדי משימות ואני קופא מול כולן.", pattern: "overload" },
  { id: "q5", text: "הטלפון, טאבים או הודעות מושכים אותי לפני שהתחלתי.", pattern: "distraction" },
  { id: "q6", text: "אני נמנע ממשימה כי אני חושש לטעות או להישפט.", pattern: "fear" },
  { id: "q7", text: "אני מעריך לא נכון כמה זמן המשימה תיקח.", pattern: "clarity" },
  { id: "q8", text: "אחרי הפרעה קטנה קשה לי מאוד לחזור למסלול.", pattern: "distraction" },
];

const RESULTS: Record<Pattern, { title: string; detail: string; first: string }> = {
  clarity: { title: "ערפל בצעד הבא", detail: "הקושי המרכזי נראה כמו חוסר בהירות, לא חוסר רצון.", first: "כתוב פעולה פיזית אחת שאפשר לבצע בחמש דקות." },
  fear: { title: "פחד מטעות או פרפקציוניזם", detail: "המוח מנסה להגן עליך מביקורת ולכן דוחה התחלה.", first: "צור טיוטה מכוערת בכוונה, בלי להראות אותה לאיש." },
  energy: { title: "עומס אנרגטי", detail: "ייתכן שהמשימות מתחרות עם עייפות ולא עם מוטיבציה.", first: "בחר חלון של 10 דקות בשעת האנרגיה הטובה שלך." },
  overload: { title: "הצפה וריבוי משימות", detail: "יותר מדי אפשרויות מקשות על המוח לבחור.", first: "החנה את כל המשימות מלבד אחת ברשימת 'לא עכשיו'." },
  distraction: { title: "סביבה שמושכת קשב", detail: "החיכוך הדיגיטלי מנצח לפני שנוצר מומנטום.", first: "הפעל חדר ריכוז וחסימה ל-15 דקות בלבד." },
};

export function ProcrastinationAssessment() {
  const [answers, setAnswers] = useState<Answers>(() => safeLocalStorage.getJSON("zoneflow-procrastination-assessment", {}));
  const [step, setStep] = useState(() => Object.keys(answers).length >= QUESTIONS.length ? QUESTIONS.length : 0);
  const question = QUESTIONS[step];
  const completed = Object.keys(answers).length;
  const result = useMemo(() => {
    if (completed < QUESTIONS.length) return null;
    const scores = { clarity: 0, fear: 0, energy: 0, overload: 0, distraction: 0 };
    QUESTIONS.forEach((item) => { scores[item.pattern] += answers[item.id] || 0; });
    const pattern = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "clarity") as Pattern;
    return RESULTS[pattern];
  }, [answers, completed]);

  const answer = (value: number) => {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    safeLocalStorage.setJSON("zoneflow-procrastination-assessment", next);
    setStep((current) => Math.min(QUESTIONS.length, current + 1));
  };

  const reset = () => { setAnswers({}); setStep(0); safeLocalStorage.remove("zoneflow-procrastination-assessment"); };

  return <div className="mb-5 overflow-hidden rounded-[1.75rem] border border-indigo-200 bg-gradient-to-br from-indigo-950 via-indigo-800 to-cyan-700 p-5 text-white shadow-lg">
    <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><BrainCircuit className="h-4 w-4" />מיפוי דפוס הדחיינות</div><h3 className="mt-2 text-xl font-black">קודם מבינים מה עוצר אותך</h3></div>{step > 0 && !result && <Button size="icon" variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /></Button>}</div>
    <Progress value={completed / QUESTIONS.length * 100} className="mt-4 h-2 bg-white/15" />
    {!result && question && <div className="mt-5"><p className="text-lg font-semibold leading-8">{question.text}</p><div className="mt-4 grid grid-cols-4 gap-2">{[{ v: 0, l: "בכלל לא" }, { v: 1, l: "מעט" }, { v: 2, l: "די נכון" }, { v: 3, l: "מאוד" }].map(({ v, l }) => <Button key={v} variant="secondary" className="h-auto min-h-12 whitespace-normal bg-white/10 text-xs text-white hover:bg-white/20" onClick={() => answer(v)}>{l}</Button>)}</div><p className="mt-3 text-xs text-white/55">שאלה {step + 1} מתוך {QUESTIONS.length}. זהו כלי הכוונה, לא אבחון רפואי.</p></div>}
    {result && <div className="mt-5 rounded-3xl bg-white/10 p-4 backdrop-blur"><div className="flex items-center gap-2 font-bold text-cyan-200"><CheckCircle2 className="h-5 w-5" />הדפוס הבולט שלך</div><h4 className="mt-2 text-2xl font-black">{result.title}</h4><p className="mt-2 text-sm leading-7 text-white/80">{result.detail}</p><div className="mt-4 rounded-2xl bg-white p-3 text-sm font-semibold text-indigo-950">הצעד הראשון להיום: {result.first}</div><Button variant="ghost" size="sm" onClick={reset} className="mt-3 text-white hover:bg-white/10 hover:text-white"><RotateCcw className="h-4 w-4" />בצע מיפוי מחדש</Button></div>}
  </div>;
}
