# The two newest warriors and the flying chicken, in the simulation alone:
#  1) a computer Feuerfass between enemies lights its fuse and goes off: enemies hit, thrown and burning, an own warrior only a little;
#  2) a Feuerfass felled before it went off bursts smaller (a dud); 3) the steered Feuerfass climbs into the own catapult ('load'),
#  the catapult is taken over and its shot is the barrel (an explosion at the target); 4) a bear trap holds an enemy that walks in,
#  bites, lets go, and the Fallenleger gets a new trap; the computer's Fallenleger lays his trap when enemies come; 5) a steered chicken
#  rises only as fast as allowed, no sword reaches it up there, its dive pecks everyone around.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => { const W = __wvr, out = {};
      const mk = (G, k, t, x, z, still = true) => { const q = W.nw(x, z); const u = { id: G.nextId++, k, team: t, x: q.x, z: q.z, y: W.unitY(q.x, q.z), hp: W.KINDS[k].hp, cd: 9, tgt: -1, at: 0, atk: 0, sp: 0, run: 0, re: 9, ord: { x: q.x, z: q.z, mv: false }, path: null, losT: 0, los: true, repath: 0, poss: false, rage: 0, spcd: 0, yaw: 0, tutStill: still }; if (k === 13) u.trapC = 1; G.units.push(u); return u; };
      const meadow = G => { const f = W.FLAGS[0]; return { x: f.x, z: f.z }; };
      // 1) the computer Feuerfass in a crowd
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const f = mk(G, 12, 0, m.x, m.z, false); f.cd = 9;
        const foes = [[1.2, 0], [-1.1, 0.6], [0.3, 1.6]].map(([dx, dz]) => mk(G, 2, 1, m.x + dx, m.z + dz));
        const own = mk(G, 0, 0, m.x - 0.4, m.z - 1.8);
        let lit = 0, xe = null, burnFlag = 0, fuseFlag = 0;
        for (let i = 0; i < 50; i++) { W.step(G); if (f.fuse > 0) lit = 1; const s = W.snapOf(G); if (s.xe.length) xe = s.xe[s.xe.length - 1]; for (const e of s.u) { if (e[7] & 65536) burnFlag = 1; if (e[7] & 131072) fuseFlag = 1; } }
        out.blast = { lit, fuseFlag, burnFlag, xeKind: xe ? xe[4] : -1, fassDead: !G.units.includes(f), foeLoss: foes.map(u => Math.round(W.KINDS[2].hp - Math.max(0, u.hp))), foeKnocked: foes.filter(u => u.kbN).length, foeBurnt: foes.filter(u => u.burn > 0 || u.hp <= 0).length, ownLoss: Math.round(W.KINDS[0].hp - own.hp), ownKnocked: !!own.kbN, kf: (G.kf || []).map(k => k[4]) }; }
      // 2) a dud
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const f = mk(G, 12, 0, m.x, m.z); const foe = mk(G, 3, 1, m.x + 1.5, m.z);
        W.step(G); f.hp = -1; f.lh = [1, 1, 0]; W.step(G);
        const s = W.snapOf(G); out.dud = { xe: s.xe.map(e => e[4]), foeLoss: Math.round(W.KINDS[3].hp - foe.hp) }; }
      // 3) into the catapult and shot
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const f = mk(G, 12, 0, m.x, m.z); const cat = mk(G, 6, 0, m.x + 2.5, m.z); const tgt = mk(G, 2, 1, m.x, m.z + 16); tgt.tutStill = true;
        W.applyCmd(G, 0, { t: 'poss', id: f.id }); W.step(G);
        W.applyCmd(G, 0, { t: 'load', id: cat.id }); W.step(G);
        const T = G.teams[0], s1 = W.snapOf(G);
        out.load = { gone: !G.units.includes(f), fass: cat.fass, pos: T.pos === cat.id, catPoss: cat.poss, gn: s1.gn.includes(f.id), flag: !!(s1.u.find(e => e[0] === cat.id)[7] & 524288) };
        cat.cd = 0; T.posIn = { id: cat.id, n: 1, x: cat.x, z: cat.z, y: 0, a: 1, s: 0, j: 0, g: 0, h: 0, pad: 0, air: 0, flying: false, gp: [tgt.x, tgt.z] };
        cat.la = 0; W.step(G); const pj = G.proj.find(p => p.fass);
        let xe = null; for (let i = 0; i < 80; i++) { T.posIn = { ...T.posIn, n: 2 + i }; W.step(G); const s = W.snapOf(G); if (s.xe.length) xe = s.xe[s.xe.length - 1]; }
        out.shot = { proj: !!pj, xeKind: xe ? xe[4] : -1, xeNear: xe ? Math.hypot(xe[1] / 10 - tgt.x, xe[2] / 10 - tgt.z) < 3 : false, tgtLoss: Math.round(W.KINDS[2].hp - Math.max(0, tgt.hp)), fassAfter: cat.fass }; }
      // 4) the bear trap
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const fl = mk(G, 13, 1, m.x, m.z + 6); const laid = W.layTrap(G, fl, m.x, m.z);
        const v = mk(G, 0, 0, m.x, m.z - 9, false); v.ord = { x: m.x, z: m.z + 3, mv: true };
        let caught = 0, heldMove = 0, hp0 = 0, released = 0, pos = null, maxHold = 0, snapTr = 0;
        for (let i = 0; i < 160; i++) { W.step(G); const s = W.snapOf(G); if (s.tr.length) snapTr = 1;
          if (v.trapT > 0) { if (!caught) { caught = i; hp0 = v.hp; pos = [v.x, v.z]; } else heldMove = Math.max(heldMove, Math.hypot(v.x - pos[0], v.z - pos[1])); maxHold++; }
          else if (caught && !released) released = i; }
        out.trap = { laid, carryAfter: fl.trapC, caught: !!caught, bitten: Math.round(W.KINDS[0].hp - (hp0 || v.hp)), heldMove: +heldMove.toFixed(2), holdTicks: maxHold, released: !!released, trapsLeft: G.traps.length, snapTr, reArm: fl.trapRe > 0 || fl.trapC === 1 };
        for (let i = 0; i < 150; i++) W.step(G);
        out.trap.newTrap = fl.trapC === 1;
        // the computer's Fallenleger lays his trap when enemies come
        const G2 = W.newGame(['viking', 'rentner'], 4, false, { squad: false }); G2.cd = 0; W.G = G2; const m2 = meadow(G2);
        const f2 = mk(G2, 13, 1, m2.x, m2.z, false); f2.cd = 9; const e2 = mk(G2, 1, 0, m2.x, m2.z - 9);
        let t2 = -1; for (let i = 0; i < 200 && t2 < 0; i++) { W.step(G2); if ((G2.traps || []).length) t2 = i; }
        out.trap.autoLaid = t2 >= 0; }
      // 4b) the torch: a Feuerfass fighting one enemy sets him on fire; a trap catches two at once
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const f = mk(G, 12, 0, m.x, m.z, false); f.cd = 0; f.re = 0; const foe = mk(G, 2, 1, m.x + 1.2, m.z);
        let burnt = 0; for (let i = 0; i < 60 && !burnt; i++) { W.step(G); if (foe.burn > 0 && !f.fuse) burnt = i + 1; }
        const G2 = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G2.cd = 0; W.G = G2; const m2 = meadow(G2);
        const fl = mk(G2, 13, 1, m2.x, m2.z + 6); W.layTrap(G2, fl, m2.x, m2.z);
        const a = mk(G2, 0, 0, m2.x - 0.6, m2.z - 9, false), b2 = mk(G2, 0, 0, m2.x + 0.6, m2.z - 9, false);
        a.ord = { x: m2.x - 0.6, z: m2.z + 3, mv: true }; b2.ord = { x: m2.x + 0.6, z: m2.z + 3, mv: true };
        let both = 0; for (let i = 0; i < 160 && !both; i++) { W.step(G2); if (a.trapT > 0 && b2.trapT > 0) both = 1; }
        out.torch = { burnt, both, trapVs: (G2.traps[0] || {}).vs }; }
      // 5) the flying chicken
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const h = mk(G, 0, 0, m.x, m.z); h.hen = 1; h.hp = W.HEN.hp; h.mhp = W.HEN.hp;
        const foe = mk(G, 2, 1, m.x + 1, m.z, false); foe.cd = 0;
        W.applyCmd(G, 0, { t: 'poss', id: h.id }); W.step(G); const T = G.teams[0];
        let n = 1; const pkt = (o) => { T.posIn = { id: h.id, n: n++, x: h.x, z: h.z, y: 0, a: 0, s: 0, j: 0, g: 0, h: 0, pad: 0, air: 0, flying: false, fh: 0, dv: 0, ...o }; };
        pkt({ fh: 30 }); W.step(G); const oneTick = h.fh;
        for (let i = 0; i < 160; i++) { pkt({ fh: Math.min(17, (i + 2) * 0.12) }); W.step(G); }
        const top = h.fh, hpUp = h.hp;
        const foeHits = foe.atk;
        // dive: down fast, then the landing peck
        const fe = mk(G, 3, 1, h.x + 1.2, h.z); const fhp = fe.hp;
        let f = h.fh; for (let i = 0; i < 40; i++) { f = Math.max(0, f - 0.8); pkt({ fh: f, dv: f <= 0 ? 1 : 0 }); W.step(G); }
        for (let i = 0; i < 10; i++) { pkt({ fh: 0, dv: 1 }); W.step(G); }
        const s = W.snapOf(G);
        out.hen = { oneTick: +oneTick.toFixed(2), top: +top.toFixed(1), aloft: W.aloft({ fh: top }), hpUp: Math.round(hpUp), hpMax: W.HEN.hp, foeAtkWhileUp: foeHits, diveLoss: Math.round(fhp - fe.hp), xeDive: (G.xe || []).some(e => e[4] === W.XE.dive), hf: s.hf }; }
      return out; }""")
    print(json.dumps(r, indent=1)); print('ERRS', errs[:3]); b.close()
bl, du, ld, sh, tr, hn, to = r['blast'], r['dud'], r['load'], r['shot'], r['trap'], r['hen'], r['torch']
ok = (bl['lit'] and bl['fuseFlag'] and bl['burnFlag'] and bl['xeKind'] == 0 and bl['fassDead'] and min(bl['foeLoss']) >= 25 and bl['foeKnocked'] + sum(1 for x in bl['foeLoss'] if x >= 175) >= 2
      and bl['foeBurnt'] >= 2 and 0 < bl['ownLoss'] < 40
      and 1 in du['xe'] and du['foeLoss'] > 10
      and ld['gone'] and ld['fass'] == 1 and ld['pos'] and ld['catPoss'] and ld['gn'] and ld['flag']
      and sh['proj'] and sh['xeKind'] == 2 and sh['xeNear'] and sh['tgtLoss'] >= 60 and not sh['fassAfter']
      and tr['laid'] and tr['carryAfter'] == 0 and tr['caught'] and tr['bitten'] >= 25 and tr['heldMove'] < 0.2 and tr['holdTicks'] >= 55 and tr['released'] and tr['snapTr'] and tr['newTrap'] and tr['autoLaid']
      and to['burnt'] and to['both']
      and hn['oneTick'] < 0.3 and hn['top'] >= 15 and hn['aloft'] and hn['foeAtkWhileUp'] == 0 and hn['diveLoss'] >= 15 and hn['xeDive'] and not errs)
print('FASS', 'OK' if ok else 'FAIL')
