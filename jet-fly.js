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
    /* then it slowly pulls back until the whole jet sits in the picture, the sky turning to night */
    .to('#jfPlane', { y: endY, scale: endScale, duration: 0.3, ease: 'power2.inOut' }, 0.34)
    .to('#jfNight', { opacity: 1, duration: 0.3, ease: 'power1.inOut' }, 0.4)
    /* in place, the jet melts into its own outline: the photo fades out while the gold outline fades in */
    .to('#jfTopMap', { opacity: 1, duration: 0.2, ease: 'power1.inOut' }, 0.64)
    .to('#jfTopPhoto', { opacity: 0, duration: 0.26, ease: 'power1.inOut' }, 0.68)
    .set('#jfMap', { opacity: 1 }, 0.74)
    .fromTo('.jfWall', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.08, stagger: 0.01, ease: 'power1.out' }, 0.78)
    .fromTo('.jfSeat', { opacity: 0 }, { opacity: 1, duration: 0.05, stagger: 0.004, ease: 'power1.out' }, 0.82)
    .fromTo('.jfLbl', { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.05, stagger: 0.03, ease: 'power2.out' }, 0.9)
    .fromTo('#jfCopy', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.86);
  if (manual) { story.progress(parseFloat(q.get('sp'))); var hh = document.querySelector('.lp-hero-full'); if (hh) hh.style.display = 'none'; }
})();
