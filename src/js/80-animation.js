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
  2: pose({ aR: -0.42, eR: -0.12, zR: 0.12, aL: 0.42, eL: -1.1, zL: 0.14, ln: 0.1, kL: 0.16, kR: 0.16, nx: -0.12 }), // Opa: a little bent, cane in front, other hand on the back
  3: pose({ aL: -0.08, eL: -1.35, zL: -0.18, aR: 0.06, eR: -0.32, zR: 0.12, ln: 0.12, kL: 0.16, kR: 0.16, nx: -0.1 }), // Oma: handbag on the forearm
  4: pose({ aL: -0.95, eL: -0.5, zL: 0.05, aR: -0.5, eR: -1.05, zR: 0.15, ln: 0.08 }), // goat rider: holds a horn, axe up
  5: pose({ aL: -1.2, eL: -0.25, zL: 0.1, aR: -1.2, eR: -0.25, zR: -0.1, ln: 0.16 }), // scooter: both hands on the tiller
  12: pose({ aL: -2.1, eL: -1.15, zL: -0.5, aR: -0.55, eR: -0.75, zR: 0.22, ln: 0.1, rl: 0.06, kL: 0.2, kR: 0.2, nx: -0.05 }), // Feuerfass: barrel on the left shoulder, torch in the right
  13: pose({ aR: -0.08, eR: -0.3, zR: 0.14, aL: 0.18, eL: -0.75, zL: -0.06, ln: 0.12, kL: 0.15, kR: 0.15, nx: -0.08 }), // Fallenleger: trap at his side
};
// gait per walking character: stride, knee lift, arm swing [left, right], bounce, waddle ...
const GAIT = {
  0: { stride: 0.6, knee: 0.95, arm: [0.2, 0.34], elbow: 0.25, bob: 0.016, sway: 0.01, roll: 0.025, twist: 0.09, rate: 2.25, lean: 0.07 },
  1: { stride: 0.58, knee: 0.9, arm: [0.28, 0.44], elbow: 0.3, bob: 0.014, sway: 0.008, roll: 0.018, twist: 0.07, rate: 2.45, lean: 0.07 },
  2: { stride: 0.36, knee: 0.58, arm: [0, 0.26], elbow: 0.2, bob: 0.008, sway: 0.01, roll: 0.022, twist: 0.05, rate: 2.9, lean: 0.05 },
  3: { stride: 0.34, knee: 0.52, arm: [0.06, 0.3], elbow: 0.3, bob: 0.01, sway: 0.012, roll: 0.03, twist: 0.04, rate: 3.3, lean: 0.05 },
  12: { stride: 0.44, knee: 0.72, arm: [0, 0.22], elbow: 0.15, bob: 0.024, sway: 0.03, roll: 0.055, twist: 0.04, rate: 2.55, lean: 0.12 }, // a heavy waddle
  13: { stride: 0.4, knee: 0.62, arm: [0.24, 0.1], elbow: 0.22, bob: 0.01, sway: 0.012, roll: 0.025, twist: 0.05, rate: 2.8, lean: 0.06 },
};
/* Melee moves per kind: the combat-ready pose and a list of moves. Each move is [wind-up, follow-through] plus what it is:
   n = an ordinary blow (also in ego combos), a = only the computer uses it (butts, rams, shield bash), f = a finisher (the 3rd blow of a
   combo; computer warriors now and then): spin = a full turn with the weapon out, jump = a leap into the blow (metres). W is the
   wind-up of the steered warrior in seconds (the slash and the hit come at its end, 51-ego.js). sl = the slash: h sideways (d: -1 right
   to left, 1 left to right), v overhead chop, u rising cut, r all round. Nobody stabs: every blow is a swing, a chop or a punch with the
   whole body behind it (twist, lean, the front leg steps in). */
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
  // Feuerfass: the barrel on the left shoulder (that arm stays up), the torch in the right – every blow is a torch swing
  const r12 = pose({
    aL: -2.1,
    eL: -1.15,
    zL: -0.5,
    aR: -0.95,
    eR: -0.7,
    zR: 0.32,
    ln: 0.1,
    tw: 0.12,
    rl: 0.06,
    kL: 0.3,
    kR: 0.3,
    thL: -0.2,
    thR: 0.15,
    nx: -0.08,
  });
  const r13 = pose({
    aR: -0.95,
    eR: -1.25,
    zR: 0.22,
    aL: -0.75,
    eL: -1.55,
    zL: -0.15,
    ln: 0.18,
    tw: 0.15,
    kL: 0.3,
    kR: 0.3,
    thL: -0.2,
    thR: 0.15,
    nx: -0.1,
  });
  const r5 = pose({ aL: -1.2, eL: -0.25, zL: 0.1, aR: -1.2, eR: -0.25, zR: -0.1, ln: 0.18 });
  const mv = (r, w, s, o) => Object.assign({ v: [pose(w, r), pose(s, r)], n: 'n', W: 0.07, sl: { m: 'h', d: -1 } }, o);
  const set = (ready, moves) => ({ ready, v: moves.map(m => m.v), m: moves });
  return {
    0: set(r0, [
      mv(
        r0,
        {
          aR: -3.0,
          eR: -1.3,
          zR: 0.15,
          ln: -0.22,
          tw: 0.35,
          aL: -0.7,
          eL: -1.3,
          kL: 0.2,
          kR: 0.25,
          thL: -0.3,
          thR: 0.25,
          nx: -0.25,
          hop: 0.04,
        },
        { aR: 0.35, eR: -0.1, zR: -0.1, ln: 0.52, tw: -0.25, aL: -0.2, kL: 0.65, kR: 0.55, thL: -0.55, thR: 0.35, hop: -0.09, nx: 0.2 },
        { sl: { m: 'v' } }
      ), // overhead chop
      mv(
        r0,
        { aR: -1.45, zR: 1.3, eR: -0.4, fR: 1.45, yR: 0.3, tw: 0.95, ln: 0.02, rl: 0.08, kL: 0.3, kR: 0.35, thL: -0.15, thR: 0.3 },
        { aR: -1.3, zR: -0.7, eR: -0.15, fR: 1.45, yR: -0.35, tw: -1.0, ln: 0.28, rl: -0.08, kL: 0.5, kR: 0.4, thL: -0.45, thR: 0.2 },
        { sl: { m: 'h', d: -1 } }
      ), // forehand sweep
      mv(
        r0,
        { aR: -1.35, zR: -0.75, eR: -1.5, fR: 1.45, yR: -0.2, tw: -0.9, ln: 0.05, kL: 0.35, kR: 0.3, thL: -0.3, thR: 0.1 },
        { aR: -1.5, zR: 1.35, eR: -0.1, fR: 1.45, yR: 0.35, tw: 0.85, ln: 0.25, kL: 0.45, kR: 0.5, thL: -0.2, thR: 0.45 },
        { sl: { m: 'h', d: 1 } }
      ), // backhand sweep
      mv(
        r0,
        { aR: 0.25, zR: -0.4, eR: -0.5, fR: 0.8, tw: -0.6, ln: 0.38, kL: 0.55, kR: 0.5, thL: -0.4 },
        { aR: -2.7, zR: 0.9, eR: -0.2, fR: 0.8, tw: 0.55, ln: -0.15, hop: 0.08, kL: 0.15, kR: 0.2, nx: -0.2 },
        { n: 'a', sl: { m: 'u' } }
      ), // rising cut (computer only: its wind-up starts low, the steered warrior waits with the axe up)
      mv(
        r0,
        { aL: -0.3, eL: -1.7, ln: -0.06, tw: -0.35, thL: 0.1 },
        { aL: -1.55, eL: -0.15, zL: 0.05, ln: 0.36, tw: 0.28, thL: -0.65, kL: 0.45, hop: 0.02 },
        { n: 'a', sl: { m: 'h', d: 1, s: 0.75 } }
      ), // shield bash
      mv(
        r0,
        { aR: -1.5, zR: 1.45, eR: -0.2, fR: 1.45, tw: 1.1, ln: 0.15, aL: -0.6, zL: -1.2, kL: 0.45, kR: 0.45 },
        { aR: -1.5, zR: 1.4, eR: -0.05, fR: 1.45, tw: -0.2, ln: 0.2, zL: -1.3, aL: -0.4, kL: 0.35, kR: 0.35, thL: -0.2, thR: 0.2 },
        { n: 'f', spin: 1, W: 0.12, sl: { m: 'r' } }
      ), // whirlwind
      mv(
        r0,
        { aR: -3.05, aL: -2.9, eR: -1.15, eL: -1.1, ln: -0.25, kL: 0.75, kR: 0.75, thL: -0.6, thR: -0.5 },
        { aR: 0.25, aL: 0.15, eR: -0.1, eL: -0.1, ln: 0.6, hop: -0.12, kL: 0.85, kR: 0.85, thL: -0.5, thR: 0.3 },
        { n: 'f', jump: 0.75, W: 0.17, sl: { m: 'v', s: 1.3 } }
      ), // leaping smash
    ]),
    2: set(r2, [
      mv(
        r2,
        { aR: -0.6, zR: 1.35, eR: -0.3, yR: 0.2, fR: 1.45, tw: 0.75, kR: 0.4, thR: 0.25 },
        { aR: -1.45, zR: -0.5, eR: -0.1, yR: -0.25, fR: 1.45, tw: -0.7, ln: 0.38, thL: -0.35, kL: 0.45 },
        { sl: { m: 'h', d: -1 } }
      ), // side swat
      mv(
        r2,
        { aR: -1.3, zR: -0.6, eR: -1.4, fR: 1.45, tw: -0.7, thL: -0.25 },
        { aR: -1.2, zR: 1.3, eR: -0.1, fR: 1.45, tw: 0.7, ln: 0.3, thR: -0.3, kR: 0.4 },
        { sl: { m: 'h', d: 1 } }
      ), // backhand swat
      mv(
        r2,
        { aR: -2.85, eR: -0.95, ln: -0.05, nx: -0.4, hop: 0.03 },
        { aR: -0.75, eR: -0.08, ln: 0.55, kL: 0.5, kR: 0.5, hop: -0.05, thL: -0.35 },
        { sl: { m: 'v' } }
      ), // overhead bonk
      mv(
        r2,
        { aR: -0.3, zR: 1.2, eR: -0.2, fR: 1.45, tw: 0.8, ln: 0.35, kL: 0.6, kR: 0.6 },
        { aR: -0.4, zR: -0.7, eR: -0.1, fR: 1.45, tw: -0.85, ln: 0.55, kL: 0.7, kR: 0.7, thL: -0.4 },
        { n: 'a', sl: { m: 'h', d: -1, s: 0.9, low: 1 } }
      ), // sweep at the knees (computer only)
      mv(
        r2,
        { aR: -1.55, zR: 1.5, eR: -0.1, tw: 1.0, aL: -0.8, zL: -1.1, kL: 0.4, kR: 0.4 },
        { aR: -1.55, zR: 1.5, eR: -0.05, tw: -0.2, aL: -0.6, zL: -1.2, kL: 0.35, kR: 0.35 },
        { n: 'f', spin: 1, W: 0.12, sl: { m: 'r' } }
      ), // cane whirl
      mv(
        r2,
        { aR: -2.8, aL: -2.6, eR: -1.2, eL: -1.2, ln: -0.15, kL: 0.6, kR: 0.6 },
        { aR: -0.9, aL: -1.1, eR: -0.1, eL: -0.2, ln: 0.55, hop: -0.08, kL: 0.8, kR: 0.8 },
        { n: 'f', jump: 0.5, W: 0.16, sl: { m: 'v', s: 1.2 } }
      ), // the old man's leap
    ]),
    4: set(r4, [
      mv(
        r4,
        { aR: -2.9, eR: -1.15, ln: -0.18, tw: 0.25, mp: 0.1, mh: -0.4 },
        { aR: 0.1, eR: -0.1, ln: 0.45, tw: -0.2, mp: -0.28, mz: 0.28, mh: 0.65 },
        { sl: { m: 'v' } }
      ),
      mv(
        r4,
        { aR: -1.35, zR: 1.2, eR: -0.35, tw: 0.65, yR: 0.3, mp: 0.08, mh: -0.3, fR: 1.45 },
        { aR: -1.2, zR: -0.5, eR: -0.15, tw: -0.65, ln: 0.2, yR: -0.3, mp: -0.25, mz: 0.25, mh: 0.6, fR: 1.45 },
        { sl: { m: 'h', d: -1 } }
      ),
      mv(
        r4,
        { aR: -1.3, zR: -0.7, eR: -1.4, fR: 1.45, tw: -0.7 },
        { aR: -1.4, zR: 1.3, eR: -0.1, fR: 1.45, tw: 0.7, ln: 0.25, mz: 0.2, mh: 0.3 },
        { sl: { m: 'h', d: 1 } }
      ),
      mv(
        r4,
        { ln: -0.1, mp: 0.14, mh: -0.5 },
        { ln: 0.3, mp: -0.32, mz: 0.32, mh: 0.75 },
        { n: 'a', sl: { m: 'h', d: 1, s: 0.8, low: 1 } }
      ), // the goat butts
      mv(
        r4,
        { aR: -3.0, eR: -1.2, ln: -0.3, mp: -0.4, mh: -0.6 },
        { aR: 0.2, eR: -0.1, ln: 0.55, mp: 0.2, mz: 0.45, mh: 0.8 },
        { n: 'f', W: 0.15, sl: { m: 'v', s: 1.3 } }
      ), // the goat rears, the axe comes down with it
      mv(
        r4,
        { aR: -1.5, zR: 1.4, eR: -0.2, fR: 1.45, tw: 1.1, mz: -0.2, mh: -0.3 },
        { aR: -1.3, zR: -0.8, eR: -0.1, fR: 1.45, tw: -1.1, ln: 0.35, mz: 0.5, mh: 0.5 },
        { n: 'f', W: 0.12, sl: { m: 'h', d: -1, s: 1.35 } }
      ), // a lunging sweep
    ]),
    5: set(r5, [
      mv(
        r5,
        { aR: -1.3, zR: 1.0, eR: -1.7, yR: 0.4, tw: 0.55 },
        { aR: -1.55, zR: -0.45, eR: -0.5, yR: -0.3, tw: -0.55, ln: 0.3, mz: 0.2 },
        { sl: { m: 'h', d: -1, s: 0.85 } }
      ), // hook
      mv(
        r5,
        { aR: -1.4, zR: -0.6, eR: -1.6, tw: -0.5 },
        { aR: -1.5, zR: 1.2, eR: -0.2, tw: 0.55, ln: 0.2, mz: 0.15 },
        { sl: { m: 'h', d: 1, s: 0.85 } }
      ), // backhand slap
      mv(r5, { aR: -2.9, eR: -1.6, ln: -0.1, tw: 0.2 }, { aR: -0.95, eR: -0.3, ln: 0.45, mz: 0.3, mp: 0.06 }, { sl: { m: 'v', s: 0.9 } }), // hammer fist
      mv(r5, { ln: -0.12, mz: -0.12, mp: 0.06 }, { ln: 0.38, mz: 0.42, mp: -0.1 }, { n: 'a', sl: { m: 'h', d: 1, s: 0.8, low: 1 } }), // ram
      mv(
        r5,
        { aR: -1.5, zR: 1.4, eR: -0.1, tw: 0.6, ln: 0.1 },
        { aR: -1.5, zR: 1.4, eR: -0.05, tw: -0.1 },
        { n: 'f', spin: 1, W: 0.12, sl: { m: 'r' } }
      ), // scooter donut, fist out
      mv(
        r5,
        { aR: -2.9, eR: -1.5, ln: -0.25, mp: -0.35 },
        { aR: -0.9, eR: -0.2, ln: 0.5, mp: 0.12, mz: 0.35 },
        { n: 'f', W: 0.15, sl: { m: 'v', s: 1.2 } }
      ), // wheelie and a hammer fist
    ]),
    12: set(r12, [
      mv(
        r12,
        { tw: 0.9, aR: -1.25, eR: -0.95, zR: 0.95, ln: 0.02, rl: 0.12, kR: 0.38, thR: 0.25 },
        { tw: -0.8, aR: -1.3, eR: -0.2, zR: -0.3, ln: 0.34, rl: -0.08, thL: -0.42, kL: 0.52 },
        { sl: { m: 'h', d: -1 } }
      ), // the torch swept from the right
      mv(
        r12,
        { aR: -2.9, eR: -1.3, ln: -0.2, nx: -0.15, hop: 0.02 },
        { aR: -0.5, eR: -0.1, ln: 0.52, thL: -0.4, kL: 0.5, hop: -0.05, nx: 0.12 },
        { sl: { m: 'v', s: 1.05 } }
      ), // the torch brought down
      mv(
        r12,
        { aR: -0.25, eR: -1.4, ln: -0.1, tw: 0.5, kR: 0.4, thR: 0.2 },
        { aR: -1.7, eR: -0.1, ln: 0.36, tw: -0.35, thL: -0.35, kL: 0.5 },
        { sl: { m: 'u', s: 0.9 } }
      ), // a rising jab with the torch
      mv(r12, { nx: -0.5, ln: -0.12, hop: 0.03 }, { nx: 0.55, ln: 0.52, thL: -0.42, kL: 0.48 }, { n: 'a', sl: { m: 'h', d: 1, s: 0.7 } }), // headbutt
      mv(
        r12,
        { tw: 1.1, zR: 1.1, aR: -1.3, eR: -0.25, ln: 0.12, kL: 0.4, kR: 0.4 },
        { tw: -0.2, zR: 1.2, aR: -1.35, eR: -0.15, ln: 0.18, kL: 0.35, kR: 0.35 },
        { n: 'f', spin: 1, W: 0.12, sl: { m: 'r' } }
      ), // the torch round and round
      mv(
        r12,
        { aR: -2.6, eR: -1.2, ln: -0.32, kL: 0.78, kR: 0.78, thL: -0.6, thR: -0.5 },
        { aR: -0.4, eR: -0.05, ln: 0.78, hop: -0.16, kL: 0.88, kR: 0.88, thL: -0.5, thR: 0.3 },
        { n: 'f', jump: 0.72, W: 0.17, sl: { m: 'v', s: 1.3 } }
      ), // a leap and the torch slammed down
    ]),
    13: set(r13, [
      mv(
        r13,
        { aR: -2.95, eR: -0.85, aL: -2.2, eL: -1.0, ln: -0.15, tw: 0.2, nx: -0.25, hop: 0.03, kL: 0.25, kR: 0.25 },
        { aR: -0.72, eR: -0.08, aL: -0.9, eL: -0.3, ln: 0.55, tw: -0.05, kL: 0.55, kR: 0.55, hop: -0.07, thL: -0.4 },
        { W: 0.1, sl: { m: 'v', d: -1, none: 1 } }
      ), // the spade struck into the ground over his head: the row of traps bursts out (16-sim-fass-falle.js)
      mv(
        r13,
        { aR: -2.3, eR: -1.3, zR: 0.7, tw: 0.75, ln: 0.0, kR: 0.4, thR: 0.25 },
        { aR: -0.85, eR: -0.12, zR: -0.1, tw: -0.25, ln: 0.48, kL: 0.5, thL: -0.35 },
        { W: 0.1, sl: { m: 'v', d: -1, none: 1 } }
      ), // ... and from the side
    ]),
  };
})();
// move picking: ordinary moves, finishers, and the next move the arm already waits for
const movesOf = (k, n) => {
  const cp = CPOSE[k];
  return cp ? cp.m.map((m, i) => (n.includes(m.n) ? i : -1)).filter(i => i >= 0) : [0];
};
const moveOf = (k, av) => (CPOSE[k] ? CPOSE[k].m[(av || 0) % CPOSE[k].m.length] : null);
// a steered warrior's three blows: two different ordinary blows (a forehand is best followed by a backhand) and a finisher
function comboSeq(k, first) {
  const n = movesOf(k, 'n'),
    f = movesOf(k, 'f'),
    a = first !== undefined && n.includes(first) ? first : pick(n),
    sa = moveOf(k, a).sl,
    rest = n.filter(i => i !== a),
    opp = rest.filter(i => {
      const sb = moveOf(k, i).sl;
      return sb.m !== sa.m || sb.d !== sa.d;
    });
  return [a, pick(opp.length && Math.random() < 0.75 ? opp : rest.length ? rest : n), f.length ? pick(f) : a];
}
// the trail an enemy's swing leaves (51-ego.js swooshFx), from the slash of its move
function moveSwoosh(k, av) {
  const m = moveOf(k, av),
    sl = m ? m.sl : { m: 'h', d: -1 },
    cav = k === 4 || k === 5,
    h = (cav ? (k === 4 ? 1.72 : 1.35) : 1.1) * (sl.low ? 0.7 : 1);
  if (sl.m === 'v') return { roll: -0.28, dir: 1, h: h + 0.1, sc: sl.s || 1 };
  if (sl.m === 'u') return { roll: 0.25, dir: -1, h, sc: sl.s || 1 };
  if (sl.m === 'r') return { roll: 0, dir: 1, h, sc: 1.15 };
  return { roll: sl.d === 1 ? 0.05 : -0.1, dir: sl.d === 1 ? 1 : -1, h, sc: sl.s || 1 };
}
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
    if (at > cd * 1.8 && !u.isPoss) {
      const q = Math.min(1, (at - cd * 1.8) / 0.5);
      lerpPose(C, C, A.LOW, q);
      ba *= 1 - q;
    }
    // the steered archer keeps the bow drawn until the next shot; held a while, the arms strain a little: a slow, small sway (no buzz)
    if (u.isPoss && pre > 0.95) {
      const hold = clamp((at - cd * 0.92 - 0.6) / 3, 0, 1),
        tr = 0.004 + 0.009 * hold;
      C[A_R] += tr * Math.sin(u.ph * 7.1);
      C[A_L] += tr * 0.7 * Math.sin(u.ph * 5.3 + 1.3);
      C[TW] += tr * 0.3 * Math.sin(u.ph * 3.7);
    }
    u.bowA = ba;
    u.drawn = u.isPoss ? pre : 0;
    u.pull = pre * sstep(0.6, 0.75, at); // how far the string is drawn back (the arrow on it shows from 8 %)
    return true;
  }
  if (u.k === 3) {
    const O = OMA;
    if (at < 0.06) lerpPose(C, O.W, O.F, sstep(0, 0.06, at));
    else if (at < 0.42) lerpPose(C, O.F, O.R, sstep(0.12, 0.42, at));
    else if (at < 0.78) lerpPose(C, O.R, O.M, Math.sin(clamp((at - 0.42) / 0.36, 0, 1) * Math.PI));
    else lerpPose(C, O.R, O.W, pre);
    // the steered Oma stays wound up, the raised arm wobbling a little, ready to throw
    if (u.isPoss && pre > 0.95) {
      const hold = Math.min(1, (at - cd * 0.92) / 2.5),
        tr = (0.3 + 0.7 * hold) * 0.03;
      C[A_R] += tr * Math.sin(u.ph * 17);
      C[E_R] += tr * 0.9 * Math.sin(u.ph * 13 + 1);
      C[TW] += tr * 0.5 * Math.sin(u.ph * 11);
    }
    u.drawn = u.isPoss ? pre : 0;
    return true;
  }
  return false;
}
/* One melee blow over time: from where the body was into the wind-up, a fast accelerating strike that overshoots a little, a short
   hold on the follow-through (that is where the blow "lands"), then the arm comes back up – part of the way into the next wind-up –
   and stays there while the fight goes on: the warrior waits, weapon raised, for the next blow. A finisher spins the whole body
   round or leaps into the blow. The steered warrior winds up for the move's W (the slash and the hit come right then, 51-ego.js). */
const _cock = new Float32Array(NP);
/* A damped spring (hit recoil, head wobble, catapult recoil), stepped in pieces of at most 12 ms. In one big step – a slow phone in a
   crowd, or a unit far away that is animated at 15 Hz (up to 0.1 s per update) – the spring overshoots further every frame: the bodies
   flailed back and forth while the feet stood still. The swing is also capped, however many blows land at once. */
function springStep(o, kx, kv, target, k, c, dt, cap) {
  const n = Math.min(12, Math.ceil(dt / 0.012) || 1),
    h = dt / n;
  let x = o[kx] || 0,
    v = o[kv] || 0;
  if (!Number.isFinite(x) || !Number.isFinite(v)) x = v = 0;
  for (let i = 0; i < n; i++) {
    v += (-(x - target) * k - v * c) * h;
    x += v * h;
  }
  o[kx] = clamp(x, target - cap, target + cap);
  o[kv] = clamp(v, -30, 30);
}
function meleeSwing(u, cp, C, at, pre) {
  const i = (u.av || 0) % cp.v.length,
    v = cp.v[i],
    m = cp.m[i],
    fin = m.n === 'f',
    W = u.isPoss ? m.W : m.W * 1.35 + 0.02,
    S = fin ? 0.09 : 0.07,
    H = fin ? 0.16 : 0.09,
    R = fin ? 0.34 : 0.24,
    nx = cp.v[(u.avN ?? i) % cp.v.length][0];
  lerpPose(_cock, cp.ready, nx, u.isPoss ? 0.55 : 0.35); // the raised arm that waits for the next blow
  if (at < W) {
    const q = 1 - Math.pow(1 - at / W, 2); // ease out into the wind-up
    if (u.cFromOn) lerpPose(C, u.cFrom, v[0], q);
    else lerpPose(C, cp.ready, v[0], lerp(u.preHeld || 0, 1, q));
  } else if (at < W + S) {
    const q = (at - W) / S;
    lerpPose(C, v[0], v[1], Math.min(1.12, q * q * 1.12)); // accelerating strike
  } else if (at < W + S + H) lerpPose(C, cp.ready, v[1], 1.12 - 0.12 * sstep(W + S, W + S + H, at));
  else if (at < W + S + H + R) lerpPose(C, v[1], _cock, sstep(W + S + H, W + S + H + R, at));
  else lerpPose(C, _cock, nx, pre);
  // the whole body: a full turn through the strike, or a leap that lands exactly on the strike frame
  u.swYaw = m.spin ? -TAU * sstep(W - 0.02, W + S + H * 0.7, at) : 0;
  if (m.jump && at < W + S) C[HOP] += at < W ? m.jump * Math.sin((at / W) * Math.PI * 0.62) : m.jump * 0.92 * (1 - sstep(W, W + S, at));
  if (m.jump && at >= W + S && !u.landed) {
    u.landed = 1;
    const p = u.g.position;
    if (typeof emitFX === 'function') emitFX('dust', p.x, p.y + 0.1, p.z, { n: 10, size: 1.1 });
  } else if (at < W) u.landed = 0;
}
// a computer warrior's next blow: mostly ordinary ones (never the same twice in a row), now and then a finisher
function pickAv(u) {
  const K = KINDS[u.k];
  if (!CPOSE[u.k]) return 0;
  if (K.role === 'cav' && u.tgtBase) return movesOf(u.k, 'a')[0] ?? 0;
  const pool = Math.random() < 0.1 ? movesOf(u.k, 'f') : movesOf(u.k, 'na').filter(i => i !== u.av);
  return pick(pool.length ? pool : movesOf(u.k, 'n'));
}
const FIDGETS = {
  0: ['stretch', 'scratch', 'look', 'cheer', 'flex', 'axeSpin', 'shieldBang'],
  1: ['stretch', 'look', 'pluck', 'arrow', 'scratch'],
  2: ['back', 'scratch', 'look', 'caneTap', 'fist', 'yawn'],
  3: ['glasses', 'wave', 'look', 'bag', 'teeth'],
  4: ['pat', 'look', 'cheer', 'stretch'],
  5: ['honk', 'look', 'wave', 'stretch'],
  12: ['barrelPat', 'sniff', 'look', 'scratch', 'cheer'],
  13: ['trapCheck', 'look', 'back', 'scratch', 'glasses'],
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
    case 'barrelPat': {
      // Feuerfass: pats his barrel lovingly
      const b = Math.max(0, Math.sin(f.t * 8));
      P[A_R] = L(P[A_R], -0.8 - 0.25 * b, e);
      P[E_R] = L(P[E_R], -1.1, e);
      P[NX] += 0.2 * e;
      look = -0.15 * e;
      if (b > 0.97 && !f.bang && e > 0.4) {
        f.bang = 1;
        SFX.play('bonk', { x: u.g.position.x, z: u.g.position.z, vol: 0.18 });
      } else if (b < 0.2) f.bang = 0;
      break;
    }
    case 'sniff':
      // ... and sniffs the fuse
      P[NX] += 0.4 * e;
      P[LN] += 0.12 * e;
      look = Math.sin(f.t * 9) * 0.08 * e;
      break;
    case 'trapCheck':
      // Fallenleger: lifts the trap and checks the jaws
      P[A_R] = L(P[A_R], -1.25, e);
      P[E_R] = L(P[E_R], -1.3, e);
      P[Z_R] = L(P[Z_R], -0.2, e);
      P[A_L] = L(P[A_L], -1.0, e);
      P[E_L] = L(P[E_L], -1.4 + Math.sin(f.t * 14) * 0.12, e);
      P[NX] += 0.3 * e;
      look = 0.15 * e;
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
    P[E_L] -= (G0.elbow + 0.9 * run + 0.25 * Math.max(0, -s)) * mb * (k === 3 || k === 2 ? 0.2 : k === 12 ? 0 : 1); // (the Feuerfass's left hand stays on the barrel)
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
  const cd = u.cdA || (u.isPoss && K.role === 'ranged' ? K.cd * CFG.possCd * (K.ego || NO_EGO).cd : K.cd),
    at = u.atkT;
  if (at < (u.atPrev ?? 99)) {
    u.preHeld = u.preCur || 0;
    // a new blow starts from the pose the body is really in (mid follow-through in a combo), not from the ready pose: no pop
    u.cFromOn = !!(u.cLast && u.cw > 0.4);
    if (u.cFromOn) (u.cFrom || (u.cFrom = new Float32Array(NP))).set(u.cLast);
  }
  u.atPrev = at;
  // the steered melee warrior never winds up on his own: the player decides when the next blow comes. A steered archer draws the
  // next arrow and the Oma winds up while reloading, so you see when the next shot is ready.
  const pre =
    u.isPoss && K.role === 'ranged'
      ? sstep(cd * 0.5, cd * 0.92, at) // (drawn and held until the next shot: the player sees when it is ready)
      : attacking && !u.isPoss
        ? sstep(cd * 0.55, cd * 0.95, at) * (at < cd * 1.8 ? 1 : Math.max(0, 1 - (at - cd * 1.8) / 0.4))
        : 0;
  u.preCur = pre;
  const fighting = attacking || at < cd * 1.6 || (u.isPoss && K.role === 'ranged' && !u.hen); // (a steered archer or Oma stays at the ready)
  u.cw = lerp(u.cw, fighting ? 1 : 0, 1 - Math.exp(-dt * (fighting ? 10 : 3)));
  if (u.cw > 0.002) {
    const C = _pc;
    let ok = true;
    if (K.role === 'ranged') ok = rangedPose(u, C, at, pre, cd);
    else {
      const cp = CPOSE[k];
      if (cp) meleeSwing(u, cp, C, at, pre);
      else ok = false;
    }
    if (ok) {
      (u.cLast || (u.cLast = new Float32Array(NP))).set(C);
      const wA = u.cw,
        wL = u.cw * (1 - mb * 0.85);
      for (let i = 0; i < NP; i++) {
        const w = (i >= K_L && i <= T_R) || i === HOP ? wL : wA;
        P[i] += (C[i] - P[i]) * w;
      }
    }
  }
  // reactions: hit recoil spring (kicked by every hit), cheering after the target went down
  springStep(u, 'hitA', 'hitV', 0, 140, 21, dt, 1.4);
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
  // Stockwirbel (Opa's special): the cane arm straight out to the side, the cane in line with it, the other arm out for balance
  let spinQ = 0;
  if (k === 2) {
    if ((u.spin || 0) > (u.spinPrev || 0) + 0.01) u.spinMax = u.spin;
    u.spinPrev = u.spin || 0;
    if (u.spin > 0) spinQ = clamp(u.spin / 0.08, 0, 1) * clamp(((u.spinMax || 0.6) - u.spin) / 0.06, 0, 1);
    if (spinQ > 0) {
      P[Z_R] = lerp(P[Z_R], 1.5, spinQ);
      P[A_R] = lerp(P[A_R], 0, spinQ);
      P[E_R] = lerp(P[E_R], 0, spinQ);
      P[Y_R] = lerp(P[Y_R], 0, spinQ);
      P[F_R] = lerp(P[F_R], 0, spinQ);
      P[Z_L] = lerp(P[Z_L], -1.1, spinQ);
      P[A_L] = lerp(P[A_L], 0, spinQ);
      P[E_L] = lerp(P[E_L], -0.2, spinQ);
      P[LN] = lerp(P[LN], 0, spinQ);
    }
  }
  // the newest states (16-sim-fass-falle.js): caught in a trap (tugs at the stuck foot), burning (flails), a lit fuse (trembles)
  if (u.trapped) {
    const w = Math.sin(ph * 13),
      w2 = Math.sin(ph * 7.3);
    if (!seated) {
      P[T_L] = -0.12;
      P[K_L] = 0.22;
      P[T_R] = -0.55 + w2 * 0.35;
      P[K_R] = 0.9 + w2 * 0.3;
    }
    P[LN] = 0.32 + w * 0.08;
    P[RL] = w2 * 0.12;
    if (u.cw < 0.5 && k !== 12) {
      P[A_L] = -1.7 + w * 0.6;
      P[A_R] = -1.5 - w * 0.6;
      P[E_L] = -0.6;
      P[E_R] = -0.6;
    }
    look = w * 0.4;
  } else if (u.burning && u.cw < 0.4 && !seated && k !== 12) {
    const w = Math.sin(ph * 17);
    P[A_L] = -2.7 + w * 0.5;
    P[A_R] = -2.7 - w * 0.5;
    P[E_L] = -0.4;
    P[E_R] = -0.4;
    P[Z_L] = -0.3;
    P[Z_R] = 0.3;
    look = Math.sin(ph * 9) * 0.6;
  }
  if (u.fuseOn) rx += Math.sin(ph * 47) * 0.012;
  if (u.layT > 0) {
    // the Fallenleger throws his trap: the left arm reaches back over the shoulder, then swings it forward and lets go
    u.layT -= dt;
    const t = clamp(1 - u.layT / 0.5, 0, 1),
      back = sstep(0, 0.3, t) * (1 - sstep(0.3, 0.55, t)),
      fwd = sstep(0.3, 0.55, t) * (1 - sstep(0.7, 1, t));
    P[A_L] = lerp(lerp(P[A_L], -2.9, back), -1.7, fwd);
    P[E_L] = lerp(lerp(P[E_L], -1.6, back), -0.15, fwd);
    P[Z_L] = lerp(P[Z_L], -0.25, back);
    P[TW] = lerp(P[TW], 0.45, back) - 0.4 * fwd;
    P[LN] = lerp(P[LN], -0.12, back) + 0.3 * fwd;
    P[T_R] = lerp(P[T_R], -0.4, fwd);
    P[K_R] = lerp(P[K_R], 0.4, fwd);
  }
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
  } else u.rig.rotation.y = u.cw > 0.3 ? u.swYaw || 0 : 0; // the whirlwind finisher turns the whole body
  const target = moving ? Math.sin(t * 0.5) * 0.02 * calm : 0;
  springStep(u, 'wob', 'wobV', target, 90, 14, dt, 0.8);
  u.neck.rotation.z = u.wob - P[RL] * 0.5;
  u.neck.rotation.x = Math.abs(u.wob) * 0.3 + P[NX] - P[LN] * 0.55;
  u.neck.rotation.y = look - P[TW] * 0.6;
  // props
  if (u.bag) {
    u.bag.rotation.x =
      -(P[A_L] + Math.min(0, P[E_L]) + P[LN]) * 0.95 + 0.3 * Math.sin(t + 1) * mb + u.hitA * 0.8 + Math.sin(ph * 1.7) * 0.04;
    u.bag.rotation.z = -P[Z_L] + 0.15 * c * mb;
  }
  if (u.str) {
    // the archer's string: both halves run from the limb tips to the nocking point, which the draw pulls back towards her face
    const pull = clamp(u.pull || 0, 0, 1) * Math.min(1, u.cw * 1.5),
      ny = 0.365 - 0.42 * pull;
    for (let i = 0; i < 2; i++) {
      const tx = i ? 0.555 : -0.555;
      u.str[i].rotation.z = Math.atan2(tx, ny - 0.365);
      u.str[i].scale.y = Math.hypot(tx, ny - 0.365);
    }
    u.nock.position.y = ny;
    u.nock.visible = pull > 0.08;
    // the own archer hears her bow creak as she draws
    if (u.isPoss && u.team === V.myTeam && pull > 0.08 && !(u.pullPrev > 0.08)) SFX.play('bowDraw', { vol: 0.9 });
    u.pullPrev = pull;
  }
  if (u.barrel) {
    // the Feuerfass's barrel rides on his left shoulder and rocks a little with every step and hit
    u.barrel.rotation.z = 0.12 * Math.sin(ph * 2.1) * mb + u.hitA * 0.4;
    u.barrel.rotation.x = Math.PI / 2 - 0.3 + 0.08 * Math.sin(ph * 1.3) * mb;
  }
  if (u.torchFlame) {
    // the torch flame flickers (no randomness: the low-detail model has the same parts in the same order)
    const f = 0.85 + 0.2 * Math.sin(ph * 23) + 0.12 * Math.sin(ph * 37 + 1.3);
    u.torchFlame.scale.set(f, f, 0.8 + 0.35 * Math.sin(ph * 29 + 0.7));
    u.torchFlame.rotation.z = 0.25 * Math.sin(ph * 19);
  }
  if (u.trap) {
    // the Fallenleger's spare trap: hangs on his pack frame and rocks a little with his steps (gone while it lies out there)
    u.trap.visible = u.trapC !== false;
    u.trap.rotation.x = 0.07 * Math.sin(ph * 2.1) * mb + u.hitA * 0.25;
  }
  if (k === 2 && u.weapon) {
    // Opa leans on the cane while walking and standing, swings it in a fight
    const wk = (1 - u.cw) * (1 - 0.8 * run),
      beta = P[A_R] + Math.min(0, P[E_R]) + P[LN],
      delta = 0.3 + 0.22 * s * mb,
      gam = lerp((-Math.PI / 2 - beta - delta) * wk, -Math.PI / 2, spinQ), // spinning: the cane continues the outstretched arm
      gz = lerp(0.65 * wk, 0.65, spinQ); // rotate about the grip, not the cane's end
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
  springStep(u, 'rk', 'rkV', 0, 150, 8, dt, 0.6);
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
  if (u.hitStop > 0)
    u.hitStop -= dt; // hit-stop: the blow freezes for a heartbeat on contact
  else u.atkT += dt;
  humanRig(u, dt, moving, attacking);
}
/* Hidden performance overlay: add ?perf=1 to the URL. Measures CPU time per frame section, draw calls, triangles, shadows. */
