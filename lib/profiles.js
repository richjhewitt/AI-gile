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
// over = this project's own owner numbers (p.profiles.owner, AIG-421).
function ownerLines(prefs, owner, over) {
  const sc = { ...ownerScales(prefs || {}), ...(over || {}) }, o = [], say = k => sc[k] !== SCALES[k].ways && SCALES[k].line[sc[k]];
  if (say('go')) o.push(`${owner}'s rule: ${SCALES.go.line[sc.go]}`);
  if (say('steps')) o.push(`${owner}'s rule: when ${owner} does something by hand (server commands, setup, a fix on their machine), give ${SCALES.steps.line[sc.steps]}. This overrides the one-step rule in your ways of working; test steps on cards stay a short list.`);
  if (say('words')) o.push(`${owner}'s rule: when you write to ${owner}, ${SCALES.words.line[sc.words]} This overrides your ways of working.`);
  // AIG-428: how much detail the owner needs in server and setup steps.
  const TECH = { beginner: 'click-by-click, name every button and say what they should see', some: 'plain steps with the key command or setting named, and what to expect', expert: 'terse: just the value or command (for example "A record: mail -> 92.113.144.194"), no click-by-click' };
  if (TECH[(prefs || {}).techLevel]) o.push(`${owner}'s tech level: write devops, server and setup steps ${TECH[prefs.techLevel]}.`);
  // AIG-694: the owner's style, how polite and playful the team is. 3 (or missing) says nothing.
  const TONE = { 1: 'playful. Warm, silly and polite in replies and questions; a light joke is welcome.', 2: 'friendly. Polite and warm in replies and questions, with the odd light touch.', 4: 'brisk. Short and to the point in replies and questions, no small talk.', 5: 'no nonsense. Replies and questions as short as possible, no jokes or pleasantries.' };
  if (TONE[parseInt((prefs || {}).tone, 10)]) o.push(`${owner}'s style: ${TONE[parseInt(prefs.tone, 10)]}`);
  const hl = ['Opus', 'Sonnet', 'Haiku'].filter(m => prefs['helpers' + m] !== '' && prefs['helpers' + m] != null).map(m => m + ' ' + prefs['helpers' + m]);   // helpers per model (AIG-353)
  if (hl.length) o.push(`${owner}'s rule: use at most ${hl.join(', ')} helpers at once.`);
  return o;
}
// AIG-673: the owner's git push choice, one line in the brief and in every background run's prompt.
const pushLine = (mode, owner) => mode === 'auto' ? 'Pushing: push after each tested batch and log it with aigile log. Never force-push.' : `Pushing: ask ${owner} on the board first (aigile ask ... GO?), then push yourself after his yes. Never force-push.`;
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
  const tm = Object.hasOwn(teams(), teamId) && teams()[teamId]; if (!tm) return null;   // own keys only: "constructor" is no team
  const was = roleIds(roles), now = mode === 'replace' ? [] : was.slice(), replaced = [];
  for (const id of tm.roles) for (let i = now.length - 1; i >= 0; i--) if (now[i] !== id && groupOf(now[i]) === groupOf(id) && now[i] !== OLD_ROLES[OLD[0]]) replaced.push(...now.splice(i, 1));
  const ids = roleIds([...now, ...tm.roles]);
  return { roles: storeRoles(ids), added: ids.filter(id => !was.includes(id)), replaced: mode === 'replace' ? was.filter(id => !ids.includes(id)) : replaced };
}

// Your own edited copies (AIG-421): profiles.local/roles/<id>.md beside aigile.local.json, git-ignored, never in the zip.
// A copy lists only what differs from the template; Reset to template deletes it.
const localDir = () => path.join(process.env.AIGILE_LOCAL ? path.dirname(path.resolve(process.env.AIGILE_LOCAL)) : path.join(__dirname, '..'), 'profiles.local');
const ownFile = id => path.join(localDir(), 'roles', id + '.md');
const ownCopy = id => { try { return parse(fs.readFileSync(ownFile(id), 'utf8'), 'profiles.local/roles/' + id); } catch { return null; } };
const resetOwn = id => { try { fs.unlinkSync(ownFile(id)); } catch {} };
// The numbers each layer may set: the owner's on one project are the owner scales with a brief line (steps, go, words);
// a role's are alone, tests, steps and words. go is the owner's only, so no profile can build without the owner's go.
const OWNER_KEYS = Object.keys(SCALES).filter(k => SCALES[k].who === 'owner' && SCALES[k].line);
const ROLE_KEYS = Object.keys(SCALES).filter(k => SCALES[k].line && k !== 'go');
// { scale: n | null } for a layer (null clears that number): an error text, or ''.
function badScales(sc, keys) {
  if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return 'scales must be an object of scale: step';
  for (const [k, v] of Object.entries(sc)) {
    if (!keys.includes(k)) return `${k} can't be set here (${keys.join(', ')})`;
    if (v !== null && inRange(k, v) === null) return `${k} must be a whole number from 1 to ${SCALES[k].max}`;
  }
  return '';
}
const withScales = (base, sc) => { const o = { ...base }; for (const [k, v] of Object.entries(sc || {})) { if (v === null) delete o[k]; else o[k] = Number(v); } return o; };
// Saves your copy from { scales, how, model }: only what differs from the template is kept. Nothing left = no copy.
function saveOwn(id, b) {
  const t = template(id), cur = ownCopy(id) || { scales: {}, how: [] };
  const scales = Object.fromEntries(Object.entries(withScales(cur.scales, b.scales)).filter(([k, v]) => t.scales[k] !== v));
  const how = 'how' in b ? (b.how || []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6) : cur.how;
  const model = 'model' in b ? b.model : cur.model;
  const copy = { id, ...(model && model !== t.model ? { model } : {}), scales, how: how.join('\n') === t.how.join('\n') ? [] : how };
  if (!Object.keys(scales).length && !copy.how.length && !copy.model) { resetOwn(id); return null; }
  fs.mkdirSync(path.dirname(ownFile(id)), { recursive: true });
  fs.writeFileSync(ownFile(id), format(copy));
  return copy;
}
// A role named loosely: its id, an old name ("Frontend (Sonnet)") or a role name ("frontend"); one on the project first.
const PICK = ['mid', 'senior', 'principal', 'junior'];
function findRole(q, roles) {
  const l = String(q || '').trim().toLowerCase(), all = Object.keys(templates());
  const exact = all.find(id => id === l) || OLD_ROLES[Object.keys(OLD_ROLES).find(r => r.toLowerCase() === l)];
  if (exact) return exact;
  const like = id => { const t = template(id); return groupOf(id) === l || t.name.toLowerCase() === l || t.name.toLowerCase().split(/\s*\/\s*/).includes(l); };
  const byLevel = ids => ids.filter(like).sort((a, b) => PICK.indexOf(template(a).level) - PICK.indexOf(template(b).level))[0];
  return byLevel(roleIds(roles)) || byLevel(all) || null;
}
// A role's profile on one project (AIG-421): template < your copy < this project's numbers, as lines for the top of a
// helper's prompt. The owner's steps and words (this project's, else Setup's) unless the role sets its own; go never.
const STEP1 = 'one step at a time; say what they should see and wait for "done"';
// draft (the 👥 profile editor's brief preview, AIG-423): { scales, how, model } not saved yet, laid on top.
function profileOf(id, prefs, p, owner, draft) {
  const t = template(id); if (!t) return null;
  const pp = (p && p.profiles) || {}, mine = ownCopy(id), shared = merge(t, mine), m = merge(shared, { scales: pp[id] || {} });
  if (draft) { m.scales = withScales(m.scales, draft.scales); if (Array.isArray(draft.how)) m.how = draft.how.map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6); if (draft.model) m.model = draft.model; }
  delete m.scales.go;
  const own = { ...ownerScales(prefs || {}), ...(pp.owner || {}) }, lines = [`Your role: ${m.name} (${m.level}, ${Model(m.model)}) on ${p ? p.name : 'any project'}.`];
  lines.push(...roleLines({ scales: m.scales, how: [] }));
  const sw = k => { const n = m.scales[k] || own[k]; return (k in m.scales || n !== SCALES[k].ways) && (SCALES[k].line[n] || (k === 'steps' && n === 1 && STEP1)); };
  if (sw('words')) lines.push(`When you write for ${owner} (test steps, task cards, comments): ${sw('words')}`);
  if (sw('steps')) lines.push(`When ${owner} does something by hand, give ${sw('steps')}.`);
  lines.push(...roleLines({ scales: {}, how: m.how }));
  // shared = the numbers for all projects (template < your copy), so the editor can tell them from this project's own.
  return { id, name: m.name, level: m.level, model: m.model, label: label(id), scales: m.scales, how: m.how, mine: !!mine, project: pp[id] || {}, shared: { scales: shared.scales, how: shared.how, model: shared.model }, template: { model: t.model, how: t.how }, lines };
}

// Helper fan-out cap (AIG-522 #3): how many helpers one run may have, by the spend/pace scale step (docs/TOKENS.md).
const HELPER_CAP = { fly: 2, careful: 3, normal: 4, generous: 5, nospare: 6 };
const helperCap = plan => HELPER_CAP[plan] || 4;
const helperLine = plan => `Helpers: at most ${helperCap(plan)} per run, and give each a short brief that names the exact files or line ranges to touch (never "look around"). Do bulk work such as translations as a script-driven diff, not one helper per item.`;

module.exports = { pushLine, HELPER_CAP, helperCap, helperLine, SCALES, LABELS, LEVELS, inRange, parse, format, merge, ownerScales, ownerLines, rolesLine, roleLines, groupOf, templates, template, teams, OLD_ROLES, label, roleIds, storeRoles, applyTeam,
  OWNER_KEYS, ROLE_KEYS, badScales, withScales, ownCopy, saveOwn, resetOwn, findRole, profileOf };
