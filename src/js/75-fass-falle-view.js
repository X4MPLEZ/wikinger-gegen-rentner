/* 75-fass-falle-view.js - THE NEWEST WARRIORS ON SCREEN (every screen; the rules are in 16-sim-fass-falle.js):
   - explosions (s.xe): a white flash, a fireball that rolls up into smoke, a shock ring on the ground, flying barrel staves and hoops,
     embers, a smoke column and a scorch mark that stays a while; the camera shakes by distance, close by the screen flashes;
   - a lit Feuerfass: sparks at the fuse, the barrel throbs, a red ring on the ground shows how far the blast will reach;
   - burning warriors: flames and soot, they flail (80-animation.js), a steered one sees the screen glow;
   - bear traps (s.tr): own ones grey and clear with a ring in the team colour, enemy ones barely visible (and hidden in the fog);
     thrown, they fly in an arc from the Fallenleger's hand, open when they land and snap shut; one picked up leaves a puff of dirt;
     the steered Fallenleger sees a ring where his trap would land;
   - the Fallenleger's attack (XE.fangs): a row of trap jaws comes up out of little molehills one after another, snaps, sinks back;
   - the catapult with a Feuerfass in its cup, the barrel in flight (tumbling, smoking, the helmet peeking out) and the camera that
     follows the steered player's barrel to the bang before going back to the commander view; the "Ins Katapult" button;
   - the flying chicken's dive for the others, a Feuerfass that climbs into a catapult (no death).
   Timing after the research on game feel: sound and flash at once, particles at once, the word a moment later; shake short and
   scaled by distance. */
const BOOM = { fx: [], scorch: [], smoke: [], traps: new Map(), mats: null, pool: [], ring: [] };
Object.assign(FX_PROFILES, {
  flame: { col: 0xff9a2a, n: 1, life: 0.42, spread: 0.7, lift: 2.6, gravity: -1.5, drag: 1.2, grow: -0.2, stretch: 1.7, alpha: 1 },
  spark: { col: 0xffe07a, n: 1, life: 0.38, spread: 3.2, lift: 3.2, gravity: 9, drag: 0.6, grow: -0.5, stretch: 1.9, alpha: 1 },
  ember: { col: 0xff8a2a, n: 14, life: 0.95, spread: 9, lift: 7, gravity: 11, drag: 0.5, grow: -0.6, stretch: 1.5, alpha: 1 },
  soot: { col: 0x3a3634, n: 1, life: 1.3, spread: 1.2, lift: 1.6, gravity: -0.4, drag: 0.6, grow: 1.4, stretch: 1, alpha: 0.85 },
});
function boomMats() {
  if (BOOM.mats) return BOOM.mats;
  const add = c => {
    const m = new THREE.MeshBasicMaterial({
      color: lin(c),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    m.userData.shared = true;
    return m;
  };
  const see = c => {
    const m = new THREE.MeshLambertMaterial({ color: lin(c), transparent: true, opacity: 0.2, depthWrite: false });
    m.userData.shared = true;
    return m;
  };
  BOOM.mats = {
    ball: new THREE.IcosahedronGeometry(1, 2),
    flash: add(0xfff4c8),
    stave: lam(0x8a5428),
    staveD: lam(0x5e3818),
    hoop: lam(0x4a4f57),
    staveGeo: new THREE.BoxGeometry(0.09, 0.52, 0.04),
    hoopGeo: new THREE.TorusGeometry(0.26, 0.022, 4, 10, Math.PI),
    scorchTex: (() => {
      const c = cnv(128, 128),
        x = c.getContext('2d'),
        g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
      g.addColorStop(0, 'rgba(18,14,12,.92)');
      g.addColorStop(0.55, 'rgba(30,24,20,.6)');
      g.addColorStop(1, 'rgba(30,24,20,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + Math.random() * 0.3,
          r = 34 + Math.random() * 22;
        x.fillStyle = 'rgba(20,16,14,.45)';
        x.beginPath();
        x.ellipse(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 9, 4, a, 0, TAU);
        x.fill();
      } // a splash-shaped rim
      return ctex(c);
    })(),
    disc: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    // traps: own = plain grey, enemy = see-through (barely visible); a sprung trap shows to everyone
    own: { steel: lam(0x8e969e), dark: lam(0x4f565e), rust: lam(0x8a5a3a) },
    foe: { steel: see(0x8e969e), dark: see(0x4f565e), rust: see(0x8a5a3a) },
    charM: (() => {
      const m = new THREE.MeshLambertMaterial({ color: lin(0x26221f) });
      m.userData.shared = true;
      return m;
    })(),
    charFace: (() => {
      const c = cnv(512, 256),
        x = c.getContext('2d');
      x.fillStyle = '#26221f';
      x.fillRect(0, 0, 512, 256);
      [100, 156].forEach(cx => ell(x, cx, 118, 20, 22, '#fff'));
      [100, 156].forEach(cx => ell(x, cx, 122, 8, 9, '#111'));
      x.strokeStyle = '#fff';
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(108, 176);
      x.quadraticCurveTo(128, 168, 148, 178);
      x.stroke();
      const m = new THREE.MeshLambertMaterial({ map: ctex(c) });
      m.userData.shared = true;
      return m;
    })(),
  };
  return BOOM.mats;
}
// a fireball ball from the pool (each has its own material: colour, glow and opacity animate). Lit, so the smoke it rolls into
// has volume like a cartoon cloud; while hot it glows (emissive) and looks flat and bright.
function boomBall() {
  const M = boomMats();
  let b = BOOM.pool.pop();
  if (!b) {
    b = new THREE.Mesh(
      M.ball,
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, transparent: true, depthWrite: false })
    );
    b.renderOrder = 3;
  }
  b.visible = true;
  scene.add(b);
  return b;
}
const BOOM_COL = [0xfff7d6, 0xffd36a, 0xff8a2a, 0xd8431f, 0x5a4a42, 0x3a3634].map(c => new THREE.Color(lin(c)));
function boomColor(out, q) {
  const f = clamp(q, 0, 0.999) * (BOOM_COL.length - 1),
    i = Math.floor(f);
  return out.copy(BOOM_COL[i]).lerp(BOOM_COL[i + 1], f - i);
}
/* The bang. kind: XE.blast (a Feuerfass), XE.dud (felled before he went off), XE.cata (shot from a catapult). */
function blastFx(x, z, r, kind) {
  const M = boomMats(),
    y = groundY(x, z),
    big = kind === XE.cata,
    dud = kind === XE.dud,
    s = big ? 1.25 : dud ? 0.65 : 1,
    L = listenerPos(),
    d = Math.hypot(x - L.x, z - L.z),
    hidden = FOG.on && !fogSeen(x, z);
  SFX.play(dud ? 'dud' : 'blast', { x, z, vol: big ? 1.4 : dud ? 1 : 1.25 });
  shake((V.poss ? 0.75 : 0.55) * s * Math.max(0, 1 - d / (V.poss ? 34 : 70)));
  if (V.poss && d < r + 6) {
    EG.kick = Math.max(EG.kick, 0.6 * s);
    EG.punch = 1;
    boomFlash(d < r + 1 ? 1 : 0.55);
    if (navigator.vibrate)
      try {
        navigator.vibrate(dud ? 60 : 140);
      } catch (_) {}
  }
  // the smoke rises out of the fog too; everything else only where it can be seen
  BOOM.smoke.push({ x, z, y, t: 0, life: dud ? 1.1 : big ? 2.6 : 2, s });
  if (hidden) return;
  // 1) flash: a white-hot sphere for a tenth of a second
  const fm = M.flash.clone();
  fm.userData = {}; // (its own: freed when it has faded)
  const fl = new THREE.Mesh(M.ball, fm);
  fl.position.set(x, y + 1, z);
  fl.renderOrder = 4;
  scene.add(fl);
  BOOM.fx.push({ ty: 'flash', m: fl, t: 0, life: 0.16, r: r * 0.75 * s });
  // 2) fireball: hot balls that swell, rise, cool to red and roll up into smoke
  const n = dud ? 4 : big ? 9 : 7;
  for (let i = 0; i < n; i++) {
    const b = boomBall(),
      a = (i / n) * TAU + Math.random(),
      rr = (i ? 0.35 + Math.random() * 0.45 : 0) * r * 0.45;
    b.position.set(x + Math.cos(a) * rr, y + 0.6 + Math.random() * 0.8, z + Math.sin(a) * rr);
    BOOM.fx.push({
      ty: 'ball',
      m: b,
      t: -Math.random() * 0.06,
      life: (0.9 + Math.random() * 0.6) * (dud ? 0.7 : 1),
      r: (0.45 + Math.random() * 0.35) * r * 0.36 * s,
      vy: 1.6 + Math.random() * 2.2,
      vx: Math.cos(a) * (0.6 + Math.random()),
      vz: Math.sin(a) * (0.6 + Math.random()),
    });
  }
  // 3) shock ring on the ground
  {
    const m = new THREE.MeshBasicMaterial({
      color: lin(0xfff0c0),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, m);
    ring.position.set(x, y + 0.15, z);
    scene.add(ring);
    BOOM.fx.push({ ty: 'ring', m: ring, t: 0, life: 0.42, r: r * 1.15 });
  }
  // 4) the barrel in pieces: staves and hoops fly, bounce once and lie a moment
  if (kind !== XE.dive) {
    const ns = dud ? 5 : 9;
    for (let i = 0; i < ns + 2; i++) {
      const hoop = i >= ns,
        m = new THREE.Mesh(hoop ? M.hoopGeo : M.staveGeo, hoop ? M.hoop : i % 2 ? M.stave : M.staveD),
        a = Math.random() * TAU,
        sp = (4 + Math.random() * 6) * s;
      m.position.set(x, y + 1, z);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.castShadow = true;
      scene.add(m);
      BOOM.fx.push({
        ty: 'deb',
        m,
        t: 0,
        life: 2.6 + Math.random(),
        vx: Math.cos(a) * sp,
        vy: (6 + Math.random() * 6) * s,
        vz: Math.sin(a) * sp,
        rx: (Math.random() - 0.5) * 18,
        rz: (Math.random() - 0.5) * 18,
      });
    }
  }
  // 5) embers, a burst of fire and dust
  emitFX('explosion', x, y + 0.8, z, { n: dud ? 14 : 26, size: 1.5 * s, col: 0xffa23c });
  emitFX('ember', x, y + 1, z, { n: dud ? 8 : 18, size: 0.6 });
  emitFX('land', x, y + 0.2, z, { n: 12, size: 1.6 * s, col: 0x8a7a66 });
  // 6) a scorch mark that stays a while
  {
    const m = new THREE.MeshBasicMaterial({ map: M.scorchTex, transparent: true, opacity: 0.85, depthWrite: false });
    const sc = new THREE.Mesh(M.disc, m);
    sc.position.set(x, y + 0.04, z);
    sc.rotation.y = Math.random() * TAU;
    sc.scale.setScalar(r * (dud ? 0.5 : 0.75));
    sc.renderOrder = 1;
    scene.add(sc);
    BOOM.scorch.push({ m: sc, t: 0 });
    while (BOOM.scorch.length > 10) boomDrop(BOOM.scorch.shift().m, true);
  }
  // 7) the word, a heartbeat after the bang
  setTimeout(
    () =>
      word(dud ? TR('PUFF!') : big ? TR('FEUERFASS!') : pick([TR('KAWUMM!'), TR('KABUMM!'), TR('BUMM!')]), x, y + 4.2 * s, z, {
        color: dud ? '#ffcf8a' : '#ff9b3c',
        scale: dud ? 1.2 : 2,
        prio: true,
      }),
    90
  );
}
// the screen flashes white-orange when a blast goes off close to the steered warrior
function boomFlash(a) {
  const el = $('#boomFlash');
  if (!el) return;
  el.style.setProperty('--a', String(a));
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}
function boomDrop(m, mat) {
  scene.remove(m);
  if (mat && m.material && !m.material.userData.shared) m.material.dispose();
}
function boomTick(dt) {
  const M = BOOM.mats;
  for (let i = BOOM.fx.length - 1; i >= 0; i--) {
    const f = BOOM.fx[i];
    f.t += dt;
    if (f.t < 0) {
      f.m.scale.setScalar(0.001);
      continue;
    }
    const q = f.t / f.life;
    if (q >= 1) {
      if (f.ty === 'ball') {
        scene.remove(f.m);
        f.m.visible = false;
        BOOM.pool.push(f.m);
      } else boomDrop(f.m, f.ty !== 'deb');
      BOOM.fx.splice(i, 1);
      continue;
    }
    if (f.ty === 'flash') {
      f.m.scale.setScalar(f.r * (0.4 + 0.6 * Math.min(1, q * 3)));
      f.m.material.opacity = 1 - q;
    } else if (f.ty === 'ball') {
      const g = 1 - Math.pow(1 - Math.min(1, q * 2.2), 3); // fast swell, then hangs
      f.m.scale.setScalar(f.r * (0.25 + 0.95 * g) * (1 + q * 0.5));
      f.m.position.x += f.vx * dt * (1 - q);
      f.m.position.z += f.vz * dt * (1 - q);
      f.m.position.y += f.vy * dt;
      f.vy *= 1 - dt * 0.8;
      const mt = f.m.material,
        hot = 1 - sstep(0.12, 0.5, q); // glowing at first, then a lit cloud of smoke
      boomColor(mt.color, q * 1.05);
      mt.emissive.copy(mt.color).multiplyScalar(hot);
      mt.opacity = q < 0.55 ? 1 : Math.max(0, 1 - (q - 0.55) / 0.45);
    } else if (f.ty === 'ring') {
      const e = 1 - Math.pow(1 - q, 3);
      f.m.scale.setScalar(0.3 + f.r * e);
      f.m.material.opacity = 0.9 * (1 - q);
    } else if (f.ty === 'deb') {
      const p = f.m.position,
        fl = groundY(p.x, p.z) + 0.05;
      if (!f.rest) {
        f.vy -= 22 * dt;
        p.x += f.vx * dt;
        p.y += f.vy * dt;
        p.z += f.vz * dt;
        f.m.rotation.x += f.rx * dt;
        f.m.rotation.z += f.rz * dt;
        if (p.y <= fl && f.vy < 0) {
          p.y = fl;
          if (Math.abs(f.vy) > 4 && !f.b) {
            f.b = 1; // one bounce
            f.vy *= -0.32;
            f.vx *= 0.45;
            f.vz *= 0.45;
            f.rx *= 0.4;
            f.rz *= 0.4;
          } else {
            f.rest = 1;
            f.m.rotation.x = Math.PI / 2;
          }
        }
        if (Math.random() < dt * 10) puff(p.x, p.y, p.z, 0x4a4644, 1, 0.3); // smoking pieces
      }
      if (q > 0.75) f.m.scale.setScalar(Math.max(0.01, 1 - (q - 0.75) / 0.25));
    }
  }
  for (let i = BOOM.smoke.length - 1; i >= 0; i--) {
    const S = BOOM.smoke[i];
    S.t += dt;
    if (S.t > S.life) {
      BOOM.smoke.splice(i, 1);
      continue;
    }
    if (Math.random() < dt * 22 * QS.fx)
      puff(
        S.x + (Math.random() - 0.5) * 1.4 * S.s,
        S.y + 0.8 + S.t * 2.2 + Math.random(),
        S.z + (Math.random() - 0.5) * 1.4 * S.s,
        Math.random() < 0.5 ? 0x4a4644 : 0x6a625c,
        1,
        1.3 * S.s,
        'soot'
      );
  }
  for (let i = BOOM.scorch.length - 1; i >= 0; i--) {
    const S = BOOM.scorch[i];
    S.t += dt;
    if (S.t > 18) S.m.material.opacity = Math.max(0, 0.85 * (1 - (S.t - 18) / 5));
    if (S.t > 23) {
      boomDrop(S.m, true);
      BOOM.scorch.splice(i, 1);
    }
  }
  fangTick(dt);
  if (!M) return;
}
function boomReset() {
  for (const f of BOOM.fx) {
    if (f.ty === 'ball') {
      scene.remove(f.m);
      f.m.visible = false;
      BOOM.pool.push(f.m);
    } else boomDrop(f.m, f.ty !== 'deb');
  }
  BOOM.fx.length = 0;
  for (const S of BOOM.scorch) boomDrop(S.m, true);
  BOOM.scorch.length = 0;
  BOOM.smoke.length = 0;
  for (const v of BOOM.traps.values()) trapViewDrop(v);
  BOOM.traps.clear();
  fangReset();
  if (trapAimRing) trapAimRing.visible = false;
  V.trapN = 0;
  V.specTold = {};
}
// the first time in a match a Feuerfass or a Fallenleger shows up: what he does (own) or what to watch out for (enemy); a few times per device
function specTip(u) {
  if (!V.playing || V.tut || u.hen) return;
  const own = u.team === V.myTeam,
    key = u.k + (own ? 'o' : 'e');
  if ((V.specTold || (V.specTold = {}))[key]) return;
  V.specTold[key] = 1;
  const sk = 'wvr-tip-' + key,
    n = +store.get(sk) || 0;
  if (n >= 3) return;
  store.set(sk, String(n + 1));
  const t =
    u.k === 12
      ? own
        ? TR(
            'Feuerfass: Seine Fackel zündet jeden an, den er schlägt. Selbst gesteuert: Spezial = Lunte – dann fliegt alles im Umkreis. Neben deinem Katapult: „Ins Katapult“!'
          )
        : TR(
            'Achtung, Feuerfass! Seine Fackel zündet dich an, dann ab ins Wasser. Ein Kopfschuss lässt sein Fass sofort hochgehen, mitten zwischen seinen Leuten. Reiter rennen ihn einfach um.'
          )
      : own
        ? TR(
            'Fallenleger: Sein Spaten lässt eine Reihe Fangeisen aus dem Boden schnappen – alle auf der Linie hängen kurz fest. Selbst gesteuert: Spezial = Bärenfalle werfen, wohin der Ring zeigt.'
          )
        : TR(
            'Achtung, Fallenleger! Seine Fangeisen schnappen in einer Linie aus dem Boden, seine Bärenfallen sind kaum zu sehen. Reiter hält er besonders lange fest.'
          );
  setTimeout(() => V.playing && toast(t, 5200), 400);
}
// one-shot impacts from the host (G.xe): [seq, x*10, z*10, r*10, kind, team]
function xeProcess(s) {
  if (!s.xe || !s.xe.length) {
    if (V.xeSeen === undefined) V.xeSeen = 0;
    return;
  }
  for (const e of s.xe) {
    if (V.xeSeen === undefined) {
      V.xeSeen = e[0];
      continue;
    }
    const df = (e[0] - V.xeSeen + 10000) % 10000;
    if (df === 0 || df > 5000) continue;
    V.xeSeen = e[0];
    const x = e[1] / 10,
      z = e[2] / 10,
      r = e[3] / 10,
      kind = e[4];
    if (kind === XE.blast || kind === XE.dud || kind === XE.cata) {
      blastFx(x, z, r, kind);
      if (kind !== XE.dud) baseChunks(x, z, r, kind === XE.cata ? 1.3 : 1);
      if (e[5] === V.myTeam && e[6] >= 5) profEvent('boom', e[6]);
    } else if (kind === XE.dive) diveFx(x, z, e[5]);
    else if (kind === XE.snap) {
      snapFx(x, z, e[5]);
      if (e[5] === V.myTeam) profEvent('trap', e[6] || 0, (V.trapN = (V.trapN || 0) + 1));
    } else if (kind === XE.fangs) {
      if (!(V.poss && V.poss.id === e[7])) fangFx(x, z, (e[8] || 0) / 100, e[6], e[5], 0); // (the own row is drawn already)
    } else if (kind === XE.load) {
      const y = groundY(x, z);
      puff(x, y + 2.4, z, 0xf6f1e7, 6, 0.8);
      SFX.play('load', { x, z });
      word(TR('REIN DA!'), x, y + 4.4, z, { color: '#ffd34d', scale: 1.1 });
    }
  }
}
// the chicken lands its dive: a ring of dust and feathers (the steered one has already shown its own)
function diveFx(x, z, team) {
  const y = groundY(x, z);
  if (FOG.on && team !== V.myTeam && !fogSeen(x, z)) return;
  if (V.poss && V.poss.hen && Math.hypot(V.poss.x - x, V.poss.z - z) < 1.5) return;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    puff(x + Math.cos(a) * 1.6, y + 0.2, z + Math.sin(a) * 1.6, i % 2 ? 0xffffff : 0xd8c48f, 1, 0.7);
  }
  SFX.play('stomp', { x, z, vol: 0.8 });
  SFX.play('chicken', { x, z, vol: 0.8 });
  word(TR('STURZFLUG!'), x, y + 3, z, { color: '#ffffff', scale: 1.1 });
}
// a trap snaps shut: steel sparks, a clang, the word
function snapFx(x, z, team) {
  const y = groundY(x, z),
    L = listenerPos(),
    d = Math.hypot(x - L.x, z - L.z);
  SFX.play('trapSnap', { x, z, vol: 1.1 });
  if (FOG.on && team !== V.myTeam && !fogSeen(x, z)) return;
  emitFX('hit', x, y + 0.35, z, { n: 10, size: 0.7, col: 0xe6eef6 });
  emitFX('spark', x, y + 0.3, z, { n: 8, size: 0.35 });
  if (d < (V.poss ? 14 : 40)) shake(0.12);
  word(TR('SCHNAPP!'), x, y + 2.6, z, { color: team === V.myTeam ? '#9fe8b8' : '#ff8a7a', scale: 1.25, prio: true });
}
/* ---------- bear traps ---------- */
function trapViewDrop(v) {
  scene.remove(v.g);
  disposeTree(v.g);
}
function trapTick(dt) {
  const s = V.latest,
    seen = new Set(),
    M = boomMats();
  for (const e of (s && s.tr) || []) {
    const id = e[0];
    seen.add(id);
    let v = BOOM.traps.get(id);
    const own = e[1] === V.myTeam;
    if (!v) {
      const x = e[2] / 10,
        z = e[3] / 10,
        // freshly thrown (still arming): it flies from the Fallenleger's hand, he throws – everyone sees it fly (an enemy's turns
        // barely visible once it lies)
        o = e[4] === 0 ? V.units.get(e[5]) : null,
        from = o && !o.dead && Math.hypot(o.g.position.x - x, o.g.position.z - z) < TRAP.throw + 2 ? o.g.position : null,
        g = trapModel(true, own || from ? M.own : M.foe);
      g.position.set(x, groundY(x, z) + 0.03, z);
      g.rotation.y = (id * 2.4) % TAU;
      g.scale.setScalar(2.2);
      scene.add(g);
      if (own) {
        // the own trap is easy to spot: a ring in the team colour as wide as the trap bites (TRAP.r), pulsing while armed
        const rm = new THREE.MeshBasicMaterial({
          color: lin(V.facs[V.myTeam] === 'viking' ? 0x5aa8ff : 0xff7ab8),
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, rm);
        ring.scale.setScalar(TRAP.r / 2.2);
        ring.position.y = 0.02;
        ring.visible = !from;
        g.add(ring);
      }
      v = { g, jaws: g.userData.jaws, own, st: -1, open: 0, t: 0, foeVis: false, x, z, fly: from ? 0 : -1 };
      if (from) {
        v.from = [from.x, from.y + 1.6, from.z];
        o.layT = 0.5;
        if (o.isPoss && o.team === V.myTeam) SFX.play('throw', { vol: 0.8 });
      } else trapLand(v);
      BOOM.traps.set(id, v);
    }
    v.t += dt;
    if (v.fly >= 0) {
      // in flight: an arc, tumbling, shut; it opens when it lands
      v.fly += dt;
      const k = Math.min(1, v.fly / TRAP_FLY),
        gy = groundY(v.x, v.z) + 0.03,
        h = 0.8 + Math.hypot(v.x - v.from[0], v.z - v.from[2]) * 0.18;
      v.g.position.set(lerp(v.from[0], v.x, k), lerp(v.from[1], gy, k) + Math.sin(k * Math.PI) * h, lerp(v.from[2], v.z, k));
      v.g.rotation.x = (1 - k) * 9;
      if (k >= 1) {
        v.fly = -1;
        v.g.position.y = gy;
        v.g.rotation.x = 0;
        if (v.own)
          v.g.children[v.g.children.length - 1].visible = true; // its ring shows once it lies
        else if (!v.foeVis)
          v.g.traverse(m => {
            if (m.isMesh && m.material === M.own.steel) m.material = M.foe.steel;
            else if (m.isMesh && m.material === M.own.dark) m.material = M.foe.dark;
            else if (m.isMesh && m.material === M.own.rust) m.material = M.foe.rust;
          }); // an enemy's trap hides in the grass
        trapLand(v);
      } else {
        v.jaws[0].rotation.x = -Math.PI / 2;
        v.jaws[1].rotation.x = Math.PI / 2;
        v.g.visible = v.own || !FOG.on || fogSeen(v.x, v.z);
        continue;
      }
    }
    const st = e[4];
    if (st !== v.st) {
      if (st === 2 && v.st >= 0 && v.st < 2) v.snapT = 0; // it just bit: slam, bounce, hop (below)
      v.st = st;
      if (st >= 2 && !v.own && !v.foeVis) {
        // a sprung trap shows to everyone
        v.foeVis = true;
        v.g.traverse(m => {
          if (m.isMesh && m.material === M.foe.steel) m.material = M.own.steel;
          else if (m.isMesh && m.material === M.foe.dark) m.material = M.own.dark;
          else if (m.isMesh && m.material === M.foe.rust) m.material = M.own.rust;
        });
      }
    }
    // laid shut, it opens (the jaws fold down flat); snapping is quick
    const want = st <= 1 ? 1 : 0;
    v.open = want > v.open ? Math.min(1, v.open + dt * 2.6) : Math.max(0, v.open - dt * 30);
    // snapping: the jaws slam past shut and spring back a little, the trap hops off the ground; while it holds it rattles
    let over = 0;
    const gy0 = groundY(v.x, v.z) + 0.03;
    if (v.snapT !== undefined) {
      v.snapT += dt;
      const q = v.snapT;
      over = Math.sin(q * 38) * Math.exp(-q * 9) * 0.3;
      v.g.position.y = gy0 + (q < 0.28 ? Math.sin((q / 0.28) * Math.PI) * 0.45 : 0);
      v.g.rotation.z = q < 0.5 ? Math.sin(q * 50) * 0.12 * (1 - q / 0.5) : 0;
      if (q > 0.6) v.snapT = undefined;
    } else if (st === 2) {
      v.g.position.y = gy0;
      v.g.rotation.z = Math.sin(clock * 31 + id) * 0.035 * (Math.sin(clock * 2.3 + id) > 0.2 ? 1 : 0); // the victims tug at it
    }
    v.jaws[0].rotation.x = -(Math.PI / 2) * (1 - v.open) - over;
    v.jaws[1].rotation.x = (Math.PI / 2) * (1 - v.open) + over;
    if (st === 3) v.g.scale.setScalar(Math.max(0.01, v.g.scale.x - dt * 1.1));
    v.g.visible = v.own || v.foeVis || !FOG.on || fogSeen(v.x, v.z);
    if (v.own && st === 1) {
      const ring = v.g.children[v.g.children.length - 1];
      if (ring && ring.material) ring.material.opacity = 0.55 + 0.3 * Math.sin(clock * 3 + id);
    }
  }
  for (const [id, v] of BOOM.traps)
    if (!seen.has(id)) {
      // gone without snapping: picked up to be thrown again (or rusted away) – a little puff of dirt where it lay
      if (v.st <= 1 && v.fly < 0 && v.g.visible) puff(v.x, groundY(v.x, v.z) + 0.2, v.z, 0x8a7458, 3, 0.45, 'dust');
      trapViewDrop(v);
      BOOM.traps.delete(id);
    }
}
const TRAP_FLY = 0.35; // seconds a thrown trap flies (within TRAP.arm)
// a trap lands (or is first seen lying): a puff of dirt and the clack of the spring
function trapLand(v) {
  const vis = v.own || !FOG.on || fogSeen(v.x, v.z);
  if (!vis) return;
  const L = listenerPos(),
    y = groundY(v.x, v.z);
  if (v.own || Math.hypot(v.x - L.x, v.z - L.z) < 18) SFX.play('trapSet', { x: v.x, z: v.z, vol: v.own ? 0.9 : 0.5 });
  if (v.own || v.foeVis) puff(v.x, y + 0.15, v.z, 0x8a7458, 3, 0.5, 'dust');
}
// the steered Fallenleger: where his trap would land (the host clamps the same way, trapPlace in 16-sim-fass-falle.js)
function trapAimPt(P) {
  const k = clamp((P.pitch + 0.42) / 1.12, 0, 1),
    d = lerp(TRAP.throw, 1.6, Math.pow(k, 0.8)),
    a = P.camYaw,
    dx = Math.sin(a) * d,
    dz = Math.cos(a) * d;
  let x = clampX(P.x + dx),
    z = clampZ(P.z + dz);
  for (let q = 0.85; !walkable(x, z) && q > 0; q -= 0.15) {
    x = P.x + dx * q;
    z = P.z + dz * q;
  }
  return { x, z };
}
let trapAimRing = null;
function trapAimTick(P) {
  const mu = P && V.units.get(P.id),
    on =
      !!mu &&
      P.k === 13 &&
      !P.hen &&
      !P.trap &&
      !P.down &&
      !P.nadeAim &&
      !(P.spT > 0) &&
      (mu.trapC || ((V.latest && V.latest.tr) || []).some(t => t[5] === P.id && t[4] < 2));
  if (!on) {
    if (trapAimRing) trapAimRing.visible = false;
    return;
  }
  if (!trapAimRing) {
    const m = new THREE.MeshBasicMaterial({
      color: lin(V.facs[V.myTeam] === 'viking' ? 0x5aa8ff : 0xff7ab8),
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
    });
    trapAimRing = new THREE.Group();
    const r = new THREE.Mesh(ringGeo, m);
    r.scale.setScalar(TRAP.r);
    trapAimRing.add(r);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.42).rotateX(-Math.PI / 2), m);
      t.position.set(Math.sin((i * Math.PI) / 2) * (TRAP.r + 0.3), 0, Math.cos((i * Math.PI) / 2) * (TRAP.r + 0.3));
      t.rotation.y = (i * Math.PI) / 2;
      trapAimRing.add(t);
    } // four little ticks round it: a sight on the ground
    trapAimRing.renderOrder = 8;
    trapAimRing.traverse(o => (o.renderOrder = 8));
    scene.add(trapAimRing);
  }
  const t = trapAimPt(P);
  trapAimRing.visible = true;
  trapAimRing.position.set(t.x, groundY(t.x, t.z) + 0.08, t.z);
  trapAimRing.rotation.y += 0.02;
}
/* ---------- the Fallenleger's attack: a row of trap jaws out of the ground (XE.fangs; fangPts in 16-sim-fass-falle.js) ----------
   Each jaw: a molehill bursts, the open jaws come up (0.08 s), wait a heartbeat, snap shut (clack, sparks), and sink back in.
   Shared geometry and materials; the steered Fallenleger's own row starts at once on his screen (egoAttack, 51-ego.js). */
let FANG_V = null;
const FANG_T = { up: 0.08, snap: 0.15, shut: 0.2, sink: 0.52, gone: 0.8 };
function fangParts() {
  if (FANG_V) return FANG_V;
  const R = 0.3,
    jaw = side => {
      const parts = [new THREE.TorusGeometry(R, 0.034, 4, 14, Math.PI).rotateX((side * Math.PI) / 2).toNonIndexed()];
      for (let i = 0; i < 6; i++) {
        const a = 0.25 + (i + (side > 0 ? 0 : 0.5)) * ((Math.PI - 0.5) / 6);
        parts.push(new THREE.ConeGeometry(0.034, 0.12, 4).translate(Math.cos(a) * R, 0.055, side * Math.sin(a) * R).toNonIndexed());
      }
      return mergeGeos(parts);
    },
    base = mergeGeos([
      new THREE.BoxGeometry(R * 2.3, 0.05, 0.08).toNonIndexed(),
      new THREE.CylinderGeometry(0.11, 0.11, 0.025, 10).toNonIndexed(),
      new THREE.TorusGeometry(0.06, 0.022, 4, 8)
        .rotateY(Math.PI / 2)
        .translate(R + 0.08, 0, 0)
        .toNonIndexed(),
      new THREE.TorusGeometry(0.06, 0.022, 4, 8)
        .rotateY(Math.PI / 2)
        .translate(-R - 0.08, 0, 0)
        .toNonIndexed(),
    ]),
    mound = new THREE.SphereGeometry(FANG.r, 10, 4, 0, TAU, 0, Math.PI / 2).toNonIndexed();
  FANG_V = { jaw: [jaw(1), jaw(-1)], base, mound, steel: lam(0x9aa2aa), dark: lam(0x4f565e), dirt: lam(0x6e5236), rows: [] };
  for (const g of [...FANG_V.jaw, base, mound]) g.userData.shared = true;
  return FANG_V;
}
// a row: from (x, z) along yaw, n jaws (the host's count), drawn after `delay` s (the own spade has to come down first)
function fangFx(x, z, yaw, n, team, delay, own) {
  const F = fangParts(),
    pts = fangPts(x, z, yaw, n);
  if (!pts.length) return;
  const hide = FOG.on && team !== V.myTeam && !pts.some(p => fogSeen(p[0], p[1]));
  F.rows.push({ pts, yaw, t: -delay, team, own: !!own, hide, jaws: [] });
  if (hide) return;
  const L = listenerPos();
  if (own || Math.hypot(x - L.x, z - L.z) < 30)
    setTimeout(() => SFX.play('fangs', { x: pts[0][0], z: pts[0][1], n: pts.length, gap: FANG.gap, vol: own ? 1 : 0.8 }), delay * 1000);
}
function fangJaw(F, x, z, yaw) {
  const g = new THREE.Group(),
    j = F.jaw.map(geo => {
      const h = new THREE.Group();
      h.add(new THREE.Mesh(geo, F.steel));
      g.add(h);
      return h;
    }),
    md = new THREE.Mesh(F.mound, F.dirt),
    gy = groundY(x, z);
  g.add(new THREE.Mesh(F.base, F.dark));
  g.scale.setScalar(FANG.r / 0.3); // as wide as it bites (and its shut jaws stand tall enough to show over a head)
  g.rotation.y = yaw; // the hinge lies across the row: from behind him (and from the victim's side) the shut jaws show as a full ring
  g.position.set(x, gy - 0.5, z);
  md.position.set(x, gy - 0.05, z);
  md.scale.set(1, 0.01, 1);
  scene.add(g, md);
  return { g, j, md, gy, x, z, snapped: false, sunk: false };
}
function fangTick(dt) {
  if (!FANG_V || !FANG_V.rows.length) return;
  const F = FANG_V,
    T = FANG_T;
  for (let r = F.rows.length - 1; r >= 0; r--) {
    const R = F.rows[r];
    R.t += dt;
    let alive = false;
    for (let i = 0; i < R.pts.length; i++) {
      const tau = R.t - i * FANG.gap;
      if (tau < 0) {
        alive = true;
        continue;
      }
      let J = R.jaws[i];
      if (tau >= T.gone) {
        if (J && J.g.parent) {
          scene.remove(J.g, J.md);
        }
        continue;
      }
      alive = true;
      if (R.hide) continue;
      if (!J) {
        const [x, z] = R.pts[i];
        J = R.jaws[i] = fangJaw(F, x, z, R.yaw);
        // the molehill bursts: clods and dust fly
        sandBurst(x, z, 7, { r: 0.4, out: 2.2, up: 4.5, size: 0.13, life: 0.9, gy: J.gy });
        puff(x, J.gy + 0.2, z, 0x7b5e3c, 3, 0.75, 'dust');
      }
      const up = Math.min(1, tau / T.up),
        e = 1 - (1 - up) * (1 - up),
        sink = tau > T.sink ? Math.min(1, (tau - T.sink) / (T.gone - T.sink)) : 0,
        // open (flat, a little raised) until the snap, then shut in a blink
        sh = tau < T.snap ? 0 : Math.min(1, (tau - T.snap) / (T.shut - T.snap)),
        a = lerp(0.32, Math.PI / 2, sh * sh);
      J.g.position.y = J.gy - 0.5 + 0.53 * e - 0.6 * sink * sink + (sh > 0 && tau < T.sink ? Math.sin(tau * 90) * 0.012 : 0);
      J.j[0].rotation.x = -a;
      J.j[1].rotation.x = a;
      J.md.scale.set(1, Math.max(0.01, (tau < 0.06 ? tau / 0.06 : 1) * (1 - sink) * 0.4), 1);
      if (sh >= 1 && !J.snapped) {
        J.snapped = true;
        emitFX('spark', J.x, J.gy + 0.45, J.z, { n: 4, size: 0.3 });
        if (R.own) shake(0.06);
      }
      if (sink > 0 && !J.sunk) {
        J.sunk = true;
        puff(J.x, J.gy + 0.15, J.z, 0x7b5e3c, 2, 0.6, 'dust');
      }
    }
    if (!alive) {
      for (const J of R.jaws) if (J && J.g.parent) scene.remove(J.g, J.md);
      F.rows.splice(r, 1);
    }
  }
}
function fangReset() {
  if (!FANG_V) return;
  for (const R of FANG_V.rows) for (const J of R.jaws) if (J && J.g.parent) scene.remove(J.g, J.md);
  FANG_V.rows.length = 0;
}
/* ---------- per warrior, every frame (from updateStatusFx in 42-view-world-fx.js) ---------- */
const BOOM_V = new THREE.Vector3();
// flames that stay on a burning warrior (the sparks fly off; these lick up his body and over his head all the time he burns)
const FIRE_GEO = new THREE.ConeGeometry(0.2, 0.85, 6, 1, true).translate(0, 0.42, 0);
FIRE_GEO.userData.shared = true;
const FIRE_MATS = [0xffc21a, 0xff7a12, 0xe8380c].map(c => {
  // (plain blending: added light washed out to white on snow and sand)
  const m = new THREE.MeshBasicMaterial({ color: lin(c), transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
  m.userData.shared = true;
  return m;
});
function fireCrown(u) {
  const g = new THREE.Group(),
    hb = headBox({ k: u.k, poss: u.isPoss }),
    top = hb.y + hb.r * 0.6;
  for (let i = 0; i < 11; i++) {
    const head = i >= 8,
      a = i * 2.4,
      r = head ? hb.r * 0.55 : 0.3,
      f = new THREE.Mesh(FIRE_GEO, FIRE_MATS[i % 3]);
    f.position.set(Math.sin(a) * r, head ? top : 0.35 + (i / 8) * (top - 0.6), Math.cos(a) * r);
    f.userData.b = head ? 1.25 : 0.8 + (i % 3) * 0.15;
    f.renderOrder = 3;
    g.add(f);
  }
  u.g.add(g);
  return g;
}
// a warrior caught in a bear trap: the trap's jaws round his ankle and a taut chain to the trap that caught him (so everyone sees why
// he is stuck, even a few steps off the trap)
const TRAP_CHAIN = new THREE.CylinderGeometry(0.025, 0.025, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI / 2);
TRAP_CHAIN.userData.shared = true;
function trapLegFx(u, x, y, z) {
  const on = u.trapped && !u.snag && !u.fogHid && !u.dead;
  if (!on) {
    if (u.trapLeg) u.trapLeg.visible = u.trapChain.visible = false;
    u.wasTrapped = false;
    return;
  }
  const M = boomMats(),
    seated = KINDS[u.k].role === 'cav';
  if (!u.trapLeg) {
    u.trapLeg = trapModel(true, M.own, true);
    u.trapLeg.scale.setScalar(0.85);
    u.g.add(u.trapLeg);
    u.trapChain = new THREE.Mesh(TRAP_CHAIN, M.own.dark);
    scene.add(u.trapChain);
  }
  u.trapLeg.visible = true;
  u.trapLeg.position.set(seated ? 0.15 : -0.11, 0.07, seated ? 0.55 : 0.04);
  u.trapLeg.rotation.set(0, Math.PI / 2, Math.sin(clock * 21) * 0.08);
  // the chain: from the ankle to the nearest sprung trap
  let best = null,
    bd = TRAP.r + 1.5;
  for (const v of BOOM.traps.values()) {
    if (v.st < 2) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  const ch = u.trapChain;
  ch.visible = !!best && bd > 0.5;
  if (ch.visible) {
    u.trapLeg.getWorldPosition(BOOM_V);
    const ty = groundY(best.x, best.z) + 0.06;
    ch.position.copy(BOOM_V);
    ch.lookAt(best.x, ty, best.z);
    ch.scale.set(1, 1, Math.hypot(best.x - BOOM_V.x, ty - BOOM_V.y, best.z - BOOM_V.z));
  }
  if (!u.wasTrapped) {
    // caught: he jolts, sparks at the ankle, a shout
    u.wasTrapped = true;
    u.trapLeg.getWorldPosition(BOOM_V);
    emitFX('spark', BOOM_V.x, BOOM_V.y + 0.1, BOOM_V.z, { n: 6, size: 0.3 });
    if (u.isPoss || Math.random() < 0.5)
      word(pick([TR('AUA, MEIN FUSS!'), TR('FESTGEKLEMMT!'), TR('EINE FALLE!')]), x, y + 2.9, z, { color: '#ffd34d', scale: 0.95 });
    if (V.poss && V.poss.id === u.id) shake(0.3);
  }
}
function specFx(u, dt, x, y, z) {
  trapLegFx(u, x, y, z);
  // burning: flames and soot from the whole body
  if (u.burning && !u.fogHid) {
    const fc = u.fireM || (u.fireM = fireCrown(u));
    fc.visible = true;
    fc.children.forEach((f, i) => {
      const b = f.userData.b,
        fl = Math.sin(clock * 15 + i * 1.9) * 0.5 + Math.sin(clock * 23 + i) * 0.25;
      f.scale.set(b * (0.9 + 0.15 * fl), b * (1 + 0.45 * fl), b * (0.9 + 0.15 * fl));
      f.rotation.y = clock * 3 + i;
    });
    // the whole body in flames, the head too (a burning warrior must be seen from afar), soot rising behind him
    const rate = (u.isPoss ? 46 : 38) * Math.max(0.5, QS.fx);
    u.flameAcc = (u.flameAcc || 0) + dt * rate;
    for (; u.flameAcc >= 1; u.flameAcc--) {
      const hd = Math.random() < 0.3;
      puff(
        x + (Math.random() - 0.5) * (hd ? 0.9 : 0.75),
        y + (hd ? 2.2 + Math.random() * 0.6 : 0.4 + Math.random() * 1.6),
        z + (Math.random() - 0.5) * (hd ? 0.9 : 0.75),
        Math.random() < 0.35 ? 0xffd34d : Math.random() < 0.5 ? 0xff7a22 : 0xff5a1a,
        1,
        (hd ? 0.75 : 0.65) + Math.random() * 0.35,
        'flame'
      );
    }
    if (Math.random() < dt * 7) puff(x, y + 2.4, z, 0x3a3634, 1, 0.6, 'soot');
    if (Math.random() < dt * 1.3) SFX.play('burn', { x, z, vol: 0.45 });
    // he screams (now and then, not all at once when a blast lit a crowd)
    u.screamT = (u.screamT ?? 0.25) - dt;
    if (u.screamT <= 0) {
      u.screamT = 1.1 + Math.random() * 0.9;
      SFX.play('burnScream', { x, z, hi: u.k === 1 || u.k === 3, vol: u.isPoss ? 0.9 : 0.75 });
    }
    if (!u.burnSaid) {
      u.burnSaid = 1;
      // one shout at a time (a blast sets a whole crowd on fire: a pile of words would hide the fun)
      if (u.isPoss || now() - (BOOM.shoutT || 0) > 900) {
        BOOM.shoutT = now();
        word(pick([TR('HEISS!'), TR('FEUER!'), TR('AUA, HEISS!'), TR('WASSER!')]), x, y + 3, z, { color: '#ffb35c', scale: 1.05 });
      }
    }
  } else if (u.burnSaid) {
    if (u.fireM) u.fireM.visible = false;
    u.burnSaid = 0;
    u.screamT = undefined;
    const wet = !u.fogHid && wetNear(x, z, FASS.dip + 0.3);
    if (wet) {
      // into the water: splash, steam, out
      emitFX('water', wet.x, groundY(wet.x, wet.z) + 0.3, wet.z, { n: 12, size: 0.9 });
      puff(x, y + 1.3, z, 0xeeeeee, 6, 0.8);
      SFX.play('splash', { x, z, vol: 0.9 });
      if (now() - (BOOM.zischT || 0) > 700) {
        BOOM.zischT = now();
        word(TR('ZISCH!'), x, y + 2.8, z, { color: '#b6eaff', scale: 1.1 });
      }
    } else puff(x, y + 1.2, z, 0xdddddd, 4, 0.6); // out: a little steam
  }
  // the Feuerfass's keg helmet: its wick smoulders – a thin wisp of smoke, now and then a spark (only close to the camera)
  if (u.hatTip && !u.fogHid && !u.dead && Math.abs(x - camera.position.x) + Math.abs(z - camera.position.z) < 60) {
    u.wickAcc = (u.wickAcc || 0) + dt * 6 * Math.max(0.4, QS.fx);
    if (u.wickAcc >= 1) {
      u.wickAcc = 0;
      u.hatTip.getWorldPosition(BOOM_V);
      puff(BOOM_V.x, BOOM_V.y + 0.05, BOOM_V.z, 0x6a625c, 1, 0.24, 'soot');
      if (Math.random() < 0.3) puff(BOOM_V.x, BOOM_V.y, BOOM_V.z, Math.random() < 0.5 ? 0xffb347 : 0xffe07a, 1, 0.12, 'spark');
    }
  }
  // a lit fuse: sparks, the barrel throbs, a red ring shows how far the blast reaches
  if (u.fuseOn && u.fuseTip) {
    if (!u.fuseT) {
      u.fuseT = now();
      SFX.play('fuse', { x, z, vol: 1 });
      word(TR('TSSSSS!'), x, y + 3.2, z, { color: '#ffd34d', scale: 1.1, prio: true });
    }
    const k = Math.min(1, (now() - u.fuseT) / (FASS.fuse * 1000));
    u.fuseTip.getWorldPosition(BOOM_V);
    if (!u.fogHid) {
      if (Math.random() < dt * 60 * Math.max(0.4, QS.fx))
        puff(BOOM_V.x, BOOM_V.y, BOOM_V.z, Math.random() < 0.5 ? 0xffffff : 0xffd34d, 1, 0.22, 'spark');
      if (Math.random() < dt * 10) puff(BOOM_V.x, BOOM_V.y + 0.1, BOOM_V.z, 0x5a5652, 1, 0.3, 'soot');
    }
    if (u.barrel) u.barrel.scale.setScalar(1 + Math.max(0, Math.sin(clock * (12 + 30 * k))) * (0.05 + 0.08 * k));
    if (!u.fuseRing) {
      const m = new THREE.MeshBasicMaterial({ color: lin(0xff3b2f), transparent: true, opacity: 0.6, depthWrite: false });
      u.fuseRing = new THREE.Mesh(ringGeo, m);
      u.fuseRing.scale.setScalar(FASS.r);
      scene.add(u.fuseRing);
    }
    u.fuseRing.visible = !u.fogHid;
    u.fuseRing.position.set(x, groundY(x, z) + 0.13, z);
    u.fuseRing.material.opacity = 0.35 + 0.4 * Math.max(0, Math.sin(clock * (8 + 26 * k)));
  } else if (u.fuseT) {
    u.fuseT = 0;
    if (u.barrel) u.barrel.scale.setScalar(1);
  }
  if (!u.fuseOn && u.fuseRing) fuseRingDrop(u);
  // a catapult with a Feuerfass in its cup
  if (u.arm) {
    if (u.fassLoaded && !u.ammo) {
      u.ammo = projGeo.fass.clone();
      u.ammo.position.set(0, 0.42, -1.95);
      u.ammo.scale.setScalar(1.05);
      u.arm.add(u.ammo);
    }
    if (u.ammo) u.ammo.visible = !!u.fassLoaded;
  }
}
function fuseRingDrop(u) {
  scene.remove(u.fuseRing);
  u.fuseRing.material.dispose();
  u.fuseRing = null;
}
// charred: the body turns black with white eyes (for the blown-up deaths in 73-deaths.js); its parts leave the unit batching
function charBody(u) {
  const M = boomMats();
  ubRelease(u);
  u.g.traverse(m => {
    if (!m.isMesh || m === u.blob || m === u.ring || m.userData.isInk) return;
    m.material = m === u.head ? M.charFace : M.charM;
  });
}
// a warrior gone without dying (the Feuerfass climbed into a catapult): he hops in and is gone
function goneQuiet(u, id) {
  if (u.trapChain) scene.remove(u.trapChain);
  V.units.delete(id);
  V.selected.delete(id);
  const p = u.g.position;
  puff(p.x, p.y + 1, p.z, 0xf6f1e7, 5, 0.7);
  disposeUnit(u);
}
/* ---------- the Feuerfass in the air ---------- */
// the template: the barrel with its man inside – his keg helmet with the smouldering wick and the brass goggles peek out of the top
// (the same look as the warrior, 25-worm-model.js), a sooty beard, two hands grip the rim
projGeo.fass = (() => {
  const g = new THREE.Group(),
    skin = lam(0xe9b38c);
  mesh(fassBarrelGeo(), lam(0x9a5f2c), 0, 0, 0, g);
  [-0.2, 0.2].forEach(y => mesh(new THREE.TorusGeometry(0.262, 0.022, 5, 18).rotateX(Math.PI / 2), lam(0x4a4f57), 0, y, 0, g));
  mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.13, 18, 1, true), lam(0xc0392b), 0, 0, 0, g);
  mesh(FLAME_GEO, lam(0xffd34d), 0, -0.05, 0.288, g);
  const hd = new THREE.Group();
  hd.position.set(0, 0.31, 0);
  hd.scale.setScalar(0.42);
  g.add(hd);
  mesh(new THREE.SphereGeometry(0.58, 14, 10), skin, 0, -0.12, 0, hd);
  mesh(new THREE.SphereGeometry(0.34, 10, 8), lam(0x2b2420), 0, -0.42, 0.3, hd).scale.set(1.3, 0.75, 0.6); // the sooty beard
  // the keg helmet: staves, hoops, the red band with its flame, the lid with the wick and its ember
  const keg = new THREE.Group();
  keg.position.set(0.02, 0.48, -0.03);
  keg.rotation.set(-0.06, 0, 0.13);
  hd.add(keg);
  mesh(fassBarrelGeo(), lam(0x9a5f2c), 0, 0, 0, keg).scale.set(1.95, 1.05, 1.95);
  [-0.21, 0.21].forEach(y => mesh(new THREE.TorusGeometry(0.513, 0.032, 5, 20).rotateX(Math.PI / 2), lam(0x4a4f57), 0, y, 0, keg));
  mesh(new THREE.CylinderGeometry(0.556, 0.556, 0.12, 20, 1, true), lam(0xc0392b), 0, 0.02, 0, keg);
  mesh(FLAME_GEO, lam(0xffd34d), 0, -0.02, 0.56, keg).scale.setScalar(1.7);
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), lam(0x7a4a22), 0, 0.31, 0, keg);
  mesh(
    taperTube(curvePts([0.12, 0.35, 0.06], [0.2, 0.5, 0.1], [0.1, 0.6, 0.18], 7), [0.03, 0.028, 0.027, 0.026, 0.025, 0.024, 0.022], 6),
    lam(0xd8c08a),
    0,
    0,
    0,
    keg
  );
  mesh(new THREE.SphereGeometry(0.05, 8, 6), TORCH_MAT.inn, 0.1, 0.61, 0.19, keg);
  mesh(new THREE.TorusGeometry(0.6, 0.035, 4, 20).rotateX(Math.PI / 2), lam(0x6b4423), 0, 0.18, -0.02, hd); // goggle strap
  [-1, 1].forEach(s => {
    const gg = mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 14), lam(0xc99a3a), s * 0.2, 0.18, 0.55, hd);
    gg.rotation.set(-0.35, s * 0.32, 0);
    mesh(new THREE.CircleGeometry(0.11, 12), lam(0x2a5a46), s * 0.2, 0.18, 0.56, hd).rotation.set(-0.35, s * 0.32, 0);
    mesh(new THREE.SphereGeometry(0.06, 8, 6), skin, s * 0.29, 0.31, 0.06, g); // fingers on the rim
  });
  g.traverse(o => o.geometry && (o.geometry.userData.shared = true)); // clones (catapult cups, shots) share these
  return g;
})();
ringGeo.userData.shared = true;
discGeo.userData.shared = true;
// a Feuerfass leaves the catapult: the steered player's camera rides along
function fassShot(u, pr) {
  if (!pr) return;
  pr.fass = { spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3), yell: 0 };
  SFX.play('fassFly', { x: pr.from.x, z: pr.from.z, vol: 1 });
  if (V.poss && V.poss.id === u.id) {
    V.poss.fassCam = { p: pr, t: 0, end: undefined };
    egoHint(TR('Abflug!'), 1400);
  }
}
function fassFly(p, dt, k) {
  const m = p.m,
    F = p.fass || (p.fass = { spin: 6, yell: 0 });
  m.rotation.x += dt * F.spin;
  m.rotation.z += dt * F.spin * 0.4;
  if (!F.yell && k > 0.08) {
    F.yell = 1;
    word(pick([TR('HUIIII!'), TR('JIPPIEEE!'), TR('WALHALLAAA!')]), m.position.x, m.position.y + 1.5, m.position.z, {
      color: '#ffffff',
      scale: 1,
    });
  }
  if (Math.random() < dt * 40 * Math.max(0.5, QS.fx)) puff(m.position.x, m.position.y, m.position.z, 0x5a5652, 1, 0.55, 'soot');
  if (Math.random() < dt * 50 * Math.max(0.5, QS.fx)) puff(m.position.x, m.position.y + 0.3, m.position.z, 0xffd34d, 1, 0.25, 'spark');
}
// the camera follows the steered player's barrel to the bang, holds on it a moment, then back to the commander view
function fassCamTick(P, dt) {
  const F = P.fassCam,
    p = F.p;
  F.t += dt;
  const done = p.t >= p.dur || !fx.projs.includes(p);
  if (done && F.end === undefined) F.end = F.t;
  const tgt = done ? p.to : p.m.position,
    dx = p.to.x - p.from.x,
    dz = p.to.z - p.from.z,
    dl = Math.hypot(dx, dz) || 1,
    back = done ? 11 : 7,
    want = BOOM_V.set(tgt.x - (dx / dl) * back, tgt.y + (done ? 6 : 3.2), tgt.z - (dz / dl) * back);
  camera.position.lerp(want, 1 - Math.exp(-dt * (done ? 3 : 7)));
  camera.lookAt(tgt.x, tgt.y + (done ? 0.5 : 0), tgt.z);
  if (F.end !== undefined && F.t - F.end > 1.6) {
    P.fassCam = null;
    exitEgo(true);
    toast(TR('Volltreffer? Zurück zum Feldherrn.'), 1600);
  }
  return true;
}
/* ---------- "Ins Katapult" (the steered Feuerfass next to an own catapult) ---------- */
function fassCatNear(P, r) {
  if (!P || P.k !== 12 || P.fuse || P.trap || P.down || P.dance || P.heroOn) return null;
  let best = null,
    bd = 1e9;
  for (const u of V.units.values()) {
    if (u.team !== V.myTeam || !u.arm || u.isPoss || u.fassLoaded) continue;
    const d = Math.hypot(u.g.position.x - P.x, u.g.position.z - P.z) - KINDS[u.k].r;
    if (d < r && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}
function egoLoadUi(P) {
  const b = $('#egoLoad');
  if (!b) return;
  const heroShown = !$('#egoHero').hidden,
    show = !heroShown && fassCatNear(P, b.hidden ? FASS.load : FASS.load + 0.5) !== null;
  if (b.hidden === show) {
    b.hidden = !show;
    if (show) {
      SFX.play('ready', { vol: 0.6 });
      if (!EG.loadTold) {
        EG.loadTold = true;
        egoHint(
          COARSE
            ? TR('Neben deinem Katapult! Tippe „Ins Katapult“ und flieg selbst als Feuerfass.')
            : TR('Neben deinem Katapult! Drück {0} oder klicke „Ins Katapult“ und flieg selbst als Feuerfass.', kl('hero')),
          3200
        );
      }
    }
  }
}
function egoLoad() {
  const P = V.poss,
    c = fassCatNear(P, FASS.load + 0.6);
  if (!c) return false;
  sendCmd({ t: 'load', id: c.id });
  const pitch = P.pitch;
  $('#egoLoad').hidden = true;
  exitEgo(false, true);
  V.selected.clear();
  V.selected.add(c.id);
  enterEgo();
  if (V.poss) {
    V.poss.pitch = pitch;
    EG.intro = Math.min(EG.intro, 0.5);
    SFX.play('load', { vol: 1 });
    egoHint(TR('Geladen! Ziel wählen und feuern – du fliegst mit!'), 2600);
  }
  return true;
}
$('#egoLoad') &&
  $('#egoLoad').addEventListener('click', e => {
    e.preventDefault();
    egoLoad();
  });

/* ---------- the own Feuerfass went off in the ego: the camera rises behind him and looks down on who flies where, holds, then back ---------- */
const BOOM_CAM = { rise: 0.7, hold: 1.35, back: 0.5, up: 23, out: 11 }; // (high and wide: the whole crater and who flies where)
function boomCamStart(x, z, yaw, look) {
  V.boomCam = { x, z, yaw, t: 0, p0: camera.position.clone(), l0: look, up: new THREE.Vector3(), lk: new THREE.Vector3() };
  camS.x = x; // the map view afterwards looks at the crater
  camS.z = z;
}
function boomCamTick(dt) {
  const B = V.boomCam;
  if (!B) return;
  if (V.poss || V.ending || !V.playing) {
    V.boomCam = null;
    return;
  }
  B.t += dt;
  const gy = groundY(B.x, B.z),
    a = B.yaw + B.t * 0.12, // (a slow turn while it hangs up there)
    T1 = BOOM_CAM.rise,
    T2 = T1 + BOOM_CAM.hold,
    T3 = T2 + BOOM_CAM.back;
  B.up.set(B.x - Math.sin(a) * BOOM_CAM.out, gy + BOOM_CAM.up, B.z - Math.cos(a) * BOOM_CAM.out);
  B.lk.set(B.x, gy + 0.5, B.z);
  if (B.t >= T3) {
    V.boomCam = null;
    return;
  }
  if (B.t < T1) {
    const q = sstep(0, T1, B.t);
    camera.position.lerpVectors(B.p0, B.up, q);
    BOOM_V.lerpVectors(B.l0, B.lk, q);
  } else if (B.t < T2) {
    camera.position.copy(B.up);
    BOOM_V.copy(B.lk);
  } else {
    // back to the map camera (applyCam has just put it where it belongs)
    const q = sstep(T2, T3, B.t),
      cp = camera.position.clone();
    camera.position.lerpVectors(B.up, cp, q);
    BOOM_V.set(camS.x, groundY(camS.x, camS.z), camS.z).lerp(B.lk, 1 - q);
  }
  camera.lookAt(BOOM_V);
  camera.updateMatrixWorld();
}

/* ---------- a blast at a base wall knocks chunks out of it ---------- */
const CHUNK_GEO = new THREE.BoxGeometry(1, 1, 1);
CHUNK_GEO.userData.shared = true;
function baseChunks(x, z, r, s) {
  for (let i = 0; i < 2; i++) {
    const B = BASES[i],
      bv = baseViews[i];
    if (!B || !bv || baseGap(B, x, z) >= r) continue;
    if (FOG.on && i !== V.myTeam && !fogSeen(B.x, B.z) && !fogSeen(x, z)) continue;
    // the wall point next to the blast, and which way is out
    const wx = clamp(x, B.x - 6.6, B.x + 6.6),
      wz = clamp(z, B.z - 3.6, B.z + 3.6),
      gy = groundY(wx, wz);
    let nx = x - wx,
      nz = z - wz,
      nl = Math.hypot(nx, nz);
    if (nl < 0.3) {
      nx = x - B.x;
      nz = z - B.z;
      nl = Math.hypot(nx, nz) || 1;
    }
    nx /= nl;
    nz /= nl;
    if (!bv.chunkCols) {
      // the base's own colours (stone, wood, plaster), taken from its biggest pieces
      const big = [],
        bb = new THREE.Box3(),
        sz = new THREE.Vector3();
      bv.g.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.color || o.userData.isInk) return; // (not the black ink outlines)
        bb.setFromObject(o).getSize(sz);
        if (sz.y > 0.8 && Math.max(sz.x, sz.z) > 1.5) big.push([sz.x * sz.y * sz.z, o.material.color.getHex()]);
      });
      const cols = [...new Set(big.sort((a, b) => b[0] - a[0]).map(e => e[1]))].slice(0, 4);
      bv.chunkCols = cols.length ? cols : [0xb9ad9a, 0x8a6a48];
    }
    const n = Math.round(16 * s);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(CHUNK_GEO, lam(bv.chunkCols[k % bv.chunkCols.length]));
      const sz = 0.45 + Math.random() * 0.7;
      m.scale.set(sz * (0.8 + Math.random() * 0.8), sz * (0.6 + Math.random() * 0.6), sz * (0.8 + Math.random() * 0.6));
      const side = (Math.random() - 0.5) * 3.2;
      m.position.set(wx - nz * side, gy + 0.8 + Math.random() * 3.2, wz + nx * side);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.castShadow = UNIT_SHADOWS;
      scene.add(m);
      const pw = 4 + Math.random() * 7;
      fx.debris.push({
        m,
        vx: nx * pw + (Math.random() - 0.5) * 3,
        vy: 3 + Math.random() * 7,
        vz: nz * pw + (Math.random() - 0.5) * 3,
        rx: (Math.random() - 0.5) * 14,
        rz: (Math.random() - 0.5) * 14,
        t: 0,
        delay: Math.random() * 0.06,
      });
    }
    emitFX('building', wx, gy + 2, wz, { size: 1.2 * s });
    for (let k = 0; k < 6; k++)
      puff(wx - nz * (Math.random() - 0.5) * 4, gy + 1 + Math.random() * 3, wz + nx * (Math.random() - 0.5) * 4, 0xa89c88, 2, 1.4);
    SFX.play('splinter', { x: wx, z: wz, vol: 1.1 });
    SFX.play('collapse', { x: wx, z: wz, vol: 0.5 });
    bv.shake = Math.max(bv.shake || 0, 0.6);
    word(TR('KRACH!'), wx, gy + 5.5, wz, { color: '#ffd34d', scale: 1.3, prio: true });
  }
}
