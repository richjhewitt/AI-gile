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

  // Send back greys out until a reason is typed (AIG-1136).
  document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.sb !== undefined) { const b = e.target.closest('.ib-sb').querySelector('[data-act=sbsend]'); if (b) b.disabled = !e.target.value.trim(); } });
  // AIG-1293: the coloured project pill on an item opens that board (click, or Enter/Space when it has focus).
  const pillOf = t => { const p = t && t.closest && t.closest('.ib-item[data-project] .ib-proj'); return p && p.closest('.ib-item').dataset.project ? p : null; };
  const openPill = p => { location.hash = '#/p/' + p.closest('.ib-item').dataset.project; };
  document.addEventListener('click', e => { const p = pillOf(e.target); if (p) { e.preventDefault(); e.stopPropagation(); openPill(p); } }, true);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('ib-proj')) { const p = pillOf(e.target); if (p) { e.preventDefault(); openPill(p); } } });
  new MutationObserver(() => document.querySelectorAll('.ib-item[data-project] .ib-proj:not([role])').forEach(p => {
    p.setAttribute('role', 'link'); p.tabIndex = 0;
  })).observe(document.body, { childList: true, subtree: true });
  function onKey(e) {
    if (e.target.tagName === 'TEXTAREA' && EnterSend.is(e, 'card')) {
      const n = e.target.closest('.ib-item'); if (!n) return;   // ⚡ Decide's own box (#dcText) has its own Enter (AIG-445)
      e.preventDefault();
      if (e.target.dataset.sb !== undefined) { if (e.target.value.trim()) IB.sendBack(n); return; }   // a test row's Send back reason (AIG-1136)
      if (n.classList.contains('k')) IB.taskDone(n); else if (n.querySelector('[data-act="inforeply"]')) IB.infoReply(n); else IB.send(n);   // 📖 To read: Enter is its Reply (AIG-392)
    }
  }
  function onClick(e) {
    const pc = e.target.closest('[data-popcard]');
    if (pc) { const n = pc.closest('.ib-item'); popOut('card', `#/pop/${n.dataset.project}/${n.dataset.id}`, 'aigile-' + n.dataset.project + '-' + n.dataset.id, 560, 780); return; }
    const pl = e.target.closest('[data-poplist]');
    if (pl) { popOut('inbox', '#/pop-inbox/' + pl.dataset.poplist, 'aigile-inbox-' + pl.dataset.poplist, 480, 760); return; }
    if (e.target.closest('[data-decide]')) { e.target.closest('[data-decide]').blur(); IB.decide = IB.decide >= 0 ? -1 : 0; IB.flick = -1; IB.paintPage(); return; }
    const dc = e.target.closest('[data-dc]'); if (dc) { IB.decideAct(dc.dataset.dc, +dc.dataset.n); return; }
    if (e.target.closest('[data-flick]')) { IB.decide = -1; IB.flick = IB.flick >= 0 ? -1 : 0; IB.paintPage(); return; }
    const fl = e.target.closest('[data-fl]'); if (fl) { IB.flickAct(fl.dataset.fl); return; }
    if (e.target.closest('[data-onlyclear]')) { e.preventDefault(); IB.only = ''; IB.paintPage(); return; }
    if (e.target.closest('#ibTidy')) { const ps = [...new Set(IB.items.filter(isTest).filter(c => IB.tab === 'all' || c.project === IB.tab).map(c => c.project))]; (async () => { for (const s of ps) { try { await post('POST', `/api/projects/${s}/tidy`); } catch {} } IB.toast(t('tidy.toast', { count: ps.length, n: ps.length })); })(); return; }
    if (e.target.closest('#ibAiAll, [data-aiall]')) { IB.acceptAiPassed(e.target.closest('#ibAiAll, [data-aiall]')); return; }
    const tdr = e.target.closest('[data-tdreopen]'); if (tdr) { IB.reopenTested(tdr.closest('.ib-td-row')); return; }
    if (e.target.closest('#ibTester')) { IB.startTester(); return; }
    const cb = e.target.closest('button[data-chat]');
    if (cb) { IB.chat = cb.dataset.chat; IB.paintPage(); return; }
    const kb = e.target.closest('button[data-kind]');
    if (kb) { IB.kindFilter = kb.dataset.kind; IB.paintPage(); return; }
    const tb = e.target.closest('button[data-tab]');
    if (tb) { IB.tab = tb.dataset.tab; tabPref.set(IB.tab); IB.paintPage(); return; }
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const n = b.closest('.ib-item'), act = b.dataset.act;
    if (act === 'sbopen' || act === 'sbcancel') { const box = n.querySelector('.ib-sb'), open = act === 'sbopen' ? box.hidden : false; box.hidden = !open; n.querySelector('[data-act=sbopen]').setAttribute('aria-expanded', String(open)); if (open) box.querySelector('textarea').focus(); else box.querySelector('textarea').value = ''; return; }
    if (act === 'sbsend') { IB.sendBack(n); return; }
    if (act === 'open') { openIt(n.dataset.project, n.dataset.id, b); return; }
    if (act === 'send') IB.send(n); else if (act === 'go') IB.send(n, 'GO'); else if (act === 'accept') { if (acceptSure(b, IB.raw.find(c => IB.keyOf(c) === n.dataset.project + '/' + n.dataset.id))) IB.accept(n); } else if (act === 'gotit') IB.gotIt(n); else if (act === 'inforeply') IB.infoReply(n); else if (act === 'wait') IB.waitAndSee(n); else if (act === 'letsgo') IB.letsGo(n); else if (act === 'taskdone') IB.taskDone(n); else if (act === 'lifedone') IB.lifeDone(n); else if (act === 'gaccept') IB.groupAct(n, 'accept'); else if (act === 'gwait') IB.groupAct(n, 'wait'); else if (act === 'gcaccept') IB.cardAct(b, 'accept'); else if (act === 'gcreply') IB.cardAct(b, 'reply'); else if (act === 'gcback') IB.cardAct(b, 'back');
  }

  /* ---------- hooks used by js/core.js ---------- */
  // Called from refresh() whenever the route is #/inbox. Takes over the page body.
  let shownSig = null;
  async function show(force) {
    const hadPage = !!el('ib');
    try { await IB.load(force); } catch (e) {   // force: e.g. the swarm's "show other projects" changes the list without moving the stamp
      if (parseRoute().view !== 'inbox') return;
      el('live').className = 'live off'; el('live').textContent = liveError(e); return;
    }
    if (parseRoute().view !== 'inbox') return;
    el('live').className = 'live'; el('live').textContent = t('live.ok');
    el('crumb').textContent = '/ ' + t('inbox.crumb');
    el('modal').innerHTML = '';
    if (typeof state !== 'undefined') state.lastSig = state.lastBoardSig = null;   // so other views redraw when the owner leaves
    if (force || !el('ib')) { if (!el('ib')) IB.skeleton(); IB.fromProject = (typeof state !== 'undefined' && state.lastProject) || null; IB.selectPinned = true; }
    IB.paintTop(); if (force || !hadPage || shownSig !== IB.dataSig) { IB.paintPage(); shownSig = IB.dataSig; }
  }

  // Own poll so counts, tab title and alerts keep working on every page, even in a background tab.
  PagePoll.every(() => IB.load(), 3000, { alerts: true });   // title count and desktop alerts: keep their pace when hidden (AIG-1153)
  window.addEventListener('hashchange', IB.paintTop);
  IB.load().catch(() => {});
  window.Inbox = { show, repaint: IB.repaint };
  Object.assign(IB, { onClick, onKey });
})();
