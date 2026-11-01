// Deno-only web-push delivery that reports structured, allowlisted outcomes.
import { buildPushPayload, type PushMessage, type VapidKeys } from "https://esm.sh/@block65/webcrypto-web-push@1";
import { classifyPushResponse, pushServiceName, type DeviceResult } from "./pushDiagnostics.ts";

export type StoredSubscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at?: string | null };

export function vapidFromEnv(): VapidKeys | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return { subject: "mailto:info@tabro.org", publicKey, privateKey };
}

// Sends one payload to each of the given subscriptions (all already scoped to one user).
// Subscriptions the push service reports as gone (404/410) are removed, scoped by owner.
// deno-lint-ignore no-explicit-any
export async function deliverToSubscriptions(admin: any, subs: StoredSubscription[], data: Record<string, unknown>, vapid: VapidKeys, ttl: number): Promise<DeviceResult[]> {
  const results: DeviceResult[] = [];
  for (const [index, sub] of subs.entries()) {
    let status = 0;
    let body = "";
    try {
      const message: PushMessage = { data: JSON.stringify(data), options: { ttl } };
      const payload = await buildPushPayload(message, { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } }, vapid);
      const res = await fetch(sub.endpoint, { method: payload.method || "POST", headers: payload.headers, body: payload.body, signal: AbortSignal.timeout(15_000) });
      status = res.status;
      body = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 2000);
    } catch {
      status = 0;
    }
    const classified = classifyPushResponse(status, body);
    if (classified.outcome === "expired") {
      await admin.from("push_subscriptions").delete().eq("id", sub.id).eq("user_id", sub.user_id);
    }
    results.push({
      device: index + 1,
      service: pushServiceName(sub.endpoint),
      registeredOn: sub.created_at ? String(sub.created_at).slice(0, 10) : "",
      ...classified,
    });
  }
  return results;
}
