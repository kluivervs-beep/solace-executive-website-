// Supabase Edge Function: revolut-webhook
//
// Revolut calls this when an order changes state. It marks the matching
// invoice paid on ORDER_COMPLETED. The app also checks the status itself
// when the member returns from checkout, so this is the safety net for when
// they close the app before coming back.
//
// Register it in the Revolut Business dashboard (Merchant API -> Webhooks)
// pointing at this function's URL, then store the signing secret it shows as
// REVOLUT_WEBHOOK_SECRET. Revolut signs `v1.<timestamp>.<raw body>` with
// HMAC SHA-256 and sends it in the Revolut-Signature header
// (`v1=<hex>`, possibly several comma separated during secret rotation).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('REVOLUT_WEBHOOK_SECRET');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!WEBHOOK_SECRET) return new Response('not configured', { status: 503 });

  const raw = await req.text();
  const timestamp = req.headers.get('revolut-request-timestamp') || '';
  const header = req.headers.get('revolut-signature') || '';

  // Reject anything older than five minutes (replay protection).
  const ts = Number(timestamp);
  const nowMs = Date.now();
  const tsMs = ts > 1e12 ? ts : ts * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > 5 * 60 * 1000) return new Response('stale', { status: 400 });

  const expected = `v1=${await hmacHex(WEBHOOK_SECRET, `v1.${timestamp}.${raw}`)}`;
  const ok = header.split(',').some((s) => safeEqual(s.trim(), expected));
  if (!ok) return new Response('bad signature', { status: 401 });

  try {
    const event = JSON.parse(raw);
    const orderId = event?.order_id || event?.data?.id;
    if (event?.event === 'ORDER_COMPLETED' && orderId) {
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('revolut_order_id', orderId)
        .neq('status', 'paid');
    }
  } catch (err) {
    console.error('revolut-webhook error:', err);
  }
  return new Response('ok');
});
