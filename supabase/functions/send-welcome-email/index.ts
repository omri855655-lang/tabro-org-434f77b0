import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAILS = ['info@tabro.org', 'tabro855@gmail.com'];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWelcomeEmailHtml(lang: string, fullName: string, username: string, origin: string) {
  if (lang === "en") {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #fafafa; border-radius: 12px;">
        <h1 style="margin: 0 0 8px 0; color: #111827;">Welcome to the App! 🎉</h1>
        <p style="margin: 0 0 4px 0; color: #374151;">Hi <strong>${fullName}</strong>, we're glad you joined!</p>
        <p style="margin: 0 0 16px 0; color: #6b7280;">Your username: <strong>@${username}</strong></p>
        
        <h2 style="margin: 24px 0 12px 0; font-size: 18px; color: #111827;">📋 What you can do</h2>
        
        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">✅ Personal & Work Tasks</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Create task sheets, organize by category, track progress with statuses (Not Started / In Progress / Done), set deadlines and urgency levels.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">👥 Sheet Sharing</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Share your task sheets with others by email. Set view or edit permissions. Collaborators see who created each task.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📚 Books, Shows & Podcasts</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Track your reading list, TV shows, and podcasts. Mark status changes with timestamps for annual statistics.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📅 Personal Planner</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Visual daily/weekly schedule. Drag to resize events, 5-minute precision, color-coded categories.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🤖 AI Assistant</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Get AI-powered task recommendations and mental coaching for difficult tasks.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📊 Dashboard & Projects</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Overview of all tasks, completion rates, project management with team members and task assignments.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🎓 Courses & Challenges</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Manage your learning courses with syllabi, schedule lessons, and track 30-day challenges.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🎵 Deeply Focus</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Ambient sound presets for deep focus and concentration while working.</p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${origin}"
             style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
            Open the App →
          </a>
        </div>
      </div>
    `;
  }

  // Hebrew (default)
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #fafafa; border-radius: 12px;">
      <h1 style="margin: 0 0 8px 0; color: #111827;">ברוך הבא למערכת! 🎉</h1>
      <p style="margin: 0 0 4px 0; color: #374151;">היי <strong>${fullName}</strong>, שמחים שהצטרפת!</p>
      <p style="margin: 0 0 16px 0; color: #6b7280;">שם המשתמש שלך: <strong>@${username}</strong></p>
      
      <h2 style="margin: 24px 0 12px 0; font-size: 18px; color: #111827;">📋 מה אפשר לעשות כאן</h2>
      
      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">✅ משימות אישיות ועבודה</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">צור גליונות משימות, ארגן לפי קטגוריה, עקוב אחרי התקדמות עם סטטוסים (טרם החל / בטיפול / בוצע), הגדר דדליינים ודחיפות.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">👥 שיתוף גליונות</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">שתף את גליונות המשימות שלך עם אחרים לפי אימייל. הגדר הרשאות צפייה או עריכה. שותפים רואים מי יצר כל משימה.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📚 ספרים, סדרות ופודקאסטים</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">עקוב אחרי רשימת הקריאה, הסדרות והפודקאסטים שלך. סמן שינויי סטטוס עם חותמות זמן לסטטיסטיקות שנתיות.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📅 מתכנן לו״ז אישי</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">לוז יומי/שבועי ויזואלי. גרור לשינוי גודל אירועים, דיוק של 5 דקות, קטגוריות צבעוניות.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🤖 עוזר AI</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">קבל המלצות AI חכמות למשימות ואימון מנטלי למשימות מאתגרות.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📊 דשבורד ופרויקטים</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">סקירה כללית של כל המשימות, אחוזי ביצוע, ניהול פרויקטים עם חברי צוות ושיוך משימות.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🎓 קורסים ואתגרים</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">נהל קורסי לימוד עם סילבוס, תזמן שיעורים ועקוב אחרי אתגרי 30 יום.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🔄 שגרה יומית</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">הגדר משימות חוזרות יומיות, שבועיות או חודשיות ועקוב אחרי השלמתן.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🎵 Deeply - מוזיקת ריכוז</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">פריסטים של צלילי אווירה לריכוז עמוק בזמן עבודה.</p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${origin}"
           style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
          כניסה לאפליקציה ←
        </a>
      </div>
    </div>
  `;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user?.id || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, display_name, username, welcome_email_sent, preferred_language")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.welcome_email_sent) {
      return new Response(JSON.stringify({ sent: false, reason: "already_sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      profile?.display_name ||
      user.email.split("@")[0];

    const username = profile?.username || user.email.split("@")[0];
    const lang = profile?.preferred_language || "he";

    // Always link to the published website
    const origin = "https://excel-life-sync.lovable.app";

    const emailHtml = getWelcomeEmailHtml(lang, fullName, username, origin);
    const subject = lang === "en" ? "Welcome to the App! ✅" : "ברוך הבא למערכת ✅";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Welcome <onboarding@resend.dev>",
        to: [user.email],
        subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      throw new Error(`Resend error: ${resendError}`);
    }

    await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-welcome-email error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
