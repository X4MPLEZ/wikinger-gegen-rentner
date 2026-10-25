# Bug report: the button on the start page opens the form with a screenshot of the game; an empty text is refused; sending posts a
# multipart form to FormSubmit (address, text, device info, the screenshot as a file) and says thanks; a second report within a minute waits;
# a big picture of one's own (a phone screenshot, PNG) becomes a small JPEG of at most 1600 px.
import os, sys, json, io
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
posts = []
def route2(r):
    u = r.request.url
    if u.startswith('https://formsubmit.co/'):
        posts.append({'url': u, 'method': r.request.method, 'ct': r.request.headers.get('content-type', ''), 'body': r.request.post_data_buffer or b''})
        return r.fulfill(body='<html><body>Thanks</body></html>', content_type='text/html')
    return route(r)
with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(viewport={'width': 390, 'height': 844}); ctx.route('**/*', route2); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(2000)
    pg.click('#btnBug'); pg.wait_for_timeout(1500)
    r = {}
    r['open'] = pg.evaluate("!document.querySelector('#bugScr').hidden")
    r['shot'] = pg.evaluate("(() => { const i = document.querySelector('#bugImg'); return !i.hidden && !!i.src; })()")
    pg.click('#bugSend'); pg.wait_for_timeout(300)
    r['empty'] = pg.evaluate("document.querySelector('#bugMsg').textContent")
    pg.fill('#bugTxt', 'Der Eisbär steckt im Baum fest, Testbericht.')
    pg.fill('#bugMail', 'test@example.org')
    pg.screenshot(path=str(OUT / 'bug_form.png'))
    pg.click('#bugSend'); pg.wait_for_timeout(2500)
    r['msg'] = pg.evaluate("document.querySelector('#bugMsg').textContent")
    r['posts'] = len(posts)
    if posts:
        body = posts[0]['body']
        r['url'] = posts[0]['url']; r['multipart'] = 'multipart/form-data' in posts[0]['ct']
        r['hasText'] = 'Eisb'.encode() in body and b'Testbericht' in body
        r['hasInfo'] = b'name="Version"' in body and b'name="Ger' in body
        r['hasFile'] = b'filename="screenshot.' in body and b'image/' in body
        r['hasMail'] = b'test@example.org' in body
        i = body.find(b'filename="screenshot.'); j = body.find(b'\r\n--', i)
        r['fileKB'] = round((j - i) / 1024, 1) if i > 0 and j > i else 0  # a real picture of the menu scene, not a black frame
    pg.wait_for_timeout(1500)
    r['back'] = pg.evaluate("document.querySelector('#bugScr').hidden && !document.querySelector('#menu').hidden")
    pg.click('#btnBug'); pg.wait_for_timeout(500); pg.fill('#bugTxt', 'Noch ein Bericht direkt danach.'); pg.click('#bugSend'); pg.wait_for_timeout(500)
    r['again'] = pg.evaluate("document.querySelector('#bugMsg').textContent"); r['posts2'] = len(posts)
    buf = io.BytesIO(); Image.effect_noise((1179, 2556), 40).convert('RGB').save(buf, 'PNG'); png = buf.getvalue(); r['pngKB'] = round(len(png) / 1024)
    pg.set_input_files('#bugFile', files=[{'name': 'IMG_0001.PNG', 'mimeType': 'image/png', 'buffer': png}]); pg.wait_for_timeout(2000)
    r['pick'] = pg.evaluate("""(async () => { const i = document.querySelector('#bugImg'); if (i.hidden || !i.src) return null;
      const b = await (await fetch(i.src)).blob(); return { type: b.type, kb: Math.round(b.size / 1024), w: i.naturalWidth, h: i.naturalHeight }; })()""")
    print(json.dumps(r, indent=1)); print('errs', errs[:3]); b.close()
    ok = (r['open'] and r['shot'] and r['empty'] and r['posts2'] == 1 and r.get('url') == 'https://formsubmit.co/rentnervswikinger@gmail.com' and r.get('multipart')
          and r.get('hasText') and r.get('hasInfo') and r.get('hasFile') and r.get('hasMail') and r.get('fileKB', 0) > 8 and 'Danke' in r['msg'] and r['back'] and 'Minute' in r['again'] and not errs
          and r['pick'] and r['pick']['type'] == 'image/jpeg' and r['pick']['kb'] * 3 < r['pngKB'] and max(r['pick']['w'], r['pick']['h']) == 1600)
    print('BUG', 'OK' if ok else 'FAIL')
