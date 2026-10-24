/* 65-profile.js - THE PLAYER'S PROFILE. No login: everyone plays as a guest and the profile lives on this device (store 'wvr-prof');
   a transfer code moves it to another device (over the public MQTT brokers, like the lobby). The profile has a name picked from a list
   (no free text: nothing to moderate), a profile picture (AVATARS), the Ruhmespfad (levels from XP with rewards, LEVEL_REWARDS), Juwelen
   (from achievements, levels and the first win of the day; spent on pictures and skins), achievements (ACH), army skins (SKINS: colour swaps
   applied while unit models are built, see buildUnit in 25-worm-model.js) and statistics.
   profMatchEnd() runs once per finished match (endGame), profEvent() for the player's own moments during a match (hlPush, dance, combo).
   Public online games show name, picture and level (lobby entry, presence pf); both players see each other's skin. */
const PROF_NAMES = [
  ['Heinz', 1],
  ['Erna', 2],
  ['Gustav', 1],
  ['Hilde', 2],
  ['Kurt', 1],
  ['Gerda', 2],
  ['Horst', 1],
  ['Trude', 2],
  ['Willi', 1],
  ['Inge', 2],
  ['Egon', 1],
  ['Lotte', 2],
  ['Björn', 0],
  ['Olaf', 0],
  ['Sven', 0],
  ['Ragnar', 0],
  ['Ingrid', 0],
  ['Astrid', 0],
  ['Thorvald', 0],
  ['Sigrid', 0],
  ['Leif', 0],
  ['Freya', 0],
  ['Harald', 0],
  ['Gunnhild', 0],
]; // [name, 1 = Opa, 2 = Oma, 0 = a Viking name]
function profName(nm, nr) {
  const [n, t] = PROF_NAMES[clamp(nm | 0, 0, PROF_NAMES.length - 1)],
    s = n + ' ' + nr;
  return t === 1 ? TR('Opa {0}', s) : t === 2 ? TR('Oma {0}', s) : s;
}
/* Profile pictures: a unit's head (k) on a background (bg) with a decoration (deco). u = how it is unlocked:
   free, lv (Ruhmespfad level), ach (achievement), gems (price in the shop). */
const AVATARS = [
  { id: 'opa', k: 2, bg: ['#d9a3c8', '#6e3a62'], u: { free: 1 } },
  { id: 'berserker', k: 0, bg: ['#9cc4ea', '#2c4f78'], u: { free: 1 } },
  { id: 'oma', k: 3, bg: ['#f1bddc', '#7a3a63'], u: { lv: 2 } },
  { id: 'archer', k: 1, bg: ['#a9d8f0', '#2f6a8a'], u: { lv: 3 } },
  { id: 'goat', k: 4, bg: ['#cfe3c0', '#3d6b3a'], u: { gems: 80 } },
  { id: 'racer', k: 5, bg: ['#f2b1a6', '#8a2f2a'], u: { gems: 80 } },
  { id: 'omaFlower', k: 3, bg: ['#c8ecb4', '#3f7a2a'], deco: 'flower', u: { lv: 6 } },
  { id: 'archerStars', k: 1, bg: ['#5a6bb8', '#141a3a'], deco: 'stars', u: { lv: 8 } },
  { id: 'opaShades', k: 2, bg: ['#9fe3dc', '#1f6b66'], deco: 'shades', u: { gems: 150 } },
  { id: 'berserkerShades', k: 0, bg: ['#ffd08a', '#a8561c'], deco: 'shades', u: { gems: 150 } },
  { id: 'opaParty', k: 2, bg: ['#fff0a0', '#c79a1a'], deco: 'party', u: { gems: 120 } },
  { id: 'omaParty', k: 3, bg: ['#ffc4e1', '#b23a7a'], deco: 'party', u: { ach: 'games10' } },
  { id: 'berserkerFire', k: 0, bg: ['#ffb347', '#8a1f0a'], deco: 'fire', u: { lv: 12 } },
  { id: 'racerFire', k: 5, bg: ['#ffcf5a', '#9a2a10'], deco: 'fire', u: { gems: 200 } },
  { id: 'goatSnow', k: 4, bg: ['#e8f6ff', '#5d8fb8'], deco: 'snow', u: { ach: 'allMaps' } },
  { id: 'archerHalo', k: 1, bg: ['#fff7d6', '#7fa8d8'], deco: 'halo', u: { ach: 'onlineWin' } },
  { id: 'omaMedal', k: 3, bg: ['#d8c4f2', '#4f2f8a'], deco: 'medal', u: { ach: 'streak3' } },
  { id: 'racerHalo', k: 5, bg: ['#fff3c4', '#b07a2a'], deco: 'halo', u: { lv: 18 } },
  { id: 'berserkerCrown', k: 0, bg: ['#ffe89a', '#a8771a'], deco: 'crown', u: { lv: 25 } },
  { id: 'opaCrown', k: 2, bg: ['#ffe89a', '#a8771a'], deco: 'crown', u: { ach: 'winExtreme' } },
  { id: 'goatCrown', k: 4, bg: ['#ffe89a', '#7a4f12'], deco: 'crown', u: { lv: 30 } },
];
/* Army skins: colour swaps for the models of one faction (old colour -> new colour; no chains) plus their own extra pieces (skinExtras in
   25-worm-model.js). Klassisch is free; three come with Ruhmespfad levels 10/20/30 (only there, never in the shop), one per faction is
   bought with Juwelen. */
const SKINS = {
  v0: { fac: 'viking', n: TR('Klassisch'), u: { free: 1 }, sw: null, c: ['#326a9e', '#9aa3ad'] },
  v1: {
    fac: 'viking',
    n: TR('Rotbart'),
    u: { lv: 10 },
    c: ['#a8322a', '#9aa3ad'],
    sw: {
      0x326a9e: 0xa8322a,
      0x58a0c8: 0xc4493b,
      0x396f9e: 0x9e3a2e,
      0xc0392b: 0x2f5f9e,
      0x5a4330: 0x3a2a20,
      0xe9c45a: 0xc0622f,
      0x2f7f6f: 0xa8322a,
    },
  },
  v2: {
    fac: 'viking',
    n: TR('Eiswolf'),
    u: { lv: 20 },
    c: ['#dfe8f0', '#7fa8c8'],
    sw: {
      0x326a9e: 0xdfe8f0,
      0x58a0c8: 0xc4d8e8,
      0x396f9e: 0xd2e0ec,
      0x9aa3ad: 0xbfe0f6,
      0x6f7882: 0x8fb4d0,
      0xc0392b: 0x5d8fb8,
      0x5a4330: 0x8a8f96,
    },
  },
  v3: {
    fac: 'viking',
    n: TR('Gold-Jarl'),
    u: { lv: 30 },
    c: ['#2a2a30', '#d9a441'],
    sw: {
      0x326a9e: 0x2a2a30,
      0x58a0c8: 0x3a3a44,
      0x396f9e: 0x2f2f36,
      0x9aa3ad: 0xd9a441,
      0x6f7882: 0xa8771a,
      0xd3d8de: 0xf3d27a,
      0xc0392b: 0xd9a441,
    },
  },
  r0: { fac: 'rentner', n: TR('Klassisch'), u: { free: 1 }, sw: null, c: ['#995a8d', '#c47aa9'] },
  r1: {
    fac: 'rentner',
    n: TR('Trainingsanzug'),
    u: { lv: 10 },
    c: ['#2e8b6e', '#f3ead2'],
    sw: {
      0x995a8d: 0x2e8b6e,
      0xc47aa9: 0x3fa58a,
      0x83517d: 0x2a7a60,
      0x5d3b58: 0xf3ead2,
      0x4e3250: 0xf3ead2,
      0xd94a3d: 0x2e8b6e,
      0xb53a30: 0x236f58,
      0x4a3020: 0xf4f4f4,
      0x5a3048: 0xf4f4f4,
      0x3b2a20: 0xf4f4f4,
    },
  },
  r2: {
    fac: 'rentner',
    n: TR('Strandurlaub'),
    u: { lv: 20 },
    c: ['#e8913a', '#f2d06b'],
    sw: {
      0x995a8d: 0xe8913a,
      0xc47aa9: 0xf2b84a,
      0x83517d: 0xe07a2f,
      0x7a6e5f: 0xd8c38a,
      0x5d544b: 0xb89a5a,
      0xd94a3d: 0x3aa0d8,
      0xb53a30: 0x2a80b8,
    },
  },
  r3: {
    fac: 'rentner',
    n: TR('Disco-Rentner'),
    u: { lv: 30 },
    c: ['#6a3fb5', '#d9a441'],
    sw: {
      0x995a8d: 0x6a3fb5,
      0xc47aa9: 0xb07ae6,
      0x83517d: 0x5a32a0,
      0xd23a2e: 0xd9a441,
      0xd94a3d: 0xd9a441,
      0xb53a30: 0xa8771a,
      0x7a6e5f: 0x2a2a30,
    },
  },
  v4: {
    fac: 'viking',
    n: TR('Drachenjäger'),
    u: { gems: 500 },
    c: ['#2f6b3a', '#c9a24a'],
    sw: {
      0x326a9e: 0x2f6b3a,
      0x58a0c8: 0x3d8a4a,
      0x396f9e: 0x2a5f34,
      0x9aa3ad: 0xb08a4a,
      0x6f7882: 0x7a5a2a,
      0xd3d8de: 0xd9b46a,
      0xc0392b: 0x1f4a26,
      0x2f7f6f: 0xc9a24a,
    },
  },
  r4: {
    fac: 'rentner',
    n: TR('Kegelclub'),
    u: { gems: 500 },
    c: ['#c8202a', '#1f1f24'],
    sw: {
      0x995a8d: 0xc8202a,
      0xc47aa9: 0x1f1f24,
      0x83517d: 0xc8202a,
      0x5d3b58: 0x1f1f24,
      0x4e3250: 0x1f1f24,
      0x7a6e5f: 0x1f1f24,
      0x5d544b: 0xc8202a,
      0xd94a3d: 0x1f1f24,
      0xb53a30: 0x111114,
      0xd23a2e: 0xf6f6f6,
    },
  },
};
const SKIN_IDS = Object.keys(SKINS);
const SKIN_MAPS = {};
for (const id of SKIN_IDS) if (SKINS[id].sw) SKIN_MAPS[id] = new Map(Object.entries(SKINS[id].sw).map(([a, b]) => [+a, b]));
// Ruhmespfad: what each level (2..30) gives. Beyond 30 every 500 XP give 30 Juwelen.
const LEVEL_MAX = 30;
const LEVEL_REWARDS = {
  2: { av: 'oma' },
  3: { av: 'archer' },
  4: { gems: 30 },
  5: { gems: 40 },
  6: { av: 'omaFlower' },
  7: { gems: 40 },
  8: { av: 'archerStars' },
  9: { gems: 50 },
  10: { sk: ['v1', 'r1'] },
  11: { gems: 50 },
  12: { av: 'berserkerFire' },
  13: { gems: 50 },
  14: { gems: 60 },
  15: { gems: 60 },
  16: { gems: 60 },
  17: { gems: 60 },
  18: { av: 'racerHalo' },
  19: { gems: 70 },
  20: { sk: ['v2', 'r2'] },
  21: { gems: 70 },
  22: { gems: 70 },
  23: { gems: 80 },
  24: { gems: 80 },
  25: { av: 'berserkerCrown' },
  26: { gems: 80 },
  27: { gems: 90 },
  28: { gems: 90 },
  29: { gems: 90 },
  30: { sk: ['v3', 'r3'], av: 'goatCrown', gems: 200 },
};
const lvNeed = L => 100 + 20 * (L - 1);
function lvOf(xp) {
  let L = 1,
    x = Math.max(0, xp | 0);
  while (L < LEVEL_MAX && x >= lvNeed(L)) {
    x -= lvNeed(L);
    L++;
  }
  return L < LEVEL_MAX ? { L, x, need: lvNeed(L) } : { L, x: x % 500, need: 500, master: Math.floor(x / 500) };
}
/* Achievements. t(P, M): checked after every match (M = the match, P.st = the totals); live ones (no t) come from profEvent. g = Juwelen. */
const ACH = [
  { id: 'firstWin', ic: 'star', g: 25, n: TR('Erster Sieg'), d: TR('Gewinne eine Partie'), t: (P, M) => M.won },
  { id: 'tut', ic: 'flag', g: 30, n: TR('Lehrling'), d: TR('Schaffe das Tutorial'), t: (P, M) => M.tut && !M.adv && M.won },
  { id: 'tutPro', ic: 'crown', g: 50, n: TR('Profi'), d: TR('Schaffe das Profi-Tutorial'), t: (P, M) => M.tut && M.adv && M.won },
  {
    id: 'winHard',
    ic: 'swords',
    g: 40,
    n: TR('Harte Nuss'),
    d: TR('Besiege den Computer auf „Schwer“'),
    t: (P, M) => M.won && M.ai && ['hard', 'insane', 'extreme'].includes(M.lvl),
  },
  {
    id: 'winInsane',
    ic: 'fire',
    g: 60,
    n: TR('Unaufhaltsam'),
    d: TR('Besiege den Computer auf „Sehr schwer“'),
    t: (P, M) => M.won && M.ai && ['insane', 'extreme'].includes(M.lvl),
  },
  {
    id: 'winExtreme',
    ic: 'crown',
    g: 100,
    n: TR('Legende'),
    d: TR('Besiege den Computer auf „Extrem“'),
    t: (P, M) => M.won && M.ai && M.lvl === 'extreme',
  },
  { id: 'onlineWin', ic: 'army', g: 40, n: TR('Online-Held'), d: TR('Gewinne eine Online-Partie'), t: (P, M) => M.won && M.online },
  { id: 'online10', ic: 'army', g: 100, n: TR('Stammgast'), d: TR('Gewinne 10 Online-Partien'), t: P => P.st.onWins >= 10 },
  { id: 'games10', ic: 'flag', g: 30, n: TR('Dranbleiben'), d: TR('Spiele 10 Partien'), t: P => P.st.games >= 10 },
  { id: 'games50', ic: 'shield', g: 80, n: TR('Veteran'), d: TR('Spiele 50 Partien'), t: P => P.st.games >= 50 },
  { id: 'kills500', ic: 'axe', g: 60, n: TR('Kriegsherr'), d: TR('Besiege insgesamt 500 Gegner'), t: P => P.st.kills >= 500 },
  { id: 'kills2000', ic: 'axes', g: 120, n: TR('Schlachtenlenker'), d: TR('Besiege insgesamt 2000 Gegner'), t: P => P.st.kills >= 2000 },
  {
    id: 'bothSides',
    ic: 'twins',
    g: 40,
    n: TR('Seitenwechsel'),
    d: TR('Gewinne mit den Rentnern und mit den Wikingern'),
    t: P => P.st.wFac.viking > 0 && P.st.wFac.rentner > 0,
  },
  {
    id: 'allMaps',
    ic: 'mountain',
    g: 60,
    n: TR('Weltreisender'),
    d: TR('Gewinne auf allen vier Karten'),
    t: P => MAPTYPE_KEYS.every(k => P.st.wMap[k] > 0),
  },
  { id: 'chaos5', ic: 'meteor', g: 50, n: TR('Chaos-Meister'), d: TR('Gewinne 5 Partien im Chaos-Modus'), t: P => P.st.wMode.chaos >= 5 },
  { id: 'fog5', ic: 'moon', g: 50, n: TR('Nebelfuchs'), d: TR('Gewinne 5 Partien im Nebel-Modus'), t: P => P.st.wMode.fog >= 5 },
  {
    id: 'blitz',
    ic: 'bolt',
    g: 50,
    n: TR('Blitzsieg'),
    d: TR('Gewinne in weniger als 6 Minuten'),
    t: (P, M) => M.won && !M.tut && M.t < 360,
  },
  { id: 'streak3', ic: 'star', g: 40, n: TR('Siegesserie'), d: TR('Gewinne 3 Partien hintereinander'), t: P => P.st.streak >= 3 },
  { id: 'streak7', ic: 'crown', g: 100, n: TR('Unbesiegbar'), d: TR('Gewinne 7 Partien hintereinander'), t: P => P.st.streak >= 7 },
  {
    id: 'fortress',
    ic: 'tower',
    g: 60,
    n: TR('Festung'),
    d: TR('Gewinne, ohne dass deine Basis Schaden nimmt'),
    t: (P, M) => M.won && !M.tut && M.ost && M.ost[2] === 0,
  },
  {
    id: 'close',
    ic: 'heal',
    g: 50,
    n: TR('Haarscharf'),
    d: TR('Gewinne mit weniger als einem Fünftel Basisleben'),
    t: (P, M) => M.won && !M.tut && M.base > 0 && M.base < M.mhp * 0.2,
  },
  { id: 'cliff20', ic: 'mountain', g: 40, n: TR('Abgrund'), d: TR('Stoß insgesamt 20 Gegner von Klippen'), t: P => P.st.cliff >= 20 },
  { id: 'cats10', ic: 'boulder', g: 40, n: TR('Katapultjäger'), d: TR('Zerstöre insgesamt 10 Katapulte'), t: P => P.st.cats >= 10 },
  {
    id: 'heroes25',
    ic: 'bighead',
    g: 60,
    n: TR('Heldenjäger'),
    d: TR('Besiege insgesamt 25 gesteuerte Gegner mit deinem eigenen Ego-Krieger'),
    t: P => P.st.ego >= 25,
  },
  { id: 'tame', ic: 'paw', g: 30, n: TR('Tierfreund'), d: TR('Zähme einen Eisbären oder einen Sandwurm'), t: P => P.st.tames >= 1 },
  { id: 'rush5', ic: 'coins', g: 40, n: TR('Goldgräber'), d: TR('Löse insgesamt 5 Rausche aus'), t: P => P.st.ego >= 5 },
  { id: 'days7', ic: 'sprout', g: 70, n: TR('Treue Seele'), d: TR('Spiele an 7 verschiedenen Tagen'), t: P => P.days.length >= 7 },
  { id: 'strike5', ic: 'pin', g: 40, n: TR('Kegelkönig'), d: TR('Kegle 5 Gegner mit einem Wurf um') },
  { id: 'ram4', ic: 'goat', g: 30, n: TR('Rammbock'), d: TR('Ramme 4 Gegner mit einem Anlauf um') },
  { id: 'ice3', ic: 'snow', g: 30, n: TR('Eisbrecher'), d: TR('Lass 3 Gegner auf einmal ins Eis krachen') },
  { id: 'heroWin', ic: 'sword', g: 60, n: TR('Wurmbezwinger'), d: TR('Besiege einen Sandwurm als Held und überlebe') },
  { id: 'feast', ic: 'teeth', g: 40, n: TR('Festmahl'), d: TR('Lass deinen Sandwurm 3 Gegner auf einmal verschlingen') },
  { id: 'disco', ic: 'dance', g: 40, n: TR('Discofieber'), d: TR('Bring 5 Gegner mit einer Discogranate zum Tanzen') },
  { id: 'combo', ic: 'burst', g: 30, n: TR('Kombo'), d: TR('Drei Kills in Folge mit deinem Ego-Krieger') },
  { id: 'quake5', ic: 'quake', g: 30, n: TR('Erdbebenmacher'), d: TR('Wirf mit einem Erdbeben 5 Gegner um') },
  { id: 'save', ic: 'flag', g: 30, n: TR('In letzter Sekunde'), d: TR('Halte eine Fahne, die schon fast verloren war') },
];
const ACH_BY = Object.fromEntries(ACH.map(a => [a.id, a]));
const AV_BY = Object.fromEntries(AVATARS.map(a => [a.id, a]));
const AI_XP = { easy: 0.8, medium: 1, hard: 1.2, insane: 1.4, extreme: 1.6 };
/* Daily quests: three a day from this list (picked by the date, the same for everyone), progress from every finished match (not the
   tutorials). n = German text, g = goal, v(M, st) = what one match adds, gems = reward; all three done: DQ_BONUS more. */
const DQ_POOL = [
  { id: 'win2', n: TR('Gewinne 2 Partien'), g: 2, gems: 30, v: M => (M.won ? 1 : 0) },
  { id: 'play3', n: TR('Spiele 3 Partien'), g: 3, gems: 20, v: () => 1 },
  { id: 'kills40', n: TR('Besiege 40 Gegner'), g: 40, gems: 25, v: M => M.k | 0 },
  { id: 'made25', n: TR('Bilde 25 Krieger aus'), g: 25, gems: 20, v: (M, st) => st[0] | 0 },
  { id: 'ego3', n: TR('Besiege 3 gesteuerte Gegner mit deinem Ego-Krieger'), g: 3, gems: 35, v: (M, st) => st[10] | 0 },
  { id: 'online1', n: TR('Spiele eine Online-Partie'), g: 1, gems: 30, v: M => (M.online ? 1 : 0) },
  { id: 'base800', n: TR('Füge gegnerischen Basen 800 Schaden zu'), g: 800, gems: 25, v: (M, st) => st[2] | 0 },
  { id: 'rams6', n: TR('Ramme 6 Gegner um'), g: 6, gems: 25, v: (M, st) => st[5] | 0 },
  { id: 'cliff3', n: TR('Stoß 3 Gegner von Klippen'), g: 3, gems: 30, v: (M, st) => st[6] | 0 },
  { id: 'chaos1', n: TR('Gewinne eine Partie im Chaos-Modus'), g: 1, gems: 30, v: M => (M.won && M.mode === 'chaos' ? 1 : 0) },
  { id: 'fog1', n: TR('Gewinne eine Partie im Nebel-Modus'), g: 1, gems: 30, v: M => (M.won && M.mode === 'fog' ? 1 : 0) },
  { id: 'vik1', n: TR('Gewinne mit den Wikingern'), g: 1, gems: 25, v: M => (M.won && M.fac === 'viking' ? 1 : 0) },
  { id: 'ren1', n: TR('Gewinne mit den Rentnern'), g: 1, gems: 25, v: M => (M.won && M.fac === 'rentner' ? 1 : 0) },
  {
    id: 'hard1',
    n: TR('Besiege den Computer auf „Schwer“ oder schwerer'),
    g: 1,
    gems: 40,
    v: M => (M.won && M.ai && ['hard', 'insane', 'extreme'].includes(M.lvl) ? 1 : 0),
  },
];
const DQ_BY = Object.fromEntries(DQ_POOL.map(q => [q.id, q]));
const DQ_BONUS = 30;
function profBlank() {
  return {
    v: 1,
    nm: Math.floor(Math.random() * PROF_NAMES.length),
    nr: 10 + Math.floor(Math.random() * 90),
    av: myFac === 'viking' ? 'berserker' : 'opa',
    xp: 0,
    gems: 0,
    own: {},
    sk: { viking: 'v0', rentner: 'r0' },
    ach: {},
    lvC: 1,
    mC: 0,
    days: [],
    daily: '',
    dq: null,
    st: profStatsBlank(),
  };
}
function profStatsBlank() {
  return {
    games: 0,
    wins: 0,
    onGames: 0,
    onWins: 0,
    streak: 0,
    best: 0,
    kills: 0,
    made: 0,
    lost: 0,
    ego: 0,
    cats: 0,
    cliff: 0,
    rams: 0,
    holes: 0,
    tames: 0,
    time: 0,
    wLvl: { easy: 0, medium: 0, hard: 0, insane: 0, extreme: 0 },
    wMap: { wiesen: 0, wueste: 0, arktis: 0, klippen: 0 },
    wFac: { viking: 0, rentner: 0 },
    wMode: { classic: 0, chaos: 0, fog: 0 },
  };
}
// Everything read from storage or from another device is checked and clamped: a broken or edited profile never breaks the game.
function profClean(d) {
  const P = profBlank();
  if (!d || typeof d !== 'object') return P;
  const int = (v, a, b, def) => (Number.isFinite(+v) ? clamp(Math.floor(+v), a, b) : def);
  P.nm = int(d.nm, 0, PROF_NAMES.length - 1, P.nm);
  P.nr = int(d.nr, 10, 99, P.nr);
  P.xp = int(d.xp, 0, 1e8, 0);
  P.gems = int(d.gems, 0, 1e6, 0);
  P.lvC = int(d.lvC, 1, LEVEL_MAX, 1);
  P.mC = int(d.mC, 0, 1e6, 0);
  if (d.own && typeof d.own === 'object') for (const k in d.own) if (AV_BY[k] || SKINS[k]) P.own[k] = 1;
  if (d.ach && typeof d.ach === 'object') for (const k in d.ach) if (ACH_BY[k]) P.ach[k] = int(d.ach[k], 0, 1e13, 1);
  if (d.sk && typeof d.sk === 'object')
    for (const f of ['viking', 'rentner']) if (SKINS[d.sk[f]] && SKINS[d.sk[f]].fac === f) P.sk[f] = d.sk[f];
  if (AV_BY[d.av]) P.av = d.av;
  if (Array.isArray(d.days)) P.days = d.days.filter(x => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x)).slice(-60);
  if (typeof d.daily === 'string' && /^\d{4}-\d\d-\d\d$/.test(d.daily)) P.daily = d.daily;
  const q = d.dq;
  if (
    q &&
    typeof q === 'object' &&
    typeof q.d === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(q.d) &&
    Array.isArray(q.ids) &&
    q.ids.length === 3 &&
    q.ids.every(i => DQ_BY[i])
  )
    P.dq = {
      d: q.d,
      ids: q.ids.slice(),
      p: [0, 1, 2].map(i => int((q.p || [])[i], 0, 1e6, 0)),
      c: [0, 1, 2].map(i => ((q.c || [])[i] ? 1 : 0)),
      b: q.b ? 1 : 0,
    };
  const s = d.st && typeof d.st === 'object' ? d.st : {};
  for (const k in P.st) {
    if (typeof P.st[k] === 'number') P.st[k] = int(s[k], 0, 1e9, 0);
    else if (s[k] && typeof s[k] === 'object') for (const j in P.st[k]) P.st[k][j] = int(s[k][j], 0, 1e9, 0);
  }
  return P;
}
let PLAYER = (() => {
  try {
    const raw = store.get('wvr-prof');
    return raw ? profClean(JSON.parse(raw)) : profBlank();
  } catch (_) {
    return profBlank();
  }
})();
function profSave() {
  if (GOD.on) return; // the god mode tries things out: nothing is kept
  store.set('wvr-prof', JSON.stringify(PLAYER));
}
/* God mode (for the game's maker): everything unlocked and free, the level can be set, nothing is saved. On with ?gott=1 or seven taps
   on the level in the profile; leaving it brings the real profile back. */
const GOD = { on: false, real: null };
function godSet(on) {
  if (on === GOD.on) return;
  if (on) {
    GOD.real = PLAYER;
    PLAYER = profClean(JSON.parse(JSON.stringify(PLAYER)));
    PLAYER.gems = 99999;
    GOD.on = true;
  } else {
    GOD.on = false;
    PLAYER = GOD.real || PLAYER;
    GOD.real = null;
  }
}
// sets the XP so the level is exactly L (god mode)
function godLevel(L) {
  L = clamp(L | 0, 1, LEVEL_MAX + 5);
  let xp = 0;
  for (let i = 1; i < Math.min(L, LEVEL_MAX); i++) xp += lvNeed(i);
  if (L > LEVEL_MAX) xp += (L - LEVEL_MAX) * 500;
  PLAYER.xp = xp;
  PLAYER.lvC = Math.min(L, LEVEL_MAX);
}
const profLevel = () => lvOf(PLAYER.xp).L;
// owned: free, reached by level, earned by an achievement, or bought
function profOwns(id) {
  const it = AV_BY[id] || SKINS[id];
  if (!it) return false;
  if (GOD.on) return true;
  const u = it.u;
  return !!(u.free || PLAYER.own[id] || (u.lv && profLevel() >= u.lv) || (u.ach && PLAYER.ach[u.ach]));
}
function profBuy(id) {
  const it = AV_BY[id] || SKINS[id];
  if (!it || profOwns(id) || !it.u.gems || PLAYER.gems < it.u.gems) return false;
  PLAYER.gems -= it.u.gems;
  PLAYER.own[id] = 1;
  profSave();
  return true;
}
function profEquip(id) {
  if (!profOwns(id)) return false;
  if (AV_BY[id]) PLAYER.av = id;
  else PLAYER.sk[SKINS[id].fac] = id;
  profSave();
  return true;
}
const profDay = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
function profGrantAch(id, out) {
  if (PLAYER.ach[id] || !ACH_BY[id]) return false;
  PLAYER.ach[id] = Date.now();
  PLAYER.gems += ACH_BY[id].g;
  if (out) out.push(id);
  return true;
}
// level rewards for every level reached since the last claim (and the master bonus beyond the last level)
function profClaimLevels(out) {
  const lv = lvOf(PLAYER.xp);
  while (PLAYER.lvC < lv.L) {
    PLAYER.lvC++;
    const r = LEVEL_REWARDS[PLAYER.lvC];
    if (r && r.gems) PLAYER.gems += r.gems;
    out.push(PLAYER.lvC);
  }
  if (lv.master > PLAYER.mC) {
    PLAYER.gems += 30 * (lv.master - PLAYER.mC);
    PLAYER.mC = lv.master;
  }
}
// today's three quests (a new set every day, picked from the date)
function dqToday() {
  const d = profDay();
  if (!PLAYER.dq || PLAYER.dq.d !== d) {
    let h = 7;
    for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const r = rng(Math.abs(h)),
      pool = DQ_POOL.map(q => q.id),
      ids = [];
    while (ids.length < 3) {
      const id = pool.splice(Math.floor(r() * pool.length), 1)[0];
      ids.push(id);
    }
    PLAYER.dq = { d, ids, p: [0, 0, 0], c: [0, 0, 0], b: 0 };
  }
  return PLAYER.dq;
}
// milliseconds until the next set
function dqLeft() {
  const n = new Date(),
    m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return m - n;
}
// one finished match counts for today's quests; finished ones pay out right away. Returns the quests finished now.
function dqMatch(M) {
  const Q = dqToday(),
    st = M.st || [],
    done = [];
  Q.ids.forEach((id, i) => {
    const q = DQ_BY[id];
    if (Q.c[i]) return;
    Q.p[i] = Math.min(q.g, Q.p[i] + Math.max(0, q.v(M, st) | 0));
    if (Q.p[i] >= q.g) {
      Q.c[i] = 1;
      PLAYER.gems += q.gems;
      done.push(id);
    }
  });
  if (!Q.b && Q.c.every(Boolean)) {
    Q.b = 1;
    PLAYER.gems += DQ_BONUS;
    done.push('bonus');
  }
  return done;
}
/* One finished match. M: { won, online, ai, tut, adv, lvl, fac, map, mode, t, k, st (own stats), ost (the opponent's), base, mhp }.
   Returns what the end screen shows: XP, levels before and after, Juwelen won, new achievements and level rewards. */
function profMatchEnd(M) {
  const S = PLAYER.st,
    g0 = PLAYER.gems,
    lv0 = lvOf(PLAYER.xp),
    ach = [],
    lvUp = [];
  let xp = 0;
  const today = profDay();
  if (!PLAYER.days.includes(today)) PLAYER.days = PLAYER.days.concat(today).slice(-60);
  if (M.tut) {
    if (M.won && !PLAYER.ach[M.adv ? 'tutPro' : 'tut']) xp = M.adv ? 120 : 80;
  } else {
    const st = M.st || [];
    S.games++;
    if (M.online) S.onGames++;
    if (M.won) {
      S.wins++;
      S.streak++;
      S.best = Math.max(S.best, S.streak);
      if (M.online) S.onWins++;
      if (M.ai && S.wLvl[M.lvl] !== undefined) S.wLvl[M.lvl]++;
      if (S.wMap[M.map] !== undefined) S.wMap[M.map]++;
      if (S.wFac[M.fac] !== undefined) S.wFac[M.fac]++;
      if (S.wMode[M.mode] !== undefined) S.wMode[M.mode]++;
    } else S.streak = 0;
    S.kills += M.k | 0;
    S.made += st[0] | 0;
    S.lost += st[1] | 0;
    S.rams += st[5] | 0;
    S.cliff += st[6] | 0;
    S.tames += st[7] | 0;
    S.cats += st[8] | 0;
    S.holes += st[9] | 0;
    S.ego += st[10] | 0; // controlled enemies beaten with the own ego warrior (each one a rush)
    S.time += Math.round(M.t || 0);
    xp = 40 + (M.won ? 40 : 0) + Math.min(40, M.k | 0) + Math.min(20, 2 * (st[10] | 0));
    xp = Math.round(xp * (M.online ? 1.5 : M.ai ? AI_XP[M.lvl] || 1 : 1));
    if (M.won && PLAYER.daily !== today) {
      PLAYER.daily = today;
      PLAYER.gems += 20; // the first win of the day
      M.daily = 20;
    }
    M.dq = dqMatch(M);
  }
  PLAYER.xp += xp;
  profClaimLevels(lvUp);
  for (const a of ACH) if (a.t && !PLAYER.ach[a.id] && a.t(PLAYER, M)) profGrantAch(a.id, ach);
  profSave();
  return { xp, lv0, lv1: lvOf(PLAYER.xp), gems: PLAYER.gems - g0, daily: M.daily || 0, ach, lvUp, dq: M.dq || [] };
}
// Giving up counts as a lost match for the statistics and ends a winning streak (no XP).
function profQuit() {
  if (V.tut || !V.playing) return;
  PLAYER.st.games++;
  if (V.mode === 'host' || V.mode === 'guest') PLAYER.st.onGames++;
  PLAYER.st.streak = 0;
  profSave();
}
// The player's own moments during a match: achievements that cannot be read from the end numbers.
function profEvent(ty, a, b) {
  if (V.tut || !V.playing) return;
  let id = null;
  if (ty === 'hl' && a.mine) {
    if (a.ty === 'strike' && a.n >= 5) id = 'strike5';
    else if (a.ty === 'ram' && a.n >= 4) id = 'ram4';
    else if (a.ty === 'ice' && a.n >= 3) id = 'ice3';
    else if (a.ty === 'heroWin') id = 'heroWin';
    else if (a.ty === 'gulp' && a.n >= 3) id = 'feast';
    else if (a.ty === 'quake' && a.n >= 5) id = 'quake5';
    else if (a.ty === 'save') id = 'save';
  } else if (ty === 'dance' && a >= 5) id = 'disco';
  else if (ty === 'combo') id = 'combo';
  if (id && profGrantAch(id)) {
    profSave();
    const A = ACH_BY[id];
    toast(TR('Erfolg: {0} · +{1} Juwelen', A.n, A.g), 2600);
    SFX.play('ding');
  }
}
// what other players see of you: name, picture, level and your skin for each faction
function profPublic() {
  return {
    n: PLAYER.nm * 100 + PLAYER.nr,
    a: Math.max(
      0,
      AVATARS.findIndex(a => a.id === PLAYER.av)
    ),
    l: profLevel(),
    s: [SKIN_IDS.indexOf(PLAYER.sk.viking), SKIN_IDS.indexOf(PLAYER.sk.rentner)],
  };
}
// someone else's public info, checked (from a lobby entry or the presence of the other player)
function profPeer(p) {
  if (!p || typeof p !== 'object') return null;
  const n = Number.isInteger(p.n) && p.n >= 0 && p.n < PROF_NAMES.length * 100 && p.n % 100 >= 10 ? p.n : null;
  if (n === null) return null;
  const sk = Array.isArray(p.s) ? p.s : [];
  const skin = (i, f) =>
    Number.isInteger(sk[i]) && SKIN_IDS[sk[i]] && SKINS[SKIN_IDS[sk[i]]].fac === f ? SKIN_IDS[sk[i]] : f === 'viking' ? 'v0' : 'r0';
  return {
    name: profName(Math.floor(n / 100), n % 100),
    av: AVATARS[Number.isInteger(p.a) && AVATARS[p.a] ? p.a : 0].id,
    lv: Number.isInteger(p.l) ? clamp(p.l, 1, LEVEL_MAX) : 1,
    sk: { viking: skin(0, 'viking'), rentner: skin(1, 'rentner') },
  };
}
/* Skins on the battlefield: the colour swaps of each team's faction while its unit models are built (buildUnit) */
const UNIT_SKIN = {};
function setSkins(facs, ids) {
  for (const k in UNIT_SKIN) delete UNIT_SKIN[k];
  facs.forEach((f, i) => {
    const id = ids[i];
    if (!SKIN_MAPS[id] || SKINS[id].fac !== f) return;
    for (const k of FAC[f].kinds) UNIT_SKIN[k] = { id, map: SKIN_MAPS[id] };
  });
}
/* Profile pictures: the unit head (rendered once per kind, headRaw in 26-icons-effects.js) on its background, with the decoration. */
const AV_URL = {};
function avatarURL(id) {
  if (AV_URL[id]) return AV_URL[id];
  const [c, ok] = avatarCanvas(id),
    url = c.toDataURL();
  if (ok) AV_URL[id] = url;
  return url;
}
// [canvas 256 px, rendered completely]. A badge: ink ring, coloured rim with a highlight, halftone backdrop, the unit's head large,
// its decoration drawn with gradients and ink outlines (the same comic-pop language as the buttons).
function avatarCanvas(id) {
  const A = AV_BY[id] || AVATARS[0],
    S = 256,
    C = S / 2,
    c = cnv(S, S),
    o = c.getContext('2d'),
    gold = A.deco === 'crown' || A.deco === 'medal' || A.deco === 'halo',
    rim = gold ? ['#ffe08a', '#c98a12'] : [mixHex(A.bg[0], '#ffffff', 0.35), mixHex(A.bg[1], '#000000', 0.15)];
  // outer ink ring and the rim
  o.fillStyle = '#1b1430';
  o.beginPath();
  o.arc(C, C, C - 1, 0, TAU);
  o.fill();
  const rg = o.createLinearGradient(40, 20, 220, 240);
  rg.addColorStop(0, rim[0]);
  rg.addColorStop(1, rim[1]);
  o.fillStyle = rg;
  o.beginPath();
  o.arc(C, C, C - 7, 0, TAU);
  o.fill();
  o.fillStyle = '#1b1430';
  o.beginPath();
  o.arc(C, C, C - 17, 0, TAU);
  o.fill();
  // the inner disc: gradient, halftone dots, light sweep
  o.save();
  o.beginPath();
  o.arc(C, C, C - 20, 0, TAU);
  o.clip();
  const gr = o.createRadialGradient(C - 30, C - 50, 10, C, C, C);
  gr.addColorStop(0, A.bg[0]);
  gr.addColorStop(1, A.bg[1]);
  o.fillStyle = gr;
  o.fillRect(0, 0, S, S);
  o.fillStyle = 'rgba(255,255,255,0.16)';
  for (let y = 0; y < S; y += 11)
    for (let x = (y / 11) % 2 ? 5.5 : 0; x < S; x += 11) {
      const r = 1.2 + 2.4 * clamp((x + y - 60) / 300, 0, 1); // dots grow towards the bottom right
      o.beginPath();
      o.arc(x, y, r, 0, TAU);
      o.fill();
    }
  const sw = o.createLinearGradient(0, 0, S, S);
  sw.addColorStop(0, 'rgba(255,255,255,0.28)');
  sw.addColorStop(0.45, 'rgba(255,255,255,0)');
  sw.addColorStop(1, 'rgba(0,0,0,0.22)');
  o.fillStyle = sw;
  o.fillRect(0, 0, S, S);
  if (A.deco === 'stars' || A.deco === 'snow' || A.deco === 'fire' || A.deco === 'party') avDeco(o, A.deco, true);
  // ground shadow under the head, then the head
  o.fillStyle = 'rgba(0,0,0,0.22)';
  o.beginPath();
  o.ellipse(C + 6, S - 26, 78, 22, 0, 0, TAU);
  o.fill();
  let ok = true;
  try {
    o.drawImage(headRaw(A.k), 2, 12, 252, 252);
  } catch (_) {
    ok = false; // the 3D head cannot be rendered yet (page still loading): draw it again next time
  }
  o.restore();
  if (A.deco) avDeco(o, A.deco, false);
  // a glossy arc at the top left, like enamel
  o.save();
  o.beginPath();
  o.arc(C, C, C - 20, 0, TAU);
  o.clip();
  const gl = o.createLinearGradient(0, 0, 0, S * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  o.fillStyle = gl;
  o.beginPath();
  o.ellipse(C - 10, 30, 100, 54, -0.2, 0, TAU);
  o.fill();
  o.restore();
  return [c, ok];
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16),
    ch = sh => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t));
  return '#' + [16, 8, 0].map(sh => ch(sh).toString(16).padStart(2, '0')).join('');
}
// decoration helpers: every piece gets a fill (gradient), an ink outline and a highlight
function inkPath(o, fill, line = '#1b1430', w = 3) {
  o.fillStyle = fill;
  o.fill();
  o.lineWidth = w;
  o.strokeStyle = line;
  o.lineJoin = 'round';
  o.stroke();
}
function avDeco(o, d, back) {
  o.save();
  if (back) {
    // behind the head: sparkles, snowflakes, flames, confetti
    const r = rng(d.length * 977);
    for (let i = 0; i < (d === 'party' ? 26 : 16); i++) {
      const x = 16 + r() * 224,
        y = 10 + r() * 150,
        s = 4 + r() * 8;
      if (d === 'fire') {
        const fg = o.createLinearGradient(x, y + s * 3, x, y - s * 3);
        fg.addColorStop(0, 'rgba(255,90,30,0.85)');
        fg.addColorStop(0.6, 'rgba(255,170,40,0.85)');
        fg.addColorStop(1, 'rgba(255,240,150,0.9)');
        o.fillStyle = fg;
        o.beginPath();
        o.moveTo(x, y + s * 3);
        o.bezierCurveTo(x - s * 2.2, y + s, x - s * 0.4, y - s * 0.5, x, y - s * 3);
        o.bezierCurveTo(x + s * 0.4, y - s * 0.5, x + s * 2.2, y + s, x, y + s * 3);
        o.fill();
      } else if (d === 'party') {
        o.fillStyle = ['#ff5fa2', '#ffe066', '#6be3ff', '#8dff7a', '#ffffff'][i % 5];
        o.save();
        o.translate(x, y);
        o.rotate(r() * TAU);
        o.fillRect(-s * 0.5, -s * 0.2, s, s * 0.4);
        o.restore();
      } else if (d === 'snow') {
        o.strokeStyle = 'rgba(255,255,255,0.9)';
        o.lineWidth = 1.6;
        o.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI;
          o.beginPath();
          o.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
          o.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          o.stroke();
          for (const t of [-1, 1]) {
            const px = x + Math.cos(a) * s * 0.55 * t,
              py = y + Math.sin(a) * s * 0.55 * t;
            o.beginPath();
            o.moveTo(px + Math.cos(a + 0.9) * s * 0.3 * t, py + Math.sin(a + 0.9) * s * 0.3 * t);
            o.lineTo(px, py);
            o.lineTo(px + Math.cos(a - 0.9) * s * 0.3 * t, py + Math.sin(a - 0.9) * s * 0.3 * t);
            o.stroke();
          }
        }
      } else {
        const sg = o.createRadialGradient(x, y, 0, x, y, s);
        sg.addColorStop(0, 'rgba(255,250,210,1)');
        sg.addColorStop(1, 'rgba(255,240,170,0)');
        o.fillStyle = sg;
        o.beginPath();
        o.arc(x, y, s, 0, TAU);
        o.fill();
        o.fillStyle = 'rgba(255,255,255,0.95)';
        o.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU,
            rr = k % 2 ? s * 0.22 : s * 0.9;
          o.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        o.fill();
      }
    }
    o.restore();
    return;
  }
  o.lineJoin = 'round';
  if (d === 'crown') {
    const g = o.createLinearGradient(0, 10, 0, 70);
    g.addColorStop(0, '#fff0a8');
    g.addColorStop(0.5, '#f6cc63');
    g.addColorStop(1, '#c98a12');
    o.beginPath();
    o.moveTo(72, 66);
    o.lineTo(80, 18);
    o.lineTo(104, 44);
    o.lineTo(128, 8);
    o.lineTo(152, 44);
    o.lineTo(176, 18);
    o.lineTo(184, 66);
    o.quadraticCurveTo(128, 78, 72, 66);
    o.closePath();
    inkPath(o, g, '#5a3a06', 4);
    o.fillStyle = 'rgba(255,255,255,0.5)';
    o.fillRect(84, 52, 86, 5);
    [
      [104, 44, '#d0213a'],
      [128, 30, '#2a9df4'],
      [152, 44, '#3fc46a'],
    ].forEach(([x, y, col]) => {
      o.beginPath();
      o.arc(x, y + 14, 6, 0, TAU);
      inkPath(o, col, '#5a3a06', 2.5);
      o.fillStyle = 'rgba(255,255,255,0.7)';
      o.beginPath();
      o.arc(x - 2, y + 12, 2, 0, TAU);
      o.fill();
    });
  } else if (d === 'halo') {
    o.shadowColor = 'rgba(255,240,150,0.9)';
    o.shadowBlur = 16;
    o.lineWidth = 11;
    o.strokeStyle = '#ffe066';
    o.beginPath();
    o.ellipse(128, 26, 54, 14, 0, 0, TAU);
    o.stroke();
    o.shadowBlur = 0;
    o.lineWidth = 4;
    o.strokeStyle = '#fff8d0';
    o.beginPath();
    o.ellipse(128, 24, 54, 13, 0, Math.PI * 1.1, Math.PI * 1.9);
    o.stroke();
  } else if (d === 'party') {
    const g = o.createLinearGradient(140, 70, 200, 0);
    g.addColorStop(0, '#ff5fa2');
    g.addColorStop(1, '#ff8fc0');
    o.beginPath();
    o.moveTo(136, 70);
    o.lineTo(190, 0);
    o.lineTo(212, 80);
    o.closePath();
    inkPath(o, g, '#5a1a3a', 4);
    o.save();
    o.clip();
    o.strokeStyle = '#ffe066';
    o.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      o.beginPath();
      o.moveTo(120, 30 + i * 18);
      o.lineTo(230, 12 + i * 18);
      o.stroke();
    }
    o.restore();
    o.beginPath();
    o.arc(190, 2, 11, 0, TAU);
    inkPath(o, '#6be3ff', '#1b1430', 3);
  } else if (d === 'shades') {
    // sunglasses on the face (the head looks a little to the right)
    const lens = (x, y, w, h) => {
      o.beginPath();
      o.roundRect ? o.roundRect(x, y, w, h, 10) : o.rect(x, y, w, h);
      const g = o.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#2a2d3a');
      g.addColorStop(0.5, '#0f1016');
      g.addColorStop(1, '#2a2d3a');
      inkPath(o, g, '#0a0a10', 3);
      o.fillStyle = 'rgba(255,255,255,0.5)';
      o.beginPath();
      o.roundRect ? o.roundRect(x + 7, y + 5, w * 0.35, 7, 3) : o.rect(x + 7, y + 5, w * 0.35, 7);
      o.fill();
    };
    lens(78, 122, 46, 30);
    lens(140, 120, 50, 30);
    o.strokeStyle = '#0a0a10';
    o.lineWidth = 5;
    o.lineCap = 'round';
    o.beginPath();
    o.moveTo(124, 134);
    o.lineTo(140, 133);
    o.moveTo(78, 132);
    o.lineTo(64, 138);
    o.stroke();
  } else if (d === 'flower') {
    // a wreath over the hair: leaves behind, blossoms in front
    o.strokeStyle = '#3f8f2e';
    o.lineWidth = 7;
    o.lineCap = 'round';
    o.beginPath();
    o.moveTo(56, 70);
    o.quadraticCurveTo(128, 10, 200, 70);
    o.stroke();
    const leaf = (x, y, a) => {
      o.save();
      o.translate(x, y);
      o.rotate(a);
      o.beginPath();
      o.ellipse(0, 0, 13, 6, 0, 0, TAU);
      inkPath(o, '#5fae3e', '#2d6e1f', 2.5);
      o.restore();
    };
    leaf(70, 54, -0.9);
    leaf(110, 28, -0.3);
    leaf(150, 28, 0.3);
    leaf(190, 54, 0.9);
    const fl = (x, y, s, c1, c2) => {
      for (let k = 0; k < 6; k++) {
        o.beginPath();
        o.arc(x + Math.cos((k / 6) * TAU) * s, y + Math.sin((k / 6) * TAU) * s, s * 0.78, 0, TAU);
        inkPath(o, c1, c2, 2.5);
      }
      o.beginPath();
      o.arc(x, y, s * 0.72, 0, TAU);
      inkPath(o, '#f4c64f', '#a06b00', 2.5);
    };
    fl(62, 62, 10, '#ffffff', '#b58cc9');
    fl(96, 38, 11, '#ff8fb8', '#9a2f62');
    fl(128, 26, 12, '#ffffff', '#b58cc9');
    fl(160, 38, 11, '#ff8fb8', '#9a2f62');
    fl(194, 62, 10, '#ffffff', '#b58cc9');
  } else if (d === 'medal') {
    o.translate(58, -6); // pinned at the lower right, not over the face
    o.beginPath();
    o.moveTo(100, 160);
    o.lineTo(128, 214);
    o.lineTo(156, 160);
    o.lineTo(144, 160);
    o.lineTo(128, 190);
    o.lineTo(112, 160);
    o.closePath();
    inkPath(o, '#d0213a', '#5a1020', 3);
    const g = o.createRadialGradient(120, 200, 4, 128, 212, 30);
    g.addColorStop(0, '#fff0a8');
    g.addColorStop(0.7, '#f6cc63');
    g.addColorStop(1, '#c98a12');
    o.beginPath();
    o.arc(128, 212, 26, 0, TAU);
    inkPath(o, g, '#5a3a06', 4);
    o.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * TAU,
        rr = k % 2 ? 6 : 14;
      o.lineTo(128 + Math.cos(a) * rr, 212 + Math.sin(a) * rr);
    }
    o.closePath();
    inkPath(o, '#c98a12', '#5a3a06', 2);
  }
  o.restore();
}
/* Moving the profile to another device: the old device shows an 8-digit code for 10 minutes (a retained message on the MQTT brokers),
   the new one types it in and takes the profile over. */
const XFER = { clients: [], code: null, timer: 0 };
const xferTopic = code => 'wvr7/xfer/' + code;
async function profSend() {
  profSendStop();
  if (!(await loadMqtt())) return null;
  const code = genCode() + genCode(),
    msg = JSON.stringify({ v: 1, p: PLAYER });
  XFER.code = code;
  (window.WVR_MQTT || MQTT_URLS).forEach((u, i) => {
    try {
      const c = window.mqtt.connect(u, {
        clientId: 'wvrX_' + code + '_' + i,
        keepalive: 30,
        reconnectPeriod: 5000,
        connectTimeout: 9000,
        clean: true,
      });
      c.on('connect', () => {
        try {
          c.publish(xferTopic(code), msg, { qos: 1, retain: true });
        } catch (_) {}
      });
      c.on('error', () => {});
      XFER.clients.push(c);
    } catch (_) {}
  });
  XFER.timer = setTimeout(profSendStop, 600000);
  return code;
}
function profSendStop() {
  clearTimeout(XFER.timer);
  const code = XFER.code;
  XFER.clients.forEach(c => {
    try {
      if (c.connected && code) c.publish(xferTopic(code), '', { qos: 1, retain: true }, () => c.end(true));
      else c.end(true);
    } catch (_) {}
  });
  XFER.clients = [];
  XFER.code = null;
}
// resolves to the cleaned profile, or null (no such code / nothing in time)
async function profFetch(code) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length !== 8 || !(await loadMqtt())) return null;
  return new Promise(res => {
    const cl = [];
    let done = false;
    const finish = v => {
      if (done) return;
      done = true;
      cl.forEach(c => {
        try {
          c.end(true);
        } catch (_) {}
      });
      res(v);
    };
    (window.WVR_MQTT || MQTT_URLS).forEach((u, i) => {
      try {
        const c = window.mqtt.connect(u, {
          clientId: 'wvrY_' + code + '_' + i + Math.random().toString(36).slice(2, 6),
          connectTimeout: 9000,
          clean: true,
        });
        c.on('connect', () => c.subscribe(xferTopic(code), { qos: 1 }));
        c.on('message', (t, buf) => {
          let d = null;
          try {
            d = JSON.parse(typeof buf === 'string' ? buf : new TextDecoder().decode(buf));
          } catch (_) {}
          if (d && d.v === 1 && d.p) {
            try {
              c.publish(xferTopic(code), '', { qos: 1, retain: true }); // taken: the code is used up
            } catch (_) {}
            setTimeout(() => finish(profClean(d.p)), 300);
          }
        });
        c.on('error', () => {});
        cl.push(c);
      } catch (_) {}
    });
    setTimeout(() => finish(null), 9000);
  });
}
