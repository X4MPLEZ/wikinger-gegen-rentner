/* 62-screens.js - SCREENS: menu, lobby, pause (Aufgeben asks twice; online it tells the opponent: quitMatch), graphics/sound/keys settings, the menu scene. */
function showScreen(id) {
  ['menu', 'lobby', 'pause', 'end', 'faceScr', 'keysScr', 'gfxScr', 'sndScr'].forEach(s => ($('#' + s).hidden = s !== id));
}
let gfxFrom = 'menu';
function gfxUi() {
  const sc = $('#gfxScr');
  if (!sc || sc.hidden) return;
  const m = QS.mode();
  $$('#gfxQ button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.q === m)));
  const pr = renderer.getPixelRatio(),
    T = QS.tier();
  $('#gfxNow').textContent =
    (m === 'auto'
      ? 'Passt sich laufend an dein Gerät an. Zurzeit: ' + T.name + (LADDER[QS.lvl].m < 1 ? ' mit etwas geringerer Auflösung' : '') + '.'
      : 'Feste Stufe: ' + T.name + '.') +
    ' Bild: ' +
    (() => {
      const v = renderer.getDrawingBufferSize(new THREE.Vector2());
      return v.x + ' × ' + v.y;
    })() +
    ' Pixel' +
    (sun.castShadow ? ', Schatten ' + sun.shadow.mapSize.x : ', ohne Echtzeit-Schatten') +
    (QS.cap ? ', Bildrate auf ' + QS.cap + ' begrenzt' : '') +
    '.';
  $('#gfxSh').value = SET.gfxSh || 'auto';
  $('#gfxFx').value = SET.gfxFx || 'auto';
  $('#gfxRes').value = SET.gfxRes || 'auto';
  $('#gfxFps').value = SET.gfxFps || 'auto';
}
['#btnGfx', '#btnGfx2'].forEach((id, i) =>
  $(id).addEventListener('click', () => {
    gfxFrom = i ? 'pause' : 'menu';
    showScreen('gfxScr');
    gfxUi();
  })
);
$('#gfxBack').addEventListener('click', () => showScreen(gfxFrom));
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
    $('#onlineNote').textContent = 'Dein Gegner gibt diesen Code bei „Beitreten“ ein. Die Partie startet, sobald er verbunden ist.';
    setLobbyStatus(status, busy);
    showScreen('menu');
    return;
  }
  $('#lobbyTitle').textContent = isHost ? 'Spiel erstellt' : 'Beitreten';
  $('#lobbyCode').textContent = code;
  $('#lobbyCodeWrap').hidden = !isHost;
  $('#lobbyNote').textContent = isHost
    ? 'Dein Gegner öffnet dieses Spiel auf seinem Gerät und tippt den Code bei „Beitreten“ ein.'
    : 'Code: ' + code;
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
  const via = NET.via === 'relay' ? 'Server' : NET.via === 'claude' ? 'Claude' : 'Direkt',
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
  const o = 'Erobere die Fahnen. Reiß die Basis ein.';
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
      '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="#f3efe6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    icoOut =
      '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="#f3efe6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  const sync = () =>
    $$('.fsBtn').forEach(b => {
      b.hidden = !can;
      b.innerHTML = isFs() ? icoOut : icoIn;
      b.setAttribute('aria-label', isFs() ? 'Vollbild beenden' : 'Vollbild');
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
$$('[data-face]').forEach(img => {
  const k = +img.dataset.face;
  try {
    img.src = unitHead(k) || PORTRAIT[k];
  } catch (_) {
    img.src = PORTRAIT[k];
  }
});
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
  $('#tutText').textContent = 'Tutorial wirklich beenden?';
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
    ? 'Code kopiert: ' + code + '. Dein Gegner gibt ihn bei „Beitreten“ ein.'
    : 'Code markiert: ' + code + '. Mit „Kopieren“ oder Strg/Cmd+C kopieren.';
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
  $('#pauseTitle').textContent = online ? 'Menü – das Spiel läuft weiter!' : 'Pause';
  $('#btnResume').textContent = V.mode === 'ai' ? 'Weiter' : 'Zurück zum Spiel';
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
  b.textContent = on ? 'Wirklich aufgeben?' : 'Aufgeben';
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
      'gegen den Computer · ' + AI_LVL[aiLvl].name + (gameMode === 'chaos' ? ' · Chaos' : gameMode === 'fog' ? ' · Nebel' : '');
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
  buildBases(V.facs);
  FLAGS.forEach((_, i) => updateFlag(i, -1, 0, false));
  menuPose();
}
function menuPose() {
  menuUnits.forEach(disposeUnit);
  menuUnits = [];
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
