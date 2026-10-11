// AI-gile inbox queue bar (split from js/inbox.js, AIG-165): the kind filter chips and the Next up line (AIG-159..162).
// Classic script, global scope. Needs from core.js: esc, t, pic, QKINDS, kindOfItem, queueRank, queueChips. Called by inbox.js paintPage.
/* ---------- queue ---------- */
function paintQueue(shown, kindFilter) {
  const n = k => shown.filter(c => kindOfItem(c) === k).length, mins = shown.filter(c => !kindFilter || kindOfItem(c) === kindFilter).reduce((s, c) => s + (c.mins || 0), 0);
  const chips = [['', t('queue.all')], ...Object.keys(QKINDS).filter(k => n(k)).map(k => [k, QKINDS[k] + ' ' + t('queue.kind.' + k)])]
    .map(([k, label]) => `<button class="ib-kind ${kindFilter === k ? 'on' : ''}" data-kind="${k}">${esc(label)} <span class="n">${k ? n(k) : shown.length}</span></button>`).join('')
    + (mins ? `<span class="ib-hint">⏱ ${esc(t('queue.total', { n: mins }))}</span>` : '');
  const kb = document.getElementById('ibKinds'); if (kb.dataset.sig !== chips) { kb.dataset.sig = chips; kb.innerHTML = chips; }
  const next = [...shown].sort(queueRank)[0];
  const nx = next ? `<b>▶ ${esc(t('queue.next'))}</b> <a href="#/p/${esc(next.project)}/${esc(next.id)}">${pic(next.projectLogo, next.projectEmoji)} ${esc(next.id)} ${esc(next.title)}</a> ${queueChips(next)}` : '';
  const nb = document.getElementById('ibNext'); if (nb.dataset.sig !== nx) { nb.dataset.sig = nx; nb.innerHTML = nx; } nb.hidden = !next;
}
