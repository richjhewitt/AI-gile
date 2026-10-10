/* ---------- start-up: routing, polling, new-build prompt ---------- */
// Desktop app (Electron on Windows) loses keyboard focus after a native alert/confirm/prompt box, so text
// boxes ignore typing for a while (AIG-84). After each box, ask the app to hand focus back.
/* ---------- theme (AIG-143): follows the system, or the user's pick, remembered in this browser ---------- */
const THEMES = { system: '🖥️ System', light: '☀️ Light', dark: '🌙 Dark' };
function theme(set) {
  let t; try { t = set || localStorage.getItem('aigile.theme') || 'system'; if (set) localStorage.setItem('aigile.theme', set); } catch { t = set || 'system'; }
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  if (/Electron/.test(navigator.userAgent)) location.href = 'aigile://theme/' + t;   // the app's window buttons follow too, also after a restart
  const b = $('themeBtn'); if (b) { b.textContent = THEMES[t].split(' ')[0]; b.title = 'Theme: ' + THEMES[t] + ' (click to change)'; }
  return t;
}
const nextTheme = () => { const k = Object.keys(THEMES), cur = theme(); theme(k[(k.indexOf(cur) + 1) % k.length]); };
theme();

// The desktop app has no title bar (AIG-128): the page's own top bar is where you drag the window.
if (/Electron/.test(navigator.userAgent)) document.body.classList.add('desktop');
if (/Electron/.test(navigator.userAgent)) for (const k of ['alert', 'confirm', 'prompt']) {
  const native = window[k].bind(window);
  window[k] = (...a) => { const r = native(...a); location.href = 'aigile://refocus'; return r; };
}
window.addEventListener('hashchange', () => { state.editing = false; refresh(true); });
refresh(true);
setInterval(() => { if (!document.hidden) refresh(); }, 1000);
setTimeout(morningPrompt, 1500);   // the day's first "Call stand-ups?" (AIG-136)

// Dev builds: when the server or page changes, a small 🆕 Refresh pill floats at the top (AIG-78), above any open
// card so he can reach it mid-reply. It never covers what he's typing and stays until he clicks it.
let loadedBuild = null;
async function checkBuild() {
  try {
    const m = await api('GET', '/api/meta');
    if (m.owner && m.owner !== state.owner) { state.owner = m.owner; refresh(true); }
    setNight(m.quiet);
    pokeBadge(await api('GET', '/api/projects'));
    // A new install opens Setup first (AIG-91).
    if (loadedBuild === null && m.setupNeeded && location.hash !== '#/setup') location.hash = '#/setup';
    if (loadedBuild === null) { loadedBuild = m.build; return; }
    // A newer version on GitHub (AIG-92): an ⬆ Update pill, until it's applied.
    const u = m.update || {}, upd = u.behind ? `<button class="primary" onclick="applyUpdatePage()" title="${esc((u.subjects || []).join('\n'))}">⬆ Update</button>` : '';
    if ($('upUpdate').dataset.sig !== upd && !$('upUpdate').dataset.busy) { $('upUpdate').dataset.sig = upd; $('upUpdate').innerHTML = upd; }
    if (m.dev && m.build !== loadedBuild && !$('upRefresh').firstChild)
      $('upRefresh').innerHTML = `<button class="primary" onclick="refreshPage()" title="The board has been updated: refresh to get the latest version">🆕 Refresh</button>`;
  } catch {}
}
// Unsent text anywhere (a reply, an answer, a dialog) or pending attachments: ask before losing it.
const okToLeave = what => {
  const unsent = [...document.querySelectorAll('textarea, input[type=text]')].some(el => el.value.trim() && el.value !== el.defaultValue)
    || !!document.querySelector('.att-chip');
  return !unsent || confirm(`You have an unsent reply. ${what} anyway and lose it?`);
};
// Applies the update; the server restarts itself, so wait a few seconds and reload.
async function applyUpdatePage() {
  if (!okToLeave('Update')) return;
  const box = $('upUpdate'); box.dataset.busy = '1'; box.innerHTML = '<button class="primary" disabled>⬆ Updating…</button>';
  try { await api('POST', '/api/update/apply'); setTimeout(() => location.reload(), 5000); }
  catch (e) { delete box.dataset.busy; box.dataset.sig = ''; alert('Update: ' + e.message); }
}
function refreshPage() { if (okToLeave('Refresh')) location.reload(); }
// Desktop app only (AIG-83): the app calls this when its own files changed; the pill asks the app to restart itself.
// A restart reloads the page too, so Refresh is hidden while Restart shows (AIG-130).
window.showRestartApp = () => {
  $('upRefresh').hidden = true;
  if (!$('upRestart').firstChild)
    $('upRestart').innerHTML = `<button class="primary" onclick="if (okToLeave('Restart')) location.href = 'aigile://restart'" title="The desktop app has been updated: restart it to get the latest version">🔄 Restart app</button>`;
};
checkBuild();

/* ---------- teams that need a poke: top-bar badge ---------- */
function pokeBadge(projects) {
  const n = projects.filter(p => p.attention), names = n.map(p => p.name + ': ' + (p.attention.kind === 'asleep' ? p.attention.why : 'stuck')).join('\n');
  const h = n.length ? `<button class="navlink pokebadge" onclick="pokeAll(this)" title="Tap to wake them all\n${esc(names)}">🔔 ${n.length} team${n.length > 1 ? 's' : ''} need${n.length > 1 ? '' : 's'} a poke</button>` : '';
  if ($('pokeTop').innerHTML !== h) $('pokeTop').innerHTML = h;
}
// Tap the badge: wake every asleep team and restart every stuck one, then show the home page.
async function pokeAll(b) {
  b.disabled = true; b.textContent = '⏳ Waking…';
  const failed = [];
  for (const p of (await api('GET', '/api/projects')).filter(p => p.attention)) {
    const act = p.attention.kind === 'stuck' && p.presence && p.presence.running ? 'restart' : 'wake';
    try { await api('POST', `/api/projects/${p.slug}/${act}`); } catch (e) { failed.push(p.name + ': ' + e.message); }
  }
  if (failed.length) alert('⚠️ Could not wake:\n' + failed.join('\n'));
  location.hash = '#/'; refresh(true);
}

/* ---------- going quiet: night theme ---------- */
function setNight(since) {
  document.documentElement.toggleAttribute('data-night', !!since);
  if (window.Inbox) Inbox.repaint();
  $('nightTop').innerHTML = since ? `<button class="navlink" onclick="backFromQuiet()" title="Night mode since ${esc(ago(since))}">☀️ I'm back</button>` : '';
}
async function goQuiet() {
  if (!confirm('Tell every team with work that you are going quiet for a few hours?')) return;
  try {
    const r = await api('POST', '/api/quiet', { on: true });
    setNight(r.quiet);
    alert(`📣 Sent to ${r.sent.length} team(s)${r.sent.length ? ': ' + r.sent.join(', ') : ''}` + (r.woke.length ? `\n▶ Woke: ${r.woke.join(', ')}` : '') + (r.failed.length ? `\n⚠️ Could not wake: ${r.failed.join('; ')}` : ''));
    refresh(true);
  } catch (e) { alert(e.message); }
}
async function backFromQuiet() { try { await api('POST', '/api/quiet', { on: false }); setNight(null); } catch (e) { alert(e.message); } }
setInterval(checkBuild, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
