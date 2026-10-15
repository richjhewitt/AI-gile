/* ---------- Keyboard shortcuts (AIG-807) ---------- */
// Single keys for the list and the card, g + a letter to switch pages, ? for the cheat sheet. Nothing fires while typing in a
// field or with Ctrl/Alt/Meta held; Esc, Enter-to-send and the inbox/decide keys live in their own files and are left alone.
const Shortcuts = (() => {
  // [keys, how the keys combine ('or' = either, 'then' = one after the other), language key]
  const LIST = [
    [['j', 'k'], 'or', 'sc.move'], [['Enter', 'o'], 'or', 'sc.open'], [['a'], '', 'sc.accept'], [['b'], '', 'sc.back'], [['n'], '', 'sc.new'],
    [['g', 'h'], 'then', 'sc.home'], [['g', 'i'], 'then', 'sc.inbox'], [['g', 'm'], 'then', 'sc.messages'], [['g', 's'], 'then', 'sc.setup'],
    [['/'], '', 'sc.search'], [['?'], '', 'sc.keyhelp'], [['Esc'], '', 'sc.close']];
  let gAt = 0;
  const typing = e => { const x = e.target, tag = x && x.tagName; return /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || !!(x && x.isContentEditable); };
  const vis = x => !!x && !x.hidden && x.getClientRects().length > 0;
  const cards = () => [...document.querySelectorAll('#app a.card[data-id]')].filter(vis);
  const clickRail = sel => { const b = document.querySelector('#dmRail ' + sel); if (b) b.click(); };
  function sheet() {
    const rows = LIST.map(([ks, how, s]) => `<tr><td class="sc-k">${ks.map(x => `<kbd>${esc(x)}</kbd>`).join(how === 'or' ? ' / ' : ' ')}</td><td>${esc(t(s))}</td></tr>`).join('');
    openDialog(`<h2>${esc(t('sc.title'))}</h2><table class="sc-t">${rows}</table><div class="muted">${esc(t('sc.note'))}</div>
      <div class="actions"><button type="button" id="scClose" class="primary" onclick="closeDialog()">${esc(t('sc.shut'))}</button></div>`, 'sc');
    const b = $('scClose'); if (b) b.focus();
  }
  function style() {
    if (document.getElementById('scStyle')) return;
    const s = document.createElement('style'); s.id = 'scStyle';
    s.textContent = '.dialog.sc{max-width:420px}.sc-t{width:100%;border-collapse:collapse;margin:8px 0}.sc-t td{padding:4px 6px;border-bottom:1px solid var(--line);vertical-align:middle}'
      + '.sc-k{white-space:nowrap;width:1%}.sc-t kbd{display:inline-block;min-width:1.2em;text-align:center;padding:1px 6px;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;background:var(--col);color:var(--text);font:12px/1.4 var(--mono,monospace)}';
    document.head.appendChild(s);
  }
  function key(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.defaultPrevented || typing(e)) return;
    const k = e.key, dlg = $('dialog') && $('dialog').firstChild;
    if (!k || k.length !== 1) return;
    if (k === '?') { e.preventDefault(); if (!dlg) sheet(); else if ($('scClose')) closeDialog(); return; }
    const l = k.toLowerCase();
    if ((l === 'a' || l === 'b') && dlg) {   // the For you window: the unfolded row
      const open = [...document.querySelectorAll('#fyfList .fyf-row.open')], ae = document.activeElement, inRow = ae && ae.closest && ae.closest('#fyfList .fyf-row.open');
      const f = inRow || (open.length === 1 ? open[0] : null), btn = f && f.querySelector(l === 'a' ? '[data-act="accept"]' : '[data-fyback]');
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
      return;
    }
    if (dlg) return;
    if (gAt && Date.now() - gAt < 1500) {
      gAt = 0;
      if (l === 'h') clickRail('[data-go="#/"]'); else if (l === 'i') clickRail('[data-go="#/inbox"]');
      else if (l === 'm') clickRail('[data-dms]'); else if (l === 's') location.hash = '#/setup'; else return;
      e.preventDefault(); return;
    }
    gAt = 0;
    const modal = document.querySelector('#modal .panel');
    if (l === 'g') { gAt = Date.now(); return; }
    if (k === '/') { const q = document.getElementById('f-q') || document.getElementById('glossQ'); if (vis(q)) { e.preventDefault(); q.focus(); q.select(); } return; }
    if (l === 'a' || l === 'b') {
      const ai = document.getElementById('ibAi'); if (ai && !ai.hidden) return;   // the inbox flick view has its own a
      const btn = modal && modal.querySelector(`.verdict button[onclick*="verdict(${l === 'a'}"]`);
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }
    if (modal) return;
    if (l === 'n') { if (typeof newCard === 'function' && state.project) { e.preventDefault(); newCard(); } return; }
    if (l === 'j' || l === 'k' || l === 'o') {
      const list = cards(), i = list.indexOf(document.activeElement);
      if (l === 'o') { if (i >= 0) { e.preventDefault(); list[i].click(); } return; }
      if (!list.length) return;
      e.preventDefault(); list[i < 0 ? (l === 'j' ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + (l === 'j' ? 1 : -1)))].focus();
    }
  }
  style();
  document.addEventListener('keydown', key);
  return { sheet };
})();
