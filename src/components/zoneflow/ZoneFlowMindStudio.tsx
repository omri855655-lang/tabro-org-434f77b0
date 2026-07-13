import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  BatteryMedium,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flame,
  HeartPulse,
  MapPin,
  Mic,
  RefreshCcw,
  Send,
  Sparkles,
  Wind,
  Star,
  Target,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { calculateBirthChart } from "@/lib/astrology";
import { useTabroAiHistory } from "@/hooks/useTabroAiHistory";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZoneFlowMindUnfreeze } from "./ZoneFlowMindUnfreeze";

type MindTab = "home" | "journeys" | "coach" | "progress" | "numbers" | "birthchart" | "stars";
type CoachIntensity = 1 | 2 | 3 | 4 | 5;
type MapProfile = { birthDate: string; birthTime: string; birthPlace: string; birthCountry: string; utcOffsetMinutes: number; keepMasterNumbers: boolean };

interface JourneyDay {
  day: number;
  title: string;
  body: string;
  prompt: string;
}

interface MindJourney {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  duration: number;
  minutes: number;
  questions: number;
  accent: string;
  accentSoft: string;
  icon: string;
  coachPrompt: string;
  days: JourneyDay[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MasteryWin {
  task?: string;
  step?: string;
  completedAt?: string;
}

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const DAILY_TIPS = [
  "המטרה שלך לא נעלמה. פשוט עצרת נשימה. קח אותה בחזרה.",
  "פעולה קטנה עכשיו עדיפה על תכנון מושלם שלא מתחיל.",
  "גם אם היום מבולגן, אפשר להציל ממנו בלוק אחד טוב.",
  "אם יש פחד, תן לו שם. כשהוא מקבל שם, הוא מאבד קצת כוח.",
  "לפעמים ההתקדמות היא לא מהירות אלא חזרה למסלול.",
  "משימה שמפחידה אותך לא חייבת להיעלם, רק להתחלק לחלק הראשון.",
  "כשאתה עייף, תבחר בגרסה עדינה יותר של ההצלחה.",
];

const NUMEROLOGY_MEANINGS: Record<number, { title: string; summary: string; action: string }> = {
  1: { title: "יוזם", summary: "אתה נועד להתחיל, להנהיג וליצור תנופה.", action: "בחר היום צעד ראשון אחד ואל תחכה לחשק." },
  2: { title: "רגיש ומחבר", summary: "הכוח שלך נמצא בשיתוף פעולה, רגש ודיוק בין אנשים.", action: "בדוק איזה שיתוף פעולה יוריד ממך עומס." },
  3: { title: "יוצר ומבטא", summary: "יש לך כוח דרך מילים, יצירה והבעה אישית.", action: "כתוב 5 שורות שמסדרות את הראש במקום להחזיק הכל בפנים." },
  4: { title: "בונה יציב", summary: "אתה מתקדם דרך מבנה, שגרה וקרקע בטוחה.", action: "ארגן למשימה מסגרת: שעה, מקום, והגדרה ברורה לסיום." },
  5: { title: "זז ומתחדש", summary: "אתה זקוק לחופש, גיוון ותנועה כדי להרגיש חי.", action: "שנה סביבה או קצב עבודה כדי להניע את עצמך." },
  6: { title: "מטפל ומאזן", summary: "יש בך אחריות, חמלה ודחף לסדר הרמוניה.", action: "שמור גבול אחד היום כדי לא להחזיק הכל לבד." },
  7: { title: "חוקר פנימי", summary: "אתה צריך שקט, עומק והבנה לפני פעולה גדולה.", action: "תן לעצמך 20 דקות בלי רעש, ואז חזור לבחור צעד." },
  8: { title: "מממש", summary: "יש לך כישרון להפוך חזון לתוצאה בעולם האמיתי.", action: "הגדר תוצאה מדידה אחת להיום במקום כוונה כללית." },
  9: { title: "רואה רחב", summary: "אתה מונע ממשמעות, תרומה וסגירת מעגלים.", action: "שאל את עצמך איזו משימה תשחרר הכי הרבה מקום בלב." },
  11: { title: "אינטואיציה גבוהה", summary: "אתה קולט דקויות מהר, אבל צריך לעגן אותן לקרקע.", action: "חבר בין אינטואיציה לפעולה אחת קטנה ומעשית." },
  22: { title: "בונה חזון", summary: "אתה יכול להחזיק רעיון גדול וגם לפרק אותו לביצוע.", action: "המר חלום גדול לשני אבני דרך פשוטות." },
  33: { title: "מנחה ומרפא", summary: "האנרגיה שלך מזמינה ריפוי, השראה והכוונה.", action: "בחר מסר אחד מרגיע שילווה אותך לאורך היום." },
};

const ZODIAC_SIGNS = [
  { id: "aries", name: "טלה", start: [3, 21], end: [4, 19], vibe: "אש יוזמת" },
  { id: "taurus", name: "שור", start: [4, 20], end: [5, 20], vibe: "קרקע יציבה" },
  { id: "gemini", name: "תאומים", start: [5, 21], end: [6, 20], vibe: "תנועה מחשבתית" },
  { id: "cancer", name: "סרטן", start: [6, 21], end: [7, 22], vibe: "רגש והגנה" },
  { id: "leo", name: "אריה", start: [7, 23], end: [8, 22], vibe: "נוכחות וביטוי" },
  { id: "virgo", name: "בתולה", start: [8, 23], end: [9, 22], vibe: "דיוק וריפוי" },
  { id: "libra", name: "מאזניים", start: [9, 23], end: [10, 22], vibe: "איזון וקשרים" },
  { id: "scorpio", name: "עקרב", start: [10, 23], end: [11, 21], vibe: "עומק ושינוי" },
  { id: "sagittarius", name: "קשת", start: [11, 22], end: [12, 21], vibe: "חזון וחופש" },
  { id: "capricorn", name: "גדי", start: [12, 22], end: [1, 19], vibe: "משמעת ובנייה" },
  { id: "aquarius", name: "דלי", start: [1, 20], end: [2, 18], vibe: "חדשנות ומבט עתידי" },
  { id: "pisces", name: "דגים", start: [2, 19], end: [3, 20], vibe: "דמיון ורגישות" },
] as const;

const HOROSCOPE_FOCUS = [
  "אל תרוץ לפתור הכל. בחר דבר אחד שיחזיר שליטה.",
  "היום מתאים לשיחה שמפוגגת ערפל ולא לעוד ניחושים.",
  "רוגע יחזור דרך מסגרת קטנה, לא דרך עומס יתר.",
  "אם יש התלבטות, בדוק איפה הגוף נרגע ואיפה הוא נסגר.",
  "היום מבקש ממך פחות הוכחה ויותר הקשבה פנימית.",
  "יש ערך בלסגור קצוות לפני פתיחת התחייבות חדשה.",
  "הפעולה הנכונה היום היא בדרך כלל הפשוטה יותר, לא הדרמטית.",
];

const HOROSCOPE_ACTIONS = [
  "קבע חלון של 25 דקות למשימה שמפחידה אותך.",
  "שלח הודעה אחת שהתחמקת ממנה.",
  "פנה 10 דקות לסדר פיזי כדי להקל על הראש.",
  "כתוב שלוש שורות: מה מלחיץ, מה בשליטתי, מה הצעד הראשון.",
  "צא להליכה קצרה לפני שאתה מכריע לגבי דבר חשוב.",
  "העבר משימה אחת מ'יום אחד' ל'מתי בדיוק'.",
  "שחרר משימה שלא באמת שייכת לך.",
];

const JOURNEYS: MindJourney[] = [
  {
    id: "task-paralysis",
    title: "להפשיר תקיעות מול משימות",
    subtitle: "מסלול עדין להתחלה מחדש בלי אלימות עצמית",
    summary: "כשיש עומס, מוח מוצף, או פחד להתחיל, אנחנו מחזירים תנועה דרך צעדים קטנים ובטוחים.",
    duration: 7,
    minutes: 9,
    questions: 3,
    accent: "from-[#2b1cff] via-[#4530ff] to-[#6d73ff]",
    accentSoft: "bg-[#eef0ff] text-[#3327d8]",
    icon: "🧊",
    coachPrompt: "אני קפוא מול משימה ולא מצליח להתחיל.",
    days: [
      { day: 1, title: "להקטין את החיכוך", body: "בחר משימה אחת שתקועה. אל תנסה לפתור אותה, רק לפרק אותה לצעד של 5 דקות.", prompt: "מהו הצעד הכי קטן שלא דורש ממך אומץ גדול?" },
      { day: 2, title: "להוציא מהראש", body: "כתוב למה אתה נמנע. עומס, פחד לטעות, חוסר ודאות, עייפות או התנגדות.", prompt: "מה באמת מפחיד אותך במשימה הזאת?" },
      { day: 3, title: "להתחיל בזמן מוגן", body: "פתח בלוק קצר של 15 דקות. מותר להפסיק בסוף, העיקר להתחיל בצורה בטוחה.", prompt: "איזה חלון זמן היום מרגיש הכי פחות מאיים?" },
      { day: 4, title: "לצמצם החלטות", body: "הכן מראש מסמך, טאבים, טלפון על שקט, וכל מה שמבלבל בתחילת עבודה.", prompt: "מה אפשר להכין מראש כדי שההתחלה תהיה כמעט אוטומטית?" },
      { day: 5, title: "להפריד בין ערך לביצוע", body: "המשימה לא מגדירה אותך. היא רק פעולה אחת בתוך יום אחד.", prompt: "איזה משפט היית רוצה לשמוע ממישהו שמאמין בך?" },
      { day: 6, title: "לייצר ניצחון נראה לעין", body: "סגור משהו קטן באמת. תגובה, תיוק, טיוטה, הודעה, או בדיקה אחת.", prompt: "מה אפשר לסיים היום כדי שהמוח ירגיש תזוזה?" },
      { day: 7, title: "לייצב שגרה", body: "בחר טקס פתיחה קבוע למשימות קשות: מים, נשימה, טיימר, מסך נקי, והתחלה.", prompt: "איזה טקס קצר אתה רוצה לאמץ מעכשיו?" },
    ],
  },
  {
    id: "money-stress",
    title: "להרגיע חרדה סביב כסף",
    subtitle: "להחליף ערפל כלכלי בשקיפות עדינה",
    summary: "הכסף מלחיץ בעיקר כשאין תמונה ברורה. כאן אנחנו בונים בהירות בלי להציף אותך.",
    duration: 7,
    minutes: 10,
    questions: 4,
    accent: "from-[#17335c] via-[#235fb0] to-[#2fc0ff]",
    accentSoft: "bg-[#e7f5ff] text-[#0d5eaa]",
    icon: "💸",
    coachPrompt: "אני לחוץ מכסף ומרגיש שאני דוחה התמודדות.",
    days: [
      { day: 1, title: "מבט נקי", body: "לא מנסים לפתור הכל, רק להסתכל. רשום שלוש הוצאות שמכבידות עליך כרגע.", prompt: "מה הדבר הכלכלי שהכי יושב עליך עכשיו?" },
      { day: 2, title: "להבדיל בין עובדה לפחד", body: "כתוב שתי עמודות: מה ידוע בוודאות, ומה רק תסריט שאתה מריץ בראש.", prompt: "איזו מחשבה נראית מאיימת אבל לא בטוח שהיא עובדה?" },
      { day: 3, title: "נקודת שליטה אחת", body: "בחר פעולה כלכלית פשוטה: לבדוק חיוב, לבטל מינוי, או לכתוב סכום יעד.", prompt: "איזו פעולה אחת תיתן לך תחושת שליטה?" },
      { day: 4, title: "להקטין בושה", body: "כסף הוא מיומנות ומערכת, לא הוכחה לערך העצמי שלך.", prompt: "על מה אתה שופט את עצמך כלכלית יותר מדי?" },
      { day: 5, title: "לסמן חיסכון ריאלי", body: "מצא דליפה אחת קטנה שאפשר לצמצם השבוע בלי לפגוע בחיים שלך.", prompt: "מה אפשר להוריד בלי להרגיש ענישה?" },
      { day: 6, title: "לתעדף שקט", body: "בחר הוצאה אחת שחשוב לך להבין לפני כל דבר אחר.", prompt: "איזו אי ודאות כספית הכי חשובה לבירור?" },
      { day: 7, title: "לסגור מעגל", body: "סכם מה למדת השבוע וכתוב מה הפעולה הבאה לחודש הקרוב.", prompt: "מה אתה רוצה לזכור בפעם הבאה שהלחץ חוזר?" },
    ],
  },
  {
    id: "people-pleasing",
    title: "פחות לרצות, יותר לנשום",
    subtitle: "להחזיר גבול בלי אשמה",
    summary: "אם קשה לך לאכזב, להגיד לא, או לבחור את עצמך, המסלול הזה יוצר מרחב בטוח יותר.",
    duration: 7,
    minutes: 8,
    questions: 3,
    accent: "from-[#6b2cff] via-[#9f55ff] to-[#ff7dcf]",
    accentSoft: "bg-[#f6ebff] text-[#8537db]",
    icon: "🫶",
    coachPrompt: "אני שם את כולם לפניי ואז נגמר לי הכוח.",
    days: [
      { day: 1, title: "לזהות את האוטומט", body: "שים לב מתי אתה אומר כן מהר מדי כדי להימנע מאי נוחות.", prompt: "איפה אמרת כן למרות שרצית לעצור?" },
      { day: 2, title: "לנשום לפני תגובה", body: "במקום לענות מיד, תן לעצמך משפט ביניים: 'אחזור אליך'.", prompt: "איזה משפט ביניים ישמור עליך?" },
      { day: 3, title: "להבדיל בין אכפתיות להצלה", body: "לא כל צורך של אחר הוא אחריות שלך.", prompt: "מה אתה לוקח על עצמך שלא באמת שייך לך?" },
      { day: 4, title: "אשמה היא לא בהכרח אמת", body: "הרגשת אשמה לא אומרת שעשית משהו לא טוב.", prompt: "מה אתה מפחד שיחשבו עליך אם תבחר בעצמך?" },
      { day: 5, title: "גבול קטן", body: "קבע גבול אחד זעיר: שעה, משך שיחה, משימה שאתה לא מקבל.", prompt: "איזה גבול קטן יקל עליך מיד?" },
      { day: 6, title: "בחירת האנרגיה", body: "שאל את עצמך מי ממלא אותך ומי שואב אותך.", prompt: "איפה אתה צריך פחות זמינות?" },
      { day: 7, title: "קול פנימי חדש", body: "החלף את 'אני חייב' ב'אני בוחר'.", prompt: "מה משתנה כשאתה עובר משפה של חובה לשפה של בחירה?" },
    ],
  },
  {
    id: "emotional-reconnect",
    title: "חיבור מחדש לרגש",
    subtitle: "כשיש ניתוק, עומס או קהות",
    summary: "לפעמים אי אפשר לעבוד כי אנחנו בכלל לא מרגישים את עצמנו. כאן חוזרים לאט לקרקע.",
    duration: 7,
    minutes: 12,
    questions: 4,
    accent: "from-[#31214e] via-[#6b55b8] to-[#9ac6ff]",
    accentSoft: "bg-[#eef1ff] text-[#5a4ab4]",
    icon: "🌙",
    coachPrompt: "אני מרגיש מנותק מעצמי ולא מצליח להבין מה קורה לי.",
    days: [
      { day: 1, title: "לבדוק את הגוף", body: "עצור ל-60 שניות ושאל איפה בגוף יש כיווץ, עייפות או חוסר שקט.", prompt: "איפה הגוף מדבר הכי חזק היום?" },
      { day: 2, title: "לתת שם למצב", body: "בחר שלוש מילים שמתקרבות למה שעובר עליך בלי לנסות לדייק מושלם.", prompt: "מה שלוש המילים של היום?" },
      { day: 3, title: "מותר לא לדעת", body: "לא חייבים מיד להבין הכול. מספיק להישאר לרגע עם מה שיש.", prompt: "מה קורה כשאתה מפסיק לדרוש מעצמך תשובה מיידית?" },
      { day: 4, title: "לעגן משהו נעים", body: "חפש דבר קטן שמחזיר נוכחות: אור, מים, הליכה, מוזיקה או כתיבה.", prompt: "מה מחזיר אותך לעצמך בדרך הכי עדינה?" },
      { day: 5, title: "לזהות צורך", body: "מתחת לרגש יש לרוב צורך: מנוחה, גבול, קרבה, בהירות, שקט.", prompt: "איזה צורך שלך לא קיבל מקום לאחרונה?" },
      { day: 6, title: "לבקש עזרה ברורה", body: "לא 'קשה לי', אלא מה בדיוק יעזור עכשיו.", prompt: "אם היית מבקש עזרה אחת ספציפית, מה היית מבקש?" },
      { day: 7, title: "לסמן עוגן להמשך", body: "בחר הרגל רך לימים עמוסים: 5 דקות כתיבה, נשימה, או בדיקת גוף.", prompt: "איזה עוגן אתה לוקח איתך הלאה?" },
    ],
  },
];

const LOCALES: Record<string, string> = {
  he: "he-IL",
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
  ar: "ar",
  ru: "ru-RU",
};

const MIND_UI = {
  he: { title: "מרחב מנטלי בתוך ZoneFlow", subtitle: "כלים עדינים לתקיעות, עומס רגשי והתחלה מחדש.", home: "בית", journeys: "מסלולים", coach: "AI מנטלי", progress: "התקדמות", numbers: "מפה נומרולוגית", stars: "השראה יומית", overall: "התקדמות כוללת", marked: "ימים מסומנים", focus: "פוקוס פעיל", days: "ימים", symbolic: "תוכן סמלי לרפלקציה ובידור בלבד; אינו מדעי, טיפולי או בסיס לקבלת החלטות.", support: "המאמן הוא כלי תמיכה ותכנון, לא מטפל ולא שירות חירום.", mapDetails: "פרטי מפה", birthDate: "תאריך לידה", city: "מקום מגורים (אופציונלי)", dailyInspiration: "השראה יומית", speechUnavailable: "זיהוי קולי לא זמין בדפדפן הזה", coachError: "לא הצלחתי לקבל תשובה מהמאמן כרגע" },
  en: { title: "A mental space inside ZoneFlow", subtitle: "Gentle tools for feeling stuck, emotional load, and starting again.", home: "Home", journeys: "Journeys", coach: "AI coach", progress: "Progress", numbers: "Numerology map", stars: "Daily inspiration", overall: "Overall progress", marked: "marked days", focus: "Active focus", days: "days", symbolic: "Symbolic content for reflection and entertainment only; it is not scientific, therapeutic, or a basis for decisions.", support: "The coach is a planning and self-support tool, not a therapist or emergency service.", mapDetails: "Map details", birthDate: "Birth date", city: "City (optional)", dailyInspiration: "Daily inspiration", speechUnavailable: "Voice recognition is not available in this browser", coachError: "The coach could not respond right now" },
  es: { title: "Un espacio mental dentro de ZoneFlow", subtitle: "Herramientas suaves para el bloqueo, la carga emocional y volver a empezar.", home: "Inicio", journeys: "Recorridos", coach: "Coach IA", progress: "Progreso", numbers: "Mapa numerologico", stars: "Inspiracion diaria", overall: "Progreso total", marked: "dias marcados", focus: "Enfoque activo", days: "dias", symbolic: "Contenido simbolico solo para reflexion y entretenimiento; no es cientifico ni terapeutico ni sirve para tomar decisiones.", support: "El coach es una herramienta de apoyo y planificacion, no un terapeuta ni un servicio de emergencia.", mapDetails: "Datos del mapa", birthDate: "Fecha de nacimiento", city: "Ciudad (opcional)", dailyInspiration: "Inspiracion diaria", speechUnavailable: "El reconocimiento de voz no esta disponible", coachError: "El coach no pudo responder ahora" },
  zh: { title: "ZoneFlow 心理空间", subtitle: "温和应对卡顿、情绪负担，并重新开始。", home: "首页", journeys: "旅程", coach: "AI教练", progress: "进度", numbers: "数字命理图", stars: "每日灵感", overall: "总体进度", marked: "已标记天数", focus: "当前重点", days: "天", symbolic: "象征性内容仅供反思和娱乐；不具有科学或治疗性质，也不应作为决策依据。", support: "AI教练是规划与自助工具，不是治疗师或紧急服务。", mapDetails: "资料", birthDate: "出生日期", city: "城市（可选）", dailyInspiration: "每日灵感", speechUnavailable: "此浏览器不支持语音识别", coachError: "教练暂时无法回复" },
  ar: { title: "مساحة ذهنية داخل ZoneFlow", subtitle: "أدوات لطيفة للتعطل والضغط العاطفي والبدء من جديد.", home: "الرئيسية", journeys: "المسارات", coach: "مدرب AI", progress: "التقدم", numbers: "خريطة الأرقام", stars: "إلهام يومي", overall: "التقدم العام", marked: "أيام محددة", focus: "التركيز الحالي", days: "أيام", symbolic: "محتوى رمزي للتأمل والترفيه فقط؛ ليس علميا أو علاجيا ولا أساسا للقرارات.", support: "المدرب أداة دعم وتخطيط وليس معالجا أو خدمة طوارئ.", mapDetails: "تفاصيل الخريطة", birthDate: "تاريخ الميلاد", city: "المدينة (اختياري)", dailyInspiration: "إلهام يومي", speechUnavailable: "التعرف الصوتي غير متاح في هذا المتصفح", coachError: "تعذر الحصول على رد من المدرب الآن" },
  ru: { title: "Ментальное пространство в ZoneFlow", subtitle: "Мягкие инструменты для ступора, эмоциональной нагрузки и нового старта.", home: "Главная", journeys: "Маршруты", coach: "AI-тренер", progress: "Прогресс", numbers: "Карта нумерологии", stars: "Вдохновение дня", overall: "Общий прогресс", marked: "отмечено дней", focus: "Активный фокус", days: "дней", symbolic: "Символический контент только для размышления и развлечения; он не является научным, лечебным или основой для решений.", support: "Тренер — инструмент поддержки и планирования, а не терапевт или экстренная служба.", mapDetails: "Данные карты", birthDate: "Дата рождения", city: "Город (необязательно)", dailyInspiration: "Вдохновение дня", speechUnavailable: "Распознавание речи недоступно", coachError: "Тренер временно не может ответить" },
} as const;

const CHECKIN_COPY = {
  he: { title: "בדיקת מצב קצרה", mood: "איך אתה מרגיש עכשיו?", anxiety: "רמת חרדה", energy: "רמת אנרגיה", need: "מה יעזור עכשיו?", calm: "להירגע", action: "צעד קטן", clarity: "בהירות", saved: "נשמר בהיסטוריה", save: "שמור בדיקה", safety: "אם יש סכנה מיידית או מחשבות לפגיעה, פנה עכשיו לאדם קרוב או לשירותי חירום. הכלי אינו טיפול." },
  en: { title: "Quick check-in", mood: "How do you feel now?", anxiety: "Anxiety level", energy: "Energy level", need: "What would help now?", calm: "Calm down", action: "Small action", clarity: "Clarity", saved: "Saved to history", save: "Save check-in", safety: "If there is immediate danger or thoughts of self-harm, contact a trusted person or emergency services. This is not treatment." },
  es: { title: "Registro breve", mood: "Como te sientes ahora?", anxiety: "Nivel de ansiedad", energy: "Nivel de energia", need: "Que ayudaria ahora?", calm: "Calmarme", action: "Un paso pequeno", clarity: "Claridad", saved: "Guardado en historial", save: "Guardar", safety: "Si hay peligro inmediato o ideas de hacerte dano, contacta a alguien de confianza o emergencias. Esto no es terapia." },
  zh: { title: "快速自检", mood: "你现在感觉如何？", anxiety: "焦虑程度", energy: "精力水平", need: "现在需要什么？", calm: "平静下来", action: "小行动", clarity: "清晰感", saved: "已保存到历史", save: "保存自检", safety: "如果有即时危险或自伤想法，请联系可信任的人或当地急救服务。本工具不是治疗。" },
  ar: { title: "تسجيل سريع", mood: "كيف تشعر الآن؟", anxiety: "مستوى القلق", energy: "مستوى الطاقة", need: "ما الذي سيساعدك الآن؟", calm: "الهدوء", action: "خطوة صغيرة", clarity: "وضوح", saved: "تم الحفظ في السجل", save: "حفظ", safety: "إذا كان هناك خطر فوري أو أفكار لإيذاء النفس، تواصل مع شخص موثوق أو الطوارئ. هذا ليس علاجا." },
  ru: { title: "Быстрая проверка", mood: "Что вы чувствуете сейчас?", anxiety: "Уровень тревоги", energy: "Уровень энергии", need: "Что поможет сейчас?", calm: "Успокоиться", action: "Маленький шаг", clarity: "Ясность", saved: "Сохранено в историю", save: "Сохранить", safety: "При непосредственной опасности или мыслях о самоповреждении свяжитесь с близким или экстренной службой. Это не лечение." },
} as const;

const MAP_COPY = {
  he: { birthTime: "שעת לידה (אופציונלי)", birthPlace: "מקום לידה", birthCountry: "מדינת לידה", method: "הצגת 11/22/33 כמספרי מאסטר", mode: "סגנון התוכן", reflection: "רפלקציה סמלית", science: "מדע והקשר", faith: "אמונה אישית", astrology: "שעה ומקום משמשים רק למפת לידה אסטרולוגית; נומרולוגיה מסתמכת על תאריך לידה.", questions: "מה תרצה לקבל? בחר נושא לשיחה עם ה־AI.", topic: "נושא להתבוננות", chartTitle: "מפת לידה אסטרולוגית", engineNote: "מפה מלאה של כוכבי לכת, אופק ובתים דורשת מנוע אפמריס אמיתי. עד אז נציג רק נתונים מחושבים בבירור ולא נמציא מיקומים.", aiPrompt: "עזור לי להתבונן במפת הלידה שלי באופן סמלי ולתרגם אותה לצעד מעשי, בלי להציג אותה כחיזוי.", aiButton: "התייעץ עם AI על המפה", notReady: "הזן תאריך לידה כדי להתחיל", notReadyHint: "שעת לידה ומקום לידה יאפשרו בעתיד חישוב מדויק יותר של המפה.", sunSign: "מזל שמש", disclaimer: "זהו תוכן סמלי ורפלקטיבי בלבד, לא מדע ולא תחזית. אין להשתמש בו במקום ייעוץ מקצועי.", saveMap: "שמור ועדכן מפה", mapSaved: "המפה עודכנה לפי הפרטים ששמרת" },
  en: { birthTime: "Birth time (optional)", birthPlace: "Birth place", birthCountry: "Birth country", method: "Keep 11/22/33 as master numbers", mode: "Content style", reflection: "Symbolic reflection", science: "Science and context", faith: "Personal belief", astrology: "Time and birthplace are only for a birth-chart reading; numerology uses the birth date.", questions: "What would you like to explore with AI?", topic: "Reflection topic", chartTitle: "Astrological birth chart", engineNote: "A full chart with planets, ascendant, and houses requires a real ephemeris engine. Until then, we show only clearly calculated data and never invent placements.", aiPrompt: "Help me reflect on my birth chart symbolically and turn it into a practical step, without presenting it as prediction.", aiButton: "Discuss the chart with AI", notReady: "Enter a birth date to begin", notReadyHint: "Birth time and place will enable a more precise chart calculation later.", sunSign: "Sun sign", disclaimer: "This is symbolic and reflective content, not science or prediction. Do not use it instead of professional advice.", saveMap: "Save and update chart", mapSaved: "The chart was updated with your saved details" },
  es: { birthTime: "Hora de nacimiento (opcional)", birthPlace: "Lugar de nacimiento", birthCountry: "Pais de nacimiento", method: "Mantener 11/22/33 como maestros", mode: "Estilo", reflection: "Reflexion simbolica", science: "Ciencia y contexto", faith: "Creencia personal", astrology: "La hora y el lugar solo sirven para una carta natal; la numerologia usa la fecha.", questions: "Que quieres explorar con la IA?", topic: "Tema de reflexion", chartTitle: "Carta natal astrologica", engineNote: "Una carta completa con planetas, ascendente y casas requiere un motor de efemerides real. No inventaremos posiciones.", aiPrompt: "Ayudame a reflexionar sobre mi carta natal de forma simbolica y convertirla en un paso practico, sin presentarla como prediccion.", aiButton: "Consultar la carta con IA", notReady: "Introduce una fecha de nacimiento", notReadyHint: "La hora y el lugar permitiran un calculo mas preciso mas adelante.", sunSign: "Signo solar", disclaimer: "Contenido simbolico y reflexivo, no ciencia ni prediccion. No sustituye consejo profesional.", saveMap: "Guardar y actualizar", mapSaved: "La carta se actualizo con tus datos guardados" },
  zh: { birthTime: "出生时间（可选）", birthPlace: "出生地", birthCountry: "出生国家", method: "保留11/22/33大师数", mode: "内容风格", reflection: "象征性反思", science: "科学与背景", faith: "个人信念", astrology: "时间和出生地只用于星盘；数字命理使用出生日期。", questions: "你想和AI探索什么？", topic: "反思主题", chartTitle: "占星出生星盘", engineNote: "完整星盘需要真实的星历引擎来计算行星、上升点和宫位。我们不会编造位置。", aiPrompt: "请帮助我以象征方式反思出生星盘，并转化为实际行动，不要把它说成预测。", aiButton: "与AI讨论星盘", notReady: "输入出生日期开始", notReadyHint: "出生时间和地点将帮助之后进行更精确的计算。", sunSign: "太阳星座", disclaimer: "这是象征性反思内容，不是科学或预测，也不能替代专业建议。", saveMap: "保存并更新星盘", mapSaved: "已按保存的信息更新星盘" },
  ar: { birthTime: "وقت الميلاد (اختياري)", birthPlace: "مكان الميلاد", birthCountry: "دولة الميلاد", method: "إبقاء 11/22/33 كأرقام رئيسية", mode: "أسلوب المحتوى", reflection: "تأمل رمزي", science: "علم وسياق", faith: "معتقد شخصي", astrology: "الوقت ومكان الميلاد يستخدمان لخريطة الميلاد فقط؛ علم الأرقام يستخدم التاريخ.", questions: "ما الذي تريد استكشافه مع AI؟", topic: "موضوع التأمل", chartTitle: "خريطة الميلاد الفلكية", engineNote: "الخريطة الكاملة للكواكب والطالع والبيوت تحتاج إلى محرك فلكي حقيقي. لن نخترع مواقع.", aiPrompt: "ساعدني على التأمل في خريطة ميلادي بشكل رمزي وتحويلها إلى خطوة عملية دون تقديمها كتنبؤ.", aiButton: "استشر AI حول الخريطة", notReady: "أدخل تاريخ الميلاد للبدء", notReadyHint: "سيساعد وقت ومكان الميلاد على حساب أدق لاحقا.", sunSign: "برج الشمس", disclaimer: "هذا محتوى رمزي وتأملي وليس علما أو تنبؤا ولا يغني عن المشورة المهنية.", saveMap: "حفظ وتحديث الخريطة", mapSaved: "تم تحديث الخريطة بالبيانات المحفوظة" },
  ru: { birthTime: "Время рождения (необязательно)", birthPlace: "Место рождения", birthCountry: "Страна рождения", method: "Сохранять 11/22/33 как мастер-числа", mode: "Стиль контента", reflection: "Символическая рефлексия", science: "Наука и контекст", faith: "Личная вера", astrology: "Время и место нужны только для натальной карты; нумерология использует дату.", questions: "Что вы хотите исследовать с AI?", topic: "Тема рефлексии", chartTitle: "Астрологическая натальная карта", engineNote: "Полная карта с планетами, асцендентом и домами требует настоящего эфемеридного движка. Мы не будем выдумывать положения.", aiPrompt: "Помоги мне символически осмыслить натальную карту и превратить ее в практический шаг, не выдавая это за прогноз.", aiButton: "Обсудить карту с AI", notReady: "Введите дату рождения", notReadyHint: "Время и место рождения позже позволят рассчитать карту точнее.", sunSign: "Солнечный знак", disclaimer: "Это символический и рефлексивный контент, не наука и не прогноз. Он не заменяет профессиональную помощь.", saveMap: "Сохранить и обновить карту", mapSaved: "Карта обновлена по сохраненным данным" },
} as const;
const BIRTH_CHART_LABEL = { he: "מפת לידה", en: "Birth chart", es: "Carta natal", zh: "星盘", ar: "خريطة الميلاد", ru: "Натальная карта" } as const;
const CHART_ENGINE_COPY: Record<string, {
  utcOffset: string;
  utcHint: string;
  calculated: string;
  positions: string;
  aspects: string;
  noAspects: string;
  timeEstimated: string;
  locationPending: string;
}> = {
  he: { utcOffset: "הפרש UTC בזמן הלידה (בדקות)", utcHint: "לדוגמה: ישראל בקיץ היא בדרך כלל 180, ובחורף 120. בדוק לפי שנת הלידה.", calculated: "מחושב מקומית על המכשיר", positions: "מיקומי כוכבי הלכת", aspects: "היבטים מרכזיים", noAspects: "לא נמצאו היבטים מרכזיים בטווח שנבחר.", timeEstimated: "לא הוזנה שעת לידה, ולכן החישוב משתמש ב־12:00 כהערכה. מיקומי הירח וההיבטים עשויים להשתנות.", locationPending: "מקום הלידה נשמר. אופק ובתים יתווספו לאחר חיבור המרה בטוחה של מקום לקואורדינטות.", },
  en: { utcOffset: "UTC offset at birth (minutes)", utcHint: "For example: Israel is usually 180 in summer and 120 in winter. Check the birth year.", calculated: "Calculated locally on this device", positions: "Planetary positions", aspects: "Key aspects", noAspects: "No major aspects were found in the selected orb.", timeEstimated: "No birth time was entered, so noon is used as an estimate. Moon placement and aspects can change.", locationPending: "Birthplace is saved. Ascendant and houses will require a safe place-to-coordinates step.", },
  es: { utcOffset: "Diferencia UTC al nacer (minutos)", utcHint: "Ejemplo: Israel suele ser 180 en verano y 120 en invierno. Comprueba el ano de nacimiento.", calculated: "Calculado localmente en este dispositivo", positions: "Posiciones planetarias", aspects: "Aspectos principales", noAspects: "No se encontraron aspectos principales en el orbe seleccionado.", timeEstimated: "No se indico hora de nacimiento; se usa el mediodia como estimacion. La Luna y los aspectos pueden variar.", locationPending: "El lugar de nacimiento esta guardado. Ascendente y casas requeriran convertir el lugar a coordenadas.", },
  zh: { utcOffset: "出生时 UTC 偏移（分钟）", utcHint: "例如：以色列夏季通常为 180，冬季为 120。请按出生年份核对。", calculated: "在此设备本地计算", positions: "行星位置", aspects: "主要相位", noAspects: "所选容许度内没有主要相位。", timeEstimated: "未填写出生时间，因此以中午作为估算。月亮位置和相位可能变化。", locationPending: "出生地已保存。上升点与宫位仍需要安全地将地点转换为坐标。", },
  ar: { utcOffset: "فرق UTC وقت الميلاد (بالدقائق)", utcHint: "مثال: إسرائيل عادة 180 صيفا و120 شتاء. تحقق من سنة الميلاد.", calculated: "محسوب محليا على هذا الجهاز", positions: "مواقع الكواكب", aspects: "الجوانب الرئيسية", noAspects: "لم يتم العثور على جوانب رئيسية ضمن الهامش المحدد.", timeEstimated: "لم يتم إدخال وقت الميلاد، لذلك يستخدم الظهر كتقدير. قد يتغير موضع القمر والجوانب.", locationPending: "تم حفظ مكان الميلاد. يحتاج الطالع والبيوت إلى تحويل آمن للمكان إلى إحداثيات.", },
  ru: { utcOffset: "Смещение UTC при рождении (минуты)", utcHint: "Например: в Израиле обычно 180 летом и 120 зимой. Проверьте год рождения.", calculated: "Рассчитано локально на этом устройстве", positions: "Положения планет", aspects: "Основные аспекты", noAspects: "В выбранном орбисе не найдено основных аспектов.", timeEstimated: "Время рождения не указано, поэтому используется полдень как оценка. Положение Луны и аспекты могут меняться.", locationPending: "Место рождения сохранено. Для асцендента и домов потребуется безопасно преобразовать место в координаты.", },
};
const CHART_PLANET_LABELS: Record<string, string> = { sun: "שמש", moon: "ירח", mercury: "מרקורי", venus: "ונוס", mars: "מאדים", jupiter: "צדק", saturn: "שבתאי", uranus: "אורנוס", neptune: "נפטון", pluto: "פלוטו" };
const CHART_SIGN_LABELS: Record<string, string> = { Aries: "טלה", Taurus: "שור", Gemini: "תאומים", Cancer: "סרטן", Leo: "אריה", Virgo: "בתולה", Libra: "מאזניים", Scorpio: "עקרב", Sagittarius: "קשת", Capricorn: "גדי", Aquarius: "דלי", Pisces: "דגים" };
const CHART_ASPECT_LABELS: Record<string, string> = { Conjunction: "צמידות", Sextile: "סקסטיל", Square: "ריבוע", Trine: "משולש", Opposition: "מולות" };

const CRISIS_COPY: Record<string, string> = {
  he: "אני מצטער שאתה עובר את זה. אני לא שירות חירום ולא רוצה שתישאר עם זה לבד. אם יש סכנה מיידית, התקשר עכשיו ל-100 או 101 בישראל, או למספר החירום המקומי. אפשר גם לפנות לער\"ן 1201 ולשתף אדם קרוב שנמצא לידך.",
  en: "I am sorry you are going through this. I am not an emergency service, and you should not face this alone. If there is immediate danger, call your local emergency number now and contact a trusted person who can stay with you.",
  es: "Siento que estes pasando por esto. No soy un servicio de emergencia y no deberias afrontarlo a solas. Si hay peligro inmediato, llama ahora al numero local de emergencias y contacta a una persona de confianza.",
  zh: "很抱歉你正在经历这些。我不是紧急服务，你不必独自面对。如果有立即危险，请马上拨打当地急救电话，并联系一位可以陪伴你的可信任的人。",
  ar: "أنا آسف لأنك تمر بهذا. لست خدمة طوارئ ولا ينبغي أن تواجه هذا وحدك. إذا كان هناك خطر فوري فاتصل الآن برقم الطوارئ المحلي وتواصل مع شخص موثوق يمكنه البقاء معك.",
  ru: "Мне жаль, что вы через это проходите. Я не экстренная служба, и вам не нужно оставаться с этим одному. При непосредственной опасности позвоните в местную экстренную службу и свяжитесь с близким человеком.",
};

const CRISIS_PATTERN = /suicid|kill myself|hurt myself|self[- ]?harm|no quiero vivir|hacerme dano|убить себя|самоубий|انتحار|أؤذي نفسي|自杀|伤害自己|להתאבד|לפגוע בעצמי|לא רוצה לחיות/i;

const getDateStrip = (locale: string) => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const offset = index - 6;
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return {
      key: date.toISOString().slice(0, 10),
      date,
      offset,
      dayNumber: date.getDate(),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date),
    };
  });
};

const reduceNumber = (value: number): number => {
  if ([11, 22, 33].includes(value)) return value;
  let current = value;
  while (current > 9) {
    current = String(current)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
    if ([11, 22, 33].includes(current)) return current;
  }
  return current;
};

const collapseMasterNumber = (value: number, keepMasterNumbers: boolean) => {
  if (keepMasterNumbers || ![11, 22, 33].includes(value)) return value;
  return String(value).split("").reduce((sum, digit) => sum + Number(digit), 0);
};

const getLifePathNumber = (birthDate: string) => {
  const digits = birthDate.replaceAll("-", "").split("").map(Number);
  return reduceNumber(digits.reduce((sum, digit) => sum + digit, 0));
};

const getBirthParts = (birthDate: string) => {
  const [year, month, day] = birthDate.split("-").map(Number);
  return { year, month, day };
};

const getAttitudeNumber = (birthDate: string) => {
  const { month, day } = getBirthParts(birthDate);
  return reduceNumber(month + day);
};

const getPersonalYearNumber = (birthDate: string, currentDate: Date) => {
  const { month, day } = getBirthParts(birthDate);
  const yearDigits = String(currentDate.getFullYear()).split("").map(Number);
  return reduceNumber(day + month + yearDigits.reduce((sum, digit) => sum + digit, 0));
};

const getPersonalMonthNumber = (personalYear: number, currentDate: Date) => {
  return reduceNumber(personalYear + currentDate.getMonth() + 1);
};

const getPersonalDayNumber = (personalMonth: number, currentDate: Date) => {
  return reduceNumber(personalMonth + currentDate.getDate());
};

const getZodiacSign = (birthDate: string) => {
  const { month, day } = getBirthParts(birthDate);

  const found = ZODIAC_SIGNS.find((sign) => {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;

    if (startMonth <= endMonth) {
      return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay) || (month > startMonth && month < endMonth);
    }

    return (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      month > startMonth ||
      month < endMonth
    );
  });

  return found ?? ZODIAC_SIGNS[0];
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

interface ZoneFlowMindStudioProps {
  isLight: boolean;
}

export function ZoneFlowMindStudio({ isLight }: ZoneFlowMindStudioProps) {
  const { lang, dir } = useLanguage();
  const ui = MIND_UI[lang] ?? MIND_UI.en;
  const checkinUi = CHECKIN_COPY[lang] ?? CHECKIN_COPY.en;
  const mapUi = MAP_COPY[lang] ?? MAP_COPY.en;
  const [activeTab, setActiveTab] = useState<MindTab>(() => {
    const saved = safeLocalStorage.getString("zoneflow-mind-tab", "home");
    return ["home", "journeys", "coach", "progress", "numbers", "birthchart", "stars"].includes(saved || "") ? (saved as MindTab) : "home";
  });
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [selectedJourneyId, setSelectedJourneyId] = useState(() => {
    return safeLocalStorage.getString("zoneflow-mind-selected-journey", JOURNEYS[0].id) || JOURNEYS[0].id;
  });
  const [completedDays, setCompletedDays] = useState<string[]>(() => safeLocalStorage.getJSON("zoneflow-mind-completed-days", []));
  const [journalEntries, setJournalEntries] = useState<Record<string, string>>(() => safeLocalStorage.getJSON("zoneflow-mind-journal", {}));
  const [birthDate, setBirthDate] = useState(() => safeLocalStorage.getString("zoneflow-mind-birthdate", "") || "");
  const [birthCity, setBirthCity] = useState(() => safeLocalStorage.getString("zoneflow-mind-birthcity", "") || "");
  const [birthTime, setBirthTime] = useState(() => safeLocalStorage.getString("zoneflow-mind-birthtime", "") || "");
  const [birthPlace, setBirthPlace] = useState(() => safeLocalStorage.getString("zoneflow-mind-birthplace", "") || "");
  const [birthCountry, setBirthCountry] = useState(() => safeLocalStorage.getString("zoneflow-mind-birthcountry", "") || "");
  const [birthUtcOffsetMinutes, setBirthUtcOffsetMinutes] = useState(() => safeLocalStorage.getJSON("zoneflow-mind-birth-utc-offset", 180));
  const [keepMasterNumbers, setKeepMasterNumbers] = useState(() => safeLocalStorage.getJSON("zoneflow-mind-master-numbers", true));
  const [appliedMapProfile, setAppliedMapProfile] = useState<MapProfile>(() => safeLocalStorage.getJSON("zoneflow-mind-applied-map-profile", {
    birthDate: safeLocalStorage.getString("zoneflow-mind-birthdate", "") || "",
    birthTime: safeLocalStorage.getString("zoneflow-mind-birthtime", "") || "",
    birthPlace: safeLocalStorage.getString("zoneflow-mind-birthplace", "") || "",
    birthCountry: safeLocalStorage.getString("zoneflow-mind-birthcountry", "") || "",
    utcOffsetMinutes: safeLocalStorage.getJSON("zoneflow-mind-birth-utc-offset", 180),
    keepMasterNumbers: safeLocalStorage.getJSON("zoneflow-mind-master-numbers", true),
  }));
  const [contentMode, setContentMode] = useState<"reflection" | "science" | "faith">(() => (safeLocalStorage.getString("zoneflow-mind-content-mode", "reflection") as "reflection" | "science" | "faith") || "reflection");
  const [reflectionTopic, setReflectionTopic] = useState("");
  const [checkinAnxiety, setCheckinAnxiety] = useState(0);
  const [checkinEnergy, setCheckinEnergy] = useState(5);
  const [checkinNeed, setCheckinNeed] = useState<"calm" | "action" | "clarity">("action");
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [horoscopeOffset, setHoroscopeOffset] = useState(0);
  const [horoscopeNotes, setHoroscopeNotes] = useState<Record<string, string>>(() => safeLocalStorage.getJSON("zoneflow-mind-horoscope-notes", {}));
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachIntensity, setCoachIntensity] = useState<CoachIntensity>(3);
  const [isListening, setIsListening] = useState(false);
  const [masteryWins, setMasteryWins] = useState<MasteryWin[]>(() => safeLocalStorage.getJSON("zoneflow-mind-mastery-ledger", []));
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const coachScrollRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    setMessages,
    conversationHistory,
    clearAndArchive,
    loadConversation,
  } = useTabroAiHistory("zoneflow-mind-ai");

  useEffect(() => {
    safeLocalStorage.setString("zoneflow-mind-tab", activeTab);
    if (activeTab === "progress") {
      setMasteryWins(safeLocalStorage.getJSON("zoneflow-mind-mastery-ledger", []));
    }
  }, [activeTab]);

  useEffect(() => {
    safeLocalStorage.setString("zoneflow-mind-selected-journey", selectedJourneyId);
  }, [selectedJourneyId]);

  useEffect(() => {
    safeLocalStorage.setJSON("zoneflow-mind-completed-days", completedDays);
  }, [completedDays]);

  useEffect(() => {
    safeLocalStorage.setJSON("zoneflow-mind-journal", journalEntries);
  }, [journalEntries]);

  useEffect(() => {
    safeLocalStorage.setString("zoneflow-mind-birthdate", birthDate);
  }, [birthDate]);

  useEffect(() => {
    safeLocalStorage.setString("zoneflow-mind-birthcity", birthCity);
  }, [birthCity]);

  useEffect(() => safeLocalStorage.setString("zoneflow-mind-birthtime", birthTime), [birthTime]);
  useEffect(() => safeLocalStorage.setString("zoneflow-mind-birthplace", birthPlace), [birthPlace]);
  useEffect(() => safeLocalStorage.setString("zoneflow-mind-birthcountry", birthCountry), [birthCountry]);
  useEffect(() => safeLocalStorage.setJSON("zoneflow-mind-birth-utc-offset", birthUtcOffsetMinutes), [birthUtcOffsetMinutes]);
  useEffect(() => safeLocalStorage.setJSON("zoneflow-mind-master-numbers", keepMasterNumbers), [keepMasterNumbers]);
  useEffect(() => safeLocalStorage.setString("zoneflow-mind-content-mode", contentMode), [contentMode]);
  useEffect(() => safeLocalStorage.setJSON("zoneflow-mind-horoscope-notes", horoscopeNotes), [horoscopeNotes]);

  useEffect(() => {
    if (coachScrollRef.current) {
      coachScrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, coachLoading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stripDays = useMemo(() => getDateStrip(LOCALES[lang] || "en-US"), [lang]);
  const selectedJourney = useMemo(
    () => JOURNEYS.find((journey) => journey.id === selectedJourneyId) ?? JOURNEYS[0],
    [selectedJourneyId],
  );

  const completedCount = useMemo(() => {
    return completedDays.filter((key) => key.startsWith(`${selectedJourney.id}:`)).length;
  }, [completedDays, selectedJourney.id]);

  const totalCompletedCount = completedDays.length;
  const selectedProgress = Math.round((completedCount / selectedJourney.duration) * 100);
  const totalJourneyDays = JOURNEYS.reduce((sum, journey) => sum + journey.duration, 0);
  const totalProgress = Math.min(100, Math.round((totalCompletedCount / totalJourneyDays) * 100));

  const selectedCalendarDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + selectedOffset);
    return date;
  }, [selectedOffset]);
  const dailyTip = DAILY_TIPS[selectedCalendarDate.getDate() % DAILY_TIPS.length];

  const achievements = useMemo(() => {
    return [
      { id: "first-step", title: "ניצחון ראשון", description: "השלמת יום ראשון", unlocked: totalCompletedCount >= 1 },
      { id: "motion", title: "יוצא מתקיעות", description: "3 ימים של תנועה", unlocked: totalCompletedCount >= 3 },
      { id: "week", title: "שבוע של עקביות", description: "7 ימים הושלמו", unlocked: totalCompletedCount >= 7 },
      { id: "builder", title: "בונה מערכת", description: "14 ימים הושלמו", unlocked: totalCompletedCount >= 14 },
    ];
  }, [totalCompletedCount]);

  const numerology = useMemo(() => {
    if (!appliedMapProfile.birthDate) return null;
    const now = new Date();
    const lifePath = collapseMasterNumber(getLifePathNumber(appliedMapProfile.birthDate), appliedMapProfile.keepMasterNumbers);
    const attitude = collapseMasterNumber(getAttitudeNumber(appliedMapProfile.birthDate), appliedMapProfile.keepMasterNumbers);
    const personalYear = collapseMasterNumber(getPersonalYearNumber(appliedMapProfile.birthDate, now), appliedMapProfile.keepMasterNumbers);
    const personalMonth = collapseMasterNumber(getPersonalMonthNumber(personalYear, now), appliedMapProfile.keepMasterNumbers);
    const personalDay = collapseMasterNumber(getPersonalDayNumber(personalMonth, now), appliedMapProfile.keepMasterNumbers);

    return { lifePath, attitude, personalYear, personalMonth, personalDay };
  }, [appliedMapProfile]);

  const zodiac = useMemo(() => {
    if (!appliedMapProfile.birthDate) return null;
    return getZodiacSign(appliedMapProfile.birthDate);
  }, [appliedMapProfile.birthDate]);

  const calculatedBirthChart = useMemo(() => calculateBirthChart({
    birthDate: appliedMapProfile.birthDate,
    birthTime: appliedMapProfile.birthTime,
    utcOffsetMinutes: Number.isFinite(appliedMapProfile.utcOffsetMinutes) ? appliedMapProfile.utcOffsetMinutes : 180,
  }), [appliedMapProfile]);
  const chartCopy = CHART_ENGINE_COPY[lang] ?? CHART_ENGINE_COPY.en;

  const horoscope = useMemo(() => {
    if (!zodiac) return null;
    const date = new Date();
    date.setDate(date.getDate() + horoscopeOffset);
    const dateKey = new Intl.DateTimeFormat("en-CA").format(date);
    const seed = hashString(`${zodiac.id}:${dateKey}`);
    return {
      date,
      focus: HOROSCOPE_FOCUS[seed % HOROSCOPE_FOCUS.length],
      action: HOROSCOPE_ACTIONS[seed % HOROSCOPE_ACTIONS.length],
      mood: [
        "יש רגישות גבוהה למה שמכביד עליך באמת.",
        "היום מתאים לדיוק, פחות לפיזור.",
        "יש סיכוי לפריצת דרך אם תבחר בבהירות ולא בדחיינות.",
        "זה יום טוב לרכך שיפוט עצמי ולחזור לקצב נכון.",
      ][seed % 4],
    };
  }, [horoscopeOffset, zodiac]);

  const horoscopeDateKey = useMemo(() => horoscope ? new Intl.DateTimeFormat("en-CA").format(horoscope.date) : "", [horoscope]);
  const birthChartDataQuality = !appliedMapProfile.birthDate
    ? "אין עדיין תאריך לידה שמור"
    : !appliedMapProfile.birthTime
      ? chartCopy.timeEstimated
      : !appliedMapProfile.birthPlace || !appliedMapProfile.birthCountry
        ? "מיקומי הכוכבים מחושבים לפי הזמן ששמרת. להוספת אופק ובתים נדרש גם מקום לידה מלא."
        : chartCopy.locationPending;

  const saveMapProfile = () => {
    const nextProfile: MapProfile = { birthDate, birthTime, birthPlace, birthCountry, utcOffsetMinutes: birthUtcOffsetMinutes, keepMasterNumbers };
    setAppliedMapProfile(nextProfile);
    safeLocalStorage.setJSON("zoneflow-mind-applied-map-profile", nextProfile);
    toast.success(mapUi.mapSaved);
  };

  const toggleDayCompletion = (day: number) => {
    const key = `${selectedJourney.id}:${day}`;
    setCompletedDays((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const saveCheckin = () => {
    const history = safeLocalStorage.getJSON<Array<{ date: string; anxiety: number; energy: number; need: string }>>("zoneflow-mind-checkins", []);
    safeLocalStorage.setJSON("zoneflow-mind-checkins", [...history, { date: new Date().toISOString(), anxiety: checkinAnxiety, energy: checkinEnergy, need: checkinNeed }].slice(-30));
    setCheckinSaved(true);
  };

  const updateJournal = (day: number, value: string) => {
    setJournalEntries((prev) => ({ ...prev, [`${selectedJourney.id}:${day}`]: value }));
  };

  const resetJourney = () => {
    setCompletedDays((prev) => prev.filter((item) => !item.startsWith(`${selectedJourney.id}:`)));
    setJournalEntries((prev) => {
      const next = { ...prev };
      selectedJourney.days.forEach((day) => {
        delete next[`${selectedJourney.id}:${day.day}`];
      });
      return next;
    });
  };

  const sendCoachMessage = async (prefill?: string) => {
    const text = (prefill ?? coachInput).trim();
    if (!text || coachLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setCoachInput("");

    if (CRISIS_PATTERN.test(text)) {
      setMessages([...nextMessages, { role: "assistant", content: CRISIS_COPY[lang] || CRISIS_COPY.en }]);
      return;
    }

    setCoachLoading(true);

    const context = [
      `עוצמת הקושי כרגע: ${coachIntensity} מתוך 5`,
      `נושא מיקוד: ${selectedJourney.title}`,
      `Response language: ${LOCALES[lang] || "en-US"}`,
      `בקשה: ${text}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: context,
          taskCategory: "mental_coaching",
          conversationHistory: nextMessages,
        },
      });

      if (error) throw error;

      const reply = data?.suggestion || data?.reply || "אני כאן איתך. בוא נבחר צעד ראשון עדין.";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error("ZoneFlow mind AI error:", error);
      toast.error(ui.coachError);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "אני כאן איתך. כרגע הייתה בעיית חיבור, אבל אפשר כבר עכשיו לבחור צעד ראשון קטן של 5 דקות ולחזור לנסות.",
        },
      ]);
    } finally {
      setCoachLoading(false);
    }
  };

  const startVoiceCapture = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error(ui.speechUnavailable);
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = LOCALES[lang] || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setCoachInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const shellCard = isLight
    ? "border-[#dfe5ff] bg-white/95 shadow-[0_20px_70px_rgba(69,48,255,0.08)]"
    : "border-white/10 bg-[#10172d]/85 shadow-[0_20px_70px_rgba(9,12,31,0.45)]";

  const softPanel = isLight ? "bg-[#f3f4ff] border-[#dfe5ff]" : "bg-white/5 border-white/10";
  const subtleText = isLight ? "text-slate-500" : "text-slate-300/70";
  const titleText = isLight ? "text-slate-900" : "text-white";
  const inputClass = isLight
    ? "border-[#d7dcff] bg-white text-slate-900 placeholder:text-slate-400"
    : "border-white/10 bg-white/5 text-white placeholder:text-white/35";

  return (
    <div className="min-h-0 space-y-4" dir={dir}>
      <Card className={cn("overflow-hidden border", shellCard)}>
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-[#1f1acb] via-[#3f33ff] to-[#8f95ff] px-5 py-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  ZoneFlow Mind
                </div>
                <h2 className="text-2xl font-bold">{ui.title}</h2>
                <p className="max-w-3xl text-sm text-white/80">
                  {ui.subtitle}
                </p>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/12 p-3">
                  <div className="text-xs text-white/70">{ui.overall}</div>
                  <div className="mt-1 text-2xl font-bold">{totalCompletedCount}</div>
                  <div className="text-xs text-white/70">{ui.marked}</div>
                </div>
                <div className="rounded-2xl bg-white/12 p-3">
                  <div className="text-xs text-white/70">{ui.focus}</div>
                  <div className="mt-1 text-sm font-semibold">{selectedJourney.title}</div>
                  <div className="text-xs text-white/70">{selectedJourney.duration} {ui.days}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {stripDays.map((item) => {
                const isSelected = item.offset === selectedOffset;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedOffset(item.offset)}
                    aria-pressed={isSelected}
                    className={cn(
                      "min-w-[84px] rounded-2xl border px-3 py-3 text-center transition-all",
                      isSelected ? "border-white/30 bg-white text-[#2b1cff]" : "border-white/15 bg-white/10 text-white",
                    )}
                  >
                    <div className="text-xs opacity-80">{item.weekday}</div>
                    <div className="mt-1 text-2xl font-bold">{item.dayNumber}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MindTab)}>
        <TabsList className={cn("flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl p-1 sm:grid sm:grid-cols-7", isLight ? "bg-[#ecefff]" : "bg-white/5")}>
          <TabsTrigger className="min-w-max flex-1" value="home">{ui.home}</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="journeys">{ui.journeys}</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="coach">{ui.coach}</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="progress">{ui.progress}</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="numbers">{ui.numbers}</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="birthchart">{BIRTH_CHART_LABEL[lang] ?? BIRTH_CHART_LABEL.en}</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="stars">{ui.stars}</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "home" && (
        <div className="space-y-4">
          <ZoneFlowMindUnfreeze isLight={isLight} />
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xl"><HeartPulse className="h-5 w-5 text-rose-500" />{checkinUi.title}</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm"><span>{checkinUi.mood}</span><div className="flex items-center gap-2"><BatteryMedium className="h-4 w-4 text-emerald-500" /><Input type="range" min="0" max="10" value={checkinEnergy} onChange={(event) => setCheckinEnergy(Number(event.target.value))} /><span>{checkinEnergy}/10</span></div></label>
                <label className="space-y-2 text-sm"><span>{checkinUi.anxiety}</span><div className="flex items-center gap-2"><Wind className="h-4 w-4 text-sky-500" /><Input type="range" min="0" max="10" value={checkinAnxiety} onChange={(event) => setCheckinAnxiety(Number(event.target.value))} /><span>{checkinAnxiety}/10</span></div></label>
                <label className="space-y-2 text-sm"><span>{checkinUi.need}</span><select value={checkinNeed} onChange={(event) => setCheckinNeed(event.target.value as typeof checkinNeed)} className={cn("h-10 w-full rounded-xl border px-3 text-sm", inputClass)}><option value="calm">{checkinUi.calm}</option><option value="action">{checkinUi.action}</option><option value="clarity">{checkinUi.clarity}</option></select></label>
              </div>
              <div className="flex flex-wrap items-center gap-3"><Button onClick={saveCheckin} className="rounded-full">{checkinUi.save}</Button>{checkinSaved && <span className="text-sm text-emerald-600">{checkinUi.saved}</span>}</div>
              <p className={cn("text-xs leading-6", subtleText)}>{checkinUi.safety}</p>
            </CardContent>
          </Card>
          <Card className={cn("overflow-hidden border", shellCard)}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1.35fr_0.8fr]">
              <div className={cn("rounded-[28px] bg-gradient-to-br p-5 text-white", selectedJourney.accent)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/75">משימה חדשה לגרסה רגועה יותר שלך</div>
                    <h3 className="mt-2 text-3xl font-bold">{selectedJourney.title}</h3>
                    <p className="mt-2 max-w-xl text-sm text-white/80">{selectedJourney.summary}</p>
                  </div>
                  <div className="text-5xl">{selectedJourney.icon}</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setActiveTab("journeys")}
                    className="rounded-full bg-white text-[#2b1cff] hover:bg-white/90"
                  >
                    פתח מסלול
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveTab("coach");
                      setCoachInput(selectedJourney.coachPrompt);
                    }}
                    className="rounded-full border-white/25 bg-white/10 text-white hover:bg-white/20"
                  >
                    דבר עם ה־AI
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Card className={cn("border", softPanel)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-[#4530ff]" />
                      טיפ למוטיבציה
                    </div>
                    <p className={cn("mt-3 text-base leading-7", titleText)}>{dailyTip}</p>
                  </CardContent>
                </Card>
                <Card className={cn("border", softPanel)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">התקדמות במסלול הפעיל</div>
                        <div className={cn("text-xs", subtleText)}>
                          {completedCount} מתוך {selectedJourney.duration} ימים
                        </div>
                      </div>
                      <div className={cn("rounded-full px-3 py-1 text-xs", selectedJourney.accentSoft)}>
                        {selectedProgress}%
                      </div>
                    </div>
                    <Progress value={selectedProgress} className="mt-4 h-2.5" />
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
            <Card className={cn("overflow-hidden border", shellCard)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">מרחב גילוי עצמי</CardTitle>
                  <Button variant="ghost" className={cn("rounded-full px-3 text-xs", titleText)} onClick={() => setActiveTab("journeys")}>
                    הצג הכל
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Carousel opts={{ align: "start" }} className="w-full">
                  <CarouselContent>
                    {JOURNEYS.map((journey) => {
                      const journeyProgress = Math.round(
                        (completedDays.filter((item) => item.startsWith(`${journey.id}:`)).length / journey.duration) * 100,
                      );
                      return (
                        <CarouselItem key={journey.id} className="basis-[85%] md:basis-1/2 xl:basis-1/3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJourneyId(journey.id);
                              setActiveTab("journeys");
                            }}
                            className="h-full w-full text-right"
                          >
                            <Card className="h-full overflow-hidden border-[#dfe5ff] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-white/5">
                              <div className={cn("h-40 bg-gradient-to-br", journey.accent)} />
                              <CardContent className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg font-semibold">{journey.title}</div>
                                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-300/70">{journey.subtitle}</div>
                                  </div>
                                  <div className="text-3xl">{journey.icon}</div>
                                </div>
                                <div className="flex gap-2 text-xs">
                                  <span className={cn("rounded-full px-2 py-1", journey.accentSoft)}>{journey.questions} שאלות</span>
                                  <span className={cn("rounded-full px-2 py-1", journey.accentSoft)}>{journey.minutes} דק'</span>
                                </div>
                                <Progress value={journeyProgress} className="h-2" />
                              </CardContent>
                            </Card>
                          </button>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                  <CarouselPrevious className="hidden md:flex" />
                  <CarouselNext className="hidden md:flex" />
                </Carousel>
              </CardContent>
            </Card>

            <Card className={cn("border", shellCard)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">הישגים והתקדמות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className={cn("rounded-3xl border p-4", softPanel)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">אתגר רצף</div>
                      <div className={cn("text-xs", subtleText)}>מטרה רכה: 14 ימים של תנועה</div>
                    </div>
                    <div className="text-xl font-bold">{totalCompletedCount}/{totalJourneyDays}</div>
                  </div>
                  <Progress value={totalProgress} className="mt-4 h-2.5" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={cn(
                        "rounded-3xl border p-4 text-right transition",
                        achievement.unlocked
                          ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                          : softPanel,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className={cn("h-4 w-4", achievement.unlocked ? "text-amber-500" : "text-slate-400")} />
                        <div className="font-semibold">{achievement.title}</div>
                      </div>
                      <div className={cn("mt-2 text-sm", subtleText)}>{achievement.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "journeys" && (
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.38fr]">
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">המסלולים שלך</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {JOURNEYS.map((journey) => {
                const journeyProgress = Math.round(
                  (completedDays.filter((item) => item.startsWith(`${journey.id}:`)).length / journey.duration) * 100,
                );
                const isActiveJourney = journey.id === selectedJourney.id;
                return (
                  <button
                    key={journey.id}
                    type="button"
                    onClick={() => setSelectedJourneyId(journey.id)}
                    className={cn(
                      "w-full rounded-3xl border p-4 text-right transition",
                      isActiveJourney
                        ? "border-[#4a40ff] bg-[#eef0ff] shadow-sm dark:border-[#736cff] dark:bg-[#2a2460]"
                        : softPanel,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">{journey.title}</div>
                        <div className={cn("mt-1 text-sm", subtleText)}>{journey.subtitle}</div>
                      </div>
                      <div className="text-3xl">{journey.icon}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={cn("rounded-full px-2 py-1", journey.accentSoft)}>{journey.duration} ימים</span>
                      <span className={cn("rounded-full px-2 py-1", journey.accentSoft)}>{journey.minutes} דק'</span>
                    </div>
                    <Progress value={journeyProgress} className="mt-4 h-2" />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">{selectedJourney.title}</CardTitle>
                  <p className={cn("mt-1 text-sm", subtleText)}>{selectedJourney.summary}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetJourney} className="rounded-full">
                    <RefreshCcw className="h-4 w-4 ml-1" />
                    התחל מחדש
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveTab("coach");
                      setCoachInput(selectedJourney.coachPrompt);
                    }}
                    className="rounded-full bg-[#4530ff] hover:bg-[#3421d9]"
                  >
                    <BrainCircuit className="h-4 w-4 ml-1" />
                    AI למסלול הזה
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="mb-4 rounded-3xl border border-[#dfe5ff] bg-[#f5f6ff] p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">התקדמות במסלול</div>
                    <div className={cn("text-xs", subtleText)}>
                      {completedCount} מתוך {selectedJourney.duration} ימים הושלמו
                    </div>
                  </div>
                  <div className={cn("rounded-full px-3 py-1 text-xs", selectedJourney.accentSoft)}>{selectedProgress}%</div>
                </div>
                <Progress value={selectedProgress} className="mt-4 h-2.5" />
              </div>

              <ScrollArea className="h-[min(70svh,680px)] min-h-[420px] max-w-full overscroll-contain touch-pan-y pr-1">
                <div className="space-y-4">
                  {selectedJourney.days.map((day) => {
                    const dayKey = `${selectedJourney.id}:${day.day}`;
                    const isDone = completedDays.includes(dayKey);
                    return (
                      <Card key={dayKey} className={cn("border", isDone ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : softPanel)}>
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xs font-medium text-[#4530ff]">יום {day.day}</div>
                              <div className="mt-1 text-lg font-semibold">{day.title}</div>
                              <p className={cn("mt-2 text-sm leading-7", subtleText)}>{day.body}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleDayCompletion(day.day)}
                              className="shrink-0"
                              aria-label={`${isDone ? "Unmark" : "Mark"} day ${day.day}`}
                            >
                              {isDone ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-slate-400" />}
                            </button>
                          </div>

                          <div className="rounded-2xl border border-[#dfe5ff] bg-white/80 p-3 dark:border-white/10 dark:bg-black/10">
                            <div className="text-sm font-medium">שאלת היום</div>
                            <div className={cn("mt-2 text-sm", titleText)}>{day.prompt}</div>
                          </div>

                          <Textarea
                            value={journalEntries[dayKey] || ""}
                            onChange={(event) => updateJournal(day.day, event.target.value)}
                            placeholder="לרשימות שלך..."
                            className={cn("min-h-[96px] resize-none", inputClass)}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "coach" && (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">המאמן המנטלי שלך</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className={cn("rounded-2xl border p-3 text-xs leading-6", softPanel)} role="note">
                {ui.support}
              </div>
              <div className={cn("rounded-3xl border p-4", softPanel)}>
                <div className="text-sm font-semibold">איך אתה מרגיש עכשיו?</div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setCoachIntensity(level as CoachIntensity)}
                      className={cn(
                        "rounded-2xl border px-2 py-3 text-sm font-medium transition",
                        coachIntensity === level
                          ? "border-[#4530ff] bg-[#eef0ff] text-[#2b1cff] dark:border-[#736cff] dark:bg-[#2a2460] dark:text-white"
                          : softPanel,
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn("rounded-3xl border p-4", softPanel)}>
                <div className="text-sm font-semibold">התחלות מהירות</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    "אני קפוא מול משימה",
                    "אני מוצף ואין לי סדר",
                    "אני מפחד להתחיל כי אכשל",
                    "תעזור לי לפרק את זה לצעד ראשון",
                    selectedJourney.coachPrompt,
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendCoachMessage(prompt)}
                      className="rounded-full border border-[#dfe5ff] bg-white px-3 py-2 text-right text-xs text-slate-700 transition hover:border-[#4530ff] hover:text-[#2b1cff] dark:border-white/10 dark:bg-white/5 dark:text-white/85"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn("rounded-3xl border p-4", softPanel)}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">היסטוריית שיחות</div>
                  <Button variant="ghost" className="h-auto rounded-full px-2 py-1 text-xs" onClick={clearAndArchive}>
                    ארכב את השיחה הנוכחית
                  </Button>
                </div>
                <ScrollArea className="mt-3 h-[220px]">
                  <div className="space-y-2 pl-2">
                    {conversationHistory.length === 0 && (
                      <div className={cn("rounded-2xl border p-3 text-sm", softPanel)}>
                        כאן יישמרו שיחות קודמות כדי שתוכל לחזור אליהן.
                      </div>
                    )}
                    {conversationHistory.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => loadConversation(conversation)}
                        className={cn("w-full rounded-2xl border p-3 text-right transition hover:border-[#4530ff]", softPanel)}
                      >
                        <div className="text-sm font-medium">{conversation.preview}</div>
                        <div className={cn("mt-1 text-xs", subtleText)}>{conversation.date}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">שיחה פעילה</CardTitle>
                  <p className={cn("mt-1 text-sm", subtleText)}>
                    המאמן מכוון לרגשות, תקיעות, דחיינות וקושי להתחיל, ולא רק לפרודוקטיביות "קשוחה".
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={startVoiceCapture}
                    className={cn("rounded-full", isListening && "border-rose-400 text-rose-500")}
                  >
                    <Mic className="h-4 w-4 ml-1" />
                    {isListening ? "מקשיב..." : "קול"}
                  </Button>
                  <Button variant="outline" onClick={() => setMessages([])} className="rounded-full">
                    שיחה חדשה
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <ScrollArea className="h-[min(520px,58svh)] min-h-[360px] rounded-3xl border border-[#dfe5ff] bg-[#f7f8ff] p-4 dark:border-white/10 dark:bg-[#0f1630]">
                <div className="space-y-3" aria-live="polite">
                  {messages.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-[#d8deff] bg-white/80 p-5 text-center dark:border-white/10 dark:bg-white/5">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef0ff] text-[#4530ff] dark:bg-[#2a2460] dark:text-white">
                        <BrainCircuit className="h-7 w-7" />
                      </div>
                      <div className="text-lg font-semibold">איך אתה באמת מרגיש מול היום?</div>
                      <p className={cn("mx-auto mt-2 max-w-xl text-sm leading-7", subtleText)}>
                        אפשר לכתוב חופשי, לבקש פירוק למשימה, לדבר על תקיעות, על פחד להתחיל, על עומס, או על הצורך לעשות סדר רגשי לפני ביצוע.
                      </p>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn(
                        "max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-7",
                        message.role === "user"
                          ? "mr-auto bg-[#4530ff] text-white"
                          : isLight
                            ? "bg-white text-slate-800 shadow-sm"
                            : "bg-white/8 text-white",
                      )}
                    >
                      {message.content}
                    </div>
                  ))}

                  {coachLoading && (
                    <div className={cn("max-w-[88%] rounded-3xl px-4 py-3 text-sm", isLight ? "bg-white text-slate-600" : "bg-white/8 text-white/75")}>
                      חושב איתך על הצעד הבא...
                    </div>
                  )}
                  <div ref={coachScrollRef} />
                </div>
              </ScrollArea>

              <div className="rounded-3xl border border-[#dfe5ff] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111936]">
                <Textarea
                  value={coachInput}
                  onChange={(event) => setCoachInput(event.target.value)}
                  placeholder="כתוב מה עוצר אותך, מה מלחיץ אותך, או איזו משימה אתה לא מצליח להתחיל..."
                  className={cn("min-h-[110px] resize-none border-0 shadow-none focus-visible:ring-0", inputClass)}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className={cn("text-xs", subtleText)}>
                    ממוקד כרגע ב־{selectedJourney.title} · עוצמה {coachIntensity}/5
                  </div>
                  <Button
                    onClick={() => sendCoachMessage()}
                    disabled={coachLoading || !coachInput.trim()}
                    className="rounded-full bg-[#4530ff] hover:bg-[#3421d9]"
                  >
                    <Send className="h-4 w-4 ml-1" />
                    שלח
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "progress" && (
        <div className="grid gap-4 xl:grid-cols-[0.86fr_1.44fr]">
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{ui.overall}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="rounded-[32px] bg-gradient-to-br from-[#1f1acb] via-[#4530ff] to-[#8f95ff] p-6 text-white">
                <div className="text-5xl font-bold">{totalProgress}%</div>
                <div className="mt-2 text-sm text-white/75">{totalCompletedCount} {ui.marked}</div>
                <Progress value={totalProgress} className="mt-5 h-3" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className={cn("rounded-3xl border p-4", achievement.unlocked ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" : softPanel)}>
                    <div className="flex items-center gap-2">
                      <Trophy className={cn("h-4 w-4", achievement.unlocked ? "text-amber-500" : "text-slate-400")} />
                      <div className="font-semibold">{achievement.title}</div>
                    </div>
                    <div className={cn("mt-2 text-sm", subtleText)}>{achievement.description}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{ui.progress}</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {masteryWins.length === 0 ? (
                <div className={cn("rounded-3xl border border-dashed p-10 text-center", softPanel)}>
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#118a91]" />
                  <p className={cn("text-sm leading-7", subtleText)}>{ui.subtitle}</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {masteryWins.map((win, index) => (
                    <Card key={`${win.completedAt || "win"}-${index}`} className={cn("border", softPanel)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                          <div>
                            <div className="font-semibold">{win.task || win.step}</div>
                            {win.step && win.task && <p className={cn("mt-2 text-sm leading-6", subtleText)}>{win.step}</p>}
                            {win.completedAt && <div className={cn("mt-3 text-xs", subtleText)}>{new Intl.DateTimeFormat(LOCALES[lang] || "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(win.completedAt))}</div>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "numbers" && (
        <div className="grid gap-4 xl:grid-cols-[0.86fr_1.44fr]">
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{ui.mapDetails}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div>
                <label htmlFor="zoneflow-mind-birthdate-numbers" className="mb-2 block text-sm font-medium">{ui.birthDate}</label>
                <Input id="zoneflow-mind-birthdate-numbers" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="zoneflow-mind-city-numbers" className="mb-2 block text-sm font-medium">{ui.city}</label>
                <Input id="zoneflow-mind-city-numbers" value={birthCity} onChange={(event) => setBirthCity(event.target.value)} placeholder="Jerusalem" className={inputClass} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="zoneflow-mind-birthplace" className="mb-2 block text-sm font-medium">{mapUi.birthPlace}</label><Input id="zoneflow-mind-birthplace" value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} placeholder="Jerusalem" className={inputClass} /></div>
                <div><label htmlFor="zoneflow-mind-birthcountry" className="mb-2 block text-sm font-medium">{mapUi.birthCountry}</label><Input id="zoneflow-mind-birthcountry" value={birthCountry} onChange={(event) => setBirthCountry(event.target.value)} placeholder="Israel" className={inputClass} /></div>
              </div>
              <div><label htmlFor="zoneflow-mind-birthtime" className="mb-2 block text-sm font-medium">{mapUi.birthTime}</label><Input id="zoneflow-mind-birthtime" type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} className={inputClass} /></div>
              <div>
                <label htmlFor="zoneflow-mind-birth-utc" className="mb-2 block text-sm font-medium">{chartCopy.utcOffset}</label>
                <Input id="zoneflow-mind-birth-utc" type="number" step="30" min="-720" max="840" value={birthUtcOffsetMinutes} onChange={(event) => setBirthUtcOffsetMinutes(Number(event.target.value) || 0)} className={inputClass} />
                <p className={cn("mt-1 text-xs leading-5", subtleText)}>{chartCopy.utcHint}</p>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepMasterNumbers} onChange={(event) => setKeepMasterNumbers(event.target.checked)} />{mapUi.method}</label>
              <div><label htmlFor="zoneflow-mind-content-mode" className="mb-2 block text-sm font-medium">{mapUi.mode}</label><select id="zoneflow-mind-content-mode" value={contentMode} onChange={(event) => setContentMode(event.target.value as typeof contentMode)} className={cn("h-10 w-full rounded-xl border px-3 text-sm", inputClass)}><option value="reflection">{mapUi.reflection}</option><option value="science">{mapUi.science}</option><option value="faith">{mapUi.faith}</option></select></div>
              <div><label htmlFor="zoneflow-mind-topic" className="mb-2 block text-sm font-medium">{mapUi.topic}</label><Input id="zoneflow-mind-topic" value={reflectionTopic} onChange={(event) => setReflectionTopic(event.target.value)} placeholder={mapUi.questions} className={inputClass} /></div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100" role="note">
                {ui.symbolic}
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-6 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100" role="note">
                {mapUi.astrology}
              </div>
              <Button type="button" className="w-full rounded-full bg-[#4530ff] hover:bg-[#3421d9]" onClick={saveMapProfile}>
                {mapUi.saveMap}
              </Button>

              <div className={cn("rounded-3xl border p-4", softPanel)}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-[#4530ff]" />
                  איך זה עובד?
                </div>
                <p className={cn("mt-2 text-sm leading-7", subtleText)}>
                  המפה מחשבת את המספרים המקובלים לפי תאריך הלידה שהזנת: נתיב חיים, מספר גישה, שנה אישית, חודש אישי ויום אישי. זהו כלי סמלי לרפלקציה ולא מדידה מדעית.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setActiveTab("coach");
                  setCoachInput(`עזור לי להפוך את ההשראה הסמלית מהמספרים שלי לצעד מעשי להיום. ${reflectionTopic ? `הנושא שלי: ${reflectionTopic}` : ""}`);
                }}
              >
                <BrainCircuit className="h-4 w-4 ml-1" />
                התייעץ עם AI על המפה
              </Button>
            </CardContent>
          </Card>

          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">המפה הנומרולוגית שלך</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {!numerology ? (
                <div className={cn("rounded-3xl border border-dashed p-10 text-center", softPanel)}>
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[#4530ff]" />
                  <div className="text-lg font-semibold">כדי לפתוח את המפה, צריך רק תאריך לידה</div>
                  <p className={cn("mt-2 text-sm", subtleText)}>אחר כך נחשב עבורך את המספרים המרכזיים ונסביר מה הם אומרים על הקצב, האופי והפוקוס שלך.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {[
                      { label: "נתיב חיים", value: numerology.lifePath },
                      { label: "מספר גישה", value: numerology.attitude },
                      { label: "שנה אישית", value: numerology.personalYear },
                      { label: "חודש אישי", value: numerology.personalMonth },
                      { label: "יום אישי", value: numerology.personalDay },
                    ].map((item) => {
                      const meaning = NUMEROLOGY_MEANINGS[item.value] || NUMEROLOGY_MEANINGS[1];
                      return (
                        <Card key={item.label} className={cn("border", softPanel)}>
                          <CardContent className="p-4">
                            <div className="text-xs font-medium text-[#4530ff]">{item.label}</div>
                            <div className="mt-2 text-3xl font-bold">{item.value}</div>
                            <div className={cn("mt-2 text-sm", subtleText)}>{meaning.title}</div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { label: "נתיב חיים", value: numerology.lifePath },
                      { label: "מספר גישה", value: numerology.attitude },
                      { label: "שנה אישית", value: numerology.personalYear },
                      { label: "חודש אישי", value: numerology.personalMonth },
                      { label: "יום אישי", value: numerology.personalDay },
                    ].map((item) => {
                      const meaning = NUMEROLOGY_MEANINGS[item.value] || NUMEROLOGY_MEANINGS[1];
                      return (
                        <Card key={`${item.label}-meaning`} className={cn("border", softPanel)}>
                          <CardContent className="space-y-3 p-4">
                            <div>
                              <div className="text-sm font-semibold">{item.label}: {item.value} · {meaning.title}</div>
                              <p className={cn("mt-2 text-sm leading-7", subtleText)}>{meaning.summary}</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-3 text-sm dark:bg-black/10">
                              <span className="font-medium">כיוון להיום:</span> {meaning.action}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "birthchart" && (
        <div className="grid gap-4 xl:grid-cols-[0.86fr_1.44fr]">
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{BIRTH_CHART_LABEL[lang] ?? BIRTH_CHART_LABEL.en}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-6 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100" role="note">
                {mapUi.astrology}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="zoneflow-birthchart-date" className="mb-2 block text-sm font-medium">{ui.birthDate}</label>
                  <Input id="zoneflow-birthchart-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="zoneflow-birthchart-time" className="mb-2 block text-sm font-medium">{mapUi.birthTime}</label>
                  <Input id="zoneflow-birthchart-time" type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="zoneflow-birthchart-utc" className="mb-2 block text-sm font-medium">{chartCopy.utcOffset}</label>
                  <Input id="zoneflow-birthchart-utc" type="number" step="30" min="-720" max="840" value={birthUtcOffsetMinutes} onChange={(event) => setBirthUtcOffsetMinutes(Number(event.target.value) || 0)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="zoneflow-birthchart-place" className="mb-2 block text-sm font-medium">{mapUi.birthPlace}</label>
                  <Input id="zoneflow-birthchart-place" value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} placeholder={mapUi.birthPlace} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="zoneflow-birthchart-country" className="mb-2 block text-sm font-medium">{mapUi.birthCountry}</label>
                  <Input id="zoneflow-birthchart-country" value={birthCountry} onChange={(event) => setBirthCountry(event.target.value)} placeholder={mapUi.birthCountry} className={inputClass} />
                </div>
              </div>
              <Button type="button" className="w-full rounded-full bg-[#4530ff] hover:bg-[#3421d9]" onClick={saveMapProfile}>
                {mapUi.saveMap}
              </Button>
              <div className={cn("rounded-3xl border p-4", softPanel)}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="h-4 w-4 text-[#4530ff]" />
                  {BIRTH_CHART_LABEL[lang] ?? BIRTH_CHART_LABEL.en}
                </div>
                <p className={cn("mt-2 text-sm leading-7", subtleText)}>{mapUi.engineNote}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setActiveTab("coach");
                  setCoachInput(mapUi.aiPrompt);
                }}
              >
                <BrainCircuit className="h-4 w-4 ml-1" />
                {mapUi.aiButton}
              </Button>
            </CardContent>
          </Card>

          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{BIRTH_CHART_LABEL[lang] ?? BIRTH_CHART_LABEL.en}</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {!zodiac ? (
                <div className={cn("rounded-3xl border border-dashed p-10 text-center", softPanel)}>
                  <Star className="mx-auto mb-3 h-8 w-8 text-[#4530ff]" />
                  <div className="text-lg font-semibold">{mapUi.notReady}</div>
                  <p className={cn("mt-2 text-sm", subtleText)}>{mapUi.notReadyHint}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[32px] bg-gradient-to-br from-[#171b58] via-[#4530ff] to-[#b18cff] p-6 text-white">
                    <div className="text-sm text-white/75">{mapUi.sunSign}</div>
                    <div className="mt-2 text-4xl font-bold">{zodiac.name}</div>
                    <p className="mt-3 text-sm leading-7 text-white/85">{zodiac.vibe}</p>
                  </div>
                  <div className={cn("grid gap-3 sm:grid-cols-3", softPanel)}>
                    <div className="rounded-2xl border p-3 text-sm"><div className={subtleText}>{ui.birthDate}</div><div className="mt-1 font-semibold">{appliedMapProfile.birthDate}</div></div>
                    <div className="rounded-2xl border p-3 text-sm"><div className={subtleText}>{mapUi.birthTime}</div><div className="mt-1 font-semibold">{appliedMapProfile.birthTime || "לא ידוע"}</div></div>
                    <div className="rounded-2xl border p-3 text-sm"><div className={subtleText}>{mapUi.birthPlace}</div><div className="mt-1 font-semibold">{[appliedMapProfile.birthPlace, appliedMapProfile.birthCountry].filter(Boolean).join(", ") || "לא ידוע"}</div></div>
                  </div>
                  <div className={cn("rounded-3xl border p-4 text-sm leading-7", softPanel)}>
                    <div className="font-semibold">איכות נתוני המפה</div>
                    <p className={cn("mt-2", subtleText)}>{birthChartDataQuality}</p>
                  </div>
                  {calculatedBirthChart && (
                    <>
                      <div className={cn("rounded-3xl border p-4", softPanel)}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">{chartCopy.positions}</div>
                          <span className="rounded-full bg-[#4530ff]/10 px-3 py-1 text-xs font-medium text-[#4530ff]">{chartCopy.calculated}</span>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {calculatedBirthChart.planets.map((planet) => (
                            <div key={planet.id} className="rounded-2xl border bg-white/70 p-3 text-sm dark:bg-black/10">
                              <div className={cn("text-xs", subtleText)}>{lang === "he" ? CHART_PLANET_LABELS[planet.id] : planet.name}</div>
                              <div className="mt-1 font-semibold">{lang === "he" ? CHART_SIGN_LABELS[planet.sign] : planet.sign} {planet.degree.toFixed(1)}°</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className={cn("rounded-3xl border p-4", softPanel)}>
                        <div className="font-semibold">{chartCopy.aspects}</div>
                        {calculatedBirthChart.aspects.length === 0 ? (
                          <p className={cn("mt-2 text-sm", subtleText)}>{chartCopy.noAspects}</p>
                        ) : (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {calculatedBirthChart.aspects.map((aspect) => (
                              <div key={`${aspect.left}-${aspect.right}-${aspect.type}`} className="rounded-2xl border bg-white/70 p-3 text-sm dark:bg-black/10">
                                <div className="font-medium">{aspect.left} · {aspect.right}</div>
                                <div className={cn("mt-1 text-xs", subtleText)}>{lang === "he" ? CHART_ASPECT_LABELS[aspect.type] : aspect.type} · {aspect.orb}°</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <div className={cn("rounded-3xl border p-4 text-sm leading-7", softPanel)}>
                    {mapUi.disclaimer}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "stars" && (
        <div className="grid gap-4 xl:grid-cols-[0.88fr_1.42fr]">
          <Card className={cn("border", shellCard)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{ui.dailyInspiration}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div>
                <label htmlFor="zoneflow-mind-birthdate-stars" className="mb-2 block text-sm font-medium">{ui.birthDate}</label>
                <Input id="zoneflow-mind-birthdate-stars" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="zoneflow-mind-city-stars" className="mb-2 block text-sm font-medium">{ui.city}</label>
                <Input id="zoneflow-mind-city-stars" value={birthCity} onChange={(event) => setBirthCity(event.target.value)} placeholder="Tel Aviv" className={inputClass} />
              </div>
              <Button type="button" className="w-full rounded-full bg-[#4530ff] hover:bg-[#3421d9]" onClick={saveMapProfile}>
                {mapUi.saveMap}
              </Button>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100" role="note">
                {ui.symbolic}
              </div>
              <div className={cn("rounded-3xl border p-4", softPanel)}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="h-4 w-4 text-[#4530ff]" />
                  עדכון יומי
                </div>
                <p className={cn("mt-2 text-sm leading-7", subtleText)}>
                  הכרטיס מתחלף לפי התאריך המקומי והמזל שלך. העיר נשמרת כהקשר אישי בלבד ואינה הופכת את התוכן לחיזוי מדעי.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setActiveTab("coach");
                  setCoachInput("קח את ההשראה היומית שלי והצע לי פעולה קטנה שמתאימה ליום הזה.");
                }}
              >
                <BrainCircuit className="h-4 w-4 ml-1" />
                התייעץ עם AI על ההשראה
              </Button>
            </CardContent>
          </Card>

          <Card className={cn("overflow-hidden border", shellCard)}>
            <CardContent className="p-0">
              {!zodiac || !horoscope ? (
                <div className={cn("p-10 text-center", isLight ? "bg-[#f5f6ff]" : "bg-[#10172d]")}>
                  <Star className="mx-auto mb-3 h-8 w-8 text-[#4530ff]" />
                  <div className="text-lg font-semibold">כדי להפעיל הורוסקופ, צריך תאריך לידה</div>
                  <p className={cn("mt-2 text-sm", subtleText)}>אחרי שתזין תאריך, נבנה עבורך תחזית יומית בסגנון אישי יותר.</p>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-[#1613a8] via-[#3f33ff] to-[#90a3ff] px-6 py-8 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-white/75">{new Intl.DateTimeFormat(LOCALES[lang] || "en-US", { weekday: "long", day: "numeric", month: "long" }).format(horoscope.date)} · {zodiac.name}</div>
                        <h3 className="mt-2 text-4xl font-bold">{zodiac.vibe}</h3>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white/15 px-3 py-1">מתעדכן כל יום</span>
                          {birthCity && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {birthCity}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-3xl bg-white/10 px-4 py-3">
                        <div className="text-xs text-white/70">מזל</div>
                        <div className="text-2xl font-bold">{zodiac.name}</div>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setHoroscopeOffset((offset) => offset - 1)}>← אתמול</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setHoroscopeOffset(0)}>היום</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setHoroscopeOffset((offset) => Math.min(0, offset + 1))}>מחר →</Button>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-2">
                    <Card className={cn("border", softPanel)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Flame className="h-4 w-4 text-[#4530ff]" />
                          מוקד היום
                        </div>
                        <p className={cn("mt-3 text-sm leading-7", titleText)}>{horoscope.focus}</p>
                      </CardContent>
                    </Card>
                    <Card className={cn("border", softPanel)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="h-4 w-4 text-[#4530ff]" />
                          אנרגיה מורגשת
                        </div>
                        <p className={cn("mt-3 text-sm leading-7", titleText)}>{horoscope.mood}</p>
                      </CardContent>
                    </Card>
                    <Card className={cn("border md:col-span-2", softPanel)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Target className="h-4 w-4 text-[#4530ff]" />
                          פעולה מומלצת להיום
                        </div>
                        <p className={cn("mt-3 text-sm leading-7", titleText)}>{horoscope.action}</p>
                      </CardContent>
                    </Card>
                    <Card className={cn("border md:col-span-2", softPanel)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CalendarDays className="h-4 w-4 text-[#4530ff]" />
                          מה אני לוקח מהיום?
                        </div>
                        <Textarea
                          value={horoscopeNotes[horoscopeDateKey] || ""}
                          onChange={(event) => setHoroscopeNotes((notes) => ({ ...notes, [horoscopeDateKey]: event.target.value }))}
                          placeholder="הערה פרטית שנשמרת לקריאה של תאריך זה..."
                          className={cn("mt-3 min-h-[96px] resize-none", inputClass)}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
