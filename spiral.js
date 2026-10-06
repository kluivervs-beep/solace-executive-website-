/* Infinite spiral gallery: photos wind around an invisible column and travel
   upward. Port of the React Bits InfiniteSpiral idea to plain JS. Drag,
   scroll and hover-to-pause all work; with reduced motion it stands still. */
(function () {
  var root = document.getElementById('spiral');
  if (!root) return;
  var cards = Array.prototype.slice.call(root.querySelectorAll('.sp-item'));
  if (!cards.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };
  var mod = function (v, d) { return ((v % d) + d) % d; };
  var smooth = function (a, b, v) { var x = clamp((v - a) / ((b - a) || 1), 0, 1); return x * x * (3 - 2 * x); };

  var cfg = { speed: 0.35, radius: 300, cardW: 260, cardH: 330, spacing: 205, perspective: 1100, perTurn: 6, centerScale: 1.18, edgeFade: 0.3, edgeBlur: 5 };
  var progress = 0, target = 0, autoSpeed = 0;
  var hovered = false, visible = false, dragging = false, moved = false, lastY = 0, lastScroll = window.scrollY;
  var bounds = root.getBoundingClientRect();

  root.style.perspective = cfg.perspective + 'px';
  root.classList.add('is-live');

  if ('ResizeObserver' in window) new ResizeObserver(function () { bounds = root.getBoundingClientRect(); }).observe(root);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.02 }).observe(root);
  } else { visible = true; }

  window.addEventListener('scroll', function () {
    var y = window.scrollY, d = y - lastScroll;
    lastScroll = y;
    if (!visible || !d) return;
    target += clamp(d / (cfg.spacing * 2), -1.5, 1.5);
  }, { passive: true });

  root.addEventListener('mouseenter', function () { hovered = true; });
  root.addEventListener('mouseleave', function () { hovered = false; });
  root.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    dragging = true; moved = false; lastY = e.clientY; target = progress;
    root.setPointerCapture(e.pointerId);
    root.classList.add('is-drag');
  });
  root.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var d = e.clientY - lastY; lastY = e.clientY;
    if (Math.abs(d) > 0.5) moved = true;
    target -= d / cfg.spacing;
  });
  function stop(e) {
    if (!dragging) return;
    dragging = false;
    if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    root.classList.remove('is-drag');
  }
  root.addEventListener('pointerup', stop);
  root.addEventListener('pointercancel', stop);
  root.addEventListener('click', function (e) {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);

  var prev = performance.now();
  function frame(t) {
    var dt = Math.min((t - prev) / 1000, 0.05);
    prev = t;

    var wantAuto = visible && !reduced.matches && !dragging && !hovered ? cfg.speed : 0;
    autoSpeed += (wantAuto - autoSpeed) * (1 - Math.exp(-dt * 7));
    target += autoSpeed * dt;
    progress += (target - progress) * (1 - Math.exp(-dt * (dragging ? 22 : 11)));

    if (visible) {
      var n = cards.length, half = n / 2;
      var w = Math.max(bounds.width, 1), h = Math.max(bounds.height, 1);
      var fit = Math.min(1, w / (cfg.cardW * 2.6), h / (cfg.cardH * 2.3));
      var rad = Math.min(cfg.radius, Math.max(72, w * 0.36)) * fit;
      var fadeStart = clamp(1 - cfg.edgeFade, 0, 0.98);
      var turn = Math.max(cfg.perTurn, 1);

      for (var i = 0; i < n; i++) {
        var off = mod(i - progress + half, n) - half;
        var edge = Math.min(Math.abs(off) / Math.max(half, 1), 1);
        var opacity = 1 - smooth(fadeStart, 1, edge);
        var focus = 1 - Math.min(Math.abs(off) / Math.max(turn * 0.65, 1), 1);
        var scale = (1 + (cfg.centerScale - 1) * focus) * fit;
        var ang = off * (360 / turn) * Math.PI / 180;
        var x = Math.sin(ang) * rad;
        var z = Math.cos(ang) * rad;
        var depthScale = clamp(cfg.perspective / Math.max(cfg.perspective - z, 1), 0.72, 1.45);
        var depth = (z / Math.max(rad, 1) + 1) / 2;
        var blur = cfg.edgeBlur * smooth(0.35, 1, edge);
        var c = cards[i];
        c.style.transform = 'translate(-50%, -50%) translate3d(' + x + 'px,' + (off * cfg.spacing * fit) + 'px,0) scale(' + (scale * depthScale) + ')';
        c.style.opacity = opacity.toFixed(3);
        c.style.filter = blur > 0.01 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
        c.style.zIndex = String(Math.round(depth * 100000) + i);
        c.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none';
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
