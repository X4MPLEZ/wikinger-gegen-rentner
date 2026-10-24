/* 31-faces.js - Player photo: face detection (face-api, loaded on demand), the face editor, and putting faces onto the units' heads (setFaceMat). */
const FACE = { mine: null, other: null, mats: [null, null], badge: [null, null] };
function faceTexFromCrop(crop) {
  const W = 1024,
    H = 512,
    c = cnv(W, H),
    x = c.getContext('2d'),
    S = crop.width,
    cx2 = crop.getContext('2d');
  const avg = (sx, sy, w, h) => {
    const d = cx2.getImageData(sx | 0, sy | 0, Math.max(1, w | 0), Math.max(1, h | 0)).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
    return n ? [r / n, g / n, b / n] : [138, 106, 80];
  };
  const hair = avg(S * 0.3, S * 0.03, S * 0.4, S * 0.1),
    skin = avg(S * 0.32, S * 0.5, S * 0.36, S * 0.18),
    css = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  x.fillStyle = css(hair);
  x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, css(hair));
  g.addColorStop(1, css(skin));
  x.fillStyle = g;
  x.fillRect(0, H * 0.55, W, H * 0.45);
  const src = cx2.getImageData(0, 0, S, S).data,
    img = x.getImageData(0, 0, W, H),
    d = img.data;
  const R0 = 0.8,
    yOff = 0.06,
    boost = v => clamp((v - 128) * 1.12 + 134, 0, 255);
  for (let py = 0; py < H; py++) {
    const th = ((py + 0.5) / H) * Math.PI,
      st = Math.sin(th),
      dy = Math.cos(th);
    for (let px = 0; px < W / 2; px++) {
      const ph = ((px + 0.5) / W) * TAU,
        dx = -Math.cos(ph) * st,
        dz = Math.sin(ph) * st;
      if (dz < 0.08) continue;
      const ix = 0.5 + dx / (2 * R0),
        iy = 0.5 - (dy - yOff) / (2 * R0),
        rr = Math.hypot(ix - 0.5, iy - 0.5);
      if (rr > 0.5) continue;
      const a = clamp((0.5 - rr) / 0.06, 0, 1) * clamp((dz - 0.08) / 0.18, 0, 1);
      const si = (clamp((iy * S) | 0, 0, S - 1) * S + clamp((ix * S) | 0, 0, S - 1)) * 4;
      if (src[si + 3] < 128) continue;
      const o = (py * W + px) * 4;
      for (let ch = 0; ch < 3; ch++) d[o + ch] = d[o + ch] * (1 - a) + boost(src[si + ch]) * a;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
function setFaceMat(team, crop) {
  if (FACE.mats[team]) FACE.mats[team].map.dispose();
  if (FACE.badge[team]) {
    FACE.badge[team].map.dispose();
    FACE.badge[team] = null;
  }
  if (!crop) {
    FACE.mats[team] = null;
    return;
  }
  const t = ctex(faceTexFromCrop(crop));
  FACE.mats[team] = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55 });
  {
    const S = 256,
      c = cnv(S, S),
      x = c.getContext('2d'),
      col = V.facs && V.facs[team] ? FAC[V.facs[team]].css : '#f0bf4c';
    x.save();
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 14, 0, TAU);
    x.clip();
    x.drawImage(crop, 0, 0, S, S);
    x.restore();
    x.lineWidth = 14;
    x.strokeStyle = col;
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 9, 0, TAU);
    x.stroke();
    x.lineWidth = 3;
    x.strokeStyle = 'rgba(0,0,0,.55)';
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 2, 0, TAU);
    x.stroke();
    FACE.badge[team] = new THREE.SpriteMaterial({ map: ctex(c), depthTest: false, transparent: true });
  }
}
// online without a photo: the opponent's profile picture becomes the face on his big ego head (the inner disc of the badge, without
// its rim), so you still see who you fight; null while the picture is not decoded yet
function avatarFaceCrop(id) {
  const [a, ok] = avatarCanvas(id);
  if (!ok) return null;
  const S = 256,
    c = cnv(S, S),
    x = c.getContext('2d'),
    m = a.width * 0.12; // the rim of the badge stays outside
  x.drawImage(a, m, m, a.width - 2 * m, a.height - 2 * m, 0, 0, S, S);
  return c;
}
// online without a photo: the opponent's profile picture is the badge over his steered warrior (in the team colour ring)
const AV_BADGE = { key: '', mat: null };
function oppBadge(team) {
  if (team === V.myTeam || (V.mode !== 'host' && V.mode !== 'guest') || !V.oppPf) return null;
  const key = V.oppPf.av + '|' + team;
  if (AV_BADGE.key !== key) {
    const [a, ok] = avatarCanvas(V.oppPf.av);
    if (!ok) return null;
    const S = 256,
      c = cnv(S, S),
      x = c.getContext('2d');
    x.drawImage(a, 10, 10, S - 20, S - 20);
    x.lineWidth = 14;
    x.strokeStyle = V.facs && V.facs[team] ? FAC[V.facs[team]].css : '#f0bf4c';
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 9, 0, TAU);
    x.stroke();
    if (AV_BADGE.mat) AV_BADGE.mat.map.dispose();
    AV_BADGE.mat = new THREE.SpriteMaterial({ map: ctex(c), depthTest: false, transparent: true });
    AV_BADGE.key = key;
  }
  return AV_BADGE.mat;
}
function imgToCanvas(img, size) {
  const c = cnv(size, size);
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  return c;
}
function loadDataUrl(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}
async function setMyFace(dataUrl, persist) {
  const img = await loadDataUrl(dataUrl);
  const crop = imgToCanvas(img, 256);
  const small = imgToCanvas(img, 120);
  let net = small.toDataURL('image/jpeg', 0.8);
  for (let q = 0.7; net.length > 13500 && q > 0.3; q -= 0.1) net = small.toDataURL('image/jpeg', q);
  FACE.mine = { url: dataUrl, crop, net, id: ((Math.random() * 1e9) | 0).toString(36) };
  $('#mePh').style.backgroundImage = `url(${dataUrl})`;
  $('#mePh').textContent = '';
  if (persist) store.set('wvr-face', dataUrl);
}
async function setOtherFace(dataUrl) {
  try {
    const img = await loadDataUrl(dataUrl);
    FACE.other = { crop: imgToCanvas(img, 256), url: dataUrl };
    setFaceMat(1 - V.myTeam, FACE.other.crop);
  } catch (_) {}
}
// face editor
const FE = { img: null, cx: 0, cy: 0, r: 100, drag: null, pts: new Map() };
const faceCv = $('#faceCv'),
  faceCtx = faceCv.getContext('2d');
let faceApiP = null;
function loadFaceApi() {
  if (faceApiP) return faceApiP;
  faceApiP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = WVR_LIB('faceapi') || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js';
    const to = setTimeout(() => rej(new Error('timeout')), 20000);
    s.onload = async () => {
      try {
        const tf = window.faceapi.tf;
        let ok = false;
        try {
          ok = await tf.setBackend('webgl');
        } catch (_) {
          ok = false;
        }
        if (!ok) await tf.setBackend('cpu');
        await tf.ready();
        const pack = await (await fetch('models/tiny-face.json')).json();
        const bin = Uint8Array.from(atob(pack.data), ch => ch.charCodeAt(0)).buffer;
        const wm = tf.io.decodeWeights(bin, pack.manifest[0].weights);
        await window.faceapi.nets.tinyFaceDetector.loadFromWeightMap(wm);
        clearTimeout(to);
        res(window.faceapi);
      } catch (e) {
        clearTimeout(to);
        rej(e);
      }
    };
    s.onerror = e => {
      clearTimeout(to);
      rej(e);
    };
    document.head.appendChild(s);
  });
  faceApiP.catch(() => {
    faceApiP = null;
  });
  return faceApiP;
}
function drawFaceEditor() {
  const W = faceCv.width,
    R = W * 0.38,
    k = R / FE.r;
  faceCtx.fillStyle = '#0a1222';
  faceCtx.fillRect(0, 0, W, W);
  if (FE.img) faceCtx.drawImage(FE.img, W / 2 - FE.cx * k, W / 2 - FE.cy * k, FE.img.width * k, FE.img.height * k);
  faceCtx.save();
  faceCtx.fillStyle = 'rgba(10,18,34,.62)';
  faceCtx.beginPath();
  faceCtx.rect(0, 0, W, W);
  faceCtx.arc(W / 2, W / 2, R, 0, TAU, true);
  faceCtx.fill('evenodd');
  faceCtx.strokeStyle = '#f0bf4c';
  faceCtx.lineWidth = 4;
  faceCtx.beginPath();
  faceCtx.arc(W / 2, W / 2, R, 0, TAU);
  faceCtx.stroke();
  faceCtx.restore();
  $('#faceZoom').value = String(clamp(FE.r / Math.max(FE.img ? Math.max(FE.img.width, FE.img.height) : 1, 1), 0.15, 1.2));
}
async function openFaceEditor(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await loadDataUrl(url);
  } catch (_) {
    toastMenu(TR('Das Bild konnte nicht geladen werden.'));
    return;
  }
  const sc = Math.min(1, 900 / Math.max(img.width, img.height)),
    c = cnv(Math.round(img.width * sc), Math.round(img.height * sc));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  FE.img = c;
  FE.cx = c.width / 2;
  FE.cy = c.height * 0.42;
  FE.r = Math.min(c.width, c.height) * 0.32;
  showScreen('faceScr');
  drawFaceEditor();
  $('#faceMsg').textContent = COARSE
    ? TR('Bild mit dem Finger verschieben, mit zwei Fingern oder ＋/－ vergrößern.')
    : TR('Bild mit der Maus ziehen, mit Mausrad oder ＋/－ vergrößern.');
}
faceCv.addEventListener('pointerdown', e => {
  faceCv.setPointerCapture(e.pointerId);
  FE.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  FE.drag = { cx: FE.cx, cy: FE.cy, r: FE.r, pts: new Map([...FE.pts].map(([k, v]) => [k, { ...v }])) };
});
faceCv.addEventListener('pointermove', e => {
  if (!FE.pts.has(e.pointerId) || !FE.drag || !FE.img) return;
  FE.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const rect = faceCv.getBoundingClientRect(),
    k = (((faceCv.width * 0.38) / FE.drag.r) * rect.width) / faceCv.width;
  const cur = [...FE.pts.values()],
    st = [...FE.drag.pts.values()];
  if (cur.length >= 2 && st.length >= 2) {
    const d0 = Math.hypot(st[0].x - st[1].x, st[0].y - st[1].y),
      d1 = Math.hypot(cur[0].x - cur[1].x, cur[0].y - cur[1].y);
    FE.r = clamp((FE.drag.r * d0) / Math.max(d1, 10), 20, 2000);
  } else {
    const s = st.find((_, i) => true);
    FE.cx = FE.drag.cx - (e.clientX - s.x) / k;
    FE.cy = FE.drag.cy - (e.clientY - s.y) / k;
  }
  drawFaceEditor();
});
const feUp = e => {
  FE.pts.delete(e.pointerId);
  FE.drag = FE.pts.size ? { cx: FE.cx, cy: FE.cy, r: FE.r, pts: new Map([...FE.pts].map(([k, v]) => [k, { ...v }])) } : null;
};
faceCv.addEventListener('pointerup', feUp);
faceCv.addEventListener('pointercancel', feUp);
faceCv.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    FE.r = clamp(FE.r * Math.exp(e.deltaY * 0.001), 20, 2000);
    drawFaceEditor();
  },
  { passive: false }
);
$('#faceZoom').addEventListener('input', e => {
  if (!FE.img) return;
  FE.r = +e.target.value * Math.max(FE.img.width, FE.img.height);
  drawFaceEditor();
});
$('#faceCancel').addEventListener('click', () => showScreen('menu'));
$('#faceIn').addEventListener('click', e => {
  e.preventDefault();
  if (!FE.img) return;
  FE.r = clamp(FE.r / 1.15, 20, 2000);
  drawFaceEditor();
});
$('#faceOutB').addEventListener('click', e => {
  e.preventDefault();
  if (!FE.img) return;
  FE.r = clamp(FE.r * 1.15, 20, 2000);
  drawFaceEditor();
});
$('#faceOk').addEventListener('click', async () => {
  if (!FE.img) return;
  const c = cnv(256, 256),
    x = c.getContext('2d');
  x.beginPath();
  x.arc(128, 128, 128, 0, TAU);
  x.clip();
  x.drawImage(FE.img, FE.cx - FE.r, FE.cy - FE.r, FE.r * 2, FE.r * 2, 0, 0, 256, 256);
  await setMyFace(c.toDataURL('image/jpeg', 0.85), true);
  showScreen('menu');
});
$('#btnCam').addEventListener('click', () => $('#inCam').click());
$('#btnGal').addEventListener('click', () => $('#inGal').click());
['#inCam', '#inGal'].forEach(id =>
  $(id).addEventListener('change', e => {
    openFaceEditor(e.target.files && e.target.files[0]);
    e.target.value = '';
  })
);
