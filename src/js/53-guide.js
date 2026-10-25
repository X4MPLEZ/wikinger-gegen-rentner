/* 53-guide.js - FIRST STEPS: a small checklist in the corner of the first matches (against the computer and online alike) that tells a
   new player what to do next – train, AUTO, select, send to a flag, take over, then the goal – and ticks the steps off as he does them.
   The button of the current step pulses, a bouncing arrow marks the flag to take. Purely client side (no simulation, no network).
   Once every step was done once (or the card was closed) it stays away: store 'wvr-guide'. The old one-line hints (HINTS, 52-hud)
   wait while the card is up. The first "Spielen" also offers the tutorial once (guideOffer, store 'wvr-first'). */
const GUIDE = { on: false, i: 0, flags: {}, el: null, arrow: null, flagI: -1, doneT: 0, hold: 0 };
const GUIDE_STEPS = [
  {
    id: 'spawn',
    t: () =>
      COARSE
        ? TR('Tippe unten auf einen Krieger: Er wird ausgebildet.')
        : TR('Klicke unten auf einen Krieger (oder Taste 1): Er wird ausgebildet.'),
    pulse: () => $$('.spawn')[0],
    done: () => !!GUIDE.flags.spawn,
  },
  {
    id: 'auto',
    t: () =>
      COARSE
        ? TR('Halte einen Krieger lange gedrückt: AUTO bildet ihn laufend nach, solange Geld da ist.')
        : TR('Klicke AUTO an einem Krieger: Er wird laufend nachgebildet, solange Geld da ist.'),
    pulse: () => $$('.spawn .auto')[0],
    done: s => s.au[V.myTeam].length > 0,
  },
  {
    id: 'select',
    t: () =>
      COARSE
        ? TR('Tippe auf „Alle“: Das wählt deine ganze Armee aus.')
        : TR('Klicke „Alle“ (Taste {0}): Das wählt deine ganze Armee aus.', kl('selAll')),
    pulse: () => $('[data-sel="all"]'),
    done: () => V.selected.size > 0,
    wait: s => guideOwn(s) > 0,
  },
  {
    id: 'order',
    t: () =>
      COARSE
        ? TR('Tippe auf die Fahne mit dem Pfeil: Fahnen bringen Geld. Die Auswahl läuft hin und erobert sie.')
        : TR('{0} auf die Fahne mit dem Pfeil: Fahnen bringen Geld. Die Auswahl läuft hin und erobert sie.', kl('order')),
    arrow: true,
    done: () => !!GUIDE.flags.order,
    wait: () => V.selected.size > 0,
  },
  {
    id: 'poss',
    t: () =>
      COARSE
        ? TR('Tippe einen einzelnen Krieger an, dann „Übernehmen“: Du kämpfst selbst, mit Spezialfähigkeit.')
        : TR('Klicke einen einzelnen Krieger an, dann „Übernehmen“ ({0}): Du kämpfst selbst, mit Spezialfähigkeit.', kl('take')),
    pulse: () => (V.selected.size === 1 ? $('#possBtn') : null),
    done: () => !!GUIDE.flags.ego,
    wait: s => guideOwn(s) > 0,
  },
  {
    id: 'goal',
    t: () =>
      TR(
        'Das Ziel: Halte mehr Fahnen als der Gegner und reiß seine Basis ein. Nahkampf schlägt Reiter, Reiter schlagen Fernkampf, Fernkampf schlägt Nahkampf.'
      ),
    done: () => GUIDE.hold > 0 && now() - GUIDE.hold > 9000,
    final: true,
  },
];
const guideOwn = s => {
  let n = 0;
  for (const e of s.u) if (teamOfKind(e[1], s.fa) === V.myTeam && !(e[7] & 32768)) n++;
  return n;
};
function guideStart() {
  guideStop();
  if (V.tut || store.get('wvr-guide') === '1') return;
  GUIDE.on = true;
  GUIDE.i = 0;
  GUIDE.flags = {};
  GUIDE.hold = 0;
  GUIDE.flagI = -1;
  if (!GUIDE.el) {
    const d = document.createElement('div');
    d.id = 'guide';
    d.className = 'panel';
    d.innerHTML =
      '<div class="gh"><b></b><button type="button" class="gx" aria-label="' + TR('Hilfe schließen') + '">✕</button></div><ol></ol>';
    d.querySelector('.gx').title = TR('Hilfe schließen');
    d.querySelector('.gx').addEventListener('click', () => {
      store.set('wvr-guide', '1');
      guideStop();
      toast(TR('Hilfe aus. Das Tutorial findest du jederzeit im Menü.'), 2600);
    });
    $('#hud').appendChild(d);
    GUIDE.el = d;
  }
  GUIDE.el.querySelector('b').textContent = TR('Erste Schritte');
  GUIDE.el.hidden = false;
  guideRender();
}
function guideStop() {
  GUIDE.on = false;
  guidePulse(null);
  guideArrow(false);
  if (GUIDE.el) GUIDE.el.hidden = true;
}
function guideRender() {
  // a row of step marks (done / current / to do) and the current step's text
  const st = GUIDE_STEPS[GUIDE.i];
  GUIDE.el.querySelector('ol').innerHTML =
    '<li class="marks">' +
    GUIDE_STEPS.map(
      (_, i) => `<span class="gm ${i < GUIDE.i ? 'ok' : i === GUIDE.i ? 'now' : 'todo'}">${i < GUIDE.i ? '✓' : i + 1}</span>`
    ).join('') +
    `</li><li class="now"><span class="gt">${st ? st.t() : ''}</span></li>`;
}
let guidePulsed = null;
function guidePulse(el) {
  if (guidePulsed === el) return;
  if (guidePulsed) guidePulsed.classList.remove('guidePulse');
  guidePulsed = el;
  if (el) el.classList.add('guidePulse');
}
// a bouncing arrow over the flag worth taking (the nearest one not held by me)
function guideArrow(on) {
  if (!on) {
    if (GUIDE.arrow) {
      scene.remove(GUIDE.arrow);
      GUIDE.arrow = null;
    }
    return;
  }
  const s = V.latest;
  if (!s || !FLAGS.length) return;
  const B = BASES[V.myTeam];
  let best = -1,
    bd = 1e9;
  FLAGS.forEach((F, i) => {
    if (s.f[i] && s.f[i][0] === V.myTeam) return;
    const d = Math.hypot(F.x - B.x, F.z - B.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) {
    guideArrow(false);
    return;
  }
  if (!GUIDE.arrow || GUIDE.flagI !== best) {
    guideArrow(false);
    const g = new THREE.Group(),
      mat = new THREE.MeshBasicMaterial({ color: lin(0xf0bf4c), fog: false }),
      ink = new THREE.MeshBasicMaterial({ color: lin(0x1b1410), fog: false, side: THREE.BackSide });
    // a fat gold arrow with an ink outline (the same shape a little bigger, inside out)
    for (const [m, k] of [
      [ink, 1.18],
      [mat, 1],
    ]) {
      mesh(new THREE.ConeGeometry(2.4 * k, 3.6 * k, 4).rotateX(Math.PI), m, 0, 0, 0, g);
      mesh(new THREE.BoxGeometry(1.7 * k, 3.4 * k, 1.7 * k), m, 0, 3.4, 0, g);
    }
    g.position.set(FLAGS[best].x, groundY(FLAGS[best].x, FLAGS[best].z) + 7, FLAGS[best].z);
    scene.add(g);
    GUIDE.arrow = g;
    GUIDE.flagI = best;
  }
}
function guideTick() {
  if (!GUIDE.on || !V.playing) return;
  const s = V.latest;
  if (!s) return;
  const st = GUIDE_STEPS[GUIDE.i];
  if (!st) return;
  if (GUIDE.arrow) {
    const t = now() / 1000;
    GUIDE.arrow.position.y = groundY(FLAGS[GUIDE.flagI].x, FLAGS[GUIDE.flagI].z) + 7 + Math.sin(t * 4) * 0.8;
    GUIDE.arrow.rotation.y = t * 1.5;
  }
  if (st.final && !GUIDE.hold) GUIDE.hold = now();
  if (st.done(s)) {
    GUIDE.i++;
    guidePulse(null);
    guideArrow(false);
    SFX.play('ding', { vol: 0.5 });
    if (GUIDE.i >= GUIDE_STEPS.length) {
      store.set('wvr-guide', '1');
      guideStop();
      return;
    }
    guideRender();
    return;
  }
  if (V.poss) {
    guidePulse(null);
    guideArrow(false);
    return;
  }
  if (st.wait && !st.wait(s)) {
    guidePulse(null);
    return;
  }
  if (st.pulse) guidePulse(st.pulse());
  if (st.arrow) guideArrow(true);
}
// the first "Spielen": offer the tutorial once (two minutes), then never again
function guideOffer(go) {
  if (store.get('wvr-first') === '1' || store.get('wvr-tut') === '1') return false;
  store.set('wvr-first', '1');
  const d = document.createElement('div');
  d.id = 'firstScr';
  d.innerHTML = `<div class="card fcard"><h2>${TR('Zum ersten Mal hier?')}</h2><p>${TR(
    'Das Tutorial zeigt dir in zwei Minuten das Wichtigste: ausbilden, Fahnen erobern, selbst kämpfen.'
  )}</p><div class="frow"><button class="btn gold" id="firstTut">${TR('Tutorial (2 Min)')}</button><button class="btn" id="firstGo">${TR(
    'Direkt losspielen'
  )}</button></div><p class="note">${TR('Im Spiel hilft dir oben links eine kleine Liste mit den ersten Schritten.')}</p></div>`;
  document.body.appendChild(d);
  d.querySelector('#firstTut').addEventListener('click', () => {
    d.remove();
    startTutorial(false);
  });
  d.querySelector('#firstGo').addEventListener('click', () => {
    d.remove();
    go();
  });
  return true;
}
