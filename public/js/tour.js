/* ---------- guided tour (AIG-95, AIG-1299) ---------- */
// 🎓 Tour from Help or the home page: at most eight stops, each a spotlight on something a new friend uses on day one, with a short bubble.
// Three levels: new = every stop, with why it works this way (and dev words explained);
// refresh = the main stops, short; anyway = every stop, short. Texts live in the language files (tour.*; a .noai twin wins in No AI mode).
// A stop whose target is not on screen (No AI mode, a phone, First steps already done) is skipped, in the direction you were going.
// The rest (status, Today, backups, calls set-up...) is for later: the last stop points at ❓ Help and the 📖 glossary.
const TOUR = [
  { id: 'welcome' },
  { id: 'firststeps', sel: '#firstSteps', home: true, skip: 'refresh', when: () => typeof FirstSteps === 'undefined' || (!FirstSteps.hidden() && (x => !x.busy && !x.list.every(s => s.done))(FirstSteps.steps(state.projects))) },
  { id: 'rail', sel: '#dmRail' },
  { id: 'inbox', sel: '#inboxTop .ib-btn' },
  { id: 'foryou', sel: '.column.foryou', board: true, when: () => !state.projects || !state.projects.length || state.projects.some(p => !p.archived) },
  { id: 'chat', sel: '#dmRail [data-dms]' },
  { id: 'setup', sel: 'header a.navlink[href="#/setup"]', skip: 'refresh' },
  { id: 'help', sel: '#helpBtn' },
];
let tour = null;   // { level, steps, i, dir, back }

function tourDialog() {
  const lvl = k => `<button class="tour-lvl" onclick="startTour('${k}')"><b>${esc(t('tour.lvl.' + k))}</b><small class="muted">${esc(t('tour.lvl.' + k + '.help'))}</small></button>`;
  openDialog(`<h2>${esc(t('tour.h'))}</h2><p class="muted">${esc(t('tour.intro'))}</p><div class="tour-lvls">${lvl('new')}${lvl('refresh')}${lvl('anyway')}</div>
    <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
function startTour(level) {
  const back = document.activeElement;
  closeDialog();
  if (level === 'new' && typeof setExplain === 'function') setExplain(true);   // new to this: dev words explained too
  const keep = s => { try { return !s.when || s.when(); } catch { return true; } };
  tour = { project: state.route.view === 'project' ? state.route.slug : null, level, steps: TOUR.filter(s => s.skip !== level && keep(s)), i: 0, dir: 1, back };
  showStop();
}
// A stop must point at something on screen: the target counts only if it has a size and is not hidden.
function tourSeen(e) { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }
// A target that sits in the top bar's closed More menu (a phone, or Setup unpinned): open the menu first.
function tourTarget(sel) {
  const e = document.querySelector(sel), m = document.getElementById('tbMoreMenu');
  if (e && m && m.contains(e) && m.hidden && typeof Topbar !== 'undefined') Topbar.menu(true);
  else if (m && !m.hidden && !(e && m.contains(e)) && typeof Topbar !== 'undefined') Topbar.menu(false);
  return tourSeen(e) ? e : null;
}
function endTour() {
  if (typeof Topbar !== 'undefined') Topbar.menu(false);
  const back = tour && tour.back; tour = null;
  const o = document.getElementById('tourLayer'); if (o) o.remove();
  if (back && back.isConnected && back !== document.body && typeof back.focus === 'function') back.focus();   // focus goes back where it was
}
function tourMove(d) { if (!tour) return; tour.dir = d < 0 ? -1 : 1; tour.i += d; if (tour.i < 0) tour.i = 0; if (tour.i >= tour.steps.length) return endTour(); showStop(); }
const tourWait = async test => { for (let n = 0; n < 30 && !test(); n++) await new Promise(r => setTimeout(r, 100)); };

async function showStop() {
  const s = tour.steps[tour.i];
  // A home stop needs the home page; a board stop needs a board open: the project where the tour started.
  if (s.home && !document.querySelector('#app .space-tree')) { location.hash = '#/'; await tourWait(() => document.querySelector(s.sel) || document.querySelector('#app .space-tree')); }
  if (s.board && !document.querySelector('.board')) {
    const ps = state.projects && state.projects.length ? state.projects : await api('GET', '/api/projects').catch(() => []);
    const p = ps.find(x => x.slug === tour.project) || ps.find(x => !x.archived) || ps[0];
    if (p) { location.hash = '#/p/' + p.slug; await tourWait(() => document.querySelector(s.sel)); }
  }
  if (!tour || tour.steps[tour.i] !== s) return;
  let target = s.sel && tourTarget(s.sel);
  // A menu opened by this very Next click would be closed again by the page's click-away handler: open it again after the click.
  if (target && target.closest('#tbMoreMenu')) { await new Promise(r => setTimeout(r, 0)); if (!tour || tour.steps[tour.i] !== s) return; target = tourTarget(s.sel); }
  if (s.sel && !target) return tour.dir < 0 && tour.i > 0 ? tourMove(-1) : tourMove(1);   // nothing to point at here: skip the stop
  let layer = document.getElementById('tourLayer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'tourLayer'; document.body.append(layer); }
  const short = tour.level !== 'new', last = tour.i === tour.steps.length - 1;
  const why = !short && t('tour.' + s.id + '.why') !== 'tour.' + s.id + '.why' ? `<p class="tour-why">${esc(t('tour.' + s.id + '.why'))}</p>` : '';
  layer.innerHTML = `<div class="tour-dim"></div><div class="tour-dim"></div><div class="tour-dim"></div><div class="tour-dim"></div><div class="tour-spot"></div>
    <div class="tour-bubble" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="tourH" aria-describedby="tourStep tourP" data-stop="${esc(s.id)}">
      <div class="tour-step muted" id="tourStep">${esc(t('tour.step', { i: tour.i + 1, n: tour.steps.length }))}</div>
      <h3 id="tourH">${esc(t('tour.' + s.id + '.title'))}</h3><p id="tourP">${esc(t('tour.' + s.id + (short ? '.short' : '.text')))}</p>${why}
      <div class="actions">${tour.i ? `<button type="button" onclick="tourMove(-1)">${esc(t('tour.back'))}</button>` : ''}
        <button type="button" class="primary" onclick="tourMove(1)">${esc(t(last ? 'tour.finish' : 'tour.next'))}</button>
        ${last ? '' : `<button type="button" class="tour-skip" onclick="endTour()">${esc(t('tour.skip'))}</button>`}</div></div>`;
  const spot = layer.querySelector('.tour-spot'), bubble = layer.querySelector('.tour-bubble');
  const dims = [...layer.querySelectorAll('.tour-dim')];
  const say = () => bubble.focus({ preventScroll: true });   // focus on the stop's text, so a screen reader reads its title and words
  if (!target) { spot.hidden = true; Object.assign(dims[0].style, { left: 0, top: 0, width: '100vw', height: '100vh' }); bubble.classList.add('center'); return say(); }
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  const r = target.getBoundingClientRect(), pad = 6;
  const L = r.left - pad, T = r.top - pad, W = r.width + pad * 2, H = Math.min(r.height, innerHeight - r.top - 12) + pad * 2;
  Object.assign(spot.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
  // Four dark panels around the spotlight (a giant box-shadow doesn't always paint).
  [[0, 0, '100vw', Math.max(0, T)], [0, T + H, '100vw', '100vh'], [0, T, Math.max(0, L), H], [L + W, T, '100vw', H]].forEach(([x, y, w, h], k) =>
    Object.assign(dims[k].style, { left: x + 'px', top: y + 'px', width: typeof w === 'number' ? w + 'px' : w, height: typeof h === 'number' ? h + 'px' : h }));
  // The bubble goes beside the spotlight where there is room (after it in reading order: right, or left in a right-to-left language),
  // else below it, or above it when the target sits low (the rail along the bottom of a phone).
  const bw = Math.min(340, innerWidth - 24), rtl = document.documentElement.dir === 'rtl';
  const top = Math.max(12, Math.min(r.top, innerHeight - 260)) + 'px';
  if (!rtl && r.right + 16 + bw < innerWidth) Object.assign(bubble.style, { left: r.right + 16 + 'px', top });
  else if (rtl && r.left - 16 - bw > 0) Object.assign(bubble.style, { left: r.left - 16 - bw + 'px', top });
  else {
    const left = Math.max(12, Math.min(rtl ? r.right - bw : r.left, innerWidth - bw - 12)) + 'px';
    Object.assign(bubble.style, { left, top: Math.max(12, Math.min(r.bottom + 16, innerHeight - 260)) + 'px' });
    const bh = bubble.offsetHeight;
    if (r.bottom + 16 + bh > innerHeight && r.top - 16 - bh > 0) bubble.style.top = r.top - 16 - bh + 'px';
  }
  say();
}
document.addEventListener('keydown', e => {
  if (!tour) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endTour(); }
  else if (arrowStep(e) > 0) { e.preventDefault(); tourMove(1); } else if (arrowStep(e) < 0) { e.preventDefault(); tourMove(-1); }
  else if (e.key === 'Tab') {   // Tab stays inside the bubble while the tour is on
    const b = document.querySelector('#tourLayer .tour-bubble'); if (!b) return;
    const f = [...b.querySelectorAll('button')]; if (!f.length) return;
    const at = f.indexOf(document.activeElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (at === -1 || at === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  }
}, true);
window.addEventListener('resize', () => { if (tour) showStop(); });
