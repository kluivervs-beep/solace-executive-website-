// Hero globe: a slowly turning world with gold city lights, drawn with
// MapLibre GL (globe projection) on free OpenFreeMap tiles, in Solace's own
// dark palette. Falls back to the flat CSS ring if WebGL or the CDN is
// unavailable. Replaces the earlier Three.js scene (hero-scene.js).

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var holder = document.getElementById('heroMap');
  var hero = document.querySelector('.hero');
  if (!holder || !hero) return;

  var CITIES = [
    ['Amsterdam', 52.37, 4.9], ['London', 51.5, -0.12], ['Paris', 48.85, 2.35], ['Berlin', 52.52, 13.4],
    ['Vienna', 48.21, 16.37], ['Geneva', 46.2, 6.14], ['Zurich', 47.38, 8.54], ['Milan', 45.46, 9.19],
    ['Monaco', 43.74, 7.42], ['Rome', 41.9, 12.5], ['Madrid', 40.42, -3.7], ['Barcelona', 41.39, 2.17],
    ['Dubai', 25.2, 55.27], ['Riyadh', 24.71, 46.68], ['Doha', 25.29, 51.53], ['New York', 40.71, -74.0],
    ['Miami', 25.76, -80.19], ['Los Angeles', 34.05, -118.24], ['Sao Paulo', -23.55, -46.63],
    ['Singapore', 1.35, 103.82], ['Hong Kong', 22.32, 114.17], ['Tokyo', 35.68, 139.65],
    ['Shanghai', 31.23, 121.47], ['Sydney', -33.87, 151.21],
  ];

  var GOLD = '#D8BD7C';
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

    var style = {
      version: 8,
      projection: { type: 'globe' },
      sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers: [
        { id: 'land', type: 'background', paint: { 'background-color': LAND } },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': SEA } },
        { id: 'borders', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 2],
          paint: { 'line-color': 'rgba(216,189,124,0.3)', 'line-width': 0.6 } },
      ],
    };

    var map;
    try {
      map = new maplibregl.Map({
        container: holder,
        style: style,
        center: [12, 24],
        zoom: 1.9,
        minZoom: 0.5,
        maxZoom: 3,
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
        return { type: 'Feature', properties: { n: c[0] }, geometry: { type: 'Point', coordinates: [c[2], c[1]] } };
      }),
    };

    map.on('load', function () {
      try {
        map.setSky({
          'sky-color': '#0B151D',
          'horizon-color': 'rgba(180,146,61,0.55)',
          'fog-color': '#0F1B24',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.5,
          'fog-ground-blend': 0.3,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1],
        });
      } catch (e) { /* older build: the CSS glow still frames the globe */ }

      map.addSource('cities', { type: 'geojson', data: points });
      map.addLayer({ id: 'cities-halo', type: 'circle', source: 'cities',
        paint: { 'circle-radius': 14, 'circle-color': GOLD, 'circle-opacity': 0.16, 'circle-blur': 1 } });
      map.addLayer({ id: 'cities-ring', type: 'circle', source: 'cities',
        paint: { 'circle-radius': 6, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': GOLD, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.5, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'cities-core', type: 'circle', source: 'cities',
        paint: { 'circle-radius': 2.6, 'circle-color': '#F4E8C4', 'circle-pitch-alignment': 'map' } });

      holder.classList.add('is-active');
      hero.classList.add('has-globe');
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
          map.jumpTo({ center: [lng, 24] });
          // The rings breathe outwards and fade, a little out of step.
          var p = ((now - t0) / 3200) % 1;
          map.setPaintProperty('cities-ring', 'circle-radius', 4 + p * 14);
          map.setPaintProperty('cities-ring', 'circle-stroke-opacity', 0.55 * (1 - p));
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
