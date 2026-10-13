/* ---------- 🧑‍🤝‍🧑 Setup > Roles (AIG-676, AIG-677) ---------- */
// One screen for two things: who may make projects (a tick per user or agent) and who gets into each of your servers
// (none / run board server tasks / full admin). Server side: lib/roles.js (GET/POST /api/roles; the access is stored
// on each servers entry in aigile.local.json). Full admin is a note: the ssh key is added on the server by hand.
// Roles.canRun(server): the viewer's level for ▶ Run. The owner is always allowed; localStorage aigile.viewAs = a name
// shows the board as that person would see it (state.srvAccess comes from /api/meta).
const Roles = (() => {
  let data = null, msg = '';
  const LEVELS = ['none', 'run', 'admin'];
  const viewAs = () => { try { return (localStorage.getItem('aigile.viewAs') || '').trim().toLowerCase(); } catch { return ''; } };
  function levelOf(server, name) {
    const a = (state.srvAccess || {})[server] || {}, k = Object.keys(a).find(x => x.toLowerCase() === String(name).toLowerCase());
    return k ? a[k] : 'none';
  }
  const canRun = server => { const v = viewAs(); return !v || v === String(state.owner || '').toLowerCase() || levelOf(server, v) !== 'none'; };
  const others = () => ((data && data.people) || []).filter(p => !p.fixed);
  function html() {
    if (!data) { load(); return `<span>${esc(t('roles.h'))}</span>`; }
    const srvs = leadPrefs().servers || [];
    const make = (data.people || []).map(p => `<label class="chk roles-make" data-who="${esc(p.name)}"><input type="checkbox" ${p.canMake ? 'checked' : ''} ${p.fixed ? 'disabled' : ''} onchange="Roles.make(this)"> <b>${esc(p.name)}</b> <span class="muted">${esc(t('roles.kind.' + p.kind))}</span></label>`).join('');
    const acc = srvs.map((s, i) => `<div class="roles-srv" data-srv-i="${i}"><b>${esc(s.name)}</b>${others().map(p => {
      const cur = (s.access && Object.keys(s.access).find(k => k.toLowerCase() === p.name.toLowerCase())) ? s.access[Object.keys(s.access).find(k => k.toLowerCase() === p.name.toLowerCase())] : 'none';
      return `<label class="roles-lvl"><span>${esc(p.name)}</span><select data-i="${i}" data-who="${esc(p.name)}" onchange="Roles.level(this)">${LEVELS.map(l => `<option value="${l}" ${cur === l ? 'selected' : ''}>${esc(t('roles.level.' + l))}</option>`).join('')}</select></label>`;
    }).join('') || `<small class="muted">${esc(t('roles.none'))}</small>`}</div>`).join('');
    return `<span>${esc(t('roles.h'))}</span><small class="muted">${esc(t('roles.help'))}</small>
      <h4>${esc(t('roles.make.h'))}</h4><small class="muted">${esc(t('roles.make.help'))}</small><div class="roles-list">${make}</div>
      <h4>${esc(t('roles.srv.h'))}</h4><small class="muted">${esc(t('roles.srv.help'))}</small>
      ${acc || `<small class="muted" id="roles-nosrv">${esc(t('roles.srv.none'))}</small>`}
      <div class="err" id="roles-err"></div><div class="muted">${esc(msg)}</div>`;
  }
  const paint = () => { const b = $('rolesBox'); if (b) b.innerHTML = html(); };
  async function load() { try { data = await api('GET', '/api/roles'); } catch (e) { data = { people: [] }; } paint(); }
  async function make(el) {
    msg = '';
    try { data = await api('POST', '/api/roles', { name: el.closest('[data-who]').dataset.who, canMake: el.checked }); msg = t('setup.saved.short'); } catch (e) { setErr('roles-err', e); return; }
    paint();
  }
  async function level(el) {
    const s = (leadPrefs().servers || [])[+el.dataset.i]; if (!s) return;
    const access = { ...(s.access || {}) };
    for (const k of Object.keys(access)) if (k.toLowerCase() === el.dataset.who.toLowerCase()) delete access[k];
    if (el.value !== 'none') access[el.dataset.who] = el.value;
    const servers = (leadPrefs().servers || []).map((x, i) => { const y = { ...x }; if (i === +el.dataset.i) y.access = access; return y; });
    try {
      state.setup = await api('POST', '/api/setup', { prefs: { servers } });
      msg = t(el.value === 'admin' ? 'roles.srv.admin.note' : 'setup.saved.short');
      if (typeof srvDraft !== 'undefined') { srvDraft = null; if (typeof srvPaint === 'function') srvPaint(); }
      const m = await api('GET', '/api/meta'); state.srvAccess = m.srvAccess || {};
    } catch (e) { setErr('roles-err', e); return; }
    paint();
  }
  return { html, load, make, level, canRun, reset: () => { data = null; msg = ''; } };
})();
