// ✨ What's new (#/whats-new, AIG-562): release notes from public/releases.json, newest first. The lead's release step writes
// that file with `aigile release-notes <proj>` (new features and bugs fixed, from the done cards). After an update the page
// shows a small note once, linking here; a new install marks the newest notes as seen without showing it.
const WhatsNew = (() => {
  const W = { data: null, checked: false };
  const KEY = 'aigile.seenRelease';
  W.load = async () => {
    try { const r = await fetch('releases.json', { cache: 'no-store' }); W.data = r.ok ? await r.json() : []; } catch { W.data = []; }
    if (!Array.isArray(W.data)) W.data = [];
    return W.data;
  };
  const list = (head, items) => items && items.length
    ? `<h4>${esc(head)}</h4><ul>${items.map(i => `<li><span class="muted">${esc(i.id)}</span> ${esc(i.title)}</li>`).join('')}</ul>` : '';
  W.render = () => {
    const d = W.data || [];
    if (!d.length) return `<div class="uz"><h2>${esc(t('wn.title'))}</h2><p class="muted">${esc(t('wn.empty'))}</p></div>`;
    return `<div class="uz"><h2>${esc(t('wn.title'))}</h2>` + d.map(r => `<div class="uz-card wn-rel"><b>${esc(r.title || r.id)}</b> <span class="muted">· ${esc(String(r.at || '').slice(0, 10))}</span>`
      + list(t('wn.features'), r.features) + list(t('wn.fixes'), r.fixes) + `</div>`).join('') + `</div>`;
  };
  // Once per page load: a note after an update (the newest notes differ from the ones seen last).
  W.check = async () => {
    if (W.checked) return; W.checked = true;
    const d = await W.load(), top = d[0];
    if (!top) return;
    let seen = null; try { seen = localStorage.getItem(KEY); } catch {}
    if (seen === null) { try { localStorage.setItem(KEY, top.id); } catch {} return; }   // new install: nothing to announce
    if (seen === top.id || $('wnNote')) return;
    const n = document.createElement('div');
    n.id = 'wnNote'; n.setAttribute('role', 'status');
    n.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:50;max-width:min(320px,calc(100vw - 24px));background:var(--card,#fff);color:inherit;border:1px solid var(--border,#8884);border-radius:10px;padding:10px 12px;box-shadow:0 4px 16px #0003';
    n.innerHTML = `${esc(t('wn.note'))} <a href="#/whats-new" id="wnOpen"><b>${esc(t('wn.open'))}</b></a> <button id="wnClose" aria-label="${esc(t('wn.close'))}" title="${esc(t('wn.close'))}">✕</button>`;
    const done = () => { try { localStorage.setItem(KEY, top.id); } catch {} n.remove(); };
    n.querySelector('#wnOpen').onclick = done; n.querySelector('#wnClose').onclick = done;
    document.body.appendChild(n);
  };
  return W;
})();
