// Stand-ups (AIG-133..136): the owner calls one, each team answers done / next / blockers, one report shows them all.
const { now, load, save, listSlugs, owner, look, bad } = require('./store');
const { presenceOf, startTeam } = require('./presence');

/* ---------- the card ---------- */
const MESSAGE = [
  `- 📣 **${owner()} called a stand-up**`,
  '- Each of you answer once, with your name:',
  '- `aigile standup <proj> --done "..." --next "..." --blockers "..." --as NAME`',
  '- Blockers: say `none` if you have none',
  '- When everyone has answered, move this card to done',
].join('\n\n');
const teamOf = p => (p.team || []).filter(m => !/retired/i.test(m.status || '')).map(m => m.name);
// The stand-up card still being answered: a card with .standup that is not done. Newest wins.
const openStandup = p => p.cards.filter(c => c.standup && c.status !== 'done').sort((a, b) => b.standup.at.localeCompare(a.standup.at))[0];

/* ---------- call ---------- */
// slugs = the chosen projects; none = every live project. A project that already has an open stand-up is left alone.
// Teams that are asleep are woken, like going quiet does.
function callStandup(slugs) {
  const all = listSlugs().map(load).filter(p => p && !p.archived);
  const chosen = Array.isArray(slugs) && slugs.length ? slugs : null;
  if (chosen) for (const s of chosen) if (!all.some(p => p.slug === s)) throw bad('unknown project "' + s + '"', 404);
  const called = [], already = [], woke = [], failed = [];
  for (const p of all.filter(p => !chosen || chosen.includes(p.slug))) {
    if (openStandup(p)) { already.push(p.name); continue; }
    p.cards.push({
      id: p.key + '-' + p.nextId++, title: '📣 Stand-up', description: MESSAGE, testSteps: '',
      type: 'task', priority: 'high', status: 'team', assignee: '', sprint: '', blocked: false, needsYou: false,
      createdBy: owner(), created: now(), updated: now(), comments: [],
      standup: { at: now(), reports: [] },
    });
    save(p);
    called.push(p.name);
    if (!presenceOf(p.slug).online && p.path) {
      try { startTeam(p); woke.push(p.name); } catch (e) { failed.push(p.name + ': ' + e.message); }
    }
  }
  return { called, already, woke, failed };
}

/* ---------- answer ---------- */
// One member's report on the open stand-up card; answering again replaces their earlier answer.
function reportStandup(p, b) {
  const c = openStandup(p);
  if (!c) throw bad('no open stand-up for this project', 404);
  const name = String(b.author || '').trim();
  if (!name) throw bad('author is required');
  const clip = v => String(v || '').trim().slice(0, 2000);
  const r = { name, done: clip(b.done), next: clip(b.next), blockers: clip(b.blockers) || 'none', at: now() };
  if (!r.done && !r.next) throw bad('say what you did (--done) or what is next (--next)');
  const i = c.standup.reports.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) c.standup.reports[i] = r; else c.standup.reports.push(r);
  c.comments.push({ author: name, text: `✅ Done: ${r.done || '-'}\n\n➡️ Next: ${r.next || '-'}\n\n🚧 Blockers: ${r.blockers}`, at: now() });
  c.updated = now();
  save(p);
  const team = teamOf(p), waiting = team.filter(n => !c.standup.reports.some(x => x.name.toLowerCase() === n.toLowerCase()));
  return { card: c.id, report: r, waiting };
}

/* ---------- report ---------- */
// Per project: the newest stand-up card (open or closed) with each listed member's answer.
// blockers = every answer that names a real blocker, for the red list at the top.
const NO_BLOCKER = /^(none|no|nothing|n\/a|-|no blockers?)\.?$/i;
function standupReport() {
  const projects = [], blockers = [];
  for (const p of listSlugs().map(load).filter(p => p && !p.archived)) {
    const c = p.cards.filter(c => c.standup).sort((a, b) => b.standup.at.localeCompare(a.standup.at))[0];
    if (!c) continue;
    const reports = c.standup.reports, team = teamOf(p);
    const names = [...team, ...reports.map(r => r.name).filter(n => !team.some(t => t.toLowerCase() === n.toLowerCase()))];
    const people = names.map(n => reports.find(r => r.name.toLowerCase() === n.toLowerCase()) || { name: n, waiting: true });
    const L = look(p);
    for (const r of reports) if (!NO_BLOCKER.test(r.blockers)) blockers.push({ project: p.slug, projectName: p.name, card: c.id, name: r.name, text: r.blockers, at: r.at });
    projects.push({ project: p.slug, projectName: p.name, color: L.color, emoji: L.emoji, card: c.id, status: c.status, at: c.standup.at, answered: reports.length, people });
  }
  return { projects: projects.sort((a, b) => b.at.localeCompare(a.at)), blockers };
}

module.exports = { callStandup, reportStandup, standupReport, openStandup };
