/* 16-sim-fass-falle.js - SIMULATION of the two newest warriors (host / single player only):
   - the Feuerfass (Wikinger, kind 12): a powder barrel on legs. Its special lights the fuse (FASS.fuse s), then everything around flies
     and burns – the own side only a little. Felled before it went off, the barrel bursts smaller (a dud); swallowed, it goes off in the
     worm's belly. Steered next to an own catapult it climbs in (command 'load'): the catapult's next shot is the barrel itself.
   - the Fallenleger (Rentner, kind 13): his attack rams the spade into the ground and a row of old trap jaws bursts out of the earth one
     after another towards the target (FANG, fangLine): a little damage to everyone on the line, held by the ankle for a moment.
     He carries one bear trap (u.trapC). His special (or, on his own, now and then) throws it where he aims (trapPlace): the enemy
     hardly sees it, whoever steps in is held fast (TRAP.hold s) and bitten. One already lying out there is picked up and thrown
     again (re-placed). When it has snapped, a new trap is ready after TRAP.re s.
   Burning (u.burn) and being caught (u.trapT) are states every warrior can have. Everything a screen must show goes through snapOf():
   flag bits, G.traps (tr) and the one-shot impacts G.xe (xEvent in 10-sim.js). */
const FASS = {
  fuse: 1.1, // seconds from lighting to the bang, for a player and the computer alike
  r: 5.2, // blast radius ...
  dmg: 112, // ... and damage at the centre (35 % at the edge)
  base: 300, // against an enemy base wall in reach (full force, like a catapult; the screens blast chunks out of it)
  own: 0.22, // own warriors take this share
  knock: 7.5, // how far the blast throws (own warriors about half as far)
  lift: 3.6,
  burn: 4.5, // seconds an enemy burns ...
  burnOwn: 0.9, // ... and an own warrior
  burnDps: 7,
  dud: 0.6, // felled before it went off: radius and damage share of the burst
  belly: 160, // a swallowed barrel against the worm
  cataR: 5.4, // shot from a catapult
  cataDmg: 130,
  cataBase: 360,
  load: 4.2, // how close to the own catapult to climb in
  torch: 3, // seconds a warrior burns after a blow with the torch (FASS.burnDps per second) ...
  torchPanic: 2.2, // ... and runs about screaming (a blast: the whole time he burns)
  imm: 2.5, // once the fire is out, a torch cannot light him again for this long (no burning for ever)
  wet: 11, // a burning warrior runs into water this close ...
  jump: 5, // ... and jumps in from a bank at most this high above it ...
  dip: 1.6, // ... once he is this close to it (the fire goes out)
};
const TRAP = {
  arm: 0.7, // seconds until a laid trap is armed (it flies TRAP_FLY s of that, 75-fass-falle-view.js)
  r: 1.6, // trigger radius (plus a bit of the victim's size): everyone in it is caught, and whoever steps in while it holds
  max: 5, // at most this many victims in one trap
  hold: 3.4, // seconds a warrior is held ...
  holdEgo: 2.4, // ... a steered one (every attack press while held wriggles 0.3 s off)
  holdBear: 2.2,
  holdSiege: 4.5,
  dmg: 60, // the bite ...
  dps: 10, // ... and the jaws grinding while held
  life: 150, // an untouched trap rusts away after this long
  re: 5.5, // after a snap: seconds until the Fallenleger has a new trap
  throw: 7.5, // how far he throws it (the special lands it where the steered player aims)
  near: 13, // the computer's Fallenleger throws his trap when enemies come this close
  aiRe: 4, // ... and picks a far one up again at most this often
  far: 11, // (an armed trap this far from him is no use: the computer re-places it when enemies come)
};
/* The Fallenleger's attack: the spade into the ground, and a row of trap jaws comes up out of the earth one after another along the
   line to the target – in a spray of dirt, no magic. Each jaw bites everyone standing on it once per row and holds him by the ankle
   for a moment (a rider longer: that is how he beats riders). Little damage per bite, but the whole line. */
const FANG = {
  n: 6, // jaws in a row ...
  first: 1.1, // ... the first this far in front of him, the rest this far apart (the computer attacks from KINDS[13].range)
  sp: 1.0,
  delay: 0.25, // the spade hits the ground and the first jaw bites (the screens: 0.05 s to come up, FANG_T in 75) ...
  gap: 0.08, // ... and the next one after the other
  r: 0.95, // each jaw bites around itself (plus half the victim's size), KINDS[13].dmg per bite (steered x CFG.possDmg.melee)
  soft: 0.3, // a steered one against riders: at least this share of their health per bite (a single blow counters with 0.7)
  hold: 0.45, // held by the ankle (snapshot bit 2097152) ...
  holdCav: 0.9, // ... a rider longer
  base: 30, // against the enemy base wall, once per row (at full force, like a catapult)
  max: 6, // at most this many bitten by one row
};
let fangNow = 0; // 1 while a steered Fallenleger's jaws bite (hit() in 10-sim.js softens the hard counter)
// a blow with the Feuerfass's torch: the victim catches fire and runs about screaming for a moment (unless steered); one who has just
// been put out does not catch fire again at once (FASS.imm)
function torchBurn(G, e, team) {
  if (!e || e.hp <= 0 || KINDS[e.k].worm || e.burn > 0 || G.t < (e.fireImm || 0)) return;
  ignite(e, FASS.torch, team, false, FASS.torchPanic);
}
// set a warrior on fire for t seconds (own: a little, from the own barrel); panic: seconds he runs about (not when steered, not a catapult)
function ignite(e, t, team, own, panic) {
  if (!(e.burn > 0)) e.burnW = undefined; // a new fire: look for water again (burnPanic)
  e.burn = t;
  e.burnT = team;
  e.burnOwn = own ? 1 : 0;
  e.burnP = !own && !e.poss && KINDS[e.k].role !== 'siege' ? Math.max(e.burnP || 0, panic) : 0;
}
// light the fuse (special of the ego, or the computer's decision); burns down in specStep
function fassLight(G, u) {
  if (u.k !== 12 || u.fuse > 0 || u.hp <= 0) return false;
  u.fuse = FASS.fuse;
  u.sp = (u.sp + 1) % 100;
  return true;
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
      if (!(e.burn > t)) ignite(e, t, team, own, t); // (the enemies run about screaming the whole time they burn)
    }
  }
  for (const b of G.bears.slice())
    if (bearHere(b) && Math.hypot(b.x - x, b.z - z) < R + 1.2) hitBear(G, b, D * 0.8, team, -1, bp, false, src);
  const eb = BASES[1 - team];
  if (baseGap(eb, x, z) < R) hit(G, -2, (cata ? FASS.cataBase : FASS.base) * (dud ? FASS.dud : 1), team, byId, 12); // (full force on walls)
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
// where the jaws of a row come up: in a line from (x, z) along the yaw, stopping at rock, trees, water or a drop (host and screens
// alike, the screens draw the row from the event's start and yaw)
function fangPts(x, z, yaw, n = FANG.n) {
  const out = [],
    dx = Math.sin(yaw),
    dz = Math.cos(yaw);
  let py = groundY(x, z);
  for (let i = 0; i < n; i++) {
    const d = FANG.first + i * FANG.sp,
      px = x + dx * d,
      pz = z + dz * d;
    if (!walkable(px, pz) || inWater(px, pz)) break;
    const gy = groundY(px, pz);
    if (Math.abs(gy - py) > 1.3) break;
    py = gy;
    out.push([px, pz]);
  }
  return out;
}
// the attack (the computer's and the steered one's): the row starts at once, the jaws bite one after another in fangStep
function fangLine(G, u, yaw) {
  const pts = fangPts(u.x, u.z, yaw);
  u.yaw = yaw;
  (G.fangs || (G.fangs = [])).push({
    pts,
    i: 0,
    t: G.t + FANG.delay,
    team: u.team,
    by: u.id,
    bp: !!u.poss,
    dm: KINDS[13].dmg * (u.poss ? CFG.possDmg.melee * (KINDS[13].ego || NO_EGO).dmg : 1) * homeMul(G, u),
    hit: [],
    hb: [],
    base: false,
  });
  xEvent(G, u.x, u.z, FANG.sp, XE.fangs, u.team, pts.length, u.id, yaw);
}
function fangStep(G, byId) {
  if (!G.fangs || !G.fangs.length) return;
  for (const L of G.fangs)
    while (L.i < L.pts.length && G.t >= L.t + L.i * FANG.gap - 1e-6) {
      const [x, z] = L.pts[L.i++];
      fangBite(G, L, x, z, byId);
    }
  G.fangs = G.fangs.filter(L => L.i < L.pts.length);
}
function fangBite(G, L, x, z, byId) {
  for (const e of G.units) {
    if (L.hit.length >= FANG.max) break;
    if (e.team === L.team || e.hp <= 0 || e.grab || e.bur || e.pj || e.air || aloft(e) || e.hero || e.heroBy) continue;
    const K = KINDS[e.k];
    if (Math.hypot(e.x - x, e.z - z) > FANG.r + K.r * 0.5 || L.hit.includes(e.id)) continue;
    L.hit.push(e.id);
    fangNow = L.bp ? 1 : 0;
    hit(G, e.id, L.dm, L.team, byId, 13, L.bp);
    fangNow = 0;
    if (e.hp > 0 && !K.worm && !K.bear && K.role !== 'siege' && !(e.trapT > 0)) {
      e.trapT = K.role === 'cav' ? FANG.holdCav : FANG.hold; // held by the ankle (trapId 0: no trap of its own)
      e.trapId = 0;
      e.kb = null;
      e.dashS = 0;
    }
  }
  for (const b of G.bears.slice())
    if (bearHere(b) && !L.hb.includes(b.id) && Math.hypot(b.x - x, b.z - z) < FANG.r + (b.worm ? 1.4 : 0.8)) {
      L.hb.push(b.id);
      hitBear(G, b, L.dm, L.team, 13, L.bp, false, L.by);
    }
  if (!L.base && baseGap(BASES[1 - L.team], x, z) < 1.1) {
    L.base = true;
    hit(G, -2, FANG.base, L.team, byId, 13);
  }
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
// the Fallenleger gets a new trap a while after his last one has snapped or rusted away (not while another of his still lies out)
function trapGone(G, t, byId) {
  const o = byId.get(t.own);
  if (o && o.hp > 0 && !o.trapC && !(o.trapRe > 0) && !G.traps.some(q => q !== t && q.own === o.id && q.st < 2)) o.trapRe = TRAP.re;
}
// his armed traps out there (st 0/1: not holding anyone)
const trapsOf = (G, u) => (G.traps || []).filter(t => t.own === u.id && t.st < 2);
/* The special: the trap flies to (tx, tz) – at most TRAP.throw m, on walkable ground, else nearer. With no trap in the hand, one that
   lies out there armed is picked up and goes there instead. False: nothing to throw (his trap holds someone, the next is not ready). */
function trapPlace(G, u, tx, tz) {
  const mine = trapsOf(G, u);
  if (!u.trapC && !mine.length) return false;
  let dx = tx - u.x,
    dz = tz - u.z;
  const d = Math.hypot(dx, dz);
  if (d > TRAP.throw) {
    dx *= TRAP.throw / d;
    dz *= TRAP.throw / d;
  }
  let x = u.x + dx,
    z = u.z + dz;
  for (let k = 0.85; !walkable(x, z) && k > 0; k -= 0.15) {
    x = u.x + dx * Math.max(0, k);
    z = u.z + dz * Math.max(0, k);
  }
  if (!walkable(x, z)) return false;
  if (mine.length) G.traps = G.traps.filter(t => !mine.includes(t)); // picked up (no snap, no wait for a new one)
  u.trapC = 1;
  return layTrap(G, u, x, z);
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
// the computer's Fallenleger (and every Fallenleger the player does not steer): throws the trap where enemies coming close will be in
// a moment, or – standing guard at a flag – in front of himself. One left far behind is picked up and thrown again when enemies come.
function fallenAuto(G, u) {
  if (u.trapT > 0 || u.down > 0) return;
  if (u.trapAI > 0) u.trapAI -= DT;
  const far = !u.trapC && !(u.trapAI > 0) && trapsOf(G, u).some(t => Math.hypot(t.x - u.x, t.z - u.z) > TRAP.far);
  if (!u.trapC && !far) return;
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
    if (Math.random() > DT * 1.1) return; // "now and then": about once a second while enemies come near
    const lead = 0.9; // where he will be in a moment
    x = clampX(best.x + (best.vx || 0) * lead);
    z = clampZ(best.z + (best.vz || 0) * lead);
  } else {
    const atFlag = FLAGS.some((F, i) => G.flags[i].owner === u.team && Math.hypot(F.x - u.x, F.z - u.z) < CFG.flagR);
    if (far || !atFlag || u.vx || u.vz || Math.random() > DT * 0.15) return;
    const a = u.yaw || 0;
    x = u.x + Math.sin(a) * 2.2;
    z = u.z + Math.cos(a) * 2.2;
  }
  if ((G.traps || []).some(t => t.team === u.team && t.own !== u.id && Math.hypot(t.x - x, t.z - z) < 2.2)) return; // no two on one spot
  if (trapPlace(G, u, x, z)) u.trapAI = TRAP.aiRe;
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
      if (inWater(u.x, u.z) || wetNear(u.x, u.z, FASS.dip)) {
        u.burn = 0; // into the water (he jumps in from the shore): out
        u.burnP = 0;
        u.fireImm = G.t + FASS.imm;
      } else {
        const d = FASS.burnDps * DT;
        if (u.burnOwn) {
          u.hp -= d * (u.poss ? CFG.possArmor : 1);
          u.hurt = 2.5;
        } else hit(G, u.id, d, u.burnT ?? 1 - u.team, byId, -1, false);
        u.lh = [12, u.burnT ?? 1 - u.team, 0];
        u.lhC = 15;
      }
      if (u.burn <= 0) {
        u.burnP = 0;
        u.fireImm = G.t + FASS.imm;
      }
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
  fangStep(G, byId);
}
// a burning warrior who is not steered runs about screaming instead of fighting – straight into water if there is some close by, where
// the fire goes out (specStep); true: this tick is taken
function burnPanic(G, u) {
  if (!(u.burnP > 0) || u.trapT > 0) return false;
  u.burnP -= DT;
  const sp = KINDS[u.k].speed * 1.25 * (u.hen ? HEN.speed : 1);
  if (u.burnW === undefined) u.burnW = burnWater(u, sp * u.burn); // only water he reaches before the fire is out
  if (u.burnW) {
    if (u.burn > DT) u.burnP = Math.max(u.burnP, DT); // on the way to the water he runs on until he is in (a torch's panic is short)
    steer(G, u, u.burnW.x, u.burnW.z, sp);
    return true;
  }
  if (!u.panic || Math.hypot(u.panic.x - u.x, u.panic.z - u.z) < 0.8) {
    const a = Math.random() * TAU;
    u.panic = nearestWalkable(MAP, clampX(u.x + Math.sin(a) * 5), clampZ(u.z + Math.cos(a) * 5));
  }
  steer(G, u, u.panic.x, u.panic.z, sp);
  return true;
}
// water within r m of a spot (a burning warrior there jumps in and the fire goes out; the screens splash there): the wet point or null.
// Not from higher up than FASS.jump above the water (a canyon's rim is no diving board).
function wetNear(x, z, r) {
  if (inWater(x, z)) return { x, z };
  if (groundY(x, z) > WL + FASS.jump) return null;
  for (const f of [0.5, 1])
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU,
        px = x + Math.sin(a) * r * f,
        pz = z + Math.cos(a) * r * f;
      if (inWater(px, pz)) return { x: px, z: pz };
    }
  return null;
}
// where a burning warrior runs to jump into the water: the nearest bank he walks to in a straight line, at most reach m (null: none).
// 32 rays in steps of 0.4 m over walkable ground without a drop; the spot is the last step before the water – or before a strip of
// steep bank with the water right behind it (wetNear finds it from there).
function burnWater(u, reach = FASS.wet) {
  const st = 0.4;
  let best = null,
    bd = Math.min(FASS.wet, reach);
  for (let i = 0; i < 32; i++) {
    const sx = Math.sin((i / 32) * TAU),
      sz = Math.cos((i / 32) * TAU);
    let px = u.x,
      pz = u.z,
      py = groundY(px, pz);
    for (let d = st; d <= bd + 1e-6; d += st) {
      const x = u.x + sx * d,
        z = u.z + sz * d,
        ok = walkable(x, z),
        y = groundY(x, z);
      if (
        py <= WL + FASS.jump &&
        (inWater(x, z) || ((!ok || Math.abs(y - py) > 1) && [0.35, 0.7, 1.05].some(f => inWater(x + sx * f, z + sz * f))))
      ) {
        bd = d - st;
        best = { x: px, z: pz };
        break;
      }
      if (!ok || Math.abs(y - py) > 1) break; // a wall, a rock, a drop: not this way
      px = x;
      pz = z;
      py = y;
    }
  }
  return best;
}
// felled before it went off: every Feuerfass that died this tick and did not explode bursts (chains through neighbours)
function fassDuds(G, byId) {
  for (let again = true, n = 0; again && n < 6; n++) {
    again = false;
    for (const u of G.units)
      if (u.hp <= 0 && u.k === 12 && !u.boomed && !u.loaded && !u.swal) {
        u.boomed = 1;
        again = true;
        if (u.headBoom) {
          // a headshot hit the barrel: the full bang, and it counts for the shooter (his own people get only a little of it)
          u.dudDie = 1; // (flies off charred like a burst barrel; the kill feed names the headshot)
          blast(G, u.x, u.z, u.headBoom - 1, byId, 'blast', u.id);
        } else {
          u.dudDie = 1;
          blast(G, u.x, u.z, u.team, byId, 'dud', u.id);
        }
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
