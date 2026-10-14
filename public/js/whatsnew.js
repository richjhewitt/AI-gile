// ✨ What's new (#/whats-new, AIG-562): release notes from public/releases.json, newest first. The lead's release step writes
// that file with `aigile release-notes <proj>` (new features and bugs fixed, from the done cards). After an update the page
// shows a small note once, linking here; a new install marks the newest notes as seen without showing it.
// ↩ Roll back (AIG-563): an earlier build can be chosen here (GET /api/rollback says which); you stay on it until you click
// Back to the latest.
const WhatsNew = (() => {
  const W = { data: null, rb: null, checked: false };
  const KEY = 'aigile.seenRelease';
  W.load = async () => {
    try { const r = await fetch('releases.json', { cache: 'no-store' }); W.data = r.ok ? await r.json() : []; } catch { W.data = []; }
    if (!Array.isArray(W.data)) W.data = [];
    try { W.rb = await api('GET', '/api/rollback'); } catch { W.rb = null; }
    return W.data;
  };
  const list = (head, items) => items && items.length
    ? `<h4>${esc(head)}</h4><ul>${items.map(i => `<li><span class="muted">${esc(i.id)}</span> ${esc(i.title)}</li>`).join('')}</ul>` : '';
  const backBtn = r => W.rb && W.rb.can && r.commit && W.rb.builds.some(b => b.commit === r.commit)
    ? ` <button class="wn-back" onclick="WhatsNew.goBack('${esc(r.commit)}')">${esc(t('wn.back'))}</button>` : '';
  W.render = () => {
    const d = W.data || [], pin = W.rb && W.rb.pinned;
    const banner = pin ? `<div class="uz-card wn-pinned"><b>${esc(t('wn.pinned', { name: pin.title || pin.commit.slice(0, 7) }))}</b> <button class="primary" id="wnLatest" onclick="WhatsNew.latest()">${esc(t('wn.latest'))}</button></div>` : '';
    if (!d.length) return `<div class="uz"><h2>${esc(t('wn.title'))}</h2>${banner}<p class="muted">${esc(t('wn.empty'))}</p></div>`;
    return `<div class="uz"><h2>${esc(t('wn.title'))}</h2>${banner}` + d.map(r => `<div class="uz-card wn-rel"><b>${esc(r.title || r.id)}</b> <span class="muted">· ${esc(String(r.at || '').slice(0, 10))}</span>${backBtn(r)}`
      + list(t('wn.features'), r.features) + list(t('wn.fixes'), r.fixes) + `</div>`).join('') + `</div>`;
  };
  const after = () => setTimeout(() => location.reload(), 5000);
  W.goBack = async commit => {
    if (!confirm(t('wn.back.sure'))) return;
    try { await api('POST', '/api/rollback', { commit }); alert(t('wn.restarting')); after(); } catch (e) { alert(e.message); }
  };
  W.latest = async () => {
    try { await api('POST', '/api/rollback/latest'); alert(t('wn.restarting')); after(); } catch (e) { alert(e.message); }
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

// 📦 Update channel in Setup (AIG-560): Stable (daily, only when QA is green) or Live (what the owner runs, for testers).
// Only for installs cloned from GitHub; html() paints what it knows and fetches the rest once.
const Channel = (() => {
  const C = { st: undefined };
  const paint = () => { const b = $('channelBox'); if (b) b.innerHTML = C.html(); };
  C.load = async () => { try { C.st = await api('GET', '/api/channel'); } catch { C.st = null; } paint(); };
  C.html = () => {
    if (C.st === undefined) { C.st = null; C.load(); return ''; }
    const s = C.st; if (!s || !s.can) return '';
    const opt = v => `<option value="${v}" ${s.channel === v ? 'selected' : ''}>${esc(t('ch.' + v))}</option>`;
    return `<span>${esc(t('ch.h'))}</span><select id="channelPick" onchange="Channel.set(this.value)">${s.channel === 'other' || !s.channel ? `<option selected disabled>${esc(s.upstream || '?')}</option>` : ''}${opt('stable')}${opt('live')}</select>`
      + `<small class="muted" id="channelHelp">${esc(t(s.channel === 'live' ? 'ch.live.warn' : 'ch.help'))}${s.stableExists ? '' : ' ' + esc(t('ch.nostable'))}</small>`;
  };
  C.set = async v => {
    if (v === 'live' && !confirm(t('ch.live.warn'))) { paint(); return; }
    try { C.st = await api('PUT', '/api/channel', { channel: v }); } catch (e) { alert(e.message); }
    paint();
  };
  return C;
})();
