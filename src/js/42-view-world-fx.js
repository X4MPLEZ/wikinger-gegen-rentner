/* 42-view-world-fx.js - World effects on the client: chaos perks UI (perkUi), rolling boulders, cream puddles (bakeProp), fireballs, the base fall at the end,
   chicken/dance/bite status effects, disco grenades (nadeMesh, updateGrenades), gold rush, flag views (updateFlag). */
/* ---------- chaos mode: perks, fireballs ---------- */
const tpk = (team, id) => {
  const s = V.latest;
  return s && s.ch && s.pk ? s.pk[team][id] || 0 : 0;
};
const ROMAN = ['', 'I', 'II', 'III'];
function perkUi() {
  const s = V.latest,
    me = V.myTeam,
    box = $('#perkPick'),
    bar = $('#perkBar');
  if (!s || !s.ch || !V.playing || V.ending) {
    box.hidden = true;
    $('#foePerk').hidden = true;
    V.foeQ = [];
    V.foeT = 0;
    $('#pauseTag').hidden = true;
    if (bar.innerHTML) bar.innerHTML = '';
    return;
  }
  const paused = s.pz > 0,
    of = s.of && s.of[me],
    key = of ? of.join(',') + '#' + s.on : null,
    mine = s.pk[me] || {};
  if (of && V.pkPicked !== key) {
    if (V.pkKey !== key) {
      V.pkKey = key;
      SFX.play('perk');
      $('#perkCards').innerHTML = of
        .map((id, i) => {
          const P = PERKS[id],
            T = TIERS[P.t];
          return `<button class="pcard t${P.t}${i === 0 ? ' pre' : ''}" data-perk="${id}" style="--tc:${T.c}"><span class="tier">${T.n}</span>${i === 0 ? '<span class="preb">' + TR('Vorauswahl') + '</span>' : ''}<span class="pi">${P.ic}</span><b>${P.n}</b><span class="pd">${P.d}</span></button>`;
        })
        .join('');
      if (!COARSE)
        $$('#perkCards .pcard').forEach((b, i) => {
          const k = document.createElement('kbd');
          k.className = 'kb';
          k.textContent = String(i + 1);
          b.classList.add('haskb');
          b.appendChild(k);
        });
      $$('#perkCards .pcard').forEach(b =>
        b.addEventListener('click', () => {
          const id = b.dataset.perk;
          sendCmd({ t: 'perk', id });
          V.pkPicked = key;
          if (V.relock && V.poss && !COARSE) {
            V.relock = false;
            try {
              lockPointer();
            } catch (_) {}
          }
          $('#perkCards').innerHTML =
            '<div class="pwait">' + TR('{0} <b>{1}</b> gewählt.<br>Gleich geht es weiter …', PERKS[id].ic, PERKS[id].n) + '</div>';
          SFX.play('pick');
        })
      );
    }
    box.hidden = false;
    box.classList.remove('done');
    if (PL.on) {
      V.relock = true;
      try {
        document.exitPointerLock();
      } catch (_) {}
    }
  } else if (paused && V.pkPicked === V.pkKey && V.pkKey) {
    box.hidden = false;
    box.classList.add('done');
  } else box.hidden = true;
  $('#pauseTag').hidden = !paused || !box.hidden;
  if (!box.hidden) {
    $('#perkTimer').style.width = Math.min(1, s.pz / PERK_TIME) * 100 + '%';
    $('#perkInfo').textContent =
      TR('Runde {0} von {1} · {2} s', s.on, PERK_MAX, s.pz) + (s.ou && s.ou[me] ? ' · ' + TR('Aufholjagd: bessere Karten') : '');
  }
  const html =
    Object.keys(mine)
      .map(id => `<span class="pb" style="--tc:${TIERS[PERKS[id].t].c}">${PERKS[id].ic}</span>`)
      .join('') + (s.on < PERK_MAX && s.no > 0 && !paused ? '<span class="pb next">' + TR('Perk in {0} s', s.no) + '</span>' : '');
  if (bar.dataset.h !== html) {
    bar.dataset.h = html;
    bar.innerHTML = html;
  }
  if (V.lastPn)
    for (let t = 0; t < 2; t++)
      if (s.pn[t] !== V.lastPn[t] && s.lp[t]) {
        const id = s.lp[t],
          P = PERKS[id];
        if (t !== me) (V.foeQ || (V.foeQ = [])).push(id);
        else if (V.pkPicked !== V.pkKey) toast(TR('Automatisch gewählt: {0}', P.n), 2200);
      }
  V.lastPn = s.pn.slice();
  const fp = $('#foePerk');
  if (V.foeT && now() > V.foeT) {
    V.foeT = 0;
    fp.classList.add('out');
    setTimeout(() => {
      if (!V.foeT) fp.hidden = true;
    }, 420);
  }
  if (!V.foeT && V.foeQ && V.foeQ.length && box.hidden) {
    const P = PERKS[V.foeQ.shift()],
      T = TIERS[P.t];
    fp.style.setProperty('--tc', T.c);
    fp.innerHTML =
      '<span class="fl">' +
      TR('{0} hat gewählt', FAC[V.facs[1 - me]].name || TR('Gegner')) +
      `</span><span class="fi">${P.ic}</span><b>${P.n}<small>${T.n}</small></b><span class="fd">${P.d}</span>`;
    fp.classList.remove('out');
    fp.hidden = false;
    fp.style.animation = 'none';
    void fp.offsetWidth;
    fp.style.animation = '';
    V.foeT = now() + 5000;
    SFX.play('ding', { vol: 0.6 });
  }
}
const fbView = new Map(),
  fbCore = new THREE.SphereGeometry(1, 14, 10);
/* ---------- rolling boulders and cream puddles (view) ---------- */
const roView = new Map(),
  goView = new Map(),
  gooMat = new THREE.MeshLambertMaterial({ color: lin(0xfff1f6), transparent: true, opacity: 0.92, depthWrite: false }),
  gooGeo = new THREE.CircleGeometry(1, 26).rotateX(-Math.PI / 2),
  MERGE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
gooMat.userData.shared = MERGE_MAT.userData.shared = gooGeo.userData.shared = true;
// One draw call instead of dozens: bakes the parts of a small prop into one geometry, each part keeping its colour as vertex colour
// (material MERGE_MAT), or all in one given material. The parts are removed and their geometries freed.
function bakeProp(parts, parent, mat) {
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(),
    m4 = new THREE.Matrix4(),
    n3 = new THREE.Matrix3(),
    v = new THREE.Vector3(),
    pos = [],
    nor = [],
    col = [];
  for (const m of parts) {
    m4.multiplyMatrices(inv, m.matrixWorld);
    n3.getNormalMatrix(m4);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry,
      p = g.attributes.position,
      n = g.attributes.normal,
      c = m.material.color;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m4);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(n3).normalize();
      nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
    if (g !== m.geometry) g.dispose();
    if (!m.geometry.userData.shared) m.geometry.dispose();
    m.parent.remove(m);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (!mat) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const out = new THREE.Mesh(geo, mat || MERGE_MAT);
  parent.add(out);
  return out;
}
function updateRolls(dt) {
  const s = V.latest,
    seen = new Set();
  if (s && s.ro)
    for (const r of s.ro) {
      seen.add(r[0]);
      let v = roView.get(r[0]);
      if (!v) {
        const m = projGeo.boulder.clone();
        m.scale.setScalar(1.25);
        m.castShadow = true;
        scene.add(m);
        v = { m, x: r[1] / 10, z: r[2] / 10, dust: 0 };
        roView.set(r[0], v);
        SFX.play('roll', { x: v.x, z: v.z, vol: 1 });
        const zone = new THREE.Mesh(
          new THREE.PlaneGeometry(2.8, 9).rotateX(-Math.PI / 2).translate(0, 0, 5.2),
          new THREE.MeshBasicMaterial({
            color: 0xff3b2f,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
          })
        );
        zone.renderOrder = 6;
        scene.add(zone);
        v.zone = zone;
      } // danger zone: the strip the rock is about to roll through
      v.tx = r[1] / 10;
      v.tz = r[2] / 10;
      v.ang = r[3] / 100;
      v.mov = r[4];
      v.dx = r[5] / 100;
      v.dz = r[6] / 100;
    }
  for (const [id, v] of roView) {
    if (!seen.has(id)) {
      scene.remove(v.m);
      if (v.zone) scene.remove(v.zone);
      roView.delete(id);
      emitFX('land', v.x, groundY(v.x, v.z) + 0.3, v.z, { n: 6, size: 0.8 });
      continue;
    }
    const f = Math.min(1, dt * 14);
    v.x = lerp(v.x, v.tx, f);
    v.z = lerp(v.z, v.tz, f);
    v.m.position.set(v.x, groundY(v.x, v.z) + 0.62, v.z);
    v.m.rotation.set(0, Math.atan2(v.dx, v.dz), 0);
    v.m.rotateX(v.ang);
    if (v.mov) {
      v.dust += dt;
      if (v.dust > 0.06) {
        v.dust = 0;
        emitFX('dust', v.x - v.dx * 0.6, groundY(v.x, v.z) + 0.1, v.z - v.dz * 0.6, { n: 2, size: 0.8 });
      }
    }
    if (v.zone) {
      const zn = v.zone;
      zn.visible = !!v.mov;
      if (v.mov) {
        const ax = v.x + v.dx * 1.2,
          az = v.z + v.dz * 1.2;
        zn.position.set(v.x, groundY(ax, az) + 0.12, v.z);
        zn.rotation.set(0, Math.atan2(v.dx, v.dz), 0);
        zn.material.opacity = 0.22 + 0.14 * Math.sin(clock * 9);
      }
    }
  }
}
function updateGoo(dt) {
  const s = V.latest,
    seen = new Set();
  if (s && s.go)
    for (const g of s.go) {
      seen.add(g[0]);
      let v = goView.get(g[0]);
      if (!v) {
        const x = g[1] / 10,
          z = g[2] / 10,
          grp = new THREE.Group();
        grp.position.set(x, groundY(x, z) + 0.07, z);
        const R = (
          n => () =>
            (n = (n * 16807) % 2147483647) / 2147483647
        )(g[0] * 977 + 13); // deterministic per puddle: both players see the same mess
        const splat = [],
          deco = [];
        for (let i = 0; i < 9; i++) {
          const b = new THREE.Mesh(gooGeo, gooMat),
            a = (i / 9) * TAU,
            rr = i ? 0.42 + R() * 0.3 : 1;
          b.position.set(i ? Math.cos(a) * (0.45 + R() * 0.25) : 0, 0.002 * i, i ? Math.sin(a) * (0.45 + R() * 0.25) : 0);
          b.scale.setScalar(rr);
          grp.add(b);
          splat.push(b);
        } // cream splat
        const sponge = lam(0xf0c36a),
          filling = lam(0xe25a7a),
          creamMat = lam(0xfff6f1);
        for (let i = 0; i < 4; i++) {
          const w = new THREE.Group(),
            a = R() * TAU,
            d = 0.2 + R() * 0.45;
          w.position.set(Math.cos(a) * d, 0.02, Math.sin(a) * d);
          w.rotation.set((R() - 0.5) * 0.9, R() * TAU, (R() - 0.5) * 0.9);
          w.scale.setScalar(0.17 + R() * 0.1);
          mesh(new THREE.CylinderGeometry(1, 1, 0.45, 12, 1, false, 0, 1.1), sponge, 0, 0.22, 0, w);
          mesh(new THREE.CylinderGeometry(1, 1, 0.12, 12, 1, false, 0, 1.1), filling, 0, 0.5, 0, w);
          mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.4, 12, 1, false, 0, 1.1), sponge, 0, 0.75, 0, w);
          mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.18, 12, 1, false, 0, 1.1), creamMat, 0, 1.03, 0, w);
          grp.add(w);
        } // cake wedges
        for (let i = 0; i < 7; i++) {
          const d = mesh(new THREE.SphereGeometry(0.1 + R() * 0.07, 9, 7), creamMat, (R() - 0.5) * 1.5, 0.05, (R() - 0.5) * 1.5, grp);
          d.scale.y = 0.75;
        } // cream dollops
        for (let i = 0; i < 6; i++) {
          const c = mesh(
            new THREE.SphereGeometry(0.07 + R() * 0.03, 8, 6),
            lam(i % 3 ? 0xd0213a : 0xff6b9a),
            (R() - 0.5) * 1.6,
            0.08,
            (R() - 0.5) * 1.6,
            grp
          );
          mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), lam(0x4a7a2a), 0, 0.1, 0, c).rotation.z = 0.5;
        } // cherries with stems
        mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), lam(0xfff1a8), 0.3, 0.17, -0.2, grp);
        mesh(new THREE.SphereGeometry(0.04, 6, 5), lam(0xffa030), 0.3, 0.35, -0.2, grp); // a bent birthday candle
        grp.traverse(o => o.isMesh && !splat.includes(o) && deco.push(o));
        // ~45 little meshes (and as many outlines) would be ~90 draw calls per puddle: bake them into two meshes
        bakeProp(splat, grp, gooMat);
        bakeProp(deco, grp);
        inkify(grp);
        const foe = g[6] !== undefined && g[6] !== V.myTeam,
          zone = new THREE.Mesh(
            new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: foe ? 0xff3b2f : 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })
          );
        zone.renderOrder = 6;
        zone.position.y = 0.05;
        grp.add(zone);
        grp.userData.zone = zone; // danger zone: red ring = enemy cream, you get slowed in there
        grp.renderOrder = 2;
        scene.add(grp);
        v = { g: grp, x, z, r: g[3] / 10, t0: g[5] / 10 };
        goView.set(g[0], v);
        word(TR('SAHNE!'), x, grp.position.y + 1.5, z, { color: '#ffd6e6', scale: 1.1 });
        setTimeout(() => SFX.play('squelch', { x, z, vol: 0.9 }), 250);
      }
      v.t = g[4] / 10;
    }
  for (const [id, v] of goView) {
    if (!seen.has(id)) {
      scene.remove(v.g);
      disposeTree(v.g);
      goView.delete(id);
      continue;
    }
    const grow = Math.min(1, (v.t0 - v.t) / 0.35),
      fade = Math.min(1, v.t / 1.5);
    v.g.scale.setScalar(v.r * (0.2 + 0.8 * grow) * (0.7 + 0.3 * fade));
    v.g.visible = fade > 0.02;
    {
      const zn = v.g.userData.zone;
      if (zn) zn.material.opacity = (0.35 + 0.25 * Math.sin(clock * 5)) * fade;
    }
  }
}
function updateFireballs(dt) {
  const s = V.latest,
    seen = new Set();
  if (s && s.fb)
    for (const f of s.fb) {
      seen.add(f[0]);
      if (!fbView.has(f[0])) {
        const g = new THREE.Group(),
          sc = 0.7 + 0.25 * f[5];
        mesh(fbCore, new THREE.MeshBasicMaterial({ color: lin(0xffb347) }), 0, 0, 0, g).scale.setScalar(sc);
        const glow = mesh(
          fbCore,
          new THREE.MeshBasicMaterial({
            color: lin(0xff5a1f),
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
          0,
          0,
          0,
          g
        );
        glow.scale.setScalar(sc * 1.8);
        scene.add(g);
        const tx = f[1] / 10,
          tz = f[2] / 10;
        fbView.set(f[0], { g, tx, tz, ty: groundY(tx, tz), tl: f[3] / 10, t0: now(), lvl: f[5], team: f[4] });
        SFX.play('fireball', { x: tx, z: tz });
      }
    }
  for (const [id, v] of fbView) {
    const rem = Math.max(0, v.tl - (now() - v.t0) / 1000),
      k = rem / 1.4;
    v.g.position.set(v.tx + 12 * k, v.ty + 0.6 + 36 * k, v.tz + 7 * k);
    v.g.rotation.y += dt * 6;
    if (Math.random() < dt * 40)
      puff(v.g.position.x, v.g.position.y, v.g.position.z, Math.random() < 0.6 ? 0xff8a3c : 0x777777, 1, 0.9 + 0.3 * v.lvl);
    if (!seen.has(id) && (rem <= 0.05 || !s || !s.fb || rem < 1.2)) {
      const R = 5 + v.lvl;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        puff(
          v.tx + Math.cos(a) * R * 0.6 * Math.random(),
          v.ty + 0.6,
          v.tz + Math.sin(a) * R * 0.6 * Math.random(),
          i % 3 ? 0xff7a2a : 0x555555,
          1,
          1.6
        );
      }
      emitFX('explosion', v.tx, v.ty + 0.5, v.tz, { size: 1.6 });
      word(TR('BUMM!'), v.tx, v.ty + 3.5, v.tz, { color: '#ff9b54', scale: 1.4 });
      SFX.play('boom', { x: v.tx, z: v.tz, vol: 1.3 });
      scene.remove(v.g);
      fbView.delete(id);
    }
  }
}
/* ---------- base collapse cinematic ---------- */
function startBaseFall(s) {
  if (V.ending) return;
  V.ending = { t: 0, lost: 1 - s.o, s, crumbled: false, shake: 0 };
  if (V.poss) exitEgo(false);
  V.selected.clear();
  setRallyMode(false);
  $('#hud').hidden = true;
  $('#ego').hidden = true;
  $('#perkPick').hidden = true;
  $('#tut').hidden = true;
  $('#tutRing').hidden = true;
  drawLasso(null);
  SFX.play('rumble');
}
function crumbleBase(i) {
  const bv = baseViews[i];
  if (!bv) return;
  if (bv.orig) {
    // swap the batched base for its unbaked twin so every plank, post and roof tile can fly on its own
    const o = bv.orig;
    bv.orig = null;
    o.position.copy(bv.g.position);
    o.rotation.copy(bv.g.rotation);
    o.scale.copy(bv.g.scale);
    let par = o;
    for (const ix of bv.perchPath) par = par.children[ix] || par;
    if (bv.shooter && bv.shooter.g.parent) par.add(bv.shooter.g);
    shadows(o, true, true);
    scene.remove(bv.g);
    bv.g.traverse(m => {
      if (m.userData.ownedGeometry && m.geometry) m.geometry.dispose();
    });
    scene.add(o);
    bv.g = o;
  }
  bv.g.updateMatrixWorld(true);
  const B = BASES[i],
    gy = bv.y,
    meshes = [];
  emitFX('building', B.x, gy + 2, B.z, { size: 1.5 });
  bv.g.traverse(o => {
    if (o.isMesh) meshes.push(o);
  });
  const bb = new THREE.Box3(),
    sz = new THREE.Vector3(),
    ct = new THREE.Vector3(),
    cols = [];
  let roof = null,
    roofTop = -1e9;
  const info = meshes.map(m => {
    bb.setFromObject(m);
    bb.getSize(sz);
    bb.getCenter(ct);
    return { m, sx: sz.x, sy: sz.y, sz: sz.z, cx: ct.x, cy: ct.y, cz: ct.z, minY: bb.min.y };
  });
  for (const o of info) {
    if (o.m.material && o.m.material.color && cols.length < 6 && o.sx * o.sz > 2) cols.push(o.m.material.color.getHex());
    if (Math.max(o.sx, o.sz) > 8 && o.cy > gy + 3.5 && o.cy > roofTop) {
      roofTop = o.cy;
      roof = o;
    }
  }
  for (const o of info) {
    const m = o.m,
      big = Math.max(o.sx, o.sz) > 7;
    if (big && o.cy < gy + 0.4) continue; // foundation stays
    scene.attach(m);
    const dx = o.cx - B.x,
      dz = o.cz - B.z,
      d = Math.hypot(dx, dz) || 1;
    if (o === roof && o.sy < 1.6) {
      // flat roof plate: shatter into slabs that tumble down
      scene.remove(m);
      const nx = 6,
        nz = 4,
        w = o.sx / nx,
        dd = o.sz / nz,
        mat = Array.isArray(m.material) ? m.material[0] : m.material;
      for (let ix = 0; ix < nx; ix++)
        for (let iz = 0; iz < nz; iz++) {
          const sl = new THREE.Mesh(
            new THREE.BoxGeometry(w * (0.75 + Math.random() * 0.3), Math.max(0.15, o.sy * 0.9), dd * (0.75 + Math.random() * 0.3)),
            mat
          );
          const px = o.cx - o.sx / 2 + (ix + 0.5) * w,
            pz = o.cz - o.sz / 2 + (iz + 0.5) * dd;
          sl.position.set(px, o.cy, pz);
          sl.rotation.y = (Math.random() - 0.5) * 0.2;
          sl.castShadow = UNIT_SHADOWS;
          scene.add(sl);
          const ddx = px - B.x,
            ddz = pz - B.z,
            dl = Math.hypot(ddx, ddz) || 1,
            pw = 0.6 + Math.random() * 2.4;
          fx.debris.push({
            m: sl,
            vx: (ddx / dl) * pw,
            vy: 0.5 + Math.random() * 2.5,
            vz: (ddz / dl) * pw,
            rx: (Math.random() - 0.5) * 5,
            rz: (Math.random() - 0.5) * 5,
            t: 0,
            delay: 0.18 + Math.random() * 0.35,
          });
        }
      continue;
    }
    if (o === roof) {
      fx.debris.push({ m, drop: true, vy: 0, floor: gy + 1.6, tilt: (Math.random() < 0.5 ? -1 : 1) * 0.22, t: 0, delay: 0.1 });
      continue;
    }
    if ((big || Math.max(o.sx, o.sz) > 4) && o.sy > 1.8) {
      fx.debris.push({ m, crush: true, y0: m.position.y, h: o.sy, s0: m.scale.y, t: 0, delay: 0.25, minY: o.minY });
      continue;
    }
    if (o.sy > 1.6 && Math.max(o.sx, o.sz) < 1.2) {
      // posts, planks, chimneys: topple outward around their foot
      const pv = new THREE.Group();
      pv.position.set(o.cx, o.minY, o.cz);
      scene.add(pv);
      pv.attach(m);
      const ax = new THREE.Vector3(dz / d, 0, -dx / d);
      fx.debris.push({ m: pv, topple: true, ax, t: 0, delay: 0.2 + Math.random() * 0.5, acc: 4 + Math.random() * 4, ang: 0, keep: true });
      continue;
    }
    const pw = 0.8 + Math.random() * 2.5;
    fx.debris.push({
      m,
      vx: (dx / d) * pw + (Math.random() - 0.5) * 1.5,
      vy: 1 + Math.random() * 3.5,
      vz: (dz / d) * pw + (Math.random() - 0.5) * 1.5,
      rx: (Math.random() - 0.5) * 6,
      rz: (Math.random() - 0.5) * 6,
      t: 0,
      delay: 0.15 + (Math.random() * 0.5 * Math.max(0, o.cy - gy)) / 6,
    });
  }
  const brick = new THREE.BoxGeometry(0.45, 0.3, 0.3);
  for (let k = 0; k < 45; k++) {
    const m = new THREE.Mesh(brick, lam(cols.length ? cols[k % cols.length] : 0xb9ad9a)),
      a = Math.random() * TAU,
      r = Math.random() * 4;
    m.position.set(B.x + Math.cos(a) * r * 1.4, gy + 1 + Math.random() * 4, B.z + Math.sin(a) * r * 0.8);
    m.castShadow = UNIT_SHADOWS;
    scene.add(m);
    const pw = 1 + Math.random() * 4;
    fx.debris.push({
      m,
      vx: Math.cos(a) * pw,
      vy: 1 + Math.random() * 5,
      vz: Math.sin(a) * pw,
      rx: (Math.random() - 0.5) * 12,
      rz: (Math.random() - 0.5) * 12,
      t: 0,
      delay: 0.3 + Math.random() * 0.6,
    });
  }
  {
    // rubble heap that stays
    const heap = new THREE.Group(),
      rg = flat(new THREE.DodecahedronGeometry(1, 0));
    for (let k = 0; k < 34; k++) {
      const u2 = (Math.random() - 0.5) * 2,
        v2 = (Math.random() - 0.5) * 2,
        hgt = (1 - Math.abs(u2) * 0.6) * (1 - Math.abs(v2) * 0.6);
      const rk = new THREE.Mesh(rg, lam(cols.length ? cols[k % cols.length] : 0x8a7a66));
      rk.position.set(u2 * 6, 0.3 + hgt * (0.4 + Math.random() * 1.4), v2 * 3);
      rk.scale.set(0.5 + Math.random() * 1.1, 0.35 + Math.random() * 0.6, 0.5 + Math.random() * 0.9);
      rk.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rk.castShadow = UNIT_SHADOWS;
      heap.add(rk);
    }
    heap.position.set(B.x, gy + 0.2, B.z);
    heap.scale.set(1, 0.01, 1);
    scene.add(heap);
    fx.debris.push({ m: heap, grow: true, t: 0, delay: 0.55, keep: true });
  }
  scene.remove(bv.g);
  word(TR('EINGESTÜRZT!'), B.x, gy + 9, B.z, { color: '#ff9b54', scale: 2.2 });
  SFX.play('collapse');
  setTimeout(() => SFX.play('crash', { vol: 1.2 }), 380);
  setTimeout(() => SFX.play('base', { vol: 1.1 }), 650);
  setTimeout(() => SFX.play('crash', { vol: 0.9 }), 1000);
}
function endingTick(dt) {
  const E = V.ending;
  E.t += dt;
  const i = E.lost,
    B = BASES[i],
    bv = baseViews[i];
  const yaw = i === 0 ? Math.PI : 0,
    f = Math.min(1, dt * 2.2),
    T0 = 1.6;
  camS.x = lerp(camS.x, B.x, f);
  camS.z = lerp(camS.z, B.z + (i === 0 ? -6 : 6), f);
  camS.dist = lerp(camS.dist, 32, f);
  camS.pitch = lerp(camS.pitch, 0.45, f);
  camS.yaw += angDiff(yaw, camS.yaw) * f;
  applyCam();
  if (E.t < T0 && bv) {
    const k = E.t / T0;
    bv.g.position.x = B.x + Math.sin(E.t * 55) * 0.1 * k;
    bv.g.position.y = bv.y - k * k * 0.35;
    bv.g.rotation.z = Math.sin(E.t * 37) * 0.012 * k + 0.035 * k * k * (i ? 1 : -1);
    if (Math.random() < dt * (6 + k * 26))
      puff(B.x + (Math.random() - 0.5) * 11, bv.y + 4 + Math.random() * 2, B.z + (Math.random() - 0.5) * 5, 0xb9ad9a, 1, 0.8);
    if (Math.random() < dt * 10 * k) puff(B.x + (Math.random() - 0.5) * 12, bv.y + 0.4, B.z + (Math.random() - 0.5) * 6, 0x9a8b76, 1, 1.2);
    if (!E.creak && E.t > 0.3) {
      E.creak = 1;
      SFX.play('creak');
    }
    if (E.creak === 1 && E.t > 1.0) {
      E.creak = 2;
      SFX.play('creak', { vol: 1.2 });
    }
  }
  if (E.t >= T0 && !E.crumbled) {
    E.crumbled = true;
    E.shake = 1.1;
    crumbleBase(i);
  }
  if (E.crumbled && E.t < T0 + 1.6) {
    const q = (E.t - T0) / 1.6,
      R = 4 + q * 12;
    for (let n = 0; n < 3; n++) {
      const a = Math.random() * TAU;
      puff(
        B.x + Math.cos(a) * R,
        (bv ? bv.y : 0) + 0.4 + Math.random() * 0.6,
        B.z + Math.sin(a) * R * 0.75,
        Math.random() < 0.5 ? 0xb9ad9a : 0x8a7a66,
        1,
        2.2 - q
      );
    }
    if (Math.random() < dt * 12)
      puff(B.x + (Math.random() - 0.5) * 6, (bv ? bv.y : 0) + 2 + q * 6, B.z + (Math.random() - 0.5) * 4, 0xa89c88, 1, 3);
  }
  if (E.shake > 0) {
    E.shake -= dt;
    camera.position.x += (Math.random() - 0.5) * E.shake * 0.9;
    camera.position.y += (Math.random() - 0.5) * E.shake * 0.6;
  }
  if (E.t >= 4.8 && !E.done) {
    E.done = true;
    endGame(E.s);
  }
}
const ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
  discGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
function aoeRing(x, z, r, col) {
  const g = new THREE.Group();
  g.position.set(x, groundY(x, z) + 0.12, z);
  const m1 = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }),
    m2 = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, m1);
  ring.scale.setScalar(r * 0.3);
  g.add(ring);
  const core = new THREE.Mesh(discGeo, m2);
  core.scale.setScalar(1.3);
  g.add(core);
  scene.add(g);
  fx.debris.push({ m: g, ringFx: true, r, ring, core, t: 0, delay: 0 });
}
function debrisTick(dt) {
  for (let k = fx.debris.length - 1; k >= 0; k--) {
    const d = fx.debris[k],
      m = d.m;
    d.t += dt;
    if (d.t < d.delay) continue;
    if (d.drop) {
      d.vy -= 26 * dt;
      m.position.y += d.vy * dt;
      if (m.position.y <= d.floor) {
        m.position.y = d.floor;
        if (!d.landed) {
          d.landed = 1;
          d.vy = 0;
          puff(m.position.x, d.floor + 0.5, m.position.z, 0xa89c88, 10, 2.2);
        }
        m.rotation.z = lerp(m.rotation.z, d.tilt, Math.min(1, dt * 6));
        m.scale.y = lerp(m.scale.y, 0.55, Math.min(1, dt * 4));
      }
      if (d.t > 3.4) m.position.y -= dt * 0.6;
      continue;
    }
    if (d.crush) {
      const q = sstep(0, 0.55, d.t - d.delay),
        sc = lerp(1, 0.22, q);
      m.scale.y = d.s0 * sc;
      m.position.y = d.minY + (d.y0 - d.minY) * sc;
      if (d.t > 3.4) m.position.y -= dt * 0.4;
      continue;
    }
    if (d.topple) {
      if (d.ang < 1.5) {
        d.ang = Math.min(1.5, d.ang + d.acc * (d.t - d.delay) * dt);
        m.quaternion.setFromAxisAngle(d.ax, d.ang);
        if (d.ang >= 1.5) {
          puff(m.position.x, m.position.y + 0.3, m.position.z, 0xa89c88, 3, 1);
        }
      }
      continue;
    }
    if (d.grow) {
      m.scale.y = Math.min(1, m.scale.y + dt * 1.6);
      continue;
    }
    if (d.ringFx) {
      const q = Math.min(1, d.t / 0.25);
      d.ring.scale.setScalar(d.r * (0.3 + 0.7 * q));
      d.ring.material.opacity = 0.85 * Math.max(0, 1 - d.t / 0.9);
      d.core.material.opacity = 0.55 * Math.max(0, 1 - d.t / 0.6);
      if (d.t > 0.9) {
        removeOwnedObject(m);
        d.ring.material.dispose();
        d.core.material.dispose();
        fx.debris.splice(k, 1);
      }
      continue;
    }
    if (d.roll) {
      const sp = Math.hypot(d.vx, d.vz),
        fr = Math.max(0, 1 - dt * 0.7);
      d.vx *= fr;
      d.vz *= fr;
      m.position.x += d.vx * dt;
      m.position.z += d.vz * dt;
      m.position.y = groundY(m.position.x, m.position.z);
      m.rotation.y = d.yaw;
      m.rotation.z = sp > 1.2 ? Math.sin(d.t * 9) * 0.06 : lerp(m.rotation.z, d.tip * 1.45, Math.min(1, dt * 5));
      if (m.userData.wheels) m.userData.wheels.forEach(o => (o.rotation.x += sp * dt * 9));
      else
        m.traverse(o => {
          if (
            o.geometry &&
            o.geometry.type === 'CylinderGeometry' &&
            o.geometry.parameters.radiusTop > 0.1 &&
            o.geometry.parameters.radiusTop < 0.13
          )
            o.rotation.x += sp * dt * 9;
        });
      if (sp > 2 && Math.random() < dt * 8) puff(m.position.x, m.position.y + 0.2, m.position.z, 0xd8c48f, 1, 0.5);
      if (d.t > 4.5) m.position.y -= (d.t - 4.5) * 1.2;
      if (d.t > 6) {
        removeOwnedObject(m);
        fx.debris.splice(k, 1);
      }
      continue;
    }
    if (d.big) {
      m.position.x += d.vx * dt;
      m.position.z += d.vz * dt;
      m.position.y -= d.sink * dt * Math.min(1, d.t);
      m.rotation.x += d.rx * dt;
      m.rotation.z += d.rz * dt;
      if (Math.random() < dt * 6)
        puff(
          m.position.x + (Math.random() - 0.5) * 3,
          groundY(m.position.x, m.position.z) + 0.5,
          m.position.z + (Math.random() - 0.5) * 3,
          0x9a8b76,
          1,
          1.6
        );
      if (d.t > 6) {
        removeOwnedObject(m);
        fx.debris.splice(k, 1);
      }
      continue;
    }
    d.vy -= 18 * dt;
    m.position.x += d.vx * dt;
    m.position.y += d.vy * dt;
    m.position.z += d.vz * dt;
    m.rotation.x += d.rx * dt;
    m.rotation.z += d.rz * dt;
    const gy = groundY(m.position.x, m.position.z);
    if (m.position.y < gy + 0.1) {
      m.position.y = gy + 0.1;
      d.vy = Math.abs(d.vy) * 0.25;
      d.vx *= 0.5;
      d.vz *= 0.5;
      d.rx *= 0.5;
      d.rz *= 0.5;
    }
    if (d.t > 3.5) m.position.y -= dt * 0.8;
    if (d.t > 6) {
      removeOwnedObject(m);
      fx.debris.splice(k, 1);
    }
  }
}
/* ---------- base health bars above the bases, base alarm ---------- */
function baseBars(s) {
  baseViews.forEach((bv, i) => {
    if (!bv.bar) {
      const c = cnv(256, 72),
        t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      bv.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
      bv.bar.renderOrder = 9;
      bv.bar.scale.set(10, 2.8, 1);
      bv.barC = c;
      bv.barT = t;
      scene.add(bv.bar);
    }
    const hp = s ? s.b[i] : CFG.baseHp;
    bv.bar.position.set(BASES[i].x, bv.y + 10.5, BASES[i].z);
    bv.bar.visible = !!s && V.playing && !V.ending && !V.noWords;
    {
      const d = camera.position.distanceTo(bv.bar.position),
        k = clamp(d * 0.11, 7, 22);
      bv.bar.scale.set(k, k * 0.28, 1);
      bv.bar.position.y = bv.y + 9 + k * 0.2;
    }
    if (bv.lastHp === hp) return;
    bv.lastHp = hp;
    const x = bv.barC.getContext('2d'),
      f = clamp(hp / CFG.baseHp, 0, 1),
      mine = i === V.myTeam;
    x.clearRect(0, 0, 256, 72);
    x.font = '600 22px Rubik, sans-serif';
    x.textAlign = 'center';
    x.lineWidth = 5;
    x.strokeStyle = 'rgba(8,14,27,.9)';
    x.fillStyle = '#fff';
    const label = (mine ? TR('Deine Basis') : FAC[V.facs[i]].base) + '  ' + Math.ceil(hp);
    x.strokeText(label, 128, 24);
    x.fillText(label, 128, 24);
    x.fillStyle = 'rgba(8,14,27,.88)';
    rrect(x, 8, 34, 240, 28, 14);
    x.fillStyle = f > 0.5 ? FAC[V.facs[i]].css : f > 0.25 ? '#f0bf4c' : '#e3604c';
    if (f > 0.01) rrect(x, 12, 38, Math.max(20, 232 * f), 20, 10);
    x.strokeStyle = mine ? '#ffffff' : 'rgba(255,255,255,.35)';
    x.lineWidth = mine ? 3 : 2;
    x.beginPath();
    x.roundRect ? x.roundRect(8, 34, 240, 28, 14) : x.rect(8, 34, 240, 28);
    x.stroke();
    bv.barT.needsUpdate = true;
  });
}
function baseAlarm() {
  if (V.tut || V.ending || now() - (V.alarmT || 0) < 8000) return;
  V.alarmT = now();
  const el = $('#alarm');
  el.hidden = false;
  clearTimeout(baseAlarm.t);
  baseAlarm.t = setTimeout(() => (el.hidden = true), 2600);
  SFX.play('alarm');
}
/* ---------- chicken, dance, bite, jump, disco grenade ---------- */
function chickenMesh() {
  const g = new THREE.Group(),
    white = lam(0xfafafa);
  mesh(new THREE.SphereGeometry(0.42, 14, 10), white, 0, 0.62, 0, g).scale.set(1, 0.95, 1.25);
  mesh(new THREE.SphereGeometry(0.24, 12, 9), white, 0, 1.08, 0.3, g);
  mesh(new THREE.ConeGeometry(0.07, 0.2, 8).rotateX(Math.PI / 2), lam(0xf5b62a), 0, 1.05, 0.58, g);
  [-0.05, 0.05].forEach(o => mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0xd0213a), o, 1.32, 0.3 + o, g));
  mesh(new THREE.SphereGeometry(0.05, 8, 6), lam(0xd0213a), 0, 0.92, 0.5, g);
  [-1, 1].forEach(sx => {
    mesh(new THREE.SphereGeometry(0.035, 6, 5), lam(0x111111), sx * 0.12, 1.13, 0.48, g);
    const w = mesh(new THREE.SphereGeometry(0.22, 10, 8), white, sx * 0.38, 0.66, -0.02, g);
    w.scale.set(0.35, 0.8, 1.1);
  });
  mesh(new THREE.ConeGeometry(0.2, 0.35, 8), white, 0, 0.82, -0.52, g).rotation.x = -1.0;
  [-1, 1].forEach(sx => {
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5), lam(0xf5b62a), sx * 0.13, 0.17, 0, g);
    mesh(new THREE.BoxGeometry(0.14, 0.03, 0.16), lam(0xf5b62a), sx * 0.13, 0.03, 0.05, g);
  });
  g.scale.setScalar(1.25);
  return g;
}
function setChicken(u, on) {
  u.chick = on;
  if (on) {
    if (!u.chickM) {
      u.chickM = chickenMesh();
      u.g.add(u.chickM);
    }
    u.chickM.visible = true;
    u.rig.visible = false;
    puff(u.g.position.x, u.g.position.y + 1, u.g.position.z, 0xffffff, 10, 0.7);
    word(TR('GACK!'), u.g.position.x, u.g.position.y + 2.6, u.g.position.z, { color: '#ffffff' });
    SFX.play('chicken', { x: u.g.position.x, z: u.g.position.z });
  } else {
    if (u.chickM) u.chickM.visible = false;
    u.rig.visible = true;
    puff(u.g.position.x, u.g.position.y + 1, u.g.position.z, 0xffffff, 6, 0.6);
  }
}
function updateStatusFx(u, dt, x, y, z) {
  if (u.chick && u.chickM) {
    u.chickM.position.y = Math.abs(Math.sin(clock * 14)) * 0.15;
    u.chickM.rotation.z = Math.sin(clock * 20) * 0.08;
    u.chickM.rotation.x = u.atkT < 0.35 ? Math.sin((u.atkT / 0.35) * Math.PI) * 0.7 : 0;
    if (Math.random() < dt * 0.7) {
      word(Math.random() < 0.5 ? TR('GACK!') : TR('BOCK!'), x, y + 2.6, z, { color: '#ffffff', scale: 0.8 });
      SFX.play('chicken', { x, z, vol: 0.6 });
    }
    if (Math.random() < dt * 3) puff(x, y + 0.8, z, 0xffffff, 1, 0.3);
  }
  if (u.bitten) {
    if (!u.biteM) {
      u.biteM = projGeo.teeth.clone();
      u.g.add(u.biteM);
    }
    u.biteM.visible = true;
    const hb = headBox({ k: u.k, poss: u.isPoss }),
      c = Math.sin(clock * 16);
    u.biteM.position.set(0, hb.y + hb.r * 0.92 + Math.max(0, c) * 0.08, 0);
    u.biteM.rotation.set(Math.PI / 2, clock * 0.8, 0);
    u.biteM.scale.setScalar(1.35 * (u.isPoss ? 1.4 : 1));
    u.biteM.children.forEach((j, i) => (j.rotation.x = (i ? -1 : 1) * (0.2 + Math.max(0, c) * 0.6)));
    if (Math.random() < dt * 6) puff(x + (Math.random() - 0.5) * 0.4, y + hb.y + hb.r, z + (Math.random() - 0.5) * 0.4, 0xffffff, 1, 0.25);
    if (Math.random() < dt * 2) SFX.play('chomp', { x, z, vol: 0.5 });
  } else if (u.biteM) u.biteM.visible = false;
}
function danceRig(u, dt) {
  const mv = V.poss && V.poss.id === u.id && V.poss.mv;
  if (mv) {
    const k = Math.min(1, mv.t / 0.9),
      s = Math.sin(k * Math.PI),
      r = u.rig,
      L = u.armL,
      R = u.armR;
    r.position.y = 0;
    r.rotation.set(0, 0, 0);
    L.rotation.set(0, 0, -0.2);
    R.rotation.set(0, 0, 0.2);
    u.torso.rotation.set(0, 0, 0);
    u.neck.rotation.set(0, 0, 0);
    if (u.legL) {
      u.legL.rotation.set(0, 0, 0);
      u.legR.rotation.set(0, 0, 0);
    }
    if (u.foreL) {
      u.foreL.rotation.x = mv.n === 'robot' ? -1.57 : mv.n === 'floss' ? -0.25 : mv.n === 'disco' ? -0.3 : -0.15;
      u.foreR.rotation.x = u.foreL.rotation.x;
    }
    if (u.shinL) {
      const kb = mv.n === 'jump' ? 1.3 * s : mv.n === 'floss' ? 0.15 : 0.05;
      u.shinL.rotation.x = kb;
      u.shinR.rotation.x = kb;
    }
    if (mv.n === 'spin') {
      r.rotation.y = k * TAU * 2;
      r.position.y = s * 0.35;
      L.rotation.z = -1.5;
      R.rotation.z = 1.5;
    } else if (mv.n === 'jump') {
      r.position.y = s * 1.7;
      L.rotation.x = -3;
      R.rotation.x = -3;
      if (u.legL) {
        u.legL.rotation.x = -s;
        u.legR.rotation.x = -s;
      }
      r.rotation.x = -s * 0.3;
    } else if (mv.n === 'floss') {
      const f = Math.sin(k * TAU * 4);
      L.rotation.x = 0.3;
      R.rotation.x = 0.3;
      L.rotation.z = -0.3 + f * 0.6;
      R.rotation.z = 0.3 + f * 0.6;
      u.torso.rotation.y = -f * 0.4;
      r.position.y = Math.abs(f) * 0.12;
    } else if (mv.n === 'robot') {
      const q = Math.floor(k * 6);
      r.rotation.y = (q % 2 ? 1 : -1) * 0.5;
      L.rotation.x = q % 2 ? -1.57 : 0;
      R.rotation.x = q % 2 ? 0 : -1.57;
      u.neck.rotation.z = ((q % 3) - 1) * 0.35;
    } else if (mv.n === 'disco') {
      const up = Math.floor(k * 4) % 2 === 0;
      R.rotation.x = up ? -2.9 : -0.6;
      R.rotation.z = up ? 0.4 : -0.5;
      L.rotation.z = -0.3;
      r.rotation.z = up ? 0.18 : -0.12;
      u.torso.rotation.y = up ? 0.3 : -0.2;
    } else if (mv.n === 'split') {
      r.position.y = -0.55 * s;
      if (u.legL) {
        u.legL.rotation.x = -1.5 * s;
        u.legR.rotation.x = 1.5 * s;
      }
      L.rotation.z = -2.6 * s;
      R.rotation.z = 2.6 * s;
    }
    if (Math.random() < dt * 8)
      puff(
        u.g.position.x + (Math.random() - 0.5) * 1.6,
        u.g.position.y + 0.3 + Math.random() * 2,
        u.g.position.z + (Math.random() - 0.5) * 1.6,
        [0xff6bd5, 0x6be3ff, 0xffe66b][Math.floor(Math.random() * 3)],
        1,
        0.35
      );
    return;
  }
  const t = clock * 7 + (u.ph || 0);
  u.rig.position.y = Math.abs(Math.sin(t)) * 0.3;
  u.rig.rotation.y = Math.sin(t * 0.5) * 0.9;
  u.rig.rotation.x = 0;
  u.rig.rotation.z = Math.sin(t) * 0.12;
  u.armL.rotation.x = -2.6 + Math.sin(t) * 0.5;
  u.armR.rotation.x = -2.6 - Math.sin(t) * 0.5;
  u.armL.rotation.z = -0.5;
  u.armR.rotation.z = 0.5;
  if (u.legL) {
    u.legL.rotation.x = -Math.max(0, Math.sin(t)) * 0.8;
    u.legR.rotation.x = -Math.max(0, -Math.sin(t)) * 0.8;
    if (u.shinL) {
      u.shinL.rotation.x = Math.max(0, Math.sin(t)) * 1.3;
      u.shinR.rotation.x = Math.max(0, -Math.sin(t)) * 1.3;
    }
  }
  if (u.foreL) {
    u.foreL.rotation.x = -0.5 + Math.sin(t * 2) * 0.35;
    u.foreR.rotation.x = -0.5 - Math.sin(t * 2) * 0.35;
  }
  u.torso.rotation.x = 0;
  u.torso.rotation.y = Math.sin(t) * 0.3;
  u.neck.rotation.z = Math.sin(t * 2) * 0.3;
  if (Math.random() < dt * 1.6)
    word(Math.random() < 0.5 ? '♪' : '♫', u.g.position.x + (Math.random() - 0.5), u.g.position.y + 3, u.g.position.z, {
      color: ['#ff6bd5', '#6be3ff', '#ffe66b'][Math.floor(Math.random() * 3)],
      scale: 0.9,
    });
  if (Math.random() < dt * 4)
    puff(
      u.g.position.x + (Math.random() - 0.5) * 1.5,
      u.g.position.y + 0.2,
      u.g.position.z + (Math.random() - 0.5) * 1.5,
      [0xff6bd5, 0x6be3ff, 0xffe66b][Math.floor(Math.random() * 3)],
      1,
      0.35
    );
}
const grView = new Map(),
  discoGeo = new THREE.IcosahedronGeometry(0.45, 1);
/* disco grenade: a pineapple grenade covered in mirror tiles, with cap, spoon and pin ring */
function nadeMesh(sc = 1) {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  body.scale.setScalar(sc);
  const ball = new THREE.MeshPhongMaterial({
    color: lin(0xdfe6f0),
    emissive: lin(0x553366),
    shininess: 140,
    specular: lin(0xffffff),
    flatShading: true,
  });
  g.userData.ball = ball;
  const b = mesh(new THREE.IcosahedronGeometry(0.4, 1), ball, 0, 0, 0, body);
  b.scale.set(1, 1.18, 1);
  for (let i = 0; i < 4; i++) {
    const r = mesh(
      new THREE.TorusGeometry(0.4 * Math.cos((i - 1.5) * 0.42), 0.022, 4, 16).rotateX(Math.PI / 2),
      lam(0x6b7380),
      0,
      (i - 1.5) * 0.19,
      0,
      body
    );
  }
  for (let i = 0; i < 4; i++) {
    const v = mesh(new THREE.TorusGeometry(0.41, 0.02, 4, 18), lam(0x6b7380), 0, 0, 0, body);
    v.rotation.y = (i / 4) * Math.PI;
    v.scale.y = 1.18;
  }
  mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 10), lam(0x5d6675), 0, 0.52, 0, body);
  const spoon = mesh(new THREE.BoxGeometry(0.09, 0.5, 0.04), lam(0x9aa3ad), 0.12, 0.38, 0.16, body);
  spoon.rotation.x = 0.35;
  spoon.rotation.z = -0.15;
  const ring = mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14), lam(0xc8ced8), -0.16, 0.6, 0, body);
  ring.rotation.y = Math.PI / 2;
  return g;
}
function updateGrenades(dt) {
  const s = V.latest,
    seen = new Set();
  if (s && s.gr)
    for (const g of s.gr) {
      seen.add(g[0]);
      if (!grView.has(g[0])) {
        const m = nadeMesh(1.15);
        m.material = m.userData.ball;
        scene.add(m);
        grView.set(g[0], {
          m,
          x: g[1] / 10,
          z: g[2] / 10,
          sx: g[3] / 10,
          sz: g[4] / 10,
          t0: now() - ((g[7] || g[5]) - g[5]) * 100,
          dur: (g[7] || g[5]) / 10 || 1,
        });
      }
    }
  for (const [id, v] of grView) {
    const k = Math.min(1, (now() - v.t0) / 1000 / v.dur),
      sy = unitY(v.sx, v.sz) + 2,
      ty = unitY(v.x, v.z) + 0.4;
    const hh = 1 + Math.hypot(v.x - v.sx, v.z - v.sz) * 0.12;
    v.m.position.set(lerp(v.sx, v.x, k), lerp(sy, ty, k) + Math.sin(k * Math.PI) * hh, lerp(v.sz, v.z, k));
    v.m.visible = !FOG.on || fogSeen(v.m.position.x, v.m.position.z); // a grenade thrown in the fog stays in the fog
    v.m.rotation.y += dt * 9;
    v.m.rotation.x += dt * 5;
    v.m.material.emissive.setHSL((clock * 2) % 1, 0.8, 0.35);
    if (!seen.has(id) && k >= 0.85) {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU,
          r = Math.random() * 5;
        puff(
          v.x + Math.cos(a) * r,
          ty + Math.random() * 1.5,
          v.z + Math.sin(a) * r,
          [0xff6bd5, 0x6be3ff, 0xffe66b, 0x9bff6b][i % 4],
          1,
          1.1
        );
      }
      word(TR('DISCO!'), v.x, ty + 3, v.z, { color: '#ff6bd5', scale: 1.6 });
      SFX.play('pop', { x: v.x, z: v.z, vol: 1.2 });
      scene.remove(v.m);
      disposeTree(v.m);
      grView.delete(id);
    }
  }
}
/* ---------- gold rush ---------- */
const coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18).rotateX(Math.PI / 2);
const bottleGeo = new THREE.LatheGeometry(
  [
    [0, 0],
    [0.12, 0],
    [0.13, 0.05],
    [0.13, 0.3],
    [0.06, 0.42],
    [0.05, 0.56],
    [0.055, 0.6],
    [0, 0.6],
  ].map(([a, b]) => new THREE.Vector2(a, b)),
  12
).translate(0, -0.3, 0);
const coinMat = new THREE.MeshLambertMaterial({ color: lin(0xf4c64f), emissive: lin(0x5a3a00) });
const bottleMat = new THREE.MeshLambertMaterial({ color: lin(0x48b06c), emissive: lin(0x0c3a1a) });
const rushName = team => (V.facs[team] === 'viking' ? TR('Goldrausch') : TR('Pfandflaschenrausch'));
function rushFx(team, x, z) {
  const gold = V.facs[team] === 'viking',
    y = groundY(x, z);
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(gold ? coinGeo : bottleGeo, gold ? coinMat : bottleMat);
    m.position.set(x, y + 1.4, z);
    m.castShadow = UNIT_SHADOWS;
    scene.add(m);
    const a = Math.random() * TAU,
      sp = 1.5 + Math.random() * 5;
    fx.coins.push({
      m,
      vx: Math.cos(a) * sp,
      vz: Math.sin(a) * sp,
      vy: 6 + Math.random() * 8,
      rx: (Math.random() - 0.5) * 16,
      ry: (Math.random() - 0.5) * 16,
      t: 0,
      life: 2.6 + Math.random() * 0.8,
    });
  }
  word(gold ? TR('GOLDRAUSCH!') : TR('PFANDRAUSCH!'), x, y + 5.8, z, { color: gold ? '#ffd34d' : '#86e3a6', scale: V.poss ? 2.4 : 1.7 });
  SFX.play('rush');
  if (team === V.myTeam) rushBanner(gold);
  else toast(TR('Der Gegner hat einen {0}!', rushName(team)), 2600);
}
function rushBanner(gold) {
  const el = $('#rush'),
    t = $('#rushT');
  t.textContent = gold ? TR('GOLDRAUSCH!') : TR('PFANDFLASCHENRAUSCH!');
  t.className = 'rt ' + (gold ? 'g' : 'p');
  $('#rushA').innerHTML = ICON[gold ? 'coin' : 'bottle'] + '+' + CFG.rush;
  el.hidden = false;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
  clearTimeout(rushBanner.t);
  rushBanner.t = setTimeout(() => {
    el.hidden = true;
  }, 2600);
  const target = V.poss ? $('#egoGold') : $('#gold'),
    tr = target.getBoundingClientRect(),
    box = target.parentElement;
  const layer = $('#coinLayer'),
    n = matchMedia('(prefers-reduced-motion:reduce)').matches ? 6 : 26;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'fly';
    c.innerHTML = ICON[gold ? 'coin' : 'bottle'];
    layer.appendChild(c);
    const x0 = innerWidth / 2 + (Math.random() - 0.5) * 220,
      y0 = innerHeight * 0.4 + (Math.random() - 0.5) * 120;
    if (!c.animate) {
      c.remove();
      continue;
    }
    const an = c.animate(
      [
        { transform: `translate(${x0}px,${y0}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${x0 + (Math.random() - 0.5) * 70}px,${y0 - 50}px) scale(1.2)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${tr.left + tr.width / 2 - 14}px,${tr.top + tr.height / 2 - 14}px) scale(0.6)`, opacity: 0.9 },
      ],
      { duration: 900 + Math.random() * 400, delay: i * 35, easing: 'cubic-bezier(.45,0,.75,.6)', fill: 'forwards' }
    );
    an.onfinish = () => {
      c.remove();
      box.classList.remove('pulse');
      void box.offsetWidth;
      box.classList.add('pulse');
      SFX.play('tick');
    };
  }
}
function updateFlag(i, owner, p, changed) {
  const F = flagViews[i];
  if (!F) return;
  if (owner !== F.owner) {
    F.owner = owner;
    if (F.cloth.material.map) F.cloth.material.map.dispose();
    F.cloth.material.map = ctex(flagCanvas(owner, V.facs));
    F.cloth.material.needsUpdate = true;
    F.ring.material.color.copy(lin(owner < 0 ? 0xffffff : FAC[V.facs[owner]].col));
    if (changed && V.playing) {
      if (owner >= 0) SFX.play(owner === V.myTeam ? 'capture' : 'lost');
      if (owner >= 0)
        toast(
          owner === V.myTeam
            ? !V.tut && flagSide(i) === 1 - V.myTeam
              ? TR('Fahne in Feindesland erobert! Bringt etwas weniger und verblasst ohne Wache.')
              : TR('Fahne erobert! Mehr Einkommen.')
            : TR('Der Gegner hat eine Fahne erobert.'),
          2400
        );
      puff(FLAGS[i].x, F.g.position.y + 4, FLAGS[i].z, owner < 0 ? 0xffffff : FAC[V.facs[owner]].col, 8);
    }
  }
  if (Math.abs(p - F.p) > 0.015) {
    F.p = p;
    F.prog.geometry.dispose();
    const a = Math.abs(p);
    F.prog.geometry =
      a < 0.01 ? new THREE.BufferGeometry() : conformRing(F.F, F.by, CFG.flagR - 0.8, CFG.flagR - 0.35, Math.PI / 2, a * TAU);
    F.prog.material.color.copy(lin(p > 0 ? FAC[V.facs[0]].col : FAC[V.facs[1]].col));
  }
}
