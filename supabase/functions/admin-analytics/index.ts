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
      const { data: recentEmailLogRaw } = await adminClient
        .from('email_send_log')
        .select('message_id, template_name, recipient_email, status, error_message, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(50)

      const inbox = (recentEmailLogRaw || []).filter((row) => row.template_name === 'contact-form' || row.template_name === 'contact_form')
      const outbox = (recentEmailLogRaw || []).filter((row) => row.template_name !== 'contact-form' && row.template_name !== 'contact_form')

      return new Response(
        JSON.stringify({
          mailboxAddress: 'info@tabro.org',
          recentEmailLog: recentEmailLogRaw || [],
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
        { count: totalUsers },
        { count: recentSignups },
        { count: totalTasks },
        { count: totalLoginLogs },
        { data: loginLogsRaw },
        { data: adminEmailsRaw },
        { data: userListRaw },
      ] = await Promise.all([
        adminClient.from('profiles').select('id', { count: 'exact', head: true }),
        adminClient.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso),
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
          .limit(50),
      ])

      const recentLoginLogs = (loginLogsRaw || []).filter((log) => {
        const when = log.logged_in_at ? new Date(log.logged_in_at).getTime() : 0
        return when >= new Date(sinceIso).getTime()
      })

      const activeUserKeys = new Set(
        recentLoginLogs
          .map((log: any) => log.user_id || log.user_email)
          .filter(Boolean),
      )

      const loginByUser = Array.from(
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

      const adminEmails = (adminEmailsRaw || []).map((entry: any) => ({
        user_id: entry.user_id,
        created_at: entry.created_at,
        email: entry.profiles?.email || '',
      }))

      const safeUserList = userListRaw || []
      const derivedTotalUsers = Math.max(totalUsers || 0, safeUserList.length)
      const derivedRecentSignups = Math.max(
        recentSignups || 0,
        safeUserList.filter((user: any) => user.created_at && new Date(user.created_at).getTime() >= new Date(sinceIso).getTime()).length,
      )

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
