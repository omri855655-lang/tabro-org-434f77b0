import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/dist/module/lib/constants.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { connectionId } = await req.json();
    if (!connectionId) return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers: corsH });

    // Update sync status
    await supabase.from("credit_card_connections").update({ sync_status: "syncing" }).eq("id", connectionId).eq("user_id", user.id);

    // NOTE: israeli-bank-scrapers requires puppeteer which isn't available in Edge Functions.
    // This is a placeholder that updates the status. In production, this would call an external 
    // scraping service (e.g., Caspion API) or process uploaded CSV files.
    
    await supabase.from("credit_card_connections").update({
      sync_status: "csv_ready",
      sync_error: "Direct sync is not available for this source yet. Use CSV import or Open Banking when supported.",
      last_sync: new Date().toISOString(),
    }).eq("id", connectionId).eq("user_id", user.id);

    return new Response(JSON.stringify({
      success: true,
      message: "Direct sync is not available for this source yet. Use CSV import or an Open Banking connection when supported.",
    }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsH });
  }
});
