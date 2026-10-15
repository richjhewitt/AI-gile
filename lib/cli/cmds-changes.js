// aigile change (AIG-857): 🔀 change cards. `change <proj>` lists, `add "title" [--kind --what --why --undo --risk R-1 --when "from..to" --from AIG-x]`,
// `<id> [same fields]` changes one. `<id> submit [--approvers a,b] | go "note" | nogo "note" | go-anyway ["note"]` is the go / no-go chain (AIG-858). See lib/changes.js.
const { die, text, api, project, P, who, out, OWNER } = require('./core');

const cmds = {
  async change({ pos, flags }) {
    const slug = await project(pos[0]);
    const f = v => (typeof v === 'string' ? v : undefined);
    const fields = { kind: f(flags.kind), what: f(flags.what), why: f(flags.why), undo: f(flags.undo), riskId: f(flags.risk), when: f(flags.when), from: f(flags.from) };
    if (fields.riskId === 'none') fields.riskId = '';
    if (fields.when === 'none') fields.when = '';
    for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
    const show = r => `${r.id} [${r.status}] ${r.title} (${r.kind || 'change'})${r.riskId ? ' risk ' + r.riskId : ' no risk logged'}${r.from ? ' from ' + r.from : ''}`
      + ['what', 'why', 'undo'].filter(k => r[k]).map(k => '\n  ' + k + ': ' + r[k]).join('')
      + (r.when ? '\n  when: ' + r.when.from + ' .. ' + r.when.to : '') + ((r.problems || []).length ? '\n  problems: ' + r.problems.join(',') : '');
    if (pos[1] === 'add') {
      const r = await api('POST', P(slug) + '/changes', { ...fields, title: await text(pos[2], 'the title'), createdBy: who(flags) });
      return out(flags, r, r => 'added ' + show(r));
    }
    if (pos[1] && ['submit', 'go', 'nogo', 'go-anyway'].includes(pos[2])) {   // AIG-858: the go / no-go chain
      const base = P(slug) + '/changes/' + pos[1], me = who(flags);
      const say = r => `${r.id} [${r.status}] round ${r.round || 1}: ` + (r.approved ? 'approved' : (r.approvers || []).map(a => a + ((r.votes || {})[a] ? (r.votes[a].go ? ' go' : ' NO GO') : ' waiting')).join(', '));
      if (pos[2] === 'submit') { const r = await api('POST', base + '/submit', { approvers: flags.approvers ? String(flags.approvers).split(',').map(x => x.trim()).filter(Boolean) : undefined }); return out(flags, r, r => 'submitted ' + say(r)); }
      if (pos[2] === 'go-anyway') { const r = await api('POST', base + '/go-anyway', { note: pos[3] }); return out(flags, r, r => 'go anyway ' + say(r)); }
      const note = pos[3] ? await text(pos[3], 'the note') : '';
      if (pos[2] === 'nogo' && !note) die('usage: change <proj> <id> nogo "what has to change"');
      const r = await api('POST', base + '/vote', { go: pos[2] === 'go', note });
      return out(flags, r, r => me + ' voted ' + pos[2] + ': ' + say(r));
    }
    if (pos[1]) {
      if (!Object.keys(fields).length) die('usage: change <proj> <id> [--kind change|feature|fix|other --what ".." --why ".." --undo ".." --risk R-1 --when "from..to" --from AIG-x]');
      const r = await api('PATCH', P(slug) + '/changes/' + pos[1], fields);
      return out(flags, r, r => 'updated ' + show(r));
    }
    const d = await api('GET', P(slug) + '/changes');
    out(flags, d, d => d.changes.length ? d.changes.map(show).join('\n') : 'no change cards');
  },

  // aigile major <proj> <id> --as NAME (AIG-1049): 🚨 the Major incident button on an incident card; again ends it. See lib/major.js.
  async major({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('usage: major <proj> <incident id> --as NAME   (press again to end it)');
    const r = await api('POST', P(slug) + '/cards/' + pos[1] + '/major', { by: who(flags) });
    out(flags, r, r => r.major ? '🚨 Major incident on ' + r.id + ': swarm on, on-call woken' : 'Major incident ended on ' + r.id);
  },

  // aigile pir <proj> <id> --timeline ".." --helped ".." --actions "one | two" --as NAME (AIG-1108): the post-incident review on a done major incident. See lib/pir.js.
  async pir({ pos, flags }) {
    const slug = await project(pos[0]);
    const f = v => (typeof v === 'string' ? v : '');
    if (!pos[1] || !f(flags.timeline) || !f(flags.helped) || !f(flags.actions)) die('usage: pir <proj> <incident id> --timeline "what happened when" --helped "what helped" --actions "first change | second change" --as NAME');
    const r = await api('POST', P(slug) + '/cards/' + pos[1] + '/review', { timeline: f(flags.timeline), helped: f(flags.helped), actions: f(flags.actions), author: who(flags) });
    out(flags, r, r => 'review posted on ' + r.id + ' with ' + r.review.actions.length + ' action item(s)');
  },

  // aigile pir-runbook <proj> <incident id> <name> --text ".." --as NAME (AIG-1109): propose a runbook from the review: one 🚦 Go / Not yet card; Go writes docs/runbooks/<name>.md.
  async 'pir-runbook'({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1] || !pos[2]) die('usage: pir-runbook <proj> <incident id> <name> --text "the runbook steps" --as NAME');
    const c = await api('POST', P(slug) + '/cards/' + pos[1] + '/review/runbook', { name: pos[2], text: await text(flags.text, 'runbook text'), author: who(flags) });
    out(flags, c, c => 'runbook ' + c.id + ' is waiting for ' + OWNER + "'s Go (🚦 Ready for go); the file is only written if he says Go.");
  },

  // aigile release <proj> [<name> [rollback]] --as NAME (AIG-1154): list the releases, make one (the done cards since the last, with notes), or file the roll-back checklist card. See lib/releases.js.
  async release({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) { const d = await api('GET', P(slug) + '/releases'); return out(flags, d, d => d.releases.length ? d.releases.map(r => r.name + '  ' + r.at.slice(0, 10) + '  ' + r.cards.length + ' cards').join('\n') + '\n' + d.next + ' done card(s) waiting for the next release' : 'no releases yet (' + d.next + ' done card(s) waiting)'); }
    who(flags);
    if (pos[2] === 'rollback') { const r = await api('POST', P(slug) + '/releases/' + encodeURIComponent(pos[1]) + '/rollback', {}); return out(flags, r, r => 'roll-back card ' + r.card + ' filed with ' + r.steps + ' undo step(s); nothing was changed in git'); }
    const r = await api('POST', P(slug) + '/releases', { name: pos[1] });
    out(flags, r, r => 'release ' + r.name + ' made with ' + r.cards.length + ' card(s)\n' + r.notes);
  },

  // aigile change-windows (AIG-859): when changes may go live. `set "tue 20:00-22:00 Release|wed 09:00-17:00"`, `set none` clears.
  async 'change-windows'({ pos, flags }) {
    const slug = await project(pos[0]);
    if (pos[1] === 'set') who(flags);   // owner only: the board checks the name
    const d = pos[1] === 'set' ? await api('POST', P(slug) + '/change-windows', { set: pos[2] === 'none' ? '' : await text(pos[2], 'the windows') }) : await api('GET', P(slug) + '/change-windows');
    out(flags, d, d => (d.windows.length ? d.windows.map(w => `${w.day} ${w.from}-${w.to}${w.label ? ' ' + w.label : ''}`).join('\n') + (d.open ? '\nopen now' : d.next ? '\nnext window: ' + d.next.text : '') : 'no change windows (any time)'));
  },
};
module.exports = cmds;
