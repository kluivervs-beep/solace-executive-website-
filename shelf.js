/* Arrow buttons for the services shelf: scroll one card at a time, and grey out at either end. */
(function () {
  var row = document.querySelector('.services .service-grid');
  var prev = document.getElementById('shelfPrev'), next = document.getElementById('shelfNext');
  if (!row || !prev || !next) return;
  function step() { var c = row.querySelector('.service-card'); return c ? c.getBoundingClientRect().width + 20 : 400; }
  function update() {
    prev.disabled = row.scrollLeft < 8;
    next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 8;
  }
  prev.addEventListener('click', function () { row.scrollBy({ left: -step(), behavior: 'smooth' }); });
  next.addEventListener('click', function () { row.scrollBy({ left: step(), behavior: 'smooth' }); });
  row.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  /* Parallax: each photo drifts a little against the scroll, so the cards feel like they have depth. */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cards = [].slice.call(row.querySelectorAll('.service-card'));
  var photos = cards.map(function (c) { return c.querySelector('.service-visual-photo'); });
  var ticking = false;
  function paint() {
    ticking = false;
    var r = row.getBoundingClientRect(), mid = r.left + r.width / 2;
    cards.forEach(function (c, i) {
      var b = c.getBoundingClientRect();
      if (b.right < r.left - 80 || b.left > r.right + 80) return;          // off screen
      var off = ((b.left + b.width / 2) - mid) / r.width;                  // -1 .. 1
      var v = Math.max(-1, Math.min(1, off)) * -34 + 'px';
      c.style.setProperty('--par', v);
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
  row.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  paint();
})();
