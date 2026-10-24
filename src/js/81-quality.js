/* 81-quality.js - GRAPHICS QUALITY: guessQuality() picks a start level per device, perfTick() measures frame times and steps the quality up/down (QS, LADDER,
   GTIERS), applyQuality(). The profiler overlay (PROF) shows with ?perf=1. */
const PROF = {
  on: /[?&#]perf=1/.test(location.search + location.hash) || store.get('wvr-perf') === '1',
  s: {},
  frames: 0,
  t0: 0,
  worst: 0,
  ft: [],
  el: null,
  last: '',
};
function profFlush() {
  const P = PROF,
    t = performance.now(),
    el = t - P.t0;
  if (!P.t0) {
    P.t0 = t;
    return;
  }
  if (el < 500) return;
  const n = Math.max(1, P.frames),
    ri = renderer.info,
    sec = Object.entries(P.s)
      .map(([k, v]) => k + ' ' + (v / n).toFixed(1))
      .join(' · ');
  const ft = P.ft.slice().sort((a, b) => a - b),
    p95 = ft[Math.floor(ft.length * 0.95)] || 0,
    avg = ft.reduce((a, b) => a + b, 0) / (ft.length || 1);
  const cpu = Object.values(P.s).reduce((a, b) => a + b, 0) / n - (P.s.sim || 0) / n,
    sim = (P.s.sim || 0) / n,
    db = renderer.getDrawingBufferSize(new THREE.Vector2());
  let parts = fx.puffs.length;
  for (const k of ['projs', 'words', 'coins', 'swings']) if (fx[k]) parts += fx[k].length;
  P.last = {
    fps: +((P.frames / el) * 1000).toFixed(1),
    avg: +avg.toFixed(1),
    p95: +p95.toFixed(1),
    worst: +P.worst.toFixed(1),
    calls: ri.render.calls,
    tris: ri.render.triangles,
    geos: ri.memory.geometries,
    tex: ri.memory.textures,
    progs: ri.programs ? ri.programs.length : 0,
    units: V.units.size,
    parts,
    tier: QS.name(),
    pr: +renderer.getPixelRatio().toFixed(2),
    res: db.x + '×' + db.y,
    shadow: sun.castShadow ? sun.shadow.mapSize.x : 0,
    cpu: +cpu.toFixed(1),
    sim: +sim.toFixed(1),
    sec,
    bound: QS.bound,
  };
  if (P.el) {
    const L = P.last;
    P.el.textContent = `${L.fps} FPS · ${L.avg} ms (p95 ${L.p95}, max ${L.worst})\nDraw ${L.calls} · Tris ${(L.tris / 1000).toFixed(0)}k · Geo ${L.geos} · Tex ${L.tex} · Prog ${L.progs}\nEinheiten ${L.units} · Partikel ${L.parts}\nStufe ${L.tier} · PR ${L.pr} (${L.res}) · Schatten ${L.shadow || 'aus'}\nCPU ${L.cpu} ms/Frame + Sim ${L.sim} · ${L.bound || ''}\n${L.sec}`;
  }
  P.s = {};
  P.frames = 0;
  P.t0 = t;
  P.worst = 0;
  P.ft.length = 0;
}
function pm(k) {
  const n2 = performance.now();
  PROF.s[k] = (PROF.s[k] || 0) + n2 - PROF.p0;
  PROF.p0 = n2;
}
function profEl() {
  if (PROF.el) return;
  PROF.el = document.createElement('pre');
  PROF.el.id = 'perfHud';
  PROF.el.style.cssText =
    'position:fixed;left:6px;top:6px;z-index:99;margin:0;padding:6px 8px;background:rgba(0,0,0,.62);color:#bff7c4;font:11px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre;border-radius:6px';
  document.body.appendChild(PROF.el);
}
if (PROF.on) profEl();
addEventListener('keydown', e => {
  if (e.code !== 'F9') return;
  e.preventDefault();
  PROF.on = !PROF.on;
  store.set('wvr-perf', PROF.on ? '1' : '');
  if (PROF.on) {
    profEl();
    PROF.t0 = 0;
    PROF.s = {};
    PROF.frames = 0;
    PROF.ft.length = 0;
    PROF.worst = 0;
  }
  if (PROF.el) PROF.el.hidden = !PROF.on;
}); // F9: hidden performance overlay (also ?perf=1)
/* =====================================================================
   GRAPHICS QUALITY. Purely visual and local: nothing here touches the simulation, the AI or the network,
   so two players on LOW and HIGH play exactly the same game.
   ===================================================================== */
// pr: pixel-ratio cap · sc: share of devicePixelRatio · mp: max rendered megapixels · sh: shadow map size (0 = off) · shR: blur
// shEvery: shadow map refresh every n frames · unitSh: min part radius that casts · shDist: unit shadow range · veg: trees cast
// fx/fxCap: particle density and pool cap · deco: grass and flowers · wind: swaying vegetation · lod: animation distances
const GTIERS = [
  {
    id: 'high',
    name: TR('Hoch'),
    pr: COARSE ? 1.5 : 1.75,
    sc: 1,
    mp: 3.7,
    sh: 2048,
    shR: 2,
    shEvery: 1,
    unitSh: 0.22,
    shDist: 70,
    veg: true,
    fx: 1,
    fxCap: 192,
    ripples: 40,
    deco: true,
    wind: 1,
    lod: [48, 95],
  },
  {
    id: 'mid',
    name: TR('Mittel'),
    pr: 1.3,
    sc: 1,
    mp: 2.2,
    sh: 1024,
    shR: 1.5,
    shEvery: 2,
    unitSh: 0.3,
    shDist: 52,
    veg: true,
    fx: 0.7,
    fxCap: 128,
    ripples: 24,
    deco: true,
    wind: 1,
    lod: [34, 70],
  },
  {
    id: 'low',
    name: TR('Niedrig'),
    pr: 1.0,
    sc: 0.9,
    mp: 1.4,
    sh: 1024,
    shR: 1,
    shEvery: 3,
    unitSh: 0.4,
    shDist: 36,
    veg: false,
    fx: 0.42,
    fxCap: 76,
    ripples: 12,
    deco: true,
    wind: 0,
    lod: [28, 50],
  },
  {
    id: 'vlow',
    name: TR('Sehr niedrig'),
    pr: 0.8,
    sc: 0.75,
    mp: 0.9,
    sh: 0,
    shR: 0,
    shEvery: 0,
    unitSh: 9,
    shDist: 0,
    veg: false,
    fx: 0.25,
    fxCap: 48,
    ripples: 6,
    deco: false,
    wind: 0,
    lod: [20, 38],
  },
];
// AUTO walks this ladder. Odd rungs only lower the render resolution (helps a GPU limit); a CPU limit skips them.
const LADDER = [
  { t: 0, m: 1 },
  { t: 0, m: 0.86, res: 1 },
  { t: 1, m: 1 },
  { t: 1, m: 0.88, res: 1 },
  { t: 2, m: 1 },
  { t: 2, m: 0.88, res: 1 },
  { t: 3, m: 1 },
  { t: 3, m: 0.82, res: 1 },
  { t: 3, m: 0.66, res: 1 },
]; // the last two: AUTO only, for very weak GPUs
const LMAX = LADDER.length - 1;
const MANUAL_LVL = { high: 0, mid: 2, low: 4, vlow: 6 };
function guessQuality() {
  // first-start estimate only; measured frame times take over during play
  let gpu = '';
  try {
    const gl = renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch (_) {}
  const cores = navigator.hardwareConcurrency || 4,
    mem = navigator.deviceMemory || 4,
    dpr = devicePixelRatio || 1;
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 6;
  const apple = /apple/i.test(gpu) || (/iphone|ipad|macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    strongMobile = apple || /adreno \(tm\) [6-8]\d\d|mali-g[7-9]\d|immortalis|xclipse/i.test(gpu);
  if (strongMobile) return cores <= 2 ? 2 : 0; // modern iPhones, iPads and flagship Androids start on Hoch; measurement still takes over
  let l = COARSE ? 2 : 0;
  if (cores <= 2 || mem <= 2) l = Math.max(l, 4);
  else if (cores <= 4 || mem < 4) l = Math.max(l, 2);
  if (/intel|mali|adreno|powervr|videocore/i.test(gpu) && !/iris xe|arc/i.test(gpu)) l = Math.max(l, 2);
  if (/hd graphics [2-5]\d{2,3}\b|gma|mali-4|adreno \(tm\) [34]\d\d/i.test(gpu)) l = Math.max(l, 4);
  if (COARSE && dpr >= 3 && cores <= 6) l = Math.max(l, 3);
  return l;
}
const QS = {
  lvl: 0,
  fr: 0,
  cap: 0,
  autoCap: 0,
  capT: 0,
  lastDraw: 0,
  ft: 16.7,
  cpu: 4,
  p95: 16.7,
  bad: 0,
  good: 0,
  hold: 3,
  t: 0,
  upFails: 0,
  lastUp: -1e9,
  downLoad: 0,
  bound: '',
  fc: 0,
  ver: 0,
  ring: new Float32Array(120),
  ri: 0,
  ptT: 0,
  shEvery: 1,
  unitSh: 0.22,
  shDist: 70,
  fx: 1,
  fxCap: 192,
  ripples: 40,
  waterFx: 1,
  lod: [48, 95],
  frameT0: 0,
  simMs: 0,
  cpuLast: 0,
  learned: false,
  mode() {
    return SET.gfx || 'auto';
  },
  tier() {
    return GTIERS[LADDER[this.lvl].t];
  },
  name() {
    const n = this.tier().name + (LADDER[this.lvl].m < 1 ? ' ' + TR('(−Auflösung)') : '');
    return this.mode() === 'auto' ? TR('Auto: {0}', n) : n;
  },
};
function initQuality() {
  const m = QS.mode();
  if (m !== 'auto') QS.lvl = MANUAL_LVL[m] ?? 2;
  else {
    const g = guessQuality(),
      saved = parseInt(store.get('wvr-qauto'), 10),
      sameGuess = String(store.get('wvr-qguess')) === String(g);
    QS.learned = Number.isFinite(saved) && sameGuess;
    QS.lvl = QS.learned ? clamp(saved, 0, LMAX) : g;
    store.set('wvr-qguess', String(g));
  }
  applyQuality();
}
function setGfx(mode) {
  SET.gfx = mode;
  saveBinds();
  if (mode !== 'auto') QS.lvl = MANUAL_LVL[mode];
  else {
    const saved = parseInt(store.get('wvr-qauto'), 10);
    QS.lvl = Number.isFinite(saved) ? clamp(saved, 0, LMAX) : guessQuality();
  }
  QS.bad = QS.good = 0;
  QS.hold = 3;
  QS.upFails = 0;
  QS.autoCap = 0;
  QS.capT = 0;
  applyQuality();
  gfxUi();
}
function applyQuality() {
  const L = LADDER[QS.lvl],
    T = GTIERS[L.t],
    ov = (key, map) => {
      const v = SET[key];
      return v && v !== 'auto' && map[v] !== undefined ? map[v] : null;
    };
  const shT = GTIERS[ov('gfxSh', { high: 0, low: 2, off: 3 }) ?? L.t],
    fxT = GTIERS[ov('gfxFx', { high: 0, mid: 1, low: 2 }) ?? L.t],
    resO = ov('gfxRes', { high: 0, mid: 1, low: 2 }),
    resT = GTIERS[resO ?? L.t],
    resM = resO === null ? L.m : 1;
  // render resolution: never full retina on a weak GPU, never more megapixels than the tier allows
  const dpr = devicePixelRatio || 1,
    css = Math.max(1, innerWidth * innerHeight) / 1e6;
  const pr = Math.max(0.5, Math.min(dpr * resT.sc, resT.pr, Math.sqrt(resT.mp / css)) * resM);
  if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) {
    renderer.setPixelRatio(pr);
    resize();
  }
  // shadows: map size and blur only change on a tier change; switching them fully off recompiles shaders once
  const shOn = shT.sh > 0;
  if (sun.castShadow !== shOn) sun.castShadow = shOn;
  if (shOn && sun.shadow.mapSize.x !== shT.sh) {
    sun.shadow.mapSize.set(shT.sh, shT.sh);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  sun.shadow.radius = shT.shR + 1;
  QS.shEvery = shT.shEvery;
  renderer.shadowMap.autoUpdate = shT.shEvery === 1;
  renderer.shadowMap.needsUpdate = true;
  QS.unitSh = shT.unitSh;
  QS.shDist = shT.shDist;
  QS.vegSh = shT.veg;
  QS.ver++;
  contactMat.opacity = shOn && shT.unitSh < 1 ? 0.5 : 0.65; // without real unit shadows the soft contact shadow carries the grounding
  QS.fx = fxT.fx;
  QS.fxCap = fxT.fxCap;
  QS.ripples = fxT.ripples;
  QS.waterFx = fxT === GTIERS[0] || fxT === GTIERS[1] ? 1 : 1.8;
  QS.lod = T.lod;
  windStrength.value = T.wind;
  QS.deco = T.deco;
  // light tiers: no blurred HUD glass (the browser re-blurs the moving 3D image behind every panel each frame),
  // per-vertex lit water instead of per-pixel, no clouds, low-poly heads, no reverb, fewer simultaneous sounds
  const lt = L.t;
  document.body.classList.toggle('gfx-lite', lt >= 1);
  water.material = lt >= 2 ? WATER_LO : WATER_HI;
  QS.clouds = lt < 3;
  clouds.forEach(c => {
    c.visible = QS.clouds && !FOGW.active;
  });
  QS.lowPoly = lt >= 2;
  AUDIO.lite = lt >= 2;
  QS.ink = lt <= 1;
  INK.visible = QS.ink; // ink outlines on Hoch and Mittel
  applyMapQuality();
}
function applyMapQuality() {
  if (!mapGroup) return;
  for (const o of mapGroup.children) {
    if (o.userData.deco) o.visible = QS.deco !== false;
    if (o.userData.shadowTier === 1) o.castShadow = QS.vegSh !== false;
  }
}
function qualityStep(dir, bound, n = 1) {
  const from = QS.lvl,
    d = Math.sign(dir);
  let to = from;
  for (let i = 0; i < n; i++) {
    to += d;
    if (bound === 'CPU') while (to > 0 && to < LMAX && LADDER[to].res) to += d;
  } // a CPU limit is not helped by fewer pixels: go straight to lighter features
  to = clamp(to, 0, LMAX);
  if (bound === 'CPU' && d > 0 && LADDER[to].res) return false; // nothing left that would help the CPU
  if (to === from) return false;
  QS.lvl = to;
  QS.hold = 3;
  QS.bad = QS.good = 0;
  store.set('wvr-qauto', String(to));
  applyQuality();
  gfxUi();
  return true;
}
function perfTick(rawDt, force) {
  if (QS.lock && !force) return; // test hook: lets a test drive AUTO with synthetic frame times
  const ms = Math.min(rawDt * 1000, 250),
    k = 1 - Math.exp(-Math.min(rawDt, 0.25) / 0.8);
  QS.ring[(QS.ri = (QS.ri + 1) % QS.ring.length)] = ms;
  if (
    V.mode === 'menu' ||
    document.hidden ||
    !V.playing ||
    paused ||
    !$('#pause').hidden ||
    !$('#gfxScr').hidden ||
    !$('#sndScr').hidden ||
    V.ending
  ) {
    QS.bad = Math.max(0, QS.bad - rawDt);
    QS.good = 0;
    return;
  }
  QS.ft += (ms - QS.ft) * k;
  QS.cpu += (QS.cpuLast - QS.cpu) * k;
  QS.t += rawDt;
  if ((QS.ptT -= rawDt) <= 0) {
    QS.ptT = 1;
    const a = Array.from(QS.ring)
      .filter(v => v > 0)
      .sort((x, y) => x - y);
    QS.p95 = a[Math.floor(a.length * 0.95)] || ms;
  }
  QS.bound = QS.ft > 19 ? (QS.cpu > QS.ft * 0.78 ? 'CPU' : 'GPU') : '';
  // Frame-rate cap: on weak devices a steady 30 fps feels smoother than 30-48 fps that jump between vsync intervals.
  // 'auto' caps once the lightest settings still only reach about 30-47 fps for several seconds.
  const fm = SET.gfxFps || 'auto',
    want = fm === '30' ? 30 : fm === 'off' ? 0 : QS.autoCap;
  if (fm === 'auto' && !QS.autoCap) {
    if (QS.lvl >= (QS.mode() === 'auto' ? 6 : 4) && QS.ft > 21.3 && QS.ft < 34) QS.capT += rawDt;
    else QS.capT = Math.max(0, QS.capT - rawDt);
    if (QS.capT > 7) {
      QS.autoCap = 30;
      QS.hold = 3;
      QS.bad = 0;
    }
  }
  if (QS.cap !== want) {
    QS.cap = want;
    QS.lastDraw = 0;
    gfxUi();
  }
  if (QS.mode() !== 'auto') return;
  if ((QS.hold -= rawDt) > 0) return;
  // did the last downgrade actually help? Two steps without any gain mean the limit is elsewhere (e.g. the browser caps
  // the frame rate in battery-saving mode): undo them and stop lowering the quality for this session.
  if (QS.chk && QS.t - QS.chk.t > 6) {
    const gain = QS.chk.ft / Math.max(1, QS.ft);
    QS.useless = gain < 1.08 ? (QS.useless || 0) + 1 : 0;
    QS.chk = null;
    if (QS.useless >= 2) {
      QS.useless = 0;
      QS.downBlock = true;
      QS.lvl = QS.preUseless;
      QS.hold = 3;
      store.set('wvr-qauto', String(QS.lvl));
      applyQuality();
      gfxUi();
      return;
    }
  }
  const units = V.units.size,
    fight = units >= 36 || fx.puffs.length > 90;
  // too slow: below ~44 fps on average, sustained for several seconds (shorter in a big fight, much shorter if hopeless)
  const slow = QS.cap ? 38 : 22.5; // capped at 30 fps: only count it as slow when even 30 cannot be held
  if (QS.ft > slow) QS.bad += rawDt * (QS.ft > 34 && !QS.cap ? 1.7 : 1);
  else QS.bad = Math.max(0, QS.bad - rawDt * 0.6);
  const need = !QS.learned && QS.t < 12 && QS.ft > 30 ? 2.5 : fight ? 4.5 : 7;
  if (QS.bad > need && QS.lvl < LMAX && !(QS.downBlock && QS.ft < 45) && (QS.lvl < 6 || QS.cap || QS.ft >= 34 || SET.gfxFps === 'off')) {
    // below 'Sehr niedrig' only when even a 30-fps cap would not hold
    if (QS.t - QS.lastUp < 45) QS.upFails++; // the last upgrade did not hold: wait longer next time
    if (!QS.useless) QS.preUseless = QS.lvl;
    QS.downLoad = Math.max(units, 8);
    const ft0 = QS.ft;
    if (qualityStep(+1, QS.bound, QS.ft > 45 && !QS.cap ? 2 : 1)) QS.chk = { ft: ft0, t: QS.t };
    return; // far too slow (under 22 fps): two rungs at once
  }
  // very smooth for a long time, and the scene is at least as busy as when we had to step down: try one step up
  // a solid 60 fps (16.7 ms) counts as smooth; anything rougher eats the smooth time up again three times as fast
  if (QS.ft < 17.6 && QS.p95 < 20.5 && !QS.cap) QS.good += rawDt;
  else QS.good = Math.max(0, QS.good - rawDt * 3);
  const wait = QS.upFails >= 3 ? Infinity : 32 * Math.pow(2, QS.upFails);
  if (QS.good > wait && QS.lvl > 0 && units >= QS.downLoad * 0.7) {
    if (qualityStep(-1)) QS.lastUp = QS.t;
  }
}
