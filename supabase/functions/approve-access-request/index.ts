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

// generateLink's own action_link always points at Supabase's own
// /auth/v1/verify endpoint, which -- if opened directly -- consumes the
// one-time token server-side and redirects with the session in a URL hash
// fragment. That's fine for a browser (supabase-js auto-detects it), but a
// hash fragment isn't something a native Universal Link handler can read
// cleanly, and consuming the token before the recipient even sees it also
// defeats the "don't burn it on a mail-scanner's background fetch" point
// of the token_hash-deferred-verify pattern reset-password.html (and now
// SetPasswordScreen in the app) already use. Pulling the raw token/type
// out and building our own link to our own domain sidesteps Supabase's
// /verify redirect entirely -- reset-password.html is registered in the
// AASA file, so this opens directly in the app when it's installed.
function toOwnActivationLink(actionLink: string): { url: string; token: string; type: string } | null {
  try {
    const u = new URL(actionLink);
    const token = u.searchParams.get('token');
    const type = u.searchParams.get('type');
    if (!token || !type) return null;
    const own = new URL(REDIRECT_TO);
    own.searchParams.set('token_hash', token);
    own.searchParams.set('type', type);
    return { url: own.toString(), token, type };
  } catch {
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Welcome email: dark masthead, paper-coloured letter, a personal
// signature image, and a quiet dark footer. Email clients cannot load web
// fonts, so type is Georgia (serif) with Arial for the small caps, and the
// logo and signature are hosted images.
const SITE = 'https://solaceexecutive.com';

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailHtml(name: string, actionLink: string, isNewAccount: boolean, email: string): string {
  const first = escapeHtml((name || 'lid').trim().split(/\s+/)[0]);
  const now = new Date();
  const dateLine = now.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
  const since = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
  const p1 = isNewAccount
    ? 'Welkom bij Solace Executive. Vanaf nu staat alles op een bericht afstand: priv&eacute; reizen, de reservering die niet kan, een chauffeur bij zonsopgang, discretie wanneer het ertoe doet. U vraagt, wij regelen.'
    : 'Welkom terug bij Solace Executive. Uw aanvraag is goedgekeurd en uw account staat klaar. Alles staat weer op een bericht afstand: priv&eacute; reizen, de reservering die niet kan, een chauffeur bij zonsopgang.';
  const p2 =
    'Sol&egrave;ne, onze concierge, is dag en nacht bereikbaar in de app. En u kunt mij altijd persoonlijk schrijven op <a href="mailto:hello@solaceexecutive.com" style="color:#8A6D2B;">hello@solaceexecutive.com</a>, waarmee u ook wilt, op de manier die u het prettigst vindt.';
  const cta = isNewAccount ? 'Wachtwoord instellen' : 'Inloggen';
  const sans = "font-family:Arial,Helvetica,sans-serif;";
  const serif = "font-family:Georgia,'Times New Roman',serif;";
  return `<div style="background:#E9E4D6;padding:24px 12px;${serif}">
  <div style="max-width:560px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid #D9D2BF;">
    <div style="background:#0F1B24;padding:34px 24px 30px;text-align:center;border-bottom:1px solid #B4923D;">
      <img src="${SITE}/assets/icons/email-logo.png" width="150" alt="Solace Executive" style="display:inline-block;border:0;height:auto;max-width:150px;">
      <div style="${sans}font-size:10px;letter-spacing:0.34em;color:#A9B4BB;margin-top:14px;">PRIVATE CONCIERGE</div>
    </div>
    <div style="background:#F8F6F0;padding:34px 34px 30px;">
      <div style="${serif}font-size:13px;font-style:italic;color:#8F8777;text-align:right;margin:0 0 26px;">Amsterdam &middot; ${dateLine}</div>
      <p style="${serif}font-size:18px;line-height:1.5;color:#16232E;margin:0 0 18px;">Beste ${first},</p>
      <p style="${serif}font-size:16px;line-height:1.75;color:#2A3742;margin:0 0 16px;">${p1}</p>
      <p style="${serif}font-size:16px;line-height:1.75;color:#2A3742;margin:0 0 26px;">${p2}</p>
      <div style="background:#0F1B24;border-radius:12px;padding:20px 22px;text-align:center;margin:0 0 14px;">
        <div style="${sans}font-size:10px;letter-spacing:0.3em;color:#A9B4BB;">UW LIDMAATSCHAP</div>
        <div style="${serif}font-size:20px;letter-spacing:0.04em;color:#E3C98B;margin-top:8px;">${escapeHtml(email)}</div>
        <div style="${sans}font-size:11px;letter-spacing:0.12em;color:#7F8C95;margin-top:8px;">LID SINDS ${since.toUpperCase()}</div>
      </div>
      <a href="${actionLink}" style="display:block;background:#B4923D;color:#1B1405;text-decoration:none;padding:15px 24px;border-radius:12px;font-size:12px;font-weight:bold;letter-spacing:0.22em;text-align:center;${sans}">${cta.toUpperCase()}</a>
      <p style="${sans}font-size:12px;line-height:1.6;color:#8F8777;margin:14px 0 28px;text-align:center;">Deze link is eenmalig en persoonlijk. Deel hem met niemand.</p>
      <p style="${serif}font-size:16px;line-height:1.7;color:#2A3742;margin:0 0 6px;">Het is een eer u te mogen verwelkomen.</p>
      <img src="${SITE}/assets/signature/kluiver-signature.png" width="200" alt="Kluiver van Spronsen" style="display:block;border:0;height:auto;max-width:200px;margin:12px 0 4px 0;">
      <div style="${serif}font-size:16px;color:#16232E;">Kluiver van Spronsen</div>
      <div style="${sans}font-size:10px;letter-spacing:0.26em;color:#B4923D;margin-top:5px;">OPRICHTER &middot; SOLACE EXECUTIVE</div>
    </div>
    <div style="background:#0F1B24;padding:26px 24px 22px;text-align:center;">
      <div style="${serif}font-size:16px;font-style:italic;color:#C7A25C;margin-bottom:16px;">Tafels, jets, het onboekbare.</div>
      <div style="${sans}font-size:11px;letter-spacing:0.16em;margin-bottom:16px;">
        <a href="https://wa.me/31644917512" style="color:#A9B4BB;text-decoration:none;">WHATSAPP</a>
        <span style="color:#3C4A55;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="mailto:hello@solaceexecutive.com" style="color:#A9B4BB;text-decoration:none;">E-MAIL</a>
        <span style="color:#3C4A55;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="${SITE}" style="color:#A9B4BB;text-decoration:none;">WEBSITE</a>
        <span style="color:#3C4A55;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="https://instagram.com/solace.executive" style="color:#A9B4BB;text-decoration:none;">INSTAGRAM</a>
      </div>
      <div style="${sans}font-size:10.5px;color:#5C6A74;">&copy; ${now.getFullYear()} Solace Executive &middot; Amsterdam</div>
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
      .select('id, full_name, email, status, push_token, city, gender, birthday, instagram, looking_for')
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
      // Carry what the applicant told us over to their new profile.
      const newUserId = inviteRes.data.user?.id;
      if (newUserId) {
        await supabase
          .from('profiles')
          .update({
            city: reqRow.city || null,
            birthday: reqRow.birthday || null,
            instagram: reqRow.instagram || null,
            looking_for: reqRow.looking_for || null,
            preferences: reqRow.gender ? { gender: reqRow.gender } : {},
          })
          .eq('id', newUserId);
      }
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

    const ownLink = toOwnActivationLink(actionLink);
    if (!ownLink) {
      return new Response(JSON.stringify({ error: 'Could not build activation link' }), {
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
        html: buildEmailHtml(reqRow.full_name || 'lid', ownLink.url, isNewAccount, reqRow.email || ''),
      }),
    });
    if (!resendRes.ok) {
      console.error('Resend send failed:', resendRes.status, await resendRes.text());
    }

    // If the applicant already had the app installed when they applied and
    // notification permission was already granted, their request row carries
    // a push_token -- send the raw token_hash/type directly as push data, so
    // tapping it opens SetPasswordScreen in-app immediately (see
    // handleNotificationData in RootNavigator), no email, no browser, no
    // website login step at all. Sent directly to Expo's push API (not
    // through the shared send-push function, which only accepts tokens
    // already tied to an existing profiles row -- this applicant doesn't
    // have one yet at this point). Best-effort: email above is already the
    // guaranteed path, so a push failure here is silent.
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
            data: { type: 'account_setup', tokenHash: ownLink.token, otpType: ownLink.type },
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
