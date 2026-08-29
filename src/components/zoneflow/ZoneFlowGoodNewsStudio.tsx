import { useEffect, useMemo, useState } from "react";
import { ExternalLink, HeartHandshake, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/lib/safeLocalStorage";

interface GoodNewsItem { title: string; link: string; pubDate: string; description: string; source: string; thumbnail?: string }
const SOURCES = [
  { name: "Good News Network", feed: "https://www.goodnewsnetwork.org/feed/" },
  { name: "Positive News", feed: "https://www.positive.news/feed/" },
];
const stripHtml = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const cacheKey = () => `zoneflow-good-news:${new Date().toISOString().slice(0, 10)}`;

export function ZoneFlowGoodNewsStudio() {
  const [items, setItems] = useState<GoodNewsItem[]>(() => safeLocalStorage.getJSON(cacheKey(), []));
  const [loading, setLoading] = useState(items.length === 0);
  const [error, setError] = useState("");
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
    <div className="mt-4 flex items-center gap-2 text-xs text-emerald-800"><ShieldCheck className="h-4 w-4" />{updatedAt ? `הכתבה החדשה ביותר עודכנה: ${updatedAt}` : "ממתין לעדכון מאומת"}</div>
    {error && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
    {loading && !items.length ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-emerald-700" /></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.link} className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">{item.thumbnail && <img src={item.thumbnail} alt="" className="h-36 w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />}<div className="p-4"><div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-emerald-700"><span>{item.source}</span><time>{item.pubDate ? new Date(item.pubDate).toLocaleDateString("he-IL") : ""}</time></div><h3 className="mt-2 text-lg font-semibold leading-6">{item.title}</h3>{item.description && <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{item.description}</p>}<a href={item.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900">לכתבה המקורית<ExternalLink className="h-3.5 w-3.5" /></a></div></article>)}</div>}
  </div>;
}
