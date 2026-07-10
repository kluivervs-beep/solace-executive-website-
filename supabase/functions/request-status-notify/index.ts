// Supabase Edge Function: request-status-notify
//
// Triggered by a Supabase Database Webhook on UPDATE of public.requests.
// When a request's status actually changes (e.g. you mark it
// 'confirmed' in the Table Editor), this emails the member so they
// don't have to keep checking their dashboard.
//
// Set up the webhook in Supabase: Database -> Webhooks -> Create a
// new hook -> Table: requests -> Events: Update -> Type: Supabase Edge
// Functions -> select this function.
//
// Requires this secret (Edge Functions -> Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STATUS_LABEL_NL: Record<string, string> = {
  review: 'in beoordeling',
  confirmed: 'bevestigd',
  done: 'afgerond',
};

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

    const notifyRes = await fetch('https://formspree.io/f/xgojjlzv', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        referer: 'https://solaceexecutive.com/',
      },
      body: JSON.stringify({
        _subject: `Update over uw aanvraag: ${record.service}`,
        name: 'Solace Executive',
        email: contact.email,
        message: `Beste ${contact.full_name || 'lid'},\n\nDe status van uw aanvraag "${record.service}" is bijgewerkt naar: ${statusLabel}.\n\nU kunt de details terugvinden in uw ledenportaal.\n\nMet vriendelijke groet,\nSolace Executive`,
      }),
    });

    if (!notifyRes.ok) {
      console.error('Formspree notify failed:', notifyRes.status, await notifyRes.text());
    }

    return new Response(JSON.stringify({ notified: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('request-status-notify error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500 });
  }
});
