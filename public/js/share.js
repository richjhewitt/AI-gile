// Sharing a project with a friend (AIG-304, docs/SHARING-DESIGN.md): the board's 🔗 button and dialog
// (offer, the switch, check the link, unlink), and link offers in the inbox (✅ Link to... / ✋ No).
// Classic script; talks to /api/shares and /api/dms/contacts.
const Share = (function () {
  'use strict';
  let links = [], people = [], projects = [], sig = '';
  const ALLOW = ['send', 'take', 'comments', 'status', 'files', 'teamRead'];
  const DEFAULT = { send: true, take: true, comments: true, status: false, files: false, teamRead: false };
  // Roles on links (AIG-307): the server decides (lib/share.js CAN, sent as l.can); the page only shows and hides.
  const ROLES = ['viewer', 'alpha', 'reporter', 'member', 'tester', 'developer', 'admin'];
  const can = (l, k) => !!(l && l.can && l.can[k]);
  const open = l => ['offered', 'incoming', 'live'].includes(l.state) && !l.expired;
  const ofProject = s => links.find(l => l.slug === s && open(l)) || links.find(l => l.slug === s && l.state === 'ended' && !l.forgotten && l.endedBy !== 'declined');
  const offers = () => links.filter(l => l.state === 'incoming' && !l.expired);

  // inb: what the friend sent on the open project's link (AIG-305): { link, friend, cards: [lane cards], comments: { share: [...] } }.
  // Only the page reads it (GET /api/shares/:id/inbound); it is never in a project file, so teams never see it.
  let inb = null;
  const curSlug = () => typeof state !== 'undefined' && state.route && state.route.slug;
  async function load() {
    try {
      [links, people] = await Promise.all([api('GET', '/api/shares'), api('GET', '/api/dms/contacts')]);
      projects = offers().length ? await api('GET', '/api/projects') : [];   // only an offer needs the project list
      const l = curSlug() && ofProject(curSlug());
      inb = l && !l.forgotten && l.state !== 'offered' && l.state !== 'incoming' ? await api('GET', `/api/shares/${l.id}/inbound`) : null;
    } catch { return; }
    const s = JSON.stringify([links, people.map(p => [p.id, p.name, p.checked, p.blocked]), projects.map(p => [p.slug, p.name]), inb]);
    if (s === sig) return;
    sig = s;
    // The board (its 📥 row) always; an open card too (their comments) unless you are typing in it, like the 1s poll.
    if (typeof state !== 'undefined' && state.route && state.route.view === 'project') { if (!busy()) refresh(true); else if (!state.dragging) renderBoardOnly(); }
    paintInbox();
  }

  /* ---------- shared cards (AIG-305): 🔗 on a card, the preview, the 📥 lane, comments both ways ---------- */
  const liveLink = s => { const l = ofProject(s); return l && l.state === 'live' ? l : null; };
  const theirComments = share => (inb && inb.comments[share]) || [];
  const plain = s => `<div class="share-plain">${esc(s)}</div>`;   // a friend's text: escaped, links not clickable
  // The 📥 From {friend} row above the board: their cards, which stay here until I take one.
  // AIG-324: what they share with me, as its own board (#/shared/<link>), shaped by the role they gave me.
  const boardLink = l => l && l.theirRole && !l.forgotten && ['live', 'ended'].includes(l.state)
    ? `<p class="share-boardlink"><a class="btn" id="shareOpenBoard" href="#/shared/${esc(l.id)}">${esc(t('sb.open', { name: l.friend }))}</a> <span class="muted">${esc(t('sb.youare', { role: t('share.role.' + l.theirRole) }))}</span></p>` : '';
  function laneHtml(p) {
    const l = ofProject(p.slug);
    return boardLink(l) + rowHtml(l);
  }
  function rowHtml(l) {
    if (!l || !inb || inb.link !== l.id || (!inb.cards.length && !(l.state === 'live' && l.effective && l.effective.takeCards))) return '';
    const cards = inb.cards.map(x => `<button class="share-lcard" data-share-card="${esc(x.share)}" onclick="Share.laneCard('${esc(x.share)}')">
      <span class="t">${esc(x.title)}</span><span class="muted">${esc(x.type)} · ${esc(x.priority)}${theirComments(x.share).length ? ' · ' + esc(t('share.lane.replies', { n: theirComments(x.share).length })) : ''}${x.taken ? ' · ' + esc(t('share.lane.taken', { id: x.taken })) : ''}${x.forYou ? ' · 🙋 ' + esc(t('share.lane.forYou')) : ''}</span></button>`).join('');
    return `<div class="share-lane" id="shareLane"><h3>${esc(t('share.lane.h', { name: l.friend }))} <span class="muted">${inb.cards.length}</span></h3>
      <p class="muted">${esc(t('share.lane.note'))}</p>${cards || `<p class="muted">${esc(t('share.lane.none', { name: l.friend }))}</p>`}</div>`;
  }
  // The card panel's 🔗 button: share it, see what is shared, or where it came from.
  function cardBtn(p, c) {
    const l = ofProject(p.slug);
    if (c.share && c.share.theirs) return `<span class="pill share-pill">${esc(t('share.card.theirs', { name: l ? l.friend : '' }))}</span>`;
    if (!l || l.state !== 'live' || (!c.share && !(l.effective && l.effective.sendCards && can(l, 'seeMine')))) return '';
    return `<button id="shareCardBtn" onclick="Share.previewCard('${esc(c.id)}')">${esc(t(c.share ? 'share.card.shared' : 'share.card.btn', { name: l.friend }))}${c.share && c.share.held ? ' ' + esc(t('share.card.held')) : ''}</button>`;
  }
  // Their side of a shared card, in the Reply pane (none of it is in the card itself): their status as a label, their
  // description and files (a card I took from them), the test I handed them or they handed me (AIG-306), their comments.
  function cardComments(p, c) {
    if (!c.share) return '';
    const l = ofProject(p.slug), list = theirComments(c.share.id).filter(m => !m.mine);
    if (!l) return '';
    const x = c.share.theirs && inb ? inb.cards.find(y => y.share === c.share.id) : null;
    const o = c.share.mine && inb && inb.outbound ? inb.outbound[c.share.id] : null;
    const parts = [statusHtml(l, (x && x.status) || (o && o.theirStatus))];
    if (x && x.description) parts.push(`<h4>${esc(t('share.fc.desc', { name: l.friend }))}</h4>` + plain(x.description));
    if (x) parts.push(filesHtml(l, x), x.test ? theirTest(l, x) : '');
    if (c.share.mine) parts.push(myTest(l, c, o), assignHtml(l, c));
    parts.push(...[...list].reverse().map(m => friendMsg(m, l)));
    const body = parts.join('');
    return body ? `<div class="share-cmts"><h3 class="muted">${esc(t('share.cmts.h', { name: l.friend }))}</h3>${body}</div>` : '';
  }
  // Their status: a label only, my column never changes because of it.
  const statusHtml = (l, st) => st ? `<p class="share-status"><span class="pill">${esc(t('share.status', { name: l.friend, status: t('col.' + st.status) }))}</span> <span class="muted">${ago(st.at)}</span></p>` : '';
  // Their attachments: downloads only (saved, never shown or opened by the board).
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const filesHtml = (l, x) => (x.files || []).length ? `<div class="share-files"><h4>${esc(t('share.files.h', { name: l.friend }))}</h4>${x.files.map(f =>
    `<a class="share-file" href="/api/shares/${esc(l.id)}/files/${encodeURIComponent(f.id)}" download="${esc(f.name)}" rel="noopener">📎 ${esc(f.name)} <span class="muted">${kb(f.size)}</span></a>`).join('')}
    <p class="muted">${esc(t('share.files.note'))}</p></div>` : '';
  const live = (l, k) => l.state === 'live' && l.on && l.effective && l.effective[k];
  // A test I handed them on my card: waiting, or their verdict (a label, nothing moves). 🧪 hands it (again).
  function myTest(l, c, o) {
    const tt = o && o.test;
    const label = !tt ? '' : tt.open ? `<p class="share-test">${esc(t('share.test.waiting', { name: l.friend }))}</p>`
      : `<p class="share-test">${esc(t(tt.verdict === 'accept' ? 'share.test.accepted' : 'share.test.back', { name: l.friend }))}</p>${tt.note ? plain(tt.note) : ''}`;
    const btn = live(l, 'comments') && can(l, 'verdict') ? `<button id="shareTestBtn" onclick="Share.testDialog('${esc(c.id)}')">${esc(t('share.test.btn', { name: l.friend }))}</button>` : '';
    return label + btn;
  }
  // 🙋 Assign to {friend}: a Member or Tester acts (their status label) only on cards assigned to them.
  const assignHtml = (l, c) => l.state === 'live' && l.on && l.can && l.can.act === 'assigned'
    ? `<button id="shareAssignBtn" class="${c.share.assigned ? 'good' : ''}" onclick="Share.assign('${esc(c.id)}', ${c.share.assigned ? 'false' : 'true'})">${esc(t(c.share.assigned ? 'share.assign.on' : 'share.assign.btn', { name: l.friend }))}</button>` : '';
  async function assign(cardId, on) {
    try { await api('PATCH', `/api/shares/${ofProject(slug()).id}/cards/${encodeURIComponent(cardId)}`, { assigned: on }); sig = ''; await load(); if (typeof rerender === 'function') rerender(); } catch (e) { alert(e.message); }
  }
  // A test they handed me on their card: their text plain, ✅ Accept / ↩️ Send back (with what is wrong) once.
  function theirTest(l, x) {
    const tt = x.test;
    if (!tt.open) return `<p class="share-test">${esc(t(tt.verdict === 'accept' ? 'share.test.youaccepted' : 'share.test.yousentback', { name: l.friend }))}</p>`;
    return `<div class="share-test" data-share-test="${esc(x.share)}"><h4>${esc(t('share.test.asked', { name: l.friend }))}</h4>${tt.text ? plain(tt.text) : ''}
      ${live(l, 'comments') ? `<textarea id="shareVerdictNote" rows="2" placeholder="${esc(t('share.test.note.ph'))}"></textarea>
      <div class="actions"><button class="good" id="shareAccept" onclick="Share.verdict('${esc(x.share)}', 'accept')">${esc(t('share.test.accept'))}</button>
        <button id="shareBack" onclick="Share.verdict('${esc(x.share)}', 'back')">${esc(t('share.test.sendback'))}</button></div>` : ''}</div>`;
  }
  // 🧪 Ask {friend} to test: what to try (starts as the card's test steps; I see it before it goes, and the scrub checks it).
  function testDialog(cardId) {
    const l = ofProject(slug()), c = state.project && state.project.cards.find(x => x.id === cardId);
    if (!l || !c) return;
    openDialog(`<h2>${esc(t('share.test.h', { id: cardId, name: l.friend }))}</h2><p class="muted">${esc(t('share.test.intro', { name: l.friend }))}</p>
      <textarea id="shareTestText" rows="6">${esc(c.testSteps || '')}</textarea><div class="err" id="shareErr"></div>
      <div class="actions"><button class="primary" id="shareTestSend" onclick="Share.sendTest('${esc(cardId)}')">${esc(t('share.test.send', { name: l.friend }))}</button>
        <button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
  }
  async function sendTest(cardId, force) {
    const text = ($('shareTestText') || {}).value || '';
    try { await api('POST', `/api/shares/${ofProject(slug()).id}/test`, { card: cardId, text, force: !!force }); closeDialog(); sig = ''; await load(); if (typeof rerender === 'function') rerender(); }
    catch (e) { if (/path or a secret/.test(e.message) && confirm(e.message)) return sendTest(cardId, true); err(e); }
  }
  async function verdict(share, v, force) {
    const note = ($('shareVerdictNote') || {}).value || '';
    try { await api('POST', `/api/shares/${ofProject(slug()).id}/inbound/${share}/verdict`, { verdict: v, note, force: !!force }); sig = ''; await load(); if ($('dialog').querySelector('.share-fcard')) laneCard(share); else if (typeof rerender === 'function') rerender(); }
    catch (e) { if (/path or a secret/.test(e.message) && confirm(e.message)) return verdict(share, v, true); err(e); if (!$('shareErr')) alert(e.message); }
  }
  const friendMsg = (m, l) => `<div class="comment share-friend"><span class="who">${esc(m.mine ? m.author : t('share.via', { author: m.author, name: l.friend }))}</span><span class="when">${ago(m.at)}</span><div class="body">${m.mine ? esc(m.text) : plain(m.text)}</div></div>`;
  // Under one of my comments on a shared card: sent to the friend, or held by the scrub (with Send anyway).
  function commentMark(p, c, m) {
    if (!c.share || !m.shared) return '';
    const l = ofProject(p.slug), name = l ? l.friend : '';
    if (m.shared === 'sent') return `<div class="muted share-sent">${esc(t('share.sent', { name }))}</div>`;
    return `<div class="share-held">${esc(t('share.held', { name }))} ${l && l.state === 'live' ? `<button onclick="Share.sendHeld('${esc(c.id)}', '${esc(m.at)}')">${esc(t('share.prev.anyway'))}</button>` : ''}</div>`;
  }
  // 🔗 on a card: exactly what goes (the allow-listed fields), what the scrub flags, then Send / Send anyway.
  async function previewCard(cardId) {
    const l = ofProject(slug());
    if (!l) return;
    let pv;
    try { pv = await api('GET', `/api/shares/${l.id}/preview?card=${encodeURIComponent(cardId)}`); } catch (e) { alert(e.message); return; }
    const sh = pv.shared, can = l.state === 'live' && l.on && l.effective && l.effective.sendCards;
    const rows = pv.fields.map(k => `<tr data-field="${k}"><th>${esc(t('share.prev.f.' + k))}</th><td>${k === 'description' ? plain(pv.payload[k] || '') : esc(pv.payload[k])}</td></tr>`).join('');
    const flags = pv.flags.length ? `<div class="share-flags"><p>${esc(t('share.prev.flags'))}</p><ul>${pv.flags.map(f => `<li>${esc(t('share.prev.f.' + f.field))}: ${esc(t('share.prev.kind.' + f.kind))} <code>${esc(f.text)}</code></li>`).join('')}</ul></div>` : '';
    const send = !can ? `<p class="muted">${esc(t('share.prev.off'))}</p>`
      : `<button class="primary" id="shareCardSend" onclick="Share.sendCard('${esc(cardId)}', ${pv.flags.length ? 'true' : 'false'})">${esc(pv.flags.length ? t('share.prev.anyway') : sh ? t('share.prev.update') : t('share.prev.send', { name: l.friend }))}</button>`;
    openDialog(`<h2>${esc(t('share.prev.h', { id: cardId, name: l.friend }))}</h2>
      <p class="muted">${esc(t('share.prev.intro', { name: l.friend }))}</p>
      <table class="share-preview">${rows}</table>${flags}
      ${pv.files && pv.files.length ? `<div class="share-files" id="sharePrevFiles"><h4>${esc(t('share.prev.files'))}</h4>${pv.files.map(f => `<div>📎 ${esc(f.name)}${f.big ? ' <span class="muted">' + esc(t('share.prev.big')) + '</span>' : ''}</div>`).join('')}</div>` : ''}
      ${sh ? `<p class="muted">${esc(t('share.prev.sent', { when: ago(sh.sentAt || sh.at) }))}${sh.held ? ' ' + esc(t('share.prev.held')) : ''}</p>` : ''}
      <div class="err" id="shareErr"></div>
      <div class="actions">${send}${sh ? `<button onclick="Share.unshareCard('${esc(cardId)}')" title="${esc(t('share.prev.stop.note'))}">${esc(t('share.prev.stop'))}</button>` : ''}
        <button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
  }
  async function cardAct(fn) { try { await fn(); closeDialog(); sig = ''; await load(); if (typeof rerender === 'function') rerender(); } catch (e) { err(e); } }
  const sendCard = (cardId, force) => cardAct(() => api('POST', `/api/shares/${ofProject(slug()).id}/cards`, { card: cardId, force }));
  const unshareCard = cardId => cardAct(() => api('DELETE', `/api/shares/${ofProject(slug()).id}/cards/${encodeURIComponent(cardId)}`));
  async function sendHeld(cardId, at) {
    try { await api('POST', `/api/shares/${ofProject(slug()).id}/held`, { card: cardId, at }); if (typeof rerender === 'function') rerender(); } catch (e) { alert(e.message); }
  }
  // A card in the 📥 lane: their text as plain text, the replies both ways, a reply box, ➡️ Take into my Backlog.
  function laneCard(share) {
    const l = ofProject(slug()), x = inb && inb.cards.find(c => c.share === share);
    if (!l || !x) return;
    const list = theirComments(share), live = l.state === 'live' && l.on && l.effective && l.effective.comments;
    openDialog(`<div class="share-fcard" data-share-open="${esc(share)}"><div class="id muted">${esc(t('share.card.theirs', { name: l.friend }))} · ${esc(x.type)} · ${esc(x.priority)} · ${ago(x.updated)}</div>
      <h2>${esc(x.title)}</h2>
      ${statusHtml(l, x.status)}
      ${x.description ? plain(x.description) : `<p class="muted">${esc(t('share.fc.nodesc'))}</p>`}
      <p class="muted">${esc(t('share.fc.plain'))}</p>
      ${filesHtml(l, x)}${x.test ? theirTest(l, x) : ''}
      <h3>${esc(t('card.tab.reply'))}</h3>${list.length ? [...list].reverse().map(m => friendMsg(m, l)).join('') : `<p class="muted">${esc(t('share.fc.none'))}</p>`}
      ${live ? `<div class="reply"><textarea id="shareReply" rows="3" placeholder="${esc(t('share.fc.reply.ph', { name: l.friend }))}"></textarea>
        <div class="actions"><button class="primary" id="shareReplySend" onclick="Share.laneReply('${esc(share)}')">${esc(t('share.fc.send'))}</button></div></div>` : ''}
      <div class="err" id="shareErr"></div>
      <div class="actions">${x.taken ? `<a class="btn" href="#/p/${esc(slug())}/${esc(x.taken)}" onclick="closeDialog()">${esc(t('share.fc.open', { id: x.taken }))}</a>`
        : `<button class="good" id="shareTake" onclick="Share.takeCard('${esc(share)}')" title="${esc(t('share.fc.takehelp'))}">${esc(t('share.fc.take'))}</button>`}
        <button onclick="closeDialog()">${esc(t('common.close'))}</button></div>
      ${x.taken ? '' : `<p class="muted">${esc(t('share.fc.takehelp'))}</p>`}</div>`, 'wide');
  }
  async function laneReply(share, force) {
    const text = ($('shareReply') || {}).value || '';
    if (!text.trim()) return;
    try { await api('POST', `/api/shares/${ofProject(slug()).id}/inbound/${share}/comments`, { text, force: !!force }); sig = ''; await load(); laneCard(share); }
    catch (e) {
      if (/path or a secret/.test(e.message) && confirm(e.message)) return laneReply(share, true);
      err(e);
    }
  }
  async function takeCard(share) {
    try { const c = await api('POST', `/api/shares/${ofProject(slug()).id}/inbound/${share}/take`); sig = ''; await load(); laneCard(share); refresh(true); return c; } catch (e) { err(e); }
  }

  /* ---------- the board's button and dialog ---------- */
  function button(p) {
    const l = ofProject(p.slug);
    const label = !l ? t('share.btn') : l.state === 'live' ? t('share.btn.live', { name: l.friend }) + (l.on ? '' : ' ⏸') : l.state === 'offered' ? t('share.btn.offered') : t('share.btn.ended');
    return `<button id="shareBtn" onclick="Share.dialog()" title="${esc(t('share.btn.title'))}">${esc(label)}</button>`;
  }
  const ticks = (pre, a) => ALLOW.map(k => `<label class="chk"><input type="checkbox" data-allow="${pre}${k}" ${a[k] ? 'checked' : ''}> ${esc(t('share.allow.' + k))}</label>`).join('');
  const readTicks = pre => Object.fromEntries(ALLOW.map(k => [k, !!(document.querySelector(`[data-allow="${pre}${k}"]`) || {}).checked]));
  // The safety code: both people read the 6 words to each other; a match means nobody is in the middle.
  const safetyHtml = c => `<div class="share-safety"><p>${esc(t('share.safety.need', { name: c.name || c.friend }))}</p>
    <p class="share-words"><b>${esc(c.safety)}</b></p>
    <button class="good" onclick="Share.markChecked('${esc(c.id || c.contact)}')">${esc(t('share.safety.ok'))}</button></div>`;
  const whatHtml = l => l.effective ? `<ul class="share-what">${[['sendCards', 'share.eff.send'], ['takeCards', 'share.eff.take'], ['comments', 'share.eff.comments'], ['status', 'share.eff.status'], ['files', 'share.eff.files'], ['teamRead', 'share.eff.teamRead']]
    .map(([k, key]) => `<li>${l.effective[k] ? '✅' : '⛔'} ${esc(t(key, { name: l.friend }))}</li>`).join('')}</ul>` : '';

  // Their role: one of the AIG-185 roles, for this project or all my projects with them; what it lets them do.
  function roleHtml(l) {
    const opts = ROLES.map(r => `<option value="${r}" ${l.role === r ? 'selected' : ''}>${esc(t('share.role.' + r))}</option>`).join('');
    return `<div class="share-role"><label class="f"><span>${esc(t('share.role.label'))}</span><select id="shareRole" onchange="Share.setRole('${l.id}')">${opts}</select></label>
      <label class="f"><span>${esc(t('share.role.scope'))}</span><select id="shareRoleScope" onchange="Share.setRole('${l.id}')">
        <option value="project" ${l.roleScope !== 'all' ? 'selected' : ''}>${esc(t('share.role.scope.project'))}</option>
        <option value="all" ${l.roleScope === 'all' ? 'selected' : ''}>${esc(t('share.role.scope.all', { name: l.friend }))}</option></select></label>
      <p class="muted" id="shareRoleHelp">${esc(t('share.role.help.' + l.role))} ${esc(t('share.role.never', { name: l.friend }))}</p>
      ${l.theirRole ? `<p class="muted" id="shareTheirRole">${esc(t('share.role.theirs', { name: l.friend, role: t('share.role.' + l.theirRole) }))}</p>` : ''}</div>`;
  }
  async function dialog() {
    await load();
    const s = slug(), l = ofProject(s), p = state.project;
    let body;
    if (l && l.state === 'live') {
      body = `<p>${esc(t('share.live', { name: l.friend, project: l.theirName }))}</p>
        <label class="chk share-switch"><input type="checkbox" id="shareOn" ${l.on ? 'checked' : ''} onchange="Share.setOn('${l.id}', this.checked)"> ${esc(t('share.switch'))}</label>
        <p class="muted">${esc(l.on ? t('share.switch.on') : t('share.switch.off'))}${l.droppedOff ? ' · ' + esc(t('share.dropped', { n: l.droppedOff })) : ''}${l.overCap ? ' · ' + esc(t('share.overcap', { n: l.overCap })) : ''}</p>
        <p class="muted" id="shareHeard">${esc(l.lastHeard ? t('share.heard', { name: l.friend, when: ago(l.lastHeard) }) : t('share.heard.never', { name: l.friend }))}</p>
        ${whatHtml(l)}
        ${roleHtml(l)}
        <label class="chk"><input type="checkbox" id="shareBoard" ${l.board ? 'checked' : ''} ${can(l, 'seeMine') ? '' : 'disabled'} onchange="Share.setBoard('${l.id}', this.checked)"> ${esc(t('share.board', { name: l.friend }))}</label>
        <p class="muted" id="shareBoardHelp">${esc(t(!can(l, 'seeMine') ? 'share.board.no' : l.board ? 'share.board.on' : 'share.board.off', { name: l.friend }))}</p>
        <label class="chk"><input type="checkbox" id="shareTeamRead" ${l.mine && l.mine.teamRead ? 'checked' : ''} onchange="Share.setTeamRead('${l.id}', this.checked)"> ${esc(t('share.allow.teamRead'))}</label>
        <p class="muted">${esc(t(l.mine && l.mine.teamRead ? 'share.teamRead.on' : 'share.teamRead.off', { name: l.friend }))}</p>
        <div class="actions"><button onclick="Share.ping('${l.id}')" ${l.on ? '' : 'disabled'}>${esc(t('share.ping'))}</button>
          <button onclick="Share.unlink('${l.id}', false)">${esc(t('share.unlink'))}</button>
          <button class="danger" onclick="Share.unlink('${l.id}', true)">${esc(t('share.forget'))}</button></div>`;
    } else if (l && l.state === 'offered') {
      body = `<p>${esc(t('share.offered', { name: l.friend }))}</p><p class="muted">${esc(t('share.offered.exp'))}</p>
        <div class="actions"><button onclick="Share.unlink('${l.id}', false)">${esc(t('share.cancel'))}</button></div>`;
    } else {
      const ended = l ? `<p class="muted">${esc(t('share.ended.' + (l.endedBy || 'me'), { name: l.friend }))}</p>
        <div class="actions"><button class="danger" onclick="Share.unlink('${l.id}', true)">${esc(t('share.forget.after'))}</button></div><hr>` : '';
      const ok = people.filter(c => !c.blocked);
      if (!ok.length) body = ended + `<p>${esc(t('share.nobody'))}</p>`;
      else {
        const pick = state.sharePick && ok.find(c => c.id === state.sharePick) || ok[0];
        body = ended + `<p class="muted">${esc(t('share.intro'))}</p>
          <label class="f"><span>${esc(t('share.with'))}</span><select id="shareWho" onchange="state.sharePick=this.value; Share.dialog()">${ok.map(c => `<option value="${esc(c.id)}" ${c.id === pick.id ? 'selected' : ''}>${esc(c.name)}${c.checked ? ' ✔' : ''}</option>`).join('')}</select></label>
          ${pick.checked ? '' : safetyHtml(pick)}
          <div class="share-ticks">${ticks('o-', DEFAULT)}</div>
          <p class="muted">${esc(t('share.never'))}</p>
          <div class="actions"><button class="primary" id="shareSend" onclick="Share.offer()" ${pick.checked ? '' : 'disabled'}>${esc(t('share.send'))}</button></div>`;
      }
    }
    openDialog(`<h2>${esc(t('share.h', { project: p.name }))}</h2>${body}<div class="err" id="shareErr"></div>
      <div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  }
  const err = (e, id = 'shareErr') => { const x = $(id) || document.querySelector('[data-share-err]'); if (x) x.textContent = e.message || String(e); };
  async function act(fn, again = true) {
    try { await fn(); sig = ''; await load(); if (again && $('dialog').firstChild) dialog(); } catch (e) { err(e); }
  }
  const offer = () => act(() => api('POST', '/api/shares', { slug: slug(), contact: $('shareWho').value, allow: readTicks('o-') }));
  const setOn = (id, on) => act(() => api('PATCH', '/api/shares/' + id, { on }));
  const setTeamRead = (id, teamRead) => act(() => api('PATCH', '/api/shares/' + id, { teamRead }));
  const setBoard = (id, board) => act(async () => { const r = await api('PATCH', '/api/shares/' + id, { board }); if (r.shared) note(t('share.board.sent', { n: r.shared.sent, held: r.shared.held })); });
  const setRole = id => act(() => api('PATCH', '/api/shares/' + id, { role: $('shareRole').value, scope: $('shareRoleScope').value }));
  const ping = id => act(() => api('POST', `/api/shares/${id}/ping`));
  function unlink(id, forget) {
    if (forget && !confirm(t('share.forget.confirm'))) return;
    act(() => api('POST', `/api/shares/${id}/unlink`, { forget }));
  }
  const markChecked = cid => act(() => api('PATCH', '/api/dms/contacts/' + cid, { checked: true }), !!$('dialog').firstChild);

  /* ---------- offers in the inbox ---------- */
  function offerHtml(l) {
    const mine = projects;
    const taken = new Set(links.filter(o => open(o) && o.slug).map(o => o.slug));
    const free = mine.filter(p => !p.archived && !taken.has(p.slug));
    return `<div class="ib-item share-offer" data-share="${esc(l.id)}">
      <div class="ib-top"><span class="ib-tag">${esc(t('share.offer.tag'))}</span><span class="ib-proj">${esc(l.friend)}</span></div>
      <div class="ib-title">${esc(t('share.offer.title', { name: l.friend, project: l.theirName }))}</div>
      <div class="ib-who">${esc(t('share.offer.they'))} ${ALLOW.filter(k => l.theirs && l.theirs[k]).map(k => esc(t('share.allow.' + k))).join(' · ') || '-'}</div>
      ${l.checked ? '' : safetyHtml(l)}
      <label class="f"><span>${esc(t('share.offer.into'))}</span><select data-share-into>
        ${free.map(p => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('')}<option value="_new">${esc(t('share.offer.new'))}</option></select></label>
      <input type="text" data-share-new placeholder="${esc(t('share.offer.newname'))}" value="${esc(l.theirName)}">
      <div class="share-ticks">${ticks('a-' + l.id + '-', DEFAULT)}</div>
      <div class="ib-err" data-share-err></div>
      <div class="actions"><button class="good" data-share-yes ${l.checked ? '' : 'disabled'} onclick="Share.acceptOffer('${l.id}')">${esc(t('share.offer.yes'))}</button>
        <button onclick="Share.declineOffer('${l.id}')">${esc(t('share.offer.no'))}</button></div></div>`;
  }
  function paintInbox() {
    const box = document.getElementById('ibShare');
    if (!box) return;
    const list = offers(), html = list.length ? `<h3>${esc(t('share.offers.h'))} <span class="ib-badge">${list.length}</span></h3>${list.map(offerHtml).join('')}` : '';
    if (typeof IB !== 'undefined') IB.offers = list.length;
    if (box.dataset.sig === html) return;
    box.dataset.sig = html; box.innerHTML = html; box.hidden = !list.length;
  }
  async function acceptOffer(id) {
    const item = document.querySelector(`[data-share="${id}"]`), into = item.querySelector('[data-share-into]').value;
    try {
      let s = into;
      if (into === '_new') s = (await api('POST', '/api/projects', { name: item.querySelector('[data-share-new]').value.trim() })).slug;
      await api('POST', `/api/shares/${id}/accept`, { slug: s, allow: readTicks('a-' + id + '-') });
      sig = ''; await load();
    } catch (e) { const x = item.querySelector('[data-share-err]'); if (x) x.textContent = e.message; }
  }
  async function declineOffer(id) {
    try { await api('POST', `/api/shares/${id}/decline`); sig = ''; await load(); } catch (e) { const x = document.querySelector(`[data-share="${id}"] [data-share-err]`); if (x) x.textContent = e.message; }
  }

  setInterval(() => { if (!document.hidden && typeof i18n !== 'undefined' && i18n.ready) load(); }, 3000);
  return { load, button, dialog, offer, setOn, setTeamRead, setBoard, setRole, assign, testDialog, sendTest, verdict, ping, unlink, markChecked, paintInbox, acceptOffer, declineOffer, offers,
    laneHtml, cardBtn, cardComments, commentMark, previewCard, sendCard, unshareCard, sendHeld, laneCard, laneReply, takeCard };
})();
