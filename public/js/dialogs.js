/* ---------- dialog shell ---------- */
function openDialog(html, cls = '') {
  $('dialog').innerHTML = `<div class="overlay center"><div class="dialog ${cls}">${html}</div></div>`;
  const f = $('dialog').querySelector('input[type=text]'); if (f) f.focus();
}
function closeDialog() {
  $('dialog').innerHTML = '';
  if (state.cvPreview) { state.cvPreview = null; renderBoardOnly(); }   // an unsaved card view preview goes away (AIG-119)
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('dialog').firstChild) closeDialog(); });

/* ---------- new card ---------- */
function newCard(preset = {}) {
  const bug = preset.type === 'bug';
  // Rich's new cards go straight to the team (AIG-51); the + on a column still picks that column.
  const c = { title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'team', assignee: '', sprint: '', ...preset };
  Attach.clear('new:' + slug());
  openDialog(`<h2>${esc(bug ? t('board.raisebug') : t('dlg.newcard'))}</h2>
    <form onsubmit="return createCard(event)">${cardFields(c, bug ? { titlePh: t('dlg.bug.titleph'), descLabel: t('dlg.bug.desclabel'), descPh: t('dlg.bug.descph') } : { titlePh: t('dlg.newcard.titleph') })}
      <div class="err" id="d-err"></div>
      <div class="actions"><button class="${bug ? 'bug' : 'primary'}" type="submit">${esc(bug ? t('dlg.raisebug') : t('dlg.createcard'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('new:' + slug())}</div></form>`, 'newcard');
}
async function createCard(e) {
  e.preventDefault();
  const body = readFields(false, false);
  if (!body.title) { setErr('d-err', t('dlg.err.title')); return false; }
  try {
    const attachments = await Attach.upload('new:' + slug(), slug());
    const c = await api('POST', `/api/projects/${slug()}/cards`, { ...body, createdBy: me(), attachments });
    Attach.clear('new:' + slug());
    closeDialog();
    await rerender();
  } catch (err) { setErr('d-err', err); }
  return false;
}

/* ---------- new project, archive ---------- */
// The folder is suggested from the name (next to AI-gile) and set up for the team on create (AIG-73).
async function newProject() {
  try { state.home = state.home || (await api('GET', '/api/meta')).home; } catch {}
  openDialog(`<h2>${esc(t('dlg.newproject'))}</h2>
    <form onsubmit="return createProject(event)">
      <label class="f"><span>${esc(t('dlg.np.name'))}</span><input type="text" id="p-name" oninput="suggestKey()" maxlength="80"></label>
      <div class="row"><label class="f"><span>${esc(t('dlg.np.key'))}</span><input type="text" id="p-key" maxlength="6" oninput="this.dataset.touched=1"></label></div>
      <label class="f"><span>${esc(t('dlg.np.folder'))}</span><input type="text" id="p-path" oninput="this.dataset.touched=1" placeholder="${esc(t('dlg.np.folder.ph'))}"></label>
      <label class="f"><span>${esc(t('dlg.np.desc'))}</span><textarea id="p-desc" rows="3"></textarea></label>
      <div class="err" id="d-err"></div><div id="p-done"></div>
      <div class="actions" id="p-acts"><button class="primary" type="submit">${esc(t('dlg.np.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`);
}
function suggestKey() {
  const name = $('p-name').value, k = $('p-key'), f = $('p-path');
  if (!k.dataset.touched) k.value = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim();
  if (!f.dataset.touched && state.home) f.value = clean ? state.home + '\\' + clean : '';
}
async function createProject(e) {
  e.preventDefault();
  const name = $('p-name').value.trim(), folder = $('p-path').value.trim();
  if (!name) { setErr('d-err', t('dlg.np.err.name')); return false; }
  let p;
  try {
    p = await api('POST', '/api/projects', { name, key: $('p-key').value.trim(), description: $('p-desc').value.trim() });
  } catch (err) { setErr('d-err', err); return false; }
  if (!folder) { closeDialog(); location.hash = '#/p/' + p.slug; return false; }
  $('p-acts').innerHTML = `<button type="button" class="primary" onclick="closeDialog(); location.hash = '#/p/${p.slug}'">${esc(t('dlg.np.open'))}</button>`;
  try {
    const r = await api('POST', `/api/projects/${p.slug}/connect`, { path: folder, create: true, wake: true });
    $('d-err').textContent = '';
    $('p-done').innerHTML = `<ul>${[t('dlg.np.created'), ...r.done].map(d => `<li>✅ ${esc(d)}</li>`).join('')}</ul>`;
  } catch (err) { setErr('d-err', t('dlg.np.err.folder', { msg: err.message })); }
  return false;
}
async function setArchived(on) {
  if (on && !confirm(t('dlg.archive.confirm'))) return;
  try {
    await api('PATCH', '/api/projects/' + slug(), { archived: on });
    if (on) location.hash = '#/'; else await rerender();
  } catch (err) { alert(err.message); }
}
function toggleArchived(on) {
  state.showArchived = on;
  try { localStorage.setItem('aigile.showArchived', on ? '1' : '0'); } catch {}
  rerender();
}

/* ---------- connect a folder ---------- */
// ---- connect a folder: sets the project's folder up so its team uses the board and the ways of working ----
async function connectDialog() {
  const p = state.project;
  let suggest = p.path;
  if (!suggest) { try { const m = await api('GET', '/api/meta'); suggest = m.home + '\\' + p.name.replace(/[<>:"/\\|?*]/g, '').trim(); } catch { suggest = ''; } }
  openDialog(`<h2>${esc(p.path ? t('dlg.conn.h.done') : t('dlg.conn.h'))}</h2>
    <p class="muted">${esc(t('dlg.conn.intro'))}</p>
    <label class="f"><span>${esc(t('dlg.folder'))}</span><input type="text" id="c-path" value="${esc(suggest)}"></label>
    <label class="chk"><input type="checkbox" id="c-create" checked> ${esc(t('dlg.conn.create'))}</label>
    <div class="err" id="c-err"></div><div id="c-done"></div>
    <div class="actions"><button class="primary" id="c-go" onclick="doConnect()">${esc(p.path ? t('dlg.conn.reconnect') : t('dlg.conn.connect'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
}
async function doConnect() {
  try {
    const r = await api('POST', `/api/projects/${slug()}/connect`, { path: $('c-path').value, create: $('c-create').checked });
    $('c-err').textContent = '';
    $('c-done').innerHTML = `<ul>${r.done.map(d => `<li>✅ ${esc(d)}</li>`).join('')}</ul><p>${t('dlg.conn.next.html')}</p>`;
    $('c-go').remove();
  } catch (e) { setErr('c-err', e); }
}

/* ---------- find my projects (AIG-94) ---------- */
// ---- find my projects: list the project folders in a folder (git, old sessions, README), tick, import ----
async function findProjectsDialog(dir) {
  openDialog(`<h2>${esc(t('dlg.find.h'))}</h2><p class="muted">${esc(t('dlg.find.intro'))}</p>
    <div class="row"><label class="f" style="flex:1"><span>${esc(t('dlg.folder'))}</span><input type="text" id="fp-dir" value="${esc(dir || state.home || '')}"></label>
    <button style="align-self:flex-end" onclick="findProjectsDialog($('fp-dir').value)">${esc(t('dlg.find.look'))}</button></div>
    <div id="fp-list" class="muted">${esc(t('dlg.find.looking'))}</div><div class="err" id="fp-err"></div><div id="fp-done"></div>
    <div class="actions" id="fp-acts"></div>`, 'wide');
  try {
    if (!state.home) state.home = (await api('GET', '/api/meta')).home;
    if (!dir) $('fp-dir').value = state.home;
    state.found = await api('GET', '/api/discover' + (dir ? '?dir=' + encodeURIComponent(dir) : ''));
  } catch (e) { $('fp-list').textContent = ''; setErr('fp-err', e); return; }
  const key = n => n.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'PRJ';
  const info = f => [f.git ? t('dlg.find.commits', { n: f.git.commits }) + (f.git.lastAt ? t('dlg.find.last', { when: ago(f.git.lastAt) }) : '') : t('dlg.find.nogit'), f.sessions ? t('dlg.find.sessions', { n: f.sessions.count }) : '',
    f.known ? t('dlg.find.known') : f.inside ? t('dlg.find.inside', { dir: f.inside }) : f.copy ? t('dlg.find.copy') : ''].filter(Boolean).join(' · ');
  $('fp-list').classList.remove('muted');
  $('fp-list').innerHTML = state.found.length ? state.found.map((f, i) => `<div class="fprow">
    <input type="checkbox" data-i="${i}" ${f.suggested ? 'checked' : ''} ${f.known ? 'disabled' : ''} aria-label="${esc(t('dlg.find.add', { name: f.name }))}">
    <input type="text" class="fp-name" value="${esc(f.name)}" aria-label="${esc(t('dlg.find.name'))}"><input type="text" class="fp-key" value="${key(f.name)}" maxlength="6" aria-label="${esc(t('dlg.find.key'))}">
    <span class="muted">${esc(info(f))}${f.readme ? ' · ' + esc(f.readme) : ''}</span></div>`).join('') : esc(t('dlg.find.none'));
  $('fp-acts').innerHTML = `<label class="chk"><input type="checkbox" id="fp-connect" checked> ${esc(t('dlg.find.setup'))}</label>
    <button class="primary" onclick="importFound()">${esc(t('dlg.find.import'))}</button><button onclick="closeDialog()">${esc(t('common.close'))}</button>`;
}
async function importFound() {
  const rows = [...document.querySelectorAll('.fprow')].filter(r => r.querySelector('input[type=checkbox]').checked);
  if (!rows.length) { setErr('fp-err', t('standup.pick.none')); return; }
  const done = [];
  for (const r of rows) {
    const f = state.found[+r.querySelector('input[type=checkbox]').dataset.i];
    try {
      const body = { name: r.querySelector('.fp-name').value.trim() || f.name, key: r.querySelector('.fp-key').value.trim(), description: f.readme };
      // Two projects that start alike get the same guessed key (AIG-244): if it's taken, the board picks a free one.
      const p = await api('POST', '/api/projects', body).catch(e => /already used/.test(e.message) ? api('POST', '/api/projects', { ...body, key: '' }) : Promise.reject(e));
      if ($('fp-connect').checked) await api('POST', `/api/projects/${p.slug}/connect`, { path: f.path });
      else await api('PATCH', '/api/projects/' + p.slug, { path: f.path });
      done.push('✅ ' + p.name);
    } catch (e) { done.push('⚠️ ' + f.name + ': ' + e.message); }
  }
  $('fp-done').innerHTML = `<ul>${done.map(d => `<li>${esc(d)}</li>`).join('')}</ul><p class="muted">${esc(t('dlg.find.after'))}</p>`;
  $('fp-acts').innerHTML = `<button class="primary" onclick="closeDialog(); rerender()">${esc(t('common.done'))}</button>`;
}

/* ---------- try it as a new user (AIG-201..203) ---------- */
// A fresh, empty copy of the board on its own port, with made-up projects to find: opens in a new window.
async function startTrial(btn) {
  btn.disabled = true; const was = btn.textContent; btn.textContent = t('trial.busy'); $('trial-err').textContent = '';
  try { const r = await api('POST', '/api/trial'); window.open(r.url, 'aigile-trial'); }
  catch (e) { $('trial-err').textContent = e.message; }
  btn.disabled = false; btn.textContent = was;
}

/* ---------- setup page (AIG-91) ---------- */
// ---- setup: your name and where the agent lives on this computer, saved to aigile.local.json ----
function renderSetup() {
  const s = state.setup;
  return `<div class="setup"><h2>${esc(t('setup.h'))}</h2>
    <p class="muted">${esc(s.needed ? t('setup.welcome') : t('setup.intro'))}</p>
    <label class="f"><span>${esc(t('lang.title'))}</span>${langPickHtml('setup-lang')}<small class="muted">${esc(t('setup.lang.help'))}</small></label>
    <label class="f chk"><span><input type="checkbox" id="enSwitch" ${ls('aigile.enSwitch') === '1' ? 'checked' : ''} onchange="setEnSwitch(this.checked)"> ${esc(t('lang.en.switch'))}</span><small class="muted">${esc(t('lang.en.help'))}</small></label>
    <label class="f chk"><span><input type="checkbox" id="explainWords" ${glossOn() ? 'checked' : ''} onchange="setExplain(this.checked)"> ${esc(t('gloss.switch'))}</span><small class="muted">${esc(t('gloss.switch.help'))} <a href="#/glossary">${esc(t('gloss.open'))}</a></small></label>
    <label class="f"><span>${esc(t('setup.theme'))}</span>${themePickHtml()}<small class="muted">${esc(t('setup.theme.help'))}</small></label>
    <div class="f lead-prefs" id="leadPrefs">${leadPrefsHtml()}</div>
    <div class="f"><span>${esc(t('trial.h'))}</span><div><button type="button" id="trialBtn" onclick="startTrial(this)">${esc(t('trial.btn'))}</button></div><small class="muted">${esc(t('trial.help'))}</small><div class="err" id="trial-err"></div></div>
    <div class="f"><span>${esc(t('logo.app'))}</span>${logoEditor('app-logo', s.logo)}</div>
    <form id="setupForm" onsubmit="return saveSetupPage(event)">
      ${s.fields.map(f => `<label class="f"><span>${esc(tk('setup.f.' + f.key, f.label))}</span><input type="text" data-key="${esc(f.key)}" value="${esc(f.value)}"><small class="muted">${esc(tk('setup.f.' + f.key + '.help', f.help))}</small></label>`).join('')}
      <div class="err" id="setup-err"></div><div id="setup-done" class="muted"></div>
      <div class="actions"><button class="primary" type="submit">${esc(t('common.save'))}</button></div></form></div>`;
}
async function saveSetupPage(e) {
  e.preventDefault();
  const body = Object.fromEntries([...document.querySelectorAll('#setupForm input[data-key]')].map(i => [i.dataset.key, i.value]));
  const named = (state.setup.fields.find(f => f.key === 'owner') || {}).value;
  try {
    state.setup = await api('POST', '/api/setup', body);
    $('setup-err').textContent = '';
    // What's next (AIG-254): a way on to the projects, and a warning if the agent program isn't there.
    $('setup-done').innerHTML = esc(state.setup.needed ? t('setup.saved.more') : t('setup.saved')) + (state.setup.needed ? '' : ` <a href="#/">${esc(t('setup.next'))}</a>`)
      + (state.setup.agentProblem ? `<div class="err">${esc(t('setup.agent.problem', { msg: state.setup.agentProblem }))}</div>` : '');
    if (!named && body.owner) leadQuiz();   // first run: the name is in, so offer "What kind of lead?" once (AIG-235)
  } catch (err) { setErr('setup-err', err); }
  return false;
}

/* ---------- what's happening and ask the team (AIG-132) ---------- */
// ---- what's happening: a summary straight from the board (no agent needed, so it costs nothing) ----
function happeningDialog() {
  const p = state.project, open = p.cards.filter(c => c.status !== 'done');
  const list = (cs, empty) => cs.length ? `<ul>${cs.map(c => `<li><a href="#/p/${p.slug}/${c.id}" onclick="closeDialog()">${esc(c.id)}</a> ${esc(c.title)}${c.assignee ? ` <span class="muted">@${esc(c.assignee)}</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;
  const team = (p.team || []).filter(m => !/retired/i.test(m.status || ''));
  openDialog(`<h2>${esc(t('happening.h', { name: p.name }))}</h2>
    <div class="last">${presenceHtml(p, false)}</div>
    <h3>${esc(t('happening.doing'))}</h3>${list(open.filter(c => c.status === 'doing'), esc(t('happening.doing.none')))}
    <h3>${esc(t('happening.blocked'))}</h3>${list(open.filter(c => c.blocked), esc(t('happening.blocked.none')))}
    <h3>${esc(t('happening.waiting'))}</h3>${list(open.filter(forYou), esc(t('happening.waiting.none')))}
    <h3>${esc(t('happening.team'))}</h3>${team.length ? `<ul>${team.map(m => `<li><b>${esc(m.name)}</b> ${esc(m.status || '')} <span class="muted">${esc(m.task || '')}</span></li>`).join('')}</ul>` : `<p class="muted">${esc(t('board.team.none'))}</p>`}
    <h3>${esc(t('happening.latest'))}</h3>${(p.log || []).length ? `<ul>${p.log.slice(-5).reverse().map(l => `<li><b>${esc(l.author)}</b>: ${esc(l.text)} <span class="muted">${ago(l.at)}</span></li>`).join('')}</ul>` : `<p class="muted">${esc(t('board.log.none'))}</p>`}
    <div class="actions"><button class="primary" onclick="askTeamDialog()">${esc(t('board.ask'))}</button><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
}
// ---- ask the team: a quick question card; it wakes the team and their answer comes back to Messages ----
function askTeamDialog() {
  Attach.clear('ask:' + slug());
  openDialog(`<h2>${esc(t('board.ask'))}</h2>
    <form onsubmit="return sendAskTeam(event)"><label class="f"><span>${esc(t('ask.q'))}</span><textarea id="ask-text" data-draft="ask/${esc(slug())}" rows="4" placeholder="${esc(t('ask.ph'))}"></textarea></label>
    <div class="err" id="ask-err"></div>
    <div class="actions"><button class="primary" type="submit">${esc(t('dms.send'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('ask:' + slug())}</div></form>`);
  $('ask-text').focus();
}
async function sendAskTeam(e) {
  e.preventDefault();
  const text = $('ask-text').value.trim();
  if (!text) { setErr('ask-err', t('ask.err')); return false; }
  try {
    const attachments = await Attach.upload('ask:' + slug(), slug());
    const title = '💬 ' + text.split('\n')[0].slice(0, 80);
    await api('POST', `/api/projects/${slug()}/cards`, { title, description: text, type: 'task', status: 'team', createdBy: me(), quick: true, attachments });
    Attach.clear('ask:' + slug()); clearDraft('ask/' + slug());
    closeDialog(); await rerender();
  } catch (err) { setErr('ask-err', err); }
  return false;
}

/* ---------- board columns (AIG-116) ---------- */
// ---- columns: rename, reorder, hide and colour this board's columns (display only: statuses never change) ----
const KEY_COLS = { verify: 'cols.key.verify', team: 'cols.key.team' };
function columnsDialog() {
  state.colDraft = colsOf(state.project).map(c => ({ ...c }));
  openDialog(`<h2>${esc(t('board.columns'))}</h2><div id="colRows"></div><div class="err" id="col-err"></div>` +
    `<div class="actions"><button class="primary" onclick="saveColumns()">${esc(t('common.save'))}</button><button onclick="saveColumns(true)" title="${esc(t('cols.all.title'))}">${esc(t('cols.all'))}</button>` +
    `<button onclick="state.colDraft = colsOf({}); paintColRows()" title="${esc(t('cols.reset.title'))}">${esc(t('common.reset'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`, 'wide');
  paintColRows();
}
function paintColRows() {
  const d = state.colDraft;
  $('colRows').innerHTML = `<p class="muted">${esc(t('cols.intro'))}</p>` + d.map((c, i) => `<div class="colrow">
    <span class="arrows"><button type="button" onclick="moveCol(${i}, -1)" ${i ? '' : 'disabled'} title="${esc(t('cols.left'))}">↑</button><button type="button" onclick="moveCol(${i}, 1)" ${i < d.length - 1 ? '' : 'disabled'} title="${esc(t('cols.right'))}">↓</button></span>
    <input type="text" class="emoji" value="${esc(c.emoji)}" maxlength="8" placeholder="🙂" oninput="state.colDraft[${i}].emoji = this.value" aria-label="${esc(t('cols.emoji'))}">
    <input type="text" value="${esc(c.name)}" maxlength="40" oninput="state.colDraft[${i}].name = this.value" aria-label="${esc(t('dlg.find.name'))}">
    <input type="color" value="${esc(c.color || '#888888')}" oninput="state.colDraft[${i}].color = this.value" aria-label="${esc(t('cols.colour'))}">
    <input type="number" class="wip" min="0" max="999" step="1" value="${c.wip || ''}" placeholder="${esc(t('cols.limit.ph'))}" title="${esc(t('cols.limit.title'))}" oninput="state.colDraft[${i}].wip = this.value" aria-label="${esc(t('cols.limit.label'))}">
    ${c.key === 'verify' ? '<span class="steps"></span>' : `<input type="text" class="steps" value="${esc(c.steps.join(', '))}" placeholder="${esc(t('cols.steps.ph'))}" title="${esc(t('cols.steps.title'))}" oninput="state.colDraft[${i}].steps = this.value.split(',').map(x => x.trim()).filter(Boolean)" aria-label="${esc(t('cols.steps.label'))}">`}
    <label class="chk"><input type="checkbox" ${c.hidden ? 'checked' : ''} onchange="hideCol(${i}, this)"> ${esc(t('cols.hide'))}</label>
    <span class="muted">${esc(COLS[c.key])}</span></div>`).join('');
}
function moveCol(i, by) { const d = state.colDraft, [c] = d.splice(i, 1); d.splice(i + by, 0, c); paintColRows(); }
function hideCol(i, box) {
  const c = state.colDraft[i];
  if (box.checked && KEY_COLS[c.key] && !confirm(t('cols.hide.confirm', { name: c.name, what: t(KEY_COLS[c.key]) }))) { box.checked = false; return; }
  c.hidden = box.checked;
}
async function saveColumns(all) {
  const columns = state.colDraft.map(c => ({ status: c.key, name: c.name, emoji: c.emoji, color: c.color && c.color !== '#888888' ? c.color : '', hidden: c.hidden, wip: c.wip, steps: c.steps }));
  try {
    const slugs = all ? (await api('GET', '/api/projects?all=1')).map(x => x.slug) : [slug()];
    if (all && !confirm(t('cols.all.confirm', { n: slugs.length }))) return;
    for (const s of slugs) await api('PATCH', '/api/projects/' + s, { columns });
    closeDialog(); await rerender();
  } catch (e) { setErr('col-err', e); }
}

/* ---------- card view (AIG-119) ---------- */
// ---- cards: compact or roomy, and which details show on this board's cards ----
const CARD_DETAILS = ['assignee', 'type', 'priority', 'sprint', 'comments', 'age'];
// Two size tiles, the details as toggles in a grid, and a sample card beside them that changes as you click (AIG-184).
function cardViewDialog() {
  const v = cardViewOf(state.project);
  const tile = d => `<label class="cv-size ${v.density === d ? 'on' : ''}"><input type="radio" name="cv-density" value="${d}" ${v.density === d ? 'checked' : ''}>
      <span class="cv-pic ${d}"><i></i><i></i><i></i></span><b>${esc(t('cv.' + d))}</b><small class="muted">${esc(t('cv.' + d + '.help'))}</small></label>`;
  openDialog(`<div class="cv-dlg" onchange="previewCardView()"><h2>${esc(t('board.cards'))}</h2><p class="muted">${esc(t('cv.intro'))}</p>
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
// id 'app-logo' edits the app logo (Setup); any other id edits this project's picture (Look dialog).
const logoUrl = id => id === 'app-logo' ? '/api/app-logo' : '/api/projects/' + slug() + '/logo';
function logoEditor(id, url) {
  return `<div id="${id}"><div class="logo-edit">${url ? `<img class="${id === 'app-logo' ? 'brand-logo' : 'pic'}" src="${esc(url)}" alt="">` : ''}
    <input type="file" id="${id}-file" accept=".png,.jpg,.jpeg,.svg,.ico,.webp" aria-label="${esc(t('logo.pick'))}" onchange="logoUpload('${id}')">
    ${url ? `<button type="button" onclick="logoRemove('${id}')">${esc(t('logo.remove'))}</button>` : ''}</div>
    <div class="logo-edit"><input type="text" id="${id}-path" placeholder="${esc(t('logo.path.ph'))}" aria-label="${esc(t('logo.path'))}"><button type="button" onclick="logoUsePath('${id}')">${esc(t('logo.use'))}</button></div>
    <small class="muted">${esc(t('logo.help'))}</small><div class="err" id="${id}-err"></div></div>`;
}
async function logoSend(id, method, body) {
  try {
    const r = await api(method, logoUrl(id), body);
    if (id === 'app-logo') { state.setup = r; applyAppLogo(r.logo); }
    else state.project = { ...state.project, logo: r.logo };
    $(id).outerHTML = logoEditor(id, r.logo);
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

/* ---------- project look (AIG-86) ---------- */
// ---- look: the colour and emoji that mark this project in the inbox, tabs and home page ----
function lookDialog() {
  const p = state.project;
  openDialog(`<h2>${esc(t('board.look'))}</h2>
    <p class="muted">${esc(t('look.intro', { name: p.name }))}</p>
    <div class="row"><label class="f"><span>${esc(t('cols.emoji'))}</span><input type="text" id="look-emoji" value="${esc(p.emoji)}" maxlength="8"></label>
    <label class="f"><span>${esc(t('cols.colour'))}</span><input type="color" id="look-color" value="${esc(p.color)}"></label></div>
    <div class="f"><span>${esc(t('logo.title'))}</span>${logoEditor('look-logo', p.logo)}</div>
    <label class="chk"><input type="checkbox" id="look-chatty" ${p.chatty ? 'checked' : ''}> ${esc(t('look.chatty'))} <span class="muted">${esc(t('look.chatty.cost'))}</span></label>
    <label class="chk"><input type="checkbox" id="look-verbose" ${p.verbose ? 'checked' : ''}> ${esc(t('look.verbose'))}</label>
    <div class="err" id="look-err"></div>
    <div class="actions"><button class="primary" onclick="saveLook()">${esc(t('common.save'))}</button><button onclick="saveLook(true)" title="${esc(t('look.auto.title'))}">${esc(t('look.auto'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
async function saveLook(auto) {
  try {
    await api('PATCH', '/api/projects/' + slug(), auto ? { color: '', emoji: '' } : { color: $('look-color').value, emoji: $('look-emoji').value, chatty: $('look-chatty').checked, verbose: $('look-verbose').checked });
    closeDialog(); await rerender();
  } catch (e) { setErr('look-err', e); }
}

/* ---------- team permissions ---------- */
// ---- permissions: ticks for the common rule sets, plus the full lists as text (one rule per line) (AIG-74) ----
const PERM_LISTS = [['allow', 'perm.allow'], ['ask', 'perm.ask'], ['deny', 'perm.deny']];
async function permsDialog() {
  let r;
  try { r = await api('GET', `/api/projects/${slug()}/permissions`); } catch (e) { alert(e.message); return; }
  state.permPresets = r.presets;
  openDialog(`<h2>${esc(t('board.perms'))}</h2>
    <p class="muted">${t('perm.intro.html', { file: esc(r.file) })}</p>
    <div id="perm-ticks">${Object.entries(r.presets).map(([k, v]) => `<label class="chk"><input type="checkbox" data-k="${k}" onchange="permTick(this)"> ${esc(tk('perm.p.' + k, v.label))}</label>`).join('')}</div>
    ${PERM_LISTS.map(([l, label]) => `<label class="f"><span>${esc(t('perm.rule', { label: t(label) }))}</span><textarea id="perm-${l}" rows="4" oninput="permSync()">${esc(r[l].join('\n'))}</textarea></label>`).join('')}
    <div class="err" id="perm-err"></div><div id="perm-done" class="muted"></div>
    <div class="actions"><button class="primary" onclick="savePerms()">${esc(t('common.save'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  permSync();
}
const permLines = l => $('perm-' + l).value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
// A tick is on when every rule it stands for is in its list.
function permSync() {
  for (const box of document.querySelectorAll('#perm-ticks input'))
    box.checked = Object.entries(state.permPresets[box.dataset.k].rules).every(([l, rules]) => rules.every(x => permLines(l).includes(x)));
}
function permTick(box) {
  for (const [l, rules] of Object.entries(state.permPresets[box.dataset.k].rules)) {
    const cur = permLines(l).filter(x => !rules.includes(x));
    $('perm-' + l).value = (box.checked ? [...cur, ...rules] : cur).join('\n');
  }
  permSync();
}
async function savePerms() {
  try {
    await api('PUT', `/api/projects/${slug()}/permissions`, Object.fromEntries(PERM_LISTS.map(([l]) => [l, permLines(l)])));
    $('perm-err').textContent = '';
    $('perm-done').textContent = t('perm.saved');
  } catch (e) { setErr('perm-err', e); }
}

/* ---------- docs: read a project's .md files ---------- */
// The project's .md files, fetched once per project, so file names in cards can open them.
async function loadDocs(s) {
  if (state.docsFor === s) return;
  state.docsFor = s;
  try { state.docs = await api('GET', `/api/projects/${s}/docs`); } catch { state.docs = []; }
}
// ---- docs: read a project's .md files in the board -----------------------------
async function openDocs() {
  try {
    state.docs = await api('GET', `/api/projects/${slug()}/docs`);
    openDialog(`<h2>${esc(t('board.docs'))}</h2>${state.docs.length ? `<div class="doclist">${state.docs.map((n, i) => `<button onclick="showDoc(${i})">${esc(n)}</button>`).join('')}</div>`
      : `<p class="muted">${state.project.path ? esc(t('docs.none.in', { path: state.project.path })) : esc(t('docs.none.nopath'))}</p>`}
      <div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  } catch (e) { alert(e.message); }
}
// Open any .md file in the project folder (from a link in card text); title is its relative name.
async function showDocPath(p, s) {
  try {
    const d = await api('GET', `/api/projects/${s || slug()}/file?path=${encodeURIComponent(p)}`);
    openDialog(`<div class="actions" style="margin-top:0"><b class="doctitle">${esc(d.name)}</b><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>
      <div class="md">${md(d.text)}</div>`, 'wide');
  } catch (e) { alert(e.message); }
}
async function showDoc(i) {
  try {
    const d = await api('GET', `/api/projects/${slug()}/docs/${encodeURIComponent(state.docs[i])}`);
    openDialog(`<div class="actions" style="margin-top:0"><button onclick="openDocs()">${esc(t('docs.back'))}</button><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>
      <div class="md">${md(d.text)}</div>`, 'wide');
  } catch (e) { alert(e.message); }
}
