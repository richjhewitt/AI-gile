/* ---------- For you fold window (AIG-738) ----------
   A For you chip opens one window with all that kind's cards, one row each (id, type, title). A click on a row unfolds
   the card in place, with the same body and buttons the inbox shows (IB.itemHtml, IB.onClick). A click on a card in the
   column opens the same window on that card's chip with that card unfolded. Pops out like the other windows (popout.js). */
const FyFold = (() => {
  const cardsOf = k => forYouQueue(state.project).filter(c => kindOf(c) === k);
  const itemOf = c => (IB.raw || []).find(x => IB.keyOf(x) === state.project.slug + '/' + c.id);
  // The inbox list can lack a card the board still shows (project not picked for today, snoozed): build the item from the card so a click still opens it (AIG-1033).
  const itemFor = c => itemOf(c) || (p => ({ project: p.slug, projectName: p.name, projectEmoji: p.emoji, projectLogo: p.logo, ...c }))(state.project);
  const rowHtml = c => `<div class="fyf-row" data-id="${esc(c.id)}"><button type="button" class="fyf-h" aria-expanded="false" data-fyrow><span class="fyf-id">${esc(c.id)}</span><span class="pill">${esc(t('type.' + c.type))}</span><span class="fyf-t">${esc(c.title)}</span></button><div class="fyf-b" hidden></div></div>`;
  function bodyHtml(c) {
    const it = itemFor(c); if (!it) return `<a href="#/p/${state.project.slug}/${esc(c.id)}">${esc(c.title)}</a>`;
    // AIG-1373: the inbox body brings its own Send back (it opens the reason box), so no second one here.
    const kind = IB.kindOf(it);
    return `<div class="ib-item ${kind}" data-key="${esc(IB.keyOf(it))}" data-project="${esc(it.project)}" data-id="${esc(it.id)}">${IB.itemHtml(it)}</div>`;
  }
  function toggle(row, on) {
    const b = row.querySelector('.fyf-b'), h = row.querySelector('.fyf-h');
    on = on === undefined ? b.hidden : on;
    if (on && !b.firstChild) { const c = (state.project.cards || []).find(x => x.id === row.dataset.id); if (c) b.innerHTML = bodyHtml(c); }
    b.hidden = !on; h.setAttribute('aria-expanded', on ? 'true' : 'false'); row.classList.toggle('open', on);
  }
  function head(k, n) { const h = document.getElementById('fyfHead'); if (h) h.textContent = `${kindLabel(k)} ${n}`; }
  function open(k, focusId, chip) {
    if (!state.project) return;
    if (chip) forYouFirst(k); else { state.forYouFirst = k; try { localStorage.setItem('aigile.forYouFirst', k); } catch {} }   // a chip click also puts that kind first in the column; the popped-out window opens the same chip
    const cs = cardsOf(k);
    if (!cs.length) return;
    popNext('fyfold');
    openDialog(`<div class="fyf" data-kind="${esc(k)}"><button type="button" class="fyf-x" title="${esc(t('common.close'))}" aria-label="${esc(t('common.close'))}" onclick="closeDialog()">✕</button><h2 id="fyfHead"></h2><div id="fyfList">${cs.map(rowHtml).join('')}</div></div>`, 'wide fyf-dlg');
    head(k, cs.length);
    const box = document.getElementById('fyfList');
    box.addEventListener('click', onClick); box.addEventListener('keydown', IB.onKey);
    const row = focusId && [...box.children].find(r => r.dataset.id === focusId);
    if (row) { toggle(row, true); row.scrollIntoView({ block: 'nearest' }); }
  }
  function onClick(e) {
    const h = e.target.closest('[data-fyrow]'); if (h) { toggle(h.closest('.fyf-row')); return; }
    IB.onClick(e);
  }
  // After an action on a card (accept, reply, done ...): its row goes; the last one closes the window.
  function after(n) {
    const row = n && document.querySelector('#fyfList .fyf-row[data-id="' + n.dataset.id + '"]'); if (!row) return;   // n itself may be gone already
    const list = row.parentNode, k = list.parentNode.dataset.kind;
    const wasOpen = k === 't' && row.classList.contains('open'), next = wasOpen ? row.nextElementSibling : null;   // a test answered in the list: the next test opens straight away (AIG-1212)
    row.remove();
    try { refresh(true); } catch {}   // the board's For you count follows (AIG-1067)
    if (!list.children.length) { closeDialog(); if (wasOpen) IB.toast(t('fy.testsdone')); return; }
    head(k, list.children.length);
    if (next) { toggle(next, true); next.scrollIntoView({ block: 'nearest' }); }
    else if (wasOpen) IB.toast(t('fy.testsdone'));   // the last in the list order: say so, back to the list
  }
  return { open, after };
})();
function fyOpen(k, id, chip) { FyFold.open(k, id, chip); }
function fyCardClick(e, id) {
  if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return true;
  if (e.target.closest('button, input, textarea, select')) return true;
  const c = state.project && state.project.cards.find(x => x.id === id); if (!c || !forYou(c)) return true;
  FyFold.open(kindOf(c), id); return false;
}
