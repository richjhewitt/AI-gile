/* ---------- start-up: routing, polling, new-build prompt ---------- */
window.addEventListener('hashchange', () => { state.editing = false; refresh(true); });
refresh(true);
setInterval(() => { if (!document.hidden) refresh(); }, 1000);

// Dev builds: when the server or page changes, prompt Rich to refresh instead of running stale code.
let loadedBuild = null;
async function checkBuild() {
  try {
    const m = await api('GET', '/api/meta');
    setNight(m.quiet);
    if (loadedBuild === null) { loadedBuild = m.build; return; }
    if (m.dev && m.build !== loadedBuild && !$('update').firstChild)
      $('update').innerHTML = `<div class="overlay center" style="z-index:50"><div class="dialog">
        <h2>🆕 New version available</h2><p>The board has been updated. Refresh to get the latest version.</p>
        <div class="actions"><button class="primary" onclick="location.reload()">Refresh now</button>
        <button onclick="$('update').innerHTML=''; loadedBuild=null">Later</button></div></div></div>`;
  } catch {}
}
checkBuild();

/* ---------- going quiet: night theme ---------- */
function setNight(since) {
  document.documentElement.toggleAttribute('data-night', !!since);
  $('nightTop').innerHTML = since ? `<button class="navlink" onclick="backFromQuiet()" title="Night mode since ${esc(ago(since))}">☀️ I'm back</button>` : '';
}
async function goQuiet() {
  if (!confirm('Tell every team with work that you are going quiet for a few hours?')) return;
  try {
    const r = await api('POST', '/api/quiet', { on: true });
    setNight(r.quiet);
    alert(`📣 Sent to ${r.sent.length} team(s)${r.sent.length ? ': ' + r.sent.join(', ') : ''}` + (r.woke.length ? `
▶ Woke: ${r.woke.join(', ')}` : '') + (r.failed.length ? `
⚠️ Could not wake: ${r.failed.join('; ')}` : ''));
    refresh(true);
  } catch (e) { alert(e.message); }
}
async function backFromQuiet() { try { await api('POST', '/api/quiet', { on: false }); setNight(null); } catch (e) { alert(e.message); } }
setInterval(checkBuild, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
