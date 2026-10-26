/* 40-view.js - VIEW STATE: the client side. pushSnap() buffers snapshots, processSnap() turns their event lists into effects once, V holds the view state
   (V.units views by id, V.poss = the warrior you steer, V.latest = newest snapshot). resetView() clears everything between matches. */
const TUT = { on: false, flags: {} };
const V = {
  buf: [],
  offset: null,
  delay: 0.06,
  evT: -1,
  prevMap: null,
  prevSnap: null,
  latest: null,
  units: new Map(),
  dying: [],
  selected: new Set(),
  enemySelected: null,
  myTeam: 0,
  facs: ['viking', 'rentner'],
  markers: [],
  playing: false,
  mode: 'menu',
  orderMode: 'attack',
  poss: null,
};
function resetView() {
  V.units.forEach(disposeUnit);
  V.units.clear();
  V.dying.forEach(u => {
    ghostDrop(u);
    disposeUnit(u);
  });
  V.dying.length = 0;
  V.geSeen = undefined;
  V.xeSeen = undefined;
  V.discoUntil = 0;
  boomReset(); // explosions, scorch marks, traps (75-fass-falle-view.js)
  if (V.dzCause) V.dzCause.clear();
  fx.projs.forEach(p => projPut(p.m));
  fx.projs.length = 0;
  fx.words.forEach(w => scene.remove(w.s));
  fx.words.length = 0;
  fx.puffs.forEach(releasePuff);
  fx.puffs.length = 0;
  puffMesh.count = 0;
  clearRipples();
  sandClear();
  fx.coins.forEach(c => scene.remove(c.m));
  fx.coins.length = 0;
  if (typeof clearFreeArrows === 'function') clearFreeArrows();
  fx.debris.forEach(d => removeOwnedObject(d.m));
  fx.debris.length = 0;
  if (typeof grView !== 'undefined') {
    grView.forEach(v => {
      scene.remove(v.m);
      disposeTree(v.m);
    });
    grView.clear();
  }
  if (typeof roView !== 'undefined') {
    roView.forEach(v => scene.remove(v.m));
    roView.clear();
    goView.forEach(v => {
      scene.remove(v.g);
      disposeTree(v.g);
    });
    goView.clear();
  }
  if (typeof fbView !== 'undefined') {
    fbView.forEach(v => scene.remove(v.g));
    fbView.clear();
  }
  V.ending = null;
  V.pkKey = null;
  V.pkPicked = null;
  V.lastPn = null;
  fx.swings.forEach(w => scene.remove(w.m));
  fx.swings.length = 0;
  swooshClear();
  FEET.list.length = 0;
  V.markers.forEach(mk => scene.remove(mk.m));
  V.markers.length = 0;
  if (typeof EG !== 'undefined' && EG.sgRing) EG.sgRing.visible = false;
  if (typeof tutArrow !== 'undefined') tutArrow.visible = false;
  if (typeof nadeAimView === 'function') nadeAimView(null);
  ['#foePerk', '#perkPick', '#danceBan', '#pauseTag', '#plHint', '#tutRing', '#countdown'].forEach(q => {
    const el = $(q);
    if (el) el.hidden = true;
  });
  {
    const t2 = $('#toast');
    if (t2) t2.style.opacity = 0;
    const eh = $('#egoHint');
    if (eh) eh.style.opacity = 0;
    const xt = $('#xhairTxt');
    if (xt) xt.classList.remove('on');
    const sf = $('#speedFx');
    if (sf) sf.style.opacity = 0;
    const r2 = $('#rush');
    if (r2) r2.className = '';
  }
  if (typeof SFX !== 'undefined') SFX.music(false);
  if (typeof clearWorldViews === 'function') clearWorldViews();
  {
    const mc = $('#mapCard');
    if (mc) mc.remove();
  }
  V.hqLast = [0, 0];
  V.fgCam = false;
  V.buf.length = 0;
  V.offset = null;
  V.evT = -1;
  V.prevMap = null;
  V.prevSnap = null;
  V.latest = null;
  V.renderTime = undefined;
  V.delayTarget = undefined;
  V.selected.clear();
  V.enemySelected = null;
  V.poss = null;
  V.kfSeen = V.kcSeen = V.cbS = undefined;
  V.cbN = 0;
  {
    const kf = $('#killFeed');
    if (kf) kf.innerHTML = '';
  }
}
function disposeOwnedGeometry(root) {
  root.traverse(o => {
    if (o.userData.ownedGeometry) o.geometry.dispose();
  });
}
// Free what a throw-away object built for itself (pickups, thrown grenades, cream puddles): its geometries and materials. Never the
// cached lam() materials, materials or geometries marked userData.shared, the shared unit geometry or the geometry all sprites share.
function disposeTree(root) {
  const cached = new Set(Object.values(matCache));
  root.traverse(o => {
    const g = o.geometry,
      m = o.material;
    if (g && !o.isSprite && !g.userData.sharedUnitGeo && !g.userData.shared) g.dispose();
    if (m && !Array.isArray(m) && !cached.has(m) && !m.userData.shared) m.dispose();
  });
}
function removeOwnedObject(root) {
  scene.remove(root);
  disposeOwnedGeometry(root);
}
function disposeUnit(u) {
  if (u.aLoop) {
    u.aLoop.stop();
    u.aLoop = null;
  }
  if (u.fuseRing) fuseRingDrop(u);
  removeOwnedObject(u.g);
  if (u.hSplit && u.mount && u.mount.parent === scene) scene.remove(u.mount); // a hero's mount that was in the scene on its own
  hpGroup.remove(u.hp);
  if (u.cdSp) {
    scene.remove(u.cdSp);
    u.cdSp.material.dispose();
    u.cdSp = null;
  }
}
function pushSnap(s) {
  if (!s || typeof s.t !== 'number' || !Array.isArray(s.u)) return;
  const last = V.buf[V.buf.length - 1];
  if (last && s.t < last.t) return;
  if (last && s.t === last.t) {
    V.buf[V.buf.length - 1] = s;
    V.latest = s;
    return;
  }
  const n = now(),
    o = n - s.t * 1000;
  if (V.offset === null || n - (V.offset + s.t * 1000) > 1200) {
    V.offset = o;
    V.renderTime = undefined;
  } else if (o < V.offset) V.offset = o;
  else V.offset = Math.min(o, V.offset + 1.5);
  V.buf.push(s);
  V.latest = s;
  if (V.buf.length > 60) V.buf.splice(0, V.buf.length - 60);
}
const snapshotMaps = new WeakMap(),
  airMaps = new WeakMap();
function airMap(s) {
  if (airMaps.has(s)) return airMaps.get(s);
  const m = new Map();
  for (const e of s.af || []) m.set(e[0], e);
  airMaps.set(s, m);
  return m;
}
const hfMaps = new WeakMap();
// flying chickens in a snapshot: id -> height*10
function hfMap(s) {
  if (hfMaps.has(s)) return hfMaps.get(s);
  const m = new Map();
  for (const e of s.hf || []) m.set(e[0], e[1]);
  hfMaps.set(s, m);
  return m;
}
function unitMap(s) {
  if (snapshotMaps.has(s)) return snapshotMaps.get(s);
  const m = new Map();
  for (const e of s.u) m.set(e[0], e);
  snapshotMaps.set(s, m);
  return m;
}
function setPossessedLook(u, on) {
  if (u.isPoss === on) return;
  u.isPoss = on;
  u.headTarget = on ? BIG_HEAD : HEAD_SCALE;
  u.head.material = on && FACE.mats[u.team] && !u.worm ? FACE.mats[u.team] : u.baseHeadMat;
  if (on) {
    puff(u.g.position.x, u.g.position.y + 2.2, u.g.position.z, 0xf0bf4c, 8, 0.8);
    SFX.play('possess', { x: u.g.position.x, z: u.g.position.z });
  }
  if (on && u.team !== V.myTeam && V.playing && !V.warnedPoss && !V.tut) {
    V.warnedPoss = true;
    toast(TR('Der Gegner steuert jetzt selbst einen Krieger! Erwisch ihn mit deinem eigenen für einen {0}.', rushName(V.myTeam)), 4500);
  }
}
function processSnap(s) {
  const cur = unitMap(s),
    prev = V.prevMap,
    ps = V.prevSnap;
  for (const [id, e] of cur) {
    let u = V.units.get(id);
    if (!u) {
      const x = e[2] / 10,
        z = e[3] / 10,
        team = teamOfKind(e[1], s.fa);
      const hen = (e[7] & 32768) === 32768;
      u = Object.assign(buildUnit(e[1]), {
        id,
        team,
        hen,
        hpPct: e[4],
        wob: 0,
        wobV: 0,
        atkT: 9,
        walk: Math.random() * 6,
        speed: 0,
        flash: 0,
        headTarget: HEAD_SCALE,
        isPoss: false,
      });
      ubRegister(u);
      const air = airMap(s).get(id);
      u.g.position.set(x, air ? air[2] / 10 : unitY(x, z), z);
      u.g.rotation.y = team ? 0 : Math.PI;
      V.units.set(id, u);
      if (prev && hen) {
        // Hühnerarmee: thirty at once – a feather burst each, only a few cackles
        puff(x, u.g.position.y + 0.6, z, 0xffffff, 5, 0.7);
        u.g.scale.setScalar(0.01);
        u.pop = 0;
        if (id % 6 === 0) SFX.play('chicken', { x, z, vol: 0.7 });
      } else if (prev) {
        puff(x, u.g.position.y + 0.6, z, 0xf6f1e7, 4);
        if (Math.random() < 0.35) say(u, QUOTES[u.k].spawn);
        if (KINDS[u.k].spec) specTip(u);
        if (!KINDS[u.k].bear && !KINDS[u.k].worm && !air) {
          u.g.scale.setScalar(0.01);
          u.pop = 0;
        }
        SFX.play('spawn', { x, z, vol: 0.55 });
        if (u.k === 4 && Math.random() < 0.6) SFX.play('goat', { x, z });
        if (u.k === 5 && Math.random() < 0.6) SFX.play('horn', { x, z });
      }
    }
    const pe = prev && prev.get(id);
    const poss = (e[7] & 1) === 1;
    setPossessedLook(u, poss);
    u.yawNet = poss ? e[9] / 100 : null;
    u.rage = poss && e[10] === 1;
    u.spcd = poss ? e[11] / 10 : 0;
    u.spm = poss && e[12] === 1;
    u.dancing = (e[7] & 8) === 8;
    const ch = (e[7] & 16) === 16;
    if (ch !== !!u.chick) setChicken(u, ch, u.hen);
    u.bitten = (e[7] & 4) === 4;
    if (e[7] & 32 && !(pe && pe[7] & 32)) {
      const nearPad = (MAP.pads || []).some(pd => Math.hypot(pd.x - e[2] / 10, pd.z - e[3] / 10) < 3.5);
      u.jDur = nearPad ? PAD_FLY : 0.9;
      u.jumpT = u.jDur;
      if (!nearPad) SFX.play('boing', { x: u.g.position.x, z: u.g.position.z });
    }
    if (V.poss && V.poss.id === id) {
      const dz2 = (e[7] & 8) === 8;
      if (dz2 && !V.poss.dance)
        egoHint(
          matchMedia('(pointer:fine)').matches
            ? TR('Kein Entkommen! {0} oder Klick für Tanzmoves!', kl('attack'))
            : TR('Kein Entkommen! Tippe den Tanz-Knopf für Tanzmoves!'),
          2600
        );
      V.poss.dance = dz2;
      $('#egoExit').classList.toggle('locked', dz2);
    }
    if (V.poss && V.poss.id === id) {
      const dn = (e[7] & 2) === 2;
      if (dn && !V.poss.down) {
        egoHint(TR('Umgehauen! Gleich stehst du wieder auf …'), 1600);
        V.poss.dashT = 0;
      }
      V.poss.down = dn;
      const sx = e[2] / 10,
        sz = e[3] / 10,
        os = V.poss.srv;
      if (!os || Math.abs(os.x - sx) + Math.abs(os.z - sz) > 0.05) V.poss.srvT = now();
      V.poss.srvS = now();
      V.poss.srv = { x: sx, z: sz };
      V.poss.srvN = s.ia ? s.ia[V.myTeam] : undefined; // which of our input packets this position answers
    }
    if (pe && e[7] >> 8 !== pe[7] >> 8 && e[7] & 2) startRagdoll(u, pe[2] / 10, pe[3] / 10);
    u.frenzy = (e[7] & 64) === 64;
    u.slowed = (e[7] & 128) === 128;
    if (pe) {
      if (e[6] !== pe[6]) onAttack(u, e[5], cur, poss);
      if (e[4] < pe[4]) {
        u.wobV += (Math.random() < 0.5 ? -1 : 1) * (1 + (pe[4] - e[4]) * 0.05);
        u.flash = 0.15;
        u.flinch = 0.2;
        u.hitV = (u.hitV || 0) + 2 + Math.min(3, (pe[4] - e[4]) * 0.08);
        emitFX('hit', u.g.position.x, u.g.position.y + 1, u.g.position.z, {
          dx: -Math.sin(u.g.rotation.y),
          dz: -Math.cos(u.g.rotation.y),
          n: 3,
          size: 0.4,
        });
        if (!u.arm && Math.random() < 0.14) SFX.play('grunt', { x: u.g.position.x, z: u.g.position.z, vol: 0.7, k: u.k });
      }
      if (((poss && pe[7] & 1) || (!poss && (u.k === 0 || u.k === 2))) && e[8] !== pe[8]) onSpecial(u, cur); // perk whirls and rages of ordinary units too
    }
    u.hpPct = e[4];
    // the newest states (16-sim-fass-falle.js): burning, a lit fuse, caught in a trap, a catapult with a Feuerfass in it, a trap in the hand
    u.burning = (e[7] & 65536) === 65536;
    u.fuseOn = (e[7] & 131072) === 131072;
    u.trapped = (e[7] & 262144) === 262144;
    u.snag = (e[7] & 2097152) === 2097152; // (held a moment by a jaw of the Fallenleger's row, not in a trap)
    u.fassLoaded = (e[7] & 524288) === 524288;
    if (u.k === 13) u.trapC = (e[7] & 1048576) === 1048576; // (his throw is told by the trap that flies off, trapTick)
    if (V.poss && V.poss.id === id) {
      if (u.trapped && !u.snag && !V.poss.trap)
        egoHint(
          COARSE ? TR('In der Falle! Tippe Angriff, um dich loszureißen!') : TR('In der Falle! Drück Angriff, um dich loszureißen!'),
          2000
        );
      V.poss.trap = u.trapped;
      if (u.burning && !V.poss.burning) egoHint(TR('Du brennst! Spring ins Wasser, dann ist es sofort aus.'), 1800);
      V.poss.burning = u.burning;
      V.poss.fuse = u.fuseOn;
    }
  }
  xeProcess(s); // explosions, the chicken's dive, snapping traps, a Feuerfass climbing into a catapult
  if (s.ge && s.ge.length) {
    for (const e of s.ge) {
      if (V.geSeen !== undefined && (e[0] - V.geSeen + 10000) % 10000 === 0) continue;
      if (V.geSeen !== undefined && (e[0] - V.geSeen + 10000) % 10000 > 5000) continue;
      if (V.geSeen !== undefined && e[1] === V.myTeam && V.poss) {
        if (e[2] > 0) {
          V.discoUntil = now() + 8000;
          egoHint(e[2] > 1 ? TR('{0} Gegner tanzen!', e[2]) : TR('Volltreffer, einer tanzt!'), 1600);
          profEvent('dance', e[2]);
        } else {
          SFX.play('flop');
          egoHint(TR('Daneben … keiner tanzt.'), 1400);
        }
      }
      V.geSeen = e[0];
    }
  } else if (V.geSeen === undefined) V.geSeen = 0;
  if (s.kf && s.kf.length) {
    for (const e of s.kf) {
      if (V.kfSeen === undefined) {
        V.kfSeen = e[0];
        continue;
      }
      const df = (e[0] - V.kfSeen + 10000) % 10000;
      if (df === 0 || df > 5000) continue;
      V.kfSeen = e[0];
      killFeed(e, s);
    }
  } else if (V.kfSeen === undefined) V.kfSeen = 0;
  if (s.kc && s.kc.length) {
    for (const e of s.kc) {
      if (V.kcSeen === undefined) {
        V.kcSeen = e[0];
        continue;
      }
      const df = (e[0] - V.kcSeen + 10000) % 10000;
      if (df === 0 || df > 5000) continue;
      V.kcSeen = e[0];
      const x = e[2] / 10,
        z = e[3] / 10,
        mine = e[1] === V.myTeam;
      if (!mine && FOG.on && !fogSeen(x, z)) continue;
      word(mine ? TR('KONTER!') : TR('GEKONTERT!'), x, groundY(x, z) + 3.4, z, {
        color: mine ? '#9fe8b8' : '#ff8a7a',
        scale: mine ? 1.05 : 0.9,
      });
      emitFX('hit', x, groundY(x, z) + 1.2, z, { n: 5, size: 0.6, col: mine ? 0x9fe8b8 : 0xff6a4a });
      const L = listenerPos();
      if (Math.hypot(x - L.x, z - L.z) < (V.poss ? 30 : 60)) SFX.play('konter', { x, z, vol: mine ? 0.8 : 0.5 });
    }
  } else if (V.kcSeen === undefined) V.kcSeen = 0;
  if (s.cb) {
    const c = s.cb[V.myTeam];
    if (V.poss) {
      if (V.cbS === undefined) V.cbS = c[1];
      if (c[1] !== V.cbS) {
        V.cbS = c[1];
        SFX.play('combo', { vol: 1 });
        egoHint(TR('KOMBO ×3 – Spezialfähigkeit sofort wieder bereit!'), 2200);
        profEvent('combo');
        word(TR('KOMBO ×3!'), V.poss.x, unitY(V.poss.x, V.poss.z) + 5, V.poss.z, { color: '#ffd34d', scale: 1.5 });
        shake(0.2);
        V.cbN = 0;
      } else if (c[0] !== V.cbN) {
        V.cbN = c[0];
        if (c[0] >= 1 && c[2] > 0) {
          egoHint(
            3 - c[0] === 1
              ? TR('Kombo ×{0} – noch 1 Kill in {1} s = Spezial sofort bereit', c[0], Math.ceil(c[2]))
              : TR('Kombo ×{0} – noch {1} Kills in {2} s = Spezial sofort bereit', c[0], 3 - c[0], Math.ceil(c[2])),
            1800
          );
        }
      }
    } else V.cbS = c[1];
  }
  if (s.dz && s.dz.length) {
    const m = V.dzCause || (V.dzCause = new Map());
    for (const d of s.dz) m.set(d[1], d);
    if (m.size > 200) m.clear();
  }
  if (prev)
    for (const [id] of prev)
      if (!cur.has(id)) {
        if (V.poss && V.poss.id === id && V.latest && V.latest !== s && unitMap(V.latest).has(id)) {
          cur.set(id, prev.get(id));
          continue;
        }
        const u = V.units.get(id);
        if (!u) continue;
        if (s.gn && s.gn.includes(id)) {
          goneQuiet(u, id); // climbed into a catapult: no death
          continue;
        }
        for (const [aid, ae] of cur)
          if (ae[5] === id) {
            const au = V.units.get(aid);
            if (au && au.atkT < 1.4 && !au.isPoss && Math.random() < 0.7) au.cheerT = 1.1;
          } // whoever just felled it cheers
        V.units.delete(id);
        V.selected.delete(id);
        u.dieT = 0;
        u.hp.visible = false;
        u.ring.visible = false;
        if (u.cdSp) u.cdSp.visible = false;
        V.dying.push(u);
        const terminal = V.dzCause && V.dzCause.get(id),
          dc = terminal ? terminal[2] : 0;
        if (V.dzCause) V.dzCause.delete(id);
        if (terminal && terminal.length >= 6) {
          u.g.position.set(terminal[3] / 10, terminal[4] / 10, terminal[5] / 10);
          u.fallY = undefined;
          if ((dc === 3 && terminal[4] / 10 > unitY(terminal[3] / 10, terminal[5] / 10) + 0.25) || dc === 5 || dc === 6)
            u.deadAir = { vx: (terminal[6] || 0) / 100, vy: (terminal[7] || 0) / 100, vz: (terminal[8] || 0) / 100 }; // (5/6: blown up)
        }
        if (
          V.poss &&
          V.lastMyHit &&
          now() - V.lastMyHit.t < 900 &&
          Math.hypot(V.lastMyHit.x - u.g.position.x, V.lastMyHit.z - u.g.position.z) < 2.5 &&
          u.team !== V.myTeam
        ) {
          SFX.play('kill', { vol: 1.1 });
          V.lastMyHit = null;
        }
        puff(u.g.position.x, u.g.position.y + 1, u.g.position.z, 0xf6f1e7, 4);
        startDeath(u, dc);
        if ((Math.random() < 0.3 || u.isPoss) && u.dv !== 'drama' && u.dv !== 'gone') say(u, QUOTES[u.k].die);
        if (V.poss && V.poss.id === id) {
          exitEgo(false);
          toast(
            u.heroOn
              ? TR('HELDENTOD! Dein Krieger hat sich dem Sandwurm geopfert.')
              : dc === 5 && u.k === 12
                ? TR('KAWUMM! Dein Feuerfass ist hochgegangen.')
                : TR('Dein Krieger ist gefallen!'),
            2800
          );
        }
      }
  if (ps) {
    for (let i = 0; i < 2; i++)
      if (s.tw[i * 2] !== ps.tw[i * 2]) {
        const tgt = V.units.get(s.tw[i * 2 + 1]);
        if (!tgt || !baseViews[i]) continue;
        const bv = baseViews[i],
          sh = bv.shooter,
          from = new THREE.Vector3();
        sh.head.getWorldPosition(from);
        from.y -= 0.3;
        const to = tgt.g.position.clone();
        to.y += 1.2;
        sh.atkT = 0;
        sh.aimYaw = Math.atan2(to.x - from.x, to.z - from.z) - bv.g.rotation.y;
        shoot(V.facs[i] === 'viking' ? 'arrow' : 'slipper', from, to, from.distanceTo(to) / CFG.towerSpeed, tgt);
        SFX.play(V.facs[i] === 'viking' ? 'bow' : 'slipper', { x: from.x, z: from.z, vol: 0.7 });
      }
    for (let i = 0; i < 2; i++)
      if (s.b[i] < ps.b[i] && baseViews[i]) {
        // a real hit (a blow, a boulder, a cake) shakes the wall and sounds; the slow crumbling of the final phase takes the hp
        // one point at a time and stays silent (a creak four times a second was the "squeak" players complained about)
        const hard = ps.b[i] - s.b[i] >= 2;
        baseViews[i].shake = hard ? 0.25 : 0.08;
        if (hard) {
          SFX.play('base', { x: BASES[i].x, z: BASES[i].z });
          if (i === V.myTeam && V.playing) baseAlarm();
        }
      }
    if (s.ru && ps.ru) for (let i = 0; i < 2; i++) if (s.ru[i] !== ps.ru[i]) rushFx(i, s.rp[i][0] / 10, s.rp[i][1] / 10);
    if (s.hq)
      for (let i = 0; i < 2; i++)
        for (const h of s.hq[i]) {
          const last = V.hqLast[i],
            dd = (h[0] - last + 1000) % 1000;
          if (dd > 0 && dd < 500) {
            hitFx(i, h);
            V.hqLast[i] = h[0];
          }
        }
  }
  s.f.forEach((f, i) => updateFlag(i, f[0], f[1] / 100, ps && ps.f[i][0] !== f[0]));
  hlProcess(s);
  if (ps && V.playing && s.b[V.myTeam] < ps.b[V.myTeam] - 35) shake(0.22);
  if (ps && V.playing && !V.tut && !V.siegeTip && s.b[1 - V.myTeam] < ps.b[1 - V.myTeam]) {
    V.siegeTip = true;
    if (!s.u.some(e => teamOfKind(e[1], s.fa) === V.myTeam && KINDS[e[1]].role === 'siege'))
      setTimeout(() => toast(TR('Tipp: Basen halten viel aus. Nur Katapulte treffen sie mit voller Wucht.'), 4200), 600);
  }
  V.prevMap = cur;
  V.prevSnap = s;
}
const HIT_SFX = { 0: 'axe', 2: 'stick', 4: 'buttHit', 5: 'scooterHit', 8: 'bearHit', 9: 'bearHit', 12: 'bonk', 13: 'stick' },
  SP_SFX = { 0: 'rage', 1: 'volley', 2: 'spin', 3: 'teethFan', 4: 'whoosh', 5: 'motor', 12: 'fuse', 13: 'trapSet' };
const KF_WEAPON = {
    0: TR('Axt'),
    1: TR('Pfeil'),
    2: TR('Stock'),
    3: TR('Gebiss'),
    4: TR('Bock'),
    5: TR('E-Mobil'),
    6: TR('Fels'),
    7: TR('Torte'),
    8: TR('Pranke'),
    9: TR('Pranke'),
    10: TR('Maul'),
    11: TR('Maul'),
    12: TR('Fass'),
    13: TR('Falle'),
  },
  KF_CAUSE = {
    14: TR('gesprengt'),
    15: TR('verbrannt'),
    16: TR('in die Falle getappt'),
    11: TR('verschlungen'),
    12: TR('gebissen'),
    13: TR('Heldentod'),
    1: TR('plattgewalzt'),
    2: TR('gerammt'),
    3: TR('abgestürzt'),
    4: TR('Kopfschuss'),
    5: TR('Turm'),
    6: TR('erfroren'),
    7: TR('umgekegelt'),
    8: TR('Felsbrocken'),
    9: TR('Eisbär'),
    10: TR('Kaktus'),
  };
function killFeed(e, s) {
  const el = $('#killFeed');
  if (!el || !V.playing) return;
  const vk = e[1],
    vt = teamOfKind(vk, s.fa),
    kt = e[2],
    ak = e[3],
    cause = e[4],
    ego = e[5] === 1;
  const col = t => (t < 0 ? '#ddd' : t === V.myTeam ? '#9fe8b8' : '#ff8a7a');
  const who =
      ak >= 0
        ? KINDS[ak].name
        : cause === 11 || cause === 12 || cause === 13
          ? TR('Sandwurm')
          : kt >= 0
            ? FAC[V.facs[kt]].name
            : TR('Die Welt'),
    how = cause === 0 ? KF_WEAPON[ak] || TR('Treffer') : KF_CAUSE[cause] || '';
  const d = document.createElement('div');
  d.className = 'kl' + (ego ? ' ego' : '');
  d.innerHTML =
    '<span style="color:' +
    col(kt) +
    '">' +
    who +
    '</span><span class="how">· ' +
    how +
    ' ·</span><span style="color:' +
    col(vt) +
    '">' +
    KINDS[vk].name +
    (ego ? ' ★' : '') +
    '</span>';
  el.appendChild(d);
  requestAnimationFrame(() => d.classList.add('on'));
  while (el.children.length > 4) el.firstChild.remove();
  setTimeout(
    () => {
      d.classList.add('out');
      setTimeout(() => d.remove(), 300);
    },
    ego ? 6500 : 4500
  );
}
function onAttack(u, at, cur, poss) {
  const K = KINDS[u.k],
    own = V.poss && V.poss.id === u.id,
    melee = (K.role === 'melee' || K.role === 'cav') && !K.bear && !K.worm;
  if (own && (melee || K.role === 'ranged')) return; // the own blow / shot already started on this screen (51-ego.js), with its sound
  u.atkT = 0;
  u.av = u.avN ?? pickAv(u);
  u.avN = pickAv(u); // the arm already comes back up into the next blow
  if (K.spec === 'trap') {
    // the Fallenleger rams his spade into the ground: the row of jaws itself comes as its own event (XE.fangs, 75-fass-falle-view.js)
    SFX.play('swing', { x: u.g.position.x, z: u.g.position.z, vol: poss ? 0.9 : 0.6 });
    return;
  }
  if (poss && melee) {
    // a steered enemy: his combo is read from his rhythm (the same window as the host's), so the moves and the slash match
    const base = K.cd * CFG.possCd * (K.ego || NO_EGO).cd,
      tn = now();
    u.cmbStep = (u.cmbStep || 0) < 3 && tn - (u.cmbT || -1e9) < base * CMB.win * 1000 + 150 ? (u.cmbStep || 0) + 1 : 1;
    u.cmbT = tn;
    u.ownStrike = tn;
    if (u.cmbStep === 1 || !u.seq) u.seq = comboSeq(u.k);
    u.av = u.seq[u.cmbStep - 1];
    u.avN = u.cmbStep < 3 ? u.seq[u.cmbStep] : undefined;
  }
  if (K.worm) {
    if (at === -5) {
      u.atkT = 9;
      return;
    }
    const own = V.poss && V.poss.id === u.id,
      yw = u.g.rotation.y,
      g = u.g.position;
    if (!own) {
      wormBiteFx(g.x + Math.sin(yw) * WORM.biteF, g.z + Math.cos(yw) * WORM.biteF, yw, false);
      SFX.play(at === -6 ? 'wormBite' : 'chomp', { x: g.x, z: g.z, vol: 1.1 });
    }
    return;
  } // the strike itself is told by its state
  if (at === -3) {
    SFX.play(u.k === 1 ? 'bow' : 'teeth', { x: u.g.position.x, z: u.g.position.z });
    return;
  }
  if (at === -4) {
    const e = cur.get(u.id);
    if (e && e.length > 14) {
      const tx = e[13] / 10,
        tz = e[14] / 10,
        from = u.g.position.clone();
      from.y += 3;
      const to = shellTarget(u.team, tx, tz),
        fass = !!u.fassLoaded, // a loaded catapult shoots its Feuerfass (75-fass-falle-view.js)
        pr = shoot(fass ? 'fass' : K.proj, from, to, Math.max(0.5, from.distanceTo(to) / K.pspeed) * (fass ? 1.25 : 1), null);
      SFX.play('catapult', { x: from.x, z: from.z });
      if (fass) fassShot(u, pr);
    }
    return;
  }
  let to = null,
    follow = null;
  if (at === -2) {
    const B = BASES[1 - u.team];
    to = new THREE.Vector3(B.x, groundY(B.x, B.z) + 2, B.z);
  } else if (at > 0) {
    follow = V.units.get(at);
    const te = cur.get(at);
    if (follow) {
      to = follow.g.position.clone();
      to.y += 1.2;
    } else if (te) to = new THREE.Vector3(te[2] / 10, groundY(te[2] / 10, te[3] / 10) + 1.2, te[3] / 10);
  } else if (poss && K.proj) {
    const y = u.g.rotation.y;
    to = u.g.position.clone().add(new THREE.Vector3(Math.sin(y) * K.range, 1.2, Math.cos(y) * K.range));
  }
  if (K.proj && to && K.role === 'siege' && !poss) {
    // anticipation: the arm winds back before the shot
    if (at === -2) {
      const B = BASES[1 - u.team];
      to.set(clamp(u.g.position.x, B.x - 6.6, B.x + 6.6), 0, clamp(u.g.position.z, B.z - 3.6, B.z + 3.6));
    }
    const hz = siegeImpact(u.team, u.g.position.x, u.g.position.z, to.x, to.z),
      tgt = hz.base ? new THREE.Vector3(hz.tx, hz.y, hz.tz) : new THREE.Vector3(to.x, unitY(to.x, to.z), to.z);
    u.atkT = -SIEGE_WIND;
    SFX.play('creak', { x: u.g.position.x, z: u.g.position.z, vol: 0.9 });
    const fass = !!u.fassLoaded;
    setTimeout(() => {
      if (!u.g.parent) return;
      const from = u.g.position.clone();
      from.y += 3;
      const pr = shoot(fass ? 'fass' : K.proj, from, tgt, Math.max(0.6, from.distanceTo(tgt) / K.pspeed) * (fass ? 1.25 : 1), null);
      SFX.play('catapult', { x: from.x, z: from.z });
      if (fass) fassShot(u, pr);
    }, SIEGE_WIND * 1000);
    return;
  }
  if (K.proj && to) {
    const from = u.g.position.clone();
    from.y += K.role === 'siege' ? 3 : 1.6;
    if (K.role === 'siege') {
      to = to.clone();
      to.y -= 1.0;
    }
    shoot(K.proj, from, to, from.distanceTo(to) / K.pspeed, K.role === 'siege' ? null : follow);
    SFX.play(K.role === 'siege' ? 'catapult' : u.k === 1 ? 'bow' : 'teeth', { x: from.x, z: from.z });
    return;
  }
  if (!K.proj && poss && !own && melee) {
    const g = u.g.position,
      yaw = u.yawNet ?? u.g.rotation.y + Math.PI,
      fol = {
        get x() {
          return u.g.position.x;
        },
        get z() {
          return u.g.position.z;
        },
      };
    slashFx(
      { x: g.x, z: g.z, fy: g.y, yaw, k: u.k },
      K,
      u.av,
      u.cmbStep,
      u.team === V.myTeam ? 0xffd34d : 0xff4a3d,
      (moveOf(u.k, u.av) || { W: 0.07 }).W,
      fol
    );
  } else if (!K.proj && poss && !own && !K.bear) {
    const g = u.g.position,
      yaw = u.yawNet ?? u.g.rotation.y + Math.PI;
    swingFx(
      {
        get x() {
          return u.g.position.x;
        },
        get z() {
          return u.g.position.z;
        },
        fy: g.y,
        yaw,
        rageT: u.rage ? 1 : 0,
      },
      K,
      u.team === V.myTeam ? 0xfff6dc : 0xff6a4a,
      true
    );
  }
  if (!K.proj && !poss && !K.bear && !K.worm && u.team !== V.myTeam) swooshFx(u, K); // where an enemy swing reaches: you can step out of it
  if (!K.proj)
    SFX.play(
      K.bear ? 'bearSwipe' : u.k === 2 ? 'swingR' : u.k === 5 ? 'motor' : u.k === 4 ? 'gallop' : u.k === 12 ? 'fireSwing' : 'swing',
      {
        x: u.g.position.x,
        z: u.g.position.z,
        vol: poss ? 1 : 0.7,
      }
    );
  if (!K.proj)
    setTimeout(() => {
      const p = follow ? follow.g.position : to;
      if (!p) return;
      const strong = follow && isCounter(u.k, follow.k);
      emitFX('hit', p.x, p.y + 1.2, p.z, {
        dx: p.x - u.g.position.x,
        dz: p.z - u.g.position.z,
        n: strong ? 7 : 4,
        size: strong ? 0.7 : 0.5,
      });
      SFX.play(HIT_SFX[u.k] || 'axe', { x: p.x, z: p.z });
      if ((u.k === 4 || u.k === 5) && Math.random() < 0.12) SFX.play(u.k === 4 ? 'goat' : 'hupe', { x: p.x, z: p.z });
      if ((poss || strong ? Math.random() < 0.35 : Math.random() < 0.12) && QUOTES[u.k].hit.length)
        word(pick(QUOTES[u.k].hit), p.x, p.y + 3, p.z, { color: strong ? '#ff8a5c' : undefined });
    }, 160);
}
function onSpecial(u, cur) {
  const p = u.g.position,
    K = KINDS[u.k];
  if (K.role === 'siege') {
    const e = cur.get(u.id);
    if (e && e.length > 14) {
      const tx = e[13] / 10,
        tz = e[14] / 10;
      const hqs = salvoTargets(u.team, u.g.position.x, u.g.position.z, tx, tz);
      for (let i = 0; i < 3; i++)
        setTimeout(() => {
          const hq = hqs[i],
            from = u.g.position.clone();
          from.y += 3;
          shoot(
            K.proj,
            from,
            hq.base ? new THREE.Vector3(hq.tx, hq.y, hq.tz) : new THREE.Vector3(hq.tx, unitY(hq.tx, hq.tz), hq.tz),
            0.9 * Math.max(0.5, hq.k),
            null
          );
        }, i * 250);
      SFX.play('salvo', { x: p.x, z: p.z, vol: 1.1 });
    }
    word(TR('SALVE!'), p.x, p.y + 5, p.z, { color: '#ff9b54', scale: 1.3 });
    return;
  }
  if (K.worm) {
    word(SP_WORD[u.k], p.x, p.y + 4.6, p.z, { color: '#ffd38a', scale: 1.3 });
    return;
  }
  if (K.bear) {
    word(SP_WORD[u.k], p.x, p.y + 4.8, p.z, { color: '#ffffff', scale: 1.3 });
    u.clawFx = 1.25;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      puff(p.x + Math.cos(a) * 3.6, p.y + 0.6, p.z + Math.sin(a) * 3.6, 0xffffff, 1, 0.5);
    }
    SFX.play('bearRoar', { x: p.x, z: p.z, vol: 1.2 });
    for (let i = 0; i < 5; i++)
      setTimeout(() => {
        SFX.play('impact', { x: u.g.position.x, z: u.g.position.z, vol: 0.7 });
      }, i * 180);
    return;
  }
  if (u.k === 13 && u.team !== V.myTeam) return; // an enemy trap is not announced
  word(SP_WORD[u.k], p.x, p.y + 4.6, p.z, { color: '#ff9b54', scale: 1.2 });
  SFX.play(SP_SFX[u.k] || 'special', { x: p.x, z: p.z, vol: 1.1 });
  if (u.k === 4) SFX.play('goat', { x: p.x, z: p.z });
  if (u.k === 5) {
    SFX.play('hupe', { x: p.x, z: p.z });
    SFX.play('whoosh', { x: p.x, z: p.z, vol: 0.8 });
  }
  if (u.k === 0) setTimeout(() => SFX.play('heave', { x: p.x, z: p.z, vol: 1 }), 60);
  if (u.k === 2) {
    u.spin = 0.6 + (u.isPoss ? [0, 5][tpk(u.team, 'spin')] : 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      puff(p.x + Math.cos(a) * 2.5, p.y + 0.6, p.z + Math.sin(a) * 2.5, 0xf6f1e7, 1, 0.8);
    }
  } else if (u.k === 0) puff(p.x, p.y + 1.5, p.z, 0xff5a3c, 8, 0.9);
  else if (u.k === 4 || u.k === 5) {
    if (V.poss && V.poss.id === u.id) u.dashFx = 0.5;
    else {
      stompFx(p.x, p.y, p.z, false);
      u.dashFx = 0.5;
    }
  } else if ((u.k === 1 || u.k === 3) && (u.spm || (V.poss && V.poss.id === u.id))) {
    /* manual fan: arrows come from free projectiles */
  } else if (u.k === 1) {
    const y = u.g.rotation.y;
    for (let i = -2; i <= 2; i++) {
      const a = y + i * 0.16;
      const from = p.clone();
      from.y += 1.6;
      shoot('arrow', from, p.clone().add(new THREE.Vector3(Math.sin(a) * K.range, 1, Math.cos(a) * K.range)), K.range / K.pspeed, null);
    }
  } else if (u.k === 3) {
    [...cur.values()]
      .map(e => ({ e, d: Math.hypot(e[2] / 10 - p.x, e[3] / 10 - p.z) }))
      .filter(o => teamOfKind(o.e[1], V.latest.fa) !== u.team && o.d < K.range + 1)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach((o, i) =>
        setTimeout(() => {
          const t = V.units.get(o.e[0]);
          if (!t) return;
          const from = u.g.position.clone();
          from.y += 1.6;
          const to = t.g.position.clone();
          to.y += 1.2;
          shoot('teeth', from, to, from.distanceTo(to) / K.pspeed, t);
        }, i * 120)
      );
  }
}
// Where a shell visually ends: on the base wall if the point lies on a base, otherwise on the ground.
function shellTarget(team, tx, tz) {
  const B = BASES[1 - team];
  if (B && baseGap(B, tx, tz) < 0.4) return new THREE.Vector3(tx, groundY(B.x, B.z) + 2.6, tz);
  return new THREE.Vector3(tx, unitY(tx, tz), tz);
}
