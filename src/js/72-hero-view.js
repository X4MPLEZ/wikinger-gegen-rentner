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
    egoHint(TR('Erst nah an einen Sandwurm ran, der aus dem Sand ragt!'), 1500);
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
function heroBegin(u, v, P, S) {
  u.heroOn = true;
  u.heroT = 0;
  u.heroS = S;
  u.heroFrom = u.g.position.clone();
  u.heroYaw0 = u.g.rotation.y;
  u.heroP0 = null;
  u.heroSide = P ? heroCamSide(v) : 1;
  const p = u.g.position;
  if (fogSeen(p.x, p.z) || P)
    word(KINDS[u.k].fac === 'viking' ? TR('FÜR WALHALLA!') : TR('FÜR DIE RENTE!'), p.x, p.y + 3.2, p.z, { color: '#ffd34d', scale: 1.3 });
  SFX.play('rage', { x: p.x, z: p.z, vol: 1 });
  if (P) {
    egoHint(
      S.k === 'fling'
        ? TR('Lass dich hochschleudern – und ziel ins Maul!')
        : S.k === 'ramp'
          ? TR('Den Rücken hoch, bis auf den Kopf!')
          : S.k === 'rodeo'
            ? TR('Rauf auf den Kopf – Rodeo!')
            : S.k === 'pogo'
              ? TR('Hopp, hopp, hopp – auf den Kopf!')
              : TR('Rauf auf den Wurm!'),
      1400
    );
    EG.kick = Math.max(EG.kick, 0.4);
  }
}
// riders: the body gets off the mount (or the mount goes down the maw first). The rider is moved under the rig, the mount into the scene,
// both remember where they belonged (heroUnsplit puts them back if the hero ever gets away)
function heroSplit(u) {
  if (u.hSplit || !u.mount || !u.torso) return u.hSplit;
  let root = u.torso;
  while (root.parent && root.parent !== u.mount) root = root.parent;
  if (!root.parent) return null;
  const keep = o => ({ o, par: o.parent, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
  const sp = {
    root: keep(root),
    mount: keep(u.mount),
    legs: u.torso.children.filter(c => c.geometry === UG.thigh),
    w0: new THREE.Vector3(),
  };
  u.mount.getWorldPosition(sp.w0);
  sp.yaw0 = u.g.rotation.y;
  u.rig.attach(root);
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  scene.attach(u.mount);
  u.hSplit = sp;
  return sp;
}
function heroUnsplit(u) {
  const sp = u.hSplit;
  if (!sp) return;
  for (const k of ['mount', 'root']) {
    const r = sp[k];
    r.par.add(r.o);
    r.o.position.copy(r.p);
    r.o.quaternion.copy(r.q);
    r.o.scale.copy(r.s);
  }
  u.mount.traverse(o => (o.visible = true));
  u.hSplit = null;
}
function heroMountHide(u) {
  if (u.mount && u.mount.visible) u.mount.traverse(o => (o.visible = false));
}
function heroRelease(u) {
  // the worm vanished while he was on it: back to a normal warrior, who is flying off it right now
  heroUnsplit(u);
  u.heroOn = false;
  u.heroW = null;
  u.heroP0 = null;
  u.heroS = null;
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
function heroBack(v, ai, out) {
  // the top of the worm's back at ring ai (0 = under the head): where a rider drives up
  const i0 = clamp(Math.floor(ai), 0, WORM_N - 2),
    f = clamp(ai - i0, 0, 1),
    A = HV3.a,
    B = HV3.b;
  v.segs[i0].getWorldPosition(A);
  v.segs[i0 + 1].getWorldPosition(B);
  A.lerp(B, f);
  const r = lerp(v.segs[i0].scale.y, v.segs[i0 + 1].scale.y, f) * (v.g.scale.x || 1);
  return out.set(A.x, A.y + r * 0.9 - 0.15, A.z);
}
// one blow / shot pose over a beat around time ts: -1 wind-up .. 1 strike .. 0
function heroBeat(t, hits) {
  for (const ts of hits)
    if (t >= ts - 0.4 && t < ts + 0.42)
      return t < ts - 0.06 ? -sstep(ts - 0.4, ts - 0.06, t) : t < ts + 0.12 ? 1 : 1 - sstep(ts + 0.12, ts + 0.42, t);
  return 0;
}
function heroPose(u, v, t) {
  const S = u.heroS || HERO_S[0],
    k = u.k,
    rider = k === 4 || k === 5,
    ranged = k === 1 || k === 3,
    wy = v.g.rotation.y,
    gp = u.g.position,
    P = HV3.c,
    ang = (a, b, e) => a + angDiff(b, a) * e;
  v.g.updateMatrixWorld(true);
  const sd0 = u.heroSide || 1,
    climbYaw = Math.atan2(-Math.cos(wy) * sd0, Math.sin(wy) * sd0); // facing the worm's flank
  const kneel = () => v.neck.localToWorld(HV3.d.copy(HERO_KNEEL)),
    maw = () => v.neck.localToWorld(HV3.d.copy(HERO_MAW));
  // the pose (joint angles), filled in by the phases below
  const J = {
    yaw: climbYaw,
    rigLean: 0.2,
    roll: 0,
    lean: 0,
    tw: 0,
    flip: 0,
    hip: 0,
    sc: 1,
    look: 0,
    wpn: null,
    bow: 0,
    pitch: 0,
    aL: -2.3,
    aR: -2.3,
    eL: -0.5,
    eR: -0.5,
    yL: 0,
    yR: 0,
    zL: -0.15,
    zR: 0.15,
    tL: -0.6,
    tR: -0.6,
    kL: 0.9,
    kR: 0.9,
    lzL: 0,
    lzR: 0,
  };
  const seated = rider && !(u.hSplit && u.hSplit.off); // still on the mount
  const blowPose = (st, kind) => {
    // what the hands do at a beat: chop / stab (axe), bonk (cane), punch (scooter rider), shoot down (bow), throw down (teeth)
    const up = Math.max(0, -st),
      dn = Math.max(0, st);
    if (kind === 'bow') {
      J.aL = -1.5 - 0.1 * dn;
      J.eL = -0.06;
      J.yL = -0.62;
      J.aR = -1.42 + 0.3 * dn;
      J.eR = -2.15 + 1.6 * dn;
      J.yR = -0.9 - 0.4 * dn;
      J.tw = 0.62;
      J.bow = 1;
    } else if (kind === 'throw') {
      J.aR = -2.65 + 1.8 * dn - 0.2 * up;
      J.eR = -1.55 + 1.4 * dn;
      J.zR = 0.35 - 0.5 * dn;
      J.tw = 0.5 - 0.9 * dn;
      J.aL = -0.6;
      J.eL = -1.3;
    } else if (kind === 'punch') {
      J.aR = -1.6 - 1.2 * up + 0.6 * dn;
      J.eR = -1.8 * (1 - dn) - 0.2;
      J.aL = -1.2;
      J.eL = -0.4;
    } else {
      J.aR = -1.5 - 1.5 * up + 0.8 * dn;
      J.eR = -0.35 + 0.3 * dn;
      J.aL = -1.25 + 0.2 * dn;
      J.eL = -0.5;
      J.wpn = k === 2 ? 1.35 : 0.9 * dn;
    }
  };
  const blowKind = ranged ? (k === 1 ? 'bow' : 'throw') : k === 5 ? 'punch' : 'axe';
  const tumble = (F, Q, e, spins, high) => {
    // flung: an arc from F to Q, turning round his middle; arms and legs flail
    gp.set(lerp(F.x, Q.x, e), lerp(F.y, Q.y, e) + high * 4 * e * (1 - e), lerp(F.z, Q.z, e));
    J.yaw = wy;
    J.rigLean = 0;
    J.flip = -e * TAU * spins;
    const fl = clock * 26;
    J.aL = -2.8 + Math.sin(fl) * 0.4;
    J.aR = -2.7 + Math.cos(fl) * 0.4;
    J.eL = J.eR = -0.4;
    J.tL = Math.sin(fl * 1.3) * 0.8;
    J.tR = -J.tL;
    J.kL = J.kR = 0.7;
    J.sc = 1 - 0.45 * sstep(0.8, 1, e);
  };
  const leapTo = (F, Q, e, high) => {
    gp.set(lerp(F.x, Q.x, e), lerp(F.y, Q.y, e) + high * 4 * e * (1 - e), lerp(F.z, Q.z, e));
    J.aL = J.aR = -2.6;
    J.tL = -1.0;
    J.tR = -0.2;
    J.kL = 1.4;
    J.kR = 0.5;
    J.rigLean = 0.3;
  };
  const kneelOnHead = () => {
    gp.copy(kneel());
    J.yaw = wy;
    J.rigLean = 0;
    J.lean = 0.45;
    J.tL = -0.1;
    J.kL = 1.65;
    J.tR = -1.35;
    J.kR = 1.35;
    J.lzL = 0.12;
    J.lzR = -0.12;
    J.hip = -0.45;
    J.look = 0.35;
  };
  const swallowed = () => {
    u.g.visible = false;
    u.hp.visible = false;
    u.ring.visible = false;
    if (u.faceSp) u.faceSp.visible = false;
    if (u.cdSp) u.cdSp.visible = false;
    if (u.hSplit) heroMountHide(u);
  };
  // ---- riders: off the mount for "climb", the mount flees; "ramp": the mount stays under him until it is eaten first
  if (rider && S.dis && !u.hSplit) heroSplit(u);
  if (u.hSplit && S.dis && !u.hSplit.off) u.hSplit.off = 1;
  if (u.hSplit && S.dis && u.mount.visible) {
    // the mount runs away from the worm (the goat bleats, the scooter drives off by itself) and vanishes in a puff behind the dunes
    const sp = u.hSplit,
      away = Math.atan2(sp.w0.x - v.g.position.x, sp.w0.z - v.g.position.z),
      q = Math.max(0, t - 0.25),
      d = q * (k === 4 ? 7 : 5.5),
      mx = sp.w0.x + Math.sin(away) * d,
      mz = sp.w0.z + Math.cos(away) * d;
    u.mount.position.set(mx, groundY(mx, mz) + (k === 4 ? Math.abs(Math.sin(q * 14)) * 0.18 : 0), mz);
    u.mount.rotation.set(0, ang(sp.yaw0, away, sstep(0.1, 0.5, t)), 0);
    if (q > 1.5) {
      puff(mx, groundY(mx, mz) + 0.8, mz, 0xdcb878, 6, 0.8);
      heroMountHide(u);
    }
  }
  if (S.k === 'ramp') {
    // ---- up the back on the mount
    if (t < S.leap) {
      const e = sstep(0, S.leap, t),
        F = u.heroFrom,
        Q = heroBack(v, WORM_N - 2.2, HV3.c);
      gp.set(lerp(F.x, Q.x, e), lerp(F.y, Q.y, e) + 0.8 * Math.sin(e * Math.PI), lerp(F.z, Q.z, e));
      J.yaw = ang(u.heroYaw0, wy, sstep(0, 0.6, e));
    } else if (t < S.up) {
      const e = sstep(S.leap, S.up, t),
        ai = lerp(WORM_N - 2.2, 0.6, e),
        Q = heroBack(v, ai, HV3.c),
        Q2 = heroBack(v, Math.max(0, ai - 0.6), HV3.d);
      gp.copy(Q);
      J.yaw = Math.atan2(Q2.x - Q.x, Q2.z - Q.z);
      J.pitch = -Math.atan2(Q2.y - Q.y, Math.hypot(Q2.x - Q.x, Q2.z - Q.z) || 1); // tipped up the slope
    } else if (t < S.toss) {
      gp.copy(kneel());
      J.yaw = wy;
      J.pitch = -0.2;
      blowPose(heroBeat(t, S.hits), blowKind);
    } else if (t < S.gulp) {
      // flung up: the mount drops into the maw first (snap), he follows a moment later
      if (!u.hSplit) heroSplit(u);
      const sp = u.hSplit;
      sp.off = 1;
      const F = HV3.b.copy(kneel()),
        Q = maw().clone(),
        eM = clamp((t - S.toss) / (S.gulpM - S.toss), 0, 1);
      if (t < S.gulpM) {
        const mx = lerp(F.x, Q.x, eM),
          my = lerp(F.y, Q.y, eM) + 2.6 * 4 * eM * (1 - eM),
          mz = lerp(F.z, Q.z, eM);
        u.mount.position.set(mx, my, mz);
        u.mount.rotation.set(-eM * TAU * 0.8, wy, 0);
        u.mount.scale.setScalar((1 - 0.5 * sstep(0.8, 1, eM)) * (tpk(u.team, 'giant') ? 1.35 : 1));
      } else heroMountHide(u);
      tumble(F, Q, clamp((t - S.toss) / (S.gulp - S.toss), 0, 1), 1.4, 4.4);
    } else return swallowed();
  } else if (S.k === 'fling') {
    // ---- scooped up, flung high over the open maw, slow motion: draw / wind up, three shots into it, then down it goes
    const F0 = u.heroFrom;
    if (t < S.leap) {
      const e = sstep(0, S.leap, t),
        Q = HV3.a.set(v.g.position.x + Math.sin(wy) * 2.2, groundY(v.g.position.x, v.g.position.z), v.g.position.z + Math.cos(wy) * 2.2);
      leapTo(F0, Q, e, 0.6);
      J.yaw = ang(u.heroYaw0, wy + Math.PI, sstep(0, 0.7, e));
    } else if (t < S.scoop) {
      gp.set(v.g.position.x + Math.sin(wy) * 2.2, groundY(v.g.position.x, v.g.position.z), v.g.position.z + Math.cos(wy) * 2.2);
      J.yaw = wy + Math.PI; // faces the worm, ready
      J.aL = -0.6;
      J.aR = -0.6;
      J.kL = J.kR = 0.4;
      J.rigLean = -0.1;
      J.look = -0.4;
    } else if (t < S.slowEnd) {
      const M = maw(),
        apex = HV3.b.set(M.x, M.y + 6.2, M.z),
        G0 = HV3.a.set(v.g.position.x + Math.sin(wy) * 2.2, groundY(v.g.position.x, v.g.position.z), v.g.position.z + Math.cos(wy) * 2.2),
        e = sstep(S.scoop, S.apex, t),
        drift = sstep(S.apex, S.slowEnd, t);
      gp.set(lerp(G0.x, apex.x, e), lerp(G0.y, apex.y, e) + 1.5 * Math.sin(e * Math.PI) + 0.5 * drift, lerp(G0.z, apex.z, e));
      J.yaw = wy + Math.PI;
      J.rigLean = lerp(-0.4, 1.35, sstep(S.scoop + 0.2, S.apex, t)); // turns face-down over the maw
      J.flip = -TAU * sstep(S.scoop, S.apex - 0.1, t); // one somersault on the way up
      if (t > S.apex - 0.15) {
        blowPose(t < S.hits[0] - 0.4 ? -sstep(S.apex - 0.15, S.hits[0] - 0.4, t) : heroBeat(t, S.hits), blowKind);
        J.tL = -0.5 + Math.sin(t * 2) * 0.1;
        J.tR = -0.1;
        J.kL = 0.9;
        J.kR = 0.4;
        J.look = 0.5;
      }
    } else if (t < S.gulp) {
      const M = maw().clone(),
        F = HV3.b.set(M.x, M.y + 6.7, M.z),
        e = sstep(S.slowEnd, S.gulp, t);
      gp.set(lerp(F.x, M.x, e), lerp(F.y, M.y, e), lerp(F.z, M.z, e));
      J.yaw = wy + Math.PI;
      J.rigLean = 1.35 + 1.5 * e; // head first, arms out like a diver
      J.aL = J.aR = -3.0;
      J.eL = J.eR = 0;
      J.tL = J.tR = 0.1;
      J.kL = J.kR = 0.1;
      J.sc = 1 - 0.4 * sstep(0.75, 1, e);
      if (k === 1) J.bow = 1;
    } else return swallowed();
  } else if (S.k === 'rodeo' || S.k === 'pogo') {
    // ---- one leap (rodeo) or three cane hops (pogo) onto the head, then riding it / bonking it
    const F0 = u.heroFrom;
    if (t < S.leap) {
      if (S.k === 'rodeo') {
        const e = sstep(0, S.leap, t);
        leapTo(F0, kneel().clone(), e, 3.4);
        J.yaw = ang(u.heroYaw0, wy, sstep(0, 0.8, e));
        J.flip = -TAU * sstep(0.3, 0.9, e); // a somersault on the way
        J.aR = -3.0;
        J.wpn = 0;
      } else {
        const hops = S.hops,
          i = hops.findIndex(h => t < h),
          t0 = i > 0 ? hops[i - 1] : 0,
          t1 = hops[i],
          e = sstep(t0, t1, t),
          pts = [F0, heroFlank(v, 6, new THREE.Vector3(), sd0), heroFlank(v, 2.5, new THREE.Vector3(), sd0), kneel().clone()],
          A2 = pts[i],
          B2 = pts[i + 1];
        gp.set(lerp(A2.x, B2.x, e), lerp(A2.y, B2.y, e) + 2.2 * Math.sin(e * Math.PI), lerp(A2.z, B2.z, e));
        J.yaw = ang(u.heroYaw0, wy, sstep(0, S.leap, t));
        // both hands on the cane, the cane straight down under him like a pogo stick
        J.aL = J.aR = -0.6;
        J.eL = J.eR = -1.2;
        J.wpn = -Math.PI / 2;
        J.tL = J.tR = -0.15;
        J.kL = J.kR = 0.25 + 0.6 * Math.sin(e * Math.PI);
        J.rigLean = 0.05;
      }
    } else if (t < S.toss) {
      kneelOnHead();
      if (S.k === 'rodeo') {
        // standing on its head like on a bucking bull, the free arm waving
        J.hip = -0.1;
        J.tL = -0.35;
        J.kL = 0.7;
        J.tR = 0.2;
        J.kR = 0.5;
        J.roll = Math.sin(t * 6.5) * 0.25;
        J.lean = 0.2 + Math.sin(t * 6.5 + 1) * 0.2;
        blowPose(heroBeat(t, S.hits), 'axe');
        J.aL = -2.9 + Math.sin(t * 9) * 0.3;
        J.zL = -0.5;
      } else {
        J.hip = 0;
        J.tL = J.tR = -0.2;
        J.kL = J.kR = 0.35;
        const st = heroBeat(t, S.hits),
          up = Math.max(0, -st),
          dn = Math.max(0, st);
        J.aR = J.aL = -1.4 - 1.6 * up + 0.7 * dn; // both hands on the cane, over the head and bonk
        J.eR = J.eL = -0.4;
        J.lean = 0.2 + 0.6 * dn - 0.2 * up;
        J.wpn = 0.4 + 1.0 * dn;
      }
    } else if (t < S.gulp) {
      const e = clamp((t - S.toss) / (S.gulp - S.toss), 0, 1);
      tumble(HV3.b.copy(kneel()), maw().clone(), e, S.k === 'rodeo' ? 0.5 : 1.15, 3.6);
      if (S.k === 'rodeo') {
        // axe first, arms stretched over the head: a dive into the maw
        J.rigLean = Math.PI * 0.85 * sstep(0.2, 0.8, e);
        J.flip = 0;
        J.aL = J.aR = -3.05;
        J.eL = J.eR = 0;
        J.tL = J.tR = 0;
        J.kL = J.kR = 0.05;
        J.wpn = 0;
      }
    } else return swallowed();
  } else {
    // ---- "climb" (also the rider who got off, and the archer / Oma who shoots from the head)
    const o = S.o || 0;
    if (t < o) {
      // getting off the mount: a hop to the side
      const e = sstep(0, o, t),
        F0 = u.heroFrom,
        side = HV3.a.set(F0.x + Math.cos(u.heroYaw0) * 1.1, F0.y, F0.z - Math.sin(u.heroYaw0) * 1.1);
      leapTo(F0, side, e, 0.9);
      J.yaw = u.heroYaw0;
    } else if (t < S.leap) {
      const e = sstep(o, S.leap, t),
        F = o ? HV3.a.set(u.heroFrom.x + Math.cos(u.heroYaw0) * 1.1, u.heroFrom.y, u.heroFrom.z - Math.sin(u.heroYaw0) * 1.1) : u.heroFrom;
      heroFlank(v, 3.4, P, sd0);
      leapTo(F, P, e, 2.4);
      J.yaw = ang(u.heroYaw0, climbYaw, sstep(0, 0.7, e));
    } else if (t < S.climb) {
      // hand over hand up the flank, five pulls
      const N = 5,
        q = ((t - S.leap) / (S.climb - S.leap)) * N,
        n = Math.min(N - 1, Math.floor(q)),
        f = q - n,
        pull = sstep(0.15, 0.85, f),
        sd = n % 2 ? 1 : -1,
        reach = Math.sin(f * Math.PI);
      heroFlank(v, lerp(3.4, 0.55, (n + pull) / N), P, sd0);
      gp.copy(P);
      J.aL = sd > 0 ? -2.9 + 0.3 * pull : -2.2 - 0.5 * reach;
      J.aR = sd > 0 ? -2.2 - 0.5 * reach : -2.9 + 0.3 * pull;
      J.eL = -0.3 - 0.5 * (sd > 0 ? pull : 1 - pull);
      J.eR = -0.3 - 0.5 * (sd > 0 ? 1 - pull : pull);
      J.tL = sd > 0 ? -1.2 + 0.7 * pull : -0.5;
      J.tR = sd > 0 ? -0.5 : -1.2 + 0.7 * pull;
      J.kL = sd > 0 ? 1.5 - 0.6 * pull : 0.8;
      J.kR = sd > 0 ? 0.8 : 1.5 - 0.6 * pull;
      J.rigLean = 0.18 + 0.06 * Math.sin(f * TAU);
      J.look = -0.35;
    } else if (t < S.top) {
      // a swing over the side of its head onto the top
      const e = sstep(S.climb, S.top, t);
      heroFlank(v, 0.55, P, sd0);
      const Q = kneel();
      const mx = (P.x + Q.x) / 2 + Math.cos(wy) * 0.9 * sd0,
        my = Math.max(P.y, Q.y) + 1.0,
        mz = (P.z + Q.z) / 2 - Math.sin(wy) * 0.9 * sd0,
        a = (1 - e) * (1 - e),
        b = 2 * e * (1 - e),
        c = e * e;
      gp.set(a * P.x + b * mx + c * Q.x, a * P.y + b * my + c * Q.y, a * P.z + b * mz + c * Q.z);
      J.yaw = ang(climbYaw, wy, e);
      J.rigLean = 0.45 * (1 - e);
      J.lean = 0.3 * e;
      J.aL = J.aR = lerp(-2.7, -1.3, e);
      J.tL = lerp(-1.4, -0.1, e);
      J.kL = lerp(1.6, 1.65, e);
      J.tR = lerp(-1.0, -1.35, e);
      J.kR = lerp(1.2, 1.35, e);
      J.hip = -0.45 * e;
    } else if (t < S.toss) {
      kneelOnHead();
      if (ranged) {
        // standing on its head, aiming straight down into the maw
        J.hip = 0;
        J.tL = -0.3;
        J.kL = 0.5;
        J.tR = 0.15;
        J.kR = 0.4;
        J.rigLean = 0.75;
        J.lean = 0.15;
      }
      blowPose(heroBeat(t, S.hits), blowKind);
      if (!ranged) J.lean = 0.45 + 0.5 * Math.max(0, heroBeat(t, S.hits)) - 0.15 * Math.max(0, -heroBeat(t, S.hits));
    } else if (t < S.gulp) {
      tumble(HV3.b.copy(kneel()), maw().clone(), clamp((t - S.toss) / (S.gulp - S.toss), 0, 1), 1.15, 3.2);
    } else return swallowed();
  }
  // ---- apply
  const c = 1.1,
    th = J.rigLean + J.flip; // the flip turns round his middle, not his feet
  u.g.rotation.set(J.pitch, J.yaw, 0, 'YXZ');
  u.rig.rotation.set(th, 0, J.roll);
  u.rig.position.set(0, J.hip + (J.flip ? c - c * Math.cos(th) : 0), J.flip ? -c * Math.sin(th) : 0);
  if (seated) {
    // on the mount the rider's legs stay in the saddle and the body sits upright: only arms, lean and look
    u.rig.rotation.set(J.flip, 0, J.roll);
    u.rig.position.set(0, J.flip ? c - c * Math.cos(J.flip) : 0, J.flip ? -c * Math.sin(J.flip) : 0);
  }
  u.torso.rotation.set(J.lean, J.tw, 0);
  u.neck.rotation.set(J.look, -J.tw * 0.6, 0);
  u.armL.rotation.set(J.aL, J.yL, J.zL);
  u.armR.rotation.set(J.aR, J.yR, J.zR);
  if (u.foreL) {
    u.foreL.rotation.set(J.eL, 0, 0);
    u.foreR.rotation.set(J.eR, 0, 0);
  }
  if (u.legL) {
    u.legL.rotation.set(J.tL, 0, J.lzL);
    u.legR.rotation.set(J.tR, 0, J.lzR);
    u.shinL.rotation.x = J.kL;
    u.shinR.rotation.x = J.kR;
  } else if (u.hSplit && u.hSplit.off && u.hSplit.legs.length === 2) {
    // a rider off his mount: his (seated) legs walk and climb like everyone's
    const [l1, l2] = u.hSplit.legs[0].position.x < 0 ? u.hSplit.legs : [u.hSplit.legs[1], u.hSplit.legs[0]];
    l1.rotation.set(J.tL - J.lean, 0, J.lzL - 0.04);
    l2.rotation.set(J.tR - J.lean, 0, J.lzR + 0.04);
    if (l1.children[0]) l1.children[0].rotation.x = J.kL;
    if (l2.children[0]) l2.children[0].rotation.x = J.kR;
  }
  if (u.weapon) {
    u.weapon.rotation.set(J.wpn ?? (k === 2 ? 0.3 : 0), 0, 0);
    if (k === 2) u.weapon.position.set(0, -0.245, 0.05);
  }
  if (u.bow) {
    const rx2 = (Math.PI / 2) * J.bow;
    u.bow.rotation.x = rx2;
    u.bow.position.set(0, -0.245 + 0.5 * Math.sin(rx2), 0.1 - 0.5 * Math.cos(rx2));
  }
  u.g.scale.setScalar((tpk(u.team, 'giant') ? 1.35 : 1) * J.sc);
  u.hp.visible = false;
  u.ring.visible = false;
  if (u.faceSp) u.faceSp.visible = false;
  if (u.cdSp) u.cdSp.visible = false;
}
function heroFx(u, v, t, P) {
  // sounds, splashes and shouts at the beats of the script
  const S = u.heroS || HERO_S[0],
    t0 = u.heroT ?? 0,
    cross = x => x !== undefined && t0 < x && t >= x,
    W = v.wP,
    gp = u.g.position,
    vik = KINDS[u.k].fac === 'viking',
    ranged = u.k === 1 || u.k === 3;
  const near = Math.hypot(gp.x - camera.position.x, gp.z - camera.position.z) < 70,
    seen = !!P || fogSeen(gp.x, gp.z);
  if (S.dis && cross(0.3) && near) {
    SFX.play(u.k === 4 ? 'goat' : 'horn', { x: gp.x, z: gp.z, vol: 0.9 });
    if (seen) word(u.k === 4 ? TR('MÄÄÄH!') : TR('TÖÖÖT!'), gp.x, gp.y + 2.2, gp.z, { color: '#ffffff', scale: 1 });
  }
  if (cross(S.leap) && near) {
    sandBurst(gp.x, gp.z, 10, { r: 0.6, out: 1.6, up: 1.6, size: 0.1 });
    SFX.play('grunt', { x: gp.x, z: gp.z, k: u.k });
  }
  if (S.k === 'climb') {
    for (let i = 0; i < 5; i++)
      if (cross(S.leap + ((i + 0.5) * (S.climb - S.leap)) / 5) && near) {
        SFX.play('grunt', { x: gp.x, z: gp.z, k: u.k, vol: 0.6 });
        puff(gp.x, gp.y + 1.2, gp.z, 0xdcb878, 2, 0.4);
      }
    if (cross(S.climb) && near) SFX.play('heave', { x: gp.x, z: gp.z, k: u.k });
  }
  if (S.hops) S.hops.forEach(h => cross(h) && near && SFX.play('boing', { x: gp.x, z: gp.z, vol: 0.9 }));
  if (S.k === 'ramp' && near && Math.floor(t * 4) !== Math.floor(t0 * 4) && t < S.up)
    SFX.play(u.k === 4 ? 'buttHit' : 'motor', { x: gp.x, z: gp.z, vol: 0.5 });
  if (cross(S.scoop)) {
    if (near) {
      SFX.play('whoosh', { x: gp.x, z: gp.z, vol: 1.1 });
      SFX.play('wormRoar', { x: gp.x, z: gp.z, vol: 1 });
    }
    if (seen) word(TR('HUIII!'), gp.x, gp.y + 2.4, gp.z, { color: '#ffffff', scale: 1.2 });
  }
  if (cross(S.top) && P) egoHint(ranged ? TR('Ziel ins Maul!') : TR('Zuschlagen!'), 1100);
  if (S.k === 'fling' && P) {
    const slow = t >= S.apex - 0.2 && t < S.slowEnd;
    document.body.classList.toggle('heroSlow', slow); // slow motion: black bars, the world holds its breath
  }
  S.hits.forEach((ts, i) => {
    if (!cross(ts)) return;
    const m = v.neck.localToWorld(HV3.d.copy(HERO_MAW)).clone();
    if (ranged) {
      // the shot flies from his hands into the maw
      const from = u.g.position.clone();
      from.y += 1.2;
      shoot(KINDS[u.k].proj, from, m, S.k === 'fling' ? 0.45 : 0.18, null);
      SFX.play(u.k === 1 ? 'bow' : 'teeth', { x: from.x, z: from.z, vol: 1.1 });
      setTimeout(
        () => {
          if (near) {
            SFX.play('wormGrowl', { x: m.x, z: m.z, vol: 1 });
            emitFX('hit', m.x, m.y, m.z, { n: 12, size: 0.9, col: 0xc8e06a });
          }
          if (seen)
            word([TR('VOLLTREFFER!'), TR('INS MAUL!'), TR('UND NOCH EINS!')][i] || TR('INS MAUL!'), m.x, m.y + 2.4, m.z, {
              color: '#ffe08a',
              scale: 1.2,
            });
          if (P) {
            EG.kick = Math.max(EG.kick, 0.45);
            shake(0.2);
          }
        },
        (S.k === 'fling' ? 0.45 : 0.18) * 1000
      );
      return;
    }
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
    if (seen)
      word(
        (S.k === 'pogo'
          ? [TR('BONK!'), TR('DONG!'), TR('PLOCK!')]
          : S.k === 'rodeo'
            ? [TR('JIPPIEH!'), TR('ZACK!'), TR('NOCH EINER!')]
            : [TR('ZACK!'), TR('WUMMS!'), TR('NOCH EINER!')])[i] || TR('ZACK!'),
        m.x,
        m.y + 2.4,
        m.z,
        { color: '#ffe08a', scale: 1.15 }
      );
    if (P) {
      EG.kick = Math.max(EG.kick, 0.45);
      shake(0.18);
    }
  });
  if (cross(S.toss) && S.k !== 'fling') {
    if (near) {
      SFX.play('whoosh', { x: gp.x, z: gp.z, vol: 1 });
      SFX.play('wormRoar', { x: gp.x, z: gp.z, vol: 1 });
    }
    if (seen) word(vik ? TR('FÜR WALHALLA!') : TR('FÜR DIE RENTE!'), gp.x, gp.y + 3, gp.z, { color: '#ffd34d', scale: 1.25 });
  }
  if (cross(S.slowEnd) && seen)
    word(vik ? TR('FÜR WALHALLA!') : TR('FÜR DIE RENTE!'), gp.x, gp.y + 2, gp.z, { color: '#ffd34d', scale: 1.3 });
  if (cross(S.gulpM)) {
    // the mount goes first
    if (W) {
      W.gulp = 0;
      W.gulpV = 2.4;
      W.gulpK = 0.5;
    }
    if (near) SFX.play('chomp', { x: gp.x, z: gp.z, vol: 1.2 });
    const wp = v.g.position;
    if (seen) word(u.k === 4 ? TR('MEINE ZIEGE!') : TR('MEIN MOBIL!'), wp.x, wp.y + 7.5, wp.z, { color: '#ffffff', scale: 1.2 });
  }
  if (cross(S.gulp)) {
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
    if (seen) word(TR('HAPP!'), wp.x, wp.y + 8, wp.z, { color: '#ffd38a', scale: 1.3 });
    if (P) {
      document.body.classList.remove('heroSlow');
      egoHint(S.inner.length ? TR('Verschluckt! Er kämpft von innen weiter …') : TR('Verschluckt! Ein Held für die Ewigkeit.'), 1800);
      shake(0.25);
    }
  }
  S.inner.forEach(ts => {
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
    if (seen)
      word(pick([TR('AUA!'), TR('HICKS!'), TR('AUTSCH!'), TR('BAUCHWEH!')]), m.x, m.y + 2.5, m.z, { color: '#ffffff', scale: 1.05 });
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
    const S = HERO_S[h[6] || 0] || HERO_S[0];
    v.heroS = S; // the worm takes the same script (wormRig)
    if (h[4]) {
      v.g.rotation.y = (h[5] || 0) / 100; // a worm unit faces the hero for the whole sequence
      if (V.poss && V.poss.id === v.id && now() - (v.heroVictimT || -1e9) > 8000) {
        v.heroVictimT = now(); // your own worm: tell once per sequence why it does not obey
        egoHint(TR('Ein Held klettert auf deinen Wurm!'), 2200);
      }
    }
    const t = h[2] / 100 + age,
      P = V.poss && V.poss.id === u.id ? V.poss : null;
    if (!u.heroOn) heroBegin(u, v, P, S);
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
      if (!on) document.body.classList.remove('heroSlow');
      EG.hc = null;
      if (on) {
        P.heroReq = 0;
        P.dashT = 0;
        EG.intro = 0;
      } else if (V.units.get(P.id)) {
        EG.camInit = false;
        EG.intro = Math.max(EG.intro, 0.7);
      }
    }
  }
}
function heroCam(P, dt) {
  // the ego camera while he plays the hero: from the front-right of the worm, so the climb, the blows and the gulp are in view;
  // the slow-motion fling gets a close-up from below
  const u = V.units.get(P.id),
    v = u && u.heroW;
  if (!u || !v) return false;
  const S = u.heroS || HERO_S[0],
    t = u.heroT || 0,
    wy = v.g.rotation.y,
    W = v.g.position,
    sd = u.heroSide || 1,
    fx = Math.sin(wy),
    fz = Math.cos(wy),
    rx = Math.cos(wy) * sd,
    rz = -Math.sin(wy) * sd,
    fling = S.k === 'fling',
    slow = fling ? sstep(S.apex - 0.3, S.apex + 0.2, t) * (1 - sstep(S.slowEnd - 0.1, S.gulp, t)) : 0;
  // slow motion: from the side, a little below, with him above and the open maw below both in the picture
  const mid = slow ? v.neck.getWorldPosition(HV3.a).lerp(u.g.position, 0.6) : null;
  const phi = lerp(0.3, 0.75, sstep(0.2, S.top, t)) - 0.15 * sstep(S.toss, S.gulp, t) + 0.4 * slow,
    D = lerp(12.5, 10.5, sstep(0.5, S.top, t)) + 3 * sstep(S.gulp, S.end, t) + 5 * slow,
    Hc = 3.0 + 0.8 * sstep(1, S.top, t) + 1.8 * sstep(S.toss, S.gulp, t) + (mid ? (mid.y - groundY(W.x, W.z) - 3.0) * slow : 0);
  const cx = W.x + (fx * Math.cos(phi) + rx * Math.sin(phi)) * D,
    cz = W.z + (fz * Math.cos(phi) + rz * Math.sin(phi)) * D,
    cy = Math.max(groundY(cx, cz) + 1.2, groundY(W.x, W.z) + Hc);
  let lx, ly, lz;
  if (t < S.gulp && u.g.visible) {
    const n = v.neck.getWorldPosition(HV3.b);
    lx = lerp(u.g.position.x, n.x, 0.3);
    ly = lerp(u.g.position.y + 1.2, n.y, 0.3);
    lz = lerp(u.g.position.z, n.z, 0.3);
    if (mid) {
      lx = lerp(lx, mid.x, slow);
      ly = lerp(ly, mid.y, slow);
      lz = lerp(lz, mid.z, slow);
    }
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
