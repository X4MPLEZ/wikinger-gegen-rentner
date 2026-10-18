/* ---------- rolling sand: chunky grains with gravity, bounce, rolling friction and a downhill slide; ploughed ridges that slump back;
   darker churned tracks that fade. Used by the sandworm (digging, ploughing, bursting out) and its bite. ---------- */
const SAND_CAP = 560,
  sandGrains = [],
  sandDummy = new THREE.Object3D();
const SAND_LIN = [0xdcb878, 0xd2ab68, 0xe6c88e, 0xc49a58, 0xbf9455, 0xead3a0].map(c => new THREE.Color(c).convertSRGBToLinear());
const sandGeo = new THREE.IcosahedronGeometry(1, 0);
const sandMesh = new THREE.InstancedMesh(sandGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), SAND_CAP);
sandMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SAND_CAP * 3), 3);
sandMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
sandMesh.count = 0;
sandMesh.frustumCulled = false;
sandMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(sandMesh);
// o: r spawn radius, out outward speed, up upward speed, a/spread a direction cone, dx/dz extra push, size, life, y lift above the ground, yr its spread
function sandBurst(x, z, n, o = {}) {
  n = Math.min(Math.round(n * Math.max(0.35, QS.fx)), SAND_CAP - sandGrains.length);
  if (n <= 0) return;
  const gy = o.gy ?? groundY(x, z),
    r = o.r ?? 1,
    out = o.out ?? 3,
    up = o.up ?? 3,
    sz = o.size ?? 0.12,
    life = o.life ?? 1.8,
    dx = o.dx || 0,
    dz = o.dz || 0,
    y0 = o.y ?? 0.15;
  for (let i = 0; i < n; i++) {
    const a = o.a !== undefined ? o.a + (Math.random() - 0.5) * (o.spread ?? 1) : Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r,
      ca = Math.cos(a),
      sa = Math.sin(a),
      sp = out * (0.45 + Math.random() * 0.75);
    sandGrains.push({
      x: x + ca * d,
      z: z + sa * d,
      y: gy + y0 + Math.random() * (o.yr ?? 0.3),
      vx: ca * sp + dx * (0.6 + Math.random() * 0.6),
      vz: sa * sp + dz * (0.6 + Math.random() * 0.6),
      vy: up * (0.4 + Math.random() * 0.8),
      s: sz * (0.5 + Math.random()),
      t: 0,
      life: life * (0.7 + Math.random() * 0.6),
      rx: Math.random() * 6,
      ry: Math.random() * 6,
      rz: Math.random() * 6,
      c: (Math.random() * SAND_LIN.length) | 0,
    });
  }
}
function sandTick(dt) {
  let n = 0;
  const h = 0.3;
  for (let i = sandGrains.length - 1; i >= 0; i--) {
    const p = sandGrains[i];
    p.t += dt;
    if (p.t >= p.life) {
      sandGrains[i] = sandGrains[sandGrains.length - 1];
      sandGrains.pop();
      continue;
    }
    p.vy -= 16 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const gy = groundY(p.x, p.z),
      rr = p.s * 0.6;
    if (p.y < gy + rr) {
      p.y = gy + rr;
      if (p.vy < -1.5) {
        p.vy = -p.vy * 0.22;
        p.vx *= 0.72;
        p.vz *= 0.72;
      } else {
        p.vy = 0; // rolling: friction, and the dune's slope pulls it downhill
        const gx = (groundY(p.x + h, p.z) - groundY(p.x - h, p.z)) / (2 * h),
          gz = (groundY(p.x, p.z + h) - groundY(p.x, p.z - h)) / (2 * h);
        p.vx -= gx * 7 * dt;
        p.vz -= gz * 7 * dt;
        const sp = Math.hypot(p.vx, p.vz),
          dec = 2.4 * dt;
        if (sp > dec) {
          p.vx -= (p.vx / sp) * dec;
          p.vz -= (p.vz / sp) * dec;
        } else {
          p.vx = 0;
          p.vz = 0;
        }
        const rs = 1 / Math.max(0.03, p.s);
        p.rx += p.vz * rs * dt;
        p.rz -= p.vx * rs * dt;
      }
    } else {
      p.rx += dt * 5;
      p.rz += dt * 3;
    }
    const k = p.t / p.life,
      sink = k > 0.72 ? (k - 0.72) / 0.28 : 0,
      sc = p.s * (1 - sink * 0.85); // settles into the dune at the end
    sandDummy.position.set(p.x, p.y - sink * p.s, p.z);
    sandDummy.rotation.set(p.rx, p.ry, p.rz);
    sandDummy.scale.set(sc, sc * 0.8, sc);
    sandDummy.updateMatrix();
    sandMesh.setMatrixAt(n, sandDummy.matrix);
    sandMesh.setColorAt(n++, SAND_LIN[p.c]);
  }
  sandMesh.count = n;
  if (n) {
    sandMesh.instanceMatrix.needsUpdate = true;
    sandMesh.instanceColor.needsUpdate = true;
  }
  ridgeTick(dt);
  trackTick(dt);
}
// a hump of ploughed sand that slumps back into the dune
const RIDGE_CAP = 140,
  ridges = [],
  ridgeGeo = new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2);
const ridgeMesh = new THREE.InstancedMesh(ridgeGeo, new THREE.MeshLambertMaterial({ color: lin(0xdcb878) }), RIDGE_CAP);
ridgeMesh.count = 0;
ridgeMesh.frustumCulled = false;
ridgeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
ridgeMesh.receiveShadow = true;
scene.add(ridgeMesh);
function sandRidge(x, z, yaw, w, h, len, life) {
  if (ridges.length >= RIDGE_CAP) ridges.shift();
  ridges.push({ x, z, y: groundY(x, z), yaw, w, h, len, life, t: 0 });
}
function ridgeTick(dt) {
  let n = 0;
  for (let i = ridges.length - 1; i >= 0; i--) {
    const r = ridges[i];
    r.t += dt;
    if (r.t >= r.life) {
      ridges.splice(i, 1);
      continue;
    }
  }
  for (const r of ridges) {
    const k = r.t / r.life,
      grow = Math.min(1, r.t / 0.12),
      hh = r.h * grow * (1 - k) * (1 - k * 0.6) + 0.01;
    sandDummy.position.set(r.x, r.y - 0.03, r.z);
    sandDummy.rotation.set(0, r.yaw, 0);
    sandDummy.scale.set(r.w * (0.8 + k * 0.5), hh, r.len * (0.9 + k * 0.3));
    sandDummy.updateMatrix();
    ridgeMesh.setMatrixAt(n++, sandDummy.matrix);
  }
  ridgeMesh.count = n;
  if (n) ridgeMesh.instanceMatrix.needsUpdate = true;
}
// churned, darker sand along a worm's track
const TRACK_CAP = 180,
  tracks = [],
  trackGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
const trackMat = new THREE.MeshBasicMaterial({
  color: lin(0x8f6d3f),
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
const trackAlpha = instanceFadeMaterial(trackMat, trackGeo, TRACK_CAP);
const trackMesh = new THREE.InstancedMesh(trackGeo, trackMat, TRACK_CAP);
trackMesh.count = 0;
trackMesh.frustumCulled = false;
trackMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
trackMesh.renderOrder = 1;
scene.add(trackMesh);
function sandTrack(x, z, yaw, w, len, life) {
  if (tracks.length >= TRACK_CAP) tracks.shift();
  tracks.push({ x, z, y: groundY(x, z), yaw, w, len, life, t: 0 });
}
function trackTick(dt) {
  let n = 0;
  for (let i = tracks.length - 1; i >= 0; i--) {
    const r = tracks[i];
    r.t += dt;
    if (r.t >= r.life) tracks.splice(i, 1);
  }
  for (const r of tracks) {
    const k = r.t / r.life;
    sandDummy.position.set(r.x, r.y + 0.05, r.z);
    sandDummy.rotation.set(0, r.yaw, 0);
    sandDummy.scale.set(r.w, 1, r.len);
    sandDummy.updateMatrix();
    trackMesh.setMatrixAt(n, sandDummy.matrix);
    trackAlpha.setX(n++, Math.min(1, r.t / 0.2) * (1 - k) * (1 - k));
  }
  trackMesh.count = n;
  if (n) {
    trackMesh.instanceMatrix.needsUpdate = true;
    trackAlpha.needsUpdate = true;
  }
}
function sandClear() {
  sandGrains.length = 0;
  sandMesh.count = 0;
  ridges.length = 0;
  ridgeMesh.count = 0;
  tracks.length = 0;
  trackMesh.count = 0;
}
// a crater wall thrown up all around (burst out, dive in)
function sandCrater(x, z, R, h, life) {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + Math.random() * 0.3;
    sandRidge(
      x + Math.cos(a) * R,
      z + Math.sin(a) * R,
      -a,
      0.9 + Math.random() * 0.4,
      h * (0.7 + Math.random() * 0.5),
      0.9 + Math.random() * 0.3,
      life * (0.8 + Math.random() * 0.4)
    );
  }
  sandTrack(x, z, 0, R * 1.25, R * 1.25, life * 2.5);
}
const RIPPLE_CAP = 40,
  ripples = [],
  ripplePool = [],
  rippleGeo = new THREE.RingGeometry(0.84, 1, 20).rotateX(-Math.PI / 2);
const rippleMat = new THREE.MeshBasicMaterial({
  color: lin(0xbceeff),
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
});
const rippleAlpha = instanceFadeMaterial(rippleMat, rippleGeo, RIPPLE_CAP);
const rippleMesh = new THREE.InstancedMesh(rippleGeo, rippleMat, RIPPLE_CAP);
rippleMesh.count = 0;
rippleMesh.frustumCulled = false;
rippleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(rippleMesh);
for (let i = 0; i < RIPPLE_CAP; i++) ripplePool.push({ x: 0, y: 0, z: 0, t: 0, strength: 1 });
function waterRipple(x, z, strength = 1) {
  if (ripples.length >= QS.ripples) return;
  const r = ripplePool.pop();
  if (!r) return;
  r.x = x;
  r.z = z;
  r.y = MAP.lift ? -9.62 : WL + 0.08;
  r.t = 0;
  r.strength = clamp(strength, 0.5, 2.2);
  ripples.push(r);
}
function rippleTick(dt) {
  let count = 0;
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    const k = r.t / 0.8;
    if (k >= 1) {
      ripplePool.push(r);
      ripples[i] = ripples[ripples.length - 1];
      ripples.pop();
      continue;
    }
    const size = r.strength * (0.35 + k * 1.7);
    puffDummy.position.set(r.x, r.y, r.z);
    puffDummy.rotation.set(0, 0, 0);
    puffDummy.scale.set(size, 1, size);
    puffDummy.updateMatrix();
    rippleMesh.setMatrixAt(count, puffDummy.matrix);
    rippleAlpha.setX(count++, (1 - k) * (1 - k));
  }
  rippleMesh.count = count;
  if (count) {
    rippleMesh.instanceMatrix.needsUpdate = true;
    rippleAlpha.needsUpdate = true;
  }
}
function clearRipples() {
  while (ripples.length) ripplePool.push(ripples.pop());
  rippleMesh.count = 0;
}
function waterMotionFX(u, x, y, z, wet, dt) {
  const wading = !wet && u.speed > 2 && wadeAt(x, z),
    moving = u.speed > 0.6;
  if (wet && !u.waterFxWet && (u.dryT || 0) > 0.4 && !u.arm) {
    emitFX('water', x, MAP.lift ? -9.55 : WL + 0.12, z);
    waterRipple(x, z, Math.min(2.2, 0.8 + u.speed * 0.07));
    if (u.team === V.myTeam || (V.poss && V.poss.id === u.id)) SFX.play('splat', { x, z, vol: 0.55 });
  }
  u.waterFxWet = wet;
  u.waterFxT = (u.waterFxT || 0) - dt;
  if ((wet || wading) && moving && u.waterFxT <= 0) {
    u.waterFxT = (u.speed > 7 ? 0.18 : 0.32) * QS.waterFx;
    const a = u.g.rotation.y,
      size = Math.min(2, 0.55 + u.speed * 0.075);
    waterRipple(x - Math.sin(a) * 0.6, z - Math.cos(a) * 0.6, size);
    puff(x, MAP.lift ? -9.55 : WL + 0.14, z, 0xb6eaff, u.speed > 7 ? 3 : 1, size * 0.35, 'water', -Math.sin(a), -Math.cos(a));
  }
}
const CONTACT_CAP = 128;
const contactGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const contactTex = (() => {
  const c = cnv(64, 64),
    x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.8)');
  g.addColorStop(0.4, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const contactMat = new THREE.MeshBasicMaterial({
  map: contactTex,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
});
const contactAlpha = instanceFadeMaterial(contactMat, contactGeo, CONTACT_CAP);
const contactMesh = new THREE.InstancedMesh(contactGeo, contactMat, CONTACT_CAP);
contactMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CONTACT_CAP * 3).fill(1), 3);
contactMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
contactMesh.count = 0;
contactMesh.frustumCulled = false;
contactMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(contactMesh);
function unitShadowRange(u) {
  // per tier: which parts cast (by size) and up to which distance
  if (!u.shadowCasters) {
    u.shadowCasters = [];
    u.g.traverse(m => {
      if (m.isMesh && m.castShadow) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        u.shadowCasters.push([m, m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z)]);
      }
    });
  }
  const p = V.poss || camS,
    d = Math.hypot(u.g.position.x - (p.x || 0), u.g.position.z - (p.z || 0)),
    near = d < QS.shDist;
  if (u.shadowNear !== near || u.shadowVer !== QS.ver) {
    u.shadowNear = near;
    u.shadowVer = QS.ver;
    for (const [m, r] of u.shadowCasters) m.castShadow = near && r > QS.unitSh;
  }
}
function contactTick() {
  let i = 0;
  for (const u of V.units.values()) {
    if (i >= CONTACT_CAP) break;
    if (!u.g.visible || u.fogHid || u.dying || (u.worm && u.wP && (u.wP.ws === 'under' || u.wP.ws === 'warn'))) continue;
    const p = u.g.position,
      floor = Math.max(groundY(p.x, p.z), MAP.lift ? -9.7 : WL),
      height = Math.max(0, p.y - floor);
    if (height > 18 || Math.hypot(p.x - camera.position.x, p.z - camera.position.z) > 160) continue;
    const size = KINDS[u.k].r * 3.1 + Math.min(1.6, height * 0.12);
    puffDummy.position.set(p.x, floor + 0.04, p.z);
    puffDummy.scale.set(size, 1, size);
    puffDummy.rotation.set(0, 0, 0);
    puffDummy.updateMatrix();
    contactMesh.setMatrixAt(i, puffDummy.matrix);
    {
      const foe = u.team !== V.myTeam,
        ca = contactMesh.instanceColor.array,
        o3 = i * 3;
      ca[o3] = foe ? 0.75 : 0.05;
      ca[o3 + 1] = foe ? 0.08 : 0.05;
      ca[o3 + 2] = foe ? 0.08 : 0.08;
    }
    contactAlpha.setX(i++, 1 / (1 + height * 0.16)); // enemies stand on a reddish shadow
  }
  contactMesh.count = i;
  contactMesh.instanceMatrix.needsUpdate = true;
  contactMesh.instanceColor.needsUpdate = true;
  contactAlpha.needsUpdate = true;
}
const spriteCache = new Map();
function spriteMat(key, make) {
  if (!spriteCache.has(key)) {
    const c = make(),
      tx = ctex(c);
    c._tex = tx;
    spriteCache.set(key, { mat: new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }), ar: c.width / c.height });
  }
  return spriteCache.get(key);
}
let lastBubble = 0;
function word(text, x, y, z, opt = {}) {
  if (FOG.on && !fogSeen(x, z)) return; // nothing pops out of the fog wall
  if (!opt.bubble && !opt.prio && fx.words.length >= (V.poss ? 5 : 14)) return; // a few at a time; a pile of shouts just covers the fight (own hits always show)
  const key = (opt.bubble ? 'b:' : 'w:') + text + (opt.color || '');
  const sm = spriteMat(key, () => textCanvas(text, opt.bubble ? { bubble: true, tail: true, size: 46 } : { size: 72, color: opt.color }));
  const s = new THREE.Sprite(sm.mat.clone()),
    h = (opt.bubble ? 1.5 : 1.6) * (opt.scale || 1) * (V.poss ? 0.55 : 1);
  s.material.fog = false;
  s.scale.set(h * sm.ar, h, 1);
  s.position.set(x, y, z);
  s.renderOrder = 10;
  scene.add(s);
  fx.words.push({ s, t: 0, life: opt.bubble ? 2.2 : 0.9, y0: y, h, ar: sm.ar, bubble: !!opt.bubble, follow: opt.follow });
}
// Over an enemy big-head: a small ring that shows when his special is ready again (and which one it is).
const EGO_CD = { tex: new Map() };
function egoCdSprite(u, x, y, z, mine) {
  const show = u.isPoss && !mine && u.team !== V.myTeam && u.g.visible && !u.fogHid && V.playing;
  if (!show) {
    if (u.cdSp) u.cdSp.visible = false;
    return;
  }
  const K = KINDS[u.k],
    max = K.role === 'siege' ? 14 : K.bear ? 6 : K.worm ? 9 : 8,
    f = clamp((u.spcd || 0) / max, 0, 1),
    step = Math.round(f * 16),
    key = u.k + ':' + step;
  let tx = EGO_CD.tex.get(key);
  if (!tx) {
    const c = cnv(96, 96),
      g = c.getContext('2d');
    g.lineWidth = 9;
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.beginPath();
    g.arc(48, 48, 38, 0, TAU);
    g.stroke();
    g.strokeStyle = step === 0 ? '#ffd34d' : '#ff5a4a';
    g.beginPath();
    g.arc(48, 48, 38, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - step / 16));
    g.stroke();
    g.fillStyle = step === 0 ? 'rgba(255,211,77,.95)' : 'rgba(20,24,40,.8)';
    g.beginPath();
    g.arc(48, 48, 30, 0, TAU);
    g.fill();
    g.fillStyle = step === 0 ? '#2a1c04' : '#fff';
    g.font = 'bold 30px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(step === 0 ? '!' : Math.ceil((step / 16) * max), 48, 50);
    tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearFilter;
    EGO_CD.tex.set(key, tx);
  }
  if (!u.cdSp) {
    u.cdSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
    u.cdSp.renderOrder = 11;
    scene.add(u.cdSp);
    u.cdSp.userData.key = '';
  }
  if (u.cdSp.userData.key !== key) {
    u.cdSp.material.map = tx;
    u.cdSp.material.needsUpdate = true;
    u.cdSp.userData.key = key;
  }
  const sc = (V.poss ? 0.75 : 1.1) * (step === 0 ? 1 + 0.08 * Math.sin(clock * 10) : 1);
  u.cdSp.scale.set(sc, sc, 1);
  u.cdSp.position.set(x, y + (K.worm ? (u.hpY || 3.4) + 1.3 : K.bear ? 5.2 : K.role === 'cav' ? 5.0 : 4.5) * (u.g.scale.x || 1), z);
  u.cdSp.visible = true;
}
function say(uv, list) {
  const t = now();
  if (V.poss && uv.id === V.poss.id) return;
  if (!list || !list.length || t - lastBubble < 1400) return;
  lastBubble = t;
  word(pick(list), uv.g.position.x, uv.g.position.y + 4, uv.g.position.z, { bubble: true, follow: uv });
}
const projGeo = {
  arrow: (() => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5).rotateX(Math.PI / 2), lam(0x6b4423), 0, 0, 0, g);
    mesh(new THREE.ConeGeometry(0.06, 0.2, 6).rotateX(Math.PI / 2), lam(0xc9ced4), 0, 0, 0.5, g);
    mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16), lam(0xf1ead6), 0, 0, -0.4, g);
    return g;
  })(),
  teeth: (() => {
    const g = new THREE.Group(),
      gum = lam(0xe86f8a),
      tooth = new THREE.MeshLambertMaterial({ color: lin(0xfffbf0), emissive: lin(0x3a3a34) });
    [1, -1].forEach(sy => {
      const jaw = new THREE.Group();
      jaw.position.y = sy * 0.1;
      jaw.rotation.x = sy * 0.28;
      g.add(jaw);
      const arc = mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 18, Math.PI), gum, 0, 0, 0, jaw);
      arc.rotation.x = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.36, 0.025, 0.15), gum, 0, sy * 0.035, 0.06, jaw);
      for (let i = 0; i < 7; i++) {
        const a = ((i + 0.5) / 7) * Math.PI,
          t = mesh(new THREE.BoxGeometry(0.085, 0.16, 0.07), tooth, Math.cos(a) * 0.225, -sy * 0.1, Math.sin(a) * 0.225, jaw);
        t.rotation.y = -a + Math.PI / 2;
      }
    });
    g.scale.setScalar(1.35);
    return g;
  })(),
  boulder: (() => {
    const g = new THREE.Group();
    mesh(flat(new THREE.DodecahedronGeometry(0.5, 0)), lam(0x8f918b), 0, 0, 0, g);
    return g;
  })(),
  cake: (() => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), lam(0xf6d7a7), 0, 0, 0, g);
    mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.12, 16), lam(0xffffff), 0, 0.22, 0, g);
    mesh(new THREE.SphereGeometry(0.1, 8, 6), lam(0xd0213a), 0, 0.36, 0, g);
    return g;
  })(),
  slipper: (() => {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.3, 0.12, 0.6), lam(0x9b6b8a), 0, 0, 0, g);
    mesh(new THREE.SphereGeometry(0.16, 8, 6), lam(0xffd6e6), 0, 0.1, 0.18, g);
    return g;
  })(),
};
for (const k in projGeo) bakeTree(projGeo[k], new Set()); // an arrow is one draw call instead of three
const projPool = {}; // projectile meshes are recycled instead of cloned for every shot
function projGet(kind) {
  const pl = projPool[kind];
  const m = pl && pl.length ? pl.pop() : projGeo[kind].clone();
  m.userData.pk = kind;
  m.rotation.set(0, 0, 0);
  m.scale.set(1, 1, 1);
  m.visible = true;
  return m;
}
function projPut(m) {
  scene.remove(m);
  const k = m.userData.pk;
  if (!k) return;
  (projPool[k] || (projPool[k] = [])).length < 40 && projPool[k].push(m);
}
function shoot(kind, from, to, dur, follow) {
  const m = projGet(kind);
  scene.add(m);
  m.position.copy(from);
  fx.projs.push({
    m,
    kind,
    from: from.clone(),
    to: to.clone(),
    t: 0,
    dur: Math.max(0.12, dur),
    follow,
    arc: kind === 'boulder' || kind === 'cake' ? Math.min(12, from.distanceTo(to) * 0.55) : Math.min(4, from.distanceTo(to) * 0.18),
  });
}
