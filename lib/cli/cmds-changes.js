// aigile change (AIG-857): 🔀 change cards. `change <proj>` lists, `add "title" [--kind --what --why --undo --risk R-1 --when "from..to" --from AIG-x]`,
// `<id> [same fields]` changes one. `<id> submit [--approvers a,b] | go "note" | nogo "note" | go-anyway ["note"]` is the go / no-go chain (AIG-858). See lib/changes.js.
const { die, text, api, project, P, who, out } = require('./core');

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

  // aigile change-windows (AIG-859): when changes may go live. `set "tue 20:00-22:00 Release|wed 09:00-17:00"`, `set none` clears.
  async 'change-windows'({ pos, flags }) {
    const slug = await project(pos[0]);
    if (pos[1] === 'set') who(flags);   // owner only: the board checks the name
    const d = pos[1] === 'set' ? await api('POST', P(slug) + '/change-windows', { set: pos[2] === 'none' ? '' : await text(pos[2], 'the windows') }) : await api('GET', P(slug) + '/change-windows');
    out(flags, d, d => (d.windows.length ? d.windows.map(w => `${w.day} ${w.from}-${w.to}${w.label ? ' ' + w.label : ''}`).join('\n') + (d.open ? '\nopen now' : d.next ? '\nnext window: ' + d.next.text : '') : 'no change windows (any time)'));
  },
};
module.exports = cmds;
