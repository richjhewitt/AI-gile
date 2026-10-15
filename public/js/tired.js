/* ---------- 🔋 / 😴 Tired mode (AIG-669) ---------- */
// One switch in the top bar: 🔋 awake, 😴 tired. The setting is the owner pref `tired` (Setup > Tired mode); the server works out
// `tiredNow` (lib/tired.js) and sends it in GET /api/setup. Dark mode is only known here, so this tells the server when it changes.
const Tired = (() => {
  let now = false, shown = '', sentDark = null;
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  const isDark = () => { const th = document.documentElement.dataset.theme; return th ? th === 'dark' : mq.matches; };
  function paint() {
    const key = JSON.stringify([now, i18n.lang]);
    if (key === shown) return; shown = key;
    const b = document.getElementById('tiredBtn'); if (!b) return;
    b.textContent = now ? '😴' : '🔋'; b.classList.toggle('on', now);
    b.setAttribute('aria-pressed', now ? 'true' : 'false');
    b.title = t(now ? 'tired.title.on' : 'tired.title.off');
    b.setAttribute('aria-label', t(now ? 'tired.title.on' : 'tired.title.off'));
  }
  function take(s) {
    const was = state.setup && state.setup.prefs && state.setup.prefs.tired && state.setup.prefs.tired.mode;
    state.setup = s; now = !!s.tiredNow; paint(); if (typeof Status !== 'undefined') Status.paint();   // AIG-984
    if (was && s.prefs.tired.mode !== was && document.getElementById('leadPrefs') && typeof paintLeadPrefs === 'function') paintLeadPrefs();
  }
  async function poll() {
    try {
      const d = isDark();
      take(d !== sentDark ? await api('POST', '/api/setup', { prefs: { tiredDark: d } }) : await PagePoll.get('/api/setup'));
      sentDark = d;
    } catch {}
  }
  async function toggle() {
    try { take(await api('POST', '/api/setup', { prefs: { tiredFlip: true } })); } catch (e) { alert(e.message); }
  }
  function start() { PagePoll.every(() => { if (isDark() !== sentDark) return poll(); }, 2000, { home: true }); PagePoll.every(poll, 20000, { immediate: true, home: true }); }
  return { start, toggle, poll, get now() { return now; } };
})();
