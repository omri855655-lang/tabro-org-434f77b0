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

    // Insert invitations
    const invitations = inviteeEmails.map((email: string) => ({
      event_id: eventId,
      inviter_user_id: user.id,
      invitee_email: email.toLowerCase().trim(),
    }))

    const { data: insertedInvites, error: insertError } = await adminClient
      .from('event_invitations')
      .insert(invitations)
      .select()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Send emails
    const resendKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')

    if (resendKey && lovableKey) {
      const startTime = new Date(event.start_time).toLocaleString('he-IL', { dateStyle: 'long', timeStyle: 'short' })
      const endTime = new Date(event.end_time).toLocaleString('he-IL', { timeStyle: 'short' })

      for (const email of inviteeEmails) {
        try {
          await fetch('https://connector-gateway.lovable.dev/resend/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${lovableKey}`,
              'X-Connection-Api-Key': resendKey,
            },
            body: JSON.stringify({
              from: 'Tabro <onboarding@resend.dev>',
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
                    <p style="color: #888; font-size: 13px; margin-top: 20px;">
                      היכנס/י לאפליקציה כדי לאשר או לדחות את ההזמנה.
                    </p>
                  </div>
                </div>
              `,
              reply_to: user.email || 'info@tabro.org',
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
