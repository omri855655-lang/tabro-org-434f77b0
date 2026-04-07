import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SALT_EDGE_BASE = "https://www.saltedge.com/api/v5";

async function saltEdgeRequest(path: string, method: string, body?: any) {
  const res = await fetch(`${SALT_EDGE_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "App-id": Deno.env.get("SALT_EDGE_APP_ID")!,
      "Secret": Deno.env.get("SALT_EDGE_SECRET")!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const urlAction = url.searchParams.get("action");

  // Handle GET callback from Salt Edge (user returns after connecting)
  if (req.method === "GET" && urlAction === "callback") {
    const connectionId = url.searchParams.get("connection_id");
    const customerId = url.searchParams.get("customer_id");

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

      return new Response(
        `<html><body><script>window.opener&&window.opener.postMessage({type:'bank-connected',provider:'${providerName}'},'*');window.close();</script><p>Connected! You can close this window.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Error or cancelled
    return new Response(
      `<html><body><script>window.opener&&window.opener.postMessage({type:'bank-error'},'*');window.close();</script><p>Connection was not completed. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
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

    const { action, connectionId } = await req.json();

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

      const returnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/salt-edge-connect?action=callback`;

      const result = await saltEdgeRequest("/connect_sessions/create", "POST", {
        data: {
          customer_id: customerId,
          consent: { scopes: ["account_details", "transactions_details"] },
          attempt: { return_to: returnUrl },
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
        for (const tx of txResult.data) {
          const isIncome = tx.amount > 0;
          await serviceClient.from("payment_tracking").upsert({
            user_id: user.id,
            title: tx.description || tx.extra?.merchant_id || "Bank Transaction",
            amount: Math.abs(tx.amount),
            currency: tx.currency_code || "ILS",
            payment_type: isIncome ? "income" : "expense",
            category: tx.category || null,
            due_date: tx.made_on,
            paid: true,
            sheet_name: conn.provider_name || "Bank",
            notes: `Salt Edge: ${tx.id}`,
          } as any, { onConflict: "id" });
          txCount++;
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
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsH });
  }
});
