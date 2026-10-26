# The two newest warriors and the flying chicken, in the simulation alone:
#  1) a computer Feuerfass between enemies never lights his fuse on his own (he fights with the torch); lit (the steered player's special)
#     it goes off: enemies hit, thrown and burning, an own warrior only a little;
#  2) a Feuerfass felled before it went off bursts smaller (a dud); 3) the steered Feuerfass climbs into the own catapult ('load'),
#  the catapult is taken over and its shot is the barrel (an explosion at the target); 4) a bear trap holds an enemy that walks in,
#  bites, lets go, and the Fallenleger gets a new trap; the computer's Fallenleger throws his trap when enemies come; 5) a steered chicken
#  rises only as fast as allowed, no sword reaches it up there, its dive pecks everyone around; 6) the Fallenleger's row of trap jaws:
#  the computer strikes from a few steps away, everyone on the line is bitten once and held a moment (a rider longer), the steered one
#  strikes where he faces and counters riders softly; the special throws the trap where he aims (at most TRAP.throw m) and a second
#  throw picks the lying one up (still one trap); a headshot on a Feuerfass kills him at once and he goes off.
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
        let lit = 0, xe = null, burnFlag = 0, fuseFlag = 0, selfLit = 0;
        for (let i = 0; i < 40; i++) { W.step(G); if (f.fuse > 0) selfLit = 1; }
        foes.forEach(u => { u.hp = W.KINDS[2].hp; u.burn = 0; }); own.hp = W.KINDS[0].hp; own.burn = 0; f.hp = W.KINDS[12].hp; f.burn = 0;
        W.fassLight(G, f);
        for (let i = 0; i < 50; i++) { W.step(G); if (f.fuse > 0) lit = 1; const s = W.snapOf(G); if (s.xe.length) xe = s.xe[s.xe.length - 1]; for (const e of s.u) { if (e[7] & 65536) burnFlag = 1; if (e[7] & 131072) fuseFlag = 1; } }
        out.blast = { selfLit, lit, fuseFlag, burnFlag, xeKind: xe ? xe[4] : -1, fassDead: !G.units.includes(f), foeLoss: foes.map(u => Math.round(W.KINDS[2].hp - Math.max(0, u.hp))), foeKnocked: foes.filter(u => u.kbN).length, foeBurnt: foes.filter(u => u.burn > 0 || u.hp <= 0).length, ownLoss: Math.round(W.KINDS[0].hp - own.hp), ownKnocked: !!own.kbN, kf: (G.kf || []).map(k => k[4]) }; }
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
        out.trap.autoLaid = t2 >= 0;
        out.trap.autoThrown = t2 >= 0 ? +Math.hypot(G2.traps[0].x - f2.x, G2.traps[0].z - f2.z).toFixed(1) : 0; }
      // 4b) the torch: a Feuerfass fighting one enemy sets him on fire; a trap catches two at once
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const f = mk(G, 12, 0, m.x, m.z, false); f.cd = 0; f.re = 0; const foe = mk(G, 2, 1, m.x + 1.2, m.z);
        let burnt = 0; for (let i = 0; i < 60 && !burnt; i++) { W.step(G); if (foe.burn > 0 && !f.fuse) burnt = i + 1; }
        const G2 = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G2.cd = 0; W.G = G2; const m2 = meadow(G2);
        const fl = mk(G2, 13, 1, m2.x, m2.z + 6); W.layTrap(G2, fl, m2.x, m2.z);
        const a = mk(G2, 0, 0, m2.x - 0.6, m2.z - 9, false), b2 = mk(G2, 0, 0, m2.x + 0.6, m2.z - 9, false);
        a.ord = { x: m2.x - 0.6, z: m2.z + 3, mv: true }; b2.ord = { x: m2.x + 0.6, z: m2.z + 3, mv: true };
        let both = 0; for (let i = 0; i < 160 && !both; i++) { W.step(G2); if (a.trapT > 0 && b2.trapT > 0) both = 1; }
        out.torch = { burnt, both, trapVs: (G2.traps[0] || {}).vs };
        // burning: a warrior who is not steered runs about screaming the whole fire – into shallow water close by, where it goes out
        let G3 = null, wx = null, wz = null, dx2 = null, dz2 = null, dx3 = null, dz3 = null;
        const nearW = (x, z) => [0, 1, 2, 3, 4, 5, 6, 7].some(a => W.inWater(x + Math.sin(a * 0.785) * 0.9, z + Math.cos(a * 0.785) * 0.9));
        const dry = (x, z, y0) => W.walkable(x, z) && !nearW(x, z) && ![0, 1, 2, 3].some(q => nearW(x + Math.sin(q) * 1.5, z + Math.cos(q) * 1.5)) && Math.abs(W.groundY(x, z) - y0) < 1.5;
        for (let sd = 3; sd < 60 && wx === null; sd++) { G3 = W.newGame(['viking', 'rentner'], sd, false, { squad: false }); G3.cd = 0; W.G = G3;
        for (let x = -60; x <= 60 && wx === null; x += 1) for (let z = -90; z <= 90 && wx === null; z += 1)
          if (W.walkable(x, z) && nearW(x, z)) for (let a = 0; a < 8; a++) {
            // dry land 5 m and 8 m from the shore, the same way (the second one for a torch's short fire)
            const y0 = W.groundY(x, z), at = d => [x + Math.sin(a) * d, z + Math.cos(a) * d];
            if ([3, 4, 5, 6, 7, 8].every(d => dry(...at(d), y0))) { wx = x; wz = z; [dx2, dz2] = at(5); [dx3, dz3] = at(8); break; } } }
        const atW = v => [0, 1, 2, 3, 4, 5, 6, 7].some(a => [1, 1.5, 2].some(rr => W.inWater(v.x + Math.sin(a * 0.785) * rr, v.z + Math.cos(a * 0.785) * rr))) || W.inWater(v.x, v.z);
        if (wx !== null) {
          const v = mk(G3, 2, 1, dx2, dz2, false); v.cd = 9; v.re = 99;
          v.burn = 3.4; v.burnT = 0; v.burnP = 3.4; v.burnW = undefined;
          let out2 = -1; for (let i = 0; i < 68 && out2 < 0; i++) { W.step(G3); if (!(v.burn > 0)) out2 = i; }
          out.wet = { found: true, outAt: out2, atWater: atW(v), imm: v.fireImm > G3.t, ran: +Math.hypot(v.x - dx2, v.z - dz2).toFixed(1) };
          // a torch's fire (1.8 s, panic 1.2 s) 8 m from the water: he runs on until he is in, before the fire would go out by itself
          G3.units.splice(G3.units.indexOf(v), 1);
          const v2 = mk(G3, 2, 1, dx3, dz3, false); v2.cd = 9; v2.re = 99;
          v2.burn = W.FASS.torch; v2.burnT = 0; v2.burnP = W.FASS.torchPanic; v2.burnW = undefined;
          let out3 = -1; for (let i = 0; i < 40 && out3 < 0; i++) { W.step(G3); if (!(v2.burn > 0)) out3 = i; }
          out.wetTorch = { outAt: out3, atWater: atW(v2), ran: +Math.hypot(v2.x - dx3, v2.z - dz3).toFixed(1) };
        } else out.wet = { found: false }; }
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
      // 6) the Fallenleger's row of trap jaws, the thrown trap, the headshot
      { const G = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G.cd = 0; W.G = G; const m = meadow(G);
        const fl = mk(G, 13, 1, m.x, m.z, false); fl.cd = 0; fl.re = 0; fl.trapC = 0; fl.trapRe = 99; // (no trap: only the attack)
        const a = mk(G, 0, 0, m.x, m.z - 4.4, false), c = mk(G, 4, 0, m.x + 0.2, m.z - 2.6, false), far = mk(G, 0, 0, m.x + 4, m.z, true);
        a.cd = 9; c.cd = 9; a.ord = { x: a.x, z: a.z, mv: false }; c.ord = { x: c.x, z: c.z, mv: false };
        let xe = null, snagA = 0, snagC = 0, held = 0, fangN = 0;
        for (let i = 0; i < 14; i++) { W.step(G); const s = W.snapOf(G); for (const e of s.xe) if (e[4] === W.XE.fangs) { xe = e; fangN++; }
          for (const e of s.u) if (e[7] & 2097152) { if (e[0] === a.id) snagA++; if (e[0] === c.id) snagC++; }
          if (a.trapT > 0 || c.trapT > 0) held = 1; }
        const lossA = Math.round(W.KINDS[0].hp - a.hp), lossC = Math.round(W.KINDS[4].hp - c.hp);
        out.fang = { xe: !!xe, n: xe ? xe[6] : 0, src: xe ? xe[7] === fl.id : false, lossA, lossC, lossFar: Math.round(W.KINDS[0].hp - far.hp), snagA, snagC, held, rows: fangN };
        // each enemy at most once per row: three in a line
        const G2 = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G2.cd = 0; W.G = G2; const m2 = meadow(G2);
        const f2 = mk(G2, 13, 1, m2.x, m2.z); f2.trapC = 0; f2.trapRe = 99;
        const line = [1.6, 2.6, 4.4].map(d => mk(G2, 2, 0, m2.x, m2.z + d));
        W.fangLine(G2, f2, 0);
        for (let i = 0; i < 20; i++) W.step(G2);
        out.fang.line = line.map(u => Math.round(W.KINDS[2].hp - u.hp));
        out.fang.pts = W.fangPts(m2.x, m2.z, 0).length;
        // the steered Fallenleger: strikes where he faces, a rider loses a fair share (soft counter)
        const G3 = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G3.cd = 0; W.G = G3; const m3 = meadow(G3);
        const f3 = mk(G3, 13, 1, m3.x, m3.z); const rider = mk(G3, 4, 0, m3.x + 3, m3.z); const behind = mk(G3, 4, 0, m3.x - 3, m3.z);
        W.applyCmd(G3, 1, { t: 'poss', id: f3.id }); W.step(G3);
        const T3 = G3.teams[1]; let n3 = 1;
        const pk3 = o => { T3.posIn = { id: f3.id, n: n3++, x: f3.x, z: f3.z, y: Math.PI / 2, a: 0, s: 0, j: 0, g: 0, h: 0, pad: 0, air: 0, flying: false, ...o }; };
        pk3({}); W.step(G3); f3.cd = 0; pk3({ a: 1 }); W.step(G3);
        for (let i = 0; i < 12; i++) { pk3({ a: 1 }); W.step(G3); }
        out.fang.ego = { rider: +((W.KINDS[4].hp - rider.hp) / W.KINDS[4].hp).toFixed(2), behind: Math.round(W.KINDS[4].hp - behind.hp) };
        // the special: thrown where he aims (clamped), a second throw picks the first up
        f3.trapC = 1; f3.trapRe = 0; f3.spcd = 0;
        pk3({ a: 1, s: 1, gp: [m3.x, m3.z + 5] }); W.step(G3);
        const t1 = (G3.traps || []).map(t => [+t.x.toFixed(1), +t.z.toFixed(1)]);
        for (let i = 0; i < 50; i++) { pk3({ a: 1, s: 1, gp: [m3.x, m3.z + 5] }); W.step(G3); }
        f3.spcd = 0; pk3({ a: 1, s: 2, gp: [m3.x + 30, m3.z] }); W.step(G3);
        const t2 = (G3.traps || []).map(t => [+t.x.toFixed(1), +t.z.toFixed(1)]);
        out.fang.throw1 = t1.length === 1 ? +Math.hypot(t1[0][0] - m3.x, t1[0][1] - (m3.z + 5)).toFixed(1) : -1;
        out.fang.throw2 = t2.length === 1 ? +Math.hypot(t2[0][0] - f3.x, t2[0][1] - f3.z).toFixed(1) : -t2.length;
        out.fang.moved = t2.length === 1 && t1.length === 1 && Math.hypot(t2[0][0] - t1[0][0], t2[0][1] - t1[0][1]) > 3;
        // a headshot on a Feuerfass: dead at once, and the barrel goes off for the shooter
        const G4 = W.newGame(['viking', 'rentner'], 3, false, { squad: false }); G4.cd = 0; W.G = G4; const m4 = meadow(G4);
        const ff = mk(G4, 12, 0, m4.x, m4.z); const nb = mk(G4, 0, 0, m4.x + 2, m4.z); const byId = new Map(G4.units.map(u => [u.id, u]));
        W.hit(G4, ff.id, 5, 1, byId, 1, true, true); W.step(G4);
        out.fang.head = { dead: ff.hp <= 0, boom: (G4.xe || []).some(e => e[4] === W.XE.blast), nbLoss: Math.round(W.KINDS[0].hp - nb.hp) }; }
      return out; }""")
    print(json.dumps(r, indent=1)); print('ERRS', errs[:3]); b.close()
bl, du, ld, sh, tr, hn, to, fg = r['blast'], r['dud'], r['load'], r['shot'], r['trap'], r['hen'], r['torch'], r['fang']
ok = (not bl['selfLit'] and bl['lit'] and bl['fuseFlag'] and bl['burnFlag'] and bl['xeKind'] == 0 and bl['fassDead'] and min(bl['foeLoss']) >= 25 and bl['foeKnocked'] + sum(1 for x in bl['foeLoss'] if x >= 175) >= 2
      and bl['foeBurnt'] >= 2 and 0 < bl['ownLoss'] < 40
      and 1 in du['xe'] and du['foeLoss'] > 10
      and ld['gone'] and ld['fass'] == 1 and ld['pos'] and ld['catPoss'] and ld['gn'] and ld['flag']
      and sh['proj'] and sh['xeKind'] == 2 and sh['xeNear'] and sh['tgtLoss'] >= 60 and not sh['fassAfter']
      and tr['laid'] and tr['carryAfter'] == 0 and tr['caught'] and tr['bitten'] >= 25 and tr['heldMove'] < 0.2 and tr['holdTicks'] >= 55 and tr['released'] and tr['snapTr'] and tr['newTrap'] and tr['autoLaid'] and tr['autoThrown'] > 2
      and to['burnt'] and to['both'] and (not r['wet']['found'] or (0 < r['wet']['outAt'] < 60 and r['wet']['atWater'] and r['wet']['imm'] and r['wet']['ran'] > 2
      and 0 < r['wetTorch']['outAt'] < 34 and r['wetTorch']['atWater'] and r['wetTorch']['ran'] > 5))
      and hn['oneTick'] < 0.3 and hn['top'] >= 15 and hn['aloft'] and hn['foeAtkWhileUp'] == 0 and hn['diveLoss'] >= 15 and hn['xeDive']
      and fg['xe'] and fg['n'] >= 4 and fg['src'] and fg['lossA'] >= 8 and fg['lossC'] >= 10 and fg['lossFar'] == 0 and fg['snagA'] >= 1 and fg['snagC'] > fg['snagA']
      and all(10 <= x <= 14 for x in fg['line']) and fg['pts'] == 6
      and 0.25 <= fg['ego']['rider'] < 0.7 and fg['ego']['behind'] == 0
      and 0 <= fg['throw1'] < 0.3 and 6.5 < fg['throw2'] <= 7.6 and fg['moved']
      and fg['head']['dead'] and fg['head']['boom'] and fg['head']['nbLoss'] > 30 and not errs)
print('FASS', 'OK' if ok else 'FAIL')
