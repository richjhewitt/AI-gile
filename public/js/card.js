/* ---------- card detail panel ---------- */
// ↩ Reopen and ⋯ Move to (AIG-403): a done card goes back to the column it came from; any card can be moved to a column.
function moveUi(p, c, part) {   // part: 'reopen' (the button) or 'selects' (the Move dropdowns); both when omitted
  const cols = colsOf(p).filter(x => x.key !== c.status);
  // The other projects, for ➡️ Move to project (AIG-438): the home list if it is loaded, else fetched once.
  if (!state.projects && !state.projectList && !state.projectListAsked) { state.projectListAsked = true; api('GET', '/api/projects').then(l => { state.projectList = l; refresh(true); }).catch(() => {}); }
  const others = TodayPage.only(state.projects || state.projectList || []).filter(x => x.slug !== p.slug && !x.archived);
  const reopen = (c.status === 'done' ? `<button data-reopen onclick="moveCard('${esc(c.reopenTo || 'todo')}')" title="${esc(t('card.reopen.title'))}">${esc(t('card.reopen'))}</button> ` : '');
  if (part === 'reopen') return reopen;
  const selects = `<select id="mv-to" data-moveto onchange="moveCard(this.value)" aria-label="${esc(t('card.moveto'))}"><option value="">${esc(t('card.moveto'))}</option>${cols.map(x => `<option value="${esc(x.key)}">${esc(((x.emoji ? x.emoji + ' ' : '') + x.name).trim())}</option>`).join('')}</select>`
    + (others.length ? ` <select id="mv-proj" onchange="moveToProject(this.value)" aria-label="${esc(t('card.moveproj'))}"><option value="">${esc(t('card.moveproj'))}</option>${others.map(x => `<option value="${esc(x.slug)}">${esc(x.name)}</option>`).join('')}</select>` : '');
  return part === 'selects' ? selects : reopen + selects;
}
// ➡️ Move to another project (AIG-438): a copy lands there with a link back; this card closes with a link forward.
async function moveToProject(to) {
  if (!to) return;
  try { const r = await api('POST', `/api/projects/${slug()}/cards/${cardId()}/moveproject`, { to }); location.hash = `#/p/${r.project}/${r.id}`; } catch (e) { alert(e.message); refresh(true); }
}
async function moveCard(status) {
  if (!status) return;
  state.cardMenu = false;
  const body = { status };
  if (status === 'done' && state.project) {   // 🔥 an incident is closed with its post-mortem (AIG-614)
    const c = state.project.cards.find(x => x.id === cardId());
    if (c && c.type === 'incident' && c.status !== 'done') { body.postmortem = await postmortemAsk(); if (!body.postmortem) { refresh(true); return; } }
  }
  try { await api('PATCH', `/api/projects/${slug()}/cards/${cardId()}`, body); refresh(true); } catch (e) { alert(e.message); }
}
// 🔥 The post-mortem dialog: what happened, why, what we change. Resolves to the three answers, or null if cancelled (AIG-614).
function postmortemAsk() {
  return new Promise(res => {
    let sent = false;
    const keys = ['happened', 'why', 'change'];
    openDialog(`<h2>${esc(t('pm.title'))}</h2><p class="muted">${esc(t('pm.intro'))}</p><form id="pm-form">${keys.map(k => `<label class="f"><span>${esc(t('pm.' + k))}</span><textarea id="pm-${k}" rows="2" required></textarea></label>`).join('')}
      <div class="actions"><button class="primary" type="submit">${esc(t('pm.done'))}</button><button type="button" id="pm-cancel">${esc(t('common.cancel'))}</button></div></form>`, 'postmortem');
    $('pm-form').onsubmit = e => { e.preventDefault(); sent = true; const o = Object.fromEntries(keys.map(k => [k, $('pm-' + k).value.trim()])); closeDialog(); res(o); };
    $('pm-cancel').onclick = () => { closeDialog(); res(null); };
    const mo = new MutationObserver(() => { if (!document.getElementById('pm-form') && !sent) { mo.disconnect(); sent = true; res(null); } });
    mo.observe(document.body, { childList: true, subtree: true });
  });
}
const postmortemHtml = c => c.postmortem ? `<div class="postmortem"><h3>${esc(t('pm.heading'))}</h3>${['happened', 'why', 'change'].map(k => `<p><b>${esc(t('pm.' + k))}</b> ${esc(c.postmortem[k])}</p>`).join('')}</div>` : '';
// 🧩 A problem card (AIG-887) shows its root cause, workaround, linked incidents and change request; an incident shows its problem.
const cardLinkHtml = (p, id) => `<a href="#/p/${esc(p.slug)}/${esc(id)}">${esc(id)}</a>`;
const problemHtml = (p, c) => c.type === 'problem' ? `<div class="problem"><h3>${esc(t('prob.heading'))}</h3>
  <p><b>${esc(t('prob.cause'))}</b> ${c.rootCause ? esc(c.rootCause) : `<span class="muted">${esc(t('prob.none'))}</span>`}</p>
  <p><b>${esc(t('prob.workaround'))}</b> ${c.workaround ? esc(c.workaround) : `<span class="muted">${esc(t('prob.none'))}</span>`}</p>
  <p><b>${esc(t('prob.incidents'))}</b> ${(c.incidents || []).length ? c.incidents.map(i => cardLinkHtml(p, i)).join(', ') : `<span class="muted">${esc(t('prob.none'))}</span>`}</p>
  <p><b>${esc(t('prob.change'))}</b> ${c.changeId ? cardLinkHtml(p, c.changeId) : `<span class="muted">${esc(t('prob.none'))}</span>`}</p></div>`
  : c.problemId ? `<div class="problem"><p><b>${esc(t('prob.of'))}</b> ${cardLinkHtml(p, c.problemId)}</p></div>` : '';
// The merge gate (AIG-613): 🟢 QA green (areas, full suite) / 🔴 QA red / ⚪ no QA yet. Set with aigile qa.
function qaGateHtml(c) {
  const q = c.qa; if (!q) return `<div class="qa-gate none">${esc(t('qa.none'))}</div>`;
  const red = q.result === 'fail' || q.full === 'fail', bits = [(q.areas || []).join(', '), q.full ? t('qa.full.' + q.full) : ''].filter(Boolean).join('; ');
  return `<div class="qa-gate ${red ? 'red' : 'green'}" title="${esc([q.by, q.at && ago(q.at)].filter(Boolean).join(' · '))}">${esc(t(red ? 'qa.red' : 'qa.green'))}${bits ? ` <span class="muted">(${esc(bits)})</span>` : ''}${q.note ? ` <span class="muted">${esc(q.note)}</span>` : ''}</div>`;
}
function renderCard(p, c) {
  const pop = state.route.pop, close = pop ? 'window.close()' : `location.hash='#/p/${p.slug}'`;
  // ⧉ Pop out (AIG-122): the card in its own small window, to follow steps on one screen and work on another.
  const popBtn = pop ? '' : `<button onclick="popOutCard('${p.slug}', '${c.id}')" title="${esc(t('card.popout.title'))}">${esc(t('card.popout'))}</button>`;
  const head = `<div class="actions" style="margin-top:0"><button onclick="${close}">${esc(t('card.close'))}</button>${popBtn}${p.path ? Editor.btn(p, c) : ''}${Share.cardBtn(p, c)}${Pack.cardBtns(p, c)}${Dmme.btn()}</div>`;
  // AIG-935: title first; Close, Edit (and Reopen) stay in view, every other action sits in the one ⋯ menu (same buttons, same ids).
  const menu = `<div class="card-menu" id="card-menu" ${state.cardMenu ? '' : 'hidden'}>${popBtn}${p.path ? Editor.btn(p, c) : ''}${Share.cardBtn(p, c)}${Pack.cardBtns(p, c)}${Dmme.btn()}<button id="remind-btn" onclick="remindToggle()" title="${esc(t('remind.title'))}">${esc(t('remind.btn'))}</button>${timerUi(c)}${crucialBtn(c)}${urgentBtn(c, p.slug)}${Focus.btn(p, c)}${Term.btn(c, 'term-btn')}${moveUi(p, c, 'selects')}<button class="danger" onclick="deleteCard()">${esc(t('card.delete'))}</button></div>`;
  const topActs = `<div class="card-acts"><button onclick="${close}">${esc(t('card.close'))}</button>${moveUi(p, c, 'reopen')}<button onclick="editCard()">${esc(t('card.edit'))}</button><span class="card-menu-wrap"><button type="button" id="cm-btn" class="cm-btn" aria-haspopup="true" aria-expanded="${!!state.cardMenu}" title="${esc(t('card.menu.title'))}" aria-label="${esc(t('card.menu.title'))}" onclick="cardMenuToggle()">${esc(t('card.menu'))}</button>${menu}</span></div>`;
  if (state.editing) {
    return `<div class="overlay"><div class="panel">${head}
      <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(t('card.editing'))}</div>
      <form onsubmit="return saveCard(event)" style="margin-top:8px">${cardFields(c, { testSteps: true, flags: true })}
        <div class="err" id="f-err"></div>
        <div class="actions"><button class="primary" type="submit">${esc(t('common.save'))}</button><button type="button" onclick="cancelEdit()">${esc(t('common.cancel'))}</button>
        <span style="flex:1"></span><button type="button" class="danger" onclick="deleteCard()">${esc(t('card.delete'))}</button></div></form>
    </div></div>`;
  }
  const verdict = c.status === 'verify' && c.info ? `<div class="verdict"><h3>${esc(t('info.tag'))}</h3>
      <label class="f" style="margin-top:8px"><span>${esc(t('info.label'))}</span><textarea id="v-text" data-draft="${esc(p.slug + '/' + c.id)}/info" rows="2" placeholder="${esc(t('info.ph'))}" onkeydown="if(EnterSend.is(event,'card')){event.preventDefault();infoReply()}"></textarea></label>
      <div class="err" id="v-err"></div>
      <div class="actions"><button class="good" onclick="gotIt()">${esc(t('info.gotit'))}</button><button onclick="infoReply()" title="${esc(t('info.reply.title'))}">${esc(t('info.reply'))}</button>${Attach.boxHtml(p.slug + '/' + c.id + '#verdict')}</div></div>`
    : c.status === 'verify' ? `<div class="verdict"><h3>${esc(t('verdict.h'))}</h3>${pileLeft(p, c)}${aiEvidence(c, p.slug)}
      <div class="muted">${esc(t('verdict.waiting'))}${c.testSteps ? esc(t('verdict.steps')) : ''}.</div>
      <label class="f" style="margin-top:8px"><span>${esc(t('verdict.comment'))}</span><textarea id="v-text" data-draft="${esc(p.slug + '/' + c.id)}/verdict" rows="3" placeholder="${esc(t('verdict.placeholder'))}" onkeydown="if(EnterSend.is(event,'card')){event.preventDefault();verdict(false)}"></textarea></label>
      <div class="err" id="v-err"></div>
      ${c.openUrl ? `<div class="actions" style="margin-top:0"><button class="primary" onclick="openIt('${p.slug}', '${c.id}', this)" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button><span class="muted">${esc(c.openUrl)}</span></div>` : ''}
      <div class="actions"><button class="good" onclick="verdict(true, this)">${esc(t('card.accept'))}</button><button class="warn" onclick="verdict(false)">${esc(t('card.sendback'))}</button><button onclick="waitAndSee()" title="${esc(t('card.wait.title'))}">${esc(t('card.wait'))}</button>${Attach.boxHtml(p.slug + '/' + c.id + '#verdict')}</div></div>` : '';
  // Tabs: Reply (latest message on top, reply box right under it, older ones below), Details, Test.
  const msg = (m, latest) => `<div class="comment${latest ? ' latest' : ''}">${latest ? '<span class="tag-latest">' + esc(t('card.latest')) + '</span>' : ''}<span class="who">${face(m.author, p.team)}${esc(m.author)}</span><span class="when">${ago(m.at)}</span>${isOwner(m.author) ? (p.teamSeenAt && m.at <= p.teamSeenAt ? '<span class="seen">' + esc(t('card.seen')) + '</span>' : '<span class="seen">' + esc(t('card.notseen')) + '</span>') : ''}${m.from === 'outside' ? Pack.body(p, c, m) : `<div class="body">${linkify(m.text, p)}</div>`}${Attach.shown(m, p.slug)}${Share.commentMark(p, c, m)}</div>`;
  const newest = [...c.comments].reverse();
  const hasTest = c.status === 'verify' || c.testSteps;
  // The team's notes since your last word, shown on the Test tab next to Accept, so you never go looking (AIG-152).
  const lastMine = c.comments.map(m => isOwner(m.author)).lastIndexOf(true);
  const notes = c.comments.slice(lastMine + 1).filter(m => !isOwner(m.author) && (m.attachments || !/^Ready for you to test\./.test(m.text))).slice(-3);
  if (c.status !== 'verify') state.pileRun = null;
  if (state.tabFor !== c.id) { state.tabFor = c.id; state.cardTab = c.status === 'verify' ? 'test' : c.comments.length ? 'reply' : 'details'; }
  const tab = state.cardTab === 'test' && !hasTest ? 'reply' : state.cardTab;
  const tabBtn = (k, label) => `<button class="ctab ${tab === k ? 'on' : ''}" data-ctab="${k}" onclick="cardTab('${k}')">${label}</button>`;
  return `<div class="overlay" onclick="if(event.target===this) ${close}"><div class="panel" ${Term.panelAttr(p, c)}>
    <div class="card-head"><div class="card-title"><div class="id muted">${esc(c.id)} · ${esc(colLabel(p, c.status))}${c.status === 'team' && c.prevStatus ? ' ' + esc(t('card.was', { col: colLabel(p, c.prevStatus) })) : ''}${c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <h2>${esc(c.title)}</h2></div>${topActs}</div>
    <div class="meta">${metaHtml(c)}</div>
    ${c.status === 'verify' ? verdict : ''}
    ${checklistUi(p, c)}${waitsUi(p, c)}${secretsUi(p, c)}
    <div class="ctabs">${tabBtn('reply', esc(t('card.tab.reply')) + (c.comments.length ? ` <span class="n">${c.comments.length}</span>` : ''))}${tabBtn('details', esc(t('card.tab.details')))}${hasTest ? tabBtn('test', esc(t('card.tab.test')) + (c.status === 'verify' ? ` <span class="n hot">${esc(t('card.tab.yourcall'))}</span>` : '')) : ''}</div>
    <div class="cpane" data-pane="reply" ${tab === 'reply' ? '' : 'hidden'}>
      ${Share.cardComments(p, c)}
      ${quizPanel(p, c)}
      ${pop ? chatHtml(p, c, msg) : followBar(p, c) + replyHtml(p, c, msg, newest)}
    </div>
    <div class="cpane" data-pane="details" ${tab === 'details' ? '' : 'hidden'}>
      ${qaGateHtml(c)}${c.description ? `<div class="desc">${linkify(c.description, p)}</div>` : `<p class="muted">${esc(t('card.nodesc'))}</p>`}${postmortemHtml(c)}${problemHtml(p, c)}${changeHtml(p, c)}${Attach.shown(c, p.slug)}
    </div>
    ${hasTest ? `<div class="cpane" data-pane="test" ${tab === 'test' ? '' : 'hidden'}>
      ${c.proof ? proofHtml(c.proof) : ''}
      ${notes.length ? `<h3>${esc(t('card.fromteam'))}</h3>${notesHtml(notes, msg)}` : ''}
      ${c.testSteps ? `<h3>${esc(t('card.howtotest'))}</h3><div class="desc">${linkify(c.testSteps, p)}</div>` : ''}</div>` : ''}
  </div></div>`;
}

/* ---------- the ⋯ actions menu (AIG-935) ---------- */
function cardMenuToggle(on) {
  state.cardMenu = on === undefined ? !state.cardMenu : on;
  const m = $('card-menu'), b = $('cm-btn'); if (m) m.hidden = !state.cardMenu; if (b) b.setAttribute('aria-expanded', String(!!state.cardMenu));
}
document.addEventListener('click', e => { if (state.cardMenu && !e.target.closest('.card-menu-wrap')) cardMenuToggle(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.cardMenu) cardMenuToggle(false); });

/* ---------- card actions: edit, delete, reply, verdict ---------- */
function editCard() { state.editing = true; render(); const ti = $('f-title'); if (ti) ti.focus(); }
function cancelEdit() { state.editing = false; rerender(); }
async function saveCard(e) {
  e.preventDefault();
  const c = curCard(), now = readFields(true, true), body = {};
  if (!now.title) { setErr('f-err', t('card.err.title')); return false; }
  for (const k in now) if (now[k] !== (k === 'risk' ? c.risk || 'normal' : c[k])) body[k] = now[k];
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

// Once the owner has replied or given a verdict he's done with the card: close the panel, back to the board.
function popOutCard(s, id) {
  popOut('card', `#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 560, 780);
  location.hash = '#/p/' + s;
}
function closeCard() {
  if (state.route.pop) { window.close(); return; }
  state.editing = false;
  $('modal').innerHTML = '';
  location.hash = '#/p/' + slug();
}
// fixed: a one-tap answer (👍 Go on a question, AIG-75) instead of the typed one.
// Proof on hand-back (AIG-166): what the commit says, the files it changed and the change itself (folded).
function proofHtml(pr) {
  const diff = esc(pr.diff).split('\n').map(l => /^\+(?!\+\+)/.test(l) ? `<span class="add">${l}</span>` : /^-(?!--)/.test(l) ? `<span class="del">${l}</span>` : /^(diff |@@)/.test(l) ? `<span class="hunk">${l}</span>` : l).join('\n');
  return `<div class="proof"><h3>🔍 ${esc(t('proof.title'))}</h3>
    <div><b>${esc(pr.subject)}</b> <span class="muted">${esc(pr.sha.slice(0, 7))} · ${ago(pr.at)}</span>${pr.url ? ` · <a href="${esc(pr.url)}" target="_blank">${esc(t('proof.github'))}</a>` : ''}</div>
    <ul class="proof-files">${pr.files.map(f => `<li><code>${esc(f.file)}</code> <span class="add">+${f.add ?? '?'}</span> <span class="del">−${f.del ?? '?'}</span></li>`).join('')}</ul>
    <details><summary>${esc(t('proof.show'))}</summary><pre class="diff">${diff}${pr.cut ? '\n…' : ''}</pre></details></div>`;
}
// ▶ Open it (AIG-146): ask the board to start the app if needed, then open the page. No OK popup (AIG-719).
async function openIt(s, id, btn) {
  const was = btn.textContent; btn.disabled = true; btn.textContent = t('verdict.open.starting');
  try { const r = await api('POST', `/api/projects/${s}/cards/${id}/openit`); window.open(r.url, '_blank'); }
  catch (e) { alert(e.message); }
  btn.disabled = false; btn.textContent = was;
}
/* ---------- pop-outs come back (AIG-183) ---------- */
// A popped-out card closes when you reply or send it back. It is remembered for a day, and when the team
// replies on it again the main window opens it again. Kept in localStorage: every window of the board shares it.
const REOPEN_KEY = 'aigile.reopen', REOPEN_MS = 864e5;
const reopenList = () => { try { return JSON.parse(localStorage.getItem(REOPEN_KEY) || '{}'); } catch { return {}; } };
const reopenSave = l => { try { localStorage.setItem(REOPEN_KEY, JSON.stringify(l)); } catch {} };
function rememberPop(s, id) { if (!state.route.pop) return; const l = reopenList(); l[s + '/' + id] = new Date().toISOString(); reopenSave(l); }
async function reopenPops() {
  if (!state.route || /^#\/pop/.test(location.hash) || document.hidden) return;
  const l = reopenList(), keys = Object.keys(l); if (!keys.length) return;
  const projects = {};
  for (const k of keys) {
    const [s, id] = k.split('/'), at = l[k];
    if (Date.now() - Date.parse(at) > REOPEN_MS) { delete l[k]; continue; }
    try { projects[s] = projects[s] || await PagePoll.get('/api/projects/' + s); } catch { continue; }
    const c = projects[s].cards.find(x => x.id === id);
    if (!c || c.status === 'done') { delete l[k]; continue; }
    if (c.comments.some(m => m.at > at && !isOwner(m.author))) { delete l[k]; popOut('card', `#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 560, 780); }
  }
  reopenSave(l);
}
PagePoll.every(reopenPops, 5000);

// After dealing with a For you card, open the next one in the queue instead of closing (AIG-141).
// "3 of 12 left" (AIG-633): while working through the For you to test pile, a small line on the card. The total is the
// biggest the pile has been in this run (a run ends when you open a card that is not waiting for a test).
function pileLeft(p, c) {
  const left = forYouQueue(p).filter(x => x.status === 'verify' && kindOf(x) === 't').length;
  if (!state.pileRun || state.pileRun.slug !== p.slug) state.pileRun = { slug: p.slug, total: left };
  state.pileRun.total = Math.max(state.pileRun.total, left);
  if (left < 1 || state.pileRun.total < 2) return '';
  return `<div class="muted pile-left" id="pileLeft">${esc(t('pile.left', { n: left, total: state.pileRun.total }))}</div>`;
}
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
    if (state.route.pop) {   // a pop-out stays open like a chat (AIG-313): the box clears, ready for the next reply
      const box = $('r-text'); if (box) { box.value = ''; box.focus(); }
      setErr('r-err', ''); refresh(true);
      return;
    }
    doneWithCard(next);
  } catch (err) { setErr('r-err', err); }
}
