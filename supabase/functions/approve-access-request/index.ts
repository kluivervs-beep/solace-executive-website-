// Supabase Edge Function: approve-access-request
//
// Called from dashboard.html when staff clicks "Goedkeuren" on a pending
// access request. Creates the applicant's real login account (or, if the
// email is already registered, generates a fresh sign-in link for it),
// emails them a branded link to set their password, and marks the
// request approved.
//
// Login currently only works on the website (login.html) -- the app
// hasn't shipped to the App Store yet -- so the email points there.
//
// Requires these secrets (Edge Functions -> Secrets):
//   RESEND_API_KEY            — resend.com -> API keys
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const REDIRECT_TO = 'https://solaceexecutive.com/reset-password.html';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildEmailHtml(name: string, actionLink: string, isNewAccount: boolean): string {
  const intro = isNewAccount
    ? 'Uw aanvraag voor Solace Executive is goedgekeurd. Stel hieronder uw wachtwoord in om direct in te loggen.'
    : 'Uw aanvraag voor Solace Executive is goedgekeurd. U heeft al een account, gebruik de link hieronder om in te loggen.';
  return `<div style="background:#F3EEE2;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E4DFD0;">
    <div style="background:#0F1B24;padding:28px 32px;text-align:center;">
      <div style="font-size:20px;letter-spacing:0.16em;color:#F5F1E6;">SOLACE</div>
      <div style="font-size:10px;letter-spacing:0.32em;color:#B4923D;margin-top:4px;font-family:Arial,sans-serif;">EXECUTIVE</div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#1C2B37;margin:0 0 16px;">Beste ${name},</p>
      <p style="font-size:15px;line-height:1.6;color:#1C2B37;margin:0 0 24px;">${intro}</p>
      <a href="${actionLink}" style="display:inline-block;background:#B4923D;color:#1B1405;text-decoration:none;padding:12px 28px;border-radius:24px;font-size:13px;font-weight:bold;letter-spacing:0.04em;font-family:Arial,sans-serif;">${isNewAccount ? 'Wachtwoord instellen' : 'Inloggen'}</a>
      <p style="font-size:12.5px;line-height:1.6;color:#5B6670;margin:24px 0 0;font-family:Arial,sans-serif;">Deze link is eenmalig en persoonlijk, deel hem niet met anderen.</p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #E4DFD0;text-align:center;">
      <div style="font-size:11px;color:#9a9488;font-family:Arial,sans-serif;">Solace Executive &middot; Private Concierge</div>
    </div>
  </div>
</div>`;
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

    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: reqRow, error: reqError } = await supabase
      .from('access_requests')
      .select('id, full_name, email, status, push_token')
      .eq('id', request_id)
      .single();
    if (reqError || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Claim the request atomically before doing any of the actual work below.
    // There was no guard against approving the same request twice (a
    // double-click, or two staff members approving at once), which would
    // send the applicant two separate invite/login emails. The status <>
    // 'approved' condition is checked against the row's live value at the
    // moment this update locks it, so only the first concurrent call can
    // ever win the claim.
    const { data: claimedReq } = await supabase
      .from('access_requests')
      .update({ status: 'approved' })
      .eq('id', request_id)
      .neq('status', 'approved')
      .select('id');
    if (!claimedReq?.length) {
      return new Response(JSON.stringify({ ok: true, alreadyApproved: true }), {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Try creating a brand-new account first (invite). If that email is
    // already registered, fall back to a login link for the existing one.
    let actionLink: string | null = null;
    let isNewAccount = true;

    const inviteRes = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: reqRow.email,
      options: { data: { full_name: reqRow.full_name }, redirectTo: REDIRECT_TO },
    });

    if (!inviteRes.error) {
      actionLink = inviteRes.data.properties?.action_link ?? null;
    } else {
      isNewAccount = false;
      const recoveryRes = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: reqRow.email,
        options: { redirectTo: REDIRECT_TO },
      });
      if (recoveryRes.error) {
        return new Response(
          JSON.stringify({ error: `Could not create or find account: ${recoveryRes.error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } }
        );
      }
      actionLink = recoveryRes.data.properties?.action_link ?? null;
    }

    if (!actionLink) {
      return new Response(JSON.stringify({ error: 'No action link returned' }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Solace Executive <hello@solaceexecutive.com>',
        to: [reqRow.email],
        subject: 'Welkom bij Solace Executive',
        html: buildEmailHtml(reqRow.full_name || 'lid', actionLink, isNewAccount),
      }),
    });
    if (!resendRes.ok) {
      console.error('Resend send failed:', resendRes.status, await resendRes.text());
    }

    // If the applicant already had the app installed when they applied and
    // notification permission was already granted, their request row carries
    // a push_token -- send them the real actionLink directly as a push, so
    // tapping it jumps straight to setting a password instead of waiting on
    // an email that might land in spam. This is sent directly to Expo's push
    // API (not through the shared send-push function, which only accepts
    // tokens already tied to an existing profiles row -- this applicant
    // doesn't have one yet at this point). Best-effort: email above is
    // already the guaranteed path, so a push failure here is silent.
    if (reqRow.push_token) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            to: reqRow.push_token,
            title: 'Goed nieuws!',
            body: 'Uw aanvraag is goedgekeurd. Tik hier om uw account te activeren.',
            sound: 'default',
            data: { type: 'access_approved', actionLink },
          }),
        });
      } catch (e) {
        console.error('Access-approved push failed (non-fatal):', e);
      }
    }

    return new Response(JSON.stringify({ ok: true, isNewAccount, emailed: resendRes.ok }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('approve-access-request error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
