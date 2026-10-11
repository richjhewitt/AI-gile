/* ---------- 🧙 setup wizard, advanced mode (AIG-355) ---------- */
// "Advanced" on the first wizard screen: one screen per topic, each pre-filled with what is set now (a first run starts from the
// quick answers: Balanced and Normal). Next saves that screen through POST /api/setup (the prefs; the spend scale is PLANS from
// GET /api/setup); Back and the summary's Edit links never lose a value. The summary lists every choice with an Edit link.
const ADV_SCREENS = ['me', 'lead', 'runs', 'budget', 'parallel', 'usage', 'help', 'dispatch', 'roles', 'night', 'lang', 'summary'];
const ADV_QUIZ = ['tidy', 'chatty', 'go', 'words'];   // the lead quiz questions on the lead screen; 'night' has its own screen
const WA = { screen: 'me', p: {}, explain: true, fromSummary: false };

function advStart() {
  const s = state.setup, pr = s.prefs || {}, first = !pr.wizardSeen;
  WZ.hadOwner = !!wzField('owner').value;
  WZ.name = wzField('owner').value; WZ.agent = wzField('agent.command').value;
  WA.p = { ...pr }; WA.explain = glossOn(); WA.fromSummary = false;
  if (first) { Object.assign(WA.p, wzPrefsOf('balanced'), s.plans.normal); WA.explain = true; delete WA.p.explain; }
  if (!WA.p.helpLevel) WA.p.helpLevel = '2';
  WA.screen = 'me';
  advShow();
}
// Back from a language reload: the wizard opens again on the same screen.
function advResume(screen) { advStart(); WA.screen = screen; advShow(); }

// Take what is on the screen into WA before moving anywhere.
function advKeep() {
  const radio = n => { const r = document.querySelector(`#dialog input[name="${n}"]:checked`); return r ? r.value : null; };
  const num = id => $(id) ? ($(id).value === '' ? '' : Number($(id).value)) : undefined;
  const take = (k, v) => { if (v !== undefined && v !== null) WA.p[k] = v; };
  switch (WA.screen) {
    case 'me': wzKeep(); break;
    case 'lead':
      for (const q of ADV_QUIZ) { const v = radio('wa-' + q); if (v === null) continue; const set = QUIZ.find(x => x[0] === q)[1].find(o => o[0] === v)[1]; if ('explain' in set) WA.explain = set.explain; else Object.assign(WA.p, set); }
      break;
    case 'runs': take('runIn', radio('wa-runIn')); if ($('wa-runCmd')) WA.p.runCmd = $('wa-runCmd').value.trim(); break;
    case 'budget': take('budgetH5', num('wa-budgetH5')); take('budgetWk', num('wa-budgetWk')); if ($('wa-light')) WA.p.light = $('wa-light').checked; break;
    case 'parallel': take('maxRuns', num('wa-maxRuns')); for (const m of ['Opus', 'Sonnet', 'Haiku']) take('helpers' + m, num('wa-helpers' + m)); break;
    case 'usage': take('usageChecks', radio('wa-usage')); break;
    case 'help': take('helpLevel', radio('wa-help')); break;
    case 'dispatch': take('dispatch', radio('wa-dispatch')); break;
    case 'roles': if ($('wa-roles')) { const on = [...document.querySelectorAll('#wa-roles input[data-role]')].filter(i => i.checked).map(i => i.dataset.role); WA.p.newRoles = on.length === TEAM_ROLES.length ? '' : on; } break;
    case 'night': { const v = radio('wa-night'); if (v !== null) WA.p.watchAll = v === 'work'; break; }
  }
}
// The prefs this screen saves.
function advBody() {
  const pick = ks => Object.fromEntries(ks.map(k => [k, WA.p[k]]));
  switch (WA.screen) {
    case 'lead': return pick(['tidyCards', 'chatty', 'go']);
    case 'runs': return pick(['runIn', 'runCmd']);
    case 'budget': return pick(['budgetH5', 'budgetWk', 'light']);
    case 'parallel': return pick(['maxRuns', 'helpersOpus', 'helpersSonnet', 'helpersHaiku']);
    case 'usage': return pick(['usageChecks']);
    case 'help': return pick(['helpLevel']);
    case 'dispatch': return pick(['dispatch']);
    case 'roles': return pick(['newRoles']);
    case 'night': return pick(['watchAll']);
  }
  return {};
}
async function advSave() {
  if (WA.screen === 'lang' || WA.screen === 'summary') return true;
  const body = { prefs: { wizardSeen: true, ...advBody() } };
  if (WA.screen === 'me') {
    if (!WZ.name && !WZ.hadOwner) { setErr('wz-err', t('wz.need.name')); return false; }
    if (WZ.name) body.owner = WZ.name;
    if (WZ.agent) body['agent.command'] = WZ.agent;
  }
  try {
    state.setup = await api('POST', '/api/setup', body);
    if (WA.screen === 'lead') setExplain(WA.explain);
    if (WA.screen === 'help') helpApply(WA.p.helpLevel);
    return true;
  } catch (e) { setErr('wz-err', e); return false; }
}
async function advNext(skip) {
  advKeep();
  if (!skip && !(await advSave())) return;
  const i = ADV_SCREENS.indexOf(WA.screen);
  WA.screen = WA.fromSummary ? 'summary' : ADV_SCREENS[i + 1]; WA.fromSummary = false;
  advShow();
}
function advBack() {
  advKeep();
  if (WA.screen === 'me' && !WA.fromSummary) { WZ.step = 1; wizardShow(); return; }
  const i = ADV_SCREENS.indexOf(WA.screen);
  WA.screen = WA.fromSummary ? 'summary' : ADV_SCREENS[i - 1]; WA.fromSummary = false;
  advShow();
}
function advEdit(screen) { WA.screen = screen; WA.fromSummary = true; advShow(); }
function advPlan(k) { advKeep(); Object.assign(WA.p, state.setup.plans[k]); advShow(); }
function advLang(l) {
  try { sessionStorage.setItem('aigile.wzAdv', 'lang'); } catch {}
  setLang(l);
}

function advBodyHtml() {
  const p = WA.p, h = k => `<h2>${esc(t(k))}</h2>`, sub = k => `<p class="muted">${esc(t(k))}</p>`;
  const opt = (name, val, cur, label, help = '', on = '') => `<label class="quiz-opt wz-opt"><input type="radio" name="${name}" value="${val}" ${String(cur) === String(val) ? 'checked' : ''} ${on ? `onchange="${on}"` : ''}> <span>${esc(label)}${help ? `<small class="muted"> ${esc(help)}</small>` : ''}</span></label>`;
  const num = (k, label, max) => `<label class="f"><span>${esc(t(label))}</span><input type="number" id="wa-${k}" min="0" max="${max}" value="${p[k] ?? ''}" style="width:5em"></label>`;
  switch (WA.screen) {
    case 'me': {
      const g = wzField('agent.command').suggest;
      return `${h('wz.2.h')}
      <label class="f"><span>${esc(t('wz.2.name'))}</span><input type="text" id="wz-name" value="${esc(WZ.name)}" maxlength="80" autocomplete="off"><small class="muted">${esc(t('wz.2.name.help'))}</small></label>
      <label class="f"><span>${esc(t('wz.2.agent'))}</span><input type="text" id="wz-agent" value="${esc(WZ.agent)}" placeholder="${esc(g)}" autocomplete="off" spellcheck="false"><small class="muted">${esc(t('wz.2.agent.help'))}</small>
      ${g && !WZ.agent ? `<small class="suggest"><span class="muted">${esc(t('setup.suggest'))}</span> <code>${esc(g)}</code> <button type="button" id="wzUse" onclick="$('wz-agent').value = ${esc(JSON.stringify(g))}; this.closest('.suggest').remove()">${esc(t('setup.suggest.use'))}</button></small>` : ''}</label>`;
    }
    case 'lead': return `${h('wz.adv.lead.h')}${sub('wz.adv.lead.sub')}${ADV_QUIZ.map(q => {
      const opts = QUIZ.find(x => x[0] === q)[1], cur = q === 'words' ? WA.explain : null;
      return `<div class="quiz-q"><b>${esc(t('quiz.' + q))}</b><div class="wz-opts">${opts.map(([a, set]) => {
        const on = q === 'words' ? set.explain === cur : Object.entries(set).every(([f, v]) => p[f] === v);
        return `<label class="quiz-opt wz-opt"><input type="radio" name="wa-${q}" value="${a}" ${on ? 'checked' : ''}> <span>${esc(t('quiz.' + q + '.' + a))}</span></label>`; }).join('')}</div></div>`; }).join('')}`;
    case 'runs': return `${h('wz.adv.runs.h')}${sub('runin.help')}<div class="wz-opts">${RUN_IN.map(v => opt('wa-runIn', v, p.runIn || 'background', t('runin.' + v), '', `$('wa-cmdrow').hidden = this.value !== 'other'`)).join('')}</div>
      <label class="f" id="wa-cmdrow" ${p.runIn === 'other' ? '' : 'hidden'}><span>${esc(t('runin.cmd'))}</span><input type="text" id="wa-runCmd" value="${esc(p.runCmd || '')}" placeholder='cursor "{folder}"'><small class="muted">${esc(t('runin.cmd.help'))}</small></label>`;
    case 'budget': {
      const plan = Object.keys(state.setup.plans).find(k => Object.entries(state.setup.plans[k]).every(([f, v]) => p[f] === v)) || '';
      const slider = (k, label) => `<label class="f"><span>${esc(t(label))}: <b id="wa-${k}-v">${esc(t('wz.adv.pct', { n: p[k] }))}</b></span><input type="range" id="wa-${k}" min="1" max="100" value="${p[k]}" oninput="$('wa-${k}-v').textContent = t('wz.adv.pct', { n: this.value })"></label>`;
      return `${h('wz.adv.budget.h')}${sub('wz.adv.budget.sub')}<div class="wz-opts">${WZ_PLANS.map(k => opt('wa-plan', k, plan, t('budget.plan.' + k), t('wz.plan.' + k + '.help'), `advPlan('${k}')`)).join('')}</div>
        ${slider('budgetH5', 'budget.h5')}${slider('budgetWk', 'budget.wk')}<small class="muted">${esc(t('budget.help'))}</small>
        <label class="f chk"><span><input type="checkbox" id="wa-light" ${p.light ? 'checked' : ''}> ${esc(t('lead.light'))}</span><small class="muted">${esc(t('lead.light.help'))}</small></label>`;
    }
    case 'parallel': return `${h('wz.adv.parallel.h')}${sub('wz.adv.parallel.sub')}${num('maxRuns', 'budget.runs', 50)}<small class="muted">${esc(t('budget.runs.help'))}</small>
      ${['Opus', 'Sonnet', 'Haiku'].map(m => num('helpers' + m, 'budget.helpers.' + m.toLowerCase(), 50)).join('')}<small class="muted">${esc(t('budget.helpers.help'))}</small>`;
    case 'usage': return `${h('wz.adv.usage.h')}${sub('wz.adv.usage.cost')}<div class="wz-opts">${['off', 'hand', 'auto'].map(v => opt('wa-usage', v, p.usageChecks, t('budget.usage.' + v), t('wz.adv.usage.' + v))).join('')}</div>`;
    case 'help': return `${h('wz.adv.help.h')}<div class="wz-opts">${['1', '2', '3'].map(v => opt('wa-help', v, p.helpLevel, t('wz.adv.help.' + v))).join('')}</div>`;
    case 'dispatch': return `${h('wz.adv.dispatch.h')}<div class="wz-opts">${['rules', 'haiku', 'lead'].map(v => opt('wa-dispatch', v, p.dispatch || 'haiku', t('dispatch.' + v), t('wz.adv.dispatch.' + v))).join('')}</div>`;
    case 'roles': return `${h('wz.adv.roles.h')}${sub('wz.adv.roles.sub')}<div class="wz-opts" id="wa-roles">${TEAM_ROLES.map((r, i) => `<label class="chk"><input type="checkbox" data-role="${esc(r)}" ${!i || !Array.isArray(p.newRoles) || p.newRoles.includes(r) ? 'checked' : ''} ${i ? '' : 'disabled'}> ${esc(r)}</label>`).join('')}</div>`;
    case 'night': return `${h('wz.adv.night.h')}${sub('wz.adv.night.sub')}<b>${esc(t('quiz.night'))}</b><div class="wz-opts">${opt('wa-night', 'quiet', p.watchAll ? 'work' : 'quiet', t('quiz.night.quiet'))}${opt('wa-night', 'work', p.watchAll ? 'work' : 'quiet', t('quiz.night.work'))}</div>`;
    case 'lang': return `${h('wz.adv.lang.h')}${sub('wz.adv.lang.sub')}<label class="f"><span>${esc(t('lang.title'))}</span>${langPickHtml('wz-lang').replace('onchange="setLang(this.value)"', 'onchange="advLang(this.value)"')}</label>`;
    case 'summary': {
      const pr = state.setup.prefs || {}, lim = v => (v === '' || v === undefined ? t('wz.adv.val.nolimit') : v);
      const q = (k, a) => t('quiz.' + k + '.' + a);
      const rows = {
        me: `${wzField('owner').value}${wzField('agent.command').value ? ', ' + wzField('agent.command').value : ''}`,
        lead: t('wz.adv.val.lead', { tidy: q('tidy', pr.tidyCards ? 'yes' : 'no'), chatty: q('chatty', pr.chatty ? 'chatty' : 'quiet'), go: q('go', pr.go === 'ask' ? 'ask' : 'small'), words: q('words', glossOn() ? 'plain' : 'dev') }),
        runs: t('runin.' + (pr.runIn || 'background')) + (pr.runIn === 'other' && pr.runCmd ? ': ' + pr.runCmd : ''),
        budget: t('wz.adv.val.budget', { h: pr.budgetH5, w: pr.budgetWk }) + (pr.light ? ', ' + t('wz.adv.val.light') : ''),
        parallel: `${t('wz.adv.val.runs', { n: pr.maxRuns || t('wz.adv.val.nolimit') })}; ${t('wz.adv.val.helpers', { o: lim(pr.helpersOpus), s: lim(pr.helpersSonnet), h: lim(pr.helpersHaiku) })}`,
        usage: t('budget.usage.' + pr.usageChecks),
        help: t('wz.adv.help.' + (pr.helpLevel || '2')),
        dispatch: t('dispatch.' + (pr.dispatch || 'haiku')),
        roles: Array.isArray(pr.newRoles) ? pr.newRoles.join(', ') : t('wz.adv.val.allroles'),
        night: t('quiz.night.' + (pr.watchAll ? 'work' : 'quiet')),
        lang: LANGS[chosenLang()],
      };
      return `${h('wz.adv.sum.h')}${sub('wz.adv.sum.sub')}<table class="wz-sum">${Object.entries(rows).map(([k, v]) => `<tr data-row="${k}"><th>${esc(t('wz.adv.row.' + k))}</th><td>${esc(v)}</td><td><button type="button" class="link" onclick="advEdit('${k}')">${esc(t('wz.adv.edit'))}</button></td></tr>`).join('')}</table>`;
    }
  }
  return '';
}
function advShow() {
  const i = ADV_SCREENS.indexOf(WA.screen), last = WA.screen === 'summary', n = ADV_SCREENS.length;
  const dots = `<div class="wz-dots" aria-label="${esc(t('wz.step', { n: i + 1, of: n }))}">${ADV_SCREENS.map((_, j) => `<span class="wz-dot ${j === i ? 'on' : j < i ? 'past' : ''}"></span>`).join('')}</div>`;
  const canSkip = !last && WA.screen !== 'me' && WA.screen !== 'lang';
  openDialog(`${dots}<div id="wa-body">${advBodyHtml()}</div><div class="err" id="wz-err"></div>
    <div class="actions"><button id="wzBack" onclick="advBack()">${esc(t('wz.back'))}</button>${canSkip ? `<button id="wzSkip" onclick="advNext(true)">${esc(t('wz.skip'))}</button>` : ''}
    ${last ? `<button class="primary" id="wzDone" onclick="wizardClose()">${esc(t('wz.done'))}</button>` : `<button class="primary" id="wzNext" onclick="advNext()">${esc(t(WA.fromSummary ? 'wz.adv.save' : 'wz.next'))}</button>`}</div>`, 'wizard');
}
