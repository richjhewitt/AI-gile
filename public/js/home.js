/* ---------- home page: project cards, usage strip ---------- */
function bar(counts, total) {
  if (!total) return '<div class="bar"></div>';
  return '<div class="bar">' + ['done', 'verify', 'review', 'doing', 'team', 'todo'].map(s =>
    counts[s] ? `<span title="${COLS[s]}: ${counts[s]}" style="width:${counts[s] / total * 100}%;background:${COL_COLORS[s]}"></span>` : '').join('') + '</div>';
}

// Token usage (this PC). Plan limits aren't in the logs, so these are plain totals for now.
const fmtTok = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
const usageLine = u => `5h ${fmtTok(u.h5)} · today ${fmtTok(u.today)} · 7d ${fmtTok(u.d7)}`;
function usageStrip(u) {
  if (!u?.enabled) return '';
  const total = Object.values(u.org.models7d).reduce((a, b) => a + b, 0) || 1;
  const models = Object.entries(u.org.models7d).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${Math.round(n / total * 100)}%`).join(' · ');
  return `<a class="usage" href="#/usage" title="Open the Usage page"><b>⚡ Usage, all projects (this PC):</b> last 5h <b>${fmtTok(u.org.h5)}</b> · today <b>${fmtTok(u.org.today)}</b> · 7 days <b>${fmtTok(u.org.d7)}</b> · 30 days ${fmtTok(u.org.d30)}
    <span class="muted">· 7-day mix: ${models}${u.other.d7 ? ` · not on the board: ${fmtTok(u.other.d7)} (7d)` : ''}</span>
    <span class="muted"> · <b>See how much you have left →</b></span></a>`;
}

function renderHome() {
  const inbox = state.inbox.length ? `<details class="inbox" ${state.waitOpen ? 'open' : ''} ontoggle="state.waitOpen = this.open"><summary><h3>Waiting on you (${state.inbox.length})</h3></summary><ul>${state.inbox.map(c =>
    `<li>${c.status === 'verify' ? '🧪' : '❓'} <a href="#/p/${c.project}/${c.id}"><b>${esc(c.projectEmoji || '')} ${esc(c.projectName)}</b> · ${esc(c.id)} ${esc(c.title)}</a> <span class="muted">${ago(c.updated)}</span></li>`).join('')}</ul></details>` : '';   // closed by default (AIG-105)
  const cards = state.projects.map(p => {
    const active = p.total - p.counts.backlog;
    const at = p.attention;
    return `<a class="proj ${p.archived ? 'archived' : ''} ${at ? 'poke' : ''}" href="#/p/${p.slug}" style="--proj:${esc(p.color)}">
      ${at ? `<div class="pokeline">${at.kind === 'asleep' ? '💤' : '⚠️'} <b>Needs a poke:</b> ${at.kind === 'asleep' ? esc(at.why) : 'your comment unanswered for ' + esc(ago(at.since).replace(/ ago$/, ''))}</div>` : ''}
      <h2>${esc(p.emoji)} ${esc(p.name)} ${p.archived ? '<span class="pill">archived</span>' : ''} ${p.needsYou ? `<span class="pill you">${p.needsYou} for you</span>` : ''} ${p.blocked ? `<span class="pill blocked">${p.blocked} blocked</span>` : ''}</h2>
      <div class="muted">${esc(p.description)}</div>
      ${bar(p.counts, active)}
      <div class="counts"><b>${Math.round(p.progress * 100)}% done</b>${Object.entries(COLS).map(([k, v]) => `<span>${v} ${p.counts[k]}</span>`).join('')}</div>
      ${p.team.length ? `<div class="last">👥 ${p.team.map(m => esc(m.name)).join(', ')}</div>` : ''}
      <div class="last">${presenceHtml(p, at?.kind === 'asleep')}</div>
      ${p.inFlight.length ? `<div class="last">🛠 ${flightHtml(p.inFlight)}</div>` : ''}
      ${state.usage?.enabled && state.usage.projects[p.slug] ? `<div class="last">⚡ ${usageLine(state.usage.projects[p.slug])}</div>` : ''}
      ${p.lastLog ? `<div class="last">📝 ${esc(p.lastLog.text)} · ${ago(p.lastLog.at)}</div>` : ''}
    </a>`;
  }).join('');
  return `<div class="toolbar"><button class="primary" onclick="newProject()">+ New project</button>
      <button onclick="findProjectsDialog()" title="Find the projects in a folder and add them to the board">🔎 Find my projects</button>
      <button onclick="goQuiet()" title="Tell every working team you're switching off for a few hours">🌙 Going quiet</button><span class="grow"></span>
      <label class="chk"><input type="checkbox" ${state.showArchived ? 'checked' : ''} onchange="toggleArchived(this.checked)"> Show archived</label></div>`
    + usageStrip(state.usage) + inbox + `<div class="grid">${cards || '<p class="muted">No projects yet.</p>'}</div>`;
}
