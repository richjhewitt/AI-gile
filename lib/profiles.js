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
function parse(text, from = 'profile') {
  const lines = String(text || '').replace(/\r/g, '').split('\n'), out = { scales: {}, how: [] };
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
      const m = /^([\w-]+):\s*(.*)$/.exec(lines[i].trim()); if (!m) continue;
      const [, k, v] = m;
      if (LABELS.includes(k)) out[k] = v.trim();
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

module.exports = { SCALES, LABELS, inRange, parse, format, merge, ownerScales, ownerLines, rolesLine, roleLines };
