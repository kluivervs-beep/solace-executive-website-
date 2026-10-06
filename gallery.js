/* Services accordion: keeps one panel open. Hover, focus or a click opens a
   panel; left alone, the panels take turns every few seconds. */
(function () {
  var grid = document.querySelector('.service-grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.service-card:not(.service-card--cta)'));
  if (!cards.length) return;

  var wide = window.matchMedia('(min-width: 1000px)');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0;
  var hovering = false;
  var visible = false;

  function open(i) {
    current = i;
    cards.forEach(function (c, j) { c.classList.toggle('is-active', j === i); });
  }
  open(0);

  cards.forEach(function (c, i) {
    c.addEventListener('mouseenter', function () { hovering = true; open(i); });
    c.addEventListener('focusin', function () { open(i); });
    c.addEventListener('click', function () { open(i); });
  });
  grid.addEventListener('mouseleave', function () { hovering = false; });

  if (calm || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
  }, { threshold: 0.4 }).observe(grid);

  setInterval(function () {
    if (!wide.matches || hovering || !visible) return;
    open((current + 1) % cards.length);
  }, 5200);
})();
