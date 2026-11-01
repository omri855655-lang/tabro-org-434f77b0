// Pure web-push helpers: classify push-service responses and validate VAPID keys.
// Results contain only allowlisted words — never endpoint URLs, subscription keys,
// private keys or raw provider bodies.

export type PushOutcome = "accepted" | "expired" | "rejected" | "retryable";
export type PushService = "apple" | "google" | "mozilla" | "microsoft" | "other";

// Reason codes documented by Apple / Mozilla / FCM that are safe to show.
const KNOWN_REASONS = [
  "BadJwtToken", "ExpiredJwtToken", "VapidPkHashMismatch", "BadDeviceToken", "Unregistered", "ExpiredSubscription",
  "BadWebPushTopic", "PayloadTooLarge", "TooManyRequests", "TooManyProviderTokenUpdates", "InvalidProviderToken",
  "MissingTopic", "BadExpirationDate", "BadPriority", "Forbidden", "InternalServerError", "ServiceUnavailable",
  "UnauthorizedRegistration", "InvalidRegistration", "NotRegistered", "MismatchSenderId",
] as const;
export type PushReason = typeof KNOWN_REASONS[number] | "unknown" | "network_error";

export function pushServiceName(endpoint: string): PushService {
  let host = "";
  try { host = new URL(endpoint).hostname.toLowerCase(); } catch { return "other"; }
  if (host.endsWith("push.apple.com")) return "apple";
  if (host.endsWith("googleapis.com") || host.endsWith("google.com")) return "google";
  if (host.endsWith("mozilla.com") || host.endsWith("mozaws.net")) return "mozilla";
  if (host.endsWith("windows.com") || host.endsWith("microsoft.com")) return "microsoft";
  return "other";
}

export function pushReason(bodyText: string): PushReason {
  const text = (bodyText || "").slice(0, 2000);
  try {
    const parsed = JSON.parse(text);
    const value = parsed?.reason ?? parsed?.error?.status ?? parsed?.error;
    if (typeof value === "string") {
      const hit = KNOWN_REASONS.find(r => r.toLowerCase() === value.toLowerCase());
      if (hit) return hit;
    }
  } catch { /* not JSON */ }
  return KNOWN_REASONS.find(r => text.includes(r)) || "unknown";
}

export function classifyPushResponse(status: number, bodyText = ""): { outcome: PushOutcome; status: number; reason: PushReason | null } {
  if (status >= 200 && status < 300) return { outcome: "accepted", status, reason: null };
  const reason = pushReason(bodyText);
  if (status === 404 || status === 410) return { outcome: "expired", status, reason };
  if (status === 0 || status === 408 || status === 429 || status >= 500) return { outcome: "retryable", status, reason: status === 0 ? "network_error" : reason };
  return { outcome: "rejected", status, reason };
}

const b64urlToBytes = (value: string): Uint8Array | null => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value.trim())) return null;
  const clean = value.trim().replace(/=+$/, "");
  const padded = clean.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (clean.length % 4)) % 4);
  try {
    const bin = atob(padded);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  } catch { return null; }
};
const bytesToB64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export interface VapidDiagnostics {
  configured: boolean;
  publicKeyFormatValid: boolean;
  privateKeyFormatValid: boolean;
  pairValid: boolean;
  matchesAppKey: boolean;
}

// Proves the private key belongs to the public key by signing and verifying a probe.
export async function vapidDiagnostics(publicKey: string | undefined, privateKey: string | undefined, appKey: string): Promise<VapidDiagnostics> {
  const result: VapidDiagnostics = { configured: Boolean(publicKey && privateKey), publicKeyFormatValid: false, privateKeyFormatValid: false, pairValid: false, matchesAppKey: false };
  const pub = b64urlToBytes(publicKey || "");
  const priv = b64urlToBytes(privateKey || "");
  result.publicKeyFormatValid = !!pub && pub.length === 65 && pub[0] === 4;
  result.privateKeyFormatValid = !!priv && priv.length === 32;
  result.matchesAppKey = !!publicKey && publicKey.trim().replace(/=+$/, "") === appKey.trim().replace(/=+$/, "");
  if (!result.publicKeyFormatValid || !result.privateKeyFormatValid) return result;
  try {
    const subtle = globalThis.crypto.subtle;
    const jwk = { kty: "EC", crv: "P-256", d: bytesToB64url(priv!), x: bytesToB64url(pub!.slice(1, 33)), y: bytesToB64url(pub!.slice(33, 65)), ext: true };
    const signer = await subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const verifier = await subtle.importKey("raw", pub!, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const probe = new TextEncoder().encode("tabro-vapid-probe");
    const signature = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signer, probe);
    result.pairValid = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifier, signature, probe);
  } catch {
    result.pairValid = false;
  }
  return result;
}

export interface DeviceResult { device: number; service: PushService; registeredOn: string; outcome: PushOutcome; status: number; reason: PushReason | null }

export function summarizePushResults(results: DeviceResult[]) {
  return {
    devicesFound: results.length,
    providerAccepted: results.filter(r => r.outcome === "accepted").length,
    expired: results.filter(r => r.outcome === "expired").length,
    rejected: results.filter(r => r.outcome === "rejected").length,
    retryable: results.filter(r => r.outcome === "retryable").length,
  };
}
