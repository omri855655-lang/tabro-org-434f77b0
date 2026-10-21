import { newsText } from "./newsText.ts";
export interface GoodNewsItem { title:string; link:string; pubDate:string; description:string; source:string; thumbnail?:string }
export const GOOD_NEWS_CACHE_KEY = "zoneflow-good-news:last-known:v1";
export function safeNewsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url=new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function normalizeNewsItems(value: unknown): GoodNewsItem[] {
  if (!Array.isArray(value)) return [];
  const seen=new Set<string>();
  return value.slice(0,100).flatMap(row=>{
    if (!row || typeof row !== "object") return [];
    const link=safeNewsUrl(row.link);
    if (!link || typeof row.title !== "string" || typeof row.source !== "string") return [];
    const title=newsText(row.title).slice(0,500), source=newsText(row.source).slice(0,100);
    if (!title || !source || seen.has(link)) return [];
    seen.add(link);
    const date=typeof row.pubDate === "string" ? new Date(row.pubDate) : null;
    return [{title,source,link,pubDate:date && Number.isFinite(date.getTime()) ? date.toISOString() : "",description:newsText(typeof row.description === "string" ? row.description : "").slice(0,360),thumbnail:safeNewsUrl(row.thumbnail) || undefined}];
  }).sort((a,b)=>(new Date(b.pubDate).getTime() || 0)-(new Date(a.pubDate).getTime() || 0)).slice(0,40);
}
export function readNewsCache(value: unknown): { items:GoodNewsItem[]; savedAt:number | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {items:[],savedAt:null};
  const row=value as Record<string,unknown>;
  return {items:normalizeNewsItems(row.items),savedAt:typeof row.savedAt === "number" && Number.isFinite(row.savedAt) ? row.savedAt : null};
}
