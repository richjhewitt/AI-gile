// aigile change (AIG-857): 🔀 change cards. `change <proj>` lists, `add "title" [--kind --what --why --undo --risk R-1 --when "from..to" --from AIG-x]`,
// `<id> [same fields]` changes one. See lib/changes.js.
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
