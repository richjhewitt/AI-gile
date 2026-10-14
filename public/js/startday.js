// ☀️ Welcome back (AIG-546): after time away from the desk, the cards marked "start the day" (a project's daily
// routine, e.g. the minimum Finch tasks) come before the work cards. A small dialog on return; Later hides it until the
// next time away. Away = the page was hidden or idle for AWAY_MS. Per browser: nothing is saved on the board.
const StartDay = (() => {
  const S = { AWAY_MS: 45 * 60e3 };
  const KEY = 'aigile.lastSeen';
  const get = () => { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } };
  const set = v => { try { localStorage.setItem(KEY, String(v)); } catch {} };
  let shown = false;
  S.check = async () => {
    const was = get(), now = Date.now();
    set(now);
    if (shown || !was || now - was < S.AWAY_MS) return;
    if (document.querySelector('#dialog .overlay')) return;   // never over something being typed
    let list = [];
    try { list = await api('GET', '/api/startday'); } catch { return; }
    if (!list.length) return;
    shown = true;
    openDialog(`<h2>${esc(t('startday.h'))}</h2><p class="muted">${esc(t('startday.intro'))}</p>
      <div id="sdList">${list.map(c => `<p data-sd="${esc(c.slug)}|${esc(c.id)}"><button class="good" onclick="StartDay.done('${esc(c.slug)}','${esc(c.id)}',this)">${esc(t('startday.done'))}</button>
        <a href="#/p/${esc(c.slug)}/${esc(c.id)}" onclick="closeDialog()">${esc(c.title)}</a> <span class="muted">· ${esc(c.project)}</span></p>`).join('')}</div>
      <div class="actions"><button onclick="closeDialog()">${esc(t('startday.later'))}</button></div>`);
  };
  S.done = async (slug, id, btn) => {
    try { await api('PATCH', `/api/projects/${slug}/cards/${id}`, { status: 'done' }); btn.closest('p').remove(); if (!document.querySelector('#sdList p')) closeDialog(); }
    catch (e) { alert(e.message); }
  };
  // Seen now whenever the page is in use; a long gap since the last tick (a sleeping laptop, a hidden tab) is the "away".
  setInterval(() => { if (!document.hidden && i18n.ready) { const was = get(); if (Date.now() - was > S.AWAY_MS) S.check(); else set(Date.now()); } }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && i18n.ready) S.check(); });
  setTimeout(() => { if (i18n.ready) S.check(); }, 3000);
  return S;
})();
