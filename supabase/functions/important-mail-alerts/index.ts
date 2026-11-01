import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-token",
};
import { hasSchedulerToken } from "../_shared/schedulerAuth.ts";
import { israelClock, israelDayStartUtc, isRetryableProviderStatus } from "../_shared/briefingSchedule.ts";
import { syncGmailConnection } from "../_shared/gmailSync.ts";
import {
  ALERT_MAX_AGE_MS, ALERT_MAX_ITEMS_PER_BATCH, alertItemKey, importantMailChannelPlan, importantMailDecision,
  importantMailPushPayload, normalizeImportantMailAlerts, normalizeMailPreferences,
} from "../_shared/importantMailAlerts.ts";
import { summarizePushResults } from "../_shared/pushDiagnostics.ts";
import { deliverToSubscriptions, vapidFromEnv } from "../_shared/webPush.ts";
import { buildImportantMailEmail } from "./emailContent.ts";

// Scheduled (cron-only) alerts for important NEW Gmail messages of users who opted in.
// - Read-only Gmail metadata sync (no send/delete/label changes), no AI calls.
// - Each message/channel identity is claimed in the database before any provider call.
// - Lock-screen text is generic; the email channel lists sender/subject metadata only.

const FROM = "Tabro <noreply@tabro.org>";
const REPLY_TO = "info@tabro.org";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";
const DIRECT_URL = "https://api.resend.com/emails";
const TICK_BUDGET_MS = 100_000;
const TERMINAL = new Set(["accepted", "skipped"]);

// deno-lint-ignore no-explicit-any
type Admin = any;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await hasSchedulerToken(req, admin, "important_mail"))) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cron body is optional */ }
  const dryRun = body?.dryRun === true;
  const started = Date.now();
  const now = new Date();
  const clock = israelClock(now);
  const dayStart = israelDayStartUtc(clock.date).toISOString();

  const { data: prefRows, error: prefError } = await admin.from("user_preferences")
    .select("user_id, notification_settings")
    .filter("notification_settings->importantMailAlerts->>enabled", "eq", "true")
    .limit(200);
  if (prefError) return json({ error: "Could not read preferences" }, 500);

  const report = { users: 0, synced: 0, syncErrors: [] as string[], important: 0, deferred: 0, claimed: 0, pushAccepted: 0, pushNoDevice: 0, pushFailed: 0, emailAccepted: 0, emailFailed: 0, dryRun };
  for (const row of prefRows || []) {
    if (Date.now() - started > TICK_BUDGET_MS) break;
    const settings = row.notification_settings || {};
    const alerts = normalizeImportantMailAlerts(settings.importantMailAlerts);
    if (!alerts.enabled) continue;
    report.users++;
    try {
      await processUser(admin, row.user_id, settings, alerts, { now, clock, dayStart, dryRun, report });
    } catch (err) {
      console.error("important-mail user failed:", err instanceof Error ? err.message : "unknown");
    }
  }
  return json({ ok: true, ...report });
});

interface Ctx { now: Date; clock: { date: string; minutes: number }; dayStart: string; dryRun: boolean; report: Record<string, any> }

async function processUser(admin: Admin, userId: string, settings: Record<string, any>, alerts: ReturnType<typeof normalizeImportantMailAlerts>, ctx: Ctx) {
  const { report } = ctx;
  // 1) Read-only sync of recent Gmail metadata (only messages not stored yet).
  const { data: conns } = await admin.from("email_connections")
    .select("id, user_id, provider, access_token, refresh_token, settings")
    .eq("user_id", userId).eq("provider", "gmail");
  for (const conn of conns || []) {
    const result = await syncGmailConnection(admin, conn, { query: "newer_than:1d -in:spam -in:trash", maxResults: 25, onlyNew: true }, {
      clientId: Deno.env.get("GOOGLE_CLIENT_ID"), clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
    });
    if (result.ok) {
      report.synced++;
      await admin.from("email_connections").update({ last_sync: new Date().toISOString() }).eq("id", conn.id).eq("user_id", userId);
    } else {
      report.syncErrors.push(result.error || `failed_writes:${result.failed}`);
    }
  }

  // 2) Candidate messages: received after opt-in and within the freshness window.
  const sinceMs = Math.max(Date.parse(alerts.since!), ctx.now.getTime() - ALERT_MAX_AGE_MS);
  const { data: mails, error: mailError } = await admin.from("email_analyses")
    .select("connection_id, external_message_id, email_subject, email_from, email_date, category")
    .eq("user_id", userId).not("external_message_id", "is", null)
    .gte("email_date", new Date(sinceMs).toISOString())
    .order("email_date", { ascending: false }).limit(100);
  if (mailError) throw new Error("candidate read failed");
  const prefs = normalizeMailPreferences(settings.emailTriage);
  const important = (mails || []).filter((m: any) => importantMailDecision(m, prefs, alerts, ctx.now.getTime()).alert);
  if (!important.length) return;

  // Skip identities that already reached a terminal state, to avoid needless claims.
  const keys = important.map((m: any) => alertItemKey(m.connection_id, m.external_message_id));
  const { data: done } = await admin.from("notification_deliveries").select("item_key, channel, status, retryable")
    .eq("user_id", userId).eq("kind", "important_mail").in("item_key", keys);
  const finished = new Set((done || []).filter((d: any) => TERMINAL.has(d.status) || (d.status === "failed" && !d.retryable)).map((d: any) => `${d.channel}|${d.item_key}`));

  const { data: todays } = await admin.from("notification_deliveries").select("batch_id")
    .eq("user_id", userId).eq("kind", "important_mail").eq("status", "accepted").gte("accepted_at", ctx.dayStart);
  const batchesToday = new Set((todays || []).map((r: any) => r.batch_id)).size;
  const plan = importantMailChannelPlan(settings, ctx.clock.minutes, batchesToday);
  const pending = (channel: string) => important.filter((m: any) => !finished.has(`${channel}|${alertItemKey(m.connection_id, m.external_message_id)}`));
  report.important += Math.max(pending("push").length, pending("email").length);
  if (plan.deferred) { report.deferred++; return; }
  if (ctx.dryRun) return;

  const batchId = crypto.randomUUID();
  let firstAttemptClaim = false;
  for (const channel of ["push", "email"] as const) {
    if (!plan[channel]) continue;
    const claimed: { id: string; attempt: number; mail: any }[] = [];
    for (const mail of pending(channel).slice(0, ALERT_MAX_ITEMS_PER_BATCH)) {
      const { data, error } = await admin.rpc("claim_notification_delivery", {
        p_user_id: userId, p_kind: "important_mail", p_item_key: alertItemKey(mail.connection_id, mail.external_message_id),
        p_channel: channel, p_batch_id: batchId, p_lease_seconds: 300, p_max_attempts: 3,
      });
      const claimRow = Array.isArray(data) ? data[0] : data;
      if (!error && claimRow?.delivery_id) claimed.push({ id: claimRow.delivery_id, attempt: claimRow.attempt, mail });
    }
    if (!claimed.length) continue;
    report.claimed += claimed.length;
    if (claimed.some(c => c.attempt === 1)) firstAttemptClaim = true;
    const ids = claimed.map(c => c.id);
    const finish = (patch: Record<string, unknown>) =>
      admin.from("notification_deliveries").update({ lease_until: null, ...patch }).in("id", ids).eq("user_id", userId);

    if (channel === "push") {
      const vapid = vapidFromEnv();
      const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, created_at").eq("user_id", userId);
      if (!vapid) { await finish({ status: "failed", retryable: true, last_error: "vapid_missing" }); report.pushFailed++; continue; }
      if (!subs?.length) { await finish({ status: "skipped", retryable: false, devices_found: 0, last_error: "no_subscription" }); report.pushNoDevice++; continue; }
      const results = await deliverToSubscriptions(admin, subs, importantMailPushPayload(claimed.length), vapid, 3600);
      const s = summarizePushResults(results);
      const first = results.find(r => r.outcome !== "accepted");
      const base = { devices_found: s.devicesFound, provider_accepted: s.providerAccepted, provider_expired: s.expired, provider_rejected: s.rejected, provider_status: first?.status ?? results[0]?.status ?? null, last_error: first ? `${first.outcome}:${first.reason || first.status}` : null };
      if (s.providerAccepted > 0) { await finish({ ...base, status: "accepted", accepted_at: new Date().toISOString() }); report.pushAccepted++; }
      else if (s.retryable > 0) { await finish({ ...base, status: "failed", retryable: true }); report.pushFailed++; }
      else { await finish({ ...base, status: s.expired === s.devicesFound ? "skipped" : "failed", retryable: false }); report.pushFailed++; }
    } else {
      const outcome = await sendAlertEmail(admin, userId, claimed.map(c => c.mail), `tabro-important-mail/${userId}/${ids.slice().sort().join(",").slice(0, 200)}`);
      if (outcome.ok) { await finish({ status: "accepted", provider_status: outcome.status, provider_message_id: outcome.id, accepted_at: new Date().toISOString(), last_error: null }); report.emailAccepted++; }
      else { await finish({ status: outcome.skip ? "skipped" : "failed", retryable: !outcome.skip && isRetryableProviderStatus(outcome.status), provider_status: outcome.status, last_error: outcome.error.slice(0, 200) }); report.emailFailed++; }
    }
  }

  // In-app bell record: says an alert was prepared, not that any device displayed it.
  if (firstAttemptClaim) {
    await admin.from("sent_notifications").insert({ user_id: userId, notification_type: "important_mail", channel: "in_app" });
  }
}

type EmailOutcome = { ok: true; id: string; status: number } | { ok: false; skip: boolean; status: number; error: string };

async function sendAlertEmail(admin: Admin, userId: string, mails: any[], idempotencyKey: string): Promise<EmailOutcome> {
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const email = userData?.user?.email_confirmed_at ? userData.user.email : null;
  if (!email) return { ok: false, skip: true, status: 0, error: "no_verified_email" };
  const { data: suppressed } = await admin.from("suppressed_emails").select("id").eq("email", String(email).toLowerCase()).limit(1);
  if (suppressed?.length) return { ok: false, skip: true, status: 0, error: "suppressed" };
  const resendKey = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { ok: false, skip: false, status: 500, error: "email_provider_not_configured" };
  const content = buildImportantMailEmail(mails);
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey };
  if (lovableKey) { headers.Authorization = `Bearer ${lovableKey}`; headers["X-Connection-Api-Key"] = resendKey; }
  else headers.Authorization = `Bearer ${resendKey}`;
  let res: Response;
  try {
    res = await fetch(lovableKey ? GATEWAY_URL : DIRECT_URL, {
      method: "POST", headers, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [email], subject: content.subject, html: content.html, text: content.text }),
    });
  } catch {
    return { ok: false, skip: false, status: 0, error: "network_error" };
  }
  const text = await res.text();
  if (!res.ok) { console.error(`important-mail email rejected [${res.status}]`); return { ok: false, skip: false, status: res.status, error: `provider_${res.status}` }; }
  try {
    const id = JSON.parse(text)?.id;
    if (typeof id === "string" && id) {
      await admin.from("email_send_log").insert({ message_id: id, template_name: "important_mail_alert", recipient_email: email, status: "sent", metadata: { count: mails.length } });
      return { ok: true, id, status: res.status };
    }
  } catch { /* malformed provider response */ }
  return { ok: false, skip: false, status: 502, error: "provider_response_without_id" };
}
