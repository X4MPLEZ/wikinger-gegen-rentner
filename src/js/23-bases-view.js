/* 23-bases-view.js - The two bases (longhouse / old people's home) with their towers: buildBases(facs). */
/* ---------- bases ---------- */
const baseViews = [];
function houseFront(withDoor) {
  const c = cnv(512, 220),
    x = c.getContext('2d');
  x.fillStyle = '#efe2c6';
  x.fillRect(0, 0, 512, 220);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 6; i++) {
      const wx = 22 + i * 82,
        wy = 22 + row * 100;
      if (withDoor && row === 1 && (i === 2 || i === 3)) continue;
      x.fillStyle = '#6f8299';
      x.fillRect(wx, wy, 56, 58);
      x.fillStyle = '#c9dfee';
      x.fillRect(wx + 5, wy + 5, 46, 48);
      x.fillStyle = '#6f8299';
      x.fillRect(wx + 26, wy + 5, 4, 48);
      x.fillStyle = '#7a4a2a';
      x.fillRect(wx - 4, wy + 58, 64, 10);
      for (let f = 0; f < 5; f++) ell(x, wx + 4 + f * 12, wy + 56, 6, 6, f % 2 ? '#e5546a' : '#f2a3c0');
    }
  if (withDoor) {
    x.fillStyle = '#6b4a35';
    x.fillRect(214, 132, 84, 88);
    x.fillStyle = '#8a6448';
    x.fillRect(220, 138, 34, 82);
    x.fillRect(258, 138, 34, 82);
    x.fillStyle = '#2f4f39';
    x.fillRect(168, 98, 176, 28);
    x.font = '22px "Lilita One", sans-serif';
    x.fillStyle = '#f6f1e7';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(TR('HAUS ABENDROT'), 256, 113);
  }
  return c;
}
function buildLonghouse(g) {
  mesh(new THREE.BoxGeometry(14.5, 1.4, 8.5), lam(0x8a8577), 0, -0.3, 0, g);
  mesh(new THREE.BoxGeometry(12, 2.6, 6), lam(0x7a4e2d), 0, 1.7, 0, g);
  for (let i = -5; i <= 5; i++) mesh(new THREE.BoxGeometry(0.12, 2.6, 6.04), lam(0x5f3b21), i * 1.1, 1.7, 0, g);
  mesh(flat(new THREE.CylinderGeometry(3.8, 3.8, 12.8, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2)), lam(0x5c4a36), 0, 4.8, 0, g);
  [-1, 1].forEach(s => {
    const n = mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6), lam(0x6b4423), s * 6.5, 7.1, 0, g);
    n.rotation.z = -s * 0.5;
    const hd = mesh(flat(new THREE.ConeGeometry(0.42, 1.1, 5)), lam(0x6b4423), s * 7.15, 8.25, 0, g);
    hd.rotation.z = -s * 1.5;
  });
  const sg = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16).rotateX(Math.PI / 2);
  [0xc0392b, 0xf1ead6, 0x2f5f8f, 0xf1ead6, 0xc0392b].forEach((c, i) => mesh(sg, lam(c), -4.4 + i * 2.2, 2.1, 3.08, g));
  mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), lam(0x3a2414), 0, 1.5, 3.06, g);
  [-1.6, 1.6].forEach(px => {
    mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 5), lam(0x4a2f1c), px, 1.2, 3.6, g);
    mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: lin(0xffa53a) }), px, 2.1, 3.6, g);
  });
}
function buildHome(g) {
  mesh(new THREE.BoxGeometry(14.5, 1.4, 9.5), lam(0xb9b2a3), 0, -0.3, 0, g);
  const wall = lam(0xefe2c6),
    front = new THREE.MeshLambertMaterial({ map: ctex(houseFront(true)) }),
    back = new THREE.MeshLambertMaterial({ map: ctex(houseFront(false)) });
  mesh(new THREE.BoxGeometry(12, 5.2, 6), [wall, wall, wall, wall, front, back], 0, 2.8, 0, g);
  mesh(new THREE.BoxGeometry(12.6, 0.5, 6.6), lam(0xb5523b), 0, 5.65, 0, g);
  mesh(new THREE.BoxGeometry(0.9, 1.6, 0.9), lam(0x8d3e2f), 4.6, 6.7, -1.8, g);
  [-4.6, 4.6].forEach(bx => {
    mesh(new THREE.BoxGeometry(2.2, 0.15, 0.6), lam(0x8a5a35), bx, 0.85, 4.1, g);
    mesh(new THREE.BoxGeometry(2.2, 0.6, 0.12), lam(0x8a5a35), bx, 1.2, 3.8, g);
  });
  [-2.4, 2.4].forEach(px => {
    mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 10), lam(0xb5523b), px, 0.7, 4.0, g);
    mesh(new THREE.SphereGeometry(0.5, 10, 8), lam(0xe5546a), px, 1.25, 4.0, g);
  });
}
function buildTower(g) {
  const t = new THREE.Group();
  t.position.set(5.2, 0, 4.6);
  g.add(t);
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([a, b]) => mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 6), lam(0x5f3b21), a * 1.05, 2.6, b * 1.05, t));
  [1.4, 3].forEach(y => {
    mesh(new THREE.BoxGeometry(2.3, 0.12, 0.12), lam(0x6f4527), 0, y, 1.05, t);
    mesh(new THREE.BoxGeometry(2.3, 0.12, 0.12), lam(0x6f4527), 0, y, -1.05, t);
  });
  mesh(new THREE.BoxGeometry(2.8, 0.25, 2.8), lam(0x7a4e2d), 0, 5.2, 0, t);
  [
    [0, 1.35, 2.8, 0.12],
    [0, -1.35, 2.8, 0.12],
    [1.35, 0, 0.12, 2.8],
    [-1.35, 0, 0.12, 2.8],
  ].forEach(([x, z, w, d]) => mesh(new THREE.BoxGeometry(w, 0.7, d), lam(0x6f4527), x, 5.65, z, t));
  const roof = mesh(flat(new THREE.ConeGeometry(2.2, 1.4, 4)), lam(0x5c4a36), 0, 9.1, 0, t);
  roof.rotation.y = Math.PI / 4;
  [-1, 1].forEach(a => [-1, 1].forEach(b => mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 5), lam(0x5f3b21), a * 1.2, 6.9, b * 1.2, t)));
  return { parent: t, x: 0, z: 0, y: 5.33 };
}
function buildBalcony(g) {
  const t = new THREE.Group();
  t.position.set(0, 0, 0.8);
  g.add(t);
  mesh(new THREE.BoxGeometry(4.2, 0.2, 2.6), lam(0x8a5a35), 0, 6.0, 0, t);
  [
    [0, 1.25, 4.2, 0.1],
    [2.05, 0, 0.1, 2.6],
    [-2.05, 0, 0.1, 2.6],
  ].forEach(([x, z, w, d]) => mesh(new THREE.BoxGeometry(w, 0.55, d), lam(0xefe2c6), x, 6.35, z, t));
  const um = mesh(
    new THREE.ConeGeometry(1.4, 0.6, 10, 1, true),
    new THREE.MeshLambertMaterial({ color: lin(0xe5546a), side: THREE.DoubleSide }),
    -1.5,
    9.4,
    -0.7,
    t
  );
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.3, 5), lam(0xdddddd), -1.5, 7.75, -0.7, t);
  um.rotation.z = 0.08;
  mesh(new THREE.BoxGeometry(0.7, 0.08, 1.2), lam(0x3f8bc4), -1.5, 6.5, -0.4, t);
  return { parent: t, x: 0.7, z: 0.2, y: 6.1 };
}
function buildBases(facs) {
  baseViews.forEach(b => {
    scene.remove(b.g);
    b.g.traverse(o => {
      if (o.userData.ownedGeometry && o.geometry) o.geometry.dispose();
    });
    if (b.shooter) hpGroup.remove(b.shooter.hp);
    if (b.bar) {
      scene.remove(b.bar);
      b.bar.material.map.dispose();
      b.bar.material.dispose();
    }
  });
  baseViews.length = 0;
  BASES.forEach((B, i) => {
    const g = new THREE.Group();
    g.position.set(B.x, sampleH(MAP, B.x, B.z), B.z);
    g.rotation.y = i === 0 ? Math.PI : 0;
    const vik = facs[i] === 'viking';
    vik ? buildLonghouse(g) : buildHome(g);
    const perch = vik ? buildTower(g) : buildBalcony(g);
    const orig = g.clone(true),
      path = [];
    for (let o = perch.parent; o && o !== g; o = o.parent) path.unshift(o.parent.children.indexOf(o)); // unbaked copy: the collapse needs the real planks
    const sh = Object.assign(buildUnit(vik ? 1 : 3), { wob: 0, wobV: 0, atkT: 9, walk: 0, speed: 0, flash: 0, cdA: CFG.towerCd });
    scene.remove(sh.g);
    sh.g.position.set(perch.x, perch.y, perch.z);
    perch.parent.add(sh.g);
    if (sh.blob) sh.blob.visible = false;
    bakeTree(g, new Set(), { nocache: true, skip: new Set([sh.g]) });
    shadows(g, true, true);
    inkify(g);
    scene.add(g);
    baseViews.push({ g, shake: 0, smokeT: 0, y: g.position.y, shooter: sh, orig, perchPath: path });
  });
}
