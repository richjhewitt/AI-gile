/* ---------- the chat follows the lead to the next card (AIG-426) ---------- */
// A closed card may carry followUp: the card the lead carried on in. The lead chat and the card chat show a
// "→ Go to SMI-19" button; unless the owner has typed something, they follow by themselves after 3 s.
// Setting (this browser): follow automatically, or just show the button.
const Follow = (() => {
  const WAIT = 3000;
  const started = new Map(), stayed = new Set();
  const mode = () => { try { return localStorage.getItem('aigile.followMode') === 'button' ? 'button' : 'auto'; } catch { return 'auto'; } };
  const setMode = v => { try { localStorage.setItem('aigile.followMode', v === 'button' ? 'button' : 'auto'); } catch {} };
  // kind: 'dm' (the lead chat) or 'card' (a card panel or pop-out)
  function html(kind, slug, from, to) {
    if (!to || to === from) return '';
    const key = `${kind}|${slug}|${from}|${to}`, auto = mode() === 'auto' && !stayed.has(key);
    return `<div class="follow-bar" data-follow="${esc(key)}" data-kind="${kind}" data-slug="${esc(slug)}" data-to="${esc(to)}" ${auto ? 'data-auto="1"' : ''}>
      <button class="primary follow-go" data-follow-go>${esc(t('follow.go', { id: to }))}</button>
      ${auto ? `<span class="muted follow-note">${esc(t('follow.note', { id: to }))} · <a href="#" data-follow-stay>${esc(t('follow.stay'))}</a></span>` : ''}</div>`;
  }
  function go(bar) {
    const { kind, slug, to } = bar.dataset;
    if (kind === 'dm') Dms.follow(slug, to);
    else location.hash = (state.route && state.route.pop ? '#/pop/' : '#/p/') + slug + '/' + to;
  }
  // Typed text anywhere you would answer (the reply box, or a test or To read note) keeps you here.
  const typed = bar => (bar.dataset.kind === 'dm' ? ['dmText'] : ['r-text', 'v-text']).some(id => { const b = document.getElementById(id); return !!(b && b.value.trim()); });
  setInterval(() => {
    // Only a bar you can see counts down: on a card open at its Test tab the Reply pane (and its bar) is hidden.
    const bars = [...document.querySelectorAll('.follow-bar[data-auto]')].filter(b => b.getClientRects().length), keys = new Set(bars.map(b => b.dataset.follow));
    for (const k of [...started.keys()]) if (!keys.has(k)) started.delete(k);
    const now = Date.now();
    for (const b of bars) {
      const k = b.dataset.follow;
      if (!started.has(k)) { started.set(k, now); continue; }
      if (typed(b)) { started.set(k, now); continue; }   // typing keeps you here; the button stays
      if (now - started.get(k) >= WAIT) { started.delete(k); stayed.add(k); go(b); }
    }
  }, 250);
  document.addEventListener('click', e => {
    const st = e.target.closest('[data-follow-stay]');
    if (st) { e.preventDefault(); const b = st.closest('.follow-bar'); stayed.add(b.dataset.follow); started.delete(b.dataset.follow); b.removeAttribute('data-auto'); const n = b.querySelector('.follow-note'); if (n) n.remove(); return; }
    const g = e.target.closest('[data-follow-go]');
    if (g) { const b = g.closest('.follow-bar'); stayed.add(b.dataset.follow); go(b); }
  });
  return { html, mode, setMode };
})();
