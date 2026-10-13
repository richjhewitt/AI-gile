/* ---------- ⌨ the built-in terminal (AIG-471) ---------- */
// A 🖥️ server task's terminal, connected with your own ssh: docked at the bottom of the window, or in its own window
// (#/pop-term/<slug>/<id>/<server>). The board keeps the session (lib/terminal.js), so the dock, a pop-out and a refresh
// all show the same terminal. The code blocks of a server task get ▶ buttons that type the commands for you; the first
// run on each card asks first, and nothing ever runs without a click. xterm.js comes from jsDelivr, pinned, with SRI.
const Term = (() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/@xterm/';
  const FILES = {
    css: [CDN + 'xterm@5.5.0/css/xterm.css', 'sha384-8Xk9wy/gzEDUKrXtrmCFa2bBuK3BpjpDuL/p0SeKQX19Khl/M+lHOgD/CyYf7efP'],
    js: [CDN + 'xterm@5.5.0/lib/xterm.js', 'sha384-M169f14mRZOXm3hD/v2Ti0ThIT/RnAQagXA9nlE15yHAtrW19gdePJh/HaTzUOe/'],
    fit: [CDN + 'addon-fit@0.10.0/lib/addon-fit.js', 'sha384-iF+jqbuti4XlB64clWgFWYEscb+UnSRv3VgVikGYZu+otNFnSHr7y7NcKfBnGizn'],
  };
  let lib = null, tok = null, cur = null, pending = null;
  const cursors = {};   // a block's next line: "<slug>/<id>#<hash>" -> index into its commands
  const marks = {};     // the same key -> { command index: 'ok' | 'fail' | 'running' }
  const add = (tag, attrs) => new Promise((ok, no) => { const el = Object.assign(document.createElement(tag), attrs, { crossOrigin: 'anonymous', onload: ok, onerror: () => no(new Error(t('term.nolib'))) }); document.head.appendChild(el); });
  const load = () => lib || (lib = Promise.all([add('link', { rel: 'stylesheet', href: FILES.css[0], integrity: FILES.css[1] }), add('script', { src: FILES.js[0], integrity: FILES.js[1] })])
    .then(() => add('script', { src: FILES.fit[0], integrity: FILES.fit[1] })).catch(e => { lib = null; throw e; }));
  const token = async fresh => { if (!tok || fresh) tok = await api('GET', '/api/terminal/token'); return tok; };
  const base = (s, id) => `/api/terminal/${encodeURIComponent(s)}/${encodeURIComponent(id)}/`;
  const post = (what, body = {}) => api('POST', base(cur.slug, cur.id) + what, { token: tok.token, ...body });

  /* ---------- which server: the card's own, or the only one with an ssh address ---------- */
  function nameFor(c) {
    const names = state.terms || [];
    return names.find(x => x.toLowerCase() === String(c.serverName || '').toLowerCase()) || (names.length === 1 ? names[0] : '');
  }
  const can = c => c && c.server && (state.terms || []).length;
  // On the card's panel: the code blocks of a server task get ▶ buttons (decorated below).
  const panelAttr = (p, c) => can(c) ? `data-term="${esc(p.slug)}/${esc(c.id)}" data-term-name="${esc(nameFor(c))}"` : '';
  const btn = (c, cls = 'q-chip srv-open') => can(c) ? `<button class="${cls}" data-term-open="${esc(c.project || slug())}/${esc(c.id)}" data-term-name="${esc(nameFor(c))}" title="${esc(t('term.open.title'))}">${esc(t('term.open'))}</button>` : '';

  /* ---------- the dock ---------- */
  function dock(pop) {
    let d = $('termDock');
    if (!d) {
      d = document.createElement('div'); d.id = 'termDock'; d.className = 'term-dock';
      d.innerHTML = `<div class="term-head"><b class="term-title"></b><span class="term-state muted"></span><span class="term-run"></span><span style="flex:1"></span>
        <button type="button" class="term-stop" hidden onclick="Term.stop()">${esc(t('term.stop'))}</button>
        <button type="button" class="term-again" hidden onclick="Term.reconnect()">${esc(t('term.reconnect'))}</button>
        ${pop ? '' : `<button type="button" class="term-pop" onclick="Term.popOut()" title="${esc(t('term.pop.title'))}">⧉</button>`}
        <button type="button" class="term-x" onclick="Term.close()" title="${esc(t('term.close.title'))}">✕</button></div><div class="term-body"></div>`;
      document.body.appendChild(d);
    }
    document.body.classList.add('term-open');
    return d;
  }
  const part = k => $('termDock') && $('termDock').querySelector('.term-' + k);
  const setState = k => { if (cur) cur.alive = k === 'live'; const s = part('state'); if (s) s.textContent = t('term.state.' + k); const a = part('again'); if (a) a.hidden = k === 'live' || k === 'connecting'; };
  function message(html) { const b = part('body'); if (b) b.innerHTML = `<div class="term-msg">${html}</div>`; }
  function teardown(keepDock) {
    if (cur) { try { cur.es && cur.es.close(); } catch {} try { cur.term && cur.term.dispose(); } catch {} try { cur.ro && cur.ro.disconnect(); } catch {} }
    cur = null; pending = null;
    if (!keepDock) { const d = $('termDock'); if (d) d.remove(); document.body.classList.remove('term-open'); }
  }

  // Open (or show again) the terminal of a card. connect false: only attach to a session that is already open (a pop-out
  // coming back after a restart shows a Connect button instead of dialling by itself).
  async function open(s, id, name, { pop = false, connect = true } = {}) {
    if (!name) return pick(s, id);
    if (cur && cur.slug === s && cur.id === id && cur.name === name && cur.term) { dock(pop); return cur; }
    teardown(true);
    const d = dock(pop);
    d.querySelector('.term-title').textContent = `⌨ ${name} · ${id}`;
    cur = { slug: s, id, name, pop };
    setState('connecting');
    let k; try { k = await token(true); } catch (e) { message(esc(e.message)); setState('closed'); return null; }
    if (!k.available) { unavailable(k); setState('closed'); return null; }
    try { await load(); } catch (e) { message(esc(e.message)); setState('closed'); return null; }
    const me = cur; if (!me) return null;
    message('');
    const body = part('body'); body.innerHTML = '';
    const term = new Terminal({ fontSize: 13, fontFamily: 'Cascadia Mono, Consolas, Menlo, monospace', cursorBlink: true, scrollback: 5000, theme: { background: '#1e2430', foreground: '#e6e9ef' } });
    const fit = new FitAddon.FitAddon(); term.loadAddon(fit); term.open(body);
    try { fit.fit(); } catch {}
    Object.assign(me, { term, fit });
    // Typing: keys go to the board in small batches, in order.
    let q = '', busy = false;
    const flush = async () => { if (busy || !q || cur !== me) return; busy = true; const d = q; q = ''; try { await post('input', { data: d }); } catch {} busy = false; if (q) flush(); };
    term.onData(d => { q += d; setTimeout(flush, 8); });
    let rt = null;
    me.ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { try { fit.fit(); } catch {} if (cur === me && me.alive) post('resize', { cols: term.cols, rows: term.rows }).catch(() => {}); }, 120); });
    me.ro.observe(body);
    if (!connect) {
      const there = await post('resize', { cols: term.cols, rows: term.rows }).then(() => true, () => false);
      if (!there) { setState('closed'); term.write('\r\n  ' + t('term.connect.hint') + '\r\n'); return me; }
    } else {
      try { await api('POST', '/api/terminal/open', { token: tok.token, slug: s, id, name, cols: term.cols, rows: term.rows }); }
      catch (e) { setState('closed'); term.write('\r\n  ' + e.message + '\r\n'); return me; }
    }
    stream(me);
    term.focus();
    return me;
  }
  function stream(me) {
    const es = new EventSource(base(me.slug, me.id) + 'stream?token=' + encodeURIComponent(tok.token));
    me.es = es;
    es.onmessage = e => {
      if (cur !== me) return es.close();
      const m = JSON.parse(e.data);
      if ('replay' in m) { me.term.reset(); me.term.write(m.replay); setState(m.alive ? 'live' : 'closed'); if (m.run) runState(m.run); }
      if (m.o) me.term.write(m.o);
      if (m.run) runState(m.run);
      if (m.exit !== undefined || m.closed) { setState('closed'); es.close(); }
    };
    es.onerror = () => { if (es.readyState === 2 && cur === me) setState('closed'); };
  }
  function unavailable(k) {
    if (k.why === 'off') return message(esc(t('term.off')));
    const out = k.installOut ? `<pre class="term-out">${esc(k.installOut)}</pre>` : '';
    message(`<p>${esc(t('term.nopty'))}</p>` + (k.installing === 'running' ? `<p class="muted">${esc(t('term.installing'))}</p>`
      : `<p><button class="primary" onclick="Term.install()">${esc(t('term.install'))}</button></p>${k.installing === 'failed' ? `<p class="err">${esc(t('term.install.failed'))}</p>` : ''}`) + out);
  }
  async function install() {
    try { tok = await api('POST', '/api/terminal/install', { token: tok.token }); } catch (e) { return message(esc(e.message)); }
    const me = cur;
    for (let i = 0; i < 150 && cur === me; i++) {
      unavailable(tok);
      if (tok.available) { message(`<p>${esc(t('term.installed'))}</p><p><button class="primary" onclick="Term.reconnect()">${esc(t('term.connect'))}</button></p>`); return; }
      if (tok.installing !== 'running') return;
      await new Promise(r => setTimeout(r, 2000));
      try { tok = await token(true); } catch {}
    }
  }
  // Several servers with an ssh address and the card names none: which one?
  function pick(s, id) {
    openDialog(`<h2>${esc(t('server.pick'))}</h2>` + (state.terms || []).map(n => `<p><button data-term-open="${esc(s)}/${esc(id)}" data-term-name="${esc(n)}">${esc(t('term.open.on', { name: n }))}</button></p>`).join('')
      + `<div class="actions"><button onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
  }
  async function close() {
    const me = cur;
    if (me && me.term) await post('close').catch(() => {});
    teardown(false);
    if (me && me.pop) window.close();
  }
  async function reconnect() { if (!cur) return; const { slug: s, id, name, pop } = cur; teardown(true); await open(s, id, name, { pop }); }
  // ⧉ The terminal in its own window; the session stays on the board, so nothing is lost.
  function popOut() {
    if (!cur) return;
    window.popOut('term', `#/pop-term/${encodeURIComponent(cur.slug)}/${encodeURIComponent(cur.id)}/${encodeURIComponent(cur.name)}`, 'aigile-term-' + cur.slug + '-' + cur.id, 860, 540);
    teardown(false);
  }
  // The pop-out window's page: just the terminal. It attaches to the open session; it never dials by itself.
  function popView(r) {
    document.body.classList.add('pop', 'popterm');
    if (cur && cur.slug === r.slug && cur.id === r.card) return;
    document.title = `⌨ ${r.name} · ${r.card}`;
    open(r.slug, r.card, r.name, { pop: true, connect: false });
  }

  /* ---------- ▶ run buttons on a server task's code blocks ---------- */
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  // The commands in a block, as groups of line numbers: blank lines and # comments are skipped, a "\", "|" or "&&" at
  // the end of a line carries on to the next (the board reads them the same way).
  function commands(lines) {
    const out = []; let cur = null;
    lines.forEach((l, i) => {
      const s = l.trim();
      if (!cur && (!s || /^#/.test(s))) return;
      (cur = cur || []).push(i);
      if (!/(\\|\||&&)$/.test(s)) { out.push(cur); cur = null; }
    });
    if (cur) out.push(cur);
    return out;
  }
  function decorate(box) {
    const panel = box.closest('[data-term]'), code = box.querySelector('pre code'); if (!panel || !code) return;
    box.dataset.runs = '1';
    const real = Streamer.raw(code), lines = real.split('\n'), cmds = commands(lines); if (!cmds.length) return;   // the real lines, even while streaming (AIG-591)
    const key = panel.dataset.term + '#' + hash(real);
    box.dataset.key = key; box._cmds = cmds; box._lines = lines;
    code.innerHTML = lines.map((l, i) => `<span class="cl${cmds.some(g => g.includes(i)) ? ' cmd' : ''}" data-i="${i}">${esc(l)}</span>`).join('\n');
    const acts = box.querySelector('.codebox-acts'); if (!acts) return;
    if (!Roles.canRun(panel.dataset.termName)) return;   // no access to this server: no ▶ buttons (AIG-677)
    acts.insertAdjacentHTML('afterbegin', cmds.length === 1 ? `<button class="copy run" data-run="this" title="${esc(t('term.run.this.title'))}">${esc(t('term.run.this'))}</button>`
      : `<button class="copy run" data-run="next" title="${esc(t('term.run.next.title'))}">${esc(t('term.run.next'))}</button><button class="copy run" data-run="all" title="${esc(t('term.run.all.title'))}">${esc(t('term.run.all'))}</button>`);
    box.classList.add('runs');
    mark(box);
  }
  // The next line of a block is lit up; lines a run went through get ✓ or ✗.
  function mark(box) {
    const k = cursors[box.dataset.key] || 0, g = box._cmds[Math.min(k, box._cmds.length - 1)];
    box.querySelectorAll('.cl.next').forEach(el => el.classList.remove('next'));
    if (box._cmds.length > 1 && k < box._cmds.length) g.forEach(i => { const el = box.querySelector(`.cl[data-i="${i}"]`); if (el) el.classList.add('next'); });
    for (const [i, st] of Object.entries((marks[box.dataset.key] || {}))) box._cmds[i] && box._cmds[i].forEach(n => { const el = box.querySelector(`.cl[data-i="${n}"]`); if (el) { el.classList.remove('ok', 'fail', 'running'); el.classList.add(st); } });
  }
  const boxOf = key => [...document.querySelectorAll('.codebox[data-key]')].find(b => b.dataset.key === key);
  new MutationObserver(() => document.querySelectorAll('[data-term] .codebox:not([data-runs])').forEach(decorate)).observe(document.documentElement, { childList: true, subtree: true });

  async function runFrom(b) {
    const box = b.closest('.codebox'), panel = b.closest('[data-term]'); if (!box || !box._cmds) return;
    const [s, id] = panel.dataset.term.split('/'), name = panel.dataset.termName;
    // ▶ never types into a terminal that isn't open and connected on this card: it opens it, you press ▶ again.
    if (!cur || cur.slug !== s || cur.id !== id || !cur.alive) { await open(s, id, name); note(t('term.connect.first')); return; }
    const all = b.dataset.run === 'all', k = all ? 0 : Math.min(cursors[box.dataset.key] || 0, box._cmds.length - 1);
    const pickd = all ? box._cmds.map((g, i) => i) : [k];
    const lines = pickd.map(i => box._cmds[i].map(n => box._lines[n]).join('\n'));
    const go = async confirm => {
      pending = { key: box.dataset.key, which: b.dataset.run, at: k, map: pickd };
      marks[box.dataset.key] = {}; mark(box);
      try {
        const r = await post('run', { lines, block: box.dataset.key, at: k, confirm });
        if (r.needConfirm) { pending = null; return ask(r.lines, () => go(true)); }
        cur.term.focus();
      } catch (e) { pending = null; note(e.message); }
    };
    go(false);
  }
  function ask(lines, yes) {
    openDialog(`<h2>${esc(t('term.confirm.h'))}</h2><p>${esc(t('term.confirm.p', { name: cur.name }))}</p><pre class="term-confirm">${esc(lines.join('\n'))}</pre>
      <div class="actions"><button class="primary" id="termYes">${esc(t('term.confirm.go'))}</button><button onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
    $('termYes').onclick = () => { closeDialog(); yes(); };
  }
  // What the board says about the run: the dock's status line, and ✓ / ✗ on the lines.
  function runState(r) {
    const el = part('run'), stopBtn = part('stop');
    if (stopBtn) stopBtn.hidden = r.state !== 'running' && r.state !== 'ok';
    if (el) el.textContent = r.state === 'running' ? t('term.run.at', { i: r.i + 1, n: r.n, line: r.line }) : r.state === 'done' ? t('term.run.done', { n: r.n })
      : r.state === 'failed' ? t('term.run.failed', { line: r.line, code: r.code }) : r.state === 'stopped' ? t('term.run.stopped') : el.textContent;
    if (el) el.className = 'term-run ' + r.state;
    const p = pending; if (!p || p.key !== r.block) return;
    const box = boxOf(p.key), m = marks[p.key] = marks[p.key] || {}, ci = p.map[r.i];
    if (r.state === 'running' && ci !== undefined) m[ci] = 'running';
    if ((r.state === 'ok' || r.state === 'fail') && ci !== undefined) m[ci] = r.state;
    if (r.state === 'failed' && ci !== undefined) m[ci] = 'fail';
    if (r.state === 'done' || r.state === 'failed' || r.state === 'stopped') {
      if (r.state === 'stopped' && ci !== undefined && m[ci] === 'running') delete m[ci];
      if (r.state === 'done' && p.which === 'next') cursors[p.key] = p.at + 1;
      pending = null;
    }
    if (box) mark(box);
  }
  const stop = () => cur && post('stop').catch(() => {});

  document.addEventListener('click', e => {
    const o = e.target.closest('[data-term-open]');
    if (o) { e.preventDefault(); e.stopPropagation(); if (o.closest('#dialog')) closeDialog(); const [s, id] = o.dataset.termOpen.split('/'); open(s, id, o.dataset.termName); return; }
    const r = e.target.closest('[data-run]');
    if (r && r.closest('[data-term]')) { e.preventDefault(); e.stopPropagation(); runFrom(r); return; }
    // Click a command line to make it the next one (nothing runs).
    const l = e.target.closest('[data-term] .codebox .cl.cmd');
    if (l && !String(getSelection())) { const box = l.closest('.codebox'), i = box._cmds.findIndex(g => g.includes(+l.dataset.i)); if (i >= 0) { cursors[box.dataset.key] = i; mark(box); } }
  }, true);

  return { panelAttr, btn, open, close, reconnect, popOut, popView, install, stop, nameFor };
})();
