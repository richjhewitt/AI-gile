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
    const aiList = shown.filter(c => isTest(c) && c.aiCheck && c.aiCheck.result === 'pass');
    if (IB.flick >= aiList.length) IB.flick = aiList.length - 1;
    const bar = aiList.length ? `<button class="ib-tab ${IB.flick >= 0 ? 'on' : ''}" data-flick="1">${esc(t('inbox.ai.tab', { n: aiList.length }))}</button>` : '';
    if (el('ibAiBar').dataset.sig !== bar) { el('ibAiBar').dataset.sig = bar; el('ibAiBar').innerHTML = bar; }
    const flOn = IB.flick >= 0;
    el('ibAi').hidden = !flOn;
    for (const id of ['ibNext', 'ibKinds', 'ibQ', 'ibK', 'ibT', 'ibEmpty', 'ibMore', 'ibOnly']) if (flOn) el(id).hidden = true;
    if (flOn) {
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
    const qs = pick.filter(isQuestion), ks = pick.filter(isTask), ts = pick.filter(isTest).sort((a, b) => aiPassed(b) - aiPassed(a));
    // A link to one question (alerts, the home list) opens its chat.
    if (IB.flashKey) { const f = qs.find(c => keyOf(c) === IB.flashKey); if (f) IB.chat = f.project; }
    IB.paintChats(qs);
    IB.syncList(el('ibK').querySelector('.list'), ks);
    IB.syncList(el('ibT').querySelector('.list'), ts);
    el('ibQ').hidden = !qs.length || (IB.only && IB.only !== 'q'); el('ibK').hidden = !ks.length || (IB.only && IB.only !== 'k'); el('ibT').hidden = !ts.length || (IB.only && IB.only !== 't');
    el('ibOnly').hidden = !IB.only; el('ibOnly').innerHTML = IB.only ? `${esc(t('inbox.only.' + IB.only))} · <a href="#" data-onlyclear>${esc(t('inbox.only.all'))}</a>` : '';
    // Accept all AI-passed (AIG-163): every test the AI tester passed, in one click.
    const passed = ts.filter(c => c.aiCheck && c.aiCheck.result === 'pass');
    // 🤖 Test these for me (AIG-291): tests with steps the AI tester hasn't looked at yet.
    const unchecked = ts.filter(c => c.testSteps && !c.aiCheck).length;
    el('ibTester').hidden = !unchecked && !IB.testerOn; el('ibTester').disabled = IB.testerOn;
    el('ibTester').textContent = IB.testerOn ? t('tester.running') : t('tester.btn', { n: unchecked });
    el('ibAiAll').hidden = !passed.length; el('ibAiAll').title = t('inbox.aiall.title') + ': ' + passed.map(c => c.id).join(', '); el('ibAiAll').textContent = t('inbox.aiall', { n: passed.length });
    el('ibQn').textContent = qs.length; el('ibKn').textContent = ks.length; el('ibTn').textContent = ts.length;
    el('ibMore').hidden = !IB.hidden; el('ibMore').textContent = t('inbox.more', { n: IB.hidden });
    if (IB.hidden && (!IB.only || IB.only === 'q')) el('ibQ').hidden = false;
    if (typeof Share !== 'undefined') Share.paintInbox();   // link offers from friends (AIG-304)
    if (typeof Ask !== 'undefined') Ask.paintInbox();   // friends' questions for my AI (AIG-210)
    el('ibEmpty').innerHTML = IB.items.length || IB.hidden || IB.offers || IB.asks ? '' : `<div class="ib-empty"><div class="big">${esc(t('inbox.empty.title'))}</div><p>${esc(t('inbox.empty.text'))}</p></div>`;
    if (IB.flashKey) {
      const n = [...document.querySelectorAll('.ib-item')].find(x => x.dataset.key === IB.flashKey);
      if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); const t = n.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); IB.flashKey = null; }
    }
  }
  const toast = msg => { const t = el('ibToast'); if (t) t.textContent = msg; };
  Object.assign(IB, { paintPage, toast });
})();
