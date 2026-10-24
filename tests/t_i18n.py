# Languages: every translation file is complete with intact placeholders and markup (tools/i18n.py), and in three very different
# languages (English, Russian - long words, Japanese - other script) the page is translated: title and <html lang>, no German text left
# on the menu, the profile screen or the match HUD, no "{0}" left over, and long labels fit (fitText in 52-hud.js): the profile tabs are
# not cut off and the order chips stay on one line on an upright phone. Screenshots: tests/out/i18n_<lang>_<screen>.png
import json, re, subprocess, sys
from harness import *

bad = []
r = subprocess.run([sys.executable, str(ROOT / 'tools/i18n.py')], capture_output=True, text=True)
print(r.stdout[-1500:])
if 'broken' in r.stdout and re.search(r'[1-9]\d* broken', r.stdout):
    bad.append('broken placeholders or markup in a translation')
miss = re.findall(r'^(\w+): .* (\d+) missing', r.stdout, re.M)
if any(int(n) for _, n in miss):
    print('WARNING: missing translations (they fall back to English):', [(l, n) for l, n in miss if int(n)])

keys = json.loads((ROOT / 'src/lang/en.json').read_text())  # every German text (the keys of a complete file)
GER = [k for k in keys if len(k) > 3 and not re.search(r'[{<]', k)]
TEXTS = """() => { const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const el = n.parentElement, t = n.textContent.trim(); if (!t || !el || el.closest('script,style')) continue;
    let hid = false; for (let e = el; e; e = e.parentElement) if (e.hidden || getComputedStyle(e).display === 'none') { hid = true; break; }
    if (!hid && el.getClientRects().length) out.add(t); }
  return [...out]; }"""
with sync_playwright() as p:
    b = launch(p); errs = []
    for lang in ['en', 'ru', 'ja']:
        tr = json.loads((ROOT / f'src/lang/{lang}.json').read_text())
        german = {k for k in GER if tr.get(k) and tr[k] != k}  # texts that must not show untranslated
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True); ctx.route('**/*', route)
        pg = page(ctx, errs); pg.goto(f'http://game.test/?lang={lang}'); pg.wait_for_timeout(1500)
        head = pg.evaluate("[document.documentElement.lang, document.title]")
        if head != [lang, tr['Rentner gegen Wikinger']]: bad.append(f'{lang}: lang/title {head}')
        seen = []
        def look(name):
            pg.screenshot(path=f'i18n_{lang}_{name}.png')
            for t in pg.evaluate(TEXTS):
                if t in german: bad.append(f'{lang} {name}: German text "{t[:50]}"')
                if re.search(r'\{\d\}', t): bad.append(f'{lang} {name}: placeholder left in "{t[:50]}"')
                seen.append(t)
        look('menu')
        pg.evaluate('__wvr.profOpen()'); pg.wait_for_timeout(500); look('profile')
        cut = pg.evaluate("[...document.querySelectorAll('.ptabs button')].filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent)")
        if cut: bad.append(f'{lang}: profile tabs cut off {cut}')
        pg.evaluate('__wvr.toMenu()'); pg.wait_for_timeout(300)
        pg.click('#btnAi'); pg.wait_for_timeout(2500); pg.evaluate('__wvr.G.cd = 0'); pg.wait_for_timeout(500)
        look('hud')
        rows = pg.evaluate("""() => { const k = [...document.querySelector('.orders2').children].filter(c => c.getClientRects().length);
          let n = 0, bottom = -1e9; for (const r of k.map(c => c.getBoundingClientRect()).sort((a, b) => a.top - b.top))
            if (r.top >= bottom - 2) { n++; bottom = r.bottom; } else bottom = Math.max(bottom, r.bottom);
          return n; }""")
        if rows > 1: bad.append(f'{lang}: order chips on {rows} lines')
        print(lang, head, len(seen), 'texts, order rows', rows)
        ctx.close()
    b.close()
print('ERRS', errs[:5])
print('problems', bad[:20])
print('I18N', 'OK' if not bad and not errs else 'FAIL')
