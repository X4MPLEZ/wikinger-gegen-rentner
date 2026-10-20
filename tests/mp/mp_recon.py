# Ego movement online: the guest predicts its own warrior, the host acknowledges every input packet (snapshot ia), and the guest only
# gets corrected where the host really put it somewhere else. Checks over local PeerJS (start it first; tests/run.sh mp does):
#  1. walking a straight, clear line: no correction at all, the host follows within a metre
#  2. the guest's packets stall for 1.2 s mid-walk (lag burst): still no pull-back, the host catches up afterwards
#  3. the host knocks the warrior down and away: the guest follows the host's position (the knock-down path)
#  4. a client that walks at 46 m/s is held to the host's speed limit and pulled back to the host's position
import sys, os, math, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent.parent
THREE=(ROOT/'node_modules/three/build/three.min.js').read_text(); PEER=(ROOT/'node_modules/peerjs/dist/peerjs.min.js').read_text()
html=(ROOT/'index.html').read_text()
def route(r):
    u=r.request.url
    if 'three' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'mqtt' in u and ('unpkg' in u or 'jsdelivr' in u): return r.abort()
    if 'peerjs' in u and ('unpkg' in u or 'jsdelivr' in u): return r.fulfill(body=PEER, content_type='application/javascript')
    if u.startswith('http://127.0.0.1:9000/myapp'): return r.continue_()
    if u.startswith('http://127.0.0.1:9000'): return r.fulfill(body=html, content_type='text/html')
    return r.abort()
# the longest clear straight line from where the warrior stands (no water, no edge, no jump pad): the walk never leaves the ground
PICK = """()=>{ const W=__wvr,P=W.V.poss; let best=null; for (let a=0;a<Math.PI*2;a+=Math.PI/36){ const fx=Math.sin(a),fz=Math.cos(a); let d=0;
  for(;d<40;d+=0.5){ const x=P.x+fx*d,z=P.z+fz*d; if(!W.walkable(x,z)||W.inWater(x,z)||W.fallZone(x,z)) break; if((W.MAP.pads||[]).some(p=>Math.hypot(p.x-x,p.z-z)<4)) break; }
  if(!best||d>best.d) best={a,d}; } P.camYaw=best.a; P.yaw=best.a; P.pullN=0; P.pullD=0; return best; }"""
GP = "(()=>{const P=__wvr.V.poss; return P?{x:+P.x.toFixed(2),z:+P.z.toFixed(2),pullN:P.pullN||0,pullD:+(P.pullD||0).toFixed(2),rtt:__wvr.NET.rtt|0}:null;})()"
HP = "(()=>{const u=__wvr.G.units.find(u=>u.poss&&u.team===1); return u?{x:+u.x.toFixed(2),z:+u.z.toFixed(2)}:null;})()"
def dist(a, b): return round(math.hypot(a['x']-b['x'], a['z']-b['z']), 2)
R = {}; errs = []
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-features=WebRtcHideLocalIpsWithMdns','--allow-loopback-in-peer-connection'])
    ctx=b.new_context(viewport={'width':390,'height':700}); pgs=[]
    for i in range(2):
        pg=ctx.new_page(); pg.route('**/*', route); pg.on('pageerror', lambda e, i=i: errs.append(('h' if i==0 else 'g')+': '+str(e)))
        pg.add_init_script("window.WVR_MQTT=['ws://127.0.0.1:9001'];window.WVR_PEER={host:'127.0.0.1',port:9000,path:'/myapp',secure:false,debug:0};")
        pg.goto('http://127.0.0.1:9000/'); pgs.append(pg)
    h,g=pgs; h.wait_for_timeout(2500); h.click('#btnHost'); h.wait_for_timeout(3500); code=h.input_value('#codeIn')
    g.fill('#codeIn',code); g.click('#btnJoin')
    for i in range(40):
        g.wait_for_timeout(1000)
        if h.evaluate('__wvr.V.mode')=='host' and g.evaluate('__wvr.V.mode')=='guest': break
    R['connected'] = g.evaluate('__wvr.V.mode')=='guest'
    g.wait_for_timeout(4000)
    for k in range(2): g.click('.spawn[data-slot="0"] .main', force=True); g.wait_for_timeout(300)
    g.wait_for_timeout(5000)
    for pg in (h, g): pg.evaluate("__wvr.setGfx('vlow'); __wvr.renderer.setPixelRatio(0.1)")  # software GL must not starve the sim and the line
    g.evaluate("""()=>{ const W=__wvr,V=W.V; V.selected.clear(); const u=[...V.units.values()].find(u=>u.team===V.myTeam); V.selected.add(u.id); W.enterEgo(); }""")
    g.wait_for_timeout(6000)
    R['map'] = g.evaluate('__wvr.MAP.type')
    # 1) clear walk
    best = g.evaluate(PICK); p0 = g.evaluate(GP)
    g.keyboard.down('w'); g.wait_for_timeout(2500); g.keyboard.up('w'); g.wait_for_timeout(1500)
    p1 = g.evaluate(GP); h1 = h.evaluate(HP)
    R['walk'] = {'dir': round(best['d'], 1), 'moved': dist(p0, p1), 'pulls': p1['pullN'], 'pullD': p1['pullD'], 'hostGap': dist(p1, h1), 'rtt': p1['rtt']}
    # 2) stall: the guest's packets do not leave for 1.2 s while it keeps walking
    g.evaluate("""()=>{ const W=__wvr, r=W.NET.r, orig=r.presence.bind(r); r.presence=p=>('in' in p && window.__stall) ? Promise.resolve() : orig(p); }""")
    g.evaluate(PICK); p0 = g.evaluate(GP)
    g.keyboard.down('w'); g.wait_for_timeout(600)
    g.evaluate("window.__stall=true"); g.wait_for_timeout(1200); g.evaluate("window.__stall=false")
    g.wait_for_timeout(900); g.keyboard.up('w'); g.wait_for_timeout(1500)
    p1 = g.evaluate(GP); h1 = h.evaluate(HP)
    R['stall'] = {'moved': dist(p0, p1), 'pulls': p1['pullN'], 'pullD': p1['pullD'], 'hostGap': dist(p1, h1)}
    # 3) the host knocks the warrior down and flings it (a hazard): the guest follows the host's position
    best = g.evaluate(PICK); p0 = g.evaluate(GP)
    h.evaluate("""()=>{ const W=__wvr, u=W.G.units.find(u=>u.poss&&u.team===1); u.kbImm=0; W.knockFly(u, u.x - Math.sin(u.yaw), u.z - Math.cos(u.yaw), 6, undefined, undefined, undefined, 'hazard'); }""")
    seenDown = False
    for k in range(12):
        g.wait_for_timeout(250)
        if g.evaluate('!!(__wvr.V.poss && __wvr.V.poss.down)'): seenDown = True
    g.wait_for_timeout(1500)
    p1 = g.evaluate(GP); h1 = h.evaluate(HP)
    R['knock'] = {'moved': dist(p0, p1), 'seenDown': seenDown, 'hostGap': dist(p1, h1)}
    # 4) a cheating client walks at 46 m/s: the host holds it to its speed limit and the guest is pulled back to the host
    best = g.evaluate(PICK); p0 = g.evaluate(GP)
    g.evaluate("__wvr.KINDS[__wvr.V.poss.k].speed = 40")
    g.keyboard.down('w'); g.wait_for_timeout(2000); g.keyboard.up('w'); g.wait_for_timeout(2000)
    p1 = g.evaluate(GP); h1 = h.evaluate(HP)
    R['cheat'] = {'guestFromStart': dist(p0, p1), 'hostFromStart': dist(p0, h1), 'pullD': p1['pullD'], 'hostGap': dist(p1, h1)}
    b.close()
print(json.dumps(R)); print('ERRS', errs[:5])
w, s, kn, c = R['walk'], R['stall'], R['knock'], R['cheat']
ok = (R['connected'] and w['moved'] > 4 and w['pulls'] == 0 and w['hostGap'] < 1.0
      and s['moved'] > 4 and s['pullD'] < 0.5 and s['hostGap'] < 1.0
      and kn['seenDown'] and kn['moved'] > 1.5 and kn['hostGap'] < 1.0
      and c['hostGap'] < 2.0 and c['pullD'] > 3 and not errs)
print('MP_RECON', 'OK' if ok else 'FAIL')
