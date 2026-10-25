/* 75-fass-falle-view.js - THE NEWEST WARRIORS ON SCREEN (every screen; the rules are in 16-sim-fass-falle.js):
   - explosions (s.xe): a white flash, a fireball that rolls up into smoke, a shock ring on the ground, flying barrel staves and hoops,
     embers, a smoke column and a scorch mark that stays a while; the camera shakes by distance, close by the screen flashes;
   - a lit Feuerfass: sparks at the fuse, the barrel throbs, a red ring on the ground shows how far the blast will reach;
   - burning warriors: flames and soot, they flail (80-animation.js), a steered one sees the screen glow;
   - bear traps (s.tr): own ones grey and clear with a ring in the team colour, enemy ones barely visible (and hidden in the fog);
     they open when laid and snap shut;
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
            'Feuerfass: Er zündet von selbst mitten im Gegnerhaufen. Selbst gesteuert: Spezial = Lunte. Neben deinem Katapult: „Ins Katapult“!'
          )
        : TR(
            'Achtung, Feuerfass! Der rote Ring zeigt, wie weit es knallt. Abstand halten oder aus der Ferne erledigen – dann platzt das Fass kleiner.'
          )
      : own
        ? TR('Fallenleger: Er legt seine Bärenfalle von selbst, wenn Gegner kommen. Selbst gesteuert: Spezial = Falle legen.')
        : TR('Achtung, Fallenleger! Seine Bärenfallen sind kaum zu sehen. Wer hineintritt, sitzt ein paar Sekunden fest.');
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
      if (e[5] === V.myTeam && e[6] >= 5) profEvent('boom', e[6]);
    } else if (kind === XE.dive) diveFx(x, z, e[5]);
    else if (kind === XE.snap) {
      snapFx(x, z, e[5]);
      if (e[5] === V.myTeam) profEvent('trap', e[6] || 0, (V.trapN = (V.trapN || 0) + 1));
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
      const g = trapModel(true, own ? M.own : M.foe),
        x = e[2] / 10,
        z = e[3] / 10;
      g.position.set(x, groundY(x, z) + 0.03, z);
      g.rotation.y = (id * 2.4) % TAU;
      g.scale.setScalar(1.45);
      scene.add(g);
      if (own) {
        const rm = new THREE.MeshBasicMaterial({
          color: lin(V.facs[V.myTeam] === 'viking' ? 0x5aa8ff : 0xff7ab8),
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, rm);
        ring.scale.setScalar(0.62);
        ring.position.y = 0.02;
        g.add(ring);
      }
      v = { g, jaws: g.userData.jaws, own, st: -1, open: 0, t: 0, foeVis: false, x, z };
      BOOM.traps.set(id, v);
      if (own || !FOG.on || fogSeen(x, z)) {
        const L = listenerPos();
        if (own || Math.hypot(x - L.x, z - L.z) < 18) SFX.play('trapSet', { x, z, vol: own ? 0.9 : 0.5 });
      }
    }
    v.t += dt;
    const st = e[4];
    if (st !== v.st) {
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
    v.open = want > v.open ? Math.min(1, v.open + dt * 2.6) : Math.max(0, v.open - dt * 22);
    v.jaws[0].rotation.x = -(Math.PI / 2) * (1 - v.open);
    v.jaws[1].rotation.x = (Math.PI / 2) * (1 - v.open);
    if (st === 3) v.g.scale.setScalar(Math.max(0.01, v.g.scale.x - dt * 1.1));
    v.g.visible = v.own || v.foeVis || !FOG.on || fogSeen(v.x, v.z);
    if (v.own && st === 1) {
      const ring = v.g.children[v.g.children.length - 1];
      if (ring && ring.material) ring.material.opacity = 0.35 + 0.2 * Math.sin(clock * 3 + id);
    }
  }
  for (const [id, v] of BOOM.traps)
    if (!seen.has(id)) {
      trapViewDrop(v);
      BOOM.traps.delete(id);
    }
}
/* ---------- per warrior, every frame (from updateStatusFx in 42-view-world-fx.js) ---------- */
const BOOM_V = new THREE.Vector3();
function specFx(u, dt, x, y, z) {
  // burning: flames and soot from the whole body
  if (u.burning && !u.fogHid) {
    const rate = (u.isPoss ? 44 : 28) * Math.max(0.5, QS.fx);
    u.flameAcc = (u.flameAcc || 0) + dt * rate;
    for (; u.flameAcc >= 1; u.flameAcc--)
      puff(
        x + (Math.random() - 0.5) * 0.7,
        y + 0.4 + Math.random() * 1.5,
        z + (Math.random() - 0.5) * 0.7,
        Math.random() < 0.35 ? 0xffd34d : Math.random() < 0.5 ? 0xff7a22 : 0xff5a1a,
        1,
        0.6 + Math.random() * 0.3,
        'flame'
      );
    if (Math.random() < dt * 4) puff(x, y + 1.8, z, 0x3a3634, 1, 0.5, 'soot');
    if (Math.random() < dt * 1.3) SFX.play('burn', { x, z, vol: 0.45 });
    if (!u.burnSaid) {
      u.burnSaid = 1;
      // one shout at a time (a blast sets a whole crowd on fire: a pile of words would hide the fun)
      if (u.isPoss || now() - (BOOM.shoutT || 0) > 900) {
        BOOM.shoutT = now();
        word(pick([TR('HEISS!'), TR('FEUER!'), TR('AUA, HEISS!')]), x, y + 3, z, { color: '#ffb35c', scale: 1 });
      }
    }
  } else if (u.burnSaid) {
    u.burnSaid = 0;
    puff(x, y + 1.2, z, 0xdddddd, 4, 0.6); // out: a little steam
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
  V.units.delete(id);
  V.selected.delete(id);
  const p = u.g.position;
  puff(p.x, p.y + 1, p.z, 0xf6f1e7, 5, 0.7);
  disposeUnit(u);
}
/* ---------- the Feuerfass in the air ---------- */
// the template: the barrel with its man inside – the horned cap and goggles peek out of the top, two hands grip the rim
projGeo.fass = (() => {
  const g = new THREE.Group(),
    steel = lam(0x9aa3ad),
    steelD = lam(0x6f7882),
    bone = lam(0xf3ead2),
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
  mesh(new THREE.SphereGeometry(0.61, 14, 7, 0, TAU, 0, Math.PI * 0.43), steel, 0, 0.06, 0, hd);
  mesh(new THREE.TorusGeometry(0.6, 0.055, 5, 18).rotateX(Math.PI / 2), steelD, 0, 0.21, 0, hd);
  mesh(
    taperTube(curvePts([-0.42, 0.33, 0], [-0.98, 0.45, 0.06], [-0.9, 1.0, 0.18], 7), [0.13, 0.115, 0.095, 0.075, 0.05, 0.026, 0.004], 7),
    bone,
    0,
    0,
    0,
    hd
  );
  [-1, 1].forEach(s => {
    mesh(new THREE.TorusGeometry(0.13, 0.045, 5, 12), lam(0xc99a3a), s * 0.2, 0.0, 0.5, hd);
    mesh(new THREE.CircleGeometry(0.11, 10), lam(0xbfe6ff), s * 0.2, 0.0, 0.51, hd);
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
