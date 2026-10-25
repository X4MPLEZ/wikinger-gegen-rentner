# Bug report: the button on the start page opens the form with a screenshot of the game; an empty text is refused; sending posts a
# multipart form to FormSubmit (address, text, device info, the screenshot as a file) and says thanks; a second report within a minute waits.
import os, sys, json
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
    pg.wait_for_timeout(1500)
    r['back'] = pg.evaluate("document.querySelector('#bugScr').hidden && !document.querySelector('#menu').hidden")
    pg.click('#btnBug'); pg.wait_for_timeout(500); pg.fill('#bugTxt', 'Noch ein Bericht direkt danach.'); pg.click('#bugSend'); pg.wait_for_timeout(500)
    r['again'] = pg.evaluate("document.querySelector('#bugMsg').textContent"); r['posts2'] = len(posts)
    print(json.dumps(r, indent=1)); print('errs', errs[:3]); b.close()
    ok = (r['open'] and r['shot'] and r['empty'] and r['posts2'] == 1 and r.get('url') == 'https://formsubmit.co/rentnervswikinger@gmail.com' and r.get('multipart')
          and r.get('hasText') and r.get('hasInfo') and r.get('hasFile') and r.get('hasMail') and 'Danke' in r['msg'] and r['back'] and 'Minute' in r['again'] and not errs)
    print('BUG', 'OK' if ok else 'FAIL')
