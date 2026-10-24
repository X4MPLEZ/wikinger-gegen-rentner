/* 70-world-view.js - World views on the client: polar bears, ice holes, jump pads, pickups (itemMesh: money bags, disco grenades), the fog (fogVis, fogSeen,
   fogWallTick, the map print in the fog: fogHintBuild), the gold wagon and flag migration (eventView). updateWorld() runs every frame. */
/* ---------- world: polar bears, pickups, cactus pricks ---------- */
const PADV = [];
const WV = {
  pj: new Map(),
  bears: [],
  bearPool: [],
  items: new Map(),
  peSeen: undefined,
  prick: new Map(),
  holes: new Map(),
  holeLayers: null,
  holeDirty: false,
  ic: new Map(),
  fz: new Set(),
};
let HOLE_TEX = null;
function holeTex() {
  if (HOLE_TEX) return HOLE_TEX;
  const N = 256,
    c = cnv(N, N),
    x = c.getContext('2d'),
    g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, '#04131f');
  g.addColorStop(0.55, '#0b3550');
  g.addColorStop(0.85, '#1f7fa8');
  g.addColorStop(1, '#7fd6f2');
  x.fillStyle = g;
  x.fillRect(0, 0, N, N);
  for (let i = 0; i < 8; i++) {
    x.strokeStyle = `rgba(160,230,255,${0.08 + i * 0.015})`;
    x.lineWidth = 2;
    x.beginPath();
    x.ellipse(128 + Math.sin(i) * 6, 128, 30 + i * 11, 26 + i * 10, i * 0.4, 0, TAU);
    x.stroke();
  }
  x.fillStyle = 'rgba(255,255,255,.35)';
  x.beginPath();
  x.ellipse(96, 92, 34, 12, -0.6, 0, TAU);
  x.fill();
  const crk = cnv(N, N),
    y = crk.getContext('2d');
  y.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    let a = (i / 11) * TAU + Math.random() * 0.3,
      px = 128 + Math.cos(a) * 52,
      py = 128 + Math.sin(a) * 52;
    y.strokeStyle = 'rgba(255,255,255,.85)';
    y.lineWidth = 2.4;
    y.beginPath();
    y.moveTo(px, py);
    const L = 30 + Math.random() * 45;
    for (let k = 0; k < 4; k++) {
      a += (Math.random() - 0.5) * 0.7;
      px += (Math.cos(a) * L) / 4;
      py += (Math.sin(a) * L) / 4;
      y.lineTo(px, py);
    }
    y.stroke();
    y.strokeStyle = 'rgba(30,90,140,.6)';
    y.lineWidth = 0.9;
    y.stroke();
  }
  return (HOLE_TEX = { water: new THREE.CanvasTexture(c), crack: new THREE.CanvasTexture(crk) });
}
function holeMesh(x, z) {
  const g = new THREE.Group(),
    y = Math.max(groundY(x, z), WL + 0.1) + 0.06;
  g.position.set(x, y, z);
  g.renderOrder = 2;
  const T = holeTex();
  const crack = mesh(
    new THREE.PlaneGeometry(5.2, 5.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: T.crack, transparent: true, depthWrite: false }),
    0,
    0.005,
    0,
    g
  );
  crack.rotation.y = Math.random() * TAU;
  crack.renderOrder = 2;
  const sh = new THREE.Shape();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * TAU,
      r = 1.05 + Math.sin(i * 2.3 + x) * 0.12 + (i % 3 ? 0 : -0.12);
    const px = Math.cos(a) * r,
      pz = Math.sin(a) * r;
    if (i) sh.lineTo(px, pz);
    else sh.moveTo(px, pz);
  }
  const wg = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2),
    uv = wg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.42 + 0.5, uv.getY(i) * 0.42 + 0.5);
  const w = mesh(
    wg,
    new THREE.MeshPhongMaterial({ map: T.water, color: 0x8fb0c4, shininess: 160, specular: lin(0x6fa8c8), emissive: lin(0x020a10) }),
    0,
    -0.04,
    0,
    g
  );
  w.renderOrder = 3;
  const shMat = new THREE.MeshPhongMaterial({
    color: lin(0xdff6ff),
    emissive: lin(0x0c3a52),
    shininess: 150,
    specular: lin(0xffffff),
    flatShading: true,
    transparent: true,
    opacity: 0.95,
  });
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * TAU + Math.random() * 0.25,
      r = 1.12 + Math.random() * 0.12,
      b = mesh(new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.14, 0), shMat, Math.cos(a) * r, 0.03, Math.sin(a) * r, g);
    b.scale.set(1.6, 0.35 + Math.random() * 0.4, 1);
    b.rotation.set((Math.random() - 0.5) * 0.8, -a, (Math.random() - 0.5) * 0.8);
  }
  const chunks = [];
  for (let i = 0; i < 3; i++) {
    const ch = mesh(
      new THREE.BoxGeometry(0.32 + Math.random() * 0.2, 0.08, 0.26 + Math.random() * 0.15),
      shMat,
      (Math.random() - 0.5) * 1.0,
      -0.02,
      (Math.random() - 0.5) * 1.0,
      g
    );
    ch.rotation.y = Math.random() * TAU;
    chunks.push(ch);
  }
  const rip = mesh(
    new THREE.RingGeometry(0.3, 0.38, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xcff4ff, transparent: true, opacity: 0.5, depthWrite: false }),
    0,
    -0.02,
    0,
    g
  );
  rip.renderOrder = 4;
  scene.add(g);
  return { g, w, chunks, rip, t: Math.random() * 3 };
}
function holeLayers() {
  if (WV.holeLayers) return WV.holeLayers;
  const T = holeTex(),
    shape = new THREE.Shape();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * TAU,
      r = 1.02 + Math.sin(i * 2.3) * 0.1;
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const waterGeo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
    uv = waterGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.42 + 0.5, uv.getY(i) * 0.42 + 0.5);
  // Bake all thirteen edge chunks into one shared mesh, then instance that mesh.
  const chunk = new THREE.DodecahedronGeometry(0.22, 0),
    chunkPos = chunk.attributes.position,
    edgePos = [],
    p = new THREE.Vector3(),
    mt = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    sc = new THREE.Vector3();
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * TAU,
      r = 1.12 + Math.sin(i * 2.7) * 0.04;
    q.setFromEuler(new THREE.Euler(0.12 * Math.sin(i), -a, 0.16 * Math.cos(i)));
    mt.compose(p.set(Math.cos(a) * r, 0.03, Math.sin(a) * r), q, sc.set(1.3, 0.45 + (i % 3) * 0.12, 0.85));
    for (let v = 0; v < chunkPos.count; v++) {
      p.fromBufferAttribute(chunkPos, v).applyMatrix4(mt);
      edgePos.push(p.x, p.y, p.z);
    }
  }
  chunk.dispose();
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
  edgeGeo.computeVertexNormals();
  const group = new THREE.Group(),
    layers = [
      {
        geo: new THREE.PlaneGeometry(5.2, 5.2).rotateX(-Math.PI / 2),
        mat: new THREE.MeshBasicMaterial({ map: T.crack, transparent: true, depthWrite: false }),
        dy: 0.022,
        order: 2,
      },
      {
        geo: waterGeo,
        mat: new THREE.MeshPhongMaterial({
          map: T.water,
          color: 0x8fb0c4,
          shininess: 140,
          specular: lin(0x6fa8c8),
          emissive: lin(0x020a10),
        }),
        dy: 0.008,
        order: 3,
      },
      {
        geo: edgeGeo,
        mat: new THREE.MeshPhongMaterial({
          color: lin(0xdff6ff),
          emissive: lin(0x0c3a52),
          shininess: 100,
          specular: lin(0xffffff),
          flatShading: true,
        }),
        dy: 0.012,
        order: 4,
      },
    ].map(part => {
      const im = new THREE.InstancedMesh(part.geo, part.mat, GW * GH);
      im.count = 0;
      im.visible = false;
      im.frustumCulled = false;
      im.renderOrder = part.order;
      im.userData.holeLayer = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(im);
      return { im, dy: part.dy };
    });
  scene.add(group);
  return (WV.holeLayers = {
    group,
    layers,
    mt: new THREE.Matrix4(),
    p: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    sc: new THREE.Vector3(1, 1, 1),
    up: new THREE.Vector3(0, 1, 0),
  });
}
function syncHoleLayers() {
  if (!WV.holeDirty) return;
  WV.holeDirty = false;
  const H = holeLayers();
  let i = 0;
  for (const v of WV.holes.values()) {
    H.q.setFromAxisAngle(H.up, v.angle);
    H.sc.setScalar((v.r || 1.14) / 1.08);
    for (const layer of H.layers) {
      H.p.copy(v.g.position);
      H.p.y += layer.dy;
      H.mt.compose(H.p, H.q, H.sc);
      layer.im.setMatrixAt(i, H.mt);
    }
    i++;
  }
  for (const layer of H.layers) {
    layer.im.count = i;
    layer.im.visible = i > 0;
    layer.im.instanceMatrix.needsUpdate = true;
  }
}

function bearMesh() {
  const g = new THREE.Group(),
    fur = lam(0xf3f1ea),
    dark = lam(0x222222),
    body = new THREE.Group();
  g.add(body);
  mesh(new THREE.SphereGeometry(0.9, 14, 10), fur, 0, 1.1, 0, body).scale.set(1, 0.85, 1.55);
  mesh(new THREE.SphereGeometry(0.7, 12, 9), fur, 0, 1.25, -0.75, body).scale.set(1, 0.9, 1);
  const head = new THREE.Group();
  head.position.set(0, 1.45, 1.35);
  body.add(head);
  mesh(new THREE.SphereGeometry(0.48, 12, 9), fur, 0, 0, 0, head).scale.set(1, 0.9, 1.15);
  mesh(new THREE.SphereGeometry(0.24, 10, 8), fur, 0, -0.1, 0.45, head).scale.set(1, 0.8, 1.2);
  mesh(new THREE.SphereGeometry(0.08, 8, 6), dark, 0, -0.02, 0.72, head);
  [-1, 1].forEach(sx => {
    mesh(new THREE.SphereGeometry(0.06, 6, 5), dark, sx * 0.2, 0.12, 0.38, head);
    mesh(new THREE.SphereGeometry(0.13, 8, 6), fur, sx * 0.3, 0.38, -0.05, head);
  });
  const legs = [
    [-0.5, 0.75],
    [0.5, 0.75],
    [-0.5, -0.85],
    [0.5, -0.85],
  ].map(([lx, lz]) => {
    const l = mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.9, 8).translate(0, -0.45, 0), fur, lx, 0.95, lz, body);
    return l;
  });
  shadows(g, true, false);
  scene.add(g);
  const hp = new THREE.Group();
  mesh(UG.hpbg, hpBgMat, 0, 0, -0.01, hp);
  const hpf = mesh(UG.hpfg, hpMats[1], -0.5, 0, 0, hp);
  hp.scale.setScalar(1.4);
  hp.visible = false;
  hpGroup.add(hp);
  const furMeshes = [];
  body.traverse(o => {
    if (o.isMesh && o.material === fur) furMeshes.push(o);
  });
  const aura = new THREE.Sprite(spriteMat('bearTameV', () => tameHeartCanvas(FAC.viking.css)).mat);
  aura.visible = false;
  aura.position.y = 2.1;
  g.add(aura);
  inkify(body);
  return { g, body, head, legs, furMeshes, fur, aura, atk: 0, swipe: 0, walk: 0, hp, hpf };
}
function tameHeartCanvas(color) {
  const c = cnv(128, 128),
    x = c.getContext('2d'),
    glow = x.createRadialGradient(64, 66, 2, 64, 66, 62);
  glow.addColorStop(0, color);
  glow.addColorStop(0.5, color + '80');
  glow.addColorStop(1, color + '00');
  x.fillStyle = glow;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#fff6df';
  x.strokeStyle = color;
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(64, 98);
  x.bezierCurveTo(18, 70, 30, 27, 64, 45);
  x.bezierCurveTo(98, 27, 110, 70, 64, 98);
  x.fill();
  x.stroke();
  return c;
}
// Pre-cache the few conversion tint steps; no new material is created per frame.
const bearTameMats = Object.fromEntries(
  Object.entries(FAC).map(([fac, F]) => [
    fac,
    Array.from({ length: 9 }, (_, i) => {
      const color = new THREE.Color(0xf3f1ea).lerp(new THREE.Color(F.col), (i / 8) * 0.36);
      return lam(color.getHex());
    }),
  ])
);
function itemMesh(ty) {
  const g = new THREE.Group(),
    core = new THREE.Group();
  g.add(core);
  if (ty === 1) core.add(nadeMesh(1.7));
  else if (0) mesh(discoGeo, null, 0, 0, 0, core).scale.setScalar(1.1);
  else {
    mesh(new THREE.SphereGeometry(0.55, 12, 9), lam(0xa8804a), 0, 0, 0, core).scale.set(1, 0.95, 1);
    mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.25, 8), lam(0x8a6a3a), 0, 0.55, 0, core);
    mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12).rotateX(Math.PI / 2), lam(0xd23a2e), 0, 0.5, 0, core);
    const coin = mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14).rotateX(Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: lin(0xf2c14e), emissive: lin(0x664400) }),
      0,
      0.05,
      0.52,
      core
    );
    coin.userData.c = 1;
  }
  const ring = mesh(
    new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ty === 1 ? 0xff6bd5 : 0xf0bf4c, transparent: true, opacity: 0.7, depthWrite: false, fog: false }),
    0,
    -0.85,
    0,
    g
  );
  core.scale.setScalar(ty === 1 ? 1 : 1.45);
  const beam = mesh(
    new THREE.CylinderGeometry(0.55, 0.9, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: ty === 1 ? 0xff6bd5 : 0xffd34d,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false, // additive + fog = a white column in the fog: the item is hidden in the fog instead (see the item loop)
    }),
    0,
    3.6,
    0,
    g
  );
  beam.renderOrder = 5;
  g.userData.beam = beam;
  const sp = new THREE.Sprite(
    spriteMat('si' + ty, () => siCanvas(ty === 1 ? 'nade' : 'bag', 128, ty === 1 ? '#c2459c' : '#c08a1e')).mat.clone()
  );
  sp.material.fog = false;
  sp.scale.set(1.7, 1.7, 1);
  sp.position.y = 2.9;
  sp.renderOrder = 6;
  g.add(sp);
  scene.add(g);
  return { g, core, ring, sp };
}
/* ---------- map events on the client: fog of war, gold wagon, flag migration ---------- */
const FOG = { on: false, own: [], k: 0 };
// The clearings: FOG.own holds x, z, clear-up-to, fog-complete-at for every source (own warriors, base, held flags, the siege at the
// enemy base – FOG_SIGHT in 02-data.js), rebuilt every frame in updateWorld. The ego view sees by distance (FOG_EGO): the lantern.
const FOG_EGO = { near: 4, far: 32, seen: 25, guide: 21 };
function fogVis(x, z) {
  // 1 = clear, 0 = deep in the fog (same falloff as the map the shaders read)
  const o = FOG.own;
  let v = 0;
  for (let i = 0; i < o.length && v < 1; i += 4)
    v = Math.max(v, clamp((o[i + 3] - Math.hypot(x - o[i], z - o[i + 1])) / (o[i + 3] - o[i + 2]), 0, 1));
  return v;
}
function fogSeen(x, z) {
  // UI that is not drawn through the fog (words, markers): shown only where the fog lets you see
  if (!FOG.on) return true;
  if (V.poss) return Math.hypot(x - camera.position.x, z - camera.position.z) < FOG_EGO.seen;
  return fogVis(x, z) > 0.4;
}
function fogSources(s) {
  const o = FOG.own,
    add = (x, z, r) => o.push(x, z, r[0], r[1]),
    B = BASES[V.myTeam],
    EB = BASES[1 - V.myTeam];
  o.length = 0;
  if (B) add(B.x, B.z, FOG_SIGHT.base);
  if (s && s.f) s.f.forEach((f, i) => f[0] === V.myTeam && FLAGS[i] && add(FLAGS[i].x, FLAGS[i].z, FOG_SIGHT.flag));
  let siege = false;
  for (const u of V.units.values()) {
    if (u.team !== V.myTeam || (u.worm && u.wP && (u.wP.ws === 'under' || u.wP.ws === 'warn'))) continue;
    const p = u.g.position;
    add(p.x, p.z, fogSightOf(KINDS[u.k].role, V.poss && V.poss.id === u.id));
    if (EB && Math.hypot(p.x - EB.x, p.z - EB.z) < FOG_SIGHT.siegeNear) siege = true;
  }
  if (V.poss) add(V.poss.x, V.poss.z, FOG_SIGHT.torch);
  if (siege) add(EB.x, EB.z, FOG_SIGHT.siege);
}
function fogWallMapDraw() {
  if (!FOGW.cv) {
    FOGW.cv = cnv(92, 172);
    const t = (FOGW.tex = new THREE.CanvasTexture(FOGW.cv));
    t.flipY = false;
    t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    FOGW.map.value = t;
  }
  const c = FOGW.cv,
    x = c.getContext('2d'),
    ox = -FOGW.box.value.x,
    oz = -FOGW.box.value.y;
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'lighten';
  const blob = (wx, wz, r) => {
    const cx = wx + ox,
      cz = wz + oz,
      g = x.createRadialGradient(cx, cz, r[0], cx, cz, r[1]);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cz, r[1], 0, TAU);
    x.fill();
  };
  const o = FOG.own;
  for (let i = 0; i < o.length; i += 4) blob(o[i], o[i + 1], [o[i + 2], o[i + 3]]);
  x.globalCompositeOperation = 'source-over';
  FOGW.tex.needsUpdate = true;
}
/* the sky is tone-mapped, the fog is not: find the sky colour that ends up on screen exactly like a given fog colour (inverse of three's ACES fit) */
const ACES_IM = [
    [0.59719, 0.35458, 0.04823],
    [0.076, 0.90834, 0.01566],
    [0.0284, 0.13383, 0.83777],
  ],
  ACES_OM = [
    [1.60475, -0.53108, -0.07367],
    [-0.10208, 1.10813, -0.00605],
    [-0.00327, -0.07276, 1.07602],
  ];
function solve3(M, b) {
  const d = m =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]),
    D = d(M);
  return [0, 1, 2].map(i => d(M.map((r, j) => r.map((v, k) => (k === i ? b[j] : v)))) / D);
}
function displayToTexel(col) {
  const s2l = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4),
    l2s = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
  const r = solve3(ACES_OM, [col.r, col.g, col.b].map(s2l)).map(y => {
    y = clamp(y, 0, 0.98);
    const a = 1 - 0.983729 * y,
      b = 0.0245786 - 0.432951 * y,
      c = -(0.000090537 + 0.238081 * y);
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  });
  const lin3 = solve3(ACES_IM, r).map(v => Math.max(0, (v * 0.6) / (renderer.toneMappingExposure || 1)));
  return new THREE.Color(...lin3.map(v => clamp(l2s(v), 0, 1)));
}
function fogHintBuild() {
  // a faded copy of the small map (water, woods, roads) for the fog top, so the shape of the land stays readable in the fog
  if (FOGW.hintMap === MAP || !miniBg) return;
  FOGW.hintMap = MAP;
  const bx = FOGW.box.value,
    c = cnv(bx.z, bx.w),
    x = c.getContext('2d');
  x.fillStyle = '#8fb2c4'; // the sea around the island
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingEnabled = true;
  x.drawImage(miniBg, -HALF_W - bx.x, -HALF_H - bx.y, 2 * HALF_W, 2 * HALF_H);
  x.globalAlpha = 0.38; // toward the fog colour: a hint, not a map
  x.fillStyle = '#' + FOGW.col.getHexString();
  x.fillRect(0, 0, c.width, c.height);
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (FOGW.hint.value && FOGW.hint.value.dispose) FOGW.hint.value.dispose();
  FOGW.hint.value = t;
}
function fogDeckHeight() {
  if (FOGW.hMap === MAP) return;
  FOGW.hMap = MAP;
  let mx = 0;
  for (let x = -HALF_W; x <= HALF_W; x += 2) for (let z = -HALF_H; z <= HALF_H; z += 2) mx = Math.max(mx, groundY(x, z));
  FOGW.h.value = mx + 6;
}
const SKY_DISP = ['#5b9fd6', '#a6cbe6', '#dce8ed']; // the sky as it should appear on screen (top, middle, bottom); the texture is pre-compensated for the tone mapping, which washed the old blue out
let SKY_TEX = null;
function skyPaint(k) {
  // ... and fades into the colour of the fog
  if (!SKY_TEX) SKY_TEX = SKY_DISP.map(c => displayToTexel(new THREE.Color(c)));
  const c = SKY.image,
    x = c.getContext('2d'),
    F = displayToTexel(FOGW.col),
    m = i => '#' + SKY_TEX[i].clone().lerp(F, k).getHexString();
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, m(0));
  g.addColorStop(0.55, m(1));
  g.addColorStop(1, m(2));
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  SKY.needsUpdate = true;
}
skyPaint(0);
function fogWallTick(dt) {
  if (!FOGW.base) FOGW.base = { col: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far };
  const B = FOGW.base,
    k = sstep(0, 1, FOG.k);
  FOGW.ego = clamp(FOGW.ego + (V.poss ? 1 : -1) * dt * 2.5, 0, 1);
  if (k <= 0) {
    if (FOGW.active) {
      FOGW.active = false;
      scene.fog.color.copy(B.col);
      scene.fog.near = B.near;
      scene.fog.far = B.far;
      FOGW.k.value = 0;
      skyPaint(0);
      FOGW.sk = 0;
      clouds.forEach(c => (c.visible = QS.clouds !== false));
      const vg = $('#vignette');
      if (vg) vg.style.opacity = '';
    }
    return;
  }
  if (!FOGW.active) {
    fogDeckHeight();
    fogHintBuild();
  }
  FOGW.active = true;
  FOGW.t.value += dt;
  const e = FOGW.ego;
  {
    const vg = $('#vignette');
    if (vg) vg.style.opacity = String(1 - 0.7 * k * e);
  }
  scene.fog.near = lerp(B.near, lerp(70, FOG_EGO.near, e), k);
  scene.fog.far = lerp(B.far, lerp(190, FOG_EGO.far, e), k);
  scene.fog.color.copy(B.col).lerp(FOGW.col, k);
  FOGW.k.value = k * (1 - e); // the wall itself only in the commander view; in the ego view the dense camera fog does the hiding
  FOGW.hk.value = 0.32 * k * (1 - e); // the faded map in the fog top: orientation in the commander view
  if (Math.abs(k - (FOGW.sk || 0)) > 0.02 || (k >= 1 && FOGW.sk < 1)) {
    FOGW.sk = k;
    skyPaint(k);
  }
  clouds.forEach(c => (c.visible = QS.clouds !== false && k < 0.5));
  if ((FOGW.upd -= dt) <= 0) {
    FOGW.upd = 0.1;
    fogWallMapDraw();
  }
}
function wagonMesh() {
  const g = new THREE.Group(),
    wood = lam(0x8a5a30),
    dark = lam(0x4a2e18),
    gold = lam(0xf2c14e);
  mesh(new THREE.BoxGeometry(1.6, 0.7, 2.6), wood, 0, 0.95, 0, g).castShadow = true;
  mesh(new THREE.BoxGeometry(1.75, 0.12, 2.75), dark, 0, 0.62, 0, g);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12).rotateZ(Math.PI / 2), dark, sx * 0.95, 0.42, sz * 0.95, g);
      w.userData.wheel = 1;
      mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8).rotateZ(Math.PI / 2), gold, 0, 0, 0, w);
    }
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6).rotateX(Math.PI / 2), dark, 0, 0.8, 2.1, g); // shaft
  for (let i = 0; i < 5; i++) {
    const b = mesh(new THREE.SphereGeometry(0.34, 10, 8), lam(i % 2 ? 0xc9a24a : 0xa8804a), ((i % 3) - 1) * 0.42, 1.45, (i - 2) * 0.45, g);
    b.scale.y = 0.85;
    mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 10).rotateX(Math.PI / 2), lam(0xd23a2e), 0, 0.3, 0, b);
  }
  for (let i = 0; i < 7; i++)
    mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10),
      new THREE.MeshLambertMaterial({ color: lin(0xf2c14e), emissive: lin(0x553300) }),
      (Math.random() - 0.5) * 1.2,
      1.32 + Math.random() * 0.4,
      (Math.random() - 0.5) * 2,
      g
    );
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), lam(0xa5a9b0), 0.6, 2.2, -1.1, g);
  const cloth = mesh(
    new THREE.PlaneGeometry(0.9, 0.55).translate(0.45, 0, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    0.62,
    3.0,
    -1.1,
    g
  );
  g.userData.cloth = cloth;
  const ring = mesh(
    new THREE.RingGeometry(5.6, 6, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.5, depthWrite: false }),
    0,
    0.12,
    0,
    g
  );
  g.userData.ring = ring;
  ring.renderOrder = 6;
  inkify(g);
  scene.add(g);
  return g;
}
function eventView(s, dt) {
  const ev = s.ev;
  const fogOn = (!!(ev && ev[0] === EV_FOG) || !!s.fg) && !V.tut;
  if (s.fg && !V.fgCam) {
    V.fgCam = true;
    if (!V.poss && !V.tut) {
      homeCam();
      applyCam();
    }
  } // a guest learns of the fog mode with the first snapshot
  if (fogOn !== FOG.on) {
    FOG.on = fogOn;
    if (fogOn && V.playing) {
      if (s.fg) hlPush('fogMode', -1, 0, 0, 0);
      else toast(TR('Nebelwand! Man sieht nur noch, was nahe bei den eigenen Kriegern ist.'), 3600);
    }
  }
  FOG.k = FOG.on ? Math.min(1, FOG.k + dt / 2.5) : Math.max(0, FOG.k - dt / 2.5);
  if (FOG.on || FOG.k > 0) fogSources(s);
  fogWallTick(dt);
  // gold wagon
  if (s.wg) {
    let W = WV.wagon;
    const x = s.wg[0] / 10,
      z = s.wg[1] / 10,
      yaw = s.wg[2] / 100,
      owner = s.wg[3] - 1,
      mv = s.wg[4];
    if (!W) {
      W = WV.wagon = { g: wagonMesh(), x, z, yaw, owner: -2, t: 0 };
      W.g.position.set(x, groundY(x, z), z);
      puff(x, groundY(x, z) + 1, z, 0xffd34d, 12, 0.8);
      word(TR('GOLDWAGEN!'), x, groundY(x, z) + 4, z, { color: '#ffd34d', scale: 1.4 });
    }
    const f = Math.min(1, dt * 10);
    W.x = lerp(W.x, x, f);
    W.z = lerp(W.z, z, f);
    W.yaw += angDiff(yaw, W.yaw) * f;
    W.g.position.set(W.x, groundY(W.x, W.z) + (mv ? Math.abs(Math.sin(clock * 18)) * 0.05 : 0), W.z);
    W.g.rotation.y = W.yaw;
    if (mv)
      W.g.traverse(o => {
        if (o.userData.wheel) o.rotation.x += dt * 5;
      });
    if (owner !== W.owner) {
      W.owner = owner;
      const col = owner < 0 ? 0xffffff : FAC[V.facs[owner]].col;
      W.g.userData.cloth.material.color.copy(lin(col));
      W.g.userData.ring.material.color.set(owner < 0 ? 0xffd34d : FAC[V.facs[owner]].col);
      if (owner >= 0 && V.playing) {
        word(owner === V.myTeam ? TR('DU ESKORTIERST!') : TR('GEGNER ESKORTIERT!'), W.x, groundY(W.x, W.z) + 4, W.z, {
          color: owner === V.myTeam ? '#ffe08a' : '#ff9b8a',
          scale: 1.1,
        });
        SFX.play('coins', { x: W.x, z: W.z, vol: 0.8 });
      }
    }
    W.t += dt;
    if (owner >= 0 && W.t > 0.5) {
      W.t = 0;
      puff(W.x + (Math.random() - 0.5) * 1.5, groundY(W.x, W.z) + 1.6, W.z + (Math.random() - 0.5) * 2, 0xf2c14e, 2, 0.4);
      if (Math.random() < 0.5)
        word('+' + Math.round(CFG.wagonGold / 2), W.x, groundY(W.x, W.z) + 3.2, W.z, {
          color: owner === V.myTeam ? '#ffe08a' : '#ff9b8a',
          scale: 0.8,
        });
      if (owner === V.myTeam && Math.random() < 0.4) SFX.play('coins', { x: W.x, z: W.z, vol: 0.35 });
    }
    if (mv && Math.random() < dt * 4) SFX.play('wagon', { x: W.x, z: W.z, vol: 0.25 });
    W.g.userData.ring.material.opacity = 0.35 + 0.2 * Math.sin(clock * 3);
  } else if (WV.wagon) {
    const W = WV.wagon;
    scene.remove(W.g);
    puff(W.x, groundY(W.x, W.z) + 1, W.z, 0xffd34d, 10, 0.8);
    WV.wagon = null;
  }
  // flag migration
  if (s.fl && s.fl[0] !== WV.flagMv) {
    const first = WV.flagMv === undefined;
    WV.flagMv = s.fl[0];
    s.fl[1].forEach((q, i) => {
      const F = FLAGS[i];
      if (!F) return;
      const nx = q[0] / 10,
        nz = q[1] / 10;
      if (Math.abs(F.x - nx) < 0.05 && Math.abs(F.z - nz) < 0.05 && !first) return;
      moveFlagView(i, nx, nz, !first);
    });
  }
}
function moveFlagView(i, nx, nz, fx) {
  const F = flagViews[i],
    FL = FLAGS[i];
  if (!F) return;
  if (fx) {
    const ox = FL.x,
      oz = FL.z,
      oy = groundY(ox, oz);
    for (let k = 0; k < 10; k++)
      puff(ox + (Math.random() - 0.5) * 2, oy + 0.5 + Math.random() * 3, oz + (Math.random() - 0.5) * 2, 0xffffff, 1, 0.7);
    word(TR('UMZUG!'), ox, oy + 5, oz, { color: '#9fe8b8', scale: 1.1 });
  }
  FL.x = nx;
  FL.z = nz;
  const by = sampleH(MAP, nx, nz);
  F.by = by;
  F.g.position.set(nx, by, nz);
  F.g.updateMatrix();
  F.ring.geometry.dispose();
  F.ring.geometry = conformRing(FL, by, CFG.flagR - 0.22, CFG.flagR, 0, TAU);
  F.p = -999;
  if (fx) {
    for (let k = 0; k < 12; k++)
      puff(nx + (Math.random() - 0.5) * 2.5, by + 0.5 + Math.random() * 3, nz + (Math.random() - 0.5) * 2.5, 0x9fe8b8, 1, 0.8);
  }
}
function updateWorld(dt) {
  const s = V.latest;
  if (!s) return;
  if (NET.role === 'guest' && MAP && WV.holeSnapshot !== s.ih) {
    WV.holeSnapshot = s.ih;
    MAP.holes = (s.ih || []).map(h => ({ x: h[1] / 10, z: h[2] / 10, r: (h[3] || 11.4) / 10 }));
  }
  {
    const seenH = new Set();
    for (const h of s.ih || []) {
      seenH.add(h[0]);
      let v = WV.holes.get(h[0]);
      if (!v) {
        const x = h[1] / 10,
          z = h[2] / 10,
          g = new THREE.Object3D();
        g.position.set(x, Math.max(groundY(x, z), WL + 0.1) + 0.06, z);
        const hr = (h[3] || 11.4) / 10;
        v = { g, r: hr, angle: (x * 13 + z * 7) % TAU };
        WV.holes.set(h[0], v);
        WV.holeDirty = true;
        if (WV.holeInit) {
          emitFX('ice', x, WL + 0.4, z, { n: Math.round(10 * hr) });
          for (let q = 0; q < 10; q++) {
            const a = (q / 10) * TAU;
            puff(x + Math.cos(a) * hr, WL + 0.3, z + Math.sin(a) * hr, 0xdff6ff, 1, 0.7);
          }
          waterRipple(x, z, 1.2 * hr);
          SFX.play('splinter', { x, z });
          SFX.play('splat', { x, z, vol: 0.7 });
          word(pick([TR('KNACKS!'), TR('EINGEBROCHEN!'), TR('PLATSCH!')]), x, WL + 2.6, z, { color: '#9be7ff', scale: 1.2 });
        }
      }
    }
    for (const id of WV.holes.keys())
      if (!seenH.has(id)) {
        WV.holes.delete(id);
        WV.holeDirty = true;
      }
    syncHoleLayers();
    WV.holeInit = true;
  }
  (s.pd || []).forEach((e, i) => {
    const v = PADV[i];
    if (!v) return;
    if (v.n < 0) v.n = e[0];
    else if (e[0] !== v.n) {
      v.n = e[0];
      v.t = 0;
      const p = v.g.position;
      SFX.play('boing', { x: p.x, z: p.z, vol: 1.1 });
      SFX.play('creak', { x: p.x, z: p.z, vol: 0.6 });
      emitFX('pad', p.x, p.y + 0.3, p.z, { dx: Math.sin(v.g.rotation.y), dz: Math.cos(v.g.rotation.y), size: 0.8 });
      word(TR('BOING!'), p.x, p.y + 2.2, p.z, { color: '#ffd34d', scale: 1.1 });
    }
    v.cd = e[1] / 10;
    v.armed = e[2];
  });
  WV.pj.clear();
  for (const e of s.pj || []) WV.pj.set(e[0], e);
  if (V.poss) {
    const P = V.poss,
      e = WV.pj.get(P.id),
      state = unitMap(s).get(P.id);
    // A resumed tab may have missed every airborne packet. Persist the landing
    // acknowledgement so its next positional input cannot stay blocked forever.
    if (!e && state && state[15] && state[15] !== P.padAck) {
      P.padAck = state[15];
      P.x = state[2] / 10;
      P.z = state[3] / 10;
      P.pj = null;
      P.jumpT = 0;
      P.jDur = 0;
      P.fy = unitY(P.x, P.z);
      P.ivx = 0;
      P.ivz = 0;
      P.vy = 0;
    }
    if (e && P.padSnapT !== s.t) {
      P.padSnapT = s.t;
      P.padAck = e[6];
      const age = Math.max(0, (now() - V.offset) / 1000 - s.t),
        elapsed = Math.min(PAD_FLY, e[5] / 100 + age);
      if (!P.pj || P.pj.sx !== e[1] / 10 || P.pj.sz !== e[2] / 10) egoHint(TR('Huiii!'), 900);
      P.pj = { sx: e[1] / 10, sz: e[2] / 10, tx: e[3] / 10, tz: e[4] / 10, t: elapsed };
      P.jumpT = Math.max(0.001, PAD_FLY - elapsed);
      P.jDur = PAD_FLY;
      P.dashT = 0;
    }
    const a = airMap(s).get(P.id),
      ack = (state && state[16]) || 0;
    if (a && a[8] >= (P.airAck || 0)) P.airConfirmed = a[8];
    if (a && a[8] >= (P.airAck || 0) && a[8] !== P.airCompleted && (!P.air || P.air.ack !== a[8])) {
      P.x = a[1] / 10;
      P.z = a[3] / 10;
      P.fy = a[2] / 10;
      P.air = {
        vx: a[4] / 100,
        vy: a[5] / 100,
        vz: a[6] / 100,
        y: P.fy,
        sy: P.fy,
        t: 0,
        kind: a[7] === 1 ? 'dash' : a[7] === 2 ? 'impact' : 'fall',
        ack: a[8],
      };
      P.airAck = a[8];
      P.fall = 1;
      P.falling = true;
      P.pj = null;
      P.jumpT = 0;
      P.dashT = 0;
      airStep(P, Math.min(0.15, Math.max(0, (now() - V.offset) / 1000 - s.t)));
    } else if (
      !a &&
      state &&
      (ack > (P.airAck || 0) ||
        (P.air && P.airConfirmed === ack) ||
        (!P.air && P.airCompleted > ack && now() - (P.airEndAt || now()) > 600))
    ) {
      P.airAck = P.airCompleted = ack;
      P.air = null;
      P.fall = 0;
      P.falling = false;
      P.x = state[2] / 10;
      P.z = state[3] / 10;
      P.fy = unitY(P.x, P.z);
      P.vy = 0;
    }
  }
  WV.ic.clear();
  for (const e of s.ic || []) WV.ic.set(e[0], e[1]);
  WV.fz.clear();
  for (const id of s.fz || []) WV.fz.add(id);
  const br = (s.br || []).filter(b => !b[10]),
    bearIds = new Set(br.map(b => b[6]));
  for (let i = WV.bears.length - 1; i >= 0; i--)
    if (!bearIds.has(WV.bears[i].id)) {
      const v = WV.bears.splice(i, 1)[0];
      scene.remove(v.g);
      hpGroup.remove(v.hp);
      v.hp.visible = false;
      v.aura.visible = false;
      WV.bearPool.push(v);
    }
  br.forEach(b => {
    const x = b[0] / 10,
      z = b[1] / 10,
      y = groundY(x, z);
    let v = WV.bears.find(v => v.id === b[6]);
    if (!v) {
      v = WV.bearPool.pop() || bearMesh();
      v.id = b[6];
      v.atk = b[3];
      v.swipe = 0;
      v.walk = 0;
      v.tameFx = false;
      v.g.position.set(x, y, z);
      v.g.rotation.y = b[2] / 100;
      v.furMeshes.forEach(o => (o.material = v.fur));
      scene.add(v.g);
      hpGroup.add(v.hp);
      WV.bears.push(v);
    }
    v.g.position.x = lerp(v.g.position.x, x, Math.min(1, dt * 8));
    v.g.position.z = lerp(v.g.position.z, z, Math.min(1, dt * 8));
    v.g.position.y = y;
    v.g.rotation.y += angDiff(b[2] / 100, v.g.rotation.y) * Math.min(1, dt * 8);
    if (b[7]) {
      const age = s.pz > 0 ? 0 : Math.min(0.12, Math.max(0, (now() - V.offset) / 1000 - s.t));
      const elapsed = Math.min(BEAR_TAME, (b[7] - 1) / 100 + age),
        stand = sstep(BEAR_COLLAPSE + BEAR_GLOW, BEAR_TAME, elapsed);
      const collapse = sstep(0, BEAR_COLLAPSE, elapsed) * (1 - stand),
        team = b[8] - 1,
        F = FAC[V.facs[team] || 'viking'];
      v.body.rotation.set(0.14 * collapse, 0, -1.25 * collapse);
      v.body.position.y = 0.4 * collapse;
      v.head.rotation.set(0.28 * collapse, 0, 0);
      v.legs.forEach((l, k) => (l.rotation.x = collapse * (k < 2 ? -0.7 : 0.65)));
      v.hp.visible = false;
      const glow = sstep(BEAR_COLLAPSE, BEAR_COLLAPSE + BEAR_GLOW, elapsed);
      v.aura.visible = elapsed >= BEAR_COLLAPSE;
      v.aura.material = spriteMat('bearTame' + (F === FAC.viking ? 'V' : 'R'), () => tameHeartCanvas(F.css)).mat;
      v.aura.scale.setScalar((2.7 + Math.sin(elapsed * 14) * 0.2) * (1 - stand * 0.65));
      v.aura.position.y = 1.2 + glow * 1.1;
      const tint = bearTameMats[V.facs[team] || 'viking'][Math.round(glow * 8)];
      v.furMeshes.forEach(o => (o.material = tint));
      if (elapsed >= BEAR_COLLAPSE && !v.tameFx) {
        v.tameFx = true;
        if (typeof emitFX === 'function') emitFX('tame', x, y + 0.8, z, { col: F.col, n: 12 });
        else puff(x, y + 0.8, z, F.col, 12, 0.6);
        SFX.play('capture', { x, z, vol: 0.45 });
      }
      return;
    }
    v.aura.visible = false;
    v.body.position.y = 0;
    v.body.rotation.z = 0;
    v.gait = lerp(v.gait || 0, b[4] ? 1 : 0, 1 - Math.exp(-dt * 7));
    v.walk += dt * (b[4] === 2 ? 10 : b[4] ? 5.5 : 0);
    {
      const w = v.walk,
        g2 = v.gait,
        A = (b[4] === 2 ? 0.7 : 0.5) * g2,
        ph4 = [0, Math.PI, Math.PI + 0.5, 0.5];
      v.legs.forEach((l, k) => {
        const q = w + ph4[k];
        l.rotation.x = Math.sin(q) * A;
        l.position.y = 0.95 + Math.max(0, -Math.cos(q)) * 0.1 * g2;
      });
      v.body.rotation.z = Math.sin(w) * 0.03 * g2;
      v.body.position.y = Math.abs(Math.sin(w)) * 0.025 * g2 + Math.sin(clock * 1.8 + b[6]) * 0.006 * (1 - g2);
    }
    if ((b[9] || 0) !== (v.raise || 0)) {
      v.raise = b[9] || 0;
      v.rear = 0.4;
      SFX.play('rumble', { x, z, vol: 0.7 });
    }
    if (v.rear > 0) {
      v.rear -= dt;
      const q = Math.sin((clamp(1 - v.rear / 0.4, 0, 1) * Math.PI) / 2);
      v.body.rotation.x = -0.32 * q;
      v.legs[0].rotation.x = -1.3 * q;
      v.legs[1].rotation.x = -0.5 * q;
    }
    if (b[3] !== v.atk) {
      v.atk = b[3];
      v.swipe = 0.5;
      v.rear = 0;
      v.side = -(v.side || 1);
      const yw = v.g.rotation.y;
      clawStreak(v.g.position.x + Math.sin(yw) * 0.9, y + 1.3, v.g.position.z + Math.cos(yw) * 0.9, yw, v.side, 1.1);
      SFX.play('bearSwipe', { x, z, vol: 0.9 });
      if (Math.random() < 0.5) word(TR('GRRR!'), x, y + 3, z, { color: '#ffffff', scale: 0.9 });
    }
    if (v.swipe > 0) {
      v.swipe -= dt;
      v.body.rotation.x = -Math.sin(((0.5 - v.swipe) / 0.5) * Math.PI) * 0.45;
      v.legs[0].rotation.x = -1.6 * Math.sin(((0.5 - v.swipe) / 0.5) * Math.PI);
    } else if (!(v.rear > 0)) {
      v.body.rotation.x = 0;
      v.legs[1].rotation.x = 0;
    }
    v.head.rotation.x =
      Math.sin(v.walk * 2 + 0.5) * 0.08 * (v.gait || 0) + (1 - (v.gait || 0)) * Math.max(0, Math.sin(clock * 0.45 + b[6])) * 0.3;
    v.head.rotation.y = Math.sin(clock * 0.7 + b[6]) * 0.3 * (1 - 0.7 * (v.gait || 0));
    const hpP = b[5] ?? 100;
    v.hp.visible = hpP < 100;
    if (v.hp.visible) {
      v.hp.position.set(v.g.position.x, y + 3.4, v.g.position.z);
      v.hp.quaternion.copy(camera.quaternion);
      v.hpf.scale.x = Math.max(0.01, hpP / 100);
    }
  });
  if (s.bev && s.bev.length) {
    for (const e of s.bev) {
      if (WV.bevSeen === undefined) {
        WV.bevSeen = e[0];
        continue;
      }
      const df = (e[0] - WV.bevSeen + 10000) % 10000;
      if (df === 0 || df > 5000) continue;
      WV.bevSeen = e[0];
      const x = e[2] / 10,
        z = e[3] / 10,
        y = groundY(x, z),
        mine = e[1] === V.myTeam;
      const wm = e[4] === 1;
      word(
        wm ? (mine ? TR('SANDWURM GEZÄHMT!') : TR('Gegner zähmt Sandwurm!')) : mine ? TR('EISBÄR GEZÄHMT!') : TR('Gegner zähmt Eisbär!'),
        x,
        y + (wm ? 6 : 3.5),
        z,
        { color: mine ? '#9be7ff' : '#ff9b8a', scale: 1.4 }
      );
      if (typeof emitFX === 'function') emitFX('tame', x, y + 0.8, z, { col: FAC[V.facs[e[1]] || 'viking'].col, n: 14 });
      else puff(x, y + 0.8, z, 0xdff4ff, 14, 0.6);
      SFX.play('capture', { x, z, vol: mine ? 1 : 0.5 });
      if (mine) shake(0.2);
      if (mine)
        egoHint(
          wm
            ? TR('Der Sandwurm kämpft jetzt für dich! Übernimm ihn: Spezial = abtauchen und verschlingen')
            : TR('Der Eisbär kämpft jetzt für dich! Übernimm ihn für Bärenklauen!'),
          2600
        );
    }
  } else if (WV.bevSeen === undefined) WV.bevSeen = 0;
  const seen = new Set();
  for (const it of s.it || []) {
    seen.add(it[0]);
    let v = WV.items.get(it[0]);
    if (!v) {
      v = itemMesh(it[1]);
      WV.items.set(it[0], v);
      const x = it[2] / 10,
        z = it[3] / 10;
      v.g.position.set(x, groundY(x, z) + 1.1, z);
      puff(x, groundY(x, z) + 0.5, z, it[1] === 1 ? 0xff6bd5 : 0xf0bf4c, 5, 0.6);
    }
    // in the fog a pickup is only there where you can see: no glowing columns or icons floating in the grey (ego: fade out at the lantern's reach)
    const ix = v.g.position.x,
      iz = v.g.position.z,
      fv = !FOG.on
        ? 1
        : V.poss
          ? clamp((FOG_EGO.seen - Math.hypot(ix - camera.position.x, iz - camera.position.z)) / 5, 0, 1)
          : fogSeen(ix, iz)
            ? 1
            : 0;
    v.g.visible = fv > 0;
    if (!v.g.visible) continue;
    v.core.rotation.y += dt * 2;
    if (v.g.userData.beam) v.g.userData.beam.material.opacity = (0.16 + 0.1 * Math.sin(clock * 4 + it[0])) * fv;
    v.core.position.y = Math.sin(clock * 3 + it[0]) * 0.18;
    v.ring.material.opacity = (0.45 + Math.sin(clock * 4) * 0.25) * fv;
    v.sp.material.opacity = fv;
    v.sp.visible = !V.poss || Math.hypot(ix - V.poss.x, iz - V.poss.z) > 6;
  }
  for (const [id, v] of WV.items)
    if (!seen.has(id)) {
      scene.remove(v.g);
      disposeTree(v.g);
      WV.items.delete(id);
    }
  eventView(s, dt);
  if (s.pe && s.pe.length) {
    for (const e of s.pe) {
      if (WV.peSeen === undefined) {
        WV.peSeen = e[0];
        continue;
      }
      const df = (e[0] - WV.peSeen + 10000) % 10000;
      if (df === 0 || df > 5000) continue;
      WV.peSeen = e[0];
      const x = e[4] / 10,
        z = e[5] / 10,
        y = groundY(x, z),
        mine = e[1] === V.myTeam,
        F = FAC[V.facs[e[1]]];
      word(e[2] === 1 ? TR('+1 Discogranate') : '+' + e[3] + ' ' + F.res, x, y + 2.6, z, {
        color: mine ? '#ffe08a' : '#ff9b8a',
        scale: 1.1,
      });
      for (let k = 0; k < 10; k++)
        puff(
          x + (Math.random() - 0.5) * 1.5,
          y + 0.5 + Math.random(),
          z + (Math.random() - 0.5) * 1.5,
          e[2] === 1 ? 0xff6bd5 : 0xf0bf4c,
          1,
          0.5
        );
      SFX.play(e[2] === 1 ? 'pick' : 'capture', { x, z, vol: mine ? 1 : 0.5 });
      if (mine && V.poss)
        egoHint(
          e[2] === 1
            ? COARSE
              ? TR('Discogranate eingesammelt! Halte den Granaten-Knopf zum Werfen.')
              : TR('Discogranate eingesammelt! Halte {0} zum Werfen.', kl('nade'))
            : '+' + e[3] + ' ' + F.res + '!',
          1800
        );
    }
  } else if (WV.peSeen === undefined) WV.peSeen = 0;
  if (s.ct && s.ct.length)
    for (const id of s.ct) {
      const u = V.units.get(id);
      if (!u) continue;
      const t = now(),
        last = WV.prick.get(id) || 0;
      if (t - last < 1100) continue;
      WV.prick.set(id, t);
      const own = u.team === V.myTeam;
      u.flash = 0.25;
      puff(u.g.position.x, u.g.position.y + 1, u.g.position.z, 0x4f8f3a, 3, 0.4);
      if (own || (V.poss && V.poss.id === id)) {
        word(pick([TR('AUA! Kaktus!'), TR('AUTSCH!'), TR('Stachelig!')]), u.g.position.x, u.g.position.y + 3.2, u.g.position.z, {
          color: '#ff5a3c',
          scale: 0.9,
        });
        SFX.play('grunt', { x: u.g.position.x, z: u.g.position.z, k: u.k });
        if (V.poss && V.poss.id === id) {
          EG.kick = Math.max(EG.kick, 0.2);
          egoHint(TR('Aua! Weg vom Kaktus!'), 1000);
        }
      }
    }
}
