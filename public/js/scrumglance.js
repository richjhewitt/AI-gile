/* ---------- 📊 ScrumGlance (AIG-688) ---------- */
// A small live panel: counts and short lists of what is in progress, to do, waiting for you to test and done today.
// For the project on screen, or every project on the home page. Plain code (GET /api/glance), no AI. It rides the
// page's refresh poll (app.js calls ScrumGlance.tick()). ⧉ Pop out moves it to its own small window (#/pop-glance[/slug]).
const ScrumGlance = (() => {
  const GROUPS = [['doing', 'glance.doing', '🔨'], ['todo', 'glance.todo', '📋'], ['verify', 'glance.verify', '🧪'], ['done', 'glance.done', '✅']];
  let open = false, data = null, busyNow = false, shown = '';
  const scope = () => { const r = state.route || {}; return r.view === 'glance' ? (r.slug || '') : r.view === 'project' ? r.slug : ''; };
  function body(d, link) {
    if (!d) return `<p class="muted">${esc(t('glance.loading'))}</p>`;
    const head = d.project ? esc(((state.project && state.project.slug === d.project && state.project.name) || d.project)) : esc(t('glance.all'));
    return `<div class="sg-scope">${head}</div>` + GROUPS.map(([k, key, ic]) => {
      const g = d[k] || { n: 0, cards: [] };
      const li = g.cards.map(c => `<li>${link ? `<a href="#/p/${encodeURIComponent(c.project)}/${encodeURIComponent(c.id)}">` : ''}<span class="sg-id">${esc(c.id)}</span> ${esc(c.title)}${link ? '</a>' : ''}</li>`).join('');
      return `<section class="sg-grp sg-${k}" data-k="${k}"><h4>${ic} ${esc(t(key))} <span class="sg-n">${g.n}</span></h4>${li ? `<ul>${li}</ul>` : `<p class="muted sg-none">${esc(t('glance.none'))}</p>`}${g.n > g.cards.length ? `<p class="muted sg-more">${esc(t('glance.more', { n: g.n - g.cards.length }))}</p>` : ''}</section>`;
    }).join('');
  }
  function paint() {
    let el = document.getElementById('sgPanel');
    const pop = state.route && state.route.view === 'glance';
    if (!open || pop) { if (el) el.remove(); if (pop) return; return; }
    if (!el) { el = document.createElement('div'); el.id = 'sgPanel'; el.className = 'sg-panel'; el.setAttribute('role', 'region'); document.body.appendChild(el); shown = ''; }
    const key = JSON.stringify([data, scope(), i18n.lang, state.project && state.project.name]);
    if (key === shown) return; shown = key;
    el.innerHTML = `<div class="sg-bar"><b>${esc(t('glance.h'))}</b><span class="spacer"></span>${popBtn('ScrumGlance.pop()', 'id="sgPop"').replace('class="dlg-pop"', 'class="sg-pop"')}<button type="button" id="sgClose" aria-label="${esc(t('glance.close'))}" title="${esc(t('glance.close'))}" onclick="ScrumGlance.toggle()"><span aria-hidden="true">✕</span></button></div><div class="sg-body">${body(data, true)}</div>`;
  }
  async function load(slug, options = {}) {
    try { data = await PagePoll.get('/api/glance' + (slug ? '?project=' + encodeURIComponent(slug) : ''), options); } catch { data = data || null; }
  }
  // Called by the page poll (app.js); the pop-out view loads in refresh() instead.
  async function tick() {
    if (!open || busyNow || (state.route && state.route.view === 'glance')) return;
    busyNow = true; try { await load(scope()); } finally { busyNow = false; }
    paint();
  }
  function toggle() { open = !open; if (!open) { const e = document.getElementById('sgPanel'); if (e) e.remove(); } else { shown = ''; tick(); } }
  function pop() {
    const s = scope();
    popOut('glance', '#/pop-glance' + (s ? '/' + encodeURIComponent(s) : ''), 'aigile-glance', 340, 520);   // remembers its place (AIG-1313)
    if (open) toggle();
  }
  const popHtml = () => { document.body.classList.add('poplist'); return `<div class="sg-pop">${body(data, false)}</div>`; };
  return { tick, toggle, pop, load, popHtml, get data() { return data; }, get open() { return open; } };
})();
