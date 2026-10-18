/* 21-scene.js - THREE.JS SCENE: renderer, camera, lights, shared materials (lam(color) is cached: never dispose it), the fog shader injection (fogInject,
   FOGW: every material reads the fog visibility map), ink outlines (inkify), mesh() helper, wind material. */
const canvas = $('#c');
let renderer;
// Kantenglättung (MSAA) can only be chosen when the WebGL context is created: off for 'Niedrig' and below (saved choice
// or the level AUTO learned last time); on a first start a throw-away context reveals software or very old GPUs.
const QSTART = (() => {
  try {
    const st = JSON.parse(localStorage.getItem('wvr-set') || 'null') || {},
      m = st.gfx || 'auto',
      l = m === 'auto' ? parseInt(localStorage.getItem('wvr-qauto') ?? '-1', 10) : ({ high: 0, mid: 2, low: 4, vlow: 6 }[m] ?? -1);
    if (l >= 0) return l;
  } catch (_) {}
  try {
    const gl = document.createElement('canvas').getContext('webgl'),
      ext = gl && gl.getExtension('WEBGL_debug_renderer_info'),
      gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '',
      lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 6;
    if (/hd graphics [2-5]\d{2,3}\b|gma|mali-4|adreno \(tm\) [34]\d\d/i.test(gpu)) return 4;
  } catch (_) {}
  return -1;
})();
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: QSTART < 4, powerPreference: 'high-performance' });
} catch (e) {
  document.body.innerHTML =
    '<p style="padding:24px;font:16px system-ui;color:#fff;background:#0d1526">Dieses Gerät kann die 3D-Grafik nicht anzeigen (WebGL fehlt).</p>';
  return;
}
const COARSE = matchMedia('(pointer:coarse)').matches;
if (COARSE) document.body.classList.add('touchUi');
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, COARSE ? 1.6 : 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft edges; tier changes only resize the map, never recompile shaders
const scene = new THREE.Scene();
scene.autoUpdate = false; // frame() updates matrices once, right before the unit batching reads them
const SKY = (() => {
  const c = cnv(4, 256),
    x = c.getContext('2d'),
    g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6fa9d8');
  g.addColorStop(0.55, '#b7d9ee');
  g.addColorStop(1, '#e8f1f2');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
})();
scene.background = SKY;
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
scene.fog = new THREE.Fog(lin(0xd7e8ef), 140, 340);
const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 600);
scene.add(new THREE.HemisphereLight(lin(0xbfd8ff), lin(0x6e7a62), 0.72));
const sun = new THREE.DirectionalLight(lin(0xffe2b8), 1.3);
sun.castShadow = true;
sun.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 160 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.16;
sun.shadow.radius = 3; // high normal bias: no shadow acne on the flat-shaded faces
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(32, 60, 22);
const clouds = (() => {
  const c = cnv(128, 64),
    x = c.getContext('2d');
  for (const [cx, cy, r] of [
    [40, 38, 22],
    [64, 30, 28],
    [90, 38, 22],
    [64, 42, 22],
  ]) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, TAU);
    x.fill();
  }
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0.85,
  });
  const list = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(mat);
    const s2 = 26 + Math.random() * 30;
    sp.scale.set(s2, s2 / 2, 1);
    sp.position.set((Math.random() - 0.5) * 320, 150 + Math.random() * 30, (Math.random() - 0.5) * 420);
    sp.scale.multiplyScalar(1.6);
    scene.add(sp);
    list.push(sp);
  }
  return list;
})();
const matCache = {};
/* ART STYLE: "Kinderbuch-Diorama". Flat, saturated colours, cel shading with a soft 4-step ramp, warm sun + cool sky fill,
   dark ink outlines on figures, hand-drawn-style textures. Every lit surface uses the same toon ramp so units,
   terrain and props read as one world. */
const TOON_RAMP = (() => {
  // four tones with soft steps between them (the old 8-pixel ramp had unlit gaps that drew dark stripes across round shapes)
  const N = 64,
    c = cnv(N, 1),
    x = c.getContext('2d'),
    img = x.createImageData(N, 1),
    bands = [
      [0, 0.5],
      [0.45, 0.7],
      [0.6, 0.88],
      [0.74, 1],
    ];
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    let v = bands[0][1];
    for (let j = 1; j < bands.length; j++) v = lerp(v, bands[j][1], sstep(bands[j][0] - 0.03, bands[j][0] + 0.03, t));
    const b = Math.round(v * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
})();
const TOON = true;
THREE.MeshLambertMaterial = (Lam =>
  function (o = {}) {
    if (!TOON || o.noToon) return new Lam(o);
    const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: TOON_RAMP }, o));
    m.isLitFlat = true;
    return m;
  })(THREE.MeshLambertMaterial); // every Lambert in the file becomes cel-shaded
const lam = c => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: lin(c) }));
/* ---------- fog wall (map event "Nebelwand"). Every fogged material also reads one shared visibility map (white = clear around the own
   warriors and the own base). In the commander view everything outside those clearings drowns in a thick, slowly drifting fog up to ~18 m:
   enemies fade into it and out of it instead of popping in and out of existence. In the ego view a dense fog closes in around the camera. ---------- */
const FOGW = {
  map: { value: null },
  box: { value: new THREE.Vector4(-46, -86, 92, 172) },
  k: { value: 0 },
  t: { value: 0 },
  h: { value: 10 },
  cam: { value: camera.position },
  vinv: { value: camera.matrixWorld },
  hMap: null,
  col: new THREE.Color(0xd5dce0),
  cv: null,
  tex: null,
  upd: 0,
  ego: 0,
  active: false,
  base: null,
  hint: { value: new THREE.DataTexture(new Uint8Array([213, 220, 224, 255]), 1, 1) }, // faded small map printed into the fog top (fogHintBuild)
  hk: { value: 0 }, // how strongly that map shows (commander view only)
  hintMap: null,
};
const FOG_PARS_F = `#include <fog_pars_fragment>
#ifdef USE_FOG
varying vec3 fogWorld;
uniform sampler2D fogWallMap; uniform vec4 fogWallBox; uniform float fogWallK; uniform float fogWallT; uniform float fogWallH; uniform vec3 fogCam;
uniform sampler2D fogHintMap; uniform float fogHintK;
float fogHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fogNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fogHash(i), fogHash(i + vec2(1.0, 0.0)), f.x), mix(fogHash(i + vec2(0.0, 1.0)), fogHash(i + vec2(1.0, 1.0)), f.x), f.y); }
#endif`;
const FOG_F = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	vec3 fogTint = fogColor;
	if ( fogWallK > 0.001 ) {
		// the drifting pattern lives on the top of the fog bank, where the view ray enters it: everything along one ray gets the same
		// shade, so nothing hidden in the fog shows up as a lighter or darker silhouette
		vec3 fr = fogWorld - fogCam;
		float tp = fr.y < -0.001 ? clamp( ( fogCam.y - fogWallH ) / -fr.y, 0.0, 1.0 ) : 1.0;
		vec2 sp = fogCam.xz + fr.xz * tp;
		float fn = fogNoise( sp * 0.07 + vec2( fogWallT * 0.04, fogWallT * 0.025 ) ) * 0.6 + fogNoise( sp * 0.19 - vec2( fogWallT * 0.055, fogWallT * 0.018 ) ) * 0.4;
		float vis = texture2D( fogWallMap, ( fogWorld.xz - fogWallBox.xy ) / fogWallBox.zw ).r;
		float dens = smoothstep( 0.05, 0.72, 1.0 - vis + ( fn - 0.5 ) * 0.45 ) * ( 1.0 - smoothstep( fogWallH + 6.0, fogWallH + 14.0, fogWorld.y ) );
		fogTint = fogColor * ( 0.93 + 0.12 * fn );
		// orientation: a faded copy of the map (water, woods, roads) shows in the fog top – sampled where the ray enters it, so it is the
		// same along the whole ray and reveals nothing that stands in the fog
		fogTint = mix( fogTint, texture2D( fogHintMap, ( sp - fogWallBox.xy ) / fogWallBox.zw ).rgb, fogHintK * dens );
		fogFactor = max( fogFactor, fogWallK * dens );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
#endif`;
function fogInject(sh) {
  if (!sh.fragmentShader.includes('#include <fog_fragment>') || !sh.vertexShader.includes('#include <fog_vertex>')) return;
  sh.uniforms.fogWallMap = FOGW.map;
  sh.uniforms.fogWallBox = FOGW.box;
  sh.uniforms.fogWallK = FOGW.k;
  sh.uniforms.fogWallT = FOGW.t;
  sh.uniforms.fogWallH = FOGW.h;
  sh.uniforms.fogCam = FOGW.cam;
  sh.uniforms.fogViewInv = FOGW.vinv;
  sh.uniforms.fogHintMap = FOGW.hint;
  sh.uniforms.fogHintK = FOGW.hk;
  sh.vertexShader = sh.vertexShader
    .replace(
      '#include <fog_pars_vertex>',
      '#include <fog_pars_vertex>\n#ifdef USE_FOG\nvarying vec3 fogWorld;\nuniform mat4 fogViewInv;\n#endif'
    )
    .replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\n#ifdef USE_FOG\nfogWorld = ( fogViewInv * vec4( mvPosition.xyz, 1.0 ) ).xyz;\n#endif'
    );
  sh.fragmentShader = sh.fragmentShader.replace('#include <fog_pars_fragment>', FOG_PARS_F).replace('#include <fog_fragment>', FOG_F);
}
THREE.Material.prototype.onBeforeCompile = function (sh) {
  fogInject(sh);
}; // materials with their own hook call fogInject themselves
// Ink outline: the same instances drawn once more, back faces only, pushed out along the normals (shares the matrix buffer)
const INK = new THREE.MeshBasicMaterial({ color: lin(0x1c1526), side: THREE.BackSide });
INK.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vInkD;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.028;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvInkD = -mvPosition.z;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vInkD;')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vInkD < 2.4) discard;');
  fogInject(sh);
};
INK.customProgramCacheKey = () => 'ink'; // no outline right at the lens: a camera inside a tree or a wall must not see the inside of its dark outline
const INK_TEAM = INK.clone();
INK_TEAM.color.set(0xffffff);
INK_TEAM.onBeforeCompile = INK.onBeforeCompile;
INK_TEAM.customProgramCacheKey = () => 'ink'; // white base: the per-instance colour decides (black = own, red = enemy)
INK.userData.shared = INK_TEAM.userData.shared = true; // never freed by disposeTree
const INK_OWN = new THREE.Color(lin(0x1c1526)),
  INK_FOE = new THREE.Color(lin(0xc0242c));
function inkify(root) {
  const add = [];
  root.traverse(o => {
    if (o.isMesh && !o.isInstancedMesh && !o.userData.isInk && o.material && !o.material.transparent) add.push(o);
  });
  for (const o of add) {
    const c = new THREE.Mesh(o.geometry, INK);
    c.userData.isInk = true;
    c.renderOrder = -1;
    o.add(c);
  }
  return root;
} // outlines for the few non-instanced figures (catapults, bears, bases)
const basic = (c, o = 1) => new THREE.MeshBasicMaterial({ color: lin(c), transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const ctex = c => {
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
};
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
function flat(geo) {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}
function shadows(o, cast = true, recv = false) {
  o.traverse(m => {
    if (m.isMesh) {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      m.castShadow =
        cast && m.geometry.boundingSphere.radius * Math.max(Math.abs(m.scale.x), Math.abs(m.scale.y), Math.abs(m.scale.z)) > 0.22;
      m.receiveShadow = recv;
    }
  });
  return o;
}
const water = mesh(
  new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2),
  new THREE.MeshPhongMaterial({ color: lin(0x3b8fb8), specular: lin(0x88bbd6), shininess: 70, transparent: true, opacity: 0.88 }),
  0,
  WL,
  0
);
const WATER_HI = water.material,
  WATER_LO = new THREE.MeshLambertMaterial({ color: lin(0x3f93bb), transparent: true, opacity: 0.88 }); // cheap water for light tiers
const AUDIO = { lite: false };
water.receiveShadow = true;
scene.add(water);
// World-space ripples vary brightness without extra geometry, reflection passes or lights.
const waterClock = { value: 0 };
water.material.onBeforeCompile = sh => {
  sh.uniforms.waterTime = waterClock;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterXZ = position.xz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float waterTime;\nvarying vec2 vWaterXZ;')
    .replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat waveA = sin(vWaterXZ.x * 0.32 + vWaterXZ.y * 0.19 + waterTime * 1.3);\nfloat waveB = sin(vWaterXZ.x * -0.14 + vWaterXZ.y * 0.43 - waterTime * 0.9);\ndiffuseColor.rgb *= 1.0 + waveA * waveB * 0.045;'
    );
  fogInject(sh);
};
// One shared shader clock drives instanced foliage; no per-tree matrices are updated.
const windClock = { value: 0 },
  windStrength = { value: 1 };
function windMaterial(mat, amount) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.windTime = windClock;
    sh.uniforms.windStrength = windStrength;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;\nuniform float windStrength;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat windPhase = instanceMatrix[3].x * 0.12 + instanceMatrix[3].z * 0.08;\ntransformed.x += sin(windTime * 1.8 + windPhase) * max(0.0, position.y) * ${amount.toFixed(3)} * windStrength;\n#endif`
      );
    fogInject(sh);
  };
  mat.customProgramCacheKey = () => 'foliage-wind-' + amount;
  return mat;
}
