# Special moves and counters, in the simulation alone:
#  1) the Berserker's throw: the warrior in front is held up over his head (snapshot lf) for LIFT.hold s, stays with the Berserker while
#     he turns, then flies the way the Berserker faces;
#  2) the Krückstock-Opa's Stockwirbel lasts WHIRL.t and knocks again on its later turns;
#  3) the counters: the Feuerfass beats archers and catapults and loses to riders, archers no longer beat him, catapults hit bears hard.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => { const W = __wvr, out = {};
      const mk = (G, k, t, x, z) => { const q = W.nw(x, z); const u = { id: G.nextId++, k, team: t, x: q.x, z: q.z, y: W.unitY(q.x, q.z), hp: W.KINDS[k].hp, cd: 9, tgt: -1, at: 0, atk: 0, sp: 0, run: 0, re: 9, ord: { x: q.x, z: q.z, mv: false }, path: null, losT: 0, los: true, repath: 0, poss: false, rage: 0, spcd: 0, yaw: 0, tutStill: true }; G.units.push(u); return u; };
      // 1) the throw
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const f = W.FLAGS[0];
        const bz = mk(G, 0, 0, f.x, f.z), v = mk(G, 2, 1, f.x, f.z + 1.4); v.hp = 9999;
        W.applyCmd(G, 0, { t: 'poss', id: bz.id }); W.step(G); const T = G.teams[0]; let n = 1;
        const pkt = o => { T.posIn = { id: bz.id, n: n++, x: bz.x, z: bz.z, y: 0, a: 0, s: 0, j: 0, g: 0, h: 0, pad: 0, air: 0, flying: false, ...o }; };
        pkt({}); W.step(G); bz.spcd = 0; pkt({ s: 1 }); W.step(G);
        const lifted = !!v.lift, inSnap = (W.snapOf(G).lf || []).some(e => e[0] === v.id && e[1] === bz.id);
        let held = 0, maxGap = 0;
        // he turns to the side while holding: the throw goes that way
        for (let i = 0; i < 30; i++) { pkt({ s: 1, y: Math.PI / 2 }); W.step(G); if (v.lift) { held++; maxGap = Math.max(maxGap, Math.hypot(v.x - bz.x, v.z - bz.z)); } }
        for (let i = 0; i < 40; i++) { pkt({ s: 1, y: Math.PI / 2 }); W.step(G); }
        out.lift = { lifted, inSnap, held, maxGap: +maxGap.toFixed(2), dx: +(v.x - bz.x).toFixed(1), dz: +(v.z - bz.z).toFixed(1), after: !!v.lift }; }
      // 2) the whirl
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const f = W.FLAGS[0];
        const op = mk(G, 2, 1, f.x, f.z), e1 = mk(G, 0, 0, f.x + 1.5, f.z); e1.hp = 9999;
        W.applyCmd(G, 1, { t: 'poss', id: op.id }); W.step(G); const T = G.teams[1]; let n = 1;
        const pkt = o => { T.posIn = { id: op.id, n: n++, x: op.x, z: op.z, y: 0, a: 0, s: 0, j: 0, g: 0, h: 0, pad: 0, air: 0, flying: false, ...o }; };
        pkt({}); W.step(G); op.spcd = 0; const h0 = e1.hp; pkt({ s: 1 }); W.step(G);
        const spin = +op.spinT.toFixed(2), first = h0 - e1.hp; let hits = 0, last = e1.hp;
        // the enemy is kept close (as if he walked back in): the later turns hit him again
        for (let i = 0; i < 24; i++) { e1.x = op.x + 1.5; e1.z = op.z; e1.kb = null; e1.air = null; e1.fall = 0; pkt({ s: 1 }); W.step(G); if (e1.hp < last - 5) hits++; last = e1.hp; }
        out.whirl = { spin, first: Math.round(first), laterHits: hits, over: !(op.spinT > 0) }; }
      // 3) counters
      out.mult = { fassVsArcher: W.dmgMult(12, 1), fassVsCata: W.dmgMult(12, 6), fassVsRider: W.dmgMult(12, 4), riderVsFass: W.dmgMult(4, 12), archerVsFass: W.dmgMult(1, 12), archerVsBers: W.dmgMult(1, 0), cataVsBear: W.dmgMult(6, 8), meleeVsRider: W.dmgMult(0, 4) };
      return out; }""")
    print(json.dumps(r, indent=1)); print('ERRS', errs[:3])
    b.close()
L, Wh, M = r['lift'], r['whirl'], r['mult']
ok = (L['lifted'] and L['inSnap'] and 9 <= L['held'] <= 14 and L['maxGap'] < 0.5 and not L['after'] and L['dx'] > 4 and abs(L['dz']) < L['dx'] * 0.6
      and abs(Wh['spin'] - 1.0) < 0.1 and Wh['first'] >= 30 and Wh['laterHits'] >= 2 and Wh['over']
      and M['fassVsArcher'] > 1.3 and M['fassVsCata'] > 1.3 and M['fassVsRider'] < 1 and M['riderVsFass'] > 1.3 and M['archerVsFass'] == 1 and M['archerVsBers'] > 1.5
      and M['cataVsBear'] > 1.5 and M['meleeVsRider'] > 1.2 and not errs)
print('MOVES', 'OK' if ok else 'FAIL')
