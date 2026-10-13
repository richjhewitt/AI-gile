/* ---------- card view (AIG-119) ---------- */
// ---- cards: compact or roomy, and which details show on this board's cards ----
const CARD_DETAILS = ['assignee', 'type', 'priority', 'sprint', 'comments', 'age'];
// Two size tiles, the details as toggles in a grid, and a sample card beside them that changes as you click (AIG-184).
function cardViewDialog() {
  const v = cardViewOf(state.project);
  const tile = d => `<label class="cv-size ${v.density === d ? 'on' : ''}"><input type="radio" name="cv-density" value="${d}" ${v.density === d ? 'checked' : ''}>
      <span class="cv-pic ${d}"><i></i><i></i><i></i></span><b>${esc(t('cv.' + d))}</b><small class="muted">${esc(t('cv.' + d + '.help'))}</small></label>`;
  popNext('cards'); openDialog(`<div class="cv-dlg" onchange="previewCardView()"><h2>${esc(t('board.cards'))}</h2><p class="muted">${esc(t('cv.intro'))}</p>
    <div class="cv-grid"><div>
      <h3>${esc(t('cv.size'))}</h3><div class="cv-sizes">${tile('roomy')}${tile('compact')}</div>
      <h3>${esc(t('cv.show'))}</h3><div class="cv-toggles">${CARD_DETAILS.map(k => `<label class="cv-toggle"><input type="checkbox" data-cv="${k}" ${v.show[k] ? 'checked' : ''}><span>${esc(t('cv.' + k))}</span></label>`).join('')}</div>
    </div><div class="cv-side"><h3>${esc(t('cv.sample'))}</h3><div id="cv-sample" class="cv-sample"></div></div></div>
    <div class="err" id="cv-err"></div><div class="actions"><button class="primary" onclick="saveCardView()">${esc(t('common.save'))}</button>
    <button onclick="saveCardView(null)" title="${esc(t('cv.reset.title'))}">${esc(t('common.reset'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></div>`);
  paintCvSample();
}
// The sample: this board's busiest card, drawn with the choices in the dialog.
function paintCvSample() {
  const box = $('cv-sample'); if (!box) return;
  const cards = state.project.cards, c = [...cards].sort((a, b) => b.comments.length - a.comments.length)[0];
  // Only a picture of a card: no id, link or drag, so the board never mistakes it for the real one.
  box.innerHTML = c ? cardHtml(c).replace(/ data-id="[^"]*"/, '').replace(/ draggable="true"/, '').replace(/ href="[^"]*"/, '') : `<p class="muted">${esc(t('cv.nocards'))}</p>`;
  document.querySelectorAll('#dialog .cv-size').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
}
// Show each change on the board as you make it; Save keeps it, Cancel or closing drops it (AIG-119).
function previewCardView() {
  const show = {}; document.querySelectorAll('#dialog [data-cv]').forEach(b => { show[b.dataset.cv] = b.checked; });
  state.cvPreview = { slug: slug(), view: { density: document.querySelector('#dialog [name=cv-density]:checked').value, show } };
  renderBoardOnly(); paintCvSample();
}
async function saveCardView(reset) {
  const show = {}; document.querySelectorAll('#dialog [data-cv]').forEach(b => { show[b.dataset.cv] = b.checked; });
  const cardView = reset === null ? null : { density: document.querySelector('#dialog [name=cv-density]:checked').value, show };
  try { await api('PATCH', '/api/projects/' + slug(), { cardView }); state.cvPreview = null; closeDialog(); await rerender(); } catch (e) { setErr('cv-err', e); }
}

/* ---------- picture picker (AIG-175): a project picture or the app logo ---------- */
// id 'app-logo' edits the app logo (Setup), 'me-pic' your profile picture (Setup, AIG-150); any other id this project's picture (Look dialog).
const logoUrl = id => id === 'app-logo' ? '/api/app-logo' : id === 'me-pic' ? '/api/me-picture' : '/api/projects/' + slug() + '/logo';
function logoEditor(id, url) {
  return `<div id="${id}"><div class="logo-edit">${url ? `<img class="${id === 'app-logo' ? 'brand-logo' : 'pic'}" src="${esc(url)}" alt="">` : ''}
    <input type="file" id="${id}-file" accept=".png,.jpg,.jpeg,.svg,.ico,.webp" aria-label="${esc(t('logo.pick'))}" onchange="logoUpload('${id}')">
    ${url ? `<button type="button" onclick="logoRemove('${id}')">${esc(t('logo.remove'))}</button>` : ''}</div>
    <div class="logo-edit"><input type="text" id="${id}-path" placeholder="${esc(t('logo.path.ph'))}" aria-label="${esc(t('logo.path'))}"><button type="button" onclick="logoUsePath('${id}')">${esc(t('logo.use'))}</button></div>
    <small class="muted">${esc(t(id === 'me-pic' ? 'face.me.help' : 'logo.help'))}</small><div class="err" id="${id}-err"></div></div>`;
}
async function logoSend(id, method, body) {
  try {
    const r = await api(method, logoUrl(id), body);
    if (id === 'app-logo') { state.setup = r; applyAppLogo(r.logo); }
    else if (id === 'me-pic') { state.setup = r; state.ownerPic = r.mePic; }
    else state.project = { ...state.project, logo: r.logo };
    $(id).outerHTML = logoEditor(id, id === 'me-pic' ? r.mePic : r.logo);
  } catch (e) { setErr(id + '-err', e); }
}
function logoUpload(id) {
  const f = $(id + '-file').files[0]; if (!f) return;
  if (f.size > 1024 * 1024) return setErr(id + '-err', new Error(t('logo.toobig')));
  const rd = new FileReader();
  rd.onload = () => logoSend(id, 'POST', { name: f.name, type: f.type, data: String(rd.result).split(',')[1] });
  rd.readAsDataURL(f);
}
const logoUsePath = id => $(id + '-path').value.trim() && logoSend(id, 'POST', { path: $(id + '-path').value.trim() });
const logoRemove = id => logoSend(id, 'DELETE');
// The agents' picture library (AIG-150): the folder, and each picture with who wears it.
function libraryHtml(l) {
  l = l || { dir: '', pictures: [] };
  return `<div class="face-lib">${l.pictures.map(x => `<figure title="${esc(x.file)}"><img class="face" src="${esc(x.url)}" alt=""><figcaption class="muted">${esc(x.usedBy.map(u => u.name).join(', ') || t('face.free'))}</figcaption></figure>`).join('') || `<span class="muted">${esc(t('face.empty'))}</span>`}</div>
    <small class="muted">${esc(t('face.lib.help', { dir: l.dir }))}</small>`;
}

/* ---------- project look (AIG-86) ---------- */
// ---- look: the colour and emoji that mark this project in the inbox, tabs and home page ----
// 🖥️ This project's server (AIG-774): one from Setup > My servers, with an optional user and folder of its own.
function lookServerHtml(p) {
  const v = p.srv || {}, names = state.servers || [];
  return `<select id="look-srv" onchange="lookServer()"><option value="">${esc(t('look.server.none'))}</option>${names.map(n => `<option value="${esc(n)}" ${String(v.name || '').toLowerCase() === n.toLowerCase() ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <span id="look-srv-more" ${v.name ? '' : 'hidden'}><input type="text" id="look-srv-user" value="${esc(v.user || '')}" placeholder="${esc(t('look.server.user'))}" size="12"> <input type="text" id="look-srv-folder" value="${esc(v.folder || '')}" placeholder="${esc(t('look.server.folder'))}"></span>`;
}
const lookServer = () => { $('look-srv-more').hidden = !$('look-srv').value; };
const lookServerValue = () => ({ name: $('look-srv').value, user: $('look-srv-user').value.trim(), folder: $('look-srv-folder').value.trim() });
async function lookDialog() {
  const p = state.project;
  if (!state.setup) try { state.setup = await api('GET', '/api/setup'); } catch {}   // the default for where it runs (AIG-153)
  const def = leadPrefs().runIn || 'background', w = p.runIn || def;
  popNext('look'); openDialog(`<h2>${esc(t('board.look'))}</h2>
    <p class="muted">${esc(t('look.intro', { name: p.name }))}</p>
    <div class="row"><label class="f"><span>${esc(t('cols.emoji'))}</span><input type="text" id="look-emoji" value="${esc(p.emoji)}" maxlength="8"></label>
    <label class="f"><span>${esc(t('cols.colour'))}</span><input type="color" id="look-color" value="${esc(p.color)}"></label></div>
    <div class="f"><span>${esc(t('logo.title'))}</span>${logoEditor('look-logo', p.logo)}</div>
    <label class="chk ai-only"><input type="checkbox" id="look-chatty" ${p.chatty ? 'checked' : ''}> ${esc(t('look.chatty'))} <span class="muted">${esc(t('look.chatty.cost'))}</span></label>
    <label class="chk"><input type="checkbox" id="look-private" ${p.private ? 'checked' : ''} onchange="Pub.tick('private')"> 🔒 ${esc(t('look.private'))} <span class="muted">${esc(t('look.private.sub'))}</span></label>
    ${Pub.lookHtml(p)}
    <label class="chk"><input type="checkbox" id="look-aioff" ${p.aiOff ? 'checked' : ''}> ⏸ ${esc(t('look.aioff'))} <span class="muted">${esc(t('look.aioff.sub'))}</span></label>
    <label class="chk ai-only"><input type="checkbox" id="look-verbose" ${p.verbose ? 'checked' : ''}> ${esc(t('look.verbose'))}</label>
    <label class="chk ai-only"><input type="checkbox" id="look-second" ${p.secondLead ? 'checked' : ''}> ${esc(t('look.second'))} <span class="muted">${esc(t('look.second.sub'))}</span></label>
    <label class="chk"><input type="checkbox" id="look-life" ${p.lifeBoard ? 'checked' : ''}> ${esc(t('look.life'))} <span class="muted">${esc(t('look.life.sub'))}</span></label>
    <label class="f ai-only"><span>${esc(t('look.runin'))}</span>${runInSelect('look-runin', p.runIn || '', 'lookRunIn()', def)}${runInBlind(w)}</label>
    <label class="f ai-only" id="look-runcmd-box" ${w === 'other' ? '' : 'hidden'}><span>${esc(t('runin.cmd'))}</span><input type="text" id="look-runcmd" value="${esc(p.runCmd || '')}" placeholder="${esc(leadPrefs().runCmd || 'cursor "{folder}"')}"><small class="muted">${esc(t('runin.cmd.look'))}</small></label>
    <div class="f" id="look-server"><span>🖥️ ${esc(t('look.server'))}</span><div>${lookServerHtml(p)}</div><small class="muted">${esc(t('look.server.sub'))}</small></div>
    <div class="f" id="look-roles"><span>${esc(t('tm.h'))}</span><div><button type="button" onclick="teamDialog()">${esc(t('look.team.open'))}</button></div><small class="muted">${esc(t('look.team.moved'))}</small></div>
    <div class="err" id="look-err"></div>
    <div class="actions"><button class="primary" onclick="saveLook()">${esc(t('common.save'))}</button><button onclick="saveLook(true)" title="${esc(t('look.auto.title'))}">${esc(t('look.auto'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
// 👥 The roles on this project moved to their own dialog (AIG-423, dialogs/team-profile.js); Look only opens it.
async function saveLook(auto) {
  try {
    await api('PATCH', '/api/projects/' + slug(), auto ? { color: '', emoji: '' } : { color: $('look-color').value, emoji: $('look-emoji').value, chatty: $('look-chatty').checked, verbose: $('look-verbose').checked, secondLead: $('look-second').checked, lifeBoard: $('look-life').checked, private: $('look-private').checked, personal: $('look-personal').checked, public: $('look-public').checked, publicName: $('look-pubname').value.trim(), aiOff: $('look-aioff').checked, runIn: $('look-runin').value, runCmd: $('look-runcmd').value, srv: lookServerValue() });
    closeDialog(); await rerender();
  } catch (e) { setErr('look-err', e); }
}

