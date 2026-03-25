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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // If GET with token - execute deletion
    if (req.method === "GET" && token) {
      // Find the deletion request
      const { data: tokenData, error: tokenError } = await supabase
        .from("action_tokens")
        .select("*")
        .eq("id", token)
        .eq("action", "delete_account")
        .eq("used", false)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          `<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h1>❌ קישור לא תקף</h1><p>הקישור פג תוקף או כבר שומש.</p></body></html>`,
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }, status: 400 }
        );
      }

      // Check expiry
      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          `<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h1>⏰ הקישור פג תוקף</h1><p>אנא בקש מחיקה מחדש מההגדרות.</p></body></html>`,
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }, status: 400 }
        );
      }

      const userId = tokenData.user_id;

      // Mark token as used
      await supabase.from("action_tokens").update({ used: true }).eq("id", token);

      // Delete all user data
      const tables = [
        "tasks", "books", "shows", "podcasts", "courses", "course_lessons",
        "projects", "project_tasks", "project_members", "calendar_events",
        "custom_board_items", "custom_boards", "daily_stopwatch", "dream_goals",
        "health_profiles", "nutrition_tracking", "payment_tracking",
        "shopping_items", "shopping_sheets", "shopping_sheet_collaborators",
        "checked_items", "recurring_tasks", "recurring_task_completions",
        "planner_conversations", "user_preferences", "push_subscriptions",
        "telegram_users", "mental_coaching_sessions", "sharing_activity_log",
        "sent_notifications", "action_tokens", "task_sheet_collaborators",
        "task_sheets", "profiles",
      ];

      for (const table of tables) {
        await supabase.from(table).delete().eq("user_id", userId);
      }

      // Delete the auth user
      await supabase.auth.admin.deleteUser(userId);

      return new Response(
        `<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h1>✅ החשבון נמחק בהצלחה</h1><p>כל הנתונים שלך הוסרו לצמיתות.</p><a href="/" style="color:#6366f1">חזור לדף הבית</a></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // POST - initiate deletion (send confirmation email)
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a deletion token
      const { data: tokenData, error: tokenError } = await supabase
        .from("action_tokens")
        .insert({
          user_id: user.id,
          task_id: user.id, // reuse field for user reference
          action: "delete_account",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      const confirmUrl = `${supabaseUrl}/functions/v1/delete-account-confirm?token=${tokenData.id}`;

      // Send email
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey && user.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Tabro <onboarding@resend.dev>",
            to: [user.email],
            subject: "אישור מחיקת חשבון - Tabro",
            html: `
              <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: auto;">
                <h2 style="color: #dc2626;">⚠️ אישור מחיקת חשבון</h2>
                <p>קיבלנו בקשה למחוק את החשבון שלך ב-Tabro.</p>
                <p><strong>פעולה זו תמחק את כל הנתונים שלך לצמיתות. לא ניתן לבטל פעולה זו.</strong></p>
                <p>אם ביקשת את זה, לחץ על הכפתור למטה לאישור:</p>
                <a href="${confirmUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
                  אשר מחיקת חשבון
                </a>
                <p style="color: #666; font-size: 12px;">הקישור תקף ל-24 שעות. אם לא ביקשת למחוק את החשבון, התעלם מהודעה זו.</p>
              </div>
            `,
          }),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
