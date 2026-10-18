/* ---------- Fog guides (client only, purely visual). When the fog swallows everything, a few soft markers keep you oriented without
   giving away a single enemy: the flags (in their owner's colour), both bases, and in the ego view your own warriors as faint
   silhouettes. A marker only shows where the fog really hides the thing (commander: outside the clearings; ego: beyond ~15 m).
   Markers draw through the fog (fog: false) and over hills (depthTest: false). Called every frame from frame() (82-frame.js).
   Related: the small map in fog mode (drawMini, 50-input.js) and the faded map in the fog top (fogHintBuild, 70-world-view.js). ---------- */
const FGD = { root: null, flags: [], bases: [], silh: [], mats: new Map() };
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
  const hidden = (x, z) => (ego ? Math.hypot(x - cam.x, z - cam.z) > 15 : fogVis(x, z) < 0.45),
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
}
