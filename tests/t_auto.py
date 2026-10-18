# AUTO recruiting: one waiting unit per AUTO type, several types take turns, manual orders go first, switching AUTO off refunds.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader']); ctx=b.new_context(); ctx.route('**/*', route); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r=pg.evaluate("""()=>{const W=__wvr,out={}; 
      const run=(setup,ticks)=>{ const G=W.newGame(['viking','rentner'],16,false,{squad:false}); G.cd=0; G.ai=W.aiNew('easy'); const T=G.teams[0]; T.gold=5000; setup(G,T); const log=[]; let maxAutoPerType=0, last='';
        for(let i=0;i<ticks;i++){ W.step(G); T.gold=Math.max(T.gold,5000); const qm=Math.min(T.qm||0,T.q.length), tail=T.q.slice(qm); const cnt={}; tail.forEach(k=>cnt[k]=(cnt[k]||0)+1); maxAutoPerType=Math.max(maxAutoPerType,...Object.values(cnt),0); const sig=T.q.join(','); if(sig!==last){ log.push(sig); last=sig; } }
        return { maxAutoPerType, log:log.slice(0,14), spawned:G.units.filter(u=>u.team===0).map(u=>u.k).join('') }; };
      out.single=run((G,T)=>{ W.applyCmd(G,0,{t:'auto',k:0,on:true}); },20*12);
      out.double=run((G,T)=>{ W.applyCmd(G,0,{t:'auto',k:0,on:true}); W.applyCmd(G,0,{t:'auto',k:1,on:true}); },20*14);
      out.manual=run((G,T)=>{ W.applyCmd(G,0,{t:'auto',k:0,on:true}); W.applyCmd(G,0,{t:'auto',k:1,on:true}); W.step(G); W.step(G); W.applyCmd(G,0,{t:'spawn',k:4}); W.applyCmd(G,0,{t:'spawn',k:4}); },20*10);
      // switching AUTO off refunds the waiting auto unit
      { const G=W.newGame(['viking','rentner'],16,false,{squad:false}); G.cd=0; const T=G.teams[0]; T.gold=1000; W.applyCmd(G,0,{t:'auto',k:0,on:true}); W.applyCmd(G,0,{t:'auto',k:1,on:true}); for(let i=0;i<3;i++) W.step(G); const g1=T.gold, q1=T.q.join(','); W.applyCmd(G,0,{t:'auto',k:1,on:false}); out.refund={q1,gold1:Math.round(g1),q2:T.q.join(','),gold2:Math.round(T.gold)}; }
      return out; }""")
    print(json.dumps(r, indent=1)); print('ERRS',errs[:3]); b.close()
ok = (r['single']['maxAutoPerType'] == 1 and set(r['single']['spawned']) == {'0'} and len(r['single']['spawned']) >= 6
      and r['double']['maxAutoPerType'] == 1 and '01' in r['double']['spawned'] and r['manual']['spawned'].startswith('44')
      and r['refund']['q2'] == '0' and r['refund']['gold2'] > r['refund']['gold1'] and not errs)
print('AUTO', 'OK' if ok else 'FAIL')
