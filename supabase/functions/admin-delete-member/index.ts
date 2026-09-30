// Lets staff permanently delete a MEMBER's account (not their own -- see
// delete-account for that) from the Access requests screen, e.g. when
// something went wrong with the account. Verifies the caller is an admin
// first, then reuses the same service-role cleanup as delete-account
// (Storage attachments, favorites, referral_codes all reference the user
// with no cascade) before removing the auth user, which cascades the rest
// (profiles -> concierge_messages/requests/invoices/etc).
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
    const { data: callerData, error: callerError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (callerError || !callerData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', callerData.user.id)
      .single();
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { email, reason } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Reuses the service-role-only lookup already built for stripe-webhook
    // rather than paging through auth.admin.listUsers to find the email.
    const { data: memberId } = await admin.rpc('get_profile_id_by_email', { lookup_email: email.trim().toLowerCase() });
    if (!memberId) {
      return new Response(JSON.stringify({ error: 'No member account found for this email' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: attachments } = await admin.storage.from('concierge-attachments').list(memberId);
    if (attachments?.length) {
      await admin.storage.from('concierge-attachments').remove(attachments.map((f) => `${memberId}/${f.name}`));
    }
    await admin.from('favorites').delete().eq('member_id', memberId);
    await admin.from('referral_codes').delete().eq('owner_id', memberId);

    // Logged before the delete, not after: target_member_id references
    // profiles with ON DELETE SET NULL, so target_email is what keeps this
    // row meaningful once the account is gone.
    await admin.from('admin_actions').insert({
      admin_id: callerData.user.id,
      target_member_id: memberId,
      target_email: email.trim().toLowerCase(),
      action: 'delete_account',
      reason: reason || null,
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(memberId);
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
    console.error('admin-delete-member error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
