/* Window hero (homepage opening).
   1. The window fades in calmly out of the dark, shade down, our name on it.
   2. The shade lifts, slowly. Only the window and the sky.
   3. The site comes in: header, headlines, text, button.
   4. On scroll the window grows and leaves the screen while the clouds stay where they are,
      our line settles on the clouds, and the sky dims into the night of the site.
   The opening plays once per session (?intro=1 forces it). Reduced motion: no animation. */
(function () {
  var d = document.documentElement;
  var q = new URLSearchParams(location.search);
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var intro = d.classList.contains('wh-intro');
  var hero = document.getElementById('top');
  if (!hero || !window.gsap) { d.classList.remove('wh-intro'); return; }
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* Smooth scrolling (Lenis), tied to ScrollTrigger so the zoom follows the scroll buttery. */
  var lenis = null;
  if (window.Lenis && window.ScrollTrigger && !calm) {
    lenis = new Lenis({
      duration: 1.25,
      smoothWheel: true,
      anchors: true,
      prevent: function (node) { return node.closest && node.closest('.sx-panel, [role="dialog"], .intake-modal, [data-lenis-prevent]'); }
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    if (intro) lenis.stop();
    window.solaceLenis = lenis;   /* handy for testing: solaceLenis.scrollTo(y, { immediate: true }) */
  }

  /* The header and the concierge button stay out of the opening; they pop in when we reach the site.
     Until then our logo stands top left (#whBrand). It fades in with the rest of the page after
     the shade opens, and fades out as the real header (which has the logo itself) pops in, so
     the logo is never there twice. With reduced motion the header just stays and there is no extra logo. */
  var chrome = document.querySelectorAll('.site-header, .sx-float');
  var brand = document.getElementById('whBrand');
  var chromeOn = true;
  var brandOk = false;
  function setBrand(on, instant) {
    if (!brandOk) return;
    gsap.to(brand, on
      ? { autoAlpha: 1, duration: instant ? 0 : 0.7, delay: instant ? 0 : 0.3, ease: 'power2.out', overwrite: true }
      : { autoAlpha: 0, duration: instant ? 0 : 0.22, delay: 0, ease: 'power1.in', overwrite: true });
  }
  function setChrome(on, instant) {
    if (!chrome.length || on === chromeOn) return;
    chromeOn = on;
    gsap.killTweensOf(chrome);
    setBrand(!on, instant);
    if (on) {
      gsap.set(chrome, { visibility: 'visible', pointerEvents: 'auto' });
      gsap.to(chrome, { opacity: 1, y: 0, scale: 1, duration: instant ? 0 : 0.75, delay: instant ? 0 : 0.12, ease: 'back.out(1.8)', stagger: 0.06, overwrite: true });
    } else {
      gsap.to(chrome, { opacity: 0, y: -18, scale: 0.97, duration: instant ? 0 : 0.35, ease: 'power2.in', pointerEvents: 'none', onComplete: function () { gsap.set(chrome, { visibility: 'hidden' }); } });
    }
  }
  if (d.classList.contains('wh-hdr-off')) {
    gsap.set(chrome, { opacity: 0, y: -18, scale: 0.97, visibility: 'hidden', pointerEvents: 'none' });
    chromeOn = false;
    brandOk = !!brand;
    /* seen/skipped opening: the logo is there at once; during the opening the timeline brings it in */
    if (brandOk) gsap.set(brand, { autoAlpha: intro ? 0 : 1 });
    d.classList.remove('wh-hdr-off');
  }

  /* The clouds: a loop that keeps playing, all the way through the zoom. */
  var video = document.getElementById('whVideo');
  if (video) {
    if (calm) { video.removeAttribute('autoplay'); video.pause(); }
    else { var pp = video.play(); if (pp && pp.catch) pp.catch(function () { /* the poster stays, that is fine */ }); }
  }

  /* Words rise out of their own line. Splits text (and the <em> inside it) into word spans;
     runs again when the language is switched, because the translation replaces the text. */
  function splitWords(el) {
    if (!el || el.querySelector('.wi')) return;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { walk(n); }
      });
    })(el);
  }
  var storyEls = document.querySelectorAll('#whStatement .wh-big, #whStatement .wh-mid, #whStatement .wh-end');
  function splitAll() { storyEls.forEach(splitWords); }
  splitAll();
  if (window.MutationObserver) {
    storyEls.forEach(function (el) {
      new MutationObserver(function () { if (!el.querySelector('.wi')) splitWords(el); }).observe(el, { childList: true });
    });
  }

  var blurIn = { opacity: 0, filter: 'blur(14px)', y: 14 };
  var sharp = { opacity: 1, filter: 'blur(0px)', y: 0, ease: 'power3.out' };
  var built = false;

  function finishIntro() {
    d.classList.remove('wh-intro');
    gsap.set('.wh-win,.wh-hl,.wh-sub,.wh-hint,.wh-pill,#whCover', { clearProps: 'opacity,filter,transform,visibility' });
    try { sessionStorage.setItem('solace-home-intro', '1'); } catch (e) {}
    if (lenis) lenis.start();
    buildStory();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  /* ------------------------------------------------------------------
     The opening, about 7 seconds
  ------------------------------------------------------------------ */
  var tl;
  if (intro) {
    tl = gsap.timeline({ onComplete: finishIntro });
    tl.fromTo('#whCover', { opacity: 1 }, { opacity: 0, duration: 1.7, ease: 'power1.inOut' }, 0.3)
      .fromTo('.wh-win', { scale: 0.965 }, { scale: 1, duration: 1.9, ease: 'power2.out' }, 0.3)
      .from('.wh-tag', { opacity: 0, duration: 1.0, ease: 'power1.out' }, 1.1)
      .to('.wh-tag', { opacity: 0, duration: 0.5, ease: 'power1.in' }, 3.0)
      .to('.wh-shade', { yPercent: -102, duration: 1.6, ease: 'power2.inOut' }, 3.1)
      .fromTo('#whA', blurIn, Object.assign({ duration: 1.1 }, sharp), 5.4)
      .fromTo('#whB', blurIn, Object.assign({ duration: 1.1 }, sharp), 5.8)
      .fromTo('#whSub,#whHint', blurIn, Object.assign({ duration: 0.9, stagger: 0.15 }, sharp), 6.3)
      .fromTo('#whPill', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 6.5);
    /* the logo comes in with the page, right after the shade has opened */
    if (brandOk) tl.fromTo('#whBrand', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.0, ease: 'power2.out' }, 5.3);
    var skip = function (e) { if (e) e.preventDefault(); if (tl.progress() < 1) tl.progress(1); };
    var skipEl = document.getElementById('whSkip');
    if (skipEl) skipEl.addEventListener('click', skip);
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') skip(); });
    /* Never block the page: after 14 s everything is usable, whatever happened. */
    setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 14000);
  }

  /* ------------------------------------------------------------------
     Scroll: leave the window, stay in the clouds, dim into the site.
     The window frame grows and slides off the screen; the clouds behind it
     do not zoom at the sun, they only drift closer. Built after the opening
     so the tweens start from the real resting state.
  ------------------------------------------------------------------ */
  function buildStory() {
    if (built || calm || !window.ScrollTrigger) return;
    built = true;
    var manual = q.get('sp') !== null;   /* test only: ?sp=0.5 shows the story at 50% without scrolling */
    var story = gsap.timeline(manual ? { paused: true } : {
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: '+=330%', pin: true, scrub: 1.4, anticipatePin: 1,
        onUpdate: function (self) { setChrome(self.progress > 0.84); } }
    });
    story
      /* the first push: words leave to the sides, the window starts to grow */
      .to('#whA', { xPercent: -60, opacity: 0, duration: 0.14, ease: 'power1.in' }, 0)
      .to('#whB', { xPercent: 60, opacity: 0, duration: 0.14, ease: 'power1.in' }, 0)
      .to('#whSub,#whHint,#whPill', { opacity: 0, duration: 0.08 }, 0)
      .to('.wh-win', { scale: 2.6, duration: 0.3, ease: 'power1.inOut' }, 0)
      /* then the frame sweeps past us and out of the picture */
      .to('.wh-win', { scale: 11, duration: 0.36, ease: 'power2.in' }, 0.3)
      /* the clouds only drift a little closer, for the whole scroll */
      .fromTo('#whVideo', { scale: 1 }, { scale: 1.14, duration: 1, ease: 'none' }, 0)
      /* a little blue from the top, so the words sit well on the clouds */
      .to('#whTint', { opacity: 1, duration: 0.2, ease: 'power1.inOut' }, 0.42)
      /* our line settles on the clouds, word by word */
      .set('#whStatement', { opacity: 1 }, 0.46)
      .fromTo('#whStatement .wh-eyebrow i', { scaleX: 0 }, { scaleX: 1, duration: 0.1, ease: 'power2.out' }, 0.46)
      .fromTo('#whStatement .wh-eyebrow span', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.48)
      .fromTo('#whStatement .wh-big .wi', { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.11, stagger: 0.035, ease: 'power3.out' }, 0.5)
      .fromTo('#whStatement .wh-mid .wi', { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.07, stagger: 0.012, ease: 'power3.out' }, 0.58)
      .fromTo('#whStatement .wh-end .wi', { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.07, stagger: 0.02, ease: 'power3.out' }, 0.68)
      .fromTo('#whStatement .wh-svc', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.72)
      .to('#whStatement', { y: -46, duration: 0.2, ease: 'none' }, 0.7)
      .to('#whStatement', { opacity: 0, duration: 0.08, ease: 'power1.in' }, 0.86)
      /* the sky dims into the night, and the site continues */
      .to('#whDusk', { opacity: 1, duration: 0.24, ease: 'power1.in' }, 0.76);
    if (manual) { var spv = parseFloat(q.get('sp')); story.progress(spv); setChrome(spv > 0.84, true); }
  }

  /* The plane button: on a hover or focus the little planes rise by CSS alone. On a tap we play the
     same flight and navigate a moment later, so it is seen. A mouse click or the keyboard goes straight
     through (the hover already played), and with reduced motion nothing is delayed. */
  var plane = document.querySelector('.wh-pill .plane');
  if (plane) {
    var lastPtr = '';
    plane.addEventListener('pointerdown', function (e) { lastPtr = e.pointerType || ''; });
    plane.addEventListener('touchstart', function () { lastPtr = 'touch'; }, { passive: true });
    plane.addEventListener('click', function (e) {
      var tap = lastPtr === 'touch' || e.pointerType === 'touch';
      lastPtr = '';
      if (calm || !tap || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (plane.classList.contains('is-fly')) return;
      plane.classList.add('is-fly');
      var href = plane.href;
      setTimeout(function () { location.href = href; }, 350);
    });
    window.addEventListener('pageshow', function () { plane.classList.remove('is-fly'); });   /* back button / bfcache */
  }

  /* test hooks for stills: ?t=3.2 shows the opening at that second */
  if (q.get('t') !== null && tl) { tl.pause(); tl.time(parseFloat(q.get('t'))); }
  if (q.get('sp') !== null) { if (tl) tl.progress(1); else buildStory(); }
  if (!intro) buildStory();
  /* a visit that starts below the hero (reload, anchor link) gets the header at once */
  window.addEventListener('load', function () { if (window.scrollY > hero.offsetHeight * 2) setChrome(true, true); });
})();
