// Hero globe: a slowly turning world with gold city lights, small planes on
// their routes, a blue dot for where you are and blue dots for other people on
// the site right now. Drawn with MapLibre GL (globe projection) on free
// OpenFreeMap tiles. Falls back to the flat CSS ring if WebGL or the CDN is
// unavailable. Replaces the earlier Three.js scene (hero-scene.js).
//
// Privacy: "where you are" comes from the browser's time zone (a reference
// city for that zone), never from an IP lookup or GPS, and that same coarse
// point is all that is shared with other visitors.

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var holder = document.getElementById('heroMap');
  var hero = document.querySelector('.hero');
  if (!holder || !hero) return;

  var HUBS = { 'Amsterdam': 9, 'London': 7.5, 'Paris': 7.5, 'Dubai': 8, 'New York': 7.5, 'Singapore': 7, 'Tokyo': 7, 'Los Angeles': 7, 'Sydney': 6.5, 'Hong Kong': 6.5, 'Geneva': 6.5, 'Monaco': 6.5 };

  var CITIES = [
    ['Amsterdam', 52.37, 4.9], ['London', 51.5, -0.12], ['Paris', 48.85, 2.35], ['Berlin', 52.52, 13.4],
    ['Vienna', 48.21, 16.37], ['Geneva', 46.2, 6.14], ['Zurich', 47.38, 8.54], ['Milan', 45.46, 9.19],
    ['Monaco', 43.74, 7.42], ['Rome', 41.9, 12.5], ['Madrid', 40.42, -3.7], ['Barcelona', 41.39, 2.17],
    ['Dubai', 25.2, 55.27], ['Riyadh', 24.71, 46.68], ['Doha', 25.29, 51.53], ['New York', 40.71, -74.0],
    ['Miami', 25.76, -80.19], ['Los Angeles', 34.05, -118.24], ['Sao Paulo', -23.55, -46.63],
    ['Singapore', 1.35, 103.82], ['Hong Kong', 22.32, 114.17], ['Tokyo', 35.68, 139.65],
    ['Shanghai', 31.23, 121.47], ['Sydney', -33.87, 151.21],
  ];
  var BY_NAME = {};
  CITIES.forEach(function (c) { BY_NAME[c[0]] = c; });

  // Planes fly these legs, back and forth.
  var LEGS = [
    ['Amsterdam', 'Dubai'], ['Amsterdam', 'New York'], ['London', 'Singapore'], ['Dubai', 'Hong Kong'],
    ['Paris', 'Miami'], ['New York', 'Los Angeles'], ['Zurich', 'Tokyo'], ['Dubai', 'Sydney'],
  ];

  // Coarse "where am I": a reference city per time zone.
  var ZONES = {
    'Europe/Amsterdam': [52.37, 4.9], 'Europe/London': [51.5, -0.12], 'Europe/Paris': [48.85, 2.35], 'Europe/Berlin': [52.52, 13.4],
    'Europe/Madrid': [40.42, -3.7], 'Europe/Rome': [41.9, 12.5], 'Europe/Brussels': [50.85, 4.35], 'Europe/Zurich': [47.38, 8.54],
    'Europe/Vienna': [48.21, 16.37], 'Europe/Stockholm': [59.33, 18.07], 'Europe/Oslo': [59.91, 10.75], 'Europe/Copenhagen': [55.68, 12.57],
    'Europe/Helsinki': [60.17, 24.94], 'Europe/Lisbon': [38.72, -9.14], 'Europe/Dublin': [53.35, -6.26], 'Europe/Athens': [37.98, 23.73],
    'Europe/Istanbul': [41.01, 28.98], 'Europe/Warsaw': [52.23, 21.01], 'Europe/Prague': [50.08, 14.44], 'Europe/Budapest': [47.5, 19.04],
    'Europe/Moscow': [55.75, 37.62], 'Asia/Dubai': [25.2, 55.27], 'Asia/Riyadh': [24.71, 46.68], 'Asia/Qatar': [25.29, 51.53],
    'Asia/Kuwait': [29.38, 47.99], 'Asia/Tehran': [35.69, 51.39], 'Asia/Karachi': [24.86, 67.0], 'Asia/Kolkata': [19.08, 72.88],
    'Asia/Calcutta': [19.08, 72.88], 'Asia/Dhaka': [23.81, 90.41], 'Asia/Bangkok': [13.76, 100.5], 'Asia/Singapore': [1.35, 103.82],
    'Asia/Kuala_Lumpur': [3.14, 101.69], 'Asia/Jakarta': [-6.2, 106.85], 'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Shanghai': [31.23, 121.47],
    'Asia/Tokyo': [35.68, 139.65], 'Asia/Seoul': [37.57, 126.98], 'Asia/Manila': [14.6, 120.98], 'Asia/Taipei': [25.03, 121.57],
    'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96], 'Australia/Perth': [-31.95, 115.86],
    'Pacific/Auckland': [-36.85, 174.76], 'America/New_York': [40.71, -74.0], 'America/Chicago': [41.88, -87.63],
    'America/Denver': [39.74, -104.99], 'America/Los_Angeles': [34.05, -118.24], 'America/Toronto': [43.65, -79.38],
    'America/Vancouver': [49.28, -123.12], 'America/Mexico_City': [19.43, -99.13], 'America/Sao_Paulo': [-23.55, -46.63],
    'America/Argentina/Buenos_Aires': [-34.6, -58.38], 'America/Bogota': [4.71, -74.07], 'America/Lima': [-12.05, -77.04],
    'America/Santiago': [-33.45, -70.67], 'Africa/Cairo': [30.04, 31.24], 'Africa/Johannesburg': [-26.2, 28.05],
    'Africa/Lagos': [6.52, 3.38], 'Africa/Nairobi': [-1.29, 36.82], 'Africa/Casablanca': [33.57, -7.59], 'Asia/Jerusalem': [31.77, 35.22],
    'Asia/Beirut': [33.89, 35.5], 'Atlantic/Reykjavik': [64.15, -21.94],
  };

  function myPoint() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return ZONES[tz] || null;
    } catch (e) { return null; }
  }

  var ME = myPoint();
  var rebuilds = 0, curMap = null, liveStarted = false;
  // The globe turns around its own axis at a fixed latitude (clamped so the
  // reference city never sits on the pole side), only the longitude moves.
  var CLAT = ME ? Math.max(-10, Math.min(45, ME[0])) : 28;
  var curLng = ME ? ME[1] : 12;
  function lonNow() { return curLng; }

  var GOLD = '#E8682F';
  var BLUE = '#2F7BFF';

  function load(src, kind) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement(kind === 'css' ? 'link' : 'script');
      // Same CORS mode as the <link rel="preload"> in index.html, so the preloaded copy is reused.
      el.crossOrigin = 'anonymous';
      if (kind === 'css') { el.rel = 'stylesheet'; el.href = src; } else { el.src = src; el.async = true; }
      el.onload = resolve;
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  function webglOk() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      // Give the probe context back right away: Safari allows only a handful.
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }

  // Back to the flat CSS ring (also used when the GPU context is lost).
  function ringMode() {
    document.documentElement.classList.remove('globe-pending');
    document.documentElement.classList.remove('has-globe');
    hero.classList.remove('has-globe');
    holder.classList.remove('is-active');
    hero.removeAttribute('aria-label');
  }

  function start() {
    if (!webglOk()) { ringMode(); return; }
    var base = 'https://unpkg.com/maplibre-gl@5.7.0/dist/';
    // maplibre-gl.js is a hard requirement, the stylesheet is not (a blocked
    // CSS file must not keep the globe from showing).
    var css = load(base + 'maplibre-gl.css', 'css').catch(function () { /* canvas still draws */ });
    Promise.all([css, load(base + 'maplibre-gl.js', 'js')])
      .then(build)
      .catch(function (e) {
        ringMode();
        console.warn('Solace: globe unavailable, using the flat ring.', e);
      });
  }

  // --- great-circle helpers -------------------------------------------------
  var RAD = Math.PI / 180;
  function toVec(lat, lon) {
    var la = lat * RAD, lo = lon * RAD;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  }
  function toLonLat(v) {
    return [Math.atan2(v[1], v[0]) / RAD, Math.atan2(v[2], Math.sqrt(v[0] * v[0] + v[1] * v[1])) / RAD];
  }
  function slerp(a, b, t) {
    var dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    var om = Math.acos(dot);
    if (om < 1e-6) return a;
    var s = Math.sin(om);
    var k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }
  function bearing(p, q) {
    var y = Math.sin((q[0] - p[0]) * RAD) * Math.cos(q[1] * RAD);
    var x = Math.cos(p[1] * RAD) * Math.sin(q[1] * RAD) - Math.sin(p[1] * RAD) * Math.cos(q[1] * RAD) * Math.cos((q[0] - p[0]) * RAD);
    return Math.atan2(y, x) / RAD;
  }

  function planeImage() {
    var s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    var x = c.getContext('2d');
    x.translate(s / 2, s / 2);
    x.beginPath();
    // A small airliner seen from above, nose up.
    x.moveTo(0, -26); x.lineTo(4, -8); x.lineTo(26, 6); x.lineTo(26, 11); x.lineTo(4, 5);
    x.lineTo(3, 18); x.lineTo(11, 24); x.lineTo(11, 27); x.lineTo(0, 24);
    x.lineTo(-11, 27); x.lineTo(-11, 24); x.lineTo(-3, 18); x.lineTo(-4, 5);
    x.lineTo(-26, 11); x.lineTo(-26, 6); x.lineTo(-4, -8); x.closePath();
    x.fillStyle = '#ffffff';
    x.strokeStyle = 'rgba(20,32,44,0.55)';
    x.lineWidth = 3;
    x.stroke();
    x.fill();
    return x.getImageData(0, 0, s, s);
  }

  function build() {
    var maplibregl = window.maplibregl;
    if (!maplibregl) return;

    var style = 'https://tiles.openfreemap.org/styles/bright';

    // On phones the globe is as wide as the screen allows (never cut off at the sides).
    function phone(w) { return w <= 640; }
    function diameter(w) { return phone(w) ? w * 0.86 : Math.min(w * 0.7, 800); }
    function zoomFor(w) {
      // A globe is about 129.5 * 2^zoom pixels across in this setup (163 on a phone, measured).
      return Math.log(diameter(w) / (phone(w) ? 163 : 129.5)) / Math.LN2;
    }

    var startLon = ME ? ME[1] : 12;
    var map;
    try {
      map = new maplibregl.Map({
        container: holder,
        style: style,
        center: [startLon, ME ? Math.max(-10, Math.min(45, ME[0])) : 28],
        zoom: zoomFor(holder.clientWidth),
        minZoom: 0.5,
        maxZoom: 4,
        interactive: false,
        attributionControl: false,
        renderWorldCopies: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, window.innerWidth <= 768 ? 1.5 : 1.75),
        fadeDuration: 0,
      });
    } catch (e) { return; }

    function pointsOf(list, extra) {
      return {
        type: 'FeatureCollection',
        features: list.map(function (c) {
          var props = { n: c[0], r: HUBS[c[0]] || 5 };
          if (extra) for (var k in extra) props[k] = extra[k];
          return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [c[2], c[1]] } };
        }),
      };
    }

    map.on('load', function () {
      try { map.setProjection({ type: 'globe' }); } catch (e) { /* flat map fallback is acceptable */ }
      try {
        map.setSky({
          'sky-color': '#bcdcf6', 'horizon-color': '#d6e8f7', 'fog-color': '#eaf2f9',
          'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1],
        });
      } catch (e) { /* the CSS glow still frames the globe */ }

      // Too many labels made the globe busy: hide the style's own and show
      // only the names of our main cities.
      (map.getStyle().layers || []).forEach(function (l) {
        if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none');
      });

      // Routes and planes.
      var routeFeatures = LEGS.map(function (leg) {
        var a = toVec(BY_NAME[leg[0]][1], BY_NAME[leg[0]][2]);
        var b = toVec(BY_NAME[leg[1]][1], BY_NAME[leg[1]][2]);
        var pts = [];
        for (var i = 0; i <= 48; i++) pts.push(toLonLat(slerp(a, b, i / 48)));
        return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } };
      });
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: routeFeatures } });
      map.addLayer({ id: 'routes', type: 'line', source: 'routes',
        paint: { 'line-color': '#C9A24A', 'line-width': 1.1, 'line-opacity': 0.55, 'line-dasharray': [2, 3] } });

      map.addImage('plane', planeImage(), { pixelRatio: 2 });
      map.addSource('planes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'planes', type: 'symbol', source: 'planes',
        layout: { 'icon-image': 'plane', 'icon-size': 0.7, 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true } });

      // Our cities.
      map.addSource('cities', { type: 'geojson', data: pointsOf(CITIES) });
      map.addLayer({ id: 'cities-halo', type: 'circle', source: 'cities',
        paint: { 'circle-radius': ['*', ['get', 'r'], 2.6], 'circle-color': GOLD, 'circle-opacity': 0.24, 'circle-blur': 0.8, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'cities-ring', type: 'circle', source: 'cities',
        paint: { 'circle-radius': ['*', ['get', 'r'], 1.4], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': GOLD, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.6, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'cities-core', type: 'circle', source: 'cities',
        paint: { 'circle-radius': ['get', 'r'], 'circle-color': GOLD, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.6, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'cities-names', type: 'symbol', source: 'cities',
        filter: ['>=', ['get', 'r'], 6.5],
        // Names that would run into each other (London, Paris, Amsterdam are
        // close together) are thinned out: the biggest hub wins.
        layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.35], 'text-anchor': 'top',
          'symbol-sort-key': ['-', 0, ['get', 'r']], 'text-allow-overlap': false, 'text-ignore-placement': false, 'text-padding': 3 },
        paint: { 'text-color': '#1b2832', 'text-halo-color': 'rgba(255,255,255,0.97)', 'text-halo-width': 2 } });

      // Other people on the site right now, and you.
      map.addSource('others', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'others-halo', type: 'circle', source: 'others',
        paint: { 'circle-radius': 15, 'circle-color': BLUE, 'circle-opacity': 0.2, 'circle-blur': 0.8, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'others-core', type: 'circle', source: 'others',
        paint: { 'circle-radius': 5, 'circle-color': BLUE, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'map' } });
      map.addSource('me', { type: 'geojson', data: ME ? pointsOf([['you', ME[0], ME[1]]]) : { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'me-ring', type: 'circle', source: 'me',
        paint: { 'circle-radius': 14, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': BLUE, 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.6, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'me-core', type: 'circle', source: 'me',
        paint: { 'circle-radius': 7, 'circle-color': BLUE, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.2, 'circle-pitch-alignment': 'map' } });

      // The zoom constants above are only a first guess: the real size of the
      // globe on screen depends on the camera, so measure its silhouette with
      // map.project() and correct the zoom until it is the radius we want.
      // The same number drives the CSS glow (--R), so they always line up.
      function limbRadius() {
        var c = map.getCenter();
        var cv = toVec(c.lat, c.lng);
        var east = [-Math.sin(c.lng * RAD), Math.cos(c.lng * RAD), 0];
        var cp = map.project([c.lng, c.lat]);
        var best = 0;
        for (var th = 30; th <= 95; th += 1) {
          var s = Math.sin(th * RAD), k = Math.cos(th * RAD);
          var a = map.project(toLonLat([k * cv[0] + s * east[0], k * cv[1] + s * east[1], k * cv[2] + s * east[2]]));
          var d = Math.sqrt((a.x - cp.x) * (a.x - cp.x) + (a.y - cp.y) * (a.y - cp.y));
          if (d > best) best = d;
        }
        return best;
      }
      // The CSS owns the globe size (--gd on .hero, which also places the card
      // and the glow box). A zero-height probe 'var(--gd)' wide gives it in px.
      var probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:0;top:0;height:0;width:var(--gd);visibility:hidden;pointer-events:none';
      hero.appendChild(probe);
      function wantedRadius() {
        var gd = probe.offsetWidth || diameter(holder.clientWidth);
        return Math.max(60, Math.min(gd / 2, holder.clientWidth / 2 - 4));
      }
      function fit() {
        if (!holder.clientWidth || !holder.clientHeight) return;
        var want = wantedRadius();
        try {
          map.jumpTo({ center: [lonNow(), CLAT] });
          for (var i = 0; i < 5; i++) {
            var got = limbRadius();
            if (!got || Math.abs(got - want) < 0.75) break;
            map.setZoom(Math.max(0.2, Math.min(5, map.getZoom() + Math.log(want / got) / Math.LN2)));
          }
        } catch (e) { /* keep the first-guess zoom */ }
        holder.style.setProperty('--R', want + 'px');
      }
      var fitQueued = 0;
      function refit() {
        if (fitQueued) return;
        fitQueued = requestAnimationFrame(function () {
          fitQueued = 0;
          try {
            if (window.devicePixelRatio) map.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 1.75));
          } catch (e) { /* older build without setPixelRatio */ }
          map.resize();
          fit();
        });
      }
      fit();
      // Everything that listens outside the map is undone when the map is
      // removed (needed when it is rebuilt after a lost GPU context).
      var ro = null;
      if ('ResizeObserver' in window) { ro = new ResizeObserver(refit); ro.observe(holder); }
      function onTurn() { setTimeout(refit, 250); setTimeout(refit, 700); }
      window.addEventListener('resize', refit);
      // iOS reports the new size a moment after an orientation change.
      window.addEventListener('orientationchange', onTurn);
      var mo = null;
      map.on('remove', function () {
        if (ro) ro.disconnect();
        if (mo) mo.disconnect();
        window.removeEventListener('resize', refit);
        window.removeEventListener('orientationchange', onTurn);
        if (probe.parentNode) probe.parentNode.removeChild(probe);
        cancelAnimationFrame(fitQueued);
      });

      // The canvas is decorative: never a tab stop, never a keyboard trap.
      var cv = map.getCanvas();
      cv.setAttribute('tabindex', '-1');
      cv.setAttribute('aria-hidden', 'true');
      cv.removeAttribute('role');
      cv.removeAttribute('aria-label');

      // If the GPU takes the WebGL context away (common on iOS Safari under
      // memory pressure), show the flat ring until it is given back.
      cv.addEventListener('webglcontextlost', function (ev) {
        ev.preventDefault();
        ringMode();
        console.warn('Solace: WebGL context lost, showing the flat ring.');
      });
      // After a restore the old map has lost its tiles and textures, so build
      // a fresh one (at most twice, so a flaky GPU cannot cause a loop).
      cv.addEventListener('webglcontextrestored', function () {
        if (rebuilds >= 2) return;
        rebuilds += 1;
        try { map.remove(); } catch (e) { /* already gone */ }
        build();
      });

      // Short text alternative for screen readers (the map itself is hidden from them).
      function describe() {
        var nl = document.documentElement.lang === 'nl';
        hero.setAttribute('aria-label', nl
          ? 'Solace Executive. Wereldbol met onze conciergesteden, vliegroutes en bezoekers die nu online zijn.'
          : 'Solace Executive. A globe showing our concierge cities, flight routes and visitors online right now.');
      }
      describe();
      if ('MutationObserver' in window) { mo = new MutationObserver(describe); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); }

      holder.classList.add('is-active');
      hero.classList.add('has-globe');
      document.documentElement.classList.add('has-globe');
      setTimeout(function () { document.documentElement.classList.remove('globe-pending'); }, 1100);
      curMap = map;
      run(map);
      live();
    });

    // A style that cannot be fetched (offline, blocked, tile host down) means
    // 'load' never fires: give up quickly and keep the flat ring.
    var gaveUp = false;
    function giveUp(why) {
      if (gaveUp || loadedOnce) return;
      gaveUp = true;
      ringMode();
      try { map.remove(); } catch (e) { /* already gone */ }
      console.warn('Solace: globe unavailable, using the flat ring.', why);
    }
    var styleTimer = 0, loadedOnce = false;
    map.on('load', function () { loadedOnce = true; clearTimeout(styleTimer); });
    map.on('error', function (e) {
      var msg = e && e.error && e.error.message;
      if (loadedOnce || gaveUp) return;
      // Only a failing style (no sourceId) is fatal; a single tile error is not.
      if (!e.sourceId && !styleTimer) styleTimer = setTimeout(function () { giveUp(msg); }, 1500);
    });
  }

  // --- who is here right now -------------------------------------------------
  function live() {
    if (liveStarted) return;               // one count, one channel, ever
    liveStarted = true;
    var pill = document.getElementById('heroLive');
    function say(n) {
      if (!pill || n < 1) return;
      var nl = document.documentElement.lang === 'nl';
      pill.querySelector('b').textContent = n;
      pill.querySelector('span').textContent = nl ? (n === 1 ? 'bezoeker nu online' : 'bezoekers nu online') : (n === 1 ? 'visitor online now' : 'visitors online now');
      pill.classList.add('is-on');
    }
    say(1);

    // The count is a nicety, so it never fights the first paint for bandwidth,
    // and the screen reader should not be interrupted every time someone joins.
    if (pill) pill.removeAttribute('aria-live');

    var ch = null, sb = null, joining = false;
    function join() {
      if (ch || joining) return;           // never two subscriptions
      joining = true;
      import('./supabase-client.js').then(function (m) {
        joining = false;
        sb = m.supabase;
        if (ch || pageGone) return;
        var key = Math.random().toString(36).slice(2);
        var mine = sb.channel('site-presence', { config: { presence: { key: key } } });
        ch = mine;
        mine.on('presence', { event: 'sync' }, function () {
          var state = mine.presenceState();
          var feats = [];
          var total = 0;
          Object.keys(state).forEach(function (k) {
            total += 1;
            if (k === key) return;
            var p = state[k][0];
            if (p && typeof p.lat === 'number' && typeof p.lon === 'number') {
              feats.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
            }
          });
          var src = curMap && curMap.getSource && curMap.getSource('others');
          if (src) src.setData({ type: 'FeatureCollection', features: feats });
          say(Math.max(total, 1));
        }).subscribe(function (status) {
          if (status === 'SUBSCRIBED') mine.track(ME ? { lat: ME[0], lon: ME[1] } : {});
        });
      }).catch(function () { joining = false; /* offline: the count simply stays at you */ });
    }
    var pageGone = false;
    function leave() {
      pageGone = true;
      var old = ch; ch = null;
      if (!old) return;
      try { old.untrack(); } catch (e) { /* closing anyway */ }
      try { sb && sb.removeChannel ? sb.removeChannel(old) : old.unsubscribe(); } catch (e) { /* closing anyway */ }
    }
    window.addEventListener('pagehide', leave);
    // Back/forward cache: the page returns alive but the socket was closed.
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) { pageGone = false; join(); } });

    if ('requestIdleCallback' in window) requestIdleCallback(join, { timeout: 4000 });
    else setTimeout(join, 1500);
  }

  function run(map) {
    var visible = true;
    var last = performance.now();
    var t0 = last;
    var frameNo = 0;

    // Each plane has a leg, a start offset and a direction.
    var planes = LEGS.map(function (leg, i) {
      return {
        a: toVec(BY_NAME[leg[0]][1], BY_NAME[leg[0]][2]),
        b: toVec(BY_NAME[leg[1]][1], BY_NAME[leg[1]][2]),
        t: (i * 0.37) % 1,
        speed: 0.012 + (i % 3) * 0.003,
        dir: i % 2 ? -1 : 1,
      };
    });

    function planeFeatures() {
      return planes.map(function (p) {
        // Look a little ahead along the leg for the heading (kept off the very ends, where both points would coincide).
        var t0p = Math.min(p.t, 0.99), t1p = t0p + 0.01;
        var q0 = toLonLat(slerp(p.a, p.b, t0p));
        var q1 = toLonLat(slerp(p.a, p.b, t1p));
        var b = bearing(q0, q1);
        if (p.dir < 0) b += 180;
        return { type: 'Feature', properties: { b: b }, geometry: { type: 'Point', coordinates: toLonLat(slerp(p.a, p.b, p.t)) } };
      });
    }
    map.getSource('planes').setData({ type: 'FeatureCollection', features: planeFeatures() });

    // Names of cities too close to the edge of the globe are dropped: MapLibre
    // would still print them there, floating without their dot.
    var hubVec = {}, shownKey = '';
    Object.keys(HUBS).forEach(function (n) { if (HUBS[n] >= 6.5 && BY_NAME[n]) hubVec[n] = toVec(BY_NAME[n][1], BY_NAME[n][2]); });
    function nameFilter() {
      var cv = toVec(CLAT, curLng), on = [];
      Object.keys(hubVec).forEach(function (n) {
        var v = hubVec[n];
        if (v[0] * cv[0] + v[1] * cv[1] + v[2] * cv[2] > 0.5) on.push(n);
      });
      var key = on.join('|');
      if (key === shownKey) return;
      shownKey = key;
      try { map.setFilter('cities-names', ['in', ['get', 'n'], ['literal', on]]); } catch (e) { /* labels simply stay as they are */ }
    }
    nameFilter();

    // The loop only runs while the hero is on screen and the tab is visible;
    // otherwise no animation frame is requested at all.
    var running = false;
    function wake() {
      if (dead || reduced || running || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
    var io = null, dead = false;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; wake(); }, { threshold: 0 });
      io.observe(hero);
    }
    document.addEventListener('visibilitychange', wake);
    map.on('remove', function () {
      dead = true;
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', wake);
    });

    function frame(now) {
      if (dead || !visible || document.hidden || reduced || !hero.classList.contains('has-globe')) { running = false; return; }
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      {
        curLng += dt * 3.6;
        if (curLng > 180) curLng -= 360;
        map.jumpTo({ center: [curLng, CLAT] });

        var p = ((now - t0) / 3200) % 1;
        map.setPaintProperty('cities-ring', 'circle-radius', ['*', ['get', 'r'], 1.1 + p * 1.9]);
        map.setPaintProperty('cities-ring', 'circle-stroke-opacity', 0.7 * (1 - p));
        map.setPaintProperty('me-ring', 'circle-radius', 9 + p * 18);
        map.setPaintProperty('me-ring', 'circle-stroke-opacity', 0.7 * (1 - p));

        planes.forEach(function (pl) {
          pl.t += pl.dir * pl.speed * dt;
          if (pl.t > 1) { pl.t = 1; pl.dir = -1; }
          if (pl.t < 0) { pl.t = 0; pl.dir = 1; }
        });
        frameNo += 1;
        if (frameNo % 12 === 0) nameFilter();
        if (frameNo % 3 === 0) map.getSource('planes').setData({ type: 'FeatureCollection', features: planeFeatures() });
      }
      requestAnimationFrame(frame);
    }
    wake();
  }

  // The globe is the hero, so start as soon as the DOM is ready.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
