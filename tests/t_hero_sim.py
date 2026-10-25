# "Den Helden spielen" in the simulation: who may (every warrior), the script's damage, immunity, Heldentod (unit gone, kill feed cause 13,
# banner), the worm dives afterwards; a worm beaten mid-way holds out until the hero is swallowed (he always dies), then it turns / dies.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader']); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => { const W = __wvr, out = {};
      let G = null, sd = 1; for (; sd < 900; sd++) { if ((sd % 8 + 8) % 8 !== 2) continue; G = W.newGame(['viking', 'rentner'], sd, false, { squad:false }); if (W.MAP.type === 'wueste' && G.bears.filter(b => b.worm).length === 2) break; }
      W.G = G; G.cd = 0; G.towerOff = [true, true]; G.itemT = 1e9; G.noEvents = true; G.units.length = 0;
      const w = G.bears.find(b => b.worm); G.bears = [w];
      const mk = (k, team, x, z) => { const u = { id:G.nextId++, k, team, x, z, y:W.unitY(x, z), hp:W.KINDS[k].hp, cd:0.3, tgt:-1, at:0, atk:0, sp:0, run:0, re:0, ord:{ x, z, mv:false }, path:null, losT:0, los:true, repath:0, poss:false, rage:0, tutStill:true }; G.units.push(u); return u; };
      const keepUp = () => { w.ws = 4; w.st = 0.5; w.cd = 99; w.bw = 0; w.hc = 99; };
      const inp = (u, h) => { G.teams[u.team].posIn = { id:u.id, x:u.x, z:u.z, y:u.yaw || 0, a:0, s:0, j:0, g:0, h, pad:0, air:0, flying:false }; };
      const near = W.nw(w.x + 3.2, w.z + 1.0);
      // 1) Berserker, possessed, 3.4 m from a reared-up worm: eligible; an archer is not; too far is not
      const u = mk(0, 0, near.x, near.z); W.applyCmd(G, 0, { t:'poss', id:u.id }); keepUp();
      out.berserkerHp = [Math.round(u.hp), Math.round(u.mhp)];
      out.elig = !!W.heroWorm(G, u);
      const far = W.nw(w.x + 9, w.z + 4); const ux = u.x, uz = u.z; u.x = far.x; u.z = far.z; out.eligFar = !!W.heroWorm(G, u); u.x = ux; u.z = uz;
      u.k = 1; out.eligArcher = !!W.heroWorm(G, u); u.k = 0;
      w.ws = 0; out.eligUnder = !!W.heroWorm(G, u); keepUp();
      // 2) the press: input counter h changes -> the sequence starts
      inp(u, 0); W.step(G); keepUp(); inp(u, 1); W.step(G);
      out.started = !!u.hero; out.wormWs = w.ws; out.bur = u.bur;
      const hp0 = w.hp, log = [];
      // immunity while on the worm: a projectile aimed at him, a knock
      G.proj.push({ t:0.05, dmg:500, tgt:u.id, team:1, k:-1 }); out.knock = W.knockFly(u, u.x + 1, u.z, 6);
      let snapHe = null;
      for (let i = 0; i < 160 && G.units.includes(u); i++) { W.step(G); if (i === 40) { const s = W.snapOf(G); snapHe = s.he; } if (i % 10 === 9) log.push([+(u.hero ? u.hero.t : -1).toFixed(2), Math.round(hp0 - w.hp), w.ws]); }
      out.log = log; out.snapHe = snapHe; const S1 = W.HERO_S[snapHe ? snapHe[0][6] : 0]; out.expDmg = S1.hits.length * S1.hitDmg + S1.inner.length * S1.innerDmg;
      out.dmg = Math.round(hp0 - w.hp); out.unitGone = !G.units.includes(u); out.wormAfter = [w.ws, Math.round(w.hp)];
      out.kf = (G.kf || []).slice(-1)[0]; out.hl = (G.hl || []).filter(h => h[1] === 'hero').map(h => [h[2], h[3]]);
      out.dz = (G.dz || []).filter(d => d[1] === u.id).map(d => d[2]); out.pos = G.teams[0].pos;
      // 3) the worm is nearly beaten: the stabs finish it, the hero gets away, the worm turns to his team
      const w2 = w; w2.ws = 4; w2.st = 0.5; w2.hp = 120; w2.tameTeam = undefined; w2.heroBy = 0;
      const u2 = mk(2, 0, near.x, near.z); W.applyCmd(G, 0, { t:'poss', id:u2.id }); keepUp(); w2.hp = 120;
      inp(u2, 0); W.step(G); keepUp(); w2.hp = 120; inp(u2, 1); W.step(G); out.started2 = !!u2.hero;
      for (let i = 0; i < 180 && u2.hero; i++) { W.step(G); if (u2.hero && w2.hp > 1 && w2.hp < 120 && !out.held) out.held = 0; if (u2.hero && w2.hp === 1) out.held = 1; }
      out.escape = { alive:G.units.includes(u2) && u2.hp > 0, hero:!!u2.hero, air:!!u2.air, bur:u2.bur, tame:w2.tameTeam, ws:w2.ws, hl:(G.hl || []).filter(h => h[1] === 'heroWin').length, kbTeam:u2.kbTeam, kind:u2.air && u2.air.kind };
      let land = 0; for (; land < 120 && u2.air; land++) W.step(G); out.landed = { steps:land, alive:G.units.includes(u2) && u2.hp > 0, fallen:!!u2.fallen, y:+(u2.y || 0).toFixed(2), gy:+W.unitY(u2.x, u2.z).toFixed(2) };
      // 4) the ego Berserker's normal blow hurts a surfaced worm (more than before: ego damage x1.15, faster)
      const w4 = w; w4.tameTeam = undefined; w4.hp = w4.mhp; w4.heroBy = 0; G.units = G.units.filter(o => o.team !== 0);
      const u4 = mk(0, 0, near.x, near.z); W.applyCmd(G, 0, { t:'poss', id:u4.id }); keepUp(); u4.yaw = Math.atan2(w4.x - u4.x, w4.z - u4.z);
      G.teams[0].posIn = { id:u4.id, x:u4.x, z:u4.z, y:u4.yaw, a:0, s:0, j:0, g:0, h:0, pad:0, air:0, flying:false }; W.step(G); keepUp(); u4.cd = 0;
      const hp4 = w4.hp; G.teams[0].posIn = { ...G.teams[0].posIn, a:1 }; W.step(G); keepUp(); out.blow = Math.round(hp4 - w4.hp); out.blowCd = +u4.cd.toFixed(2);
      // 5) leaving the ego is refused while playing the hero
      G.teams[0].posIn = { ...G.teams[0].posIn, h:1 }; W.step(G); out.started5 = !!u4.hero; W.applyCmd(G, 0, { t:'unposs' }); out.unpossRefused = G.teams[0].pos === u4.id && u4.poss;
      for (let i = 0; i < 200 && G.units.includes(u4); i++) W.step(G);
      // 6) the AI's own Berserker/Opa goes for a surfaced worm nearby and plays the hero
      const rnd = Math.random; Math.random = () => 0.1; w4.ws = 4; w4.st = 0.2; w4.hp = w4.mhp; w4.tameTeam = undefined; w4.heroBy = 0; w4.cd = 99; w4.bw = 0;
      G.ai = W.aiNew('hard'); const fac1 = G.teams[1].fac, k1 = fac1 === 'viking' ? 0 : 2, q1 = W.nw(w4.x - 7, w4.z + 3); const a1 = mk(k1, 1, q1.x, q1.z); a1.tutStill = false; W.applyCmd(G, 1, { t:'poss', id:a1.id });
      let aiHero = false; for (let i = 0; i < 120 && !aiHero; i++) { W.aiThink(G, 1); W.step(G); if (!a1.hero) { w4.ws = 4; w4.st = 0.2; w4.cd = 99; w4.bw = 0; } aiHero = !!a1.hero; }
      Math.random = rnd; out.aiHero = aiHero; out.aiDist = +Math.hypot(a1.x - w4.x, a1.z - w4.z).toFixed(1);
      for (let i = 0; i < 200 && a1.hero; i++) W.step(G);
      // 7) an enemy worm UNIT (tamed by team 1): the hero works on it too; AI worm takes the full 390, an ego worm the same (armour ignored)
      G.bears = []; G.units = G.units.filter(o => o.team === 0 && o.hp > 0 && !o.hero); G.teams[0].pos = null; G.teams[1].pos = null;
      const wk = W.KINDS.findIndex((K, i) => K && K.worm && W.FAC[G.teams[1].fac].kinds.length >= 0 && K.fac === G.teams[1].fac);
      const wq = W.nw(near.x - 2.5, near.z - 1.5);
      const mkWorm = () => { const wu = mk(wk, 1, wq.x, wq.z); wu.ws = 0; wu.wst = 0; wu.wcd = 99; wu.tutStill = true; return wu; };
      const wu = mkWorm(), hu = mk(0, 0, near.x, near.z); W.applyCmd(G, 0, { t:'poss', id:hu.id });
      out.unitElig = W.heroWorm(G, hu) === wu;
      inp(hu, 0); W.step(G); inp(hu, 1); W.step(G); out.unitStarted = !!hu.hero && hu.hero.unit && wu.ws === 6 && wu.heroBy === hu.id;
      const s0 = W.snapOf(G); out.unitHe = s0.he && s0.he[0]; const S2 = W.HERO_S[out.unitHe ? out.unitHe[6] : 0]; out.unitExp = S2.hits.length * S2.hitDmg + S2.inner.length * S2.innerDmg;
      const whp0 = wu.hp; for (let i = 0; i < 160 && G.units.includes(hu); i++) { wu.x = wq.x; wu.z = wq.z; W.step(G); }
      out.unitDmg = Math.round(whp0 - wu.hp); out.unitAfter = { ws:wu.ws, heroBy:wu.heroBy, alive:wu.hp > 0, heroGone:!G.units.includes(hu) };
      // 8) a weak worm unit dies from the stabs: the hero gets away
      G.units = G.units.filter(o => o !== wu); const wu2 = mkWorm(); wu2.hp = 90; const hu2 = mk(0, 0, near.x, near.z); W.applyCmd(G, 0, { t:'poss', id:hu2.id });
      inp(hu2, 0); W.step(G); wu2.hp = 90; inp(hu2, 1); W.step(G); out.unit2Started = !!hu2.hero;
      for (let i = 0; i < 180 && hu2.hero; i++) W.step(G);
      for (let i = 0; i < 3; i++) W.step(G);
      out.unit2 = { wormDead:!G.units.includes(wu2), heroAlive:G.units.includes(hu2) && hu2.hp > 0, hero:!!hu2.hero, win:(G.hl || []).filter(h => h[1] === 'heroWin').length };
      return out; }""")
    print(json.dumps(r, indent=1)); print('errs', errs[:5])
    near = lambda a, b: abs(a - b) <= 12
    ok = (r['elig'] and not r['eligFar'] and r['eligArcher'] and not r['eligUnder'] and r['started'] and r['wormWs'] == 7 and r['bur'] == 1
          and r['knock'] is False and near(r['dmg'], r['expDmg']) and r['unitGone'] and r['wormAfter'][0] == 5 and r['kf'] and r['kf'][4] == 13 and r['hl'] and r['dz'] == [4]
          and r['snapHe'] and r['snapHe'][0][1] == 0 or False)
    ok = ok and r['unitElig'] and r['unitStarted'] and r['unitHe'][4] == 1 and near(r['unitDmg'], r['unitExp']) and r['unitAfter']['ws'] == 0 and not r['unitAfter']['heroBy'] and r['unitAfter']['heroGone']
    ok = ok and r['unit2Started'] and r['unit2']['wormDead'] and not r['unit2']['heroAlive']
    ok = ok and r['blow'] >= 25 and r['started5'] and r['unpossRefused'] and r['aiHero']
    # a beaten worm holds out (1 hp) until the hero is swallowed – he never gets away – then it turns to his team
    ok = ok and r['started2'] and r.get('held') == 1 and not r['escape']['alive'] and not r['escape']['hero'] and r['escape']['tame'] == 0 and r['escape']['hl'] == 1 and not errs
    print('HERO_SIM', 'OK' if ok else 'FAIL')
    b.close()
