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
    pokeBadge(await api('GET', '/api/projects'));
    if (loadedBuild === null) { loadedBuild = m.build; return; }
    if (m.dev && m.build !== loadedBuild && !$('update').firstChild)
      $('update').innerHTML = `<div class="overlay center" style="z-index:50"><div class="dialog">
        <h2>🆕 New version available</h2><p>The board has been updated. Refresh to get the latest version.</p>
        <div class="actions"><button class="primary" onclick="location.reload()">Refresh now</button>
        <button onclick="$('update').innerHTML=''; loadedBuild=null">Later</button></div></div></div>`;
  } catch {}
}
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
