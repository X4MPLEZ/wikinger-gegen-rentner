# Knock guard: ordinary units never floor a possessed unit, hazards only rarely, other egos always.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader']); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => { const W = __wvr, out = {};
      const mk = (G, team, k, x, z) => { const u = { id:G.nextId++, k, team, x, z, y:W.unitY(x, z), hp:W.KINDS[k].hp, cd:0.4, tgt:-1, at:0, atk:0, sp:0, run:0, re:0, ord:{ x, z, mv:false }, path:null, losT:0, los:true, repath:0, poss:false, rage:0, spcd:0, yaw:0 }; G.units.push(u); return u; };
      let G = null; for (let sd = 1; sd < 800; sd++) { if ((sd % 8 + 8) % 8 !== 1) continue; G = W.newGame(['viking', 'rentner'], sd, false, { squad:false }); if (W.MAP.type === 'wiesen') break; }
      W.G = G; G.cd = 0; G.bears = []; G.bearQ = null; G.towerOff = [true, true]; G.itemT = 1e9; G.units.length = 0;
      const spot = W.nw(0, 0);
      // 1) direct: who may floor the ego
      const ego = mk(G, 1, 2, spot.x, spot.z); W.applyCmd(G, 1, { t:'poss', id:ego.id }); W.step(G);
      out.possessed = !!ego.poss;
      out.ai = W.knockFly(ego, ego.x + 1, ego.z, 3, undefined, undefined, 0, 'ai'); out.aiDown = ego.down > 0;
      out.hz1 = W.knockFly(ego, ego.x + 1, ego.z, 3, undefined, undefined, 0, 'hazard'); out.hz1Down = ego.down > 0;
      for (let i = 0; i < 80; i++) W.step(G); // 4 s later: still inside the cooldown
      out.hz2 = W.knockFly(ego, ego.x + 1, ego.z, 3, undefined, undefined, 0, 'hazard');
      out.egoSrc = W.knockFly(ego, ego.x + 1, ego.z, 3, undefined, undefined, 0, 'ego');
      for (let i = 0; i < 100; i++) W.step(G);
      out.hz3 = W.knockFly(ego, ego.x + 1, ego.z, 3, undefined, undefined, 0, 'hazard'); // 9 s after the first one
      for (let i = 0; i < 60; i++) W.step(G);
      // 2) an AI goat rider charges the ego: hurts, but never floors it; the same charge floors an ordinary unit
      const runCharge = (victimPoss) => { G.units.length = 0; const v = mk(G, 1, 2, spot.x, spot.z); if (victimPoss) { W.applyCmd(G, 1, { t:'poss', id:v.id }); } else { G.teams[1].pos = null; }
        const g = mk(G, 0, 4, spot.x, spot.z - 14); g.ord = { x:spot.x, z:spot.z + 4, mv:false }; const hp0 = v.hp; let down = 0, hits = 0, lastHp = v.hp;
        for (let i = 0; i < 160; i++) { if (victimPoss) G.teams[1].posIn = { id:v.id, x:v.x, z:v.z, y:Math.PI, a:0, s:0, pad:0, air:0 }; W.step(G); if (v.down > 0) down++; if (v.hp < lastHp) hits++; lastHp = v.hp; if (v.hp <= 0) break; }
        return { poss:!!v.poss, downTicks:down, hits, dmg:Math.round(hp0 - v.hp) }; };
      out.chargeEgo = runCharge(true); out.chargeAi = runCharge(false);
      // 3) a rolling boulder over the ego: first one floors (hazard), the second one right after only hurts, and only once
      G.units.length = 0; const e2 = mk(G, 1, 0, spot.x, spot.z); W.applyCmd(G, 1, { t:'poss', id:e2.id }); W.step(G); e2.egoKnT = -99;
      G.rolls = [{ id:1, x:spot.x - 3, z:spot.z, dx:1, dz:0, v:11, t:0, ang:0, team:0, hits:0 }]; let d1 = 0; for (let i = 0; i < 30; i++) { G.teams[1].posIn = { id:e2.id, x:e2.x, z:e2.z, y:0, a:0, s:0, pad:0, air:0 }; W.step(G); if (e2.down > 0) d1++; }
      for (let i = 0; i < 50; i++) { G.teams[1].posIn = { id:e2.id, x:e2.x, z:e2.z, y:0, a:0, s:0, pad:0, air:0 }; W.step(G); }
      const hpB = e2.hp; G.rolls = [{ id:2, x:e2.x - 3, z:e2.z, dx:1, dz:0, v:8, t:0, ang:0, team:0, hits:0 }]; let d2 = 0;
      for (let i = 0; i < 30; i++) { G.teams[1].posIn = { id:e2.id, x:e2.x, z:e2.z, y:0, a:0, s:0, pad:0, air:0 }; W.step(G); if (e2.down > 0) d2++; }
      out.boulder = { firstDown:d1, secondDown:d2, secondDmg:Math.round(hpB - e2.hp) };
      return out; }""")
    print(json.dumps(r, indent=1)); print('ERRS', errs[:5]); b.close()
    ok = (r['possessed'] and r['ai'] is False and not r['aiDown'] and r['hz1'] is True and r['hz2'] is False and r['egoSrc'] is True and r['hz3'] is True
          and r['chargeEgo']['downTicks'] == 0 and r['chargeEgo']['hits'] > 0 and r['chargeAi']['downTicks'] > 0
          and r['boulder']['firstDown'] > 0 and r['boulder']['secondDown'] == 0 and 0 < r['boulder']['secondDmg'] <= 30 and not errs)
    print('KNOCK', 'OK' if ok else 'FAIL')
