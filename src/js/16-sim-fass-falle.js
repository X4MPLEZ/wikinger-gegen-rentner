/* 16-sim-fass-falle.js - SIMULATION of the two newest warriors (host / single player only):
   - the Feuerfass (Wikinger, kind 12): a powder barrel on legs. Its special lights the fuse (FASS.fuse s), then everything around flies
     and burns – the own side only a little. Felled before it went off, the barrel bursts smaller (a dud); swallowed, it goes off in the
     worm's belly. Steered next to an own catapult it climbs in (command 'load'): the catapult's next shot is the barrel itself.
   - the Fallenleger (Rentner, kind 13): carries one bear trap (u.trapC). His special (or, on his own, now and then) lays it: the enemy
     hardly sees it, whoever steps in is held fast (TRAP.hold s) and bitten. When it has snapped, a new trap is ready after TRAP.re s.
   Burning (u.burn) and being caught (u.trapT) are states every warrior can have. Everything a screen must show goes through snapOf():
   flag bits, G.traps (tr) and the one-shot impacts G.xe (xEvent in 10-sim.js). */
const FASS = {
  fuse: 1.1, // seconds from lighting to the bang, for a player and the computer alike
  r: 4.4, // blast radius ...
  dmg: 112, // ... and damage at the centre (35 % at the edge)
  base: 150, // against an enemy base wall in reach (before the base armour)
  own: 0.22, // own warriors take this share
  knock: 7.5, // how far the blast throws (own warriors about half as far)
  lift: 3.6,
  burn: 3.4, // seconds an enemy burns ...
  burnOwn: 0.9, // ... and an own warrior
  burnDps: 9,
  dud: 0.6, // felled before it went off: radius and damage share of the burst
  belly: 160, // a swallowed barrel against the worm
  cataR: 5.4, // shot from a catapult
  cataDmg: 130,
  cataBase: 200,
  load: 4.2, // how close to the own catapult to climb in
  near: 3.0, // the computer lights the fuse with two enemies this close (one when it is badly hurt)
  torch: 1.8, // seconds a warrior burns after a blow with the torch (FASS.burnDps per second)
};
const TRAP = {
  arm: 0.9, // seconds until a laid trap is armed
  r: 1.6, // trigger radius (plus a bit of the victim's size): everyone in it is caught, and whoever steps in while it holds
  max: 5, // at most this many victims in one trap
  hold: 3.4, // seconds a warrior is held ...
  holdEgo: 2.4, // ... a steered one (every attack press while held wriggles 0.3 s off)
  holdBear: 2.2,
  holdSiege: 4.5,
  dmg: 60, // the bite ...
  dps: 10, // ... and the jaws grinding while held
  life: 150, // an untouched trap rusts away after this long
  re: 7, // after a snap: seconds until the Fallenleger has a new trap in his hand
  near: 13, // the computer's Fallenleger lays his trap when enemies come this close ...
  fight: 2.6, // ... but not when one is already this close (then he fights)
  carry: 1.25, // a blow with the trap in the hand hits harder ...
  fist: 0.8, // ... than with bare fists
};
// the melee damage factor of the new warriors (with or without the trap in the hand)
const specDmg = u => (u.k === 13 ? (u.trapC ? TRAP.carry : TRAP.fist) : 1);
// a blow with the Feuerfass's torch: the victim catches fire for a moment (and panics once, briefly, unless steered)
function torchBurn(G, e, team) {
  if (!e || e.hp <= 0 || KINDS[e.k].worm) return;
  const t = FASS.torch;
  if (e.burn > t) return;
  if (!(e.burn > 0) && !e.poss && KINDS[e.k].role !== 'siege') e.burnP = 0.5;
  e.burn = t;
  e.burnT = team;
  e.burnOwn = 0;
}
// light the fuse (special of the ego, or the computer's decision); burns down in specStep
function fassLight(G, u) {
  if (u.k !== 12 || u.fuse > 0 || u.hp <= 0) return false;
  u.fuse = FASS.fuse;
  u.sp = (u.sp + 1) % 100;
  return true;
}
// the computer's Feuerfass: lights up in a crowd of enemies, at the enemy wall or next to an enemy catapult
function fassAuto(G, u) {
  if (u.fuse > 0 || u.trapT > 0) return;
  let n = 0,
    big = false;
  for (const e of G.units) {
    if (e.team === u.team || e.hp <= 0 || e.grab || e.bur || e.pj || e.air || aloft(e) || e.hen) continue;
    const d = Math.hypot(e.x - u.x, e.z - u.z);
    if (d > FASS.near + KINDS[e.k].r) continue;
    n++;
    if (KINDS[e.k].role === 'siege' || KINDS[e.k].worm || e.poss) big = true;
  }
  const wall = baseGap(BASES[1 - u.team], u.x, u.z) < 1.6;
  if (n >= 2 || big || wall || (n >= 1 && u.hp < maxHp(u) * 0.45)) fassLight(G, u);
}
/* The bang. kind: 'blast' (a Feuerfass), 'dud' (one that was felled), 'cata' (shot from a catapult). Enemies in the radius take the
   damage (falling off to the edge), fly and burn; own warriors take a small share and burn briefly; bears are hit, worms take it
   without flying; a base wall in reach takes base damage; traps in the radius snap shut empty. */
function blast(G, x, z, team, byId, kind, src = -1, bp = false) {
  const cata = kind === 'cata',
    dud = kind === 'dud',
    R = cata ? FASS.cataR : FASS.r * (dud ? FASS.dud : 1),
    D = (cata ? FASS.cataDmg : FASS.dmg) * (dud ? FASS.dud : 1);
  let caught = 0;
  for (const e of G.units) {
    if (e.hp <= 0 || e.grab || e.bur || e.pj || e.id === src || e.hero || e.heroBy) continue;
    const d = Math.hypot(e.x - x, e.z - z),
      K = KINDS[e.k];
    if (d > R + K.r || (aloft(e) && e.fh > 4)) continue;
    const f = clamp(1 - d / (R + 0.6), 0.35, 1),
      own = e.team === team;
    if (own) {
      // own warriors: a little damage, no kill for anyone
      e.hp -= D * f * FASS.own * (e.poss ? CFG.possArmor : 1);
      e.hurt = 2.5;
    } else {
      hit(G, e.id, D * f * (K.worm ? 1.3 : 1), team, byId, -1, bp);
      if (!e.hen) caught++;
    }
    e.lh = [12, team, 0];
    e.lhC = 14;
    if (e.hp <= 0) {
      // blown away: the body flies off charred (death 6, 73-deaths.js)
      const l = d || 1,
        s = 4 + 5 * f;
      if (!K.worm && K.role !== 'siege' && !K.bear) e.blastV = [((e.x - x) / l) * s, 6 + 5 * f, ((e.z - z) / l) * s];
      continue;
    }
    if (!K.worm && K.role !== 'siege' && !K.bear) {
      knockFly(e, x, z, FASS.knock * (0.55 + 0.45 * f) * (own ? 0.5 : 1), undefined, undefined, FASS.lift * (own ? 0.6 : 1), 'ego');
      if (own) e.kbTeam = undefined;
    }
    if (!K.worm && !(e.fh > 0.4)) {
      const t = own ? FASS.burnOwn : FASS.burn * (dud ? 0.7 : 1);
      if (!(e.burn > t)) {
        e.burn = t;
        e.burnT = team;
        e.burnOwn = own ? 1 : 0;
        e.burnP = !own && !e.poss && K.role !== 'siege' ? 1.1 : 0; // a moment of panic
      }
    }
  }
  for (const b of G.bears.slice())
    if (bearHere(b) && Math.hypot(b.x - x, b.z - z) < R + 1.2) hitBear(G, b, D * 0.8, team, -1, bp, false, src);
  const eb = BASES[1 - team];
  if (baseGap(eb, x, z) < R) hit(G, -2, (cata ? FASS.cataBase : FASS.base) * (dud ? FASS.dud : 1), team, byId, -1);
  for (const t of G.traps || []) if (t.st < 2 && Math.hypot(t.x - x, t.z - z) < R) trapShut(G, t);
  xEvent(G, x, z, R, cata ? XE.cata : dud ? XE.dud : XE.blast, team, caught);
}
// a Feuerfass swallowed by a sandworm: the barrel goes off inside (the worm is hit hard, nobody else)
function fassBelly(G, W, u, byId) {
  if (u.boomed) return;
  u.boomed = 1;
  if (W.k === undefined) hitBear(G, W, FASS.belly, u.team, -1, false, false, u.id);
  else if (W.team !== u.team) hit(G, W.id, FASS.belly, u.team, byId, -1);
  xEvent(G, W.ex ?? W.x, W.ez ?? W.z, 2, XE.dud, u.team);
}
// a trap: lay it (st 0 arming, 1 armed, 2 holding a victim, 3 shut and empty – gone a moment later)
function layTrap(G, u, x, z) {
  if (!u.trapC || !walkable(x, z)) return false;
  u.trapC = 0;
  G.trapId = ((G.trapId || 0) + 1) % 10000;
  (G.traps || (G.traps = [])).push({ id: G.trapId, team: u.team, x, z, own: u.id, t: 0, st: 0, vs: [], vb: 0, hold: 0, end: 0 });
  u.sp = (u.sp + 1) % 100;
  return true;
}
function trapShut(G, t) {
  t.st = 3;
  t.end = 1.2;
  t.vs = [];
  xEvent(G, t.x, t.z, 0.6, XE.snap, t.team);
}
// the Fallenleger gets a new trap a while after his last one has snapped or rusted away
function trapGone(G, t, byId) {
  const o = byId.get(t.own);
  if (o && o.hp > 0 && !o.trapC) o.trapRe = TRAP.re;
}
// a warrior steps into the trap: held and bitten (st 2 while anyone is held; more can step in meanwhile)
function trapCatch(G, t, v, byId) {
  const K = KINDS[v.k];
  t.st = 2;
  t.vs.push(v.id);
  t.hold = v.poss ? TRAP.holdEgo : K.role === 'siege' ? TRAP.holdSiege : TRAP.hold;
  v.trapT = t.hold;
  v.trapId = t.id;
  v.kb = null;
  v.down = 0;
  v.dance = 0;
  v.ramQ = null;
  v.dashS = 0;
  v.path = null;
  const d = Math.hypot(v.x - t.x, v.z - t.z) || 1,
    keep = Math.min(d, 0.55 + 0.3 * t.vs.length); // pulled onto the jaws (several share the rim)
  v.x = t.x + ((v.x - t.x) / d) * keep;
  v.z = t.z + ((v.z - t.z) / d) * keep;
  hit(G, v.id, TRAP.dmg, t.team, byId, -1, false);
  v.lh = [13, t.team, 0];
  v.lhC = 16;
  xEvent(G, t.x, t.z, 0.6, XE.snap, t.team, v.poss ? 1 : 0);
}
const trapVictim = (t, e) =>
  e.team !== t.team &&
  e.hp > 0 &&
  !e.grab &&
  !e.bur &&
  !e.pj &&
  !e.air &&
  !aloft(e) &&
  !e.hero &&
  !e.heroBy &&
  !(e.trapT > 0) &&
  !KINDS[e.k].worm &&
  Math.hypot(e.x - t.x, e.z - t.z) < TRAP.r + KINDS[e.k].r * 0.45;
function trapStep(G, byId) {
  if (!G.traps || !G.traps.length) return;
  for (const t of G.traps) {
    t.t += DT;
    if (t.st === 0 && t.t >= TRAP.arm) t.st = 1;
    if (t.st === 1) {
      if (t.t > TRAP.life) {
        t.st = 4; // rusted away
        continue;
      }
      let any = false;
      for (const e of G.units) {
        if (t.vs.length >= TRAP.max) break;
        if (trapVictim(t, e)) {
          trapCatch(G, t, e, byId);
          any = true;
        }
      }
      if (any) continue;
      for (const b of G.bears) {
        if (!bearHere(b) || b.worm || b.tameTeam === t.team || b.trapT > 0) continue;
        if (Math.hypot(b.x - t.x, b.z - t.z) < TRAP.r + 0.6) {
          t.st = 2;
          t.vb = b.id + 1;
          b.trapT = TRAP.holdBear;
          hitBear(G, b, TRAP.dmg, t.team, -1, false, false, t.own);
          xEvent(G, t.x, t.z, 0.6, XE.snap, t.team);
          break;
        }
      }
    } else if (t.st === 2) {
      // whoever is still held is bitten on; anyone else stepping in is caught too
      let held = false;
      for (const id of t.vs) {
        const v = byId.get(id);
        if (v && v.hp > 0 && v.trapT > 0 && v.trapId === t.id) {
          held = true;
          hit(G, v.id, TRAP.dps * DT, t.team, byId, -1, false);
          v.lh = [13, t.team, 0];
          v.lhC = 16;
        } else if (v) v.trapId = 0;
      }
      if (held && t.vs.length < TRAP.max) for (const e of G.units) if (t.vs.length < TRAP.max && trapVictim(t, e)) trapCatch(G, t, e, byId);
      const b = t.vb ? G.bears.find(o => o.id === t.vb - 1) : null;
      if (held || (b && b.trapT > 0 && bearHere(b))) continue;
      t.st = 3;
      t.end = 1.2;
    } else if (t.st === 3) {
      t.end -= DT;
      if (t.end <= 0) t.st = 4;
    }
  }
  for (const t of G.traps) if (t.st === 4) trapGone(G, t, byId);
  G.traps = G.traps.filter(t => t.st !== 4);
}
// the computer's Fallenleger (and every Fallenleger the player does not steer): lays the trap in the path of enemies coming close,
// or – standing guard at a flag – in front of himself
function fallenAuto(G, u) {
  if (!u.trapC || u.trapT > 0 || u.down > 0) return;
  let best = null,
    bd = TRAP.near * TRAP.near;
  for (const e of G.units) {
    if (e.team === u.team || e.hp <= 0 || e.grab || e.bur || e.pj || aloft(e) || KINDS[e.k].worm) continue;
    const d2 = (e.x - u.x) ** 2 + (e.z - u.z) ** 2;
    if (d2 < bd) {
      bd = d2;
      best = e;
    }
  }
  let x, z;
  if (best) {
    const d = Math.sqrt(bd);
    if (d < TRAP.fight || Math.random() > DT * 0.9) return; // "now and then": about once a second while enemies come near
    const k = Math.min(1.6, d * 0.4) / d;
    x = u.x + (best.x - u.x) * k;
    z = u.z + (best.z - u.z) * k;
  } else {
    const atFlag = FLAGS.some((F, i) => G.flags[i].owner === u.team && Math.hypot(F.x - u.x, F.z - u.z) < CFG.flagR);
    if (!atFlag || u.vx || u.vz || Math.random() > DT * 0.15) return;
    const a = u.yaw || 0;
    x = u.x + Math.sin(a) * 1.4;
    z = u.z + Math.cos(a) * 1.4;
  }
  if ((G.traps || []).some(t => t.team === u.team && Math.hypot(t.x - x, t.z - z) < 2.2)) return; // no two traps on one spot
  layTrap(G, u, x, z);
}
/* Once per tick, before the warriors act: fuses burn down, the burning burn, the caught are held, Fallenleger get new traps, traps snap. */
function specStep(G, byId) {
  for (const u of G.units) {
    if (u.hp <= 0) continue;
    if (u.fuse > 0) {
      u.fuse -= DT;
      if (u.fuse <= 0 && !u.boomed) {
        u.boomed = 1;
        blast(G, u.x, u.z, u.team, byId, 'blast', u.id, !!u.poss);
        u.hp = 0; // the barrel takes its carrier along (no kill for anyone)
        u.lh = [12, u.team, 0];
        u.lhC = 14;
        u.boomDie = 1;
        continue;
      }
    }
    if (u.burn > 0) {
      u.burn -= DT;
      if (inWater(u.x, u.z) || wadeAt(u.x, u.z)) {
        u.burn = 0; // into the water: out
        u.burnP = 0;
      } else {
        const d = FASS.burnDps * DT;
        if (u.burnOwn) {
          u.hp -= d * (u.poss ? CFG.possArmor : 1);
          u.hurt = 2.5;
        } else hit(G, u.id, d, u.burnT ?? 1 - u.team, byId, -1, false);
        u.lh = [12, u.burnT ?? 1 - u.team, 0];
        u.lhC = 15;
      }
      if (u.burn <= 0) u.burnP = 0;
    }
    if (u.trapRe > 0) {
      u.trapRe -= DT;
      if (u.trapRe <= 0 && u.k === 13) {
        u.trapC = 1;
        u.trapRe = 0;
      }
    }
    if (u.trapT > 0) {
      u.trapT -= DT;
      if (u.trapT <= 0) u.trapT = 0;
    }
  }
  for (const b of G.bears) if (b.trapT > 0) b.trapT -= DT;
  trapStep(G, byId);
}
// a burning warrior who is not steered runs about for a moment instead of fighting (true: this tick is taken)
function burnPanic(G, u) {
  if (!(u.burnP > 0)) return false;
  u.burnP -= DT;
  if (!u.panic || Math.hypot(u.panic.x - u.x, u.panic.z - u.z) < 0.8) {
    const a = Math.random() * TAU;
    u.panic = nearestWalkable(MAP, clampX(u.x + Math.sin(a) * 5), clampZ(u.z + Math.cos(a) * 5));
  }
  const K = KINDS[u.k];
  steer(G, u, u.panic.x, u.panic.z, K.speed * 1.2 * (u.hen ? HEN.speed : 1));
  return true;
}
// felled before it went off: every Feuerfass that died this tick and did not explode bursts (chains through neighbours)
function fassDuds(G, byId) {
  for (let again = true, n = 0; again && n < 6; n++) {
    again = false;
    for (const u of G.units)
      if (u.hp <= 0 && u.k === 12 && !u.boomed && !u.loaded && !u.swal) {
        u.boomed = 1;
        u.dudDie = 1;
        again = true;
        blast(G, u.x, u.z, u.team, byId, 'dud', u.id);
      }
  }
}
// the steered Feuerfass climbs into the own catapult next to him: he is gone, the catapult is loaded and taken over (command 'load')
function fassLoad(G, team, c) {
  const T = G.teams[team],
    u = T.pos && G.units.find(v => v.id === T.pos),
    cat = G.units.find(v => v.id === c.id);
  if (!u || u.k !== 12 || u.hp <= 0 || u.down > 0 || u.dance > 0 || u.hero || u.air || u.pj || u.fuse > 0 || u.trapT > 0) return;
  if (!cat || cat.team !== team || cat.hp <= 0 || KINDS[cat.k].role !== 'siege' || cat.poss || cat.fass || cat.fall > 0) return;
  if (Math.hypot(cat.x - u.x, cat.z - u.z) > FASS.load + KINDS[cat.k].r) return;
  egoCooldownsKeep(G, T, u);
  setPoss(u, false);
  u.hp = 0;
  u.loaded = 1; // quietly gone: no death, no loss, no kill feed
  u.counted = 1;
  u.kfd = 1;
  (G.gone || (G.gone = [])).push(u.id);
  if (G.gone.length > 8) G.gone.shift();
  cat.fass = 1;
  xEvent(G, cat.x, cat.z, 1, XE.load, team);
  applyCmd(G, team, { t: 'poss', id: cat.id });
}
