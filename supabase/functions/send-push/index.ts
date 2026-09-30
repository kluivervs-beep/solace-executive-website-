// Sends a push notification via Expo's push API to a single device token.
// Called from the staff inbox (dashboard.html) right after a human reply is
// saved, and from a handful of DB triggers (notify_access_request,
// notify_new_experience, notify_member_cancelled) using the public
// publishable key -- see supabase-schema.sql for why verify_jwt stays on
// but the publishable key is accepted as-is. Because that key is public,
// this function was previously an open relay: anyone could POST any
// push_token/title/body and have it forwarded through our Expo push
// credentials. Since every legitimate caller already looked the token up
// from profiles.push_token first, requiring the token to actually belong
// to a real profile closes that off without breaking any real call site.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { push_token, title, body, data } = await req.json();
    if (!push_token || !title) {
      return new Response(JSON.stringify({ error: 'push_token and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: owner } = await supabase
      .from('profiles')
      .select('id')
      .eq('push_token', push_token)
      .maybeSingle();
    if (!owner) {
      return new Response(JSON.stringify({ error: 'Unknown push_token' }), {
        status: 403,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to: push_token, title, body, sound: 'default', data }),
    });
    const result = await res.json();

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
