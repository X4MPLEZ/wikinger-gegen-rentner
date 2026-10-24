/* 67-showcase.js - 3D SHOWCASE in the profile: a second small WebGL renderer (its own canvas, created when first needed) draws a squad of
   one faction in a skin, turning slowly; drag to turn it. Used by the Ruhmespfad page and the skin preview. skinThumb() makes the still
   pictures on the skin tiles with the same renderer. The models come from buildSkinned (25-worm-model.js), so they look exactly like
   in a match. showTick() runs from frame() while a showcase is on screen. */
const SHOW = { r: null, sc: null, cam: null, grp: null, units: [], key: '', yaw: 0.5, drag: null, host: null, acc: 0, cache: new Map() };
function showInit() {
  if (SHOW.r) return true;
  const cv = document.createElement('canvas');
  cv.className = 'showcv';
  try {
    SHOW.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: false });
  } catch (_) {
    return false;
  }
  const r = SHOW.r;
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0x000000, 0);
  const sc = (SHOW.sc = new THREE.Scene());
  sc.add(new THREE.HemisphereLight(lin(0xf4f7ff), lin(0x6a5a4a), 0.95));
  const key = new THREE.DirectionalLight(lin(0xfff0dc), 1.4);
  key.position.set(3, 6, 5);
  const rim = new THREE.DirectionalLight(lin(0x9fc8ff), 0.75);
  rim.position.set(-5, 3, -4);
  sc.add(key, rim);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  disc.position.y = 0.01;
  sc.add(disc);
  SHOW.grp = new THREE.Group();
  sc.add(SHOW.grp);
  SHOW.cam = new THREE.PerspectiveCamera(28, 1.5, 0.1, 80);
  // drag to turn (mouse and touch); a short tap is left to the page
  cv.addEventListener('pointerdown', e => {
    SHOW.drag = { x: e.clientX, yaw: SHOW.yaw, id: e.pointerId };
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  cv.addEventListener('pointermove', e => {
    if (SHOW.drag && SHOW.drag.id === e.pointerId) SHOW.yaw = SHOW.drag.yaw + (e.clientX - SHOW.drag.x) * 0.012;
  });
  const up = () => (SHOW.drag = null);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  return true;
}
// a model for the showcase (kept: the same skin is shown again and again)
function showUnit(k, skin) {
  const key = k + '|' + skin;
  if (SHOW.cache.has(key)) return SHOW.cache.get(key);
  const u = Object.assign(buildSkinned(k, skin), { id: 0, wob: 0, wobV: 0, atkT: 9, walk: 0, speed: 0, flash: 0 });
  scene.remove(u.g);
  hpGroup.remove(u.hp);
  u.blob.visible = false;
  u.ring.visible = false;
  u.g.traverse(o => (o.castShadow = o.receiveShadow = false));
  SHOW.cache.set(key, u);
  return u;
}
/* what to show: { fac, skin } = melee, ranged and rider of that faction; { k, skin } = one unit */
function showSet(spec) {
  if (!showInit()) return false;
  const key = JSON.stringify(spec);
  if (key === SHOW.key) return true;
  SHOW.key = key;
  SHOW.units.forEach(u => SHOW.grp.remove(u.g));
  SHOW.units = [];
  const ks = spec.k !== undefined ? [spec.k] : FAC[spec.fac].kinds.filter(k => KINDS[k].role !== 'siege');
  const place =
    ks.length === 1
      ? [[0, 0, 0]]
      : [
          [-1.05, 0.25, 0.25],
          [1.05, 0.25, -0.25],
          [0, -0.55, 0],
        ];
  ks.forEach((k, i) => {
    let u;
    try {
      u = showUnit(k, spec.skin);
    } catch (_) {
      return;
    }
    const [x, z, ry] = place[i];
    u.g.position.set(x, 0, z);
    u.g.rotation.y = ry;
    u.atkT = 9 + i;
    SHOW.grp.add(u.g);
    SHOW.units.push(u);
  });
  SHOW.single = ks.length === 1;
  return true;
}
// put the showcase canvas into an element of the page (the canvas moves; only one showcase is on screen at a time)
function showMount(host, spec) {
  if (!showSet(spec)) return false;
  SHOW.host = host;
  if (SHOW.r.domElement.parentNode !== host) host.appendChild(SHOW.r.domElement);
  return true;
}
function showFrame(w, h) {
  const r = SHOW.r,
    pr = Math.min(2, devicePixelRatio || 1);
  if (r.getPixelRatio() !== pr) r.setPixelRatio(pr);
  const s = r.getSize(new THREE.Vector2());
  if (s.x !== w || s.y !== h) r.setSize(w, h, false);
  const c = SHOW.cam,
    single = SHOW.single,
    d = single ? 6.2 : 7.4;
  c.aspect = w / h;
  c.fov = c.aspect < 1 ? 36 : 28;
  c.updateProjectionMatrix();
  c.position.set(Math.sin(0.25) * d, single ? 2.1 : 2.5, Math.cos(0.25) * d);
  c.lookAt(0, single ? 1.3 : 1.2, 0);
  SHOW.grp.rotation.y = SHOW.yaw;
  r.render(SHOW.sc, c);
}
function showTick(dt) {
  const h = SHOW.host;
  if (!SHOW.r || !h || !h.isConnected || $('#profScr').hidden) return;
  SHOW.acc += dt;
  if (SHOW.acc < 1 / 40) return; // at most 40 pictures a second
  const st = SHOW.acc;
  SHOW.acc = 0;
  const w = h.clientWidth,
    hh = h.clientHeight;
  if (!w || !hh) return;
  if (!SHOW.drag) SHOW.yaw += st * 0.45;
  SHOW.units.forEach((u, i) => {
    u.atkT = (clock * 0.7 + i * 0.9) % 3;
    animateRig(u, Math.min(st, 0.1), false, false);
  });
  showFrame(w, hh);
}
// a still picture of one unit in a skin (the tiles in the collection): the faction's melee unit, three quarters from the front
const SK_THUMB = {};
function skinThumb(id) {
  if (SK_THUMB[id]) return SK_THUMB[id];
  const S = SKINS[id];
  if (!S || !showInit()) return '';
  const keepKey = SHOW.key,
    keepYaw = SHOW.yaw,
    keepUnits = SHOW.units.slice();
  SHOW.units.forEach(u => SHOW.grp.remove(u.g));
  SHOW.units = [];
  SHOW.key = '';
  showSet({ k: FAC[S.fac].kinds[0], skin: id });
  SHOW.yaw = 0.35;
  showFrame(160, 180);
  const url = SHOW.r.domElement.toDataURL('image/png');
  // back to what was on show
  SHOW.units.forEach(u => SHOW.grp.remove(u.g));
  SHOW.units = keepUnits;
  keepUnits.forEach(u => SHOW.grp.add(u.g));
  SHOW.key = keepKey;
  SHOW.yaw = keepYaw;
  SHOW.single = keepUnits.length === 1;
  SK_THUMB[id] = url;
  return url;
}
