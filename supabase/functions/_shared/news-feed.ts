export interface FeedItem { title:string; link:string; pubDate:string; description:string; source:string }
const text = (value:unknown):string => typeof value === "string" || typeof value === "number" ? String(value).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim() : value && typeof value === "object" ? text((value as Record<string,unknown>)["#text"]) : "";
function linkValue(value:unknown):string {
  if (Array.isArray(value)) {
    const alternate=value.find(row=>row && typeof row === "object" && row["@_rel"] === "alternate");
    return linkValue(alternate || value[0]);
  }
  return value && typeof value === "object" ? text((value as Record<string,unknown>)["@_href"]) : text(value);
}
export function newsFeedItems(parsed:unknown, source:string):FeedItem[] {
  if (!parsed || typeof parsed !== "object") return [];
  const document=parsed as {rss?:{channel?:{item?:unknown}};feed?:{entry?:unknown}};
  const records=document.rss?.channel?.item || document.feed?.entry || [];
  const seen=new Set<string>();
  return (Array.isArray(records) ? records : [records]).slice(0,10).flatMap((row:unknown)=>{
    if (!row || typeof row !== "object") return [];
    const record=row as Record<string,unknown>;
    const title=text(record.title), rawLink=linkValue(record.link);
    let link:string;
    try { const url=new URL(rawLink); if(url.protocol!=="https:" || url.username || url.password) return []; link=url.href; } catch { return []; }
    if (!title || seen.has(link)) return []; seen.add(link);
    return [{title:title.slice(0,500),link,pubDate:text(record.pubDate || record.published || record.updated),description:text(record.description || record.summary || record.content).slice(0,360),source}];
  });
}
