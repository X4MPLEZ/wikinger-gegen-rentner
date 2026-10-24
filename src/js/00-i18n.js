/* 00-i18n.js - LANGUAGES. The game is written in German; TR(text, a, b) returns the text in the player's language, with {0}, {1} …
   filled from the arguments. Always pass the German text itself as the first argument (a string literal), so tools/i18n.py can find it.
   Translations live in src/lang/<code>.json ({ "German text": "translation" }); the build embeds them (one shared key list + one list
   per language). A missing translation falls back to English, then German.
   The language is picked once at start: ?lang=xx, window.WVR_LANG (tests), the choice saved in the menu, the browser's languages, else English. Changing it in the
   menu reloads the page, so every text built while the page loads (unit names, perks …) is in the right language.
   Static texts in src/body.html are translated in place right here: text nodes, the attributes aria-label/title/placeholder/alt/data-t,
   and elements marked data-l (their whole inner HTML is one text: sentences with <b> inside). */
const LANGS = [
  ['de', 'Deutsch'],
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['it', 'Italiano'],
  ['pt', 'Português'],
  ['pl', 'Polski'],
  ['tr', 'Türkçe'],
  ['ru', 'Русский'],
  ['nl', 'Nederlands'],
  ['id', 'Bahasa Indonesia'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['zh', '中文'],
];
const LANG = (() => {
  const ok = c => (c && LANGS.some(l => l[0] === c) ? c : null);
  let q = null;
  try {
    q = new URLSearchParams(location.search).get('lang');
  } catch (_) {}
  const nav = () => {
    for (const l of navigator.languages || [navigator.language || '']) {
      const c = ok(String(l).toLowerCase().slice(0, 2));
      if (c) return c;
    }
    return null;
  };
  return ok(q) || ok(window.WVR_LANG) || ok(store.get('wvr-lang')) || nav() || 'en'; // WVR_LANG: set by the tests (German texts)
})();
const LDICT = (() => {
  // the shared key list (German texts) and the translations of the chosen language (+ English as the fallback), index by index
  if (LANG === 'de') return null;
  const read = id => {
    try {
      const el = document.getElementById(id);
      return el ? JSON.parse(el.textContent) : null;
    } catch (_) {
      return null;
    }
  };
  const keys = read('i18n-keys');
  if (!keys) return null;
  const tr = read('i18n-' + LANG) || [],
    en = LANG === 'en' ? [] : read('i18n-en') || [],
    m = new Map();
  keys.forEach((k, i) => {
    const t = tr[i] || en[i];
    if (t) m.set(k, t);
  });
  return m;
})();
function TR(s, ...a) {
  let t = (LDICT && LDICT.get(s)) || s;
  if (a.length) t = t.replace(/\{(\d)\}/g, (m, i) => (a[i] !== undefined ? a[i] : m));
  return t;
}
// a number in the player's way of writing it (2,5 or 2.5); d decimals
function numL(v, d = 1) {
  try {
    return Number(v).toLocaleString(LANG, { minimumFractionDigits: 0, maximumFractionDigits: d });
  } catch (_) {
    return String(v);
  }
}
// the static texts of the page (also used by tools/i18n.py to collect them: ?i18n=collect fills I18N_DOM instead of translating)
const I18N_DOM = [];
function i18nDom(root) {
  const collect = /[?&]i18n=collect/.test(location.search);
  if (!LDICT && !collect) return;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const tr = s => {
    const k = norm(s);
    if (!k || !/[A-Za-zÄÖÜäöüß]/.test(k)) return null;
    if (collect) {
      I18N_DOM.push(k);
      return null;
    }
    const t = LDICT.get(k);
    return t ? s.match(/^\s*/)[0] + t + s.match(/\s*$/)[0] : null; // keeps the whitespace around the text
  };
  const walk = el => {
    if (el.nodeType === 3) {
      const t = tr(el.nodeValue);
      if (t !== null) el.nodeValue = t;
      return;
    }
    if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'svg' || el.hasAttribute('data-nol'))
      return;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'data-t']) {
      if (!el.hasAttribute(a)) continue;
      const t = tr(el.getAttribute(a));
      if (t !== null) el.setAttribute(a, t);
    }
    if (el.hasAttribute('data-l')) {
      const k = norm(el.innerHTML);
      if (collect) I18N_DOM.push(k);
      else if (LDICT.get(k)) el.innerHTML = LDICT.get(k);
      return;
    }
    for (const c of Array.from(el.childNodes)) walk(c);
  };
  walk(root);
}
document.documentElement.lang = LANG;
i18nDom(document.body);
try {
  document.title = TR('Rentner gegen Wikinger');
} catch (_) {}
