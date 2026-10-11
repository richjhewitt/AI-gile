/* ---------- guided tour (AIG-95) ---------- */
// 🎓 Tour from the home page: a few stops, each a spotlight on part of the board with a short bubble.
// Three levels: new = every stop, with why it works this way (and dev words explained);
// refresh = the main stops, short; anyway = every stop, short. Texts live in the language files (tour.*).
const TOUR = [
  { id: 'welcome' },
  { id: 'rail', sel: '#dmRail' },
  { id: 'inbox', sel: '#inboxTop .ib-btn' },
  { id: 'foryou', sel: '.column.foryou', board: true },
  { id: 'cards', sel: '.board .column:not(.foryou)', board: true, skip: 'refresh' },
  { id: 'chat', sel: '#dmRail [data-dms]' },
  { id: 'setup', sel: 'header a.navlink[href="#/setup"]', skip: 'refresh' },
  { id: 'done' },
];
let tour = null;   // { level, steps, i }

function tourDialog() {
  const lvl = k => `<button class="tour-lvl" onclick="startTour('${k}')"><b>${esc(t('tour.lvl.' + k))}</b><small class="muted">${esc(t('tour.lvl.' + k + '.help'))}</small></button>`;
  openDialog(`<h2>${esc(t('tour.h'))}</h2><p class="muted">${esc(t('tour.intro'))}</p><div class="tour-lvls">${lvl('new')}${lvl('refresh')}${lvl('anyway')}</div>
    <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
function startTour(level) {
  closeDialog();
  if (level === 'new' && typeof setExplain === 'function') setExplain(true);   // new to this: dev words explained too
  tour = { level, steps: TOUR.filter(s => s.skip !== level), i: 0 };
  showStop();
}
function endTour() { tour = null; const o = document.getElementById('tourLayer'); if (o) o.remove(); }
function tourMove(d) { if (!tour) return; tour.i += d; if (tour.i < 0) tour.i = 0; if (tour.i >= tour.steps.length) return endTour(); showStop(); }

async function showStop() {
  const s = tour.steps[tour.i];
  // Stops on a board need one open: the first project's.
  if (s.board && !document.querySelector('.board')) {
    const ps = state.projects && state.projects.length ? state.projects : await api('GET', '/api/projects').catch(() => []);
    if (ps[0]) { location.hash = '#/p/' + ps[0].slug; for (let n = 0; n < 30 && !document.querySelector(s.sel); n++) await new Promise(r => setTimeout(r, 100)); }
  }
  const target = s.sel && document.querySelector(s.sel);
  if (s.sel && !target) return tourMove(1);   // nothing to point at here: skip the stop
  let layer = document.getElementById('tourLayer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'tourLayer'; document.body.append(layer); }
  const short = tour.level !== 'new', last = tour.i === tour.steps.length - 1;
  const why = !short && t('tour.' + s.id + '.why') !== 'tour.' + s.id + '.why' ? `<p class="tour-why">${esc(t('tour.' + s.id + '.why'))}</p>` : '';
  layer.innerHTML = `<div class="tour-dim"></div><div class="tour-dim"></div><div class="tour-dim"></div><div class="tour-dim"></div><div class="tour-spot"></div><div class="tour-bubble" role="dialog" aria-live="polite">
      <div class="tour-step muted">${esc(t('tour.step', { i: tour.i + 1, n: tour.steps.length }))}</div>
      <h3>${esc(t('tour.' + s.id + '.title'))}</h3><p>${esc(t('tour.' + s.id + (short ? '.short' : '.text')))}</p>${why}
      <div class="actions">${tour.i ? `<button onclick="tourMove(-1)">${esc(t('tour.back'))}</button>` : ''}
        <button class="primary" onclick="tourMove(1)">${esc(t(last ? 'tour.finish' : 'tour.next'))}</button>
        ${last ? '' : `<button class="tour-skip" onclick="endTour()">${esc(t('tour.skip'))}</button>`}</div></div>`;
  const spot = layer.querySelector('.tour-spot'), bubble = layer.querySelector('.tour-bubble');
  const dims = [...layer.querySelectorAll('.tour-dim')];
  if (!target) { spot.hidden = true; Object.assign(dims[0].style, { left: 0, top: 0, width: '100vw', height: '100vh' }); bubble.classList.add('center'); return; }
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = target.getBoundingClientRect(), pad = 6;
  const L = r.left - pad, T = r.top - pad, W = r.width + pad * 2, H = Math.min(r.height, innerHeight - r.top - 12) + pad * 2;
  Object.assign(spot.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
  // Four dark panels around the spotlight (a giant box-shadow doesn't always paint).
  [[0, 0, '100vw', Math.max(0, T)], [0, T + H, '100vw', '100vh'], [0, T, Math.max(0, L), H], [L + W, T, '100vw', H]].forEach(([x, y, w, h], k) =>
    Object.assign(dims[k].style, { left: x + 'px', top: y + 'px', width: typeof w === 'number' ? w + 'px' : w, height: typeof h === 'number' ? h + 'px' : h }));
  // The bubble goes beside the spotlight where there is room, else below it.
  const bw = Math.min(340, innerWidth - 24), right = r.right + 16 + bw < innerWidth;
  Object.assign(bubble.style, right ? { left: r.right + 16 + 'px', top: Math.max(12, Math.min(r.top, innerHeight - 260)) + 'px' }
    : { left: Math.max(12, Math.min(r.left, innerWidth - bw - 12)) + 'px', top: Math.min(r.bottom + 16, innerHeight - 260) + 'px' });
}
document.addEventListener('keydown', e => { if (!tour) return; if (e.key === 'Escape') endTour(); else if (e.key === 'ArrowRight') tourMove(1); else if (e.key === 'ArrowLeft') tourMove(-1); });
window.addEventListener('resize', () => { if (tour) showStop(); });
