# Chaos physics: a body knocked flying bowls others over (STRIKE), the viking boulder rolls on and knocks, the pensioner cake leaves a slowing puddle.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader']); ctx=b.new_context(); ctx.route('**/*', route); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r=pg.evaluate("""()=>{ const W=__wvr,out={};
      const mk=(G,k,t,x,z)=>{ const q=W.nw(x,z); const u={id:G.nextId++,k,team:t,x:q.x,z:q.z,y:0,hp:W.KINDS[k].hp,cd:9,tgt:-1,at:0,atk:0,sp:0,run:0,re:9,ord:{x:q.x,z:q.z,mv:false},path:null,losT:0,los:true,repath:0,poss:false,rage:0,spcd:0,yaw:0,tutStill:true}; G.units.push(u); return u; };
      // 1) bowling: knock one unit flying into a cluster
      { const G=W.newGame(['viking','rentner'],1,false,{squad:false}); G.cd=0; W.G=G; const f=W.FLAGS[0]; const v=mk(G,0,0,f.x,f.z-6); const row=[0,1,2,3].map(i=>mk(G,2,1,f.x+(i-1.5)*0.9,f.z-2+i*0.6));
        W.step(G); W.knockFly(v,0,0,9,0,1,3.5); v.kbTeam=0; let down=0, hl=null; for(let i=0;i<60;i++){ W.step(G); } for(const u of row){ if(u.kbN) down++; } hl=G.hl.filter(h=>h[1]==='strike').length;
        out.bowl={down, chain:Math.max(...row.map(u=>u.bowl||0)), strikeHl:hl, hpLoss:row.map(u=>Math.round(W.KINDS[2].hp-u.hp))}; }
      // 2) boulder: viking catapult shell into a crowd on the meadow -> rolls on and knocks
      { const G=W.newGame(['viking','rentner'],1,false,{squad:false}); G.cd=0; W.G=G; const f=W.FLAGS[0]; const tgt={x:f.x,z:f.z}; const row=[0,1,2,3,4].map(i=>mk(G,2,1,f.x,f.z+2+i*1.3));
        G.proj.push({t:0.1,dmg:5,tgt:-1,team:0,k:6,aoe:4.2,tx:tgt.x,tz:tgt.z,sx:f.x,sz:f.z-20}); let maxRolls=0, snapRo=0, hits=0, far=0; for(let i=0;i<80;i++){ W.step(G); if(G.rolls.length){ hits=G.rolls[0].hits; far=+Math.hypot(G.rolls[0].x-tgt.x,G.rolls[0].z-tgt.z).toFixed(1); } maxRolls=Math.max(maxRolls,G.rolls.length); const s=W.snapOf(G); snapRo=Math.max(snapRo,s.ro.length); }
        out.boulder={hits, far, maxRolls, snapRo, knocked:row.filter(u=>u.kbN).length, dist:G.rolls.length?+Math.hypot(G.rolls[0].x-tgt.x,G.rolls[0].z-tgt.z).toFixed(1):'gone', hl:G.hl.filter(h=>h[1]==='boulder').length}; }
      // 3) cake: pensioner catapult -> cream puddle slows
      { const G=W.newGame(['viking','rentner'],1,false,{squad:false}); G.cd=0; W.G=G; const f=W.FLAGS[0]; const u=mk(G,0,0,f.x,f.z+1); u.tutStill=false; u.ord={x:f.x,z:f.z+15,mv:true}; u.cd=0;
        G.proj.push({t:0.1,dmg:5,tgt:-1,team:1,k:7,aoe:4.2,tx:f.x,tz:f.z,sx:f.x,sz:f.z+20}); let slow=0; for(let i=0;i<40;i++){ W.step(G); if(u.slowT>0) slow++; } const s=W.snapOf(G);
        out.cake={goo:G.goo.length, slowTicks:slow, snapGo:s.go.length, gooT:G.goo.length?+G.goo[0].t.toFixed(1):0}; }
      return out; }""")
    print(json.dumps(r)); print('ERRS',errs[:3]); b.close()
bw, bo, ca = r['bowl'], r['boulder'], r['cake']
ok = (bw['down'] >= 3 and bw['strikeHl'] >= 1 and bo['hits'] >= 2 and bo['maxRolls'] == 1 and bo['snapRo'] == 1 and bo['knocked'] >= 3
      and ca['goo'] == 1 and ca['slowTicks'] >= 8 and ca['snapGo'] == 1 and not errs)
print('CHAOS', 'OK' if ok else 'FAIL')
