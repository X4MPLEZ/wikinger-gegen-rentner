/* 15-ai.js - COMPUTER OPPONENT: aiThink(G, team) runs every tick: recruiting (aiRecruit), flag and attack plans, kiting, ego takeovers (aiPossess) with
   attacks, specials, cliff dashes and the hero jump (aiHeroWorm). It only issues commands through applyCmd, like a player. Levels: AI_LVL. */
/* ---------- computer opponent ---------- */
const AI_LVL = {
  easy: {
    name: TR('Einfach'),
    think: 2.2,
    inc: 0.6,
    counter: 0.1,
    micro: 0,
    cavRush: 0,
    retreat: false,
    wave: 13,
    poss: 150,
    ps: { react: 0.7, sp: 0, flee: 0, min: 8, hunt: 0 },
    bonus: 0,
  },
  medium: {
    name: TR('Mittel'),
    think: 1.0,
    inc: 0.9,
    counter: 0.4,
    micro: 2,
    cavRush: 1,
    retreat: true,
    wave: 17,
    poss: 110,
    ps: { react: 0.4, sp: 1, flee: 0.15, min: 6, hunt: 0.2 },
    bonus: 0,
  },
  hard: {
    name: TR('Schwer'),
    think: 0.5,
    inc: 1.0,
    counter: 0.85,
    micro: 2,
    cavRush: 2,
    retreat: true,
    wave: 15,
    poss: 70,
    ps: { react: 0.18, sp: 2, flee: 0.25, min: 5, hunt: 0.5 },
    bonus: 0,
  },
  insane: {
    name: TR('Sehr schwer'),
    think: 0.25,
    inc: 1.35,
    counter: 1,
    micro: 3,
    cavRush: 3,
    retreat: true,
    wave: 13,
    poss: 35,
    ps: { react: 0.11, sp: 3, flee: 0.3, min: 4, hunt: 0.75 },
    bonus: 100,
    cliff: true,
    rangedEgo: 0.3,
  },
  extreme: {
    name: TR('Extrem'),
    think: 0.15,
    inc: 1.8,
    counter: 1,
    micro: 4,
    cavRush: 3,
    retreat: true,
    wave: 12,
    poss: 20,
    ps: { react: 0.07, sp: 3, flee: 0.32, min: 3, hunt: 0.9 },
    bonus: 190,
    cliff: true,
    rangedEgo: 0.35,
    items: true,
    packVsArcher: true,
  },
};
const COUNTER = { cav: 'melee', ranged: 'cav', melee: 'ranged', siege: 'cav' }; // COUNTER[r] = the role that beats r
function aiNew(lvl) {
  return { lvl, tick: 0, plan: null, last: {}, posCd: 0, pa: 0, ps: 0 };
}
const cen = us => {
  if (!us.length) return null;
  let x = 0,
    z = 0;
  us.forEach(u => {
    x += u.x;
    z += u.z;
  });
  return { x: x / us.length, z: z / us.length };
};
const nearestOf = (list, x, z, f) => {
  let b = null,
    bd = 1e9;
  for (const e of list) {
    if (f && !f(e)) continue;
    const d = (e.x - x) ** 2 + (e.z - z) ** 2;
    if (d < bd) {
      bd = d;
      b = e;
    }
  }
  return b;
};
const within = (list, p, r) => list.filter(e => Math.hypot(e.x - p.x, e.z - p.z) < r);
const unitVal = u => (u.hp / maxHp(u)) * (KINDS[u.k].cost || 250) * (u.poss ? 2.6 : 1); // tamed bears and worms cost nothing but are worth a lot
function strength(us, vs) {
  const n = vs.length || 1,
    vr = { melee: 0, ranged: 0, cav: 0, siege: 0 };
  vs.forEach(v => vr[KINDS[v.k].role]++);
  let s = 0;
  for (const u of us) {
    const r = KINDS[u.k].role;
    s += unitVal(u) * (1 + (0.8 * (vr[BEATS[r]] || 0)) / n - (0.45 * (vr[COUNTER[r]] || 0)) / n);
  }
  return s;
}
function aiOrder(G, team, A, key, us, p, m) {
  us = us.filter(u => !u.pj && u.navPad === undefined && !(u.fall > 0));
  if (!us.length || !p) return;
  const ids = us.map(u => u.id),
    sig = ids.length + ':' + ids[0] + ':' + ids[ids.length - 1],
    L = A.last[key];
  if (L && L.m === m && L.sig === sig && Math.hypot(L.x - p.x, L.z - p.z) < 3 && G.t - L.t < 7) return;
  A.last[key] = { x: p.x, z: p.z, m, sig, t: G.t };
  applyCmd(G, team, { t: 'order', ids, x: p.x, z: p.z, m });
}
function aiRecruit(G, team, A, L, mine, foes) {
  const T = G.teams[team],
    ks = FAC[T.fac].kinds;
  if (T.q.length >= (L.micro >= 2 ? 2 : 1)) return;
  if (A.plan === null) {
    const cnt = { melee: 0, ranged: 0, cav: 0, siege: 0 };
    mine.forEach(u => cnt[KINDS[u.k].role]++);
    T.q.forEach(k => cnt[KINDS[k].role]++);
    const total = cnt.melee + cnt.ranged + cnt.cav;
    let role = 'melee';
    if (cnt.cav < L.cavRush && G.t < 70) role = 'cav';
    else {
      const want = { melee: 0.38, ranged: 0.34, cav: 0.28 };
      if (foes.length && Math.random() < L.counter) {
        const ec = { melee: 0, ranged: 0, cav: 0, siege: 0 };
        foes.forEach(u => ec[KINDS[u.k].role]++);
        for (const r in ec) want[COUNTER[r]] += (ec[r] / foes.length) * 0.75;
      }
      let bd = -1e9;
      for (const r in want) {
        const d = want[r] - cnt[r] / (total + 1);
        if (d > bd) {
          bd = d;
          role = r;
        }
      }
      if (L.micro === 0 && Math.random() < 0.5) role = pick(['melee', 'ranged', 'cav']);
    }
    A.plan = ks.find(k => KINDS[k].role === role);
    const nSiege = mine.filter(u => KINDS[u.k].role === 'siege').length + T.q.filter(k => KINDS[k].role === 'siege').length;
    if (
      G.t > (L.micro >= 2 ? 70 : 100) &&
      total >= 5 &&
      nSiege < (L.counter > 0.8 ? 2 : 1) + ((G.phase || 0) >= 1 ? 1 : 0) &&
      Math.random() < (L.micro >= 2 ? 0.2 : 0.12)
    )
      A.plan = ks.find(k => KINDS[k].role === 'siege');
  }
  const before = T.q.length;
  applyCmd(G, team, { t: 'spawn', k: A.plan });
  if (T.q.length > before) A.plan = null;
}
function aiBestFlag(G, team, foes, dumb, from) {
  const home = from || BASES[team],
    eb = BASES[1 - team];
  let best = FLAGS[MAP.mid || 0] || FLAGS[0],
    bs = 1e9;
  FLAGS.forEach((F, i) => {
    if (Math.hypot(F.x - eb.x, F.z - eb.z) < CFG.towerRange + 2) return;
    const f = G.flags[i],
      near = within(foes, F, 12).length;
    let s = Math.hypot(F.x - home.x, F.z - home.z) + (dumb ? 0 : near * 6);
    if (f.owner === team) s += near ? -15 : 95;
    else if (f.owner === 1 - team) s -= dumb ? 0 : 8;
    if (s < bs) {
      bs = s;
      best = F;
    }
  });
  return best;
}
function aiSafe(G, team, c) {
  const home = BASES[team],
    hd = Math.hypot(c.x - home.x, c.z - home.z);
  let best = frontOf(team, 12),
    bd = Math.hypot(best.x - c.x, best.z - c.z);
  FLAGS.forEach((F, i) => {
    if (G.flags[i].owner !== team) return;
    const d = Math.hypot(F.x - c.x, F.z - c.z);
    if (Math.hypot(F.x - home.x, F.z - home.z) < hd - 4 && d < bd) {
      bd = d;
      best = F;
    }
  });
  return best;
}
function aiBlob(G, team, A, L, mine, foes) {
  if (!mine.length) return;
  const home = BASES[team],
    threat = within(foes, home, 24);
  let p,
    m = 0;
  if (threat.length) p = cen(threat);
  else if (mine.length < (L.micro ? 5 : 7)) p = frontOf(team, 14);
  else if (
    (mine.length >= L.wave + 4 && mine.length > foes.length * 1.5) ||
    ((G.phase || 0) >= 1 && mine.length >= L.wave && mine.length > foes.length * 1.1)
  )
    p = frontOf(1 - team, 8);
  else p = aiBestFlag(G, team, foes, L.micro === 0);
  if (L.retreat && !threat.length) {
    const c = cen(mine),
      near = within(foes, c, 16);
    if (near.length && strength(mine, near) < 0.55 * strength(near, mine)) {
      p = aiSafe(G, team, c);
      m = 1;
    }
  }
  aiOrder(G, team, A, 'all', mine, p, m);
  const rp = m ? frontOf(team, 14) : p;
  applyCmd(G, team, { t: 'rally', x: rp.x, z: rp.z });
}
function aiSmart(G, team, A, L, free, allFoes) {
  if (!free.length) return;
  const home = BASES[team],
    eb = BASES[1 - team];
  const ratio = strength(free, allFoes) / Math.max(1, strength(allFoes, free));
  const storm = (G.phase || 0) >= 1; // storm phase: bases are fragile, the AI goes for the kill
  if (!A.push && free.length >= (storm ? L.wave * 0.7 : L.wave) && ratio > (storm ? 1.15 : 1.7)) {
    const def = within(allFoes, eb, 24);
    if (strength(def, free) < 0.45 * strength(free, def)) A.push = true;
  }
  if (A.push && (ratio < (storm ? 0.8 : 1.0) || free.length < L.wave * (storm ? 0.45 : 0.65))) A.push = false;
  if ((G.phase || 0) >= 2 && !A.push && free.length >= 6 && ratio > 0.85) A.push = true; // final battle: no more waiting
  const foes = A.push ? allFoes : allFoes.filter(e => Math.hypot(e.x - eb.x, e.z - eb.z) > CFG.towerRange + 4);
  const R = r => free.filter(u => KINDS[u.k].role === r),
    E = r => foes.filter(u => KINDS[u.k].role === r);
  const cav = R('cav'),
    mel = R('melee'),
    rng = R('ranged'),
    eCav = E('cav'),
    eMel = E('melee'),
    eRng = E('ranged');
  const threat = within(allFoes, home, 26),
    army = mel.concat(rng);
  // clearly outnumbered: fall back into the home zone and rebuild instead of feeding units one by one
  if (
    A.turtle
      ? ratio > 0.8 || free.length >= L.wave || A.push || (G.phase || 0) >= 2
      : !A.push && ratio < 0.55 && free.length < L.wave && (G.phase || 0) < 2
  )
    A.turtle = !A.turtle; // hysteresis: no back-and-forth
  const turtle = A.turtle && !threat.length;
  let obj;
  if (threat.length) obj = cen(threat);
  else if (turtle) obj = frontOf(team, 9);
  else if (A.push) obj = { x: eb.x, z: eb.z + (team ? -3 : 3) };
  else obj = aiBestFlag(G, team, allFoes, false, cen(army) || null);
  const ac = cen(army.length ? army : free);
  let retreat = false;
  if (army.length && !threat.length) {
    const near = within(foes, ac, 17),
      mineNear = within(free, ac, 17);
    if (near.length >= 3 && strength(mineNear, near) < 0.5 * strength(near, mineNear)) retreat = true;
  }
  const sgU = R('siege');
  if (retreat) {
    const sp = aiSafe(G, team, ac);
    aiOrder(G, team, A, 'mel', mel, sp, 1);
    aiOrder(G, team, A, 'rng', rng, sp, 1);
    aiOrder(G, team, A, 'sg', sgU, sp, 1);
  } else {
    const cavThreat = nearestOf(eCav, ac.x, ac.z, e => Math.hypot(e.x - ac.x, e.z - ac.z) < 16);
    const engage = within(foes, ac, 18);
    const mt = cavThreat ? { x: cavThreat.x, z: cavThreat.z } : engage.length ? cen(engage) : obj;
    aiOrder(G, team, A, 'mel', mel, mt, 0);
    if (rng.length) {
      const mf = mel.length ? nearestOf(mel, mt.x, mt.z) : null,
        mc = mf ? cen(within(mel, mf, 10)) : null,
        rc = cen(rng);
      const danger = nearestOf(eCav, rc.x, rc.z, e => Math.hypot(e.x - rc.x, e.z - rc.z) < 6);
      if (danger && mc && Math.hypot(mc.x - rc.x, mc.z - rc.z) > 5) aiOrder(G, team, A, 'rng', rng, mc, 1);
      else {
        const anchor = mc || ac,
          tx = mt.x - anchor.x,
          tz = mt.z - anchor.z,
          tl = Math.hypot(tx, tz) || 1,
          back = mc ? 4.5 : Math.min(8, tl);
        const tgtP = mc
          ? { x: anchor.x - (tx / tl) * back, z: anchor.z - (tz / tl) * back }
          : { x: mt.x - (tx / tl) * back, z: mt.z - (tz / tl) * back };
        aiOrder(G, team, A, 'rng', rng, nearestWalkable(MAP, clampX(tgtP.x), clampZ(tgtP.z)), 0);
      }
    }
    if (sgU.length) {
      const fr = nearestOf(army.length ? army : free, mt.x, mt.z),
        ref = fr ? cen(within(army.length ? army : free, fr, 10)) : cen(free),
        tx = mt.x - ref.x,
        tz = mt.z - ref.z,
        tl = Math.hypot(tx, tz) || 1,
        bk = Math.min(7, tl);
      aiOrder(G, team, A, 'sg', sgU, nearestWalkable(MAP, clampX(ref.x - (tx / tl) * bk), clampZ(ref.z - (tz / tl) * bk)), 0);
    }
  }
  if (cav.length) {
    A.heal = A.heal || new Set();
    cav.forEach(c => {
      if (c.hp < KINDS[c.k].hp * 0.3) A.heal.add(c.id);
      else if (c.hp > KINDS[c.k].hp * 0.85) A.heal.delete(c.id);
    });
    const hurt = cav.filter(c => A.heal.has(c.id)),
      ok = cav.filter(c => !A.heal.has(c.id)),
      cc = cen(ok.length ? ok : cav);
    if (hurt.length) aiOrder(G, team, A, 'cavh', hurt, frontOf(team, 6), 1);
    let target = null;
    const exposed = eRng.filter(
      e => within(eMel, e, 6).length < Math.max(1, ok.length * 0.6) && !(L.packVsArcher && e.poss && ok.length < 2)
    );
    const egoArch = L.packVsArcher ? allFoes.find(e => e.poss && KINDS[e.k].role === 'ranged') : null;
    if (egoArch && ok.length >= 2) target = { x: egoArch.x, z: egoArch.z };
    else if (exposed.length) {
      const t = nearestOf(exposed, cc.x, cc.z);
      target = { x: t.x, z: t.z };
    }
    if (!target && threat.length) target = cen(threat);
    if (turtle && (!target || Math.hypot(target.x - home.x, target.z - home.z) > 40)) target = obj;
    if (!target && A.push) target = obj;
    if (!target) {
      let bs = 1e9;
      FLAGS.forEach((F, i) => {
        const f = G.flags[i];
        if (f.owner === team && Math.abs(f.p) > 0.99) return;
        const bad = within(foes, F, 12).filter(u => KINDS[u.k].role !== 'ranged').length;
        const sc = Math.hypot(F.x - cc.x, F.z - cc.z) + bad * 14 - (f.owner === 1 - team ? 10 : 0);
        if (bad <= ok.length && sc < bs) {
          bs = sc;
          target = F;
        }
      });
    }
    if (!target) target = cen(mel) || obj;
    aiOrder(G, team, A, 'cav', ok, target, 0);
  }
  const rp = retreat || within(foes, ac, 18).length ? aiSafe(G, team, ac) : cen(mel) || obj;
  applyCmd(G, team, { t: 'rally', x: rp.x, z: rp.z });
}
function aiKite(G, team, free, foes) {
  for (const u of free) {
    if (KINDS[u.k].role !== 'ranged') continue;
    const th = nearestOf(foes, u.x, u.z, e => KINDS[e.k].role !== 'ranged' && Math.hypot(e.x - u.x, e.z - u.z) < 3.2);
    if (!th) continue;
    const dx = u.x - th.x,
      dz = u.z - th.z,
      d = Math.hypot(dx, dz) || 1;
    const p = nearestWalkable(MAP, clampX(u.x + (dx / d) * 5), clampZ(u.z + (dz / d) * 5));
    applyCmd(G, team, { t: 'order', ids: [u.id], x: p.x, z: p.z, m: 1 });
  }
}
function knockFalls(e, ox, oz, dist) {
  if (!MAP.cliff) return false;
  const dx = e.x - ox,
    dz = e.z - oz,
    d = Math.hypot(dx, dz) || 1;
  for (let s = 0.5; s <= dist + 3; s += 0.5) {
    const nx = e.x + (dx / d) * s,
      nz = e.z + (dz / d) * s;
    if (fallZone(nx, nz)) return true;
    if (walkable(nx, nz)) {
      if (s > dist) return false;
      continue;
    }
    if (!edgeSlide(nx, nz)) return false;
  }
  return false;
}
function edgeNear(x, z, r = 5) {
  if (!MAP.cliff) return false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    for (let s = 2; s <= r; s += 1.5) if (fallZone(x + Math.cos(a) * s, z + Math.sin(a) * s)) return true;
  }
  return false;
}
function edgeDir(x, z, r = 5) {
  if (!MAP.cliff) return null;
  let bd = null;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU,
      cx = Math.cos(a),
      cz = Math.sin(a);
    for (let s = 1; s <= r; s += 0.75)
      if (fallZone(x + cx * s, z + cz * s)) {
        if (!bd || s < bd.s) bd = { s, x: cx, z: cz };
        break;
      }
  }
  return bd;
}
/* cav dash: find a heading that shoves foes off a cliff (dash knocks sideways 6 m) */
function dashPlan(u, foes, baseYaw) {
  let best = null,
    bc = 0;
  for (let o = -0.7; o <= 0.71; o += 0.14) {
    const y = baseYaw + o,
      fx = Math.sin(y),
      fz = Math.cos(y);
    let c = 0;
    for (const e of foes) {
      const dx = e.x - u.x,
        dz = e.z - u.z,
        al = dx * fx + dz * fz;
      if (al < 1 || al > 9.5) continue;
      const pp = dx * fz - dz * fx;
      if (Math.abs(pp) > 2.3) continue;
      if (knockFalls(e, u.x + fx * al - fz * 0.01, u.z + fz * al + fx * 0.01, 6)) c += e.poss ? 2 : 1;
    }
    if (c > bc) {
      bc = c;
      best = y;
    }
  }
  return best === null ? null : { yaw: best, n: bc };
}
function aiPossess(G, team, A, L, mine, foes) {
  if (!L.poss) return;
  const T = G.teams[team],
    PS = L.ps;
  A.posCd -= DT;
  if (A.hadPos && !T.pos) {
    A.hadPos = false;
    if (!A.selfOut)
      A.posCd = Math.max(
        A.posCd,
        ({ easy: 16, medium: 12, hard: 9, insane: 6.5, extreme: 4.5 }[A.lvl] || 10) * (0.8 + Math.random() * 0.4)
      );
    A.selfOut = false;
  }
  if (T.pos) A.hadPos = true;
  if (!T.pos) {
    if (A.posCd > 0 || G.t < L.poss || mine.length < PS.min) return;
    const ok = mine.filter(
        u =>
          !u.pj &&
          u.navPad === undefined &&
          KINDS[u.k].role !== 'siege' &&
          !KINDS[u.k].worm &&
          !u.grab &&
          !(u.down > 0) &&
          u.hp >= KINDS[u.k].hp * 0.8
      ),
      ep = foes.find(e => e.poss),
      vsR = ep && KINDS[ep.k].role === 'ranged' && L.micro >= 3;
    const byR = r => ok.filter(u => KINDS[u.k].role === r);
    let cand = vsR ? (byR('cav').length ? byR('cav') : byR('ranged')) : ok.filter(u => KINDS[u.k].role !== 'ranged');
    if (!vsR && (Math.random() < (L.rangedEgo || 0.22) || !cand.length)) cand = byR('ranged').length ? byR('ranged') : cand;
    A.vsR = vsR;
    A.itemRun = false;
    if (L.items && !vsR && (G.items || []).length) {
      const own = G.items.filter(i => (i.z - BASES[1 - team].z) ** 2 > (i.z - BASES[team].z) ** 2);
      if (own.length) {
        const it = own[0],
          run = ok
            .filter(u => KINDS[u.k].role !== 'siege' && !foes.some(e => Math.hypot(e.x - u.x, e.z - u.z) < 12))
            .sort(
              (a, b) => (KINDS[b.k].speed - KINDS[a.k].speed) * 4 + Math.hypot(a.x - it.x, a.z - it.z) - Math.hypot(b.x - it.x, b.z - it.z)
            )[0];
        if (run) {
          cand = [run];
          A.itemRun = true;
        }
      }
    }
    if (MAP.cliff && (L.cliff || A.cliffRoll) && !vsR && foes.some(e => edgeNear(e.x, e.z))) {
      const pushers = ok.filter(u => KINDS[u.k].role === 'cav' || u.k === 2);
      if (pushers.length && Math.random() < 0.75) cand = pushers;
    }
    let best = null,
      bs = 1e9;
    if (PS.react > 0.5) ((best = cand[Math.floor(Math.random() * cand.length)] || null), (bs = 0));
    else
      for (const u of cand) {
        const e = nearestOf(foes, u.x, u.z);
        const d = e ? Math.hypot(e.x - u.x, e.z - u.z) : 99;
        if (d < bs) {
          bs = d;
          best = u;
        }
      }
    if (best && (bs < 30 || A.itemRun)) {
      applyCmd(G, team, { t: 'poss', id: best.id });
      A.pa = 0;
      A.ps = 0;
      A.rt = 0;
      A.fleeAt = PS.flee ? (Math.random() < 0.4 ? 0.04 : PS.flee * (0.6 + Math.random() * 0.6)) : 0;
      A.react = PS.react;
    }
    return;
  }
  const u = G.units.find(v => v.id === T.pos);
  if (!u) {
    A.posCd = 25;
    return;
  }
  A.crT = (A.crT || 0) - DT;
  if (A.crT <= 0) {
    A.crT = 3;
    A.cliffRoll = !L.cliff && Math.random() < ({ easy: 0.12, medium: 0.25, hard: 0.4 }[A.lvl] || 0);
  }
  const K = KINDS[u.k];
  if (u.down > 0 || u.dance > 0) {
    A.rt = 0;
    return;
  }
  if (PS.flee && u.hp < maxHp(u) * (A.fleeAt ?? PS.flee)) {
    A.selfOut = true;
    applyCmd(G, team, { t: 'unposs' });
    A.posCd = 22;
    return;
  }
  if (
    L.micro >= 3 &&
    K.role === 'melee' &&
    foes.some(e => e.poss && KINDS[e.k].role === 'ranged') &&
    mine.some(m => KINDS[m.k].role === 'cav' || KINDS[m.k].role === 'ranged')
  ) {
    A.selfOut = true;
    applyCmd(G, team, { t: 'unposs' });
    A.posCd = 1.5;
    return;
  }
  if (
    MAP.cliff &&
    (L.cliff || A.cliffRoll) &&
    K.role !== 'cav' &&
    u.k !== 2 &&
    Math.random() < DT * 0.08 &&
    mine.some(
      m =>
        (KINDS[m.k].role === 'cav' || m.k === 2) &&
        !(m.down > 0) &&
        foes.some(e => Math.hypot(e.x - m.x, e.z - m.z) < 18 && edgeNear(e.x, e.z, 4))
    )
  ) {
    A.selfOut = true;
    applyCmd(G, team, { t: 'unposs' });
    A.posCd = 1;
    return;
  }
  const EB = BASES[1 - team],
    ebHp = G.teams[1 - team].hp,
    danger = ebHp > CFG.baseHp * 0.2,
    tr = CFG.towerRange + 2;
  if (danger && Math.hypot(u.x - EB.x, u.z - EB.z) < tr) {
    const dx = u.x - EB.x,
      dz = u.z - EB.z,
      d0 = Math.hypot(dx, dz) || 1,
      p = nearestWalkable(MAP, clampX(EB.x + (dx / d0) * (tr + 6)), clampZ(EB.z + (dz / d0) * (tr + 6)));
    u.vx = 0;
    u.vz = 0;
    steer(G, u, p.x, p.z, K.speed * 1.15);
    T.posIn = {
      id: u.id,
      x: u.x + u.vx * DT,
      z: u.z + u.vz * DT,
      y: Math.atan2(p.x - u.x, p.z - u.z),
      a: A.pa,
      s: A.ps,
      j: A.pj || 0,
      g: A.pg || 0,
      h: A.ph || 0,
      pad: u.padAck || 0,
      air: u.airAck || 0,
    };
    return;
  }
  let best = null,
    bs = 1e9;
  if (L.micro >= 3) {
    const ep2 = foes.find(e => e.poss && KINDS[e.k].role === 'ranged');
    if (ep2 && Math.hypot(ep2.x - u.x, ep2.z - u.z) < 40 && !(danger && Math.hypot(ep2.x - EB.x, ep2.z - EB.z) < tr)) {
      best = ep2;
      bs = 0;
    }
  }
  if (!best)
    for (const e of foes) {
      const d = Math.hypot(e.x - u.x, e.z - u.z);
      if (d > 30 || (danger && Math.hypot(e.x - EB.x, e.z - EB.z) < tr)) continue;
      const sc =
        d *
        (isCounter(u.k, e.k) ? 1 - 0.45 * L.counter : 1) *
        (e.poss ? 1 - 0.6 * PS.hunt : 1) *
        (e.down > 0 ? 0.8 : 1) *
        (MAP.cliff && (L.cliff || A.cliffRoll) && (K.role === 'cav' || u.k === 2) && edgeNear(e.x, e.z, 4) ? 0.45 : 1);
      if (sc < bs) {
        bs = sc;
        best = e;
      }
    }
  const calm = !foes.some(e => Math.hypot(e.x - u.x, e.z - u.z) < 14),
    itm =
      L.micro >= 2
        ? (G.items || []).find(
            i =>
              Math.hypot(i.x - u.x, i.z - u.z) < (L.items && calm ? 70 : 22) &&
              (!L.items || (i.z - BASES[1 - team].z) ** 2 > (i.z - BASES[team].z) ** 2 || Math.hypot(i.x - u.x, i.z - u.z) < 22)
          )
        : null;
  {
    const hw = aiHeroWorm(G, A, L, u, foes);
    if (hw) {
      u.vx = 0;
      u.vz = 0;
      steer(G, u, hw.x, hw.z, K.speed * 1.15);
      if (heroWorm(G, u) === hw) A.ph = (A.ph || 0) + 1;
      T.posIn = {
        id: u.id,
        x: u.x + u.vx * DT,
        z: u.z + u.vz * DT,
        y: Math.atan2(hw.x - u.x, hw.z - u.z),
        a: A.pa,
        s: A.ps,
        j: A.pj || 0,
        g: A.pg || 0,
        h: A.ph || 0,
        pad: u.padAck || 0,
        air: u.airAck || 0,
      };
      return;
    }
  }
  const tg =
    best && (!itm || Math.hypot(best.x - u.x, best.z - u.z) < 7) ? best : itm ? itm : best ? best : aiBestFlag(G, team, foes, false, u);
  const d = Math.hypot(tg.x - u.x, tg.z - u.z),
    reach = K.role === 'ranged' ? K.range - 1 : K.range + K.r + 0.5;
  u.vx = 0;
  u.vz = 0;
  let ap = null;
  const pusher = K.role === 'cav' || u.k === 2;
  if (MAP.cliff && pusher && best && tg === best && (L.cliff || A.cliffRoll) && d < 16 && u.spcd <= 1.5) {
    const ed = edgeDir(best.x, best.z, 4.5);
    if (ed) {
      if (u.k === 2) ap = { x: best.x - ed.x * 1.6, z: best.z - ed.z * 1.6 };
      else {
        const tx = -ed.z,
          tz = ed.x,
          sg = (u.x - best.x) * tx + (u.z - best.z) * tz >= 0 ? 1 : -1;
        ap = { x: best.x + tx * sg * 5.5 - ed.x * 1.1, z: best.z + tz * sg * 5.5 - ed.z * 1.1 };
      }
      if (!walkable(ap.x, ap.z) || Math.hypot(ap.x - u.x, ap.z - u.z) < 0.8) ap = null;
    }
  }
  if (ap) steer(G, u, ap.x, ap.z, K.speed * 1.15);
  else if (tg === itm || !best || d > reach * 0.8) steer(G, u, tg.x, tg.z, K.speed * 1.15);
  let yaw = Math.atan2(tg.x - u.x, tg.z - u.z),
    cliff = false;
  if (MAP.cliff && best && u.spcd <= 0 && (L.cliff || A.cliffRoll) && d < 11) {
    if (K.role === 'cav') {
      const pl = dashPlan(u, foes, yaw);
      if (pl) {
        yaw = pl.yaw + (L.cliff ? 0 : (Math.random() - 0.5) * 0.9);
        cliff = true;
      }
    } else if (u.k === 2) cliff = foes.some(e => Math.hypot(e.x - u.x, e.z - u.z) < 3.3 && knockFalls(e, u.x, u.z, 3.2));
  }
  if (best && d <= reach) {
    A.rt = (A.rt || 0) + DT;
    if (u.cd <= 0.1 && A.rt >= (A.react ?? PS.react)) {
      A.pa++;
      A.rt = 0;
      A.react = PS.react * (0.7 + Math.random() * 1.6) + (Math.random() < 0.18 ? 0.45 : 0);
    }
  } else A.rt = 0;
  if (best && u.spcd <= 0 && PS.sp > 0) {
    const near = r => foes.filter(e => Math.hypot(e.x - u.x, e.z - u.z) < r).length;
    let use = false;
    if (K.worm)
      use = u.ws === 1 ? near(WORM.grabRE - 0.6) >= 2 || (u.tunT || 0) > 3 : !u.ws && canBurrow(u.x, u.z) && near(7) >= 2; // dig in near a group, burst out right under it
    else if (PS.sp === 1) use = K.role === 'cav' ? d > 3 && d < 8 : near(3.4) >= 2;
    else if (u.k === 0) use = d < 4 && (near(5) >= 2 || best.poss || PS.sp >= 3);
    else if (u.k === 2) use = near(3.2) >= 2 || (best.poss && d < 3) || (PS.sp >= 3 && d < 3);
    else if (K.role === 'cav') {
      const al = (best.x - u.x) * Math.sin(yaw) + (best.z - u.z) * Math.cos(yaw);
      use = al > 2.5 && al < 9.5;
    } else if (K.role === 'ranged')
      use = d <= K.range && (near(K.range) >= 3 || best.poss || PS.sp >= 3); // volley / teeth fan
    else if (K.bear) use = near(4.2) >= 2 || (best.poss && d < 4); // claws
    if (cliff) {
      use = true;
      G.cliffN = (G.cliffN || 0) + 1;
    }
    if (use) A.ps++;
  }
  let ad;
  if (
    best &&
    (pkL(G, team, 'dance') || (T.nades || 0) > 0) &&
    !((u.gcd || 0) > 0) &&
    d < 13 &&
    foes.filter(e => Math.hypot(e.x - best.x, e.z - best.z) < 5).length >= 2
  ) {
    A.pg = (A.pg || 0) + 1;
    ad = [best.x, best.z];
  }
  if (best && pkL(G, team, 'jump') && d < 3.2 && Math.random() < 0.03) A.pj = (A.pj || 0) + 1;
  // Stuck below a ledge (ego may walk down edges but not climb them): head for walkable ground that is not uphill, give up after a while.
  if (!u.air && !walkable(u.x, u.z) && !inWater(u.x, u.z)) {
    A.offT = (A.offT || 0) + DT;
    if (A.offT > 6) {
      A.offT = 0;
      A.selfOut = true;
      applyCmd(G, team, { t: 'unposs' });
      A.posCd = 2;
      return;
    }
    if (A.offT > 0.8) {
      const gy = groundY(u.x, u.z);
      let ex = null;
      for (let r = 0.75; r <= 9 && !ex; r += 0.75)
        for (let i = 0; i < 16; i++) {
          const a2 = (i / 16) * TAU,
            px = u.x + Math.cos(a2) * r,
            pz = u.z + Math.sin(a2) * r;
          if (walkable(px, pz) && groundY(px, pz) <= gy + 0.35) {
            ex = { x: px, z: pz };
            break;
          }
        }
      if (ex) {
        const dd = Math.hypot(ex.x - u.x, ex.z - u.z) || 1,
          sp = K.speed * 1.1;
        u.vx = ((ex.x - u.x) / dd) * sp;
        u.vz = ((ex.z - u.z) / dd) * sp;
        yaw = Math.atan2(ex.x - u.x, ex.z - u.z);
      }
    }
  } else A.offT = 0;
  T.posIn = {
    id: u.id,
    x: u.x + u.vx * DT,
    z: u.z + u.vz * DT,
    y: yaw,
    a: A.pa,
    s: A.ps,
    j: A.pj || 0,
    g: A.pg || 0,
    h: A.ph || 0,
    gp: ad,
    pad: u.padAck || 0,
    air: u.airAck || 0,
  };
}
function aiHeroWorm(G, A, L, u, foes) {
  // now and then the AI's own Berserker / Opa goes to play the hero on a sandworm nearby:
  // a wild one (more likely when it is weakened) or an enemy worm unit
  if ((u.k !== 0 && u.k !== 2) || L.micro < 2 || u.hero) return null;
  const ok = w => (heroIsUnit(w) ? heroUnitOk(w, u.team) : heroWildOk(w) && !(w.ws === 4 && w.st >= WORM.up - 1.2));
  if (G.t >= (A.heroT || 0)) {
    A.heroT = G.t + 1.5;
    const w = [...G.bears, ...G.units].find(
      c => (heroIsUnit(c) ? KINDS[c.k].worm : c.worm) && ok(c) && Math.hypot(c.x - u.x, c.z - u.z) < 11
    );
    A.heroW = w && Math.random() < (w.hp < (w.mhp || maxHp(w)) * 0.6 ? 0.8 : 0.35) ? w.id : -1;
    A.heroU = !!w && heroIsUnit(w);
  }
  const w = A.heroW >= 0 ? (A.heroU ? G.units.find(o => o.id === A.heroW) : G.bears.find(b => b.id === A.heroW)) : null;
  if (!w || !ok(w) || foes.some(e => e !== w && Math.hypot(e.x - u.x, e.z - u.z) < 5)) {
    A.heroW = -1;
    return null;
  }
  return w;
}
// Fog: the computer only knows what its warriors, flags and base see (FOG_SIGHT, 02-data.js), like the player – a foe counts as seen
// where the player's fog is mostly thin (3 m inside the outer edge). A steered foe's lantern is seen from farther.
const aiFog = G => !!(G.fog || (G.ev && G.ev.cur === EV_FOG)) && !G.tut;
function aiVision(G, team, mine) {
  const C = [],
    r2 = r => (r[1] - 3) ** 2,
    B = BASES[team],
    EB = BASES[1 - team];
  if (B) C.push(B.x, B.z, r2(FOG_SIGHT.base));
  G.flags.forEach((f, i) => f.owner === team && C.push(FLAGS[i].x, FLAGS[i].z, r2(FOG_SIGHT.flag)));
  let siege = false;
  for (const u of mine) {
    C.push(u.x, u.z, r2(fogSightOf(KINDS[u.k].role, u.poss)));
    if (EB && (u.x - EB.x) ** 2 + (u.z - EB.z) ** 2 < FOG_SIGHT.siegeNear ** 2) siege = true;
  }
  if (siege) C.push(EB.x, EB.z, r2(FOG_SIGHT.siege));
  return { C, mine };
}
function aiVisible(Vn, f) {
  const C = Vn.C;
  for (let i = 0; i < C.length; i += 3) if ((f.x - C[i]) ** 2 + (f.z - C[i + 1]) ** 2 < C[i + 2]) return true;
  if (f.poss) for (const u of Vn.mine) if ((u.x - f.x) ** 2 + (u.z - f.z) ** 2 < FOG_SIGHT.lanternSeen ** 2) return true;
  return false;
}
const aiSees = (G, team, mine, f) => aiVisible(aiVision(G, team, mine), f);
// The foes the computer knows about: everyone it sees, plus for a few seconds those that vanished into the fog – at the spot where
// it last saw them (a stand-in object: their own properties, but the remembered position).
function aiKnownFoes(G, team, A, mine) {
  const all = G.units.filter(u => u.team !== team);
  if (!aiFog(G)) return all;
  const Vn = aiVision(G, team, mine),
    M = A.mem || (A.mem = new Map()),
    out = [];
  for (const u of all)
    if (aiVisible(Vn, u)) {
      M.set(u.id, { x: u.x, z: u.z, t: G.t });
      out.push(u);
    } else {
      const m = M.get(u.id);
      if (m && G.t - m.t < FOG_SIGHT.memory) out.push(Object.assign(Object.create(u), { x: m.x, z: m.z }));
    }
  if ((A.memT = (A.memT || 0) - DT) <= 0) {
    A.memT = 2;
    for (const [id, m] of M) if (G.t - m.t > FOG_SIGHT.memory) M.delete(id);
  }
  return out;
}
function aiThink(G, team) {
  const A = G.ai,
    L = AI_LVL[A.lvl] || AI_LVL.medium;
  if (G.cd > 0 || G.over >= 0) return;
  const T = G.teams[team];
  if (T.offer) {
    A.pkWait = (A.pkWait || 0) + DT;
    if (A.pkWait > 1.2) {
      A.pkWait = 0;
      const pref = [
        'giant',
        'revive',
        'twins',
        'quake',
        'meteor',
        'catapult',
        'armor',
        'chicken',
        'volley',
        'berserk',
        'walhalla',
        'spin',
        'stampede',
        'bite',
        'ram',
        'wall',
        'arrows',
        'kegel',
        'dance',
        'tower',
        'bounty',
        'gold',
        'fast',
        'heal',
        'flagger',
        'cavspd',
        'moon',
        'charge',
        'jump',
        'bighead',
        'turbo',
      ];
      const sc = id => (pref.length - pref.indexOf(id)) * L.counter + Math.random() * (12 - 10 * L.counter);
      applyCmd(G, team, { t: 'perk', id: T.offer.slice().sort((a, b) => sc(b) - sc(a))[0] });
    }
  }
  if (G.pz > 0) return;
  const mine = G.units.filter(u => u.team === team),
    foes = aiKnownFoes(G, team, A, mine);
  aiPossess(G, team, A, L, mine, foes);
  A.tick -= DT;
  if (A.tick > 0) return;
  A.tick = L.think;
  aiRecruit(G, team, A, L, mine, foes);
  let free = mine.filter(u => !u.poss);
  if (G.wagon && !G.wagon.done && free.length >= 5 && L.micro >= 1) {
    // gold wagon: a small escort goes along, the rest keeps fighting
    const Wg = G.wagon,
      esc = free
        .filter(u => KINDS[u.k].role !== 'siege')
        .sort((a, b) => Math.hypot(a.x - Wg.x, a.z - Wg.z) - Math.hypot(b.x - Wg.x, b.z - Wg.z))
        .slice(0, 3);
    aiOrder(G, team, A, 'wagon', esc, { x: Wg.x, z: Wg.z }, 0);
    const es = new Set(esc.map(u => u.id));
    free = free.filter(u => !es.has(u.id));
  }
  if (L.micro >= 2) aiSmart(G, team, A, L, free, foes);
  else aiBlob(G, team, A, L, free, foes);
  if (L.micro >= 3) aiKite(G, team, free, foes);
}
