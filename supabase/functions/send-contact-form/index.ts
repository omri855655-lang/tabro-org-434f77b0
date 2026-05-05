import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildPushPayload,
  type PushSubscription as WebPushSubscription,
  type PushMessage,
  type VapidKeys,
} from "https://esm.sh/@block65/webcrypto-web-push@1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAILS = ['omri855655@gmail.com', 'tabro855@gmail.com', 'info@tabro.org']

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  data: object,
  vapid: VapidKeys,
) {
  const sub: WebPushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  const message: PushMessage = {
    data: JSON.stringify(data),
    options: { ttl: 86400 },
  };
  const payload = await buildPushPayload(message, sub, vapid);
  const res = await fetch(subscription.endpoint, {
    method: payload.method || "POST",
    headers: payload.headers,
    body: payload.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Push failed (${res.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { subject, message, category, userEmail } = await req.json()
    const messageId = crypto.randomUUID()

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const categoryLabels: Record<string, string> = {
      bug: '🐛 דיווח על באג',
      feature: '💡 בקשת פיצ\'ר',
      advice: '📝 עצה / הצעה',
      other: '📩 אחר',
    }

    const emailBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>פנייה חדשה מהמערכת</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">סוג:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${categoryLabels[category] || category}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">מאת:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${userEmail}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">נושא:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${subject || 'ללא נושא'}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      </div>
    `

    const emailSubject = `[פנייה] ${categoryLabels[category] || ''} - ${subject || 'ללא נושא'}`
    const replyTo = userEmail !== 'אנונימי' && userEmail !== 'Anonymous' ? userEmail : undefined
    const fromAddress = 'Tabro <noreply@tabro.org>'
    const messagePreview = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 240)

    const results = await Promise.allSettled(
      ADMIN_EMAILS.map(async (toEmail) => {
        const apiUrl = lovableKey
          ? 'https://connector-gateway.lovable.dev/resend/emails'
          : 'https://api.resend.com/emails'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (lovableKey) {
          headers['Authorization'] = `Bearer ${lovableKey}`
          headers['X-Connection-Api-Key'] = resendKey
        } else {
          headers['Authorization'] = `Bearer ${resendKey}`
        }
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: fromAddress,
            to: [toEmail],
            subject: emailSubject,
            html: emailBody,
            reply_to: replyTo,
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        return toEmail
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected')

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: logError } = await serviceClient.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'contact-form',
      recipient_email: ADMIN_EMAILS.join(', '),
      status: succeeded > 0 ? 'sent' : 'failed',
      error_message: failed.length > 0 ? JSON.stringify(failed.map(f => (f as any).reason?.message).slice(0, 500)) : null,
      metadata: {
        subject,
        category,
        userEmail,
        from: userEmail,
        recipients: ADMIN_EMAILS,
        succeeded,
        messagePreview,
        messageBody: message,
        followUpSuggested: category === 'bug' ? 'מומלץ לחזור עם עדכון סטטוס' : 'מומלץ לבדוק אם נדרש follow-up',
        mailbox_type: 'inbox',
        message_source: 'contact_form',
      },
    })

    const { data: adminUsers } = await serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")
    const vapid: VapidKeys | null =
      vapidPublicKey && vapidPrivateKey
        ? {
            subject: "mailto:push@lovable.app",
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
          }
        : null

    for (const admin of adminUsers || []) {
      const { data: pushSubs } = await serviceClient
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", admin.user_id)

      let pushed = false

      if (vapid && pushSubs && pushSubs.length > 0) {
        for (const sub of pushSubs) {
          try {
            await sendPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              {
                title: "📨 פנייה חדשה ל-Tabro",
                body: `${categoryLabels[category] || category} • ${subject || 'ללא נושא'}`,
                url: "/personal",
              },
              vapid,
            )
            pushed = true
          } catch (error) {
            console.error("Contact-form push notification error:", error)
          }
        }
      }

      await serviceClient.from("sent_notifications").insert({
        user_id: admin.user_id,
        notification_type: "contact_form",
        channel: pushed ? "push" : "email",
      })
    }

    if (succeeded === 0) {
      const errMsg = failed.length > 0 ? (failed[0] as any).reason?.message || 'Unknown error' : 'Failed to send'
      return new Response(JSON.stringify({ error: errMsg, log_error: logError?.message || null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, sent: succeeded, notifiedAdmins: (adminUsers || []).length, log_error: logError?.message || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
