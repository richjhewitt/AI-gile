/* ---------- search and filter bar ---------- */
// ---- search / filter (AIG-16): purely in the browser, no extra server calls -----------------------
// The bar lives outside #app so the 1s refresh never wipes what Rich is typing; typing only re-draws the board.
state.filters = {};
const curFilter = slug => state.filters[slug] || (state.filters[slug] = { q: '', type: '', who: '', sprint: '' });
function matchesFilter(c, slug) {
  const f = curFilter(slug);
  if (f.type && c.type !== f.type) return false;
  if (f.who && (c.assignee || '') !== f.who) return false;
  if (f.sprint && (c.sprint || '') !== f.sprint) return false;
  if (f.q) { const q = f.q.toLowerCase(); if (![c.id, c.title, c.description, c.assignee, c.sprint].some(x => String(x || '').toLowerCase().includes(q))) return false; }
  return true;
}
function paintFilterBar() {
  const bar = $('filterbar');
  if (state.route.view !== 'project' || !state.project) { if (bar.innerHTML) { bar.innerHTML = ''; bar.dataset.slug = ''; } return; }
  const p = state.project, f = curFilter(p.slug);
  const uniq = key => [...new Set(p.cards.map(c => c[key]).filter(Boolean))].sort();
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const sel = (key, all, list) => `<select data-f="${key}">${opt('', all, f[key])}${list.map(v => opt(v, v, f[key])).join('')}</select>`;
  const shown = p.cards.filter(c => matchesFilter(c, p.slug)).length, active = f.q || f.type || f.who || f.sprint;
  const selects = sel('type', 'All types', ['feature', 'bug', 'task']) + sel('who', 'Anyone', uniq('assignee')) + sel('sprint', 'All sprints', uniq('sprint'));
  if (bar.dataset.slug !== p.slug) {   // build once per project; afterwards only the selects and count update
    bar.dataset.slug = p.slug;
    bar.innerHTML = `<div class="fbar"><input type="search" id="f-q" placeholder="🔍 Search cards…" value="${esc(f.q)}" oninput="setFilter('q', this.value)">
      <span id="f-sel">${selects}</span><span id="f-count" class="muted"></span></div>`;
    bar.querySelector('#f-sel').onchange = e => setFilter(e.target.dataset.f, e.target.value);
  } else if ($('f-sel').dataset.sig !== selects && !$('f-sel').contains(document.activeElement)) { $('f-sel').innerHTML = selects; }
  $('f-sel').dataset.sig = selects;
  $('f-count').innerHTML = active ? `Showing <b>${shown}</b> of ${p.cards.length} · <a href="#" onclick="clearFilter();return false">clear</a>` : '';
}
function setFilter(key, v) { curFilter(state.project.slug)[key] = v; renderBoardOnly(); paintFilterBar(); }
function clearFilter() { state.filters[state.project.slug] = null; $('filterbar').dataset.slug = ''; renderBoardOnly(); paintFilterBar(); }
