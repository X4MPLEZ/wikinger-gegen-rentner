/* ---------- Sandworms (desert). Wild ones live under their stretch of dunes: they stalk whoever walks there, the sand trembles for one
   second (a ring shows the reach), then the worm bursts out, seizes up to four with its grabbers and swallows them. An ego is too tough:
   chewed and spat out. Out of the sand it is vulnerable for a few seconds; beaten, it joins the winner like a polar bear.
   States (wild b.ws / tamed u.ws): 0 under (wild) or on the surface (tamed), 1 tunnelling, 2 trembling, 3 strike, 4 out of the sand, 5 diving (wild). */
const WORM = {
  warn: 1.0,
  warnT: 0.7,
  warnE: 0.35,
  grabR: 3.2,
  grabRT: 2.8,
  max: 4,
  maxT: 3,
  strike: 1.9,
  grabAt: 0.3,
  gulpAt: 1.4,
  up: 4.2,
  upT: 1.1,
  dive: 0.8,
  hunt: 9.5,
  home: 16,
  speed: 6.4,
  rest: 7,
  hp: 650,
  cdT: 9,
  spit: 0.4,
  egoDist: 6.5,
  diveE: 0.55,
  tunSpeed: 9,
  tunMax: 12,
  grabRE: 4.6,
  maxE: 16,
  cdE: 7,
  biteR: 2.6,
  biteF: 2.3,
  biteDmg: 1.3,
  egoArmor: 0.6,
}; // ego: dig in, steer under the sand, burst out and swallow everyone around; the maw bites everything in front
const wildWorm = (id, p) => ({
  id,
  x: p.x,
  z: p.z,
  hx: p.x,
  hz: p.z,
  yaw: 0,
  cd: 0,
  atk: 0,
  mv: 0,
  wt: 0,
  hp: WORM.hp,
  mhp: WORM.hp,
  worm: 1,
  ws: 0,
  st: 0,
  hc: 6 + Math.random() * 5,
  gn: -1,
  bite: 0,
  warnN: 0,
});
const canBurrow = (x, z) =>
  MAP.type === 'wueste' && walkable(x, z) && !inWater(x, z) && !onBridge(MAP, x, z) && BASES.every(B => baseGap(B, x, z) > 5);
const wormEdible = u =>
  u.hp > 0 &&
  !u.air &&
  !u.pj &&
  !(u.fall > 0) &&
  !u.grab &&
  !u.bur &&
  !u.tutDummy &&
  !KINDS[u.k].worm &&
  !KINDS[u.k].bear &&
  KINDS[u.k].role !== 'siege';
const wormUp = b => (b.ws === 2 && b.st >= 0.25) || b.ws === 4 || (b.ws === 5 && b.st < 0.45) || b.ws === 6 || b.ws === 7; // a wild worm out of the sand (or swimming with its head above it): it can be hit
const wormSide = (b, z) => Math.sign(z) === Math.sign(b.hz) && Math.abs(z) > 4; // each worm keeps to its own half of the map
const bearHere = b => !!b && b.hp > 0 && (!b.worm || wormUp(b)); // bears always, worms only above the sand
/* centre of a worm's head (the maw dome, radius ~1.35) in the world – the same curves the drawn model follows when it rears out of its hole,
   strikes, dives or ploughs along with its head above the sand; null while it is under the sand. Aimed shots that hit it count as headshots */
const WORM_HEAD_R = 1.45,
  WORM_HEAD_MUL = 1.6,
  WHS_WILD = [-1, -1, 2, 2, 4, 5, 6, 7],
  WHS_UNIT = [6, -1, -1, 2, 4, 5, 7];
function wormHead(w, unit, yaw) {
  const s = (unit ? WHS_UNIT : WHS_WILD)[w.ws || 0] ?? -1,
    st = unit ? w.wst || 0 : w.st || 0;
  if (s < 0) return null;
  let h = 4.3,
    f = 1;
  if (s === 2) {
    const e = sstep(0, 0.3, st);
    h = lerp(-3.2, 5.3, e) + (st < 0.5 ? Math.sin(Math.min(1, st / 0.5) * Math.PI) * 0.7 : 0);
    f = lerp(0.2, 1.7, e);
    if (st > 0.45) {
      const r = sstep(0.45, 1.25, st) * (1 - sstep(1.45, 1.9, st));
      h += 0.9 * r;
      f -= 0.7 * r;
    }
  } else if (s === 5) {
    const q = sstep(0, 0.8, st);
    h = lerp(5, -3.5, q) + Math.sin(q * Math.PI) * 1.2;
    f = lerp(1, 6.5, q);
  } else if (s === 6) {
    h = 1.85;
    f = 1;
  } else if (s === 7) {
    const o = heroWormPose(st, st, {});
    h = o.h;
    f = o.f;
  }
  const gs = w.gs || 1;
  return {
    x: w.x + Math.sin(yaw) * f * gs,
    y: groundY(w.x, w.z) + h * gs,
    z: w.z + Math.cos(yaw) * f * gs,
    r: WORM_HEAD_R * gs * (unit && w.poss ? 1.12 : 1),
  };
}
const wormHold = W => (W.k === undefined ? -(W.id + 1) : W.id); // grab owner: wild worm (negative) or worm unit (its id)
function wormGrab(G, W, x, z, team, max, r) {
  const hc = wormHold(W),
    list = [];
  for (const u of G.units) {
    if (!wormEdible(u) || (team >= 0 && u.team === team)) continue;
    const d2 = (u.x - x) ** 2 + (u.z - z) ** 2;
    if (d2 < r * r) list.push([d2, u]);
  }
  list.sort((a, b) => a[0] - b[0]);
  const got = list.slice(0, max).map(e => e[1]);
  got.forEach((u, i) => {
    u.grab = { h: hc, s: i, t0: G.t, x: u.x, z: u.z };
    u.kb = null;
    u.down = 0;
    u.dance = 0;
    u.path = null;
    u.tgt = -1;
    u.vx = 0;
    u.vz = 0;
    u.ramQ = null;
    u.jumpT = 0;
    u.wind = null;
  });
  const src = W.k === undefined ? 'hazard' : W.poss ? 'ego' : 'ai';
  for (const u of G.units) {
    if (
      u.hp <= 0 ||
      u.grab ||
      u.air ||
      u.pj ||
      u.bur ||
      KINDS[u.k].worm ||
      KINDS[u.k].bear ||
      KINDS[u.k].role === 'siege' ||
      (team >= 0 && u.team === team)
    )
      continue; // the burst throws the rest back
    const d = Math.hypot(u.x - x, u.z - z);
    if (d < r + 1.7 && d > 0.05) knockFly(u, x, z, 2.4, undefined, undefined, 2.4, src);
  }
  return got.length;
}
function wormSwallow(G, W, byId) {
  const hc = wormHold(W),
    wild = W.k === undefined;
  let n = 0;
  for (const u of G.units) {
    const g = u.grab;
    if (!g || g.h !== hc || u.hp <= 0) continue;
    u.grab = null;
    if (u.poss) {
      // an ego is too tough to swallow: chewed and spat out
      if (wild) {
        u.hp -= maxHp(u) * WORM.spit;
        u.hurt = 2.5;
        u.lh = [-6, -1, 0];
      } else hit(G, u.id, (maxHp(u) * WORM.spit) / CFG.possArmor, W.team, byId, W.k, !!W.poss);
      if (u.hp > 0) {
        const a = (W.yaw || 0) + Math.PI + (Math.random() - 0.5) * 1.4;
        u.x = W.ex ?? W.x;
        u.z = W.ez ?? W.z;
        u.y = u.fy = unitY(u.x, u.z);
        knockFly(u, 0, 0, 5.5, Math.sin(a), Math.cos(a), 7, 'ego');
        u.spat = 1;
      } else u.swal = 1;
    } else {
      u.swal = 1;
      if (wild) {
        u.hp = 0;
        u.lh = [-6, -1, 0];
      } else {
        hit(G, u.id, u.hp * 10 + 9999, W.team, byId, W.k, !!W.poss);
        u.lh = [W.k, W.team, 0];
      }
      n++;
    }
  }
  if (n >= 3) highlight(G, 'gulp', wild ? -1 : W.team, n, W.ex ?? W.x, W.ez ?? W.z);
  return n;
}
function grabHold(G, u, byId) {
  // in the claws: no will of its own; dropped if the worm is beaten mid-meal
  const g = u.grab,
    W = g.h < 0 ? G.bears.find(b => b.id === -g.h - 1) : byId.get(g.h);
  const ok = W && W.hp > 0 && (W.k === undefined ? W.ws === 2 && W.tameTeam === undefined : W.ws === 3);
  if (u.poss) {
    const In = G.teams[u.team].posIn;
    if (In && In.id === u.id) {
      u.la = In.a;
      u.ls = In.s;
      u.lj = In.j;
      u.lg = In.g;
      u.lhx = In.h || 0;
    }
  }
  if (!ok || G.t - g.t0 > 3) {
    u.grab = null;
    u.x = g.x;
    u.z = g.z;
    u.down = Math.max(u.down || 0, 0.6);
    return;
  }
  u.x = W.ex ?? W.x;
  u.z = W.ez ?? W.z;
  u.y = u.fy = unitY(u.x, u.z);
  u.vx = 0;
  u.vz = 0;
  u.run = 0;
  u.cd = Math.max(u.cd || 0, 0.3);
}
function wormPrey(G, b) {
  const cur = b.prey ? G.units.find(u => u.id === b.prey) : null,
    ok = u => wormEdible(u) && Math.hypot(u.x - b.hx, u.z - b.hz) < WORM.home + 5 && wormSide(b, u.z) && canBurrow(u.x, u.z);
  if (cur && ok(cur) && Math.hypot(cur.x - b.x, cur.z - b.z) < WORM.hunt + 4) return cur; // keeps on the trail
  let best = null,
    bd = WORM.hunt * WORM.hunt;
  for (const u of G.units) {
    if (!ok(u)) continue;
    const d2 = (u.x - b.x) ** 2 + (u.z - b.z) ** 2;
    if (d2 < bd) {
      bd = d2;
      best = u;
    }
  }
  return best;
}
function wildWormStep(G, b, byId) {
  b.st += DT;
  b.mv = 0;
  b.cd -= DT;
  b.at = (b.at || 0) - DT;
  if (b.ws === 7) {
    if (!G.units.some(u => u.id === b.heroBy && u.hero && u.hp > 0)) heroFree(b);
    return;
  } // a hero is on it: his sequence moves it (safety: hero gone -> it dives)
  if (b.ws === 0 || b.ws === 6) {
    // roams its dunes: under the sand, or ploughing along the surface with its head up (then it can be hit); stalks prey from below
    b.hc -= DT;
    let tx = b.wx,
      tz = b.wz,
      sp = b.ws === 6 ? 2.3 : 2.6;
    if (b.ws === 6 && b.at > 2.9) b.hc = Math.min(b.hc, 1.2); // hit while swimming: it dives and comes for them
    const prey = b.hc <= 0 ? wormPrey(G, b) : null;
    if (prey && b.ws === 6) {
      b.ws = 0;
      b.st = 0;
    } // dives before the ambush
    if (prey) {
      b.prey = prey.id;
      tx = prey.x;
      tz = prey.z;
      sp = WORM.speed;
      if (Math.hypot(prey.x - b.x, prey.z - b.z) < 1.4) {
        b.ws = 1;
        b.st = 0;
        b.ex = prey.x;
        b.ez = prey.z;
        b.x = prey.x;
        b.z = prey.z;
        b.warnN = (b.warnN + 1) % 100;
        return;
      }
    } else {
      b.prey = 0;
      b.wt -= DT;
      if (b.wt <= 0 || tx === undefined || Math.hypot(tx - b.x, tz - b.z) < 1) {
        b.wt = 5 + Math.random() * 6;
        for (let k = 0; k < 12; k++) {
          const a = Math.random() * TAU,
            r = Math.random() * WORM.home * 0.75,
            x = b.hx + Math.cos(a) * r,
            z = b.hz + Math.sin(a) * r;
          if (canBurrow(x, z) && wormSide(b, z)) {
            b.wx = x;
            b.wz = z;
            break;
          }
        }
        tx = b.wx;
        tz = b.wz;
        const surf = Math.random() < 0.45;
        if (surf !== (b.ws === 6) && b.st > 2.5) {
          b.ws = surf ? 6 : 0;
          b.st = 0;
        }
      }
    } // now and then it digs along with its head above the sand
    if (tx !== undefined) {
      const dx = tx - b.x,
        dz = tz - b.z,
        d = Math.hypot(dx, dz);
      if (d > 0.2) {
        const st = Math.min(d, sp * DT),
          nx = b.x + (dx / d) * st,
          nz = b.z + (dz / d) * st;
        if (canBurrow(nx, nz) && (wormSide(b, nz) || b.prey)) {
          b.x = nx;
          b.z = nz;
          b.mv = sp > 3 ? 2 : 1;
        } else {
          b.wx = undefined;
          b.wt = 0;
        }
        b.yaw = Math.atan2(dx, dz);
      }
    }
    return;
  }
  if (b.ws === 1) {
    if (b.st >= WORM.warn) {
      b.ws = 2;
      b.st = 0;
      b.atk = (b.atk + 1) % 100;
      b.gn = -1;
      b.gulped = 0;
    }
    return;
  } // one second of trembling sand
  if (b.ws === 2) {
    // burst out, seize, swallow
    if (b.gn < 0 && b.st >= WORM.grabAt) b.gn = wormGrab(G, b, b.ex, b.ez, -1, WORM.max, WORM.grabR);
    if (b.gn >= 0 && b.st >= WORM.gulpAt && !b.gulped) {
      b.gulped = 1;
      wormSwallow(G, b, byId);
    }
    if (b.st >= WORM.strike) {
      b.ws = 4;
      b.st = 0;
      b.cd = 0.7;
    }
    return;
  }
  if (b.ws === 4) {
    // out of the sand and vulnerable: snaps at whoever comes close
    if (b.bw > 0) {
      b.bw -= DT;
      if (b.bw <= 0) {
        const v = G.units.find(o => o.id === b.bt && o.hp > 0 && !o.grab && !o.air && !o.bur);
        if (v && Math.hypot(v.x - b.x, v.z - b.z) < 4.6) {
          v.hp -= 30 * (v.poss ? CFG.possArmor : 1);
          v.hurt = 2.5;
          v.lh = [-7, -1, 0];
        }
      }
    } else {
      let tg = null,
        bd = 4.0 * 4.0;
      for (const u of G.units) {
        if (u.hp <= 0 || u.air || u.pj || u.grab || u.bur || KINDS[u.k].worm) continue;
        const d2 = (u.x - b.x) ** 2 + (u.z - b.z) ** 2;
        if (d2 < bd) {
          bd = d2;
          tg = u;
        }
      }
      if (tg) {
        b.yaw = Math.atan2(tg.x - b.x, tg.z - b.z);
        if (b.cd <= 0) {
          b.cd = 1.3;
          b.bw = 0.35;
          b.bt = tg.id;
          b.bite = (b.bite + 1) % 100;
        }
      }
    }
    if (b.st >= WORM.up && !(b.bw > 0)) {
      b.ws = 5;
      b.st = 0;
    }
    return;
  }
  if (b.ws === 5 && b.st >= WORM.dive) {
    b.ws = 0;
    b.st = 0;
    b.hc = WORM.rest;
    b.prey = 0;
  } // back into the sand, digesting
}
// tamed worms: tunnel under a target, tremble, burst out and swallow (AI on its own cooldown, the ego with its special); returns true while the sequence owns the tick
function wormTunnel(u, In) {
  // the ego worm swims under the sand wherever you steer it, never out of the dunes
  if (!Number.isFinite(In.x) || !Number.isFinite(In.z)) return;
  const dx = In.x - u.x,
    dz = In.z - u.z,
    d = Math.hypot(dx, dz);
  if (d < 0.02) return;
  const st = Math.min(d, WORM.tunSpeed * 1.35 * DT);
  let nx = u.x + (dx / d) * st,
    nz = u.z + (dz / d) * st;
  if (!canBurrow(nx, nz)) {
    if (canBurrow(nx, u.z)) nz = u.z;
    else if (canBurrow(u.x, nz)) nx = u.x;
    else return;
  } // slides along the edge of the sand
  u.x = nx;
  u.z = nz;
  u.y = u.fy = unitY(nx, nz);
}
function wormUnitStep(G, u, byId) {
  u.wcd = (u.wcd || 0) - DT;
  if (!u.ws) {
    if (u.poss || u.dance > 0) return false;
    const t = u.tgt > 0 ? byId.get(u.tgt) : null;
    if (t && u.wcd <= 0 && wormEdible(t)) {
      const d = Math.hypot(t.x - u.x, t.z - u.z);
      if (d > 2.6 && d < 16 && canBurrow(u.x, u.z) && canBurrow(t.x, t.z)) {
        u.ws = 1;
        u.wst = 0;
        u.bur = 1;
        u.wt = t.id;
        u.ex = t.x;
        u.ez = t.z;
        u.path = null;
        u.wdN = ((u.wdN || 0) + 1) % 100;
        return true;
      }
    }
    return false;
  }
  u.wst += DT;
  u.cd = Math.max(u.cd, 0.25);
  if (u.ws === 5) {
    if (u.wst >= WORM.diveE) {
      u.ws = 1;
      u.wst = 0;
      u.tunT = 0;
    }
    return true;
  } // head first into the dune
  if (u.ws === 1 && u.poss) {
    u.tunT = (u.tunT || 0) + DT;
    if (u.tunT > WORM.tunMax || !canBurrow(u.x, u.z)) {
      u.ws = 2;
      u.wst = 0;
      u.ex = u.x;
      u.ez = u.z;
      u.spcd = Math.max(u.spcd || 0, WORM.cdE);
    }
    return true;
  } // steered by its ego; out of breath after a while
  if (u.ws === 1) {
    // tunnelling: fast and out of reach
    const t = u.wt ? byId.get(u.wt) : null;
    if (t && t.hp > 0 && !t.grab && !t.air && canBurrow(t.x, t.z)) {
      u.ex = t.x;
      u.ez = t.z;
    } else if (!u.wt || u.ex === undefined) {
      u.ex = u.x;
      u.ez = u.z;
    }
    const dx = u.ex - u.x,
      dz = u.ez - u.z,
      d = Math.hypot(dx, dz),
      sp = u.poss ? 12 : KINDS[u.k].speed * 1.6;
    if (d > 0.05) {
      const st = Math.min(d, sp * DT),
        nx = u.x + (dx / d) * st,
        nz = u.z + (dz / d) * st;
      if (canBurrow(nx, nz)) {
        u.x = nx;
        u.z = nz;
        u.yaw = Math.atan2(dx, dz);
      } else {
        u.ex = u.x;
        u.ez = u.z;
      }
    }
    if (Math.hypot(u.ex - u.x, u.ez - u.z) < (u.poss ? 0.2 : 1.3) || u.wst > 4) {
      u.ws = 2;
      u.wst = 0;
      u.ex = u.x;
      u.ez = u.z;
    }
  } else if (u.ws === 2) {
    if (u.wst >= (u.poss ? WORM.warnE : WORM.warnT)) {
      u.ws = 3;
      u.wst = 0;
      u.bur = 0;
      u.gn = -1;
      u.gulped = 0;
      u.atk = (u.atk + 1) % 100;
      u.at = -5;
    }
  } else if (u.ws === 3) {
    if (u.gn < 0 && u.wst >= WORM.grabAt) {
      u.gn = wormGrab(G, u, u.ex, u.ez, u.team, u.poss ? WORM.maxE : WORM.maxT, u.poss ? WORM.grabRE : WORM.grabRT);
      if (u.poss) {
        for (const e of G.units)
          if (
            e.team !== u.team &&
            e.hp > 0 &&
            KINDS[e.k].role === 'siege' &&
            Math.hypot(e.x - u.ex, e.z - u.ez) < WORM.grabRE + KINDS[e.k].r
          )
            hit(G, e.id, 240, u.team, byId, u.k, true); // too big to swallow: crushed
        for (const b of G.bears.slice())
          if (bearHere(b) && Math.hypot(b.x - u.ex, b.z - u.ez) < WORM.grabRE + 1) hitBear(G, b, 160, u.team, u.k, true);
      }
    }
    if (u.gn >= 0 && u.wst >= WORM.gulpAt && !u.gulped) {
      u.gulped = 1;
      wormSwallow(G, u, byId);
    }
    if (u.wst >= WORM.strike) {
      u.ws = 4;
      u.wst = 0;
    }
  } else if (u.wst >= (u.poss ? 0.25 : WORM.upT)) {
    u.ws = 0;
    u.wst = 0;
    u.wcd = WORM.cdT;
    delete u.ex;
    delete u.ez;
  }
  return true;
}
function tameBearStep(G, b) {
  b.tameT = Math.min(BEAR_TAME, b.tameT + DT);
  if (b.tameT < BEAR_TAME) return;
  const team = b.tameTeam,
    k = KINDS.findIndex(K => (b.worm ? K.worm : K.bear) && K.fac === G.teams[team].fac);
  const p = walkable(b.x, b.z) ? b : nearestWalkable(MAP, b.x, b.z);
  G.units.push({
    id: G.nextId++,
    k,
    team,
    x: p.x,
    z: p.z,
    y: unitY(p.x, p.z),
    hp: KINDS[k].hp,
    cd: 0.6,
    tgt: -1,
    at: 0,
    atk: 0,
    sp: 0,
    run: 0,
    re: 0,
    ord: { x: p.x, z: p.z, mv: false },
    path: null,
    losT: 0,
    los: true,
    repath: 0,
    poss: false,
    rage: 0,
    spcd: 0,
    yaw: b.yaw,
  });
  b.tameDone = true;
  G.bevS = ((G.bevS || 0) + 1) % 10000;
  if (G.st) G.st[team].bears++;
  (G.bev || (G.bev = [])).push([G.bevS, team, Math.round(p.x * 10), Math.round(p.z * 10), b.worm ? 1 : 0]);
  if (G.bev.length > 6) G.bev.shift();
  if (MAP.type === 'arktis' || b.worm) (G.bearQ || (G.bearQ = [])).push(85 + Math.random() * 35);
}
function bearKillAt(G, x, z, r, team) {
  for (const b of G.bears.slice()) if (Math.hypot(b.x - x, b.z - z) < r) hitBear(G, b, b.worm ? 260 : 99999, team, -1);
}
const PAD_FLY = 1.75,
  PAD_CD = 1.4,
  PAD_W = 3.15,
  PAD_D = 2.4,
  PAD_H = 10,
  PAD_ARM = 0.35,
  SIEGE_WIND = 0.6;
function padLocal(pd, x, z) {
  const dx = pd.tx - pd.x,
    dz = pd.tz - pd.z,
    d = Math.hypot(dx, dz) || 1,
    fx = dx / d,
    fz = dz / d,
    rx = x - pd.x,
    rz = z - pd.z;
  return { al: rx * fx + rz * fz, ac: rx * fz - rz * fx, fx, fz };
}
const onPad = (pd, x, z) => {
  const l = padLocal(pd, x, z);
  return Math.abs(l.al) < PAD_D && Math.abs(l.ac) < PAD_W;
};
function padHeight(j, k) {
  return lerp(unitY(j.sx, j.sz), unitY(j.tx, j.tz), k) + 4 * PAD_H * k * (1 - k);
}
function padFlight(pd, u) {
  const l = padLocal(pd, u.x, u.z),
    spread = clamp(l.ac, -PAD_W + 0.4, PAD_W - 0.4);
  const q = nearestWalkable(MAP, pd.tx + l.fz * spread, pd.tz - l.fx * spread);
  return { sx: u.x, sz: u.z, tx: q.x, tz: q.z, t: 0 };
}
function padStep(G) {
  const PS = G.padSt || (G.padSt = MAP.pads.map(() => ({ cd: 0, arm: 0, n: 0 })));
  for (const u of G.units) {
    u.padCd = Math.max(0, (u.padCd || 0) - DT);
    if (!u.pj) continue;
    const j = u.pj;
    j.t = Math.min(PAD_FLY, j.t + DT);
    const k = j.t / PAD_FLY;
    u.x = lerp(j.sx, j.tx, k);
    u.z = lerp(j.sz, j.tz, k);
    u.y = u.fy = padHeight(j, k);
    u.vx = 0;
    u.vz = 0;
    u.jumpT = Math.max(0.01, PAD_FLY - j.t);
    if (k >= 1) {
      u.pj = null;
      u.jumpT = 0;
      u.padCd = 0.8;
      delete u.navPad;
      delete u.consumePad;
      u.path = null;
      u.repath = 0;
      u.losT = 0;
      u.forcePath = 0;
      u.stuckT = 0;
      u.tgt = -1;
      u.re = 0;
      u._ix = u.x;
      u._iz = u.z;
      u.ivx = 0;
      u.ivz = 0;
      // Discard stale pre-flight positional input, retain action counters.
      const input = G.teams[u.team].posIn;
      if (u.poss && input && input.id === u.id) G.teams[u.team].posIn = { ...input, x: u.x, z: u.z };
    }
  }
  MAP.pads.forEach((pd, i) => {
    const st = PS[i];
    st.cd = Math.max(0, st.cd - DT);
    if (st.cd > 0) return;
    const on = G.units.filter(
      u =>
        !u.pj &&
        !(u.fall > 0) &&
        u.hp > 0 &&
        !(u.padCd > 0) &&
        !u.grab &&
        !u.bur &&
        !KINDS[u.k].worm &&
        KINDS[u.k].role !== 'siege' &&
        onPad(pd, u.x, u.z)
    );
    if (!on.length) {
      st.arm = 0;
      return;
    }
    st.arm += DT;
    if (st.arm < PAD_ARM) return;
    st.arm = 0;
    st.cd = PAD_CD;
    st.n = (st.n + 1) % 100;
    for (const u of on) {
      u.pj = padFlight(pd, u);
      u.padAck = u.pj.ack = Math.round(G.t * 100);
      u.jumpT = PAD_FLY;
      u.kb = null;
      u.down = 0;
      u.dance = 0;
      u.path = null;
      u.vx = 0;
      u.vz = 0;
      // Only a command aimed at this pad is consumed. Farther orders survive.
      if (u.ord && (u.consumePad === i || onPad(pd, u.ord.x, u.ord.z))) u.ord = { x: u.pj.tx, z: u.pj.tz, mv: false };
    }
  });
}
// Catapult shells smash ice: a permanent hole sized to the shot. Whoever stands on it breaks through.
function iceImpact(G, x, z, r, team) {
  const cell = cellOf(x, z);
  if (cell < 0 || !MAP.ice || !MAP.ice[cell] || G.tut) return 0;
  if (!G.holes) G.holes = [];
  MAP.holes = G.holes;
  const dup = G.holes.some(h => (h.x - x) ** 2 + (h.z - z) ** 2 < (h.r * 0.55) ** 2 && h.r >= r * 0.8);
  if (!dup) {
    G.holeS = (G.holeS || 0) + 1;
    G.holes.push({ id: G.holeS, x, z, r, cell, team });
    const hg = MAP.holeGrid || (MAP.holeGrid = new Uint8Array(GW * GH)),
      rr = r + 0.35,
      i0 = Math.floor((x - rr + HALF_W) / CELL),
      i1 = Math.floor((x + rr + HALF_W) / CELL),
      j0 = Math.floor((z - rr + HALF_H) / CELL),
      j1 = Math.floor((z + rr + HALF_H) / CELL);
    for (let j = Math.max(0, j0); j <= Math.min(GH - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(GW - 1, i1); i++) {
        const c = j * GW + i,
          p = cellCenter(c);
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < rr * rr) hg[c] = 1;
      }
    if (G.st && team >= 0) G.st[team].holes++;
  }
  let n = 0;
  for (const u of G.units) {
    if (u.hp <= 0 || u.pj || u.air || (u.x - x) ** 2 + (u.z - z) ** 2 > r * r) continue;
    if (KINDS[u.k].role === 'siege') {
      u.hp -= maxHp(u) * 0.35;
      u.hurt = 2.5;
      continue;
    }
    u.down = Math.max(u.down || 0, 1.1);
    u.kb = null;
    u.dance = 0;
    u.cold = 5;
    u.inHole = 1;
    u.hp -= maxHp(u) * (u.poss ? 0.1 : 0.2);
    u.hurt = 2.5;
    u.path = null;
    if (team >= 0 && u.team !== team) n++;
  }
  if (n >= 3) highlight(G, 'ice', team, n, x, z);
  return n;
}
function iceVelocity(u, vx, vz, dt) {
  if (!onIce(u.x, u.z) || holeAt(u.x, u.z)) {
    u.ivx = vx;
    u.ivz = vz;
    return;
  }
  let ix = u.ivx ?? vx,
    iz = u.ivz ?? vz;
  const wanted = Math.hypot(vx, vz),
    current = Math.hypot(ix, iz);
  if (wanted > 0.001) {
    const speed = lerp(current, wanted * 1.5, 1 - Math.exp(-dt * 9));
    const angle = current > 0.001 ? Math.atan2(ix, iz) : Math.atan2(vx, vz);
    const turn = clamp(angDiff(Math.atan2(vx, vz), angle), -dt * 3.2, dt * 3.2);
    ix = Math.sin(angle + turn) * speed;
    iz = Math.cos(angle + turn) * speed;
  } else {
    const friction = Math.exp(-dt * 1.05);
    ix *= friction;
    iz *= friction;
  }
  u.ivx = ix;
  u.ivz = iz;
}
function iceStep(G) {
  MAP.holes = G.holes || (G.holes = []);
  for (const u of G.units) {
    if (u.hp <= 0 || u.fall > 0 || u.pj) continue;
    const K = KINDS[u.k];
    const mx = u.x - (u._ix ?? u.x),
      mz = u.z - (u._iz ?? u.z),
      sp = Math.hypot(mx, mz) / DT;
    u._ix = u.x;
    u._iz = u.z;
    if (u.slipT > 0) u.slipT -= DT;
    if (K.role === 'siege') {
      u.cold = 0;
      continue;
    }
    const hole = holeAt(u.x, u.z),
      arm = u.poss ? CFG.possArmor : 1;
    if (hole) {
      u.cold = 5;
      u.inHole = 1;
      u.hp -= 11 * DT * arm;
      u.hurt = 2.5;
      continue;
    }
    u.inHole = 0;
    if (u.cold > 0) {
      u.cold -= DT;
      u.hp -= 6 * DT * arm;
      u.hurt = Math.max(u.hurt || 0, 0.5);
    }
  }
}
