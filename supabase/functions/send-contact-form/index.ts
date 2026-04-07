import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAILS = ['omri855655@gmail.com', 'tabro855@gmail.com', 'info@tabro.org']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { subject, message, category, userEmail } = await req.json()
    const messageId = crypto.randomUUID()

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message required' }), { status: 400, headers: corsHeaders })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Email not configured' }), { status: 500, headers: corsHeaders })
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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Tabro <info@tabro.org>',
        to: ADMIN_EMAILS,
        subject: `[פנייה] ${categoryLabels[category] || ''} - ${subject || 'ללא נושא'}`,
        html: emailBody,
        reply_to: userEmail !== 'אנונימי' ? userEmail : undefined,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await serviceClient.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'contact-form',
        recipient_email: 'info@tabro.org',
        status: 'failed',
        error_message: err.slice(0, 1000),
        metadata: { subject, category, userEmail },
      })
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500, headers: corsHeaders })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    await serviceClient.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'contact-form',
      recipient_email: 'info@tabro.org',
      status: 'sent',
      metadata: { subject, category, userEmail, recipients: ADMIN_EMAILS },
    })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
