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
};
module.exports = cmds;
