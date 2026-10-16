/* ---------- find my projects (AIG-94) ---------- */
// ---- find my projects: list the project folders in a folder (git, old sessions, README), tick, import ----
async function findProjectsDialog(dir) {
  openDialog(`<h2>${esc(t('dlg.find.h'))}</h2><p class="muted">${esc(t('dlg.find.intro'))}</p>
    <div class="row"><label class="f" style="flex:1"><span>${esc(t('dlg.folder'))}</span><input type="text" id="fp-dir" value="${esc(dir || state.home || '')}"></label>
    <button style="align-self:flex-end" onclick="findProjectsDialog($('fp-dir').value)">${esc(t('dlg.find.look'))}</button></div>
    <div id="fp-list" class="muted">${esc(t('dlg.find.looking'))}</div><div class="err" id="fp-err"></div><div id="fp-done"></div>
    <div class="actions" id="fp-acts"></div>`, 'wide');
  try {
    if (!state.home) state.home = (await api('GET', '/api/meta')).home;
    if (!dir) $('fp-dir').value = state.home;
    state.found = await api('GET', '/api/discover' + (dir ? '?dir=' + encodeURIComponent(dir) : ''));
  } catch (e) { $('fp-list').textContent = ''; setErr('fp-err', e); return; }
  // Card keys are unique (AIG-331): pick a free one for every row up front, the same way the board does, and show it before Add.
  const used = new Set((await api('GET', '/api/projects').catch(() => [])).map(o => o.key));
  state.foundTaken = [...used];
  const keyFor = n => {
    const L = n.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'PRJ';
    const k = [L.slice(0, 3), ...[...L.slice(3)].map(l => L.slice(0, 2) + l), ...[2, 3, 4, 5, 6, 7, 8, 9].map(d => L.slice(0, 2) + d)].find(x => !used.has(x)) || L.slice(0, 2) + Date.now() % 100;
    used.add(k); return k;
  };
  const info = f => [f.git ? t('dlg.find.commits', { count: f.git.commits, n: f.git.commits }) + (f.git.lastAt ? t('dlg.find.last', { when: ago(f.git.lastAt) }) : '') : t('dlg.find.nogit'), f.sessions ? t('dlg.find.sessions', { count: f.sessions.count, n: f.sessions.count }) : '',
    f.known ? t('dlg.find.known') : f.inside ? t('dlg.find.inside', { dir: f.inside }) : f.copy ? t('dlg.find.copy') : ''].filter(Boolean).join(' · ');
  $('fp-list').classList.remove('muted');
  $('fp-list').innerHTML = state.found.length ? state.found.map((f, i) => `<div class="fprow">
    <input type="checkbox" data-i="${i}" ${f.suggested ? 'checked' : ''} ${f.known ? 'disabled' : ''} aria-label="${esc(t('dlg.find.add', { name: f.name }))}">
    <input type="text" class="fp-name" value="${esc(f.name)}" aria-label="${esc(t('dlg.find.name'))}"><input type="text" class="fp-key" value="${esc(f.known ? '' : keyFor(f.name))}" maxlength="6" oninput="checkFoundKeys()" aria-label="${esc(t('dlg.find.key'))}">
    <span class="muted">${esc(info(f))}${f.readme ? ' · ' + esc(f.readme) : ''}</span></div>`).join('') : esc(t('dlg.find.none'));
  $('fp-acts').innerHTML = `<label class="chk"><input type="checkbox" id="fp-connect" checked> ${esc(t('dlg.find.setup'))}</label>
    <label class="chk"><input type="checkbox" id="fp-starter" checked> ${esc(t('dlg.find.starter'))}</label>
    <button class="primary" onclick="importFound()">${esc(t('dlg.find.import'))}</button><button onclick="closeDialog()">${esc(t('common.close'))}</button>`;
}
// A key typed twice (or one an existing project has) is marked at once, not changed silently after Add (AIG-331).
function checkFoundKeys() {
  const seen = {};
  document.querySelectorAll('.fprow').forEach(r => { const k = r.querySelector('.fp-key').value.trim().toUpperCase(); if (k && r.querySelector('input[type=checkbox]').checked) seen[k] = (seen[k] || 0) + 1; });
  document.querySelectorAll('.fprow').forEach(r => {
    const i = r.querySelector('.fp-key'), k = i.value.trim().toUpperCase(), dup = k && ((seen[k] || 0) > 1 || (state.foundTaken || []).includes(k));
    i.classList.toggle('bad', !!dup); i.title = dup ? t('dlg.find.keydup', { key: k }) : '';
  });
}
async function importFound() {
  const rows = [...document.querySelectorAll('.fprow')].filter(r => r.querySelector('input[type=checkbox]').checked);
  if (!rows.length) { setErr('fp-err', t('standup.pick.none')); return; }
  const done = [];
  for (const r of rows) {
    const f = state.found[+r.querySelector('input[type=checkbox]').dataset.i];
    try {
      const body = { name: r.querySelector('.fp-name').value.trim() || f.name, key: r.querySelector('.fp-key').value.trim(), description: f.readme };
      // Two projects that start alike get the same guessed key (AIG-244): if it's taken, the board picks a free one.
      const p = await api('POST', '/api/projects', body).catch(e => /already used/.test(e.message) ? api('POST', '/api/projects', { ...body, key: '' }) : Promise.reject(e));
      if ($('fp-connect').checked) await api('POST', `/api/projects/${p.slug}/connect`, { path: f.path });
      else await api('PATCH', '/api/projects/' + p.slug, { path: f.path });
      if ($('fp-starter').checked) await api('POST', `/api/projects/${p.slug}/starter`, { lang: i18n.lang }).catch(() => {});   // no AI (AIG-340)
      done.push('✅ ' + p.name + ' (' + p.key + ')' + (body.key && p.key !== body.key.toUpperCase() ? ' ' + t('dlg.find.keychanged', { want: body.key.toUpperCase(), key: p.key }) : ''));
    } catch (e) { done.push('⚠️ ' + f.name + ': ' + e.message); }
  }
  $('fp-done').innerHTML = `<ul>${done.map(d => `<li>${esc(d)}</li>`).join('')}</ul><p class="muted">${esc(t('dlg.find.after'))}</p>`;
  $('fp-acts').innerHTML = `<button class="primary" onclick="closeDialog(); rerender()">${esc(t('common.done'))}</button>`;
}

/* ---------- try it as a new user (AIG-201..203) ---------- */
// A fresh, empty copy of the board on its own port, with made-up projects to find: opens in a new window.
// From Setup (a button) or the ❓ Help menu (none). With all the help on, the new window starts with the Agile intro, in this language (AIG-328).
// The demo board speaks your language (AIG-488): it is sent along and opened with ?lang=.
// A small note at the bottom of the page: '' removes it.
function trialNote(msg, bad) {
  let n = $('trialNote'); if (!msg) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement('div'); n.id = 'trialNote'; n.setAttribute('role', 'status'); n.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 14px;border-radius:8px;background:var(--panel,#222);color:var(--text,#fff);border:1px solid var(--line,#888);box-shadow:0 2px 12px #0006;max-width:90vw'; document.body.append(n); }
  n.textContent = (bad ? '⚠️ ' : '') + msg; clearTimeout(n._t); n._t = setTimeout(() => n.remove(), bad ? 8000 : 4000);
}
async function startTrial(btn) {
  const was = btn && btn.textContent, err = $('trial-err');
  if (btn) { btn.disabled = true; btn.textContent = t('trial.busy'); }
  if (err) err.textContent = '';
  if (!btn) trialNote(t('trial.opening'));   // from the Help menu there is no button to show it (AIG-1084)
  try { const r = await api('POST', '/api/trial', { code: LP.code, window: LP.win, lang: chosenLang() }); const w = launchOpen(r.url + '?lang=' + encodeURIComponent(chosenLang()) + (HELP.level === '1' ? '&intro=1' : '')); if (!btn) trialNote(w === null ? t('trial.blocked') : '');   }
  catch (e) { if (err) err.textContent = e.message; else trialNote(e.message, true); }
  if (btn) { btn.disabled = false; btn.textContent = was; }
}

/* ---------- setup page (AIG-91) ---------- */
// ---- setup: your name and where the agent lives on this computer, saved to aigile.local.json ----
function renderSetup() {
  const s = state.setup;
  const secs = ["lang","look","plan","teams","discord","mail","servers","phone","calls","friends","storage","you","more"];
  return `<div class="setup">${state.route && state.route.pop ? '' : popBtn('popOutSetup()', 'id="setupPop"')}<h2>${esc(t('setup.h'))}</h2>
    <p class="muted">${esc(s.needed ? t('setup.welcome') : t('setup.intro'))}</p>${Backups.homeHtml(state.damaged)}
    <div class="set-sec set-wiz" id="wizBox"><button type="button" id="wzRun" onclick="wizardStart()">${esc(t('wz.btn'))}</button><small class="muted">${esc(t('wz.btn.help'))}</small></div>
    <nav class="set-index" id="setIndex" aria-label="${esc(t('setup.index'))}">${secs.map(k => `<a href="#/setup/${k}" data-sec="${k}" onclick="return setupJump('${k}')">${esc(t('setup.sec.' + k))}</a>`).join('')}</nav>
    <section class="set-sec" id="sec-lang"><h3 class="set-h">${esc(t('setup.sec.lang'))}</h3>
    <label class="f"><span>${esc(t('lang.title'))}</span>${langPickHtml('setup-lang')}<small class="muted">${esc(t('setup.lang.help'))}</small></label>
    <div class="f imm-box" id="immBox">${Imm.html()}</div>
    <label class="f chk"><span><input type="checkbox" id="enSwitch" ${ls('aigile.enSwitch') === '1' ? 'checked' : ''} onchange="setEnSwitch(this.checked)"> ${esc(t('lang.en.switch'))}</span><small class="muted">${esc(t('lang.en.help'))}</small></label>
    <label class="f chk"><span><input type="checkbox" id="explainWords" ${glossOn() ? 'checked' : ''} onchange="setExplain(this.checked)"> ${esc(t('gloss.switch'))}</span><small class="muted">${esc(t('gloss.switch.help'))} <a href="#/glossary">${esc(t('gloss.open'))}</a></small></label>
    </section>
    <section class="set-sec" id="sec-look"><h3 class="set-h">${esc(t('setup.sec.look'))}</h3>
    <label class="f"><span>${esc(t('setup.theme'))}</span>${themePickHtml()}<small class="muted">${esc(t('setup.theme.help'))}</small></label>
    <div class="f" id="topbarBox">${Topbar.html()}</div>
    <div class="f" id="iconBox">${iconHtml()}</div>
    <div class="f"><span>${esc(t('logo.app'))}</span>${logoEditor('app-logo', s.logo)}</div>
    <div class="f"><span>${esc(t('face.me'))}</span>${logoEditor('me-pic', s.mePic)}</div>
    <div class="f"><span>${esc(t('face.lib'))}</span>${libraryHtml(s.library)}</div>
    </section>
    <section class="set-sec" id="sec-plan"><h3 class="set-h">${esc(t('setup.sec.plan'))}</h3>
    <div class="f lead-prefs ai-only" id="leadPrefs">${leadPrefsHtml()}</div>
    </section>
    <section class="set-sec" id="sec-teams"><h3 class="set-h">${esc(t('setup.sec.teams'))}</h3>
    <div class="f lead-prefs ai-only" id="mainTeamBox">${mainTeamBoxHtml()}</div>
    <div class="f" id="geminiKeyBox">${(GKEY.set = null, geminiKeyHtml())}</div>
    <div class="f lead-prefs ai-only" id="runInPrefs">${runInHtml()}</div>
    <div class="f" id="rolesBox">${(Roles.reset(), Roles.html())}</div>
    <div class="f" id="presenceBox">${(queueMicrotask(Presence.load), Presence.html())}</div>
    </section>
    <section class="set-sec" id="sec-discord"><h3 class="set-h">${esc(t('setup.sec.discord'))}</h3>
    <div class="f" id="discordBox">${(queueMicrotask(DiscordSetup.load), DiscordSetup.html())}</div>
    </section>
    <section class="set-sec" id="sec-mail"><h3 class="set-h">${esc(t('setup.sec.mail'))}</h3>
    <div class="f" id="mailBox">${Mail.setupHtml()}</div>
    </section>
    <section class="set-sec" id="sec-servers"><h3 class="set-h">${esc(t('setup.sec.servers'))}</h3>
    <div class="f" id="serversBox">${(srvDraft = null, serversHtml())}</div>
    </section>
    <section class="set-sec" id="sec-phone"><h3 class="set-h">${esc(t('setup.sec.phone'))}</h3>
    <div class="f" id="phoneBox">${Phone.html()}</div>
    </section>
    <section class="set-sec" id="sec-calls"><h3 class="set-h">${esc(t('setup.sec.calls'))}</h3>
    <div class="f" id="callsBox">${(CallSetup.reset(), CallSetup.html())}</div>
    </section>
    <section class="set-sec" id="sec-friends"><h3 class="set-h">${esc(t('setup.sec.friends'))}</h3>
    <div class="f" id="dmsFriendsBox">${dmsFriendsHtml()}</div>
    </section>
    <section class="set-sec" id="sec-storage"><h3 class="set-h">${esc(t('setup.sec.storage'))}</h3>
    <div class="f" id="backupsBox">${(Backups.d = undefined, Backups.msg = '', Backups.html())}</div>
    <div class="f" id="storageBox">${(Storage.d = undefined, Storage.html())}</div>
    </section>
    <section class="set-sec" id="sec-you"><h3 class="set-h">${esc(t('setup.sec.you'))}</h3>
    <form id="setupForm" onsubmit="return saveSetupPage(event)">
      ${s.fields.map(f => `<label class="f"><span>${esc(tk('setup.f.' + f.key, f.label))}</span><input type="text" data-key="${esc(f.key)}" value="${esc(f.value)}" ${f.suggest ? `placeholder="${esc(f.suggest)}" data-suggest="${esc(f.suggest)}"` : ''}><small class="muted">${esc(tk('setup.f.' + f.key + '.help', f.help))}</small>${f.suggest && !f.value ? `<small class="suggest"><span class="muted">${esc(t('setup.suggest'))}</span> <code>${esc(f.suggest)}</code> <button type="button" class="usesuggest" onclick="useSuggest(this)">${esc(t('setup.suggest.use'))}</button></small>` : ''}</label>`).join('')}
      <div class="err" id="setup-err"></div><div id="setup-done" class="muted"></div>
      <div class="actions"><button class="primary" type="submit">${esc(t('common.save'))}</button></div></form>
    </section>
    <section class="set-sec" id="sec-more"><h3 class="set-h">${esc(t('setup.sec.more'))}</h3>
    <label class="f chk"><span><input type="checkbox" id="aiOwnList" ${IB.aiOwn() ? 'checked' : ''} onchange="IB.setAiOwn(this.checked)"> ${esc(t('inbox.aiown.switch'))}</span><small class="muted">${esc(t('inbox.aiown.help'))}</small></label>
    <label class="f chk"><span><input type="checkbox" id="powerTools" ${Topbar.power() ? 'checked' : ''} onchange="Topbar.setPower(this.checked)"> ${esc(t('tb.power'))}</span><small class="muted">${esc(t('tb.power.help'))}</small></label>
    <label class="f ai-only"><span>${esc(t('follow.setup'))}</span><select class="setup-theme" id="followMode" onchange="Follow.setMode(this.value)">${['auto', 'button'].map(v => `<option value="${v}" ${Follow.mode() === v ? 'selected' : ''}>${esc(t('follow.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('follow.setup.help'))}</small></label>
    <div class="f" id="enterSendBox">${EnterSend.html()}</div>
    <div class="f noai-box" id="noAiBox">${noAiBoxHtml()}</div>
    <div class="f" id="selfcareBox">${SelfCare.html()}</div>
    <div class="f" id="channelBox">${Channel.html()}</div>
    <div class="f" id="autoStartBox">${AutoStart.html()}</div>
    <div class="f" id="streamerBox">${Streamer.setupHtml()}</div>
    <div class="f" id="licencesBox">${(Lic.reset(), Lic.html())}</div>
    <div class="f" id="secretsBox">${(SEC.list = null, secretsBoxHtml())}</div>
    <div class="f" id="accessReviewBox">${AccessReview.html()}</div>
    <div class="f" id="twitchBox">${TwitchTab.setupHtml()}</div>
    <div class="f" id="dmsRelayBox">${dmsRelayHtml()}</div>
    <div class="f" id="pretendBox">${pretendBoxHtml()}</div>
    <div class="f"><span>${esc(t('trial.h'))}</span><div>${launchPickHtml()}<button type="button" id="trialBtn" onclick="startTrial(this)">${esc(t('trial.btn'))}</button></div><small class="muted">${esc(t('trial.help'))}</small><div class="err" id="trial-err"></div></div>
    </section></div>`;
}
/* ---------- Setup index (AIG-934): links to the sections, #/setup/<section> deep links ---------- */
// A deep link also takes any box id minus "Box" (#/setup/mail, #/setup/dmsRelay). Scrolls clear of the sticky top bar and index.
function setupTarget(sec) { return $('sec-' + sec) || $(sec + 'Box') || $(sec); }
function setupScrollTo(sec) {
  const el = setupTarget(sec), ix = $('setIndex'); if (!el) return false;
  const hdr = document.querySelector('body > header'), h = hdr && getComputedStyle(hdr).position !== 'static' ? hdr.offsetHeight : 0;
  if (ix) ix.style.top = h + 'px';
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - h - (ix ? ix.offsetHeight : 0) - 10);
  return true;
}
// ⧉ Pop out (AIG-1030): Setup in its own window (#/pop-setup); this window goes back to the home page.
function popOutSetup() { popOut('setup', '#/pop-setup', 'aigile-setup', 760, 820); location.hash = '#/'; }
function setupJump(sec) {
  const pop = state.route && state.route.pop;
  history.replaceState(null, '', pop ? '#/pop-setup' : '#/setup/' + sec); state.route = { view: 'setup', sec, ...(pop ? { pop: true } : {}) }; state.setupLanded = location.hash;
  setupScrollTo(sec); return false;
}
// After a render of Setup: land on the section of the link (again once the async boxes have filled in), else stay at the top.
// AIG-1140: the index sits just under the top bar, whatever height that has (it wraps to two rows when chips load).
let setupRO = null;
function setupSyncTop() {
  const ix = $('setIndex'), hdr = document.querySelector('body > header');
  if (ix) ix.style.top = (hdr && getComputedStyle(hdr).position !== 'static' ? hdr.offsetHeight : 0) + 'px';
}
function setupLand() {
  const hdr = document.querySelector('body > header');
  setupSyncTop();
  if (hdr && window.ResizeObserver && !setupRO) { setupRO = new ResizeObserver(setupSyncTop); setupRO.observe(hdr, { box: 'border-box' }); }
  const sec = state.route.sec; if (!sec || state.setupLanded === location.hash) return;
  state.setupLanded = location.hash;
  let n = 0; const go = () => { if (setupScrollTo(sec)) { setTimeout(() => setupScrollTo(sec), 400); setTimeout(() => setupScrollTo(sec), 1200); } else if (++n < 50) setTimeout(go, 100); };
  go();
}
/* ---------- DMs relay address (AIG-309) ---------- */
// Where DMs go through: save the address, or Check it (the board server fetches <relay>/health).
function dmsRelayHtml() {
  setTimeout(() => api('GET', '/api/dms').then(d => { const i = $('dmsRelay'); if (i && !i.value && !i.dataset.t) i.value = d.relay || ''; }).catch(() => {}), 0);
  return `<span>${esc(t('dmsrelay.h'))}</span><input type="text" id="dmsRelay" value="" placeholder="https://relay.example.com" oninput="this.dataset.t=1" autocomplete="off" spellcheck="false">
    <small class="muted">${esc(t('dmsrelay.help'))}</small>
    <div class="actions"><button type="button" id="dmsRelaySave" onclick="saveDmsRelay()">${esc(t('common.save'))}</button> <button type="button" id="dmsRelayCheck" onclick="checkDmsRelay()">${esc(t('dmsrelay.check'))}</button></div>
    <div class="err" id="dmsRelay-err"></div><div class="muted" id="dmsRelay-msg"></div>`;
}
async function saveDmsRelay() {
  setErr('dmsRelay-err', ''); $('dmsRelay-msg').textContent = '';
  try { const d = await api('POST', '/api/dms/settings', { relay: $('dmsRelay').value.trim() }); $('dmsRelay').value = d.relay || ''; $('dmsRelay-msg').textContent = t('setup.saved.short'); }
  catch (e) { setErr('dmsRelay-err', e); }
}
// AIG-1197: the relay check says in plain words what is wrong; the technical reason stays in a small details line.
const relayWhy = r => { const k = 'dmsrelay.why.' + (r.kind || 'unreachable'), v = t(k); return v !== k ? v : PagePoll.plain(r.reason, 0); };
async function checkDmsRelay() {
  setErr('dmsRelay-err', ''); const m = $('dmsRelay-msg'); m.textContent = t('dmsrelay.checking');
  try { const r = await api('POST', '/api/dms/check', { relay: $('dmsRelay').value.trim() }); m.textContent = r.ok ? t('dmsrelay.ok') : t('dmsrelay.bad', { why: relayWhy(r) });
    if (!r.ok && r.reason) { const d = document.createElement('small'); d.className = 'muted'; d.style.display = 'block'; d.textContent = t('dmsrelay.details', { why: r.reason }); m.appendChild(d); } }
  catch (e) { m.textContent = ''; setErr('dmsRelay-err', e); }
}
// A suggested value goes into the box only when the owner says so (AIG-334); Save then keeps it.
function useSuggest(btn) {
  const lab = btn.closest('label'), i = lab.querySelector('input[data-key]');
  i.value = i.dataset.suggest; lab.querySelector('.suggest').remove();
}
async function saveSetupPage(e) {
  e.preventDefault();
  const body = Object.fromEntries([...document.querySelectorAll('#setupForm input[data-key]')].map(i => [i.dataset.key, i.value]));
  const named = (state.setup.fields.find(f => f.key === 'owner') || {}).value;
  try {
    state.setup = await api('POST', '/api/setup', body);
    $('setup-err').textContent = '';
    // What's next (AIG-254): a way on to the projects, and a warning if the agent program isn't there.
    $('setup-done').innerHTML = esc(state.setup.needed ? t('setup.saved.more') : t('setup.saved')) + (state.setup.needed ? '' : ` <a href="#/">${esc(t('setup.next'))}</a>`)
      + (state.setup.agentProblem ? `<div class="err">${esc(t('setup.agent.problem', { msg: state.setup.agentProblem }))}</div>` : '');
    if (!named && body.owner) leadQuiz(state.setup);   // first run: the name is in, so offer "What kind of lead?" once (AIG-235)
  } catch (err) { setErr('setup-err', err); }
  return false;
}

/* ---------- where teams run (AIG-153) ---------- */
// Background (hidden, the board tracks it), a terminal window, VS Code, or the owner's own command with {folder}.
// The default for all is on the Setup page (saved at once); each project can pick its own in 🎨 Look.
const RUN_IN = ['background', 'terminal', 'vscode', 'other'];
const runInSelect = (id, cur, onchange, def) => `<select class="setup-theme" id="${id}" onchange="${onchange}">${(def ? [''] : []).concat(RUN_IN).map(v =>
  `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(v ? t('runin.' + v) : t('runin.default', { where: t('runin.' + def) }))}</option>`).join('')}</select>`;
const runInBlind = where => `<small class="muted runin-blind" ${where === 'background' ? 'hidden' : ''}>${esc(t('runin.blind'))}</small>`;
function runInHtml(msg = '') {
  const pr = leadPrefs(), w = pr.runIn || 'background';
  return `<span>${esc(t('runin.h'))}</span>${runInSelect('runIn', w, 'setRunIn({ runIn: this.value })')}<small class="muted">${esc(t('runin.help'))}</small>
    <label class="f" ${w === 'other' ? '' : 'hidden'}><span>${esc(t('runin.cmd'))}</span><input type="text" id="runCmd" value="${esc(pr.runCmd || '')}" placeholder='cursor "{folder}"' onchange="setRunIn({ runCmd: this.value })"><small class="muted">${esc(t('runin.cmd.help'))}</small></label>
    <label class="f"><span>${esc(t('dispatch.h'))}</span><select class="setup-theme" id="dispatchMode" onchange="setRunIn({ dispatch: this.value })">${['rules', 'haiku', 'lead'].map(v => `<option value="${v}" ${(pr.dispatch || 'haiku') === v ? 'selected' : ''}>${esc(t('dispatch.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('dispatch.help'))}</small></label>
    <label class="f"><span>${esc(t('trust.h'))}</span><select class="setup-theme" id="trustTester" onchange="setRunIn({ trustTester: this.value })">${['check', 'sure', 'all'].map(v => `<option value="${v}" ${(pr.trustTester || 'check') === v ? 'selected' : ''}>${esc(t('trust.opt.' + v))}</option>`).join('')}</select><small class="muted">${esc(t('trust.help'))}</small></label>
    ${runInBlind(w)}<div class="err" id="runin-err"></div><div class="muted">${esc(msg)}</div>`;
}
async function setRunIn(prefs) {
  try { state.setup = await api('POST', '/api/setup', { prefs }); $('runInPrefs').innerHTML = runInHtml(t('setup.saved.short')); }
  catch (e) { setErr('runin-err', e); }
}
/* ---------- 🎨 app icon colours (AIG-400) ---------- */
// The tile's colour and the waiting diamond's: a few presets and a picker. Saved to aigile.local.json; the page's tab
// icon follows at once, the desktop app's taskbar icon the next time it redraws (or after a restart).
const ICON_PRESETS = { main: ['#3b6cf6', '#16a34a', '#ea580c', '#db2777', '#0f172a'], waiting: ['#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#22c55e'] };
function iconHtml(msg = '') {
  const pr = leadPrefs(), c = pr.iconColors || { main: ICON_PRESETS.main[0], waiting: ICON_PRESETS.waiting[0] };
  const row = k => `<div class="logo-edit" id="icon-${k}"><span>${esc(t('icon.' + k))}</span>${ICON_PRESETS[k].map(p => `<button type="button" class="icon-sw" data-c="${p}" style="background:${p};width:26px;height:26px;border-radius:6px;border:2px solid ${p === c[k] ? 'var(--text, #000)' : 'transparent'}" title="${p}" aria-label="${p}" onclick="setIconColors({ ${k}: '${p}' })"></button>`).join('')}
    <input type="color" id="icon-${k}-pick" value="${esc(c[k])}" aria-label="${esc(t('icon.' + k))}" onchange="setIconColors({ ${k}: this.value })"></div>`;
  return `<span>${esc(t('icon.h'))}</span>${row('main')}${row('waiting')}
    <div class="actions"><button type="button" id="iconReset" onclick="setIconColors(null)" ${pr.iconCustom ? '' : 'disabled'}>${esc(t('icon.reset'))}</button></div>
    <small class="muted">${esc(t('icon.help'))}</small><div class="err" id="icon-err"></div><div class="muted">${esc(msg)}</div>`;
}
async function setIconColors(part) {
  const c = (leadPrefs().iconColors) || {};
  try { state.setup = await api('POST', '/api/setup', { prefs: { iconColors: part === null ? null : { ...c, ...part } } }); $('iconBox').innerHTML = iconHtml(t('setup.saved.short')); checkBuild(); }
  catch (e) { setErr('icon-err', e); }
}
/* ---------- 🖥️ my servers (AIG-374) ---------- */
// Name + how you open it (a shortcut/file path, a command, or an ssh address for the ⌨ terminal, AIG-471). Saved to
// aigile.local.json; 🖥️ tasks get an Open button.
let srvDraft = null, srvFound = null;
// 🩺 The relay's latest numbers (AIG-660): one small line under the list.
function healthLine() {
  const st = state.setup || {}, h = st.health, fl = st.serverHealth || [];
  const p = v => v == null ? '?' : Math.round(v) + '%', gb = v => v == null ? '?' : v >= 1e9 ? (v / 1e9).toFixed(1) + ' GB' : Math.round(v / 1e6) + ' MB';
  const line = (x, id) => `<small class="muted" id="${id}">${esc(t('servers.health', { name: x.server || '', cpu: p(x.cpu), mem: p(x.mem), disk: p(x.disk), size: gb(x.storage), days: x.uptime == null ? '?' : Math.floor(x.uptime / 86400), when: new Date(x.at).toLocaleString() }))}</small>`;
  return [h ? line(h, 'srv-health') : '', ...fl.map((x, i) => line(x, 'srv-health-' + i))].filter(Boolean).join('<br>');
}
// AIG-773: an ssh server is host + user (saved together as value, user@host) with optional port, key file and default folder.
const srvSplit = v => { const m = String(v || '').match(/^(ssh:\/\/)?(?:([^@/]+)@)?(.*)$/); return { uri: m[1] || '', user: m[2] || '', host: m[3] || '' }; };
const srvFld = (label, inner) => `<label class="f"><span>${esc(label)}</span>${inner}</label>`;
function srvSshInputs(s, i) {
  const p = srvSplit(s.value);
  return srvFld(t('servers.host'), `<input type="text" data-srv="host" data-i="${i}" value="${esc(p.host)}" placeholder="${esc(t('servers.host'))}" onchange="srvEdit(this)">`)
    + srvFld(t('servers.user'), `<input type="text" data-srv="user" data-i="${i}" value="${esc(p.user)}" placeholder="${esc(t('servers.user'))}" size="10" onchange="srvEdit(this)">`);
}
const srvSshMore = (s, i) => `<div class="srv-more">
    ${srvFld(t('servers.port'), `<input type="number" data-srv="port" data-i="${i}" min="1" max="65535" value="${esc(s.port || '')}" placeholder="${esc(t('servers.port'))}" onchange="srvEdit(this)">`)}
    ${srvFld(t('servers.key'), `<input type="text" data-srv="key" data-i="${i}" value="${esc(s.key || '')}" placeholder="${esc(t('servers.key'))}" onchange="srvEdit(this)">`)}
    ${srvFld(t('servers.folder'), `<input type="text" data-srv="folder" data-i="${i}" value="${esc(s.folder || '')}" placeholder="${esc(t('servers.folder'))}" onchange="srvEdit(this)">`)}</div>${srvPwHtml(s, i)}`;
// AIG-1023: an optional sudo password, so agents allowed sudo can run a server step themselves (aigile sudo). Saved with the secrets
// page token, kept encrypted on this PC (lib/servers.js); the page only learns whether one is saved (sudoPw), never the password.
const srvPwHtml = (s, i) => !String(s.name || '').trim() ? '' : `<div class="srv-pw"><small>${esc(t('servers.sudoPw'))}</small> <b class="pill" data-srv-pw-state="${i}">${esc(t(s.sudoPw ? 'servers.sudoPw.saved' : 'servers.sudoPw.notset'))}</b>
    <input type="password" data-srv-pw="${i}" autocomplete="new-password" spellcheck="false" maxlength="1024" placeholder="${esc(t('servers.sudoPw.ph'))}" aria-label="${esc(t('servers.sudoPw'))}">
    <button type="button" data-srv-pw-save="${i}" onclick="srvPwSave(${i})">${esc(t('servers.sudoPw.save'))}</button>${s.sudoPw ? ` <button type="button" data-srv-pw-remove="${i}" onclick="srvPwSave(${i}, true)">${esc(t('servers.sudoPw.remove'))}</button>` : ''}
    <small class="muted">${esc(t('servers.sudoPw.help'))}</small></div>`;
async function srvPwSave(i, remove) {
  const s = srvDraft[i], inp = document.querySelector(`#serversBox input[data-srv-pw="${i}"]`), v = remove ? '' : (inp || {}).value || '';
  if (!s || (!remove && !v)) return;
  try { if (await api('POST', '/api/servers/sudo-pw', { name: s.name, password: v, token: await secToken() }).then(r => r.set)) s.sudoPw = true; else delete s.sudoPw; srvPaint(t('setup.saved.short')); }
  catch (e) { if (inp) inp.value = ''; setErr('servers-err', e); }
}
function serversHtml(msg = '') {
  if (!srvDraft) srvDraft = (leadPrefs().servers || []).map(x => ({ ...x }));
  const rows = srvDraft.map((s, i) => `<div class="srv-row">
    ${srvFld(t('servers.name'), `<input type="text" data-srv="name" data-i="${i}" value="${esc(s.name)}" placeholder="${esc(t('servers.name'))}" onchange="srvEdit(this)">`)}
    ${srvFld(t('servers.lbl.kind'), `<select data-srv="kind" data-i="${i}" onchange="srvEdit(this)">${['path', 'cmd', 'ssh'].map(k => `<option value="${k}" ${(s.kind || 'path') === k ? 'selected' : ''}>${esc(t('servers.kind.' + k))}</option>`).join('')}</select>`)}
    ${s.kind === 'ssh' ? srvSshInputs(s, i) : srvFld(t('servers.lbl.addr'), `<input type="text" data-srv="value" data-i="${i}" value="${esc(s.value)}" placeholder="${esc(t('servers.' + (s.kind === 'cmd' ? 'cmd' : 'path') + '.ph'))}" onchange="srvEdit(this)">`)}
    ${s.kind === 'ssh' ? srvSshMore(s, i) : ''}
    <label class="srv-sudo"><input type="checkbox" data-srv="sudo" data-i="${i}" ${s.sudo === true || (Array.isArray(s.sudo) && s.sudo.length) ? 'checked' : ''} onchange="srvEdit(this)"> ${esc(t('servers.sudo'))}</label>
    ${s.sudo === true || (Array.isArray(s.sudo) && s.sudo.length) ? `<input type="text" data-srv="sudoWho" data-i="${i}" value="${esc(Array.isArray(s.sudo) ? s.sudo.join(', ') : '')}" placeholder="${esc(t('servers.sudoWho'))}" onchange="srvEdit(this)">` : ''}
    <div class="actions"><button type="button" class="srv-del" onclick="srvDel(${i})" title="${esc(t('servers.remove'))}">${esc(t('servers.del'))}</button></div></div>`).join('');
  const found = (srvFound || []).filter(f => !srvDraft.some(s => s.value === f.path)).map(f => `<button type="button" class="srv-found" data-name="${esc(f.name)}" data-path="${esc(f.path)}" onclick="srvAddFound(this)">+ ${esc(f.name)}</button>`).join(' ');
  return `<span>${esc(t('servers.h'))}</span><small class="muted">${esc(t('servers.help'))}</small>${rows}
    <div><button type="button" onclick="srvAdd()">${esc(t('servers.add'))}</button> <button type="button" id="srvFind" onclick="srvFind()">${esc(t('servers.find'))}</button> ${found}</div>
    ${srvFound && !srvFound.length ? `<small class="muted">${esc(t('servers.none'))}</small>` : ''}${healthLine()}<div class="err" id="servers-err"></div><div class="muted">${esc(msg)}</div>`;
}
const srvPaint = msg => { if ($('serversBox')) $('serversBox').innerHTML = serversHtml(msg); };
async function srvSave() {
  try {
    state.setup = await api('POST', '/api/setup', { prefs: { servers: srvDraft.filter(s => s.name.trim() && s.value.trim() && (s.kind !== 'ssh' || srvSplit(s.value).host)) } });
    const saved = (state.setup.prefs || {}).servers || [];   // AIG-1023: a renamed or removed server lost its sudo password
    srvDraft.forEach(d => { if (saved.some(x => x.name === d.name && x.sudoPw)) d.sudoPw = true; else delete d.sudoPw; });
    srvPaint(t('setup.saved.short'));
  }
  catch (e) { setErr('servers-err', e); }
}
function srvEdit(el) {
  const s = srvDraft[+el.dataset.i], k = el.dataset.srv;
  if (k === 'sudo') { if (el.checked) s.sudo = true; else delete s.sudo; srvPaint(); }   // AIG-701
  else if (k === 'sudoWho') { const n = el.value.split(',').map(x => x.trim()).filter(Boolean); s.sudo = n.length ? n : true; }
  else if (k === 'host' || k === 'user') { const p = srvSplit(s.value); p[k] = el.value.trim(); s.value = p.uri + (p.user ? p.user + '@' : '') + p.host; }   // AIG-773
  else if (k === 'port' || k === 'key' || k === 'folder') { if (el.value.trim()) s[k] = k === 'port' ? +el.value : el.value.trim(); else delete s[k]; }
  else if (k === 'value' && s.kind !== 'ssh' && /^(?:[\w.-]+@[\w.-]+|\d{1,3}(?:\.\d{1,3}){3})$/.test(el.value.trim())) { s.kind = 'ssh'; s.value = el.value.trim(); srvPaint(); }   // AIG-1031: an IP or user@host typed in the box is an ssh address
  else { s[k] = el.value; if (k === 'kind') srvPaint(); }
  srvSave();
}
function srvAdd() { srvDraft.push({ name: '', kind: 'path', value: '' }); srvPaint(); }
function srvDel(i) { srvDraft.splice(i, 1); srvPaint(); srvSave(); }
function srvAddFound(b) { srvDraft.push({ name: b.dataset.name, kind: 'path', value: b.dataset.path }); srvPaint(); srvSave(); }
async function srvFind() { try { srvFound = await api('GET', '/api/servers/shortcuts'); } catch { srvFound = []; } srvPaint(); }

// In 🎨 Look: the command box shows for Other (or the default when that's Other), the warning for anything but background.
function lookRunIn() {
  const def = (leadPrefs().runIn || 'background'), w = $('look-runin').value || def;
  $('look-runcmd-box').hidden = w !== 'other';
  document.querySelector('#dialog .runin-blind').hidden = w === 'background';
}

