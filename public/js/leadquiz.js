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
  ['steps', [['one', { steps: 1 }], ['stage', { steps: 3 }], ['all', { steps: 5 }]]],   // steps at a time (AIG-416)
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
  const explain = prefs.explain;   // also sent: the server keeps it as the words scale (AIG-418)
  try {
    state.setup = await api('POST', '/api/setup', { prefs });
    if (explain !== undefined) { setExplain(explain); if ($('explainWords')) $('explainWords').checked = explain; }
    closeDialog(); paintLeadPrefs(t('quiz.saved'));
  } catch (e) { setErr('quiz-err', e); }
}

/* ---------- "How agents work with you" on the Setup page (AIG-422): the questionnaire, one slider per owner scale ---------- */
// The owner scales of docs/PROFILES.md, 1..max, higher = more of the thing named; the chosen step's line shows under each.
// Saved as setup prefs scales (lib/setup.js keeps the old switches in step). thrift is the spend plan: a custom mix has no step.
const OWNER_SCALES = [['steps', 5], ['chat', 5], ['go', 5], ['words', 5], ['tidy', 3], ['thrift', 5], ['push', 5]];
const THRIFT_PLANS = ['nospare', 'generous', 'normal', 'careful', 'fly'];
const scaleLine = (k, n) => k === 'steps' ? t('steps.' + n) : k === 'push' ? t('sm.push.' + n) : k === 'tone' ? t('tone.' + n) : k === 'thrift' ? (n ? t('budget.plan.' + THRIFT_PLANS[n - 1]) : t('scale.thrift.custom')) : t('scale.' + k + '.' + n);
// One slider: the name, n of max, the step's line, a help line. Shared with the 👥 Team dialog (id prefix, save call).
function scaleSlider(k, max, n, save, idp = 'sc', help = t('scale.' + k + '.help')) {
  const v = n || Math.ceil(max / 2);
  return `<label class="f scale"><span>${esc(t('scale.' + k))} <b class="scale-n" id="${idp}-${k}-n">${n ? n + '/' + max : '–'}</b></span>
    <input type="range" id="${idp}-${k}" min="1" max="${max}" step="1" value="${v}" aria-valuetext="${esc(scaleLine(k, n))}" oninput="scaleShow('${idp}', '${k}', ${max}, this.value)" onchange="${save}('${k}', Number(this.value))">
    <small class="scale-line" id="${idp}-${k}-line">${esc(scaleLine(k, n))}</small>${help ? `<small class="muted">${esc(help)}</small>` : ''}</label>`;
}
function scaleShow(idp, k, max, n) {
  n = Number(n); $(idp + '-' + k + '-n').textContent = n + '/' + max; $(idp + '-' + k + '-line').textContent = scaleLine(k, n);
  $(idp + '-' + k).setAttribute('aria-valuetext', scaleLine(k, n));
}
const setTone = (k, n) => setLeadPref({ tone: n });
const setScale = (k, n) => setLeadPref({ scales: { [k]: n } });
// Usage checks, token budget, parallel runs and helpers per model (AIG-353): the detail under the thrift slider, folded under More.
function budgetHtml(pr) {
  const row = (k, label, min, max) => `<label class="f"><span>${esc(t(label))}</span><input type="number" id="pf-${k}" min="${min}" max="${max}" value="${pr[k] ?? ''}" style="width:5em" onchange="setLeadPref({ ${k}: this.value === '' ? '' : Number(this.value) })"></label>`;
  return `<details class="scale-more" id="pf-more" ${ls('aigile.scaleMore') === '1' ? 'open' : ''} ontoggle="try { localStorage.setItem('aigile.scaleMore', this.open ? '1' : '') } catch {}"><summary>${esc(t('scale.more'))}</summary>
    <label class="f"><span>${esc(t('budget.usage'))}</span><select class="setup-theme" id="pf-usageChecks" onchange="setLeadPref({ usageChecks: this.value })">${['off', 'hand', 'auto'].map(v => `<option value="${v}" ${pr.usageChecks === v ? 'selected' : ''}>${esc(t('budget.usage.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('budget.usage.help'))}</small></label>
    ${row('budgetH5', 'budget.h5', 1, 100)}${row('budgetWk', 'budget.wk', 1, 100)}<small class="muted">${esc(t('budget.help'))}</small>
    ${row('saveH5', 'saver.h5', 1, 99)}${row('saveWk', 'saver.wk', 1, 99)}<small class="muted">${esc(t('saver.help'))}</small>
    <label class="f chk"><span><input type="checkbox" id="pf-maximise" ${pr.maximise ? 'checked' : ''} onchange="setLeadPref({ maximise: this.checked })"> ${esc(t('maxi.label'))}</span><small class="muted">${esc(t('maxi.help'))}</small></label>
    ${row('maxRuns', 'budget.runs', 0, 50)}<small class="muted">${esc(t('budget.runs.help'))}</small>
    <span>${esc(t('budget.helpers'))}</span>${['Opus', 'Sonnet', 'Haiku'].map(m => row('helpers' + m, 'budget.helpers.' + m.toLowerCase(), 0, 50)).join('')}<small class="muted">${esc(t('budget.helpers.help'))}</small></details>`;
}
// 😴 Tired mode (AIG-669): never / at bedtime / when the page is dark / always. The top bar's click switch sits in mode 'on'.
function tiredHtml(pr) {
  const c = pr.tired || { mode: 'off', bedtime: '22:00', wake: '07:00' }, m = c.mode === 'on' ? 'off' : c.mode;
  const rd = (v, extra = '') => `<label class="chk"><input type="radio" name="pf-tired" value="${v}" ${m === v ? 'checked' : ''} onchange="setLeadPref({ tired: { mode: '${v}' } })"> ${esc(t('tired.mode.' + v))}${extra}</label>`;
  const tm = k => `<input type="time" id="pf-tired-${k}" value="${esc(c[k])}" aria-label="${esc(t('tired.' + k))}" onchange="if (this.value) setLeadPref({ tired: { ${k}: this.value } })">`;
  return `<div class="f"><span>${esc(t('tired.h'))}</span><div class="tired-box" id="pf-tired">${rd('off')}${rd('bedtime', ` ${tm('bedtime')} ${esc(t('tired.to'))} ${tm('wake')}`)}${rd('dark')}${rd('always')}<small class="muted">${esc(t('tired.help'))}</small></div></div>`;
}
function leadPrefsHtml(msg = '') {
  const pr = leadPrefs(), sc = pr.scales || {};
  const sw = k => `<label class="f chk"><span><input type="checkbox" ${pr[k] ? 'checked' : ''} onchange="setLeadPref({ ${k}: this.checked })"> ${esc(t('lead.' + k))}</span><small class="muted">${esc(t('lead.' + k + '.help'))}</small></label>`;
  return `<span>${esc(t('scale.h'))}</span><small class="muted">${esc(t('scale.sub'))}</small><div><button type="button" onclick="leadQuiz()">${esc(t('quiz.btn'))}</button></div><small class="muted">${esc(t('quiz.help'))}</small>
    ${OWNER_SCALES.map(([k, max]) => scaleSlider(k, max, sc[k], 'setScale') + (k === 'thrift' ? `<small class="muted" id="pf-pace">${esc(t('budget.pace', { pct: pr.pace }))}</small>${budgetHtml(pr)}` : '')).join('')}
    ${sw('watchAll')}${sw('planBig')}${sw('light')}${tiredHtml(pr)}
    ${scaleSlider('tone', 5, pr.tone || 3, 'setTone', 'tn', t('tone.help'))}
    <label class="f"><span>${esc(t('lead.tech'))}</span><select class="setup-theme" onchange="setLeadPref({ techLevel: this.value })">${['', 'beginner', 'some', 'expert'].map(v => `<option value="${v}" ${(pr.techLevel || '') === v ? 'selected' : ''}>${esc(t('lead.tech.' + (v || 'none')))}</option>`).join('')}</select><small class="muted">${esc(t('lead.tech.help'))}</small></label>
    <label class="f"><span>${esc(t('lead.push'))}</span><select id="pushPref" class="setup-theme" onchange="setLeadPref({ push: this.value })">${['ask', 'auto'].map(v => `<option value="${v}" ${(pr.push || 'ask') === v ? 'selected' : ''}>${esc(t('lead.push.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('lead.push.help'))}</small></label>
    <label class="f"><span>${esc(t('fourtwenty.h'))}</span><select id="pf-420" class="setup-theme" onchange="setLeadPref({ fourTwenty: this.value })">${['off', 'day', 'ampm', 'every', 'world'].map(v => `<option value="${v}" ${(pr.fourTwenty || 'off') === v ? 'selected' : ''}>${esc(t('fourtwenty.lvl.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('fourtwenty.help'))}</small></label>
    ${(pr.fourTwenty || 'off') !== 'off' ? `<label class="f"><span>${esc(t('fourtwenty.before'))}</span><input type="number" id="pf-420b" min="0" max="15" value="${pr.fourTwentyBefore ?? 5}" style="width:5em" onchange="setLeadPref({ fourTwentyBefore: Number(this.value) })"><small class="muted">${esc(t('fourtwenty.before.help'))}</small></label>` : ''}
    ${quietTimesHtml(pr)}
    <div class="err" id="lead-err"></div><div class="muted" id="lead-done">${esc(msg)}</div>`;
}
// Change calendar (AIG-615): quiet times (streams, demos, nights) when nothing goes live. Saved as prefs.quiet (lib/changecal.js).
const QT_DAYS = ['all', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
function quietTimesHtml(pr) {
  const row = (q, i) => `<div class="qt-row" data-qt="${i}">
    <select id="qt-day-${i}" aria-label="${esc(t('quiettime.day'))}" onchange="quietTimeSave()">${QT_DAYS.map(d => `<option value="${d}" ${q.day === d ? 'selected' : ''}>${esc(t('quiettime.day.' + d))}</option>`).join('')}</select>
    <input type="time" id="qt-from-${i}" aria-label="${esc(t('quiettime.from'))}" value="${esc(q.from)}" onchange="quietTimeSave()">–<input type="time" id="qt-to-${i}" aria-label="${esc(t('quiettime.to'))}" value="${esc(q.to)}" onchange="quietTimeSave()">
    <input id="qt-label-${i}" maxlength="40" placeholder="${esc(t('quiettime.label.ph'))}" aria-label="${esc(t('quiettime.label'))}" value="${esc(q.label || '')}" onchange="quietTimeSave()">
    <button type="button" class="qt-del" title="${esc(t('quiettime.del'))}" aria-label="${esc(t('quiettime.del'))}" onclick="quietTimeSave(${i})">✕</button></div>`;
  return `<div class="f qt" id="quietTimes"><span>${esc(t('quiettime.h'))}</span>${(pr.quiet || []).map(row).join('')}
    <div><button type="button" id="qtAdd" onclick="quietTimeSave(-1)">${esc(t('quiettime.add'))}</button></div><small class="muted">${esc(t('quiettime.help'))}</small></div>`;
}
// Reads the rows and saves them all; drop: a row to take out, or -1 to add a new one.
function quietTimeSave(drop) {
  const list = [...document.querySelectorAll('#quietTimes .qt-row')].map(r => r.dataset.qt).filter(i => Number(i) !== drop)
    .map(i => ({ day: $('qt-day-' + i).value, from: $('qt-from-' + i).value, to: $('qt-to-' + i).value, label: $('qt-label-' + i).value.trim() }));
  if (drop === -1) list.push({ day: 'all', from: '20:00', to: '22:00', label: '' });
  setLeadPref({ quiet: list });
}
// Painted again after each save; a slider moved with the keyboard keeps the focus.
const paintLeadPrefs = msg => { const f = document.activeElement && document.activeElement.id; if ($('leadPrefs')) $('leadPrefs').innerHTML = leadPrefsHtml(msg); if (f && $(f)) $(f).focus(); };
async function setLeadPref(prefs) {
  try { state.setup = await api('POST', '/api/setup', { prefs }); if (typeof Weed !== 'undefined') Weed.applyPrefs(state.setup.prefs || {}); paintLeadPrefs(t('setup.saved.short')); }
  catch (e) { paintLeadPrefs(); setErr('lead-err', e); }
}
