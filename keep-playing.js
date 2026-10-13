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

/* Safety net: if a cloud video ever fails to move (autoplay blocked, low-power mode, slow start),
   a slowly drifting still of the same clouds shows instead, so the background is never frozen.
   As soon as the video really plays, it takes over again. */
(function () {
  var vids = [].slice.call(document.querySelectorAll('#whVideo, .jf-bg'));
  vids.forEach(function (v) {
    var poster = v.getAttribute('poster');
    if (!poster || !v.parentNode) return;
    var fb = document.createElement('div');
    fb.className = 'vid-fallback';
    fb.setAttribute('aria-hidden', 'true');
    fb.style.backgroundImage = 'url("' + poster + '")';
    v.parentNode.insertBefore(fb, v);
    var last = -1, still = 0;
    function check() {
      var t = v.currentTime;
      var moving = !v.paused && t > 0.05 && Math.abs(t - last) > 0.02;
      last = t;
      if (moving) { still = 0; v.classList.remove('vid-stuck'); }
      else if (++still >= 2) { v.classList.add('vid-stuck'); try { v.play(); } catch (e) {} }
    }
    setInterval(check, 700);
    v.addEventListener('playing', function () { v.classList.remove('vid-stuck'); });
  });
})();
