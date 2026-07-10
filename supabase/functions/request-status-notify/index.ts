// Supabase Edge Function: request-status-notify
//
// Triggered by a Supabase Database Webhook on UPDATE of public.requests.
// When a request's status actually changes (e.g. you mark it
// 'confirmed' in the Table Editor), this emails the member directly
// (via Resend) so they don't have to keep checking their dashboard.
//
// Set up the webhook in Supabase: Database -> Webhooks -> Create a
// new hook -> Table: requests -> Events: Update -> Type: Supabase Edge
// Functions -> select this function.
//
// Requires these secrets (Edge Functions -> Secrets):
//   RESEND_API_KEY            — resend.com -> API keys
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STATUS_LABEL_NL: Record<string, string> = {
  review: 'In beoordeling',
  confirmed: 'Bevestigd',
  done: 'Afgerond',
};

function buildEmailHtml(name: string, service: string, statusLabel: string): string {
  return `<div style="background:#F3EEE2;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E4DFD0;">
    <div style="background:#0F1B24;padding:28px 32px;text-align:center;">
      <div style="font-size:20px;letter-spacing:0.16em;color:#F5F1E6;">SOLACE</div>
      <div style="font-size:10px;letter-spacing:0.32em;color:#B4923D;margin-top:4px;font-family:Arial,sans-serif;">EXECUTIVE</div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#1C2B37;margin:0 0 16px;">Beste ${name},</p>
      <p style="font-size:15px;line-height:1.6;color:#1C2B37;margin:0 0 20px;">De status van uw aanvraag is bijgewerkt:</p>
      <div style="background:#F3EEE2;border-left:3px solid #B4923D;padding:14px 18px;margin:0 0 24px;">
        <div style="font-size:13px;color:#5B6670;margin-bottom:4px;font-family:Arial,sans-serif;">${service}</div>
        <div style="font-size:17px;font-weight:bold;color:#0F1B24;">${statusLabel}</div>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#5B6670;margin:0 0 28px;font-family:Arial,sans-serif;">U kunt de details terugvinden in uw ledenportaal.</p>
      <a href="https://solaceexecutive.com/dashboard.html" style="display:inline-block;background:#B4923D;color:#1B1405;text-decoration:none;padding:12px 28px;border-radius:24px;font-size:13px;font-weight:bold;letter-spacing:0.04em;font-family:Arial,sans-serif;">Naar ledenportaal</a>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #E4DFD0;text-align:center;">
      <div style="font-size:11px;color:#9a9488;font-family:Arial,sans-serif;">Solace Executive &middot; Private Concierge</div>
    </div>
  </div>
</div>`;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record || !oldRecord || record.status === oldRecord.status) {
      // Not a status change (e.g. just a notes edit) — nothing to send.
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const { data: contact, error } = await supabase
      .rpc('get_member_contact', { member_uuid: record.member_id })
      .single();

    if (error || !contact?.email) {
      console.error('Could not look up member contact:', error);
      return new Response(JSON.stringify({ error: 'Member not found' }), { status: 404 });
    }

    const statusLabel = STATUS_LABEL_NL[record.status] ?? record.status;
    const name = contact.full_name || 'lid';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Solace Executive <hello@solaceexecutive.com>',
        to: [contact.email],
        subject: `Update over uw aanvraag: ${record.service}`,
        html: buildEmailHtml(name, record.service, statusLabel),
      }),
    });

    if (!resendRes.ok) {
      console.error('Resend notify failed:', resendRes.status, await resendRes.text());
    }

    return new Response(JSON.stringify({ notified: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('request-status-notify error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500 });
  }
});
