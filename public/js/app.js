/* ---------- start-up: routing, polling, new-build prompt ---------- */
window.addEventListener('hashchange', () => { state.editing = false; refresh(true); });
refresh(true);
setInterval(() => { if (!document.hidden) refresh(); }, 1000);

// Dev builds: when the server or page changes, prompt Rich to refresh instead of running stale code.
let loadedBuild = null;
async function checkBuild() {
  try {
    const m = await api('GET', '/api/meta');
    if (loadedBuild === null) { loadedBuild = m.build; return; }
    if (m.dev && m.build !== loadedBuild && !$('update').firstChild)
      $('update').innerHTML = `<div class="overlay center" style="z-index:50"><div class="dialog">
        <h2>🆕 New version available</h2><p>The board has been updated. Refresh to get the latest version.</p>
        <div class="actions"><button class="primary" onclick="location.reload()">Refresh now</button>
        <button onclick="$('update').innerHTML=''; loadedBuild=null">Later</button></div></div></div>`;
  } catch {}
}
checkBuild();
setInterval(checkBuild, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
