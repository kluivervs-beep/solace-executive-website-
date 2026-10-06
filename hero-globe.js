// Hero globe: a slowly turning world with gold city lights, drawn with
// MapLibre GL (globe projection) on free OpenFreeMap tiles, in Solace's own
// dark palette. Falls back to the flat CSS ring if WebGL or the CDN is
// unavailable. Replaces the earlier Three.js scene (hero-scene.js).

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

  var GOLD = '#E8682F';
  var LAND = '#203443';
  var SEA = '#0B151D';

  function load(src, kind) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement(kind === 'css' ? 'link' : 'script');
      if (kind === 'css') { el.rel = 'stylesheet'; el.href = src; } else { el.src = src; el.async = true; }
      el.onload = resolve;
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  function webglOk() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  function start() {
    if (!webglOk()) return;
    var base = 'https://unpkg.com/maplibre-gl@5.7.0/dist/';
    Promise.all([load(base + 'maplibre-gl.css', 'css'), load(base + 'maplibre-gl.js', 'js')])
      .then(build)
      .catch(function (e) { console.warn('Solace: globe unavailable, using the flat ring.', e); });
  }

  function build() {
    var maplibregl = window.maplibregl;
    if (!maplibregl) return;

    // The full OpenFreeMap 'bright' style: blue seas, soft green land and
    // place names. The globe projection is switched on once it has loaded.
    var style = 'https://tiles.openfreemap.org/styles/bright';

    function zoomFor(w) {
      // A globe is 512 * 2^zoom / (2 * PI) pixels wide, so pick the zoom for the diameter we want.
      var d = Math.min(w * 0.96, 1180);
      return Math.log(d / 129.5) / Math.LN2;
    }

    var map;
    try {
      map = new maplibregl.Map({
        container: holder,
        style: style,
        center: [12, 28],
        zoom: zoomFor(holder.clientWidth),
        minZoom: 0.5,
        maxZoom: 4,
        interactive: false,
        attributionControl: false,
        renderWorldCopies: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75),
        fadeDuration: 0,
      });
    } catch (e) { return; }

    var points = {
      type: 'FeatureCollection',
      features: CITIES.map(function (c) {
        return { type: 'Feature', properties: { n: c[0], r: HUBS[c[0]] || 5 }, geometry: { type: 'Point', coordinates: [c[2], c[1]] } };
      }),
    };

    map.on('load', function () {
      try { map.setProjection({ type: 'globe' }); } catch (e) { /* flat map fallback is acceptable */ }
      try {
        map.setSky({
          'sky-color': '#bcdcf6',
          'horizon-color': '#d6e8f7',
          'fog-color': '#eaf2f9',
          'sky-horizon-blend': 0.7,
          'horizon-fog-blend': 0.6,
          'fog-ground-blend': 0.4,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1],
        });
      } catch (e) { /* the CSS glow still frames the globe */ }

      map.addSource('cities', { type: 'geojson', data: points });
      map.addLayer({ id: 'cities-halo', type: 'circle', source: 'cities',
        paint: { 'circle-radius': ['*', ['get', 'r'], 2.8], 'circle-color': GOLD, 'circle-opacity': 0.26, 'circle-blur': 0.8, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'cities-ring', type: 'circle', source: 'cities',
        paint: { 'circle-radius': ['*', ['get', 'r'], 1.4], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': GOLD, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.6, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'cities-core', type: 'circle', source: 'cities',
        paint: { 'circle-radius': ['get', 'r'], 'circle-color': GOLD, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.6, 'circle-pitch-alignment': 'map' } });

      // Glow around the limb, sized from the globe diameter.
      function haloSize() {
        var r = Math.min(holder.clientWidth * 0.96, 1180) / 2;
        holder.style.setProperty('--R', r + 'px');
      }
      haloSize();
      window.addEventListener('resize', function () {
        haloSize();
        map.setZoom(zoomFor(holder.clientWidth));
      });

      holder.classList.add('is-active');
      hero.classList.add('has-globe');
      document.documentElement.classList.add('has-globe');
      run(map);
    });

    map.on('error', function (e) { if (e && e.error && !map.loaded()) console.warn('Solace globe:', e.error.message); });
  }

  function run(map) {
    var visible = true;
    var last = performance.now();
    var lng = 12;
    var t0 = last;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(hero);
    }

    function frame(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible && !document.hidden) {
        if (!reduced) {
          lng += dt * 4.2;
          if (lng > 180) lng -= 360;
          map.jumpTo({ center: [lng, 27] });
          // The rings breathe outwards and fade, a little out of step.
          var p = ((now - t0) / 3200) % 1;
          map.setPaintProperty('cities-ring', 'circle-radius', ['*', ['get', 'r'], 1.1 + p * 1.9]);
          map.setPaintProperty('cities-ring', 'circle-stroke-opacity', 0.7 * (1 - p));
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Start once the page has settled so the globe never competes with first paint.
  if (document.readyState === 'complete') setTimeout(start, 400);
  else window.addEventListener('load', function () { setTimeout(start, 400); });
})();
