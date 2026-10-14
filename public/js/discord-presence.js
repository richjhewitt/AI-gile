// 🎮 Discord activity (AIG-642): the Setup box, and telling the board which project is on screen (lib/presence.js does the rest:
// only a 🌍 Public project ever goes out to Discord).
const Presence = (() => {
  let st = { on: false, clientId: '', project: false, connected: false, error: '' }, sent = null;
  function html() {
    const s = !st.on ? '' : st.connected ? '🟢 ' + t('presence.ok') : st.error === 'clientId' ? '⚠️ ' + t('presence.err.id') : st.error ? '⚠️ ' + t('presence.err.discord') : '⚪ ' + t('presence.wait');
    return `<span>🎮 ${esc(t('presence.h'))}</span><small class="muted">${esc(t('presence.help'))}</small>
      <label class="chk"><input type="checkbox" id="presOn" ${st.on ? 'checked' : ''} onchange="Presence.save({ on: this.checked })"> ${esc(t('presence.on'))}</label>
      <label>${esc(t('presence.id'))} <input type="text" id="presId" inputmode="numeric" autocomplete="off" value="${esc(st.clientId)}" placeholder="123456789012345678" onchange="Presence.save({ clientId: this.value })"></label>
      <small class="muted">${t('presence.id.help.html')}</small>
      <label class="chk"><input type="checkbox" id="presProj" ${st.project ? 'checked' : ''} onchange="Presence.save({ project: this.checked })"> ${esc(t('presence.project'))}</label>
      <small class="muted" id="presStatus">${esc(s)}</small>`;
  }
  const paint = () => { const b = $('presenceBox'); if (b) b.innerHTML = html(); };
  async function load() { try { st = await api('GET', '/api/presence'); } catch {} paint(); }
  async function save(b) { try { st = await api('POST', '/api/presence', b); } catch (e) { alert(e.message); } paint(); setTimeout(load, 1500); }
  // The project on screen; the board decides whether it may be shown (Public only).
  function tell() {
    const r = typeof parseRoute === 'function' ? parseRoute() : null, slug = r && r.view === 'project' ? r.slug : '';
    if (slug === sent) return; sent = slug;
    api('POST', '/api/presence/open', { slug }).catch(() => {});
  }
  function start() { window.addEventListener('hashchange', tell); tell(); }
  return { html, load, save, start };
})();
Presence.start();
