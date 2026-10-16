/* ---------- 🟢 Your status (AIG-984/985) ---------- */
// One top bar button with your status; a click opens the menu: Online, Idle, Do not disturb, Offline, 🛌 Rest day.
// Saved as the owner pref `status` (lib/status.js); GET /api/setup sends it back, and Tired.take() repaints this.
const Status = (() => {
  const LIST = ['online', 'idle', 'dnd', 'offline', 'rest'];
  const ICON = { online: '🟢', idle: '🌙', dnd: '⛔', offline: '⚫', rest: '🛌' };
  const cur = () => (state.setup && state.setup.status) || 'online';
  let shown = '';
  function paint() {
    const v = cur(), key = v + i18n.lang; if (key === shown) return;
    const b = $('statusBtn'); if (!b) return; shown = key;
    b.textContent = ICON[v]; b.dataset.status = v;
    b.title = t('status.title', { status: t('status.' + v) }); b.setAttribute('aria-label', b.title);
  }
  const close = () => { const m = $('statusMenu'); if (m) { menuClosed(m, $('statusBtn')); m.remove(); } };
  function menu() {
    if ($('statusMenu')) return close();
    const b = $('statusBtn'), r = b.getBoundingClientRect(), m = document.createElement('div'), v = cur();
    m.id = 'statusMenu'; m.setAttribute('role', 'menu');
    m.style.top = r.bottom + 6 + 'px'; m.style.maxWidth = '300px';
    m.innerHTML = LIST.map(k => `<button type="button" role="menuitemradio" aria-checked="${k === v}" id="st-${k}" class="${k === v ? 'on' : ''}" onclick="Status.set('${k}')">${ICON[k]} ${esc(t('status.' + k))}${k === v ? ' ✓' : ''}</button>`).join('')
      + `<div class="help-sep"></div><div class="help-lvl-h muted">${esc(t('status.rest.help'))}</div>`;
    document.body.append(m);
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';   // under the button, wherever the top bar put it
    menuKeys(m, b, close, { pick: '[aria-checked="true"]' });   // AIG-1426: focus on the status you have, arrows, Esc back to the button
  }
  async function set(k) {
    close();
    if (k === 'rest' && cur() !== 'rest' && !(await askSure('🛌 ' + t('status.rest'), t('status.rest.confirm'), t('status.rest.go')))) return;
    try { state.setup = await api('POST', '/api/setup', { prefs: { status: k } }); } catch (e) { return alert(e.message); }
    paint(); if (typeof refresh === 'function') refresh();
  }
  document.addEventListener('click', e => { if ($('statusMenu') && !e.target.closest('#statusMenu, #statusBtn')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  return { paint, menu, set };
})();
