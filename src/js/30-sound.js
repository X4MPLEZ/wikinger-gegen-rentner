/* 30-sound.js - SOUND: everything is synthesised with WebAudio (plus a few CC0 foley samples in #sndData). SFX.play(name, {x, z, vol}) for one-shots,
   SFX.loop(kind) for continuous voices (motor, worm), SFX.music(on) only for the disco dance. Volume sliders per category (cat.*). */
/* Recorded sounds: CC0 foley by Kenney (www.kenney.nl) – impacts, footsteps, wood, metal, cloth, interface – packed into one MP3 (see #sndData). */
const SND_MAP = {
  'mark': 0.042844,
  'map': {
    'punchH': [
      [0.256, 0.3957],
      [0.7318, 0.3483],
      [1.16, 0.3015],
      [1.5415, 0.3106],
      [1.9321, 0.3486],
    ],
    'punchM': [
      [2.3607, 0.2468],
      [2.6875, 0.2337],
      [3.0012, 0.2441],
      [3.3253, 0.2871],
    ],
    'softH': [
      [3.6924, 0.3598],
      [4.1322, 0.4127],
      [4.6249, 0.4358],
    ],
    'softM': [
      [5.1407, 0.1151],
      [5.3359, 0.18],
      [5.5959, 0.1323],
    ],
    'woodH': [
      [5.8082, 0.2249],
      [6.1131, 0.31],
      [6.5031, 0.1954],
    ],
    'woodM': [
      [6.7785, 0.1775],
      [7.036, 0.1992],
    ],
    'woodL': [
      [7.3152, 0.1007],
      [7.4959, 0.1005],
      [7.6764, 0.0915],
    ],
    'plank': [
      [7.8479, 0.4],
      [8.3279, 0.2025],
      [8.6104, 0.1956],
    ],
    'metalL': [
      [8.886, 0.2055],
      [9.1715, 0.16],
      [9.4115, 0.1381],
    ],
    'metalM': [
      [9.6296, 0.169],
      [9.8786, 0.1586],
    ],
    'plateM': [
      [10.1172, 0.3476],
      [10.5447, 0.45],
    ],
    'rock': [
      [11.0747, 0.548],
      [11.7027, 0.5123],
      [12.295, 0.4951],
    ],
    'gen': [
      [12.8701, 0.112],
      [13.0621, 0.1146],
      [13.2567, 0.15],
      [13.4867, 0.1351],
    ],
    'glassL': [
      [13.7018, 0.1327],
      [13.9145, 0.1374],
      [14.132, 0.132],
    ],
    'glassH': [
      [14.3439, 0.2383],
      [14.6623, 0.2443],
      [14.9866, 0.1687],
    ],
    'bell': [[15.2352, 0.3952]],
    'fGrass': [
      [15.7104, 0.1144],
      [15.9047, 0.15],
      [16.1348, 0.15],
      [16.3648, 0.0942],
      [16.5389, 0.1102],
    ],
    'fSnow': [
      [16.7291, 0.1844],
      [16.9935, 0.19],
      [17.2635, 0.19],
      [17.5335, 0.1849],
      [17.7983, 0.1857],
    ],
    'fWood': [
      [18.064, 0.0807],
      [18.2248, 0.0827],
      [18.3875, 0.093],
    ],
    'fStone': [
      [18.5604, 0.103],
      [18.7435, 0.1076],
      [18.9311, 0.11],
    ],
    'fDirt': [
      [19.1211, 0.1861],
      [19.3872, 0.22],
      [19.6872, 0.22],
      [19.9872, 0.212],
    ],
    'cloth': [
      [20.2792, 0.45],
      [20.8092, 0.3362],
      [21.2253, 0.45],
    ],
    'chop': [[21.7553, 0.2246]],
    'slice': [
      [22.0599, 0.3593],
      [22.4992, 0.4],
    ],
    'creak': [
      [22.9792, 0.5832],
      [23.6423, 0.7],
      [24.4223, 0.2804],
    ],
    'coins': [
      [24.7828, 0.7],
      [25.5628, 0.298],
    ],
    'latch': [[25.9407, 0.18]],
    'leather': [
      [26.2007, 0.3],
      [26.5807, 0.2075],
    ],
    'door': [[26.8682, 0.6]],
    'draw': [[27.5482, 0.2987]],
    'uiClick': [
      [27.9268, 0.0116],
      [28.0185, 0.0071],
    ],
    'uiSelect': [
      [28.1056, 0.0404],
      [28.226, 0.0404],
    ],
    'uiOrder': [[28.3464, 0.1993]],
    'uiConfirm': [[28.6257, 0.52]],
    'uiError': [
      [29.2257, 0.1045],
      [29.4102, 0.22],
    ],
    'uiTick': [
      [29.7102, 0.0203],
      [29.8106, 0.0551],
    ],
    'uiSwitch': [[29.9457, 0.14]],
    'uiDrop': [[30.1657, 0.1005]],
    'uiPluck': [[30.3462, 0.09]],
    'uiMax': [[30.5162, 0.2556]],
    'uiToggle': [[30.8517, 0.1]],
    'uiBong': [[31.0317, 0.1199]],
    'uiGlass': [[31.2317, 0.1]],
  },
}; // where each recorded take sits in the sound sprite (seconds)
const SFX = (() => {
  let ac = null,
    out = null,
    comp = null,
    rev = null,
    nbuf = null,
    nbufLong = null,
    glot = null,
    cat = null,
    muted = store.get('wvr-mute') === '1';
  const last = {};
  let burst = 0,
    burstT = 0;
  /* volume sliders (0-100, stored per device): Gesamt, Musik, Effekte, Umgebung. Every sound runs through one of three category gains, each with its own reverb send so turning a slider down silences the echo too */
  const VOL = Object.assign(
    { all: 100, mus: 50, fx: 100, amb: 100 },
    (() => {
      try {
        return JSON.parse(store.get('wvr-vol') || 'null') || {};
      } catch (_) {
        return {};
      }
    })()
  );
  const vg = v => Math.pow(clamp(+v || 0, 0, 100) / 100, 2),
    MUS_REF = vg(50);
  const catGain = k => (k === 'mus' ? vg(VOL.mus) / MUS_REF : vg(VOL[k])),
    masterGain = () => (muted ? 0 : 0.85 * vg(VOL.all));
  function applyVol() {
    if (!ac || !cat) return;
    const t = ac.currentTime;
    out.gain.setTargetAtTime(masterGain(), t, 0.04);
    for (const k in cat) {
      const v = catGain(k);
      cat[k].d.gain.setTargetAtTime(v, t, 0.04);
      cat[k].w.gain.setTargetAtTime(v, t, 0.04);
    }
  }
  function setVol(k, v) {
    if (!(k in VOL)) return;
    VOL[k] = clamp(Math.round(+v || 0), 0, 100);
    store.set('wvr-vol', JSON.stringify(VOL));
    applyVol();
  }
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
    } catch (_) {
      return false;
    }
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    out = ac.createGain();
    out.gain.value = masterGain();
    comp.connect(out);
    out.connect(ac.destination);
    const ib = makeRoomIR(ac);
    rev = ac.createConvolver();
    rev.buffer = ib;
    const rg = ac.createGain();
    rg.gain.value = 0.22;
    rev.connect(rg);
    rg.connect(comp);
    cat = {};
    for (const k of ['fx', 'amb', 'mus']) {
      const d = ac.createGain(),
        w = ac.createGain();
      d.gain.value = w.gain.value = catGain(k);
      d.connect(comp);
      w.connect(rev);
      cat[k] = { d, w };
    }
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    nbufLong = makeNoise(ac, 4, true);
    try {
      glot = makeGlot(ac);
    } catch (_) {
      glot = null;
    }
    loadSamples();
    return true;
  }
  /* reverb impulse: a short pre-delay, a few early reflections and a tail that gets darker as it decays (a plain white-noise tail hisses).
     Scaled to the same energy as the old tail so the wet levels of all sounds stay as balanced */
  function makeRoomIR(c) {
    const sr = c.sampleRate,
      len = Math.floor(sr * 1.5),
      ib = c.createBuffer(2, len, sr),
      pre = Math.floor(sr * 0.012),
      eRef = len / 7.4 / 3;
    for (let ch = 0; ch < 2; ch++) {
      const d = ib.getChannelData(ch);
      let lp = 0,
        lp2 = 0,
        e = 0;
      for (let i = pre; i < len; i++) {
        const tt = (i - pre) / sr,
          fc = 6500 * Math.exp(-tt * 2.6) + 350,
          k = Math.exp((-TAU * fc) / sr);
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        lp2 = lp2 * k + lp * (1 - k);
        d[i] = (lp + lp2) * 0.5 * Math.exp(-tt * 3.4) * (1 - Math.exp(-tt * 90));
      }
      for (const [ms, g] of [
        [9, 0.55],
        [14, -0.42],
        [21, 0.36],
        [29, -0.3],
        [38, 0.24],
        [49, -0.18],
        [63, 0.13],
      ]) {
        const j = pre + Math.floor(((sr * ms) / 1000) * (ch ? 1.09 : 1));
        if (j < len) d[j] += g * 0.06;
      }
      for (let i = 0; i < len; i++) e += d[i] * d[i];
      const s = Math.sqrt(eRef / Math.max(1e-9, e)) * 0.85;
      for (let i = 0; i < len; i++) d[i] *= s;
    }
    return ib;
  }
  let primed = false,
    keep = null;
  function silentWav() {
    const n = 800,
      b = new Uint8Array(44 + n),
      v = new DataView(b.buffer),
      w = (o, t) => {
        for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i);
      };
    w(0, 'RIFF');
    v.setUint32(4, 36 + n, true);
    w(8, 'WAVE');
    w(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    w(36, 'data');
    v.setUint32(40, n, true);
    b.fill(128, 44);
    let s2 = '';
    for (let i = 0; i < b.length; i++) s2 += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + btoa(s2);
  }
  // A hidden tab (app switch, other tab) goes quiet and saves battery; the sound comes back with the tab.
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    try {
      const p = document.hidden ? ac.state === 'running' && ac.suspend() : primed && ac.state !== 'running' && ac.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  });
  function unlock() {
    if (!init()) return;
    if (ac.state !== 'running') {
      try {
        const p = ac.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (_) {}
    }
    if (!primed) {
      primed = true;
      try {
        const b = ac.createBuffer(1, 1, 22050),
          src = ac.createBufferSource();
        src.buffer = b;
        src.connect(ac.destination);
        src.start(0);
      } catch (_) {}
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch (_) {}
      if (!navigator.audioSession && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
        try {
          keep = new Audio(silentWav());
          keep.loop = true;
          keep.setAttribute('playsinline', '');
          keep.setAttribute('x-webkit-airplay', 'deny');
          const p = keep.play();
          if (p && p.catch)
            p.catch(() => {
              primed = false;
            });
        } catch (_) {}
      }
    } else if (keep && keep.paused) {
      try {
        keep.play().catch(() => {});
      } catch (_) {}
    }
  }
  function bus(vol, pan, wet, c = 'fx') {
    const g = ac.createGain();
    g.gain.value = vol;
    let n = g;
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      n = p;
    }
    n.connect(cat[c].d);
    if (wet && !AUDIO.lite) {
      const w = ac.createGain();
      w.gain.value = wet;
      n.connect(w);
      w.connect(cat[c].w);
    }
    return g;
  }
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(dest, type, f0, f1, t, dur, vol, o = {}) {
    const os = ac.createOscillator(),
      g = ac.createGain();
    os.type = type;
    os.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (o.vib) {
      const l = ac.createOscillator(),
        lg = ac.createGain();
      l.frequency.value = o.vib;
      lg.gain.value = o.vibD || 10;
      l.connect(lg);
      lg.connect(os.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    let n = os;
    if (o.lp) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = o.q || 0.7;
      n.connect(f);
      n = f;
    }
    if (o.bp) {
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.bp;
      f.Q.value = o.q || 3;
      n.connect(f);
      n = f;
    }
    n.connect(g);
    g.connect(dest);
    env(g, t, o.a || 0.005, dur, vol);
    os.start(t);
    os.stop(t + dur + (o.a || 0.005) + 0.05);
  }
  function noise(dest, type, f0, f1, t, dur, vol, q = 1) {
    const s = ac.createBufferSource();
    s.buffer = nbuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = ac.createGain();
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    env(g, t, 0.004, dur, vol);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.05);
  }
  const R = (a, b) => a + Math.random() * (b - a);
  function metal(d, f, t, dur, vol) {
    [
      [1, 1],
      [2.76, 0.55],
      [5.4, 0.3],
      [8.93, 0.16],
    ].forEach(([m, g]) => tone(d, 'sine', f * m, f * m * 0.995, t, dur / m ** 0.4, vol * g));
  }
  function thump(d, f0, t, vol, dur = 0.18) {
    tone(d, 'sine', f0, f0 * 0.32, t, dur, vol);
    noise(d, 'lowpass', 1800, 300, t, 0.03, vol * 0.5);
  }
  function crackle(d, t, dur, vol, n = 30, lo = 900, hi = 4000) {
    for (let i = 0; i < n; i++) noise(d, 'bandpass', R(lo, hi), 0, t + Math.random() * dur, R(0.008, 0.03), vol * R(0.3, 1), 3);
  }
  function swell(d, type, f0, f1, t, dur, vol, q = 1) {
    const s2 = ac.createBufferSource();
    s2.buffer = nbuf;
    s2.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s2.connect(f);
    f.connect(g);
    g.connect(d);
    s2.start(t, Math.random() * 0.5);
    s2.stop(t + dur + 0.05);
  }
  function voice(d, t, f0, f1, dur, vol, fm = [600, 1000], o = {}) {
    const os = ac.createOscillator(),
      g = ac.createGain();
    os.type = 'sawtooth';
    os.frequency.setValueAtTime(f0, t);
    os.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    if (o.vib) {
      const l = ac.createOscillator(),
        lg = ac.createGain();
      l.frequency.value = o.vib;
      lg.gain.value = o.vibD || 8;
      l.connect(lg);
      lg.connect(os.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    const mix = ac.createGain();
    mix.gain.value = 1;
    fm.forEach((f, i) => {
      const b = ac.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.setValueAtTime(f, t);
      if (o.fm2) b.frequency.exponentialRampToValueAtTime(o.fm2[i], t + dur);
      b.Q.value = 7;
      const bg = ac.createGain();
      bg.gain.value = i ? 0.6 : 1;
      os.connect(b);
      b.connect(bg);
      bg.connect(mix);
    });
    mix.connect(g);
    g.connect(d);
    env(g, t, o.a || 0.02, dur, vol * 2.2);
    os.start(t);
    os.stop(t + dur + 0.1);
  }
  /* ---------- recorded sounds: one MP3 sprite of CC0 foley (Kenney, kenney.nl), decoded once; every play picks a take and varies pitch and level ---------- */
  const SMP = { ok: false, buf: null, shift: 0, last: {}, busy: false };
  function loadSamples() {
    if (SMP.busy || !ac || typeof SND_MAP === 'undefined') return;
    SMP.busy = true;
    const el = document.getElementById('sndData');
    if (!el) return;
    let u8;
    try {
      const bin = atob(el.textContent.replace(/\s+/g, ''));
      u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    } catch (_) {
      return;
    }
    const done = b => {
      if (SMP.ok || !b) return;
      try {
        // a decoder that keeps the MP3 start delay shifts everything: the sync click tells by how much
        const d = b.getChannelData(0),
          sr = b.sampleRate,
          n = Math.min(d.length, Math.floor(sr * 0.24));
        let mi = 0,
          mv = 0;
        for (let i = 0; i < n; i++) {
          const v = Math.abs(d[i]);
          if (v > mv) {
            mv = v;
            mi = i;
          }
        }
        SMP.shift = mv > 0.25 ? clamp(mi / sr - SND_MAP.mark, 0, 0.15) : 0;
        SMP.buf = b;
        SMP.ok = true;
      } catch (_) {}
    };
    try {
      const p = ac.decodeAudioData(u8.buffer, done, () => {});
      if (p && p.then) p.then(done, () => {});
    } catch (_) {}
  }
  // S(dest, take group, time, { vol, rate, rv (pitch spread), lp, hp, q, len, i }); false while the recordings are not decoded yet (then the synth version plays)
  function S(d, name, t, o = {}) {
    if (!SMP.ok) return false;
    const vs = SND_MAP.map[name];
    if (!vs) return false;
    let i = o.i !== undefined ? o.i % vs.length : Math.floor(Math.random() * vs.length);
    if (o.i === undefined && vs.length > 1 && i === SMP.last[name]) i = (i + 1) % vs.length;
    SMP.last[name] = i;
    const st = vs[i][0],
      du = vs[i][1],
      len = Math.min(du, o.len || du),
      rate = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * (o.rv ?? 0.05));
    const src = ac.createBufferSource();
    src.buffer = SMP.buf;
    src.playbackRate.value = rate;
    let n = src;
    if (o.lp) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = o.q || 0.7;
      n.connect(f);
      n = f;
    }
    if (o.hp) {
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.hp;
      f.Q.value = 0.7;
      n.connect(f);
      n = f;
    }
    const g = ac.createGain(),
      v = (o.vol ?? 1) * (1 + (Math.random() * 2 - 1) * 0.1),
      end = t + len / rate;
    g.gain.setValueAtTime(v, t);
    if (len < du) {
      g.gain.setValueAtTime(v, Math.max(t, end - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, end);
    }
    n.connect(g);
    g.connect(d);
    src.start(t, st + SMP.shift);
    src.stop(end + 0.01);
    return true;
  }
  function makeNoise(c, secs, pink) {
    const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate),
      d = b.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (!pink) {
        d[i] = w;
        continue;
      }
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return b;
  }
  function makeGlot(c) {
    const n = 48,
      re = new Float32Array(n),
      im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      const a = Math.pow(k, -1.25) * (k % 2 ? 1 : 0.82);
      im[k] = a * Math.cos(k * 0.3);
      re[k] = a * Math.sin(k * 0.3);
    }
    return c.createPeriodicWave(re, im);
  } // a glottal pulse: rich, falling harmonics
  const distCache = {};
  function distCurve(k) {
    if (distCache[k]) return distCache[k];
    const n = 1024,
      c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * k) / Math.tanh(k);
    }
    return (distCache[k] = c);
  }
  // air torn by a blade, a body or a stone: the noise band sweeps up and back down while the level swells and dies
  function whoosh(d, t, dur, f0, f1, f2, vol, q = 1.3) {
    const s = ac.createBufferSource();
    s.buffer = nbuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
    f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(d);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.05);
  }
  function squelchN(d, t, vol) {
    const s = ac.createBufferSource();
    s.buffer = nbuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(380, t);
    f.frequency.exponentialRampToValueAtTime(1300, t + 0.07);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.24);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    s.connect(f);
    f.connect(g);
    g.connect(d);
    s.start(t, Math.random() * 0.8);
    s.stop(t + 0.32);
  }
  /* a small formant voice: glottal source with jitter and a pitch contour, breath noise, an optional growl (subharmonic flutter) and grit,
     four formant bands gliding from one vowel to the next. fs scales the formants (1.15 female, < 1 for something huge). */
  const VOW = {
    a: [730, 1090, 2440, 3400],
    o: [570, 840, 2410, 3300],
    u: [330, 820, 2240, 3200],
    e: [530, 1840, 2480, 3500],
    i: [300, 2200, 2950, 3600],
    ae: [660, 1720, 2410, 3400],
    uh: [620, 1200, 2550, 3500],
  };
  function vox(d, t, o) {
    const dur = o.dur,
      sc = o.fs || 1,
      A = VOW[o.v0 || 'a'],
      Bv = VOW[o.v1 || o.v0 || 'a'],
      N = 28,
      pc = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const q = i / (N - 1);
      j = j * 0.55 + (Math.random() * 2 - 1) * (o.jit ?? 0.025);
      pc[i] = Math.max(
        20,
        o.f0 * Math.pow(o.f1 / o.f0, Math.pow(q, o.curve || 1)) * (1 + j + (o.vib ? Math.sin(q * dur * o.vib * TAU) * (o.vibD || 0.03) : 0))
      );
    }
    const os = ac.createOscillator();
    if (glot) os.setPeriodicWave(glot);
    else os.type = 'sawtooth';
    os.frequency.setValueCurveAtTime(pc, t, dur);
    const src = ac.createGain();
    os.connect(src);
    if (o.br) {
      const ns = ac.createBufferSource();
      ns.buffer = nbuf;
      ns.loop = true;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 500;
      const ng = ac.createGain();
      ng.gain.value = o.br * 0.6;
      ns.connect(hp);
      hp.connect(ng);
      ng.connect(src);
      ns.start(t, Math.random() * 0.8);
      ns.stop(t + dur + 0.1);
    }
    let fr = src;
    if (o.rough) {
      const rg = ac.createGain();
      rg.gain.value = 1 - o.rough * 0.5;
      const l = ac.createOscillator();
      l.frequency.setValueAtTime(o.f0 * 0.5, t);
      l.frequency.exponentialRampToValueAtTime(Math.max(15, o.f1 * 0.5), t + dur);
      const lg = ac.createGain();
      lg.gain.value = o.rough * 0.5;
      l.connect(lg);
      lg.connect(rg.gain);
      l.start(t);
      l.stop(t + dur + 0.1);
      src.connect(rg);
      fr = rg;
    }
    const mix = ac.createGain();
    mix.gain.value = 3.2;
    [1, 0.6, 0.28, 0.14].forEach((amp, k) => {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      const fa = A[k] * sc,
        fb = Bv[k] * sc;
      bp.frequency.setValueAtTime(fa, t);
      if (fb !== fa) bp.frequency.linearRampToValueAtTime(fb, t + dur * 0.8);
      bp.Q.value = fa / [90, 120, 170, 250][k];
      const bg = ac.createGain();
      bg.gain.value = amp;
      fr.connect(bp);
      bp.connect(bg);
      bg.connect(mix);
    });
    const g = ac.createGain(),
      a = o.att || 0.02,
      pk = o.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + a);
    g.gain.setValueAtTime(pk, t + Math.max(a + 0.005, dur * (o.hold ?? 0.55)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = mix;
    if (o.dist) {
      const ws = ac.createWaveShaper();
      ws.curve = distCurve(o.dist);
      mix.connect(ws);
      out = ws;
    }
    if (o.trem) {
      const tg = ac.createGain();
      tg.gain.value = 1 - o.trem * 0.5;
      const l = ac.createOscillator();
      l.frequency.value = o.vib || 10;
      const lg = ac.createGain();
      lg.gain.value = o.trem * 0.5;
      l.connect(lg);
      lg.connect(tg.gain);
      l.start(t);
      l.stop(t + dur + 0.1);
      out.connect(tg);
      out = tg;
    }
    out.connect(g);
    g.connect(d);
    os.start(t);
    os.stop(t + dur + 0.1);
  }
  const femOf = o => !!o && (o.k === 1 || o.k === 3); // Bogenschützin and Oma
  function bird(d, t) {
    const n = 2 + Math.floor(Math.random() * 4),
      f = R(2600, 4300),
      sp = R(0.07, 0.13);
    for (let i = 0; i < n; i++)
      tone(d, 'sine', f * R(0.92, 1.08), f * R(1.15, 1.6), t + i * sp, R(0.035, 0.08), R(0.008, 0.016), {
        vib: R(28, 45),
        vibD: R(120, 320),
      });
  }
  function hawk(d, t) {
    const f = R(2200, 2700),
      du = R(0.9, 1.3);
    tone(d, 'sine', f, f * 0.6, t, du, 0.006, { a: 0.07, vib: R(22, 30), vibD: R(30, 60) });
    tone(d, 'sine', f * 2.01, f * 1.2, t, du * 0.8, 0.0015, { a: 0.07 });
  } // a buzzard circling high over the dunes
  function gull(d, t) {
    for (let i = 0; i < 3; i++)
      vox(d, t + i * 0.32, {
        f0: R(1300, 1500),
        f1: R(850, 950),
        dur: 0.26,
        v0: 'a',
        v1: 'o',
        fs: 2.1,
        vol: 0.012,
        br: 0.5,
        att: 0.02,
        hold: 0.3,
      });
  }
  const SYN = {
    dieV(b, t) {
      voice(b, t, R(150, 190), R(70, 90), R(0.35, 0.55), 0.22, [550, 900], { fm2: [400, 700] });
      thump(b, 110, t + 0.35, 0.35, 0.15);
      noise(b, 'lowpass', 900, 200, t + 0.36, 0.15, 0.2);
    },
    dieR(b, t) {
      voice(b, t, R(260, 320), R(140, 170), R(0.45, 0.65), 0.2, [450, 1100], { vib: 7, vibD: 18, fm2: [700, 1200] });
      thump(b, 110, t + 0.45, 0.3, 0.15);
    },
    drama(b, t) {
      voice(b, t, 210, 95, 1.3, 0.2, [700, 1150], { vib: 5, vibD: 12, a: 0.08, fm2: [500, 900] });
      [220, 262, 330].forEach(f => tone(b, 'sawtooth', f, f * 0.94, t + 0.1, 1.5, 0.035, { lp: 900, a: 0.3 }));
      thump(b, 70, t + 1.35, 0.5, 0.3);
    },
    rocket(b, t) {
      swell(b, 'bandpass', 300, 4500, t, 1.0, 0.35, 1.2);
      tone(b, 'sine', 300, 2400, t, 1.0, 0.1, { vib: 20, vibD: 40 });
      noise(b, 'lowpass', 2000, 300, t, 0.2, 0.3);
    },
    pling(b, t) {
      tone(b, 'sine', 2637, 2637, t, 0.35, 0.14);
      tone(b, 'sine', 3520, 3520, t + 0.07, 0.4, 0.1);
    },
    ghost(b, t) {
      voice(b, t, 330, 260, 1.3, 0.16, [400, 800], { vib: 5, vibD: 25, a: 0.25, fm2: [800, 400] });
      tone(b, 'sine', 880, 660, t + 0.2, 1.1, 0.04, { vib: 6, vibD: 20, a: 0.2 });
    },
    clatter(b, t) {
      metal(b, R(900, 1300), t, 0.25, 0.07);
      metal(b, R(700, 1000), t + 0.09, 0.2, 0.05);
      noise(b, 'bandpass', 2500, 1200, t, 0.05, 0.15, 2);
    },
    splinter(b, t) {
      thump(b, 90, t, 0.7, 0.3);
      for (let i = 0; i < 14; i++) noise(b, 'bandpass', R(500, 2400), R(250, 700), t + R(0, 0.45), R(0.04, 0.12), R(0.15, 0.35), 3);
      noise(b, 'lowpass', 1500, 120, t, 0.8, 0.45);
    },
    squish(b, t) {
      noise(b, 'lowpass', 1800, 200, t, 0.22, 0.6);
      tone(b, 'sine', 500, 90, t, 0.25, 0.4);
      tone(b, 'square', 1200, 300, t + 0.05, 0.1, 0.05, { lp: 2000 });
    },
    crash(b, t) {
      thump(b, 80, t, 0.9, 0.35);
      noise(b, 'lowpass', 2200, 120, t, 0.6, 0.6);
      crackle(b, t + 0.03, 0.4, 0.14, 22, 600, 3000);
    },
    grunt(b, t) {
      voice(b, t, R(140, 230), R(100, 160), 0.12, 0.12, [650, 1050]);
    },
    kill(b, t) {
      thump(b, 130, t, 0.9, 0.2);
      noise(b, 'bandpass', 1500, 500, t, 0.08, 0.5, 1.4);
      tone(b, 'square', 1568, 1568, t + 0.03, 0.06, 0.08, { lp: 4000 });
      tone(b, 'square', 2093, 2093, t + 0.1, 0.12, 0.08, { lp: 4000 });
    },
    ready(b, t) {
      [988, 1319, 1976].forEach((f, i) => tone(b, 'triangle', f, f, t + i * 0.06, 0.28, 0.1, { a: 0.008 }));
      swell(b, 'highpass', 4000, 9000, t, 0.35, 0.05);
    },
    flop(b, t) {
      [
        [311, 0],
        [294, 0.32],
        [277, 0.64],
      ].forEach(([f, d]) => tone(b, 'sawtooth', f, f * 0.985, t + d, 0.26, 0.08, { lp: 1100, a: 0.03 }));
      tone(b, 'sawtooth', 262, 247, t + 0.96, 0.9, 0.09, { lp: 1000, vib: 6, vibD: 9, a: 0.04 });
    },
    pop(b, t) {
      tone(b, 'sine', 300, 1200, t, 0.08, 0.3);
      noise(b, 'bandpass', 2000, 800, t, 0.1, 0.2, 2);
    },
    click(b, t) {
      noise(b, 'bandpass', 2600, 0, t, 0.018, 0.2, 6);
      tone(b, 'sine', 1250, 900, t, 0.035, 0.12);
    },
    tick(b, t) {
      tone(b, 'sine', R(2400, 3200), 0, t, 0.06, 0.07);
    },
    select(b, t) {
      tone(b, 'triangle', 880, 880, t, 0.05, 0.12, { lp: 3000 });
      tone(b, 'triangle', 1320, 1320, t + 0.045, 0.07, 0.1, { lp: 3500 });
    },
    order(b, t) {
      tone(b, 'triangle', 620, 700, t, 0.05, 0.14, { lp: 2500 });
      tone(b, 'triangle', 930, 990, t + 0.06, 0.07, 0.12, { lp: 3000 });
      noise(b, 'highpass', 3000, 0, t, 0.02, 0.05);
    },
    ding(b, t) {
      tone(b, 'sine', 1318, 1318, t, 0.25, 0.16);
      tone(b, 'sine', 1976, 1976, t + 0.09, 0.35, 0.14);
    },
    error(b, t) {
      tone(b, 'square', 220, 200, t, 0.07, 0.06, { lp: 1200 });
      tone(b, 'square', 180, 160, t + 0.09, 0.09, 0.06, { lp: 1200 });
    },
    spawn(b, t) {
      swell(b, 'bandpass', 400, 3200, t, 0.28, 0.16, 2);
      metal(b, 1568, t + 0.2, 0.5, 0.07);
      tone(b, 'sine', 392, 784, t + 0.18, 0.12, 0.12);
    },
    swing(b, t) {
      swell(b, 'bandpass', R(450, 600), R(2200, 2800), t, 0.16, 0.34, 1.8);
      noise(b, 'bandpass', 900, 500, t + 0.13, 0.06, 0.12, 1.5);
    },
    axe(b, t) {
      metal(b, R(480, 560), t, 0.35, 0.16);
      thump(b, R(140, 170), t, 0.6);
      noise(b, 'bandpass', 2500, 1200, t, 0.06, 0.35, 1.5);
      crackle(b, t + 0.01, 0.06, 0.12, 5);
    },
    bonk(b, t) {
      tone(b, 'sine', R(700, 780), 230, t, 0.16, 0.5);
      tone(b, 'triangle', R(1400, 1560), 460, t, 0.08, 0.15);
      noise(b, 'highpass', 3500, 0, t, 0.012, 0.25);
      thump(b, 120, t, 0.25, 0.1);
    },
    bow(b, t) {
      noise(b, 'highpass', 2800, 0, t, 0.012, 0.35);
      tone(b, 'triangle', R(115, 135), R(95, 105), t, 0.22, 0.2, { vib: 38, vibD: 6, lp: 900 });
      tone(b, 'sine', R(230, 260), 200, t, 0.09, 0.08);
      swell(b, 'bandpass', R(2600, 3200), 900, t + 0.015, 0.2, 0.22, 2.5);
    },
    teeth(b, t) {
      for (let i = 0; i < 6; i++) tone(b, 'square', i % 2 ? 2600 : 2050, 1800, t + i * 0.035, 0.012, 0.06, { lp: 5000 });
    },
    slipper(b, t) {
      noise(b, 'bandpass', 500, 900, t, 0.09, 0.35, 2);
      tone(b, 'sine', 300, 180, t, 0.08, 0.18);
    },
    impact(b, t) {
      noise(b, 'lowpass', 1800, 400, t, 0.045, 0.5);
      tone(b, 'sine', R(190, 230), 80, t, 0.08, 0.45);
      noise(b, 'bandpass', R(3200, 4000), 0, t, 0.008, 0.25, 4);
      tone(b, 'triangle', R(900, 1100), 700, t + 0.004, 0.03, 0.06);
    },
    die(b, t) {
      tone(b, 'sine', R(1300, 1500), 260, t, 0.55, 0.09, { vib: 11, vibD: 30, a: 0.02 });
      thump(b, 110, t + 0.5, 0.35, 0.15);
    },
    goat(b, t) {
      const f = R(380, 460);
      tone(b, 'sawtooth', f, f * 0.92, t, 0.5, 0.2, { vib: 7.5, vibD: 28, bp: 1150, q: 3, a: 0.03 });
      tone(b, 'sawtooth', f * 2, f * 1.8, t, 0.45, 0.06, { vib: 7.5, vibD: 40, bp: 2600, q: 4, a: 0.03 });
    },
    horn(b, t) {
      for (const d of [0, 0.17]) {
        tone(b, 'square', 440, 430, t + d, 0.11, 0.1, { lp: 2400 });
        tone(b, 'square', 554, 545, t + d, 0.11, 0.07, { lp: 2400 });
      }
    },
    capture(b, t) {
      [
        [523, 0],
        [659, 0.09],
        [784, 0.18],
      ].forEach(([f, d]) => {
        tone(b, 'sawtooth', f, f, t + d, 0.1, 0.09, { lp: 2200, a: 0.015 });
        tone(b, 'sawtooth', f * 1.005, f, t + d, 0.1, 0.05, { lp: 2200 });
      });
      [523, 659, 784, 1047].forEach(f => tone(b, 'sawtooth', f, f, t + 0.3, 0.55, 0.05, { lp: 2600, a: 0.03, vib: 5, vibD: 3 }));
      metal(b, 2093, t + 0.3, 0.6, 0.04);
    },
    lost(b, t) {
      [
        [392, 0],
        [370, 0.22],
        [349, 0.44],
      ].forEach(([f, d]) => tone(b, 'sawtooth', f, f * 0.98, t + d, 0.18, 0.1, { lp: 1100, a: 0.02 }));
      tone(b, 'sawtooth', 330, 300, t + 0.66, 0.6, 0.1, { lp: 1000, vib: 6, vibD: 10, a: 0.03 });
    },
    special(b, t) {
      noise(b, 'bandpass', 400, 3000, t, 0.3, 0.28, 1.2);
      tone(b, 'sawtooth', 180, 900, t, 0.28, 0.09, { lp: 3000 });
      tone(b, 'sine', 1200, 2400, t + 0.15, 0.2, 0.09);
    },
    rage(b, t) {
      tone(b, 'sawtooth', 120, 70, t, 0.5, 0.22, { lp: 700, vib: 22, vibD: 14 });
      noise(b, 'lowpass', 900, 300, t, 0.4, 0.18);
    },
    possess(b, t) {
      tone(b, 'sine', 300, 1300, t, 0.35, 0.2, { a: 0.02 });
      [1568, 2093, 2637].forEach((f, i) => tone(b, 'triangle', f, f, t + 0.18 + i * 0.06, 0.25, 0.05));
    },
    base(b, t) {
      tone(b, 'sine', 90, 38, t, 0.28, 0.5);
      noise(b, 'lowpass', 500, 150, t, 0.2, 0.3);
    },
    count(b, t) {
      tone(b, 'square', 660, 660, t, 0.1, 0.09, { lp: 2500 });
    },
    go(b, t) {
      tone(b, 'square', 990, 990, t, 0.32, 0.11, { lp: 3000 });
      tone(b, 'square', 495, 495, t, 0.32, 0.05, { lp: 2000 });
    },
    boom(b, t) {
      noise(b, 'highpass', 2000, 0, t, 0.03, 0.5);
      noise(b, 'lowpass', 2400, 70, t, 1.3, 0.8);
      tone(b, 'sine', 78, 26, t, 1.1, 0.9);
      tone(b, 'triangle', 140, 40, t, 0.4, 0.3);
      crackle(b, t + 0.15, 1.0, 0.14, 40, 700, 3500);
    },
    fireball(b, t) {
      swell(b, 'bandpass', 250, 1400, t, 1.35, 0.32, 1.1);
      swell(b, 'lowpass', 120, 500, t, 1.35, 0.35, 0.7);
      crackle(b, t + 0.2, 1.1, 0.1, 45, 1200, 5000);
      tone(b, 'sawtooth', 70, 140, t, 1.3, 0.05, { lp: 400 });
    },
    rumble(b, t) {
      noise(b, 'lowpass', 300, 120, t, 1.1, 0.5);
      tone(b, 'sine', 55, 40, t, 1.1, 0.5, { vib: 9, vibD: 6 });
    },
    creak(b, t) {
      tone(b, 'sawtooth', R(70, 95), R(55, 70), t, 0.9, 0.08, { lp: 500, q: 8, vib: 9, vibD: 5, a: 0.1 });
      noise(b, 'bandpass', 400, 250, t, 0.8, 0.12, 6);
      for (let i = 0; i < 5; i++) noise(b, 'bandpass', R(1500, 3000), 0, t + R(0, 0.7), 0.03, 0.12, 4);
    },
    collapse(b, t) {
      noise(b, 'lowpass', 2500, 100, t, 1.6, 0.8);
      tone(b, 'sine', 80, 25, t, 1.4, 0.9);
      for (let i = 0; i < 8; i++) noise(b, 'bandpass', R(800, 2500), R(300, 600), t + 0.1 + i * R(0.08, 0.16), 0.12, 0.25, 2);
    },
    boing(b, t) {
      tone(b, 'sine', 180, 720, t, 0.25, 0.3, { vib: 16, vibD: 40 });
    },
    stomp(b, t) {
      thump(b, 120, t, 0.8, 0.3);
      noise(b, 'lowpass', 1500, 200, t, 0.25, 0.4);
    },
    chicken(b, t) {
      const f = R(700, 900);
      for (let i = 0; i < 3; i++) tone(b, 'square', f * (i === 2 ? 1.4 : 1), f * 0.8, t + i * 0.09, 0.07, 0.08, { bp: 1400, q: 2 });
    },
    chomp(b, t) {
      tone(b, 'square', 2400, 1600, t, 0.02, 0.06, { lp: 5000 });
      tone(b, 'square', 2200, 1500, t + 0.07, 0.02, 0.05, { lp: 5000 });
    },
    omaThrow(b, t) {
      swell(b, 'bandpass', 380, 1700, t, 0.22, 0.32, 1.2);
      noise(b, 'highpass', 2600, 900, t + 0.02, 0.09, 0.18);
      tone(b, 'triangle', 520, 260, t + 0.01, 0.12, 0.07);
    },
    throw(b, t) {
      swell(b, 'bandpass', 500, 2000, t, 0.3, 0.25, 1.5);
      tone(b, 'sine', 900, 1400, t, 0.15, 0.08);
    },
    disco(b, t) {
      [0, 0.12, 0.24, 0.36, 0.48, 0.6].forEach((d, i) => {
        tone(b, 'sawtooth', [196, 196, 233, 262, 196, 294][i], 0, t + d, 0.1, 0.09, { lp: 1600 });
        thump(b, 90, t + d, 0.35, 0.1);
      });
      [784, 988, 1175, 1568].forEach((f, i) => tone(b, 'square', f, f, t + 0.06 + i * 0.15, 0.08, 0.04, { lp: 4000 }));
      noise(b, 'highpass', 6000, 0, t, 0.7, 0.05);
    },
    alarm(b, t) {
      // "the base is under attack": a low two-tone klaxon, twice – a warning, not a squeak
      for (let i = 0; i < 2; i++) {
        tone(b, 'sawtooth', 330, 330, t + i * 0.72, 0.32, 0.075, { lp: 1100, a: 0.02 });
        tone(b, 'sawtooth', 262, 262, t + i * 0.72 + 0.34, 0.32, 0.075, { lp: 1000, a: 0.02 });
        tone(b, 'sine', 165, 165, t + i * 0.72, 0.66, 0.05);
      }
      thump(b, 70, t, 0.3, 0.3);
    },
    perk(b, t) {
      [660, 880, 1320, 1760, 2640].forEach((f, i) => tone(b, 'sine', f, f, t + i * 0.06, 0.4, 0.08, { a: 0.01 }));
      swell(b, 'highpass', 3000, 8000, t, 0.6, 0.06);
      tone(b, 'sawtooth', 220, 220, t, 0.6, 0.04, { lp: 900, a: 0.05 });
    },
    pick(b, t) {
      [523, 659, 784].forEach(f => tone(b, 'triangle', f, f, t, 0.35, 0.09, { a: 0.01 }));
      metal(b, 1568, t + 0.05, 0.5, 0.06);
    },
    splat(b, t) {
      noise(b, 'lowpass', 1600, 250, t, 0.28, 0.55);
      tone(b, 'sine', 420, 110, t, 0.18, 0.4);
      noise(b, 'bandpass', 900, 300, t + 0.05, 0.2, 0.2, 3);
    },
    catapult(b, t) {
      tone(b, 'sawtooth', 95, 60, t, 0.25, 0.12, { lp: 500, vib: 18, vibD: 8 });
      thump(b, 90, t + 0.22, 0.6, 0.2);
      swell(b, 'bandpass', 300, 1500, t + 0.22, 0.45, 0.25, 1.4);
    },
    headshot(b, t) {
      tone(b, 'square', 1900, 1300, t, 0.05, 0.12, { lp: 5000 });
      tone(b, 'sine', 2637, 2637, t + 0.02, 0.35, 0.16);
      tone(b, 'sine', 3951, 3951, t + 0.05, 0.3, 0.07);
      noise(b, 'lowpass', 2500, 500, t, 0.08, 0.35);
      tone(b, 'sine', 140, 60, t, 0.16, 0.5);
    },
    hitmark(b, t) {
      noise(b, 'bandpass', R(1100, 1400), 500, t, 0.05, 0.45, 1.6);
      tone(b, 'sine', R(210, 240), 90, t, 0.09, 0.4);
      tone(b, 'triangle', 2400, 2000, t, 0.03, 0.06);
    },
    whoosh(b, t) {
      swell(b, 'bandpass', 350, 2200, t, 0.35, 0.36, 1.6);
      tone(b, 'sine', 180, 720, t + 0.05, 0.28, 0.14, { vib: 14, vibD: 30 });
    },
    rush(b, t) {
      for (let i = 0; i < 24; i++) tone(b, 'sine', R(2200, 4200), 0, t + i * 0.05 + R(0, 0.03), 0.12, 0.08);
      [784, 988, 1175, 1568].forEach((f, i) => tone(b, 'sawtooth', f, f, t + 0.1 + i * 0.09, i === 3 ? 0.55 : 0.09, 0.09, { lp: 3000 }));
    },
    win(b, t) {
      [
        [523, 659, 784],
        [587, 740, 880],
        [659, 831, 988],
        [784, 988, 1175],
      ].forEach((ch, i) => ch.forEach(f => tone(b, 'sawtooth', f, f, t + i * 0.18, i === 3 ? 0.9 : 0.16, 0.05, { lp: 2600, a: 0.02 })));
      metal(b, 2093, t + 0.6, 1, 0.05);
    },
    winOld(b, t) {
      [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(b, 'sawtooth', f, f, t + i * 0.13, i === 5 ? 0.7 : 0.12, 0.11, { lp: 2800 }));
    },
    lose(b, t) {
      [392, 370, 349].forEach((f, i) => tone(b, 'sawtooth', f, f, t + i * 0.32, 0.28, 0.12, { lp: 1400 }));
      tone(b, 'sawtooth', 330, 315, t + 0.96, 0.8, 0.12, { lp: 1400, vib: 6, vibD: 9 });
    },
    /* --- one voice per action: every unit and every event has its own sound --- */
    stick(b, t) {
      tone(b, 'sine', R(400, 460), 170, t, 0.09, 0.45);
      tone(b, 'triangle', R(850, 950), 600, t, 0.04, 0.12);
      noise(b, 'bandpass', 1900, 0, t, 0.018, 0.3, 4);
      thump(b, 140, t, 0.2, 0.08);
    },
    swingR(b, t) {
      swell(b, 'bandpass', R(650, 800), R(2800, 3400), t, 0.12, 0.2, 2.2);
    },
    buttHit(b, t) {
      thump(b, R(140, 160), t, 0.75, 0.22);
      noise(b, 'lowpass', 1300, 250, t, 0.1, 0.4);
      crackle(b, t + 0.005, 0.05, 0.14, 6, 700, 2200);
      tone(b, 'sine', 90, 50, t, 0.14, 0.3);
    },
    gallop(b, t) {
      [0, 0.09, 0.2].forEach((d, i) => {
        thump(b, i === 1 ? 95 : 120, t + d, 0.28, 0.08);
        noise(b, 'lowpass', 1200, 300, t + d, 0.04, 0.15);
      });
    },
    scooterHit(b, t) {
      tone(b, 'square', 170, 85, t, 0.12, 0.22, { lp: 650 });
      metal(b, R(1700, 1900), t, 0.16, 0.05);
      thump(b, 100, t, 0.35, 0.12);
      noise(b, 'bandpass', 2600, 900, t, 0.04, 0.2, 2);
    },
    motor(b, t) {
      // the E-Mobil speeding up (Turbo, ramming): a short, soft electric whirr – sines, no buzz
      tone(b, 'sine', 150, 330, t, 0.34, 0.06, { a: 0.05 });
      tone(b, 'triangle', 300, 640, t, 0.3, 0.018, { lp: 900, a: 0.05 });
      noise(b, 'lowpass', 420, 0, t, 0.28, 0.025, 0.7);
    },
    hupe(b, t) {
      for (const d of [0, 0.16]) {
        tone(b, 'square', 523, 523, t + d, 0.11, 0.09, { lp: 2600 });
        tone(b, 'square', 659, 659, t + d, 0.11, 0.07, { lp: 2600 });
        tone(b, 'sawtooth', 262, 262, t + d, 0.11, 0.04, { lp: 1200 });
      }
    },
    volley(b, t) {
      for (let i = 0; i < 5; i++) {
        const d = i * 0.045;
        noise(b, 'highpass', 2800, 0, t + d, 0.01, 0.25);
        tone(b, 'triangle', R(115, 140), 100, t + d, 0.18, 0.14, { vib: 38, vibD: 6, lp: 900 });
      }
      swell(b, 'bandpass', 2000, 600, t + 0.05, 0.35, 0.18, 2);
    },
    spin(b, t) {
      for (let i = 0; i < 5; i++) swell(b, 'bandpass', R(500, 700), R(2400, 3000), t + i * 0.11, 0.1, 0.22, 2);
      tone(b, 'sine', 300, 900, t, 0.5, 0.05, { vib: 9, vibD: 60 });
    },
    teethFan(b, t) {
      for (let i = 0; i < 10; i++) tone(b, 'square', 1800 + i * 110, 1500, t + i * 0.03, 0.012, 0.06, { lp: 5500 });
      noise(b, 'highpass', 3500, 0, t, 0.25, 0.08);
    },
    heave(b, t) {
      voice(b, t, R(120, 150), R(200, 240), 0.22, 0.16, [600, 1000], { a: 0.04 });
      swell(b, 'bandpass', 300, 2600, t + 0.12, 0.3, 0.3, 1.5);
    },
    salvo(b, t) {
      for (let i = 0; i < 3; i++) {
        const d = i * 0.25;
        tone(b, 'sawtooth', 95, 60, t + d, 0.2, 0.1, { lp: 500, vib: 18, vibD: 8 });
        thump(b, 90, t + d + 0.18, 0.55, 0.2);
        swell(b, 'bandpass', 300, 1500, t + d + 0.18, 0.4, 0.2, 1.4);
      }
    },
    roll(b, t) {
      noise(b, 'lowpass', 420, 220, t, 1.2, 0.42);
      tone(b, 'sine', 48, 44, t, 1.2, 0.4, { vib: 7, vibD: 5, a: 0.05 });
      crackle(b, t, 1.1, 0.06, 20, 300, 1200);
    },
    strike(b, t) {
      for (let i = 0; i < 7; i++) {
        const d = R(0, 0.35);
        tone(b, 'triangle', R(700, 1300), R(400, 700), t + d, 0.05, 0.12);
        noise(b, 'bandpass', R(1800, 3200), 0, t + d, 0.02, 0.18, 3);
      }
      thump(b, 110, t, 0.5, 0.15);
    },
    sandBurst(b, t) {
      noise(b, 'lowpass', 2600, 140, t, 0.95, 0.75);
      tone(b, 'sine', 72, 28, t, 0.75, 0.75);
      crackle(b, t + 0.04, 0.7, 0.12, 34, 500, 2600);
    },
    wormRoar(b, t) {
      voice(b, t, 95, 52, 1.05, 0.26, [320, 760], { vib: 8, vibD: 16, a: 0.06, fm2: [260, 540] });
      tone(b, 'sawtooth', 170, 66, t + 0.05, 0.9, 0.07, { lp: 650, vib: 28, vibD: 22 });
      noise(b, 'bandpass', 1900, 650, t, 0.55, 0.12, 2);
    },
    gulp(b, t) {
      tone(b, 'sine', 270, 72, t, 0.3, 0.5, { vib: 13, vibD: 30 });
      noise(b, 'lowpass', 900, 160, t, 0.24, 0.3);
      tone(b, 'sine', 150, 58, t + 0.26, 0.26, 0.42);
    },
    wormDive(b, t) {
      swell(b, 'lowpass', 1700, 170, t, 0.8, 0.5);
      tone(b, 'sine', 95, 38, t, 0.8, 0.4);
    },
    squelch(b, t) {
      noise(b, 'lowpass', 1100, 220, t, 0.22, 0.4);
      tone(b, 'sine', 320, 110, t, 0.2, 0.3, { vib: 20, vibD: 40 });
      tone(b, 'sine', 180, 90, t + 0.12, 0.14, 0.2);
    },
    stompWarn(b, t) {
      [0, 0.14].forEach((d, i) => {
        thump(b, 130 + i * 30, t + d, 0.6, 0.1);
        noise(b, 'lowpass', 1500, 300, t + d, 0.06, 0.3);
      });
      tone(b, 'sawtooth', 70, 110, t, 0.3, 0.06, { lp: 500 });
    },
    combo(b, t) {
      [880, 1109, 1319, 1760, 2637].forEach((f, i) => tone(b, 'triangle', f, f, t + i * 0.055, 0.22, 0.1, { a: 0.005 }));
      for (let i = 0; i < 10; i++) tone(b, 'sine', R(3000, 5500), 0, t + 0.2 + i * 0.03, 0.1, 0.05);
      thump(b, 120, t, 0.4, 0.12);
    },
    konter(b, t) {
      tone(b, 'sine', 1760, 1760, t, 0.14, 0.14);
      tone(b, 'sine', 2349, 2349, t + 0.05, 0.22, 0.12);
      noise(b, 'highpass', 4000, 0, t, 0.02, 0.15);
      tone(b, 'square', 440, 330, t, 0.08, 0.05, { lp: 1500 });
    },
    fog(b, t) {
      swell(b, 'lowpass', 250, 900, t, 1.6, 0.32, 0.6);
      swell(b, 'bandpass', 500, 1400, t + 0.3, 1.4, 0.12, 1.2);
      tone(b, 'sine', 110, 80, t, 1.6, 0.08, { a: 0.4, vib: 4, vibD: 6 });
    },
    wagon(b, t) {
      for (let i = 0; i < 8; i++) {
        tone(b, 'triangle', R(500, 900), R(300, 500), t + i * 0.07, 0.04, 0.08);
        noise(b, 'bandpass', R(1500, 2500), 0, t + i * 0.07, 0.02, 0.1, 3);
      }
      for (let i = 0; i < 6; i++) tone(b, 'sine', R(3500, 5200), 0, t + 0.1 + i * 0.06, 0.12, 0.06);
    },
    coins(b, t) {
      for (let i = 0; i < 14; i++) {
        const f = R(3200, 5600);
        tone(b, 'sine', f, f * 0.98, t + i * 0.04 + R(0, 0.02), 0.14, 0.07);
      }
      tone(b, 'triangle', 1319, 1319, t, 0.3, 0.05);
    },
    flagmove(b, t) {
      for (let i = 0; i < 6; i++) noise(b, 'bandpass', R(600, 1200), R(300, 500), t + i * 0.09, 0.06, 0.22, 1.5);
      tone(b, 'square', 392, 392, t + 0.3, 0.2, 0.06, { lp: 2000 });
      tone(b, 'square', 523, 523, t + 0.5, 0.3, 0.06, { lp: 2000 });
    },
    rally(b, t) {
      tone(b, 'sine', 1900, 2500, t, 0.14, 0.16, { a: 0.01 });
      tone(b, 'sine', 2500, 1800, t + 0.16, 0.2, 0.14);
      noise(b, 'bandpass', 2200, 0, t, 0.3, 0.05, 4);
    },
    switch(b, t) {
      swell(b, 'bandpass', 600, 3400, t, 0.18, 0.22, 1.8);
      tone(b, 'triangle', 1047, 1568, t + 0.1, 0.08, 0.1);
      noise(b, 'bandpass', 2600, 0, t + 0.16, 0.015, 0.15, 6);
    },
    underdog(b, t) {
      [392, 494, 587, 784].forEach((f, i) => tone(b, 'sawtooth', f, f, t + i * 0.1, i === 3 ? 0.6 : 0.1, 0.07, { lp: 2400, a: 0.02 }));
      for (let i = 0; i < 8; i++) tone(b, 'sine', R(3000, 5000), 0, t + 0.3 + i * 0.05, 0.12, 0.05);
    },
    // a chicken's wing beat: a soft feathery whump
    flap(b, t) {
      noise(b, 'bandpass', R(500, 700), R(250, 350), t, 0.09, 0.22, 1.2);
      noise(b, 'lowpass', 900, 200, t + 0.01, 0.07, 0.12);
    },
    // the Feuerfass: the fuse hisses and spits ...
    fuse(b, t) {
      noise(b, 'highpass', 4200, 2600, t, 0.9, 0.16);
      for (let i = 0; i < 10; i++) noise(b, 'bandpass', R(2500, 6000), 0, t + R(0, 0.85), 0.02, 0.18, 5);
      tone(b, 'sine', 1800, 2600, t, 0.9, 0.025);
    },
    // ... and the barrel goes up: a sharp crack, a deep body, a rolling tail and falling debris
    blast(b, t) {
      noise(b, 'highpass', 2500, 0, t, 0.04, 0.7);
      thump(b, 70, t, 1.2, 1);
      noise(b, 'lowpass', 3000, 60, t, 1.7, 0.95);
      tone(b, 'sine', 62, 22, t, 1.5, 1);
      tone(b, 'triangle', 160, 38, t, 0.5, 0.35);
      crackle(b, t + 0.1, 1.4, 0.2, 60, 600, 4200);
      for (let i = 0; i < 7; i++) noise(b, 'bandpass', R(900, 2600), R(400, 700), t + 0.45 + i * R(0.07, 0.15), 0.08, 0.16, 3);
    },
    // a smaller pop: a barrel that bursts when its carrier falls
    dud(b, t) {
      noise(b, 'highpass', 2200, 0, t, 0.03, 0.4);
      thump(b, 90, t, 0.6, 0.6);
      noise(b, 'lowpass', 2000, 90, t, 0.8, 0.5);
      crackle(b, t + 0.08, 0.6, 0.12, 30, 700, 3500);
    },
    // flames on a warrior
    burn(b, t) {
      swell(b, 'bandpass', 300, 900, t, 0.5, 0.12, 1.4);
      crackle(b, t, 0.5, 0.1, 18, 900, 4000);
    },
    // the barrel climbs into the catapult: wood on wood, a creak, a lid thud
    load(b, t) {
      thump(b, 140, t, 0.3, 0.5);
      noise(b, 'bandpass', 700, 300, t, 0.25, 0.3, 3);
      tone(b, 'sawtooth', 90, 70, t + 0.12, 0.5, 0.05, { lp: 500, q: 8, vib: 9, vibD: 5 });
      thump(b, 110, t + 0.4, 0.25, 0.45);
    },
    // a whistling barrel in the air
    fassFly(b, t) {
      tone(b, 'sine', 1500, 700, t, 1.2, 0.07, { vib: 7, vibD: 30 });
      noise(b, 'highpass', 3500, 2500, t, 1.1, 0.06);
    },
    // the bear trap: set (a ratchety click) and snapping shut (a steel clang with a bite)
    trapSet(b, t) {
      metal(b, R(1300, 1500), t, 0.12, 0.08);
      noise(b, 'bandpass', 3000, 0, t, 0.02, 0.2, 6);
      metal(b, R(900, 1000), t + 0.1, 0.18, 0.1);
      noise(b, 'bandpass', 2400, 0, t + 0.1, 0.02, 0.22, 6);
    },
    trapSnap(b, t) {
      noise(b, 'highpass', 3000, 0, t, 0.025, 0.7);
      metal(b, R(600, 700), t, 0.6, 0.3);
      metal(b, R(1500, 1700), t + 0.005, 0.35, 0.16);
      thump(b, 160, t, 0.25, 0.6);
      tone(b, 'square', 2600, 1400, t + 0.01, 0.04, 0.08, { lp: 5000 });
    },
    // the archer draws: the limbs creak under the tension, the string stretches (rising, a little uneven)
    bowDraw(b, t) {
      tone(b, 'sawtooth', R(120, 140), R(210, 240), t, 0.42, 0.05, { bp: 900, q: 9, vib: 23, vibD: 9, a: 0.04 });
      tone(b, 'sawtooth', R(60, 70), R(95, 110), t + 0.05, 0.36, 0.035, { lp: 420, q: 7, vib: 11, vibD: 4, a: 0.05 });
      for (let i = 0; i < 4; i++) noise(b, 'bandpass', R(1800, 3200), 0, t + 0.05 + i * R(0.06, 0.1), 0.025, 0.05, 5);
    },
    // a warrior falls off a cliff: a long cartoon "Aaaaaah…" that drops away (o.hi: a woman's voice; o.d: how far down)
    fallScream(b, t, o = {}) {
      const hi = o.hi ? 1.7 : 1,
        d = o.dur || 1.5;
      voice(b, t, R(330, 380) * hi, R(150, 180) * hi, d, 0.19, [750, 1250], { vib: 6, vibD: 14 * hi, a: 0.04, fm2: [520, 900] });
      voice(b, t + 0.02, R(165, 190) * hi, R(75, 90) * hi, d * 0.95, 0.06, [1100, 2400], { vib: 6.3, vibD: 8 * hi, a: 0.06 });
    },
    // on fire: short panicked yelps, the pitch jumping up and down
    burnScream(b, t, o = {}) {
      const hi = o.hi ? 1.6 : 1;
      for (let i = 0; i < 3; i++) {
        const f = R(300, 420) * hi;
        voice(b, t + i * R(0.2, 0.27), f, f * R(1.2, 1.45), R(0.13, 0.18), 0.16, [800, 1300], { vib: 13, vibD: 30 * hi, a: 0.01 });
      }
    },
    // the E-Mobil-Raser's blow: an electric crackle
    zap(b, t) {
      for (let i = 0; i < 4; i++) noise(b, 'highpass', R(3500, 6000), 0, t + i * R(0.015, 0.03), 0.02, 0.32);
      tone(b, 'square', R(900, 1100), R(300, 380), t, 0.12, 0.05, { lp: 4000 });
      tone(b, 'sawtooth', 120, 60, t, 0.1, 0.05, { lp: 900 });
    },
    // the torch swung through the air: a fiery whoosh
    fireSwing(b, t) {
      noise(b, 'bandpass', 700, 1800, t, 0.22, 0.38, 1.2);
      noise(b, 'lowpass', 500, 200, t + 0.03, 0.25, 0.3);
      thump(b, 90, t + 0.02, 0.12, 0.12);
    },
    // into the water
    splash(b, t) {
      noise(b, 'lowpass', 2600, 400, t, 0.45, 0.6);
      noise(b, 'bandpass', 1200, 500, t + 0.02, 0.35, 0.4, 1.5);
      for (let i = 0; i < 6; i++) tone(b, 'sine', R(500, 900), R(1200, 1900), t + 0.05 + i * R(0.03, 0.06), 0.04, 0.05);
      thump(b, 90, t, 0.3, 0.25);
    },
    // the Fallenleger's row of trap jaws: one after the other they burst out of the ground and snap shut 0.19 s later (FANG_T in
    // 75-fass-falle-view.js; o.n jaws, o.gap seconds apart)
    fangs(b, t, o = {}) {
      const n = o.n || 6,
        gap = o.gap || 0.08;
      for (let i = 0; i < n; i++) {
        const ti = t + i * gap;
        noise(b, 'lowpass', 900, 200, ti, 0.08, 0.22);
        thump(b, R(120, 150), ti, 0.12, 0.4);
        metal(b, R(800, 1000), ti + 0.19, 0.22, 0.11);
        noise(b, 'highpass', 3200, 0, ti + 0.19, 0.02, 0.32);
      }
    },
  };
  /* --- recorded foley layered with the synth: every hit, step and creak is a real recording, varied per play --- */
  const NEW = {
    // the row of trap jaws: real dirt bursting, then real steel clacking shut (the synth adds the thump and the bite)
    fangs(b, t, o = {}) {
      const n = o.n || 6,
        gap = o.gap || 0.08;
      if (!S(b, 'fDirt', t, { vol: 0.5, rate: 0.7 })) return SYN.fangs(b, t, o);
      for (let i = 0; i < n; i++) {
        const ti = t + i * gap;
        if (i) S(b, 'fDirt', ti, { vol: 0.38, rate: R(0.62, 0.8) });
        S(b, 'metalL', ti + 0.19, { vol: 0.4, rate: R(1.3, 1.55), lp: 7500 });
        thump(b, R(120, 150), ti, 0.12, 0.28);
        noise(b, 'highpass', 3200, 0, ti + 0.19, 0.02, 0.2);
      }
    },
    // weapons on bodies
    axe(b, t) {
      if (!S(b, 'punchH', t, { vol: 0.8, rate: 0.95 })) return SYN.axe(b, t);
      S(b, 'metalL', t + 0.004, { vol: 0.2, rate: 0.78, lp: 6500 });
      S(b, 'chop', t + 0.002, { vol: 0.26, rate: 0.85, lp: 5000 });
      thump(b, 105, t, 0.25, 0.12);
    },
    stick(b, t) {
      if (!S(b, 'woodL', t, { vol: 0.75, rate: 1.15 })) return SYN.stick(b, t);
      S(b, 'punchM', t + 0.003, { vol: 0.6, rate: 1.12 });
    },
    buttHit(b, t) {
      if (!S(b, 'softH', t, { vol: 0.9, rate: 1.25 })) return SYN.buttHit(b, t);
      S(b, 'punchH', t + 0.006, { vol: 0.65, rate: 0.82 });
      S(b, 'woodM', t + 0.004, { vol: 0.25, rate: 0.7, lp: 2500 });
    },
    scooterHit(b, t) {
      if (!S(b, 'plateM', t, { vol: 0.42, rate: 0.9, lp: 7000 })) return SYN.scooterHit(b, t);
      S(b, 'punchH', t + 0.004, { vol: 0.75 });
      S(b, 'gen', t + 0.06, { vol: 0.25, rate: 1.3 });
      S(b, 'gen', t + 0.11, { vol: 0.18, rate: 1.5 });
    },
    impact(b, t) {
      if (!S(b, 'softH', t, { vol: 0.75, rate: 1.1 })) return SYN.impact(b, t);
      S(b, 'gen', t + 0.01, { vol: 0.25, rate: 0.9 });
      S(b, 'cloth', t, { vol: 0.22, len: 0.18 });
    },
    bonk(b, t) {
      if (!S(b, 'woodM', t, { vol: 0.8, rate: 1.45 })) return SYN.bonk(b, t);
      S(b, 'punchM', t, { vol: 0.4, rate: 1.3 });
      tone(b, 'sine', R(620, 700), 260, t + 0.005, 0.12, 0.1);
    },
    hitmark(b, t) {
      if (!S(b, 'punchM', t, { vol: 0.55, rate: 1.25, rv: 0.08 })) return SYN.hitmark(b, t);
      S(b, 'uiTick', t, { vol: 0.3, i: 1 });
    },
    headshot(b, t) {
      if (!S(b, 'punchH', t, { vol: 0.62, rate: 1.08 })) return SYN.headshot(b, t);
      S(b, 'bell', t + 0.015, { vol: 0.22, rate: 2.4, len: 0.35 });
      S(b, 'metalL', t + 0.01, { vol: 0.2, rate: 1.5 });
      tone(b, 'sine', 2637, 2637, t + 0.03, 0.3, 0.05);
    },
    kill(b, t) {
      if (!S(b, 'punchH', t, { vol: 0.6, rate: 0.85 })) return SYN.kill(b, t);
      S(b, 'softH', t + 0.02, { vol: 0.4, rate: 1.2 });
      S(b, 'bell', t + 0.05, { vol: 0.14, rate: 3.2, len: 0.25 });
    },
    splat(b, t) {
      if (!S(b, 'softH', t, { vol: 0.7, rate: 1.35 })) return SYN.splat(b, t);
      S(b, 'softM', t + 0.02, { vol: 0.5, rate: 0.85 });
      squelchN(b, t + 0.01, 0.35);
    },
    squish(b, t) {
      if (!S(b, 'softH', t, { vol: 1, rate: 0.9 })) return SYN.squish(b, t);
      S(b, 'plank', t + 0.01, { vol: 0.22, rate: 1.3, lp: 3000 });
      squelchN(b, t, 0.3);
    },
    squelch(b, t) {
      if (!S(b, 'softM', t, { vol: 0.7, rate: 0.8 })) return SYN.squelch(b, t);
      squelchN(b, t, 0.4);
    },
    // swings, throws, shots
    swing(b, t) {
      whoosh(b, t, R(0.2, 0.26), R(380, 480), R(1500, 1900), R(420, 520), 0.42, 1.1);
      whoosh(b, t + 0.03, 0.12, 2200, 4200, 1800, 0.1, 2.4);
      S(b, 'cloth', t, { vol: 0.2, len: 0.25, rate: 1.1 });
    },
    swingR(b, t) {
      whoosh(b, t, R(0.17, 0.22), R(500, 600), R(2000, 2400), R(600, 700), 0.3, 1.4);
      S(b, 'cloth', t, { vol: 0.16, len: 0.2, rate: 1.2 });
    },
    whoosh(b, t) {
      whoosh(b, t, 0.42, 260, 1500, 380, 0.42, 1);
      whoosh(b, t + 0.08, 0.3, 1600, 3600, 1200, 0.09, 2);
    },
    throw(b, t) {
      whoosh(b, t, 0.3, 420, 1900, 600, 0.3, 1.3);
      S(b, 'cloth', t, { vol: 0.22, len: 0.25 });
    },
    omaThrow(b, t) {
      whoosh(b, t, 0.22, 520, 2300, 800, 0.24, 1.5);
      S(b, 'cloth', t, { vol: 0.16, len: 0.2, rate: 1.25 });
    },
    bow(b, t) {
      // string slap, limb thock, the arrow tearing off
      noise(b, 'highpass', 3200, 0, t, 0.01, 0.28);
      tone(b, 'triangle', R(108, 125), R(92, 100), t, 0.2, 0.17, { vib: 34, vibD: 5, lp: 850 });
      tone(b, 'sine', R(215, 240), 190, t, 0.07, 0.06);
      S(b, 'woodL', t + 0.002, { vol: 0.2, rate: 1.9, hp: 400 });
      whoosh(b, t + 0.012, 0.24, 2800, 1500, 700, 0.15, 2.2);
    },
    volley(b, t) {
      for (let i = 0; i < 5; i++) NEW.bow(b, t + i * 0.045 + R(0, 0.012));
    },
    teeth(b, t) {
      if (!S(b, 'glassL', t, { vol: 0.22, rate: 2.2, rv: 0.1 })) return SYN.teeth(b, t);
      for (let i = 1; i < 4; i++) S(b, 'glassL', t + i * R(0.03, 0.045), { vol: 0.15 + Math.random() * 0.06, rate: R(1.9, 2.6), rv: 0 });
    },
    teethFan(b, t) {
      if (!SMP.ok) return SYN.teethFan(b, t);
      for (let i = 0; i < 12; i++) S(b, 'glassL', t + i * R(0.022, 0.034), { vol: 0.19, rate: R(1.8, 2.7), rv: 0 });
      whoosh(b, t, 0.3, 700, 2600, 900, 0.16, 1.4);
    },
    teethHit(b, t) {
      if (S(b, 'glassL', t, { vol: 0.24, rate: 2.3 })) S(b, 'glassL', t + 0.035, { vol: 0.17, rate: 2.6 });
    },
    slipper(b, t) {
      if (!S(b, 'leather', t, { vol: 0.34, rate: 1.2, i: 0 })) return SYN.slipper(b, t);
      whoosh(b, t, 0.18, 500, 1600, 600, 0.16, 1.4);
    },
    arrowHit(b, t) {
      if (S(b, 'woodL', t, { vol: 0.42, rate: 1.35 })) S(b, 'punchM', t, { vol: 0.22, rate: 1.4 });
    },
    slipHit(b, t) {
      if (S(b, 'softM', t, { vol: 0.5, rate: 1.5 })) S(b, 'leather', t, { vol: 0.32, rate: 1.1, i: 1 });
    },
    // siege
    creak(b, t) {
      if (!S(b, 'creak', t, { vol: 0.45, rate: 0.72, lp: 3500 })) return SYN.creak(b, t);
      tone(b, 'sawtooth', R(70, 90), R(55, 65), t, 0.6, 0.025, { lp: 400, q: 6, vib: 9, vibD: 4, a: 0.08 });
    },
    catapult(b, t) {
      if (!S(b, 'latch', t, { vol: 0.5, rate: 0.75 })) return SYN.catapult(b, t);
      S(b, 'woodH', t + 0.05, { vol: 0.72, rate: 0.78 });
      S(b, 'creak', t, { vol: 0.25, rate: 1.1, len: 0.25 });
      thump(b, 75, t + 0.05, 0.38, 0.22);
      whoosh(b, t + 0.08, 0.55, 200, 900, 260, 0.28, 0.9);
    },
    salvo(b, t) {
      for (let i = 0; i < 3; i++) NEW.catapult(b, t + i * 0.25);
    },
    heave(b, t) {
      vox(b, t, { f0: R(120, 140), f1: R(170, 190), dur: 0.24, v0: 'uh', v1: 'a', vol: 0.3, br: 0.35, att: 0.03, hold: 0.4 });
      whoosh(b, t + 0.12, 0.3, 300, 2000, 500, 0.22, 1.2);
    },
    crash(b, t) {
      // a boulder lands: rock and earth, a deep thud, debris pattering down
      if (!S(b, 'rock', t, { vol: 1, rate: 0.82 })) return SYN.crash(b, t);
      S(b, 'woodH', t + 0.005, { vol: 0.5, rate: 0.6 });
      S(b, 'softH', t, { vol: 0.7, rate: 0.75 });
      tone(b, 'sine', 68, 28, t, 0.55, 0.6);
      noise(b, 'lowpass', 1400, 100, t, 0.7, 0.32);
      for (let i = 0; i < 5; i++) S(b, 'gen', t + 0.08 + i * R(0.05, 0.11), { vol: R(0.12, 0.28), rate: R(0.7, 1.3), rv: 0 });
    },
    base(b, t) {
      if (!S(b, 'door', t, { vol: 0.75, rate: 0.75 })) return SYN.base(b, t);
      S(b, 'rock', t, { vol: 0.42, rate: 0.62 });
      tone(b, 'sine', 80, 35, t, 0.32, 0.42);
    },
    splinter(b, t) {
      if (!S(b, 'plank', t, { vol: 0.7, rate: 0.9 })) return SYN.splinter(b, t);
      S(b, 'woodH', t + 0.01, { vol: 0.58, rate: 0.8 });
      for (let i = 0; i < 4; i++) S(b, 'plank', t + 0.06 + i * R(0.05, 0.12), { vol: R(0.25, 0.5), rate: R(0.8, 1.4), rv: 0 });
      for (let i = 0; i < 4; i++) S(b, 'gen', t + 0.15 + i * R(0.05, 0.1), { vol: 0.2, rate: R(0.8, 1.2) });
    },
    collapse(b, t) {
      if (!SMP.ok) return SYN.collapse(b, t);
      noise(b, 'lowpass', 1800, 90, t, 1.8, 0.5);
      tone(b, 'sine', 70, 24, t, 1.6, 0.65);
      for (let i = 0; i < 9; i++) {
        const d = t + 0.05 + i * R(0.09, 0.18);
        S(b, i % 3 ? 'plank' : 'woodH', d, { vol: R(0.4, 0.8), rate: R(0.6, 1.0), rv: 0 });
        if (i % 2) S(b, 'rock', d + 0.02, { vol: 0.3, rate: R(0.55, 0.8) });
      }
      for (let i = 0; i < 8; i++) S(b, 'gen', t + 0.6 + i * R(0.06, 0.14), { vol: 0.2, rate: R(0.7, 1.3) });
    },
    clatter(b, t) {
      if (!S(b, 'metalL', t, { vol: 0.32, rate: 0.9 })) return SYN.clatter(b, t);
      S(b, 'metalM', t + 0.09, { vol: 0.24, rate: 1.1 });
      S(b, 'woodL', t + 0.16, { vol: 0.2, rate: 1.2 });
    },
    boom(b, t) {
      if (SMP.ok) {
        S(b, 'rock', t, { vol: 0.9, rate: 0.55 });
        S(b, 'softH', t, { vol: 0.8, rate: 0.6 });
        for (let i = 0; i < 6; i++) S(b, 'gen', t + 0.2 + i * R(0.06, 0.15), { vol: 0.2, rate: R(0.6, 1.1) });
      }
      SYN.boom(b, t);
    },
    // movement, mounts
    gallop(b, t) {
      if (!SMP.ok) return SYN.gallop(b, t);
      [0, 0.085, 0.19].forEach((d, i) => {
        S(b, 'fStone', t + d, { vol: i === 1 ? 0.5 : 0.62, rate: R(1.35, 1.55), rv: 0 });
        S(b, 'woodL', t + d, { vol: 0.16, rate: 2.1, rv: 0.05 });
      });
    },
    stomp(b, t) {
      if (!S(b, 'softH', t, { vol: 1, rate: 0.8 })) return SYN.stomp(b, t);
      S(b, 'rock', t, { vol: 0.35, rate: 0.7 });
    },
    stompWarn(b, t) {
      if (!SMP.ok) return SYN.stompWarn(b, t);
      [0, 0.14].forEach((d, i) => {
        S(b, 'softH', t + d, { vol: 0.7, rate: 1.1 + i * 0.15 });
        S(b, 'fDirt', t + d, { vol: 0.4, rate: 0.8 });
      });
    },
    boing(b, t) {
      SYN.boing(b, t);
      S(b, 'woodM', t, { vol: 0.42, rate: 0.75 });
    },
    stepGrass(b, t) {
      S(b, 'fGrass', t, { vol: 0.55, rv: 0.08 });
    },
    stepSand(b, t) {
      if (S(b, 'fSnow', t, { vol: 0.48, rate: 0.78, lp: 3200, rv: 0.08 })) S(b, 'softM', t, { vol: 0.14, rate: 1.6 });
    },
    stepSnow(b, t) {
      S(b, 'fSnow', t, { vol: 0.6, rv: 0.08 });
    },
    stepIce(b, t) {
      if (S(b, 'fStone', t, { vol: 0.42, rate: 1.25, hp: 300 }) && Math.random() < 0.15) S(b, 'glassL', t + 0.01, { vol: 0.05, rate: 1.6 });
    },
    stepWood(b, t) {
      S(b, 'fWood', t, { vol: 0.55, rv: 0.08 });
    },
    stepStone(b, t) {
      S(b, 'fDirt', t, { vol: 0.5, rv: 0.08 });
    },
    stepWater(b, t) {
      noise(b, 'bandpass', R(900, 1400), 400, t, 0.16, 0.2, 1.2);
      noise(b, 'lowpass', 700, 200, t, 0.12, 0.18);
      for (let i = 0; i < 3; i++) tone(b, 'sine', R(500, 900), R(1000, 1600), t + 0.04 + i * 0.03, 0.03, 0.025);
    },
    stepBear(b, t) {
      if (S(b, 'softM', t, { vol: 0.55, rate: 0.7 })) S(b, MAP && MAP.type === 'arktis' ? 'fSnow' : 'fGrass', t, { vol: 0.32, rate: 0.75 });
    },
    hoof(b, t) {
      if (S(b, 'fStone', t, { vol: 0.5, rate: R(1.3, 1.5), rv: 0 })) S(b, 'woodL', t, { vol: 0.14, rate: 2 });
    },
    wheel(b, t) {
      S(b, 'creak', t, { vol: 0.28, rate: R(0.5, 0.65), lp: 2500 });
    },
    // voices: a small formant synth instead of buzzing blips (women for Bogenschützin and Oma)
    grunt(b, t, o) {
      const f = femOf(o);
      vox(b, t, {
        f0: R(125, 165) * (f ? 1.75 : 1),
        f1: R(95, 120) * (f ? 1.7 : 1),
        dur: R(0.13, 0.19),
        v0: 'uh',
        v1: f ? 'e' : 'o',
        fs: f ? 1.16 : 1,
        vol: 0.28,
        br: 0.45,
        att: 0.012,
        hold: 0.3,
        jit: 0.04,
        rough: f ? 0 : 0.2,
      });
    },
    dieV(b, t, o) {
      const f = femOf(o);
      vox(b, t, {
        f0: f ? R(380, 430) : R(175, 205),
        f1: f ? R(210, 240) : R(80, 95),
        dur: R(0.5, 0.7),
        v0: 'a',
        v1: 'o',
        fs: f ? 1.17 : 1,
        vol: 0.32,
        br: 0.3,
        att: 0.03,
        hold: 0.45,
        vib: 6,
        vibD: 0.03,
        rough: f ? 0.05 : 0.35,
        curve: 1.6,
        jit: 0.03,
      });
      if (!S(b, 'softH', t + R(0.5, 0.62), { vol: 0.6, rate: 1.05 })) thump(b, 110, t + 0.5, 0.3, 0.15);
    },
    dieR(b, t, o) {
      const f = femOf(o);
      vox(b, t, {
        f0: f ? R(320, 360) : R(190, 220),
        f1: f ? R(200, 230) : R(115, 130),
        dur: R(0.6, 0.8),
        v0: 'o',
        v1: f ? 'e' : 'u',
        fs: f ? 1.15 : 1,
        vol: 0.28,
        br: 0.45,
        att: 0.04,
        hold: 0.5,
        vib: 6.5,
        vibD: 0.07,
        jit: 0.05,
        curve: 1.3,
      });
      if (!S(b, 'softH', t + R(0.62, 0.78), { vol: 0.55, rate: 1.1 })) thump(b, 110, t + 0.6, 0.3, 0.15);
    },
    drama(b, t, o) {
      const f = femOf(o);
      vox(b, t, {
        f0: f ? 420 : 230,
        f1: f ? 220 : 98,
        dur: 1.3,
        v0: 'e',
        v1: 'a',
        fs: f ? 1.16 : 1,
        vol: 0.28,
        br: 0.25,
        att: 0.08,
        hold: 0.6,
        vib: 5.5,
        vibD: 0.045,
        curve: 2.2,
        rough: f ? 0 : 0.15,
      });
      [220, 262, 330].forEach(fq => tone(b, 'sawtooth', fq, fq * 0.94, t + 0.1, 1.5, 0.025, { lp: 900, a: 0.3 }));
      if (!S(b, 'softH', t + 1.35, { vol: 0.7, rate: 0.95 })) thump(b, 70, t + 1.35, 0.5, 0.3);
    },
    rage(b, t) {
      vox(b, t, {
        f0: 125,
        f1: 92,
        dur: 0.75,
        v0: 'a',
        v1: 'o',
        vol: 0.34,
        br: 0.35,
        att: 0.04,
        hold: 0.6,
        rough: 0.65,
        dist: 2.2,
        vib: 7,
        vibD: 0.025,
        jit: 0.05,
      });
      noise(b, 'lowpass', 900, 300, t, 0.4, 0.1);
    },
    ghost(b, t) {
      vox(b, t, { f0: 330, f1: 250, dur: 1.3, v0: 'u', v1: 'o', fs: 1.1, vol: 0.15, br: 0.5, att: 0.3, hold: 0.5, vib: 5, vibD: 0.06 });
      tone(b, 'sine', 880, 660, t + 0.2, 1.1, 0.025, { vib: 6, vibD: 20, a: 0.2 });
    },
    goat(b, t) {
      const f = R(360, 450);
      vox(b, t, {
        f0: f,
        f1: f * 0.88,
        dur: R(0.55, 0.7),
        v0: 'ae',
        v1: 'e',
        fs: 1.25,
        vol: 0.28,
        br: 0.35,
        att: 0.03,
        hold: 0.7,
        vib: R(9, 12),
        vibD: 0.08,
        jit: 0.03,
        trem: 0.55,
      });
    },
    chicken(b, t) {
      const f = R(620, 760);
      for (let i = 0; i < 3; i++)
        vox(b, t + i * 0.1, {
          f0: f * (i === 2 ? 1.25 : 1),
          f1: f * 0.82,
          dur: 0.07,
          v0: 'o',
          v1: 'a',
          fs: 1.45,
          vol: 0.2,
          br: 0.3,
          att: 0.004,
          hold: 0.2,
        });
      vox(b, t + 0.32, { f0: f * 1.1, f1: f * 1.5, dur: 0.24, v0: 'a', v1: 'e', fs: 1.5, vol: 0.2, br: 0.3, att: 0.01, hold: 0.5 });
    },
    // polar bear: a deep animal roar, a heavy paw
    bearRoar(b, t) {
      vox(b, t, {
        f0: R(95, 115),
        f1: R(68, 80),
        dur: R(0.6, 0.8),
        v0: 'a',
        v1: 'o',
        fs: 0.72,
        vol: 0.34,
        br: 0.55,
        att: 0.05,
        hold: 0.5,
        rough: 0.75,
        dist: 2.6,
        jit: 0.07,
        vib: 6,
        vibD: 0.03,
      });
      S(b, 'cloth', t, { vol: 0.14, rate: 0.6, len: 0.3 });
    },
    bearSwipe(b, t) {
      whoosh(b, t, 0.22, 300, 1200, 400, 0.28, 1);
      if (Math.random() < 0.45) NEW.bearRoar(b, t + 0.04);
    },
    bearHit(b, t) {
      if (!S(b, 'punchH', t, { vol: 0.8, rate: 0.72 })) return SYN.buttHit(b, t);
      S(b, 'softH', t + 0.004, { vol: 0.5, rate: 0.9 });
      S(b, 'cloth', t, { vol: 0.2, rate: 0.8, len: 0.2 });
    },
    // the sandworm
    wormRoar(b, t) {
      vox(b, t, {
        f0: 62,
        f1: 38,
        dur: 1.25,
        v0: 'a',
        v1: 'o',
        fs: 0.55,
        vol: 0.42,
        br: 0.6,
        att: 0.05,
        hold: 0.55,
        rough: 0.8,
        dist: 3,
        jit: 0.06,
        vib: 7,
        vibD: 0.04,
      });
      vox(b, t + 0.03, { f0: 124, f1: 70, dur: 1.0, v0: 'a', v1: 'u', fs: 0.7, vol: 0.13, br: 0.4, att: 0.06, rough: 0.5, dist: 2 });
      tone(b, 'sine', 48, 30, t, 1.2, 0.45);
      noise(b, 'bandpass', 1700, 600, t, 0.7, 0.08, 1.5);
      for (let i = 0; i < 7; i++) S(b, 'glassL', t + 0.15 + i * R(0.05, 0.09), { vol: 0.07, rate: R(0.5, 0.7), rv: 0 });
    },
    wormGrowl(b, t) {
      vox(b, t, {
        f0: R(50, 60),
        f1: R(38, 44),
        dur: R(0.7, 1.0),
        v0: 'o',
        v1: 'u',
        fs: 0.5,
        vol: 0.24,
        br: 0.6,
        att: 0.12,
        hold: 0.5,
        rough: 0.7,
        dist: 2.5,
        jit: 0.06,
      });
    },
    sandBurst(b, t) {
      // tons of sand blown up and raining down
      noise(b, 'lowpass', 2400, 120, t, 1.1, 0.65);
      tone(b, 'sine', 62, 26, t, 0.9, 0.7);
      noise(b, 'highpass', 1800, 0, t + 0.1, 1.3, 0.09);
      if (SMP.ok) {
        S(b, 'softH', t, { vol: 0.9, rate: 0.62 });
        S(b, 'softH', t + 0.04, { vol: 0.6, rate: 0.5 });
        for (let i = 0; i < 14; i++)
          S(b, i % 2 ? 'fSnow' : 'gen', t + 0.25 + i * R(0.04, 0.1), { vol: R(0.08, 0.2), rate: R(0.5, 0.9), rv: 0, lp: 3000 });
      } else crackle(b, t + 0.04, 0.7, 0.12, 34, 500, 2600);
    },
    wormDive(b, t) {
      // head first into the dune: the sand pours in after it
      swell(b, 'lowpass', 1600, 160, t, 0.85, 0.42);
      tone(b, 'sine', 90, 36, t, 0.8, 0.38);
      if (SMP.ok) {
        S(b, 'softH', t + 0.05, { vol: 0.6, rate: 0.55 });
        for (let i = 0; i < 10; i++)
          S(b, 'fSnow', t + 0.15 + i * R(0.05, 0.09), { vol: R(0.1, 0.22), rate: R(0.45, 0.7), rv: 0, lp: 2500 });
      }
    },
    chomp(b, t) {
      // the maw snaps shut: bone and gristle
      if (!S(b, 'punchH', t, { vol: 0.78, rate: 0.62 })) return SYN.chomp(b, t);
      S(b, 'woodH', t + 0.004, { vol: 0.6, rate: 0.55 });
      S(b, 'plank', t + 0.01, { vol: 0.28, rate: 0.8, lp: 3500 });
      tone(b, 'sine', 95, 45, t, 0.18, 0.32);
    },
    wormBite(b, t) {
      NEW.chomp(b, t);
      noise(b, 'lowpass', 1800, 200, t, 0.35, 0.28);
      if (SMP.ok) for (let i = 0; i < 5; i++) S(b, 'fSnow', t + 0.05 + i * 0.05, { vol: 0.11, rate: R(0.5, 0.75), rv: 0, lp: 2500 });
    },
    gulp(b, t) {
      tone(b, 'sine', 230, 60, t, 0.32, 0.45, { vib: 11, vibD: 28 });
      noise(b, 'lowpass', 800, 140, t, 0.26, 0.26);
      tone(b, 'sine', 130, 48, t + 0.26, 0.28, 0.42);
      S(b, 'softH', t + 0.05, { vol: 0.55, rate: 0.55 });
      S(b, 'softM', t + 0.3, { vol: 0.42, rate: 0.5 });
    },
    wormSpit(b, t) {
      noise(b, 'bandpass', 900, 2600, t, 0.25, 0.32, 1.2);
      tone(b, 'sine', 160, 320, t, 0.12, 0.22);
      S(b, 'softM', t, { vol: 0.6, rate: 0.7 });
    },
    // money, items, interface
    coins(b, t) {
      if (!S(b, 'coins', t, { vol: 0.5, i: 0 })) return SYN.coins(b, t);
    },
    pick(b, t) {
      if (!S(b, 'leather', t, { vol: 0.5, i: 1 })) return SYN.pick(b, t);
      S(b, 'coins', t + 0.03, { vol: 0.42, i: 1 });
      tone(b, 'triangle', 1319, 1319, t + 0.05, 0.25, 0.035);
    },
    wagon(b, t) {
      if (!S(b, 'creak', t, { vol: 0.5, rate: 0.55 })) return SYN.wagon(b, t);
      S(b, 'coins', t + 0.15, { vol: 0.5, i: 0 });
      for (let i = 0; i < 4; i++) S(b, 'woodL', t + i * 0.12, { vol: 0.16, rate: 0.8 });
    },
    click(b, t) {
      if (!S(b, 'uiClick', t, { vol: 0.22 })) return SYN.click(b, t);
    },
    select(b, t) {
      if (!S(b, 'uiSelect', t, { vol: 0.18 })) return SYN.select(b, t);
    },
    order(b, t) {
      if (!S(b, 'uiOrder', t, { vol: 0.22 })) return SYN.order(b, t);
    },
    error(b, t) {
      if (!S(b, 'uiError', t, { vol: 0.16, i: 0 })) return SYN.error(b, t);
    },
    tick(b, t) {
      if (!S(b, 'uiTick', t, { vol: 0.15, i: 0 })) return SYN.tick(b, t);
    },
    ding(b, t) {
      if (!S(b, 'uiConfirm', t, { vol: 0.28 })) return SYN.ding(b, t);
    },
    switch(b, t) {
      if (!S(b, 'uiSwitch', t, { vol: 0.22 })) return SYN.switch(b, t);
      whoosh(b, t, 0.18, 600, 2400, 800, 0.11, 1.6);
    },
    rally(b, t) {
      if (!S(b, 'uiDrop', t, { vol: 0.32 })) return SYN.rally(b, t);
      S(b, 'cloth', t + 0.02, { vol: 0.28, len: 0.3 });
    },
    possess(b, t) {
      if (!S(b, 'uiMax', t, { vol: 0.2 })) return SYN.possess(b, t);
      whoosh(b, t, 0.35, 300, 2200, 600, 0.18, 1.2);
    },
    spawn(b, t) {
      if (!S(b, 'draw', t, { vol: 0.45, rate: 1.05 })) return SYN.spawn(b, t);
      S(b, 'leather', t + 0.06, { vol: 0.28, i: 1 });
    },
    pop(b, t) {
      if (!S(b, 'uiPluck', t, { vol: 0.45 })) return SYN.pop(b, t);
    },
    ready(b, t) {
      if (!S(b, 'uiConfirm', t, { vol: 0.22, rate: 1.12 })) return SYN.ready(b, t);
    },
  };
  const LIB = Object.assign({}, SYN, NEW);
  const GAP = {
    bowDraw: 250,
    fallScream: 350,
    burnScream: 450,
    splash: 150,
    fangs: 120,
    zap: 60,
    fireSwing: 60,
    bearRoar: 400,
    bearSwipe: 120,
    bearHit: 60,
    arrowHit: 40,
    slipHit: 40,
    teethHit: 60,
    wormGrowl: 500,
    wormBite: 120,
    wormSpit: 300,
    stepWater: 60,
    hoof: 40,
    wheel: 300,
    gulp: 200,
    stick: 40,
    buttHit: 60,
    scooterHit: 60,
    motor: 150,
    hupe: 400,
    gallop: 200,
    volley: 300,
    spin: 400,
    teethFan: 300,
    heave: 200,
    salvo: 600,
    roll: 500,
    strike: 400,
    squelch: 200,
    stompWarn: 300,
    combo: 500,
    konter: 250,
    fog: 3000,
    wagon: 800,
    coins: 300,
    flagmove: 800,
    rally: 400,
    switch: 150,
    underdog: 2000,
    kill: 120,
    creak: 300,
    flop: 800,
    dieV: 90,
    dieR: 90,
    drama: 400,
    rocket: 200,
    ghost: 400,
    clatter: 50,
    splinter: 120,
    squish: 80,
    crash: 70,
    grunt: 120,
    ready: 500,
    pop: 60,
    chicken: 250,
    chomp: 300,
    boing: 80,
    stomp: 80,
    disco: 300,
    alarm: 1500,
    splat: 60,
    catapult: 80,
    perk: 300,
    pick: 200,
    hitmark: 40,
    whoosh: 60,
    headshot: 60,
    swing: 30,
    axe: 40,
    bonk: 40,
    bow: 45,
    teeth: 60,
    impact: 50,
    die: 110,
    goat: 900,
    horn: 900,
    spawn: 60,
    base: 600,
    slipper: 50,
    select: 40,
    tick: 25,
    click: 30,
  };
  const SOFT = new Set([
    'arrowHit',
    'slipHit',
    'teethHit',
    'axe',
    'bonk',
    'stick',
    'buttHit',
    'scooterHit',
    'swingR',
    'gallop',
    'motor',
    'swing',
    'impact',
    'grunt',
    'die',
    'dieV',
    'dieR',
    'drama',
    'clatter',
    'slipper',
    'teeth',
    'omaThrow',
    'bow',
    'chomp',
    'squish',
  ]);
  // left/right as the listener sees it, from the camera's right vector: also right for sounds behind you (a screen projection mirrors there)
  function soundPan(x, z) {
    const e = camera.matrixWorld.elements,
      dx = x - camera.position.x,
      dz = z - camera.position.z,
      l = Math.hypot(dx, dz) || 1;
    return clamp(((dx * e[0] + dz * e[2]) / l) * 0.8, -0.8, 0.8);
  }
  function play(name, o = {}) {
    if (muted || !ac || ac.state !== 'running') return;
    if (name === 'teeth' && !o.noThrow) play('omaThrow', { ...o, vol: (o.vol || 1) * 1.1 });
    const f = LIB[name];
    if (!f) return;
    const tn = now();
    if (GAP[name] && last[name] && tn - last[name] < GAP[name]) return;
    let vol = o.vol || 1,
      pan = 0;
    if (o.x !== undefined) {
      const at = listenerPos(),
        d = Math.hypot(o.x - at.x, o.z - at.z);
      vol *= Math.pow(clamp(1 - d / (V.poss ? 45 : 85), 0, 1), 1.4);
      if (vol < 0.03) return;
      pan = soundPan(o.x, o.z);
    }
    if (SOFT.has(name) && o.x !== undefined) {
      const at2 = listenerPos(),
        d2 = Math.hypot(o.x - at2.x, o.z - at2.z);
      vol *= V.poss ? (d2 < 3.5 ? 1.15 : 0.45) : 0.35;
      if (vol < 0.03) return;
    }
    // at most 10 sounds (5 on weak devices) per 100 ms; counted after the distance check, so far-away sounds that are not played
    // do not use up the budget of the ones close by
    if (tn - burstT > 100) {
      burstT = tn;
      burst = 0;
    }
    if (++burst > (AUDIO.lite ? 5 : 10)) return;
    last[name] = tn;
    try {
      f(bus(vol, pan, o.wet !== undefined ? o.wet : 0.25), ac.currentTime + 0.01, o);
    } catch (e) {
      console.warn('sfx', name, e && e.message);
    }
  }
  const MUS = { on: false, g: null, next: 0, step: 0, timer: null };
  function musicTick() {
    if (!ac || !MUS.g) return;
    if (MUS.next < ac.currentTime) MUS.next = ac.currentTime + 0.02; // after a stall: go on from now, never play the missed notes all at once
    const spb = 60 / 122 / 2,
      ahead = ac.currentTime + 0.25;
    const bass = [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47],
      chords = [
        [57, 60, 64, 67],
        [55, 59, 62, 67],
        [53, 57, 60, 65],
        [55, 59, 62, 66],
      ],
      mel = [76, 0, 74, 76, 0, 79, 0, 76, 74, 0, 72, 0, 74, 0, 71, 0];
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    while (MUS.next < ahead) {
      const t = MUS.next,
        i = MUS.step % 16,
        bar = Math.floor(MUS.step / 16) % 4,
        d = MUS.g;
      if (i % 2 === 0) {
        tone(d, 'sine', 150, 45, t, 0.16, 0.55);
      }
      if (i % 2 === 1) noise(d, 'highpass', 7000, 0, t, 0.06, 0.12);
      if (i % 4 === 2) {
        noise(d, 'bandpass', 1800, 1200, t, 0.09, 0.25, 1.5);
        noise(d, 'highpass', 3000, 0, t + 0.01, 0.05, 0.12);
      }
      tone(d, 'sawtooth', hz(bass[(i + bar * 4) % 16] - (bar === 2 ? 2 : 0)), 0, t, spb * 0.8, 0.09, { lp: 700 });
      if (i === 2 || i === 6 || i === 10 || i === 14)
        chords[bar].forEach(m => tone(d, 'square', hz(m), 0, t, spb * 0.55, 0.018, { lp: 2400 }));
      if (MUS.step % 64 >= 32 && mel[i]) tone(d, 'triangle', hz(mel[i] + (bar === 3 ? -2 : 0)), 0, t, spb * 0.9, 0.05, { vib: 6, vibD: 6 });
      MUS.next += spb;
      MUS.step++;
    }
  }
  function music(on) {
    if (on === MUS.on || !init()) return;
    MUS.on = on;
    if (on) {
      MUS.g = ac.createGain();
      MUS.g.gain.setValueAtTime(0.0001, ac.currentTime);
      MUS.g.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.7, ac.currentTime + 0.4);
      MUS.g.connect(cat.mus.d);
      MUS.next = ac.currentTime + 0.05;
      MUS.step = 0;
      MUS.timer = setInterval(musicTick, 90);
      musicTick();
    } else {
      const g = MUS.g;
      clearInterval(MUS.timer);
      MUS.timer = null;
      MUS.g = null;
      if (g) {
        g.gain.setValueAtTime(g.gain.value, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.6);
        setTimeout(() => {
          try {
            g.disconnect();
          } catch (_) {}
        }, 900);
      }
    }
  }
  function setMuted(m) {
    muted = m;
    store.set('wvr-mute', m ? '1' : '0');
    if (out) out.gain.value = masterGain();
  }
  function preview(k) {
    if (!ac || ac.state !== 'running' || muted) return;
    const t = ac.currentTime + 0.02;
    if (k === 'amb') {
      const b = bus(1, 0, 0.35, 'amb');
      bird(b, t);
    }
  }
  /* ---------- continuous voices: a sandworm grinding through the dunes, the E-Mobil's motor. set() each frame, stop() when gone ---------- */
  function spatial(x, z, R) {
    const at = listenerPos(),
      d = Math.hypot(x - at.x, z - at.z),
      v = Math.pow(clamp(1 - d / R, 0, 1), 1.4),
      pan = soundPan(x, z);
    return { v, pan };
  }
  function loop(kind) {
    if (!init()) return null;
    const t0 = ac.currentTime,
      g = ac.createGain();
    g.gain.value = 0;
    let pan = null,
      head = g;
    if (ac.createStereoPanner) {
      pan = ac.createStereoPanner();
      g.connect(pan);
      head = pan;
    }
    head.connect(cat.fx.d);
    if (!AUDIO.lite) {
      const w = ac.createGain();
      w.gain.value = 0.3;
      head.connect(w);
      w.connect(cat.fx.w);
    }
    const nodes = [],
      lv = {},
      L0 = {}; // extra nodes a voice needs in set()
    const chan = (key, node) => {
      const cg = ac.createGain();
      cg.gain.value = 0;
      node.connect(cg);
      cg.connect(g);
      lv[key] = cg;
      return cg;
    };
    const noiseThrough = (type, f, q) => {
      const s = ac.createBufferSource();
      s.buffer = nbufLong;
      s.loop = true;
      const fl = ac.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      s.connect(fl);
      s.start(t0, Math.random() * 3);
      nodes.push(s);
      return fl;
    };
    let osc = null,
      osc2 = null,
      flt = null;
    if (kind === 'worm') {
      // deep grinding rumble, hissing sand, a sub that throbs
      chan('rumble', noiseThrough('lowpass', 110, 0.8));
      flt = noiseThrough('bandpass', 560, 1.2); // the sand: a darker, narrower band, chopped into grains by two slow wobbles – a grinding, not a hiss
      const gr = ac.createGain();
      gr.gain.value = 0.55;
      flt.connect(gr);
      chan('sand', gr);
      [
        [6.3, 0.3],
        [1.7, 0.15],
      ].forEach(([f, a]) => {
        const o = ac.createOscillator(),
          og = ac.createGain();
        o.frequency.value = f;
        og.gain.value = a;
        o.connect(og);
        og.connect(gr.gain);
        o.start(t0);
        nodes.push(o);
      });
      osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 38;
      const am = ac.createGain();
      am.gain.value = 0.7;
      const l = ac.createOscillator();
      l.frequency.value = 2.6;
      const lg = ac.createGain();
      lg.gain.value = 0.3;
      l.connect(lg);
      lg.connect(am.gain);
      osc.connect(am);
      chan('sub', am);
      osc.start(t0);
      l.start(t0);
      nodes.push(osc, l);
    } else if (kind === 'motor') {
      // the E-Mobil: a soft electric hum (two sines with a slight flutter), a quiet whirr an octave and a half up, low tyre rumble.
      // Channels: hum, whir, tyre; set({ speed }) raises the pitch with the speed.
      osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 90;
      osc2 = ac.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 180;
      const flutter = ac.createGain(),
        lfo = ac.createOscillator(),
        lfoG = ac.createGain();
      flutter.gain.value = 0.88;
      lfo.frequency.value = 13;
      lfoG.gain.value = 0.12;
      lfo.connect(lfoG);
      lfoG.connect(flutter.gain);
      osc.connect(flutter);
      osc2.connect(flutter);
      chan('hum', flutter);
      const whir = ac.createOscillator();
      whir.type = 'triangle';
      whir.frequency.value = 270;
      flt = ac.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 600;
      whir.connect(flt);
      chan('whir', flt);
      chan('tyre', noiseThrough('lowpass', 320, 0.7));
      osc.start(t0);
      osc2.start(t0);
      lfo.start(t0);
      whir.start(t0);
      nodes.push(osc, osc2, lfo, whir);
      L0.whir = whir;
    }
    let alive = true;
    const L = {
      set(x, z, p, R = 70) {
        if (!alive) return;
        const t = ac.currentTime,
          s = x === undefined ? { v: 1, pan: 0 } : spatial(x, z, R);
        g.gain.setTargetAtTime(muted ? 0 : s.v, t, 0.1);
        if (pan) pan.pan.setTargetAtTime(s.pan, t, 0.1);
        for (const k in p) if (lv[k]) lv[k].gain.setTargetAtTime(p[k], t, k === 'sub' || k === 'rumble' ? 0.25 : 0.1);
        if (kind === 'motor' && p.speed !== undefined) {
          const f = 90 + 110 * p.speed;
          osc.frequency.setTargetAtTime(f, t, 0.2);
          osc2.frequency.setTargetAtTime(f * 2, t, 0.2);
          L0.whir.frequency.setTargetAtTime(f * 3, t, 0.2);
          flt.frequency.setTargetAtTime(500 + 500 * p.speed, t, 0.25);
        }
        if (kind === 'worm' && p.pitch) flt.frequency.setTargetAtTime(380 + 520 * p.pitch, t, 0.3);
      },
      stop() {
        if (!alive) return;
        alive = false;
        LOOPS.delete(L);
        const t = ac.currentTime;
        g.gain.setTargetAtTime(0, t, 0.15);
        setTimeout(() => {
          nodes.forEach(n => {
            try {
              n.stop();
            } catch (_) {}
          });
          try {
            head.disconnect();
          } catch (_) {}
        }, 900);
      },
    };
    L.kind = kind;
    LOOPS.add(L);
    return L;
  }
  const LOOPS = new Set();
  function stopLoops() {
    if (LOOPS.size) [...LOOPS].forEach(l => l.stop());
  }
  /* ---------- ambience per map, no constant hiss: birds over the meadows, a buzzard above the desert, creaking ice in the arctic, gulls by the cliffs ---------- */
  const AMB = { type: null, g: null, nodes: [], timer: null, w: null, low: null };
  function ambStop() {
    if (!AMB.g) return;
    const g = AMB.g,
      nodes = AMB.nodes;
    clearInterval(AMB.timer);
    AMB.timer = null;
    AMB.g = null;
    AMB.nodes = [];
    AMB.type = null;
    AMB.w = AMB.low = null;
    try {
      g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.5);
    } catch (_) {}
    setTimeout(() => {
      nodes.forEach(n => {
        try {
          if (n.stop) n.stop();
        } catch (_) {}
        try {
          n.disconnect();
        } catch (_) {}
      });
      try {
        g.disconnect();
      } catch (_) {}
    }, 2500);
  }
  function amb(type) {
    if (type === AMB.type) return;
    if (!type) {
      ambStop();
      return;
    }
    if (!ac || ac.state !== 'running') return;
    ambStop();
    const t = ac.currentTime,
      g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(1, t, 1.5);
    g.connect(cat.amb.d);
    if (!AUDIO.lite) {
      const w = ac.createGain();
      w.gain.value = 0.35;
      g.connect(w);
      w.connect(cat.amb.w);
    }
    AMB.type = type;
    AMB.g = g;
    AMB.timer = setInterval(ambTick, 250);
  }
  function ambTick() {
    if (!AMB.g || !ac) return;
    const t = ac.currentTime;
    if (muted) {
      AMB.g.gain.setTargetAtTime(0.0001, t, 0.3);
      return;
    }
    AMB.g.gain.setTargetAtTime(1, t, 0.8);
    const d = AMB.g;
    if (AMB.type === 'wiesen' && Math.random() < 0.07) bird(d, t + Math.random() * 0.2);
    if (AMB.type === 'wueste' && Math.random() < 0.006) hawk(d, t);
    if (AMB.type === 'arktis' && Math.random() < 0.01) S(d, 'glassH', t, { vol: 0.05, rate: R(0.4, 0.55), lp: 1600 });
    if (AMB.type === 'klippen' && Math.random() < 0.012) gull(d, t);
  }
  /* test hook: render one sound into an offline context and measure it (no speakers needed) */
  async function renderTest(name, o = {}, secs = 2.5) {
    const f = LIB[name];
    if (!f) return null;
    const off = new OfflineAudioContext(1, Math.ceil(44100 * secs), 44100),
      save = [ac, comp, rev, nbuf, nbufLong, glot, cat];
    ac = off;
    comp = off.createGain();
    comp.connect(off.destination);
    rev = off.createGain();
    rev.gain.value = 0;
    rev.connect(off.destination);
    nbuf = makeNoise(off, 1);
    nbufLong = makeNoise(off, 4, true);
    glot = makeGlot(off);
    cat = { fx: { d: comp, w: rev }, amb: { d: comp, w: rev }, mus: { d: comp, w: rev } };
    let err = null;
    try {
      f(bus(o.vol || 1, 0, 0), 0.02, o);
    } catch (e) {
      err = e;
    }
    [ac, comp, rev, nbuf, nbufLong, glot, cat] = save;
    if (err) throw err;
    const buf = await off.startRendering(),
      d = buf.getChannelData(0);
    let pk = 0,
      ss = 0,
      last = 0,
      first = -1;
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > pk) pk = v;
      ss += d[i] * d[i];
      if (v > 0.002) {
        last = i;
        if (first < 0) first = i;
      }
    }
    return {
      peak: pk,
      rms: Math.sqrt(ss / Math.max(1, last - Math.max(0, first))),
      dur: (last - Math.max(0, first)) / 44100,
      onset: first / 44100,
      data: o.data ? Array.from(d.subarray(0, last + 1)) : undefined,
    };
  }
  return {
    play,
    unlock,
    setMuted,
    setVol,
    get vol() {
      return { ...VOL };
    },
    preview,
    music,
    loop,
    amb,
    stopLoops,
    renderTest,
    samplesReady: () => SMP.ok,
    get sampleShift() {
      return SMP.shift;
    },
    get ambType() {
      return AMB.type;
    },
    loops: () => [...LOOPS].map(l => l.kind),
    _smp: v => {
      SMP.ok = !!v && !!SMP.buf;
    },
    get muted() {
      return muted;
    },
    state: () => (ac ? ac.state : 'none'),
    names: () => Object.keys(LIB),
  };
})();
function listenerPos() {
  return V.poss ? { x: V.poss.x, z: V.poss.z } : { x: camS.x, z: camS.z };
}
