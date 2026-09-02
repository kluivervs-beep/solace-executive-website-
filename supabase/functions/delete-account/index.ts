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

    // Uploaded photos live in Storage, not a table, so deleting the member's
    // rows and auth user doesn't remove them on its own -- they're kept in
    // a folder named by the member's own id.
    const { data: attachments } = await admin.storage.from('concierge-attachments').list(userId);
    if (attachments?.length) {
      await admin.storage.from('concierge-attachments').remove(attachments.map((f) => `${userId}/${f.name}`));
    }

    // favorites and referral_codes reference auth.users directly with no
    // cascade, so they must be cleared before deleteUser or it errors.
    // Everything else (concierge_messages, requests, invoices,
    // point_transactions, reward_redemptions) cascades automatically from
    // the profiles row, which itself cascades from the auth user.
    await admin.from('favorites').delete().eq('member_id', userId);
    await admin.from('referral_codes').delete().eq('owner_id', userId);

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
