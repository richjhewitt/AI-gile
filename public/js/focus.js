/* ---------- 🎯 focus mode (AIG-395) ----------
   The whole window becomes one calm screen: the task, its notes, a gentle timer, a huge ✅ Done and a small ⏸ Pause.
   The server keeps the state (data/focus.conf), so a refresh, a pop-out and the desktop app all agree; the 5-second
   meta poll hands it to watch(). The 🌙 night glance pop-out is left alone, so it can sit on a second screen. */
const Focus = (() => {
  let cur = null, sig = '', t0 = 0, was = false;
  const el = () => document.getElementById('focusScreen');
  const inGlance = () => location.hash === '#/pop-night';
  const mins = () => Math.floor((cur.paused ? cur.elapsedMs : Date.now() - t0) / 60e3);
  const timeText = () => mins() < 1 ? t('fx.justnow') : t('fx.min', { n: mins() });

  function apply(f) {
    const on = !!(f && f.project) && !inGlance();
    document.documentElement.toggleAttribute('data-focus', on);
    const box = el(); if (!box) return;
    if (!on) { cur = null; sig = ''; box.hidden = true; box.innerHTML = ''; return; }
    cur = f; t0 = Date.now() - f.elapsedMs;
    const s = JSON.stringify([f.project, f.id, f.title, f.notes, f.paused, f.stops]);
    if (s === sig) { tick(); return; }
    sig = s; box.hidden = false; box.innerHTML = html(f);
  }
  function html(f) {
    const stop = (f.stops || []).slice(-1)[0], more = (f.stops || []).length - 1;
    return `<div class="fx">
      ${stop ? `<div class="fx-stop" role="alert">🚨 ${esc(stop.by)}: ${esc(stop.why)} <span class="muted">(${esc(stop.id)}${more > 0 ? ' +' + more : ''})</span></div>` : ''}
      <div class="fx-main">
        <div class="fx-kicker">${esc(f.paused ? t('fx.paused') : t('fx.h'))}</div>
        <h1 class="fx-title">${esc(f.title)}</h1>
        ${f.notes ? `<div class="fx-notes">${esc(f.notes)}</div>` : ''}
        <div class="fx-time" id="fxTime">⏱ ${esc(timeText())}</div>
      </div>
      <div class="fx-btns">
        <button class="fx-done" onclick="Focus.done()">${esc(t('fx.done'))}</button>
        <div class="fx-small">${f.paused
          ? `<button onclick="Focus.act('resume')">${esc(t('fx.resume'))}</button><button onclick="Focus.act('leave')">${esc(t('fx.leave'))}</button>`
          : `<button onclick="Focus.act('pause')">${esc(t('fx.pause'))}</button>`}</div>
      </div></div>`;
  }
  function tick() { const x = document.getElementById('fxTime'); if (x && cur) x.textContent = '⏱ ' + timeText(); }
  PagePoll.every(tick, 15000);

  async function act(what) {
    try { const r = await api('POST', '/api/focus/' + what); if (what === 'leave') return ended(); apply(r); was = true; }
    catch (e) { alert(e.message); }
  }
  async function done() { try { await api('POST', '/api/focus/done'); } catch (e) { return alert(e.message); } ended(); }
  async function start(slug, id) {
    try { apply(await api('POST', '/api/focus/start', { project: slug, id })); was = true; } catch (e) { alert(e.message); }
  }
  // Focus ended (here or in another window): back to the board, and the two-line "while you were busy", once.
  async function ended() {
    was = false; apply(null); refresh(true);
    const s = await api('GET', '/api/focus/summary').catch(() => null);
    if (s && s.title) summary(s);
  }
  function summary(s) {
    openDialog(`<h2>${esc(s.done ? t('fx.sum.done', { title: s.title }) : t('fx.sum.left'))}</h2>
      <h3>${esc(t('fx.sum.h'))}</h3>
      <p>📥 ${esc(t('fx.sum.l1', { h: s.handedOver, q: s.questions }))}</p>
      <p>🚨 ${esc(t('fx.sum.l2', { n: s.showstoppers }))}</p>
      <div class="actions"><button class="primary" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  }
  const btn = (p, c) => c.focus && c.status !== 'done' ? `<button class="primary" onclick="Focus.start('${p.slug}', '${c.id}')" title="${esc(t('fx.start.title'))}" aria-label="${esc(t('fx.start.title'))}">${esc(t('fx.start'))}</button>` : '';
  // The meta poll: focus began or ended somewhere else (another window or the desktop app).
  function watch(f) { const on = !!(f && f.project); if (was && !on) ended(); else apply(f); was = on; }
  return { apply, watch, act, done, start, btn };
})();
