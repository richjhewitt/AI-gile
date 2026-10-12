/* ---------- 🚫 No AI, ever (AIG-581..583) ---------- */
// A choice, not a pause: unlike No Token Mode it has no glow and no button to flip it back. The server keeps it ("noAi" in
// aigile.local.json, lib/noai.js) and refuses every AI run; the page reads it from /api/meta and
//  - puts the body class `noai`, which css/10-topbar.css uses to hide every AI part (anything with `.ai-only` too),
//  - makes t() prefer a key's `.noai` twin (js/i18n.js), so the guide, help and empty states say "team", not "agents".
// To turn it back off later (AIG-618 "OK, I give in"): NoAi.turnOff() here, or require('./lib/noai').set(false) on the server.
const NoAi = (() => {
  let on = false;
  function apply(v) {
    v = !!v;
    document.body.classList.toggle('noai', v);
    if (v === on) return;
    on = v; i18n.noai = v;
    if (typeof Topbar !== 'undefined') Topbar.apply();
    if (i18n.ready) refresh(true);
  }
  // Setup: ask once, then it is on. There is no switch back on the page.
  async function turnOn() {
    if (!confirm(t('noai.confirm'))) return;
    try { state.setup = await api('POST', '/api/setup', { prefs: { noAi: true } }); } catch (e) { alert(e.message); return; }
    apply(true);
    if ($('app') && state.route.view === 'setup') $('app').innerHTML = renderSetup();
  }
  async function turnOff() {   // for the "OK, I give in" card; nothing in the page calls it yet
    state.setup = await api('POST', '/api/setup', { prefs: { noAi: false } });
    apply(false);
  }
  return { apply, turnOn, turnOff, get on() { return on; } };
})();
// Setup's box: the choice before it is made, a calm note after. No way back is shown (see the top of this file).
function noAiBoxHtml() {
  return NoAi.on ? `<span>${esc(t('noai.h'))}</span><div><b>${esc(t('noai.on'))}</b></div><small class="muted">${esc(t('noai.on.help'))}</small>`
    : `<span>${esc(t('noai.h'))}</span><div><button type="button" id="noAiOn" onclick="NoAi.turnOn()">${esc(t('noai.btn'))}</button></div><small class="muted">${esc(t('noai.help'))}</small>`;
}
