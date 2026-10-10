/* ---------- card fields (shared by the edit panel and the New card dialog) ---------- */
const opts = (list, cur, labels) => list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(labels ? labels[v] : v)}</option>`).join('');

function cardFields(c, o = {}) {
  return `<label class="f"><span>${esc(t('card.f.title'))}</span><input type="text" id="f-title" value="${esc(c.title)}" placeholder="${esc(o.titlePh || '')}" maxlength="200"></label>
    <label class="f"><span>${esc(o.descLabel || t('card.f.description'))}</span><textarea id="f-description" rows="4" placeholder="${esc(o.descPh || '')}">${esc(c.description)}</textarea></label>
    ${o.testSteps ? `<label class="f"><span>${esc(t('card.f.teststeps'))}</span><textarea id="f-testSteps" rows="4">${esc(c.testSteps)}</textarea></label>` : ''}
    <div class="row">
      <label class="f"><span>${esc(t('card.f.type'))}</span><select id="f-type">${opts(TYPES, c.type, Object.fromEntries(TYPES.map(k => [k, t('type.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.priority'))}</span><select id="f-priority">${opts(PRIORITIES, c.priority, Object.fromEntries(PRIORITIES.map(k => [k, t('priority.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.status'))}</span><select id="f-status">${opts(Object.keys(COLS), c.status, Object.fromEntries(Object.keys(COLS).map(k => [k, colLabel(state.project, k)])))}</select></label>
    </div>
    <div class="row">
      <label class="f"><span>${esc(t('card.f.assignee'))}</span>${assigneeSelect(c.assignee || '')}</label>
      <label class="f"><span>${esc(t('card.f.sprint'))}</span><input type="text" id="f-sprint" value="${esc(c.sprint)}"></label>
    </div>
    ${o.flags ? `<div><label class="chk"><input type="checkbox" id="f-blocked" ${c.blocked ? 'checked' : ''}> ${esc(t('card.f.blocked'))}</label>
      <label class="chk"><input type="checkbox" id="f-needsYou" ${c.needsYou ? 'checked' : ''}> ${esc(t('card.f.needsyou'))}</label></div>` : ''}`;
}
// Who a card goes to: a role (the lead launches that kind of agent; the model is shown so the cost is
// visible), a named team member, or Rich himself (a task for him). Agents swap a role for their name on start.
const ROLES = [
  ['Lead (Opus)', '🧠', 'role.lead'],
  ['Reviewer (Opus)', '🔍', 'role.reviewer'],
  ['Frontend (Sonnet)', '🎨', 'role.frontend'],
  ['Backend (Sonnet)', '⚙️', 'role.backend'],
  ['QA (Haiku)', '🧪', 'role.qa'],
  ['Quick fix (Haiku)', '🔧', 'role.quickfix'],
  ['Docs (Haiku)', '📄', 'role.docs'],
];
function assigneeSelect(cur) {
  const team = (state.project?.team || []).filter(m => !/retired/i.test(m.status || '') && m.name !== me()).map(m => m.name);
  const known = new Set(['', me(), ...ROLES.map(r => r[0]), ...team]);
  const o = (v, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return `<select id="f-assignee" onchange="onAssignee(this)">
    ${o('', t('assignee.nobody'))}${cur && !known.has(cur) ? o(cur, '👤 ' + cur) : ''}
    <optgroup label="${esc(t('assignee.roles'))}">${ROLES.map(([v, i, d]) => o(v, `${i} ${v}: ${t(d)}`)).join('')}</optgroup>
    ${team.length ? `<optgroup label="${esc(t('assignee.members'))}">${team.map(n => o(n, '👤 ' + n)).join('')}</optgroup>` : ''}
    <optgroup label="${esc(t('assignee.you'))}">${o(me(), '🙋 ' + me() + t('assignee.you.task'))}</optgroup>
    <option value="__other">${esc(t('assignee.other'))}</option></select>`;
}
function onAssignee(sel) {
  if (sel.value !== '__other') return;
  const v = (prompt(t('assignee.prompt')) || '').trim();
  if (!v) { sel.value = ''; return; }
  sel.add(new Option('👤 ' + v, v, true, true), sel.options[1]);
}

function readFields(flags, testSteps) {
  const o = { title: $('f-title').value.trim(), description: $('f-description').value, type: $('f-type').value, priority: $('f-priority').value,
    status: $('f-status').value, assignee: $('f-assignee').value.trim(), sprint: $('f-sprint').value.trim() };
  if (testSteps) o.testSteps = $('f-testSteps').value;
  if (flags) { o.blocked = $('f-blocked').checked; o.needsYou = $('f-needsYou').checked; }
  return o;
}

/* ---------- card detail panel ---------- */
function renderCard(p, c) {
  const pop = state.route.pop, close = pop ? 'window.close()' : `location.hash='#/p/${p.slug}'`;
  // ⧉ Pop out (AIG-122): the card in its own small window, to follow steps on one screen and work on another.
  const popBtn = pop ? '' : `<button onclick="popOutCard('${p.slug}', '${c.id}')" title="${esc(t('card.popout.title'))}">${esc(t('card.popout'))}</button>`;
  const head = `<div class="actions" style="margin-top:0"><button onclick="${close}">${esc(t('card.close'))}</button>${popBtn}<span style="flex:1"></span>
      ${state.editing ? '' : `<button onclick="editCard()">${esc(t('card.edit'))}</button> <button class="danger" onclick="deleteCard()">${esc(t('card.delete'))}</button>`}</div>`;
  if (state.editing) {
    return `<div class="overlay"><div class="panel">${head}
      <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(t('card.editing'))}</div>
      <form onsubmit="return saveCard(event)" style="margin-top:8px">${cardFields(c, { testSteps: true, flags: true })}
        <div class="err" id="f-err"></div>
        <div class="actions"><button class="primary" type="submit">${esc(t('common.save'))}</button><button type="button" onclick="cancelEdit()">${esc(t('common.cancel'))}</button>
        <span style="flex:1"></span><button type="button" class="danger" onclick="deleteCard()">${esc(t('card.delete'))}</button></div></form>
    </div></div>`;
  }
  const verdict = c.status === 'verify' ? `<div class="verdict"><h3>${esc(t('verdict.h'))}</h3>
      <div class="muted">${esc(t('verdict.waiting'))}${c.testSteps ? esc(t('verdict.steps')) : ''}.</div>
      <label class="f" style="margin-top:8px"><span>${esc(t('verdict.comment'))}</span><textarea id="v-text" data-draft="${esc(p.slug + '/' + c.id)}/verdict" rows="3" placeholder="${esc(t('verdict.placeholder'))}"></textarea></label>
      <div class="err" id="v-err"></div>
      ${c.openUrl ? `<div class="actions" style="margin-top:0"><button class="primary" onclick="openIt('${p.slug}', '${c.id}', this)" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button><span class="muted">${esc(c.openUrl)}</span></div>` : ''}
      <div class="actions"><button class="good" onclick="verdict(true)">${esc(t('card.accept'))}</button><button class="warn" onclick="verdict(false)">${esc(t('card.sendback'))}</button><button onclick="waitAndSee()" title="${esc(t('card.wait.title'))}">${esc(t('card.wait'))}</button>${Attach.boxHtml(p.slug + '/' + c.id + '#verdict')}</div></div>` : '';
  // Tabs: Reply (latest message on top, reply box right under it, older ones below), Details, Test.
  const msg = (m, latest) => `<div class="comment${latest ? ' latest' : ''}">${latest ? '<span class="tag-latest">' + esc(t('card.latest')) + '</span>' : ''}<span class="who">${esc(m.author)}</span><span class="when">${ago(m.at)}</span>${isOwner(m.author) ? (p.teamSeenAt && m.at <= p.teamSeenAt ? '<span class="seen">' + esc(t('card.seen')) + '</span>' : '<span class="seen">' + esc(t('card.notseen')) + '</span>') : ''}<div class="body">${linkify(m.text, p)}</div>${Attach.shown(m, p.slug)}</div>`;
  const newest = [...c.comments].reverse();
  const hasTest = c.status === 'verify' || c.testSteps;
  // The team's notes since your last word, shown on the Test tab next to Accept, so you never go looking (AIG-152).
  const lastMine = c.comments.map(m => isOwner(m.author)).lastIndexOf(true);
  const notes = c.comments.slice(lastMine + 1).filter(m => !isOwner(m.author) && !/^Ready for you to test\./.test(m.text)).slice(-3);
  if (state.tabFor !== c.id) { state.tabFor = c.id; state.cardTab = c.status === 'verify' ? 'test' : c.comments.length ? 'reply' : 'details'; }
  const tab = state.cardTab === 'test' && !hasTest ? 'reply' : state.cardTab;
  const tabBtn = (k, label) => `<button class="ctab ${tab === k ? 'on' : ''}" data-ctab="${k}" onclick="cardTab('${k}')">${label}</button>`;
  return `<div class="overlay" onclick="if(event.target===this) ${close}"><div class="panel">${head}
    <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(colLabel(p, c.status))}${c.status === 'team' && c.prevStatus ? ' ' + esc(t('card.was', { col: colLabel(p, c.prevStatus) })) : ''}${c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <h2>${esc(c.title)}</h2>
    <div class="meta">${metaHtml(c)}</div>
    <div class="ctabs">${tabBtn('reply', esc(t('card.tab.reply')) + (c.comments.length ? ` <span class="n">${c.comments.length}</span>` : ''))}${tabBtn('details', esc(t('card.tab.details')))}${hasTest ? tabBtn('test', esc(t('card.tab.test')) + (c.status === 'verify' ? ` <span class="n hot">${esc(t('card.tab.yourcall'))}</span>` : '')) : ''}</div>
    <div class="cpane" data-pane="reply" ${tab === 'reply' ? '' : 'hidden'}>
      ${newest.length ? msg(newest[0], true) : `<p class="muted">${esc(t('card.nomsgs'))}</p>`}
      <div class="reply"><textarea id="r-text" data-draft="${esc(p.slug + '/' + c.id)}/reply" rows="3" placeholder="${esc(t('card.reply.ph', { name: me() }))}" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendReply()}"></textarea>
        <div class="err" id="r-err"></div>
        <div class="actions">${c.needsYou ? `<button class="good" onclick="sendReply('GO')" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>` : ''}<button class="primary" onclick="sendReply()">${esc(t('card.sendreply'))}</button>${Attach.boxHtml(p.slug + '/' + c.id)}</div></div>
      ${newest.length > 1 ? `<h3 class="muted" style="font-size:13px;margin-top:18px">${esc(t('card.earlier'))}</h3>${newest.slice(1).map(m => msg(m, false)).join('')}` : ''}
    </div>
    <div class="cpane" data-pane="details" ${tab === 'details' ? '' : 'hidden'}>
      ${c.description ? `<div class="desc">${linkify(c.description, p)}</div>` : `<p class="muted">${esc(t('card.nodesc'))}</p>`}${Attach.shown(c, p.slug)}
    </div>
    ${hasTest ? `<div class="cpane" data-pane="test" ${tab === 'test' ? '' : 'hidden'}>${verdict}
      ${notes.length ? `<h3>${esc(t('card.fromteam'))}</h3>${notes.map(m => msg(m, false)).join('')}` : ''}
      ${c.testSteps ? `<h3>${esc(t('card.howtotest'))}</h3><div class="desc">${linkify(c.testSteps, p)}</div>` : ''}</div>` : ''}
  </div></div>`;
}
// Switch card tab without re-rendering, so anything typed in another tab is kept.
function cardTab(k) {
  state.cardTab = k;
  document.querySelectorAll('#modal .ctab').forEach(b => b.classList.toggle('on', b.dataset.ctab === k));
  document.querySelectorAll('#modal .cpane').forEach(d => { d.hidden = d.dataset.pane !== k; });
}

/* ---------- card actions: edit, delete, reply, verdict ---------- */
function editCard() { state.editing = true; render(); const ti = $('f-title'); if (ti) ti.focus(); }
function cancelEdit() { state.editing = false; rerender(); }
async function saveCard(e) {
  e.preventDefault();
  const c = curCard(), now = readFields(true, true), body = {};
  if (!now.title) { setErr('f-err', t('card.err.title')); return false; }
  for (const k in now) if (now[k] !== c[k]) body[k] = now[k];
  try {
    if (Object.keys(body).length) await api('PATCH', `/api/projects/${slug()}/cards/${c.id}`, body);
    state.editing = false;
    await rerender();
  } catch (err) { setErr('f-err', err); }
  return false;
}
async function deleteCard() {
  const c = curCard();
  if (!confirm(t('card.delete.confirm', { id: c.id, title: c.title }))) return;
  try {
    await api('DELETE', `/api/projects/${slug()}/cards/${c.id}`);
    state.editing = false;
    location.hash = '#/p/' + slug();
  } catch (err) { alert(err.message); }
}

// Once Rich has replied or given a verdict he's done with the card: close the panel, back to the board.
function popOutCard(s, id) {
  window.open(`#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 'width=560,height=780');
  location.hash = '#/p/' + s;
}
function closeCard() {
  if (state.route.pop) { window.close(); return; }
  state.editing = false;
  $('modal').innerHTML = '';
  location.hash = '#/p/' + slug();
}
// fixed: a one-tap answer (👍 Go on a question, AIG-75) instead of the typed one.
// ▶ Open it (AIG-146): ask the board to start the app if needed (confirming the command), then open the page.
async function openIt(s, id, btn) {
  const c = (state.project && state.project.cards.find(x => x.id === id)) || { startCmd: btn.dataset.cmd };
  if (c.startCmd && !confirm(t('verdict.open.confirm', { cmd: c.startCmd }))) return;
  const was = btn.textContent; btn.disabled = true; btn.textContent = t('verdict.open.starting');
  try { const r = await api('POST', `/api/projects/${s}/cards/${id}/open`); window.open(r.url, '_blank'); }
  catch (e) { alert(e.message); }
  btn.disabled = false; btn.textContent = was;
}
// After dealing with a For you card, open the next one in the queue instead of closing (AIG-141).
function nextForYou() { const q = forYouQueue(state.project).map(c => c.id), i = q.indexOf(cardId()); return i < 0 ? null : q[i + 1] || q[i - 1] || null; }
function doneWithCard(next) {
  if (next && !state.route.pop) { state.editing = false; location.hash = '#/p/' + slug() + '/' + next; } else closeCard();
}
async function sendReply(fixed) {
  const next = nextForYou(), txt = fixed || $('r-text').value.trim(), key = slug() + '/' + cardId();
  if (!txt && !Attach.has(key)) { setErr('r-err', t('card.err.empty')); return; }
  try {
    const attachments = fixed ? [] : await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/comments`, { author: me(), text: txt, attachments });
    if (!fixed) Attach.clear(key);
    clearDraft(slug() + '/' + cardId() + '/reply');
    doneWithCard(next);
  } catch (err) { setErr('r-err', err); }
}
async function waitAndSee() {
  const next = nextForYou();
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/snooze`); doneWithCard(next); } catch (err) { setErr('v-err', err); }
}
async function verdict(accept) {
  const next = nextForYou(), txt = $('v-text').value.trim(), key = slug() + '/' + cardId() + '#verdict';
  if (!accept && !txt && !Attach.has(key)) { setErr('v-err', t('verdict.err')); $('v-text').focus(); return; }
  try {
    const attachments = await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/verdict`, { accept, text: txt, attachments });
    Attach.clear(key);
    clearDraft(slug() + '/' + cardId() + '/verdict');
    doneWithCard(next);
  } catch (err) { setErr('v-err', err); }
}
