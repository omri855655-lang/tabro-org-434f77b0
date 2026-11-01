// Read-only Gmail metadata sync shared by the manual sync and scheduled alerts.
// Only messages.list / messages.get(format=metadata) are called: no send, delete or
// label changes. Raw provider bodies and tokens are never logged or returned.
import { gmailMessageDate, saveSyncedEmail } from "./emailSyncStorage.ts";

export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MESSAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;

// Unified categories - singular, matching frontend exactly.
export function classifyEmail(subject: string, from: string, labels: string[] = []): string {
  const lower = `${subject} ${from}`.toLowerCase();
  if (labels.includes("CATEGORY_PROMOTIONS") || /unsubscribe|special offer|limited time|sale|discount|coupon|marketing|mailchimp|newsletter|מבצע|הנחה|קופון|הטבה|פרסומת|שיווק/.test(lower)) return "newsletter";
  if (labels.includes("CATEGORY_SOCIAL")) return "social";
  if (/invoice|receipt|payment|חשבונית|תשלום|קבלה|paypal|stripe/.test(lower)) return "payment";
  if (/task|todo|action|משימה|לביצוע|reminder|jira|asana/.test(lower)) return "task";
  if (/meeting|calendar|invitation|zoom|teams|פגישה|זימון/.test(lower)) return "meeting";
  if (/order|shipping|delivery|הזמנה|משלוח|amazon|aliexpress/.test(lower)) return "shopping";
  if (/bill|utility|חשבון|חשמל|מים|ארנונה/.test(lower)) return "bill";
  return "personal";
}

export interface GmailConnection { id: string; user_id: string; access_token: string | null; refresh_token: string | null; settings: unknown }
export interface GmailEnv { clientId?: string; clientSecret?: string; fetch?: typeof fetch; now?: () => number }
export type SyncError = null | "reconnect" | "token_refresh_failed" | "token_store_failed" | "gmail_list_failed" | "malformed_list" | "storage_read_failed";
export interface SyncResult { ok: boolean; processed: number; failed: number; skippedExisting: number; error: SyncError; newMessageIds: string[] }

export async function refreshGmailToken(refreshToken: string, env: GmailEnv): Promise<{ token: string | null; reconnect: boolean }> {
  if (!env.clientId || !env.clientSecret || !refreshToken) return { token: null, reconnect: !refreshToken };
  const doFetch = env.fetch || fetch;
  let res: Response;
  try {
    res = await doFetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
  } catch {
    return { token: null, reconnect: false };
  }
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* malformed token response */ }
  if (res.ok && typeof data.access_token === "string" && data.access_token) return { token: data.access_token, reconnect: false };
  // invalid_grant = revoked/expired consent; the user must reconnect Gmail.
  return { token: null, reconnect: data.error === "invalid_grant" || res.status === 401 };
}

function header(headers: unknown, name: string): string {
  if (!Array.isArray(headers)) return "";
  const hit = headers.find((h) => h && typeof h === "object" && String((h as any).name).toLowerCase() === name.toLowerCase());
  return typeof (hit as any)?.value === "string" ? (hit as any).value.slice(0, 1000) : "";
}

export function parseGmailMetadata(data: unknown): { subject: string; from: string; date: string; labels: string[]; internalDate: unknown } {
  const msg = data && typeof data === "object" ? data as Record<string, any> : null;
  if (!msg || !msg.payload || typeof msg.payload !== "object" || !Array.isArray(msg.payload.headers)) throw new Error("Malformed Gmail message");
  return {
    subject: header(msg.payload.headers, "Subject"),
    from: header(msg.payload.headers, "From"),
    date: header(msg.payload.headers, "Date"),
    labels: Array.isArray(msg.labelIds) ? msg.labelIds.filter((l: unknown) => typeof l === "string") : [],
    internalDate: msg.internalDate,
  };
}

// deno-lint-ignore no-explicit-any
type Store = any;

export async function syncGmailConnection(
  store: Store,
  conn: GmailConnection,
  opts: { query: string; maxResults: number; onlyNew: boolean },
  env: GmailEnv,
): Promise<SyncResult> {
  const doFetch = env.fetch || fetch;
  const now = env.now || Date.now;
  const result: SyncResult = { ok: false, processed: 0, failed: 0, skippedExisting: 0, error: null, newMessageIds: [] };
  const settings = conn.settings && typeof conn.settings === "object" ? conn.settings as Record<string, unknown> : {};
  let token = conn.access_token;
  let refreshedOnce = false;

  const refresh = async (): Promise<boolean> => {
    refreshedOnce = true;
    const next = await refreshGmailToken(conn.refresh_token || "", env);
    if (!next.token) { result.error = next.reconnect ? "reconnect" : "token_refresh_failed"; return false; }
    token = next.token;
    const { error } = await store.from("email_connections")
      .update({ access_token: token, settings: { ...settings, token_expiry: now() + 3_500_000 } })
      .eq("id", conn.id).eq("user_id", conn.user_id);
    if (error) { result.error = "token_store_failed"; return false; }
    return true;
  };

  // One refresh-and-retry on 401 per sync; a second 401 means reconnect is required.
  const gmailGet = async (url: string): Promise<Response | null> => {
    let res: Response;
    try { res = await doFetch(url, { headers: { Authorization: `Bearer ${token}` } }); } catch { return null; }
    if (res.status === 401 && !refreshedOnce) {
      await res.body?.cancel();
      if (!(await refresh())) return null;
      try { res = await doFetch(url, { headers: { Authorization: `Bearer ${token}` } }); } catch { return null; }
    }
    if (res.status === 401) { await res.body?.cancel(); result.error = "reconnect"; return null; }
    return res;
  };

  if (!conn.refresh_token) { result.error = "reconnect"; return result; }
  const expiry = typeof settings.token_expiry === "number" ? settings.token_expiry : 0;
  if (!token || (expiry && now() > expiry)) {
    if (!(await refresh())) return result;
  }

  const max = Math.max(1, Math.min(100, opts.maxResults));
  const listRes = await gmailGet(`${GMAIL_API}/messages?maxResults=${max}&q=${encodeURIComponent(opts.query)}`);
  if (!listRes) { result.error ||= "gmail_list_failed"; return result; }
  if (!listRes.ok) { await listRes.body?.cancel(); result.error = "gmail_list_failed"; return result; }
  let listData: Record<string, unknown>;
  try { listData = await listRes.json(); } catch { result.error = "malformed_list"; return result; }
  if (!listData || typeof listData !== "object" || (listData.messages !== undefined && !Array.isArray(listData.messages))) {
    result.error = "malformed_list";
    return result;
  }
  const ids = ((listData.messages as unknown[]) || [])
    .map((m) => (m && typeof m === "object" ? (m as any).id : null))
    .filter((id): id is string => typeof id === "string" && MESSAGE_ID.test(id))
    .slice(0, max);

  let existing = new Set<string>();
  if (opts.onlyNew && ids.length) {
    const { data, error } = await store.from("email_analyses").select("external_message_id")
      .eq("connection_id", conn.id).in("external_message_id", ids);
    if (error) { result.error = "storage_read_failed"; return result; }
    existing = new Set((data || []).map((r: any) => r.external_message_id));
  }

  for (const id of ids) {
    if (existing.has(id)) { result.skippedExisting++; continue; }
    const res = await gmailGet(`${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
    if (result.error === "reconnect" || result.error === "token_refresh_failed" || result.error === "token_store_failed") return result;
    try {
      if (!res || !res.ok) { await res?.body?.cancel(); throw new Error("Gmail message rejected"); }
      const meta = parseGmailMetadata(await res.json());
      const category = classifyEmail(meta.subject, meta.from, meta.labels);
      await saveSyncedEmail(store, {
        user_id: conn.user_id,
        connection_id: conn.id,
        external_message_id: id,
        email_subject: meta.subject,
        email_from: meta.from,
        email_date: gmailMessageDate(meta.internalDate, meta.date),
        category,
        is_processed: true,
        suggested_action: category === "payment" ? { type: "add_expense", description: meta.subject }
          : category === "task" ? { type: "create_task", description: meta.subject } : null,
      });
      result.processed++;
      result.newMessageIds.push(id);
    } catch {
      result.failed++;
    }
  }
  result.ok = result.failed === 0 && result.error === null;
  return result;
}
