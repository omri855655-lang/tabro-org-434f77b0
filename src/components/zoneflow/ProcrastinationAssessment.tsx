import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, CalendarDays, CheckCircle2, Clock3, RotateCcw, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useActivityEvents } from "@/hooks/useActivityEvents";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { supabase } from "@/integrations/supabase/client";

type Pattern = "clarity" | "fear" | "energy" | "overload" | "distraction";
type Answers = Record<string, number>;
interface Profile { goal: string; dailyMinutes: number; currentTasks: number; desiredTasks: number; daysPerWeek: number; }

type MindAssessmentClient = {
  from: (table: string) => {
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

const QUESTIONS: Array<{ id: string; he: string; en: string; pattern: Pattern }> = [
  { id: "q1", he: "לא ברור לי מהו הצעד הראשון.", en: "I often cannot identify the first step.", pattern: "clarity" },
  { id: "q2", he: "אני מחכה שאוכל לעשות את המשימה בצורה מושלמת.", en: "I wait until I can do the task perfectly.", pattern: "fear" },
  { id: "q3", he: "גם משימה קטנה מרגישה כבדה כשאין לי אנרגיה.", en: "Even a small task feels heavy when my energy is low.", pattern: "energy" },
  { id: "q4", he: "יש לי יותר מדי דברים ואני קופא מול כולם.", en: "I freeze when too many things compete for attention.", pattern: "overload" },
  { id: "q5", he: "טלפון, טאבים או הודעות מושכים אותי לפני שהתחלתי.", en: "My phone, tabs, or messages pull me away before I start.", pattern: "distraction" },
  { id: "q6", he: "אני נמנע כי אני חושש לטעות או להישפט.", en: "I avoid action because I fear mistakes or judgment.", pattern: "fear" },
  { id: "q7", he: "אני מעריך לא נכון כמה זמן פעולה תיקח.", en: "I often misjudge how long an action will take.", pattern: "clarity" },
  { id: "q8", he: "אחרי הפרעה קשה לי לחזור למסלול.", en: "It is hard to resume after an interruption.", pattern: "distraction" },
  { id: "q9", he: "אני מנסה לעשות יותר ממה שהזמן והכוחות מאפשרים.", en: "I plan more than my time and energy allow.", pattern: "overload" },
  { id: "q10", he: "אני דוחה גם דברים שחשובים לי בגלל תשישות.", en: "I delay important things because I feel depleted.", pattern: "energy" },
];

const RESULTS: Record<Pattern, { he: [string, string, string]; en: [string, string, string] }> = {
  clarity: { he: ["ערפל בצעד הבא", "הקושי המרכזי נראה כמו חוסר בהירות, לא חוסר רצון.", "לנסח פעולה פיזית אחת שאפשר לבצע בחמש דקות."], en: ["Unclear next step", "The main friction looks like uncertainty rather than unwillingness.", "Define one physical action that takes five minutes."] },
  fear: { he: ["פחד מטעות או פרפקציוניזם", "המוח מנסה להגן עליך מביקורת ולכן דוחה התחלה.", "ליצור טיוטה ראשונה לא מושלמת שלא חייבים להראות לאיש."], en: ["Fear or perfectionism", "Your mind may delay action to protect you from criticism.", "Create an intentionally imperfect private first draft."] },
  energy: { he: ["עומס אנרגטי", "המשימות מתחרות עם עייפות ולא רק עם מוטיבציה.", "לקבוע בלוק קצר בשעת האנרגיה הטובה ביותר שלך."], en: ["Energy load", "Your tasks may be competing with fatigue, not motivation.", "Place a short block in your best energy window."] },
  overload: { he: ["הצפה וריבוי משימות", "יותר מדי אפשרויות מקשות על המוח לבחור ולהתחיל.", "להשאיר משימה אחת פעילה ולהעביר את השאר ל'לא עכשיו'."], en: ["Overload", "Too many choices make it harder to select and begin.", "Keep one active task and move the rest to a not-now list."] },
  distraction: { he: ["סביבה שמושכת קשב", "החיכוך הדיגיטלי מנצח לפני שנוצר מומנטום.", "להפעיל חדר ריכוז וחסימה לבלוק קצר אחד."], en: ["Distracting environment", "Digital friction wins before momentum can form.", "Start one short focus room with blocking enabled."] },
};

const DEFAULT_PROFILE: Profile = { goal: "", dailyMinutes: 15, currentTasks: 1, desiredTasks: 3, daysPerWeek: 5 };

export function ProcrastinationAssessment({ journeyId, journeyTitle }: { journeyId: string; journeyTitle: string }) {
  const { user } = useAuth();
  const { reportActivity } = useActivityEvents();
  const { lang, dir } = useLanguage();
  const isHe = lang === "he";
  const key = `zoneflow-assessment-${journeyId}`;
  const [answers, setAnswers] = useState<Answers>(() => safeLocalStorage.getJSON(`${key}-answers`, {}));
  const [profile, setProfile] = useState<Profile>(() => safeLocalStorage.getJSON(`${key}-profile`, DEFAULT_PROFILE));
  const [phase, setPhase] = useState<"profile" | "questions" | "plan">(() => Object.keys(answers).length >= QUESTIONS.length ? "plan" : "profile");
  const [step, setStep] = useState(() => Math.min(Object.keys(answers).length, QUESTIONS.length - 1));
  const completed = Object.keys(answers).length;
  const question = QUESTIONS[step];

  const result = useMemo(() => {
    if (completed < QUESTIONS.length) return null;
    const scores: Record<Pattern, number> = { clarity: 0, fear: 0, energy: 0, overload: 0, distraction: 0 };
    QUESTIONS.forEach((item) => { scores[item.pattern] += answers[item.id] || 0; });
    const pattern = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "clarity") as Pattern;
    const text = RESULTS[pattern][isHe ? "he" : "en"];
    const weeklyCapacity = profile.dailyMinutes * profile.daysPerWeek;
    const block = profile.dailyMinutes <= 10 ? 5 : profile.dailyMinutes <= 25 ? 10 : 25;
    return { pattern, scores, title: text[0], detail: text[1], first: text[2], weeklyCapacity, block };
  }, [answers, completed, isHe, profile]);

  useEffect(() => {
    if (phase !== "plan" || !result || !user) return;
    const completedAt = new Date().toISOString();
    const plan = { title: result.title, detail: result.detail, firstAction: result.first, weeklyCapacity: result.weeklyCapacity, blockMinutes: result.block };
    const client = supabase as unknown as MindAssessmentClient;
    void client.from("zoneflow_mind_assessments").upsert({
      user_id: user.id,
      journey_id: journeyId,
      journey_title: journeyTitle,
      profile,
      answers,
      primary_pattern: result.pattern,
      scores: result.scores,
      plan,
      completed_at: completedAt,
      updated_at: completedAt,
    }, { onConflict: "user_id,journey_id" });
    void reportActivity({
      eventType: "mind_assessment_completed",
      source: "zoneflow_mind",
      idempotencyKey: `mind-assessment:${journeyId}:${JSON.stringify(answers)}`,
      referenceId: journeyId,
      occurredAt: completedAt,
      metadata: { journeyTitle, pattern: result.pattern, profile, scores: result.scores },
      label: `${journeyTitle} · assessment`,
      rewardSource: "journey",
    });
  }, [answers, journeyId, journeyTitle, phase, profile, reportActivity, result, user]);

  const saveProfile = () => {
    const normalized = { ...profile, dailyMinutes: Math.max(5, profile.dailyMinutes), currentTasks: Math.max(0, profile.currentTasks), desiredTasks: Math.max(1, profile.desiredTasks), daysPerWeek: Math.min(7, Math.max(1, profile.daysPerWeek)) };
    setProfile(normalized); safeLocalStorage.setJSON(`${key}-profile`, normalized); setPhase("questions");
  };
  const answer = (value: number) => {
    const next = { ...answers, [question.id]: value }; setAnswers(next); safeLocalStorage.setJSON(`${key}-answers`, next);
    if (step + 1 >= QUESTIONS.length) setPhase("plan"); else setStep(step + 1);
  };
  const reset = () => { setAnswers({}); setProfile(DEFAULT_PROFILE); setStep(0); setPhase("profile"); safeLocalStorage.remove(`${key}-answers`); safeLocalStorage.remove(`${key}-profile`); };

  return <div className="mb-5 overflow-hidden rounded-[1.75rem] border border-indigo-200 bg-gradient-to-br from-indigo-950 via-indigo-800 to-cyan-700 p-5 text-white shadow-lg" dir={dir}>
    <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><BrainCircuit className="h-4 w-4" />{isHe ? "מיפוי ובניית תוכנית אישית" : "Assessment and personal plan"}</div><h3 className="mt-2 text-xl font-black">{journeyTitle}</h3></div>{phase === "questions" && step > 0 && <Button size="icon" variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /></Button>}</div>
    <Progress value={phase === "profile" ? 5 : phase === "questions" ? 15 + completed / QUESTIONS.length * 70 : 100} className="mt-4 h-2 bg-white/15" />

    {phase === "profile" && <div className="mt-5 space-y-4"><p className="text-sm text-white/75">{isHe ? "כדי לבנות מסלול שמתאים לחיים שלך, נגדיר לאן תרצה להגיע ומה אפשרי כרגע." : "First define where you want to go and what is realistic right now."}</p><Input value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value })} placeholder={isHe ? "מה היית רוצה שישתנה בסוף המסלול?" : "What should be different at the end?"} className="border-white/20 bg-white/10 text-white placeholder:text-white/50" /><div className="grid gap-3 sm:grid-cols-2"><NumberField icon={Clock3} label={isHe ? "דקות ביום" : "Minutes per day"} value={profile.dailyMinutes} onChange={(dailyMinutes) => setProfile({ ...profile, dailyMinutes })} /><NumberField icon={CalendarDays} label={isHe ? "ימים בשבוע" : "Days per week"} value={profile.daysPerWeek} onChange={(daysPerWeek) => setProfile({ ...profile, daysPerWeek })} /><NumberField icon={CheckCircle2} label={isHe ? "כמה משימות אתה מסיים כיום" : "Tasks completed now"} value={profile.currentTasks} onChange={(currentTasks) => setProfile({ ...profile, currentTasks })} /><NumberField icon={Target} label={isHe ? "לכמה תרצה להגיע" : "Desired completed tasks"} value={profile.desiredTasks} onChange={(desiredTasks) => setProfile({ ...profile, desiredTasks })} /></div><Button className="w-full bg-white text-indigo-950 hover:bg-cyan-50" onClick={saveProfile}>{isHe ? "המשך למיפוי הקושי" : "Continue to assessment"}</Button></div>}

    {phase === "questions" && question && <div className="mt-5"><p className="text-lg font-semibold leading-8">{isHe ? question.he : question.en}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(isHe ? [{ v: 0, l: "בכלל לא" }, { v: 1, l: "מעט" }, { v: 2, l: "די נכון" }, { v: 3, l: "מאוד" }] : [{ v: 0, l: "Not at all" }, { v: 1, l: "A little" }, { v: 2, l: "Often" }, { v: 3, l: "Very much" }]).map(({ v, l }) => <Button key={v} variant="secondary" className="h-auto min-h-12 whitespace-normal bg-white/10 text-xs text-white hover:bg-white/20" onClick={() => answer(v)}>{l}</Button>)}</div><p className="mt-3 text-xs text-white/55">{step + 1} / {QUESTIONS.length}. {isHe ? "כלי הכוונה ולא אבחון רפואי." : "Guidance tool, not a medical diagnosis."}</p></div>}

    {phase === "plan" && result && <div className="mt-5 space-y-4"><div className="rounded-3xl bg-white/10 p-4 backdrop-blur"><div className="flex items-center gap-2 font-bold text-cyan-200"><CheckCircle2 className="h-5 w-5" />{isHe ? "הדפוס הבולט" : "Primary pattern"}</div><h4 className="mt-2 text-2xl font-black">{result.title}</h4><p className="mt-2 text-sm leading-7 text-white/80">{result.detail}</p></div><div className="grid gap-3 sm:grid-cols-3"><PlanCard title={isHe ? "שבוע 1 · התנעה" : "Week 1 · Start"} text={`${result.first} ${isHe ? `בלוקים של ${result.block} דקות.` : `${result.block}-minute blocks.`}`} /><PlanCard title={isHe ? "שבוע 2 · יציבות" : "Week 2 · Stabilize"} text={isHe ? `${profile.daysPerWeek} ימים, עד ${result.weeklyCapacity} דקות בשבוע. מסיימים גרסת מינימום גם ביום עמוס.` : `${profile.daysPerWeek} days and up to ${result.weeklyCapacity} minutes weekly. Keep a minimum version for hard days.`} /><PlanCard title={isHe ? "שבוע 3–4 · הגדלה" : "Weeks 3–4 · Grow"} text={isHe ? `עולים בהדרגה מ־${profile.currentTasks} ל־${profile.desiredTasks} משימות, רק אם שני שבועות היו יציבים.` : `Gradually move from ${profile.currentTasks} to ${profile.desiredTasks} tasks only after two stable weeks.`} /></div><div className="rounded-2xl bg-white p-4 text-sm text-indigo-950"><b>{isHe ? "היעד שלך:" : "Your goal:"}</b> {profile.goal || (isHe ? "להרגיש יותר שליטה ולהתחיל בעדינות" : "Feel more in control and begin gently")}</div><Button variant="ghost" size="sm" onClick={reset} className="text-white hover:bg-white/10 hover:text-white"><RotateCcw className="h-4 w-4" />{isHe ? "בנה תוכנית מחדש" : "Rebuild plan"}</Button></div>}
  </div>;
}

function NumberField({ icon: Icon, label, value, onChange }: { icon: typeof Clock3; label: string; value: number; onChange: (value: number) => void }) { return <label className="rounded-2xl bg-white/10 p-3 text-xs"><span className="mb-2 flex items-center gap-2 text-white/75"><Icon className="h-4 w-4" />{label}</span><Input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="border-white/20 bg-white/10 text-white" /></label>; }
function PlanCard({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-white/15 bg-white/10 p-3"><div className="text-sm font-bold text-cyan-200">{title}</div><p className="mt-2 text-xs leading-6 text-white/75">{text}</p></div>; }
