/* ---------- 📞 Calls (AIG-1162): voice, video and screen share over LiveKit (lifted from ChilledChat's voice-livekit.js) ---------- */
// Generic: Call.join({ title, getToken }) opens one floating call panel (participant tiles; Mic, Camera, Share screen, Leave).
// getToken() answers { url, token, room? } from the board (room: the call must be that one, checked once joined); the room is inside the token, so any caller (a friend's DM now, a project's
// Meeting Room later) only says how to get one. livekit-client comes from jsDelivr, pinned, with SRI (like xterm in terminal.js).
// Screen share is video only: no system audio, so the other callers' voices never echo back to them.
const Call = (() => {
  const SWAP_MS = 3000;   // AIG-1171: alone in a call on my own server, ask this often whether to move to the friend's (opts.swap)
  const LIB = ['https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/dist/livekit-client.umd.js', 'sha384-G/xxtkVytOx/ia9Q8MXxM+V0ohsaY1fZAgVP3iSGTPz4wJ0s3+ulJNKXh/gnzEDZ'];
  // gen: bumped by every join and every leave, so a join that was left (or replaced) while it waited stops there (AIG-1171).
  // pending: the room still connecting, so Leave can disconnect it. busy: the gen of the join under way (0: none).
  let lib = null, room = null, title = '', busy = 0, gen = 0, pending = null;
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
    return p;
  }
  // Just a message (calls not set up, or an error) with a Close button.
  function note(head, text, link) {
    const p = panel(); dropVids();
    p.innerHTML = `<div class="call-head"><b>${esc(head)}</b><span style="flex:1"></span><button type="button" class="call-x" onclick="Call.close()" title="${esc(t('common.close'))}">✕</button></div>
      <p class="call-note" id="callNote">${esc(text)}</p>${link ? `<div class="actions"><button type="button" id="callNoteGo" onclick="Call.close();location.hash='${esc(link.href)}'">${esc(link.text)}</button></div>` : ''}`;
    p.hidden = false;
  }
  function paint() {
    const p = panel(), lp = room && room.localParticipant;
    const on = lp ? { mic: lp.isMicrophoneEnabled, cam: lp.isCameraEnabled, screen: lp.isScreenShareEnabled } : {};
    const b = (id, key, act, pressed) => `<button type="button" id="${id}" class="${pressed ? 'on' : ''}" aria-pressed="${!!pressed}" onclick="Call.${act}()">${esc(t(key))}</button>`;
    const head = `<div class="call-head"><b>📞 ${esc(title)}</b> <span class="muted" id="callState">${esc(room ? t('lkcall.people', { n: 1 + room.remoteParticipants.size }) : t('lkcall.joining'))}</span><span style="flex:1"></span></div>`;
    const bar = `<div class="call-bar">${b('callMic', on.mic ? 'lkcall.mic.off' : 'lkcall.mic.on', 'mic', on.mic)}${b('callCam', on.cam ? 'lkcall.cam.off' : 'lkcall.cam.on', 'cam', on.cam)}${b('callScreen', on.screen ? 'lkcall.screen.off' : 'lkcall.screen.on', 'screen', on.screen)}<button type="button" id="callLeave" class="bad" onclick="Call.leave()">${esc(t('lkcall.leave'))}</button></div>`;
    // AIG-1171: the tiles box stays when it is there (its videos keep playing); only the head and the buttons are redrawn
    if (el('callTiles') && p.contains(el('callTiles'))) { p.querySelector('.call-head').outerHTML = head; p.querySelector('.call-bar').outerHTML = bar; }
    else { dropVids(); p.innerHTML = head + '<div class="call-tiles" id="callTiles"></div>' + bar + '<div class="err" id="callErr"></div>'; }
    p.hidden = false;
    tiles();
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
      const n = tile.querySelector('.call-name') || Object.assign(document.createElement('div'), { className: 'call-name' }); n.textContent = (p.name || p.identity) + (local ? ' ' + t('lkcall.you') : '') + (p.isMicrophoneEnabled ? '' : ' 🔇'); kids.push(n);
      kids.forEach((k, j) => { if (tile.children[j] !== k) tile.insertBefore(k, tile.children[j] || null); });   // only moves what is out of place
      while (tile.children.length > kids.length) tile.lastElementChild.remove();
      if (box.children[i] !== tile) box.insertBefore(tile, box.children[i] || null);
    });
    old.forEach(x => x.remove());
    dropVids(keep);
    const st = el('callState'); if (st) st.textContent = t('lkcall.people', { n: people.length });
  }
  const err = e => { const x = el('callErr'); if (x) x.textContent = PagePoll.plain((e && e.message) || String(e), 0); };

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
        .on(E.ParticipantConnected, again).on(E.ParticipantDisconnected, again).on(E.ActiveSpeakersChanged, again)
        .on(E.TrackMuted, again).on(E.TrackUnmuted, again).on(E.LocalTrackPublished, () => room === r && paint()).on(E.LocalTrackUnpublished, () => room === r && paint())
        .on(E.Disconnected, () => { if (room === r) { room = null; cleanup(); } });
      await r.connect(tk.url, tk.token);
      if (g !== gen) { try { await r.disconnect(); } catch {} return; }   // Leave was pressed while connecting: never turn the mic on
      // AIG-1171: the board said which room this token is for; a token for any other room is left before the mic goes on.
      if (tk.room && r.name !== tk.room) { try { await r.disconnect(); } catch {} throw new Error(t('lkcall.wrongroom')); }
      pending = null; room = r; paint();
      try { await r.localParticipant.setMicrophoneEnabled(true); } catch (e) { err(e); }   // no mic (or it was refused): still in the call, listening
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
  const toggle = async (fn, opts) => { if (!room) return; err(''); try { await fn(room.localParticipant, opts); } catch (e) { err(e); } paint(); };
  const mic = () => toggle(lp => lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled));
  const cam = () => toggle(lp => lp.setCameraEnabled(!lp.isCameraEnabled));
  const screen = () => toggle(lp => lp.setScreenShareEnabled(!lp.isScreenShareEnabled, { audio: false }));
  function cleanup() { dropVids(); document.querySelectorAll('.call-audio').forEach(a => a.remove()); const p = el('callPanel'); if (p) { p.hidden = true; p.innerHTML = ''; } }
  // Leave also stops a join still on its way: its room is disconnected, and the join sees gen moved on.
  async function leave() { gen++; busy = 0; const r = room || pending; room = null; pending = null; if (r) { try { await r.disconnect(); } catch {} } cleanup(); }
  function close() { if (!room) cleanup(); }
  return { join, leave, close, note, mic, cam, screen, active: () => !!room, get room() { return room; } };
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
