#!/bin/sh
# Build the game, then run the browser tests: one line per test, OK or FAIL with the log to look at.
#   sh tests/run.sh               quick suite (a few minutes)
#   sh tests/run.sh mp            the quick suite plus the online test (starts the local PeerJS and MQTT servers)
#   sh tests/run.sh t_chaos t_ux  only these tests
# Needs node, python3 with playwright (pip install playwright, then: playwright install chromium) and `npm install`.
cd "$(dirname "$0")/.." || exit 1
node tools/build.mjs || exit 1
mkdir -p tests/out
ALL="t_smoke t_hud_layout t_ux t_hero_sim t_fogmode t_fogvision t_perks t_profile t_i18n t_chaos t_knock t_bear t_bug t_auto t_climb t_sfx t_fass t_guide t_wiki t_moves"
MP=0
LIST=""
for a in "$@"; do
  if [ "$a" = mp ]; then MP=1; else LIST="$LIST $a"; fi
done
[ -z "$LIST" ] && LIST="$ALL"
fail=0
run() { # name, command...
  n=$1
  shift
  printf '%-14s ' "$n"
  if timeout 900 "$@" > "tests/out/$n.log" 2>&1 && grep -qE '^[A-Z_0-9]+ OK$' "tests/out/$n.log"; then
    echo OK
  else
    echo "FAIL  (tests/out/$n.log)"
    fail=1
  fi
}
for t in $LIST; do run "$t" python3 "tests/$t.py"; done
if [ "$MP" = 1 ]; then
  node tests/mp/ps.js > tests/out/ps.log 2>&1 &
  P1=$!
  node tests/mp/mq.js > tests/out/mq.log 2>&1 &
  P2=$!
  sleep 2
  run mp_net python3 tests/mp/mp_net.py
  run mp_recon python3 tests/mp/mp_recon.py
  run mp_lobby python3 tests/mp/mp_lobby.py
  kill $P1 $P2 2>/dev/null
fi
exit $fail
