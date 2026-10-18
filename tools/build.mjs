#!/usr/bin/env node
// Build the game into ONE self-contained page. Run from anywhere: `node tools/build.mjs`
//
//   index.html       the page that is deployed (GitHub Pages / Claude artifact). Never edit it by hand.
//   dist/body.html   the same game without <head>, used by the browser tests (tests/harness.py wraps it).
//
// How the JavaScript is assembled: every file in src/js is concatenated in file-name order (00-, 01-, 10- ...)
// into a single function scope:  (() => { 'use strict'; <all files> })();
// So all files share their top-level names (no imports/exports). Order matters only for top-level
// `const`/`let` values that are used while the page loads; functions are hoisted.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const THREE_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';

const jsFiles = readdirSync(join(root, 'src/js')).filter(f => f.endsWith('.js')).sort();
const js = jsFiles.map(f => `// ---- src/js/${f} ----\n` + read('src/js/' + f).replace(/\s+$/, '')).join('\n\n');
const game = `(() => {\n'use strict';\n${js}\n})();`;

// All files share one scope. A second `const`/`let` with a taken name is a syntax error (caught below), but a second top-level
// `function` with a taken name silently replaces the first one everywhere. Refuse that.
{
  const seen = new Map(), dup = [];
  for (const f of jsFiles)
    for (const m of read('src/js/' + f).matchAll(/^(?:async )?function\*? ?([A-Za-z_$][\w$]*)\s*\(/gm)) {
      if (seen.has(m[1])) dup.push(`function ${m[1]} is declared in src/js/${seen.get(m[1])} and again in src/js/${f}`);
      else seen.set(m[1], f);
    }
  if (dup.length) {
    console.error('Name clash (all script files share one scope, so the later one would silently win):\n  ' + dup.join('\n  '));
    process.exit(1);
  }
}

// syntax check of the whole bundle (compile only, nothing runs)
try {
  new vm.Script(game, { filename: 'game.js' });
} catch (e) {
  const m = /game\.js:(\d+)/.exec(e.stack || '');
  let where = '';
  if (m) { // map the bundle line back to the source file
    const lines = game.split('\n');
    for (let i = +m[1] - 1; i >= 0; i--) { const h = /^\/\/ ---- (src\/js\/\S+) ----$/.exec(lines[i]); if (h) { where = ` (${h[1]}, line ${+m[1] - 1 - i})`; break; } }
  }
  console.error('Syntax error in the game script' + where + ':\n' + e.message);
  process.exit(1);
}

const head = read('src/head.html').replace(/\s+$/, '');
const css = read('src/style.css').replace(/\s+$/, '');
const body = read('src/body.html').replace(/\s+$/, '');
const sounds = read('src/assets/sounds.b64.txt').trim();
const titleAndFonts = head.slice(head.indexOf('<title>'), head.indexOf('</head>')).trim();

const content = [`<style>\n${css}\n</style>`, body, THREE_TAG, `<script>\n${game}\n</script>`, `<script id="sndData" type="text/plain">${sounds}</script>`].join('\n');
const page = `${head}\n<body>\n${content}\n</body>\n</html>\n`;
writeFileSync(join(root, 'index.html'), page);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/body.html'), `${titleAndFonts}\n${content}\n`);
console.log(`built index.html (${(page.length / 1024).toFixed(0)} KB) from ${jsFiles.length} script files; dist/body.html for the tests`);
