// 🔐 Access review (AIG-1127, docs/SERVICE-MGMT-PLAN.md card 17): every 90 days ONE card in the AI-gile project's For you lists
// every live share link (project, who, role, created), every friend's change roles per project, and every kept secret by NAME
// (never the value), each with Keep / Remove. Remove ends that link / drops that role / deletes that secret through the existing
// code (share.unlink, changeroles.set, secrets.forget / keep(k, null)); the owner only. Keep just ticks it off. All decided = card done.
// State: data/accessreview.conf { last: 'YYYY-MM-DD' } (.conf: every .json in data/ is a project). A plain file data/accessreview.stub
// holding YYYY-MM-DD stands in for today (tests only). The first start only begins the count (no card); Setup > Run access review
// now (POST /api/accessreview/run) always makes one. An open review card is refreshed, never doubled.
// Project slug: "accessReview": { "project": "..." } in aigile.local.json (default ai-gile), AIGILE_ACCESS_PROJECT for tests.
const fs = require('fs');
const path = require('path');
const { DATA, load, save, now, localSettings, owner, bad, listSlugs } = require('./store');
const { t } = require('./i18n');

const EVERY_DAYS = 90, CHECK_MS = 60 * 60e3;
const FILE = () => path.join(DATA, 'accessreview.conf');
const STUB = () => path.join(DATA, 'accessreview.stub');
const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return j && typeof j === 'object' ? j : {}; } catch { return {}; } };
const write = j => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(j)); };
const pad = n => String(n).padStart(2, '0');
function today() {
  try { const s = fs.readFileSync(STUB(), 'utf8').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch {}
  const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);
const project = () => process.env.AIGILE_ACCESS_PROJECT || (localSettings().accessReview || {}).project || 'ai-gile';
const share = () => require('./share');
const S = () => require('./secrets');

// Everything that gives someone access, as the card's rows. Names only: no secret value is ever read here.
function collect() {
  const items = [];
  for (const L of share().list('')) {
    if (L.state !== 'live') continue;
    items.push({ kind: 'link', id: L.id, project: L.projectName || L.slug, who: L.friend, role: L.role || '', created: L.created });
  }
  const dm = (() => { try { return require('./dm').contacts(); } catch { return []; } })();
  for (const slug of listSlugs()) {
    const p = load(slug), cr = p && p.changeRoles; if (!cr) continue;
    const nameOf = id => (dm.find(c => '@' + c.id === id) || {}).name || id;
    for (const id of cr.pm || []) items.push({ kind: 'role', slug, project: p.name || slug, who: nameOf(id), contact: id, role: 'pm' });
    for (const r of ['testLead', 'devLead']) if (cr[r] && cr[r][0] === '@') items.push({ kind: 'role', slug, project: p.name || slug, who: nameOf(cr[r]), contact: cr[r], role: r });
  }
  const s = S();
  for (const x of s.list().items) if (x.stored) items.push({ kind: 'secret', slug: x.slug, project: x.slug, name: x.name });
  for (const k of s.keptKeys()) items.push({ kind: 'kept', key: k, name: k });
  items.forEach((x, i) => { x.n = i; });
  return items;
}
const line = x => x.kind === 'link' ? t('acc.line.link', { project: x.project, who: x.who, role: x.role, created: String(x.created || '').slice(0, 10) })
  : x.kind === 'role' ? t('acc.line.role', { project: x.project, who: x.who, role: t('chgrole.' + x.role) })
    : t('acc.line.secret', { name: x.name, project: x.project || '' });
const rowKey = x => x.kind + ':' + (x.id || x.key || x.slug + '/' + (x.contact || '') + '/' + x.role + '/' + (x.name || ''));

// The review card: create it, or refresh the open one (decisions already made on rows that still exist are kept).
function run() {
  const p = load(project());
  if (!p) throw bad('the project for the access review was not found: ' + project(), 404);
  const items = collect(), at = now();
  const open = p.cards.find(c => c.from === 'access review' && c.status !== 'done');
  if (open && open.accessReview) {
    const was = new Map(open.accessReview.items.map(x => [rowKey(x), x.decision]));
    items.forEach(x => { if (was.get(rowKey(x))) x.decision = was.get(rowKey(x)); });
  }
  let c = open;
  if (!c) {
    c = { id: p.key + '-' + p.nextId++, title: t('acc.title'), description: '', testSteps: '', type: 'task', priority: 'normal', status: 'todo', assignee: owner(), sprint: '', blocked: false, needsYou: true, createdBy: 'Access review',
      from: 'access review', created: at, updated: at, comments: [{ author: 'Access review', text: t('acc.body'), at, mark: 'task' }] };
    p.cards.push(c);
  }
  c.description = items.length ? items.map(line).join('\n') : t('acc.none');
  c.accessReview = { at, items }; c.updated = at; c.needsYou = true;
  if (!items.length) { c.status = 'done'; c.needsYou = false; }
  save(p);
  write({ ...read(), last: today() });
  return { card: c.id, project: p.slug, items: items.length, created: !open };
}

// The daily check: due when 90 days have passed since the last review; the first start only begins the count.
function check() {
  const j = read(), d = today();
  if (!j.last) { write({ ...j, last: d }); return { due: false, started: true }; }
  if (days(j.last, d) < EVERY_DAYS) return { due: false };
  return { due: true, ...run() };
}

// The card as the page needs it (names, never values).
function view(slug, id) {
  const p = load(slug), c = p && p.cards.find(x => x.id === id);
  if (!c || !c.accessReview) throw bad('not an access review card', 404);
  return { card: c.id, at: c.accessReview.at, items: c.accessReview.items.map(x => ({ ...x, line: line(x) })), done: c.status === 'done' };
}

// Remove one kept secret by its key (a server's sudo password goes through My servers so its flag stays right).
function removeKept(key) {
  const servers = require('./servers');
  const srv = /^server:.*:sudo$/.test(key) && servers.list().find(s => 'server:' + String(s.name).toLowerCase() + ':sudo' === key);
  if (srv) servers.setSudoPw(srv.name, ''); else S().keep(key, null);
}

// Keep / Remove one row (by its number) of an access review card.
async function act(slug, id, b) {
  b = b || {};
  const p = load(slug), c = p && p.cards.find(x => x.id === id);
  if (!c || !c.accessReview) throw bad('not an access review card', 404);
  const x = c.accessReview.items[Number(b.item)];
  if (!x) throw bad('no such row', 404);
  if (b.action !== 'keep' && b.action !== 'remove') throw bad('action must be keep or remove');
  if (x.decision) return view(slug, id);
  if (b.action === 'remove') {
    if (x.kind === 'link') await share().unlink(x.id, {});
    else if (x.kind === 'role') require('./changeroles').set(x.slug, x.role === 'pm' ? { pm: { remove: x.contact } } : { [x.role]: '' });
    else if (x.kind === 'secret') S().forget(x.slug, x.name);
    else removeKept(x.key);
  }
  const p2 = load(slug), c2 = p2.cards.find(k => k.id === id);
  c2.accessReview.items[Number(b.item)].decision = b.action === 'keep' ? 'kept' : 'removed';
  c2.updated = now();
  if (c2.accessReview.items.every(i => i.decision)) { c2.status = 'done'; c2.needsYou = false; }
  save(p2);
  return view(slug, id);
}

function start() {
  if (process.env.AIGILE_NO_ACCESS_REVIEW) return;
  setTimeout(function tick() { try { check(); } catch {} setTimeout(tick, CHECK_MS).unref(); }, 90e3).unref();
}
module.exports = { run, check, view, act, collect, start, today };
