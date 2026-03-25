import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerUserId, taskDescription, creatorName, sheetName } = await req.json();
    const normalizedTaskDescription = typeof taskDescription === "string" ? taskDescription.trim() : "";
    const taskPreview = normalizedTaskDescription ? `: ${normalizedTaskDescription.slice(0, 80)}` : "";

    if (!ownerUserId || !creatorName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get owner's email
    const { data: ownerData } = await supabase.auth.admin.getUserById(ownerUserId);
    const ownerEmail = ownerData?.user?.email;

    if (!ownerEmail || !resendKey) {
      return new Response(JSON.stringify({ error: "Could not resolve owner email or missing API key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email notification
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "ExcelSync <onboarding@resend.dev>",
        to: [ownerEmail],
        subject: `${creatorName} צירף/ה לך משימה${taskPreview}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>נוספה לך משימה חדשה</h2>
            <p><strong>${creatorName}</strong> צירף/ה לך משימה חדשה לגליון <strong>${sheetName || "משותף"}</strong>.</p>
            ${normalizedTaskDescription ? `<p>המשימה: <strong>${normalizedTaskDescription}</strong></p>` : ""}
            <hr style="margin: 20px 0;" />
            <a href="https://excel-life-sync.lovable.app/personal" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
              פתח את האפליקציה
            </a>
          </div>
        `,
      }),
    });

    const emailResult = await emailRes.json();

    // Also send push notification to the owner
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", ownerUserId);

    if (pushSubs && pushSubs.length > 0) {
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

      if (vapidPrivateKey && vapidPublicKey) {
        // Use web-push via fetch to send notifications
        for (const sub of pushSubs) {
          try {
            // Simple notification via the existing send-push-notifications function pattern
            await fetch(`${supabaseUrl}/functions/v1/send-push-notifications`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                subscriptions: [{
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                }],
                title: `📋 ${creatorName} הוסיף/ה משימה`,
                body: normalizedTaskDescription
                  ? `${normalizedTaskDescription.slice(0, 100)}`
                  : `משימה חדשה נוספה לגליון ${sheetName || "משותף"}`,
              }),
            });
          } catch (pushErr) {
            console.error("Push notification error:", pushErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, emailResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
