/* ---------- Sandworm: model and animation. A segmented body (12 ringed segments) that leaves a hole in the sand and curves up to a big head:
   a three-petal maw that splits open like a flower over rings of teeth, and four jointed grabbers that reach out, close and haul prey in.
   The same model serves wild worms (world views) and tamed worm units; the pose comes from the worm's state and its time in it. */
const WORM_N = 12,
  WORM_SP = 0.95,
  WORM_R = i => 1.22 - 0.05 * i,
  WORM_L = 0.86;
const WMAT = {
  skin: 0xc9a164,
  ridge: 0x9a7446,
  spike: 0x6f5233,
  belly: 0xe6d2a2,
  shell: 0xb68f58,
  petal: 0xa8814d,
  tooth: 0xf3ead2,
  mouth: 0x3a0d0d,
  gum: 0x8f2626,
  chitin: 0x4b3a29,
  bone: 0xe9e0c8,
  sand: 0xdcb878,
  pit: 0x6b5232,
};
const WV3 = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  t: new THREE.Vector3(),
  x: new THREE.Vector3(),
  y: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  Y: new THREE.Vector3(0, 1, 0),
};
function buildWorm(k) {
  const g = new THREE.Group(),
    rig = new THREE.Group();
  g.add(rig);
  const U = {
    g,
    rig,
    mountLegs: [],
    wheels: [],
    k,
    mount: null,
    drops: [],
    worm: true,
    segs: [],
    petals: [],
    claws: [],
    tips: [],
    keep: [],
  };
  for (let i = 0; i < WORM_N; i++) {
    // body segments: an oval with a dark ridge ring, two dorsal spikes and a pale belly plate
    const r = WORM_R(i),
      m = mesh(new THREE.SphereGeometry(1, 14, 10), lam(WMAT.skin), 0, -8, 0, rig);
    m.scale.set(r, r * 0.93, WORM_L);
    m.userData.r = r;
    mesh(new THREE.TorusGeometry(0.91, 0.1, 6, 16), lam(WMAT.ridge), 0, 0, -0.6, m);
    [-0.34, 0.34].forEach(a => {
      const sp = mesh(new THREE.ConeGeometry(0.16, 0.52, 5), lam(WMAT.spike), Math.sin(a) * 0.92, Math.cos(a) * 0.9, -0.1, m);
      sp.rotation.z = -a;
    });
    mesh(new THREE.SphereGeometry(0.62, 10, 6), lam(WMAT.belly), 0, -0.55, 0.04, m).scale.set(1, 0.45, 1.08);
    U.segs.push(m);
    U.keep.push(m);
  }
  const neck = new THREE.Group();
  neck.position.y = -8;
  rig.add(neck); // head frame: +Z is where the maw points
  const hg = new THREE.SphereGeometry(1.32, 16, 12, 0, TAU, 0.95, Math.PI - 0.95).rotateX(Math.PI / 2); // open at the front: the maw
  const head = mesh(hg, lam(WMAT.shell), 0, 0, 0, neck);
  head.scale.set(1, 0.95, 1.05);
  mesh(new THREE.CircleGeometry(1.08, 18), lam(WMAT.mouth), 0, 0, 0.42, head); // gullet
  mesh(new THREE.TorusGeometry(0.98, 0.1, 6, 20), lam(WMAT.gum), 0, 0, 0.7, head); // gums at the rim
  const tooth = (par, x, y, z, dx, dy, dz, s) => {
    const t = mesh(new THREE.ConeGeometry(0.075 * s, 0.34 * s, 5), lam(WMAT.tooth), x, y, z, par);
    t.quaternion.setFromUnitVectors(WV3.Y, WV3.a.set(dx, dy, dz).normalize());
    return t;
  };
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    tooth(head, Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0.7, -Math.cos(a), -Math.sin(a), 0.35, 1.2);
  }
  for (let i = 0; i < 9; i++) {
    const a = ((i + 0.5) / 9) * TAU;
    tooth(head, Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0.5, -Math.cos(a), -Math.sin(a), 0.2, 0.95);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    mesh(new THREE.SphereGeometry(0.22, 7, 5), lam(WMAT.ridge), Math.cos(a) * 1.2, Math.sin(a) * 1.15, -0.35, head).scale.set(1, 1, 1.6);
  } // armoured brow plates
  const band = mesh(
    new THREE.TorusGeometry(1.18, 0.16, 6, 20),
    lam(k === undefined || !KINDS[k] ? 0xc59150 : FAC[KINDS[k].fac].col),
    0,
    0,
    -0.95,
    neck
  ); // collar: team colour once tamed
  for (let i = 0; i < 3; i++) {
    // the maw: three wedges of a dome that split open like a flower
    const piv = new THREE.Group();
    piv.position.z = 0.78;
    piv.rotation.z = (i * TAU) / 3;
    neck.add(piv);
    const hin = new THREE.Group();
    hin.position.y = 1.07;
    piv.add(hin);
    const pm = mesh(
      new THREE.SphereGeometry(1.07, 8, 6, (-5 * Math.PI) / 6, (2 * Math.PI) / 3, 0, Math.PI / 2).rotateX(Math.PI / 2),
      lam(WMAT.petal),
      0,
      -1.07,
      0,
      hin
    );
    pm.scale.z = 1.4;
    [-0.62, 0, 0.62].forEach(b => tooth(pm, Math.sin(b) * 0.9, Math.cos(b) * 0.9, 0.16, -Math.sin(b), -Math.cos(b), 0.5, 1));
    mesh(new THREE.ConeGeometry(0.1, 0.3, 4), lam(WMAT.spike), 0, 0.62, 0.95, pm).rotation.x = 0.5; // a little horn on each wedge
    U.petals.push(hin);
    U.keep.push(pm);
  }
  for (let j = 0; j < 4; j++) {
    // four grabbers: upper limb, lower limb, hooked tip
    const a = Math.PI / 4 + (j * Math.PI) / 2,
      piv = new THREE.Group();
    piv.position.set(Math.sin(a) * 1.16, Math.cos(a) * 1.12, 0.1);
    piv.rotation.z = -a;
    neck.add(piv);
    const up = mesh(
      new THREE.CylinderGeometry(0.13, 0.2, 1.9, 7).rotateX(Math.PI / 2).translate(0, 0, 0.95),
      lam(WMAT.chitin),
      0,
      0,
      0,
      piv
    );
    mesh(new THREE.SphereGeometry(0.23, 7, 5), lam(WMAT.chitin), 0, 0, 0, up);
    mesh(new THREE.SphereGeometry(0.17, 7, 5), lam(WMAT.ridge), 0, 0, 1.9, up);
    mesh(new THREE.SphereGeometry(0.2, 7, 5), lam(WMAT.chitin), 0, 0.05, 0.95, up).scale.set(1, 0.8, 2.2); // a muscled upper limb
    [0.5, 1.0, 1.45].forEach(z => (mesh(new THREE.ConeGeometry(0.06, 0.24, 4), lam(WMAT.bone), 0, -0.17, z, up).rotation.x = Math.PI)); // spines on the inner side
    const lo = mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 1.6, 6).rotateX(Math.PI / 2).translate(0, 0, 0.8),
      lam(WMAT.chitin),
      0,
      0,
      1.9,
      up
    );
    const hk = mesh(new THREE.ConeGeometry(0.15, 0.75, 6).rotateX(Math.PI / 2).translate(0, 0, 0.37), lam(WMAT.bone), 0, 0, 1.5, lo);
    hk.rotation.x = 0.8;
    [-1, 1].forEach(sx => {
      const b2 = mesh(
        new THREE.ConeGeometry(0.07, 0.35, 4).rotateX(Math.PI / 2).translate(0, 0, 0.17),
        lam(WMAT.bone),
        sx * 0.08,
        0,
        1.2,
        lo
      );
      b2.rotation.set(0.9, sx * 0.5, 0);
    }); // hook and barbs
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.3, 1.7);
    lo.add(tip);
    U.claws.push({ piv, up, lo, a });
    U.tips.push(tip);
    U.keep.push(up, lo);
  }
  // sand: the moving mound over a tunnelling worm and the crater rim around its hole
  const mound = mesh(new THREE.SphereGeometry(1.6, 12, 6, 0, TAU, 0, Math.PI / 2), lam(WMAT.sand), 0, 0, 0, g);
  mound.scale.set(1, 0.32, 1.45);
  mound.visible = false;
  const rim = mesh(new THREE.TorusGeometry(1.55, 0.42, 6, 18).rotateX(Math.PI / 2), lam(WMAT.sand), 0, 0.05, 0, g);
  rim.scale.set(1, 1, 0.45);
  rim.visible = false;
  const pit = mesh(new THREE.CircleGeometry(1.45, 18).rotateX(-Math.PI / 2), lam(WMAT.pit), 0, 0.06, 0, g);
  pit.visible = false;
  Object.assign(U, { neck, head, H: neck, band, mound, rim, pit });
  U.keep.push(head, band, mound, rim, pit);
  batchUnitDetails(U);
  shadows(g, UNIT_SHADOWS, false);
  U.headMeshes = [];
  neck.traverse(m => {
    if (m.isMesh) U.headMeshes.push(m);
  }); // batched parts only look at their own and their parent's visibility
  const blob = mesh(UG.blob, blobMat, 0, 0.05, 0, g);
  blob.scale.setScalar(3);
  blob.userData.ublob = true;
  blob.visible = false;
  blob.castShadow = false;
  const ring = mesh(UG.ring, ringMat, 0, 0.07, 0, g);
  ring.visible = false;
  ring.scale.setScalar(2.2);
  ring.castShadow = false;
  const hp = new THREE.Group();
  mesh(UG.hpbg, hpBgMat, 0, 0, -0.01, hp);
  const hpf = mesh(UG.hpfg, hpMats[0], -0.5, 0, 0, hp);
  hp.visible = false;
  hp.scale.setScalar(1.6);
  hpGroup.add(hp);
  // the trembling ring: where it will burst out and how far its grabbers reach (transparent, drawn on its own)
  const warn = new THREE.Group();
  warn.visible = false;
  g.add(warn);
  const wr = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: lin(0xffa64d), transparent: true, opacity: 0.5, depthWrite: false })
  );
  wr.renderOrder = 6;
  warn.add(wr);
  const wd = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: lin(0x6b3a14), transparent: true, opacity: 0.2, depthWrite: false })
  );
  wd.renderOrder = 5;
  warn.add(wd);
  scene.add(g);
  return Object.assign(U, { ring, hp, hpf, blob, baseHeadMat: head.material, warn, wr, wd, trail: [], wP: { ws: 'crawl', st: 9 } });
}
// world position -> worm local (the view's group stands on the ground, turned by yaw)
function wormLocal(u, wx, wz, out) {
  const g = u.g.position,
    c = Math.cos(u.g.rotation.y),
    s = Math.sin(u.g.rotation.y),
    dx = wx - g.x,
    dz = wz - g.z;
  return out.set(dx * c - dz * s, 0, dx * s + dz * c);
}
// spine: a polyline from the head backwards; segments sit at fixed arc lengths from the head
const WSPINE = {
  p: Array.from({ length: 40 }, () => new THREE.Vector3()),
  l: new Float32Array(40),
  seg: Array.from({ length: WORM_N + 1 }, () => new THREE.Vector3()),
  crawl: Array.from({ length: WORM_N + 1 }, () => new THREE.Vector3()),
  tan: Array.from({ length: WORM_N + 1 }, () => new THREE.Vector3()),
};
function spineFromPoly(n, out) {
  const P = WSPINE.p,
    L = WSPINE.l;
  L[0] = 0;
  for (let i = 1; i < n; i++) L[i] = L[i - 1] + P[i].distanceTo(P[i - 1]);
  let j = 1;
  for (let s = 0; s <= WORM_N; s++) {
    const want = s === 0 ? 0 : 0.7 + (s - 1) * WORM_SP;
    while (j < n - 1 && L[j] < want) j++;
    const a = P[j - 1],
      b = P[j],
      seg = Math.max(1e-4, L[j] - L[j - 1]);
    out[s].copy(a).lerp(b, clamp((want - L[j - 1]) / seg, 0, 1.5));
  }
}
function holeSpine(Hp, Hd, sway, t, surf = 0, side = 1) {
  // a cubic from below the hole up to the head; the rest of the body hangs straight down or (surf) ploughs on in an arc just under the surface
  const P = WSPINE.p,
    A = WV3.a.set(sway * 0.25, -1.4, 0),
    C1 = WV3.b.set(sway * 0.4, 1.4, -0.1),
    C2 = WV3.c.copy(Hd).multiplyScalar(-2.6).add(Hp);
  C2.x += sway * 0.6;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const q = 1 - i / (n - 1),
      u = 1 - q;
    P[i]
      .set(0, 0, 0)
      .addScaledVector(A, u * u * u)
      .addScaledVector(C1, 3 * u * u * q)
      .addScaledVector(C2, 3 * u * q * q)
      .addScaledVector(Hp, q * q * q);
    P[i].x += Math.sin(t * 1.3 + i * 0.35) * 0.12 * (1 - q);
  }
  for (let i = 0; i < 14; i++) {
    const sA = (i + 1) * WORM_SP,
      q = P[n + i];
    q.set(A.x, A.y - sA, A.z - (i + 1) * 0.1);
    if (surf > 0) {
      const an = sA / 3.1,
        ax = A.x + side * 3.1 * (1 - Math.cos(an)),
        az = A.z - 3.1 * Math.sin(an),
        ay = lerp(A.y, -0.12, Math.min(1, sA / 1.3)) + 0.4 * Math.sin(t * 2.4 - sA * 1.15) * Math.min(1, sA / 1.6);
      q.x = lerp(q.x, ax, surf);
      q.y = lerp(q.y, ay, surf);
      q.z = lerp(q.z, az, surf);
    }
  }
  spineFromPoly(n + 14, WSPINE.seg);
}
function crawlSpine(u, Hp, Hd, slither, speed) {
  // worm on the surface: the neck bends down into the sand, the body swims half-buried along its trail like in Dune
  const P = WSPINE.p,
    n0 = 10,
    C = WV3.a.set(0, -0.35, -1.6),
    C2 = WV3.b.copy(Hd).multiplyScalar(-1.6).add(Hp),
    C1 = WV3.c.set(0, 1.3, -0.8);
  for (let i = 0; i < n0; i++) {
    const q = 1 - i / (n0 - 1),
      v = 1 - q;
    P[i]
      .set(0, 0, 0)
      .addScaledVector(C, v * v * v)
      .addScaledVector(C1, 3 * v * v * q)
      .addScaledVector(C2, 3 * v * q * q)
      .addScaledVector(Hp, q * q * q);
  }
  let n = n0;
  const tr = u.trail,
    L = WV3.t;
  for (let i = 0; i < tr.length && n < 34; i++) {
    wormLocal(u, tr[i].x, tr[i].z, L);
    if (Math.hypot(L.x, L.z) < 1.9) continue;
    P[n++].set(L.x, 0.25, L.z);
  }
  const lx = P[n - 1].x,
    lz = P[n - 1].z;
  for (let i = 1; n < 40; i++) P[n++].set(lx, 0.25, lz - i * 0.95);
  spineFromPoly(n, WSPINE.crawl);
  const gp = u.g.position,
    c = Math.cos(u.g.rotation.y),
    s = Math.sin(u.g.rotation.y),
    mv = Math.min(1, speed / 2.5);
  for (let k = 1; k <= WORM_N; k++) {
    const p = WSPINE.crawl[k],
      r = WORM_R(k - 1),
      sArc = 0.7 + (k - 1) * WORM_SP;
    p.x += Math.sin(slither * 0.5 - sArc * 0.8) * 0.35 * mv;
    if (k > 2) {
      const wx = gp.x + p.x * c + p.z * s,
        wz = gp.z - p.x * s + p.z * c;
      p.y = groundY(wx, wz) - gp.y + r * (-0.22 + 0.32 * Math.sin(slither - sArc * 1.35)) + (k < 4 ? (4 - k) * 0.3 : 0);
    }
  }
}
function wormOrient(obj, t) {
  // local +Z along t, back (+Y) up where possible
  const x = WV3.x;
  if (Math.abs(t.y) < 0.85) x.crossVectors(WV3.up, t).normalize();
  else x.set(1, 0, 0).addScaledVector(t, -t.x).normalize();
  const y = WV3.y.crossVectors(t, x);
  WV3.m.makeBasis(x, y, t);
  obj.quaternion.setFromRotationMatrix(WV3.m);
}
// pose of the part out of the hole: head height h, reach forward f, pitch (0 straight ahead, + to the sky), maw opening, grabber reach/grip/haul
function wormHolePose(st, ws, t, bite) {
  const o = { h: 5, f: 1, pitch: -0.3, jaw: 0.2, reach: 0.1, grip: 0, carry: 0, out: 1, sway: Math.sin(t * 0.9) };
  if (ws === 'strike') {
    const e = sstep(0, 0.3, st),
      over = st < 0.5 ? Math.sin(Math.min(1, st / 0.5) * Math.PI) * 0.7 : 0;
    o.h = lerp(-3.2, 5.3, e) + over;
    o.f = lerp(0.2, 1.7, e);
    o.pitch = lerp(1.35, -0.55, sstep(0.08, 0.32, st));
    o.out = e;
    o.jaw =
      st < 0.3
        ? sstep(0.02, 0.2, st)
        : st < 1.3
          ? 0.85 + 0.15 * Math.sin(st * 9)
          : st < 1.42
            ? 1 - sstep(1.3, 1.42, st)
            : 0.18 * sstep(1.5, 1.9, st);
    o.reach = st < 0.26 ? sstep(0.04, 0.24, st) : st < 0.4 ? 1 : 1 - sstep(0.4, 1.25, st) * 0.85;
    o.grip = sstep(0.27, 0.4, st);
    o.carry = sstep(0.42, 1.25, st);
    if (st > 0.45) {
      const r = sstep(0.45, 1.25, st) * (1 - sstep(1.45, 1.9, st));
      o.h += 0.9 * r;
      o.f -= 0.7 * r;
      o.pitch = lerp(o.pitch, 0.95, r);
    }
    if (st > 1.42) {
      o.pitch = lerp(o.pitch, -0.3, sstep(1.42, 1.9, st));
      o.grip = 1 - sstep(1.45, 1.8, st);
      o.carry *= 1 - sstep(1.45, 1.8, st);
    }
  } else if (ws === 'up') {
    o.h = 4.3 + 0.3 * Math.sin(t * 1.3);
    o.f = 1 + 0.35 * Math.sin(t * 0.7);
    o.pitch = -0.35 + 0.12 * Math.sin(t * 0.9);
    o.jaw = 0.2 + 0.25 * Math.max(0, Math.sin(t * 2.3));
    o.reach = 0.12 + 0.1 * Math.sin(t * 3.1);
  } else if (ws === 'hero') heroWormPose(st, t, o);
  else if (ws === 'dive') {
    const q = sstep(0, 0.8, st);
    o.h = lerp(5, -3.5, q) + Math.sin(q * Math.PI) * 1.2;
    o.f = lerp(1, 6.5, q);
    o.pitch = lerp(-0.3, -1.45, sstep(0, 0.55, st));
    o.jaw = 0;
    o.reach = 0;
    o.out = 1 - sstep(0.55, 0.8, st);
  }
  if (bite >= 0 && (ws === 'up' || ws === 'crawl')) {
    const b = bite < 0.32 ? sstep(0, 0.32, bite) : 1 - sstep(0.32, 0.65, bite);
    o.f += 2.3 * b;
    o.h -= (ws === 'up' ? 2.2 : 0.7) * b;
    o.pitch -= 0.55 * b;
    o.jaw = bite < 0.3 ? lerp(o.jaw, 1, sstep(0, 0.2, bite)) : bite < 0.38 ? 0 : o.jaw;
    o.reach = Math.max(o.reach, 0.7 * b);
    o.grip = bite > 0.3 && bite < 0.5 ? 1 : 0;
  }
  return o;
}
function wormRig(u, dt, moving) {
  const W = u.wP || (u.wP = { ws: 'crawl', st: 9 }),
    t = (u.ph = (u.ph || 0) + dt);
  W.st += dt;
  if (u.atkT !== undefined) u.atkT += dt;
  const sinking = (W.ws === 'under' || W.ws === 'dive') && W.from === 'crawl' && W.st < 0.55,
    rising = W.ws === 'crawl' && W.from === 'under' && W.st < 0.6;
  const ws = sinking ? 'crawl' : W.ws === 'dive' && W.from === 'crawl' ? 'under' : W.ws,
    hidden = ws === 'under' || ws === 'warn',
    crawl = ws === 'crawl',
    bite = u.atkT < 0.7 ? u.atkT : -1;
  let o;
  if (crawl) {
    o = wormHolePose(0, 'crawl', t, bite);
    o.h = 1.85 + 0.15 * Math.sin(t * 1.7) + (o.h - 5) * 0.5;
    if (bite < 0) o.jaw = 0.08 + 0.12 * Math.max(0, Math.sin(t * 1.9));
  } else o = wormHolePose(W.st, ws, t, bite);
  if (sinking) {
    const q = sstep(0, 0.55, W.st);
    o.pitch = lerp(o.pitch, -1.25, q);
    o.h -= 1.6 * q;
    o.f += 1.2 * q;
    o.jaw = lerp(o.jaw, 0.6, q);
  } // head first into the dune
  if (W.dieT !== undefined) {
    const q = sstep(0, 1.4, W.dieT);
    o.h -= 6.5 * q;
    o.pitch = lerp(o.pitch, -1.2, q);
    o.jaw = 0.6 * (1 - q);
    o.reach = 0;
    o.sway = Math.sin(W.dieT * 11) * 1.4 * (1 - q);
  }
  if (W.tame !== undefined) {
    const k = W.tame,
      sink = sstep(0, BEAR_COLLAPSE, k) * (1 - sstep(BEAR_COLLAPSE + BEAR_GLOW, BEAR_TAME, k));
    o.h -= 2.6 * sink;
    o.pitch = lerp(o.pitch, -0.9, sink);
    o.jaw = lerp(o.jaw, 0, sink);
    o.reach = 0;
    o.sway = Math.sin(t * 7) * 0.5 * sink;
  }
  const Hp = WV3.t.set(Math.sin(t * 0.7) * 0.35 * o.sway + (o.hx || 0), o.h, o.f).clone(),
    Hd = new THREE.Vector3(0, Math.sin(o.pitch), Math.cos(o.pitch));
  // the trail a surfaced worm leaves in the sand
  const gp = u.g.position,
    tr = u.trail || (u.trail = []);
  if (!crawl) tr.length = 0;
  else {
    const d0 = tr.length ? Math.hypot(tr[0].x - gp.x, tr[0].z - gp.z) : 9;
    if (d0 > 6) tr.length = 0;
    if (!tr.length || d0 > 0.45) {
      tr.unshift({ x: gp.x, z: gp.z });
      if (tr.length > 30) tr.pop();
    }
  }
  W.cb = clamp((W.cb ?? (crawl ? 1 : 0)) + (crawl ? 1 : -1) * dt * 2.2, 0, 1);
  const S = WSPINE.seg,
    T = WSPINE.tan;
  if (W.cb < 1)
    holeSpine(
      Hp,
      Hd,
      o.sway,
      t,
      ws === 'up' || ws === 'hero' || W.tame !== undefined || W.dieT !== undefined
        ? 1
        : ws === 'strike'
          ? sstep(0.5, 1.4, W.st)
          : ws === 'dive'
            ? 1 - sstep(0, 0.45, W.st)
            : 0,
      (u.wid ?? u.id ?? 0) % 2 ? 1 : -1
    );
  if (W.cb > 0) {
    u.slither = (u.slither || 0) + dt * (1.4 + (u.speed || 0) * 1.6);
    crawlSpine(u, Hp, Hd, u.slither, u.speed || 0);
    for (let k = 0; k <= WORM_N; k++) {
      if (W.cb >= 1) S[k].copy(WSPINE.crawl[k]);
      else S[k].lerp(WSPINE.crawl[k], W.cb);
    }
  }
  for (let k = 0; k <= WORM_N; k++) {
    T[k].copy(S[Math.max(0, k - 1)]).sub(S[Math.min(WORM_N, k + 1)]);
    if (T[k].lengthSq() < 1e-8) T[k].set(0, 1, 0);
    T[k].normalize();
  }
  const bulge = W.gulp !== undefined ? W.gulp : -9; // a swallowed lump travels down the body
  for (let i = 0; i < WORM_N; i++) {
    const sg = u.segs[i],
      p = S[i + 1],
      r = sg.userData.r,
      sArc = 0.7 + i * WORM_SP,
      bl = 1 + 0.42 * (1 + (W.gulpK || 0)) * Math.exp(-(((sArc - bulge) / 1.1) ** 2));
    sg.position.copy(p);
    wormOrient(sg, T[i + 1]);
    sg.scale.set(r * bl, r * 0.93 * bl, WORM_L * (1 + 0.05 * Math.sin(t * 2.2 - i * 0.6)));
    sg.visible = !hidden && (crawl || p.y > -r * 1.1 - 0.4);
  }
  const nk = u.neck,
    hv = !hidden && (crawl || o.h > -1.5);
  nk.position.copy(S[0]);
  wormOrient(nk, Hd);
  nk.visible = hv;
  if (u.headMeshes) for (const m of u.headMeshes) m.visible = hv;
  {
    const hs = u.headTarget > HEAD_SCALE ? 1.12 : 1;
    nk.scale.setScalar(lerp(nk.scale.x, hs, Math.min(1, dt * 6)));
  }
  u.petals.forEach((h, i) => {
    h.rotation.x = -o.jaw * 1.25 - (o.jaw > 0.1 ? 0.05 * Math.sin(t * 3 + i * 2.1) : 0);
  });
  u.claws.forEach((c, j) => {
    const ph = t * 2.4 + j * 1.7,
      reach = clamp(o.reach + 0.05 * Math.sin(ph), 0, 1),
      held = u.held && u.held[j] ? 1 : 0,
      grip = Math.max(o.grip, held);
    c.up.rotation.x = lerp(-2.75, -0.55, reach) + grip * 0.35 + 0.06 * Math.sin(ph) - o.carry * 0.25;
    c.lo.rotation.x = lerp(0.35, 0.05, reach) + grip * 1.15 + o.carry * 0.35;
  });
  // sand: the mound while it tunnels, the crater while it is out
  u.mound.visible = hidden || (ws === 'strike' && W.st < 0.25);
  u.rim.visible = u.pit.visible = !hidden && !crawl && o.out > 0.05;
  if (u.mound.visible) {
    const wq = ws === 'warn' ? Math.min(1, W.st / 0.9) : 0,
      sw = 1 + wq * 0.35 + (ws === 'under' ? 0.08 * Math.sin(t * 6) : 0);
    u.mound.scale.set(sw, (0.28 + wq * 0.25) * (1 + 0.15 * Math.sin(t * (ws === 'warn' ? 40 : 7))), 1.4 * sw);
    u.mound.position.y = ws === 'strike' ? -W.st * 4 : 0;
  }
  if (u.rim.visible) {
    const e = Math.min(1, o.out * 1.5);
    u.rim.scale.set(e, e, 0.45 * e);
    u.pit.scale.setScalar(e);
  }
  u.rig.position.y = sinking ? -2.6 * sstep(0, 0.55, W.st) : rising ? -2.6 * (1 - sstep(0, 0.6, W.st)) : 0; // ploughs into / out of the sand
  u.hpY = hidden ? 1.8 : crawl ? 3.4 : Math.max(2.4, o.h + 2.2);
}
// bearded axe blade (shape: x = out from the haft, y = along it), the cutting edge points to +Y, the blade runs along the haft (+Z)
const AXE_BLADE = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.07);
  s.lineTo(0.06, 0.1);
  s.quadraticCurveTo(0.15, 0.15, 0.21, 0.2);
  s.quadraticCurveTo(0.29, 0.0, 0.21, -0.22);
  s.quadraticCurveTo(0.13, -0.14, 0.07, -0.08);
  s.lineTo(0, -0.06);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.007,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -0.016);
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.computeVertexNormals();
  return g;
})();
const BOW_LIMB = (() => {
  const c = new THREE.CatmullRomCurve3(
      [
        [-0.56, 0.37],
        [-0.5, 0.315],
        [-0.37, 0.355],
        [-0.2, 0.44],
        [-0.06, 0.494],
        [0, 0.5],
        [0.06, 0.494],
        [0.2, 0.44],
        [0.37, 0.355],
        [0.5, 0.315],
        [0.56, 0.37],
      ].map(([x, y]) => new THREE.Vector3(x, y, 0))
    ),
    pts = c.getPoints(24);
  return taperTube(
    pts,
    pts.map(p => 0.007 + 0.021 * Math.pow(1 - Math.min(1, Math.abs(p.x) / 0.56), 0.7)),
    6
  );
})();
// a unit model in its team's skin (UNIT_SKIN, set per match by setSkins in 65-profile.js): the skin swaps colours while it is built
function buildUnit(k) {
  const sk = UNIT_SKIN[k];
  if (!sk || LAM_MAP || SKIN_NOW) return buildUnitRaw(k);
  return buildSkinned(k, sk.id);
}
// a unit model in any skin (also for the previews in the profile): colour swaps plus the skin's extra pieces
function buildSkinned(k, id) {
  const m0 = LAM_MAP,
    s0 = SKIN_NOW;
  LAM_MAP = SKIN_MAPS[id] || null;
  SKIN_NOW = SKINS[id] && SKINS[id].sw ? id : null;
  try {
    return buildUnitRaw(k);
  } finally {
    LAM_MAP = m0;
    SKIN_NOW = s0;
  }
}
function buildUnitRaw(k) {
  return withHiPoly(() => buildUnitRaw0(k)); // full models get rounder shapes (more segments), low-detail ones fewer
}
function buildUnitRaw0(k) {
  if (KINDS[k].worm) return buildWorm(k);
  if (KINDS[k].bear) return buildBear(k);
  if (KINDS[k].role === 'siege') return buildCatapult(k);
  const g = new THREE.Group();
  const P0 = {
    0: { body: 0x326a9e, leg: 0x5a4330, arm: 0xefbf98, skin: 0xefbf98, boot: 0x4a3424 },
    1: { body: 0x58a0c8, leg: 0x5a4330, arm: 0x58a0c8, skin: 0xf5cfb0, boot: 0x5b3d27 },
    2: { body: 0x995a8d, leg: 0x55565e, arm: 0x995a8d, belt: 0x5d3b58, skin: 0xefc4a6, boot: 0x4a3020 },
    3: { body: 0xc47aa9, leg: 0xd9b8a0, arm: 0xc47aa9, skin: 0xf2cbb4, boot: 0x5a3048 },
    4: { body: 0x396f9e, leg: 0x5a4330, arm: 0xf0c39c, skin: 0xf0c39c, boot: 0x4a3424 },
    5: { body: 0x83517d, leg: 0x55565e, arm: 0x83517d, belt: 0x4e3250, skin: 0xecc1a3 },
  }[k];
  // the skin's swaps already here, so shades derived from these colours (sleeves, dark trims) follow the skin
  const P = LAM_MAP ? Object.fromEntries(Object.entries(P0).map(([n, c]) => [n, LAM_MAP.has(c) ? LAM_MAP.get(c) : c])) : P0;
  const rig = new THREE.Group();
  rig.scale.setScalar(1.25);
  g.add(rig);
  const U = { g, rig, mountLegs: [], wheels: [], k, mount: null, drops: [] };
  const steel = lam(0x9aa3ad),
    steelD = lam(0x6f7882),
    steelL = lam(0xd3d8de),
    wood = lam(0x6b4423),
    leather = lam(0x5a3a22),
    gold = lam(0xd9a441),
    bone = lam(0xf3ead2),
    dark = lam(0x2a2a30);
  if (k === 4) {
    // mountain goat: barrel body with a shaggy fringe, short neck, horned head with a beard, jointed legs with hooves, saddle blanket
    const goat = new THREE.Group();
    rig.add(goat);
    U.mount = goat;
    const coat = lam(0xebe5d6),
      coatD = lam(0xd5cdb9),
      hoof = lam(0x3a3028),
      horn = lam(0x8a7d66);
    mesh(
      lathe(
        [
          [0, -0.62],
          [0.16, -0.58],
          [0.25, -0.44],
          [0.29, -0.2],
          [0.29, 0.1],
          [0.27, 0.34],
          [0.21, 0.52],
          [0.1, 0.62],
          [0, 0.64],
        ],
        14
      ).rotateX(Math.PI / 2),
      coat,
      0,
      0.9,
      0,
      goat
    );
    for (let i = 0; i < 4; i++) {
      const f = mesh(UG.tuft, i % 2 ? coatD : coat, i % 2 ? 0.1 : -0.1, 0.66, -0.3 + i * 0.2, goat);
      f.scale.set(1.8, 1.2, 1.9);
    } // shaggy belly fringe
    [-1, 1].forEach(s => {
      const f = mesh(UG.tuft, coatD, s * 0.08, 0.8, 0.52, goat);
      f.scale.set(1.5, 1.6, 1.2);
    });
    mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.34, 10), coat, 0, 1.02, 0.5, goat).rotation.x = 0.75; // neck
    const gH = new THREE.Group();
    gH.position.set(0, 1.1, 0.55);
    goat.add(gH);
    U.goatHead = gH; // neck joint: the head bobs with the gallop and lowers for the butt
    mesh(new THREE.SphereGeometry(0.15, 10, 8), coat, 0, 0.12, 0.1, gH).scale.set(0.95, 1, 1.15);
    const sn = mesh(new THREE.SphereGeometry(0.11, 10, 8), coat, 0, 0.03, 0.27, gH);
    sn.scale.set(0.82, 0.72, 1.3);
    sn.rotation.x = 0.35;
    mesh(new THREE.SphereGeometry(0.04, 8, 6), lam(0x9c6b6b), 0, 0.02, 0.41, gH).scale.set(1.2, 0.8, 0.8);
    mesh(new THREE.ConeGeometry(0.055, 0.2, 7), lam(0xd8d0be), 0, -0.12, 0.3, gH).rotation.x = Math.PI + 0.25; // beard
    [-1, 1].forEach(s => {
      mesh(new THREE.SphereGeometry(0.04, 7, 5), lam(0xfaf6ea), s * 0.1, 0.17, 0.2, gH);
      mesh(new THREE.SphereGeometry(0.024, 5, 4), lam(0x1a1a1a), s * 0.118, 0.175, 0.224, gH);
      const ear = mesh(new THREE.SphereGeometry(0.07, 7, 5), lam(0xd6cfbf), s * 0.17, 0.17, 0.03, gH);
      ear.scale.set(1.6, 0.42, 0.8);
      ear.rotation.z = s * 0.45;
      mesh(
        taperTube(
          curvePts([s * 0.06, 0.24, 0.07], [s * 0.13, 0.46, -0.05], [s * 0.17, 0.36, -0.28], 8),
          [0.045, 0.04, 0.034, 0.027, 0.02, 0.014, 0.008, 0.003],
          7
        ),
        horn,
        0,
        0,
        0,
        gH
      );
    });
    const tail = new THREE.Group();
    tail.position.set(0, 1.08, -0.6);
    goat.add(tail);
    mesh(new THREE.ConeGeometry(0.06, 0.14, 6).translate(0, 0.07, 0), coat, 0, 0, 0, tail).rotation.x = -0.6;
    mesh(UG.tuft, coat, 0, 0.1, -0.06, tail).scale.set(1.1, 1.5, 1.1);
    U.tail = tail;
    (U.keep || (U.keep = [])).push(tail);
    [
      [-0.15, 0.4],
      [0.15, 0.4],
      [-0.15, -0.4],
      [0.15, -0.4],
    ].forEach(([lx, lz]) => {
      const l = mesh(new THREE.CylinderGeometry(0.07, 0.042, 0.42, 7).translate(0, -0.21, 0), coatD, lx, 0.7, lz, goat);
      mesh(new THREE.SphereGeometry(0.048, 7, 5), coatD, 0, -0.41, 0, l);
      mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.22, 6), coatD, 0, -0.52, 0, l);
      mesh(new THREE.CylinderGeometry(0.045, 0.053, 0.075, 8), hoof, 0, -0.64, 0.005, l);
      U.mountLegs.push(l);
    });
    mesh(new THREE.CylinderGeometry(0.306, 0.306, 0.6, 12, 1, true, Math.PI - 1.08, 2.16).rotateX(Math.PI / 2), gold, 0, 0.9, -0.05, goat); // saddle blanket with a gold edge
    mesh(
      new THREE.CylinderGeometry(0.318, 0.318, 0.54, 12, 1, true, Math.PI - 1, 2).rotateX(Math.PI / 2),
      lam(0xa0362c),
      0,
      0.9,
      -0.05,
      goat
    );
    mesh(rbox(0.3, 0.07, 0.32, 0.03, 4), leather, 0, 1.2, -0.05, goat);
    mesh(new THREE.BoxGeometry(0.14, 0.09, 0.05), leather, 0, 1.25, 0.11, goat);
    mesh(new THREE.BoxGeometry(0.26, 0.1, 0.05), leather, 0, 1.26, -0.21, goat);
    const seat = new THREE.Group();
    seat.position.set(0, 0.6, -0.05);
    goat.add(seat);
    Object.assign(U, buildRider(k, seat, P, true));
  } else if (k === 5) {
    // Seniorenmobil: rounded chassis and fairing, mudguards, cushioned swivel seat, tiller with dashboard and basket, lights, number plate, tall safety flag
    const rol = new THREE.Group();
    rol.scale.set(1.3, 1.15, 1.3);
    rig.add(rol);
    U.mount = rol;
    const chrome = lam(0xc9ced6),
      body = lam(0xd94a3d),
      bodyD = lam(0xb53a30),
      cream = lam(0xf3ead2),
      seatM = lam(0x5a3d2a);
    const tube = (a, b, r = 0.028, mat = chrome) => rod(rol, a, b, r, mat, 8);
    mesh(rbox(0.62, 0.16, 1.1, 0.06), body, 0, 0.26, 0.02, rol); // chassis
    mesh(rbox(0.6, 0.2, 0.4, 0.08), body, 0, 0.39, 0.42, rol); // front fairing
    mesh(rbox(0.56, 0.06, 0.06, 0.025, 4), dark, 0, 0.23, 0.6, rol);
    mesh(rbox(0.56, 0.06, 0.06, 0.025, 4), dark, 0, 0.23, -0.56, rol); // bumpers
    mesh(new THREE.BoxGeometry(0.5, 0.03, 0.38), dark, 0, 0.35, -0.08, rol); // floor mat
    [
      [-1, 0.46],
      [1, 0.46],
      [-1, -0.4],
      [1, -0.4],
    ].forEach(([sx, z]) => {
      const w = mesh(new THREE.TorusGeometry(0.095, 0.042, 6, 14).rotateY(Math.PI / 2), dark, sx * 0.3, 0.13, z, rol);
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12).rotateZ(Math.PI / 2), chrome, 0, 0, 0, w);
      mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.075, 8).rotateZ(Math.PI / 2), body, 0, 0, 0, w);
      U.wheels.push(w);
      mesh(new THREE.TorusGeometry(0.155, 0.024, 4, 10, Math.PI).rotateY(Math.PI / 2), bodyD, sx * 0.3, 0.14, z, rol);
    }); // mudguards
    mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 8), chrome, 0, 0.42, -0.2, rol); // seat post
    mesh(rbox(0.46, 0.1, 0.42, 0.045), seatM, 0, 0.5, -0.2, rol);
    mesh(rbox(0.46, 0.38, 0.09, 0.045), seatM, 0, 0.73, -0.42, rol); // cushion, backrest
    [-1, 1].forEach(sx => {
      tube([sx * 0.27, 0.52, -0.36], [sx * 0.27, 0.6, -0.3], 0.014);
      mesh(new THREE.BoxGeometry(0.07, 0.045, 0.28), dark, sx * 0.27, 0.6, -0.16, rol);
    }); // armrests
    tube([0, 0.4, 0.5], [0, 1.0, 0.36], 0.035);
    tube([-0.22, 1.0, 0.36], [0.22, 1.0, 0.36], 0.026); // tiller + handlebar
    [-1, 1].forEach(sx => mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8).rotateZ(Math.PI / 2), dark, sx * 0.24, 1.0, 0.36, rol));
    mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), dark, 0, 1.04, 0.42, rol);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12).rotateX(Math.PI / 2 - 0.5), cream, 0, 1.07, 0.37, rol); // dashboard with speedometer
    tube([-0.22, 1.0, 0.36], [-0.3, 1.14, 0.34], 0.008);
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 10).rotateX(Math.PI / 2), chrome, -0.3, 1.16, 0.34, rol); // mirror
    mesh(rbox(0.34, 0.2, 0.24, 0.03, 4), cream, 0, 1.0, 0.56, rol);
    mesh(new THREE.BoxGeometry(0.36, 0.03, 0.26), lam(0xc9b98a), 0, 1.1, 0.56, rol); // basket and rim
    // the shopping: a loaf of bread with score cuts, a bunch of spring onions, a tomato with its stem
    {
      // basket inside: x -0.17..0.17, y 0.9..1.1 (rim), z 0.44..0.68. The loaf stands in it and leans out to the front left
      const loaf = new THREE.Group(),
        la = new THREE.Vector3(-0.15, 0.95, 0.22).normalize(),
        lb = new THREE.Vector3(-0.05, 0.93, 0.52); // its lower end, inside the basket at the back: it leans forward, away from the hands
      loaf.position.copy(lb).addScaledVector(la, 0.16);
      loaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), la);
      rol.add(loaf);
      mesh(new THREE.SphereGeometry(0.056, 12, 9).scale(1, 0.9, 3), lam(0xc98a4a), 0, 0, 0, loaf); // crust
      mesh(new THREE.SphereGeometry(0.056, 12, 9).scale(0.86, 0.7, 2.8), lam(0xe3b878), 0, 0.022, 0, loaf); // lighter top
      [-0.1, -0.03, 0.04, 0.11].forEach(
        z => (mesh(new THREE.BoxGeometry(0.07, 0.012, 0.016), lam(0x8a5a2b), 0, 0.048, z, loaf).rotation.y = 0.5)
      ); // score cuts
      // spring onions: the white bulbs stay in the basket, only the greens look out
      const on = new THREE.Group();
      on.position.set(0.1, 0.98, 0.6);
      on.rotation.set(-0.2, 0, -0.18);
      rol.add(on);
      [
        [-0.025, 0, 0.12],
        [0.025, 0.01, -0.04],
        [0, -0.02, -0.14],
      ].forEach(([x, z, tilt]) => {
        mesh(new THREE.SphereGeometry(0.026, 8, 6).scale(1, 1.25, 1), lam(0xf6f1e4), x, 0, z, on); // bulb
        mesh(new THREE.CylinderGeometry(0.013, 0.019, 0.09, 6).translate(0, 0.065, 0), lam(0xf6f1e4), x, 0, z, on).rotation.z = tilt;
        const st = mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.14, 6).translate(0, 0.17, 0), lam(0x5fae3e), x, 0, z, on);
        st.rotation.z = tilt * 1.4;
        mesh(new THREE.ConeGeometry(0.01, 0.05, 5).translate(0, 0.265, 0), lam(0x3f8f2e), x, 0, z, on).rotation.z = tilt * 1.4; // tips
      });
      mesh(new THREE.TorusGeometry(0.042, 0.007, 5, 12), lam(0xc8302f), 0, 0.1, -0.01, on); // the band around the bunch
      const tom = new THREE.Group();
      tom.position.set(0.05, 1.1, 0.48);
      rol.add(tom);
      mesh(new THREE.SphereGeometry(0.052, 12, 9).scale(1, 0.88, 1), lam(0xd9362c), 0, 0, 0, tom);
      mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.03, 5), lam(0x3f8f2e), 0, 0.055, 0, tom); // stem
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU,
          lf = mesh(new THREE.BoxGeometry(0.035, 0.006, 0.014).translate(0.017, 0, 0), lam(0x4fa33a), 0, 0.046, 0, tom);
        lf.rotation.set(0, a, -0.3); // the calyx
      }
    }
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12).rotateX(Math.PI / 2), chrome, 0, 0.43, 0.64, rol);
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12).rotateX(Math.PI / 2), lam(0xfff1a8), 0, 0.43, 0.67, rol); // headlight
    [-1, 1].forEach(sx => mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), lam(0xe0302a), sx * 0.22, 0.31, -0.535, rol));
    mesh(new THREE.BoxGeometry(0.16, 0.07, 0.012), lam(0xf6f3ea), 0, 0.31, -0.535, rol); // tail lights, number plate
    tube([0.28, 0.4, -0.5], [0.28, 1.5, -0.5], 0.012);
    const fl = mesh(
      new THREE.PlaneGeometry(0.24, 0.15).translate(0.12, 0, 0),
      new THREE.MeshLambertMaterial({ color: lin(0xff7a1a), side: THREE.DoubleSide }),
      0.28,
      1.42,
      -0.5,
      rol
    );
    U.flag = fl;
    (U.keep || (U.keep = [])).push(fl); // safety flag (flutters)
    const ex = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8), chrome, -0.22, 0.2, -0.6, rol);
    ex.rotation.x = 1.3;
    const stand = new THREE.Group();
    stand.position.set(0, 0.22, -0.14);
    stand.scale.set(1 / 1.3, 1 / 1.15, 1 / 1.3);
    rol.add(stand); // sits on the seat (head matches the hit box)
    U.rol = rol;
    U.stand = stand;
    rol.userData.wheels = U.wheels; // when the driver falls, the scooter rolls on alone
    Object.assign(U, buildRider(k, stand, P, true));
  } else Object.assign(U, buildRider(k, rig, P, false));
  const { H, torso, armL, armR, foreL, foreR } = U;
  const hatFrom = H.children.length;
  if (k === 0 || k === 4) {
    mesh(new THREE.SphereGeometry(0.62, 22, 10, 0, TAU, 0, Math.PI * 0.42), steel, 0, 0.04, 0, H); // Spangenhelm: dome, brow band with rivets, crossing bands, nose guard
    mesh(new THREE.TorusGeometry(0.6, 0.06, 5, 22).rotateX(Math.PI / 2), steelD, 0, 0.2, 0, H);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.52;
      mesh(UG.rivet, steelL, Math.sin(a) * 0.645, 0.2, Math.cos(a) * 0.645, H);
    }
    mesh(new THREE.TorusGeometry(0.635, 0.035, 4, 14, Math.PI).rotateY(Math.PI / 2), steelD, 0, 0.04, 0, H);
    mesh(new THREE.TorusGeometry(0.635, 0.035, 4, 14, Math.PI), steelD, 0, 0.04, 0, H);
    mesh(new THREE.BoxGeometry(0.07, 0.17, 0.06), steelD, 0, 0.12, 0.6, H);
    if (k === 0)
      [-1, 1].forEach(s => {
        mesh(
          taperTube(
            curvePts([s * 0.42, 0.33, 0], [s * 0.95, 0.42, 0.05], [s * 0.88, 0.95, 0.16], 9),
            [0.13, 0.12, 0.105, 0.09, 0.075, 0.058, 0.04, 0.022, 0.004],
            9
          ),
          bone,
          0,
          0,
          0,
          H
        );
        mesh(new THREE.TorusGeometry(0.12, 0.035, 4, 10).rotateZ(Math.PI / 2 - s * 0.25), gold, s * 0.5, 0.35, 0, H);
      });
    else {
      mesh(rbox(0.13, 0.3, 0.92, 0.065), lam(0xc0392b), 0, 0.62, -0.03, H);
      mesh(rbox(0.06, 0.06, 0.96, 0.025, 4), steelD, 0, 0.5, -0.03, H);
    } // horsehair crest on a steel ridge
    const axe = new THREE.Group();
    axe.position.set(0, -0.245, 0.05);
    foreR.add(axe);
    U.drops.push(axe);
    U.weapon = axe;
    mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.9, 7).rotateX(Math.PI / 2), wood, 0, 0, 0.3, axe);
    [-0.02, 0.1].forEach(z => mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.07, 7).rotateX(Math.PI / 2), leather, 0, 0, z, axe));
    mesh(new THREE.SphereGeometry(0.042, 7, 5), steelD, 0, 0, -0.16, axe);
    mesh(AXE_BLADE, steelL, 0, -0.03, 0.6, axe).rotation.z = Math.PI; // the cutting edge faces the enemy, not the warrior
    mesh(new THREE.BoxGeometry(0.07, 0.08, 0.16), steelD, 0, -0.01, 0.62, axe);
    if (k === 0) {
      const sh = new THREE.Group();
      sh.position.set(-0.08, -0.035, 0.05);
      foreL.add(sh);
      U.shield = sh; // round shield: painted cross on red, iron rim, boss
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24).rotateZ(Math.PI / 2), lam(0xc0392b), 0, 0, 0, sh);
      mesh(new THREE.BoxGeometry(0.012, 0.56, 0.07), bone, -0.026, 0, 0, sh);
      mesh(new THREE.BoxGeometry(0.012, 0.07, 0.56), bone, -0.026, 0, 0, sh);
      mesh(new THREE.TorusGeometry(0.3, 0.026, 4, 20).rotateY(Math.PI / 2), lam(0x4a3424), 0, 0, 0, sh);
      mesh(new THREE.SphereGeometry(0.085, 10, 6, 0, TAU, 0, Math.PI / 2).rotateZ(Math.PI / 2), steel, -0.025, 0, 0, sh);
      mesh(new THREE.TorusGeometry(0.09, 0.016, 3, 12).rotateY(Math.PI / 2), steelD, -0.03, 0, 0, sh);
      U.drops.push(sh);
    }
  } else if (k === 1) {
    [-1, 1].forEach(s => {
      mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.7, 7), lam(0xe9c45a), s * 0.5, -0.3, -0.1, H);
      mesh(UG.bead, lam(0x2f7f6f), s * 0.5, -0.58, -0.1, H);
    });
    const bow = mesh(BOW_LIMB, lam(0x7a4e2d), 0, -0.245, 0.1, foreL);
    bow.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
    U.drops.push(bow);
    U.bow = bow; // recurve bow with a leather grip and a string
    mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.13, 8).rotateZ(Math.PI / 2), leather, 0, 0.5, 0, bow);
    rod(bow, [-0.555, 0.365, 0], [0.555, 0.365, 0], 0.005, lam(0xf1ead8), 4);
    const qv = mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.56, 10), lam(0x6b4423), 0.1, 1.0, -0.19, torso);
    qv.rotation.x = 0.35; // quiver with arrows
    mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 12).rotateX(Math.PI / 2), lam(0x4a2e17), 0, 0.28, 0, qv);
    [-0.1, 0.12].forEach(y => mesh(new THREE.TorusGeometry(0.084, 0.012, 4, 12).rotateX(Math.PI / 2), gold, 0, y, 0, qv));
    [
      [-0.03, 0.02],
      [0.035, -0.02],
      [0, -0.04],
      [0.02, 0.04],
    ].forEach(([x, z], i) => {
      mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 4), lam(0xd8c08a), x, 0.37, z, qv);
      mesh(new THREE.ConeGeometry(0.03, 0.09, 3), lam(i % 2 ? 0xd23a2e : 0xf6f1e4), x, 0.47, z, qv);
    });
  } else if (k === 2) {
    // newsboy cap and a walking cane with a rubber tip
    mesh(new THREE.SphereGeometry(0.62, 18, 8, 0, TAU, 0, Math.PI / 2), lam(0x7a6e5f), 0, 0.34, -0.03, H).scale.set(1, 0.42, 1.06);
    mesh(new THREE.CylinderGeometry(0.6, 0.61, 0.13, 22), lam(0x5d544b), 0, 0.3, -0.03, H);
    mesh(new THREE.SphereGeometry(0.06, 7, 5), lam(0x5d544b), 0, 0.6, 0.02, H);
    const brim = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 16, 1, false, -Math.PI / 2, Math.PI), lam(0x5d544b), 0, 0.27, 0.46, H);
    brim.rotation.x = 0.16;
    brim.scale.set(1.15, 1, 1);
    const cane = new THREE.Group();
    cane.position.set(0, -0.245, 0.05);
    foreR.add(cane);
    U.drops.push(cane);
    U.weapon = cane;
    mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.1, 7).rotateX(Math.PI / 2), lam(0x5b3a22), 0, 0, 0.35, cane);
    const crook = mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 12, Math.PI), lam(0x5b3a22), 0, 0.11, 0.9, cane);
    crook.rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.07, 8).rotateX(Math.PI / 2), dark, 0, 0, -0.22, cane);
    mesh(new THREE.TorusGeometry(0.031, 0.01, 4, 10), gold, 0, 0, 0.82, cane);
  } else if (k === 3) {
    // grey bun with hairpins, handbag with clasp and handle
    mesh(new THREE.SphereGeometry(0.27, 12, 10), lam(0xcfcbd6), 0, 0.32, -0.38, H);
    mesh(new THREE.SphereGeometry(0.17, 10, 8), lam(0xd9d5df), 0, 0.5, -0.44, H);
    [-1, 1].forEach(s => {
      const pin = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), gold, 0, 0.36, -0.42, H);
      pin.rotation.set(0.3, 0, s * 1.2);
    });
    mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 16).rotateX(Math.PI / 2), lam(0xffffff), 0, 1.28, 0, torso);
    const bag = mesh(rbox(0.22, 0.17, 0.1, 0.035, 4).translate(0, -0.12, 0), lam(0x7a2d4a), 0, -0.2, 0.08, foreL);
    U.drops.push(bag);
    U.bag = bag; // pivot at the handle: it dangles
    mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), lam(0x4a1a2c), 0, -0.035, 0, bag);
    mesh(rbox(0.05, 0.03, 0.02, 0.008, 4), gold, 0, -0.06, 0.05, bag);
  } else if (k === 5) {
    // racing helmet with stripe and visor
    mesh(new THREE.SphereGeometry(0.63, 22, 10, 0, TAU, 0, Math.PI * 0.45), lam(0xd23a2e), 0, 0.02, 0, H);
    mesh(new THREE.TorusGeometry(0.64, 0.06, 4, 20, Math.PI).rotateY(Math.PI / 2), lam(0xf6f3ea), 0, 0.02, 0, H);
    const vis = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 16, 1, false, -Math.PI / 2, Math.PI), lam(0x1d1d24), 0, 0.12, 0.5, H);
    vis.rotation.x = 0.12;
    vis.scale.set(1.1, 1, 0.9);
  }
  if (SKIN_NOW) skinExtras(U, k, SKIN_NOW);
  if (k === 0 || k === 2 || k === 4 || k === 5) {
    const hat = new THREE.Group();
    H.children.slice(hatFrom).forEach(c => hat.add(c));
    H.add(hat);
    U.hat = hat;
  }
  batchUnitDetails(U);
  shadows(g, UNIT_SHADOWS, false);
  const cav = KINDS[k].role === 'cav';
  const blob = mesh(UG.blob, blobMat, 0, 0.05, 0, g);
  blob.scale.setScalar(cav ? 1.7 : 1.05);
  blob.userData.ublob = true;
  blob.visible = !UNIT_SHADOWS || lowShadows();
  blob.castShadow = false;
  const ring = mesh(UG.ring, ringMat, 0, 0.07, 0, g);
  ring.visible = false;
  ring.scale.setScalar(cav ? 1.3 : 1);
  ring.castShadow = false;
  const hp = new THREE.Group();
  mesh(UG.hpbg, hpBgMat, 0, 0, -0.01, hp);
  const hpf = mesh(UG.hpfg, hpMats[0], -0.5, 0, 0, hp);
  hp.visible = false;
  hpGroup.add(hp);
  scene.add(g);
  return Object.assign(U, { ring, hp, hpf, blob, baseHeadMat: U.head.material });
}
/* What makes a skin more than a colour: capes, crowns, wolf pelts, sunglasses, flower garlands ... added while the model is built
   (before the details are merged, so they cost no extra draw calls). Head pieces go into H (they fly off with a hat), face pieces onto
   the neck (they stay on the face). Built the same way for the low-detail models (no randomness). */
function skinExtras(U, k, id) {
  const { torso, neck, H, armL, armR, foreL, foreR, legL, legR, shinL, shinR } = U;
  if (!torso || !H) return;
  const m = (geo, c, x, y, z, par) => mesh(geo, lam(c), x, y, z, par),
    vik = k === 0 || k === 1 || k === 4,
    ring = (n, r, y, par, geo, cols, sc = 1, z0 = 0) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        m(geo, cols[i % cols.length], Math.sin(a) * r, y, Math.cos(a) * r + z0, par).scale.setScalar(sc);
      }
    },
    cape = (c, trim) => {
      const cp = m(rbox(0.46, 0.8, 0.035, 0.015, 3), c, 0, 0.9, -0.225, torso);
      cp.rotation.x = 0.13;
      if (trim) m(new THREE.BoxGeometry(0.47, 0.05, 0.045), trim, 0, 0.52, -0.278, torso).rotation.x = 0.13;
    },
    shades = (lens, frame, round) => {
      [-1, 1].forEach(s => {
        if (round) {
          const f = m(new THREE.TorusGeometry(0.12, 0.024, 6, 18), frame, s * 0.19, 0.58, 0.54, neck);
          f.rotation.y = s * 0.32;
          const l = m(new THREE.CircleGeometry(0.115, 16), lens, s * 0.19, 0.58, 0.535, neck);
          l.rotation.y = s * 0.32;
        } else {
          const l = m(rbox(0.25, 0.15, 0.04, 0.05, 3), lens, s * 0.18, 0.6, 0.545, neck);
          l.rotation.y = s * 0.32;
        }
        const t = m(new THREE.BoxGeometry(0.025, 0.025, 0.42), frame, s * 0.47, 0.62, 0.27, neck);
        t.rotation.y = s * -0.12;
      });
      m(new THREE.BoxGeometry(0.12, 0.028, 0.03), frame, 0, 0.62, 0.585, neck);
    };
  if (id === 'v1') {
    // Rotbart: a red clan cape with a fur edge, a gold torc
    if (vik) {
      cape(0x8e2a20, 0x5e3a22);
      for (let i = 0; i < 5; i++) m(UG.tuft, 0x5e3a22, -0.18 + i * 0.09, 1.27, -0.19, torso).scale.set(1.3, 1, 1);
      m(new THREE.TorusGeometry(0.115, 0.022, 6, 16).rotateX(Math.PI / 2), 0xd9a441, 0, 1.28, 0.01, torso);
    }
  } else if (id === 'v2') {
    // Eiswolf: a white wolf pelt over the head with ears, a fur ruff, ice crystals on the shoulders, a white cape
    if (vik) {
      const pelt = m(new THREE.SphereGeometry(0.69, 18, 9, 0, TAU, 0, Math.PI * 0.5), 0xdfe7ee, 0, 0.02, -0.04, H);
      pelt.rotation.x = -0.55;
      [-1, 1].forEach(s => {
        const e = m(new THREE.ConeGeometry(0.15, 0.36, 4), 0xdfe7ee, s * 0.34, 0.62, -0.12, H);
        e.rotation.z = -s * 0.32;
        const ei = m(new THREE.ConeGeometry(0.08, 0.22, 4), 0x9fb6c8, s * 0.33, 0.6, -0.04, H);
        ei.rotation.z = -s * 0.32;
        [0, 1].forEach(j => {
          const c = m(new THREE.ConeGeometry(0.045, 0.2 - j * 0.06, 5), 0xbfe6ff, s * (0.24 + j * 0.06), 1.33, j * 0.05 - 0.02, torso);
          c.rotation.z = -s * (0.25 + j * 0.3);
        });
      });
      ring(10, 0.2, 1.27, torso, UG.tuft, [0xf2f6f9, 0xdfe7ee], 1.45);
      cape(0xe8eef3, 0x9fb6c8);
    }
  } else if (id === 'v3') {
    // Gold-Jarl: a golden crown, gold shoulder plates, a black cape with a gold hem
    if (vik) {
      const r = k === 1 ? 0.6 : 0.65,
        y = k === 1 ? 0.3 : 0.27;
      m(new THREE.TorusGeometry(r, 0.05, 5, 24).rotateX(Math.PI / 2), 0xd9a441, 0, y, 0, H);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        m(new THREE.ConeGeometry(0.075, i % 2 ? 0.2 : 0.3, 4), 0xf3d27a, Math.sin(a) * r, y + (i % 2 ? 0.12 : 0.17), Math.cos(a) * r, H);
      }
      m(new THREE.SphereGeometry(0.06, 8, 6), 0xd0213a, 0, y + 0.02, r + 0.03, H);
      [-1, 1].forEach(s => {
        const p = m(new THREE.SphereGeometry(0.11, 10, 6, 0, TAU, 0, Math.PI / 2), 0xd9a441, s * 0.235, 1.25, 0, torso);
        p.scale.set(1.1, 0.75, 1.1);
        p.rotation.z = -s * 0.35;
      });
      cape(0x1c1c22, 0xd9a441);
    }
  } else if (id === 'v4') {
    // Drachenjäger: dragon spikes down the back, a necklace of dragon teeth, a scaly green cape
    if (vik) {
      cape(0x23502b, 0x7a5a2a);
      for (let i = 0; i < 4; i++) {
        const c = m(new THREE.ConeGeometry(0.06 - i * 0.008, 0.2 - i * 0.025, 4), 0xc9a24a, 0, 1.22 - i * 0.15, -0.26, torso);
        c.rotation.x = -1.1;
      }
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.2 + (0.6 * i) / 6);
        const t = m(new THREE.ConeGeometry(0.022, 0.09, 4), 0xf6f1e4, Math.cos(a) * 0.15, 1.2, Math.sin(a) * 0.13 + 0.03, torso);
        t.rotation.x = Math.PI;
      }
    }
  } else if (id === 'r1') {
    // Trainingsanzug: stripes down the sleeves and trousers, a sweatband, wristbands
    const st = (par, s, x, len) => par && m(new THREE.BoxGeometry(0.02, len, 0.02), 0xf6f6f6, s * x, -len / 2 - 0.01, 0, par);
    st(armL, -1, 0.047, 0.2);
    st(armR, 1, 0.047, 0.2);
    st(foreL, -1, 0.044, 0.2);
    st(foreR, 1, 0.044, 0.2);
    if (k !== 3) {
      st(legL, -1, 0.058, 0.22);
      st(legR, 1, 0.058, 0.22);
      st(shinL, -1, 0.054, 0.22);
      st(shinR, 1, 0.054, 0.22);
    }
    [foreL, foreR].forEach(f => f && m(new THREE.TorusGeometry(0.05, 0.022, 5, 12).rotateX(Math.PI / 2), 0xf6f6f6, 0, -0.16, 0, f));
    if (k !== 5) {
      const y = k === 3 ? 0.22 : 0.13;
      m(new THREE.TorusGeometry(0.6, 0.065, 5, 24).rotateX(Math.PI / 2), 0xf6f6f6, 0, y, 0, H);
      m(new THREE.TorusGeometry(0.615, 0.02, 4, 24).rotateX(Math.PI / 2), 0xd23a2e, 0, y, 0, H);
    }
  } else if (id === 'r2') {
    // Strandurlaub: sunglasses, a flower garland, a straw sun hat for Oma
    if (k !== 5) shades(0x15161c, 0x2a2a30, false);
    ring(12, 0.2, 1.25, torso, new THREE.SphereGeometry(0.045, 7, 5), [0xff5fa2, 0xffe066, 0xffffff, 0xff8a3d], 1, 0.01);
    if (k === 3) {
      m(new THREE.CylinderGeometry(0.98, 0.98, 0.04, 22), 0xe8cf8a, 0, 0.42, -0.06, H);
      m(new THREE.CylinderGeometry(0.5, 0.6, 0.34, 18), 0xe8cf8a, 0, 0.6, -0.08, H);
      m(new THREE.CylinderGeometry(0.61, 0.61, 0.08, 18), 0xff5fa2, 0, 0.48, -0.08, H);
    }
  } else if (id === 'r3') {
    // Disco-Rentner: a gold medallion, big round disco glasses, a pink feather boa for Oma
    const ch = m(new THREE.TorusGeometry(0.15, 0.012, 4, 18), 0xd9a441, 0, 1.17, 0.11, torso);
    ch.rotation.x = 1.15;
    m(new THREE.CylinderGeometry(0.065, 0.065, 0.016, 14).rotateX(Math.PI / 2), 0xf3d27a, 0, 1.03, 0.215, torso);
    m(new THREE.OctahedronGeometry(0.035), 0xfff6c8, 0, 1.03, 0.23, torso);
    if (k !== 5) shades(0x7a3fd0, 0xd9a441, true);
    if (k === 3) ring(12, 0.25, 1.24, torso, UG.tuft, [0xff6fb5, 0xff9fd0], 1.6, -0.01);
  } else if (id === 'r4') {
    // Kegelclub: a bowling pin badge on the chest, white piping, a club cap star
    const pin = m(
      lathe(
        [
          [0, 0],
          [0.03, 0.005],
          [0.045, 0.04],
          [0.035, 0.08],
          [0.018, 0.11],
          [0.026, 0.14],
          [0.02, 0.165],
          [0, 0.17],
        ],
        10
      ),
      0xf6f6f6,
      0.1,
      0.98,
      0.2,
      torso
    );
    pin.rotation.x = -0.15;
    m(new THREE.TorusGeometry(0.019, 0.006, 4, 10).rotateX(Math.PI / 2), 0xd2302a, 0, 0.115, 0, pin);
    m(new THREE.TorusGeometry(0.212, 0.012, 4, 20).rotateX(Math.PI / 2), 0xf6f6f6, 0, 1.18, 0, torso);
    if (k === 2) m(new THREE.OctahedronGeometry(0.09), 0xf6f6f6, 0, 0.42, 0.5, H);
  }
}
