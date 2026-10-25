/* ---------- "Den Helden spielen": a Berserker or Krückstock-Opa steered in ego mode jumps at a sandworm that is out of the sand – a wild one
   (G.bears, state ws 7) or a tamed worm unit of the enemy (G.units, state ws 6) – climbs it, kneels on its head and stabs down into the maw three
   times; then it flings him up and swallows him, and he stabs on from inside. A lot of damage, and he is gone (Heldentod). If the worm is beaten
   before that, the hero gets away (spat out if already inside); a beaten wild worm turns to his team, a worm unit just dies.
   Times in seconds since the jump; the worm and the hero follow the same clock (hero: u.hero.t, worm: b.st / unit worm: w.wst).
   Links: the hero unit has u.hero = { b: worm id, unit: worm is a unit, t, n stabs, m inner stabs, sw swallowed, dmg }; the worm has heroBy = hero id.
   Client side: 72-hero-view.js (pose, camera, button), snapshot field `he`. */
const HERO = {
  kinds: [0, 2],
  r: 5.4,
  rC: 4.8,
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
function heroWormPose(st, t, o) {
  // the worm meanwhile: thrashes while he climbs, bows its head while he stabs (each stab jerks it up), flings him up and catches him, writhes
  const H = HERO;
  let h = 4.3,
    f = 1,
    pitch = -0.35,
    jaw = 0.25,
    sway = Math.sin(t * 0.9),
    reach = 0.15,
    hx = 0;
  if (st < H.top) {
    const q = sstep(0, 0.6, st);
    h = 4.3 + 0.5 * q + 0.2 * Math.sin(st * 7);
    sway = Math.sin(st * 5.2) * (0.5 + 0.6 * q);
    hx = Math.sin(st * 5.2 - 0.6) * 0.7 * q;
    pitch = -0.35 - 0.2 * q + 0.15 * Math.sin(st * 4.1);
    jaw = 0.3 + 0.5 * Math.max(0, Math.sin(st * 6.5));
    reach = 0.3 + 0.25 * Math.sin(st * 5.3);
  } else if (st < H.toss) {
    const jo = H.stabs.reduce((a, s) => Math.max(a, st >= s ? Math.exp(-(st - s) * 7) : 0), 0),
      q = sstep(H.top - 0.1, H.top + 0.25, st);
    h = lerp(4.8, 4.4, q) + 0.45 * jo;
    f = 1.1;
    pitch = lerp(-0.5, -0.42, q) + 0.5 * jo;
    jaw = 0.5 + 0.5 * jo;
    sway = Math.sin(st * 3) * 0.25 * (1 - jo);
    hx = Math.sin(st * 31) * 0.12 * jo;
    reach = 0.45 + 0.45 * jo;
  } else if (st < H.gulp + 0.3) {
    const u2 = sstep(H.toss - 0.05, H.toss + 0.22, st),
      cl = sstep(H.gulp - 0.04, H.gulp + 0.1, st);
    h = 4.4 + 1.1 * u2;
    f = 1.1 - 0.7 * u2;
    pitch = lerp(-0.42, 1.2, u2);
    jaw = lerp(1, 0, cl);
    sway = 0;
    reach = lerp(0.6, 0.1, u2);
  } else {
    const k = st - H.gulp,
      jo = H.inner.reduce((a, s) => Math.max(a, st >= s ? Math.exp(-(st - s) * 6) : 0), 0),
      dn = sstep(H.end - 0.5, H.end + 0.4, st);
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
  u.hero = { b: w.id, unit, t: 0, n: 0, m: 0, sw: 0, dmg: 0 };
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
  const strike = dmg => {
    H.dmg += dmg;
    if (H.unit)
      hit(G, w.id, dmg / (w.poss ? CFG.possArmor * WORM.egoArmor : 1), u.team, byId, u.k, true); // the ego worm's armour does not soften a hero's stabs
    else hitBear(G, w, dmg, u.team, u.k, true, false, u.id);
    return w.hp <= 0 || (!H.unit && w.tameTeam !== undefined);
  };
  while (H.n < HERO.stabs.length && H.t >= HERO.stabs[H.n]) {
    H.n++;
    if (strike(HERO.stabDmg)) {
      heroEnd(G, u, w, true);
      return;
    }
  }
  if (!H.sw && H.t >= HERO.gulp) H.sw = 1;
  while (H.sw && H.m < HERO.inner.length && H.t >= HERO.inner[H.m]) {
    H.m++;
    if (strike(HERO.innerDmg)) {
      heroEnd(G, u, w, true);
      return;
    }
  }
  if (H.t >= HERO.end) heroEnd(G, u, w, false);
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
    // Heldentod: gone for good; the worm has a bellyache
    u.swal = 1;
    u.hp = 0;
    u.lh = [-8, -1, 0];
    highlight(G, 'hero', u.team, Math.round(H.dmg), x, z);
    if (mine) heroFree(w);
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
