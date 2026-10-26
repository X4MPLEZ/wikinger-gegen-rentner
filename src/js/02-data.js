/* 02-data.js - GAME DATA, no logic: KINDS (every unit type: role, hp, speed, damage, cost, special), FAC (the two factions), CFG (all balance numbers),
   PERKS / TIERS (chaos mode). Balance changes usually happen here only. (Map types: MAPTYPES in 03-map.js.) */
const KINDS = [
  {
    key: 'berserker',
    fac: 'viking',
    role: 'melee',
    name: TR('Berserker'),
    hp: 125,
    dmg: 18,
    cd: 0.95,
    range: 1.5,
    aggro: 8,
    speed: 5.0,
    cost: 55,
    build: 1.3,
    r: 0.5,
    sp: TR('Raserei + Wurf'),
    ego: { hp: 1.25, cd: 0.8, dmg: 1.15 },
    trait: TR(
      'Blutrausch: nach jedem Sieg schlägt er kurz schneller. Spezial: stemmt den Vordermann über den Kopf und wirft ihn in seine Kumpels'
    ),
  },
  {
    key: 'bogen',
    fac: 'viking',
    role: 'ranged',
    name: TR('Bogenschützin'),
    hp: 76,
    dmg: 14,
    cd: 1.2,
    range: 14,
    aggro: 16,
    speed: 4.0,
    cost: 60,
    build: 1.45,
    r: 0.5,
    sp: TR('Pfeilfächer'),
    proj: 'arrow',
    pspeed: 26,
    trait: TR('Weitschuss: größte Reichweite'),
  },
  {
    key: 'opa',
    fac: 'rentner',
    role: 'melee',
    name: TR('Krückstock-Opa'),
    hp: 175,
    dmg: 15,
    cd: 1.0,
    range: 1.5,
    aggro: 8,
    speed: 4.4,
    cost: 55,
    build: 1.3,
    r: 0.5,
    sp: TR('Stockwirbel'),
    trait: TR('Standfest: lässt sich kaum wegstoßen. Spezial: dreifacher Stockwirbel, dabei viel schneller'),
  },
  {
    key: 'oma',
    fac: 'rentner',
    role: 'ranged',
    name: TR('Gebiss-Oma'),
    hp: 90,
    dmg: 12,
    cd: 1.2,
    range: 12,
    aggro: 14,
    speed: 3.9,
    cost: 60,
    build: 1.45,
    r: 0.5,
    sp: TR('Gebiss-Salve'),
    proj: 'teeth',
    pspeed: 17,
    trait: TR('Klebegebiss: Treffer bremsen Gegner'),
  },
  {
    key: 'ziege',
    fac: 'viking',
    role: 'cav',
    name: TR('Ziegenreiter'),
    hp: 135,
    dmg: 16,
    cd: 1.0,
    range: 1.8,
    aggro: 10,
    speed: 7.0,
    cost: 75,
    build: 1.8,
    r: 0.75,
    sp: TR('Ramm-Anlauf'),
    trait: TR('Hörnerstoß: Anlauf-Treffer schleudern Gegner weg. Fliegende Körper kegeln alle um, die im Weg stehen'),
  },
  {
    key: 'rollator',
    fac: 'rentner',
    role: 'cav',
    name: TR('E-Mobil-Raser'),
    hp: 134,
    dmg: 16,
    cd: 1.0,
    range: 1.8,
    aggro: 10,
    speed: 7.8,
    cost: 75,
    build: 1.8,
    r: 0.75,
    sp: TR('Turbo'),
    trait: TR('Vollgas: schnellstes Gefährt im Spiel, Anlauf trifft besonders hart'),
  },
  {
    key: 'katapult',
    fac: 'viking',
    role: 'siege',
    name: TR('Wikinger-Katapult'),
    hp: 700,
    dmg: 70,
    cd: 4.2,
    range: 21,
    aggro: 23,
    speed: 1.8,
    cost: 220,
    build: 5,
    r: 1.4,
    sp: '',
    proj: 'boulder',
    pspeed: 14,
    aoe: 4.2,
    trait: TR('Der Fels rollt nach dem Einschlag weiter und walzt alles um'),
  },
  {
    key: 'torte',
    fac: 'rentner',
    role: 'siege',
    name: TR('Torten-Katapult'),
    hp: 700,
    dmg: 70,
    cd: 4.2,
    range: 21,
    aggro: 23,
    speed: 1.8,
    cost: 220,
    build: 5,
    r: 1.4,
    sp: '',
    proj: 'cake',
    pspeed: 14,
    aoe: 4.2,
    trait: TR('Hinterlässt eine Sahnepfütze: Wer drin steht, kommt kaum voran'),
  },
  {
    key: 'baerv',
    fac: 'viking',
    role: 'melee',
    bear: true,
    name: TR('Eisbär'),
    hp: 460,
    dmg: 26,
    cd: 1.15,
    range: 2.0,
    aggro: 10,
    speed: 4.8,
    cost: 0,
    build: 0,
    r: 0.95,
    sp: TR('Bärenklauen'),
  },
  {
    key: 'baerr',
    fac: 'rentner',
    role: 'melee',
    bear: true,
    name: TR('Eisbär'),
    hp: 460,
    dmg: 26,
    cd: 1.15,
    range: 2.0,
    aggro: 10,
    speed: 4.8,
    cost: 0,
    build: 0,
    r: 0.95,
    sp: TR('Bärenklauen'),
  },
  {
    key: 'wurmv',
    fac: 'viking',
    role: 'melee',
    worm: true,
    name: TR('Sandwurm'),
    hp: 640,
    dmg: 28,
    cd: 1.3,
    range: 2.9,
    aggro: 12,
    speed: 4.6,
    cost: 0,
    build: 0,
    r: 1.2,
    sp: TR('Verschlingen'),
    trait: TR('Gräbt sich unter die Gegner, packt bis zu drei mit seinen Greifern und verschlingt sie'),
  },
  {
    key: 'wurmr',
    fac: 'rentner',
    role: 'melee',
    worm: true,
    name: TR('Sandwurm'),
    hp: 640,
    dmg: 28,
    cd: 1.3,
    range: 2.9,
    aggro: 12,
    speed: 4.6,
    cost: 0,
    build: 0,
    r: 1.2,
    sp: TR('Verschlingen'),
    trait: TR('Gräbt sich unter die Gegner, packt bis zu drei mit seinen Greifern und verschlingt sie'),
  },
  {
    key: 'fass',
    fac: 'viking',
    role: 'melee',
    spec: 'bomb', // 16-sim-fass-falle.js
    name: TR('Feuerfass'),
    hp: 150,
    dmg: 10,
    cd: 1.1,
    range: 1.5,
    aggro: 10,
    speed: 5.4,
    cost: 65, // as dear as the Fallenleger (balance: tools/balance.py)
    build: 1.6,
    r: 0.55,
    sp: TR('Lunte zünden'),
    tag: TR('sprengt Schützen'),
    ego: { hp: 1, cd: 1, dmg: 1 },
    trait: TR(
      'Fass auf der Schulter, Fackel in der Hand: Wen er schlägt, der brennt und rennt schreiend davon. Stark gegen Fernkämpfer, Katapulte und Basen, schwach gegen Reiter. Das Pulverfass zündet nur, wer ihn selbst steuert, dann fliegen alle im Umkreis. Ein Kopfschuss lässt ihn sofort hochgehen. Neben einem eigenen Katapult steigt er ein und fliegt selbst!'
    ),
  },
  {
    key: 'falle',
    fac: 'rentner',
    role: 'melee',
    spec: 'trap',
    name: TR('Fallenleger'),
    hp: 130,
    dmg: 15, // per jaw of his row (FANG in 16-sim-fass-falle.js)
    cd: 1.3,
    range: 6.3, // the row of jaws reaches about 7 m (FANG): he strikes from a few steps away
    aggro: 10,
    speed: 4.3,
    cost: 65,
    build: 1.5,
    r: 0.5,
    sp: TR('Falle werfen'),
    tag: TR('stellt Fallen'),
    trait: TR(
      'Rammt den Spaten in den Boden: Eine Reihe alter Fangeisen schnappt nacheinander aus der Erde. Jeder auf der Linie wird gebissen und hängt kurz fest (Reiter länger), auch Basen bekommen ordentlich ab. Spezial: wirft seine Bärenfalle, die der Gegner kaum sieht; eine liegende holt er zurück und wirft sie neu'
    ),
  },
];
const NO_EGO = { hp: 1, cd: 1, dmg: 1 };
const ROLE_NAME = { melee: TR('Nahkampf'), ranged: TR('Fernkampf'), cav: TR('Reiter'), siege: TR('Katapult') };
const BEATS = { melee: 'cav', cav: 'ranged', ranged: 'melee' };
const MULT = { melee: 1.5, cav: 1.0, ranged: 2.2 };
const FAC = {
  viking: {
    name: TR('Wikinger'),
    res: TR('Gold'),
    base: TR('Langhaus'),
    css: '#4f86c4',
    col: 0x3b6ea5,
    kinds: [0, 1, 4, 12, 6], // the order of the recruit bar (the special warrior between the rider and the catapult)
    other: 'rentner',
    icon: 'coin',
  },
  rentner: {
    name: TR('Rentner'),
    res: TR('Pfand'),
    base: TR('Haus Abendrot'),
    css: '#c07aa8',
    col: 0xa0628f,
    kinds: [2, 3, 5, 13, 7],
    other: 'viking',
    icon: 'bottle',
  },
};
const CFG = {
  startGold: 160,
  baseInc: 5.6, // gold per second (v55: +25 %, more warriors on the field)
  flagInc: 1.5,
  incGrow: 0.15,
  incGrowMax: 2.5,
  kill: 4,
  underdogKill: 3,
  siegeBounty: 50,
  pop: 50,
  queueMax: 10,
  baseHp: 1500,
  baseR: 5.5,
  homeR: 24,
  homeArmor: 0.75,
  homeDmg: 1.2,
  phaseT: [420, 570],
  crumbleT: 720,
  siegeMax: 4,
  wagonGold: 6,
  underPop: 14,
  underGold: 0.7,
  crumble: 4,
  phaseBase: [1, 1.5, 2.2],
  phaseTower: [1, 1, 0.6],
  towerRange: 15,
  towerPossRange: 31,
  towerDmg: 18,
  towerCd: 0.8,
  towerPoss: 4,
  baseArmor: 0.45,
  flagIncDeep: 1,
  towerSpeed: 24,
  flagR: 6,
  capTime: 5,
  leash: 11,
  hillBonus: 3,
  spCd: 8, // special recharge in s (see SP_CD for the faster ones)
  possDmg: { melee: 1.5, cav: 1.4, ranged: 1.25 },
  possArmor: 0.8,
  possHp: 1.6,
  possRegen: 2.5,
  possCd: 0.85,
  headMul: 3.6,
  downT: 1.75,
  egoKnockCd: 8,
  arrowSpeed: 46,
  rush: 150,
  healR: 16,
  heal: 6,
};
/* Melee combos of a steered warrior (melee and riders): three blows in a row, each within `win` × the attack time of the last one.
   The 3rd is the finisher: much more damage, it knocks the enemies back. Blows 1 and 2 come faster, the finisher has a longer recovery.
   The client counts the combo and sends its step (input packet cb); the host checks it (possAttack). */
// specials that recharge faster than CFG.spCd: the Krückstock-Opa's Stockwirbel a little faster than the Berserker's rage
const SP_CD = { 0: 6.5, 2: 5.5, 12: 1, 13: 2 };
// the Krückstock-Opa's Stockwirbel: three turns in t seconds, running speed times speed meanwhile, and every pulse s the stick knocks
// everyone in r m away again (dmg)
const WHIRL = { t: 1.05, turns: 3, speed: 1.9, pulse: 0.35, dmg: 20, r: 3.4 };
// the recharge time of kind k's special (siege, bears and sandworms have their own)
function spCdOf(k) {
  const K = KINDS[k];
  return K.role === 'siege' ? 14 : K.bear ? 6 : K.worm ? 9 : (SP_CD[k] ?? CFG.spCd);
}
// (v56: an ego melee warrior strikes a little faster and a little softer)
const CMB = { win: 1.9, dmg: [0.86, 0.96, 1.5], cd: [0.7, 0.7, 1.15] };
const maxHp = u => u.mhp || KINDS[u.k].hp;
const SIEGE_EGO_REACH = 6; // the aiming ring and the simulation clamp an ego catapult shot to the same distance
/* Chaos-mode perks. Rules of thumb (checked with tools/balance.py, computer vs computer):
   - every perk helps the whole army (also for a commander player and the computer); ego bonuses come on top, pure ego perks are at most rare
   - Gewöhnlich: a small, always useful edge · Selten: a specialisation · Episch: a new way to play · Legendär: a spectacle, still counterable
   - the first offer has no epic or legendary perk; the tiers open up offer by offer, and the side that is behind draws better (makeOffer)
   t tier 0-3, ic icon, n name, d what it does (German, shown on the card), f only for this faction. Effects: grep the id in src/js. */
const PERKS = {
  gold: { t: 0, ic: si('coins'), n: TR('Geldregen'), d: TR('+20 % Einkommen') },
  flagger: { t: 0, ic: si('flag'), n: TR('Fahnenträger'), d: TR('Fahnen 2,5× schneller erobern') },
  heal: { t: 0, ic: si('heal'), n: TR('Heilquelle'), d: TR('Deine Krieger heilen sich überall') },
  cavspd: { t: 0, ic: si('horseshoe'), n: TR('Galopp'), d: TR('Reiter +50 % Tempo und +25 % Schaden') },
  hens: { t: 0, ic: si('chicken'), n: TR('Hühnerarmee'), d: TR('Einmalig: 40 Hühner schlüpfen an deiner Basis und stürmen los') },
  moon: { t: 0, ic: si('moon'), n: TR('Mondschwerkraft'), d: TR('Umgestoßene Gegner fliegen sehr hoch und lange') },
  charge: { t: 0, ic: si('battery'), n: TR('Spezial-Akku'), d: TR('Spezialfähigkeiten laden 3× schneller') },
  arrows: { t: 1, ic: si('arrow'), n: TR('Scharfe Pfeile'), d: TR('Fernkämpfer machen 60 % mehr Schaden') },
  tower: { t: 1, ic: si('tower'), n: TR('Turmwache'), d: TR('Basisturm: mehr als doppelter Schaden, schießt schneller') },
  bounty: { t: 1, ic: si('crown'), n: TR('Kopfgeld'), d: TR('Gold- und Pfandrausch bringen doppelt so viel') },
  kegel: {
    t: 1,
    ic: si('pin'),
    n: TR('Kegelkönig'),
    d: TR('Von dir umgehauene Gegner kegeln weiter: kaum Bremsen, fast vierfacher Schaden'),
  },
  wall: { t: 1, ic: si('wall'), n: TR('Schildwall'), d: TR('Nahkämpfer nehmen von Pfeilen, Gebissen und Katapulten nur halben Schaden') },
  dance: { t: 1, ic: si('dance'), n: TR('Discogranaten'), d: TR('Ego-Krieger wirft Discokugeln: Gegner müssen tanzen') },
  jump: { t: 1, ic: si('spring'), n: TR('Sprungfedern'), d: TR('Ego: springen – die Landung haut Gegner um') },
  turbo: { t: 1, ic: si('bolt'), n: TR('Turbo-Held'), d: TR('Ego: dein Krieger rennt doppelt so schnell') },
  bighead: { t: 1, ic: si('bighead'), n: TR('Dickschädel'), d: TR('Ego: +40 % Schaden, aber Riesenkopf – Pfeile treffen doppelt hart') },
  armor: { t: 2, ic: si('shield'), n: TR('Eiserne Haut'), d: TR('Deine Krieger nehmen 18 % weniger Schaden') },
  chicken: {
    t: 2,
    ic: si('chicken'),
    n: TR('Hühnerfluch'),
    d: TR('Alle 12 s werden vier gegnerische Krieger 8 s lang zu harmlosen Hühnern'),
  },
  berserk: {
    t: 2,
    ic: si('axe'),
    n: TR('Berserkerwut'),
    d: TR('Nahkämpfer doppelter Schaden – nehmen aber 25 % mehr von Fernkampf und Ego'),
  },
  volley: {
    t: 2,
    ic: si('target'),
    n: TR('Salvenhölle'),
    d: TR('Deine Fernkämpfer schießen immer doppelt · Ego-Salve +5 Geschosse'),
  },
  ram: {
    t: 2,
    ic: si('burst'),
    n: TR('Abrissbirne'),
    d: TR('Reiter-Anläufe treffen härter und hauen Gegner weit weg · Ego-Rammstoß schleudert 4× so weit'),
  },
  spin: {
    t: 2,
    ic: si('tornado'),
    n: TR('Tornado-Opa'),
    d: TR('Krückstock-Opas wirbeln alle 6 s im Kampf · Ego-Wirbel riesig'),
    f: 'rentner',
  },
  bite: { t: 2, ic: si('teeth'), n: TR('Beißgebiss'), d: TR('Oma-Gebisse setzen sich auf den Kopf und knabbern 4 s weiter'), f: 'rentner' },
  walhalla: {
    t: 2,
    ic: si('axes'),
    n: TR('Walhalla-Raserei'),
    d: TR('Angeschlagene Berserker rasen: schneller, härter und hauen um · Ego-Raserei 10 s'),
    f: 'viking',
  },
  stampede: {
    t: 2,
    ic: si('goat'),
    n: TR('Ziegen-Stampede'),
    d: TR('Ziegen sind zäher, ihre Anläufe treffen und werfen auch die Nachbarn um · Ego: riesige Schneise'),
    f: 'viking',
  },
  giant: { t: 3, ic: si('giant'), n: TR('Riesenwuchs'), d: TR('Deine Krieger werden riesig: +20 % Leben, +10 % Schaden') },
  twins: { t: 3, ic: si('twins'), n: TR('Doppelpack'), d: TR('Jede vierte Ausbildung bringt einen Krieger gratis dazu') },
  catapult: { t: 3, ic: si('boulder'), n: TR('Katapult'), d: TR('Alle 30 s rollt ein mächtiges Katapult aus deiner Basis') },
  meteor: { t: 3, ic: si('meteor'), n: TR('Meteoritenhagel'), d: TR('Alle 30 s regnen Meteore auf gegnerische Krieger') },
  quake: { t: 3, ic: si('quake'), n: TR('Erdbeben'), d: TR('Alle 22 s bebt die Erde unter der größten Gegnergruppe: alle fliegen um') },
  revive: {
    t: 3,
    ic: si('sprout'),
    n: TR('Unkraut vergeht nicht'),
    d: TR('Jeder vierte gefallene Krieger kommt nach 4 s an deiner Basis zurück'),
  },
};
const TIERS = [
  { n: TR('Gewöhnlich'), c: '#5fbf6a', w: 44 },
  { n: TR('Selten'), c: '#4d9be6', w: 30 },
  { n: TR('Episch'), c: '#a865e0', w: 18 },
  { n: TR('Legendär'), c: '#f0a92e', w: 8 },
];
// Fog (fog mode and the "Nebelwand" event): who sees how far, as [clear up to, fog complete at] in metres. The player's view
// (FOG.own in 70-world-view.js) and the computer's knowledge (aiVision in 15-ai.js) use the same numbers: both sides see the same.
const FOG_SIGHT = {
  unit: [9, 16], // every warrior
  scout: [14, 23], // riders scout ahead
  torch: [13, 23], // the steered warrior carries a lantern ...
  lanternSeen: 24, // ... and the lantern is seen from this far
  base: [20, 29],
  flag: [13, 22], // a held flag is a watchtower
  siege: [17, 27], // warriors at the enemy base light it up
  siegeNear: 18, // (that close to its centre)
  memory: 6, // seconds the computer remembers where it last saw someone (the player gets tracks for as long, 74-fog-guides.js)
};
const fogSightOf = (role, poss) => (poss ? FOG_SIGHT.torch : role === 'cav' ? FOG_SIGHT.scout : FOG_SIGHT.unit);
// Hühnerarmee: the chickens are warriors of the faction's melee kind with u.hen set: few hit points, weak pecks (hardly any against the
// base), fast feet; they do not count for the army size and give no kill gold. Taken over, a chicken pecks (no special, no counters)
const HEN = { n: 40, hp: 28, dmg: 0.4, base: 0.12, speed: 1.3 };
/* A steered chicken flies: holding the special key it rises slowly (up m/s) up to max m above the ground, let go it sinks (down m/s);
   attack in the air = a dive (dive m/s) that pecks everyone around on landing (diveDmg × a peck). It cannot land on water, rocks or
   trees (floor). Above `air` metres no sword, hoof, bear or worm reaches it – arrows, false teeth and the base tower still do. The
   client predicts the height and sends it (input packet fh); the host only accepts what these speeds allow. */
const HFLY = { up: 2.4, down: 1.6, dive: 16, max: 17, floor: 2.4, air: 1.6, spd: 1.3, diveDmg: 3.5, diveR: 2.2 };
const aloft = u => (u.fh || 0) > HFLY.air;
const PERK_IDS = Object.keys(PERKS),
  PERK_EVERY = 30,
  PERK_MAX = 7,
  PERK_TIME = 10;
const pkL = (G, team, id) => (G && G.chaos && G.teams[team].pk[id] ? 1 : 0);
const pk = (G, team, id, arr) => arr[pkL(G, team, id)];
function headBox(e) {
  const s = e.poss ? 1.35 * (e.hs || 1) : 0.62,
    b = e.k === 4 ? 0.6 : e.k === 5 ? 0.25 : 0,
    g = e.gs || 1;
  return { y: (b + 1.3 + 0.5 * s) * 1.25 * g, r: 0.58 * s * 1.25 * g };
}
function setPoss(u, on) {
  if (!!u.poss === on) return;
  const K = KINDS[u.k],
    base = u.hen ? HEN.hp : (u.gs ? 1.6 : 1) * K.hp,
    sg = K.role === 'siege',
    ph = sg ? 0.8 : CFG.possHp * (K.ego ? K.ego.hp : 1);
  if (on) {
    u.poss = true;
    u.mhp = base * ph;
    u.hp = Math.min(u.mhp, u.hp * (sg ? CFG.possHp : ph));
  } else {
    u.poss = false;
    u.hp = Math.max(1, Math.min(base, u.hp / ph));
    u.mhp = u.gs || u.hen ? base : undefined;
    u.aim = null;
  }
}
const HALF_W = 34,
  HALF_H = 74;
const ISLAND = { w: 96, h: 178 };
const CELL = 1.5,
  GW = Math.ceil((2 * HALF_W) / CELL),
  GH = Math.ceil((2 * HALF_H) / CELL);
const WL = -0.6;
const DT = 0.05;
const QUOTES = {
  10: { spawn: [TR('SSSSSS…'), TR('Ich gehöre jetzt euch!')], die: [TR('Ssss…')], hit: [TR('HAPP!'), TR('SCHLUCK!')] },
  11: { spawn: [TR('SSSSSS…'), TR('Ich gehöre jetzt euch!')], die: [TR('Ssss…')], hit: [TR('HAPP!'), TR('SCHLUCK!')] },
  8: { spawn: [TR('BRUMMM!'), TR('Ich gehöre jetzt euch!')], die: [TR('Brumm…')], hit: [TR('RAAAR!'), TR('GRRR!')] },
  9: { spawn: [TR('BRUMMM!'), TR('Ich gehöre jetzt euch!')], die: [TR('Brumm…')], hit: [TR('RAAAR!'), TR('GRRR!')] },
  0: {
    spawn: [TR('Für Odin!'), 'SKÅL!', TR('Wo ist der Met?'), TR('Ich will plündern!')],
    die: [TR('Walhalla, ich komme!'), TR('Grüß Odin…')],
    hit: [TR('ZACK!'), TR('KRACH!')],
  },
  1: { spawn: [TR('Ich treffe alles!'), TR('Pfeile frisch gespitzt!'), TR('Für die Sippe!')], die: [TR('Autsch, Walhalla…')], hit: [] },
  2: {
    spawn: [TR('Früher war alles besser!'), TR('Ich ruf die Polizei!'), TR('Wo ist meine Brille?'), TR('Ihr jungen Leute!')],
    die: [TR('Mein Rücken…'), TR('Ich leg mich kurz hin…')],
    hit: [TR('BONK!'), TR('ZACK!')],
  },
  3: {
    spawn: [TR('Wer will Kekse?'), TR('Iss was, Junge!'), TR('Zu meiner Zeit…'), TR('Mein Gebiss fliegt!')],
    die: [TR('Mein Gebiss…'), TR('Ach, du liebe Zeit!')],
    hit: [TR('KLAPPER!')],
  },
  4: {
    spawn: [TR('MÄÄÄH!'), TR('Hü, Ziege, hü!'), TR('Volle Hörner voraus!')],
    die: [TR('Die Ziege war schuld!')],
    hit: [TR('MÄÄH!'), TR('RUMMS!')],
  },
  6: {
    spawn: [TR('KATAPULT! Alle in Deckung!'), TR('Steine fliegen gleich!')],
    die: [TR('Das Holz war morsch…')],
    hit: [TR('RUMMS!'), TR('KRAWUMM!')],
  },
  12: {
    spawn: [TR('Wer hat Feuer?'), TR('Vorsicht, explosiv!'), TR('Odin, halt mein Met!'), TR('Rauchen verboten!')],
    die: [TR('Das ging nach hinten los…'), TR('Mein schönes Fass…')],
    hit: [TR('RUMMS!'), TR('BONG!')],
  },
  13: {
    spawn: [TR('Ich hab da was vorbereitet…'), TR('Vorsicht, wo ihr hintretet!'), TR('Schnapp!'), TR('Früher hab ich Wölfe gefangen!')],
    die: [TR('In die eigene Falle…'), TR('Meine Hüfte…')],
    hit: [TR('SCHNAPP!'), TR('KLONG!'), TR('PATSCH!')],
  },
  7: {
    spawn: [TR('Wer bestellt Torte?'), TR('Frisch gebacken und geschleudert!')],
    die: [TR('Die Sahne ist sauer…')],
    hit: [TR('SPLATSCH!'), TR('SAHNE!')],
  },
  5: {
    spawn: [TR('Platz da, ich hab Vorfahrt!'), TR('Tempo 6 war gestern!'), TR('Turbo an!')],
    die: [TR('Der TÜV hatte recht…')],
    hit: [TR('HUP HUP!'), TR('RUMMS!')],
  },
};
const SP_WORD = {
  0: TR('RASEREI! WURF!'),
  1: TR('PFEILFÄCHER!'),
  2: TR('STOCKWIRBEL!'),
  3: TR('GEBISS-SALVE!'),
  4: TR('MÄÄÄÄH!'),
  5: TR('HUP HUP!'),
  8: TR('BÄRENKLAUEN!'),
  9: TR('BÄRENKLAUEN!'),
  10: TR('VERSCHLINGEN!'),
  11: TR('VERSCHLINGEN!'),
  12: TR('TSSSSS!'),
  13: TR('SCHNAPP!'),
};
