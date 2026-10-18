/* 63-tutorial.js - TUTORIAL (normal and Profi): scripted steps tutSteps() with their own map seed (TUT_SEED), dummies and checks; tutBlock() locks UI. */
const TUT_SEED = 4242;
const tutArrow = (() => {
  const g = new THREE.Group();
  mesh(flat(new THREE.ConeGeometry(0.9, 1.8, 4)).rotateX(Math.PI), lam(0xf0bf4c), 0, 0, 0, g);
  g.visible = false;
  scene.add(g);
  return g;
})();
function tutUnit(team, k, x, z) {
  const p = nearestWalkable(MAP, x, z);
  const u = {
    id: G.nextId++,
    k,
    team,
    x: p.x,
    z: p.z,
    y: groundY(p.x, p.z),
    hp: KINDS[k].hp,
    cd: 0.4,
    tgt: -1,
    at: 0,
    atk: 0,
    sp: 0,
    run: 0,
    re: 0,
    ord: { x: p.x, z: p.z, mv: false },
    path: null,
    losT: 0,
    los: true,
    repath: 0,
    poss: false,
    rage: 0,
    spcd: 0,
    yaw: 0,
  };
  G.units.push(u);
  // Every exercise starts fresh: the team-wide special/grenade cooldowns (kept when you switch warriors, see egoCooldownsKeep)
  // must not carry over from the last exercise into the next warrior.
  if (team === 0) G.teams[0].spAt = G.teams[0].gAt = 0;
  return u;
}
function tutEnemies(fi) {
  const F = FLAGS[fi],
    k = FAC[V.facs[1]].kinds[1];
  TUT.enemyIds = [-1, 0, 1].map(i => tutUnit(1, k, F.x + i * 2, F.z - 2).id);
}
function tutDummy() {
  const P = V.poss;
  if (!P) return;
  const k = FAC[V.facs[1]].kinds[0],
    u = tutUnit(1, k, P.x + Math.sin(P.yaw) * 5, P.z + Math.cos(P.yaw) * 5);
  u.poss = true;
  u.tutDummy = true;
  u.hp = KINDS[k].hp * 0.5;
  u.yaw = Math.atan2(P.x - u.x, P.z - u.z);
  G.teams[1].pos = u.id;
  G.teams[1].posIn = null;
  TUT.dummy = u.id;
}
function tutFinale() {
  G.teams[1].hp = 450;
  G.towerOff[1] = false;
  G.towerMul[1] = 0.35;
  G.teams[0].gold = Math.min(G.teams[0].gold, 150) + 250;
  G.teams[0].incMul = 1;
  G.teams[0].auto = {};
}
function tutSteps(nar, adv) {
  const me = 0,
    fac = V.facs[me],
    F = FAC[fac],
    E = FAC[V.facs[1]],
    ks = F.kinds,
    T = () => G.teams[me];
  const nm = r => KINDS[ks.find(k => KINDS[k].role === r)].name;
  const nf = FLAGS.map((f, i) => i).sort(
    (a, b) =>
      Math.hypot(FLAGS[a].x - BASES[me].x, FLAGS[a].z - BASES[me].z) - Math.hypot(FLAGS[b].x - BASES[me].x, FLAGS[b].z - BASES[me].z)
  )[0];
  const mid = 2,
    own = (role, q) =>
      G.units.filter(u => u.team === me && KINDS[u.k].role === role).length + (q ? T().q.filter(k => KINDS[k].role === role).length : 0);
  const gold = n => {
    T().gold += n;
  };
  const focus = p => {
    camS.x = p.x;
    camS.z = p.z + 16;
    camS.dist = camera.aspect < 1 ? 46 : 38;
    applyCam();
  };
  const rush = fac === 'viking' ? 'Goldrausch' : 'Pfandflaschenrausch',
    pc = !COARSE;
  const kOf = r => ks.find(k => KINDS[k].role === r),
    dir = 1,
    arena = () => {
      const f = FLAGS[nf];
      return nearestWalkable(MAP, f.x, f.z - 3);
    };
  const clearTut = () => {
    if (V.poss) exitEgo(true, true);
    const rm = new Set(G.units.filter(u => u.tutPrep || u.tutStill || u.tutDummy).map(u => u.id));
    for (const t of G.teams) {
      if (rm.has(t.pos)) {
        t.pos = null;
        t.posIn = null;
      }
    }
    G.units = G.units.filter(u => !rm.has(u.id));
    TUT.dummy = null;
    TUT.dIds = [];
    TUT.egoId = null;
    TUT.faceYaw = undefined;
  };
  const prep = (k, list, hpF) => {
    clearTut();
    G.towerOff[0] = true;
    const a = arena(),
      u = tutUnit(0, k, a.x, a.z);
    u.tutPrep = true;
    TUT.egoId = u.id;
    TUT.dIds = list.map(([dx, dz, dk]) => {
      const d = tutUnit(1, dk ?? E.kinds[0], a.x + dx, a.z + dz * dir);
      d.tutStill = true;
      d.tutDummy = true;
      d.hp = KINDS[d.k].hp * hpF;
      return d.id;
    });
    TUT.enterAt = now() + 500;
  };
  const egoKeep = () => {
    if (V.poss || !TUT.egoId || now() < (TUT.enterAt || 0)) return;
    if (!V.units.has(TUT.egoId)) return;
    V.selected = new Set([TUT.egoId]);
    TUT.sys = true;
    enterEgo();
    TUT.sys = false;
    TUT.enterAt = now() + 1800;
    if (V.poss) {
      const d = G.units.find(x => x.id === (TUT.dIds[0] ?? TUT.dummy));
      if (TUT.faceYaw !== undefined) V.poss.camYaw = V.poss.yaw = TUT.faceYaw;
      else if (d) V.poss.camYaw = V.poss.yaw = Math.atan2(d.x - V.poss.x, d.z - V.poss.z);
    }
  };
  const dead = () => TUT.dIds.length > 0 && TUT.dIds.every(id => !G.units.some(u => u.id === id));
  const atk = pc ? kl('attack') : 'Schwert-Knopf',
    spc = pc ? kl('special') : 'Stern';
  const camTo = (p, d) => {
    TUT.cam = { x: p.x, z: p.z + 2, d, t0: now() };
  };
  const flagZoom = f => {
    TUT.camSeq = [
      { x: f.x, z: f.z + 2, d: 18, at: 0 },
      { x: f.x, z: f.z + 2, d: 18, at: 1700 },
      { x: (f.x + BASES[me].x) / 2, z: (f.z + BASES[me].z) / 2 + 4, d: camera.aspect < 1 ? 62 : 50, at: 3200 },
    ];
    TUT.camSeqT = now();
  };
  const possStep = (k, list, hpF, txt) => ({
    t: txt,
    allow: ['take'],
    start: () => {
      prep(k, list, hpF);
      TUT.enterAt = Infinity;
      V.selected.clear();
      const a = arena();
      camTo(a, 22);
    },
    hlFn: () => (V.selected.has(TUT.egoId) ? '#possBtn' : null),
    world: () => {
      const u = G.units.find(x => x.id === TUT.egoId);
      return u && !V.poss ? { x: u.x, z: u.z } : null;
    },
    done: () => V.poss && V.poss.confirmed,
  });
  const army = list => {
    const f = frontOf(me, 10);
    list.forEach((r, i) => tutUnit(me, kOf(r), f.x + (i - list.length / 2) * 1.5, f.z));
  };
  const edgeSpot = () => {
    const B = BASES[me];
    let best = null,
      bs = 1e9;
    for (let x = -HALF_W + 4; x <= HALF_W - 4; x += 1.5)
      for (let z = -HALF_H + 8; z <= HALF_H - 8; z += 1.5) {
        if ((z - BASES[1 - me].z) ** 2 < (z - B.z) ** 2 || !walkable(x, z)) continue;
        const ed = edgeDir(x, z, 2.6);
        if (!ed || ed.s < 1.4) continue;
        const tx = -ed.z,
          tz = ed.x;
        const cav = { x: x - ed.x * 7.5, z: z - ed.z * 7.5 };
        if (!walkable(cav.x, cav.z) || !walkable(x - ed.x * 3.5, z - ed.z * 3.5)) continue;
        const ds = [-1.6, 0, 1.6].map(o => ({ x: x + tx * o, z: z + tz * o }));
        if (!ds.every(d => walkable(d.x, d.z) && edgeDir(d.x, d.z, 2.8))) continue;
        const fx = ed.x,
          fz = ed.z;
        if (!ds.every(d => knockFalls(d, d.x - fx, d.z - fz, 6))) continue;
        if (
          !ds.every(d => {
            for (let k = 0.5; k <= 3; k += 0.5)
              if (
                fallZone(d.x + fx * k, d.z + fz * k) &&
                fallZone(d.x + fx * (k + 2.5), d.z + fz * (k + 2.5)) &&
                fallZone(d.x + fx * (k + 5), d.z + fz * (k + 5))
              )
                return true;
            return false;
          })
        )
          continue; // a wide chasm, not a narrow crevasse
        const sc = Math.hypot(x - B.x, z - B.z) + Math.abs(x) * 0.3;
        if (sc < bs) {
          bs = sc;
          best = { x, z, ed, tx: fx, tz: fz, cav, ds };
        }
      }
    return best;
  };
  const cliffStep = () => {
    clearTut();
    G.towerOff[0] = true;
    TUT.dashAt = 0;
    TUT.cliffT = now();
    const sp = TUT.edge || (TUT.edge = edgeSpot());
    if (!sp) return;
    const u = tutUnit(0, kOf('cav'), sp.cav.x, sp.cav.z);
    u.tutPrep = true;
    u.yaw = TUT.faceYaw = Math.atan2(sp.tx, sp.tz);
    TUT.egoId = u.id;
    TUT.dIds = sp.ds.map(d => {
      const e = tutUnit(1, E.kinds[0], d.x, d.z);
      e.tutStill = true;
      e.tutDummy = true;
      e.tutPush = true;
      e.hp = e.mhp = 900;
      return e.id;
    });
    TUT.enterAt = now() + 400;
    camTo(sp, 22);
  };
  const tutBear = (near, hp) => {
    const a = nearestWalkable(MAP, near.x, near.z);
    G.bearId = (G.bearId || 100) + 1;
    const b = { id: G.bearId, x: a.x, z: a.z, hx: a.x, hz: a.z, yaw: 0, cd: 1.5, atk: 0, mv: 0, wt: 0, hp, mhp: hp, dm: 0.3, tut: 1 };
    G.bears.push(b);
    return b;
  };
  const cavDummy = () => {
    const a = arena(),
      d = tutUnit(1, E.kinds[0], a.x, a.z + 11 * dir);
    d.poss = true;
    d.tutDummy = true;
    d.hp = KINDS[d.k].hp * 0.4;
    d.yaw = Math.atan2(a.x - d.x, a.z - d.z);
    G.teams[1].pos = d.id;
    G.teams[1].posIn = null;
    TUT.dummy = d.id;
    return d;
  };
  if (adv)
    return [
      { t: `Willkommen in der Profi-Schule! Hier zeig ich dir die Tricks, mit denen man wirklich gewinnt.`, next: true },
      {
        t: pc
          ? 'Trick 1: Zieh mit gedrückter linker Maustaste einen Rahmen um deine Krieger.'
          : 'Trick 1: Finger kurz gedrückt halten, dann eine Schlinge um deine Krieger ziehen.',
        start: () => {
          army(['melee', 'melee', 'melee', 'ranged', 'ranged', 'cav']);
          const f = frontOf(me, 10);
          camTo({ x: f.x, z: f.z - 4 }, 26);
        },
        done: () => TUT.flags.lasso,
      },
      {
        t: 'Mit „Nah“, „Fern“ und „Reiter“ wählst du nur eine Sorte. Tippe auf „Fern“.',
        hl: '[data-sel="ranged"]',
        done: () => TUT.flags.sel === 'ranged',
      },
      {
        t: `Je mehr Krieger an einer Fahne stehen, desto schneller gehört sie dir. Schick ALLE zur Fahne mit dem Pfeil – zähl mit, wie schnell das geht!`,
        world: () => FLAGS[nf],
        start: () => flagZoom(FLAGS[nf]),
        done: () => G.flags[nf].owner === me,
      },
      {
        t: `Reiter sind die Schnellsten. Schick die zwei neuen „${nm('cav')}“ zur fernen Fahne – so sicherst du früh Einkommen, bevor der Gegner da ist.`,
        world: () => FLAGS[4],
        start: () => {
          army(['cav', 'cav']);
          TUT.flags = {};
          flagZoom(FLAGS[4]);
        },
        hlFn: () => (V.selected.size ? null : '[data-sel="cav"]'),
        done: () => G.flags[4].owner === me,
      },
      {
        id: 'moveMode',
        t: pc
          ? `Praktisch üben: Wähle deine Truppen, wechsle mit „Laufen“ (${kl('mode')}) in den Laufmodus und gib dann ${kl('order')} auf die Fahne beim Pfeil. Im Laufmodus gehen sie direkt dorthin.`
          : 'Praktisch üben: Wähle deine Truppen, tippe auf „Laufen“ und anschließend auf die Fahne beim Pfeil. Im Laufmodus gehen sie direkt dorthin.',
        hlFn: () => (!V.selected.size ? '[data-sel="all"]' : V.orderMode !== 'move' ? '#modeMv' : null),
        world: () => FLAGS[nf],
        start: () => {
          const f = frontOf(me, 6),
            units = G.units.filter(u => u.team === me && u.hp > 0);
          units.forEach((u, i) => {
            const p = nearestWalkable(MAP, f.x + ((i % 4) - 1.5) * 1.6, f.z + Math.floor(i / 4) * 1.6);
            Object.assign(u, { x: p.x, z: p.z, y: unitY(p.x, p.z), vx: 0, vz: 0, ord: { x: p.x, z: p.z, mv: false }, path: null, tgt: -1 });
            delete u.pj;
            delete u.navPad;
          });
          TUT.moveSetup = {
            units: units.map(u => ({ id: u.id, x: u.x, z: u.z, y: u.y, yaw: u.yaw })),
            rally: { ...T().rally },
            flag: { ...G.flags[nf] },
            flagIndex: nf,
          };
          tutResetMove();
          flagZoom(FLAGS[nf]);
        },
        command: c => {
          if (c.m === 1 && V.orderMode === 'move' && tutMovementOrder(c, FLAGS[nf])) return true;
          tutResetMove();
          flagZoom(FLAGS[nf]);
          $('#tutText').textContent =
            c.m !== 1 || V.orderMode !== 'move'
              ? 'Das war der Angriffsmodus. Wir starten diesen Versuch neu: erst Truppen wählen, dann „Laufen“, dann die Fahne beim Pfeil als Ziel.'
              : 'Das war nicht die Fahne beim Pfeil. Versuch neu: Truppen wählen, „Laufen“, dann genau diese Fahne als Ziel.';
          SFX.play('error');
          return false;
        },
        done: () => tutMovementDone(FLAGS[nf]),
      },
      {
        t: 'Die Sammelfahne bestimmt, wo neue Krieger warten. Setz sie nah an die Front, dann sind Verstärkungen schneller da. Fahnen-Knopf, dann Boden.',
        hlFn: () => (V.rallyMode ? null : '#rallyBtn'),
        start: () => setOrderMode('attack'),
        done: () => TUT.flags.rally,
      },
      {
        id: 'twoAuto',
        t: COARSE
          ? `Schalte AUTO bei „${nm('melee')}“ und „${nm('ranged')}“ ein: beide runden Knöpfe lange gedrückt halten. Leuchten beide grün, werden diese zwei Sorten abwechselnd nachgebildet.`
          : `Schalte AUTO bei „${nm('melee')}“ und „${nm('ranged')}“ ein. Beide leuchtenden AUTO-Knöpfe müssen aktiv sein – dann werden diese zwei Sorten abwechselnd nachgebildet.`,
        hlMany: COARSE
          ? ['.spawn[data-slot="0"] .main', '.spawn[data-slot="1"] .main']
          : ['.spawn[data-slot="0"] .auto', '.spawn[data-slot="1"] .auto'],
        start: () => {
          T().auto[ks[0]] = false;
          T().auto[ks[1]] = false;
          gold(300);
        },
        done: () => !!T().auto[ks[0]] && !!T().auto[ks[1]],
      },
      {
        id: 'counterRule',
        t: COARSE
          ? `Beim Ausbilden zeigt dir eine Meldung, gegen wen die Einheit stark ist. Merke: Nah schlägt Reiter, Reiter schlagen Fern, Fern schlägt Nah.`
          : `Unten bei der Einheit steht, gegen welche sie stark ist. Schau auf die Anzeige unter den Einheitenkarten: Nah schlägt Reiter, Reiter schlagen Fern, Fern schlägt Nah. Reiter zerlegen auch Katapulte. Konter sind sichtbar: Reiter rennen Fernkämpfer um, Nahkämpfer hauen Reiter vom Sattel, Pfeile bremsen Nahkämpfer – dann steht „KONTER!“ da. Gesteuert macht ein Konter riesigen Schaden: zwei saubere Treffer reichen.`,
        next: true,
      },
      {
        t: `Gegnerisches Katapult! Übernimm den „${nm('cav')}“ und ramm es mit der Spezialfähigkeit (${spc}) – der Dash zerbricht Katapulte sofort.`,
        start: () => {
          prep(kOf('cav'), [[0, 12, E.kinds[3]]], 1);
          TUT.enterAt = now() + 400;
        },
        after: egoKeep,
        done: dead,
      },
      {
        t: `Klippen-Trick! Der Reiter-Dash schleudert Gegner vor allem nach VORNE. Schau auf die Puppen vor der Kante und dash sofort (${spc}) – die Puppen fliegen in die Schlucht!`,
        start: cliffStep,
        after: () => {
          egoKeep();
          const u = G.units.find(x => x.id === TUT.egoId),
            left = TUT.dIds.some(id => G.units.some(x => x.id === id));
          if (u && u.spcd > 1 && !TUT.dashAt) TUT.dashAt = now();
          if (left && ((TUT.dashAt && now() - TUT.dashAt > 3300) || (!u && now() - (TUT.cliffT || 0) > 2500))) {
            const fell = !u;
            cliffStep();
            TUT.cliffT = now();
            $('#tutText').textContent = fell
              ? 'Uups – selbst in die Schlucht gedasht! Nochmal von vorn.'
              : 'Nicht alle erwischt – nochmal! Schau gerade auf die Puppen vor der Kante und dash sofort.';
            SFX.play('error');
          }
        },
        world: () => (TUT.edge && !V.poss ? TUT.edge.cav : TUT.edge ? TUT.edge : null),
        done: dead,
      },
      {
        t: 'Merke: Gesteuerte Reiter und Stock-Opas können Gegner von Klippen stoßen – der Computer weiß das auch! Halte dich von Kanten fern.',
        start: () => {
          clearTut();
        },
        next: true,
      },
      {
        t: `Ein wilder Eisbär! Er greift alles in der Nähe an und ist stark gegen Nahkämpfer und Reiter – aber Pfeile tun ihm richtig weh. Übernimm die Bogenschützin und erleg ihn!`,
        start: () => {
          prep(kOf('ranged'), [], 0);
          const u = G.units.find(x => x.id === TUT.egoId);
          u.hp = KINDS[u.k].hp * 2;
          const a = arena();
          TUT.bear = tutBear({ x: a.x, z: a.z + 14 * dir }, 170).id;
          TUT.bev0 = G.bevS || 0;
          TUT.enterAt = now() + 400;
        },
        after: () => {
          egoKeep();
          if (!G.units.some(u => u.id === TUT.egoId) && (G.bevS || 0) === TUT.bev0) {
            const a = arena(),
              u = tutUnit(0, kOf('ranged'), a.x, a.z);
            u.tutPrep = true;
            u.hp *= 2;
            TUT.egoId = u.id;
            TUT.enterAt = now() + 600;
          }
        },
        world: () => {
          const b = G.bears.find(b => b.id === TUT.bear);
          return b ? { x: b.x, z: b.z } : null;
        },
        done: () => (G.bevS || 0) !== TUT.bev0 && G.units.some(u => u.team === me && KINDS[u.k].bear && !(u.taming > 0)),
      },
      {
        t: `Besiegte Eisbären laufen zu dir über! Übernimm deinen Bären und zerfetz die Puppen mit Bärenklauen (${spc}).`,
        start: () => {
          if (V.poss) exitEgo(true, true);
          const bu = G.units.filter(u => u.team === me && KINDS[u.k].bear).pop();
          G.units = G.units.filter(u => !u.tutPrep);
          if (!bu) return;
          bu.tutPrep = true;
          TUT.egoId = bu.id;
          TUT.dIds = [
            [-1.8, 4],
            [0, 4.6],
            [1.8, 4],
          ].map(([ox, oz]) => {
            const d = tutUnit(1, E.kinds[ox ? 1 : 0], bu.x + ox, bu.z + oz * dir);
            d.tutStill = true;
            d.tutDummy = true;
            d.hp = KINDS[d.k].hp * 0.8;
            return d.id;
          });
          TUT.enterAt = now() + 900;
        },
        after: egoKeep,
        done: dead,
      },
      {
        t: pc
          ? 'Mit der Bogenschützin zählen Kopfschüsse vierfach. Triff den Riesenkopf am Kopf – ein gesteuerter Gegner bringt einen Rausch!'
          : 'Mit der Bogenschützin zählen Kopfschüsse vierfach. Ziel auf den Kopf des Riesenkopfs – ein gesteuerter Gegner bringt einen Rausch!',
        start: () => {
          prep(kOf('ranged'), [], 0);
          const d = cavDummy();
          d.hp = KINDS[d.k].hp;
          TUT.r0 = T().rush;
          TUT.enterAt = now() + 400;
        },
        after: () => {
          egoKeep();
          if (TUT.dummy && !G.units.some(u => u.id === TUT.dummy) && T().rush === TUT.r0) cavDummy();
        },
        world: () => {
          const d = G.units.find(u => u.id === TUT.dummy);
          return d ? { x: d.x, z: d.z } : null;
        },
        done: () => T().rush !== TUT.r0,
      },
      {
        t: `Neu im Spiel: Am Kartenrand tauchen Geldsäcke und Discogranaten auf – öfter bei dem, der weniger Einkommen hat. Nur Ego-Krieger können sie einsammeln. Hol dir beide!`,
        start: () => {
          const P = G.units.find(u => u.id === TUT.egoId) || { x: arena().x, z: arena().z };
          [
            [-4, 7, 0],
            [4, 7, 1],
          ].forEach(([ox, oz, ty]) => {
            const q = nearestWalkable(MAP, P.x + ox, P.z + oz * dir);
            G.itemId = (G.itemId + 1) % 10000;
            G.items.push({ id: G.itemId, ty, v: 80, x: q.x, z: q.z, tut: 1 });
          });
          TUT.enterAt = now() + 400;
        },
        after: egoKeep,
        world: () => {
          const it = G.items.find(i => i.tut);
          return it ? { x: it.x, z: it.z } : null;
        },
        done: () => !G.items.some(i => i.tut),
      },
      {
        t: pc
          ? `Jetzt die Granate: ${kl('nade')} gedrückt halten – mit der Maus hoch/runter stellst du die Weite ein – loslassen. Da vorne steht ein ganzer Haufen – alle im Kreis müssen tanzen!`
          : 'Jetzt die Granate: Granaten-Knopf gedrückt halten, mit dem Finger hoch/runter die Weite einstellen, loslassen. Da vorne steht ein ganzer Haufen – alle im Kreis müssen tanzen!',
        start: () => {
          const P = G.units.find(u => u.id === TUT.egoId) || { x: arena().x, z: arena().z };
          TUT.dIds = [
            [-2, 0],
            [0, 0],
            [2, 0],
            [-1, 1.8],
            [1, 1.8],
            [0, -1.6],
            [2.2, 1.6],
          ].map(([ox, oz]) => {
            const d = tutUnit(1, E.kinds[ox + oz > 1 ? 1 : 0], P.x + ox, P.z + (11 + oz) * dir);
            d.tutStill = true;
            d.tutDummy = true;
            d.hp = KINDS[d.k].hp * 0.55;
            return d.id;
          });
          TUT.ge0 = G.geS || 0;
          TUT.enterAt = now() + 400;
        },
        after: () => {
          egoKeep();
          if (!(T().nades > 0) && !(G.gr && G.gr.length) && !((G.geS || 0) !== TUT.ge0 && G.ge && G.ge[G.ge.length - 1][2] > 0)) {
            T().nades = 1;
            if ((G.geS || 0) !== TUT.ge0)
              $('#tutText').textContent = 'Daneben! Hier ist noch eine. Schau etwas höher, um weiter zu werfen, tiefer für kürzer.';
          }
        },
        world: () => {
          const d = G.units.find(u => u.id === TUT.dIds[0]);
          return d ? { x: d.x, z: d.z } : null;
        },
        done: () => (G.geS || 0) !== TUT.ge0 && G.ge && G.ge[G.ge.length - 1][2] > 0,
      },
      {
        t: `Sie tanzen und wehren sich nicht! Hau jetzt alle um, bevor die Musik aufhört (${atk}, ${spc} für die Spezialfähigkeit).`,
        start: () => {
          TUT.enterAt = now() + 200;
          for (const id of TUT.dIds) {
            const d = G.units.find(u => u.id === id);
            if (d) {
              d.dance = Math.max(d.dance || 0, 20);
              d.hp = Math.min(d.hp, KINDS[d.k].hp * 0.4);
            }
          }
        },
        after: egoKeep,
        done: () =>
          dead() ||
          (TUT.dIds.filter(id => !G.units.some(u => u.id === id)).length >= 4 &&
            G.units.filter(u => TUT.dIds.includes(u.id)).every(u => !(u.dance > 0))),
      },
      {
        t: pc
          ? `Merke: Die Basis schießt auf gesteuerte Krieger doppelt so weit. Allein stürmen ist Selbstmord – geh mit Armee! Zurück mit ${kl('exit')}.`
          : 'Merke: Die Basis schießt auf gesteuerte Krieger doppelt so weit. Allein stürmen ist Selbstmord – geh mit Armee! Tippe „Verlassen“.',
        hl: '#egoExit',
        start: () => {
          TUT.egoId = null;
        },
        done: () => !V.poss,
      },
      {
        t: pc
          ? `Feldherr im Ego-Modus: ${kl('cmdHere')} ruft alle Krieger zu dir, ${kl('cmdAtk')} lässt alle angreifen, was du gerade anschaust, ${kl('swap')} springt zum nächsten Krieger. Und: Drei Kills in Folge laden deine Spezialfähigkeit sofort wieder auf!`
          : 'Feldherr im Ego-Modus: Rechts oben rufst du mit „Zu mir“ alle Krieger zu dir, „Angriff!“ lässt alle angreifen, was du gerade anschaust, „Wechseln“ springt zum nächsten Krieger. Und: Drei Kills in Folge laden deine Spezialfähigkeit sofort wieder auf!',
        next: true,
      },
      {
        t: 'Heimvorteil und Sturm: Im gestrichelten Kreis um deine Basis nehmen deine Krieger weniger Schaden. Ab Minute 7 kommt der Sturm, dann nehmen Basen mehr Schaden, ab Minute 9½ der Endkampf. Spätestens dann wird entschieden!',
        next: true,
      },
      {
        t: 'Überraschungen: Alle paar Minuten passiert etwas – eine Nebelwand (du siehst nur um deine Krieger und deine Basis), ein Goldwagen (wer ihn eskortiert, kassiert), „Kleine Armee, großer Sold“ (60 s lang bringt eine kleine Truppe mehr Gold) oder die Fahnenwanderung (alle Fahnen ziehen um). Oben links steht, was gerade läuft.',
        next: true,
      },
      {
        t: 'Karten-Wissen: Auf Arktis brechen Katapult-Treffer das Eis auf, wer dort steht, kracht ein. In der Wüste schießen Fernkämpfer weiter. Auf Klippen stößt dein Reiter Gegner in die Tiefe.',
        next: true,
      },
      {
        t: 'Im Chaos-Modus wählst du alle paar Minuten einen Perk. Der Gegner sieht, was du nimmst – und du siehst seinen. Plane deine Konter danach!',
        next: true,
      },
      {
        t: `Abschlussprüfung! ${E.base} wird von Kriegern und einem Katapult verteidigt und bildet nach. Kleine Truppe, wenig ${F.res}: Konter, Reiter gegen das Katapult, Sammelfahne, AUTO und Ego-Krieger – du brauchst alles!`,
        free: true,
        world: () => BASES[1],
        start: () => {
          clearTut();
          G.towerOff = [false, false];
          G.towerMul[1] = 0.5;
          const T1 = G.teams[1];
          T1.hp = 800;
          T1.incMul = 0.35;
          T1.gold = 0;
          T1.auto = {};
          T1.auto[E.kinds[0]] = true;
          T1.auto[E.kinds[1]] = true;
          T1.rally = frontOf(1, 13);
          const df = frontOf(1, 13);
          [
            [0, -2.5, 0],
            [0, 2.5, 0],
            [1, -2, 2],
            [1, 2, 2],
            [2, 5, 1],
            [3, 0, 6],
          ].forEach(([ki, ox, oz]) => {
            const d2 = tutUnit(1, E.kinds[ki], df.x + ox, df.z - oz);
            if (ki === 3) {
              d2.hp = 420;
              d2.mhp = 420;
            }
          });
          G.units = G.units.filter(u => u.team !== 0);
          G.teams[0].q = [];
          army(['melee', 'melee', 'melee', 'ranged', 'ranged', 'cav', 'cav']);
          G.teams[0].gold = 300;
          G.teams[0].incMul = 1;
          G.teams[0].auto = {};
          homeCam();
          applyCam();
        },
        after: () => {
          const T1 = G.teams[1],
            n = G.units.filter(u => u.team === 1).length + T1.q.length,
            on = n < 6;
          T1.auto[E.kinds[0]] = on;
          T1.auto[E.kinds[1]] = on;
        },
        done: () => false,
      },
    ];
  const steps = [
    {
      t: `Moin! Ich bin ${nar.name}. In drei Minuten machst du aus ${E.name} Kleinholz. Merk dir nur eins: Hier fliegt alles, was man umrennt. Los geht's!`,
      next: true,
    },
    {
      t: COARSE
        ? `Unten siehst du die runden Knöpfe: Bild = Einheit, Zahl = Preis. Tippe zweimal auf „${nm('melee')}“ – ${F.res} hab ich dir zugesteckt.`
        : `Bilde 2× „${nm('melee')}“ aus. ${F.res} hab ich dir zugesteckt.`,
      allow: ['spawn0'],
      hl: '.spawn[data-slot="0"] .main',
      start: () => {
        gold(140);
        homeCam();
        applyCam();
      },
      done: () => own('melee', true) >= 2,
    },
    {
      id: 'firstFlag',
      t: pc
        ? `Wähle „Alle“ (${kl('selAll')}), dann ${kl('order')} auf die Fahne mit dem Pfeil. Deine beiden Krieger müssen erst dorthin laufen.`
        : `Tippe „Alle“ und dann auf die Fahne mit dem Pfeil. Deine beiden Krieger müssen erst dorthin laufen.`,
      allow: ['order'],
      hlFn: () => (V.selected.size ? null : '[data-sel="all"]'),
      world: () => FLAGS[nf],
      start: () => {
        TUT.moveProof = null;
        G.flags[nf] = { owner: -1, p: 0 };
        flagZoom(FLAGS[nf]);
      },
      command: c => {
        if (tutMovementOrder(c, FLAGS[nf], 2)) return true;
        toast('Wähle beide Krieger und schick sie zur Fahne mit dem Pfeil.', 1800);
        return false;
      },
      done: () => tutMovementDone(FLAGS[nf]) && G.flags[nf].owner === me,
    },
    {
      t: `Jede Fahne bringt mehr ${F.res} pro Sekunde. Je mehr Fahnen du hast, desto mehr Einkommen – schau oben links!`,
      hl: '#inc',
      next: true,
    },
    {
      t: `Konter: Nah schlägt Reiter, Reiter schlagen Fern, Fern schlägt Nah. Drei Fernkämpfer stehen an der mittleren Fahne. Bilde 2 „${nm('cav')}“ aus und ${COARSE ? 'tippe' : 'rechtsklicke'} mit Auswahl auf die Gegner!`,
      allow: ['spawn2', 'order'],
      hl: '.spawn[data-slot="2"] .main',
      world: () => FLAGS[mid],
      start: () => {
        gold(190);
        tutEnemies(mid);
        V.selected.clear();
        for (const id of TUT.enemyIds) {
          const u = G.units.find(u => u.id === id);
          if (u) {
            delete u.tutStill;
            delete u.tutDummy;
            u.cd = 0.4;
            u.hp = Math.min(u.hp, KINDS[u.k].hp * 0.55);
          }
        }
        focus(FLAGS[mid]);
      },
      done: () => TUT.enemyIds.length && TUT.enemyIds.every(id => !G.units.some(u => u.id === id)),
    },
    {
      t: COARSE
        ? `Faul sein erlaubt: Halte den runden Knopf von „${nm('ranged')}“ lange gedrückt – das schaltet AUTO ein (grüner Ring). Dann wird sie von selbst nachgebildet, solange das Geld reicht.`
        : `Faul sein erlaubt: Tippe bei „${nm('ranged')}“ auf AUTO. Dann wird sie von selbst nachgebildet, solange das Geld reicht.`,
      allow: ['auto'],
      hl: COARSE ? '.spawn[data-slot="1"] .main' : '.spawn[data-slot="1"] .auto',
      start: () => gold(120),
      done: () => Object.values(T().auto).some(Boolean),
    },
    possStep(
      kOf('melee'),
      [
        [-2.2, 6],
        [0, 7],
        [2.2, 6],
      ],
      0.3,
      `Jetzt der Clou: Tippe auf deinen „${nm('melee')}“ beim Pfeil und dann auf „Übernehmen“.`
    ),
    {
      t: `Du steckst drin! Hau die drei Puppen um. ${atk} = Schlag, ${spc} = Raserei.`,
      hl: '#egoAtk',
      start: () => {
        TUT.enterAt = now() + 1500;
      },
      after: egoKeep,
      done: dead,
    },
    {
      t: `„${nm('ranged')}“: Ziel mit dem Kreuz und schieß die drei da hinten ab! ${spc} = Fächerschuss.`,
      start: () =>
        prep(
          kOf('ranged'),
          [
            [-4, 13],
            [0, 15],
            [4, 13],
          ],
          0.25
        ),
      after: egoKeep,
      done: dead,
    },
    {
      t: `„${nm('cav')}“! Der Riesenkopf wird von einem Spieler gesteuert. Ramm ihn mit ${spc} um: Wer fliegt, kegelt alle um, die im Weg stehen. Erwisch ihn für einen ${rush}!`,
      start: () => {
        prep(kOf('cav'), [], 0);
        cavDummy();
        TUT.r0 = T().rush;
      },
      after: () => {
        egoKeep();
        if (TUT.dummy && !G.units.some(u => u.id === TUT.dummy) && T().rush === TUT.r0) {
          cavDummy();
          $('#tutText').textContent = 'Den musst DU erwischen! Da kommt der Nächste.';
        }
      },
      world: () => {
        const d = G.units.find(u => u.id === TUT.dummy);
        return d ? { x: d.x, z: d.z } : null;
      },
      done: () => T().rush !== TUT.r0,
    },
    {
      t: `Und jetzt das „${nm('siege')}“: Der rote Kreis zeigt, wo es einschlägt. ${atk} schießt, ${spc} = Dreifach-Salve. ${myFac === 'viking' ? 'Der Fels rollt danach weiter und walzt alles um.' : 'Die Torte hinterlässt eine Sahnepfütze, in der jeder klebt.'}`,
      start: () => {
        prep(
          kOf('siege'),
          [
            [-2.2, 15],
            [0, 16.5],
            [2.2, 15],
            [0, 13.5],
          ],
          0.22
        );
      },
      after: egoKeep,
      done: dead,
    },
    {
      t: pc
        ? `Klasse! Mit ${kl('exit')} oder „Verlassen“ geht's zurück in die Feldherren-Ansicht.`
        : 'Klasse! Tippe auf „Verlassen“, um zurückzukehren.',
      allow: ['exit'],
      hl: '#egoExit',
      start: () => {
        TUT.egoId = null;
      },
      done: () => !V.poss,
    },
    {
      t: `Finale! Ich hab dir eine Armee geschickt. „Alle“ wählen und ${E.base} angreifen!`,
      free: true,
      world: () => BASES[1],
      start: () => {
        clearTut();
        G.towerOff[0] = false;
        army(['melee', 'melee', 'melee', 'ranged', 'ranged', 'cav']);
        tutFinale();
        homeCam();
        applyCam();
      },
      done: () => false,
    },
  ];
  TUT.possIdx = -1;
  return steps;
}
function startTutorial(adv) {
  leaveNet();
  FACE.other = { crop: robotFace(), url: null };
  const facs = [myFac, FAC[myFac].other];
  const tsd = adv ? TUT_PRO_SEED : TUT_SEED;
  G = newGame(facs, tsd, false, { squad: false });
  G.tut = true;
  G.teams[0].rally = frontOf(0, 6);
  G.bears = [];
  G.bearQ = null;
  G.teams[1].incMul = 0;
  G.teams[1].gold = 0;
  G.teams[0].gold = 60;
  G.teams[0].incMul = 0;
  G.towerOff = [false, true];
  V.tut = true;
  beginMatch('ai', facs, 0, tsd);
  pushSnap(snapOf(G));
  startSim(false);
  const nar = myFac === 'viking' ? { name: 'Jarl Knut', k: 0 } : { name: 'Opa Heinz', k: 2 };
  Object.assign(TUT, {
    on: true,
    i: -1,
    nar,
    flags: {},
    wait: 0,
    enemyIds: [],
    dummy: null,
    r0: 0,
    cam: null,
    camSeq: null,
    egoId: null,
    dIds: [],
  });
  TUT.adv = !!adv;
  TUT.steps = tutSteps(nar, !!adv);
  $('#tutFace').src = PORTRAIT[nar.k];
  $('#tutName').textContent = nar.name;
  $('#tut').hidden = false;
  document.body.classList.add('tutOn');
  tutGo(0);
}
function endTutorial() {
  tutHighlights([]);
  TUT.moveProof = null;
  TUT.moveSetup = null;
  TUT.confirm = null;
  TUT.on = false;
  V.tut = false;
  $('#tut').hidden = true;
  $('#tutRing').hidden = true;
  tutArrow.visible = false;
  document.body.classList.remove('tutOn');
}
function tutGo(i) {
  tutHighlights([]);
  TUT.moveProof = null;
  TUT.moveSetup = null;
  TUT.i = i;
  TUT.wait = 0;
  const st = TUT.steps[i];
  if (!st) return;
  TUT.flags = {};
  TUT.stepT = now();
  TUT.confirm = null;
  $('#tutNo').hidden = true;
  $('#tutYes').hidden = true;
  $('#tutText').textContent = typeof st.t === 'function' ? st.t() : st.t;
  $('#tutStep').textContent = i + 1 + ' / ' + TUT.steps.length;
  $('#tutNext').hidden = !st.next;
  if (st.start) st.start();
  const card = $('.tut-card');
  card.classList.remove('in');
  void card.offsetWidth;
  card.classList.add('in');
}
function tutCommand(c) {
  if (!TUT.on || TUT.sys || c.t !== 'order') return true;
  const st = TUT.steps[TUT.i];
  if (!st || TUT.wait || !st.command) return true;
  return st.command(c) !== false;
}
function tutMovementOrder(c, goal, minUnits = 1) {
  if (c.target !== undefined && c.target !== null && c.target !== -1) return false;
  if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || Math.hypot(c.x - goal.x, c.z - goal.z) > 4) return false;
  const ids = new Set(c.ids || []),
    units = G.units.filter(u => u.team === V.myTeam && u.hp > 0 && ids.has(u.id));
  if (units.length < minUnits) return false;
  const previous = new Map((TUT.moveProof || []).map(p => [p.id, p]));
  TUT.moveProof = units.map(u => previous.get(u.id) || { id: u.id, x: u.x, z: u.z });
  return true;
}
function tutMovementDone(goal) {
  return (
    !!TUT.moveProof &&
    TUT.moveProof.length > 0 &&
    TUT.moveProof.every(p => {
      const u = G.units.find(u => u.id === p.id);
      return (
        u && u.hp > 0 && !u.pj && !u.fall && Math.hypot(u.x - p.x, u.z - p.z) >= 4 && Math.hypot(u.x - goal.x, u.z - goal.z) < CFG.flagR
      );
    })
  );
}
function tutResetMove() {
  const setup = TUT.moveSetup;
  if (!setup) return;
  TUT.moveProof = null;
  TUT.flags = {};
  TUT.wait = 0;
  V.selected.clear();
  setOrderMode('attack');
  setRallyMode(false);
  G.flags[setup.flagIndex] = { ...setup.flag };
  G.teams[V.myTeam].rally = { ...setup.rally };
  for (const p of setup.units) {
    const u = G.units.find(u => u.id === p.id);
    if (!u) continue;
    Object.assign(u, {
      ...p,
      vx: 0,
      vz: 0,
      ord: { x: p.x, z: p.z, mv: false },
      path: null,
      repath: 0,
      losT: 0,
      tgt: -1,
      stuck: 0,
      ivx: 0,
      ivz: 0,
      _ix: p.x,
      _iz: p.z,
      eng: 0,
    });
    delete u.pj;
    delete u.navPad;
    delete u.consumePad;
    delete u.fall;
    delete u.air;
    delete u.kb;
  }
  pushSnap(snapOf(G));
}
function tutHighlights(selectors) {
  const wanted = selectors.length ? $$(selectors.join(',')) : [],
    old = TUT.highlighted || [];
  for (const el of old) if (!wanted.includes(el)) el.classList.remove('tutGlow');
  for (const el of wanted) if (!old.includes(el)) el.classList.add('tutGlow');
  TUT.highlighted = wanted;
}
function tutCamTick(dt) {
  if (V.poss) {
    TUT.camSeq = null;
    TUT.cam = null;
    return;
  }
  if (TUT.camSeq) {
    const el = now() - TUT.camSeqT,
      sq = TUT.camSeq;
    let a = sq[0],
      b = sq[0];
    for (let i = 0; i < sq.length; i++)
      if (el >= sq[i].at) {
        a = sq[i];
        b = sq[i + 1] || sq[i];
      }
    const k = b === a ? 1 : sstep(0, 1, (el - a.at) / (b.at - a.at)),
      f = 1 - Math.exp(-dt * 7);
    camS.x = lerp(camS.x, lerp(a.x, b.x, k), f);
    camS.z = lerp(camS.z, lerp(a.z, b.z, k), f);
    camS.dist = lerp(camS.dist, lerp(a.d, b.d, k), f);
    applyCam();
    if (el > sq[sq.length - 1].at + 400) TUT.camSeq = null;
  } else if (TUT.cam) {
    const el = now() - TUT.cam.t0,
      f = 1 - Math.exp(-dt * 6);
    camS.x = lerp(camS.x, TUT.cam.x, f);
    camS.z = lerp(camS.z, TUT.cam.z, f);
    camS.dist = lerp(camS.dist, TUT.cam.d, f);
    applyCam();
    if (el > 1200) TUT.cam = null;
  }
}
function tutTick() {
  if (!TUT.on || !G || TUT.confirm) return;
  const st = TUT.steps[TUT.i];
  if (!st) return;
  if (st.after && !TUT.wait) st.after();
  if (!st.next && st.nextAfter && now() - TUT.stepT > st.nextAfter * 1000) $('#tutNext').hidden = false;
  tutHighlights(!TUT.wait && st.hlMany ? st.hlMany : []);
  const sel = st.hlFn ? st.hlFn() : st.hl,
    ring = $('#tutRing'),
    el = sel && $(sel),
    r = el && el.getBoundingClientRect();
  if (!TUT.wait && r && r.width > 0 && el.offsetParent !== null) {
    ring.hidden = false;
    Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
  } else ring.hidden = true;
  const wp = !TUT.wait && st.world && st.world();
  if (wp) {
    tutArrow.visible = true;
    tutArrow.position.set(wp.x, groundY(wp.x, wp.z) + 6.5 + Math.sin(clock * 4) * 0.4, wp.z);
    tutArrow.rotation.y += 0.08;
  } else tutArrow.visible = false;
  if (TUT.wait) {
    if (now() > TUT.wait) tutGo(TUT.i + 1);
    return;
  }
  if (!st.next && st.done && st.done()) {
    SFX.play('ding');
    $('#tutText').textContent = pick(['Sehr gut!', 'Prima!', 'Genau so!', 'Läuft bei dir!', 'Wie ein Profi!']);
    $('#tutNext').hidden = true;
    TUT.wait = now() + 1000;
  }
}
