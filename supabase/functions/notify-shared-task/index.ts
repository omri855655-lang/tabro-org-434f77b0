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
        subject: `${creatorName} הוסיף/ה משימה חדשה בגליון ${sheetName || "משותף"}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>משימה חדשה בגליון המשותף שלך</h2>
            <p><strong>${creatorName}</strong> הוסיף/ה משימה חדשה לגליון <strong>${sheetName || "משותף"}</strong>.</p>
            ${taskDescription ? `<p>תיאור המשימה: <em>${taskDescription}</em></p>` : ""}
            <hr style="margin: 20px 0;" />
            <a href="https://excel-life-sync.lovable.app/personal" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
              פתח את האפליקציה
            </a>
          </div>
        `,
      }),
    });

    const emailResult = await emailRes.json();

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
