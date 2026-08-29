import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1.81.0";

const jsonHeaders = { "Content-Type": "application/json" };
const MAX_BODY_LENGTH = 50_000;

const compactText = (value: unknown, limit = MAX_BODY_LENGTH) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);

const normalizeAddresses = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((address) => String(address || "").trim().toLowerCase()).filter(Boolean);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const signingSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const resendKey = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY");
    if (!signingSecret || !resendKey) {
      return new Response(JSON.stringify({ error: "Inbound email is not configured" }), { status: 503, headers: jsonHeaders });
    }

    const rawBody = await req.text();
    const payload = new Webhook(signingSecret).verify(rawBody, {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    }) as Record<string, any>;

    if (payload.type !== "email.received") {
      return new Response(JSON.stringify({ received: true, ignored: true }), { headers: jsonHeaders });
    }

    const emailId = String(payload.data?.email_id || "");
    if (!emailId) throw new Error("Missing inbound email id");

    const recipients = normalizeAddresses(payload.data?.to);
    const allowedRecipients = (Deno.env.get("INBOUND_EMAIL_RECIPIENTS") || "info@tabro.org")
      .split(",")
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean);
    if (!recipients.some((address) => allowedRecipients.includes(address))) {
      return new Response(JSON.stringify({ received: true, ignored: true }), { headers: jsonHeaders });
    }

    const contentResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (!contentResponse.ok) throw new Error(`Unable to fetch inbound email (${contentResponse.status})`);
    const content = await contentResponse.json();
    const body = compactText(content.text || content.html);
    const sender = String(content.from || payload.data?.from || "").slice(0, 500);
    const subject = String(content.subject || payload.data?.subject || "ללא נושא").slice(0, 500);
    const messageId = `resend-inbound:${emailId}`;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await serviceClient
      .from("email_send_log")
      .select("id")
      .eq("message_id", messageId)
      .eq("status", "sent")
      .maybeSingle();
    if (existing) return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: jsonHeaders });

    const attachments = Array.isArray(content.attachments)
      ? content.attachments.slice(0, 20).map((attachment: any) => ({
          filename: String(attachment.filename || "attachment").slice(0, 250),
          content_type: String(attachment.content_type || "").slice(0, 120),
          content_disposition: String(attachment.content_disposition || "").slice(0, 80),
        }))
      : [];

    const { error: insertError } = await serviceClient.from("email_send_log").insert({
      message_id: messageId,
      template_name: "inbound-email",
      recipient_email: recipients.join(", ").slice(0, 1_000),
      status: "sent",
      metadata: {
        mailbox_type: "inbox",
        message_source: "resend_inbound",
        resend_email_id: emailId,
        subject,
        from: sender,
        to: recipients,
        messagePreview: compactText(body, 240),
        messageBody: body,
        attachments,
        received_at: payload.created_at || new Date().toISOString(),
      },
    });
    if (insertError && insertError.code !== "23505") throw insertError;

    const { data: adminUsers } = await serviceClient.from("user_roles").select("user_id").eq("role", "admin");
    if (adminUsers?.length) {
      await serviceClient.from("sent_notifications").insert(
        adminUsers.map((admin) => ({
          user_id: admin.user_id,
          notification_type: "inbound_email",
          channel: "in_app",
        })),
      );
    }

    return new Response(JSON.stringify({ received: true }), { headers: jsonHeaders });
  } catch (error) {
    console.error("Inbound email webhook error", error);
    return new Response(JSON.stringify({ error: "Invalid or failed inbound email webhook" }), { status: 400, headers: jsonHeaders });
  }
});
