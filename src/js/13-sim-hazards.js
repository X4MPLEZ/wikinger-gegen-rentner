/* ---------- Kegeln: a body that was knocked flying bowls over everyone it hits ----------
   Rule (same for both sides): a flying body moving faster than 4 m/s knocks every standing unit it touches down and
   sends it flying a bit too, losing a third of its own speed per hit. Chains of 3+ are a STRIKE highlight. */
function bowlStep(G) {
  for (const u of G.units) {
    const a = u.air;
    if (!a || a.kind !== 'impact' || u.hp <= 0) continue;
    const sp = Math.hypot(a.vx, a.vz);
    if (sp < 4) continue;
    const ru = KINDS[u.k].r;
    for (const e of G.units) {
      if (e === u || e.hp <= 0 || e.air || e.pj || e.grab || e.bur || e.down > 0 || e.kbImm > G.t || (e.tutDummy && !e.tutPush)) continue;
      if (KINDS[e.k].role === 'siege' || e.dashUntil > G.t) continue; // a ramming rider ploughs through flying bodies (only another rider's ram can stop him)
      const dx = e.x - u.x,
        dz = e.z - u.z,
        rr = ru + KINDS[e.k].r + 0.35;
      if (dx * dx + dz * dz > rr * rr || Math.abs((e.y || 0) - a.y) > 1.6) continue;
      const d = Math.hypot(dx, dz) || 1,
        push = Math.min(7, 2.5 + sp * 0.45);
      const fl = knockFly(
        e,
        0,
        0,
        push,
        a.vx / sp + (dx / d) * 0.35,
        a.vz / sp + (dz / d) * 0.35,
        2.6 + Math.min(1.5, sp * 0.1),
        u.kbEgo ? 'ego' : 'hazard'
      );
      if (fl) {
        e.bowledBy = u.id;
        e.kbN = ((e.kbN || 0) + 1) % 100;
      }
      const king = G.chaos && u.kbTeam !== undefined && u.kbTeam !== e.team && pkL(G, u.kbTeam, 'kegel'); // Kegelkönig
      e.hp -= king ? 30 : 8;
      e.hurt = 2;
      e.lh = [-2, u.kbTeam ?? -1, 0];
      G.st && u.kbTeam !== undefined && u.kbTeam !== e.team && G.st[u.kbTeam].rams++;
      a.vx *= king ? 0.9 : 0.66;
      a.vz *= king ? 0.9 : 0.66;
      const chain = (u.bowl || 0) + 1;
      e.bowl = chain;
      u.bowl = chain; // chain length travels with the bodies
      if (chain >= 3 && (chain === 3 || chain === 5 || chain === 8) && u.kbTeam !== undefined)
        highlight(G, 'strike', u.kbTeam, chain, e.x, e.z);
      if (Math.hypot(a.vx, a.vz) < 4) break;
    }
  }
  for (const u of G.units) if (!u.air && u.bowl && !(u.down > 0)) u.bowl = 0;
}
/* ---------- Rolling boulders (Viking catapult): the rock keeps rolling after impact and bowls through ---------- */
function rollStep(G) {
  if (!G.rolls || !G.rolls.length) return;
  for (let i = G.rolls.length - 1; i >= 0; i--) {
    const r = G.rolls[i];
    r.t += DT;
    r.v = Math.max(0, r.v - 4.5 * DT);
    r.ang += (r.v * DT) / 0.9;
    const nx = r.x + r.dx * r.v * DT,
      nz = r.z + r.dz * r.v * DT;
    const stop =
      r.v < 0.6 || !walkable(nx, nz) || fallZone(nx, nz) || inWater(nx, nz) || unitY(nx, nz) - unitY(r.x, r.z) > 0.6 * r.v * DT + 0.25;
    if (!stop) {
      r.x = nx;
      r.z = nz;
    }
    for (const e of G.units) {
      if (e.hp <= 0 || e.air || e.pj || e.grab || e.bur || e.down > 0 || e.kbImm > G.t || KINDS[e.k].role === 'siege') continue;
      const dx = e.x - r.x,
        dz = e.z - r.z;
      if (dx * dx + dz * dz > (1.5 + KINDS[e.k].r) ** 2) continue;
      if (knockFly(e, 0, 0, 3 + r.v * 0.3, r.dx + dx * 0.2, r.dz + dz * 0.2, 3.5, 'hazard')) {
        e.kbN = ((e.kbN || 0) + 1) % 100;
        e.bowl = (e.bowl || 0) + 1;
      }
      e.hp -= 14 * (e.team === r.team ? 0.5 : 1);
      e.hurt = 2;
      e.lh = [-3, r.team, 0];
      r.v *= 0.8;
      r.hits++;
      if (r.hits === 3) highlight(G, 'boulder', r.team, 3, r.x, r.z);
    }
    if (stop || r.t > 4) {
      r.dead = (r.dead || 0) + DT;
      if (r.dead > 0.6) G.rolls.splice(i, 1);
      else r.v = 0;
    }
  }
}
/* ---------- Cream puddles (pensioner cake catapult): sticky ground, everyone wades slowly ---------- */
function gooStep(G) {
  if (!G.goo || !G.goo.length) return;
  for (let i = G.goo.length - 1; i >= 0; i--) {
    const g = G.goo[i];
    g.t -= DT;
    if (g.t <= 0) {
      G.goo.splice(i, 1);
      continue;
    }
    for (const e of G.units) {
      if (e.hp <= 0 || e.air || e.pj || KINDS[e.k].role === 'siege') continue;
      const dx = e.x - g.x,
        dz = e.z - g.z;
      if (dx * dx + dz * dz < g.r * g.r) {
        e.slowT = Math.max(e.slowT || 0, 0.3);
        e.gooed = 1;
      }
    }
  }
}
