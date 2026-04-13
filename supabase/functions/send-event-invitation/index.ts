import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_ADDRESS = 'Tabro <noreply@notify.tabro.org>'

// Format date in Israel timezone consistently
const formatDateIL = (dateStr: string, style: 'long' | 'short' = 'long') => {
  const d = new Date(dateStr)
  if (style === 'long') {
    return d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'long', timeStyle: 'short' })
  }
  return d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', timeStyle: 'short' })
}

// Convert Date to ICS format: 20260413T111000Z
function toICSDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Generate ICS content for Google Calendar / Outlook compatibility
function generateICS(event: any, inviterName: string, inviterEmail: string): string {
  const uid = `${event.id}@tabro.org`
  const now = toICSDate(new Date().toISOString())
  const dtStart = toICSDate(event.start_time)
  const dtEnd = toICSDate(event.end_time)
  const summary = (event.title || '').replace(/[,;\\]/g, ' ')
  const description = (event.description || '').replace(/[,;\\]/g, ' ').replace(/\n/g, '\\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tabro//Calendar//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=${inviterName}:mailto:${inviterEmail}`,
    'STATUS:CONFIRMED',
    `URL:https://tabro-org.lovable.app/personal`,
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { eventId, inviteeEmails } = await req.json()
    if (!eventId || !Array.isArray(inviteeEmails) || inviteeEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'eventId and inviteeEmails required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, serviceKey)

    // Get event details
    const { data: event, error: eventError } = await userClient
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get inviter profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('display_name, username')
      .eq('user_id', user.id)
      .single()

    const inviterName = profile?.display_name || profile?.username || user.email?.split('@')[0] || 'משתמש'
    const inviterEmail = user.email || 'noreply@notify.tabro.org'

    // Resolve invitee user IDs from email
    const invitations = []
    for (const email of inviteeEmails) {
      const cleanEmail = email.toLowerCase().trim()
      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const inviteeUser = usersData?.users?.find(u => u.email?.toLowerCase() === cleanEmail)

      invitations.push({
        event_id: eventId,
        inviter_user_id: user.id,
        invitee_email: cleanEmail,
        invitee_user_id: inviteeUser?.id || null,
      })
    }

    const { data: insertedInvites, error: insertError } = await adminClient
      .from('event_invitations')
      .insert(invitations)
      .select()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generate ICS file content
    const icsContent = generateICS(event, inviterName, inviterEmail)
    const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)))

    // Send emails with ICS attachment
    const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')

    if (resendKey) {
      const startTime = formatDateIL(event.start_time, 'long')
      const endTime = formatDateIL(event.end_time, 'short')

      for (const email of inviteeEmails) {
        try {
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

          await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              from: FROM_ADDRESS,
              to: [email.toLowerCase().trim()],
              subject: `📅 הזמנה לאירוע: ${event.title}`,
              html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">📅 הזמנה לאירוע</h1>
                  </div>
                  <div style="background: #ffffff; padding: 30px; border: 1px solid #eee; border-radius: 0 0 12px 12px;">
                    <p style="font-size: 16px; color: #333;"><strong>${inviterName}</strong> מזמין אותך לאירוע:</p>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #667eea;">
                      <h2 style="margin: 0 0 10px 0; color: #333;">${event.title}</h2>
                      <p style="margin: 5px 0; color: #666;">🕐 ${startTime} - ${endTime}</p>
                      ${event.description ? `<p style="margin: 5px 0; color: #666;">📝 ${event.description}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin: 20px 0;">
                      <p style="color: #888; font-size: 14px; margin-bottom: 12px;">
                        📎 קובץ ICS מצורף — לחץ עליו כדי להוסיף לגוגל קלנדר / Outlook / Apple Calendar
                      </p>
                    </div>
                    <p style="color: #888; font-size: 13px; margin-top: 20px;">
                      היכנס/י לאפליקציה כדי לאשר או לדחות את ההזמנה.
                    </p>
                    <div style="text-align: center; margin-top: 16px;">
                      <a href="https://tabro-org.lovable.app/personal" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        פתח את המתכנן
                      </a>
                    </div>
                  </div>
                </div>
              `,
              attachments: [
                {
                  filename: 'event.ics',
                  content: icsBase64,
                  type: 'text/calendar; method=REQUEST',
                }
              ],
              reply_to: inviterEmail,
            }),
          })
        } catch (e) {
          console.error(`Failed to send invitation email to ${email}:`, e)
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invitations: insertedInvites?.length || 0 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})