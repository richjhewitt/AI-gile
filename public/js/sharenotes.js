// 💙 Friendly leaks (AIG-1311): "Davy shared AI-gile with Sam" in the owner's inbox, one note per newcomer, with OK to clear it.
// The board's lib/join.js asks the join service for them (GET /api/join/notes, POST /api/join/notes/seen). Classic script.
const ShareNotes = (function () {
  'use strict';
  let notes = [], sig = '';
  async function load() {
    try { notes = (await api('GET', '/api/join/notes')).notes || []; } catch { return; }
    if (typeof IB !== 'undefined' && IB.setFriends) IB.setFriends('sharenotes', notes.length);
    const s = JSON.stringify(notes);
    if (s === sig) return;
    sig = s;
    paintInbox();
  }
  const when = at => { try { return new Date(at).toLocaleDateString(typeof langCode === 'function' ? langCode() : undefined, { day: 'numeric', month: 'short' }); } catch { return ''; } };
  // Names come from other people's boards: always escaped.
  const itemHtml = n => `<div class="ib-item sn-item" data-sn="${esc(n.id)}"><div class="ib-title">${esc(t('sharenote.line', { friend: n.friend, name: n.name }))}</div>
      <div class="ib-who muted">${esc(when(n.at))}</div>
      <div class="actions"><button type="button" class="sn-ok" onclick="ShareNotes.ok('${esc(n.id)}')" aria-label="${esc(t('sharenote.ok.label', { name: n.name }))}">${esc(t('sharenote.ok'))}</button></div></div>`;
  function paintInbox() {
    const box = document.getElementById('ibShareNotes');
    if (!box) return;
    const html = notes.length ? `<h3>${esc(t('sharenote.h'))} <span class="ib-badge" id="ibSnN">${notes.length}</span>${notes.length > 1 ? ` <button type="button" class="ib-tidy" id="snAll" onclick="ShareNotes.ok('')">${esc(t('sharenote.all'))}</button>` : ''}</h3>${notes.map(itemHtml).join('')}` : '';
    const empty = document.getElementById('ibEmpty');
    if (empty && notes.length) empty.innerHTML = '';
    if (box.dataset.sig === html) return;
    box.dataset.sig = html; box.innerHTML = html; box.hidden = !notes.length;
  }
  async function ok(id) {
    try { notes = (await api('POST', '/api/join/notes/seen', id ? { id } : { all: true })).notes || []; } catch { return; }
    sig = JSON.stringify(notes);
    if (typeof IB !== 'undefined' && IB.setFriends) IB.setFriends('sharenotes', notes.length);
    paintInbox();
  }
  setInterval(() => { if (!document.hidden && typeof i18n !== 'undefined' && i18n.ready) load(); }, 10000);
  setTimeout(() => { if (typeof i18n !== 'undefined' && i18n.ready) load(); }, 1500);
  return { load, paintInbox, ok };
})();
