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
async function askTeamDialog() {
  let projects = [];
  try { projects = (await api('GET', '/api/projects')).filter(p => !p.archived); } catch {}
  if (!projects.length) projects = [state.project];
  Attach.clear('ask:' + slug());
  openDialog(`<h2>${esc(t('board.ask'))}</h2>
    <form onsubmit="return sendAskTeam(event)"><label class="f"><span>${esc(t('ask.q'))}</span><textarea id="ask-text" class="grow" data-draft="ask/${esc(slug())}" rows="4" oninput="growBox(this)" placeholder="${esc(t('ask.ph'))}"></textarea></label>
    <label class="f"><span>${esc(t('ask.to'))}</span><select id="ask-to">${projectOptionsHtml(projects, {}, slug())}</select></label>
    <div class="err" id="ask-err"></div>
    <div class="actions"><button class="primary" type="submit">${esc(t('dms.send'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('ask:' + slug())}</div></form>`);
  const box = $('ask-text'); box.closest('.dialog').classList.add('wide'); growBox(box); box.focus();
}
// Long thoughts (AIG-344): the box grows with the text, up to most of the screen, and can still be dragged.
// Once you drag the corner yourself (AIG-363), the box keeps your size instead of growing by itself.
function growBox(el) {
  if (!el.dataset.sizer) { el.dataset.sizer = '1'; let h0; el.addEventListener('pointerdown', () => { h0 = el.offsetHeight; }); el.addEventListener('pointerup', () => { if (h0 && el.offsetHeight !== h0) el.dataset.userSized = '1'; }); }
  if (el.dataset.userSized) return;
  el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 4, innerHeight * 0.6) + 'px';
}
async function sendAskTeam(e) {
  e.preventDefault();
  const text = $('ask-text').value.trim(), to = $('ask-to').value;
  if (!text) { setErr('ask-err', t('ask.err')); return false; }
  try {
    // The team picker (AIG-414): the question lands in the picked project, the board you are on by default.
    const attachments = await Attach.upload('ask:' + slug(), to);
    const title = '💬 ' + text.split('\n')[0].slice(0, 80);
    await api('POST', `/api/projects/${to}/cards`, { title, description: text, type: 'task', status: 'team', createdBy: me(), quick: true, attachments });
    Attach.clear('ask:' + slug()); clearDraft('ask/' + slug());
    closeDialog(); await rerender();
  } catch (err) { setErr('ask-err', err); }
  return false;
}

/* ---------- 💡 idea button (AIG-351): a quick thought from any page, to one team, every team, or "decide later" ---------- */
// One project: a 💬 card in its For the team, exactly like Ask the team. All projects: one in each. Decide later: a 💬 card in the
// project you are on (else the first one), made by "Ideas" instead of you so nobody is woken, and marked as waiting on you, so it sits in your inbox.
// The project <option>s shared by the idea picker and the New card Project picker (AIG-316).
function projectOptionsHtml(projects, leads, pick) {
  return projects.map(p => `<option value="${esc(p.slug)}" ${p.slug === pick ? 'selected' : ''}>${esc((p.emoji || '') + ' ' + p.name + (leads[p.slug] ? ' (' + leads[p.slug] + ')' : ''))}</option>`).join('');
}
async function ideaDialog() {
  let projects = [], leads = {};
  try { projects = (await api('GET', '/api/projects')).filter(p => !p.archived); } catch {}
  try { (await api('GET', '/api/chats')).forEach(c => { leads[c.slug] = c.lead; }); } catch {}
  const here = slug() || '';
  const pick = projects.some(p => p.slug === here) ? here : '_sm';   // AIG-803: off a project the idea goes to the assistant, not back to my own pile
  Attach.clear('idea');
  openDialog(`<h2>${esc(t('idea.h'))}</h2>
    <form onsubmit="return sendIdea(event)"><label class="f"><span>${esc(t('idea.q'))}</span><textarea id="idea-text" class="grow" data-draft="idea" rows="4" oninput="growBox(this)" onkeydown="if (EnterSend.is(event, 'idea')) sendIdea(event)" placeholder="${esc(t('idea.ph'))}"></textarea></label>
    <label class="f"><span>${esc(t('idea.to'))}</span><select id="idea-to">
      <option value="_sm" ${pick === '_sm' ? 'selected' : ''}>${esc(t('idea.sm'))}</option>
      ${projectOptionsHtml(projects, leads, pick)}
      <option value="_all">${esc(t('idea.all'))}</option><option value="_later">${esc(t('idea.later'))}</option></select></label>
    <div class="err" id="idea-err"></div>
    <div class="actions"><button class="primary" type="submit" title="Ctrl+Enter">${esc(t('dms.send'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('idea')}</div></form>`, 'wide');
  const box = $('idea-text'); box.closest('.dialog').classList.add('wide'); growBox(box); box.focus();
}
async function sendIdea(e) {
  e.preventDefault();
  const text = $('idea-text').value.trim(), to = $('idea-to').value;
  if (!text) { setErr('idea-err', t('idea.err')); return false; }
  try {
    // 🧭 Lead Scrum Master (AIG-388): the idea goes to its own chat; it turns it into cards in the right project(s).
    if (to === '_sm') {
      await api('POST', '/api/chats/_watchman', { text: '💡 Idea: ' + text });
      Attach.clear('idea'); clearDraft('idea'); closeDialog(); await rerender();
      return false;
    }
    const all = (await api('GET', '/api/projects')).filter(p => !p.archived).map(p => p.slug);
    const targets = to === '_all' ? all : to === '_later' ? [all.includes(slug()) ? slug() : all[0]] : [to];
    if (!targets[0]) throw new Error(t('idea.noproj'));
    const title = '💬 ' + text.split('\n')[0].slice(0, 80);
    for (const s of targets) {
      const attachments = await Attach.upload('idea', s);
      await api('POST', `/api/projects/${s}/cards`, to === '_later'
        ? { title, description: text, type: 'task', status: 'backlog', createdBy: 'Ideas', quick: true, needsYou: true, attachments }
        : { title, description: text, type: 'task', status: 'team', createdBy: me(), quick: true, attachments });
    }
    Attach.clear('idea'); clearDraft('idea');
    closeDialog(); await rerender();
  } catch (err) { setErr('idea-err', err); }
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

