// Sends a push notification via Expo's push API to a single device token.
// Called from the staff inbox (dashboard.html) right after a human reply is
// saved, and from the member app is not involved here at all — this only
// runs server-side / from the dashboard.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { push_token, title, body } = await req.json();
    if (!push_token || !title) {
      return new Response(JSON.stringify({ error: 'push_token and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to: push_token, title, body, sound: 'default' }),
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
