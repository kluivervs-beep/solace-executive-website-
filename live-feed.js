/* Live overview: example requests stream into a list, newest on top, and the
   oldest slide out. Rows come from a hidden pool in index.html so the
   language switch translates them like everything else. */
(function () {
  var list = document.getElementById('lfList');
  var pool = document.getElementById('lfPool');
  if (!list || !pool) return;
  var items = Array.prototype.slice.call(pool.children);
  if (!items.length) return;

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX = 5;
  var next = 0;
  var timer = null;

  function push(instant) {
    var li = items[next % items.length].cloneNode(true);
    next += 1;
    if (!instant && !calm) li.classList.add('lf-enter');
    list.insertBefore(li, list.firstChild);
    while (list.children.length > MAX) {
      var last = list.lastElementChild;
      list.removeChild(last);
    }
  }

  // Start with a full list, then keep adding while the card is on screen.
  for (var i = MAX - 1; i >= 0; i--) { next = i; push(true); }
  next = MAX;

  if (calm || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting && !timer) {
        timer = setInterval(function () { push(false); }, 2600);
      } else if (!en.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
  }, { threshold: 0.3 });
  io.observe(list);
})();
