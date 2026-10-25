/* 62-screens.js - SCREENS: menu, lobby, pause (Aufgeben asks twice; online it tells the opponent: quitMatch), graphics/sound/keys settings, the menu scene. */
function showScreen(id) {
  ['menu', 'lobby', 'pause', 'end', 'faceScr', 'keysScr', 'gfxScr', 'sndScr', 'langScr', 'profScr', 'privScr', 'bugScr'].forEach(
    s => ($('#' + s).hidden = s !== id)
  );
  fitText();
  if (id === 'menu')
    try {
      profChipUi(); // (not yet while the page loads: the profile comes later in the file order)
    } catch (_) {}
}
let gfxFrom = 'menu';
function gfxUi() {
  const sc = $('#gfxScr');
  if (!sc || sc.hidden) return;
  const m = QS.mode();
  $$('#gfxQ button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.q === m)));
  const pr = renderer.getPixelRatio(),
    T = QS.tier();
  const px = renderer.getDrawingBufferSize(new THREE.Vector2());
  $('#gfxNow').textContent = [
    m === 'auto'
      ? LADDER[QS.lvl].m < 1
        ? TR('Passt sich laufend an dein Gerät an. Zurzeit: {0} mit etwas geringerer Auflösung.', T.name)
        : TR('Passt sich laufend an dein Gerät an. Zurzeit: {0}.', T.name)
      : TR('Feste Stufe: {0}.', T.name),
    QS.ultra
      ? POST.on
        ? SET.gfxDof === 'off'
          ? TR('Mit weicher Verschattung und Leuchten – für starke Geräte.')
          : TR('Mit weicher Verschattung, Tiefenschärfe und Leuchten – für starke Geräte.')
        : TR('Die Effekte brauchen WebGL 2 – dieses Gerät zeigt Sehr hoch ohne sie.')
      : '',
    TR('Bild: {0} × {1} Pixel', px.x, px.y),
    sun.castShadow ? TR('Schatten {0}', sun.shadow.mapSize.x) : TR('ohne Echtzeit-Schatten'),
    QS.cap ? TR('Bildrate auf {0} begrenzt', QS.cap) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  $('#gfxSh').value = SET.gfxSh || 'auto';
  $('#gfxFx').value = SET.gfxFx || 'auto';
  $('#gfxRes').value = SET.gfxRes || 'auto';
  $('#gfxFps').value = SET.gfxFps || 'auto';
  $('#gfxDof').value = SET.gfxDof || 'auto';
  $('#gfxDof').disabled = !(QS.ultra && POST.on);
}
['#btnGfx', '#btnGfx2'].forEach((id, i) =>
  $(id).addEventListener('click', () => {
    gfxFrom = i ? 'pause' : 'menu';
    showScreen('gfxScr');
    gfxUi();
  })
);
$('#gfxBack').addEventListener('click', () => showScreen(gfxFrom));
// language: the native names; a choice is saved and the page reloads (texts built while loading follow the language, see 00-i18n.js)
$('#langNow').textContent = (LANGS.find(l => l[0] === LANG) || LANGS[1])[1];
$('#btnLang').addEventListener('click', () => {
  const box = $('#langList');
  box.textContent = '';
  for (const [c, n] of LANGS) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.lang = c;
    b.textContent = n;
    b.setAttribute('aria-pressed', String(c === LANG));
    b.addEventListener('click', () => {
      if (c === LANG) return showScreen('menu');
      store.set('wvr-lang', c);
      try {
        const u = new URL(location.href);
        u.searchParams.delete('lang');
        location.replace(u.href);
      } catch (_) {
        location.reload();
      }
    });
    box.appendChild(b);
  }
  showScreen('langScr');
});
$('#langBack').addEventListener('click', () => showScreen('menu'));
$('#btnPriv').addEventListener('click', () => showScreen('privScr'));
// the portal version never sends the player's photo (faceChunkPatch in 61-net.js): say so
if (window.WVR_PORTAL)
  $('#privFace').textContent = TR(
    'In der Liste der offenen Spiele stehen nur dein Spielername, dein Profilbild und dein Level. Dein eigenes Foto verlässt dein Gerät nie.'
  );
$('#privBack').addEventListener('click', () => showScreen('menu'));
let sndFrom = 'menu';
const volShow = r => {
  r.style.setProperty('--p', r.value + '%');
  r.nextElementSibling.textContent = r.value + ' %';
};
function sndUi() {
  const v = SFX.vol;
  $$('#sndScr input[data-vol]').forEach(r => {
    r.value = v[r.dataset.vol];
    volShow(r);
  });
  $('#sndMute').checked = SFX.muted;
}
$$('#sndScr input[data-vol]').forEach(r => {
  r.addEventListener('input', () => {
    SFX.unlock();
    SFX.setVol(r.dataset.vol, +r.value);
    volShow(r);
  });
  r.addEventListener('change', () => {
    const k = r.dataset.vol;
    if (k === 'fx' || k === 'all') SFX.play('ding');
    else if (k === 'amb') SFX.preview('amb');
  });
});
$('#sndMute').addEventListener('change', e => {
  SFX.unlock();
  SFX.setMuted(e.target.checked);
  syncMute();
});
['#btnSnd', '#btnSnd2'].forEach((id, i) =>
  $(id).addEventListener('click', () => {
    sndFrom = i ? 'pause' : 'menu';
    showScreen('sndScr');
    sndUi();
  })
);
$('#sndBack').addEventListener('click', () => showScreen(sndFrom));
$$('#gfxQ button').forEach(b => b.addEventListener('click', () => setGfx(b.dataset.q)));
[
  ['#gfxSh', 'gfxSh'],
  ['#gfxFx', 'gfxFx'],
  ['#gfxRes', 'gfxRes'],
  ['#gfxFps', 'gfxFps'],
  ['#gfxDof', 'gfxDof'],
].forEach(([id, key]) =>
  $(id).addEventListener('change', e => {
    SET[key] = e.target.value;
    saveBinds();
    applyQuality();
    gfxUi();
  })
);
let keysFrom = 'menu';
['#btnKeys', '#btnKeys2'].forEach((id, i) =>
  $(id).addEventListener('click', () => {
    keysFrom = i ? 'pause' : 'menu';
    REB.act = null;
    renderKeys();
    showScreen('keysScr');
  })
);
$('#keysBack').addEventListener('click', () => {
  REB.act = null;
  showScreen(keysFrom);
});
$('#keysReset').addEventListener('click', () => {
  BIND = JSON.parse(JSON.stringify(BIND_DEF));
  SET = { ...SET, sens: 1, invY: false, edge: true };
  saveBinds();
  renderKeys();
  refreshKbd();
});
$('#setSens').addEventListener('input', e => {
  SET.sens = +e.target.value;
  $('#setSensV').textContent = SET.sens.toFixed(1);
  saveBinds();
});
$('#setInv').addEventListener('change', e => {
  SET.invY = e.target.checked;
  saveBinds();
});
$('#setEdge').addEventListener('change', e => {
  SET.edge = e.target.checked;
  saveBinds();
});
function toMenu() {
  SFX.music(false);
  if (TUT.on) endTutorial();
  stopSim();
  leaveNet();
  if (V.poss) exitEgo(false);
  V.playing = false;
  V.mode = 'menu';
  $('#hud').hidden = true;
  $('#ego').hidden = true;
  $('#netwarn').hidden = true;
  showScreen('menu');
  menuScene();
}
function setHostMenu(active) {
  $('.online').classList.toggle('hosting', active);
  $('#codeIn').readOnly = active;
  $('#btnHost').disabled = active;
  $('#btnJoin').disabled = active;
  $('#btnQuick').disabled = active;
  $('#onlineStatus').hidden = !active;
  $('#onlineNote').hidden = !active;
  $('#onlineActions').hidden = !active;
  $$('.fac, .mcard, .lvl button[data-mode], .lvl button[data-lvl]').forEach(b => (b.disabled = active));
}
function showLobby(isHost, code, status, busy) {
  NET.inlineLobby = isHost;
  if (isHost) {
    setHostMenu(true);
    $('#codeIn').value = code;
    $('#onlineNote').textContent = TR('Dein Gegner gibt diesen Code bei „Beitreten“ ein. Die Partie startet, sobald er verbunden ist.');
    setLobbyStatus(status, busy);
    showScreen('menu');
    return;
  }
  $('#lobbyTitle').textContent = isHost ? TR('Spiel erstellt') : TR('Beitreten');
  $('#lobbyCode').textContent = code;
  $('#lobbyCodeWrap').hidden = !isHost;
  $('#lobbyNote').textContent = isHost
    ? TR('Dein Gegner öffnet dieses Spiel auf seinem Gerät und tippt den Code bei „Beitreten“ ein.')
    : TR('Code: {0}', code);
  setLobbyStatus(status, busy);
  showScreen('lobby');
}
function setLobbyStatus(t, busy) {
  const s = $(NET.inlineLobby ? '#onlineStatus' : '#lobbyStatus');
  s.textContent = t;
  s.classList.toggle('dots', !!busy);
}
function netBadgeTick() {
  const b = $('#netBadge');
  if (!b) return;
  const on = V.playing && (V.mode === 'host' || V.mode === 'guest');
  b.hidden = !on;
  if (!on) return;
  const via = NET.via === 'relay' ? TR('Server') : NET.via === 'claude' ? 'Claude' : TR('Direkt'),
    ms = NET.rtt ? Math.round(NET.rtt) : null;
  b.textContent = via + (ms !== null ? ' · ' + ms + ' ms' : '');
  b.classList.toggle('slow', ms !== null && ms > 150);
}
setInterval(netBadgeTick, 500);
function netWarn(t) {
  $('#netwarnTxt').textContent = t;
  $('#netwarn').hidden = false;
}
function toastMenu(t) {
  const s = $('.sub');
  const o = TR('Erobere die Fahnen. Reiß die Basis ein.');
  s.textContent = t;
  setTimeout(() => (s.textContent = o), 2200);
}
$$('.sic').forEach(e => {
  e.innerHTML = si(e.dataset.si);
});
{
  const de = document.documentElement,
    can = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled),
    isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const icoIn =
      '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    icoOut =
      '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  const sync = () =>
    $$('.fsBtn').forEach(b => {
      b.hidden = !can || !!window.WVR_PORTAL; // portals bring their own fullscreen button (CrazyGames forbids a second one)
      b.innerHTML = isFs() ? icoOut : icoIn;
      b.setAttribute('aria-label', isFs() ? TR('Vollbild beenden') : TR('Vollbild'));
    });
  $$('.fsBtn').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      try {
        if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          const r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' });
          if (r && r.catch) r.catch(() => {});
        }
      } catch (_) {}
      SFX.play('click');
    })
  );
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
    document.addEventListener(ev, () => {
      sync();
      setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    })
  );
  sync();
}
// the faces on the faction buttons: the hand-made badges of the profile pictures (65a-avatar-pics.js, a later file: so this runs from
// 99-boot.js), the drawn portrait as a fallback
const FAC_FACE = { 0: 'berserker', 1: 'archer', 2: 'opa', 3: 'oma', 4: 'goat', 5: 'racer' };
function facFaces() {
  $$('[data-face]').forEach(img => {
    const k = +img.dataset.face;
    img.src = AV_PIC[FAC_FACE[k]] || PORTRAIT[k];
  });
}
$$('.fac').forEach(o => o.setAttribute('aria-pressed', String(o.dataset.fac === myFac)));
$$('.fac').forEach(b =>
  b.addEventListener('click', () => {
    myFac = b.dataset.fac;
    store.set('wvr-fac', myFac);
    $$('.fac').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    if (MAP && V.mode === 'menu') {
      V.facs = [myFac, FAC[myFac].other];
      buildBases(V.facs);
      FLAGS.forEach((_, i) => {
        flagViews[i].owner = -2;
        updateFlag(i, -1, 0, false);
      });
      menuPose();
    }
  })
);
$('#btnAi').addEventListener('click', () => playAi());
$('#btnTut').addEventListener('click', () => startTutorial(false));
$('#btnTutPro').addEventListener('click', () => startTutorial(true));
$('#tutSkip').addEventListener('click', () => {
  if (TUT.confirm) return;
  TUT.confirm = { text: $('#tutText').textContent, next: !$('#tutNext').hidden };
  $('#tutText').textContent = TR('Tutorial wirklich beenden?');
  $('#tutNext').hidden = true;
  $('#tutNo').hidden = false;
  $('#tutYes').hidden = false;
});
$('#tutNo').addEventListener('click', () => {
  const c = TUT.confirm;
  if (!c) return;
  TUT.confirm = null;
  $('#tutText').textContent = c.text;
  $('#tutNext').hidden = !c.next;
  $('#tutNo').hidden = true;
  $('#tutYes').hidden = true;
});
$('#tutYes').addEventListener('click', () => {
  TUT.confirm = null;
  $('#tutNo').hidden = true;
  $('#tutYes').hidden = true;
  toMenu();
});
$('#tutNext').addEventListener('click', () => {
  if (!TUT.wait) tutGo(TUT.i + 1);
});
$('#tutBadge').hidden = store.get('wvr-tut') === '1';
$('#btnHost').addEventListener('click', () => hostOnline(false));
$('#btnHostCancel').addEventListener('click', () => leaveNet());
$('#btnCodeCopy').addEventListener('click', async () => {
  const input = $('#codeIn'),
    code = input.value,
    attempt = NET.connectAttempt;
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
      copied = true;
    }
  } catch (_) {}
  if (attempt !== NET.connectAttempt) return;
  if (!copied) {
    input.focus();
    input.select();
    input.setSelectionRange(0, code.length);
    try {
      copied = document.execCommand('copy');
    } catch (_) {}
  }
  $('#onlineNote').textContent = copied
    ? TR('Code kopiert: {0}. Dein Gegner gibt ihn bei „Beitreten“ ein.', code)
    : TR('Code markiert: {0}. Mit „Kopieren“ oder Strg/Cmd+C kopieren.', code);
});
$('#btnJoin').addEventListener('click', () => joinOnline($('#codeIn').value));
$('#codeIn').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.target.readOnly) joinOnline(e.target.value);
});
$('#codeIn').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
});
$('#btnLobbyBack').addEventListener('click', toMenu);
$('#menuBtn').addEventListener('click', () => {
  if (V.mode === 'ai') paused = true;
  const online = V.mode === 'host' || V.mode === 'guest';
  $('#pauseTitle').textContent = online ? TR('Menü – das Spiel läuft weiter!') : TR('Pause');
  $('#btnResume').textContent = V.mode === 'ai' ? TR('Weiter') : TR('Zurück zum Spiel');
  quitArm(false);
  showScreen('pause');
});
$('#btnResume').addEventListener('click', () => {
  paused = false;
  showScreen(null);
});
// "Aufgeben" asks once: the first tap arms it for 3 s, the second one ends the match
const QUIT = { on: false, t: 0 };
function quitArm(on) {
  clearTimeout(QUIT.t);
  QUIT.on = on;
  const b = $('#btnQuit');
  b.textContent = on ? TR('Wirklich aufgeben?') : TR('Aufgeben');
  b.classList.toggle('danger', on);
  if (on) QUIT.t = setTimeout(() => quitArm(false), 3000);
}
$('#btnQuit').addEventListener('click', () => {
  if (!QUIT.on && V.playing) {
    quitArm(true);
    return;
  }
  quitArm(false);
  quitMatch();
});
// Online, the other player is told first (presence quit: 1), so he gets his win screen instead of waiting for you (oppQuit, 61-net.js).
function quitMatch() {
  profQuit();
  if ((V.mode === 'host' || V.mode === 'guest') && NET.r && V.playing) {
    const r = NET.r;
    NET.r = null; // leaveNet must not close the room before the message is out
    try {
      const q = r.presence({ quit: 1 });
      if (q && q.catch) q.catch(() => {});
    } catch (_) {}
    setTimeout(() => {
      try {
        r.leave();
      } catch (_) {}
    }, 2000); // time for the message to arrive and be read, even on a slow phone or line
  }
  toMenu();
}
addEventListener('popstate', () => {
  if (!V.playing) return;
  try {
    history.pushState({ wvr: 1 }, '');
  } catch (_) {}
  if ($('#pause').hidden && !V.ending) $('#menuBtn').click();
});
$('#btnAgain').addEventListener('click', () => playAi(!!NET.practice));
$('#btnMenu').addEventListener('click', toMenu);
$('#btnNetQuit').addEventListener('click', toMenu);
$('#rallyIco').innerHTML = ICON.flag;
$('#menuBtn').innerHTML = ICON.pause;
$('#armyIco').innerHTML = ICON.army;
$('#exitIco').innerHTML = ICON.exit;
$('#egoAtk').innerHTML = '<i class="cd"></i>' + ICON.sword;
$('#egoHero .hIco').innerHTML = ICON.sword;
$('#spIco').innerHTML = ICON.star;
$('#possIco').innerHTML = ICON.enter;
let gameMode = ['chaos', 'fog'].includes(store.get('wvr-mode')) ? store.get('wvr-mode') : 'classic';
function syncMode() {
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === gameMode)));
}
$$('[data-mode]').forEach(b =>
  b.addEventListener('click', () => {
    gameMode = b.dataset.mode;
    store.set('wvr-mode', gameMode);
    syncMode();
    if (typeof syncLvl === 'function') syncLvl();
  })
);
syncMode();
let aiLvl = AI_LVL[store.get('wvr-lvl')] ? store.get('wvr-lvl') : 'medium';
const botFaceIcons = new Map();
function syncLvl() {
  $$('.lvl button[data-lvl]').forEach(b => {
    const lvl = b.dataset.lvl;
    if (!b.querySelector('.botface')) {
      let src = botFaceIcons.get(lvl);
      if (!src) {
        src = robotFace(lvl).toDataURL('image/png');
        botFaceIcons.set(lvl, src);
      }
      const img = document.createElement('img');
      img.className = 'botface';
      img.src = src;
      img.alt = '';
      img.width = img.height = 34;
      b.prepend(img);
    }
    b.setAttribute('aria-pressed', String(lvl === aiLvl));
  });
  const ai = $('#aiInfo');
  if (ai)
    ai.textContent =
      TR('gegen den Computer · {0}', AI_LVL[aiLvl].name) +
      (gameMode === 'chaos' ? ' · ' + TR('Chaos') : gameMode === 'fog' ? ' · ' + TR('Nebel') : '');
}
$$('.lvl button[data-lvl]').forEach(b =>
  b.addEventListener('click', () => {
    aiLvl = b.dataset.lvl;
    store.set('wvr-lvl', aiLvl);
    syncLvl();
  })
);
syncLvl();
const syncMaps = () => $$('.mcard').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.map === mapChoice)));
syncMaps();
$$('.mcard').forEach(b =>
  b.addEventListener('click', () => {
    SFX.play && SFX.play('click');
    if (mapChoice === +b.dataset.map && mapChoice !== 0) return;
    mapChoice = +b.dataset.map;
    store.set('wvr-map', String(mapChoice));
    syncMaps();
    if (V.mode === 'menu') menuScene();
  })
);
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => SFX.unlock(), { capture: true, passive: true })
);
document.addEventListener(
  'click',
  e => {
    const b = e.target.closest && e.target.closest('button');
    if (b) SFX.play('click');
  },
  true
);
function syncMute() {
  $$('.muteBtn').forEach(b => {
    b.innerHTML = SFX.muted ? ICON.mute : ICON.sound;
    b.setAttribute('aria-pressed', String(!SFX.muted));
  });
}
$$('.muteBtn').forEach(b =>
  b.addEventListener('click', () => {
    SFX.unlock();
    SFX.setMuted(!SFX.muted);
    syncMute();
  })
);
syncMute();
let rallyMesh = null,
  menuUnits = [];
function menuScene() {
  resetView();
  if (rallyMesh) rallyMesh.visible = false;
  loadMap(newSeed());
  V.facs = [myFac, FAC[myFac].other];
  V.myTeam = 0;
  setSkins(V.facs, [PLAYER.sk[myFac], null]);
  buildBases(V.facs);
  FLAGS.forEach((_, i) => updateFlag(i, -1, 0, false));
  menuPose();
}
function menuPose() {
  menuUnits.forEach(disposeUnit);
  menuUnits = [];
  setSkins([myFac, FAC[myFac].other], [PLAYER.sk[myFac], null]); // the menu shows your army in your skin
  const B = BASES[0];
  FAC[myFac].kinds.forEach((k, i) => {
    const u = Object.assign(buildUnit(k), { wob: 0, wobV: 0, atkT: 9 + i, walk: i, speed: 0, flash: 0 });
    const x = B.x + (i - 1) * 2.6,
      z = B.z - 11 + (i === 1 ? -1 : 0);
    u.g.position.set(x, groundY(x, z), z);
    u.g.rotation.y = Math.PI + (i - 1) * 0.35;
    menuUnits.push(u);
  });
  camS.yaw = Math.PI;
  camS.x = B.x;
  camS.z = B.z - 15;
  camS.dist = 24;
  camS.pitch = 0.42;
}
(async () => {
  const f = store.get('wvr-face');
  if (f && f.startsWith('data:image')) {
    try {
      await setMyFace(f, false);
    } catch (_) {}
  }
})();

/* ---------- bug report (start page and pause): a text, a screenshot of the game (or a picture of one's own) and what the game knows about
   the device go by e-mail to the developers. A page alone cannot send mail: the form is posted to FormSubmit (formsubmit.co), into a hidden
   frame. (The very first report to the address makes FormSubmit ask once, by e-mail, to confirm it.) ---------- */
const BUG = { to: 'rentnervswikinger@gmail.com', from: 'menu', shot: null, url: '', busy: false, frame: null };
function bugShot(blob) {
  BUG.shot = blob;
  if (BUG.url) URL.revokeObjectURL(BUG.url);
  BUG.url = blob ? URL.createObjectURL(blob) : '';
  const im = $('#bugImg');
  im.src = BUG.url;
  im.hidden = !blob;
  $('#bugUse').checked = !!blob;
}
function bugOpen(from) {
  BUG.from = from;
  $('#bugMsg').textContent = '';
  bugShot(null);
  // the picture of the game as it is: read right after the next frame was drawn (the drawing buffer is not kept)
  requestAnimationFrame(() => {
    try {
      renderer.domElement.toBlob(b => b && !BUG.busy && bugShot(b), 'image/jpeg', 0.82);
    } catch (_) {}
  });
  showScreen('bugScr');
  setTimeout(() => $('#bugTxt').focus(), 50);
}
function bugInfo() {
  const map = (typeof MAP !== 'undefined' && MAP && MAP.type) || '-';
  return [
    ['Version', 'NET ' + NET_VER],
    ['Seite', location.origin + location.pathname],
    [
      'Modus',
      V.mode +
        (V.playing ? ' (in der Partie)' : '') +
        ' · Karte ' +
        map +
        (G && G.chaos ? ' · Chaos' : '') +
        (G && G.fog ? ' · Nebel' : ''),
    ],
    ['Grafik', QS.mode() + ' · Stufe ' + QS.lvl + (QS.ultra ? ' · Sehr hoch' : '')],
    ['Bildschirm', innerWidth + '×' + innerHeight + ' @' + (devicePixelRatio || 1) + (COARSE ? ' · Touch' : '')],
    ['Sprache', LANG],
    ['Gerät', navigator.userAgent],
  ];
}
function bugSend() {
  if (BUG.busy) return;
  const txt = $('#bugTxt').value.trim(),
    mail = $('#bugMail').value.trim(),
    msg = $('#bugMsg');
  if (txt.length < 6) {
    msg.textContent = TR('Bitte beschreib kurz, was passiert ist.');
    $('#bugTxt').focus();
    return;
  }
  const last = +store.get('wvr-bug') || 0;
  if (Date.now() - last < 60000) {
    msg.textContent = TR('Danke! Bitte warte eine Minute bis zum nächsten Bericht.');
    return;
  }
  BUG.busy = true;
  $('#bugSend').disabled = true;
  msg.textContent = TR('Wird gesendet …');
  if (!BUG.frame) {
    BUG.frame = document.createElement('iframe');
    BUG.frame.name = 'bugFrame';
    BUG.frame.title = 'bug';
    BUG.frame.style.display = 'none';
    document.body.appendChild(BUG.frame);
  }
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = 'https://formsubmit.co/' + BUG.to;
  f.enctype = 'multipart/form-data';
  f.target = 'bugFrame';
  f.style.display = 'none';
  const add = (n, v) => {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = n;
    i.value = v;
    f.appendChild(i);
  };
  add('_subject', 'Fehlerbericht – Rentner gegen Wikinger');
  add('_captcha', 'false');
  add('_template', 'table');
  add('Beschreibung', txt);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    add('E-Mail', mail);
    add('_replyto', mail);
  }
  for (const [k, v] of bugInfo()) add(k, v);
  if (BUG.shot && $('#bugUse').checked)
    try {
      const fi = document.createElement('input'),
        dt = new DataTransfer();
      fi.type = 'file';
      fi.name = 'attachment';
      dt.items.add(
        new File([BUG.shot], BUG.shot.type === 'image/png' ? 'screenshot.png' : 'screenshot.jpg', { type: BUG.shot.type || 'image/jpeg' })
      );
      fi.files = dt.files;
      f.appendChild(fi);
    } catch (_) {} // an old browser: the report goes without the picture
  const done = ok => {
    if (!BUG.busy) return;
    BUG.busy = false;
    clearTimeout(BUG.t);
    $('#bugSend').disabled = false;
    if (ok) {
      store.set('wvr-bug', String(Date.now()));
      msg.textContent = TR('Danke! Dein Bericht ist unterwegs.');
      $('#bugTxt').value = '';
      SFX.play('ding');
      setTimeout(() => !$('#bugScr').hidden && showScreen(BUG.from), 1600);
    } else msg.textContent = TR('Senden hat nicht geklappt. Bist du online? Versuch es gleich noch einmal.');
  };
  BUG.frame.onload = () => done(true);
  BUG.t = setTimeout(() => done(false), 20000);
  document.body.appendChild(f);
  if (!navigator.onLine) {
    f.remove();
    done(false);
    return;
  }
  f.submit();
  setTimeout(() => f.remove(), 1000);
}
$('#btnBug').addEventListener('click', () => bugOpen('menu'));
$('#btnBug2').addEventListener('click', () => bugOpen('pause'));
$('#bugBack').addEventListener('click', () => showScreen(BUG.from));
$('#bugSend').addEventListener('click', bugSend);
$('#bugTxt').addEventListener('input', () => !BUG.busy && ($('#bugMsg').textContent = ''));
$('#bugPick').addEventListener('click', () => $('#bugFile').click());
$('#bugFile').addEventListener('change', e => {
  const fl = e.target.files && e.target.files[0];
  if (fl && /^image\//.test(fl.type) && fl.size < 8e6) bugShot(fl);
  else if (fl) $('#bugMsg').textContent = TR('Das Bild ist zu groß (höchstens 8 MB).');
  e.target.value = '';
});
