/* ---------- start-up: routing, polling, new-build prompt ---------- */
// Desktop app (Electron on Windows) loses keyboard focus after a native alert/confirm/prompt box, so text
// boxes ignore typing for a while (AIG-84). After each box, ask the app to hand focus back.
/* ---------- theme (AIG-143): follows the system, or the user's pick, remembered in this browser ---------- */
const THEMES = { get system() { return t('theme.system'); }, get light() { return t('theme.light'); }, get dark() { return t('theme.dark'); } };
function theme(set) {
  let th; try { th = set || localStorage.getItem('aigile.theme') || 'system'; if (set) localStorage.setItem('aigile.theme', set); } catch { th = set || 'system'; }
  if (th === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = th;
  if (/Electron/.test(navigator.userAgent)) location.href = 'aigile://theme/' + th;   // the app's window buttons follow too, also after a restart
  const b = $('themeBtn'); if (b) { b.textContent = THEMES[th]; b.title = t('theme.title', { name: THEMES[th] }); }
  return th;
}
// The same choice as a dropdown, for the Setup page (AIG-143).
const themePickHtml = () => { const cur = theme(); return `<select class="setup-theme" onchange="theme(this.value)">${Object.keys(THEMES).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(THEMES[k])}</option>`).join('')}</select>`; };
// Why a team needs a poke, in your language (AIG-174); older servers only send the English text.
const asleepWhy = a => a.n != null ? t(a.n === 1 ? 'poke.asleep.one' : 'poke.asleep.many', { n: a.n }) : a.why;
const nextTheme = () => { const k = Object.keys(THEMES), cur = theme(); theme(k[(k.indexOf(cur) + 1) % k.length]); };
theme();

// The desktop app has no title bar (AIG-128): the page's own top bar is where you drag the window.
if (/Electron/.test(navigator.userAgent)) document.body.classList.add('desktop');
if (/Electron/.test(navigator.userAgent)) for (const k of ['alert', 'confirm', 'prompt']) {
  const native = window[k].bind(window);
  window[k] = (...a) => { const r = native(...a); location.href = 'aigile://refocus'; return r; };
}
window.addEventListener('hashchange', () => { state.editing = false; refresh(true); });
// The language file is in before the first render (AIG-124).
loadLang().then(() => { theme(); refresh(true); checkBuild(); });
setInterval(() => { if (!document.hidden) refresh(); }, 1000);
setTimeout(morningPrompt, 1500);   // the day's first "Call stand-ups?" (AIG-136)

// Dev builds: when the server or page changes, a small 🆕 Refresh pill floats at the top (AIG-78), above any open
// card so he can reach it mid-reply. It never covers what he's typing and stays until he clicks it.
let loadedBuild = null;
// App logo (AIG-175): the tab icon and the header link use the picture from Setup, else the 🗂️ they start with.
const FAVICON0 = document.getElementById('favicon').getAttribute('href');
function applyAppLogo(url) {
  const f = $('favicon'), b = $('brand');
  if (f.dataset.logo === (url || '')) return;
  f.dataset.logo = url || ''; f.setAttribute('href', url || FAVICON0);
  b.innerHTML = url ? `<img class="brand-logo" src="${esc(url)}" alt=""> AI-gile` : '🗂️ AI-gile';
}
async function checkBuild() {
  if (!i18n.ready) return;
  try {
    const m = await api('GET', '/api/meta');
    if (m.owner && m.owner !== state.owner) { state.owner = m.owner; refresh(true); }
    setNight(m.quiet);
    applyAppLogo(m.appLogo);
    pokeBadge(await api('GET', '/api/projects'));
    // A new install opens Setup first (AIG-91).
    if (loadedBuild === null && m.setupNeeded && location.hash !== '#/setup') location.hash = '#/setup';
    if (loadedBuild === null) { loadedBuild = m.build; return; }
    // A newer version on GitHub (AIG-92): an ⬆ Update pill, until it's applied.
    const u = m.update || {}, upd = u.behind ? `<button class="primary" onclick="applyUpdatePage()" title="${esc((u.subjects || []).join('\n'))}">${esc(t('update.btn'))}</button>` : '';
    if ($('upUpdate').dataset.sig !== upd && !$('upUpdate').dataset.busy) { $('upUpdate').dataset.sig = upd; $('upUpdate').innerHTML = upd; }
    // New server code that the running board hasn't loaded yet (AIG-206): one click restarts it.
    const rs = m.stale ? `<button class="primary" onclick="restartBoard(this)" title="${esc(t('restart.title'))}">${esc(t('restart.btn'))}</button>` : '';
    if ($('upRestart') && $('upRestart').dataset.sig !== rs && !$('upRestart').dataset.busy) { $('upRestart').dataset.sig = rs; $('upRestart').innerHTML = rs; }
    if (m.dev && m.build !== loadedBuild && !$('upRefresh').firstChild)
      $('upRefresh').innerHTML = `<button class="primary" onclick="refreshPage()" title="${esc(t('update.refresh.title'))}">${esc(t('update.refresh'))}</button>`;
  } catch {}
}
async function restartBoard(btn) {
  const box = $('upRestart'); box.dataset.busy = '1'; btn.disabled = true; btn.textContent = t('restart.busy');
  try { await api('POST', '/api/restart'); setTimeout(() => location.reload(), 3500); }
  catch (e) { alert(e.message); box.dataset.busy = ''; btn.disabled = false; btn.textContent = t('restart.btn'); }
}
// Unsent text anywhere (a reply, an answer, a dialog) or pending attachments: ask before losing it.
const okToLeave = what => {
  const unsent = [...document.querySelectorAll('textarea, input[type=text]')].some(el => el.value.trim() && el.value !== el.defaultValue)
    || !!document.querySelector('.att-chip');
  return !unsent || confirm(t('leave.confirm', { what }));
};
// Applies the update; the server restarts itself, so wait a few seconds and reload.
async function applyUpdatePage() {
  if (!okToLeave(t('update.what.update'))) return;
  const box = $('upUpdate'); box.dataset.busy = '1'; box.innerHTML = '<button class="primary" disabled>' + esc(t('update.busy')) + '</button>';
  try { await api('POST', '/api/update/apply'); setTimeout(() => location.reload(), 5000); }
  catch (e) { delete box.dataset.busy; box.dataset.sig = ''; alert(t('update.failed', { msg: e.message })); }
}
function refreshPage() { if (okToLeave(t('update.what.refresh'))) location.reload(); }
// Desktop app only (AIG-83): the app calls this when its own files changed; the pill asks the app to restart itself.
// A restart reloads the page too, so Refresh is hidden while Restart shows (AIG-130).
window.showRestartApp = () => {
  $('upRefresh').hidden = true;
  if (!$('upRestart').firstChild)
    $('upRestart').innerHTML = `<button class="primary" onclick="if (okToLeave(t('update.what.restart'))) location.href = 'aigile://restart'" title="${esc(t('update.restart.title'))}">${esc(t('update.restart'))}</button>`;
};


/* ---------- teams that need a poke: top-bar badge ---------- */
function pokeBadge(projects) {
  const n = projects.filter(p => p.attention), names = n.map(p => p.name + ': ' + (p.attention.kind === 'asleep' ? asleepWhy(p.attention) : t('poke.stuck'))).join('\n');
  const h = n.length ? `<button class="navlink pokebadge" onclick="pokeAll(this)" title="${esc(t('poke.title'))}\n${esc(names)}">${esc(n.length > 1 ? t('poke.many', { n: n.length }) : t('poke.one'))}</button>` : '';
  if ($('pokeTop').innerHTML !== h) $('pokeTop').innerHTML = h;
}
// Tap the badge: wake every asleep team and restart every stuck one, then show the home page.
async function pokeAll(b) {
  b.disabled = true; b.textContent = t('poke.waking');
  const failed = [];
  for (const p of (await api('GET', '/api/projects')).filter(p => p.attention)) {
    const act = p.attention.kind === 'stuck' && p.presence && p.presence.running ? 'restart' : 'wake';
    try { await api('POST', `/api/projects/${p.slug}/${act}`); } catch (e) { failed.push(p.name + ': ' + e.message); }
  }
  if (failed.length) alert(t('poke.failed') + '\n' + failed.join('\n'));
  location.hash = '#/'; refresh(true);
}

/* ---------- going quiet: night theme ---------- */
function setNight(since) {
  document.documentElement.toggleAttribute('data-night', !!since);
  if (window.Inbox) Inbox.repaint();
  $('nightTop').innerHTML = since ? `<button class="navlink" onclick="backFromQuiet()" title="${esc(t('night.since', { when: ago(since) }))}">${esc(t('night.back'))}</button>` : '';
}
// Going quiet asks which projects the 🌙 night watchman should watch: every active one is ticked (AIG-199).
async function goQuiet() {
  let ps = []; try { ps = (await api('GET', '/api/projects')).filter(p => !p.archived); } catch {}
  openDialog(`<h2>${esc(t('quiet.h'))}</h2><p class="muted">${esc(t('quiet.confirm'))}</p>
    <h3>${esc(t('watch.h'))}</h3><p class="muted">${esc(t('watch.help'))}</p>
    <div class="watch-list">${ps.map(p => `<label class="chk"><input type="checkbox" data-watch="${esc(p.slug)}" checked> ${pic(p.logo, p.emoji)} ${esc(p.name)}</label>`).join('')}</div>
    <div class="actions"><button class="primary" onclick="goQuietNow()">${esc(t('quiet.go'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
async function goQuietNow() {
  const watch = [...document.querySelectorAll('#dialog [data-watch]:checked')].map(b => b.dataset.watch);
  closeDialog();
  try {
    const r = await api('POST', '/api/quiet', { on: true, watch });
    setNight(r.quiet);
    alert(t('quiet.sent', { n: r.sent.length, names: r.sent.length ? ': ' + r.sent.join(', ') : '' }) + (r.woke.length ? '\n' + t('quiet.woke', { names: r.woke.join(', ') }) : '') + (r.failed.length ? '\n' + t('quiet.failed', { names: r.failed.join('; ') }) : ''));
    refresh(true);
  } catch (e) { alert(e.message); }
}
// Back from quiet: the night watchman's summary, one line per project (AIG-199).
async function backFromQuiet() {
  try {
    const r = await api('POST', '/api/quiet', { on: false }); setNight(null);
    if (r.summary && r.summary.length) openDialog(`<h2>${esc(t('watch.morning'))}</h2><ul class="watch-sum">${r.summary.map(x => `<li><b>${esc(x.name)}</b>: ${esc(t('watch.line', { h: x.handedOver, d: x.done, w: x.woke }))}${x.restarted.length ? ' · ' + esc(t('watch.restarted', { ids: x.restarted.join(', ') })) : ''}${x.stuck.length ? ` · <span class="su-red">${esc(t('watch.stuck', { ids: x.stuck.join(', ') }))}</span>` : ''}</li>`).join('')}</ul>
      <div class="actions"><button class="primary" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  } catch (e) { alert(e.message); }
}
setInterval(checkBuild, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
