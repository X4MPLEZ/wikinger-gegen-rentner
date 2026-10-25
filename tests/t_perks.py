# Chaos perks: every perk is complete (tier, German text, an icon), offers open up tier by tier and the side behind draws better,
# and the new or changed effects really happen in the simulation (ordinary warriors, not only the ego warrior).
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => { const W = __wvr, out = {};
      out.bad = Object.entries(W.PERKS).filter(([id, P]) => !(P.t >= 0 && P.t <= 3) || !P.n || !P.d || !/<path|<circle|<rect|<ellipse/.test(P.ic)).map(([id]) => id);
      out.count = [0, 1, 2, 3].map(t => Object.values(W.PERKS).filter(P => P.t === t).length);
      const fresh = () => { const G = W.newGame(['viking', 'rentner'], 8 * 31 + 1, true, { squad: false }); W.G = G; G.cd = 0; G.units.length = 0; G.bears = []; G.towerOff = [true, true]; G.itemT = 1e9; G.noEvents = true; G.nextOffer = 1e9; return G; };
      const mk = (G, team, k, x, z) => { const q = W.nw(x, z); const u = { id: G.nextId++, k, team, x: q.x, z: q.z, y: W.unitY(q.x, q.z), hp: W.KINDS[k].hp, cd: 0, tgt: -1, at: 0, atk: 0, sp: 0, run: 0, re: 0, ord: { x: q.x, z: q.z, mv: false }, path: null, losT: 0, los: true, repath: 0, poss: false, rage: 0, spcd: 0, yaw: 0 }; G.units.push(u); return u; };
      // offers: tiers open up, the side behind gets more epic/legendary cards
      { const G = fresh(); const T = G.teams[0]; const tiers = n => { G.offerN = n; const s = new Set(); for (let i = 0; i < 300; i++) { W.makeOffer(G, T); T.offer.forEach(id => s.add(W.PERKS[id].t)); } return Math.max(...s); };
        out.maxTier = [tiers(1), tiers(2), tiers(3), tiers(4)];
        G.offerN = 5; const share = () => { let hi = 0, n = 0; for (let i = 0; i < 600; i++) { W.makeOffer(G, T); T.offer.forEach(id => { n++; if (W.PERKS[id].t >= 2) hi++; }); } return hi / n; };
        G.flags.forEach(f => (f.owner = -1)); out.evenHi = +share().toFixed(2); out.evenUp = T.offerUp;
        G.flags[0].owner = 1; out.behindHi = +share().toFixed(2); out.behindUp = T.offerUp;
        out.factionOk = [...Array(200)].every(() => { W.makeOffer(G, T); return T.offer.every(id => !W.PERKS[id].f || W.PERKS[id].f === T.fac); }); }
      const c = W.nw(0, 0);
      // Hühnerarmee: 30 chickens hatch once at the own base, storm off, do not count for the army, cannot be steered, give no kill gold
      { const G = fresh(); const T = G.teams[0]; mk(G, 1, 2, c.x + 40, c.z).tutStill = true; T.offer = ['hens', 'gold']; W.applyCmd(G, 0, { t: 'perk', id: 'hens' });
        const hens = G.units.filter(u => u.team === 0 && u.hen), EB = W.BASES[1], d0 = hens.reduce((a, u) => a + Math.hypot(u.x - EB.x, u.z - EB.z), 0) / hens.length;
        for (let i = 0; i < 20 * 6; i++) W.step(G);
        const d1 = hens.filter(u => u.hp > 0).reduce((a, u) => a + Math.hypot(u.x - EB.x, u.z - EB.z), 0) / Math.max(1, hens.filter(u => u.hp > 0).length);
        W.applyCmd(G, 0, { t: 'poss', id: hens[0].id }); const steer = !!hens[0].poss;
        const g0 = G.teams[1].gold, byId = new Map(G.units.map(u => [u.id, u])); W.hit(G, hens[1].id, 999, 1, byId, 0);
        out.hens = { n: hens.length, pop: W.popOf(G, 0), closer: d0 - d1 > 15, steer, gold: G.teams[1].gold - g0, snapBit: W.snapOf(G).u.filter(e => e[7] & 32768).length >= 29 }; }
      // Schildwall: an archer's arrow on a Berserker does half
      { const G = fresh(); const v = mk(G, 0, 0, c.x, c.z); const byId = new Map(G.units.map(u => [u.id, u]));
        const dmg = () => { const h0 = v.hp; W.hit(G, v.id, 20, 1, byId, 3); const d = h0 - v.hp; v.hp = 999; return d; }; v.hp = 999;
        const a = dmg(); G.teams[0].pk.wall = 1; const b2 = dmg(); out.wall = +(b2 / a).toFixed(2); }
      // Salvenhölle: an ordinary archer fires a third more arrows
      { const shots = on => { const G = fresh(); if (on) G.teams[0].pk.volley = 1; const a = mk(G, 0, 1, c.x, c.z); const foe = mk(G, 1, 2, c.x + 7, c.z); foe.hp = 1e6; foe.tutStill = true; foe.cd = 1e9;
          let n = 0; const seen = new Set(); for (let i = 0; i < 20 * 20; i++) { W.step(G); for (const p of G.proj) if (!seen.has(p)) { seen.add(p); if (p.team === 0) n++; } } return n; };
        out.volley = [shots(false), shots(true)]; }
      // Tornado-Opa: an ordinary Opa in a fight knocks the foes around him back
      { const G = fresh(); G.teams[1].pk.spin = 1; G.teams[1].fac = 'rentner'; const o = mk(G, 1, 2, c.x, c.z); o.hp = 1e5; const fs = [0, 1, 2].map(i => mk(G, 0, 0, c.x + 1.2, c.z + (i - 1) * 0.9)); fs.forEach(f => { f.hp = 1e5; f.cd = 1e9; f.tutStill = true; });
        for (let i = 0; i < 20 * 4; i++) W.step(G); out.spin = fs.filter(f => f.kbN).length; }
      // Walhalla-Raserei: a battered ordinary Berserker attacks faster and knocks over
      { const tempo = on => { const G = fresh(); if (on) G.teams[0].pk.walhalla = 1; const v = mk(G, 0, 0, c.x, c.z); v.hp = W.KINDS[0].hp * 0.4; const f = mk(G, 1, 2, c.x + 1.1, c.z); f.hp = 1e6; f.cd = 1e9; f.tutStill = true;
          let a = 0, last = v.atk; for (let i = 0; i < 20 * 10; i++) { W.step(G); v.hp = Math.min(v.hp, W.KINDS[0].hp * 0.4); if (v.atk !== last) { a++; last = v.atk; } } return [a, f.kbN || 0]; };
        out.walhalla = [tempo(false), tempo(true)]; }
      // Abrissbirne: an ordinary rider's charge throws its target
      { const G = fresh(); G.teams[0].pk.ram = 1; const rd = mk(G, 0, 4, c.x - 11, c.z); const f = mk(G, 1, 2, c.x, c.z); f.hp = 1e5; f.cd = 1e9; f.tutStill = true;
        W.applyCmd(G, 0, { t: 'order', ids: [rd.id], x: f.x, z: f.z, m: 0, target: f.id }); let kb = 0; for (let i = 0; i < 20 * 6 && !kb; i++) { W.step(G); kb = f.kbN || 0; } out.ram = kb; }
      // Erdbeben: the biggest group of enemies is knocked over every 30 s
      { const G = fresh(); G.teams[0].pk.quake = 1; const fs = [0, 1, 2, 3].map(i => mk(G, 1, 2, c.x + i, c.z)); fs.forEach(f => { f.hp = 1e5; f.tutStill = true; }); mk(G, 0, 0, c.x - 40, c.z).tutStill = true;
        for (let i = 0; i < 20 * 31; i++) W.step(G); out.quake = [fs.filter(f => f.kbN).length, G.hl.filter(h => h[1] === 'quake').length]; }
      // Unkraut vergeht nicht: every fourth fallen warrior comes back after 4 s
      { const G = fresh(); G.teams[0].pk.revive = 1; mk(G, 1, 2, c.x + 40, c.z).tutStill = true; const vs = [0, 1, 2, 3].map(i => mk(G, 0, 0, c.x + i * 3, c.z)); W.step(G);
        vs.forEach(v => (v.hp = 0)); for (let i = 0; i < 20 * 2; i++) W.step(G); const n2 = G.units.filter(u => u.team === 0).length; for (let i = 0; i < 20 * 3; i++) W.step(G);
        out.revive = [n2, G.units.filter(u => u.team === 0).length]; }
      // Doppelpack: every fourth recruit twice
      { const G = fresh(); const T = G.teams[0]; T.pk.twins = 1; T.gold = 1e5; for (let i = 0; i < 8; i++) W.applyCmd(G, 0, { t: 'spawn', k: 0 }); for (let i = 0; i < 20 * 60 && T.q.length; i++) W.step(G); for (let i = 0; i < 40; i++) W.step(G);
        out.twins = G.units.filter(u => u.team === 0).length; }
      // Hühnerfluch: four chickens every 12 s
      { const G = fresh(); G.teams[0].pk.chicken = 1; const fs = [0, 1, 2, 3].map(i => mk(G, 1, 2, c.x + i * 3, c.z)); fs.forEach(f => (f.tutStill = true)); mk(G, 0, 0, c.x - 40, c.z).tutStill = true;
        for (let i = 0; i < 20 * 18.5; i++) W.step(G); out.chicken = fs.filter(f => f.chick > 0).length; }
      return out; }""")
    print(json.dumps(r)); print('ERRS', errs[:3]); b.close()
ok = (not r['bad'] and r['maxTier'] == [1, 2, 2, 3] and r['behindHi'] > r['evenHi'] * 1.4 and r['behindUp'] == 1 and r['evenUp'] == 0 and r['factionOk']
      and r['hens']['n'] == 30 and r['hens']['pop'] <= 1 and r['hens']['closer'] and not r['hens']['steer'] and r['hens']['gold'] == 0 and r['hens']['snapBit'] and r['wall'] == 0.5 and r['volley'][1] >= r['volley'][0] * 1.25 and r['spin'] >= 2
      and r['walhalla'][1][1] >= 3 and r['walhalla'][0][1] == 0 and r['ram'] >= 1
      and r['quake'][0] >= 3 and r['quake'][1] == 1 and r['revive'][1] == r['revive'][0] + 1 and r['twins'] == 10 and r['chicken'] == 4 and not errs)
print('PERKS', 'OK' if ok else 'FAIL')
