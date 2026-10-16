// The Reply tab as it was: latest message on top, the reply box right under it, older ones below.
function replyHtml(p, c, msg, newest) {
  return `${newest.length ? msg(newest[0], true) : `<p class="muted">${esc(t('card.nomsgs'))}</p>`}
      ${replyBox(p, c)}
      ${newest.length > 1 ? `<h3 class="muted" style="font-size:13px;margin-top:18px">${esc(t('card.earlier'))}</h3>${newest.slice(1).map(m => msg(m, false)).join('')}` : ''}`;
}
const replyBox = (p, c) => `<div class="reply">${cardAnswers(p, c)}<textarea dir="auto" id="r-text" data-draft="${esc(p.slug + '/' + c.id)}/reply" rows="3" placeholder="${esc(t('card.reply.ph', { name: me() }))}" onkeydown="if(EnterSend.is(event,'card')){event.preventDefault();sendReply()}"></textarea>
        <div class="err" id="r-err"></div>
        <div class="actions">${c.needsYou ? `<button class="good" onclick="sendReply('GO')" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>` : ''}<button class="primary" onclick="sendReply()">${esc(t('card.sendreply'))}</button>${looksRight(c)}${Attach.boxHtml(p.slug + '/' + c.id)}</div></div>`;
/* ---------- one-click answers on the card itself (AIG-371, AIG-315) ----------
   An open `aigile task` (assigned to the owner) always gets a ✅ Done. An open `aigile ask` (needs the owner) gets the same
   Go / Yes / --options buttons as the inbox (askActions, core.js); one that needs a reason (Not yet, No) starts the reply box.
   👍 Looks right sits next to Send reply when the newest comment is from the team and holds a code block or says
   "you should see" (en) / "je zou ... zien" / "zou je ... moeten zien" (nl). It sends the localised "Done, it looked as expected". */
const LOOKS_RIGHT_RE = /```|you should see|you'll see|je zou[^.\n]{0,40}zien|zou je[^.\n]{0,40}zien|je moet[^.\n]{0,40}zien/i;
function looksRight(c) {
  const m = (c.comments || []).at(-1);
  return m && !isOwner(m.author) && c.status !== 'done' && LOOKS_RIGHT_RE.test(m.text || '') ? `<button class="good" data-looksright title="${esc(t('card.looksright.title'))}" onclick="sendReply(t('card.looksright.say'))">${esc(t('card.looksright'))}</button>` : '';
}
function cardAnswers(p, c) {
  if (c.status === 'done') return '';
  if (isOwner(c.assignee)) return `<div class="msg-acts card-acts"><button class="good" data-cardtaskdone onclick="cardTaskDone()">${esc(t('inbox.k.done'))}</button><button data-cardtasksnooze title="${esc(t('inbox.t.wait.title'))}" onclick="cardTaskSnooze()">${esc(t('life.snooze'))}</button></div>`;
  if (!c.needsYou || c.blocked || c.status === 'verify') return '';
  // AIG-999: a question the owner already answered gives no buttons again; the team's newest message leads
  const cs = [...(c.comments || [])].reverse(), open = cs.findIndex(x => x.mark === 'ask' && !isOwner(x.author)), a = open >= 0 && !cs.slice(0, open).some(x => isOwner(x.author)) ? cs[open] : cs.find(x => !isOwner(x.author));
  const acts = a ? askActions(a, 'question') : [];
  return acts.length ? `<div class="msg-acts card-acts">${acts.map(x => `<button class="${x.ask != null ? '' : 'good'}" data-cardact ${x.ask != null ? `data-ask="${esc(x.ask)}"` : `data-say="${esc(x.say)}"`}>${esc(x.label)}</button>`).join('')}</div>` : '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cardact]'); if (!b) return;
  e.preventDefault();
  if (b.dataset.ask != null) { const ta = $('r-text'); if (ta) { ta.value = b.dataset.ask; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
  sendReply(b.dataset.say);
});
async function cardTaskDone() {
  const next = nextForYou();
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/taskdone`, { text: $('r-text').value.trim() }); clearDraft(slug() + '/' + cardId() + '/reply'); doneWithCard(next, 'card.next.done'); } catch (err) { setErr('r-err', err); }
}
// Snooze a task (AIG-867): off the list for an hour, never done, the team is not told.
async function cardTaskSnooze() {
  const next = nextForYou();
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/snooze`); doneWithCard(next, 'card.next.later'); } catch (err) { setErr('r-err', err); }
}
// A popped-out card (AIG-313) is laid out like the card panel since AIG-1383 (Latest on top, the reply box, then Earlier), with a
// typing line on top while the team works on the card. Sending never closes it; new messages land like on the panel (cardLive).
function typingHtml(p, c) {
  // AIG-639: "working…" only while a run is going, or a session is at work (not idle in its wait); a finished run says nothing.
  const pr = p.presence || {}, atWork = pr.running || (pr.online && !pr.waitingMs && (pr.where === 'vscode' || pr.where === 'terminal'));
  const typing = atWork && (c.status === 'doing' || c.status === 'team') && !c.needsYou;
  return typing || nudgeLit(p, c, false) ? `<div class="typing muted" id="typing">${typing ? stateLine(pr) : ''} ${nudgeBtn(p, c, typing)}</div>` : '';
}
// AIG-636: what the team is doing and for how long ("working · 12 min"), so busy and hung look different. presence.activity
// comes from the board: thinking (model output), working (tools), command (a long shell command). A run whose log has
// not grown for 15 min shows "no sign of life" in the warning colour.
const NOLIFE_MS = 15 * 60e3;
function stateLine(pr) {
  const a = pr.activity; if (!a) return esc(t('card.working'));
  const min = iso => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60e3)), stale = a.watch && Date.now() - Date.parse(a.signAt) >= NOLIFE_MS;
  const line = esc(t('card.act.' + a.state)) + ' · ' + esc(t('card.act.min', { n: min(a.since) }));
  return `<span class="act">${line}</span>` + (stale ? ` <b class="act-stale">⚠ ${esc(t('card.act.stale', { n: min(a.signAt) }))}</b>` : '');
}
// 👉 Nudge (AIG-593): by the typing line, lit when your last message is still not seen after 3 min, or the team has been
// typing for 5 min with nothing new. A click is the card's normal poke (free; only the wake run uses tokens). A run that
// really hangs is restarted by the board's own hang check (presence.js), so the button never kills a working run.
const typingSince = {};
const NUDGE_UNSEEN_MS = 3 * 60e3, NUDGE_TYPING_MS = 5 * 60e3;
function nudgeLit(p, c, typing) {
  const k = p.slug + '/' + c.id, last = c.comments[c.comments.length - 1], now = Date.now();
  const lastAt = last ? Date.parse(last.at) : 0;   // typing time restarts with each new message
  if (!typing) delete typingSince[k]; else if (!typingSince[k]) typingSince[k] = now; else if (lastAt > typingSince[k]) typingSince[k] = lastAt;
  const mine = [...c.comments].reverse().find(m => isOwner(m.author));
  const unseen = mine && !mine.poke && !(p.teamSeenAt && mine.at <= p.teamSeenAt) && now - Date.parse(mine.at) > NUDGE_UNSEEN_MS && !c.comments.slice(c.comments.indexOf(mine) + 1).some(m => !isOwner(m.author));
  return !!(unseen || (typing && now - typingSince[k] > NUDGE_TYPING_MS));
}
function nudgeBtn(p, c, typing) {
  const lit = nudgeLit(p, c, typing);
  return `<button type="button" class="nudge${lit ? ' lit' : ''}" id="nudgeBtn" onclick="nudgeCard(this)" title="${esc(t(lit ? 'nudge.lit' : 'nudge.title'))}" aria-label="${esc(t('nudge.title'))}">👉</button>`;
}
async function nudgeCard(btn) {
  if (btn) btn.disabled = true;
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/poke`); refresh(true); } catch (e) { alert(e.message); if (btn) btn.disabled = false; }
}
// AIG-426: the lead carried on in another card: a button to go there (and, if set, going by itself).
function followBar(p, c) { return c.followUp && p.cards.some(x => x.id === c.followUp) ? Follow.html('card', p.slug, c.id, c.followUp) : ''; }
// The open card on the board (AIG-314): a new team message must show even while the reply box is focused or holds a
// draft. Only what sits above and below the reply box, and the tab row, are swapped; the box itself is never touched.
function cardLive() {
  const p = state.project, c = p && p.cards.find(x => x.id === state.route.card), r = document.querySelector('#modal .panel .reply');
  if (!c || !r || state.editing || state.dragging || $('dialog').firstChild) return false;
  const tmp = document.createElement('div'); tmp.innerHTML = renderCard(p, c);
  const nr = tmp.querySelector('.reply'), tabs = document.querySelector('#modal .ctabs'), nt = tmp.querySelector('.ctabs');
  if (!nr || nr.parentNode.dataset.pane !== r.parentNode.dataset.pane) return false;
  let changed = false;
  if (tabs && nt && tabs.innerHTML !== nt.innerHTML) { tabs.innerHTML = nt.innerHTML; changed = true; }
  const side = (el, dir) => { const a = []; for (let n = el[dir]; n; n = n[dir]) a.push(n); return a; };
  for (const dir of ['previousSibling', 'nextSibling']) {
    const o = side(r, dir), n = side(nr, dir), h = l => l.map(x => x.outerHTML || x.textContent).join('');
    if (h(o) === h(n)) continue;
    changed = true; o.forEach(x => x.remove());
    if (dir === 'previousSibling') n.reverse().forEach(x => r.parentNode.insertBefore(x, r));   // nearest-first -> document order
    else n.forEach(x => r.parentNode.appendChild(x));
  }
  // The one-click answers and Looks right live inside the box but follow the newest message (AIG-371, AIG-315): swap just those.
  const acts = r.querySelector('.card-acts'), nacts = nr.querySelector('.card-acts'), lr = r.querySelector('[data-looksright]'), nlr = nr.querySelector('[data-looksright]');
  if ((acts ? acts.outerHTML : '') !== (nacts ? nacts.outerHTML : '')) { changed = true; if (acts && nacts) acts.replaceWith(nacts); else if (acts) acts.remove(); else r.prepend(nacts); }
  if ((lr ? lr.outerHTML : '') !== (nlr ? nlr.outerHTML : '')) { changed = true; if (lr && nlr) lr.replaceWith(nlr); else if (lr) lr.remove(); else r.querySelector('.primary').after(nlr); }
  if (changed) $('modal')._html = null;
  return true;
}
// Test tab notes (AIG-186): newest first, so the latest word sits right under the reply box. An AI tester check
// that a newer one replaced is faded and labelled, so a corrected verdict can't be mistaken for the current one.
const isCheck = m => /^🤖 /.test(m.text || '');
function notesHtml(notes, msg) {
  const lastCheck = notes.filter(isCheck).pop();
  return [...notes].reverse().map(m => isCheck(m) && m !== lastCheck
    ? `<div class="stale" title="${esc(t('card.stale'))}">${msg(m, false)}<div class="stale-note">${esc(t('card.stale'))}</div></div>` : msg(m, false)).join('');
}
// Switch card tab without re-rendering, so anything typed in another tab is kept.
function cardTab(k) {
  state.cardTab = k;
  document.querySelectorAll('#modal .ctab').forEach(b => b.classList.toggle('on', b.dataset.ctab === k));
  document.querySelectorAll('#modal .cpane').forEach(d => { d.hidden = d.dataset.pane !== k; });
}
