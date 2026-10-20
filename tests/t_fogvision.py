# Fog vision rules (fog mode and the "Nebelwand" event), the same for the computer as for the player: held flags are watchtowers,
# riders see farther, a steered warrior's lantern is seen from farther, warriors at the enemy base light it up, and the computer
# remembers for a few seconds where it last saw someone (at that spot, not where the foe really is now).
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => { const W = __wvr, S = W.FOG_SIGHT, out = {};
      const G = W.newGame(['viking', 'rentner'], 8 * 77 + 1, false, { fog: true, squad: false }); W.G = G; G.cd = 0; G.units.length = 0; G.bears = [];
      const mk = (team, k, x, z) => { const u = { id: G.nextId++, k, team, x, z, y: W.unitY(x, z), hp: W.KINDS[k].hp, cd: 0.4, tgt: -1, at: 0, atk: 0, sp: 0, run: 0, re: 0, ord: { x, z, mv: false }, path: null, losT: 0, los: true, repath: 0, poss: false, rage: 0, spcd: 0, yaw: 0 }; G.units.push(u); return u; };
      const sees = (mine, f) => W.aiSees(G, 1, mine, f);
      const F = W.FLAGS[0], at = (x, z) => ({ x, z, team: 0 });
      // held flag = watchtower
      G.flags[0].owner = -1; out.flagNeutral = sees([], at(F.x + 12, F.z));
      G.flags[0].owner = 1; out.flagHeld = sees([], at(F.x + 12, F.z)); G.flags[0].owner = -1;
      // riders scout farther than foot soldiers
      const c = W.nw(0, 0);
      const zerk = mk(1, 2, c.x, c.z); out.footAt17 = sees([zerk], at(c.x + 17, c.z));
      zerk.k = 5; out.riderAt17 = sees([zerk], at(c.x + 17, c.z)); zerk.k = 2;
      // a lantern is seen from afar
      out.plainAt21 = sees([zerk], { x: c.x + 21, z: c.z, team: 0 });
      out.lanternAt21 = sees([zerk], { x: c.x + 21, z: c.z, team: 0, poss: true });
      // siege light: a warrior at the enemy base sees what stands around it
      const EB = W.BASES[0], dz = EB.z > 0 ? -1 : 1, q = W.nw(EB.x, EB.z + dz * 12);
      const raider = { x: q.x, z: q.z, k: 2, team: 1 };
      out.siegeFar = sees([], at(EB.x + 20, EB.z));
      out.siegeLit = sees([raider], at(EB.x + 20, EB.z));
      // memory: seen, then gone into the fog -> remembered at the old spot for FOG_SIGHT.memory seconds
      G.units.length = 0; const A = W.aiNew('hard'); const me = mk(1, 2, c.x, c.z), foe = mk(0, 0, c.x + 6, c.z);
      let known = W.aiKnownFoes(G, 1, A, [me]); out.seen = known.length === 1 && known[0] === foe;
      foe.x = c.x + 60; const fx = c.x + 6;
      known = W.aiKnownFoes(G, 1, A, [me]); out.rememberedAt = known.length ? +known[0].x.toFixed(1) - +fx.toFixed(1) : null; out.rememberedId = known.length ? known[0].id === foe.id : false;
      G.t += S.memory + 0.5; known = W.aiKnownFoes(G, 1, A, [me]); out.forgotten = known.length === 0;
      // the "Nebelwand" event in a classic match: the computer no longer sees through it
      const G2 = W.newGame(['viking', 'rentner'], 8 * 77 + 1, false, { squad: false }); W.G = G2; G2.units.length = 0;
      const me2 = { ...me }; me2.id = 1; G2.units.push(me2); const far = { ...foe, id: 2, x: c.x + 50, z: c.z, team: 0 }; G2.units.push(far);
      out.classicSeesFar = W.aiKnownFoes(G2, 1, W.aiNew('hard'), [me2]).length === 1;
      G2.ev = { cur: 1, t: 30 }; out.eventSeesFar = W.aiKnownFoes(G2, 1, W.aiNew('hard'), [me2]).length === 1;
      return out; }""")
    print(json.dumps(r)); print('ERRS', errs[:3]); b.close()
ok = (not r['flagNeutral'] and r['flagHeld'] and not r['footAt17'] and r['riderAt17'] and not r['plainAt21'] and r['lanternAt21']
      and not r['siegeFar'] and r['siegeLit'] and r['seen'] and r['rememberedAt'] == 0 and r['rememberedId'] and r['forgotten']
      and r['classicSeesFar'] and not r['eventSeesFar'] and not errs)
print('FOGVISION', 'OK' if ok else 'FAIL')
