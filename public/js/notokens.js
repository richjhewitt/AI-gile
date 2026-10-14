/* ---------- ⛔ No Token Mode (AIG-337..339) ---------- */
// One switch in the top bar. On: the board refuses to start any AI (the server does that, lib/notokens.js) and the page
// gets the body class `notokens`, which hides the AI buttons through css/06-notokens.css. When the plan's usage limit
// switched it on, it says when the limit resets; once usage is back the switch glows "Turn AI back on" (never by itself).
const NoTokens = (() => {
  let st = { on: false }, shown = '';
  const hhmm = iso => { try { return new Date(iso).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  function paint() {
    const key = JSON.stringify([st, i18n.lang]);
    if (key === shown) return; shown = key;
    document.body.classList.toggle('notokens', !!st.on);
    const b = document.getElementById('ntBtn'); if (!b) return;
    b.classList.toggle('on', !!st.on); b.classList.toggle('back', !!(st.on && st.back));
    b.setAttribute('aria-pressed', st.on ? 'true' : 'false');
    if (!st.on) { b.textContent = t('nt.off'); b.title = t('nt.title.off'); return; }
    if (st.back) { b.textContent = t('nt.back'); b.title = t('nt.title.back'); return; }
    b.textContent = st.reason === 'limit' && st.until ? t('nt.until', { time: hhmm(st.until) }) : t('nt.on');
    b.title = st.reason === 'limit' ? t('nt.title.limit') : t('nt.title.on');
  }
  async function poll() { try { st = await api('GET', '/api/notokens'); } catch { return; } paint(); }
  async function toggle() {
    try { st = await api('POST', '/api/notokens', { on: !st.on }); } catch (e) { alert(e.message); return; }
    paint(); refresh(true);
  }
  function start() { poll(); setInterval(poll, 2000); }
  return { start, toggle, poll, get on() { return !!st.on; } };
})();
