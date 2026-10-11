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
    <form onsubmit="return sendAskTeam(event)"><label class="f"><span>${esc(t('ask.q'))}</span><textarea id="ask-text" class="grow" data-draft="ask/${esc(slug())}" rows="4" oninput="growBox(this)" placeholder="${esc(t('ask.ph'))}"></textarea></label>
    <div class="err" id="ask-err"></div>
    <div class="actions"><button class="primary" type="submit">${esc(t('dms.send'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('ask:' + slug())}</div></form>`);
  const box = $('ask-text'); box.closest('.dialog').classList.add('wide'); growBox(box); box.focus();
}
// Long thoughts (AIG-344): the box grows with the text, up to most of the screen, and can still be dragged.
function growBox(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 4, innerHeight * 0.6) + 'px'; }
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

