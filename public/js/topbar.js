/* ---------- top bar buttons (AIG-575, AIG-576) ---------- */
// Which top bar buttons show, in what order, on which side (left = next to the project name, right = the old place)
// and in which theme colour. Saved in this browser (localStorage aigile.topbar), like the other per-user page settings.
// Default = the layout in index.html. The Setup gear can't be switched off, so Setup is always reachable.
const Topbar = (() => {
  const KEY = 'aigile.topbar';
  const BTNS = [['helpBtn', 'help'], ['bugBtn', 'bug'], ['ideaBtn', 'idea'], ['teamTop', 'team'], ['inboxTop', 'inbox'], ['pokeTop', 'poke'], ['nightTop', 'night'], ['glanceBtn', 'glance'], ['weedBtn', 'weed'], ['streamBtn', 'stream'], ['ntBtn', 'nt'], ['statusBtn', 'status'], ['tiredBtn', 'tired'], ['assumeNav', 'assume'], ['usageNav', 'usage'], ['setupNav', 'setup'], ['themeBtn', 'theme']];
  const IDS = BTNS.map(b => b[0]), KEEP = 'setupNav';
  const AI_BTNS = ['ntBtn', 'usageNav', 'pokeTop', 'nightTop', 'teamTop'];   // hidden by No AI, ever (AIG-581)
  const DEF_SIDE = { bugBtn: 'l', ideaBtn: 'l' };   // AIG-733: Raise bug sits next to the project name unless a saved layout says otherwise
  const sideOf = (c, id) => c.side[id] || DEF_SIDE[id] || 'r';
  const COLOURS = ['accent', 'done', 'warn', 'danger', 'you'];
  const blank = () => ({ order: IDS.slice(), off: [], side: {}, colour: {} });
  const load = () => {
    let o; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { o = null; }
    const d = blank(); if (!o || typeof o !== 'object') return d;
    const ord = (Array.isArray(o.order) ? o.order : []).filter(i => IDS.includes(i));
    d.order = [...new Set([...ord, ...IDS])];
    d.off = (Array.isArray(o.off) ? o.off : []).filter(i => IDS.includes(i) && i !== KEEP);
    for (const i of IDS) { if (o.side && (o.side[i] === 'l' || o.side[i] === 'r') && o.side[i] !== (DEF_SIDE[i] || 'r')) d.side[i] = o.side[i]; if (o.colour && COLOURS.includes(o.colour[i])) d.colour[i] = o.colour[i]; }
    return d;
  };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
  const isDefault = c => JSON.stringify(c) === JSON.stringify(blank());
  let cur = load();
  // AIG-1077: the personal power tools (Streamer, Twitch chat, No Token Mode, Tired mode, Assumptions, ScrumGlance, WeedGlance) stay out of
  // the menus until switched on in Setup > More settings. A browser that already has its own top bar layout keeps what it has.
  const PWKEY = 'aigile.powertools';
  const power = () => { try { const v = localStorage.getItem(PWKEY); if (v === '1' || v === '0') return v === '1'; return !!(localStorage.getItem(KEY) || localStorage.getItem('aigile.topbar.pinned')); } catch { return true; } };
  const setPower = on => { try { localStorage.setItem(PWKEY, on ? '1' : '0'); } catch {} document.body.classList.toggle('no-power', !on); };
  // AIG-931/932: only Inbox, Help and Setup (and the things that appear when there is something to act on) stay in the bar;
  // the rest sit under "More" (on a phone, one menu for everything but the logo and Inbox). The same elements are moved, so ids and handlers stay.
  const PKEY = 'aigile.topbar.pinned';
  const MORE_EXTRA = ['twitchBtn', 'mailNav', 'immWrap'];
  const PINNABLE = [...IDS, ...MORE_EXTRA];
  const PIN_DEF = ['bugBtn', 'ideaBtn', 'helpBtn', 'inboxTop', 'setupNav', 'pokeTop', 'nightTop', 'teamTop', 'statusBtn'];
  // AIG-984: the status button joins a saved pin list once (unpinning it later sticks)
  const loadPins = () => { let a; try { a = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch { a = null; } if (!Array.isArray(a)) return PIN_DEF.slice(); a = a.filter(i => PINNABLE.includes(i)); try { if (!localStorage.getItem(PKEY + '.status')) { localStorage.setItem(PKEY + '.status', '1'); if (!a.includes('statusBtn')) { a.push('statusBtn'); localStorage.setItem(PKEY, JSON.stringify(a)); } } if (!localStorage.getItem(PKEY + '.idea')) { localStorage.setItem(PKEY + '.idea', '1'); if (!a.includes('ideaBtn')) { a.splice(a.includes('bugBtn') ? a.indexOf('bugBtn') + 1 : a.length, 0, 'ideaBtn'); localStorage.setItem(PKEY, JSON.stringify(a)); } } } catch {} return a; };
  let pins = loadPins();
  const phoneMq = window.matchMedia ? matchMedia('(max-width: 600px)') : { matches: false };
  const isPhone = () => phoneMq.matches;
  const inBar = id => isPhone() ? id === 'inboxTop' : pins.includes(id);
  const savePins = () => { try { localStorage.setItem(PKEY, JSON.stringify(pins)); } catch {} };
  function menu(open) {
    const b = $('tbMoreBtn'), m = $('tbMoreMenu'); if (!b || !m) return;
    const on = open === undefined ? m.hidden : !!open;
    m.hidden = !on; b.setAttribute('aria-expanded', String(on));
    if (on) labelMore();
  }
  // AIG-955: an icon-only item in the More menu gets a short word next to it (inside the menu only; the bar stays icon-only)
  const MORE_LABEL = { ideaBtn: 'idea', statusBtn: 'status', tiredBtn: 'tired', setupNav: 'setup' };
  function labelMore() {
    for (const id of Object.keys(MORE_LABEL)) {
      const e = $(id); if (!e) continue;
      let s = e.querySelector(':scope > .tbm-label');
      if (!e.closest('#tbMoreMenu')) { if (s) s.remove(); continue; }
      if (!s) { s = document.createElement('span'); s.className = 'tbm-label'; e.appendChild(s); }
      s.textContent = t('tb.b.' + MORE_LABEL[id]);
    }
  }
  document.addEventListener('click', e => {
    const m = $('tbMoreMenu'); if (!m || m.hidden) return;
    if (e.target.closest('#tbMoreBtn')) return;
    if (!e.target.closest('#tbMoreMenu') || (e.target.closest('a,button') && !e.target.closest('#themeBtn,#immWrap,#tbMoreBtn'))) menu(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
  // Put the buttons where the saved layout says. Safe to call again and again.
  function apply() {
    document.body.classList.toggle('no-power', !power());
    const sp = document.querySelector('header .spacer'), end = $('tbMore'); if (!sp || !end) return;
    const more = end, mm = $('tbMoreMenu');
    for (const id of cur.order) {
      const e = $(id); if (!e) continue;
      if (mm && !inBar(id)) mm.appendChild(e); else end.parentNode.insertBefore(e, sideOf(cur, id) === 'l' ? sp : end);
      e.classList.toggle('tb-off', cur.off.includes(id));
      if (e.closest('#tbMoreMenu')) delete e.dataset.tbc; else if (cur.colour[id]) e.dataset.tbc = cur.colour[id]; else delete e.dataset.tbc;
    }
    if (mm) {
      for (const id of MORE_EXTRA) { const e = $(id); if (e && !inBar(id)) mm.appendChild(e); else if (e && e.closest('#tbMoreMenu')) end.parentNode.insertBefore(e, end); }
      if (isPhone()) for (const e of [...document.querySelector('header').children]) { if (e.matches('h1,.spacer,#inboxTop,#tbMore,.alpha-tag,.crumb')) continue; mm.appendChild(e); }
      else {
        for (const id of ['hfTop', 'quietTimeTop', 'liveBtn']) { const e = $(id); if (e && e.closest('#tbMoreMenu')) end.parentNode.insertBefore(e, end); }
        const en = $('enBtn'), ib = $('ideaBtn'), anchor = ib && !ib.closest('#tbMoreMenu') && ib.parentNode === more.parentNode ? ib : more; if (en && (en.closest('#tbMoreMenu') || en.previousElementSibling !== anchor)) anchor.after(en);   // AIG-1066/AIG-1087: the 🌐 button stays on the bar, right after Idea (after More if Idea is tucked away); it shows itself only while the quick English switch is on
        const lv = $('live'); if (lv && lv.closest('#tbMoreMenu')) lv.closest('header').appendChild(lv);
      }
    }
  }
  function change(fn) { fn(cur); save(cur); apply(); paint(); }
  const toggle = id => change(c => { if (id === KEEP) return; c.off = c.off.includes(id) ? c.off.filter(x => x !== id) : [...c.off, id]; });
  const side = (id, s) => change(c => { if (s === (DEF_SIDE[id] || 'r')) delete c.side[id]; else c.side[id] = s; });
  const colour = (id, k) => change(c => { if (k) c.colour[id] = k; else delete c.colour[id]; });
  const move = (id, to) => change(c => { const o = c.order.filter(x => x !== id); o.splice(Math.max(0, Math.min(o.length, to)), 0, id); c.order = o; });
  const step = (id, d) => move(id, cur.order.indexOf(id) + d);
  const reset = () => { cur = blank(); try { localStorage.removeItem(KEY); } catch {} apply(); paint(); };
  const pin = id => { pins = pins.includes(id) ? pins.filter(x => x !== id) : [...pins, id]; if (!pins.includes('setupNav')) pins.push('setupNav'); savePins(); apply(); paint(); };
  if (phoneMq.addEventListener) phoneMq.addEventListener('change', () => { apply(); menu(false); });
  function html() {
    const rows = cur.order.filter(id => !(NoAi.on && AI_BTNS.includes(id))).map((id, i) => {
      const nm = t('tb.b.' + BTNS.find(b => b[0] === id)[1]), on = !cur.off.includes(id), lk = id === KEEP, sd = sideOf(cur, id), co = cur.colour[id] || '';
      const sw = ['', ...COLOURS].map(k => `<button type="button" class="tb-sw${co === k ? ' on' : ''}" data-tbc="${k}" aria-pressed="${co === k}" aria-label="${esc(t('tb.c.' + (k || 'none')))}" title="${esc(t('tb.c.' + (k || 'none')))}" onclick="Topbar.colour('${id}','${k}')"></button>`).join('');
      return `<li class="tb-row" draggable="true" data-tb="${id}">
        <span class="tb-grip" aria-hidden="true">⋮⋮</span>
        <label class="tb-name"><input type="checkbox" class="tb-on" ${on ? 'checked' : ''} ${lk ? 'disabled' : ''} onchange="Topbar.toggle('${id}')" aria-label="${esc(t('tb.show', { name: nm }))}"> ${esc(nm)}${lk ? ` <span class="muted">${esc(t('tb.locked'))}</span>` : ''}</label>
        <select class="tb-side" aria-label="${esc(t('tb.side'))}" onchange="Topbar.side('${id}',this.value)"><option value="r" ${sd === 'r' ? 'selected' : ''}>${esc(t('tb.side.r'))}</option><option value="l" ${sd === 'l' ? 'selected' : ''}>${esc(t('tb.side.l'))}</option></select>
        <span class="tb-sws" role="group" aria-label="${esc(t('tb.colour'))}">${sw}</span>
        <span class="tb-mv"><button type="button" class="tb-up" aria-label="${esc(t('tb.up', { name: nm }))}" title="${esc(t('tb.up', { name: nm }))}" ${i === 0 ? 'disabled' : ''} onclick="Topbar.step('${id}',-1)">↑</button><button type="button" class="tb-down" aria-label="${esc(t('tb.down', { name: nm }))}" title="${esc(t('tb.down', { name: nm }))}" ${i === cur.order.length - 1 ? 'disabled' : ''} onclick="Topbar.step('${id}',1)">↓</button></span></li>`;
    }).join('');
    return `<span>${esc(t('tb.h'))}</span><div><ul class="tb-list" id="tbList">${rows}</ul>
      <div class="actions"><button type="button" id="tbReset" onclick="Topbar.reset()" ${isDefault(cur) ? 'disabled' : ''}>${esc(t('tb.reset'))}</button></div></div><small class="muted">${esc(t('tb.help'))}</small>
      <div class="tb-pins" id="tbPins"><b>${esc(t('tb.pin.h'))}</b> <small class="muted">${esc(t('tb.pin.help'))}</small><div class="tb-pinlist">${PINNABLE.filter(id => !(NoAi.on && AI_BTNS.includes(id))).map(id => `<label class="tb-pin"><input type="checkbox" data-pin="${id}" ${pins.includes(id) ? 'checked' : ''} ${id === KEEP ? 'disabled' : ''} onchange="Topbar.pin('${id}')"> ${esc(t('tb.b.' + (BTNS.find(b => b[0] === id) || [0, id.replace(/Btn|Nav|Wrap/, '')])[1]))}</label>`).join('')}</div></div>`;
  }
  function paint() { const b = $('topbarBox'); if (b) b.innerHTML = html(); }
  // Drag a row onto another to move it there.
  let drag = null;
  document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.tb-row'); if (!r) return; drag = r.dataset.tb; try { e.dataTransfer.setData('text/plain', drag); e.dataTransfer.effectAllowed = 'move'; } catch {} });
  document.addEventListener('dragover', e => { if (drag && e.target.closest && e.target.closest('.tb-row')) e.preventDefault(); });
  document.addEventListener('drop', e => { const r = e.target.closest && e.target.closest('.tb-row'); if (!drag || !r) return; e.preventDefault(); const to = cur.order.indexOf(r.dataset.tb), id = drag; drag = null; if (id !== r.dataset.tb) move(id, to); });
  document.addEventListener('dragend', () => { drag = null; });
  return { html, apply, menu, power, setPower, pin, pins: () => pins,  toggle, side, colour, step, move, reset, state: () => cur };
})();
Topbar.apply();
