/* 61-net.js - ONLINE (host-authoritative): transports P2P (PeerJS), MQTT relay, Claude room, local BroadcastChannel; openMulti() opens all and keeps the first
   that works. The host sends presence {snap, ack, ...}, the guest sends {cmds (numbered, until acked), in (ego input), sid}. NET_VER must match.
   hostOnline/joinOnline (lobby), hostReadGuest, hostBroadcast, rematchTick, oppQuit (the other side gave up). */
/* ---------- room transport ---------- */
function localRoom() {
  const me = Math.random().toString(36).slice(2, 10);
  return {
    local: true,
    async join(name) {
      const bc = new BroadcastChannel('wvr-' + name);
      let pres = {};
      const others = new Map();
      let left = false,
        snap = [];
      const rebuild = () => {
        snap = Object.freeze([
          { peer: me, isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null, presence: pres, updatedAt: now() },
          ...[...others].map(([peer, o]) => ({
            peer,
            isMe: false,
            sameTab: false,
            kind: 'viewer',
            guest: false,
            by: null,
            presence: o.presence,
            updatedAt: o.t,
          })),
        ]);
      };
      const send = () => {
        if (!left) bc.postMessage({ peer: me, presence: pres });
      };
      bc.onmessage = ev => {
        const d = ev.data;
        if (!d || !d.peer) return;
        if (d.bye) others.delete(d.peer);
        else others.set(d.peer, { presence: Object.freeze(d.presence || {}), t: now() });
        rebuild();
      };
      const hb = setInterval(() => {
        send();
        let ch = false;
        for (const [p, o] of others)
          if (now() - o.t > 3000) {
            others.delete(p);
            ch = true;
          }
        if (ch) rebuild();
      }, 400);
      rebuild();
      send();
      return {
        name,
        local: true,
        presence(patch) {
          const n = Object.assign({}, pres, patch);
          for (const k in n) if (n[k] === null) delete n[k];
          pres = Object.freeze(n);
          rebuild();
          send();
          return Promise.resolve();
        },
        peers() {
          return snap;
        },
        leave() {
          left = true;
          clearInterval(hb);
          try {
            bc.postMessage({ peer: me, bye: true });
            bc.close();
          } catch (_) {}
          return Promise.resolve();
        },
      };
    },
  };
}
const ROOM_HELP = TR(
  'Keine Online-Verbindung. Das klappt nur, wenn ihr beide in Claude eingeloggt seid und das Spiel direkt mit dem Konto deines Mitspielers geteilt ist (im Teilen-Menü seine E-Mail eintragen). Über einen öffentlichen Link geht es nicht.'
);
// the portal build ships the libraries next to the page (tools/portal.mjs sets window.WVR_LIBS = { peer, mqtt, faceapi })
function WVR_LIB(n) {
  return (window.WVR_LIBS && window.WVR_LIBS[n]) || null;
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
function peerTransport() {
  // STUN + public TURN relays: phones on mobile data sit behind carrier NAT and need a relay to reach a laptop
  const ICE = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:stun.nextcloud.com:443',
        'stun:global.stun.twilio.com:3478',
      ],
    },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
  const opts = Object.assign(
    { debug: 0, config: { iceServers: ICE, sdpSemantics: 'unified-plan', iceCandidatePoolSize: 4 } },
    window.WVR_PEER || {}
  );
  return {
    p2p: true,
    async join(name, role) {
      const hostId = name + '-wvr7';
      const peer = role === 'host' ? new Peer(hostId, opts) : new Peer(opts);
      let conn = null,
        pres = {},
        other = null,
        otherId = null,
        myId = null,
        sendT = 0,
        left = false,
        lastRx = 0, // when the other side was last heard (any message, keepalives included)
        redialT = 0,
        tries = 0,
        onOpen = null; // while joining: called when a line to the host opens (the first one, or a re-dialed one)
      const flush = () => {
        sendT = 0;
        if (left) return;
        if (conn && conn.open) {
          if (conn.dataChannel && conn.dataChannel.bufferedAmount > 65536) {
            sendT = setTimeout(flush, 30);
            return;
          }
          try {
            conn.send({ p: pres });
          } catch (_) {}
        }
      };
      const setConn = c => {
        conn = c;
        lastRx = now();
        c.on('data', d => {
          lastRx = now();
          if (d && typeof d === 'object' && d.p && typeof d.p === 'object') {
            other = Object.freeze(d.p);
            otherId = c.peer;
          }
        });
        c.on('open', () => {
          lastRx = now();
          tries = 0;
          if (onOpen) onOpen();
          flush();
        });
        c.on('close', () => {
          if (conn === c) {
            conn = null;
            other = null;
            if (role !== 'host') redial();
          }
        });
        c.on('error', () => {});
      };
      // After a drop (Wi-Fi to mobile data, app switch) the guest dials the host again; the host takes the new line ('connection' below).
      const redial = () => {
        if (left || redialT || role === 'host') return;
        redialT = setTimeout(
          () => {
            redialT = 0;
            if (left || peer.destroyed || (conn && conn.open)) return;
            if (peer.disconnected) {
              try {
                peer.reconnect();
              } catch (_) {}
              redial();
              return;
            }
            tries++;
            const c = peer.connect(hostId, { reliable: true, serialization: 'json' });
            setConn(c);
            setTimeout(() => {
              if (left || conn !== c || c.open) return;
              conn = null;
              try {
                c.close();
              } catch (_) {}
              redial();
            }, 6000);
          },
          Math.min(3000, 800 * (tries + 1))
        );
      };
      // keepalive both ways; a line that stays silent for 8 s is dead even without a close event (common when the network changes)
      const ka = setInterval(() => {
        if (left || !conn || !conn.open) return;
        if (now() - lastRx > 8000) {
          const c = conn;
          conn = null;
          other = null;
          try {
            c.close();
          } catch (_) {}
          redial();
          return;
        }
        try {
          conn.send({ ka: 1 });
        } catch (_) {}
      }, 2000);
      try {
        await new Promise((res, rej) => {
          const to = setTimeout(() => rej({ code: 'timeout' }), 25000);
          peer.on('open', pid => {
            myId = pid;
            if (role === 'host') {
              clearTimeout(to);
              res();
              return;
            }
            onOpen = () => {
              clearTimeout(to);
              res();
            };
            setConn(peer.connect(hostId, { reliable: true, serialization: 'json' }));
          });
          peer.on('error', e => {
            clearTimeout(to);
            const t = e && e.type;
            rej({ code: t === 'peer-unavailable' ? 'not_found' : t === 'unavailable-id' ? 'taken' : 'network' });
          });
        });
      } catch (e) {
        // a failed join leaves nothing open behind (no peer on the broker, no keepalive timer)
        onOpen = null;
        left = true;
        clearInterval(ka);
        try {
          peer.destroy();
        } catch (_) {}
        throw e;
      }
      onOpen = null;
      peer.removeAllListeners('error');
      peer.on('error', () => {});
      peer.on('connection', c => {
        // the known guest dialing again replaces his old line; anyone else is turned away while that line is alive
        if (conn && conn.open && c.peer !== otherId && now() - lastRx < 4000) {
          c.on('open', () => {
            try {
              c.close();
            } catch (_) {}
          });
          return;
        }
        if (conn && conn !== c) {
          const old = conn;
          conn = null;
          try {
            old.close();
          } catch (_) {}
        }
        setConn(c);
      });
      peer.on('disconnected', () => {
        if (!left) {
          try {
            peer.reconnect();
          } catch (_) {}
        }
      });
      return {
        name,
        p2p: true,
        presence(patch) {
          const n = Object.assign({}, pres, patch);
          for (const k in n) if (n[k] === null) delete n[k];
          pres = n;
          if (!sendT) sendT = setTimeout(flush, 30);
          return Promise.resolve();
        },
        peers() {
          const a = [{ peer: myId || 'me', isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null, presence: pres }];
          if (other && conn && conn.open)
            a.push({ peer: otherId, isMe: false, sameTab: false, kind: 'viewer', guest: false, by: null, presence: other });
          return a;
        },
        connected() {
          return !!(conn && conn.open) || role === 'host';
        },
        leave() {
          left = true;
          clearTimeout(sendT);
          clearTimeout(redialT);
          clearInterval(ka);
          try {
            conn && conn.close();
          } catch (_) {}
          try {
            peer.destroy();
          } catch (_) {}
          return Promise.resolve();
        },
      };
    },
  };
}
async function viewerRoom() {
  if (!(window.claude && typeof window.claude.use === 'function')) return null;
  try {
    return await window.claude.use('room');
  } catch (_) {
    return null;
  }
}
async function getRoom() {
  if (NET.room) return NET.room;
  // same transport on every device: P2P (PeerJS) first, so phone and laptop always find each other
  for (const src of [
    WVR_LIB('peer'),
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  ].filter(Boolean)) {
    if (window.Peer) break;
    try {
      await loadScript(src);
    } catch (_) {}
  }
  if (window.Peer) {
    NET.room = peerTransport();
    NET.local = false;
    NET.p2p = true;
    return NET.room;
  }
  const vr = await viewerRoom();
  if (vr) {
    NET.room = vr;
    NET.local = false;
    NET.p2p = false;
    return NET.room;
  }
  if ('BroadcastChannel' in window) {
    NET.room = localRoom();
    NET.local = true;
  }
  return NET.room;
}
const P2P_MSG = {
  not_found: TR('Kein Spiel mit diesem Code gefunden. Stimmt der Code?'),
  taken: TR('Dieser Code ist gerade vergeben. Bitte noch einmal versuchen.'),
  network: TR('Keine Verbindung zum Vermittlungsdienst. Bist du online?'),
  timeout: TR(
    'Die Verbindung hat zu lange gedauert. Tipp: Beide Geräte neu laden und es noch einmal versuchen. Falls es am Handy nicht klappt, kurz zwischen WLAN und mobilen Daten wechseln.'
  ),
};
const netErrMsg = e => P2P_MSG[e && e.code] || (NET.via === 'claude' ? ROOM_HELP : P2P_MSG.network);
function roomReady(r) {
  if (r.local || typeof r.onConnection !== 'function') return Promise.resolve(true);
  return new Promise(res => {
    let done = false,
      un = null;
    const fin = v => {
      if (done) return;
      done = true;
      try {
        un && un();
      } catch (_) {}
      res(v);
    };
    try {
      un = r.onConnection(
        c => {
          if (c) fin(true);
        },
        () => fin(false)
      );
    } catch (_) {
      fin(false);
    }
    setTimeout(() => fin(typeof r.connected === 'function' ? r.connected() : false), 7000);
  });
}
async function openRoom(code, role) {
  const room = await getRoom();
  if (!room) throw new Error('none');
  let r;
  try {
    r = await room.join('wvr-' + code.toLowerCase(), role);
  } catch (e) {
    if (room.p2p && e && e.code === 'network') {
      const vr = await viewerRoom();
      if (vr) {
        NET.room = vr;
        NET.p2p = false;
        return openRoom(code, role);
      }
    }
    if (room.p2p || (e && (e.code === 'not_granted' || e.code === 'revoked'))) throw e;
    if (!(room.presence && room.peers)) throw e;
    r = {
      name: 'lobby',
      presence: p => room.presence(p),
      peers: () => room.peers(),
      connected: () => room.connected(),
      onConnection: (h, er) => room.onConnection(h, er),
      leave: () => room.presence({ role: null, code: null, snap: null, cmds: null, in: null, fc: null, fgot: null }),
    };
  }
  if (!(await roomReady(r))) {
    try {
      r.leave();
    } catch (_) {}
    throw new Error('not_connected');
  }
  return r;
}
/* open every available transport at once (direct P2P + Claude room), so devices that ended up on different ones still meet */
const NET_VER = 49; // bump when snapshots, commands or presence change shape: two different versions refuse to play together
async function openClaude(code, role) {
  const vr = await viewerRoom();
  if (!vr) return null;
  let r;
  try {
    r = await vr.join('wvr-' + code.toLowerCase(), role);
  } catch (e) {
    if (!(vr.presence && vr.peers)) return null;
    r = {
      name: 'lobby',
      presence: p => vr.presence(p),
      peers: () => vr.peers(),
      connected: () => vr.connected(),
      onConnection: (h, er) => vr.onConnection(h, er),
      leave: () => vr.presence({ role: null, code: null, snap: null, cmds: null, in: null, fc: null, fgot: null }),
    };
  }
  if (!(await roomReady(r))) {
    try {
      r.leave();
    } catch (_) {}
    return null;
  }
  return r;
}
/* relay transport over public MQTT brokers (WebSocket): works across any two networks, no direct link needed */
const MQTT_URLS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
async function loadMqtt() {
  for (const src of [
    WVR_LIB('mqtt'),
    'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
    'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js',
  ].filter(Boolean)) {
    if (window.mqtt) break;
    try {
      await loadScript(src);
    } catch (_) {}
  }
  return !!(window.mqtt && window.mqtt.connect);
}
function mqttTransport() {
  return {
    relay: true,
    async join(name, role) {
      const urls = window.WVR_MQTT || MQTT_URLS,
        me = Math.random().toString(36).slice(2, 10),
        base = 'wvr7/' + name + '/',
        myT = base + role,
        otherT = base + (role === 'host' ? 'guest' : 'host');
      let pres = {},
        other = null,
        otherId = null,
        otherT0 = 0,
        seq = 0,
        sendT = 0,
        left = false;
      const lastIn = {},
        clients = [];
      const flush = () => {
        sendT = 0;
        if (left) return;
        seq++;
        const msg = JSON.stringify({ id: me, s: seq, p: pres });
        clients.forEach(c => {
          if (c.connected) {
            try {
              c.publish(myT, msg, { qos: 0 });
            } catch (_) {}
          }
        });
      };
      await new Promise((res, rej) => {
        let done = false,
          fails = 0;
        const fail = () => {
          if (++fails >= urls.length && !done) {
            done = true;
            rej({ code: 'network' });
          }
        };
        urls.forEach((u, i) => {
          let c;
          try {
            c = window.mqtt.connect(u, {
              clientId: 'wvr_' + me + '_' + i,
              keepalive: 20,
              reconnectPeriod: 2500,
              connectTimeout: 9000,
              clean: true,
            });
          } catch (_) {
            fail();
            return;
          }
          clients.push(c);
          let ok = false;
          c.on('connect', () => {
            ok = true;
            try {
              c.subscribe(otherT, { qos: 0 });
            } catch (_) {}
            if (!done) {
              done = true;
              res();
            }
            flush();
          });
          c.on('message', (t, buf) => {
            if (left) return;
            let d;
            try {
              d = JSON.parse(typeof buf === 'string' ? buf : new TextDecoder().decode(buf));
            } catch (_) {
              return;
            }
            if (!d || d.id === me || typeof d.s !== 'number' || !d.p) return;
            if (d.s <= (lastIn[d.id] || 0)) return;
            lastIn[d.id] = d.s;
            if (otherId && d.id !== otherId && now() - otherT0 < 3000) return;
            other = Object.freeze(d.p);
            otherId = d.id;
            otherT0 = now();
          });
          c.on('error', () => {
            if (!ok) fail();
          });
          c.on('offline', () => {});
        });
        setTimeout(() => {
          if (!done) {
            done = true;
            rej({ code: 'network' });
          }
        }, 12000);
      }).catch(e => {
        left = true; // nothing keeps reconnecting in the background after a failed join
        clients.forEach(c => {
          try {
            c.end(true);
          } catch (_) {}
        });
        throw e;
      });
      const hb = setInterval(flush, 900);
      return {
        name,
        relay: true,
        presence(patch) {
          const n = Object.assign({}, pres, patch);
          for (const k in n) if (n[k] === null) delete n[k];
          pres = n;
          if (!sendT) sendT = setTimeout(flush, 45);
          return Promise.resolve();
        },
        peers() {
          const a = [{ peer: me, isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null, presence: pres }];
          if (other && now() - otherT0 < 5000)
            a.push({ peer: otherId, isMe: false, sameTab: false, kind: 'viewer', guest: false, by: null, presence: other });
          return a;
        },
        connected() {
          return clients.some(c => c.connected);
        },
        leave() {
          left = true;
          clearInterval(hb);
          clearTimeout(sendT);
          clients.forEach(c => {
            try {
              c.end(true);
            } catch (_) {}
          });
          return Promise.resolve();
        },
      };
    },
  };
}
async function loadPeer() {
  for (const src of [
    WVR_LIB('peer'),
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  ].filter(Boolean)) {
    if (window.Peer) break;
    try {
      await loadScript(src);
    } catch (_) {}
  }
  return !!window.Peer;
}
async function openMulti(code, role) {
  const subs = [],
    W = { multi: true, subs, lock: null, closed: false, err: null };
  W.presence = p => {
    W.last = Object.assign(W.last || {}, p);
    for (const k in W.last) if (W.last[k] === null) delete W.last[k];
    (W.lock ? [W.lock] : subs).forEach(sb => {
      try {
        const q = sb.r.presence(p);
        if (q && q.catch) q.catch(() => {});
      } catch (_) {}
    });
    return Promise.resolve();
  };
  W.peers = () => {
    const out = [];
    let me = false;
    for (const sb of W.lock ? [W.lock] : subs) {
      let ps = [];
      try {
        ps = sb.r.peers() || [];
      } catch (_) {}
      for (const pr of ps) {
        if (pr.isMe) {
          if (!me) {
            out.push(Object.assign({}, pr, { _sub: sb }));
            me = true;
          }
          continue;
        }
        out.push(Object.assign({}, pr, { _sub: sb }));
      }
    }
    return out;
  };
  W.meOn = sb => {
    try {
      const m = (sb.r.peers() || []).find(pr => pr.isMe);
      return m ? m.peer : null;
    } catch (_) {
      return null;
    }
  };
  W.rank = pr => (pr && pr._sub ? ({ p2p: 0, relay: 1, claude: 2, local: 0 }[pr._sub.kind] ?? 3) : 9);
  W.pick = (list, key) => {
    if (!list.length) return null;
    list.sort((a, b) => W.rank(a) - W.rank(b));
    const best = list[0];
    if (W.rank(best) === 0 || W.lock) return best;
    W.seen = W.seen || {};
    const t0 = W.seen[key] || (W.seen[key] = now());
    return now() - t0 > 9000 ? best : null;
  };
  W.lockTo = pr => {
    if (!pr || !pr._sub || W.lock === pr._sub) return;
    W.lock = pr._sub;
    NET.p2p = !!pr._sub.p2p;
    NET.via = pr._sub.kind;
    subs
      .filter(sb => sb !== W.lock)
      .forEach(sb => {
        try {
          sb.r.leave();
        } catch (_) {}
      });
    subs.splice(0, subs.length, W.lock);
  };
  W.leave = () => {
    W.closed = true;
    subs.forEach(sb => {
      try {
        sb.r.leave();
      } catch (_) {}
    });
    return Promise.resolve();
  };
  NET.connecting = W;
  const add = (r, kind) => {
    if (W.closed || W.lock) {
      try {
        r.leave();
      } catch (_) {}
      return;
    }
    const sb = { r, kind, p2p: kind !== 'claude' };
    subs.push(sb);
    if (W.last) {
      try {
        const q = r.presence(W.last);
        if (q && q.catch) q.catch(() => {});
      } catch (_) {}
    }
  };
  const tryP2P = async () => {
    if (!(await loadPeer())) return;
    try {
      const r = await peerTransport().join('wvr-' + code.toLowerCase(), role);
      add(r, 'p2p');
    } catch (e) {
      W.err = e;
      if (
        role === 'guest' &&
        e &&
        (e.code === 'not_found' || e.code === 'timeout') &&
        !W.closed &&
        !W.lock &&
        (W.tries = (W.tries || 0) + 1) < 25
      )
        setTimeout(() => {
          if (!W.closed && !W.lock) tryP2P();
        }, 3000);
    }
  };
  const tryClaude = async () => {
    try {
      const r = await openClaude(code, role);
      if (r) add(r, 'claude');
    } catch (_) {}
  };
  const tryMqtt = async () => {
    if (!(await loadMqtt())) return;
    try {
      const r = await mqttTransport().join('wvr-' + code.toLowerCase(), role);
      add(r, 'relay');
    } catch (e) {
      if (!W.err) W.err = e;
    }
  };
  W.p2pPending = () => !subs.some(sb => sb.kind === 'p2p') && !W.p2pDead;
  const p1 = tryP2P(),
    p2 = tryClaude(),
    p3 = tryMqtt();
  // ready as soon as one transport is up (guests keep retrying the others in the background)
  await new Promise(res => {
    let n = 0,
      settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      clearTimeout(timeout);
      res();
    };
    const done = () => {
      if (++n >= 3) finish();
    };
    const timer = setInterval(() => {
      if (subs.length || W.closed) finish();
    }, 100);
    const timeout = setTimeout(finish, role === 'guest' ? 30000 : 26000);
    p1.finally(done);
    p2.finally(done);
    p3.finally(done);
  });
  if (W.closed) return W;
  if (!subs.length && role === 'guest' && W.err && W.err.code === 'not_found') {
    /* keep searching in background */ return W;
  }
  if (!subs.length) {
    if ('BroadcastChannel' in window && !window.Peer && !(await viewerRoom())) {
      const lr = await localRoom().join('wvr-' + code.toLowerCase());
      NET.local = true;
      add(lr, 'local');
      return W;
    }
    throw W.err || new Error('none');
  }
  NET.p2p = subs.every(sb => sb.p2p);
  return W;
}
function leaveNet() {
  if (NET.endPoll) {
    clearInterval(NET.endPoll);
    NET.endPoll = null;
  }
  NET.connectAttempt = (NET.connectAttempt || 0) + 1;
  NET.inlineLobby = false;
  NET.quitAt = NET.goneAt = 0;
  NET.hostGone = false;
  setHostMenu(false);
  lobbyHostStop();
  foundBan(false);
  $('#btnPractice').hidden = true;
  if (NET.connecting) {
    try {
      NET.connecting.leave();
    } catch (_) {}
    NET.connecting = null;
  }
  if (NET.poll) clearInterval(NET.poll);
  NET.poll = null;
  if (NET.r) {
    try {
      NET.r.leave();
    } catch (_) {}
  }
  Object.assign(NET, {
    pub: false,
    practice: false,
    found: 0,
    declined: false,
    quick: null,
    verWarn: false,
    via: null,
    r: null,
    role: null,
    code: null,
    guestPeer: null,
    pending: [],
    seq: 0,
    lastSeq: 0,
    gone: false,
    chunks: {},
    gotId: null,
    fcIdx: 0,
    fcDone: null,
    guestPres: null,
    guestSid: null,
    rmMiss: 0,
  });
}
// face exchange via presence chunks
const FC_SIZE = 700;
function faceChunkPatch(otherPresence) {
  // public games: no photos between strangers; the portal build sends no photos at all (pictures of players would need moderation)
  if (NET.pub || window.WVR_PORTAL || !FACE.mine || NET.fcDone === FACE.mine.id) return null;
  if (otherPresence && otherPresence.fgot === FACE.mine.id) {
    NET.fcDone = FACE.mine.id;
    return { fc: null };
  }
  if (now() - NET.fcT < 250) return undefined;
  NET.fcT = now();
  const d = FACE.mine.net,
    n = Math.ceil(d.length / FC_SIZE),
    i = NET.fcIdx++ % n;
  return { fc: { id: FACE.mine.id, n, i, d: d.slice(i * FC_SIZE, (i + 1) * FC_SIZE) } };
}
function faceChunkRecv(p) {
  const fc = p && p.fc;
  if (
    NET.pub ||
    !fc ||
    typeof fc.id !== 'string' ||
    !Number.isInteger(fc.n) ||
    fc.n < 1 ||
    fc.n > 20 ||
    !Number.isInteger(fc.i) ||
    fc.i < 0 ||
    fc.i >= fc.n ||
    typeof fc.d !== 'string'
  )
    return null;
  if (NET.gotId === fc.id) return null;
  let c = NET.chunks[fc.id];
  if (!c || c.length !== fc.n) c = NET.chunks[fc.id] = new Array(fc.n).fill(null);
  c[fc.i] = fc.d;
  if (c.every(x => x !== null)) {
    const url = c.join('');
    if (/^data:image\/(jpeg|png);base64,/.test(url)) {
      NET.gotId = fc.id;
      setOtherFace(url);
      return { fgot: fc.id };
    }
  }
  return null;
}
/* The other player has left. Gave up (presence quit: 1, sent by quitMatch in 62-screens.js): the field freezes and a short countdown
   runs, then you win (without a rematch: he has left the room). Gone without a word (line dropped, tab closed): he has OPP_GONE_WAIT
   seconds to come back, the warning counts them down; then you win as well. oppLeftTick runs twice a second. */
const OPP_QUIT_DELAY = 3,
  OPP_GONE_WAIT = 30;
function oppQuit() {
  if (!V.playing || V.ending) return;
  NET.gone = true;
  if (!NET.quitAt) NET.quitAt = now() + OPP_QUIT_DELAY * 1000;
  oppLeftTick();
}
function oppWin(sub) {
  NET.gone = true;
  NET.quitAt = NET.goneAt = 0;
  $('#netwarn').hidden = true;
  endGame(Object.assign({}, V.latest || {}, { o: V.myTeam }));
  $('#endSub').textContent = sub;
  const a = NET.connectAttempt;
  setTimeout(() => a === NET.connectAttempt && leaveNet(), 1500);
}
function oppLeftTick() {
  if (!V.playing || V.ending || (V.mode !== 'host' && V.mode !== 'guest')) {
    NET.quitAt = NET.goneAt = 0;
    return;
  }
  const t = now();
  if (NET.quitAt) {
    const s = Math.ceil((NET.quitAt - t) / 1000);
    if (s <= 0) return oppWin(TR('Dein Gegner hat aufgegeben. Der Sieg gehört dir!'));
    netWarn(TR('Dein Gegner hat das Spiel verlassen. Du gewinnst in {0} s …', s));
    return;
  }
  const gone = V.mode === 'host' ? NET.gone : NET.hostGone;
  if (!gone) {
    NET.goneAt = 0;
    return;
  }
  if (!NET.goneAt) NET.goneAt = t;
  const s = Math.ceil(OPP_GONE_WAIT - (t - NET.goneAt) / 1000);
  if (s <= 0) return oppWin(TR('Dein Gegner ist nicht zurückgekommen. Der Sieg gehört dir!'));
  netWarn(TR('Dein Gegner ist weg. Kommt er nicht in {0} s zurück, gewinnst du.', s));
}
setInterval(oppLeftTick, 500);
const CODE_LENGTH = 4;
function genCode() {
  const digits = new Uint8Array(CODE_LENGTH);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(digits);
  else for (let i = 0; i < digits.length; i++) digits[i] = Math.floor(Math.random() * 256);
  return Array.from(digits, n => String(n % 10)).join('');
}
async function hostOnline(pub = false) {
  leaveNet();
  FACE.other = null;
  NET.pub = !!pub; // a public game: listed under "Offene Spiele", no photos
  const attempt = NET.connectAttempt;
  const code = genCode();
  showLobby(true, code, TR('Verbinde'), true);
  if (pub) $('#onlineNote').textContent = TR('Gleich steht dein Spiel bei „Offene Spiele“. Die Partie startet, sobald jemand beitritt.');
  let r;
  try {
    r = await openMulti(code, 'host');
  } catch (e) {
    if (attempt === NET.connectAttempt) {
      setLobbyStatus(netErrMsg(e), false);
      $('#btnHost').disabled = false;
    }
    return;
  }
  if (attempt !== NET.connectAttempt) {
    r.leave();
    return;
  }
  if (NET.connecting === r) NET.connecting = null;
  NET.r = r;
  NET.code = code;
  NET.role = 'host';
  const facs = [myFac, FAC[myFac].other],
    seed = newSeed(),
    mode = gameMode,
    fresh = () => newGame(facs, seed, mode === 'chaos', { fog: mode === 'fog' });
  G = fresh();
  await r.presence({ role: 'host', code, v: NET_VER, fa: facs, sd: seed, st: 'wait', gp: null, pf: profPublic() }).catch(() => {});
  if (attempt !== NET.connectAttempt) return;
  setLobbyStatus(pub ? TR('Warte auf einen Gegner') : TR('Warte auf deinen Gegner'), true);
  if (pub) {
    const pf = profPublic();
    lobbyHostStart({ c: code, f: myFac, m: mode, p: MAPTYPE_KEYS.indexOf(seedMapType(seed)), n: pf.n, a: pf.a, l: pf.l, t: Date.now() });
    $('#onlineNote').textContent = TR('Dein Spiel steht jetzt bei „Offene Spiele“. Die Partie startet, sobald jemand beitritt.');
    $('#btnPractice').hidden = false;
  }
  if (NET.local) $('#onlineNote').textContent = TR('Testmodus: Verbindung nur zwischen zwei Tabs in diesem Browser.');
  NET.poll = setInterval(() => {
    if (V.mode === 'host') return;
    const all = (r.peers() || []).filter(p => !p.isMe && p.presence && p.presence.role === 'guest' && p.presence.code === code),
      gl = all.filter(p => p.presence.v === NET_VER),
      guest = r.pick ? r.pick(gl, 'guest') : gl[0];
    if (!guest && all.length && !NET.verWarn) {
      NET.verWarn = true;
      setLobbyStatus(TR('Dein Gegner hat eine andere Spielversion. Bitte beide Geräte neu laden.'), false);
    }
    if (guest && NET.declined) return;
    if (!guest && NET.found) {
      NET.found = 0; // the joining player left again during the countdown
      foundBan(false);
    }
    if (guest && V.mode === 'ai') {
      // practising while waiting: a short countdown on screen, the player may decline ("Weiter üben", 64-lobby.js)
      if (!NET.found) {
        NET.found = now();
        foundBan(true);
        SFX.play('ding');
      }
      const left = 5 - (now() - NET.found) / 1000;
      if (left > 0) {
        $('#foundTxt').textContent = TR('Online-Partie in {0} …', Math.ceil(left));
        return;
      }
      foundBan(false);
      stopSim();
      SFX.music(false);
      if (V.poss) exitEgo(false);
      V.playing = false;
      NET.practice = false;
      FACE.other = null;
      G = fresh();
    }
    if (guest) {
      lobbyHostStop();
      $('#btnPractice').hidden = true;
      if (r.lockTo) r.lockTo(guest);
      NET.guestPeer = guest.peer;
      NET.guestSid = guest.presence.sid;
      NET.lastSeq = 0;
      V.oppPf = profPeer(guest.presence.pf);
      beginMatch('host', facs, 0, seed);
      pushSnap(snapOf(G));
      startSim(false);
      hostBroadcast();
    }
  }, 150);
}
function hostReadGuest() {
  if (NET.quitAt) {
    NET.gone = true; // he gave up: the field stays frozen while the countdown runs (oppLeftTick)
    return;
  }
  const peers = NET.r ? NET.r.peers() || [] : [];
  let g = peers.find(p => p.peer === NET.guestPeer && p.presence && p.presence.role === 'guest');
  if (!g) {
    const cand = peers.find(p => !p.isMe && p.presence && p.presence.role === 'guest' && p.presence.code === NET.code);
    if (cand) {
      if (!NET.guestPeer) NET.lastSeq = 0;
      NET.guestPeer = cand.peer;
      g = cand;
    }
  }
  const wasGone = NET.gone;
  NET.gone = !g;
  if (!NET.gone && wasGone) $('#netwarn').hidden = true;
  if (!g) return;
  if (g.presence.quit) {
    oppQuit();
    return;
  }
  if (g.presence.sid !== NET.guestSid) {
    // a new session of the guest (he left and joined again): his command numbers start at 1 again
    NET.guestSid = g.presence.sid;
    NET.lastSeq = 0;
  }
  for (const c of Array.isArray(g.presence.cmds) ? g.presence.cmds : [])
    if (c && c.s > NET.lastSeq) {
      NET.lastSeq = c.s;
      applyCmd(G, 1, c);
    }
  const In = g.presence.in;
  G.teams[1].posIn = In && typeof In === 'object' && In.id === G.teams[1].pos ? In : null;
  NET.guestPres = g.presence;
  if (g.presence.hpk && g.presence.hpk !== NET.lastHpk) {
    NET.lastHpk = g.presence.hpk;
    NET.rtt = Math.max(0, now() - g.presence.hpk);
  }
}
/* ---------- online rematch: both press, the host deals a new map in the same room ---------- */
function rematchTick() {
  if (!NET.r || V.playing) {
    clearInterval(NET.endPoll);
    NET.endPoll = null;
    return;
  }
  const peers = NET.r.peers() || [],
    other = peers.find(
      p => !p.isMe && p.presence && p.presence.role === (V.mode === 'host' ? 'guest' : 'host') && p.presence.code === NET.code
    );
  const b = $('#btnRematch'),
    n = $('#rematchNote');
  if (!other) {
    // one missed presence read is no reason to give up the rematch: he counts as gone after 5 s
    NET.rmMiss = NET.rmMiss || now();
    if (now() - NET.rmMiss < 5000) return;
    b.hidden = true;
    n.textContent = TR('Dein Gegner hat den Raum verlassen.');
    clearInterval(NET.endPoll);
    NET.endPoll = null;
    if (V.mode === 'host') leaveNet();
    return;
  }
  NET.rmMiss = 0;
  NET.rmOther = !!other.presence.rm && other.presence.rm === NET.endSeed;
  if (V.mode === 'guest' && other.presence.st === 'play' && Number.isFinite(other.presence.sd) && other.presence.sd !== NET.endSeed) {
    clearInterval(NET.endPoll);
    NET.endPoll = null;
    showScreen(null);
    beginMatch('guest', other.presence.fa, 1, other.presence.sd);
    return;
  }
  if (NET.rmWant && NET.rmOther && V.mode === 'host') {
    clearInterval(NET.endPoll);
    NET.endPoll = null;
    const facs = G.teams.map(t => t.fac),
      seed = newSeed();
    G = newGame(facs, seed, gameMode === 'chaos', { fog: gameMode === 'fog' });
    showScreen(null);
    beginMatch('host', facs, 0, seed);
    pushSnap(snapOf(G));
    startSim(false);
    hostBroadcast();
    return;
  }
  b.textContent = NET.rmWant
    ? TR('Warte auf Gegner …')
    : NET.rmOther
      ? TR('Gegner will nochmal! Noch eine Runde!')
      : TR('Noch eine Runde!');
  b.classList.toggle('pulse', NET.rmOther && !NET.rmWant);
  if (V.mode === 'host') hostBroadcast();
}
$('#btnRematch').addEventListener('click', () => {
  if (!NET.r) return;
  NET.rmWant = true;
  NET.r.presence({ rm: NET.endSeed }).catch(() => {});
  $('#btnRematch').textContent = TR('Warte auf Gegner …');
  SFX.play('order');
});
function hostBroadcast() {
  if (!NET.r || !G) return;
  const patch = {
    hp: Math.round(now()),
    pk: NET.guestPres ? NET.guestPres.gp2 : 0,
    role: 'host',
    code: NET.code,
    v: NET_VER,
    fa: G.teams.map(t => t.fac),
    sd: G.seed,
    st: 'play',
    gp: NET.guestPeer,
    rm: NET.rmWant ? NET.endSeed : null,
    ack: NET.lastSeq,
    snap: NET.displaySnap && NET.displaySnap.t === +G.t.toFixed(2) ? NET.displaySnap : snapOf(G),
  };
  try {
    const fp = faceChunkPatch(NET.guestPres);
    patch.fc = fp && fp.fc ? fp.fc : null;
    const got = faceChunkRecv(NET.guestPres);
    if (got) Object.assign(patch, got);
  } catch (e) {
    patch.fc = null;
  }
  if (patch.fc && JSON.stringify(patch).length > 3500) patch.fc = null;
  // Native P2P, MQTT and local transport retain the entire army.
  if (NET.via === 'claude' && JSON.stringify(patch).length > 3900) {
    netWarn(TR('Diese Verbindung ist für die Armee zu klein. Bitte beide Geräte direkt über die Spieladresse verbinden.'));
    return;
  }
  NET.r.presence(patch).catch(() => {});
}
async function joinOnline(code, opt = {}) {
  code = String(code || '').replace(/\s/g, '');
  if (!new RegExp('^[0-9]{' + CODE_LENGTH + '}$').test(code)) {
    $('#codeIn').focus();
    const s = $('#onlineStatus'); // right under the code field, where the player looks
    s.hidden = false;
    s.classList.remove('dots');
    s.textContent = TR('Bitte gib den vierstelligen Zahlencode ein.');
    return;
  }
  leaveNet();
  FACE.other = null;
  NET.pub = !!opt.pub;
  NET.quick = opt.quick || null; // "Schnelles Spiel": the codes tried so far
  const attempt = NET.connectAttempt;
  showLobby(false, code, TR('Suche Spiel'), true);
  let r;
  try {
    r = await openMulti(code, 'guest');
  } catch (e) {
    if (attempt === NET.connectAttempt) setLobbyStatus(netErrMsg(e), false);
    return;
  }
  if (attempt !== NET.connectAttempt) {
    r.leave();
    return;
  }
  if (NET.connecting === r) NET.connecting = null;
  NET.r = r;
  NET.code = code;
  NET.role = 'guest';
  NET.joinT = now();
  NET.sid = Math.random().toString(36).slice(2, 8); // tells the host that this is a new session (fresh command numbers)
  await r.presence({ role: 'guest', code, v: NET_VER, sid: NET.sid, cmds: [], pf: profPublic() }).catch(() => {});
  if (attempt !== NET.connectAttempt) return;
  let lastT = -1;
  NET.poll = setInterval(() => {
    const peers = r.peers() || [];
    const hl = peers.filter(p => !p.isMe && p.presence && p.presence.role === 'host' && p.presence.code === code),
      host = r.pick ? r.pick(hl, 'host') : hl[0];
    if (hl.length && !host && V.mode !== 'guest') {
      setLobbyStatus(TR('Spiel gefunden, verbinde'), true);
      return;
    }
    if (host && r.lockTo) {
      r.lockTo(host);
      const mp = r.meOn(host._sub);
      if (mp) NET.myPeer = mp;
    } else {
      const me = peers.find(p => p.isMe && p.sameTab);
      if (me) NET.myPeer = me.peer;
    }
    NET.hostGone = !host && V.mode === 'guest' && V.playing; // counted down by oppLeftTick
    if (!host) {
      if (V.mode === 'guest' && V.playing) return;
      else if (now() - NET.joinT > 35000)
        setLobbyStatus(
          TR(
            'Kein Spiel mit diesem Code gefunden. Stimmt der Code? Tipp: Beide Geräte neu laden (damit beide die neueste Version haben) und neu erstellen.'
          ),
          true
        );
      return;
    }
    if (host.presence.v !== NET_VER && V.mode !== 'guest') {
      setLobbyStatus(
        TR('Dein Gegner hat eine andere Spielversion. Bitte beide Geräte neu laden (dann habt ihr beide die neueste).'),
        false
      );
      return;
    }
    const P = host.presence;
    if (V.mode === 'guest' && V.playing && P.quit) {
      oppQuit();
      return;
    }
    if (P.gp && NET.myPeer && P.gp !== NET.myPeer && V.mode !== 'guest') {
      setLobbyStatus(TR('Dieses Spiel ist schon voll.'), false);
      if (NET.quick && NET.quick.length < 4) {
        const skip = NET.quick;
        toMenu();
        quickMatch(skip); // someone else was faster: the next open game, or an own one
      }
      return;
    }
    if (V.mode !== 'guest' && P.st === 'no') {
      setLobbyStatus(TR('Dein Gegner übt lieber noch weiter. Such dir ein anderes Spiel.'), false);
      return;
    }
    if (V.mode !== 'guest' && P.st === 'wait' && P.pr) setLobbyStatus(TR('Gegner gefunden! Er beendet gerade sein Übungsspiel …'), true);
    // start the match; after an end screen also the next round, in case the rematch poll gave up too early
    const next = V.mode === 'guest' && !V.playing && !NET.endPoll && NET.endSeed && P.sd !== NET.endSeed;
    if ((V.mode !== 'guest' || next) && P.st === 'play' && P.gp === NET.myPeer && Array.isArray(P.fa) && Number.isFinite(P.sd)) {
      showScreen(null);
      V.oppPf = profPeer(P.pf);
      beginMatch('guest', P.fa, 1, P.sd);
    }
    try {
      const fp = faceChunkPatch(P),
        got = faceChunkRecv(P);
      if (fp !== undefined || got) r.presence(Object.assign({ fc: fp && fp.fc ? fp.fc : null }, got || {})).catch(() => {});
    } catch (_) {}
    if (V.mode === 'guest') {
      if (!NET.quitAt) $('#netwarn').hidden = true;
      if (P.pk && P.pk !== NET.lastPk) {
        NET.lastPk = P.pk;
        NET.rtt = Math.max(0, now() - P.pk);
      }
      if (P.hp && now() - (NET.pingT || 0) > 1000) {
        NET.pingT = now();
        r.presence({ gp2: Math.round(now()), hpk: P.hp }).catch(() => {});
      }
      if (
        P.snap &&
        (P.snap.t !== lastT ||
          P.snap.cd !== (V.latest && V.latest.cd) ||
          P.snap.pz !== (V.latest && V.latest.pz) ||
          String(P.snap.pn) !== String(V.latest && V.latest.pn) ||
          String(P.snap.of) !== String(V.latest && V.latest.of))
      ) {
        if (P.snap.t !== lastT) {
          const tn = now();
          if (NET.lastArr) {
            (NET.gaps || (NET.gaps = [])).push((tn - NET.lastArr) / 1000);
            if (NET.gaps.length > 30) NET.gaps.shift();
            const g2 = NET.gaps.slice().sort((a, b) => a - b);
            V.delayTarget = clamp(g2[Math.floor(g2.length * 0.9)] + 0.035, 0.1, 0.35);
          }
          NET.lastArr = tn;
        }
        lastT = P.snap.t;
        pushSnap(P.snap);
      }
      if (typeof P.ack === 'number' && NET.pending.length && NET.pending[0].s <= P.ack) {
        NET.pending = NET.pending.filter(c => c.s > P.ack);
        r.presence({ cmds: NET.pending }).catch(() => {});
      }
    }
  }, 50);
}
