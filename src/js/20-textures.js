/* 20-textures.js - Canvas textures drawn in code: faces/portraits, flags, text. cnv(w, h) makes a canvas. */
function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function ell(x, cx, cy, rx, ry, col) {
  x.fillStyle = col;
  x.beginPath();
  x.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  x.fill();
}
function eye(x, cx, cy, rx, ry, look) {
  ell(x, cx, cy, rx, ry, '#fff');
  ell(x, cx + look, cy + ry * 0.15, rx * 0.55, ry * 0.55, '#2a2230');
  ell(x, cx + look - rx * 0.2, cy - ry * 0.1, rx * 0.17, ry * 0.17, '#fff');
}
function brow(x, x1, y1, x2, y2, w, col) {
  x.strokeStyle = col;
  x.lineWidth = w;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(x1, y1);
  x.lineTo(x2, y2);
  x.stroke();
}
function rrect(x, a, b, w, h, r) {
  x.beginPath();
  if (x.roundRect) x.roundRect(a, b, w, h, r);
  else x.rect(a, b, w, h);
  x.fill();
}
const FACE_CANVAS = [];
function drawFace(k) {
  const c = cnv(512, 256),
    x = c.getContext('2d');
  x.fillStyle =
    { 0: '#efbf98', 1: '#f5cfb0', 2: '#efc4a6', 3: '#f2cbb4', 4: '#f0c39c', 5: '#ecc1a3', 12: '#e9b38c', 13: '#efc4a6' }[k] || '#efc4a6';
  x.fillRect(0, 0, 512, 256);
  if (k === 0) {
    x.fillStyle = '#c8562a';
    x.fillRect(238, 0, 274, 256);
    x.fillRect(0, 0, 20, 256);
    x.fillStyle = 'rgba(47,111,209,.6)';
    x.fillRect(66, 100, 124, 24);
    eye(x, 100, 112, 15, 15, 2);
    eye(x, 156, 112, 15, 15, -2);
    brow(x, 80, 88, 116, 102, 10, '#8a3a16');
    brow(x, 176, 88, 140, 102, 10, '#8a3a16');
    ell(x, 128, 140, 12, 14, '#d99e7a');
    x.fillStyle = '#c8562a';
    x.beginPath();
    x.moveTo(52, 138);
    x.quadraticCurveTo(60, 230, 128, 252);
    x.quadraticCurveTo(196, 230, 204, 138);
    x.quadraticCurveTo(170, 150, 128, 150);
    x.quadraticCurveTo(86, 150, 52, 138);
    x.fill();
    ell(x, 128, 172, 22, 16, '#3a1010');
    x.fillStyle = '#fff';
    x.fillRect(110, 158, 36, 7);
  } else if (k === 1) {
    x.fillStyle = '#e9c45a';
    x.fillRect(240, 0, 272, 256);
    x.fillRect(0, 0, 18, 256);
    x.fillRect(0, 0, 512, 52);
    x.beginPath();
    x.moveTo(18, 52);
    x.quadraticCurveTo(128, 100, 240, 52);
    x.fill();
    x.fillStyle = 'rgba(47,111,209,.55)';
    x.fillRect(150, 126, 34, 7);
    x.fillRect(150, 138, 26, 6);
    eye(x, 102, 118, 14, 16, 3);
    eye(x, 154, 118, 14, 16, 3);
    brow(x, 86, 96, 116, 92, 6, '#b68a2c');
    brow(x, 140, 92, 170, 96, 6, '#b68a2c');
    ell(x, 128, 144, 9, 10, '#e2ad8e');
    x.fillStyle = '#c47a52';
    [
      [106, 140],
      [114, 148],
      [100, 150],
      [146, 140],
      [152, 149],
      [140, 150],
    ].forEach(([a, b]) => {
      x.beginPath();
      x.arc(a, b, 2.6, 0, TAU);
      x.fill();
    });
    x.strokeStyle = '#7a2b2b';
    x.lineWidth = 5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(112, 172);
    x.quadraticCurveTo(134, 184, 150, 166);
    x.stroke();
  } else if (k === 2) {
    ell(x, 250, 128, 40, 52, '#e8e4dc');
    ell(x, 6, 128, 40, 52, '#e8e4dc');
    x.fillStyle = '#e8e4dc';
    x.fillRect(250, 96, 262, 70);
    x.strokeStyle = 'rgba(150,95,70,.5)';
    x.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.moveTo(92, 66 + i * 9);
      x.quadraticCurveTo(128, 58 + i * 9, 164, 66 + i * 9);
      x.stroke();
    }
    eye(x, 102, 118, 11, 9, 1);
    eye(x, 154, 118, 11, 9, 1);
    ell(x, 98, 100, 22, 9, '#f4f2ee');
    ell(x, 158, 100, 22, 9, '#f4f2ee');
    ell(x, 128, 142, 17, 19, '#e59a8a');
    ell(x, 108, 166, 26, 12, '#eeece8');
    ell(x, 148, 166, 26, 12, '#eeece8');
  } else if (k === 3) {
    x.fillStyle = '#cfcbd6';
    x.fillRect(240, 0, 272, 256);
    x.fillRect(0, 0, 18, 256);
    for (let i = 0; i < 40; i++) {
      const px = (i * 47) % 520,
        py = 14 + ((i * 13) % 50);
      ell(x, px, py, 18, 16, i % 2 ? '#cfcbd6' : '#bdb8c6');
    }
    eye(x, 100, 118, 17, 19, 2);
    eye(x, 156, 118, 17, 19, -2);
    x.strokeStyle = '#6b2d5c';
    x.lineWidth = 7;
    x.beginPath();
    x.arc(100, 118, 27, 0, TAU);
    x.stroke();
    x.beginPath();
    x.arc(156, 118, 27, 0, TAU);
    x.stroke();
    ell(x, 128, 146, 10, 11, '#e5ae98');
    ell(x, 82, 154, 15, 10, 'rgba(235,100,120,.45)');
    ell(x, 174, 154, 15, 10, 'rgba(235,100,120,.45)');
    x.fillStyle = '#5a1b2a';
    x.beginPath();
    x.moveTo(104, 166);
    x.quadraticCurveTo(128, 200, 152, 166);
    x.closePath();
    x.fill();
    x.fillStyle = '#e88a9a';
    x.beginPath();
    x.moveTo(106, 167);
    x.quadraticCurveTo(128, 176, 150, 167);
    x.closePath();
    x.fill();
  } else if (k === 4) {
    x.fillStyle = '#d9a441';
    x.fillRect(240, 0, 272, 256);
    x.fillRect(0, 0, 18, 256);
    x.fillRect(96, 0, 64, 60);
    x.fillStyle = 'rgba(200,50,40,.7)';
    x.fillRect(70, 140, 30, 7);
    x.fillRect(156, 140, 30, 7);
    eye(x, 102, 114, 14, 16, 3);
    eye(x, 154, 114, 14, 16, 3);
    brow(x, 86, 92, 116, 96, 7, '#a8741c');
    brow(x, 140, 96, 170, 92, 7, '#a8741c');
    ell(x, 128, 140, 10, 12, '#dca07c');
    x.fillStyle = '#3a1010';
    x.beginPath();
    x.moveTo(100, 162);
    x.quadraticCurveTo(128, 200, 156, 162);
    x.closePath();
    x.fill();
    x.fillStyle = '#fff';
    x.fillRect(106, 163, 18, 9);
    x.fillRect(132, 163, 18, 9);
    x.fillStyle = '#d9a441';
    x.beginPath();
    x.moveTo(96, 190);
    x.lineTo(128, 250);
    x.lineTo(160, 190);
    x.quadraticCurveTo(128, 205, 96, 190);
    x.fill();
  } else if (k === 12) {
    // Feuerfass: soot on the cheeks, singed bushy brows, wild wide eyes, a gap-toothed grin, a black beard
    x.fillStyle = '#2b2420';
    x.fillRect(238, 0, 274, 256);
    x.fillRect(0, 0, 20, 256);
    ell(x, 80, 142, 22, 13, 'rgba(40,36,34,.55)');
    ell(x, 182, 128, 16, 10, 'rgba(40,36,34,.5)');
    ell(x, 70, 150, 13, 9, 'rgba(230,110,90,.35)');
    ell(x, 186, 150, 13, 9, 'rgba(230,110,90,.35)');
    eye(x, 100, 112, 17, 18, 3);
    eye(x, 156, 112, 15, 16, -1);
    brow(x, 78, 86, 120, 92, 13, '#231d1a');
    brow(x, 178, 84, 138, 92, 13, '#231d1a');
    x.fillStyle = '#e8763a';
    [
      [84, 84],
      [100, 82],
      [170, 82],
    ].forEach(([a, b]) => {
      x.beginPath();
      x.arc(a, b, 3, 0, TAU);
      x.fill();
    }); // glowing singed hairs
    ell(x, 128, 140, 13, 15, '#d59a76');
    x.fillStyle = '#2b2420';
    x.beginPath();
    x.moveTo(46, 136);
    x.quadraticCurveTo(54, 236, 128, 254);
    x.quadraticCurveTo(202, 236, 210, 136);
    x.quadraticCurveTo(170, 154, 128, 152);
    x.quadraticCurveTo(86, 154, 46, 136);
    x.fill();
    ell(x, 128, 176, 30, 15, '#3a1010');
    x.fillStyle = '#fff6e0';
    x.fillRect(102, 164, 20, 9);
    x.fillRect(132, 164, 22, 9);
    x.fillStyle = '#f2c14e';
    x.fillRect(122, 164, 8, 8); // a gold tooth in the gap
  } else if (k === 13) {
    // Fallenleger: grey hair over the ears, little round glasses, a sly squint, a big grey walrus moustache, a red nose
    ell(x, 250, 128, 42, 56, '#dcd8d0');
    ell(x, 6, 128, 42, 56, '#dcd8d0');
    x.fillStyle = '#dcd8d0';
    x.fillRect(250, 92, 262, 76);
    x.strokeStyle = 'rgba(150,95,70,.45)';
    x.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      x.beginPath();
      x.moveTo(94, 70 + i * 9);
      x.quadraticCurveTo(128, 62 + i * 9, 162, 70 + i * 9);
      x.stroke();
    }
    eye(x, 102, 116, 12, 8, 4);
    eye(x, 154, 116, 12, 8, 4);
    brow(x, 84, 98, 120, 104, 9, '#f2f0ea');
    brow(x, 172, 98, 136, 102, 9, '#f2f0ea');
    x.strokeStyle = '#6a5a2a';
    x.lineWidth = 5;
    [102, 154].forEach(cx => {
      x.beginPath();
      x.arc(cx, 116, 21, 0, TAU);
      x.stroke();
    });
    x.beginPath();
    x.moveTo(123, 114);
    x.quadraticCurveTo(128, 108, 133, 114);
    x.stroke();
    ell(x, 128, 140, 15, 16, '#e0857a');
    x.fillStyle = '#ecebe6';
    x.beginPath();
    x.moveTo(84, 172);
    x.quadraticCurveTo(100, 146, 128, 156);
    x.quadraticCurveTo(156, 146, 172, 172);
    x.quadraticCurveTo(150, 166, 128, 172);
    x.quadraticCurveTo(106, 166, 84, 172);
    x.fill();
    x.strokeStyle = '#7a2b2b';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(114, 186);
    x.quadraticCurveTo(130, 194, 146, 182);
    x.stroke();
  } else if (KINDS[k] && KINDS[k].worm) {
    x.fillStyle = '#c9a164';
    x.fillRect(0, 0, 512, 256);
    ell(x, 128, 128, 112, 104, '#b68f58');
    ell(x, 128, 132, 78, 72, '#3a0d0d');
    ell(x, 128, 136, 44, 40, '#140404');
    x.fillStyle = '#f3ead2';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU,
        r1 = 76,
        r2 = 52;
      x.beginPath();
      x.moveTo(128 + Math.cos(a - 0.12) * r1, 132 + Math.sin(a - 0.12) * r1);
      x.lineTo(128 + Math.cos(a) * r2, 132 + Math.sin(a) * r2);
      x.lineTo(128 + Math.cos(a + 0.12) * r1, 132 + Math.sin(a + 0.12) * r1);
      x.fill();
    }
    x.strokeStyle = '#8d6a3f';
    x.lineWidth = 10;
    [0, 1, 2].forEach(i => {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      x.beginPath();
      x.moveTo(128 + Math.cos(a) * 80, 132 + Math.sin(a) * 76);
      x.lineTo(128 + Math.cos(a) * 118, 132 + Math.sin(a) * 110);
      x.stroke();
    });
  } else if (KINDS[k] && KINDS[k].bear) {
    x.fillStyle = '#f3f1ea';
    x.fillRect(0, 0, 512, 256);
    ell(x, 128, 160, 46, 36, '#e6e2d6');
    eye(x, 100, 112, 10, 11, 1);
    eye(x, 156, 112, 10, 11, -1);
    brow(x, 84, 92, 114, 98, 6, '#bdb6a6');
    brow(x, 172, 92, 142, 98, 6, '#bdb6a6');
    ell(x, 128, 146, 18, 13, '#1c1c1c');
    x.strokeStyle = '#1c1c1c';
    x.lineWidth = 5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(128, 156);
    x.lineTo(128, 172);
    x.moveTo(108, 178);
    x.quadraticCurveTo(128, 190, 148, 178);
    x.stroke();
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(112, 180);
    x.lineTo(117, 192);
    x.lineTo(121, 182);
    x.fill();
    x.beginPath();
    x.moveTo(144, 180);
    x.lineTo(139, 192);
    x.lineTo(135, 182);
    x.fill();
  } else {
    ell(x, 250, 128, 40, 52, '#e8e4dc');
    ell(x, 6, 128, 40, 52, '#e8e4dc');
    x.fillStyle = '#e8e4dc';
    x.fillRect(250, 96, 262, 70);
    x.fillStyle = '#16161c';
    rrect(x, 70, 100, 52, 32, 8);
    rrect(x, 134, 100, 52, 32, 8);
    x.fillRect(118, 106, 20, 6);
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.fillRect(78, 106, 14, 5);
    x.fillRect(142, 106, 14, 5);
    ell(x, 128, 146, 12, 14, '#dda08a');
    x.fillStyle = '#3a1010';
    x.beginPath();
    x.moveTo(98, 166);
    x.quadraticCurveTo(128, 196, 158, 166);
    x.closePath();
    x.fill();
    x.fillStyle = '#fff';
    x.fillRect(104, 167, 48, 8);
    x.fillStyle = '#f2c14e';
    x.fillRect(136, 167, 10, 8);
    ell(x, 128, 210, 18, 22, '#e8e4dc');
  }
  FACE_CANVAS[k] = c;
  return c;
}
function portrait(k) {
  const fc = FACE_CANVAS[k] || drawFace(k),
    c = cnv(128, 128),
    x = c.getContext('2d');
  x.save();
  x.beginPath();
  x.arc(64, 64, 62, 0, TAU);
  x.clip();
  x.fillStyle = FAC[KINDS[k].fac].css;
  x.fillRect(0, 0, 128, 128);
  x.drawImage(fc, 18, 20, 220, 220, 6, 8, 116, 116);
  if (k === 0) {
    x.fillStyle = '#9aa3ad';
    x.beginPath();
    x.arc(64, 44, 50, Math.PI, 0);
    x.fill();
    x.fillStyle = '#f3ead2';
    x.beginPath();
    x.moveTo(16, 40);
    x.lineTo(2, 4);
    x.lineTo(28, 30);
    x.fill();
    x.beginPath();
    x.moveTo(112, 40);
    x.lineTo(126, 4);
    x.lineTo(100, 30);
    x.fill();
  }
  if (k === 2) {
    x.fillStyle = '#6b6157';
    x.beginPath();
    x.ellipse(64, 34, 52, 22, 0, Math.PI, 0);
    x.fill();
    x.fillRect(20, 30, 90, 10);
  }
  if (k === 5) {
    x.fillStyle = '#d23a2e';
    x.beginPath();
    x.ellipse(64, 36, 54, 30, 0, Math.PI, 0);
    x.fill();
    x.fillStyle = '#fff';
    x.fillRect(56, 8, 16, 26);
  }
  if (k === 4) {
    x.fillStyle = '#9aa3ad';
    x.beginPath();
    x.arc(64, 42, 48, Math.PI, 0);
    x.fill();
    x.fillStyle = '#c0392b';
    x.fillRect(58, -2, 12, 30);
  }
  if (k === 12) {
    // the powder keg he wears as a helmet: staves, two iron hoops, a red band with a painted flame, a smouldering wick; brass goggles
    x.fillStyle = '#9a5f2c';
    x.beginPath();
    x.moveTo(24, 44);
    x.quadraticCurveTo(18, 18, 30, -4);
    x.lineTo(98, -4);
    x.quadraticCurveTo(110, 18, 104, 44);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(70,40,18,.55)';
    x.lineWidth = 2;
    [44, 64, 84].forEach(cx => {
      x.beginPath();
      x.moveTo(cx, -4);
      x.quadraticCurveTo(cx + (cx - 64) * 0.12, 20, cx, 44);
      x.stroke();
    }); // the staves
    x.fillStyle = '#c0392b';
    x.fillRect(20, 16, 88, 12);
    x.fillStyle = '#ffd34d';
    x.beginPath();
    x.moveTo(58, 28);
    x.quadraticCurveTo(52, 20, 60, 12);
    x.quadraticCurveTo(62, 18, 66, 16);
    x.quadraticCurveTo(74, 22, 68, 28);
    x.closePath();
    x.fill(); // the flame on the band
    x.fillStyle = '#4a4f57';
    x.fillRect(21, 6, 86, 5);
    x.fillRect(22, 36, 84, 5); // the hoops
    x.strokeStyle = '#d8c08a';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(88, 6);
    x.quadraticCurveTo(100, 0, 104, 12);
    x.stroke(); // the wick ...
    x.fillStyle = '#ff9a2a';
    x.beginPath();
    x.arc(105, 14, 5, 0, TAU);
    x.fill(); // ... its ember
    x.strokeStyle = '#c99a3a';
    x.lineWidth = 5;
    [44, 84].forEach(cx => {
      x.fillStyle = '#2a5a46';
      x.beginPath();
      x.arc(cx, 48, 11, 0, TAU);
      x.fill();
      x.stroke();
    }); // the brass blast goggles
    x.fillStyle = '#5a3a1e';
    x.fillRect(55, 45, 18, 5);
  }
  if (k === 13) {
    // the old trapper's fur cap: a fur drum with a fluffy rim and ear flaps, the striped raccoon tail peeking out at the side
    x.fillStyle = '#8a7a66';
    for (let i = 0; i < 5; i++) {
      x.fillStyle = i % 2 ? '#2e2620' : '#8a7a66';
      x.beginPath();
      x.ellipse(110 + i * 3, 30 + i * 13, 11 - i, 8, 0.5, 0, TAU);
      x.fill();
    } // the raccoon tail
    x.fillStyle = '#6e5236';
    x.beginPath();
    x.moveTo(20, 40);
    x.lineTo(24, 6);
    x.quadraticCurveTo(64, -10, 104, 6);
    x.lineTo(108, 40);
    x.closePath();
    x.fill();
    x.fillStyle = '#5c4430';
    [-1, 1].forEach(sd => {
      x.beginPath();
      x.ellipse(64 + sd * 50, 62, 12, 26, sd * -0.18, 0, TAU);
      x.fill();
    }); // the ear flaps
    x.fillStyle = '#c9ae84';
    for (let i = 0; i < 11; i++) {
      x.beginPath();
      x.arc(18 + i * 9.2, 40 + (i % 2) * 2, 7.5, 0, TAU);
      x.fill();
    } // the fluffy rim
    [-1, 1].forEach(sd => {
      x.beginPath();
      x.arc(64 + sd * 52, 86, 8, 0, TAU);
      x.fill();
    });
    x.fillStyle = '#eceae4';
    for (const [bx, by, br] of [
      [64, 112, 17],
      [48, 106, 12],
      [80, 106, 12],
      [56, 120, 11],
      [72, 120, 11],
    ]) {
      x.beginPath();
      x.arc(bx, by, br, 0, TAU);
      x.fill();
    } // the white beard (under the moustache)
  }
  if (KINDS[k].bear) {
    [
      [26, 22],
      [102, 22],
    ].forEach(([a, b]) => {
      x.fillStyle = '#f3f1ea';
      x.beginPath();
      x.arc(a, b, 18, 0, TAU);
      x.fill();
      x.fillStyle = '#d8cfc0';
      x.beginPath();
      x.arc(a, b, 9, 0, TAU);
      x.fill();
    });
  }
  x.restore();
  x.strokeStyle = 'rgba(0,0,0,.35)';
  x.lineWidth = 4;
  x.beginPath();
  x.arc(64, 64, 61, 0, TAU);
  x.stroke();
  return c.toDataURL();
}
const PORTRAIT = KINDS.map((_, k) => portrait(k));
function flagCanvas(owner, facs) {
  const c = cnv(128, 84),
    x = c.getContext('2d'),
    fac = owner < 0 ? null : facs[owner];
  x.fillStyle = !fac ? '#eceae4' : fac === 'viking' ? '#3b6ea5' : '#b0699c';
  x.fillRect(0, 0, 128, 84);
  x.fillStyle = !fac ? '#bfbcb2' : '#fff';
  x.strokeStyle = x.fillStyle;
  x.lineWidth = 8;
  x.lineCap = 'round';
  if (!fac) {
    x.beginPath();
    x.arc(64, 42, 16, 0, TAU);
    x.fill();
  } else if (fac === 'viking') {
    x.beginPath();
    x.moveTo(40, 66);
    x.lineTo(88, 18);
    x.moveTo(88, 66);
    x.lineTo(40, 18);
    x.stroke();
    x.beginPath();
    x.moveTo(80, 12);
    x.quadraticCurveTo(102, 22, 96, 36);
    x.lineTo(84, 24);
    x.fill();
    x.beginPath();
    x.moveTo(48, 12);
    x.quadraticCurveTo(26, 22, 32, 36);
    x.lineTo(44, 24);
    x.fill();
  } else {
    x.beginPath();
    x.rect(40, 32, 40, 32);
    x.fill();
    x.lineWidth = 6;
    x.beginPath();
    x.arc(84, 47, 9, -Math.PI / 2, Math.PI / 2);
    x.stroke();
    x.lineWidth = 4;
    [50, 60, 70].forEach(sx => {
      x.beginPath();
      x.moveTo(sx, 26);
      x.quadraticCurveTo(sx + 6, 20, sx, 12);
      x.stroke();
    });
  }
  return c;
}
function textCanvas(text, opt = {}) {
  const fs = opt.size || 64,
    pad = opt.pad || 22;
  const font = `${fs}px "Lilita One", "Trebuchet MS", sans-serif`;
  const c = cnv(8, 8),
    x = c.getContext('2d');
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + pad * 2,
    h = fs + pad * 2;
  c.width = w;
  c.height = h + (opt.tail ? 18 : 0);
  const y = c.getContext('2d');
  y.font = font;
  y.textAlign = 'center';
  y.textBaseline = 'middle';
  if (opt.bubble) {
    y.fillStyle = '#fff';
    y.strokeStyle = '#1d1a24';
    y.lineWidth = 5;
    y.beginPath();
    y.roundRect ? y.roundRect(4, 4, w - 8, h - 8, 26) : y.rect(4, 4, w - 8, h - 8);
    y.fill();
    y.stroke();
    if (opt.tail) {
      y.beginPath();
      y.moveTo(w / 2 - 14, h - 6);
      y.lineTo(w / 2, h + 14);
      y.lineTo(w / 2 + 14, h - 6);
      y.fill();
      y.stroke();
      y.fillRect(w / 2 - 12, h - 10, 24, 6);
    }
    y.fillStyle = '#1d1a24';
    y.fillText(text, w / 2, h / 2 + 3);
  } else {
    y.lineWidth = 12;
    y.strokeStyle = '#1d1a24';
    y.lineJoin = 'round';
    y.strokeText(text, w / 2, h / 2 + 3);
    y.fillStyle = opt.color || '#f2c14e';
    y.fillText(text, w / 2, h / 2 + 3);
  }
  return c;
}
