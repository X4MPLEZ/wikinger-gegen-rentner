/* ---------- "Den Helden spielen" on screen: the hero follows the worm's real body (its rings, then its head), the worm takes its hero pose,
   the ego camera films it from the side. Everyone sees the same thing: it all runs off the snapshot's hero list (unit, worm, time). */
const HV3 = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), seen: new Set() };
const HERO_KNEEL = new THREE.Vector3(0, 1.12, 0),
  HERO_MAW = new THREE.Vector3(0, 0, 0.65);
function heroTargetView(P, r = HERO.rC + 0.4) {
  // the sandworm the ego could play the hero on right now (the host decides for real, up to HERO.r): a surfaced wild worm from the
  // snapshot's bear list, or an enemy worm unit on the surface / reared up. Returns its id or null.
  if (!P || !HERO.kinds.includes(P.k) || P.down || P.dance || P.held || P.air || P.pj || P.heroOn || (V.latest && V.latest.pz > 0))
    return null;
  const s = V.latest;
  if (!s) return null;
  let best = null,
    bd = r * r;
  const near = (id, x, z) => {
    const d2 = (x - P.x) ** 2 + (z - P.z) ** 2;
    if (d2 < bd) {
      bd = d2;
      best = id;
    }
  };
  for (const b of s.br || []) {
    if (!b[10] || b[7] || !(b[5] > 0)) continue;
    const ws = b[11];
    if (ws === 6 || (ws === 4 && b[12] / 100 < WORM.up - 0.5)) near(b[6], b[0] / 10, b[1] / 10);
  }
  const wu = wormMaps(s).wu;
  for (const e of s.u) {
    if (!KINDS[e[1]] || !KINDS[e[1]].worm || teamOfKind(e[1], s.fa) === V.myTeam) continue;
    const w = wu.get(e[0]);
    if (w && (w[1] === 0 || w[1] === 4)) near(e[0], e[2] / 10, e[3] / 10);
  }
  return best;
}
function egoHero() {
  const P = V.poss;
  if (!P || P.heroOn || P.heroReq || !HERO.kinds.includes(P.k)) return;
  if (heroTargetView(P) === null) {
    egoHint('Erst nah an einen Sandwurm ran, der aus dem Sand ragt!', 1500);
    SFX.play('error');
    return;
  }
  P.h = ((P.h || 0) + 1) % 1000;
  P.heroReq = now();
  $('#egoHero').hidden = true;
}
function heroFlank(v, ai, out, s = 1) {
  // a point beside the worm's flank (s = 1 right, -1 left) at ring ai (0 = the ring under the head): where the climbing hero's feet are
  const i0 = clamp(Math.floor(ai), 0, WORM_N - 2),
    f = clamp(ai - i0, 0, 1),
    A = HV3.a,
    B = HV3.b;
  v.segs[i0].getWorldPosition(A);
  v.segs[i0 + 1].getWorldPosition(B);
  A.lerp(B, f);
  const wy = v.g.rotation.y,
    r = (lerp(v.segs[i0].scale.x, v.segs[i0 + 1].scale.x, f) * (v.g.scale.x || 1) + 0.3) * s;
  return out.set(A.x + Math.cos(wy) * r, A.y - 1.0, A.z - Math.sin(wy) * r);
}
function heroCamSide(v) {
  // which side of the worm films best (the hero climbs that flank): the one with fewer palms, cacti and rocks in the way
  const wy = v.g.rotation.y,
    W = v.g.position,
    fx = Math.sin(wy),
    fz = Math.cos(wy),
    rx = Math.cos(wy),
    rz = -Math.sin(wy),
    obs = [...((MAP && MAP.trees) || []), ...((MAP && MAP.decor) || []), ...((MAP && MAP.cacti) || [])];
  const score = s => {
    let p = 0;
    for (const phi of [0.3, 0.55, 0.75])
      for (const D of [10.5, 12.5]) {
        const cx = W.x + (fx * Math.cos(phi) + rx * Math.sin(phi) * s) * D,
          cz = W.z + (fz * Math.cos(phi) + rz * Math.sin(phi) * s) * D;
        for (const o of obs) {
          const r = (o.s || 1) * 1.2;
          if (Math.hypot(o.x - cx, o.z - cz) < r + 2.5) p += 3;
          else if (segDist(o.x, o.z, { x: cx, z: cz }, { x: W.x, z: W.z }) < r + 0.6) p += 1;
        }
      }
    if (Math.abs(W.x + (fx * Math.cos(0.6) + rx * Math.sin(0.6) * s) * 11.5) > HALF_W - 2) p += 6;
    return p;
  }; // off the island edge: no
  return score(-1) < score(1) ? -1 : 1;
}
function heroBegin(u, v, P) {
  u.heroOn = true;
  u.heroT = 0;
  u.heroFrom = u.g.position.clone();
  u.heroYaw0 = u.g.rotation.y;
  u.heroP0 = null;
  u.heroSide = P ? heroCamSide(v) : 1;
  const p = u.g.position;
  if (fogSeen(p.x, p.z) || P)
    word(KINDS[u.k].fac === 'viking' ? 'FÜR WALHALLA!' : 'FÜR DIE RENTE!', p.x, p.y + 3.2, p.z, { color: '#ffd34d', scale: 1.3 });
  SFX.play('rage', { x: p.x, z: p.z, vol: 1 });
  if (P) {
    egoHint('Rauf auf den Wurm!', 1300);
    EG.kick = Math.max(EG.kick, 0.4);
  }
}
function heroRelease(u) {
  // the worm was beaten while he was on it (or in it): back to a normal warrior, who is flying off it right now
  u.heroOn = false;
  u.heroW = null;
  u.heroP0 = null;
  u.g.visible = true;
  u.g.rotation.x = 0;
  u.g.rotation.z = 0;
  u.rig.rotation.set(0, 0, 0);
  u.rig.position.set(0, 0, 0);
  u.torso.rotation.set(0, 0, 0);
  if (u.legL) {
    u.legL.rotation.z = 0;
    u.legR.rotation.z = 0;
  }
  if (u.weapon && u.k === 0) u.weapon.rotation.set(0, 0, 0);
  u.neck.rotation.set(0, 0, 0);
  u.g.scale.setScalar(tpk(u.team, 'giant') ? 1.35 : 1);
}
function heroPose(u, v, t) {
  const H = HERO,
    wy = v.g.rotation.y,
    gp = u.g.position,
    P = HV3.c,
    ang = (a, b, e) => a + angDiff(b, a) * e;
  v.g.updateMatrixWorld(true);
  const sd0 = u.heroSide || 1,
    climbYaw = Math.atan2(-Math.cos(wy) * sd0, Math.sin(wy) * sd0); // facing the worm's flank
  let yaw = climbYaw,
    rigLean = 0.2,
    lean = 0,
    flip = 0,
    hip = 0,
    sc = 1,
    look = 0,
    wpn = null;
  let aL = -2.3,
    aR = -2.3,
    eL = -0.5,
    eR = -0.5,
    tL = -0.6,
    tR = -0.6,
    kL = 0.9,
    kR = 0.9,
    zL = 0,
    zR = 0;
  if (t < H.leap) {
    // the jump onto its flank
    const e = sstep(0, H.leap, t),
      F = u.heroFrom;
    heroFlank(v, 3.4, P, sd0);
    gp.set(lerp(F.x, P.x, e), lerp(F.y, P.y, e) + 2.4 * 4 * e * (1 - e), lerp(F.z, P.z, e));
    yaw = ang(u.heroYaw0, climbYaw, sstep(0, 0.7, e));
    rigLean = 0.3;
    aL = aR = -2.6;
    tL = -1.0;
    tR = -0.2;
    kL = 1.4;
    kR = 0.5;
  } else if (t < H.climb) {
    // hand over hand up the flank, five pulls
    const N = 5,
      q = ((t - H.leap) / (H.climb - H.leap)) * N,
      n = Math.min(N - 1, Math.floor(q)),
      f = q - n,
      pull = sstep(0.15, 0.85, f),
      sd = n % 2 ? 1 : -1,
      reach = Math.sin(f * Math.PI);
    heroFlank(v, lerp(3.4, 0.55, (n + pull) / N), P, sd0);
    gp.copy(P);
    aL = sd > 0 ? -2.9 + 0.3 * pull : -2.2 - 0.5 * reach;
    aR = sd > 0 ? -2.2 - 0.5 * reach : -2.9 + 0.3 * pull;
    eL = -0.3 - 0.5 * (sd > 0 ? pull : 1 - pull);
    eR = -0.3 - 0.5 * (sd > 0 ? 1 - pull : pull);
    tL = sd > 0 ? -1.2 + 0.7 * pull : -0.5;
    tR = sd > 0 ? -0.5 : -1.2 + 0.7 * pull;
    kL = sd > 0 ? 1.5 - 0.6 * pull : 0.8;
    kR = sd > 0 ? 0.8 : 1.5 - 0.6 * pull;
    rigLean = 0.18 + 0.06 * Math.sin(f * TAU);
    look = -0.35;
  } else if (t < H.top) {
    // a swing over the side of its head onto the top
    const e = sstep(H.climb, H.top, t);
    heroFlank(v, 0.55, P, sd0);
    const Q = v.neck.localToWorld(HV3.d.copy(HERO_KNEEL));
    const mx = (P.x + Q.x) / 2 + Math.cos(wy) * 0.9 * sd0,
      my = Math.max(P.y, Q.y) + 1.0,
      mz = (P.z + Q.z) / 2 - Math.sin(wy) * 0.9 * sd0,
      a = (1 - e) * (1 - e),
      b = 2 * e * (1 - e),
      c = e * e;
    gp.set(a * P.x + b * mx + c * Q.x, a * P.y + b * my + c * Q.y, a * P.z + b * mz + c * Q.z);
    yaw = ang(climbYaw, wy, e);
    rigLean = 0.45 * (1 - e);
    lean = 0.3 * e;
    aL = aR = lerp(-2.7, -1.3, e);
    tL = lerp(-1.4, -0.1, e);
    kL = lerp(1.6, 1.65, e);
    tR = lerp(-1.0, -1.35, e);
    kR = lerp(1.2, 1.35, e);
    hip = -0.45 * e;
  } else if (t < H.toss) {
    // kneeling on its head, stabbing down into the maw
    gp.copy(v.neck.localToWorld(HV3.d.copy(HERO_KNEEL)));
    yaw = wy;
    rigLean = 0;
    let st = 0;
    for (const ts of H.stabs)
      if (t >= ts - 0.4 && t < ts + 0.42) {
        st = t < ts - 0.06 ? -sstep(ts - 0.4, ts - 0.06, t) : t < ts + 0.12 ? 1 : 1 - sstep(ts + 0.12, ts + 0.42, t);
        break;
      }
    const up = Math.max(0, -st),
      dn = Math.max(0, st);
    aR = -1.5 - 1.5 * up + 0.8 * dn;
    eR = -0.35 + 0.3 * dn;
    aL = -1.25 + 0.2 * dn;
    eL = -0.5;
    lean = 0.45 + 0.5 * dn - 0.15 * up;
    tL = -0.1;
    kL = 1.65;
    tR = -1.35;
    kR = 1.35;
    zL = 0.12;
    zR = -0.12;
    hip = -0.45;
    wpn = u.k === 2 ? 1.35 : 0.9 * dn;
    look = 0.35 + 0.2 * dn; // the cane stabs along the arm, the axe chops
  } else if (t < H.gulp) {
    // flung up, tumbling, down into the open maw
    const e = clamp((t - H.toss) / (H.gulp - H.toss), 0, 1),
      F = v.neck.localToWorld(HV3.b.copy(HERO_KNEEL)),
      Q = v.neck.localToWorld(HV3.d.copy(HERO_MAW));
    gp.set(lerp(F.x, Q.x, e), lerp(F.y, Q.y, e) + 3.2 * 4 * e * (1 - e), lerp(F.z, Q.z, e));
    yaw = wy;
    rigLean = 0;
    flip = -e * TAU * 1.15;
    const fl = clock * 26;
    aL = -2.8 + Math.sin(fl) * 0.4;
    aR = -2.7 + Math.cos(fl) * 0.4;
    eL = eR = -0.4;
    tL = Math.sin(fl * 1.3) * 0.8;
    tR = -tL;
    kL = kR = 0.7;
    sc = 1 - 0.45 * sstep(0.8, 1, e);
  } else {
    u.g.visible = false;
    u.hp.visible = false;
    u.ring.visible = false;
    if (u.faceSp) u.faceSp.visible = false;
    if (u.cdSp) u.cdSp.visible = false;
    return;
  } // swallowed
  const c = 1.1,
    th = rigLean + flip; // the flip turns round his middle, not his feet
  u.g.rotation.set(0, yaw, 0);
  u.rig.rotation.set(th, 0, 0);
  u.rig.position.set(0, hip + (flip ? c - c * Math.cos(th) : 0), flip ? -c * Math.sin(th) : 0);
  u.torso.rotation.set(lean, 0, 0);
  u.neck.rotation.set(look, 0, 0);
  u.armL.rotation.set(aL, 0, -0.15);
  u.armR.rotation.set(aR, 0, 0.15);
  if (u.foreL) {
    u.foreL.rotation.set(eL, 0, 0);
    u.foreR.rotation.set(eR, 0, 0);
  }
  if (u.legL) {
    u.legL.rotation.set(tL, 0, zL);
    u.legR.rotation.set(tR, 0, zR);
    u.shinL.rotation.x = kL;
    u.shinR.rotation.x = kR;
  }
  if (u.weapon) {
    u.weapon.rotation.set(wpn ?? (u.k === 2 ? 0.3 : 0), 0, 0);
    if (u.k === 2) u.weapon.position.set(0, -0.245, 0.05);
  }
  u.g.scale.setScalar((tpk(u.team, 'giant') ? 1.35 : 1) * sc);
  u.hp.visible = false;
  u.ring.visible = false;
  if (u.faceSp) u.faceSp.visible = false;
  if (u.cdSp) u.cdSp.visible = false;
}
function heroFx(u, v, t, P) {
  // sounds, splashes and shouts at the beats of the sequence
  const t0 = u.heroT ?? 0,
    H = HERO,
    cross = x => t0 < x && t >= x,
    W = v.wP,
    gp = u.g.position,
    vik = KINDS[u.k].fac === 'viking';
  const near = Math.hypot(gp.x - camera.position.x, gp.z - camera.position.z) < 70,
    seen = !!P || fogSeen(gp.x, gp.z);
  if (cross(H.leap) && near) {
    sandBurst(gp.x, gp.z, 10, { r: 0.6, out: 1.6, up: 1.6, size: 0.1 });
    SFX.play('grunt', { x: gp.x, z: gp.z, k: u.k });
  }
  for (let i = 0; i < 5; i++)
    if (cross(H.leap + ((i + 0.5) * (H.climb - H.leap)) / 5) && near) {
      SFX.play('grunt', { x: gp.x, z: gp.z, k: u.k, vol: 0.6 });
      puff(gp.x, gp.y + 1.2, gp.z, 0xdcb878, 2, 0.4);
    }
  if (cross(H.climb) && near) SFX.play('heave', { x: gp.x, z: gp.z, k: u.k });
  if (cross(H.top) && P) egoHint('Zustechen!', 1100);
  H.stabs.forEach((ts, i) => {
    if (!cross(ts)) return;
    const m = v.neck.localToWorld(HV3.d.copy(HERO_MAW));
    if (near) {
      SFX.play(HIT_SFX[u.k] || 'axe', { x: m.x, z: m.z, vol: 1.1 });
      SFX.play('wormGrowl', { x: m.x, z: m.z, vol: 1 });
      emitFX('hit', m.x, m.y, m.z, { n: 10, size: 0.8, col: 0xc8e06a });
      for (let k = 0; k < 6; k++)
        puff(
          m.x + (Math.random() - 0.5) * 0.8,
          m.y + Math.random() * 0.6,
          m.z + (Math.random() - 0.5) * 0.8,
          k % 2 ? 0xc8e06a : 0xf0f0c0,
          1,
          0.45
        );
    }
    if (seen) word(['ZACK!', 'STICH!', 'NOCH EINER!'][i] || 'STICH!', m.x, m.y + 2.4, m.z, { color: '#ffe08a', scale: 1.15 });
    if (P) {
      EG.kick = Math.max(EG.kick, 0.45);
      shake(0.18);
    }
  });
  if (cross(H.toss)) {
    if (near) {
      SFX.play('whoosh', { x: gp.x, z: gp.z, vol: 1 });
      SFX.play('wormRoar', { x: gp.x, z: gp.z, vol: 1 });
    }
    if (seen) word(vik ? 'FÜR WALHALLA!' : 'FÜR DIE RENTE!', gp.x, gp.y + 3, gp.z, { color: '#ffd34d', scale: 1.25 });
  }
  if (cross(H.gulp)) {
    if (W) {
      W.gulp = 0;
      W.gulpV = 2.4;
      W.gulpK = 0.6;
    }
    if (near) {
      SFX.play('chomp', { x: gp.x, z: gp.z, vol: 1.2 });
      SFX.play('gulp', { x: gp.x, z: gp.z, vol: 1.2 });
    }
    const wp = v.g.position;
    if (seen) word('HAPP!', wp.x, wp.y + 8, wp.z, { color: '#ffd38a', scale: 1.3 });
    if (P) {
      egoHint('Verschluckt! Er sticht von innen weiter …', 1800);
      shake(0.25);
    }
  }
  H.inner.forEach(ts => {
    if (!cross(ts)) return;
    if (W) W.gulpK = 1;
    const i = clamp(Math.round(((W && W.gulp !== undefined ? W.gulp : 1) - 0.7) / WORM_SP), 0, WORM_N - 1),
      m = v.segs[i].getWorldPosition(HV3.d);
    if (near) {
      SFX.play(HIT_SFX[u.k] || 'axe', { x: m.x, z: m.z, vol: 0.55 });
      SFX.play('wormGrowl', { x: m.x, z: m.z, vol: 1.1 });
      for (let k = 0; k < 5; k++)
        puff(m.x + (Math.random() - 0.5) * 2, m.y + Math.random(), m.z + (Math.random() - 0.5) * 2, 0xdcb878, 1, 0.6);
    }
    if (seen) word(pick(['AUA!', 'HICKS!', 'AUTSCH!', 'BAUCHWEH!']), m.x, m.y + 2.5, m.z, { color: '#ffffff', scale: 1.05 });
    if (P) shake(0.15);
  });
}
function heroTick() {
  const s = V.renderSnap || V.latest;
  if (!s) return;
  const age = Math.max(0, (V.renderTime ?? s.t) - s.t),
    seen = HV3.seen;
  seen.clear();
  for (const h of s.he || []) {
    const u = V.units.get(h[0]),
      v = h[4] ? V.units.get(h[1]) : WW.views.get(h[1]); // the worm: an enemy worm unit, or a wild worm
    if (!u || !v || !v.segs || !u.armL) continue;
    seen.add(u.id);
    if (h[4]) {
      v.g.rotation.y = (h[5] || 0) / 100; // a worm unit faces the hero for the whole sequence
      if (V.poss && V.poss.id === v.id && now() - (v.heroVictimT || -1e9) > 8000) {
        v.heroVictimT = now(); // your own worm: tell once per sequence why it does not obey
        egoHint('Ein Held klettert auf deinen Wurm!', 2200);
      }
    }
    const t = h[2] / 100 + age,
      P = V.poss && V.poss.id === u.id ? V.poss : null;
    if (!u.heroOn) heroBegin(u, v, P);
    u.heroW = v;
    heroPose(u, v, t);
    heroFx(u, v, t, P);
    u.heroT = t;
  }
  for (const u of V.units.values()) if (u.heroOn && !seen.has(u.id)) heroRelease(u);
  const P = V.poss;
  if (P) {
    const on = seen.has(P.id);
    if (on !== !!P.heroOn) {
      P.heroOn = on;
      document.body.classList.toggle('heroOn', on);
      EG.hc = null;
      if (on) {
        P.heroReq = 0;
        P.dashT = 0;
        EG.intro = 0;
      } else if (V.units.get(P.id)) {
        EG.camInit = false;
        EG.intro = Math.max(EG.intro, 0.7);
        egoHint('Geschafft – der Sandwurm ist besiegt, und du lebst!', 2200);
      }
    }
  }
}
function heroCam(P, dt) {
  // the ego camera while he plays the hero: from the front-right of the worm, so the climb, the stabs and the gulp are in view
  const u = V.units.get(P.id),
    v = u && u.heroW;
  if (!u || !v) return false;
  const H = HERO,
    t = u.heroT || 0,
    wy = v.g.rotation.y,
    W = v.g.position,
    sd = u.heroSide || 1,
    fx = Math.sin(wy),
    fz = Math.cos(wy),
    rx = Math.cos(wy) * sd,
    rz = -Math.sin(wy) * sd;
  const phi = lerp(0.3, 0.75, sstep(0.2, H.top, t)) - 0.15 * sstep(H.toss, H.gulp, t),
    D = lerp(12.5, 10.5, sstep(0.5, H.top, t)) + 3 * sstep(H.gulp, H.end, t),
    Hc = 3.0 + 0.8 * sstep(1, H.top, t) + 1.8 * sstep(H.toss, H.gulp, t);
  const cx = W.x + (fx * Math.cos(phi) + rx * Math.sin(phi)) * D,
    cz = W.z + (fz * Math.cos(phi) + rz * Math.sin(phi)) * D,
    cy = Math.max(groundY(cx, cz) + 1.2, groundY(W.x, W.z) + Hc);
  let lx, ly, lz;
  if (t < H.gulp && u.g.visible) {
    const n = v.neck.getWorldPosition(HV3.b);
    lx = lerp(u.g.position.x, n.x, 0.3);
    ly = lerp(u.g.position.y + 1.2, n.y, 0.3);
    lz = lerp(u.g.position.z, n.z, 0.3);
  } else {
    const m = v.segs[1].getWorldPosition(HV3.b);
    lx = m.x;
    ly = m.y + 0.5;
    lz = m.z;
  }
  let c = EG.hc;
  if (!c) c = EG.hc = { p: camera.position.clone(), l: new THREE.Vector3(lx, ly, lz) };
  const k = 1 - Math.exp(-dt * 3.5),
    kl = 1 - Math.exp(-dt * 7);
  c.p.x += (cx - c.p.x) * k;
  c.p.y += (cy - c.p.y) * k;
  c.p.z += (cz - c.p.z) * k;
  c.l.x += (lx - c.l.x) * kl;
  c.l.y += (ly - c.l.y) * kl;
  c.l.z += (lz - c.l.z) * kl;
  EG.kick = Math.max(0, EG.kick - dt * 1.6);
  camera.position.copy(c.p);
  camera.position.y += Math.sin(clock * 47) * EG.kick * 0.12;
  camera.lookAt(c.l);
  {
    const want = camera.aspect < 1 ? 78 : 62;
    if (Math.abs(camera.fov - want) > 0.05) {
      camera.fov = lerp(camera.fov, want, Math.min(1, dt * 5));
      camera.updateProjectionMatrix();
    }
  }
  camera.updateMatrixWorld();
  sun.target.position.set(W.x, 0, W.z);
  sun.position.copy(sun.target.position).add(SUN_OFF);
  $('#xhair').hidden = true;
  return true;
}
// tamed worms: their state rides with the unit snapshot at render time
function wormUnitState(u, A, rt) {
  const e = wormMaps(A).wu.get(u.id);
  if (e) wormApplyState(u, WORM_VIS_UNIT[e[1]] || 'crawl', e[2] / 100 + Math.max(0, rt - A.t));
}
function padAnim(dt) {
  for (const v of PADV) {
    v.t += dt;
    const snap = clamp(v.t / 0.12, 0, 1),
      settle = clamp((v.t - 0.22) / Math.max(0.1, PAD_CD - 0.22), 0, 1);
    let angle = v.cd > 0 ? 0.78 * Math.sin((snap * Math.PI) / 2) * (1 - settle * settle * (3 - 2 * settle)) : 0;
    const armed = v.armed && v.cd <= 0;
    if (armed && !v.wasArmed) {
      const p = v.g.position;
      SFX.play('creak', { x: p.x, z: p.z, vol: 0.8 });
      SFX.play('tick', { x: p.x, z: p.z, vol: 0.7 });
    }
    v.wasArmed = armed;
    if (armed) angle = -0.05 + Math.sin(clock * 40) * 0.012; // spring compresses: about to launch
    v.hinge.rotation.x = angle;
    v.spring.scale.y = armed ? 0.5 : 1 + Math.sin(angle) * PAD_D * 2.5;
    v.arr.material.emissive.setHex(v.cd > 0 ? 0x200804 : Math.sin(clock * 5) > 0 ? 0x803018 : 0x401008);
  }
}
function clearWorldViews() {
  WV.bevSeen = undefined;
  WV.holes.clear();
  WV.holeDirty = false;
  WV.holeInit = false;
  WV.holeSnapshot = undefined;
  if (WV.holeLayers)
    for (const layer of WV.holeLayers.layers) {
      layer.im.count = 0;
      layer.im.visible = false;
    }
  WV.ic.clear();
  WV.bears.forEach(b => {
    scene.remove(b.g);
    hpGroup.remove(b.hp);
    b.hp.visible = false;
    b.aura.visible = false;
    WV.bearPool.push(b);
  });
  WV.bears.length = 0;
  clearWormViews();
  WV.items.forEach(v => {
    scene.remove(v.g);
    disposeTree(v.g);
  });
  WV.items.clear();
  WV.peSeen = undefined;
  WV.prick.clear();
  if (WV.wagon) {
    scene.remove(WV.wagon.g);
    WV.wagon = null;
  }
  WV.flagMv = undefined;
  FOG.on = false;
  FOG.k = 0;
  FOG.own.length = 0;
  fogWallTick(0);
}
