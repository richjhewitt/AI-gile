// AI-gile inbox: what the buttons do: send, task done, accept, wait, tester, AI-passed view.
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
(function () {
  'use strict';
  const { el, post, isTest, keyOf } = IB;
  const base = n => `/api/projects/${n.dataset.project}/cards/${n.dataset.id}`;
  const fail = (n, e) => { n.querySelector('.ib-err').textContent = e.message || String(e); n.dataset.sending = ''; n.querySelectorAll('button').forEach(b => b.disabled = false); };
  const lock = n => { n.dataset.sending = '1'; n.querySelector('.ib-err').textContent = ''; n.querySelectorAll('button').forEach(b => b.disabled = true); };
  const done = (n, msg) => { n.remove(); IB.raw = IB.raw.filter(c => keyOf(c) !== n.dataset.key); IB.items = IB.view(); IB.paintTop(); IB.paintPage(); IB.toast(msg); IB.load().catch(() => {}); };

  // fixed: a one-tap answer (👍 Go, AIG-75) instead of the typed one.
  async function send(n, fixed) {
    if (n.dataset.sending) return;
    const ta = n.querySelector('textarea'), text = fixed || ta.value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    if (!text && !Attach.has(key)) { n.querySelector('.ib-err').textContent = t('dms.empty'); return; }
    lock(n);
    try {
      const attachments = fixed ? [] : await Attach.upload(key, n.dataset.project);
      await post('POST', n.dataset.id === 'chat' ? `/api/projects/${n.dataset.project}/leadchat` : base(n) + '/comments', { author: me(), text, attachments });   // 'chat': the card-free Lead chat (AIG-872)
      if (!fixed) Attach.clear(key);
      clearDraft(key + '/reply');
      done(n, t('inbox.toast.sent', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  async function taskDone(n) {
    if (n.dataset.sending) return;
    const text = n.querySelector('textarea').value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    lock(n);
    try {
      const attachments = await Attach.upload(key, n.dataset.project);
      await post('POST', base(n) + '/taskdone', { text, attachments });
      Attach.clear(key);
      clearDraft(key + '/task');
      done(n, t('inbox.toast.done', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  // 🏡 Real life (AIG-394): one click, quiet: ticked done, nobody told.
  async function lifeDone(n) {
    if (n.dataset.sending) return;
    lock(n);
    try { await post('POST', base(n) + '/lifedone'); done(n, t('life.toast.done', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  async function accept(n) {
    lock(n);
    try { await post('POST', base(n) + '/verdict', { accept: true }); done(n, t('inbox.toast.accepted', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  // 📖 To read (AIG-392): Got it accepts; Reply sends the note to the team and the card stays.
  async function gotIt(n) {
    lock(n);
    try { await post('POST', base(n) + '/verdict', { accept: true }); done(n, t('info.toast.gotit', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  async function infoReply(n) {
    if (n.dataset.sending) return;
    const ta = n.querySelector('textarea'), text = ta.value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    if (!text && !Attach.has(key)) { n.querySelector('.ib-err').textContent = t('info.err'); ta.focus(); return; }
    lock(n);
    try {
      const attachments = await Attach.upload(key, n.dataset.project);
      await post('POST', base(n) + '/verdict', { reply: true, text, attachments });
      Attach.clear(key); clearDraft(key + '/info'); ta.value = '';
      n.dataset.sending = ''; n.querySelectorAll('button').forEach(b => b.disabled = false);
      n.querySelector('.ib-err').textContent = ''; IB.toast(t('info.toast.replied', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  // Start the AI tester, then look every 10 s until it is done; its verdicts arrive as 🤖 chips (AIG-291).
  async function startTester() {
    try { await post('POST', '/api/tester', {}); } catch (e) { IB.toast(e.message || String(e)); return; }
    IB.testerOn = true; IB.toast(t('tester.started')); IB.paintPage();
    const look = async () => { let st = null; try { st = await (await fetch('/api/tester')).json(); } catch {} if (st && st.running) return void setTimeout(look, 10e3); IB.testerOn = false; await IB.load(); IB.paintPage(); };
    setTimeout(look, 10e3);
  }
  async function acceptAiPassed(btn) {
    const list = IB.items.filter(c => isTest(c) && !checkLeft(c) && c.aiCheck && c.aiCheck.result === 'pass' && (IB.tab === 'all' || c.project === IB.tab));
    btn.disabled = true; let n = 0;
    for (const c of list) { try { await post('POST', `/api/projects/${c.project}/cards/${c.id}/verdict`, { accept: true }); n++; } catch {} }
    btn.disabled = false; IB.toast(t('inbox.toast.aiall', { n })); await IB.load(); IB.paintPage();
  }
  // The 🤖 view's buttons and keys (AIG-192): accept or send back the one shown, then the next slides in.
  async function flickAct(act) {
    const shown = IB.tab === 'all' ? IB.items : IB.items.filter(c => c.project === IB.tab);
    const list = shown.filter(c => isTest(c) && c.aiCheck && c.aiCheck.result === 'pass'), n = list.length, cur = list[IB.flick];
    if (act === 'exit' || !cur) { IB.flick = -1; IB.paintPage(); return; }
    if (act === 'next' || act === 'prev') { IB.flick = (IB.flick + (act === 'next' ? 1 : -1) + n) % n; IB.paintPage(); return; }
    if (act === 'accept' && !acceptSure(document.querySelector('#ibAi [data-fl=accept]'), cur)) return;
    const text = el('flText').value.trim();
    if (act === 'back' && !text) { el('flErr').textContent = t('verdict.err'); el('flText').focus(); return; }
    el('ibAi').querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      await post('POST', `/api/projects/${cur.project}/cards/${cur.id}/verdict`, act === 'accept' ? { accept: true } : { accept: false, text });
      IB.toast(t(act === 'accept' ? 'inbox.toast.accepted' : 'inbox.toast.sentback', { id: cur.id }));
      el('ibAi').dataset.sig = '';
      await IB.load(); IB.paintPage();
    } catch (err) { el('flErr').textContent = err.message || String(err); el('ibAi').querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  document.addEventListener('keydown', e => {
    if (IB.flick < 0 || !el('ibAi') || el('ibAi').hidden || /TEXTAREA|INPUT|SELECT/.test(e.target.tagName)) return;
    if (arrowStep(e) > 0) flickAct('next'); else if (arrowStep(e) < 0) flickAct('prev'); else if (e.key === 'a' || e.key === 'A') flickAct('accept'); else if (e.key === 'Escape') flickAct('exit');
  });
  async function waitAndSee(n) {
    lock(n);
    try { await post('POST', base(n) + '/snooze'); n.dataset.sending = ''; await IB.load(); IB.toast(t('inbox.toast.hidden', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  // ✅ Done by the tester (AIG-467): what the AI tester closed today, each with a one-click Reopen back to verify.
  let tdSig = "";
  async function testerDone() {
    if (!el("ibTd")) return;
    let list = []; try { list = await (await fetch("/api/tester/done", { cache: "no-store" })).json(); } catch { return; }
    list = list.filter(x => IB.tab === "all" || x.project === IB.tab);
    const html = list.length ? `<h3>${IB.esc(t("trust.done.h"))} <span class="ib-badge t">${list.length}</span></h3>` + list.map(x => `<div class="ib-td-row" data-project="${IB.esc(x.project)}" data-id="${IB.esc(x.id)}"><a href="#/p/${IB.esc(x.project)}/${IB.esc(x.id)}">${IB.esc(x.id)}</a> ${IB.esc(x.title)} <span class="muted">${IB.esc(t(x.sure ? "trust.is.sure" : "trust.is.likely"))}</span> <button data-tdreopen>${IB.esc(t("trust.reopen"))}</button></div>`).join("") : "";
    if (tdSig === html) return; tdSig = html; el("ibTd").hidden = !html; el("ibTd").innerHTML = html;
  }
  async function reopenTested(row) {
    row.querySelectorAll("button").forEach(b => b.disabled = true);
    try { await post("PATCH", `/api/projects/${row.dataset.project}/cards/${row.dataset.id}`, { status: "verify" }); IB.toast(t("trust.reopened", { id: row.dataset.id })); await IB.load(); IB.paintPage(); } catch (e) { IB.toast(e.message || String(e)); }
  }
  Object.assign(IB, { testerDone, reopenTested, send, taskDone, lifeDone, accept, gotIt, infoReply, waitAndSee, startTester, acceptAiPassed, flickAct });
})();
