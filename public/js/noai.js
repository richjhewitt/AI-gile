/* ---------- 🚫 No AI, ever (AIG-581..583, 617, 618) ---------- */
// A choice, not a pause: unlike No Token Mode it has no glow and no button to flip it back. The server keeps it ("noAi" in
// aigile.local.json, lib/noai.js) and refuses every AI run; the page reads it from /api/meta and
//  - puts the body class `noai`, which css/10-topbar.css uses to hide every AI part (anything with `.ai-only` too),
//  - makes t() prefer a key's `.noai` twin (js/i18n.js), so the guide, help and empty states say "team", not "agents".
// The way back is one friendly button in Setup's box, "OK, I give in: try AI" (giveIn): it calls POST /api/noai/off (lib/noai.js
// set(false)) and walks to the wizard's team step. In the No-AI edition (a NOAI file in the root, `build` below) it only explains
// that the full download is needed and that data/ carries over.
const NoAi = (() => {
  let on = false, build = false;
  function apply(v, isBuild) {
    v = !!v;
    if (isBuild !== undefined) build = !!isBuild;
    document.body.classList.toggle('noai', v);
    if (v === on) return;
    on = v; i18n.noai = v;
    if (typeof Topbar !== 'undefined') Topbar.apply();
    if (i18n.ready) refresh(true);
  }
  // Setup: ask once, then it is on.
  async function turnOn() {
    if (!confirm(t('noai.confirm'))) return;
    try { state.setup = await api('POST', '/api/setup', { prefs: { noAi: true } }); } catch (e) { alert(e.message); return; }
    apply(true);
    if ($('app') && state.route.view === 'setup') $('app').innerHTML = renderSetup();
  }
  // OK, I give in: try AI. No questions, no judgement.
  async function giveIn() {
    if (build) {   // the No-AI download has no AI in it: say where to get the full one
      openDialog(`<h2>${esc(t('noai.build.h'))}</h2><p>${esc(t('noai.build.text'))}</p><p class="muted">${esc(t('noai.build.data'))}</p>
        <div class="actions"><a class="navlink" id="noAiDl" href="https://ai-gile.lol" target="_blank" rel="noopener">${esc(t('noai.build.link'))}</a><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
      return;
    }
    try { await api('POST', '/api/noai/off'); state.setup = await api('GET', '/api/setup'); } catch (e) { alert(e.message); return; }
    apply(false);
    if ($('noAiBox')) $('noAiBox').innerHTML = noAiBoxHtml();
    if (typeof advStart === 'function') { advStart(); WA.screen = 'roles'; advShow(); }   // the wizard's team step
  }
  return { apply, turnOn, giveIn, get on() { return on; }, get build() { return build; } };
})();
// Setup's box: the choice before it is made; after it, a calm note and the friendly way out.
function noAiBoxHtml() {
  return NoAi.on ? `<span>${esc(t('noai.h'))}</span><div><b>${esc(t('noai.on'))}</b></div><small class="muted">${esc(t('noai.on.help'))}</small>
      <div class="actions"><button type="button" id="noAiGiveIn" onclick="NoAi.giveIn()">${esc(t('noai.givein'))}</button></div><small class="muted">${esc(t(NoAi.build ? 'noai.givein.help.build' : 'noai.givein.help'))}</small>`
    : `<span>${esc(t('noai.h'))}</span><div><button type="button" id="noAiOn" onclick="NoAi.turnOn()">${esc(t('noai.btn'))}</button></div><small class="muted">${esc(t('noai.help'))}</small>`;
}
