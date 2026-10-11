/* ---------- what kind of lead (AIG-235..237) ---------- */
// A short questionnaire in ⚙️ Setup (and offered once, when the name is first saved): each answer switches settings.
// Every setting stays a switch of its own: "Your lead" on the Setup page, 💬 per project in 🎨 Look, 📖 dev words.
// [question id, [[answer id, what it sets]]]; settings are in aigile.local.json (setup prefs), explain in this browser.
const QUIZ = [
  ['tidy', [['yes', { tidyCards: true }], ['no', { tidyCards: false }]]],
  ['chatty', [['chatty', { chatty: true }], ['quiet', { chatty: false }]]],
  ['go', [['ask', { go: 'ask' }], ['small', { go: 'small' }]]],
  ['night', [['quiet', { watchAll: false }], ['work', { watchAll: true }]]],
  ['words', [['plain', { explain: true }], ['dev', { explain: false }]]],
];
const leadPrefs = () => (state.setup && state.setup.prefs) || {};

async function leadQuiz() {
  try { state.setup = await api('GET', '/api/setup'); } catch {}
  const cur = { ...leadPrefs(), explain: glossOn() }, picked = set => Object.entries(set).every(([k, v]) => cur[k] === v);
  openDialog(`<h2>${esc(t('quiz.h'))}</h2><p class="muted">${esc(t('quiz.sub'))}</p>
    ${QUIZ.map(([q, opts]) => `<div class="quiz-q"><b>${esc(t('quiz.' + q))}</b><div class="quiz-opts">${opts.map(([a, set]) =>
      `<label class="quiz-opt"><input type="radio" name="quiz-${q}" value="${a}" ${picked(set) ? 'checked' : ''}> ${esc(t('quiz.' + q + '.' + a))}</label>`).join('')}</div>
      ${q === 'chatty' ? `<label class="chk"><input type="checkbox" id="quizChattyAll"> ${esc(t('quiz.chatty.all'))}</label>` : ''}</div>`).join('')}
    <div class="err" id="quiz-err"></div>
    <div class="actions"><button class="primary" onclick="saveQuiz()">${esc(t('common.save'))}</button><button onclick="closeDialog()">${esc(t('quiz.later'))}</button></div>`);
}
async function saveQuiz() {
  const prefs = {};
  for (const [q, opts] of QUIZ) { const r = document.querySelector(`#dialog input[name="quiz-${q}"]:checked`); if (r) Object.assign(prefs, opts.find(o => o[0] === r.value)[1]); }
  if ('chatty' in prefs && $('quizChattyAll').checked) prefs.chattyAll = true;
  const explain = prefs.explain; delete prefs.explain;
  try {
    state.setup = await api('POST', '/api/setup', { prefs });
    if (explain !== undefined) { setExplain(explain); if ($('explainWords')) $('explainWords').checked = explain; }
    closeDialog(); paintLeadPrefs(t('quiz.saved'));
  } catch (e) { setErr('quiz-err', e); }
}

/* ---------- "Your lead" on the Setup page: the questionnaire and each setting as its own switch ---------- */
// Usage checks, token budget, parallel runs and helpers per model (AIG-353).
function budgetHtml(pr) {
  const row = (k, label, min, max) => `<label class="f"><span>${esc(t(label))}</span><input type="number" id="pf-${k}" min="${min}" max="${max}" value="${pr[k] ?? ''}" style="width:5em" onchange="setLeadPref({ ${k}: this.value === '' ? '' : Number(this.value) })"></label>`;
  const plans = ['fly', 'careful', 'normal', 'generous', 'nospare'];
  return `<div class="f"><span>${esc(t('budget.plan'))}</span><div class="quiz-opts" id="pf-plan">${plans.map(k => `<label class="quiz-opt"><input type="radio" name="pf-plan" value="${k}" ${pr.plan === k ? 'checked' : ''} onchange="setLeadPref({ plan: '${k}' })"> ${esc(t('budget.plan.' + k))}</label>`).join('')}</div><small class="muted">${esc(t('budget.plan.help'))}</small></div>
    <label class="f"><span>${esc(t('budget.usage'))}</span><select class="setup-theme" id="pf-usageChecks" onchange="setLeadPref({ usageChecks: this.value })">${['off', 'hand', 'auto'].map(v => `<option value="${v}" ${pr.usageChecks === v ? 'selected' : ''}>${esc(t('budget.usage.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('budget.usage.help'))}</small></label>
    ${row('budgetH5', 'budget.h5', 1, 100)}${row('budgetWk', 'budget.wk', 1, 100)}<small class="muted">${esc(t('budget.help'))}</small>
    ${row('maxRuns', 'budget.runs', 0, 50)}<small class="muted">${esc(t('budget.runs.help'))}</small>
    <span>${esc(t('budget.helpers'))}</span>${['Opus', 'Sonnet', 'Haiku'].map(m => row('helpers' + m, 'budget.helpers.' + m.toLowerCase(), 0, 50)).join('')}<small class="muted">${esc(t('budget.helpers.help'))}</small>`;
}
function leadPrefsHtml(msg = '') {
  const pr = leadPrefs();
  const sw = k => `<label class="f chk"><span><input type="checkbox" ${pr[k] ? 'checked' : ''} onchange="setLeadPref({ ${k}: this.checked })"> ${esc(t('lead.' + k))}</span><small class="muted">${esc(t('lead.' + k + '.help'))}</small></label>`;
  return `<span>${esc(t('lead.h'))}</span><div><button type="button" onclick="leadQuiz()">${esc(t('quiz.btn'))}</button></div><small class="muted">${esc(t('quiz.help'))}</small>
    ${sw('tidyCards')}${sw('chatty')}
    <label class="f"><span>${esc(t('lead.go'))}</span><select class="setup-theme" onchange="setLeadPref({ go: this.value })">${['', 'ask', 'small'].map(v => `<option value="${v}" ${(pr.go || '') === v ? 'selected' : ''}>${esc(t('lead.go.' + (v || 'none')))}</option>`).join('')}</select><small class="muted">${esc(t('lead.go.help'))}</small></label>
    ${sw('watchAll')}${sw('light')}
    ${budgetHtml(pr)}
    <div class="err" id="lead-err"></div><div class="muted" id="lead-done">${esc(msg)}</div>`;
}
const paintLeadPrefs = msg => { if ($('leadPrefs')) $('leadPrefs').innerHTML = leadPrefsHtml(msg); };
async function setLeadPref(prefs) {
  try { state.setup = await api('POST', '/api/setup', { prefs }); paintLeadPrefs(t('setup.saved.short')); }
  catch (e) { paintLeadPrefs(); setErr('lead-err', e); }
}
