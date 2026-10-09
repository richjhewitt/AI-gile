// AI-gile: tiny local board for Rich + the AI dev teams.
// Zero dependencies. Data lives in data/<slug>.json (one file per project).
// Run: node server.js   ->   http://localhost:4321
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.AIGILE_PORT) || 4321;
const HOST = '127.0.0.1';
const DATA = path.resolve(process.env.AIGILE_DATA || path.join(__dirname, 'data'));
const PUBLIC = path.join(__dirname, 'public');

// 'team'   = Rich commented: the team reads it, then moves it to done.
// 'verify' = built and reviewed by the team, waiting for Rich to test and accept (his inbox).
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
const TYPES = ['feature', 'bug', 'task'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const CARD_FIELDS = ['title', 'description', 'testSteps', 'type', 'priority', 'status', 'assignee', 'sprint', 'blocked', 'needsYou'];

fs.mkdirSync(DATA, { recursive: true });

// Development flag: open pages show a "new version, refresh" prompt after each build.
// A build = a server restart or a change to the page, so the id is start time + page mtime.
const DEV = /^(1|true|yes)$/i.test(process.env.AIGILE_DEV || '');
const STARTED = Date.now();
const build = () => STARTED + '-' + fs.statSync(path.join(PUBLIC, 'index.html')).mtimeMs;

// ---- storage -------------------------------------------------------------
const now = () => new Date().toISOString();
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileOf = slug => path.join(DATA, slug + '.json');

function load(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try { return JSON.parse(fs.readFileSync(fileOf(slug), 'utf8')); } catch { return null; }
}
// Atomic write: temp file + rename. Node is single-threaded and we use sync IO,
// so concurrent API calls from several agents can't interleave a read-modify-write.
function save(p) {
  p.updated = now();
  const tmp = fileOf(p.slug) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  fs.renameSync(tmp, fileOf(p.slug));
}
function listSlugs() {
  return fs.readdirSync(DATA).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
}

// Rich's attention is needed if a team asked him something, or a feature is waiting for his test.
const waitingOnRich = c => c.status === 'verify' || (c.needsYou && c.status !== 'done');

// What agents are working on right now: cards in progress, newest activity first.
const inFlight = p => p.cards.filter(c => c.status === 'doing')
  .map(c => ({ id: c.id, title: c.title, assignee: c.assignee, updated: c.updated }))
  .sort((a, b) => b.updated.localeCompare(a.updated));

function summary(p) {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const c of p.cards) counts[c.status] = (counts[c.status] || 0) + 1;
  const active = p.cards.filter(c => c.status !== 'backlog');
  return {
    slug: p.slug, name: p.name, key: p.key, description: p.description, path: p.path,
    archived: !!p.archived, updated: p.updated, counts,
    total: p.cards.length,
    progress: active.length ? counts.done / active.length : 0,
    needsYou: p.cards.filter(waitingOnRich).length,
    toTest: counts.verify,
    blocked: p.cards.filter(c => c.blocked && c.status !== 'done').length,
    team: (p.team || []).filter(m => !/retired|idle/i.test(m.status || '')),
    inFlight: inFlight(p),
    lastLog: (p.log || []).slice(-1)[0] || null,
  };
}

// ---- validation ------------------------------------------------------------
function cleanCard(input, partial) {
  const out = {};
  for (const k of CARD_FIELDS) if (k in input) out[k] = input[k];
  if (!partial && !out.title) throw bad('title is required');
  if ('title' in out && !String(out.title).trim()) throw bad('title cannot be empty');
  if ('status' in out && !STATUSES.includes(out.status)) throw bad('status must be one of ' + STATUSES.join(', '));
  if ('type' in out && !TYPES.includes(out.type)) throw bad('type must be one of ' + TYPES.join(', '));
  if ('priority' in out && !PRIORITIES.includes(out.priority)) throw bad('priority must be one of ' + PRIORITIES.join(', '));
  for (const k of ['blocked', 'needsYou']) if (k in out) out[k] = !!out[k];
  return out;
}
const isRich = a => String(a).trim().toLowerCase() === 'rich';
function toTeam(c) {
  if (c.status === 'team') return;
  c.prevStatus = c.status;
  c.status = 'team';
}
function docList(p) {
  const out = [];
  if (p.path) for (const sub of ['', 'docs']) {
    let names;
    try { names = fs.readdirSync(path.join(p.path, sub)); } catch { continue; }
    for (const n of names.sort()) if (/\.md$/i.test(n)) out.push(sub ? sub + '/' + n : n);
  }
  return out;
}
function bad(msg, code = 400) { const e = new Error(msg); e.code = code; return e; }
function need(p) { if (!p) throw bad('project not found', 404); return p; }
function findCard(p, id) {
  const c = p.cards.find(c => c.id.toLowerCase() === String(id).toLowerCase());
  if (!c) throw bad('card not found', 404);
  return c;
}

// ---- routes ----------------------------------------------------------------
// Each handler: (params, body, query) -> response JSON. Throw bad() for errors.
const routes = [
  ['GET', /^\/api\/meta$/, () => ({ statuses: STATUSES, types: TYPES, priorities: PRIORITIES, dev: DEV, build: build() })],

  ['GET', /^\/api\/projects$/, (_, __, q) =>
    listSlugs().map(load).filter(Boolean).filter(p => q.get('all') || !p.archived).map(summary)
      .sort((a, b) => a.name.localeCompare(b.name))],

  ['POST', /^\/api\/projects$/, (_, b) => {
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    const slug = slugify(b.slug || name);
    if (!slug) throw bad('name needs some letters or numbers');
    if (load(slug)) throw bad('project "' + slug + '" already exists', 409);
    const p = {
      slug, name,
      key: String(b.key || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).toUpperCase() || 'P',
      description: b.description || '', path: b.path || '',
      created: now(), updated: now(), nextId: 1, archived: false,
      cards: [], team: [], log: [],
    };
    save(p);
    return summary(p);
  }],

  ['GET', /^\/api\/projects\/([^/]+)$/, ([slug]) => need(load(slug))],

  ['PATCH', /^\/api\/projects\/([^/]+)$/, ([slug], b) => {
    const p = need(load(slug));
    for (const k of ['name', 'description', 'path', 'archived', 'key']) if (k in b) p[k] = b[k];
    save(p);
    return summary(p);
  }],

  // Cards
  ['POST', /^\/api\/projects\/([^/]+)\/cards$/, ([slug], b) => {
    const p = need(load(slug));
    const c = {
      id: p.key + '-' + p.nextId++,
      title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'backlog',
      assignee: '', sprint: '', blocked: false, needsYou: false,
      ...cleanCard(b, false),
      createdBy: String(b.createdBy || ''),
      created: now(), updated: now(), comments: [],
    };
    p.cards.push(c);
    save(p);
    return c;
  }],

  ['PATCH', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    Object.assign(c, cleanCard(b, true), { updated: now() });
    save(p);
    return c;
  }],

  ['DELETE', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    p.cards = p.cards.filter(x => x !== c);
    save(p);
    return { deleted: c.id };
  }],

  // Comments: the conversation channel between Rich and a team.
  // { author, text, needsYou?: true }  -> "ask Rich"  /  Rich replying clears needsYou unless told otherwise.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/comments$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim();
    if (!text) throw bad('text is required');
    const author = String(b.author || 'Rich').trim();
    c.comments.push({ author, text, at: now() });
    if ('needsYou' in b) c.needsYou = !!b.needsYou;
    else if (isRich(author)) c.needsYou = false;
    // Rich replying hands the card to the team.
    if (isRich(author)) toTeam(c);
    c.updated = now();
    save(p);
    return c;
  }],

  // Rich's verdict on a card in 'verify': { accept: true } -> done, { accept: false, text } -> back to doing.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/verdict$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim();
    if (!b.accept && !text) throw bad('say what is wrong when sending a card back');
    if (b.accept) c.status = 'done'; else toTeam(c);
    c.needsYou = false;
    c.comments.push({ author: 'Rich', text: (b.accept ? '✅ Accepted' : '🔁 Sent back') + (text ? ': ' + text : ''), at: now(), verdict: b.accept ? 'accept' : 'sendback' });
    c.updated = now();
    save(p);
    return c;
  }],

  // Rich's poke: a one-line nudge on work that seems stuck. Wakes the team (it's a Rich comment)
  // but, unlike a reply, leaves the card where it is.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/poke$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    c.comments.push({ author: 'Rich', text: '👉 Poke: any update? (one line is enough)', at: now(), poke: true });
    c.updated = now();
    save(p);
    return c;
  }],

  // Team roster: upsert by name. { name, model?, role?, task?, status? }
  ['POST', /^\/api\/projects\/([^/]+)\/team$/, ([slug], b) => {
    const p = need(load(slug));
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    p.team = p.team || [];
    let m = p.team.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!m) { m = { name }; p.team.push(m); }
    for (const k of ['model', 'role', 'task', 'status']) if (k in b) m[k] = b[k];
    m.updated = now();
    save(p);
    return m;
  }],

  // Project log: { author, text, kind?: 'log' | 'decision' }
  ['POST', /^\/api\/projects\/([^/]+)\/log$/, ([slug], b) => {
    const p = need(load(slug));
    const text = String(b.text || '').trim();
    if (!text) throw bad('text is required');
    const entry = { at: now(), author: String(b.author || 'Rich'), kind: b.kind === 'decision' ? 'decision' : 'log', text };
    (p.log = p.log || []).push(entry);
    save(p);
    return entry;
  }],

  // What Rich did since the team last looked: his comments, verdicts and new cards.
  // ?mark=1 moves the team's "seen" cursor to now (the UI shows "seen by team" from it).
  ['GET', /^\/api\/projects\/([^/]+)\/updates$/, ([slug], _, q) => {
    const p = need(load(slug));
    const since = q.get('since') || p.teamSeenAt || '';
    const cards = [];
    for (const c of p.cards) {
      // A bare "Accepted" click needs no action, so it doesn't wake the team.
      const items = c.comments.filter(m => isRich(m.author) && m.at > since && !(m.verdict === 'accept' && m.text === '✅ Accepted')).map(m => ({ kind: m.poke ? 'poke' : 'comment', text: m.text, at: m.at }));
      if (isRich(c.createdBy) && c.created > since) items.unshift({ kind: 'new card', text: c.description || '', at: c.created });
      if (items.length) cards.push({ id: c.id, title: c.title, status: c.status, prevStatus: c.prevStatus || '', type: c.type, priority: c.priority, items });
    }
    const forTeam = p.cards.filter(c => c.status === 'team').map(c => ({ id: c.id, title: c.title, prevStatus: c.prevStatus || '' }));
    if (q.get('mark')) { p.teamSeenAt = now(); save(p); }
    return { project: p.slug, since, cards, forTeam };
  }],

  // Project docs: the .md files in the project's folder and its docs/ folder (read-only).
  ['GET', /^\/api\/projects\/([^/]+)\/docs$/, ([slug]) => docList(need(load(slug)))],
  ['GET', /^\/api\/projects\/([^/]+)\/docs\/(.+)$/, ([slug, name]) => {
    const p = need(load(slug));
    if (!docList(p).includes(name)) throw bad('doc not found', 404); // whitelist: no path tricks
    return { name, text: fs.readFileSync(path.join(p.path, name), 'utf8') };
  }],

  // Everything waiting on Rich, across all projects.
  ['GET', /^\/api\/inbox$/, () =>
    listSlugs().map(load).filter(p => p && !p.archived).flatMap(p =>
      p.cards.filter(waitingOnRich)
        .map(c => ({ project: p.slug, projectName: p.name, ...c })))
      .sort((a, b) => b.updated.localeCompare(a.updated))],
];

// ---- http plumbing -----------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!s) return resolve({});
      try { resolve(JSON.parse(s)); } catch { reject(bad('body must be JSON')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) {
      for (const [method, re, fn] of routes) {
        const m = pathname.match(re);
        if (m && method === req.method) {
          const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
          return send(res, 200, fn(m.slice(1), body, url.searchParams));
        }
      }
      throw bad('no such endpoint: ' + req.method + ' ' + pathname, 404);
    }
    // Static files from public/ (single-page app: unknown paths get index.html)
    let file = path.normalize(path.join(PUBLIC, pathname));
    if (!file.startsWith(PUBLIC)) throw bad('nope', 403);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => console.log(`AI-gile running at http://localhost:${PORT}`));
