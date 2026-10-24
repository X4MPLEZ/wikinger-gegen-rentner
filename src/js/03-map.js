/* 03-map.js - MAP GENERATION and terrain queries (deterministic from the seed, point-symmetric): genMap/setMap, groundY/unitY, walkable, findPath (A*),
   bridges, jump pads, ice. Also the shared body physics: startAir/airStep (flight), advanceGround (walking with edge slide), startFall, kbStep. */
let MAP = null,
  BASES = [],
  FLAGS = [];
function riverZ(m, x) {
  return m.rA * Math.sin(m.rk * x) + m.rA2 * Math.sin(3 * m.rk * x) + (m.rT || 0) * x;
}
function riverDist(m, x, z) {
  return m.ring ? Math.abs(Math.hypot(x, z) - m.ringR) : Math.abs(z - riverZ(m, x));
}
function crevDist(m, x, z) {
  let d = 99;
  if (m.crev) for (const c of m.crev) d = Math.min(d, segDist(x, z, { x: c.ax, z: c.az }, { x: c.bx, z: c.bz }) - c.w);
  return d;
}
const MAPTYPES = {
    wiesen: { n: TR('Wiesen'), ic: si('flower') },
    wueste: { n: TR('Wüste'), ic: si('cactus') },
    arktis: { n: TR('Arktis'), ic: si('snow') },
    klippen: { n: TR('Klippen'), ic: si('mountain') },
  },
  MAPTYPE_KEYS = ['wiesen', 'wueste', 'arktis', 'klippen'];
const THEMES = {
  summer: {
    n: TR('Sommerwiese'),
    lo: 0x4d8236,
    hi: 0x7da44a,
    pine: [0.3, 0.42, 0.2],
    round: [[0.22, 0.45, 0.3]],
    tuft: [0.24, 0.5, 0.3],
    fl: 0.12,
    trees: 1,
  },
  spring: {
    n: TR('Frühlingstal'),
    lo: 0x5f9a3c,
    hi: 0x9cc65e,
    pine: [0.31, 0.45, 0.24],
    round: [
      [0.25, 0.5, 0.36],
      [0.93, 0.55, 0.78],
      [0.25, 0.5, 0.36],
    ],
    tuft: [0.25, 0.55, 0.36],
    fl: 0.3,
    trees: 1,
  },
  autumn: {
    n: TR('Herbstwald'),
    lo: 0x6f8a3a,
    hi: 0xa39a48,
    pine: [0.3, 0.35, 0.19],
    round: [
      [0.06, 0.75, 0.45],
      [0.11, 0.8, 0.5],
      [0.02, 0.7, 0.42],
      [0.15, 0.6, 0.4],
    ],
    tuft: [0.16, 0.45, 0.36],
    fl: 0.04,
    trees: 1.3,
  },
  desert: {
    n: TR('Wüste'),
    lo: 0xd6b072,
    hi: 0xe9cf95,
    pine: [0.27, 0.3, 0.22],
    round: [[0.25, 0.45, 0.3]],
    tuft: [0.13, 0.45, 0.5],
    fl: 0.02,
    trees: 0.3,
    sand: 0xe8d39e,
    rock: 0xb7865a,
  },
  cliffs: {
    n: TR('Klippen'),
    lo: 0x56803f,
    hi: 0x86a35e,
    pine: [0.31, 0.38, 0.19],
    round: [[0.24, 0.42, 0.28]],
    tuft: [0.24, 0.45, 0.3],
    fl: 0.06,
    trees: 1,
    rock: 0x7f7b72,
  },
  winter: {
    n: TR('Arktis'),
    lo: 0xcfdbe3,
    hi: 0xf2f6fa,
    pine: [0.42, 0.28, 0.2],
    round: [[0.55, 0.12, 0.86]],
    tuft: [0.55, 0.12, 0.78],
    fl: 0,
    trees: 0.9,
    sand: 0xbfc9cf,
    rock: 0x9aa4ad,
  },
};
const TUT_PRO_SEED = 72036;
function genMap(seed0) {
  const fr = rng(seed0 * 13 + 7)(),
    nf = seed0 === 4242 || seed0 === TUT_PRO_SEED ? 5 : fr < 0.55 ? 5 : 3;
  for (let attempt = 0; attempt < 26; attempt++) {
    const m = tryMap(seed0 + attempt * 7919, attempt >= 18, false, nf, seed0);
    if (m) {
      m.seed = seed0;
      return m;
    }
  }
  const m = tryMap(seed0, true, true, nf, seed0);
  m.seed = seed0;
  return m;
}
// The map type a seed stands for: seed % 8 = 1..4 picks it (the menu's map choice), anything else draws it from the seed.
// rs is the map's theme generator (its first number decides the type); the lobby asks without one.
function seedMapType(seed0, rs = rng(seed0 * 31 + 17)) {
  const code = ((seed0 % 8) + 8) % 8;
  return code >= 1 && code <= 4 ? MAPTYPE_KEYS[code - 1] : MAPTYPE_KEYS[Math.floor(rs() * 4)];
}
function tryMap(seed, noForest, force, nf = 5, seed0 = seed) {
  const r = rng(seed),
    rs = rng(seed0 * 31 + 17),
    tut = seed0 === 4242;
  const m = { rA: 4 + r() * 5, rk: TAU / (80 + r() * 50), rA2: r() * 1.6, RW: 3.2 + r() * 1.1, bridgeX: 12 + r() * 10, ford: 6 };
  m.type = tut ? 'wiesen' : seedMapType(seed0, rs);
  m.theme =
    m.type === 'wiesen'
      ? tut
        ? 'summer'
        : ['summer', 'spring', 'autumn'][Math.floor(rs() * 3)]
      : m.type === 'wueste'
        ? 'desert'
        : m.type === 'arktis'
          ? 'winter'
          : 'cliffs';
  if (m.type === 'klippen') {
    m.lift = 4;
    m.cliff = true;
    m.RW = 2.4 + r() * 0.7;
  }
  if (m.type === 'arktis') m.frozen = true;
  const rv = tut ? 0 : rs();
  m.river = rv < 0.3 ? 'wavy' : rv < 0.5 ? 'straight' : rv < 0.8 ? 'diagonal' : 'meander';
  const rm = tut ? 1 : rs();
  m.rmode = m.type === 'wiesen' ? (rm < 0.38 ? 'island' : rm < 0.55 ? 'ring' : 'band') : rm < 0.3 ? 'ring' : 'band';
  if (m.rmode !== 'band') {
    m.ring = true;
    m.ringR = (m.rmode === 'island' ? 12 : 14) + rs() * 4;
    if (m.rmode === 'island') m.RW = 3.4 + rs() * 0.8;
  }
  if (m.river === 'straight') {
    m.rA *= 0.25;
    m.rA2 *= 0.3;
  } else if (m.river === 'diagonal') {
    m.rA *= 0.4;
    m.rT = (rs() < 0.5 ? -1 : 1) * (0.2 + rs() * 0.22);
  } else if (m.river === 'meander') {
    m.rA2 = 1.8 + rs() * 1.4;
  }
  const hs = tut ? 0 : rs();
  m.hills =
    m.type === 'wiesen' ? 'rolling' : m.type === 'wueste' ? 'ridges' : m.type === 'klippen' ? 'plateaus' : hs < 0.5 ? 'rolling' : 'ridges';
  const nB = { wiesen: 11, wueste: 20, arktis: 18, klippen: 22 }[m.type],
    aMul = { wiesen: 0.75, wueste: 0.5, arktis: 0.9, klippen: 1.1 }[m.type];
  const tm = THEMES[m.theme].trees * (tut ? 1 : 0.6 + rs() * 0.8),
    nForest = Math.round(7 * tm),
    nRocks = Math.round(4 + rs() * 6);
  const bx = (r() - 0.5) * 16;
  m.bases = [
    { x: bx, z: 64 },
    { x: -bx, z: -64 },
  ];
  const P1 = { x: -(10 + r() * 15), z: 0 },
    P2 = { x: 9 + r() * 17, z: 0 };
  if (m.ring) {
    P1.z = 17 + r() * 6;
    while (Math.hypot(P1.x, P1.z) < m.ringR + m.RW + 7) P1.z += 1;
    P2.z = Math.max(25 + r() * 5, P1.z + 5);
    while (Math.hypot(P2.x, P2.z) < m.ringR + m.RW + 7) P2.z += 1;
    P2.z = Math.min(P2.z, 64 - CFG.towerPossRange - 3);
  } else {
    P1.z = Math.max(17 + r() * 6, riverZ(m, P1.x) + m.RW + 9);
    P2.z = Math.min(Math.max(25 + r() * 5, riverZ(m, P2.x) + m.RW + 9, P1.z + 5), 64 - CFG.towerPossRange - 3);
  }
  m.bspec =
    m.rmode === 'island'
      ? []
      : m.ring
        ? [
            { x: 0, zc: m.ringR },
            { x: 0, zc: -m.ringR },
          ]
        : [
            { x: m.bridgeX, zc: riverZ(m, m.bridgeX) },
            { x: -m.bridgeX, zc: riverZ(m, -m.bridgeX) },
          ];
  {
    const R0 = m.ringR,
      W0 = m.RW,
      P = [];
    if (m.rmode === 'island')
      [1, -1].forEach(sg => {
        P.push(
          { x: 4 * sg, z: sg * (R0 + W0 + 3.9), tx: 4 * sg, tz: sg * (R0 - W0 - 7) },
          { x: -4 * sg, z: sg * (R0 - W0 - 3.9), tx: -4 * sg, tz: sg * (R0 + W0 + 7.5) }
        );
      });
    else if ((m.type === 'wiesen' || m.type === 'klippen') && m.rmode === 'ring')
      [1, -1].forEach(sg => {
        P.push(
          { x: sg * (R0 + W0 + 3.9), z: 4 * sg, tx: sg * (R0 - W0 - 6.5), tz: 4 * sg },
          { x: sg * (R0 - W0 - 3.9), z: -4 * sg, tx: sg * (R0 + W0 + 7.5), tz: -4 * sg }
        );
      });
    else if (m.type === 'wiesen' || m.type === 'klippen') {
      const n = 1 + (rs() < 0.6 ? 1 : 0),
        used = [];
      for (let k = 0, tr = 0; k < n && tr < 40; tr++) {
        const x = (0.15 + rs() * 0.8) * (HALF_W - 8) * (rs() < 0.5 ? -1 : 1);
        if (Math.abs(x) < m.ford + 2.5 || m.bspec.some(b => Math.abs(b.x - x) < 5.5) || used.some(u2 => Math.abs(u2 - x) < 7)) continue;
        used.push(x, -x);
        const rz = riverZ(m, x);
        P.push({ x, z: rz + W0 + 3.9, tx: x, tz: rz - W0 - 6.5 }, { x: -x, z: -rz - W0 - 3.9, tx: -x, tz: -rz + W0 + 6.5 });
        k++;
      }
    }
    m.pads = P;
  }
  m.crev = [];
  if (m.lift)
    for (let i = 0, tr = 0; i < 3 && tr < 200; tr++) {
      const ax = (rs() - 0.5) * 2 * (HALF_W - 4),
        az = 6 + rs() * 52,
        a = rs() * Math.PI,
        L = 9 + rs() * 12,
        bx2 = ax + Math.cos(a) * L,
        bz2 = az + Math.sin(a) * L,
        w = 1.4 + rs() * 1.2;
      const mid2 = { x: (ax + bx2) / 2, z: (az + bz2) / 2 },
        pts = [{ x: ax, z: az }, mid2, { x: bx2, z: bz2 }];
      if (pts.some(q => Math.abs(q.x) > HALF_W - 2 || Math.abs(q.z) > HALF_H - 6 || riverDist(m, q.x, q.z) < m.RW + 6)) continue;
      if (
        [P1, P2, { x: 0, z: 0 }].some(f => segDist(f.x, f.z, { x: ax, z: az }, { x: bx2, z: bz2 }) < 12) ||
        segDist(bx, 64, { x: ax, z: az }, { x: bx2, z: bz2 }) < 20
      )
        continue;
      m.crev.push({ ax, az, bx: bx2, bz: bz2, w }, { ax: -ax, az: -az, bx: -bx2, bz: -bz2, w });
      i++;
    }
  const MID = { x: 0, z: 0 };
  m.flags = nf === 1 ? [MID] : nf === 3 ? [P1, MID, { x: -P1.x, z: -P1.z }] : [P2, P1, MID, { x: -P1.x, z: -P1.z }, { x: -P2.x, z: -P2.z }];
  m.mid = m.flags.indexOf(MID);
  if (!force && m.flags.some(f => m.bases.some(b => Math.hypot(f.x - b.x, f.z - b.z) < CFG.towerPossRange + 3))) return null;
  const bumps = [];
  for (let i = 0; i < 22; i++) {
    const b = { x: (r() - 0.5) * 90, z: (r() - 0.5) * 170, r: 9 + r() * 12, a: (r() < 0.3 ? -1 : 1) * (1.0 + r() * 2.6) * aMul };
    if (m.type === 'wiesen') {
      b.r *= 1.35;
      if (i >= nB) b.a = 0;
    }
    if (i >= nB) b.a = 0;
    const th = rs() * Math.PI,
      el = m.hills === 'ridges' ? 2.2 + rs() * 1.3 : 1;
    b.c = Math.cos(th);
    b.s = Math.sin(th);
    b.ax = b.r * Math.sqrt(el);
    b.az = b.r / Math.sqrt(el);
    bumps.push(b, { x: -b.x, z: -b.z, r: b.r, a: b.a, c: b.c, s: b.s, ax: b.ax, az: b.az });
  }
  const terr = h => {
    if (m.hills !== 'plateaus' || h <= 0.6) return h;
    const kl = m.type === 'klippen',
      st = kl ? 2.3 : 1.5,
      q = (h - 0.6) / st,
      k = Math.floor(q),
      f = q - k;
    return 0.6 + (k + (kl ? sstep(0.44, 0.56, f) : sstep(0.3, 0.7, f))) * st;
  };
  const raw = (x, z) => {
    let h = 1;
    for (const b of bumps) {
      const dx = x - b.x,
        dz = z - b.z,
        u2 = dx * b.c + dz * b.s,
        v2 = -dx * b.s + dz * b.c;
      h += b.a * Math.exp(-(u2 * u2) / (b.ax * b.ax) - (v2 * v2) / (b.az * b.az));
    }
    if (m.lift && h < 0.8) h = 0.8 + (h - 0.8) * 0.15;
    h = terr(h);
    return h > 4 ? 4 + (h - 4) * 0.35 : h < -1 ? -1 + (h + 1) * 0.5 : h;
  };
  const plates = [...m.bases.map(b => ({ x: b.x, z: b.z, R: 18 })), ...m.flags.map(f => ({ x: f.x, z: f.z, R: 14 }))].map(p => ({
    ...p,
    h: clamp(raw(p.x, p.z), 0.8, 3.5),
  }));
  plates[2 + m.mid].h = 0.45;
  const ponds = [];
  if (!tut && m.type !== 'klippen') {
    const arc = m.type === 'arktis',
      np = arc ? 3 + Math.floor(rs() * 3) : Math.floor(rs() * 3);
    for (let i = 0, tries = 0; i < np && tries < 160; tries++) {
      const x = (rs() - 0.5) * 2 * (HALF_W - 6),
        z = 10 + rs() * (HALF_H - 24),
        R = arc ? 3.5 + rs() * 3.5 : 3.5 + rs() * 3;
      if (
        m.flags.some(f => Math.hypot(f.x - x, f.z - z) < (arc ? 10 : 15) + R) ||
        m.bases.some(b => Math.hypot(b.x - x, b.z - z) < 20 + R) ||
        riverDist(m, x, z) < m.RW + (arc ? 4 : 7) + R ||
        raw(x, z) > (arc ? 2.4 : 1.4) ||
        ponds.some(pd => Math.hypot(pd.x - x, pd.z - z) < pd.R + R + 3)
      )
        continue;
      ponds.push({ x, z, R }, { x: -x, z: -z, R });
      i++;
    }
  }
  m.ponds = ponds;
  const height = (x, z) => {
    let h = raw(x, z);
    for (const pd of ponds) {
      const d = Math.hypot(x - pd.x, z - pd.z);
      if (d < pd.R * 2.6) {
        const k = sstep(pd.R * 2.6, pd.R * 0.3, d);
        h = lerp(h, m.frozen ? WL + 0.12 : -1.15, k);
      }
    }
    for (const p of plates) {
      const d = Math.hypot(x - p.x, z - p.z);
      h = lerp(h, p.h, sstep(p.R, p.R * 0.5, d));
    }
    const d = riverDist(m, x, z),
      t = sstep(m.RW + (m.type === 'wiesen' ? 3.8 : 2.4), m.RW - 0.6, d),
      fordMask = m.ring ? 1 : sstep(m.ford - 1, m.ford + 2.5, Math.abs(x));
    if (m.lift) {
      h = lerp(h, -9 - m.lift, t * fordMask);
      const cd = crevDist(m, x, z);
      if (cd < 2.4) h = lerp(h, -9 - m.lift, sstep(2.4, -0.4, cd));
    } else if (m.rmode === 'island') {
      h = lerp(h, m.type === 'wiesen' ? -2.4 : -6, t);
    } else if (m.frozen) {
      h = lerp(h, WL + 0.12, t * fordMask);
      h = lerp(h, Math.min(h, 0.3), t * (1 - fordMask));
    } else {
      h = lerp(h, -2.4, t * fordMask);
      h = lerp(h, Math.min(h, 0.3), t * (1 - fordMask));
    }
    if (!m.lift)
      for (const bsp of m.bspec) {
        const bx = bsp.x;
        const mx = sstep(5.5, 2.8, Math.abs(x - bx)) * (Math.abs(z - bsp.zc) < m.RW + 16 ? 1 : 0);
        if (mx <= 0) continue;
        const dz = riverDist(m, x, z);
        if (dz > m.RW - 1)
          h = lerp(
            h,
            clamp(h, dz > m.RW + 1.2 ? 0.75 - Math.max(0, dz - m.RW - 12) * 0.45 : -99, 0.75 + Math.max(0, dz - m.RW - 3) * 0.45),
            mx
          );
      }
    const ex = Math.max(0, Math.abs(x) - (HALF_W + 2)) / (ISLAND.w / 2 - HALF_W - 2),
      ez = Math.max(0, Math.abs(z) - (HALF_H + 2)) / (ISLAND.h / 2 - HALF_H - 2);
    if (m.lift) h += m.lift;
    return lerp(h, -5, sstep(0.45, 1, Math.max(ex, ez)));
  };
  const HWd = ISLAND.w + 1,
    HHt = ISLAND.h + 1,
    hg = new Float32Array(HWd * HHt);
  for (let j = 0; j < HHt; j++) for (let i = 0; i < HWd; i++) hg[j * HWd + i] = height(i - ISLAND.w / 2, j - ISLAND.h / 2);
  m.hg = hg;
  m.HWd = HWd;
  m.HHt = HHt;
  m.br = m.bspec.map(bsp => {
    const bx = bsp.x,
      zc = bsp.zc,
      ends = [-1, 1].map(sg => {
        let d = 1;
        while (d < m.RW + 7 && ![-2, -1, 0, 1, 2].every(o => sampleH(m, bx + o, zc + sg * d) >= (m.lift ? m.lift - 0.6 : WL + 0.6)))
          d += 0.25;
        return zc + sg * (d + 1.0);
      });
    return { x: bx, z0: ends[0], z1: ends[1], y0: sampleH(m, bx, ends[0]), y1: sampleH(m, bx, ends[1]) };
  });
  m.trees = [];
  m.rocks = [];
  const blockers = [];
  const farFromKey = (x, z, pad) =>
    m.flags.every(f => Math.hypot(f.x - x, f.z - z) > 11 + pad) &&
    m.bases.every(b => Math.hypot(b.x - x, b.z - z) > 16 + pad) &&
    riverDist(m, x, z) > m.RW + 5 + pad &&
    m.bspec.every(b2 => Math.hypot(x - b2.x, z - b2.zc) > 12 + pad) &&
    (m.ring || Math.hypot(x, z - riverZ(m, 0)) > 12 + pad) &&
    crevDist(m, x, z) > 3 + pad &&
    (m.pads || []).every(pd => Math.hypot(pd.x - x, pd.z - z) > 6 + pad) &&
    ponds.every(pd => Math.hypot(pd.x - x, pd.z - z) > pd.R * 1.6 + pad + 1);
  if (!noForest) {
    for (let c = 0, tries = 0; c < nForest && tries < 260; tries++) {
      const x = (r() - 0.5) * 2 * (HALF_W - 4),
        z = 8 + r() * (HALF_H - 14),
        R = 2.5 + r() * 2.8;
      if (!farFromKey(x, z, R * 0.6)) continue;
      blockers.push({ x, z, r: R, f: 1 }, { x: -x, z: -z, r: R, f: 1 });
      c++;
    }
    for (let c = 0, t2 = 0; c < nRocks && t2 < 160; t2++) {
      const x = (r() - 0.5) * 2 * (HALF_W - 4),
        z = 6 + r() * (HALF_H - 12),
        R = 1.0 + r() * 1.7;
      if (!farFromKey(x, z, 0)) continue;
      blockers.push({ x, z, r: R + 0.3, rk: R, ice: m.frozen && rs() < 0.6 }, { x: -x, z: -z, r: R + 0.3, rk: R });
      c++;
    }
    if (m.type === 'wueste')
      for (let c = 0, t3 = 0; c < 22 && t3 < 400; t3++) {
        const x = (rs() - 0.5) * 2 * (HALF_W - 3),
          z = 5 + rs() * (HALF_H - 10);
        if (!farFromKey(x, z, -3)) continue;
        const sc = 0.8 + rs() * 0.5;
        blockers.push({ x, z, r: 0.5 * sc, cact: sc }, { x: -x, z: -z, r: 0.5 * sc, cact: sc });
        c++;
      }
    if (m.type === 'wueste')
      for (let c = 0, t3 = 0; c < 9 && t3 < 300; t3++) {
        const x = (rs() - 0.5) * 1.3 * HALF_W,
          z = 4 + rs() * (HALF_H - 14);
        if (!farFromKey(x, z, -6) || blockers.some(b => Math.hypot(b.x - x, b.z - z) < 4)) continue;
        const sc = 0.75 + rs() * 0.45;
        blockers.push({ x, z, r: 0.5 * sc, cact: sc }, { x: -x, z: -z, r: 0.5 * sc, cact: sc });
        c++;
      }
    if (m.type === 'arktis')
      for (let c = 0, t3 = 0; c < 2 && t3 < 200; t3++) {
        const x = (rs() - 0.5) * 2 * (HALF_W - 6),
          z = 8 + rs() * (HALF_H - 16);
        if (!farFromKey(x, z, 2)) continue;
        blockers.push({ x, z, r: 2.1, igloo: rs() * TAU }, { x: -x, z: -z, r: 2.1, igloo: rs() * TAU });
        c++;
      }
  }
  m.padsRaw = m.pads;
  m.pads = (m.pads || []).filter(
    pd => sampleH(m, pd.x, pd.z) > WL + 0.45 && sampleH(m, pd.tx, pd.tz) > WL + 0.45 && slopeAt(m, pd.x, pd.z) < 0.9
  );
  const buildWalk = bl => {
    const walk = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const x = -HALF_W + (i + 0.5) * CELL,
          z = -HALF_H + (j + 0.5) * CELL;
        const frozenWater = m.frozen && sampleH(m, x, z) < WL + 0.45;
        let ok = sampleH(m, x, z) > WL + 0.35 || onBridge(m, x, z) || frozenWater;
        if (ok && m.lift && sampleH(m, x, z) < m.lift - 1.2 && !onBridge(m, x, z)) ok = false;
        if (ok && !frozenWater && !onBridge(m, x, z) && slopeAt(m, x, z) > 1.25) ok = false;
        if (ok && bl.some(b => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r)) ok = false;
        if (ok && m.bases.some(b => baseGap(b, x, z) < 0.9)) ok = false;
        walk[j * GW + i] = ok ? 1 : 0;
      }
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (let j = 1; j < GH - 1; j++)
        for (let i = 1; i < GW - 1; i++) {
          const c = j * GW + i;
          if (walk[c]) continue;
          const x = -HALF_W + (i + 0.5) * CELL,
            z = -HALF_H + (j + 0.5) * CELL;
          if (sampleH(m, x, z) <= WL + 0.35 || slopeAt(m, x, z) > 1.7) continue;
          if (bl.some(b => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) || m.bases.some(b => baseGap(b, x, z) < 0.9)) continue;
          let n = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && walk[c + dj * GW + di]) n++;
          if (n >= 5) add.push(c);
        }
      add.forEach(c => (walk[c] = 1));
    }

    return walk;
  };
  // keep every natural route free: plan roads on a blocker-free grid, then drop forests/rocks that sit on them
  m.walk = buildWalk([]);
  buildPadLinks(m);
  {
    const fr0 = m.bases.map((b, i) => nearestWalkable(m, b.x, b.z + (i ? 8 : -8))),
      routes = [];
    const pairs = [];
    for (const a of fr0) for (const f of m.flags) pairs.push([a, f]);
    for (let i = 0; i < m.flags.length - 1; i++) pairs.push([m.flags[i], m.flags[i + 1]]);
    for (const [a, b] of pairs) {
      const cells = astarCells(m, a.x, a.z, b.x, b.z);
      if (cells) for (const c of cells) routes.push(cellCenter(c));
    }
    const hit = b => routes.some(p => (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < (b.r + 2.6) ** 2);
    for (let i = 0; i < blockers.length; i += 2)
      if (hit(blockers[i]) || hit(blockers[i + 1])) {
        blockers.splice(i, 2);
        i -= 2;
      }
  }
  m.cacti = [];
  m.igloos = [];
  for (let i = 0; i < blockers.length; i += 2) {
    const b = blockers[i];
    if (b.rk) {
      m.rocks.push({ x: b.x, z: b.z, r: b.rk, ice: b.ice }, { x: -b.x, z: -b.z, r: b.rk, ice: b.ice });
      continue;
    }
    if (b.cact) {
      m.cacti.push({ x: b.x, z: b.z, s: b.cact }, { x: -b.x, z: -b.z, s: b.cact });
      continue;
    }
    if (b.igloo !== undefined) {
      m.igloos.push({ x: b.x, z: b.z, a: b.igloo }, { x: -b.x, z: -b.z, a: b.igloo + Math.PI });
      continue;
    }
    const R = b.r,
      n = Math.round(R * R * 0.42);
    for (let k = 0; k < n; k++) {
      const a = r() * TAU,
        d = Math.sqrt(r()) * R * 0.9,
        sc = 0.75 + r() * 0.55,
        ty = m.type === 'wueste' ? 2 : m.type === 'arktis' ? 0 : r() < 0.7 ? 0 : 1;
      m.trees.push(
        { x: b.x + Math.cos(a) * d, z: b.z + Math.sin(a) * d, s: sc, ty },
        { x: -b.x - Math.cos(a) * d, z: -b.z - Math.sin(a) * d, s: sc, ty }
      );
    }
  }
  m.blockers = blockers;
  const walk = buildWalk(blockers);
  m.walk = walk;
  /* Fine collision at forests, rocks, cacti and igloos. The 1.5 m grid blocks a whole cell as soon as its centre lies in a blocker, so
     its stair-step edge reached up to a metre past the visible trees and you got stuck there. Cells that only a blocker closes (free
     in a blocker-free grid) keep the exact circles: walkable() lets you walk right up to the trunks. Paths still use the grid. */
  {
    const free = buildWalk([]);
    m.obsL = new Map();
    const exact = blockers.map(b => ({ x: b.x, z: b.z, rc: b.f ? b.r * 0.8 : b.rk ? b.rk + 0.1 : b.r }));
    // the outer trees of a forest each get their own trunk circle (the core circle covers the inner ones)
    for (const f of blockers)
      if (f.f)
        for (const t of m.trees)
          if ((t.x - f.x) ** 2 + (t.z - f.z) ** 2 > (f.r * 0.8 - 0.4) ** 2 && (t.x - f.x) ** 2 + (t.z - f.z) ** 2 < f.r * f.r)
            exact.push({ x: t.x, z: t.z, rc: 0.38 * t.s });
    for (let c = 0; c < GW * GH; c++) {
      if (walk[c] || !free[c]) continue;
      const x = -HALF_W + ((c % GW) + 0.5) * CELL,
        z = -HALF_H + (((c / GW) | 0) + 0.5) * CELL,
        L = exact.filter(e => (x - e.x) ** 2 + (z - e.z) ** 2 < (e.rc + CELL) ** 2);
      m.obsL.set(c, L);
    }
  }
  buildPadLinks(m);
  const wet = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const c = j * GW + i;
      if (walk[c] || m.lift) continue;
      const x = -HALF_W + (i + 0.5) * CELL,
        z = -HALF_H + (j + 0.5) * CELL,
        h = sampleH(m, x, z);
      if (h < WL + 1.3 && !blockers.some(b => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) && !m.bases.some(b => baseGap(b, x, z) < 0.9))
        wet[c] = 1;
    }
  m.wet = wet;
  if (m.frozen) {
    m.ice = new Uint8Array(GW * GH);
    for (let c = 0; c < GW * GH; c++) {
      const p2 = cellCenter(c);
      if (sampleH(m, p2.x, p2.z) < WL + 0.45 && !onBridge(m, p2.x, p2.z)) m.ice[c] = 1;
    }
  }
  const fronts = m.bases.map((b, i) => nearestWalkable(m, b.x, b.z + (i ? 8 : -8)));
  {
    const seen = new Uint8Array(GW * GH),
      st = [cellOf(fronts[0].x, fronts[0].z)];
    seen[st[0]] = 1;
    while (st.length) {
      const c = st.pop(),
        ci = c % GW,
        cj = (c / GW) | 0;
      for (const link of m.padLinks.get(c) || [])
        if (!seen[link.to] && walk[link.to]) {
          seen[link.to] = 1;
          st.push(link.to);
        }
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di,
            nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
          const n = nj * GW + ni;
          if (seen[n] || !walk[n]) continue;
          if (di && dj && (!walk[cj * GW + ni] || !walk[nj * GW + ci])) continue;
          seen[n] = 1;
          st.push(n);
        }
    }
    for (let c = 0; c < walk.length; c++) if (walk[c] && !seen[c]) walk[c] = 0;
  }
  if (!force)
    for (const f of m.flags) {
      let tot = 0,
        ok = 0;
      for (let dz = -5; dz <= 5; dz += CELL)
        for (let dx = -5; dx <= 5; dx += CELL) {
          if (dx * dx + dz * dz > 25) continue;
          tot++;
          const c = cellOf(f.x + dx, f.z + dz);
          if (c >= 0 && walk[c]) ok++;
        }
      const cc = cellOf(f.x, f.z);
      if (cc < 0 || !walk[cc] || ok < tot * 0.6) return null;
    }
  if (!force && m.br.some(B => [B.z0 + 0.5, (B.z0 + B.z1) / 2, B.z1 - 0.5].some(z => !walk[cellOf(B.x, z)]))) return null;
  m.roads = [];
  for (const fr of fronts)
    for (const f of m.flags) {
      const cells = astarCells(m, fr.x, fr.z, f.x, f.z);
      if (!cells) {
        if (!force) return null;
        continue;
      }
      const len = cells.length * CELL * 0.92,
        straight = Math.hypot(f.x - fr.x, f.z - fr.z);
      if (!force && len > straight * (f === m.flags[m.mid] ? 1.22 : 1.3) + 4) return null;
      m.roads.push(smoothPath(reducePath(m, cells.map(cellCenter))));
    }
  m.decor = [];
  for (let i = 0; i < 900 && m.decor.length < 170; i++) {
    const x = (r() - 0.5) * (ISLAND.w - 4),
      z = (r() - 0.5) * (ISLAND.h - 4);
    if (Math.abs(x) < HALF_W + 1.5 && Math.abs(z) < HALF_H + 1.5) continue;
    if (sampleH(m, x, z) < WL + 0.8) continue;
    if (m.decor.some(s => Math.hypot(s.x - x, s.z - z) < 2.6)) continue;
    const rr = r();
    m.decor.push({
      x,
      z,
      s: 0.8 + r() * 0.7,
      ty: m.type === 'wueste' ? (rr < 0.55 ? 3 : 2) : m.type === 'arktis' ? (rr < 0.12 ? 4 : 0) : rr < 0.65 ? 0 : 1,
    });
  }
  m.bears = [];
  if (m.type === 'wueste') {
    // two sandworms, mirrored: one in each half of the map, out on a flank, away from the flags
    const sx = rs() < 0.5 ? -1 : 1;
    let best = null,
      bs = -1;
    for (const z of [26, 22, 30, 34, 19, 38, 28, 24])
      for (const s2 of [sx, -sx]) {
        const p = nearestWalkable(m, s2 * (HALF_W - 10), z);
        if (p.z < 14 || p.z > 44) continue;
        const fd = Math.min(...m.flags.map(f => Math.hypot(f.x - p.x, f.z - p.z)));
        if (fd > bs) {
          bs = fd;
          best = p;
        }
        if (fd >= 12) break;
      }
    if (best) m.bears.push({ x: best.x, z: best.z, worm: 1 }, { x: -best.x, z: -best.z, worm: 1 });
  }
  if (m.type === 'arktis')
    for (let i = 0, t4 = 0; i < 1 && t4 < 80; t4++) {
      const sx = rs() < 0.5 ? -1 : 1,
        z = 14 + rs() * 34,
        p = nearestWalkable(m, sx * (HALF_W - 3.5), z);
      if (m.flags.some(f => Math.hypot(f.x - p.x, f.z - p.z) < 12) || m.bears.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 14)) continue;
      m.bears.push({ x: p.x, z: p.z }, { x: -p.x, z: -p.z });
      i++;
    }
  return m;
}
function reducePath(m, pts) {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 14);
    while (j > i + 1 && !losIn(m, pts[i].x, pts[i].z, pts[j].x, pts[j].z)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
function smoothPath(p) {
  let pts = p;
  for (let k = 0; k < 3; k++) {
    const n = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1];
      n.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    n.push(pts[pts.length - 1]);
    pts = n;
  }
  return pts;
}
function slopeAt(m, x, z) {
  return Math.hypot(sampleH(m, x + 0.75, z) - sampleH(m, x - 0.75, z), sampleH(m, x, z + 0.75) - sampleH(m, x, z - 0.75)) / 1.5;
}
function sampleH(m, x, z) {
  const fx = clamp(x + ISLAND.w / 2, 0, m.HWd - 1.001),
    fz = clamp(z + ISLAND.h / 2, 0, m.HHt - 1.001);
  const i = fx | 0,
    j = fz | 0,
    tx = fx - i,
    tz = fz - j,
    W = m.HWd,
    g = m.hg;
  return lerp(lerp(g[j * W + i], g[j * W + i + 1], tx), lerp(g[(j + 1) * W + i], g[(j + 1) * W + i + 1], tx), tz);
}
function onBridge(m, x, z) {
  if (!m.br) return false;
  const hw = m.lift ? 1.45 : 2.1;
  for (const b of m.br) if (Math.abs(x - b.x) < hw && z > b.z0 && z < b.z1) return true;
  return false;
}
function bridgeAt(m, x, z) {
  if (!m.br) return null;
  const hw = m.lift ? 1.45 : 2.1;
  for (const b of m.br) if (Math.abs(x - b.x) < hw && z > b.z0 && z < b.z1) return b;
  return null;
}
function deckY(b, z) {
  const t = clamp((z - b.z0) / (b.z1 - b.z0), 0, 1);
  return lerp(b.y0, b.y1, t) - 0.7 * Math.sin(t * Math.PI) + 0.15;
}
function groundY(x, z) {
  const h = sampleH(MAP, x, z);
  if (MAP.lift) {
    const b = bridgeAt(MAP, x, z);
    return b ? deckY(b, z) : h;
  }
  return onBridge(MAP, x, z) ? Math.max(h, 0.6) : h;
}
const onIce = (x, z) => {
  if (!MAP.ice || holeAt(x, z)) return false;
  const c = cellOf(x, z);
  return c >= 0 && MAP.ice[c] === 1;
};
// Slide along the edge instead of stepping over it: try the move with one axis at a time, else stay.
function railing(x, z, nx, nz) {
  if (!fallZone(nx, z)) return { x: nx, z };
  if (!fallZone(x, nz)) return { x, z: nz };
  return { x, z };
}
const fallZoneIn = (m, x, z) => !!m.cliff && !onBridge(m, x, z) && (m.lift ? sampleH(m, x, z) < m.lift - 1.2 : false);
const fallZone = (x, z) =>
  !!MAP.cliff &&
  !onBridge(MAP, x, z) &&
  (MAP.lift ? sampleH(MAP, x, z) < MAP.lift - 1.2 : riverDist(MAP, x, z) < MAP.RW + 1 && sampleH(MAP, x, z) < -1.4);
const edgeSlide = (x, z) =>
  Math.abs(x) < HALF_W - 1 &&
  Math.abs(z) < HALF_H - 1 &&
  !onBridge(MAP, x, z) &&
  (MAP.cliff || sampleH(MAP, x, z) > WL + 0.3) &&
  !(MAP.blockers || []).some(b => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) &&
  !MAP.bases.some(b => baseGap(b, x, z) < 0.9);
const AIR_GRAVITY = 30;
function startAir(u, vx, vz, vy = 0, kind = 'fall') {
  if (u.air || u.pj || u.hp <= 0) return;
  const y = Number.isFinite(u.fy) ? u.fy : Number.isFinite(u.y) ? u.y : unitY(u.x, u.z);
  u.airAck = (u.airAck || 0) + 1;
  u.air = { vx: vx || 0, vz: vz || 0, vy: vy || 0, y, sy: y, t: 0, kind, ack: u.airAck };
  u.y = u.fy = y;
  u.fall = 1;
  u.falling = true;
  u.path = null;
  delete u.navPad;
  u.vx = vx || 0;
  u.vz = vz || 0;
  u.groundVy = 0;
}
function airStep(u, dt) {
  const a = u.air;
  if (!a) return false;
  let left = dt;
  while (left > 1e-6 && u.air) {
    const h = Math.min(left, 1 / 60);
    left -= h;
    a.t += h;
    // Knocked bodies over a gorge lose their forward momentum and drop in instead of sailing across.
    if (a.kind === 'impact' && fallZone(u.x, u.z)) {
      const k = Math.exp(-h * 9);
      a.vx *= k;
      a.vz *= k;
      if (u.kb) u.kb.left = 0;
    }
    let nx = clampX(u.x + a.vx * h),
      nz = clampZ(u.z + a.vz * h);
    const prevY = a.y,
      ny = prevY + a.vy * h - 0.5 * AIR_GRAVITY * h * h;
    a.vy -= AIR_GRAVITY * h;
    let floor = MAP.lift && fallZone(nx, nz) ? -60 : unitY(nx, nz); // the gorge is bottomless: a body keeps falling until it vanishes in the mist
    // A vertical rock face blocks horizontal motion; it never lifts the body.
    if (floor > Math.max(prevY, ny) + 0.4) {
      nx = u.x;
      nz = u.z;
      a.vx = 0;
      a.vz = 0;
      floor = MAP.lift && fallZone(nx, nz) ? -60 : unitY(nx, nz);
    }
    u.x = nx;
    u.z = nz;
    a.y = ny;
    u.y = u.fy = ny;
    u.vy = a.vy;
    if (u.kb) u.kb.left = Math.max(0, u.kb.left - Math.hypot(a.vx, a.vz) * h);
    if ((a.vy <= 0 && ny <= floor && floor <= prevY + 0.45) || ny < -32) {
      const fatal = ny < -32 || fallZone(nx, nz);
      u.y = u.fy = fatal && ny < -32 ? ny : Math.min(prevY, floor);
      u.landV = -a.vy;
      u.airEndAt = performance.now();
      u.airCompleted = a.ack;
      u.air = null;
      u.fall = 0;
      u.falling = false;
      u.vy = 0;
      u.ivx = a.vx;
      u.ivz = a.vz;
      u._ix = u.x;
      u._iz = u.z;
      u.lx = u.x;
      u.lz = u.z;
      if (fatal) {
        u.fallen = 1;
        u.hp = -1;
      } else {
        u.path = null;
        u.repath = 0;
        u.losT = 0;
        if (u.landV > 13.5) {
          u.down = Math.max(u.down || 0, 0.65);
          u.tumT = 0.65;
        }
      }
      return true;
    }
  }
  return false;
}
// How far along a straight walk (0..1) the climb rule lets a walker get, checked in 10 cm steps. The answer does not depend on
// frame or tick length, so the ego's own screen and the host agree on which slopes it can climb.
function climbFrac(x0, z0, x1, z1) {
  const n = Math.min(80, Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.1))),
    holes = MAP.holes && MAP.holes.length;
  let px = x0,
    pz = z0,
    py = unitY(x0, z0);
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      qx = x0 + (x1 - x0) * t,
      qz = z0 + (z1 - z0) * t,
      qy = unitY(qx, qz);
    if (qy - py > 0.5 && !(holes && qy - py < 1.6 && holeAt(px, pz))) return (i - 1) / n; // the rim of an ice hole can always be climbed
    px = qx;
    pz = qz;
    py = qy;
  }
  return 1;
}
function advanceGround(u, nx, nz, vx, vz, dt, dash = false, fine = false) {
  const fn = fine && !dash;
  if (fn) {
    const k = climbFrac(u.x, u.z, nx, nz);
    if (k < 1) {
      if (k <= 0) {
        u.vx = u.vz = 0;
        u.groundVy = 0;
        return false;
      }
      nx = u.x + (nx - u.x) * k;
      nz = u.z + (nz - u.z) * k;
    }
  }
  const oldFloor = unitY(u.x, u.z),
    floor = unitY(nx, nz),
    drop = oldFloor - floor,
    inHole = MAP.holes && MAP.holes.length && holeAt(u.x, u.z);
  if (!fn && floor - oldFloor > Math.max(0.5, Math.hypot(nx - u.x, nz - u.z) * 0.9) && !(inHole && floor - oldFloor < 1.6)) {
    u.vx = u.vz = 0;
    u.groundVy = 0;
    return false;
  } // the rim of an ice hole can always be climbed
  if (fallZone(nx, nz) || drop > (dash ? 0.32 : 1.2)) {
    startAir(u, vx, vz, dash ? clamp(u.groundVy || 0, 0, 7) : 0, dash ? 'dash' : 'fall');
    airStep(u, dt);
    return true;
  }
  u.groundVy = clamp((floor - oldFloor) / Math.max(dt, 0.001), -7, 7);
  u.x = nx;
  u.z = nz;
  u.y = u.fy = floor;
  return false;
}
function startFall(u, vx, vz) {
  if (u.air) return;
  u.kb = null;
  u.down = 0;
  startAir(u, vx, vz, 0, 'fall');
}
function kbStep(u, kb) {
  const st = Math.min(kb.left, kb.sp * DT);
  kb.left -= st;
  const nx = u.x + kb.vx * st,
    nz = u.z + kb.vz * st;
  if (fallZone(nx, nz)) {
    u.x = nx;
    u.z = nz;
    kb.left = 0;
    startFall(u, kb.vx * Math.min(9, kb.sp * 0.6), kb.vz * Math.min(9, kb.sp * 0.6));
    return;
  }
  if (unitY(u.x, u.z) - unitY(nx, nz) > 1.1 && !u.air) {
    const v = Math.min(9, kb.sp * 0.6);
    kb.left = 0;
    startAir(u, kb.vx * v, kb.vz * v, 1.5, 'impact');
    return;
  } // shoved over a ledge: real flight, no ground snapping
  if (walkable(nx, nz)) {
    u.x = nx;
    u.z = nz;
  } else if (edgeSlide(nx, nz)) {
    const down = sampleH(MAP, nx, nz) < sampleH(MAP, u.x, u.z) - 0.05;
    u.x = nx;
    u.z = nz;
    if (down) kb.left = Math.max(kb.left, 0.6);
    kb.slid = (kb.slid || 0) + st;
    if (kb.slid > 7) kb.left = 0;
  } else kb.left = 0;
  if (MAP.holes && MAP.holes.length && holeAt(u.x, u.z)) {
    kb.left = 0;
    u.down = Math.max(u.down || 0, 0.8);
    u.cold = 5;
  }
  if (kb.left <= 0 && !walkable(u.x, u.z)) {
    for (let s = 0.5; s <= 3; s += 0.5)
      if (fallZone(u.x + kb.vx * s, u.z + kb.vz * s)) {
        u.x += kb.vx * s;
        u.z += kb.vz * s;
        startFall(u, kb.vx * 5, kb.vz * 5);
        return;
      }
    const p = nearestWalkable(MAP, u.x, u.z);
    u.x = p.x;
    u.z = p.z;
  }
}
function cellOf(x, z) {
  const i = Math.floor((x + HALF_W) / CELL),
    j = Math.floor((z + HALF_H) / CELL);
  if (i < 0 || j < 0 || i >= GW || j >= GH) return -1;
  return j * GW + i;
}
function cellCenter(c) {
  return { x: -HALF_W + ((c % GW) + 0.5) * CELL, z: -HALF_H + (((c / GW) | 0) + 0.5) * CELL };
}
function walkableIn(m, x, z) {
  const c = cellOf(x, z);
  if (c < 0) return false;
  if (m.walk[c] === 1 || (m.wet && m.wet[c] === 1)) return true;
  const L = m.obsL && m.obsL.get(c); // a cell closed only by a forest or rock: test the exact circles
  if (!L) return false;
  for (const e of L) if ((x - e.x) ** 2 + (z - e.z) ** 2 < e.rc * e.rc) return false;
  return true;
}
function landIn(m, x, z) {
  const c = cellOf(x, z);
  return c >= 0 && m.walk[c] === 1;
}
const HOLE_B = 3; // hole index bucket size (holes are at most 3 m in radius)
function holeAt(x, z, pad = 0) {
  const H = MAP.holes;
  if (!H || !H.length) return false;
  if (MAP.holeList !== H || MAP.holeCount !== H.length) {
    const index = new Map();
    for (const h of H) {
      const key = Math.floor(h.x / HOLE_B) + 64 + (Math.floor(h.z / HOLE_B) + 128) * 128;
      let list = index.get(key);
      if (!list) index.set(key, (list = []));
      list.push(h);
    }
    MAP.holeList = H;
    MAP.holeCount = H.length;
    MAP.holeIndex = index;
  }
  const ix = Math.floor(x / HOLE_B),
    iz = Math.floor(z / HOLE_B);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const list = MAP.holeIndex.get(ix + dx + 64 + (iz + dz + 128) * 128);
      if (!list) continue;
      for (const h of list) {
        const r = (h.r || 1.14) + pad;
        if ((x - h.x) ** 2 + (z - h.z) ** 2 < r * r) return true;
      }
    }
  return false;
}
// Only feet that are really under the water surface slow down: ankle-deep = wading (mild), deeper = swimming.
const wadeAt = (x, z) => !MAP.frozen && !MAP.lift && !onBridge(MAP, x, z) && sampleH(MAP, x, z) < WL + 0.3;
const inWater = (x, z) => holeAt(x, z) || (!onIce(x, z) && !onBridge(MAP, x, z) && sampleH(MAP, x, z) < WL + 0.05);
const unitY = (x, z) =>
  holeAt(x, z)
    ? WL - 0.75
    : onIce(x, z)
      ? Math.max(groundY(x, z), WL + 0.14)
      : MAP.lift
        ? groundY(x, z)
        : Math.max(groundY(x, z), WL - 0.85);
const walkable = (x, z) => walkableIn(MAP, x, z);
function nearestWalkable(m, x, z) {
  if (landIn(m, x, z)) return { x, z };
  const c0i = Math.floor((x + HALF_W) / CELL),
    c0j = Math.floor((z + HALF_H) / CELL);
  for (let rad = 1; rad < 30; rad++) {
    let best = null,
      bd = 1e9;
    for (let dj = -rad; dj <= rad; dj++)
      for (let di = -rad; di <= rad; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
        const i = c0i + di,
          j = c0j + dj;
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const c = j * GW + i;
        if (!m.walk[c]) continue;
        const p = cellCenter(c),
          d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    if (best) return best;
  }
  return { x, z };
}
// Nearest walkable spot that is not above the current ground: knocked units slide down, they never pop up a cliff.
function nearestWalkableBelow(x, z) {
  const h0 = sampleH(MAP, x, z) + 0.6,
    c0i = Math.floor((x + HALF_W) / CELL),
    c0j = Math.floor((z + HALF_H) / CELL);
  for (let rad = 1; rad < 12; rad++) {
    let best = null,
      bd = 1e9;
    for (let dj = -rad; dj <= rad; dj++)
      for (let di = -rad; di <= rad; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
        const i = c0i + di,
          j = c0j + dj;
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const c = j * GW + i;
        if (!MAP.walk[c]) continue;
        const p = cellCenter(c);
        if (sampleH(MAP, p.x, p.z) > h0) continue;
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    if (best) return best;
  }
  return nearestWalkable(MAP, x, z);
}
function losIn(m, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az),
    n = Math.ceil(d / (CELL * 0.45)),
    hg = m.holeGrid && m.holes && m.holes.length ? m.holeGrid : null;
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      x = ax + (bx - ax) * t,
      z = az + (bz - az) * t;
    if (!landIn(m, x, z)) return false;
    if (hg && hg[cellOf(x, z)]) return false;
  }
  return true;
}
const los = (ax, az, bx, bz) => losIn(MAP, ax, az, bx, bz);
function losFat(ax, az, bx, bz) {
  if (!los(ax, az, bx, bz)) return false;
  const dx = bx - ax,
    dz = bz - az,
    d = Math.hypot(dx, dz) || 1,
    ox = (-dz / d) * 0.45,
    oz = (dx / d) * 0.45;
  return los(ax + ox, az + oz, bx + ox, bz + oz) && los(ax - ox, az - oz, bx - ox, bz - oz);
}
const AS = {
  g: new Float32Array(GW * GH),
  f: new Float32Array(GW * GH),
  from: new Int32Array(GW * GH),
  stamp: new Uint32Array(GW * GH),
  closed: new Uint32Array(GW * GH),
  gen: 1,
};
function buildPadLinks(m) {
  m.padLinks = new Map();
  (m.pads || []).forEach((pd, pad) => {
    const a = nearestWalkable(m, pd.x, pd.z),
      b = nearestWalkable(m, pd.tx, pd.tz);
    const from = cellOf(a.x, a.z),
      to = cellOf(b.x, b.z);
    if (from < 0 || to < 0 || !m.walk[from] || !m.walk[to]) return;
    const links = m.padLinks.get(from) || [];
    links.push({ to, pad });
    m.padLinks.set(from, links);
  });
}
function astarCells(m, sx, sz, tx, tz, allowPads = true) {
  const s0 = nearestWalkable(m, sx, sz),
    t0 = nearestWalkable(m, tx, tz);
  const s = cellOf(s0.x, s0.z),
    t = cellOf(t0.x, t0.z);
  if (s < 0 || t < 0) return null;
  const gen = ++AS.gen,
    { g, f, from, stamp, closed } = AS,
    ti = t % GW,
    tj = (t / GW) | 0,
    hg = m.holeGrid && m.holes && m.holes.length ? m.holeGrid : null;
  const hfn = c => {
    if (allowPads && m.padLinks && m.padLinks.size) return Math.hypot((c % GW) - ti, ((c / GW) | 0) - tj);
    const dx = Math.abs((c % GW) - ti),
      dz = Math.abs(((c / GW) | 0) - tj);
    return dx + dz + (1.414 - 2) * Math.min(dx, dz);
  };
  const heap = [];
  const push = c => {
    heap.push(c);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1,
          r2 = l + 1;
        let m2 = i;
        if (l < heap.length && f[heap[l]] < f[heap[m2]]) m2 = l;
        if (r2 < heap.length && f[heap[r2]] < f[heap[m2]]) m2 = r2;
        if (m2 === i) break;
        [heap[m2], heap[i]] = [heap[i], heap[m2]];
        i = m2;
      }
    }
    return top;
  };
  stamp[s] = gen;
  g[s] = 0;
  f[s] = hfn(s);
  from[s] = -1;
  push(s);
  let it = 0;
  while (heap.length && it++ < 9000) {
    const c = pop();
    if (closed[c] === gen) continue;
    closed[c] = gen;
    if (c === t) {
      const out = [];
      let k = c;
      while (k !== -1) {
        out.push(k);
        k = from[k];
      }
      return out.reverse();
    }
    if (allowPads && m.padLinks)
      for (const link of m.padLinks.get(c) || []) {
        const n = link.to,
          ng = g[c] + Math.hypot(cellCenter(n).x - cellCenter(c).x, cellCenter(n).z - cellCenter(c).z) / CELL;
        if (closed[n] !== gen && (stamp[n] !== gen || ng < g[n])) {
          stamp[n] = gen;
          g[n] = ng;
          f[n] = ng + hfn(n);
          from[n] = c;
          push(n);
        }
      }
    const ci = c % GW,
      cj = (c / GW) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di,
          nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        const n = nj * GW + ni;
        if (!m.walk[n] || closed[n] === gen || (hg && hg[n] && !hg[c] && n !== t)) continue;
        if (di && dj && (!m.walk[cj * GW + ni] || !m.walk[nj * GW + ci])) continue;
        const ng = g[c] + (di && dj ? 1.414 : 1);
        if (stamp[n] !== gen || ng < g[n]) {
          stamp[n] = gen;
          g[n] = ng;
          f[n] = ng + hfn(n);
          from[n] = c;
          push(n);
        }
      }
  }
  return null;
}
function findPath(sx, sz, tx, tz, allowPads = true) {
  const cells = astarCells(MAP, sx, sz, tx, tz, allowPads);
  if (!cells) return null;
  const out = [];
  let cur = { x: sx, z: sz },
    segment = [];
  const flush = () => {
    let i = 0;
    while (i < segment.length) {
      let j = Math.min(segment.length - 1, i + 22);
      while (j > i && !losFat(cur.x, cur.z, segment[j].x, segment[j].z)) j--;
      cur = segment[j];
      out.push([cur.x, cur.z]);
      i = j + 1;
    } // look-ahead window: O(n) instead of O(n²) line-of-sight tests on long paths
    segment = [];
  };
  for (let i = 1; i < cells.length; i++) {
    const link = allowPads && (MAP.padLinks.get(cells[i - 1]) || []).find(l => l.to === cells[i]);
    if (link) {
      flush();
      const pd = MAP.pads[link.pad];
      out.push([pd.x, pd.z, link.pad]);
      cur = { x: pd.tx, z: pd.tz };
      out.push([cur.x, cur.z]);
    } else segment.push(cellCenter(cells[i]));
  }
  segment.push(walkable(tx, tz) ? { x: tx, z: tz } : cellCenter(cells[cells.length - 1]));
  flush();
  return out;
}
function setMap(m) {
  MAP = m;
  BASES = m.bases;
  FLAGS = m.flags;
}
