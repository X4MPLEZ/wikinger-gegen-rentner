# Smoke test: the menu loads, and a short match against the computer runs in every mode (classic, chaos, fog) without a single error:
# recruiting works, the snapshot advances, taking over a warrior works.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *

R = {}
with sync_playwright() as p:
    b = launch(p); errs = []
    ctx = b.new_context(viewport={'width': 1100, 'height': 700}); ctx.route('**/*', route)
    pg = page(ctx, errs); pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    R['menu'] = pg.is_visible('#menu') and pg.is_visible('#btnAi')
    for mode in ['classic', 'chaos', 'fog']:
        pg.click(f'[data-mode="{mode}"]'); pg.click('#btnAi'); pg.wait_for_timeout(2000)
        pg.evaluate("__wvr.G.cd = 0; __wvr.G.teams[0].gold = 900")
        for i in range(3):
            pg.click(f'.spawn[data-slot="{i}"] .main'); pg.wait_for_timeout(150)
        pg.wait_for_timeout(5000)
        t0 = pg.evaluate('__wvr.V.latest.t'); pg.wait_for_timeout(800)
        r = pg.evaluate("""() => { const W = __wvr, G = W.G; const mine = G.units.filter(u => u.team === 0);
            if (mine[0]) { W.V.selected.clear(); W.V.selected.add(mine[0].id); W.enterEgo(); }
            return { mine: mine.length, foes: G.units.filter(u => u.team === 1).length, chaos: !!G.chaos, fog: !!G.fog }; }""")
        for i in range(12):  # the host confirms the takeover with the next snapshots (slow software GL: give it a few seconds)
            pg.wait_for_timeout(500)
            r['ego'] = pg.evaluate('!!(__wvr.V.poss && __wvr.V.poss.confirmed)')
            if r['ego']: break
        r['advancing'] = pg.evaluate('__wvr.V.latest.t') > t0
        R[mode] = r
        pg.evaluate("__wvr.exitEgo && __wvr.exitEgo(false)")
        pg.click('#menuBtn'); pg.click('#btnQuit'); pg.click('#btnQuit'); pg.wait_for_timeout(600)
    print(json.dumps(R)); print('ERRS', errs[:5]); b.close()
ok = R['menu'] and not errs and all(R[m]['mine'] >= 1 and R[m]['ego'] and R[m]['advancing'] for m in ['classic', 'chaos', 'fog']) \
    and R['chaos']['chaos'] and R['fog']['fog'] and not R['classic']['chaos']
print('SMOKE', 'OK' if ok else 'FAIL')
