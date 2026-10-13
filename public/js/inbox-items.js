// AI-gile inbox: the question, task and test items, the page skeleton and the list sync (AIG-33).
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
(function () {
  'use strict';
  const { el, esc, isTest, kindOf, lastAsk, shownAsk, earlier, keyOf, linkify } = IB;
  /* ---------- inbox page (AIG-33) ---------- */
  function qHtml(c) {
    const a = shownAsk(c), acts = c.blocked || c.leadChat ? [] : askActions(a, 'question');
    return `<div class="ib-top"><span class="ib-tag">${esc(c.blocked ? t('inbox.q.blocked') : t('inbox.q.question'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span>${urgentBtn(c, c.project)}<button class="ib-popone" data-popcard title="${esc(t('inbox.popone'))}">⤢</button></div>${queueChips(c)}
      <div class="ib-title">${c.leadChat ? `<a href="#" onclick="Dms.show('${c.project}'); return false">${esc(c.title)}</a>` : `<a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a>`}</div>
      <div class="ib-who">${t(c.blocked ? 'inbox.q.isblocked.html' : 'inbox.q.asked.html', { who: esc(a.author), when: ago(a.at) })}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>${Attach.shown(a, c.project)}${actionsHtml(acts, c.project, c.id)}
      <textarea rows="2" data-draft="${esc(c.project + '/' + c.id)}/reply" placeholder="${esc(t('inbox.q.ph'))}" aria-label="${esc(t('inbox.q.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions">${c.blocked || acts.length || c.leadChat ? '' : `<button class="good" data-act="go" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>`}<button class="primary" data-act="send">${esc(t('inbox.q.send'))}</button>${c.leadChat ? '' : `<button data-act="wait" title="${esc(t('inbox.later.title'))}">${esc(t('inbox.later'))}</button>`}${Attach.boxHtml(c.project + '/' + c.id)}<span class="ib-hint">${esc(t('inbox.q.hint'))}</span></div>`;
  }
  function kHtml(c) {
    const a = shownAsk(c);
    return `<div class="ib-top"><span class="ib-tag">${c.lifeType ? '🏡 ' + esc(t('queue.kind.life')) : esc(t('inbox.k.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span>${urgentBtn(c, c.project)}<button class="ib-popone" data-popcard title="${esc(t('inbox.popone'))}">⤢</button></div>${queueChips(c)}
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-who">${t('inbox.k.asked.html', { who: esc(a.author), when: ago(a.at) })}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>${Attach.shown(a, c.project)}${(e => e ? `<details class="ib-steps"><summary>${esc(t('inbox.k.earlier'))}</summary><div class="body">${linkify(e.text, c)}</div></details>` : '')(earlier(c))}
      <textarea rows="1" data-draft="${esc(c.project + '/' + c.id)}/task" placeholder="${esc(t('inbox.k.ph'))}" aria-label="${esc(t('inbox.k.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions">${c.lifeType ? `<button class="good" data-act="lifedone" title="${esc(t('life.done.title'))}">✅ ${esc(t('life.done'))}</button>` : ''}<button class="good" data-act="taskdone">${esc(t(c.lifeType ? 'inbox.k.done.tell' : 'inbox.k.done'))}</button><button data-act="wait" title="${esc(t('inbox.t.wait.title'))}">${esc(t('life.snooze'))}</button>${c.lifeType ? `<button class="primary" data-act="letsgo" title="${esc(t('life.letsgo.title'))}">${esc(t('life.letsgo'))}</button>` : ''}${Attach.boxHtml(c.project + '/' + c.id)}<span class="ib-hint">${esc(t('inbox.k.hint'))}</span></div>`;
  }
  // 📖 To read (AIG-392): nothing to click. 👍 Got it accepts; 💬 Reply sends a note to the team and keeps the card here.
  function rHtml(c) {
    return `<div class="ib-top"><span class="ib-tag">${esc(t('info.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span>${urgentBtn(c, c.project)}<button class="ib-popone" data-popcard title="${esc(t('inbox.popone'))}">⤢</button><span class="ib-hint">${esc(t('inbox.t.waiting', { when: ago(c.updated, true) }))}</span></div>
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-question">${linkify(c.testSteps || '', c)}</div>
      <textarea rows="1" data-draft="${esc(c.project + '/' + c.id)}/info" placeholder="${esc(t('info.ph'))}" aria-label="${esc(t('info.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions"><button class="good" data-act="gotit">${esc(t('info.gotit'))}</button><button data-act="inforeply" title="${esc(t('info.reply.title'))}">${esc(t('info.reply'))}</button>${Attach.boxHtml(c.project + '/' + c.id)}</div>`;
  }
  function tHtml(c) {
    if (c.info) return rHtml(c);
    return `<div class="ib-top"><span class="ib-tag">${esc(t('inbox.t.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span>${aiChip(c)}${checkChip(c)}${urgentBtn(c, c.project)}<button class="ib-popone" data-popcard title="${esc(t('inbox.popone'))}">⤢</button><span class="ib-hint">${esc(t('inbox.t.waiting', { when: ago(c.updated, true) }))}</span></div>
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      ${aiEvidence(c, c.project)}
      ${c.testSteps ? `<details class="ib-steps"><summary>${esc(t('inbox.t.how'))}</summary><div class="body">${linkify(c.testSteps, c)}</div></details>` : `<div class="ib-hint">${esc(t('inbox.t.nosteps'))}</div>`}
      <div class="ib-err"></div>
      <div class="actions">${c.openUrl ? `<button class="primary" data-act="open" data-cmd="${esc(c.startCmd || '')}" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button>` : ''}<button class="good" data-act="accept">${esc(t('card.accept'))}</button><button data-act="wait" title="${esc(t('inbox.t.wait.title'))}">${esc(t('card.wait'))}</button>
      <a href="#/p/${c.project}/${c.id}" class="ib-hint" style="text-decoration:underline">${esc(t('inbox.t.sendback'))}</a></div>`;
  }
  const checkSig = c => (c.checklist || []).map(x => x.done ? 1 : 0).join('');
  // A folded group of tests is the made-up item from inbox-groups.js (group: true); a question or task card can carry a group name too.
  const isGroup = c => c.group === true;
  const sigOf = c => isGroup(c) ? IB.sigOfGroup(c) : !isTest(c) ?[c.title, c.blocked, c.server, c.serverName, (state.servers || []).join(","), shownAsk(c).at, shownAsk(c).text, checkSig(c), i18n.lang].join('|') : [c.title, c.updated, c.testSteps, c.info, c.aiCheck && c.aiCheck.at, checkSig(c), i18n.lang].join('|');

  function skeleton() {
    el('app').innerHTML = `<div class="ib" id="ib">
      <div class="ib-head"><h2>${esc(t('inbox.h'))}</h2><span class="ib-hint">${esc(t('inbox.sub'))}</span> <a class="ib-bin" id="ibBin" href="#/bin" title="${esc(t('bin.link.title'))}" style="font-size:.85em;white-space:nowrap">${esc(t('bin.link', { n: 0 }))}</a></div>
      <div class="ib-tabs" id="ibTabs" role="tablist"></div>
      <div class="ib-next" id="ibNext"></div>
      <div class="ib-kinds" id="ibKinds"></div>
      <div class="ib-only" id="ibOnly" hidden></div>
      <div class="ib-aibar" id="ibAiBar"></div>
      <section class="ib-sec ib-fl" id="ibAi" hidden></section>
      <section class="ib-sec ib-fl ib-dc" id="ibDc" hidden></section>
      <div class="ib-toast" id="ibToast" role="status" aria-live="polite"></div>
      <section class="ib-sec share" id="ibShare" hidden></section>
      <section class="ib-sec ask" id="ibAsk" hidden></section>
      <section class="ib-sec appr" id="ibApprovals" hidden></section>
      <section class="ib-sec ib-td" id="ibTd" hidden></section>
      <div id="ibEmpty"></div>
      <section class="ib-sec q" id="ibQ"><h3><button class="ib-popbtn" data-poplist="q" title="${esc(t('inbox.popout'))}">⧉</button>${esc(t('inbox.messages'))} <span class="ib-badge q" id="ibQn"></span></h3><div class="ib-chat"><div class="ib-chats" id="ibChats"></div><div class="list ib-thread"></div></div><div class="ib-hint" id="ibMore" hidden></div></section>
      <section class="ib-sec k" id="ibK"><h3><button class="ib-popbtn" data-poplist="k" title="${esc(t('inbox.popout'))}">⧉</button>${esc(t('inbox.tasks'))} <span class="ib-badge k" id="ibKn"></span><span class="ib-hint" style="font-weight:400">${esc(t('inbox.tasks.sub'))}</span></h3><div class="list"></div></section>
      <section class="ib-sec t" id="ibT"><h3><button class="ib-popbtn" data-poplist="t" title="${esc(t('inbox.popout'))}">⧉</button>${esc(t('inbox.t.tag'))} <span class="ib-badge t" id="ibTn"></span><span class="ib-hint" style="font-weight:400">${esc(t('inbox.t.sub'))}</span><button class="ib-tidy" id="ibTidy" title="${esc(t('tidy.title'))}">🧹 ${esc(t('tidy.btn'))}</button><button class="ib-tidy" id="ibTester" hidden title="${esc(t('tester.title'))}"></button><button class="good ib-aiall" id="ibAiAll" hidden title="${esc(t('inbox.aiall.title'))}"></button></h3><div class="list"></div></section>
    </div>`;
    if (typeof Bin !== 'undefined') Bin.paintLink();   // AIG-840
    el('ib').addEventListener('click', IB.onClick);
    el('ib').addEventListener('keydown', IB.onKey);
  }

  // Swap only what sits above the reply box; the box, its error line and its buttons keep their text and focus.
  function refreshAbove(n, c) {
    const ta = n.querySelector('textarea'), kind = kindOf(c); if (!ta || kind === 't') return;
    const tmp = document.createElement('div'); tmp.innerHTML = kind === 'q' ? qHtml(c) : kHtml(c);
    const nta = tmp.querySelector('textarea'); if (!nta) return;
    while (n.firstChild && n.firstChild !== ta) n.firstChild.remove();
    while (tmp.firstChild && tmp.firstChild !== nta) n.insertBefore(tmp.firstChild, ta);
    n.dataset.sig = sigOf(c); n.className = 'ib-item ' + kind + (kind === 'q' && c.blocked ? ' blk' : '');
  }
  // Keeps existing item elements (and whatever is typed in them) and only adds, removes or updates the rest.
  // A reply box that is focused or holds text is never touched, so the 1s poll can't wipe it.
  function syncList(list, data) {
    const have = new Map([...list.children].map(n => [n.dataset.key, n]));
    const want = new Set(data.map(keyOf));
    for (const [k, n] of have) if (!want.has(k) && !n.dataset.sending) { n.remove(); have.delete(k); }
    data.forEach((c, i) => {
      const k = keyOf(c), sig = sigOf(c);
      let n = have.get(k);
      const typing = n && [...n.querySelectorAll('textarea')].some(t => t.value || t === document.activeElement);
      if (n && n.dataset.sig !== sig && typing) refreshAbove(n, c);   // a newer message shows even under a half-typed reply (AIG-314)
      if (n && n.dataset.sig !== sig && !typing) { n.remove(); n = null; }
      if (!n) {
        n = document.createElement('div');
        const kind = kindOf(c);
        n.className = 'ib-item ' + kind + (kind === 'q' && c.blocked ? ' blk' : '');
        if (isGroup(c)) n.dataset.group = c.groupName;
        n.dataset.key = k; n.dataset.sig = sig; n.dataset.project = c.project; n.dataset.id = c.id;
        if (c.projectColor) n.style.setProperty('--proj', c.projectColor);   // project stripe and badge (AIG-86)
        n.innerHTML = kind === 'q' ? qHtml(c) : kind === 'k' ? kHtml(c) : isGroup(c) ? IB.gHtml(c) : tHtml(c);
      }
      if (list.children[i] !== n) list.insertBefore(n, list.children[i] || null);
    });
  }
  // One item's html by kind, for the For you fold window (AIG-738).
  const itemHtml = c => { const k = kindOf(c); return k === 'q' ? qHtml(c) : k === 'k' ? kHtml(c) : tHtml(c); };
  Object.assign(IB, { skeleton, syncList, itemHtml });
})();
