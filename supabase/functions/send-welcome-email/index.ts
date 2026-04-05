import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAILS = ['omri855655@gmail.com', 'tabro855@gmail.com', 'info@tabro.org'];

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
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Create task sheets, organize by category, track progress with statuses, set deadlines and urgency. Share sheets with others.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📅 Personal Planner</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Visual daily/weekly schedule with color-coded categories, holiday support, event reminders (1-60 min) and multiple send hours.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📊 Customizable Dashboard</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Customize your dashboard — choose which blocks to show, reorder them, and pick display mode (default/compact/cards) for each section.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📂 Project Management</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Projects with team, statuses (Not Started/In Progress/On Hold/Done), due dates, multi-assignee tasks and AI milestones.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🤖 AI Agent</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">A smart AI agent that understands the entire system — adds tasks, notes, events and reminders for you in natural language.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📚 Books, Shows, Podcasts & Courses</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Track media with annual statistics. Courses with syllabus, lessons and calendar sync.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🛒 Shopping & Payments</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Shared shopping lists, budget management with income/expenses, recurring payments and AI analysis.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🔔 Smart Notifications</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Email, Push & Telegram — choose specific send hours, quiet hours, calendar reminders and customized content per channel.</p>
        </div>

        <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🎵 Deeply, Notes, Dreams & More</h3>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Focus music, colorful notes, dream roadmaps, daily routines, challenges, nutrition tracking and stopwatch.</p>
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
        <p style="margin: 0; font-size: 13px; color: #6b7280;">צור גליונות משימות, ארגן לפי קטגוריה, עקוב עם סטטוסים, הגדר דדליינים ודחיפות. שתף גליונות עם אנשים אחרים.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📅 מתכנן לו״ז אישי</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">לוז יומי/שבועי ויזואלי עם קטגוריות צבעוניות, חגים, תזכורות לפני אירוע (1-60 דק׳) ושליחה במספר שעות ספציפיות.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📊 דשבורד מותאם אישית</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">התאם את הדשבורד — בחר אילו בלוקים להציג, שנה סדר, ובחר סוג תצוגה (רגיל/קומפקטי/כרטיסים) לכל חלק.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📂 ניהול פרויקטים</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">פרויקטים עם צוות, סטטוסים (לא התחיל/בטיפול/בהמתנה/בוצע), תאריכי יעד, ריבוי אחראים ואבני דרך AI.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🤖 סוכן AI חכם</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">סוכן AI שמבין את כל המערכת — מוסיף משימות, פתקים, אירועים ותזכורות בשבילך בשפה טבעית.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">📚 ספרים, סדרות, פודקאסטים וקורסים</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">עקוב אחרי מדיה עם סטטיסטיקות שנתיות. קורסים עם סילבוס, שיעורים וסנכרון ללוז.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🛒 קניות ותשלומים</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">רשימות קניות עם שיתוף, ניהול תקציב עם הכנסות/הוצאות, תשלומים חוזרים וניתוח AI.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🔔 התראות חכמות</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">מייל, Push וטלגרם — בחר שעות שליחה ספציפיות, שעות שקט, תזכורות לוז ותוכן מותאם לכל ערוץ.</p>
      </div>

      <div style="background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #111827;">🎵 Deeply, פתקים, חלומות ועוד</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">מוזיקת ריכוז, פתקים צבעוניים, מפת דרכים לחלומות, שגרה יומית, אתגרים, תזונה וסטופר.</p>
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
        from: "Tabro <info@tabro.org>",
        to: [user.email],
        subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      throw new Error(`Resend error: ${resendError}`);
    }

    // Notify admin about new signup
    const adminHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>🆕 הרשמה חדשה למערכת</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">שם:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${fullName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">אימייל:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${user.email}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">שם משתמש:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">@${username}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">שפה:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${lang}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">תאריך:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</td></tr>
        </table>
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Tabro System <info@tabro.org>",
        to: ADMIN_EMAILS,
        subject: `🆕 הרשמה חדשה: ${fullName} (${user.email})`,
        html: adminHtml,
      }),
    }).catch((e) => console.error("Admin notification error:", e));

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
