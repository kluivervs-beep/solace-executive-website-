/* Background videos (clouds) must never sit frozen on one frame. Browsers pause muted autoplay
   videos when they are off screen, in a background tab, or in low-power mode. This starts them
   again when they come into view, when the tab returns, and on the first touch. */
(function () {
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) return;
  var vids = [].slice.call(document.querySelectorAll('#whVideo, .jf-bg'));
  if (!vids.length) return;
  vids.forEach(function (v) { v.muted = true; v.setAttribute('playsinline', ''); v.loop = true; });
  function go(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function wake() { vids.forEach(function (v) { if (v.paused && v.getBoundingClientRect().bottom > 0 && v.getBoundingClientRect().top < innerHeight) go(v); }); }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.target.paused) go(e.target); }); }, { threshold: 0.01 });
    vids.forEach(function (v) { io.observe(v); });
  }
  vids.forEach(function (v) {
    v.addEventListener('pause', function () { if (!document.hidden) setTimeout(wake, 150); });
    v.addEventListener('stalled', wake); v.addEventListener('suspend', wake);
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
  ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (t) { window.addEventListener(t, wake, { passive: true }); });
  window.addEventListener('scroll', wake, { passive: true });
  setInterval(wake, 2500);
  wake();
})();
