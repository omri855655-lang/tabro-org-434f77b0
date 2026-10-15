import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys,
} from "https://esm.sh/@block65/webcrypto-web-push@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const sendPush = async (
  subscription: { endpoint: string; p256dh: string; auth: string },
  data: object,
  vapid: VapidKeys,
) => {
  const target: PushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  const message: PushMessage = { data: JSON.stringify(data), options: { ttl: 86400 } };
  const payload = await buildPushPayload(message, target, vapid);
  const response = await fetch(subscription.endpoint, {
    method: payload.method || "POST",
    headers: payload.headers,
    body: payload.body,
  });
  if (!response.ok) throw new Error(`Push failed (${response.status})`);
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { token, taskId, kind } = await request.json();
    if (typeof token !== "string" || typeof taskId !== "string") return json({ error: "Invalid request" }, 400);
    const isProject = kind === "project";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: link } = await supabase
      .from(isProject ? "project_task_intake_links" : "task_intake_links")
      .select("id, owner_id")
      .eq("token", token.trim())
      .eq("enabled", true)
      .maybeSingle();
    if (!link) return json({ error: "Invalid link" }, 404);

    const recentThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const taskIdColumn = isProject ? "project_task_id" : "task_id";
    const { data: submission } = await supabase
      .from(isProject ? "project_task_intake_submissions" : "task_intake_submissions")
      .select(`${taskIdColumn}, requester_name, created_at`)
      .eq("link_id", link.id)
      .eq(taskIdColumn, taskId)
      .gte("created_at", recentThreshold)
      .maybeSingle();
    if (!submission) return json({ error: "Submission not found" }, 404);

    const [{ data: task }, { data: subscriptions }] = await Promise.all([
      supabase.from(isProject ? "project_tasks" : "tasks").select(isProject ? "title" : "description").eq("id", taskId).eq("user_id", link.owner_id).maybeSingle(),
      supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", link.owner_id),
    ]);
    if (!task) return json({ error: "Task not found" }, 404);
    const taskSummary = isProject
      ? (task as { title: string }).title
      : (task as { description: string }).description;

    const vapid: VapidKeys = {
      subject: "mailto:push@lovable.app",
      publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
      privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
    };
    let sent = 0;
    for (const subscription of subscriptions || []) {
      try {
        await sendPush(subscription, {
          title: isProject ? "משימה חדשה נוספה לפרויקט" : "משימה חדשה נוספה מהקישור",
          body: `${submission.requester_name}: ${taskSummary}`.slice(0, 180),
          tag: `${isProject ? "project" : "public"}-task-${taskId}`,
          url: "/personal",
          icon: "/app-icon.png",
        }, vapid);
        sent += 1;
      } catch (error) {
        console.error("Public task push failed", error);
      }
    }

    if (sent > 0) {
      await supabase.from("sent_notifications").insert({
        user_id: link.owner_id,
        task_id: taskId,
        notification_type: isProject ? "project_task_submitted" : "public_task_submitted",
        channel: "push",
      });
    }
    return json({ sent });
  } catch (error) {
    console.error("notify-public-task-submission error", error);
    return json({ error: "Internal error" }, 500);
  }
});
