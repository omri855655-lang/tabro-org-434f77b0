import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const allowedOrigins = new Set([
  "https://omrigabayexcel.site",
  "https://www.omrigabayexcel.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function responseHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://omrigabayexcel.site",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

const providers = {
  hapoalim: { name: "Bank Hapoalim", fields: ["userCode", "password"] },
  leumi: { name: "Bank Leumi", fields: ["username", "password"] },
  mizrahi: { name: "Mizrahi-Tefahot", fields: ["username", "password"] },
  discount: { name: "Discount Bank", fields: ["id", "password", "num"] },
  mercantile: { name: "Mercantile", fields: ["id", "password", "num"] },
  otsarHahayal: { name: "Otsar Hahayal", fields: ["username", "password"] },
  beinleumi: { name: "First International Bank", fields: ["username", "password"] },
  massad: { name: "Massad", fields: ["username", "password"] },
  yahav: { name: "Bank Yahav", fields: ["username", "nationalID", "password"] },
  pagi: { name: "Pagi", fields: ["username", "password"] },
  max: { name: "MAX", fields: ["username", "password"] },
  visaCal: { name: "Visa Cal", fields: ["username", "password"] },
  isracard: { name: "Isracard", fields: ["id", "card6Digits", "password"] },
  amex: { name: "American Express", fields: ["id", "card6Digits", "password"] },
  union: { name: "Union Bank", fields: ["username", "password"] },
  beyahadBishvilha: { name: "Beyahad Bishvilha", fields: ["id", "password"] },
  behatsdaa: { name: "Behatsdaa", fields: ["id", "password"] },
} as const;

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders(request), "Content-Type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemBytes(pem: string) {
  const binary = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function workerIdentityToken(audience: string) {
  const credentials = JSON.parse(env("FINANCE_WORKER_GOOGLE_SERVICE_ACCOUNT")) as {
    client_email: string;
    private_key: string;
    private_key_id: string;
  };
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: credentials.private_key_id }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
    target_audience: audience,
  }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id_token) throw new Error("Could not authorize the private finance worker");
  return body.id_token as string;
}

async function callWorker(payload: Record<string, unknown>) {
  const workerUrl = env("FINANCE_WORKER_URL").replace(/\/$/, "");
  const identityToken = await workerIdentityToken(workerUrl);
  const requestBody = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("FINANCE_WORKER_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(`${timestamp}.${requestBody}`),
  );
  const signatureHex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const response = await fetch(`${workerUrl}/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${identityToken}`,
      "Content-Type": "application/json",
      "x-tabro-timestamp": timestamp,
      "x-tabro-signature": signatureHex,
    },
    body: requestBody,
    signal: AbortSignal.timeout(180_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Finance worker returned HTTP ${response.status}`);
  return body;
}

async function enforceRateLimit(
  service: ReturnType<typeof createClient>,
  userId: string,
  action: "connect" | "sync",
  limit: number,
) {
  const { data: allowed, error } = await service.rpc("check_finance_rate_limit", {
    p_user_id: userId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: 900,
  });
  if (error) throw error;
  if (!allowed) throw new Error("RATE_LIMITED");
}

async function workerHealth() {
  const workerUrl = env("FINANCE_WORKER_URL").replace(/\/$/, "");
  const identityToken = await workerIdentityToken(workerUrl);
  const response = await fetch(`${workerUrl}/health`, {
    headers: { Authorization: `Bearer ${identityToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) throw new Error("Finance worker is not ready");
  return body;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: responseHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json(request, { error: "JSON request required" }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return json(request, { error: "Request is too large" }, 413);

  try {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(request, { error: "Authentication required" }, 401);

    const supabaseUrl = env("SUPABASE_URL");
    const sourceSupabaseUrl = Deno.env.get("SOURCE_SUPABASE_URL") || supabaseUrl;
    const sourceAnonKey = Deno.env.get("SOURCE_SUPABASE_ANON_KEY") || env("SUPABASE_ANON_KEY");
    const authClient = createClient(sourceSupabaseUrl, sourceAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) return json(request, { error: "Invalid session" }, 401);

    const service = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"));
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return json(request, { error: "Request is too large" }, 413);
    }
    const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const action = clean(body.action, 40);

    if (action === "worker_status") {
      await workerHealth();
      return json(request, { ready: true });
    }

    if (action === "providers") {
      return json(request, { providers });
    }

    if (action === "list") {
      const { data: connections, error } = await service.from("bank_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("integration_provider", "cloud_scraper")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const connectionIds = (connections || []).map((item) => item.id);
      const accounts = connectionIds.length
        ? (await service.from("financial_accounts")
          .select("id, connection_id, external_account_id, provider_id, provider_name, account_type, display_name, masked_number, currency, current_balance, available_balance, last_synced_at")
          .eq("user_id", user.id)
          .in("connection_id", connectionIds)).data || []
        : [];
      const transactionRows = connectionIds.length
        ? (await service.from("financial_transactions")
          .select("id, amount, category, subcategory, direction, description, merchant, transaction_date, created_at, provider, source_type, raw_data")
          .eq("user_id", user.id)
          .eq("source_type", "cloud_scraper")
          .in("source_connection_id", connectionIds)
          .order("transaction_date", { ascending: false })).data || []
        : [];
      const transactions = transactionRows.map(({ raw_data, ...transaction }) => {
        const safeRawData = raw_data && typeof raw_data === "object" && !Array.isArray(raw_data)
          ? raw_data as Record<string, unknown>
          : {};
        return {
          ...transaction,
          account_external_id: clean(safeRawData.account_external_id, 180) || null,
        };
      });
      return json(request, { connections: connections || [], accounts, transactions });
    }

    if (action === "connect") {
      await enforceRateLimit(service, user.id, "connect", 5);
      const companyId = clean(body.companyId, 50) as keyof typeof providers;
      const provider = providers[companyId];
      if (!provider) return json(request, { error: "Unsupported financial institution" }, 400);

      const submitted = body.credentials && typeof body.credentials === "object"
        ? body.credentials as Record<string, unknown>
        : {};
      const credentials: Record<string, string> = {};
      for (const field of provider.fields) {
        const value = clean(submitted[field], 180);
        if (!value) return json(request, { error: `Missing credential field: ${field}` }, 400);
        credentials[field] = value;
      }

      const externalId = `${companyId}:${crypto.randomUUID()}`;
      const { data: connection, error } = await service.from("bank_connections").insert({
        user_id: user.id,
        integration_provider: "cloud_scraper",
        external_connection_id: externalId,
        provider_name: provider.name,
        status: "syncing",
        metadata: {
          company_id: companyId,
          read_only_behavior: true,
          hosted_worker: true,
          sync_interval_minutes: 360,
        },
      }).select("*").single();
      if (error) throw error;

      try {
        const result = await callWorker({
          userId: user.id,
          connectionId: connection.id,
          companyId,
          credentials,
        });
        return json(request, { success: true, connection, ...result });
      } catch (error) {
        await service.from("bank_connections").update({
          status: "error",
          last_error: (error as Error).message.slice(0, 500),
        }).eq("id", connection.id).eq("user_id", user.id);
        throw error;
      }
    }

    if (action === "sync") {
      await enforceRateLimit(service, user.id, "sync", 20);
      const connectionId = clean(body.connectionId, 80);
      const { data: connection, error } = await service.from("bank_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .eq("integration_provider", "cloud_scraper")
        .single();
      if (error || !connection) return json(request, { error: "Connection not found" }, 404);
      const companyId = clean(connection.metadata?.company_id, 50);
      if (!companyId) return json(request, { error: "Connection provider is missing" }, 409);
      await service.from("bank_connections").update({ status: "syncing", last_error: null }).eq("id", connection.id);
      return json(request, await callWorker({ userId: user.id, connectionId: connection.id, companyId }));
    }

    if (action === "delete") {
      const connectionId = clean(body.connectionId, 80);
      const { error } = await service.from("bank_connections").delete()
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .eq("integration_provider", "cloud_scraper");
      if (error) throw error;
      return json(request, { success: true });
    }

    if (action === "update_transaction") {
      const transactionId = clean(body.transactionId, 80);
      const updates: Record<string, unknown> = {};
      if (typeof body.category === "string" || body.category === null) {
        updates.category = typeof body.category === "string" ? clean(body.category, 120) || null : null;
      }
      const amount = Number(body.amount);
      if (Number.isFinite(amount) && amount > 0) updates.amount = amount;
      if (!Object.keys(updates).length) return json(request, { error: "No valid transaction changes" }, 400);

      const { data, error } = await service.from("financial_transactions")
        .update(updates)
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .eq("source_type", "cloud_scraper")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: "Transaction not found" }, 404);
      return json(request, { success: true });
    }

    if (action === "delete_transaction") {
      const transactionId = clean(body.transactionId, 80);
      const { error } = await service.from("financial_transactions").delete()
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .eq("source_type", "cloud_scraper");
      if (error) throw error;
      return json(request, { success: true });
    }

    return json(request, { error: "Unknown action" }, 400);
  } catch (error) {
    console.error("finance-scraper-connect", error);
    if (error instanceof SyntaxError) {
      return json(request, { error: "Invalid JSON request" }, 400);
    }
    const message = (error as Error).message || "Finance connection failed";
    if (message === "RATE_LIMITED") {
      return json(request, { error: "Too many attempts. Please wait 15 minutes and try again." }, 429);
    }
    const configurationError = message.includes("FINANCE_WORKER_");
    const publicMessage = configurationError
      ? "The finance synchronization service is not configured"
      : "The financial institution could not be synchronized. Check the details and try again.";
    return json(request, { error: publicMessage }, configurationError ? 503 : 500);
  }
});
