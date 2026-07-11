// Supabase Edge Function: announce-rewards-launch
//
// One-time broadcast: emails every active member to let them know
// Solace Points has gone live. Trigger this manually, once, after you
// flip REWARDS_LIVE to true in dashboard.html and deploy that change.
//
// Requires these secrets (Edge Functions -> Secrets):
//   RESEND_API_KEY            — resend.com -> API keys
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
//   ANNOUNCE_SECRET           — any random string you choose yourself,
//                                used to authorize the trigger request
//                                below so a stranger can't call this
//                                and email your whole membership list.
// SUPABASE_URL is already injected automatically by Supabase.
//
// To trigger it, once deployed, run:
//   curl -X POST https://<project-ref>.supabase.co/functions/v1/announce-rewards-launch \
//     -H "x-announce-secret: <your ANNOUNCE_SECRET value>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const ANNOUNCE_SECRET = Deno.env.get('ANNOUNCE_SECRET')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function buildEmailHtml(name: string): string {
  return `<div style="background:#F3EEE2;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E4DFD0;">
    <div style="background:#0F1B24;padding:28px 32px;text-align:center;">
      <div style="font-size:20px;letter-spacing:0.16em;color:#F5F1E6;">SOLACE</div>
      <div style="font-size:10px;letter-spacing:0.32em;color:#B4923D;margin-top:4px;font-family:Arial,sans-serif;">EXECUTIVE</div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#1C2B37;margin:0 0 16px;">Beste ${name},</p>
      <p style="font-size:15px;line-height:1.6;color:#1C2B37;margin:0 0 20px;">Solace Points is nu live: ons nieuwe beloningsprogramma voor leden. Spaar punten en wissel ze in voor exclusieve extra's.</p>
      <div style="background:#F3EEE2;border-left:3px solid #B4923D;padding:14px 18px;margin:0 0 12px;">
        <div style="font-size:13.5px;color:#1C2B37;line-height:1.7;font-family:Arial,sans-serif;">
          &bull; Elke voltooide aanvraag: <strong>150 punten</strong><br>
          &bull; Compleet profiel, eenmalig: <strong>100 punten</strong><br>
          &bull; Een vriend die lid wordt: <strong>500 punten</strong><br>
          &bull; Lidmaatschapsjubileum, elk jaar: <strong>300 punten</strong>
        </div>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#5B6670;margin:0 0 28px;font-family:Arial,sans-serif;">Uw punten staan al klaar in het ledenportaal, onder "Beloningen".</p>
      <a href="https://solaceexecutive.com/dashboard.html" style="display:inline-block;background:#B4923D;color:#1B1405;text-decoration:none;padding:12px 28px;border-radius:24px;font-size:13px;font-weight:bold;letter-spacing:0.04em;font-family:Arial,sans-serif;">Bekijk uw punten</a>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #E4DFD0;text-align:center;">
      <div style="font-size:11px;color:#9a9488;font-family:Arial,sans-serif;">Solace Executive &middot; Private Concierge</div>
    </div>
  </div>
</div>`;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-announce-secret') !== ANNOUNCE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { data: members, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_member_active', true);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    let sent = 0;
    let failed = 0;

    for (const member of members ?? []) {
      const { data: contact } = await supabase
        .rpc('get_member_contact', { member_uuid: member.id })
        .single();

      if (!contact?.email) {
        failed += 1;
        continue;
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Solace Executive <hello@solaceexecutive.com>',
          to: [contact.email],
          subject: 'Solace Points is live: verdien en wissel punten in',
          html: buildEmailHtml(contact.full_name || 'lid'),
        }),
      });

      if (res.ok) sent += 1;
      else {
        failed += 1;
        console.error('Resend send failed for', contact.email, res.status, await res.text());
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('announce-rewards-launch error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500 });
  }
});
