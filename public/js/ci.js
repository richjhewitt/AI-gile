/* ---------- 🗂️ Configuration items (#/ci/<slug>, AIG-1122) ----------
   The things a service stands on (servers, domains, certificates, keys, repos, suppliers) from GET /api/projects/:slug/ci, with
   add / edit / remove (owner). A server name can be picked from My servers, a key name from Secrets (names only, never a value). */
const CiPage = (() => {
  const C = { data: null, slug: '', edit: null };
  const q = s => esc(s).replace(/'/g, '&#39;');
  C.load = async slug => {
    if (C.slug !== slug) { C.slug = slug; C.data = null; C.edit = null; }
    try { C.data = await api('GET', `/api/projects/${slug}/ci`); } catch { C.data = { error: true }; }
  };
  const reload = async () => { state.lastSig = state.lastBoardSig = null; await C.load(C.slug); render(); };
  C.start = id => { C.edit = id; state.lastSig = state.lastBoardSig = null; render(); };
  C.kindChanged = () => {
    const k = $('ci-kind').value, d = C.data || {}, l = $('ci-names');
    l.innerHTML = (k === 'server' ? d.servers : k === 'key' ? d.keys : []).map(n => `<option value="${esc(n)}">`).join('');
    $('ci-hint').textContent = k === 'key' ? t('ci.key.hint') : '';
  };
  C.save = async () => {
    const v = id => $('ci-' + id).value, days = v('bdays').trim();
    const body = { kind: v('kind'), name: v('name'), detail: v('detail'), expires: v('expires'), links: v('links'),
      backup: v('bwhere').trim() ? { where: v('bwhere'), everyDays: days } : null };
    try {
      if (C.edit && C.edit !== 'new') await api('PATCH', `/api/projects/${C.slug}/ci/${encodeURIComponent(C.edit)}`, body);
      else await api('POST', `/api/projects/${C.slug}/ci`, body);
      C.edit = null; await reload();
    } catch (e) { $('ci-err').textContent = e.message; }
  };
  C.remove = async id => {
    if (!confirm(t('ci.remove.ask', { id }))) return;
    try { await api('DELETE', `/api/projects/${C.slug}/ci/${encodeURIComponent(id)}`); } catch (e) { alert(e.message); }
    await reload();
  };
  const form = x => {
    const d = C.data, o = x || { kind: 'server', links: [] };
    return `<form class="ci-form box" onsubmit="CiPage.save(); return false">
      <label class="f"><span>${esc(t('ci.kind'))}</span><select id="ci-kind" onchange="CiPage.kindChanged()">${d.kinds.map(k => `<option value="${k}"${k === o.kind ? ' selected' : ''}>${esc(t('ci.kind.' + k))}</option>`).join('')}</select></label>
      <label class="f"><span>${esc(t('ci.name'))}</span><input type="text" id="ci-name" list="ci-names" maxlength="120" value="${esc(o.name || '')}" required><datalist id="ci-names">${(o.kind === 'server' ? d.servers : o.kind === 'key' ? d.keys : []).map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <p class="muted" id="ci-hint">${o.kind === 'key' ? esc(t('ci.key.hint')) : ''}</p>
      <label class="f"><span>${esc(t('ci.detail'))}</span><input type="text" id="ci-detail" maxlength="500" value="${esc(o.detail || '')}"></label>
      <label class="f"><span>${esc(t('ci.expires'))}</span><input type="date" id="ci-expires" value="${esc(o.expires || '')}"></label>
      <label class="f"><span>${esc(t('ci.backup.where'))}</span><input type="text" id="ci-bwhere" maxlength="200" value="${esc(o.backup ? o.backup.where : '')}"></label>
      <label class="f"><span>${esc(t('ci.backup.days'))}</span><input type="number" id="ci-bdays" min="1" max="3650" value="${esc(o.backup ? o.backup.everyDays : '')}"></label>
      <label class="f"><span>${esc(t('ci.links'))}</span><input type="text" id="ci-links" maxlength="800" value="${esc((o.links || []).filter(l => typeof l === 'string').join(', '))}" placeholder="${esc(t('ci.links.ph'))}"></label>
      <p class="rk-flag" id="ci-err"></p>
      <div class="actions"><button class="primary" type="submit" id="ci-save">${esc(t('ci.save'))}</button><button type="button" onclick="CiPage.start(null)">${esc(t('common.cancel'))}</button></div></form>`;
  };
  // 🔗 History (AIG-1123): the incident, problem and change cards that affected this item, newest first.
  const hist = x => (x.history || []).length ? `<ul class="ci-hist">${x.history.map(h => `<li data-hist="${esc(h.card)}"><a href="#/p/${esc(C.slug)}/${esc(h.card)}">${esc(h.card)}</a> ${esc(h.title)} <span class="pill">${esc(h.status)}</span> <span class="muted">${esc(ago(h.at))}</span></li>`).join('')}</ul>` : '';
  // The "Affects" picker on an incident, problem or change card: tick the items it hits.
  C.affects = (p, c) => !['incident', 'problem', 'change'].includes(c.type) || !(p.ci || []).length ? '' :
    `<div class="affects"><b>${esc(t('ci.affects'))}</b> ${p.ci.map(x => `<label><input type="checkbox" data-affects="${esc(x.id)}" ${(c.ci || []).includes(x.id) ? 'checked' : ''} onchange="CiPage.affect('${q(c.id)}', '${q(x.id)}', this.checked)"> ${esc(x.name)}</label>`).join(' ')}</div>`;
  C.affect = async (card, item, on) => {
    try { await api('POST', `/api/projects/${slug()}/ci/${encodeURIComponent(item)}/link`, { card, on }); refresh(true); } catch (e) { alert(e.message); }
  };
  const row = x => {
    const bits = [x.expires ? esc(t('ci.expires.on', { day: x.expires })) : '', x.backup ? esc(t('ci.backup.line', { where: x.backup.where, days: x.backup.everyDays })) : '',
      ...(x.links || []).filter(l => typeof l === 'string').map(l => /^https?:\/\//.test(l) ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a>` : esc(l))].filter(Boolean).join(' · ');
    return `<li class="ci-row" data-ci="${esc(x.id)}"><div><b>${esc(x.name)}</b> <span class="pill">${esc(t('ci.kind.' + x.kind))}</span> <span class="muted">${esc(x.id)}</span>
      <button type="button" data-edit="${esc(x.id)}" onclick="CiPage.start('${q(x.id)}')">${esc(t('ci.edit'))}</button>
      <button type="button" data-rm="${esc(x.id)}" onclick="CiPage.remove('${q(x.id)}')">${esc(t('ci.remove'))}</button></div>
      ${x.detail ? `<div>${esc(x.detail)}</div>` : ''}${bits ? `<div class="muted">${bits}</div>` : ''}${hist(x)}</li>`;
  };
  C.render = () => {
    const d = C.data, back = `<a href="#/p/${esc(C.slug)}">${esc(t('ci.back'))}</a>`;
    if (!d) return `<div class="uz ci-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz ci-page"><p>${back}</p><p class="muted">${esc(t('ci.error'))}</p></div>`;
    const editing = C.edit && C.edit !== 'new' ? d.items.find(x => x.id === C.edit) : null;
    return `<div class="uz ci-page"><p>${back}</p><h2>${esc(t('ci.title'))}</h2>
      ${C.edit ? form(editing) : `<p><button type="button" class="primary" id="ci-add" onclick="CiPage.start('new')">${esc(t('ci.add'))}</button></p>`}
      ${d.items.length ? `<ul class="ci-list">${d.items.map(row).join('')}</ul>` : `<p class="muted">${esc(t('ci.none'))}</p>`}</div>`;
  };
  return C;
})();
