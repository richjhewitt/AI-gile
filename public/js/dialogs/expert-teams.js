/* ---------- 🧰 premade expert teams (AIG-577..579): in the 👥 Team dialog ---------- */
// Pick a template (UX overhaul, Security and pen test, ...), set the team size with a slider (Lead first, more roles as it
// grows), see a rough usage estimate per hour and per sprint, then apply: the roster is filled and the starter cards land in the
// backlog. XT.data = GET /api/expert-teams (lib/expertteams.js; templates in profiles/expert-teams.json and the board's own
// run history as the estimate's baseline). The text of names and purposes is in the language files; roles' jobs and cards are data.
const XT = { data: null, id: '', size: 3, msg: '' };
async function xtLoad() { try { XT.data = await api('GET', '/api/expert-teams'); } catch { XT.data = null; } }
const xtTeam = () => XT.data && XT.data.teams.find(x => x.id === XT.id);
const xtShort = n => n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
// Tokens an hour for the first `size` roles: each role's model weight times the board's baseline for one Sonnet-sized agent.
function xtEstimate(tm, size) {
  const d = XT.data, w = tm.roles.slice(0, size).reduce((a, r) => a + (d.weights[r.model] || 1), 0), hour = w * d.history.perSonnetHour;
  return { hour, sprint: hour * d.sprintHours };
}
function xtHtml() {
  if (!XT.data) return '';
  const d = XT.data, tm = xtTeam();
  return `<div class="xt" id="xt"><h3>${esc(t('xt.h'))}</h3><small class="muted">${esc(t('xt.sub'))}</small>
    <div class="tm-add"><select id="xt-pick" onchange="xtPick(this.value)" aria-label="${esc(t('xt.pick'))}"><option value="">${esc(t('xt.pick'))}</option>${d.teams.map(x => `<option value="${esc(x.id)}" ${x.id === XT.id ? 'selected' : ''}>${esc(t('xt.name.' + x.id))}</option>`).join('')}</select></div>
    <div id="xt-live">${tm ? xtLive(tm) : ''}</div>
    <div class="tm-msg" id="xt-msg" role="status">${XT.msg}</div></div>`;
}
function xtLive(tm) {
  const d = XT.data, size = Math.min(XT.size, tm.roles.length), e = xtEstimate(tm, size), h = d.history;
  const row = (r, i) => `<li class="${i < size ? '' : 'muted'}" data-on="${i < size ? 1 : 0}"><b>${esc(roleName(r.role))}</b> <span class="muted">${esc(Model(r.model))} · ${esc(r.job)}</span></li>`;
  return `<p>${esc(t('xt.purpose.' + tm.id))}</p>
    <label class="f scale"><span>${esc(t('xt.size'))} <b id="xt-n">${size}</b></span><input type="range" id="xt-size" min="1" max="${d.max}" step="1" value="${size}" aria-valuetext="${esc(t('xt.agents', { count: size }))}" oninput="xtSize(this.value)"></label>
    <div class="xt-est" id="xt-est"><b>${esc(t('xt.est.h'))}</b> <span id="xt-est-t">${esc(t('xt.est', { hour: xtShort(e.hour), sprint: xtShort(e.sprint), hours: d.sprintHours }))}</span>
      <small class="muted">${esc(h.runs ? t('xt.est.hist', { count: h.runs }) : t('xt.est.default'))}</small></div>
    <ul class="xt-roles" id="xt-roles">${tm.roles.map(row).join('')}</ul>
    <b>${esc(t('xt.cards'))}</b><ul class="xt-cards">${tm.cards.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <b>${esc(t('xt.done'))}</b><ul class="xt-done">${tm.done.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <div class="actions"><button type="button" class="primary" id="xt-apply" onclick="xtApply()">${esc(t('xt.apply'))}</button></div>`;
}
function xtPick(id) { XT.id = id; XT.msg = ''; const tm = xtTeam(); $('xt-live').innerHTML = tm ? xtLive(tm) : ''; $('xt-msg').innerHTML = ''; }
function xtSize(n) {
  XT.size = Number(n); const tm = xtTeam(); if (!tm) return;
  const e = xtEstimate(tm, XT.size);
  $('xt-n').textContent = XT.size; $('xt-size').setAttribute('aria-valuetext', t('xt.agents', { count: XT.size }));
  $('xt-est-t').textContent = t('xt.est', { hour: xtShort(e.hour), sprint: xtShort(e.sprint), hours: XT.data.sprintHours });
  document.querySelectorAll('#xt-roles li').forEach((li, i) => { li.className = i < XT.size ? '' : 'muted'; li.dataset.on = i < XT.size ? 1 : 0; });
}
async function xtApply() {
  const tm = xtTeam(); if (!tm) return;
  const before = tmOn(), size = Math.min(XT.size, tm.roles.length);
  try {
    const r = await api('POST', '/api/projects/' + slug() + '/expert-team', { team: tm.id, size });
    TM.before = before;
    XT.msg = esc(t('xt.applied', { team: t('xt.name.' + tm.id), count: r.cards.length, roles: tm.roles.slice(0, size).map(x => roleName(x.role)).join(', ') })) + tmBtn('teamUndo()', 'xt.undo');
    await teamPaint();
  } catch (e) { setErr('tm-err', e); }
}
