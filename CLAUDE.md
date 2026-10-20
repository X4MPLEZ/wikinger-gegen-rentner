# Rentner gegen Wikinger – guide for AI assistants (and humans)

A 3D real-time strategy game in one web page: two factions (Wikinger / Rentner) fight over flags; every warrior can be taken over
and steered in third person ("Ego-Modus"). Phone and PC, against the computer or online for two. Three.js r128, no framework, no bundler.
**All player-facing text is German. Code and comments are English.**

## Golden rules (read these, they save the most time)

1. **Edit `src/`, never `index.html`.** `index.html` is generated: `node tools/build.mjs` (also checks syntax and name clashes).
2. **One shared scope.** Every file in `src/js/` is concatenated in file-name order into `(() => { 'use strict'; ... })()`.
   There are no imports: a top-level name in one file is visible in all others. Names must be unique (the build refuses a second
   top-level `function` with a taken name; a second `const`/`let` is a syntax error). Before adding a top-level name, grep for it.
   A top-level `const` that is *used while the page loads* must live in an earlier file than its user (functions are hoisted).
3. **Host-authoritative.** The simulation (`10-`..`15-*.js`) runs only on the host / in single player. A guest only draws snapshots.
   Anything a guest must see has to go into `snapOf()` (14-sim-step.js). Changing the shape of snapshots, commands or presence:
   bump `NET_VER` in 61-net.js (two versions then refuse to play together instead of breaking).
4. **Small, local edits.** Find the place with the file map below and `grep -n`, read only that region, change it. Keep the style
   (prettier: `npx prettier --write src/js/*.js src/style.css`, printWidth 140, single quotes).
5. **Test before you ship:** `sh tests/run.sh` (a few minutes). Online changes: `sh tests/run.sh mp`.

## Commands

| What | Command |
| --- | --- |
| Build `index.html` (+ `dist/body.html` for tests) | `node tools/build.mjs` |
| Quick test suite | `sh tests/run.sh` |
| Single test | `sh tests/run.sh t_chaos` or `python3 tests/t_chaos.py` (after a build) |
| Online test (starts local PeerJS + MQTT servers) | `sh tests/run.sh mp` |
| Format | `npx prettier --write src/js/*.js src/style.css` |
| Play locally | open `index.html` in a browser (three.js comes from cdnjs) |
| Profiler overlay | `index.html?perf=1` or F9 |
| Balance check (computer vs computer, ~1 h for 240 matches) | `python3 tools/balance.py 240 tests/out/balance.json` then `python3 tools/balance_report.py tests/out/balance.json` |

Setup once: `npm install`, `pip install playwright`, `playwright install chromium`.

## Layout

```
index.html          generated page (GitHub Pages serves it) – do not edit
src/head.html       <head>: title, meta, fonts
src/body.html       all HUD / menu markup (DOM, ids used by the JS)
src/style.css       all styles (mobile first; landscape phones: @media (orientation: landscape) and (max-height: 600px))
src/js/NN-*.js      the game, concatenated in name order (see file map)
src/assets/sounds.b64.txt   CC0 foley samples (one MP3, base64), embedded as <script id="sndData">
models/             face detector weights (loaded on demand)
tools/build.mjs     the build
tests/              browser tests (Playwright, Python) – see "Testing"
```

## File map (src/js)

Every file starts with a short header comment saying what is in it.

| File | What | Main entry points |
| --- | --- | --- |
| 00-core | helpers | `$`, `$$`, `clamp`, `lerp`, `now`, `rng(seed)`, `store` (localStorage) |
| 01-icons | SVG icon set | `si(name)`, `siCanvas` |
| 02-data | **all game data and balance** | `KINDS`, `FAC`, `CFG`, `PERKS`, `TIERS` |
| 03-map | map generation, terrain, pathfinding, body physics | `genMap`, `setMap`, `groundY`, `walkable`, `findPath`, `startAir`, `advanceGround` |
| 10-sim | simulation core | `newGame`, `applyCmd` (every command), `hit`, `knockFly`, `possStep` (ego input), `possAttack`, `possSpecial` |
| 11-sim-hero | "Den Helden spielen" (jump onto a sandworm) | `heroWorm`, `heroStart`, `heroStep` |
| 12-sim-worms | sandworms, bears, jump pads, ice | `wildWormStep`, `wormUnitStep`, `tameBearStep`, `padStep`, `iceStep` |
| 13-sim-hazards | bowling bodies, rolling boulders, cream puddles | `bowlStep`, `rollStep`, `gooStep` |
| 14-sim-step | **the tick** and the snapshot; map events | `step(G)`, `snapOf(G)`, `worldStep`, `startEvent` |
| 15-ai | computer opponent | `aiThink`, `aiRecruit`, `aiPossess`, `AI_LVL` |
| 20-textures | canvas textures | `cnv`, `portrait`, `flagCanvas` |
| 21-scene | renderer, camera, lights, materials, fog shader, outlines | `lam(color)` (cached!), `fogInject`, `inkify`, `mesh` |
| 22-map-view | terrain, water, trees, flags | `buildMapView` |
| 23-bases-view | the two bases | `buildBases` |
| 24-unit-models | unit models, instanced drawing of all units | `buildUnit` (in 25), `ubRegister`, `unitBatch` |
| 25-worm-model | sandworm model and poses | `buildWorm`, `wormRig`, `buildUnit` |
| 26-icons-effects | recruit icons, particle puffs | `unitIcon`, `puff`, `emitFX` |
| 27-sand | sand grains, ridges, water ripples, floating words, projectiles | `sandBurst`, `word`, `shoot` |
| 30-sound | synthesised sound (WebAudio) | `SFX.play(name, {x, z, vol})`, `SFX.loop(kind)`, `SFX.music(on)` (disco dance only) |
| 31-faces | player photo on the units' heads | `setMyFace`, `setFaceMat` |
| 40-view | client view state, snapshot buffer, events | `V`, `pushSnap`, `processSnap`, `resetView`, `disposeTree` |
| 41-view-moments | banners, phase moments, siege warnings, shake, ragdolls | `hlPush`, `siegeWarnTick`, `shake` |
| 42-view-world-fx | perks UI, boulders, puddles, fireballs, base fall, status effects, grenades | `perkUi`, `updateGoo`, `updateGrenades`, `updateFlag` |
| 50-input | commander camera, mouse/touch, key bindings, small map | `camS`, `tapAt`, `commandAt`, `BIND`, `toScreen`, `drawMini` |
| 51-ego | ego mode: prediction, input packet, attacks, aiming, ego camera | `enterEgo`, `exitEgo`, `egoUpdate`, `egoAttack`, `egoSpecial` |
| 52-hud | HUD numbers, spawn buttons, chips, kill feed position, tips | `updateHud`, `toast`, `HINTS`, `killFeedTop` |
| 60-modes | match setup, sim loop, commands, end screen | `playAi`, `beginMatch`, `startSim`, `sendCmd`, `endGame`, `G`, `NET` |
| 61-net | online: transports, lobby, host/guest sync, rematch | `openMulti`, `hostOnline`, `joinOnline`, `hostReadGuest`, `hostBroadcast`, `NET_VER` |
| 62-screens | menus, pause, settings, quit | `showScreen`, `toMenu`, `quitMatch`, `menuScene` |
| 63-tutorial | tutorial and Profi tutorial | `tutSteps`, `startTutorial`, `tutBlock` |
| 70-world-view | bears, holes, pads, pickups, fog of war (client) | `updateWorld`, `itemMesh`, `fogVis`, `fogSeen`, `fogWallTick` |
| 71-worm-view | wild sandworms on screen, sounds, victims | `wormWorldView`, `grabTick` |
| 72-hero-view | the hero sequence on screen | `heroTick`, `heroCam` |
| 73-deaths | death animations, ghosts | `startDeath`, `deathTick` |
| 74-fog-guides | flag/base markers and own silhouettes in the fog | `fogGuidesTick` |
| 80-animation | procedural poses | `humanRig`, `animateRig` |
| 81-quality | graphics quality levels, auto-quality, profiler | `QS`, `perfTick`, `applyQuality` |
| 82-frame | **the frame loop** | `frame`, `renderUnits` |
| 99-boot | start; `window.__wvr` (internals for tests) | – |

## How it runs

- **Tick (host / single player):** `startSim()` (60-modes) runs a fixed-step loop: every `DT` = 0.05 s → `aiThink(G, 1)` (vs computer),
  `hostReadGuest()` (online), `step(G)`. After the steps `snapOf(G)` → `pushSnap()` locally; online `hostBroadcast()` sends it every 66 ms.
- **Frame (everyone):** `frame()` (82-frame) → `renderUnits()` interpolates between buffered snapshots (`V.buf`) and calls `processSnap()`
  once per new snapshot (one-shot events: hits, deaths, banners) → the view ticks (world, worms, hero, fog, HUD, sound) → render.
- **Commands:** commander input (50-input) → `sendCmd({t: 'order' | 'spawn' | 'auto' | 'rally' | 'perk' | 'poss' | 'unposs', ...})`
  → `applyCmd(G, team, c)` (10-sim). Online the guest numbers its commands (`s`) and resends them until the host acks them.
- **Ego mode:** `egoUpdate()` (51-ego) predicts the movement locally and sends an input packet every frame (`{id, n, x, z, y, a, s, j, g, h, ...}`;
  `n` is the packet number, `a s j g h` are press counters for attack, special, jump, grenade, hero) → host `possStep()` (10-sim) validates
  and applies it (position taken as sent, at most `EGO_MAX_V`). The snapshot answers with the last applied packet number (`ia`); the
  guest compares the host's position with what it sent in that packet and only corrects itself for a real disagreement (never for lag).
- **The AI** plays through the same `applyCmd` and posIn input packets as a human.

## Key state

- `G` – the game state (sim): `G.units[]` `{id, k, team, x, z, hp, poss, ...}`, `G.bears[]` (wild bears and sandworms), `G.teams[0|1]`
  `{fac, gold, q (queue), pos (possessed id), pk (perks), ...}`, `G.flags[]`, `G.t`, `G.phase`, `G.over` (-1 running, else winner).
- `KINDS[k]`: 0 Berserker, 1 Bogenschützin, 2 Krückstock-Opa, 3 Gebiss-Oma, 4 Ziegenreiter, 5 E-Mobil-Raser, 6 Wikinger-Katapult,
  7 Torten-Katapult, 8/9 Eisbär, 10/11 Sandwurm. Wikinger = kinds [0, 1, 4, 6], Rentner = [2, 3, 5, 7]. Roles: melee, ranged, cav, siege.
- `V` – the view: `V.latest` (newest snapshot), `V.units` (Map id → view), `V.poss` (the warrior you steer), `V.myTeam`, `V.mode`
  ('menu' | 'ai' | 'host' | 'guest').
- `CFG` – balance numbers; `PERKS` – chaos perks; `pk(G, team, id, [off, on])` reads a perk effect.

## Conventions and pitfalls

- **Materials:** `lam(color)` is cached and shared – never dispose it. Throw-away objects (pickups, grenades, puddles) are freed with
  `disposeTree()` (40-view), which skips shared things; mark your own shared materials/geometries `userData.shared = true`.
- **Fog:** every material gets the fog shader automatically (`Material.prototype.onBeforeCompile` in 21-scene). Markers that must show
  through the fog use `fog: false`. In fog mode hide enemy info unless `fogSeen(x, z)`. Who sees how far is `FOG_SIGHT` (02-data):
  the player's clearings (`fogSources`, 70-world-view) and the computer's knowledge (`aiVision` / `aiKnownFoes`, 15-ai) both read it,
  so a change there changes both sides alike.
- **HUD writes:** use `txt()`, `hid()`, `sty()` (52-hud) – they only touch the DOM when the value changes (weak phones).
- **Client randomness:** visuals both players should see the same (e.g. puddle decoration) use `rng(seed)` from snapshot data.
- **Mobile first:** check portrait 390×844 and landscape 844×390 (`tests/t_hud_layout.py` asserts that HUD parts do not overlap).
- **German wording:** "Discogranate", "Sammelfahne", "Basisschaden", "Ego-Krieger", "Den Helden spielen", "Aufgeben".
- **Debugging:** in the browser console `__wvr.G`, `__wvr.V`, `__wvr.step(__wvr.G)` … (99-boot.js lists everything exported).

## Recipes

- **Balance** (hp, damage, speed, cost, ranges, timings): `KINDS` / `CFG` in 02-data.js. Perk numbers: where `pk(G, team, 'id', [a, b])` is used.
- **New unit special:** sim effect in `possSpecial` (10-sim); client prediction/effects in `egoSpecial` (51-ego); AI use in 15-ai; label
  `KINDS[k].sp`.
- **New perk:** entry in `PERKS` (02-data: `t` tier 0-3, `f` faction-only, `ic` icon, `n`/`d` German name/description) + the effect where it
  applies via `pk()` / `pkL()`.
- **New snapshot field:** add it in `snapOf()` (14-sim-step, round numbers), read it from `V.latest` in the view, bump `NET_VER`.
- **New sound:** add a synth function to `LIB` in 30-sound.js, play it with `SFX.play('name', { x, z })` (positional) or without x/z.
- **New HUD element:** markup in src/body.html, style in src/style.css (+ landscape/portrait rules), update in `updateHud()`.
- **New setting kept per device:** `store.get('wvr-…')` / `store.set('wvr-…', v)`.

## Testing

- `tests/harness.py` serves `dist/body.html` at `http://game.test/` with three.js from node_modules; all other requests are blocked.
- A test is a Python script that drives the page and reads internals via `__wvr`, then prints `NAME OK` or `NAME FAIL` as its last line.
  Pattern: copy a small one (`t_chaos.py` for pure simulation checks with `__wvr.newGame` + `__wvr.step`, `t_ux.py` for UI flows).
- Simulation tests do not need rendering: build a state with `W.newGame([...], seed, chaos, {squad: false})`, place units, call `W.step(G)`.
- Screenshots and logs land in `tests/out/`. Look at screenshots for visual changes (and at both phone orientations).
- `tests/mp/mp_net.py` plays two pages against each other over local PeerJS/MQTT servers (quit, line drop, rejoin);
  `tests/mp/mp_recon.py` checks the ego movement online (no pull-backs on a clear walk or after a lag burst, knock-downs, a speed cheat).

## Release (maintainer's workflow)

Build → `sh tests/run.sh` → commit (source and the generated `index.html` together) → push to `main` (GitHub Pages serves `index.html`).
