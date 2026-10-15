/* ---------- stand-ups (AIG-133): call one for a project, or all ---------- */
// The server puts a 📣 card in each chosen team's For the team column and wakes sleeping teams. Then we show the report page.
async function callStandup(slugs, sure) {
  if (!slugs) { slugs = []; if (!sure && !confirm(t('standup.confirm'))) return; }
  try {
    suPromptGone();
    const r = await api('POST', '/api/standup', { projects: slugs });
    if (r.failed.length) alert(t('standup.failed', { names: r.failed.join('; ') }));
    location.hash = slugs.length === 1 ? '#/standups/' + encodeURIComponent(slugs[0]) : '#/standups';   // one team: its own report (AIG-539)
  } catch (e) { alert(e.message); }
}
// Projects with at least one answer on their newest stand-up card: the board shows a link to the report then.
const hasStandupAnswers = p => p.cards.some(c => c.standup && c.standup.reports.length);
const standupButtons = p => `<button onclick="callStandup(['${p.slug}'])" title="${esc(t('standup.team.title'))}">${esc(t('standup.team'))}</button>`
  + (hasStandupAnswers(p) ? ` <a class="navlink" href="#/standups/${encodeURIComponent(p.slug)}" title="${esc(t('standup.report.title'))}">${esc(t('standup.report'))}</a>` : '');

/* ---------- morning prompt (AIG-136): once a day, per browser ---------- */
// A small pill in the bottom corner, never a dialog and it never takes focus. It waits while a dialog is open or a
// field has focus, so it can't land on what is being typed. Shown at most once per day: the day is saved when it appears.
const suDay = () => new Date().toLocaleDateString('sv');
const suPromptGone = () => { const el = $('suPrompt'); if (el) el.remove(); };
async function morningPrompt() {
  if (document.hidden) return void setTimeout(morningPrompt, 60e3);
  if (/^#\/pop/.test(location.hash)) return;
  if (!i18n.ready) return void setTimeout(morningPrompt, 500);
  // Never in a pop-out (AIG-281): in the small night glance it covered the projects.
  if ($('suPrompt') || !state.route || state.route.pop || state.route.popList || ['setup', 'night', 'watch', 'news'].includes(state.route.view)) return;
  try { if (localStorage.getItem('aigile.standupAsked') === suDay()) return; } catch { return; }   // no storage: never nag
  const a = document.activeElement;
  if (busy() || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return void setTimeout(morningPrompt, 3000);
  // Read the shared project list only when a prompt can actually be shown; only worth asking once a project has a team and a folder on disk (AIG-1078).
  try { if (!(await PagePoll.get('/api/projects')).some(p => !p.archived && p.path && !p.pathMissing && (p.crew || []).length)) return void setTimeout(morningPrompt, 60e3); } catch { return; }
  try { localStorage.setItem('aigile.standupAsked', suDay()); } catch { return; }
  const el = document.createElement('div'); el.id = 'suPrompt';
  el.innerHTML = `<div class="su-pill"><b>${esc(t('standup.prompt'))}</b>
    <button class="primary" onclick="callStandup(null, true)">${esc(t('standup.prompt.all'))}</button>
    <button onclick="suPick()">${esc(t('standup.prompt.pick'))}</button>
    <button onclick="suPromptGone()">${esc(t('standup.prompt.no'))}</button></div>`;
  document.body.appendChild(el);
}
// Gone on any move to another page and on Esc: it is only a nudge, never something to leave sitting over a list or a chat (AIG-1139).
window.addEventListener("hashchange", suPromptGone);
document.addEventListener("keydown", e => { if (e.key === "Escape") suPromptGone(); });
async function suPick() {
  const ps = await api('GET', '/api/projects');
  openDialog(`<h2>${esc(t('standup.pick.title'))}</h2><form class="su-pick" onsubmit="return suPicked(event)">
    ${ps.map(p => `<label class="chk"><input type="checkbox" value="${esc(p.slug)}"> ${pic(p.logo, p.emoji)} ${esc(p.name)}</label>`).join('') || `<p class="muted">${esc(t('projects.none'))}</p>`}
    <div class="err" id="su-err"></div>
    <div class="actions"><button class="primary" type="submit">${esc(t('standup.pick.go'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`);
}
async function suPicked(e) {
  e.preventDefault();
  const slugs = [...document.querySelectorAll('.su-pick input:checked')].map(i => i.value);
  if (!slugs.length) { setErr('su-err', t('standup.pick.none')); return false; }
  closeDialog(); callStandup(slugs);
  return false;
}

/* ---------- stand-up report page (AIG-135): #/standups, read-only ---------- */
// Per project, per person: done, next, blockers. Real blockers are also listed in red at the top, each linking to the stand-up card so the owner can answer there.
const noBlocker = t => /^(none|no|nothing|n\/a|-|no blockers?)\b/i.test(String(t || '').trim());
const suLines = t => esc(t).replace(/\n/g, '<br>');
function renderStandups() {
  let d = state.standups;
  if (!d) return `<p class="muted">${esc(t('common.loading'))}</p>`;
  // One team only (AIG-539): #/standups/<project> keeps just that project's blockers, needs and report.
  const only = state.route && state.route.slug;
  if (only) d = { ...d, blockers: d.blockers.filter(b => b.project === only), needs: (d.needs || []).filter(b => b.project === only), projects: d.projects.filter(p => p.project === only) };
  const blockers = d.blockers.length ? `<div class="su-blockers"><h3>${esc(t('standup.blockers', { n: d.blockers.length }))}</h3><ul>${d.blockers.map(b =>
    `<li><a href="#/p/${esc(b.project)}/${esc(b.card)}"><b>${esc(b.projectName)}</b> · ${esc(b.name)}</a>: ${suLines(b.text)} <span class="muted">${ago(b.at)}</span></li>`).join('')}</ul></div>` : '';
  // 🙋 Needs you (AIG-191): waiting on you, but the team carries on with other work. Amber, under the red list.
  const needs = (d.needs || []).length ? `<div class="su-needs"><h3>${esc(t('standup.needs', { n: d.needs.length }))}</h3><ul>${d.needs.map(b =>
    `<li><a href="#/p/${esc(b.project)}/${esc(b.card)}"><b>${esc(b.projectName)}</b> · ${esc(b.name)}</a>: ${suLines(b.text)} <span class="muted">${ago(b.at)}</span></li>`).join('')}</ul></div>` : '';
  const projects = d.projects.map(p => `<div class="su-proj" style="--proj:${esc(p.color)}">
      <h3>${pic(p.logo, p.emoji)} <a href="#/p/${esc(p.project)}">${esc(p.projectName)}</a> ${callLink(p.callUrl, 'su-call')} <span class="muted">${esc(t('standup.answered', { a: p.answered, n: p.people.length, when: ago(p.at) }))} · <a href="#/p/${esc(p.project)}/${esc(p.card)}">${esc(p.card)}</a>${p.status === 'done' ? ' · ' + esc(t('standup.closed')) : ''}</span></h3>
      ${p.people.map(r => r.waiting ? `<div class="su-person waiting"><b>${esc(r.name)}</b> <span class="muted">${esc(t('standup.waiting'))}</span></div>`
        : `<div class="su-person"><b>${esc(r.name)}</b> <span class="muted">${ago(r.at)}</span>
          <div><span class="su-k">${esc(t('standup.done'))}</span> ${suLines(r.done) || '-'}</div>
          <div><span class="su-k">${esc(t('standup.next'))}</span> ${suLines(r.next) || '-'}</div>
          ${r.needs ? `<div class="su-amber"><span class="su-k">${esc(t('standup.needs.k'))}</span> ${suLines(r.needs)}</div>` : ''}
          <div class="${noBlocker(r.blockers) ? '' : 'su-red'}"><span class="su-k">${esc(t('standup.blockers.k'))}</span> ${suLines(r.blockers)}</div></div>`).join('')}
    </div>`).join('');
  return `<div class="su"><div class="toolbar"><h2>${esc(t('standup.report.h'))}</h2><span class="grow"></span>${only ? `<a class="navlink" href="#/standups">${esc(t('standup.report.all'))}</a> <button onclick="callStandup(['${esc(only)}'])">${esc(t('standup.team'))}</button>` : `<button onclick="callStandup()">${esc(t('standup.all'))}</button>`}</div>
    ${blockers}${needs}${projects || `<p class="muted">${t('standup.empty.html')}</p>`}</div>`;
}
