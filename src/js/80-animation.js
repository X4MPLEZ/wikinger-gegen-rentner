/* 80-animation.js - ANIMATION: procedural poses for humans (humanRig: gait, combat, reactions, idle fidgets), catapults and riders (animateRig). No keyframes. */
let lastFrame = now(),
  clock = 0;
/* ---------- Humanoid animation: layered procedural poses ----------
   stance (per character) -> speed-driven gait (knees, elbows, hips) -> combat (anticipation, strike, follow-through,
   recovery) -> reactions (hit recoil spring, cheering) -> idle fidgets. Every layer writes plain joint angles. */
const PK = [
    'aL',
    'aR',
    'zL',
    'zR',
    'eL',
    'eR',
    'ln',
    'tw',
    'rl',
    'hop',
    'kL',
    'kR',
    'thL',
    'thR',
    'nx',
    'yL',
    'yR',
    'mp',
    'mz',
    'mh',
    'fL',
    'fR',
  ],
  PKI = {};
PK.forEach((k, i) => {
  PKI[k] = i;
});
const NP = PK.length,
  A_L = 0,
  A_R = 1,
  Z_L = 2,
  Z_R = 3,
  E_L = 4,
  E_R = 5,
  LN = 6,
  TW = 7,
  RL = 8,
  HOP = 9,
  K_L = 10,
  K_R = 11,
  T_L = 12,
  T_R = 13,
  NX = 14,
  Y_L = 15,
  Y_R = 16,
  MP = 17,
  MZ = 18,
  MH = 19,
  F_L = 20,
  F_R = 21;
function pose(o, base) {
  const a = new Float32Array(NP);
  if (base) a.set(base);
  for (const k in o) a[PKI[k]] = o[k];
  return a;
}
function lerpPose(out, a, b, t) {
  for (let i = 0; i < NP; i++) out[i] = a[i] + (b[i] - a[i]) * t;
}
// resting stance of every character
const STANCE = {
  0: pose({ aL: -0.18, eL: -0.95, zL: -0.16, aR: -0.22, eR: -0.7, zR: 0.16, ln: 0.05, kL: 0.14, kR: 0.14, nx: -0.04 }), // Berserker: shield across, axe ready
  1: pose({ aL: -0.22, eL: -0.32, zL: -0.08, aR: 0.04, eR: -0.22, zR: 0.08, ln: 0.02, kL: 0.1, kR: 0.1 }), // archer: bow low
  2: pose({ aR: -0.42, eR: -0.12, zR: 0.12, aL: 0.42, eL: -1.1, zL: 0.14, ln: 0.27, kL: 0.24, kR: 0.24, nx: -0.26 }), // Opa: hunched, cane in front, other hand on the back
  3: pose({ aL: -0.08, eL: -1.35, zL: -0.18, aR: 0.06, eR: -0.32, zR: 0.12, ln: 0.12, kL: 0.16, kR: 0.16, nx: -0.1 }), // Oma: handbag on the forearm
  4: pose({ aL: -0.95, eL: -0.5, zL: 0.05, aR: -0.5, eR: -1.05, zR: 0.15, ln: 0.08 }), // goat rider: holds a horn, axe up
  5: pose({ aL: -1.2, eL: -0.25, zL: 0.1, aR: -1.2, eR: -0.25, zR: -0.1, ln: 0.16 }), // scooter: both hands on the tiller
};
// gait per walking character: stride, knee lift, arm swing [left, right], bounce, waddle ...
const GAIT = {
  0: { stride: 0.6, knee: 0.95, arm: [0.2, 0.34], elbow: 0.25, bob: 0.016, sway: 0.01, roll: 0.025, twist: 0.09, rate: 2.25, lean: 0.07 },
  1: { stride: 0.58, knee: 0.9, arm: [0.28, 0.44], elbow: 0.3, bob: 0.014, sway: 0.008, roll: 0.018, twist: 0.07, rate: 2.45, lean: 0.07 },
  2: { stride: 0.36, knee: 0.58, arm: [0, 0.26], elbow: 0.2, bob: 0.008, sway: 0.01, roll: 0.022, twist: 0.05, rate: 2.9, lean: 0.05 },
  3: { stride: 0.34, knee: 0.52, arm: [0.06, 0.3], elbow: 0.3, bob: 0.01, sway: 0.012, roll: 0.03, twist: 0.04, rate: 3.3, lean: 0.05 },
};
// melee: combat-ready pose plus [wind-up, follow-through] per attack variant
const CPOSE = (() => {
  const r0 = pose({
    aL: -0.35,
    eL: -1.15,
    zL: -0.12,
    aR: -0.55,
    eR: -1.0,
    zR: 0.22,
    ln: 0.12,
    tw: 0.12,
    kL: 0.32,
    kR: 0.32,
    thL: -0.22,
    thR: 0.18,
    nx: -0.1,
  });
  const r2 = pose({
    aR: -0.75,
    eR: -0.55,
    zR: 0.15,
    aL: 0.4,
    eL: -1.15,
    zL: 0.12,
    ln: 0.24,
    kL: 0.3,
    kR: 0.3,
    thL: -0.15,
    thR: 0.1,
    nx: -0.25,
  });
  const r4 = pose({ aL: -0.95, eL: -0.5, aR: -0.95, eR: -1.05, zR: 0.2, ln: 0.12, mh: 0.1 });
  const r5 = pose({ aL: -1.2, eL: -0.25, zL: 0.1, aR: -1.2, eR: -0.25, zR: -0.1, ln: 0.18 });
  const g4a = [
    pose({ aR: -2.85, eR: -1.1, ln: -0.16, tw: 0.2, mp: 0.1, mh: -0.4 }, r4),
    pose({ aR: 0.05, eR: -0.12, ln: 0.42, tw: -0.2, mp: -0.28, mz: 0.28, mh: 0.65 }, r4),
  ];
  return {
    0: {
      ready: r0,
      v: [
        [
          pose({ aR: -2.95, eR: -1.25, zR: 0.12, ln: -0.14, tw: 0.28, aL: -0.55, eL: -1.25, kL: 0.22, kR: 0.22, nx: -0.2 }, r0),
          pose({ aR: 0.32, eR: -0.12, zR: -0.08, ln: 0.4, tw: -0.22, kL: 0.6, kR: 0.55, hop: -0.07, nx: 0.15 }, r0),
        ], // overhead chop
        [
          pose({ aR: -1.4, zR: 1.25, eR: -0.35, tw: 0.78, ln: 0.06, yR: 0.3, fR: 1.45 }, r0),
          pose({ aR: -1.25, zR: -0.6, eR: -0.18, tw: -0.85, ln: 0.22, yR: -0.3, fR: 1.45 }, r0),
        ], // sweep
        [
          pose({ aL: -0.3, eL: -1.7, ln: -0.06, tw: -0.35, thL: 0.1 }, r0),
          pose({ aL: -1.55, eL: -0.15, zL: 0.05, ln: 0.32, tw: 0.28, thL: -0.65, kL: 0.45, hop: 0.02 }, r0),
        ], // shield bash
        [
          pose({ aR: -3.0, aL: -2.9, eR: -1.1, eL: -1.1, ln: -0.18, hop: 0.42, kL: 0.7, kR: 0.7, thL: -0.5, thR: -0.5 }, r0),
          pose({ aR: 0.2, aL: 0.1, eR: -0.1, eL: -0.1, ln: 0.48, hop: -0.1, kL: 0.75, kR: 0.75 }, r0),
        ], // jumping smash
      ],
    },
    2: {
      ready: r2,
      v: [
        [
          pose({ aR: -0.6, zR: 1.3, eR: -0.3, tw: 0.62, yR: 0.2, fR: 1.45 }, r2),
          pose({ aR: -1.45, zR: -0.45, eR: -0.1, tw: -0.58, ln: 0.32, yR: -0.2, fR: 1.45 }, r2),
        ], // side swat
        [
          pose({ aR: -0.85, eR: -1.75, ln: 0.12, tw: 0.22, thR: 0.22 }, r2),
          pose({ aR: -1.52, eR: 0, ln: 0.42, thR: -0.55, kR: 0.45, tw: -0.15 }, r2),
        ], // jab
        [
          pose({ aR: -2.75, eR: -0.95, ln: 0.02, nx: -0.35 }, r2),
          pose({ aR: -0.85, eR: -0.08, ln: 0.48, kL: 0.45, kR: 0.45, hop: -0.04 }, r2),
        ], // overhead bonk
        [
          pose({ aR: -2.6, aL: -2.4, eR: -1.3, eL: -1.3, hop: 0.2, ln: -0.05 }, r2),
          pose({ aR: -1.0, aL: -1.2, eR: -0.2, eL: -0.3, ln: 0.4 }, r2),
        ], // furious flail
      ],
    },
    4: {
      ready: r4,
      v: [
        g4a,
        [
          pose({ aR: -1.35, zR: 1.2, eR: -0.35, tw: 0.65, yR: 0.3, mp: 0.08, mh: -0.3, fR: 1.45 }, r4),
          pose({ aR: -1.2, zR: -0.5, eR: -0.15, tw: -0.65, ln: 0.2, yR: -0.3, mp: -0.25, mz: 0.25, mh: 0.6, fR: 1.45 }, r4),
        ],
        [pose({ ln: -0.1, mp: 0.14, mh: -0.5 }, r4), pose({ ln: 0.3, mp: -0.32, mz: 0.32, mh: 0.75 }, r4)], // the goat butts, the rider holds on
        g4a,
      ],
    },
    5: {
      ready: r5,
      v: [
        [
          pose({ aR: -2.75, eR: -1.95, zR: 0.2, ln: -0.08, tw: 0.25 }, r5),
          pose({ aR: -1.5, eR: -0.05, zR: -0.1, ln: 0.32, tw: -0.3, mz: 0.3, mp: -0.06 }, r5),
        ], // fist punch
        [pose({ aR: -2.6, zR: 0.6, eR: -1.2, tw: 0.4 }, r5), pose({ aR: -1.8, zR: -0.6, eR: -0.4, tw: -0.4, ln: 0.2, mz: 0.22 }, r5)], // backhand
        [pose({ ln: -0.12, mz: -0.12, mp: 0.06 }, r5), pose({ ln: 0.38, mz: 0.42, mp: -0.1 }, r5)], // ram lunge
        [
          pose({ aR: -2.75, eR: -1.95, zR: 0.2, ln: -0.08, tw: 0.25 }, r5),
          pose({ aR: -1.5, eR: -0.05, zR: -0.1, ln: 0.32, tw: -0.3, mz: 0.3, mp: -0.06 }, r5),
        ],
      ],
    },
  };
})();
// ranged: the archer draws, releases, reaches over the shoulder, nocks; the Oma winds up, throws and pulls the next teeth from her mouth
const ARCH = (() => {
  const AIM = pose({
    aL: -1.5,
    eL: -0.06,
    zL: -0.05,
    yL: -0.62,
    aR: -1.42,
    eR: -2.15,
    zR: 0.1,
    yR: -0.9,
    tw: 0.62,
    ln: 0.04,
    kL: 0.22,
    kR: 0.18,
    thL: -0.25,
    thR: 0.2,
    nx: -0.04,
  });
  return {
    AIM,
    REL: pose({ aR: -1.25, eR: -0.5, zR: 0.6, yR: -1.35, ln: -0.02 }, AIM),
    QUIV: pose({ aR: -2.7, eR: -2.1, zR: 0.3, yR: 0, aL: -0.9, eL: -0.3, yL: -0.3, tw: 0.35 }, AIM),
    NOCK: pose({ aR: -1.38, eR: -1.3, yR: -0.35, aL: -1.38, yL: -0.55 }, AIM),
    LOW: pose({ aL: -0.3, eL: -0.4, aR: -0.1, eR: -0.4, tw: 0.2, kL: 0.12, kR: 0.12 }),
  };
})();
const OMA = (() => {
  const R = pose({ aR: -0.45, eR: -0.75, zR: 0.05, tw: 0.12, ln: 0.12, kL: 0.2, kR: 0.2, aL: -0.08, eL: -1.35, zL: -0.18 });
  return {
    R,
    W: pose({ aR: -2.65, eR: -1.55, zR: 0.35, yR: 0.25, ln: -0.12, tw: 0.5, thR: 0.15, kL: 0.25 }, R),
    F: pose({ aR: -0.85, eR: -0.12, zR: -0.25, yR: -0.2, ln: 0.32, tw: -0.42, thR: -0.28, kR: 0.35 }, R),
    M: pose({ aR: -1.65, eR: -2.35, zR: -0.18, yR: -0.25, ln: 0.08, tw: 0.05, nx: -0.18 }, R),
  };
})();
function rangedPose(u, C, at, pre, cd) {
  if (u.k === 1) {
    const A = ARCH;
    let ba = 1;
    if (at < 0.18) C.set(A.REL);
    else if (at < 0.45) {
      const q = sstep(0.18, 0.45, at);
      lerpPose(C, A.REL, A.QUIV, q);
      ba = 1 - 0.35 * q;
    } else if (at < 0.7) {
      const q = sstep(0.45, 0.7, at);
      lerpPose(C, A.QUIV, A.NOCK, q);
      ba = 0.65 + 0.35 * q;
    } else lerpPose(C, A.NOCK, A.AIM, pre);
    if (at > cd * 1.8) {
      const q = Math.min(1, (at - cd * 1.8) / 0.5);
      lerpPose(C, C, A.LOW, q);
      ba *= 1 - q;
    }
    u.bowA = ba;
    return true;
  }
  if (u.k === 3) {
    const O = OMA;
    if (at < 0.06) lerpPose(C, O.W, O.F, sstep(0, 0.06, at));
    else if (at < 0.42) lerpPose(C, O.F, O.R, sstep(0.12, 0.42, at));
    else if (at < 0.78) lerpPose(C, O.R, O.M, Math.sin(clamp((at - 0.42) / 0.36, 0, 1) * Math.PI));
    else lerpPose(C, O.R, O.W, pre);
    return true;
  }
  return false;
}
// one swing over time: -1 = full wind-up, 0 = ready, +1 = follow-through. The wind-up already held when the hit arrives is carried over.
function swingSigma(t, pre, held) {
  if (t < 0.08) return -lerp(held, 1, sstep(0, 0.08, t));
  if (t < 0.16) {
    const q = (t - 0.08) / 0.08;
    return -1 + 2.15 * q * q;
  }
  if (t < 0.3) return 1.15 - 0.15 * sstep(0.16, 0.3, t);
  if (t < 0.78) return 1 - sstep(0.3, 0.78, t);
  return -pre;
}
function pickAv(u) {
  const K = KINDS[u.k];
  if (K.role === 'cav' && u.tgtBase) return 2;
  const r = Math.random();
  return r < 0.12 ? 3 : r < 0.5 ? 0 : r < 0.82 ? 1 : 2;
}
const FIDGETS = {
  0: ['stretch', 'scratch', 'look', 'cheer', 'flex', 'axeSpin', 'shieldBang'],
  1: ['stretch', 'look', 'pluck', 'arrow', 'scratch'],
  2: ['back', 'scratch', 'look', 'caneTap', 'fist', 'yawn'],
  3: ['glasses', 'wave', 'look', 'bag', 'teeth'],
  4: ['pat', 'look', 'cheer', 'stretch'],
  5: ['honk', 'look', 'wave', 'stretch'],
};
function fidgetPose(u, P, dt, look) {
  const f = u.fid;
  f.t += dt;
  const dur = f.n === 'axeSpin' || f.n === 'caneTap' || f.n === 'shieldBang' ? 1.8 : 1.5,
    q = Math.min(1, f.t / dur),
    e = Math.sin(q * Math.PI),
    cavR = u.k === 4 || u.k === 5,
    L = lerp;
  switch (f.n) {
    case 'stretch':
      P[A_L] = L(P[A_L], -3.0, e);
      P[A_R] = L(P[A_R], -3.0, e);
      P[E_L] *= 1 - e;
      P[E_R] *= 1 - e;
      P[LN] -= 0.18 * e;
      P[NX] -= 0.2 * e;
      break;
    case 'scratch':
      P[A_R] = L(P[A_R], -2.6, e);
      P[E_R] = L(P[E_R], -1.9, e);
      P[Z_R] = L(P[Z_R], 0.35 + Math.sin(f.t * 22) * 0.12, e);
      look += 0.25 * e;
      break;
    case 'look':
      look = Math.sin(f.t * 3.2) * 0.95 * e;
      break;
    case 'cheer':
      P[A_L] = L(P[A_L], -2.9, e);
      P[A_R] = L(P[A_R], -2.9, e);
      P[E_L] *= 1 - e;
      P[E_R] *= 1 - e;
      if (!cavR) P[HOP] += Math.abs(Math.sin(f.t * 7)) * 0.25 * e;
      break;
    case 'flex':
      P[A_L] = L(P[A_L], -1.5, e);
      P[A_R] = L(P[A_R], -1.5, e);
      P[Z_L] = L(P[Z_L], -1.25, e);
      P[Z_R] = L(P[Z_R], 1.25, e);
      P[E_L] = L(P[E_L], -2.2, e);
      P[E_R] = L(P[E_R], -2.2, e);
      P[LN] -= 0.08 * e;
      break;
    case 'axeSpin':
      P[A_R] = L(P[A_R], -0.9, e);
      P[E_R] = L(P[E_R], -0.9, e);
      if (u.weapon) u.weapon.rotation.z = e > 0.05 ? f.t * 14 : 0;
      look += 0.3 * e;
      break;
    case 'shieldBang': {
      const b = Math.max(0, Math.sin(f.t * 9));
      P[A_L] = L(P[A_L], -0.6, e);
      P[E_L] = L(P[E_L], -1.4, e);
      P[A_R] = L(P[A_R], -1.1 - 0.7 * b, e);
      P[E_R] = L(P[E_R], -1.4, e);
      P[Y_R] = L(P[Y_R], 0.5, e);
      if (b > 0.97 && !f.bang && e > 0.3) {
        f.bang = 1;
        SFX.play('axe', { x: u.g.position.x, z: u.g.position.z, vol: 0.35 });
      } else if (b < 0.2) f.bang = 0;
      break;
    }
    case 'pluck':
      P[A_L] = L(P[A_L], -1.2, e);
      P[E_L] = L(P[E_L], -0.6, e);
      P[Y_L] = L(P[Y_L], -0.3, e);
      P[A_R] = L(P[A_R], -1.2, e);
      P[E_R] = L(P[E_R], -1.6 + Math.sin(f.t * 20) * 0.15, e);
      P[NX] += 0.2 * e;
      break;
    case 'arrow':
      P[A_R] = L(P[A_R], q < 0.5 ? -2.7 : -1.6, e);
      P[E_R] = L(P[E_R], q < 0.5 ? -2.1 : -1.9, e);
      P[NX] += (q > 0.5 ? 0.25 : 0) * e;
      look = 0.2 * e;
      break;
    case 'back':
      P[A_R] = L(P[A_R], 0.55, e);
      P[E_R] = L(P[E_R], -1.0, e);
      P[LN] -= 0.32 * e;
      P[NX] -= 0.25 * e;
      break;
    case 'caneTap':
      P[A_R] = L(P[A_R], -0.5 + 0.18 * Math.max(0, Math.sin(f.t * 12)), e);
      look = Math.sin(f.t * 2) * 0.4 * e;
      P[NX] += 0.08 * e;
      break;
    case 'fist':
      P[A_L] = L(P[A_L], -2.6, e);
      P[E_L] = L(P[E_L], -1.6 + Math.sin(f.t * 24) * 0.25, e);
      P[NX] -= 0.2 * e;
      break;
    case 'yawn':
      P[A_L] = L(P[A_L], -2.7, e);
      P[A_R] = L(P[A_R], -2.0, e);
      P[E_L] = L(P[E_L], -1.6, e);
      P[NX] -= 0.45 * e;
      P[LN] -= 0.1 * e;
      break;
    case 'glasses':
      P[A_R] = L(P[A_R], -1.75, e);
      P[E_R] = L(P[E_R], -2.3, e);
      P[Z_R] = L(P[Z_R], -0.25, e);
      P[NX] += 0.1 * e;
      break;
    case 'wave':
      P[A_R] = L(P[A_R], -2.75, e);
      P[E_R] = L(P[E_R], -0.6, e);
      P[Z_R] = L(P[Z_R], 0.3 + Math.sin(f.t * 12) * 0.35, e);
      break;
    case 'bag':
      P[A_R] = L(P[A_R], -0.7, e);
      P[E_R] = L(P[E_R], -1.0, e);
      P[Z_R] = L(P[Z_R], -0.35, e);
      P[NX] += 0.35 * e;
      look = -0.35 * e;
      break;
    case 'teeth':
      P[A_R] = L(P[A_R], q < 0.4 ? -1.65 : -1.3, e);
      P[E_R] = L(P[E_R], q < 0.4 ? -2.35 : -1.7, e);
      P[NX] += (q > 0.4 ? 0.15 : -0.1) * e;
      break;
    case 'pat':
      P[A_L] = L(P[A_L], -0.4, e);
      P[E_L] = L(P[E_L], -0.2 - Math.max(0, Math.sin(f.t * 10)) * 0.4, e);
      P[LN] += 0.25 * e;
      look = -0.4 * e;
      break;
    case 'honk':
      P[A_R] = L(P[A_R], -1.0, e);
      P[E_R] = L(P[E_R], -0.4, e);
      if (q > 0.45 && !f.hk) {
        f.hk = 1;
        if (Math.random() < 0.6) SFX.play('hupe', { x: u.g.position.x, z: u.g.position.z, vol: 0.45 });
      }
      break;
  }
  if (q >= 1) {
    u.fid = null;
    if (u.weapon && u.k === 0) u.weapon.rotation.z = 0;
  }
  return look;
}
const _pw = new Float32Array(NP),
  _pc = new Float32Array(NP);
const legExt = (th, kn) => 0.225 * Math.cos(th) + 0.255 * Math.cos(th + kn); // vertical reach of a leg (rig units)
function humanRig(u, dt, moving, attacking) {
  const K = KINDS[u.k],
    k = u.k,
    seated = k === 4 || k === 5,
    G0 = GAIT[k] || GAIT[0],
    P = _pw;
  if (u.ph === undefined) {
    u.ph = Math.random() * 10;
    u.mb = 0;
    u.cw = 0;
    u.hitA = 0;
    u.hitV = 0;
    u.turn = 0;
    u.yawPrev = u.g.rotation.y;
  }
  u.ph += dt;
  const ph = u.ph;
  P.set(STANCE[k] || STANCE[0]);
  u.spdS = lerp(u.spdS ?? (u.speed || 0), u.speed || 0, 1 - Math.exp(-dt * 4));
  const spd = clamp(u.spdS, 0, 12),
    run = clamp((spd - 4.6) / 2.6, 0, 1),
    calm = u.isPoss ? 0.25 : 1; // the warrior you steer barely bobs
  u.mb = lerp(u.mb, moving ? 1 : 0, 1 - Math.exp(-dt * 9));
  const mb = u.mb,
    idle = 1 - mb;
  u.walk += dt * (moving ? Math.max(3.2, spd) * (seated ? 1.75 : G0.rate) : 0);
  const t = u.walk,
    s = Math.sin(t),
    c = Math.cos(t);
  {
    const dy = angDiff(u.g.rotation.y, u.yawPrev ?? u.g.rotation.y);
    u.yawPrev = u.g.rotation.y;
    u.turn = lerp(u.turn, clamp(dy / Math.max(dt, 1e-3), -6, 6), 1 - Math.exp(-dt * 6));
  }
  let rx = 0,
    ry = 0;
  // idle life: breathing, weight shift, glances
  const breath = Math.sin(ph * 2.2) * 0.005;
  u.torso.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
  if (!seated) {
    const w = Math.sin(ph * 0.45 + (u.id | 0));
    rx += 0.006 * w * idle;
    P[RL] += 0.01 * w * idle;
    P[K_L] += 0.035 * Math.max(0, w) * idle;
    P[K_R] += 0.035 * Math.max(0, -w) * idle;
  }
  P[A_L] += Math.sin(ph * 1.1) * 0.02 * idle;
  P[A_R] -= Math.sin(ph * 1.1 + 0.7) * 0.02 * idle;
  let look = idle * Math.sin(ph * 0.45) * Math.max(0, Math.sin(ph * 0.19)) * 0.35;
  // gait: thighs swing, knees lift the foot through the swing phase, hips bob twice per cycle, arms counter-swing
  if (!seated && mb > 0.001) {
    const A = G0.stride * (1 + 0.35 * run),
      Kb = G0.knee * (1 + 0.55 * run),
      aw = 1 + 0.9 * run;
    P[T_L] -= A * s * mb;
    P[T_R] += A * s * mb;
    P[K_L] += (Kb * Math.max(0, Math.cos(t + 0.35)) + 0.06) * mb;
    P[K_R] += (Kb * Math.max(0, Math.cos(t + Math.PI + 0.35)) + 0.06) * mb;
    P[A_L] += G0.arm[0] * aw * s * mb;
    P[A_R] -= G0.arm[1] * aw * s * mb;
    P[E_L] -= (G0.elbow + 0.9 * run + 0.25 * Math.max(0, -s)) * mb * (k === 3 || k === 2 ? 0.2 : 1);
    P[E_R] -= (G0.elbow + 0.9 * run + 0.25 * Math.max(0, s)) * mb;
    P[LN] += (G0.lean + 0.12 * run) * mb;
    P[TW] -= G0.twist * s * mb;
    P[RL] += G0.roll * c * mb * calm;
    ry += (G0.bob * (1 + 0.3 * run) * (0.5 + 0.5 * Math.cos(2 * t)) - 0.01) * mb * calm;
    rx += G0.sway * c * mb * calm;
    P[NX] += 0.012 * Math.sin(2 * t + 0.6) * mb * calm;
    look = look * idle + G0.twist * 0.6 * s * mb;
  } else if (seated) {
    // the rider sits the gallop / the bumps: counter-lean, soft bob, leans into curves
    const gp = k === 4 ? Math.sin(t) : Math.sin(t * 2.3);
    P[LN] += (k === 4 ? -0.035 * gp + 0.06 : 0.008 * gp + 0.03) * mb * calm;
    P[A_L] += (k === 4 ? 0.06 * Math.sin(t + 0.5) : 0.015 * gp) * mb * calm;
    P[A_R] += (k === 4 ? 0.05 * Math.sin(t + 0.9) : 0.015 * gp) * mb * calm;
    P[RL] += clamp(-u.turn * 0.035, -0.18, 0.18);
    P[NX] -= 0.02 * gp * mb * calm;
  }
  // combat: wind-up (anticipated from the attack rhythm), strike, follow-through, recovery
  const cd = u.cdA || K.cd,
    at = u.atkT;
  if (at < (u.atPrev ?? 99)) u.preHeld = u.preCur || 0;
  u.atPrev = at;
  const pre = attacking ? sstep(cd * 0.55, cd * 0.95, at) * (at < cd * 1.8 ? 1 : Math.max(0, 1 - (at - cd * 1.8) / 0.4)) : 0;
  u.preCur = pre;
  const fighting = attacking || at < cd * 1.6;
  u.cw = lerp(u.cw, fighting ? 1 : 0, 1 - Math.exp(-dt * (fighting ? 10 : 3)));
  if (u.cw > 0.002) {
    const C = _pc;
    let ok = true;
    if (K.role === 'ranged') ok = rangedPose(u, C, at, pre, cd);
    else {
      const cp = CPOSE[k];
      if (cp) {
        const v = cp.v[(u.av || 0) % cp.v.length],
          sg = swingSigma(at, pre, u.preHeld || 0);
        if (sg < 0) lerpPose(C, cp.ready, v[0], Math.min(1, -sg));
        else lerpPose(C, cp.ready, v[1], sg);
      } else ok = false;
    }
    if (ok) {
      const wA = u.cw,
        wL = u.cw * (1 - mb * 0.85);
      for (let i = 0; i < NP; i++) {
        const w = (i >= K_L && i <= T_R) || i === HOP ? wL : wA;
        P[i] += (C[i] - P[i]) * w;
      }
    }
  }
  // reactions: hit recoil spring (kicked by every hit), cheering after the target went down
  u.hitV += (-u.hitA * 140 - u.hitV * 21) * dt;
  u.hitA += u.hitV * dt;
  if (u.flinch > 0) u.flinch -= dt;
  {
    const hA = u.hitA;
    P[LN] -= hA * 0.5;
    P[NX] += hA * 0.4;
    P[A_L] -= hA * 0.35;
    P[A_R] -= hA * 0.25;
    P[E_L] -= hA * 0.2;
    P[K_L] += Math.abs(hA) * 0.15;
    P[K_R] += Math.abs(hA) * 0.15;
  }
  if (u.cheerT > 0) {
    u.cheerT -= dt;
    if (!moving && at > 0.45) {
      const q = Math.sin(clamp(1 - u.cheerT / 1.1, 0, 1) * Math.PI),
        j = Math.abs(Math.sin((1.1 - u.cheerT) * 9));
      P[A_R] = lerp(P[A_R], -2.85, q);
      P[E_R] = lerp(P[E_R], -0.4, q);
      if (k !== 0 && k !== 3) {
        P[A_L] = lerp(P[A_L], -2.6, q * 0.8);
        P[E_L] = lerp(P[E_L], -0.5, q);
      }
      P[NX] -= 0.15 * q;
      if (!seated) P[HOP] += j * 0.04 * q;
    }
  }
  if (u.wet) {
    P[A_L] = -2.2 + Math.sin(ph * 7) * 1.3;
    P[A_R] = -2.2 + Math.sin(ph * 7 + Math.PI) * 1.3;
    P[E_L] = -0.6;
    P[E_R] = -0.6;
    if (!seated) {
      P[T_L] = Math.sin(ph * 12) * 0.7;
      P[T_R] = -Math.sin(ph * 12) * 0.7;
      P[K_L] = 0.5 + 0.4 * Math.sin(ph * 12 + 1);
      P[K_R] = 0.5 - 0.4 * Math.sin(ph * 12 + 1);
    }
    P[LN] = 0.5;
  }
  if (!moving && !attacking && at > 1.5 && !u.isPoss && !u.wet && !u.dancing && !(u.cheerT > 0)) {
    if (!u.fid) {
      u.fidN = (u.fidN ?? 2 + Math.random() * 7) - dt;
      if (u.fidN <= 0) {
        u.fid = { n: pick(FIDGETS[k] || FIDGETS[0]), t: 0 };
        u.fidN = 5 + Math.random() * 9;
      }
    }
  } else if (u.fid) {
    u.fid = null;
    if (u.weapon && k === 0) u.weapon.rotation.z = 0;
  }
  if (u.fid) look = fidgetPose(u, P, dt, look);
  // apply the pose
  u.armL.rotation.set(P[A_L], P[Y_L], P[Z_L]);
  u.armR.rotation.set(P[A_R], P[Y_R], P[Z_R]);
  if (u.foreL) {
    u.foreL.rotation.set(Math.min(0, P[E_L]), P[F_L], 0);
    u.foreR.rotation.set(Math.min(0, P[E_R]), P[F_R], 0);
  }
  if (u.bow) {
    const a = (u.bowA || 0) * u.cw * (u.fid ? 0 : 1),
      rx2 = (Math.PI / 2) * a;
    u.bow.rotation.x = rx2;
    u.bow.position.set(0, -0.245 + 0.5 * Math.sin(rx2), 0.1 - 0.5 * Math.cos(rx2));
  } // held at the grip: hangs at the side, stands upright when aiming
  if (u.legL) {
    u.legL.rotation.x = P[T_L];
    u.legR.rotation.x = P[T_R];
    const kl = Math.max(0, P[K_L]),
      kr = Math.max(0, P[K_R]);
    u.shinL.rotation.x = kl;
    u.shinR.rotation.x = kr;
    const drop = Math.max(0, 0.48 - Math.max(legExt(P[T_L], kl), legExt(P[T_R], kr))) * 1.25;
    u.dropS = u.dropS === undefined ? drop : lerp(u.dropS, drop, 1 - Math.exp(-dt * (mb > 0.5 ? (u.isPoss ? 2.2 : 5) : 12)));
    ry -= u.dropS;
  } // bent knees lower the hips (smoothed: a steady crouch while running, no bouncing)
  u.torso.rotation.set(P[LN], P[TW], P[RL]);
  u.rig.position.set(rx, ry + P[HOP], 0);
  if (u.spin > 0) {
    u.spin -= dt;
    u.rig.rotation.y = ((0.6 - u.spin) / 0.6) * TAU * 2;
  } else u.rig.rotation.y = 0;
  const target = moving ? Math.sin(t * 0.5) * 0.02 * calm : 0;
  u.wobV += (-(u.wob - target) * 90 - u.wobV * 14) * dt;
  u.wob += u.wobV * dt;
  u.neck.rotation.z = u.wob - P[RL] * 0.5;
  u.neck.rotation.x = Math.abs(u.wob) * 0.3 + P[NX] - P[LN] * 0.55;
  u.neck.rotation.y = look - P[TW] * 0.6;
  // props
  if (u.bag) {
    u.bag.rotation.x =
      -(P[A_L] + Math.min(0, P[E_L]) + P[LN]) * 0.95 + 0.3 * Math.sin(t + 1) * mb + u.hitA * 0.8 + Math.sin(ph * 1.7) * 0.04;
    u.bag.rotation.z = -P[Z_L] + 0.15 * c * mb;
  }
  if (k === 2 && u.weapon) {
    // Opa leans on the cane while walking and standing, swings it in a fight
    const wk = (1 - u.cw) * (1 - 0.8 * run),
      beta = P[A_R] + Math.min(0, P[E_R]) + P[LN],
      delta = 0.3 + 0.22 * s * mb,
      gam = (-Math.PI / 2 - beta - delta) * wk,
      gz = 0.65 * wk; // rotate about the grip, not the cane's end
    u.weapon.rotation.x = gam;
    u.weapon.position.set(0, -0.245 + gz * Math.sin(gam), 0.05 - gz * Math.cos(gam));
  }
  if (u.flag) u.flag.rotation.y = Math.sin(ph * (6 + 6 * mb) + (u.id | 0)) * (0.25 + 0.4 * mb);
  if (k === 4 && u.mount) {
    // goat: transverse gallop (hind pair, then fore pair), rocking body, nodding head, wagging tail
    const G4 = u.mount,
      gs = Math.min(1, spd / 6),
      off = [0.5, 0.62, 0, 0.12];
    u.mountLegs.forEach((l, i) => {
      const q = t + off[i] * TAU;
      l.rotation.x = -Math.sin(q) * (0.25 + 0.5 * gs) * mb;
      l.scale.y = 1;
    });
    G4.rotation.x = Math.sin(t - 0.6) * 0.035 * mb * calm + P[MP];
    G4.position.y = Math.abs(Math.sin(t)) * 0.025 * mb * calm;
    G4.position.z = P[MZ];
    G4.rotation.z = clamp(-u.turn * 0.025, -0.1, 0.1);
    if (u.goatHead) {
      const graze = sstep(0.72, 0.95, Math.sin(ph * 0.31 + (u.id | 0))) * idle * (1 - u.cw);
      u.goatHead.rotation.x = Math.sin(t * 2 + 0.4) * 0.06 * mb + P[MH] + Math.sin(ph * 0.9) * 0.03 * idle + graze * 0.75;
      u.goatHead.rotation.y = Math.sin(ph * 0.5 + (u.id | 0)) * 0.25 * idle * (1 - graze);
    }
    if (u.tail) u.tail.rotation.z = Math.sin(ph * 14) * 0.35 * (0.3 + 0.7 * mb);
  } else if (k === 5 && u.mount) {
    // scooter: wheels roll with the ground, suspension jiggles, leans into curves, lunges on a hit
    const M = u.mount;
    u.wheels.forEach(w => {
      w.rotation.x += (dt * spd) / 0.2;
    });
    M.position.y = (Math.sin(t * 2.3) * 0.004 + Math.max(0, Math.sin(t * 0.7 + (u.id | 0))) * 0.008) * mb * calm;
    M.position.z = P[MZ];
    M.rotation.z = clamp(-u.turn * 0.03, -0.12, 0.12);
    M.rotation.x = P[MP] + Math.sin(t * 2.3) * 0.004 * mb * calm;
  }
  if (u.headTarget !== undefined) u.neck.scale.setScalar(lerp(u.neck.scale.x, u.headTarget, Math.min(1, dt * 6)));
  if (u.pop !== undefined) {
    u.pop += dt;
    const sc = Math.min(1, u.pop / 0.3);
    u.g.scale.setScalar(sc < 1 ? sc * (1 + 0.35 * Math.sin(sc * Math.PI)) : 1);
    u.rig.position.y += Math.sin(sc * Math.PI) * 0.5;
    if (sc >= 1) delete u.pop;
  }
}
function catapultRig(u, dt, moving) {
  // wheels roll with the ground, ratchet wind-up, whip, the arm slams the stop bar and shudders, the frame recoils
  if (u.ph === undefined) {
    u.ph = Math.random() * 10;
    u.rk = 0;
    u.rkV = 0;
    u.mb = 0;
  }
  u.ph += dt;
  u.atkT += dt;
  const p = u.atkT,
    spd = clamp(u.speed || 0, 0, 5);
  u.mb = lerp(u.mb, moving ? 1 : 0, 1 - Math.exp(-dt * 6));
  const mb = u.mb;
  u.walk += dt * spd * 2.2;
  u.wheels.forEach(w => {
    w.rotation.x += (dt * spd) / 0.52;
  });
  if (p < (u.pPrev ?? 99)) u.armRel = p < 0 ? -0.98 : (u.armA ?? -0.3);
  u.pPrev = p;
  let arm;
  if (p < 0) {
    const q = sstep(-SIEGE_WIND, -0.04, p) * 5.999,
      st = Math.floor(q) / 5,
      sub = q % 1;
    arm = lerp(-0.3, -0.98, Math.min(1, st + 0.2 * sstep(0, 0.4, sub))) + (p > -0.16 ? Math.sin(clock * 70) * 0.022 : 0);
  } else if (p < 0.16) {
    const q = p / 0.16;
    arm = lerp(u.armRel ?? -0.98, 0.8, q * q);
    u.kicked = 0;
  } else if (p < 0.6) {
    if (!u.kicked) {
      u.kicked = 1;
      u.rkV -= 2.4;
    }
    const q = p - 0.16;
    arm = 0.72 + 0.09 * Math.exp(-q * 8) * Math.cos(q * 40);
  } else if (p < 1.7) {
    const q = sstep(0.6, 1.7, p);
    arm = lerp(0.72, -0.3, q) + Math.sin(q * 38) * 0.012 * (1 - q);
  } else arm = -0.3 + Math.sin(u.ph * 1.1) * 0.012;
  u.armA = arm;
  u.arm.rotation.x = arm;
  u.rkV += (-u.rk * 150 - u.rkV * 8) * dt;
  u.rk += u.rkV * dt;
  u.rig.rotation.x = u.rk + Math.sin(u.walk * 1.7 + 0.8) * 0.006 * mb;
  u.rig.rotation.z = Math.sin(u.walk * 1.7) * 0.01 * mb;
  u.rig.position.y = Math.abs(Math.sin(u.walk * 1.7)) * 0.012 * mb;
  u.rig.position.z = u.rk * 0.5;
  if (u.pop !== undefined) {
    u.pop += dt;
    const s2 = Math.min(1, u.pop / 0.4);
    u.g.scale.setScalar(Math.max(0.01, s2));
    if (s2 >= 1) delete u.pop;
  }
  if (u.headTarget !== undefined) u.neck.scale.setScalar(lerp(u.neck.scale.x, u.isPoss ? u.headTarget : 0.001, Math.min(1, dt * 6)));
}
function animateRig(u, dt, moving, attacking) {
  if (u.rag) {
    ragdollRig(u, dt);
    return;
  }
  if (u.worm) {
    wormRig(u, dt, moving);
    return;
  }
  if (u.dancing && !u.arm) {
    danceRig(u, dt);
    return;
  } else if (u.bear) {
    bearRig(u, dt, moving);
    return;
  } else if (u.wasDance !== !!u.dancing) {
    u.wasDance = !!u.dancing;
    if (u.armL) {
      u.armL.rotation.z = 0;
      u.armR.rotation.z = 0;
    }
    u.rig.rotation.set(0, 0, 0);
    u.rig.position.y = 0;
    if (u.legL) {
      u.legL.rotation.set(0, 0, 0);
      u.legR.rotation.set(0, 0, 0);
    }
  }
  if (u.arm) {
    catapultRig(u, dt, moving);
    return;
  }
  u.atkT += dt;
  humanRig(u, dt, moving, attacking);
}
/* Hidden performance overlay: add ?perf=1 to the URL. Measures CPU time per frame section, draw calls, triangles, shadows. */
