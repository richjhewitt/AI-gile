// AI-gile inbox queue bar (split from js/inbox.js, AIG-165): the kind filter chips and the Next up line (AIG-159..162).
// Classic script, global scope. Needs from core.js: esc, t, pic, QKINDS, kindOfItem, queueRank, queueChips. Called by inbox.js paintPage.
/* ---------- queue ---------- */
function paintQueue(shown, kindFilter) {
  const n = k => shown.filter(c => kindOfItem(c) === k).length, mins = shown.filter(c => !kindFilter || kindOfItem(c) === kindFilter).reduce((s, c) => s + (c.mins || 0), 0);
  const dn = decideList(shown).length;
  const chips = [['', t('queue.all')], ...Object.keys(QKINDS).filter(k => n(k)).map(k => [k, QKINDS[k] + ' ' + t('queue.kind.' + k), k === 'test' ? t('queue.test.title', { n: n('test'), all: n('test') + n('plan') + n('read') }) : ''])]
    .map(([k, label, tip]) => `<button class="ib-kind ${kindFilter === k ? 'on' : ''}" data-kind="${k}"${tip ? ` title="${esc(tip)}" aria-label="${esc(tip)}"` : ''}>${esc(label)} <span class="n">${k ? n(k) : shown.length + (IB.friends ? IB.friends() : 0)}</span></button>`).join('')
    + (dn ? `<button class="ib-kind ib-decide" data-decide="1" title="${esc(t('queue.decide.title', { n: dn }))}" aria-label="${esc(t('queue.decide.title', { n: dn }))}">${esc(t('decide.chip'))} <span class="n">${dn}</span> <span class="ib-hint">${esc(t('queue.decide.also'))}</span></button>` : '')
    + (mins ? `<span class="ib-hint">⏱ ${esc(t('queue.total', { n: mins }))}</span>` : '');
  const kb = document.getElementById('ibKinds'); if (kb.dataset.sig !== chips) { kb.dataset.sig = chips; kb.innerHTML = chips; }
  const next = [...shown].sort(queueRank)[0];
  const nx = next ? `<b>▶ ${esc(t('queue.next'))}</b> <a href="#/p/${esc(next.project)}/${esc(next.id)}">${pic(next.projectLogo, next.projectEmoji)} ${esc(next.id)} ${esc(next.title)}</a> ${queueChips(next)}` : '';
  const nb = document.getElementById('ibNext'); if (nb.dataset.sig !== nx) { nb.dataset.sig = nx; nb.innerHTML = nx; } nb.hidden = !next;
}
