// 🖥️ Screen share picker (AIG-1163): in the desktop app getDisplayMedia asks the app (desktop/main.js), which sends the screens
// and windows here (through desktop/preload.js). Drawn in an overlay of its own, so an open dialog (a call) stays as it is.
// A tile shares that screen or window; Cancel or Escape shares nothing. In a browser there is no window.aigileDesktop: nothing to do.
(() => {
  const D = window.aigileDesktop; if (!D || typeof D.onSharePick !== 'function') return;
  let answer = null;
  function close(id) {
    const el = document.getElementById('sharePick'); if (el) el.remove();
    const a = answer; answer = null; if (a) a(id || null);
  }
  D.onSharePick((sources, reply) => {
    close(null);   // a new ask replaces an open one
    answer = reply;
    const tile = s => `<button type="button" class="sp-tile" data-id="${esc(s.id)}" title="${esc(s.name)}" style="display:flex;flex-direction:column;gap:4px;padding:6px;min-width:0;text-align:left">`
      + (s.thumb ? `<img src="${esc(s.thumb)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:contain;background:#000;border-radius:4px">` : '')
      + `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${esc(s.name)}</span></button>`;
    const part = (h, list) => list.length ? `<h3 style="margin:10px 0 6px;font-size:14px">${esc(h)}</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${list.map(tile).join('')}</div>` : '';
    const el = document.createElement('div');
    el.id = 'sharePick'; el.className = 'overlay center';
    el.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" style="width:min(760px,100%)"><h2>${esc(t('sharepick.h'))}</h2>`
      + part(t('sharepick.screens'), sources.filter(s => s.screen)) + part(t('sharepick.windows'), sources.filter(s => !s.screen))
      + `<div class="actions"><button type="button" data-id="">${esc(t('common.cancel'))}</button></div></div>`;
    el.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) close(b.dataset.id); });
    document.body.appendChild(el);
    const first = el.querySelector('.sp-tile'); if (first) first.focus();
  });
  // Escape cancels the picker only, not the dialog under it (capture phase, before the dialog shell's own Escape).
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && answer) { e.stopImmediatePropagation(); close(null); } }, true);
})();
