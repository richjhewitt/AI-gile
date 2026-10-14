/* ---------- AI-passed tests, one at a time (AIG-192) ---------- */
// The inbox's 🤖 AI passed view: what the tester saw and its screenshot, the steps folded away, then
// Accept / Send back and the next one slides in. inbox.js owns the list, the clicks and the keys.
function aiFlickHtml(c, i, n) {
  return `<div class="fl-head"><b>${esc(t('inbox.ai.h', { i: i + 1, n }))}</b><span class="spacer"></span>
      <button data-fl="prev" ${n < 2 ? 'disabled' : ''} title="${esc(t('inbox.ai.prev'))}">‹</button><button data-fl="next" ${n < 2 ? 'disabled' : ''} title="${esc(t('inbox.ai.next'))}">›</button>
      <button data-fl="exit">${esc(t('inbox.ai.exit'))}</button></div>
    <div class="ib-top"><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>
    <div class="ib-title"><a href="#/p/${esc(c.project)}/${esc(c.id)}">${esc(c.title)}</a></div>
    ${aiEvidence(c, c.project)}
    ${c.testSteps ? `<details class="ib-steps"><summary>${esc(t('inbox.t.how'))}</summary><div class="body">${linkify(c.testSteps, c)}</div></details>` : ''}
    <textarea id="flText" rows="2" placeholder="${esc(t('inbox.ai.ph'))}"></textarea>
    <div class="ib-err" id="flErr"></div>
    <div class="actions"><button class="good" data-fl="accept">${esc(t('card.accept'))}</button><button class="warn" data-fl="back">${esc(t('card.sendback'))}</button><span class="ib-hint">${esc(t('inbox.ai.keys'))}</span></div>`;
}
