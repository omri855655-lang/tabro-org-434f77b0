import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SALT_EDGE_BASE = "https://www.saltedge.com/api/v5";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const urlAction = url.searchParams.get("action");

  // Handle GET callback from Salt Edge (user returns after connecting)
  if (req.method === "GET" && urlAction === "callback") {
    const connectionId = url.searchParams.get("connection_id");
    const customerId = url.searchParams.get("customer_id");
    const origin = url.searchParams.get("origin");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (connectionId && customerId) {
      // Fetch connection details from Salt Edge
      let providerName = "Bank";
      try {
        const connResult = await saltEdgeRequest(`/connections/${connectionId}`, "GET");
        if (connResult.data?.provider_name) {
          providerName = connResult.data.provider_name;
        }
      } catch (e) {
        console.error("Failed to fetch connection details:", e);
      }

      // Update the pending bank_connection record
      const { error } = await serviceClient
        .from("bank_connections")
        .update({
          salt_edge_connection_id: connectionId,
          provider_name: providerName,
          status: "active",
          last_sync: new Date().toISOString(),
        })
        .eq("salt_edge_customer_id", customerId)
        .eq("status", "pending");

      if (error) {
        // Maybe no pending row — insert a new one
        // Find user_id from customer identifier
        try {
          const custResult = await saltEdgeRequest(`/customers/${customerId}`, "GET");
          const identifier = custResult.data?.identifier || "";
          const userId = identifier.replace("user_", "");
          if (userId) {
            await serviceClient.from("bank_connections").upsert({
              user_id: userId,
              salt_edge_customer_id: customerId,
              salt_edge_connection_id: connectionId,
              provider_name: providerName,
              status: "active",
              last_sync: new Date().toISOString(),
            } as any);
          }
        } catch (e2) {
          console.error("Fallback insert failed:", e2);
        }
      }

      return buildPopupResponse(
        { source: "tabro-oauth", provider: "bank", type: "bank-connected", providerName },
        "Connected! You can close this window.",
        origin,
      );
    }

    // Error or cancelled
    return buildPopupResponse(
      { source: "tabro-oauth", provider: "bank", type: "bank-error" },
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

    const { action, connectionId, origin } = await req.json();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "create_customer") {
      const { data: existing } = await serviceClient
        .from("bank_connections")
        .select("salt_edge_customer_id")
        .eq("user_id", user.id)
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

      const returnUrl = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/salt-edge-connect`);
      returnUrl.searchParams.set("action", "callback");
      const normalizedOrigin = normalizeOrigin(typeof origin === "string" ? origin : req.headers.get("origin"));
      if (normalizedOrigin) {
        returnUrl.searchParams.set("origin", normalizedOrigin);
      }

      const result = await saltEdgeRequest("/connect_sessions/create", "POST", {
        data: {
          customer_id: customerId,
          consent: { scopes: ["account_details", "transactions_details"] },
          attempt: { return_to: returnUrl.toString() },
        },
      });

      if (result.error) throw new Error(result.error.message || "Failed to create connect session");

      // Save pending connection
      await serviceClient.from("bank_connections").insert({
        user_id: user.id,
        salt_edge_customer_id: customerId,
        status: "pending",
      } as any);

      return new Response(JSON.stringify({ success: true, connect_url: result.data.connect_url }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    if (action === "list_connections") {
      const { data: bankConns } = await serviceClient
        .from("bank_connections")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "pending")
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ success: true, connections: bankConns || [] }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh_connection" && connectionId) {
      const { data: conn } = await serviceClient
        .from("bank_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .single();

      if (!conn || !conn.salt_edge_connection_id) {
        return new Response(JSON.stringify({ error: "Connection not found or not active" }), { status: 404, headers: corsH });
      }

      // Fetch transactions
      const txResult = await saltEdgeRequest(
        `/transactions?connection_id=${conn.salt_edge_connection_id}&from_date=${new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)}`,
        "GET"
      );

      let txCount = 0;
      if (txResult.data && Array.isArray(txResult.data)) {
        const expenseRows = txResult.data
          .map((tx: Record<string, any>) => buildFinancialTransactionRow(user.id, conn.id, conn.provider_name, tx))
          .filter((row: Record<string, any>) => row.direction === "expense" && row.amount > 0);

        if (expenseRows.length > 0) {
          const externalIds = expenseRows
            .map((row: Record<string, any>) => row.external_transaction_id)
            .filter((value: string | null) => Boolean(value));

          const { data: existingRows, error: existingError } = await serviceClient
            .from("financial_transactions")
            .select("external_transaction_id")
            .eq("user_id", user.id)
            .eq("source_type", "bank_open_banking")
            .eq("source_connection_id", conn.id)
            .in("external_transaction_id", externalIds);

          if (existingError) {
            throw existingError;
          }

          const existingIds = new Set(
            (existingRows || [])
              .map((row: Record<string, any>) => row.external_transaction_id)
              .filter((value: string | null) => Boolean(value)),
          );

          const rowsToInsert = expenseRows.filter(
            (row: Record<string, any>) => !existingIds.has(row.external_transaction_id),
          );

          if (rowsToInsert.length > 0) {
            const { error: insertError } = await serviceClient
              .from("financial_transactions")
              .insert(rowsToInsert as any);

            if (insertError) {
              throw insertError;
            }
          }

          txCount = rowsToInsert.length;
        }
      }

      await serviceClient.from("bank_connections").update({
        last_sync: new Date().toISOString(),
        status: "active",
      }).eq("id", connectionId);

      return new Response(JSON.stringify({
        success: true,
        transactions_count: txCount,
      }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_connection" && connectionId) {
      const { data: conn } = await serviceClient
        .from("bank_connections")
        .select("salt_edge_connection_id")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .single();

      if (conn?.salt_edge_connection_id) {
        try {
          await saltEdgeRequest(`/connections/${conn.salt_edge_connection_id}`, "DELETE");
        } catch {}
      }

      await serviceClient.from("bank_connections").delete().eq("id", connectionId);

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
      {
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  }
});
