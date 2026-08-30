import { useEffect, useMemo, useState } from "react";
import { ExternalLink, HeartHandshake, Languages, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";

interface GoodNewsItem { title: string; link: string; pubDate: string; description: string; source: string; thumbnail?: string }
const SOURCES = [
  { name: "Good News Network", feed: "https://www.goodnewsnetwork.org/feed/" },
  { name: "Positive News", feed: "https://www.positive.news/feed/" },
];
const stripHtml = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const cacheKey = () => `zoneflow-good-news:${new Date().toISOString().slice(0, 10)}`;
const TRANSLATION_LANGUAGES = {
  he: "עברית",
  en: "English",
  ar: "العربية",
  ru: "Русский",
  es: "Español",
  fr: "Français",
} as const;
type TranslationLanguage = keyof typeof TRANSLATION_LANGUAGES;
type Translation = { title: string; description: string };

const parseTranslation = (payload: unknown): Translation => {
  if (payload && typeof payload === "object") {
    const direct = payload as Record<string, unknown>;
    if (direct.title) return { title: String(direct.title), description: String(direct.description || "") };
  }

  const raw = String(payload || "").replace(/^```(?:json)?\s*|```$/g, "").trim();
  if (/שכחת|לא צירפת|לא סיפקת|cannot translate|missing (?:text|content)/i.test(raw)) {
    throw new Error("Translation service did not receive the article text");
  }
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      if (parsed.title) return { title: String(parsed.title), description: String(parsed.description || "") };
    } catch {
      // Some models wrap a valid translation in prose. The marker fallback below
      // keeps the article available without trusting invented fields.
    }
  }

  const title = raw.match(/(?:^|\n)(?:TITLE|כותרת)\s*:\s*(.+)/i)?.[1]?.trim();
  const description = raw.match(/(?:^|\n)(?:DESCRIPTION|SUMMARY|תקציר)\s*:\s*([\s\S]+)/i)?.[1]?.trim();
  if (title) return { title, description: description || "" };
  throw new Error("Invalid translation response");
};

export function ZoneFlowGoodNewsStudio() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<GoodNewsItem[]>(() => safeLocalStorage.getJSON(cacheKey(), []));
  const [loading, setLoading] = useState(items.length === 0);
  const [error, setError] = useState("");
  const defaultTranslationLanguage = (lang in TRANSLATION_LANGUAGES ? lang : "he") as TranslationLanguage;
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguage>(defaultTranslationLanguage);
  const translationStoreKey = "zoneflow-good-news-translations:v2";
  const [translationCache, setTranslationCache] = useState<Record<string, Record<string, Translation>>>(() => safeLocalStorage.getJSON(translationStoreKey, {}));
  const translations = translationCache[translationLanguage] || {};
  const [translating, setTranslating] = useState<string | null>(null);
  const [showingOriginal, setShowingOriginal] = useState<Record<string, boolean>>({});
  useEffect(() => safeLocalStorage.setJSON(translationStoreKey, translationCache), [translationCache]);

  const translateItem = async (item: GoodNewsItem) => {
    if (translations[item.link]) {
      setShowingOriginal((current) => ({ ...current, [item.link]: !(current[item.link] ?? true) }));
      return;
    }
    setError("");
    setTranslating(item.link);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("task-ai-helper", {
        body: { type: "custom", customPrompt: `Translate the complete article title and public summary below into ${TRANSLATION_LANGUAGES[translationLanguage]}. Preserve names, numbers and meaning. Do not add facts and do not ask for more context. Return JSON only: {"title":"...","description":"..."}.\n\nSOURCE TITLE:\n${item.title}\n\nSOURCE DESCRIPTION:\n${item.description || item.title}` },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      const parsed = parseTranslation(data?.result ?? data?.suggestion ?? data);
      setTranslationCache((current) => ({
        ...current,
        [translationLanguage]: { ...(current[translationLanguage] || {}), [item.link]: parsed },
      }));
      setShowingOriginal((current) => ({ ...current, [item.link]: false }));
    } catch (cause) {
      console.error("Good news translation failed", cause);
      setError("לא הצלחנו לתרגם את התקציר כרגע. הכתבה המקורית עדיין זמינה.");
    } finally { setTranslating(null); }
  };
  const refresh = async () => {
    setLoading(true); setError("");
    try {
      const responses = await Promise.all(SOURCES.map(async (source) => {
        const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.feed)}`;
        const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`${source.name}: ${response.status}`);
        const payload = await response.json();
        return (payload.items || []).slice(0, 8).map((item: any) => ({ title: stripHtml(item.title), link: item.link, pubDate: item.pubDate, description: stripHtml(item.description || item.content).slice(0, 360), source: source.name, thumbnail: item.thumbnail || item.enclosure?.link }));
      }));
      const next = responses.flat().filter((item) => item.title && item.link).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, 12);
      if (!next.length) throw new Error("No current articles returned");
      setItems(next); safeLocalStorage.setJSON(cacheKey(), next);
    } catch (cause) {
      console.error("Good news refresh failed", cause);
      setError("לא הצלחנו לאמת כרגע כתבות עדכניות. לא נציג תוכן מומצא; נסה לרענן מאוחר יותר.");
    } finally { setLoading(false); }
  };
  useEffect(() => { if (!items.length) void refresh(); }, []);
  const updatedAt = useMemo(() => items[0]?.pubDate ? new Date(items[0].pubDate).toLocaleString("he-IL") : "", [items]);
  return <div className="min-h-[34rem] rounded-[2rem] bg-[radial-gradient(circle_at_10%_0%,rgba(253,224,71,.28),transparent_27%),linear-gradient(145deg,#f5fbf2,#f8f4e8)] p-4 text-slate-900 sm:p-7" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-[1.75rem] border border-emerald-900/10 bg-white/80 p-5 shadow-[0_20px_60px_rgba(31,74,52,.1)] backdrop-blur"><div><div className="flex items-center gap-2 text-xs font-bold tracking-[.13em] text-emerald-700"><HeartHandshake className="h-4 w-4" />GOOD NEWS DAILY</div><h2 className="mt-2 font-serif text-3xl font-semibold">חדשות טובות מהעולם</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">כתבות אמיתיות ממקורות מזוהים, עם קישור למקור ותאריך. Tabro לא ממציאה אירועים ולא מסתירה את המקור.</p></div><Button variant="outline" onClick={() => void refresh()} disabled={loading}>{loading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}רענן</Button></header>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-800"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{updatedAt ? `הכתבה החדשה ביותר עודכנה: ${updatedAt}` : "ממתין לעדכון מאומת"}</span><label className="flex items-center gap-2 font-semibold"><Languages className="h-4 w-4" />תרגם אל<Select value={translationLanguage} onValueChange={(value) => { setTranslationLanguage(value as TranslationLanguage); setShowingOriginal({}); setError(""); }}><SelectTrigger className="h-9 w-32 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TRANSLATION_LANGUAGES).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></label></div>
    {error && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
    {loading && !items.length ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-emerald-700" /></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => {
      const translated = translations[item.link];
      const showOriginal = showingOriginal[item.link] !== false || !translated;
      const visible = showOriginal ? item : { ...item, ...translated };
      return <article key={item.link} className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">{item.thumbnail && <img src={item.thumbnail} alt="" className="h-36 w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />}<div className="p-4"><div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-emerald-700"><span>{item.source}</span><time>{item.pubDate ? new Date(item.pubDate).toLocaleDateString("he-IL") : ""}</time></div><h3 className="mt-2 text-lg font-semibold leading-6">{visible.title}</h3>{visible.description && <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{visible.description}</p>}<div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void translateItem(item)} disabled={translating === item.link}>{translating === item.link ? <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> : <Languages className="ms-1 h-3.5 w-3.5" />}{translated ? (showOriginal ? `הצג ${TRANSLATION_LANGUAGES[translationLanguage]}` : "הצג מקור") : `תרגם ל${TRANSLATION_LANGUAGES[translationLanguage]}`}</Button><a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900">לכתבה המקורית<ExternalLink className="h-3.5 w-3.5" /></a></div></div></article>;
    })}</div>}
  </div>;
}
