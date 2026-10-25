# UX regressions: "Aufgeben" asks first, Esc closes the menu, the back button opens the menu, a hidden tab pauses an AI game,
# tips and the faction are remembered, the join code error shows under the field, key binding: a left click outside cancels, a key clash is named,
# chicken hides the instanced body, the kill feed sits under the chips
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
R = {}
with sync_playwright() as p:
    b = launch(p); errs = []
    ctx = b.new_context(viewport={'width': 1200, 'height': 760}); ctx.route('**/*', route)
    pg = page(ctx, errs); pg.goto('http://game.test/'); pg.wait_for_timeout(1200)
    # join code error right under the field
    pg.fill('#codeIn', '12'); pg.click('#btnJoin'); pg.wait_for_timeout(200)
    R['joinErr'] = [pg.is_visible('#onlineStatus'), pg.inner_text('#onlineStatus')]
    # faction remembered
    pg.click('.fac.viking'); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_timeout(1200)
    R['facKept'] = pg.evaluate("document.querySelector('.fac.viking').getAttribute('aria-pressed')")
    pg.click('.fac.rentner')
    # key binding screen: a left click outside a field stops waiting instead of binding the left button
    pg.evaluate("document.querySelector('#btnKeys').click()"); pg.wait_for_timeout(300)
    pg.click('.kbtn[data-a="pause"][data-i="0"]'); pg.wait_for_timeout(250)
    pg.mouse.click(5, 5); pg.wait_for_timeout(200)
    R['pauseKey'] = pg.evaluate("__wvr.SET && 1") and pg.inner_text('.kbtn[data-a="pause"][data-i="0"]')
    # a clash is named: bind "Pause" to G (used by the grenade)
    pg.click('.kbtn[data-a="pause"][data-i="0"]'); pg.wait_for_timeout(250)
    pg.keyboard.press('KeyG'); pg.wait_for_timeout(200)
    R['clashNote'] = pg.inner_text('#keysNote')
    pg.click('#keysReset'); pg.wait_for_timeout(100); pg.click('#keysBack'); pg.wait_for_timeout(200)
    # AI match
    pg.click('#btnAi'); pg.wait_for_timeout(2500); pg.evaluate("__wvr.G.cd=0"); pg.wait_for_timeout(500)
    # quit asks first
    pg.click('#menuBtn'); pg.wait_for_timeout(200)
    R['pauseTitle'] = pg.inner_text('#pauseTitle')
    pg.click('#btnQuit'); pg.wait_for_timeout(150)
    R['armed'] = pg.inner_text('#btnQuit'); R['stillPlaying'] = pg.evaluate('__wvr.V.playing')
    pg.wait_for_timeout(3200); R['disarmed'] = pg.inner_text('#btnQuit')
    # Esc closes the menu
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    R['escClosed'] = pg.is_hidden('#pause') and not pg.evaluate('__wvr.paused === true')
    # back button opens the menu, the match goes on
    pg.evaluate("history.back()"); pg.wait_for_timeout(500)
    R['backOpensMenu'] = pg.is_visible('#pause'); R['backPlaying'] = pg.evaluate('__wvr.V.playing')
    pg.click('#btnResume'); pg.wait_for_timeout(200)
    # hidden tab pauses the AI game
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(300)
    R['hiddenPaused'] = pg.is_visible('#pause')
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
    pg.click('#btnResume'); pg.wait_for_timeout(300)
    # chicken: the body is not drawn through the instancing any more
    R['chicken'] = pg.evaluate("""async()=>{const W=__wvr,G=W.G; const T=G.teams[0]; T.gold=999;
       for(let i=0;i<3;i++) W.applyCmd(G,0,{t:'spawn',k:W.FAC[T.fac].kinds[0]});
       await new Promise(r=>setTimeout(r,4500));
       const u=G.units.filter(u=>u.team===0).pop(); if(!u) return 'no unit';
       W.camS.x=u.x; W.camS.z=u.z; W.applyCam(); // (the unit must be on screen to be counted in the batches)
       const cnt=()=>W.UB.list.reduce((a,e)=>a+e.n,0);
       G.teams.forEach(t=>{ t.q.length=0; t.gold=-1e6; }); // no new warriors while counting
       await new Promise(r=>setTimeout(r,1500)); const before=cnt();
       u.chick=8; let v=null; // (slow software GL: the snapshot with the chicken may take a few frames)
       for(let i=0;i<20;i++){ await new Promise(r=>setTimeout(r,200)); v=W.V.units.get(u.id); if(v&&v.chickM&&v.chickM.visible) break; }
       const after=cnt(); T.gold=999; return {before, after, rigVisible: v && v.rig.visible, chickM: !!(v && v.chickM && v.chickM.visible)};}""")
    # hints are remembered across matches
    pg.click('.spawn[data-slot="0"] .main'); pg.wait_for_timeout(300)
    R['hintsStored'] = pg.evaluate("localStorage.getItem('wvr-hints')")
    pg.screenshot(path='v45ux.png')
    print(json.dumps(R, ensure_ascii=False))
    print('ERRS', errs[:5]); b.close()
ok = (R['joinErr'][0] and 'vierstelligen' in R['joinErr'][1] and R['facKept'] == 'true' and R['pauseKey'] == 'P' and 'keine Taste mehr' in R['clashNote']
      and R['armed'] == 'Wirklich aufgeben?' and R['stillPlaying'] and R['disarmed'] == 'Aufgeben' and R['escClosed'] and R['backOpensMenu'] and R['backPlaying']
      and R['hiddenPaused'] and isinstance(R['chicken'], dict) and R['chicken']['after'] < R['chicken']['before'] and R['chicken']['chickM'] and 'spawn' in (R['hintsStored'] or '')
      and not errs)
print('UX', 'OK' if ok else 'FAIL')
