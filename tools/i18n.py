#!/usr/bin/env python3
"""Translations: collect every German text of the game and check the language files.

    python3 tools/i18n.py            report per language (missing, unused, broken placeholders/markup)
    python3 tools/i18n.py --keys F   also write all German texts to F (JSON list) - the input for translating

The texts are the first arguments of TR('...') in src/js (always a string literal, see src/js/00-i18n.js) plus the static texts of
src/body.html, collected by the game itself (?i18n=collect, needs a build: node tools/build.mjs). Language files: src/lang/<code>.json.
Exit code 1 if a language misses texts or breaks a placeholder {0} or a tag.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))


def js_keys():
    keys = []
    lit = re.compile(r"\bTR\(\s*('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\")")
    for f in sorted((ROOT / 'src/js').glob('*.js')):
        for m in lit.finditer(f.read_text()):
            r = m.group(1)
            body = r[1:-1]
            if r[0] == "'":
                body = re.sub(r'(?<!\\)"', '\\"', body.replace("\\'", "'"))
            keys.append(json.loads('"' + body + '"'))
    return keys


def dom_keys():
    from harness import sync_playwright, launch, route  # noqa: E402  (starts nothing until called)
    with sync_playwright() as p:
        b = launch(p)
        ctx = b.new_context()
        pg = ctx.new_page()
        pg.route('**/*', route)
        pg.goto('http://game.test/?i18n=collect&lang=de')
        pg.wait_for_timeout(1200)
        out = pg.evaluate('__wvr.I18N_DOM')
        b.close()
    return out


def check(keys):
    ph = lambda s: sorted(re.findall(r'\{\d\}', s))
    tags = lambda s: sorted(re.findall(r'</?[a-z]+', s))
    bad = False
    for f in sorted((ROOT / 'src/lang').glob('*.json')):
        d = json.loads(f.read_text())
        miss = [k for k in keys if not d.get(k)]
        unused = [k for k in d if k not in keys]
        broken = [k for k in keys if d.get(k) and (ph(d[k]) != ph(k) or tags(d[k]) != tags(k))]
        print(f'{f.stem}: {len(keys) - len(miss)}/{len(keys)} translated, {len(miss)} missing, {len(unused)} unused, {len(broken)} broken')
        for k in broken[:8]:
            print('   broken:', k[:70], '->', d[k][:70])
        for k in miss[:5]:
            print('   missing:', k[:90])
        bad = bad or bool(miss) or bool(broken)
    return bad


if __name__ == '__main__':
    keys = list(dict.fromkeys(js_keys() + dom_keys()))
    print(len(keys), 'German texts')
    if '--keys' in sys.argv:
        out = Path(sys.argv[sys.argv.index('--keys') + 1])
        out.write_text(json.dumps(keys, ensure_ascii=False, indent=0))
        print('written', out)
    sys.exit(1 if check(keys) else 0)
