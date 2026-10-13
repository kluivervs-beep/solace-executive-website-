/* Private jets: the black jet flies in over the pale sky, then fades slowly into our seat map.
   Scroll-driven (GSAP ScrollTrigger pin) with smooth scrolling (Lenis). Reduced motion: static map. */
(function () {
  var d = document.documentElement;
  var q = new URLSearchParams(location.search);
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sec = document.getElementById('jf');
  if (!sec) return;
  if (calm || !window.gsap || !window.ScrollTrigger) { sec.classList.add('jf-calm'); d.classList.add('jf-calm'); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* compare the two jets: ?jet=beige shows the original photo, default is the matte black */
  if (q.get('jet') === 'beige') { ['jfTopPhoto'].forEach(function (id) { var el = document.getElementById(id); if (el) el.src = 'assets/photos/jet-top-beige.webp'; }); }
  var bg = sec.querySelector('.jf-bg');
  if (bg) { var p = bg.play(); if (p && p.catch) p.catch(function () {}); }

  if (window.Lenis) {
    var lenis = new Lenis({ duration: 1.25, smoothWheel: true, anchors: true,
      prevent: function (n) { return n.closest && n.closest('[role="dialog"], [data-lenis-prevent]'); } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.solaceLenis = lenis;
  }

  var mobile = window.matchMedia('(max-width: 760px)').matches;
  var endScale = mobile ? 0.7 : 0.613;           /* jet height ends near 92vh on desktop */
  var endY = mobile ? '10vh' : '4vh';

  gsap.set('#jfPlane', { xPercent: -50, y: '104vh', scale: mobile ? 1.15 : 1.9 });
  gsap.set('#jfCopy', { opacity: 0, y: 30 });

  var manual = q.get('sp') !== null;               /* test only: ?sp=0.6 shows the story at 60% */
  var story = gsap.timeline(manual ? { paused: true } : {
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: sec, start: 'top top', end: '+=600%', pin: true, scrub: 1.8, anticipatePin: 1 }
  });
  story
    /* the jet rises out of the bottom, zoomed in so the wings leave the screen */
    .to('#jfPlane', { y: mobile ? '-8vh' : '-34vh', scale: mobile ? 1.1 : 1.7, duration: 0.3, ease: 'power1.inOut' }, 0.03)
    .to('#jfL', { xPercent: -10, duration: 0.4 }, 0.08)
    .to('#jfR', { xPercent: 10, duration: 0.4 }, 0.08)
    .to('#jfSub,#jfSmall', { opacity: 0, duration: 0.06 }, 0.3)
    .to('#jfL,#jfR', { opacity: 0, duration: 0.08, ease: 'power1.in' }, 0.34)
    /* then it slowly pulls back until the whole jet sits in the picture, the sky turning to warm light */
    .to('#jfPlane', { y: endY, scale: endScale, duration: 0.3, ease: 'power2.inOut' }, 0.34)
    .to('#jfNight', { opacity: 1, duration: 0.3, ease: 'power1.inOut' }, 0.4)
    /* the wings and engines dissolve; the fuselage stays and starts to open up into the plan */
    .fromTo('#jfTopPhoto', { '--ma': '-20%', '--mb': '-6%', '--mc': '106%', '--md': '120%' }, { '--ma': '30%', '--mb': '42%', '--mc': '58%', '--md': '70%', filter: 'blur(5px)', duration: 0.22, ease: 'power1.inOut' }, 0.54)
    .set('#jfPlanImg', { opacity: 0, scaleX: 0.71 }, 0)
    .to('#jfPlanImg', { opacity: 1, duration: 0.18, ease: 'power1.inOut' }, 0.7)
    .to('#jfPlanImg', { scaleX: 1, duration: 0.22, ease: 'power2.inOut' }, 0.7)
    .to('#jfTopPhoto', { opacity: 0, duration: 0.14, ease: 'power1.inOut' }, 0.66)
    .fromTo('.jpLbl', { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.05, stagger: 0.03, ease: 'power2.out' }, 0.9)
    .fromTo('#jfCopy', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.86);
  if (manual) { story.progress(parseFloat(q.get('sp'))); var hh = document.querySelector('.lp-hero-full'); if (hh) hh.style.display = 'none'; }
})();

/* Accordion with a tall photo: click (or tap) a line, the photo wipes up into the next one. */
(function () {
  var acc = document.getElementById('jcAcc'), stage = document.getElementById('jcStage');
  if (!acc || !stage) return;
  var items = [].slice.call(acc.querySelectorAll('.jc-item'));
  var imgs = [].slice.call(stage.querySelectorAll('img'));
  var cur = 0, timer = null, userTouched = false;
  function show(i) {
    if (i === cur) return;
    var prev = imgs[cur], next = imgs[i];
    imgs.forEach(function (im) { im.classList.remove('is-in', 'is-out'); });
    prev.classList.remove('is-on'); prev.classList.add('is-out');
    next.classList.add('is-in');
    next.addEventListener('animationend', function done() {
      next.removeEventListener('animationend', done);
      imgs.forEach(function (im) { im.classList.remove('is-on', 'is-in', 'is-out'); });
      next.classList.add('is-on');
    });
    items.forEach(function (it, k) {
      var on = k === i; it.classList.toggle('is-open', on);
      it.querySelector('.jc-btn').setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    cur = i;
  }
  items.forEach(function (it, k) {
    it.querySelector('.jc-btn').addEventListener('click', function () { userTouched = true; clearInterval(timer); show(k); });
  });
  /* gentle auto-advance while the section is on screen, until the visitor takes over */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new IntersectionObserver(function (es) {
      clearInterval(timer);
      if (es[0].isIntersecting && !userTouched) timer = setInterval(function () { show((cur + 1) % items.length); }, 7000);
    }, { threshold: 0.5 }).observe(stage);
  }
  /* live local time */
  var clock = document.getElementById('jcClock');
  function tick() { try { clock.textContent = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date()); } catch (e) {} }
  tick(); setInterval(tick, 20000);
})();
