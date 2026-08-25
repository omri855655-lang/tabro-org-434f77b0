import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.open-finance.ai";
const ACTIVE_STATUSES = new Set(["ACTIVE", "COMPLETED"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured on the server`);
  return value;
}

function normalizeOrigin(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function allowedOrigin(candidate: unknown) {
  const configured = [Deno.env.get("SITE_URL"), ...(Deno.env.get("APP_ORIGINS") || "").split(",")]
    .map(normalizeOrigin)
    .filter((value): value is string => Boolean(value));
  const origin = normalizeOrigin(candidate);
  if (origin && (configured.length === 0 || configured.includes(origin))) return origin;
  return configured[0] ?? null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getToken(userId: string) {
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: requireEnv("OPEN_FINANCE_CLIENT_ID"),
      clientSecret: requireEnv("OPEN_FINANCE_CLIENT_SECRET"),
      userId,
    }),
  });
  const payload = await parseResponse(response);
  const token = payload.accessToken || payload.access_token || payload.token;
  if (!response.ok || typeof token !== "string") {
    throw new Error(errorMessage(payload, response.status, "Open Finance authentication failed"));
  }
  return token;
}

async function parseResponse(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function errorMessage(payload: Record<string, any>, status: number, fallback: string) {
  return payload.message || payload.error?.message || payload.error || `${fallback} (${status})`;
}

async function apiRequest(userId: string, path: string, init: RequestInit = {}) {
  const token = await getToken(userId);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(errorMessage(payload, response.status, "Open Finance request failed"));
  return payload;
}

function collection(payload: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key] ?? payload.data?.[key];
    if (Array.isArray(value)) return value;
  }
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function nextPage(payload: Record<string, any>) {
  return payload.nextPage || payload.pagination?.nextPage || payload.data?.nextPage || null;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function fetchAll(userId: string, path: string, itemKeys: string[]) {
  const items: Record<string, any>[] = [];
  let page: string | null = null;
  for (let index = 0; index < 20; index += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const payload = await apiRequest(userId, `${path}${page ? `${separator}nextPage=${encodeURIComponent(page)}` : ""}`);
    items.push(...collection(payload, itemKeys));
    page = nextPage(payload);
    if (!page) break;
  }
  return items;
}

function amountValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/,/g, ""));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return amountValue(record.amount ?? record.value);
  }
  return 0;
}

function currencyValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && /^[A-Z]{3}$/.test(value)) return value;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.currency === "string") return record.currency;
      if (typeof record.currencyCode === "string") return record.currencyCode;
    }
  }
  return "ILS";
}

function accountRow(userId: string, connectionId: string, account: Record<string, any>) {
  const balances = Array.isArray(account.balances) ? account.balances : [];
  const preferred = balances.find((item: Record<string, any>) => item.balanceType === "closingBooked") || balances[0] || {};
  const available = balances.find((item: Record<string, any>) => item.balanceType === "interimAvailable") || preferred;
  const number = String(account.maskedNumber || account.iban || account.bban || account.accountNumber || "");
  const externalId = String(account.id || account.accountId || account.resourceId || account.iban || `${connectionId}_${account.accountType || "CHECKING"}_${number}`);
  return {
    user_id: userId,
    connection_id: connectionId,
    external_account_id: externalId,
    provider_id: account.providerId || account.bankId || null,
    provider_name: account.providerName || account.bankName || null,
    account_type: String(account.accountType || account.type || "CHECKING").toUpperCase(),
    display_name: account.name || account.displayName || account.product || null,
    masked_number: number ? `•••• ${number.replace(/\s/g, "").slice(-4)}` : null,
    currency: currencyValue(preferred.balanceAmount, account.currency),
    current_balance: amountValue(preferred.balanceAmount ?? preferred.amount ?? account.balance),
    available_balance: amountValue(available.balanceAmount ?? available.amount ?? account.availableBalance),
    balance_type: preferred.balanceType || null,
    raw_data: account,
    last_synced_at: new Date().toISOString(),
  };
}

function transactionRow(userId: string, connectionId: string, providerName: string | null, tx: Record<string, any>) {
  const signedAmount = amountValue(tx.transactionAmount ?? tx.amount ?? tx.value);
  const indicator = String(tx.creditDebitIndicator || tx.direction || tx.type || "").toUpperCase();
  const direction = indicator.includes("CRDT") || indicator.includes("CREDIT") || indicator.includes("INCOME")
    ? "income"
    : indicator.includes("DBIT") || indicator.includes("DEBIT") || indicator.includes("EXPENSE")
      ? "expense"
      : signedAmount < 0 ? "expense" : "income";
  const date = String(tx.bookingDate || tx.transactionDate || tx.valueDate || tx.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const description = tx.remittanceInformationUnstructured || tx.description || tx.merchantName || tx.creditorName || tx.debtorName || "Open Finance transaction";
  const externalId = String(tx.transactionId || tx.id || tx.entryReference || `${date}_${description}_${signedAmount}`);
  return {
    user_id: userId,
    source_type: "open_finance",
    source_connection_id: connectionId,
    provider: providerName || tx.providerName || tx.providerId || "Open Finance",
    external_transaction_id: externalId,
    transaction_date: date,
    posted_date: tx.valueDate ? String(tx.valueDate).slice(0, 10) : null,
    amount: Math.abs(signedAmount),
    currency: currencyValue(tx.transactionAmount, tx.currency),
    direction,
    description: String(description),
    merchant: tx.merchantName || tx.creditorName || tx.debtorName || null,
    category: typeof tx.category === "string" ? tx.category : tx.category?.name || (typeof tx.transactionCategory === "string" ? tx.transactionCategory : null),
    subcategory: typeof tx.subcategory === "string" ? tx.subcategory : tx.subcategory?.name || null,
    month_key: date.slice(0, 7),
    raw_data: tx,
  };
}

function popup(payload: Record<string, unknown>, origin: string | null) {
  const script = origin ? `window.opener&&window.opener.postMessage(${JSON.stringify(payload)},${JSON.stringify(origin)});` : "";
  return new Response(`<html><body><script>${script}window.close();</script><p>You can close this window.</p></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(request.url);
  const service = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  if (request.method === "GET" && url.searchParams.get("action") === "callback") {
    const state = url.searchParams.get("state") || "";
    const origin = allowedOrigin(url.searchParams.get("origin"));
    if (!state) return popup({ source: "tabro-oauth", provider: "open-finance", type: "bank-error" }, origin);
    const stateHash = await sha256(state);
    const { data: connection } = await service.from("bank_connections").select("id, user_id, external_connection_id")
      .eq("integration_provider", "open_finance").eq("callback_state_hash", stateHash).maybeSingle();
    if (!connection) return popup({ source: "tabro-oauth", provider: "open-finance", type: "bank-error" }, origin);
    const externalId = url.searchParams.get("connectionId") || connection.external_connection_id;
    const callbackStatus = url.searchParams.get("connectionStatus") || url.searchParams.get("status") || "ACTIVE";
    await service.from("bank_connections").update({
      external_connection_id: externalId,
      status: ACTIVE_STATUSES.has(callbackStatus.toUpperCase()) ? "active" : callbackStatus.toLowerCase(),
      callback_state_hash: null,
      last_error: url.searchParams.get("error"),
    }).eq("id", connection.id);
    return popup({ source: "tabro-oauth", provider: "open-finance", type: "bank-connected" }, origin);
  }

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await request.json();
    const action = body.action;

    if (action === "list_connections") {
      const [{ data: connections, error }, { data: accounts }] = await Promise.all([
        service.from("bank_connections").select("*").eq("user_id", user.id).eq("integration_provider", "open_finance").order("created_at", { ascending: false }),
        service.from("financial_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);
      if (error) throw error;
      return json({ success: true, connections: connections || [], accounts: accounts || [] });
    }

    if (action === "create_connect_session") {
      const origin = allowedOrigin(body.origin || request.headers.get("origin"));
      const state = crypto.randomUUID() + crypto.randomUUID();
      const callbackUrl = new URL(`${requireEnv("SUPABASE_URL")}/functions/v1/open-finance-connect`);
      callbackUrl.searchParams.set("action", "callback");
      callbackUrl.searchParams.set("state", state);
      if (origin) callbackUrl.searchParams.set("origin", origin);

      const pendingId = crypto.randomUUID();
      const payload = await apiRequest(user.id, "/v2/connections", {
        method: "POST",
        body: JSON.stringify({
          language: body.language === "en" ? "en" : "he",
          externalId: pendingId,
          startDate: body.startDate || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
          refreshData: true,
          iframe: false,
          redirectUrl: callbackUrl.toString(),
          redirectWithoutButtonClick: true,
          allowBusiness: Boolean(body.allowBusiness),
          access: { restrictedTo: ["CACC", "CARD", "LOAN", "SVGS", "SCTS"] },
        }),
      });
      const remote = payload.data || payload;
      const externalId = remote.id || remote.connectionId;
      const connectUrl = remote.connectUrl || remote.connect_url || remote.url;
      if (!externalId || !connectUrl) throw new Error("Open Finance did not return a connection URL");
      const { error } = await service.from("bank_connections").insert({
        id: pendingId,
        user_id: user.id,
        integration_provider: "open_finance",
        external_connection_id: externalId,
        external_user_id: user.id,
        provider_name: "Open Finance",
        status: "pending",
        callback_state_hash: await sha256(state),
        metadata: { readOnly: true, accountTypes: ["CHECKING", "CARD", "LOAN", "SAVINGS", "SECURITIES"] },
      });
      if (error) throw error;
      return json({ success: true, connect_url: connectUrl });
    }

    if ((action === "refresh_connection" || action === "sync_all") && (body.connectionId || action === "sync_all")) {
      let query = service.from("bank_connections").select("*").eq("user_id", user.id).eq("integration_provider", "open_finance");
      if (body.connectionId) query = query.eq("id", body.connectionId);
      const { data: connections, error } = await query;
      if (error) throw error;
      let imported = 0;
      let accountCount = 0;
      for (const connection of connections || []) {
        if (!connection.external_connection_id) continue;
        const queryString = `connectionId=${encodeURIComponent(connection.external_connection_id)}`;
        const [accounts, transactions] = await Promise.all([
          fetchAll(user.id, `/v2/data/accounts?${queryString}&limit=500`, ["accounts", "items"]),
          fetchAll(user.id, `/v2/data/transactions?${queryString}&dateFrom=${new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}&includeDuplicates=0&sort=-1`, ["transactions", "items"]),
        ]);
        const accountRows = accounts.map((item) => accountRow(user.id, connection.id, item));
        if (accountRows.length) {
          const { error: accountError } = await service.from("financial_accounts").upsert(accountRows, { onConflict: "user_id,connection_id,external_account_id" });
          if (accountError) throw accountError;
        }
        accountCount += accountRows.length;
        const rows = transactions.map((item) => transactionRow(user.id, connection.id, connection.provider_name, item)).filter((item) => item.amount > 0);
        if (rows.length) {
          const existingIds = new Set<string>();
          for (const externalIds of chunks(rows.map((row) => row.external_transaction_id), 200)) {
            const { data: existing, error: existingError } = await service.from("financial_transactions")
              .select("external_transaction_id")
              .eq("user_id", user.id)
              .eq("source_type", "open_finance")
              .eq("source_connection_id", connection.id)
              .in("external_transaction_id", externalIds);
            if (existingError) throw existingError;
            for (const item of existing || []) existingIds.add(item.external_transaction_id);
          }
          const rowsToInsert = rows.filter((row) => !existingIds.has(row.external_transaction_id));
          for (const batch of chunks(rowsToInsert, 250)) {
            const { error: transactionError } = await service.from("financial_transactions").insert(batch);
            if (transactionError) throw transactionError;
          }
          imported += rowsToInsert.length;
        }
        await service.from("bank_connections").update({ status: "active", last_sync: new Date().toISOString(), last_error: null }).eq("id", connection.id);
      }
      return json({ success: true, transactions_count: imported, accounts_count: accountCount });
    }

    if (action === "delete_connection" && body.connectionId) {
      const { data: connection } = await service.from("bank_connections").select("*").eq("id", body.connectionId).eq("user_id", user.id).single();
      if (!connection) return json({ error: "Connection not found" }, 404);
      if (connection.external_connection_id) {
        try { await apiRequest(user.id, `/v2/connections/${encodeURIComponent(connection.external_connection_id)}`, { method: "DELETE" }); } catch (error) { console.error("Remote disconnect failed", error); }
      }
      await service.from("bank_connections").delete().eq("id", connection.id).eq("user_id", user.id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("open-finance-connect error", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Open Finance connection failed" }, 500);
  }
});
