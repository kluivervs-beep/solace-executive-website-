// Supabase Edge Function: sync-empty-legs
//
// Pulls current empty-leg listings from our jet partner JetServiceNL's
// public site and upserts them into public.empty_legs, so staff doesn't
// have to enter them by hand. Our own marked-up price is shown, never
// their raw rate, and the partner name never reaches the app/website.
//
// This function has verify_jwt off (like the other automated/webhook
// functions in this project) so pg_cron can call it without juggling a
// Supabase JWT. Instead it checks a private shared secret, so it's not
// left open to the public internet.
//
// Runs on a schedule via pg_cron + pg_net (see supabase-schema.sql).
// Can also be triggered manually: POST to this function's URL with
// header 'x-sync-secret: <SYNC_SECRET>'.
//
// Requires these secrets (Edge Functions -> Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — Project Settings -> API -> service_role
//   SYNC_SECRET               — any random string, shared with the pg_cron job
// SUPABASE_URL is already injected automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCE_URL = 'https://jetservicenl.com/nl/empty-legs/';
const MARKUP = 1.15;

type ParsedFlight = {
  source: string;
  source_ref: string;
  origin: string;
  destination: string;
  departure_at: string;
  aircraft: string;
  max_passengers: number | null;
  price_from: number;
  active: boolean;
};

function roundPrice(raw: number) {
  return Math.round((raw * MARKUP) / 50) * 50;
}

function parseFlights(html: string): ParsedFlight[] {
  const flights: ParsedFlight[] = [];
  const articleRe = /<article\s+class="destination-card empty-leg-list-card[^"]*"[\s\S]*?<\/article>/g;
  const blocks = html.match(articleRe) || [];

  for (const block of blocks) {
    const hrefMatch = block.match(/href="\/nl\/empty-legs\/([^"/]+)\/"/);
    const dateMatch = block.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
    const paxMatch = block.match(/data-pax="(\d+)"/);
    const routeMatch = block.match(/<h3><a[^>]*>([^<→]+)→([^<]+)<\/a><\/h3>/);
    const timeMatch = block.match(/om (\d{2}:\d{2})/);
    const priceMatch = block.match(/Vanaf\s*€\s*([\d.]+)/);
    const aircraftMatch = block.match(/<dt>Vliegtuig<\/dt>\s*<dd>([^<]+)<\/dd>/);

    if (!hrefMatch || !dateMatch || !routeMatch || !priceMatch || !aircraftMatch) continue;

    const rawPrice = parseInt(priceMatch[1].replace(/\./g, ''), 10);
    if (!Number.isFinite(rawPrice)) continue;

    flights.push({
      source: 'jetservicenl',
      source_ref: hrefMatch[1],
      origin: routeMatch[1].trim(),
      destination: routeMatch[2].trim(),
      departure_at: `${dateMatch[1]}T${timeMatch ? timeMatch[1] : '12:00'}:00+02:00`,
      aircraft: aircraftMatch[1].trim(),
      max_passengers: paxMatch ? parseInt(paxMatch[1], 10) : null,
      price_from: roundPrice(rawPrice),
      active: true,
    });
  }

  return flights;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SolaceExecutiveSync/1.0; +https://solaceexecutive.com)' },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Fetch failed: ${res.status}` }), { status: 502 });
    }
    const html = await res.text();
    const flights = parseFlights(html);

    if (flights.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No flights parsed, page structure may have changed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Only keep the soonest-departing flights, so the app doesn't get
    // flooded with the partner's full market feed.
    flights.sort((a, b) => a.departure_at.localeCompare(b.departure_at));
    const kept = flights.slice(0, 15);

    const { error: upsertError } = await supabase.from('empty_legs').upsert(kept, { onConflict: 'source_ref' });
    if (upsertError) throw upsertError;

    const keptRefs = kept.map((f) => f.source_ref);
    const { error: deleteError } = await supabase
      .from('empty_legs')
      .delete()
      .eq('source', 'jetservicenl')
      .not('source_ref', 'in', `(${keptRefs.map((r) => `"${r}"`).join(',')})`);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ ok: true, synced: kept.length }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
