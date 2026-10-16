/* ---------- search and filter bar ---------- */
// ---- search / filter (AIG-16): purely in the browser, no extra server calls -----------------------
// The bar lives outside #app so the 1s refresh never wipes what the owner is typing; typing only re-draws the board.
state.filters = {};
const blankFilter = () => ({ q: '', type: '', who: '', sprint: '', group: '', desk: '' });
// First look at a project in this tab: start from the last view used there (kept in the browser), if it still exists.
function startFilter(slug) {
  let last = ''; try { last = localStorage.getItem('aigile.view.' + slug) || ''; } catch {}
  const v = last && state.project && state.project.slug === slug && (state.project.views || []).find(x => x.name === last);
  return { ...blankFilter(), ...(v ? v.filters : {}) };
}
const curFilter = slug => state.filters[slug] || (state.filters[slug] = startFilter(slug));
function matchesFilter(c, slug) {
  const f = curFilter(slug);
  if (f.type && c.type !== f.type) return false;
  if (f.who && (c.assignee || '') !== f.who) return false;
  if (f.sprint && (c.sprint || '') !== f.sprint) return false;
  if (f.group && (c.group || '') !== f.group) return false;
  if (f.desk && ((c.desk || {}).kind || '') !== f.desk) return false;   // AIG-1104
  if (f.q) { const q = f.q.toLowerCase(); if (!fieldHit(c, q) && !commentHit(c, q) && !(c.light && DoneFind.has(slug, q, c.id))) return false; }
  return true;
}
// AIG-1265: the search also reads what was said in comments. A card found only that way gets a small "in a comment" hint.
const fieldHit = (c, q) => [c.id, c.title, c.description, c.assignee, c.sprint, c.group].some(x => String(x || '').toLowerCase().includes(q));
const commentHit = (c, q) => (c.comments || []).some(m => String((m && m.text) || '').toLowerCase().includes(q));
function inCommentOnly(c, slug) {
  const f = state.filters && state.filters[slug], q = f && f.q ? f.q.toLowerCase() : '';
  if (!q || fieldHit(c, q)) return false;
  return commentHit(c, q) || (!!c.light && DoneFind.inComment(slug, q, c.id));
}
// ⚡ A light done card has no description here (AIG-1100): the server says which done cards' descriptions hold the
// search text, one call per search (after a short pause in typing); the board redraws when it answers.
const DoneFind = (() => {
  let key = '', ids = new Set(), com = new Set(), timer = 0;
  function has(slug, q, id) {
    const k = slug + '|' + q;
    if (k !== key) {
      key = k; ids = new Set(); com = new Set(); clearTimeout(timer);
      timer = setTimeout(async () => {
        try { const r = await api('GET', `/api/projects/${slug}/find?q=${encodeURIComponent(q)}`); if (key === k && r.ids.length) { ids = new Set(r.ids); com = new Set(r.comment || []); renderBoardOnly(); paintFilterBar(); } } catch {}
      }, 300);
    }
    return ids.has(id);
  }
  const inComment = (slug, q, id) => key === slug + '|' + q && com.has(id);
  return { has, inComment };
})();
function paintFilterBar() {
  const bar = $('filterbar');
  if (state.route.view !== 'project' || !state.project) { if (bar.innerHTML) { bar.innerHTML = ''; bar.dataset.slug = ''; } return; }
  const p = state.project, f = curFilter(p.slug);
  const uniq = key => [...new Set(p.cards.map(c => c[key]).filter(Boolean))].sort();
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const sel = (key, all, list) => `<select data-f="${key}" aria-label="${esc(t('filter.label.' + key))}">${opt('', all, f[key])}${list.map(v => opt(v, key === 'type' ? t('type.' + v) : v, f[key])).join('')}</select>`;
  // Anyone (AIG-1381): whoever is on a card that is not done, you first; every other name ever used waits behind More (a busy board
  // closes cards for 80+ names a day, so "done lately" would list them all again).
  const now = new Set(p.cards.filter(c => c.status !== 'done').map(c => c.assignee).filter(Boolean));
  if (f.who) now.add(f.who);
  const mine = v => v.toLowerCase() === me().toLowerCase(), live = [...now].sort((a, b) => mine(b) - mine(a) || a.localeCompare(b)), rest = uniq('assignee').filter(v => !now.has(v));
  const whoSel = `<select data-f="who" aria-label="${esc(t('filter.label.who'))}">${opt('', t('filter.anyone'), f.who)}${live.map(v => opt(v, v, f.who)).join('')}${!rest.length ? '' : state.whoAll === p.slug ? `<optgroup label="${esc(t('filter.who.rest'))}">${rest.map(v => opt(v, v, f.who)).join('')}</optgroup>` : opt('__more', t('filter.who.more', { n: rest.length }), f.who)}</select>`;
  const shown = p.cards.filter(c => matchesFilter(c, p.slug)).length, active = f.q || f.type || f.who || f.sprint || f.group || f.desk;
  const deskSel = p.cards.some(c => c.desk) || f.desk ? `<select data-f="desk" aria-label="${esc(t('desk.filter.all'))}">${opt('', t('desk.filter.all'), f.desk)}${['request', 'incident', 'idea'].map(k => opt(k, t('desk.filter.' + k), f.desk)).join('')}</select>` : '';   // AIG-1104
  const selects = deskSel + sel('type', t('filter.types'), ['feature', 'bug', 'task', ...['incident', 'problem', 'change'].filter(k => f.type === k || p.cards.some(c => c.type === k))]) + whoSel + sel('sprint', t('filter.sprints'), uniq('sprint')) + (uniq('group').length || f.group ? sel('group', t('filter.groups'), uniq('group')) : '');
  if (bar.dataset.slug !== p.slug) {   // build once per project; afterwards only the selects and count update
    bar.dataset.slug = p.slug;
    bar.innerHTML = `<div class="fbar${state.filtersOpen ? ' open' : ''}"><input type="search" id="f-q" placeholder="${esc(t('filter.search'))}" value="${esc(f.q)}" oninput="setFilter('q', this.value)">
      <button type="button" class="f-tog" id="f-tog" aria-expanded="${state.filtersOpen ? 'true' : 'false'}" onclick="toggleFilters()"></button>
      <span id="f-sel">${selects}</span><span id="f-count" class="muted"></span></div>`;
    bar.querySelector('#f-sel').onchange = e => { if (e.target.value === '__more') { state.whoAll = p.slug; e.target.blur(); paintFilterBar(); const w = document.querySelector('#f-sel [data-f="who"]'); if (w) w.focus(); return; } setFilter(e.target.dataset.f, e.target.value); };
  } else if ($('f-sel').dataset.sig !== selects && !$('f-sel').contains(document.activeElement)) { $('f-sel').innerHTML = selects; }
  $('f-sel').dataset.sig = selects;
  const nAct = ['type', 'who', 'sprint', 'group', 'desk'].filter(k => f[k]).length;   // AIG-1082: on a phone the dropdowns sit behind this button
  $('f-tog').textContent = t('filter.btn') + (nAct ? ' · ' + nAct : '');
  $('f-count').innerHTML = active ? t('filter.count.html', { shown, n: p.cards.length }) : '';
}
function toggleFilters() { state.filtersOpen = !state.filtersOpen; const b = document.querySelector('#filterbar .fbar'); if (b) b.classList.toggle('open', state.filtersOpen); const g = $('f-tog'); if (g) g.setAttribute('aria-expanded', state.filtersOpen ? 'true' : 'false'); }
function setFilter(key, v) { curFilter(state.project.slug)[key] = v; renderBoardOnly(); paintFilterBar(); }
function clearFilter() { setLastView(state.project.slug, ''); state.filters[state.project.slug] = blankFilter(); $('filterbar').dataset.slug = ''; renderBoardOnly(); paintFilterBar(); }

/* ---------- saved views (AIG-121) ---------- */
// A view is { name, filters } stored on the project (server), so it follows the owner across browsers.
// Which one was used last is per browser, so it lives in localStorage.
function setLastView(slug, name) { try { name ? localStorage.setItem('aigile.view.' + slug, name) : localStorage.removeItem('aigile.view.' + slug); } catch {} }
const lastView = slug => { try { return localStorage.getItem('aigile.view.' + slug) || ''; } catch { return ''; } };
function applyView(i) {
  const p = state.project, v = (p.views || [])[i]; if (!v) return;
  state.filters[p.slug] = { ...blankFilter(), ...JSON.parse(JSON.stringify(v.filters)) };
  setLastView(p.slug, v.name);
  closeDialog(); $('filterbar').dataset.slug = ''; renderBoardOnly(); paintFilterBar();
}
async function saveViews(views) {
  const p = state.project;
  await api('PATCH', '/api/projects/' + p.slug, { views });
  const keep = views.length ? views : undefined;
  p.views = keep;   // show it now, before the next poll
  if (state.project && state.project.slug === p.slug) state.project.views = keep;   // a poll during the save may have swapped the project object for a stale one
}
async function saveView() {
  const name = $('view-name').value.trim(), p = state.project, f = curFilter(p.slug);
  if (!name) return setErr('view-err', new Error(t('views.noname')));
  const views = (p.views || []).filter(v => v.name !== name).concat({ name, filters: { ...f } });   // same name = replace
  try { await saveViews(views); setLastView(p.slug, name); viewsDialog(); } catch (e) { setErr('view-err', e); }
}
async function deleteView(i) {
  const p = state.project, v = (p.views || [])[i]; if (!v) return;
  try { await saveViews(p.views.filter((_, j) => j !== i)); if (lastView(p.slug) === v.name) setLastView(p.slug, ''); viewsDialog(); } catch (e) { setErr('view-err', e); }
}
function viewsDialog() {
  const p = state.project, vs = p.views || [], cur = lastView(p.slug);
  popNext('views'); openDialog(`<h2>${esc(t('views.title'))}</h2><p class="muted">${esc(t('views.intro'))}</p>
    ${vs.length ? vs.map((v, i) => `<div class="viewrow"><button type="button" class="grow" onclick="applyView(${i})">${v.name === cur ? '✓ ' : ''}${esc(v.name)}</button><button type="button" class="colbtn" title="${esc(t('views.delete'))}" aria-label="${esc(t('views.delete'))}" onclick="deleteView(${i})"><span aria-hidden="true">✕</span></button></div>`).join('') : `<p class="muted">${esc(t('views.none'))}</p>`}
    <h3>${esc(t('views.save.h'))}</h3>
    <div class="viewrow"><input type="text" id="view-name" maxlength="40" placeholder="${esc(t('views.placeholder'))}" onkeydown="if(event.key==='Enter')saveView()"><button class="primary" type="button" onclick="saveView()" ${vs.length >= 20 ? `disabled title="${esc(t('views.max'))}"` : ''}>${esc(t('views.save'))}</button></div>
    <div class="err" id="view-err"></div>
    <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
}
