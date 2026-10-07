/* Mobile polish: small dots under the swipeable services row. Purely visual
   (aria-hidden); the row itself stays a normal scroll container. */
(function () {
  var grid = document.querySelector('.service-grid');
  if (!grid || !('IntersectionObserver' in window)) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(':scope > .service-card'));
  if (cards.length < 2) return;

  var dots = document.createElement('div');
  dots.className = 'service-dots';
  dots.setAttribute('aria-hidden', 'true');
  cards.forEach(function () { dots.appendChild(document.createElement('i')); });
  grid.parentNode.insertBefore(dots, grid.nextSibling);

  function update() {
    var max = grid.scrollWidth - grid.clientWidth;
    var idx = 0;
    if (max > 0) {
      if (grid.scrollLeft >= max - 4) idx = cards.length - 1;
      else {
        var best = Infinity;
        cards.forEach(function (c, i) {
          var d = Math.abs(c.getBoundingClientRect().left - grid.getBoundingClientRect().left - (parseFloat(getComputedStyle(grid).paddingLeft) || 0));
          if (d < best) { best = d; idx = i; }
        });
      }
    }
    Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('on', i === idx); });
  }
  var raf = 0;
  grid.addEventListener('scroll', function () {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; update(); });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
