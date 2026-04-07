import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

// Unified categories - singular, matching frontend exactly
async function classifyEmail(subject: string, from: string): Promise<string> {
  const lower = `${subject} ${from}`.toLowerCase();
  if (/invoice|receipt|payment|חשבונית|תשלום|קבלה|paypal|stripe/.test(lower)) return "payment";
  if (/task|todo|action|משימה|לביצוע|reminder|jira|asana/.test(lower)) return "task";
  if (/order|shipping|delivery|הזמנה|משלוח|amazon|aliexpress/.test(lower)) return "shopping";
  if (/bill|utility|חשבון|חשמל|מים|ארנונה/.test(lower)) return "bill";
  if (/newsletter|unsubscribe|עדכון|marketing/.test(lower)) return "newsletter";
  return "personal";
}

async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token || null;
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

    const { connectionId } = await req.json();
    if (!connectionId) return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers: corsH });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn, error: connErr } = await serviceClient
      .from("email_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: corsH });
    }

    let emailsProcessed = 0;

    // Gmail OAuth flow
    if (conn.provider === "gmail" && conn.refresh_token) {
      let accessToken = conn.access_token;
      const settings = (conn.settings as any) || {};

      // Refresh token if expired
      if (!accessToken || (settings.token_expiry && Date.now() > settings.token_expiry)) {
        accessToken = await refreshGmailToken(conn.refresh_token);
        if (accessToken) {
          await serviceClient.from("email_connections").update({
            access_token: accessToken,
            settings: { ...settings, token_expiry: Date.now() + 3500000 },
          }).eq("id", connectionId);
        } else {
          return new Response(JSON.stringify({ 
            error: "Failed to refresh Gmail token. Please reconnect your Gmail account.",
            needs_reconnect: true 
          }), { status: 401, headers: { ...corsH, "Content-Type": "application/json" } });
        }
      }

      if (accessToken) {
        // Fetch recent messages
        const listRes = await fetch(`${GMAIL_API}/messages?maxResults=50&q=newer_than:14d`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!listRes.ok) {
          const errBody = await listRes.text();
          console.error("Gmail API error:", listRes.status, errBody);
          if (listRes.status === 401) {
            return new Response(JSON.stringify({ 
              error: "Gmail access expired. Please reconnect.",
              needs_reconnect: true 
            }), { status: 401, headers: { ...corsH, "Content-Type": "application/json" } });
          }
          throw new Error(`Gmail API error: ${listRes.status}`);
        }
        
        const listData = await listRes.json();

        if (listData.messages && Array.isArray(listData.messages)) {
          for (const msg of listData.messages.slice(0, 20)) {
            try {
              const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (!msgRes.ok) continue;
              const msgData = await msgRes.json();

              const headers = msgData.payload?.headers || [];
              const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
              const from = headers.find((h: any) => h.name === "From")?.value || "";
              const date = headers.find((h: any) => h.name === "Date")?.value || "";

              const category = await classifyEmail(subject, from);

              await serviceClient.from("email_analyses").upsert({
                user_id: user.id,
                connection_id: connectionId,
                email_subject: subject,
                email_from: from,
                email_date: date ? new Date(date).toISOString() : new Date().toISOString(),
                category,
                is_processed: true,
                suggested_action: category === "payment"
                  ? { type: "add_expense", description: subject }
                  : category === "task"
                  ? { type: "create_task", description: subject }
                  : null,
              } as any);

              emailsProcessed++;
            } catch (msgErr) {
              console.error("Error processing message:", msgErr);
            }
          }
        }
      }
    }

    // Update last_sync
    await serviceClient.from("email_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("id", connectionId);

    return new Response(JSON.stringify({
      success: true,
      emails_processed: emailsProcessed,
    }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-sync error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsH });
  }
});
