// Agent profiles (AIG-415, docs/PROFILES.md): the scales, the profile file and the one compiler for brief lines.
// Every scale is a whole number, higher = more of the thing named. `ways` is the step today's starter ways of working
// already say: it costs no brief line. `def` is what a new install starts at. `line` says the step for an agent (n -> text);
// a scale with no `line` acts through a setting of its own (the chatty lead, tidy cards, the spend plan, the Scrum Master).
const SCALES = {
  steps: { who: 'owner', max: 5, def: 3, ways: 1, line: {
    2: 'two or three steps at a time, then wait for "done"',
    3: 'one small stage at a time (e.g. "install", then "configure"), then wait',
    4: 'the whole task as a numbered list, then check in at the end',
    5: 'everything at once, with all the detail' } },
  chat: { who: 'owner', max: 5, def: 2, ways: 2 },
  go: { who: 'owner', max: 5, def: 2, ways: 2, line: {
    1: 'ask before every build, however small. Propose and wait for go.',
    3: 'small things (a fix or tweak, under an hour) you may build without asking; log them as a decision. Bigger work: propose and wait for go.',
    4: 'build whole cards without asking; log each as a decision. Ask only for new features or a change of scope.',
    5: 'build everything without asking; tell them after, as a decision on the card.' } },
  words: { who: 'owner', max: 5, def: 2, ways: 2, line: {
    1: 'use no dev words at all; explain everything as if they are new to it.',
    3: 'normal team talk is fine.',
    4: 'dev words are fine; keep it brief.',
    5: 'full technical depth: file names and line refs welcome.' } },
  tidy: { who: 'owner', max: 3, def: 3, ways: 3 },
  thrift: { who: 'owner', max: 5, def: 3, ways: 3 },
  push: { who: 'owner', max: 5, def: 3, ways: 3 },
  alone: { who: 'agent', max: 5, def: 3, ways: 3, line: {
    1: 'Ask the lead (or the owner) about every choice.',
    2: 'Make small choices alone; ask about anything users will see.',
    4: 'Decide almost everything; flag only what cannot be undone.',
    5: 'Work fully on your own.' } },
  tests: { who: 'agent', max: 5, def: 3, ways: 3, line: {
    1: 'Before handing over: a smoke check (it loads, no errors) is enough.',
    2: 'Before handing over: try the change by hand once.',
    4: 'Before handing over: run the full QA area and the edge cases.',
    5: 'Before handing over: full QA, an AI tester pass, and a second agent checks it.' } },
};
const LABELS = ['id', 'name', 'level', 'model'];
const inRange = (k, v) => { const n = Number(v); return SCALES[k] && Number.isInteger(n) && n >= 1 && n <= SCALES[k].max ? n : null; };

// Bad values are ignored and warned once in the server log.
const warned = new Set();
const warn = m => { if (!warned.has(m)) { warned.add(m); console.warn('profiles: ' + m); } };

// The profile file: a `key: value` header between --- lines, then a "How I work" section of bullets.
function parse(text, from = 'profile', labels = LABELS) {
  const lines = String(text || '').replace(/\r/g, '').split('\n'), out = { scales: {}, how: [] };
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
      const m = /^([\w-]+):\s*(.*)$/.exec(lines[i].trim()); if (!m) continue;
      const [, k, v] = m;
      if (labels.includes(k)) out[k] = v.trim();
      else if (inRange(k, v) !== null) out.scales[k] = inRange(k, v);
      else warn(`${from}: ${k}: ${v} ignored (${SCALES[k] ? 'a whole number from 1 to ' + SCALES[k].max : 'not a scale'})`);
    }
    i++;
  }
  for (; i < lines.length; i++) { const m = /^\s*[-*]\s+(.+)$/.exec(lines[i]); if (m) out.how.push(m[1].trim()); }
  return out;
}
function format(p) {
  const head = [...LABELS.filter(k => p[k]).map(k => `${k}: ${p[k]}`), ...Object.keys(SCALES).filter(k => inRange(k, (p.scales || {})[k]) !== null).map(k => `${k}: ${p.scales[k]}`)];
  return ['---', ...head, '---', '## How I work', ...(p.how || []).map(b => '- ' + b)].join('\n') + '\n';
}
// Later layers win: template < owner copy < project override. Each layer only lists what differs.
const merge = (...ps) => ps.filter(Boolean).reduce((a, p) => ({ ...a, ...p, scales: { ...a.scales, ...(p.scales || {}) }, how: (p.how || []).length ? p.how : a.how }), { scales: {}, how: [] });

// The owner scales from the setup prefs (lib/setup.js prefsOf). prefs.go is '' | 'ask' | 'small' today.
const GO_OF = { ask: 1, small: 3 };
const ownerScales = prefs => ({ steps: prefs.steps, go: GO_OF[prefs.go] || SCALES.go.ways, ...(prefs.scales || {}) });

// The owner's lines in every board brief: steps, go and words when not at the ways-of-working step, then helpers per model.
function ownerLines(prefs, owner) {
  const sc = ownerScales(prefs || {}), o = [], say = k => sc[k] !== SCALES[k].ways && SCALES[k].line[sc[k]];
  if (say('go')) o.push(`${owner}'s rule: ${SCALES.go.line[sc.go]}`);
  if (say('steps')) o.push(`${owner}'s rule: when ${owner} does something by hand (server commands, setup, a fix on their machine), give ${SCALES.steps.line[sc.steps]}. This overrides the one-step rule in your ways of working; test steps on cards stay a short list.`);
  if (say('words')) o.push(`${owner}'s rule: when you write to ${owner}, ${SCALES.words.line[sc.words]} This overrides your ways of working.`);
  const hl = ['Opus', 'Sonnet', 'Haiku'].filter(m => prefs['helpers' + m] !== '' && prefs['helpers' + m] != null).map(m => m + ' ' + prefs['helpers' + m]);   // helpers per model (AIG-353)
  if (hl.length) o.push(`${owner}'s rule: use at most ${hl.join(', ')} helpers at once.`);
  return o;
}
// Team roles (AIG-366): only when the owner switched some off, the roles the lead may hand work to.
const rolesLine = (roles, owner) => Array.isArray(roles) ? `${owner}'s rule: You may delegate to: ${roles.filter(r => !/^Tester/.test(r) && !/^Lead/.test(r)).join(', ') || 'nobody (do it yourself)'}.` : '';

// A role's lines for a helper's prompt: its agent scales not at the ways step, then How I work (6 bullets, 600 characters).
function roleLines(p) {
  const o = Object.keys(SCALES).filter(k => SCALES[k].who === 'agent' && p.scales[k] && p.scales[k] !== SCALES[k].ways && SCALES[k].line[p.scales[k]]).map(k => SCALES[k].line[p.scales[k]]);
  let left = 600;
  for (const b of (p.how || []).slice(0, 6)) { if (b.length > left) break; o.push('- ' + b); left -= b.length; }
  return o;
}

// Built-in role templates (AIG-419): profiles/roles/<role>-<level>.md, in git. The level picks the model and the default
// `alone`; a file lists only what its role changes. Junior and mid work is always checked by a senior or the lead.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'profiles');
const LEVELS = { junior: { model: 'haiku', alone: 1 }, mid: { model: 'sonnet', alone: 2 }, senior: { model: 'sonnet', alone: 3 }, principal: { model: 'opus', alone: 4 } };
const LEVEL_RE = new RegExp(`-(${Object.keys(LEVELS).join('|')})$`);
const groupOf = id => String(id).replace(LEVEL_RE, '');   // frontend-mid -> frontend: the same role at another level
const readDir = d => { try { return fs.readdirSync(d).filter(f => f.endsWith('.md')).sort(); } catch { return []; } };
let builtIn = null;
function templates() {
  if (!builtIn) builtIn = Object.fromEntries(readDir(path.join(DIR, 'roles')).map(f => {
    const id = f.slice(0, -3), p = parse(fs.readFileSync(path.join(DIR, 'roles', f), 'utf8'), 'roles/' + f), L = LEVELS[p.level] || {};
    return [id, merge({ model: L.model, scales: L.alone ? { alone: L.alone } : {} }, { ...p, id })];
  }));
  return builtIn;
}
const template = id => templates()[id] || null;

// Team templates (AIG-420): profiles/teams/<id>.md, a `roles: a, b, c` header and one line on when to use it.
let teamList = null;
function teams() {
  if (!teamList) teamList = Object.fromEntries(readDir(path.join(DIR, 'teams')).map(f => {
    const id = f.slice(0, -3), p = parse(fs.readFileSync(path.join(DIR, 'teams', f), 'utf8'), 'teams/' + f, [...LABELS, 'roles']);
    return [id, { id, name: p.name, roles: String(p.roles || '').split(',').map(r => r.trim()).filter(template), when: p.how[0] || '', scales: p.scales }];
  }));
  return teamList;
}

// Today's team roles (AIG-366) are read as these ids; p.roles keeps them by their old names, so no data is rewritten.
const OLD_ROLES = { 'Lead (Opus)': 'lead-principal', 'Reviewer (Opus)': 'reviewer-principal', 'Frontend (Sonnet)': 'frontend-mid', 'Backend (Sonnet)': 'backend-mid', 'QA (Haiku)': 'qa-junior', 'Quick fix (Haiku)': 'quickfix-junior', 'Docs (Haiku)': 'copywriter-junior', 'Tester (Sonnet)': 'tester-mid' };
const OLD = Object.keys(OLD_ROLES), OLD_OF = Object.fromEntries(OLD.map(r => [OLD_ROLES[r], r]));
const idOf = r => OLD_ROLES[r] || r;
const Model = m => String(m || '').replace(/^./, c => c.toUpperCase());
// What a role is called in briefs: its old name, else "UX researcher, senior (Sonnet)".
const label = r => { if (OLD_ROLES[r]) return r; if (OLD_OF[r]) return OLD_OF[r]; const t = template(r); return t ? `${t.name}, ${t.level} (${Model(t.model)})` : r; };
// The roles that are on, as ids: none stored = today's 8 all on. Lead is always on.
const roleIds = roles => Array.isArray(roles) ? [...new Set([OLD_ROLES[OLD[0]], ...roles.map(idOf).filter(template)])] : OLD.map(r => OLD_ROLES[r]);
// A list of old names and ids as p.roles keeps it: Lead first, old names in their order, then the rest; unknown ones dropped.
// undefined = exactly today's 8 (all on).
function storeRoles(list) {
  const ids = roleIds(list), old = OLD.filter(r => ids.includes(OLD_ROLES[r])), rest = ids.filter(id => !OLD_OF[id]);
  return old.length === OLD.length && !rest.length ? undefined : [...old, ...rest];
}
// Applying a team (AIG-420): add = its roles go on and the same role at another level is swapped out, the rest kept;
// replace = the team's roles only (Lead stays on). Returns what p.roles becomes and what was added or swapped out.
function applyTeam(roles, teamId, mode = 'add') {
  const tm = teams()[teamId]; if (!tm) return null;
  const was = roleIds(roles), now = mode === 'replace' ? [] : was.slice(), replaced = [];
  for (const id of tm.roles) for (let i = now.length - 1; i >= 0; i--) if (now[i] !== id && groupOf(now[i]) === groupOf(id) && now[i] !== OLD_ROLES[OLD[0]]) replaced.push(...now.splice(i, 1));
  const ids = roleIds([...now, ...tm.roles]);
  return { roles: storeRoles(ids), added: ids.filter(id => !was.includes(id)), replaced: mode === 'replace' ? was.filter(id => !ids.includes(id)) : replaced };
}

module.exports = { SCALES, LABELS, LEVELS, inRange, parse, format, merge, ownerScales, ownerLines, rolesLine, roleLines, groupOf, templates, template, teams, OLD_ROLES, label, roleIds, storeRoles, applyTeam };
