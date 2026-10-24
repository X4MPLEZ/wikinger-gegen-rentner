/* 24-unit-models.js - Unit models (low-poly, procedurally built) and the instanced drawing of all units: buildUnit() parts are collected by ubRegister and drawn per
   frame by unitBatch() (one InstancedMesh per geometry+material). Catapults, bears, riders. mergeParts/bakeTree bake details into templates. */
/* ---------- units ---------- */
const V2 = THREE.Vector2;
function lathe(profile, seg = 14) {
  return new THREE.LatheGeometry(
    profile.map(([a, b]) => new V2(a, b)),
    seg
  );
}
/* ---------- modelling helpers: rounded boxes, tapered tubes (horns, bow limbs, tails), rods between two points, spoked wheels ---------- */
let RB_LO = false; // set while the low-detail models are built: rounded boxes become plain boxes, tubes get coarser
function rbox(w, h, d, r = 0.04, n = 4) {
  // a box with rounded edges and corners (smooth normals on the rounding)
  if (RB_LO) return new THREE.BoxGeometry(w, h, d);
  const g = new THREE.BoxGeometry(w, h, d, n, n, n),
    p = g.attributes.position,
    nm = g.attributes.normal,
    hs = [w / 2, h / 2, d / 2],
    v = [0, 0, 0],
    c = [0, 0, 0],
    o = [0, 0, 0];
  r = Math.min(r, hs[0], hs[1], hs[2]) * 0.999;
  const grid = s => {
      const hi = s - r;
      return n >= 6 ? [-s, -(hi + r * 0.5), -hi, 0, hi, hi + r * 0.5, s] : [-s, -hi, 0, hi, s];
    },
    G = hs.map(grid);
  const snap = (x, a) => {
    const s = hs[a],
      t = ((x / s + 1) / 2) * n,
      j = Math.round(t);
    return Math.abs(t - j) < 1e-3 && G[a][j] !== undefined ? G[a][j] : x;
  };
  for (let i = 0; i < p.count; i++) {
    v[0] = snap(p.getX(i), 0);
    v[1] = snap(p.getY(i), 1);
    v[2] = snap(p.getZ(i), 2);
    let l = 0;
    for (let a = 0; a < 3; a++) {
      c[a] = clamp(v[a], -(hs[a] - r), hs[a] - r);
      o[a] = v[a] - c[a];
      l += o[a] * o[a];
    }
    l = Math.sqrt(l);
    if (l > 1e-6) {
      for (let a = 0; a < 3; a++) {
        o[a] /= l;
        v[a] = c[a] + o[a] * r;
      }
      nm.setXYZ(i, o[0], o[1], o[2]);
    }
    p.setXYZ(i, v[0], v[1], v[2]);
  }
  return g;
}
function taperTube(pts, rad, rs = 7) {
  // a tube along pts whose radius follows rad (0 at a tip closes it)
  if (RB_LO && pts.length > 4) {
    const keep = (a, i) => i % 2 === 0 || i === a.length - 1;
    pts = pts.filter((p, i) => keep(pts, i));
    rad = rad.filter((r, i) => keep(rad, i));
    rs = Math.max(4, Math.round(rs / 2));
  }
  const pos = [],
    idx = [],
    n = pts.length,
    T = new THREE.Vector3(),
    N = new THREE.Vector3(),
    B = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    ax = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    N.crossVectors(Math.abs(T.y) > 0.9 ? ax : up, T).normalize();
    B.crossVectors(T, N);
    for (let j = 0; j < rs; j++) {
      const a = (j / rs) * TAU,
        cs = Math.cos(a) * rad[i],
        sn = Math.sin(a) * rad[i];
      pos.push(pts[i].x + N.x * cs + B.x * sn, pts[i].y + N.y * cs + B.y * sn, pts[i].z + N.z * cs + B.z * sn);
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < rs; j++) {
      const a = i * rs + j,
        b = i * rs + ((j + 1) % rs),
        c = a + rs,
        d = b + rs;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const curvePts = (a, b, c, n = 7) => {
  const q = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c));
  return q.getPoints(n - 1);
};
function rod(par, a, b, r, mat, seg = 6) {
  const A = new THREE.Vector3(...a),
    B = new THREE.Vector3(...b),
    m = mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, par);
  m.quaternion.setFromUnitVectors(V3Y, B.sub(A).normalize());
  return m;
}
const V3Y = new THREE.Vector3(0, 1, 0);
// a cartwheel standing in the YZ plane (axle along X): tyre, rim, spokes and hub; returns the tyre mesh (the part that spins), the rest is baked into it
function spokedWheel(R, w, spokes, tyreMat, woodMat, hubMat, par, x, y, z) {
  const tyre = mesh(new THREE.TorusGeometry(R - 0.035, 0.05, 5, 18).rotateY(Math.PI / 2), tyreMat, x, y, z, par);
  tyre.scale.x = w / 0.1;
  mesh(new THREE.TorusGeometry(R - 0.09, 0.03, 4, 16).rotateY(Math.PI / 2), woodMat, 0, 0, 0, tyre);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * TAU,
      s = mesh(new THREE.BoxGeometry(0.05, R * 0.82, 0.05), woodMat, 0, Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, tyre);
    s.rotation.x = a;
  }
  mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.22, 0.14, 10).rotateZ(Math.PI / 2), woodMat, 0, 0, 0, tyre);
  mesh(new THREE.CylinderGeometry(R * 0.11, R * 0.11, 0.18, 8).rotateZ(Math.PI / 2), hubMat, 0, 0, 0, tyre);
  return tyre;
}
function makeUG() {
  return {
    // shared unit geometries; built a second time with fewer segments for the low-detail models
    body: lathe(
      [
        [0, 0],
        [0.2, 0],
        [0.218, 0.06],
        [0.215, 0.14],
        [0.205, 0.3],
        [0.2, 0.44],
        [0.185, 0.58],
        [0.16, 0.7],
        [0.12, 0.77],
        [0.07, 0.81],
        [0, 0.82],
      ],
      24
    ),
    dress: lathe(
      [
        [0, 0],
        [0.33, 0],
        [0.335, 0.04],
        [0.31, 0.12],
        [0.27, 0.3],
        [0.23, 0.46],
        [0.19, 0.64],
        [0.15, 0.78],
        [0.09, 0.88],
        [0, 0.9],
      ],
      24
    ),
    leg: new THREE.CylinderGeometry(0.058, 0.05, 0.46, 12).translate(0, -0.23, 0),
    boot: rbox(0.13, 0.1, 0.215, 0.042, 4).translate(0, -0.48, 0.035),
    arm: new THREE.CylinderGeometry(0.047, 0.04, 0.44, 12).translate(0, -0.22, 0),
    upArm: new THREE.CylinderGeometry(0.047, 0.044, 0.23, 12).translate(0, -0.115, 0),
    foreArm: new THREE.CylinderGeometry(0.044, 0.04, 0.24, 12).translate(0, -0.12, 0),
    elbow: new THREE.SphereGeometry(0.046, 10, 7),
    thigh: new THREE.CylinderGeometry(0.058, 0.054, 0.24, 12).translate(0, -0.12, 0),
    shin: new THREE.CylinderGeometry(0.054, 0.05, 0.25, 12).translate(0, -0.125, 0),
    knee: new THREE.SphereGeometry(0.055, 10, 7),
    shoulder: new THREE.SphereGeometry(0.065, 12, 9),
    hand: new THREE.SphereGeometry(0.055, 12, 9).translate(0, -0.46, 0),
    belt: new THREE.TorusGeometry(0.195, 0.03, 8, 26).rotateX(Math.PI / 2),
    head: new THREE.SphereGeometry(0.58, 32, 24),
    blob: new THREE.CircleGeometry(0.5, 18).rotateX(-Math.PI / 2),
    ring: new THREE.RingGeometry(0.78, 0.94, 32).rotateX(-Math.PI / 2),
    hpbg: new THREE.PlaneGeometry(1.14, 0.18),
    hpfg: new THREE.PlaneGeometry(1, 0.1).translate(0.5, 0, 0),
    wheel: new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14).rotateZ(Math.PI / 2),
    ear: new THREE.SphereGeometry(0.13, 14, 10).scale(0.55, 1, 0.8),
    sole: new THREE.BoxGeometry(0.142, 0.032, 0.232).translate(0, -0.53, 0.04),
    thumb: new THREE.SphereGeometry(0.026, 8, 6).translate(0.035, -0.43, 0.03),
    trim: new THREE.TorusGeometry(0.212, 0.022, 7, 28).rotateX(Math.PI / 2),
    collar: new THREE.TorusGeometry(0.1, 0.028, 8, 22).rotateX(Math.PI / 2),
    button: new THREE.SphereGeometry(0.022, 6, 5),
    bracer: new THREE.CylinderGeometry(0.056, 0.052, 0.12, 14),
    mantle: new THREE.TorusGeometry(0.2, 0.075, 10, 22, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI),
    beard: new THREE.ConeGeometry(0.34, 0.62, 16).rotateX(Math.PI),
    braid: new THREE.SphereGeometry(0.075, 12, 8),
    buckle: new THREE.BoxGeometry(0.08, 0.065, 0.03),
    cuff: new THREE.TorusGeometry(0.066, 0.03, 7, 16).rotateX(Math.PI / 2),
    wrap: new THREE.TorusGeometry(0.056, 0.012, 3, 10).rotateX(Math.PI / 2),
    hem: new THREE.CylinderGeometry(0.063, 0.063, 0.05, 14),
    sleeve: new THREE.TorusGeometry(0.046, 0.016, 6, 16).rotateX(Math.PI / 2),
    tuft: new THREE.SphereGeometry(0.06, 9, 6),
    pouch: new THREE.SphereGeometry(0.06, 9, 6).scale(0.8, 0.9, 0.45),
    armring: new THREE.TorusGeometry(0.05, 0.012, 4, 12).rotateX(Math.PI / 2),
    bead: new THREE.SphereGeometry(0.045, 10, 8),
    band: new THREE.TorusGeometry(0.545, 0.045, 8, 36).rotateX(Math.PI / 2).rotateX(0.18),
    pocket: rbox(0.09, 0.08, 0.02, 0.008, 4),
    shirtTip: new THREE.ConeGeometry(0.035, 0.08, 3),
    pearl: new THREE.SphereGeometry(0.026, 7, 5),
    apron: new THREE.CylinderGeometry(0.247, 0.33, 0.36, 16, 1, true, -0.6, 1.2),
    lace: new THREE.CylinderGeometry(0.335, 0.338, 0.035, 12, 1, true, -0.62, 1.24),
    rivet: new THREE.SphereGeometry(0.045, 7, 5),
  };
}
const UG = makeUG();
const HEAD_SCALE = 0.62,
  BIG_HEAD = 1.35;
const blobMat = basic(0x000000, 0.25),
  ringMat = basic(0xfff1a8, 0.95),
  hpBgMat = basic(0x10141f, 0.85);
const hpMats = [new THREE.MeshBasicMaterial({ color: lin(0x71c271) }), new THREE.MeshBasicMaterial({ color: lin(0xe3604c) })];
const headMats = [];
function headMat(k) {
  return headMats[k] || (headMats[k] = figMat(new THREE.MeshLambertMaterial({ map: ctex(FACE_CANVAS[k] || drawFace(k)) })));
}
const hpGroup = new THREE.Group();
hpGroup.visible = false;
scene.add(hpGroup); // per-unit bars are proxies; hpBatch() draws all of them with 2 instanced draw calls
const HPB = (() => {
  const N = 320,
    bg = new THREE.InstancedMesh(UG.hpbg, hpBgMat, N),
    fg = new THREE.InstancedMesh(UG.hpfg, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  for (const im of [bg, fg]) {
    im.count = 0;
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.renderOrder = 5;
    scene.add(im);
  }
  fg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  fg.instanceColor.setUsage(THREE.DynamicDrawUsage);
  /* setColorAt() would size it by the current count (0) */ return { N, bg, fg, m: new THREE.Matrix4(), c: new THREE.Matrix4() };
})();
/* Living units are drawn with dynamic instancing: each frame all parts that share geometry + material (e.g. every
   Berserker left arm) are written into one InstancedMesh, one set for shadow-casting near units and one for the rest.
   The real meshes stay in the scene graph for animation and matrices but sit on layer 1, which neither the camera nor
   the shadow camera renders. ~10 draw calls per unit become a few dozen for the whole army. */
/* Low-detail unit models (LOD): every kind is built once more with roughly half the segments on spheres, cylinders,
   cones, tori and lathes (about 40 % of the triangles). Light tiers draw all units with them, the other tiers only
   distant units. Same parts, same materials, so the instanced drawing just swaps the geometry. */
// Segment counts of the standard geometries are scaled while a unit model is built: halved for the low-detail models (far away, light
// tiers), raised for the full models so round shapes (helmets, bodies, wheels) look smooth up close. Only the vertex count changes: the
// low model is still paired with the full one part by part.
const SEG_ARGS = {
  SphereGeometry: [
    [1, 6, 40],
    [2, 4, 28],
  ],
  CylinderGeometry: [[3, 5, 28]],
  ConeGeometry: [[2, 4, 28]],
  TorusGeometry: [
    [2, 3, 14],
    [3, 6, 48],
  ],
  LatheGeometry: [[1, 6, 32]],
  CircleGeometry: [[1, 6, 40]],
};
function withSegments(mul, lo, fn) {
  const saved = {};
  for (const name in SEG_ARGS) {
    const C = (saved[name] = THREE[name]);
    THREE[name] = function (...a) {
      for (const [i, min, max] of SEG_ARGS[name])
        if (typeof a[i] === 'number') {
          if (lo && a[i] > min) a[i] = Math.max(min, Math.round(a[i] * mul));
          else if (!lo && a[i] < max) a[i] = Math.min(max, Math.round(a[i] * mul));
        }
      return new C(...a);
    };
  }
  if (lo) RB_LO = true;
  try {
    return fn();
  } finally {
    Object.assign(THREE, saved);
    if (lo) RB_LO = false;
  }
}
const withLowPoly = fn => withSegments(0.5, true, fn);
let SEG_HI = false;
function withHiPoly(fn) {
  if (RB_LO || SEG_HI) return fn();
  SEG_HI = true;
  try {
    return withSegments(COARSE ? 1.25 : 1.5, false, fn); // phones: a little less (many units on screen, weaker GPUs)
  } finally {
    SEG_HI = false;
  }
}
let UG_LO = null;
const LO_TPL = new Map();
function loTemplate(k) {
  const key = k + (UNIT_SKIN[k] ? '|' + UNIT_SKIN[k].id : ''); // one template per kind and skin
  if (LO_TPL.has(key)) return LO_TPL.get(key);
  let U = null;
  try {
    withLowPoly(() => {
      if (!UG_LO) UG_LO = makeUG();
      const saved = { ...UG };
      Object.assign(UG, UG_LO);
      try {
        U = buildUnit(k);
      } finally {
        Object.assign(UG, saved);
      }
    });
  } catch (_) {
    U = null;
  }
  if (U) {
    scene.remove(U.g);
    hpGroup.remove(U.hp);
  }
  LO_TPL.set(key, U);
  return U;
}
const UB = { groups: new Map(), list: [] };
function ubRegister(u) {
  const lo = loTemplate(u.k);
  if (lo) {
    const a = [],
      b = [];
    u.g.traverse(m => {
      if (m.isMesh) a.push(m);
    });
    lo.g.traverse(m => {
      if (m.isMesh) b.push(m);
    });
    if (a.length === b.length)
      a.forEach((m, i) => {
        if (b[i].geometry !== m.geometry && b[i].material === m.material) m.userData.lo = b[i].geometry;
      });
  }
  u.parts = [];
  u.g.traverse(m => {
    if (
      !m.isMesh ||
      m.isInstancedMesh ||
      m.userData.isInk ||
      m === u.blob ||
      m === u.ring ||
      Array.isArray(m.material) ||
      m.material.transparent
    )
      return;
    const g = m.geometry;
    if (!g.userData.sharedUnitGeo && !sharedDetailGeometries.has(g)) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    let inRig = false; // under u.rig? (the whole body is switched off through the rig, e.g. while the unit is a chicken)
    for (let o = m.parent; o && o !== u.g; o = o.parent) if (o === u.rig) inRig = true;
    m.userData.inRig = inRig;
    u.parts.push(m);
    m.layers.set(1);
  });
}
function ubRelease(u) {
  if (u.parts) {
    for (const m of u.parts) m.layers.set(0);
    u.parts = null;
  }
}
function ubDetach(obj) {
  obj.traverse(m => {
    if (m.isMesh) {
      m.layers.set(0);
      m.userData.ubOff = true;
    }
  });
} // a part flying off as debris renders on its own again
function ubMake(geo, mat, cast, r, cap = 16) {
  const im = new THREE.InstancedMesh(geo, mat, cap);
  im.count = 0;
  im.frustumCulled = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.castShadow = cast;
  im.receiveShadow = false;
  im.visible = false;
  scene.add(im);
  const ol = new THREE.InstancedMesh(geo, INK_TEAM, cap);
  ol.instanceMatrix = im.instanceMatrix;
  ol.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  ol.instanceColor.setUsage(THREE.DynamicDrawUsage);
  ol.count = 0;
  ol.frustumCulled = false;
  ol.castShadow = false;
  ol.visible = false;
  ol.renderOrder = -1;
  scene.add(ol);
  im.userData.ol = ol;
  return im;
}
function ubEntry(m, near, lod) {
  const geo = lod && m.userData.lo ? m.userData.lo : m.geometry;
  let gm = UB.groups.get(geo);
  if (!gm) UB.groups.set(geo, (gm = new Map()));
  let pair = gm.get(m.material);
  if (!pair) {
    const r = m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z);
    pair = [true, false].map(cast => ({ im: ubMake(geo, m.material, cast), n: 0, cap: 16, cast, r }));
    gm.set(m.material, pair);
    UB.list.push(...pair);
  }
  return pair[near ? 0 : 1];
}
function unitBatch() {
  for (const e of UB.list) e.n = 0;
  const p = V.poss || camS,
    px = p.x || 0,
    pz = p.z || 0,
    d2 = QS.shDist * QS.shDist,
    cx = camera.position.x,
    cz = camera.position.z,
    ld2 = QS.lod[0] * QS.lod[0];
  for (const list of [V.units.values(), V.dying, WW.views.values()])
    for (const u of list) {
      // dying units keep their batching during the death animation; wild sandworms batch with the tamed ones
      if (!u.parts || !u.g.visible || !u.g.parent) continue;
      const near = (u.g.position.x - px) ** 2 + (u.g.position.z - pz) ** 2 < d2,
        lod = QS.lowPoly || (u.g.position.x - cx) ** 2 + (u.g.position.z - cz) ** 2 > ld2,
        rigOff = !!u.rig && !u.rig.visible;
      for (const m of u.parts) {
        if (m.userData.ubOff || !m.visible || !m.parent || !m.parent.visible || (rigOff && m.userData.inRig)) continue;
        const e = ubEntry(m, near && !u.fogHid, lod); // nothing hidden in the fog throws a shadow into the clearing
        if (e.n >= e.cap) {
          const im = ubMake(e.im.geometry, e.im.material, e.cast, e.r, e.cap * 2);
          im.instanceMatrix.array.set(e.im.instanceMatrix.array);
          scene.remove(e.im);
          if (e.im.userData.ol) scene.remove(e.im.userData.ol);
          e.im.dispose();
          e.im = im;
          e.cap *= 2;
        }
        {
          const ol = e.im.userData.ol;
          if (ol) {
            const c = u.team === V.myTeam ? INK_OWN : INK_FOE,
              ca = ol.instanceColor.array,
              o3 = e.n * 3;
            ca[o3] = c.r;
            ca[o3 + 1] = c.g;
            ca[o3 + 2] = c.b;
          }
        }
        e.im.instanceMatrix.array.set(m.matrixWorld.elements, e.n++ * 16);
      }
    }
  for (const e of UB.list) {
    e.im.count = e.n;
    e.im.visible = e.n > 0;
    if (e.n) e.im.instanceMatrix.needsUpdate = true;
    e.im.castShadow = e.cast && e.r > QS.unitSh;
    const ol = e.im.userData.ol;
    if (ol) {
      ol.count = QS.ink ? e.n : 0;
      ol.visible = QS.ink && e.n > 0;
      if (e.n) ol.instanceColor.needsUpdate = true;
    }
  }
}
function hpBatch() {
  let n = 0;
  const { bg, fg, m, c, N } = HPB;
  for (const hp of hpGroup.children) {
    if (!hp.visible || n >= N || V.noWords) continue; // (store pictures: no bars either)
    m.compose(hp.position, hp.quaternion, hp.scale);
    for (const ch of hp.children) {
      ch.updateMatrix();
      c.multiplyMatrices(m, ch.matrix);
      if (ch.material === hpBgMat) bg.setMatrixAt(n, c);
      else {
        fg.setMatrixAt(n, c);
        fg.setColorAt(n, ch.material.color);
      }
    }
    n++;
  }
  bg.count = fg.count = n;
  if (n) {
    bg.instanceMatrix.needsUpdate = fg.instanceMatrix.needsUpdate = fg.instanceColor.needsUpdate = true;
  }
}
const UNIT_SHADOWS = true;
const lowShadows = () => false; // per-unit blob meshes are never needed: the instanced contact shadows ground every unit
function buildRider(k, parent, P, seated) {
  const torso = new THREE.Group();
  parent.add(torso);
  const vik = k === 0 || k === 1 || k === 4,
    skin = lam(P.skin || 0xefc4a6),
    dk = new THREE.Color(P.body).multiplyScalar(0.62).getHex(),
    fur = lam(0x8a6a48),
    furL = lam(0xb59368),
    leather = lam(0x6b4423),
    gold = lam(0xd9a441);
  mesh(k === 3 ? UG.dress : UG.body, lam(P.body), 0, 0.5, 0, torso);
  if (k !== 3) mesh(UG.belt, lam(P.belt || 0x3a2a1c), 0, 0.62, 0, torso);
  const mkArm = s => {
    mesh(UG.shoulder, lam(P.arm === (P.skin || 0) ? P.body : P.arm), s * 0.22, 1.22, 0, torso);
    const a = mesh(UG.upArm, lam(P.arm), s * 0.235, 1.2, 0, torso);
    a.rotation.z = s * 0.08;
    a.rotation.order = 'YXZ';
    const f = mesh(UG.foreArm, lam(P.arm), 0, -0.215, 0, a);
    mesh(UG.elbow, lam(P.arm), 0, 0, 0, f);
    mesh(UG.hand, skin, 0, 0.215, 0, f);
    return [a, f];
  };
  const [armL, foreL] = mkArm(-1),
    [armR, foreR] = mkArm(1);
  const neck = new THREE.Group();
  neck.position.y = 1.3;
  neck.scale.setScalar(HEAD_SCALE);
  torso.add(neck);
  const head = mesh(UG.head, headMat(k), 0, 0.5, 0, neck);
  const H = new THREE.Group();
  H.position.y = 0.5;
  neck.add(H);
  let legL = null,
    legR = null,
    shinL = null,
    shinR = null;
  const mkLeg = (s, par, y) => {
    const l = mesh(UG.thigh, lam(P.leg), s * 0.085, y, 0, par),
      sh = mesh(UG.shin, lam(P.leg), 0, -0.225, 0, l);
    mesh(UG.knee, lam(P.leg), 0, 0, 0, sh);
    mesh(UG.boot, lam(P.boot || 0x3b2a20), 0, 0.225, 0, sh);
    mesh(UG.sole, lam(0x1e1712), 0, 0.225, 0, sh);
    if (k === 0 || k === 4) {
      mesh(UG.cuff, fur, 0, -0.17, 0, sh);
      [-0.04, -0.1].forEach((y2, i) => {
        const w = mesh(UG.wrap, lam(0xd9c9a3), 0, y2, 0, sh);
        w.rotation.x = i ? -0.18 : 0.18;
      });
    } // fur-trimmed boots, cross-bound leg wraps
    else if (k === 1) mesh(UG.cuff, leather, 0, -0.17, 0, sh);
    else if (k === 2) mesh(UG.hem, lam(0x46474e), 0, -0.19, 0, sh); // trouser turn-ups over the shoes
    return [l, sh];
  };
  if (seated)
    [-1, 1].forEach(s => {
      const [l, sh] = mkLeg(s, torso, 0.55);
      if (k === 4) {
        l.rotation.set(-1.05, 0, s * 0.55);
        sh.rotation.x = 1.15;
      } else {
        l.rotation.set(-1.4, 0, s * 0.14);
        sh.rotation.x = 1.2;
      }
    });
  else {
    [legL, shinL] = mkLeg(-1, parent, 0.52);
    [legR, shinR] = mkLeg(1, parent, 0.52);
  }
  // detail pass: ears, thumbs, collar, cuffs, hem trim and the clothes of each kind
  [-1, 1].forEach(s2 => mesh(UG.ear, skin, s2 * 0.57, 0.5, -0.02, neck));
  [foreL, foreR].forEach((a, i) => (mesh(UG.thumb, skin, 0, 0.215, 0, a).scale.x = i ? -1 : 1));
  mesh(UG.collar, lam(dk), 0, 1.3, 0, torso);
  if (k !== 3) mesh(UG.trim, lam(dk), 0, 0.53, 0, torso);
  [foreL, foreR].forEach(a =>
    mesh(UG.sleeve, lam(P.arm === (P.skin || 0) ? dk : new THREE.Color(P.arm).multiplyScalar(0.8).getHex()), 0, -0.2, 0, a)
  ); // sleeve cuffs at the wrist
  if (k === 0 || k === 4) {
    // Viking warriors: fur cloak over the shoulders, belt with buckle and pouch, leather bracers, a gold ring on the arm
    mesh(UG.mantle, lam(k === 0 ? 0x5a3b22 : 0x6b4a2e), 0, 1.24, -0.02, torso);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / 4),
        f2 = mesh(UG.tuft, i % 2 ? fur : furL, Math.cos(a) * 0.205, 1.29, -Math.sin(a) * 0.205 + 0.04, torso);
      f2.rotation.y = a;
      f2.scale.setScalar(1.15);
    }
    mesh(UG.buckle, gold, 0, 0.62, 0.2, torso);
    mesh(UG.pouch, leather, -0.16, 0.56, 0.11, torso).rotation.y = -0.6;
    [foreL, foreR].forEach(a => mesh(UG.bracer, leather, 0, -0.085, 0, a));
    [armL, armR].forEach(a => mesh(UG.armring, gold, 0, -0.07, 0, a));
  }
  if (k === 0) {
    // red beard with moustache and two beaded braids
    const bd = mesh(UG.beard, lam(0xc8562a), 0, -0.02, 0.3, neck);
    bd.scale.set(1, 1, 0.55);
    [-1, 1].forEach(s2 => {
      const mu = mesh(UG.tuft, lam(0xb44a22), s2 * 0.13, 0.33, 0.55, neck);
      mu.scale.set(1.9, 0.75, 0.8);
      mu.rotation.z = s2 * 0.45;
      const br = mesh(UG.braid, lam(0xb44a22), s2 * 0.12, -0.38, 0.36, neck);
      br.scale.set(1, 1.6, 1);
      mesh(UG.bead, gold, s2 * 0.12, -0.24, 0.37, neck);
    });
  }
  if (k === 1) {
    // shield maiden archer: blond braid with ties, headband, quiver strap, belt with buckle and pouch, one bracer
    [0, 1, 2, 3].forEach(i => mesh(UG.braid, lam(0xe9c45a), 0, 0.28 - i * 0.16, -0.56 - i * 0.02, neck).scale.setScalar(1.15 - i * 0.12));
    mesh(UG.bead, lam(0x2f7f6f), 0, -0.36, -0.6, neck);
    mesh(UG.band, lam(0x2f7f6f), 0, 0.72, 0, neck);
    const st = mesh(new THREE.BoxGeometry(0.05, 0.62, 0.03), leather, 0, 0.98, 0.17, torso);
    st.rotation.z = 0.62;
    mesh(UG.bracer, leather, 0, -0.085, 0, foreL);
    mesh(UG.buckle, lam(0xc9ced4), 0, 0.62, 0.2, torso);
    mesh(UG.pouch, leather, 0.16, 0.56, 0.11, torso).rotation.y = 0.6;
  }
  if (k === 2) {
    // Opa: cardigan with buttons and pockets, shirt collar and bow tie
    [0.78, 0.92, 1.06].forEach(y => mesh(UG.button, lam(0xf3ead2), 0, y, 0.19, torso));
    [-1, 1].forEach(s2 => {
      const t2 = mesh(new THREE.ConeGeometry(0.05, 0.1, 6), lam(0xb03030), s2 * 0.05, 1.27, 0.1, torso);
      t2.rotation.z = (s2 * Math.PI) / 2;
      const pk = mesh(UG.pocket, lam(dk), s2 * 0.12, 0.72, 0.18, torso);
      pk.rotation.y = s2 * 0.55;
      pk.rotation.x = 0.12;
      const cl = mesh(UG.shirtTip, lam(0xf4f1e8), s2 * 0.055, 1.27, 0.09, torso);
      cl.rotation.set(2.6, 0, s2 * 0.5);
    });
    mesh(UG.button, lam(0x8f2424), 0, 1.27, 0.115, torso);
  }
  if (k === 3) {
    // Oma: shawl, pearl necklace, apron with a pocket, buttons
    mesh(UG.mantle, lam(0xd8b4d0), 0, 1.22, -0.01, torso).scale.set(1.15, 1, 1.15);
    [0.98].forEach(y => mesh(UG.button, lam(0xf6e7f0), 0, y, 0.17, torso));
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / 8);
      mesh(UG.pearl, lam(0xfbf6ef), Math.cos(a) * 0.125, 1.25 - Math.sin(a) * 0.04, Math.sin(a) * 0.11 + 0.01, torso);
    }
    mesh(UG.apron, lam(0xfbf3e4), 0, 0.78, 0, torso);
    mesh(UG.lace, lam(0xffffff), 0, 0.6, 0, torso);
    const pk = mesh(UG.pocket, lam(0xf0c6dc), 0.075, 0.7, 0.3, torso);
    pk.rotation.set(-0.23, 0.25, 0);
  }
  if (k === 5) {
    // E-Mobil racer: scarf flying behind, belt buckle
    mesh(UG.collar, lam(0xd23a2e), 0, 1.28, 0, torso).scale.setScalar(1.3);
    const sc = mesh(new THREE.BoxGeometry(0.08, 0.32, 0.03), lam(0xd23a2e), 0.08, 1.12, -0.13, torso);
    sc.rotation.x = -0.3;
    mesh(UG.buckle, lam(0xc9ced4), 0, 0.62, 0.2, torso);
    [0.82, 0.96].forEach(y => mesh(UG.button, lam(0xf3ead2), 0, y, 0.19, torso));
  }
  return { torso, armL, armR, foreL, foreR, neck, head, H, legL, legR, shinL, shinR };
}
const detailGeometryCache = new Map(),
  sharedDetailGeometries = new Set(Object.values(UG));
/* Unit mesh batching. Every rigid part of a unit (torso, each arm, each leg, hat, mount ...) becomes ONE draw call:
   plain opaque Lambert colours are moved into vertex colours so differently coloured details can share one mesh
   and one material (unitVCMat). Animated/referenced nodes keep their identity; their static children are baked in.
   Merged geometries are cached by content, so all units of one kind share them (no per-spawn geometry uploads). */
const unitVCMat = figMat(new THREE.MeshLambertMaterial({ vertexColors: true })),
  vcMat = unitVCMat;
const vcOK = m =>
  !!m &&
  (m.isMeshLambertMaterial || m.isLitFlat) &&
  !m.map &&
  !m.transparent &&
  m.opacity >= 1 &&
  !m.vertexColors &&
  m.side === THREE.FrontSide &&
  m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile &&
  (!m.emissive || m.emissive.r + m.emissive.g + m.emissive.b === 0);
function geoKey(g) {
  if (g.userData.hk) return g.userData.hk;
  const a = g.attributes.position.array,
    ix = g.index ? g.index.array : null,
    ca = g.attributes.color ? g.attributes.color.array : null;
  let h = a.length * 7 + (ix ? ix.length : 0);
  for (let i = 0; i < a.length; i++) h = (h * 31 + Math.round(a[i] * 1000)) | 0;
  if (ca) for (let i = 0; i < ca.length; i++) h = (h * 13 + Math.round(ca[i] * 255)) | 0;
  if (ix) for (let i = 0; i < ix.length; i += 3) h = (h * 17 + ix[i]) | 0;
  return (g.userData.hk = g.type[0] + h.toString(36));
}
function mergeParts(items, vc, nocache) {
  // items: [{ geo, matrix (null = identity), color }]
  const key = nocache
    ? null
    : items
        .map(
          it =>
            geoKey(it.geo) +
            (it.matrix ? ':' + it.matrix.elements.map(v => Math.round(v * 1e4)).join(',') : '') +
            (vc && !it.geo.attributes.color ? '#' + it.color.getHexString() : '')
        )
        .join('|') + (vc ? 'v' : 'm');
  let geo = key && detailGeometryCache.get(key);
  if (geo) return geo;
  const parts = items.map(it => {
    const g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
    if (it.matrix) g.applyMatrix4(it.matrix);
    return g;
  });
  geo = new THREE.BufferGeometry();
  for (const name of vc ? ['position', 'normal'] : ['position', 'normal', 'uv']) {
    if (!parts.every(p => p.attributes[name])) continue;
    const size = parts[0].attributes[name].itemSize,
      total = parts.reduce((n, p) => n + p.attributes[name].array.length, 0),
      array = new Float32Array(total);
    let offset = 0;
    for (const p of parts) {
      array.set(p.attributes[name].array, offset);
      offset += p.attributes[name].array.length;
    }
    geo.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (vc) {
    const n = geo.attributes.position.count,
      col = new Float32Array(n * 3);
    let o = 0;
    parts.forEach((p, i) => {
      const m = p.attributes.position.count;
      if (p.attributes.color) {
        col.set(p.attributes.color.array, o);
        o += m * 3;
        return;
      }
      const c = items[i].color;
      for (let j = 0; j < m; j++, o += 3) {
        col[o] = c.r;
        col[o + 1] = c.g;
        col[o + 2] = c.b;
      }
    });
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  } // parts that are already vertex-coloured keep their colours
  parts.forEach(p => p.dispose());
  geo.computeBoundingSphere();
  if (key) {
    geo.userData.sharedUnitGeo = true;
    detailGeometryCache.set(key, geo);
  }
  return geo;
}
/* Static batching for any object tree: leaf meshes under the same parent are merged (plain colours -> one
   vertex-coloured mesh, everything else per material); static leaf children are baked into a parent mesh.
   keep: nodes that must stay separate objects (animated, referenced); opts.skip: subtrees left untouched;
   opts.flat: a node whose direct children must stay separate (breakable catapult); opts.nocache: map geometry. */
function bakeTree(root, keep, opts = {}) {
  const leaf = c =>
    c.isMesh &&
    !c.children.length &&
    !c.isInstancedMesh &&
    !Array.isArray(c.material) &&
    c.scale.x * c.scale.y * c.scale.z > 0 &&
    !keep.has(c);
  const visit = parent => {
    if (opts.skip && opts.skip.has(parent)) return;
    for (const child of [...parent.children]) visit(child);
    if (parent === opts.flat) return;
    if (parent.isMesh && !parent.isInstancedMesh && vcOK(parent.material)) {
      // arm + hand + bracer -> one mesh, the arm keeps its identity
      const kids = parent.children.filter(c => leaf(c) && vcOK(c.material));
      if (kids.length) {
        kids.forEach(c => c.updateMatrix());
        parent.geometry = mergeParts(
          [
            { geo: parent.geometry, matrix: null, color: parent.material.color },
            ...kids.map(c => ({ geo: c.geometry, matrix: c.matrix, color: c.material.color })),
          ],
          true,
          opts.nocache
        );
        parent.material = vcMat;
        if (opts.nocache) parent.userData.ownedGeometry = true;
        kids.forEach(c => parent.remove(c));
      }
    }
    const buckets = new Map();
    for (const child of parent.children) {
      if (!leaf(child)) continue;
      const key = vcOK(child.material) || child.material === vcMat ? vcMat : child.material;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(child);
    }
    for (const [mat, children] of buckets) {
      if (children.length < 2) continue;
      children.forEach(c => c.updateMatrix());
      const geo = mergeParts(
          children.map(c => ({ geo: c.geometry, matrix: c.matrix, color: c.material.color })),
          mat === vcMat,
          opts.nocache
        ),
        ro = Math.max(...children.map(c => c.renderOrder));
      children.forEach(c => parent.remove(c));
      const mm = new THREE.Mesh(geo, mat);
      mm.renderOrder = ro;
      if (opts.nocache) mm.userData.ownedGeometry = true;
      parent.add(mm);
    }
  };
  visit(root);
}
function batchUnitDetails(U) {
  bakeTree(
    U.g,
    new Set(
      [
        U.head,
        U.armL,
        U.armR,
        U.foreL,
        U.foreR,
        U.legL,
        U.legR,
        U.shinL,
        U.shinR,
        U.arm,
        U.goatHead,
        ...(U.wheels || []),
        ...(U.mountLegs || []),
        ...(U.drops || []),
        ...(U.keep || []),
      ].filter(Boolean)
    ),
    { flat: U.arm ? U.rig : null }
  );
  // identical leftover parts of different units share ONE geometry (no per-spawn uploads, and they can be instanced together)
  U.g.traverse(m => {
    if (!m.isMesh || m.geometry.userData.sharedUnitGeo || sharedDetailGeometries.has(m.geometry)) return;
    const k = 'g:' + geoKey(m.geometry);
    let g = detailGeometryCache.get(k);
    if (!g) {
      g = m.geometry;
      g.userData.sharedUnitGeo = true;
      detailGeometryCache.set(k, g);
    }
    m.geometry = g;
  });
}
/* Map decoration: bake a template group once, then draw every copy with InstancedMeshes, split into spatial
   chunks so the camera and the shadow camera can cull whole chunks (r128 culls an InstancedMesh as one sphere). */
function bakeTemplate(tpl) {
  tpl.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(tpl.matrixWorld).invert(),
    buckets = new Map();
  tpl.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const k = vcOK(o.material) ? vcMat : o.material;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  });
  return [...buckets].map(([mat, list]) => ({
    mat,
    geo: mergeParts(
      list.map(o => ({ geo: o.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), color: o.material.color })),
      mat === vcMat,
      true
    ),
  }));
}
function chunkedInstances(parts, list, place, opts = {}) {
  // parts: [{ geo, mat }], place(item, i, matrix, colorOut) -> bool hasColor
  if (!list.length) return [];
  const CH = opts.chunk || 36,
    cells = new Map(),
    mt = new THREE.Matrix4(),
    col = new THREE.Color(),
    out = [],
    pos = new THREE.Vector3(),
    sc = new THREE.Vector3(),
    q = new THREE.Quaternion();
  const mats = list.map((t, i) => {
    const m4 = new THREE.Matrix4();
    const hasC = place(t, i, m4, col);
    return { m4, c: hasC ? col.clone() : null };
  });
  mats.forEach((e, i) => {
    e.m4.decompose(pos, q, sc);
    const k = Math.floor(pos.x / CH) + ',' + Math.floor(pos.z / CH);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(e);
    e.p = pos.clone();
    e.s = Math.max(sc.x, sc.y, sc.z);
  });
  for (const { geo, mat } of parts) {
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const br = geo.boundingSphere.radius + geo.boundingSphere.center.length();
    for (const cell of cells.values()) {
      const g2 = new THREE.BufferGeometry();
      for (const n in geo.attributes) g2.setAttribute(n, geo.attributes[n]);
      if (geo.index) g2.setIndex(geo.index); // shares the GPU buffers
      const c = new THREE.Vector3();
      cell.forEach(e => c.add(e.p));
      c.divideScalar(cell.length);
      let r = 0;
      cell.forEach(e => {
        r = Math.max(r, c.distanceTo(e.p) + br * e.s);
      });
      g2.boundingSphere = new THREE.Sphere(c, r);
      const im = new THREE.InstancedMesh(g2, mat, cell.length);
      cell.forEach((e, i) => {
        im.setMatrixAt(i, e.m4);
        if (e.c) im.setColorAt(i, e.c);
      });
      im.castShadow = opts.cast !== false;
      im.receiveShadow = !!opts.recv;
      if (opts.deco) im.userData.deco = true;
      if (opts.shadowTier !== undefined) im.userData.shadowTier = opts.shadowTier;
      mapGroup.add(im);
      out.push(im);
      if (opts.ink) {
        const ol = new THREE.InstancedMesh(g2, INK, cell.length);
        ol.instanceMatrix = im.instanceMatrix;
        ol.castShadow = false;
        ol.userData.ink = true;
        ol.renderOrder = -1;
        mapGroup.add(ol);
      }
    }
  }
  return out;
}
function beam(par, a, b, w, d, mat, r = 0.03) {
  const A = new THREE.Vector3(...a),
    B = new THREE.Vector3(...b),
    m = mesh(rbox(w, A.distanceTo(B), d, r, 4), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, par);
  m.quaternion.setFromUnitVectors(V3Y, B.sub(A).normalize());
  return m;
}
const ROCK_GEO = (() => {
  const g = new THREE.IcosahedronGeometry(0.25, 1),
    p = g.attributes.position;
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647,
    map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join();
    if (!map.has(key)) map.set(key, 0.82 + rnd() * 0.3);
    const f = map.get(key);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.9, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
})();
function buildCatapult(k) {
  const g = new THREE.Group(),
    rig = new THREE.Group();
  rig.scale.setScalar(1.25);
  g.add(rig);
  const vik = k === 6,
    wood = lam(vik ? 0x7a4e2a : 0xe9a3c8),
    dark = lam(vik ? 0x4a2e17 : 0xc06d9b),
    trim = lam(vik ? 0x9aa3ad : 0xffffff),
    iron = lam(vik ? 0x3d3f45 : 0xfbe9f2),
    rope = lam(vik ? 0xc8b07a : 0xfff4fa);
  const U = { g, rig, mountLegs: [], wheels: [], k, mount: null, legL: null, legR: null };
  const grp = () => {
    const q = new THREE.Group();
    rig.add(q);
    return q;
  }; // every group is one piece when it breaks apart (and one merged mesh)
  [-1, 1].forEach(s => {
    const r = grp();
    mesh(rbox(0.18, 0.2, 2.5, 0.045), wood, s * 0.62, 0.55, 0, r); // side rails with iron brackets and axle stubs
    [-1.2, 1.2].forEach(z => mesh(new THREE.BoxGeometry(0.22, 0.24, 0.08), iron, s * 0.62, 0.55, z, r));
    [-0.85, 0.85].forEach(z => mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 8).rotateZ(Math.PI / 2), iron, s * 0.76, 0.42, z, r));
  });
  {
    const d = grp();
    [-1, 0, 1].forEach(z => mesh(rbox(1.3, 0.15, 0.18, 0.04), dark, 0, 0.52, z, d));
    for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(1.08, 0.04, 0.17), wood, 0, 0.62, -0.55 + i * 0.22, d);
  } // cross beams, slatted deck
  [-1, 1].forEach(sx => [-0.85, 0.85].forEach(wz => U.wheels.push(spokedWheel(0.42, 0.16, 6, iron, dark, trim, rig, sx * 0.88, 0.42, wz))));
  [-1, 1].forEach(s => {
    const q = grp();
    const up = mesh(rbox(0.16, 1.35, 0.2, 0.035), dark, s * 0.55, 1.25, -0.2, q);
    up.rotation.x = 0.12; // uprights, braces, iron caps
    beam(q, [s * 0.55, 0.64, 0.66], [s * 0.55, 1.62, -0.12], 0.11, 0.11, wood);
    mesh(new THREE.BoxGeometry(0.2, 0.06, 0.25), iron, s * 0.55, 1.92, -0.12, q);
    beam(q, [s * 0.42, 0.62, 0.2], [s * 0.42, 1.46, 0.2], 0.14, 0.16, dark);
  }); // posts that carry the arm's axle
  {
    const q = grp();
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.25, 10).rotateZ(Math.PI / 2), trim, 0, 1.75, -0.25, q);
    mesh(rbox(0.32, 0.17, 0.17, 0.06, 4), lam(vik ? 0x8a5a3a : 0xfff1f5), 0, 1.75, -0.2, q); // stop bar with a padded buffer
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.84, 8).rotateZ(Math.PI / 2), trim, 0, 1.35, 0.2, q);
    [-0.33, -0.26, -0.19, -0.12, 0.12, 0.19, 0.26, 0.33].forEach(x =>
      mesh(new THREE.TorusGeometry(0.08, 0.032, 4, 8).rotateY(Math.PI / 2), rope, x, 1.35, 0.2, q)
    );
  } // twisted rope skeins on the axle
  const arm = new THREE.Group();
  arm.position.set(0, 1.35, 0.2);
  rig.add(arm);
  mesh(rbox(0.16, 0.16, 2.2, 0.045), wood, 0, 0, -0.9, arm);
  [-0.25, -1.45].forEach(z => mesh(new THREE.BoxGeometry(0.19, 0.19, 0.05), iron, 0, 0, z, arm));
  mesh(
    lathe(
      [
        [0, -0.11],
        [0.22, -0.09],
        [0.31, 0.03],
        [0.34, 0.13],
        [0.29, 0.14],
        [0.26, 0.05],
        [0.19, 0.01],
        [0, 0.01],
      ],
      16
    ),
    dark,
    0,
    0.1,
    -1.95,
    arm
  ); // the cup
  if (vik) {
    // rock in the cup; dragon head at the prow, painted shields along the sides, two big horns
    mesh(ROCK_GEO, lam(0x8f918b), 0, 0.33, -1.95, arm);
    const dr = grp(),
      dw = lam(0x5a3a20),
      red = lam(0xc0392b);
    beam(dr, [0, 0.62, 1.12], [0, 1.28, 1.32], 0.14, 0.16, dw);
    const hd = mesh(rbox(0.22, 0.21, 0.46, 0.07), dw, 0, 1.36, 1.44, dr);
    hd.rotation.x = -0.12;
    const jw = mesh(rbox(0.17, 0.06, 0.34, 0.025, 4), red, 0, 1.23, 1.5, dr);
    jw.rotation.x = 0.28;
    [-1, 1].forEach(s => {
      mesh(new THREE.SphereGeometry(0.045, 8, 6), lam(0xf2c14e), s * 0.1, 1.43, 1.55, dr);
      const h = mesh(new THREE.ConeGeometry(0.045, 0.24, 6), lam(0xf3ead2), s * 0.07, 1.52, 1.27, dr);
      h.rotation.x = -1.1;
      h.rotation.z = -s * 0.25;
      [1.6, 1.48].forEach(z => (mesh(new THREE.ConeGeometry(0.02, 0.07, 4), lam(0xffffff), s * 0.06, 1.27, z, dr).rotation.x = Math.PI));
    });
    for (let i = 0; i < 4; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.04, 0.14, 4), red, 0, 1.18 - i * 0.14, 1.22 - i * 0.03, dr);
      sp.rotation.x = -0.9;
    } // spines down the neck
    [-1, 1].forEach(s => {
      const q = grp();
      [-0.5, 0.5].forEach((z, i) => {
        const c2 = [0xc0392b, 0x2f6fb0, 0xe6b23a, 0xf3ead2][(s > 0 ? 2 : 0) + i];
        mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 14).rotateZ(Math.PI / 2), lam(c2), s * 0.74, 0.86, z, q);
        mesh(new THREE.TorusGeometry(0.22, 0.02, 3, 14).rotateY(Math.PI / 2), lam(0x4a3424), s * 0.745, 0.86, z, q);
        mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, 0, Math.PI / 2).rotateZ((-s * Math.PI) / 2), trim, s * 0.76, 0.86, z, q);
      });
      mesh(
        taperTube(
          curvePts([s * 0.6, 0.68, 1.22], [s * 0.86, 0.95, 1.36], [s * 0.74, 1.28, 1.5], 8),
          [0.1, 0.09, 0.077, 0.064, 0.05, 0.035, 0.02, 0.004],
          8
        ),
        lam(0xf3ead2),
        0,
        0,
        0,
        q
      );
    });
  } else {
    // a two-tier cake with cream and a cherry; icing drips along the frame, a ribbon bow at the front, lace ring on the deck
    const ck = lam(0xfff1f5),
      cr = lam(0xffffff);
    mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 18), ck, 0, 0.2, -1.95, arm);
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.11, 16), lam(0xf7c5dd), 0, 0.32, -1.95, arm);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      mesh(new THREE.SphereGeometry(0.045, 7, 5), cr, Math.cos(a) * 0.21, 0.28, -1.95 + Math.sin(a) * 0.21, arm);
    }
    mesh(new THREE.SphereGeometry(0.065, 10, 8), lam(0xd0213a), 0, 0.43, -1.95, arm);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), lam(0x4f7a2a), 0.02, 0.5, -1.95, arm).rotation.z = -0.4;
    const ic = grp();
    [-1, 1].forEach(s => {
      for (let i = 0; i < 10; i++) {
        const z = -1.12 + i * 0.25;
        mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, 0, Math.PI / 2), cr, s * 0.62, 0.65, z, ic).scale.set(1.5, 0.7, 1.3);
        if (i % 2) mesh(new THREE.SphereGeometry(0.035, 6, 5), cr, s * 0.715, 0.6, z + 0.05, ic).scale.set(0.6, 1.9, 0.9);
      }
    });
    const bw = grp(),
      rb = lam(0xd0213a);
    [-1, 1].forEach(s => {
      const c = mesh(new THREE.ConeGeometry(0.08, 0.2, 7), rb, s * 0.1, 0.82, 1.28, bw);
      c.rotation.z = (s * Math.PI) / 2;
      const t = mesh(rbox(0.05, 0.22, 0.02, 0.01, 4), rb, s * 0.05, 0.68, 1.28, bw);
      t.rotation.z = s * 0.3;
    });
    mesh(new THREE.SphereGeometry(0.05, 8, 6), rb, 0, 0.82, 1.28, bw);
    mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 28).rotateX(Math.PI / 2), cr, 0, 0.7, 0, ic);
  }
  arm.rotation.x = -0.3;
  U.arm = arm;
  const torso = new THREE.Group();
  rig.add(torso);
  const neck = new THREE.Group();
  neck.position.set(0, 1.3, 0.75);
  neck.scale.setScalar(0.001);
  torso.add(neck);
  const head = mesh(UG.head, headMat(k === 6 ? 0 : 2), 0, 0.5, 0, neck);
  Object.assign(U, {
    torso,
    neck,
    head,
    H: new THREE.Group(),
    armL: new THREE.Group(),
    armR: new THREE.Group(),
    foreL: new THREE.Group(),
    foreR: new THREE.Group(),
  });
  batchUnitDetails(U);
  shadows(g, UNIT_SHADOWS, false);
  inkify(rig);
  const blob = mesh(UG.blob, blobMat, 0, 0.05, 0, g);
  blob.scale.setScalar(2.6);
  blob.userData.ublob = true;
  blob.visible = !UNIT_SHADOWS || lowShadows();
  const ring = mesh(UG.ring, ringMat, 0, 0.07, 0, g);
  ring.visible = false;
  ring.scale.setScalar(2);
  const hp = new THREE.Group();
  mesh(UG.hpbg, hpBgMat, 0, 0, -0.01, hp);
  const hpf = mesh(UG.hpfg, hpMats[0], -0.5, 0, 0, hp);
  hp.visible = false;
  hp.scale.setScalar(1.6);
  hpGroup.add(hp);
  scene.add(g);
  return Object.assign(U, { ring, hp, hpf, blob, baseHeadMat: head.material });
}
function buildBear(k) {
  const g = new THREE.Group(),
    rig = new THREE.Group();
  rig.scale.setScalar(1.1);
  g.add(rig);
  const fur = lam(0xf3f1ea),
    furS = lam(0xe2ded2),
    dark = lam(0x222222),
    col = lam(FAC[KINDS[k].fac].col);
  const U = { g, rig, mountLegs: [], wheels: [], k, mount: null, drops: [], bear: true };
  const torso = new THREE.Group();
  rig.add(torso);
  mesh(new THREE.SphereGeometry(0.9, 16, 12), fur, 0, 1.15, 0.1, torso).scale.set(1, 0.85, 1.5);
  mesh(new THREE.SphereGeometry(0.72, 14, 10), fur, 0, 1.25, -0.75, torso).scale.set(1, 0.9, 1);
  mesh(new THREE.SphereGeometry(0.55, 12, 9), fur, 0, 1.6, 0.5, torso).scale.set(1.1, 0.72, 1.1); // shoulder hump
  mesh(new THREE.SphereGeometry(0.16, 8, 6), furS, 0, 1.38, -1.42, torso); // stubby tail
  for (let i = 0; i < 5; i++) {
    const t = mesh(new THREE.SphereGeometry(0.2, 8, 6), furS, (i - 2) * 0.17, 0.43 + Math.abs(i - 2) * 0.03, (i % 2) * 0.3 - 0.05, torso);
    t.scale.set(1, 0.55, 1.4);
  } // shaggy belly fur
  mesh(new THREE.TorusGeometry(0.5, 0.09, 6, 20), col, 0, 1.3, 1.05, torso);
  mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12).rotateX(Math.PI / 2), lam(0xf2c14e), 0, 0.88, 1.12, torso); // tag on the collar
  const neck = new THREE.Group();
  neck.position.set(0, 1.35, 1.25);
  neck.scale.setScalar(HEAD_SCALE);
  torso.add(neck);
  const head = mesh(UG.head, headMat(k), 0, 0.45, 0.15, neck);
  const H = new THREE.Group();
  H.position.set(0, 0.45, 0.15);
  neck.add(H);
  mesh(new THREE.SphereGeometry(0.26, 12, 9), fur, 0, -0.13, 0.5, H).scale.set(1, 0.8, 1.15);
  mesh(new THREE.SphereGeometry(0.085, 8, 6), dark, 0, -0.04, 0.76, H).scale.set(1.2, 0.85, 1);
  [-1, 1].forEach(sx => {
    mesh(new THREE.SphereGeometry(0.17, 9, 7), fur, sx * 0.4, 0.42, 0, H);
    mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xd8cfc0), sx * 0.4, 0.44, 0.08, H);
    const ch = mesh(new THREE.SphereGeometry(0.2, 8, 6), fur, sx * 0.42, -0.2, 0.18, H);
    ch.scale.set(0.8, 0.9, 0.8);
  });
  const leg = (x, z, front) => {
    const l = new THREE.Group();
    l.position.set(x, 1.0, z);
    torso.add(l);
    mesh(new THREE.CylinderGeometry(0.27, 0.21, 0.95, 10).translate(0, -0.47, 0), fur, 0, 0, 0, l);
    mesh(new THREE.SphereGeometry(0.25, 10, 7), fur, 0, -0.93, 0.08, l).scale.set(1, 0.55, 1.25);
    mesh(new THREE.SphereGeometry(0.2, 8, 6), furS, (x > 0 ? 1 : -1) * 0.06, front ? -0.5 : -0.35, front ? -0.12 : 0.1, l).scale.set(
      1,
      1.3,
      0.9
    ); // fur tuft at elbow / heel
    [-1, 0, 1].forEach(c => {
      const cl = mesh(new THREE.ConeGeometry(0.035, 0.16, 5), dark, c * 0.09, -0.98, 0.34, l);
      cl.rotation.x = Math.PI / 2;
    });
    return l;
  };
  const armL = leg(-0.45, 0.75, true),
    armR = leg(0.45, 0.75, true),
    legL = leg(-0.45, -0.85, false),
    legR = leg(0.45, -0.85, false);
  Object.assign(U, { torso, armL, armR, neck, head, H, legL, legR });
  batchUnitDetails(U);
  shadows(g, UNIT_SHADOWS, false);
  const blob = mesh(UG.blob, blobMat, 0, 0.05, 0, g);
  blob.scale.setScalar(2.1);
  blob.userData.ublob = true;
  blob.visible = !UNIT_SHADOWS || lowShadows();
  blob.castShadow = false;
  const ring = mesh(UG.ring, ringMat, 0, 0.07, 0, g);
  ring.visible = false;
  ring.scale.setScalar(1.6);
  ring.castShadow = false;
  const hp = new THREE.Group();
  mesh(UG.hpbg, hpBgMat, 0, 0, -0.01, hp);
  const hpf = mesh(UG.hpfg, hpMats[0], -0.5, 0, 0, hp);
  hp.visible = false;
  hp.scale.setScalar(1.3);
  hpGroup.add(hp);
  scene.add(g);
  return Object.assign(U, { ring, hp, hpf, blob, baseHeadMat: head.material });
}
function clawRibbon(off, W = 0.075) {
  const pos = [],
    N = 14,
    P = (t, e, f) => {
      const w = W * (1 - Math.abs(t) * 0.7);
      return [t * 1.15, t * 0.55 + off + e * w * (1 - f), 1.15 - 0.42 * t * t + e * w * f];
    };
  for (let i = 0; i < N - 1; i++) {
    const t0 = -1 + (2 * i) / (N - 1),
      t1 = -1 + (2 * (i + 1)) / (N - 1);
    for (const f of [0, 1]) {
      const a = P(t0, 1, f),
        b = P(t0, -1, f),
        c = P(t1, 1, f),
        d = P(t1, -1, f);
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
const clawGeo = [-0.22, 0, 0.22].map(o => clawRibbon(o)),
  clawGeoO = [-0.22, 0, 0.22].map(o => clawRibbon(o, 0.14));
function clawStreak(x, y, z, yaw, side, sc = 1, col = 0xe6f7ff) {
  const g = new THREE.Group(),
    mat = new THREE.MeshBasicMaterial({ color: lin(col), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    mo = new THREE.MeshBasicMaterial({ color: lin(0x0b4f8a), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  clawGeo.forEach((geo, i) => {
    const a = new THREE.Mesh(clawGeoO[i], mo);
    a.renderOrder = 11;
    g.add(a);
    const m2 = new THREE.Mesh(geo, mat);
    m2.renderOrder = 12;
    m2.position.y = 0.002;
    g.add(m2);
  });
  g.position.set(x, y, z);
  g.rotation.set(0, yaw, 0);
  g.scale.set(sc * 0.25 * side, sc, sc);
  scene.add(g);
  fx.claws.push({ g, mat, mo, t: 0, side, sc });
}
let CLAW_LIFE = 0.32;
function clawTick(dt) {
  for (let i = fx.claws.length - 1; i >= 0; i--) {
    const c = fx.claws[i];
    c.t += Math.min(dt, 0.05);
    const p = c.t / CLAW_LIFE;
    c.g.scale.x = c.sc * c.side * Math.min(1, 0.25 + p * 3);
    c.mat.opacity = 0.95 * Math.max(0, 1 - p * p);
    c.mo.opacity = 0.75 * Math.max(0, 1 - p * p);
    if (p >= 1) {
      scene.remove(c.g);
      c.mat.dispose();
      c.mo.dispose();
      fx.claws.splice(i, 1);
    }
  }
}
function bearRig(u, dt, moving) {
  if (u.ph === undefined) {
    u.ph = Math.random() * 10;
    u.lastAtk = 9;
    u.gait = 0;
  }
  u.ph += dt;
  u.atkT += dt;
  u.gait = lerp(u.gait || 0, moving ? 1 : 0, 1 - Math.exp(-dt * 8));
  const spd = clamp(u.speed || 0, 0, 10),
    run = clamp((spd - 4) / 3, 0, 1);
  u.walk += dt * (moving ? Math.max(2.5, spd) * 1.25 : 0);
  const w = u.walk,
    sw = u.gait,
    p0 = u.g.position,
    yaw = u.g.rotation.y,
    sc = u.g.scale.x || 1,
    A = (0.5 + 0.22 * run) * sw;
  // diagonal pairs: a fore leg moves with the opposite hind leg; a paw lifts while it swings forward
  let fl = Math.sin(w) * A,
    fr = Math.sin(w + Math.PI) * A,
    hl = Math.sin(w + Math.PI + 0.5) * A * 0.92,
    hr = Math.sin(w + 0.5) * A * 0.92,
    lean = 0,
    rear = 0,
    roll = Math.sin(w) * 0.035 * sw,
    frZ = 0,
    flZ = 0;
  const breath = Math.sin(u.ph * 1.8) * 0.008 * (1 - sw);
  if (u.atkT < u.lastAtk) {
    const side = (u.swSide = -(u.swSide || 1));
    clawStreak(p0.x + Math.sin(yaw) * 0.7 * sc, p0.y + 1.3 * sc, p0.z + Math.cos(yaw) * 0.7 * sc, yaw, side, 1.05 * sc);
  }
  u.lastAtk = u.atkT;
  if (u.clawFx > 0) {
    u.clawFx -= dt;
    const c = Math.sin(u.ph * 30);
    rear = 0.55;
    fl = -1.9 + c * 0.9;
    fr = -1.9 - c * 0.9;
    flZ = 0.35 * c;
    frZ = 0.35 * c;
    lean = 0.05;
    u.clawP = (u.clawP || 0) - dt;
    if (u.clawP <= 0) {
      u.clawP = 0.16;
      const side = (u.swSide = -(u.swSide || 1));
      clawStreak(
        p0.x + Math.sin(yaw) * 0.6 * sc,
        p0.y + 1.5 * sc,
        p0.z + Math.cos(yaw) * 0.6 * sc,
        yaw + side * 0.3,
        side,
        1.6 * sc,
        0xffffff
      );
    }
  } else if (u.atkT < 0.55) {
    const p = u.atkT / 0.55,
      s2 = u.swSide || 1;
    rear = Math.sin(p * Math.PI) * 0.45;
    const arm = p < 0.35 ? -2.4 * (p / 0.35) : lerp(-2.4, 0.4, Math.min(1, (p - 0.35) / 0.25)),
      z = p < 0.35 ? -0.5 * s2 * (p / 0.35) : lerp(-0.5 * s2, 0.6 * s2, Math.min(1, (p - 0.35) / 0.25));
    if (s2 > 0) {
      fr = arm;
      frZ = z;
    } else {
      fl = arm;
      flZ = z;
    }
    lean = p > 0.35 && p < 0.7 ? 0.22 : 0;
    roll = Math.sin(p * Math.PI) * 0.15 * s2;
  }
  if (u.flinch > 0) {
    u.flinch -= dt;
    lean -= u.flinch;
  }
  const lift = q => Math.max(0, -Math.cos(q)) * 0.1 * sw;
  u.armL.rotation.set(fl, 0, flZ);
  u.armR.rotation.set(fr, 0, frZ);
  u.legL.rotation.x = hl;
  u.legR.rotation.x = hr;
  u.armL.position.y = 1.0 + lift(w);
  u.armR.position.y = 1.0 + lift(w + Math.PI);
  u.legL.position.y = 1.0 + lift(w + Math.PI + 0.5);
  u.legR.position.y = 1.0 + lift(w + 0.5);
  u.torso.rotation.set(-rear + lean + Math.sin(2 * w) * 0.03 * sw, 0, roll);
  u.torso.scale.set(1 + breath, 1 - breath * 0.5, 1 + breath);
  u.rig.position.y = Math.abs(Math.sin(w)) * (0.05 + 0.05 * run) * sw + rear * 0.55;
  u.rig.position.z = 0;
  if (u.spin > 0) {
    u.spin -= dt;
    u.rig.rotation.y = ((0.6 - u.spin) / 0.6) * TAU * 2;
  } else u.rig.rotation.y = 0;
  u.neck.rotation.set(
    rear * 0.7 + Math.sin(w * 2 + 0.5) * 0.1 * sw - lean * 0.5 + (1 - sw) * Math.max(0, Math.sin(u.ph * 0.4 + (u.id | 0))) * 0.25,
    Math.sin(u.ph * 0.6) * 0.3 * (1 - sw * 0.8),
    -roll * 0.6
  );
  if (u.headTarget !== undefined) u.neck.scale.setScalar(lerp(u.neck.scale.x, u.headTarget, Math.min(1, dt * 6)));
  if (u.pop !== undefined) {
    u.pop += dt;
    const s = Math.min(1, u.pop / 0.3);
    u.g.scale.setScalar(s < 1 ? s * (1 + 0.35 * Math.sin(s * Math.PI)) : 1);
    if (s >= 1) delete u.pop;
  }
}
