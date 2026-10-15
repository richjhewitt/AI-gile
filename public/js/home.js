/* ---------- home page: project cards, usage strip ---------- */
function bar(counts, total) {
  if (!total) return '<div class="bar"></div>';
  // AIG-1080: nothing started or done yet (0%): the waiting cards are a small segment, not the whole track.
  const cap = ['done', 'verify', 'review', 'doing'].some(k => counts[k]) ? 1 : 0.15;
  return '<div class="bar">' + ['done', 'verify', 'review', 'doing', 'team', 'todo'].map(s =>
    counts[s] ? `<span title="${COLS[s]}: ${counts[s]}" style="width:${counts[s] / total * 100 * cap}%;background:${COL_COLORS[s]}"></span>` : '').join('') + '</div>';
}

// Plan left (AIG-937): the same "% left" figures as the Usage page (UsageGlance reads them); hidden while there is no reading.
const fmtTok = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
const usageLine = u => t('home.usageline', { h5: fmtTok(u.h5), today: fmtTok(u.today), d7: fmtTok(u.d7) });
function usageStrip(u) {
  if (NoAi.on) return '';
  const html = UsageGlance.homeHtml();
  return `<a class="usage" id="homeUsage" href="#/usage" title="${esc(t('home.usage.title'))}" ${html ? '' : 'hidden'}>${html}</a>`;
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
  const fresh = !state.projects.length && !state.showArchived && !state.hasArchived;   // AIG-1073: nothing yet, so no Show archived and no Scrum Master line
  // AIG-937: one + New project button; the rest sit under More (same elements, same ids and handlers). QA keeps it open with localStorage aigile.homeMoreOpen=1.
  let moreOpen = state.homeMore; if (moreOpen === undefined) { try { moreOpen = localStorage.getItem('aigile.homeMoreOpen') === '1'; } catch { moreOpen = false; } }
  return `<div class="toolbar"><button class="primary" onclick="newProject()">${esc(t('home.newproject'))}</button> <button id="homeMoreBtn" aria-expanded="${!!moreOpen}" aria-controls="homeMenu" onclick="homeMore()" title="${esc(t('home.more.title'))}">${esc(t('home.more'))}</button><span class="grow"></span>
      ${fresh ? '' : `<label class="chk"><input type="checkbox" ${state.showArchived ? 'checked' : ''} onchange="toggleArchived(this.checked)"> ${esc(t('home.showarchived'))}</label>`}
      <div class="hm-menu" id="homeMenu" ${moreOpen ? '' : 'hidden'}><button onclick="refactorOffer()" title="${esc(t('rf.btn.title'))}">${esc(t('rf.btn'))}</button> <button onclick="newProject({ space: true })" title="${esc(t('home.newspace.title'))}">${esc(t('home.newspace'))}</button>
      <button onclick="openFileDialog()" title="${esc(t('ofl.btn.title'))}">${esc(t('ofl.btn'))}</button>
      <button onclick="findProjectsDialog()" title="${esc(t('home.find.title'))}">${esc(t('home.find'))}</button>
      <button onclick="tourDialog()" title="${esc(t('tour.btn.title'))}">${esc(t('tour.btn'))}</button>
      <button onclick="goQuiet()" title="${esc(t('home.quiet.title'))}">${esc(t('home.quiet'))}</button>
      ${Break.btn()} ${Break.showerBtn()} ${MyDay.btn()}
      <button onclick="callStandup()" title="${esc(t('standup.all.title'))}">${esc(t('standup.all'))}</button>
      <a class="navlink" href="#/today" title="${esc(t('today.link.title'))}">${esc(t('today.link'))}</a> <a class="navlink" href="#/life" title="${esc(t('la.link.title'))}">${esc(t('la.link'))}</a> <a class="navlink" href="#/standups" title="${esc(t('standup.report.title'))}">${esc(t('standup.report'))}</a></div></div>`
    + (state.setupNeeded ? `<p class="muted finish-setup" id="finishSetup">🧰 ${esc(t('home.finishsetup'))} <a class="navlink" href="#/setup/you">${esc(t('home.finishsetup.go'))}</a></p>` : '') + usageStrip(state.usage) + inbox + Spaces.outStrip() + TodayPage.hiddenLine() + `<div class="grid space-tree">${cards || welcomeCard()}</div>` + (fresh ? '' : smLine(state.sm));
}

// AIG-1073: empty home. #homeWelcomeActions is where more starting buttons go (the sample project, AIG-1072).
function welcomeCard() {
  return `<div class="welcome" id="homeWelcome"><h2>${esc(t('home.welcome.h'))}</h2><p>${esc(t('home.welcome.p'))}</p>
    <div class="welcome-actions" id="homeWelcomeActions"><button class="primary big" id="homeWelcomeNew" onclick="newProject()">${esc(t('home.newproject'))}</button> <button id="sampleBtn" onclick="addSample()" title="${esc(t('sample.add.title'))}">${esc(t('sample.add'))}</button></div></div>`;
}

function homeMore() {
  const m = document.getElementById('homeMenu'), b = document.getElementById('homeMoreBtn'); if (!m) return;
  m.hidden = !m.hidden; state.homeMore = !m.hidden; if (b) b.setAttribute('aria-expanded', String(!m.hidden));
}

// One project card: on home, and in a space's grid on its board. sp: { kids, fold, up } from spaces.js.
function projCard(p, sp = {}) {
  const active = p.total - p.counts.backlog;
  const at = p.attention;   // home cards skip unassigned in-flight rows and Dispatcher log lines; the board keeps them (AIG-924)
  return `<a class="proj ${p.archived ? 'archived' : ''} ${at ? 'needs-poke' : ''} ${sp.kids ? 'is-space' : ''}" href="#/p/${p.slug}" style="--proj:${esc(p.color)}" ${Spaces.dragAttrs(p.slug, sp.up || '')}>
    ${at ? `<div class="pokeline ai-only">${at.kind === 'asleep' ? '💤' : '⚠️'} <b>${esc(t('home.poke'))}</b> ${at.kind === 'asleep' ? esc(asleepWhy(at)) : esc(t('home.unanswered', { when: ago(at.since, true) }))}${at.auto ? ` · ${esc(t('poke.auto'))}` : at.held ? ` · ${esc(heldWhy(at))}` : ''}</div>` : ''}
    <h2>${sp.fold || ''}${pic(p.logo, p.emoji)} ${esc(p.name)} ${p.private ? '<span class="lock" title="' + esc(t('look.private')) + '">🔒</span> ' : ''}${p.personal ? '<span class="lock" title="' + esc(t('pub.personal')) + '">🏡</span> ' : ''}${p.aiOff ? '<span class="aioff" title="' + esc(t('today.aioff.badge')) + '">⏸</span> ' : ''}${TodayPage.badge(p.slug)} ${Spaces.pillHtml(sp.kids)}${p.archived ? `<span class="pill">${esc(t('home.archived'))}</span>` : ''}${p.sample ? ` <span class="pill sample-pill">${esc(t('sample.pill'))}</span>` : ''} ${p.needsYou ? `<span class="pill you">${esc(t('home.foryou', { n: p.needsYou }))}</span>` : ''} ${p.blocked ? `<span class="pill blocked">${esc(t('home.blocked', { n: p.blocked }))}</span>` : ''}<span class="space-grow"></span>${Spaces.menuHtml(p.slug)}</h2>
    <div class="muted">${esc(p.description)}</div>
    ${p.service ? `<div class="svc-line">${p.service.up === false ? "🔴" : p.service.up === true ? "🟢" : ""}🛎️ ${esc(p.service.offers || p.name)} · ${esc(t('svc.oncall', { name: p.service.onCall }))}${p.service.url ? ` · <span class="svc-url" role="link" tabindex="0" data-href="${esc(p.service.url)}" onclick="event.preventDefault();event.stopPropagation();window.open(this.dataset.href,'_blank','noopener')">${esc(p.service.url.replace(/^https?:\/\//, ''))}</span>` : ''}</div>` : ''}
    ${bar(p.counts, active)}
    <div class="counts"><b>${esc(t('home.pctdone', { n: Math.round(p.progress * 100) }))}</b>${Object.entries(COLS).filter(([k]) => p.counts[k]).map(([k, v]) => `<span>${v} ${p.counts[k]}</span>`).join('')}</div>
    ${p.team.length ? `<div class="last">👥 ${p.team.map(m => esc(m.name)).join(', ')}</div>` : ''}
    <div class="last">${presenceHtml(p, at?.kind === 'asleep')}</div>
    ${(fl => fl.length ? `<div class="last">🛠 ${flightHtml(fl, p.slug)}</div>` : '')(p.inFlight.filter(c => c.worker || c.assignee))}
    ${state.usage?.enabled && state.usage.projects[p.slug] ? `<div class="last">⚡ ${usageLine(state.usage.projects[p.slug])}</div>` : ''}
    ${p.lastLog && p.lastLog.author !== 'Dispatcher' ? `<div class="last">📝 ${esc(p.lastLog.text)} · ${ago(p.lastLog.at)}</div>` : ''}
  </a>`;
}
