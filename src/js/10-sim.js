/* 10-sim.js - SIMULATION core (runs on the host / in single player only; a guest just draws snapshots). newGame() builds the state G,
   applyCmd() takes every player and AI command, hit()/knockFly() deal damage and knock-backs, possStep() moves the ego warrior from its
   inputs (counters a,s,j,g,h). The per-tick loop is step() in 14-sim-step.js. A guest never runs this: what it must see goes into snapOf(). */
function newGame(facs, seed, chaos, opts = {}) {
  setMap(genMap(seed));
  MAP.holeGrid = new Uint8Array(GW * GH);
  MAP.holes = [];
  const G = {
    t: 0,
    cd: 3,
    seed,
    nextId: 1,
    over: -1,
    ai: aiNew('medium'),
    astarBudget: 0,
    towerOff: [false, false],
    towerMul: [1, 1],
    chaos: !!chaos,
    fog: !!opts.fog,
    offerN: 0,
    nextOffer: 0.3,
    pz: 0,
    fb: [],
    fbId: 0,
    fp: [],
    fpId: 0,
    teams: [0, 1].map(i => ({
      pk: {},
      offer: null,
      offerDl: 0,
      pkN: 0,
      lastPk: null,
      fireT: 0,
      hq: [],
      hqS: 0,
      autoI: 0,
      fac: facs[i],
      gold: CFG.startGold,
      q: [],
      qt: 0,
      rally: rallyDefault(i),
      hp: CFG.baseHp,
      tcd: 1,
      tatk: 0,
      ttgt: -1,
      kills: 0,
      maxFlags: 0,
      auto: {},
      pos: null,
      posIn: null,
      rush: 0,
      rushAt: [0, 0],
      incMul: 1,
    })),
    units: [],
    flags: FLAGS.map(() => ({ owner: -1, p: 0 })),
    proj: [],
    items: [],
    itemT: 22,
    itemId: 0,
    pe: [],
    peS: 0,
    bears: (MAP.bears || []).map((b, i) =>
      b.worm
        ? wildWorm(i, b)
        : { id: i, x: b.x, z: b.z, hx: b.x, hz: b.z, yaw: 0, cd: 0, atk: 0, mv: 0, wt: Math.random() * 3, hp: 520, mhp: 520 }
    ),
  };
  G.st = [0, 1].map(() => ({
    made: 0,
    lost: 0,
    baseDmg: 0,
    flagT: 0,
    leadT: 0,
    rams: 0,
    cliff: 0,
    bears: 0,
    cats: 0,
    holes: 0,
    egoKills: 0,
  }));
  G.hl = [];
  G.hlS = 0;
  G.phase = 0;
  G.rolls = [];
  G.goo = [];
  G.rollId = 0;
  G.gooId = 0;
  if (opts.squad !== false)
    for (let i = 0; i < 2; i++) {
      const ks = FAC[facs[i]].kinds;
      [ks[0], ks[0], ks[1]].forEach(k => spawnUnit(G, i, k));
    }
  return G;
}
// Escalation: after 7 minutes the "storm" begins (bases take more damage, no home advantage), after 9.5 the final battle, at 12 the bases crumble.
const phaseOf = G => (G.tut ? 0 : G.t >= CFG.phaseT[1] ? 2 : G.t >= CFG.phaseT[0] ? 1 : 0);
function highlight(G, ty, team, n, x, z) {
  G.hlS = (G.hlS + 1) % 10000;
  G.hl.push([G.hlS, ty, team, n, Math.round(x * 10), Math.round(z * 10)]);
  if (G.hl.length > 8) G.hl.shift();
}
function rallyDefault(team) {
  const B = BASES[team];
  if (!FLAGS || !FLAGS.length) return frontOf(team, 12);
  const f = FLAGS.slice().sort((a, b) => Math.hypot(a.x - B.x, a.z - B.z) - Math.hypot(b.x - B.x, b.z - B.z))[0],
    dx = B.x - f.x,
    dz = B.z - f.z,
    d = Math.hypot(dx, dz) || 1;
  return nearestWalkable(MAP, f.x + (dx / d) * 3.2 - (dz / d) * 1.4, f.z + (dz / d) * 3.2 + (dx / d) * 1.4);
}
function frontOf(team, d) {
  const b = BASES[team];
  return nearestWalkable(MAP, b.x, b.z + (team ? d : -d));
}
const clampX = x => clamp(x, -HALF_W + 0.5, HALF_W - 0.5);
const clampZ = z => clamp(z, -HALF_H + 0.5, HALF_H - 0.5);
const sigeOf = (G, team) =>
  G.units.filter(u => u.team === team && KINDS[u.k].role === 'siege').length +
  G.teams[team].q.filter(q => KINDS[q].role === 'siege').length;
const popOf = (G, team) => G.units.reduce((n, u) => n + (u.team === team), 0) + G.teams[team].q.length;
const flagsOf = (G, team) => G.flags.reduce((n, f) => n + (f.owner === team), 0);
function slotOffsets(n) {
  const out = [[0, 0]];
  for (let ring = 1; out.length < n; ring++) {
    const cnt = ring * 6;
    for (let i = 0; i < cnt && out.length < n; i++) {
      const a = (i / cnt) * TAU + ring;
      out.push([Math.cos(a) * ring * 1.6, Math.sin(a) * ring * 1.6]);
    }
  }
  return out;
}
function formation(us, x, z, mv, target) {
  us.sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2));
  const off = slotOffsets(us.length),
    padOrder = (MAP.pads || []).findIndex(pd => onPad(pd, x, z)),
    baseUsed = [];
  us.forEach((u, i) => {
    let p;
    delete u.consumePad;
    delete u.baseSlot;
    if (target === -2 && !mv) {
      p = baseApproach(u, baseUsed);
      baseUsed.push(p);
      u.baseSlot = p;
    } else if (padOrder >= 0 && KINDS[u.k].role !== 'siege') {
      const pd = MAP.pads[padOrder],
        l = padLocal(pd, pd.x, pd.z),
        side = ((i % 5) - 2) * 0.9,
        depth = ((((i / 5) | 0) % 3) - 1) * 0.9;
      p = nearestWalkable(MAP, pd.x + l.fz * side + l.fx * depth, pd.z - l.fx * side + l.fz * depth);
      u.consumePad = padOrder;
    } else p = nearestWalkable(MAP, clampX(x + off[i][0]), clampZ(z + off[i][1]));
    delete u.navPad;
    u.ord = { x: p.x, z: p.z, mv: !!mv, ...(target !== undefined && !mv ? { target } : {}) };
    u.tgt = target !== undefined && !mv ? target : -1;
    u.re = 0;
    u.path = null;
    u.repath = 0;
    u.forcePath = 0;
    u.losT = 0;
  });
}
// the team remembers when its ego's special and grenade are ready again, so taking over the next warrior does not reset them
function egoCooldownsKeep(G, T, o) {
  T.spAt = G.t + Math.max(0, o.spcd || 0);
  T.gAt = G.t + Math.max(0, o.gcd || 0);
}
function applyCmd(G, team, c) {
  if (!c || G.over >= 0) return;
  const T = G.teams[team];
  if (c.t === 'spawn') {
    const k = c.k | 0,
      K = KINDS[k];
    if (
      K &&
      K.role === 'siege' &&
      G.units.filter(u => u.team === team && KINDS[u.k].role === 'siege').length + T.q.filter(q => KINDS[q].role === 'siege').length >=
        CFG.siegeMax
    )
      return;
    if (
      !K ||
      K.fac !== T.fac ||
      !FAC[T.fac].kinds.includes(k) ||
      T.q.length >= CFG.queueMax ||
      T.gold < K.cost ||
      popOf(G, team) >= CFG.pop
    )
      return;
    T.gold -= K.cost;
    if (c.auto) T.q.push(k);
    else {
      const qm = clamp(T.qm || 0, 0, T.q.length);
      T.q.splice(qm, 0, k);
      T.qm = qm + 1;
    }
  } else if (c.t === 'auto') {
    const k = c.k | 0,
      K = KINDS[k];
    if (!K || K.fac !== T.fac) return;
    T.auto[k] = !!c.on;
    if (!c.on) {
      // switching AUTO off returns the money of auto units that have not started yet
      const qm = clamp(T.qm || 0, 0, T.q.length);
      for (let j = T.q.length - 1; j >= qm; j--)
        if (T.q[j] === k && !(j === 0 && T.qt > 0)) {
          T.q.splice(j, 1);
          T.gold += K.cost;
        }
    }
  } else if (c.t === 'order') {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Array.isArray(c.ids)) return;
    const ids = new Set(c.ids.slice(0, 80));
    const us = G.units.filter(u => u.team === team && ids.has(u.id) && !u.poss);
    let target;
    if (c.m !== 1) {
      const enemyBase = BASES[1 - team];
      if (c.target === -2 || (c.target === undefined && baseGap(enemyBase, c.x, c.z) < 0.9)) target = -2;
      else if (Number.isInteger(c.target) && c.target > 0 && G.units.some(u => u.id === c.target && u.team !== team && u.hp > 0))
        target = c.target;
    }
    if (us.length) formation(us, c.x, c.z, c.m === 1, target);
  } else if (c.t === 'perk') {
    if (!T.offer || !T.offer.includes(c.id)) return;
    pickPerk(G, T, c.id);
  } else if (c.t === 'rally') {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) return;
    T.rally = nearestWalkable(MAP, clampX(c.x), clampZ(c.z));
  } else if (c.t === 'poss') {
    const u = G.units.find(v => v.id === c.id && v.team === team);
    // not a fallen warrior, not one that falls off the map, not a worm the enemy hero is riding
    if (!u || u.hp <= 0 || u.fall > 0 || u.heroBy) return;
    if (T.pos) {
      const o = G.units.find(v => v.id === T.pos);
      if (o && o !== u && (o.dance > 0 || o.hero)) return; // the dance and the hero lock hold for switching, too (like 'unposs')
      if (o) {
        egoCooldownsKeep(G, T, o);
        setPoss(o, false);
      }
    }
    setPoss(u, true);
    if (!u.pj) u.padAck = 0;
    if (!u.air) u.airAck = 0;
    delete u.navPad;
    u.kb = null;
    u.down = 0;
    u.chick = 0;
    u.la = undefined; // the input counters start fresh with every takeover (the client restarts at 0), so no old press fires again
    u.ls = undefined;
    u.lj = undefined;
    u.lg = undefined;
    u.lhx = undefined;
    u.spcd = Math.max(0, (T.spAt || 0) - G.t); // the special and grenade cooldowns belong to the team: switching warriors does not reset them
    u.gcd = Math.max(0, (T.gAt || 0) - G.t);
    u.rage = 0;
    u.yaw = 0;
    T.pos = u.id;
    T.posIn = null;
  } else if (c.t === 'unposs') {
    {
      const o = T.pos && G.units.find(v => v.id === T.pos);
      if (o && (o.dance > 0 || o.hero)) return;
    } // no way out while dancing or playing the hero
    if (T.pos) {
      const o = G.units.find(v => v.id === T.pos);
      if (o) {
        egoCooldownsKeep(G, T, o);
        setPoss(o, false);
        o.ord = { x: o.x, z: o.z, mv: false };
        o.path = null;
      }
    }
    T.pos = null;
    T.posIn = null;
  }
}
// AUTO keeps exactly one waiting unit per enabled type behind the manual orders.
// Several AUTO types take turns; an unaffordable type is waited for, so cheap units never starve an expensive one.
function autoQueue(G, team, T, en) {
  const qm = clamp(T.qm || 0, 0, T.q.length),
    tail = T.q.slice(qm);
  for (let n = 0; n < en.length; n++) {
    const k = en[(T.autoI + n) % en.length],
      K = KINDS[k];
    if (tail.includes(k)) continue;
    if (K.role === 'siege' && sigeOf(G, team) >= CFG.siegeMax) continue;
    if (T.q.length >= CFG.queueMax || popOf(G, team) >= CFG.pop || T.gold < K.cost) return;
    applyCmd(G, team, { t: 'spawn', k, auto: true });
    T.autoI = (T.autoI + n + 1) % 1000;
    return;
  }
}
function pickPerk(G, T, id) {
  if (T.pk[id]) return;
  T.pk[id] = 1;
  T.offer = null;
  T.pkN = (T.pkN + 1) % 100;
  T.lastPk = id;
  if (id === 'giant') {
    const ti = G.teams.indexOf(T);
    for (const u of G.units) if (u.team === ti && !u.gs) makeGiant(u);
  }
}
function makeGiant(u) {
  const K = KINDS[u.k];
  u.gs = 1.3;
  if (u.poss) {
    u.mhp *= 1.2;
    u.hp *= 1.2;
  } else {
    u.mhp = K.hp * 1.2;
    u.hp = Math.min(u.mhp, u.hp * 1.2);
  }
}
// Two cards. Offer 1: common and rare only; offers 2-3: up to epic; from offer 4: everything. The side that is behind (fewer flags, or a
// clearly weaker base) draws epic and legendary cards twice as often – a comeback chance that both see (snapshot: ou).
function makeOffer(G, T) {
  const team = G.teams.indexOf(T),
    maxT = G.offerN <= 1 ? 1 : G.offerN <= 3 ? 2 : 3,
    other = G.teams[1 - team],
    behind = flagsOf(G, team) < flagsOf(G, 1 - team) || T.hp < other.hp - 200,
    w = id => TIERS[PERKS[id].t].w * (behind && PERKS[id].t >= 2 ? 2 : 1),
    pool = PERK_IDS.filter(id => !T.pk[id] && (!PERKS[id].f || PERKS[id].f === T.fac) && PERKS[id].t <= maxT),
    o = [];
  T.offerUp = behind ? 1 : 0;
  while (o.length < 2 && pool.length) {
    let tot = 0;
    pool.forEach(id => (tot += w(id)));
    let r = Math.random() * tot,
      i = 0;
    for (; i < pool.length - 1; i++) {
      r -= w(pool[i]);
      if (r <= 0) break;
    }
    o.push(pool.splice(i, 1)[0]);
  }
  T.offer = o.length ? o : null;
}
function perkPause(G) {
  G.pz -= DT;
  if (!G.teams[0].offer && !G.teams[1].offer) G.pz = Math.min(G.pz, 0.6);
  if (G.pz <= 0) {
    G.pz = 0;
    for (const T of G.teams) if (T.offer) pickPerk(G, T, T.offer[0]);
  }
}
function fireball(G, team, x, z, lvl, r, dm, fi) {
  G.fbId = (G.fbId + 1) % 1000;
  G.fb.push({ id: G.fbId, x, z, t: 1.4, team, lvl, r, dm, fi });
}
function perkStep(G) {
  if (!G.chaos) return;
  if (G.t >= G.nextOffer && G.offerN < PERK_MAX) {
    G.offerN++;
    G.nextOffer += PERK_EVERY;
    let any = false;
    for (const T of G.teams) {
      makeOffer(G, T);
      if (T.offer) any = true;
    }
    if (any) G.pz = PERK_TIME;
  }
  for (let i = 0; i < 2; i++) {
    const T = G.teams[i];
    if (pkL(G, i, 'fire')) {
      T.fireT += DT;
      if (T.fireT >= 10) {
        const tg = G.flags.map((f, fi) => fi).filter(fi => G.flags[fi].owner === 1 - i);
        if (tg.length) {
          T.fireT = 0;
          const fi = tg[Math.floor(Math.random() * tg.length)],
            F = FLAGS[fi];
          fireball(G, i, F.x + (Math.random() - 0.5) * 3, F.z + (Math.random() - 0.5) * 3, 3, 8, 70, fi);
        } else T.fireT = 10;
      }
    }
    if (pkL(G, i, 'meteor')) {
      T.metT = (T.metT || 0) + DT;
      if (T.metT >= 30) {
        const foes = G.units.filter(u => u.team !== i);
        if (foes.length) {
          T.metT = 0;
          for (let k = 0; k < 6; k++) {
            const e = foes[Math.floor(Math.random() * foes.length)];
            fireball(G, i, e.x + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 4, 1, 3.5, 45, -1);
          }
        } else T.metT = 30;
      }
    }
    if (pkL(G, i, 'quake')) {
      // the ground shakes under the biggest group of enemies: everyone there is knocked over
      T.qkT = (T.qkT || 0) + DT;
      if (T.qkT >= 22) {
        const foes = G.units.filter(u => u.team !== i && u.hp > 0 && !KINDS[u.k].worm);
        let best = null,
          bn = 0;
        for (const a of foes) {
          let n = 0;
          for (const b of foes) if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 < 100) n++;
          if (n > bn) {
            bn = n;
            best = a;
          }
        }
        if (best && bn >= 2) {
          T.qkT = 0;
          const cx = best.x,
            cz = best.z,
            byId = new Map(G.units.map(u => [u.id, u]));
          let n = 0;
          for (const e of foes)
            if ((e.x - cx) ** 2 + (e.z - cz) ** 2 < 100) {
              hit(G, e.id, 42, i, byId, -1);
              if (KINDS[e.k].role !== 'siege' && knockFly(e, cx, cz, 3.2, undefined, undefined, 2.6, 'hazard')) e.kbTeam = i;
              n++;
            }
          highlight(G, 'quake', i, n, cx, cz);
        } else T.qkT = 22;
      }
    }
    if (T.revQ && T.revQ.length && T.revQ[0][0] <= G.t) spawnUnit(G, i, T.revQ.shift()[1]); // Unkraut vergeht nicht
    if (pkL(G, i, 'catapult')) {
      T.catT = (T.catT || 0) + DT;
      if (T.catT >= 30) {
        T.catT = 0;
        if (G.units.filter(u => u.team === i && KINDS[u.k].role === 'siege').length < 3) spawnUnit(G, i, T.fac === 'viking' ? 6 : 7);
      }
    }
  }
  const byId = G.unitIndex || (G.unitIndex = new Map());
  byId.clear();
  for (const u of G.units) byId.set(u.id, u);
  for (const u of G.units) {
    if (u.chick > 0) u.chick -= DT;
    if (u.bite > 0) {
      u.bite -= DT;
      hit(G, u.id, 10 * DT, u.biteT, byId, -1);
    }
  }
  for (let i = 0; i < 2; i++)
    if (pkL(G, i, 'chicken')) {
      const T = G.teams[i];
      T.chT = (T.chT || 0) + DT;
      if (T.chT >= 12) {
        const foes = G.units.filter(u => u.team !== i && KINDS[u.k].role !== 'siege' && !u.poss && !(u.chick > 0));
        if (foes.length) {
          T.chT = 0;
          for (let n = 0; n < 4 && foes.length; n++) foes.splice(Math.floor(Math.random() * foes.length), 1)[0].chick = 8;
        } else T.chT = 12;
      }
    }
  for (const b of G.fb) {
    b.t -= DT;
    if (b.t <= 0) {
      for (const e of G.units)
        if (e.team !== b.team && (e.x - b.x) ** 2 + (e.z - b.z) ** 2 < b.r * b.r) hit(G, e.id, b.dm, b.team, byId, -1);
      const f = b.fi >= 0 && G.flags[b.fi];
      if (f) {
        const k = 0.6;
        f.p = f.p > 0 ? Math.max(0, f.p - k) : Math.min(0, f.p + k);
        if (f.owner === 0 && f.p <= 0) f.owner = -1;
        if (f.owner === 1 && f.p >= 0) f.owner = -1;
      }
    }
  }
  G.fb = G.fb.filter(b => b.t > 0);
}
function buildTime(G, team, k) {
  return KINDS[k].build * pk(G, team, 'fast', [1, 0.5]);
}
// Flags pay. No hidden gifts for the trailing side: comebacks come from home advantage, flag decay and bounties.
function incomeOf(G, team) {
  const grow = G.tut ? 0 : Math.min(CFG.incGrowMax, (CFG.incGrow * G.t) / 60);
  let fl = 0;
  G.flags.forEach((f, i) => {
    if (f.owner === team) fl += flagSide(i) === 1 - team && !G.tut ? CFG.flagIncDeep : CFG.flagInc;
  }); // flags deep in enemy land pay less
  const under = G.ev && G.ev.cur === EV_UNDERDOG ? clamp((CFG.underPop - popOf(G, team)) * CFG.underGold, 0, 9) : 0; // small army, big pay: the fewer warriors, the more gold per second
  return (CFG.baseInc + grow + fl) * G.teams[team].incMul * pk(G, team, 'gold', [1, 1.2]) + under;
}
function flagSide(i) {
  const F = FLAGS[i],
    d0 = Math.hypot(F.x - BASES[0].x, F.z - BASES[0].z),
    d1 = Math.hypot(F.x - BASES[1].x, F.z - BASES[1].z);
  return Math.abs(d0 - d1) < 6 ? -1 : d0 < d1 ? 0 : 1;
}
function spawnUnit(G, team, k) {
  const T = G.teams[team],
    f = frontOf(team, 8),
    a = Math.random() * TAU,
    rr = Math.random() * 2.5;
  const o = nearestWalkable(MAP, clampX(T.rally.x + Math.cos(a) * rr), clampZ(T.rally.z + Math.sin(a) * rr));
  let sp = null;
  const B = BASES[team],
    near = G.units.filter(e => e.team !== team && (e.x - B.x) ** 2 + (e.z - B.z) ** 2 < 26 * 26);
  if (near.length) {
    let best = -1;
    for (let a2 = 0; a2 < 16; a2++) {
      const ang = (a2 / 16) * TAU,
        c = nearestWalkable(MAP, clampX(B.x + Math.sin(ang) * 8), clampZ(B.z + Math.cos(ang) * 8));
      if (Math.hypot(c.x - B.x, c.z - B.z) > 11) continue;
      let md = 1e9;
      for (const e of near) md = Math.min(md, Math.hypot(e.x - c.x, e.z - c.z));
      if (md > best) {
        best = md;
        sp = c;
      }
    }
  }
  if (!sp) sp = nearestWalkable(MAP, f.x + (Math.random() - 0.5) * 3, f.z + (Math.random() - 0.5) * 2);
  if (G.st) G.st[team].made++;
  G.units.push({
    id: G.nextId++,
    k,
    team,
    x: sp.x,
    z: sp.z,
    y: unitY(sp.x, sp.z),
    hp: KINDS[k].hp,
    cd: 0.4,
    tgt: -1,
    at: 0,
    atk: 0,
    sp: 0,
    run: 0,
    re: Math.random() * 0.3,
    ord: near.length >= 3 && !G.tut ? { x: sp.x, z: sp.z, mv: false } : { x: o.x, z: o.z, mv: false },
    path: null,
    losT: 0,
    los: true,
    repath: 0,
    poss: false,
    rage: 0,
    spcd: 0,
    yaw: 0,
  });
  if (pkL(G, team, 'giant')) makeGiant(G.units[G.units.length - 1]);
}
// Desert: open sight lines, ranged units and catapults shoot farther.
const desertRange = K => (MAP && MAP.type === 'wueste' ? (K.role === 'ranged' ? 1.5 : K.role === 'siege' ? 3 : 0) : 0);
const isCounter = (attK, defK) => BEATS[KINDS[attK].role] === KINDS[defK].role || dmgMult(attK, defK) > 1;
function dmgMult(attK, defK) {
  if (KINDS[attK].worm) return KINDS[defK].role === 'siege' ? 1.4 : 1.2;
  if (KINDS[defK].worm) return KINDS[attK].role === 'ranged' ? 1.5 : 1;
  if (KINDS[attK].bear) return KINDS[defK].role === 'ranged' ? 0.6 : 1.7;
  if (KINDS[defK].bear && KINDS[attK].role === 'ranged') return 2.4;
  if (KINDS[attK].role === 'cav' && KINDS[defK].role === 'siege') return 6;
  return BEATS[KINDS[attK].role] === KINDS[defK].role ? MULT[KINDS[attK].role] : 1;
}
function hit(G, tgt, dmg, team, byId, attK, bp, head) {
  if (tgt === -2) {
    const bd =
      dmg * CFG.phaseBase[G.phase || 0] * ((attK >= 0 && KINDS[attK].role === 'siege') || G.tut || (G.phase || 0) >= 2 ? 1 : CFG.baseArmor);
    /* walls: only catapults hit bases at full force (until the final battle) */ G.teams[1 - team].hp -= bd;
    if (G.st) G.st[team].baseDmg += bd;
    return;
  }
  const e = byId.get(tgt);
  if (!e || e.hp <= 0 || e.bur || e.grab || (e.tutDummy && !bp)) return;
  let d = attK >= 0 ? dmg * dmgMult(attK, e.k) : dmg;
  if (e.poss) d *= CFG.possArmor * (KINDS[e.k].worm ? WORM.egoArmor : 1);
  if (inHome(G, e)) d *= CFG.homeArmor; // home advantage
  if (bp && attK >= 0 && !e.poss && !KINDS[e.k].worm) {
    // possessed attacker: hard counters (not against a sandworm: far too big for that)
    const ar = KINDS[attK].role,
      dr = KINDS[e.k].role,
      mh = maxHp(e);
    if (BEATS[ar] === dr && (ar !== 'ranged' || head))
      d = Math.max(d, mh * 0.7); // controlled counter: two clean hits, not one
    else if (ar === 'ranged' && dr === 'cav') d = Math.max(d, mh * (head ? 0.62 : 0.4));
  }
  if (G.chaos) {
    const rg = attK >= 0 && KINDS[attK].role === 'ranged';
    if (rg) d *= pk(G, team, 'arrows', [1, 1.6]);
    if (bp) d *= pk(G, team, 'bighead', [1, 1.4]);
    if (attK >= 0 && KINDS[attK].role === 'cav') d *= pk(G, team, 'cavspd', [1, 1.25]);
    if (e.poss && rg) d *= pk(G, e.team, 'bighead', [1, 2]);
    if (attK >= 0) d *= pk(G, team, 'giant', [1, 1.1]);
    d *= pk(G, e.team, 'armor', [1, 0.82]);
    if (attK >= 0 && KINDS[attK].role === 'melee' && pkL(G, team, 'berserk')) d *= 2;
    if (KINDS[e.k].role === 'melee' && pkL(G, e.team, 'berserk') && (bp || (attK >= 0 && KINDS[attK].role === 'ranged'))) d *= 1.25;
    if (e.k === 4 && pkL(G, e.team, 'stampede')) d *= 0.75;
    if (KINDS[e.k].role === 'melee' && pkL(G, e.team, 'wall') && attK >= 0 && (rg || KINDS[attK].role === 'siege')) d *= 0.5;
  }
  if (attK >= 0 && KINDS[attK].role === 'siege') {
    if (e.poss) d *= 2.2;
    if (KINDS[e.k].role === 'ranged') d *= 1.6;
  }
  if (attK >= 0 && KINDS[attK].role === 'ranged' && KINDS[e.k].role === 'siege') d *= 1.25;
  e.hp -= d;
  e.hurt = 2.5;
  e.lh = [attK, team, head ? 1 : 0];
  if (attK === 3 && e.hp > 0 && !KINDS[e.k].bear && !KINDS[e.k].worm) e.slowT = 1.5;
  counterHit(G, e, attK, team, bp);
  if (attK === 3 && G.chaos && pkL(G, team, 'bite')) {
    e.bite = 4;
    e.biteT = team;
  }
  if (bp && e.poss) e.egoHit = { team, t: G.t, pid: G.teams[team].pos };
  if (bp) {
    const T = G.teams[team];
    T.hqS = (T.hqS + 1) % 1000;
    T.hq.push([
      T.hqS,
      Math.round(e.x * 10),
      Math.round(e.z * 10),
      Math.round(d),
      head ? 1 : 0,
      Math.round((KINDS[e.k].worm ? (head && e.hdY !== undefined ? e.hdY : e.y + 2.5) : e.y + (head ? headBox(e).y : 1.2)) * 10),
    ]);
    if (T.hq.length > 4) T.hq.shift();
  }
  if (e.hp <= 0) {
    const T = G.teams[team];
    T.gold += CFG.kill + (flagsOf(G, team) < flagsOf(G, e.team) ? CFG.underdogKill : 0);
    T.kills++;
    if (KINDS[e.k].role === 'siege' && !e.bounty) {
      e.bounty = 1;
      T.gold += CFG.siegeBounty;
      if (G.st) G.st[team].cats++;
      highlight(G, 'cat', team, 1, e.x, e.z);
    }
    if (e.poss && bp) giveRush(G, team, e);
    if (bp && KINDS[e.k].role !== 'siege') {
      T.comboN = G.t - (T.comboT || -99) < 6 ? (T.comboN || 0) + 1 : 1;
      T.comboT = G.t; // ego combo: three kills in a row recharge the special at once
      if (T.comboN >= 3) {
        T.comboN = 0;
        const P = T.pos && byId.get(T.pos);
        if (P && P.hp > 0) {
          P.spcd = 0;
          P.spQ = 0;
        }
        T.comboS = ((T.comboS || 0) + 1) % 100;
      }
    }
  }
}
// The counter chain is visible and physical: riders overrun archers, foot soldiers knock riders off, arrows slow foot soldiers.
function counterHit(G, e, attK, team, bp) {
  if (
    attK < 0 ||
    e.hp <= 0 ||
    KINDS[e.k].bear ||
    KINDS[attK].bear ||
    KINDS[e.k].worm ||
    KINDS[attK].worm ||
    KINDS[e.k].role === 'siege' ||
    KINDS[attK].role === 'siege'
  )
    return;
  const ar = KINDS[attK].role,
    dr = KINDS[e.k].role;
  if (BEATS[ar] !== dr) return;
  const fresh = G.t - (e.konT || -9) > 2.2;
  if (!fresh) return;
  e.konT = G.t;
  if (ar === 'cav' && !(e.down > 0)) {
    const B = BASES[e.team],
      dx = B.x - e.x,
      dz = B.z - e.z,
      d = Math.hypot(dx, dz) || 1;
    if (!knockFly(e, 0, 0, 2.4 * (e.poss ? 0.5 : 1), dx / d, dz / d, 0, bp ? 'ego' : 'ai')) return;
  } // overrun: the archer is bowled over
  else if (ar === 'melee' && !(e.down > 0) && !e.poss) {
    e.down = Math.max(e.down || 0, 1.0);
    e.kb = null;
    e.dance = 0;
    e.tgt = -1;
    e.path = null;
    e.kbN = ((e.kbN || 0) + 1) % 100;
    e.dism = 1;
  } // dismounted: the rider tips over for a second
  else if (ar === 'ranged') e.slowT = Math.max(e.slowT || 0, 1.2); // pinned: arrows slow the foot soldier
  G.kcS = ((G.kcS || 0) + 1) % 10000;
  (G.kc || (G.kc = [])).push([G.kcS, team, Math.round(e.x * 10), Math.round(e.z * 10), ar === 'cav' ? 1 : ar === 'melee' ? 2 : 3]);
  if (G.kc.length > 8) G.kc.shift();
}
function giveRush(G, team, e) {
  if (e.rushed) return;
  e.rushed = 1;
  if (G.st) G.st[team].egoKills++;
  const T = G.teams[team];
  T.gold += CFG.rush * pk(G, team, 'bounty', [1, 2]);
  T.rush = (T.rush + 1) % 100;
  T.rushAt = [Math.round(e.x * 10), Math.round(e.z * 10)];
}
let SIMG = null;
// Unit traits that make each role feel different (applied to AI-led and player-led units alike).
function traitHit(G, u, tgt, charged) {
  if (!tgt || tgt.id === undefined) return;
  if (tgt.hp <= 0) {
    if (u.k === 0) u.frenzy = 4;
    return;
  }
  const kb = (e, d) => {
    if (!KINDS[e.k].bear && KINDS[e.k].role !== 'siege' && knockFly(e, u.x, u.z, d, undefined, undefined, 0, u.poss ? 'ego' : 'ai'))
      e.kbTeam = u.team;
  };
  const ram = KINDS[u.k].role === 'cav' && charged && G.chaos && pkL(G, u.team, 'ram');
  if ((u.k === 4 && charged) || ram) kb(tgt, ram ? 4.5 : u.poss ? 3 : 2.2); // Abrissbirne: every rider's charge throws
  if (ram) hit(G, tgt.id, KINDS[u.k].dmg, u.team, new Map([[tgt.id, tgt]]), u.k); // … and hits harder
  if (u.k === 4 && charged && G.chaos && pkL(G, u.team, 'stampede'))
    for (const e of G.units)
      // Ziegen-Stampede: the neighbours of the target fly too
      if (e !== tgt && e.team !== u.team && e.hp > 0 && !KINDS[e.k].worm && (e.x - tgt.x) ** 2 + (e.z - tgt.z) ** 2 < 9) {
        hit(G, e.id, KINDS[4].dmg, u.team, new Map([[e.id, e]]), 4);
        kb(e, 2.6);
      }
}
const KNOCK_RES = k => (k === 2 ? 0.55 : 1);
const inHome = (G, u) => !G.phase && !G.tut && (u.x - BASES[u.team].x) ** 2 + (u.z - BASES[u.team].z) ** 2 < CFG.homeR * CFG.homeR;
const homeMul = (G, u) => (inHome(G, u) ? CFG.homeDmg : 1);
/* Who may floor a possessed unit (the player's ego, or the AI's hero): src 'ego' = another possessed unit (always), 'ai' = an ordinary unit (never),
   'hazard' = rolling rocks, flying bodies, wild beasts (at most once every CFG.egoKnockCd seconds). A refused knock leaves a short immunity, so a body or rock touching the ego does not hit it every tick. */
function egoKnockOK(e, src) {
  if (!e.poss || src === 'ego') return true;
  const t = SIMG ? SIMG.t : 0;
  if (src === 'hazard' && t - (e.egoKnT ?? -99) >= CFG.egoKnockCd) {
    e.egoKnT = t;
    return true;
  }
  e.kbImm = t + 0.7;
  return false;
}
function knockFly(e, fx, fz, dist, impulseX, impulseZ, lift = 0, src = 'ego') {
  if (e.hp <= 0 || (e.tutDummy && !e.poss && !e.tutPush) || e.grab || e.bur || KINDS[e.k].worm) return false;
  if (!egoKnockOK(e, src)) return false;
  e.kbEgo = src === 'ego' ? 1 : 0; // a body flung by an ego bowls like an ego blow
  dist *= KNOCK_RES(e.k);
  if (KNOCK_RES(e.k) < 1) lift *= 0.6;
  if (MAP.ice && onIce(e.x, e.z)) {
    dist *= 1.5;
    e.slipT = 1.3;
  } // ice: knocked bodies slide much farther, on their bellies
  const moon = pkL(SIMG, 1 - e.team, 'moon');
  if (moon) dist *= 1.5;
  const dx = impulseX ?? e.x - fx,
    dz = impulseZ ?? e.z - fz,
    d = Math.hypot(dx, dz) || 1;
  e.kbT = SIMG ? SIMG.t : 0;
  e.kbTeam = 1 - e.team;
  e.kb = { vx: dx / d, vz: dz / d, left: dist, sp: dist / (moon ? 1.1 : 0.38), hard: 1 };
  e.down = CFG.downT + (moon ? 1.1 : 0);
  e.dance = 0;
  e.tgt = -1;
  e.path = null;
  e.kbN = ((e.kbN || 0) + 1) % 100;
  if (lift > 0) startAir(e, e.kb.vx * e.kb.sp, e.kb.vz * e.kb.sp, lift, 'impact');
  return true;
}
function ramImpulse(e, fx, fz, lateral, dist, src = 'ego') {
  const side = clamp(lateral / 2.5, -1, 1) * 0.32;
  return knockFly(e, 0, 0, dist, fx + fz * side, fz - fx * side, 4 + Math.min(2, dist * 0.08), src);
}
function knock(e, fx, fz, dist) {
  const dx = e.x - fx,
    dz = e.z - fz,
    d = Math.hypot(dx, dz) || 1;
  for (let s = dist; s > 0.2; s -= 0.5) {
    const nx = e.x + (dx / d) * s,
      nz = e.z + (dz / d) * s;
    if (walkable(nx, nz)) {
      e.x = nx;
      e.z = nz;
      return;
    }
  }
}
const pathOK = G => G.astarBudget > 0 && (G.astarBudget >= 8 || performance.now() - G.astarT0 < 2.5); // at most 8 searches and ~2.5 ms per tick; the rest waits for the next tick
function steer(G, u, gx, gz, speed) {
  if (u.slowT > 0) speed *= 0.7;
  if (u.navPad !== undefined) {
    const pd = MAP.pads[u.navPad];
    if (pd) {
      const dx = pd.x - u.x,
        dz = pd.z - u.z,
        d = Math.hypot(dx, dz);
      u.vx = d > 0.15 ? (dx / d) * Math.min(speed, d / DT) : 0;
      u.vz = d > 0.15 ? (dz / d) * Math.min(speed, d / DT) : 0;
      return;
    }
    delete u.navPad;
  }
  u.losT -= DT;
  u.forcePath = (u.forcePath || 0) - DT;
  if (u.losT <= 0 || Math.abs(u.lgx - gx) + Math.abs(u.lgz - gz) > 2) {
    u.los = u.forcePath > 0 ? false : losFat(u.x, u.z, gx, gz);
    u.losT = 0.4;
    u.lgx = gx;
    u.lgz = gz;
  }
  let tx = gx,
    tz = gz;
  if (!u.los) {
    u.repath -= DT;
    if ((!u.path || u.repath <= 0 || Math.hypot(u.pgx - gx, u.pgz - gz) > 2.5) && pathOK(G)) {
      G.astarBudget--;
      u.path = findPath(u.x, u.z, gx, gz, KINDS[u.k].role !== 'siege');
      u.repath = 2;
      u.pgx = gx;
      u.pgz = gz;
    }
    if (u.path && u.path.length) {
      let w = u.path[0];
      if (w[2] === undefined && Math.hypot(w[0] - u.x, w[1] - u.z) < 1.1 && u.path.length > 1) {
        u.path.shift();
        w = u.path[0];
      }
      tx = w[0];
      tz = w[1];
      if (w[2] !== undefined) u.navPad = w[2];
    }
  } else u.path = null;
  const dx = tx - u.x,
    dz = tz - u.z,
    d = Math.hypot(dx, dz);
  if (d > 0.05) {
    const s = speed * Math.min(1, d + 0.3);
    u.vx = (dx / d) * s;
    u.vz = (dz / d) * s;
  }
}
function enemiesInCone(G, u, maxD, maxAng) {
  const out = [];
  for (const e of G.units) {
    if (e.team === u.team || e.hp <= 0 || e.pj || e.grab || e.bur || (e.air && Math.abs((e.y || 0) - (u.y || 0)) > 2)) continue; // airborne, swallowed or burrowed units are out of reach
    const dx = e.x - u.x,
      dz = e.z - u.z,
      d = Math.hypot(dx, dz);
    if (d > maxD) continue;
    const a = d < 0.6 ? 0 : Math.abs(angDiff(Math.atan2(dx, dz), u.yaw));
    if (a <= maxAng) out.push({ e, d, a });
  }
  return out;
}
const BASE_H = 6.5;
// A catapult shell flies on a fixed arc. If that arc runs into the enemy base, it explodes on the wall instead of passing through.
function siegeImpact(team, sx, sz, tx, tz) {
  const B = BASES[1 - team];
  if (!B) return { tx, tz, k: 1, base: false };
  const sy = unitY(sx, sz) + 3,
    ty = groundY(tx, tz),
    d = Math.hypot(tx - sx, tz - sz),
    arc = Math.min(12, Math.hypot(d, ty - sy) * 0.55),
    by = groundY(B.x, B.z);
  for (let i = 1; i <= 48; i++) {
    const k = i / 48,
      x = sx + (tx - sx) * k,
      z = sz + (tz - sz) * k,
      y = sy + (ty - sy) * k + Math.sin(k * Math.PI) * arc;
    if (Math.abs(x - B.x) < 6.6 && Math.abs(z - B.z) < 3.6 && y < by + BASE_H)
      return { tx: x, tz: z, k, base: true, y: Math.max(by + 1, Math.min(y, by + BASE_H - 0.6)) };
  }
  return { tx, tz, k: 1, base: baseGap(B, tx, tz) < 0.5, y: ty };
}
// Salvo aimed at the base: every shell stays on the building instead of flying over it.
function salvoTargets(team, sx, sz, tx, tz) {
  const EB = BASES[1 - team],
    onBase = EB && baseGap(EB, tx, tz) < 1.5,
    out = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    let ox = tx + Math.cos(a) * 3,
      oz = tz + Math.sin(a) * 3;
    if (onBase) {
      ox = Math.max(EB.x - 5.5, Math.min(EB.x + 5.5, ox));
      oz = Math.max(EB.z - 2.6, Math.min(EB.z + 2.6, oz));
    }
    out.push(siegeImpact(team, sx, sz, ox, oz));
  }
  return out;
}
function baseGap(b, x, z) {
  return Math.hypot(Math.max(0, Math.abs(x - b.x) - 6.6), Math.max(0, Math.abs(z - b.z) - 3.6));
}
// Pathfinding must stop outside the building collider, while combat measures the wall distance.
function baseAttackSlots(team, k) {
  const cache = MAP.baseAttackSlots || (MAP.baseAttackSlots = new Map()),
    key = team + ':' + k;
  if (cache.has(key)) return cache.get(key);
  const B = BASES[1 - team],
    K = KINDS[k],
    maxGap = K.range - 0.025,
    preferred = K.role === 'ranged' || K.role === 'siege' ? K.range * 0.8 : Math.min(maxGap, 1.1),
    slots = [];
  const add = (x, z, nx, nz) => {
    for (let gap = preferred; gap <= maxGap + 0.001; gap += 0.055) {
      const px = x + nx * gap,
        pz = z + nz * gap;
      if (Math.abs(px) >= HALF_W - 0.5 || Math.abs(pz) >= HALF_H - 0.5 || !walkable(px, pz) || baseGap(B, px, pz) > maxGap) continue;
      if (!slots.some(p => Math.hypot(p.x - px, p.z - pz) < 0.8)) slots.push({ x: px, z: pz });
      break;
    }
  };
  const spacing = K.r * 2 + 0.2;
  for (let x = -6.6; x <= 6.61; x += spacing) {
    add(B.x + x, B.z - 3.6, 0, -1);
    add(B.x + x, B.z + 3.6, 0, 1);
  }
  for (let z = -3.6; z <= 3.61; z += spacing) {
    add(B.x - 6.6, B.z + z, -1, 0);
    add(B.x + 6.6, B.z + z, 1, 0);
  }
  cache.set(key, slots);
  return slots;
}
function baseApproach(u, used = []) {
  const slots = baseAttackSlots(u.team, u.k);
  let best = null,
    score = Infinity;
  for (const p of slots) {
    let s = (p.x - u.x) ** 2 + (p.z - u.z) ** 2;
    for (const q of used) {
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < KINDS[u.k].r * 2 + 0.1) s += 10000;
    }
    if (s < score) {
      score = s;
      best = p;
    }
  }
  const B = BASES[1 - u.team];
  return best || nearestWalkable(MAP, B.x, B.z + (u.team ? -1 : 1) * (3.6 + KINDS[u.k].range));
}
function baseInReach(u, reach) {
  const eb = BASES[1 - u.team];
  const dx = eb.x - u.x,
    dz = eb.z - u.z,
    d = baseGap(eb, u.x, u.z);
  return d < reach && Math.abs(angDiff(Math.atan2(dx, dz), u.yaw)) < 1.2;
}
function possAttack(G, u, byId) {
  const K = KINDS[u.k];
  const EG = K.ego || NO_EGO; // per-kind ego tuning (the Berserker hits faster and harder and lives longer when you steer him)
  u.cd = K.cd * CFG.possCd * EG.cd * (u.rage > 0 ? (pkL(G, u.team, 'walhalla') ? 0.5 : 0.75) : 1) * (u.frenzy > 0 ? 0.85 : 1);
  u.atk = (u.atk + 1) % 100;
  u.at = 0;
  const dmg = K.dmg * CFG.possDmg[K.role] * EG.dmg * (u.rage > 0 ? 1.3 : 1) * homeMul(G, u);
  if (K.role === 'siege') {
    const In = G.teams[u.team].posIn;
    let tx = u.x + Math.sin(u.yaw) * 12,
      tz = u.z + Math.cos(u.yaw) * 12;
    if (In && Array.isArray(In.gp) && In.gp.every(Number.isFinite)) {
      tx = In.gp[0];
      tz = In.gp[1];
    }
    const dx = tx - u.x,
      dz = tz - u.z,
      dd = Math.hypot(dx, dz) || 1,
      R = K.range + SIEGE_EGO_REACH;
    if (dd > R) {
      tx = u.x + (dx / dd) * R;
      tz = u.z + (dz / dd) * R;
    }
    const dist = Math.min(dd, R),
      hp0 = siegeImpact(u.team, u.x, u.z, tx, tz);
    tx = hp0.tx;
    tz = hp0.tz;
    G.proj.push({
      sx: u.x,
      sz: u.z,
      t: Math.max(0.5, dist / K.pspeed) * Math.max(0.35, hp0.k),
      dmg: K.dmg * 1.6,
      tgt: -1,
      team: u.team,
      k: u.k,
      aoe: K.aoe * 1.15,
      tx,
      tz,
      bp: true,
    });
    u.at = -4;
    u.shot = [Math.round(tx * 10), Math.round(tz * 10)];
    u.run = 0;
    return;
  }
  if (K.worm) {
    // a lunge with the whole maw: everything in front of it is bitten (and thrown back a little)
    const fx = Math.sin(u.yaw),
      fz = Math.cos(u.yaw),
      cx = u.x + fx * WORM.biteF,
      cz = u.z + fz * WORM.biteF,
      d0 = dmg * WORM.biteDmg;
    for (const e of G.units) {
      if (e.team === u.team || e.hp <= 0 || e.air || e.pj || e.grab || e.bur) continue;
      const dd = Math.hypot(e.x - cx, e.z - cz);
      if (dd > WORM.biteR + KINDS[e.k].r) continue;
      hit(G, e.id, d0 * (dd < WORM.biteR * 0.6 ? 1 : 0.75), u.team, byId, u.k, true);
      if (e.hp > 0 && KINDS[e.k].role !== 'siege' && !KINDS[e.k].worm && !KINDS[e.k].bear)
        knockFly(e, u.x, u.z, 2.6, undefined, undefined, 1.2, 'ego');
    }
    for (const b of G.bears.slice())
      if (bearHere(b) && Math.hypot(b.x - cx, b.z - cz) < WORM.biteR + 1.3) hitBear(G, b, d0, u.team, u.k, true);
    if (baseInReach(u, K.range + 1.5)) hit(G, -2, dmg, u.team, byId, u.k);
    u.at = -6;
    u.run = 0;
    return;
  }
  if (K.role === 'ranged' && u.aim) {
    const [dx, dy, dz] = u.aim;
    G.fpId = (G.fpId + 1) % 10000;
    G.fp.push({
      id: G.fpId,
      x: u.x + dx * 0.5,
      y: u.y + 1.9 + dy * 0.5,
      z: u.z + dz * 0.5,
      dx,
      dy,
      dz,
      t: (K.range * 2.5) / CFG.arrowSpeed,
      team: u.team,
      k: u.k,
      dmg,
    });
    u.at = -3;
  } else if (K.role === 'ranged') {
    const c = enemiesInCone(G, u, K.range + 2, 0.45).sort((a, b) => a.a * 8 + a.d * 0.1 - (b.a * 8 + b.d * 0.1))[0];
    if (c) {
      u.at = c.e.id;
      G.proj.push({ t: c.d / K.pspeed, dmg, tgt: c.e.id, team: u.team, k: u.k, bp: true });
    } else if (baseInReach(u, K.range)) {
      u.at = -2;
      G.proj.push({ t: 0.5, dmg, tgt: -2, team: u.team, k: u.k });
    }
  } else {
    let hits = enemiesInCone(G, u, K.range + K.r + 1.0, 1.15)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    const charge = K.role === 'cav' && u.run > 1.2 ? (u.k === 5 ? 2.3 : 1.9) : 1;
    for (const b of G.bears.slice()) {
      if (!bearHere(b)) continue;
      const dx = b.x - u.x,
        dz = b.z - u.z,
        d = Math.hypot(dx, dz);
      if (d < K.range + K.r + (b.worm ? 2.2 : 1.6) && Math.abs(angDiff(Math.atan2(dx, dz), u.yaw)) < 1.2) {
        hitBear(G, b, dmg * charge, u.team, u.k, true);
        u.at = -3;
      }
    }
    hits.forEach(h => {
      hit(G, h.e.id, dmg * charge, u.team, byId, u.k, true);
      traitHit(G, u, h.e, charge > 1);
      if (u.k === 0 && u.rage > 0 && pkL(G, u.team, 'walhalla')) knockFly(h.e, u.x, u.z, 3.5);
    });
    if (hits.length) u.at = hits[0].e.id;
    else if (baseInReach(u, K.range + 1)) {
      u.at = -2;
      hit(G, -2, dmg, u.team, byId, u.k);
    }
  }
  u.run = 0;
}
function possSpecial(G, u, byId) {
  const K = KINDS[u.k];
  if (K.worm) {
    // ego sandworm: one press digs in (then it swims under the sand where you steer it), the next bursts out and swallows everyone around
    if (u.ws === 1 || (u.ws === 5 && u.wst >= 0.3)) {
      u.ws = 2;
      u.wst = 0;
      u.ex = u.x;
      u.ez = u.z;
      u.spcd = WORM.cdE * pk(G, u.team, 'charge', [1, 0.34]);
      return;
    }
    if (u.ws) return;
    if (!canBurrow(u.x, u.z)) {
      u.spcd = 0.4;
      u.noSand = ((u.noSand || 0) + 1) % 100;
      return;
    } // no sand to dig into here
    u.ws = 5;
    u.wst = 0;
    u.bur = 1;
    u.wt = 0;
    u.ex = u.x;
    u.ez = u.z;
    u.tunT = 0;
    u.spcd = 0.35;
    u.wdN = ((u.wdN || 0) + 1) % 100;
    return;
  }
  u.spcd = CFG.spCd * pk(G, u.team, 'charge', [1, 0.34]);
  u.sp = (u.sp + 1) % 10;
  u.spm = 0;
  if (K.role === 'siege') {
    const In = G.teams[u.team].posIn;
    let tx = u.x + Math.sin(u.yaw) * 12,
      tz = u.z + Math.cos(u.yaw) * 12;
    if (In && Array.isArray(In.gp) && In.gp.every(Number.isFinite)) {
      tx = In.gp[0];
      tz = In.gp[1];
    }
    {
      const dx = tx - u.x,
        dz = tz - u.z,
        dd = Math.hypot(dx, dz) || 1,
        R = K.range + SIEGE_EGO_REACH;
      if (dd > R) {
        tx = u.x + (dx / dd) * R;
        tz = u.z + (dz / dd) * R;
      }
    }
    salvoTargets(u.team, u.x, u.z, tx, tz).forEach((hq, i) =>
      G.proj.push({
        sx: u.x,
        sz: u.z,
        t: (0.9 + i * 0.25) * Math.max(0.5, hq.k),
        dmg: K.dmg * 0.95,
        tgt: -1,
        team: u.team,
        k: u.k,
        aoe: K.aoe * 0.8,
        tx: hq.tx,
        tz: hq.tz,
        bp: true,
      })
    );
    u.spcd = 14 * pk(G, u.team, 'charge', [1, 0.34]);
    u.shot = [Math.round(tx * 10), Math.round(tz * 10)];
    return;
  }
  if (K.bear) {
    u.clawT = 1.25;
    u.clawP = 0;
    u.spcd = 6;
    return;
  }
  if (u.k === 0) {
    u.rage = pk(G, u.team, 'walhalla', [4, 10]);
    const fx0 = Math.sin(u.yaw),
      fz0 = Math.cos(u.yaw);
    enemiesInCone(G, u, 2.8, 0.95)
      .filter(c => KINDS[c.e.k].role !== 'siege')
      .slice(0, 1)
      .forEach(c => {
        hit(G, c.e.id, 22, u.team, byId, u.k, true);
        c.e.kbT = G.t;
        c.e.kbTeam = u.team;
        knockFly(c.e, 0, 0, 10, fx0, fz0, 4.8);
      });
  } // Viking throw: whoever stands in front is hurled away and bowls through his friends
  else if ((u.k === 1 || u.k === 3) && u.aim) {
    const vl = pkL(G, u.team, 'volley'),
      [ax, ay, az] = u.aim,
      n = (u.k === 1 ? 5 : 6) + 5 * vl,
      spread = vl ? 0.05 : u.k === 1 ? 0.075 : 0.11;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * spread,
        c = Math.cos(a),
        sn = Math.sin(a),
        dx = ax * c + az * sn,
        dz = -ax * sn + az * c;
      G.fpId = (G.fpId + 1) % 10000;
      G.fp.push({
        id: G.fpId,
        x: u.x + dx * 0.5,
        y: u.y + 1.9 + ay * 0.5,
        z: u.z + dz * 0.5,
        dx,
        dy: ay + (i % 2 ? 0.02 : -0.01),
        dz,
        t: (K.range * 2.2) / CFG.arrowSpeed,
        team: u.team,
        k: u.k,
        dmg: u.k === 1 ? 24 : 26,
        nb: vl ? 1 : 0,
      });
    }
    u.spm = 1;
  } else if (u.k === 1) {
    enemiesInCone(G, u, K.range + 2, 0.42)
      .slice(0, 6)
      .forEach(c => G.proj.push({ t: c.d / K.pspeed, dmg: 24, tgt: c.e.id, team: u.team, k: u.k, bp: true }));
    if (!pkL(G, u.team, 'volley') && baseInReach(u, K.range + 1)) G.proj.push({ t: 0.5, dmg: 70, tgt: -2, team: u.team, k: u.k });
  } else if (u.k === 2) {
    enemiesInCone(G, u, 3.4, Math.PI).forEach(c => {
      hit(G, c.e.id, 40, u.team, byId, u.k, true);
      knockFly(c.e, u.x, u.z, 3.2);
    });
    if (baseGap(BASES[1 - u.team], u.x, u.z) < 3.4) hit(G, -2, 60, u.team, byId, -1);
    for (const b of G.bears.slice()) if (Math.hypot(b.x - u.x, b.z - u.z) < 3.6) hitBear(G, b, 60, u.team, -1, true);
    u.spinT = pk(G, u.team, 'spin', [0, 2.4]);
    u.spinP = 0.4;
  } else if (u.k === 3) {
    enemiesInCone(G, u, K.range + 1, Math.PI)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(c => G.proj.push({ t: c.d / K.pspeed, dmg: 30, tgt: c.e.id, team: u.team, k: u.k, bp: true }));
    if (!pkL(G, u.team, 'volley') && baseGap(BASES[1 - u.team], u.x, u.z) < K.range + 1)
      G.proj.push({ t: 0.6, dmg: 70, tgt: -2, team: u.team, k: u.k });
  } else {
    u.ramNow = 0;
    startRam(G, u, byId); // riders dash at once (no wind-up), also when landing from an air dash
  }
}
function startRam(G, u, byId) {
  {
    const In = G.teams[u.team].posIn,
      U0 = u;
    U0.dashUntil = G.t + 0.5;
    if (!(In && Array.isArray(In.dp))) {
      U0.dashS = 0.42;
      U0.dfx = Math.sin(U0.yaw);
      U0.dfz = Math.cos(U0.yaw);
    }
    u = { x: u.x, z: u.z, yaw: u.yaw, k: u.k, team: u.team };
    if (
      In &&
      Array.isArray(In.dp) &&
      In.dp.length === 2 &&
      In.dp.every(Number.isFinite) &&
      Math.hypot(In.dp[0] - u.x, In.dp[1] - u.z) < 14
    ) {
      u.x = In.dp[0];
      u.z = In.dp[1];
    }
    // The ram connects when the rider actually reaches each target (dash speed ~26 m/s), not all at once at the start.
    const fx = Math.sin(u.yaw),
      fz = Math.cos(u.yaw),
      ebs = BASES[1 - u.team],
      stp0 = u.k === 4 && pkL(G, u.team, 'stampede'),
      len = stp0 ? 16 : 10.5,
      wid = stp0 ? 6 : 2.5;
    const Q = (U0.ramQ = []);
    U0.ramN = 0;
    U0.ramL = { x: u.x, z: u.z, fx, fz, wid };
    const due = along => G.t + Math.max(0, along) / 26;
    for (let a2 = 0; a2 <= len; a2 += 1)
      if (baseGap(ebs, u.x + fx * a2, u.z + fz * a2) < (stp0 ? 4 : 2.2)) {
        Q.push({ base: true, t: due(a2) });
        break;
      }
    for (const b of G.bears) {
      if (!bearHere(b)) continue;
      const dx = b.x - u.x,
        dz = b.z - u.z,
        al = dx * fx + dz * fz;
      if (al > -0.5 && al < len && Math.abs(dx * fz - dz * fx) < 2.6) Q.push({ bear: b.id, t: due(al) });
    }
    for (const e of G.units) {
      if (e.team === u.team || e.hp <= 0) continue;
      const dx = e.x - u.x,
        dz = e.z - u.z,
        along = dx * fx + dz * fz;
      if (along < -0.5 || along > len || Math.abs(dx * fz - dz * fx) >= wid) continue;
      Q.push({ id: e.id, t: due(along) });
    }
    Q.sort((a, b) => a.t - b.t);
    ramTick(G, U0, byId);
  }
}
function ramTick(G, u, byId) {
  const Q = u.ramQ;
  if (!Q) return;
  const L = u.ramL;
  while (Q.length && Q[0].t <= G.t + 1e-6) {
    const h = Q.shift();
    if (h.base) {
      hit(G, -2, 110 * pk(G, u.team, 'ram', [1, 2]), u.team, byId, -1);
      continue;
    }
    if (h.bear !== undefined) {
      const b = G.bears.find(o => o.id === h.bear);
      if (b) hitBear(G, b, 110, u.team, -1, true);
      continue;
    }
    const e = byId.get(h.id);
    if (!e || e.hp <= 0 || e.pj) continue;
    const dx = e.x - L.x,
      dz = e.z - L.z,
      lat = dx * L.fz - dz * L.fx;
    if (Math.abs(lat) > L.wid + 1.5) continue; // dodged
    u.ramN++;
    if (KINDS[e.k].role === 'siege') {
      e.smash = 1;
      hit(G, e.id, e.hp + 9999, u.team, byId, -1, true);
      continue;
    }
    hit(G, e.id, (KINDS[e.k].role === 'ranged' ? KINDS[e.k].hp * 0.6 : 45) * pk(G, u.team, 'ram', [1, 2]), u.team, byId, -1, true);
    ramImpulse(e, L.fx, L.fz, lat, 9.5 * pk(G, u.team, 'ram', [1, 4]));
  }
  if (!Q.length) {
    if (G.st) G.st[u.team].rams += u.ramN;
    if (u.ramN >= 3) highlight(G, 'ram', u.team, u.ramN, u.x, u.z);
    u.ramQ = null;
  }
}
const EGO_MAX_V = 34; // m/s: how fast the host lets a steered warrior move after the client's position (dash is 27)
function possStep(G, u, byId) {
  const T = G.teams[u.team],
    In = T.posIn,
    K = KINDS[u.k];
  u.cd -= DT;
  u.spcd -= DT;
  u.rage -= DT;
  u.hp = Math.min(maxHp(u), u.hp + CFG.possRegen * DT);
  u.hs = 1 + 0.45 * pkL(G, u.team, 'bighead');
  u.gcd = (u.gcd || 0) - DT;
  if (u.clawT > 0) {
    u.clawT -= DT;
    u.clawP -= DT;
    if (u.clawP <= 0) {
      u.clawP = 0.18;
      u.atk = (u.atk + 1) % 100;
      enemiesInCone(G, u, 4.2, Math.PI)
        .slice(0, 8)
        .forEach(c => {
          hit(G, c.e.id, 46, u.team, byId, u.k, true);
          if ((u.clawP2 = !u.clawP2)) knockFly(c.e, u.x, u.z, 1.6);
        });
      for (const b of G.bears.slice()) if (Math.hypot(b.x - u.x, b.z - u.z) < 4.2) hitBear(G, b, 46, u.team, u.k, true);
      if (baseInReach(u, 3)) hit(G, -2, 22, u.team, byId, -1);
    }
  }
  if (u.spinT > 0) {
    u.spinT -= DT;
    u.spinP -= DT;
    if (u.spinP <= 0) {
      u.spinP = 0.4;
      enemiesInCone(G, u, 5.5, Math.PI).forEach(c => {
        hit(G, c.e.id, 30, u.team, byId, u.k, true);
        if (!(c.e.down > 0.6)) knockFly(c.e, u.x, u.z, 5);
      });
    }
  }
  if (u.dance > 0) {
    u.dance -= DT;
    if (In && In.id === u.id) {
      u.la = In.a;
      u.ls = In.s;
      u.lj = In.j;
      u.lg = In.g;
      u.lhx = In.h || 0;
    }
    u.run = 0;
    u.ord = { x: u.x, z: u.z, mv: false };
    u.tgt = -1;
    return;
  }
  if (u.jumpT > 0) {
    u.jumpT -= DT;
    if (u.jumpT <= 0) {
      for (const e of G.units)
        if (e.team !== u.team && e.hp > 0 && (e.x - u.x) ** 2 + (e.z - u.z) ** 2 < 3.6 * 3.6) {
          hit(G, e.id, 45, u.team, byId, -1, true);
          knockFly(e, u.x, u.z, 9);
        }
      u.stomp = (u.stomp || 0) + 1;
    }
  }
  if (u.dashS > 0) {
    u.dashS -= DT;
    const st = 26 * DT * (inWater(u.x, u.z) || wadeAt(u.x, u.z) ? 0.45 : 1),
      nx = u.x + u.dfx * st,
      nz = u.z + u.dfz * st;
    if (walkable(nx, nz) || edgeSlide(nx, nz) || fallZone(nx, nz)) {
      advanceGround(u, nx, nz, (u.dfx * st) / DT, (u.dfz * st) / DT, DT, true);
      if (u.air) u.dashS = 0;
    } else u.dashS = 0;
    if (In && In.id === u.id) {
      u.la = In.a;
      u.ls = In.s;
      u.lhx = In.h || 0;
    }
    u.run = 0;
    return;
  }
  if (u.down > 0) {
    u.down -= DT;
    const kb = u.kb;
    if (kb && kb.left > 0) kbStep(u, kb);
    if (In && In.id === u.id) {
      if (In.s !== u.ls && u.spcd < 4) u.spQ = G.t + Math.max(u.spcd, u.down) + 0.6;
      u.la = In.a;
      u.ls = In.s;
      u.lhx = In.h || 0;
    }
    if (u.down <= 0) u.kb = null;
    u.run = 0;
    u.ord = { x: u.x, z: u.z, mv: false };
    u.tgt = -1;
    return;
  }
  if (In && In.id === u.id && Number.isFinite(In.n)) T.inN = In.n; // acknowledged in the snapshot (ia): "I have seen packet n"
  if (K.worm && u.ws) {
    if (In && In.id === u.id) {
      if (u.ls === undefined) u.ls = In.s;
      if (In.s !== u.ls) {
        u.ls = In.s;
        possSpecial(G, u, byId);
      }
      u.la = In.a;
      u.lj = In.j;
      u.lg = In.g;
      if (Number.isFinite(In.y) && (u.ws >= 3 || u.ws === 1)) u.yaw = In.y;
      if (u.ws === 1) wormTunnel(u, In);
    }
    wormUnitStep(G, u, byId);
    u.run = 0;
    u.ord = { x: u.x, z: u.z, mv: false };
    u.tgt = -1;
    return;
  }
  if (In && In.id === u.id) {
    if (
      In.flying &&
      Array.isArray(In.av) &&
      (In.av.length === 4 || In.av.length === 6) &&
      In.av.every(Number.isFinite) &&
      In.air === (u.airAck || 0) + 1 &&
      (G.t < (u.dashUntil || 0) || fallZone(In.x, In.z))
    ) {
      const vx = clamp(In.av[0], -40, 40),
        vz = clamp(In.av[1], -40, 40),
        vy = clamp(In.av[2], -25, 7);
      const sy = u.y,
        d = Math.hypot(In.x - u.x, In.z - u.z);
      if (
        In.av.length === 6 &&
        Number.isFinite(d) &&
        d < 12 &&
        In.av[4] <= sy + 4 &&
        In.av[4] >= sy - 10 &&
        unitY(In.x, In.z) < In.av[4] - 0.02
      ) {
        u.x = clampX(In.x);
        u.z = clampZ(In.z);
        u.y = u.fy = In.av[4];
        startAir(u, vx, vz, vy, In.av[3] === 1 ? 'dash' : 'fall');
        if (u.air) u.air.sy = sy;
      } else if (In.av.length === 4) startAir(u, vx, vz, vy, In.av[3] === 1 ? 'dash' : 'fall');
    }
    if (u.la === undefined) {
      u.la = In.a;
      u.ls = In.s;
    }
    if (
      Number.isFinite(In.x) &&
      Number.isFinite(In.z) &&
      (!u.padAck || In.pad === u.padAck) &&
      (!u.airAck || In.air === u.airAck) &&
      !In.flying
    ) {
      // The warrior goes where the client says, at most EGO_MAX_V fast: an honest client never exceeds 27 m/s (dash), so late packets
      // after a stall are caught up within a few ticks, while a client that claims more is held to that speed. Whatever the host does
      // not follow shows up in the client's reconciliation (51-ego.js) and pulls the client back.
      const d = Math.hypot(In.x - u.x, In.z - u.z);
      if (d > 0.02) {
        const old = { x: u.x, z: u.z };
        if (
          walkable(In.x, In.z) ||
          (edgeSlide(In.x, In.z) && (G.t < (u.dashUntil || 0) || groundY(In.x, In.z) <= groundY(u.x, u.z) + 0.03)) ||
          fallZone(In.x, In.z)
        ) {
          // in steps of at most half a metre, like the client walks: one big stride over a dune would count as a fall
          const mv = Math.min(d, EGO_MAX_V * DT),
            n = Math.max(1, Math.ceil(mv / 0.45)),
            vx = ((In.x - u.x) / d) * (mv / DT),
            vz = ((In.z - u.z) / d) * (mv / DT),
            dashing = G.t < (u.dashUntil || 0);
          for (let i = 1; i <= n; i++) {
            const k = (mv / d) * (i / n),
              bx = u.x,
              bz = u.z;
            if (advanceGround(u, old.x + (In.x - old.x) * k, old.z + (In.z - old.z) * k, vx, vz, DT / n, dashing, true)) break; // airborne now
            if (u.x === bx && u.z === bz) break; // blocked
          }
        } else {
          const s = Math.min(d, K.speed * 3 * DT);
          const nx = u.x + ((In.x - u.x) / d) * s,
            nz = u.z + ((In.z - u.z) / d) * s;
          if (walkable(nx, nz)) {
            u.x = nx;
            u.z = nz;
          }
        }
        u.run = Math.hypot(u.x - old.x, u.z - old.z) > K.speed * 0.5 * DT ? u.run + DT : 0;
      } else u.run = 0;
    }
    if (Number.isFinite(In.y)) u.yaw = In.y;
    if (Array.isArray(In.at) && In.at.length === 3 && In.at.every(Number.isFinite)) {
      const ax = In.at[0] - u.x,
        ay = In.at[1] - (u.y + 1.9),
        az = In.at[2] - u.z,
        l = Math.hypot(ax, ay, az);
      u.aim = l > 0.3 ? [ax / l, ay / l, az / l] : null;
    } else if (Array.isArray(In.ad) && In.ad.length === 3 && In.ad.every(Number.isFinite)) {
      const l = Math.hypot(In.ad[0], In.ad[1], In.ad[2]);
      u.aim = l > 0.5 ? [In.ad[0] / l, In.ad[1] / l, In.ad[2] / l] : null;
    } else u.aim = null;
    const chick = false;
    // A press that arrives a little early (lag, slower simulation) is remembered and fires the moment the cooldown ends.
    if (In.a !== u.la) {
      u.la = In.a;
      if (u.cd <= 0.15 && !chick) possAttack(G, u, byId);
      else if (u.cd < 1.2) u.atQ = G.t + 1.2;
    } else if (u.atQ && u.cd <= 0.15) {
      const ok = G.t <= u.atQ;
      u.atQ = 0;
      if (ok) possAttack(G, u, byId);
    }
    if (In.s !== u.ls) {
      u.ls = In.s;
      if (u.spcd <= 0.3 && !chick) possSpecial(G, u, byId);
      else if (u.spcd < 4) u.spQ = G.t + u.spcd + 0.5;
    } else if (u.spQ && u.spcd <= 0.3) {
      const ok = G.t <= u.spQ;
      u.spQ = 0;
      if (ok) possSpecial(G, u, byId);
    }
    if (u.lj === undefined) {
      u.lj = In.j;
      u.lg = In.g;
    }
    if (u.lhx === undefined) u.lhx = In.h || 0;
    if ((In.h || 0) !== u.lhx) {
      u.lhx = In.h || 0;
      const hb = heroWorm(G, u);
      if (hb) {
        heroStart(G, u, hb);
        return;
      }
    } // "Den Helden spielen"
    if (In.j !== u.lj) {
      u.lj = In.j;
      if (pkL(G, u.team, 'jump') && !(u.jumpT > 0) && !chick) u.jumpT = 0.9;
    }
    if (In.g !== u.lg) {
      u.lg = In.g;
      const TT = G.teams[u.team],
        perkN = pkL(G, u.team, 'dance');
      if ((perkN || (TT.nades || 0) > 0) && !((u.gcd || 0) > 0) && !chick) {
        if (perkN) u.gcd = 14;
        else {
          TT.nades--;
          u.gcd = 1.5;
        }
        let dist = 10,
          fx = Math.sin(u.yaw),
          fz = Math.cos(u.yaw);
        if (Array.isArray(In.gp) && In.gp.every(Number.isFinite)) {
          fx = In.gp[0] - u.x;
          fz = In.gp[1] - u.z;
          dist = clamp(Math.hypot(fx, fz), 2, NADE_MAX);
        } else if (u.aim && u.aim[1] < -0.05) dist = clamp(1.2 / -u.aim[1], 4, 15);
        const fl = Math.hypot(fx, fz) || 1;
        let p = { x: clampX(u.x + (fx / fl) * dist), z: clampZ(u.z + (fz / fl) * dist) };
        {
          const sy = unitY(u.x, u.z) + 2,
            ty = unitY(p.x, p.z) + 0.3,
            d0 = Math.hypot(p.x - u.x, p.z - u.z),
            hh = 1 + d0 * 0.12;
          for (let k = 0.04; k < 1; k += 0.02) {
            const x = lerp(u.x, p.x, k),
              z = lerp(u.z, p.z, k);
            if (lerp(sy, ty, k) + Math.sin(k * Math.PI) * hh < groundY(x, z) + 0.2) {
              p = { x, z };
              break;
            }
          }
        }
        G.grId = ((G.grId || 0) + 1) % 1000;
        const fl2 = 0.3 + Math.hypot(p.x - u.x, p.z - u.z) / 28;
        (G.gr || (G.gr = [])).push({ id: G.grId, x: p.x, z: p.z, sx: u.x, sz: u.z, t: fl2, t0: fl2, team: u.team });
      }
    }
  }
  u.ord = { x: u.x, z: u.z, mv: false };
  u.tgt = -1;
}
function hitBear(G, b, dmg, team, attK, bp, head) {
  if (!bearHere(b)) return;
  if (G.tut && b.tut && !bp) return;
  /* tutorial bear: only the player's own shots count */ let d = dmg;
  if (b.worm) {
    if (attK >= 0 && KINDS[attK].role === 'ranged') d *= 1.6;
  } else if (attK >= 0 && KINDS[attK].role === 'ranged') d *= 2.4;
  else if (attK >= 0 && KINDS[attK].role !== 'siege') d *= 0.7;
  if (head) d *= b.worm ? WORM_HEAD_MUL : 3;
  b.hp -= d;
  b.aggro = team;
  b.at = 3;
  if (bp) {
    const T = G.teams[team],
      hy = b.worm ? (head && b.hdY !== undefined ? b.hdY : groundY(b.x, b.z) + 3) : groundY(b.x, b.z) + 1.4;
    T.hqS = (T.hqS + 1) % 1000;
    T.hq.push([T.hqS, Math.round(b.x * 10), Math.round(b.z * 10), Math.round(d), head ? 1 : 0, Math.round(hy * 10)]);
    if (T.hq.length > 4) T.hq.shift();
  }
  if (b.hp <= 0) {
    // Remain a neutral, defeated bear through collapse, conversion and stand-up.
    // Population, possession, combat and capture only see an ally after stand-up.
    b.hp = 0;
    b.tameTeam = team;
    b.tameT = 0;
    b.mv = 0;
    b.path = null;
    if (b.worm) {
      b.ws = 4;
      b.st = 0;
      b.bw = 0;
    } // a beaten sandworm stays out of the sand while it turns
  }
}
const BEAR_COLLAPSE = 0.65,
  BEAR_GLOW = 1,
  BEAR_STAND = 0.6,
  BEAR_TAME = BEAR_COLLAPSE + BEAR_GLOW + BEAR_STAND;
