import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-token",
};
import { israelClock, israelDayStartUtc } from "../_shared/briefingSchedule.ts";
import { pushServiceName, summarizePushResults, vapidDiagnostics } from "../_shared/pushDiagnostics.ts";
import { deliverToSubscriptions, vapidFromEnv } from "../_shared/webPush.ts";
import { APP_VAPID_PUBLIC_KEY } from "./appKey.ts";

// Signed-in, user-scoped push diagnostics. The user comes only from the verified JWT and
// only that user's registered devices are used; the request cannot name a recipient,
// endpoint or other user. Responses never include endpoints, device keys or private keys.

const DAILY_TEST_LIMIT = 5;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Server configuration error" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string" || claimsData?.claims?.role !== "authenticated") return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = status */ }
  const action = body?.action ?? "status";
  if (action !== "status" && action !== "send") return json({ error: "Invalid action" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const envPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const diagnostics = await vapidDiagnostics(envPublic, Deno.env.get("VAPID_PRIVATE_KEY"), APP_VAPID_PUBLIC_KEY);

  const { data: subs, error: subsError } = await admin.from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  if (subsError) return json({ error: "Could not read registered devices" }, 500);
  const devices = (subs || []).map((s, i) => ({ device: i + 1, service: pushServiceName(s.endpoint), registeredOn: String(s.created_at || "").slice(0, 10) }));
  const today = israelClock(new Date()).date;
  const { data: recent } = await admin.from("notification_deliveries")
    .select("created_at, kind, status, devices_found, provider_accepted, provider_expired, provider_rejected, last_error")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(5);

  const config = {
    vapid: diagnostics,
    // Public application server key (safe to share) for explicit re-registration.
    publicKey: diagnostics.publicKeyFormatValid ? envPublic : null,
    devices,
    recent: recent || [],
  };
  if (action === "status") return json({ ok: true, ...config });

  // ---- explicit user-scoped server test ----
  if (!diagnostics.configured || !diagnostics.pairValid) return json({ ok: false, sent: false, error: diagnostics.configured ? "vapid_pair_invalid" : "vapid_missing", ...config }, 409);
  if (!subs?.length) return json({ ok: false, sent: false, error: "no_subscription", ...config }, 409);

  const { count } = await admin.from("notification_deliveries").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("kind", "push_test").gte("created_at", israelDayStartUtc(today).toISOString());
  if ((count || 0) >= DAILY_TEST_LIMIT) return json({ ok: false, sent: false, error: "daily_test_limit", ...config }, 429);
  // At most one test per minute, enforced atomically by the unique identity.
  const minuteKey = new Date().toISOString().slice(0, 16);
  const { data: claim, error: claimError } = await admin.rpc("claim_notification_delivery", {
    p_user_id: userId, p_kind: "push_test", p_item_key: minuteKey, p_channel: "push", p_batch_id: crypto.randomUUID(), p_lease_seconds: 120, p_max_attempts: 1,
  });
  if (claimError) return json({ error: "Could not record test" }, 500);
  const row = Array.isArray(claim) ? claim[0] : claim;
  if (!row?.delivery_id) return json({ ok: false, sent: false, error: "one_test_per_minute", ...config }, 429);

  const vapid = vapidFromEnv()!;
  const results = await deliverToSubscriptions(admin, subs, {
    title: "Tabro: בדיקת התראה מהשרת",
    body: "אם ההודעה הזו מופיעה במכשיר, התראות Push פועלות.",
    tag: `tabro-server-test-${minuteKey}`,
    url: "/personal",
    icon: "/app-icon.png",
  }, vapid, 600);
  const summary = summarizePushResults(results);
  const firstFailure = results.find(r => r.outcome !== "accepted");
  await admin.from("notification_deliveries").update({
    status: summary.providerAccepted > 0 ? "accepted" : "failed",
    retryable: false,
    lease_until: null,
    devices_found: summary.devicesFound,
    provider_accepted: summary.providerAccepted,
    provider_expired: summary.expired,
    provider_rejected: summary.rejected + summary.retryable,
    provider_status: firstFailure?.status ?? results[0]?.status ?? null,
    last_error: firstFailure ? `${firstFailure.outcome}:${firstFailure.reason || firstFailure.status}` : null,
    accepted_at: summary.providerAccepted > 0 ? new Date().toISOString() : null,
  }).eq("id", row.delivery_id).eq("user_id", userId);

  return json({
    ok: true,
    sent: summary.providerAccepted > 0,
    summary,
    results,
    // Push-service acceptance is not proof the device displayed the notification.
    note: "provider_acceptance_is_not_display_confirmation",
    vapid: diagnostics,
    publicKey: config.publicKey,
  });
});
