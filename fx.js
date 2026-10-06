/* Small hover effects, ported from React Bits to plain JS:
   Spotlight Card (a soft gold light follows the cursor), Glare Hover (a sheen
   sweeps over the photos) and Magnet (hero buttons lean towards the cursor).
   Only on devices with a real pointer, and never with reduced motion. */
(function () {
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || calm) return;

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
