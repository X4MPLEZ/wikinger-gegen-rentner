/* 66-profile-ui.js - PROFILE ON SCREEN: the chip at the top of the menu, the profile screen (Ruhmespfad, Erfolge, Sammlung, Statistik,
   transfer), the rewards on the end screen, the VS card at the start of an online match. The logic lives in 65-profile.js. */
function profChipUi() {
  const lv = lvOf(PLAYER.xp);
  $('#pcAv').src = avatarURL(PLAYER.av);
  $('#pcName').textContent = profName(PLAYER.nm, PLAYER.nr);
  $('#pcLv').textContent = TR('Lv {0}', lv.L);
  $('#pcBar').style.width = Math.round((lv.x / lv.need) * 100) + '%';
  $('#pcGems').textContent = PLAYER.gems;
}
const PUI = { tab: 'path', buy: null, xfer: null, replace: false };
function profMsg(t) {
  const m = $('#pMsg');
  m.textContent = t;
  m.hidden = false;
  clearTimeout(PUI.msgT);
  PUI.msgT = setTimeout(() => (m.hidden = true), 3200);
}
function profOpen(tab) {
  PUI.tab = tab || PUI.tab;
  PUI.buy = null;
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
  $('#pGems').textContent = PLAYER.gems;
  $$('.ptabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === PUI.tab)));
  const box = $('#pBody');
  box.innerHTML = '';
  ({ path: profTabPath, ach: profTabAch, coll: profTabColl, stats: profTabStats, xfer: profTabXfer })[PUI.tab](box);
  profChipUi();
}
const mkEl = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
function rewardText(r) {
  const out = [];
  if (!r) return TR('Start');
  if (r.av) out.push(TR('Profilbild'));
  if (r.sk) out.push(TR('Skins: {0} und {1}', SKINS[r.sk[0]].n, SKINS[r.sk[1]].n));
  if (r.gems) out.push(TR('{0} Juwelen', r.gems));
  return out.join(' · ');
}
function skinSwatch(id) {
  const s = mkEl('span', 'swatch');
  s.style.background = `linear-gradient(135deg, ${SKINS[id].c[0]} 0 55%, ${SKINS[id].c[1]} 55% 100%)`;
  return s;
}
function profTabPath(box) {
  const L = profLevel(),
    list = mkEl('div', 'ppath');
  for (let i = 1; i <= LEVEL_MAX; i++) {
    const r = LEVEL_REWARDS[i],
      row = mkEl('div', 'lvrow' + (i < L ? ' done' : i === L ? ' cur' : ''));
    row.appendChild(mkEl('b', 'lvn', TR('Lv {0}', i)));
    row.appendChild(mkEl('span', 'lvt', rewardText(r)));
    const pics = mkEl('span', 'lvp');
    if (r && r.av) {
      const im = mkEl('img');
      im.src = avatarURL(r.av);
      im.alt = '';
      pics.appendChild(im);
    }
    if (r && r.sk) r.sk.forEach(id => pics.appendChild(skinSwatch(id)));
    row.appendChild(pics);
    if (i < L) row.appendChild(mkEl('span', 'lvok', '✓'));
    list.appendChild(row);
    if (i === L) setTimeout(() => row.scrollIntoView({ block: 'center' }), 0);
  }
  box.appendChild(list);
  box.appendChild(mkEl('p', 'note', TR('Ab Level {0}: alle 500 EP gibt es 30 Juwelen.', LEVEL_MAX)));
}
function profTabAch(box) {
  const got = ACH.filter(a => PLAYER.ach[a.id]).length;
  box.appendChild(mkEl('p', 'note', TR('{0} von {1} Erfolgen', got, ACH.length)));
  const grid = mkEl('div', 'achs');
  for (const a of ACH) {
    const t = mkEl('div', 'ach' + (PLAYER.ach[a.id] ? ' got' : ''));
    const ic = mkEl('span', 'ai');
    ic.innerHTML = si(a.ic);
    t.append(ic, mkEl('b', '', a.n), mkEl('small', '', a.d));
    const g = mkEl('span', 'ag');
    g.innerHTML = si('gem') + '<i></i>';
    g.lastChild.textContent = '+' + a.g;
    t.appendChild(g);
    grid.appendChild(t);
  }
  box.appendChild(grid);
}
// one tile for a picture or a skin: equip when owned, buy with Juwelen (tap twice), or tell how it unlocks
function collTile(id, isAv) {
  const it = isAv ? AV_BY[id] : SKINS[id],
    own = profOwns(id),
    eq = isAv ? PLAYER.av === id : PLAYER.sk[it.fac] === id,
    b = mkEl('button', 'ctile' + (own ? ' own' : '') + (eq ? ' eq' : ''));
  if (isAv) {
    const im = mkEl('img');
    im.src = avatarURL(id);
    im.alt = '';
    b.appendChild(im);
  } else {
    b.appendChild(skinSwatch(id));
    b.appendChild(mkEl('b', 'cn', it.n));
  }
  const u = it.u,
    st = mkEl('small', 'cs');
  if (eq) st.textContent = TR('Ausgewählt');
  else if (own) st.textContent = TR('Wählen');
  else if (u.gems && PUI.buy === id) st.textContent = TR('Kaufen?');
  else {
    const parts = [];
    if (u.lv) parts.push(TR('Lv {0}', u.lv));
    if (u.ach) parts.push(TR('Erfolg: {0}', ACH_BY[u.ach].n));
    st.textContent = parts.join(' · ');
    if (u.gems) {
      const g = mkEl('span', 'cg');
      g.innerHTML = si('gem') + '<i></i>';
      g.lastChild.textContent = u.gems;
      if (parts.length) st.append(' · ');
      st.appendChild(g);
    }
    const lk = mkEl('span', 'clock');
    lk.innerHTML = si('lock');
    b.appendChild(lk);
  }
  b.appendChild(st);
  b.addEventListener('click', () => {
    SFX.play('click');
    if (own) {
      profEquip(id);
      if (!isAv && V.mode === 'menu') menuPose();
    } else if (u.gems) {
      if (PLAYER.gems < u.gems) {
        PUI.buy = null;
        profMsg(TR('Dafür fehlen dir noch {0} Juwelen.', u.gems - PLAYER.gems));
      } else if (PUI.buy !== id) PUI.buy = id;
      else {
        PUI.buy = null;
        if (profBuy(id)) {
          SFX.play('ding');
          profEquip(id);
          if (!isAv && V.mode === 'menu') menuPose();
        }
      }
    }
    profUi();
  });
  return b;
}
function profTabColl(box) {
  box.appendChild(mkEl('div', 'label', TR('Profilbilder')));
  box.appendChild(mkEl('p', 'note', TR('Dein Profilbild sehen andere Spieler in der Liste der offenen Spiele und online.')));
  const g1 = mkEl('div', 'cgrid av');
  AVATARS.forEach(a => g1.appendChild(collTile(a.id, true)));
  box.appendChild(g1);
  for (const f of ['viking', 'rentner']) {
    box.appendChild(mkEl('div', 'label', TR('Skins: {0}', FAC[f].name)));
    const g = mkEl('div', 'cgrid sk');
    SKIN_IDS.filter(id => SKINS[id].fac === f).forEach(id => g.appendChild(collTile(id, false)));
    box.appendChild(g);
  }
  box.appendChild(mkEl('p', 'note', TR('Skins färben deine Armee um. Online sieht dein Gegner sie auch.')));
}
function profTabStats(box) {
  const S = PLAYER.st,
    pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '–'),
    hm = s => Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' h';
  const rows = [
    [TR('Partien'), S.games],
    [TR('Siege'), S.wins + ' (' + pct(S.wins, S.games) + ')'],
    [TR('Online-Siege'), S.onWins + ' / ' + S.onGames],
    [TR('Beste Siegesserie'), S.best],
    [TR('Besiegte Gegner'), S.kills],
    [TR('Ausgebildete Krieger'), S.made],
    [TR('Verlorene Krieger'), S.lost],
    [TR('Helden besiegt'), S.ego],
    [TR('Katapulte zerstört'), S.cats],
    [TR('Klippenstürze'), S.cliff],
    [TR('Rammstöße'), S.rams],
    [TR('Eislöcher'), S.holes],
    [TR('Gezähmt'), S.tames],
    [TR('Spielzeit'), hm(S.time)],
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
$('#pBack').addEventListener('click', () => {
  SFX.play('click');
  showScreen('menu');
});
setTimeout(profChipUi, 0); // after the page has loaded (the 3D heads need every file)
// the end screen: XP with the level bar, Juwelen, new levels and achievements
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
  for (const id of R.ach) {
    const A = ACH_BY[id],
      d = mkEl('div', 'rach');
    d.innerHTML = si(A.ic) + '<span></span>';
    d.lastChild.textContent = TR('Erfolg: {0} · +{1} Juwelen', A.n, A.g);
    box.appendChild(d);
  }
  if (R.lvUp.length || R.ach.length) SFX.play('ding');
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
