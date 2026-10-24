#!/usr/bin/env node
// The upload package for game portals (itch.io, CrazyGames, Poki, Newgrounds ...): `node tools/portal.mjs` (runs the normal build first).
//
//   dist/portal/                      index.html + lib/ (three.js, PeerJS, MQTT, face-api) + fonts/ + models/
//   dist/rentner-gegen-wikinger.zip   the same folder zipped, index.html at the top: upload this file
//
// Differences to the GitHub Pages page: nothing is loaded from other websites (libraries and fonts come with the package; only the
// online play still talks to the public PeerJS/MQTT/STUN servers), no own fullscreen button (portals have theirs), and no player
// photos are sent to the opponent (window.WVR_PORTAL; see faceChunkPatch in src/js/61-net.js).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'dist/portal');
execFileSync(process.execPath, [join(root, 'tools/build.mjs')], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
for (const d of ['lib', 'fonts', 'models']) mkdirSync(join(out, d), { recursive: true });

// libraries next to the page
const libs = {
  'three.min.js': 'three/build/three.min.js',
  'peerjs.min.js': 'peerjs/dist/peerjs.min.js',
  'mqtt.min.js': 'mqtt/dist/mqtt.min.js',
  'face-api.js': '@vladmandic/face-api/dist/face-api.js',
};
for (const [f, src] of Object.entries(libs)) copyFileSync(join(nm, src), join(out, 'lib', f));
for (const f of readdirSync(join(root, 'models'))) copyFileSync(join(root, 'models', f), join(out, 'models', f));

// fonts: Lilita One + Rubik (400-700) as woff2, Latin and Cyrillic only (from @fontsource, OFL licence)
const want = /-(latin|latin-ext|cyrillic|cyrillic-ext)-\d+-normal\.woff2$/;
let css = '';
for (const [pkg, weights] of [['lilita-one', [400]], ['rubik', [400, 500, 600, 700]]]) {
  for (const w of weights) {
    const src = readFileSync(join(nm, '@fontsource', pkg, w + '.css'), 'utf8');
    for (const block of src.split('@font-face').slice(1)) {
      const m = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block);
      if (!m || !want.test(m[1])) continue;
      copyFileSync(join(nm, '@fontsource', pkg, 'files', m[1]), join(out, 'fonts', m[1]));
      css +=
        '@font-face' +
        block
          .replace(/src:[^;]+;/, `src: url(fonts/${m[1]}) format('woff2');`)
          .replace(/\/\*[^*]*\*\//g, '')
          .trim() +
        '\n';
    }
  }
}

// the page: local three.js and fonts, the portal switches
let page = readFileSync(join(root, 'index.html'), 'utf8');
const three = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
if (!page.includes(three)) throw new Error('three.js tag not found');
page = page.replace(three, '<script src="lib/three.min.js"></script>');
page = page.replace(/<link rel="preconnect"[^>]*>\n?/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, `<style>\n${css}</style>\n`);
if (/fonts\.googleapis|cdnjs\.cloudflare/.test(page)) throw new Error('external page resources left');
page = page.replace(
  '<script>\n(() => {',
  `<script>window.WVR_PORTAL = 1; window.WVR_LIBS = { peer: 'lib/peerjs.min.js', mqtt: 'lib/mqtt.min.js', faceapi: 'lib/face-api.js' };</script>\n<script>\n(() => {`
);
if (!page.includes('window.WVR_PORTAL = 1')) throw new Error('portal switch not inserted');
writeFileSync(join(out, 'index.html'), page);

// zip it (index.html at the top level)
const zip = join(root, 'dist/rentner-gegen-wikinger.zip');
rmSync(zip, { force: true });
execFileSync('python3', ['-c', `import zipfile, os, sys
root, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, _, fs in os.walk(root):
        for f in sorted(fs):
            p = os.path.join(d, f); z.write(p, os.path.relpath(p, root))`, out, zip]);
const files = [];
const walk = d => readdirSync(d).forEach(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
walk(out);
const size = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(`portal package: ${files.length} files, ${(size / 1048576).toFixed(1)} MB unpacked, zip ${(statSync(zip).size / 1048576).toFixed(1)} MB -> ${basename(zip)}`);
