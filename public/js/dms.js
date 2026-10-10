/* ---------- DMs with the team leads (AIG-137/138): a Discord-style rail and chat, apart from the work inbox ---------- */
// The rail down the left shows one avatar per project lead (project emoji and colour) with an unread count.
// Clicking one opens the chat: the lead's messages left, yours right. The typing box answers the newest open
// question, or (when none is waiting) sends the lead a new message as a quick question card (AIG-132).
const Dms = (() => {
  let chats = [], open = null, thread = null, busy = false;
  const el = id => document.getElementById(id);
  const avatar = c => `<span class="dm-av" style="--proj:${esc(c.color || '')}">${esc(c.emoji || '💬')}</span>`;

  async function loadRail() {
    try { chats = await api('GET', '/api/chats'); } catch { return; }
    const html = chats.map(c => `<button class="dm-railbtn ${open === c.slug ? 'on' : ''}" data-dm="${esc(c.slug)}" title="${esc(c.lead)} · ${esc(c.name)}">${avatar(c)}${c.unread ? `<span class="dm-unread">${c.unread}</span>` : ''}</button>`).join('');
    const r = el('dmRail');
    if (r && r.dataset.sig !== html) { r.dataset.sig = html; r.innerHTML = '<div class="dm-railhead" title="DMs with your team leads">💬</div>' + html; }
  }

  function msgHtml(m, prevCard) {
    const head = m.card !== prevCard ? `<div class="dm-cardhead"><a href="#/p/${esc(thread.slug)}/${esc(m.card)}">${esc(m.card)}</a> ${esc(m.title)}</div>` : '';
    return head + `<div class="dm-msg ${m.mine ? 'mine' : ''}"><div class="dm-meta"><b>${esc(m.author)}</b> ${ago(m.at)}</div><div class="dm-bubble">${linkify(m.text || '', thread)}${Attach.shown(m, thread.slug)}</div></div>`;
  }
  async function loadThread(scroll) {
    if (!open) return;
    try { thread = await api('GET', '/api/chats/' + open); } catch { return; }
    const list = el('dmList'); if (!list) return;
    const html = thread.messages.map((m, i) => msgHtml(m, i ? thread.messages[i - 1].card : null)).join('') || '<p class="muted dm-empty">No messages yet. Say hi, or send an idea: the lead turns it into cards.</p>';
    if (list.dataset.sig !== html) {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.dataset.sig = html; list.innerHTML = html;
      if (scroll || atBottom) list.scrollTop = list.scrollHeight;
    }
    const q = thread.open[0];
    el('dmTo').innerHTML = q ? `Replying to <a href="#/p/${esc(thread.slug)}/${esc(q.id)}">${esc(q.id)}</a> ${esc(q.title)}` : `New message to ${esc(thread.lead)}`;
    el('dmGo').hidden = !q;
  }

  function show(slug) {
    open = slug;
    const c = chats.find(x => x.slug === slug) || { slug, name: slug };
    el('dmPanel').innerHTML = `<div class="dm-head">${avatar(c)}<div><b>${esc(c.lead || 'Lead')}</b><div class="muted">${esc(c.name)}</div></div><span style="flex:1"></span><button onclick="Dms.close()" title="Close">✕</button></div>
      <div class="dm-list" id="dmList"></div>
      <div class="dm-compose"><div class="dm-to muted" id="dmTo"></div>
        <textarea id="dmText" rows="2" placeholder="Message… Enter sends, Shift+Enter for a new line" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();Dms.send()}"></textarea>
        <div class="err" id="dmErr"></div>
        <div class="actions"><button class="good" id="dmGo" onclick="Dms.send('GO')" title="Answer the open question with GO">👍 Go</button><button class="primary" onclick="Dms.send()">Send</button>${Attach.boxHtml('dm:' + slug)}</div></div>`;
    el('dmPanel').hidden = false;
    loadRail(); loadThread(true);
    el('dmText').focus();
  }
  function close() { open = null; thread = null; el('dmPanel').hidden = true; el('dmPanel').innerHTML = ''; loadRail(); }

  async function send(fixed) {
    if (busy || !thread) return;
    const key = 'dm:' + thread.slug, text = fixed || el('dmText').value.trim(), q = thread.open[0];
    if (!text && !Attach.has(key)) { el('dmErr').textContent = 'Write something first.'; return; }
    busy = true; el('dmErr').textContent = '';
    try {
      const attachments = fixed ? [] : await Attach.upload(key, thread.slug);
      if (q) await api('POST', `/api/projects/${thread.slug}/cards/${q.id}/comments`, { author: me(), text, attachments });
      else await api('POST', `/api/projects/${thread.slug}/cards`, { title: '💬 ' + text.split('\n')[0].slice(0, 80), description: text, type: 'task', status: 'team', createdBy: me(), quick: true, attachments });
      if (!fixed) { el('dmText').value = ''; Attach.clear(key); }
      await loadThread(true); loadRail();
    } catch (e) { el('dmErr').textContent = e.message || String(e); }
    busy = false;
  }

  document.addEventListener('click', e => { const b = e.target.closest('[data-dm]'); if (b) { if (open === b.dataset.dm) close(); else show(b.dataset.dm); } });
  // Live: the rail every few seconds; an open chat a little more often.
  setInterval(() => { if (!document.hidden) { loadRail(); if (open) loadThread(); } }, 3000);
  loadRail();
  return { show, close, send };
})();
