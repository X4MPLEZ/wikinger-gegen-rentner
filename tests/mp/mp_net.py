# Online play between two pages over the local servers (start them first: node tests/mp/ps.js & node tests/mp/mq.js; tests/run.sh mp does it).
# Checks: the guest gives up -> the host gets his win screen; the host gives up -> the guest wins; the P2P line drops (closed, or silent)
# -> the guest dials again and his commands still arrive; the guest's page reloads and he joins again -> his commands count again.
import sys, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent.parent
THREE=(ROOT/'node_modules/three/build/three.min.js').read_text()
PEER=(ROOT/'node_modules/peerjs/dist/peerjs.min.js').read_text()
MQ=(ROOT/'node_modules/mqtt/dist/mqtt.min.js').read_text()
html=(ROOT/'index.html').read_text()
def mkroute(peer_ok, mq_ok=True):
    def route(r):
        u=r.request.url
        if 'three' in u: return r.fulfill(body=THREE, content_type='application/javascript')
        if 'mqtt' in u and ('unpkg' in u or 'jsdelivr' in u): return r.fulfill(body=MQ, content_type='application/javascript') if mq_ok else r.abort()
        if 'peerjs' in u and ('unpkg' in u or 'jsdelivr' in u): return r.fulfill(body=PEER, content_type='application/javascript') if peer_ok else r.abort()
        if u.startswith('http://127.0.0.1:9000/myapp'): return r.continue_() if peer_ok else r.abort()
        if u.startswith('http://127.0.0.1:9000'): return r.fulfill(body=html, content_type='text/html')
        return r.abort()
    return route
# keep every PeerJS peer the page creates in window.__peers (to cut the line in the drop test)
TRAP="""(()=>{let P;Object.defineProperty(window,'Peer',{configurable:true,get(){return P},set(v){P=function(...a){const p=new v(...a);(window.__peers||(window.__peers=[])).push(p);return p};P.prototype=v.prototype;}});})();"""
res={}
def connect(ctx, mq_ok=False):
    pgs=[]
    for i in range(2):
        pg=ctx.new_page(); pg.route('**/*', mkroute(True, mq_ok))
        pg.on('pageerror', lambda e, i=i: errs.append(('h' if i==0 else 'g')+': '+str(e)))
        pg.add_init_script(TRAP+"window.WVR_LANG='de';window.WVR_MQTT=['ws://127.0.0.1:9001'];window.WVR_PEER={host:'127.0.0.1',port:9000,path:'/myapp',secure:false,debug:0};")
        pg.goto('http://127.0.0.1:9000/'); pgs.append(pg)
    h,g=pgs; h.wait_for_timeout(2500)
    h.click('#btnHost'); h.wait_for_timeout(3500); code=h.input_value('#codeIn')
    g.fill('#codeIn',code); g.click('#btnJoin')
    for i in range(40):
        g.wait_for_timeout(1000)
        if h.evaluate('__wvr.V.mode')=='host' and g.evaluate('__wvr.V.mode')=='guest': return h,g,True
    return h,g,False
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-features=WebRtcHideLocalIpsWithMdns','--allow-loopback-in-peer-connection'])
    ctx=b.new_context(viewport={'width':390,'height':700})
    # 1) the guest gives up
    h,g,ok=connect(ctx)
    res['conn1']=ok
    if ok:
        g.wait_for_timeout(4500); h.evaluate("__wvr.G.cd=0")
        g.click('#menuBtn'); g.wait_for_timeout(300)
        res['pauseTitle']=g.inner_text('#pauseTitle')
        g.click('#btnQuit'); g.wait_for_timeout(300); res['armed']=g.inner_text('#btnQuit')
        # the second tap must come within the 3 s arming window: on a loaded test machine Playwright's own click can be slower than that
        g.evaluate("document.querySelector('#btnQuit').click()")
        for k in range(20):
            h.wait_for_timeout(400)
            if h.is_visible('#end'): break
        res['hostEnd']=h.is_visible('#end'); res['hostTitle']=h.inner_text('#endTitle') if res['hostEnd'] else ''
        res['hostSub']=h.inner_text('#endSub') if res['hostEnd'] else ''; res['hostRematch']=h.is_visible('#btnRematch')
        res['guestMenu']=g.evaluate('__wvr.V.mode')
    for pg in (h,g): pg.close()
    # 2) the host gives up
    h,g,ok=connect(ctx)
    res['conn2']=ok
    if ok:
        g.wait_for_timeout(4000); h.evaluate("__wvr.G.cd=0")
        h.click('#menuBtn'); h.wait_for_timeout(200); h.click('#btnQuit'); h.wait_for_timeout(200); h.evaluate("document.querySelector('#btnQuit').click()")
        for k in range(20):
            g.wait_for_timeout(400)
            if g.is_visible('#end'): break
        res['guestEnd']=g.is_visible('#end'); res['guestTitle']=g.inner_text('#endTitle') if res['guestEnd'] else ''
        res['guestSub']=g.inner_text('#endSub') if res['guestEnd'] else ''
    for pg in (h,g): pg.close()
    # 3) the P2P line drops in the middle of the match: the guest dials again and his orders still arrive
    h,g,ok=connect(ctx)
    res['conn3']=ok
    if ok:
        g.wait_for_timeout(4000); h.evaluate("__wvr.G.cd=0; __wvr.G.teams[1].gold=999")
        res['via']=h.evaluate('__wvr.NET.via')
        n0=h.evaluate("__wvr.G.teams[1].q.length+__wvr.G.units.filter(u=>u.team===1).length")
        res['closed']=g.evaluate("(()=>{let n=0;for(const p of window.__peers||[])for(const k in p.connections)for(const c of p.connections[k]){c.close();n++;}return n;})()")
        g.wait_for_timeout(1000); res['guestWarn']=g.is_visible('#netwarn')
        back=False
        for k in range(30):
            g.wait_for_timeout(500)
            if not g.is_visible('#netwarn') and not h.evaluate('__wvr.NET.gone'): back=True; break
        res['backAfter_s']=(k+1)*0.5 if back else None
        g.wait_for_timeout(800)
        for k in range(2): g.click('.spawn[data-slot="0"] .main', force=True); g.wait_for_timeout(300)
        g.wait_for_timeout(2500)
        n1=h.evaluate("__wvr.G.teams[1].q.length+__wvr.G.units.filter(u=>u.team===1).length")
        res['trainedAfterDrop']=n1-n0
        res['hostGone']=h.evaluate('__wvr.NET.gone')
    for pg in (h,g): pg.close()
    # 4) the guest's page reloads mid-match; he joins again with the code: his commands count again (new session id)
    h,g,ok=connect(ctx)
    res['conn4']=ok
    if ok:
        g.wait_for_timeout(4000); h.evaluate("__wvr.G.cd=0; __wvr.G.teams[1].gold=999")
        for k in range(3): g.click('.spawn[data-slot="0"] .main', force=True); g.wait_for_timeout(300)
        g.wait_for_timeout(1500)
        res['seqBefore']=h.evaluate('__wvr.NET.lastSeq')
        code=h.evaluate('__wvr.NET.code')
        g.reload(); g.wait_for_timeout(2500)
        for k in range(20):
            h.wait_for_timeout(500)
            if h.evaluate('__wvr.NET.gone'): break
        res['hostSawGone']=h.evaluate('__wvr.NET.gone')
        g.fill('#codeIn',code); g.click('#btnJoin')
        for k in range(40):
            g.wait_for_timeout(1000)
            if g.evaluate('__wvr.V.mode')=='guest' and not h.evaluate('__wvr.NET.gone'): break
        res['rejoined']=g.evaluate('__wvr.V.mode')=='guest'
        g.wait_for_timeout(2500)
        n0=h.evaluate("__wvr.G.teams[1].q.length+__wvr.G.units.filter(u=>u.team===1).length")
        for k in range(2): g.click('.spawn[data-slot="0"] .main', force=True); g.wait_for_timeout(300)
        g.wait_for_timeout(2500)
        res['trainedAfterRejoin']=h.evaluate("__wvr.G.teams[1].q.length+__wvr.G.units.filter(u=>u.team===1).length")-n0
    for pg in (h,g): pg.close()
    # 5) the line goes silent without a close event: the keepalive watchdog drops it and the guest dials again
    h,g,ok=connect(ctx)
    res['conn5']=ok
    if ok:
        g.wait_for_timeout(4000); h.evaluate("__wvr.G.cd=0; __wvr.G.teams[1].gold=999")
        res['muted']=g.evaluate("(()=>{let n=0;for(const p of window.__peers||[])for(const k in p.connections)for(const c of p.connections[k]){if(c.dataChannel){c.dataChannel.onmessage=null;} c.send=()=>{}; n++;}return n;})()")
        t0=0; back=False; seenWarn=False
        for k in range(50):
            g.wait_for_timeout(500)
            if g.is_visible('#netwarn') or h.evaluate('__wvr.NET.gone'): seenWarn=True
            if seenWarn and not g.is_visible('#netwarn') and not h.evaluate('__wvr.NET.gone'): back=True; break
        res['silentDetected']=seenWarn; res['silentBack_s']=(k+1)*0.5 if back else None
        g.wait_for_timeout(1000)
        n0=h.evaluate("__wvr.G.teams[1].q.length+__wvr.G.units.filter(u=>u.team===1).length")
        for k in range(2): g.click('.spawn[data-slot="0"] .main', force=True); g.wait_for_timeout(300)
        g.wait_for_timeout(2500)
        res['trainedAfterSilent']=h.evaluate("__wvr.G.teams[1].q.length+__wvr.G.units.filter(u=>u.team===1).length")-n0
    for pg in (h,g): pg.close()
    b.close()
print(res)
print('ERRS', errs[:6])
ok = res.get('hostEnd') and 'Sieg' in res.get('hostTitle','') and 'aufgegeben' in res.get('hostSub','') and not res.get('hostRematch') \
  and res.get('guestEnd') and 'Sieg' in res.get('guestTitle','') and res.get('armed')=='Wirklich aufgeben?' and res.get('trainedAfterDrop',0)>=1 and res.get('trainedAfterRejoin',0)>=1 and res.get('trainedAfterSilent',0)>=1 and not errs
print('MP_NET', 'OK' if ok else 'FAIL')
