import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is an update-status request
    const body = await req.json().catch(() => ({}));
    
    if (body.action === "update-status" && body.task_id && body.status) {
      const sourceType = body.source_type || "task";
      
      if (sourceType === "recurring_task") {
        if (body.status === "בוצע") {
          const todayStr = new Date().toISOString().split("T")[0];
          await supabase.from("recurring_task_completions").insert({
            recurring_task_id: body.task_id,
            user_id: user.id,
            completed_date: todayStr,
          });
        }
      } else {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ status: body.status })
          .eq("id", body.task_id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch last 50 notifications for this user (deduplicate by event_id + type, prefer push)
    const { data: notifications, error } = await supabase
      .from("sent_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    // Deduplicate: for same event_id + notification_type, keep only one (prefer push)
    const seen = new Map<string, any>();
    for (const n of (notifications || [])) {
      const key = n.event_id ? `${n.event_id}_${n.notification_type}` : n.id;
      if (!seen.has(key)) {
        seen.set(key, n);
      } else if (n.channel === "push") {
        seen.set(key, n); // prefer push entry
      }
    }
    const dedupedNotifications = Array.from(seen.values()).slice(0, 50);

    // Enrich notifications with event and task info
    const { data: recentContactLogs } = await supabase
      .from("email_send_log")
      .select("created_at, metadata, status, template_name")
      .eq("template_name", "contact-form")
      .order("created_at", { ascending: false })
      .limit(25);

    const contactLogs = recentContactLogs || [];
    const enrichedNotifications = [];
    for (const n of dedupedNotifications) {
      const enriched: any = { ...n };
      
      // Get event info for all notifications that have event_id
      if (n.event_id) {
        const { data: eventData } = await supabase
          .from("calendar_events")
          .select("id, title, source_id, source_type, start_time, end_time, category")
          .eq("id", n.event_id)
          .single();
        
        if (eventData) {
          enriched.event_info = eventData;
        }
      }

      // For completion notifications, also get task info if linked
      if (n.notification_type === "event_completion") {
        // Try task_id from notification first, then from event source_id
        const taskId = n.task_id || enriched.event_info?.source_id;
        const sourceType = enriched.event_info?.source_type;
        
        if (taskId && (sourceType === "personal_task" || sourceType === "work_task")) {
          const { data: task } = await supabase
            .from("tasks")
            .select("id, description, status, task_type")
            .eq("id", taskId)
            .single();
          if (task) {
            enriched.task_info = { ...task, source_type: "task" };
          }
        } else if (taskId && sourceType === "recurring_task") {
          const { data: recurringTask } = await supabase
            .from("recurring_tasks")
            .select("id, title")
            .eq("id", taskId)
            .single();
          if (recurringTask) {
            // Check if completed today
            const todayStr = new Date().toISOString().split("T")[0];
            const { data: completion } = await supabase
              .from("recurring_task_completions")
              .select("id")
              .eq("recurring_task_id", taskId)
              .eq("completed_date", todayStr)
              .limit(1);
            const isCompleted = (completion?.length || 0) > 0;
            enriched.task_info = { 
              id: recurringTask.id, 
              description: recurringTask.title, 
              source_type: "recurring_task",
              status: isCompleted ? "בוצע" : "טרם החל",
            };
          }
        }
      }

      if (n.notification_type === "contact_form") {
        const closestContactLog = contactLogs.find((log: any) => {
          const notificationTime = new Date(n.created_at).getTime();
          const logTime = new Date(log.created_at).getTime();
          return Math.abs(notificationTime - logTime) <= 10 * 60 * 1000;
        }) || contactLogs[0];

        if (closestContactLog?.metadata) {
          enriched.contact_info = {
            subject: closestContactLog.metadata.subject || "ללא נושא",
            category: closestContactLog.metadata.category || "other",
            from: closestContactLog.metadata.userEmail || "אנונימי",
            status: closestContactLog.status || null,
            preview: closestContactLog.metadata.messagePreview || "",
            followUpSuggested: closestContactLog.metadata.followUpSuggested || null,
          };
        }
      }
      
      enrichedNotifications.push(enriched);
    }

    return new Response(JSON.stringify({ notifications: enrichedNotifications }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-notifications error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
