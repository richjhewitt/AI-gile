/* ---------- card fields (shared by the edit panel and the New card dialog) ---------- */
const opts = (list, cur, labels) => list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(labels ? labels[v] : v)}</option>`).join('');

function cardFields(c, o = {}) {
  return `<label class="f"><span>Title</span><input type="text" id="f-title" value="${esc(c.title)}" placeholder="${esc(o.titlePh || '')}" maxlength="200"></label>
    <label class="f"><span>${esc(o.descLabel || 'Description')}</span><textarea id="f-description" rows="4" placeholder="${esc(o.descPh || '')}">${esc(c.description)}</textarea></label>
    ${o.testSteps ? `<label class="f"><span>Test steps</span><textarea id="f-testSteps" rows="4">${esc(c.testSteps)}</textarea></label>` : ''}
    <div class="row">
      <label class="f"><span>Type</span><select id="f-type">${opts(TYPES, c.type)}</select></label>
      <label class="f"><span>Priority</span><select id="f-priority">${opts(PRIORITIES, c.priority)}</select></label>
      <label class="f"><span>Status</span><select id="f-status">${opts(Object.keys(COLS), c.status, COLS)}</select></label>
    </div>
    <div class="row">
      <label class="f"><span>Assignee</span>${assigneeSelect(c.assignee || '')}</label>
      <label class="f"><span>Sprint</span><input type="text" id="f-sprint" value="${esc(c.sprint)}"></label>
    </div>
    ${o.flags ? `<div><label class="chk"><input type="checkbox" id="f-blocked" ${c.blocked ? 'checked' : ''}> Blocked</label>
      <label class="chk"><input type="checkbox" id="f-needsYou" ${c.needsYou ? 'checked' : ''}> Needs you</label></div>` : ''}`;
}
// Who a card goes to: a role (the lead launches that kind of agent; the model is shown so the cost is
// visible), a named team member, or Rich himself (a task for him). Agents swap a role for their name on start.
const ROLES = [
  ['Lead (Opus)', '🧠', 'planning, specs, tricky decisions'],
  ['Reviewer (Opus)', '🔍', 'audits, code review, security'],
  ['Frontend (Sonnet)', '🎨', 'pages, UI, styling'],
  ['Backend (Sonnet)', '⚙️', 'servers, data, APIs'],
  ['QA (Haiku)', '🧪', 'test runs, browser checks'],
  ['Quick fix (Haiku)', '🔧', 'small, clear changes, cheapest'],
  ['Docs (Haiku)', '📄', 'READMEs, guides'],
];
function assigneeSelect(cur) {
  const team = (state.project?.team || []).filter(m => !/retired/i.test(m.status || '') && m.name !== 'Rich').map(m => m.name);
  const known = new Set(['', 'Rich', ...ROLES.map(r => r[0]), ...team]);
  const o = (v, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return `<select id="f-assignee" onchange="onAssignee(this)">
    ${o('', '— nobody yet —')}${cur && !known.has(cur) ? o(cur, '👤 ' + cur) : ''}
    <optgroup label="Roles: the lead launches this kind of agent">${ROLES.map(([v, i, t]) => o(v, `${i} ${v}: ${t}`)).join('')}</optgroup>
    ${team.length ? `<optgroup label="Team members">${team.map(n => o(n, '👤 ' + n)).join('')}</optgroup>` : ''}
    <optgroup label="You">${o('Rich', '🙋 Rich: a task for you')}</optgroup>
    <option value="__other">✏️ Someone else…</option></select>`;
}
function onAssignee(sel) {
  if (sel.value !== '__other') return;
  const v = (prompt('Assign to who?') || '').trim();
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
  const close = `location.hash='#/p/${p.slug}'`;
  const head = `<div class="actions" style="margin-top:0"><button onclick="${close}">✕ Close</button><span style="flex:1"></span>
      ${state.editing ? '' : '<button onclick="editCard()">✏️ Edit</button> <button class="danger" onclick="deleteCard()">🗑 Delete</button>'}</div>`;
  if (state.editing) {
    return `<div class="overlay"><div class="panel">${head}
      <div class="id muted" style="margin-top:12px">${esc(c.id)} · editing</div>
      <form onsubmit="return saveCard(event)" style="margin-top:8px">${cardFields(c, { testSteps: true, flags: true })}
        <div class="err" id="f-err"></div>
        <div class="actions"><button class="primary" type="submit">Save</button><button type="button" onclick="cancelEdit()">Cancel</button>
        <span style="flex:1"></span><button type="button" class="danger" onclick="deleteCard()">🗑 Delete</button></div></form>
    </div></div>`;
  }
  const verdict = c.status === 'verify' ? `<div class="verdict"><h3>🧪 Your call</h3>
      <div class="muted">Built and waiting for you to test${c.testSteps ? ' (steps below)' : ''}.</div>
      <label class="f" style="margin-top:8px"><span>Comment (required to send back)</span><textarea id="v-text" rows="3" placeholder="What did you see? What's wrong?"></textarea></label>
      <div class="err" id="v-err"></div>
      <div class="actions"><button class="good" onclick="verdict(true)">✅ Accept</button><button class="warn" onclick="verdict(false)">🔁 Send back</button><button onclick="waitAndSee()" title="Not sure yet: hide it from your inbox for an hour">⏳ Wait and see</button></div></div>` : '';
  // Tabs: Reply (latest message on top, reply box right under it, older ones below), Details, Test.
  const msg = (m, latest) => `<div class="comment${latest ? ' latest' : ''}">${latest ? '<span class="tag-latest">Latest</span>' : ''}<span class="who">${esc(m.author)}</span><span class="when">${ago(m.at)}</span>${m.author.toLowerCase() === 'rich' ? (p.teamSeenAt && m.at <= p.teamSeenAt ? '<span class="seen">✓ seen by team</span>' : '<span class="seen">⏳ not seen yet</span>') : ''}<div class="body">${linkify(m.text, p)}</div></div>`;
  const newest = [...c.comments].reverse();
  const hasTest = c.status === 'verify' || c.testSteps;
  if (state.tabFor !== c.id) { state.tabFor = c.id; state.cardTab = c.status === 'verify' ? 'test' : c.comments.length ? 'reply' : 'details'; }
  const tab = state.cardTab === 'test' && !hasTest ? 'reply' : state.cardTab;
  const tabBtn = (k, label) => `<button class="ctab ${tab === k ? 'on' : ''}" data-ctab="${k}" onclick="cardTab('${k}')">${label}</button>`;
  return `<div class="overlay" onclick="if(event.target===this) ${close}"><div class="panel">${head}
    <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(COLS[c.status])}${c.status === 'team' && c.prevStatus ? ' (was ' + esc(COLS[c.prevStatus]) + ')' : ''}${c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <h2>${esc(c.title)}</h2>
    <div class="meta">${metaHtml(c)}</div>
    <div class="ctabs">${tabBtn('reply', `💬 Reply${c.comments.length ? ` <span class="n">${c.comments.length}</span>` : ''}`)}${tabBtn('details', '📄 Details')}${hasTest ? tabBtn('test', c.status === 'verify' ? '🧪 Test <span class="n hot">your call</span>' : '🧪 Test') : ''}</div>
    <div class="cpane" data-pane="reply" ${tab === 'reply' ? '' : 'hidden'}>
      ${newest.length ? msg(newest[0], true) : '<p class="muted">No messages yet.</p>'}
      <div class="reply"><textarea id="r-text" rows="3" placeholder="Reply as Rich: moves the card to For the team… (Enter to send, Shift+Enter for a new line)" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendReply()}"></textarea>
        <div class="err" id="r-err"></div>
        <div class="actions">${c.needsYou ? `<button class="good" onclick="sendReply('GO')" title="Sends GO as your answer">👍 Go</button>` : ''}<button class="primary" onclick="sendReply()">Send reply</button></div></div>
      ${newest.length > 1 ? `<h3 class="muted" style="font-size:13px;margin-top:18px">Earlier (newest first)</h3>${newest.slice(1).map(m => msg(m, false)).join('')}` : ''}
    </div>
    <div class="cpane" data-pane="details" ${tab === 'details' ? '' : 'hidden'}>
      ${c.description ? `<div class="desc">${linkify(c.description, p)}</div>` : '<p class="muted">No description.</p>'}
    </div>
    ${hasTest ? `<div class="cpane" data-pane="test" ${tab === 'test' ? '' : 'hidden'}>${verdict}
      ${c.testSteps ? `<h3>🧪 How to test</h3><div class="desc">${linkify(c.testSteps, p)}</div>` : ''}</div>` : ''}
  </div></div>`;
}
// Switch card tab without re-rendering, so anything typed in another tab is kept.
function cardTab(k) {
  state.cardTab = k;
  document.querySelectorAll('#modal .ctab').forEach(b => b.classList.toggle('on', b.dataset.ctab === k));
  document.querySelectorAll('#modal .cpane').forEach(d => { d.hidden = d.dataset.pane !== k; });
}

/* ---------- card actions: edit, delete, reply, verdict ---------- */
function editCard() { state.editing = true; render(); const t = $('f-title'); if (t) t.focus(); }
function cancelEdit() { state.editing = false; rerender(); }
async function saveCard(e) {
  e.preventDefault();
  const c = curCard(), now = readFields(true, true), body = {};
  if (!now.title) { setErr('f-err', 'Title cannot be empty'); return false; }
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
  if (!confirm(`Delete ${c.id} "${c.title}"? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/projects/${slug()}/cards/${c.id}`);
    state.editing = false;
    location.hash = '#/p/' + slug();
  } catch (err) { alert(err.message); }
}

// Once Rich has replied or given a verdict he's done with the card: close the panel, back to the board.
function closeCard() {
  state.editing = false;
  $('modal').innerHTML = '';
  location.hash = '#/p/' + slug();
}
// fixed: a one-tap answer (👍 Go on a question, AIG-75) instead of the typed one.
async function sendReply(fixed) {
  const t = fixed || $('r-text').value.trim();
  if (!t) { setErr('r-err', 'Write something first'); return; }
  try {
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/comments`, { author: 'Rich', text: t });
    closeCard();
  } catch (err) { setErr('r-err', err); }
}
async function waitAndSee() {
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/snooze`); closeCard(); } catch (err) { setErr('v-err', err); }
}
async function verdict(accept) {
  const t = $('v-text').value.trim();
  if (!accept && !t) { setErr('v-err', 'Say what is wrong before sending it back'); $('v-text').focus(); return; }
  try {
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/verdict`, { accept, text: t });
    closeCard();
  } catch (err) { setErr('v-err', err); }
}
