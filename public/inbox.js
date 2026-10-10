// AI-gile inbox: top-bar button, #/inbox page, and new-question alerts.
// Self-contained (no dependencies). Loaded after the main script in index.html.
// Needs from the page: state, $, api (all top-level in index.html), a <header> with #live.
(function () {
  'use strict';

  // ---- styles ------------------------------------------------------------------
  // Questions = strong red, tests = calm blue. Every use also carries an icon and a word.
  const css = `
  :root {
    --q-bg: #c81e1e; --q-fg: #fff; --q-tint: #fdecec; --q-line: #c81e1e; --q-ink: #9b1212;
    --t-bg: #e4ecff; --t-fg: #1e40af; --t-tint: #f1f5ff; --t-line: #8fa8e8; --t-ink: #1e40af;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --q-bg: #d62d2d; --q-fg: #fff; --q-tint: #2c1618; --q-line: #ef5350; --q-ink: #ff9b97;
      --t-bg: #22305a; --t-fg: #bcd0ff; --t-tint: #181e2e; --t-line: #4a5f9a; --t-ink: #a9c1ff;
    }
  }
  #inboxTop { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ib-btn { display: inline-flex; align-items: center; gap: 8px; padding: 4px 8px 4px 12px; border: 1px solid var(--line); border-radius: 99px; background: var(--panel); font-weight: 600; }
  .ib-btn:hover { border-color: var(--accent); }
  .ib-btn.on { outline: 2px solid var(--accent); outline-offset: 1px; }
  .ib-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 99px; font-weight: 700; font-size: 13px; white-space: nowrap; }
  .ib-badge.q { background: var(--q-bg); color: var(--q-fg); }
  .ib-badge.t { background: var(--t-bg); color: var(--t-fg); font-weight: 600; border: 1px solid var(--t-line); }
  @media (prefers-reduced-motion: no-preference) {
    .ib-badge.q { animation: ibglow 2.8s ease-in-out infinite; }
    @keyframes ibglow { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--q-bg) 30%, transparent); } }
  }
  .ib-alerts { font-size: 12px; padding: 3px 10px; border-radius: 99px; color: var(--muted); }
  .ib-alerts.on { color: var(--text); }

  .ib { max-width: 860px; margin: 0 auto; }
  .ib-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .ib-head h2 { margin: 0; font-size: 20px; }
  .ib-toast { min-height: 20px; color: var(--muted); font-size: 13px; margin: -8px 0 10px; }
  .ib-sec h3 { display: flex; align-items: center; gap: 8px; margin: 22px 0 10px; font-size: 15px; }
  .ib-sec.q h3 { color: var(--q-ink); font-size: 17px; }
  .ib-sec.t h3 { color: var(--t-ink); }
  .ib-sec h3 .ib-badge { font-size: 12px; }
  .ib-item { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; box-shadow: var(--shadow); }
  .ib-item.q { border: 2px solid var(--q-line); border-left-width: 8px; background: var(--q-tint); }
  .ib-item.t { border-left: 6px solid var(--t-line); background: var(--t-tint); }
  .ib-item.flash { animation: ibflash 1.6s ease-out 1; }
  @keyframes ibflash { 0% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 45%, transparent); } 100% { box-shadow: var(--shadow); } }
  .ib-top { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .ib-tag { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
  .q .ib-tag { color: var(--q-ink); } .t .ib-tag { color: var(--t-ink); }
  .ib-proj { font-weight: 700; }
  .ib-title { font-weight: 600; margin: 3px 0 2px; font-size: 15px; }
  .ib-title a:hover { text-decoration: underline; }
  .ib-id { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--muted); }
  .ib-who { font-size: 13px; color: var(--muted); margin: 2px 0 6px; }
  .ib-question { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 6px 0 10px; max-height: 40vh; overflow: auto; }
  .ib-item textarea { min-height: 56px; }
  .ib-item .actions { margin-top: 8px; }
  .ib-steps { margin: 8px 0 4px; }
  .ib-steps summary { cursor: pointer; font-weight: 600; color: var(--t-ink); }
  .ib-steps .body { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-top: 6px; max-height: 40vh; overflow: auto; }
  .ib-empty { text-align: center; padding: 56px 16px; }
  .ib-empty .big { font-size: 26px; font-weight: 700; }
  .ib-empty p { color: var(--muted); margin: 8px 0 0; }
  .ib-err { color: var(--danger); font-size: 13px; margin-top: 6px; }
  .ib-hint { font-size: 12px; color: var(--muted); }
  @media (max-width: 760px) {
    .ib-btn { padding: 3px 6px 3px 10px; gap: 5px; }
    .ib-badge { padding: 2px 8px; }
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- helpers -----------------------------------------------------------------
  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago';
  };
  const post = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  };
  const isQuestion = c => c.status !== 'verify';   // server sends only questions and verify cards
  const lastAsk = c => [...(c.comments || [])].reverse().find(m => String(m.author).trim().toLowerCase() !== 'rich')
    || { author: c.assignee || 'The team', at: c.updated, text: c.description || c.title };
  const keyOf = c => c.project + '/' + c.id;
  // Escape, then link web addresses and card ids (e.g. AIG-12) in the same project.
  const linkify = (text, c) => esc(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener" style="text-decoration:underline">${u}</a>`)
    .replace(/(^|[^\w/#-])([A-Z]{1,6}-\d+)\b/g, (m, pre, id) => `${pre}<a href="#/p/${c.project}/${id}" style="text-decoration:underline">${id}</a>`);

  const pref = {
    get() { try { return localStorage.getItem('aigile.alerts') === '1'; } catch { return false; } },
    set(on) { try { localStorage.setItem('aigile.alerts', on ? '1' : '0'); } catch {} },
  };
  const canNotify = () => typeof Notification !== 'undefined';
  const alertsOn = () => canNotify() && Notification.permission === 'granted' && pref.get();

  // ---- state ---------------------------------------------------------------------
  let items = [], loaded = false, inflight = null, seen = new Set(), flashKey = null;
  const baseTitle = document.title || 'AI-gile';

  // ---- data ------------------------------------------------------------------------
  function load() {
    if (inflight) return inflight;
    inflight = fetch('/api/inbox', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then(list => { inflight = null; apply(list); return true; })
      .catch(e => { inflight = null; throw e; });
    return inflight;
  }
  function apply(list) {
    items = list;
    const qs = items.filter(isQuestion);
    // New questions only: never on the first load. A fresh question on the same card counts as new.
    const keys = qs.map(c => keyOf(c) + '@' + lastAsk(c).at);
    if (loaded) {
      const fresh = qs.filter((c, i) => !seen.has(keys[i]));
      if (fresh.length) announce(fresh);
    }
    seen = new Set(keys);
    loaded = true;
    paintTop();
    if (onInboxPage()) paintPage();
  }

  // ---- top bar (AIG-32, AIG-34) -------------------------------------------------------
  function slot() {
    let s = el('inboxTop');
    if (!s) {   // fallback if the page has no container
      s = document.createElement('span'); s.id = 'inboxTop';
      const live = el('live'); live.parentNode.insertBefore(s, live);
    }
    return s;
  }
  const onInboxPage = () => location.hash === '#/inbox';
  function counts() {
    const q = items.filter(isQuestion).length;
    return { q, t: items.length - q };
  }
  function paintTop() {
    const { q, t } = counts();
    const label = (q ? `${q} question${q === 1 ? '' : 's'} waiting. ` : '') + (t ? `${t} to test. ` : '') || 'Nothing waiting. ';
    let alertBtn = '';
    if (canNotify()) {
      const on = alertsOn(), blocked = Notification.permission === 'denied';
      alertBtn = `<button class="ib-alerts ${on ? 'on' : ''}" id="ibAlerts" title="${blocked ? 'Notifications are blocked in your browser settings for this site' : on ? 'Click to turn alerts off' : 'Get a pop-up and a soft beep when a team asks a new question'}" ${blocked ? 'disabled' : ''}>${blocked ? '🔕 Alerts blocked' : on ? '🔔 Alerts on' : '🔕 Turn on alerts'}</button>`;
    }
    const html = `<a class="ib-btn ${onInboxPage() ? 'on' : ''}" href="#/inbox" aria-label="Inbox. ${esc(label)}" title="${esc(label)}">📥 Inbox
        ${q ? `<span class="ib-badge q">❓ ${q} question${q === 1 ? '' : 's'}</span>` : ''}
        ${t ? `<span class="ib-badge t">🧪 ${t} to test</span>` : ''}</a>${alertBtn}`;
    const s = slot();
    if (s.dataset.sig !== html) {
      s.dataset.sig = html; s.innerHTML = html;
      const b = el('ibAlerts'); if (b) b.onclick = toggleAlerts;
    }
    const title = q ? `(${q}) ${baseTitle}` : t ? `🧪 ${t} · ${baseTitle}` : baseTitle;
    if (document.title !== title) document.title = title;
  }

  // ---- alerts (AIG-35) ---------------------------------------------------------------------
  let audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      [[660, 0], [880, 0.16]].forEach(([f, d]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.3);
      });
    } catch {}
  }
  function announce(fresh) {
    if (!alertsOn()) return;
    beep();
    const one = fresh.length === 1 ? fresh[0] : null;
    const a = one && lastAsk(one);
    const n = new Notification(one ? `❓ ${a.author} has a question (${one.id})` : `❓ ${fresh.length} new questions for you`, {
      body: one ? `${one.projectName}: ${String(a.text).replace(/\s+/g, ' ').slice(0, 160)}` : fresh.map(c => c.id + ' ' + c.title).join('\n').slice(0, 200),
      tag: 'aigile-question-' + (one ? keyOf(one) : 'many'),
    });
    n.onclick = () => {
      try { window.focus(); } catch {}
      flashKey = one ? keyOf(one) : null;
      if (onInboxPage()) show(true); else location.hash = '#/inbox';
      n.close();
    };
  }
  async function toggleAlerts() {
    if (!canNotify()) return;
    if (alertsOn()) { pref.set(false); paintTop(); return; }
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();   // created inside the click so sound is allowed later
      audio.resume();
    } catch {}
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') { pref.set(true); beep(); }
    paintTop();
  }

  // ---- inbox page (AIG-33) ----------------------------------------------------------------
  function qHtml(c) {
    const a = lastAsk(c);
    return `<div class="ib-top"><span class="ib-tag">❓ Question</span><span class="ib-proj">${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-who"><b>${esc(a.author)}</b> asked ${ago(a.at)}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>
      <textarea rows="2" placeholder="Type your answer. Enter sends, Shift+Enter adds a new line." aria-label="Your answer to ${esc(c.id)}"></textarea>
      <div class="ib-err"></div>
      <div class="actions"><button class="primary" data-act="send">Send answer</button><span class="ib-hint">Your answer goes to the team and clears this question.</span></div>`;
  }
  function tHtml(c) {
    return `<div class="ib-top"><span class="ib-tag">🧪 To test</span><span class="ib-proj">${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span><span class="ib-hint">waiting ${ago(c.updated).replace(' ago', '')}</span></div>
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      ${c.testSteps ? `<details class="ib-steps"><summary>How to test</summary><div class="body">${linkify(c.testSteps, c)}</div></details>` : '<div class="ib-hint">No test steps written.</div>'}
      <div class="ib-err"></div>
      <div class="actions"><button class="good" data-act="accept">✅ Accept</button><button data-act="wait" title="Not sure yet: move it to the back of your queue">⏳ Wait and see</button>
      <a href="#/p/${c.project}/${c.id}" class="ib-hint" style="text-decoration:underline">Send back needs a reason: open the card</a></div>`;
  }
  const sigOf = c => isQuestion(c) ? [c.title, lastAsk(c).at, lastAsk(c).text].join('|') : [c.title, c.updated, c.testSteps].join('|');

  function skeleton() {
    el('app').innerHTML = `<div class="ib" id="ib">
      <div class="ib-head"><h2>📥 Inbox</h2><span class="ib-hint">Everything waiting on you, across all projects.</span></div>
      <div class="ib-toast" id="ibToast" role="status" aria-live="polite"></div>
      <div id="ibEmpty"></div>
      <section class="ib-sec q" id="ibQ"><h3>❓ Questions for you <span class="ib-badge q" id="ibQn"></span></h3><div class="list"></div></section>
      <section class="ib-sec t" id="ibT"><h3>🧪 To test <span class="ib-badge t" id="ibTn"></span><span class="ib-hint" style="font-weight:400">longest waiting first</span></h3><div class="list"></div></section>
    </div>`;
    el('ib').addEventListener('click', onClick);
    el('ib').addEventListener('keydown', onKey);
  }

  // Keeps existing item elements (and whatever is typed in them) and only adds, removes or updates the rest.
  // A reply box that is focused or holds text is never touched, so the 1s poll can't wipe it.
  function syncList(list, data) {
    const have = new Map([...list.children].map(n => [n.dataset.key, n]));
    const want = new Set(data.map(keyOf));
    for (const [k, n] of have) if (!want.has(k) && !n.dataset.sending) { n.remove(); have.delete(k); }
    data.forEach((c, i) => {
      const k = keyOf(c), sig = sigOf(c);
      let n = have.get(k);
      const typing = n && [...n.querySelectorAll('textarea')].some(t => t.value || t === document.activeElement);
      if (n && n.dataset.sig !== sig && !typing) { n.remove(); n = null; }
      if (!n) {
        n = document.createElement('div');
        n.className = 'ib-item ' + (isQuestion(c) ? 'q' : 't');
        n.dataset.key = k; n.dataset.sig = sig; n.dataset.project = c.project; n.dataset.id = c.id;
        n.innerHTML = isQuestion(c) ? qHtml(c) : tHtml(c);
      }
      if (list.children[i] !== n) list.insertBefore(n, list.children[i] || null);
    });
  }

  function paintPage() {
    if (!el('ib')) skeleton();
    const qs = items.filter(isQuestion), ts = items.filter(c => !isQuestion(c));
    syncList(el('ibQ').querySelector('.list'), qs);
    syncList(el('ibT').querySelector('.list'), ts);
    el('ibQ').hidden = !qs.length; el('ibT').hidden = !ts.length;
    el('ibQn').textContent = qs.length; el('ibTn').textContent = ts.length;
    el('ibEmpty').innerHTML = items.length ? '' : '<div class="ib-empty"><div class="big">Nothing waiting on you 🎉</div><p>When a team asks a question or a feature is ready to test, it shows up here.</p></div>';
    if (flashKey) {
      const n = [...document.querySelectorAll('.ib-item')].find(x => x.dataset.key === flashKey);
      if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); const t = n.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); flashKey = null; }
    }
  }
  const toast = msg => { const t = el('ibToast'); if (t) t.textContent = msg; };

  function onKey(e) {
    if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(e.target.closest('.ib-item'));
    }
  }
  function onClick(e) {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const n = b.closest('.ib-item'), act = b.dataset.act;
    if (act === 'send') send(n); else if (act === 'accept') accept(n); else if (act === 'wait') waitAndSee(n);
  }
  const base = n => `/api/projects/${n.dataset.project}/cards/${n.dataset.id}`;
  const fail = (n, e) => { n.querySelector('.ib-err').textContent = e.message || String(e); n.dataset.sending = ''; n.querySelectorAll('button').forEach(b => b.disabled = false); };
  const lock = n => { n.dataset.sending = '1'; n.querySelector('.ib-err').textContent = ''; n.querySelectorAll('button').forEach(b => b.disabled = true); };
  const done = (n, msg) => { n.remove(); items = items.filter(c => keyOf(c) !== n.dataset.key); paintTop(); paintPage(); toast(msg); load().catch(() => {}); };

  async function send(n) {
    if (n.dataset.sending) return;
    const ta = n.querySelector('textarea'), text = ta.value.trim();
    if (!text) { n.querySelector('.ib-err').textContent = 'Write something first.'; return; }
    lock(n);
    try { await post('POST', base(n) + '/comments', { author: 'Rich', text }); done(n, `Sent to the team on ${n.dataset.id}.`); }
    catch (e) { fail(n, e); }
  }
  async function accept(n) {
    lock(n);
    try { await post('POST', base(n) + '/verdict', { accept: true }); done(n, `✅ ${n.dataset.id} accepted.`); }
    catch (e) { fail(n, e); }
  }
  async function waitAndSee(n) {
    lock(n);
    try { await post('PATCH', base(n), {}); n.dataset.sending = ''; await load(); toast(`⏳ ${n.dataset.id} moved to the back of the queue.`); }
    catch (e) { fail(n, e); }
  }

  // ---- hooks used by index.html ------------------------------------------------------------
  // Called from refresh() whenever the route is #/inbox. Takes over the page body.
  async function show(force) {
    try { await load(); } catch (e) {
      el('live').className = 'live off'; el('live').textContent = 'offline: ' + e.message; return;
    }
    el('live').className = 'live'; el('live').textContent = 'live';
    el('crumb').textContent = '/ Inbox';
    el('modal').innerHTML = '';
    if (typeof state !== 'undefined') state.lastSig = state.lastBoardSig = null;   // so other views redraw when Rich leaves
    if (force || !el('ib')) { if (!el('ib')) skeleton(); }
    paintTop(); paintPage();
  }

  // Own poll so counts, tab title and alerts keep working on every page, even in a background tab.
  setInterval(() => { load().catch(() => {}); }, 1000);
  window.addEventListener('hashchange', paintTop);
  load().catch(() => {});

  window.Inbox = { show };
})();
