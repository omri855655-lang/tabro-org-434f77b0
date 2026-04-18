import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'stats'
    const correctPass = Deno.env.get('ADMIN_DASHBOARD_PASSWORD') || ''
    const adminPasswordHeader = req.headers.get('x-admin-password') || ''

    if (action === 'verify_password') {
      const ok = !!correctPass && body.password === correctPass
      return new Response(JSON.stringify({ ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceKey)

    if (action === 'send_email' && correctPass && (
      body.admin_password === correctPass || adminPasswordHeader === correctPass
    )) {
      const to = body.to?.trim().toLowerCase()
      const subject = body.subject?.trim()
      const plainBody = body.body?.trim()
      const replyTo = body.reply_to?.trim() || 'info@tabro.org'

      if (!to || !subject || !plainBody) {
        return new Response(JSON.stringify({ error: 'to, subject, body required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const lovableKey = Deno.env.get('LOVABLE_API_KEY')
      const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
      const messageId = crypto.randomUUID()

      if (!resendKey) {
        await adminClient.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'admin-compose',
          recipient_email: to,
          status: 'failed',
          error_message: 'No email API key configured',
          metadata: { subject, sent_by: 'admin-password', reply_to: replyTo },
        })
        return new Response(JSON.stringify({ error: 'No email API key configured' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;">${String(plainBody).replace(/\n/g, '<br/>')}</div>`
      const emailPayload = {
        from: 'Tabro <noreply@tabro.org>',
        to: [to],
        subject,
        html,
        reply_to: replyTo,
      }

      const deliveryAttempts: Array<{ label: string; apiUrl: string; headers: Record<string, string> }> = []

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

      const failureMessages: string[] = []
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
          failureMessages.push(`${attempt.label}: ${resBody.slice(0, 500) || `HTTP ${emailRes.status}`}`)
        } catch (error) {
          failureMessages.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`)
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
          metadata: { subject, sent_by: 'admin-password', reply_to: replyTo },
        })
        return new Response(JSON.stringify({ error: errorDetail, code: 'EMAIL_DELIVERY_FAILED' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await adminClient.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'admin-compose',
        recipient_email: to,
        status: 'sent',
        metadata: { subject, sent_by: 'admin-password', reply_to: replyTo, delivered_via: deliveredVia },
      })
      return new Response(JSON.stringify({ success: true, delivered_via: deliveredVia }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    if (action === 'stats') {
      const listResult = await adminClient.auth.admin.listUsers({ perPage: 1, page: 1 })
      const totalUsers = listResult.data?.users?.length ?? 0

      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000, page: 1 })
      const users = usersData?.users || []

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const recentSignups = users.filter(u => u.created_at >= thirtyDaysAgo).length
      const recentLogins = users.filter(u => u.last_sign_in_at && u.last_sign_in_at >= thirtyDaysAgo).length

      const { data: loginLogs, count: totalLogins } = await adminClient
        .from('admin_login_log')
        .select('*', { count: 'exact' })
        .order('logged_in_at', { ascending: false })
        .limit(50)

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

      const { count: totalTasks } = await adminClient.from('tasks').select('*', { count: 'exact', head: true })
      const { data: adminRoles } = await adminClient.from('user_roles').select('*').eq('role', 'admin')
      const adminEmails = []
      for (const ar of (adminRoles || [])) {
        const found = users.find(u => u.id === ar.user_id)
        if (found) adminEmails.push({ email: found.email, user_id: ar.user_id, created_at: ar.created_at })
      }

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

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
      code: 'ADMIN_ANALYTICS_UNHANDLED',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
