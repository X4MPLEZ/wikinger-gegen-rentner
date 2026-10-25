# Ego climbing: the host must follow its ego up any slope the ego's own screen let it climb (10 cm climb checks on both sides),
# a real cliff wall stays blocked, and the client drifts back when fresh snapshots show the host could not follow.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader']); ctx = b.new_context(viewport={'width':900,'height':600}); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    pg.click('#btnTutPro'); pg.wait_for_timeout(2500)
    pg.evaluate('__wvr.tutGo(14)'); pg.wait_for_function('!!__wvr.V.poss', timeout=15000); pg.wait_for_timeout(800)
    r = pg.evaluate("""() => { const W = __wvr, G = W.G, out = {}, f = v => +v.toFixed(2);
      // 1) the steep ramp from the pro tutorial: 1.6 m up over 1.15 m
      const a = { x:21.88, z:39.71 }, c = { x:21.66, z:40.84 };
      const u0 = { x:a.x, z:a.z, y:W.unitY(a.x, a.z) }; W.advanceGround(u0, c.x, c.z, 0, 0, 0.05, false, false); out.coarse = [f(u0.x), f(u0.z)];
      const u1 = { x:a.x, z:a.z, y:W.unitY(a.x, a.z) }; W.advanceGround(u1, c.x, c.z, 0, 0, 0.05, false, true); out.fine = [f(u1.x), f(u1.z), f(u1.y)];
      // 2) a real wall: the biggest 10 cm height jump on walkable ground nearby must stay blocked
      let wall = null, best = 0;
      for (let x = -40; x <= 40; x += 0.5) for (let z = -60; z <= 60; z += 0.5) { if (!W.walkable(x, z)) continue; for (const [dx, dz] of [[0.1, 0], [0, 0.1], [-0.1, 0], [0, -0.1]]) { const j = W.unitY(x + dx, z + dz) - W.unitY(x, z); if (j > best) { best = j; wall = { x, z, dx, dz }; } } }
      out.wallJump = f(best);
      if (wall && best > 0.5) { const u2 = { x:wall.x, z:wall.z, y:W.unitY(wall.x, wall.z) }; W.advanceGround(u2, wall.x + wall.dx * 4, wall.z + wall.dz * 4, 0, 0, 0.05, false, true); out.wallMoved = f(Math.hypot(u2.x - wall.x, u2.z - wall.z)); out.wallRise = f(W.unitY(u2.x, u2.z) - W.unitY(wall.x, wall.z)); }
      // 3) the host follows its ego up the ramp through posIn
      const P = W.V.poss, u = G.units.find(o => o.id === P.id); u.x = a.x; u.z = a.z; u.y = u.fy = W.unitY(a.x, a.z); u.cd = 9;
      W.stopSim(); const In = { id:u.id, x:c.x, z:c.z, y:0, a:u.la, s:u.ls, j:u.lj || 0, g:u.lg || 0, pad:u.padAck || 0, air:u.airAck || 0, flying:false };
      for (let i = 0; i < 3; i++) { G.teams[0].posIn = In; W.step(G); }
      out.host = [f(u.x), f(u.z), f(u.y)]; out.hostGap = f(Math.hypot(u.x - c.x, u.z - c.z));
      return out; }""")
    print(json.dumps(r))
    # 4) client side: normal walking is never pulled back; a host that refuses to follow pulls the ego back to where it has it
    pg.evaluate("(()=>{const W=__wvr,P=W.V.poss,u=W.G.units.find(o=>o.id===P.id); const q=W.nw(W.BASES[0].x*0.5, W.BASES[0].z*0.5); u.air=null; u.fall=0; u.falling=false; u.down=0; P.air=null; P.vy=0; u.x=P.x=q.x; u.z=P.z=q.z; u.y=u.fy=P.fy=W.unitY(q.x,q.z); P.camYaw=Math.atan2(-q.x,-q.z);})()")  # (it may have just stepped off the ramp top: start from the ground)
    pg.evaluate('__wvr.startSim(false)'); pg.wait_for_timeout(300)  # only now: snapshots and inputs still in flight would carry the old spot
    pg.wait_for_timeout(500); s0 = pg.evaluate("(()=>{const P=__wvr.V.poss; return [P.x,P.z];})()")
    pg.keyboard.down('w'); pg.wait_for_timeout(1800); pg.keyboard.up('w'); pg.wait_for_timeout(600)
    s1 = pg.evaluate("(()=>{const W=__wvr,P=W.V.poss,u=W.G.units.find(o=>o.id===P.id); return [P.x,P.z,u.x,u.z];})()")
    walked = ((s1[0]-s0[0])**2 + (s1[1]-s0[1])**2) ** 0.5; gap = ((s1[0]-s1[2])**2 + (s1[1]-s1[3])**2) ** 0.5
    pg.evaluate("(()=>{const W=__wvr,P=W.V.poss,u=W.G.units.find(o=>o.id===P.id),T=W.G.teams[0],fx=u.x,fz=u.z; T._pi=T.posIn; delete T.posIn; Object.defineProperty(T,'posIn',{configurable:true,get(){return this._pi&&{...this._pi,x:fx,z:fz};},set(v){this._pi=v;}});})()")  # the host now ignores our position
    pg.keyboard.down('w'); pg.wait_for_timeout(600); pg.keyboard.up('w')
    s2 = pg.evaluate("(()=>{const W=__wvr,P=W.V.poss,u=W.G.units.find(o=>o.id===P.id); return [P.x,P.z,u.x,u.z];})()"); pg.wait_for_timeout(2200)
    s3 = pg.evaluate("(()=>{const W=__wvr,P=W.V.poss,u=W.G.units.find(o=>o.id===P.id); const g=Math.hypot(P.x-u.x,P.z-u.z); const T=W.G.teams[0],v=T._pi; delete T.posIn; T.posIn=v; return [P.x,P.z,u.x,u.z,g];})()")
    away = ((s2[0]-s2[2])**2 + (s2[1]-s2[3])**2) ** 0.5
    print('walk', round(walked,2), 'gap', round(gap,2), 'away', round(away,2), 'back', round(s3[4],2))
    r['drift_ok'] = walked > 5 and gap < 0.3 and away > 1.2 and s3[4] < 1.0
    ok = r['coarse'] == [21.88, 39.71] and abs(r['fine'][0] - 21.66) < 0.02 and abs(r['fine'][1] - 40.84) < 0.02 and r['hostGap'] < 0.05
    if 'wallMoved' in r: ok = ok and r['wallRise'] <= 0.5
    ok = ok and r['drift_ok']
    print('errs', errs[:3]); print('CLIMB', 'OK' if ok and not errs else 'FAIL')
    b.close()
