import { createClient } from "npm:@supabase/supabase-js@2";
import { hasSchedulerToken } from "../_shared/schedulerAuth.ts";
import { israelClock, israelDayStartUtc, isRetryableProviderStatus } from "../_shared/briefingSchedule.ts";
import { summarizePushResults } from "../_shared/pushDiagnostics.ts";
import { deliverToSubscriptions, vapidFromEnv, type StoredSubscription } from "../_shared/webPush.ts";
import {
  COMPLETION_WINDOW_MS, DEADLINE_WINDOW, MORNING_WINDOW, PLANNER_KINDS, PLANNER_LEASE_SECONDS, PLANNER_MAX_ATTEMPTS,
  REMINDER_LOOKAHEAD_MS, deliveryFinished, dueCompletion, dueReminder, escapeHtml, inWindow, legacyReminderType, nextLocalDate,
  plannerChannelAllowed, pushFinish, reminderOffsets, remainingLabel,
  type PlannerChannel, type PlannerKind,
} from "../_shared/plannerReminders.ts";

// Scheduler-only (cron, every minute) planner notifications: event reminders at the
// user's saved offsets, completion check-ins, morning summary and next-day deadlines.
// Each user/item/channel is claimed in notification_deliveries before any provider call,
// so overlapping or retried ticks never duplicate and failed channels retry on their own.
// Responses and logs contain only allowlisted counts — no titles, emails or endpoints.

const VERSION = "planner-2026-11-02";
// Records written by the pre-ledger sender (before this instant) still count as sent.
const LEDGER_START = "2026-11-02T09:50:00Z";
const FROM = "Tabro <noreply@tabro.org>";
const REPLY_TO = "info@tabro.org";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";
const DIRECT_URL = "https://api.resend.com/emails";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-token",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

// deno-lint-ignore no-explicit-any
type Admin = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

interface Candidate {
  userId: string;
  kind: PlannerKind;
  itemKey: string;
  event?: Row;
  offset?: number;
  remainingMinutes?: number;
  legacyType: string;
}

const report = () => ({
  ok: true, version: VERSION, candidates: 0, claimed: 0, alreadyHandled: 0, blockedByPreferences: 0,
  pushAccepted: 0, pushNoDevice: 0, pushFailed: 0, emailAccepted: 0, emailSkipped: 0, emailFailed: 0,
  // legacy fields kept for existing dashboards
  pushSent: 0, emailsSent: 0,
});

const israelTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Scheduler-only endpoint: it reads every user's events and sends mail/push.
  if (!(await hasSchedulerToken(req, admin, "notifications"))) return json({ error: "Unauthorized" }, 401);

  try {
    return json(await runTick(admin, supabaseUrl, new Date()));
  } catch (err) {
    console.error("planner notifications failed:", err instanceof Error ? err.message.slice(0, 200) : "unknown");
    return json({ ok: false, version: VERSION, error: "internal_error" }, 500);
  }
});

async function runTick(admin: Admin, supabaseUrl: string, now: Date) {
  const out = report();
  const nowMs = now.getTime();
  const clock = israelClock(now);
  const dayStart = israelDayStartUtc(clock.date).toISOString();
  const candidates: Candidate[] = [];

  const cols = "id, user_id, title, category, description, start_time, end_time, all_day, source_type, source_id";
  const [{ data: upcoming, error: upErr }, { data: ended, error: endErr }] = await Promise.all([
    admin.from("calendar_events").select(cols).gt("start_time", now.toISOString())
      .lte("start_time", new Date(nowMs + REMINDER_LOOKAHEAD_MS).toISOString()).limit(2000),
    admin.from("calendar_events").select(cols).gte("end_time", new Date(nowMs - COMPLETION_WINDOW_MS).toISOString())
      .lte("end_time", now.toISOString()).limit(2000),
  ]);
  if (upErr || endErr) throw new Error("event_query_failed");

  const userIds = new Set<string>([...(upcoming || []), ...(ended || [])].map((e: Row) => e.user_id));
  const morning = inWindow(clock.minutes, MORNING_WINDOW);
  const deadline = inWindow(clock.minutes, DEADLINE_WINDOW);
  if (morning || deadline) {
    const { data: subOwners } = await admin.from("push_subscriptions").select("user_id").limit(5000);
    for (const s of subOwners || []) userIds.add(s.user_id);
  }
  if (!userIds.size) return out;

  const ids = [...userIds];
  const { data: prefRows } = await admin.from("user_preferences").select("user_id, notification_settings").in("user_id", ids);
  const prefs = new Map<string, unknown>((prefRows || []).map((r: Row) => [r.user_id, r.notification_settings]));

  for (const event of upcoming || []) {
    const due = dueReminder(event as never, nowMs, reminderOffsets(prefs.get(event.user_id)));
    if (due) candidates.push({ userId: event.user_id, kind: "planner_reminder", itemKey: due.itemKey, event, offset: due.offset, remainingMinutes: due.remainingMinutes, legacyType: legacyReminderType(due.offset) });
  }
  for (const event of ended || []) {
    const due = dueCompletion(event as never, nowMs);
    if (due) candidates.push({ userId: event.user_id, kind: "planner_completion", itemKey: due.itemKey, event, legacyType: "event_completion" });
  }
  if (morning || deadline) {
    const kind: PlannerKind = morning ? "planner_morning" : "planner_deadline";
    for (const userId of ids) candidates.push({ userId, kind, itemKey: clock.date, legacyType: morning ? "morning_summary" : "deadline_reminder" });
  }
  out.candidates = candidates.length;
  if (!candidates.length) return out;

  // Skip identities already finished on a channel without touching the ledger.
  const { data: done } = await admin.from("notification_deliveries").select("user_id, kind, item_key, channel, status, retryable, attempts")
    .in("user_id", [...new Set(candidates.map(c => c.userId))]).in("kind", PLANNER_KINDS)
    .in("item_key", [...new Set(candidates.map(c => c.itemKey))]);
  const finished = new Set((done || [])
    .filter((d: Row) => deliveryFinished(d as never))
    .map((d: Row) => `${d.user_id}|${d.kind}|${d.item_key}|${d.channel}`));

  // Transition guard: honour very recent legacy records (written before the ledger existed).
  const eventIds = [...new Set(candidates.filter(c => c.event).map(c => c.event!.id))];
  if (eventIds.length) {
    const { data: legacy } = await admin.from("sent_notifications").select("user_id, event_id, notification_type, channel")
      .in("event_id", eventIds).gte("created_at", new Date(nowMs - 70 * 60_000).toISOString()).lt("created_at", LEDGER_START);
    for (const l of legacy || []) {
      for (const c of candidates) {
        if (c.event?.id === l.event_id && c.userId === l.user_id && c.legacyType === l.notification_type) finished.add(`${c.userId}|${c.kind}|${c.itemKey}|${l.channel}`);
      }
    }
  }

  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, created_at")
    .in("user_id", [...new Set(candidates.map(c => c.userId))]);
  const subsByUser = new Map<string, StoredSubscription[]>();
  for (const s of subs || []) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) || []), s]);

  const ctx = new TickContext(admin, supabaseUrl, dayStart, clock.date);
  const vapid = vapidFromEnv();

  for (const c of candidates) {
    for (const channel of ["push", "email"] as PlannerChannel[]) {
      if (finished.has(`${c.userId}|${c.kind}|${c.itemKey}|${channel}`)) { out.alreadyHandled++; continue; }
      const settings = prefs.get(c.userId) as Row | undefined;
      const limited = typeof settings?.dailyLimit === "number" && settings.dailyLimit > 0;
      const acceptedToday = limited ? await ctx.acceptedToday(c.userId, channel) : 0;
      if (!plannerChannelAllowed(settings, c.kind, channel, { israelMinutes: clock.minutes, acceptedToday })) { out.blockedByPreferences++; continue; }
      // No device / no verified email: nothing is claimed, so a device added later still gets it.
      if (channel === "push" && !(subsByUser.get(c.userId) || []).length) { out.pushNoDevice++; continue; }
      if (channel === "email" && !(await ctx.email(c.userId))) { out.emailSkipped++; continue; }

      const { data: claim, error } = await admin.rpc("claim_notification_delivery", {
        p_user_id: c.userId, p_kind: c.kind, p_item_key: c.itemKey, p_channel: channel,
        p_batch_id: crypto.randomUUID(), p_lease_seconds: PLANNER_LEASE_SECONDS, p_max_attempts: PLANNER_MAX_ATTEMPTS,
      });
      const row = Array.isArray(claim) ? claim[0] : null;
      if (error || !row?.delivery_id) { out.alreadyHandled++; continue; }
      out.claimed++;
      const finish = (patch: Row) => admin.from("notification_deliveries").update({ lease_until: null, ...patch })
        .eq("id", row.delivery_id).eq("user_id", c.userId);

      const content = await buildContent(ctx, c, now);
      if (!content) { await finish({ status: "skipped", retryable: false, last_error: "nothing_to_send" }); out.alreadyHandled++; continue; }

      if (channel === "push") {
        if (!vapid) { await finish({ status: "failed", retryable: true, last_error: "vapid_missing" }); out.pushFailed++; continue; }
        const results = await deliverToSubscriptions(admin, subsByUser.get(c.userId)!, content.push, vapid, content.ttl);
        const s = summarizePushResults(results);
        const first = results.find(r => r.outcome !== "accepted");
        const outcome = pushFinish(s);
        await finish({
          ...outcome, devices_found: s.devicesFound, provider_accepted: s.providerAccepted, provider_expired: s.expired,
          provider_rejected: s.rejected, provider_status: first?.status ?? results[0]?.status ?? null,
          last_error: first ? `${first.outcome}:${first.reason || first.status}` : null,
          accepted_at: outcome.status === "accepted" ? new Date().toISOString() : null,
        });
        if (outcome.status === "accepted") { out.pushAccepted++; out.pushSent++; await ctx.accepted(c, "push"); }
        else out.pushFailed++;
      } else {
        const result = await sendEmail(ctx, c.userId, content.subject, content.html, `tabro-planner/${row.delivery_id}`);
        if (result.ok) {
          await finish({ status: "accepted", retryable: false, provider_status: result.status, provider_message_id: result.id, accepted_at: new Date().toISOString(), last_error: null });
          out.emailAccepted++; out.emailsSent++; await ctx.accepted(c, "email");
        } else {
          await finish({ status: "failed", retryable: isRetryableProviderStatus(result.status), provider_status: result.status, last_error: result.error });
          out.emailFailed++;
        }
      }
    }
  }

  // Hourly housekeeping (03:00 Israel): compatibility records and old planner ledger rows.
  if (clock.minutes === 180) {
    await admin.from("sent_notifications").delete().lt("created_at", new Date(nowMs - 7 * 86_400_000).toISOString());
    await admin.from("notification_deliveries").delete().in("kind", PLANNER_KINDS).lt("created_at", new Date(nowMs - 30 * 86_400_000).toISOString());
  }
  if (out.claimed) console.log(`planner tick: claimed=${out.claimed} push=${out.pushAccepted}/${out.pushFailed} email=${out.emailAccepted}/${out.emailFailed}`);
  return out;
}

class TickContext {
  private counts = new Map<string, number>();
  private emails = new Map<string, string | null>();
  private tokens = new Map<string, string | null>();
  constructor(public admin: Admin, public supabaseUrl: string, public dayStart: string, public localDate: string) {}

  async acceptedToday(userId: string, channel: PlannerChannel): Promise<number> {
    const key = `${userId}|${channel}`;
    if (!this.counts.has(key)) {
      const { count } = await this.admin.from("notification_deliveries").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("channel", channel).eq("status", "accepted").in("kind", PLANNER_KINDS).gte("accepted_at", this.dayStart);
      this.counts.set(key, count || 0);
    }
    return this.counts.get(key)!;
  }

  async accepted(c: Candidate, channel: PlannerChannel) {
    const key = `${c.userId}|${channel}`;
    this.counts.set(key, (this.counts.get(key) || 0) + 1);
    // Compatibility record for the in-app bell (not used for deduplication).
    await this.admin.from("sent_notifications").insert({
      user_id: c.userId, event_id: c.event?.id ?? null, notification_type: c.legacyType, channel,
      task_id: c.kind === "planner_completion" ? c.event?.source_id ?? null : null,
    });
  }

  // Verified account email that is not on the suppression list, or null.
  async email(userId: string): Promise<string | null> {
    if (!this.emails.has(userId)) {
      let email: string | null = null;
      try {
        const { data } = await this.admin.auth.admin.getUserById(userId);
        email = data?.user?.email_confirmed_at ? data.user.email : null;
      } catch { email = null; }
      if (email) {
        const { data: suppressed } = await this.admin.from("suppressed_emails").select("id").eq("email", email.toLowerCase()).limit(1);
        if (suppressed?.length) email = null;
      }
      this.emails.set(userId, email);
    }
    return this.emails.get(userId)!;
  }

  // One "mark done" action link per linked task per tick.
  async actionUrl(event: Row): Promise<string | null> {
    const linked = event.source_id && ["recurring_task", "personal_task", "work_task"].includes(event.source_type);
    if (!linked) return null;
    if (!this.tokens.has(event.id)) {
      const { data } = await this.admin.from("action_tokens").insert({
        user_id: event.user_id, task_id: event.source_id, action: "complete",
        source_type: event.source_type === "recurring_task" ? "recurring_task" : "task",
      }).select("id").single();
      this.tokens.set(event.id, data ? `${this.supabaseUrl}/functions/v1/handle-task-action?token=${data.id}` : null);
    }
    return this.tokens.get(event.id)!;
  }
}

interface Content { push: Record<string, unknown>; ttl: number; subject: string; html: string }
const contentCache = new WeakMap<Candidate, Content | null>();

async function buildContent(ctx: TickContext, c: Candidate, now: Date): Promise<Content | null> {
  if (contentCache.has(c)) return contentCache.get(c)!;
  let content: Content | null = null;
  if (c.kind === "planner_reminder") content = await reminderContent(ctx, c, now);
  else if (c.kind === "planner_completion") content = await completionContent(ctx, c);
  else content = await taskSummaryContent(ctx, c);
  contentCache.set(c, content);
  return content;
}

async function reminderContent(ctx: TickContext, c: Candidate, now: Date): Promise<Content> {
  const e: Row = { ...c.event!, title: c.event!.title || "אירוע" };
  // Wording reflects the real remaining time at send moment, not the configured offset.
  const remaining = Math.max(1, Math.round((Date.parse(e.start_time) - now.getTime()) / 60_000));
  const label = remainingLabel(remaining);
  const time = israelTime(e.start_time);
  const action = await ctx.actionUrl(e);
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #eff6ff; border-right: 4px solid #3b82f6; padding: 16px; border-radius: 8px;">
        <h2 style="color: #2563eb; margin: 0 0 8px;">⏰ בעוד ${label}: ${escapeHtml(e.title)}</h2>
        <p style="margin: 4px 0;">🕐 מתחיל ב-<strong>${time}</strong></p>
        ${e.category ? `<p style="margin: 4px 0;">📂 ${escapeHtml(e.category)}</p>` : ""}
        ${e.description ? `<p style="margin: 4px 0; color: #666;">${escapeHtml(e.description)}</p>` : ""}
      </div>
      ${action ? `<div style="margin-top: 16px; text-align: center;"><a href="${escapeHtml(action)}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">✅ סיימתי את המשימה</a></div>` : ""}
      <p style="color: #999; font-size: 11px; margin-top: 12px;">תזכורת אוטומטית ממתכנן הלו״ז שלך · <a href="https://tabro.org/personal" style="color:#999;">הגדרות התראות</a></p>
    </div>`;
  return {
    push: { title: `⏰ בעוד ${label}: ${e.title}`, body: `מתחיל ב-${time}${e.category ? ` | ${e.category}` : ""}`, tag: `reminder-${e.id}`, url: "/personal", icon: "/app-icon.png" },
    ttl: Math.max(60, Math.round((Date.parse(e.start_time) - now.getTime()) / 1000)),
    subject: `⏰ בעוד ${label}: ${e.title}`,
    html,
  };
}

async function completionContent(ctx: TickContext, c: Candidate): Promise<Content | null> {
  const e: Row = { ...c.event!, title: c.event!.title || "אירוע" };
  if (e.source_id && (e.source_type === "personal_task" || e.source_type === "work_task")) {
    const { data } = await ctx.admin.from("tasks").select("status").eq("id", e.source_id).eq("user_id", e.user_id).maybeSingle();
    if (!data || data.status === "בוצע") return null;
  } else if (e.source_id && e.source_type === "recurring_task") {
    const { data } = await ctx.admin.from("recurring_task_completions").select("id").eq("recurring_task_id", e.source_id)
      .eq("completed_date", israelClock(new Date(e.end_time)).date).limit(1);
    if (data?.length) return null;
  }
  const action = await ctx.actionUrl(e);
  const time = israelTime(e.end_time);
  const buttons = action ? `
      <div style="margin-top: 16px; text-align: center;">
        ${[["בוצע", "✅ סיימתי", "#22c55e"], ["בטיפול", "🔄 בטיפול", "#f59e0b"], ["לא התחיל", "⏸️ לא התחלתי", "#ef4444"]].map(([status, text, color]) =>
          `<a href="${escapeHtml(`${action}&status=${encodeURIComponent(status)}`)}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 6px;">${text}</a>`).join("")}
      </div>` : "";
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #f0fdf4; border-right: 4px solid #22c55e; padding: 16px; border-radius: 8px;">
        <h2 style="color: #16a34a; margin: 0 0 8px;">🏁 הזמן של "${escapeHtml(e.title)}" הסתיים</h2>
        <p style="margin: 4px 0;">🕐 היה אמור להסתיים ב-<strong>${time}</strong></p>
        ${e.category ? `<p style="margin: 4px 0;">📂 ${escapeHtml(e.category)}</p>` : ""}
        ${action ? `<p style="margin: 8px 0; font-weight: bold;">מה הסטטוס של המשימה?</p>` : ""}
      </div>${buttons}
      <p style="color: #999; font-size: 11px; margin-top: 12px;">עדכון אוטומטי ממתכנן הלו״ז שלך</p>
    </div>`;
  return {
    push: { title: `🏁 סיימת: ${e.title}?`, body: "הזמן של האירוע הסתיים", tag: `completion-${e.id}`, url: "/personal", icon: "/app-icon.png" },
    ttl: 3600,
    subject: `🏁 סיימת את "${e.title}"? עדכן אותנו`,
    html,
  };
}

// Morning summary / next-day deadlines (push only), using Israel local dates.
async function taskSummaryContent(ctx: TickContext, c: Candidate): Promise<Content | null> {
  const today = ctx.localDate;
  const { data: tasks } = await ctx.admin.from("tasks").select("description, planned_end, urgent, archived")
    .eq("user_id", c.userId).neq("status", "בוצע").limit(1000);
  const open = (tasks || []).filter((t: Row) => t.archived !== true);
  if (c.kind === "planner_morning") {
    const urgent = open.filter((t: Row) => t.urgent).length;
    const overdue = open.filter((t: Row) => t.planned_end && t.planned_end < today).length;
    const dueToday = open.filter((t: Row) => t.planned_end === today).length;
    const parts = [urgent && `🔥 ${urgent} דחופות`, overdue && `⚠️ ${overdue} בחריגה`, dueToday && `📅 ${dueToday} להיום`].filter(Boolean);
    if (!parts.length) return null;
    return { push: { title: "☀️ סיכום בוקר", body: parts.join(" | "), tag: "morning-summary", url: "/personal", icon: "/app-icon.png" }, ttl: 3600, subject: "", html: "" };
  }
  const tomorrow = nextLocalDate(today);
  const dueTomorrow = open.filter((t: Row) => t.planned_end === tomorrow);
  if (!dueTomorrow.length) return null;
  return {
    push: { title: `📆 ${dueTomorrow.length} משימות מגיעות מחר`, body: dueTomorrow.slice(0, 3).map((t: Row) => t.description).filter(Boolean).join(", "), tag: "deadline-reminder", url: "/personal", icon: "/app-icon.png" },
    ttl: 3600, subject: "", html: "",
  };
}

type EmailResult = { ok: true; id: string; status: number } | { ok: false; status: number; error: string };

async function sendEmail(ctx: TickContext, userId: string, subject: string, html: string, idempotencyKey: string): Promise<EmailResult> {
  const to = await ctx.email(userId);
  const resendKey = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY");
  if (!to || !subject) return { ok: false, status: 400, error: "no_recipient" };
  if (!resendKey) return { ok: false, status: 500, error: "email_provider_not_configured" };
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey };
  if (lovableKey) { headers.Authorization = `Bearer ${lovableKey}`; headers["X-Connection-Api-Key"] = resendKey; }
  else headers.Authorization = `Bearer ${resendKey}`;
  let res: Response;
  try {
    res = await fetch(lovableKey ? GATEWAY_URL : DIRECT_URL, {
      method: "POST", headers, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, html }),
    });
  } catch {
    return { ok: false, status: 0, error: "network_error" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, status: res.status, error: `provider_${res.status}` };
  try {
    const id = JSON.parse(text)?.id;
    if (typeof id === "string" && id) {
      await ctx.admin.from("email_send_log").insert({ message_id: id, template_name: "planner_notification", recipient_email: to, status: "sent" });
      return { ok: true, id, status: res.status };
    }
  } catch { /* malformed provider response */ }
  return { ok: false, status: 502, error: "provider_response_without_id" };
}
