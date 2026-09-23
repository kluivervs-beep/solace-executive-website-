// Renders the live "Empty legs" section on the homepage from the same
// public.empty_legs table the app and staff dashboard already use — kept
// current by the sync-empty-legs edge function, so nothing here needs to
// be updated by hand. Only ever reads origin/destination/departure_at/
// aircraft/max_passengers/price_from: `source`/`source_ref` exist in the
// table for our own sync bookkeeping and must never reach this page.

import { supabase } from './supabase-client.js';

const WHATSAPP_NUMBER = '31644917512';
const MAX_SHOWN = 6;

let legs = [];

function t(key) {
  return window.SolaceI18n ? window.SolaceI18n.t(key) : key;
}

function lang() {
  return window.SolaceI18n ? window.SolaceI18n.lang : 'nl';
}

function formatDate(iso) {
  const d = new Date(iso);
  const locale = lang() === 'nl' ? 'nl-NL' : 'en-GB';
  const datePart = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function formatPrice(value) {
  const locale = lang() === 'nl' ? 'nl-NL' : 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function whatsappHref(leg) {
  const dateLabel = new Date(leg.departure_at).toLocaleDateString(lang() === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
  });
  const text = t('emptylegs.whatsapp')
    .replace('{origin}', leg.origin)
    .replace('{destination}', leg.destination)
    .replace('{date}', dateLabel);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function cardHtml(leg) {
  const seats = leg.max_passengers ? t('emptylegs.seats').replace('{n}', leg.max_passengers) : '';
  return `
    <article class="empty-leg-card liquid-glass">
      <div class="empty-leg-route">
        <span>${leg.origin}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <span>${leg.destination}</span>
      </div>
      <p class="empty-leg-meta">${formatDate(leg.departure_at)}</p>
      <p class="empty-leg-meta">${leg.aircraft}${seats ? ' · ' + seats : ''}</p>
      <div class="empty-leg-footer">
        <span class="empty-leg-price"><span class="empty-leg-price-label">${t('emptylegs.from')}</span> ${formatPrice(leg.price_from)}</span>
        <a class="empty-leg-cta" href="${whatsappHref(leg)}" target="_blank" rel="noopener">${t('emptylegs.ask')}</a>
      </div>
    </article>
  `;
}

function render() {
  const grid = document.getElementById('emptyLegsGrid');
  if (!grid) return;
  if (legs.length === 0) {
    grid.innerHTML = `<p class="empty-legs-status">${t('emptylegs.empty')}</p>`;
    return;
  }
  grid.innerHTML = legs.map(cardHtml).join('');
}

async function load() {
  const { data, error } = await supabase
    .from('empty_legs')
    .select('origin, destination, departure_at, aircraft, max_passengers, price_from')
    .eq('active', true)
    .gte('departure_at', new Date().toISOString())
    .order('departure_at', { ascending: true })
    .limit(MAX_SHOWN);

  if (error) {
    const grid = document.getElementById('emptyLegsGrid');
    if (grid) grid.innerHTML = `<p class="empty-legs-status">${t('emptylegs.empty')}</p>`;
    return;
  }

  legs = data || [];
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Language text (data-i18n) applies synchronously in the click
      // handler that runs before this one -- re-rendering here just
      // needs to pick up the already-updated window.SolaceI18n.lang.
      render();
    });
  });
});
