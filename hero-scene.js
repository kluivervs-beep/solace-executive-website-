// Progressive-enhancement 3D globe for the hero background. Falls back
// silently to the flat CSS ring (styles.css / script.js) if WebGL or the
// Three.js CDN import is unavailable.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Network cities: the globe's node dots are these real cities. A subset of
// geographically sensible pairs are connected with arcs to suggest routes.
// `blurb` powers the hover/tap info card.
const CITIES = [
  { name: 'Amsterdam', lat: 52.37, lon: 4.9, blurb: 'Thuisbasis · direct bereikbaar' },
  { name: 'London', lat: 51, lon: 0, blurb: 'Vaste route, binnen 2 uur' },
  { name: 'Paris', lat: 48.85, lon: 2.35, blurb: 'Vaste route, binnen 2 uur' },
  { name: 'Geneva', lat: 46.2, lon: 6.14, blurb: 'Privéjets en jachtcharters' },
  { name: 'Milan', lat: 45.46, lon: 9.19, blurb: 'Vlootpartner ter plaatse' },
  { name: 'Dubai', lat: 25.2, lon: 55.27, blurb: 'Regionale hub, Midden-Oosten' },
  { name: 'New York', lat: 40.71, lon: -74.0, blurb: 'Vlootpartner ter plaatse' },
  { name: 'Miami', lat: 25.76, lon: -80.19, blurb: 'Jachtcharters en transport' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, blurb: 'Regionale hub, Azië-Pacific' },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17, blurb: 'Vlootpartner ter plaatse' },
  { name: 'Sydney', lat: -33.87, lon: 151.21, blurb: 'Vlootpartner ter plaatse' },
];

const ROUTES = [
  ['Amsterdam', 'London'],
  ['Amsterdam', 'Paris'],
  ['Amsterdam', 'Geneva'],
  ['Amsterdam', 'Dubai'],
  ['Amsterdam', 'New York'],
  ['Paris', 'Milan'],
  ['New York', 'Miami'],
  ['Dubai', 'Singapore'],
  ['Dubai', 'Hong Kong'],
  ['Singapore', 'Sydney'],
  ['Hong Kong', 'Sydney'],
];

function latLonToVector3(THREE, lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createRadialTexture(THREE, stops) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

async function initHeroScene() {
  if (reducedMotion) return;

  const canvas = document.getElementById('heroCanvas');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero) return;

  const testCtx = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!testCtx) return;

  let THREE;
  try {
    THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  } catch (err) {
    console.warn('Solace: Three.js CDN unavailable, using flat hero ring instead.', err);
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 6.4);

    const glowTexture = createRadialTexture(THREE, [
      [0, 'rgba(216,189,124,0.16)'],
      [0.5, 'rgba(216,189,124,0.05)'],
      [1, 'rgba(216,189,124,0)'],
    ]);
    const cometTexture = createRadialTexture(THREE, [
      [0, 'rgba(245,233,200,0.95)'],
      [0.4, 'rgba(216,189,124,0.5)'],
      [1, 'rgba(216,189,124,0)'],
    ]);

    // --- Starfield: distant, slow-parallax backdrop for depth ---
    const STAR_COUNT = 260;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const r = 9 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x9aa4ad,
      size: 0.022,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // --- Atmospheric rim glow behind the globe ---
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(5.0, 5.0, 1);
    scene.add(glowSprite);

    const globeGroup = new THREE.Group();

    const sphereGeo = new THREE.SphereGeometry(2, 28, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xb4923d,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
    });
    globeGroup.add(new THREE.Mesh(sphereGeo, wireMat));

    const haloGeo = new THREE.SphereGeometry(2.08, 20, 14);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xd8bd7c,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    globeGroup.add(new THREE.Mesh(haloGeo, haloMat));

    // --- City nodes (points) ---
    const NODE_RADIUS = 2.02;
    const cityBase = {};
    const nodePositions = [];
    CITIES.forEach((city) => {
      const v = latLonToVector3(THREE, city.lat, city.lon, NODE_RADIUS);
      cityBase[city.name] = v;
      nodePositions.push(v.x, v.y, v.z);
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
    nodeGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(CITIES.length * 3), 3));
    const nodeMat = new THREE.PointsMaterial({ vertexColors: true, size: 0.075, transparent: true, opacity: 0.95 });
    const cityPoints = new THREE.Points(nodeGeo, nodeMat);
    globeGroup.add(cityPoints);

    // --- Route arcs: raised bezier curves between city pairs, each with a
    // small traveling light suggesting an active route ---
    const routeLines = [];
    ROUTES.forEach(([fromName, toName]) => {
      const from = cityBase[fromName];
      const to = cityBase[toName];
      if (!from || !to) return;
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.setLength(NODE_RADIUS * 1.28);
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const points = curve.getPoints(24);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0xd8bd7c, transparent: true, opacity: 0.16 });
      const line = new THREE.Line(geo, mat);
      globeGroup.add(line);

      const cometMat = new THREE.SpriteMaterial({
        map: cometTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      });
      const comet = new THREE.Sprite(cometMat);
      comet.scale.set(0.11, 0.11, 1);
      globeGroup.add(comet);

      routeLines.push({
        line,
        curve,
        comet,
        fromName,
        toName,
        speed: 1 / (4.5 + Math.random() * 3),
        phase: Math.random(),
      });
    });

    scene.add(globeGroup);

    // --- Day/night: each city dims toward night as real-world time carries
    // its longitude away from the sun, independent of the ambient decorative
    // spin — so the lit/dark half sweeps across the globe as it rotates.
    const NIGHT_NODE_COLOR = new THREE.Color(0x4a5866);
    const DAY_NODE_COLOR = new THREE.Color(0xf5e9c8);
    const NIGHT_ARC_OPACITY = 0.05;
    const DAY_ARC_OPACITY = 0.16;
    const tmpColor = new THREE.Color();
    let cityDaylight = {};

    function normalizeLonDiff(diffDeg) {
      let d = diffDeg % 360;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return d;
    }

    function getSubsolarLongitude(date) {
      const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
      return normalizeLonDiff((12 - utcHours) * 15);
    }

    function updateDayNight() {
      const subsolarLon = getSubsolarLongitude(new Date());
      const colorAttr = nodeGeo.getAttribute('color');
      const nextDaylight = {};

      CITIES.forEach((city, i) => {
        const diff = normalizeLonDiff(city.lon - subsolarLon);
        const cosAngle = Math.cos((diff * Math.PI) / 180);
        const factor = Math.max(0.16, cosAngle);
        nextDaylight[city.name] = factor;
        tmpColor.copy(NIGHT_NODE_COLOR).lerp(DAY_NODE_COLOR, factor);
        colorAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      });
      colorAttr.needsUpdate = true;

      routeLines.forEach(({ line, fromName, toName }) => {
        const avg = ((nextDaylight[fromName] ?? 1) + (nextDaylight[toName] ?? 1)) / 2;
        line.material.opacity = NIGHT_ARC_OPACITY + (DAY_ARC_OPACITY - NIGHT_ARC_OPACITY) * avg;
      });

      cityDaylight = nextDaylight;
    }

    updateDayNight();
    setInterval(updateDayNight, 60000);

    // --- HTML overlay labels, one per city, positioned via 3D->2D projection ---
    const labelEls = {};
    CITIES.forEach((city) => {
      const el = document.createElement('span');
      el.className = 'globe-label';
      el.textContent = city.name;
      el.style.opacity = '0';
      hero.appendChild(el);
      labelEls[city.name] = el;
    });

    // --- Hover/tap info card for a city ---
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'globe-tooltip';
    tooltipEl.innerHTML = '<span class="globe-tooltip-name"></span><span class="globe-tooltip-blurb"></span>';
    hero.appendChild(tooltipEl);
    const tooltipNameEl = tooltipEl.querySelector('.globe-tooltip-name');
    const tooltipBlurbEl = tooltipEl.querySelector('.globe-tooltip-blurb');

    let hoveredCity = null;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.14;
    const pointerNdc = new THREE.Vector2(-10, -10);

    function pickCityAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return null;
      }
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(cityPoints);
      if (!hits.length) return null;
      const index = hits[0].index;
      return typeof index === 'number' ? CITIES[index] : null;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const size = Math.max(1, rect.width);
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }
    canvas.classList.add('is-active');
    resize();
    window.addEventListener('resize', resize);

    const targetOffset = { x: 0, y: 0 };
    const currentOffset = { x: 0, y: 0 };
    window.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetOffset.x = nx * 0.18;
      targetOffset.y = -ny * 0.12;

      hoveredCity = pickCityAt(e.clientX, e.clientY);
    });
    window.addEventListener('pointerdown', (e) => {
      const picked = pickCityAt(e.clientX, e.clientY);
      if (picked) hoveredCity = hoveredCity === picked ? null : picked;
    });

    const worldPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    function projectCity(city) {
      const canvasRect = canvas.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const base = cityBase[city.name];
      worldPos.copy(base).applyMatrix4(globeGroup.matrixWorld);

      const outward = worldPos.clone().normalize();
      const towardCam = camera.position.clone().sub(worldPos).normalize();
      const facing = outward.dot(towardCam);

      const ndc = worldPos.clone().project(camera);
      const px = (ndc.x * 0.5 + 0.5) * canvasRect.width;
      const py = (1 - (ndc.y * 0.5 + 0.5)) * canvasRect.height;
      const margin = 44;
      const offsetX = Math.min(
        heroRect.width - margin,
        Math.max(margin, canvasRect.left - heroRect.left + px)
      );
      const offsetY = canvasRect.top - heroRect.top + py;

      return { facing, offsetX, offsetY };
    }

    function updateLabels() {
      camera.getWorldDirection(camDir);

      CITIES.forEach((city) => {
        const { facing, offsetX, offsetY } = projectCity(city);
        const el = labelEls[city.name];

        if (facing < 0.08 || hoveredCity === city) {
          el.style.opacity = '0';
          return;
        }

        const dayFactor = cityDaylight[city.name] ?? 1;
        el.style.opacity = String(Math.min(1, (facing - 0.08) / 0.35) * 0.85 * (0.55 + 0.45 * dayFactor));
        el.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0) translate(-50%, -140%)`;
      });

      if (hoveredCity) {
        const { facing, offsetX, offsetY } = projectCity(hoveredCity);
        if (facing < 0.08) {
          tooltipEl.style.opacity = '0';
        } else {
          tooltipNameEl.textContent = hoveredCity.name;
          tooltipBlurbEl.textContent = hoveredCity.blurb || '';
          tooltipEl.style.opacity = '1';
          tooltipEl.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0) translate(-50%, -150%)`;
        }
      } else {
        tooltipEl.style.opacity = '0';
      }
    }

    const clock = new THREE.Clock();

    function updateComets() {
      const elapsed = clock.getElapsedTime();
      routeLines.forEach(({ curve, comet, speed, phase }) => {
        const t = (elapsed * speed + phase) % 1;
        const point = curve.getPointAt(t);
        comet.position.copy(point);
        comet.material.opacity = Math.sin(t * Math.PI) * 0.85;
      });
    }

    let animating = true;
    function tick() {
      if (!animating) return;
      globeGroup.rotation.y += 0.0016;
      starField.rotation.y += 0.00025;
      currentOffset.x += (targetOffset.x - currentOffset.x) * 0.05;
      currentOffset.y += (targetOffset.y - currentOffset.y) * 0.05;
      globeGroup.rotation.x = currentOffset.y;
      camera.position.x = currentOffset.x * 1.4;
      camera.lookAt(0, 0, 0);
      globeGroup.updateMatrixWorld(true);
      updateComets();
      renderer.render(scene, camera);
      updateLabels();
      requestAnimationFrame(tick);
    }

    tick();

    document.addEventListener('visibilitychange', () => {
      animating = !document.hidden;
      if (animating) tick();
    });
  } catch (err) {
    console.warn('Solace: hero globe failed to initialize, using flat ring instead.', err);
    canvas.classList.remove('is-active');
  }
}

initHeroScene();
