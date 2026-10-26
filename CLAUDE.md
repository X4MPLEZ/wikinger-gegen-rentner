# Rentner gegen Wikinger – guide for AI assistants (and humans)

A 3D real-time strategy game in one web page: two factions (Wikinger / Rentner) fight over flags; every warrior can be taken over
and steered in third person ("Ego-Modus"). Phone and PC, against the computer or online for two. Three.js r128, no framework, no bundler.
**Player-facing text is written in German inside `TR('…')` and translated into 14 languages (`src/lang/`). Code and comments are English.**

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
6. **Every new player-facing text goes through `TR()`.** Write the German text as a string literal: `TR('Noch {0} s', n)` (placeholders
   `{0}`…, never build sentences from pieces). Markup in src/body.html is translated automatically at start (text, `title`, `placeholder`,
   `aria-label`; `data-l` for elements with inner markup). Then add the translation to every `src/lang/<code>.json`:
   `python3 tools/i18n.py` lists what is missing, unused or has broken placeholders/tags (a missing text falls back to English, then German).
   Numbers with decimals: `numL(v)`. Check long languages (ru, pl, fr, de) and CJK on a phone: `index.html?lang=ru`.

## Commands

| What | Command |
| --- | --- |
| Build `index.html` (+ `dist/body.html` for tests) | `node tools/build.mjs` |
| Translations: what is missing / broken | `python3 tools/i18n.py` (`--keys F` writes all German texts to F) |
| Upload package for game portals (CrazyGames, itch.io) | `node tools/portal.mjs` → `dist/portal/` + `dist/rentner-gegen-wikinger.zip` |
| Quick test suite | `sh tests/run.sh` |
| Single test | `sh tests/run.sh t_chaos` or `python3 tests/t_chaos.py` (after a build) |
| Online test (starts local PeerJS + MQTT servers) | `sh tests/run.sh mp` |
| Format | `npx prettier --write src/js/*.js src/style.css` |
| Play locally | open `index.html` in a browser (three.js comes from cdnjs); another language: `index.html?lang=en` |
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
src/lang/<code>.json  translations { "German text": "translation" } (en es fr it pt pl tr ru nl id ja ko zh), embedded by the build
src/assets/sounds.b64.txt   CC0 foley samples (one MP3, base64), embedded as <script id="sndData">
models/             face detector weights (loaded on demand)
tools/build.mjs     the build
tools/i18n.py       translation check; tools/portal.mjs  portal package (all files local, no own fullscreen button, no photo sending)
tests/              browser tests (Playwright, Python) – see "Testing"
```

## File map (src/js)

Every file starts with a short header comment saying what is in it.

| File | What | Main entry points |
| --- | --- | --- |
| 00-core | helpers | `$`, `$$`, `clamp`, `lerp`, `now`, `rng(seed)`, `store` (localStorage) |
| 00-i18n | languages: picks the language, translates texts and the page | `TR(text, ...args)`, `numL`, `LANG`, `LANGS`, `i18nDom` |
| 01-icons | SVG icon set | `si(name)`, `siCanvas` |
| 02-data | **all game data and balance** | `KINDS`, `FAC`, `CFG`, `PERKS`, `TIERS` |
| 03-map | map generation, terrain, pathfinding, body physics | `genMap`, `setMap`, `groundY`, `walkable`, `findPath`, `startAir`, `advanceGround` |
| 10-sim | simulation core | `newGame`, `applyCmd` (every command), `hit`, `knockFly`, `possStep` (ego input), `possAttack`, `possSpecial` |
| 11-sim-hero | "Den Helden spielen" (any warrior sacrifices himself on a sandworm; two scripts per kind in `HERO_S`/`HERO_SET`) | `heroWorm`, `heroStart`, `heroStep`, `HERO_S` |
| 12-sim-worms | sandworms, bears, jump pads, ice | `wildWormStep`, `wormUnitStep`, `tameBearStep`, `padStep`, `iceStep` |
| 13-sim-hazards | bowling bodies, rolling boulders, cream puddles | `bowlStep`, `rollStep`, `gooStep` |
| 14-sim-step | **the tick** and the snapshot; map events | `step(G)`, `snapOf(G)`, `worldStep`, `startEvent` |
| 15-ai | computer opponent (levels: Einfach, Mittel, Schwer, Extrem, Killer) | `aiThink`, `aiRecruit`, `aiPossess`, `AI_LVL` |
| 16-sim-fass-falle | Feuerfass (fuse, blast, dud, into the catapult) and Fallenleger (row of trap jaws, thrown bear traps); burning (panic, into the water) and being caught | `FASS`, `TRAP`, `FANG`, `blast`, `fassLoad`, `fangLine`, `fangPts`, `trapPlace`, `layTrap`, `trapStep`, `burnPanic`, `wetNear`, `specStep` |
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
| 53-guide | first steps: the checklist card of a new player's first matches (pulsing buttons, an arrow over the flag), the one-time tutorial offer | `GUIDE`, `guideStart`, `guideTick`, `guideOffer` |
| 60-modes | match setup, sim loop, commands, end screen | `playAi`, `beginMatch`, `startSim`, `sendCmd`, `endGame`, `G`, `NET` |
| 61-net | online: transports, lobby, host/guest sync, rematch | `openMulti`, `hostOnline`, `joinOnline`, `hostReadGuest`, `hostBroadcast`, `NET_VER` |
| 62-screens | menus, pause, settings, quit, bug report (FormSubmit) | `showScreen`, `toMenu`, `quitMatch`, `menuScene`, `bugOpen` |
| 63-tutorial | tutorial and Profi tutorial | `tutSteps`, `startTutorial`, `tutBlock` |
| 64-lobby | public games: list „Offene Spiele“, „Schnelles Spiel“, practising while waiting | `LOBBY`, `lobbyWatch`, `lobbyValid`, `lobbyHostStart`, `quickMatch` |
| 65-profile | the player's profile: levels (Ruhmespfad), achievements, daily quests, Juwelen, pictures, skins, statistics, transfer code, god mode | `PLAYER`, `ACH`, `DQ_POOL`, `AVATARS`, `SKINS`, `LEVEL_REWARDS`, `profMatchEnd`, `profEvent`, `profPending`, `profClaim`, `setSkins`, `avatarURL`, `godSet` |
| 65a-avatar-pics | the hand-made profile pictures (data URLs by avatar id) | `AV_PIC` |
| 66-profile-ui | profile page (home button, Ruhmespfad track, daily quests, collection with preview sheet), menu chip, end-screen rewards, VS card | `profOpen`, `profUi`, `profSheet`, `profCollect`, `gemFly`, `profEndUi`, `vsCard` |
| 67-showcase | 3D showcase in the profile and the wiki: a second small renderer drawing a squad or one unit (scaled with `sc`; a sandworm stands up out of its hole), still pictures of skins and of a kind (the wiki's catapults) | `showMount`, `showSet`, `showTick`, `skinThumb`, `unitThumb` |
| 68-wiki | the wiki: per warrior a story, how he fights, numbers read from `KINDS`/`FASS`/`TRAP`, strong/weak faces, tips, the 3D showcase; a rules page; opens from menu, online wait, lobby, pause | `WIKI`, `wikiOpen`, `wikiText`, `WIKI_VS`, `wikiUi` |
| 70-world-view | bears, holes, pads, pickups, fog of war (client) | `updateWorld`, `itemMesh`, `fogVis`, `fogSeen`, `fogWallTick` |
| 71-worm-view | wild sandworms on screen, sounds, victims | `wormWorldView`, `grabTick` |
| 72-hero-view | the hero sequence on screen | `heroTick`, `heroCam` |
| 73-deaths | death animations, ghosts | `startDeath`, `deathTick` |
| 74-fog-guides | flag/base markers, own silhouettes, watch fires, lanterns, enemy footprints in the sand | `fogGuidesTick`, `fogFeetTick` |
| 75-fass-falle-view | explosions, lit fuses, burning warriors (screams, splash), bear traps (thrown in an arc, the aim ring), the row of trap jaws, the loaded catapult and the barrel flight (camera), chicken dives | `boomTick`, `trapTick`, `trapAimTick`, `fangFx`, `fangTick`, `fassFly`, `fassCamTick`, `egoLoad` |
| 80-animation | procedural poses | `humanRig`, `animateRig` |
| 81-quality | graphics quality levels, auto-quality, profiler | `QS`, `perfTick`, `applyQuality` |
| 82-frame | **the frame loop** | `frame`, `renderUnits` |
| 83-post | post effects of the tier „Sehr hoch“ (WebGL2): ambient occlusion, a cheap steady depth of field (quarter-resolution box-filtered copy, off with `SET.gfxDof`), glow, grading | `postSet`, `postRender`, `POST` |
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
  7 Torten-Katapult, 8/9 Eisbär, 10/11 Sandwurm, 12 Feuerfass, 13 Fallenleger. Wikinger = kinds [0, 1, 4, 12, 6], Rentner = [2, 3, 5, 13, 7]
  (`FAC[...].kinds`, in the order of the recruit bar).
  Roles: melee, ranged, cav, siege (12 and 13 are melee with `spec` 'bomb' / 'trap'). Kinds in the queue strings `q`/`au` are base 36.
- `V` – the view: `V.latest` (newest snapshot), `V.units` (Map id → view), `V.poss` (the warrior you steer), `V.myTeam`, `V.mode`
  ('menu' | 'ai' | 'host' | 'guest').
- `CFG` – balance numbers; `PERKS` – chaos perks; `pk(G, team, id, [off, on])` reads a perk effect.
- `PLAYER` – the local profile (store `wvr-prof`, always passed through `profClean`): name index, avatar, xp, gems, owned and equipped
  items, achievements, statistics. Online the presence carries `profPublic()`; the other side reads it with `profPeer()` → `V.oppPf`.
- `NET.pub` – a public match (from the lobby list or quick match): no photos, only made-up names; `NET.practice` – the host practises
  against the computer while his lobby entry waits.

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
- **Look:** soft toon ramp (`drawRamp`, 21-scene), figures with rim light and sheen (`figMat`/`FIG`); unit geometries get more segments
  while a full model is built (`withHiPoly`, 24-unit-models) and fewer for the low-detail model (`withLowPoly`) – the two stay paired.
  Graphics tiers in `GTIERS` + `ULTRA` (81-quality); `QS.ultra` switches the post effects (83-post.js) – never chosen by AUTO.
- **UI design ("Comic Pop"):** the last section of src/style.css is a design layer that restyles every control: paper surfaces
  (`--paper`), ink outlines and hard offset shadows (`--ink2`), skewed boxes on `::before` (text stays upright – keep the pseudo inside
  the layout box, `inset: 0 3px`, or fitText shrinks labels), halftone dots (`--dots`). Paper containers (`.card`, `.ppage`, `.pscard`,
  `.tut-card`) re-scope `--text/--dim/--panel/--line`, so anything inside turns dark on light without new rules; dark islands (`.psstage`,
  `.pcard`, `.mcard`) scope them back. HUD information stays dark glass, HUD controls are paper. Icons use `currentColor`.
- **Overlay sprites:** every `THREE.Sprite` is registered in `SPRITES` (21-scene). With the post effects, sprites without depth test
  (words, speech bubbles, badges) go to camera layer 1 and are drawn after the depth of field; lights are on both layers.
- **Collision at forests/rocks:** the 1.5 m grid is for paths; `walkableIn` also tests exact circles (`m.obsL`) in cells closed only by a
  blocker, so you can walk up to the trunks. Changing it changes the simulation: bump `NET_VER`.
- **Skins** are colour swaps plus extra pieces applied while a unit model is built: `setSkins()` fills `UNIT_SKIN[k]`, `buildUnit` →
  `buildSkinned(k, id)` sets `LAM_MAP` (so `lam(color)` returns the swapped colour) and `SKIN_NOW` (so `skinExtras()` in 25-worm-model
  adds capes, crowns, glasses …); caches of built models key on the skin. Extras must not use randomness (the low-detail model is built
  the same way and its parts are paired by order). Both players see each other's skins.
- **Melee combos** (ego, melee and riders): the client counts the step and sends it as `cb` in the input packet; the host accepts it
  only within the combo window (`CMB` in 02-data, `possAttack` in 10-sim). The own blow is drawn locally at once (`egoStrike` in 51-ego:
  pose, cartoon slash `slashFx`, hit stop, impact star); `meleeSwing` (80-animation) blends from the previous pose into the next blow.
- **Den Helden spielen:** a script (`HERO_S`: hits, gulp, inner hits, end; per kind two in `HERO_SET`) drives the host's damage, the
  worm's pose (`heroWormPose(st, t, o, S)`) and the view (72-hero-view: climb, rodeo, pogo, fling in slow motion, ramp with the mount
  eaten first, riders' mount split off with `heroSplit`). The hero always dies; a worm he beats holds out at 1 hp (`heroBeat`) until then.
- **Melee moves** (80-animation `CPOSE`): per kind a list of moves (`n` ordinary, `a` computer only, `f` finisher with `spin`/`jump`, `W`
  wind-up, `sl` slash shape); `comboSeq` picks a steered warrior's three, `pickAv` a computer warrior's; the arm waits raised (`avN`).
- **Hühnerarmee** (perk `hens`): the chickens are units of the faction's melee kind with `u.hen` (see `HEN` in 02-data): not counted in
  `popOf`, no kill gold, no kill feed; taken over it pecks and flies (`HFLY` in 02-data: hold the special to rise, let go to sink, attack in
  the air dives; the client sends the height as `fh`/`dv` in the input packet, the host caps the climb; others see it via snapshot `hf`; up
  in the air no melee reaches it, `aloft(u)`); snapshot flag bit 32768 (drawn as a chicken with a team scarf, one merged mesh).
- **Feuerfass / Fallenleger** (16-sim-fass-falle, 75-fass-falle-view): the Feuerfass carries the barrel on his left shoulder and a torch
  in the right hand (`u.barrel`, `u.torchFlame`), a smoking keg as a helmet (`u.hatTip`); every blow of his sets the victim on fire
  (`torchBurn`, from `traitHit`). His barrel goes off only when a player lit it (ego special) – the computer never lights it; a headshot
  (`hit(..., head)`) kills him at once and blasts for the shooter (`u.headBoom`, `fassDuds`). The Fallenleger's attack (AI and ego) is
  `fangLine`: a row of trap jaws (`FANG`, points from `fangPts`, the same on host and screens) bites one after another in `fangStep` – each
  enemy once per row, held a moment (`u.trapT` with `trapId` 0 = snapshot bit 2097152; riders longer); a steered one counters riders
  softly (`fangNow` in `hit`). His special `trapPlace` throws the trap to the aim point (`In.gp`, at most `TRAP.throw` m) and picks up
  an armed one lying out there (re-placed; at most one armed trap per Fallenleger). A trap catches everyone in `TRAP.r` (up to
  `TRAP.max`, `t.vs`), bites once and grinds on (`TRAP.dps`). Burning warriors that are not steered panic (`burnPanic`): they run to
  water they reach before the fire is out (`burnWater`: rays over walkable ground, at most `FASS.wet` m) and run on until they jump in
  from the bank (`wetNear`: within `FASS.dip` m, at most `FASS.jump` m above it; the fire goes out, `u.fireImm`), else zigzag. New unit
  states `u.fuse`, `u.burn`, `u.trapT`, `u.trapC`, `u.fass` (a catapult loaded with a barrel) are snapshot flag bits 131072, 65536,
  262144, 1048576, 524288. One-shot impacts (blast, dud, catapult barrel, chicken dive, trap snap, fizzle, loading, a row of jaws) go
  through `xEvent()` (10-sim) into `G.xe` → snapshot `xe`, numbered like `ge`/`kf`; a row adds `[src, yaw*100]` (the striker's own
  screen has drawn it at once and skips it). Traps are snapshot `tr` (with the owner: a new one flies from his hand), warriors gone
  without dying (a barrel climbing into the catapult) `gn`. Command `{t: 'load', id}` puts the steered Feuerfass into an own catapult
  next to it. An enemy trap is drawn barely visible (and never in the fog), an own one clear.
- **Counters** (10-sim `beats`, `dmgMult`): rock-paper-scissors by role, except the Feuerfass: he beats ranged and siege and is beaten by
  riders (archers no longer count as his counter); catapults hit bears hard. Feuerfass and Fallenleger hit bases at full force (like
  catapults). The wiki's strong/weak faces (`WIKI_VS`) must match.
- **Berserker throw / Stockwirbel** (10-sim): the Berserker's special lifts the warrior in front (`u.lift`, `liftStep`, `LIFT`): held over
  his head (snapshot `lf`, drawn lying across by 82-frame, the Berserker's arms up) while he turns to aim, then hurled. The Opa's
  Stockwirbel (`WHIRL`): three turns in `WHIRL.t`, running speed times `WHIRL.speed` on the client meanwhile (`P.whirlT`), the host
  knocks again every `WHIRL.pulse` (`u.spinT`).
- **Trap catch and fire on screen** (75-fass-falle-view): a sprung trap slams, bounces and hops, then rattles; a caught warrior wears its
  jaws on his ankle with a chain to the trap (`trapLegFx`); burning warriors carry flames (`fireCrown`) besides the sparks. When the own
  steered Feuerfass goes off, the camera rises over the blast for a moment before the map view (`boomCamStart`, `boomCamTick`).
- **Weapon slashes** (51-ego `slashFx`): every weapon draws its own slash (`SLASH_STYLE` per kind: axe, cane, torch, electric, claws;
  shader uniform `uStyle`), an enemy's with a red rim; the Fallenleger has none (his jaws are the attack).
- **Ego camera** (51-ego): a spring arm (`egoArm`, `camBlocked`, `camFloor`) pulls the camera in front of hills, rocks and forests (fast in,
  slow out) – it must never sit inside the terrain (enemies behind a mountain showed through). The Fallenleger's spade slam nods the view
  down for a moment (`EG.dip`) so his row of jaws shows over his head.
- **PC controls** (50-input): like a PC strategy game – left click selects, a click into the void deselects, left drag draws a rectangle
  (`rectPts`; touch keeps the lasso), right click orders, `C`/Esc deselect, `Space` is the ego special (the right mouse button never is),
  `F` takes over. `BIND_DEF` are the defaults; `BIND_OLD` (lists of older defaults) migrates stored bindings that still equal one. A tap
  on an own warrior always selects him.
- **First steps** (53-guide): `guideStart()` in `beginMatch` shows the card until every step was done once or it was closed
  (`store 'wvr-guide'`); `guideOffer()` on the first "Los geht's" offers the tutorial once (`'wvr-first'`). The tests' harness sets both
  keys, so no test sees them (tests/t_guide.py removes them). While the card is up the one-line HINTS wait.
- **Edges** (14-sim-step): a walking or charging unit never steps into a fall zone or over a drop of more than 1.2 m – it slides along
  the edge (bridge rail, cliff rim). Only knocks (`kbStep`, `knockFly`) send anyone down.
- **Springs in the poses** (`springStep`, 80-animation) are integrated in small substeps: a big frame step must not blow them up (that
  made bodies jump about in crowds while the feet stayed put).
- **Ruhmespfad** (66-profile-ui): every reward is a card on one horizontal road over a progress bar; touch scrolls natively, the mouse
  drags (with momentum) or uses the wheel, ← → scroll; a tap opens the preview sheet (`profSheet`).
- **Collecting rewards:** nothing is paid out at the end of a match. Level rewards (`PLAYER.lvC` reached, `PLAYER.cl` collected; a level item
  is owned only once collected), master bonuses (`mC`/`mCl`), the Juwelen of daily quests and daily wins (`PLAYER.pq`) and achievements
  (`PLAYER.ach` earned, `PLAYER.ac` collected) wait in the profile: `profPending()` (the red number on the menu chip), `profClaim(c)`;
  the profile's buttons call `profCollect`, Juwelen fly into the counter (`gemFly`). Old saves count as collected (`profClean`).
- **God mode** (`GOD.on`, 65-profile): everything owned, `profSave()` does nothing; for trying out skins, not for players.
- **Strangers:** nothing typed by a player and no photos ever reach another player in a public match; everything received from the
  lobby or a peer is validated (`lobbyValid`, `profPeer`).
- **Portal build:** `window.WVR_PORTAL` (set by tools/portal.mjs) hides the own fullscreen button and photo sending; `window.WVR_LIBS`
  points PeerJS / MQTT / face-api to local copies (`WVR_LIB(name)` in 61-net).
- **Debugging:** in the browser console `__wvr.G`, `__wvr.V`, `__wvr.step(__wvr.G)` … (99-boot.js lists everything exported).

## Recipes

- **Balance** (hp, damage, speed, cost, ranges, timings): `KINDS` / `CFG` in 02-data.js (special recharge per kind: `SP_CD` / `spCdOf`). Perk numbers: where `pk(G, team, 'id', [a, b])` is used.
- **New unit special:** sim effect in `possSpecial` (10-sim); client prediction/effects in `egoSpecial` (51-ego); AI use in 15-ai; label
  `KINDS[k].sp`.
- **New perk:** entry in `PERKS` (02-data: `t` tier 0-3, `f` faction-only, `ic` icon, `n`/`d` German name/description) + the effect where it
  applies via `pk()` / `pkL()`.
- **New snapshot field:** add it in `snapOf()` (14-sim-step, round numbers), read it from `V.latest` in the view, bump `NET_VER`.
- **New sound:** add a synth function to `LIB` in 30-sound.js, play it with `SFX.play('name', { x, z })` (positional) or without x/z.
- **New HUD element:** markup in src/body.html, style in src/style.css (+ landscape/portrait rules), update in `updateHud()`.
- **New setting kept per device:** `store.get('wvr-…')` / `store.set('wvr-…', v)`.
- **New wiki entry** (a new kind): texts in `wikiText(k)`, strong/weak in `WIKI_VS`, the tab from `FAC[...].kinds` (68-wiki) + translations.
- **New achievement:** entry in `ACH` (65-profile: id, icon, gems, German name/description, a test on the match-end record or a live
  event from `profEvent`) + translations. **New daily quest:** entry in `DQ_POOL` (goal, gems, what one match adds).
- **New picture / skin:** `AVATARS` / `SKINS` (colour swaps `sw`, unlock `u`: `lv` or `gems`, never both) + its pieces in `skinExtras`
  (25-worm-model); look at it with `?gott=1` in the profile's collection.
- **New language:** add it to `LANGS` (00-i18n), create `src/lang/<code>.json` from `python3 tools/i18n.py --keys keys.json`, look at
  the menu, HUD and profile in both phone orientations.

## Testing

- `tests/harness.py` serves `dist/body.html` at `http://game.test/` with three.js from node_modules; all other requests are blocked.
  Tests run in German (`window.WVR_LANG = 'de'`), so they can look for German texts.
- A test is a Python script that drives the page and reads internals via `__wvr`, then prints `NAME OK` or `NAME FAIL` as its last line.
  Pattern: copy a small one (`t_chaos.py` for pure simulation checks with `__wvr.newGame` + `__wvr.step`, `t_ux.py` for UI flows).
- Simulation tests do not need rendering: build a state with `W.newGame([...], seed, chaos, {squad: false})`, place units, call `W.step(G)`.
- Screenshots and logs land in `tests/out/`. Look at screenshots for visual changes (and at both phone orientations).
- `tests/t_i18n.py` checks the languages (complete files with intact placeholders, no German left in English/Russian/Japanese, long
  labels fit); `tests/t_profile.py` the profile (levels, achievements, shop, skins, broken saves); `tests/mp/mp_lobby.py` the lobby list,
  quick match, practising while waiting, skins/VS card online and the transfer code.
- `tests/t_bear.py`: a polar bear shot from afar charges the shooter (`b.foe`, `BEAR_GRUDGE` in 10-sim).
- `tests/t_bug.py`: the bug report form posts text, device info and the screenshot to FormSubmit (the request is caught in the test); the
  game's picture is copied right after a frame is drawn (`BUG.grab` → `bugGrab()` in 82-frame), a picked picture is re-encoded small.
- `tests/t_fass.py`: Feuerfass blast/dud/catapult shot (never lit by the computer), the torch, burning warriors running into water, the
  bear trap (holds, bites, lets go, new trap, several at once, the computer throws it), the flying chicken, the row of trap jaws (once per
  enemy, held, riders longer, the steered one), the thrown and re-placed trap, the headshot on a Feuerfass.
- `tests/t_moves.py`: the Berserker's lift and throw, the Stockwirbel's later turns, the counters (`dmgMult`).
- `tests/t_wiki.py`: the wiki from the menu and the pause menu, tabs, a warrior's page, jumping via the strong/weak faces, the wait button,
  English without German left.
- `tests/t_guide.py`: the tutorial offer and the first-steps card step by step; mouse rectangle selection, click into the void, C, F, Space.
- `tests/mp/mp_net.py` plays two pages against each other over local PeerJS/MQTT servers (quit, line drop, rejoin);
  `tests/mp/mp_recon.py` checks the ego movement online (no pull-backs on a clear walk or after a lag burst, knock-downs, a speed cheat).

## Release (maintainer's workflow)

Build → `sh tests/run.sh` → commit (source and the generated `index.html` together) → push to `main` (GitHub Pages serves `index.html`).
For the game portals: `node tools/portal.mjs` and upload `dist/rentner-gegen-wikinger.zip`.
