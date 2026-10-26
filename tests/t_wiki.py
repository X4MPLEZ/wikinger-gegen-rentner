# The wiki (68-wiki.js): the menu button opens it, the tabs show the warriors of both factions, the wild animals and the rules; a warrior's
# page has his story, numbers (from KINDS), strong/weak faces (a tap jumps to that warrior) and tips, the 3D showcase turns him; back goes to
# where it was opened (menu, pause); the "while you wait" button shows only while the online status is up; a match start closes the wiki;
# in English no German is left on the page.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
r = {}
with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(viewport={'width': 390, 'height': 844}); ctx.route('**/*', route); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(2000)
    vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id)"
    r['waitHidden'] = not pg.is_visible('#btnWikiWait')
    pg.evaluate("() => { const s = document.querySelector('#onlineStatus'); s.hidden = false; s.textContent = 'Fehler'; }")
    r['notOnError'] = not pg.is_visible('#btnWikiWait')  # a plain message (no waiting) does not offer the wiki
    pg.evaluate("() => { const s = document.querySelector('#onlineStatus'); s.classList.add('dots'); s.textContent = 'Warte'; }")
    r['waitShown'] = pg.is_visible('#btnWikiWait')
    pg.evaluate("() => { const s = document.querySelector('#onlineStatus'); s.hidden = true; s.classList.remove('dots'); }")
    pg.click('#btnWiki'); pg.wait_for_timeout(1200)
    r['open'] = pg.evaluate(vis)
    info = "() => ({ picks: [...document.querySelectorAll('#wikiBody .wpick')].map(e => +e.dataset.k), name: (document.querySelector('#wikiBody .wname b') || {}).textContent, secs: document.querySelectorAll('#wikiBody .wsec').length, kpis: document.querySelectorAll('#wikiBody .wkpi').length, tips: document.querySelectorAll('#wikiBody .wsec li').length, live: !!document.querySelector('#wikiStage canvas'), text: document.querySelector('#wikiBody').innerText })"
    v = pg.evaluate(info)
    r['viking'] = {'picks': v['picks'], 'name': v['name'], 'secs': v['secs'], 'kpis': v['kpis'], 'tips': v['tips'], 'live': v['live']}
    pg.click('#wikiTabs [data-w="rentner"]'); pg.wait_for_timeout(500)
    pg.click('#wikiBody .wpick[data-k="13"]'); pg.wait_for_timeout(800)
    v = pg.evaluate(info)
    r['falle'] = {'picks': v['picks'], 'name': v['name'], 'fang': 'Fangeisen' in v['text'], 'trap': 'Bärenfalle' in v['text'], 'hp': str(130) in v['text']}
    pg.screenshot(path=str(OUT / 'wiki_falle.png'))
    # a face under "Stark gegen" jumps to that warrior (the Ziegenreiter is a Wikinger: the tab follows)
    pg.click('#wikiBody .wvs .wface[data-k="4"]'); pg.wait_for_timeout(800)
    v = pg.evaluate(info)
    r['jump'] = [v['name'], pg.evaluate("document.querySelector('#wikiTabs [aria-selected=true]').dataset.w")]
    pg.click('#wikiTabs [data-w="wild"]'); pg.wait_for_timeout(800)
    r['wild'] = pg.evaluate(info)['picks']
    pg.click('#wikiTabs [data-w="rules"]'); pg.wait_for_timeout(500)
    t = pg.evaluate("document.querySelector('#wikiBody').innerText")
    r['rules'] = ['Schere, Stein, Papier' in t, 'Feuerfass' in t and 'Fallenleger' in t]
    pg.click('#wikiBack'); pg.wait_for_timeout(500)
    r['back'] = pg.evaluate(vis)
    # from the pause menu and back; a match start closes it
    pg.click('#btnAi'); pg.wait_for_timeout(2500)
    pg.evaluate("document.querySelector('#menuBtn').click()"); pg.wait_for_timeout(600)
    pg.click('#btnWiki2'); pg.wait_for_timeout(800)
    r['pauseOpen'] = pg.evaluate(vis)
    pg.click('#wikiBack'); pg.wait_for_timeout(500)
    r['pauseBack'] = pg.evaluate(vis)
    pg.click('#btnWiki2'); pg.wait_for_timeout(500)
    pg.evaluate("__wvr.showScreen(null)"); pg.wait_for_timeout(300)
    r['closed'] = pg.evaluate(vis)
    # English: no German left on a warrior's page
    ctx2 = b.new_context(viewport={'width': 1100, 'height': 760}); ctx2.route('**/*', route)
    ctx2.add_init_script("window.WVR_LANG = 'en';")
    p2 = ctx2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)[:300]))
    p2.goto('http://game.test/?lang=en'); p2.wait_for_timeout(2000)
    p2.click('#btnWiki'); p2.wait_for_timeout(800)
    p2.click('#wikiTabs [data-w="rentner"]'); p2.wait_for_timeout(300); p2.click('#wikiBody .wpick[data-k="13"]'); p2.wait_for_timeout(500)
    t2 = p2.evaluate("document.querySelector('#wikiScr').innerText")
    r['enGerman'] = [w for w in ['Geschichte', 'Fangeisen', 'Werte', 'Stark gegen', 'Tipps', 'Spezialfähigkeit', 'Leben'] if w in t2]
    p2.screenshot(path=str(OUT / 'wiki_en.png'))
    b.close()
print(json.dumps(r))
print('ERRS', errs[:3])
ok = (r['waitHidden'] and r['notOnError'] and r['waitShown'] and r['open'] == ['wikiScr']
      and r['viking']['picks'] == [0, 1, 4, 12, 6] and r['viking']['name'] == 'Berserker' and r['viking']['secs'] == 5 and r['viking']['kpis'] >= 7 and r['viking']['tips'] >= 3
      and r['falle']['picks'] == [2, 3, 5, 13, 7] and r['falle']['name'] == 'Fallenleger' and r['falle']['fang'] and r['falle']['trap'] and r['falle']['hp']
      and r['jump'] == ['Ziegenreiter', 'viking'] and r['wild'] == [8, 10] and all(r['rules'])
      and r['back'] == ['menu'] and r['pauseOpen'] == ['wikiScr'] and r['pauseBack'] == ['pause'] and r['closed'] == []
      and r['enGerman'] == [] and not errs)
print('WIKI', 'OK' if ok else 'FAIL')
