// Renders the "Volg ons" Instagram gallery on the homepage from
// public.instagram_posts, kept current by the sync-instagram edge
// function (see supabase/functions/sync-instagram). Nothing here needs
// to be updated by hand when a new photo goes up on the account.

import { supabase } from './supabase-client.js';

const MAX_SHOWN = 8;

function t(key) {
  return window.SolaceI18n ? window.SolaceI18n.t(key) : key;
}

function cardHtml(post) {
  const alt = post.caption ? post.caption.slice(0, 140) : 'Solace Executive op Instagram';
  return `
    <a class="instagram-item" href="${post.permalink}" target="_blank" rel="noopener">
      <img src="${post.media_url}" alt="${alt.replace(/"/g, '&quot;')}" loading="lazy">
    </a>
  `;
}

async function load() {
  const grid = document.getElementById('instagramGrid');
  if (!grid) return;

  const { data, error } = await supabase
    .from('instagram_posts')
    .select('permalink, media_url, caption')
    .eq('active', true)
    .order('posted_at', { ascending: false })
    .limit(MAX_SHOWN);

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="instagram-status">${t('instagram.empty')}</p>`;
    return;
  }

  grid.innerHTML = data.map(cardHtml).join('');
}

document.addEventListener('DOMContentLoaded', load);
