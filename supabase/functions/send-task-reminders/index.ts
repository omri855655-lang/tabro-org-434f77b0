import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today and tomorrow's dates
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    console.log(`Checking tasks: today=${todayStr}, tomorrow=${tomorrowStr}, 3days=${threeDaysStr}`);

    // Get all relevant tasks:
    // 1. Due today or tomorrow (not completed)
    // 2. Overdue tasks
    // 3. Urgent tasks
    const { data: allTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .neq("status", "בוצע");

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      throw tasksError;
    }

    // Get recurring tasks that are due today
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();

    const { data: recurringTasks, error: recurringError } = await supabase
      .from("recurring_tasks")
      .select("*");

    if (recurringError) {
      console.error("Error fetching recurring tasks:", recurringError);
    }

    // Get today's completions to know which recurring tasks are done
    const { data: todayCompletions, error: completionsError } = await supabase
      .from("recurring_task_completions")
      .select("*")
      .eq("completed_date", todayStr);

    if (completionsError) {
      console.error("Error fetching completions:", completionsError);
    }

    const completedTaskIds = new Set((todayCompletions || []).map(c => c.recurring_task_id));

    // Filter recurring tasks that are due today and not completed
    const recurringTasksDueToday = (recurringTasks || []).filter(task => {
      if (completedTaskIds.has(task.id)) return false;
      
      switch (task.frequency) {
        case "daily":
          return true;
        case "weekly":
          return task.day_of_week === dayOfWeek;
        case "monthly":
          return task.day_of_month === dayOfMonth;
        default:
          return false;
      }
    });

    if ((!allTasks || allTasks.length === 0) && recurringTasksDueToday.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending tasks found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Categorize tasks
    const tasksByUser: Record<string, {
      dueToday: typeof allTasks;
      dueTomorrow: typeof allTasks;
      dueThreeDays: typeof allTasks;
      overdue: typeof allTasks;
      urgent: typeof allTasks;
      recurring: typeof recurringTasksDueToday;
    }> = {};

    for (const task of (allTasks || [])) {
      if (!tasksByUser[task.user_id]) {
        tasksByUser[task.user_id] = {
          dueToday: [],
          dueTomorrow: [],
          dueThreeDays: [],
          overdue: [],
          urgent: [],
          recurring: [],
        };
      }

      const userTasks = tasksByUser[task.user_id];

      // Check if urgent
      if (task.urgent) {
        userTasks.urgent.push(task);
      }

      // Check due date
      if (task.planned_end) {
        if (task.planned_end === todayStr) {
          userTasks.dueToday.push(task);
        } else if (task.planned_end === tomorrowStr) {
          userTasks.dueTomorrow.push(task);
        } else if (task.planned_end > todayStr && task.planned_end <= threeDaysStr) {
          userTasks.dueThreeDays.push(task);
        } else if (task.planned_end < todayStr || task.overdue) {
          userTasks.overdue.push(task);
        }
      }
    }

    // Add recurring tasks to their users
    for (const task of recurringTasksDueToday) {
      if (!tasksByUser[task.user_id]) {
        tasksByUser[task.user_id] = {
          dueToday: [],
          dueTomorrow: [],
          dueThreeDays: [],
          overdue: [],
          urgent: [],
          recurring: [],
        };
      }
      tasksByUser[task.user_id].recurring.push(task);
    }

    let emailsSent = 0;

    // Send notifications to each user
    for (const [userId, categories] of Object.entries(tasksByUser)) {
      // Skip if no important tasks
      const hasImportantTasks = 
        categories.dueToday.length > 0 || 
        categories.dueTomorrow.length > 0 || 
        categories.overdue.length > 0 || 
        categories.urgent.length > 0 ||
        categories.recurring.length > 0;

      if (!hasImportantTasks) {
        continue;
      }

      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user?.email) {
        console.error(`Could not get email for user ${userId}:`, userError);
        continue;
      }

      const userEmail = userData.user.email;

      // Build email content
      const formatTasks = (tasks: typeof allTasks) => 
        tasks.map((t) => `• ${t.description} (${t.task_type === 'work' ? 'עבודה' : 'אישי'})`).join("<br/>");

      const formatRecurringTasks = (tasks: typeof recurringTasksDueToday) =>
        tasks.map((t) => {
          const freqLabel = t.frequency === 'daily' ? 'יומי' : t.frequency === 'weekly' ? 'שבועי' : 'חודשי';
          return `• ${t.title} (${freqLabel})`;
        }).join("<br/>");

      let emailContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #8b5cf6;">🔔 סיכום משימות יומי</h1>
          <p>שלום,</p>
          <p>הנה סיכום המשימות שדורשות את תשומת ליבך:</p>
      `;

      // Recurring tasks (purple section - show first!)
      if (categories.recurring.length > 0) {
        emailContent += `
          <div style="background: #faf5ff; border-right: 4px solid #a855f7; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #9333ea; margin: 0 0 8px 0;">🔄 לוז יומי - משימות קבועות להיום (${categories.recurring.length})</h3>
            <p style="margin: 0;">${formatRecurringTasks(categories.recurring)}</p>
          </div>
        `;
      }

      // Urgent tasks (red section)
      if (categories.urgent.length > 0) {
        emailContent += `
          <div style="background: #fef2f2; border-right: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #dc2626; margin: 0 0 8px 0;">🔥 משימות דחופות (${categories.urgent.length})</h3>
            <p style="margin: 0;">${formatTasks(categories.urgent)}</p>
          </div>
        `;
      }

      // Overdue tasks (orange section)
      if (categories.overdue.length > 0) {
        emailContent += `
          <div style="background: #fff7ed; border-right: 4px solid #f97316; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #ea580c; margin: 0 0 8px 0;">⚠️ משימות בחריגה (${categories.overdue.length})</h3>
            <p style="margin: 0;">${formatTasks(categories.overdue)}</p>
          </div>
        `;
      }

      // Due today (yellow section)
      if (categories.dueToday.length > 0) {
        emailContent += `
          <div style="background: #fefce8; border-right: 4px solid #eab308; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #ca8a04; margin: 0 0 8px 0;">📅 מועד היעד היום (${categories.dueToday.length})</h3>
            <p style="margin: 0;">${formatTasks(categories.dueToday)}</p>
          </div>
        `;
      }

      // Due tomorrow (blue section)
      if (categories.dueTomorrow.length > 0) {
        emailContent += `
          <div style="background: #eff6ff; border-right: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #2563eb; margin: 0 0 8px 0;">📆 מועד היעד מחר (${categories.dueTomorrow.length})</h3>
            <p style="margin: 0;">${formatTasks(categories.dueTomorrow)}</p>
          </div>
        `;
      }

      // Due in 3 days (gray section - optional mention)
      if (categories.dueThreeDays.length > 0) {
        emailContent += `
          <div style="background: #f3f4f6; border-right: 4px solid #9ca3af; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #6b7280; margin: 0 0 8px 0;">📋 מגיעות בקרוב (${categories.dueThreeDays.length})</h3>
            <p style="margin: 0;">${formatTasks(categories.dueThreeDays)}</p>
          </div>
        `;
      }

      emailContent += `
          <p style="margin-top: 24px;">בהצלחה! 💪</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">הודעה זו נשלחה אוטומטית ממערכת ניהול המשימות שלך.</p>
        </div>
      `;

      // Calculate subject line
      const totalImportant = categories.urgent.length + categories.overdue.length + categories.dueToday.length;
      let subject = "📅 סיכום משימות יומי";
      if (categories.urgent.length > 0) {
        subject = `🔥 ${categories.urgent.length} משימות דחופות דורשות תשומת לב!`;
      } else if (categories.overdue.length > 0) {
        subject = `⚠️ ${categories.overdue.length} משימות בחריגה`;
      } else if (categories.dueToday.length > 0) {
        subject = `📅 ${categories.dueToday.length} משימות מגיעות היום`;
      } else if (categories.dueTomorrow.length > 0) {
        subject = `📆 ${categories.dueTomorrow.length} משימות מגיעות מחר`;
      } else if (categories.recurring.length > 0) {
        subject = `🔄 ${categories.recurring.length} משימות קבועות להיום`;
      }

      console.log(`Sending email to ${userEmail}: ${subject}`);

      try {
        const apiUrl = 'https://api.resend.com/emails';
        const emailHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        emailHeaders['Authorization'] = `Bearer ${RESEND_API_KEY}`;
        const emailResponse = await fetch(apiUrl, {
          method: "POST",
          headers: emailHeaders,
          body: JSON.stringify({
            from: "Tabro <noreply@notify.tabro.org>",
            to: [userEmail],
            subject,
            html: emailContent,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.text();
          throw new Error(`Resend API error: ${errorData}`);
        }

        console.log("Email sent successfully to:", userEmail);
        emailsSent++;
      } catch (emailError) {
        console.error(`Failed to send email to ${userEmail}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Sent ${emailsSent} reminder emails`, 
        sent: emailsSent,
        tasksProcessed: (allTasks || []).length,
        recurringTasksIncluded: recurringTasksDueToday.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-task-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
