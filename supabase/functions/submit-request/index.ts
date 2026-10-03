// Lets the app create a concierge request directly (guided flows: driver,
// jet, table, villa, yacht) instead of going through the AI chat. Verifies the
// caller's JWT, applies the same priority handling as the chat's log_request,
// inserts the row with the service role, and tells the team.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });

const CATEGORIES = ['jet', 'yacht', 'watch', 'restaurant', 'hotel', 'car', 'event', 'other'];

async function notifyStaff(service: string, notes: string, memberEmail: string, urgent: boolean) {
  try {
    await fetch('https://formspree.io/f/xgojjlzv', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', referer: 'https://solaceexecutive.com/' },
      body: JSON.stringify({
        _subject: `${urgent ? 'SPOED: ' : ''}Nieuwe aanvraag via de app: ${service}`,
        name: memberEmail || 'Lid',
        email: memberEmail || '',
        message: notes,
      }),
    });
  } catch (e) {
    console.error('Formspree notify failed (non-fatal):', e);
  }
  try {
    const { data: admins } = await admin.from('profiles').select('push_token').eq('is_admin', true).not('push_token', 'is', null);
    for (const a of admins || []) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          to: a.push_token,
          title: urgent ? 'Spoed: nieuwe aanvraag' : 'Nieuwe aanvraag',
          body: `${memberEmail || 'Lid'}: ${service}`,
          sound: 'default',
          data: { type: 'concierge' },
        }),
      });
    }
  } catch (e) {
    console.error('Staff push failed (non-fatal):', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401);
    const memberId = userData.user.id;
    const memberEmail = userData.user.email ?? '';

    const body = await req.json();
    const service = String(body.service || '').trim().slice(0, 200);
    const notes = String(body.notes || '').trim().slice(0, 4000);
    const urgent = !!body.urgent;
    const category = CATEGORIES.includes(body.category) ? body.category : 'other';
    if (!service) return json({ error: 'service is required' }, 400);

    // A frozen account cannot create requests.
    const { data: profile } = await admin
      .from('profiles')
      .select('is_frozen, priority_credits, priority_until')
      .eq('id', memberId)
      .single();
    if (profile?.is_frozen) return json({ error: 'Account frozen' }, 403);

    const hasWindow = !!profile?.priority_until && new Date(profile.priority_until) > new Date();
    let creditConsumed = false;
    if (!urgent && !hasWindow && (profile?.priority_credits || 0) > 0) {
      const { data: claimed } = await admin
        .from('profiles')
        .update({ priority_credits: profile!.priority_credits - 1 })
        .eq('id', memberId)
        .gt('priority_credits', 0)
        .select('id');
      creditConsumed = !!claimed?.length;
    }
    const granted = !urgent && (hasWindow || creditConsumed);

    const { data: inserted, error: insertError } = await admin
      .from('requests')
      .insert({ member_id: memberId, service, notes, status: 'review', is_urgent: urgent || granted, category })
      .select('id')
      .single();
    if (insertError) {
      if (creditConsumed) {
        await admin.from('profiles').update({ priority_credits: profile!.priority_credits }).eq('id', memberId);
      }
      return json({ error: insertError.message }, 500);
    }

    await notifyStaff(service, notes, memberEmail, urgent || granted);
    return json({ ok: true, id: inserted.id, priority: granted });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
