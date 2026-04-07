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
      // Check if user already has a customer
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
      // Get or create customer first
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

      const result = await saltEdgeRequest("/connect_sessions/create", "POST", {
        data: {
          customer_id: customerId,
          consent: { scopes: ["account_details", "transactions_details"] },
          attempt: { return_to: `${Deno.env.get("SUPABASE_URL")}/functions/v1/salt-edge-connect?action=callback` },
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
        return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: corsH });
      }

      // Fetch accounts
      const accountsResult = await saltEdgeRequest(
        `/accounts?connection_id=${conn.salt_edge_connection_id}`, "GET"
      );

      // Fetch transactions
      const txResult = await saltEdgeRequest(
        `/transactions?connection_id=${conn.salt_edge_connection_id}&from_date=${new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)}`,
        "GET"
      );

      if (txResult.data && Array.isArray(txResult.data)) {
        for (const tx of txResult.data) {
          const isIncome = tx.amount > 0;
          await serviceClient.from("payment_tracking").upsert({
            user_id: user.id,
            title: tx.description || tx.extra?.merchant_id || "עסקה בנקאית",
            amount: Math.abs(tx.amount),
            currency: tx.currency_code || "ILS",
            payment_type: isIncome ? "income" : "expense",
            category: tx.category || "אחר",
            due_date: tx.made_on,
            paid: true,
            sheet_name: "בנק",
            notes: `Salt Edge: ${tx.id}`,
          } as any, { onConflict: "id" });
        }
      }

      await serviceClient.from("bank_connections").update({
        last_sync: new Date().toISOString(),
        status: "active",
      }).eq("id", connectionId);

      return new Response(JSON.stringify({
        success: true,
        accounts: accountsResult.data || [],
        transactions_count: txResult.data?.length || 0,
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
        await saltEdgeRequest(`/connections/${conn.salt_edge_connection_id}`, "DELETE");
      }

      await serviceClient.from("bank_connections").delete().eq("id", connectionId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsH });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsH });
  }
});
