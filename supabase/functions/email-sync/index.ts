import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { syncGmailConnection } from "../_shared/gmailSync.ts";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonH = { ...corsH, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonH });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonH });

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.connectionId === "string" ? body.connectionId : "";
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers: jsonH });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn, error: connErr } = await serviceClient
      .from("email_connections")
      .select("id, user_id, provider, access_token, refresh_token, settings")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: jsonH });
    }

    if (conn.provider !== "gmail") return new Response(JSON.stringify({ error: "Provider not supported" }), { status: 422, headers: jsonH });
    if (!conn.refresh_token) return new Response(JSON.stringify({ error: "Reconnect Gmail", needs_reconnect: true }), { status: 401, headers: jsonH });

    const result = await syncGmailConnection(serviceClient, conn, { query: "newer_than:90d -in:spam -in:trash", maxResults: 100, onlyNew: false }, {
      clientId: Deno.env.get("GOOGLE_CLIENT_ID"),
      clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
    });

    if (result.error === "reconnect") {
      return new Response(JSON.stringify({ error: "Gmail access expired. Please reconnect your Gmail account.", needs_reconnect: true, emails_processed: result.processed }), { status: 401, headers: jsonH });
    }
    if (result.error) {
      console.error("email-sync failed:", result.error);
      return new Response(JSON.stringify({ success: false, error: `Gmail sync failed (${result.error})`, emails_processed: result.processed, emails_failed: result.failed }), { status: 502, headers: jsonH });
    }
    if (result.failed > 0) {
      return new Response(JSON.stringify({ success: false, error: "Some messages could not be saved", emails_processed: result.processed, emails_failed: result.failed }), { status: 502, headers: jsonH });
    }

    // A successful checkpoint must never hide failed writes.
    const { error: checkpointError } = await serviceClient.from("email_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("user_id", user.id);
    if (checkpointError) throw new Error("Sync checkpoint failed");

    return new Response(JSON.stringify({ success: true, emails_processed: result.processed }), { headers: jsonH });
  } catch (e) {
    console.error("email-sync error:", e instanceof Error ? e.message : "unknown error");
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Sync failed" }), { status: 500, headers: jsonH });
  }
});
