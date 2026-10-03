// Supabase Edge Function: broadcast-announcement
//
// Lets staff send a one-off push notification to every active member,
// from dashboard.html's "Melding" panel. Meant for small feature
// announcements ("you can now set a profile photo!") rather than
// anything urgent -- there's no targeting or scheduling, just an
// immediate broadcast. Logged into member_nudges (same table daily-nudges
// writes to) so it also shows up in a member's own notification history,
// tagged nudge_type 'announcement' to tell it apart from a personalized
// nudge.
//
// Requires this secret (Edge Functions -> Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Optional categories a member can switch off in Settings. Requests and
// concierge replies are never optional and never go through this.
function pushWanted(prefs: Record<string, boolean> | null | undefined, key: string): boolean {
  if (prefs?.muteOptional) return false;
  return prefs?.[key] !== false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .single();
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { title, body } = await req.json();
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // is_member_active is set only by stripe-webhook on a real subscription
    // payment/cancellation -- with no membership fee charged yet, it's false
    // for every profile including staff's own accounts, which silently
    // matched zero rows here. Just a push token is enough to qualify.
    // Deliberately NOT excluding admins: Kluiver wants his own admin
    // account (used in "View as Member" mode) to receive these too, so he
    // can see exactly what members get in real time rather than guessing.
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('id, push_token, notification_prefs')
      .not('push_token', 'is', null);
    if (membersError) throw membersError;

    let sent = 0;
    for (const member of members || []) {
      if (pushWanted(member.notification_prefs, 'offers')) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            to: member.push_token,
            title,
            body,
            sound: 'default',
            data: { type: 'announcement' },
          }),
        });
      }
      await supabase.from('member_nudges').insert({
        member_id: member.id,
        nudge_type: 'announcement',
        message: `${title}: ${body}`,
      });
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('broadcast-announcement error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
