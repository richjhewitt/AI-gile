/* ---------- ⚡ Decide pile and 🗂️ Topics (AIG-361) ---------- */
// Every open question with answer buttons (Go / Not yet, yes / no, --options) and every open Topic (a few quick
// questions on one card), one at a time. Keys 1 2 3 answer, → skips, Enter opens the card. inbox.js owns the click wiring.
// Classic script; the helpers below are global, the handlers share state through IB (js/inbox-state.js).
function decideItem(c) {
  if (c.quiz && !c.quiz.done) {
    const items = c.quiz.items, idx = items.findIndex(x => !x.answer);
    if (idx >= 0) return { c, quiz: true, idx, n: items.length, q: items[idx].q, acts: items[idx].options.map(o => ({ label: o, say: o })) };
  }
  if (c.info && c.status === 'verify' && !IB.isTask(c)) return { c, quiz: false, info: true, text: c.testSteps || c.title, acts: [{ label: t('info.gotit'), gotit: true }] };   // 📖 To read (AIG-392)
  if (c.blocked || c.status === 'verify') return null;
  const a = IB.shownAsk(c), acts = askActions(a, 'question');
  return acts.length ? { c, quiz: false, text: a.text, acts } : null;
}
// shown: the inbox items for the current tab; returns the pile, grouped by project (shown is in tab order).
function decideList(shown) { return shown.filter(c => IB.isQuestion(c) || (c.info && IB.isTest(c))).map(decideItem).filter(Boolean).sort((a, b) => (b.c.bumpedAt || '').localeCompare(a.c.bumpedAt || '')); }   // a bumped reminder first (AIG-373)
// Two lines that say what is asked: the bold question line (with what leads up to it), else the first lines.
function decideSummary(text) {
  const ls = String(text || '').replace(/```[\s\S]*?```/g, '').split('\n').map(s => s.trim().replace(/^[-*#>•\s]+/, '')).filter(Boolean);
  const ask = ls.find(l => /\*\*[^*]*\?[^*]*\*\*/.test(l)) || ls.find(l => /\bGO\s*\?/.test(l));
  const pick = ask ? [ls[0] === ask ? null : ls[0], ask].filter(Boolean) : ls.slice(0, 2);
  return pick.join('\n');
}
function decideHtml(d, i, n) {
  const c = d.c, btns = d.acts.map((a, k) => `<button class="${a.ask != null ? '' : 'good'}" data-dc="ans" data-n="${k}"><b>${k + 1}</b> ${esc(a.label)}</button>`).join('');
  const body = d.quiz
    ? `<div class="dc-topic">${esc(t('decide.topic', { topic: c.quiz.topic }))} · <span class="muted">${esc(t('decide.qn', { i: d.idx + 1, n: d.n }))}</span></div><div class="dc-sum dc-q">${esc(d.q)}</div>`
    : `<div class="dc-sum">${IB.linkify(decideSummary(d.text), c).replace(/\n/g, '<br>')}</div>`;
  const reason = d.info || d.acts.some(a => a.ask != null) ? `<textarea id="dcText" rows="2" placeholder="${esc(t('decide.ph'))}"></textarea>` : '';
  return `<div class="fl-head"><b>${esc(t('decide.h', { i: i + 1, n }))}</b><span class="spacer"></span>
      <button data-dc="prev" ${n < 2 ? 'disabled' : ''} title="${esc(t('decide.back'))}">‹</button><button data-dc="next" ${n < 2 ? 'disabled' : ''} title="${esc(t('decide.skip'))}">${esc(t('decide.skip'))}</button>
      <button data-dc="exit">${esc(t('decide.exit'))}</button></div>
    <div class="ib-top"><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>
    <div class="ib-title"><a href="#/p/${esc(c.project)}/${esc(c.id)}">${esc(c.title)}</a></div>
    ${body}
    <div class="dc-btns">${btns}</div>${reason}
    <div class="ib-err" id="dcErr"></div>
    <div class="actions"><button data-dc="open">${esc(t('decide.open'))}</button><span class="ib-hint">${esc(t('decide.keys'))}</span></div>`;
}
// On the card itself: the open Topic's questions with their buttons.
function quizPanel(p, c) {
  const q = c.quiz;
  if (!q || q.done) return '';
  return `<div class="qz"><b>${esc(t('card.quiz.h', { topic: q.topic }))}</b> <span class="muted">${esc(t('card.quiz.sub', { n: q.items.length }))}</span>
    ${q.items.map((x, i) => `<div class="qz-item"><div>${i + 1}. ${esc(x.q)}</div><div class="msg-acts">${x.options.map(o => `<button class="qz-opt ${x.answer === o ? 'good' : ''}" data-card="${esc(p.slug + '/' + c.id)}" data-i="${i}" data-a="${esc(o)}">${x.answer === o ? '✓ ' : ''}${esc(o)}</button>`).join('')}</div></div>`).join('')}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('.qz-opt'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.card.split('/');
  try { await api('POST', `/api/projects/${s}/cards/${id}/quiz/answer`, { index: +b.dataset.i, answer: b.dataset.a }); refresh(true); } catch (err) { alert(err.message); }
}, true);

(function () {
  'use strict';
  const { el, post } = IB;
  const shownNow = () => IB.tab === 'all' ? IB.items : IB.items.filter(c => c.project === IB.tab);
  let busy = false;
  async function decideAct(act, n) {
    const list = decideList(shownNow()), cur = list[IB.decide];
    if (act === 'exit' || !cur) { IB.decide = -1; IB.paintPage(); return; }
    if (act === 'next' || act === 'prev') { IB.decide = (IB.decide + (act === 'next' ? 1 : -1) + list.length) % list.length; IB.paintPage(); return; }
    if (act === 'open') { location.hash = `#/p/${cur.c.project}/${cur.c.id}`; return; }
    const a = cur.acts[n]; if (!a || busy) return;
    const ta = el('dcText');
    if (a.ask != null) {   // needs a reason: start it, send on Enter
      if (ta) { ta.value = a.ask; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }
    await send(cur, a.say, a.gotit);
  }
  async function send(cur, text, gotit) {
    if (busy) return;
    busy = true; el('ibDc').querySelectorAll('button').forEach(b => b.disabled = true);
    const c = cur.c, base = `/api/projects/${c.project}/cards/${c.id}`;
    try {
      if (cur.quiz) {
        await post('POST', base + '/quiz/answer', { index: cur.idx, answer: text });
        IB.toast(t(cur.idx + 1 === cur.n ? 'decide.toast.done' : 'decide.toast.q', { id: c.id, i: cur.idx + 1, n: cur.n }));
      } else if (gotit) {
        await post('POST', base + '/verdict', { accept: true });
        IB.toast(t('info.toast.gotit', { id: c.id }));
      } else if (cur.info) {
        await post('POST', base + '/verdict', { reply: true, text });
        IB.toast(t('info.toast.replied', { id: c.id }));
      } else {
        await post('POST', base + '/comments', { author: me(), text });
        IB.toast(t('decide.toast', { id: c.id }));
      }
      el('ibDc').dataset.sig = '';
      await IB.load();
    } catch (err) { const e = el('dcErr'); if (e) e.textContent = err.message || String(err); }
    busy = false; IB.paintPage();
  }
  document.addEventListener('keydown', e => {
    if (IB.decide < 0 || !el('ibDc') || el('ibDc').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.id === 'dcText') {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const v = e.target.value.trim(), cur = decideList(shownNow())[IB.decide]; if (v && cur) send(cur, v); }
      return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (/^[1-4]$/.test(e.key)) decideAct('ans', +e.key - 1);
    else if (e.key === 'ArrowRight') decideAct('next'); else if (e.key === 'ArrowLeft') decideAct('prev');
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') decideAct('open'); else if (e.key === 'Escape') decideAct('exit');
  });
  IB.decideAct = decideAct;
})();
