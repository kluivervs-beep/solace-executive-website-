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
const MAX_TOOL_ROUNDS = 3;

const SYSTEM_PROMPT = `You are the AI concierge for Solace Executive, a private concierge service for executive transport, private jets, and yacht charters, serving busy professionals and entrepreneurs.

Speak with warmth, precision, and discretion. Never salesy, never robotic.

Your job in this chat is to understand exactly what a member needs before their request goes to the human team for review. Ask clarifying questions naturally, one or two at a time, covering whatever is relevant to the request:
- Which service: executive transport, private jet, or yacht
- Dates and times
- Locations (departure/destination)
- Number of passengers or guests
- Budget range, if the member is willing to share one — never pressure for it
- Any specific preferences (aircraft type, catering, occasion, etc.)

Once you have a clear picture, briefly summarize it back to the member, then call the log_request tool to hand it to the team. Tell the member the team will follow up by email, typically within 24 hours.

Keep replies short: 2-4 sentences. Never invent prices, availability, or confirm bookings — only the human team does that. If asked about cost, explain that an accurate quote depends on the specifics you're gathering, and the team will provide one once the request is logged.

Reply in the same language the member writes in (Dutch or English).`;

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
      },
      required: ['service', 'notes'],
    },
  },
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const conversation = [...messages];
    let finalText = '';

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

      let toolResultContent = 'Logged.';
      if (toolUseBlock.name === 'log_request') {
        const { service, notes } = toolUseBlock.input as { service: string; notes: string };
        const { error: insertError } = await supabase.from('requests').insert({
          member_id: memberId,
          service,
          notes,
          status: 'review',
        });
        toolResultContent = insertError
          ? `Could not log the request: ${insertError.message}`
          : 'Request logged for the team to review.';
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
