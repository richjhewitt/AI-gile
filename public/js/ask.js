// 🙋 Ask a mate (AIG-210, lib/ask.js): friends' questions for my AI wait in the inbox with ✅ Ask it / ✋ Not now and a
// rough size. Nothing runs until I click ✅; then one short, capped run answers and the answer goes back in our DM.
// Classic script; talks to /api/dms/asks.
const Ask = (function () {
  'use strict';
  let asks = [], sig = '';
  const off = () => typeof NoTokens !== 'undefined' && NoTokens.on;   // ⛔ No Token Mode (AIG-383)

  async function load() {
    try { asks = (await PagePoll.get('/api/dms/asks')).asks || []; } catch { return; }
    if (typeof IB !== 'undefined') IB.setFriends('asks', asks.length);   // counted in the inbox and its badges (AIG-382)
    const s = JSON.stringify([asks, off()]);
    if (s === sig) return;
    sig = s;
    paintInbox();
  }
  // The question is a friend's text: shown escaped, links not clickable.
  function itemHtml(a) {
    const key = a.contact + '/' + a.id, running = a.state === 'running';
    return `<div class="ib-item ask-item" data-ask="${esc(key)}">
      <div class="ib-top"><span class="ib-tag">${esc(t('ask.inbox.tag'))}</span><span class="ib-proj">${esc(a.name)}</span> <span class="muted">${ago(a.at)}</span></div>
      <div class="ib-title">${esc(t('ask.inbox.title', { name: a.name }))}</div>
      <div class="ask-q">${esc(a.text)}</div>
      <div class="ib-who ask-size">${esc(t('ask.size', { size: t('ask.size.' + a.size), n: a.words }))}</div>
      ${a.failed ? `<div class="ib-err">${esc(t('ask.failed', { why: a.failed }))}</div>` : ''}
      <div class="ib-err" data-ask-err></div>
      ${off() && !running ? `<div class="ib-err ask-off">${esc(t('ask.off'))}</div>` : ''}
      <div class="actions">${running ? `<button disabled>${esc(t('ask.running'))}</button>`
        : `${off() ? '' : `<button class="good" data-ask-yes onclick="Ask.yes('${esc(key)}')">${esc(t('ask.yes'))}</button>`}<button data-ask-no onclick="Ask.no('${esc(key)}')">${esc(t('ask.no'))}</button>`}</div></div>`;
  }
  function paintInbox() {
    const box = document.getElementById('ibAsk');
    if (!box) return;
    const html = asks.length ? `<h3>${esc(t('ask.inbox.h'))} <span class="ib-badge">${asks.length}</span></h3>${asks.map(itemHtml).join('')}` : '';
    const empty = document.getElementById('ibEmpty');
    if (empty && asks.length) empty.innerHTML = '';
    if (box.dataset.sig === html) return;
    box.dataset.sig = html; box.innerHTML = html; box.hidden = !asks.length;
  }
  async function act(key, what) {
    const item = document.querySelector(`[data-ask="${key}"]`);
    item && item.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { await api('POST', `/api/dms/asks/${key}/${what}`); sig = ''; await load(); }
    catch (e) { const x = item && item.querySelector('[data-ask-err]'); if (x) x.textContent = e.message; item && item.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  const yes = key => act(key, 'yes');
  const no = key => act(key, 'no');

  PagePoll.every(() => { if (typeof i18n !== 'undefined' && i18n.ready) return load(); }, 3000, { hidden: 30000 });
  return { load, paintInbox, yes, no };
})();
