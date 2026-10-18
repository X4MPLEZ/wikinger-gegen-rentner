/* 50-input.js - CAMERA + RTS INPUT: camS (commander camera), mouse/touch gestures (tap, lasso, pinch, pan), commandAt (orders), key bindings (BIND, BIND_DEF,
   the PC key screen: renderKeys/rebindTo), toScreen(), the small map in fog mode (drawMini). */
const camS = { x: 0, z: 30, dist: 55, yaw: 0, pitch: 0.98 },
  CAM_MAX = 110;
const tmpV = new THREE.Vector3(),
  plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1),
  ray = new THREE.Raycaster(),
  ndc = new THREE.Vector2();
function applyCam() {
  camS.x = clamp(camS.x, -HALF_W, HALF_W);
  camS.z = clamp(camS.z, -HALF_H - 4, HALF_H + 4);
  camS.dist = clamp(camS.dist, 14, CAM_MAX);
  const h = Math.sin(camS.pitch) * camS.dist,
    d = Math.cos(camS.pitch) * camS.dist;
  camera.position.set(camS.x + Math.sin(camS.yaw) * d, h + 1, camS.z + Math.cos(camS.yaw) * d);
  camera.lookAt(camS.x, 1, camS.z);
  camera.updateMatrixWorld();
  sun.target.position.set(camS.x, 0, camS.z);
  sun.position.copy(sun.target.position).add(SUN_OFF);
}
function setRay(sx, sy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function planeAt(sx, sy) {
  setRay(sx, sy);
  return ray.ray.intersectPlane(plane, new THREE.Vector3());
}
function groundAt(sx, sy) {
  setRay(sx, sy);
  if (groundMesh) {
    const hits = ray.intersectObject(groundMesh, false);
    if (hits.length) return hits[0].point;
  }
  return ray.ray.intersectPlane(plane, new THREE.Vector3());
}
const SCR = { r: null }; // the canvas rectangle, measured once per resize (no layout work for every marker and sound)
function toScreen(x, y, z) {
  tmpV.set(x, y, z).project(camera);
  const r = SCR.r || (SCR.r = canvas.getBoundingClientRect());
  return { x: r.left + ((tmpV.x + 1) / 2) * r.width, y: r.top + ((1 - tmpV.y) / 2) * r.height, vis: tmpV.z < 1 };
}
function setFov() {
  const portrait = camera.aspect < 1;
  camera.fov = V.poss ? (portrait ? 78 : 62) : portrait ? 62 : 46;
  camera.updateProjectionMatrix();
}
function resize() {
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  SCR.r = null;
  camera.aspect = w / h;
  setFov();
  const lc = $('#lasso');
  lc.width = w * (devicePixelRatio || 1);
  lc.height = h * (devicePixelRatio || 1);
}
addEventListener('resize', resize);
resize();
function homeCam() {
  const B = BASES[V.myTeam],
    fg = V.mode === 'guest' ? !!(V.latest && V.latest.fg) : !!((V.latest && V.latest.fg) || (G && G.fog)),
    f = fg ? 0.86 : 0.3;
  camS.yaw = V.myTeam ? Math.PI : 0;
  camS.x = B.x * f;
  camS.z = B.z * f;
  camS.dist = CAM_MAX;
  camS.pitch = 0.95;
} // fog mode: look at the base and its clearing, not into the fog
const lassoCtx = $('#lasso').getContext('2d');
function drawLasso(pts) {
  const d = devicePixelRatio || 1;
  lassoCtx.setTransform(d, 0, 0, d, 0, 0);
  lassoCtx.clearRect(0, 0, innerWidth, innerHeight);
  if (!pts || pts.length < 2) return;
  lassoCtx.beginPath();
  lassoCtx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) lassoCtx.lineTo(p[0], p[1]);
  lassoCtx.closePath();
  lassoCtx.fillStyle = 'rgba(240,191,76,.14)';
  lassoCtx.fill();
  lassoCtx.setLineDash([9, 7]);
  lassoCtx.lineWidth = 2.5;
  lassoCtx.strokeStyle = '#f0bf4c';
  lassoCtx.stroke();
  lassoCtx.setLineDash([]);
}
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function ownUnits() {
  return [...V.units.values()].filter(u => u.team === V.myTeam);
}
function pickUnit(sx, sy, own) {
  let best = null,
    bd = 34 * 34;
  for (const u of V.units.values()) {
    if (own && u.team !== V.myTeam) continue;
    const p = toScreen(u.g.position.x, u.g.position.y + 1.1, u.g.position.z),
      d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
let lastTap = { t: 0, k: -1 };
function pickBase(sx, sy) {
  const bv = baseViews[1 - V.myTeam];
  if (!bv) return null;
  setRay(sx, sy);
  return ray.intersectObject(bv.g, true).length ? BASES[1 - V.myTeam] : null;
}
function tapAt(sx, sy, additive, mouseL) {
  if (!V.playing) return;
  const u = pickUnit(sx, sy, false);
  if (u && u.team === V.myTeam && COARSE && V.selected.size && !V.selected.has(u.id) && !additive && !V.rallyMode) {
    commandAt(u.g.position);
    return;
  } // touch: tapping a comrade with a selection = go there (deselect with the X first to pick single units)
  if (u && u.team === V.myTeam) {
    const t = now();
    if (t - lastTap.t < 320 && lastTap.id === u.id) {
      for (const o of ownUnits()) {
        const p = toScreen(o.g.position.x, o.g.position.y + 1, o.g.position.z);
        if (o.k === u.k && p.vis && p.x > 0 && p.y > 0 && p.x < innerWidth && p.y < innerHeight) V.selected.add(o.id);
      }
    } else {
      if (!additive) V.selected.clear();
      V.selected.add(u.id);
    }
    lastTap = { t, k: u.k, id: u.id };
    hintDone('select');
    SFX.play('select');
    return;
  }
  if (u && u.team !== V.myTeam) {
    if (V.selected.size && !V.rallyMode) commandAt(u.g.position, false, u.id);
    return;
  } // a tap on an enemy is always an attack order, never a selection
  const eb = !V.rallyMode && pickBase(sx, sy);
  if (eb && V.selected.size) {
    commandAt(eb, false, -2);
    return;
  }
  if (mouseL && !COARSE && !V.rallyMode) {
    if (V.selected.size) {
      V.selected.clear();
      SFX.play('tick');
    }
    return;
  }
  const g = groundAt(sx, sy);
  if (g) commandAt(g);
}
function tutBlock(act) {
  if (!TUT.on || TUT.adv || TUT.sys) return false;
  const st = TUT.steps && TUT.steps[TUT.i];
  if (!st || st.free) return false;
  if ((st.allow || []).includes(act)) return false;
  if (now() - (TUT.blkT || 0) > 1500) {
    TUT.blkT = now();
    SFX.play('error');
    const c = $('.tut-card');
    c.classList.remove('in');
    void c.offsetWidth;
    c.classList.add('in');
    toast('Erst das machen, was ' + (TUT.nar ? TUT.nar.name : 'der Lehrer') + ' sagt', 1400);
  }
  return true;
}
function setRallyMode(on) {
  if (on && tutBlock('rally')) return;
  V.rallyMode = on;
  $('#rallyBtn').setAttribute('aria-pressed', String(on));
  if (on) toast('Tippe auf den Boden, wo die Sammelfahne hin soll.', 2600);
}
$('#rallyBtn').addEventListener('click', () => setRallyMode(!V.rallyMode));
function commandAt(g, forceMove, target) {
  const x = clampX(g.x),
    z = clampZ(g.z);
  if (V.rallyMode) {
    setRallyMode(false);
    sendCmd({ t: 'rally', x: Math.round(x), z: Math.round(z) });
    marker(x, z, 0xf0bf4c);
    SFX.play('order');
    TUT.flags.rally = true;
    toast('Sammelfahne versetzt. Neue Krieger laufen hierhin.', 1800);
    return;
  }
  if (V.selected.size) {
    if (tutBlock('order')) return;
    const mv = forceMove || V.orderMode === 'move';
    if (!mv && target === undefined && baseGap(BASES[1 - V.myTeam], x, z) < 0.9) target = -2;
    const accepted = sendCmd({
      t: 'order',
      ids: [...V.selected].slice(0, 80),
      x: +x.toFixed(1),
      z: +z.toFixed(1),
      m: mv ? 1 : 0,
      ...(target !== undefined && !mv ? { target } : {}),
    });
    if (accepted === false) return;
    marker(x, z, mv ? 0x86cdf5 : 0xf0bf4c);
    hintDone('order');
    SFX.play('order');
    if (mv) TUT.flags.moveOrder = true;
  } else if (now() - (V.noSelT || 0) > 4000) {
    V.noSelT = now();
    toast('Erst Krieger auswählen. Die Sammelfahne versetzt du mit dem Fahnen-Knopf.', 2400);
  }
}
function finishLasso(pts) {
  const sel = [];
  for (const u of ownUnits()) {
    const p = toScreen(u.g.position.x, u.g.position.y + 0.8, u.g.position.z);
    if (inPoly(p.x, p.y, pts)) sel.push(u.id);
  }
  V.selected = new Set(sel);
  if (sel.length) {
    hintDone('select');
    hintDone('lasso');
    SFX.play('select');
    TUT.flags.lasso = true;
  }
}
function marker(x, z, col) {
  const m = mesh(new THREE.RingGeometry(0.5, 0.8, 28).rotateX(-Math.PI / 2), basic(col, 0.9), x, groundY(x, z) + 0.15, z);
  scene.add(m);
  V.markers.push({ m, t: 0 });
}
const pointers = new Map();
let gest = null;
function resetInput() {
  pointers.clear();
  if (gest && gest.lp) clearTimeout(gest.lp);
  gest = null;
  drawLasso(null);
  if (typeof EG !== 'undefined') {
    EG.joy = null;
    EG.look = null;
    const j = $('#joy');
    if (j) j.hidden = true;
  }
  keys.clear();
  codes.clear();
  miniDrag = false;
  if (typeof EG !== 'undefined') {
    EG.fire = false;
    EG.fireK = false;
  }
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (V.mode === 'menu') return;
  if (e.isPrimary && pointers.size) resetInput();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now() });
  if (V.poss) {
    egoDown(e);
    return;
  }
  if (gest && gest.lp) clearTimeout(gest.lp);
  if (e.pointerType === 'mouse') {
    const mb = 'Mouse' + e.button;
    if (e.button === 0)
      gest = { type: 'mleft', sx: e.clientX, sy: e.clientY, moved: false, pts: [[e.clientX, e.clientY]], shift: e.shiftKey };
    else if (isB('rally', mb) && !isB('order', mb)) {
      e.preventDefault();
      if (V.playing) placeRallyAt(e.clientX, e.clientY);
      gest = { type: 'done' };
    } else
      gest = {
        type: 'mpan',
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
        grab: planeAt(e.clientX, e.clientY),
        right: isB('order', mb),
        shift: e.shiftKey,
      };
  } else if (pointers.size === 1) {
    gest = { type: 'touch', sx: e.clientX, sy: e.clientY, moved: false, grab: planeAt(e.clientX, e.clientY) };
    gest.lp = setTimeout(() => {
      if (gest && gest.type === 'touch' && !gest.moved) {
        gest.type = 'lasso';
        gest.pts = [[gest.sx, gest.sy]];
        drawLasso(gest.pts);
        try {
          navigator.vibrate && navigator.vibrate(12);
        } catch (_) {}
      }
    }, 330);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gest = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: camS.dist, grab: planeAt((a.x + b.x) / 2, (a.y + b.y) / 2) };
    drawLasso(null);
  }
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  p.t = now();
  if (V.poss) {
    egoMove(e);
    return;
  }
  if (!gest) return;
  const far = Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 9;
  if (gest.type === 'touch' || gest.type === 'mpan') {
    if (far) {
      gest.moved = true;
      if (gest.lp) clearTimeout(gest.lp);
    }
    if (gest.moved && gest.grab) panTo(gest.grab, e.clientX, e.clientY);
  } else if (gest.type === 'lasso' || gest.type === 'mleft') {
    if (gest.type === 'mleft' && far) gest.moved = true;
    const l = gest.pts[gest.pts.length - 1];
    if (Math.hypot(l[0] - e.clientX, l[1] - e.clientY) > 5) {
      gest.pts.push([e.clientX, e.clientY]);
      if (gest.type === 'lasso' || gest.moved) drawLasso(gest.pts);
    }
  } else if (gest.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    camS.dist = clamp((gest.dist0 * gest.d0) / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 30, CAM_MAX);
    applyCam(); /* touch: never closer than the overview still makes sense */
    if (gest.grab) panTo(gest.grab, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
});
function panTo(grab, sx, sy) {
  for (let i = 0; i < 2; i++) {
    const g = planeAt(sx, sy);
    if (!g) return;
    camS.x += grab.x - g.x;
    camS.z += grab.z - g.z;
    applyCam();
  }
}
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (V.poss) {
    egoUp(e);
    return;
  }
  if (!gest) return;
  if (gest.lp) clearTimeout(gest.lp);
  const cancelled = e.type === 'pointercancel';
  if (gest.type === 'touch' && !gest.moved && !cancelled) tapAt(gest.sx, gest.sy, false);
  else if (gest.type === 'lasso' && !cancelled) {
    if (gest.pts.length > 4) finishLasso(gest.pts);
    else tapAt(gest.sx, gest.sy, false);
  } else if (gest.type === 'mleft' && !cancelled) {
    if (gest.moved && gest.pts.length > 3) finishLasso(gest.pts);
    else tapAt(gest.sx, gest.sy, gest.shift, true);
  } else if (gest.type === 'mpan' && !gest.moved && gest.right && !cancelled) {
    const enemy = pickUnit(gest.sx, gest.sy, false),
      eb = pickBase(gest.sx, gest.sy),
      g = enemy && enemy.team !== V.myTeam ? enemy.g.position : eb || groundAt(gest.sx, gest.sy);
    if (g && V.playing) commandAt(g, gest.shift, enemy && enemy.team !== V.myTeam ? enemy.id : eb ? -2 : undefined);
  }
  if (gest.type === 'pinch') {
    gest = pointers.size ? { type: 'done' } : null;
    drawLasso(null);
    return;
  }
  if (!pointers.size) gest = null;
  drawLasso(null);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', e => {
  if (pointers.has(e.pointerId))
    endPointer({ pointerId: e.pointerId, type: 'pointercancel', clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType });
});
document.addEventListener(
  'touchend',
  e => {
    if (e.touches && e.touches.length === 0)
      setTimeout(() => {
        if (pointers.size) resetInput();
      }, 150);
  },
  { passive: true }
);
addEventListener('blur', () => {
  resetInput();
  mlReset();
});
addEventListener('focus', () => mlReset(120));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetInput();
    mlReset();
    // switching apps or tabs pauses a game against the computer (online the match runs on, see startSim)
    if (V.playing && V.mode === 'ai' && $('#pause').hidden && !V.ending) $('#menuBtn').click();
  } else mlReset(120);
});
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
  document.addEventListener(
    ev,
    e => {
      if (!document.body.classList.contains('zoomed')) e.preventDefault();
    },
    { passive: false }
  )
);
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  e => {
    const t = now();
    if (t - lastTouchEnd < 350 && e.target.closest && e.target.closest('#game') && !e.target.closest('button,input,canvas,.screen'))
      e.preventDefault();
    lastTouchEnd = t;
  },
  { passive: false }
);
function zoomCheck() {
  const vv = window.visualViewport;
  if (!vv) return;
  const zoomed = vv.scale > 1.02;
  if (zoomed && !zoomCheck.tried) {
    zoomCheck.tried = true;
    const m = document.querySelector('meta[name=viewport]');
    if (m) {
      const c = m.content;
      m.content = c + ',minimum-scale=1';
      setTimeout(() => {
        m.content = c;
      }, 60);
    }
  }
  if (!zoomed) zoomCheck.tried = false;
  const zw = $('#zoomwarn');
  if (!zw) return;
  zw.hidden = !zoomed;
  document.body.classList.toggle('zoomed', zoomed);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', zoomCheck);
  setInterval(zoomCheck, 1500);
}
$('#zoomReload').addEventListener('click', () => location.reload());
(() => {
  let m = document.querySelector('meta[name=viewport]');
  if (!m) {
    m = document.createElement('meta');
    m.name = 'viewport';
    document.head.appendChild(m);
  }
  m.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
})();
canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    if (V.poss) return;
    const before = planeAt(e.clientX, e.clientY);
    camS.dist *= Math.exp(e.deltaY * 0.0012);
    applyCam();
    if (before) panTo(before, e.clientX, e.clientY);
  },
  { passive: false }
);
const keys = new Set(),
  codes = new Set();
/* ---------- PC bindings (stored per browser) ---------- */
const BIND_DEF = {
  fwd: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Mouse0', 'Space'],
  special: ['Mouse2', 'KeyE'],
  jump: ['ShiftLeft', 'KeyC'],
  nade: ['KeyG', ''],
  hero: ['KeyR', ''],
  exit: ['KeyX', ''],
  cmdHere: ['KeyF', ''],
  cmdAtk: ['KeyV', ''],
  swap: ['Tab', 'KeyB'],
  take: ['Space', 'KeyF'],
  order: ['Mouse2', ''],
  rally: ['Mouse1', 'KeyT'],
  selAll: ['KeyQ', ''],
  desel: ['Escape', ''],
  mode: ['KeyR', ''],
  home: ['KeyH', ''],
  pause: ['KeyP', ''],
  s1: ['Digit1', ''],
  s2: ['Digit2', ''],
  s3: ['Digit3', ''],
  s4: ['Digit4', ''],
  selMelee: ['KeyZ', ''],
  selRanged: ['KeyX', ''],
  selCav: ['KeyC', ''],
  mute: ['KeyM', ''],
};
const BIND_GROUPS = [
  [
    'Ego-Krieger',
    [
      ['fwd', 'Vorwärts'],
      ['back', 'Rückwärts'],
      ['left', 'Links'],
      ['right', 'Rechts'],
      ['attack', 'Angriff'],
      ['special', 'Spezialfähigkeit'],
      ['jump', 'Springen (Perk)'],
      ['nade', 'Discogranate (halten)'],
      ['hero', 'Den Helden spielen (am Sandwurm)'],
      ['cmdHere', 'Alle zu mir'],
      ['cmdAtk', 'Alle greifen Blickziel an'],
      ['swap', 'Nächsten Krieger steuern'],
      ['exit', 'Ego verlassen'],
    ],
  ],
  [
    'Feldherr',
    [
      ['take', 'Krieger übernehmen'],
      ['order', 'Befehl geben'],
      ['rally', 'Sammelfahne setzen'],
      ['selAll', 'Alle auswählen'],
      ['desel', 'Auswahl aufheben'],
      ['mode', 'Angreifen/Laufen'],
      ['home', 'Kamera zur Basis'],
      ['pause', 'Pause'],
      ['s1', 'Einheit 1 ausbilden'],
      ['s2', 'Einheit 2 ausbilden'],
      ['s3', 'Einheit 3 ausbilden'],
      ['s4', 'Einheit 4 ausbilden'],
      ['selMelee', 'Nahkämpfer wählen'],
      ['selRanged', 'Fernkämpfer wählen'],
      ['selCav', 'Reiter wählen'],
      ['mute', 'Ton an/aus'],
    ],
  ],
];
let BIND = JSON.parse(JSON.stringify(BIND_DEF)),
  SET = { sens: 1, invY: false, edge: true };
try {
  const b = JSON.parse(store.get('wvr-bind') || 'null');
  if (b) {
    for (const k in BIND) if (Array.isArray(b[k])) BIND[k] = [b[k][0] || '', b[k][1] || ''];
    if (
      !b.hero &&
      ['fwd', 'back', 'left', 'right', 'attack', 'special', 'jump', 'nade', 'exit', 'cmdHere', 'cmdAtk', 'swap'].some(k =>
        BIND[k].includes('KeyR')
      )
    )
      BIND.hero = ['', ''];
  }
  /* R already taken by an own ego binding: the hero key stays free */ const st = JSON.parse(store.get('wvr-set') || 'null');
  if (st) Object.assign(SET, st);
} catch (_) {}
const saveBinds = () => {
  store.set('wvr-bind', JSON.stringify(BIND));
  store.set('wvr-set', JSON.stringify(SET));
};
const isB = (act, c) => !!c && BIND[act].includes(c),
  held = act => BIND[act].some(c => c && codes.has(c));
let KLAY = null;
try {
  if (navigator.keyboard && navigator.keyboard.getLayoutMap)
    navigator.keyboard
      .getLayoutMap()
      .then(m => {
        KLAY = m;
        refreshKbd();
        if (!$('#keysScr').hidden) renderKeys();
      })
      .catch(() => {});
} catch (_) {}
function keyLabel(c) {
  if (!c) return '–';
  if (
    KLAY &&
    (c.startsWith('Key') ||
      c.startsWith('Digit') ||
      /^(Minus|Equal|Bracket|Semicolon|Quote|Backquote|Comma|Period|Slash|Backslash|IntlBackslash)/.test(c))
  ) {
    const v = KLAY.get(c);
    if (v) return v.toUpperCase();
  }
  const M = {
    Mouse0: 'Linksklick',
    Mouse1: 'Mittelklick',
    Mouse2: 'Rechtsklick',
    Mouse3: 'Maus 4',
    Mouse4: 'Maus 5',
    Space: 'Leertaste',
    Escape: 'Esc',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift rechts',
    ControlLeft: 'Strg',
    ControlRight: 'Strg rechts',
    AltLeft: 'Alt',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Rücktaste',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    CapsLock: 'Feststell',
  };
  if (M[c]) return M[c];
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) return 'Num ' + c.slice(6);
  return c;
}
const kl = act => keyLabel(BIND[act][0] || BIND[act][1]);
const EDGE = { x: -1, y: -1, on: false, hud: false };
addEventListener('mousemove', e => {
  EDGE.x = e.clientX;
  EDGE.y = e.clientY;
  EDGE.on = V.playing && !V.poss;
  EDGE.hud = e.target !== canvas;
  swordCursor(e);
});
document.addEventListener('mouseout', e => {
  if (!e.relatedTarget) EDGE.on = false;
});
const SWORD_CUR =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#cfd6de"/><stop offset="1" stop-color="#8d98a5"/></linearGradient></defs><g stroke-linejoin="round" stroke-linecap="round"><path d="M1.5 1.5L7 2.6 21 16.6 16.6 21 2.6 7z" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M14 24.5L24.5 14M21 21l6.3 6.3" stroke="#fff" stroke-width="5.6"/><circle cx="28.2" cy="28.2" r="3.4" fill="#fff"/><path d="M1.5 1.5L7 2.6 21 16.6 16.6 21 2.6 7z" fill="url(#b)" stroke="#2a1c04" stroke-width="1.2"/><path d="M3.3 3.3L18.6 18.6" stroke="#fff" stroke-width=".9" opacity=".9"/><path d="M14 24.5L24.5 14" stroke="#2a1c04" stroke-width="4"/><path d="M14 24.5L24.5 14" stroke="#f0bf4c" stroke-width="2.2"/><path d="M21 21l6 6" stroke="#2a1c04" stroke-width="3.6"/><path d="M21 21l6 6" stroke="#8a5a35" stroke-width="2"/><circle cx="28.2" cy="28.2" r="2.2" fill="#f0bf4c" stroke="#2a1c04" stroke-width="1"/></g></svg>'
  ) +
  '") 2 2, crosshair';
let swT = 0;
function swordCursor(e) {
  if (COARSE || V.poss || !V.playing || e.target !== canvas) {
    if (canvas.style.cursor) canvas.style.cursor = '';
    return;
  }
  const t = now();
  if (t - swT < 70) return;
  swT = t;
  let cur = '';
  const u = pickUnit(e.clientX, e.clientY, false);
  if (u && u.team !== V.myTeam) cur = SWORD_CUR;
  else if (u) cur = 'pointer';
  else {
    const g = groundAt(e.clientX, e.clientY),
      eb = BASES[1 - V.myTeam];
    if (g && eb && baseGap(eb, g.x, g.z) < 1.2) cur = SWORD_CUR;
  }
  if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
}
function placeRallyAt(sx, sy) {
  if (tutBlock('rally')) return;
  const g = groundAt(sx, sy);
  if (!g) return;
  const x = clampX(g.x),
    z = clampZ(g.z);
  setRallyMode(false);
  sendCmd({ t: 'rally', x: Math.round(x), z: Math.round(z) });
  marker(x, z, 0xf0bf4c);
  SFX.play('order');
  TUT.flags.rally = true;
}
function togglePause() {
  if (!$('#gfxScr').hidden || !$('#keysScr').hidden || !$('#sndScr').hidden) {
    showScreen('pause');
    return;
  }
  if (!$('#pause').hidden) {
    $('#btnResume').click();
    return;
  }
  if (V.poss && document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch (_) {}
  }
  $('#menuBtn').click();
}
function refreshKbd() {
  if (COARSE) return;
  const kb = (sel, t) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    let k = el.querySelector('kbd.kb');
    if (!t || t === '–') {
      if (k) k.remove();
      return;
    }
    if (!k) {
      el.classList.add('haskb');
      k = document.createElement('kbd');
      k.className = 'kb';
      el.appendChild(k);
    }
    k.textContent = t;
  };
  $$('.spawn .main').forEach((b, i) => kb(b, kl('s' + (i + 1))));
  kb('#possBtn', kl('take'));
  kb('[data-sel="all"]', kl('selAll'));
  kb('[data-sel="none"]', kl('desel'));
  kb('#rallyBtn', kl('rally'));
  kb('#modeMv', kl('mode'));
  kb('#egoAtk', kl('attack'));
  kb('#egoSp', kl('special'));
  kb('#egoHero', kl('hero'));
  kb('#egoJump', kl('jump'));
  kb('#egoNade', kl('nade'));
  kb('#egoExit', kl('exit'));
  kb('#egoHere', kl('cmdHere'));
  kb('#egoAtkAll', kl('cmdAtk'));
  kb('#egoSwap', kl('swap'));
  kb('[data-sel="melee"]', kl('selMelee'));
  kb('[data-sel="ranged"]', kl('selRanged'));
  kb('[data-sel="cav"]', kl('selCav'));
  kb('#menuBtn', kl('pause'));
  $$('.muteBtn').forEach(b => kb(b, kl('mute')));
  kb('#tutNext', 'Enter');
  $$('.spawn .auto').forEach((b, i) => kb(b, '⇧' + kl('s' + (i + 1))));
  kb('#modeAtk', null);
}
setTimeout(refreshKbd, 0);
function egoAct(c, down, e) {
  if (down) {
    if (isB('attack', c)) {
      if (e) e.preventDefault();
      EG.fireK = true;
      egoAttack();
    }
    if (isB('special', c) && !(e && e.repeat)) egoSpecial();
    if (isB('jump', c)) egoJump();
    if (isB('nade', c) && !(e && e.repeat)) nadeStart();
    if (isB('cmdHere', c) && !(e && e.repeat)) {
      if (e) e.preventDefault();
      egoCmdHere();
    }
    if (isB('cmdAtk', c) && !(e && e.repeat)) {
      if (e) e.preventDefault();
      egoCmdAttack();
    }
    if (isB('swap', c) && !(e && e.repeat)) {
      if (e) e.preventDefault();
      egoSwitch();
    }
    if (isB('hero', c) && !(e && e.repeat)) egoHero();
    if ((c === 'Escape' && !PL.on) || isB('exit', c)) {
      if (tutBlock('exit')) return;
      if (V.poss.dance) {
        egoHint('Du tanzt noch! Verlassen geht erst danach.', 1600);
        return;
      }
      if (V.poss.heroOn || V.poss.heroReq) {
        egoHint('Ein Held kneift nicht!', 1400);
        return;
      }
      exitEgo(true);
    }
  } else {
    if (isB('attack', c)) EG.fireK = false;
    if (isB('nade', c)) nadeRelease();
  }
}
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || REB.act) return;
  const c = e.code,
    k = e.key.toLowerCase();
  keys.add(k);
  codes.add(c);
  if (!V.playing) return;
  const menuOpen = !$('#pause').hidden || !$('#gfxScr').hidden || !$('#keysScr').hidden || !$('#sndScr').hidden;
  if ((isB('pause', c) || (c === 'Escape' && menuOpen)) && !e.repeat) {
    e.preventDefault();
    togglePause();
    return;
  }
  if (menuOpen) return;
  if (isB('mute', c) && !e.repeat) {
    const mb = $('.muteBtn');
    if (mb) mb.click();
  }
  if (!$('#perkPick').hidden && !e.repeat) {
    const cards = $$('#perkCards .pcard'),
      n = c === 'Digit1' || c === 'Numpad1' ? 0 : c === 'Digit2' || c === 'Numpad2' ? 1 : -1;
    if (n >= 0 && cards[n]) {
      cards[n].click();
      return;
    }
  }
  if ((c === 'Enter' || c === 'NumpadEnter') && !$('#tutNext').hidden && TUT.on) {
    $('#tutNext').click();
    return;
  }
  if (V.poss) {
    egoAct(c, true, e);
    return;
  }
  for (let i = 1; i <= 4; i++)
    if (isB('s' + i, c) && !e.repeat) {
      if (e.shiftKey) {
        const a = $$('.spawn')[i - 1];
        a && a.querySelector('.auto').click();
      } else spawnSlot(i - 1);
    }
  if (isB('selAll', c)) selectGroup('all');
  if (isB('desel', c)) selectGroup('none');
  if (isB('selMelee', c)) selectGroup('melee');
  if (isB('selRanged', c)) selectGroup('ranged');
  if (isB('selCav', c)) selectGroup('cav');
  if (isB('mode', c)) setOrderMode(V.orderMode === 'attack' ? 'move' : 'attack');
  if (isB('rally', c) && !e.repeat) {
    if (EDGE.x >= 0 && !EDGE.hud) placeRallyAt(EDGE.x, EDGE.y);
    else setRallyMode(!V.rallyMode);
  }
  if (isB('home', c)) {
    homeCam();
    applyCam();
  }
  if (isB('take', c) && V.selected.size === 1) {
    e.preventDefault();
    enterEgo();
  }
});
addEventListener('keyup', e => {
  const c = e.code;
  keys.delete(e.key.toLowerCase());
  codes.delete(c);
  if (V.poss) egoAct(c, false, e);
});
addEventListener(
  'mousedown',
  e => {
    codes.add('Mouse' + e.button);
  },
  true
);
addEventListener(
  'mouseup',
  e => {
    codes.delete('Mouse' + e.button);
  },
  true
);
/* ---------- settings screen for bindings ---------- */
const REB = { act: null, idx: 0 };
function renderKeys() {
  const box = $('#keysList');
  if (!box) return;
  box.innerHTML = BIND_GROUPS.map(
    ([g, list]) =>
      `<div class="label">${g}</div>` +
      list
        .map(
          ([a, n]) =>
            `<div class="krow"><span>${n}</span>${[0, 1].map(i => `<button class="kbtn${REB.act === a && REB.idx === i ? ' wait' : ''}" data-a="${a}" data-i="${i}">${REB.act === a && REB.idx === i ? 'Taste drücken …' : keyLabel(BIND[a][i])}</button>`).join('')}</div>`
        )
        .join('')
  ).join('');
  $$('#keysList .kbtn').forEach(b =>
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      REB.act = b.dataset.a;
      REB.idx = +b.dataset.i;
      REB.t = now();
      renderKeys();
    })
  );
  $('#setSens').value = String(SET.sens);
  $('#setSensV').textContent = SET.sens.toFixed(1);
  $('#setInv').checked = !!SET.invY;
  $('#setEdge').checked = SET.edge !== false;
}
const actName = a => {
  for (const [, list] of BIND_GROUPS) for (const [k, n] of list) if (k === a) return n;
  return a;
};
function rebindTo(c) {
  if (!REB.act) return;
  if (c !== null) {
    const lost = [];
    for (const k in BIND)
      for (let i = 0; i < 2; i++)
        if (c && BIND[k][i] === c && !(k === REB.act && i === REB.idx) && sameCtx(k, REB.act)) {
          BIND[k][i] = '';
          lost.push(actName(k));
        }
    BIND[REB.act][REB.idx] = c;
    if (lost.length) {
      // say which action lost its key, so nothing goes missing unnoticed
      const n = $('#keysNote');
      n.textContent = keyLabel(c) + ' gehört jetzt zu „' + actName(REB.act) + '“ – „' + lost.join('“, „') + '“ hat dafür keine Taste mehr.';
      n.classList.add('warn');
      clearTimeout(REB.noteT);
      REB.noteT = setTimeout(() => {
        n.textContent = n.dataset.t;
        n.classList.remove('warn');
      }, 5000);
    }
  }
  REB.act = null;
  saveBinds();
  renderKeys();
  refreshKbd();
}
function sameCtx(a, b) {
  const ego = ['attack', 'special', 'jump', 'nade', 'exit', 'hero'],
    rts = ['take', 'order', 'rally', 'selAll', 'desel', 'mode', 'home', 's1', 's2', 's3', 's4', 'selMelee', 'selRanged', 'selCav'];
  const ca = ego.includes(a) ? 'e' : rts.includes(a) ? 'r' : 'b',
    cb = ego.includes(b) ? 'e' : rts.includes(b) ? 'r' : 'b';
  return ca === cb || ca === 'b' || cb === 'b';
}
addEventListener(
  'keydown',
  e => {
    if (!REB.act) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') {
      REB.act = null;
      renderKeys();
      return;
    }
    if (e.code === 'Backspace' || e.code === 'Delete') {
      rebindTo('');
      return;
    }
    rebindTo(e.code);
  },
  true
);
addEventListener(
  'mousedown',
  e => {
    if (!REB.act || now() - (REB.t || 0) < 150) return;
    const k = e.target.closest && e.target.closest('.kbtn');
    // the left button binds only on the waiting field itself; a left click anywhere else just stops waiting (so "Fertig" still works)
    if (e.button === 0 && !(k && k.classList.contains('wait'))) {
      if (!k) {
        REB.act = null;
        renderKeys();
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    rebindTo('Mouse' + e.button);
  },
  true
);
addEventListener('contextmenu', e => {
  if (REB.act || V.playing) e.preventDefault();
});
const mini = $('#mini'),
  miniCtx = mini.getContext('2d');
function miniJump(e) {
  const r = mini.getBoundingClientRect();
  let fx2 = (e.clientX - r.left) / r.width,
    fz = (e.clientY - r.top) / r.height;
  if (V.myTeam) {
    fx2 = 1 - fx2;
    fz = 1 - fz;
  }
  camS.x = -HALF_W + fx2 * 2 * HALF_W;
  camS.z = -HALF_H + fz * 2 * HALF_H;
  applyCam();
  TUT.flags.mini = true;
}
let miniDrag = false;
mini.addEventListener('pointerdown', e => {
  if (V.poss) return;
  miniDrag = true;
  mini.setPointerCapture(e.pointerId);
  miniJump(e);
});
mini.addEventListener('pointermove', e => {
  if (miniDrag) miniJump(e);
});
mini.addEventListener('pointerup', () => {
  miniDrag = false;
});
mini.addEventListener('pointercancel', () => {
  miniDrag = false;
});
function drawMini() {
  // the small map (top right): shown only in the fog mode, where it keeps you oriented – bases, flags in their owner's colour, your own
  // warriors, enemies only where you can see them, and the camera's view. Tap or drag it to move the camera there.
  const fogMode = !!(V.latest && V.latest.fg) && !V.tut;
  if (document.body.classList.contains('fogMode') !== fogMode) document.body.classList.toggle('fogMode', fogMode);
  if (!fogMode || !miniBg) return;
  const W = 140,
    H = Math.round((140 * HALF_H) / HALF_W);
  if (mini.width !== W) {
    mini.width = W;
    mini.height = H;
  }
  const c = miniCtx;
  c.save();
  if (V.myTeam) {
    c.translate(W, H);
    c.rotate(Math.PI);
  }
  c.imageSmoothingEnabled = true;
  c.drawImage(miniBg, 0, 0, W, H);
  const sx = x => ((x + HALF_W) / (2 * HALF_W)) * W,
    sz = z => ((z + HALF_H) / (2 * HALF_H)) * H;
  BASES.forEach((b, i) => {
    c.fillStyle = FAC[V.facs[i]].css;
    c.fillRect(sx(b.x) - 7, sz(b.z) - 5, 14, 10);
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5;
    c.strokeRect(sx(b.x) - 7, sz(b.z) - 5, 14, 10);
  });
  const s = V.latest;
  if (s)
    s.f.forEach((f, i) => {
      const F = FLAGS[i];
      c.fillStyle = f[0] < 0 ? '#eceae4' : FAC[V.facs[f[0]]].css;
      c.beginPath();
      c.arc(sx(F.x), sz(F.z), 5, 0, TAU);
      c.fill();
      c.strokeStyle = '#13203a';
      c.lineWidth = 1.5;
      c.stroke();
    });
  for (const u of V.units.values()) {
    if (u.team !== V.myTeam && (u.fogHid || !fogSeen(u.g.position.x, u.g.position.z))) continue; // the fog hides enemies here too
    c.fillStyle = u.team === V.myTeam ? '#ffffff' : '#ff5a4a';
    const r = u.isPoss ? 3.5 : 2;
    c.fillRect(sx(u.g.position.x) - r, sz(u.g.position.z) - r, r * 2, r * 2);
  }
  if (!V.poss) {
    const corners = [
      [0, 0],
      [innerWidth, 0],
      [innerWidth, innerHeight],
      [0, innerHeight],
    ]
      .map(([a, b]) => planeAt(a, b))
      .filter(Boolean);
    if (corners.length === 4) {
      c.strokeStyle = 'rgba(255,255,255,.9)';
      c.lineWidth = 2;
      c.beginPath();
      corners.forEach((p, i) => {
        const X = sx(clamp(p.x, -HALF_W * 1.2, HALF_W * 1.2)),
          Z = sz(clamp(p.z, -HALF_H * 1.2, HALF_H * 1.2));
        i ? c.lineTo(X, Z) : c.moveTo(X, Z);
      });
      c.closePath();
      c.stroke();
    }
  }
  c.restore();
}
