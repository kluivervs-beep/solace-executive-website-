/* Motion layer, plain JS, inspired by React Bits ideas (ScrollReveal, Magnet,
   Spotlight, parallax). Used on index.html and diensten.html.
   - Scroll-linked word reveal for section titles and the philosophy text.
   - Smooth parallax on service photos, the spiral copy and the diensten photos.
   - Hairlines between sections that draw themselves.
   - A soft light that follows the cursor inside the hero card.
   - Magnetic lean on the diensten buttons.
   All writes are opacity / transform-like properties, scheduling is one
   requestAnimationFrame loop, visibility is tracked with IntersectionObserver.
   Nothing runs under reduced motion, and the page is complete without it. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window) || !('requestAnimationFrame' in window)) return;

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var started = false;

  function init() {
    if (started) return;
    started = true;

    var onIndex = !!document.getElementById('filosofie') || !!document.getElementById('diensten');
    var onDiensten = !!document.querySelector('.svc');

    var wordItems = [];   // scroll-linked word reveal
    var parItems = [];    // parallax
    var rafId = 0;

    function schedule() { if (!rafId) rafId = requestAnimationFrame(frame); }

    /* ------------------------------------------------------------------
       Word reveal
    ------------------------------------------------------------------ */
    var wordSelectors = onDiensten
      ? '.svc h2, .cta h3'
      : 'main .section-title.reveal:not(#intakeModalTitle), .philosophy-quote blockquote, .philosophy-body p:not(.eyebrow)';

    // Wraps every word of every not-yet-split text node, keeping <em> etc.
    function splitNode(el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode.closest && n.parentNode.closest('.mo-w')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (n) {
        var parts = n.nodeValue.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          var s = document.createElement('span');
          s.className = 'mo-w';
          s.textContent = p;
          frag.appendChild(s);
        });
        n.parentNode.replaceChild(frag, n);
      });
      return all('.mo-w', el);
    }

    var mutObs = null;
    var pendingResplit = [];
    function resplit() {
      var list = pendingResplit; pendingResplit = [];
      list.forEach(function (it) {
        it.words = splitNode(it.el);
        it.p = -1;
        it.words.forEach(function (w) { w.__t = -1; });
        it.dirty = true;
      });
      if (mutObs) mutObs.takeRecords();
      schedule();
    }

    var wordIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var it = en.target.__mo;
        if (!it) return;
        it.near = en.isIntersecting;
        if (!en.isIntersecting) {
          // Left the viewport: settle at fully read (above) or untouched (below).
          setWords(it, en.boundingClientRect.top < 0 ? 1 : 0);
        } else { it.dirty = true; schedule(); }
      });
    }, { rootMargin: '0px 0px 0px 0px' });

    all(wordSelectors).forEach(function (el) {
      if (el.closest('.hero')) return;           // the hero intro has its own timeline
      var it = { el: el, words: splitNode(el), p: -1, near: false, dirty: true };
      if (it.words.length < 2) return;
      it.words.forEach(function (w) { w.__t = -1; });
      el.__mo = it;
      wordItems.push(it);
      wordIO.observe(el);
    });

    // i18n.js (and the diensten language switch) rewrite the text of these
    // elements: any new, unsplit text is split again.
    if ('MutationObserver' in window && wordItems.length) {
      mutObs = new MutationObserver(function (recs) {
        var seen = [];
        recs.forEach(function (r) {
          var t = r.target.nodeType === 1 ? r.target : r.target.parentNode;
          wordItems.forEach(function (it) {
            if (it.el.contains(t) && seen.indexOf(it) === -1 && pendingResplit.indexOf(it) === -1) seen.push(it);
          });
        });
        if (!seen.length) return;
        pendingResplit = pendingResplit.concat(seen);
        requestAnimationFrame(resplit);
      });
      wordItems.forEach(function (it) { mutObs.observe(it.el, { childList: true, subtree: true, characterData: true }); });
    }

    function setWords(it, p) {
      if (Math.abs(p - it.p) < 0.002 && !it.dirty) return;
      it.p = p; it.dirty = false;
      var n = it.words.length, spread = 3;
      for (var i = 0; i < n; i++) {
        var t = clamp((p * (n + spread) - i) / spread, 0, 1);
        var w = it.words[i];
        if (Math.abs(t - w.__t) < 0.01 && !(t === 1 && w.__t !== 1) && !(t === 0 && w.__t !== 0)) continue;
        w.__t = t;
        if (t >= 1) { w.style.opacity = ''; w.style.translate = ''; }
        else { w.style.opacity = (0.14 + 0.86 * t).toFixed(3); w.style.translate = '0 ' + ((1 - t) * 0.28).toFixed(3) + 'em'; }
      }
    }

    /* ------------------------------------------------------------------
       Parallax (photo inside its frame, slower copy next to the spiral)
    ------------------------------------------------------------------ */
    var parIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var it = en.target.__moPar;
        if (!it) return;
        it.near = en.isIntersecting;
        if (en.isIntersecting) { it.fresh = true; schedule(); }
      });
    }, { rootMargin: '15% 0px 15% 0px' });

    function addPar(host, target, ampFn) {
      var it = { host: host, target: target, ampFn: ampFn, cur: 0, tar: 0, near: false, fresh: true };
      host.__moPar = it;
      parItems.push(it);
      parIO.observe(host);
    }

    if (onIndex) {
      all('.service-grid .service-visual').forEach(function (v) {
        var img = v.querySelector('.service-visual-photo');
        if (!img) return;
        img.classList.add('mo-par-photo');
        addPar(v, img, function (h) { return h * 0.035; });
      });
      var copy = document.querySelector('.spiral-band .spiral-copy');
      var band = document.querySelector('.spiral-band');
      if (copy && band) addPar(band, copy, function () { return -26; });
    }
    if (onDiensten) {
      all('.svc-photos').forEach(function (grp) {
        var frames = all('.ph', grp);
        frames.forEach(function (f, i) {
          var img = f.querySelector('img');
          if (!img) return;
          f.classList.add('mo-par-frame');
          addPar(f, img, function (h) { return h * 0.05; });
          if (i === 1) addPar(grp, f, function () { return -20; });   // second photo drifts a bit more
        });
      });
    }

    /* ------------------------------------------------------------------
       The one frame loop
    ------------------------------------------------------------------ */
    function frame() {
      rafId = 0;
      var vh = window.innerHeight;
      var doc = document.documentElement;
      var remaining = Math.max(0, doc.scrollHeight - vh - window.scrollY);
      var again = false;
      var i, it, r;

      // reads first
      var wr = [];
      for (i = 0; i < wordItems.length; i++) {
        it = wordItems[i];
        if (!it.near) continue;
        r = it.el.getBoundingClientRect();
        wr.push([it, r.top]);
      }
      var pr = [];
      for (i = 0; i < parItems.length; i++) {
        it = parItems[i];
        if (!it.near) continue;
        r = it.host.getBoundingClientRect();
        pr.push([it, r]);
      }

      // then writes
      wr.forEach(function (a) {
        var top = a[1];
        // Reveal runs while the title travels from 92% to 60% of the viewport.
        // Near the end of the page the end point may be unreachable: clamp it.
        var endTop = Math.max(vh * 0.6, top - remaining);
        var startTop = Math.max(vh * 0.92, endTop + 80);
        setWords(a[0], clamp((startTop - top) / (startTop - endTop), 0, 1));
      });
      pr.forEach(function (a) {
        var it2 = a[0], rect = a[1];
        var c = clamp((rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2), -1, 1);
        it2.tar = c * it2.ampFn(rect.height);
        if (it2.fresh) { it2.cur = it2.tar; it2.fresh = false; }
        else it2.cur += (it2.tar - it2.cur) * 0.14;
        if (Math.abs(it2.tar - it2.cur) > 0.05) again = true; else it2.cur = it2.tar;
        it2.target.style.translate = '0 ' + it2.cur.toFixed(2) + 'px';
      });

      if (again) schedule();
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', function () {
      wordItems.forEach(function (it) { it.dirty = true; });
      schedule();
    });
    window.addEventListener('load', function () {
      // Images and fonts change heights: settle once more.
      wordItems.forEach(function (it) { it.dirty = true; });
      schedule();
    });
    schedule();

    /* ------------------------------------------------------------------
       Self-drawing hairlines
    ------------------------------------------------------------------ */
    var ruleHosts = onDiensten
      ? all('.svc, .how, .cta')
      : all('main > section').filter(function (s) { return !s.classList.contains('hero') && s.id !== 'top'; });
    var ruleIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-drawn'); ruleIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    ruleHosts.forEach(function (host) {
      if (getComputedStyle(host).display === 'none') return;
      if (getComputedStyle(host).position === 'static') host.classList.add('mo-rel');
      var rule = document.createElement('span');
      rule.className = 'mo-rule';
      rule.setAttribute('aria-hidden', 'true');
      host.insertBefore(rule, host.firstChild);
      ruleIO.observe(rule);
    });

    /* ------------------------------------------------------------------
       Hero card: cursor-follow glow (fine pointers only)
    ------------------------------------------------------------------ */
    var card = document.querySelector('.hero .hero-content');
    if (card && fine) {
      var glow = document.createElement('span');
      glow.className = 'mo-glow';
      glow.setAttribute('aria-hidden', 'true');
      card.insertBefore(glow, card.firstChild);
      var gx = 0, gy = 0, graf = 0;
      card.addEventListener('pointermove', function (e) {
        gx = e.clientX; gy = e.clientY;
        card.classList.add('mo-hot');
        if (graf) return;
        graf = requestAnimationFrame(function () {
          graf = 0;
          var b = card.getBoundingClientRect();
          card.style.setProperty('--mx', (gx - b.left).toFixed(0) + 'px');
          card.style.setProperty('--my', (gy - b.top).toFixed(0) + 'px');
        });
      }, { passive: true });
      card.addEventListener('pointerleave', function () { card.classList.remove('mo-hot'); });
    }

    /* ------------------------------------------------------------------
       Magnetic lean on the diensten buttons (index buttons already have one)
    ------------------------------------------------------------------ */
    if (onDiensten && fine) {
      var mags = all('.svc-link, .btn-solid');
      mags.forEach(function (b) {
        b.style.transition = 'translate 0.45s cubic-bezier(0.22, 1, 0.36, 1), ' + (getComputedStyle(b).transition || 'none');
      });
      var mx = 0, my = 0, mraf = 0;
      window.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY;
        if (mraf) return;
        mraf = requestAnimationFrame(function () {
          mraf = 0;
          var reads = mags.map(function (b) { return b.getBoundingClientRect(); });
          mags.forEach(function (b, i) {
            var r = reads[i];
            var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            var near = Math.abs(cx - mx) < r.width / 2 + 60 && Math.abs(cy - my) < r.height / 2 + 60;
            b.style.translate = near ? ((mx - cx) / 5).toFixed(1) + 'px ' + ((my - cy) / 5).toFixed(1) + 'px' : '0px 0px';
          });
        });
      }, { passive: true });
    }
  }

  // Start after i18n.js has applied its second pass on DOMContentLoaded.
  if (document.readyState === 'complete') init();
  else {
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('load', init);
  }
})();
