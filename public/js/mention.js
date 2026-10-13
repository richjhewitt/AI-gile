// @ tags (AIG-851/853): typing @ in a card reply, test verdict, inbox answer or DM opens a list of the project's agents
// to search as you type; picking one puts "@Name" in the text. The dispatcher wakes that agent (rule named-member,
// lib/dispatch.js). "@Best" at the top asks the board to pick the best agent for the comment.
const Mention = (() => {
  let box = null, ta = null, items = [], at = 0, from = -1, crewAt = 0, projects = [];
  const BOXES = '#r-text, #v-text, #dmText, .ib-item textarea';
  // The project a box belongs to, from its draft key: "slug/ID/reply" or "dm/slug".
  function slugOf(el) {
    const d = String(el.dataset.draft || ''), s = d.split('/');
    if (s[0] === 'dm') return s[1] || '';
    return s[0] || (state.project && state.project.slug) || '';
  }
  async function crew(slug) {
    if (Date.now() - crewAt > 60e3) { try { projects = await api('GET', '/api/projects'); crewAt = Date.now(); } catch {} }
    const p = projects.find(x => x.slug === slug);
    return (p && p.crew) || [];
  }
  function close() { if (box) box.remove(); box = null; ta = null; items = []; from = -1; }
  function draw() {
    box.innerHTML = items.map((m, i) => `<div class="mention-item${i === at ? ' on' : ''}" onmousedown="event.preventDefault();Mention.pick(${i})">${m.best ? esc(t('idea.best')) : `<b>@${esc(m.name)}</b>${m.role ? ` <span class="muted">${esc(m.role)}</span>` : ''}`}</div>`).join('');
  }
  async function look(el) {
    const pos = el.selectionStart, before = el.value.slice(0, pos), m = before.match(/(^|[^\w@])@([\w-]*)$/);
    if (!m) return close();
    const q = m[2].toLowerCase(), list = await crew(slugOf(el));
    if (!list.length) return close();
    const hits = list.filter(x => (x.name + ' ' + x.role).toLowerCase().includes(q));
    items = ('best'.startsWith(q) || !hits.length ? [{ best: true, name: 'Best' }] : []).concat(hits).slice(0, 12);
    ta = el; from = pos - m[2].length - 1; at = 0;
    if (!box) { box = document.createElement('div'); box.className = 'mention-box'; document.body.appendChild(box); }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + 'px', top: Math.min(r.bottom + 2, innerHeight - 260) + 'px', minWidth: Math.min(r.width, 320) + 'px' });
    draw();
  }
  function pick(i) {
    const m = items[i]; if (!m || !ta) return close();
    const el = ta, end = el.selectionStart, word = '@' + m.name + ' ';
    el.value = el.value.slice(0, from) + word + el.value.slice(end);
    const c = from + word.length; close();
    el.focus(); el.setSelectionRange(c, c); el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.addEventListener('input', e => { if (e.target.matches && e.target.matches(BOXES)) look(e.target); else if (box) close(); });
  // Capture, so Enter picks a name instead of sending (the boxes send on Enter themselves).
  document.addEventListener('keydown', e => {
    if (!box || e.target !== ta) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { at = (at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; draw(); }
    else if (e.key === 'Enter' || e.key === 'Tab') pick(at);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  document.addEventListener('focusout', e => { if (e.target === ta) setTimeout(close, 150); });
  return { pick, close };
})();
