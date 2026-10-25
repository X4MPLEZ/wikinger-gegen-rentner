/* ---------- "Den Helden spielen": any warrior steered in ego mode jumps at a sandworm that is out of the sand – a wild one (G.bears, state
   ws 7) or a tamed worm unit of the enemy (G.units, state ws 6) – and sacrifices himself: he always ends in its maw (Heldentod), even when
   his blows beat the worm. A beaten worm holds out until he is swallowed (hp stays at 1, heroBeat remembers who beat it), then a wild one
   turns to his team and a worm unit dies.
   Every kind has two scripts (HERO_SET, the host picks one): climb up the flank and strike from its head, leap onto it for a rodeo, bounce
   up on the cane, be flung high and shoot into the open maw in slow motion, get off the mount and climb, or ride up its back – then the
   mount is eaten first. A script is a timeline in seconds since the jump: hits (blows/shots with hitDmg), the gulp, inner blows, the end.
   The worm and the hero follow the same clock (hero: u.hero.t, worm: b.st / unit worm: w.wst).
   Links: the hero unit has u.hero = { b: worm id, unit, s: script id, t, n hits, m inner hits, sw swallowed, dmg }; the worm has heroBy.
   Client side: 72-hero-view.js (poses, camera, button), snapshot field `he`. */
const HERO = {
  kinds: [0, 1, 2, 3, 4, 5],
  r: 5.4,
  rC: 4.8,
  // (the classic climb, kept as the reference timeline)
  leap: 0.55,
  climb: 2.0,
  top: 2.35,
  stabs: [2.6, 3.1, 3.6],
  stabDmg: 50,
  toss: 3.95,
  gulp: 4.45,
  inner: [5.0, 5.45, 5.9],
  innerDmg: 80,
  end: 6.4,
};
const HERO_S = [
  // 0 climb: up the flank, kneel on the head, three blows down into the maw, flung up and swallowed, three blows from inside
  {
    k: 'climb',
    o: 0,
    leap: 0.55,
    climb: 2.0,
    top: 2.35,
    hits: [2.6, 3.1, 3.6],
    hitDmg: 50,
    toss: 3.95,
    gulp: 4.45,
    inner: [5.0, 5.45, 5.9],
    innerDmg: 80,
    end: 6.4,
  },
  // 1 rodeo: one big leap onto its head, rides it while it thrashes, three chops, flung up, axe first into the maw
  {
    k: 'rodeo',
    o: 0,
    leap: 0.95,
    top: 0.95,
    hits: [1.7, 2.45, 3.2],
    hitDmg: 55,
    toss: 3.7,
    gulp: 4.3,
    inner: [4.85, 5.3, 5.75],
    innerDmg: 80,
    end: 6.3,
  },
  // 2 pogo: the Opa bounces up on his cane (three hops), three bonks on the head, swallowed, whacks from inside
  {
    k: 'pogo',
    o: 0,
    leap: 1.4,
    hops: [0.45, 0.9, 1.4],
    top: 1.4,
    hits: [1.95, 2.55, 3.15],
    hitDmg: 55,
    toss: 3.55,
    gulp: 4.15,
    inner: [4.7, 5.15, 5.6],
    innerDmg: 80,
    end: 6.1,
  },
  // 3 fling: it scoops him up and flings him high over its open maw; in slow motion he draws (winds up) and shoots three times into it,
  //   then drops in
  {
    k: 'fling',
    o: 0,
    leap: 0.5,
    scoop: 0.95,
    apex: 1.65,
    top: 1.65,
    hits: [2.45, 2.95, 3.45],
    hitDmg: 115,
    slowEnd: 3.75,
    toss: 0.95,
    gulp: 4.35,
    inner: [],
    innerDmg: 0,
    end: 5.6,
  },
  // 4 climbShoot: climbs like 0, stands on the head and shoots / throws straight down into the maw
  {
    k: 'climb',
    o: 0,
    leap: 0.55,
    climb: 2.0,
    top: 2.35,
    hits: [2.65, 3.15, 3.65],
    hitDmg: 80,
    toss: 3.95,
    gulp: 4.45,
    inner: [5.1, 5.6],
    innerDmg: 70,
    end: 6.3,
    shoot: 1,
  },
  // 5 dismount: gets off the mount (it runs away), then climbs like 0
  {
    k: 'climb',
    o: 0.6,
    leap: 1.15,
    climb: 2.6,
    top: 2.95,
    hits: [3.2, 3.7, 4.2],
    hitDmg: 55,
    toss: 4.55,
    gulp: 5.05,
    inner: [5.6, 6.05, 6.5],
    innerDmg: 75,
    end: 7.0,
    dis: 1,
  },
  // 6 ramp: rides up its back to the head, three blows from the saddle, flung up: the mount goes down the maw first, then the rider
  {
    k: 'ramp',
    o: 0,
    leap: 0.55,
    up: 1.95,
    top: 1.95,
    hits: [2.3, 2.8, 3.3],
    hitDmg: 75,
    toss: 3.6,
    gulpM: 4.05,
    gulp: 4.7,
    inner: [5.25],
    innerDmg: 120,
    end: 6.1,
  },
];
const HERO_SET = { 0: [0, 1], 1: [3, 4], 2: [0, 2], 3: [3, 4], 4: [5, 6], 5: [5, 6] };
const heroScript = u => HERO_S[(u && u.hero && u.hero.s) || 0];
function heroWormPose(st, t, o, S = HERO_S[0]) {
  // the worm meanwhile: thrashes while he climbs (or rides it), bows its head while he strikes (each blow jerks it up), flings him up and
  // catches him, writhes. "fling": it scoops him off the ground and holds its maw wide open up into the sky while he hangs above it.
  // "ramp": its back lies low like a slope while he rides up.
  let h = 4.3,
    f = 1,
    pitch = -0.35,
    jaw = 0.25,
    sway = Math.sin(t * 0.9),
    reach = 0.15,
    hx = 0;
  const jolt = st0 => S.hits.reduce((a, s2) => Math.max(a, st0 >= s2 ? Math.exp(-(st0 - s2) * 7) : 0), 0);
  if (S.k === 'fling' && st < S.gulp + 0.3) {
    if (st < S.scoop) {
      const q = sstep(0.2, S.scoop, st); // the head dips down to the ground in front of him
      h = lerp(4.3, 1.4, q);
      f = lerp(1, 2.6, q);
      pitch = lerp(-0.35, -1.0, q);
      jaw = 0.3 + 0.5 * q;
      reach = 0.4 * q;
    } else {
      const u2 = sstep(S.scoop, S.scoop + 0.3, st),
        jo = jolt(st),
        cl = sstep(S.gulp - 0.04, S.gulp + 0.1, st);
      h = lerp(1.4, 5.6, u2) + 0.35 * jo + 0.15 * Math.sin(st * 3);
      f = lerp(2.6, 0.5, u2);
      pitch = lerp(-1.0, 1.25, u2) - 0.25 * jo; // maw straight up
      jaw = lerp(1, 0, cl) * (1 - 0.3 * jo);
      sway = Math.sin(st * 1.6) * 0.15;
      hx = Math.sin(st * 29) * 0.15 * jo;
      reach = 0.3 + 0.3 * jo;
    }
  } else if (S.k === 'ramp' && st < S.top) {
    const q = sstep(0, 0.4, st);
    h = lerp(4.3, 2.0, q) + 0.25 * Math.sin(st * 6) * q;
    f = lerp(1, 2.2, q);
    pitch = lerp(-0.35, -0.75, q);
    jaw = 0.35 + 0.3 * Math.max(0, Math.sin(st * 5));
    sway = Math.sin(st * 2.5) * 0.25;
  } else if (st < S.top) {
    const q = sstep(0, 0.6, st);
    h = 4.3 + 0.5 * q + 0.2 * Math.sin(st * 7);
    sway = Math.sin(st * 5.2) * (0.5 + 0.6 * q);
    hx = Math.sin(st * 5.2 - 0.6) * 0.7 * q;
    pitch = -0.35 - 0.2 * q + 0.15 * Math.sin(st * 4.1);
    jaw = 0.3 + 0.5 * Math.max(0, Math.sin(st * 6.5));
    reach = 0.3 + 0.25 * Math.sin(st * 5.3);
  } else if (st < S.toss) {
    const jo = jolt(st),
      q = sstep(S.top - 0.1, S.top + 0.25, st),
      rodeo = S.k === 'rodeo' ? 1 : 0;
    h = lerp(4.8, 4.4, q) + 0.45 * jo + rodeo * 0.6 * Math.sin(st * 6.5);
    f = 1.1;
    pitch = lerp(-0.5, -0.42, q) + 0.5 * jo + rodeo * 0.35 * Math.sin(st * 6.5 + 1);
    jaw = 0.5 + 0.5 * jo;
    sway = Math.sin(st * 3) * 0.25 * (1 - jo) + rodeo * Math.sin(st * 4.3) * 0.9;
    hx = Math.sin(st * 31) * 0.12 * jo + rodeo * Math.sin(st * 4.3 - 0.5) * 0.6;
    reach = 0.45 + 0.45 * jo;
  } else if (st < S.gulp + 0.3) {
    const u2 = sstep(S.toss - 0.05, S.toss + 0.22, st),
      cl = sstep(S.gulp - 0.04, S.gulp + 0.1, st),
      clM = S.gulpM ? 1 - Math.min(1, Math.abs(st - S.gulpM) / 0.12) : 0; // ramp: it snaps once for the mount, opens again for the rider
    h = 4.4 + 1.1 * u2;
    f = 1.1 - 0.7 * u2;
    pitch = lerp(-0.42, 1.2, u2);
    jaw = lerp(1, 0, cl) * (1 - clM);
    sway = 0;
    reach = lerp(0.6, 0.1, u2);
  } else {
    const k = st - S.gulp,
      jo = S.inner.reduce((a, s2) => Math.max(a, st >= s2 ? Math.exp(-(st - s2) * 6) : 0), 0),
      dn = sstep(S.end - 0.5, S.end + 0.4, st);
    h = 5.5 - 1.1 * sstep(0.3, 1.0, k) + 0.6 * jo - 1.4 * dn;
    f = 0.4 + 0.6 * sstep(0.3, 1, k);
    pitch = lerp(1.2, -0.25, sstep(0.3, 0.9, k)) + 0.45 * jo;
    jaw = 0.08 + 0.75 * jo;
    sway = Math.sin(k * 6) * 0.9;
    hx = Math.sin(k * 6 - 0.5) * 0.5 + Math.sin(k * 19) * 0.25 * jo;
    reach = 0.2 + 0.6 * jo;
  }
  o.h = h;
  o.f = f;
  o.pitch = pitch;
  o.jaw = jaw;
  o.sway = sway;
  o.hx = hx;
  o.reach = reach;
  o.grip = 0;
  o.carry = 0;
  o.out = 1;
  return o;
}
const heroCanStart = u =>
  u.poss &&
  HERO.kinds.includes(u.k) &&
  u.hp > 0 &&
  !u.hero &&
  !u.grab &&
  !u.air &&
  !u.pj &&
  !(u.fall > 0) &&
  !(u.down > 0) &&
  !(u.dance > 0) &&
  !u.bur &&
  !(u.dashS > 0) &&
  !(u.chick > 0) &&
  !u.hen;
// a sandworm the hero can climb right now: a wild one out of the sand (ploughing with its head up, or reared up and not about to dive),
// or an enemy worm unit on the surface / reared up
const heroWildOk = b => b.worm && b.hp > 0 && b.tameTeam === undefined && !b.heroBy && (b.ws === 6 || (b.ws === 4 && b.st < WORM.up - 0.2));
const heroUnitOk = (w, team) =>
  KINDS[w.k].worm && w.team !== team && w.hp > 0 && !w.heroBy && !w.bur && !w.grab && !w.air && !w.pj && (w.ws === 0 || w.ws === 4);
function heroWorm(G, u, r = HERO.r) {
  // the nearest climbable sandworm within r (a wild worm from G.bears or an enemy worm unit), or null
  if (!heroCanStart(u)) return null;
  let best = null,
    bd = r * r;
  const near = w => {
    const d2 = (w.x - u.x) ** 2 + (w.z - u.z) ** 2;
    if (d2 < bd) {
      bd = d2;
      best = w;
    }
  };
  for (const b of G.bears) if (heroWildOk(b)) near(b);
  for (const w of G.units) if (heroUnitOk(w, u.team)) near(w);
  return best;
}
const heroIsUnit = w => w.k !== undefined; // worm units have a kind, wild worms do not
function heroStart(G, u, w) {
  const unit = heroIsUnit(w);
  w.heroBy = u.id;
  w.yaw = Math.atan2(u.x - w.x, u.z - w.z); // it rears up, facing him
  w.ex = w.x;
  w.ez = w.z;
  if (unit) {
    w.ws = 6;
    w.wst = 0;
    w.vx = 0;
    w.vz = 0;
    w.path = null;
    w.tgt = -1;
    w.down = 0;
    w.kb = null;
  } else {
    w.ws = 7;
    w.st = 0;
    w.bw = 0;
    w.mv = 0;
    w.prey = 0;
  }
  const set = HERO_SET[u.k] || [0];
  u.hero = { b: w.id, unit, s: set[(Math.random() * set.length) | 0], t: 0, n: 0, m: 0, sw: 0, dmg: 0 };
  w.heroS = u.hero.s; // (the worm's head follows the script: wormHead)
  u.bur = 1; // bur: out of reach of everything else (blows, shots, claws, knock-backs) while on and in the worm
  u.kb = null;
  u.down = 0;
  u.vx = 0;
  u.vz = 0;
  u.path = null;
  u.tgt = -1;
  u.rage = 0;
  u.spinT = 0;
  u.clawT = 0;
  u.jumpT = 0;
  u.dashS = 0;
  u.atQ = 0;
  u.spQ = 0;
  u.aim = null;
}
const heroWormOf = (G, H, byId) => (H.unit ? byId.get(H.b) : G.bears.find(w => w.id === H.b));
const heroWormFind = (G, H) => (H.unit ? G.units.find(o => o.id === H.b) : G.bears.find(w => w.id === H.b)); // without the id map (snapshot)
function heroStep(G, u, byId) {
  const H = u.hero,
    In = G.teams[u.team].posIn;
  H.t += DT;
  if (u.poss && In && In.id === u.id) {
    u.la = In.a;
    u.ls = In.s;
    u.lj = In.j;
    u.lg = In.g;
    u.lhx = In.h || 0;
  } // no other moves until it is over
  u.vx = 0;
  u.vz = 0;
  u.run = 0;
  u.ord = { x: u.x, z: u.z, mv: false };
  u.tgt = -1;
  u.path = null;
  u.down = 0;
  u.dance = 0;
  u.kb = null;
  const w = heroWormOf(G, H, byId);
  if (!w || w.hp <= 0 || w.heroBy !== u.id || (!H.unit && w.tameTeam !== undefined)) {
    heroEnd(G, u, w, true);
    return;
  } // the worm is beaten (or gone): he gets away
  u.x = w.x;
  u.z = w.z;
  u.y = u.fy = unitY(u.x, u.z);
  u.yaw = w.yaw + Math.PI;
  const S = HERO_S[H.s] || HERO_S[0];
  const strike = dmg => {
    H.dmg += dmg;
    if (H.unit)
      hit(G, w.id, dmg / (w.poss ? CFG.possArmor * WORM.egoArmor : 1), u.team, byId, u.k, true); // the ego worm's armour does not soften a hero's blows
    else hitBear(G, w, dmg, u.team, u.k, true, false, u.id);
  }; // a beaten worm holds out at 1 hp until he is swallowed (hit / hitBear: heroBeat)
  while (H.n < S.hits.length && H.t >= S.hits[H.n]) {
    H.n++;
    strike(S.hitDmg);
  }
  if (!H.sw && H.t >= S.gulp) H.sw = 1;
  while (H.sw && H.m < S.inner.length && H.t >= S.inner[H.m]) {
    H.m++;
    strike(S.innerDmg);
  }
  if (H.t >= S.end) heroEnd(G, u, w, false);
}
function heroHeldStep(G, w) {
  // an enemy worm unit with a hero on it: it only thrashes (the hero's sequence drives it); its own AI or ego input waits
  w.wst += DT;
  w.vx = 0;
  w.vz = 0;
  w.run = 0;
  w.cd = Math.max(w.cd || 0, 0.3);
  w.ord = { x: w.x, z: w.z, mv: false };
  w.tgt = -1;
  w.path = null;
  if (w.poss) {
    const In = G.teams[w.team].posIn;
    if (In && In.id === w.id) {
      w.la = In.a;
      w.ls = In.s;
      w.lj = In.j;
      w.lg = In.g;
      w.lhx = In.h || 0;
    }
  }
  if (!G.units.some(o => o.id === w.heroBy && o.hero && o.hp > 0)) heroFree(w); // safety: hero gone -> worm free
}
function heroFree(w) {
  // the hero sequence is over for this worm: a wild one dives away (or stays out a moment), a worm unit goes back on the surface
  w.heroBy = 0;
  if (heroIsUnit(w)) {
    if (w.ws === 6) {
      w.ws = 0;
      w.wst = 0;
      w.wcd = WORM.cdT;
      delete w.ex;
      delete w.ez;
    }
  } else if (w.ws === 7) {
    w.ws = 5;
    w.st = 0;
    w.hc = WORM.rest;
  }
}
function heroEnd(G, u, w, escaped) {
  const H = u.hero;
  u.hero = null;
  u.bur = 0;
  const mine = w && w.heroBy === u.id,
    x = w ? w.x : u.x,
    z = w ? w.z : u.z;
  if (!escaped) {
    // Heldentod: gone for good; the worm has a bellyache – and if he beat it, it gives up now
    u.swal = 1;
    u.hp = 0;
    u.lh = [-8, -1, 0];
    highlight(G, 'hero', u.team, Math.round(H.dmg), x, z);
    if (mine) {
      const beat = w.heroBeat;
      w.heroBeat = 0;
      if (beat) {
        const team = beat - 1;
        w.heroBy = 0;
        if (H.unit) {
          w.hp = 0;
          w.lh = [u.k, team, 0];
        } else hitBear(G, w, 99999, team, -1);
        if (team === u.team) highlight(G, 'heroWin', u.team, Math.round(H.dmg), x, z);
      } else heroFree(w);
    }
    return;
  }
  u.x = x;
  u.z = z;
  u.y = u.fy = unitY(x, z);
  u.hp = Math.max(1, u.hp);
  u.cd = 0.5; // he gets away: jumps off, or is spat out if he was already inside
  const a = (w ? w.yaw : u.yaw) + (Math.random() - 0.5) * 1.2;
  knockFly(u, 0, 0, H.sw ? 6 : 4.5, Math.sin(a), Math.cos(a), H.sw ? 7 : 5, 'ego');
  if (H.sw) u.spat = 1;
  u.kbTeam = undefined;
  u.kbEgo = 0;
  if (u.air) u.air.kind = 'fall'; // nobody's blow: no kill credit for the enemy, and he does not bowl his own friends over
  if (mine) {
    w.heroBy = 0;
    if (!H.unit && w.ws === 7) {
      w.ws = 4;
      w.st = Math.max(0, WORM.up - 1.2);
    } // still alive (his player left?): it stays out a moment, then dives
    else if (H.unit && w.ws === 6 && w.hp > 0) heroFree(w);
  }
  if (H.unit ? w && w.hp <= 0 : w && w.tameTeam === u.team) highlight(G, 'heroWin', u.team, Math.round(H.dmg), x, z);
}
