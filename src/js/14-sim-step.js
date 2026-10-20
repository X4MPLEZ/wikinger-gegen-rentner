/* 14-sim-step.js - THE TICK: step(G) advances the whole game by DT (0.05 s): units, projectiles, worms, bears, hazards, flags, events (Nebelwand, Goldwagen ...),
   phases (Sturm, Endkampf), win check. snapOf(G) packs the state into the snapshot that every client draws (keep it small, numbers rounded). */
/* ---------- map events: not on a fixed clock, one surprise every couple of minutes ---------- */
const EV_FOG = 1,
  EV_WAGON = 2,
  EV_UNDERDOG = 3,
  EV_FLAGS = 4;
const EV_LEN = { 1: 45, 2: 75, 3: 60, 4: 5 };
function eventStep(G) {
  if (G.tut || G.over >= 0 || G.noEvents) return;
  const E = G.ev || (G.ev = { next: 95 + Math.random() * 50, cur: 0, t: 0, last: 0, n: 0 });
  if (E.cur) {
    E.t -= DT;
    if (E.cur === EV_WAGON) wagonStep(G, E);
    if (E.t <= 0 || (E.cur === EV_WAGON && !G.wagon)) endEvent(G, E);
    return;
  }
  if (G.t >= E.next && G.t < CFG.crumbleT - 60) startEvent(G, E);
}
function startEvent(G, E, force) {
  const pool = [EV_FOG, EV_WAGON, EV_UNDERDOG, EV_FLAGS].filter(
    k => k !== E.last && !(k === EV_FLAGS && (G.phase || 0) >= 2) && !(k === EV_FOG && G.fog)
  ); // fog mode: always foggy, no fog event
  let k = force || pool[Math.floor(Math.random() * pool.length)];
  if (k === EV_WAGON && !spawnWagon(G)) k = EV_UNDERDOG;
  if (k === EV_FLAGS && !migrateFlags(G)) k = G.fog ? EV_UNDERDOG : EV_FOG;
  E.cur = k;
  E.last = k;
  E.n++;
  E.t = EV_LEN[k];
  highlight(G, 'ev' + k, -1, 0, 0, 0);
}
function endEvent(G, E) {
  if (E.cur === EV_FOG || E.cur === EV_UNDERDOG) highlight(G, 'evEnd', -1, E.cur, 0, 0);
  E.cur = 0;
  G.wagon = null;
  E.next = G.t + 75 + Math.random() * 70;
}
function spawnWagon(G) {
  for (const oz of [0, 12, -12, 20, -20]) {
    // from one side of the map to the other, straight through the middle between the bases
    const a = nearestWalkable(MAP, -HALF_W + 5, -38 + oz),
      b = nearestWalkable(MAP, HALF_W - 5, 38 - oz); // a long diagonal through the centre
    if (!landIn(MAP, a.x, a.z) || !landIn(MAP, b.x, b.z)) continue;
    const path = findPath(a.x, a.z, b.x, b.z, false);
    if (!path || !path.length) continue;
    if (Math.random() < 0.5) path.reverse();
    const st = path[0];
    G.wagon = { x: st[0], z: st[1], yaw: 0, path: path.slice(1), owner: -1, mv: 0, gold: 0, done: 0 };
    return true;
  }
  return false;
}
function wagonStep(G, E) {
  const W = G.wagon;
  if (!W) return;
  let c0 = 0,
    c1 = 0;
  for (const u of G.units) {
    if (u.hp <= 0 || u.air || u.pj || u.grab || u.bur) continue;
    const d2 = (u.x - W.x) ** 2 + (u.z - W.z) ** 2;
    if (d2 < 36) u.team ? c1++ : c0++;
  }
  W.owner = c0 > c1 ? 0 : c1 > c0 ? 1 : -1;
  if (W.owner >= 0) {
    G.teams[W.owner].gold += CFG.wagonGold * DT;
    W.gold += CFG.wagonGold * DT;
  }
  const escorted = c0 + c1 > 0;
  W.mv = 0;
  if (escorted && W.path.length) {
    const w = W.path[0],
      dx = w[0] - W.x,
      dz = w[1] - W.z,
      d = Math.hypot(dx, dz),
      st = Math.min(d, 2.4 * DT);
    if (d < 0.6) {
      W.path.shift();
    } else {
      W.x += (dx / d) * st;
      W.z += (dz / d) * st;
      W.yaw = Math.atan2(dx, dz);
      W.mv = 1;
    }
    for (const u of G.units) {
      if (u.hp <= 0 || u.poss) continue;
      const ex = u.x - W.x,
        ez = u.z - W.z,
        dd = Math.hypot(ex, ez);
      if (dd < 1.6 && dd > 0.01) {
        const px = u.x + (ex / dd) * (1.6 - dd),
          pz = u.z + (ez / dd) * (1.6 - dd);
        if (walkable(px, pz)) {
          u.x = px;
          u.z = pz;
        }
      }
    } // the cart pushes bystanders aside
  }
  if (!W.path.length) {
    W.done = 1;
    if (!W.doneAt) W.doneAt = G.t;
    if (G.t - W.doneAt > 4) G.wagon = null;
  }
}
function migrateFlags(G) {
  const moved = [];
  FLAGS.forEach((F, i) => {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * TAU,
        d = 9 + Math.random() * 9,
        p = nearestWalkable(MAP, clampX(F.x + Math.cos(a) * d), clampZ(F.z + Math.sin(a) * d));
      if (!landIn(MAP, p.x, p.z) || (MAP.cliff && fallZone(p.x, p.z)) || Math.abs(p.x) > HALF_W - 6 || Math.abs(p.z) > HALF_H - 6) continue;
      if (BASES.some(B => Math.hypot(B.x - p.x, B.z - p.z) < 20) || FLAGS.some((o, j) => j !== i && Math.hypot(o.x - p.x, o.z - p.z) < 10))
        continue;
      if ((MAP.cacti || []).some(c => Math.hypot(c.x - p.x, c.z - p.z) < 4)) continue;
      F.x = p.x;
      F.z = p.z;
      moved.push(i);
      break;
    }
  });
  if (!moved.length) return false;
  G.flagMv = (G.flagMv || 0) + 1;
  for (const u of G.units) {
    u.path = null;
    u.repath = 0;
    u.baseSlot = null;
  }
  return true;
}
function worldStep(G, byId) {
  eventStep(G);
  if (MAP.frozen || (G.holes && G.holes.length)) iceStep(G);
  if (MAP.pads && MAP.pads.length) padStep(G);
  if (G.gr) {
    for (const g of G.gr) {
      g.t -= DT;
      if (g.t <= 0) {
        let n = 0;
        for (const e of G.units)
          if (
            e.team !== g.team &&
            e.hp > 0 &&
            !e.grab &&
            !e.bur &&
            !(KINDS[e.k].worm && e.ws) &&
            (e.x - g.x) ** 2 + (e.z - g.z) ** 2 < 25
          ) {
            e.dance = e.poss ? 4 : 7.5; // a player who has to dance gets control back sooner
            e.tgt = -1;
            n++;
          }
        G.geS = ((G.geS || 0) + 1) % 10000;
        (G.ge || (G.ge = [])).push([G.geS, g.team, n]);
        if (G.ge.length > 6) G.ge.shift();
      }
    }
    G.gr = G.gr.filter(g => g.t > 0);
  }
  bowlStep(G);
  rollStep(G);
  gooStep(G);
  // One authoritative trajectory owns airborne x/y/z until actual impact.
  for (const u of G.units)
    if (u.air && u.hp > 0) {
      const landed = airStep(u, DT),
        input = G.teams[u.team].posIn;
      if (landed && u.airRam) {
        u.airRam = 0;
        if (u.hp > 0 && u.poss) {
          u.down = 0;
          u.tumT = 0;
          u.spcd = 0;
          u.ls = input && input.id === u.id ? input.s : u.ls;
          u.ramNow = 1;
          possSpecial(G, u, byId);
          u.ramNow = 0;
        }
      }
      if (landed && u.poss && input && input.id === u.id)
        G.teams[u.team].posIn = { ...input, x: u.x, z: u.z, flying: false, air: u.airAck, av: undefined };
    }
  // cacti prick
  if (MAP.cacti && MAP.cacti.length) {
    G.ct = [];
    for (const u of G.units) {
      if (u.hp <= 0 || u.bur) continue;
      const r0 = KINDS[u.k].r;
      for (const c of MAP.cacti) {
        const d = Math.hypot(u.x - c.x, u.z - c.z);
        if (d < 0.62 * c.s + r0 + 0.25) {
          u.hp -= 16 * DT * (u.poss ? CFG.possArmor : 1);
          u.hurt = 2.5;
          u.lh = [-5, -1, 0];
          G.ct.push(u.id);
          break;
        }
      }
    }
  }
  // polar bears: roam the land, maul whoever comes close; beaten bears join the winner
  if (G.bearQ)
    for (let i = G.bearQ.length - 1; i >= 0; i--) {
      G.bearQ[i] -= DT;
      if (G.bearQ[i] <= 0 && G.bears.length < 2) {
        G.bearQ.splice(i, 1);
        if (MAP.type === 'wueste') {
          const home = (MAP.bears || []).find(h => !G.bears.some(b => Math.hypot(b.hx - h.x, b.hz - h.z) < 4));
          if (home) G.bears.push(wildWorm((G.bearId = (G.bearId || 100) + 1), home));
          continue;
        }
        const sx = Math.random() < 0.5 ? -1 : 1,
          p = nearestWalkable(MAP, sx * (HALF_W - 3), (Math.random() - 0.5) * 60);
        G.bears.push({
          id: (G.bearId = (G.bearId || 100) + 1),
          x: p.x,
          z: p.z,
          hx: p.x,
          hz: p.z,
          yaw: 0,
          cd: 0,
          atk: 0,
          mv: 0,
          wt: 0,
          hp: 520,
          mhp: 520,
        });
      }
    }
  for (const b of G.bears) {
    if (b.tameTeam !== undefined) {
      tameBearStep(G, b);
      continue;
    }
    if (b.worm) {
      wildWormStep(G, b, byId);
      continue;
    }
    b.cd -= DT;
    b.mv = 0;
    b.at = (b.at || 0) - DT;
    let tg = null,
      bd = 64;
    for (const u of G.units) {
      if (u.hp <= 0 || u.fall > 0 || u.pj || u.grab || u.bur) continue;
      const d2 = (u.x - b.x) ** 2 + (u.z - b.z) ** 2;
      if (d2 < bd) {
        bd = d2;
        tg = u;
      }
    }
    let tx = b.x,
      tz = b.z,
      sp = 2.2;
    if (b.wind > 0) {
      // paw raised: the swipe lands after a visible wind-up, so you can step back
      b.wind -= DT;
      tx = b.x;
      tz = b.z;
      if (b.wind <= 0) {
        b.wind = 0;
        const v = G.units.find(o => o.id === b.windT && o.hp > 0 && !o.pj && !o.air && !o.grab && !o.bur);
        b.atk = (b.atk + 1) % 100;
        b.cd = 1.05;
        if (v && (v.x - b.x) ** 2 + (v.z - b.z) ** 2 < 2.8 * 2.8) {
          v.hp -= 34 * (b.dm ?? 1) * (v.poss ? CFG.possArmor : 1);
          v.hurt = 2.5;
          v.lh = [-4, b.tameTeam ?? -1, 0];
          if (!KINDS[v.k].bear && KINDS[v.k].role !== 'siege') knockFly(v, b.x, b.z, v.poss ? 2 : 3, undefined, undefined, 0, 'hazard');
        }
      }
    } else if (tg) {
      tx = tg.x;
      tz = tg.z;
      sp = 4.7;
      const d = Math.sqrt(bd);
      if (d < 2.0) {
        tx = b.x;
        tz = b.z;
        if (b.cd <= 0) {
          b.wind = 0.4;
          b.windT = tg.id;
          b.raise = ((b.raise || 0) + 1) % 100;
          b.yaw = Math.atan2(tg.x - b.x, tg.z - b.z);
        }
      }
    } else {
      b.wt -= DT;
      if (b.wt <= 0 || b.wx === undefined || Math.hypot(b.wx - b.x, b.wz - b.z) < 1) {
        b.wt = 6 + Math.random() * 8;
        for (let k = 0; k < 8; k++) {
          const q = nearestWalkable(
            MAP,
            (Math.random() - 0.5) * 2 * (HALF_W - 3),
            clamp(b.z + (Math.random() - 0.5) * 50, -HALF_H + 22, HALF_H - 22)
          );
          if (BASES.every(B => Math.hypot(B.x - q.x, B.z - q.z) > 24)) {
            b.wx = q.x;
            b.wz = q.z;
            break;
          }
        }
      }
      tx = b.wx;
      tz = b.wz;
    }
    const dx = tx - b.x,
      dz = tz - b.z,
      d = Math.hypot(dx, dz);
    if (d > 0.3) {
      if (!b.path || b.repath <= 0 || Math.hypot((b.pgx || 0) - tx, (b.pgz || 0) - tz) > 3) {
        b.repath = 1.5;
        b.pgx = tx;
        b.pgz = tz;
        b.path = los(b.x, b.z, tx, tz) ? null : pathOK(G) && G.astarBudget-- > 0 ? findPath(b.x, b.z, tx, tz, false) : b.path;
      }
      b.repath -= DT;
      let wx = tx,
        wz = tz;
      if (b.path && b.path.length) {
        if (Math.hypot(b.path[0][0] - b.x, b.path[0][1] - b.z) < 1 && b.path.length > 1) b.path.shift();
        wx = b.path[0][0];
        wz = b.path[0][1];
      }
      const ddx = wx - b.x,
        ddz = wz - b.z,
        dd = Math.hypot(ddx, ddz) || 1,
        st = Math.min(dd, sp * DT),
        nx = b.x + (ddx / dd) * st,
        nz = b.z + (ddz / dd) * st;
      if (walkable(nx, nz)) {
        b.x = nx;
        b.z = nz;
        b.mv = sp > 3 ? 2 : 1;
      } else b.path = null;
      b.yaw = Math.atan2(ddx, ddz);
    }
  }
  if (G.bears.some(b => b.tameDone)) G.bears = G.bears.filter(b => !b.tameDone);
  // pickups at the map edges (money bags, disco grenades) – only ego warriors can collect them
  if (!G.tut) {
    G.itemT -= DT;
    if (G.itemT <= 0 && G.items.length < 4) {
      G.itemT = (G.chaos ? 16 : 24) + Math.random() * 18;
      const inc = [0, 1].map(i => incomeOf(G, i)),
        poor = inc[0] < inc[1] ? 0 : inc[1] < inc[0] ? 1 : Math.random() < 0.5 ? 0 : 1,
        side = Math.random() < 0.62 ? poor : 1 - poor;
      for (let tries = 0; tries < 12; tries++) {
        const sx = Math.random() < 0.5 ? -1 : 1,
          x = sx * (HALF_W - 2.5 - Math.random() * 6),
          z = (side ? -1 : 1) * (8 + Math.random() * 46),
          p = nearestWalkable(MAP, x, z);
        if (
          !landIn(MAP, p.x, p.z) ||
          G.items.some(it => Math.hypot(it.x - p.x, it.z - p.z) < 6) ||
          (MAP.cacti || []).some(c => Math.hypot(c.x - p.x, c.z - p.z) < 2)
        )
          continue;
        G.itemId = (G.itemId + 1) % 10000;
        G.items.push({ id: G.itemId, ty: Math.random() < 0.42 ? 1 : 0, v: Math.round((50 + Math.random() * 70) / 5) * 5, x: p.x, z: p.z });
        break;
      }
    }
  }
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    for (const u of G.units) {
      if (!u.poss || u.hp <= 0 || u.grab || u.bur) continue;
      if (Math.hypot(u.x - it.x, u.z - it.z) < 1.7) {
        const T = G.teams[u.team];
        if (it.ty === 1) T.nades = (T.nades || 0) + 1;
        else T.gold += it.v;
        G.peS = (G.peS + 1) % 10000;
        G.pe.push([G.peS, u.team, it.ty, it.v, Math.round(it.x * 10), Math.round(it.z * 10)]);
        if (G.pe.length > 6) G.pe.shift();
        G.items.splice(i, 1);
        break;
      }
    }
  }
}
function step(G) {
  if (G.over >= 0) return;
  if (G.cd > 0) {
    G.cd = Math.max(0, G.cd - DT);
    return;
  }
  if (G.pz > 0) {
    perkPause(G);
    return;
  }
  G.t += DT;
  G.astarBudget = 8;
  G.astarT0 = performance.now();
  SIMG = G;
  perkStep(G);
  {
    const ph = phaseOf(G);
    if (ph !== G.phase) {
      G.phase = ph;
      highlight(G, 'phase', -1, ph, 0, 0);
    }
  }
  if (!G.tut && G.t >= CFG.crumbleT) {
    if (!G.crumble) {
      G.crumble = 1;
      highlight(G, 'phase', -1, 3, 0, 0);
    }
    for (const T of G.teams) T.hp -= CFG.crumble * DT;
  } // safety net: no endless stalemates
  const byId = G.unitIndex || (G.unitIndex = new Map());
  byId.clear();
  for (const u of G.units) byId.set(u.id, u);
  worldStep(G, byId);
  for (let i = 0; i < 2; i++) {
    const T = G.teams[i];
    T.gold += incomeOf(G, i) * DT;
    const en = FAC[T.fac].kinds.filter(k => T.auto[k]);
    if (en.length) autoQueue(G, i, T, en);
    if (T.q.length) {
      T.qt += DT;
      if (T.qt >= buildTime(G, i, T.q[0])) {
        const k = T.q.shift();
        if (T.qm > 0) T.qm--;
        spawnUnit(G, i, k);
        if (pkL(G, i, 'twins') && KINDS[k].role !== 'siege') {
          T.twN = (T.twN || 0) + 1;
          if (T.twN % 4 === 0) spawnUnit(G, i, k);
        }
        T.qt = 0;
      }
    } else T.qt = 0;
  }
  // Simultaneous resolution: everyone alive at the start of the tick acts this tick, so list order never decides a duel.
  for (const u of G.units) {
    u.a0 = u.hp > 0;
    if (u.frenzy > 0) u.frenzy -= DT;
    if (u.slowT > 0) u.slowT -= DT;
  }
  for (const u of G.units) {
    if (u.grab) {
      if (u.a0) grabHold(G, u, byId);
      continue;
    }
    if (u.hero) {
      if (u.a0) heroStep(G, u, byId);
      continue;
    }
    if (u.heroBy) {
      if (u.a0) heroHeldStep(G, u);
      continue;
    } // an enemy worm unit with a hero on it
    if (u.ramQ && u.a0) ramTick(G, u, byId);
    if (u.pj && u.poss && u.a0 && KINDS[u.k].role === 'cav') {
      const In = G.teams[u.team].posIn; // air dash: the rider leaves the pad arc and rams on landing
      if (In && In.id === u.id && In.s !== u.ls && u.spcd <= 0.3) {
        u.ls = In.s;
        const fx = Math.sin(In.y ?? u.yaw),
          fz = Math.cos(In.y ?? u.yaw);
        u.yaw = In.y ?? u.yaw;
        u.pj = null;
        u.jumpT = 0;
        u.padCd = 0.8;
        delete u.navPad;
        delete u.consumePad;
        startAir(u, fx * 20, fz * 20, 1.5, 'dash');
        u.airRam = 1;
        u.dashUntil = G.t + 2;
        u.spcd = 0.1;
      }
    }
    if (!u.a0 || u.air || u.fall > 0 || u.pj) {
      if (u.poss && u.lhx !== undefined) {
        const In = G.teams[u.team].posIn;
        if (In && In.id === u.id) u.lhx = In.h || 0;
      }
      continue;
    } // a hero press in the air is used up
    if (u.poss) {
      possStep(G, u, byId);
      continue;
    }
    const K = KINDS[u.k],
      o = u.ord;
    u.cd -= DT;
    u.re -= DT;
    u.vx = 0;
    u.vz = 0;
    u.hurt = (u.hurt || 0) - DT;
    if (u.dance > 0) {
      u.dance -= DT;
      continue;
    }
    if (u.tutStill && !(u.down > 0)) {
      u.cd = 99;
      continue;
    }
    if (u.down > 0) {
      u.down -= DT;
      const kb = u.kb;
      if (kb && kb.left > 0) kbStep(u, kb);
      if (u.down <= 0) {
        u.kb = null;
        u.re = 0;
        u.path = null;
      }
      continue;
    }
    if (K.worm && wormUnitStep(G, u, byId)) continue;
    if (u.wind) {
      u.wind.t -= DT;
      if (u.wind.t <= 0) {
        const w = u.wind,
          dd = Math.hypot(w.tx - u.x, w.tz - u.z),
          hw = siegeImpact(u.team, u.x, u.z, w.tx, w.tz);
        G.proj.push({
          sx: u.x,
          sz: u.z,
          t: Math.max(0.6, dd / K.pspeed) * Math.max(0.4, hw.k),
          dmg: K.dmg * (u.chick > 0 ? 0.3 : 1),
          tgt: w.tgt,
          team: u.team,
          k: u.k,
          aoe: K.aoe,
          tx: hw.tx,
          tz: hw.tz,
        });
        u.wind = null;
      }
      continue;
    }
    if (u.hp < maxHp(u) && (u.x - BASES[u.team].x) ** 2 + (u.z - BASES[u.team].z) ** 2 < CFG.healR * CFG.healR)
      u.hp = Math.min(maxHp(u), u.hp + CFG.heal * DT);
    if (G.chaos && pkL(G, u.team, 'heal')) u.hp = Math.min(maxHp(u), u.hp + 5 * DT);
    const hurt = u.hurt > 0,
      leash = hurt ? CFG.leash + 12 : CFG.leash,
      scan = (hurt ? Math.max(K.aggro, 13.5) : K.aggro) + desertRange(K);
    if (o.mv && Math.hypot(o.x - u.x, o.z - u.z) < 1.2) o.mv = false;
    let tgt = u.tgt > 0 ? byId.get(u.tgt) : null;
    if (o.target > 0) {
      const explicit = byId.get(o.target);
      if (explicit && explicit.hp > 0 && explicit.team !== u.team) {
        u.tgt = explicit.id;
        tgt = explicit;
      } else {
        delete o.target;
        u.tgt = -1;
        tgt = null;
        u.re = 0;
      }
    }
    if (u.tgt > 0 && (!tgt || tgt.hp <= 0 || (o.target === undefined && Math.hypot(tgt.x - o.x, tgt.z - o.z) > leash + 3))) {
      tgt = null;
      u.tgt = -1;
      u.re = 0;
    }
    if (o.mv || u.navPad !== undefined) {
      u.tgt = -1;
      tgt = null;
    } else if (o.target === -2) {
      u.tgt = -2;
      tgt = null;
    } else if (o.target > 0 && tgt) {
    } else if (u.re <= 0) {
      u.re = 0.3;
      let best = null,
        bd = scan * scan;
      let bs = 1e9;
      for (const e of G.units) {
        if (e.team === u.team || e.hp <= 0 || e.tutDummy || e.pj || e.air || e.grab || e.bur) continue;
        const d = (e.x - u.x) ** 2 + (e.z - u.z) ** 2;
        if (d < bd && Math.hypot(e.x - o.x, e.z - o.z) < leash) {
          const sc =
            d *
            (isCounter(u.k, e.k) ? 0.45 : 1) *
            (tgt && e === tgt ? 0.55 : 1) *
            (K.role === 'siege' && MAP.ice && onIce(e.x, e.z) ? 0.7 : 1);
          if (sc < bs) {
            bs = sc;
            best = e;
          }
        }
      }
      if (!best && G.bears.length) {
        let bb = null,
          bbd = Math.min(scan, 9) ** 2;
        for (const b of G.bears) {
          if (!bearHere(b) || b.tameTeam !== undefined) continue;
          const d2 = (b.x - u.x) ** 2 + (b.z - u.z) ** 2;
          if (d2 < bbd && (b.at > 0 || d2 < 36)) {
            bbd = d2;
            bb = b;
          }
        }
        if (bb) {
          u.tgt = -3;
          u.btg = bb.id;
        }
      }
      if (best) {
        u.tgt = best.id;
        tgt = best;
      } else if (u.tgt === -3) {
      } else {
        const eb = BASES[1 - u.team];
        u.tgt = baseGap(eb, u.x, u.z) < K.aggro && Math.hypot(eb.x - o.x, eb.z - o.z) < CFG.leash + 6 ? -2 : -1;
        tgt = null;
      }
    }
    let tx, tz, tr, ty;
    if (tgt) {
      tx = tgt.x;
      tz = tgt.z;
      tr = 0.5;
      ty = tgt.y;
    } else if (u.tgt === -3) {
      const b = G.bears.find(o => o.id === u.btg && bearHere(o) && o.tameTeam === undefined);
      if (b) {
        tx = b.x;
        tz = b.z;
        tr = b.worm ? 1.5 : 0.9;
        ty = groundY(b.x, b.z);
      } else u.tgt = -1;
    } else if (u.tgt === -2) {
      const eb = BASES[1 - u.team];
      tx = clamp(u.x, eb.x - 6.6, eb.x + 6.6);
      tz = clamp(u.z, eb.z - 3.6, eb.z + 3.6);
      tr = 0;
      ty = groundY(eb.x, eb.z);
    }
    if (tx !== undefined) {
      const dist = Math.hypot(tx - u.x, tz - u.z),
        d = dist - tr;
      const range = K.range + desertRange(K) + (K.role === 'ranged' && u.y - ty > 1.2 ? CFG.hillBonus : 0) + (u.eng > 0 ? 0.45 : 0);
      u.eng = (u.eng || 0) - DT;
      if (d <= range) {
        u.eng = 0.5;
        if (u.cd <= 0) {
          const rage = u.k === 0 && G.chaos && u.hp < maxHp(u) * 0.6 && pkL(G, u.team, 'walhalla'); // Walhalla-Raserei: battered Berserkers rage
          u.cd = K.cd * (u.frenzy > 0 ? 0.85 : 1) * (rage ? 0.6 : 1);
          u.atk = (u.atk + 1) % 100;
          if (rage && !u.rageV) {
            u.rageV = 1;
            u.sp = (u.sp + 1) % 100; // shows the rage on every screen
          }
          u.at = tgt ? tgt.id : -2;
          const charge = K.role === 'cav' && u.run > 1.2 ? (u.k === 5 ? 1.55 : 1.4) : 1;
          const hm = homeMul(G, u);
          if (u.tgt === -3) {
            const b = G.bears.find(o => o.id === u.btg);
            u.at = -3;
            if (K.proj) G.proj.push({ t: dist / K.pspeed, dmg: K.dmg, tgt: -3, bear: u.btg, team: u.team, k: u.k, aoe: K.aoe, tx, tz });
            else hitBear(G, b, K.dmg * charge, u.team, u.k);
          } else if (K.proj && K.role === 'siege')
            u.wind = { t: SIEGE_WIND, tx, tz, tgt: u.at }; // the arm winds up first: everyone can see it coming
          else if (K.proj) {
            G.proj.push({
              sx: u.x,
              sz: u.z,
              t: dist / K.pspeed,
              dmg: K.dmg * hm * (u.chick > 0 ? 0.3 : 1),
              tgt: u.at,
              team: u.team,
              k: u.k,
              aoe: K.aoe,
              tx,
              tz,
            });
            if (tgt && G.chaos && pkL(G, u.team, 'volley')) {
              // Salvenhölle: every shot is a double shot – at a second foe in range if there is one
              let t2 = tgt;
              for (const e of G.units)
                if (e !== tgt && e.team !== u.team && e.hp > 0 && (e.x - u.x) ** 2 + (e.z - u.z) ** 2 < range * range) {
                  t2 = e;
                  break;
                }
              const d2 = Math.hypot(t2.x - u.x, t2.z - u.z);
              G.proj.push({
                sx: u.x,
                sz: u.z,
                t: d2 / K.pspeed + 0.08,
                dmg: K.dmg * hm,
                tgt: t2.id,
                team: u.team,
                k: u.k,
                tx: t2.x,
                tz: t2.z,
              });
            }
          } else {
            hit(G, u.at, K.dmg * hm * charge * (u.chick > 0 ? 0.3 : 1) * (rage ? 1.5 : 1), u.team, byId, u.k);
            traitHit(G, u, tgt, charge > 1);
            if (tgt && rage) {
              const t3 = byId.get(u.at);
              if (
                t3 &&
                t3.hp > 0 &&
                !KINDS[t3.k].bear &&
                KINDS[t3.k].role !== 'siege' &&
                knockFly(t3, u.x, u.z, 2.6, undefined, undefined, 0, 'ai')
              )
                t3.kbTeam = u.team;
            }
            if (u.k === 2 && G.chaos && pkL(G, u.team, 'spin') && G.t >= (u.spinA || 0)) {
              // Tornado-Opa: in a fight the Opa whirls his stick every 6 s and knocks everyone around him back
              u.spinA = G.t + 6;
              u.sp = (u.sp + 1) % 100;
              enemiesInCone(G, u, 3.4, Math.PI).forEach(c => {
                hit(G, c.e.id, 20, u.team, byId, u.k);
                if (!KINDS[c.e.k].bear && KINDS[c.e.k].role !== 'siege' && knockFly(c.e, u.x, u.z, 2.6, undefined, undefined, 0, 'ai'))
                  c.e.kbTeam = u.team;
              });
            }
          }
          u.run = 0;
        }
      } else {
        const approach = u.tgt === -2 ? u.baseSlot || (u.baseSlot = baseApproach(u)) : null;
        steer(
          G,
          u,
          approach ? approach.x : tx,
          approach ? approach.z : tz,
          K.speed * (K.role === 'cav' ? pk(G, u.team, 'cavspd', [1, 1.5]) : 1)
        );
      }
    } else if (u.navPad !== undefined || Math.hypot(o.x - u.x, o.z - u.z) > 0.3)
      steer(G, u, o.x, o.z, K.speed * (K.role === 'cav' ? pk(G, u.team, 'cavspd', [1, 1.5]) : 1));
    const ox = u.x,
      oz = u.z;
    {
      const icy = onIce(u.x, u.z),
        sw = (icy ? 1 : inWater(u.x, u.z) ? 0.4 : wadeAt(u.x, u.z) ? 0.82 : 1) * (u.cold > 0 ? 0.88 : 1);
      iceVelocity(u, u.vx, u.vz, DT);
      u.vx = u.ivx;
      u.vz = u.ivz;
      let nx = u.x + u.vx * DT * sw,
        nz = u.z + u.vz * DT * sw;
      if (MAP.cliff && !(u.kb && u.kb.left > 0) && !(u.dashUntil > G.t) && fallZone(nx, nz) && !fallZone(u.x, u.z)) {
        const r = railing(u.x, u.z, nx, nz);
        nx = r.x;
        nz = r.z;
      } // walking units stop at the edge (bridge rail / cliff rim)
      if (Math.abs(u.vx) + Math.abs(u.vz) > 0.001 && (fallZone(nx, nz) || (unitY(u.x, u.z) - unitY(nx, nz) > 1.2 && edgeSlide(nx, nz)))) {
        advanceGround(u, nx, nz, u.vx * sw, u.vz * sw, DT);
        if (u.air || u.hp <= 0) continue;
      } else {
        u.x = nx;
        u.z = nz;
      }
    }
    if (!walkable(u.x, u.z)) {
      if (walkable(u.x, oz)) u.z = oz;
      else if (walkable(ox, u.z)) u.x = ox;
      else {
        u.x = ox;
        u.z = oz;
        let moved = false;
        for (const ang of [0.6, -0.6, 1.2, -1.2, 1.7, -1.7]) {
          const c = Math.cos(ang),
            sn = Math.sin(ang),
            vx = (u.vx * c - u.vz * sn) * DT,
            vz = (u.vx * sn + u.vz * c) * DT;
          if (walkable(ox + vx, oz + vz)) {
            u.x = ox + vx;
            u.z = oz + vz;
            moved = true;
            break;
          }
        }
        if (!moved) {
          u.path = null;
          u.repath = 0;
          u.losT = 0;
        }
      }
    }
    u.run = u.vx || u.vz ? u.run + DT : Math.max(0, u.run - DT * 2);
    const wantMv = Math.hypot(u.vx, u.vz) * DT,
      gotMv = Math.hypot(u.x - ox, u.z - oz);
    if (wantMv > 0.02 && gotMv < wantMv * 0.3) {
      u.stuckT = (u.stuckT || 0) + DT;
      if (u.tgt === -1 && Math.hypot(u.ord.x - u.x, u.ord.z - u.z) < 2.6 && u.stuckT > 0.25) {
        u.ord = { x: u.x, z: u.z, mv: false };
        u.stuckT = 0;
      } else if (u.stuckT > 0.35) {
        u.stuckT = 0;
        u.forcePath = 2.5;
        u.path = null;
        u.repath = 0;
        u.losT = 0;
      }
    } else u.stuckT = Math.max(0, (u.stuckT || 0) - DT);
  }
  const us = G.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i],
      ra = KINDS[a.k].r;
    if (a.pj || a.fall > 0 || a.hp <= 0 || a.grab || a.bur) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (b.pj || b.fall > 0 || b.hp <= 0 || b.grab || b.bur) continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d2 = dx * dx + dz * dz,
        rr = ra + KINDS[b.k].r + 0.1;
      if (d2 < rr * rr) {
        if (d2 < 1e-6) {
          if (!a.poss) a.x += 0.05;
          continue;
        }
        const d = Math.sqrt(d2),
          ov = rr - d,
          nx = dx / d,
          nz = dz / d,
          rb = KINDS[b.k].r,
          ma = ra * ra,
          mb = rb * rb;
        const sa = KINDS[a.k].role === 'siege',
          sb = KINDS[b.k].role === 'siege';
        if (sa !== sb && a.team === b.team) continue;
        let wa = a.poss ? 0 : b.poss ? 1 : sa !== sb ? (sa ? 0 : 1) : mb / (ma + mb),
          wb = b.poss ? 0 : a.poss ? 1 : sa !== sb ? (sb ? 0 : 1) : ma / (ma + mb);
        if (a.eng > 0 && !(b.eng > 0) && !b.poss) {
          wa *= 0.3;
          wb = 1 - wa;
        } else if (b.eng > 0 && !(a.eng > 0) && !a.poss) {
          wb *= 0.3;
          wa = 1 - wb;
        }
        const soft = a.team === b.team ? 0.45 : 0.6,
          pa = ov * wa * soft,
          pb = ov * wb * soft;
        if (pa > 0.002) {
          const ax = a.x - nx * pa,
            az = a.z - nz * pa;
          if (walkable(ax, az) && !(MAP.cliff && fallZone(ax, az) && !fallZone(a.x, a.z))) {
            a.x = ax;
            a.z = az;
          }
        }
        if (pb > 0.002) {
          const bx = b.x + nx * pb,
            bz = b.z + nz * pb;
          if (walkable(bx, bz) && !(MAP.cliff && fallZone(bx, bz) && !fallZone(b.x, b.z))) {
            b.x = bx;
            b.z = bz;
          }
        }
      }
    }
    a.x = clampX(a.x);
    a.z = clampZ(a.z);
    if (!walkable(a.x, a.z) && !a.pj && !a.fall && !a.air && !a.poss && !(a.kb && a.kb.left > 0 && a.down > 0)) {
      const p = nearestWalkableBelow(a.x, a.z),
        dx = p.x - a.x,
        dz = p.z - a.z,
        d = Math.hypot(dx, dz);
      if (d < 0.6) {
        a.x = p.x;
        a.z = p.z;
      } else {
        a.x += (dx / d) * 0.6;
        a.z += (dz / d) * 0.6;
      }
    } // slide off, never pop back up a cliff
    a.y = a.fy = unitY(a.x, a.z);
  }
  for (const p of G.proj) {
    p.t -= DT;
    if (p.t > 0) continue;
    if (p.aoe && G.bears.length) {
      if (KINDS[p.k] && KINDS[p.k].role === 'siege') bearKillAt(G, p.tx, p.tz, p.aoe, p.team);
    }
    if (p.bear !== undefined && !p.aoe) {
      hitBear(
        G,
        G.bears.find(o => o.id === p.bear),
        p.dmg,
        p.team,
        p.k
      );
      continue;
    }
    if (p.aoe) {
      const sg = KINDS[p.k] && KINDS[p.k].role === 'siege';
      for (const e of us) {
        if (e.team === p.team || e.hp <= 0 || e.grab || e.bur) continue;
        const dd = Math.hypot(e.x - p.tx, e.z - p.tz);
        if (dd >= p.aoe) continue;
        if (!sg) {
          hit(G, e.id, p.dmg, p.team, byId, p.k, p.bp);
          continue;
        }
        if (KINDS[e.k].bear) {
          e.squash = 1;
          hit(G, e.id, e.hp * 10 + 9999, p.team, byId, -1, p.bp);
          continue;
        }
        if (KINDS[e.k].worm) {
          hit(G, e.id, p.dmg * (dd < 1.6 ? 2.6 : 1.2), p.team, byId, p.k, p.bp);
          continue;
        } // too big to squash
        if (p.bp && dd < 0.45 && KINDS[e.k].role !== 'siege' && !(e.down > 0)) {
          hit(G, e.id, p.dmg * 2.2, p.team, byId, p.k, p.bp, true);
          e.squash = 0;
          continue;
        } // ego catapult: a direct hit on the head
        const core = 0.6 + KINDS[e.k].r;
        if (dd < core && KINDS[e.k].role === 'siege') {
          e.squash = 0;
          hit(G, e.id, (maxHp(e) * 0.5) / (e.poss ? CFG.possArmor : 1), p.team, byId, -1, p.bp);
          continue;
        }
        if (dd < core) {
          e.squash = 1;
          hit(G, e.id, e.hp * 10 + 9999, p.team, byId, -1, p.bp);
          continue;
        }
        const f = 1 - (dd - core) / Math.max(0.5, p.aoe - core);
        hit(G, e.id, p.dmg * (0.2 + 1.3 * f * f), p.team, byId, p.k, p.bp);
      }
      const eb = BASES[1 - p.team];
      if (baseGap(eb, p.tx, p.tz) < p.aoe) hit(G, -2, p.dmg, p.team, byId, p.k);
      if (sg && MAP.ice) iceImpact(G, p.tx, p.tz, clamp(p.aoe * 0.48, 1.4, 2.4), p.team);
      if (sg) {
        const K = KINDS[p.k],
          sx = p.sx ?? BASES[p.team].x,
          sz = p.sz ?? BASES[p.team].z,
          ddx = p.tx - sx,
          ddz = p.tz - sz,
          dl = Math.hypot(ddx, ddz) || 1; // the shot's direction decides where the rock rolls on
        if (K.proj === 'boulder' && walkable(p.tx, p.tz) && !(MAP.ice && onIce(p.tx, p.tz)))
          G.rolls.push({
            id: (G.rollId = (G.rollId + 1) % 1000),
            x: p.tx,
            z: p.tz,
            dx: ddx / dl,
            dz: ddz / dl,
            v: 11,
            t: 0,
            ang: 0,
            team: p.team,
            hits: 0,
          });
        else if (K.proj === 'cake')
          G.goo.push({ id: (G.gooId = (G.gooId + 1) % 1000), x: p.tx, z: p.tz, r: 3.6, t: 9, t0: 9, team: p.team });
      }
    } else hit(G, p.tgt, p.dmg, p.team, byId, p.k, p.bp);
  }
  for (const p of G.fp) {
    const n = 8,
      sd = (CFG.arrowSpeed * DT) / n,
      eb = BASES[1 - p.team];
    for (let i = 0; i < n && p.t > 0; i++) {
      p.x += p.dx * sd;
      p.y += p.dy * sd;
      p.z += p.dz * sd;
      if (p.y < Math.max(WL, groundY(p.x, p.z)) || Math.abs(p.x) > HALF_W + 4 || Math.abs(p.z) > HALF_H + 4) {
        p.t = 0;
        break;
      }
      if (baseGap(eb, p.x, p.z) < 0.3 && p.y < groundY(eb.x, eb.z) + 6 && !p.nb) {
        hit(G, -2, p.dmg, p.team, byId, p.k);
        p.t = 0;
        break;
      }
      {
        let hb2 = null,
          hd = false;
        for (const b of G.bears) {
          if (!bearHere(b)) continue;
          const by = groundY(b.x, b.z);
          if (b.worm) {
            const wh = wormHead(b, false, b.yaw || 0);
            if (wh && (p.x - wh.x) ** 2 + (p.z - wh.z) ** 2 + (p.y - wh.y) ** 2 < wh.r * wh.r) {
              hb2 = b;
              hd = true;
              b.hdY = wh.y;
              break;
            }
            if ((p.x - b.x) ** 2 + (p.z - b.z) ** 2 < 2.6 && p.y > by && p.y < by + 6.5) {
              hb2 = b;
              break;
            }
            continue;
          }
          const hx = b.x + Math.sin(b.yaw) * 1.4,
            hz = b.z + Math.cos(b.yaw) * 1.4;
          if ((p.x - hx) ** 2 + (p.z - hz) ** 2 + (p.y - by - 1.45) ** 2 < 0.36) {
            hb2 = b;
            hd = true;
            break;
          }
          if ((p.x - b.x) ** 2 + (p.z - b.z) ** 2 < 1.4 && p.y > by && p.y < by + 2.2) {
            hb2 = b;
            break;
          }
        }
        if (hb2) {
          hitBear(G, hb2, p.dmg, p.team, p.k, true, hd);
          p.t = 0;
          break;
        }
      }
      for (const e of us) {
        if (e.team === p.team || e.hp <= 0 || e.grab || e.bur) continue;
        const dx = p.x - e.x,
          dz = p.z - e.z,
          h2 = dx * dx + dz * dz;
        if (h2 > (KINDS[e.k].worm ? 36 : 9)) continue;
        if (KINDS[e.k].worm) {
          const tg = e.tgt > 0 ? byId.get(e.tgt) : null,
            fy = e.poss
              ? e.yaw
              : tg
                ? Math.atan2(tg.x - e.x, tg.z - e.z)
                : Math.hypot(e.vx || 0, e.vz || 0) > 0.1
                  ? Math.atan2(e.vx, e.vz)
                  : (e.fyaw ?? 0),
            wh = wormHead(e, true, fy);
          e.fyaw = fy;
          if (wh && (p.x - wh.x) ** 2 + (p.z - wh.z) ** 2 + (p.y - wh.y) ** 2 < wh.r * wh.r) {
            e.hdY = wh.y;
            hit(G, e.id, p.dmg * WORM_HEAD_MUL, p.team, byId, p.k, true, true);
            p.t = 0;
            break;
          }
          if (h2 < 2.6 && p.y > e.y - 0.2 && p.y < e.y + 4.8) {
            hit(G, e.id, p.dmg, p.team, byId, p.k, true, false);
            p.t = 0;
            break;
          }
          continue;
        }
        if (KINDS[e.k].bear) {
          const tg = e.tgt > 0 ? byId.get(e.tgt) : null,
            fy = e.poss
              ? e.yaw
              : tg
                ? Math.atan2(tg.x - e.x, tg.z - e.z)
                : Math.hypot(e.vx || 0, e.vz || 0) > 0.1
                  ? Math.atan2(e.vx, e.vz)
                  : (e.fyaw ?? 0);
          e.fyaw = fy;
          const hr = 0.36 * (e.poss ? (1.35 * (e.hs || 1)) / 0.62 : 1),
            hx = e.x + Math.sin(fy) * 1.47,
            hz = e.z + Math.cos(fy) * 1.47,
            hy2 = e.y + 1.8;
          if ((p.x - hx) ** 2 + (p.z - hz) ** 2 + (p.y - hy2) ** 2 < (hr + 0.12) ** 2 && !(e.down > 0)) {
            hit(G, e.id, p.dmg * CFG.headMul, p.team, byId, p.k, true, true);
            p.t = 0;
            break;
          }
          if (h2 < 1.3 && p.y > e.y && p.y < e.y + 2.1) {
            hit(G, e.id, p.dmg, p.team, byId, p.k, true, false);
            p.t = 0;
            break;
          }
          continue;
        }
        const hb = headBox(e),
          hy = e.y + hb.y,
          R = KINDS[e.k].r * 0.9;
        if (KINDS[e.k].role !== 'siege' && h2 + (p.y - hy) ** 2 < (hb.r * 1.12) ** 2 && !(e.down > 0)) {
          hit(G, e.id, p.dmg * CFG.headMul, p.team, byId, p.k, true, true);
          p.t = 0;
          break;
        }
        if (h2 < R * R && p.y > e.y - 0.2 && p.y < hy - hb.r * 0.5) {
          hit(G, e.id, p.dmg, p.team, byId, p.k, true, false);
          p.t = 0;
          break;
        }
      }
    }
    p.t -= DT;
  }
  G.fp = G.fp.filter(p => p.t > 0);
  G.proj = G.proj.filter(p => p.t > 0);
  for (let i = 0; i < 2; i++) {
    const T = G.teams[i],
      b = BASES[i];
    T.tcd -= DT;
    if (T.tcd <= 0 && !G.towerOff[i]) {
      let best = null,
        bd = CFG.towerRange * CFG.towerRange;
      let bs = 1e9;
      for (const e of us) {
        if (e.team === i || e.hp <= 0 || e.grab || e.bur) continue;
        const d = (e.x - b.x) ** 2 + (e.z - b.z) ** 2;
        if (d < (e.poss ? CFG.towerPossRange : CFG.towerRange) ** 2 && d * (e.poss ? 0.25 : 1) < bs) {
          bs = d * (e.poss ? 0.25 : 1);
          bd = d;
          best = e;
        }
      }
      if (best) {
        T.tcd = CFG.towerCd * pk(G, i, 'tower', [1, 0.65]);
        T.tatk = (T.tatk + 1) % 100;
        T.ttgt = best.id;
        G.proj.push({
          t: Math.sqrt(bd) / CFG.towerSpeed,
          dmg: CFG.towerDmg * G.towerMul[i] * CFG.phaseTower[G.phase || 0] * pk(G, i, 'tower', [1, 2.3]) * (best.poss ? CFG.towerPoss : 1),
          tgt: best.id,
          team: i,
          k: -1,
        });
      }
    }
  }
  for (const u of us) if (u.hp <= 0 && u.poss) egoCooldownsKeep(G, G.teams[u.team], u); // the fallen ego's cooldowns carry over to the next
  for (const u of us)
    if (u.hp <= 0 && u.poss && !u.rushed && u.egoHit && u.egoHit.team !== u.team) {
      const h = u.egoHit,
        alive = G.units.some(v => v.id === h.pid && v.hp > 0);
      if (G.t - h.t <= (alive ? 2 : 1)) giveRush(G, h.team, u);
    }
  for (const u of us)
    if (u.hp <= 0 && (u.squash || u.smash || u.fallen || u.air || u.swal)) {
      G.dzS = ((G.dzS || 0) + 1) % 10000;
      (G.dz || (G.dz = [])).push([
        G.dzS,
        u.id,
        u.swal ? 4 : u.fallen || u.air ? 3 : u.squash ? 1 : 2,
        Math.round(u.x * 10),
        Math.round(u.y * 10),
        Math.round(u.z * 10),
        Math.round((u.air ? u.air.vx : 0) * 100),
        Math.round((u.air ? u.air.vy : 0) * 100),
        Math.round((u.air ? u.air.vz : 0) * 100),
      ]);
      if (G.dz.length > 64) G.dz.shift();
    }
  for (const u of us)
    if (u.hp <= 0 && !u.kfd) {
      u.kfd = 1;
      if (G.chaos && pkL(G, u.team, 'revive') && KINDS[u.k].role !== 'siege' && !KINDS[u.k].bear && !KINDS[u.k].worm) {
        // Unkraut vergeht nicht: every third fallen warrior comes back at the base after 4 s
        const T = G.teams[u.team];
        T.revN = (T.revN || 0) + 1;
        if (T.revN % 4 === 0) (T.revQ || (T.revQ = [])).push([G.t + 4, u.k]);
      }
      const lh = u.lh || [-9, -1, 0],
        cause = u.swal
          ? lh[0] === -8
            ? 13
            : 11
          : lh[0] === -7
            ? 12
            : u.fallen || u.air
              ? 3
              : u.squash
                ? 1
                : u.smash
                  ? 2
                  : u.inHole || u.cold > 0
                    ? 6
                    : lh[0] === -2
                      ? 7
                      : lh[0] === -3
                        ? 8
                        : lh[0] === -4
                          ? 9
                          : lh[0] === -5
                            ? 10
                            : lh[0] === -1
                              ? 5
                              : lh[2]
                                ? 4
                                : 0;
      const kt = cause === 3 ? (u.kbTeam ?? lh[1]) : lh[1];
      G.kfS = ((G.kfS || 0) + 1) % 10000;
      (G.kf || (G.kf = [])).push([G.kfS, u.k, kt ?? -1, lh[0] >= 0 ? lh[0] : -1, cause, u.poss ? 1 : 0]);
      if (G.kf.length > 6) G.kf.shift();
    }
  if (G.st)
    for (const u of us)
      if (u.hp <= 0 && !u.counted) {
        u.counted = 1;
        G.st[u.team].lost++;
        if ((u.fallen || u.air) && u.kbTeam !== undefined && G.t - (u.kbT || -9) < 6) {
          const tm = u.kbTeam;
          G.st[tm].cliff++;
          const cr = G.cliffRun;
          if (cr && cr.team === tm && G.t - cr.t < 2.5) {
            cr.n++;
            cr.t = G.t;
          } else G.cliffRun = { team: tm, n: 1, t: G.t };
          if (G.cliffRun.n === 2 || G.cliffRun.n === 4) highlight(G, 'cliff', tm, G.cliffRun.n, u.x, u.z);
        }
      }
  G.units = us.filter(u => u.hp > 0);
  for (let i = 0; i < 2; i++) {
    const T = G.teams[i];
    if (T.pos && !G.units.some(u => u.id === T.pos)) {
      T.pos = null;
      T.posIn = null;
    }
  }
  G.flags.forEach((f, fi) => {
    const F = FLAGS[fi];
    let c0 = 0,
      c1 = 0;
    for (const u of G.units) {
      // only warriors that stand there count: not the fallen, not a burrowed worm, nor anyone grabbed, flying or held by a hero
      if (u.hp <= 0 || u.bur || u.grab || u.pj || u.air || u.heroBy) continue;
      if ((u.x - F.x) ** 2 + (u.z - F.z) ** 2 < CFG.flagR * CFG.flagR) u.team ? c1++ : c0++;
    }
    // Which side's half is this flag on? The home side retakes it 1.5x faster; a flag held deep in enemy land fades without guards.
    const side = flagSide(fi);
    const rate = (n, team) => (DT / ((CFG.capTime * 1.8) / Math.pow(Math.min(n, 12), 0.75))) * (side === team && !G.tut ? 1.5 : 1);
    if (c0 && !c1) f.p = Math.min(1, f.p + rate(c0, 0) * pk(G, 0, 'flagger', [1, 2.5]));
    else if (c1 && !c0) f.p = Math.max(-1, f.p - rate(c1, 1) * pk(G, 1, 'flagger', [1, 2.5]));
    else if (!c0 && !c1) {
      const deep = !G.tut && f.owner >= 0 && side === 1 - f.owner,
        home = deep ? 0 : f.owner === 0 ? 1 : f.owner === 1 ? -1 : 0;
      f.p += clamp(home - f.p, -DT / (deep ? 16 : 10), DT / (deep ? 16 : 10));
      if (deep && Math.abs(f.p) < 0.004) {
        f.p = 0;
        f.owner = -1;
      }
    }
    if (f.owner >= 0 && Math.abs(f.p) < 0.14) f.danger = f.owner;
    if (f.danger !== undefined && f.owner !== f.danger) f.danger = undefined;
    else if (f.danger !== undefined && Math.abs(f.p) > 0.985) {
      highlight(G, 'save', f.danger, fi, F.x, F.z);
      f.danger = undefined;
    }
    if (f.p >= 1) f.owner = 0;
    else if (f.p <= -1) f.owner = 1;
    if (f.owner === 0 && f.p <= 0) f.owner = -1;
    if (f.owner === 1 && f.p >= 0) f.owner = -1;
  });
  for (let i = 0; i < 2; i++) G.teams[i].maxFlags = Math.max(G.teams[i].maxFlags, flagsOf(G, i));
  if (G.st) {
    const f0 = flagsOf(G, 0),
      f1 = flagsOf(G, 1);
    G.st[0].flagT += f0 * DT;
    G.st[1].flagT += f1 * DT;
    if (f0 > f1) G.st[0].leadT += DT;
    else if (f1 > f0) G.st[1].leadT += DT;
  }
  for (let i = 0; i < 2; i++)
    if (G.teams[i].hp <= 0) {
      G.teams[i].hp = 0;
      G.over = 1 - i;
    }
}
function snapOf(G) {
  const T0 = G.teams[0],
    T1 = G.teams[1];
  const qp = i => {
    const T = G.teams[i];
    return T.q.length ? Math.round((T.qt / buildTime(G, i, T.q[0])) * 100) : 0;
  };
  const au = T =>
    Object.keys(T.auto)
      .filter(k => T.auto[k])
      .join('');
  return {
    t: +G.t.toFixed(2),
    cd: +G.cd.toFixed(1),
    o: G.over,
    fa: [T0.fac, T1.fac],
    sd: G.seed,
    g: [T0.gold | 0, T1.gold | 0],
    q: [T0.q.join(''), T1.q.join('')],
    qp: [qp(0), qp(1)],
    au: [au(T0), au(T1)],
    in: [+incomeOf(G, 0).toFixed(1), +incomeOf(G, 1).toFixed(1)],
    b: [Math.ceil(T0.hp), Math.ceil(T1.hp)],
    f: G.flags.map(f => [f.owner, Math.round(f.p * 100)]),
    r: [Math.round(T0.rally.x), Math.round(T0.rally.z), Math.round(T1.rally.x), Math.round(T1.rally.z)],
    tw: [T0.tatk, T0.ttgt, T1.tatk, T1.ttgt],
    k: [T0.kills, T1.kills],
    mf: [T0.maxFlags, T1.maxFlags],
    ru: [T0.rush, T1.rush],
    rp: [T0.rushAt, T1.rushAt],
    ph: [G.phase || 0, G.tut || (G.phase || 0) >= 2 ? -1 : Math.ceil(CFG.phaseT[G.phase || 0] - G.t)],
    hl: G.hl ? G.hl.slice() : [],
    st: G.st
      ? G.st.map(x => [
          x.made,
          x.lost,
          Math.round(x.baseDmg),
          Math.round(x.flagT),
          Math.round(x.leadT),
          x.rams,
          x.cliff,
          x.bears,
          x.cats,
          x.holes,
          x.egoKills,
        ])
      : null,
    sp: G.proj
      .filter(p => p.aoe && KINDS[p.k] && KINDS[p.k].role === 'siege')
      .map(p => [Math.round(p.tx * 10), Math.round(p.tz * 10), Math.round(p.t * 10), p.team, Math.round(p.aoe * 10)]),
    ...(G.fog ? { fg: 1 } : {}),
    ...(G.chaos
      ? {
          ch: 1,
          pk: [Object.assign({}, T0.pk), Object.assign({}, T1.pk)],
          of: [T0.offer, T1.offer],
          ou: [T0.offerUp | 0, T1.offerUp | 0], // behind: better odds for epic and legendary cards
          pn: [T0.pkN, T1.pkN],
          lp: [T0.lastPk, T1.lastPk],
          no: Math.max(0, Math.ceil(G.nextOffer - G.t)),
          on: G.offerN,
          pz: Math.ceil(G.pz),
          fb: G.fb.map(b => [b.id, Math.round(b.x * 10), Math.round(b.z * 10), Math.round(b.t * 10), b.team, b.lvl]),
        }
      : {}),
    gr: (G.gr || []).map(g => [
      g.id,
      Math.round(g.x * 10),
      Math.round(g.z * 10),
      Math.round(g.sx * 10),
      Math.round(g.sz * 10),
      Math.round(g.t * 10),
      g.team,
      Math.round((g.t0 || 1) * 10),
    ]),
    ro: (G.rolls || []).map(r => [
      r.id,
      Math.round(r.x * 10),
      Math.round(r.z * 10),
      Math.round(r.ang * 100),
      r.v > 0 ? 1 : 0,
      Math.round(r.dx * 100),
      Math.round(r.dz * 100),
    ]),
    go: (G.goo || []).map(g => [
      g.id,
      Math.round(g.x * 10),
      Math.round(g.z * 10),
      Math.round(g.r * 10),
      Math.round(g.t * 10),
      Math.round(g.t0 * 10),
      g.team,
    ]),
    kf: G.kf ? G.kf.slice() : [],
    kc: G.kc ? G.kc.slice() : [],
    cb: [
      [T0.comboN || 0, T0.comboS || 0, +((T0.comboT || -99) + 6 - G.t).toFixed(1)],
      [T1.comboN || 0, T1.comboS || 0, +((T1.comboT || -99) + 6 - G.t).toFixed(1)],
    ],
    ev: G.ev && G.ev.cur ? [G.ev.cur, Math.max(0, Math.ceil(G.ev.t)), G.ev.n] : null,
    wg: G.wagon
      ? [Math.round(G.wagon.x * 10), Math.round(G.wagon.z * 10), Math.round(G.wagon.yaw * 100), G.wagon.owner + 1, G.wagon.mv, G.wagon.done]
      : null,
    fl: G.flagMv ? [G.flagMv, FLAGS.map(F => [Math.round(F.x * 10), Math.round(F.z * 10)])] : null,
    hq: [T0.hq.slice(), T1.hq.slice()],
    ia: [T0.inN | 0, T1.inN | 0], // last ego input packet the host applied per team (reconciliation, 51-ego.js)
    dz: G.dz ? G.dz.slice() : [],
    ge: G.ge ? G.ge.slice() : [],
    it: (G.items || []).map(i => [i.id, i.ty, Math.round(i.x * 10), Math.round(i.z * 10)]),
    nd: [T0.nades || 0, T1.nades || 0],
    pe: G.pe ? G.pe.slice() : [],
    ct: G.ct ? G.ct.slice() : [],
    br: (G.bears || []).map(b => {
      const e = [
        Math.round(b.x * 10),
        Math.round(b.z * 10),
        Math.round(b.yaw * 100),
        b.atk,
        b.mv,
        Math.round((b.hp / b.mhp) * 100),
        b.id,
        b.tameTeam === undefined ? 0 : Math.round(b.tameT * 100) + 1,
        b.tameTeam === undefined ? 0 : b.tameTeam + 1,
        b.raise || 0,
      ];
      if (b.worm) e.push(1, b.ws, Math.round(b.st * 100), Math.round((b.ex ?? b.x) * 10), Math.round((b.ez ?? b.z) * 10), b.bite, b.warnN);
      return e;
    }),
    // heroes on worms: [hero id, worm id, time*100, swallowed, worm is a unit (1) or wild (0), worm yaw*100]
    he: G.units
      .filter(u => u.hero)
      .map(u => [
        u.id,
        u.hero.b,
        Math.round(u.hero.t * 100),
        u.hero.sw,
        u.hero.unit ? 1 : 0,
        Math.round(((heroWormFind(G, u.hero) || {}).yaw || 0) * 100),
      ]),
    wu: G.units
      .filter(u => KINDS[u.k].worm)
      .map(u => [
        u.id,
        u.ws || 0,
        Math.round((u.wst || 0) * 100),
        Math.round((u.ex ?? u.x) * 10),
        Math.round((u.ez ?? u.z) * 10),
        u.wdN || 0,
      ]),
    wq: G.units.filter(u => u.grab).map(u => [u.id, u.grab.h, u.grab.s, Math.round((G.t - u.grab.t0) * 100)]),
    bev: G.bev ? G.bev.slice() : [],
    pj: G.units
      .filter(u => u.pj)
      .map(u => [
        u.id,
        Math.round(u.pj.sx * 10),
        Math.round(u.pj.sz * 10),
        Math.round(u.pj.tx * 10),
        Math.round(u.pj.tz * 10),
        Math.round(u.pj.t * 100),
        u.pj.ack,
      ]),
    pd: (G.padSt || []).map(st => [st.n, Math.ceil(st.cd * 10), st.arm > 0 ? 1 : 0]),
    fz: G.units.filter(u => u.fall > 0).map(u => u.id),
    af: G.units
      .filter(u => u.air)
      .map(u => [
        u.id,
        Math.round(u.x * 10),
        Math.round(u.y * 10),
        Math.round(u.z * 10),
        Math.round(u.air.vx * 100),
        Math.round(u.air.vy * 100),
        Math.round(u.air.vz * 100),
        u.air.kind === 'dash' ? 1 : u.air.kind === 'impact' ? 2 : 0,
        u.airAck,
      ]),
    ih: (G.holes || []).map(h => [h.id, Math.round(h.x * 10), Math.round(h.z * 10), Math.round((h.r || 1.14) * 10)]),
    ic: G.units
      .filter(u => u.slipT > 0 || u.inHole || u.cold > 0)
      .map(u => [u.id, (u.slipT > 0 ? 1 : 0) | (u.inHole ? 2 : 0) | (u.cold > 0 ? 4 : 0)]),
    fp: G.fp.map(p => [
      p.id,
      Math.round(p.x * 10),
      Math.round(p.y * 10),
      Math.round(p.z * 10),
      Math.round(p.dx * 100),
      Math.round(p.dy * 100),
      Math.round(p.dz * 100),
      p.team,
      p.k,
    ]),
    u: G.units.map(u => {
      const e = [
        u.id,
        u.k,
        Math.round(u.x * 10),
        Math.round(u.z * 10),
        Math.max(1, Math.round((u.hp / maxHp(u)) * 100)),
        u.at,
        u.atk,
        (u.poss ? 1 : 0) |
          (u.down > 0 ? 2 : 0) |
          (u.bite > 0 ? 4 : 0) |
          (u.dance > 0 ? 8 : 0) |
          (u.chick > 0 ? 16 : 0) |
          (u.jumpT > 0 ? 32 : 0) |
          (u.frenzy > 0 ? 64 : 0) |
          (u.slowT > 0 ? 128 : 0) |
          ((u.kbN || 0) << 8),
      ];
      if (u.poss)
        e.push(
          u.sp,
          Math.round(u.yaw * 100),
          u.rage > 0 ? 1 : 0,
          Math.max(0, Math.ceil(u.spcd * 10)),
          u.spm ? 1 : 0,
          u.shot ? u.shot[0] : 0,
          u.shot ? u.shot[1] : 0,
          u.padAck || 0,
          u.airAck || 0
        );
      return e;
    }),
  };
}
const teamOfKind = (k, fa) => (KINDS[k].fac === fa[0] ? 0 : 1);
