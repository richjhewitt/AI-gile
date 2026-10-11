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
      await post('POST', base(n) + '/comments', { author: me(), text, attachments });
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
  async function accept(n) {
    lock(n);
    try { await post('POST', base(n) + '/verdict', { accept: true }); done(n, t('inbox.toast.accepted', { id: n.dataset.id })); }
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
    const list = IB.items.filter(c => isTest(c) && c.aiCheck && c.aiCheck.result === 'pass' && (IB.tab === 'all' || c.project === IB.tab));
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
    if (e.key === 'ArrowRight') flickAct('next'); else if (e.key === 'ArrowLeft') flickAct('prev'); else if (e.key === 'a' || e.key === 'A') flickAct('accept'); else if (e.key === 'Escape') flickAct('exit');
  });
  async function waitAndSee(n) {
    lock(n);
    try { await post('POST', base(n) + '/snooze'); n.dataset.sending = ''; await IB.load(); IB.toast(t('inbox.toast.hidden', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  Object.assign(IB, { send, taskDone, accept, waitAndSee, startTester, acceptAiPassed, flickAct });
})();
