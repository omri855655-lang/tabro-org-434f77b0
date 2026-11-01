// Pure rules for server-side "important new email" alerts. Metadata only (sender,
// subject, category, receive time): an email is never treated as a command or as proof
// of who sent it. No AI calls. Shared by the scheduled function and its tests.
import { exceedsDailyLimit, isWithinQuietHours } from "./briefingSchedule.ts";
import { senderDomain, triageEmail, type MailBucket, type MailPreferences } from "./emailTriage.ts";

export interface ImportantMailAlertSettings {
  enabled: boolean;
  push: boolean;
  email: boolean;
  /** Only mail received at or after this instant can alert (prevents first-sync backfill). */
  since: string | null;
}

export const ALERT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const ALERT_FUTURE_SKEW_MS = 10 * 60 * 1000;
export const ALERT_MAX_BATCHES_PER_DAY = 12;
export const ALERT_MAX_ITEMS_PER_BATCH = 20;

// Opt-in only: anything other than an explicit `enabled: true` keeps alerts off.
export function normalizeImportantMailAlerts(raw: unknown): ImportantMailAlertSettings {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const since = typeof value.since === "string" && !Number.isNaN(Date.parse(value.since)) ? new Date(value.since).toISOString() : null;
  return {
    enabled: value.enabled === true && since !== null,
    push: value.push !== false,
    email: value.email === true,
    since,
  };
}

const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 200) : [];
const BUCKETS: MailBucket[] = ["action", "finance", "shopping", "updates", "personal", "promotions", "low"];

export function normalizeMailPreferences(raw: unknown): MailPreferences {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const buckets: Record<string, MailBucket> = {};
  if (value.senderBuckets && typeof value.senderBuckets === "object") {
    for (const [key, bucket] of Object.entries(value.senderBuckets as Record<string, unknown>)) {
      if (typeof bucket === "string" && BUCKETS.includes(bucket as MailBucket)) buckets[key.toLowerCase()] = bucket as MailBucket;
    }
  }
  return {
    vipSenders: list(value.vipSenders),
    lowPrioritySenders: list(value.lowPrioritySenders),
    importantKeywords: list(value.importantKeywords),
    ignoredKeywords: list(value.ignoredKeywords),
    importantCategories: list(value.importantCategories),
    senderBuckets: buckets,
  };
}

// Any one-time/verification/reset code, regardless of age: by the time a push lands the
// user is usually already looking at the login screen, and old codes are pure noise.
const CODE_SUBJECT = /\b(verification code|security code|one.time (pass)?code|otp|login code|sign.in code|password reset code|confirm(ation)? code)\b|קוד אימות|קוד חד.?פעמי|קוד כניסה|קוד התחברות|סיסמה חד.?פעמית/iu;
// Strong subject signals only: a bare "today"/"היום" (common in digests and Tabro's own
// briefings) is not enough to interrupt someone.
const STRONG_SUBJECT = /\b(action required|reply needed|response required|deadline|urgent|asap|overdue|password|security alert|suspicious|unauthorized|account locked)\b|נדרשת פעולה|נדרש אישור|מועד אחרון|לטיפול|נא להשיב|דחוף|באיחור|פעילות חשודה|התראת אבטחה|חשבון.*נחסם/iu;
// Tabro's own notifications (briefings, reminders) must never trigger mail alerts.
const isSelfSender = (domain: string) => domain === "tabro.org" || domain.endsWith(".tabro.org");
const PROMO_CATEGORIES = new Set(["newsletter", "promotion", "promotions", "social"]);
const QUIET_BUCKETS = new Set<MailBucket>(["promotions", "low", "updates", "shopping"]);

export interface AlertMail {
  email_subject: string | null;
  email_from: string | null;
  email_date: string | null;
  category: string | null;
}

export type AlertDecision =
  | { alert: true; reason: "vip" | "keyword" | "preference" | "security" | "action" }
  | { alert: false; reason: "self_notification" | "disabled" | "before_opt_in" | "too_old" | "future_date" | "verification_code" | "low_priority_sender" | "ignored_keyword" | "learned_quiet" | "promotion" | "not_important" };

export function importantMailDecision(mail: AlertMail, prefs: MailPreferences, settings: ImportantMailAlertSettings, now = Date.now()): AlertDecision {
  if (!settings.enabled || !settings.since) return { alert: false, reason: "disabled" };
  const received = Date.parse(mail.email_date || "");
  if (!Number.isFinite(received) || received < Date.parse(settings.since)) return { alert: false, reason: "before_opt_in" };
  if (received > now + ALERT_FUTURE_SKEW_MS) return { alert: false, reason: "future_date" };
  if (now - received > ALERT_MAX_AGE_MS) return { alert: false, reason: "too_old" };
  const subject = (mail.email_subject || "").toLowerCase();
  if (CODE_SUBJECT.test(subject)) return { alert: false, reason: "verification_code" };
  const from = (mail.email_from || "").toLowerCase();
  const domain = senderDomain(from);
  if (isSelfSender(domain)) return { alert: false, reason: "self_notification" };
  const matches = (values: string[]) => values.some(v => { const x = v.toLowerCase(); return x === domain || x === from || (x.includes("@") && from.includes(x)); });
  if (matches(prefs.lowPrioritySenders)) return { alert: false, reason: "low_priority_sender" };
  if (prefs.ignoredKeywords.some(word => subject.includes(word.toLowerCase()))) return { alert: false, reason: "ignored_keyword" };
  const learned = prefs.senderBuckets[domain] || prefs.senderBuckets[from];
  if (learned && QUIET_BUCKETS.has(learned)) return { alert: false, reason: "learned_quiet" };
  if (learned === "action") return { alert: true, reason: "preference" };
  if (matches(prefs.vipSenders)) return { alert: true, reason: "vip" };
  if (prefs.importantKeywords.some(word => subject.includes(word.toLowerCase()))) return { alert: true, reason: "keyword" };
  const category = (mail.category || "").toLowerCase();
  const triage = triageEmail({ email_subject: mail.email_subject, email_from: mail.email_from, category, email_date: mail.email_date }, prefs, now);
  if (PROMO_CATEGORIES.has(category) || triage.bucket === "promotions" || triage.bucket === "low") return { alert: false, reason: "promotion" };
  // A coarse "task"/"meeting" category alone (often marketing copy) is not enough; the
  // subject itself must carry a security/action/urgency signal.
  if (triage.bucket === "action" && triage.subjectSignal && STRONG_SUBJECT.test(subject)) return { alert: true, reason: triage.security ? "security" : "action" };
  return { alert: false, reason: "not_important" };
}

export interface ChannelPlan { push: boolean; email: boolean; deferred: null | "quiet_hours" | "daily_limit" }

export function importantMailChannelPlan(notificationSettings: unknown, israelMinutes: number, batchesToday: number): ChannelPlan {
  const settings = notificationSettings && typeof notificationSettings === "object" ? notificationSettings as Record<string, any> : {};
  const alerts = normalizeImportantMailAlerts(settings.importantMailAlerts);
  if (!alerts.enabled) return { push: false, email: false, deferred: null };
  if (settings.quietHoursEnabled === true && isWithinQuietHours(israelMinutes, settings.quietHoursStart, settings.quietHoursEnd)) {
    return { push: false, email: false, deferred: "quiet_hours" };
  }
  if (batchesToday >= ALERT_MAX_BATCHES_PER_DAY || exceedsDailyLimit(settings.dailyLimit, batchesToday)) {
    return { push: false, email: false, deferred: "daily_limit" };
  }
  return {
    push: alerts.push && settings.push?.enabled !== false,
    email: alerts.email && settings.email?.enabled !== false,
    deferred: null,
  };
}

// Lock-screen text never contains the sender or subject.
export function importantMailPushPayload(count: number) {
  return {
    title: "Tabro: מייל חשוב חדש",
    body: count === 1 ? "התקבל מייל אחד שסומן כחשוב לפי ההעדפות שלך. פתח את Tabro לצפייה." : `התקבלו ${count} מיילים שסומנו כחשובים לפי ההעדפות שלך. פתח את Tabro לצפייה.`,
    tag: "tabro-important-mail",
    url: "/personal",
    icon: "/app-icon.png",
  };
}

export function alertItemKey(connectionId: string, externalMessageId: string): string {
  return `${connectionId}:${externalMessageId}`;
}
