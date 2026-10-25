/* 26-icons-effects.js - Recruit icons (the real 3D model rendered once per kind: unitIcon), and the particle puffs (puff, emitFX, puffTick). */
/* ---------- recruit icons: the real 3D model rendered once per kind ---------- */
const UNIT_ICON = {}; // recruit icons by kind and skin (the icon shows the unit in the skin it will spawn with)
function roleGlyph(o, role, cx, cy) {
  o.save();
  o.translate(cx, cy);
  o.strokeStyle = '#2a1c04';
  o.fillStyle = '#2a1c04';
  o.lineCap = 'round';
  o.lineJoin = 'round';
  if (role === 'melee') {
    o.lineWidth = 4;
    o.beginPath();
    o.moveTo(-8, 8);
    o.lineTo(8, -8);
    o.stroke();
    o.lineWidth = 3.5;
    o.beginPath();
    o.moveTo(-9, 1);
    o.lineTo(-1, 9);
    o.stroke();
    o.beginPath();
    o.arc(-10, 10, 2.6, 0, TAU);
    o.fill();
  } else if (role === 'ranged') {
    o.lineWidth = 3;
    o.beginPath();
    o.arc(-3, 3, 11, -Math.PI * 0.75, Math.PI * 0.25);
    o.stroke();
    o.lineWidth = 1.6;
    o.beginPath();
    o.moveTo(-10.8, -4.8);
    o.lineTo(4.8, 10.8);
    o.stroke();
    o.lineWidth = 2.6;
    o.beginPath();
    o.moveTo(-6, 6);
    o.lineTo(9, -9);
    o.stroke();
    o.beginPath();
    o.moveTo(9, -9);
    o.lineTo(3, -8);
    o.lineTo(8, -3);
    o.closePath();
    o.fill();
  } else if (role === 'siege') {
    o.beginPath();
    o.arc(4, 4, 6.5, 0, TAU);
    o.fill();
    o.lineWidth = 2.4;
    o.setLineDash([3, 3]);
    o.beginPath();
    o.moveTo(-11, 10);
    o.quadraticCurveTo(-9, -12, 2, -3);
    o.stroke();
    o.setLineDash([]);
  } else {
    o.lineWidth = 4.5;
    o.beginPath();
    o.arc(0, -1, 8, Math.PI * 0.1, Math.PI * 0.9, true);
    o.stroke();
    o.lineWidth = 3;
    o.beginPath();
    o.moveTo(-9, 4);
    o.lineTo(-9, 9);
    o.moveTo(9, 4);
    o.lineTo(9, 9);
    o.stroke();
  }
  o.restore();
}
const HEAD_RAW = [];
// the head of unit kind k, rendered once in 3D (transparent 192 px canvas; always the classic colours, no skin)
function headRaw(k) {
  if (HEAD_RAW[k]) return HEAD_RAW[k];
  const S = 288,
    rt = renderer.capabilities.isWebGL2 ? new THREE.WebGLMultisampleRenderTarget(S, S) : new THREE.WebGLRenderTarget(S, S);
  if (rt.isWebGLMultisampleRenderTarget) rt.samples = Math.min(4, renderer.capabilities.maxSamples || 4);
  rt.texture.encoding = THREE.sRGBEncoding;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(lin(0xf4f7ff), lin(0x6a5a4a), 0.9));
  const dl = new THREE.DirectionalLight(lin(0xfff0dc), 1.35);
  dl.position.set(3, 5, 6);
  sc.add(dl);
  const rl = new THREE.DirectionalLight(lin(0x9fc8ff), 0.6);
  rl.position.set(-5, 2, -3);
  sc.add(rl);
  const u = Object.assign(buildUnitRaw(k), { id: 0, wob: 0, wobV: 0, atkT: 9, walk: 0, speed: 0, flash: 0 });
  scene.remove(u.g);
  hpGroup.remove(u.hp);
  u.blob.visible = false;
  sc.add(u.g);
  for (let i = 0; i < 12; i++) animateRig(u, 0.05, false, false);
  u.neck.scale.setScalar(1.15);
  u.g.updateMatrixWorld(true);
  const hp = new THREE.Vector3();
  u.head.getWorldPosition(hp);
  hp.y += 0.25;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30),
    a = 0.42,
    d = 5.2;
  cam.position.set(hp.x + Math.sin(a) * d, hp.y + 0.35, hp.z + Math.cos(a) * d);
  cam.lookAt(hp.x, hp.y - 0.05, hp.z);
  const oc = renderer.getClearColor(new THREE.Color()),
    oa = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(sc, cam);
  const px = new Uint8Array(S * S * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
  renderer.setRenderTarget(null);
  renderer.setClearColor(oc, oa);
  rt.dispose();
  const raw = cnv(S, S),
    rx = raw.getContext('2d'),
    id = rx.createImageData(S, S);
  for (let y = 0; y < S; y++) id.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  rx.putImageData(id, 0, 0);
  sc.remove(u.g);
  return (HEAD_RAW[k] = raw);
}
function unitIcon(k) {
  const ik = k + '|' + (UNIT_SKIN[k] ? UNIT_SKIN[k].id : '');
  if (UNIT_ICON[ik]) return UNIT_ICON[ik];
  try {
    const S = 256,
      rt = new THREE.WebGLRenderTarget(S, S);
    rt.texture.encoding = THREE.sRGBEncoding;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(lin(0xf4f7ff), lin(0x7a6a5a), 0.95));
    const dl = new THREE.DirectionalLight(lin(0xfff0dc), 1.3);
    dl.position.set(4, 7, 6);
    sc.add(dl);
    const u = Object.assign(buildUnit(k), { id: 0, wob: 0, wobV: 0, atkT: 9, walk: 0, speed: 0, flash: 0 });
    scene.remove(u.g);
    hpGroup.remove(u.hp);
    u.blob.visible = false;
    sc.add(u.g);
    for (let i = 0; i < 12; i++) animateRig(u, 0.05, false, false);
    u.g.updateMatrixWorld(true); // settle into the calm stance
    const cav = KINDS[k].role === 'cav',
      sg = KINDS[k].role === 'siege',
      wm = !!KINDS[k].worm,
      cam = new THREE.PerspectiveCamera(24, 1, 0.1, 60),
      d = wm ? 14 : sg ? 11 : cav ? 8.2 : 5.9,
      ty = wm ? 1.9 : sg ? 1.6 : cav ? 1.95 : 1.6,
      a = wm ? 0.95 : sg ? 0.8 : 0.55;
    cam.position.set(Math.sin(a) * d, ty + d * 0.2, Math.cos(a) * d);
    cam.lookAt(0, ty, 0);
    const oc = renderer.getClearColor(new THREE.Color()),
      oa = renderer.getClearAlpha(),
      osm = renderer.shadowMap.enabled;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(sc, cam);
    const px = new Uint8Array(S * S * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    renderer.setRenderTarget(null);
    renderer.setClearColor(oc, oa);
    renderer.shadowMap.enabled = osm;
    rt.dispose();
    const raw = cnv(S, S),
      rx = raw.getContext('2d'),
      id = rx.createImageData(S, S);
    for (let y = 0; y < S; y++) id.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    rx.putImageData(id, 0, 0);
    const out = cnv(128, 128),
      o = out.getContext('2d'),
      col = new THREE.Color(FAC[KINDS[k].fac].css);
    const light = '#' + col.clone().lerp(new THREE.Color(0xffffff), 0.45).getHexString(),
      dark = '#' + col.clone().lerp(new THREE.Color(0x0d1526), 0.35).getHexString();
    const gr = o.createRadialGradient(54, 44, 6, 64, 64, 62);
    gr.addColorStop(0, light);
    gr.addColorStop(1, dark);
    o.fillStyle = gr;
    o.beginPath();
    o.arc(64, 66, 58, 0, TAU);
    o.fill();
    o.strokeStyle = 'rgba(255,255,255,.35)';
    o.lineWidth = 2;
    o.stroke();
    o.save();
    o.beginPath();
    o.rect(0, 0, 128, 66);
    o.arc(64, 66, 58, 0, Math.PI);
    o.clip();
    o.drawImage(raw, -6, -4, 140, 140);
    o.restore();
    o.fillStyle = '#f0bf4c';
    o.beginPath();
    o.arc(104, 104, 17, 0, TAU);
    o.fill();
    o.strokeStyle = 'rgba(13,21,38,.85)';
    o.lineWidth = 3;
    o.stroke();
    roleGlyph(o, KINDS[k].role, 104, 104);
    return (UNIT_ICON[ik] = out.toDataURL());
  } catch (e) {
    return PORTRAIT[k];
  }
}

/* ---------- effects ---------- */
const fx = { puffs: [], projs: [], words: [], coins: [], shots: [], stuck: [], swings: [], debris: [], claws: [] };
const fxPrev = new THREE.Vector3(),
  fxAim = new THREE.Vector3();
const PUFF_CAP = 192,
  puffPool = [],
  puffDummy = new THREE.Object3D();
// All effects share one mesh and preallocated records; profiles only change motion and shape.
const FX_PROFILES = {
  smoke: { col: 0xffffff, n: 5, life: 0.6, spread: 2, lift: 1.7, gravity: 0, drag: 0.8, grow: 0.5, stretch: 1, alpha: 1 },
  dust: { col: 0xc7b78d, n: 3, life: 0.48, spread: 2.4, lift: 0.7, gravity: 0, drag: 2.8, grow: 1.1, stretch: 0.65, alpha: 0.85 },
  land: { col: 0xd8c48f, n: 10, life: 0.5, spread: 5.5, lift: 1.6, gravity: 5, drag: 3, grow: 0.65, stretch: 0.6, alpha: 1 },
  dash: { col: 0xffd879, n: 4, life: 0.33, spread: 1.6, lift: 0.6, gravity: 0, drag: 1.2, grow: 0.2, stretch: 1.8, alpha: 0.95 },
  pad: { col: 0xffe6a0, n: 12, life: 0.5, spread: 3, lift: 4, gravity: 3, drag: 1.4, grow: 0.15, stretch: 1.7, alpha: 1 },
  hit: { col: 0xffefad, n: 6, life: 0.3, spread: 4, lift: 2, gravity: 8, drag: 0.7, grow: 0.1, stretch: 1.3, alpha: 1 },
  explosion: { col: 0xffb45b, n: 24, life: 0.7, spread: 7, lift: 5.5, gravity: 10, drag: 0.9, grow: 0.7, stretch: 0.85, alpha: 1 },
  water: { col: 0xb6eaff, n: 10, life: 0.46, spread: 4, lift: 4, gravity: 13, drag: 1.1, grow: 0.1, stretch: 1.5, alpha: 0.95 },
  ice: { col: 0xdff6ff, n: 12, life: 0.55, spread: 5.2, lift: 3.8, gravity: 10, drag: 0.5, grow: 0, stretch: 1.4, alpha: 1 },
  building: { col: 0xb29b79, n: 22, life: 0.72, spread: 6, lift: 4, gravity: 11, drag: 0.9, grow: 0.3, stretch: 0.8, alpha: 1 },
  tame: { col: 0xa2e4ff, n: 16, life: 0.65, spread: 1.3, lift: 3.3, gravity: -1.2, drag: 1.4, grow: 0.05, stretch: 1.3, alpha: 1 },
};
for (let i = 0; i < PUFF_CAP; i++) puffPool.push({ m: new THREE.Object3D(), color: new THREE.Color() });
const puffGeo = new THREE.IcosahedronGeometry(0.35, 0);
const puffMesh = new THREE.InstancedMesh(puffGeo, basic(0xffffff, 0.78), PUFF_CAP);
puffMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PUFF_CAP * 3), 3);
puffMesh.instanceColor.setUsage(THREE.DynamicDrawUsage); // full-size colour buffer (was 0 long, so every particle drew white)
puffMesh.count = 0;
puffMesh.frustumCulled = false;
puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(puffMesh);
function releasePuff(p) {
  puffPool.push(p);
}
function puff(x, y, z, col = 0xffffff, n = 5, size = 1, kind = 'smoke', dx = 0, dz = 0) {
  const profile = FX_PROFILES[kind] || FX_PROFILES.smoke,
    len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const important = kind === 'explosion' || kind === 'ice' || kind === 'building' || kind === 'pad' || kind === 'tame' || kind === 'water'; // gameplay signals never vanish
  n = Math.min(Math.max(important ? Math.min(n, 4) : 0, Math.ceil(n * QS.fx)), (important ? PUFF_CAP : QS.fxCap) - fx.puffs.length);
  for (let i = 0; i < n; i++) {
    const p = puffPool.pop();
    if (!p) break;
    p.m.position.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.6);
    p.t = 0;
    p.life = profile.life * (0.82 + Math.random() * 0.36);
    p.vx = (Math.random() - 0.5) * profile.spread + dx * profile.spread * 0.75;
    p.vy = profile.lift * (0.55 + Math.random() * 0.7);
    p.vz = (Math.random() - 0.5) * profile.spread + dz * profile.spread * 0.75;
    p.profile = profile;
    p.m.rotation.set(Math.random() * Math.PI, Math.atan2(dx, dz), Math.random() * Math.PI);
    p.s = size * (0.6 + Math.random() * 0.6);
    p.color.setHex(col).convertSRGBToLinear();
    fx.puffs.push(p);
  }
}
function emitFX(kind, x, y, z, opt) {
  const p = FX_PROFILES[kind] || FX_PROFILES.smoke;
  puff(
    x,
    y,
    z,
    opt && opt.col !== undefined ? opt.col : p.col,
    opt && opt.n !== undefined ? opt.n : p.n,
    opt && opt.size !== undefined ? opt.size : 1,
    kind,
    (opt && opt.dx) || 0,
    (opt && opt.dz) || 0
  );
}
function puffTick(dt) {
  let count = 0;
  for (let i = fx.puffs.length - 1; i >= 0; i--) {
    const p = fx.puffs[i];
    p.t += dt;
    const k = p.t / p.life;
    if (k >= 1) {
      releasePuff(p);
      fx.puffs[i] = fx.puffs[fx.puffs.length - 1];
      fx.puffs.pop();
      continue;
    }
    const pr = p.profile;
    p.vy -= pr.gravity * dt;
    const drag = Math.max(0, 1 - pr.drag * dt);
    p.vx *= drag;
    p.vz *= drag;
    p.m.position.x += p.vx * dt;
    p.m.position.y += p.vy * dt;
    p.m.position.z += p.vz * dt;
    const size = p.s * (1 + k * pr.grow) * Math.sqrt(1 - k);
    p.m.scale.set(size, size * pr.stretch, size);
    p.m.rotation.z += dt * (pr.gravity ? 3 : 0.4);
    p.m.updateMatrix();
    puffMesh.setMatrixAt(count, p.m.matrix);
    puffAlpha.setX(count, (1 - k) * pr.alpha);
    puffMesh.setColorAt(count++, p.color);
  }
  puffMesh.count = count;
  if (count) {
    puffMesh.instanceMatrix.needsUpdate = true;
    puffMesh.instanceColor.needsUpdate = true;
    puffAlpha.needsUpdate = true;
  }
}
function instanceFadeMaterial(mat, geo, cap) {
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  alpha.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('instanceFade', alpha);
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float instanceFade; varying float vInstanceFade;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceFade = instanceFade;');
    shader.fragmentShader = 'varying float vInstanceFade;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= vInstanceFade;'
    );
    fogInject(shader);
  };
  return alpha;
}
const puffAlpha = instanceFadeMaterial(puffMesh.material, puffGeo, PUFF_CAP);
