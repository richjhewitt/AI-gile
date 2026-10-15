// 🗂️ Configuration items (AIG-1122, docs/SERVICE-MGMT-PLAN.md phase 3): the things a service stands on, listed per project.
// Stored as p.ci = [{ id, kind, name, detail, expires?, backup?: {where, everyDays, last?}, links: [] }], only when there are items.
//   kind: server | domain | certificate | key | repo | supplier | other
//   id: 'ci-<n>'; expires: 'YYYY-MM-DD'; links: card ids, web addresses or other short references.
// A server is picked from My servers (its name), a key by its Secrets name: names only, never a value (a key item holding anything
// but a NAME_LIKE_THIS is refused). Later helpers build on this shape: incident/change links, expiry watch, backup check.
const { now, load, save, bad } = require('./store');

const KINDS = ['server', 'domain', 'certificate', 'key', 'repo', 'supplier', 'other'];
const KEY_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;
const line = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };

const of = p => Array.isArray(p && p.ci) ? p.ci : [];
const find = (p, id) => of(p).find(x => x.id.toLowerCase() === String(id || '').trim().toLowerCase()) || null;
// Every item across projects: [{ slug, project, ...item }].
function all(projects) {
  const S = require('./store'), list = projects || S.listSlugs().map(s => { try { return S.load(s); } catch { return null; } }).filter(Boolean);
  const out = [];
  for (const p of list) for (const x of of(p)) out.push({ slug: p.slug, project: p.name, ...x });
  return out;
}

function day(v) {
  const s = String(v == null ? '' : v).trim(); if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s), d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!d || d.getUTCMonth() !== +m[2] - 1) throw bad('the expiry date must be YYYY-MM-DD');
  return s;
}
function backupOf(b) {
  if (!b || typeof b !== 'object') return null;
  const where = line(b.where, 200); if (!where) return null;
  const n = Math.round(Number(b.everyDays));
  if (!(n >= 1 && n <= 3650)) throw bad('the backup interval is a number of days, 1 to 3650');
  const x = { where, everyDays: n }, last = day(b.last); if (last) x.last = last;
  return x;
}
function linksOf(v) {
  const a = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : [];
  return [...new Set(a.map(x => line(x, 300)).filter(Boolean))].slice(0, 20);
}
// A clean item from a request body; `old` is the item being edited (missing fields keep their value).
function clean(b, old) {
  b = b || {}; const o = old || {};
  const has = k => b[k] !== undefined;
  const kind = String(has('kind') ? b.kind : o.kind || '').trim().toLowerCase();
  if (!KINDS.includes(kind)) throw bad('kind is one of: ' + KINDS.join(', '));
  const name = line(has('name') ? b.name : o.name, 120); if (!name) throw bad('an item needs a name');
  if (kind === 'key' && !KEY_NAME.test(name)) throw bad('a key item is a Secrets name (capital letters, digits and _, like GITHUB_TOKEN), never the key itself');
  const x = { id: o.id, kind, name, detail: line(has('detail') ? b.detail : o.detail, 500) };
  const exp = day(has('expires') ? b.expires : o.expires); if (exp) x.expires = exp;
  const bk = has('backup') ? backupOf(b.backup) : o.backup;
  if (bk && !bk.last && o.backup && o.backup.last && has('backup')) bk.last = o.backup.last;   // editing the item keeps the last backup date
  if (bk) x.backup = bk;
  const hist = (o.links || []).filter(l => l && typeof l === 'object');   // card links (AIG-1123) are kept; the text links are what you edit
  x.links = has('links') ? [...linksOf(b.links), ...hist] : (o.links || []);
  return x;
}
function put(p, items) { if (items.length) p.ci = items; else delete p.ci; p.updated = now(); save(p); }

function add(slug, b) {
  const p = proj(slug), items = of(p).slice();
  const n = Math.max(0, ...items.map(x => parseInt(String(x.id).replace(/\D/g, ''), 10) || 0)) + 1;
  if (items.length >= 200) throw bad('that is enough items for one project (200)');
  const x = clean(b); x.id = 'ci-' + n; items.push(x); put(p, items);
  return x;
}
function patch(slug, id, b) {
  const p = proj(slug), items = of(p).slice(), i = items.findIndex(x => x.id.toLowerCase() === String(id).toLowerCase());
  if (i < 0) throw bad('no such item', 404);
  items[i] = clean(b, items[i]); put(p, items);
  return items[i];
}
function remove(slug, id) {
  const p = proj(slug), items = of(p), x = find(p, id); if (!x) throw bad('no such item', 404);
  for (const c of p.cards || []) if (Array.isArray(c.ci) && c.ci.includes(x.id)) { c.ci = c.ci.filter(i => i !== x.id); if (!c.ci.length) delete c.ci; }
  put(p, items.filter(y => y !== x));
  return { ok: true, id: x.id };
}
// What the page offers to pick from: saved server names and Secrets names (names only).
function picks() {
  let servers = [], keys = [];
  try { servers = require('./servers').effective().map(s => s.name); } catch {}
  try { keys = [...new Set(require('./secrets').list().items.map(x => x.name))].sort(); } catch {}
  return { kinds: KINDS, servers, keys };
}
// 🔗 Affects (AIG-1123): link an item to an incident, problem or change card, or unlink it. Stored twice: c.ci [itemId] on the card
// and {card, type, at} in the item's links (the item's history). on=false unlinks.
const LINKABLE = ['incident', 'problem', 'change'];
function link(slug, itemId, cardId, on) {
  const p = proj(slug), x = find(p, itemId); if (!x) throw bad('no such item', 404);
  const c = (p.cards || []).find(y => y.id.toLowerCase() === String(cardId || '').trim().toLowerCase()); if (!c) throw bad('no such card', 404);
  if (!LINKABLE.includes(c.type)) throw bad('only incident, problem and change cards can affect an item');
  const keep = (x.links || []).filter(l => !(l && typeof l === 'object' && l.card === c.id));
  if (on === false) {
    x.links = keep; c.ci = (c.ci || []).filter(i => i !== x.id); if (!c.ci.length) delete c.ci;
  } else {
    x.links = [...keep, { card: c.id, type: c.type, at: now() }];
    c.ci = [...new Set([...(c.ci || []), x.id])];
  }
  c.updated = now(); p.updated = now(); save(p);
  return { item: x.id, card: c.id, linked: on !== false };
}
// An item's linked cards, newest first, with the card's title and status as they are now.
const history = (p, x) => (x.links || []).filter(l => l && typeof l === 'object').map(l => {
  const c = (p.cards || []).find(y => y.id === l.card);
  return { ...l, title: c ? c.title : '', status: c ? c.status : '' };
}).sort((a, b) => String(b.at).localeCompare(String(a.at)));
function view(slug) { const p = proj(slug); return { items: of(p).map(x => ({ ...x, history: history(p, x) })), ...picks() }; }
// One line per item for the CLI.
const show = x => `${x.id} [${x.kind}] ${x.name}${x.detail ? ' - ' + x.detail : ''}${x.expires ? ' (expires ' + x.expires + ')' : ''}${x.backup ? ` (backup ${x.backup.where} every ${x.backup.everyDays}d${x.backup.last ? ', last ' + x.backup.last : ''})` : ''}${(x.links || []).filter(l => typeof l === 'string').length ? ' -> ' + x.links.filter(l => typeof l === 'string').join(', ') : ''}${(x.links || []).some(l => l && l.card) ? ' [affects: ' + x.links.filter(l => l && l.card).map(l => l.card).join(', ') + ']' : ''}`;

module.exports = { KINDS, LINKABLE, of, all, find, add, patch, remove, link, history, view, picks, show };
