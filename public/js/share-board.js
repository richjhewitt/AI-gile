// A project a friend shares with me, as its own board (AIG-324/325): #/shared/<link>. Their cards in the column their
// status label says, plus the cards I raised there; what I can do follows the role they gave me (the server sends
// it as `can`; their board checks it again, so nothing here is the real gate). Read-only-ish: nothing moves by drag,
// every action is one share message (card, comment, status, verdict). Classic script; texts `sb.*`.
const ShareBoard = (function () {
  'use strict';
  const COLS = ['', 'backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
  const STATUSES = COLS.slice(1);
  const plain = s => `<div class="share-plain">${esc(s)}</div>`;   // their text: escaped, links not clickable
  const live = b => b && b.state === 'live' && b.on && b.effective;
  const may = (b, what, x) => {
    if (!live(b)) return false;
    const c = b.can || {};
    if (what === 'raise') return b.effective.sendCards && (c.raise || []).length > 0;
    if (what === 'comment') return b.effective.comments && (c.comment === 'shared' || (c.comment === 'own' && x && x.mine));
    if (what === 'status') return b.statusOk && x && !x.mine && (c.act === 'all' || (c.act === 'assigned' && x.forYou));
    if (what === 'verdict') return b.effective.comments && c.verdict && x && !x.mine && x.test && x.test.open;
    return false;
  };
  const cur = () => state.sboard;
  const colName = k => t(k ? 'sb.col.' + k : 'sb.col.none');

  function tile(x) {
    const bits = [`<span class="pill">${esc(t('type.' + x.type))}</span>`,
      x.priority && x.priority !== 'normal' ? `<span class="pill ${esc(x.priority)}">${esc(t('priority.' + x.priority))}</span>` : '',
      x.mine ? `<span class="pill sb-mine">${esc(t('sb.mine'))}</span>` : '',
      x.forYou ? `<span class="pill you">🙋 ${esc(t('share.lane.forYou'))}</span>` : '',
      x.test && x.test.open && !x.mine ? `<span class="pill you">🧪 ${esc(t('sb.test.waiting'))}</span>` : '',
      x.myStatus ? `<span class="pill">${esc(t('sb.mystatus', { status: t('sb.col.' + x.myStatus.status) }))}</span>` : '',
      x.comments ? `<span class="pill">💬 ${x.comments}</span>` : ''].join(' ');
    return `<div class="card sb-card" data-sb-card="${esc(x.share)}" role="button" tabindex="0" onclick="ShareBoard.open('${esc(x.share)}')" onkeydown="if(event.key==='Enter')ShareBoard.open('${esc(x.share)}')">
      <div class="t">${esc(x.title)}</div><div class="meta">${bits}</div></div>`;
  }
  function render(b) {
    if (!b) return `<p class="muted">${esc(t('sb.gone'))}</p>`;
    const role = b.role ? t('share.role.' + b.role) : t('share.role.member');
    const raise = may(b, 'raise') ? (b.can.raise || []).map(k => `<button class="${k === 'bug' ? 'bug' : 'primary'}" data-sb-raise="${k}" onclick="ShareBoard.raiseDialog('${k}')">${esc(t('sb.raise.' + k))}</button>`).join('') + ((b.can.raise || []).includes('feature') ? `<button data-sb-request onclick="ShareBoard.requestDialog()">${esc(t('featreq.btn'))}</button>` : '') : '';
    const by = k => b.cards.filter(x => (x.status || '') === k);
    const cols = COLS.filter(k => !(k === '' || k === 'team') || by(k).length).map(k => `<div class="column sb-col" data-sb-col="${k || 'none'}"><h3><span>${esc(colName(k))}</span><span>${by(k).length}</span></h3>${by(k).map(tile).join('')}</div>`).join('');
    const why = !live(b) ? t(b.state === 'ended' ? 'sb.ended' : 'sb.off', { name: b.friend }) : '';
    return `<div class="toolbar"><h2>🔗 ${esc(b.theirName || b.friend)}</h2>
        <span class="pill" id="sbRole" title="${esc(t('sb.role.title', { name: b.friend }))}">${esc(t('sb.youare', { role }))}</span>${raise}
        <span class="grow"></span>${b.slug ? `<a class="btn" href="#/p/${esc(b.slug)}">${esc(t('sb.linked', { project: b.projectName || b.slug }))}</a>` : ''}</div>
      <p class="muted" id="sbCan">${esc(t('sb.can.' + (b.role || 'member'), { name: b.friend }))} ${esc(t(b.board ? 'sb.whole' : 'sb.ticked', { name: b.friend }))} ${esc(t('sb.never', { name: b.friend }))}</p>
      ${why ? `<p class="share-held" id="sbWhy">${esc(why)}</p>` : ''}
      ${b.cards.length ? '' : `<div class="emptyhint" id="sbEmpty">${esc(t('sb.empty', { name: b.friend }))}</div>`}
      <div class="board sb-board">${cols}</div>`;
  }

  // One card: their text plain, its column on their board, the replies, and only the buttons my role has.
  function open(share) {
    const b = cur(), x = b && b.cards.find(c => c.share === share);
    if (!x) return;
    const list = (b.comments[share] || []).slice().reverse();
    const msgs = list.length ? list.map(m => `<div class="comment share-friend"><span class="who">${esc(m.mine ? m.author : t('share.via', { author: m.author, name: b.friend }))}</span><span class="when">${ago(m.at)}</span><div class="body">${m.mine ? esc(m.text) : plain(m.text)}</div></div>`).join('')
      : `<p class="muted">${esc(t('share.fc.none'))}</p>`;
    const where = x.status ? t('sb.where', { name: b.friend, col: t('sb.col.' + x.status) }) : t(x.mine ? 'sb.where.new' : 'sb.where.none', { name: b.friend });
    const files = (x.files || []).length ? `<div class="share-files"><h4>${esc(t('share.files.h', { name: b.friend }))}</h4>${x.files.map(f => `<a class="share-file" href="/api/shares/${esc(b.link)}/files/${encodeURIComponent(f.id)}" download="${esc(f.name)}" rel="noopener">📎 ${esc(f.name)}</a>`).join('')}</div>` : '';
    const test = !x.test || x.mine ? '' : !x.test.open ? `<p class="share-test">${esc(t(x.test.verdict === 'accept' ? 'share.test.youaccepted' : 'share.test.yousentback', { name: b.friend }))}</p>`
      : `<div class="share-test"><h4>${esc(t('share.test.asked', { name: b.friend }))}</h4>${x.test.text ? plain(x.test.text) : ''}
        ${may(b, 'verdict', x) ? `<textarea id="sbNote" rows="2" placeholder="${esc(t('share.test.note.ph'))}"></textarea>
        <div class="actions"><button class="good" id="sbAccept" onclick="ShareBoard.verdict('${esc(share)}', 'accept')">${esc(t('share.test.accept'))}</button>
          <button id="sbBack" onclick="ShareBoard.verdict('${esc(share)}', 'back')">${esc(t('share.test.sendback'))}</button></div>` : ''}</div>`;
    const status = may(b, 'status', x) ? `<label class="f"><span>${esc(t('sb.setstatus'))}</span><select id="sbStatus" onchange="ShareBoard.setStatus('${esc(share)}', this.value)">
        <option value="">-</option>${STATUSES.map(k => `<option value="${k}" ${x.myStatus && x.myStatus.status === k ? 'selected' : ''}>${esc(t('sb.col.' + k))}</option>`).join('')}</select></label>
        <p class="muted">${esc(t('sb.setstatus.note', { name: b.friend }))}</p>` : '';
    const reply = may(b, 'comment', x) ? `<div class="reply"><textarea id="sbReply" rows="3" placeholder="${esc(t('share.fc.reply.ph', { name: b.friend }))}"></textarea>
        <div class="actions"><button class="primary" id="sbReplySend" onclick="ShareBoard.reply('${esc(share)}')">${esc(t('share.fc.send'))}</button></div></div>`
      : `<p class="muted" id="sbNoReply">${esc(t('sb.noreply'))}</p>`;
    openDialog(`<div class="share-fcard sb-open" data-sb-open="${esc(share)}"><div class="id muted">${esc(t(x.mine ? 'sb.mine' : 'share.card.theirs', { name: b.friend }))} · ${esc(t('type.' + x.type))} · ${esc(t('priority.' + x.priority))}</div>
      <h2>${esc(x.title)}</h2><p class="share-status"><span class="pill">${esc(where)}</span></p>
      ${x.description ? plain(x.description) : `<p class="muted">${esc(t('share.fc.nodesc'))}</p>`}
      ${files}${test}${status}
      <h3>${esc(t('card.tab.reply'))}</h3>${msgs}${reply}
      <div class="err" id="sbErr"></div>
      <div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div></div>`, 'wide');
  }
  function raiseDialog(type) {
    const b = cur(); if (!b) return;
    openDialog(`<h2>${esc(t('sb.raise.' + type))}</h2><p class="muted">${esc(t('sb.raise.intro', { name: b.friend }))}</p>
      <label class="f"><span>${esc(t('sb.raise.title'))}</span><input type="text" id="sbTitle" maxlength="200"></label>
      <label class="f"><span>${esc(t('sb.raise.desc'))}</span><textarea id="sbDesc" rows="5"></textarea></label>
      <div class="err" id="sbErr"></div>
      <div class="actions"><button class="primary" id="sbRaiseSend" onclick="ShareBoard.sendRaise('${type}')">${esc(t('sb.raise.send', { name: b.friend }))}</button>
        <button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
  }
  // Request a feature or a custom build (AIG-846): always held for the owner's OK, whatever his Approvals setting.
  function requestDialog() {
    const b = cur(); if (!b) return;
    openDialog(`<h2>${esc(t('featreq.btn'))}</h2><p class="muted">${esc(t('featreq.intro', { name: b.friend }))}</p>
      <label class="f"><span>${esc(t('sb.raise.title'))}</span><input type="text" id="frTitle" maxlength="200"></label>
      <label class="f"><span>${esc(t('featreq.want'))}</span><textarea id="frWant" rows="4"></textarea></label>
      <label class="f"><span>${esc(t('featreq.why'))}</span><textarea id="frWhy" rows="3"></textarea></label>
      <label class="check"><input type="checkbox" id="frCustom"> ${esc(t('featreq.custom'))}</label>
      <div class="err" id="sbErr"></div>
      <div class="actions"><button class="primary" id="frSend" onclick="ShareBoard.sendRequest()">${esc(t('sb.raise.send', { name: b.friend }))}</button>
        <button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
  }
  async function sendRequest(force) {
    const v = id => ($(id) || {}).value || '', title = v('frTitle'), want = v('frWant'), why = v('frWhy'), custom = !!($('frCustom') || {}).checked;
    if (!title.trim() || !want.trim()) return err(new Error(t('featreq.need')));
    try { await api('POST', `/api/shares/${cur().link}/request`, { title, want, why, custom, force: !!force }); note(t('featreq.sent', { name: cur().friend })); await again(); }
    catch (e) { if (scrubbed(e)) return sendRequest(true); err(e); }
  }
  const err = e => { const x = $('sbErr'); if (x) x.textContent = e.message || String(e); else alert(e.message); };
  const again = async share => { state.sboard = await api('GET', `/api/shares/${cur().link}/board`); if (share) open(share); else closeDialog(); refresh(true); };
  const scrubbed = e => /path or a secret/.test(e.message) && confirm(e.message);
  async function sendRaise(type, force) {
    const title = ($('sbTitle') || {}).value || '', description = ($('sbDesc') || {}).value || '';
    if (!title.trim()) return err(new Error(t('sb.raise.need')));
    try { await api('POST', `/api/shares/${cur().link}/raise`, { type, title, description, force: !!force }); note(t('sb.raise.sent', { name: cur().friend })); await again(); }
    catch (e) { if (scrubbed(e)) return sendRaise(type, true); err(e); }
  }
  async function reply(share, force) {
    const text = ($('sbReply') || {}).value || '';
    if (!text.trim()) return;
    try { await api('POST', `/api/shares/${cur().link}/board/${share}/comments`, { text, force: !!force }); await again(share); }
    catch (e) { if (scrubbed(e)) return reply(share, true); err(e); }
  }
  async function setStatus(share, status) {
    if (!status) return;
    try { await api('POST', `/api/shares/${cur().link}/board/${share}/status`, { status }); await again(share); } catch (e) { err(e); }
  }
  async function verdict(share, v, force) {
    const note = ($('sbNote') || {}).value || '';
    try { await api('POST', `/api/shares/${cur().link}/inbound/${share}/verdict`, { verdict: v, note, force: !!force }); await again(share); }
    catch (e) { if (scrubbed(e)) return verdict(share, v, true); err(e); }
  }
  return { render, open, requestDialog, sendRequest, raiseDialog, sendRaise, reply, setStatus, verdict };
})();
