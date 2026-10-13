/* ---------- Open a card for the owner (AIG-758) ---------- */
// `aigile open <proj> <id> --as NAME` asks the board to show a card. The 1s tick (app.js) asks GET /api/opencard and says
// whether this window is in front: if so, new requests open the card's in-app pop-out; if not they wait as a chip
// (bottom left) that opens the card when clicked. Only the main window asks (never a pop-out).
const OpenCard = (() => {
  let busyNow = false, chips = [], shown = '';
  const front = () => !document.hidden && document.hasFocus();
  const pop = e => popOut('card', `#/pop/${e.slug}/${e.id}`, 'aigile-' + e.slug + '-' + e.id, 560, 780);
  function paint() {
    let el = document.getElementById('ocChips');
    if (!chips.length) { if (el) el.remove(); shown = ''; return; }
    const key = JSON.stringify([chips, i18n.lang]); if (key === shown) return; shown = key;
    if (!el) { el = document.createElement('div'); el.id = 'ocChips'; el.className = 'oc-chips'; document.body.appendChild(el); }
    el.innerHTML = chips.map(e => `<div class="oc-chip" data-n="${e.n}"><button type="button" class="oc-go" data-go="${e.n}" title="${esc(t('oc.open'))}">${esc(t('oc.chip', { who: e.by || t('oc.someone'), id: e.id }))} <span class="muted">${esc(e.title)}</span></button><button type="button" class="oc-x" data-x="${e.n}" title="${esc(t('oc.dismiss'))}">✕</button></div>`).join('');
  }
  async function tick() {
    if (document.hidden || busyNow || /^#\/pop/.test(location.hash)) return;
    busyNow = true;
    try {
      const r = await api('GET', '/api/opencard?front=' + (front() && !document.documentElement.hasAttribute('data-break') ? 1 : 0));   // on a break nothing is "in front": requests stay chips
      const list = r.chips.slice();
      for (const e of r.auto) { if (document.documentElement.hasAttribute('data-break') || !pop(e)) list.push(e); }   // ⏸ break (AIG-824): no pop-outs, a chip   // a blocked pop-out falls back to a chip
      chips = list; paint();
    } catch {} finally { busyNow = false; }
  }
  document.addEventListener('click', ev => {
    const chip = ev.target.closest('#ocChips'); if (!chip) return;   // other parts of the board use data-go and data-x too
    const go = ev.target.closest('[data-go]'), x = ev.target.closest('[data-x]');
    if (!go && !x) return;
    const n = Number(go ? go.dataset.go : x.dataset.x), e = chips.find(c => c.n === n);
    if (go && e) pop(e);
    chips = chips.filter(c => c.n !== n); paint();
    api('DELETE', '/api/opencard/' + n).catch(() => {});
  });
  return { tick };
})();
