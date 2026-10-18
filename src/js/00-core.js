/* 00-core.js - Tiny helpers every file uses: $ / $$ (DOM), TAU, clamp, lerp, sstep, now(), angDiff, rng(seed) (deterministic), pick, store (localStorage that never throws). */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const now = () => performance.now();
const angDiff = (a, b) => {
  let d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
};
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (_) {}
  },
};
