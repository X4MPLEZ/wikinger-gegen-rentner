# Polar bear grudge: a bear hit from far away (an AI archer's arrow, an ego's free-aim arrow) charges the shooter and swipes at it.
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
      const run = (how) => {
        G.units.length = 0; G.bears.length = 0; G.teams[0].pos = null;
        const bear = { id:501, x:spot.x, z:spot.z, hx:spot.x, hz:spot.z, yaw:0, cd:0, atk:0, mv:0, wt:99, wx:spot.x, wz:spot.z, hp:520, mhp:520 };
        G.bears.push(bear);
        const a = mk(G, 0, 1, spot.x, spot.z - 18); a.ord = { x:a.x, z:a.z, mv:false };
        if (how === 'ego') { W.applyCmd(G, 0, { t:'poss', id:a.id }); W.step(G); }
        const d0 = Math.hypot(a.x - bear.x, a.z - bear.z);
        // the shot: an arrow that lands in the bear
        if (how === 'ego') G.fp.push({ id:999, x:bear.x, y:W.unitY(bear.x, bear.z) + 1, z:bear.z - 0.4, dx:0, dy:0, dz:1, t:1, team:0, k:1, dmg:20, src:a.id });
        else G.proj.push({ t:0, dmg:20, tgt:-3, bear:bear.id, team:0, k:1, src:a.id });
        let minD = d0, swipes = 0, atk0 = bear.atk, hp0 = a.hp, n = 0;
        for (let i = 0; i < 160; i++) {
          if (how === 'ego') G.teams[0].posIn = { id:a.id, n:++n, x:a.x, z:a.z, y:0, a:0, s:0, j:0, g:0, h:0, pad:0, air:0, flying:false };
          W.step(G); minD = Math.min(minD, Math.hypot(a.x - bear.x, a.z - bear.z)); if (bear.atk !== atk0) { swipes++; atk0 = bear.atk; }
        }
        return { d0:+d0.toFixed(1), minD:+minD.toFixed(1), swipes, dmg:Math.round(hp0 - a.hp), ang:bear.ang || 0, bearHp:Math.round(bear.hp) };
      };
      out.ai = run('ai'); out.ego = run('ego');
      // control: an untouched bear ignores an archer 18 m away
      G.units.length = 0; G.bears.length = 0; const bear = { id:502, x:spot.x, z:spot.z, hx:spot.x, hz:spot.z, yaw:0, cd:0, atk:0, mv:0, wt:99, wx:spot.x + 25, wz:spot.z, hp:520, mhp:520 }; // strolls sideways (a random stroll could lead it towards the archer)
      G.bears.push(bear); const a = mk(G, 0, 1, spot.x, spot.z - 18); a.ord = { x:a.x, z:a.z, mv:false };
      for (let i = 0; i < 100; i++) W.step(G); out.calm = +Math.hypot(a.x - bear.x, a.z - bear.z).toFixed(1);
      return out; }""")
    print(json.dumps(r, indent=1)); print('ERRS', errs[:5]); b.close()
    ok = all(r[h]['minD'] < 2.5 and r[h]['swipes'] >= 1 and r[h]['dmg'] > 0 and r[h]['ang'] >= 1 for h in ('ai', 'ego')) and r['calm'] > 15 and not errs
    print('BEAR', 'OK' if ok else 'FAIL')
