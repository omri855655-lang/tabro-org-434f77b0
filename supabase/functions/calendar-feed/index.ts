// Public, JWT-free private calendar feed for Apple Calendar subscriptions.
// Access is granted only by a valid, unrevoked 256-bit bearer token in the path;
// the owner comes from the token row, never from the URL. Never logs the URL.
import { createClient } from "npm:@supabase/supabase-js@2";
import { FEED_MAX_EVENTS, buildFeedBody, feedWindow, hashFeedToken, parseFeedToken, type FeedRow } from "../_shared/calendarFeed.ts";

const PAGE = 500;
const baseHeaders = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const plain = (status: number, text: string) => new Response(text, { status, headers: { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" } });
const notFound = () => plain(404, "Not found");
const unavailable = () => plain(503, "Unavailable");

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return notFound();
  const token = parseFeedToken(new URL(req.url).pathname);
  if (!token) return notFound();

  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return unavailable();

  try {
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const sub = await admin.from("calendar_feed_subscriptions")
      .select("id,user_id,include_description,include_location,include_meeting_url")
      .eq("token_hash", await hashFeedToken(token)).is("revoked_at", null).maybeSingle();
    if (sub.error) return unavailable();
    if (!sub.data) return notFound();
    const s = sub.data;

    const now = new Date();
    const { from, to } = feedWindow(now);
    const columns = ["id", "title", "start_time", "end_time", "all_day", "updated_at"];
    if (s.include_description) columns.push("description");
    if (s.include_location) columns.push("location");
    if (s.include_meeting_url) columns.push("meeting_url");

    // Paged so a server row cap can never silently shorten the feed; fetch one past the limit to detect truncation.
    const rows: FeedRow[] = [];
    while (rows.length <= FEED_MAX_EVENTS) {
      const page = await admin.from("calendar_events").select(columns.join(","))
        .eq("user_id", s.user_id).lt("start_time", to.toISOString()).gt("end_time", from.toISOString())
        .order("start_time", { ascending: true }).order("id", { ascending: true })
        .range(rows.length, rows.length + PAGE - 1);
      if (page.error) return unavailable();
      rows.push(...(page.data as unknown as FeedRow[]));
      if (page.data.length < PAGE) break;
    }

    const feed = buildFeedBody(rows, s, now);
    // Status for the owner's panel only; a failure here must not block the feed.
    await admin.from("calendar_feed_subscriptions").update({
      last_fetched_at: now.toISOString(), last_event_count: feed.exported, last_skipped_count: feed.skipped, last_truncated: feed.truncated,
    }).eq("id", s.id).is("revoked_at", null);

    return new Response(req.method === "HEAD" ? null : feed.text, {
      status: 200,
      headers: { ...baseHeaders, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="tabro.ics"' },
    });
  } catch {
    console.error("calendar-feed: unavailable");
    return unavailable();
  }
});
