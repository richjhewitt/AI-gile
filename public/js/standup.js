/* ---------- stand-ups (AIG-133): call one for a project, or all ---------- */
// The server puts a 📣 card in each chosen team's For the team column and wakes sleeping teams. Then we show the report page.
async function callStandup(slugs) {
  if (!slugs) { slugs = []; if (!confirm('Call a stand-up with every team?')) return; }
  try {
    const r = await api('POST', '/api/standup', { projects: slugs });
    if (r.failed.length) alert('⚠️ Could not wake: ' + r.failed.join('; '));
    location.hash = '#/standups';
  } catch (e) { alert(e.message); }
}
// Projects with at least one answer on their newest stand-up card: the board shows a link to the report then.
const hasStandupAnswers = p => p.cards.some(c => c.standup && c.standup.reports.length);
const standupButtons = p => `<button onclick="callStandup(['${p.slug}'])" title="Ask this team for done / next / blockers">📣 Stand-up</button>`
  + (hasStandupAnswers(p) ? ` <a class="navlink" href="#/standups" title="See what the teams said">📋 Stand-up report</a>` : '');
