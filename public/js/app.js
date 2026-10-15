/* ---------- start-up: routing, polling, new-build prompt ---------- */
// Desktop app (Electron on Windows) loses keyboard focus after a native alert/confirm/prompt box, so text
// boxes ignore typing for a while (AIG-84). After each box, ask the app to hand focus back.
/* ---------- theme (AIG-143): follows the system, or the user's pick, remembered in this browser ---------- */
const THEMES = { get system() { return t('theme.system'); }, get light() { return t('theme.light'); }, get dark() { return t('theme.dark'); }, get black() { return t('theme.black'); } };
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
// Night watch (AIG-516): a team the board pokes itself has auto set (no pill); one it can't poke has held, with the reason.
const heldWhy = a => a.held ? t('poke.held.' + a.held.why, { n: a.held.n, cap: a.held.cap, path: a.held.path }) : '';
const asleepWhy = a => a.n != null ? t(a.n === 1 ? 'poke.asleep.one' : 'poke.asleep.many', { n: a.n }) : a.why;
const nextTheme = () => { const k = Object.keys(THEMES), cur = theme(); theme(k[(k.indexOf(cur) + 1) % k.length]); };
theme();

// The desktop app has no title bar (AIG-128): the page's own top bar is where you drag the window.
if (/Electron/.test(navigator.userAgent)) document.body.classList.add('desktop');
// Every pop-out window (card, list, glance, terminal, dialog) gets a real bar to drag it by (AIG-780): the ::before bar
// didn't move the window. Last in the page, so no full-window overlay's no-drag covers it.
if (/Electron/.test(navigator.userAgent) && /^#\/pop/.test(location.hash)) {
  document.body.classList.add('popwin');
  const bar = document.createElement('div'); bar.id = 'popDrag'; document.body.appendChild(bar);
}
// The top bar sits over an open card (AIG-733): the card starts below it (10-topbar.css), so it needs the bar's height.
{ const hdr = document.querySelector('body > header'); if (hdr && window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--hdr-h', hdr.offsetHeight + 'px')).observe(hdr); }
if (/Electron/.test(navigator.userAgent)) for (const k of ['alert', 'confirm', 'prompt']) {
  const native = window[k].bind(window);
  window[k] = (...a) => { const r = native(...a); location.href = 'aigile://refocus'; return r; };
}
// A new page opens at the top (AIG-925): the inbox used to open as far down as the board had been scrolled.
// Opening or closing a card on the same board keeps the board where it was.
const pageOf = h => h.replace(/^(#\/p\/[^/]+)\/.*$/, '$1').replace(/^(#\/setup)\/.*$/, '$1');
let lastPage = pageOf(location.hash);
let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  if (popAutoHash(location.hash, lastHash)) return;
  lastHash = location.hash;
  state.editing = false; state.setupLanded = null;
  const pg = pageOf(location.hash); if (pg !== lastPage) { lastPage = pg; window.scrollTo(0, 0); }
  refresh(true);
});
// The language file is in before the first render (AIG-124). If it or the first /api/meta fails (a restart, a half-written
// file mid-update), the page says "Updating… retrying" and starts again with backoff (AIG-517, see Boot in index.html).
(function start() {
  loadLang().then(() => Phone.ready()).then(() => api('GET', '/api/meta')).then(async m => {   // a phone pairs first (AIG-868)
    if (!Boot.ok()) return;   // a script broke meanwhile: the page reloads instead
    state.servers = m.servers || []; state.terms = m.terms || []; state.srvAccess = m.srvAccess || {};
    NoAi.apply(m.noAi, m.noAiBuild);
    theme(); await Streamer.start(); await IB.load(true).catch(() => {}); await Dms.reload(); refresh(true); checkBuild(); NoTokens.start(); Tired.start(); Swarm.start(); Hyperfocus.start(); Weed.start(); UsageGlance.start(); helpBoot();
  }, e => Boot.again(start, e));
})();
let lastPageTick = 0;
PagePoll.every(async () => {
  const now = Date.now(), liveView = state.route && (state.route.view === 'inbox' || state.route.view === 'project' && state.route.card);
  if (liveView || now - lastPageTick >= 3000) { lastPageTick = now; await refresh(); await ScrumGlance.tick(); }
}, 1000);
PagePoll.every(() => OpenCard.tick(), 1000, { home: true });
setTimeout(morningPrompt, 1500);   // the day's first "Call stand-ups?" (AIG-136)

// Dev builds: when the server or page changes, a small 🆕 Refresh pill floats at the top (AIG-78), above any open
// card so he can reach it mid-reply. It never covers what he's typing and stays until he clicks it.
let loadedBuild = null;
// App logo (AIG-175): the tab icon and the header link use the picture from Setup, else the app icon they start with (AIG-1017).
const FAVICON0 = document.getElementById('favicon').getAttribute('href');
// App icon colours (AIG-400): with no picture but custom colours, the tab icon is the board mark in them, with the
// waiting diamond while the title has a count (inbox-top.js).
let appIcon = null;
function applyAppLogo(url, icon) {
  if (icon !== undefined) appIcon = icon;
  const f = $('favicon'), b = $('brand'), w = /^\(\d+\)/.test(document.title) ? 1 : 0;
  const href = url || (appIcon ? `/api/app-icon.svg?waiting=${w}&v=${appIcon.v}` : FAVICON0), key = href + '|' + (url || '');
  if (f.dataset.logo === key) return;
  f.dataset.logo = key; f.setAttribute('href', href);
  b.innerHTML = url ? `<img class="brand-logo" src="${esc(url)}" alt=""> AI-gile` : '<img class="brand-logo" src="icons/icon-192.png" alt=""> AI-gile';
}
let wasQuiet = null;   // was the board quiet at the last check (AIG-232)
let checkingBuild = false;
async function checkBuild() {
  if (!i18n.ready || checkingBuild) return;
  checkingBuild = true;
  try {
    const m = await api('GET', '/api/meta');
    // Quiet/focus flags affect the title and alerts in other windows too.
    if (document.hidden) {
      setNight(m.quiet);
      document.documentElement.toggleAttribute('data-focus', !!(m.focus && m.focus.project) && location.hash !== '#/pop-night');
      IB.paintTop(); return;
    }
    NoAi.apply(m.noAi, m.noAiBuild);   // 🚫 (AIG-581)
    if (m.owner && m.owner !== state.owner) { state.owner = m.owner; refresh(true); }
    // Quiet ended by itself at the wake-up time (AIG-232): show what happened overnight.
    if (wasQuiet && !m.quiet) api('GET', '/api/quiet/morning').then(x => { if (x.summary) showMorning(x.summary); }).catch(() => {});
    if (wasQuiet !== m.quiet) setNight(m.quiet); wasQuiet = m.quiet;
    quietTimeChip(m.quietTime);   // change calendar (AIG-615)
    Focus.watch(m.focus);   // 🎯 focus mode (AIG-395)
    applyAppLogo(m.appLogo, m.appIcon);
    if (JSON.stringify([m.servers || [], m.terms || [], m.srvAccess || {}]) !== JSON.stringify([state.servers, state.terms, state.srvAccess || {}])) { state.servers = m.servers || []; state.terms = m.terms || []; state.srvAccess = m.srvAccess || {}; refresh(true); }   // ⌨ terms: the ones with an ssh address (AIG-471)   // My servers (AIG-374)
    if ((m.ownerPic || '') !== (state.ownerPic || '')) { state.ownerPic = m.ownerPic || ''; refresh(true); }   // your picture (AIG-150)
    pokeBadge(await PagePoll.get('/api/projects'));
    Assumptions.watch();   // the count on the 🌙 Assumptions link (AIG-477)
    Mail.watch();   // ✉️ the Mail link shows once a mailbox is set up (AIG-902)
    WhatsNew.check();   // ✨ a note once after an update (AIG-562)
    // A new install opens Setup first (AIG-91), once and only from the home page (AIG-1068); after that Home shows a 'Finish setup' line and links open where they point.
    if (loadedBuild === null && m.setupNeeded && /^(#\/?)?$/.test(location.hash)) { let once = false; try { once = !localStorage.getItem('aigile.setupSent'); if (once) localStorage.setItem('aigile.setupSent', '1'); } catch {} if (once) location.hash = '#/setup'; }
    if (JSON.stringify(m.damaged || []) !== JSON.stringify(state.damaged || [])) { state.damaged = m.damaged || []; if (state.route && state.route.view === 'home') refresh(true); }   // ⚠️ a damaged board or settings file (AIG-1261)
    if (!!m.setupNeeded !== !!state.setupNeeded) { state.setupNeeded = !!m.setupNeeded; if (state.route && state.route.view === 'home') refresh(true); }
    if (loadedBuild === null) { loadedBuild = m.build; return; }
    // While you're quiet (AIG-224): a new board or page code reloads by itself, unless something is half-typed.
    if (m.quiet && m.build !== loadedBuild && !hasUnsent()) { afterCall('reload', () => location.reload()); return; }
    // A newer version on GitHub (AIG-92): an ⬆ Update pill, until it's applied.
    const u = m.update || {}, upd = u.behind ? `<button class="primary" onclick="applyUpdatePage()" title="${esc((u.subjects || []).join('\n'))}">${esc(t('update.btn'))}</button>` : '';
    if ($('upUpdate').dataset.sig !== upd && !$('upUpdate').dataset.busy) { $('upUpdate').dataset.sig = upd; $('upUpdate').innerHTML = upd; }
    // New server code that the running board hasn't loaded yet (AIG-206): one click restarts it.
    const rs = m.stale ? `<button class="primary" onclick="restartBoard(this)" title="${esc(t('restart.title'))}">${esc(t('restart.btn'))}</button>` : '';
    if ($('upRestart') && $('upRestart').dataset.sig !== rs && !$('upRestart').dataset.busy) { $('upRestart').dataset.sig = rs; $('upRestart').innerHTML = rs; }
    // Restarting reloads the page too (AIG-346), so while a restart is due, Refresh doesn't show as well.
    if (m.stale) $('upRefresh').innerHTML = '';
    else if (m.dev && m.build !== loadedBuild && !$('upRefresh').firstChild)
      $('upRefresh').innerHTML = `<button class="primary" onclick="refreshPage()" title="${esc(t('update.refresh.title'))}">${esc(t('update.refresh'))}</button>`;
  } catch {}
  finally { checkingBuild = false; }
}
// After a queued restart: reload as soon as a new board (a new start time in its build id) answers.
function waitForNewBoard() {
  const startedOf = b => String(b || "").split("-")[0], was = startedOf(loadedBuild);
  const tick = PagePoll.every(async () => { try { const m = await api("GET", "/api/meta"); if (startedOf(m.build) !== was) { tick(); afterCall('reload', () => location.reload()); } } catch {} }, 3000);
}
async function restartBoard(btn) {
  if (onCall()) { btn.disabled = true; btn.textContent = t('callhold.btn'); afterCall('restart', () => restartBoard(btn)); return; }   // AIG-1242: not while on a call
  const box = $('upRestart'); box.dataset.busy = '1'; btn.disabled = true; btn.textContent = t('restart.busy');
  try {
    const r = await api('POST', '/api/restart');
    // Teams busy (AIG-213): it waits for them, then restarts by itself; the page reloads once the new board answers.
    if (r.queued) { btn.textContent = t('restart.queued', { names: r.waitingFor.join(', ') }); waitForNewBoard(); }
    else setTimeout(() => afterCall('reload', () => location.reload()), 3500);
  }
  catch (e) { alert(e.message); box.dataset.busy = ''; btn.disabled = false; btn.textContent = t('restart.btn'); }
}
// AIG-1242: nothing reloads or restarts the page while you are on a call (it would drop it). afterCall runs fn now, or once the call ends
// (one waiting action per key) and shows a small note meanwhile. Call.active() is in calls.js.
const onCall = () => typeof Call !== 'undefined' && !!Call.active && Call.active();
const heldAfterCall = new Map(); let heldTimer = 0;
function heldNote() {
  let n = document.getElementById('callHold');
  if (!heldAfterCall.size) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement('div'); n.id = 'callHold'; n.setAttribute('role', 'status'); n.style.cssText = 'position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;max-width:calc(100vw - 32px);padding:6px 14px;border-radius:99px;font-size:13px;background:var(--panel);color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow);text-align:center'; document.body.appendChild(n); }
  n.textContent = t('callhold.note');
}
function afterCall(key, fn) {
  if (!onCall()) { fn(); return false; }
  heldAfterCall.set(key, fn); heldNote();
  if (!heldTimer) heldTimer = setInterval(() => {
    if (onCall()) return;
    clearInterval(heldTimer); heldTimer = 0;
    const fns = [...heldAfterCall.values()]; heldAfterCall.clear(); heldNote(); fns.forEach(f => f());
  }, 1000);
  return true;
}
// Unsent text anywhere (a reply, an answer, a dialog) or pending attachments: ask before losing it.
const hasUnsent = () => [...document.querySelectorAll('textarea, input[type=text]')].some(el => el.value.trim() && el.value !== el.defaultValue)
  || !!document.querySelector('.att-chip');
// AIG-1022: marked reply boxes are kept as drafts (core.js, Messages > 📝 Drafts), so they never ask. AIG-1120: anything else unsent
// (a half-filled new-card form, pending attachments) asks first, in the app's own small box. Resolves true to carry on.
const hasUndrafted = () => [...document.querySelectorAll('textarea:not([data-draft]), input[type=text]')].some(el => el.value.trim() && el.value !== el.defaultValue)
  || !!document.querySelector('.att-chip');
// AIG-1297: a reload (language switch, Refresh, update, restart) keeps what you typed: unsent text in boxes with an id or name is
// carried over in this tab's sessionStorage and put back when the same box shows again, so nothing asks first.
const CARRY_KEY = 'aigile.carry';
function carryUnsent() {
  const keep = [...document.querySelectorAll('textarea:not([data-draft]), input[type=text]')]
    .filter(el => el.value.trim() && el.value !== el.defaultValue && (el.id || el.name)).map(el => ({ id: el.id, name: el.name, v: el.value, hash: location.hash }));
  const newcard = keep.some(k => /^f-/.test(k.id) && document.querySelector('#dialog #' + CSS.escape(k.id)));   // a half-filled New card form opens again
  try { if (keep.length) sessionStorage.setItem(CARRY_KEY, JSON.stringify({ at: Date.now(), keep, newcard })); } catch {}
}
(function restoreCarried() {
  let c; try { c = JSON.parse(sessionStorage.getItem(CARRY_KEY) || 'null'); sessionStorage.removeItem(CARRY_KEY); } catch { return; }
  if (!c || !Array.isArray(c.keep) || Date.now() - c.at > 120e3) return;
  let left = c.keep;
  const put = () => {
    left = left.filter(k => {
      const el = k.id ? document.getElementById(k.id) : document.querySelector(`[name="${CSS.escape(k.name)}"]`);
      if (!el || !('value' in el)) return true;
      if (!el.value.trim() || el.value === el.defaultValue) { el.value = k.v; el.dispatchEvent(new Event('input', { bubbles: true })); }
      return false;
    });
    if (!left.length) mo.disconnect();
  };
  const mo = new MutationObserver(put);
  let tries = 0;
  const start = () => {
    if (c.newcard) { if (!(typeof i18n !== 'undefined' && i18n.ready && typeof state !== 'undefined' && state.route && typeof newCard === 'function')) { if (++tries < 150) setTimeout(start, 200); return; } c.newcard = false; newCard(); }
    put(); if (left.length) { mo.observe(document.body, { childList: true, subtree: true }); setTimeout(() => mo.disconnect(), 30e3); } };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, { once: true }) : start();
})();
function okToLeave(what) {
  carryUnsent();
  if (!document.querySelector('.att-chip')) return Promise.resolve(true);   // only files waiting to be sent can't be carried over
  return new Promise(res => {
    const box = document.createElement('div'); box.id = 'leaveBox'; box.className = 'overlay center top'; box.style.position = 'fixed';
    const done = v => { box.remove(); document.removeEventListener('keydown', onKey, true); res(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    box.innerHTML = `<div class="dialog sure"><h2>${esc(t('leave.undrafted.h'))}</h2><p>${esc(t('leave.undrafted', { what }))}</p><div class="actions"><button type="button" id="leaveNo">${esc(t('common.cancel'))}</button><button type="button" class="primary" id="leaveYes">${esc(what)}</button></div></div>`;
    document.body.appendChild(box); document.addEventListener('keydown', onKey, true);
    box.querySelector('#leaveNo').onclick = () => done(false); box.querySelector('#leaveYes').onclick = () => done(true);
    box.querySelector('#leaveNo').focus();
  });
}
// Applies the update; the server restarts itself, so wait a few seconds and reload.
async function applyUpdatePage() {
  if (!(await okToLeave(t('update.what.update')))) return;
  if (onCall()) { afterCall('update', applyUpdatePage); return; }   // AIG-1242
  const box = $('upUpdate'); box.dataset.busy = '1'; box.innerHTML = '<button class="primary" disabled>' + esc(t('update.busy')) + '</button>';
  try { await api('POST', '/api/update/apply'); setTimeout(() => afterCall('reload', () => location.reload()), 5000); }
  catch (e) { delete box.dataset.busy; box.dataset.sig = ''; alert(t('update.failed', { msg: e.message })); }
}
async function refreshPage() { if (await okToLeave(t('update.what.refresh'))) afterCall('reload', () => location.reload()); }
// Desktop app only (AIG-83): the app calls this when its own files changed; the pill asks the app to restart itself.
// A restart reloads the page too, so Refresh is hidden while Restart shows (AIG-130).
window.showRestartApp = () => {
  // While you're quiet (AIG-224) the app restarts itself; your pop-outs come back where they were.
  if (document.documentElement.hasAttribute('data-night') && !hasUnsent()) { afterCall('app', () => { location.href = 'aigile://restart'; }); return; }
  $('upRefresh').hidden = true;
  if (!$('upRestart').firstChild)
    $('upRestart').innerHTML = `<button class="primary" onclick="okToLeave(t('update.what.restart')).then(ok => { if (ok) afterCall('app', () => { location.href = 'aigile://restart'; }); })" title="${esc(t('update.restart.title'))}">${esc(t('update.restart'))}</button>`;
};


/* ---------- teams that need a poke: top-bar badge ---------- */
function pokeBadge(projects) {
  const n = projects.filter(p => p.attention && !p.attention.auto), names = n.map(p => p.name + ': ' + (p.attention.kind === 'asleep' ? asleepWhy(p.attention) : t('poke.stuck')) + (p.attention.held ? ' (' + heldWhy(p.attention) + ')' : '')).join('\n');
  const h = n.length ? `<button class="navlink pokebadge" onclick="pokeAll(this)" title="${esc(t('poke.title'))}\n${esc(names)}">${esc(n.length > 1 ? t('poke.many', { n: n.length }) : t('poke.one'))}</button>` : '';
  if ($('pokeTop').innerHTML !== h) $('pokeTop').innerHTML = h;
}
// Tap the badge: wake every asleep team and restart every stuck one, then show the home page.
async function pokeAll(b) {
  b.disabled = true; b.textContent = t('poke.waking');
  const failed = [];
  for (const p of (await api('GET', '/api/projects')).filter(p => p.attention && !p.attention.auto)) {
    const act = p.attention.kind === 'stuck' && p.presence && p.presence.running ? 'restart' : 'wake';
    try { await api('POST', `/api/projects/${p.slug}/${act}`); } catch (e) { failed.push(p.name + ': ' + e.message); }
  }
  if (failed.length) openDialog(`<h2>${esc(t('poke.failed'))}</h2><p style="white-space:pre-wrap">${esc(failed.join('\n'))}</p><div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  b.disabled = false; refresh(true);
}

// A quiet time from the change calendar (AIG-615, set in Setup): a small chip, only while it lasts.
function quietTimeChip(q) {
  const e = $('quietTimeTop'); if (!e) return;
  e.hidden = !q;
  e.textContent = q ? t(q.label ? 'quiettime.chip' : 'quiettime.chip.nolabel', { label: q.label, until: q.until }) : '';
  e.title = q ? t('quiettime.chip.title') : '';
}
/* ---------- going quiet: night theme ---------- */
function setNight(since) {
  document.documentElement.toggleAttribute('data-night', !!since);
  if (window.Inbox) Inbox.repaint();
  $('nightTop').innerHTML = since ? `<button class="navlink" onclick="openNightGlance()" title="${esc(t('ng.open.title'))}">🌙</button><button class="navlink" onclick="backFromQuiet()" title="${esc(t('night.since', { when: ago(since) }))}">${esc(t('night.back'))}</button>` : '';
}
// Going quiet asks which projects the 🌙 night watchman should watch: every active one is ticked (AIG-199),
// or none when the owner picked quiet nights in Setup (AIG-235).
async function goQuiet() {
  let ps = [], all = true; try { ps = (await api('GET', '/api/projects')).filter(p => !p.archived); const pf = (await api('GET', '/api/setup')).prefs; all = pf.watchAll !== false; } catch {}
  openDialog(`<h2>${esc(t('quiet.h'))}</h2><p class="muted">${esc(t('quiet.confirm'))}</p>
    <h3>${esc(t('watch.h'))}</h3><p class="muted">${esc(t('watch.help'))}</p>
    <div class="watch-list">${ps.map(p => `<label class="chk"><input type="checkbox" data-watch="${esc(p.slug)}" ${all ? 'checked' : ''}> ${pic(p.logo, p.emoji)} ${esc(p.name)}</label>`).join('')}</div>
    <label class="chk">${esc(t('quiet.until'))} <input type="time" id="quietUntil" value=""></label><p class="muted">${esc(t('quiet.until.help'))}</p>
    <div class="actions"><button class="primary" onclick="goQuietNow()">${esc(t('quiet.go'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
async function goQuietNow() {
  const watch = [...document.querySelectorAll('#dialog [data-watch]:checked')].map(b => b.dataset.watch), until = (quietUntil || {}).value || '';
  closeDialog();
  try {
    const r = await api('POST', '/api/quiet', { on: true, watch, until });
    setNight(r.quiet);
    // A proper goodnight instead of a plain alert box (AIG-208): who was told, who was woken, what the watchman watches.
    const chips = names => `<div class="qd-chips">${names.map(n => `<span class="qd-chip">${esc(n)}</span>`).join('')}</div>`;
    const look = Object.fromEntries((state.projects || []).map(p => [p.slug, p.name]));
    openDialog(`<div class="qd"><div class="qd-moon">🌙</div><h2>${esc(t('quiet.done.h'))}</h2><p class="muted">${esc(t('quiet.done.sub'))}</p>
      ${r.sent.length ? `<h3>${esc(t('quiet.done.told', { count: r.sent.length, n: r.sent.length }))}</h3>${chips(r.sent)}` : `<p class="muted">${esc(t('quiet.done.none'))}</p>`}
      ${r.woke.length ? `<h3>${esc(t('quiet.done.woke', { count: r.woke.length, n: r.woke.length }))}</h3>${chips(r.woke)}` : ''}
      ${(r.watching || []).length ? `<h3>${esc(t('quiet.done.watch', { n: r.watching.length }))}</h3>${chips(r.watching.map(s => look[s] || s))}` : ''}
      ${r.failed.length ? `<div class="err">${esc(t('quiet.failed', { names: r.failed.join('; ') }))}</div>` : ''}
      <div class="actions"><button onclick="openNightGlance(); closeDialog()" title="${esc(t('ng.open.title'))}">${esc(t('ng.open'))}</button><button class="primary" onclick="goodnight()">${esc(t('quiet.done.ok'))}</button></div></div>`);
    refresh(true);
  } catch (e) { alert(e.message); }
}
// Goodnight (AIG-228): the night glance opens and, in the desktop app, the main window gets out of the way.
function goodnight() {
  closeDialog(); openNightGlance();
  if (document.body.classList.contains('desktop')) location.href = 'aigile://minimize';
}
// Back from quiet: the night watchman's summary, one line per project (AIG-199).
async function backFromQuiet() {
  try {
    const r = await api('POST', '/api/quiet', { on: false }); setNight(null); showMorning(r.summary);
  } catch (e) { alert(e.message); }
}
// The night watchman's summary, one line per project: after Back from quiet, or when quiet ended by itself (AIG-232).
function showMorning(summary) {
  if (summary && summary.length) openDialog(`<h2>${esc(t('watch.morning'))}</h2><ul class="watch-sum">${summary.map(x => `<li><b>${esc(x.name)}</b>: ${esc(t('watch.line', { h: x.handedOver, d: x.done, w: x.woke }))}${x.restarted.length ? ' · ' + esc(t('watch.restarted', { ids: x.restarted.join(', ') })) : ''}${x.stuck.length ? ` · <span class="su-red">${esc(t('watch.stuck', { ids: x.stuck.join(', ') }))}</span>` : ''}</li>`).join('')}</ul>
      <div class="actions"><button class="primary" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
}
PagePoll.every(checkBuild, 5000, { hidden: 30000 });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { PagePoll.invalidate(false); refresh(); morningPrompt(); } });

// Last line of the last script (AIG-517): every script loaded and ran, so the start-up guard stands down.
Boot.done = true;
