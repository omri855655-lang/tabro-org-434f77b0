import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Unified email sending helper
async function sendEmailUnified(
  to: string[],
  subject: string,
  html: string,
  from: string = 'Tabro <noreply@notify.tabro.org>',
) {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return false;

  const apiUrl = lovableKey
    ? 'https://connector-gateway.lovable.dev/resend/emails'
    : 'https://api.resend.com/emails';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (lovableKey) {
    headers['Authorization'] = `Bearer ${lovableKey}`;
    headers['X-Connection-Api-Key'] = resendKey;
  } else {
    headers['Authorization'] = `Bearer ${resendKey}`;
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Email failed: ${text}`);
    return false;
  }
  return true;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 254);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const sourceSupabaseUrl = Deno.env.get("SOURCE_SUPABASE_URL") || supabaseUrl;
    const sourceAnonKey = Deno.env.get("SOURCE_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const sharesAuthDatabase = sourceSupabaseUrl === supabaseUrl;
    const sourceClient = createClient(sourceSupabaseUrl, sourceAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.slice("Bearer ".length).trim();
    const { data: { user: caller }, error: userError } = await sourceClient.auth.getUser(jwt);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerUserId = caller.id;

    const { ownerUserId, taskDescription, creatorName, sheetName, projectId, notifyAllMembers, assigneeEmails } = await req.json();
    const normalizedTaskDescription = typeof taskDescription === "string" ? taskDescription.trim() : "";
    const taskPreview = normalizedTaskDescription ? `: ${normalizedTaskDescription.slice(0, 80)}` : "";

    if (!ownerUserId || !creatorName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authorization: caller must be the owner OR a member of the project (when notifying members)
    if (projectId) {
      const callerEmail = normalizeEmail(caller.email);
      const { data: membershipByUser } = await sourceClient
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", callerUserId)
        .eq("status", "approved")
        .maybeSingle();
      const { data: membershipByEmail } = callerEmail
        ? await sourceClient
          .from("project_members")
          .select("id")
          .eq("project_id", projectId)
          .ilike("invited_email", callerEmail)
          .eq("status", "approved")
          .maybeSingle()
        : { data: null };
      const { data: ownedProject } = await sourceClient
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", callerUserId)
        .maybeSingle();
      if (!membershipByUser && !membershipByEmail && !ownedProject) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (ownerUserId !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine who to notify
    const targetUserIds = new Set<string>();
    const targetEmails = new Set<string>();

    if (projectId) {
      const { data: members } = await sourceClient
        .from("project_members")
        .select("user_id, invited_email")
        .eq("project_id", projectId)
        .eq("status", "approved");

      const allowedMemberEmails = new Set(
        (members || [])
          .map((member) => normalizeEmail(member.invited_email))
          .filter((email): email is string => Boolean(email)),
      );
      const requestedAssigneeEmails = Array.isArray(assigneeEmails)
        ? assigneeEmails.slice(0, 20).map(normalizeEmail).filter((email): email is string => Boolean(email))
        : [];

      if (requestedAssigneeEmails.length > 0) {
        for (const email of requestedAssigneeEmails) {
          if (!allowedMemberEmails.has(email)) {
            return new Response(JSON.stringify({ error: "Assignee is not an approved project member" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          targetEmails.add(email);
          const member = (members || []).find((item) => normalizeEmail(item.invited_email) === email);
          if (sharesAuthDatabase && member?.user_id && member.user_id !== callerUserId) {
            targetUserIds.add(member.user_id);
          }
        }
      } else if (notifyAllMembers) {
        for (const member of members || []) {
          if (sharesAuthDatabase && member.user_id && member.user_id !== callerUserId) {
            targetUserIds.add(member.user_id);
          }
          const email = normalizeEmail(member.invited_email);
          if (email) targetEmails.add(email);
        }
      }

    } else if (ownerUserId !== callerUserId) {
      targetUserIds.add(ownerUserId);
    }

    for (const targetUserId of targetUserIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(targetUserId);
      const email = normalizeEmail(userData?.user?.email);
      if (email) targetEmails.add(email);
    }

    if (targetUserIds.size === 0 && targetEmails.size === 0) {
      return new Response(JSON.stringify({ success: true, message: "No users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ userId?: string; email?: string; notified: boolean }> = [];

    for (const targetEmail of targetEmails) {
      try {
        const sent = await sendEmailUnified(
            [targetEmail],
            `${creatorName} צירף/ה משימה${taskPreview}`,
            `
              <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>נוספה משימה חדשה</h2>
                <p><strong>${escapeHtml(creatorName)}</strong> צירף/ה משימה חדשה ${sheetName ? `ל<strong>${escapeHtml(sheetName)}</strong>` : ""}.</p>
                ${normalizedTaskDescription ? `<p>המשימה: <strong>${escapeHtml(normalizedTaskDescription)}</strong></p>` : ""}
                <hr style="margin: 20px 0;" />
                <a href="https://omrigabayexcel.site/personal" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
                  פתח את האפליקציה
                </a>
              </div>
            `,
            'Tabro <noreply@notify.tabro.org>',
          );
        results.push({ email: targetEmail, notified: sent });
      } catch (emailErr) {
        console.error("Email error:", emailErr);
        results.push({ email: targetEmail, notified: false });
      }
    }

    for (const targetUserId of targetUserIds) {
      // Send push notification
      const { data: pushSubs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", targetUserId);

      if (pushSubs && pushSubs.length > 0) {
        for (const sub of pushSubs) {
          try {
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
                  : `משימה חדשה נוספה ל${sheetName || "פרויקט"}`,
              }),
            });
          } catch (pushErr) {
            console.error("Push notification error:", pushErr);
          }
        }
      }

      // Save in-app notification
      try {
        await supabase.from("sent_notifications").insert({
          user_id: targetUserId,
          notification_type: `project_task_added`,
          channel: "in_app",
        });
      } catch {}

      results.push({ userId: targetUserId, notified: true });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
