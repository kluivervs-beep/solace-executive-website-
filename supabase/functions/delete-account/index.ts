// Lets a member permanently delete their own account and every row tied to
// it. Called from the app's Profile screen. Verifies the caller's own JWT
// first so nobody can delete someone else's account, then uses the service
// role (never exposed to the client) to remove the data and the auth user.
//
// Required secret (Project Settings -> Edge Functions -> Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    await admin.from('concierge_messages').delete().eq('member_id', userId);
    await admin.from('requests').delete().eq('member_id', userId);
    await admin.from('favorites').delete().eq('member_id', userId);
    await admin.from('referral_codes').delete().eq('owner_id', userId);
    await admin.from('profiles').delete().eq('id', userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
