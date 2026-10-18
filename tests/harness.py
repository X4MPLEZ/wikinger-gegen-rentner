"""Shared setup for the browser tests.

Serves the built game (dist/body.html, made by `node tools/build.mjs`) at http://game.test/ with three.js r128 and face-api taken from
node_modules, and starts headless Chromium with software WebGL. Every other request is blocked, so the tests never touch the network.
Screenshots and logs go to tests/out/ (the working directory after the import).

Usage in a test:   from harness import *     then   with sync_playwright() as p: b = launch(p); ...
The page exposes internals as window.__wvr (see src/js/99-boot.js): __wvr.G (game state), __wvr.V (view state), __wvr.step(G) ...
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
NODE = ROOT / 'node_modules'
THREE = (NODE / 'three/build/three.min.js').read_text()
_fapi = NODE / '@vladmandic/face-api/dist/face-api.js'
FAPI = _fapi.read_text() if _fapi.exists() else ''
html = Path(os.environ.get('PAGE') or ROOT / 'dist/body.html').read_text()
page_html = (
    '<!doctype html><html><head><meta charset=utf8>'
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>'
)


def route(r):
    u = r.request.url
    if 'three' in u:
        return r.fulfill(body=THREE, content_type='application/javascript')
    if 'face-api' in u:
        return r.fulfill(body=FAPI, content_type='application/javascript')
    if u.startswith('http://game.test/models/'):
        fn = ROOT / 'models' / u.split('/models/')[1]
        return r.fulfill(body=fn.read_bytes(), content_type='application/octet-stream' if fn.suffix == '.bin' else 'application/json')
    if u.startswith('http://game.test/'):
        return r.fulfill(body=page_html, content_type='text/html')
    return r.abort()


def launch(p):
    return p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])


def page(ctx, errs):
    """A new page that collects uncaught errors and console errors in errs."""
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and errs.append(m.text))
    return pg


OUT = ROOT / 'tests' / 'out'
OUT.mkdir(exist_ok=True)
os.chdir(OUT)
