import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'stats'

    // Password verification doesn't require auth
    if (action === 'verify_password') {
      const correctPass = Deno.env.get('ADMIN_DASHBOARD_PASSWORD') || ''
      const ok = correctPass && body.password === correctPass
      return new Response(JSON.stringify({ ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const adminClient = createClient(supabaseUrl, serviceKey)

    // Check admin role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // body and action already parsed above

    if (action === 'stats') {
      // Get total users count
      const listResult = await adminClient.auth.admin.listUsers({ perPage: 1, page: 1 })
      const totalUsers = listResult.data?.users?.length ?? 0

      // Get users list with created_at
      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000, page: 1 })
      const users = usersData?.users || []

      // Recent signups (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const recentSignups = users.filter(u => u.created_at >= thirtyDaysAgo).length

      // Recent logins (last 30 days)
      const recentLogins = users.filter(u => u.last_sign_in_at && u.last_sign_in_at >= thirtyDaysAgo).length

      // Login log entries
      const { data: loginLogs, count: totalLogins } = await adminClient
        .from('admin_login_log')
        .select('*', { count: 'exact' })
        .order('logged_in_at', { ascending: false })
        .limit(50)

      // Recent email activity for admin mailbox
      const { data: rawEmailLog } = await adminClient
        .from('email_send_log')
        .select('message_id, template_name, recipient_email, status, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

      const seenMessageIds = new Set<string>()
      const recentEmailLog = []
      for (const row of (rawEmailLog || [])) {
        const dedupeKey = row.message_id || `${row.template_name}:${row.recipient_email}:${row.created_at}`
        if (seenMessageIds.has(dedupeKey)) continue
        seenMessageIds.add(dedupeKey)
        recentEmailLog.push(row)
        if (recentEmailLog.length >= 30) break
      }

      // Tasks count
      const { count: totalTasks } = await adminClient.from('tasks').select('*', { count: 'exact', head: true })

      // Admin users list
      const { data: adminRoles } = await adminClient.from('user_roles').select('*').eq('role', 'admin')
      const adminEmails = []
      for (const ar of (adminRoles || [])) {
        const found = users.find(u => u.id === ar.user_id)
        if (found) adminEmails.push({ email: found.email, user_id: ar.user_id, created_at: ar.created_at })
      }

      // User list summary
      const userList = users.map(u => ({
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))

      return new Response(JSON.stringify({
        totalUsers: totalUsers || users.length,
        recentSignups,
        recentLogins,
        totalTasks,
        totalLoginLogs: totalLogins || 0,
        loginLogs: loginLogs || [],
        adminEmails,
        userList,
        mailboxAddress: 'info@tabro.org',
        recentEmailLog,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'add_admin') {
      const email = body.email?.trim().toLowerCase()
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: corsHeaders })
      }
      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const target = usersData?.users?.find(u => u.email === email)
      if (!target) {
        return new Response(JSON.stringify({ error: 'User not found. They must register first.' }), { status: 404, headers: corsHeaders })
      }
      const { error } = await adminClient.from('user_roles').insert({ user_id: target.id, role: 'admin' })
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'send_email') {
      const { to, subject, body: htmlBody, reply_to } = body
      if (!to || !subject || !htmlBody) {
        return new Response(JSON.stringify({ error: 'to, subject, body required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const idempotencyKey = `admin-msg-${crypto.randomUUID()}`
      const lovableKey = Deno.env.get('LOVABLE_API_KEY')
      const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
      const messageId = crypto.randomUUID()
      const failureMessages: string[] = []

      const { data: sendData, error: sendError } = await adminClient.functions.invoke(
        'send-transactional-email',
        {
          body: {
            templateName: 'admin-message',
            recipientEmail: to,
            idempotencyKey,
            templateData: { subject, body: htmlBody },
            replyTo: reply_to || 'info@tabro.org',
          },
        }
      )

      const sendResponseData = (sendData ?? null) as Record<string, unknown> | null
      if (!sendError && !sendResponseData?.error) {
        return new Response(JSON.stringify({ success: true, queued: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const queuedError =
        (sendError && (sendError.message || String(sendError))) ||
        (typeof sendResponseData?.error === 'string' && sendResponseData.error) ||
        'Failed to queue email'
      failureMessages.push(`send-transactional-email: ${String(queuedError).slice(0, 500)}`)

      if (!resendKey) {
        await adminClient.from('email_send_log').insert({
          message_id: idempotencyKey,
          template_name: 'admin-compose',
          recipient_email: to,
          status: 'failed',
          error_message: failureMessages.join(' | ').slice(0, 1000),
          metadata: { subject, sent_by: user.email, reply_to: reply_to || 'info@tabro.org' },
        })
        return new Response(JSON.stringify({ error: failureMessages.join(' | ') || 'No email API key configured' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const emailPayload = {
        from: 'Tabro <noreply@notify.tabro.org>',
        to: [to],
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;">${String(htmlBody).replace(/\n/g, '<br/>')}</div>`,
        reply_to: reply_to || 'info@tabro.org',
      }

      const deliveryAttempts: Array<{
        label: string
        apiUrl: string
        headers: Record<string, string>
      }> = []

      if (lovableKey) {
        deliveryAttempts.push({
          label: 'lovable-gateway',
          apiUrl: 'https://connector-gateway.lovable.dev/resend/emails',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableKey}`,
            'X-Connection-Api-Key': resendKey,
          },
        })
      }

      deliveryAttempts.push({
        label: 'resend-direct',
        apiUrl: 'https://api.resend.com/emails',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
      })

      let deliveredVia: string | null = null

      for (const attempt of deliveryAttempts) {
        try {
          const emailRes = await fetch(attempt.apiUrl, {
            method: 'POST',
            headers: attempt.headers,
            body: JSON.stringify(emailPayload),
          })

          if (emailRes.ok) {
            deliveredVia = attempt.label
            break
          }

          const resBody = await emailRes.text()
          const trimmedBody = resBody.slice(0, 500)
          const errorDetail = resBody.includes('not verified') || resBody.toLowerCase().includes('sandbox')
            ? `Sandbox limitation: can only send to the Resend account owner email. Complete domain verification in Cloud → Emails to send to any address. (${trimmedBody.slice(0, 200)})`
            : `${attempt.label}: ${trimmedBody || `HTTP ${emailRes.status}`}`

          failureMessages.push(errorDetail)
        } catch (error) {
          failureMessages.push(
            `${attempt.label}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      if (!deliveredVia) {
        const errorDetail = failureMessages.join(' | ').slice(0, 1000) || 'Unknown email delivery error'
        await adminClient.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'admin-compose',
          recipient_email: to,
          status: 'failed',
          error_message: errorDetail,
          metadata: { subject, sent_by: user.email, reply_to: reply_to || 'info@tabro.org' },
        })

        return new Response(JSON.stringify({
          error: errorDetail,
          code: 'EMAIL_DELIVERY_FAILED',
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      await adminClient.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'admin-compose',
        recipient_email: to,
        status: 'sent',
        metadata: {
          subject,
          sent_by: user.email,
          reply_to: reply_to || 'info@tabro.org',
          delivered_via: deliveredVia,
        },
      })
      return new Response(JSON.stringify({ success: true, delivered_via: deliveredVia }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
      code: 'ADMIN_ANALYTICS_UNHANDLED',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
