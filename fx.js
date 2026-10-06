/* Small effects, ported from React Bits to plain JS:
   Spotlight Card (a soft gold light follows the cursor), Glare Hover (a sheen
   sweeps over the photos) and Magnet (hero buttons lean towards the cursor).
   Pointer effects only on devices with a real pointer. Everything is off with
   reduced motion, and the page is complete without any of it. */
(function () {
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) return;

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
  window.addEventListener('pointermove', function (e) {
    magnets.forEach(function (b) {
      var r = b.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var near = Math.abs(cx - e.clientX) < r.width / 2 + PADDING && Math.abs(cy - e.clientY) < r.height / 2 + PADDING;
      b.style.translate = near ? (e.clientX - cx) / STRENGTH + 'px ' + (e.clientY - cy) / STRENGTH + 'px' : '0px 0px';
    });
  }, { passive: true });
})();
