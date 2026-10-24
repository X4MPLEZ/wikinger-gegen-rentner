/* 60-modes.js - GAME MODES: playAi(), beginMatch() (sets up the view for any mode), startSim() (the fixed-step loop on host/single player), sendCmd() (local
   or to the host), endGame() (end screen, rematch start). NET (online state) and G (the game state) live here. */
let G = null,
  simTimer = null,
  simAcc = 0,
  simLast = 0,
  paused = false,
  myFac = store.get('wvr-fac') === 'viking' ? 'viking' : 'rentner'; // the faction you picked last time
const NET = {
  room: null,
  r: null,
  code: null,
  role: null,
  seq: 0,
  pending: [],
  guestPeer: null,
  lastSeq: 0,
  poll: null,
  gone: false,
  joinT: 0,
  sentT: 0,
  local: false,
  myPeer: null,
  fcIdx: 0,
  fcT: 0,
  chunks: {},
  gotId: null,
};
let mapChoice = +(store.get('wvr-map') || 0) || 0;
const newSeed = () => Math.floor(Math.random() * 1e8) * 8 + mapChoice;
function sendCmd(c) {
  if (typeof tutCommand === 'function' && !tutCommand(c)) return false;
  if (V.mode === 'ai' || V.mode === 'host') {
    applyCmd(G, V.myTeam, c);
    return true;
  }
  if (V.mode === 'guest' && NET.r) {
    // Commands wait in the presence until the host acknowledges them (ack). A newer order or rally replaces an older one that is still
    // waiting; nothing is dropped silently. With a very slow line the newest command is refused with a note instead.
    if (c.t === 'order' || c.t === 'rally') {
      const i = NET.pending.findIndex(o => o.t === c.t && (c.t === 'rally' || String(o.ids) === String(c.ids)));
      if (i >= 0) NET.pending.splice(i, 1);
    }
    if (NET.pending.length >= 24) {
      toast(TR('Die Verbindung hängt – kurz warten …'), 1500);
      return false;
    }
    c.s = ++NET.seq;
    NET.pending.push(c);
    NET.r.presence({ cmds: NET.pending }).catch(() => {});
    return true;
  }
  return false;
}
function startSim(withAi) {
  stopSim();
  simAcc = 0;
  simLast = now();
  paused = false;
  simTimer = setInterval(() => {
    const t = now();
    const bg = document.hidden; // a hidden tab gets its timer about once a second: catch up more per call, so an online match keeps its pace
    simAcc += Math.min(bg ? 1.2 : 0.5, (t - simLast) / 1000);
    simLast = t;
    let n = 0;
    const ps = performance.now();
    while (simAcc >= DT && n++ < (bg ? 30 : 10)) {
      simAcc -= DT;
      if (paused) continue;
      if (withAi) aiThink(G, 1);
      if (V.mode === 'host') hostReadGuest();
      if (V.mode === 'host' && NET.gone) continue;
      step(G);
    }
    if (n > 0 && !paused) {
      NET.displaySnap = snapOf(G);
      pushSnap(NET.displaySnap);
    }
    {
      const sm = performance.now() - ps;
      QS.simMs += sm;
      if (PROF.on) PROF.s.sim = (PROF.s.sim || 0) + sm;
    }
    if (V.mode === 'host' && t - NET.sentT > 66) {
      NET.sentT = t;
      hostBroadcast();
    }
  }, 25);
}
function stopSim() {
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
}
function loadMap(seed) {
  if (!MAP || MAP.seed !== seed) setMap(genMap(seed));
  buildMapView(MAP);
}
/* Compile the shaders of effects that only appear later (arrows, cakes, swings, rings, grenades, ghosts, frost, bears,
   instanced units) during the countdown, so the first catapult shot or swing does not freeze a weak device. */
function warmShaders() {
  try {
    const g = new THREE.Group(),
      add = o => {
        o.position.set(0, -60, 0);
        g.add(o);
        return o;
      };
    for (const k in projGeo) add(projGeo[k].clone());
    add(
      new THREE.Mesh(
        swingGeo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      )
    );
    add(
      new THREE.Mesh(swingGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }))
    );
    add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false })));
    add(nadeMesh(1));
    add(ghostMesh());
    add(new THREE.Mesh(UG.button, FROST_MAT));
    const bm = bearMesh();
    add(bm.g);
    for (const geo of [UG.hand, UG.head])
      for (const mat of [vcMat, headMat(0)]) add(new THREE.InstancedMesh(geo, mat, 1)).castShadow = true;
    scene.add(g);
    renderer.compile(scene, camera);
    scene.remove(g);
    bm.g.position.set(0, 0, 0);
    g.remove(bm.g);
    hpGroup.remove(bm.hp);
    if (WV.bearPool.length < 4) WV.bearPool.push(bm);
  } catch (_) {}
}
function beginMatch(mode, facs, myTeam, seed) {
  menuUnits.forEach(disposeUnit);
  menuUnits = [];
  resetView();
  loadMap(seed);
  V.mode = mode;
  V.facs = facs;
  V.myTeam = myTeam;
  V.playing = true;
  V.delay = mode === 'guest' ? 0.2 : 0.06;
  if (mode === 'ai') V.oppPf = null; // V.oppPf: the online opponent's public profile (set by hostOnline / joinOnline)
  {
    const mine = PLAYER.sk[facs[myTeam]],
      opp = V.oppPf ? V.oppPf.sk[facs[1 - myTeam]] : null;
    setSkins(facs, myTeam === 0 ? [mine, opp] : [opp, mine]);
  }
  setFaceMat(myTeam, FACE.mine ? FACE.mine.crop : null);
  setFaceMat(1 - myTeam, FACE.other ? FACE.other.crop : null);
  if (!V.tut && MAP && MAP.type)
    setTimeout(() => {
      if (!V.playing || V.tut) return;
      const old = $('#mapCard');
      if (old) old.remove();
      const T = MAPTYPES[MAP.type],
        d = document.createElement('div');
      d.id = 'mapCard';
      d.innerHTML = `<div class="mi">${T.ic}</div><div class="mn">${T.n}</div><div class="ms">${TR('{0} Fahnen', FLAGS.length)} · ${
        {
          wiesen: TR('übersichtlich, Sprungpads über den Fluss'),
          wueste: TR('offen und weit: Fernkampf und Katapulte schießen weiter, Kakteen stechen, Sandwürmer lauern an den Flanken'),
          arktis: TR('Eis ist schnell und rutschig, Katapulte brechen Eis, Eisbären zähmen'),
          klippen: TR('Abgründe und Sprungpads: stoß Gegner in die Tiefe'),
        }[MAP.type] || ''
      }</div>`;
      $('#game').appendChild(d);
      setTimeout(() => d.remove(), 2700);
    }, 300);
  buildBases(facs);
  homeRings(facs);
  setupHud();
  homeCam();
  applyCam();
  HL.q.length = 0;
  HL.seen = undefined;
  HL.busy = 0;
  HL.last = {};
  SHAKE.a = 0;
  showScreen(null);
  $('#hud').hidden = false;
  requestAnimationFrame(fitText);
  $('#ego').hidden = true;
  $('#netwarn').hidden = true;
  hintState.done = new Set(hintsSaved());
  hintState.cur = null;
  V.warnedPoss = false;
  V.cdLast = null;
  V.siegeTip = false;
  if (!V.tut && !hintState.done.has('spawn')) setTimeout(() => toast(HINTS[0].text(), 4500), 1200);
  setTimeout(warmShaders, 60);
  if (mode !== 'ai') setTimeout(() => V.playing && vsCard(V.oppPf), 200);
  // a back swipe (Android) or the browser's back button opens the menu instead of leaving the match (see popstate in 62-screens.js)
  try {
    if (!(history.state && history.state.wvr)) history.pushState({ wvr: 1 }, '');
  } catch (_) {}
}
function robotFace(lvl = aiLvl) {
  const c = cnv(256, 256),
    x = c.getContext('2d'),
    Lv =
      {
        easy: { a: '#d9f2d4', b: '#7cc46e', c: '#3f7f39', eye: '#7dff9a', mouth: 'smile' },
        medium: { a: '#d9e6f5', b: '#7aa2cf', c: '#3d5f8a', eye: '#5ee0ff', mouth: 'bars' },
        hard: { a: '#f5e2c9', b: '#d99a4a', c: '#8a5418', eye: '#ffb02e', mouth: 'bars', brow: 1 },
        insane: { a: '#f2c9c9', b: '#c45050', c: '#6b1b1b', eye: '#ff3c2e', mouth: 'teeth', brow: 2 },
        extreme: { a: '#4a4f5a', b: '#20232b', c: '#08090c', eye: '#ff1a1a', mouth: 'teeth', brow: 3, horns: 1 },
      }[lvl] || null;
  if (Lv) return robotFaceLv(c, x, Lv);
  x.beginPath();
  x.arc(128, 128, 128, 0, TAU);
  x.clip();
  let g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#d9e1ea');
  g.addColorStop(0.5, '#9aa7b6');
  g.addColorStop(1, '#5d6978');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#7d8a99';
  x.fillRect(0, 20, 256, 10);
  x.fillRect(0, 226, 256, 10);
  x.fillStyle = '#1b2230';
  rrect(x, 38, 70, 180, 64, 22);
  for (const ex of [88, 168]) {
    const rg = x.createRadialGradient(ex, 102, 2, ex, 102, 26);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.3, '#ff5a3c');
    rg.addColorStop(1, 'rgba(255,60,40,0)');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(ex, 102, 26, 0, TAU);
    x.fill();
  }
  x.fillStyle = '#1b2230';
  rrect(x, 70, 160, 116, 40, 10);
  x.fillStyle = '#5ee0ff';
  for (let i = 0; i < 6; i++) {
    const h = [10, 22, 30, 26, 16, 8][i];
    x.fillRect(82 + i * 16, 180 - h / 2, 9, h);
  }
  x.fillStyle = '#4b5563';
  for (const [bx, by] of [
    [22, 60],
    [234, 60],
    [22, 196],
    [234, 196],
  ]) {
    x.beginPath();
    x.arc(bx, by, 7, 0, TAU);
    x.fill();
  }
  x.fillStyle = '#c3ccd6';
  x.fillRect(118, 140, 20, 10);
  return c;
}
function robotFaceLv(c, x, L) {
  x.save();
  x.beginPath();
  x.arc(128, 128, 128, 0, TAU);
  x.clip();
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, L.a);
  g.addColorStop(0.55, L.b);
  g.addColorStop(1, L.c);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(0,0,0,.18)';
  x.fillRect(0, 20, 256, 9);
  x.fillRect(0, 228, 256, 9);
  if (L.horns) {
    x.fillStyle = '#c9c2b0';
    [
      [30, 1],
      [226, -1],
    ].forEach(([hx, s]) => {
      x.beginPath();
      x.moveTo(hx, 70);
      x.quadraticCurveTo(hx - s * 10, 20, hx + s * 30, 0);
      x.quadraticCurveTo(hx + s * 10, 40, hx + s * 30, 66);
      x.fill();
    });
  }
  x.fillStyle = '#12161f';
  rrect(x, 38, 74, 180, 60, 22);
  for (const ex of [88, 168]) {
    const rg = x.createRadialGradient(ex, 104, 2, ex, 104, 26);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.3, L.eye);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(ex, 104, 26, 0, TAU);
    x.fill();
  }
  if (L.brow) {
    x.strokeStyle = '#0b0d12';
    x.lineWidth = 9 + L.brow * 2;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(52, 70 - L.brow * 4);
    x.lineTo(112, 84);
    x.moveTo(204, 70 - L.brow * 4);
    x.lineTo(144, 84);
    x.stroke();
  }
  x.fillStyle = '#12161f';
  rrect(x, 70, 158, 116, 44, 12);
  if (L.mouth === 'smile') {
    x.strokeStyle = L.eye;
    x.lineWidth = 9;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(88, 172);
    x.quadraticCurveTo(128, 200, 168, 172);
    x.stroke();
  } else if (L.mouth === 'teeth') {
    x.fillStyle = '#f3efe6';
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      x.moveTo(78 + i * 15, 164);
      x.lineTo(85 + i * 15, 182);
      x.lineTo(92 + i * 15, 164);
      x.fill();
      x.beginPath();
      x.moveTo(78 + i * 15, 196);
      x.lineTo(85 + i * 15, 178);
      x.lineTo(92 + i * 15, 196);
      x.fill();
    }
  } else {
    x.fillStyle = L.eye;
    for (let i = 0; i < 6; i++) {
      const h = [10, 22, 30, 26, 16, 8][i];
      x.fillRect(82 + i * 16, 180 - h / 2, 9, h);
    }
  }
  x.fillStyle = 'rgba(0,0,0,.35)';
  for (const [bx, by] of [
    [22, 60],
    [234, 60],
    [22, 196],
    [234, 196],
  ]) {
    x.beginPath();
    x.arc(bx, by, 7, 0, TAU);
    x.fill();
  }
  x.restore();
  return c;
}
function playAi(keepNet = false) {
  if (!keepNet) leaveNet(); // keepNet: practising while a public game waits for an opponent (64-lobby.js)
  FACE.other = { crop: robotFace(), url: null };
  const facs = [myFac, FAC[myFac].other],
    seed = newSeed();
  G = newGame(facs, seed, gameMode === 'chaos', { fog: gameMode === 'fog' });
  G.ai = aiNew(aiLvl);
  G.teams[1].incMul = AI_LVL[aiLvl].inc;
  G.teams[1].gold += AI_LVL[aiLvl].bonus || 0;
  V.tut = false;
  beginMatch('ai', facs, 0, seed);
  pushSnap(snapOf(G));
  startSim(true);
}
function endGame(s) {
  V.playing = false;
  stopSim();
  if (V.poss) exitEgo(false);
  const won = s.o === V.myTeam,
    me = V.myTeam,
    myF = V.facs[me];
  SFX.play(won ? 'win' : 'lose');
  $('#endTitle').textContent = won ? TR('Sieg!') : TR('Niederlage');
  $('#endTitle').className = 'endtitle ' + (won ? 'win' : 'lose');
  $('#endSub').textContent = {
    viking: [TR('Walhalla jubelt. Das Altersheim ist geplündert!'), TR('Die Rentner haben euch mit Pantoffeln heimgeschickt.')],
    rentner: [TR('Ruhe im Haus! Die Wikinger rudern zurück nach Hause.'), TR('Die Wikinger haben das Haus Abendrot geplündert.')],
  }[myF][won ? 0 : 1];
  $('#stTime').textContent = Math.floor(s.t / 60) + ':' + String(Math.floor(s.t % 60)).padStart(2, '0');
  $('#stKills').textContent = s.k[me];
  $('#stFlags').textContent = s.mf[me];
  {
    // honest numbers instead of guesses about "your biggest mistake"
    const box = $('#endCmp'),
      st = s.st;
    box.innerHTML = '';
    if (st && !V.tut) {
      const op = 1 - me,
        T = Math.max(1, s.t),
        fmt = v => Math.floor(v / 60) + ':' + String(Math.round(v % 60)).padStart(2, '0');
      const rows = [
        [TR('Ausgebildet'), 0, 1, null, true],
        [TR('Verloren'), 1, -1, null, true],
        [TR('Basis-Schaden'), 2, 1, null, true],
        [TR('Ø Fahnen'), 3, 1, v => numL(Math.round((v / T) * 10) / 10), true],
        [TR('Fahnen-Führung'), 4, 1, fmt, true],
        [TR('Helden besiegt'), 10, 1],
        [TR('Rammstöße'), 5, 1],
        [TR('Klippenstürze'), 6, 1],
        [TR('Katapulte zerstört'), 8, 1],
        [MAP && MAP.type === 'wueste' ? TR('Sandwürmer gezähmt') : TR('Eisbären gezähmt'), 7, 1],
        [TR('Eislöcher'), 9, 1],
      ];
      let h = `<div class="l h">${TR('Du')}</div><div class="m h"></div><div class="r h">${TR('Gegner')}</div>`;
      for (const [nm, i, dir, f, always] of rows) {
        const a = st[me][i],
          b = st[op][i];
        if (!always && !a && !b) continue;
        const w = a === b ? 0 : (a > b ? 1 : -1) * dir;
        h += `<div class="l${w > 0 ? ' win' : ''}">${f ? f(a) : a}</div><div class="m">${nm}</div><div class="r${w < 0 ? ' win' : ''}">${f ? f(b) : b}</div>`;
      }
      box.innerHTML = h;
    }
  }
  if (V.mode === 'ai' && !V.tut) $('#endSub').textContent += ' ' + TR('(Computer: {0})', AI_LVL[aiLvl].name);
  {
    // the profile: statistics, XP, Juwelen, achievements (65-profile.js); shown under the numbers (66-profile-ui.js)
    let R = null;
    try {
      R = profMatchEnd({
        won,
        online: V.mode === 'host' || V.mode === 'guest',
        ai: V.mode === 'ai' && !V.tut,
        tut: !!V.tut,
        adv: !!TUT.adv,
        lvl: aiLvl,
        fac: myF,
        map: MAP && MAP.type,
        mode: s.ch ? 'chaos' : s.fg ? 'fog' : 'classic',
        t: s.t,
        k: s.k ? s.k[me] : 0,
        st: s.st ? s.st[me] : null,
        ost: s.st ? s.st[1 - me] : null,
        base: s.b ? s.b[me] : 0,
        mhp: CFG.baseHp,
      });
    } catch (_) {}
    profEndUi(R);
  }
  $('#btnAgain').hidden = V.mode !== 'ai';
  if (V.tut) {
    $('#endTitle').textContent = won ? TR('Geschafft!') : TR('Fast!');
    $('#endSub').textContent = TUT.adv
      ? TR('Profi-Prüfung bestanden! Jetzt zeig es dem Computer auf „Schwer“.')
      : TR('Du kennst jetzt das Wichtigste. Ab gegen den Computer – oder ins Profi-Tutorial!');
    $('#btnAgain').hidden = true;
    store.set('wvr-tut', '1');
    $('#tutBadge').hidden = true;
    endTutorial();
  }
  {
    const on = (V.mode === 'host' || V.mode === 'guest') && NET.r && !NET.gone;
    $('#btnRematch').hidden = !on;
    $('#rematchNote').hidden = !on;
    NET.rmWant = false;
    NET.rmOther = false;
    NET.rmMiss = 0;
    NET.endSeed = V.mode === 'guest' ? V.latest && V.latest.sd : G && G.seed;
    if (on) {
      $('#btnRematch').textContent = TR('Noch eine Runde!');
      $('#rematchNote').textContent = TR('Gleicher Gegner, neue Karte. Sobald ihr beide tippt, geht es los.');
      if (V.mode === 'host') hostBroadcast();
      NET.endPoll = setInterval(rematchTick, 300);
    } else if (V.mode === 'host') {
      hostBroadcast();
      const a = NET.connectAttempt;
      setTimeout(() => a === NET.connectAttempt && leaveNet(), 4000); // not if a new lobby was opened meanwhile
    }
  }
  setTimeout(
    () => {
      $('#hud').hidden = true;
      showScreen('end');
    },
    V.ending ? 200 : 1600
  );
}
