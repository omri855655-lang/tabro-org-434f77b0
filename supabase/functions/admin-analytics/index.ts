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

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'stats'

    if (action === 'stats') {
      // Get total users count
      const { count: totalUsers } = await adminClient.auth.admin.listUsers({ perPage: 1, page: 1 })

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

    if (action === 'remove_admin') {
      const targetUserId = body.user_id
      if (!targetUserId || targetUserId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot remove yourself' }), { status: 400, headers: corsHeaders })
      }
      await adminClient.from('user_roles').delete().eq('user_id', targetUserId).eq('role', 'admin')
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
