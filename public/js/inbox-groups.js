// AI-gile inbox: card groups (AIG-386). Cards that share a group and wait for a test show as ONE item with the cards inside.
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
(function () {
  'use strict';
  const { esc, post, isTest, linkify } = IB;
  // Folds the tests of one project + group into a single made-up item; ungrouped tests pass through in place.
  function groupTests(ts) {
    const seen = new Map(), out = [];
    for (const c of ts) {
      if (!c.group) { out.push(c); continue; }
      const k = c.project + '/' + c.group.toLowerCase();
      let g = seen.get(k);
      if (!g) {
        g = { group: true, groupName: c.group, id: 'group:' + c.group, title: c.group, cards: [], project: c.project, projectName: c.projectName, projectColor: c.projectColor,
          projectEmoji: c.projectEmoji, projectLogo: c.projectLogo, status: 'verify', assignee: '', comments: [], updated: c.updated, kind: 'test', bumpedAt: c.bumpedAt };
        seen.set(k, g); out.push(g);
      }
      g.cards.push(c);
      if (c.updated > g.updated) g.updated = c.updated;
      if (c.bumpedAt && !(g.bumpedAt > c.bumpedAt)) g.bumpedAt = c.bumpedAt;
    }
    return out;
  }
  const sigOfGroup = g => g.cards.map(c => [c.id, c.title, c.updated, c.testSteps, c.aiCheck && c.aiCheck.at].join('~')).join('|') + '|' + i18n.lang;
  function gHtml(g) {
    const inner = g.cards.map(c => `<div class="ib-gcard" data-cid="${esc(c.id)}"><a href="#/p/${g.project}/${c.id}"><b>${esc(c.id)}</b> ${esc(c.title)}</a> ${aiChip(c)}
      ${c.testSteps ? `<div class="body">${linkify(c.testSteps, c)}</div>` : `<div class="ib-hint">${esc(t('inbox.g.nosteps'))}</div>`}
      <textarea rows="1" data-draft="${esc(c.project + '/' + c.id)}/gcard" placeholder="${esc(t('inbox.g.ph'))}" aria-label="${esc(t('inbox.g.ph'))} ${esc(c.id)}"></textarea>
      <div class="ib-err"></div>
      <div class="actions"><button class="good" data-act="gcaccept">${esc(t('card.accept'))}</button><button data-act="gcreply">${esc(t('inbox.g.reply'))}</button><button class="warn" data-act="gcback">${esc(t('card.sendback'))}</button></div></div>`).join('');
    return `<div class="ib-top"><span class="ib-tag">${esc(t('inbox.g.tag'))}</span><span class="ib-proj">${pic(g.projectLogo, g.projectEmoji)} ${esc(g.projectName)}</span><span class="ib-id">${esc(t('inbox.g.count', { count: g.cards.length, n: g.cards.length }))}</span><span class="ib-hint">${esc(t('inbox.t.waiting', { when: ago(g.updated, true) }))}</span></div>
      <div class="ib-title">🗂️ ${esc(g.groupName)}</div>
      <details class="ib-steps ib-group" open><summary>${esc(t('inbox.t.how'))}: ${g.cards.map(c => esc(c.id)).join(', ')}</summary>${inner}</details>
      <div class="ib-err"></div>
      <div class="actions"><button class="good" data-act="gaccept">${esc(t('inbox.g.accept', { n: g.cards.length }))}</button><button data-act="gwait" title="${esc(t('inbox.g.wait.title'))}">${esc(t('card.wait'))}</button></div>`;
  }
  // Accept all / Wait and see for the whole group: the same call for each card in it.
  async function groupAct(n, act) {
    const name = n.dataset.group, mine = IB.raw.filter(c => c.project === n.dataset.project && c.group === name && isTest(c) && (act !== 'accept' || !checkLeft(c)));
    n.dataset.sending = '1'; n.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      for (const c of mine) await post('POST', `/api/projects/${c.project}/cards/${c.id}/${act === 'accept' ? 'verdict' : 'snooze'}`, act === 'accept' ? { accept: true } : {});
      IB.toast(t(act === 'accept' ? 'inbox.toast.gaccepted' : 'inbox.toast.ghidden', { name, n: mine.length }));
      n.dataset.sending = ''; await IB.load();
    } catch (e) { n.dataset.sending = ''; n.querySelector('.ib-err').textContent = e.message || String(e); n.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  // One card of a group: Accept, Reply (comment, card stays) or Send back (needs a reason), same calls as a single card.
  async function cardAct(b, act) {
    const n = b.closest('.ib-item'), box = b.closest('.ib-gcard'), id = box.dataset.cid, c = IB.raw.find(x => x.project === n.dataset.project && x.id === id);
    const err = box.querySelector('.ib-err'), ta = box.querySelector('textarea'), text = ta.value.trim(), url = `/api/projects/${n.dataset.project}/cards/${id}`;
    if (!c || box.dataset.sending) return;
    if (act === 'accept' && !acceptSure(b, c)) return;
    if (act !== 'accept' && !text) { err.textContent = t(act === 'back' ? 'verdict.err' : 'dms.empty'); ta.focus(); return; }
    box.dataset.sending = '1'; err.textContent = ''; box.querySelectorAll('button').forEach(x => x.disabled = true);
    try {
      if (act === 'accept') await post('POST', url + '/verdict', { accept: true });
      else if (act === 'back') await post('POST', url + '/verdict', { accept: false, text });
      else await post('POST', url + '/comments', { author: me(), text, attachments: [] });
      ta.value = ''; clearDraft(n.dataset.project + '/' + id + '/gcard');
      IB.toast(t(act === 'accept' ? 'inbox.toast.accepted' : act === 'back' ? 'inbox.toast.sentback' : 'inbox.toast.sent', { id }));
      box.dataset.sending = ''; box.querySelectorAll('button').forEach(x => x.disabled = false);
      await IB.load();
    } catch (e) { box.dataset.sending = ''; err.textContent = e.message || String(e); box.querySelectorAll('button').forEach(x => x.disabled = false); }
  }
  Object.assign(IB, { groupTests, sigOfGroup, gHtml, groupAct, cardAct });
})();
