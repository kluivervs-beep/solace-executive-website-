// Supabase Edge Function: concierge-chat
//
// Deploy via the Supabase Dashboard (Edge Functions -> New function ->
// paste this file) or via the CLI: `supabase functions deploy concierge-chat`.
//
// Requires two secrets set on the project (Edge Functions -> Secrets):
//   ANTHROPIC_API_KEY      — from console.anthropic.com
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 4;

const TIERS = [
  { key: 'member', label: 'Member', min: 0 },
  { key: 'distinguished', label: 'Distinguished Member', min: 2500 },
  { key: 'elite', label: 'Elite Member', min: 7500 },
];

function describeTier(lifetime: number): string {
  let current = TIERS[0];
  let next: (typeof TIERS)[number] | null = null;
  for (const tier of TIERS) {
    if (lifetime >= tier.min) current = tier;
    else {
      next = tier;
      break;
    }
  }
  if (!next) return `Tier: ${current.label} (highest tier reached).`;
  return `Tier: ${current.label}. ${next.min - lifetime} points to ${next.label}.`;
}

const BASE_SYSTEM_PROMPT = `You are the AI concierge for Solace Executive, a private concierge service for executive transport, private jets, and yacht charters, serving busy professionals and entrepreneurs.

Speak with warmth, precision, and discretion. Never salesy, never robotic.

Your main job in this chat is to understand exactly what a member needs before their request goes to the human team for review. Ask clarifying questions naturally, one or two at a time, covering whatever is relevant to the request:
- Which service: executive transport, private jet, or yacht
- Dates and times
- Locations (departure/destination)
- Number of passengers or guests
- Budget range, if the member is willing to share one — never pressure for it
- Any specific preferences (aircraft type, catering, occasion, etc.)

Once you have a clear picture, briefly summarize it back to the member, then call the log_request tool to hand it to the team. Tell the member the team will follow up by email, typically within 24 hours. If the member signals real time pressure (words like "morgen", "spoed", "zo snel mogelijk", "urgent", "today", "tomorrow"), set urgent to true on that tool call.

You can also help with:
- Checking the status of a member's existing requests, with check_request_status, whenever they ask.
- Checking their Solace Points balance and tier progress, with check_points_balance, whenever they ask.
- Redeeming a reward from the catalog on their behalf, with redeem_reward — only after they clearly confirm which exact reward and that they want to redeem it now, since it spends real points.
- Logging a change or cancellation request on an existing booking, with flag_change_request. Never try to change or cancel a booking yourself; always hand it to the human team, since they manage the actual logistics.
- Remembering a durable preference the member mentions, like a home airport, a recurring request, or a dietary preference, with update_member_preferences. Call this quietly whenever something sounds like it should apply to future requests too; no need to announce that you are saving it.

Keep replies short: 2-4 sentences. Never invent prices, availability, or confirm bookings — only the human team does that. If asked about cost, explain that an accurate quote depends on the specifics you're gathering, and the team will provide one once the request is logged.

Write the way a sharp, warm human concierge would text or speak, not the way an AI writes. Never use em dashes or en dashes (— or –) in your replies; use a comma, a period, or "en"/"and" instead. Avoid stiff connector words like "echter", "daarnaast", "tevens", or "furthermore". Keep sentences plain and conversational.

Reply in the same language the member writes in (Dutch or English).`;

function buildAddressInstruction(fullName: string | null | undefined, title: string | null | undefined): string {
  const hour = Number(
    new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }).format(
      new Date()
    )
  );
  // Hours just after midnight still read as "evening" to a person, not
  // "morning" — nobody says "good morning" to someone awake at 00:30.
  const greetingNL = hour < 5 ? 'Goedenavond' : hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
  const greetingEN = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!fullName) {
    return `It is currently ${greetingEN.toLowerCase()} in Amsterdam. You don't know the member's name, so open the conversation with a warm time-appropriate greeting (e.g. "${greetingNL}" / "${greetingEN}") without a name.`;
  }

  const surname = fullName.trim().split(/\s+/).slice(-1)[0];
  const addressNL = title === 'dhr' ? `de heer ${surname}` : title === 'mevr' ? `mevrouw ${surname}` : fullName;
  const addressEN = title === 'dhr' ? `Mr. ${surname}` : title === 'mevr' ? `Ms. ${surname}` : fullName;

  return `It is currently ${greetingEN.toLowerCase()} in Amsterdam. When you open the conversation, greet the member by name using a time-appropriate greeting: "${greetingNL}, ${addressNL}" in Dutch, or "${greetingEN}, ${addressEN}" in English — match whichever language they write in. Only use the full greeting once, at the start of the conversation; after that, no need to repeat their name every message.`;
}

const TOOLS = [
  {
    name: 'log_request',
    description:
      'Log a concierge request for the Solace Executive team to review, once enough detail has been gathered from the member.',
    input_schema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Short summary, e.g. "Private jet - Amsterdam to Nice, 14 June, 4 passengers"',
        },
        notes: {
          type: 'string',
          description: 'Full detail gathered from the conversation, in the language the member used.',
        },
        urgent: {
          type: 'boolean',
          description: 'True if the member signaled real time pressure (needed tomorrow, urgent, etc).',
        },
      },
      required: ['service', 'notes'],
    },
  },
  {
    name: 'check_request_status',
    description:
      "Look up the member's own existing requests and their current status. Use this whenever they ask about the status of a request.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'check_points_balance',
    description:
      "Look up the member's current Solace Points balance and tier progress. Use this whenever they ask about their points, balance, or tier.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'redeem_reward',
    description:
      'Redeem a reward from the catalog on behalf of the member. Only call this after they clearly confirm which reward and that they want to redeem it now.',
    input_schema: {
      type: 'object',
      properties: {
        reward_title: {
          type: 'string',
          description: 'The exact title of the reward from the current rewards catalog given to you in context.',
        },
      },
      required: ['reward_title'],
    },
  },
  {
    name: 'flag_change_request',
    description:
      'Log a change or cancellation request on an existing booking for the human team to handle. Never attempt to change or cancel a booking yourself.',
    input_schema: {
      type: 'object',
      properties: {
        original_service: {
          type: 'string',
          description: 'Short description of which existing booking this concerns.',
        },
        change_details: {
          type: 'string',
          description: 'What the member wants changed or cancelled, and why if given.',
        },
      },
      required: ['original_service', 'change_details'],
    },
  },
  {
    name: 'update_member_preferences',
    description:
      'Save a durable preference the member mentioned (home airport, recurring request, dietary preference, etc) so future conversations already know it.',
    input_schema: {
      type: 'object',
      properties: {
        preference_summary: {
          type: 'string',
          description: 'One short line describing the preference, in the language the member used.',
        },
      },
      required: ['preference_summary'],
    },
  },
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notifies the Solace team by email (reuses the same Formspree form the
// public intake uses) so a new or changed concierge request doesn't sit
// unseen in the database until someone opens the dashboard. A Referer
// header is set explicitly since this call comes from a server, not a
// browser tab on the site, and Formspree ties submissions to the form's
// registered domain.
async function notifyStaff(service: string, notes: string, memberEmail: string, urgent: boolean) {
  try {
    const notifyRes = await fetch('https://formspree.io/f/xgojjlzv', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        referer: 'https://solaceexecutive.com/',
      },
      body: JSON.stringify({
        _subject: `${urgent ? '🔴 SPOED: ' : ''}Nieuwe conciërge-aanvraag: ${service}`,
        name: memberEmail || 'Lid',
        email: memberEmail || '',
        message: notes,
      }),
    });
    if (!notifyRes.ok) {
      console.error('Formspree notify failed:', notifyRes.status, await notifyRes.text());
    }
  } catch (notifyErr) {
    console.error('Formspree notify error:', notifyErr);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const memberId = userData.user.id;
    const memberEmail = userData.user.email ?? '';
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, title, concierge_notes')
      .eq('id', memberId)
      .single();

    const { data: rewards } = await supabase
      .from('rewards')
      .select('title, cost_points')
      .eq('active', true)
      .order('sort_order');

    const rewardsContext = rewards?.length
      ? `\n\nCurrent rewards catalog (use the exact title when calling redeem_reward):\n${rewards
          .map((r: { title: string; cost_points: number }) => `- ${r.title} (${r.cost_points} points)`)
          .join('\n')}`
      : '';

    const notesContext = profile?.concierge_notes
      ? `\n\nKnown preferences for this member, from past conversations:\n${profile.concierge_notes}`
      : '';

    const SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}\n\n${buildAddressInstruction(profile?.full_name, profile?.title)}${notesContext}${rewardsContext}`;

    const conversation = [...messages];
    let finalText = '';
    // Guards against Claude calling the same logging tool twice within
    // one exchange (e.g. re-confirming after an earlier round already
    // succeeded), which would otherwise create duplicate request rows.
    let requestLogged = false;
    let changeRequestLogged = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: conversation,
          tools: TOOLS,
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error('Anthropic API error:', errText);
        return new Response(JSON.stringify({ error: 'Concierge is unavailable right now.' }), {
          status: 502,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }

      const data = await anthropicRes.json();
      const toolUseBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use');
      const textBlocks = (data.content ?? [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');

      if (!toolUseBlock) {
        finalText = textBlocks;
        break;
      }

      let toolResultContent = 'Done.';

      if (toolUseBlock.name === 'log_request') {
        if (requestLogged) {
          toolResultContent = 'Already logged earlier in this conversation. Do not log it again, just tell the member it is taken care of.';
        } else {
          const { service, notes, urgent } = toolUseBlock.input as {
            service: string;
            notes: string;
            urgent?: boolean;
          };
          const { error: insertError } = await supabase.from('requests').insert({
            member_id: memberId,
            service,
            notes,
            status: 'review',
            is_urgent: !!urgent,
          });
          toolResultContent = insertError
            ? `Could not log the request: ${insertError.message}`
            : 'Request logged for the team to review.';
          if (!insertError) {
            requestLogged = true;
            await notifyStaff(service, notes, memberEmail, !!urgent);
          }
        }
      } else if (toolUseBlock.name === 'check_request_status') {
        const { data: reqs } = await supabase
          .from('requests')
          .select('service, status, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!reqs || !reqs.length) {
          toolResultContent = 'This member has no requests yet.';
        } else {
          const statusLabel: Record<string, string> = {
            review: 'in review',
            confirmed: 'confirmed',
            done: 'completed',
          };
          toolResultContent = reqs
            .map((r: { service: string; status: string }) => `- ${r.service}: ${statusLabel[r.status] ?? r.status}`)
            .join('\n');
        }
      } else if (toolUseBlock.name === 'check_points_balance') {
        const { data: p } = await supabase
          .from('profiles')
          .select('points_balance, points_lifetime')
          .eq('id', memberId)
          .single();
        const balance = p?.points_balance ?? 0;
        const lifetime = p?.points_lifetime ?? 0;
        toolResultContent = `Balance: ${balance} points. ${describeTier(lifetime)}`;
      } else if (toolUseBlock.name === 'redeem_reward') {
        const { reward_title } = toolUseBlock.input as { reward_title: string };
        const { data: reward } = await supabase
          .from('rewards')
          .select('id, cost_points')
          .eq('active', true)
          .ilike('title', reward_title)
          .maybeSingle();

        if (!reward) {
          toolResultContent = `Could not find an active reward matching "${reward_title}". Ask the member to pick one from the current catalog.`;
        } else {
          const { error: redeemError } = await supabase.rpc('redeem_reward_for_member', {
            member_uuid: memberId,
            reward_uuid: reward.id,
          });
          if (redeemError) {
            toolResultContent = `Redemption failed: ${redeemError.message}`;
          } else {
            const { data: p } = await supabase.from('profiles').select('points_balance').eq('id', memberId).single();
            toolResultContent = `Redeemed successfully. New balance: ${p?.points_balance ?? 0} points.`;
          }
        }
      } else if (toolUseBlock.name === 'flag_change_request') {
        if (changeRequestLogged) {
          toolResultContent = 'Already logged earlier in this conversation. Do not log it again, just tell the member it is taken care of.';
        } else {
          const { original_service, change_details } = toolUseBlock.input as {
            original_service: string;
            change_details: string;
          };
          const service = `Wijziging/annulering: ${original_service}`;
          const { error: insertError } = await supabase.from('requests').insert({
            member_id: memberId,
            service,
            notes: change_details,
            status: 'review',
            is_urgent: true,
          });
          toolResultContent = insertError
            ? `Could not log the change request: ${insertError.message}`
            : 'Change request logged for the team.';
          if (!insertError) {
            changeRequestLogged = true;
            await notifyStaff(service, change_details, memberEmail, true);
          }
        }
      } else if (toolUseBlock.name === 'update_member_preferences') {
        const { preference_summary } = toolUseBlock.input as { preference_summary: string };
        const { data: p } = await supabase.from('profiles').select('concierge_notes').eq('id', memberId).single();
        const updated = p?.concierge_notes ? `${p.concierge_notes}\n- ${preference_summary}` : `- ${preference_summary}`;
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ concierge_notes: updated })
          .eq('id', memberId);
        toolResultContent = updateError ? 'Could not save preference.' : 'Preference saved.';
      }

      conversation.push({ role: 'assistant', content: data.content });
      conversation.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: toolResultContent,
          },
        ],
      });

      if (textBlocks) finalText = textBlocks;
    }

    return new Response(JSON.stringify({ reply: finalText || 'One moment.' }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('concierge-chat error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
