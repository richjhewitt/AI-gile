// AI-gile inbox: top-bar button, #/inbox page, and new-question alerts.
// Split by section into js/inbox-state.js, -top, -items, -tabs, -page and -actions; this file adds the
// styles, the click and key handlers, the #/inbox entry point and the poll. Needs from the page: state, $, api (js/core.js).
(function () {
  'use strict';
  const { el, post, isTest, tabPref } = IB;
  /* ---------- styles: js/inbox-style.js (INBOX_CSS) ---------- */
  const style = document.createElement('style');
  style.textContent = INBOX_CSS;
  document.head.appendChild(style);

  function onKey(e) {
    if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const n = e.target.closest('.ib-item');
      if (n.classList.contains('k')) IB.taskDone(n); else IB.send(n);
    }
  }
  function onClick(e) {
    const pc = e.target.closest('[data-popcard]');
    if (pc) { const n = pc.closest('.ib-item'); window.open(`#/pop/${n.dataset.project}/${n.dataset.id}`, 'aigile-' + n.dataset.project + '-' + n.dataset.id, 'width=560,height=780'); return; }
    const pl = e.target.closest('[data-poplist]');
    if (pl) { window.open('#/pop-inbox/' + pl.dataset.poplist, 'aigile-inbox-' + pl.dataset.poplist, 'width=480,height=760'); return; }
    if (e.target.closest('[data-decide]')) { e.target.closest('[data-decide]').blur(); IB.decide = IB.decide >= 0 ? -1 : 0; IB.flick = -1; IB.paintPage(); return; }
    const dc = e.target.closest('[data-dc]'); if (dc) { IB.decideAct(dc.dataset.dc, +dc.dataset.n); return; }
    if (e.target.closest('[data-flick]')) { IB.decide = -1; IB.flick = IB.flick >= 0 ? -1 : 0; IB.paintPage(); return; }
    const fl = e.target.closest('[data-fl]'); if (fl) { IB.flickAct(fl.dataset.fl); return; }
    if (e.target.closest('[data-onlyclear]')) { e.preventDefault(); IB.only = ''; IB.paintPage(); return; }
    if (e.target.closest('#ibTidy')) { const ps = [...new Set(IB.items.filter(isTest).filter(c => IB.tab === 'all' || c.project === IB.tab).map(c => c.project))]; (async () => { for (const s of ps) { try { await post('POST', `/api/projects/${s}/tidy`); } catch {} } IB.toast(t('tidy.toast', { n: ps.length })); })(); return; }
    if (e.target.closest('#ibAiAll')) { IB.acceptAiPassed(e.target.closest('#ibAiAll')); return; }
    if (e.target.closest('#ibTester')) { IB.startTester(); return; }
    const cb = e.target.closest('button[data-chat]');
    if (cb) { IB.chat = cb.dataset.chat; IB.paintPage(); return; }
    const kb = e.target.closest('button[data-kind]');
    if (kb) { IB.kindFilter = kb.dataset.kind; IB.paintPage(); return; }
    const tb = e.target.closest('button[data-tab]');
    if (tb) { IB.tab = tb.dataset.tab; tabPref.set(IB.tab); IB.paintPage(); return; }
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const n = b.closest('.ib-item'), act = b.dataset.act;
    if (act === 'open') { openIt(n.dataset.project, n.dataset.id, b); return; }
    if (act === 'send') IB.send(n); else if (act === 'go') IB.send(n, 'GO'); else if (act === 'accept') IB.accept(n); else if (act === 'gotit') IB.gotIt(n); else if (act === 'inforeply') IB.infoReply(n); else if (act === 'wait') IB.waitAndSee(n); else if (act === 'taskdone') IB.taskDone(n);
  }

  /* ---------- hooks used by js/core.js ---------- */
  // Called from refresh() whenever the route is #/inbox. Takes over the page body.
  async function show(force) {
    try { await IB.load(); } catch (e) {
      el('live').className = 'live off'; el('live').textContent = t('live.offline', { msg: e.message }); return;
    }
    el('live').className = 'live'; el('live').textContent = t('live.ok');
    el('crumb').textContent = '/ ' + t('inbox.crumb');
    el('modal').innerHTML = '';
    if (typeof state !== 'undefined') state.lastSig = state.lastBoardSig = null;   // so other views redraw when the owner leaves
    if (force || !el('ib')) { if (!el('ib')) IB.skeleton(); IB.fromProject = (typeof state !== 'undefined' && state.lastProject) || null; IB.selectPinned = true; }
    IB.paintTop(); IB.paintPage();
  }

  // Own poll so counts, tab title and alerts keep working on every page, even in a background tab.
  setInterval(() => { IB.load().catch(() => {}); }, 1000);
  window.addEventListener('hashchange', IB.paintTop);
  IB.load().catch(() => {});
  window.Inbox = { show, repaint: IB.repaint };
  Object.assign(IB, { onClick, onKey });
})();
