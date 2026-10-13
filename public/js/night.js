/* ---------- 🌙 night glance (AIG-209) ---------- */
// A small pop-out for a second screen while you wind down: near-black and red-tinted, no sound, never steals focus.
// One quiet line per watched project. Urgent = a card stuck after 3 tries or a real 🚧 stand-up blocker: then a slow
// amber glow breathes around the edge, with one line saying what. Everything else waits for the morning.
function openNightGlance() { popOut('night', '#/pop-night', 'aigile-night', 360, 440); }

function renderNight() {
  const w = state.watch, ps = state.projects || [], blockers = (state.standups && state.standups.blockers) || [];
  document.body.classList.add('poplist', 'nightglance');
  if (!w) return `<div class="ng"><div class="ng-moon">🌙</div><p>${esc(t('ng.off'))}</p></div>`;
  const sum = Object.fromEntries((w.summary || []).map(x => [x.project, x]));
  const line = slug => {
    const p = ps.find(x => x.slug === slug), s = sum[slug] || {}; if (!p) return '';
    const [dot, word] = s.stuck && s.stuck.length ? ['🔴', t('ng.stuck', { ids: s.stuck.join(', ') })]
      : p.presence && p.presence.online ? ['🟢', t('ng.working')]
      : s.restarted && s.restarted.length ? ['🟠', t('ng.restarted')] : ['💤', t('ng.asleep')];
    return `<li><span class="ng-dot">${dot}</span><b>${esc(p.name)}</b> <span class="ng-word">${esc(word)}</span></li>`;
  };
  const stuck = (w.summary || []).filter(x => x.stuck && x.stuck.length);
  const urgent = [...stuck.map(x => t('ng.u.stuck', { name: x.name, ids: x.stuck.join(', ') })),
    ...blockers.filter(b => w.watch.includes(b.project)).map(b => t('ng.u.blocker', { name: b.projectName, text: String(b.text).slice(0, 80) }))];
  document.body.classList.toggle('ng-urgent', urgent.length > 0);
  return `<div class="ng"><div class="ng-head"><span class="ng-moon">🌙</span> ${esc(t('ng.h'))}</div>
    <div class="ng-when">${esc(w.lastRound ? t('ng.checked', { when: ago(w.lastRound) }) : t('ng.first'))}</div>
    ${urgent.length ? `<div class="ng-urgent-line">${urgent.map(u => `<div>${esc(u)}</div>`).join('')}</div>` : `<div class="ng-calm">${esc(t('ng.calm'))}</div>`}
    <ul class="ng-list">${w.watch.map(line).join('')}</ul></div>`;
}
