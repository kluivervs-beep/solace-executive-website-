// Floating "Vraag uw concierge" button with a small request-type chooser.
// One tap on a topic opens WhatsApp with a message already started, so a
// visitor never faces a blank box. Self-contained: loads float.css itself,
// carries its own NL/EN text and follows the site language (localStorage
// 'solace-lang' / <html lang>). Add to any page with:
//   <script src="float.js" defer></script>
(function () {
  if (window.__solaceFloat) return;
  window.__solaceFloat = true;

  var WA = '31644917512';
  var MAIL = 'hello@solaceexecutive.com';

  var TEXT = {
    nl: {
      fab: 'Vraag uw concierge',
      eyebrow: 'UW CONCIERGE',
      title: 'Waarmee kunnen we u helpen?',
      sub: 'Kies een onderwerp. WhatsApp opent met uw bericht al begonnen.',
      close: 'Sluiten',
      foot: 'Liever mailen? ',
      opts: [
        ['Vliegen of reizen', 'Hallo, ik wil graag een vlucht of reis regelen. '],
        ['Villa of jacht', 'Hallo, ik zoek een villa of jacht. '],
        ['Vervoer of een auto', 'Hallo, ik heb een verzoek over vervoer of een auto. '],
        ['Personal shopping', 'Hallo, ik zoek iets via personal shopping. '],
        ['Lidmaatschap', 'Hallo, ik wil graag meer weten over lidmaatschap bij Solace Executive. '],
        ['Iets anders', 'Hallo, ik heb een verzoek voor Solace Executive. ']
      ]
    },
    en: {
      fab: 'Ask your concierge',
      eyebrow: 'YOUR CONCIERGE',
      title: 'How can we help you?',
      sub: 'Pick a topic. WhatsApp opens with your message already started.',
      close: 'Close',
      foot: 'Prefer email? ',
      opts: [
        ['Flying or travel', 'Hello, I would like to arrange a flight or trip. '],
        ['Villa or yacht', 'Hello, I am looking for a villa or yacht. '],
        ['Transport or a car', 'Hello, I have a request about transport or a car. '],
        ['Personal shopping', 'Hello, I am looking for something through personal shopping. '],
        ['Membership', 'Hello, I would like to know more about membership at Solace Executive. '],
        ['Something else', 'Hello, I have a request for Solace Executive. ']
      ]
    }
  };

  function currentLang() {
    try {
      var s = localStorage.getItem('solace-lang');
      if (s === 'nl' || s === 'en') return s;
    } catch (e) {}
    var h = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
    return h === 'en' ? 'en' : 'nl';
  }

  function docLang() {
    var h = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
    return h === 'en' || h === 'nl' ? h : currentLang();
  }

  // Load the stylesheet that sits next to this script.
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/[^\/]*$/, '') : '';
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = base + 'float.css';
  document.head.appendChild(link);

  var ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var root = document.createElement('div');
  root.className = 'sx-float';
  root.setAttribute('data-nosnippet', '');
  var fab, panel, firstOpt, lastFocus = null;

  function build() {
    var L = TEXT[docLang()];
    var items = L.opts.map(function (o) {
      return '<li><a class="sx-opt" href="https://wa.me/' + WA + '?text=' + encodeURIComponent(o[1]) + '" target="_blank" rel="noopener"><span>' + o[0] + '</span><span aria-hidden="true">&rarr;</span></a></li>';
    }).join('');
    var wasOpen = root.classList.contains('is-open');
    root.innerHTML =
      '<div class="sx-panel" id="sxPanel" role="dialog" aria-modal="false" aria-labelledby="sxTitle">' +
        '<button type="button" class="sx-x" aria-label="' + L.close + '">' + CLOSE + '</button>' +
        '<p class="sx-eyebrow">' + L.eyebrow + '</p>' +
        '<h2 class="sx-title" id="sxTitle">' + L.title + '</h2>' +
        '<p class="sx-sub">' + L.sub + '</p>' +
        '<ul class="sx-opts">' + items + '</ul>' +
        '<p class="sx-foot">' + L.foot + '<a class="sx-mail" href="mailto:' + MAIL + '">' + MAIL + '</a></p>' +
      '</div>' +
      '<button type="button" class="sx-fab" aria-expanded="' + wasOpen + '" aria-controls="sxPanel">' + ICON + '<span>' + L.fab + '</span></button>';
    fab = root.querySelector('.sx-fab');
    panel = root.querySelector('.sx-panel');
    firstOpt = root.querySelector('.sx-opt');
    fab.addEventListener('click', function () { setOpen(!root.classList.contains('is-open')); });
    root.querySelector('.sx-x').addEventListener('click', function () { setOpen(false); });
    panel.setAttribute('aria-hidden', wasOpen ? 'false' : 'true');
    Array.prototype.forEach.call(panel.querySelectorAll('a,button'), function (el) { el.tabIndex = wasOpen ? 0 : -1; });
  }

  function setOpen(open) {
    root.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    Array.prototype.forEach.call(panel.querySelectorAll('a,button'), function (el) { el.tabIndex = open ? 0 : -1; });
    if (open) { lastFocus = document.activeElement; if (firstOpt) firstOpt.focus({ preventScroll: true }); }
    else if (lastFocus && lastFocus.focus) { fab.focus({ preventScroll: true }); lastFocus = null; }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-open')) setOpen(false);
  });
  document.addEventListener('click', function (e) {
    if (root.classList.contains('is-open') && !root.contains(e.target)) setOpen(false);
  });

  function mount() {
    if (!document.body) return;
    build();
    document.body.appendChild(root);
    // Appear a moment after load so it never competes with the intro.
    setTimeout(function () { root.classList.add('is-ready'); }, 1400);

    // Follow language changes made by the page's own toggle.
    var last = docLang();
    new MutationObserver(function () {
      var now = docLang();
      if (now !== last) { last = now; build(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    // Stay out of the way where the page already shows its own WhatsApp
    // cards (homepage chat section) and while the intake modal is open.
    var chat = document.getElementById('chat');
    if (chat && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var on = en[0] && en[0].isIntersecting;
        root.classList.toggle('is-quiet', !!on);
        if (on && root.classList.contains('is-open')) setOpen(false);
      }, { threshold: 0.25 }).observe(chat);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
