#!/usr/bin/env node
// aigile: CLI for AI dev teams to use the AI-gile board. Zero dependencies, Node 18+.
// Usage: node "<path>/aigile.js" help
const BASE = (process.env.AIGILE_URL || 'http://localhost:4321').replace(/\/$/, '');
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
const PRIO = { urgent: 0, high: 1, normal: 2, low: 3 };
const BOOL = new Set(['decision', 'needs-you', 'all', 'json', 'full', 'hook', 'stop-hook', 'peek', 'create']);

// Your queue (AIG-159..162): --holds AIG-1,AIG-2  --prio now|today|whenever  --kind decide|test|server|keys|read  --mins N
async function queueInfo(slug, id, flags) {
  const b = {};
  if (flags.holds) b.holds = flags.holds; if (flags.prio) b.ownerPrio = flags.prio; if (flags.kind) b.kind = flags.kind; if (flags.mins) b.mins = flags.mins;
  if (Object.keys(b).length) await api('PATCH', C(slug, id), b);
}

// The board's human (AIG-103): "owner" in aigile.local.json next to this file, default Rich.
const OWNER = process.env.AIGILE_OWNER || (() => { try { return String(JSON.parse(require('fs').readFileSync(process.env.AIGILE_LOCAL || require('path').join(__dirname, 'aigile.local.json'), 'utf8')).owner || '').trim() || 'Rich'; } catch { return 'Rich'; } })();

// Where this session runs, so the board can show it and knows a session is at work (AIG-107).
const WHERE = process.env.AIGILE_BACKGROUND ? 'background' : process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode' ? 'vscode' : 'terminal';

const HELP = `aigile: the AI-gile board CLI.  Project = slug, name or key (case-insensitive).
Set AIGILE_URL to change the server (default http://localhost:4321). Set AIGILE_AS=NAME to skip --as.
Text args can be "-" to read from stdin (handy for multi-line).

START OF SESSION
  brief <proj>                            the whole picture in one call: start every session with this
  updates <proj> [--peek]                 what ${OWNER} said/raised since you last looked (marks it seen)
  inbox                                   everything waiting on ${OWNER}, all projects
  next <proj>                             what to work on, in order (see AGENTS.md)
  list <proj> [--status s] [--mine NAME] [--all]   cards (done hidden unless --status done or --all)
  show <proj> <id>                        full card with the conversation
  projects                                all projects with counts

WORKING
  start <proj> <id> --as NAME             you (or an agent you launch) take a card: assign + doing + roster task
  move <proj> <id> <status>               status: ${STATUSES.join(' | ')}  ('done' only from 'team', after reading ${OWNER}'s comment)
  assign <proj> <id> NAME
  comment <proj> <id> "text" --as NAME
  ask <proj> <id> "question" --as NAME    comment + flags the card as needing ${OWNER}
  task <proj> <id> "what to do" --as NAME something only ${OWNER} can do (key, login, manual step): goes to their inbox
  test <proj> <id> "steps ${OWNER} can follow" --as NAME    -> moves to verify, sets testSteps, comments
        [--open URL [--start "command"]]   adds a ▶ Open it button: starts the app if needed, opens the page
        [--commit SHA] [--shot a.png,b.png]  proof: the board shows what changed in that commit, plus your screenshots
  ask / task / test also take: --holds AIG-1,AIG-2 (what it holds up)  --prio now|today|whenever  --kind decide|test|server|keys|read  --mins N
  block <proj> <id> ["why"] --as NAME     unblock <proj> <id>
  edit <proj> <id> [--title --desc --type --priority --sprint --assignee --test-steps]
  add <proj> "title" [--type feature|bug|task --priority low|normal|high|urgent --status s
                      --desc D --sprint S --assignee NAME --needs-you --test-steps T]

HOOKS (agent session hooks, see AGENTS.md)
  updates <proj> --hook                   SessionStart / UserPromptSubmit: prints news, silent if none
  dm <proj> "text" --as NAME             chatty leads only: start a DM to ${OWNER} (a nudge or a light word; one at a time)
  wait <proj> [--every SECONDS]           run in the BACKGROUND while idle: exits with ${OWNER}'s news when they comment
  updates <proj> --stop-hook              Stop: blocks stopping once while there is unseen news

TEAM AND LOG
  team <proj> NAME [--role R --model M --task T --status S]    upsert roster entry
  log <proj> "text" [--decision] --as NAME
  standup <proj> --done "..." --next "..." [--blockers "... | none"] --as NAME    answer a 📣 Stand-up card (AGENTS.md)

PROJECTS
  new-project <name> [--key K --path P --desc D]
  onboard <proj> <folder> [--create]      set a folder up for the board: notes + ways of working + comment hooks

Global: --json prints raw JSON instead of the compact text.`;

/* ---------- args ---------- */
function parse(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && a.length > 2) {
      let [k, v] = a.slice(2).split(/=(.*)/s);
      if (v === undefined) {
        if (BOOL.has(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) v = true; else v = argv[++i];
      }
      flags[k] = v;
    } else pos.push(a);
  }
  return { pos, flags };
}
class CliError extends Error {}
const die = m => { throw new CliError(m); };

async function text(v, what) {
  if (v === undefined || v === true || v === '') die(what + ' is required (see: aigile help)');
  if (v === '-') { let s = ''; for await (const c of process.stdin) s += c; v = s.replace(/\s+$/, ''); }
  return v;
}

/* ---------- http ---------- */
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': WHERE }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    die(`AI-gile isn't running: start it with node server.js in ${__dirname}  (tried ${BASE})`);
  }
  let data; const raw = await res.text();
  try { data = JSON.parse(raw); } catch { data = { error: raw.slice(0, 200) }; }
  if (!res.ok) die(data.error || ('HTTP ' + res.status));
  return data;
}

async function project(ref) {
  if (!ref) die('project is required (slug, name or key)');
  const all = await api('GET', '/api/projects?all=1');
  const r = ref.toLowerCase();
  const p = all.find(p => p.slug === r) || all.find(p => p.name.toLowerCase() === r) || all.find(p => p.key.toLowerCase() === r);
  if (!p) die(`unknown project "${ref}". Known: ${all.map(p => p.slug + ' (' + p.key + ')').join(', ') || 'none'}`);
  return p.slug;
}
const P = slug => '/api/projects/' + slug;
const C = (slug, id) => P(slug) + '/cards/' + encodeURIComponent(id);
function who(flags) {
  const a = flags.as || process.env.AIGILE_AS;
  if (!a || a === true) die('--as NAME is required (or set AIGILE_AS)');
  return String(a);
}

/* ---------- formatting ---------- */
const flagsOf = c => (c.blocked ? ' BLOCKED' : '') + (c.needsYou ? ' NEEDS-RICH' : '');
const line = c => `${c.id} [${c.status}] ${c.type}/${c.priority}${c.assignee ? ' @' + c.assignee : ''}${c.sprint ? ' (' + c.sprint + ')' : ''}${flagsOf(c)}  ${c.title}`;
const when = s => (s || '').replace('T', ' ').slice(0, 16);
// Attached files (AIG-77), one per line with the full path so the agent can open them.
const files = (m, pad) => (m.attachments || []).map(a => `\n${pad}📎 ${a.name}: ${a.path}`).join('');
function full(c) {
  const o = [line(c)];
  if (c.description) o.push('', 'Description:', c.description);
  if (c.attachments) o.push(...c.attachments.map(a => `📎 ${a.name}: ${a.path}`));
  if (c.testSteps) o.push('', 'Test steps:', c.testSteps);
  o.push('', `Conversation (${c.comments.length}):`);
  for (const m of c.comments) o.push(`  [${when(m.at)}] ${m.author}: ${m.text.replace(/\n/g, '\n    ')}` + files(m, '    '));
  if (!c.comments.length) o.push('  (none)');
  return o.join('\n');
}
const out = (flags, data, fmt) => console.log(flags.json ? JSON.stringify(data, null, 2) : fmt(data));

/* ---------- next ---------- */
const lastComment = c => c.comments[c.comments.length - 1];
const forRich = c => String(c.assignee || '').trim().toLowerCase() === OWNER.toLowerCase(); // a task only the owner can do
const byPrio = (a, b) => (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2) || a.created.localeCompare(b.created);
function nextList(p) {
  const live = p.cards.filter(c => !c.blocked && !c.needsYou && !forRich(c));
  const fromRich = c => { const m = lastComment(c); return c.status === 'team' || (m && m.author.toLowerCase() === OWNER.toLowerCase() && !['done', 'verify', 'backlog'].includes(c.status)); };
  const tiers = [];
  const sentBack = live.filter(fromRich).sort(byPrio);
  tiers.push([`1. For the team: ${OWNER} commented (do first: just info -> move to done; needs work -> doing, fix, then test for their approval)`, sentBack]);
  const seen = new Set(sentBack.map(c => c.id));
  const doing = live.filter(c => c.status === 'doing' && !seen.has(c.id)).sort(byPrio);
  tiers.push(['2. Already in progress', doing]);
  doing.forEach(c => seen.add(c.id));
  const todo = live.filter(c => c.status === 'todo' && !seen.has(c.id));
  const urgent = todo.filter(c => c.type === 'bug' || c.priority === 'urgent' || c.priority === 'high').sort((a, b) => ((b.type === 'bug') - (a.type === 'bug')) || byPrio(a, b));
  tiers.push(['3. Bugs and urgent/high in todo', urgent]);
  urgent.forEach(c => seen.add(c.id));
  tiers.push(['4. Rest of todo, by priority', todo.filter(c => !seen.has(c.id)).sort(byPrio)]);
  return tiers;
}

/* ---------- commands ---------- */
const cmds = {
  async help() { console.log(HELP); },

  async projects({ flags }) {
    const ps = await api('GET', '/api/projects');
    out(flags, ps, ps => ps.map(p => `${p.slug} (${p.key}) ${p.name}: ` + STATUSES.map(s => s + ' ' + p.counts[s]).join(', ') + ` | needs ${OWNER} ${p.needsYou}, blocked ${p.blocked}`).join('\n') || '(no projects)');
  },

  async 'new-project'({ pos, flags }) {
    const name = pos[0]; if (!name) die('name is required');
    const p = await api('POST', '/api/projects', { name, key: flags.key, path: flags.path, description: flags.desc });
    out(flags, p, p => `created ${p.slug} (key ${p.key})`);
  },

  async onboard({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('folder path is required');
    const r = await api('POST', P(slug) + '/connect', { path: pos[1], create: !!flags.create });
    out(flags, r, r => `connected ${slug} -> ${r.path}\n` + r.done.map(d => '  - ' + d).join('\n') + '\nNext: start a new session in that folder.');
  },

  async list({ pos, flags }) {
    const slug = await project(pos[0]);
    if (flags.status && !STATUSES.includes(flags.status)) die('status must be one of ' + STATUSES.join(', '));
    const p = await api('GET', P(slug));
    let cs = p.cards;
    if (flags.status) cs = cs.filter(c => c.status === flags.status);
    else if (!flags.all) cs = cs.filter(c => c.status !== 'done');
    if (flags.mine && flags.mine !== true) cs = cs.filter(c => (c.assignee || '').toLowerCase() === String(flags.mine).toLowerCase());
    cs.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || byPrio(a, b));
    out(flags, cs, cs => cs.map(line).join('\n') || '(no cards)');
  },

  async show({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('card id is required');
    const p = await api('GET', P(slug));
    const c = p.cards.find(c => c.id.toLowerCase() === pos[1].toLowerCase());
    if (!c) die(`card ${pos[1]} not found in ${slug}`);
    out(flags, c, full);
  },

  // One compact digest replacing a read of BOARD.local.md: in flight, for the team, waiting on Rich,
  // next up, active team, recent decisions and log. Kept short on purpose (token cost).
  async brief({ pos, flags }) {
    const slug = await project(pos[0]);
    const p = await api('GET', P(slug));
    if (flags.json) return console.log(JSON.stringify(p, null, 2));
    const by = s => p.cards.filter(c => c.status === s);
    const short = c => `${c.id}${c.assignee ? ' @' + c.assignee : ''} ${c.title}`;
    const sect = (title, items, n = 8) => items.length ? [title + ':', ...items.slice(0, n).map(x => '  ' + x), ...(items.length > n ? [`  (+${items.length - n} more)`] : [])] : [];
    const o = [`${p.name} (${p.slug}): ` + STATUSES.map(s => `${s} ${by(s).length}`).join(' · ')];
    o.push(...sect(`For the team (${OWNER} commented: do first)`, by('team').map(c => short(c) + (lastComment(c) ? `  <- "${lastComment(c).text.slice(0, 100).replace(/\n/g, ' ')}"` : ''))));
    o.push(...sect('In flight', by('doing').map(c => short(c) + ` (${when(c.updated)})`)));
    o.push(...sect('In review', by('review').map(short)));
    o.push(...sect(`Waiting on ${OWNER}`, p.cards.filter(c => c.status !== 'done' && (c.status === 'verify' || c.needsYou || forRich(c))).map(c => short(c) + (forRich(c) ? ' (task for them)' : c.status === 'verify' ? ' (testing)' : ' (question)'))));
    o.push(...sect('Blocked', p.cards.filter(c => c.blocked && c.status !== 'done').map(short)));
    const nxt = nextList(p).flatMap(([, cs]) => cs).filter(c => c.status === 'todo');
    o.push(...sect('Next up (todo)', nxt.map(short), 5));
    const team = (p.team || []).filter(m => !/retired/i.test(m.status || ''));
    if (team.length) o.push('Team: ' + team.map(m => `${m.name}${m.model ? ' (' + m.model + ')' : ''} ${m.status || ''}${m.task && !/idle/i.test(m.status || '') ? ': ' + m.task : ''}`).join(' | '));
    const log = (p.log || []);
    o.push(...sect('Recent decisions', log.filter(l => l.kind === 'decision').slice(-5).reverse().map(l => `${when(l.at).slice(5)} ${l.author}: ${l.text}`)));
    o.push(...sect('Recent log', log.filter(l => l.kind !== 'decision').slice(-5).reverse().map(l => `${when(l.at).slice(5)} ${l.author}: ${l.text}`)));
    o.push(`More: aigile show ${slug} <id> | aigile list ${slug} --status backlog`);
    console.log(o.join('\n'));
  },

  async next({ pos, flags }) {
    const slug = await project(pos[0]);
    const p = await api('GET', P(slug));
    const tiers = nextList(p);
    if (flags.json) return console.log(JSON.stringify(Object.fromEntries(tiers.map(([k, v]) => [k, v])), null, 2));
    const o = []; let first = true;
    for (const [title, cs] of tiers) {
      if (!cs.length) continue;
      o.push(title);
      for (const c of cs) { o.push((first ? '  >> ' : '     ') + line(c)); first = false; }
    }
    const waiting = p.cards.filter(c => (c.blocked || c.needsYou || forRich(c) || c.status === 'verify') && c.status !== 'done');
    if (waiting.length) { o.push('Waiting (not yours to pick up)'); waiting.forEach(c => o.push('     ' + line(c) + (c.status === 'verify' ? `  (${OWNER} testing)` : ''))); }
    if (first) o.unshift('Nothing ready. Check backlog (aigile list ' + slug + ' --status backlog) or ask ' + OWNER + '.');
    else o.push('', `Start: aigile move ${slug} <id> doing   |   details: aigile show ${slug} <id>`);
    console.log(o.join('\n'));
  },

  async add({ pos, flags }) {
    const slug = await project(pos[0]);
    const title = await text(pos[1], 'title');
    const b = { title };
    for (const [f, k] of [['type', 'type'], ['priority', 'priority'], ['status', 'status'], ['desc', 'description'], ['sprint', 'sprint'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = flags[f] === true ? '' : (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (flags['needs-you']) b.needsYou = true;
    const c = await api('POST', P(slug) + '/cards', b);
    out(flags, c, c => 'added ' + line(c));
  },

  async edit({ pos, flags }) {
    const slug = await project(pos[0]);
    const b = {};
    for (const [f, k] of [['title', 'title'], ['type', 'type'], ['priority', 'priority'], ['desc', 'description'], ['sprint', 'sprint'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (!Object.keys(b).length) die('nothing to change; give at least one of --title --desc --type --priority --sprint --assignee --test-steps');
    const c = await api('PATCH', C(slug, pos[1]), b);
    out(flags, c, c => 'updated ' + line(c));
  },

  async move({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!STATUSES.includes(pos[2])) die('status must be one of ' + STATUSES.join(', '));
    if (pos[2] === 'done' && !process.env.AIGILE_ALLOW_DONE) {
      // Teams may close a card once they've read Rich's comment on it ('For the team'); otherwise Rich accepts.
      const card = (await api('GET', P(slug))).cards.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase());
      if (card && card.status !== 'team') die(`only ${OWNER} moves cards to done (they accept them in 'verify'). Use: aigile test ...  (cards in 'team' you may move to done once you've read ${OWNER}'s comment)`);
    }
    const c = await api('PATCH', C(slug, pos[1]), { status: pos[2] });
    out(flags, c, c => 'moved ' + line(c));
  },

  async start({ pos, flags }) {
    const slug = await project(pos[0]);
    const name = who(flags);
    const c = await api('PATCH', C(slug, pos[1]), { status: 'doing', assignee: name });
    await api('POST', P(slug) + '/team', { name, task: c.id + ' ' + c.title, status: '🔄 working' });
    out(flags, c, c => 'started ' + line(c));
  },

  async assign({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('PATCH', C(slug, pos[1]), { assignee: pos[2] === undefined ? die('NAME is required (use "" to unassign)') : pos[2] });
    out(flags, c, c => 'assigned ' + line(c));
  },

  async comment({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: await text(pos[2], 'comment text') });
    out(flags, c, c => `commented on ${c.id} (${c.comments.length} comments)`);
  },

  async dm({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('POST', `/api/projects/${slug}/dm`, { author: who(flags), text: await text(pos[1], 'message') });
    out(flags, c, c => `sent to ${OWNER}'s chat (${c.id})`);
  },

  async ask({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: await text(pos[2], 'question'), needsYou: true });
    out(flags, c, c => `asked ${OWNER} on ${c.id}; card now flagged NEEDS-RICH. Move on to other work (aigile next ${slug}).`);
  },

  async test({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    const steps = await text(pos[2], 'test steps');
    // --open URL [--start "command"]: the card gets a ▶ Open it button (AIG-146).
    await api('PATCH', C(slug, pos[1]), { status: 'verify', testSteps: steps, needsYou: false, ...(flags.open ? { openUrl: flags.open, startCmd: flags.start || '' } : {}) });
    // Proof on hand-back (AIG-166): --commit <sha> lets the board attach what changed; --shot a.png,b.png adds screenshots.
    if (flags.commit) await api('POST', C(slug, pos[1]) + '/proof', { commit: flags.commit });
    const attachments = [];
    for (const f of String(flags.shot || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const fs = require('fs'), ext = (f.match(/\.(\w+)$/) || [])[1] || '';
      if (!fs.existsSync(f)) die('screenshot not found: ' + f);
      const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext.toLowerCase()] || 'application/octet-stream';
      const a = await api('POST', `/api/projects/${slug}/attachments`, { name: require('path').basename(f), type, data: fs.readFileSync(f).toString('base64') });
      attachments.push({ id: a.id, type: a.type });
    }
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author, text: 'Ready for you to test. Steps are on the card.', needsYou: false, attachments });
    out(flags, c, c => `handed to ${OWNER}: ` + line(c));
  },

  // Something only Rich can do (a key, a login, a manual step): assigns the card to him with the instructions.
  // It shows in his inbox under "Tasks for you"; when he clicks Done it comes back to you via "For the team".
  async task({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    const what = await text(pos[2], `what ${OWNER} needs to do`);
    await api('PATCH', C(slug, pos[1]), { assignee: OWNER, needsYou: false });
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author, text: what, needsYou: false });
    out(flags, c, c => `task for ${OWNER} on ${c.id}: it's in their inbox. Carry on with other work (aigile next ${slug}).`);
  },

  async block({ pos, flags }) {
    const slug = await project(pos[0]);
    let c = await api('PATCH', C(slug, pos[1]), { blocked: true });
    if (pos[2]) c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: 'Blocked: ' + await text(pos[2], 'reason') });
    out(flags, c, c => 'blocked ' + line(c));
  },

  async unblock({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('PATCH', C(slug, pos[1]), { blocked: false });
    out(flags, c, c => 'unblocked ' + line(c));
  },

  async team({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('member NAME is required');
    const b = { name: pos[1] };
    for (const k of ['role', 'model', 'task', 'status']) if (flags[k] !== undefined) b[k] = flags[k] === true ? '' : flags[k];
    const m = await api('POST', P(slug) + '/team', b);
    out(flags, m, m => `team: ${m.name}${m.role ? ' | ' + m.role : ''}${m.model ? ' | ' + m.model : ''} | ${m.task || '-'} | ${m.status || '-'}`);
  },

  async log({ pos, flags }) {
    const slug = await project(pos[0]);
    const e = await api('POST', P(slug) + '/log', { author: who(flags), text: await text(pos[1], 'log text'), kind: flags.decision ? 'decision' : 'log' });
    out(flags, e, e => `logged ${e.kind}`);
  },

  // Stand-up answer (AIG-134): done / next / blockers go on the project's open 📣 Stand-up card; answering again replaces yours.
  async standup({ pos, flags }) {
    const slug = await project(pos[0]);
    const b = { author: who(flags), done: await text(flags.done, '--done'), next: await text(flags.next, '--next') };
    if (flags.blockers !== undefined) b.blockers = flags.blockers === true ? 'none' : await text(flags.blockers, '--blockers');
    const r = await api('POST', P(slug) + '/standup', b);
    out(flags, r, r => `stand-up answered on ${r.card}` + (r.waiting.length ? `. Still to answer: ${r.waiting.join(', ')}` : '. Everyone has answered: the lead can move the card to done.'));
  },

  async updates({ pos, flags }) {
    const hook = flags.hook || flags['stop-hook'];
    let u;
    try {
      const slug = await project(pos[0]);
      u = await api('GET', P(slug) + '/updates' + (flags.peek ? '' : '?mark=1'));
    } catch (e) { if (hook) return; throw e; } // hooks stay silent if the board is down
    if (flags.json) return console.log(JSON.stringify(u, null, 2));
    const o = [];
    for (const c of u.cards) {
      o.push(`${c.id} [${c.status}${c.prevStatus && c.status === 'team' ? ', was ' + c.prevStatus : ''}] ${c.type}/${c.priority}  ${c.title}`);
      for (const it of c.items) o.push(`   ${it.kind === 'new card' ? OWNER + ' raised it' : it.kind === 'poke' ? OWNER + ' POKED (reply with a one-line status comment, leave the card where it is)' : OWNER} (${when(it.at)}): ${it.text.replace(/\n/g, '\n     ') || (it.attachments ? '' : '(no description)')}` + files(it, '     '));
    }
    const waiting = u.forTeam.filter(f => !u.cards.some(c => c.id === f.id));
    if (waiting.length) o.push(`Still in "For the team" (seen before): ${waiting.map(f => f.id + ' ' + f.title).join('; ')}`);
    // Pokes alone get the smallest possible message: one "oi" line per card.
    const onlyPokes = u.cards.length && u.cards.every(c => c.items.every(i => i.kind === 'poke'));
    if (onlyPokes && !flags.json) {
      const msg = u.cards.map(c => `👉 ${OWNER} poked ${c.id}: reply one line (aigile comment ${u.project} ${c.id} "...").`).join('\n');
      if (flags['stop-hook']) console.log(JSON.stringify({ decision: 'block', reason: msg })); else console.log(msg);
      return;
    }
    const news = u.cards.length > 0;
    if (hook && !news) return; // hooks only speak when there's something new (saves tokens)
    if (!news && !waiting.length) return console.log(`Nothing new from ${OWNER}.`);
    const head = `📬 AI-gile board (${u.project}): ${news ? `new from ${OWNER} since you last looked` : 'cards waiting on your team'}.`;
    const tail = `Act on these now: read each with \`aigile show ${u.project} <id>\`, then: if it's just information, move it to done (\`aigile move ${u.project} <id> done\`); if it needs work (e.g. sent back), move it to doing, fix it and hand it back with \`aigile test\` for ${OWNER}'s approval. They are marked seen.`;
    const msg = [head, ...o, tail].join('\n');
    if (flags['stop-hook']) { if (news) console.log(JSON.stringify({ decision: 'block', reason: msg })); return; }
    console.log(msg);
  },

  // Idle sessions don't fire hooks. A lead runs this as a background command; it costs nothing while
  // waiting and exits (waking the session) with Rich's news as soon as there is any.
  async wait({ pos, flags }) {
    const slug = await project(pos[0]);
    const every = Math.max(5, Number(flags.every) || 15) * 1000;
    for (;;) {
      try {
        const u = await api('GET', P(slug) + '/updates');
        if (u.cards.length) return cmds.updates({ pos, flags: {} });
      } catch {} // board down: keep waiting
      await new Promise(r => setTimeout(r, every));
    }
  },

  async inbox({ flags }) {
    const cs = await api('GET', '/api/inbox');
    out(flags, cs, cs => cs.map(c => `${c.project}/${line(c)}` + (lastComment(c) ? `\n     last: ${lastComment(c).author}: ${lastComment(c).text.slice(0, 160).replace(/\n/g, ' ')}` : '')).join('\n') || `Nothing waiting on ${OWNER}.`);
  },
};

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(HELP);
  const fn = cmds[cmd];
  if (!fn) die(`unknown command "${cmd}". Try: aigile help`);
  await fn(parse(rest));
})().catch(e => { console.error('error: ' + (e instanceof CliError ? e.message : e.stack || e)); process.exitCode = 1; });
