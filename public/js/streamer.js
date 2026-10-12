/* ---------- 🎥 Streamer mode (AIG-590..592) ---------- */
// While streaming: private projects (🔒, project settings), DMs, friends and life cards are left out of what the page fetches
// (api() calls Streamer.filter) and CSS hides the DM and friends parts (html[data-streamer]); passwords, keys, tokens, IP
// addresses, emails and server names show as •••• in every text on the page. One function, Streamer.mask(), does the masking,
// and a MutationObserver runs it over text nodes as they are drawn (card text, comments, terminal output, Setup > My servers).
// The real text stays in memory: Copy buttons and ▶ Run read Streamer.raw(el), and there is no hover reveal.
// On when the 🎥 switch is on (localStorage aigile.streamer) or, with Setup's "turn on by itself" ticked, while the board says
// OBS or Streamlabs is running (GET /api/streamer, checked by lib/streamer.js every 30 s; the page asks every 5 s).
const Streamer = (() => {
  const KEY = 'aigile.streamer', DOTS = '••••';
  let manual = false, auto = false, st = { auto: true, running: false, program: '', hide: {}, obs: { state: 'off', port: 4455 } }, hidden = new Set(), ready = null, note = null;
  try { manual = localStorage.getItem(KEY) === '1'; } catch {}
  // The stream window (AIG-631): opened by Setup's 🎥 Open stream window as /?stream=1; always in streamer mode, whatever the saved setting.
  const forced = /[?&]stream=1(&|$)/.test(location.search);
  const on = () => forced || manual || auto;
  // What streamer mode hides (Setup tick list, AIG-638; saved on the board): all on unless unticked. Personal projects are always hidden.
  const PARTS = ['private', 'dms', 'friends', 'life', 'secrets'];
  const hides = k => k === 'personal' || !st.hide || st.hide[k] !== false;

  /* ---- the one masking function ---- */
  const oct = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
  const PATTERNS = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, () => DOTS],
    // password: hunter2, token=abc123 ... only the value goes
    [/\b(pass(?:word|wd)?|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key)(\s*[:=]\s*)(["']?)([^\s"',;]{4,})\3/gi, (m, k, sep, q) => k + sep + q + DOTS + q],
    [/\bsk-[A-Za-z0-9_-]{16,}/g, () => DOTS],
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, () => DOTS],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, () => DOTS],
    [/\bAKIA[0-9A-Z]{16}\b/g, () => DOTS],
    [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, () => DOTS],
    [/\bAIza[0-9A-Za-z_-]{35}/g, () => DOTS],
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, () => DOTS],
    [/\b(Bearer\s+)[A-Za-z0-9._~+\/=-]{16,}/g, (m, b) => b + DOTS],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, () => DOTS],
    [new RegExp(`(?<![\\w.])${oct}(?:\\.${oct}){3}(?![\\w]|\\.\\d)`, 'g'), () => DOTS],
    [/(?<![\w:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![\w:])/gi, () => DOTS],
  ];
  // Server names from Setup > My servers: the name, the saved value and, for ssh, the host (user@host:port).
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function serverRe() {
    const list = (((state.setup || {}).prefs || {}).servers) || [], words = new Set();
    for (const s of list) {
      const n = String(s.name || '').trim(), v = String(s.value || '').trim();
      if (n.length >= 3) words.add(n);
      if (v && s.kind === 'ssh') { words.add(v); const h = v.replace(/^.*@/, '').replace(/:\d+$/, ''); if (h.length >= 3) words.add(h); }
    }
    const key = [...words].join('\n');
    if (serverRe.key !== key) { serverRe.key = key; serverRe.re = words.size ? new RegExp(`(?<![\\w-])(?:${[...words].sort((a, b) => b.length - a.length).map(reEsc).join('|')})(?![\\w-])`, 'gi') : null; }
    return serverRe.re;
  }
  function mask(s) {
    if (typeof s !== 'string' || s.length < 4 || !hides('secrets')) return s;
    for (const [re, fn] of PATTERNS) s = s.replace(re, fn);
    const sr = serverRe(); if (sr) s = s.replace(sr, DOTS);
    return s;
  }

  /* ---- text on the page: masked as it is drawn, the real text kept ---- */
  const rec = new Map();   // text node -> { raw, masked }
  const skip = n => { const p = n.parentElement; return !p || !!p.closest('script,style,textarea,input,[contenteditable],[data-nomask],.CodeMirror'); };
  function fix(n) {
    if (skip(n)) return;
    const r = rec.get(n), v = n.nodeValue;
    if (r && v === r.masked) return;
    const m = mask(v);
    if (m !== v) { rec.set(n, { raw: v, masked: m }); n.nodeValue = m; } else rec.delete(n);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) return fix(root);
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) fix(n);
  }
  function restore() { for (const [n, r] of rec) if (n.isConnected && n.nodeValue === r.masked) n.nodeValue = r.raw; rec.clear(); }
  // The real text of an element, for Copy and ▶ Run.
  function raw(el) {
    if (!el) return '';
    let out = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const r = rec.get(n); out += r && n.nodeValue === r.masked ? r.raw : n.nodeValue; }
    return out;
  }
  let queued = new Set(), busy = false, mo = null;
  function flush() {
    busy = true; try { for (const n of queued) if (n.isConnected) scan(n); } finally { queued = new Set(); busy = false; }
    for (const n of [...rec.keys()]) if (!n.isConnected) rec.delete(n);
  }
  function watch() {
    if (mo) return;
    mo = new MutationObserver(ms => {
      if (busy) return;
      for (const m of ms) { if (m.type === 'characterData') queued.add(m.target); else m.addedNodes.forEach(n => queued.add(n)); }
      flush();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ---- what is left out of the data ---- */
  // Called by api() with the answer; private projects, DMs, friends and life cards never reach the screens.
  // Left out while streaming: Personal projects (🏡, AIG-637) and Private ones (🔒).
  const out = p => !!(p && (p.personal || (p.private && hides('private'))));
  async function filter(method, url, j) {
    if (method !== 'GET' || !on()) return j;
    await ready;
    const path = url.split('?')[0];
    if (path === '/api/projects' && Array.isArray(j)) { j.forEach(p => out(p) && hidden.add(p.slug)); return j.filter(p => !out(p)); }
    if (path === '/api/inbox' && Array.isArray(j)) return j.filter(c => !hidden.has(c.project || c.slug) && !(c.lifeType && hides('life')));
    if (path === '/api/chats') return hides('dms') ? [] : j;
    if (path === '/api/dms/contacts' || path === '/api/shares') return hides('friends') ? [] : j;
    const m = path.match(/^\/api\/projects\/([^/]+)(\/.*)?$/);
    if (m && (hidden.has(m[1]) || (j && out(j) && !m[2]))) { hidden.add(m[1]); if (location.hash.includes(m[1])) location.hash = '#/'; throw new Error(t('streamer.private')); }
    if (m && !m[2] && j && Array.isArray(j.cards)) return hides('life') ? { ...j, cards: j.cards.filter(c => !c.lifeType) } : j;
    return j;
  }
  const prime = () => fetch('/api/projects?all=1').then(r => r.json()).then(l => { hidden = new Set(l.filter(out).map(p => p.slug)); }).catch(() => {});

  /* ---- the switch ---- */
  function apply(was, force) {
    const o = on();
    document.documentElement.toggleAttribute('data-streamer', o);
    for (const k of ['dms', 'friends', 'secrets']) document.documentElement.toggleAttribute('data-stream-' + k, o && hides(k));   // CSS hides these parts
    const b = $('streamBtn'); if (b) { b.disabled = forced; b.classList.toggle('stream-on', o); b.setAttribute('aria-pressed', String(o)); b.title = t(o ? 'streamer.title.on' : 'streamer.title'); }
    if (o) { ready = prime(); watch(); restore(); scan(document.body); if (!state.setup) api('GET', '/api/setup').then(s => { state.setup = s; scan(document.body); }).catch(() => {}); } else restore();
    if (was !== o || force) { ready = o ? prime() : ready; Promise.resolve(ready).then(() => { if (typeof Dms !== 'undefined') Dms.reload(); if (typeof refresh === 'function') refresh(true); if (typeof Inbox !== 'undefined' && Inbox.show && state.route && state.route.view === 'inbox') Inbox.show(true); }); }
    paintSetup(); paintLive();
  }
  function toggle() { if (forced) return; const was = on(); manual = !manual; if (!manual) auto = false; try { localStorage.setItem(KEY, manual ? '1' : '0'); } catch {} apply(was); }
  function toast(msg, offBtn) {
    if (note) note.remove();
    note = document.createElement('div'); note.id = 'streamNote'; note.setAttribute('role', 'status'); note.dataset.nomask = '1';
    note.innerHTML = `<span>${esc(msg)}</span>${offBtn ? ` <button type="button" onclick="Streamer.dismiss(true)">${esc(t('streamer.note.off'))}</button>` : ''}<button type="button" aria-label="${esc(t('common.close'))}" onclick="Streamer.dismiss()">✕</button>`;
    document.body.appendChild(note); setTimeout(() => { if (note) { note.remove(); note = null; } }, 9000);
  }
  function dismiss(turnOff) { if (note) { note.remove(); note = null; } if (turnOff) { const was = on(); auto = false; manual = false; st.suppressed = st.program; try { localStorage.setItem(KEY, '0'); } catch {} apply(was); } }
  // The board's word on OBS / Streamlabs. On by itself when one starts, off again when it stops (only if the page turned it on).
  async function poll() {
    let s; try { s = await fetch('/api/streamer', { cache: 'no-store' }).then(r => r.json()); } catch { return; }
    const was = on(), hideWas = JSON.stringify(st.hide); st = { ...st, ...s }; paintObs(); paintLive();
    if (JSON.stringify(st.hide) !== hideWas && was === on()) apply(was, true);   // the tick list was changed (maybe in another window)
    if (!s.running) st.suppressed = '';
    const want = s.auto && s.running && !st.suppressed;
    if (want && !auto && !manual) { auto = true; apply(was); toast(t('streamer.note.on', { program: s.program || 'OBS' }), true); }
    else if (!want && auto) { auto = false; apply(was); toast(t('streamer.note.ended')); }
  }
  /* ---- Setup > Streamer ---- */
  function setupHtml() {
    return `<span>${esc(t('streamer.setup.h'))}</span><label class="chk"><input type="checkbox" id="streamAuto" ${st.auto ? 'checked' : ''} onchange="Streamer.setAuto(this.checked)"> ${esc(t('streamer.setup.auto'))}</label>
      <small class="muted">${esc(t('streamer.setup.help'))}</small>
      <small class="muted" id="streamKey">${esc(t('streamer.setup.key'))}</small>
      <fieldset class="stream-obs" id="streamObs"><legend>${esc(t('streamer.obs.h'))}</legend>
        <small class="muted">${esc(t('streamer.obs.help'))}</small>
        <label>${esc(t('streamer.obs.port'))} <input type="number" id="obsPort" min="1" max="65535" value="${esc(String((st.obs || {}).port || 4455))}"></label>
        <label>${esc(t('streamer.obs.password'))} <input type="password" id="obsPass" autocomplete="off" data-nomask="1" placeholder="${esc((st.obs || {}).hasPassword ? t('streamer.obs.pw.saved') : '')}"></label>
        <div><button type="button" id="obsConnect" onclick="Streamer.obsConnect()">${esc(t('streamer.obs.connect'))}</button> <span id="obsState" role="status"></span></div>
      </fieldset>
      <fieldset class="stream-hide" id="streamHide"><legend>${esc(t('streamer.hide.h'))}</legend>
        ${['private', 'personal', 'dms', 'friends', 'life', 'secrets'].map(k => `<label class="chk"><input type="checkbox" data-hide="${k}" ${hides(k) ? 'checked' : ''} ${k === 'personal' ? 'disabled' : ''} onchange="Streamer.setHide('${k}', this.checked)"> ${esc(t('streamer.hide.' + k))}${k === 'personal' ? ` <span class="muted">${esc(t('streamer.hide.locked'))}</span>` : ''}</label>`).join('')}
      </fieldset>${forced ? '' : `<div><button type="button" id="streamWin" onclick="Streamer.openWindow()" title="${esc(t('streamer.win.title'))}">🎥 ${esc(t('streamer.win'))}</button></div>`}${st.running ? `<small class="muted">${esc(t('streamer.setup.running', { program: st.program || 'OBS' }))}</small>` : ''}`;
  }
  /* ---- OBS link (AIG-643..645) ---- */
  const obsText = () => { const o = st.obs || {}; return o.state === 'connected' ? t('streamer.obs.connected') : o.state === 'connecting' ? t('streamer.obs.connecting') : o.state === 'error' ? t('streamer.obs.' + (o.reason || 'notrunning')) : o.saved ? t('streamer.obs.off') : ''; };
  function paintObs() { const e = $('obsState'); if (!e) return; const o = st.obs || {}; e.textContent = obsText(); e.className = o.state === 'connected' ? 'obs-ok' : 'muted'; }
  // 🔴 Go live / ⏹ Stop next to the 🎥 button, only while OBS is connected
  function paintLive() {
    const b = $('liveBtn'); if (!b) return;
    const o = st.obs || {}, show = o.state === 'connected' && !forced;
    b.hidden = !show; if (!show) return;
    b.textContent = t(o.streaming ? 'streamer.stop' : 'streamer.live'); b.title = t(o.streaming ? 'streamer.stop.title' : 'streamer.live.title');
    b.classList.toggle('stream-on', !!o.streaming);
  }
  async function obsConnect() {
    const body = { action: 'connect', port: $('obsPort').value }, pw = $('obsPass').value; if (pw) body.password = pw;
    const e = $('obsState'); if (e) { e.textContent = t('streamer.obs.connecting'); e.className = 'muted'; }
    try { st = { ...st, ...(await api('POST', '/api/streamer/obs', body)) }; } catch (x) { alert(x.message); }
    const p = $('obsPass'); if (p) { p.value = ''; p.placeholder = (st.obs || {}).hasPassword ? t('streamer.obs.pw.saved') : ''; }
    paintObs(); paintLive(); poll();
  }
  // Go live: streamer mode on first, then StartStream; Stop sends StopStream.
  async function goLive() {
    const o = st.obs || {}, b = $('liveBtn'); if (b) b.disabled = true;
    try {
      if (!o.streaming && !on()) toggle();
      st = { ...st, ...(await api('POST', '/api/streamer/obs', { action: o.streaming ? 'stop' : 'start' })) };
    } catch (x) { alert(x.message); }
    if (b) b.disabled = false; paintLive(); poll();
  }
  function openWindow() { window.open('/?stream=1', 'aigileStream', 'popup=yes,width=1280,height=800'); }
  function paintSetup() { const b = $('streamerBox'); if (b) { b.innerHTML = setupHtml(); paintObs(); } }
  async function setAuto(v) {
    try { st = { ...st, ...(await api('POST', '/api/streamer', { auto: !!v })) }; } catch (e) { alert(e.message); }
    if (!v && auto) { const was = on(); auto = false; apply(was); }
    paintSetup(); poll();
  }
  async function setHide(k, v) {
    if (!PARTS.includes(k)) return;
    try { st = { ...st, ...(await api('POST', '/api/streamer', { hide: { [k]: !!v } })) }; } catch (e) { alert(e.message); }
    apply(on(), true);
  }
  // Alt+Shift+S: one press before you go live on Discord, which the board can't see (AIG-640)
  function key(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || e.code !== 'KeyS' || forced) return;
    e.preventDefault(); toggle(); toast(t(on() ? 'streamer.key.on' : 'streamer.key.off'));
  }
  function start() { apply(false); poll(); setInterval(poll, Number(window.AIGILE_STREAM_POLL) || 5000); document.addEventListener('keydown', key); }
  return { on, forced, obsConnect, goLive, openWindow, mask, raw, filter, toggle, dismiss, setAuto, setHide, setupHtml, start, poll, get hidden() { return hidden; } };
})();
