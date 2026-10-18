/* 22-map-view.js - Map view: terrain mesh and colours per map type, water, trees, rocks, bridges, flags (flagViews) - built once per match by buildMapView(MAP). */
/* ---------- map view ---------- */
let mapGroup = null,
  groundMesh = null,
  flagViews = [],
  miniBg = null,
  ICE_TEX = null;
function mapMaterial(mat) {
  mat.userData.mapOwned = true;
  return mat;
}
function segDist(px, pz, a, b) {
  const vx = b.x - a.x,
    vz = b.z - a.z,
    l2 = vx * vx + vz * vz || 1;
  const t = clamp(((px - a.x) * vx + (pz - a.z) * vz) / l2, 0, 1);
  return Math.hypot(px - a.x - vx * t, pz - a.z - vz * t);
}
function buildMapView(m) {
  if (mapGroup) {
    scene.remove(mapGroup);
    const geos = new Set(),
      mats = new Set(),
      textures = new Set();
    mapGroup.traverse(o => {
      if (o.geometry) geos.add(o.geometry);
      for (const mat of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) if (mat.userData.mapOwned) mats.add(mat);
    });
    for (const g of geos) g.dispose();
    for (const mat of mats) {
      if (mat.map && !mat.map.userData?.sharedMapTexture) textures.add(mat.map);
      mat.dispose();
    }
    for (const t of textures) t.dispose();
  }
  mapGroup = new THREE.Group();
  scene.add(mapGroup);
  water.visible = !m.frozen;
  const nx = ISLAND.w,
    nz = ISLAND.h;
  const geo = new THREE.PlaneGeometry(ISLAND.w, ISLAND.h, nx, nz).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    cols = new Float32Array(pos.count * 3),
    col = new THREE.Color(),
    r = rng(m.seed + 3);
  const segs = [];
  m.roads.forEach(p => {
    for (let i = 0; i < p.length - 1; i++) segs.push([p[i], p[i + 1]]);
  });
  const SG = 6,
    sgrid = new Map();
  segs.forEach((s, i) => {
    const x0 = Math.floor((Math.min(s[0].x, s[1].x) - 3) / SG),
      x1 = Math.floor((Math.max(s[0].x, s[1].x) + 3) / SG),
      z0 = Math.floor((Math.min(s[0].z, s[1].z) - 3) / SG),
      z1 = Math.floor((Math.max(s[0].z, s[1].z) + 3) / SG);
    for (let a = x0; a <= x1; a++)
      for (let b = z0; b <= z1; b++) {
        const k = a + ',' + b;
        if (!sgrid.has(k)) sgrid.set(k, []);
        sgrid.get(k).push(i);
      }
  });
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      h = sampleH(m, x, z);
    pos.setY(i, h);
    let rd = 9;
    const cand = sgrid.get(Math.floor(x / SG) + ',' + Math.floor(z / SG));
    if (cand) for (const si of cand) rd = Math.min(rd, segDist(x, z, segs[si][0], segs[si][1]));
    terrainColor(m, x, z, h, rd, col, r, slopeAt(m, x, z));
    cols[i * 3] = col.r;
    cols[i * 3 + 1] = col.g;
    cols[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  groundMesh = mesh(geo, mapMaterial(new THREE.MeshLambertMaterial({ vertexColors: true })), 0, 0, 0, mapGroup);
  groundMesh.receiveShadow = true;
  mesh(new THREE.BoxGeometry(ISLAND.w - 6, 6, ISLAND.h - 6), lam(0x7d6a4f), 0, -6.4, 0, mapGroup);
  if (m.lift) {
    // the abyss: a dark haze fills the gorge a few metres below the rim, with a soft brighter mist layer drifting on top
    const haze = mesh(
      new THREE.PlaneGeometry(ISLAND.w + 40, ISLAND.h + 40).rotateX(-Math.PI / 2),
      mapMaterial(new THREE.MeshBasicMaterial({ color: ABYSS_COL, transparent: true, opacity: 0.88, depthWrite: false })),
      0,
      m.lift - 7.2,
      0,
      mapGroup
    );
    haze.renderOrder = 1;
    const mistTex = (() => {
      const c = cnv(128, 128),
        x = c.getContext('2d');
      for (let i = 0; i < 12; i++) {
        const g2 = x.createRadialGradient(
          64 + (Math.random() - 0.5) * 40,
          64 + (Math.random() - 0.5) * 40,
          0,
          64,
          64,
          44 + Math.random() * 18
        );
        g2.addColorStop(0, 'rgba(190,205,235,.35)');
        g2.addColorStop(1, 'rgba(190,205,235,0)');
        x.fillStyle = g2;
        x.fillRect(0, 0, 128, 128);
      }
      return new THREE.CanvasTexture(c);
    })();
    const mistMat = mapMaterial(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    for (let i = 0; i < 70; i++) {
      let x,
        z,
        tries = 0;
      do {
        x = (Math.random() - 0.5) * 2 * HALF_W;
        z = (Math.random() - 0.5) * 2 * HALF_H;
      } while (!fallZoneIn(m, x, z) && ++tries < 40);
      if (tries >= 40) continue;
      const sp = new THREE.Sprite(mistMat.clone());
      const sc = 7 + Math.random() * 9;
      sp.scale.set(sc, sc * 0.45, 1);
      sp.position.set(x, m.lift - 5.6 + Math.random() * 1.6, z);
      sp.userData.mist = { x, z, ph: Math.random() * TAU };
      sp.renderOrder = 2;
      mapGroup.add(sp);
    }
  }
  const all = [...m.trees, ...m.decor];
  const pines = all.filter(t => t.ty === 0),
    rounds = all.filter(t => t.ty === 1),
    palms = all.filter(t => t.ty === 2),
    cdeco = all.filter(t => t.ty === 3),
    idec = all.filter(t => t.ty === 4);
  const mt = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    sc = new THREE.Vector3(),
    p = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  const inst = (geo2, mat, list, fn) =>
    chunkedInstances(
      [{ geo: geo2, mat }],
      list,
      (t, i, m4, cOut) => {
        let hc = false;
        fn(t, i, {
          setMatrixAt: (j, mm) => m4.copy(mm),
          setColorAt: (j, cc) => {
            cOut.copy(cc);
            hc = true;
          },
        });
        return hc;
      },
      { recv: true, shadowTier: 1 }
    );
  const leafMat = mapMaterial(windMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.024)),
    THM = THEMES[m.theme || 'summer'],
    PH = THM.pine,
    RL = THM.round,
    TF = THM.tuft;
  const tr = t => sampleH(m, t.x, t.z);
  inst(
    new THREE.CylinderGeometry(0.16, 0.24, 1.4, 6),
    lam(0x6b4a2e),
    all.filter(t => t.ty <= 1),
    (t, i, im) => {
      mt.compose(p.set(t.x, tr(t) + 0.7 * t.s, t.z), q.identity(), sc.setScalar(t.s));
      im.setMatrixAt(i, mt);
    }
  );
  inst(flat(new THREE.ConeGeometry(1.35, 2.4, 7)), leafMat, pines, (t, i, im) => {
    q.setFromAxisAngle(up, t.x * 7);
    mt.compose(p.set(t.x, tr(t) + 2.1 * t.s, t.z), q, sc.setScalar(t.s));
    im.setMatrixAt(i, mt);
    im.setColorAt(i, col.setHSL(PH[0] + ((t.z * 13) % 1) * 0.05, PH[1], PH[2] + ((((t.x * 7) % 1) + 1) % 1) * 0.07).convertSRGBToLinear());
  });
  inst(flat(new THREE.ConeGeometry(1.0, 1.9, 7)), leafMat, pines, (t, i, im) => {
    q.setFromAxisAngle(up, t.z * 5);
    mt.compose(p.set(t.x, tr(t) + 3.3 * t.s, t.z), q, sc.setScalar(t.s));
    im.setMatrixAt(i, mt);
    im.setColorAt(
      i,
      col
        .setHSL(PH[0] + ((t.z * 13) % 1) * 0.05, PH[1], (m.theme === 'winter' ? 0.75 : PH[2] + 0.04) + ((((t.x * 7) % 1) + 1) % 1) * 0.07)
        .convertSRGBToLinear()
    );
  });
  inst(flat(new THREE.IcosahedronGeometry(1.3, 0)), leafMat, rounds, (t, i, im) => {
    q.setFromAxisAngle(up, t.x);
    mt.compose(p.set(t.x, tr(t) + 2.3 * t.s, t.z), q, sc.set(t.s, t.s * 1.1, t.s));
    im.setMatrixAt(i, mt);
    {
      const rc = RL[Math.floor(((((t.x * 3.7 + t.z * 1.3) % 1) + 1) % 1) * RL.length)];
      im.setColorAt(i, col.setHSL(rc[0] + ((((t.z * 11) % 1) + 1) % 1) * 0.04, rc[1], rc[2]).convertSRGBToLinear());
    }
  });
  {
    // desert palms & cacti, arctic igloos, ice shards
    const cactMat = lam(0x4f8f3a),
      spikeMat = lam(0xf3ecd2);
    const cactGeo = (() => {
      const g = new THREE.Group();
      mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.2, 8).translate(0, 1.1, 0), cactMat, 0, 0, 0, g);
      mesh(new THREE.SphereGeometry(0.28, 8, 6), cactMat, 0, 2.2, 0, g);
      [
        [-1, 1.1, 0.7],
        [1, 1.5, 0.55],
      ].forEach(([sx, y, l]) => {
        mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 7).rotateZ(Math.PI / 2), cactMat, sx * 0.45, y, 0, g);
        mesh(new THREE.CylinderGeometry(0.16, 0.18, l, 7), cactMat, sx * 0.68, y + l / 2, 0, g);
        mesh(new THREE.SphereGeometry(0.16, 7, 5), cactMat, sx * 0.68, y + l, 0, g);
      });
      for (let k = 0; k < 18; k++) {
        const a = k * 2.4,
          y = 0.3 + (k % 6) * 0.33;
        const sp = mesh(new THREE.ConeGeometry(0.03, 0.18, 4), spikeMat, Math.cos(a) * 0.31, y, Math.sin(a) * 0.31, g);
        sp.rotation.z = -Math.cos(a) * 1.4;
        sp.rotation.x = Math.sin(a) * 1.4;
      }
      if (Math.random() < 2) mesh(new THREE.SphereGeometry(0.1, 6, 5), lam(0xff5f8f), 0.05, 2.45, 0.05, g);
      return g;
    })();
    const qy = new THREE.Quaternion(),
      yAx = new THREE.Vector3(0, 1, 0),
      pv = new THREE.Vector3(),
      sv = new THREE.Vector3();
    const placeY =
      (x, z, s, a, y0 = 0) =>
      (t, i, m4) => {
        qy.setFromAxisAngle(yAx, a(t));
        m4.compose(pv.set(x(t), sampleH(m, x(t), z(t)) + y0, z(t)), qy, sv.setScalar(s(t)));
        return false;
      };
    chunkedInstances(
      bakeTemplate(cactGeo),
      [...(m.cacti || []), ...cdeco.map(t => ({ x: t.x, z: t.z, s: t.s }))],
      placeY(
        t => t.x,
        t => t.z,
        t => t.s,
        t => t.x * 3.1
      ),
      { shadowTier: 1, ink: true }
    );
    const palmGeo = (() => {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const seg = mesh(
          new THREE.CylinderGeometry(0.15 - k * 0.012, 0.18 - k * 0.012, 0.6, 7),
          lam(0x8b6a43),
          k * 0.07,
          0.3 + k * 0.56,
          0,
          g
        );
        seg.rotation.z = -0.12;
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU,
          lf = mesh(new THREE.ConeGeometry(0.28, 2.2, 4).rotateX(Math.PI / 2).translate(0, 0, 1.1), lam(0x4f9a3a), 0.42, 3.4, 0, g);
        lf.rotation.y = a;
        lf.rotation.x = 0.55;
        lf.scale.set(1, 0.25, 1);
      }
      return g;
    })();
    chunkedInstances(
      bakeTemplate(palmGeo),
      palms,
      placeY(
        t => t.x,
        t => t.z,
        t => t.s,
        t => t.z * 2.3
      ),
      { shadowTier: 1, ink: true }
    );
    const iglooGeo = (() => {
      const g = new THREE.Group(),
        snow = lam(0xf4f8fb),
        sh = lam(0xdfe8ef);
      mesh(new THREE.SphereGeometry(1.8, 16, 10, 0, TAU, 0, Math.PI / 2), snow, 0, 0, 0, g);
      for (let k = 1; k < 4; k++)
        mesh(new THREE.TorusGeometry(1.8 * Math.cos(k * 0.38), 0.03, 4, 28).rotateX(Math.PI / 2), sh, 0, 1.8 * Math.sin(k * 0.38), 0, g);
      const tun = mesh(
        new THREE.CylinderGeometry(0.75, 0.75, 1.4, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2),
        snow,
        0,
        0,
        1.8,
        g
      );
      mesh(new THREE.CircleGeometry(0.55, 12, 0, Math.PI), lam(0x2a3442), 0, 0.02, 2.51, g);
      return g;
    })();
    chunkedInstances(
      bakeTemplate(iglooGeo),
      [...(m.igloos || []), ...idec.map(t => ({ x: t.x, z: t.z, a: t.x }))],
      placeY(
        t => t.x,
        t => t.z,
        () => 1,
        t => t.a
      ),
      { recv: true, ink: true }
    );
  }
  {
    // grass tufts and flowers
    const gr = rng(m.seed + 11),
      tufts = [],
      flowers = [];
    for (let i = 0; i < 5200 && tufts.length < 2600; i++) {
      const x = (gr() - 0.5) * (ISLAND.w - 8),
        z = (gr() - 0.5) * (ISLAND.h - 8),
        h = sampleH(m, x, z);
      if (h < WL + 0.7 || slopeAt(m, x, z) > 0.75) continue;
      if (m.flags.some(f => (f.x - x) ** 2 + (f.z - z) ** 2 < 42) || m.bases.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < 64)) continue;
      const cand = sgrid.get(Math.floor(x / SG) + ',' + Math.floor(z / SG));
      let rd = 9;
      if (cand) for (const si of cand) rd = Math.min(rd, segDist(x, z, segs[si][0], segs[si][1]));
      if (rd < 2.2) continue;
      if (onBridge(m, x, z)) continue;
      if (gr() < THM.fl) flowers.push({ x, z, y: h, c: gr() });
      else tufts.push({ x, z, y: h, s: 0.6 + gr() * 0.8, a: gr() * TAU, c: gr() });
    }
    const blade = new THREE.ConeGeometry(0.07, 0.5, 3).translate(0, 0.25, 0),
      g3 = new THREE.BufferGeometry();
    {
      const parts = [0, 1, 2].map(i =>
        blade
          .clone()
          .rotateZ((i - 1) * 0.35)
          .rotateY(i * 2.1)
          .translate((i - 1) * 0.06, 0, 0)
      );
      const pos = [];
      parts.forEach(pg => {
        const nn = pg.toNonIndexed();
        pos.push(...nn.attributes.position.array);
      });
      g3.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g3.computeVertexNormals();
    }
    chunkedInstances(
      [{ geo: g3, mat: mapMaterial(windMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.17)) }],
      tufts,
      (t, i, m4, cOut) => {
        q.setFromAxisAngle(up, t.a);
        m4.compose(p.set(t.x, t.y - 0.02, t.z), q, sc.setScalar(t.s));
        cOut.setHSL(TF[0] + t.c * 0.07, TF[1], TF[2] + t.c * 0.1).convertSRGBToLinear();
        return true;
      },
      { cast: false, recv: true, deco: true, chunk: 30 }
    ).forEach(im => {
      im.userData.tuft = true;
    });
    const fcols = [0xffffff, 0xffd84d, 0xff8fb8, 0xb58cff, 0xff6b4a];
    chunkedInstances(
      [
        {
          geo: new THREE.IcosahedronGeometry(0.11, 0),
          mat: mapMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222222 })),
        },
      ],
      flowers,
      (f, i, m4, cOut) => {
        m4.compose(p.set(f.x, f.y + 0.22, f.z), q.identity(), sc.setScalar(1));
        cOut.set(fcols[Math.floor(f.c * 5) % 5]).convertSRGBToLinear();
        return true;
      },
      { cast: false, deco: true, chunk: 30 }
    );
  }
  const rockGeo = flat(new THREE.DodecahedronGeometry(1, 0));
  if (m.frozen) {
    // crystal ice sheet with a scratched, cracked texture
    if (!ICE_TEX) {
      const N = 1024,
        c = cnv(N, N),
        x = c.getContext('2d');
      let sd = 7;
      const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      x.fillStyle = '#6ccdf6';
      x.fillRect(0, 0, N, N);
      // soft cloudy depth (tileable: draw each blob 9x with wrap offsets)
      const wrap = f => {
        for (const ox of [-N, 0, N])
          for (const oy of [-N, 0, N]) {
            x.save();
            x.translate(ox, oy);
            f();
            x.restore();
          }
      };
      for (let i = 0; i < 46; i++) {
        const cx = rr() * N,
          cy = rr() * N,
          r = 60 + rr() * 240,
          light = rr() < 0.5,
          a = 0.08 + rr() * 0.12;
        wrap(() => {
          const g2 = x.createRadialGradient(cx, cy, 0, cx, cy, r);
          g2.addColorStop(0, light ? `rgba(235,250,255,${a})` : `rgba(20,110,170,${a})`);
          g2.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g2;
          x.fillRect(cx - r, cy - r, r * 2, r * 2);
        });
      }
      // frost grain
      for (let i = 0; i < 9000; i++) {
        x.fillStyle = `rgba(255,255,255,${0.04 + rr() * 0.1})`;
        const r2 = 0.6 + rr() * 1.6;
        x.fillRect(rr() * N, rr() * N, r2, r2);
      }
      // trapped air bubbles
      for (let i = 0; i < 140; i++) {
        const bx = rr() * N,
          by = rr() * N,
          br = 1.5 + rr() * 4.5;
        x.strokeStyle = 'rgba(255,255,255,.45)';
        x.lineWidth = 1;
        x.beginPath();
        x.arc(bx, by, br, 0, TAU);
        x.stroke();
        x.fillStyle = 'rgba(255,255,255,.18)';
        x.beginPath();
        x.arc(bx - br * 0.3, by - br * 0.3, br * 0.4, 0, TAU);
        x.fill();
      }
      // skate scratches
      x.lineCap = 'round';
      for (let i = 0; i < 110; i++) {
        const x0 = rr() * N,
          y0 = rr() * N,
          a = rr() * TAU,
          l = 40 + rr() * 220,
          bend = (rr() - 0.5) * 60;
        x.strokeStyle = `rgba(255,255,255,${0.12 + rr() * 0.3})`;
        x.lineWidth = 0.5 + rr() * 1.2;
        wrap(() => {
          x.beginPath();
          x.moveTo(x0, y0);
          x.quadraticCurveTo(
            x0 + (Math.cos(a) * l) / 2 - Math.sin(a) * bend,
            y0 + (Math.sin(a) * l) / 2 + Math.cos(a) * bend,
            x0 + Math.cos(a) * l,
            y0 + Math.sin(a) * l
          );
          x.stroke();
        });
      }
      // cracks: dark core + white edge
      for (let i = 0; i < 14; i++) {
        let px = rr() * N,
          py = rr() * N;
        const pts = [[px, py]];
        for (let k = 0; k < 9; k++) {
          px += (rr() - 0.5) * 110;
          py += (rr() - 0.5) * 110;
          pts.push([px, py]);
        }
        [
          ['rgba(255,255,255,.55)', 2.4],
          ['rgba(20,80,130,.55)', 1],
        ].forEach(([col, w]) => {
          x.strokeStyle = col;
          x.lineWidth = w;
          wrap(() => {
            x.beginPath();
            x.moveTo(pts[0][0], pts[0][1]);
            pts.slice(1).forEach(q => x.lineTo(q[0], q[1]));
            x.stroke();
            pts.forEach((q, k) => {
              if (k % 3 === 1) {
                x.beginPath();
                x.moveTo(q[0], q[1]);
                x.lineTo(q[0] + (rr() - 0.5) * 60, q[1] + (rr() - 0.5) * 60);
                x.stroke();
              }
            });
          });
        });
      }
      ICE_TEX = new THREE.CanvasTexture(c);
      ICE_TEX.userData = { sharedMapTexture: true };
      ICE_TEX.wrapS = ICE_TEX.wrapT = THREE.RepeatWrapping;
      ICE_TEX.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
      ICE_TEX.minFilter = THREE.LinearMipmapLinearFilter;
      if (THREE.sRGBEncoding) ICE_TEX.encoding = THREE.sRGBEncoding;
    }
    const tex = ICE_TEX,
      pos = [],
      uv = [],
      al = [],
      S = 1,
      iceH = (x2, z2) => {
        const h = sampleH(m, x2, z2);
        return h < WL + 0.4 ? Math.max(h, WL + 0.1) + 0.04 : h + 0.05;
      };
    // Cover all island shores; the outer sheet below continues to the horizon.
    for (let z2 = -ISLAND.h / 2; z2 < ISLAND.h / 2; z2 += S)
      for (let x2 = -ISLAND.w / 2; x2 < ISLAND.w / 2; x2 += S) {
        const cs = [
          [x2, z2],
          [x2 + S, z2],
          [x2 + S, z2 + S],
          [x2, z2 + S],
        ];
        if (!cs.some(([a, b]) => sampleH(m, a, b) < WL + 0.42) || onBridge(m, x2 + S / 2, z2 + S / 2)) continue;
        [
          [0, 2, 1],
          [0, 3, 2],
        ].forEach(t =>
          t.forEach(i => {
            const [a, b] = cs[i];
            pos.push(a, iceH(a, b), b);
            uv.push(a / 14, b / 14);
            al.push(sstep(WL + 0.46, WL + 0.14, sampleH(m, a, b)));
          })
        );
      }
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('aA', new THREE.Float32BufferAttribute(al, 1));
      g.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(
          new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)),
          3
        )
      );
      const imat = mapMaterial(
        new THREE.MeshPhongMaterial({
          map: tex,
          color: 0xffffff,
          specular: 0xffffff,
          shininess: 160,
          transparent: true,
          opacity: 0.95,
          emissive: lin(0x08304c),
          depthWrite: false,
        })
      );
      imat.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aA;\nvarying float vA;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aA;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vA;')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vA;');
        fogInject(sh);
      };
      const im = new THREE.Mesh(g, imat);
      im.receiveShadow = false;
      im.renderOrder = 1;
      im.userData.iceSheet = true;
      mapGroup.add(im);
      const oceanGeo = new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2),
        oceanUV = oceanGeo.attributes.uv;
      for (let i = 0; i < oceanUV.count; i++)
        oceanUV.setXY(i, oceanGeo.attributes.position.getX(i) / 14, oceanGeo.attributes.position.getZ(i) / 14);
      oceanGeo.setAttribute('aA', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
      const ocean = mesh(oceanGeo, imat, 0, WL + 0.1, 0, mapGroup);
      ocean.renderOrder = 1;
      ocean.userData.frozenOcean = true;
    }
  }
  const iceMat = mapMaterial(
      new THREE.MeshPhongMaterial({
        color: lin(0xbfe6f5),
        emissive: lin(0x1c3a4a),
        shininess: 90,
        specular: lin(0xffffff),
        transparent: true,
        opacity: 0.88,
        flatShading: true,
      })
    ),
    rockCol = m.type === 'wueste' ? 0xc19a6b : m.type === 'klippen' ? 0x86827a : 0x8f918b;
  {
    const iceR = m.rocks.filter(R => R.ice),
      stoneR = m.rocks.filter(R => !R.ice),
      qq = new THREE.Quaternion(),
      yA = new THREE.Vector3(0, 1, 0),
      pp = new THREE.Vector3(),
      ss = new THREE.Vector3();
    if (iceR.length) {
      const tpl = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3,
          hgt = 1.6 + (k % 3) * 0.7,
          sh = mesh(flat(new THREE.ConeGeometry(0.45, hgt, 5)), iceMat, Math.cos(a) * 0.45, hgt / 2, Math.sin(a) * 0.45, tpl);
        sh.rotation.z = Math.cos(a) * 0.25;
        sh.rotation.x = Math.sin(a) * 0.25;
      }
      chunkedInstances(
        bakeTemplate(tpl),
        iceR,
        (R, i, m4) => {
          qq.setFromAxisAngle(yA, -R.x);
          m4.compose(pp.set(R.x, sampleH(m, R.x, R.z), R.z), qq, ss.setScalar(R.r));
          return false;
        },
        { recv: true }
      );
    }
    chunkedInstances(
      [{ geo: rockGeo, mat: lam(rockCol) }],
      stoneR,
      (R, i, m4) => {
        qq.setFromAxisAngle(yA, R.x);
        m4.compose(pp.set(R.x, sampleH(m, R.x, R.z) + R.r * 0.3, R.z), qq, ss.set(R.r * 1.1, R.r * (m.type === 'wueste' ? 1.1 : 0.8), R.r));
        return false;
      },
      { recv: true, ink: true }
    );
  }
  if (m.lift)
    for (const B of m.br) {
      const br = new THREE.Group(),
        wood = lam(0x8a5a35),
        rope = lam(0xc9b48a),
        N = Math.ceil((B.z1 - B.z0) / 0.55);
      for (let i = 0; i <= N; i++) {
        const z = B.z0 + ((B.z1 - B.z0) * i) / N,
          y = deckY(B, z) - 0.08;
        const pl = mesh(new THREE.BoxGeometry(2.9, 0.09, 0.42), wood, B.x + (i % 2 ? 0.04 : -0.04), y, z, br);
        pl.rotation.y = ((i % 3) - 1) * 0.03;
      }
      [-1, 1].forEach(sx => {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const z = B.z0 + ((B.z1 - B.z0) * i) / 20;
          pts.push(new THREE.Vector3(B.x + sx * 1.5, deckY(B, z) + 1.0, z));
        }
        const crv = new THREE.CatmullRomCurve3(pts);
        mesh(new THREE.TubeGeometry(crv, 40, 0.05, 5, false), rope, 0, 0, 0, br);
        const pts2 = pts.map(p => new THREE.Vector3(p.x, p.y - 0.95, p.z));
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 40, 0.04, 5, false), rope, 0, 0, 0, br);
        for (let i = 0; i <= 20; i += 2) {
          const p = pts[i];
          mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4), rope, p.x, p.y - 0.5, p.z, br);
        }
        [B.z0 - 0.3, B.z1 + 0.3].forEach((z, j) => {
          const y = j ? B.y1 : B.y0;
          mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.2, 7), wood, B.x + sx * 1.55, y + 0.6, z, br);
        });
      });
      bakeTree(br, new Set(), { nocache: true });
      shadows(br, true, true);
      mapGroup.add(br);
    }
  else
    for (const B of m.br) {
      const bx = B.x,
        bz = (B.z0 + B.z1) / 2,
        len = B.z1 - B.z0,
        br = new THREE.Group();
      br.position.set(bx, 0, bz);
      mesh(new THREE.BoxGeometry(4, 0.3, len), lam(0x8a5a35), 0, 0.45, 0, br);
      for (let i = -len / 2 + 0.6; i < len / 2; i += 0.9) mesh(new THREE.BoxGeometry(4.1, 0.06, 0.5), lam(0x6f4527), 0, 0.62, i, br);
      [-1, 1].forEach(s => {
        mesh(new THREE.BoxGeometry(0.18, 0.18, len), lam(0x5f3b21), s * 1.95, 1.4, 0, br);
        for (let i = -len / 2 + 0.3; i <= len / 2; i += 2.2) mesh(new THREE.BoxGeometry(0.2, 1, 0.2), lam(0x5f3b21), s * 1.95, 1, i, br);
      });
      bakeTree(br, new Set(), { nocache: true });
      shadows(br, true, true);
      mapGroup.add(br);
    }
  PADV.length = 0;
  (m.pads || []).forEach(pd => {
    const g = new THREE.Group(),
      y = sampleH(m, pd.x, pd.z),
      direction = padLocal(pd, pd.x, pd.z);
    g.position.set(pd.x, y + 0.02, pd.z);
    g.rotation.y = Math.atan2(direction.fx, direction.fz);
    const wood = lam(0x8a5a2b),
      dark = lam(0x4a3220),
      metal = lam(0x9aa3ad),
      red = mapMaterial(new THREE.MeshLambertMaterial({ color: lin(0xe0442e), emissive: lin(0x401008) })),
      W2 = PAD_W,
      D2 = PAD_D;
    // pit frame (local +z = launch direction)
    [-1, 1].forEach(sx => mesh(new THREE.BoxGeometry(0.22, 0.32, D2 * 2 + 0.3), dark, sx * (W2 + 0.12), 0.13, 0, g));
    [-1, 1].forEach(sz => mesh(new THREE.BoxGeometry(W2 * 2 + 0.46, 0.32, 0.22), dark, 0, 0.13, sz * (D2 + 0.12), g));
    mesh(new THREE.BoxGeometry(W2 * 2, 0.04, D2 * 2), lam(0x2a2018), 0, 0.02, 0, g);
    // two big springs under the free (rear) end
    const spring = new THREE.Group();
    spring.position.set(0, 0.04, -D2 * 0.45);
    g.add(spring);
    [-1, 1].forEach(sx => {
      for (let k = 0; k < 7; k++)
        mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 18).rotateX(Math.PI / 2), metal, sx * W2 * 0.45, 0.03 + k * 0.033, 0, spring);
    });
    // plank hinged at the FRONT edge: the rear end snaps up and flings everyone forward
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.32, D2 - 0.05);
    g.add(hinge);
    const plank = new THREE.Group();
    plank.position.z = -(D2 - 0.05);
    hinge.add(plank);
    const nb = 7;
    for (let b = 0; b < nb; b++) {
      const bd = mesh(
        new THREE.BoxGeometry(W2 * 2 - 0.1, 0.11, (D2 * 2) / nb - 0.04),
        b % 2 ? wood : lam(0x9a6634),
        0,
        0,
        -D2 + ((b + 0.5) * D2 * 2) / nb,
        plank
      );
      bd.castShadow = true;
    }
    [-1, 1].forEach(sx => mesh(new THREE.BoxGeometry(0.14, 0.15, D2 * 2 - 0.2), dark, sx * (W2 - 0.25), -0.09, 0, plank));
    const arr = mesh(
      new THREE.ShapeGeometry(
        (() => {
          const sh = new THREE.Shape();
          sh.moveTo(0, 1.1);
          sh.lineTo(0.8, 0.1);
          sh.lineTo(0.3, 0.1);
          sh.lineTo(0.3, -0.9);
          sh.lineTo(-0.3, -0.9);
          sh.lineTo(-0.3, 0.1);
          sh.lineTo(-0.8, 0.1);
          sh.closePath();
          return sh;
        })()
      )
        .rotateX(-Math.PI / 2)
        .rotateY(Math.PI),
      red,
      0,
      0.065,
      0,
      plank
    );
    arr.scale.setScalar(1.22);
    const chevGeo = new THREE.ShapeGeometry(
      (() => {
        const sh = new THREE.Shape();
        sh.moveTo(-0.52, -0.24);
        sh.lineTo(0, 0.35);
        sh.lineTo(0.52, -0.24);
        sh.lineTo(0.52, -0.5);
        sh.lineTo(0, 0.08);
        sh.lineTo(-0.52, -0.5);
        sh.closePath();
        return sh;
      })()
    )
      .rotateX(-Math.PI / 2)
      .rotateY(Math.PI);
    [-1, 1].forEach(side => mesh(chevGeo, lam(0xffd76d), side * W2 * 0.7, 0.07, -0.1, plank));
    mesh(new THREE.CylinderGeometry(0.07, 0.07, W2 * 2 + 0.2, 8).rotateZ(Math.PI / 2), metal, 0, 0, 0, hinge);
    bakeTree(g, new Set([arr]), { nocache: true });
    shadows(g, true, true);
    mapGroup.add(g);
    PADV.push({ g, hinge, spring, arr, n: -1, t: 9, cd: 0 });
  });
  flagViews = m.flags.map(F => {
    const fg = new THREE.Group(),
      by = sampleH(m, F.x, F.z);
    fg.position.set(F.x, by, F.z);
    mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.8, 8), lam(0xa5a9b0), 0, 2.4, 0, fg).castShadow = true;
    mesh(new THREE.SphereGeometry(0.18, 10, 8), lam(0xf2c14e), 0, 4.9, 0, fg);
    const clothGeo = new THREE.PlaneGeometry(2, 1.3, 8, 1).translate(1, 0, 0);
    const cloth = mesh(clothGeo, mapMaterial(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })), 0.05, 4.1, 0, fg);
    cloth.castShadow = true;
    const ring = mesh(conformRing(F, by, CFG.flagR - 0.22, CFG.flagR, 0, TAU), mapMaterial(basic(0xffffff, 0.75)), 0, 0, 0, fg);
    const prog = mesh(new THREE.BufferGeometry(), mapMaterial(basic(0xffffff, 0.95)), 0, 0, 0, fg);
    bakeTree(fg, new Set([cloth, ring, prog]), { nocache: true });
    mapGroup.add(fg);
    return { g: fg, by, F, cloth, base: clothGeo.attributes.position.array.slice(), ring, prog, owner: -2, p: -999 };
  });
  // static scenery: compute matrices once instead of every frame (jump pads keep animating)
  mapGroup.traverse(o => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  PADV.forEach(pv =>
    pv.g.traverse(o => {
      o.matrixAutoUpdate = true;
    })
  );
  if (typeof applyMapQuality === 'function' && typeof QS !== 'undefined') applyMapQuality();
  const W = 70,
    H = Math.round((70 * HALF_H) / HALF_W);
  miniBg = cnv(W, H);
  const mx = miniBg.getContext('2d'),
    img = mx.createImageData(W, H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = -HALF_W + ((i + 0.5) / W) * 2 * HALF_W,
        z = -HALF_H + ((j + 0.5) / H) * 2 * HALF_H,
        h = sampleH(m, x, z),
        k = (j * W + i) * 4;
      let c;
      if (onBridge(m, x, z)) c = [150, 100, 60];
      else if (h < WL + 0.2) c = [70, 145, 185];
      else if (!walkableIn(m, x, z)) c = [44, 84, 46];
      else {
        const v = clamp((h + 1) / 6, 0, 1);
        c = [96 + v * 46, 142 + v * 28, 70 + v * 26];
      }
      img.data[k] = c[0];
      img.data[k + 1] = c[1];
      img.data[k + 2] = c[2];
      img.data[k + 3] = 255;
    }
  mx.putImageData(img, 0, 0);
  mx.strokeStyle = 'rgba(214,186,130,.9)';
  mx.lineWidth = 1.2;
  m.roads.forEach(pth => {
    mx.beginPath();
    pth.forEach((pt, i) => {
      const X = ((pt.x + HALF_W) / (2 * HALF_W)) * W,
        Z = ((pt.z + HALF_H) / (2 * HALF_H)) * H;
      i ? mx.lineTo(X, Z) : mx.moveTo(X, Z);
    });
    mx.stroke();
  });
}
function conformRing(F, by, r1, r2, a0, len) {
  const g = new THREE.RingGeometry(r1, r2, 64, 1, a0, len).rotateX(-Math.PI / 2),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, sampleH(MAP, F.x + p.getX(i), F.z + p.getZ(i)) - by + 0.09);
  return g;
}
const ABYSS_COL = lin(0x0b1020);
const TC = {
  sand: lin(0xcdb680),
  bed: lin(0x9a8158),
  road: lin(0xb08e5c),
  roadEdge: lin(0x8f8a55),
  plaza: lin(0xa39b84),
  base: lin(0x978e78),
  rock: lin(0x85837a),
  lo: lin(0x4d8236),
  hi: lin(0x7da44a),
};
const THC = {};
function themeCols(m) {
  const k = m.theme || 'summer';
  if (!THC[k]) {
    const T = THEMES[k];
    THC[k] = { lo: lin(T.lo), hi: lin(T.hi), sand: T.sand ? lin(T.sand) : TC.sand, rock: T.rock ? lin(T.rock) : TC.rock };
  }
  return THC[k];
}
function terrainColor(m, x, z, h, rd, col, r, slope) {
  const inPlay = Math.abs(x) < HALF_W + 1 && Math.abs(z) < HALF_H + 1,
    TH = themeCols(m);
  if (h < WL + 0.05) return col.copy(TC.bed);
  if (m.lift) {
    if (h < m.lift - 1.5 && inPlay) {
      const strata = Math.sin(h * 1.9 + x * 0.055 + z * 0.035) * 0.045,
        depth = clamp((h + 9) / (m.lift + 7.5), 0, 1);
      col.copy(TH.rock).multiplyScalar(0.12 + 0.62 * depth * depth + strata);
      col.lerp(ABYSS_COL, (1 - depth) * 0.75);
      return col;
    }
    h -= m.lift;
  }
  const v = clamp((h - 0.4) / 4.5, 0, 1);
  col.copy(TH.lo).lerp(TH.hi, v);
  const j = (r() - 0.5) * 0.035;
  col.r += j;
  col.g += j * 1.2;
  col.b += j * 0.6;
  if (m.frozen && h < WL + 0.45) {
    col.setRGB(0.42, 0.78, 0.95);
    const st = (Math.sin(x * 1.7 + z * 0.6) + Math.sin(x * 0.4 - z * 2.1)) * 0.03;
    col.r += st;
    col.g += st;
    col.b += st * 0.5;
    return col;
  }
  if (h < WL + 0.9) col.lerp(TH.sand, sstep(WL + 0.9, WL + 0.45, h));
  else if (!m.frozen && m.type !== 'wueste' && h < WL + 1.6) col.multiplyScalar(0.94 + 0.06 * sstep(WL + 0.9, WL + 1.6, h));
  if (inPlay) {
    if (rd < 2.2) col.lerp(rd < 1.3 ? TC.road : TC.roadEdge, sstep(2.2, 1.0, rd));
    for (const f of m.flags) {
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < CFG.flagR + 0.6) col.lerp(TC.plaza, sstep(CFG.flagR + 0.6, CFG.flagR - 0.6, d) * 0.85);
    }
    for (const b of m.bases) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < 11) col.lerp(TC.base, sstep(11, 9, d));
    }
  }
  if (h > 6) col.lerp(TH.rock, sstep(6, 7.5, h));
  // Gentle meadow banks remain grassy; sheer slopes visibly read as rock.
  const rockStart = m.type === 'wiesen' ? 0.9 : 0.65,
    rockEnd = m.type === 'wiesen' ? 1.4 : 1.1;
  if (slope > rockStart) col.lerp(TH.rock, sstep(rockStart, rockEnd, slope));
  return col;
}
