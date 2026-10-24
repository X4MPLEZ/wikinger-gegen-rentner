/* 66-profile-ui.js - PROFILE ON SCREEN: the chip at the top of the menu, the profile page (a home button on top, one scrolling body):
   Ruhmespfad (a track of levels with a 3D showcase of the rewards), daily quests, achievements, collection (pictures and skins with a 3D
   preview), statistics, transfer; the rewards on the end screen and the VS card at the start of an online match. The logic lives in
   65-profile.js, the 3D showcase in 67-showcase.js. */
function profChipUi() {
  const lv = lvOf(PLAYER.xp);
  $('#pcAv').src = avatarURL(PLAYER.av);
  $('#pcName').textContent = profName(PLAYER.nm, PLAYER.nr);
  $('#pcLv').textContent = TR('Lv {0}', lv.L);
  $('#pcBar').style.width = Math.round((lv.x / lv.need) * 100) + '%';
  $('#pcGems').textContent = GOD.on ? '∞' : PLAYER.gems;
  const Q = dqToday(),
    open = Q.c.filter(c => !c).length;
  const qb = $('#pcQuest');
  if (qb) {
    qb.textContent = open;
    qb.hidden = !open;
  }
}
const PUI = { tab: 'path', xfer: null, replace: false, sel: null, fac: null, sheet: null, taps: 0, tapT: 0 };
function profMsg(t) {
  const m = $('#pMsg');
  m.textContent = t;
  m.hidden = false;
  clearTimeout(PUI.msgT);
  PUI.msgT = setTimeout(() => (m.hidden = true), 3200);
}
function profOpen(tab) {
  PUI.tab = tab || PUI.tab;
  PUI.sel = null;
  profSheet(null);
  showScreen('profScr');
  profUi();
  fitText();
}
function profUi() {
  const lv = lvOf(PLAYER.xp);
  $('#pAv').src = avatarURL(PLAYER.av);
  $('#pName').textContent = profName(PLAYER.nm, PLAYER.nr);
  $('#pLv').textContent = TR('Lv {0}', lv.L) + (lv.master ? ' · ' + TR('Meister') : '');
  $('#pBar').style.width = Math.round((lv.x / lv.need) * 100) + '%';
  $('#pXp').textContent = TR('{0} / {1} EP', lv.x, lv.need);
  $('#pGems').textContent = GOD.on ? '∞' : PLAYER.gems;
  $$('.ptabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === PUI.tab)));
  godBar();
  const box = $('#pBody'),
    keepScroll = box.dataset.tab === PUI.tab ? box.scrollTop : 0;
  box.dataset.tab = PUI.tab;
  box.innerHTML = '';
  ({ path: profTabPath, quests: profTabQuests, ach: profTabAch, coll: profTabColl, stats: profTabStats, xfer: profTabXfer })[PUI.tab](box);
  box.scrollTop = keepScroll;
  profChipUi();
}
const mkEl = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
const gemEl = (n, cls = 'gemn') => {
  const g = mkEl('span', cls);
  g.innerHTML = si('gem') + '<i></i>';
  g.lastChild.textContent = n;
  return g;
};
function rewardText(r) {
  const out = [];
  if (!r) return TR('Start');
  if (r.av) out.push(TR('Profilbild'));
  if (r.sk) out.push(TR('Skins: {0} und {1}', SKINS[r.sk[0]].n, SKINS[r.sk[1]].n));
  if (r.gems) out.push(TR('{0} Juwelen', r.gems));
  return out.join(' · ');
}
// the faction shown first in previews: the one the player plays
const myFacPref = () => PUI.fac || (typeof myFac === 'string' ? myFac : 'viking');
// the god mode bar: level up/down, leave
function godBar() {
  let g = $('#pGod');
  if (!GOD.on) {
    if (g) g.remove();
    return;
  }
  if (!g) {
    g = mkEl('div', 'godbar');
    g.id = 'pGod';
    $('#pBody').before(g);
  }
  g.innerHTML = '';
  const L = profLevel(),
    b = (t, f) => {
      const x = mkEl('button', 'btn small', t);
      x.addEventListener('click', () => {
        SFX.play('click');
        f();
        profUi();
      });
      return x;
    };
  g.append(
    mkEl('b', '', TR('Gott-Modus')),
    mkEl('span', 'gd', TR('Alles frei, nichts wird gespeichert')),
    b('−', () => godLevel(L - 1)),
    mkEl('span', 'gl', TR('Lv {0}', L)),
    b('+', () => godLevel(L + 1)),
    b(TR('Beenden'), () => {
      godSet(false);
      if (V.mode === 'menu') menuPose();
    })
  );
}
/* ---------- Ruhmespfad: a track of levels; the selected level's reward on a 3D stage ---------- */
function bpNext(L) {
  for (let i = L + 1; i <= LEVEL_MAX; i++) if (LEVEL_REWARDS[i]) return i;
  return LEVEL_MAX;
}
function profTabPath(box) {
  const lv = lvOf(PLAYER.xp),
    L = lv.L;
  if (!PUI.sel) PUI.sel = L >= LEVEL_MAX ? LEVEL_MAX : bpNext(L);
  const sel = PUI.sel,
    r = LEVEL_REWARDS[sel];
  const bp = mkEl('div', 'bp');
  // the stage
  const show = mkEl('div', 'bpshow'),
    stage = mkEl('div', 'bpstage'),
    info = mkEl('div', 'bpinfo');
  show.append(stage, info);
  info.appendChild(mkEl('small', 'bplv', TR('Level {0}', sel)));
  info.appendChild(mkEl('b', 'bpname', rewardText(r)));
  const state = mkEl('span', 'bpstate');
  if (sel <= L) {
    state.textContent = '✓ ' + TR('Freigeschaltet');
    state.classList.add('ok');
  } else {
    let need = lv.need - lv.x;
    for (let i = L + 1; i < sel; i++) need += lvNeed(i);
    state.textContent = TR('Noch {0} EP', need);
  }
  info.appendChild(state);
  if (r && r.sk) {
    // which faction's skin is on the stage
    const seg = mkEl('div', 'bpfac');
    for (const f of ['viking', 'rentner']) {
      const b = mkEl('button', myFacPref() === f ? 'on' : '', FAC[f].name);
      b.addEventListener('click', () => {
        SFX.play('click');
        PUI.fac = f;
        profUi();
      });
      seg.appendChild(b);
    }
    info.appendChild(seg);
    const id = r.sk.find(x => SKINS[x].fac === myFacPref());
    showMount(stage, { fac: myFacPref(), skin: id });
    stage.appendChild(mkEl('span', 'bptag', SKINS[id].n));
  } else if (r && r.av) {
    const im = mkEl('img', 'bpav');
    im.src = avatarURL(r.av);
    im.alt = '';
    stage.appendChild(im);
    stage.classList.add('flat');
  } else if (r && r.gems) {
    const g = mkEl('div', 'bpgem');
    g.innerHTML = si('gem');
    g.appendChild(mkEl('b', '', '+' + r.gems));
    stage.appendChild(g);
    stage.classList.add('flat');
  } else {
    showMount(stage, { fac: myFacPref(), skin: PLAYER.sk[myFacPref()] });
  }
  bp.appendChild(show);
  // the track
  const track = mkEl('div', 'bptrack');
  let selNode = null;
  for (let i = 1; i <= LEVEL_MAX; i++) {
    const rw = LEVEL_REWARDS[i],
      n = mkEl('button', 'bpnode' + (i <= L ? ' done' : '') + (i === L ? ' cur' : '') + (i === sel ? ' sel' : ''));
    n.appendChild(mkEl('span', 'bpn', String(i)));
    const ic = mkEl('span', 'bpic');
    if (rw && rw.sk) {
      const im = mkEl('img');
      im.src = skinThumb(rw.sk.find(x => SKINS[x].fac === myFacPref()));
      im.alt = '';
      ic.appendChild(im);
      n.classList.add('big');
    } else if (rw && rw.av) {
      const im = mkEl('img', 'round');
      im.src = avatarURL(rw.av);
      im.alt = '';
      ic.appendChild(im);
    } else if (rw && rw.gems) ic.appendChild(gemEl(rw.gems));
    else ic.textContent = '★';
    n.appendChild(ic);
    if (i <= L) n.appendChild(mkEl('span', 'bpok', '✓'));
    n.addEventListener('click', () => {
      SFX.play('click');
      PUI.sel = i;
      profUi();
    });
    track.appendChild(n);
    if (i === sel) selNode = n;
  }
  bp.appendChild(track);
  bp.appendChild(mkEl('p', 'note', TR('Ab Level {0}: alle 500 EP gibt es 30 Juwelen.', LEVEL_MAX)));
  box.appendChild(bp);
  if (selNode)
    requestAnimationFrame(() => {
      const tl = selNode.offsetLeft - track.clientWidth / 2 + selNode.clientWidth / 2;
      track.scrollLeft = PUI.trackX !== undefined && PUI.keepTrack ? PUI.trackX : tl;
      PUI.keepTrack = false;
    });
  track.addEventListener('scroll', () => (PUI.trackX = track.scrollLeft));
  track.addEventListener('click', () => (PUI.keepTrack = true), true);
}
/* ---------- daily quests ---------- */
function profTabQuests(box) {
  const Q = dqToday(),
    h = Math.floor(dqLeft() / 3600000),
    mn = Math.floor((dqLeft() % 3600000) / 60000);
  box.appendChild(mkEl('p', 'note', TR('Neue Aufgaben in {0} h {1} min', h, mn)));
  const list = mkEl('div', 'quests');
  Q.ids.forEach((id, i) => {
    const q = DQ_BY[id],
      done = !!Q.c[i],
      c = mkEl('div', 'quest' + (done ? ' done' : ''));
    const top = mkEl('div', 'qtop');
    top.append(mkEl('b', 'qn', q.n), gemEl('+' + q.gems));
    const bar = mkEl('i', 'pbar'),
      f = mkEl('i');
    f.style.width = Math.round((Q.p[i] / q.g) * 100) + '%';
    bar.appendChild(f);
    c.append(top, bar, mkEl('small', 'qp', done ? '✓ ' + TR('Geschafft') : Q.p[i] + ' / ' + q.g));
    list.appendChild(c);
  });
  const bonus = mkEl('div', 'quest bonus' + (Q.b ? ' done' : ''));
  const bt = mkEl('div', 'qtop');
  bt.append(mkEl('b', 'qn', TR('Alle drei geschafft')), gemEl('+' + DQ_BONUS));
  bonus.append(bt, mkEl('small', 'qp', Q.b ? '✓ ' + TR('Geschafft') : Q.c.filter(Boolean).length + ' / 3'));
  list.appendChild(bonus);
  box.appendChild(list);
  box.appendChild(
    mkEl('p', 'note', TR('Aufgaben zählen in jeder fertigen Partie, gegen den Computer und online. Die Juwelen gibt es sofort.'))
  );
}
/* ---------- achievements ---------- */
function profTabAch(box) {
  const got = ACH.filter(a => PLAYER.ach[a.id]).length;
  const head = mkEl('div', 'achhead');
  const bar = mkEl('i', 'pbar'),
    f = mkEl('i');
  f.style.width = Math.round((got / ACH.length) * 100) + '%';
  bar.appendChild(f);
  head.append(mkEl('b', '', TR('{0} von {1} Erfolgen', got, ACH.length)), bar);
  box.appendChild(head);
  const grid = mkEl('div', 'achs');
  for (const a of [...ACH].sort((x, y) => !!PLAYER.ach[y.id] - !!PLAYER.ach[x.id])) {
    const t = mkEl('div', 'ach' + (PLAYER.ach[a.id] ? ' got' : ''));
    const ic = mkEl('span', 'ai');
    ic.innerHTML = si(a.ic);
    t.append(ic, mkEl('b', '', a.n), mkEl('small', '', a.d));
    t.appendChild(gemEl('+' + a.g, 'ag'));
    grid.appendChild(t);
  }
  box.appendChild(grid);
}
/* ---------- collection: profile pictures and skins; a tap opens the preview ---------- */
function unlockText(it) {
  const u = it.u,
    parts = [];
  if (u.lv) parts.push(TR('Ab Level {0} im Ruhmespfad', u.lv));
  if (u.ach) parts.push(TR('Erfolg: {0}', ACH_BY[u.ach].n));
  return parts.join(' · ');
}
function collTile(id, isAv) {
  const it = isAv ? AV_BY[id] : SKINS[id],
    own = profOwns(id),
    eq = isAv ? PLAYER.av === id : PLAYER.sk[it.fac] === id,
    b = mkEl('button', 'ctile' + (isAv ? ' av' : ' sk') + (own ? ' own' : '') + (eq ? ' eq' : ''));
  const im = mkEl('img');
  im.src = isAv ? avatarURL(id) : skinThumb(id);
  im.alt = '';
  b.appendChild(im);
  if (!isAv) b.appendChild(mkEl('b', 'cn', it.n));
  const st = mkEl('small', 'cs');
  if (eq) st.textContent = TR('Ausgewählt');
  else if (own) st.textContent = TR('Wählen');
  else if (it.u.gems) st.appendChild(gemEl(it.u.gems));
  else st.textContent = it.u.lv ? TR('Lv {0}', it.u.lv) : TR('Erfolg');
  if (!own) {
    const lk = mkEl('span', 'clock');
    lk.innerHTML = si('lock');
    b.appendChild(lk);
  }
  b.appendChild(st);
  b.addEventListener('click', () => {
    SFX.play('click');
    profSheet({ id, isAv });
  });
  return b;
}
function profTabColl(box) {
  for (const f of [myFacPref(), myFacPref() === 'viking' ? 'rentner' : 'viking']) {
    box.appendChild(mkEl('div', 'label', TR('Skins: {0}', FAC[f].name)));
    const g = mkEl('div', 'cgrid sk');
    SKIN_IDS.filter(id => SKINS[id].fac === f).forEach(id => g.appendChild(collTile(id, false)));
    box.appendChild(g);
  }
  box.appendChild(mkEl('p', 'note', TR('Skins geben deiner Armee neue Farben und eigene Ausrüstung. Online sieht dein Gegner sie auch.')));
  box.appendChild(mkEl('div', 'label', TR('Profilbilder')));
  box.appendChild(mkEl('p', 'note', TR('Dein Profilbild sehen andere Spieler in der Liste der offenen Spiele und online.')));
  const g1 = mkEl('div', 'cgrid av');
  AVATARS.forEach(a => g1.appendChild(collTile(a.id, true)));
  box.appendChild(g1);
}
// the preview sheet: the skin in 3D (or the picture big) and what to do with it
function profSheet(o) {
  const sh = $('#pSheet');
  PUI.sheet = o;
  if (!o) {
    sh.hidden = true;
    sh.innerHTML = '';
    if (PUI.tab === 'path') profUi(); // the stage goes back to the Ruhmespfad
    return;
  }
  const { id, isAv } = o,
    it = isAv ? AV_BY[id] : SKINS[id],
    own = profOwns(id),
    eq = isAv ? PLAYER.av === id : PLAYER.sk[it.fac] === id;
  sh.innerHTML = '';
  sh.hidden = false;
  const card = mkEl('div', 'pscard'),
    stage = mkEl('div', 'psstage' + (isAv ? ' flat' : ''));
  card.appendChild(stage);
  if (isAv) {
    const im = mkEl('img', 'bpav');
    im.src = avatarURL(id);
    im.alt = '';
    stage.appendChild(im);
  } else {
    showMount(stage, { fac: it.fac, skin: id });
    stage.appendChild(mkEl('span', 'pshint', TR('Zum Drehen ziehen')));
  }
  card.appendChild(mkEl('b', 'psname', isAv ? TR('Profilbild') : it.n));
  if (!isAv) card.appendChild(mkEl('small', 'psfac', FAC[it.fac].name));
  const row = mkEl('div', 'row'),
    act = mkEl('button', 'btn gold'),
    back = mkEl('button', 'btn', TR('Zurück'));
  const msg = mkEl('p', 'pssub');
  if (eq) {
    act.textContent = TR('Ausgewählt');
    act.disabled = true;
  } else if (own) {
    act.textContent = TR('Auswählen');
    act.addEventListener('click', () => {
      SFX.play('ding');
      profEquip(id);
      if (!isAv && V.mode === 'menu') menuPose();
      profSheet(null);
      profUi();
    });
  } else if (it.u.gems) {
    const enough = PLAYER.gems >= it.u.gems;
    act.innerHTML = '';
    act.append(TR('Kaufen') + ' · ', gemEl(it.u.gems));
    if (!enough) {
      act.disabled = true;
      msg.textContent = TR('Dafür fehlen dir noch {0} Juwelen.', it.u.gems - PLAYER.gems);
    } else
      act.addEventListener('click', () => {
        if (!profBuy(id)) return;
        SFX.play('ding');
        profEquip(id);
        if (!isAv && V.mode === 'menu') menuPose();
        profSheet(null);
        profUi();
        profMsg(TR('Freigeschaltet!'));
      });
  } else {
    act.textContent = TR('Gesperrt');
    act.disabled = true;
    msg.textContent = unlockText(it);
  }
  back.addEventListener('click', () => {
    SFX.play('click');
    profSheet(null);
  });
  row.append(back, act);
  card.append(msg, row);
  sh.appendChild(card);
}
function profTabStats(box) {
  const S = PLAYER.st,
    pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '–'),
    hm = s => Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' h';
  const big = mkEl('div', 'pkpis');
  for (const [a, b] of [
    [TR('Partien'), S.games],
    [TR('Siege'), pct(S.wins, S.games)],
    [TR('Besiegte Gegner'), S.kills],
    [TR('Spielzeit'), hm(S.time)],
  ]) {
    const k = mkEl('div', 'pkpi');
    k.append(mkEl('b', '', String(b)), mkEl('small', '', a));
    big.appendChild(k);
  }
  box.appendChild(big);
  const rows = [
    [TR('Siege'), S.wins],
    [TR('Online-Siege'), S.onWins + ' / ' + S.onGames],
    [TR('Beste Siegesserie'), S.best],
    [TR('Ausgebildete Krieger'), S.made],
    [TR('Verlorene Krieger'), S.lost],
    [TR('Helden besiegt'), S.ego],
    [TR('Katapulte zerstört'), S.cats],
    [TR('Klippenstürze'), S.cliff],
    [TR('Rammstöße'), S.rams],
    [TR('Eislöcher'), S.holes],
    [TR('Gezähmt'), S.tames],
  ];
  for (const k of Object.keys(AI_LVL)) rows.push([TR('Siege gegen den Computer · {0}', AI_LVL[k].name), S.wLvl[k] || 0]);
  for (const f of ['rentner', 'viking']) rows.push([TR('Siege als {0}', FAC[f].name), S.wFac[f]]);
  for (const m of MAPTYPE_KEYS) rows.push([TR('Siege · {0}', MAPTYPES[m].n), S.wMap[m]]);
  const t = mkEl('div', 'pstats');
  for (const [a, b] of rows) t.append(mkEl('span', '', a), mkEl('b', '', String(b)));
  box.appendChild(t);
}
function profTabXfer(box) {
  box.appendChild(mkEl('div', 'label', TR('Auf ein anderes Gerät mitnehmen')));
  box.appendChild(mkEl('p', 'note', TR('Erzeuge einen Code und gib ihn auf dem anderen Gerät ein. Er gilt 10 Minuten.')));
  const code = mkEl('div', 'bigcode xcode', XFER.code ? XFER.code.slice(0, 4) + ' ' + XFER.code.slice(4) : '');
  code.hidden = !XFER.code;
  const send = mkEl('button', 'btn', XFER.code ? TR('Neuer Code') : TR('Code erzeugen'));
  send.addEventListener('click', async () => {
    send.disabled = true;
    const c = await profSend();
    if (!c) profMsg(TR('Gerade keine Verbindung. Bist du online?'));
    profUi();
  });
  if (GOD.on) send.disabled = true;
  box.append(code, send);
  box.appendChild(mkEl('div', 'label', TR('Profil von einem anderen Gerät holen')));
  box.appendChild(mkEl('p', 'note', TR('Gib den Code vom anderen Gerät ein. Dein Profil auf diesem Gerät wird dabei ersetzt.')));
  const row = mkEl('div', 'orow xrow'),
    inp = mkEl('input', 'code');
  inp.maxLength = 9;
  inp.inputMode = 'numeric';
  inp.placeholder = '0000 0000';
  inp.autocomplete = 'off';
  const go = mkEl('button', 'btn', PUI.replace ? TR('Wirklich ersetzen?') : TR('Laden'));
  if (GOD.on) go.disabled = true;
  const msg = mkEl('p', 'status');
  go.addEventListener('click', async () => {
    const c = inp.value.replace(/\D/g, '');
    if (c.length !== 8) {
      msg.textContent = TR('Der Code hat 8 Ziffern.');
      return;
    }
    if (PLAYER.xp > 0 && !PUI.replace) {
      PUI.replace = true;
      go.textContent = TR('Wirklich ersetzen?');
      return;
    }
    PUI.replace = false;
    go.disabled = true;
    msg.textContent = TR('Suche dein Profil');
    msg.classList.add('dots');
    const P = await profFetch(c);
    msg.classList.remove('dots');
    go.disabled = false;
    go.textContent = TR('Laden');
    if (!P) {
      msg.textContent = TR('Kein Profil mit diesem Code gefunden. Läuft der Code auf dem anderen Gerät noch?');
      return;
    }
    PLAYER = P;
    profSave();
    PUI.tab = 'path';
    profUi();
    profMsg(TR('Profil übernommen!'));
    if (V.mode === 'menu') menuPose();
  });
  row.append(inp, go);
  box.append(row, msg);
}
$('#profChip').addEventListener('click', () => {
  SFX.play('click');
  profOpen();
});
$('#pAvBtn').addEventListener('click', () => profOpen('coll'));
$$('.ptabs button').forEach(b =>
  b.addEventListener('click', () => {
    SFX.play('click');
    profOpen(b.dataset.tab);
  })
);
$('#pReroll').addEventListener('click', () => {
  SFX.play('click');
  let nm, nr;
  do {
    nm = Math.floor(Math.random() * PROF_NAMES.length);
    nr = 10 + Math.floor(Math.random() * 90);
  } while (nm === PLAYER.nm);
  PLAYER.nm = nm;
  PLAYER.nr = nr;
  profSave();
  profUi();
});
$('#pXfer').addEventListener('click', () => {
  SFX.play('click');
  PUI.replace = false;
  profOpen('xfer');
});
const profHome = () => {
  SFX.play('click');
  profSheet(null);
  showScreen('menu');
};
$('#pBack').addEventListener('click', profHome);
$('#pHome').addEventListener('click', profHome);
// seven quick taps on the level: god mode on/off (for trying out skins)
$('#pLv').addEventListener('click', () => {
  const t = now();
  PUI.taps = t - PUI.tapT < 600 ? PUI.taps + 1 : 1;
  PUI.tapT = t;
  if (PUI.taps >= 7) {
    PUI.taps = 0;
    godSet(!GOD.on);
    toast(GOD.on ? TR('Gott-Modus an: alles frei, nichts wird gespeichert') : TR('Gott-Modus aus'));
    if (V.mode === 'menu') menuPose();
    profUi();
  }
});
if (/[?&]gott=1/.test(location.search)) godSet(true);
setTimeout(profChipUi, 0); // after the page has loaded (the 3D heads need every file)
// the end screen: XP with the level bar, Juwelen, new levels, achievements and finished daily quests
function profEndUi(R) {
  const box = $('#endRew');
  box.innerHTML = '';
  if (!R || (!R.xp && !R.ach.length && !R.gems)) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const top = mkEl('div', 'rtop');
  top.append(mkEl('b', 'rxp', TR('+{0} EP', R.xp)), mkEl('span', 'rlv', TR('Lv {0}', R.lv1.L)));
  const bar = mkEl('i', 'pbar'),
    fill = mkEl('i');
  bar.appendChild(fill);
  top.appendChild(bar);
  box.appendChild(top);
  const up = R.lv1.L > R.lv0.L;
  fill.style.width = (up ? 0 : Math.round((R.lv0.x / R.lv0.need) * 100)) + '%';
  setTimeout(() => (fill.style.width = Math.round((R.lv1.x / R.lv1.need) * 100) + '%'), 400);
  if (R.gems) {
    const g = mkEl('div', 'rgem');
    g.innerHTML = si('gem') + '<span></span>';
    g.lastChild.textContent = TR('+{0} Juwelen', R.gems) + (R.daily ? ' · ' + TR('Tagessieg +{0}', R.daily) : '');
    box.appendChild(g);
  }
  for (const L of R.lvUp) box.appendChild(mkEl('div', 'rlvup', TR('Level {0}! {1}', L, rewardText(LEVEL_REWARDS[L]))));
  for (const id of R.dq || []) {
    const d = mkEl('div', 'rach');
    d.innerHTML = si('star') + '<span></span>';
    d.lastChild.textContent =
      id === 'bonus'
        ? TR('Alle Tagesaufgaben geschafft · +{0} Juwelen', DQ_BONUS)
        : TR('Tagesaufgabe: {0} · +{1} Juwelen', DQ_BY[id].n, DQ_BY[id].gems);
    box.appendChild(d);
  }
  for (const id of R.ach) {
    const A = ACH_BY[id],
      d = mkEl('div', 'rach');
    d.innerHTML = si(A.ic) + '<span></span>';
    d.lastChild.textContent = TR('Erfolg: {0} · +{1} Juwelen', A.n, A.g);
    box.appendChild(d);
  }
  if (R.lvUp.length || R.ach.length || (R.dq && R.dq.length)) SFX.play('ding');
}
// at the start of an online match: who plays against whom
function vsCard(oppPf) {
  const old = $('#vsCard');
  if (old) old.remove();
  if (!oppPf) return;
  const me = { name: profName(PLAYER.nm, PLAYER.nr), av: PLAYER.av, lv: profLevel() },
    d = mkEl('div', '');
  d.id = 'vsCard';
  const side = p => {
    const s = mkEl('div', 'vsP'),
      im = mkEl('img');
    im.src = avatarURL(p.av);
    im.alt = '';
    s.append(im, mkEl('b', '', p.name), mkEl('small', '', TR('Lv {0}', p.lv)));
    return s;
  };
  d.append(side(me), mkEl('span', 'vs', TR('gegen')), side(oppPf));
  $('#game').appendChild(d);
  V.vsN = (V.vsN || 0) + 1; // (read by the tests)
  setTimeout(() => d.remove(), 3600);
}
