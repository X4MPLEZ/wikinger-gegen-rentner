# HUD layout: in a busy chaos match (phase chip, event chip, seven perks, four kill-feed lines) nothing prints over anything else,
# on a phone in portrait and landscape and on a PC. Screenshots: tests/out/hud_<view>.png
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *

def overlap(a, b):
    return a and b and a[0] < b[2] - 1 and b[0] < a[2] - 1 and a[1] < b[3] - 1 and b[1] < a[3] - 1

bad = []
with sync_playwright() as p:
    b = launch(p); errs = []
    views = [('port', {'width': 390, 'height': 844}, True, 'chaos'), ('land', {'width': 844, 'height': 390}, True, 'chaos'),
             ('pc', {'width': 1280, 'height': 720}, False, 'chaos'), ('land_fog', {'width': 844, 'height': 390}, True, 'fog'),
             ('port_fog', {'width': 390, 'height': 844}, True, 'fog')]
    for name, vp, mob, mode in views:
        ctx = b.new_context(viewport=vp, has_touch=mob, is_mobile=mob); ctx.route('**/*', route)
        pg = page(ctx, errs); pg.goto('http://game.test/'); pg.wait_for_timeout(1200)
        pg.click(f'[data-mode="{mode}"]'); pg.click('#btnAi'); pg.wait_for_timeout(2500)
        pg.evaluate("""() => { const W = __wvr, G = W.G; G.cd = 0; G.t = W.CFG.phaseT[0] - 40; G.nextOffer = G.t + 25;
            G.teams[0].pk = { gold: 1, flagger: 1, charge: 1, heal: 1, turbo: 1, armor: 1, jump: 1 }; G.ev = G.ev || {}; G.ev.cur = 1; G.ev.t = 30; G.ev.n = 1; }""")
        pg.wait_for_timeout(700)
        pg.evaluate("() => { const s = __wvr.V.latest; for (let i = 0; i < 4; i++) __wvr.killFeed([0, i % 2 ? 0 : 2, 1 - (i % 2), i % 2 ? 2 : 0, 0, 0], s); }")
        pg.wait_for_timeout(600)
        r = pg.evaluate("""() => { const q = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect();
              return r.width && r.height ? [r.x, r.y, r.right, r.bottom] : null; };
            return { phase: q('#phaseChip'), ev: q('#evChip'), perk: q('#perkBar'), kf: q('#killFeed'), tl: q('.hud-tl'), tr: q('.hud-tr'), orders: q('.hud-orders'),
              spawn: q('.hud-spawn'), mini: getComputedStyle(document.querySelector('#mini')).display !== 'none' ? q('#mini') : null, w: innerWidth }; }""")
        pg.screenshot(path=f'hud_{name}.png')
        for a, c in [('phase', 'perk'), ('phase', 'ev'), ('ev', 'perk'), ('kf', 'perk'), ('kf', 'ev'), ('kf', 'phase'), ('kf', 'orders'), ('kf', 'tl'), ('kf', 'tr'),
                     ('perk', 'orders'), ('perk', 'tl'), ('kf', 'spawn'), ('kf', 'mini'), ('perk', 'mini'), ('phase', 'mini')]:
            if overlap(r[a], r[c]): bad.append(f'{name}: {a} over {c}')
        if not (r['phase'] and r['ev'] and r['kf'] and (r['perk'] or mode == 'fog')): bad.append(f'{name}: something missing {r}')
        if mode == 'fog' and not r['mini']: bad.append(f'{name}: no small map in fog mode')
        if r['kf'] and r['kf'][2] > r['w'] + 1: bad.append(f'{name}: kill feed off screen')
        print(name, json.dumps({k: [round(x) for x in v] if isinstance(v, list) else v for k, v in r.items()}))
        ctx.close()
    print('ERRS', errs[:5]); b.close()
print('problems', bad)
print('HUD_LAYOUT', 'OK' if not bad and not errs else 'FAIL')
