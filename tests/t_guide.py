# First steps (53-guide.js): a new player gets the tutorial offer once on "Los geht's", then in the match a checklist that ticks off
# train → AUTO → select → order to a flag → take over → goal, with the current step's button pulsing and an arrow over the flag;
# closing it or finishing it keeps it away for good. Mouse: a dragged rectangle selects, a click into the void deselects, C deselects.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = launch(p); errs = []
    ctx = b.new_context(viewport={'width': 1200, 'height': 720}); ctx.route('**/*', route)
    pg = page(ctx, errs); pg.goto('http://game.test/'); pg.wait_for_timeout(2000)
    pg.evaluate("localStorage.removeItem('wvr-first'); localStorage.removeItem('wvr-guide')")
    r = {}
    pg.click('#btnAi'); pg.wait_for_timeout(500)
    r['offer'] = pg.is_visible('#firstScr')
    pg.click('#firstGo'); pg.wait_for_timeout(3000)
    r['guide'] = pg.is_visible('#guide')
    r['step0'] = pg.evaluate("__wvr.GUIDE.i")
    r['pulse0'] = pg.evaluate("!!document.querySelector('.spawn.guidePulse')")
    pg.screenshot(path=str(OUT / 'guide_pc.png'))
    pg.evaluate("__wvr.G.cd = 0; __wvr.G.teams[0].gold = 900")
    pg.click('.spawn[data-slot="0"] .main'); pg.wait_for_timeout(1200)
    r['step1'] = pg.evaluate("__wvr.GUIDE.i")
    pg.click('.spawn[data-slot="0"] .auto'); pg.wait_for_timeout(1200)
    r['step2'] = pg.evaluate("__wvr.GUIDE.i")
    pg.wait_for_timeout(3500)
    pg.keyboard.press('q'); pg.wait_for_timeout(800)
    r['step3'] = pg.evaluate("__wvr.GUIDE.i")
    r['arrow'] = pg.evaluate("!!__wvr.GUIDE.arrow")
    fi = pg.evaluate("__wvr.GUIDE.flagI")
    pt = pg.evaluate("(i) => { const W = __wvr, F = W.FLAGS[i]; return W.toScreen(F.x, W.groundY(F.x, F.z), F.z); }", fi)
    pg.mouse.click(pt['x'], pt['y'], button='right'); pg.wait_for_timeout(800)
    r['step4'] = pg.evaluate("__wvr.GUIDE.i")
    # C deselects, then a click on a unit and F takes it over
    pg.keyboard.press('c'); pg.wait_for_timeout(200)
    r['deselC'] = pg.evaluate("__wvr.V.selected.size")
    u = pg.evaluate("() => { const W = __wvr; const u = [...W.V.units.values()].find(u => u.team === 0); const p = W.toScreen(u.g.position.x, u.g.position.y + 1.1, u.g.position.z); return { x: p.x, y: p.y }; }")
    pg.mouse.click(u['x'], u['y']); pg.wait_for_timeout(300)
    r['pulsePoss'] = pg.evaluate("!!document.querySelector('#possBtn.guidePulse')")
    pg.keyboard.press('f'); pg.wait_for_timeout(1500)
    r['step5'] = pg.evaluate("__wvr.GUIDE.i")
    r['ego'] = pg.evaluate("!!__wvr.V.poss")
    # Space in the ego = special
    r['spBefore'] = pg.evaluate("__wvr.V.poss.s")
    pg.keyboard.press('Space'); pg.wait_for_timeout(300)
    r['spAfter'] = pg.evaluate("__wvr.V.poss.s")
    pg.keyboard.press('x'); pg.wait_for_timeout(800)
    # rectangle selection with the mouse
    pg.evaluate("__wvr.V.selected.clear()")
    pg.mouse.move(300, 200); pg.mouse.down(); pg.mouse.move(900, 650, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    r['rect'] = pg.evaluate("__wvr.V.selected.size")
    v = pg.evaluate("() => { const W = __wvr; for (let y = 80; y < 600; y += 40) for (let x = 200; x < 1000; x += 40) if (!W.pickUnit(x, y, false) && W.groundAt(x, y)) return { x, y }; return null; }")
    pg.mouse.click(v['x'], v['y']); pg.wait_for_timeout(300)
    r['voidClick'] = pg.evaluate("__wvr.V.selected.size")
    pg.evaluate("__wvr.GUIDE.hold = 1"); pg.wait_for_timeout(1200)
    r['finished'] = pg.evaluate("!__wvr.GUIDE.on && localStorage.getItem('wvr-guide') === '1'")
    # a second match: no offer, no guide
    pg.click('#menuBtn'); pg.click('#btnQuit'); pg.click('#btnQuit'); pg.wait_for_timeout(800)
    pg.click('#btnAi'); pg.wait_for_timeout(2500)
    r['again'] = [pg.is_visible('#firstScr'), pg.is_visible('#guide')]
    print(json.dumps(r)); print('ERRS', errs[:4]); b.close()
ok = (r['offer'] and r['guide'] and r['step0'] == 0 and r['pulse0'] and r['step1'] == 1 and r['step2'] == 2 and r['step3'] == 3 and r['arrow']
      and r['step4'] == 4 and r['deselC'] == 0 and r['pulsePoss'] and r['step5'] == 5 and r['ego'] and r['spAfter'] == r['spBefore'] + 1
      and r['rect'] >= 1 and r['voidClick'] == 0 and r['finished'] and r['again'] == [False, False] and not errs)
print('GUIDE', 'OK' if ok else 'FAIL')
