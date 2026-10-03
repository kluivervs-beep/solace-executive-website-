(() => {
  'use strict';

  const phone = document.getElementById('pdPhone');
  if (!phone) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (k) => (window.SolaceI18n ? window.SolaceI18n.t(k) : k);

  const chat = document.getElementById('pdChat');
  const hello = document.getElementById('pdHello');
  const input = document.getElementById('pdInput');
  const typed = document.getElementById('pdTyped');
  const sendBtn = document.getElementById('pdSend');
  const island = document.getElementById('pdIsland');
  const liveIcon = document.getElementById('pdLiveIcon');
  const liveStatus = document.getElementById('pdLiveStatus');
  const livePct = document.getElementById('pdLivePct');
  const liveTitle = document.getElementById('pdLiveTitle');
  const liveBar = document.getElementById('pdLiveBar');

  // Same icon language as the app: plane for jets, cutlery for tables, watch for watches.
  const ICONS = {
    plane: '<svg viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    dine: '<svg viewBox="0 0 24 24"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/></svg>',
    watch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 9.5V12l1.8 1.2M9 7l.7-4h4.6l.7 4M9 17l.7 4h4.6l.7-4"/></svg>',
  };
  const SCENARIOS = [
    { k: 'a', icon: 'plane' },
    { k: 'b', icon: 'dine' },
    { k: 'c', icon: 'watch' },
  ];

  let runId = 0;
  let scenarioIdx = 0;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clock = (offset) => {
    const d = new Date(2026, 0, 1, 14, 2 + offset);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  function addMsg(kind, text, meta) {
    const el = document.createElement('div');
    el.className = 'pd-msg pd-msg--' + kind;
    el.textContent = text;
    if (meta) {
      const m = document.createElement('span');
      m.className = 'pd-meta';
      m.textContent = meta;
      el.appendChild(m);
    }
    chat.appendChild(el);
    raf2(() => el.classList.add('in'));
    return el;
  }

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'pd-msg pd-msg--bot pd-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    chat.appendChild(el);
    raf2(() => el.classList.add('in'));
    return el;
  }

  function addCard(sc) {
    const el = document.createElement('div');
    el.className = 'pd-msg pd-msg--bot';
    el.style.width = '88%';
    el.innerHTML =
      '<div class="pd-card">' +
        '<div class="pd-card-top"><span class="pd-card-icon">' + ICONS[sc.icon] + '</span>' +
          '<div><div class="pd-card-title"></div><div class="pd-card-sub"></div></div></div>' +
        '<div class="pd-steps">' +
          ['st1', 'st2', 'st3'].map((s) => '<div class="pd-step"><div class="pd-step-bar"></div><div class="pd-step-label">' + T('demo.' + s) + '</div></div>').join('') +
        '</div>' +
      '</div>';
    el.querySelector('.pd-card-title').textContent = T('demo.' + sc.k + '.card.title');
    el.querySelector('.pd-card-sub').textContent = T('demo.' + sc.k + '.card.sub');
    chat.appendChild(el);
    raf2(() => el.classList.add('in'));
    return el;
  }

  const stepOn = (card, n) => {
    const steps = card.querySelectorAll('.pd-step');
    for (let i = 0; i < n; i++) steps[i].classList.add('on');
  };

  function showLive(sc, pct, statusKey) {
    liveIcon.innerHTML = ICONS[sc.icon];
    liveStatus.textContent = T('demo.' + statusKey);
    livePct.textContent = pct + '%';
    liveTitle.textContent = T('demo.' + sc.k + '.live');
    liveBar.style.width = '0';
    island.classList.add('is-live');
    setTimeout(() => { liveBar.style.width = pct + '%'; }, 380);
  }
  const hideLive = () => island.classList.remove('is-live');

  function reset() {
    chat.innerHTML = '';
    chat.style.opacity = '1';
    typed.textContent = '';
    input.classList.remove('is-typing');
    hello.classList.remove('is-hidden');
    hideLive();
  }

  function renderStatic() {
    reset();
    const sc = SCENARIOS[0];
    hello.classList.add('is-hidden');
    addMsg('user', T('demo.' + sc.k + '.user'), clock(0) + ' ✓✓');
    addMsg('bot', T('demo.' + sc.k + '.bot1'), clock(1));
    stepOn(addCard(sc), 2);
    addMsg('bot', T('demo.' + sc.k + '.bot2'), clock(2));
  }

  async function play(id) {
    const alive = () => id === runId;
    while (alive()) {
      const sc = SCENARIOS[scenarioIdx % SCENARIOS.length];
      scenarioIdx++;
      reset();
      await wait(900); if (!alive()) return;

      // The member types and sends
      const userText = T('demo.' + sc.k + '.user');
      input.classList.add('is-typing');
      for (let i = 1; i <= userText.length; i++) {
        typed.textContent = userText.slice(0, i);
        await wait(32 + Math.random() * 26); if (!alive()) return;
      }
      await wait(380); if (!alive()) return;
      sendBtn.classList.add('pulse');
      await wait(160); if (!alive()) return;
      sendBtn.classList.remove('pulse');
      typed.textContent = '';
      input.classList.remove('is-typing');
      hello.classList.add('is-hidden');
      addMsg('user', userText, clock(0) + ' ✓✓');

      // The concierge acknowledges
      await wait(700); if (!alive()) return;
      let typing = addTyping();
      await wait(1400); if (!alive()) return;
      typing.remove();
      addMsg('bot', T('demo.' + sc.k + '.bot1'), clock(1));

      // The request appears, as it does in the app
      await wait(900); if (!alive()) return;
      const card = addCard(sc);
      await wait(500); if (!alive()) return;
      stepOn(card, 1);
      showLive(sc, 20, 'st1');
      await wait(2600); if (!alive()) return;
      hideLive();

      // Confirmed
      await wait(800); if (!alive()) return;
      typing = addTyping();
      await wait(1300); if (!alive()) return;
      typing.remove();
      stepOn(card, 2);
      addMsg('bot', T('demo.' + sc.k + '.bot2'), clock(2));
      await wait(500); if (!alive()) return;
      showLive(sc, 65, 'st2');
      await wait(3400); if (!alive()) return;
      hideLive();

      await wait(1500); if (!alive()) return;
      chat.style.opacity = '0';
      await wait(560); if (!alive()) return;
    }
  }

  function start() {
    runId++;
    if (reducedMotion) { renderStatic(); return; }
    play(runId);
  }
  const stop = () => { runId++; };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.35 }).observe(phone);
  } else {
    start();
  }
  document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => {
    setTimeout(() => { if (runId > 0) start(); }, 0);
  }));
})();
