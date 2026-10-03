// Returns everything we hold about the calling member as one JSON object, so
// the app's "Export my data" button can hand it to the share sheet. Verifies
// the caller's own JWT, then reads with the service role (some tables only
// expose a member's rows through RLS policies that are awkward to rely on
// from here). Only ever reads rows where the member is the owner.

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

// table -> column that holds the owning member's id
const TABLES: [string, string][] = [
  ['requests', 'member_id'],
  ['concierge_messages', 'member_id'],
  ['favorites', 'member_id'],
  ['shop_wishlist', 'member_id'],
  ['muse_items', 'member_id'],
  ['member_pieces', 'member_id'],
  ['salon_messages', 'sender_id'],
  ['member_nudges', 'member_id'],
  ['point_transactions', 'member_id'],
  ['invoices', 'member_id'],
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401);
    const user = userData.user;

    const out: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, created_at: user.created_at },
    };

    const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile) {
      // Staff-only fields are not the member's data to export.
      delete (profile as Record<string, unknown>).push_token;
      out.profile = profile;
    }

    for (const [table, col] of TABLES) {
      const { data, error } = await admin.from(table).select('*').eq(col, user.id);
      if (!error) out[table] = data;
    }

    return json(out);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
