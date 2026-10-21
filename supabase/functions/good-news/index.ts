import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.5.3';
import { newsFeedItems } from '../_shared/news-feed.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const sources = [
  ['Good News Network', 'https://www.goodnewsnetwork.org/feed/'],
  ['Positive News', 'https://www.positive.news/feed/'],
  ['The Optimist Daily', 'https://www.optimistdaily.com/feed/'],
  ['Good Good Good', 'https://www.goodgoodgood.co/articles/rss.xml'],
  ['Reasons to be Cheerful', 'https://reasonstobecheerful.world/feed/'],
];
type Item = { title: string; link: string; pubDate: string; description: string; source: string };
let cached: { at: number; items: Item[]; availableSources: string[] } | null = null;
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405, headers: cors });
  if (!cached || Date.now() - cached.at > 15 * 60_000) {
    const results = await Promise.allSettled(sources.map(async ([source, url]) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
      if (!response.ok) throw new Error(source);
      const xml = await response.text();
      if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml)) throw new Error('Unsupported feed');
      const parsed = parser.parse(xml);
      return newsFeedItems(parsed,source);
    }));
    const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (items.length) cached = { at: Date.now(), items, availableSources: [...new Set(items.map(i => i.source))] };
  }
  return Response.json({ items: cached?.items || [], availableSources: cached?.availableSources || [], updatedAt: cached?.at || null }, { headers: { ...cors, 'Cache-Control': 'public, max-age=300' }, status: cached ? 200 : 503 });
});
