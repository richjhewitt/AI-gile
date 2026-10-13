/* ---------- 🌅 Start my day (AIG-797) ----------
   One check-in dialog: today's tasks for you, tests waiting, life admin due today (reminders, life cards, meds times) and the
   unread mail count when a mailbox is set up, each with a plain button to jump there. "Done for now" closes it. Offered once
   each morning when the owner turns it on in Setup (dayStart, lib/lifeadmin.js day()); always openable from home. When the
   🎯 Today picker is on and not answered yet, it is step 1 inside this dialog (TodayPage.maybePick then stays quiet).
   Plain code over data the page already has: no AI call, same in No AI mode. Not js/startday.js (AIG-546, welcome back). */
const MyDay = (() => {
  const M = { st: null, mail: null };
  const plural = (k, n) => t(k + (n === 1 ? '.one' : '.many'), { n });
  M.load = async () => { try { M.st = await api('GET', '/api/daystart'); } catch { M.st = null; } return M.st; };
  M.owns = async () => { const s = await M.load(); return !!(s && s.on); };
  // The unread count of the first mailbox from the cached list (never fetches, never reads a mail).
  async function mailCount() {
    if (typeof Streamer !== 'undefined' && Streamer.on && Streamer.on()) return null;
    try {
      const c = await api('GET', '/api/mail/config'), b = c && c.boxes && c.boxes[0]; if (!b) return null;
      const d = await api('GET', '/api/mail/inbox?box=' + encodeURIComponent(b.id));
      return (d.items || []).filter(x => x.unread).length;
    } catch { return null; }
  }
  const sec = (id, h, body) => `<div class="md-sec" id="md-${id}"><h3>${esc(h)}</h3>${body}</div>`;
  const go = (id, hash, label) => `<button type="button" data-go="${id}" onclick="MyDay.go('${hash}')">${esc(label)}</button>`;
  M.render = async () => {
    try { if (typeof IB !== 'undefined') await IB.load(); } catch {}
    const st = (await M.load()) || { lifeDue: [], pickOn: false };
    const td = (typeof TodayPage !== 'undefined' && (TodayPage.data || await TodayPage.load())) || null;
    const raw = (typeof IB !== 'undefined' && IB.raw) || [];
    const tasks = raw.filter(c => IB.isTask(c) && !c.lifeType && c.status !== 'verify').length, tests = raw.filter(c => IB.isTest(c)).length;
    const lifeCards = raw.filter(c => c.lifeType).length, meds = typeof SelfCare !== 'undefined' && SelfCare.medsLeft ? SelfCare.medsLeft() : [];
    const rem = st.lifeDue || [], mail = await mailCount();
    const out = [];
    if (td && td.askPick && td.projects.length) {
      out.push(sec('pick', t('md.pick.h'), `<p class="muted">${esc(t('md.pick.intro'))}</p><div class="md-pick" id="todayPickList">${TodayPage.pickRows(td)}</div><div class="err" id="todayPickErr"></div>
        <div class="md-row"><button type="button" class="primary" id="todayPickGo" onclick="TodayPage.pickGo(true)">${esc(t('today.pick.go'))}</button><button type="button" onclick="TodayPage.pickSkip(true)">${esc(t('today.pick.skip'))}</button></div>`));
    }
    out.push(sec('tasks', t('md.tasks.h'), `<div class="md-row"><span class="md-what">${esc(tasks ? plural('md.tasks', tasks) : t('md.tasks.none'))}</span>${tasks ? go('tasks', '#/inbox', t('md.open.inbox')) : ''}</div>`));
    out.push(sec('tests', t('md.tests.h'), `<div class="md-row"><span class="md-what">${esc(tests ? plural('md.tests', tests) : t('md.tests.none'))}</span>${tests ? go('tests', '#/inbox', t('md.open.inbox')) : ''}</div>`));
    const lifeLines = [...rem.map(r => `<li>${esc(r.text)}</li>`), ...meds.map(tm => `<li>${esc(t('md.life.meds', { time: tm }))}</li>`)];
    if (lifeCards) lifeLines.push(`<li>${esc(plural('md.life.cards', lifeCards))}</li>`);
    out.push(sec('life', t('md.life.h'), `<div class="md-row"><span class="md-what">${lifeLines.length ? '' : esc(t('md.life.none'))}</span>${go('life', '#/life', t('md.open.life'))}</div>${lifeLines.length ? `<ul class="md-list">${lifeLines.join('')}</ul>` : ''}`));
    if (mail !== null) out.push(sec('mail', t('md.mail.h'), `<div class="md-row"><span class="md-what">${esc(mail ? plural('md.mail', mail) : t('md.mail.none'))}</span>${go('mail', '#/mail', t('md.open.mail'))}</div>`));
    return `<h2>${esc(t('md.h'))}</h2><p class="muted">${esc(t('md.intro'))}</p><div id="mdBody">${out.join('')}</div>
      <div class="actions"><button type="button" class="primary" id="mdDone" onclick="MyDay.done()">${esc(t('md.done'))}</button></div>`;
  };
  M.open = async auto => {
    if (auto && document.querySelector('#dialog .overlay')) return;
    const html = await M.render();
    if (auto && document.querySelector('#dialog .overlay')) return;   // something else opened while it loaded
    openDialog(html);
    try { await api('POST', '/api/daystart/seen'); if (M.st) M.st.ask = false; } catch {}
  };
  // Redraw in place (after the picker is answered), when this dialog is the one on screen.
  M.redraw = async () => { const b = document.getElementById('mdBody'); if (!b) return; const html = await M.render(); const d = document.querySelector('#dialog .dialog'); if (d && document.getElementById('mdBody')) d.innerHTML = html; };
  M.go = hash => { closeDialog(); location.hash = hash; };
  M.done = () => closeDialog();
  M.btn = () => `<button onclick="MyDay.open()" title="${esc(t('md.btn.title'))}">${esc(t('md.btn'))}</button>`;
  let polled = 0;
  setInterval(async () => {
    if (typeof i18n === 'undefined' || !i18n.ready || document.hidden || Date.now() - polled < 10000) return;
    polled = Date.now();
    const s = await M.load();
    if (s && s.ask && typeof IB !== 'undefined') M.open(true);
  }, 3000);
  return M;
})();
