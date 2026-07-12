import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Pause, Play, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/hooks/useLanguage";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { cn } from "@/lib/utils";

type Blocker = "unclear" | "fear" | "overload" | "energy" | "perfect";

const COPY = {
  he: {
    eyebrow: "להפשיר ולהתחיל",
    title: "רק הצעד הבא, לא כל המשימה",
    subtitle: "מסלול קצר שמזהה מה חוסם, מקטין את הצעד ומפעיל טיימר של 5 דקות.",
    pulse: "בדיקת מצב של 15 שניות",
    mood: "מצב רוח",
    energy: "אנרגיה",
    load: "עומס",
    task: "איזו משימה תקועה עכשיו?",
    taskPlaceholder: "לדוגמה: להתחיל את דרישת התשלום",
    blocker: "מה הכי חוסם כרגע?",
    blockers: { unclear: "לא ברור מאיפה להתחיל", fear: "פחד לטעות", overload: "יותר מדי דברים", energy: "אין אנרגיה", perfect: "צריך לצאת מושלם" },
    build: "בנה לי צעד ראשון",
    step: "הצעד הקטן שלך",
    confidence: "כמה בטוח שאפשר לעשות אותו?",
    shrink: "הביטחון נמוך, אז הקטנו את הצעד עוד יותר.",
    ifThen: "תוכנית אם-אז",
    ifLabel: "אם",
    thenLabel: "אז",
    ifPlaceholder: "למשל: אחרי הקפה",
    thenPlaceholder: "אפתח את הקובץ ואעשה את הצעד",
    start: "התחל 5 דקות",
    pause: "עצור",
    resume: "המשך",
    reset: "איפוס",
    completed: "עשיתי את הצעד",
    evidence: "מבוסס על צעדים מדורגים ותכנון אם-אז. זהו כלי תמיכה עצמית, לא אבחון או טיפול.",
    defaultStep: "פתח את החומר הרלוונטי וכתוב שורת התחלה אחת.",
    tinyStep: "פתח רק את החומר הרלוונטי והשאר אותו מוכן מולך.",
    mastery: "נשמר ניצחון קטן. בפעם הבאה נוכל להזכיר מה עזר לך להתחיל.",
  },
  en: {
    eyebrow: "Unfreeze and begin", title: "Only the next step, not the whole task", subtitle: "A short flow that identifies the blocker, shrinks the step, and starts a five-minute timer.", pulse: "15-second check-in", mood: "Mood", energy: "Energy", load: "Load", task: "Which task feels stuck?", taskPlaceholder: "For example: start the payment request", blocker: "What is blocking you most?", blockers: { unclear: "I do not know where to start", fear: "Fear of mistakes", overload: "Too many things", energy: "Low energy", perfect: "It must be perfect" }, build: "Build my first step", step: "Your small next step", confidence: "How confident are you that you can do it?", shrink: "Confidence is low, so we made the step even smaller.", ifThen: "If-then plan", ifLabel: "If", thenLabel: "Then", ifPlaceholder: "For example: after coffee", thenPlaceholder: "I will open the file and do the step", start: "Start 5 minutes", pause: "Pause", resume: "Resume", reset: "Reset", completed: "I did the step", evidence: "Based on graded steps and if-then planning. This is a self-support tool, not diagnosis or treatment.", defaultStep: "Open the relevant material and write one opening line.", tinyStep: "Only open the relevant material and leave it ready in front of you.", mastery: "A small win was saved. Next time we can remind you what helped you begin.",
  },
  es: {
    eyebrow: "Desbloquear y empezar", title: "Solo el siguiente paso, no toda la tarea", subtitle: "Un flujo breve que identifica el bloqueo, reduce el paso e inicia un temporizador de cinco minutos.", pulse: "Chequeo de 15 segundos", mood: "Animo", energy: "Energia", load: "Carga", task: "Que tarea esta bloqueada?", taskPlaceholder: "Por ejemplo: iniciar la solicitud de pago", blocker: "Que te bloquea mas?", blockers: { unclear: "No se por donde empezar", fear: "Miedo a equivocarme", overload: "Demasiadas cosas", energy: "Poca energia", perfect: "Debe quedar perfecto" }, build: "Crear mi primer paso", step: "Tu siguiente paso pequeno", confidence: "Que tan seguro estas de poder hacerlo?", shrink: "La confianza es baja, asi que hicimos el paso aun mas pequeno.", ifThen: "Plan si-entonces", ifLabel: "Si", thenLabel: "Entonces", ifPlaceholder: "Por ejemplo: despues del cafe", thenPlaceholder: "Abrire el archivo y hare el paso", start: "Empezar 5 minutos", pause: "Pausar", resume: "Continuar", reset: "Reiniciar", completed: "Hice el paso", evidence: "Basado en pasos graduales y planes si-entonces. Es una herramienta de autoapoyo, no diagnostico ni tratamiento.", defaultStep: "Abre el material relevante y escribe una primera linea.", tinyStep: "Solo abre el material relevante y dejalo listo frente a ti.", mastery: "Guardamos una pequena victoria. La proxima vez recordaremos que te ayudo a empezar.",
  },
  zh: {
    eyebrow: "解冻并开始", title: "只做下一步，不必完成整项任务", subtitle: "快速识别阻碍、缩小步骤，并启动五分钟计时。", pulse: "15秒状态检查", mood: "情绪", energy: "精力", load: "负担", task: "哪项任务卡住了？", taskPlaceholder: "例如：开始处理付款申请", blocker: "目前最大的阻碍是什么？", blockers: { unclear: "不知道从哪里开始", fear: "害怕出错", overload: "事情太多", energy: "精力不足", perfect: "必须做到完美" }, build: "生成第一步", step: "你的微小下一步", confidence: "你有多大把握完成它？", shrink: "把握较低，我们把步骤再缩小一点。", ifThen: "如果-那么计划", ifLabel: "如果", thenLabel: "那么", ifPlaceholder: "例如：喝完咖啡后", thenPlaceholder: "我会打开文件并完成这一步", start: "开始5分钟", pause: "暂停", resume: "继续", reset: "重置", completed: "我完成了这一步", evidence: "基于分级任务和如果-那么计划。这是自助支持工具，不用于诊断或治疗。", defaultStep: "打开相关材料，先写一句开头。", tinyStep: "只打开相关材料，并把它放在眼前准备好。", mastery: "已记录一次小胜利。下次我们会提醒你什么曾帮助你开始。",
  },
  ar: {
    eyebrow: "فك الجمود والبدء", title: "الخطوة التالية فقط، لا المهمة كلها", subtitle: "مسار قصير يحدد العائق ويصغر الخطوة ويشغل مؤقتا لخمس دقائق.", pulse: "فحص سريع خلال 15 ثانية", mood: "المزاج", energy: "الطاقة", load: "الضغط", task: "ما المهمة المتوقفة الآن؟", taskPlaceholder: "مثال: بدء طلب الدفع", blocker: "ما أكبر عائق الآن؟", blockers: { unclear: "لا أعرف من أين أبدأ", fear: "الخوف من الخطأ", overload: "أشياء كثيرة جدا", energy: "طاقة منخفضة", perfect: "يجب أن تكون مثالية" }, build: "أنشئ خطوتي الأولى", step: "خطوتك الصغيرة التالية", confidence: "ما مدى ثقتك بقدرتك على تنفيذها؟", shrink: "الثقة منخفضة، لذلك صغرنا الخطوة أكثر.", ifThen: "خطة إذا-فسوف", ifLabel: "إذا", thenLabel: "فسوف", ifPlaceholder: "مثال: بعد القهوة", thenPlaceholder: "سأفتح الملف وأنفذ الخطوة", start: "ابدأ 5 دقائق", pause: "إيقاف", resume: "متابعة", reset: "إعادة", completed: "أنجزت الخطوة", evidence: "مبني على خطوات متدرجة وتخطيط إذا-فسوف. أداة دعم ذاتي وليست تشخيصا أو علاجا.", defaultStep: "افتح المادة المناسبة واكتب سطر البداية فقط.", tinyStep: "افتح المادة المناسبة فقط واتركها جاهزة أمامك.", mastery: "تم حفظ انتصار صغير. في المرة القادمة سنذكرك بما ساعدك على البدء.",
  },
  ru: {
    eyebrow: "Выйти из ступора", title: "Только следующий шаг, не вся задача", subtitle: "Короткий сценарий определит барьер, уменьшит шаг и запустит таймер на пять минут.", pulse: "Проверка состояния за 15 секунд", mood: "Настроение", energy: "Энергия", load: "Нагрузка", task: "Какая задача сейчас застопорилась?", taskPlaceholder: "Например: начать запрос на оплату", blocker: "Что мешает больше всего?", blockers: { unclear: "Неясно, с чего начать", fear: "Страх ошибки", overload: "Слишком много дел", energy: "Мало энергии", perfect: "Нужно сделать идеально" }, build: "Создать первый шаг", step: "Ваш маленький следующий шаг", confidence: "Насколько вы уверены, что сможете это сделать?", shrink: "Уверенность низкая, поэтому мы сделали шаг еще меньше.", ifThen: "План если-то", ifLabel: "Если", thenLabel: "То", ifPlaceholder: "Например: после кофе", thenPlaceholder: "Я открою файл и выполню шаг", start: "Начать 5 минут", pause: "Пауза", resume: "Продолжить", reset: "Сброс", completed: "Я сделал шаг", evidence: "Основано на постепенных шагах и планировании если-то. Это инструмент самоподдержки, а не диагностика или лечение.", defaultStep: "Откройте нужный материал и напишите одну первую строку.", tinyStep: "Только откройте нужный материал и оставьте его готовым перед собой.", mastery: "Маленькая победа сохранена. В следующий раз мы напомним, что помогло вам начать.",
  },
} as const;

const BLOCKERS: Blocker[] = ["unclear", "fear", "overload", "energy", "perfect"];

export function ZoneFlowMindUnfreeze({ isLight }: { isLight: boolean }) {
  const { lang, dir } = useLanguage();
  const copy = COPY[lang] ?? COPY.en;
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [load, setLoad] = useState(3);
  const [task, setTask] = useState("");
  const [blocker, setBlocker] = useState<Blocker>("unclear");
  const [step, setStep] = useState("");
  const [confidence, setConfidence] = useState(7);
  const [ifText, setIfText] = useState("");
  const [thenText, setThenText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [running, setRunning] = useState(false);
  const [savedWin, setSavedWin] = useState(false);

  useEffect(() => {
    if (!running || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0) setRunning(false);
  }, [secondsLeft]);

  const displayStep = confidence < 7 ? copy.tinyStep : step || copy.defaultStep;
  const timerLabel = useMemo(() => `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`, [secondsLeft]);

  const buildStep = () => {
    setStep(copy.defaultStep);
    setThenText(copy.defaultStep);
    setSavedWin(false);
  };

  const saveWin = () => {
    const wins = safeLocalStorage.getJSON<Array<Record<string, unknown>>>("zoneflow-mind-mastery-ledger", []);
    safeLocalStorage.setJSON("zoneflow-mind-mastery-ledger", [
      { task, blocker, step: displayStep, mood, energy, load, completedAt: new Date().toISOString() },
      ...wins,
    ].slice(0, 50));
    setSavedWin(true);
    setRunning(false);
  };

  const reset = () => {
    setSecondsLeft(300);
    setRunning(false);
    setSavedWin(false);
  };

  const panel = isLight ? "border-indigo-100 bg-white" : "border-white/10 bg-white/5";
  const muted = isLight ? "text-slate-500" : "text-white/60";

  return (
    <Card className={cn("overflow-hidden border", panel)} dir={dir}>
      <CardContent className="p-0">
        <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-gradient-to-br from-[#0d6473] via-[#118a91] to-[#52c7b8] p-5 text-white md:p-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> {copy.eyebrow}
            </div>
            <h3 className="mt-3 text-2xl font-bold md:text-3xl">{copy.title}</h3>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/80">{copy.subtitle}</p>

            <div className="mt-5 rounded-3xl bg-white/12 p-4">
              <div className="text-sm font-semibold">{copy.pulse}</div>
              {[[copy.mood, mood, setMood], [copy.energy, energy, setEnergy], [copy.load, load, setLoad]].map(([label, value, setter]) => (
                <div key={String(label)} className="mt-4 grid grid-cols-[70px_1fr_24px] items-center gap-3 text-xs">
                  <span>{String(label)}</span>
                  <Slider value={[Number(value)]} min={1} max={5} step={1} onValueChange={([next]) => (setter as (value: number) => void)(next)} />
                  <span className="font-semibold">{Number(value)}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-white/65">{copy.evidence}</p>
          </div>

          <div className="space-y-5 p-5 md:p-7">
            <div>
              <label className="mb-2 block text-sm font-semibold">{copy.task}</label>
              <Input value={task} onChange={(event) => setTask(event.target.value)} placeholder={copy.taskPlaceholder} />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">{copy.blocker}</div>
              <div className="flex flex-wrap gap-2">
                {BLOCKERS.map((value) => (
                  <button key={value} type="button" onClick={() => setBlocker(value)} className={cn("rounded-full border px-3 py-2 text-xs transition", blocker === value ? "border-[#118a91] bg-[#e2f7f3] text-[#075e64]" : panel)}>
                    {copy.blockers[value]}
                  </button>
                ))}
              </div>
            </div>
            {!step ? (
              <Button onClick={buildStep} disabled={!task.trim()} className="w-full rounded-full bg-[#118a91] hover:bg-[#0d747a]">{copy.build}</Button>
            ) : (
              <div className={cn("space-y-4 rounded-3xl border p-4", panel)}>
                <div>
                  <div className="text-xs font-medium text-[#118a91]">{copy.step}</div>
                  <div className="mt-1 text-base font-semibold">{displayStep}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs"><span>{copy.confidence}</span><strong>{confidence}/10</strong></div>
                  <Slider className="mt-3" value={[confidence]} min={1} max={10} step={1} onValueChange={([value]) => setConfidence(value)} />
                  {confidence < 7 && <p className="mt-2 text-xs text-amber-600">{copy.shrink}</p>}
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold">{copy.ifThen}</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input value={ifText} onChange={(event) => setIfText(event.target.value)} placeholder={`${copy.ifLabel}: ${copy.ifPlaceholder}`} />
                    <Input value={thenText} onChange={(event) => setThenText(event.target.value)} placeholder={`${copy.thenLabel}: ${copy.thenPlaceholder}`} />
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /><span className="text-2xl font-bold tabular-nums">{timerLabel}</span></div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setRunning((value) => !value)} className="rounded-full bg-white text-slate-950 hover:bg-white/90">
                        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {running ? copy.pause : secondsLeft < 300 ? copy.resume : copy.start}
                      </Button>
                      <Button size="sm" variant="outline" onClick={reset} className="rounded-full border-white/25 bg-white/5 text-white hover:bg-white/10"><RotateCcw className="h-4 w-4" /> {copy.reset}</Button>
                    </div>
                  </div>
                  <Progress value={((300 - secondsLeft) / 300) * 100} className="mt-3 h-2" />
                </div>
                <Button onClick={saveWin} variant="outline" className="w-full rounded-full border-emerald-300 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {copy.completed}</Button>
                {savedWin && <p className={cn("text-center text-xs", muted)}>{copy.mastery}</p>}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
