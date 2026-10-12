/* ---------- ❓ help levels, the Help menu and the Agile intro (AIG-345, AIG-328) ---------- */
// Help level (pref helpLevel): '1' 🐣 all the help, '2' 🙂 some help (the default), '3' 😎 no help.
// First run (when the setup wizard ends): level 1 offers the intro, the tour and demo mode and turns dev-word tooltips on; level 2 offers
// the tour once; level 3 shows nothing. The ❓ Help menu in the top bar always has everything, plus the level switch.
const HELP = { level: '2' };
const HELP_LEVELS = ['1', '2', '3'];

// The demo window comes with ?lang= (its own browser storage has no language yet); read before the language loads.
try {
  const q = new URLSearchParams(location.search), l = q.get('lang');
  if (l && /^[a-z0-9-]{2,15}$/i.test(l) && !localStorage.getItem('aigile.lang')) localStorage.setItem('aigile.lang', l);   // checked against the language list once it loads
} catch {}

async function helpLoad() {
  const s = await api('GET', '/api/setup'); state.setup = s;
  HELP.level = HELP_LEVELS.includes((s.prefs || {}).helpLevel) ? s.prefs.helpLevel : '2';
  return s;
}
// A level takes effect: all the help turns the dev-word tooltips on, no help turns them off, some leaves them as they are.
function helpApply(level) {
  HELP.level = level;
  try { localStorage.setItem('aigile.helpApplied', level); } catch {}
  if (level === '1') setExplain(true); else if (level === '3') setExplain(false);
}
// A level set elsewhere (an invite) is applied once, the first time this browser sees it.
function helpSync() {
  let was = null; try { was = localStorage.getItem('aigile.helpApplied'); } catch {}
  if (was !== HELP.level && (state.setup.prefs || {}).helpLevel) helpApply(HELP.level);
}
async function helpSetLevel(level) {
  try { state.setup = await api('POST', '/api/setup', { prefs: { helpLevel: level } }); } catch (e) { alert(e.message); return; }
  helpApply(level); helpMenuClose();
  if (state.route && state.route.view === 'setup' && $('app')) $('app').innerHTML = renderSetup();
}

/* ---------- the ❓ Help menu ---------- */
function helpMenuClose() { const m = $('helpMenu'); if (m) m.remove(); }
async function helpMenu() {
  if ($('helpMenu')) return helpMenuClose();
  try { await helpLoad(); } catch {}
  const b = $('helpBtn'), r = b.getBoundingClientRect(), m = document.createElement('div');
  m.id = 'helpMenu'; m.setAttribute('role', 'menu');
  m.style.top = r.bottom + 6 + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px';
  const item = (id, fn, key) => `<button type="button" role="menuitem" id="${id}" onclick="helpMenuClose(); ${fn}">${esc(t(key))}</button>`;
  m.innerHTML = item('hmIntro', 'introOpen()', 'help.m.intro') + item('hmTour', 'tourDialog()', 'help.m.tour') + item('hmDemo', 'startTrial()', 'help.m.demo')
    + item('hmGloss', "location.hash = '#/glossary'", 'help.m.gloss') + item('hmInstall', 'installHint()', 'help.m.install') + `<div class="help-sep"></div><div class="help-lvl-h muted">${esc(t('help.m.level'))}</div>`
    + HELP_LEVELS.map(v => `<button type="button" role="menuitemradio" aria-checked="${v === HELP.level}" id="hmLevel${v}" class="${v === HELP.level ? 'on' : ''}" onclick="helpSetLevel('${v}')">${v === HELP.level ? '✓ ' : ''}${esc(t('help.level.' + v))}</button>`).join('');
  document.body.append(m);
}
document.addEventListener('click', e => { if ($('helpMenu') && !e.target.closest('#helpMenu, #helpBtn')) helpMenuClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') helpMenuClose(); });

/* ---------- first run ---------- */
// Called when the wizard ends (done, or "I'll wing it"): offer help by level, once per browser.
async function helpMaybe() {
  let done = false; try { done = localStorage.getItem('aigile.helpOffered') === '1'; } catch {}
  if (done) return;
  try { await helpLoad(); } catch { return; }
  try { localStorage.setItem('aigile.helpOffered', '1'); } catch {}
  helpSync();
  if (HELP.level === '3' || $('dialog').firstChild) return;
  const all = HELP.level === '1', go = fn => `closeDialog(); ${fn}`;
  openDialog(`<h2>${esc(t('help.offer.h'))}</h2><p>${esc(t(all ? 'help.offer.all' : 'help.offer.some'))}</p>
    <div class="help-offer">${all ? `<button class="primary" id="helpGoIntro" onclick="${go('introOpen()')}">${esc(t('help.m.intro'))}</button>` : ''}
      <button ${all ? '' : 'class="primary" '}id="helpGoTour" onclick="${go('tourDialog()')}">${esc(t('help.m.tour'))}</button>
      ${all ? `<button id="helpGoDemo" onclick="${go('startTrial()')}">${esc(t('help.m.demo'))}</button>` : ''}</div>
    <p class="muted">${esc(t('help.offer.later'))}</p>
    <div class="actions"><button id="helpNo" onclick="closeDialog()">${esc(t('help.offer.no'))}</button></div>`, 'help-offer-dlg');
}

/* ---------- 🎓 Agile in 2 minutes: the intro as slides ---------- */
const INTRO = { title: '', slides: [], i: 0 };
async function introOpen() {
  let r; try { r = await api('GET', '/api/intro?lang=' + encodeURIComponent(i18n.lang)); } catch (e) { alert(e.message); return; }
  const parts = String(r.md).replace(/\r/g, '').split(/^## /m), head = parts.shift();
  INTRO.title = (head.match(/^#\s+(.*)$/m) || [, t('help.m.intro')])[1].replace(/^🎓\s*/, '');
  INTRO.slides = parts.map(p => { const [h, ...rest] = p.split('\n'); return { h: h.trim(), body: rest.join('\n').replace(/^\s*---+\s*$/gm, '').trim() }; });
  INTRO.i = 0; introShow();
}
function introShow() {
  const n = INTRO.slides.length, s = INTRO.slides[INTRO.i], last = INTRO.i === n - 1;
  openDialog(`<div class="intro-top muted"><span>🎓 ${esc(INTRO.title)}</span><span id="introStep">${esc(t('help.intro.step', { i: INTRO.i + 1, n }))}</span></div>
    <div id="introSlide" class="intro-slide"><h2>${esc(s.h)}</h2>${md(s.body)}</div>
    <div class="actions">${INTRO.i ? `<button id="introBack" onclick="introMove(-1)">${esc(t('tour.back'))}</button>` : ''}
      <button class="primary" id="introNext" onclick="${last ? 'closeDialog()' : 'introMove(1)'}">${esc(t(last ? 'help.intro.done' : 'tour.next'))}</button>
      ${last ? '' : `<button id="introClose" onclick="closeDialog()">${esc(t('help.intro.close'))}</button>`}</div>`, 'intro');
}
function introMove(d) { INTRO.i = Math.max(0, Math.min(INTRO.slides.length - 1, INTRO.i + d)); introShow(); }
document.addEventListener('keydown', e => {
  if (!$('introSlide')) return;
  if (e.key === 'ArrowRight' && INTRO.i < INTRO.slides.length - 1) introMove(1); else if (e.key === 'ArrowLeft') introMove(-1);
});

/* ---------- start-up ---------- */
// The demo window opens with ?intro=1 when the help level was all the help: the Agile intro is its first step.
async function helpBoot() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('intro') === '1') {
      history.replaceState(null, '', location.pathname + location.hash);
      try { localStorage.setItem('aigile.helpOffered', '1'); } catch {}
      for (let n = 0; n < 20 && $('dialog').firstChild; n++) await new Promise(r => setTimeout(r, 250));
      if (!$('dialog').firstChild) introOpen();
    }
    await helpLoad(); helpSync();
  } catch {}
}
