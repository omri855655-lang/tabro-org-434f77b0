import type { DailyBriefing } from "./dailyBriefing.ts";

export const editionLanguages = ["he", "ar", "en", "fr"] as const;
export type EditionLanguage = typeof editionLanguages[number];

export const editionCopy = {
  he: ["העיתון היומי שלי", "מהדורה", "לו״ז", "משימות", "מיילים לבדיקה", "לימוד ותרגול", "הרגלים", "חדשות טובות", "מילה באנגלית", "כתוב משפט קצר עם המילה והסבר רעיון שלמדת היום בלי להסתכל בהערות.", "אין פריטים למהדורה זו."],
  ar: ["صحيفتي اليومية", "العدد", "الجدول", "المهام", "رسائل للمراجعة", "التعلّم والتمارين", "العادات", "أخبار إيجابية", "كلمة بالإنجليزية", "اكتب جملة قصيرة بالكلمة واشرح فكرة تعلّمتها دون الرجوع إلى ملاحظاتك.", "لا توجد مواد لهذا العدد."],
  en: ["My Daily Paper", "Edition", "Schedule", "Tasks", "Inbox to review", "Study & practice", "Habits", "Good news", "English word", "Write a short sentence using the word, then explain one thing you learned without looking at your notes.", "There are no items for this edition."],
  fr: ["Mon journal quotidien", "Édition", "Agenda", "Tâches", "Courriels à examiner", "Étude et exercices", "Habitudes", "Bonnes nouvelles", "Mot anglais", "Écrivez une phrase avec ce mot, puis expliquez une idée apprise sans consulter vos notes.", "Aucun élément pour cette édition."],
} as const;

export function normalizeEdition(raw: unknown, accountLanguage?: string) {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  const language = accountLanguage
    ? editionLanguages.find(lang => lang === accountLanguage) ?? "en"
    : editionLanguages.find(lang => lang === data.language) ?? "he";
  return {
    enabled: data.enabled === true,
    language,
    title: clean(data.title, 100),
    study: clean(data.study, 300),
    habits: clean(data.habits, 300),
    topics: clean(data.topics, 180),
    practice: data.practice === true,
    news: data.news === true,
  };
}

export type EditionSettings = ReturnType<typeof normalizeEdition>;
export type EditionArticle = { title: string; source: string; link: string };

export function selectEditionArticles(raw: unknown, topics: string): EditionArticle[] {
  if (!Array.isArray(raw)) return [];
  const terms = topics.toLowerCase().split(",").map(topic => topic.trim()).filter(Boolean);
  const seen = new Set<string>();
  const articles: EditionArticle[] = [];
  for (const item of raw) {
    if (!item || typeof item.title !== "string" || typeof item.source !== "string" || typeof item.link !== "string") continue;
    try {
      const link = new URL(item.link);
      if (link.protocol !== "https:" || link.username || link.password || seen.has(link.href)) continue;
      seen.add(link.href);
      articles.push({ title: item.title.slice(0, 240), source: item.source.slice(0, 80), link: link.href });
    } catch { continue; }
  }
  const matches = articles.filter(article => terms.some(term => article.title.toLowerCase().includes(term)));
  return [...new Set([...matches.slice(0, 2), ...articles])].slice(0, 4);
}

const vocabulary = [
  ["insight", "תובנה", "استبصار", "a clear understanding", "perspicacité"],
  ["steady", "יציב", "ثابت", "consistent or stable", "stable"],
  ["reframe", "לנסח מחדש מנקודת מבט אחרת", "إعادة صياغة من منظور آخر", "to view something differently", "recadrer"],
  ["recall", "להיזכר", "يتذكّر", "to bring to mind", "se rappeler"],
  ["prioritize", "לתעדף", "يرتّب الأولويات", "to decide what matters most", "établir des priorités"],
  ["notice", "לשים לב", "يلاحظ", "to become aware of", "remarquer"],
  ["refine", "לחדד", "يصقل", "to improve through small changes", "affiner"],
];

const mailLabels = {
  action: { he: "לטיפול", ar: "يتطلب إجراءً", en: "Action needed", fr: "À traiter" },
  shopping: { he: "הזמנות ומשלוחים", ar: "الطلبات والشحن", en: "Orders & deliveries", fr: "Commandes et livraisons" },
  finance: { he: "כספים", ar: "المال", en: "Finance", fr: "Finances" },
  security: { he: "אבטחה", ar: "الأمان", en: "Security", fr: "Sécurité" },
};

export function buildNewspaper(report: DailyBriefing, settings: EditionSettings, articles: EditionArticle[] = []) {
  const { language } = settings;
  const copy = editionCopy[language];
  const date = new Date(`${report.date}T12:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat(language, { dateStyle: "full", timeZone: "UTC" }).format(date);
  const day = Math.floor(date.getTime() / 86_400_000);
  const word = vocabulary[((day % vocabulary.length) + vocabulary.length) % vocabulary.length];
  const glossary = { he: word[1], ar: word[2], en: word[3], fr: word[4] };
  const sections = (["event", "task", "mail"] as const).map((kind, index) => ({
    heading: copy[index + 2],
    stories: report.items.filter(item => item.kind === kind).slice(0, 25).map(item => ({
      title: item.title,
      body: [item.mailBucket && Object.hasOwn(mailLabels, item.mailBucket) ? mailLabels[item.mailBucket as keyof typeof mailLabels][language] : "",
        item.when, item.who, item.details, item.suggestion].filter(Boolean).join(" · "),
      link: undefined as string | undefined,
    })),
  }));
  if (settings.habits) sections.push({
    heading: copy[6], stories: settings.habits.split(/\n|,/).map(habit => habit.trim()).filter(Boolean).slice(0, 12)
      .map(habit => ({ title: `□ ${habit}`, body: "", link: undefined })),
  });
  if (settings.practice) sections.push({ heading: copy[5], stories: [
    { title: `${copy[8]} · ${word[0]}`, body: glossary[language], link: undefined },
    { title: settings.study || copy[5], body: copy[9], link: undefined },
  ] });
  if (settings.news && articles.length) sections.push({ heading: copy[7], stories: articles.map(article => ({
    title: article.title, body: article.source, link: article.link,
  })) });
  return {
    title: settings.title || copy[0], language, dir: language === "he" || language === "ar" ? "rtl" as const : "ltr" as const,
    dateLabel, edition: `${copy[1]} ${report.date.replaceAll("-", "")}`, empty: copy[10],
    sections: sections.filter(section => section.stories.length),
  };
}
