/* ---------- Fog guides (client only, purely visual). When the fog swallows everything, a few soft markers keep you oriented without
   giving away a single enemy: the flags (in their owner's colour), both bases, and in the ego view your own warriors as faint
   silhouettes. A marker only shows where the fog really hides the thing (commander: outside the clearings; ego: beyond ~15 m).
   Markers draw through the fog (fog: false) and over hills (depthTest: false). Called every frame from frame() (82-frame.js).
   Related: the small map in fog mode (drawMini, 50-input.js) and the faded map in the fog top (fogHintBuild, 70-world-view.js).
   Also here: the watch fires on your own flags (held flags light the fog, FOG_SIGHT.flag), the lanterns of steered warriors (they see
   farther and are seen from farther: FOG_SIGHT.torch / lanternSeen). Footprints of enemies: see fogFeetTick below. ---------- */
const FGD = { root: null, flags: [], bases: [], silh: [], fires: [], lamps: [], mats: new Map() };
function fogGlowCanvas(inner, outer) {
  const c = cnv(64, 64),
    x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}
function fogGuideMat(key, draw) {
  let m = FGD.mats.get(key);
  if (!m) {
    const c = draw(),
      t = ctex(c);
    c._tex = t; // siCanvas draws its icon a moment later and refreshes the texture through this
    m = new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true, fog: false });
    FGD.mats.set(key, m);
  }
  return m;
}
function fogSilhouetteCanvas(css) {
  // a little standing figure in the team colour with a dark rim
  const c = cnv(64, 96),
    x = c.getContext('2d');
  x.fillStyle = css;
  x.strokeStyle = 'rgba(13,21,38,.85)';
  x.lineWidth = 5;
  x.beginPath();
  x.arc(32, 22, 14, 0, TAU);
  x.moveTo(12, 92);
  x.quadraticCurveTo(10, 42, 32, 40);
  x.quadraticCurveTo(54, 42, 52, 92);
  x.closePath();
  x.stroke();
  x.fill();
  return c;
}
function fogGuideSprite(list, i) {
  let sp = list[i];
  if (!sp) {
    sp = list[i] = new THREE.Sprite();
    sp.renderOrder = 7;
    FGD.root.add(sp);
  }
  return sp;
}
function fogGuidesTick() {
  const on = FOG.on && FOG.k > 0.05 && V.playing && !V.tut && !!MAP && !!BASES[0];
  if (!FGD.root) {
    if (!on) return;
    FGD.root = new THREE.Group();
    scene.add(FGD.root);
  }
  FGD.root.visible = on;
  if (!on) return;
  const ego = !!V.poss,
    cam = camera.position,
    s = V.latest,
    a = Math.min(1, FOG.k);
  // hidden = the fog really covers it from where you look; size = about the same on screen at any distance
  const hidden = (x, z) => (ego ? Math.hypot(x - cam.x, z - cam.z) > FOG_EGO.guide : fogVis(x, z) < 0.45),
    size = (x, y, z, k) =>
      ego ? clamp(Math.hypot(x - cam.x, y - cam.y, z - cam.z) * 0.06 * k, 1.2, 6) : clamp(camS.dist * 0.075 * k, 2.2, 6);
  FLAGS.forEach((F, i) => {
    const sp = fogGuideSprite(FGD.flags, i),
      owner = s && s.f && s.f[i] ? s.f[i][0] : -1,
      col = owner < 0 ? '#eceae4' : FAC[V.facs[owner]].css;
    sp.visible = hidden(F.x, F.z);
    if (!sp.visible) return;
    sp.material = fogGuideMat('flag' + col, () => siCanvas('flag', 96, col));
    sp.material.opacity = 0.9 * a;
    const y = groundY(F.x, F.z) + 6.2,
      sc = size(F.x, y, F.z, 1);
    sp.position.set(F.x, y, F.z);
    sp.scale.set(sc, sc, 1);
  });
  for (let i = FLAGS.length; i < FGD.flags.length; i++) FGD.flags[i].visible = false; // a map with fewer flags than the last one
  BASES.forEach((B, i) => {
    const sp = fogGuideSprite(FGD.bases, i),
      col = FAC[V.facs[i]].css;
    sp.visible = hidden(B.x, B.z);
    if (!sp.visible) return;
    sp.material = fogGuideMat('base' + col, () => siCanvas('tower', 112, col));
    sp.material.opacity = (i === V.myTeam ? 0.9 : 0.75) * a;
    const y = groundY(B.x, B.z) + BASE_H + 5,
      sc = size(B.x, y, B.z, 1.3);
    sp.position.set(B.x, y, B.z);
    sp.scale.set(sc, sc, 1);
  });
  let n = 0;
  if (ego)
    for (const u of V.units.values()) {
      // your own warriors in the ego view: faint figures where the fog hides them
      if (u.team !== V.myTeam || u.id === V.poss.id || !u.g.visible) continue;
      const p = u.g.position;
      if (!hidden(p.x, p.z) || n >= 60) continue;
      const sp = fogGuideSprite(FGD.silh, n++);
      sp.visible = true;
      sp.material = fogGuideMat('silh' + FAC[V.facs[V.myTeam]].css, () => fogSilhouetteCanvas(FAC[V.facs[V.myTeam]].css));
      sp.material.opacity = 0.55 * a;
      const sc = size(p.x, p.y + 1.4, p.z, 0.7);
      sp.position.set(p.x, p.y + 1.2 + sc * 0.5, p.z);
      sp.scale.set(sc * 0.67, sc, 1);
    }
  for (let i = n; i < FGD.silh.length; i++) FGD.silh[i].visible = false;
  // watch fires on the flags you hold: they light the fog around them
  let nf = 0;
  if (s && s.f)
    FLAGS.forEach((F, i) => {
      if (!s.f[i] || s.f[i][0] !== V.myTeam) return;
      const sp = fogGuideSprite(FGD.fires, nf++),
        fl = 0.85 + 0.15 * Math.sin(clock * 9 + i * 1.7) * Math.sin(clock * 5.3 + i);
      sp.visible = true;
      sp.material = fogGuideMat('fire', () => fogGlowCanvas('rgba(255,236,170,1)', 'rgba(255,140,40,0.55)'));
      sp.material.blending = THREE.AdditiveBlending;
      sp.material.depthTest = true; // a real fire: hidden behind hills, unlike the markers
      sp.material.opacity = 0.85 * a;
      sp.position.set(F.x, groundY(F.x, F.z) + 4.6, F.z);
      sp.scale.set(2.6 * fl, 2.6 * fl, 1);
    });
  for (let i = nf; i < FGD.fires.length; i++) FGD.fires[i].visible = false;
  // lanterns of steered warriors (yours in the commander view, enemies' when they are within the lantern's reach of your warriors)
  let nl = 0;
  const mine = [];
  for (const u of V.units.values()) if (u.team === V.myTeam) mine.push(u.g.position);
  if (V.poss) mine.push({ x: V.poss.x, z: V.poss.z });
  for (const u of V.units.values()) {
    if (!u.isPoss || !u.g.parent || (V.poss && u.id === V.poss.id)) continue;
    const p = u.g.position;
    if (u.team !== V.myTeam && !mine.some(q => Math.hypot(q.x - p.x, q.z - p.z) < FOG_SIGHT.lanternSeen)) continue;
    const sp = fogGuideSprite(FGD.lamps, nl++);
    sp.visible = true;
    sp.material = fogGuideMat('lamp', () => fogGlowCanvas('rgba(255,248,210,1)', 'rgba(255,190,90,0.5)'));
    sp.material.blending = THREE.AdditiveBlending;
    sp.material.depthTest = true;
    sp.material.opacity = 0.9 * a;
    sp.position.set(p.x, p.y + 2.3, p.z);
    sp.scale.set(2.2, 2.2, 1);
  }
  for (let i = nl; i < FGD.lamps.length; i++) FGD.lamps[i].visible = false;
}
/* ---------- Footprints in the fog: where an enemy walks within your sight (and a little beyond, in the fading edge), it leaves big dark
   prints – feet, hooves, E-Mobil tyres – that stay for FEET.life seconds and show through the fog (fog: false). So you see where it went
   after it vanished. Client only, three instanced meshes. Called every frame from frame() (82-frame.js). ---------- */
const FEET = { cap: 260, life: 9, step: 1.25, kinds: null, list: [] };
function feetCanvas(kind) {
  const c = cnv(64, 96),
    x = c.getContext('2d');
  x.fillStyle = '#fff';
  if (kind === 'foot') {
    x.beginPath();
    x.ellipse(32, 36, 17, 25, 0, 0, TAU); // ball of the foot
    x.fill();
    x.beginPath();
    x.ellipse(33, 76, 12, 15, 0, 0, TAU); // heel
    x.fill();
  } else if (kind === 'hoof') {
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.ellipse(32 + sx * 11, 46, 9, 30, sx * 0.12, 0, TAU);
      x.fill();
    }
  } else {
    x.fillRect(14, 4, 36, 88); // a tyre: a band with a tread
    x.globalCompositeOperation = 'destination-out';
    for (let y = 10; y < 90; y += 13) x.fillRect(14, y, 36, 5);
  }
  return c;
}
function feetInit() {
  FEET.kinds = {};
  for (const kind of ['foot', 'hoof', 'tyre']) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      mat = new THREE.MeshBasicMaterial({
        map: ctex(feetCanvas(kind)),
        color: lin(0x24180e),
        transparent: true,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      alpha = new THREE.InstancedBufferAttribute(new Float32Array(FEET.cap), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('instanceFade', alpha);
    mat.onBeforeCompile = sh => {
      // per-print fading, no fog (the prints are meant to be seen in it)
      sh.vertexShader =
        'attribute float instanceFade; varying float vFade;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = instanceFade;');
      sh.fragmentShader =
        'varying float vFade;\n' +
        sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFade;');
    };
    mat.customProgramCacheKey = () => 'feet';
    const im = new THREE.InstancedMesh(geo, mat, FEET.cap);
    im.count = 0;
    im.renderOrder = 3;
    im.frustumCulled = false;
    scene.add(im);
    FEET.kinds[kind] = { im, alpha };
  }
}
const feetKind = k => (k === 5 ? 'tyre' : k === 4 ? 'hoof' : 'foot');
function fogFeetTick() {
  const on = FOG.on && FOG.k > 0.05 && V.playing && !V.tut;
  if (!on && !FEET.list.length) return;
  if (!FEET.kinds) feetInit();
  const tn = now();
  if (on)
    for (const u of V.units.values()) {
      if (u.team === V.myTeam || !u.g.parent || KINDS[u.k].worm || KINDS[u.k].role === 'siege') continue;
      const p = u.g.position;
      if (u.fpX === undefined) {
        u.fpX = p.x;
        u.fpZ = p.z;
        u.fpS = 1;
        continue;
      }
      const dx = p.x - u.fpX,
        dz = p.z - u.fpZ,
        d = Math.hypot(dx, dz);
      if (d < FEET.step) continue;
      if (d > 6) {
        // a jump, a pad flight or a teleport: no trail across the gap
        u.fpX = p.x;
        u.fpZ = p.z;
        continue;
      }
      const seen = V.poss ? Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < FOG_EGO.far : fogVis(p.x, p.z) > 0.02;
      const yaw = Math.atan2(dx, dz),
        kind = feetKind(u.k),
        side = (u.fpS = -u.fpS) * (kind === 'tyre' ? 0.55 : 0.32);
      u.fpX = p.x;
      u.fpZ = p.z;
      if (!seen) continue;
      const x = p.x + Math.cos(yaw) * side,
        z = p.z - Math.sin(yaw) * side;
      FEET.list.push({ x, z, y: groundY(x, z) + 0.05, yaw, kind, t: tn });
      if (FEET.list.length > FEET.cap * 2) FEET.list.splice(0, FEET.list.length - FEET.cap * 2);
    }
  const life = FEET.life * 1000;
  FEET.list = FEET.list.filter(f => tn - f.t < life);
  const n = { foot: 0, hoof: 0, tyre: 0 },
    D = sandDummy;
  for (const f of FEET.list) {
    const K = FEET.kinds[f.kind],
      i = n[f.kind];
    if (i >= FEET.cap) continue;
    D.position.set(f.x, f.y, f.z);
    D.rotation.set(0, f.yaw, 0);
    if (f.kind === 'tyre') D.scale.set(0.42, 1, 1.1);
    else D.scale.set(0.62, 1, 0.92); // bigger than real feet: they must be seen from the commander's height
    D.updateMatrix();
    K.im.setMatrixAt(i, D.matrix);
    const age = (tn - f.t) / life;
    K.alpha.setX(i, (on ? 0.85 : 0.6) * Math.min(1, (1 - age) * 3));
    n[f.kind] = i + 1;
  }
  for (const kind in FEET.kinds) {
    const K = FEET.kinds[kind];
    K.im.count = n[kind];
    if (n[kind]) {
      K.im.instanceMatrix.needsUpdate = true;
      K.alpha.needsUpdate = true;
    }
  }
  if (!on && FEET.list.length && FOG.k <= 0.05) FEET.list.length = 0;
}
