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
    const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const useGateway = !!lovableKey

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

    // Send to each admin separately to avoid array rejection
    const results = await Promise.allSettled(
      ADMIN_EMAILS.map(async (toEmail) => {
        const apiUrl = useGateway
          ? 'https://connector-gateway.lovable.dev/resend/emails'
          : 'https://api.resend.com/emails'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (useGateway) {
          headers['Authorization'] = `Bearer ${lovableKey}`
          headers['X-Connection-Api-Key'] = resendKey
        } else {
          headers['Authorization'] = `Bearer ${resendKey}`
        }
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: useGateway ? 'Tabro <info@tabro.org>' : 'Tabro <onboarding@resend.dev>',
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
    await serviceClient.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'contact-form',
      recipient_email: 'info@tabro.org',
      status: succeeded > 0 ? 'sent' : 'failed',
      error_message: failed.length > 0 ? JSON.stringify(failed.map(f => (f as any).reason?.message).slice(0, 500)) : null,
      metadata: { subject, category, userEmail, recipients: ADMIN_EMAILS, succeeded },
    })

    if (succeeded === 0) {
      const errMsg = failed.length > 0 ? (failed[0] as any).reason?.message || 'Unknown error' : 'Failed to send'
      return new Response(JSON.stringify({ error: errMsg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, sent: succeeded }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
