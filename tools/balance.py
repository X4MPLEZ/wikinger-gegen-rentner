# Balance check: the computer plays many matches against itself without rendering – both sides the same AI level, factions alternating,
# all four map types, perks picked at random. Then summarise with tools/balance_report.py.
#   node tools/build.mjs && python3 tools/balance.py 240 tests/out/balance.json [modes=classic,chaos,fog] [lvl=hard]
# 240 matches take about an hour. Caveat: perks that mainly help a human ego warrior (bighead, volley, turbo ...) look weaker than they are.
import os, sys, json, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tests'))
OUT_ARG = os.path.abspath(sys.argv[2])
from harness import *
N = int(sys.argv[1]); OUT = OUT_ARG
MODES = (sys.argv[3] if len(sys.argv) > 3 else 'classic,chaos,fog').split(',')
LVL = sys.argv[4] if len(sys.argv) > 4 else 'hard'
GAME = """(o) => { const W = __wvr; const fog = o.mode === 'fog', chaos = o.mode === 'chaos';
  const facs = o.swap ? ['rentner', 'viking'] : ['viking', 'rentner'];
  const G = W.newGame(facs, o.seed, chaos, { fog }); W.G = G;
  const A = [W.aiNew(o.lvl), W.aiNew(o.lvl)];
  const made = [{}, {}], firstDmg = [-1, -1], hp0 = G.teams.map(t => t.hp); let lastId = G.nextId;
  const curve = []; const pk = [[], []];
  for (let i = 0; i < 20 * 60 * 16 && G.over < 0; i++) {
    for (let t = 0; t < 2; t++) { const T = G.teams[t]; if (T.offer && T.offer.length) { const id = T.offer[Math.floor(Math.random() * T.offer.length)]; W.applyCmd(G, t, { t: 'perk', id }); pk[t].push(id); } }
    G.ai = A[0]; W.aiThink(G, 0); G.ai = A[1]; W.aiThink(G, 1); W.step(G);
    if (G.nextId !== lastId) { for (const u of G.units) if (u.id >= lastId) made[u.team][u.k] = (made[u.team][u.k] || 0) + 1; lastId = G.nextId; }
    for (let t = 0; t < 2; t++) if (firstDmg[t] < 0 && G.teams[t].hp < hp0[t] - 1) firstDmg[t] = Math.round(G.t);
    if (i % 1200 === 0) curve.push([Math.round(G.t), Math.round(G.teams[0].hp), Math.round(G.teams[1].hp), G.units.filter(u => u.team === 0).length, G.units.filter(u => u.team === 1).length, G.flags.filter(f => f.owner === 0).length, G.flags.filter(f => f.owner === 1).length]);
  }
  return { mode: o.mode, map: W.MAP.type, facs, over: G.over, winFac: G.over >= 0 ? facs[G.over] : null, t: Math.round(G.t),
    hp: G.teams.map(t => Math.round(t.hp)), firstDmg, made, pk, st: G.st, curve }; }"""
res = []
t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader']); ctx = b.new_context(viewport={'width': 320, 'height': 240}); ctx.route('**/*', route)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://game.test/'); pg.wait_for_timeout(1500)
    for g in range(N):
        mode = MODES[g % len(MODES)]
        maptype = 1 + (g // len(MODES)) % 4          # 1 Wiesen, 2 Wüste, 3 Arktis, 4 Klippen
        swap = (g // (len(MODES) * 4)) % 2 == 1
        seed = (1000 + g * 7919) * 8 + maptype
        r = pg.evaluate(GAME, {'mode': mode, 'seed': seed, 'swap': swap, 'lvl': LVL})
        r['seed'] = seed; res.append(r)
        if g % 10 == 9:
            json.dump(res, open(OUT, 'w')); print(g + 1, 'games', round(time.time() - t0), 's', flush=True)
    b.close()
json.dump(res, open(OUT, 'w'))
print('done', len(res), 'errs', errs[:3])
