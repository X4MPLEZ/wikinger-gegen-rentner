# Summary of a tools/balance.py run: win rates by mode, map and faction, match length, units trained, perk win rates.
#   python3 tools/balance_report.py tests/out/balance.json
import json, sys, statistics as S
from collections import defaultdict, Counter
r = json.load(open(sys.argv[1]))
KN = ['Berserker','Bogenschützin','Krückstock-Opa','Gebiss-Oma','Ziegenreiter','E-Mobil','W-Katapult','T-Katapult','Bär','Bär','Wurm','Wurm']
def wr(games):
    n = len(games); v = sum(1 for g in games if g['winFac'] == 'viking'); return f"Wikinger {v}/{n} = {100*v/max(1,n):.0f}%"
print('games', len(r), 'unfinished', sum(1 for g in r if g['over'] < 0))
print('\n== win rate by mode');
for m in ['classic', 'chaos', 'fog']:
    g = [x for x in r if x['mode'] == m]
    if g: print(f"{m:8s} {wr(g)}   duration median {S.median([x['t'] for x in g])/60:.1f} min  (p25 {sorted(x['t'] for x in g)[len(g)//4]/60:.1f}, p75 {sorted(x['t'] for x in g)[3*len(g)//4]/60:.1f})  first base hit median {S.median([min([d for d in x['firstDmg'] if d >= 0] or [999]) for x in g])/60:.1f} min")
print('\n== win rate by map (all modes)')
for mp in ['wiesen', 'wueste', 'arktis', 'klippen']:
    g = [x for x in r if x['map'] == mp]
    if g: print(f"{mp:8s} {wr(g)}   duration median {S.median([x['t'] for x in g])/60:.1f} min")
print('\n== by map and mode: viking wins / games')
for mp in ['wiesen', 'wueste', 'arktis', 'klippen']:
    print(f"{mp:8s}", '  '.join(f"{m}: {sum(1 for x in r if x['map']==mp and x['mode']==m and x['winFac']=='viking')}/{sum(1 for x in r if x['map']==mp and x['mode']==m)}" for m in ['classic','chaos','fog']))
print('\n== side (team 0 starts? map symmetry): team 0 wins', sum(1 for x in r if x['over'] == 0), '/', len(r))
print('\n== units trained per game (median) by faction')
for fac, kinds in [('viking', [0, 1, 4, 6]), ('rentner', [2, 3, 5, 7])]:
    cnt = defaultdict(list)
    for x in r:
        t = x['facs'].index(fac)
        for k in kinds: cnt[k].append(x['made'][t].get(str(k), 0))
    print(fac, ', '.join(f"{KN[k]} {S.median(cnt[k]):.0f}" for k in kinds))
print('\n== chaos perks: win rate of the side that took it (vs 50%)')
pw = defaultdict(lambda: [0, 0])
for x in r:
    if x['mode'] != 'chaos' or x['over'] < 0: continue
    for t in (0, 1):
        for p in set(x['pk'][t]):
            pw[p][1] += 1
            if x['over'] == t: pw[p][0] += 1
for p, (w, n) in sorted(pw.items(), key=lambda kv: -kv[1][0] / max(1, kv[1][1])):
    print(f"  {p:10s} {100*w/n:3.0f}%  ({w}/{n})")
print('\n== stats medians (winner vs loser): made, lost, baseDmg, flagT, rams, cliff')
for key in ['made', 'lost', 'baseDmg', 'flagT', 'rams', 'cliff']:
    wv = [x['st'][x['over']][key] for x in r if x['over'] >= 0]; lv = [x['st'][1 - x['over']][key] for x in r if x['over'] >= 0]
    print(f"  {key:8s} winner {S.median(wv):.0f}  loser {S.median(lv):.0f}")
