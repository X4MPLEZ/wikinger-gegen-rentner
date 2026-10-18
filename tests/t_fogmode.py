# v44: the fog mode ("Nebel überall"): menu button, fog for the whole match (commander + ego), no fog event, the AI only knows what it sees.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
OUT = os.environ.get('OUT', 'fogmode')
with sync_playwright() as p:
    b = launch(p); errs = []
    ctx = b.new_context(viewport={'width': 1100, 'height': 680}); ctx.route('**/*', route)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append((getattr(e, 'stack', None) or str(e))[:400]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    menu = pg.evaluate("""() => Array.from(document.querySelectorAll('[data-mode]')).map(b => [b.dataset.mode, b.textContent.trim(), b.getAttribute('aria-pressed')])""")
    pg.click('[data-mode="fog"]'); pg.wait_for_timeout(200)
    sel = pg.evaluate("""() => ({ stored:localStorage.getItem('wvr-mode'), pressed:document.querySelector('[data-mode="fog"]').getAttribute('aria-pressed'), info:(document.querySelector('#aiInfo') || {}).textContent })""")
    pg.screenshot(path=f'{OUT}_menu.png')
    pg.evaluate("() => { window.__toasts = []; const t = document.querySelector('#toast'); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList:true, characterData:true, subtree:true }); const hb = document.querySelector('#hlBan'); new MutationObserver(() => window.__toasts.push(hb.textContent)).observe(hb, { childList:true, characterData:true, subtree:true }); }")
    pg.evaluate("document.querySelector('.mcard.m1').click()"); pg.click('#btnAi'); pg.wait_for_timeout(5000)
    st = pg.evaluate("""() => { const W = __wvr, s = W.V.latest; return { gfog:W.G.fog, fg:s && s.fg, on:W.FOG.on, k:+W.FOG.k.toFixed(2), toast:window.__toasts.join(' | '), wall:W.FOGW.active }; }""")
    pg.screenshot(path=f'{OUT}_cmd.png')
    # events: never the fog event in fog mode
    ev = pg.evaluate("""() => { const W = __wvr, G = W.G, kinds = []; for (let i = 0; i < 40; i++) { const E = { next:0, cur:0, t:0, last:0, n:0 }; W.startEvent(G, E); kinds.push(E.cur); W.endEvent(G, E); } G.ev = { next:1e9, cur:0, t:0, last:0, n:0 }; G.wagon = null; return kinds; }""")
    # AI knowledge: enemies far from all its warriors and its base are unknown to it
    ai = pg.evaluate("""() => { const W = __wvr, G = W.G, me = W.V.myTeam, ai = 1 - me, mine = G.units.filter(u => u.team === ai), B = W.BASES[me];
      const far = { x:B.x, z:B.z, team:me }, near = mine[0] ? { x:mine[0].x + 3, z:mine[0].z, team:me } : null;
      return { farSeen:W.aiSees(G, ai, mine, far), nearSeen:near ? W.aiSees(G, ai, mine, near) : null }; }""")
    # ego view in the fog
    pg.evaluate("""() => { const W = __wvr, me = W.V.myTeam, u = [...W.V.units.values()].find(o => o.team === me && !W.KINDS[o.k].worm); W.V.selected.clear(); W.V.selected.add(u.id); W.enterEgo(); }""")
    pg.wait_for_timeout(2500)
    eg = pg.evaluate("""() => { const W = __wvr; return { poss:!!W.V.poss, fogFar:+W.scene.fog.far.toFixed(1), on:W.FOG.on }; }""")
    pg.screenshot(path=f'{OUT}_ego.png')
    print(json.dumps({ 'menu':menu, 'sel':sel, 'st':st, 'ev':ev, 'ai':ai, 'ego':eg })); print('ERRS', errs[:5])
    ok = any(m[0] == 'fog' for m in menu) and sel['stored'] == 'fog' and 'Nebel' in (sel['info'] or '') and st['gfog'] and st['fg'] == 1 and st['on'] and st['k'] > 0.9 and st['wall'] and 'NEBEL-MODUS' in st['toast'] \
        and 1 not in ev and not ai['farSeen'] and ai['nearSeen'] and eg['poss'] and eg['on'] and eg['fogFar'] < 40 and not errs
    print('FOGMODE', 'OK' if ok else 'FAIL'); b.close()
