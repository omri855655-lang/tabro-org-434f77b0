import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SALT_EDGE_BASE = "https://www.saltedge.com/api/v5";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured on the server`);
  }
  return value;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getAllowedOrigin(candidate: string | null | undefined) {
  const normalizedCandidate = normalizeOrigin(candidate);
  const configuredOrigins = [
    Deno.env.get("SITE_URL"),
    ...(Deno.env.get("APP_ORIGINS") || "").split(","),
  ]
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  const allowedOrigins = [...new Set(configuredOrigins)];
  if (normalizedCandidate && allowedOrigins.length === 0) return normalizedCandidate;
  if (normalizedCandidate && allowedOrigins.includes(normalizedCandidate)) return normalizedCandidate;
  return allowedOrigins[0] ?? null;
}

function buildPopupResponse(payload: Record<string, unknown>, message: string, origin: string | null | undefined) {
  const allowedOrigin = getAllowedOrigin(origin);
  const postMessageScript = allowedOrigin
    ? `window.opener&&window.opener.postMessage(${JSON.stringify(payload)},${JSON.stringify(allowedOrigin)});`
    : "";

  return new Response(
    `<html><body><script>${postMessageScript}window.close();</script><p>${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}

async function saltEdgeRequest(path: string, method: string, body?: any) {
  const appId = requireEnv("SALT_EDGE_APP_ID");
  const secret = requireEnv("SALT_EDGE_SECRET");
  const res = await fetch(`${SALT_EDGE_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "App-id": appId,
      "Secret": secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let parsed: Record<string, any> | null = null;

  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const message =
      parsed?.error?.message ||
      parsed?.message ||
      raw ||
      `Salt Edge request failed with status ${res.status}`;
    throw new Error(message);
  }

  return parsed ?? {};
}

function buildFinancialTransactionRow(userId: string, connectionId: string, providerName: string | null, tx: Record<string, any>) {
  const rawAmount = Number(tx.amount || 0);
  const direction = rawAmount > 0 ? "income" : "expense";
  const transactionDate = tx.made_on || tx.posted_on || new Date().toISOString().slice(0, 10);
  const description =
    tx.description ||
    tx.extra?.original_description ||
    tx.extra?.merchant_name ||
    tx.extra?.merchant_id ||
    "Bank Transaction";

  return {
    user_id: userId,
    source_type: "bank_open_banking",
    source_connection_id: connectionId || ZERO_UUID,
    provider: providerName || tx.account_name || "Salt Edge",
    external_transaction_id: String(tx.id || `${transactionDate}_${description}_${Math.abs(rawAmount)}`),
    transaction_date: transactionDate,
    posted_date: tx.posted_on || null,
    amount: Math.abs(rawAmount),
    currency: tx.currency_code || "ILS",
    direction,
    description,
    merchant: tx.extra?.merchant_name || tx.extra?.merchant_id || null,
    category: Array.isArray(tx.category) ? tx.category[0] : tx.category || null,
    month_key: transactionDate.slice(0, 7),
    raw_data: tx,
  };
}

function accountType(account: Record<string, any>) {
  const value = String(account.nature || account.type || "account").toLowerCase();
  if (value.includes("card")) return "CARD";
  if (value.includes("loan") || value.includes("credit")) return "LOAN";
  if (value.includes("saving") || value.includes("deposit")) return "SAVINGS";
  if (value.includes("investment") || value.includes("security")) return "SECURITIES";
  return "CHECKING";
}

function buildFinancialAccountRow(userId: string, connectionId: string, providerName: string | null, account: Record<string, any>) {
  const number = String(account.extra?.masked_pan || account.extra?.account_number || account.extra?.iban || account.number || "");
  return {
    user_id: userId,
    connection_id: connectionId,
    external_account_id: String(account.id),
    provider_id: account.connection_id ? String(account.connection_id) : null,
    provider_name: providerName || "Salt Edge",
    account_type: accountType(account),
    display_name: account.name || account.extra?.account_name || providerName || "Financial account",
    masked_number: number ? `•••• ${number.replace(/\s/g, "").slice(-4)}` : null,
    currency: account.currency_code || "ILS",
    current_balance: Number(account.balance || 0),
    available_balance: account.extra?.available_amount == null ? null : Number(account.extra.available_amount),
    balance_type: "current",
    raw_data: account,
    last_synced_at: new Date().toISOString(),
  };
}

async function syncConnection(serviceClient: any, userId: string, connection: Record<string, any>) {
  const remoteId = connection.salt_edge_connection_id || connection.external_connection_id;
  if (!remoteId) throw new Error("Connection is not active");
  const fromDate = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [accountResult, transactionResult] = await Promise.all([
    saltEdgeRequest(`/accounts?connection_id=${encodeURIComponent(remoteId)}`, "GET"),
    saltEdgeRequest(`/transactions?connection_id=${encodeURIComponent(remoteId)}&from_date=${fromDate}`, "GET"),
  ]);

  const accounts = Array.isArray(accountResult.data) ? accountResult.data : [];
  const accountRows = accounts.map((account: Record<string, any>) =>
    buildFinancialAccountRow(userId, connection.id, connection.provider_name, account)
  );
  if (accountRows.length > 0) {
    const { error } = await serviceClient.from("financial_accounts")
      .upsert(accountRows, { onConflict: "user_id,connection_id,external_account_id" });
    if (error) throw error;
  }

  const transactions = Array.isArray(transactionResult.data) ? transactionResult.data : [];
  const transactionRows = transactions
    .map((transaction: Record<string, any>) => buildFinancialTransactionRow(userId, connection.id, connection.provider_name, transaction))
    .filter((row: Record<string, any>) => row.amount > 0);
  let inserted = 0;
  for (let index = 0; index < transactionRows.length; index += 200) {
    const batch = transactionRows.slice(index, index + 200);
    const externalIds = batch.map((row: Record<string, any>) => row.external_transaction_id);
    const { data: existing, error: existingError } = await serviceClient.from("financial_transactions")
      .select("external_transaction_id")
      .eq("user_id", userId)
      .eq("source_type", "bank_open_banking")
      .eq("source_connection_id", connection.id)
      .in("external_transaction_id", externalIds);
    if (existingError) throw existingError;
    const existingIds = new Set((existing || []).map((row: Record<string, any>) => row.external_transaction_id));
    const newRows = batch.filter((row: Record<string, any>) => !existingIds.has(row.external_transaction_id));
    if (newRows.length > 0) {
      const { error } = await serviceClient.from("financial_transactions").insert(newRows);
      if (error) throw error;
      inserted += newRows.length;
    }
  }

  await serviceClient.from("bank_connections").update({
    status: "active",
    last_sync: new Date().toISOString(),
    last_error: null,
  }).eq("id", connection.id).eq("user_id", userId);
  return { accounts: accountRows.length, transactions: inserted };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const urlAction = url.searchParams.get("action");

  // Handle GET callback from Salt Edge (user returns after connecting)
  if (req.method === "GET" && urlAction === "callback") {
    const connectionId = url.searchParams.get("connection_id");
    const pendingId = url.searchParams.get("pending_id");
    const origin = url.searchParams.get("origin");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (connectionId && pendingId) {
      try {
        const connResult = await saltEdgeRequest(`/connections/${connectionId}`, "GET");
        const remoteConnection = connResult.data || {};
        const customerId = String(remoteConnection.customer_id || "");
        const providerName = remoteConnection.provider_name || "Bank";
        const { data: pending, error: pendingError } = await serviceClient
          .from("bank_connections")
          .select("id,user_id,salt_edge_customer_id")
          .eq("id", pendingId)
          .eq("integration_provider", "salt_edge")
          .eq("status", "pending")
          .single();

        if (pendingError || !pending || !customerId || pending.salt_edge_customer_id !== customerId) {
          throw new Error("The returned bank connection could not be matched securely");
        }

        const { data: savedConnection, error: updateError } = await serviceClient
          .from("bank_connections")
          .update({
            salt_edge_connection_id: connectionId,
            external_connection_id: connectionId,
            provider_name: providerName,
            status: "active",
            last_error: null,
          })
          .eq("id", pending.id)
          .eq("user_id", pending.user_id)
          .select("*")
          .single();
        if (updateError || !savedConnection) throw updateError || new Error("Failed to save connection");

        // Salt Edge may still be finishing the initial fetch. A later dashboard sync
        // safely picks up any accounts or transactions that are not available yet.
        try {
          await syncConnection(serviceClient, pending.user_id, savedConnection);
        } catch (syncError) {
          console.warn("Initial Salt Edge sync is not ready yet:", syncError);
        }

        return buildPopupResponse(
          { source: "tabro-oauth", provider: "salt-edge", type: "bank-connected", providerName },
          "Connected! You can close this window.",
          origin,
        );
      } catch (error) {
        console.error("Salt Edge callback failed:", error);
      }
    }

    // Error or cancelled
    return buildPopupResponse(
      { source: "tabro-oauth", provider: "salt-edge", type: "bank-error" },
      "Connection was not completed. You can close this window.",
      origin,
    );
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsH });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsH });

    const { action, connectionId, origin, language } = await req.json();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "create_customer") {
      const { data: existing } = await serviceClient
        .from("bank_connections")
        .select("salt_edge_customer_id")
        .eq("user_id", user.id)
        .eq("integration_provider", "salt_edge")
        .not("salt_edge_customer_id", "is", null)
        .limit(1);

      let customerId = existing?.[0]?.salt_edge_customer_id;

      if (!customerId) {
        const result = await saltEdgeRequest("/customers", "POST", {
          data: { identifier: `user_${user.id}` },
        });
        if (result.error) throw new Error(result.error.message || "Failed to create customer");
        customerId = result.data.id;
      }

      return new Response(JSON.stringify({ success: true, customer_id: customerId }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    if (action === "create_connect_session") {
      const { data: existing } = await serviceClient
        .from("bank_connections")
        .select("salt_edge_customer_id")
        .eq("user_id", user.id)
        .eq("integration_provider", "salt_edge")
        .not("salt_edge_customer_id", "is", null)
        .limit(1);

      let customerId = existing?.[0]?.salt_edge_customer_id;

      if (!customerId) {
        const custResult = await saltEdgeRequest("/customers", "POST", {
          data: { identifier: `user_${user.id}` },
        });
        if (custResult.error) throw new Error(custResult.error.message);
        customerId = custResult.data.id;
      }

      const { data: pending, error: pendingError } = await serviceClient.from("bank_connections").insert({
        user_id: user.id,
        integration_provider: "salt_edge",
        external_user_id: customerId,
        salt_edge_customer_id: customerId,
        status: "pending",
        metadata: { readOnly: true, transport: "salt_edge_account_information" },
      } as any).select("id").single();
      if (pendingError || !pending) throw pendingError || new Error("Failed to prepare secure connection");

      const returnUrl = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/salt-edge-connect`);
      returnUrl.searchParams.set("action", "callback");
      returnUrl.searchParams.set("pending_id", pending.id);
      const normalizedOrigin = normalizeOrigin(typeof origin === "string" ? origin : req.headers.get("origin"));
      if (normalizedOrigin) {
        returnUrl.searchParams.set("origin", normalizedOrigin);
      }

      let result: Record<string, any>;
      try {
        result = await saltEdgeRequest("/connect_sessions/create", "POST", {
          data: {
            customer_id: customerId,
            consent: { scopes: ["account_details", "transactions_details"] },
            attempt: { return_to: returnUrl.toString() },
            return_connection_id: true,
            daily_refresh: true,
            categorization: "personal",
            locale: language === "en" ? "en" : "he",
            custom_fields: { tabro_connection_id: pending.id },
          },
        });
      } catch (error) {
        await serviceClient.from("bank_connections").delete().eq("id", pending.id).eq("user_id", user.id);
        throw error;
      }

      if (!result.data?.connect_url) {
        await serviceClient.from("bank_connections").delete().eq("id", pending.id).eq("user_id", user.id);
        throw new Error("Salt Edge did not return a connection URL");
      }

      return new Response(JSON.stringify({ success: true, connect_url: result.data.connect_url }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    if (action === "list_connections") {
      const { data: bankConns } = await serviceClient
        .from("bank_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("integration_provider", "salt_edge")
        .neq("status", "pending")
        .order("created_at", { ascending: false });

      const { data: accounts } = await serviceClient
        .from("financial_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      return new Response(JSON.stringify({ success: true, connections: bankConns || [], accounts: accounts || [] }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    if ((action === "refresh_connection" && connectionId) || action === "sync_all") {
      const connectionQuery = action === "sync_all"
        ? serviceClient.from("bank_connections").select("*")
          .eq("user_id", user.id).eq("integration_provider", "salt_edge").eq("status", "active")
        : serviceClient.from("bank_connections").select("*")
          .eq("id", connectionId).eq("user_id", user.id).eq("integration_provider", "salt_edge");
      const { data: connections, error: connectionError } = await connectionQuery;
      if (connectionError) throw connectionError;
      if (!connections?.length) return json({ error: "Connection not found or not active" }, 404);
      let accountsCount = 0;
      let transactionCount = 0;
      for (const connection of connections) {
        const result = await syncConnection(serviceClient, user.id, connection);
        accountsCount += result.accounts;
        transactionCount += result.transactions;
      }
      return json({ success: true, accounts_count: accountsCount, transactions_count: transactionCount });
    }

    if (action === "delete_connection" && connectionId) {
      const { data: conn } = await serviceClient
        .from("bank_connections")
        .select("salt_edge_connection_id")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .eq("integration_provider", "salt_edge")
        .single();

      if (conn?.salt_edge_connection_id) {
        try {
          await saltEdgeRequest(`/connections/${conn.salt_edge_connection_id}`, "DELETE");
        } catch {}
      }

      await serviceClient.from("bank_connections").delete()
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .eq("integration_provider", "salt_edge");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsH });
  } catch (e) {
    console.error("salt-edge-connect error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown secure connection error",
      }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } },
    );
  }
});
