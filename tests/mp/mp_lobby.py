# Public games over the local servers (start them first: node tests/mp/ps.js & node tests/mp/mq.js; tests/run.sh mp does it).
# Checks: "Schnelles Spiel" with an empty list opens a public game that a second page sees under "Offene Spiele" and joins from there
# (no photos between strangers, the entry disappears once the match runs); a second "Schnelles Spiel" joins an open game instead of
# opening its own; a host practising against the computer is interrupted by a joining player after the countdown, or declines with
# "Weiter üben" (the joining player is told, the entry is gone). Also: the profile travels to another device with the transfer code.
import sys, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent.parent
THREE=(ROOT/'node_modules/three/build/three.min.js').read_text()
PEER=(ROOT/'node_modules/peerjs/dist/peerjs.min.js').read_text()
MQ=(ROOT/'node_modules/mqtt/dist/mqtt.min.js').read_text()
html=(ROOT/'index.html').read_text()
def route(r):
    u=r.request.url
    if 'three' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'mqtt' in u and ('unpkg' in u or 'jsdelivr' in u): return r.fulfill(body=MQ, content_type='application/javascript')
    if 'peerjs' in u and ('unpkg' in u or 'jsdelivr' in u): return r.fulfill(body=PEER, content_type='application/javascript')
    if u.startswith('http://127.0.0.1:9000/myapp'): return r.continue_()
    if u.startswith('http://127.0.0.1:9000'): return r.fulfill(body=html, content_type='text/html')
    return r.abort()
errs=[]; res={}
def page(ctx, tag):
    pg=ctx.new_page(); pg.route('**/*', route)
    pg.on('pageerror', lambda e: errs.append(tag+': '+str(e)))
    pg.add_init_script("window.WVR_LANG='de';window.WVR_MQTT=['ws://127.0.0.1:9001'];window.WVR_PEER={host:'127.0.0.1',port:9000,path:'/myapp',secure:false,debug:0};")
    pg.goto('http://127.0.0.1:9000/'); pg.wait_for_timeout(2500)
    pg.evaluate("document.querySelector('.online').scrollIntoView()")  # the list is watched while it is on screen
    pg.wait_for_timeout(300)
    return pg
def wait(pg, js, n=30, dt=500):
    for i in range(n):
        if pg.evaluate(js): return True
        pg.wait_for_timeout(dt)
    return False
def rows(pg): return pg.evaluate("[...document.querySelectorAll('#lobbyList .lrow')].map(r=>r.innerText.replace(/\\s+/g,' '))")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-features=WebRtcHideLocalIpsWithMdns','--allow-loopback-in-peer-connection'])
    ctx=b.new_context(viewport={'width':390,'height':760})
    # 1) quick match with an empty list -> a public game, listed on the other page, joined from the list
    h=page(ctx,'h'); g=page(ctx,'g')
    h.evaluate("__wvr.FACE.mine={id:'f1',net:'data:image/jpeg;base64,'+'A'.repeat(900),crop:null}")
    # the host's profile: level 10 with the Trainingsanzug skin for the Rentner and a picture of his own
    h.evaluate("()=>{const W=__wvr,P=W.PLAYER; P.xp=2600; P.lvC=13; W.PLAYER=P; W.profEquip('r1'); W.profEquip('oma');}")
    h.click('#btnQuick')
    res['hostPub']=wait(h, "__wvr.NET.role==='host' && __wvr.NET.pub===true && !document.querySelector('#btnPractice').hidden")
    res['listed']=wait(g, "document.querySelectorAll('#lobbyList .lrow').length>0", 40)
    res['rows']=rows(g)
    g.click('#lobbyList .lrow button')
    res['match1']=wait(g, "__wvr.V.mode==='guest' && __wvr.V.playing", 60) and h.evaluate("__wvr.V.mode")=='host'
    res['vsCard']=wait(g, "__wvr.V.vsN>0", 10, 200) and wait(h, "__wvr.V.vsN>0", 10, 200)
    res['guestSeesSkin']=g.evaluate("__wvr.UNIT_SKIN[2] && __wvr.UNIT_SKIN[2].id")
    res['guestSeesName']=g.evaluate("__wvr.V.oppPf && [__wvr.V.oppPf.lv, __wvr.V.oppPf.av]")
    g.wait_for_timeout(3000)
    res['noFace']=g.evaluate("__wvr.FACE.other===null || !__wvr.FACE.other.url") and g.evaluate("__wvr.NET.pub===true")
    c=page(ctx,'c'); c.wait_for_timeout(3500)
    res['clearedAfterStart']=rows(c)
    for pg in (h,g): pg.close()
    # 2) a second quick match joins the open game instead of opening its own
    h=page(ctx,'h2'); h.click('#btnQuick')
    wait(h, "!document.querySelector('#btnPractice').hidden")
    wait(c, "document.querySelectorAll('#lobbyList .lrow').length>0", 40)
    c.click('#btnQuick')
    res['quickJoin']=wait(c, "__wvr.V.mode==='guest' && __wvr.V.playing", 60) and h.evaluate("__wvr.V.mode")=='host'
    for pg in (h,c): pg.close()
    # 3) practising while waiting: the joining player interrupts after the countdown
    h=page(ctx,'h3'); g=page(ctx,'g3')
    h.click('#btnQuick'); wait(h, "!document.querySelector('#btnPractice').hidden")
    h.click('#btnPractice'); h.wait_for_timeout(1500)
    res['practising']=h.evaluate("__wvr.V.mode==='ai' && __wvr.V.playing && __wvr.NET.practice===true")
    wait(g, "document.querySelectorAll('#lobbyList .lrow').length>0", 40)
    g.click('#lobbyList .lrow button')
    res['banner']=wait(h, "!document.querySelector('#foundBan').hidden", 40)
    res['guestToldPractice']=wait(g, "/Übungsspiel/.test(document.querySelector('#lobbyStatus').textContent)", 20)
    res['match3']=wait(h, "__wvr.V.mode==='host' && __wvr.V.playing", 30) and wait(g, "__wvr.V.mode==='guest' && __wvr.V.playing", 30)
    res['bannerGone']=h.evaluate("document.querySelector('#foundBan').hidden")
    for pg in (h,g): pg.close()
    # 4) "Weiter üben": the joining player is told, the host keeps practising, the entry is gone
    h=page(ctx,'h4'); g=page(ctx,'g4')
    h.click('#btnQuick'); wait(h, "!document.querySelector('#btnPractice').hidden")
    h.click('#btnPractice'); h.wait_for_timeout(1000)
    wait(g, "document.querySelectorAll('#lobbyList .lrow').length>0", 40)
    g.click('#lobbyList .lrow button')
    wait(h, "!document.querySelector('#foundBan').hidden", 40)
    h.click('#foundNo')
    res['declinedTold']=wait(g, "/übt lieber/.test(document.querySelector('#lobbyStatus').textContent)", 20)
    h.wait_for_timeout(2500)
    res['stillPractising']=h.evaluate("__wvr.V.mode==='ai' && __wvr.V.playing && !__wvr.NET.r")
    c=page(ctx,'c4'); c.wait_for_timeout(3500)
    res['clearedAfterDecline']=rows(c)
    for pg in (h,g,c): pg.close()
    # 5) moving a profile to another device with the 8-digit code (used up once taken)
    a=page(ctx,'a5'); d=page(ctx,'d5')
    a.evaluate("()=>{const W=__wvr,P=W.PLAYER; P.xp=777; P.gems=123; P.nm=5; P.nr=42; P.ach.firstWin=1; W.PLAYER=P;}")
    code=a.evaluate("__wvr.profSend()")
    res['xferCode']=bool(code) and len(code)==8
    got=d.evaluate("async c=>{const P=await __wvr.profFetch(c); return P && [P.xp, P.gems, P.nm, P.nr, !!P.ach.firstWin];}", code)
    res['xferGot']=got
    res['xferUsedUp']=d.evaluate("async c=>!(await __wvr.profFetch(c))", code)
    b.close()
print(res)
print('errs', errs[:5])
ok = (res['hostPub'] and res['listed'] and res['rows'] and 'Lv 13' in res['rows'][0] and res['match1'] and res['noFace'] and res['clearedAfterStart']==[]
      and res['vsCard'] and res['guestSeesSkin'] == 'r1' and res['guestSeesName'] == [13, 'oma']
      and res['quickJoin'] and res['practising'] and res['banner'] and res['guestToldPractice'] and res['match3'] and res['bannerGone']
      and res['declinedTold'] and res['stillPractising'] and res['clearedAfterDecline']==[]
      and res['xferCode'] and res['xferGot'] == [777, 123, 5, 42, True] and res['xferUsedUp'] and not errs)
print('LOBBY', 'OK' if ok else 'FAIL')
