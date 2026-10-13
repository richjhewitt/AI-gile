/* ---------- 🚨 Swarm banner (AIG-822) ---------- */
// While every team swarms one project (lib/swarm.js), a red bar under the top bar names it, with an Off button.
// The inbox, the home page and the rail show only the swarmed project (AIG-877, AIG-880); a line in the bar shows the rest on tap.
const Swarm = (() => {
  let st = { on: false }, shown = '', showAll = false, others = 0;
  function paint() {
    const key = JSON.stringify([st.on, st.slug, st.name, i18n.lang, showAll, others]);
    if (key === shown) return; shown = key;
    const b = document.getElementById('swarmBar'); if (!b) return;
    b.hidden = !st.on;
    const more = showAll ? ` <button onclick="Swarm.toggle()">${esc(t('swarm.hide'))}</button>` : others ? ` <button onclick="Swarm.toggle()">${esc(t('swarm.others', { n: others }))}</button>` : '';
    b.innerHTML = st.on ? `${esc(t('swarm.bar', { name: st.name }))} <a href="#/p/${esc(st.slug)}">${esc(t('swarm.open'))}</a> <button onclick="Swarm.off()">${esc(t('swarm.off'))}</button>${more}` : '';
  }
  function redraw() { if (typeof Dms !== 'undefined' && Dms.reload) Dms.reload(); if (typeof refresh === 'function') refresh(true); if (typeof Inbox !== 'undefined' && Inbox.show && state.route && state.route.view === 'inbox') Inbox.show(true); }
  function set(next) { const was = [st.on, st.slug].join(); st = next; paint(); if (was !== [st.on, st.slug].join()) redraw(); }
  async function poll() { try { set(await api('GET', '/api/swarm')); } catch {} }
  async function off() { try { set(await api('POST', '/api/swarm', { off: true })); } catch (e) { alert(e.message); } }
  const focus = () => (st.on && !showAll) ? st.slug : (typeof Hyperfocus !== 'undefined' ? Hyperfocus.slug : '');   // swarm first, else 🎯 Hyperfocus (AIG-871)
  function toggle() { showAll = !showAll; paint(); redraw(); }
  // Keeps only the swarmed project's items (inbox entries or projects); counts the inbox items left out for the bar.
  function only(list, inbox) {
    const slug = focus();
    if (!slug || !Array.isArray(list)) return list;
    const kept = list.filter(x => (inbox ? x.project || x.slug : x.slug) === slug);
    if (inbox && st.on) { others = list.length - kept.length; paint(); }
    return kept;
  }
  // 🚨 Swarm this / Turn off swarm (AIG-827): on a board's toolbar and in the Scrum Master panel. Starting asks first.
  const mine = slug => st.on && st.slug === slug;
  function btn(slug, id) {
    return `<button type="button" id="${id}" class="${mine(slug) ? 'swarm-on' : 'swarm-this'}" onclick="Swarm.toggleFor('${esc(slug)}')" title="${esc(t(mine(slug) ? 'swarm.off.title' : 'swarm.this.title'))}">${esc(t(mine(slug) ? 'swarm.offbtn' : 'swarm.this'))}</button>`;
  }
  async function toggleFor(slug) {
    if (mine(slug)) return off();
    if (!confirm(t('swarm.confirm', { name: (state.project && state.project.slug === slug && state.project.name) || slug }))) return;
    try { set(await api('POST', '/api/swarm', { slug })); } catch (e) { alert(e.message); }
  }
  function start() { poll(); setInterval(poll, 5000); }
  return { start, off, btn, toggleFor, poll, toggle, only, redraw, get on() { return !!st.on; }, get hiding() { return !!focus(); } };
})();
