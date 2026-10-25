/* ---------- Sandworm world: wild worm views, warning rings, burst effects, sounds and the victims in its grabbers ---------- */
const WW = { views: new Map(), pool: [], maps: new WeakMap() };
const WORM_VIS_WILD = ['under', 'warn', 'strike', 'strike', 'up', 'dive', 'crawl', 'hero'],
  WORM_VIS_UNIT = ['crawl', 'under', 'warn', 'strike', 'up', 'dive', 'hero'];
function wormMaps(s) {
  let m = WW.maps.get(s);
  if (!m) {
    m = { wu: new Map(), wg: new Map() };
    for (const e of s.wu || []) m.wu.set(e[0], e);
    for (const e of s.wq || []) m.wg.set(e[0], e);
    WW.maps.set(s, m);
  }
  return m;
}
function wormApplyState(v, vis, st) {
  const W = v.wP || (v.wP = { ws: 'crawl', st: 9 });
  if (W.ws !== vis) {
    const prev = W.ws;
    W.ws = vis;
    W.st = st;
    W.from = prev;
    W.gulped = 0;
    W.grabbed = 0;
    wormStateFx(v, prev, vis);
  } else if (Math.abs(W.st - st) > (vis === 'hero' ? 0.06 : 0.3)) W.st = st; // the hero sequence is timed to the stab
}
function wormSand(x, z, n, r, size) {
  const y = groundY(x, z);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU,
      d = Math.random() * r;
    puff(
      x + Math.cos(a) * d,
      y + 0.2 + Math.random() * 0.6,
      z + Math.sin(a) * d,
      i % 3 ? 0xdcb878 : 0xc9a164,
      1,
      size * (0.7 + Math.random() * 0.6)
    );
  }
}
function wormStateFx(v, prev, vis) {
  const p = v.g.position,
    x = p.x,
    z = p.z,
    cd = Math.hypot(x - camera.position.x, z - camera.position.z),
    near = cd < 75;
  if (vis === 'warn') {
    if (near) SFX.play('rumble', { x, z, vol: 1.1 });
    const P = V.poss;
    if (P && Math.hypot(P.x - x, P.z - z) < WORM.grabR + 2.5 && !(v.team === V.myTeam)) egoHint(TR('Der Sand bebt – lauf weg!'), 1100);
  }
  if (vis === 'strike') {
    if (near) {
      sandBurst(x, z, 160, { r: 1.8, out: 6.5, up: 10, size: 0.17, life: 2.6, y: 0.3 });
      sandCrater(x, z, 2.2, 0.8, 2.6);
      wormSand(x, z, 24, 3.4, 1.5);
      emitFX('land', x, groundY(x, z) + 0.2, z, { col: 0xd9b874, n: 16, size: 1.6 });
      SFX.play('sandBurst', { x, z, vol: 1.1 });
      SFX.play('wormRoar', { x, z, vol: 1 });
    }
    if (cd < 40) shake(0.32 * (1 - cd / 40));
    v.wP.gulp = v.wP.gulpV = undefined;
  }
  if ((vis === 'dive' || vis === 'under') && prev !== 'warn' && prev !== 'under' && prev !== 'dive' && near) {
    sandBurst(x, z, 90, { r: 1.4, out: 3.8, up: 5.5, size: 0.14, life: 2.2 });
    sandCrater(x, z, 1.7, 0.6, 2.2);
    wormSand(x, z, 14, 2.6, 1.1);
    SFX.play('wormDive', { x, z, vol: 0.9 });
  }
  if (vis === 'crawl' && (prev === 'up' || prev === 'strike') && near) {
    sandBurst(x, z, 40, { r: 1.6, out: 2.5, up: 3, size: 0.13 });
    wormSand(x, z, 10, 2.2, 1);
  }
  if (vis === 'hero' && near) {
    SFX.play('wormRoar', { x, z, vol: 1 });
    if (prev === 'crawl') {
      sandBurst(x, z, 60, { r: 1.4, out: 3.5, up: 5, size: 0.14, life: 2 });
      wormSand(x, z, 12, 2.2, 1.1);
    }
  }
  if (vis === 'crawl' && prev === 'under' && near) {
    sandBurst(x, z, 80, { r: 1.4, out: 4, up: 6.5, size: 0.15, life: 2.2 });
    sandCrater(x, z, 1.6, 0.55, 2);
    wormSand(x, z, 14, 2.2, 1.1);
    SFX.play('sandBurst', { x, z, vol: 0.45 });
  }
}
const WDV = new THREE.Vector3();
function wormDigFx(v, W, dt, x, z, sp) {
  // the sand it pushes aside: ridges and dark tracks behind it, grains rolling off to both sides, sand streaming off its back
  const ws = W.ws,
    yw = v.g.rotation.y,
    fx = Math.sin(yw),
    fz = Math.cos(yw),
    rx = Math.cos(yw),
    rz = -Math.sin(yw),
    aR = -yw,
    aL = Math.PI - yw;
  const backGrains = (from, rate, up) => {
    if (!v.segs || Math.random() > dt * rate) return;
    const sg = v.segs[from + ((Math.random() * (v.segs.length - from)) | 0)];
    if (!sg || !sg.visible) return;
    sg.getWorldPosition(WDV);
    const gy = groundY(WDV.x, WDV.z);
    if (WDV.y < gy - 0.6) return;
    sandBurst(WDV.x, WDV.z, 2, { r: 0.7, out: 1.3, up, size: 0.1, y: Math.max(0.2, WDV.y - gy + 0.5), gy });
    if (Math.random() < 0.12) puff(WDV.x, gy + 0.3, WDV.z, 0xdcb878, 1, 0.8);
  };
  if (ws === 'under') {
    // a ridge of sand rolls along over it and slumps back behind
    v.plowD = (v.plowD || 0) + sp * dt;
    if (v.plowD > 0.55) {
      v.plowD = 0;
      sandRidge(x, z, yw, 0.95 + Math.random() * 0.3, 0.45 + Math.random() * 0.2, 1.25, 2.2);
      sandTrack(x, z, yw, 1.25, 1.6, 7);
      sandBurst(x + rx * 0.7, z + rz * 0.7, 3, { r: 0.3, out: 2.2, up: 1.6, a: aR, spread: 0.9, size: 0.1 });
      sandBurst(x - rx * 0.7, z - rz * 0.7, 3, { r: 0.3, out: 2.2, up: 1.6, a: aL, spread: 0.9, size: 0.1 });
    }
    if (sp > 0.3 && Math.random() < dt * 6) puff(x - fx * 0.8, groundY(x, z) + 0.25, z - fz * 0.8, 0xdcb878, 1, 0.7);
  } else if (ws === 'crawl') {
    // ploughing along the surface, half buried
    v.plowD = (v.plowD || 0) + sp * dt;
    if (v.plowD > 0.6) {
      v.plowD = 0;
      sandTrack(x - fx * 1.6, z - fz * 1.6, yw, 1.35, 1.7, 8);
      for (const sd of [1, -1]) sandRidge(x - fx * 1.2 + rx * sd * 1.15, z - fz * 1.2 + rz * sd * 1.15, yw, 0.5, 0.32, 1.0, 1.7);
    }
    if (Math.random() < dt * (5 + sp * 6)) {
      const sd = Math.random() < 0.5 ? 1 : -1;
      sandBurst(x - fx + rx * sd * 0.9, z - fz + rz * sd * 0.9, 2, {
        r: 0.3,
        out: 1.5 + sp * 0.5,
        up: 1.4,
        a: sd > 0 ? aR : aL,
        spread: 1.1,
        size: 0.1,
        y: 0.2,
      });
    }
    backGrains(2, 6 + sp * 3, 0.6);
  } else if (ws === 'up' || ws === 'hero' || (ws === 'strike' && W.st > 0.4)) {
    // sand streams off the reared-up body and churns at the rim; its back keeps ploughing behind it
    if (Math.random() < dt * 16) {
      const a = Math.random() * TAU;
      sandBurst(x + Math.cos(a) * 1.0, z + Math.sin(a) * 1.0, 1, {
        r: 0.2,
        out: 0.8,
        up: 0.3,
        a,
        spread: 0.3,
        size: 0.09,
        y: 0.8 + Math.random() * 3.2,
        yr: 0.2,
        life: 2,
      });
    }
    if (Math.random() < dt * 8) {
      const a = Math.random() * TAU;
      sandBurst(x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6, 2, { r: 0.2, out: 1.6, up: 1.2, a, spread: 0.6, size: 0.1 });
    }
    backGrains(6, 10, 1.0);
  } else if (ws === 'warn') {
    // grains hop on the trembling sand
    const R = v.isPoss ? WORM.grabRE : v.k === undefined || v.wild ? WORM.grabR : WORM.grabRT;
    if (Math.random() < dt * 40) {
      const a = Math.random() * TAU,
        r = R * Math.sqrt(Math.random());
      sandBurst(x + Math.cos(a) * r, z + Math.sin(a) * r, 1, { r: 0.1, out: 0.4, up: 2.6, size: 0.08, life: 1.2, y: 0.05 });
    }
  } else if (ws === 'dive' && W.st < 0.8) {
    // sand pours into the hole after it
    if (Math.random() < dt * 20) {
      const a = Math.random() * TAU;
      sandBurst(x + Math.cos(a) * 1.8, z + Math.sin(a) * 1.8, 1, { r: 0.2, out: -1.6, up: 0.8, a, spread: 0.4, size: 0.1, life: 1.4 });
    }
  }
}
function wormFrameFx(v, dt) {
  // per-frame sand, gulp, chomp
  const W = v.wP,
    p = v.g.position,
    x = p.x,
    z = p.z,
    near = Math.hypot(x - camera.position.x, z - camera.position.z) < 65;
  if (near && W.tame === undefined) wormDigFx(v, W, dt, x, z, v.speed || 0);
  if (W.ws === 'under' && near && Math.random() < dt * 10) wormSand(x, z, 1, 1.2, 0.7);
  if (W.ws === 'warn') {
    if (near && Math.random() < dt * 30) {
      const a = Math.random() * TAU,
        r = WORM.grabR * (0.3 + Math.random() * 0.7);
      puff(x + Math.cos(a) * r, groundY(x, z) + 0.15, z + Math.sin(a) * r, 0xdcb878, 1, 0.6);
    }
  }
  if (W.ws === 'strike') {
    if (W.st >= 0.3 && !W.grabbed) {
      W.grabbed = 1;
      if (near) SFX.play('chomp', { x, z, vol: 1.2 });
    }
    if (W.st >= 1.4 && !W.gulped) {
      W.gulped = 1;
      if (W.hadPrey) {
        W.gulp = 0; // only something caught goes down its throat
        if (near) {
          SFX.play('gulp', { x, z, vol: 1.1 });
          word(pick([TR('HAPP!'), TR('SCHLUCK!'), TR('MAHLZEIT!')]), x, groundY(x, z) + 8, z, { color: '#ffd38a', scale: 1.3 });
        }
      }
    }
  }
  if (W.gulp !== undefined) {
    W.gulp += dt * (W.gulpV || 8);
    if (W.gulp > 13) W.gulp = W.gulpV = undefined;
  }
  if (W.gulpK > 0) W.gulpK = Math.max(0, W.gulpK - dt * 2.5); // a hero goes down slowly, and kicks
  wormAudio(v, dt, x, z);
  // the trembling ring: shows where it bursts out and how far its grabbers reach
  const warn = W.ws === 'warn',
    R = v.isPoss ? WORM.grabRE : v.k === undefined || v.wild ? WORM.grabR : WORM.grabRT;
  v.warn.visible = warn && W.tame === undefined;
  if (v.warn.visible) {
    const q = Math.min(1, W.st / (v.wild ? WORM.warn : WORM.warnT)),
      pulse = 0.5 + 0.5 * Math.sin(clock * 16);
    v.warn.position.y = 0.12;
    v.warn.rotation.y = -v.g.rotation.y;
    v.wr.scale.setScalar(R * (1.06 - 0.06 * pulse));
    v.wr.material.opacity = (0.4 + 0.45 * q) * (0.65 + 0.35 * pulse);
    v.wd.scale.setScalar(R * (0.4 + 0.6 * q));
    v.wd.material.opacity = 0.12 + 0.28 * q;
  }
}
/* the worm's voice. Roaming under the sand it is only a soft grinding you hear when it is close – no hiss carpet over the whole desert;
   the trembling before it strikes, the burst and the dive are the loud parts, and they carry further. A growl now and then while it is out */
const WORM_SND = {
  hero: { rumble: 0.14, sand: 0.06, sub: 0.12, pitch: 0.5 },
  under: { rumble: 0.04, sand: 0, sub: 0.035, pitch: 0.15, rs: 0.09, ss: 0, bs: 0.07 },
  warn: { rumble: 0.5, sand: 0.08, sub: 0.42, pitch: 0.35 },
  strike: { rumble: 0.28, sand: 0.2, sub: 0.2, pitch: 0.65 },
  dive: { rumble: 0.32, sand: 0.2, sub: 0.24, pitch: 0.5 },
  up: { rumble: 0.045, sand: 0.04, sub: 0.035, pitch: 0.55 },
  crawl: { rumble: 0.05, sand: 0.02, sub: 0.03, pitch: 0.35, rs: 0.09, ss: 0.06, bs: 0.05, ps: 0.2 },
};
function wormSndRange(ws) {
  return (ws === 'warn' || ws === 'strike' || ws === 'dive' || ws === 'hero' ? 48 : 30) * (V.poss ? 0.85 : 1);
}
function wormSndLevels(ws, sp, own) {
  // sp: how fast it moves (0..1.4); own: the worm you steer yourself (its grinding sits right under you, so softer)
  const b = WORM_SND[ws] || WORM_SND.crawl,
    m = own ? 0.6 : 1;
  return {
    rumble: (b.rumble + (b.rs || 0) * sp) * m,
    sand: (b.sand + (b.ss || 0) * sp) * m,
    sub: (b.sub + (b.bs || 0) * sp) * m,
    pitch: b.pitch + (b.ps || 0) * sp,
  };
}
function wormAudio(v, dt, x, z) {
  const W = v.wP,
    L = listenerPos(),
    d = Math.hypot(x - L.x, z - L.z),
    ws = W.ws,
    R = wormSndRange(ws);
  if (d > R + (v.aLoop ? 4 : 0) || !v.g.parent || !V.playing || (W.tame !== undefined && W.tame > BEAR_COLLAPSE)) {
    if (v.aLoop) {
      v.aLoop.stop();
      v.aLoop = null;
    }
    return;
  }
  if (!v.aLoop) v.aLoop = SFX.loop('worm');
  if (!v.aLoop) return;
  const p = wormSndLevels(ws, clamp((v.speed || 0) / 4, 0, 1.4), !!(v.isPoss && V.poss && V.poss.id === v.id));
  v.aLoop.set(x, z, p, R);
  if ((ws === 'up' && d < 40) || (ws === 'crawl' && d < 26)) {
    v.growlT = (v.growlT ?? 2 + Math.random() * 3) - dt;
    if (v.growlT <= 0) {
      v.growlT = ws === 'up' ? 2.5 + Math.random() * 3 : 7 + Math.random() * 8;
      SFX.play('wormGrowl', { x, z, vol: 0.8 });
    }
  }
}
function wormBiteFx(x, z, yaw, mine) {
  // the maw slams into the sand: grains fly, dust, a fading bite mark
  sandBurst(x, z, mine ? 34 : 22, { r: 1.2, out: 3.2, up: 3.8, size: 0.12, life: 1.6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    puff(x + Math.cos(a) * 1.4, groundY(x, z) + 0.2, z + Math.sin(a) * 1.4, 0xdcb878, 1, 0.7);
  }
  sandTrack(x, z, yaw, WORM.biteR * 0.8, WORM.biteR * 0.8, 3);
  if (mine) aoeRing(x, z, WORM.biteR, 0xffb060);
}
function wormEgoRing(P) {
  // while the ego worm swims under the sand: how far its burst will reach; the special button says what it does next
  const worm = !!(P && KINDS[P.k].worm),
    on = worm && !!P.tun;
  if (worm) {
    const sn = $('#spName'),
      want = on ? TR('Auftauchen') : TR('Eingraben');
    if (sn && sn.textContent !== want) sn.textContent = want;
    $('#egoSp').classList.toggle('emerge', on);
  }
  if (!EG.wRing) {
    if (!on) return;
    EG.wRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: lin(0xffb060), transparent: true, opacity: 0.5, depthWrite: false })
    );
    EG.wRing.renderOrder = 6;
    scene.add(EG.wRing);
  }
  EG.wRing.visible = on;
  if (!on) return;
  const pl = 0.5 + 0.5 * Math.sin(clock * 6);
  EG.wRing.position.set(P.x, groundY(P.x, P.z) + 0.12, P.z);
  EG.wRing.scale.setScalar(WORM.grabRE * (1.02 - 0.03 * pl));
  EG.wRing.material.opacity = 0.32 + 0.25 * pl;
}
function wildWormView() {
  const v = buildWorm(10);
  v.wild = true;
  v.team = undefined;
  v.band.material = lam(0xc59150);
  ubRegister(v);
  return v;
}
function wormWorldView(dt) {
  const s = V.renderSnap || V.latest;
  if (!s) return;
  const age = Math.max(0, (V.renderTime ?? s.t) - s.t),
    seen = new Set();
  for (const b of s.br || []) {
    if (!b[10]) continue;
    const id = b[6],
      x = b[0] / 10,
      z = b[1] / 10;
    seen.add(id);
    let v = WW.views.get(id);
    if (!v) {
      v = WW.pool.pop() || wildWormView();
      v.wid = id;
      v.g.position.set(x, groundY(x, z), z);
      v.g.rotation.y = b[2] / 100;
      v.wP = { ws: 'under', st: 9 };
      v.lastBite = b[15];
      v.atkT = 9;
      v.trail.length = 0;
      v.tameFx = false;
      if (!v.g.parent) scene.add(v.g);
      WW.views.set(id, v);
    }
    const ws = WORM_VIS_WILD[b[11]] || 'under',
      jump = Math.hypot(v.g.position.x - x, v.g.position.z - z) > 6;
    if (jump || ws === 'warn' || ws === 'strike') {
      v.g.position.x = x;
      v.g.position.z = z;
    } else {
      const f = Math.min(1, dt * 10);
      v.g.position.x = lerp(v.g.position.x, x, f);
      v.g.position.z = lerp(v.g.position.z, z, f);
    }
    v.g.position.y = groundY(v.g.position.x, v.g.position.z);
    v.g.rotation.y += angDiff(b[2] / 100, v.g.rotation.y) * Math.min(1, dt * (ws === 'up' ? 5 : 3));
    if (b[15] !== v.lastBite) {
      v.lastBite = b[15];
      v.atkT = 0;
      SFX.play('chomp', { x, z, vol: 1 });
      if (Math.random() < 0.4)
        word(pick([TR('SSSS!'), TR('HAPP!'), TR('ZACK!')]), x, v.g.position.y + 6.5, z, { color: '#ffffff', scale: 0.9 });
    }
    if (b[7]) {
      // beaten: it sinks, glows in the winner's colour and turns
      const team = b[8] - 1,
        F = FAC[V.facs[team] || 'viking'],
        el = Math.min(BEAR_TAME, (b[7] - 1) / 100 + age);
      v.wP.tame = el;
      v.band.material = lam(F.col);
      if (el >= BEAR_COLLAPSE && !v.tameFx) {
        v.tameFx = true;
        emitFX('tame', x, v.g.position.y + 2, z, { col: F.col, n: 14 });
        SFX.play('capture', { x, z, vol: 0.5 });
      }
      if (!v.aura) {
        v.aura = new THREE.Sprite();
        v.aura.renderOrder = 6;
        v.g.add(v.aura);
      }
      v.aura.visible = el >= BEAR_COLLAPSE;
      v.aura.material = spriteMat('bearTame' + (F === FAC.viking ? 'V' : 'R'), () => tameHeartCanvas(F.css)).mat;
      v.aura.scale.setScalar(3.4 + Math.sin(el * 14) * 0.25);
      v.aura.position.y = 4.5;
    } else {
      v.wP.tame = undefined;
      if (v.aura) v.aura.visible = false;
      v.band.material = lam(0xc59150);
    }
    wormApplyState(v, ws, b[12] / 100 + age);
    v.speed = b[4] ? (b[4] === 2 ? WORM.speed : 2.6) : 0;
    wormRig(v, dt, !!b[4]);
    wormFrameFx(v, dt);
    const hpP = b[5] ?? 100,
      W = v.wP;
    if ((W.ws === 'up' || W.ws === 'crawl') && !b[7] && V.playing && !V.tut) {
      // tell the player once in a while that it can be beaten and tamed
      const P = V.poss,
        d = P ? Math.hypot(P.x - x, P.z - z) : Math.hypot(camS.x - x, camS.z - z);
      if (d < (P ? 16 : 26) && now() - (WW.hintT || -1e9) > (P ? 25000 : 60000)) {
        WW.hintT = now();
        if (P) egoHint(TR('Sandwurm verwundbar! Besiege ihn, dann kämpft er für dich.'), 2400);
        else toast(TR('Ein Sandwurm! Besiegt ihn, solange er aus dem Sand ragt – dann kämpft er für euch.'), 3200);
      }
    }
    v.hp.visible = hpP < 100 && W.ws !== 'under' && W.ws !== 'warn' && !b[7] && fogSeen(x, z);
    if (v.hp.visible) {
      v.hp.position.set(v.g.position.x, v.g.position.y + v.hpY, v.g.position.z);
      v.hp.quaternion.copy(camera.quaternion);
      v.hpf.scale.x = Math.max(0.01, hpP / 100);
    }
  }
  for (const [id, v] of WW.views)
    if (!seen.has(id)) {
      if (v.aLoop) {
        v.aLoop.stop();
        v.aLoop = null;
      }
      if (v.wP && v.wP.tame !== undefined) wormSand(v.g.position.x, v.g.position.z, 12, 2.4, 1);
      scene.remove(v.g);
      v.hp.visible = false;
      if (v.aura) v.aura.visible = false;
      v.held = null;
      WW.views.delete(id);
      WW.pool.push(v);
    }
}
function clearWormViews() {
  for (const [id, v] of WW.views) {
    if (v.aLoop) {
      v.aLoop.stop();
      v.aLoop = null;
    }
    scene.remove(v.g);
    v.hp.visible = false;
    WW.pool.push(v);
  }
  WW.views.clear();
}
// victims: hauled up by a grabber, kicking, until the maw snaps shut
function grabTick(dt) {
  const s = V.renderSnap || V.latest;
  if (!s) return;
  const wg = wormMaps(s).wg,
    age = Math.max(0, (V.renderTime ?? s.t) - s.t);
  for (const v of WW.views.values()) v.held = null;
  for (const u of V.units.values()) if (u.worm) u.held = null;
  for (const [id, e] of wg) {
    const W = e[1] < 0 ? WW.views.get(-e[1] - 1) : V.units.get(e[1]);
    if (W && W.tips) (W.held || (W.held = []))[e[2] % 4] = true;
  }
  const P = V.poss;
  if (P) {
    const myW = KINDS[P.k].worm && wormMaps(s).wu.get(P.id),
      was = P.tun;
    P.tun = !!(myW && myW[1] === 1);
    P.held = wg.has(P.id) || !!(myW && myW[1] >= 2);
    if (P.tun && !was) {
      P.tunHint = 0;
      if (!EG.tunTold) {
        EG.tunTold = true;
        egoHint(TR('Unter dem Sand! Steuere zu den Gegnern – nochmal Spezial: auftauchen und alle im Kreis verschlingen'), 3200);
      }
    }
  }
  for (const u of V.units.values()) {
    const e = wg.get(u.id);
    if (!e) {
      if (u.wasGrab) {
        u.wasGrab = false;
        u.rig.rotation.set(0, 0, 0);
        u.rig.position.set(0, 0, 0);
      }
      continue;
    }
    const W = e[1] < 0 ? WW.views.get(-e[1] - 1) : V.units.get(e[1]);
    if (!W || !W.tips) continue;
    if (!u.wasGrab) {
      u.wasGrab = true;
      u.grabY = u.g.position.y;
      if (Math.random() < 0.7 || u.isPoss)
        word(pick([TR('HILFE!'), TR('AAAH!'), TR('LASS LOS!'), TR('NEEEIN!')]), u.g.position.x, u.g.position.y + 2.6, u.g.position.z, {
          color: '#ffffff',
          scale: 0.9,
        });
      SFX.play('grunt', { x: u.g.position.x, z: u.g.position.z, k: u.k });
      if (P && P.id === u.id) {
        egoHint(TR('GEPACKT! Der Sandwurm hat dich in den Greifern …'), 1600);
        EG.kick = Math.max(EG.kick, 0.4);
      }
    }
    const st = W.wP ? W.wP.st : 0,
      gulped = W.wP && W.wP.ws === 'strike' && st >= 1.4;
    if (gulped) {
      u.g.visible = false;
      continue;
    }
    W.g.updateMatrixWorld(true);
    if (e[2] < 4 || !W.neck) W.tips[e[2] % 4].getWorldPosition(WV3.b);
    else {
      W.neck.getWorldPosition(WV3.b);
      const a = e[2] * 2.4;
      WV3.b.x += Math.cos(a) * 0.9;
      WV3.b.z += Math.sin(a) * 0.9;
      WV3.b.y += 0.8;
    } // more than four: hauled straight into the maw
    const k = sstep(0.26, 0.42, W.wP && W.wP.ws === 'strike' ? st : e[3] / 100 + age + 0.3),
      gx = u.g.position.x,
      gz = u.g.position.z,
      gy = u.grabY ?? u.g.position.y;
    u.g.position.set(lerp(gx, WV3.b.x, k), lerp(gy, WV3.b.y - 1.15, k), lerp(gz, WV3.b.z, k));
    const fl = clock * 13 + u.id;
    u.rig.rotation.set(-0.5 * k + Math.sin(fl * 0.7) * 0.15, 0, Math.sin(fl * 0.5) * 0.35 * k);
    if (u.armL) {
      u.armL.rotation.x = -2.7 + Math.sin(fl) * 0.45;
      u.armR.rotation.x = -2.5 + Math.cos(fl * 1.1) * 0.45;
      u.armL.rotation.z = -0.4;
      u.armR.rotation.z = 0.4;
    }
    if (u.legL) {
      u.legL.rotation.x = Math.sin(fl * 1.3) * 0.7;
      u.legR.rotation.x = -Math.sin(fl * 1.3) * 0.7;
    }
    if (u.shinL) {
      u.shinL.rotation.x = 0.4 + Math.max(0, Math.sin(fl * 1.3)) * 0.8;
      u.shinR.rotation.x = 0.4 + Math.max(0, -Math.sin(fl * 1.3)) * 0.8;
    }
  }
}
