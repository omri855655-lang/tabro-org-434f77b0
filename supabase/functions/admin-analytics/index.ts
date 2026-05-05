import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
}

type MailLogRow = {
  message_id: string | null
  template_name: string
  recipient_email: string
  status: string
  error_message: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

function inferMailboxType(row: MailLogRow): 'inbox' | 'outbox' {
  const mailboxType = typeof row.metadata?.mailbox_type === 'string' ? row.metadata.mailbox_type : null
  if (mailboxType === 'inbox' || mailboxType === 'outbox') {
    return mailboxType
  }
  if (row.template_name === 'contact-form' || row.template_name === 'contact_form') {
    return 'inbox'
  }
  return 'outbox'
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
    const hasAdminPassword = !!correctPass && (body.admin_password === correctPass || adminPasswordHeader === correctPass)

    if (action === 'verify_password') {
      const ok = !!correctPass && body.password === correctPass
      return new Response(JSON.stringify({ ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceKey)

    if (action === 'send_email' && hasAdminPassword) {
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
        const { error: logError } = await adminClient.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'admin-compose',
          recipient_email: to,
          status: 'failed',
          error_message: 'No email API key configured',
          metadata: {
            subject,
            body: plainBody,
            body_preview: plainBody.slice(0, 280),
            sent_by: 'admin-password',
            reply_to: replyTo,
            mailbox_type: 'outbox',
          },
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
        const { error: logError } = await adminClient.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'admin-compose',
          recipient_email: to,
          status: 'failed',
          error_message: errorDetail,
          metadata: {
            subject,
            body: plainBody,
            body_preview: plainBody.slice(0, 280),
            sent_by: 'admin-password',
            reply_to: replyTo,
            mailbox_type: 'outbox',
          },
        })
        return new Response(JSON.stringify({ error: errorDetail, code: 'EMAIL_DELIVERY_FAILED', log_error: logError?.message || null }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: sentLogError } = await adminClient.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'admin-compose',
        recipient_email: to,
        status: 'sent',
        metadata: {
          subject,
          body: plainBody,
          body_preview: plainBody.slice(0, 280),
          sent_by: 'admin-password',
          reply_to: replyTo,
          delivered_via: deliveredVia,
          mailbox_type: 'outbox',
        },
      })
      return new Response(JSON.stringify({ success: true, delivered_via: deliveredVia, log_error: sentLogError?.message || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const allowPasswordBypass = hasAdminPassword && ['stats', 'mailbox', 'add_admin', 'remove_admin'].includes(action)

    if (!allowPasswordBypass) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders,
        })
      }

      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser()

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders,
        })
      }

      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        })
      }
    }

    if (action === 'mailbox') {
      const { data: recentEmailLogRaw, error: mailboxError } = await adminClient
        .from('email_send_log')
        .select('message_id, template_name, recipient_email, status, error_message, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(50)

      if (mailboxError) {
        return new Response(
          JSON.stringify({ error: `mailbox query failed: ${mailboxError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const normalizedEmailLog = (recentEmailLogRaw || []).map((row: MailLogRow) => ({
        ...row,
        metadata: {
          ...(row.metadata || {}),
          mailbox_type: inferMailboxType(row),
        },
      }))

      const inbox = normalizedEmailLog.filter((row) => row.metadata?.mailbox_type === 'inbox')
      const outbox = normalizedEmailLog.filter((row) => row.metadata?.mailbox_type === 'outbox')

      return new Response(
        JSON.stringify({
          mailboxAddress: 'info@tabro.org',
          recentEmailLog: normalizedEmailLog,
          inboxCount: inbox.length,
          outboxCount: outbox.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (action === 'stats') {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const sinceIso = since.toISOString()

      const [
        authUsersResult,
        { count: totalTasks },
        { count: totalLoginLogs },
        { data: loginLogsRaw },
        { data: adminEmailsRaw },
        { data: userProfilesRaw },
      ] = await Promise.all([
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        adminClient.from('tasks').select('id', { count: 'exact', head: true }),
        adminClient.from('admin_login_log').select('id', { count: 'exact', head: true }),
        adminClient.from('admin_login_log').select('user_email, user_id, logged_in_at').order('logged_in_at', { ascending: false }).limit(200),
        adminClient
          .from('user_roles')
          .select('user_id, created_at, profiles!inner(email)')
          .eq('role', 'admin')
          .order('created_at', { ascending: false }),
        adminClient
          .from('profiles')
          .select('email, created_at, last_sign_in_at')
          .order('created_at', { ascending: false })
          .limit(1000),
      ])

      const authUsers = authUsersResult.data?.users || []
      const authUsersByEmail = new Map(
        authUsers
          .map((authUser) => [String(authUser.email || '').toLowerCase(), authUser] as const)
          .filter(([email]) => email),
      )

      const mergedUsers = new Map<string, { email: string; created_at: string; last_sign_in_at: string | null }>()

      for (const profile of userProfilesRaw || []) {
        const email = String(profile.email || '').toLowerCase()
        if (!email) continue
        const authUser = authUsersByEmail.get(email)
        mergedUsers.set(email, {
          email: profile.email,
          created_at: profile.created_at || authUser?.created_at || new Date(0).toISOString(),
          last_sign_in_at: profile.last_sign_in_at || authUser?.last_sign_in_at || null,
        })
      }

      for (const authUser of authUsers) {
        const email = String(authUser.email || '').toLowerCase()
        if (!email || mergedUsers.has(email)) continue
        mergedUsers.set(email, {
          email: authUser.email || email,
          created_at: authUser.created_at || new Date(0).toISOString(),
          last_sign_in_at: authUser.last_sign_in_at || null,
        })
      }

      const mergedUserList = Array.from(mergedUsers.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100)

      const recentLoginLogs = (loginLogsRaw || []).filter((log) => {
        const when = log.logged_in_at ? new Date(log.logged_in_at).getTime() : 0
        return when >= new Date(sinceIso).getTime()
      })

      const activeUserKeys = new Set<string>()
      for (const log of recentLoginLogs) {
        const key = String(log.user_id || log.user_email || '').trim().toLowerCase()
        if (key) activeUserKeys.add(key)
      }
      for (const user of mergedUserList) {
        const when = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0
        if (when >= new Date(sinceIso).getTime()) {
          activeUserKeys.add(String(user.email || '').trim().toLowerCase())
        }
      }

      let loginByUser = Array.from(
        recentLoginLogs.reduce((acc: Map<string, { user_email: string; count: number; last_login_at: string }>, log: any) => {
          const key = log.user_id || log.user_email || 'unknown'
          const current = acc.get(key)
          if (!current) {
            acc.set(key, {
              user_email: log.user_email || 'unknown',
              count: 1,
              last_login_at: log.logged_in_at,
            })
          } else {
            current.count += 1
            if (new Date(log.logged_in_at).getTime() > new Date(current.last_login_at).getTime()) {
              current.last_login_at = log.logged_in_at
            }
          }
          return acc
        }, new Map()).values(),
      )
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      if (loginByUser.length === 0) {
        loginByUser = mergedUserList
          .filter((user) => user.last_sign_in_at && new Date(user.last_sign_in_at).getTime() >= new Date(sinceIso).getTime())
          .map((user) => ({
            user_email: user.email,
            count: 1,
            last_login_at: user.last_sign_in_at as string,
          }))
          .sort((a, b) => new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime())
          .slice(0, 20)
      }

      const adminEmails = (adminEmailsRaw || []).map((entry: any) => ({
        user_id: entry.user_id,
        created_at: entry.created_at,
        email: entry.profiles?.email || '',
      }))

      const safeUserList = mergedUserList
      const derivedTotalUsers = safeUserList.length
      const derivedRecentSignups = safeUserList.filter((user: any) => user.created_at && new Date(user.created_at).getTime() >= new Date(sinceIso).getTime()).length

      return new Response(
        JSON.stringify({
          totalUsers: derivedTotalUsers,
          recentSignups: derivedRecentSignups,
          recentLogins: recentLoginLogs.length,
          activeUsers30d: activeUserKeys.size,
          loginEvents30d: recentLoginLogs.length,
          totalTasks: totalTasks || 0,
          totalLoginLogs: totalLoginLogs || 0,
          loginLogs: loginLogsRaw || [],
          loginByUser,
          adminEmails,
          userList: safeUserList,
          mailboxAddress: 'info@tabro.org',
          recentEmailLog: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (action === 'add_admin') {
      const email = body.email?.trim().toLowerCase()
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: profile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (!profile) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error } = await adminClient.from('user_roles').upsert({
        user_id: profile.id,
        role: 'admin',
      })

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'remove_admin') {
      const userId = body.user_id
      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error } = await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin')

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        code: 'ADMIN_ANALYTICS_UNHANDLED',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
