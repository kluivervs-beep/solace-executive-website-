// Supabase Edge Function: stripe-webhook
//
// Listens for Stripe events and automatically activates/deactivates a
// member's is_member_active flag, so there's nothing to do manually
// after setting up the Payment Link once.
//
// Deploy via the Supabase Dashboard (Edge Functions -> New function ->
// paste this file) or via the CLI: `supabase functions deploy stripe-webhook`.
//
// Requires these secrets (Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY      — Stripe Dashboard -> Developers -> API keys
//   STRIPE_WEBHOOK_SECRET  — shown when you create the webhook endpoint in Stripe
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
// SUPABASE_URL is already injected automatically by Supabase.

import Stripe from 'https://esm.sh/stripe@17?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setMembershipByEmail(email: string | null | undefined, active: boolean) {
  if (!email) return;
  const { data: userId, error } = await supabase.rpc('get_profile_id_by_email', {
    lookup_email: email,
  });
  if (error || !userId) {
    console.error('No matching member for email:', email, error);
    return;
  }
  await supabase.from('profiles').update({ is_member_active: active }).eq('id', userId);
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await setMembershipByEmail(session.customer_details?.email, true);
        break;
      }
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object as { customer: string };
        const customer = await stripe.customers.retrieve(obj.customer);
        const email = (customer as Stripe.Customer).email;
        await setMembershipByEmail(email, false);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('stripe-webhook handling error:', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
