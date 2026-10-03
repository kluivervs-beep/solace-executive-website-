// Supabase Edge Function: daily-nudges
//
// The concierge chat only ever reacts when a member opens it. This runs
// once a day (pg_cron, see supabase-schema.sql) and, for each active
// member, asks Claude to look at what we actually know about them (saved
// preferences, recent requests, the live yacht/empty-leg/opportunities
// catalog) and decide whether there's ONE genuinely relevant thing worth
// proactively telling them today -- not a daily habit notification, a
// real "we thought of you" moment. Most days, most members get nothing:
// the model is explicitly told to skip rather than invent a reason.
//
// A 4-day cooldown per member (regardless of nudge type) keeps this from
// ever feeling like a drip campaign even if the model wanted to fire
// every day.
//
// Runs on a schedule via pg_cron + pg_net (see supabase-schema.sql). Can
// also be triggered manually: POST to this function's URL with header
// 'x-sync-secret: <SYNC_SECRET>' (reuses the same shared secret as
// sync-empty-legs/sync-instagram/birthday-check).
//
// Requires these secrets (Edge Functions -> Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
//   ANTHROPIC_API_KEY         — console.anthropic.com
//   SYNC_SECRET               — same value used by the other sync jobs
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MODEL = 'claude-haiku-4-5-20251001';
const COOLDOWN_DAYS = 4;

const DECIDE_TOOL = {
  name: 'decide_nudge',
  description: 'Decide whether to send this member a single proactive notification today.',
  input_schema: {
    type: 'object',
    properties: {
      should_nudge: { type: 'boolean', description: 'True only if there is a genuinely relevant, specific reason to reach out today.' },
      nudge_type: { type: 'string', description: 'Short category, e.g. "empty_leg", "birthday_soon", "yacht_match", "villa_match", "opportunity".' },
      title: { type: 'string', description: 'Push notification title, max ~40 characters, in the member\'s preferred language (Dutch unless their notes/requests are in English).' },
      body: { type: 'string', description: 'Push notification body, one short warm sentence, specific to this member, not generic marketing copy.' },
    },
    required: ['should_nudge'],
  },
};

async function decideNudge(context: string): Promise<{ nudge_type: string; title: string; body: string } | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      tools: [DECIDE_TOOL],
      tool_choice: { type: 'tool', name: 'decide_nudge' },
      messages: [
        {
          role: 'user',
          content: `You are the proactive half of Solace Executive's concierge. You only speak up when it's genuinely worth it -- most days you should decide NOT to nudge. Never invent availability or a reason; only use what's given below. A vague "check out our catalog" is not acceptable, it must be specific and tied to something in the member's own notes or history.\n\n${context}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error('Anthropic error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolUse?.input?.should_nudge) return null;
  const { nudge_type, title, body } = toolUse.input as { nudge_type?: string; title?: string; body?: string };
  if (!title || !body) return null;
  return { nudge_type: nudge_type || 'general', title, body };
}

// Optional categories a member can switch off in Settings. Requests and
// concierge replies are never optional and never go through this.
function pushWanted(prefs: Record<string, boolean> | null | undefined, key: string): boolean {
  if (prefs?.muteOptional) return false;
  return prefs?.[key] !== false;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  try {
    const { data: yachts } = await supabase
      .from('yachts')
      .select('name, model, base_harbour, price_from')
      .eq('active', true)
      .order('sort_order')
      .limit(20);
    const yachtsList = (yachts || []).map((y) => `- ${y.name} (${y.model}, ${y.base_harbour || 'onbekend'}, vanaf €${y.price_from || '?'})`).join('\n');

    const { data: emptyLegs } = await supabase
      .from('empty_legs')
      .select('origin, destination, departure_at, price_from')
      .eq('active', true)
      .gte('departure_at', new Date().toISOString())
      .order('departure_at')
      .limit(15);
    const emptyLegsList = (emptyLegs || [])
      .map((e) => `- ${e.origin} -> ${e.destination}, ${new Date(e.departure_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}, vanaf €${e.price_from}`)
      .join('\n');

    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('title, description, tag')
      .eq('active', true)
      .order('sort_order')
      .limit(5);
    const opportunitiesList = (opportunities || []).map((o) => `- [${o.tag}] ${o.title}: ${o.description || ''}`).join('\n');

    // is_member_active is set only by stripe-webhook on a real subscription
    // payment/cancellation -- with no membership fee charged yet, it's false
    // for every profile including staff's own accounts, which silently
    // matched zero rows here. Just a push token is enough to qualify.
    // Deliberately NOT excluding admins: Kluiver wants his own admin
    // account (used in "View as Member" mode) to receive these too, so he
    // can see exactly what members get in real time rather than guessing.
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('id, full_name, push_token, concierge_notes, birthday, notification_prefs')
      .not('push_token', 'is', null);
    if (membersError) throw membersError;

    let nudged = 0;
    let skipped = 0;

    for (const member of members || []) {
      if (!pushWanted(member.notification_prefs, 'offers')) {
        skipped++;
        continue;
      }
      const cooldownSince = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentNudge } = await supabase
        .from('member_nudges')
        .select('id')
        .eq('member_id', member.id)
        .gte('created_at', cooldownSince)
        .limit(1)
        .maybeSingle();
      if (recentNudge) {
        skipped++;
        continue;
      }

      const { data: recentRequests } = await supabase
        .from('requests')
        .select('service')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .limit(5);
      const requestsList = (recentRequests || []).map((r) => `- ${r.service}`).join('\n') || '(geen eerdere verzoeken)';

      let birthdayNote = '';
      if (member.birthday) {
        const today = new Date();
        const [, mm, dd] = (member.birthday as string).split('-');
        const nextBirthday = new Date(today.getFullYear(), Number(mm) - 1, Number(dd));
        if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        if (daysUntil > 0 && daysUntil <= 10) birthdayNote = `\n\nHun verjaardag is over ${daysUntil} dagen.`;
      }

      const context = `Lid: ${member.full_name || 'onbekend'}
Opgeslagen voorkeuren:
${member.concierge_notes || '(geen)'}

Recente verzoeken:
${requestsList}${birthdayNote}

Beschikbare yachts:
${yachtsList || '(geen)'}

Beschikbare empty legs:
${emptyLegsList || '(geen)'}

Huidige highlights:
${opportunitiesList || '(geen)'}`;

      const decision = await decideNudge(context);
      if (!decision) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from('member_nudges').insert({
        member_id: member.id,
        nudge_type: decision.nudge_type,
        message: `${decision.title}: ${decision.body}`,
      });
      if (insertError) {
        console.error('Failed to log nudge:', insertError);
        continue;
      }

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          to: member.push_token,
          title: decision.title,
          body: decision.body,
          sound: 'default',
          data: { type: 'nudge' },
        }),
      });
      nudged++;
    }

    return new Response(JSON.stringify({ ok: true, nudged, skipped }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('daily-nudges error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
