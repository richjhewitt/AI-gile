// Stand-ups (AIG-133..136): the owner calls one, each team answers done / next / blockers, one report shows them all.
const { now, load, save, listSlugs, owner, look, bad } = require('./store');
const { presenceOf, startTeam } = require('./presence');

/* ---------- the card ---------- */
const MESSAGE = [
  `- 📣 **${owner()} called a stand-up**`,
  '- Each of you answer once, with your name:',
  '- `aigile standup <proj> --done "..." --next "..." [--needs "..."] --blockers "..." --as NAME`',
  `- **Blockers** only for what stops **all** your work (nothing else can go on): say \`none\` otherwise`,
  `- **Needs**: things waiting on ${owner()} while you carry on with other work (a test, a key, a question)`,
  '- When everyone has answered, move this card to done',
].join('\n\n');
// AIG-1344: helpers last seen over 12 hours ago (lib/teamlive.js) are not waited for.
const ownTeam = p => { const TL = require('./teamlive'), x = TL.ctxOf(p, presenceOf(p.slug)); return (p.team || []).filter(m => !/retired/i.test(m.status || '') && !TL.stale(m, x)).map(m => m.name); };
// 🪐 AIG-439: a space led from one of its projects: that project's lead answers the space's stand-up too.
const leadFrom = p => { const L = require('./spacelead').elsewhere(p), q = L && load(L); return q || null; };
const teamOf = p => { const t = ownTeam(p), q = leadFrom(p), n = q && (q.team || []).length ? require('./dispatch').leadOf(q).name : ''; return n && !t.some(x => x.toLowerCase() === n.toLowerCase()) ? [...t, n] : t; };
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
    const w = leadFrom(p) || p;   // 🪐 AIG-439: the space's lead lives in a child project: wake that team
    if (!presenceOf(w.slug).online && w.path && !require('./noai').isOn()) {   // 🚫 No AI, ever: people report by hand
      try { startTeam(w); woke.push(p.name); } catch (e) { failed.push(p.name + ': ' + e.message); }
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
  const r = { name, done: clip(b.done), next: clip(b.next), blockers: clip(b.blockers) || 'none', ...(clip(b.needs) ? { needs: clip(b.needs) } : {}), at: now() };
  if (!r.done && !r.next) throw bad('say what you did (--done) or what is next (--next)');
  const i = c.standup.reports.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) c.standup.reports[i] = r; else c.standup.reports.push(r);
  c.comments.push({ author: name, text: `✅ Done: ${r.done || '-'}\n\n➡️ Next: ${r.next || '-'}${r.needs ? '\n\n🙋 Needs you: ' + r.needs : ''}\n\n🚧 Blockers: ${r.blockers}`, at: now() });
  c.updated = now();
  const team = teamOf(p), waiting = team.filter(n => !c.standup.reports.some(x => x.name.toLowerCase() === n.toLowerCase()));
  if (team.length && !waiting.length) { c.status = 'done'; c.needsYou = false; }   // AIG-611: the last member has answered: the stand-up is over
  save(p);
  return { card: c.id, report: r, waiting };
}

/* ---------- report ---------- */
// Per project: the newest stand-up card (open or closed) with each listed member's answer.
// blockers = every answer that names a real blocker (stops all work), for the red list at the top;
// needs = what waits on the owner while the team carries on (AIG-191), for the amber list under it.
// "none" counts even with a note after it: "none (LOC-57 waits for a live test)".
const NO_BLOCKER = /^(none|no|nothing|n\/a|-|no blockers?)\b/i;
// AIG-1384: one line per ask per project. Two leads (Lead and Lead (Opus)) often report the same ask, word for word or one
// with more detail: the line keeps the fuller text and both names.
const same = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[\s.!;:,]+$/, '').trim();
function once(list, x) {
  const k = same(x.text), o = k && list.find(y => y.project === x.project && (same(y.text).startsWith(k) || k.startsWith(same(y.text))));
  if (!o) return list.push(x);
  if (k.length > same(o.text).length) { o.text = x.text; o.at = x.at; }
  if (!o.name.split(', ').includes(x.name)) o.name += ', ' + x.name;
}
function standupReport() {
  const projects = [], blockers = [], needs = [];
  for (const p of listSlugs().map(load).filter(p => p && !p.archived)) {
    const c = p.cards.filter(c => c.standup).sort((a, b) => b.standup.at.localeCompare(a.standup.at))[0];
    if (!c) continue;
    const reports = c.standup.reports, team = teamOf(p);
    // A retired member is not listed, even with an old answer (AIG-319); one who did not report is on call (waiting: true).
    const retired = (p.team || []).filter(m => /retired/i.test(m.status || '')).map(m => m.name.toLowerCase());
    const names = [...team, ...reports.map(r => r.name).filter(n => !team.some(t => t.toLowerCase() === n.toLowerCase()) && !retired.includes(n.toLowerCase()))];
    const people = names.map(n => reports.find(r => r.name.toLowerCase() === n.toLowerCase()) || { name: n, waiting: true });
    const L = look(p);
    for (const r of reports) {
      if (!NO_BLOCKER.test(r.blockers)) once(blockers, { project: p.slug, projectName: p.name, card: c.id, name: r.name, text: r.blockers, at: r.at });
      if (r.needs) once(needs, { project: p.slug, projectName: p.name, card: c.id, name: r.name, text: r.needs, at: r.at });
    }
    projects.push({ project: p.slug, projectName: p.name, color: L.color, emoji: L.emoji, callUrl: p.callUrl || undefined, card: c.id, status: c.status, at: c.standup.at, answered: reports.length, people });
  }
  return { projects: projects.sort((a, b) => b.at.localeCompare(a.at)), blockers, needs };
}

module.exports = { callStandup, reportStandup, standupReport, openStandup };
