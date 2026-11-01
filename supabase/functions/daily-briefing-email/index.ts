import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { israelDate } from "../_shared/dailyBriefing.ts";
import { buildReport } from "./report.ts";
import {
  BRIEFING_MAX_ATTEMPTS, BRIEFING_SLOTS, BRIEFING_TEST_LIMIT_PER_DAY, briefingSkipReason, dueBriefingSlot, exceedsDailyLimit,
  israelDayStartUtc, isRetryableProviderStatus, normalizeBriefingSettings, type BriefingSkipReason, type BriefingSlot,
} from "../_shared/briefingSchedule.ts";
import { buildBriefingPdf } from "../_shared/briefingPdf.ts";
import { hasSchedulerToken } from "../_shared/schedulerAuth.ts";
import { briefingSubject, buildBriefingEmail } from "./emailContent.ts";

// Personal daily briefing emails (08:00 / 16:00 Asia/Jerusalem).
// - Scheduler calls must carry the server-only scheduler token.
// - Signed-in users may only send a test to their own verified address.
// There is no request shape that lets a caller choose another recipient or user.

const FROM = "Tabro <noreply@tabro.org>";
const REPLY_TO = "info@tabro.org";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";
const DIRECT_URL = "https://api.resend.com/emails";
const LEASE_SECONDS = 300;
const TICK_BUDGET_MS = 110_000;

// deno-lint-ignore no-explicit-any
type Admin = any;
type Outcome = "accepted" | "skipped" | "failed" | "busy";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Server configuration error" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  try {
    if (req.headers.get("x-scheduler-token")) {
      if (!(await hasSchedulerToken(req, admin, "daily_briefing"))) return json({ error: "Unauthorized" }, 401);
      // A dry run may evaluate another instant (for schedule checks) but never sends.
      const dryRun = body.dryRun === true;
      const at = dryRun && typeof body.at === "string" ? new Date(body.at) : new Date();
      if (Number.isNaN(at.getTime())) return json({ error: "Invalid time" }, 400);
      return json(await dispatch(admin, url, at, dryRun));
    }

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data, error } = await userClient.auth.getClaims(auth.slice(7));
    const userId = data?.claims?.sub;
    if (error || typeof userId !== "string" || data?.claims?.role !== "authenticated") return json({ error: "Unauthorized" }, 401);
    if (body.action !== "test") return json({ error: "Unsupported action" }, 400);
    const slot = body.slot === "morning" || body.slot === "afternoon" ? body.slot as BriefingSlot : null;
    if (!slot) return json({ error: "Invalid slot" }, 400);
    return await sendTest(admin, url, userId, slot);
  } catch (error) {
    console.error("daily-briefing-email error", error instanceof Error ? error.message : String(error));
    return json({ error: "Internal error" }, 500);
  }
});

async function dispatch(admin: Admin, supabaseUrl: string, now: Date, dryRun: boolean) {
  const due = dueBriefingSlot(now);
  if (!due) return { due: null };
  const { data: rows, error } = await admin.from("user_preferences")
    .select("user_id, notification_settings")
    .filter("notification_settings->dailyBriefingEmail->>enabled", "eq", "true")
    .limit(1000);
  if (error) throw new Error(`preferences: ${error.message}`);
  const summary = { due, candidates: rows?.length || 0, accepted: 0, skipped: 0, failed: 0, busy: 0, deferred: 0, dryRun };
  if (dryRun) return summary;
  const started = Date.now();
  for (const row of rows || []) {
    if (Date.now() - started > TICK_BUDGET_MS) { summary.deferred++; continue; }
    try {
      summary[await processScheduled(admin, supabaseUrl, row.user_id, row.notification_settings, due.slot, due.date, now)]++;
    } catch (err) {
      summary.failed++;
      console.error("briefing user failed", row.user_id, err instanceof Error ? err.message : String(err));
    }
  }
  console.log("daily briefing tick", JSON.stringify(summary));
  return summary;
}

async function recordSkip(admin: Admin, userId: string, date: string, slot: BriefingSlot, reason: BriefingSkipReason) {
  const { error } = await admin.from("daily_briefing_deliveries").insert({
    user_id: userId, local_date: date, slot, kind: "scheduled", status: "skipped", retryable: false,
    idempotency_key: `tabro-briefing/${userId}/${date}/${slot}`, last_error: reason,
  });
  if (error && error.code !== "23505") console.error("record skip failed", error.message);
}

async function processScheduled(admin: Admin, supabaseUrl: string, userId: string, settings: unknown, slot: BriefingSlot, date: string, now: Date): Promise<Outcome> {
  const reason = briefingSkipReason(settings, slot);
  if (reason) {
    if (reason !== "slot_disabled" && reason !== "not_opted_in") await recordSkip(admin, userId, date, slot, reason);
    return "skipped";
  }
  const { data, error } = await admin.rpc("claim_daily_briefing", {
    p_user_id: userId, p_local_date: date, p_slot: slot, p_lease_seconds: LEASE_SECONDS, p_max_attempts: BRIEFING_MAX_ATTEMPTS,
  });
  if (error) throw new Error(`claim: ${error.message}`);
  const claim = Array.isArray(data) ? data[0] : null;
  // Already accepted, being sent by another tick, skipped, or out of attempts.
  if (!claim) return "busy";
  return await deliver(admin, supabaseUrl, { userId, slot, date, now, settings, deliveryId: claim.delivery_id, idempotencyKey: claim.idem_key, test: false });
}

async function sendTest(admin: Admin, supabaseUrl: string, userId: string, slot: BriefingSlot) {
  const now = new Date();
  const { count, error: countError } = await admin.from("daily_briefing_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("kind", "test").gte("created_at", new Date(now.getTime() - 86400000).toISOString());
  if (countError) throw new Error(`test count: ${countError.message}`);
  if ((count || 0) >= BRIEFING_TEST_LIMIT_PER_DAY) return json({ error: "test_limit", message: `אפשר לשלוח עד ${BRIEFING_TEST_LIMIT_PER_DAY} מיילי בדיקה ב־24 שעות.` }, 429);
  const { data: prefs } = await admin.from("user_preferences").select("notification_settings").eq("user_id", userId).maybeSingle();
  const date = israelDate(now);
  const { data: row, error } = await admin.from("daily_briefing_deliveries").insert({
    user_id: userId, local_date: date, slot, kind: "test", status: "sending", attempts: 1,
    lease_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString(),
    idempotency_key: `tabro-briefing-test/${userId}/${crypto.randomUUID()}`,
  }).select("id, idempotency_key").single();
  if (error) throw new Error(`test row: ${error.message}`);
  const outcome = await deliver(admin, supabaseUrl, { userId, slot, date, now, settings: prefs?.notification_settings, deliveryId: row.id, idempotencyKey: row.idempotency_key, test: true });
  const { data: result } = await admin.from("daily_briefing_deliveries")
    .select("status, provider_message_id, provider_status, last_error, item_counts, pdf_pages").eq("id", row.id).single();
  return json({ outcome, delivery: result }, outcome === "accepted" ? 200 : 502);
}

interface DeliverInput { userId: string; slot: BriefingSlot; date: string; now: Date; settings: unknown; deliveryId: string; idempotencyKey: string; test: boolean }

async function finish(admin: Admin, id: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("daily_briefing_deliveries").update({ ...patch, lease_until: null }).eq("id", id);
  if (error) console.error("finish delivery failed", id, error.message);
}

async function deliver(admin: Admin, supabaseUrl: string, input: DeliverInput): Promise<Outcome> {
  const { userId, slot, date, now, deliveryId, test } = input;
  const notificationSettings = (input.settings && typeof input.settings === "object" ? input.settings : {}) as Record<string, any>;
  const briefing = normalizeBriefingSettings(notificationSettings.dailyBriefingEmail);
  const skip = async (reason: BriefingSkipReason): Promise<Outcome> => {
    await finish(admin, deliveryId, { status: "skipped", retryable: false, last_error: reason });
    return "skipped";
  };

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError) {
    await finish(admin, deliveryId, { status: "failed", retryable: true, last_error: "account lookup failed" });
    return "failed";
  }
  const email = userData?.user?.email?.trim().toLowerCase();
  if (!email || !userData.user.email_confirmed_at) return await skip("no_verified_email");
  const { data: suppressed, error: suppressedError } = await admin.from("suppressed_emails").select("id").eq("email", email).limit(1);
  if (suppressedError) {
    await finish(admin, deliveryId, { status: "failed", retryable: true, last_error: "suppression check failed" });
    return "failed";
  }
  if (suppressed?.length) return await skip("suppressed");
  if (!test && typeof notificationSettings.dailyLimit === "number" && notificationSettings.dailyLimit > 0) {
    const { count } = await admin.from("sent_notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("channel", "email").gte("created_at", israelDayStartUtc(date).toISOString());
    if (exceedsDailyLimit(notificationSettings.dailyLimit, count || 0)) return await skip("daily_limit");
  }

  let report;
  try {
    report = await buildReport(admin, userId, slot, now, notificationSettings, briefing);
  } catch (err) {
    // Never send a partial, misleading briefing.
    await finish(admin, deliveryId, { status: "failed", retryable: true, last_error: `data load failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) });
    return "failed";
  }
  if (!test && slot === "afternoon" && report.items.length === 0) return await skip("nothing_remaining");

  let pdf: { bytes: Uint8Array; pages: number } | null = null;
  if (briefing.attachPdf || test) {
    try {
      pdf = await buildBriefingPdf({ ...report, generatedAt: now });
      if (pdf.bytes.length < 1000 || pdf.pages < 1) throw new Error("empty pdf");
    } catch (err) {
      await finish(admin, deliveryId, { status: "failed", retryable: false, last_error: `pdf generation failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) });
      return "failed";
    }
  }

  const unsubscribeToken = await getUnsubscribeToken(admin, email);
  const unsubscribeUrl = unsubscribeToken ? `https://tabro.org/unsubscribe?token=${unsubscribeToken}` : null;
  const content = buildBriefingEmail(report, { test, pdfAttached: Boolean(pdf), unsubscribeUrl });
  const payload: Record<string, unknown> = {
    from: FROM, reply_to: REPLY_TO, to: [email], subject: briefingSubject(report, test), html: content.html, text: content.text,
    tags: [{ name: "category", value: "daily_briefing" }, { name: "slot", value: slot }],
  };
  if (unsubscribeToken) {
    payload.headers = {
      "List-Unsubscribe": `<${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${unsubscribeToken}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  if (pdf) payload.attachments = [{ filename: `tabro-briefing-${date}-${slot}.pdf`, content: toBase64(pdf.bytes), content_type: "application/pdf" }];

  const counts = { ...report.counts, items: report.items.length };
  const result = await sendViaResend(payload, input.idempotencyKey);
  if (result.ok) {
    await finish(admin, deliveryId, { status: "accepted", retryable: false, provider_message_id: result.id, provider_status: result.status, last_error: null, item_counts: counts, pdf_pages: pdf?.pages ?? null, accepted_at: new Date().toISOString() });
    if (!test) await admin.from("sent_notifications").insert({ user_id: userId, notification_type: `daily_briefing_${slot}`, channel: "email" });
    await admin.from("email_send_log").insert({ message_id: result.id, template_name: test ? "daily_briefing_test" : "daily_briefing", recipient_email: email, status: "sent", metadata: { slot, provider: "resend", pdf_pages: pdf?.pages ?? null, counts } });
    console.log("briefing accepted", userId, slot, result.id);
    return "accepted";
  }
  const duplicate = result.status === 422 && /idempot/i.test(result.error);
  await finish(admin, deliveryId, {
    status: duplicate ? "duplicate_suppressed" : "failed",
    retryable: !duplicate && !test && isRetryableProviderStatus(result.status),
    provider_status: result.status, last_error: result.error.slice(0, 500), item_counts: counts, pdf_pages: pdf?.pages ?? null,
  });
  await admin.from("email_send_log").insert({ message_id: null, template_name: test ? "daily_briefing_test" : "daily_briefing", recipient_email: email, status: "failed", error_message: `[${result.status}] ${result.error.slice(0, 300)}`, metadata: { slot } });
  console.error("briefing provider failure", userId, slot, result.status);
  return duplicate ? "busy" : "failed";
}

async function getUnsubscribeToken(admin: Admin, email: string): Promise<string | null> {
  const { data: existing, error } = await admin.from("email_unsubscribe_tokens").select("token, used_at").eq("email", email).maybeSingle();
  if (error) return null;
  if (existing) return existing.used_at ? null : existing.token;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  await admin.from("email_unsubscribe_tokens").upsert({ token, email }, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await admin.from("email_unsubscribe_tokens").select("token, used_at").eq("email", email).maybeSingle();
  return stored && !stored.used_at ? stored.token : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function sendViaResend(payload: Record<string, unknown>, idempotencyKey: string): Promise<{ ok: true; id: string; status: number } | { ok: false; status: number; error: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { ok: false, status: 500, error: "Email provider is not configured" };
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey };
  if (lovableKey) {
    headers.Authorization = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = resendKey;
  } else {
    headers.Authorization = `Bearer ${resendKey}`;
  }
  let response: Response;
  try {
    response = await fetch(lovableKey ? GATEWAY_URL : DIRECT_URL, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    return { ok: false, status: 0, error: `network error: ${err instanceof Error ? err.message : String(err)}` };
  }
  const text = await response.text();
  if (!response.ok) return { ok: false, status: response.status, error: text || response.statusText };
  try {
    const id = JSON.parse(text)?.id;
    if (typeof id === "string" && id) return { ok: true, id, status: response.status };
  } catch { /* fall through */ }
  // Accepted status without an id: retry with the same idempotency key to learn the id.
  return { ok: false, status: 502, error: "provider response did not include a message id" };
}
