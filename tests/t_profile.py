# The player's profile (65-profile.js): XP and levels from match results, level rewards, Juwelen, achievements (end numbers and live
# moments), shop and equipping, the daily win bonus, cleaning of broken or edited data, and the public info other players get.
import json
from harness import *

with sync_playwright() as p:
    b = launch(p); ctx = b.new_context(); errs = []
    pg = page(ctx, errs); pg.route('**/*', route); pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""() => {
      const W = __wvr, out = {};
      W.PLAYER = W.profClean(null);
      const M = o => Object.assign({ won: true, online: false, ai: true, tut: false, adv: false, lvl: 'medium', fac: 'viking', map: 'wiesen',
        mode: 'classic', t: 500, k: 20, st: [10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0], ost: [8, 9, 300, 0, 0, 0, 0, 0, 0, 0, 0], base: 900, mhp: 1500, ru: 0 }, o);
      // first win: 40 + 40 + 20 kills = 100 XP -> level 2 (needs 100), first-win and daily bonus Juwelen
      let R = W.profMatchEnd(M({}));
      out.first = [R.xp, R.lv1.L, R.ach.includes('firstWin'), R.daily, W.PLAYER.gems];
      // a loss online: (40 + 10 kills) x 1.5 = 75, streak back to 0
      R = W.profMatchEnd(M({ won: false, online: true, ai: false, k: 10 }));
      out.loss = [R.xp, W.PLAYER.st.streak, W.PLAYER.st.onGames];
      // three wins in a row -> Siegesserie; extreme AI -> Legende (and its picture is owned)
      W.profMatchEnd(M({})); W.profMatchEnd(M({})); R = W.profMatchEnd(M({ lvl: 'extreme' }));
      out.streak = [W.PLAYER.st.streak, !!W.PLAYER.ach.streak3, !!W.PLAYER.ach.winExtreme, W.profOwns('opaCrown')];
      out.dailyOnce = R.daily; // the daily bonus only once per day
      // fortress: no base damage taken; blitz: under 6 minutes
      R = W.profMatchEnd(M({ t: 300, ost: [8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0] }));
      out.fortressBlitz = [R.ach.includes('fortress'), R.ach.includes('blitz')];
      // live moments (only during a match): a strike of 5
      W.V.playing = true; W.V.tut = false; W.profEvent('hl', { ty: 'strike', mine: true, n: 5 }); W.profEvent('hl', { ty: 'strike', mine: false, n: 8 });
      out.strike = !!W.PLAYER.ach.strike5;
      W.V.playing = false;
      // levels and rewards: enough XP for level 10 -> the Rotbart skin is owned
      W.PLAYER.xp = 1700; R = W.profMatchEnd(M({ won: false, k: 0 }));
      out.lv10 = [R.lv1.L, R.lvUp.includes(10), W.profOwns('v1'), W.profOwns('v2')];
      // shop: too poor, then buy and equip; a locked level item cannot be bought
      W.PLAYER.gems = 50; out.poor = W.profBuy('goat');
      W.PLAYER.gems = 500; out.buy = [W.profBuy('goat'), W.PLAYER.gems, W.profEquip('goat'), W.PLAYER.av, W.profBuy('berserkerCrown')];
      out.equipSkin = [W.profEquip('v1'), W.PLAYER.sk.viking, W.profEquip('v3'), W.PLAYER.sk.viking];
      // public info and how others read it back
      const pub = W.profPublic(), peer = W.profPeer(pub);
      out.pub = [pub.l, peer.lv, peer.av, peer.sk.viking, peer.sk.rentner];
      out.badPeer = [W.profPeer({ n: 99999 }), W.profPeer({ n: 1210, a: 999, l: 77, s: [5, 1] })]; // skins of the wrong faction fall back to Klassisch
      // broken or edited data is cleaned
      const c = W.profClean({ xp: -5, gems: 'x', nm: 999, av: 'nope', sk: { viking: 'r1' }, own: { hack: 1, goat: 1 }, ach: { firstWin: 1, fake: 1 }, st: { kills: 1e12 } });
      out.clean = [c.xp, c.gems, c.nm, c.av, c.sk.viking, Object.keys(c.own), Object.keys(c.ach), c.st.kills];
      // skins on the battlefield: only the matching faction
      W.setSkins(['viking', 'rentner'], ['v1', 'v2']);
      out.skins = Object.fromEntries(Object.entries(W.UNIT_SKIN).map(([k, v]) => [k, v.id]));
      return out;
    }""")
    print(json.dumps(r))
    peer = r['badPeer'][1]
    ok = (r['first'] == [100, 2, True, 20, 25 + 20] and r['loss'][0] == 75 and r['loss'][1:] == [0, 1]
          and r['streak'] == [3, True, True, True] and r['dailyOnce'] == 0 and r['fortressBlitz'] == [True, True] and r['strike']
          and r['lv10'][0] == 10 and r['lv10'][1] and r['lv10'][2] and not r['lv10'][3]
          and r['poor'] is False and r['buy'][0] is True and r['buy'][1] == 420 and r['buy'][2] is True and r['buy'][3] == 'goat' and r['buy'][4] is False
          and r['equipSkin'] == [True, 'v1', False, 'v1'] and r['pub'] == [10, 10, 'goat', 'v1', 'r0']
          and r['badPeer'][0] is None and peer['lv'] == 30 and peer['av'] == 'opa' and peer['sk']['viking'] == 'v0' and peer['sk']['rentner'] == 'r0'
          and r['clean'][:5] == [0, 0, 23, r['clean'][3], 'v0'] and r['clean'][5] == ['goat'] and r['clean'][6] == ['firstWin'] and r['clean'][7] == 1e9
          and r['skins'] == {'0': 'v1', '1': 'v1', '4': 'v1', '6': 'v1'} and not errs)
    print('ERRS', errs[:3])
    print('PROFILE', 'OK' if ok else 'FAIL')
    b.close()
