/* ---------- 🎯 Hyperfocus chip (AIG-871) ---------- */
// The swarm's focused view (only one project and the DMs) without the swarm: a chip in the top bar names the project, ✕ ends it.
// Swarm.only / Swarm.hiding (swarm.js) read Hyperfocus.slug, so the inbox, home and the rail follow. State is on the server (lib/hyperfocus.js).
const Hyperfocus = (() => {
  let st = { on: false }, shown = '';
  function paint() {
    const key = JSON.stringify([st.on, st.slug, st.name, i18n.lang]);
    if (key === shown) return; shown = key;
    const b = document.getElementById('hfTop'); if (!b) return;
    b.innerHTML = st.on ? `<span class="hf-chip" role="status"><a href="#/p/${esc(st.slug)}" title="${esc(t('hf.chip.title'))}">${esc(t('hf.chip', { name: st.name }))}</a> <button onclick="Hyperfocus.off()" title="${esc(t('hf.off'))}" aria-label="${esc(t('hf.off'))}">✕</button></span>` : '';
  }
  function set(next) { const was = st.on ? st.slug : ''; st = next; paint(); if (was !== (st.on ? st.slug : '') && typeof Swarm !== 'undefined') Swarm.redraw(); }
  async function poll() { try { set(await PagePoll.get('/api/hyperfocus')); } catch {} }
  async function on(slug) { try { set(await api('POST', '/api/hyperfocus', { slug })); } catch (e) { alert(e.message); } }
  async function off() { try { set(await api('POST', '/api/hyperfocus', { off: true })); } catch (e) { alert(e.message); } }
  function start() { PagePoll.every(poll, 3000, { immediate: true }); }
  return { start, on, off, poll, get slug() { return st.on ? st.slug : ''; } };
})();
