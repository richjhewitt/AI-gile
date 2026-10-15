// ↩ Undo (AIG-403): after a click that moves a card, a small bar "Moved AIG-12 to Done · ↩ Undo" for 10 s; Ctrl+Z undoes the last one.
// The server tells us (an `undo` field in the answer to verdict / taskdone / lifedone / snooze / quiz answer); we just listen to fetch.
(function () {
  'use strict';
  const SHOW_MS = 10e3, KEEP_MS = 60e3;
  const MOVE_RE = /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/(verdict|taskdone|lifedone|snooze|quiz\/answer)$/;
  let last = null, timer = null;   // last: { slug, id, at }

  function bar() {
    let b = document.getElementById('undoBar');
    if (!b) {
      b = document.createElement('div');
      b.id = 'undoBar'; b.className = 'undo-bar'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite'); b.hidden = true;
      b.innerHTML = '<span id="undoMsg"></span> <button type="button" id="undoBtn"></button>';
      document.body.appendChild(b);
      b.querySelector('button').addEventListener('click', () => run());
    }
    return b;
  }
  function hide() { clearTimeout(timer); const b = document.getElementById('undoBar'); if (b) b.hidden = true; }
  function colName(slug, key) {
    const p = (typeof state !== 'undefined' && ((state.project && state.project.slug === slug && state.project) || (state.projects || []).find(x => x.slug === slug))) || null;
    const c = colsOf(p).find(x => x.key === key);
    return c ? ((c.emoji ? c.emoji + ' ' : '') + c.name).trim() : key;
  }
  function show(slug, id, status, kind) {
    last = { slug, id, at: Date.now() };
    const b = bar();
    b.querySelector('#undoMsg').textContent = kind === 'snooze' ? t('undo.hid', { id }) : t('undo.moved', { id, col: colName(slug, status) });
    b.querySelector('#undoBtn').textContent = t('undo.btn');
    b.hidden = false;
    clearTimeout(timer); timer = setTimeout(hide, SHOW_MS);
  }
  // AIG-1260: a deleted card keeps its Undo bar (and Ctrl+Z) for a minute; after that it sits in Recently deleted.
  function showDeleted(slug, id) {
    last = { slug, id, at: Date.now(), del: true };
    const b = bar();
    b.querySelector('#undoMsg').textContent = t('undo.deleted', { id });
    b.querySelector('#undoBtn').textContent = t('undo.btn');
    b.hidden = false;
    clearTimeout(timer); timer = setTimeout(hide, KEEP_MS);
  }
  async function run() {
    if (!last || Date.now() - last.at > KEEP_MS) return;
    const { slug, id, del } = last; last = null; hide();
    const b = bar();
    try {
      await api('POST', del ? `/api/projects/${slug}/deleted/${id}/restore` : `/api/projects/${slug}/cards/${id}/undo`, {});
      b.querySelector('#undoMsg').textContent = t('undo.back', { id }); b.querySelector('#undoBtn').textContent = ''; b.hidden = false;
      clearTimeout(timer); timer = setTimeout(hide, 3e3);
      if (typeof refresh === 'function') refresh(true);
      if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload();
      if (typeof Dms !== 'undefined' && Dms.reload) Dms.reload();
    } catch (e) { b.querySelector('#undoMsg').textContent = e.message || t('undo.late'); b.querySelector('#undoBtn').textContent = ''; b.hidden = false; clearTimeout(timer); timer = setTimeout(hide, 4e3); }
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const res = await realFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input && input.url, method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const m = method === 'POST' && res.ok && url && MOVE_RE.exec(new URL(url, location.href).pathname);
      if (m) res.clone().json().then(j => { if (j && j.undo) show(m[1], j.undo.id, j.undo.status, m[3]); }).catch(() => {});
    } catch {}
    return res;
  };

  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'z') return;
    const x = e.target, tag = x && x.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (x && x.isContentEditable)) return;
    if (!last || Date.now() - last.at > KEEP_MS) return;
    e.preventDefault(); run();
  });
  window.Undo = { run, show, showDeleted };
})();
