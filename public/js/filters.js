/* ---------- search and filter bar ---------- */
// ---- search / filter (AIG-16): purely in the browser, no extra server calls -----------------------
// The bar lives outside #app so the 1s refresh never wipes what the owner is typing; typing only re-draws the board.
state.filters = {};
const blankFilter = () => ({ q: '', type: '', who: '', sprint: '' });
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
  if (f.q) { const q = f.q.toLowerCase(); if (![c.id, c.title, c.description, c.assignee, c.sprint].some(x => String(x || '').toLowerCase().includes(q))) return false; }
  return true;
}
function paintFilterBar() {
  const bar = $('filterbar');
  if (state.route.view !== 'project' || !state.project) { if (bar.innerHTML) { bar.innerHTML = ''; bar.dataset.slug = ''; } return; }
  const p = state.project, f = curFilter(p.slug);
  const uniq = key => [...new Set(p.cards.map(c => c[key]).filter(Boolean))].sort();
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const sel = (key, all, list) => `<select data-f="${key}">${opt('', all, f[key])}${list.map(v => opt(v, key === 'type' ? t('type.' + v) : v, f[key])).join('')}</select>`;
  const shown = p.cards.filter(c => matchesFilter(c, p.slug)).length, active = f.q || f.type || f.who || f.sprint;
  const selects = sel('type', t('filter.types'), ['feature', 'bug', 'task']) + sel('who', t('filter.anyone'), uniq('assignee')) + sel('sprint', t('filter.sprints'), uniq('sprint'));
  if (bar.dataset.slug !== p.slug) {   // build once per project; afterwards only the selects and count update
    bar.dataset.slug = p.slug;
    bar.innerHTML = `<div class="fbar"><input type="search" id="f-q" placeholder="${esc(t('filter.search'))}" value="${esc(f.q)}" oninput="setFilter('q', this.value)">
      <span id="f-sel">${selects}</span><span id="f-count" class="muted"></span></div>`;
    bar.querySelector('#f-sel').onchange = e => setFilter(e.target.dataset.f, e.target.value);
  } else if ($('f-sel').dataset.sig !== selects && !$('f-sel').contains(document.activeElement)) { $('f-sel').innerHTML = selects; }
  $('f-sel').dataset.sig = selects;
  $('f-count').innerHTML = active ? t('filter.count.html', { shown, n: p.cards.length }) : '';
}
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
  p.views = views.length ? views : undefined;   // show it now, before the next poll
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
  openDialog(`<h2>${esc(t('views.title'))}</h2><p class="muted">${esc(t('views.intro'))}</p>
    ${vs.length ? vs.map((v, i) => `<div class="viewrow"><button type="button" class="grow" onclick="applyView(${i})">${v.name === cur ? '✓ ' : ''}${esc(v.name)}</button><button type="button" class="colbtn" title="${esc(t('views.delete'))}" onclick="deleteView(${i})">✕</button></div>`).join('') : `<p class="muted">${esc(t('views.none'))}</p>`}
    <h3>${esc(t('views.save.h'))}</h3>
    <div class="viewrow"><input type="text" id="view-name" maxlength="40" placeholder="${esc(t('views.placeholder'))}" onkeydown="if(event.key==='Enter')saveView()"><button class="primary" type="button" onclick="saveView()" ${vs.length >= 20 ? `disabled title="${esc(t('views.max'))}"` : ''}>${esc(t('views.save'))}</button></div>
    <div class="err" id="view-err"></div>
    <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
}
