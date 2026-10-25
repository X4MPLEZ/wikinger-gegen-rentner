/* 73-deaths.js - DEATHS: several death animations per unit (startDeath/deathTick), weapons and rollators fly off, catapults shatter, the rising ghost. */
const DIE_DRAMA = {
  viking: [
    TR('Walhalla … ich komme …'),
    TR('Rächt mich, Brüder!'),
    TR('Sagt meiner Ziege … ich hab sie geliebt …'),
    TR('Es wird so dunkel …'),
    TR('Nicht … so …'),
  ],
  rentner: [
    TR('Mein Gebiss … nehmt es …'),
    TR('Das war mein letzter Kaffee …'),
    TR('Sagt meinem Dackel … Lebewohl …'),
    TR('Früher … war alles … besser …'),
    TR('Ich will … meine Rente …'),
  ],
};
function dropPart(obj, vx, vy, vz, spin) {
  if (!obj || !obj.parent) return;
  ubDetach(obj);
  scene.attach(obj);
  fx.debris.push({ m: obj, vx, vy, vz, rx: (Math.random() - 0.5) * spin, rz: (Math.random() - 0.5) * spin, t: 0, delay: 0 });
}
function breakCatapult(u) {
  const c = u.g.position.clone();
  c.y += 1;
  [...u.rig.children].forEach(ch => {
    if (!ch.isMesh && !ch.children.length) return;
    const wp = new THREE.Vector3();
    ch.getWorldPosition(wp);
    const d = wp.sub(c);
    const l = Math.hypot(d.x, d.z) || 1,
      pw = 3 + Math.random() * 6;
    dropPart(ch, (d.x / l) * pw + (Math.random() - 0.5) * 2, 4 + Math.random() * 7, (d.z / l) * pw + (Math.random() - 0.5) * 2, 16);
  });
  for (let k = 0; k < 10; k++)
    puff(c.x + (Math.random() - 0.5) * 3, c.y + Math.random() * 1.5, c.z + (Math.random() - 0.5) * 3, k % 2 ? 0x9a7b56 : 0xd8c48f, 1, 1.2);
  u.g.visible = false;
  SFX.play('splinter', { x: c.x, z: c.z });
  word(pick([TR('KRACH!'), TR('KAPUTT!'), TR('SPLITTER!')]), c.x, c.y + 3, c.z, { color: '#ffb347', scale: 1.3 });
}
// The little ghost that rises from a fallen warrior. Geometry and the eye/halo materials are shared by all ghosts; each ghost has only
// its own fading body material, freed again in ghostDrop (one ghost per death: nothing may pile up on the GPU in a long match).
const GHOST = {};
function ghostMesh() {
  if (!GHOST.head) {
    GHOST.head = new THREE.SphereGeometry(0.42, 14, 10);
    GHOST.body = new THREE.ConeGeometry(0.42, 0.9, 14, 1, true);
    GHOST.eye = new THREE.SphereGeometry(0.06, 8, 6);
    GHOST.halo = new THREE.TorusGeometry(0.3, 0.045, 6, 20).rotateX(Math.PI / 2);
    GHOST.eyeM = new THREE.MeshBasicMaterial({ color: 0x222222 });
    GHOST.haloM = new THREE.MeshBasicMaterial({ color: 0xffd75e });
  }
  const g = new THREE.Group(),
    m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false });
  mesh(GHOST.head, m, 0, 0.55, 0, g);
  const b = mesh(GHOST.body, m, 0, 0.05, 0, g);
  b.rotation.x = Math.PI;
  [-1, 1].forEach(sx => mesh(GHOST.eye, GHOST.eyeM, sx * 0.14, 0.62, 0.36, g));
  mesh(GHOST.halo, GHOST.haloM, 0, 1.15, 0, g);
  g.userData.m = m;
  return g;
}
function ghostDrop(u) {
  if (!u.ghost) return;
  scene.remove(u.ghost);
  u.ghost.userData.m.dispose();
  u.ghost = null;
}
function startDeath(u, cause) {
  const x = u.g.position.x,
    y = u.g.position.y,
    z = u.g.position.z,
    yaw = u.g.rotation.y,
    fx2 = Math.sin(yaw),
    fz2 = Math.cos(yaw),
    fac = KINDS[u.k].fac;
  u.rag = null;
  u.side = Math.random() < 0.5 ? -1 : 1;
  u.dieFx = {};
  if (u.fuseRing) fuseRingDrop(u);
  if (u.arm) {
    u.dv = 'gone';
    breakCatapult(u);
    return;
  }
  if (u.worm) {
    u.dv = 'worm';
    (u.wP || (u.wP = { ws: 'up', st: 0 })).dieT = 0;
    SFX.play('wormRoar', { x, z, vol: 0.8 });
    return;
  } // writhes and sinks into the sand
  if (cause === 4) {
    u.dv = 'gone';
    u.g.visible = false;
    return;
  } // swallowed
  if (u.hen) {
    // a chicken of the Hühnerarmee: gone in a cloud of feathers
    u.dv = 'gone';
    u.g.visible = false;
    puff(x, y + 0.7, z, 0xffffff, 9, 0.9);
    if (Math.random() < 0.4) SFX.play('chicken', { x, z, vol: 0.5 });
    return;
  }
  if (cause === 5 || cause === 6) {
    // blown up: charred black (white eyes blinking), flung high, smoking (5: the Feuerfass himself, 6: caught in a blast)
    u.dv = 'blown';
    charBody(u);
    if (u.barrel) u.barrel.visible = false; // the barrel is the bang
    if (!u.deadAir) u.deadAir = { vx: (Math.random() - 0.5) * 3, vy: 9, vz: (Math.random() - 0.5) * 3 };
    if (u.hat) dropPart(u.hat, (Math.random() - 0.5) * 6, 11 + Math.random() * 4, (Math.random() - 0.5) * 6, 22);
    if (u.trap && u.trap.visible) dropPart(u.trap, (Math.random() - 0.5) * 5, 7, (Math.random() - 0.5) * 5, 18);
    setTimeout(() => SFX.play(fac === 'rentner' ? 'dieR' : 'dieV', { x, z, k: u.k, vol: 0.8 }), 120);
    return;
  }
  if (cause === 3) u.dv = 'fall';
  else if (cause === 1) u.dv = 'squash';
  else {
    const r = Math.random(),
      cavD = u.k === 4 || u.k === 5;
    u.dv =
      u.isPoss && r < 0.45
        ? 'drama'
        : r < 0.22
          ? 'back'
          : r < 0.4
            ? 'face'
            : r < 0.55
              ? 'stiff'
              : r < 0.72
                ? 'drama'
                : r < 0.85
                  ? cavD
                    ? 'back'
                    : 'face'
                  : 'ghost';
  }
  const out = 2.5 + Math.random() * 2.5;
  (u.drops || []).forEach(d =>
    dropPart(d, (Math.random() - 0.5) * out - fx2 * 1.5, 3 + Math.random() * 3.5, (Math.random() - 0.5) * out - fz2 * 1.5, 12)
  );
  if (u.drops && u.drops.length) setTimeout(() => SFX.play('clatter', { x, z }), 380 + Math.random() * 200);
  if (u.hat && (u.dv === 'flip' || u.dv === 'squash' || Math.random() < 0.55))
    dropPart(u.hat, (Math.random() - 0.5) * 3, 5 + Math.random() * 3, (Math.random() - 0.5) * 3, 16);
  if (u.k === 3 && Math.random() < 0.65) {
    const t = projGeo.teeth.clone();
    t.position.set(x, y + 2.3, z);
    scene.add(t);
    fx.debris.push({
      m: t,
      vx: fx2 * 3 + (Math.random() - 0.5) * 2,
      vy: 5 + Math.random() * 2,
      vz: fz2 * 3 + (Math.random() - 0.5) * 2,
      rx: 9,
      rz: 7,
      t: 0,
      delay: 0,
    });
    setTimeout(() => SFX.play('chomp', { x, z }), 500);
  }
  if (u.rol) {
    u.rig.attach(u.stand);
    ubDetach(u.rol);
    scene.attach(u.rol);
    const sp = 5 + Math.random() * 4;
    fx.debris.push({ m: u.rol, roll: true, vx: fx2 * sp, vz: fz2 * sp, t: 0, delay: 0, tip: u.side, yaw });
    SFX.play('horn', { x, z, vol: 0.6 });
  }
  const vo = fac === 'rentner' ? 'dieR' : 'dieV';
  if (u.dv === 'fall' && u.fallY === undefined) {
    word(pick([TR('AAAAH!'), TR('NEEEIN!'), TR('HILFEEE!')]), x, y + 2.5, z, { color: '#ffffff', scale: 1 });
    SFX.play('whoosh', { x, z });
    setTimeout(() => SFX.play('crash', { x, z, vol: 0.6 }), 650);
  } else if (u.dv === 'squash') {
    word(TR('PLATT!'), x, y + 1.5, z, { color: '#ffffff', scale: 1.2 });
    SFX.play('squish', { x, z });
  } else if (u.dv === 'drama') {
    word(pick(DIE_DRAMA[fac]), x, y + 4, z, { bubble: true, follow: u });
    SFX.play('drama', { x, z, k: u.k });
  } else if (u.dv === 'flip') {
    SFX.play(vo, { x, z, k: u.k });
    SFX.play('whoosh', { x, z, vol: 0.5 });
  } else if (u.dv === 'ghost') {
    SFX.play(vo, { x, z, k: u.k });
    setTimeout(() => SFX.play('ghost', { x, z }), 600);
  } else SFX.play(vo, { x, z, k: u.k });
}
function deathTick(u, dt) {
  const t = u.dieT,
    r = u.rig,
    L = u.armL,
    R = u.armR,
    dv = u.dv,
    F = u.dieFx;
  if (dv === 'gone') return t > 0.05;
  if (dv === 'worm') {
    u.wP.dieT = t;
    wormRig(u, dt, false);
    if (Math.random() < dt * 14) wormSand(u.g.position.x, u.g.position.z, 1, 2.2, 1);
    return t > 1.8;
  }
  if (u.foreL) {
    const q = Math.min(1, t * 4);
    u.foreL.rotation.x = lerp(u.foreL.rotation.x, -0.35 + Math.sin(t * 16) * 0.2 * Math.max(0, 1 - t), q * 0.3);
    u.foreR.rotation.x = lerp(u.foreR.rotation.x, -0.5 + Math.cos(t * 14) * 0.2 * Math.max(0, 1 - t), q * 0.3);
  }
  if (u.shinL) {
    u.shinL.rotation.x = lerp(u.shinL.rotation.x, 0.25 + Math.max(0, Math.sin(t * 22)) * 0.4 * Math.max(0, 1.2 - t), 0.25);
    u.shinR.rotation.x = lerp(u.shinR.rotation.x, 0.1 + Math.max(0, Math.cos(t * 20)) * 0.35 * Math.max(0, 1.2 - t), 0.25);
  }
  const sink = (from, end) => {
    if (t > from) u.g.position.y -= dt * 1.3;
    return t > end;
  };
  if (dv === 'back' || dv === 'ghost') {
    const p = Math.min(1, t / 0.42);
    r.rotation.x = (-p * p * Math.PI) / 2;
    r.position.z = -p * 0.7;
    r.position.y = 0.25 * p + Math.sin(p * Math.PI) * 0.45;
    if (t > 0.42 && t < 0.62) r.position.y += Math.sin(((t - 0.42) / 0.2) * Math.PI) * 0.12;
    L.rotation.x = -2.2 * p;
    R.rotation.x = -2.4 * p;
    if (u.legL) {
      u.legL.rotation.x = 0.5 * p;
      u.legR.rotation.x = -0.3 * p;
    }
    u.neck.rotation.z = Math.sin(t * 18) * 0.35 * Math.max(0, 1 - t);
    if (dv === 'ghost') {
      if (t > 0.5 && !u.ghost) {
        u.ghost = ghostMesh();
        u.ghost.position.copy(u.g.position);
        u.ghost.position.y += 0.6;
        scene.add(u.ghost);
      }
      if (u.ghost) {
        const q = t - 0.5;
        u.ghost.position.y += dt * 1.6;
        u.ghost.position.x += Math.sin(q * 5) * dt * 0.8;
        u.ghost.rotation.y += dt * 1.5;
        u.ghost.userData.m.opacity = Math.max(0, 0.65 * (1 - q / 1.9));
      }
      return sink(1.6, 2.5);
    }
    return sink(1.1, 2.0);
  }
  if (dv === 'face') {
    const p = Math.min(1, t / 0.45);
    r.rotation.x = (p * p * Math.PI) / 2;
    r.position.z = p * 0.6;
    r.position.y = 0.18 * p;
    if (t > 0.45 && t < 0.65) r.position.y += Math.sin(((t - 0.45) / 0.2) * Math.PI) * 0.1;
    L.rotation.x = -2.8 * p;
    R.rotation.x = -2.6 * p;
    L.rotation.z = -0.4 * p;
    R.rotation.z = 0.4 * p;
    if (u.legL) {
      u.legL.rotation.x = -0.3 * p;
      u.legR.rotation.x = 0.4 * p;
    }
    if (t > 0.5 && t < 1.2 && u.legL) {
      u.legL.rotation.x = -0.3 + Math.sin(t * 30) * 0.25;
    }
    return sink(1.2, 2.1);
  }
  if (dv === 'stiff') {
    const p = Math.min(1, (t / 0.55) ** 2);
    r.rotation.z = (u.side * p * Math.PI) / 2;
    L.rotation.set(0, 0, 0);
    R.rotation.set(0, 0, 0);
    if (u.legL) {
      u.legL.rotation.x = 0;
      u.legR.rotation.x = 0;
    }
    if (t >= 0.55 && !F.land) {
      F.land = 1;
      SFX.play('bonk', { x: u.g.position.x, z: u.g.position.z });
      puff(u.g.position.x, u.g.position.y + 0.2, u.g.position.z, 0xd8c48f, 4, 0.9);
      word(TR('BONK!'), u.g.position.x, u.g.position.y + 2, u.g.position.z, { color: '#ffffff', scale: 0.8 });
    }
    if (t > 0.55 && t < 0.8) r.rotation.z = u.side * (Math.PI / 2 - Math.sin(((t - 0.55) / 0.25) * Math.PI) * 0.15);
    return sink(1.4, 2.3);
  }
  if (dv === 'drama') {
    if (t < 1.05) {
      r.position.z = -Math.sin(t * 3) * 0.35;
      r.rotation.z = Math.sin(t * 7) * 0.08;
      R.rotation.x = -2.9 + Math.sin(t * 5) * 0.15;
      L.rotation.x = -1.3;
      L.rotation.z = 0.5;
      r.position.y = -0.42 * sstep(0.45, 1.0, t);
      if (u.legL) {
        const k = sstep(0.45, 1.0, t);
        u.legL.rotation.x = -1.2 * k;
        u.legR.rotation.x = -1.0 * k;
      }
      u.neck.rotation.z = Math.sin(t * 4) * 0.25;
      u.neck.rotation.x = -0.4 * Math.min(1, t * 2);
    } else {
      const q = sstep(1.05, 1.75, t);
      r.rotation.z = ((u.side * q * Math.PI) / 2) * 0.95;
      r.position.y = -0.42 * (1 - q) + 0.15 * q;
      R.rotation.x = lerp(-2.9, -1.0, q);
      if (t > 1.75 && !F.land) {
        F.land = 1;
        puff(u.g.position.x, u.g.position.y + 0.2, u.g.position.z, 0xd8c48f, 4, 0.9);
      }
    }
    return sink(2.6, 3.4);
  }
  if (dv === 'flip') {
    const air = 0.62;
    if (t < air) {
      const q = t / air;
      r.position.y = Math.sin(q * Math.PI) * 1.5;
      r.position.z = -q * 1.2;
      r.rotation.x = -q * (TAU - Math.PI / 2);
      L.rotation.x = -2.8;
      R.rotation.x = -2.6;
      if (u.legL) {
        u.legL.rotation.x = -0.9 * Math.sin(q * Math.PI);
        u.legR.rotation.x = -0.7 * Math.sin(q * Math.PI);
      }
      return false;
    }
    r.rotation.x = -(TAU - Math.PI / 2);
    r.position.y = 0.2 + Math.max(0, Math.sin(((t - air) / 0.22) * Math.PI)) * 0.15 * (t < air + 0.22 ? 1 : 0);
    r.position.z = -1.2;
    if (!F.land) {
      F.land = 1;
      SFX.play('bonk', { x: u.g.position.x, z: u.g.position.z });
      puff(u.g.position.x, u.g.position.y + 0.2, u.g.position.z, 0xd8c48f, 5, 0.9);
    }
    return sink(1.5, 2.4);
  }
  if (dv === 'fall') {
    if (u.deadAir) {
      const a = u.deadAir,
        prevY = u.g.position.y;
      a.vy -= AIR_GRAVITY * dt;
      const nx = u.g.position.x + a.vx * dt,
        nz = u.g.position.z + a.vz * dt,
        floor = unitY(nx, nz);
      if (floor <= prevY + 0.4) {
        u.g.position.x = nx;
        u.g.position.z = nz;
      } else {
        a.vx = 0;
        a.vz = 0;
      }
      u.g.position.y += a.vy * dt;
      r.rotation.x -= dt * 6;
      r.rotation.z += dt * 2.5 * u.side;
      const gy = unitY(u.g.position.x, u.g.position.z);
      if (u.g.position.y <= gy || u.g.position.y < -32) {
        u.g.position.y = Math.min(prevY, gy);
        u.deadAir = null;
      } else return t > 5;
    }
    if (!F.land) {
      F.land = 1;
      F.landT = t;
      emitFX('land', u.g.position.x, u.g.position.y + 0.15, u.g.position.z, { n: 7, size: 0.85 });
      SFX.play('crash', { x: u.g.position.x, z: u.g.position.z, vol: 0.6 });
    }
    r.rotation.x = -Math.PI / 2;
    r.rotation.z = u.side * 0.22;
    L.rotation.x = -2.8;
    R.rotation.x = -2.5;
    return sink(F.landT + 0.8, F.landT + 1.6);
  }
  if (dv === 'blown') {
    if (u.deadAir) {
      const a = u.deadAir;
      a.vy -= AIR_GRAVITY * dt;
      u.g.position.x += a.vx * dt;
      u.g.position.z += a.vz * dt;
      u.g.position.y += a.vy * dt;
      r.rotation.x -= dt * 9;
      r.rotation.z += dt * 4 * u.side;
      L.rotation.x = -2.8 + Math.sin(t * 25) * 0.4;
      R.rotation.x = -2.6 + Math.cos(t * 23) * 0.4;
      if (Math.random() < dt * 24) puff(u.g.position.x, u.g.position.y + 0.8, u.g.position.z, 0x3a3634, 1, 0.55);
      const gy = unitY(u.g.position.x, u.g.position.z);
      if (u.g.position.y <= gy && a.vy < 0) {
        u.g.position.y = gy;
        u.deadAir = null;
        F.landT = t;
        emitFX('land', u.g.position.x, gy + 0.15, u.g.position.z, { n: 8, size: 0.9, col: 0x6a625a });
        puff(u.g.position.x, gy + 0.4, u.g.position.z, 0x2a2826, 6, 0.8);
        SFX.play('crash', { x: u.g.position.x, z: u.g.position.z, vol: 0.55 });
        if (Math.random() < 0.6)
          word(pick([TR('Hust…'), TR('Autsch…'), TR('Puh…')]), u.g.position.x, gy + 2, u.g.position.z, { color: '#ffffff', scale: 0.7 });
      }
      return t > 6;
    }
    r.rotation.x = -Math.PI / 2;
    r.rotation.z = u.side * 0.18;
    L.rotation.x = -2.9;
    R.rotation.x = -2.7;
    if (Math.random() < dt * 4) puff(u.g.position.x, u.g.position.y + 0.4, u.g.position.z, 0x4a4644, 1, 0.45); // still smoking
    return sink((F.landT || t) + 1.1, (F.landT || t) + 2.0);
  }
  if (dv === 'squash') {
    const p = Math.min(1, t / 0.1),
      sx = 1.25 * (1 + 0.55 * p),
      sy = 1.25 * (1 - 0.9 * p);
    r.scale.set(sx, sy, sx);
    r.rotation.set(0, 0, 0);
    if (t > 0.1 && t < 0.4) {
      const w = Math.sin(((t - 0.1) / 0.3) * Math.PI) * 0.06;
      r.scale.y = 1.25 * (0.1 + w);
    }
    return sink(1.6, 2.4);
  }
  return t > 2;
}
