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

class WorkerSyncPendingError extends Error {}

function publicFinanceError(message: string) {
  if (/PRE-LOGIN: no password field|Login field not found on page/i.test(message)) {
    return "The institution's sign-in form did not load. Your password was not checked; please try again later.";
  }
  if (/INVALID_PASSWORD|LOGIN_FAILED|invalid credentials|rejected the login/i.test(message)) {
    return "The institution rejected the login details. Verify the identifier, card digits, and password.";
  }
  if (/ACCOUNT_BLOCKED|account is blocked/i.test(message)) {
    return "The institution reports that this account is blocked. Sign in directly to restore access first.";
  }
  if (/WAF_BLOCKED|Cloudflare|Attention Required|automation blocked|\b403\b/i.test(message)) {
    return "The institution temporarily blocked automated access. Please try again later.";
  }
  if (/TIMEOUT|timed out|did not respond/i.test(message)) {
    return "The institution did not respond in time. Please try again.";
  }
  return "The financial institution could not be synchronized. Check the details and try again.";
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
    signal: AbortSignal.timeout(15_000),
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
  const timeoutMs = payload.companyId === "visaCal" ? 45_000 : 180_000;
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${workerUrl}/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${identityToken}`,
        "Content-Type": "application/json",
        "x-tabro-timestamp": timestamp,
        "x-tabro-signature": signatureHex,
      },
      body: requestBody,
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw new WorkerSyncPendingError("Finance synchronization continues in the background");
    throw error;
  }
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
      let accounts: Record<string, unknown>[] = [];
      let transactionRows: Record<string, unknown>[] = [];
      if (connectionIds.length) {
        const accountsResult = await service.from("financial_accounts")
          .select("*")
          .eq("user_id", user.id)
          .in("connection_id", connectionIds);
        if (accountsResult.error) throw accountsResult.error;
        // Keep schema compatibility without exposing raw provider payloads.
        accounts = (accountsResult.data || []).map((account) => ({
          id: account.id,
          external_account_id: account.external_account_id,
          provider_name: account.provider_name,
          account_type: account.account_type,
          display_name: account.display_name,
          masked_number: account.masked_number,
          currency: account.currency,
          current_balance: account.current_balance,
          available_balance: account.available_balance,
        }));

        let transactionsResult = await service.from("financial_transactions")
          .select("id, amount, category, subcategory, direction, description, merchant, transaction_date, created_at, provider, source_type, raw_data, hidden")
          .eq("user_id", user.id)
          .eq("source_type", "cloud_scraper")
          .in("source_connection_id", connectionIds)
          .order("transaction_date", { ascending: false });

        if (transactionsResult.error && /hidden/i.test(transactionsResult.error.message || "")) {
          const fallbackResult = await service.from("financial_transactions")
            .select("id, amount, category, subcategory, direction, description, merchant, transaction_date, created_at, provider, source_type, raw_data")
            .eq("user_id", user.id)
            .eq("source_type", "cloud_scraper")
            .in("source_connection_id", connectionIds)
            .order("transaction_date", { ascending: false });
          transactionsResult = {
            ...fallbackResult,
            data: fallbackResult.data?.map((transaction) => ({ ...transaction, hidden: false })) ?? null,
          } as typeof transactionsResult;
        }
        if (transactionsResult.error) throw transactionsResult.error;
        transactionRows = transactionsResult.data || [];
      }
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
      const storeCredentials = typeof body.storeCredentials === "boolean" ? body.storeCredentials : true;

      const metadata = {
        company_id: companyId,
        read_only_behavior: true,
        hosted_worker: true,
        credential_storage: storeCredentials ? "encrypted" : "none",
        sync_interval_minutes: storeCredentials ? 720 : null,
      };
      const { data: previousFailures, error: previousFailureError } = await service.from("bank_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("integration_provider", "cloud_scraper")
        .eq("status", "error")
        .contains("metadata", { company_id: companyId })
        .order("created_at", { ascending: false })
        .limit(1);
      if (previousFailureError) throw previousFailureError;

      const connectionResult = previousFailures?.[0]
        ? await service.from("bank_connections").update({
          provider_name: provider.name,
          status: "syncing",
          last_error: null,
          metadata,
        }).eq("id", previousFailures[0].id).eq("user_id", user.id).select("*").single()
        : await service.from("bank_connections").insert({
          user_id: user.id,
          integration_provider: "cloud_scraper",
          external_connection_id: `${companyId}:${crypto.randomUUID()}`,
          provider_name: provider.name,
          status: "syncing",
          metadata,
        }).select("*").single();
      const { data: connection, error } = connectionResult;
      if (error || !connection) throw error || new Error("Could not create the finance connection");

      try {
        const result = await callWorker({
          userId: user.id,
          connectionId: connection.id,
          companyId,
          credentials,
          storeCredentials,
        });
        // Keep one canonical connection after a successful retry instead of
        // accumulating a card for every previous failed login attempt.
        await service.from("bank_connections").delete()
          .eq("user_id", user.id)
          .eq("integration_provider", "cloud_scraper")
          .eq("status", "error")
          .contains("metadata", { company_id: companyId })
          .neq("id", connection.id);
        return json(request, { success: true, connection, ...result });
      } catch (error) {
        if (error instanceof WorkerSyncPendingError) {
          return json(request, { success: true, pending: true, connection }, 202);
        }
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
      if (connection.metadata?.credential_storage === "none") {
        return json(request, { error: "This connection was imported without saving credentials. Reconnect to refresh it." }, 409);
      }
      // The worker owns the running state. Marking it here leaves connections
      // stuck forever when IAM/network failure prevents the worker from starting.
      try {
        return json(request, await callWorker({ userId: user.id, connectionId: connection.id, companyId }));
      } catch (syncError) {
        if (syncError instanceof WorkerSyncPendingError) {
          return json(request, { success: true, pending: true, connectionId: connection.id }, 202);
        }
        await service.from("bank_connections").update({
          status: "error",
          last_error: "הסנכרון לא הושלם. הנתונים הקודמים נשמרו; ניתן לנסות שוב.",
        }).eq("id", connection.id).eq("user_id", user.id);
        throw syncError;
      }
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
      if (typeof body.subcategory === "string" || body.subcategory === null) {
        updates.subcategory = typeof body.subcategory === "string" ? clean(body.subcategory, 120) || null : null;
      }
      if (typeof body.hidden === "boolean") updates.hidden = body.hidden;
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
      : publicFinanceError(message);
    return json(request, { error: publicMessage }, configurationError ? 503 : 500);
  }
});
