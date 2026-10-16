/* ---------- dialog shell ---------- */
// AIG-1277: every dialog is a modal for screen readers (role=dialog, aria-modal, named by its heading), Tab stays inside, and closing puts focus back on what opened it.
let dlgOpener = null, dlgLast = null;   // dlgLast: the last focused control outside a dialog (a board redraw can replace the opener while a dialog loads, so closing looks for its twin)
document.addEventListener('focusin', e => { if (!e.target.closest('#dialog')) dlgLast = { el: e.target, id: e.target.id, cls: e.target.className, tag: e.target.tagName, txt: (e.target.textContent || '').trim(), title: e.target.getAttribute('title') || '' }; });
function dlgTwin(d) {
  if (!d) return null; if (document.contains(d.el)) return d.el;
  if (d.id) return document.getElementById(d.id);
  return [...document.querySelectorAll(d.tag.toLowerCase())].find(x => x.className === d.cls && (x.textContent || '').trim() === d.txt && (x.getAttribute('title') || '') === d.title) || null;
}
const DLG_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
function dlgFocusables() { return [...$('dialog').querySelectorAll(DLG_FOCUSABLE)].filter(el => el.getClientRects().length && !el.closest('[hidden]')); }
function openDialog(html, cls = '', pop = '') {   // pop: the kind that gets the shared ⧉ Pop out button (popout.js, AIG-658)
  $('dialog').innerHTML = `<div class="overlay center"><div class="dialog ${cls}">${html}</div></div>`;
  const boxTools = $('dialog').querySelector('.dialog');
  // Replace only plain dismissal controls; Cancel and workflow actions keep their meaning.
  boxTools.querySelectorAll('button[onclick="closeDialog() "],button[onclick="closeDialog()"],button[onclick="closeDialog();"]').forEach(b => {
    if ([t('common.close'), '\u2715', t('card.close')].includes(b.textContent.trim())) b.remove();
  });
  boxTools.insertAdjacentHTML('afterbegin', windowTools('closeDialog()'));
  popAddBtn(pop || popTake());
  const box = $('dialog').querySelector('.dialog');
  if (box) {
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
    const h = box.querySelector('h2, h1, h3'); if (h) { if (!h.id) h.id = 'dlg-title'; box.setAttribute('aria-labelledby', h.id); }
  }
  // a dialog replacing a dialog keeps the first opener; nothing focused now (focus moved off the last control, which is still on the page) = no opener
  const act = document.activeElement, idle = (!act || act === document.body) && dlgLast && document.contains(dlgLast.el);
  if (!dlgOpener) dlgOpener = idle ? null : dlgLast;
  const f = $('dialog').querySelector('input[type=text]'); if (f) f.focus(); else if (box && !box.contains(document.activeElement)) (dlgFocusables()[0] || box).focus();
}
function closeDialog() {
  if (sureDone) sureDone(false);   // an open askSure is a No
  $('dialog').innerHTML = '';
  { const el = dlgTwin(dlgOpener); if (el) { try { el.focus(); } catch {} } }
  dlgOpener = null;
  if (state.route.view === 'dlg') { window.close(); return; }   // a dialog in its own window: closing it closes the window
  if (state.cvPreview) { state.cvPreview = null; renderBoardOnly(); }   // an unsaved card view preview goes away (AIG-119)
}
document.addEventListener('keydown', e => {
  if (!$('dialog').firstChild) return;
  if (e.key === 'Escape') { closeDialog(); return; }
  if (e.key !== 'Tab') return;
  const els = dlgFocusables(), box = $('dialog').querySelector('.dialog');
  if (!els.length) { e.preventDefault(); if (box) box.focus(); return; }
  const first = els[0], last = els[els.length - 1], a = document.activeElement;
  if (!$('dialog').contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && (a === first || a === box)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
});
// An in-app "are you sure?" instead of the browser's plain confirm box (AIG-992): resolves true on the OK button, false on Cancel or Escape.
let sureDone = null;
function askSure(title, text, ok) {
  return new Promise(res => {
    openDialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button><button type="button" class="primary" id="sureOk">${esc(ok)}</button></div>`, 'sure');
    sureDone = v => { sureDone = null; res(v); };
    $('sureOk').onclick = () => { sureDone(true); closeDialog(); };
    $('sureOk').focus();
  });
}

/* ---------- new card ---------- */
// 🐞 On the 🧪 Live channel a raised bug can also go to the AI-gile team (AIG-561): ticked by default, never for other channels.
async function bugSendBox() {
  let ch = null; try { ch = await api('GET', '/api/channel'); } catch {}
  if (!ch || ch.channel !== 'live') return '';
  return `<label class="chk" title="${esc(t('bug.send.title'))}"><input type="checkbox" id="nc-send" checked> ${esc(t('bug.send'))}</label>`;
}
async function newCard(preset = {}) {
  let projects = [], leads = {};
  try { projects = (await api('GET', '/api/projects')).filter(p => !p.archived); } catch {}
  if (typeof TodayPage !== 'undefined') { const keep = slug(), all = projects; projects = TodayPage.only(all); if (keep && !projects.some(p => p.slug === keep)) projects = all.filter(p => p.slug === keep || projects.includes(p)); }   // AIG-1110: only today's picks (unless Show all), plus the current project
  try { (await api('GET', '/api/chats')).forEach(c => { leads[c.slug] = c.lead; }); } catch {}
  const bug = preset.type === 'bug';
  // The owner's new cards go straight to the team (AIG-51); the + on a column still picks that column.
  // AIG-1181: with no team members yet there is nobody to hand it to: the card starts in Backlog until a team exists.
  const noTeam = s => { const q = projects.find(x => x.slug === s); return !!q && !(q.crew || []).length; };
  newCard.noTeam = noTeam;
  const c = { title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: noTeam(slug()) ? 'backlog' : 'team', assignee: '', sprint: '', ...preset };
  newCard.startStatus = preset.status ? null : c.status;   // a status picked by the caller (a column's +) stays as it is
  Attach.clear('new:' + slug());
  // 🏡 Real life (AIG-394): the switch shows the life types; a Life board (🎨 Look) starts with it on.
  const lifeOn = !bug && (preset.lifeType || (state.project && state.project.lifeBoard && !preset.type));
  const lifeBox = bug ? await bugSendBox() : `<label class="chk life-switch" title="${esc(t('dlg.life.switch.title'))}"><input type="checkbox" id="nc-life" ${lifeOn ? 'checked' : ''} onchange="lifeToggle()"> ${esc(t('dlg.life.switch'))}</label>
    <div id="nc-life-box" ${lifeOn ? '' : 'hidden'}><div class="row"><label class="f"><span>${esc(t('dlg.life.type'))}</span><select id="nc-lifetype" onchange="lifeToggle()">${Object.keys(LIFE_TYPES).map(k => `<option value="${k}" ${k === (preset.lifeType || 'housework') ? 'selected' : ''}>${LIFE_TYPES[k][0]} ${esc(t('life.' + k))}</option>`).join('')}</select></label></div>
      <div class="row" id="nc-appt" hidden><label class="f"><span>${esc(t('dlg.life.when'))}</span><input type="datetime-local" id="nc-apptat"></label>
        <label class="f"><span>${esc(t('dlg.life.remind'))}</span><select id="nc-remind">${[0, 15, 30, 60, 120, 1440].map(m => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${esc(t('dlg.life.remind.' + m))}</option>`).join('')}</select></label></div>
      <small class="muted" id="nc-appt-hint" hidden>${esc(t('dlg.life.hint'))}</small>
      ${state.project && !state.project.lifeBoard ? `<small class="muted" id="nc-life-suggest">${esc(t('dlg.life.suggest'))} <a href="#" onclick="makeLifeBoard();return false">${esc(t('dlg.life.suggest.btn'))}</a></small>` : ''}</div>`;
  // AIG-942: a quick idea needs a title and a description; everything else is under More options (open when something was pre-filled).
  const moreOpen = !!(preset.type && preset.type !== 'feature' || preset.priority && preset.priority !== 'normal' || preset.risk && preset.risk !== 'normal' || preset.status && preset.status !== 'team' || preset.assignee || preset.sprint || preset.group || lifeOn || document.documentElement.classList.contains('qa-menu'));   // qa-menu: QA lays everything open
  const pickProject = projects.length > 1 || !slug() ? `<label class="f"><span>${esc(t('dlg.newcard.project'))}</span><select id="nc-project">${projectOptionsHtml(projects, leads, slug())}</select></label>` : '';
  popNext(bug ? 'bug' : 'card'); openDialog(`<h2>${esc(bug ? t('board.raisebug') : t('dlg.newcard'))}</h2>
    <form onsubmit="return createCard(event)">${cardFields(c, { more: true, moreOpen, moreTop: pickProject + lifeBox, ...(bug ? { titlePh: t('dlg.bug.titleph'), descLabel: t('dlg.bug.desclabel'), descPh: t('dlg.bug.descph') } : { titlePh: t('dlg.newcard.titleph') }) })}
      <div class="err" id="d-err"></div>
      <div class="actions"><button class="${bug ? 'bug' : 'primary'}" type="submit">${esc(bug ? t('dlg.raisebug') : t('dlg.createcard'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('new:' + slug())}</div></form>`, 'newcard');
  if (bug) { const ov = $('dialog').querySelector('.overlay'); if (ov) ov.classList.add('top'); }   // above pop-outs, card view and other windows (AIG-733)
  if (lifeOn) lifeToggle();
  const ttl = $('f-title'); if (ttl) ttl.addEventListener('paste', ev => pasteList(ev));   // AIG-1271: a pasted list offers one card per line
  const dsc = $('f-description'); if (dsc) dsc.addEventListener('keydown', ev => { if (EnterSend.is(ev, 'card')) { ev.preventDefault(); if (dsc.form) dsc.form.requestSubmit(); } });   // AIG-1110: Enter sends, Shift+Enter is a new line; createCard's busy guard keeps it to one
}
// AIG-1271: paste several lines into the title: offer one card per line (bullets and numbers stripped) or keep it as one card.
const listLines = txt => String(txt || '').split(/\r?\n/).map(l => l.replace(/^\s*(?:(?:[-*•☐☑]|\d+[.)])\s+)?(?:\[[ xX]?\]\s+)?/, '').trim()).filter(Boolean);
function pasteList(ev) {
  const txt = ev.clipboardData && ev.clipboardData.getData('text') || '', lines = listLines(txt);
  if (lines.length < 2) return;
  ev.preventDefault();
  pasteList.lines = lines;
  let box = $('nc-multi'); if (!box) { box = document.createElement('div'); box.id = 'nc-multi'; box.className = 'nc-multi'; $('f-title').closest('label').insertAdjacentElement('afterend', box); }
  box.innerHTML = `<span>${esc(t('dlg.multi.ask', { n: lines.length }))}</span> <button type="button" class="primary" id="nc-multi-go" onclick="pasteMake()">${esc(t('dlg.multi.make', { n: lines.length }))}</button> <button type="button" id="nc-multi-one" onclick="pasteOne()">${esc(t('dlg.multi.one'))}</button>`;
}
function pasteOne() {   // keep it as one card: the first line is the title, the rest goes in the description
  const l = pasteList.lines || [], d = $('f-description');
  $('f-title').value = l[0].slice(0, 200); if (d && l.length > 1) d.value = (d.value ? d.value + '\n' : '') + l.slice(1).join('\n');
  const box = $('nc-multi'); if (box) box.remove();
}
async function pasteMake() {
  const lines = pasteList.lines || []; if (!lines.length || pasteMake.busy) return;
  pasteMake.busy = true; const box = $('nc-multi'); box.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const body = readFields(false, false), sel = $('nc-project'), target = sel && sel.value || slug();
    if (target !== slug() && body.status === newCard.startStatus && newCard.noTeam) body.status = newCard.noTeam(target) ? 'backlog' : 'team';
    for (const title of lines) await api('POST', `/api/projects/${target}/cards`, { ...body, title: title.slice(0, 200), description: '', createdBy: me() });
    closeDialog(); await rerender(); note(t('dlg.multi.done', { n: lines.length }));
  } catch (err) { setErr('d-err', err); box.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  finally { pasteMake.busy = false; }
}
function lifeToggle() {
  const on = $('nc-life').checked, appt = on && $('nc-lifetype').value === 'appointment';
  $('nc-life-box').hidden = !on; $('nc-appt').hidden = !appt; $('nc-appt-hint').hidden = !appt;
}
async function makeLifeBoard() {
  try { await api('PATCH', '/api/projects/' + slug(), { lifeBoard: true }); const s = $('nc-life-suggest'); if (s) s.remove(); if (state.project) state.project.lifeBoard = true; } catch (e) { alert(e.message); }
}
// AIG-1075: show where a new card went: scroll its column into view, flash the card, say the column in a note.
function showNewCard(id) {
  const el = document.querySelector(`#app a.card[data-id="${id}"]`); if (!el) return;
  const col = el.closest('.column'), h = col && col.querySelector('h3 span');
  try { el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch { el.scrollIntoView(); }
  el.classList.add('newflash'); setTimeout(() => el.classList.remove('newflash'), 2500);
  if (h) note(t('dlg.newcard.wentto', { id, column: h.textContent.replace(/\s*[\u00b7(].*$/, '').trim() }));
}

async function createCard(e) {
  e.preventDefault();
  if (createCard.busy) return false;   // AIG-1061: one submit per raise (Enter, click, slow upload)
  const body = readFields(false, false);
  // No title is fine when there is a description: with Tidy cards on the server takes its first line (AIG-399).
  if (!body.title && !body.description.trim()) { setErr('d-err', t('dlg.err.title')); return false; }
  if ($('nc-life') && $('nc-life').checked) {   // 🏡 Real life (AIG-394): the server makes it the owner's own task and sets the appointment's timer
    body.lifeType = $('nc-lifetype').value;
    if (body.lifeType === 'appointment') {
      if (!$('nc-apptat').value) { setErr('d-err', t('dlg.life.err.when')); return false; }
      body.apptAt = new Date($('nc-apptat').value).toISOString(); body.remindMins = Number($('nc-remind').value);
    }
  }
  createCard.busy = true; const sub = e.target && e.target.querySelector && e.target.querySelector('button[type=submit]'); if (sub) sub.disabled = true;
  try {
    const sel = $('nc-project'), target = sel && sel.value || slug();
    const attachments = await Attach.upload('new:' + slug(), target);
    if (target !== slug() && body.status === newCard.startStatus && newCard.noTeam) body.status = newCard.noTeam(target) ? 'backlog' : 'team';   // AIG-1181: untouched status follows the chosen project
    const c = await api('POST', `/api/projects/${target}/cards`, { ...body, createdBy: me(), attachments });
    if ($('nc-send') && $('nc-send').checked) api('POST', '/api/bugreport', { title: body.title, text: body.description }).catch(e => alert(t('bug.send.err', { msg: e.message })));   // 🐞 to the AI-gile team (AIG-561)
    Attach.clear('new:' + slug());
    if (target !== slug()) {   // another project: say where it went, with a link (AIG-316)
      const name = sel.options[sel.selectedIndex].textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
      $('dialog').querySelector('.dialog').innerHTML = `<h2>${esc(t('dlg.newcard.added', { id: c.id, project: name }))}</h2>
        <p><a id="nc-link" href="#/p/${esc(target)}/${esc(c.id)}" onclick="closeDialog()">${esc(c.id)} ${esc(c.title)}</a></p>
        <div class="actions"><button type="button" class="primary" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`;
      await rerender();
      return false;
    }
    closeDialog();
    await rerender();
    showNewCard(c.id);
  } catch (err) { setErr('d-err', /title is required/.test(err.message) ? t('dlg.err.title') : err); if (sub) sub.disabled = false; }   // no title, and Tidy cards is off
  finally { createCard.busy = false; }
  return false;
}

/* ---------- new project, archive ---------- */
// The folder is suggested from the name (next to AI-gile) and set up for the team on create (AIG-73).
// 🪐 Space templates (AIG-440): a ready list of child projects for the New project box; the names are only a start, edit freely.
const SPACE_TPLS = ['product', 'software', 'event', 'life', 'business'];
function spaceTpl(v) { if (v) $('p-kids').value = t('space.tpl.' + v + '.kids').split('|').join('\n'); }
async function newProject(opts = {}) {
  try { state.home = state.home || (await api('GET', '/api/meta')).home; } catch {}
  // AIG-1365: up front only the name, Create and Cancel. More options holds the rest, most used first; the space fields sit in their own fold,
  // and the sample and playground buttons under "Other ways to start".
  openDialog(`<h2>${esc(t(opts.space ? 'dlg.newspace' : 'dlg.newproject'))}</h2>
    <form onsubmit="return createProject(event)">
      <label class="f"><span>${esc(t('dlg.np.name'))}</span><input type="text" id="p-name" oninput="suggestKey()" maxlength="80"></label>
      <details id="p-more"${opts.space ? ' open' : ''}><summary>${esc(t('dlg.np.more'))}</summary>
      <label class="f"><span>${esc(t('dlg.np.desc'))}</span><textarea id="p-desc" rows="2"></textarea></label>
      <label class="f"><span>${esc(t('dlg.np.tpl'))}</span><select id="p-tpl" onchange="$('p-own').style.display = this.value === 'own' ? '' : 'none'">
        <option value="kanban">${esc(t('dlg.np.tpl.kanban'))}</option><option value="scrum">${esc(t('dlg.np.tpl.scrum'))}</option><option value="own">${esc(t('dlg.np.tpl.own'))}</option></select></label>
      <label class="f" id="p-own" style="display:none"><span>${esc(t('dlg.np.tpl.own.help'))}</span><input type="text" id="p-own-names" placeholder="${esc(t('dlg.np.tpl.own.ph'))}"></label>
      ${NoAi.on ? '' : `<label class="chk"><input type="checkbox" id="p-team" checked> ${esc(t('dlg.np.team'))}</label>`}
      <label class="f"><span>${esc(t('dlg.np.folder'))}</span><input type="text" id="p-path" oninput="this.dataset.touched=1" placeholder="${esc(t('dlg.np.folder.ph'))}"></label>
      <div class="row"><label class="f"><span>${esc(t('dlg.np.key'))}</span><input type="text" id="p-key" maxlength="6" oninput="this.dataset.touched=1"></label></div>
      <details id="p-space"${opts.space ? ' open' : ''}><summary>${esc(t('dlg.np.space.more'))}</summary>
      <label class="f"><span>${esc(t('space.tpl'))}</span><select id="p-spacetpl" onchange="spaceTpl(this.value)"><option value="">${esc(t('space.tpl.none'))}</option>${SPACE_TPLS.map(v => `<option value="${v}">${esc(t('space.tpl.' + v))}</option>`).join('')}</select></label>
      <label class="f"><span>${esc(t('dlg.np.kids'))}</span><textarea id="p-kids" rows="3" placeholder="${esc(t('dlg.np.kids.ph'))}"></textarea><small class="muted">${esc(t('dlg.np.kids.help'))}</small></label>
      </details>
      ${opts.space ? '' : `<div class="f np-other"><span>${esc(t('dlg.np.other'))}</span><div class="actions"><button type="button" id="p-sample" onclick="addSample()" title="${esc(t('sample.add.title'))}" aria-label="${esc(t('sample.add.title'))}">${esc(t('sample.add'))}</button> <button type="button" id="p-play" onclick="newPlayground()">${esc(t('dlg.np.play'))}</button></div><small class="muted">${esc(t('dlg.np.play.hint'))}</small></div>`}
      </details>
      <div class="err" id="d-err"></div><div id="p-done" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="actions" id="p-acts"><button class="primary" type="submit">${esc(t('dlg.np.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`);
  if (opts.space) { $('p-spacetpl').value = SPACE_TPLS[0]; spaceTpl(SPACE_TPLS[0]); }
}
// New playground (AIG-818/819): one box with a friend's name; makes the project for them and shows the invite code to Copy.
function newPlayground() {
  openDialog(`<h2>${esc(t('play.h'))}</h2>
    <form onsubmit="return createPlayground(event)">
      <label class="f"><span>${esc(t('play.name'))}</span><input type="text" id="pg-name" maxlength="60" autofocus></label>
      <p class="muted">${esc(t('play.help'))}</p>
      <div class="err" id="d-err"></div><div id="pg-done"></div>
      <div class="actions" id="pg-acts"><button class="primary" type="submit" id="pg-go">${esc(t('play.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`);
  setTimeout(() => { const i = $('pg-name'); if (i) i.focus(); }, 0);
}
async function createPlayground(e) {
  e.preventDefault();
  const name = $('pg-name').value.trim();
  if (!name) { setErr('d-err', t('play.err.name')); return false; }
  try {
    const r = await api('POST', '/api/playgrounds', { name });
    $('d-err').textContent = '';
    $('pg-name').readOnly = true;
    $('pg-done').innerHTML = `<p>✅ ${esc(t('play.made', { name: r.name }))}</p>${r.code ? `<textarea id="pg-code" readonly rows="3" onclick="this.select()" style="width:100%">${esc(r.code)}</textarea><small class="muted">${esc(t('play.send', { name }))}</small>` : `<p class="muted">${esc(t('play.' + r.friend, { name }))}</p>`}<div id="pg-msg" class="muted"></div>`;
    $('pg-acts').innerHTML = `${r.code ? `<button type="button" class="primary" id="pg-copy">${esc(t('dmf.copy'))}</button> ` : ''}<button type="button" onclick="closeDialog(); location.hash = '#/p/${r.slug}'">${esc(t('dlg.np.open'))}</button> <button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button>`;
    if (r.code) $('pg-copy').onclick = async () => { try { await navigator.clipboard.writeText(r.code); } catch { $('pg-code').select(); document.execCommand('copy'); } $('pg-msg').textContent = t('dmf.copied'); };
  } catch (err) { setErr('d-err', err); }
  return false;
}
// Sample project (AIG-1072): one click makes it (once), one click removes it.
async function addSample() {
  try { await api('POST', '/api/sample-project'); } catch (err) { if (!/already/.test(String((err && err.message) || err))) { alert(String((err && err.message) || err)); return; } }
  closeDialog(); location.hash = '#/p/sample-project'; refresh(true);
}
async function removeSample() {
  if (!confirm(t('sample.remove.ask'))) return;
  try { await api('DELETE', '/api/sample-project'); } catch (err) { alert(String((err && err.message) || err)); return; }
  location.hash = '#/'; refresh(true);
}
function suggestKey() {
  const name = $('p-name').value, k = $('p-key'), f = $('p-path');
  if (!k.dataset.touched) k.value = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim();
  if (!f.dataset.touched && state.home) f.value = clean ? state.home.replace(/[\\/]+$/, '') + (/\//.test(state.home) ? '/' : '\\') + clean : '';   // AIG-1365: keep the folder's own slashes
}
const STATUS_ORDER = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
// Column names for a template, one per status in order ('' = keep the default name).
function boardTemplateNames(tpl, own) {
  if (tpl === 'scrum') return ['dlg.np.scrum.backlog', 'dlg.np.scrum.sprintbacklog', 'dlg.np.scrum.sprint', 'dlg.np.scrum.review'].map(k => t(k));
  if (tpl === 'own') return own.split(',').map(x => x.trim().slice(0, 40));
  return [];
}
async function createProject(e) {
  e.preventDefault();
  // AIG-1298: ticked (the default) = a Lead and a folder (the one given, else one made under the projects folder: a team cannot
  // work without one); unticked = a cards-only project: no team, and no folder unless one was typed in.
  const withTeam = !!$('p-team') && $('p-team').checked, team = withTeam || NoAi.on ? {} : { team: false, teamless: true };   // cards-only on purpose: the board does not ask for a team
  const name = $('p-name').value.trim(), folder = withTeam || NoAi.on || $('p-path').dataset.touched ? $('p-path').value.trim() : '', auto = withTeam && !folder;
  if (!name) { setErr('d-err', t('dlg.np.err.name')); return false; }
  let p;
  try {
    p = await api('POST', '/api/projects', { name, key: $('p-key').value.trim(), description: $('p-desc').value.trim(), ...team });
    // A template only pre-fills the column names (AIG-170); the statuses underneath never change.
    const names = boardTemplateNames($('p-tpl').value, $('p-own-names').value);
    if (names.some(Boolean)) await api('PATCH', '/api/projects/' + p.slug, { columns: STATUS_ORDER.map((status, i) => ({ status, name: names[i] || undefined })) });
  } catch (err) { setErr('d-err', err); return false; }
  const kids = [...new Set($('p-kids').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))].slice(0, 20);
  if (!folder && !auto && !kids.length) { closeDialog(); location.hash = '#/p/' + p.slug; return false; }
  $('p-acts').innerHTML = `<button type="button" class="primary" onclick="closeDialog(); location.hash = '#/p/${p.slug}'">${esc(t('dlg.np.open'))}</button>`;
  const done = [t('dlg.np.created')], fails = [];
  const show = () => { $('p-done').innerHTML = `<ul>${done.map(d => `<li>✅ ${esc(d)}</li>`).join('')}${fails.map(d => `<li>⚠️ ${esc(d)}</li>`).join('')}</ul>`; };
  let base = folder;   // the kids' folders go inside the space's (the made one too)
  if (folder || auto) {
    try { const r = await api('POST', `/api/projects/${p.slug}/connect`, { path: folder || true, create: true, wake: true }); done.push(...r.done); if (r.path) base = r.path; }
    catch (err) { done.shift(); fails.push(t('dlg.np.err.folder', { msg: err.message })); } // the warning already says the project exists (AIG-1181)
    show();
  }
  // 🪐 A space with child projects in one go (AIG-435): each child sits in the new project, gets its own folder inside the
  // space's folder (notes and ways of working, like any new project) and the default team roles. Only the space's own team
  // is woken: N first looks at once would burn tokens for nothing.
  for (const name of kids) {
    try {
      const k = await api('POST', '/api/projects', { name, parent: p.slug, ...team });
      if (folder || auto) await api('POST', `/api/projects/${k.slug}/connect`, { path: base ? base + (base.includes('\\') ? '\\' : '/') + name.replace(/[<>:"/\\|?*]/g, '').trim() : true, create: true });
      done.push(t('dlg.np.kid.done', { name }));
    } catch (err) { fails.push(t('dlg.np.kid.err', { name, msg: err.message })); }
    show();
  }
  $('p-acts').querySelector('button').focus();
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

