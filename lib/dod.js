// Definition of Ready / Done (AIG-864): two short checklists per project. Stored as p.dod { ready: [], done: [] } only when the
// owner changed one (old projects have none and get the defaults). A list that is emptied goes back to the default.
const DEFAULTS = {
  ready: ['clear title and bullets', 'test steps known', 'no open question'],
  done: ['QA green', 'screenshot or commit attached', 'steps under a minute', 'guide page updated if the owner sees a change'],
};
const KINDS = Object.keys(DEFAULTS);
const clean = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[|\n]/)).map(s => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 12);

// The two lists for a project (its own where set, else the defaults).
function of(p) { const d = (p && p.dod) || {}; return Object.fromEntries(KINDS.map(k => [k, Array.isArray(d[k]) && d[k].length ? d[k].slice() : DEFAULTS[k].slice()])); }
// Apply { ready?, done? } to a project object: a list equal to the default (or empty) is not stored.
function set(p, b) {
  const d = { ...(p.dod || {}) };
  for (const k of KINDS) if (b && k in b) { const l = clean(b[k]); if (l.length && l.join('|') !== DEFAULTS[k].join('|')) d[k] = l; else delete d[k]; }
  p.dod = Object.keys(d).length ? d : undefined;
}
// A short reminder block for the CLI.
const block = (p, kind) => (kind === 'ready' ? 'Definition of Ready:\n' : 'Definition of Done:\n') + of(p)[kind].map(i => '  [ ] ' + i).join('\n');

module.exports = { DEFAULTS, of, set, block, clean };
