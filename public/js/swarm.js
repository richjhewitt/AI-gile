/* ---------- 🚨 Swarm banner (AIG-822) ---------- */
// While every team swarms one project (lib/swarm.js), a red bar under the top bar names it, with an Off button.
const Swarm = (() => {
  let st = { on: false }, shown = '';
  function paint() {
    const key = JSON.stringify([st.on, st.slug, st.name, i18n.lang]);
    if (key === shown) return; shown = key;
    const b = document.getElementById('swarmBar'); if (!b) return;
    b.hidden = !st.on;
    b.innerHTML = st.on ? `${esc(t('swarm.bar', { name: st.name }))} <a href="#/p/${esc(st.slug)}">${esc(t('swarm.open'))}</a> <button onclick="Swarm.off()">${esc(t('swarm.off'))}</button>` : '';
  }
  async function poll() { try { st = await api('GET', '/api/swarm'); } catch { return; } paint(); }
  async function off() { try { st = await api('POST', '/api/swarm', { off: true }); } catch (e) { alert(e.message); return; } paint(); }
  function start() { poll(); setInterval(poll, 5000); }
  return { start, off, poll, get on() { return !!st.on; } };
})();
