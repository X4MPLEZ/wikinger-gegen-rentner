/* 51-ego.js - EGO MODE (you steer one warrior): enterEgo/exitEgo, client-side movement prediction (egoUpdate) that sends the input packet to the host
   every frame, attacks/specials/jump/grenade (egoAttack, egoSpecial, egoJump, nadeStart/nadeRelease), aiming, the ego camera, ego sounds. */
const EG = {
  joy: null,
  look: null,
  sendT: 0,
  hintShown: false,
  cam: new THREE.Vector3(),
  lk: new THREE.Vector3(),
  camInit: false,
  intro: 0,
  kick: 0,
  piv: new THREE.Vector3(),
  pivT: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  want: new THREE.Vector3(),
  look3: new THREE.Vector3(),
  tmpA: new THREE.Vector3(),
  tmpB: new THREE.Vector3(),
  lift: 0,
};
function enterEgo() {
  if (tutBlock('take')) return;
  if (!V.playing || V.selected.size !== 1) return;
  const id = [...V.selected][0],
    u = V.units.get(id);
  if (!u || u.team !== V.myTeam) return;
  sendCmd({ t: 'poss', id });
  const K = KINDS[u.k];
  V.poss = {
    id,
    k: u.k,
    hen: !!u.hen,
    fh: u.flyH || 0, // a chicken's flight height (HFLY)
    x: u.g.position.x,
    z: u.g.position.z,
    yaw: u.g.rotation.y,
    camYaw: u.g.rotation.y,
    pitch: 0.16,
    a: 0,
    s: 0,
    cdT: 0,
    spT: 0,
    dashT: 0,
    rageT: 0,
    t0: now(),
    confirmed: false,
    ad: null,
  };
  mlReset();
  ML.lockErr = 0;
  ML.noLock = false;
  EG.look = null;
  EG.joy = null;
  EG.intro = 1.6;
  EG.kick = 0;
  $('#xhair').hidden = K.role !== 'ranged' && K.role !== 'siege';
  $('#xhair').className = '';
  V.selected.clear();
  gest = null;
  pointers.clear();
  $('#hud').hidden = true;
  $('#ego').hidden = false;
  drawLasso(null);
  document.body.classList.add('egoOn');
  if (!COARSE && canvas.requestPointerLock && !V.tutNoLock) {
    try {
      lockPointer();
    } catch (_) {}
  }
  $('#egoName').textContent = u.hen ? TR('Huhn') : K.name;
  $('#spName').textContent = u.hen ? TR('Fliegen') : K.sp || TR('Salve');
  $('#spIco').innerHTML = u.hen ? si('wing') : SP_ICON[u.k] || ICON.star;
  EG.spK = EG.spP = false;
  if (u.hen)
    setTimeout(
      () =>
        V.poss &&
        egoHint(
          COARSE
            ? TR('Huhn: Spezial gedrückt halten = aufsteigen, loslassen = sinken · Angriff in der Luft = Sturzflug')
            : TR('Huhn: {0} halten = aufsteigen, loslassen = sinken · Angriff in der Luft = Sturzflug', kl('special')),
          5200
        ),
      900
    );
  $('#egoResIco').innerHTML = ICON[FAC[V.facs[V.myTeam]].icon];
  EG.gtxt = '';
  $('#egoFace').src = FACE.mine ? FACE.mine.url : PORTRAIT[K.role === 'siege' ? FAC[V.facs[V.myTeam]].kinds[0] : u.k];
  EG.camInit = false;
  setFov();
  if (K.worm)
    setTimeout(
      () =>
        V.poss &&
        egoHint(
          TR(
            'Sandwurm: Angriff = Maul-Biss gegen alle vor dir · Spezial = eingraben, unter dem Sand steuern, nochmal Spezial = auftauchen und alle im Kreis verschlingen'
          ),
          5200
        ),
      1200
    );
  if (K.role === 'ranged' && !EG.aimHint) {
    EG.aimHint = true;
    setTimeout(
      () => V.poss && egoHint(TR('Du zielst selbst: Das Kreuz in der Mitte ist dein Ziel. Kopftreffer machen vierfachen Schaden!'), 5000),
      1900
    );
  } else if (!EG.hintShown) {
    EG.hintShown = true;
    setTimeout(
      () =>
        V.poss &&
        egoHint(
          COARSE
            ? TR('Links ziehen zum Laufen, rechts wischen zum Umschauen. Rechts unten angreifen.')
            : TR(
                '{0} laufen · Maus umschauen · {1}: angreifen (halten) · {2}: Spezial · {3}: verlassen',
                (kl('fwd') + kl('left') + kl('back') + kl('right')).replace(/[↑←↓→]/g, ''),
                kl('attack'),
                kl('special'),
                kl('exit')
              ),
          5000
        ),
      1900
    );
  }
}
function egoSound(P, dt, md) {
  // own footsteps by ground, hooves for the goat, the E-Mobil's motor, creaking catapult wheels, the bear's padding
  const K = KINDS[P.k],
    E = EG.snd || (EG.snd = { d: 0, side: 0, mot: 0, motor: null });
  const moving = md > dt * 0.6 && !P.air && !P.pj && !((P.jumpT || 0) > 0) && !P.down && !P.dance && !P.held;
  if (P.k === 5) {
    // the E-Mobil hums instead of stepping
    if (!E.motor) E.motor = SFX.loop('motor');
    const sp = clamp(md / Math.max(dt, 1e-3) / (K.speed * 1.15 * 1.6), 0, 1);
    E.mot = lerp(E.mot, moving ? sp : 0, 1 - Math.exp(-dt * 5));
    if (E.motor)
      E.motor.set(undefined, undefined, { hum: 0.022 + 0.03 * E.mot, whir: 0.006 + 0.016 * E.mot, tyre: 0.035 * E.mot, speed: E.mot }); // soft: it hums along under the footstep level
    return;
  }
  if (E.motor) {
    E.motor.stop();
    E.motor = null;
  }
  if (K.worm) return; // the sandworm has its own grinding voice
  if (!moving) {
    E.d = Math.min(E.d, 0.6);
    return;
  }
  E.d += md;
  const stride = K.role === 'siege' ? 2.6 : K.bear ? 1.9 : P.k === 4 ? 2.3 : 1.55;
  if (E.d < stride) return;
  E.d -= stride;
  E.side ^= 1;
  if (K.role === 'siege') {
    SFX.play('wheel', { vol: 0.7 });
    return;
  }
  if (P.k === 4) {
    SFX.play('gallop', { vol: 0.5 });
    return;
  }
  if (K.bear) {
    SFX.play('stepBear', { vol: 0.6 });
    return;
  }
  const wet = inWater(P.x, P.z) || wadeAt(P.x, P.z),
    surf = wet
      ? 'stepWater'
      : onBridge(MAP, P.x, P.z)
        ? 'stepWood'
        : MAP.type === 'wueste'
          ? 'stepSand'
          : MAP.type === 'arktis'
            ? onIce(P.x, P.z)
              ? 'stepIce'
              : 'stepSnow'
            : MAP.type === 'klippen'
              ? 'stepStone'
              : 'stepGrass';
  SFX.play(surf, { vol: (P.dashT > 0 ? 0.5 : 0.34) * (E.side ? 1 : 0.86) });
}
function exitEgo(send, keepLock) {
  if (EG.snd && EG.snd.motor) {
    EG.snd.motor.stop();
    EG.snd.motor = null;
  }
  {
    const fr = document.getElementById('frost');
    if (fr) fr.classList.remove('on');
  }
  if (EG.sgRing) EG.sgRing.visible = false;
  document.body.classList.remove('egoOn');
  document.body.classList.remove('heroOn');
  document.body.classList.remove('burnOn');
  {
    const hb = $('#egoHero');
    if (hb) hb.hidden = true;
    const lb = $('#egoLoad');
    if (lb) lb.hidden = true;
  }
  EG.fire = false;
  EG.fireK = false;
  if (document.pointerLockElement && !keepLock) {
    try {
      document.exitPointerLock();
    } catch (_) {}
  }
  {
    const h = $('#plHint');
    if (h) h.hidden = true;
  }
  if (!V.poss) return;
  if (send) sendCmd({ t: 'unposs' });
  const p = V.poss;
  V.poss = null;
  resetInput();
  mlReset();
  $('#xhair').hidden = true;
  if (V.mode === 'ai' || V.mode === 'host') G.teams[V.myTeam].posIn = null;
  else if (NET.r) NET.r.presence({ in: null }).catch(() => {});
  fx.swings.forEach(w => scene.remove(w.m));
  fx.swings.length = 0;
  EG.intro = 0;
  if (typeof nadeAimView === 'function' && nadeLine) nadeAimView(null);
  $('#ego').hidden = true;
  $('#hud').hidden = !V.playing;
  camS.x = p.x;
  camS.z = p.z + (V.myTeam ? -14 : 14);
  camS.dist = camera.aspect < 1 ? 46 : 36;
  camS.yaw = V.myTeam ? Math.PI : 0;
  camS.pitch = 0.95;
  setFov();
}
let egoHintT = 0;
function egoHint(t, ms) {
  const h = $('#egoHint');
  h.textContent = t;
  h.style.opacity = 1;
  h.hidden = false;
  clearTimeout(egoHintT);
  egoHintT = setTimeout(() => {
    h.style.opacity = 0;
    setTimeout(() => (h.hidden = true), 400);
  }, ms);
}
const PL = { on: false };
/* ---------- Ego look input: exactly one source of truth ----------
   Desktop mouse: Pointer Lock + movementX/Y from ONE document listener (registered once, never per ego entry).
   Touch: drags on the canvas. Both only ADD to ML.mx/my (mouse pixels) or ML.tx/ty (touch pixels).
   egoUpdate applies the sums once per frame to P.camYaw / P.pitch (the authoritative ego yaw) and clears them.
   No dt factor: a mouse delta is already a distance, so turning speed does not depend on the frame rate. */
const ML = { mx: 0, my: 0, tx: 0, ty: 0, ema: 0, guardUntil: 0, lockErr: 0, noLock: false, dropped: 0, pend: null };
const LOOK = { mouseYaw: 0.0026, mousePitch: 0.002, touchYaw: 0.008, touchPitch: 0.006, pitchMin: -0.42, pitchMax: 0.75 };
function mlReset(guardMs = 0) {
  ML.mx = ML.my = ML.tx = ML.ty = 0;
  ML.ema = 0;
  ML.pend = null;
  ML.guardUntil = now() + guardMs;
}
const canLock = () => !COARSE && !!canvas.requestPointerLock && !navigator.webdriver && !ML.noLock; // noLock only for the current ego session
document.addEventListener('pointerlockchange', () => {
  PL.on = document.pointerLockElement === canvas;
  mlReset(PL.on ? 80 : 0); // the first events after locking can carry the warp distance
  if (PL.on) {
    ML.lockErr = 0;
    ML.noLock = false;
  }
  EG.fire = false;
  EG.look = null;
  plHintUi();
});
// A refused request is NOT final: Chrome refuses e.g. a re-lock right after Esc. Every new click tries again; only after
// three refusals in a row does this ego session fall back to dragging (with edge turning, so 360° still work).
document.addEventListener('pointerlockerror', () => {
  ML.lockErr++;
  if (ML.lockErr >= 3) ML.noLock = true;
  mlReset();
  plHintUi();
});
function plHintUi() {
  const h = $('#plHint');
  if (!h) return;
  h.hidden = PL.on || !V.poss || COARSE;
  if (!h.hidden)
    h.lastChild.textContent = ' ' + (ML.noLock ? TR('Maustaste halten und ziehen zum Umschauen') : TR('Klicken, um die Maus zu fangen'));
}
function mlTake(mx, my, m) {
  ML.mx += mx;
  ML.my += my;
  ML.ema = ML.ema * 0.75 + m * 0.25;
}
document.addEventListener('mousemove', e => {
  if (!PL.on || !V.poss) return;
  if (now() < ML.guardUntil) return;
  const mx = e.movementX || 0,
    my = e.movementY || 0,
    m = Math.hypot(mx, my);
  if (!m) return;
  // Browser glitch filter (Chrome on Windows sometimes reports one bogus jump of hundreds of pixels, often reversed).
  // A single event that would turn more than ~35 degrees AND is far above the recent average is HELD, not applied.
  // If the next event continues in the same direction, it was a real flick and both are applied (one frame late);
  // if the motion does not continue, it was a glitch and is dropped. Fast flicks therefore always survive.
  const q = ML.pend;
  if (q) {
    ML.pend = null;
    if (now() - q.t < 250 && mx * q.mx + my * q.my > 0 && m > q.m * 0.15) mlTake(q.mx, q.my, q.m);
    else ML.dropped++;
  } // decided by the NEXT event only: independent of frame rate
  if (m * LOOK.mouseYaw * SET.sens > 0.6 && m > ML.ema * 6 + 40) {
    ML.pend = { mx, my, m, t: now() };
    return;
  }
  mlTake(mx, my, m);
});
function lockPointer() {
  // plain request: works in every browser (the raw-input variant is refused on some systems)
  if (!canLock() || document.pointerLockElement) return;
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (_) {}
}
function applyLook(P, dt = 0) {
  // the only place that turns input into yaw/pitch
  if (EG.look && EG.look.mouse && !PL.on && dt) {
    const ex = EG.look.x,
      W = innerWidth,
      edge = ex < 28 ? -1 : ex > W - 28 ? 1 : 0;
    if (edge) ML.mx += edge * 820 * dt;
  } // drag fallback: holding at the screen edge keeps turning
  const K = KINDS[P.k],
    sens = (K.role === 'ranged' ? 0.8 : 1) * SET.sens,
    inv = SET.invY ? -1 : 1;
  if (ML.mx || ML.my) {
    P.camYaw -= ML.mx * LOOK.mouseYaw * sens;
    P.pitch += ML.my * LOOK.mousePitch * sens * inv;
  }
  if (ML.tx || ML.ty) {
    const ts = K.role === 'ranged' ? 0.75 : 1;
    P.camYaw -= ML.tx * LOOK.touchYaw * ts;
    P.pitch += ML.ty * LOOK.touchPitch * ts;
  }
  ML.mx = ML.my = ML.tx = ML.ty = 0;
  P.pitch = clamp(P.pitch, LOOK.pitchMin, LOOK.pitchMax);
  P.camYaw = Math.atan2(Math.sin(P.camYaw), Math.cos(P.camYaw)); // keep yaw in (-PI, PI]
}
function egoDown(e) {
  const left = e.clientX < innerWidth * 0.45;
  if (e.pointerType === 'mouse' && PL.on) {
    const mb = 'Mouse' + e.button;
    if (isB('attack', mb)) EG.fire = true;
    egoAct(mb, true, null);
    return;
  }
  if (e.pointerType === 'mouse') {
    // not captured yet: try to capture; until it engages (or if the browser refuses) dragging turns the view
    if (canLock()) lockPointer();
    EG.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, mouse: true };
    return;
  }
  if (left && !EG.joy) {
    EG.joy = { id: e.pointerId, cx: e.clientX, cy: e.clientY, dx: 0, dy: 0 };
    const j = $('#joy');
    j.hidden = false;
    j.style.left = e.clientX + 'px';
    j.style.top = e.clientY + 'px';
    j.firstElementChild.style.transform = 'translate(-50%,-50%)';
  } else if (!EG.look) EG.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, t: now() };
}
function egoMove(e) {
  if (EG.joy && EG.joy.id === e.pointerId) {
    let dx = e.clientX - EG.joy.cx,
      dy = e.clientY - EG.joy.cy;
    const d = Math.hypot(dx, dy),
      m = 50;
    if (d > m) {
      dx = (dx / d) * m;
      dy = (dy / d) * m;
    }
    EG.joy.dx = dx / m;
    EG.joy.dy = dy / m;
    $('#joy').firstElementChild.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  } else if (EG.look && EG.look.id === e.pointerId && !PL.on) {
    const dx = e.clientX - EG.look.x,
      dy = e.clientY - EG.look.y;
    EG.look.x = e.clientX;
    EG.look.y = e.clientY;
    if (Math.hypot(e.clientX - EG.look.sx, e.clientY - EG.look.sy) > 8) EG.look.moved = true;
    if (EG.look.mouse) {
      ML.mx += dx;
      ML.my += dy;
    } else {
      ML.tx += dx;
      ML.ty += dy;
    }
  }
}
function egoUp(e) {
  if (e.pointerType === 'mouse' && PL.on) {
    const mb = 'Mouse' + e.button;
    if (isB('attack', mb)) EG.fire = false;
    egoAct(mb, false, null);
    EG.look = null;
    return;
  }
  if (EG.joy && EG.joy.id === e.pointerId) {
    EG.joy = null;
    $('#joy').hidden = true;
  } else if (EG.look && EG.look.id === e.pointerId) {
    if (!EG.look.moved && e.type !== 'pointercancel') egoAttack();
    EG.look = null;
  }
}
/* does point q touch a drawn sandworm (wild view or enemy worm unit)? Head sphere first (a headshot), then the neck column out of its hole */
const WAIM = new THREE.Vector3();
function wormRayHit(v, q) {
  const W = v.wP;
  if (!W || W.ws === 'under' || W.ws === 'warn' || !v.neck || !v.neck.visible) return 0;
  const hp = v.neck.getWorldPosition(WAIM),
    r = WORM_HEAD_R * (v.neck.scale.x || 1);
  if (q.distanceToSquared(hp) < r * r) return 2;
  const g = v.g.position,
    dx = q.x - g.x,
    dz = q.z - g.z;
  return W.ws !== 'crawl' && dx * dx + dz * dz < 2.4 && q.y > g.y && q.y < hp.y ? 1 : 0;
}
function egoAim(P) {
  const o = camera.position.clone(),
    d = new THREE.Vector3();
  camera.getWorldDirection(d);
  let hitP = null,
    hitU = null;
  const q = new THREE.Vector3();
  for (let t = 1; t < 90 && !hitP; t += 0.35) {
    q.copy(o).addScaledVector(d, t);
    if (q.y < Math.max(WL, groundY(q.x, q.z))) {
      hitP = q.clone();
      break;
    }
    {
      const B = BASES[1 - V.myTeam];
      if (B && Math.abs(q.x - B.x) < 6.6 && Math.abs(q.z - B.z) < 3.6 && q.y < groundY(B.x, B.z) + BASE_H) {
        hitP = q.clone();
        break;
      }
    } /* the ray stops at the enemy base wall instead of landing behind it */
    for (const v of WW.views.values())
      if (!(v.wP && v.wP.tame !== undefined) && wormRayHit(v, q)) {
        hitP = q.clone();
        break;
      }
    if (hitP) break; /* a wild sandworm: aim exactly where the crosshair sits (its head counts double) */
    for (const u of V.units.values()) {
      if (u.team === V.myTeam) continue;
      if (u.worm) {
        if (wormRayHit(u, q)) {
          hitP = q.clone();
          hitU = u;
          break;
        }
        continue;
      }
      const dx = q.x - u.g.position.x,
        dz = q.z - u.g.position.z,
        h2 = dx * dx + dz * dz;
      if (h2 > 4) continue;
      const hb = headBox({
          k: u.k,
          poss: u.isPoss,
          hs: u.isPoss ? 1 + 0.45 * tpk(u.team, 'bighead') : 1,
          gs: tpk(u.team, 'giant') ? 1.35 : 1,
        }),
        hy = u.g.position.y + hb.y;
      if (h2 + (q.y - hy) ** 2 < hb.r * hb.r || (h2 < 0.3 && q.y > u.g.position.y && q.y < hy)) {
        hitP = q.clone();
        hitU = u;
        break;
      }
    }
  }
  if (!hitP) hitP = o.clone().addScaledVector(d, 90);
  const from = new THREE.Vector3(P.x, unitY(P.x, P.z) + 1.9, P.z),
    pt = hitP.clone(),
    dir = hitP.sub(from).normalize();
  return { from, dir, pt, unit: hitU };
}
/* ---------- commanding from the ego view: "Alle zu mir", attack what I look at, switch warrior ---------- */
const ownIdsFor = P => [...V.units.values()].filter(u => u.team === V.myTeam && u.id !== P.id && !u.isPoss).map(u => u.id);
function egoCmdHere() {
  const P = V.poss;
  if (!P || !V.playing || tutBlock('egoCmd')) return;
  const ids = ownIdsFor(P);
  if (!ids.length) {
    egoHint(TR('Keine Krieger da – bilde erst welche aus.'), 1500);
    SFX.play('error');
    return;
  }
  sendCmd({ t: 'order', ids, x: +P.x.toFixed(1), z: +P.z.toFixed(1), m: 0 });
  SFX.play('rally');
  egoHint(ids.length === 1 ? TR('Alle zu mir! 1 Krieger kommt.') : TR('Alle zu mir! {0} Krieger kommen.', ids.length), 1500);
  word(TR('ZU MIR!'), P.x, unitY(P.x, P.z) + 4.6, P.z, { color: '#9fe8b8', scale: 1.2 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    puff(P.x + Math.cos(a) * 2.2, unitY(P.x, P.z) + 0.4, P.z + Math.sin(a) * 2.2, 0x9fe8b8, 1, 0.6);
  }
  EG.cmdT = now();
}
function egoCmdAttack() {
  const P = V.poss;
  if (!P || !V.playing || tutBlock('egoCmd')) return;
  const ids = ownIdsFor(P);
  if (!ids.length) {
    egoHint(TR('Keine Krieger da – bilde erst welche aus.'), 1500);
    SFX.play('error');
    return;
  }
  const { pt, unit } = egoAim(P);
  let tgt = unit,
    bd = 7 * 7;
  if (!tgt)
    for (const u of V.units.values()) {
      if (u.team === V.myTeam || !u.g.visible || u.fogHid) continue;
      const d = (u.g.position.x - pt.x) ** 2 + (u.g.position.z - pt.z) ** 2;
      if (d < bd) {
        bd = d;
        tgt = u;
      }
    }
  const B = BASES[1 - V.myTeam],
    onBase = !tgt && B && baseGap(B, pt.x, pt.z) < 1.5;
  if (tgt) sendCmd({ t: 'order', ids, x: +tgt.g.position.x.toFixed(1), z: +tgt.g.position.z.toFixed(1), target: tgt.id });
  else if (onBase) sendCmd({ t: 'order', ids, x: B.x, z: B.z, target: -2 });
  else sendCmd({ t: 'order', ids, x: +clampX(pt.x).toFixed(1), z: +clampZ(pt.z).toFixed(1), m: 0 });
  const tx = tgt ? tgt.g.position.x : onBase ? B.x : pt.x,
    tz = tgt ? tgt.g.position.z : onBase ? B.z : pt.z;
  SFX.play('order');
  word(tgt ? TR('ANGRIFF!') : onBase ? TR('AUF DIE BASIS!') : TR('DORTHIN!'), tx, unitY(tx, tz) + 3.8, tz, {
    color: '#ff9b54',
    scale: 1.25,
  });
  aoeRing(tx, tz, 2.4, 0xff9b54);
  egoHint(
    tgt ? TR('Alle greifen {0} an!', KINDS[tgt.k].name) : onBase ? TR('Alle stürmen die Basis!') : TR('Alle rücken dorthin vor!'),
    1500
  );
  EG.cmdT = now();
}
function egoSwitch() {
  const P = V.poss;
  if (!P || !V.playing || P.dance || P.heroOn || P.heroReq || tutBlock('egoSwitch')) return;
  const list = [...V.units.values()].filter(u => u.team === V.myTeam && u.id !== P.id && !u.isPoss).sort((a, b) => a.id - b.id);
  if (!list.length) {
    egoHint(TR('Kein anderer Krieger zum Wechseln.'), 1500);
    SFX.play('error');
    return;
  }
  const i = list.findIndex(u => u.id > P.id),
    nu = list[i < 0 ? 0 : i],
    pitch = P.pitch;
  exitEgo(false, true);
  V.selected.clear();
  V.selected.add(nu.id);
  enterEgo();
  if (V.poss) {
    V.poss.pitch = pitch;
    EG.intro = Math.min(EG.intro, 0.6);
    SFX.play('switch');
    egoHint(TR('Gewechselt: {0} ({1} weitere)', KINDS[nu.k].name, list.length), 1400);
  }
}
const SP_ICON = {
  0: si('fire'),
  1: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M4 20L18 6M4 20l5-15M4 20l15-5"/><path d="M18 6l-4 .3M18 6l-.3 4M9 5l-2.6 2M9 5l1.4 3M19 15l-3-2.2M19 15l-2.6 1.6" stroke="#f0bf4c"/></svg>',
  2: si('whirl'),
  3: si('teeth'),
  4: si('dash'),
  5: si('bolt'),
  6: si('salvo'),
  7: si('cake'),
  8: si('paw'),
  9: si('paw'),
  12: si('barrel'),
  13: si('trap'),
};
const DMOVES = [
  ['spin', TR('DREHUNG!')],
  ['jump', TR('HÜPF!')],
  ['floss', TR('FLOSS!')],
  ['robot', TR('ROBOTER!')],
  ['disco', TR('DISCO-FINGER!')],
  ['split', TR('SPAGAT!')],
];
function egoDance(P) {
  if (P.mv && P.mv.t < 0.4) return;
  P.dn = ((P.dn || 0) + 1 + Math.floor(Math.random() * 2)) % DMOVES.length;
  const [n, w] = DMOVES[P.dn];
  P.mv = { n, t: 0 };
  P.dc = (P.dc || 0) + 1;
  const y = unitY(P.x, P.z),
    cols = ['#ff6bd5', '#6be3ff', '#ffe66b'];
  word(w, P.x + Math.cos(P.camYaw) * 1.2, y + 2.5, P.z - Math.sin(P.camYaw) * 1.2, { color: cols[P.dn % 3], scale: 1.15 });
  for (let i = 0; i < 8; i++)
    puff(
      P.x + (Math.random() - 0.5) * 2.2,
      y + 0.3 + Math.random() * 2.2,
      P.z + (Math.random() - 0.5) * 2.2,
      [0xff6bd5, 0x6be3ff, 0xffe66b][i % 3],
      1,
      0.45
    );
  SFX.play(n === 'jump' ? 'boing' : 'pop', { vol: 0.6 });
  EG.kick = Math.max(EG.kick, 0.1);
  if (P.dc % 5 === 0)
    egoHint(
      ['Saturday Night Fever!', TR('Die Menge tobt!'), TR('Du bist der Star der Tanzfläche!'), TR('Mehr! Mehr! Mehr!')][
        Math.floor(Math.random() * 4)
      ],
      1400
    );
}
function egoAttack() {
  if (V.poss && V.poss.dance && !V.poss.down) {
    egoDance(V.poss);
    return;
  }
  if (V.poss && V.poss.tun) {
    if (!V.poss.tunHint) {
      V.poss.tunHint = 1;
      egoHint(TR('Unter dem Sand beißt du nicht – Spezial drücken zum Auftauchen!'), 1800);
    }
    return;
  }
  const P = V.poss;
  if (!P || P.down || P.dance || P.heroOn || (V.latest && V.latest.pz > 0)) return;
  if (P.trap) {
    // caught in a trap: every press wriggles a little loose (a steady rhythm is enough – no mashing needed)
    if (now() - (P.wrT || 0) < 160) return;
    P.wrT = now();
    P.a = (P.a + 1) % 1000;
    EG.kick = Math.max(EG.kick, 0.12);
    SFX.play('trapSet', { vol: 0.5 });
    const mu = V.units.get(P.id);
    if (mu) mu.hitV = (mu.hitV || 0) + 2.5;
    return;
  }
  if (P.hen && P.fh > 1) {
    // a chicken in the air: the attack is a dive that pecks everyone around on landing
    if (!P.dive) {
      P.dive = 1;
      SFX.play('whoosh', { vol: 1.1 });
      EG.kick = Math.max(EG.kick, 0.3);
      egoHint(TR('STURZFLUG!'), 900);
    }
    return;
  }
  const K = KINDS[P.k],
    melee = (K.role === 'melee' || K.role === 'cav') && !K.bear && !K.worm;
  if (P.cdT > 0) {
    if (melee && P.cdT < 0.28) P.bufA = now(); // pressed a little early: the blow comes the moment it can (combo timing feels fair)
    return;
  }
  P.bufA = 0;
  P.a = (P.a + 1) % 1000;
  const base = K.cd * CFG.possCd * (K.ego || NO_EGO).cd * (P.rageT > 0 ? 0.75 : 1);
  P.cdT = base;
  if (melee) {
    const tn = now(),
      step = (P.cmb || 0) < 3 && tn - (P.cmbT || -1e9) < base * CMB.win * 1000 ? (P.cmb || 0) + 1 : 1;
    P.cmb = step;
    P.cmbT = tn;
    P.cb = step; // sent with every input packet, checked by the host
    P.cdT = base * CMB.cd[step - 1];
    P.ad = null;
    egoStrike(P, K, step);
    return;
  }
  if (K.role === 'siege') {
    const { pt } = egoAim(P);
    P.gp = [+pt.x.toFixed(1), +pt.z.toFixed(1)];
    EG.kick = Math.max(EG.kick, 0.35);
    return;
  }
  if (K.role === 'ranged') {
    const { from, dir, pt } = egoAim(P);
    P.ad = [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)];
    P.at = [+pt.x.toFixed(2), +pt.y.toFixed(2), +pt.z.toFixed(2)];
    const m = freeArrowMesh(P.k);
    fx.shots.push({ m, p: from.clone().addScaledVector(dir, 0.5), d: dir.clone(), k: P.k, t: 0, life: (K.range * 2.5) / CFG.arrowSpeed });
    EG.kick = Math.max(EG.kick, 0.16);
    EG.punch = Math.max(EG.punch || 0, 0.35); // the release punches the view a little
    SFX.play(P.k === 1 ? 'bow' : 'teeth', { vol: 1.1 });
    const mu = V.units.get(P.id);
    if (mu) mu.atkT = 0; // release at once: then the draw (or the wind-up) of the next shot plays through the reload
    const ch = $('#xhair');
    if (ch) {
      ch.classList.remove('fire');
      void ch.offsetWidth;
      ch.classList.add('fire');
    }
  } else if (K.worm) {
    P.ad = null;
    const yw = P.yaw,
      cx = P.x + Math.sin(yw) * WORM.biteF,
      cz = P.z + Math.cos(yw) * WORM.biteF;
    wormBiteFx(cx, cz, yw, true);
    SFX.play('wormBite', { vol: 1 });
    EG.kick = Math.max(EG.kick, 0.28);
  } else {
    P.ad = null;
    swingFx(P, K);
    EG.kick = Math.max(EG.kick, 0.18);
  }
}
/* ---------- the blow of a steered melee warrior: it starts at once on the own screen (no waiting for the host), the combo picks the
   moves (comboSeq in 80-animation.js: two different blows and a finisher – a whirlwind or a leap), a cartoon slash cuts through the
   air, and the targets in reach are hit right at the strike frame: hit-stop, a white flash on them, sparks, an impact star behind
   which the own head may stand (no drawing through the skull), a hit marker on the screen, shake and sound. The damage itself stays
   with the host (possAttack); this is only what the hand feels. ---------- */
function egoStrike(P, K, step) {
  const mu = V.units.get(P.id);
  if (step === 1 || !P.seq) P.seq = comboSeq(P.k, P.nextFirst);
  const av = P.seq[step - 1],
    fin = step === 3,
    mv = moveOf(P.k, av) || { W: 0.07 };
  P.nextFirst = step < 3 ? undefined : comboSeq(P.k)[0];
  if (mu) {
    mu.atkT = 0;
    mu.av = av;
    mu.avN = step < 3 ? P.seq[step] : P.nextFirst; // the arm comes back up into this one and waits
    mu.cmbStep = step;
    mu.ownStrike = now();
  }
  const W = mv.W;
  slashFx(P, K, av, step, P.rageT > 0 ? 0xff6a3d : fin ? 0xffa62b : 0xffd34d, W);
  SFX.play(fin ? 'whoosh' : u2swing(P.k), { vol: fin ? 1.2 : 1.05 });
  if (fin && mv.spin) setTimeout(() => V.poss === P && SFX.play('whoosh', { vol: 0.8 }), 90);
  EG.kick = Math.max(EG.kick, fin ? 0.26 : 0.14);
  setTimeout(() => egoStrikeHit(P, K, step, mv), (W + 0.035) * 1000);
}
const u2swing = k => (k === 2 ? 'swingR' : 'swing');
function egoStrikeHit(P, K, step, mv) {
  if (V.poss !== P) return;
  const fin = step === 3,
    reach = K.range + K.r + (fin ? 1.4 : 1.0),
    cone = fin ? Math.PI : 1.15, // a finisher (whirlwind, leap) hits all round
    hits = [];
  if (fin && mv && mv.jump) {
    shake(0.45); // the landing
    emitFX('dust', P.x, (P.fy ?? groundY(P.x, P.z)) + 0.1, P.z, { n: 16, size: 1.4 });
  }
  for (const u of V.units.values()) {
    if (u.team === V.myTeam || u.dead || !u.g.visible || u.fogHid) continue;
    const dx = u.g.position.x - P.x,
      dz = u.g.position.z - P.z,
      d = Math.hypot(dx, dz);
    if (d > reach + KINDS[u.k].r || Math.abs(angDiff(Math.atan2(dx, dz), P.yaw)) > cone) continue;
    hits.push({ u, d });
  }
  hits.sort((a, b) => a.d - b.d);
  hits.length = Math.min(hits.length, fin ? 4 : 2);
  if (!hits.length) return;
  const mu = V.units.get(P.id);
  if (mu) mu.hitStop = fin ? 0.11 : 0.06; // the swing freezes for a heartbeat on contact
  shake(fin ? 0.55 : 0.22);
  EG.kick = Math.max(EG.kick, fin ? 0.4 : 0.24);
  if (fin) EG.punch = 1;
  for (const h of hits) {
    const p = h.u.g.position,
      dx = p.x - P.x,
      dz = p.z - P.z,
      l = Math.hypot(dx, dz) || 1;
    h.u.flash = fin ? 0.26 : 0.18;
    h.u.hitV = (h.u.hitV || 0) + (fin ? 6 : 3.5);
    h.u.hitStop = fin ? 0.11 : 0.06;
    emitFX('hit', p.x, p.y + 1.2, p.z, { dx, dz, n: fin ? 14 : 8, size: fin ? 1.0 : 0.7 });
    // the star sits on the side facing the striker, in the scene: the own head may hide it, it never shines through the skull
    impactStar(p.x - (dx / l) * 0.45, p.y + 1.3, p.z - (dz / l) * 0.45, fin);
  }
  hitMark(hits[0].u.g.position, fin);
  const p0 = hits[0].u.g.position;
  SFX.play(HIT_SFX[P.k] || 'axe', { vol: 1.15 });
  SFX.play('hitmark', { vol: fin ? 0.9 : 0.6 });
  if (fin) SFX.play('crash', { vol: 0.7 });
  if (step > 1)
    word(fin ? TR('KOMBO!') : '×' + step, p0.x, p0.y + 3.2, p0.z, { color: fin ? '#ffcf3d' : '#ffffff', scale: fin ? 1.7 : 1.3 });
  else if (Math.random() < 0.25 && QUOTES[P.k].hit.length) word(pick(QUOTES[P.k].hit), p0.x, p0.y + 3.2, p0.z);
}
// the hit marker on the screen: four comic strokes snap out around the spot where the blow landed (a finisher adds speed lines at the edges)
function hitMark(p, fin) {
  const el = $('#hitMk');
  if (!el) return;
  const sp = toScreen(p.x, p.y + 1.2, p.z);
  el.style.left = Math.round(sp.x) + 'px';
  el.style.top = Math.round(sp.y) + 'px';
  el.classList.remove('on', 'fin');
  void el.offsetWidth;
  el.classList.add('on');
  if (fin) el.classList.add('fin');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on', 'fin'), 420);
  if (fin) {
    const sl = $('#speedLn');
    if (sl) {
      sl.classList.remove('on');
      void sl.offsetWidth;
      sl.classList.add('on');
      clearTimeout(sl._t);
      sl._t = setTimeout(() => sl.classList.remove('on'), 380);
    }
  }
}
/* a comic impact star where a blow lands: a spiky white-yellow burst with an ink edge, pops up and fades in a quarter second */
const STAR_GEO = (() => {
  const sh = new THREE.Shape(),
    n = 9;
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU,
      r = i % 2 ? 0.42 : 1;
    if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.moveTo(r, 0);
  }
  const g = new THREE.ShapeGeometry(sh);
  g.userData.shared = true;
  return g;
})();
function impactStar(x, y, z, big) {
  const g = new THREE.Group(),
    mat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    ink = mat(0x1b1430),
    fill = mat(big ? 0xffa62b : 0xffe14d),
    core = mat(0xffffff);
  const a = new THREE.Mesh(STAR_GEO, ink),
    b = new THREE.Mesh(STAR_GEO, fill),
    c = new THREE.Mesh(STAR_GEO, core);
  a.scale.setScalar(1.18);
  c.scale.setScalar(0.5);
  b.position.z = 0.02;
  c.position.z = 0.04;
  g.add(a, b, c);
  g.position.set(x, y, z);
  [a, b, c].forEach((m, i) => (m.renderOrder = 12 + i));
  g.rotation.z = Math.random() * TAU;
  scene.add(g);
  fx.swings.push({ star: true, m: g, mats: [ink, fill, core], t: 0, big });
}
/* the cartoon slash: a fat crescent (or a streak for a thrust) with a white core, a coloured body and an ink edge. Its head races
   along the arc in a few frames, the tail follows and thins out, an echo crescent trails a little behind. */
const SLASH_VS = `varying vec2 vUv;
uniform float uSpan; uniform float uR0; uniform float uR1; uniform float uMode; uniform float uLen;
void main() {
  vUv = uv;
  vec3 p;
  if (uMode < 0.5) {
    float a = (uv.x - 0.5) * uSpan, r = mix(uR0, uR1, uv.y);
    p = vec3(sin(a) * r, 0.0, cos(a) * r);
  } else p = vec3((uv.y - 0.5) * 1.5, 0.0, mix(0.3, uLen, uv.x));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const SLASH_FS = `varying vec2 vUv;
uniform float uHead; uniform float uTail; uniform float uFade; uniform float uMode; uniform vec3 uCol; uniform float uFlip;
void main() {
  float x = uFlip > 0.5 ? 1.0 - vUv.x : vUv.x;
  if (x > uHead || x < uTail) discard;
  float s = (x - uTail) / max(0.001, uHead - uTail);
  float th = pow(sin(3.14159 * pow(s, 0.65)), 0.75); // fat just behind the head, a thin tail
  float v = uMode < 0.5 ? vUv.y : 1.0 - abs(vUv.y - 0.5) * 2.0;
  float edge = 1.0 - th;                                // the band grows from the outer edge inwards
  if (v < edge) discard;
  float k = (v - edge) / max(0.001, th);                // 0 at the inner border .. 1 at the outer edge
  vec3 ink = vec3(0.106, 0.078, 0.188);
  // ink outline on both borders, a white hot edge outside, the colour inside
  vec3 c = k < 0.14 || k > 0.93 ? ink : k > 0.58 ? vec3(1.0) : mix(uCol * 0.85, uCol, (k - 0.14) / 0.44);
  if (s > 0.96) c = ink;                                // a dark lip on the leading edge
  gl_FragColor = vec4(c, uFade);
}`;
const SLASH_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 40, 1);
  g.userData.shared = true;
  return g; // only its uv matter: the vertex shader bends it into the arc or the streak
})();
const SLASH_BASE = new THREE.ShaderMaterial({
  vertexShader: SLASH_VS,
  fragmentShader: SLASH_FS,
  uniforms: {
    uSpan: { value: 2.6 },
    uR0: { value: 0.5 },
    uR1: { value: 2 },
    uMode: { value: 0 },
    uLen: { value: 2.5 },
    uHead: { value: 0 },
    uTail: { value: 0 },
    uFade: { value: 1 },
    uCol: { value: new THREE.Color() },
    uFlip: { value: 0 },
  },
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});
SLASH_BASE.userData.shared = true;
function slashFx(P, K, av, step, col, delay = 0, follow = null) {
  if (fx.swings.length > 40) return;
  const mv = moveOf(P.k, av),
    sh = mv ? mv.sl : { m: 'h', d: -1 },
    fin = step === 3,
    cav = K.role === 'cav',
    ring = sh.m === 'r',
    reach = (K.range + 1.1) * (sh.s || 1) * (fin ? 1.18 : 1),
    g = new THREE.Group(),
    mk = (lag, scale, colr) => {
      const m = SLASH_BASE.clone();
      m.uniforms.uMode.value = 0;
      m.uniforms.uSpan.value = ring ? TAU * 0.97 : sh.m === 'v' || sh.m === 'u' ? 2.2 : 2.7;
      m.uniforms.uR0.value = ring ? reach * 0.35 : 0.45;
      m.uniforms.uR1.value = reach * scale * (sh.m === 'v' || sh.m === 'u' ? 0.85 : 1);
      m.uniforms.uLen.value = reach * 1.15 * scale;
      m.uniforms.uCol.value.set(colr);
      m.uniforms.uFlip.value = sh.d === 1 || sh.m === 'u' ? 1 : 0;
      const me = new THREE.Mesh(SLASH_GEO, m);
      me.renderOrder = 9;
      me.frustumCulled = false;
      g.add(me);
      return { m, lag };
    };
  const layers = [mk(0, 1, col), mk(0.07, 0.86, col)]; // the slash and its echo
  layers[1].m.uniforms.uFade.value = 0.6;
  const y = (P.fy ?? groundY(P.x, P.z)) + (cav ? 1.85 : 1.35) * (sh.low ? 0.62 : 1);
  g.position.set(P.x, y, P.z);
  g.rotation.order = 'YXZ';
  g.rotation.y = P.yaw;
  g.rotation.x = -0.42; // tipped towards the camera behind: a slash seen edge-on would be invisible
  if (ring) {
    g.rotation.x = -0.12; // all round, almost flat: the whirlwind
    g.rotation.y = P.yaw + Math.PI * 0.5;
  } else if (sh.m === 'h')
    g.rotation.z = (sh.d === 1 ? 1 : -1) * (fin ? 0.3 : 0.18); // tilted like the blow
  else if (sh.m === 'v') {
    g.rotation.z = -0.95; // a diagonal chop from high right down to low left in front
    g.position.y += 0.45;
  } else {
    g.rotation.z = 0.95; // a rising cut: from low left up to high right
    g.position.y += 0.3;
  }
  scene.add(g);
  fx.swings.push({ slash: true, m: g, layers, t: -delay, dur: ring ? 0.2 : fin ? 0.16 : 0.12, follow: follow || P, yaw: P.yaw });
}
const swingGeo = new THREE.RingGeometry(0.7, 2.3, 28, 1, -1.25, 2.5).rotateX(-Math.PI / 2);
function swingFx(P, K, col, quiet) {
  const g = new THREE.Group(),
    cav = K.role === 'cav',
    y = (P.fy ?? groundY(P.x, P.z)) + (cav ? 1.9 : 1.45);
  const mat = new THREE.MeshBasicMaterial({
    color: col || (P.rageT > 0 ? 0xff7a50 : 0xfff6dc),
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: col && col !== 0xfff6dc ? THREE.NormalBlending : THREE.AdditiveBlending,
  }); // enemy swings stay red on bright ground
  const m = new THREE.Mesh(swingGeo, mat);
  m.rotation.z = (Math.random() < 0.5 ? -1 : 1) * 0.35;
  g.add(m);
  g.position.set(P.x, y, P.z);
  g.rotation.y = P.yaw - Math.PI / 2;
  g.scale.setScalar((K.range + 0.9) / 2.3);
  scene.add(g);
  fx.swings.push({ m: g, mat, t: 0, yaw: P.yaw, follow: P });
  if (!quiet) SFX.play('swing', { vol: 1.1 });
}
function swingTick(dt) {
  for (let i = fx.swings.length - 1; i >= 0; i--) {
    const w = fx.swings[i];
    w.t += dt;
    if (w.star) {
      const q = w.t / (w.big ? 0.32 : 0.24),
        sc = (w.big ? 0.75 : 0.45) * (q < 0.25 ? sstep(0, 0.25, q) * 1.15 : 1.15 - 0.15 * q);
      w.m.scale.setScalar(Math.max(0.01, sc));
      w.m.quaternion.copy(camera.quaternion); // faces the camera
      w.mats.forEach(m => (m.opacity = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4));
      if (q >= 1) {
        scene.remove(w.m);
        w.mats.forEach(m => m.dispose());
        fx.swings.splice(i, 1);
      }
      continue;
    }
    if (w.slash) {
      const f = w.follow;
      w.m.position.x = f.x;
      w.m.position.z = f.z;
      let alive = false;
      for (const L of w.layers) {
        const t = w.t - L.lag,
          head = t < 0 ? 0 : Math.min(1.08, Math.pow(t / w.dur, 0.7)), // races ahead, then holds just past the end
          tail = t < w.dur * 0.35 ? 0 : Math.min(1.1, ((t - w.dur * 0.35) / (w.dur * 1.4)) * 1.1);
        L.m.uniforms.uHead.value = head;
        L.m.uniforms.uTail.value = tail;
        if (t >= 0) L.m.uniforms.uFade.value = (L.lag ? 0.6 : 1) * (1 - sstep(w.dur * 1.2, w.dur * 2.2, t));
        if (t < w.dur * 2.2 && tail < 1.05) alive = true;
      }
      w.m.visible = w.t >= 0;
      if (!alive) {
        scene.remove(w.m);
        w.layers.forEach(L => L.m.dispose());
        fx.swings.splice(i, 1);
      }
      continue;
    }
    const p = w.t / 0.24;
    w.m.position.set(w.follow.x, w.m.position.y, w.follow.z);
    w.m.rotation.y = w.yaw - Math.PI / 2 + lerp(0.9, -0.9, Math.min(1, p));
    w.mat.opacity = 0.8 * (1 - p);
    if (p >= 1) {
      scene.remove(w.m);
      w.mat.dispose();
      fx.swings.splice(i, 1);
    }
  }
}
/* ---------- enemy swing marker: a faint crescent sweeps through the reach of an enemy's melee swing, tilted like the blow ---------- */
const SWOOSH_CAP = 48,
  swooshes = [];
const swooshGeo = (() => {
  const pos = [],
    uv = [],
    idx = [],
    N = 18; // a crescent, widest just behind the leading edge; u runs along the arc (tail -> leading edge), v across (inner -> outer)
  for (let i = 0; i <= N; i++) {
    const t = i / N,
      a = 0.8 * (2 * t - 1),
      rin = 1 - 0.58 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.6)), 0.7);
    for (let j = 0; j <= 1; j++) {
      const r = j ? 1 : rin;
      pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
      uv.push(t, j);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
})();
const swooshTex = (() => {
  const W = 128,
    H = 32,
    c = cnv(W, H),
    x = c.getContext('2d'),
    id = x.createImageData(W, H),
    ss = (a, b, t) => {
      const q = clamp((t - a) / (b - a), 0, 1);
      return q * q * (3 - 2 * q);
    };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = i / (W - 1),
        v = j / (H - 1),
        rim = Math.exp(-Math.pow((v - 0.84) / 0.1, 2)),
        al = Math.pow(ss(0, 0.85, u), 0.9) * (1 - ss(0.94, 1, u)) * Math.min(1, 0.72 * Math.pow(v, 0.8) * (1 - ss(0.92, 1, v)) + rim),
        o = (j * W + i) * 4;
      id.data[o] = 255;
      id.data[o + 1] = id.data[o + 2] = Math.round(255 * (0.55 + 0.45 * rim));
      id.data[o + 3] = Math.round(255 * al);
    } // a soft body with a brighter cutting edge at the reach
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
})();
const swooshMat = new THREE.MeshBasicMaterial({
  color: lin(0xff4a38),
  map: swooshTex,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const swooshAlpha = instanceFadeMaterial(swooshMat, swooshGeo, SWOOSH_CAP);
const swooshMesh = new THREE.InstancedMesh(swooshGeo, swooshMat, SWOOSH_CAP);
swooshMesh.count = 0;
swooshMesh.frustumCulled = false;
swooshMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
swooshMesh.renderOrder = 8;
scene.add(swooshMesh);
const SW_Q = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
function swooshFx(u, K) {
  if (swooshes.length >= SWOOSH_CAP || !u.g.parent || !u.g.visible) return;
  const P = u.g.position,
    L = listenerPos(),
    d = Math.hypot(P.x - L.x, P.z - L.z),
    fade = d < 24 ? 1 : 1 - (d - 24) / 46;
  if (fade <= 0.05) return;
  const sv = moveSwoosh(u.k, u.av),
    gs = u.g.scale.x || 1;
  swooshes.push({
    u,
    x: P.x,
    y: P.y + sv.h * gs,
    z: P.z,
    yaw: u.g.rotation.y,
    roll: sv.roll,
    dir: sv.dir,
    s: (K.range + 0.95) * (sv.sc || 1) * gs,
    t: -0.075,
    a: 0.62 * fade * (V.poss ? 1 : 0.5),
  }); // from the commander's view a whole battle swings at once: keep it quieter
}
function swooshTick(dt) {
  let n = 0;
  for (let i = swooshes.length - 1; i >= 0; i--) {
    const w = swooshes[i];
    w.t += dt;
    if (w.t > 0.33) {
      swooshes[i] = swooshes[swooshes.length - 1];
      swooshes.pop();
      continue;
    }
    if (w.t < 0) continue;
    if (w.u && w.u.g.parent) {
      w.x = w.u.g.position.x;
      w.z = w.u.g.position.z;
      w.yaw = w.u.g.rotation.y;
    }
    const p = Math.min(1, w.t / 0.1),
      sweep = lerp(-0.55, 0.3, 1 - (1 - p) * (1 - p)) * w.dir,
      al = w.a * (w.t < 0.1 ? Math.min(1, w.t / 0.03) : Math.max(0, 1 - (w.t - 0.1) / 0.23));
    puffDummy.position.set(w.x, w.y, w.z);
    puffDummy.quaternion
      .setFromAxisAngle(SW_Q.Y, w.yaw)
      .multiply(SW_Q.a.setFromAxisAngle(SW_Q.Z, w.roll))
      .multiply(SW_Q.b.setFromAxisAngle(SW_Q.Y, sweep));
    puffDummy.scale.set(w.s * w.dir, 1, w.s);
    puffDummy.updateMatrix();
    swooshMesh.setMatrixAt(n, puffDummy.matrix);
    swooshAlpha.setX(n++, al);
  }
  swooshMesh.count = n;
  if (n) {
    swooshMesh.instanceMatrix.needsUpdate = true;
    swooshAlpha.needsUpdate = true;
  }
}
function swooshClear() {
  swooshes.length = 0;
  swooshMesh.count = 0;
}
function egoSpecial() {
  const P = V.poss;
  if (P && P.hen) return; // a chicken only pecks
  if (!P || P.down || P.dance || P.heroOn || (V.latest && V.latest.pz > 0)) return;
  if (KINDS[P.k].worm) {
    // one press digs in, the next bursts out and swallows everyone around
    if (P.tun) {
      P.spSent = now();
      P.s = (P.s + 1) % 1000;
      P.spT = WORM.cdE * [1, 0.34][tpk(V.myTeam, 'charge')];
      EG.kick = Math.max(EG.kick, 0.35);
      return;
    }
    if (P.spT > 0 || P.held) return;
    if (!canBurrow(P.x, P.z)) {
      egoHint(TR('Hier ist kein Sand zum Eingraben!'), 1400);
      SFX.play('error');
      return;
    }
    P.spSent = now();
    P.s = (P.s + 1) % 1000;
    P.spT = 0.45;
    return;
  }
  if (P.spT > 0) return;
  if (P.k === 13) {
    // the Fallenleger has one trap: while it lies out there (or a new one is not ready yet) there is nothing to lay
    const mu = V.units.get(P.id);
    if (mu && !mu.trapC) {
      egoHint(TR('Deine Falle liegt schon – eine neue gibt es erst, wenn sie zugeschnappt ist.'), 1800);
      SFX.play('error');
      return;
    }
    SFX.play('trapSet', { vol: 0.9 });
  }
  if (P.k === 12) {
    if (P.fuse) return;
    egoHint(TR('Die Lunte brennt – rein in die Gegner!'), 1300);
    EG.kick = Math.max(EG.kick, 0.2);
  }
  if (KINDS[P.k].role === 'siege') {
    const { pt } = egoAim(P);
    P.gp = [+pt.x.toFixed(1), +pt.z.toFixed(1)];
  }
  if (P.k === 1 || P.k === 3) {
    const { from, dir } = egoAim(P),
      K = KINDS[P.k];
    P.ad = [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)];
    const vl = tpk(V.myTeam, 'volley'),
      n = (P.k === 1 ? 5 : 6) + 10 * vl,
      spread = vl ? 0.05 : P.k === 1 ? 0.075 : 0.11;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * spread,
        c = Math.cos(a),
        sn = Math.sin(a),
        d = new THREE.Vector3(dir.x * c + dir.z * sn, dir.y + (i % 2 ? 0.02 : -0.01), -dir.x * sn + dir.z * c).normalize();
      fx.shots.push({
        m: freeArrowMesh(P.k),
        p: from.clone().addScaledVector(d, 0.5),
        d,
        k: P.k,
        t: 0,
        life: (K.range * 2.2) / CFG.arrowSpeed,
      });
    }
    EG.kick = Math.max(EG.kick, 0.3);
  }
  P.spSent = now();
  P.s = (P.s + 1) % 1000;
  P.spT = spCdOf(P.k) * [1, 0.34][tpk(V.myTeam, 'charge')];
  if (P.k === 0) P.rageT = 4;
  if (P.k === 4 || P.k === 5) {
    // riders dash at once (the host starts the ram from the same spot, P.dp)
    P.dashT = 0.42;
    P.dp = [+P.x.toFixed(2), +P.z.toFixed(2)];
    SFX.play('whoosh', { vol: 1 });
    stompFx(P.x, unitY(P.x, P.z), P.z, true);
  }
}
// the steered chicken's height: rises while the special is held, sinks when let go, a dive drops fast and pecks on landing (HFLY)
function henFly(P, dt) {
  const hold = (EG.spK || EG.spP) && !P.dive && !P.down && !P.dance,
    floor = walkable(P.x, P.z) ? 0 : HFLY.floor,
    h0 = P.fh || 0;
  let h = h0 + (P.dive ? -HFLY.dive : hold ? HFLY.up : -HFLY.down) * dt;
  h = clamp(h, floor, HFLY.max);
  if (P.dive && h <= floor + 0.01) {
    if (floor > 0)
      P.dive = 0; // over water: no peck, it just stops above the waves
    else {
      P.dive = 0;
      P.dv = ((P.dv || 0) + 1) % 1000; // the host pecks all around (henDive)
      const y = unitY(P.x, P.z);
      shake(0.5);
      EG.kick = Math.max(EG.kick, 0.45);
      emitFX('dust', P.x, y + 0.1, P.z, { n: 18, size: 1.3 });
      SFX.play('stomp', { vol: 1 });
      SFX.play('chicken', { vol: 1 });
    }
  }
  if (hold && h0 < 0.05 && h > 0) {
    SFX.play('chicken', { vol: 0.8 });
    emitFX('dust', P.x, unitY(P.x, P.z) + 0.1, P.z, { n: 6, size: 0.6 });
  }
  if (h > 0.3 && Math.random() < dt * (hold ? 7 : 2.5)) SFX.play('flap', { vol: hold ? 0.55 : 0.3 });
  if (h >= HFLY.max - 0.01 && h0 < HFLY.max - 0.01) profEvent('fly');
  P.fh = h;
  P.fly = h > 0.3 ? (hold ? 2 : 1) : 0; // for the wings: flapping hard or gliding
}
function stompFx(x, y, z, mine) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    puff(x + Math.cos(a) * 1.1, y + 0.15, z + Math.sin(a) * 1.1, 0xd8c48f, 1, 0.7);
  }
  SFX.play('stompWarn', { x, z, vol: mine ? 1 : 0.9 });
  if (mine) EG.kick = Math.max(EG.kick, 0.25);
}
$('#egoAtk').addEventListener('pointerdown', e => {
  e.preventDefault();
  egoAttack();
});
$('#egoSp').addEventListener('pointerdown', e => {
  e.preventDefault();
  EG.spP = true; // held down: a chicken keeps rising
  egoSpecial();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(n => $('#egoSp').addEventListener(n, () => (EG.spP = false)));
$('#egoExit').addEventListener('click', () => {
  if (tutBlock('exit')) return;
  if (V.poss && V.poss.dance) {
    egoHint(TR('Du tanzt noch! Verlassen geht erst danach.'), 1600);
    SFX.play('error');
    return;
  }
  if (V.poss && (V.poss.heroOn || V.poss.heroReq)) {
    egoHint(TR('Ein Held kneift nicht!'), 1400);
    SFX.play('error');
    return;
  }
  exitEgo(true);
});
$('#egoHero').addEventListener('click', e => {
  e.stopPropagation();
  egoHero();
});
function egoJump() {
  const P = V.poss;
  if (!P || P.down || P.dance || P.heroOn || !tpk(V.myTeam, 'jump') || (P.jT || 0) > 0 || (V.latest && V.latest.pz > 0)) return;
  P.j = (P.j || 0) + 1;
  P.jT = 2.2;
  P.jumpT = 0.9;
  P.jDur = 0.9;
  P.jy0 = P.fy !== undefined ? P.fy : unitY(P.x, P.z);
  SFX.play('boing');
}
const myNades = () => (V.latest && V.latest.nd ? V.latest.nd[V.myTeam] || 0 : 0);
const canNade = () => tpk(V.myTeam, 'dance') || myNades() > 0;
function nadeOk(P) {
  return P && !P.down && !P.dance && !P.heroOn && canNade() && !((P.gT || 0) > 0) && !(V.latest && V.latest.pz > 0);
}
const NADE_MAX = 42;
function nadeTarget(P) {
  const k = clamp((P.pitch + 0.42) / 1.12, 0, 1),
    d = lerp(NADE_MAX, 3, Math.pow(k, 0.8)),
    a = P.camYaw;
  return { x: clampX(P.x + Math.sin(a) * d), z: clampZ(P.z + Math.cos(a) * d), d };
}
function nadeStart() {
  const P = V.poss;
  if (!nadeOk(P)) return;
  P.nadeAim = true;
  $('#xhair').hidden = false;
}
function nadeRelease() {
  const P = V.poss;
  if (!P || !P.nadeAim) return;
  P.nadeAim = false;
  nadeAimView(null);
  $('#xhair').hidden = !(KINDS[P.k].role === 'ranged' || KINDS[P.k].role === 'siege');
  if (!nadeOk(P)) return;
  const t = nadeTarget(P);
  P.gp = [+t.x.toFixed(1), +t.z.toFixed(1)];
  P.g = (P.g || 0) + 1;
  P.gT = tpk(V.myTeam, 'dance') ? 14 : 1.5;
  SFX.play('throw');
}
let nadeLine = null,
  nadeRing = null;
function nadeAimView(P) {
  if (!nadeLine) {
    nadeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, () => new THREE.Vector3())),
      new THREE.LineDashedMaterial({ color: 0xff6bd5, dashSize: 0.5, gapSize: 0.3, depthTest: false, transparent: true })
    );
    nadeLine.renderOrder = 8;
    scene.add(nadeLine);
    nadeRing = mesh(
      new THREE.RingGeometry(4.6, 5, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff6bd5, transparent: true, opacity: 0.75, depthTest: false }),
      0,
      0,
      0
    );
    nadeRing.renderOrder = 8;
    scene.add(nadeRing);
  }
  if (!P) {
    nadeLine.visible = false;
    nadeRing.visible = false;
    const hd = $('#nadeDist');
    if (hd) hd.hidden = true;
    return;
  }
  const t = nadeTarget(P),
    sy = unitY(P.x, P.z) + 2,
    ty = unitY(t.x, t.z) + 0.3,
    d = Math.hypot(t.x - P.x, t.z - P.z),
    h = 1 + d * 0.12,
    pos = nadeLine.geometry.attributes.position;
  for (let i = 0; i < 28; i++) {
    const k = i / 27;
    pos.setXYZ(i, lerp(P.x, t.x, k), lerp(sy, ty, k) + Math.sin(k * Math.PI) * h, lerp(P.z, t.z, k));
  }
  pos.needsUpdate = true;
  nadeLine.computeLineDistances();
  nadeLine.visible = true;
  nadeRing.position.set(t.x, ty, t.z);
  nadeRing.visible = true;
  nadeRing.rotation.y += 0.03;
  {
    const hd = $('#nadeDist');
    if (hd) {
      hd.hidden = false;
      hd.textContent = Math.round(d) + ' m';
    }
  }
}
$('#egoJump').addEventListener('pointerdown', e => {
  e.preventDefault();
  egoJump();
});
$('#egoHere').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  egoCmdHere();
});
$('#egoAtkAll').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  egoCmdAttack();
});
$('#egoSwap').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  egoSwitch();
});
$('#egoNade').addEventListener('pointerdown', e => {
  e.preventDefault();
  try {
    $('#egoNade').setPointerCapture(e.pointerId);
  } catch (_) {}
  nadeStart();
});
$('#egoNade').addEventListener('pointermove', e => {
  const P = V.poss;
  if (!P || !P.nadeAim) return;
  if (P.nadeY !== undefined) {
    ML.tx += (e.clientX - P.nadeX) * 0.75;
    ML.ty += e.clientY - P.nadeY;
  }
  P.nadeY = e.clientY;
  P.nadeX = e.clientX;
});
['pointerup', 'pointercancel'].forEach(ev =>
  $('#egoNade').addEventListener(ev, () => {
    if (V.poss) V.poss.nadeY = undefined;
  })
);
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => $('#egoNade').addEventListener(ev, () => nadeRelease()));
$('#egoSelfie').addEventListener('click', () => {
  if (V.poss && EG.intro <= 0) EG.intro = 1.5;
});
const cssVar = (el, name, v) => {
  const k = '_' + name;
  if (el[k] !== v) {
    el[k] = v;
    el.style.setProperty(name, v);
  }
}; // write only when the value changed: no style recalcs per frame
const cssSet = (el, prop, v) => {
  const k = '_s' + prop;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
};
function egoUpdate(dt) {
  if ((EG.fire && PL.on) || EG.fireK) egoAttack();
  {
    const P0 = V.poss,
      sgA = P0 && KINDS[P0.k].role === 'siege' && !P0.nadeAim && !(EG.intro > 0.3);
    if (sgA) {
      if (!EG.sgRing) {
        EG.sgRing = new THREE.Group();
        const m1 = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8, depthWrite: false }),
          m2 = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.4, depthWrite: false });
        const r1 = new THREE.Mesh(ringGeo, m1);
        r1.scale.setScalar(KINDS[P0.k].aoe * 1.15);
        EG.sgRing.add(r1);
        const c1 = new THREE.Mesh(discGeo, m2);
        c1.scale.setScalar(1.3);
        EG.sgRing.add(c1);
        scene.add(EG.sgRing);
      }
      const { pt } = egoAim(P0),
        dx = pt.x - P0.x,
        dz = pt.z - P0.z,
        dd = Math.hypot(dx, dz) || 1,
        R = KINDS[P0.k].range + SIEGE_EGO_REACH,
        tx = dd > R ? P0.x + (dx / dd) * R : pt.x,
        tz = dd > R ? P0.z + (dz / dd) * R : pt.z;
      EG.sgRing.visible = true;
      EG.sgRing.position.set(tx, groundY(tx, tz) + 0.15, tz);
      EG.sgRing.children[0].rotation.y += dt * 0.6;
    } else if (EG.sgRing) EG.sgRing.visible = false;
  }
  const P = V.poss;
  if (!P) return;
  applyLook(P, dt);
  const K = KINDS[P.k];
  const tn = now(),
    rdt = Math.min(0.5, (tn - (P.lastT || tn)) / 1000);
  P.lastT = tn;
  P.cdT = Math.max(0, P.cdT - rdt);
  if (P.bufA && P.cdT <= 0) {
    const ok = tn - P.bufA < 380;
    P.bufA = 0;
    if (ok) egoAttack();
  }
  P.spT = Math.max(0, P.spT - rdt);
  {
    const mu = V.units.get(P.id);
    if (mu && now() - (P.spSent || 0) > 600) {
      if (mu.spcd > 0.4 && P.spT < mu.spcd - 0.3) P.spT = mu.spcd;
      else if (mu.spcd <= 0.05 && P.spT > 0.6 && now() - (P.spSent || 0) > 1500) P.spT = 0;
    }
  }
  P.rageT = Math.max(0, P.rageT - rdt);
  let jx = 0,
    jy = 0;
  if (EG.joy) {
    jx = EG.joy.dx;
    jy = EG.joy.dy;
  }
  if (held('fwd')) jy -= 1;
  if (held('back')) jy += 1;
  if (held('left')) jx -= 1;
  if (held('right')) jx += 1;
  const jl = Math.hypot(jx, jy);
  if (jl > 1) {
    jx /= jl;
    jy /= jl;
  }
  if (MAP.pads && MAP.pads.length) {
    if (P.pj) {
      P.pj.t += dt;
      const k = Math.min(1, P.pj.t / PAD_FLY);
      P.x = lerp(P.pj.sx, P.pj.tx, k);
      P.z = lerp(P.pj.sz, P.pj.tz, k);
      P.jumpT = Math.max(0.001, PAD_FLY - P.pj.t);
      P.fy = lerp(unitY(P.pj.sx, P.pj.sz), unitY(P.pj.tx, P.pj.tz), k);
      if (k >= 1) {
        P.pj = null;
        P.jumpT = 0;
        P.jDur = 0;
      }
      jx = 0;
      jy = 0;
    }
  }
  P.tumT = Math.max(0, (P.tumT || 0) - dt);
  const pzd = V.latest && V.latest.pz > 0,
    frozen = pzd || P.down || P.dance || P.tumT > 0.25 || P.falling || P.held || P.heroOn || P.trap;
  if (frozen) {
    jx = 0;
    jy = 0;
    P.dashT = 0;
  }
  if ((P.down || P.held || P.heroOn) && P.srv && !P.air) {
    P.x = lerp(P.x, P.srv.x, Math.min(1, dt * 12));
    P.z = lerp(P.z, P.srv.z, Math.min(1, dt * 12));
  }
  const sx0 = P.x,
    sz0 = P.z;
  const fwd = -jy,
    str = jx,
    cy = Math.sin(P.camYaw),
    cyz = Math.cos(P.camYaw);
  let vx = cy * fwd - cyz * str,
    vz = cyz * fwd + cy * str;
  const slowMu = V.units.get(P.id);
  let speed = P.tun
    ? WORM.tunSpeed
    : K.speed *
      1.15 *
      (slowMu && slowMu.slowed ? 0.7 : 1) *
      (P.rageT > 0 ? 1.4 : 1) *
      [1, 2][tpk(V.myTeam, 'turbo')] *
      (K.role === 'cav' ? [1, 1.5][tpk(V.myTeam, 'cavspd')] : 1) *
      (P.hen ? HEN.speed * (P.fh > 0.4 ? HFLY.spd : 1) : 1);
  const flyOn = P.hen && P.fh > 0.4; // a flying chicken goes over water, rocks and trees
  const dashing = P.dashT > 0;
  if (dashing) {
    P.dashT -= dt;
    vx = cy;
    vz = cyz;
    speed = 27;
  }
  const inW = inWater(P.x, P.z),
    wd = !inW && wadeAt(P.x, P.z);
  if (P.dashT > 0 && (inW || wd)) {
    P.dashT -= dt * 0.8;
    if (Math.random() < dt * 30) puff(P.x + (Math.random() - 0.5) * 1.4, WL + 0.2, P.z + (Math.random() - 0.5) * 1.4, 0xe8f8ff, 1, 0.6);
  }
  const swim = inW ? (P.dashT > 0 ? 0.5 : 0.42) : wd ? (P.dashT > 0 ? 0.7 : 0.82) : 1,
    fz = frozen || P.pj || P.air ? 0 : (P.waterDrag = lerp(P.waterDrag ?? swim, swim, 1 - Math.exp(-dt * 9)));
  let wvx = vx * speed * fz,
    wvz = vz * speed * fz;
  if (!P.pj && !P.air && !frozen && !flyOn) {
    iceVelocity(P, wvx, wvz, dt);
    wvx = P.ivx;
    wvz = P.ivz;
    if (onIce(P.x, P.z) && Math.hypot(wvx, wvz) > 3 && Math.random() < dt * 8)
      emitFX('ice', P.x, unitY(P.x, P.z) + 0.1, P.z, { n: 1, size: 0.4, dx: -cy, dz: -cyz });
  } else if (!P.air) {
    P.ivx = wvx;
    P.ivz = wvz;
  }
  const nx = P.x + wvx * dt,
    nz = P.z + wvz * dt;
  if (flyOn) {
    P.x = nx;
    P.z = nz;
  } else if (P.tun && !frozen) {
    if (canBurrow(nx, nz)) {
      P.x = nx;
      P.z = nz;
    } else if (canBurrow(nx, P.z)) P.x = nx;
    else if (canBurrow(P.x, nz)) P.z = nz;
    P.fy = unitY(P.x, P.z);
  } else if (P.pj) {
    /* Pad flight owns the trajectory. */
  } else if (P.air) {
    const landed = airStep(P, dt);
    if (landed && !(P.hp <= 0) && P.landV > 5) emitFX('land', P.x, P.fy + 0.1, P.z, { size: 0.7 });
  } else if (walkable(nx, nz) && !fallZone(nx, nz)) {
    advanceGround(P, nx, nz, wvx, wvz, dt, dashing, true);
  } else if (fallZone(nx, nz) || (edgeSlide(nx, nz) && (dashing || groundY(nx, nz) <= groundY(P.x, P.z) + 0.03))) {
    advanceGround(P, nx, nz, wvx, wvz, dt, dashing, true);
  } else if (walkable(nx, P.z) && Math.abs(nx - P.x) > 1e-4) P.x = nx;
  else if (walkable(P.x, nz) && Math.abs(nz - P.z) > 1e-4) P.z = nz;
  else {
    const mx = nx - P.x,
      mz = nz - P.z;
    for (const ang of [0.5, -0.5, 1.0, -1.0, 1.45, -1.45]) {
      const c = Math.cos(ang),
        sn = Math.sin(ang),
        f = Math.cos(ang) * 0.9,
        tx = P.x + (mx * c - mz * sn) * f,
        tz = P.z + (mx * sn + mz * c) * f;
      if (walkable(tx, tz)) {
        P.x = tx;
        P.z = tz;
        break;
      }
    }
  }
  P.slope = !walkable(P.x, P.z) && edgeSlide(P.x, P.z);
  if (!walkable(P.x, P.z) && !P.pj && !P.air && !P.falling && !P.slope && !flyOn) {
    const q = nearestWalkable(MAP, P.x, P.z);
    P.x = q.x;
    P.z = q.z;
  }
  P.x = clampX(P.x);
  P.z = clampZ(P.z);
  egoSound(P, dt, Math.hypot(P.x - sx0, P.z - sz0));
  // Reconciliation with the host. The host takes the position we send (within its limits) and tells us in every snapshot which
  // input packet it last applied (ia). We compare its position with what we had sent in that very packet: a difference means the host
  // could not follow us there (an edge or obstacle it sees differently, its speed limit, a shove) – only then we drift over by that
  // offset. Latency alone never pulls us back: a late answer is compared with the old packet it answers, not with where we are now.
  if (P.srv && P.srvN !== undefined && !frozen && !P.air && !P.pj && !(P.dashT > 0) && !KINDS[P.k].worm) {
    if (P.srvS !== P.recS) {
      // a new snapshot
      P.recS = P.srvS;
      let h = null;
      for (let i = (P.hist || []).length - 1; i >= 0 && !h; i--) if (P.hist[i][0] === P.srvN) h = P.hist[i];
      if (h) {
        const ex = P.srv.x - h[1],
          ez = P.srv.z - h[2],
          err = Math.hypot(ex, ez);
        if (err < 0.35) {
          P.errC = 0;
          P.errL = undefined;
          P.pend = null;
        } else {
          // right after a stall the host is still on its way (it follows at EGO_MAX_V): no verdict while the gap keeps closing.
          // A steady offset (the host follows us, but displaced) is taken back quickly; a growing one (the host cannot keep up with
          // the speed we claim) only gently, so the delayed feedback cannot swing.
          const closing = P.errL !== undefined && err < P.errL - 0.2,
            gain = P.errL !== undefined && err > P.errL + 0.2 ? 0.2 : 0.5;
          if (!closing) P.errC = (P.errC || 0) + 1;
          if (P.errC >= 2) P.pend = { x: ex * gain, z: ez * gain };
          P.errL = err;
        }
      }
    }
    if (P.pend) {
      const k = 1 - Math.exp(-dt * 10),
        mx = P.pend.x * k,
        mz = P.pend.z * k;
      P.x += mx;
      P.z += mz;
      P.pend.x -= mx;
      P.pend.z -= mz;
      P.pullN = (P.pullN || 0) + 1; // diagnostics (tests): how often and how far the host corrected us
      P.pullD = (P.pullD || 0) + Math.hypot(mx, mz);
      if (Math.hypot(P.pend.x, P.pend.z) < 0.02) P.pend = null;
    }
  } else P.pend = null;
  P.yaw = P.camYaw;
  P.moving = !frozen && (jl > 0.15 || P.dashT > 0);
  {
    // falling: walk off a steep edge -> drop with gravity; hard landings tumble
    const g = unitY(P.x, P.z),
      hd = Math.hypot(P.x - (P.lx ?? P.x), P.z - (P.lz ?? P.z));
    P.lx = P.x;
    P.lz = P.z;
    if (P.pj) {
      P.vy = 0;
    } else if (!P.air) {
      if (P.hen) henFly(P, dt);
      P.fy = g + (P.fh || 0);
      P.vy = 0;
    }
    if (P.wasJump && !((P.jumpT || 0) > 0) && P.jy0 !== undefined && P.jy0 - g > 3.6) {
      P.tumT = 0.95;
      startTumble(V.units.get(P.id));
    }
    P.wasJump = (P.jumpT || 0) > 0;
  }
  P.n = ((P.n || 0) + 1) % 100000; // packet number; the host answers with it (snapshot ia), see the reconciliation above
  const input = {
    id: P.id,
    n: P.n,
    x: +P.x.toFixed(2),
    z: +P.z.toFixed(2),
    y: +P.yaw.toFixed(3),
    a: P.a,
    s: P.s,
    j: P.j || 0,
    g: P.g || 0,
    h: P.h || 0,
    pad: P.padAck || 0,
    air: P.airAck || 0,
    flying: !!P.air,
  };
  if (P.cb) input.cb = P.cb; // the combo step of the last blow (CMB)
  if (P.hen) {
    input.fh = +P.fh.toFixed(2);
    input.dv = P.dv || 0;
  }
  if (P.air) input.av = [P.air.vx, P.air.vz, P.air.vy, P.air.kind === 'dash' ? 1 : 0, +P.fy.toFixed(3), +P.air.sy.toFixed(3)];
  if (P.ad) input.ad = P.ad;
  if (P.at) input.at = P.at;
  if (P.gp) input.gp = P.gp;
  if (P.dp) input.dp = P.dp;
  if (P.nadeAim) nadeAimView(P);
  P.jT = Math.max(0, (P.jT || 0) - rdt);
  P.gT = Math.max(0, (P.gT || 0) - rdt);
  P.jumpT = Math.max(0, (P.jumpT || 0) - rdt);
  {
    const hj = !tpk(V.myTeam, 'jump'),
      hn = !canNade();
    const bj = $('#egoJump'),
      bn = $('#egoNade');
    if (bj.hidden !== hj) bj.hidden = hj;
    if (bn.hidden !== hn) bn.hidden = hn;
    cssVar(bj, '--p', Math.round((P.jT / 2.2) * 100) + '%');
    cssVar(bn, '--p', Math.round((P.gT / (tpk(V.myTeam, 'dance') ? 14 : 1.5)) * 100) + '%');
    const nc = tpk(V.myTeam, 'dance') ? '' : String(myNades());
    let cnt = bn.querySelector('.ncnt');
    if (!cnt) {
      cnt = document.createElement('b');
      cnt.className = 'ncnt';
      bn.appendChild(cnt);
    }
    if (cnt.textContent !== nc) {
      cnt.textContent = nc;
      cnt.hidden = !nc;
    }
  }
  (P.hist || (P.hist = [])).push([P.n, input.x, input.z]); // what we sent, by packet number (about ten seconds of it)
  if (P.hist.length > 600) P.hist.splice(0, 100);
  if (V.mode === 'ai' || V.mode === 'host') G.teams[V.myTeam].posIn = input;
  else if (NET.r && now() - EG.sendT > 66) {
    EG.sendT = now();
    NET.r.presence({ in: input }).catch(() => {});
  }
  const sp = $('#egoSp');
  cssVar(sp, '--p', Math.round(Math.min(100, (P.spT / (spCdOf(P.k) * [1, 0.34][tpk(V.myTeam, 'charge')])) * 100)) + '%');
  cssSet(sp, 'opacity', P.spT > 0 ? '0.75' : '1');
  {
    const sf = $('#speedFx'),
      fast =
        P.dashT > 0
          ? 0.95
          : P.moving && (tpk(V.myTeam, 'turbo') || (KINDS[P.k].role === 'cav' && tpk(V.myTeam, 'cavspd')) || P.rageT > 0)
            ? 0.4
            : 0;
    if (sf.style.opacity !== String(fast)) sf.style.opacity = String(fast);
  }
  {
    const rdy = !(P.spT > 0) && !P.dance;
    if (rdy !== !!EG.spReady) {
      EG.spReady = rdy;
      sp.classList.toggle('ready', rdy);
      if (rdy && now() - P.t0 > 1500) {
        SFX.play('ready');
        const o = V.units.get(P.id);
        if (o)
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * TAU;
            puff(P.x + Math.cos(a) * 1.1, (P.fy ?? unitY(P.x, P.z)) + 1 + Math.sin(k) * 0.6, P.z + Math.sin(a) * 1.1, 0xffd75e, 1, 0.45);
          }
      }
    }
  }
  {
    const dz = !!P.dance,
      ab = $('#egoAtk');
    if (ab.classList.contains('dance') !== dz) {
      ab.classList.toggle('dance', dz);
      ab.innerHTML = '<i class="cd"></i>' + (dz ? si('dance') : ICON.sword) + (COARSE ? '' : '<kbd class="kb">' + TR('Klick') + '</kbd>');
      ab.setAttribute('aria-label', dz ? TR('Tanzen') : TR('Angriff'));
      $('#danceBan').hidden = !dz;
      if (!dz) P.mv = null;
    }
    if (P.mv) {
      P.mv.t += rdt;
      if (P.mv.t > 0.9) P.mv = null;
    }
    cssSet(ab, 'opacity', !dz && P.cdT > 0 ? '0.85' : '1');
    cssVar(ab, '--p', (dz ? 0 : Math.round((P.cdT / (K.cd * CFG.possCd * (K.ego || NO_EGO).cd)) * 100)) + '%');
    const rd = !dz && P.cdT <= 0;
    if (ab._rdy !== rd) {
      ab._rdy = rd;
      ab.classList.toggle('rdy', rd);
    }
  }
  const u = V.units.get(P.id);
  if (u) cssSet($('#egoHp'), 'width', u.hpPct + '%');
  if (V.latest) {
    const gt = String(V.latest.g[V.myTeam]);
    if (gt !== EG.gtxt) {
      EG.gtxt = gt;
      $('#egoGold').textContent = gt;
    }
  }
  if (!P.confirmed && u && u.isPoss) P.confirmed = true;
  if (!P.confirmed && now() - P.t0 > (V.mode === 'guest' ? 12000 : 4000)) {
    exitEgo(false);
    toast(TR('Übernehmen hat nicht geklappt.'), 1800);
    return;
  }
  {
    // "Den Helden spielen": the button shows up while a surfaced wild sandworm is close; no answer from the host -> too late
    const hb = $('#egoHero'),
      show = !P.heroOn && !P.heroReq && heroTargetView(P, hb.hidden ? HERO.rC : HERO.rC + 0.4) !== null; // shows from 4.8 m, hides beyond 5.2 m: no blinking at the edge
    if (hb.hidden === show) {
      hb.hidden = !show;
      if (show) {
        SFX.play('ready', { vol: 0.7 });
        if (!EG.heroTold) {
          EG.heroTold = true;
          egoHint(
            COARSE
              ? TR('Nah am Sandwurm! Tippe „Den Helden spielen“: rauf, zustechen, fressen lassen.')
              : TR('Nah am Sandwurm! Drück {0} oder klicke „Den Helden spielen“: rauf, zustechen, fressen lassen.', kl('hero')),
            3200
          );
        }
      }
    }
    if (P.heroReq && !P.heroOn && now() - P.heroReq > 1600) {
      P.heroReq = 0;
      egoHint(TR('Zu spät – der Wurm ist schon weg!'), 1400);
    }
  }
  egoLoadUi(P); // "Ins Katapult" (75-fass-falle-view.js)
  if (!!P.burning !== document.body.classList.contains('burnOn')) document.body.classList.toggle('burnOn', !!P.burning);
  if (P.fassCam && fassCamTick(P, dt)) return; // the camera rides along with the own Feuerfass
  if (P.heroOn && heroCam(P, dt)) return;
  const cav = KINDS[P.k].role === 'cav' || !!KINDS[P.k].bear,
    sg = KINDS[P.k].role === 'siege',
    wmE = !!KINDS[P.k].worm,
    back = (sg ? 10.5 : wmE ? 10.5 : cav ? 7.2 : 6.3) + (P.held && !wmE ? 5 : 0) + (P.hen ? Math.min(5, (P.fh || 0) * 0.35) : 0),
    side = 0,
    gy =
      (P.fy ?? unitY(P.x, P.z)) +
      (wmE ? 1.4 : 0) +
      (P.held && !wmE ? 3.5 : 0) +
      ((P.jumpT || 0) > 0
        ? P.jDur > 1
          ? 4 * PAD_H * (P.jumpT / PAD_FLY) * (1 - P.jumpT / PAD_FLY)
          : Math.sin(((0.9 - P.jumpT) / 0.9) * Math.PI) * 3
        : 0);
  const rx = -cyz,
    rz = cy,
    cp = Math.cos(P.pitch),
    sp2 = Math.sin(P.pitch);
  // Camera: rotation follows yaw/pitch IMMEDIATELY (no lag, no sponge); only the pivot POSITION is smoothed,
  // frame-rate independently, to hide terrain steps and network corrections.
  const pv = EG.pivT.set(P.x + rx * side, gy + (sg ? 5.2 : cav ? 4.3 : 3.7), P.z + rz * side);
  if (!EG.camInit) {
    EG.piv.copy(pv);
    EG.lift = 0;
  } else {
    const kh = 1 - Math.exp(-dt * 26),
      kv = 1 - Math.exp(-dt * 12);
    EG.piv.x += (pv.x - EG.piv.x) * kh;
    EG.piv.z += (pv.z - EG.piv.z) * kh;
    EG.piv.y += (pv.y - EG.piv.y) * kv;
    if (Math.hypot(pv.x - EG.piv.x, pv.z - EG.piv.z) > 6) EG.piv.copy(pv);
  }
  const dir = EG.dir.set(cy * cp, -sp2, cyz * cp);
  EG.kick = Math.max(0, EG.kick - dt * 1.6);
  const want = EG.want.copy(EG.piv).addScaledVector(dir, -(back - EG.kick * 1.2));
  {
    const need = Math.max(0, groundY(want.x, want.z) + 0.9 - want.y);
    EG.lift = need > EG.lift ? need : EG.lift + (need - EG.lift) * (1 - Math.exp(-dt * 6));
    want.y += EG.lift;
  } // never clip into a hill; ease back down
  const look = EG.look3.copy(EG.piv).addScaledVector(dir, 14);
  if (EG.intro > 0) {
    EG.intro -= dt;
    const hb = headBox({ k: P.k, poss: true }),
      hy = gy + hb.y,
      fl = EG.tmpB.set(P.x, hy - 0.2, P.z);
    const k = sstep(0.5, 0, EG.intro);
    $('#xhair').style.opacity = k;
    // swing round the warrior on an arc, from the front (looking at the face) to behind him: a straight line would pass through his head (one dark frame inside it)
    const fx = cy * 4.4 + rx * 0.6,
      fz = cyz * 4.4 + rz * 0.6,
      bx = want.x - P.x,
      bz = want.z - P.z,
      aF = Math.atan2(fx, fz),
      a = aF + angDiff(Math.atan2(bx, bz), aF) * k,
      r = lerp(Math.hypot(fx, fz), Math.hypot(bx, bz), k);
    want.set(P.x + Math.sin(a) * r, lerp(hy + 0.5, want.y, k), P.z + Math.cos(a) * r);
    look.lerpVectors(fl, look, k);
    if (EG.intro <= 0) EG.intro = 0;
  }
  // never inside a base: right after spawning the warrior stands at the door and the camera behind him would sit in the house (the outline of its walls turned the screen black)
  for (const B of BASES) {
    if (!B) continue;
    const x0 = B.x - 7.3,
      x1 = B.x + 7.3,
      z0 = B.z - 4.3,
      z1 = B.z + 4.3,
      top = groundY(B.x, B.z) + BASE_H + 1,
      inB = (x, y, z) => x > x0 && x < x1 && z > z0 && z < z1 && y < top;
    if (inB(want.x, want.y, want.z) && !inB(EG.piv.x, EG.piv.y, EG.piv.z)) {
      let lo = 0,
        hi = 1;
      for (let i = 0; i < 14; i++) {
        const m = (lo + hi) / 2;
        if (inB(lerp(EG.piv.x, want.x, m), lerp(EG.piv.y, want.y, m), lerp(EG.piv.z, want.z, m))) hi = m;
        else lo = m;
      }
      want.set(lerp(EG.piv.x, want.x, lo), lerp(EG.piv.y, want.y, lo), lerp(EG.piv.z, want.z, lo));
      const dp = want.distanceTo(EG.piv);
      if (dp < 3.5) want.y += (3.5 - dp) * 0.5;
    }
  } // pulled in close: look a little more from above
  EG.cam.copy(want);
  EG.lk.copy(look);
  EG.camInit = true;
  camera.position.copy(EG.cam);
  camera.lookAt(EG.lk);
  {
    const f0 = camera.aspect < 1 ? 78 : 62,
      want = f0 + (P.dashT > 0 ? 9 : 0) - (EG.punch || 0) * 4; // a combo finisher punches in for a moment
    EG.punch = Math.max(0, (EG.punch || 0) - dt * 5);
    if (Math.abs(camera.fov - want) > 0.05) {
      camera.fov = lerp(camera.fov, want, Math.min(1, dt * (P.dashT > 0 || EG.punch > 0 ? 14 : 5)));
      camera.updateProjectionMatrix();
    }
  } // dash: speed kick
  camera.updateMatrixWorld();
  sun.target.position.set(P.x, 0, P.z);
  sun.position.copy(sun.target.position).add(SUN_OFF);
}
