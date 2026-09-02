// Supabase Edge Function: birthday-check
//
// Finds members whose birthday is today, awards a 250-point birthday
// bonus (via point_transactions, same ledger the welcome bonus uses),
// and sends them a push notification. birthday_bonus_year guards
// against awarding twice in the same year if this runs more than once
// on the same day.
//
// Runs on a schedule via pg_cron + pg_net, same pattern as
// sync-empty-legs (see supabase-schema.sql). Can also be triggered
// manually: POST to this function's URL with header
// 'x-sync-secret: <SYNC_SECRET>' (reuses the same shared secret).
//
// Requires this secret (Edge Functions -> Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BONUS_POINTS = 250;

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  try {
    const today = new Date();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const year = today.getUTCFullYear();

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, birthday, birthday_bonus_year, push_token')
      .not('birthday', 'is', null);
    if (error) throw error;

    const matches = (profiles || []).filter((p) => {
      const parts = (p.birthday as string).split('-');
      return parts[1] === mm && parts[2] === dd && p.birthday_bonus_year !== year;
    });

    for (const p of matches) {
      await supabase.from('point_transactions').insert({
        member_id: p.id,
        amount: BONUS_POINTS,
        reason: 'Verjaardagscadeau',
      });
      await supabase.from('profiles').update({ birthday_bonus_year: year }).eq('id', p.id);

      if (p.push_token) {
        const firstName = (p.full_name || '').trim().split(/\s+/)[0] || '';
        const body = firstName
          ? `Fijne verjaardag, ${firstName}! We hebben ${BONUS_POINTS} Solace Points voor je klaargezet.`
          : `Fijne verjaardag! We hebben ${BONUS_POINTS} Solace Points voor je klaargezet.`;
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ to: p.push_token, title: 'Solace Executive', body, sound: 'default', data: { type: 'birthday' } }),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, celebrated: matches.length }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
