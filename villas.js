// Renders the villa gallery from public.villas, entered by staff per villa
// dossier (see supabase-schema.sql). price_from (when set) is already our
// own marked-up rate; most villas here have no listed price and use the
// "ask for rates" CTA instead.

import { supabase } from './supabase-client.js';

const WHATSAPP_NUMBER = '31644917512';

function t(key) {
  return window.SolaceI18n ? window.SolaceI18n.t(key) : key;
}

function lang() {
  return window.SolaceI18n ? window.SolaceI18n.lang : 'nl';
}

function formatPrice(value) {
  const locale = lang() === 'nl' ? 'nl-NL' : 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function whatsappHref(villa) {
  const text = t('villas.whatsapp').replace('{name}', villa.name);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function cardHtml(villa) {
  const chips = [];
  if (villa.bedrooms) chips.push(t('villas.bedrooms').replace('{n}', villa.bedrooms));
  if (villa.bathrooms) chips.push(t('villas.bathrooms').replace('{n}', villa.bathrooms));
  if (villa.max_guests) chips.push(t('villas.guests').replace('{n}', villa.max_guests));
  if (villa.has_pool) chips.push(t('villas.pool'));

  const area = lang() === 'en' && villa.area_en ? villa.area_en : villa.area;
  const description = lang() === 'en' && villa.description_en ? villa.description_en : villa.description;

  return `
    <article class="villa-card">
      <div class="villa-card-photo">
        <img src="${villa.photo_path}" alt="${villa.name}" loading="lazy">
      </div>
      <div class="villa-card-body">
        <p class="villa-card-name">${villa.name}</p>
        ${area ? `<p class="villa-card-area">${area}</p>` : ''}
        <div class="villa-card-specs">
          ${chips.map((c) => `<span class="villa-spec-chip">${c}</span>`).join('')}
        </div>
        ${description ? `<p class="villa-card-desc">${description}</p>` : ''}
        <div class="villa-card-footer">
          ${
            villa.price_from
              ? `<span class="villa-card-price"><span class="villa-card-price-label">${t('villas.from')}</span> ${formatPrice(villa.price_from)} <span class="villa-card-price-label">${t('villas.perweek')}</span></span>`
              : `<span class="villa-card-price-request">${t('villas.pricerequest')}</span>`
          }
          <a class="btn-whatsapp villa-card-cta" href="${whatsappHref(villa)}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/><path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2Zm0 18.1c-1.68 0-3.25-.46-4.6-1.27l-.33-.2-3 .79.8-2.92-.21-.3A8.09 8.09 0 0 1 3.92 12c0-4.47 3.64-8.1 8.1-8.1 4.47 0 8.1 3.63 8.1 8.1 0 4.47-3.63 8.1-8.1 8.1Z"/></svg>
            <span>${t('villas.ask')}</span>
          </a>
        </div>
      </div>
    </article>
  `;
}

async function load() {
  const grid = document.getElementById('villasGrid');
  if (!grid) return;

  const { data, error } = await supabase
    .from('villas')
    .select('name, area, area_en, bedrooms, bathrooms, max_guests, has_pool, description, description_en, price_from, photo_path')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="villas-status">${t('villas.empty')}</p>`;
    return;
  }

  grid.innerHTML = data.map(cardHtml).join('');
}

document.addEventListener('DOMContentLoaded', load);
