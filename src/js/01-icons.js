/* 01-icons.js - Vector icon set as SVG paths (SI_D, si(name)) and siCanvas() to paint one into a canvas for sprites. No emoji anywhere in the game. */
/* ---------- vector icon set (no emoji) ---------- */
const SI_D = {
  gem: '<path d="M7 4h10l4 5-9 11L3 9z" fill="#5fd3f3" stroke="#14506a" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5" fill="none" stroke="#14506a" stroke-width="1" stroke-linejoin="round"/><path d="M8 9l1.5-5h5L16 9z" fill="#b8f0ff"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="#c9ced6" stroke="#2b2f3a" stroke-width="1.3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#2b2f3a" stroke-width="1.8"/><circle cx="12" cy="15" r="1.6" fill="#2b2f3a"/><path d="M12 15.5v2.4" stroke="#2b2f3a" stroke-width="1.4"/>',
  globe:
    '<circle cx="12" cy="12" r="9" fill="#5aa0d8" stroke="#1d3a5a" stroke-width="1.3"/><path d="M7.4 6.2c1.6.6 2.2 1.8 1.6 3-.6 1.4.4 2.4 1.8 2.6 1.6.2 1.8 1.6 1 2.8-.8 1.2-.2 2.8 1 3.4M15.6 4.6c-.8 1.4-.2 2.6 1.2 3 1.4.4 2.4 1.4 2 2.8M4.2 13.4c1.4-.2 2.6.6 2.8 2" fill="none" stroke="#e7f3d6" stroke-width="1.5" stroke-linecap="round"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="#1d3a5a" stroke-width=".9" opacity=".55"/>',
  gear: '<circle cx="12" cy="12" r="7.2" fill="#9aa3ad" stroke="#3a4049" stroke-width="1.2"/><path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2M5.4 5.4l2.2 2.2M16.4 16.4l2.2 2.2M5.4 18.6l2.2-2.2M16.4 7.6l2.2-2.2" stroke="#3a4049" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2.8" fill="#3a4049"/>',
  pin: '<path d="M12 2.4c1.8 0 2.6 1.4 2.4 3.2l-.6 2.6c1.6 2.4 2.8 5.2 2.8 8.2 0 2.6-1.6 5-4.6 5s-4.6-2.4-4.6-5c0-3 1.2-5.8 2.8-8.2l-.6-2.6c-.2-1.8.6-3.2 2.4-3.2z" fill="#f6f3ec" stroke="#3a3a3a" stroke-width="1.1"/><path d="M9.5 9.4h5M9.3 11h5.4" stroke="#e0442e" stroke-width="1.3"/>',
  wall: '<path d="M3 6.4h5.6v12.4H3zM9.2 5.4h5.6v13.4H9.2zM15.4 6.4H21v12.4h-5.6z" fill="#c9a24a" stroke="#5a3d17" stroke-width="1.2" stroke-linejoin="round"/><circle cx="5.8" cy="12.6" r="1.4" fill="#8a5a2b"/><circle cx="12" cy="12" r="1.4" fill="#8a5a2b"/><circle cx="18.2" cy="12.6" r="1.4" fill="#8a5a2b"/>',
  quake:
    '<path d="M2.6 17.2h18.8" stroke="#6b4a2a" stroke-width="2" stroke-linecap="round"/><path d="M12 17.2l-1.6-3.4 2.4-2-1.8-3.2 1.4-2.8" fill="none" stroke="#2f302c" stroke-width="1.8" stroke-linejoin="round"/><path d="M4.4 12.6l1.4-1.6M6.2 9.4l.8-2M19.6 12.6l-1.4-1.6M17.8 9.4l-.8-2" stroke="#e0a030" stroke-width="1.6" stroke-linecap="round"/>',
  sprout:
    '<path d="M12 21v-9" stroke="#3f7a2a" stroke-width="2" stroke-linecap="round"/><path d="M12 13c-.4-3.6-3-5.8-7-5.6.2 3.8 3 5.8 7 5.6zM12 11.4c.4-3.8 3.2-6.4 7.4-6.2-.2 4.2-3.2 6.4-7.4 6.2z" fill="#6fbf4f" stroke="#2f5a1f" stroke-width="1.1" stroke-linejoin="round"/><path d="M7 21h10" stroke="#6b4a2a" stroke-width="2" stroke-linecap="round"/>',
  nade: '<path d="M9.3 6.2h5.4l.6 2.4H8.7z" fill="#5d6675"/><path d="M14.4 6.6c2.6-.2 4.6.8 5.4 2.9l-1.6.5c-.6-1.4-2-2-3.6-1.9z" fill="#8a94a3"/><circle cx="18.6" cy="5" r="2.1" fill="none" stroke="#c8ced8" stroke-width="1.4"/><ellipse cx="12" cy="15" rx="6.6" ry="7" fill="#d9e1ec"/><path d="M5.6 13.2h12.8M5.5 16.6h13M8.2 8.8c-1 4-1 8.6.2 12.4M12 8v14M15.8 8.8c1 4 1 8.6-.2 12.4" stroke="#8b97aa" stroke-width=".9" fill="none"/><path d="M7 11.5l3-1.6.8 2.8-2.9 1.1zM13.4 17.9l2.7-.6.2 2.4-2.6.7z" fill="#ff6bd5"/><path d="M13 10.2l2.6.2-.2 2.6-2.5-.2zM7.6 17.4l2.6.4-.5 2.4-2.3-.9z" fill="#6be3ff"/><path d="M16.2 13.6l2.1.4-.2 2.3-2.1-.2z" fill="#ffe66b"/><ellipse cx="12" cy="15" rx="6.6" ry="7" fill="none" stroke="#1d2433" stroke-width="1.3"/>',
  bag: '<path d="M9 4.2c1 .9 2 1.2 3 1.2s2-.3 3-1.2l-1.2 3.6h-3.6z" fill="#b5843f" stroke="#5a3d17" stroke-width="1.1" stroke-linejoin="round"/><path d="M10.2 7.8h3.6c4.2 2.2 6.6 6.2 6 10.2-.4 2.4-2.6 3.8-7.8 3.8S4.6 20.4 4.2 18c-.6-4 1.8-8 6-10.2z" fill="#c9974d" stroke="#5a3d17" stroke-width="1.2" stroke-linejoin="round"/><path d="M9.6 8.2h4.8" stroke="#d23a2e" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="15.4" r="3.6" fill="#f4c64f" stroke="#a87512" stroke-width="1"/><path d="M13.3 13.9c-.9-.7-2.6-.5-2.9.9-.3 1.5 1 2.4 2.9 1.5M10 15.1h2.6" stroke="#a87512" stroke-width="1" fill="none" stroke-linecap="round"/>',
  spring:
    '<rect x="5" y="3.5" width="14" height="2.6" rx="1" fill="#e0a64a" stroke="#6b4a17" stroke-width="1"/><path d="M7 7.6l10 2-10 2 10 2-10 2 10 2" fill="none" stroke="#aab3c0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="18.4" width="16" height="2.6" rx="1" fill="#6b7280" stroke="#2b2f3a" stroke-width="1"/>',
  paw: '<ellipse cx="12" cy="15.6" rx="5.2" ry="4.4" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.2"/><ellipse cx="5.6" cy="10.4" rx="2" ry="2.5" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.1"/><ellipse cx="9.4" cy="6.8" rx="2" ry="2.6" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.1"/><ellipse cx="14.6" cy="6.8" rx="2" ry="2.6" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.1"/><ellipse cx="18.4" cy="10.4" rx="2" ry="2.5" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.1"/><path d="M9.6 14.4c1.4-1 3.4-1 4.8 0" stroke="#bdb6a6" stroke-width="1" fill="none"/>',
  fire: '<path d="M12 2.5c.8 3.4 5.8 5.6 5.8 11.2A5.8 5.8 0 0 1 12 21.5a5.8 5.8 0 0 1-5.8-5.8c0-3 1.6-4.6 2.6-6 .3 1.4 1 2.4 2 2.8-.6-3.4.6-7 1.2-10z" fill="#ff6a2b" stroke="#7a2006" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 11.4c.6 2 3 3 3 5.6a3 3 0 0 1-6 0c0-1.6 1-2.6 1.6-3.4.2 .8.6 1.2 1 1.4-.2-1.4.1-2.6.4-3.6z" fill="#ffd34d"/>',
  whirl:
    '<path d="M20.5 12a8.5 8.5 0 1 1-4.2-7.3M16 12a4 4 0 1 1-2.6-3.7M12 12" fill="none" stroke="#f6f1e7" stroke-width="2.2" stroke-linecap="round"/><path d="M14.6 3.2l2.6 1.6-1.4 2.6" fill="none" stroke="#f6f1e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.4" fill="#f6f1e7"/>',
  teeth:
    '<path d="M3.5 10c0-3.4 3.6-5.5 8.5-5.5s8.5 2.1 8.5 5.5v1.2H3.5z" fill="#e88a9a" stroke="#7a2d4a" stroke-width="1.1"/><path d="M4.4 11.2h15.2v2.4c0 1.2-1.2 1.8-2.2 1.2-.8 1.2-2.2 1.2-3 0-.8 1.2-2.2 1.2-3 0-.8 1.2-2.2 1.2-3 0-1 .6-4 0-4-1.2z" fill="#fffaf0" stroke="#7a2d4a" stroke-width="1"/><path d="M4.4 14.6c.2 2.4 3.6 4.9 7.6 4.9s7.4-2.5 7.6-4.9" fill="#e88a9a" stroke="#7a2d4a" stroke-width="1.1"/><path d="M5.6 15.6h12.8v1.4H5.6z" fill="#fffaf0"/>',
  dash: '<path d="M3 8h8M2 12h9M3 16h8" stroke="#dfe8f3" stroke-width="2" stroke-linecap="round"/><path d="M12 6l8 6-8 6z" fill="#dfe8f3" stroke="#3a4558" stroke-width="1.1" stroke-linejoin="round"/>',
  bolt: '<path d="M13.8 2.5L5.5 13.4h5.2l-1.4 8.1 8.2-11h-5.2z" fill="#ffd34d" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>',
  salvo:
    '<path d="M3 4l6 6M8 2.5l5 7M2.5 9l6 4" stroke="#ffb35c" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><circle cx="11" cy="12" r="3" fill="#9a8b76" stroke="#3a3328" stroke-width="1"/><circle cx="16.5" cy="9" r="2.6" fill="#9a8b76" stroke="#3a3328" stroke-width="1"/><circle cx="16" cy="17" r="3.4" fill="#9a8b76" stroke="#3a3328" stroke-width="1"/>',
  cake: '<path d="M4 12.5h16v7.5H4z" fill="#fff1f5" stroke="#7a2d4a" stroke-width="1.1"/><path d="M4 12.5c1.4 2 2.6 2 4 0 1.4 2 2.6 2 4 0 1.4 2 2.6 2 4 0 1.4 2 2.6 2 4 0" fill="#f2a9c4" stroke="#7a2d4a" stroke-width="1"/><path d="M3 20h18" stroke="#7a2d4a" stroke-width="1.4" stroke-linecap="round"/><path d="M12 6.5v6" stroke="#5ab0e6" stroke-width="1.6"/><path d="M12 3c1.2 1.4 1 2.8 0 3.4-1-.6-1.2-2 0-3.4z" fill="#ffb347"/><circle cx="8" cy="16.6" r=".9" fill="#d0213a"/><circle cx="16" cy="16.6" r=".9" fill="#d0213a"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.4" fill="#f6f1e7" stroke="#1d2433" stroke-width="1.3"/><circle cx="8.4" cy="8.4" r="1.5" fill="#1d2433"/><circle cx="15.6" cy="8.4" r="1.5" fill="#1d2433"/><circle cx="12" cy="12" r="1.5" fill="#d23a2e"/><circle cx="8.4" cy="15.6" r="1.5" fill="#1d2433"/><circle cx="15.6" cy="15.6" r="1.5" fill="#1d2433"/>',
  flower:
    '<path d="M12 13v8.5M12 17c-2-2.4-4.4-2.4-5.6-1.4 1.2 1.6 3.4 2 5.6 1.4z" stroke="#3f8f3a" stroke-width="1.6" fill="#5fae4a" stroke-linecap="round"/><g fill="#fff" stroke="#c9a227" stroke-width=".9"><circle cx="12" cy="5" r="2.6"/><circle cx="16.6" cy="8.4" r="2.6"/><circle cx="14.8" cy="13.4" r="2.6"/><circle cx="9.2" cy="13.4" r="2.6"/><circle cx="7.4" cy="8.4" r="2.6"/></g><circle cx="12" cy="9.6" r="2.4" fill="#f4c64f" stroke="#a87512" stroke-width="1"/>',
  cactus:
    '<path d="M10 21V5.5a2 2 0 0 1 4 0V21z" fill="#4f9a3a" stroke="#22501a" stroke-width="1.1"/><path d="M10 14H7.6a2 2 0 0 1-2-2V8.4a1.4 1.4 0 0 1 2.8 0V11H10M14 12h2.4a2 2 0 0 0 2-2V7a1.4 1.4 0 0 0-2.8 0v2.4H14" fill="#4f9a3a" stroke="#22501a" stroke-width="1.1"/><path d="M12 7v12" stroke="#6fbf55" stroke-width=".9"/><path d="M5 21h14" stroke="#c9974d" stroke-width="1.8" stroke-linecap="round"/>',
  snow: '<g stroke="#bfefff" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.6 4.4L12 6.6l2.4-2.2M9.6 19.6L12 17.4l2.4 2.2M4.6 10.6l3.1-.9-.7-3.2M19.4 13.4l-3.1.9.7 3.2M4.6 13.4l3.1.9-.7 3.2M19.4 10.6l-3.1-.9.7-3.2"/></g>',
  mountain:
    '<path d="M2 20l7-12 3.4 5.2L15 9l7 11z" fill="#8c7b66" stroke="#2a2420" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 8l1.9 3-1.1 1.2-1.2-1.4-1.3 1.6zM15 9l1.8 2.8-1.3 1-.8-1.1-1.2 1.4z" fill="#f3f6f8"/><path d="M11.2 20l1.4-4 1.2 4" stroke="#2a2420" stroke-width="1" fill="#3a302a"/>',
  swords:
    '<path d="M5 3.5l9.8 9.8M19 3.5l-9.8 9.8" stroke="#e6ebf2" stroke-width="2.2" stroke-linecap="round"/><path d="M5 3.5l.2 2.6M5 3.5l2.6.2M19 3.5l-.2 2.6M19 3.5l-2.6.2" stroke="#e6ebf2" stroke-width="1.6" stroke-linecap="round"/><path d="M12.4 15.4l3.4-3.4M8.2 12l3.4 3.4" stroke="#8a5a2b" stroke-width="2.2" stroke-linecap="round"/><path d="M16.2 16.6l3.6 3.6M7.8 16.6l-3.6 3.6" stroke="#5d3b1d" stroke-width="2.6" stroke-linecap="round"/>',
  snd: '<path d="M3.5 9.2v5.6h3.8l5 4.2V5l-5 4.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.6 9a4.4 4.4 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="#f0bf4c" stroke-width="1.6" stroke-linecap="round"/>',
  gfx: '<rect x="2.5" y="4" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 20.5h7M12 17v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 13.5l3.2-4 2.6 2.6 2.4-3.2 2.8 4.6" fill="none" stroke="#f0bf4c" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 9.6h1.2M9.4 9.6h1.2M12.8 9.6h1.2M16.2 9.6h1.2M6.4 12.6h1.2M10 12.6h1.2M13.4 12.6h1.2M16.8 12.6h.8M8 15.4h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  mouse:
    '<rect x="6.5" y="3" width="11" height="18" rx="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v6.4M6.5 9.4h11" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="5" width="2" height="3" rx="1" fill="currentColor"/>',
  warn: '<path d="M12 3l9.5 17h-19z" fill="#ffd34d" stroke="#7a4a00" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 9v5.4" stroke="#3a2400" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.3" fill="#3a2400"/>',
  home: '<path d="M3.5 11.2 12 4l8.5 7.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9.5h4.4v-5.6h3.2v5.6H18V10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  coins:
    '<ellipse cx="9" cy="17" rx="6" ry="2.6" fill="#d99a22" stroke="#7a5200" stroke-width="1"/><path d="M3 14v3c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-3" fill="#f4c64f" stroke="#7a5200" stroke-width="1"/><ellipse cx="9" cy="14" rx="6" ry="2.6" fill="#f4c64f" stroke="#7a5200" stroke-width="1"/><path d="M9 7v3c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V7" fill="#f4c64f" stroke="#7a5200" stroke-width="1"/><ellipse cx="15" cy="7" rx="6" ry="2.6" fill="#ffd968" stroke="#7a5200" stroke-width="1"/>',
  flag: '<path d="M6 21.5V3" stroke="#5d3b1d" stroke-width="2" stroke-linecap="round"/><path d="M6.6 3.8c3.4-1.6 6 1.6 9.4 0 1-.4 2-.4 3 0v8.6c-3.4 1.6-6-1.6-9.4 0-1 .4-2 .4-3 0z" fill="#d23a2e" stroke="#6b1410" stroke-width="1.1" stroke-linejoin="round"/>',
  battery:
    '<rect x="3" y="7" width="16" height="10" rx="2" fill="#2b3446" stroke="#c9d3e0" stroke-width="1.4"/><rect x="19.4" y="10" width="2" height="4" rx=".6" fill="#c9d3e0"/><rect x="5" y="9" width="3.4" height="6" rx=".6" fill="#6cdc6c"/><rect x="9.3" y="9" width="3.4" height="6" rx=".6" fill="#6cdc6c"/><rect x="13.6" y="9" width="3.4" height="6" rx=".6" fill="#6cdc6c"/>',
  heal: '<path d="M12 20.5S3.5 15.4 3.5 9.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 1.8c0 6-8.5 11.1-8.5 11.1z" fill="#ff6b7a" stroke="#7a1420" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 9.4v6.4M8.8 12.6h6.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  horseshoe:
    '<path d="M6 4v7a6 6 0 0 0 12 0V4" fill="none" stroke="#aab3c0" stroke-width="3.4" stroke-linecap="round"/><path d="M6 4v7a6 6 0 0 0 12 0V4" fill="none" stroke="#2b2f3a" stroke-width=".8"/><circle cx="6" cy="7" r=".7" fill="#2b2f3a"/><circle cx="18" cy="7" r=".7" fill="#2b2f3a"/><circle cx="7.4" cy="13.4" r=".7" fill="#2b2f3a"/><circle cx="16.6" cy="13.4" r=".7" fill="#2b2f3a"/><path d="M1.5 19h5M2.5 21.5h6" stroke="#dfe8f3" stroke-width="1.4" stroke-linecap="round"/>',
  arrow:
    '<path d="M4 20L18.5 5.5" stroke="#8a5a2b" stroke-width="2" stroke-linecap="round"/><path d="M20.5 3.5l-1.2 6-2.4-2.4-2.4-2.4z" fill="#c9d3e0" stroke="#2b2f3a" stroke-width="1" stroke-linejoin="round"/><path d="M4 20l-.6-3.6M4 20l3.6.6M6 18l-.6-3.4M6 18l3.4.6" stroke="#e05b4b" stroke-width="1.6" stroke-linecap="round"/>',
  shield:
    '<path d="M12 2.8l8 3v6c0 5-3.4 8.4-8 9.6-4.6-1.2-8-4.6-8-9.6v-6z" fill="#9aa3ad" stroke="#2b2f3a" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 5.4l5.4 2v4.4c0 3.4-2.2 5.8-5.4 6.8z" fill="#c9d0d8"/><path d="M12 5.4v13.2" stroke="#2b2f3a" stroke-width="1"/>',
  tower:
    '<path d="M6.5 21l1.4-12h8.2l1.4 12z" fill="#a08066" stroke="#3a2a1c" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 9h13V5.5h-2.2v1.6h-2V5.5h-2.6v1.6h-2V5.5H7.7v1.6h-2.2z" fill="#8c6c52" stroke="#3a2a1c" stroke-width="1.1" stroke-linejoin="round"/><path d="M10.6 21v-4a1.4 1.4 0 0 1 2.8 0v4" fill="#3a2a1c"/><rect x="11" y="11" width="2" height="2.8" rx=".6" fill="#3a2a1c"/>',
  crown:
    '<path d="M3.5 18.5L2.5 7.5l5 4.4L12 4.5l4.5 7.4 5-4.4-1 11z" fill="#f4c64f" stroke="#7a5200" stroke-width="1.2" stroke-linejoin="round"/><path d="M3.5 18.5h17v2h-17z" fill="#d99a22" stroke="#7a5200" stroke-width="1"/><circle cx="12" cy="14" r="1.6" fill="#d23a2e"/><circle cx="7.2" cy="15" r="1.1" fill="#4f86c4"/><circle cx="16.8" cy="15" r="1.1" fill="#4f86c4"/>',
  burst:
    '<path d="M12 2l2.2 5.6 5.6-2.4-2.6 5.4 5.3 2.3-5.6 1.6 2.4 5.6-5.4-2.6L12 22l-1.9-5.5-5.4 2.6 2.4-5.6-5.6-1.6 5.3-2.3-2.6-5.4 5.6 2.4z" fill="#ff8a3d" stroke="#7a2006" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 7.4l1.2 3 3-.6-1.8 2.4 2 2.2-3 .2-.4 3-1.8-2.4-2.6 1.4.8-2.8-2.8-1.2 3-.8z" fill="#ffd34d"/>',
  tornado:
    '<path d="M3 4.5h18M5 8h14M7.4 11.5h10M9.4 15h6.8M10.6 18.5h4M11.6 21.5h2" stroke="#d6dde6" stroke-width="2" stroke-linecap="round"/>',
  axes: '<path d="M5 20L18 7M19 20L6 7" stroke="#8a5a2b" stroke-width="2" stroke-linecap="round"/><path d="M16 3.5c2.8.2 4.6 2 4.6 4.8l-3.6-.8-1.8-1.8zM8 3.5c-2.8.2-4.6 2-4.6 4.8l3.6-.8 1.8-1.8z" fill="#c9d3e0" stroke="#2b2f3a" stroke-width="1.1" stroke-linejoin="round"/>',
  goat: '<path d="M7 9c-2.6-1-4.6-3.6-4.2-6.6 2 1.6 4 2.2 6.2 3.2M17 9c2.6-1 4.6-3.6 4.2-6.6-2 1.6-4 2.2-6.2 3.2" fill="#c9b99a" stroke="#5a4a32" stroke-width="1.1"/><path d="M7.4 8.4c1.4-1.4 7.8-1.4 9.2 0 1 1 .8 4.4-.6 7l-1.8 4.2c-.6 1.4-3.8 1.4-4.4 0L8 15.4c-1.4-2.6-1.6-6-.6-7z" fill="#efe9dc" stroke="#5a4a32" stroke-width="1.1"/><circle cx="9.8" cy="11.6" r="1" fill="#2b2f3a"/><circle cx="14.2" cy="11.6" r="1" fill="#2b2f3a"/><path d="M11 20.2c.4 1.4 1.6 1.4 2 0" stroke="#5a4a32" stroke-width="1.1" fill="#e0d4bc"/>',
  moon: '<path d="M15.8 3.2A9 9 0 1 0 20.8 17 7.4 7.4 0 0 1 15.8 3.2z" fill="#f6e7a6" stroke="#7a6a2a" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="11" r="1.4" fill="#e2cf80"/><circle cx="13" cy="16.4" r="1" fill="#e2cf80"/><circle cx="8" cy="16" r=".8" fill="#e2cf80"/>',
  chicken:
    '<path d="M8 21c-2.6-1.6-4-4.4-3.4-7.6.6-3 3-5 3.4-8 .3-2 1.8-3 3.6-2.6 1.8.4 2.8 2 2.4 4l3.6 1.6-3.4 1c1.6 1.8 4.4 2.6 6 1.6-.2 5.2-4.4 10.2-12.2 10z" fill="#fff" stroke="#3a3a3a" stroke-width="1.1" stroke-linejoin="round"/><path d="M9.2 3.2c.2-1.4 1.2-1.8 2-1 .6-1 1.8-.6 1.8.6" fill="#e03a2e" stroke="#7a1410" stroke-width=".8"/><path d="M14 6.6l3.6 1.6-3.4 1" fill="#f4b32e" stroke="#7a5200" stroke-width=".8"/><circle cx="12" cy="5.8" r=".9" fill="#1d2433"/>',
  target:
    '<circle cx="12" cy="12" r="9" fill="#fff" stroke="#7a1410" stroke-width="1.1"/><circle cx="12" cy="12" r="6.4" fill="#e0442e"/><circle cx="12" cy="12" r="3.8" fill="#fff"/><circle cx="12" cy="12" r="1.6" fill="#e0442e"/><path d="M12 12l8.6-8.6M18 3l2.6.4.4 2.6" stroke="#2b2f3a" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  axe: '<path d="M7 21L16.5 6.2" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round"/><path d="M13.4 3.2c3.8-.6 7 1.4 7.6 5-2.2-.8-4-.6-5.6.6z" fill="#c9d3e0" stroke="#2b2f3a" stroke-width="1.2" stroke-linejoin="round"/><path d="M13.6 4.6l-2 3.4 2.4 1.2" fill="#9aa3ad" stroke="#2b2f3a" stroke-width="1" stroke-linejoin="round"/><path d="M6 15c1.6-.4 3 .2 3.6 1.4" stroke="#d23a2e" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  bighead:
    '<circle cx="12" cy="10" r="7.6" fill="#f2c79a" stroke="#6b4a2a" stroke-width="1.2"/><path d="M8 21c.6-2.4 2-3.4 4-3.4s3.4 1 4 3.4" fill="#4f86c4" stroke="#1d3a5a" stroke-width="1.1"/><circle cx="9.4" cy="9.4" r="1.4" fill="#1d2433"/><circle cx="14.6" cy="9.4" r="1.4" fill="#1d2433"/><path d="M9.2 13.2c1.6 1.4 4 1.4 5.6 0" stroke="#7a2d2d" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M20 4.5l1.6-1.6M21.4 7.6h2M4 4.5L2.4 2.9M2.6 7.6h-2" stroke="#ffd34d" stroke-width="1.4" stroke-linecap="round"/>',
  boulder:
    '<path d="M4 16.6l1.4-6.4 4.6-4.4 6.2.6 3.6 4.8.4 5.6-4.4 3.4H8.6z" fill="#8f918b" stroke="#2f302c" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 5.8l1.2 4.4-3.8 1.4M16.2 6.4l-1 4.2 5 .4M11.2 10.2l3.8.4 1.4 5.8" stroke="#5f605b" stroke-width="1" fill="none"/>',
  twins:
    '<circle cx="8" cy="7" r="3.2" fill="#f2c79a" stroke="#6b4a2a" stroke-width="1"/><circle cx="16" cy="7" r="3.2" fill="#f2c79a" stroke="#6b4a2a" stroke-width="1"/><path d="M2.5 20c0-4 2.4-7 5.5-7s5.5 3 5.5 7z" fill="#4f86c4" stroke="#1d3a5a" stroke-width="1"/><path d="M10.5 20c0-4 2.4-7 5.5-7s5.5 3 5.5 7z" fill="#c07aa8" stroke="#5a2d4a" stroke-width="1"/>',
  giant:
    '<path d="M6 20.5c-1.6-3-1.4-6.4.6-9.4l2.4-3.6c.8-1.4 2.6-1.8 3.8-.8l.8.6 2-2.4c1-1.2 3-1 3.6.4.6 1.2.2 2.4-.8 3.2l-2.2 1.8c2.8.6 4.6 3.2 4.2 6.2-.4 3-3 5-6 5H9.4" fill="#f2c79a" stroke="#6b4a2a" stroke-width="1.2" stroke-linejoin="round"/><path d="M10.4 14.4c1.6-1.2 3.8-1 5 .6" stroke="#6b4a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  meteor:
    '<path d="M3 3l8.6 8.6M7.4 2.6l6 7.4M2.6 7.4l7.4 6" stroke="#ffb35c" stroke-width="1.8" stroke-linecap="round"/><circle cx="15" cy="15" r="6" fill="#8a5a3a" stroke="#3a2010" stroke-width="1.2"/><circle cx="13" cy="13.6" r="1.4" fill="#6a3f24"/><circle cx="17" cy="17" r="1.8" fill="#6a3f24"/><path d="M10.4 11.4a6 6 0 0 1 4-2.4" stroke="#ffd34d" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  dance:
    '<circle cx="12" cy="13" r="7.4" fill="#d9e1ec" stroke="#1d2433" stroke-width="1.2"/><path d="M4.8 11.4h14.4M4.8 14.8h14.4M8.6 6.4c-1.2 4-1.2 9.2 0 13.2M12 5.6v14.8M15.4 6.4c1.2 4 1.2 9.2 0 13.2" stroke="#8b97aa" stroke-width=".9" fill="none"/><path d="M8.6 9l3.4-.6v3H8.6zM12 14.8h3.4l-.2 3.2-3.2.8zM15.4 11.4l3.2-.2.4 3.4h-3.6z" fill="#ff6bd5"/><path d="M12 8.4h3.4l.2 3H12zM5 14.8h3.6v3.4L6 17.4z" fill="#6be3ff"/><path d="M12 2v3.6" stroke="#5d6675" stroke-width="1.4"/>',
  bear: '<circle cx="6.6" cy="6.6" r="2.6" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.1"/><circle cx="17.4" cy="6.6" r="2.6" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.1"/><circle cx="12" cy="13" r="8" fill="#f3f1ea" stroke="#3a3a3a" stroke-width="1.2"/><ellipse cx="12" cy="16" rx="3.6" ry="2.8" fill="#e6e2d6"/><ellipse cx="12" cy="14.6" rx="1.8" ry="1.3" fill="#1d1d1d"/><circle cx="9" cy="11" r="1.1" fill="#1d1d1d"/><circle cx="15" cy="11" r="1.1" fill="#1d1d1d"/>',
};
const si = (n, cls = '') => `<svg class="si${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${SI_D[n] || ''}</svg>`;
function siCanvas(n, px = 128, ring) {
  const c = cnv(px, px),
    x = c.getContext('2d');
  if (ring) {
    x.fillStyle = ring;
    x.beginPath();
    x.arc(px / 2, px / 2, px * 0.47, 0, TAU);
    x.fill();
    x.lineWidth = px * 0.05;
    x.strokeStyle = 'rgba(255,255,255,.95)';
    x.stroke();
  }
  const img = new Image();
  img.onload = () => {
    const m = ring ? px * 0.2 : 0;
    x.drawImage(img, m, m, px - 2 * m, px - 2 * m);
    if (c._tex) c._tex.needsUpdate = true;
  };
  img.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}">${SI_D[n] || ''}</svg>`);
  return c;
}
/* ---------- icons ---------- */
const ICON = {
  coin: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#d99a22"/><circle cx="12" cy="11" r="9.2" fill="#f4c64f"/><circle cx="12" cy="11" r="6.4" fill="none" stroke="#d99a22" stroke-width="1.4"/><path d="M9 8.5c1.6-1.4 4.4-1 4.9.8M9.5 11h4" stroke="#b77d12" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  bottle:
    '<svg class="i" viewBox="0 0 24 24"><rect x="9.7" y="1" width="4.6" height="2.2" rx=".6" fill="#d7dde3"/><path d="M10.1 3.1h3.8v2.7c0 .7.3 1.3.8 1.8 1.2 1.2 1.8 2.5 1.8 4V21a2 2 0 0 1-2 2H9.5a2 2 0 0 1-2-2v-9.4c0-1.5.6-2.8 1.8-4 .5-.5.8-1.1.8-1.8z" fill="#3c9a5c"/><rect x="7.5" y="12.4" width="9" height="5.6" fill="#f3eedf"/><path d="M13.5 14.2a1.9 1.9 0 1 1-1.2-.4" stroke="#3c9a5c" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M12.6 13.2l.7.6-.8.4" stroke="#3c9a5c" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M9.6 9.4v1.8M9.6 19v1.4" stroke="#bfe9cc" stroke-width="1.1" stroke-linecap="round" opacity=".8"/></svg>',
  army: '<svg class="i" viewBox="0 0 24 24" fill="#d8dde6"><circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M2.5 19c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6zM10.5 19c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6z"/></svg>',
  pause:
    '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  sword:
    '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 19L18 6l1-3-3 1L3 17"/><path d="M7 14l3 3M4 20l2-2"/></svg>',
  star: '<svg class="i" viewBox="0 0 24 24" fill="#f0bf4c"><path d="M12 2l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.3 5.8 20.7l1.6-6.9L2.1 9.1l7-.7z"/></svg>',
  exit: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4H5v16h4M15 8l4 4-4 4M19 12H9"/></svg>',
  sound:
    '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  flag: '<svg class="i" viewBox="0 0 24 24"><path d="M6 2.5v19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 3.5h11l-2.6 4 2.6 4H7z" fill="#f0bf4c" stroke="#2a1c04" stroke-width="1" stroke-linejoin="round"/></svg>',
  enter:
    '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="#2a1c04" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
};
