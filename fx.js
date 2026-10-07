/* Small effects, ported from React Bits to plain JS:
   Spotlight Card (a soft gold light follows the cursor), Glare Hover (a sheen
   sweeps over the photos) and Magnet (hero buttons lean towards the cursor).
   Pointer effects only on devices with a real pointer. Everything is off with
   reduced motion, and the page is complete without any of it. */
(function () {
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) return;
  document.documentElement.classList.add('fx-on');
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.service-card').forEach(function (c) { c.classList.add('fx-ready'); });
  }

  // Scroll progress: a hairline of gold along the top of the page.
  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function paintProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(paintProgress); }
  }, { passive: true });
  paintProgress();

  // Photo wipe: service photos open from the top as they scroll into view,
  // and the gold rule under each section title draws itself.
  if ('IntersectionObserver' in window) {
    // A clipped element reports no intersection, so photos are watched
    // through their card instead.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var t = en.target;
          (t.__fxTarget || t).classList.add('fx-in');
          io.unobserve(t);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.service-visual, .section-title').forEach(function (el) {
      if (el.classList.contains('service-visual')) {
        var card = el.parentElement;
        var obs = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { card.classList.add('fx-ready'); obs.disconnect(); } }, { threshold: 0.15 });
        obs.observe(card);
      }
      el.classList.add('fx-wipe');
      var watch = el.classList.contains('service-visual') ? el.parentElement : el;
      watch.__fxTarget = el;
      io.observe(watch);
    });
  }

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;

  // Spotlight: the cursor position becomes two CSS variables per card.
  document.querySelectorAll('.service-card, .whatsapp-card').forEach(function (card) {
    card.classList.add('fx-spot');
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--fx-x', e.clientX - r.left + 'px');
      card.style.setProperty('--fx-y', e.clientY - r.top + 'px');
    });
  });

  // Parallax: the photo drifts a few pixels with the cursor.
  document.querySelectorAll('.service-grid .service-card:not(.service-card--cta)').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5) * -14 + 'px');
      card.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5) * -14 + 'px');
    });
    card.addEventListener('pointerleave', function () {
      card.style.setProperty('--px', '0px');
      card.style.setProperty('--py', '0px');
    });
  });

  // Glare: one extra layer inside each service photo.
  document.querySelectorAll('.service-visual').forEach(function (v) {
    var g = document.createElement('span');
    g.className = 'fx-glare';
    g.setAttribute('aria-hidden', 'true');
    v.appendChild(g);
  });

  // Magnet: buttons drift a little towards the cursor while it is near.
  var PADDING = 70;
  var STRENGTH = 4;
  var magnets = Array.prototype.slice.call(document.querySelectorAll('.hero-actions .btn'));
  magnets.forEach(function (b) {
    b.style.transition = 'translate 0.45s cubic-bezier(0.22, 1, 0.36, 1), ' + (getComputedStyle(b).transition || '');
  });
  // One read-then-write pass per frame instead of one per pointer event.
  var mx = 0, my = 0, magnetTick = false;
  function paintMagnets() {
    magnetTick = false;
    var rects = magnets.map(function (b) { return b.getBoundingClientRect(); });
    magnets.forEach(function (b, i) {
      var r = rects[i];
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var near = Math.abs(cx - mx) < r.width / 2 + PADDING && Math.abs(cy - my) < r.height / 2 + PADDING;
      b.style.translate = near ? (mx - cx) / STRENGTH + 'px ' + (my - cy) / STRENGTH + 'px' : '0px 0px';
    });
  }
  window.addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (!magnetTick) { magnetTick = true; requestAnimationFrame(paintMagnets); }
  }, { passive: true });
})();
