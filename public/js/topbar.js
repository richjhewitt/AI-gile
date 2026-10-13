/* ---------- top bar buttons (AIG-575, AIG-576) ---------- */
// Which top bar buttons show, in what order, on which side (left = next to the project name, right = the old place)
// and in which theme colour. Saved in this browser (localStorage aigile.topbar), like the other per-user page settings.
// Default = the layout in index.html. The Setup gear can't be switched off, so Setup is always reachable.
const Topbar = (() => {
  const KEY = 'aigile.topbar';
  const BTNS = [['helpBtn', 'help'], ['ideaBtn', 'idea'], ['bugBtn', 'bug'], ['teamTop', 'team'], ['inboxTop', 'inbox'], ['pokeTop', 'poke'], ['nightTop', 'night'], ['glanceBtn', 'glance'], ['weedBtn', 'weed'], ['streamBtn', 'stream'], ['ntBtn', 'nt'], ['tiredBtn', 'tired'], ['assumeNav', 'assume'], ['usageNav', 'usage'], ['setupNav', 'setup'], ['themeBtn', 'theme']];
  const IDS = BTNS.map(b => b[0]), KEEP = 'setupNav';
  const AI_BTNS = ['ntBtn', 'usageNav', 'pokeTop', 'nightTop', 'teamTop'];   // hidden by No AI, ever (AIG-581)
  const COLOURS = ['accent', 'done', 'warn', 'danger', 'you'];
  const blank = () => ({ order: IDS.slice(), off: [], side: {}, colour: {} });
  const load = () => {
    let o; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { o = null; }
    const d = blank(); if (!o || typeof o !== 'object') return d;
    const ord = (Array.isArray(o.order) ? o.order : []).filter(i => IDS.includes(i));
    d.order = [...new Set([...ord, ...IDS])];
    d.off = (Array.isArray(o.off) ? o.off : []).filter(i => IDS.includes(i) && i !== KEEP);
    for (const i of IDS) { if (o.side && o.side[i] === 'l') d.side[i] = 'l'; if (o.colour && COLOURS.includes(o.colour[i])) d.colour[i] = o.colour[i]; }
    return d;
  };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
  const isDefault = c => JSON.stringify(c) === JSON.stringify(blank());
  let cur = load();
  // Put the buttons where the saved layout says. Safe to call again and again.
  function apply() {
    const sp = document.querySelector('header .spacer'), end = $('enBtn'); if (!sp || !end) return;
    for (const id of cur.order) {
      const e = $(id); if (!e) continue;
      e.parentNode.insertBefore(e, cur.side[id] === 'l' ? sp : end);
      e.classList.toggle('tb-off', cur.off.includes(id));
      if (cur.colour[id]) e.dataset.tbc = cur.colour[id]; else delete e.dataset.tbc;
    }
  }
  function change(fn) { fn(cur); save(cur); apply(); paint(); }
  const toggle = id => change(c => { if (id === KEEP) return; c.off = c.off.includes(id) ? c.off.filter(x => x !== id) : [...c.off, id]; });
  const side = (id, s) => change(c => { if (s === 'l') c.side[id] = 'l'; else delete c.side[id]; });
  const colour = (id, k) => change(c => { if (k) c.colour[id] = k; else delete c.colour[id]; });
  const move = (id, to) => change(c => { const o = c.order.filter(x => x !== id); o.splice(Math.max(0, Math.min(o.length, to)), 0, id); c.order = o; });
  const step = (id, d) => move(id, cur.order.indexOf(id) + d);
  const reset = () => { cur = blank(); try { localStorage.removeItem(KEY); } catch {} apply(); paint(); };
  function html() {
    const rows = cur.order.filter(id => !(NoAi.on && AI_BTNS.includes(id))).map((id, i) => {
      const nm = t('tb.b.' + BTNS.find(b => b[0] === id)[1]), on = !cur.off.includes(id), lk = id === KEEP, sd = cur.side[id] === 'l' ? 'l' : 'r', co = cur.colour[id] || '';
      const sw = ['', ...COLOURS].map(k => `<button type="button" class="tb-sw${co === k ? ' on' : ''}" data-tbc="${k}" aria-pressed="${co === k}" aria-label="${esc(t('tb.c.' + (k || 'none')))}" title="${esc(t('tb.c.' + (k || 'none')))}" onclick="Topbar.colour('${id}','${k}')"></button>`).join('');
      return `<li class="tb-row" draggable="true" data-tb="${id}">
        <span class="tb-grip" aria-hidden="true">⋮⋮</span>
        <label class="tb-name"><input type="checkbox" class="tb-on" ${on ? 'checked' : ''} ${lk ? 'disabled' : ''} onchange="Topbar.toggle('${id}')" aria-label="${esc(t('tb.show', { name: nm }))}"> ${esc(nm)}${lk ? ` <span class="muted">${esc(t('tb.locked'))}</span>` : ''}</label>
        <select class="tb-side" aria-label="${esc(t('tb.side'))}" onchange="Topbar.side('${id}',this.value)"><option value="r" ${sd === 'r' ? 'selected' : ''}>${esc(t('tb.side.r'))}</option><option value="l" ${sd === 'l' ? 'selected' : ''}>${esc(t('tb.side.l'))}</option></select>
        <span class="tb-sws" role="group" aria-label="${esc(t('tb.colour'))}">${sw}</span>
        <span class="tb-mv"><button type="button" class="tb-up" aria-label="${esc(t('tb.up', { name: nm }))}" title="${esc(t('tb.up', { name: nm }))}" ${i === 0 ? 'disabled' : ''} onclick="Topbar.step('${id}',-1)">↑</button><button type="button" class="tb-down" aria-label="${esc(t('tb.down', { name: nm }))}" title="${esc(t('tb.down', { name: nm }))}" ${i === cur.order.length - 1 ? 'disabled' : ''} onclick="Topbar.step('${id}',1)">↓</button></span></li>`;
    }).join('');
    return `<span>${esc(t('tb.h'))}</span><div><ul class="tb-list" id="tbList">${rows}</ul>
      <div class="actions"><button type="button" id="tbReset" onclick="Topbar.reset()" ${isDefault(cur) ? 'disabled' : ''}>${esc(t('tb.reset'))}</button></div></div><small class="muted">${esc(t('tb.help'))}</small>`;
  }
  function paint() { const b = $('topbarBox'); if (b) b.innerHTML = html(); }
  // Drag a row onto another to move it there.
  let drag = null;
  document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.tb-row'); if (!r) return; drag = r.dataset.tb; try { e.dataTransfer.setData('text/plain', drag); e.dataTransfer.effectAllowed = 'move'; } catch {} });
  document.addEventListener('dragover', e => { if (drag && e.target.closest && e.target.closest('.tb-row')) e.preventDefault(); });
  document.addEventListener('drop', e => { const r = e.target.closest && e.target.closest('.tb-row'); if (!drag || !r) return; e.preventDefault(); const to = cur.order.indexOf(r.dataset.tb), id = drag; drag = null; if (id !== r.dataset.tb) move(id, to); });
  document.addEventListener('dragend', () => { drag = null; });
  return { html, apply, toggle, side, colour, step, move, reset, state: () => cur };
})();
Topbar.apply();
