/* 41-view-moments.js - Big moments: highlight banners (hlPush/hlTick), phase banners, siege landing warnings (siegeWarnTick), camera shake, ragdolls, free arrows. */
/* ---------- big moments, phases, siege warnings, camera shake ---------- */
const SHAKE = { a: 0 };
function shake(a) {
  SHAKE.a = Math.max(SHAKE.a, a);
}
const HL = { q: [], busy: 0, seen: undefined, last: {} };
function hlText(ty, team, n) {
  const mine = team === V.myTeam;
  if (ty === 'ram')
    return mine
      ? [n >= 5 ? 'RAMMBOCK-FESTIVAL!' : n === 4 ? 'VIERFACH-RAMME!' : 'DREIFACH-RAMME!', n + ' Gegner mit einem Anlauf umgenietet']
      : [n + ' auf einmal umgerammt!', 'Achte auf seinen Reiter'];
  if (ty === 'cliff')
    return mine
      ? [n >= 4 ? 'MASSENSTURZ!' : 'AB IN DIE TIEFE!', n + ' Gegner über die Kante geschubst']
      : ['KLIPPENSTURZ!', n + ' deiner Krieger sind abgestürzt'];
  if (ty === 'ice')
    return mine ? ['EINGEBROCHEN!', n + ' Gegner sind ins Eis gekracht'] : ['DAS EIS BRICHT!', n + ' deiner Krieger sind eingebrochen'];
  if (ty === 'strike')
    return mine
      ? [n >= 5 ? 'ALLE NEUNE!' : 'STRIKE!', n + ' Gegner wie Kegel umgeworfen']
      : ['UMGEKEGELT!', n + ' deiner Krieger liegen flach'];
  if (ty === 'boulder') return mine ? ['STEINLAWINE!', 'Der Felsbrocken rollt und rollt'] : ['DER FELS ROLLT!', 'Weg von der Flugbahn!'];
  if (ty === 'gulp')
    return team < 0
      ? ['MAHLZEIT!', 'Der Sandwurm verschlingt ' + n + ' auf einmal']
      : mine
        ? ['FESTMAHL!', n + ' Gegner auf einmal verschlungen']
        : ['VERSCHLUNGEN!', n + ' deiner Krieger im Wurmbauch'];
  if (ty === 'hero')
    return mine
      ? ['HELDENTOD!', 'Dein Held hat dem Sandwurm ' + n + ' Schaden verpasst']
      : ['EIN HELD FÄLLT!', 'Ein Gegner hat sich dem Sandwurm geopfert'];
  if (ty === 'heroWin')
    return mine
      ? ['HELD DES TAGES!', 'Der Sandwurm ist bezwungen – und dein Held lebt!']
      : ['DER WURM IST BEZWUNGEN!', 'Ein gegnerischer Held hat ihn besiegt'];
  if (ty === 'cat')
    return mine
      ? ['KATAPULT ZERLEGT!', '+' + CFG.siegeBounty + ' ' + FAC[V.facs[V.myTeam]].res + ' Beute']
      : ['KATAPULT VERLOREN!', 'Der Gegner kassiert Beute'];
  if (ty === 'save') return mine ? ['IN LETZTER SEKUNDE!', 'Fahne gerade noch gehalten'] : null;
  if (ty === 'ev1') return ['NEBELWAND!', 'Du siehst nur noch um deine Krieger und deine Basis'];
  if (ty === 'fogMode') return ['NEBEL-MODUS', 'Überall Nebel – du siehst nur, was nahe bei deinen Kriegern und deiner Basis ist'];
  if (ty === 'ev2') return ['GOLDWAGEN!', 'Eskortiere den Wagen – wer dabei ist, kassiert'];
  if (ty === 'ev3') return ['KLEINE ARMEE, GROSSER SOLD!', '60 s lang: je weniger Krieger, desto mehr Gold'];
  if (ty === 'ev4') return ['FAHNENWANDERUNG!', 'Die Fahnen ziehen um – schnell hin!'];
  if (ty === 'evEnd') return n === 1 ? ['DER NEBEL LICHTET SICH', 'Freie Sicht'] : ['SOLD-BONUS VORBEI', 'Das Gold fließt wieder normal'];
  if (ty === 'phase')
    return n === 1
      ? ['STURM!', 'Basen nehmen 50 % mehr Schaden, kein Heimvorteil mehr']
      : n === 2
        ? ['ENDKAMPF!', 'Die Mauern brechen: Basisschaden ×2,2, keine Panzerung mehr']
        : ['DIE BASEN BRÖCKELN!', 'Beide Basen verlieren jetzt ständig Leben'];
  return null;
}
function hlPush(ty, team, n, x, z) {
  const t = hlText(ty, team, n);
  if (!t) return;
  if (ty !== 'phase' && now() - (HL.last[ty + team] || -1e9) < 12000) return;
  HL.last[ty + team] = now(); // only truly special moments, no spam
  if (HL.q.length > 2) HL.q.shift();
  HL.q.push({ t, foe: team >= 0 && team !== V.myTeam, ty });
  if (team === V.myTeam && (ty === 'ram' || ty === 'cliff' || ty === 'ice' || ty === 'strike' || ty === 'boulder')) shake(0.3);
  if (ty === 'phase') shake(0.35);
  if (ty === 'ev4') shake(0.25);
}
function hlTick(dt) {
  HL.busy -= dt;
  if (HL.busy > 0 || !HL.q.length) return;
  const h = HL.q.shift(),
    el = $('#hlBan');
  el.querySelector('b').textContent = h.t[0];
  el.querySelector('small').textContent = h.t[1] || '';
  el.classList.toggle('foe', h.foe);
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2200);
  HL.busy = 2.6;
  SFX.play(
    h.ty === 'ev1' || h.ty === 'fogMode'
      ? 'fog'
      : h.ty === 'ev2'
        ? 'wagon'
        : h.ty === 'ev3'
          ? 'underdog'
          : h.ty === 'ev4'
            ? 'flagmove'
            : h.ty === 'evEnd'
              ? 'ding'
              : h.ty === 'phase'
                ? 'alarm'
                : h.ty === 'strike'
                  ? 'strike'
                  : h.ty === 'boulder'
                    ? 'roll'
                    : h.foe
                      ? 'lost'
                      : 'rush',
    { vol: 0.9 }
  );
  if (h.ty === 'phase') SFX.play('horn', { vol: 1 });
}
function hlProcess(s) {
  if (!s.hl) return;
  if (!s.hl.length) {
    if (HL.seen === undefined) HL.seen = 0;
    return;
  }
  if (HL.seen === undefined) {
    HL.seen = s.hl[s.hl.length - 1][0];
    return;
  }
  for (const e of s.hl) {
    const d = (e[0] - HL.seen + 10000) % 10000;
    if (d === 0 || d > 5000) continue;
    HL.seen = e[0];
    hlPush(e[1], e[2], e[3], e[4] / 10, e[5] / 10);
  }
}
const SW = { pool: [] };
function siegeWarnTick() {
  const list = (V.latest && V.latest.sp) || [];
  let i = 0;
  for (const e of list) {
    let m = SW.pool[i];
    if (!m) {
      m = new THREE.Group();
      m.r1 = new THREE.Mesh(
        SW.ring || (SW.ring = new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2)),
        new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.85, depthWrite: false })
      );
      m.d1 = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.24, depthWrite: false }));
      m.r1.renderOrder = m.d1.renderOrder = 7;
      m.add(m.r1, m.d1);
      scene.add(m);
      SW.pool.push(m);
    }
    const x = e[0] / 10,
      z = e[1] / 10,
      tl = e[2] / 10,
      R = e[4] / 10,
      mine = e[3] === V.myTeam,
      ice = MAP && MAP.ice && onIce(x, z);
    m.visible = true;
    m.position.set(x, Math.max(groundY(x, z), WL + 0.1) + 0.2, z);
    m.r1.scale.setScalar(R);
    m.d1.scale.setScalar(Math.max(0.08, R * clamp(1 - tl / 1.8, 0, 1)));
    m.r1.material.color.setHex(mine ? 0xffa040 : 0xff3b2f);
    m.d1.material.color.setHex(ice ? 0x1f6f9a : mine ? 0xffa040 : 0xff3b2f);
    m.d1.material.opacity = ice ? 0.4 : 0.24;
    m.r1.material.opacity = 0.5 + 0.45 * Math.abs(Math.sin(clock * 9));
    i++;
  }
  for (; i < SW.pool.length; i++) SW.pool[i].visible = false;
}
function homeRings(facs) {
  for (const l of [V.homeRings, V.towerRings])
    if (l)
      l.forEach(m => {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
  V.homeRings = V.towerRings = null;
  if (V.tut) return;
  // three rings per base: home advantage (dashed, faction colour), tower range (solid red) and the wider tower range against ego warriors (dotted red)
  const ring = (B, r, W, col, op, dash) => {
    const N = 160,
      pos = [],
      idx = [];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * TAU,
        ca = Math.cos(a),
        sa = Math.sin(a);
      for (const rr of [r - W, r]) {
        const x = B.x + ca * rr,
          z = B.z + sa * rr;
        pos.push(x, Math.max(groundY(x, z), WL) + 0.14, z);
      }
    }
    for (let k = 0; k < N; k++)
      if (dash === 0 || (dash === 1 ? (k >> 1) % 2 === 0 : k % 4 === 0)) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })
    );
    m.renderOrder = 2;
    scene.add(m);
    return m;
  };
  V.homeRings = BASES.map((B, i) => ring(B, CFG.homeR, 0.5, lin(FAC[facs[i]].col), 0.55, 1));
  V.towerRings = BASES.flatMap(B => [
    ring(B, CFG.towerRange, 0.28, lin(0xff4a3a), 0.5, 0),
    ring(B, CFG.towerPossRange, 0.22, lin(0xff4a3a), 0.35, 2),
  ]);
}
/* ---------- hit feedback, ragdoll, free arrows ---------- */
function hitFx(team, h) {
  const x = h[1] / 10,
    z = h[2] / 10,
    y = h[5] / 10,
    head = h[4] === 1,
    mine = team === V.myTeam;
  if (!mine) return;
  V.lastMyHit = { x, z, t: now() };
  word((head ? '' : '-') + h[3], x + (Math.random() - 0.5) * 0.6, y + (head ? 1.6 : 1.2), z, {
    color: head ? '#ff5a3c' : '#ffffff',
    scale: head ? 1.1 : 0.8,
    prio: true,
  });
  if (head) {
    word('KOPFTREFFER!', x, y + 2.8, z, { color: '#ffd34d', scale: 1.5, prio: true });
    SFX.play('headshot');
    puff(x, y, z, 0xffe08a, 6, 0.6);
    if (V.poss) {
      const xt = $('#xhairTxt');
      xt.classList.add('on');
      clearTimeout(xt._t);
      xt._t = setTimeout(() => xt.classList.remove('on'), 900);
    }
  } else SFX.play('hitmark', { vol: 0.8 });
  const ch = $('#xhair');
  if (ch && V.poss) {
    ch.classList.remove('hit', 'head');
    void ch.offsetWidth;
    ch.classList.add(head ? 'head' : 'hit');
    clearTimeout(ch._t);
    ch._t = setTimeout(() => ch.classList.remove('hit', 'head'), head ? 650 : 250);
  }
  if (V.poss) {
    EG.kick = Math.max(EG.kick, head ? 0.5 : 0.25);
  }
}
function startRagdoll(u, fx2, fz2) {
  const x = u.g.position.x,
    z = u.g.position.z;
  let dx = x - fx2,
    dz = z - fz2;
  const d = Math.hypot(dx, dz);
  u.rag = {
    t: 0,
    spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3),
    dir: d > 0.01 ? Math.atan2(dx, dz) : u.g.rotation.y + Math.PI,
    moon: !!tpk(1 - u.team, 'moon'),
  };
  u.g.rotation.y = u.rag.dir + Math.PI;
  puff(x, u.g.position.y + 0.8, z, 0xd8c48f, 5, 0.8);
  SFX.play('whoosh', { x, z });
  if (Math.random() < 0.5) word(pick(['UIIIH!', 'HUIII!', 'AUA!', 'FLIEG!']), x, u.g.position.y + 3, z, { color: '#ffffff', scale: 0.9 });
}
function startTumble(u) {
  if (!u || u.rag) return;
  const x = u.g.position.x,
    z = u.g.position.z;
  u.rag = { t: 0, spin: Math.random() < 0.5 ? -1 : 1, dir: u.g.rotation.y + Math.PI, fall: true };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    puff(x + Math.cos(a) * 1.2, u.g.position.y + 0.2, z + Math.sin(a) * 1.2, 0xd8c48f, 1, 0.8);
  }
  SFX.play('bonk', { x, z });
  word(pick(['AUA!', 'UFF!', 'AUTSCH!', 'Mein Rücken!']), x, u.g.position.y + 3, z, { color: '#ffffff', scale: 0.9 });
}
function ragdollRig(u, dt) {
  const R = u.rag;
  R.t += dt;
  const t = R.t;
  const M = R.moon ? 1.1 : 0,
    fly = R.fall ? 0.22 : 0.45 + M,
    lie = R.fall ? 0.6 : 1.25 + M,
    up = R.fall ? 0.95 : 1.75 + M;
  if (u.foreL) {
    const fl = t < fly,
      up2 = t >= lie;
    u.foreL.rotation.x = fl ? -0.8 + Math.sin(t * 28) * 0.6 : up2 ? -1.2 * (1 - sstep(lie, up, t)) : -0.3;
    u.foreR.rotation.x = fl ? -0.7 + Math.cos(t * 25) * 0.6 : up2 ? -1.2 * (1 - sstep(lie, up, t)) : -0.5;
  }
  if (u.shinL) {
    const fl = t < fly;
    u.shinL.rotation.x = fl ? 0.7 + Math.sin(t * 25) * 0.5 : t < lie ? 0.25 : 0.9 * (1 - sstep(lie, up, t));
    u.shinR.rotation.x = fl ? 0.7 - Math.sin(t * 25) * 0.5 : t < lie ? 0.1 : 0.9 * (1 - sstep(lie, up, t));
  }
  if (t < fly) {
    const p = t / fly;
    u.rig.position.y = Math.sin(p * Math.PI) * (R.moon ? 6 : R.fall ? 0.35 : 1.6);
    u.rig.rotation.x = -p * (Math.PI / 2 + 0.6);
    u.rig.rotation.z = Math.sin(p * Math.PI) * 0.4 * Math.sign(R.spin);
    u.armL.rotation.x = -2.6 + Math.sin(t * 30) * 0.6;
    u.armR.rotation.x = -2.4 + Math.cos(t * 27) * 0.6;
    if (u.legL) {
      u.legL.rotation.x = Math.sin(t * 25) * 0.9;
      u.legR.rotation.x = -Math.sin(t * 25) * 0.9;
    }
    u.neck.rotation.z = Math.sin(t * 22) * 0.5;
  } else if (t < lie) {
    const p = (t - fly) / (lie - fly),
      b = Math.abs(Math.sin(p * Math.PI * 2)) * 0.18 * (1 - p);
    u.rig.position.y = 0.15 + b;
    u.rig.rotation.x = -(Math.PI / 2 - 0.05);
    u.rig.rotation.z *= 0.8;
    u.armL.rotation.x = -2.8;
    u.armR.rotation.x = -0.4;
    if (u.legL) {
      u.legL.rotation.x = 0.3;
      u.legR.rotation.x = -0.2;
    }
    u.neck.rotation.z = Math.sin(t * 9) * 0.3 * (1 - p);
  } else if (t < up) {
    const p = sstep(lie, up, t);
    u.rig.position.y = 0.15 * (1 - p) + Math.sin(p * Math.PI) * 0.25;
    u.rig.rotation.x = -(Math.PI / 2 - 0.05) * (1 - p);
    u.rig.rotation.z = 0;
    u.armL.rotation.x = lerp(-1.6, 0, p);
    u.armR.rotation.x = lerp(-1.6, 0, p);
  } else {
    u.rig.rotation.x = 0;
    u.rig.rotation.z = 0;
    u.rag = null;
    if (Math.random() < 0.4)
      word(pick(['Geht schon!', 'Nix passiert!', 'Weiter!']), u.g.position.x, u.g.position.y + 3.2, u.g.position.z, {
        color: '#ffffff',
        scale: 0.7,
      });
  }
}
const fpView = new Map();
function freeArrowMesh(k) {
  const m = projGet(k === 3 ? 'teeth' : 'arrow');
  m.scale.setScalar(k === 3 ? 1.3 : 1.25);
  scene.add(m);
  return m;
}
function updateFreeArrows(dt) {
  const s = V.latest,
    seen = new Set();
  if (s && s.fp)
    for (const f of s.fp) {
      if (f[7] === V.myTeam) continue;
      seen.add(f[0]);
      let v = fpView.get(f[0]);
      if (!v) {
        v = {
          m: freeArrowMesh(f[8]),
          k: f[8],
          p: new THREE.Vector3(f[1] / 10, f[2] / 10, f[3] / 10),
          d: new THREE.Vector3(f[4], f[5], f[6]).normalize(),
        };
        fpView.set(f[0], v);
        SFX.play(f[8] === 1 ? 'bow' : 'teeth', { x: v.p.x, z: v.p.z });
      } else {
        const tp = new THREE.Vector3(f[1] / 10, f[2] / 10, f[3] / 10);
        if (tp.distanceToSquared(v.p) > 16) v.p.copy(tp);
      }
    }
  for (const [id, v] of fpView) {
    if (!seen.has(id)) {
      puff(v.p.x, v.p.y, v.p.z, 0xfff1a8, 2, 0.4);
      projPut(v.m);
      fpView.delete(id);
      continue;
    }
    v.p.addScaledVector(v.d, CFG.arrowSpeed * dt);
    v.m.position.copy(v.p);
    orientProj(v.m, v.d, v.k, dt);
  }
  for (let i = fx.shots.length - 1; i >= 0; i--) {
    const a = fx.shots[i];
    a.t += dt;
    const step = CFG.arrowSpeed * dt,
      n = 4;
    let done = a.t > a.life;
    for (let j = 0; j < n && !done; j++) {
      a.p.addScaledVector(a.d, step / n);
      if (a.p.y < Math.max(WL, groundY(a.p.x, a.p.z))) {
        done = true;
        break;
      }
      for (const v of WW.views.values())
        if (wormRayHit(v, a.p)) {
          done = true;
          break;
        }
      if (done) break;
      for (const u of V.units.values()) {
        if (u.team === V.myTeam || u.rag) continue;
        if (u.worm) {
          if (wormRayHit(u, a.p)) {
            done = true;
            break;
          }
          continue;
        }
        const dx = a.p.x - u.g.position.x,
          dz = a.p.z - u.g.position.z,
          h2 = dx * dx + dz * dz;
        if (h2 > 9) continue;
        const hb = headBox({ k: u.k, poss: u.isPoss }),
          hy = u.g.position.y + hb.y;
        if (h2 + (a.p.y - hy) ** 2 < (hb.r * 1.12) ** 2 || (h2 < 0.25 && a.p.y > u.g.position.y && a.p.y < hy)) {
          done = true;
          break;
        }
      }
    }
    a.m.position.copy(a.p);
    orientProj(a.m, a.d, a.k, dt);
    if (done) {
      puff(a.p.x, a.p.y, a.p.z, 0xfff1a8, 2, 0.4);
      projPut(a.m);
      fx.shots.splice(i, 1);
    }
  }
}
function orientProj(m, d, k, dt) {
  if (k === 3) {
    m.rotation.x += dt * 14;
    m.rotation.y += dt * 9;
  } else m.lookAt(m.position.x + d.x, m.position.y + d.y, m.position.z + d.z);
}
function clearFreeArrows() {
  for (const [, v] of fpView) projPut(v.m);
  fpView.clear();
  fx.shots.forEach(a => projPut(a.m));
  fx.shots.length = 0;
}
