/* 52-hud.js - HUD: updateHud() writes the numbers (only when they change), spawn buttons, the chips column (phase, event, perks) and the kill feed position,
   tips for new players (HINTS, remembered in store 'wvr-hints'), toast(). */
// Long translations: an element marked data-fit (a row of buttons, a tab bar) gets class fit1, then fit2 while it is too wide - the CSS
// decides what that means (smaller text, less padding, a label hidden behind its icon). A row whose CSS sets --fit-lines may use that
// many lines; anything else must not cut off the text of its children (or of the elements data-fit="selector" names). Runs when such a
// row is shown and on resize.
function fitBad(el) {
  const lines = parseInt(getComputedStyle(el).getPropertyValue('--fit-lines')) || 0;
  const sel = el.dataset.fit;
  const kids = [...(sel ? el.querySelectorAll(sel) : el.children.length ? el.children : [el])].filter(c => c.getClientRects().length);
  if (lines) {
    // count the lines: a child starting below everything of the line before opens a new one (small centred things stay in theirs)
    let n = 0,
      bottom = -Infinity;
    for (const r of kids.map(c => c.getBoundingClientRect()).sort((a, b) => a.top - b.top))
      if (r.top >= bottom - 2) {
        n++;
        bottom = r.bottom;
      } else bottom = Math.max(bottom, r.bottom);
    return n > lines;
  }
  return kids.some(c => {
    if (c.scrollWidth > c.clientWidth) return true;
    if (c.children.length) return false;
    // (scrollWidth is rounded: measure the text itself, a part of a pixel already shows "…" or gets cut)
    const r = document.createRange(),
      cs = getComputedStyle(c);
    r.selectNodeContents(c);
    return r.getBoundingClientRect().width > c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5;
  });
}
function fitText() {
  for (const el of $$('[data-fit]')) {
    el.classList.remove('fit1', 'fit2');
    if (!el.getClientRects().length) continue; // hidden: done again when it is shown
    for (const c of ['fit1', 'fit2']) {
      if (!fitBad(el)) break;
      el.classList.add(c);
    }
  }
}
let fitTimer = 0;
addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(fitText, 150);
});
let toastTimer = 0;
function toast(msg, ms = 2500) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
// Tips for new players, one at a time. Touch and mouse get their own words (text() is read when shown, so rebound keys are named right).
// A tip that was done once stays done across matches (store 'wvr-hints'); the tutorial teaches everything again.
const HINTS = [
  {
    id: 'spawn',
    text: () =>
      COARSE
        ? TR('Tippe unten auf einen Krieger, um ihn auszubilden. Lange drücken = AUTO: Er wird laufend nachgebildet.')
        : TR('Klicke unten auf einen Krieger, um ihn auszubilden. AUTO bildet ihn laufend nach.'),
  },
  {
    id: 'select',
    text: () =>
      COARSE
        ? TR('Tippe auf „Alle“ oder auf einen deiner Krieger, um ihn auszuwählen.')
        : TR('Klicke auf „Alle“ oder auf einen deiner Krieger, um ihn auszuwählen.'),
  },
  {
    id: 'order',
    text: () =>
      COARSE
        ? TR('Tippe jetzt auf den Boden, zum Beispiel auf eine Fahne. Die Auswahl zieht dorthin.')
        : TR('{0} auf den Boden, zum Beispiel auf eine Fahne: Die Auswahl zieht dorthin.', kl('order')),
  },
  {
    id: 'poss',
    text: () =>
      COARSE
        ? TR('Wähle genau einen Krieger und tippe „Übernehmen“, um selbst zu kämpfen.')
        : TR('Wähle genau einen Krieger und klicke „Übernehmen“, um selbst zu kämpfen.'),
  },
  { id: 'mode', text: () => TR('„Laufen“ ignoriert Gegner, praktisch für einen Rückzug. „Angreifen“ kämpft unterwegs.') },
  {
    id: 'lasso',
    text: () =>
      COARSE
        ? TR('Profi-Trick: Finger lange halten und eine Schlinge um Krieger ziehen.')
        : TR('Profi-Trick: Mit gedrückter linker Maustaste eine Schlinge um Krieger ziehen.'),
  },
  { id: 'home', text: () => TR('Heimvorteil: Im gestrichelten Kreis um deine Basis nehmen deine Krieger 25 % weniger Schaden.') },
];
const hintState = { done: new Set(), shownAt: 0, cur: null };
const hintsSaved = () => (store.get('wvr-hints') || '').split(',').filter(Boolean);
function hintDone(id) {
  if (!hintState.done.has(id)) {
    hintState.done.add(id);
    store.set('wvr-hints', [...hintState.done].join(','));
  }
  if (hintState.cur === id) {
    hintState.cur = null;
    $('#toast').classList.remove('show');
  }
}
function hintTick() {
  if (V.tut || !V.playing || V.poss || $('#toast').classList.contains('show')) return;
  const h = HINTS.find(h2 => !hintState.done.has(h2.id));
  if (!h) return;
  if (h.id === 'select' && !ownUnits().length) return;
  if (h.id === 'order' && !V.selected.size) return;
  if (['lasso', 'mode', 'poss', 'home'].includes(h.id) && ownUnits().length < 3) return;
  if (now() - hintState.shownAt < 6000 && hintState.cur === h.id) return;
  hintState.cur = h.id;
  hintState.shownAt = now();
  toast(h.text(), 5000);
  if (['lasso', 'mode', 'poss', 'home'].includes(h.id)) {
    hintDone(h.id);
    hintState.cur = h.id; // still showing
  }
}
// The kill feed starts right below the column of chips (phase, event, perks), however many of them show; on landscape phones it hangs
// under the buttons at the top right instead. Measured only when that column or the screen changes.
const KFT = { key: '' };
function killFeedTop() {
  const hud = $('#hud'),
    land = innerWidth > innerHeight && innerHeight <= 600,
    chips = $('.hud-chips'),
    r = land ? $('.hud-tr').getBoundingClientRect() : chips.getBoundingClientRect(),
    // the measured edge is part of the key: the perk pills wrap into a second row a moment after they appear
    key = [chips.childElementCount, $('#perkBar').childElementCount, Math.round(r.bottom), Math.round(r.top), innerWidth, innerHeight].join(
      '|'
    );
  if (hud.hidden || key === KFT.key) return;
  KFT.key = key;
  const kf = $('#killFeed');
  let top;
  if (land) top = r.bottom + 6;
  else top = r.height > 2 ? r.bottom + 6 : r.top;
  if (top > 20) kf.style.setProperty('--kfTop', Math.round(top) + 'px');
}
function setupHud() {
  const fac = V.facs[V.myTeam],
    F = FAC[fac],
    E = FAC[V.facs[1 - V.myTeam]];
  $('#resIco').innerHTML = ICON[F.icon];
  $('#flagdots').innerHTML = FLAGS.map(() => '<i></i>').join('');
  $$('.spawn').forEach((b, i) => {
    const k = F.kinds[i],
      K = KINDS[k];
    b.dataset.k = k;
    b.querySelector('img').src = unitIcon(k);
    b.querySelector('.nm').textContent = K.name.replace('schützin', '­schützin');
    b.querySelector('.cost').innerHTML = ICON[F.icon] + K.cost;
    b.querySelector('.beats').textContent = K.role === 'siege' ? TR('Fläche · bricht Eis') : TR('stark gg. {0}', ROLE_NAME[BEATS[K.role]]);
    b.title = K.name + ': ' + (K.trait || (K.role === 'siege' ? TR('langsam, mächtiger Flächenschaden, zerstört Basen und Eis') : ''));
    b.querySelector('.main').setAttribute('aria-label', TR('{0} ausbilden, {1} {2}', K.name, K.cost, F.res));
    b.querySelector('.auto').setAttribute('aria-label', TR('{0} automatisch ausbilden', K.name));
  });
  setOrderMode('attack');
  setRallyMode(false);
}
function setOrderMode(m) {
  if (m === 'move' && V.playing && tutBlock('mode')) return;
  V.orderMode = m;
  $('#modeAtk').setAttribute('aria-pressed', String(m === 'attack'));
  $('#modeMv').setAttribute('aria-pressed', String(m === 'move'));
}
$('#modeAtk').addEventListener('click', () => setOrderMode('attack'));
$('#modeMv').addEventListener('click', () => {
  setOrderMode('move');
  hintDone('mode');
});
$('#possBtn').addEventListener('click', () => {
  hintDone('poss');
  enterEgo();
});
let hudT = 0;
// HUD writes only touch the DOM when a value really changed: no needless style/layout work on weak devices
const txt = (el, v) => {
    v = String(v);
    if (el._t !== v) {
      el._t = v;
      el.textContent = v;
    }
  },
  hid = (el, h) => {
    h = !!h;
    if (el.hidden !== h) el.hidden = h;
  },
  attr = (el, k, v) => {
    if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  },
  sty = (el, k, v) => {
    const c = '_s' + k;
    if (el[c] !== v) {
      el[c] = v;
      el.style[k] = v;
    }
  };
function updateHud() {
  const s = V.latest;
  if (!s) return;
  const me = V.myTeam,
    en = 1 - me;
  txt($('#gold'), s.g[me]);
  const mine = s.f.filter(f => f[0] === me).length,
    theirs = s.f.filter(f => f[0] === en).length;
  const inc = $('#inc');
  txt(inc, '+' + numL(s.in ? s.in[me] : CFG.baseInc) + '/s');
  inc.classList.toggle('bonus', mine > theirs);
  {
    const chip = $('#phaseChip'),
      ph = s.ph,
      fm = v => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
    let txt = '',
      cls = '';
    if (ph && !V.tut) {
      if (ph[0] === 0 && ph[1] >= 0 && ph[1] <= 60) txt = TR('Sturm in {0}', fm(ph[1]));
      else if (ph[0] === 1) {
        cls = 'storm';
        txt = ph[1] >= 0 && ph[1] <= 60 ? TR('Endkampf in {0}', fm(ph[1])) : TR('STURM · Basisschaden ×1,5');
      } else if (ph[0] === 2) {
        cls = 'final';
        txt = s.t >= CFG.crumbleT ? TR('ENDKAMPF · Basen bröckeln') : TR('ENDKAMPF · Basisschaden ×2,2');
      }
    }
    if (chip.textContent !== txt) chip.textContent = txt;
    hid(chip, !txt);
    if (chip.className !== 'panel ' + cls) chip.className = 'panel ' + cls;
    const ec = $('#evChip'),
      ev = s.ev;
    let et = '',
      ecl = '';
    if (ev && !V.tut) {
      const nm = { 1: TR('NEBELWAND'), 2: TR('GOLDWAGEN'), 3: TR('KLEINE ARMEE, GROSSER SOLD'), 4: TR('FAHNENWANDERUNG') }[ev[0]];
      ecl = ev[0] === 1 ? 'fog' : ev[0] === 4 ? 'flags' : 'gold';
      et =
        nm +
        (ev[0] === 2 && s.wg
          ? s.wg[3]
            ? ' · ' + (s.wg[3] - 1 === me ? TR('du kassierst') : TR('Gegner kassiert'))
            : ' · ' + TR('unbewacht')
          : ev[0] !== 4
            ? ' · ' + fm(ev[1])
            : '');
    }
    if (ec.textContent !== et) ec.textContent = et;
    hid(ec, !et);
    if (ec.className !== 'panel ' + ecl) ec.className = 'panel ' + ecl;
    killFeedTop();
  }
  const pop = s.u.filter(e => teamOfKind(e[1], s.fa) === me && !(e[7] & 32768)).length + s.q[me].length;
  txt($('#pop'), pop + '/' + CFG.pop);
  $$('#flagdots i').forEach((d, i) => {
    const o = s.f[i] ? s.f[i][0] : -1;
    sty(d, 'background', o < 0 ? '#d6d9df' : FAC[V.facs[o]].css);
  });
  baseBars(s);
  const au = s.au ? s.au[me] : '';
  $$('.spawn').forEach(b => {
    const k = +b.dataset.k,
      K = KINDS[k],
      inQ = [...s.q[me]].filter(c => +c === k).length,
      q = b.querySelector('.q');
    hid(q, !inQ);
    txt(q, inQ);
    b.classList.toggle('poor', s.g[me] < K.cost || pop >= CFG.pop || s.q[me].length >= CFG.queueMax);
    sty(b.querySelector('.prog'), 'width', (s.q[me].length && +s.q[me][0] === k ? s.qp[me] : 0) + '%');
    attr(b.querySelector('.auto'), 'aria-pressed', String(au.includes(String(k))));
    b.classList.toggle('autoOn', au.includes(String(k)));
  });
  for (const id of V.selected) if (!V.units.has(id)) V.selected.delete(id);
  {
    const own = ownUnits(),
      sz = V.selected.size;
    const same = list => list.length > 0 && list.length === sz && list.every(u => V.selected.has(u.id));
    $$('.chip[data-sel]').forEach(b => {
      const w = b.dataset.sel;
      const on = w === 'none' ? false : w === 'all' ? same(own) : same(own.filter(u => KINDS[u.k].role === w));
      attr(b, 'aria-pressed', String(on));
    });
  }
  txt($('#selCount'), V.selected.size);
  if ($('#selCount').hidden === !!V.selected.size) {
    hid($('#selCount'), !V.selected.size);
    fitText(); // (the count takes room in the row of order chips)
  }
  {
    const n = V.selected.size,
      one = n === 1 && V.units.get([...V.selected][0]);
    const h = V.tut
      ? ''
      : V.rallyMode
        ? COARSE
          ? TR('Tippe auf den Boden: Dort sammeln sich neue Krieger')
          : TR('Klicke auf den Boden: Dort sammeln sich neue Krieger')
        : n === 0
          ? COARSE
            ? TR('<b>Tippe</b> auf einen Krieger oder „Alle“ zum Auswählen · <b style="color:#ff6b62">rot umrandet</b> = Gegner')
            : TR('<b>Klicke</b> auf einen Krieger oder „Alle“ zum Auswählen · <b style="color:#ff6b62">rot umrandet</b> = Gegner')
          : one
            ? COARSE
              ? TR('<b>Tippe</b> auf Ziel oder Gegner · <b>Übernehmen</b>: selbst steuern')
              : TR('<b>Rechtsklick</b> auf Ziel oder Gegner · <b>Übernehmen</b>: selbst steuern')
            : COARSE
              ? TR('<b>{0} gewählt</b> · Tippe auf Boden, Gegner oder Basis · „Abwählen“ für Einzelauswahl', n)
              : TR('<b>{0} gewählt</b> · Rechtsklick auf Boden, Gegner oder Basis', n);
    const el = $('#ctxHint');
    if (el._h !== h) {
      el._h = h;
      el.innerHTML = h;
    }
  }
  hid(
    $('#possBtn'),
    !(
      V.selected.size === 1 &&
      V.playing &&
      !V.ending &&
      (() => {
        const u = V.units.get([...V.selected][0]);
        return !!u;
      })()
    )
  );
  const cd = $('#countdown');
  let cdTxt = null;
  if (s.cd > 0 && s.o < 0) cdTxt = String(Math.ceil(s.cd));
  else if (s.t < 0.8 && s.o < 0) cdTxt = TR('LOS!');
  if (cdTxt !== V.cdLast) {
    V.cdLast = cdTxt;
    if (cdTxt) SFX.play(cdTxt === TR('LOS!') ? 'go' : 'count');
  }
  hid(cd, !cdTxt);
  if (cdTxt) txt(cd, cdTxt);
  drawMini();
  perkUi();
  if (s.o >= 0 && V.playing && !V.ending) startBaseFall(s);
}
function spawnSlot(i) {
  if (tutBlock('spawn' + i)) return;
  const b = $$('.spawn')[i];
  if (!b) return;
  const k = +b.dataset.k,
    s = V.latest,
    me = V.myTeam;
  if (s) {
    const pop = s.u.filter(e => teamOfKind(e[1], s.fa) === me && !(e[7] & 32768)).length + s.q[me].length;
    if (s.g[me] < KINDS[k].cost) {
      SFX.play('error');
      toast(TR('Zu wenig {0}. Fahnen bringen mehr!', FAC[V.facs[me]].res), 1600);
      return;
    }
    if (pop >= CFG.pop) {
      SFX.play('error');
      toast(TR('Deine Armee ist voll ({0}).', CFG.pop), 1600);
      return;
    }
    if (s.q[me].length >= CFG.queueMax) {
      SFX.play('error');
      toast(TR('Warteschlange ist voll.'), 1400);
      return;
    }
    if (
      KINDS[k].role === 'siege' &&
      s.u.filter(e => teamOfKind(e[1], s.fa) === me && KINDS[e[1]].role === 'siege').length +
        [...s.q[me]].filter(q => KINDS[+q].role === 'siege').length >=
        CFG.siegeMax
    ) {
      SFX.play('error');
      toast(TR('Höchstens {0} Katapulte gleichzeitig.', CFG.siegeMax), 1600);
      return;
    }
  }
  sendCmd({ t: 'spawn', k });
  hintDone('spawn');
  if (COARSE && !(V.kindSeen || (V.kindSeen = {}))[k]) {
    V.kindSeen[k] = 1;
    toast(TR('{0} · {1} · lange drücken = AUTO', KINDS[k].name, b.querySelector('.beats').textContent), 2200);
  }
}
$$('.spawn').forEach((b, i) => {
  const main = b.querySelector('.main');
  main.addEventListener('click', () => {
    if (b._lp && now() - b._lp < 700) return;
    spawnSlot(i);
  });
  if (COARSE) {
    // long press on the round button toggles AUTO
    let tm = 0;
    const clear = () => {
      clearTimeout(tm);
      tm = 0;
      b.classList.remove('pressing');
    };
    main.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      clear();
      b.classList.add('pressing');
      tm = setTimeout(() => {
        tm = 0;
        b.classList.remove('pressing');
        b._lp = now();
        b.querySelector('.auto').click();
        try {
          navigator.vibrate && navigator.vibrate(18);
        } catch (_) {}
      }, 480);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => main.addEventListener(ev, clear));
    main.addEventListener('contextmenu', e => e.preventDefault());
  }
  b.querySelector('.auto').addEventListener('click', () => {
    if (tutBlock('auto')) return;
    const on = b.querySelector('.auto').getAttribute('aria-pressed') !== 'true';
    b.querySelector('.auto').setAttribute('aria-pressed', String(on));
    sendCmd({ t: 'auto', k: +b.dataset.k, on });
    hintDone('spawn');
    const nOn = $$('.spawn .auto').filter(a => a.getAttribute('aria-pressed') === 'true').length;
    toast(
      on
        ? nOn > 1
          ? TR('AUTO: Die markierten Einheiten werden abwechselnd ausgebildet.')
          : TR('{0} wird automatisch nachgebildet.', KINDS[+b.dataset.k].name)
        : TR('Automatik aus.'),
      1800
    );
  });
});
function selectGroup(which) {
  if (which === 'none') {
    V.selected.clear();
    return;
  }
  V.selected = new Set(
    ownUnits()
      .filter(u => which === 'all' || KINDS[u.k].role === which)
      .map(u => u.id)
  );
  if (TUT.flags) TUT.flags.sel = which;
  if (V.selected.size) {
    hintDone('select');
    SFX.play('select');
  }
}
$$('.chip').forEach(b => b.addEventListener('click', () => selectGroup(b.dataset.sel)));
