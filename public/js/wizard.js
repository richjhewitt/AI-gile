/* ---------- 🧙 setup wizard, quick mode (AIG-354) ---------- */
// First run offers "Set it up with the wizard" or "I'll wing it"; 🧙 Run the wizard in Setup comes back any time.
// Five screens: welcome, name + agent program, team style, how much AI, done. Saves only through POST /api/setup (the
// fields and prefs), once, when you leave screen 4. A guessed agent program is only a suggestion until "Use this" (AIG-334).
// Team style = answers to the lead quiz questions (QUIZ in leadquiz.js).
const WZ_STYLES = {
  careful: { tidy: 'yes', chatty: 'quiet', go: 'ask', night: 'quiet', words: 'plain', steps: 'one' },
  balanced: { tidy: 'yes', chatty: 'chatty', go: 'small', night: 'quiet', words: 'plain', steps: 'stage' },
  fast: { tidy: 'no', chatty: 'quiet', go: 'small', night: 'work', words: 'dev', steps: 'all' },
};
const WZ_PLANS = ['fly', 'careful', 'normal', 'generous', 'nospare'];
const WZ_STEPS = 5;
const WZ = { shown: false, step: 1, name: '', agent: '', style: '', plan: '', help: '', hadOwner: false };

// Which style the current settings already match ('' when none does).
function wzStyleOf(pr, explain) {
  const cur = { ...pr, explain };
  return Object.keys(WZ_STYLES).find(k => QUIZ.every(([q, opts]) => { const set = opts.find(o => o[0] === WZ_STYLES[k][q])[1]; return Object.entries(set).every(([f, v]) => cur[f] === v); })) || '';
}
function wzPrefsOf(style) {
  const prefs = {};
  for (const [q, opts] of QUIZ) Object.assign(prefs, opts.find(o => o[0] === WZ_STYLES[style][q])[1]);
  return prefs;
}
const wzField = k => (state.setup.fields.find(f => f.key === k) || {});

// First run only: a Setup page that still needs filling in, and the wizard not answered yet.
function wizardMaybe() {
  const s = state.setup;
  let back = ''; try { back = sessionStorage.getItem('aigile.wzAdv') || ''; sessionStorage.removeItem('aigile.wzAdv'); } catch {}
  if (back && s && !$('dialog').firstChild) { WZ.shown = true; advResume(ADV_SCREENS[ADV_SCREENS.indexOf(back) + 1] || 'summary'); return; }
  if (WZ.shown || !s || !s.needed || (s.prefs || {}).wizardSeen || $('dialog').firstChild) return;
  WZ.shown = true;
  openDialog(`<h2>${esc(t('wz.ask.h'))}</h2><p>${esc(t('wz.ask.sub'))}</p>
    <div class="actions"><button class="primary" id="wzYes" onclick="wizardStart()">${esc(t('wz.ask.yes'))}</button><button id="wzNo" onclick="wizardWing()">${esc(t('wz.ask.no'))}</button></div>
    <div class="err" id="wz-err"></div>`, 'wizard');
}
async function wizardWing() {
  try { state.setup = await api('POST', '/api/setup', { prefs: { wizardSeen: true } }); closeDialog(); helpMaybe(); }
  catch (e) { setErr('wz-err', e); }
}
function wizardStart() {
  const s = state.setup, pr = s.prefs || {}, first = !pr.wizardSeen;
  WZ.hadOwner = !!wzField('owner').value;
  Object.assign(WZ, { step: 1, name: wzField('owner').value, agent: wzField('agent.command').value, style: wzStyleOf(pr, glossOn()) || (first ? 'balanced' : ''), plan: pr.plan || (first ? 'normal' : ''), help: pr.helpLevel || '2' });
  wizardShow();
}
// Take what is typed on this screen before moving on.
function wzKeep() {
  if ($('wz-name')) WZ.name = $('wz-name').value.trim();
  if ($('wz-agent')) WZ.agent = $('wz-agent').value.trim();
}
function wizardShow() {
  const n = WZ.step, dots = `<div class="wz-dots" aria-label="${esc(t('wz.step', { n, of: WZ_STEPS }))}">${Array.from({ length: WZ_STEPS }, (_, i) => `<span class="wz-dot ${i + 1 === n ? 'on' : i + 1 < n ? 'past' : ''}"></span>`).join('')}</div>`;
  const pick = (name, val, cur, label, help = '') => `<label class="quiz-opt wz-opt"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''} onchange="WZ.${{ 'wz-style': 'style', 'wz-help': 'help' }[name] || 'plan'} = this.value"> <span>${esc(label)}${help ? `<small class="muted"> ${esc(help)}</small>` : ''}</span></label>`;
  let body = '';
  if (n === 1) body = `<h2>${esc(t('wz.1.h'))}</h2><p>${esc(t('wz.1.sub'))}</p><p class="muted">${esc(t('wz.1.pick'))}</p><label class="f"><span>${esc(t('lang.title'))}</span>${langPickHtml('wz-lang')}</label>`;
  if (n === 2) {
    const g = wzField('agent.command').suggest;
    body = `<h2>${esc(t('wz.2.h'))}</h2>
      <label class="f"><span>${esc(t('wz.2.name'))}</span><input type="text" id="wz-name" value="${esc(WZ.name)}" maxlength="80" autocomplete="off"><small class="muted">${esc(t('wz.2.name.help'))}</small></label>
      <label class="f"><span>${esc(t('wz.2.agent'))}</span><input type="text" id="wz-agent" value="${esc(WZ.agent)}" placeholder="${esc(g)}" autocomplete="off" spellcheck="false"><small class="muted">${esc(t('wz.2.agent.help'))}</small>
      ${g && !WZ.agent ? `<small class="suggest"><span class="muted">${esc(t('setup.suggest'))}</span> <code>${esc(g)}</code> <button type="button" id="wzUse" onclick="$('wz-agent').value = ${esc(JSON.stringify(g))}; this.closest('.suggest').remove()">${esc(t('setup.suggest.use'))}</button></small>` : ''}</label>`;
  }
  if (n === 3) body = `<h2>${esc(t('wz.3.h'))}</h2><p class="muted">${esc(t('wz.3.sub'))}</p><div class="wz-opts">${Object.keys(WZ_STYLES).map(k => pick('wz-style', k, WZ.style, t('wz.style.' + k), t('wz.style.' + k + '.help'))).join('')}</div>
      <h3>${esc(t('wz.adv.help.h'))}</h3><div class="wz-opts">${HELP_LEVELS.map(v => pick('wz-help', v, WZ.help, t('help.level.' + v))).join('')}</div>`;
  if (n === 4) body = `<h2>${esc(t('wz.4.h'))}</h2><p class="muted">${esc(t('wz.4.sub'))}</p><div class="wz-opts">${WZ_PLANS.map(k => pick('wz-plan', k, WZ.plan, t('budget.plan.' + k), t('wz.plan.' + k + '.help'))).join('')}</div>`;
  if (n === 5) body = `<h2>${esc(t('wz.5.h'))}</h2><p>${esc(t('wz.5.sub'))}</p>${state.setup.needed ? `<p class="muted">${esc(t('wz.5.more'))}</p>` : ''}`;
  const skip = n > 1 && n < 5 && !(n === 2 && !WZ.hadOwner && !WZ.name) ? `<button id="wzSkip" onclick="wizardGo(${n + 1}, true)">${esc(t('wz.skip'))}</button>` : '';
  openDialog(`${dots}${body}<div class="err" id="wz-err"></div>
    <div class="actions">${n > 1 && n < 5 ? `<button id="wzBack" onclick="wizardGo(${n - 1})">${esc(t('wz.back'))}</button>` : ''}${skip}
    ${n === 1 ? `<button id="wzAdv" onclick="advStart()">${esc(t('wz.1.adv'))}</button>` : ''}
    ${n < 5 ? `<button class="primary" id="wzNext" onclick="wizardGo(${n + 1})">${esc(t('wz.next'))}</button>` : `<button class="primary" id="wzDone" onclick="wizardClose()">${esc(t('wz.done'))}</button>`}</div>`, 'wizard');
}
async function wizardGo(to, skipped) {
  wzKeep();
  if (skipped) { if (WZ.step === 3) { WZ.style = ''; WZ.help = ''; } if (WZ.step === 4) WZ.plan = ''; if (WZ.step === 2 && WZ.hadOwner) { /* keep what is there */ } }
  if (WZ.step === 2 && to > 2 && !WZ.name && !WZ.hadOwner) { setErr('wz-err', t('wz.need.name')); return; }
  if (to === 5) { if (!(await wzSave())) return; }
  WZ.step = to; wizardShow();
}
// The one save: the name and the agent program as typed (blank is left alone), the chosen style and spend step, and "seen".
async function wzSave() {
  const body = { prefs: { wizardSeen: true } };
  if (WZ.name) body.owner = WZ.name;
  if (WZ.agent) body['agent.command'] = WZ.agent;
  if (WZ.style) Object.assign(body.prefs, wzPrefsOf(WZ.style));
  if (WZ.plan) body.prefs.plan = WZ.plan;
  if (WZ.help) body.prefs.helpLevel = WZ.help;
  const explain = body.prefs.explain;   // also sent: the server keeps it as the words scale (AIG-418)
  try {
    // Blank name or program with a name already set: the server keeps the old ones (it only takes keys that are sent).
    state.setup = await api('POST', '/api/setup', body);
    if (explain !== undefined) setExplain(explain);
    if (WZ.help) helpApply(WZ.help);
    return true;
  } catch (e) { setErr('wz-err', e); return false; }
}
function wizardClose() { closeDialog(); WZ.shown = true; helpMaybe(); state.route.view === 'setup' && $('app') && ($('app').innerHTML = renderSetup()); }
