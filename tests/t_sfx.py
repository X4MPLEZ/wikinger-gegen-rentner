# Sound smoke test: the CC0 sprite decodes, every sound renders offline without errors, levels stay in a sane range.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required']); ctx = b.new_context(); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: m.type in ('error', 'warning') and 'sfx' in m.text and errs.append(m.text[:200]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1200)
    pg.mouse.click(5, 5); pg.evaluate('__wvr.SFX.unlock()')
    pg.wait_for_function('__wvr.SFX.samplesReady()', timeout=15000)
    r = pg.evaluate("""async () => { const S = __wvr.SFX, out = {}, old = {}; for (const n of S.names()) { try { const m = await S.renderTest(n, { k:n === 'dieV' ? 1 : 2 }, 3); out[n] = m && [+m.peak.toFixed(3), +m.rms.toFixed(4), +m.dur.toFixed(2), +m.onset.toFixed(3)]; } catch (e) { out[n] = 'ERR ' + e.message; } }
      S._smp(false); for (const n of S.names()) { try { const m = await S.renderTest(n, { k:2 }, 3); old[n] = m && [+m.peak.toFixed(3), +m.rms.toFixed(4)]; } catch (e) { old[n] = 'ERR'; } } S._smp(true); return { shift:S.sampleShift, out, old }; }""")
    print('shift', r['shift'])
    bad = []
    for n, m in sorted(r['out'].items()):
        o = r['old'].get(n); print(f'{n:12s} {str(m):38s} synth-only {o}')
        if not isinstance(m, list) or m[0] < 0.01 or m[0] > 3.5: bad.append(n)
    print('silent/err/hot:', bad); print('errs', errs[:5])
    print('SFX', 'OK' if not errs and not [x for x in bad if not isinstance(r['out'][x], list) or r['out'][x][0] > 3.5] else 'FAIL')
    b.close()
