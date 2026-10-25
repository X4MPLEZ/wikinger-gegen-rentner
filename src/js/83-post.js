/* 83-post.js - POST EFFECTS for the graphics tier "Sehr hoch" (WebGL2 only): the scene is drawn into a multisampled render target with a
   depth texture, then one full-screen pass adds soft ambient occlusion (darker creases and contact areas, from the depth buffer), a gentle
   depth of field (sharp where the camera looks – in the ego view always the own warrior –, the far background slightly soft), a glow on
   bright parts, colour grading and a vignette. The depth of field is cheap and steady: one quarter-resolution copy of the picture, box
   filtered (each pixel the mean of a 4x4 block, sharp foreground weighted out), is blended in by distance. No per-pixel sample pattern,
   so grass and leaves in the distance do not shimmer while the camera moves; it can be switched off (SET.gfxDof = 'off').
   Sprites without depth test (floating words, speech bubbles, badges) are drawn afterwards on top, sharp. The render target follows
   the frame time: below ~60 fps it shrinks (down to 55 %), with headroom it grows back, so the tier holds 60 fps and more.
   postRender() replaces renderer.render() in frame() while POST.on. Nothing here touches the game state. */
const POST = {
  on: false,
  ok: null,
  rt: null,
  mat: null,
  sc: null,
  cam: null,
  w: 0,
  h: 0,
  focus: 20,
  scale: 1,
  ft: 8,
  slowT: 0,
  fastT: 0,
  holdT: 0,
  last: 0,
};
const POST_VS = `varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// pass 1 (half resolution): ambient occlusion from the depth buffer, normals from the depth slope; noisy on purpose, the final pass blurs it
const POST_AO = `precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth; uniform vec2 res; uniform vec2 full; uniform mat4 projInv; uniform float aoR;
vec3 viewPos(vec2 uv, float d) { vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
// always work on the exact centre of a full-resolution depth texel: a position rebuilt from a depth that belongs to a neighbouring
// texel lies a little off the surface and draws stripes across flat ground
vec2 snapUv(vec2 uv) { return (floor(uv * full) + 0.5) / full; }
void main() {
  vec2 uv = snapUv(vUv);
  float d = texture2D(tDepth, uv).r;
  if (d > 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(uv, d);
  vec3 N = normalize(cross(dFdx(P), dFdy(P)));
  vec2 ip = mod(floor(gl_FragCoord.xy), 4.0);
  float rot = (ip.x * 4.0 + ip.y) * 0.3927 + mod(ip.x + ip.y, 2.0) * 0.2;
  float rr = aoR / max(0.5, -P.z) * res.y * 0.9;
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i) + 0.5;
    float a = fi * 2.39996 + rot, r = (0.15 + 0.85 * fi / 8.0) * rr;
    vec2 uv2 = snapUv(uv + vec2(cos(a), sin(a)) * r / res);
    vec3 S = viewPos(uv2, texture2D(tDepth, uv2).r) - P;
    float l = length(S);
    occ += max(0.0, dot(N, S / max(l, 1e-4)) - 0.18) * smoothstep(aoR * 2.0, aoR * 0.3, l);
  }
  occ *= smoothstep(75.0, 35.0, -P.z); // far away the samples land on single blades and leaves: no occlusion there, no shimmer
  gl_FragColor = vec4(vec3(clamp(1.0 - occ / 8.0 * 1.6, 0.0, 1.0)), 1.0);
}`;
// quarter-resolution copy for the depth of field: 4 bilinear taps = the mean of the 4x4 block under the pixel; sharp (near) pixels
// count less, so a warrior in front does not bleed into the soft background
const POST_DOWN = `precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 src; uniform float cNear; uniform float cFar; uniform vec3 dof;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * cNear * cFar / (cFar + cNear - z * (cFar - cNear)); }
vec4 tap(vec2 o) {
  vec2 uv = vUv + o / src;
  float d = texture2D(tDepth, uv).r;
  float c = d > 0.99999 ? 1.0 : smoothstep(dof.x, dof.y, linZ(d));
  float w = 0.04 + c;
  return vec4(texture2D(tColor, uv).rgb * w, w);
}
void main() {
  vec4 a = tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  gl_FragColor = vec4(a.rgb / a.a, 1.0);
}`;
// pass 3 (full resolution): blurred occlusion, depth of field, glow, grading, vignette
const POST_FS = `precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tAO; uniform sampler2D tBlur;
uniform vec2 res; uniform vec2 bres; uniform float cNear; uniform float cFar;
uniform vec3 dof; uniform vec2 fg; uniform float aoK; uniform float time;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * cNear * cFar / (cFar + cNear - z * (cFar - cNear)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// how soft a pixel gets: from dof.x to dof.y metres behind the camera it fades in up to dof.z (the sky too); in the commander view
// a little in front of the focus as well (fg: distance where it is full, strength)
float cocOf(float d, float z) {
  if (d > 0.99999) return dof.z;
  return dof.z * smoothstep(dof.x, dof.y, z) + fg.y * (1.0 - smoothstep(fg.x * 0.5, fg.x, z));
}
void main() {
  float d = texture2D(tDepth, vUv).r;
  float z = linZ(d);
  vec3 col = texture2D(tColor, vUv).rgb;
  // occlusion: 3x3 blur of the half-resolution pass, only across similar depths (no dark halos around figures)
  float ao = 0.0, aw = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)) * 2.0 / res;
    float w = 1.0 / (1.0 + abs(linZ(texture2D(tDepth, vUv + o).r) - z) * 4.0);
    ao += texture2D(tAO, vUv + o).r * w; aw += w;
  }
  ao = mix(1.0, ao / aw, aoK);
  if (dof.z > 0.0) {
    float coc = cocOf(d, z);
    if (coc > 0.004) {
      // a tent over the quarter-resolution copy: smooth, and the same from frame to frame
      vec2 bp = 0.5 / bres;
      vec3 b = (texture2D(tBlur, vUv + vec2(-bp.x, -bp.y)).rgb + texture2D(tBlur, vUv + vec2(bp.x, -bp.y)).rgb +
                texture2D(tBlur, vUv + vec2(-bp.x, bp.y)).rgb + texture2D(tBlur, vUv + vec2(bp.x, bp.y)).rgb) * 0.25;
      col = mix(col, b, coc);
      col += max(b - 0.8, 0.0) * 0.4 * coc;
    }
  }
  col *= ao;
  // grading: a little more colour and contrast, warm highlights, cool shadows, then a soft vignette
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.12);
  col = mix(col, col * vec3(1.03, 1.0, 0.95), smoothstep(0.45, 0.95, l));
  col = mix(col, col * vec3(0.95, 0.98, 1.05), 1.0 - smoothstep(0.05, 0.4, l));
  col = (col - 0.5) * 1.05 + 0.5;
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.4;
  col += (hash(gl_FragCoord.xy + time) - 0.5) / 255.0; // dither: no banding in the sky gradient
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
function postInit() {
  if (POST.ok !== null) return POST.ok;
  POST.ok = false;
  try {
    if (!renderer.capabilities.isWebGL2) return false;
    const dt = new THREE.DepthTexture();
    dt.type = THREE.UnsignedIntType;
    const rt = new THREE.WebGLMultisampleRenderTarget(4, 4, { depthTexture: dt, depthBuffer: true });
    rt.samples = Math.min(4, renderer.capabilities.maxSamples || 4);
    rt.texture.encoding = THREE.sRGBEncoding; // the scene is tone mapped and encoded into the target like on screen; the pass only adjusts it
    rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    POST.rt = rt;
    POST.ao = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    POST.ao.texture.generateMipmaps = false;
    POST.bl = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    POST.bl.texture.generateMipmaps = false;
    const shader = (fs, uniforms) =>
      new THREE.ShaderMaterial({
        vertexShader: POST_VS,
        fragmentShader: fs,
        uniforms,
        depthTest: false,
        depthWrite: false,
        extensions: { derivatives: true },
      });
    POST.aoMat = shader(POST_AO, {
      tDepth: { value: dt },
      res: { value: new THREE.Vector2(1, 1) },
      full: { value: new THREE.Vector2(1, 1) },
      projInv: { value: new THREE.Matrix4() },
      aoR: { value: 0.5 },
    });
    POST.dof = new THREE.Vector3(30, 120, 0.5);
    POST.blMat = shader(POST_DOWN, {
      tColor: { value: rt.texture },
      tDepth: { value: dt },
      src: { value: new THREE.Vector2(1, 1) },
      cNear: { value: camera.near },
      cFar: { value: camera.far },
      dof: { value: POST.dof },
    });
    POST.mat = shader(POST_FS, {
      tColor: { value: rt.texture },
      tDepth: { value: dt },
      tAO: { value: POST.ao.texture },
      tBlur: { value: POST.bl.texture },
      res: { value: new THREE.Vector2(1, 1) },
      bres: { value: new THREE.Vector2(1, 1) },
      cNear: { value: camera.near },
      cFar: { value: camera.far },
      dof: { value: POST.dof },
      fg: { value: new THREE.Vector2(10, 0) },
      aoK: { value: 1 },
      time: { value: 0 },
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    POST.quad = new THREE.Mesh(tri, POST.mat);
    POST.quad.frustumCulled = false;
    POST.sc = new THREE.Scene();
    POST.sc.add(POST.quad);
    POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    POST.ok = true;
  } catch (e) {
    POST.ok = false;
  }
  return POST.ok;
}
function postSet(on) {
  POST.on = !!on && postInit();
  if (!POST.on && POST.rt) {
    POST.rt.setSize(4, 4); // free the big buffers while the effects are off
    POST.ao.setSize(4, 4);
    POST.bl.setSize(4, 4);
    POST.w = POST.h = 0;
  }
  return POST.on;
}
// where the camera looks: the steered warrior in the ego view, else the point under the screen centre (smoothed like an autofocus)
const POST_RAY = new THREE.Raycaster(),
  POST_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1),
  POST_HIT = new THREE.Vector3(),
  POST_V2 = new THREE.Vector2(),
  POST_P = new THREE.Vector3();
function postFocus(dt) {
  let f = 0;
  const me = V.poss && V.units.get(V.poss.id);
  if (me && me.g) {
    me.g.getWorldPosition(POST_P);
    POST_P.y += 1.2; // the head and the shoulders
    f = camera.position.distanceTo(POST_P);
    POST.focus = f; // no autofocus lag on the own warrior: he must never be soft
  } else {
    POST_RAY.setFromCamera({ x: 0, y: 0 }, camera);
    const gy = groundY(camS.fix ? camS.fix.t[0] : camS.x, camS.fix ? camS.fix.t[2] : camS.z);
    POST_PLANE.constant = -gy - 0.6;
    f = POST_RAY.ray.intersectPlane(POST_PLANE, POST_HIT) ? camera.position.distanceTo(POST_HIT) : camS.dist;
  }
  f = clamp(f, 2, 200);
  POST.focus += (f - POST.focus) * (1 - Math.exp(-dt * 6));
  return POST.focus;
}
// the render target follows the frame time (see the header)
function postScale() {
  const t = performance.now(),
    ms = POST.last ? Math.min(100, t - POST.last) : 8;
  POST.last = t;
  POST.ft += (ms - POST.ft) * 0.06;
  const sec = ms / 1000;
  if (POST.ft > 15.8) POST.slowT += sec;
  else POST.slowT = Math.max(0, POST.slowT - sec);
  if (POST.ft < 10.5) POST.fastT += sec;
  else POST.fastT = 0;
  POST.holdT = Math.max(0, POST.holdT - sec);
  if (POST.slowT > 0.8 && POST.scale > 0.55) {
    POST.scale = Math.max(0.55, POST.scale - 0.1);
    POST.slowT = 0;
    POST.holdT = 12; // no see-saw between two sizes: after shrinking it waits a while before trying again
  } else if (POST.fastT > 4 && POST.holdT <= 0 && POST.scale < 1) {
    POST.scale = Math.min(1, POST.scale + 0.05);
    POST.fastT = 0;
  }
}
function postRender(dt) {
  postScale();
  const db = renderer.getDrawingBufferSize(POST_V2),
    sw = Math.max(64, Math.round(db.x * POST.scale)),
    sh = Math.max(64, Math.round(db.y * POST.scale)),
    rt = POST.rt,
    u = POST.mat.uniforms;
  if (sw !== POST.w || sh !== POST.h) {
    POST.w = sw;
    POST.h = sh;
    rt.setSize(sw, sh);
    POST.ao.setSize(Math.ceil(sw / 2), Math.ceil(sh / 2));
    POST.bl.setSize(Math.ceil(sw / 4), Math.ceil(sh / 4));
  }
  const ua = POST.aoMat.uniforms;
  ua.res.value.set(Math.ceil(sw / 2), Math.ceil(sh / 2));
  ua.full.value.set(sw, sh);
  ua.projInv.value.copy(camera.projectionMatrixInverse);
  u.res.value.set(sw, sh);
  u.cNear.value = camera.near;
  u.cFar.value = camera.far;
  // depth of field: in the ego view the own warrior and everything up to ~25 m stay sharp, beyond that it softens gently; in the
  // commander view the band around the looked-at point stays sharp
  const f = postFocus(dt),
    off = SET.gfxDof === 'off';
  if (V.poss) POST.dof.set(26, 130, off ? 0 : 0.5);
  else POST.dof.set(f * 1.6, f * 4.5, off ? 0 : 0.55);
  u.fg.value.set(f * 0.45, V.poss || off ? 0 : 0.3);
  u.bres.value.set(Math.ceil(sw / 4), Math.ceil(sh / 4));
  const ub = POST.blMat.uniforms;
  ub.src.value.set(sw, sh);
  ub.cNear.value = camera.near;
  ub.cFar.value = camera.far;
  u.time.value = (u.time.value + 1) % 256;
  // overlay sprites go to layer 1 (drawn last, sharp); the rest of the scene stays on layer 0
  for (const sp of SPRITES) {
    if (!sp.parent) {
      SPRITES.delete(sp);
      continue;
    }
    const ov = !!(sp.material && sp.material.depthTest === false);
    if (ov !== !!sp.userData.ov) {
      sp.userData.ov = ov;
      sp.layers.set(ov ? 1 : 0);
    }
  }
  camera.layers.set(0);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  POST.quad.material = POST.aoMat;
  renderer.setRenderTarget(POST.ao);
  renderer.render(POST.sc, POST.cam);
  if (POST.dof.z > 0) {
    POST.quad.material = POST.blMat;
    renderer.setRenderTarget(POST.bl);
    renderer.render(POST.sc, POST.cam);
  }
  POST.quad.material = POST.mat;
  renderer.setRenderTarget(null);
  renderer.render(POST.sc, POST.cam);
  // the overlay sprites on top: no clear, no sky, no shadow map update
  const bg = scene.background,
    ac = renderer.autoClear,
    su = renderer.shadowMap.autoUpdate;
  scene.background = null;
  renderer.autoClear = false;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = false;
  camera.layers.set(1);
  renderer.render(scene, camera);
  camera.layers.enable(0);
  scene.background = bg;
  renderer.autoClear = ac;
  renderer.shadowMap.autoUpdate = su;
}
