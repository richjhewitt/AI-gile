// AI-gile inbox: paintPage: lays out the inbox page from the shared state.
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
(function () {
  'use strict';
  const { el, esc, isTask, isQuestion, isTest, keyOf } = IB;
  function paintPage() {
    if (!el('ib')) IB.skeleton();
    IB.paintTabs();
    // All tab: items grouped by project, in tab order, each group still longest-waiting first (AIG-86).
    // A popped-out list (AIG-104) shows only its own kind, in a window of its own.
    const popList = typeof state !== 'undefined' && state.route && state.route.popList;
    document.body.classList.toggle('poplist', !!popList);
    if (popList) { IB.only = popList; IB.flick = -1; }
    const shown = IB.tab === 'all' ? [...IB.items].sort((a, b) => IB.tabOrder.indexOf(a.project) - IB.tabOrder.indexOf(b.project)) : IB.items.filter(c => c.project === IB.tab);
    // 🤖 AI passed (AIG-192): its own view, one test at a time; the rest of the inbox steps aside while it's open.
    // AIG-781: with "AI-passed tests in their own list" on, they leave the tests list and live only here, with their own Accept all.
    const own = aiOwn();
    const aiList = shown.filter(c => isTest(c) && c.aiCheck && c.aiCheck.result === 'pass');
    if (IB.flick >= aiList.length) IB.flick = aiList.length - 1;
    const bar = aiList.length ? `<button class="ib-tab ${IB.flick >= 0 ? 'on' : ''}" data-flick="1">${esc(t('inbox.ai.tab', { n: aiList.length }))}</button>`
      + (own && IB.flick < 0 ? ` <button class="good ib-aiall" data-aiall="1" title="${esc(t('inbox.aiall.title'))}" aria-label="${esc(t('inbox.aiall.title'))}">${esc(t('inbox.aiall', { n: aiList.length }))}</button>` : '') : '';
    if (el('ibAiBar').dataset.sig !== bar) { el('ibAiBar').dataset.sig = bar; el('ibAiBar').innerHTML = bar; }
    // ⚡ Decide (AIG-361): the open answer-button questions and Topics, one at a time.
    const dcList = decideList(shown);
    if (IB.decide >= dcList.length) IB.decide = dcList.length - 1;
    const dcOn = IB.decide >= 0;
    el('ibDc').hidden = !dcOn;
    const flOn = IB.flick >= 0 || dcOn;
    el('ibAi').hidden = IB.flick < 0 || dcOn;
    for (const id of ['ibNext', 'ibKinds', 'ibQ', 'ibK', 'ibT', 'ibEmpty', 'ibMore', 'ibOnly']) if (flOn) el(id).hidden = true;
    if (dcOn) {
      const cur = dcList[IB.decide], html = decideHtml(cur, IB.decide, dcList.length);
      if (el('ibDc').dataset.sig !== html) { el('ibDc').dataset.sig = html; el('ibDc').innerHTML = html; }
      return;
    }
    if (IB.flick >= 0) {
      const cur = aiList[IB.flick], html = aiFlickHtml(cur, IB.flick, aiList.length);
      if (el('ibAi').dataset.sig !== html) { el('ibAi').dataset.sig = html; el('ibAi').dataset.key = keyOf(cur); el('ibAi').innerHTML = html; }
      return;
    }
    el('ibNext').hidden = false; el('ibKinds').hidden = false; el('ibEmpty').hidden = false;
    // Your queue (AIG-159..162): filter by kind, sort by your priority / what it holds up / time, and pick Next up.
    paintQueue(shown, IB.kindFilter);
    const pick = shown.filter(c => !IB.kindFilter || kindOfItem(c) === IB.kindFilter).sort(queueRank);
    // Tests the AI tester passed come first, so Accept all AI-passed matches what you see at the top (AIG-196).
    const aiPassed = c => !!(c.aiCheck && c.aiCheck.result === 'pass');
    const qs = pick.filter(isQuestion), ks = pick.filter(isTask).sort((a, b) => (!!b.server * 2 + !!b.outside) - (!!a.server * 2 + !!a.outside) || !!a.lifeType - !!b.lifeType), ts = pick.filter(c => isTest(c) && !(own && aiPassed(c))).sort((a, b) => aiPassed(b) - aiPassed(a));
    // A link to one question (alerts, the home list) opens its chat.
    if (IB.flashKey) { const f = qs.find(c => keyOf(c) === IB.flashKey); if (f) IB.chat = f.project; }
    IB.paintChats(qs);
    IB.syncList(el('ibK').querySelector('.list'), ks);
    const tsg = IB.groupTests(ts);
    IB.syncList(el('ibT').querySelector('.list'), tsg);
    el('ibQ').hidden = !qs.length || (IB.only && IB.only !== 'q'); el('ibK').hidden = !ks.length || (IB.only && IB.only !== 'k'); el('ibT').hidden = !ts.length || (IB.only && IB.only !== 't');
    el('ibOnly').hidden = !IB.only; el('ibOnly').innerHTML = IB.only ? `${esc(t('inbox.only.' + IB.only))} · <a href="#" data-onlyclear>${esc(t('inbox.only.all'))}</a>` : '';
    // Accept all AI-passed (AIG-163): every test the AI tester passed, in one click.
    const passed = ts.filter(c => c.aiCheck && c.aiCheck.result === 'pass');
    // 🤖 Test these for me (AIG-291): tests with steps the AI tester hasn't looked at yet.
    const unchecked = ts.filter(c => c.testSteps && !c.info && !c.aiCheck).length;
    el('ibTester').hidden = !unchecked && !IB.testerOn; el('ibTester').disabled = IB.testerOn;
    el('ibTester').textContent = IB.testerOn ? t('tester.running') : t('tester.btn', { n: unchecked });
    el('ibAiAll').hidden = !passed.length; el('ibAiAll').title = t('inbox.aiall.title') + ': ' + passed.map(c => c.id).join(', '); el('ibAiAll').textContent = t('inbox.aiall', { n: passed.length });
    el('ibQn').textContent = qs.length; el('ibKn').textContent = ks.length; el('ibTn').textContent = tsg.length;
    el('ibMore').hidden = !IB.hidden; el('ibMore').textContent = t('inbox.more', { n: IB.hidden });
    if (IB.hidden && (!IB.only || IB.only === 'q')) el('ibQ').hidden = false;
    if (typeof Share !== 'undefined') Share.paintInbox();   // link offers from friends (AIG-304)
    if (typeof Approvals !== 'undefined') Approvals.paintInbox();   // cards waiting for my OK (AIG-815)
    if (typeof Ask !== 'undefined') Ask.paintInbox();   // friends' questions for my AI (AIG-210)
    if (typeof ShareNotes !== 'undefined') ShareNotes.paintInbox();   // "Davy shared AI-gile with Sam" (AIG-1311)
    el('ibEmpty').innerHTML = IB.items.length || IB.hidden || IB.offers || IB.asks || IB.approvals || IB.sharenotes ? '' : `<div class="ib-empty"><div class="big">${esc(t('inbox.empty.title'))}</div><p>${esc(t('inbox.empty.text'))}</p></div>`;
    if (IB.flashKey) {
      const n = [...document.querySelectorAll('.ib-item')].find(x => x.dataset.key === IB.flashKey);
      if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); const t = n.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); IB.flashKey = null; }
    }
  }
  const toast = msg => { const t = el('ibToast'); if (t) t.textContent = msg; else if (typeof note === 'function') note(msg); };
  // Setup switch (AIG-781), off by default.
  const aiOwn = () => { try { return localStorage.getItem('aigile.aiOwnList') === '1'; } catch { return false; } };
  const setAiOwn = on => { try { on ? localStorage.setItem('aigile.aiOwnList', '1') : localStorage.removeItem('aigile.aiOwnList'); } catch {} };
  Object.assign(IB, { paintPage, toast, aiOwn, setAiOwn });
})();
