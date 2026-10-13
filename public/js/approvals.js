// ✅ Approvals (AIG-814, AIG-815): cards a friend raised on a project with Approvals on wait here for my OK, across projects,
// with ✅ Approve (it becomes To do) and ✋ Decline (asks for a short note the friend sees). Nothing shows when none wait.
// Classic script; talks to /api/shares-approvals and /api/shares/:link/inbound/:card/approve|decline.
const Approvals = (function () {
  'use strict';
  let cards = [], sig = '';

  async function load() {
    try { cards = (await api('GET', '/api/shares-approvals')).cards || []; } catch { return; }
    if (typeof IB !== 'undefined') IB.setFriends('approvals', cards.length);   // counted in the inbox and its badges
    const s = JSON.stringify(cards);
    if (s === sig) return;
    sig = s;
    paintInbox();
  }
  const keyOf = c => c.link + '/' + c.share;
  // The card is a friend's text: shown escaped, links not clickable.
  function itemHtml(c) {
    const key = keyOf(c);
    return `<div class="ib-item appr-item" data-appr="${esc(key)}">
      <div class="ib-top"><span class="ib-tag">${esc(t(c.req === 'custom' ? 'featreq.tag.custom' : c.req ? 'featreq.tag' : 'approvals.tag'))}</span><span class="ib-proj">${esc(c.projectName)}</span> <span class="muted">${esc(t('approvals.from', { name: c.friend }))}</span></div>
      <div class="ib-title">${esc(c.title)}</div>
      ${c.description ? `<div class="ask-q">${esc(c.description)}</div>` : ''}
      <div class="ib-who">${esc(c.type)} · ${esc(c.priority)}</div>
      <textarea class="appr-note" data-appr-note rows="2" hidden placeholder="${esc(t('approvals.note.ph', { name: c.friend }))}" aria-label="${esc(t('approvals.note.ph', { name: c.friend }))}"></textarea>
      <div class="ib-err" data-appr-err></div>
      <div class="actions"><button class="good" data-appr-yes onclick="Approvals.yes('${esc(key)}')">${esc(t('approvals.yes'))}</button>
        <button data-appr-no onclick="Approvals.no('${esc(key)}')">${esc(t('approvals.no'))}</button></div></div>`;
  }
  function paintInbox() {
    const box = document.getElementById('ibApprovals');
    if (!box) return;
    const html = cards.length ? `<h3>${esc(t('approvals.h'))} <span class="ib-badge" id="ibApprN">${cards.length}</span></h3>${cards.map(itemHtml).join('')}` : '';
    const empty = document.getElementById('ibEmpty');
    if (empty && cards.length) empty.innerHTML = '';
    if (box.dataset.sig === html) return;
    if (box.contains(document.activeElement) && document.activeElement.matches('textarea')) return;   // don't repaint under a note being typed
    box.dataset.sig = html; box.innerHTML = html; box.hidden = !cards.length;
  }
  const node = key => document.querySelector(`[data-appr="${key}"]`);
  async function act(key, what, body) {
    const item = node(key), err = item && item.querySelector('[data-appr-err]');
    item && item.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const [lk, id] = key.split('/'), url = lk.startsWith('chg~') ? `/api/projects/${lk.slice(4)}/changes/${id}/vote` : `/api/shares/${lk}/inbound/${id}/${what}`;   // AIG-858: a change card here is my go / no go
    if (lk.startsWith('chg~')) body = { go: what === 'approve', note: (body || {}).note || '' };
    try { await api('POST', url, body); sig = ''; await load(); }
    catch (e) { if (err) err.textContent = e.message; item && item.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  const yes = key => act(key, 'approve');
  // Decline: the first click opens the note box, the second sends it.
  function no(key) {
    const item = node(key), box = item && item.querySelector('[data-appr-note]'), err = item && item.querySelector('[data-appr-err]');
    if (!box) return;
    if (box.hidden) { box.hidden = false; box.focus(); return; }
    const note = box.value.trim();
    if (!note) { if (err) err.textContent = t('approvals.note.need'); box.focus(); return; }
    act(key, 'decline', { note });
  }

  setInterval(() => { if (!document.hidden && typeof i18n !== 'undefined' && i18n.ready) load(); }, 3000);
  return { load, paintInbox, yes, no };
})();
