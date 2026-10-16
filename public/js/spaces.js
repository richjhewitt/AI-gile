/* ---------- 🪐 Spaces (AIG-434/464): projects inside projects ---------- */
// A project with projects inside it is a space; each one is still a full project (its own board, team and folder).
// The home page and the rail show the tree with fold arrows; a space's board shows a home-style grid of its projects
// above its own cards. Drag a project onto another to put it inside (home, a space's grid, the rail), onto the
// "take out" strip to move it one level up; ⋯ (or right-click on the rail) is the same as a menu.
const Spaces = (() => {
  const MAX = 3;   // levels shown nested; a deeper space opens from its own board
  // Folded spaces, shared by home and the rail (this browser only). Open by default, so nothing is hidden at first.
  let shut; try { shut = new Set(JSON.parse(localStorage.getItem('aigile.spaceshut') || '[]')); } catch { shut = new Set(); }
  const isOpen = s => !shut.has(s);
  function fold(s) {
    if (shut.has(s)) shut.delete(s); else shut.add(s);
    try { localStorage.setItem('aigile.spaceshut', JSON.stringify([...shut])); } catch {}
    refresh(true); if (typeof Dms !== 'undefined') Dms.reload();
  }

  // The tree from a flat list (in your order). A project whose space isn't in the list (archived, or a loop the server
  // would refuse anyway) sits at the top, so nothing goes missing.
  function tree(list) {
    const by = new Map(list.map(p => [p.slug, p])), kids = new Map();
    const looped = p => { for (let s = p.parent, seen = new Set([p.slug]); s; s = (by.get(s) || {}).parent) { if (seen.has(s)) return true; seen.add(s); } return false; };
    const roots = [];
    for (const p of list) {
      if (p.parent && by.has(p.parent) && !looped(p)) { if (!kids.has(p.parent)) kids.set(p.parent, []); kids.get(p.parent).push(p); } else roots.push(p);
    }
    const of = s => kids.get(s) || [];
    const all = s => of(s).flatMap(k => [k, ...all(k.slug)]);   // everything inside, any depth
    return { roots, of, all, up: s => { const p = by.get(s); return p && by.has(p.parent) ? p.parent : ''; } };
  }

  /* ---------- on a project card (home and a space's grid) ---------- */
  // The fold arrow and the "🪐 n inside" pill; spans, since the card is a link.
  const foldHtml = (slug, n, open) => `<span class="space-fold" role="button" tabindex="0" data-spacefold="${esc(slug)}" aria-expanded="${open}" title="${esc(t(open ? 'space.fold.close' : 'space.fold.open'))}">${open ? '▾' : '▸'}</span>`;
  const pillHtml = n => n ? `<span class="pill space-pill">${esc(t('space.inside', { n }))}</span>` : '';
  const menuHtml = slug => `<span class="space-menu" role="button" tabindex="0" data-spacemenu="${esc(slug)}" title="${esc(t('space.menu.title'))}">⋯</span>`;
  // The attributes that make a project card draggable: what it is, and where "take out" moves it.
  const dragAttrs = (slug, up) => `draggable="true" data-pslug="${esc(slug)}" data-up="${esc(up)}"`;
  const outStrip = () => `<div class="space-out" data-spaceout="1">${esc(t('space.drop.out'))}</div>`;

  // The home grid as a tree: a space's projects in an indented row under it, MAX levels deep.
  function homeGrid(T, card, list = T.roots, depth = 1) {
    return list.map(p => {
      const kids = T.of(p.slug), n = kids.length, nest = n && depth < MAX, open = nest && isOpen(p.slug);
      return card(p, { kids: n, fold: nest ? foldHtml(p.slug, n, open) : '', up: T.up(T.up(p.slug)) })   // up: where Take out moves it, its space's space
        + (open ? `<div class="space-kids" style="--proj:${esc(p.color)}"><div class="grid">${homeGrid(T, card, kids, depth + 1)}</div></div>` : '');
    }).join('');
  }

  // A space's board: its projects as home-style cards above its own cards, in a fold of its own.
  function boardHtml(p, card) {
    const kids = (p.space && p.space.kids) || [];
    if (!kids.length) return '';
    const open = isOpen('grid:' + p.slug);
    return `<details class="space-box" ${open ? 'open' : ''} ontoggle="Spaces.gridToggle('${esc(p.slug)}', this.open)" style="--proj:${esc(p.color)}">
      <summary><h3>${esc(t('space.grid', { n: kids.length }))}</h3> <span class="muted">${esc(t('space.grid.hint'))}</span></summary>
      ${outStrip()}<div class="grid">${kids.map(k => card(k, { kids: k.kids, fold: '', up: p.parent || '' })).join('')}</div>${chainHtml(p)}${rollupHtml(p)}</details>`;
  }
  // 🪐 Children's cards (AIG-436): the open cards of every project inside the space, by column, each with its project's chip.
  // A switch per space (off by default) and a chip per child to hide or show its cards; both kept in this browser.
  const lsSet = k => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
  const lsSave = (k, set) => { try { localStorage.setItem(k, JSON.stringify([...set])); } catch {} };
  function rollupHtml(p) {
    const all = (p.space && p.space.rollup) || [];
    if (!all.length) return '';
    const on = lsSet('aigile.rollup').has(p.slug), hide = lsSet('aigile.rollhide');
    const sw = `<label class="chk roll-switch"><input type="checkbox" id="rollOn" ${on ? 'checked' : ''} onchange="Spaces.rollToggle('${esc(p.slug)}')"> ${esc(t('space.roll', { n: all.length }))}</label>`;
    if (!on) return `<div class="space-roll">${sw}</div>`;
    const kids = [...new Map(all.map(c => [c.slug, c])).values()];
    const chips = kids.map(k => `<button type="button" class="roll-chip${hide.has(k.slug) ? ' off' : ''}" style="--proj:${esc(k.color)}" aria-pressed="${!hide.has(k.slug)}" onclick="Spaces.rollFilter('${esc(k.slug)}')">${esc(k.project)}</button>`).join(' ');
    const shown = all.filter(c => !hide.has(c.slug));
    const cols = ['backlog', 'todo', 'doing', 'review', 'verify', 'team'].map(k => { const cs = shown.filter(c => c.status === k); return cs.length ? `<div class="roll-col"><h4>${esc(t('col.' + k))} <span class="muted">${cs.length}</span></h4>${cs.map(c =>
      `<a class="card roll-card${c.needsYou || c.status === 'verify' ? ' needs-you' : ''}${c.blocked ? ' is-blocked' : ''}" href="#/p/${esc(c.slug)}/${esc(c.id)}"><div class="id">${esc(c.id)} <span class="roll-from" style="--proj:${esc(c.color)}">${esc(c.project)}</span></div><div class="t">${esc(c.title)}</div></a>`).join('')}</div>` : ''; }).join('');
    return `<div class="space-roll">${sw}<div class="roll-chips">${chips}</div><div class="roll-board">${cols || `<p class="muted">${esc(t('board.nomatch'))}</p>`}</div></div>`;
  }
  function rollToggle(s) { const set = lsSet('aigile.rollup'); if (set.has(s)) set.delete(s); else set.add(s); lsSave('aigile.rollup', set); refresh(true); }
  function rollFilter(k) { const set = lsSet('aigile.rollhide'); if (set.has(k)) set.delete(k); else set.add(k); lsSave('aigile.rollhide', set); refresh(true); }
  // ⏳ The chain across the space's projects (AIG-450): what waits for what, and how far the card it waits for is.
  function chainHtml(p) {
    const ch = (p.space && p.space.chain) || [];
    if (!ch.length) return '';
    const link = (s, id, title) => `<a href="#/p/${esc(s)}/${esc(id)}"><b>${esc(id)}</b> ${esc(title)}</a>`;
    return `<div class="space-chain"><h4>${esc(t('space.chain'))}</h4><ul>${ch.map(c => `<li>${link(c.slug, c.id, c.title)} <span class="muted">${esc(t('space.chain.waits'))}</span> `
      + c.waits.map(w => `${link(w.slug, w.id, w.title)} <span class="pill${w.status === 'done' ? ' ok' : ''}">${esc(w.status === 'done' ? '✅' : '⏳ ' + t('col.' + w.status))}</span>`).join(', ') + `</li>`).join('')}</ul></div>`;
  }
  function gridToggle(s, open) {
    if (open === isOpen('grid:' + s)) return;
    if (open) shut.delete('grid:' + s); else shut.add('grid:' + s);
    try { localStorage.setItem('aigile.spaceshut', JSON.stringify([...shut])); } catch {}
  }

  /* ---------- moving ---------- */
  // into: the space's slug, or '' for the top level.
  async function move(slug, into) {
    try {
      const r = await api('PATCH', '/api/projects/' + slug, { parent: into || '' });
      note(into ? t('space.moved', { name: r.name, space: nameOf(into) }) : t('space.movedtop', { name: r.name }));
    } catch (err) { alert(err.message); }
    refresh(true); if (typeof Dms !== 'undefined') Dms.reload();
  }
  // Names for the note after a move: from what the page already holds, else the slug.
  const nameOf = s => { const all = [...(state.projects || []), ...((state.project && state.project.space && state.project.space.kids) || [])]; const p = all.find(x => x.slug === s) || (state.project && state.project.slug === s && state.project); return p ? p.name : s; };

  // ⋯ The menu: Move into… (any project but itself and what's inside it) and Take out (one level up).
  async function menu(slug) {
    let list; try { list = await api('GET', '/api/projects'); } catch (err) { return alert(err.message); }
    const p = list.find(x => x.slug === slug); if (!p) return;
    const T = tree(list), below = new Set(T.all(slug).map(x => x.slug)), up = list.find(x => x.slug === p.parent);
    // Every possible space in tree order, indented by depth.
    const opts = [], walk = (xs, d) => { for (const x of xs) { if (x.slug !== slug && !below.has(x.slug) && x.slug !== p.parent) opts.push([x, d]); if (x.slug !== slug) walk(T.of(x.slug), d + 1); } };
    walk(T.roots, 0);
    openDialog(`<h2>${esc(t('space.menu.h', { name: p.name }))}</h2>
      <p class="muted">${up ? esc(t('space.at.in', { name: up.name })) : esc(t('space.at.top'))}</p>
      ${opts.length ? `<div class="space-into"><label for="spInto">${esc(t('space.into'))}</label> <select id="spInto">${opts.map(([x, d]) => `<option value="${esc(x.slug)}">${'  '.repeat(d)}${esc((x.emoji ? x.emoji + ' ' : '') + x.name)}</option>`).join('')}</select>
        <button class="primary" id="spMove" onclick="Spaces.menuMove('${esc(slug)}')">${esc(t('space.move'))}</button></div>` : `<p class="muted">${esc(t('space.none'))}</p>`}
      ${up ? `<p><button id="spOut" onclick="closeDialog(); Spaces.move('${esc(slug)}', '${esc(up.parent || '')}')" title="${esc(t('space.out.title', { name: up.name }))}" aria-label="${esc(t('space.out.title', { name: up.name }))}">${esc(t('space.out'))}</button></p>` : ''}
      <p><button id="spHf" onclick="closeDialog(); Hyperfocus.on('${esc(slug)}')" title="${esc(t('hf.btn.title'))}" aria-label="${esc(t('hf.btn.title'))}">${esc(t('hf.btn'))}</button></p>
      <p class="muted">${esc(t('space.hint'))}</p>
      <div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  }
  function menuMove(slug) { const v = $('spInto') && $('spInto').value; closeDialog(); if (v) move(slug, v); }

  /* ---------- drag on the page (home and a space's grid); the rail has its own in dms.js ---------- */
  let dragging = null;
  const cardAt = e => e.target.closest && e.target.closest('#app .proj[data-pslug]');
  const outAt = e => e.target.closest && e.target.closest('#app [data-spaceout]');
  const unmark = () => document.querySelectorAll('#app .drop-into').forEach(x => x.classList.remove('drop-into'));
  document.addEventListener('dragstart', e => {
    const c = cardAt(e); if (!c) return;
    dragging = { slug: c.dataset.pslug, up: c.dataset.up || '', inside: !!c.closest('.space-kids, .space-box') };
    state.dragging = true;   // the poll doesn't redraw mid-drag
    c.classList.add('dragging'); document.body.classList.toggle('space-dragging', dragging.inside);
    e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragging.slug); } catch {}
  });
  document.addEventListener('dragover', e => {
    if (!dragging) return;
    const c = cardAt(e), o = !c && outAt(e), to = c && c.dataset.pslug !== dragging.slug ? c : o && dragging.inside ? o : null;
    unmark(); if (!to) return;
    e.preventDefault(); to.classList.add('drop-into');
  });
  document.addEventListener('drop', e => {
    if (!dragging) return;
    const c = cardAt(e), o = !c && outAt(e), d = dragging;
    if (c && c.dataset.pslug !== d.slug) { e.preventDefault(); end(); move(d.slug, c.dataset.pslug); }
    else if (o && d.inside) { e.preventDefault(); end(); move(d.slug, d.up); }
  });
  function end() { dragging = null; state.dragging = false; unmark(); document.body.classList.remove('space-dragging'); document.querySelectorAll('#app .proj.dragging').forEach(x => x.classList.remove('dragging')); }
  document.addEventListener('dragend', () => { if (dragging) { end(); refresh(true); } });

  // The fold arrow and ⋯ sit inside a card link: they act, and the link doesn't open. Enter or Space works too.
  function act(e) {
    const f = e.target.closest && e.target.closest('[data-spacefold]'), m = !f && e.target.closest && e.target.closest('[data-spacemenu]');
    if (!f && !m) return false;
    e.preventDefault(); e.stopPropagation();
    if (f) fold(f.dataset.spacefold); else menu(m.dataset.spacemenu);
    return true;
  }
  document.addEventListener('click', act, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') act(e); }, true);

  return { MAX, tree, isOpen, fold, homeGrid, boardHtml, gridToggle, rollToggle, rollFilter, pillHtml, menuHtml, dragAttrs, outStrip, move, menu, menuMove };
})();
