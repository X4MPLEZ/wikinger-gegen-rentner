/* 68-wiki.js - THE WIKI: everything about every warrior, for players who want to dig in or who wait for an online opponent. Per warrior
   a funny story, how he fights, his numbers (read from KINDS and the rules, so they are always right), whom he beats and who beats him,
   tips and tricks; the 3D showcase (67-showcase.js) turns him on the page (drag to turn). A page with the rules: rock-paper-scissors and
   where the two special warriors fit in. Opens from the menu, while waiting for an online opponent, from the lobby and the pause menu
   (wikiOpen(from)); closing goes back there. Purely client side. */
const WIKI = { from: 'menu', tab: 'viking', k: { viking: 0, rentner: 2, wild: 8 } };
const WIKI_TABS = ['viking', 'rentner', 'wild', 'rules'];
// whom he beats, who beats him (kinds; the page shows their faces)
const WIKI_VS = {
  0: [
    [4, 5],
    [1, 3],
  ],
  1: [
    [0, 2, 13],
    [4, 5, 12],
  ],
  2: [
    [4, 5],
    [1, 3],
  ],
  3: [
    [0, 2, 13],
    [4, 5, 12],
  ],
  4: [
    [1, 3, 6, 7, 12],
    [0, 2, 13],
  ],
  5: [
    [1, 3, 6, 7, 12],
    [0, 2, 13],
  ],
  6: [
    [1, 3, 8],
    [4, 5, 12],
  ],
  7: [
    [1, 3, 8],
    [4, 5, 12],
  ],
  8: [
    [0, 2, 4, 5, 12, 13],
    [1, 3, 6, 7],
  ],
  10: [
    [0, 2, 4, 5, 12, 13],
    [1, 3],
  ],
  12: [
    [1, 3, 6, 7],
    [4, 5],
  ],
  13: [
    [4, 5],
    [1, 3],
  ],
};
// the texts of a warrior: s story, h how he fights, t tips (German; translated when shown)
function wikiText(k) {
  switch (k) {
    case 0:
      return {
        s: TR(
          'Björn der Unrasierte hat einmal einen Bären zum Armdrücken herausgefordert und verloren. Seitdem trainiert er jeden Morgen mit seiner Axt und brüllt dabei so laut, dass die Möwen auswandern. Wenn ihm im Kampf die Puste ausgeht, wird er erst richtig wütend.'
        ),
        h: TR(
          'Nahkämpfer mit Axt und Schild. Nach jedem besiegten Gegner schlägt er eine Weile schneller (Blutrausch). Selbst gesteuert hält er mehr aus, schlägt schneller und härter, und seine Spezialfähigkeit ist die Raserei: Er packt den Vordermann, stemmt ihn über den Kopf und schleudert ihn wie eine Kegelkugel in dessen Kumpels.'
        ),
        t: [
          TR('Schick Berserker gegen Reiter: Nahkampf schlägt Reiter.'),
          TR('Auf Abstand verliert er gegen Bogenschützinnen und Gebiss-Omas. Lass ihn hinter deinen Reitern nachrücken.'),
          TR('Selbst gesteuert: Raserei mitten im Getümmel zünden, den Vordermann hochstemmen, dich zu seinen Kumpels drehen und werfen.'),
        ],
      };
    case 1:
      return {
        s: TR(
          'Astrid trifft eine Fliege auf hundert Schritt, sagt sie. Bewiesen hat es noch keiner, denn die Fliegen trauen sich nicht mehr in ihre Nähe. Ihren Bogen nennt sie liebevoll „Pieks“.'
        ),
        h: TR(
          'Die größte Reichweite im Spiel, und von Hügeln schießt sie noch weiter. Selbst gesteuert spannst du den Bogen und zielst frei. Kopfschüsse sind besonders gemein. Spezialfähigkeit: der Pfeilfächer, fünf Pfeile auf einmal.'
        ),
        t: [
          TR('Hinter einer Reihe Nahkämpfer aufstellen: Fernkampf schlägt Nahkampf.'),
          TR('Bring sie vor Reitern und Feuerfässern in Sicherheit.'),
          TR('Auf Hügeln aufstellen: Von oben reicht der Bogen weiter.'),
          TR(
            'Ein Feuerfass im Anmarsch? Schieß, bevor es da ist: Ein Kopfschuss lässt sein Fass mitten zwischen seinen eigenen Leuten hochgehen. Kommt es nah heran, lauf weg.'
          ),
        ],
      };
    case 2:
      return {
        s: TR(
          'Opa Herbert war 1962 Vize-Kreismeister im Stockfechten. Seine Krücke braucht er eigentlich gar nicht. Er hat sie nur, um jungen Leuten damit auf die Finger zu klopfen. Und Wikingern auf den Helm.'
        ),
        h: TR(
          'Zäher Nahkämpfer mit viel Leben, der sich kaum wegstoßen lässt (standfest). Spezialfähigkeit: der Stockwirbel. Er dreht sich dreimal mit ausgestrecktem Stock, saust dabei viel schneller übers Feld und haut alle um sich herum weg.'
        ),
        t: [
          TR('Stell ihn gegen Reiter: Nahkampf schlägt Reiter, und er steht wie eine Eiche.'),
          TR('Mit dem Stockwirbel fegst du Gegner auf der Klippen-Karte über die Kante.'),
          TR(
            'Im Stockwirbel bist du schnell: Wirbel mitten durch eine Gruppe hindurch. Gegen Bogenschützinnen braucht er trotzdem Hilfe von deinen E-Mobil-Rasern.'
          ),
        ],
      };
    case 3:
      return {
        s: TR(
          'Oma Gertrud hat drei Gebisse: eins zum Essen, eins für Sonntag und eins zum Werfen. Das dritte ist inzwischen das wichtigste. Mit Haftcreme bestrichen bleibt es an jedem Wikinger kleben.'
        ),
        h: TR(
          'Fernkämpferin: Ihre Gebisse kleben, getroffene Gegner werden langsamer (Klebegebiss). Spezialfähigkeit: die Gebiss-Salve, ein ganzer Fächer Gebisse auf einmal.'
        ),
        t: [
          TR('Hinter deine Opas stellen: Fernkampf schlägt Nahkampf.'),
          TR('Gebremste Gegner sind leichte Beute für deine Opas.'),
          TR('Schütze sie vor Ziegenreitern und Feuerfässern.'),
        ],
      };
    case 4:
      return {
        s: TR(
          'Sven wollte eigentlich ein Pferd. Bekommen hat er Gerda, eine Ziege mit Hörnern wie Eisenstangen und der Laune eines Gewitters. Zusammen haben sie schon drei Zäune, zwei Brücken und eine Hochzeit gesprengt.'
        ),
        h: TR(
          'Schneller Reiter mit Axt. Mit Anlauf schleudert der Hörnerstoß Gegner weg, und fliegende Körper kegeln alle um, die im Weg stehen. Spezialfähigkeit: der Ramm-Anlauf, ein Sprint, der Katapulte sofort zerbricht.'
        ),
        t: [
          TR('Jag Gebiss-Omas: Reiter überrennen Fernkampf.'),
          TR(
            'Gegnerische Katapulte sind deine Lieblingsbeute, Feuerfässer gleich danach: Renn sie um, bevor sie bei deinen Schützinnen sind.'
          ),
          TR('Auf der Klippen-Karte schubst dein Anlauf Gegner über die Kante.'),
          TR('Vorsicht vor Opas und den Fangeisen des Fallenlegers: Die halten Reiter lange fest.'),
        ],
      };
    case 5:
      return {
        s: TR(
          'Heinz hat seinen Führerschein 1971 gemacht und betrachtet jedes Tempolimit seitdem als freundliche Empfehlung. Sein E-Mobil hat er selbst frisiert: Hupe, Turbo-Knopf und ein Wackeldackel als Glücksbringer.'
        ),
        h: TR(
          'Das schnellste Gefährt im Spiel, mit Anlauf trifft er besonders hart. Spezialfähigkeit: der Turbo, ein Sprint, der Katapulte sofort zerbricht.'
        ),
        t: [
          TR('Jag Bogenschützinnen: Reiter überrennen Fernkampf.'),
          TR('Mit dem Turbo mitten durchs gegnerische Katapult.'),
          TR('Meide Berserker im Nahkampf. Feuerfässer dagegen fährst du einfach um.'),
        ],
      };
    case 6:
      return {
        s: TR(
          'Gebaut aus einem umgekippten Langschiff und viel gutem Willen. Die Mannschaft behauptet, sie könne damit einen Felsen bis nach Rom werfen. Bisher hat sie zweimal die eigene Scheune getroffen.'
        ),
        h: TR(
          'Wirft Felsen weit über das Schlachtfeld und trifft Basen mit voller Wucht. Der Fels rollt nach dem Einschlag weiter und walzt alles um. Selbst gesteuert zielst du frei, die Spezialfähigkeit ist eine Salve aus mehreren Würfen.'
        ),
        t: [
          TR('Hinter der eigenen Front aufstellen und Basis oder Gegnerhaufen beschießen.'),
          TR('Reiter und Feuerfässer zerlegen Katapulte im Nu. Stell Nahkämpfer zum Schutz daneben.'),
          TR('Ein Feuerfass passt hinein: Dann ist der nächste Wurf ein explodierendes Fass.'),
        ],
      };
    case 7:
      return {
        s: TR(
          'Eigentlich für den Kuchenbasar gebaut, als die Schlange zu lang wurde. Heute fliegen Sahnetorten mit Kirsche obendrauf. Das Rezept ist streng geheim, angeblich ist Beton drin.'
        ),
        h: TR(
          'Wirft Torten weit über das Schlachtfeld und trifft Basen mit voller Wucht. Wo eine Torte landet, bleibt eine Sahnepfütze, in der man kaum vorankommt. Selbst gesteuert zielst du frei, die Spezialfähigkeit ist eine Salve aus mehreren Würfen.'
        ),
        t: [
          TR('Sahnepfützen auf Brücken und Engstellen bremsen ganze Armeen.'),
          TR('Reiter und Feuerfässer zerlegen Katapulte im Nu. Stell Opas zum Schutz daneben.'),
        ],
      };
    case 8:
      return {
        s: TR(
          'Der Eisbär wollte nur in Ruhe Fisch essen. Dann kamen Wikinger und Rentner und erklärten seine Eisscholle zum Schlachtfeld. Seitdem ist er schlecht gelaunt.'
        ),
        h: TR(
          'Lebt auf der Arktis-Karte. Wer ihn angreift, den verfolgt er eine Weile. Wer ihn besiegt, dem schließt er sich an und kämpft für ihn, mit Pranken, die Nahkämpfer und Reiter zerlegen. Selbst gesteuert ist seine Spezialfähigkeit ein Hagel aus Prankenhieben.'
        ),
        t: [
          TR('Erleg ihn mit Fernkämpfern oder Katapulten: Pfeile, Gebisse, Felsen und Torten treffen Bären besonders hart.'),
          TR('Ein gezähmter Eisbär ist wie ein Panzer: Schick ihn gegen Nahkämpfer und Reiter.'),
        ],
      };
    case 10:
      return {
        s: TR('Der Sandwurm schläft unter den Dünen und träumt von Snacks. Wer zu laut über seinen Sand trampelt, wird einer.'),
        h: TR(
          'Lebt unter den Dünen der Wüsten-Karte. Der Sand zittert eine Sekunde, dann schießt er hoch, packt bis zu vier Krieger und verschlingt sie. Danach ist er kurz verwundbar. Wer ihn besiegt, dem schließt er sich an. Und jeder selbst gesteuerte Krieger kann „Den Helden spielen“ und sich auf einen Sandwurm stürzen.'
        ),
        t: [
          TR('Zittert der Sand: sofort raus aus dem Ring!'),
          TR('Taucht er auf, mit Fernkämpfern draufhalten.'),
          TR('Ein gezähmter Sandwurm gräbt sich unter Gegnergruppen und verschlingt sie.'),
        ],
      };
    case 12:
      return {
        s: TR(
          'Knut hat als Kind das Silvesterfeuerwerk des ganzen Dorfes auf einmal gezündet. Statt Ärger gab es eine Beförderung: Jetzt schleppt er ein Pulverfass auf der Schulter und eine Fackel in der Hand, und sein Helm ist ein kleines Fass, das immer ein bisschen qualmt.'
        ),
        h: TR(
          'Jeder Schlag mit der Fackel setzt das Opfer in Brand: Es rennt schreiend herum und springt ins Wasser, wenn welches in der Nähe ist. Gegen Bogenschützinnen, Gebiss-Omas, Katapulte und Basen ist er besonders stark, Reiter rennen ihn dagegen einfach um. Das Pulverfass zündet er nur, wenn du ihn selbst steuerst (Spezialfähigkeit = Lunte): Kurz danach fliegt alles im Umkreis, auch eine nahe gegnerische Basis bekommt viel ab. Fällt er, bevor die Lunte brennt, platzt das Fass kleiner. Brennt sie schon, geht es trotzdem voll hoch, und ein Kopfschuss lässt es sofort hochgehen. Neben einem eigenen Katapult steigt er ein und fliegt selbst!'
        ),
        t: [
          TR('Übernimm ihn, lauf mitten in einen Haufen Gegner und zünde die Lunte.'),
          TR('Steig ins Katapult und schieß dich auf die gegnerische Basis.'),
          TR(
            'Schick ihn gegen Bogenschützinnen, Gebiss-Omas und Katapulte. Aber Vorsicht auf dem Weg dorthin: Ein Kopfschuss, und dein Fass knallt zwischen deinen eigenen Leuten.'
          ),
          TR('Halt ihn von Reitern fern, die rennen ihn um. Und gegen ihn: Reiter schicken, Wasser löscht, Kopfschüsse sind Gold wert.'),
        ],
      };
    case 13:
      return {
        s: TR(
          'Opa Waldemar war vierzig Jahre Jäger im Kleingartenverein, gefangen hat er aber nie etwas außer dem Nachbarn. Jetzt hat er den Dreh raus: Er rammt seinen Spaten in den Boden, und eine ganze Reihe alter Fangeisen schnappt aus der Erde. Seine Waschbärmütze trägt er auch im Hochsommer.'
        ),
        h: TR(
          'Sein Angriff reicht ein paar Schritte weit: Eine Reihe Fangeisen schnappt nacheinander aus dem Boden. Jeder auf der Linie wird gebissen und hängt kurz fest, Reiter länger, und auch eine gegnerische Basis bekommt ordentlich ab. Spezialfähigkeit: Er wirft seine Bärenfalle dorthin, wo der Ring zeigt, und der Gegner sieht sie kaum. Wer hineintritt, sitzt fest und wird zerbissen, auch mehrere auf einmal. Eine liegende Falle holt er zurück und wirft sie neu.'
        ),
        t: [
          TR('Gegen Reiter ist er Gold wert: Die Fangeisen halten sie lange fest.'),
          TR('Wirf die Falle auf den Weg, den der Gegner nehmen muss: Brücken, Engstellen, vor die Fahne.'),
          TR('Stell dich so, dass die Gegner in einer Linie vor dir stehen. Dann erwischt die Reihe alle.'),
          TR('Gegen Bogenschützinnen verliert er: Halte Abstand oder schick Reiter vor.'),
        ],
      };
  }
  return { s: '', h: '', t: [] };
}
// the warriors of a tab
const wikiKinds = tab => (tab === 'wild' ? [8, 10] : FAC[tab].kinds);
function wikiOpen(from) {
  WIKI.from = from || 'menu';
  showScreen('wikiScr');
  wikiUi();
}
function wikiClose() {
  showScreen(WIKI.from);
}
const WIKI_ROLE = () => ({
  melee: TR('Nahkampf'),
  ranged: TR('Fernkampf'),
  cav: TR('Reiter'),
  siege: TR('Belagerung'),
});
// one number tile
const wikiKpi = (label, val, note) => `<div class="wkpi"><small>${label}</small><b>${val}</b>${note ? `<i>${note}</i>` : ''}</div>`;
function wikiStats(k) {
  const K = KINDS[k],
    fac = K.bear || K.worm ? null : FAC[K.fac],
    out = [];
  out.push(wikiKpi(TR('Leben'), K.hp));
  if (k === 13) out.push(wikiKpi(TR('Schaden'), TR('{0} je Fangeisen', K.dmg), TR('bis zu {0} Fangeisen in einer Reihe', FANG.n)));
  else if (K.role === 'siege') out.push(wikiKpi(TR('Schaden'), K.dmg, TR('Flächenschaden')));
  else out.push(wikiKpi(TR('Schaden'), K.dmg, k === 12 ? TR('+ Feuer: {0} pro Sekunde', FASS.burnDps) : ''));
  out.push(wikiKpi(TR('Angriffstempo'), TR('alle {0} s', numL(K.cd))));
  out.push(wikiKpi(TR('Schaden pro Sekunde'), numL(Math.round((K.dmg / K.cd) * 10) / 10)));
  out.push(wikiKpi(TR('Reichweite'), TR('{0} m', numL(K.range))));
  out.push(wikiKpi(TR('Tempo'), TR('{0} m/s', numL(K.speed))));
  if (fac) out.push(wikiKpi(TR('Kosten'), K.cost + ' ' + fac.res, TR('Ausbildung {0} s', numL(K.build))));
  else out.push(wikiKpi(TR('Kosten'), TR('keine'), TR('wild: wer ihn besiegt, bekommt ihn')));
  if (K.sp) out.push(wikiKpi(TR('Spezialfähigkeit'), K.sp, TR('lädt in {0} s', numL(spCdOf(k)))));
  if (k === 12)
    out.push(wikiKpi(TR('Explosion'), TR('{0} Schaden', FASS.dmg), TR('Umkreis {0} m, gegen Basen {1}', numL(FASS.r), FASS.base)));
  if (k === 13)
    out.push(
      wikiKpi(
        TR('Bärenfalle'),
        TR('{0} + {1} pro Sekunde', TRAP.dmg, TRAP.dps),
        TR('hält bis zu {0} s, wirft {1} m weit', numL(TRAP.hold), numL(TRAP.throw))
      )
    );
  return out.join('');
}
// a warrior's picture: his face, a catapult as a still of the machine
const wikiPic = k => (KINDS[k].role === 'siege' ? unitThumb(k) : PORTRAIT[k]);
const wikiImg = k => `<img src="${wikiPic(k)}" alt=""${KINDS[k].role === 'siege' ? ' class="wmach"' : ''}>`;
// the faces of a few warriors (strong / weak against)
const wikiFaces = ks =>
  ks.map(k => `<button class="wface" data-k="${k}" title="${KINDS[k].name}">${wikiImg(k)}<span>${KINDS[k].name}</span></button>`).join('');
function wikiUi() {
  const tab = WIKI.tab;
  $$('#wikiTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.w === tab)));
  const box = $('#wikiBody');
  if (tab === 'rules') {
    box.innerHTML = wikiRules();
    box.scrollTop = 0;
    SHOW.host = null;
    return;
  }
  const ks = wikiKinds(tab),
    k = ks.includes(WIKI.k[tab]) ? WIKI.k[tab] : ks[0],
    K = KINDS[k],
    T = wikiText(k),
    vs = WIKI_VS[k] || [[], []],
    R = WIKI_ROLE();
  WIKI.k[tab] = k;
  const pick = ks
    .map(
      q =>
        `<button class="wpick${q === k ? ' on' : ''}" data-k="${q}" aria-pressed="${q === k}">${wikiImg(q)}<span>${KINDS[q].name}</span></button>`
    )
    .join('');
  const wild = K.bear || K.worm,
    facName = wild ? TR('Wildnis') : FAC[K.fac].name;
  box.innerHTML = `<div class="wpicks">${pick}</div>
    <div class="whero"><div class="wstage psstage" id="wikiStage"><img class="wfall" src="${wikiPic(k)}" alt=""></div>
      <div class="wname"><b>${K.name}</b><span class="wchips"><span class="wchip">${facName}</span><span class="wchip">${wild ? TR('Wildtier') : R[K.role]}</span>${K.tag ? `<span class="wchip">${K.tag}</span>` : ''}</span>
      <small class="note">${TR('Zum Drehen ziehen')}</small></div></div>
    <section class="wsec"><h3>${TR('Geschichte')}</h3><p>${T.s}</p></section>
    <section class="wsec"><h3>${TR('Kampfweise')}</h3><p>${T.h}</p></section>
    <section class="wsec"><h3>${TR('Werte')}</h3><div class="wkpis">${wikiStats(k)}</div>
      <p class="note">${TR('Selbst gesteuert: mehr Schaden, weniger einstecken.')}</p></section>
    <section class="wsec wvs"><h3>${TR('Stark gegen')}</h3><div class="wfaces">${wikiFaces(vs[0]) || TR('niemand')}</div>
      <h3>${TR('Schwach gegen')}</h3><div class="wfaces">${wikiFaces(vs[1]) || TR('niemand')}</div></section>
    <section class="wsec"><h3>${TR('Tipps & Tricks')}</h3><ul>${T.t.map(t => `<li>${t}</li>`).join('')}</ul></section>`;
  box.scrollTop = 0;
  // the warrior in 3D (the picture stays underneath if WebGL is not there)
  const st = $('#wikiStage');
  if (showMount(st, { k, skin: K.fac === 'rentner' ? 'r0' : 'v0', sc: K.role === 'siege' ? 0.6 : K.worm ? 0.34 : K.bear ? 0.75 : 1 }))
    st.classList.add('live');
  fitText();
  wikiFit();
}
// a name too long for its tile gets a smaller font instead of breaking in the middle of a word
function wikiFit() {
  for (const el of $$('#wikiBody .wpick span, #wikiBody .wface span')) {
    el.style.fontSize = '';
    for (let f = 0.6; f >= 0.46 && el.scrollWidth > el.clientWidth + 1; f -= 0.04) el.style.fontSize = f + 'rem';
  }
}
// the rules: rock-paper-scissors, the special warriors, a few basics
function wikiRules() {
  const f = k => `<img src="${PORTRAIT[k]}" alt="">`;
  return `<section class="wsec"><h3>${TR('Schere, Stein, Papier')}</h3>
      <div class="wrps"><div class="wr m"><span>${f(0)}${f(2)}</span><b>${TR('Nahkampf')}</b><small>${TR('schlägt Reiter')}</small></div>
      <div class="wr c"><span>${f(4)}${f(5)}</span><b>${TR('Reiter')}</b><small>${TR('überrennen Fernkampf')}</small></div>
      <div class="wr r"><span>${f(1)}${f(3)}</span><b>${TR('Fernkampf')}</b><small>${TR('erledigt Nahkampf')}</small></div></div>
      <p>${TR(
        'Wer den anderen kontert, macht mehr Schaden. Selbst gesteuert reichen oft zwei saubere Treffer gegen den Konter-Gegner (Fernkämpfer brauchen dafür Kopfschüsse).'
      )}</p></section>
    <section class="wsec"><h3>${TR('Die Spezialisten')}</h3>
      <p>${TR('{0} und {1} sind Spezialisten mit eigenen Regeln:', '<b>' + KINDS[12].name + '</b>', '<b>' + KINDS[13].name + '</b>')}</p>
      <ul><li>${TR('Das Feuerfass zündet mit der Fackel jeden an und sprengt selbst gesteuert ganze Haufen und Basen. Es ist stark gegen Fernkämpfer, Katapulte und Basen, aber Reiter rennen es um. Und ein Kopfschuss lässt sein Fass sofort hochgehen.')}</li>
      <li>${TR('Der Fallenleger zählt zum Nahkampf: Er hält Reiter und ganze Reihen mit seinen Fangeisen fest, stellt Bärenfallen und beißt auch Basen kräftig an. Gegen Bogenschützinnen hat er keine Chance.')}</li></ul></section>
    <section class="wsec"><h3>${TR('Katapulte')}</h3><p>${TR('Katapulte, Feuerfass und Fallenleger treffen Basen mit voller Wucht. Reiter zerbrechen Katapulte mit dem Ramm-Anlauf oder dem Turbo sofort.')}</p></section>
    <section class="wsec"><h3>${TR('Gut zu wissen')}</h3><ul>
      <li>${TR('Fahnen bringen Geld. Wer weniger Fahnen hat, bekommt mehr für jeden besiegten Gegner.')}</li>
      <li>${TR('An der eigenen Basis halten Krieger mehr aus und heilen sich.')}</li>
      <li>${TR('Übernimm einen einzelnen Krieger und kämpf selbst: Er hält mehr aus, schlägt härter und hat eine Spezialfähigkeit.')}</li>
      <li>${TR('Besiegst du einen übernommenen Gegner mit deinem eigenen übernommenen Krieger, gibt es einen Goldrausch.')}</li>
      <li>${TR('Fernkämpfer auf Hügeln schießen weiter.')}</li></ul></section>`;
}
$('#wikiTabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-w]');
  if (!b) return;
  WIKI.tab = b.dataset.w;
  SFX.play('click');
  wikiUi();
});
$('#wikiBody').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  const k = +b.dataset.k,
    K = KINDS[k],
    tab = K.bear || K.worm ? 'wild' : K.fac;
  WIKI.tab = tab;
  WIKI.k[tab] = K.bear ? 8 : K.worm ? 10 : k;
  SFX.play('click');
  wikiUi();
});
$('#wikiBack').addEventListener('click', wikiClose);
$('#btnWiki').addEventListener('click', () => wikiOpen('menu'));
$('#btnWikiWait').addEventListener('click', () => wikiOpen('menu'));
$('#btnWikiLobby').addEventListener('click', () => wikiOpen('lobby'));
$('#btnWiki2').addEventListener('click', () => wikiOpen('pause'));
