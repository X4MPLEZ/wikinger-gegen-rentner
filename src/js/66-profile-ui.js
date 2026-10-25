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
  // the red number: only for things waiting to be looked at (new level rewards, new achievements), never for open quests
  const nw = profNews().n,
    qb = $('#pcQuest');
  if (qb) {
    qb.textContent = nw;
    qb.hidden = !nw;
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
  PUI.trackX = undefined;
  PUI.newFrom = PUI.newAch = undefined;
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
  {
    // what is new: a dot on the tab, "NEU" on the level nodes (kept for this visit, cleared from the count right away)
    const nw = profNews();
    if (PUI.tab === 'path' && PUI.newFrom === undefined) PUI.newFrom = PLAYER.sL;
    $('.ptabs [data-tab="path"]').classList.toggle('nw', nw.lv > 0 && PUI.tab !== 'path');
    $('.ptabs [data-tab="ach"]').classList.toggle('nw', nw.ach > 0 && PUI.tab !== 'ach');
    if (PUI.tab === 'ach' && PUI.newAch === undefined) PUI.newAch = PLAYER.sA;
    profSeen(PUI.tab);
  }
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
/* ---------- Ruhmespfad: every reward side by side over one progress bar, like a trophy road. Swipe (touch), drag (mouse), the
   wheel or ← → move along it; a tap on a reward opens its preview. ---------- */
function bpNext(L) {
  for (let i = L + 1; i <= LEVEL_MAX; i++) if (LEVEL_REWARDS[i]) return i;
  return LEVEL_MAX;
}
// the picture on a reward card
function bpArt(rw, fac) {
  const art = mkEl('span', 'bpart');
  if (rw.sk) {
    const id = rw.sk.find(x => SKINS[x].fac === fac),
      other = rw.sk.find(x => x !== id),
      im = mkEl('img', 'bpsk');
    im.src = skinThumb(id);
    im.alt = '';
    art.appendChild(im);
    const o = mkEl('img', 'bpsk2');
    o.src = skinThumb(other);
    o.alt = '';
    o.dataset.sk = other;
    art.appendChild(o);
  } else if (rw.av) {
    const im = mkEl('img', 'bpavs');
    im.src = avatarURL(rw.av);
    im.alt = '';
    art.appendChild(im);
  } else if (rw.gems) {
    art.innerHTML = si('gem');
    art.classList.add('gemart');
  }
  return art;
}
function profTabPath(box) {
  const lv = lvOf(PLAYER.xp),
    L = lv.L,
    fac = myFacPref(),
    goal = L >= LEVEL_MAX ? LEVEL_MAX : L + 1;
  const bp = mkEl('div', 'bp');
  // headline: what comes next, and a button back to it
  const head = mkEl('div', 'bphead'),
    ht = mkEl('div', 'bpht');
  ht.appendChild(mkEl('b', '', L >= LEVEL_MAX ? TR('Ruhmespfad geschafft!') : TR('Nächste Belohnung: Level {0}', goal)));
  ht.appendChild(
    mkEl('small', '', L >= LEVEL_MAX ? TR('Ab Level {0}: alle 500 EP gibt es 30 Juwelen.', LEVEL_MAX) : TR('Noch {0} EP', lv.need - lv.x))
  );
  const me = mkEl('button', 'bpme', TR('Zu mir'));
  head.append(ht, me);
  bp.appendChild(head);
  // the road
  const road = mkEl('div', 'bproad'),
    row = mkEl('div', 'bprow'),
    bar = mkEl('div', 'bpbar'),
    fill = mkEl('i');
  bar.appendChild(fill);
  row.appendChild(bar);
  road.appendChild(row);
  const cols = [];
  let firstNew = 0;
  for (let i = 1; i <= LEVEL_MAX; i++) {
    const rw = LEVEL_REWARDS[i],
      col = mkEl('div', 'bpcol' + (i <= L ? ' done' : '') + (i === L ? ' cur' : '') + (i === goal && L < LEVEL_MAX ? ' next' : ''));
    if (rw) {
      const card = mkEl('button', 'bpcard' + (rw.sk ? ' skin' : rw.av ? ' av' : ' gem') + (i === LEVEL_MAX ? ' final' : ''));
      card.appendChild(bpArt(rw, fac));
      if (i === LEVEL_MAX) {
        // the last level gives everything at once: the extras as small chips
        const ex = mkEl('span', 'bpextra');
        const im = mkEl('img');
        im.src = avatarURL(rw.av);
        im.alt = '';
        ex.append(im, gemEl('+' + rw.gems));
        card.appendChild(ex);
      }
      card.appendChild(
        mkEl('span', 'bpname', rw.sk ? SKINS[rw.sk.find(x => SKINS[x].fac === fac)].n : rw.av ? TR('Profilbild') : '+' + rw.gems)
      );
      const st = mkEl('span', 'bpst');
      if (i <= L) st.textContent = '✓';
      else st.innerHTML = si('lock');
      card.appendChild(st);
      if (PUI.newFrom !== undefined && i > PUI.newFrom && i <= L) {
        card.appendChild(mkEl('span', 'bpnew', TR('NEU')));
        firstNew ||= i;
      }
      card.setAttribute('aria-label', TR('Level {0}', i) + ': ' + rewardText(rw) + (i <= L ? ' ✓' : ''));
      card.addEventListener('click', e => {
        SFX.play('click');
        const o = e.target.closest('[data-sk]');
        if (o) profSheet({ id: o.dataset.sk, isAv: false });
        else if (rw.sk) profSheet({ id: rw.sk.find(x => SKINS[x].fac === fac), isAv: false });
        else if (rw.av) profSheet({ id: rw.av, isAv: true });
        else {
          card.classList.remove('pop');
          void card.offsetWidth;
          card.classList.add('pop');
          profMsg(i <= L ? TR('{0} Juwelen', rw.gems) + ' ✓' : TR('Noch {0} EP', bpNeed(lv, i)));
        }
      });
      col.appendChild(card);
    } else {
      col.classList.add('start');
      col.appendChild(mkEl('span', 'bpstart', TR('Start')));
    }
    col.appendChild(mkEl('span', 'bpdot', String(i)));
    row.appendChild(col);
    cols[i] = col;
  }
  box.appendChild(bp);
  bp.appendChild(road);
  bp.appendChild(mkEl('p', 'note', TR('Wische durch den Pfad – tippe auf eine Belohnung für die Vorschau.')));
  // bar and fill follow the real column positions
  const cx = i => cols[i].offsetLeft + cols[i].offsetWidth / 2;
  const layout = () => {
    const a = cx(1),
      z = cx(LEVEL_MAX),
      at = L >= LEVEL_MAX ? z : cx(L) + (cx(L + 1) - cx(L)) * (lv.x / lv.need);
    bar.style.left = a + 'px';
    bar.style.width = z - a + 'px';
    fill.style.width = Math.max(0, at - a) + 'px';
  };
  const center = (i, smooth) => {
    const left = cx(i) - road.clientWidth / 2;
    if (smooth) road.scrollTo({ left, behavior: 'smooth' });
    else road.scrollLeft = left;
  };
  const meVis = () => {
    const x = cx(goal) - road.scrollLeft;
    me.classList.toggle('show', x < 0 || x > road.clientWidth);
    me.classList.toggle('right', x > road.clientWidth);
  };
  requestAnimationFrame(() => {
    if (!road.isConnected) return; // drawn again in the meantime
    layout();
    if (PUI.trackX !== undefined) road.scrollLeft = PUI.trackX;
    else center(firstNew || goal, false);
    PUI.trackX = road.scrollLeft;
    meVis();
  });
  road.addEventListener(
    'scroll',
    () => {
      if (!road.isConnected) return;
      PUI.trackX = road.scrollLeft;
      meVis();
    },
    { passive: true }
  );
  me.addEventListener('click', () => {
    SFX.play('click');
    center(goal, true);
  });
  // mouse: drag with a little momentum, the wheel scrolls sideways; touch scrolls natively
  let drag = null,
    moved = false,
    raf = 0;
  road.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button) return;
    cancelAnimationFrame(raf);
    drag = { x: e.clientX, s: road.scrollLeft, lx: e.clientX, t: performance.now(), v: 0, id: e.pointerId };
    moved = false;
  });
  road.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      road.classList.add('drag');
      try {
        road.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (!moved) return;
    road.scrollLeft = drag.s - dx;
    const t = performance.now();
    drag.v = drag.v * 0.4 + ((e.clientX - drag.lx) / Math.max(1, t - drag.t)) * 16 * 0.6;
    drag.lx = e.clientX;
    drag.t = t;
  });
  const end = () => {
    if (!drag) return;
    let v = -drag.v;
    drag = null;
    road.classList.remove('drag');
    const glide = () => {
      if (Math.abs(v) < 0.4) return;
      road.scrollLeft += v;
      v *= 0.92;
      raf = requestAnimationFrame(glide);
    };
    if (moved) glide();
  };
  road.addEventListener('pointerup', end);
  road.addEventListener('pointercancel', end);
  road.addEventListener(
    'click',
    e => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    },
    true
  );
  road.addEventListener(
    'wheel',
    e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      road.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false }
  );
  PUI.bpGo = d => road.scrollBy({ left: d * Math.round(road.clientWidth * 0.6), behavior: 'smooth' });
}
// XP still missing to reach level i
function bpNeed(lv, i) {
  let need = lv.need - lv.x;
  for (let k = lv.L + 1; k < i; k++) need += lvNeed(k);
  return need;
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
  const grid = mkEl('div', 'achs'),
    gotT = id => PLAYER.ach[id] || 0,
    // newest first among the unlocked ones; the ones unlocked since the last visit get "NEU"
    order = [...ACH].sort((x, y) => !!gotT(y.id) - !!gotT(x.id) || gotT(y.id) - gotT(x.id)),
    nNew = Math.max(0, got - (PUI.newAch ?? got));
  order.forEach((a, i) => {
    const t = mkEl('div', 'ach' + (PLAYER.ach[a.id] ? ' got' : ''));
    if (i < nNew) t.appendChild(mkEl('span', 'bpnew', TR('NEU')));
    const ic = mkEl('span', 'ai');
    ic.innerHTML = si(a.ic);
    t.append(ic, mkEl('b', '', a.n), mkEl('small', '', a.d));
    t.appendChild(gemEl('+' + a.g, 'ag'));
    grid.appendChild(t);
  });
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
    SHOW.dragOff = false; // the preview: drag turns the model
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
// ← → on the Ruhmespfad (PC)
addEventListener('keydown', e => {
  if ($('#profScr').hidden || PUI.tab !== 'path' || PUI.sheet || !PUI.bpGo) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    PUI.bpGo(e.key === 'ArrowRight' ? 1 : -1);
  }
});
