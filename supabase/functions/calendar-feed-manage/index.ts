// Authenticated management of the caller's own private calendar subscription.
// Identity comes only from the verified JWT; service-role access happens after that check.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateFeedToken, hashFeedToken } from "../_shared/calendarFeed.ts";
import { handleManage, type FeedStore, type SubscriptionRow } from "./manage.ts";

const COLUMNS = "created_at,include_description,include_location,include_meeting_url,last_fetched_at,last_event_count,last_skipped_count,last_truncated";
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
});

// deno-lint-ignore no-explicit-any
function serviceStore(admin: any): FeedStore {
  const must = <T>(result: { data: T; error: unknown }) => { if (result.error) throw new Error("store"); return result.data; };
  return {
    async getActive(userId) {
      return must(await admin.from("calendar_feed_subscriptions").select(COLUMNS).eq("user_id", userId).is("revoked_at", null).maybeSingle()) as SubscriptionRow | null;
    },
    async insert(userId, tokenHash, options) {
      return must(await admin.from("calendar_feed_subscriptions").insert({ user_id: userId, token_hash: tokenHash, ...options }).select(COLUMNS).single()) as SubscriptionRow;
    },
    async revokeActive(userId) {
      must(await admin.from("calendar_feed_subscriptions").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null));
    },
    async updateOptions(userId, options) {
      return must(await admin.from("calendar_feed_subscriptions").update({ ...options, updated_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null).select(COLUMNS).maybeSingle()) as SubscriptionRow | null;
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json(503, { error: "unavailable" });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const jwt = authHeader.slice(7);
  let userId = "";
  try {
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.getUser(jwt);
    if (error || !data?.user?.id) return json(401, { error: "unauthorized" });
    userId = data.user.id;
  } catch {
    return json(401, { error: "unauthorized" });
  }

  let body: unknown = {};
  try { body = await req.json(); } catch { return json(400, { error: "invalid_body" }); }

  try {
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await handleManage(userId, body, serviceStore(admin), { generateToken: generateFeedToken, hashToken: hashFeedToken });
    return json(result.status, result.body);
  } catch {
    console.error("calendar-feed-manage: storage failure");
    return json(503, { error: "unavailable" });
  }
});
