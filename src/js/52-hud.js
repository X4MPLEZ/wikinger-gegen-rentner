/* 52-hud.js - HUD: updateHud() writes the numbers (only when they change), spawn buttons, the chips column (phase, event, perks) and the kill feed position,
   tips for new players (HINTS, remembered in store 'wvr-hints'), toast(). */
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
const TAP = COARSE ? 'Tippe' : 'Klicke';
const HINTS = [
  {
    id: 'spawn',
    text: () =>
      COARSE
        ? 'Tippe unten auf einen Krieger, um ihn auszubilden. Lange drücken = AUTO: Er wird laufend nachgebildet.'
        : 'Klicke unten auf einen Krieger, um ihn auszubilden. AUTO bildet ihn laufend nach.',
  },
  { id: 'select', text: () => TAP + ' auf „Alle“ oder auf einen deiner Krieger, um ihn auszuwählen.' },
  {
    id: 'order',
    text: () =>
      COARSE
        ? 'Tippe jetzt auf den Boden, zum Beispiel auf eine Fahne. Die Auswahl zieht dorthin.'
        : kl('order') + ' auf den Boden, zum Beispiel auf eine Fahne: Die Auswahl zieht dorthin.',
  },
  { id: 'poss', text: () => 'Wähle genau einen Krieger und ' + (COARSE ? 'tippe' : 'klicke') + ' „Übernehmen“, um selbst zu kämpfen.' },
  { id: 'mode', text: () => '„Laufen“ ignoriert Gegner, praktisch für einen Rückzug. „Angreifen“ kämpft unterwegs.' },
  {
    id: 'lasso',
    text: () =>
      COARSE
        ? 'Profi-Trick: Finger lange halten und eine Schlinge um Krieger ziehen.'
        : 'Profi-Trick: Mit gedrückter linker Maustaste eine Schlinge um Krieger ziehen.',
  },
  { id: 'home', text: () => 'Heimvorteil: Im gestrichelten Kreis um deine Basis nehmen deine Krieger 25 % weniger Schaden.' },
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
    key = [
      chips.childElementCount,
      $('#phaseChip').textContent,
      $('#evChip').textContent,
      $('#perkBar').childElementCount,
      innerWidth,
      innerHeight,
    ].join('|');
  if (hud.hidden || key === KFT.key) return;
  KFT.key = key;
  const kf = $('#killFeed');
  let top;
  if (land) top = $('.hud-tr').getBoundingClientRect().bottom + 6;
  else {
    const r = chips.getBoundingClientRect();
    top = r.height > 2 ? r.bottom + 6 : r.top;
  }
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
    b.querySelector('.beats').textContent = K.role === 'siege' ? 'Fläche · bricht Eis' : 'stark gg. ' + ROLE_NAME[BEATS[K.role]];
    b.title = K.name + ': ' + (K.trait || (K.role === 'siege' ? 'langsam, mächtiger Flächenschaden, zerstört Basen und Eis' : ''));
    b.querySelector('.main').setAttribute('aria-label', K.name + ' ausbilden, ' + K.cost + ' ' + F.res);
    b.querySelector('.auto').setAttribute('aria-label', K.name + ' automatisch ausbilden');
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
  txt(inc, '+' + String(s.in ? s.in[me] : CFG.baseInc).replace('.', ',') + '/s');
  inc.classList.toggle('bonus', mine > theirs);
  {
    const chip = $('#phaseChip'),
      ph = s.ph,
      fm = v => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
    let txt = '',
      cls = '';
    if (ph && !V.tut) {
      if (ph[0] === 0 && ph[1] >= 0 && ph[1] <= 60) txt = 'Sturm in ' + fm(ph[1]);
      else if (ph[0] === 1) {
        cls = 'storm';
        txt = ph[1] >= 0 && ph[1] <= 60 ? 'Endkampf in ' + fm(ph[1]) : 'STURM · Basisschaden ×1,5';
      } else if (ph[0] === 2) {
        cls = 'final';
        txt = s.t >= CFG.crumbleT ? 'ENDKAMPF · Basen bröckeln' : 'ENDKAMPF · Basisschaden ×2,2';
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
      const nm = { 1: 'NEBELWAND', 2: 'GOLDWAGEN', 3: 'KLEINE ARMEE, GROSSER SOLD', 4: 'FAHNENWANDERUNG' }[ev[0]];
      ecl = ev[0] === 1 ? 'fog' : ev[0] === 4 ? 'flags' : 'gold';
      et =
        nm +
        (ev[0] === 2 && s.wg
          ? s.wg[3]
            ? ' · ' + (s.wg[3] - 1 === me ? 'du kassierst' : 'Gegner kassiert')
            : ' · unbewacht'
          : ev[0] !== 4
            ? ' · ' + fm(ev[1])
            : '');
    }
    if (ec.textContent !== et) ec.textContent = et;
    hid(ec, !et);
    if (ec.className !== 'panel ' + ecl) ec.className = 'panel ' + ecl;
    killFeedTop();
  }
  const pop = s.u.filter(e => teamOfKind(e[1], s.fa) === me).length + s.q[me].length;
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
  hid($('#selCount'), !V.selected.size);
  {
    const n = V.selected.size,
      one = n === 1 && V.units.get([...V.selected][0]),
      t = COARSE ? 'Tippe' : 'Klicke',
      ord = COARSE ? 'Tippe' : 'Rechtsklick';
    const h = V.tut
      ? ''
      : V.rallyMode
        ? t + ' auf den Boden: Dort sammeln sich neue Krieger'
        : n === 0
          ? '<b>' + t + '</b> auf einen Krieger oder „Alle“ zum Auswählen · <b style="color:#ff6b62">rot umrandet</b> = Gegner'
          : one
            ? '<b>' + ord + '</b> auf Ziel oder Gegner · <b>Übernehmen</b>: selbst steuern'
            : '<b>' + n + ' gewählt</b> · ' + ord + ' auf Boden, Gegner oder Basis' + (COARSE ? ' · „Abwählen“ für Einzelauswahl' : '');
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
  else if (s.t < 0.8 && s.o < 0) cdTxt = 'LOS!';
  if (cdTxt !== V.cdLast) {
    V.cdLast = cdTxt;
    if (cdTxt) SFX.play(cdTxt === 'LOS!' ? 'go' : 'count');
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
    const pop = s.u.filter(e => teamOfKind(e[1], s.fa) === me).length + s.q[me].length;
    if (s.g[me] < KINDS[k].cost) {
      SFX.play('error');
      toast('Zu wenig ' + FAC[V.facs[me]].res + '. Fahnen bringen mehr!', 1600);
      return;
    }
    if (pop >= CFG.pop) {
      SFX.play('error');
      toast('Deine Armee ist voll (' + CFG.pop + ').', 1600);
      return;
    }
    if (s.q[me].length >= CFG.queueMax) {
      SFX.play('error');
      toast('Warteschlange ist voll.', 1400);
      return;
    }
    if (
      KINDS[k].role === 'siege' &&
      s.u.filter(e => teamOfKind(e[1], s.fa) === me && KINDS[e[1]].role === 'siege').length +
        [...s.q[me]].filter(q => KINDS[+q].role === 'siege').length >=
        CFG.siegeMax
    ) {
      SFX.play('error');
      toast('Höchstens ' + CFG.siegeMax + ' Katapulte gleichzeitig.', 1600);
      return;
    }
  }
  sendCmd({ t: 'spawn', k });
  hintDone('spawn');
  if (COARSE && !(V.kindSeen || (V.kindSeen = {}))[k]) {
    V.kindSeen[k] = 1;
    toast(KINDS[k].name + ' · ' + b.querySelector('.beats').textContent + ' · lange drücken = AUTO', 2200);
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
          ? 'AUTO: Die markierten Einheiten werden abwechselnd ausgebildet.'
          : KINDS[+b.dataset.k].name + ' wird automatisch nachgebildet.'
        : 'Automatik aus.',
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
