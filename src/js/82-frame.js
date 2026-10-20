/* 82-frame.js - THE FRAME: frame() runs once per display frame (requestAnimationFrame): interpolates the snapshot buffer (renderUnits), runs all view ticks,
   camera, HUD, sound levels, then renders. Order matters here. */
function frame() {
  requestAnimationFrame(frame);
  if (QS.cap) {
    const pn = performance.now();
    if (pn - QS.lastDraw < 1000 / QS.cap - 4) return;
    QS.lastDraw = pn;
  } // 30-fps cap: skip every other vsync for even frame pacing
  const t = now(),
    rawDt = (t - lastFrame) / 1000,
    dt = Math.min(0.1, rawDt);
  lastFrame = t;
  clock += dt;
  if (rawDt < 1) perfTick(rawDt);
  QS.frameT0 = performance.now();
  QS.fr++;
  const pf = PROF.on;
  if (pf) {
    PROF.p0 = performance.now();
    PROF.frames++;
    PROF.ft.push(rawDt * 1000);
    PROF.worst = Math.max(PROF.worst, rawDt * 1000);
  }
  if (V.mode === 'menu') {
    SFX.amb(null);
    camS.yaw = Math.PI + Math.sin(clock * 0.1) * 0.3;
    applyCam();
    menuUnits.forEach((u, i) => {
      u.atkT = (clock * 0.8 + i * 0.9) % 2.4;
      animateRig(u, dt, false, false);
    });
  } else {
    if (V.ending) endingTick(dt);
    else if (V.poss) {
      let rem = Math.min(rawDt, 0.3);
      do {
        const d = Math.min(rem, 0.1);
        egoUpdate(d);
        rem -= d;
      } while (rem > 1e-3 && V.poss);
    } // below 10 fps the own unit still moves at real speed (sub-steps of max 0.1 s)
    else {
      let mx = 0,
        mz = 0;
      if (held('fwd')) mz -= 1;
      if (held('back')) mz += 1;
      if (held('left')) mx -= 1;
      if (held('right')) mx += 1;
      if (!COARSE && SET.edge !== false && EDGE.on && !gest && $('#pause').hidden) {
        const m = EDGE.hud ? 6 : 52,
          ex = EDGE.x,
          ey = EDGE.y,
          W2 = innerWidth - 1,
          H2 = innerHeight - 1,
          st = d => 0.25 + 0.5 * (1 - d / m);
        if (ex <= m) mx -= st(ex);
        else if (ex >= W2 - m) mx += st(W2 - ex);
        if (ey <= m) mz -= st(ey);
        else if (ey >= H2 - m) mz += st(H2 - ey);
      }
      if (mx || mz) {
        const c = Math.cos(camS.yaw),
          s = Math.sin(camS.yaw),
          sp = camS.dist * 0.9 * dt;
        camS.x += (mx * c + mz * s) * sp;
        camS.z += (-mx * s + mz * c) * sp;
      }
      applyCam();
      if (TUT.on) tutCamTick(dt);
    }
    if (pf) pm('ctl');
    SFX.music(!!(V.playing && V.poss && (V.poss.dance || now() < (V.discoUntil || 0))));
    SFX.amb(V.playing && MAP ? MAP.type : null);
    if (!V.playing) SFX.stopLoops();
    renderUnits(t, dt);
    if (pf) pm('units');
    updateWorld(dt);
    wormWorldView(dt);
    grabTick(dt);
    heroTick();
    fogGuidesTick();
    fogFeetTick();
    wormEgoRing(V.poss);
    padAnim(dt);
    clawTick(dt);
    swingTick(dt);
    swooshTick(dt);
    updateFreeArrows(dt);
    updateFireballs(dt);
    updateGrenades(dt);
    updateRolls(dt);
    updateGoo(dt);
    debrisTick(dt);
    siegeWarnTick();
    hlTick(dt);
    if (V.homeRings) {
      const vis = !!(V.latest && V.latest.ph && V.latest.ph[0] === 0);
      V.homeRings.forEach(m => (m.visible = vis));
    }
    if (pf) pm('world');
  }
  flagViews.forEach((F, i) => {
    const pos = F.cloth.geometry.attributes.position,
      a = pos.array;
    for (let v = 0; v < a.length; v += 3) {
      const x = F.base[v];
      a[v + 2] = Math.sin(clock * 5 + x * 2.2 + i) * 0.12 * x;
    }
    pos.needsUpdate = true;
  });
  waterClock.value = clock;
  windClock.value = clock;
  water.position.y = (MAP && MAP.lift ? -9.7 : WL) + Math.sin(clock * 0.8) * 0.035;
  for (const c of clouds) {
    c.position.x += dt * 1.6;
    if (c.position.x > 140) c.position.x = -140;
  }
  if (mapGroup && MAP && MAP.lift && QS.deco !== false)
    for (const o of mapGroup.children) {
      const md = o.userData.mist;
      if (md) {
        o.position.x = md.x + Math.sin(clock * 0.25 + md.ph) * 2.2;
        o.position.z = md.z + Math.cos(clock * 0.2 + md.ph) * 1.4;
        o.material.opacity = 0.55 + 0.25 * Math.sin(clock * 0.5 + md.ph);
        o.updateMatrix();
      }
    }
  baseViews.forEach((b, i) => {
    if (b.shooter) {
      const sh = b.shooter;
      if (sh.aimYaw !== undefined) {
        const d = angDiff(sh.aimYaw, sh.g.rotation.y);
        sh.g.rotation.y += d * Math.min(1, dt * 10);
      }
      animateRig(sh, dt, false, sh.atkT < 1.5);
    }
    if (b.shake > 0) {
      b.shake -= dt;
      b.g.position.x = BASES[i].x + Math.sin(clock * 70) * 0.12 * (b.shake / 0.25);
    } else b.g.position.x = BASES[i].x;
    const hp = V.latest ? V.latest.b[i] : CFG.baseHp;
    if (V.mode !== 'menu' && hp < CFG.baseHp * 0.5) {
      b.smokeT -= dt;
      if (b.smokeT <= 0) {
        b.smokeT = hp < CFG.baseHp * 0.25 ? 0.15 : 0.4;
        puff(BASES[i].x + (Math.random() - 0.5) * 6, b.y + 5.5, BASES[i].z, 0x555555, 1, 1.4);
      }
    }
  });
  if (pf) pm('scene');
  puffTick(dt);
  sandTick(dt);
  rippleTick(dt);
  for (let i = fx.projs.length - 1; i >= 0; i--) {
    const p = fx.projs[i];
    p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    if (p.follow && V.units.has(p.follow.id)) p.to.set(p.follow.g.position.x, p.follow.g.position.y + 1.2, p.follow.g.position.z);
    const prev = fxPrev.copy(p.m.position);
    p.m.position.lerpVectors(p.from, p.to, k);
    p.m.position.y += Math.sin(k * Math.PI) * p.arc;
    if (p.kind === 'arrow') {
      if (prev.distanceToSquared(p.m.position) > 1e-6) p.m.lookAt(fxAim.copy(p.m.position).multiplyScalar(2).sub(prev));
    } else {
      p.m.rotation.x += dt * 14;
      p.m.rotation.y += dt * 9;
    }
    if (k >= 1 && (p.kind === 'boulder' || p.kind === 'cake')) {
      {
        const L = listenerPos(),
          d = Math.hypot(L.x - p.to.x, L.z - p.to.z),
          R = V.poss ? 16 : 75;
        if (d < R) shake((V.poss ? 0.2 : 0.45) * (1 - d / R));
      } /* the whole screen rumbles in the overview too */
      {
        const bi = BASES.findIndex(B => baseGap(B, p.to.x, p.to.z) < 0.6);
        if (bi >= 0) {
          const c = p.kind === 'cake';
          SFX.play('crash', { x: p.to.x, z: p.to.z, vol: 1.1 });
          emitFX('explosion', p.to.x, p.to.y, p.to.z, { col: c ? 0xf6b8d0 : 0x8a6a4a, n: 22, size: 1.5 });
          for (let q = 0; q < 8; q++)
            puff(
              p.to.x + (Math.random() - 0.5) * 2,
              p.to.y + Math.random() * 1.5,
              p.to.z + (Math.random() - 0.5) * 2,
              c ? 0xffffff : 0x6b4a2e,
              1,
              0.8
            );
          if (baseViews[bi]) baseViews[bi].shake = 0.35;
          word(c ? 'SAHNE AN DER WAND!' : 'VOLLTREFFER!', p.to.x, p.to.y + 3, p.to.z, { color: '#ffcf6a', scale: 1.3 });
        }
      }
      projPut(p.m);
      const c = p.kind === 'cake';
      emitFX('explosion', p.to.x, p.to.y - 0.6, p.to.z, { col: c ? 0xf6b8d0 : 0xb9ad9a, n: 18, size: 1.3 });
      emitFX('land', p.to.x, p.to.y - 0.8, p.to.z, { col: c ? 0xffffff : 0x8a7a66, n: 8, size: 1.4 });
      word(c ? 'SPLATSCH!' : 'KRAWUMM!', p.to.x, p.to.y + 2, p.to.z, { color: c ? '#ffd6e6' : '#ffb35c', scale: 1.3 });
      SFX.play(c ? 'splat' : 'crash', { x: p.to.x, z: p.to.z, vol: 1 });
      aoeRing(p.to.x, p.to.z, 4.2 * (p.sal ? 0.8 : 1.1), c ? 0xff8fc0 : 0xffa040);
      fx.projs.splice(i, 1);
      continue;
    }
    if (k >= 1) {
      projPut(p.m);
      SFX.play(p.kind === 'arrow' ? 'arrowHit' : p.kind === 'slipper' ? 'slipHit' : p.kind === 'teeth' ? 'teethHit' : 'impact', {
        x: p.to.x,
        z: p.to.z,
        vol: 0.75,
      });
      puff(p.to.x, p.to.y, p.to.z, p.kind === 'teeth' ? 0xffffff : 0xfff1a8, 2, 0.5);
      if (p.kind === 'teeth' && Math.random() < 0.15) word('KLAPPER!', p.to.x, p.to.y + 1.6, p.to.z, { color: '#ffffff' });
      fx.projs.splice(i, 1);
    }
  }
  for (let i = fx.words.length - 1; i >= 0; i--) {
    const w = fx.words[i];
    w.t += dt;
    const k = w.t / w.life;
    if (w.follow && w.follow.g.parent) {
      w.s.position.x = w.follow.g.position.x;
      w.s.position.z = w.follow.g.position.z;
      w.y0 = w.follow.g.position.y + 4 + (w.follow.isPoss ? 1.2 : 0);
    }
    w.s.position.y = w.y0 + (w.bubble ? 0 : k * 1.2);
    const pop = Math.min(1, w.t / 0.12),
      cd = V.poss ? w.s.position.distanceTo(camera.position) : 99,
      near = V.poss ? clamp((cd - 1.5) / 7, 0.32, 1) : 1,
      sc = (w.bubble ? 1 : 1 + 0.3 * (1 - pop)) * near; // in the ego view words right in front of the camera stay small instead of filling the screen
    w.s.scale.set(w.h * w.ar * sc * pop, w.h * sc * pop, 1);
    w.s.material.opacity = (k > 0.75 ? (1 - k) / 0.25 : 1) * (V.poss ? clamp((cd - 1.2) / 1.6, 0, 1) : 1);
    if (k >= 1) {
      scene.remove(w.s);
      w.s.material.dispose();
      fx.words.splice(i, 1);
    }
  }
  for (let i = fx.coins.length - 1; i >= 0; i--) {
    const c = fx.coins[i],
      m = c.m;
    c.t += dt;
    c.vy -= 20 * dt;
    m.position.x += c.vx * dt;
    m.position.y += c.vy * dt;
    m.position.z += c.vz * dt;
    const gy = groundY(m.position.x, m.position.z) + 0.15;
    if (m.position.y < gy) {
      m.position.y = gy;
      c.vy = Math.abs(c.vy) * 0.35;
      c.vx *= 0.6;
      c.vz *= 0.6;
      c.rx *= 0.5;
      c.ry *= 0.5;
    }
    m.rotation.x += c.rx * dt;
    m.rotation.y += c.ry * dt;
    if (c.t > c.life - 0.4) m.scale.setScalar(Math.max(0.01, (c.life - c.t) / 0.4));
    if (c.t >= c.life) {
      scene.remove(m);
      fx.coins.splice(i, 1);
    }
  }
  for (let i = V.markers.length - 1; i >= 0; i--) {
    const m = V.markers[i];
    m.t += dt;
    m.m.scale.setScalar(1 + m.t * 2.5);
    m.m.material.opacity = Math.max(0, 0.9 - m.t * 1.6);
    if (m.t > 0.6) {
      scene.remove(m.m);
      m.m.geometry.dispose();
      m.m.material.dispose();
      V.markers.splice(i, 1);
    }
  }
  if (pf) pm('fx');
  hudT -= dt;
  if (hudT <= 0 && V.mode !== 'menu') {
    hudT = 0.12;
    updateHud();
    hintTick();
    tutTick();
  }
  if (pf) pm('hud');
  if (SHAKE.a > 0.003 && V.mode !== 'menu') {
    const a = SHAKE.a;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a * 0.7;
    camera.position.z += (Math.random() - 0.5) * a;
    SHAKE.a = Math.max(0, a - dt * 1.4);
  }
  scene.updateMatrixWorld();
  contactTick();
  hpBatch();
  unitBatch();
  if (pf) pm('contact');
  if (QS.shEvery > 1 && ++QS.fc % QS.shEvery === 0) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  QS.cpuLast = performance.now() - QS.frameT0 + QS.simMs;
  QS.simMs = 0; // main-thread work this frame (render + logic + simulation)
  if (pf) {
    pm('render');
    profFlush();
  }
}
const FROST_MAT = new THREE.MeshPhongMaterial({
  color: lin(0xcff4ff),
  emissive: lin(0x2a7aa8),
  shininess: 160,
  specular: lin(0xffffff),
  flatShading: true,
  transparent: true,
  opacity: 0.85,
}); // one shared material for every frozen unit
const LODS = { fr: new THREE.Frustum(), m: new THREE.Matrix4(), center: new THREE.Vector3() };
LODS.sph = new THREE.Sphere(LODS.center, 2.2);
// One broken snapshot must not freeze the screen (every later frame would throw at the same place): report it and go on.
function snapEvents(s) {
  try {
    processSnap(s);
  } catch (e) {
    console.error('snapshot skipped', e);
  }
}
function renderUnits(t, dt) {
  camera.updateMatrixWorld();
  LODS.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  LODS.fr.setFromProjectionMatrix(LODS.m);
  if (!V.buf.length || V.offset === null) return;
  if (V.delayTarget !== undefined) V.delay += clamp(V.delayTarget - V.delay, -dt * 0.04, dt * 0.12);
  const rt = Math.min(V.buf[V.buf.length - 1].t, Math.max(V.renderTime ?? -Infinity, (t - V.offset) / 1000 - V.delay));
  V.renderTime = rt;
  for (const s of V.buf)
    if (s.t > V.evT && s.t <= rt) {
      snapEvents(s);
      V.evT = s.t;
    }
  if (V.evT < 0 && V.buf.length) {
    snapEvents(V.buf[0]);
    V.evT = V.buf[0].t;
  }
  let A = null,
    B = null;
  for (let i = V.buf.length - 1; i >= 0; i--)
    if (V.buf[i].t <= rt) {
      A = V.buf[i];
      B = V.buf[i + 1] || null;
      break;
    }
  if (!A) A = V.buf[0];
  const am = A === V.prevSnap ? V.prevMap : unitMap(A),
    bm = B ? unitMap(B) : null;
  V.renderSnap = A;
  const aa = airMap(A),
    ba = B ? airMap(B) : null;
  const k = B ? clamp((rt - A.t) / Math.max(0.001, B.t - A.t), 0, 1) : 0,
    camQ = camera.quaternion;
  for (const u of V.units.values()) {
    const ea = am.get(u.id) || (bm && bm.get(u.id));
    if (!ea) continue;
    const eb = bm && bm.get(u.id);
    let x = eb ? lerp(ea[2], eb[2], k) / 10 : ea[2] / 10,
      z = eb ? lerp(ea[3], eb[3], k) / 10 : ea[3] / 10;
    const mine = V.poss && V.poss.id === u.id;
    if (mine) {
      x = V.poss.x;
      z = V.poss.z;
    }
    u.padY = undefined;
    if (!mine) {
      const pj = (A.pj || []).find(p => p[0] === u.id);
      if (pj) {
        const elapsed = pj[5] / 100 + Math.max(0, rt - A.t),
          q = clamp(elapsed / PAD_FLY, 0, 1);
        const j = { sx: pj[1] / 10, sz: pj[2] / 10, tx: pj[3] / 10, tz: pj[4] / 10 };
        x = lerp(j.sx, j.tx, q);
        z = lerp(j.sz, j.tz, q);
        u.padY = padHeight(j, q);
        u.jumpT = 0;
        u.padK = q;
      }
    }
    const af = aa.get(u.id),
      bf = ba && ba.get(u.id),
      flight = mine ? V.poss.air : af;
    const px = u.g.position.x,
      pz = u.g.position.z,
      y =
        mine && V.poss.fy !== undefined
          ? V.poss.fy
          : af
            ? bf
              ? lerp(af[2], bf[2], k) / 10
              : eb
                ? lerp(af[2] / 10, unitY(eb[2] / 10, eb[3] / 10), k)
                : af[2] / 10
            : unitY(x, z);
    const wet = !flight && u.padY === undefined && !(mine && V.poss.pj) && inWater(x, z);
    waterMotionFX(u, x, y, z, wet, dt);
    u.dryT = wet ? 0 : (u.dryT || 0) + dt;
    u.wet = wet && !u.arm;
    const jt = mine ? V.poss.jumpT || 0 : u.jumpT || 0,
      jd = mine ? V.poss.jDur || 0.9 : u.jDur || 0.9;
    if (!mine && u.jumpT > 0) u.jumpT = Math.max(0, u.jumpT - dt);
    const jh = jt > 0 ? (jd > 1 ? 4 * PAD_H * (jt / PAD_FLY) * (1 - jt / PAD_FLY) : Math.sin(((jd - jt) / jd) * Math.PI) * 4.8) : 0;
    if (u.wasJ && jt <= 0) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        puff(x + Math.cos(a) * 3.4, y + 0.2, z + Math.sin(a) * 3.4, 0xd8c48f, 1, 1.2);
      }
      SFX.play('stomp', { x, z });
    }
    const airborne = !!flight || u.padY !== undefined || (mine && !!V.poss.pj);
    if (u.wasPad && !airborne) {
      emitFX(wet ? 'water' : 'land', x, y + 0.15, z, { n: 8, size: 0.7 });
      SFX.play(wet ? 'splat' : 'stomp', { x, z, vol: 0.55 });
    }
    u.wasPad = airborne;
    if (!airborne && !wet && u.speed > 3 && Math.random() < dt * (mine ? 10 : 2))
      emitFX(mine && (V.poss.dashT > 0 || tpk(V.myTeam, 'turbo')) ? 'dash' : 'dust', x, y + 0.08, z, {
        n: 1,
        size: 0.35,
        dx: -Math.sin(u.g.rotation.y),
        dz: -Math.cos(u.g.rotation.y),
      });
    u.wasJ = jt > 0;
    if (u.frenzy && Math.random() < dt * 8)
      puff(x + (Math.random() - 0.5) * 0.7, y + 1.7 + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.7, 0xff4a2a, 1, 0.32);
    if (u.slowed && Math.random() < dt * 6)
      puff(x + (Math.random() - 0.5) * 0.6, y + 0.25, z + (Math.random() - 0.5) * 0.6, 0xffb3d1, 1, 0.3);
    if (u.padY !== undefined) u.g.position.set(x, u.padY, z);
    else if (flight) u.g.position.set(x, y, z);
    else if (!mine && !u.rag && Math.hypot(u.g.position.x - x, u.g.position.z - z) < 3) {
      const f = Math.min(1, dt * 15);
      u.g.position.set(lerp(u.g.position.x, x, f), y + jh, lerp(u.g.position.z, z, f));
    } else u.g.position.set(x, y + jh, z);
    u.fogHid = FOG.on && u.team !== V.myTeam && !fogSeen(x, z); // the mesh fades in the fog by itself; its overlays (badge, rings, bars, contact shadow) are switched off
    {
      const bm = u.isPoss && !mine && u.team !== V.myTeam && !u.fogHid ? FACE.badge[u.team] : null;
      if (bm) {
        if (!u.faceSp || u.faceSp.material !== bm) {
          if (u.faceSp) u.g.remove(u.faceSp);
          u.faceSp = new THREE.Sprite(bm);
          u.faceSp.renderOrder = 5;
          u.g.add(u.faceSp);
        }
        const cd = camera.position.distanceTo(u.g.position),
          sc = clamp(cd * (V.poss ? 0.11 : 0.05), V.poss ? 2.2 : 1.6, V.poss ? 6 : 4.2) / (u.g.scale.x || 1);
        u.faceSp.visible = true;
        u.faceSp.scale.setScalar(sc);
        u.faceSp.position.set(
          0,
          ((u.worm ? u.hpY || 3.4 : KINDS[u.k].role === 'cav' ? 3.6 : KINDS[u.k].role === 'siege' ? 4.2 : 3.1) + 1.3 + 0.4) /
            (u.g.scale.x || 1) +
            sc * 0.55,
          0
        );
      } else if (u.faceSp) u.faceSp.visible = false;
    }
    updateStatusFx(u, dt, x, y, z);
    u.speed = lerp(u.speed, Math.hypot(x - px, z - pz) / Math.max(dt, 1e-3), 0.25);
    const sgR = !!u.arm,
      moving = mine ? V.poss.moving : (u.mvH = u.speed > (sgR ? 1.1 : u.mvH ? 0.45 : 1.0) && !(u.atkT < 0.9 && u.speed < 2.2));
    u.tgtBase = ea[5] === -2;
    let want = u.g.rotation.y;
    if (mine) want = V.poss.yaw;
    else if (u.isPoss && u.yawNet !== null) want = u.yawNet;
    else if (moving) want = Math.atan2(x - px, z - pz);
    else if (u.atkT < 1.2 && (ea[5] > 0 || ea[5] === -2)) {
      const tg = ea[5] === -2 ? BASES[1 - u.team] : V.units.get(ea[5]);
      if (tg) {
        const tx = tg.g ? tg.g.position.x : tg.x,
          tz = tg.g ? tg.g.position.z : tg.z;
        want = Math.atan2(tx - x, tz - z);
      }
    }
    if (!u.rag) u.g.rotation.y += angDiff(want, u.g.rotation.y) * Math.min(1, dt * (mine ? 20 : sgR ? 3.5 : 12));
    if (u.worm) wormUnitState(u, A, rt);
    {
      // animation LOD (visual only): far or off-screen units update their rig at 30 or 15 Hz, the controlled and enemy ego unit always at full rate
      const cdx = x - camera.position.x,
        cdz = z - camera.position.z,
        cd2 = cdx * cdx + cdz * cdz,
        L = QS.lod;
      LODS.center.set(x, y + 1, z);
      const skip =
        mine || u.isPoss || u.rag || airborne || u.pop !== undefined
          ? 1
          : !LODS.fr.intersectsSphere(LODS.sph)
            ? 4
            : cd2 > L[1] * L[1] * 1.6
              ? 2
              : 1;
      u.animAcc = (u.animAcc || 0) + dt;
      if (skip === 1 || (QS.fr + u.id) % skip === 0) {
        animateRig(u, Math.min(u.animAcc, 0.1), moving && !u.rag && !airborne, u.atkT < 1.5);
        u.animAcc = 0;
      }
    }
    if (u.worm && u.wP) wormFrameFx(u, dt);
    if (flight) {
      const kind = mine ? flight.kind : af[7] === 1 ? 'dash' : af[7] === 2 ? 'impact' : 'fall';
      if (kind === 'impact' && !u.wasImpact) {
        u.wasImpact = true;
        emitFX('hit', x, y + 1.1, z, { n: 6, size: 0.7 });
        SFX.play('impact', { x, z, vol: 0.9 });
        {
          const cd = Math.hypot(x - camera.position.x, z - camera.position.z);
          if (cd < 40) shake(0.22 * (1 - cd / 40) + 0.06);
        }
        if (now() - (V.rummsT || 0) > 250) {
          V.rummsT = now();
          word(pick(['RUMMS!', 'WUMMS!', 'BAMM!']), x, y + 2.6, z, { color: '#ffcf6a', scale: 1.05 });
        }
      }
      u.airPoseT = (u.airPoseT || 0) + dt;
      u.rig.rotation.x = kind === 'dash' ? 0.2 : -u.airPoseT * 5;
      u.rig.rotation.z = kind === 'dash' ? 0 : Math.sin(u.id) * u.airPoseT * 2.5;
      if (u.armL) {
        u.armL.rotation.x = -2.7 + Math.sin(clock * 16) * 0.2;
        u.armR.rotation.x = -2.5;
      }
      if (u.foreL) {
        u.foreL.rotation.x = -0.7 + Math.sin(clock * 21) * 0.5;
        u.foreR.rotation.x = -0.6 + Math.cos(clock * 19) * 0.5;
      }
      if (u.shinL) {
        u.shinL.rotation.x = 0.8 + Math.sin(clock * 18) * 0.5;
        u.shinR.rotation.x = 0.8 - Math.sin(clock * 18) * 0.5;
      }
    } else if (u.airPoseT) {
      u.airPoseT = 0;
      u.rig.rotation.set(0, 0, 0);
    }
    if (!flight) u.wasImpact = false;
    unitShadowRange(u);
    {
      const ist = WV.ic.get(u.id) || 0;
      if (ist & 1 && !u.rag && !u.arm) {
        u.slide = Math.min(1, (u.slide || 0) + dt * 6);
      } else if (u.slide) u.slide = Math.max(0, u.slide - dt * 4);
      if (u.slide > 0) {
        const q = u.slide;
        u.rig.rotation.x = -1.35 * q;
        u.rig.position.y = lerp(u.rig.position.y, 0.32, q);
        if (u.armL && !u.bear) {
          u.armL.rotation.x = lerp(u.armL.rotation.x, -3.0, q);
          u.armR.rotation.x = lerp(u.armR.rotation.x, -3.0, q);
        }
        if (u.legL) {
          u.legL.rotation.x *= 1 - q;
          u.legR.rotation.x *= 1 - q;
        }
        if (ist & 1 && Math.random() < dt * 14) puff(x + (Math.random() - 0.5), y + 0.15, z + (Math.random() - 0.5), 0xeefaff, 1, 0.35);
      }
      if (ist & 1 && !u.slipW) {
        u.slipW = 1;
        if (Math.random() < 0.7) word(pick(['HUCH!', 'RUTSCH!', 'UIII!', 'GLATTEIS!']), x, y + 2.6, z, { color: '#bfefff', scale: 0.85 });
        SFX.play('whoosh', { x, z, vol: 0.5 });
      } else if (!(ist & 1)) u.slipW = 0;
      if (ist & 4 && !u.frost && !u.arm) {
        const fg = new THREE.Group(),
          fm = FROST_MAT;
        for (let i = 0; i < 9; i++) {
          const c2 = mesh(
            new THREE.OctahedronGeometry(0.09 + Math.random() * 0.08, 0),
            fm,
            (Math.random() - 0.5) * 0.55,
            0.3 + Math.random() * 1.25,
            (Math.random() - 0.5) * 0.45,
            fg
          );
          c2.scale.y = 1.8 + Math.random();
          c2.rotation.set(Math.random(), Math.random(), Math.random());
        }
        (u.torso || u.rig).add(fg);
        u.frost = fg;
      }
      if (u.frost) {
        u.frost.visible = !!(ist & 4);
        if (u.frost.visible) u.frost.children.forEach((c2, k) => (c2.scale.x = c2.scale.z = 0.9 + Math.sin(clock * 3 + k) * 0.15));
      }
      if (ist & 4) {
        u.rig.position.x = Math.sin(clock * 55 + u.id) * 0.035;
        if (Math.random() < dt * 5)
          puff(x + (Math.random() - 0.5) * 0.9, y + 0.4 + Math.random() * 1.6, z + (Math.random() - 0.5) * 0.9, 0xcff4ff, 1, 0.3);
        if ((u.team === V.myTeam || mine) && Math.random() < dt * 0.35)
          word(pick(['BRRR!', 'KALT!', 'Zähneklappern …']), x, y + 2.8, z, { color: '#9be7ff', scale: 0.8 });
      } else if (u.rig.position.x) u.rig.position.x = 0;
      if (mine) {
        const fr = $('#frost');
        if (fr) fr.classList.toggle('on', !!(ist & 4));
      }
    }
    if (mine) u.headTarget = EG.intro > 0.35 ? BIG_HEAD : 0.95;
    else if (u.isPoss) u.headTarget = BIG_HEAD * (1 + 0.45 * tpk(u.team, 'bighead'));
    {
      const gs = tpk(u.team, 'giant') ? 1.35 : 1;
      if (u.pop === undefined && Math.abs(u.g.scale.x - gs) > 0.01) u.g.scale.setScalar(lerp(u.g.scale.x, gs, Math.min(1, dt * 4)));
    }
    if (u.spin > 0.6 && Math.random() < dt * 22) {
      const a = Math.random() * TAU;
      puff(x + Math.cos(a) * 4.5, y + 0.4 + Math.random() * 2, z + Math.sin(a) * 4.5, 0xf6f1e7, 1, 1.1);
    }
    if (!mine && V.poss && EG.intro > 0) {
      const c = camera.position,
        P = V.poss;
      u.g.visible = segDist(x, z, { x: c.x, z: c.z }, { x: P.x, z: P.z }) > 1.3 || Math.hypot(x - P.x, z - P.z) < 0.3;
    } else u.g.visible = true;
    if (mine && V.poss.rageT > 0 && Math.random() < dt * 8) puff(x, y + 1.5, z, 0xff5a3c, 1, 0.5);
    if (u.dashFx > 0) {
      u.dashFx -= dt;
      if (Math.random() < dt * 30)
        emitFX('dash', x, y + 0.4, z, { n: 1, size: 0.7, dx: -Math.sin(u.g.rotation.y), dz: -Math.cos(u.g.rotation.y) });
    }
    const sel = V.selected.has(u.id);
    u.ring.visible = (sel || (u.isPoss && !mine)) && !u.fogHid;
    if (u.ring.visible) u.ring.rotation.y += dt;
    u.hp.visible =
      u.hpPct < 100 &&
      !mine &&
      !(V.poss && EG.intro > 0) &&
      u.g.visible &&
      !u.fogHid &&
      !(u.worm && u.wP && (u.wP.ws === 'under' || u.wP.ws === 'warn'));
    egoCdSprite(u, x, y, z, mine);
    if (u.hp.visible) {
      u.hp.position.set(
        x,
        y + (u.worm ? u.hpY || 3.4 : KINDS[u.k].bear ? 3.9 : KINDS[u.k].role === 'cav' ? 3.6 : 3.1) + (u.isPoss ? 1.3 : 0),
        z
      );
      u.hp.quaternion.copy(camQ);
      u.hpf.scale.x = Math.max(0.01, u.hpPct / 100);
      u.hpf.material = hpMats[u.team === V.myTeam ? 0 : 1];
    }
    if (u.flash > 0) {
      u.flash -= dt;
      u.head.scale.setScalar(1 + u.flash * 0.7);
    } else u.head.scale.setScalar(1);
    if (u.k === 5 && moving && Math.random() < dt * 6)
      puff(x - Math.sin(u.g.rotation.y) * 0.9, y + 0.5, z - Math.cos(u.g.rotation.y) * 0.9, 0x999999, 1, 0.5);
  }
  for (let i = V.dying.length - 1; i >= 0; i--) {
    const u = V.dying[i];
    u.dieT += dt;
    if (deathTick(u, dt)) {
      ghostDrop(u);
      disposeUnit(u);
      V.dying.splice(i, 1);
    }
  }
  const s = V.latest;
  if (s) {
    if (!rallyMesh) {
      rallyMesh = new THREE.Group();
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), lam(0xf6f1e7), 0, 0.8, 0, rallyMesh);
      mesh(new THREE.ConeGeometry(0.35, 0.6, 3).rotateZ(-Math.PI / 2), lam(0xf2c14e), 0.3, 1.4, 0, rallyMesh);
      mesh(new THREE.RingGeometry(0.4, 0.55, 24).rotateX(-Math.PI / 2), basic(0xf2c14e, 0.8), 0, 0.08, 0, rallyMesh);
      scene.add(rallyMesh);
    }
    rallyMesh.visible = V.playing && !V.poss;
    rallyMesh.scale.setScalar(V.rallyMode ? 1.7 + Math.sin(clock * 6) * 0.2 : 1.25);
    const rx = s.r[V.myTeam * 2],
      rz = s.r[V.myTeam * 2 + 1];
    rallyMesh.position.set(rx, groundY(rx, rz), rz);
  }
}
