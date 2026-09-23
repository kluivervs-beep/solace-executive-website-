// Renders the "Volg ons" Instagram gallery on the homepage from
// public.instagram_posts, kept current by the sync-instagram edge
// function (see supabase/functions/sync-instagram). Nothing here needs
// to be updated by hand when a new photo goes up on the account.

import { supabase } from './supabase-client.js';

const MAX_SHOWN = 8;
const STORY_DURATION = 5000;

let stories = [];
let currentStoryIndex = 0;
let storyTimer = null;

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

async function loadPosts() {
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

async function loadProfile() {
  const img = document.getElementById('instagramAvatarImg');
  const ring = document.getElementById('instagramAvatarRing');
  const link = document.getElementById('instagramAvatarLink');
  if (!img || !ring || !link) return;

  const { data } = await supabase
    .from('instagram_profile')
    .select('profile_picture_url, has_active_story')
    .eq('id', 'main')
    .maybeSingle();

  if (!data) return;

  if (data.profile_picture_url) {
    img.src = data.profile_picture_url;
    img.hidden = false;
  }

  if (!data.has_active_story) return;

  const { data: storyRows } = await supabase
    .from('instagram_stories')
    .select('media_type, media_url, permalink, posted_at')
    .order('posted_at', { ascending: true });

  stories = storyRows || [];
  if (stories.length === 0) return;

  ring.classList.add('has-story');
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openStoryViewer();
  });
}

function openStoryViewer() {
  const viewer = document.getElementById('storyViewer');
  const bars = document.getElementById('storyViewerBars');
  if (!viewer || !bars) return;

  bars.innerHTML = stories.map(() => '<div class="story-viewer-bar"><div class="story-viewer-bar-fill"></div></div>').join('');
  viewer.hidden = false;
  showStory(0);
}

function closeStoryViewer() {
  clearTimeout(storyTimer);
  const viewer = document.getElementById('storyViewer');
  const media = document.getElementById('storyViewerMedia');
  if (viewer) viewer.hidden = true;
  if (media) media.innerHTML = '';
}

function showStory(index) {
  clearTimeout(storyTimer);
  if (index < 0 || index >= stories.length) {
    closeStoryViewer();
    return;
  }
  currentStoryIndex = index;

  const bars = document.querySelectorAll('.story-viewer-bar-fill');
  bars.forEach((fill, i) => {
    fill.style.transition = 'none';
    fill.style.width = i < index ? '100%' : '0%';
  });

  const story = stories[index];
  const media = document.getElementById('storyViewerMedia');
  media.innerHTML =
    story.media_type === 'VIDEO'
      ? `<video src="${story.media_url}" autoplay muted playsinline></video>`
      : `<img src="${story.media_url}" alt="">`;

  requestAnimationFrame(() => {
    const fill = bars[index];
    if (fill) {
      fill.style.transition = `width ${STORY_DURATION}ms linear`;
      fill.style.width = '100%';
    }
  });

  storyTimer = setTimeout(() => showStory(index + 1), STORY_DURATION);
}

function initStoryViewer() {
  const closeBtn = document.getElementById('storyViewerClose');
  const prevBtn = document.getElementById('storyViewerPrev');
  const nextBtn = document.getElementById('storyViewerNext');
  const viewer = document.getElementById('storyViewer');
  if (!viewer) return;

  if (closeBtn) closeBtn.addEventListener('click', closeStoryViewer);
  if (prevBtn) prevBtn.addEventListener('click', () => showStory(currentStoryIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showStory(currentStoryIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeStoryViewer();
    if (e.key === 'ArrowRight') showStory(currentStoryIndex + 1);
    if (e.key === 'ArrowLeft') showStory(currentStoryIndex - 1);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadPosts();
  loadProfile();
  initStoryViewer();
});
