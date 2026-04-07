import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const AI_GATEWAY = "https://ai-gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const connectionId = body.connectionId;

    // Get the user's Gmail connection
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = serviceClient
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "gmail");

    if (connectionId) query = query.eq("id", connectionId);

    const { data: connections, error: connErr } = await query.limit(1).single();
    if (connErr || !connections) {
      return new Response(JSON.stringify({ error: "No Gmail connection found" }), { status: 404, headers: corsHeaders });
    }

    const accessToken = connections.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access token" }), { status: 400, headers: corsHeaders });
    }

    // Fetch unread messages from Gmail
    const listRes = await fetch(`${GMAIL_API}/messages?maxResults=20&q=is:unread`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error("Gmail API error:", listRes.status, errText);
      return new Response(JSON.stringify({ error: "Gmail API error", status: listRes.status }), { status: 502, headers: corsHeaders });
    }

    const listData = await listRes.json();
    const messageIds = (listData.messages || []).slice(0, 20);

    if (messageIds.length === 0) {
      // Update last_sync
      await serviceClient.from("email_connections").update({ last_sync: new Date().toISOString() }).eq("id", connections.id);
      return new Response(JSON.stringify({ synced: 0, message: "No unread emails" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch each message's metadata
    const emails: { subject: string; from: string; date: string; id: string }[] = [];
    for (const msg of messageIds) {
      try {
        const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
        const from = headers.find((h: any) => h.name === "From")?.value || "";
        const date = headers.find((h: any) => h.name === "Date")?.value || "";
        emails.push({ subject, from, date, id: msg.id });
      } catch {
        continue;
      }
    }

    if (emails.length === 0) {
      await serviceClient.from("email_connections").update({ last_sync: new Date().toISOString() }).eq("id", connections.id);
      return new Response(JSON.stringify({ synced: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Classify emails using AI Gateway
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const emailList = emails.map((e, i) => `${i + 1}. Subject: "${e.subject}" From: "${e.from}"`).join("\n");

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Classify each email into one of: payment, task, meeting, delivery, promotion, other.
Reply with a JSON array only. Each item: {"index": number, "category": string, "title": string, "summary": string, "suggested_action": string}
No markdown, no explanation, just the JSON array.`
          },
          { role: "user", content: emailList }
        ],
        response_format: { type: "json_object" },
      }),
    });

    let classifications: any[] = [];
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || "[]";
      try {
        const parsed = JSON.parse(content);
        classifications = Array.isArray(parsed) ? parsed : (parsed.emails || parsed.classifications || parsed.results || []);
      } catch {
        console.error("Failed to parse AI response:", content);
      }
    }

    // Save results to email_analyses
    const analysisRows = emails.map((email, i) => {
      const cls = classifications.find((c: any) => c.index === i + 1) || { category: "other", title: email.subject, summary: "", suggested_action: "" };
      return {
        user_id: user.id,
        connection_id: connections.id,
        email_subject: email.subject,
        email_from: email.from,
        email_date: new Date(email.date || Date.now()).toISOString(),
        category: cls.category || "other",
        suggested_action: { title: cls.title, summary: cls.summary, action: cls.suggested_action },
        is_processed: true,
        analysis_depth: "subject",
      };
    });

    const { error: insertErr } = await serviceClient.from("email_analyses").insert(analysisRows);
    if (insertErr) console.error("Insert error:", insertErr);

    // Auto-create records for actionable categories
    for (const row of analysisRows) {
      try {
        if (row.category === "meeting" && row.suggested_action?.title) {
          await serviceClient.from("calendar_events").insert({
            user_id: user.id,
            title: row.suggested_action.title || row.email_subject,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 3600000).toISOString(),
            category: "פגישה",
            source_type: "email",
          });
        } else if (row.category === "task" && row.suggested_action?.title) {
          await serviceClient.from("tasks").insert({
            user_id: user.id,
            description: row.suggested_action.title || row.email_subject,
            task_type: "personal",
            status: "טרם החל",
          });
        } else if (row.category === "payment" && row.suggested_action?.title) {
          await serviceClient.from("payment_tracking").insert({
            user_id: user.id,
            title: row.suggested_action.title || row.email_subject,
            amount: 0,
            payment_type: "expense",
          });
        }
      } catch (e) {
        console.error("Auto-create error:", e);
      }
    }

    // Update last_sync
    await serviceClient.from("email_connections").update({ last_sync: new Date().toISOString() }).eq("id", connections.id);

    return new Response(JSON.stringify({ synced: analysisRows.length, classifications: classifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sync error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
