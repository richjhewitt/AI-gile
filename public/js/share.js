// Sharing a project with a friend (AIG-304, docs/SHARING-DESIGN.md): the board's 🔗 button and dialog
// (offer, the switch, check the link, unlink), and link offers in the inbox (✅ Link to... / ✋ No).
// Classic script; talks to /api/shares and /api/dms/contacts.
const Share = (function () {
  'use strict';
  let links = [], people = [], projects = [], sig = '';
  const ALLOW = ['send', 'take', 'comments', 'status', 'files', 'teamRead'];
  const DEFAULT = { send: true, take: true, comments: true, status: false, files: false, teamRead: false };
  const open = l => ['offered', 'incoming', 'live'].includes(l.state) && !l.expired;
  const ofProject = s => links.find(l => l.slug === s && open(l)) || links.find(l => l.slug === s && l.state === 'ended' && !l.forgotten && l.endedBy !== 'declined');
  const offers = () => links.filter(l => l.state === 'incoming' && !l.expired);

  async function load() {
    try {
      [links, people] = await Promise.all([api('GET', '/api/shares'), api('GET', '/api/dms/contacts')]);
      projects = offers().length ? await api('GET', '/api/projects') : [];   // only an offer needs the project list
    } catch { return; }
    const s = JSON.stringify([links, people.map(p => [p.id, p.name, p.checked, p.blocked]), projects.map(p => [p.slug, p.name])]);
    if (s === sig) return;
    sig = s;
    if (typeof state !== 'undefined' && state.route && state.route.view === 'project' && !busy()) renderBoardOnly();
    paintInbox();
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
  return { load, button, dialog, offer, setOn, ping, unlink, markChecked, paintInbox, acceptOffer, declineOffer, offers };
})();
