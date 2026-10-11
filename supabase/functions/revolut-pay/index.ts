// Supabase Edge Function: revolut-pay
//
// Lets a member pay an invoice (public.invoices) through Revolut's hosted
// checkout. The app never sees a secret key or a card number: it asks this
// function for a checkout link, opens it, and asks again for the status when
// the member comes back.
//
//   POST { action: 'checkout', invoice_id }  -> { checkout_url, status }
//   POST { action: 'status',   invoice_id }  -> { status }
//
// Caller must be signed in and the invoice must belong to them. Amounts are
// always read from the invoices row, never from the request.
//
// Secrets (Edge Functions -> Secrets):
//   REVOLUT_SECRET_KEY   sandbox or production Merchant API secret key
//   REVOLUT_ENV          'sandbox' (default) or 'production'
//   REVOLUT_API_VERSION  optional, defaults to the version below
// Without REVOLUT_SECRET_KEY the function answers 503 payments_not_configured
// and the app shows a calm "not available yet" message.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY');
const REVOLUT_ENV = Deno.env.get('REVOLUT_ENV') === 'production' ? 'production' : 'sandbox';
const REVOLUT_API_VERSION = Deno.env.get('REVOLUT_API_VERSION') || '2026-08-17';
const BASE = REVOLUT_ENV === 'production' ? 'https://merchant.revolut.com' : 'https://sandbox-merchant.revolut.com';
const RETURN_URL = 'https://solaceexecutive.com/betaald.html';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

async function revolut(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${REVOLUT_SECRET_KEY}`,
      'Revolut-Api-Version': REVOLUT_API_VERSION,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

// Revolut order states: pending, processing, authorised, completed,
// cancelled, failed. Only "completed" means the money is in.
async function syncStatus(invoice: any): Promise<string> {
  if (invoice.status === 'paid') return 'paid';
  if (!invoice.revolut_order_id) return invoice.status;
  const r = await revolut(`/api/orders/${invoice.revolut_order_id}`);
  if (!r.ok) return invoice.status;
  if (r.data?.state === 'completed') {
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice.id)
      .neq('status', 'paid');
    return 'paid';
  }
  return invoice.status;
}

// What the Solace payment page (betalen.html) needs to show the order and
// start Apple Pay, card or Revolut Pay. The public token is meant to be
// public: it can only be used to pay this one order.
function payload(invoice: any, publicToken?: string) {
  if (!publicToken) return {};
  return {
    public_id: publicToken,
    mode: REVOLUT_ENV === 'production' ? 'prod' : 'sandbox',
    amount_cents: Math.round(Number(invoice.amount) * 100),
    currency: invoice.currency || 'EUR',
    description: String(invoice.description || '').slice(0, 120),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { action, invoice_id } = await req.json();
    if (!invoice_id || (action !== 'checkout' && action !== 'status')) return json({ error: 'bad_request' }, 400);

    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, member_id, description, amount, currency, status, revolut_order_id, checkout_url')
      .eq('id', invoice_id)
      .maybeSingle();
    if (!invoice || invoice.member_id !== user.id) return json({ error: 'not_found' }, 404);

    if (!REVOLUT_SECRET_KEY) return json({ error: 'payments_not_configured' }, 503);

    if (action === 'status') {
      return json({ status: await syncStatus(invoice) });
    }

    // action === 'checkout'
    if ((await syncStatus(invoice)) === 'paid') return json({ status: 'paid' });

    // Reuse a still-open order so tapping Pay twice never creates two charges.
    if (invoice.revolut_order_id && invoice.checkout_url) {
      const existing = await revolut(`/api/orders/${invoice.revolut_order_id}`);
      if (existing.ok && (existing.data?.state === 'pending' || existing.data?.state === 'processing')) {
        return json({ status: 'pending', checkout_url: invoice.checkout_url, ...payload(invoice, existing.data?.token) });
      }
    }

    const cents = Math.round(Number(invoice.amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return json({ error: 'invalid_amount' }, 400);

    const created = await revolut('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: cents,
        currency: invoice.currency || 'EUR',
        description: String(invoice.description).slice(0, 255),
        redirect_url: RETURN_URL,
        merchant_order_data: { reference: invoice.id },
        customer: user.email ? { email: user.email } : undefined,
      }),
    });
    if (!created.ok || !created.data?.checkout_url) {
      console.error('Revolut order failed', created.status, JSON.stringify(created.data));
      return json({ error: 'order_failed' }, 502);
    }

    await supabase
      .from('invoices')
      .update({ revolut_order_id: created.data.id, checkout_url: created.data.checkout_url })
      .eq('id', invoice.id);

    return json({ status: 'pending', checkout_url: created.data.checkout_url, ...payload(invoice, created.data.token) });
  } catch (err) {
    console.error('revolut-pay error:', err);
    return json({ error: 'server_error' }, 500);
  }
});
