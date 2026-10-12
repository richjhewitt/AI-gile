/* ---------- home page: project cards, usage strip ---------- */
function bar(counts, total) {
  if (!total) return '<div class="bar"></div>';
  return '<div class="bar">' + ['done', 'verify', 'review', 'doing', 'team', 'todo'].map(s =>
    counts[s] ? `<span title="${COLS[s]}: ${counts[s]}" style="width:${counts[s] / total * 100}%;background:${COL_COLORS[s]}"></span>` : '').join('') + '</div>';
}

// Token usage (this PC). Plan limits aren't in the logs, so these are plain totals for now.
const fmtTok = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
const usageLine = u => t('home.usageline', { h5: fmtTok(u.h5), today: fmtTok(u.today), d7: fmtTok(u.d7) });
function usageStrip(u) {
  if (NoAi.on) return '';
  if (!u?.enabled) return '';
  const total = Object.values(u.org.models7d).reduce((a, b) => a + b, 0) || 1;
  const models = Object.entries(u.org.models7d).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${Math.round(n / total * 100)}%`).join(' · ');
  return `<a class="usage" href="#/usage" title="${esc(t('home.usage.title'))}">${t('home.usage.html', { h5: fmtTok(u.org.h5), today: fmtTok(u.org.today), d7: fmtTok(u.org.d7), d30: fmtTok(u.org.d30) })}
    <span class="muted">${t('home.usage.mix', { models })}${u.other.d7 ? t('home.usage.other', { n: fmtTok(u.other.d7) }) : ''}</span>
    <span class="muted"> · <b>${t('home.usage.left')}</b></span></a>`;
}

// The Lead Scrum Master, in the same style as a team's presence (AIG-463): running now (and where), idle (and when it last ran), or off.
function smLine(sm) {
  if (NoAi.on) return '';
  if (!sm) return '';
  const run = sm.lastRunAt || sm.lastRound, name = '<b>' + esc(t('smpres.name')) + '</b>';
  if (sm.running || sm.listening) return `<div class="smline">🧭 ${name} <span class="pres on">${esc(t(sm.running ? 'smpres.background' : sm.where === 'vscode' ? 'pres.vscode' : 'pres.terminal'))}</span></div>`;
  if (sm.on) return `<div class="smline">🧭 ${name} <span class="pres off">${esc(t('smpres.idle'))}</span>${run ? ` <span class="muted">${esc(t('smpres.lastran', { when: ago(run) }))}</span>` : ''}</div>`;
  return `<div class="smline">🧭 ${name} <span class="pres off">${esc(t('smpres.off'))}</span></div>`;
}

function renderHome() {
  const inbox = state.inbox.length ? `<details class="inbox" ${state.waitOpen ? 'open' : ''} ontoggle="state.waitOpen = this.open"><summary><h3>${esc(t('home.waiting', { n: state.inbox.length }))}</h3></summary><ul>${state.inbox.map(c =>
    `<li>${c.status === 'verify' ? '🧪' : '❓'} <a href="#/p/${c.project}/${c.id}"><b>${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</b> · ${esc(c.id)} ${esc(c.title)}</a> <span class="muted">${ago(c.updated)}</span></li>`).join('')}</ul></details>` : '';   // closed by default (AIG-105)
  // 🪐 Spaces (AIG-434): the projects as a tree, a space's projects in an indented row under it.
  const cards = Spaces.homeGrid(Spaces.tree(state.projects), projCard);
  return `<div class="toolbar"><button class="primary" onclick="newProject()">${esc(t('home.newproject'))}</button>
      <button onclick="openFileDialog()" title="${esc(t('ofl.btn.title'))}">${esc(t('ofl.btn'))}</button>
      <button onclick="findProjectsDialog()" title="${esc(t('home.find.title'))}">${esc(t('home.find'))}</button>
      <button onclick="tourDialog()" title="${esc(t('tour.btn.title'))}">${esc(t('tour.btn'))}</button>
      <button onclick="goQuiet()" title="${esc(t('home.quiet.title'))}">${esc(t('home.quiet'))}</button>
      <button onclick="callStandup()" title="${esc(t('standup.all.title'))}">${esc(t('standup.all'))}</button>
      <a class="navlink" href="#/standups" title="${esc(t('standup.report.title'))}">${esc(t('standup.report'))}</a><span class="grow"></span>
      <label class="chk"><input type="checkbox" ${state.showArchived ? 'checked' : ''} onchange="toggleArchived(this.checked)"> ${esc(t('home.showarchived'))}</label></div>`
    + usageStrip(state.usage) + inbox + Spaces.outStrip() + `<div class="grid space-tree">${cards || `<p class="muted">${esc(t('projects.none'))}</p>`}</div>` + smLine(state.sm);
}

// One project card: on home, and in a space's grid on its board. sp: { kids, fold, up } from spaces.js.
function projCard(p, sp = {}) {
  const active = p.total - p.counts.backlog;
  const at = p.attention;
  return `<a class="proj ${p.archived ? 'archived' : ''} ${at ? 'needs-poke' : ''} ${sp.kids ? 'is-space' : ''}" href="#/p/${p.slug}" style="--proj:${esc(p.color)}" ${Spaces.dragAttrs(p.slug, sp.up || '')}>
    ${at ? `<div class="pokeline ai-only">${at.kind === 'asleep' ? '💤' : '⚠️'} <b>${esc(t('home.poke'))}</b> ${at.kind === 'asleep' ? esc(asleepWhy(at)) : esc(t('home.unanswered', { when: ago(at.since, true) }))}${at.auto ? ` · ${esc(t('poke.auto'))}` : at.held ? ` · ${esc(heldWhy(at))}` : ''}</div>` : ''}
    <h2>${sp.fold || ''}${pic(p.logo, p.emoji)} ${esc(p.name)} ${Spaces.pillHtml(sp.kids)}${p.archived ? `<span class="pill">${esc(t('home.archived'))}</span>` : ''} ${p.needsYou ? `<span class="pill you">${esc(t('home.foryou', { n: p.needsYou }))}</span>` : ''} ${p.blocked ? `<span class="pill blocked">${esc(t('home.blocked', { n: p.blocked }))}</span>` : ''}<span class="space-grow"></span>${Spaces.menuHtml(p.slug)}</h2>
    <div class="muted">${esc(p.description)}</div>
    ${bar(p.counts, active)}
    <div class="counts"><b>${esc(t('home.pctdone', { n: Math.round(p.progress * 100) }))}</b>${Object.entries(COLS).map(([k, v]) => `<span>${v} ${p.counts[k]}</span>`).join('')}</div>
    ${p.team.length ? `<div class="last">👥 ${p.team.map(m => esc(m.name)).join(', ')}</div>` : ''}
    <div class="last">${presenceHtml(p, at?.kind === 'asleep')}</div>
    ${p.inFlight.length ? `<div class="last">🛠 ${flightHtml(p.inFlight)}</div>` : ''}
    ${state.usage?.enabled && state.usage.projects[p.slug] ? `<div class="last">⚡ ${usageLine(state.usage.projects[p.slug])}</div>` : ''}
    ${p.lastLog ? `<div class="last">📝 ${esc(p.lastLog.text)} · ${ago(p.lastLog.at)}</div>` : ''}
  </a>`;
}
