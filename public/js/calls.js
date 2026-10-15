/* ---------- 📞 Calls (AIG-1162): voice, video and screen share over LiveKit (lifted from ChilledChat's voice-livekit.js) ---------- */
// Generic: Call.join({ title, getToken }) opens one floating call panel (participant tiles; Mic, Camera, Share screen, Leave).
// getToken() answers { url, token, room? } from the board (room: the call must be that one, checked once joined); the room is inside the token, so any caller (a friend's DM now, a project's
// Meeting Room later) only says how to get one. livekit-client comes from jsDelivr, pinned, with SRI (like xterm in terminal.js).
// Screen share is video only: no system audio, so the other callers' voices never echo back to them.
// AIG-1300: thanks to ChilledChat (calls, screen share, replies, reactions, typing). Its web address goes here once there is one; empty = the name as plain text.
const CHILLEDCHAT_URL = 'https://chat.chilleddvs.com';   // AIG-1312: the in-call credit, like the radio's 'riding Chilled Frequencies'
const chilledChat = () => CHILLEDCHAT_URL ? `<a href="${esc(CHILLEDCHAT_URL)}" target="_blank" rel="noopener noreferrer"><strong>ChilledChat</strong></a>` : '<strong>ChilledChat</strong>';
const Call = (() => {
  const SWAP_MS = 3000;   // AIG-1171: alone in a call on my own server, ask this often whether to move to the friend's (opts.swap)
  const LIB = ['https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/dist/livekit-client.umd.js', 'sha384-G/xxtkVytOx/ia9Q8MXxM+V0ohsaY1fZAgVP3iSGTPz4wJ0s3+ulJNKXh/gnzEDZ'];
  // gen: bumped by every join and every leave, so a join that was left (or replaced) while it waited stops there (AIG-1171).
  // pending: the room still connecting, so Leave can disconnect it. busy: the gen of the join under way (0: none).
  let lib = null, room = null, title = '', busy = 0, gen = 0, pending = null;
  // AIG-1241/1243/1244/1245: recon = the connection dropped and is coming back; t0 = when the call started (the timer); mini = the panel folded to a pill; tick = the timer's interval; devs = the device picker is open
  let recon = false, t0 = 0, mini = false, tick = 0, devs = false;
  const el = id => document.getElementById(id);
  const load = () => lib || (lib = new Promise((ok, no) => {
    if (window.LivekitClient) return ok(window.LivekitClient);
    const s = Object.assign(document.createElement('script'), { src: LIB[0], integrity: LIB[1], crossOrigin: 'anonymous' });
    s.onload = () => window.LivekitClient ? ok(window.LivekitClient) : no(new Error(t('lkcall.nolib')));
    s.onerror = () => { lib = null; no(new Error(t('lkcall.nolib'))); };
    document.head.appendChild(s);
  }));

  /* ---------- the panel ---------- */
  function panel() {
    let p = el('callPanel');
    if (!p) { p = document.createElement('div'); p.id = 'callPanel'; p.className = 'call-panel'; p.setAttribute('role', 'dialog'); document.body.appendChild(p); }
    p.setAttribute('aria-label', t('lkcall.aria', { name: title }));
    p.classList.toggle('mini', mini);
    return p;
  }
  // Just a message (calls not set up, or an error) with a Close button.
  function note(head, text, link) {
    mini = false; devs = false; stopTick(); const p = panel(); dropVids();
    p.innerHTML = `<div class="call-head"><b>${esc(head)}</b><span style="flex:1"></span><button type="button" class="call-x" onclick="Call.close()" title="${esc(t('common.close'))}">✕</button></div>
      <p class="call-note" id="callNote">${esc(text)}</p>${link ? `<div class="actions"><button type="button" id="callNoteGo" onclick="Call.close();location.hash='${esc(link.href)}'">${esc(link.text)}</button></div>` : ''}`;
    p.hidden = false;
  }
  // AIG-1243: mm:ss (h:mm:ss after an hour)
  const clock = () => { const s = t0 ? Math.max(0, Math.floor((Date.now() - t0) / 1000)) : 0, h = Math.floor(s / 3600), m = String(Math.floor(s / 60) % 60).padStart(h ? 2 : 1, '0'), x = String(s % 60).padStart(2, '0'); return (h ? h + ':' : '') + m + ':' + x; };
  const stopTick = () => { if (tick) clearInterval(tick); tick = 0; t0 = 0; recon = false; };
  const stateText = () => recon ? t('lkcall.reconnecting') : room ? t('lkcall.people', { n: 1 + room.remoteParticipants.size }) : t('lkcall.joining');
  const live = text => { const x = el('callLive'); if (x) x.textContent = text; };   // AIG-1246: said aloud by screen readers
  function paint() {
    const p = panel(), lp = room && room.localParticipant;
    const on = lp ? { mic: lp.isMicrophoneEnabled, cam: lp.isCameraEnabled, screen: lp.isScreenShareEnabled } : {};
    const b = (id, key, act, pressed) => `<button type="button" id="${id}" class="${pressed ? 'on' : ''}" aria-pressed="${!!pressed}" onclick="Call.${act}()">${esc(t(key))}</button>`;
    const head = `<div class="call-head"${mini ? ' onclick="Call.mini(false)" title="' + esc(t('lkcall.open')) + '"' : ''}><b>📞 ${esc(title)}</b> <span class="muted" id="callState" role="status">${esc(stateText())}</span>${room ? `<span class="muted" id="callTime">${clock()}</span>` : ''}<span style="flex:1"></span><button type="button" id="callMini" class="call-x" aria-expanded="${!mini}" onclick="Call.mini(!${mini})" title="${esc(t(mini ? 'lkcall.open' : 'lkcall.shrink'))}" aria-label="${esc(t(mini ? 'lkcall.open' : 'lkcall.shrink'))}">${mini ? '▢' : '▁'}</button></div>`;
    const bar = `<div class="call-bar">${b('callMic', on.mic ? 'lkcall.mic.off' : 'lkcall.mic.on', 'mic', on.mic)}${b('callCam', on.cam ? 'lkcall.cam.off' : 'lkcall.cam.on', 'cam', on.cam)}${b('callScreen', on.screen ? 'lkcall.screen.off' : 'lkcall.screen.on', 'screen', on.screen)}<button type="button" id="callDevBtn" class="call-x" aria-pressed="${devs}" aria-label="${esc(t('lkcall.dev'))}" title="${esc(t('lkcall.dev'))}" onclick="Call.devices()">⚙</button><button type="button" id="callLeave" class="bad" onclick="Call.leave()">${esc(t('lkcall.leave'))}</button></div>`;
    // AIG-1171: the tiles box stays when it is there (its videos keep playing); only the head and the buttons are redrawn
    if (el('callTiles') && p.contains(el('callTiles'))) { p.querySelector('.call-head').outerHTML = head; p.querySelector('.call-bar').outerHTML = bar; }
    else { dropVids(); p.innerHTML = head + '<div class="call-tiles" id="callTiles"></div>' + bar + '<div class="call-devs" id="callDevs"' + (devs ? '' : ' hidden') + '></div><div class="err" id="callErr" role="alert"></div><div class="call-live" id="callLive" aria-live="polite"></div><p class="call-credit muted" id="callCredit">' + esc(t('lkcall.credit', { name: '{name}' })).replace('{name}', chilledChat()) + '</p>'; }
    p.setAttribute('aria-label', t('lkcall.aria', { name: title })); p.classList.toggle('mini', mini);
    p.hidden = false;
    if (devs) devList();
    tiles(); tap();
  }
  // One tile per person: their camera (or screen share) if any, else their name. Audio plays from hidden elements.
  // AIG-1171: tiles and videos are kept and updated, not rebuilt: each track is attached once (vids), and a track that is gone
  // (unpublished, muted, its person left) is detached and its video removed, so repaints never pile up video elements.
  const vids = new Map();   // track -> its <video>
  function dropVids(keep) { for (const [tr, v] of vids) if (!keep || !keep.has(tr)) { try { tr.detach(v); } catch {} v.remove(); vids.delete(tr); } }
  function tiles() {
    const box = el('callTiles'); if (!box || !room) return;
    const LK = window.LivekitClient, S = LK.Track.Source;
    const people = [room.localParticipant, ...room.remoteParticipants.values()];
    const keep = new Set(), old = new Map([...box.children].map(x => [x.dataset.who, x]));
    people.forEach((p, i) => {
      const local = p === room.localParticipant;
      const pubs = [S.ScreenShare, S.Camera].map(s => p.getTrackPublication(s)).filter(x => x && x.track && !x.isMuted);
      let tile = old.get(p.identity); old.delete(p.identity);
      if (!tile) { tile = document.createElement('div'); tile.dataset.who = p.identity; }
      tile.className = 'call-tile' + (p.isSpeaking ? ' speaking' : '');
      const kids = pubs.map(pub => {
        keep.add(pub.track);
        let v = vids.get(pub.track);
        if (!v) { v = pub.track.attach(); v.muted = true; v.playsInline = true; vids.set(pub.track, v); }
        v.classList.toggle('mirror', local && pub.source === S.Camera);
        return v;
      });
      if (!pubs.length) { const a = tile.querySelector('.call-av') || Object.assign(document.createElement('div'), { className: 'call-av' }); a.textContent = (p.name || p.identity || '?').slice(0, 1).toUpperCase(); kids.push(a); }
      const n = tile.querySelector('.call-name') || Object.assign(document.createElement('div'), { className: 'call-name' }); n.textContent = (p.name || p.identity) + (local ? ' ' + t('lkcall.you') : ''); kids.push(n);
      // AIG-1243: a muted mic is marked on the tile (and named for screen readers)
      let mk = tile.querySelector('.call-mute');
      if (!p.isMicrophoneEnabled) { if (!mk) { mk = Object.assign(document.createElement('div'), { className: 'call-mute', textContent: '🔇' }); mk.setAttribute('role', 'img'); } mk.setAttribute('aria-label', t('lkcall.muted', { name: p.name || p.identity })); kids.push(mk); }
      kids.forEach((k, j) => { if (tile.children[j] !== k) tile.insertBefore(k, tile.children[j] || null); });   // only moves what is out of place
      while (tile.children.length > kids.length) tile.lastElementChild.remove();
      if (box.children[i] !== tile) box.insertBefore(tile, box.children[i] || null);
    });
    old.forEach(x => x.remove());
    dropVids(keep);
    const st = el('callState'); if (st) st.textContent = stateText();
  }
  // AIG-1240: the browser's NotAllowedError / NotFoundError in plain words, for the mic and the camera (kind: mic | cam | screen)
  function plainErr(e, kind) {
    const nm = (e && e.name) || '', msg = String((e && e.message) || e || '');
    if (kind === 'screen' && nm === 'NotAllowedError') return '';   // the person just closed the share picker
    if (kind === 'mic' || kind === 'cam') {
      if (/NotAllowed|Security|PermissionDenied/i.test(nm) || /permission|not allowed|denied/i.test(msg)) return t('lkcall.err.' + kind + '.blocked');
      if (/NotFound|Overconstrained|DevicesNotFound/i.test(nm) || /not found|no (device|camera|microphone)|requested device/i.test(msg)) return t('lkcall.err.' + kind + '.none');
      if (/NotReadable|TrackStart|Abort/i.test(nm)) return t('lkcall.err.' + kind + '.busy');
    }
    return PagePoll.plain(msg, 0);
  }
  // AIG-1239: the browser blocked sound until the page is tapped: a Tap to hear button above the buttons until room.startAudio() works.
  function tap() {
    const p = el('callPanel'), old = el('callTap'), blocked = !!(room && p && !p.hidden && room.canPlaybackAudio === false);
    if (!blocked) { if (old) old.remove(); return; }
    if (old) return;
    const b = Object.assign(document.createElement('button'), { type: 'button', id: 'callTap', className: 'call-tap', textContent: t('lkcall.tap') });
    b.onclick = startAudio;
    p.insertBefore(b, p.querySelector('.call-bar'));
  }
  async function startAudio() { try { if (room) await room.startAudio(); } catch (e) { err(e); } tap(); }
  const err = (e, kind) => { const x = el('callErr'); if (x) x.textContent = e ? plainErr(e, kind) : ''; };
  // AIG-1245: pick the microphone, camera and speaker (browsers that cannot switch the speaker simply list none)
  async function devList() {
    const box = el('callDevs'), LK = window.LivekitClient; if (!box || !room || !LK) return;
    const kinds = [['audioinput', 'lkcall.dev.mic'], ['videoinput', 'lkcall.dev.cam'], ['audiooutput', 'lkcall.dev.spk']], r = room;
    const rows = [];
    for (const [k, key] of kinds) {
      let list = []; try { list = await LK.Room.getLocalDevices(k); } catch {}
      if (!list.length) continue;
      let cur = ''; try { cur = r.getActiveDevice(k) || ''; } catch {}
      rows.push(`<label>${esc(t(key))} <select data-kind="${k}" onchange="Call.pick(this.dataset.kind, this.value)">${list.map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? ' selected' : ''}>${esc(d.label || t(key) + ' ' + (i + 1))}</option>`).join('')}</select></label>`);
    }
    if (room === r && el('callDevs') === box) box.innerHTML = rows.join('') || `<span class="muted">${esc(t('lkcall.dev.none'))}</span>`;
  }
  async function pick(kind, id) { if (!room) return; err(''); try { await room.switchActiveDevice(kind, id); } catch (e) { err(e, kind === 'audioinput' ? 'mic' : kind === 'videoinput' ? 'cam' : ''); } }
  function devices() { devs = !devs; const b = el('callDevs'); if (b) b.hidden = !devs; const g = el('callDevBtn'); if (g) g.setAttribute('aria-pressed', devs); if (devs) devList(); }
  function shrink(v) { mini = !!v; if (room) paint(); }
  // why a call ended on its own (LiveKit's DisconnectReason numbers); anything else = the connection was lost
  const endWhy = n => ({ 2: 'lkcall.end.dup', 3: 'lkcall.end.closed', 4: 'lkcall.end.removed', 5: 'lkcall.end.closed' })[n] || 'lkcall.end.lost';

  /* ---------- joining and leaving ---------- */
  // opts: { title, getToken: async () => ({ url, token, room?, theirs? }), swap?: async () => bool }. One call at a time: a second
  // join leaves the first. swap (AIG-1171): while alone in a call on my own server (not theirs), true = leave it and join again.
  async function join(opts) {
    if (busy) return;
    const g = busy = ++gen; let r = null;
    try {
      const old = room || pending; room = null; pending = null;
      if (old) { try { await old.disconnect(); } catch {} cleanup(); }
      if (g !== gen) return;
      title = opts.title || ''; paint();
      const LK = await load(), tk = await opts.getToken();
      if (g !== gen) return;   // left while the token came
      r = pending = new LK.Room({ adaptiveStream: true, dynacast: true, publishDefaults: { simulcast: true, dtx: true, red: true } });
      const E = LK.RoomEvent, again = () => { if (room === r) tiles(); };
      r.on(E.TrackSubscribed, (track, pub, p) => { if (g !== gen) return; if (track.kind === 'audio') { const a = track.attach(); a.className = 'call-audio'; a.dataset.who = p.identity; a.hidden = true; document.body.appendChild(a); } again(); })
        .on(E.TrackUnsubscribed, track => { track.detach().forEach(x => x.remove()); again(); })
        .on(E.ParticipantConnected, p => { again(); live(t('lkcall.joined', { name: p.name || p.identity })); }).on(E.ParticipantDisconnected, p => { again(); live(t('lkcall.left', { name: p.name || p.identity })); }).on(E.ActiveSpeakersChanged, again)
        .on(E.AudioPlaybackStatusChanged, () => { if (room === r || pending === r) tap(); })
        .on(E.TrackMuted, again).on(E.TrackUnmuted, again).on(E.LocalTrackPublished, () => room === r && paint()).on(E.LocalTrackUnpublished, () => room === r && paint())
        .on(E.Reconnecting, () => { if (room === r) { recon = true; const st = el('callState'); if (st) st.textContent = stateText(); } })
        .on(E.Reconnected, () => { if (room === r) { recon = false; const st = el('callState'); if (st) st.textContent = stateText(); } })
        .on(E.Disconnected, reason => { if (room === r) { room = null; cleanup(); note(t('lkcall.ended'), t(endWhy(reason))); } });
      await r.connect(tk.url, tk.token);
      if (g !== gen) { try { await r.disconnect(); } catch {} return; }   // Leave was pressed while connecting: never turn the mic on
      // AIG-1171: the board said which room this token is for; a token for any other room is left before the mic goes on.
      if (tk.room && r.name !== tk.room) { try { await r.disconnect(); } catch {} throw new Error(t('lkcall.wrongroom')); }
      pending = null; room = r; t0 = Date.now(); recon = false; mini = false; devs = false; if (tick) clearInterval(tick); tick = setInterval(() => { const x = el('callTime'); if (x) x.textContent = clock(); }, 1000); paint();
      try { await r.localParticipant.setMicrophoneEnabled(true); } catch (e) { err(e, 'mic'); }   // no mic (or it was refused): still in the call, listening
      if (g === gen) paint();
      if (opts.swap && !tk.theirs) watch(g, r, opts);
    } catch (e) {
      if (g === gen) { room = null; note(t('lkcall.h'), PagePoll.plain((e && e.message) || String(e), 0)); }
      else if (r) { try { await r.disconnect(); } catch {} }   // left meanwhile: no message, just make sure it is gone
    } finally { if (pending === r) pending = null; if (busy === g) busy = 0; }
  }
  // Both pressed Call at once: each is alone on their own server. The board says whose server wins; the one that loses moves.
  function watch(g, r, opts) {
    const tick = async () => {
      if (g !== gen || room !== r) return;
      if (!busy && !r.remoteParticipants.size) {
        let go = false; try { go = await opts.swap(); } catch {}
        if (go && g === gen && room === r && !busy && !r.remoteParticipants.size) return join(opts);
      }
      setTimeout(tick, SWAP_MS);
    };
    setTimeout(tick, SWAP_MS);
  }
  const toggle = async (fn, kind) => { if (!room) return; err(''); let bad = null; try { await fn(room.localParticipant); } catch (e) { bad = e; } paint(); if (bad) err(bad, kind); };
  const mic = () => toggle(lp => lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled), 'mic');
  const cam = () => toggle(lp => lp.setCameraEnabled(!lp.isCameraEnabled), 'cam');
  const screen = () => toggle(lp => lp.setScreenShareEnabled(!lp.isScreenShareEnabled, { audio: false }), 'screen');
  function cleanup() { stopTick(); mini = false; devs = false; dropVids(); document.querySelectorAll('.call-audio').forEach(a => a.remove()); const p = el('callPanel'); if (p) { p.hidden = true; p.innerHTML = ''; p.classList.remove('mini'); } }
  // Leave also stops a join still on its way: its room is disconnected, and the join sees gen moved on.
  async function leave() { gen++; busy = 0; const r = room || pending; room = null; pending = null; if (r) { try { await r.disconnect(); } catch {} } cleanup(); }
  function close() { if (!room) cleanup(); }
  /* ---------- an incoming call: a Join button, a ring and a notification (AIG-1237, AIG-1238) ---------- */
  const FRESH_MS = 15 * 60000, RING_MS = 90000;   // a call line is joinable for 15 minutes; only a call that just arrived rings
  const fresh = at => { const x = Date.parse(at); return Number.isFinite(x) && Date.now() - x < FRESH_MS; };
  const rung = new Map(); let primed = false, ringTimer = null;   // contact -> the lastIn that already rang; the first look never rings (old calls)
  function ring(people) {
    for (const c of people || []) {
      if (!(c.lastDir === 'in' && c.lastKind === 'call' && c.lastIn) || rung.get(c.id) === c.lastIn) continue;
      rung.set(c.id, c.lastIn);
      if (!primed || Date.now() - Date.parse(c.lastIn) > RING_MS || room || pending) continue;
      const ib = typeof IB !== 'undefined' ? IB : null;
      if (!ib || !ib.alertsOn || !ib.alertsOn() || document.documentElement.hasAttribute('data-focus') || document.documentElement.hasAttribute('data-break')) continue;   // same rules as the inbox beep
      let n = 0; clearInterval(ringTimer);
      const beep = () => { if (n++ >= 4 || room || pending) return clearInterval(ringTimer); try { ib.beep(); } catch {} };
      beep(); ringTimer = setInterval(beep, 1500);
      try {
        const nt = new Notification(t('lkcall.ring', { name: c.name }), { body: t('lkcall.ring.body'), tag: 'aigile-call-' + c.id });
        nt.onclick = () => { clearInterval(ringTimer); notifyGo({ chat: 'dm:' + c.id }); nt.close(); dmCall(c.id, c.name); };
      } catch {}
    }
    primed = true;
  }
  return { join, leave, close, note, fresh, ring, startAudio, mic, cam, screen, mini: shrink, devices, pick, active: () => !!room, get room() { return room; } };
})();

/* ---------- 📞 in a friend's DM ---------- */
// Asks the board what this DM can do: the relay's call server or my own LiveKit, or a call the friend started (their guest token).
// None of those: calls are not available right now (AIG-1218).
async function dmCall(cid, name) {
  let st;
  try { st = await api('GET', `/api/calls/dm/${encodeURIComponent(cid)}`); } catch (e) { return Call.note(t('lkcall.h'), e.message); }
  if (!st.set && !st.invite) return Call.note(t('lkcall.h'), t('lkcall.off'), { href: '#/setup/calls', text: t('lkcall.notset.go') });
  Call.join({ title: name, getToken: () => api('POST', `/api/calls/dm/${encodeURIComponent(cid)}/token`, {}),
    swap: async () => (await api('GET', `/api/calls/dm/${encodeURIComponent(cid)}`)).theirs === true });
}

/* ---------- 🎥 a project's Meeting Room (AIG-1168) ---------- */
async function meetingCall(slug, name) {
  let st;
  try { st = await api('GET', `/api/calls/meeting/${encodeURIComponent(slug)}`); } catch (e) { return Call.note(t('lkcall.h'), e.message); }
  if (!st.set) return Call.note(t('lkcall.h'), t('lkcall.off'), { href: '#/setup/calls', text: t('lkcall.notset.go') });
  Call.join({ title: name, getToken: () => api('POST', `/api/calls/meeting/${encodeURIComponent(slug)}/token`, {}) });
}

/* ---------- Setup > Calls (LiveKit) ---------- */
// AIG-1218: calls work out of the box through AI-gile's own call server (the relay hands out passes); this box only says so.
// "Use my own LiveKit server" is folded under Advanced: the address and API key are shown; the API secret is saved with the
// secrets page token and never comes back to the page.
const CallSetup = (() => {
  const S = { st: null, msg: '', ok: '', adv: false };
  const el = id => document.getElementById(id);
  function html() {
    if (!S.st) { queueMicrotask(load); return `<span>${esc(t('lkcall.set.title'))}</span>`; }
    const st = S.st;
    const head = `<span>${esc(t('lkcall.set.title'))}</span> <b id="callSetState" class="pill">${esc(t(st.relay ? 'lkcall.set.works' : 'lkcall.set.na'))}</b>
      <small class="muted">${esc(t(st.relay ? 'lkcall.set.works.help' : 'lkcall.set.na.help'))}${st.own ? ' ' + esc(t('lkcall.set.own')) : ''}</small>`;
    return head + `<details id="callSetAdv"${st.own || S.adv ? ' open' : ''} ontoggle="CallSetup.adv(this.open)" style="margin-top:6px"><summary>${esc(t('lkcall.set.adv'))}</summary>
      <b id="callOwnState" class="pill">${esc(t(st.own ? 'lkcall.set.on' : 'lkcall.set.off'))}</b>
      <small class="muted">${esc(t('lkcall.set.help'))} <a href="https://docs.livekit.io/home/get-started/intro-to-livekit/" target="_blank" rel="noopener noreferrer">${esc(t('lkcall.set.link'))}</a></small>
      <div style="display:flex;flex-direction:column;gap:6px;margin:6px 0;max-width:460px">
        <input type="text" id="callSetUrl" maxlength="300" spellcheck="false" value="${esc(st.url)}" placeholder="wss://livekit.example.com" aria-label="${esc(t('lkcall.set.url'))}" title="${esc(t('lkcall.set.url'))}">
        <input type="text" id="callSetKey" maxlength="120" spellcheck="false" autocomplete="off" value="${esc(st.key)}" placeholder="${esc(t('lkcall.set.key'))}" aria-label="${esc(t('lkcall.set.key'))}">
        <input type="password" id="callSetSecret" maxlength="200" spellcheck="false" autocomplete="off" placeholder="${esc(t(st.secret ? 'lkcall.set.secret.kept' : 'lkcall.set.secret'))}" aria-label="${esc(t('lkcall.set.secret'))}">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="callSetSave" onclick="CallSetup.save()">${esc(t('common.save'))}</button>${st.url || st.secret ? `<button type="button" id="callSetClear" onclick="CallSetup.save(true)">${esc(t('lkcall.set.clear'))}</button>` : ''}</div>
      ${S.msg ? `<div class="err" id="callSetErr">${esc(S.msg)}</div>` : ''}${S.ok ? `<div class="muted" id="callSetOk">${esc(S.ok)}</div>` : ''}</details>`;
  }
  const paint = () => { const b = el('callsBox'); if (b) b.innerHTML = html(); };
  async function load() { try { S.st = await api('GET', '/api/calls'); } catch { S.st = { set: false, own: false, relay: false, url: '', key: '', secret: false }; } paint(); }
  async function save(clear) {
    const v = id => ((el(id) || {}).value || '').trim();
    try { S.st = await api('POST', '/api/calls', clear ? { clear: true, token: await secToken() } : { url: v('callSetUrl'), key: v('callSetKey'), secret: v('callSetSecret'), token: await secToken() }); S.msg = ''; S.ok = t('lkcall.set.saved'); }
    catch (e) { S.msg = e.message; S.ok = ''; }
    paint();
  }
  return { html: () => { S.msg = ''; S.ok = ''; return html(); }, reset: () => { S.st = null; }, save, load, adv: v => { S.adv = !!v; } };
})();
