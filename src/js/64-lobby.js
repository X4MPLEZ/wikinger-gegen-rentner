/* 64-lobby.js - PUBLIC GAMES: the list "Offene Spiele" and "Schnelles Spiel" in the menu's online panel.
   A host of a public game puts a small retained entry on the public MQTT brokers (topic wvr7/lobby/v<NET_VER>/<code>, refreshed every
   15 s, cleared on start or leave, and by a last will when the host vanishes); the menu shows the fresh ones and joins with the code as usual.
   No names typed by players (the game makes them up) and no faces between strangers (NET.pub, see faceChunkPatch in 61-net.js).
   While waiting the host may practise against the computer (NET.practice); a player joining interrupts it after a short countdown. */
const LOBBY = { on: false, clients: [], list: new Map(), subAt: 0, failed: false, host: null, offT: 0 };
const LOBBY_FRESH = 50000; // an entry without a heartbeat for this long is gone
const LOBBY_NAMES = {
  rentner: ['Heinz', 'Erna', 'Gustav', 'Hilde', 'Kurt', 'Gerda', 'Horst', 'Trude', 'Willi', 'Inge', 'Egon', 'Lotte'],
  viking: ['Björn', 'Olaf', 'Sven', 'Ragnar', 'Ingrid', 'Astrid', 'Thorvald', 'Sigrid', 'Leif', 'Freya', 'Harald', 'Gunnhild'],
};
const LOBBY_MODES = ['classic', 'chaos', 'fog'];
const lobbyTopic = () => 'wvr7/lobby/v' + NET_VER + '/';
const lobbyNameIdx = () => Math.floor(Math.random() * 12) * 100 + 10 + Math.floor(Math.random() * 90); // name index * 100 + a two-digit number
function lobbyName(e) {
  const nm = LOBBY_NAMES[e.f][Math.floor(e.n / 100) % 12],
    nr = e.n % 100;
  if (e.f === 'viking') return nm + ' ' + nr;
  return (['Erna', 'Hilde', 'Gerda', 'Trude', 'Inge', 'Lotte'].includes(nm) ? 'Oma ' : 'Opa ') + nm + ' ' + nr;
}
// Entries come from anyone on a public broker: only well-formed ones are shown, and only through textContent.
function lobbyValid(d, code) {
  return (
    d &&
    d.c === code &&
    /^[0-9]{4}$/.test(code) &&
    (d.f === 'viking' || d.f === 'rentner') &&
    LOBBY_MODES.includes(d.m) &&
    Number.isInteger(d.p) &&
    d.p >= 0 &&
    d.p <= 3 &&
    Number.isInteger(d.n) &&
    d.n >= 0 &&
    d.n < 1200 &&
    Number.isFinite(d.h) &&
    Number.isFinite(d.t)
  );
}
function lobbyFresh() {
  const out = [];
  for (const [code, o] of LOBBY.list) {
    if (now() - o.seen > LOBBY_FRESH) {
      LOBBY.list.delete(code);
      continue;
    }
    if (code !== NET.code) out.push(o.e);
  }
  return out.sort((a, b) => a.t - b.t); // waiting longest first
}
async function lobbyWatch(on) {
  if (!on) {
    LOBBY.on = false;
    LOBBY.subAt = 0;
    LOBBY.clients.forEach(c => {
      try {
        c.end(true);
      } catch (_) {}
    });
    LOBBY.clients = [];
    return;
  }
  if (LOBBY.on) return;
  LOBBY.on = true;
  LOBBY.failed = false;
  lobbyRender();
  if (!(await loadMqtt()) || !LOBBY.on) {
    LOBBY.failed = !window.mqtt;
    LOBBY.on = false;
    lobbyRender();
    return;
  }
  const pre = lobbyTopic(),
    me = Math.random().toString(36).slice(2, 10);
  (window.WVR_MQTT || MQTT_URLS).forEach((u, i) => {
    let c;
    try {
      c = window.mqtt.connect(u, {
        clientId: 'wvrL_' + me + '_' + i,
        keepalive: 30,
        reconnectPeriod: 5000,
        connectTimeout: 9000,
        clean: true,
      });
    } catch (_) {
      return;
    }
    LOBBY.clients.push(c);
    c.on('connect', () => {
      try {
        c.subscribe(pre + '+', { qos: 0 });
      } catch (_) {}
      if (!LOBBY.subAt) LOBBY.subAt = now();
      lobbyRender();
    });
    c.on('message', (t, buf, pkt) => {
      if (!LOBBY.on || t.indexOf(pre) !== 0) return;
      const code = t.slice(pre.length),
        s = typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
      if (!/^[0-9]{4}$/.test(code)) return;
      if (!s) {
        LOBBY.list.delete(code);
        lobbyRender();
        return;
      }
      let d;
      try {
        d = JSON.parse(s);
      } catch (_) {
        return;
      }
      if (!lobbyValid(d, code)) return;
      const age = Date.now() - d.h; // a retained entry is as old as its last heartbeat; a live one is fresh
      if (pkt && pkt.retain && age > LOBBY_FRESH) {
        if (age > 180000)
          try {
            c.publish(t, '', { qos: 0, retain: true }); // long dead (no last will got through): tidy it away
          } catch (_) {}
        return;
      }
      LOBBY.list.set(code, { e: d, seen: pkt && pkt.retain ? now() - clamp(age, 0, LOBBY_FRESH) : now() });
      lobbyRender();
    });
    c.on('error', () => {});
  });
  setTimeout(() => {
    if (LOBBY.on && !LOBBY.clients.some(c => c.connected)) {
      LOBBY.failed = true;
      lobbyRender();
    }
  }, 10000);
}
// The menu's online panel watches the list only while it is on screen (and a little longer), so the menu costs nothing when nobody looks.
function lobbyVisible(vis) {
  if (vis) {
    LOBBY.offT = 0;
    lobbyWatch(true);
  } else if (LOBBY.on && !LOBBY.offT) LOBBY.offT = now();
}
setInterval(() => {
  if (LOBBY.offT && now() - LOBBY.offT > 20000) {
    LOBBY.offT = 0;
    lobbyWatch(false);
  }
  if (LOBBY.on) lobbyRender();
}, 2000);
if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => lobbyVisible(e.isIntersecting))).observe($('.online'));
else lobbyVisible(true);
function lobbyRender() {
  const box = $('#lobbyList');
  if (!box) return;
  const list = lobbyFresh().slice(0, 6),
    busy = !!NET.r || !!NET.connecting;
  const key =
    (LOBBY.failed ? 'f' : LOBBY.subAt ? 's' : 'w') +
    (busy ? 'b' : '') +
    list.map(e => e.c + e.f + e.m + e.p + e.n).join(',') +
    (NET.code || '');
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  box.textContent = '';
  if (!list.length) {
    if (busy) return; // hosting or joining: the status lines below say what happens
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = LOBBY.failed
      ? 'Die Liste der offenen Spiele ist gerade nicht erreichbar. Mit Code geht es trotzdem.'
      : !LOBBY.subAt
        ? 'Suche offene Spiele …'
        : 'Gerade wartet niemand. Tippe „Schnelles Spiel“: Dann steht dein Spiel hier, und du kannst solange gegen den Computer üben.';
    box.appendChild(p);
    return;
  }
  const modeN = { classic: 'Klassisch', chaos: 'Chaos', fog: 'Nebel' };
  for (const e of list) {
    const row = document.createElement('div'),
      img = document.createElement('img'),
      tx = document.createElement('span'),
      b = document.createElement('b'),
      sm = document.createElement('small'),
      btn = document.createElement('button'),
      mine = FAC[e.f].other;
    row.className = 'lrow ' + e.f;
    img.alt = '';
    try {
      img.src = unitHead(e.f === 'viking' ? 0 : 2) || PORTRAIT[e.f === 'viking' ? 0 : 2];
    } catch (_) {}
    tx.className = 'ltx';
    b.textContent = lobbyName(e);
    sm.textContent = modeN[e.m] + ' · ' + MAPTYPES[MAPTYPE_KEYS[e.p]].n + ' · du: ' + (mine === 'viking' ? 'Wikinger' : 'Rentner');
    tx.append(b, sm);
    btn.className = 'btn small quick';
    btn.textContent = 'Spielen';
    btn.disabled = busy;
    btn.addEventListener('click', () => {
      SFX.play('click');
      joinOnline(e.c, { pub: true });
    });
    row.append(img, tx, btn);
    box.appendChild(row);
  }
}
// Host side: the entry, its heartbeat and its last will (one connection per broker, so a vanished host clears itself everywhere).
async function lobbyHostStart(entry) {
  lobbyHostStop();
  if (!(await loadMqtt())) return;
  const t = lobbyTopic() + entry.c,
    H = { entry, clients: [], timer: 0 },
    me = Math.random().toString(36).slice(2, 10);
  LOBBY.host = H;
  const pub = () => {
    const msg = JSON.stringify(Object.assign({}, H.entry, { h: Date.now() }));
    H.clients.forEach(c => {
      if (c.connected)
        try {
          c.publish(t, msg, { qos: 0, retain: true });
        } catch (_) {}
    });
  };
  (window.WVR_MQTT || MQTT_URLS).forEach((u, i) => {
    let c;
    try {
      c = window.mqtt.connect(u, {
        clientId: 'wvrH_' + me + '_' + i,
        keepalive: 20,
        reconnectPeriod: 4000,
        connectTimeout: 9000,
        clean: true,
        will: { topic: t, payload: '', retain: true, qos: 0 },
      });
    } catch (_) {
      return;
    }
    H.clients.push(c);
    c.on('connect', pub);
    c.on('error', () => {});
  });
  H.timer = setInterval(pub, 15000);
}
function lobbyHostStop() {
  const H = LOBBY.host;
  if (!H) return;
  LOBBY.host = null;
  clearInterval(H.timer);
  const t = lobbyTopic() + H.entry.c;
  H.clients.forEach(c => {
    try {
      if (c.connected) c.publish(t, '', { qos: 1, retain: true }, () => c.end(true));
      else c.end(true);
    } catch (_) {}
    setTimeout(() => {
      try {
        c.end(true);
      } catch (_) {}
    }, 3000);
  });
}
addEventListener('pagehide', lobbyHostStop);
// "Schnelles Spiel": join the open game that waits longest (the same mode first), otherwise open a public one.
async function quickMatch(skip = []) {
  if (NET.r || NET.connecting) return;
  lobbyWatch(true);
  const s = $('#onlineStatus');
  s.hidden = false;
  s.textContent = 'Suche einen Gegner';
  s.classList.add('dots');
  $('#btnQuick').disabled = true;
  for (let i = 0; i < 30 && (!LOBBY.subAt || now() - LOBBY.subAt < 1500) && !LOBBY.failed; i++) await new Promise(r => setTimeout(r, 100));
  $('#btnQuick').disabled = false;
  if (NET.r || NET.connecting) return;
  const list = lobbyFresh().filter(e => !skip.includes(e.c)),
    pick = list.find(e => e.m === gameMode) || list[0];
  if (pick) joinOnline(pick.c, { pub: true, quick: skip.concat(pick.c) });
  else hostOnline(true);
}
$('#btnQuick').addEventListener('click', () => {
  SFX.play('click');
  quickMatch();
});
$('#btnPractice').addEventListener('click', () => {
  if (!NET.r || NET.role !== 'host' || !NET.pub) return;
  NET.practice = true;
  NET.r.presence({ pr: 1 }).catch(() => {});
  playAi(true);
});
function foundBan(on) {
  $('#foundBan').hidden = !on;
}
$('#foundNo').addEventListener('click', () => {
  foundBan(false);
  if (!NET.r) return;
  NET.declined = true;
  NET.practice = false;
  NET.r.presence({ st: 'no' }).catch(() => {});
  lobbyHostStop();
  const a = NET.connectAttempt;
  setTimeout(() => a === NET.connectAttempt && leaveNet(), 1500);
  toast('Du übst weiter. Dein Spiel steht nicht mehr in der Liste.', 2500);
});
