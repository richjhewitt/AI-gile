/* ---------- 🔥 Practise an incident (AIG-1327) ----------
   practiceHtml(p, c): on the sample project's practice incident (lib/sample.js, c.practice === 'incident') a "Try it" box with four
   steps that tick themselves from the card: 1 🚨 Major, 2 fix it and close it (the post-mortem), 3 the post-incident review (the form
   in reviewHtml), 4 a runbook line (a 🚦 card that waits for Go; the sample has no folder, so nothing is written). Plain code, no AI.
   Each hint links its words to the 📖 glossary (#/glossary/<id>). Texts: prac.* */
const PRACTICE = [
  { k: 'major', done: c => !!(c.major || c.review), words: ['incident', 'major', 'oncall'] },
  { k: 'close', done: c => c.status === 'done' && !!c.postmortem, words: ['workaround', 'postmortem'] },
  { k: 'review', done: c => !!(c.review && c.review.state === 'posted'), words: ['rootcause'] },
  { k: 'runbook', done: (c, p) => { const r = c.review && c.review.runbook && p.cards.find(x => x.id === c.review.runbook); return !!(r && r.runbookProposal && r.runbookProposal.done); }, words: ['runbook'] },
];
const practiceWords = ids => ids.map(id => `<a class="prac-word" href="#/glossary/${id}">📖 ${esc(t('gloss.' + id + '.word'))}</a>`).join(' ');
function practiceHtml(p, c) {
  if (!p.sample || c.practice !== 'incident') return '';
  const now = PRACTICE.findIndex(s => !s.done(c, p)), all = now < 0;
  const rb = c.review && c.review.runbook;
  const extra = k => {
    if (k === 'close' && c.status === 'done' && !c.review) return `<p class="prac-warn">${esc(t('prac.nomajor'))}</p>`;
    if (k !== 'runbook') return '';
    if (rb) return `<p>${esc(t('prac.runbook.go'))} <a href="#/p/${esc(p.slug)}/${esc(rb)}">${esc(rb)}</a></p>`;
    return `<form id="pracRb" onsubmit="event.preventDefault(); practiceRunbook('${esc(c.id)}')"><label class="f"><span>${esc(t('prac.runbook.name'))}</span><input id="pracRbName" value="rsvp-page-down" maxlength="60" required></label>
      <label class="f"><span>${esc(t('prac.runbook.text'))}</span><input id="pracRbText" placeholder="${esc(t('prac.runbook.ph'))}" maxlength="300" required></label>
      <button type="submit">${esc(t('prac.runbook.btn'))}</button></form>`;
  };
  return `<div class="practice" id="practice"><h3>${esc(t('prac.h'))}</h3><p class="muted">${esc(t('prac.intro'))}</p><ol class="prac-steps">${PRACTICE.map((s, i) => {
    const done = s.done(c, p), on = i === now;
    return `<li class="prac-step${done ? ' done' : ''}${on ? ' on' : ''}" data-step="${s.k}"><span class="prac-tick" role="img" aria-label="${esc(t(done ? 'prac.done' : on ? 'prac.now' : 'prac.todo'))}">${done ? '✅' : on ? '👉' : '⬜'}</span> <b>${esc(t('prac.' + s.k))}</b>
      ${on ? `<p>${esc(t('prac.' + s.k + '.hint'))}</p><p class="prac-words">${practiceWords(s.words)}</p>${extra(s.k)}` : ''}</li>`;
  }).join('')}</ol>${all ? `<p class="prac-all">${esc(t('prac.all'))}</p>` : ''}</div>`;
}
async function practiceRunbook(id) {
  const name = $('pracRbName').value.trim(), text = $('pracRbText').value.trim(); if (!name || !text) return;
  try { await api('POST', `/api/projects/${slug()}/cards/${id}/review/runbook`, { name, text, author: me() }); refresh(true); } catch (e) { alert(e.message); }
}
// The review written by hand (AI off, or the practice incident): timeline, what helped, one action per line.
const reviewFormHtml = c => `<form id="pirForm" onsubmit="event.preventDefault(); reviewPost('${esc(c.id)}')">
  <label class="f"><span>${esc(t('pir.timeline'))}</span><textarea id="pirTimeline" rows="2" required placeholder="${esc(t('pir.timeline.ph'))}"></textarea></label>
  <label class="f"><span>${esc(t('pir.helped'))}</span><textarea id="pirHelped" rows="2" required placeholder="${esc(t('pir.helped.ph'))}"></textarea></label>
  <label class="f"><span>${esc(t('pir.actions'))}</span><textarea id="pirActions" rows="2" required placeholder="${esc(t('pir.actions.ph'))}"></textarea></label>
  <button type="submit" class="primary">${esc(t('pir.post'))}</button></form>`;
async function reviewPost(id) {
  const b = { timeline: $('pirTimeline').value.trim(), helped: $('pirHelped').value.trim(), actions: $('pirActions').value.split('\n').map(s => s.trim()).filter(Boolean), author: me() };
  if (!b.timeline || !b.helped || !b.actions.length) return;
  try { await api('POST', `/api/projects/${slug()}/cards/${id}/review`, b); refresh(true); } catch (e) { alert(e.message); }
}
