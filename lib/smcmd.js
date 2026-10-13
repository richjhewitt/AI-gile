// 🧭 Scrum Master (no AI) (AIG-729..731): in No AI mode the Lead Scrum Master's chat still exists, but it only runs fixed commands
// in plain code; nothing here starts, queues or asks a model. Messages to it are answered at once with one line:
//   /sort priority|age|type|who   reorders the To do column of the current project (AIG-730)
//   /new project <name>           makes a project the way POST /api/projects does
//   /move AIG-1 done              moves a card (id and status are checked)
//   /request                      the page's form (first form: New server, AIG-731), POST /api/chats/_watchman/request
// The chat lives in data/smnoai.conf (not .json: every .json in data/ is a project), apart from the AI Scrum Master's chat.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs, owner, bad, STATUSES, PRIORITIES } = require('./store');
const { t: tr } = require('./i18n');

const FILE = path.join(DATA, 'smnoai.conf');
const read = () => { try { const s = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { msgs: s.msgs || [], readAt: s.readAt || '' }; } catch { return { msgs: [], readAt: '' }; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); } catch {} };
const post = m => { const s = read(); s.msgs.push(m); s.msgs = s.msgs.slice(-200); write(s); };
const say = text => post({ at: now(), text, auto: true });

// The chat as the page lists it.
function chat() {
  const s = read();
  return { slug: '_watchman', name: tr('sm.noai.name'), lead: tr('sm.noai.lead'), emoji: '🧭', color: '#3a5a7a', watchman: true, noAi: true, unread: s.msgs.filter(m => !m.mine && m.at > s.readAt).length, last: (s.msgs.at(-1) || {}).at || null };
}
function thread() {
  const s = read(); write({ ...s, readAt: now() });
  return { ...chat(), unread: 0, open: [], cards: { _night: { title: 'Chat', kind: 'other' } }, busy: false, sm: null,
    messages: s.msgs.map(m => ({ card: '_night', title: 'Chat', author: m.mine ? owner() : tr('sm.noai.lead'), text: m.text, at: m.at, mine: !!m.mine, auto: true })) };
}

// Run a route handler the way a request would (same checks, same saving), so a project or card is made exactly as the API does.
function call(method, url, body) {
  const routes = require('./routes')(() => ({}));
  for (const [m, re, h] of routes) { if (m !== method) continue; const mt = re.exec(url); if (mt) return h(mt.slice(1), body || {}, new URLSearchParams(), { headers: {} }); }
  throw bad('no such route');
}

const PRIO = Object.fromEntries(PRIORITIES.map((p, i) => [p, i + 1]));   // urgent first
const KEYS = {
  priority: (a, b) => (PRIO[b.priority] || 0) - (PRIO[a.priority] || 0),
  age: (a, b) => String(a.created || '').localeCompare(String(b.created || '')),   // oldest first
  type: (a, b) => ['incident', 'problem', 'bug', 'feature', 'task'].indexOf(a.type) - ['incident', 'problem', 'bug', 'feature', 'task'].indexOf(b.type),
  who: (a, b) => (!a.assignee - !b.assignee) || String(a.assignee || '').localeCompare(String(b.assignee || ''), undefined, { sensitivity: 'base' }),   // unassigned last
};
// Reorder the To do cards: the board shows them by sortPos (public/js/board.js), and the project file keeps them in that order too.
function sort(slug, key) {
  key = String(key || '').toLowerCase();
  if (!KEYS[key]) return tr('srv.smc.sort.bad', { keys: Object.keys(KEYS).join(', ') });
  const p = slug && load(slug);
  if (!p) return tr('srv.smc.noproject');
  const todo = p.cards.filter(c => c.status === 'todo' && !c.dm);
  const sorted = todo.slice().sort((a, b) => KEYS[key](a, b) || String(a.created || '').localeCompare(String(b.created || '')));
  const slots = p.cards.map((c, i) => todo.includes(c) ? i : -1).filter(i => i >= 0);
  sorted.forEach((c, i) => { p.cards[slots[i]] = c; c.sortPos = i + 1; });
  save(p);
  return tr('srv.smc.sort.done', { n: todo.length, key: tr('srv.smc.key.' + key), name: p.name });
}

const ALIAS = { 'to do': 'todo', 'to-do': 'todo', test: 'verify', testing: 'verify', 'in progress': 'doing', finished: 'done' };
function move(idRaw, stRaw) {
  const id = String(idRaw || '').toUpperCase(), st0 = String(stRaw || '').toLowerCase().trim(), st = ALIAS[st0] || st0;
  if (!/^[A-Z]{1,6}-\d+$/.test(id)) return tr('srv.smc.move.usage', { statuses: STATUSES.join(', ') });
  if (!STATUSES.includes(st)) return tr('srv.smc.move.badstatus', { status: stRaw || '', statuses: STATUSES.join(', ') });
  const p = listSlugs().map(load).find(x => x && id.startsWith(x.key + '-'));
  const c = p && p.cards.find(x => x.id === id);
  if (!c) return tr('srv.smc.move.nocard', { id });
  if (c.status === st) return tr('srv.smc.move.same', { id, status: st });
  try { call('PATCH', `/api/projects/${p.slug}/cards/${id}`, { status: st }); } catch (e) { return tr('srv.smc.move.fail', { id, why: e.message || String(e) }); }
  return tr('srv.smc.move.done', { id, status: st });
}

function newProject(name) {
  name = String(name || '').trim();
  if (!name) return tr('srv.smc.new.usage');
  try { const r = call('POST', '/api/projects', { name }); return tr('srv.smc.new.done', { name: r.name, key: r.key }); }
  catch (e) { return tr('srv.smc.new.fail', { why: e.message || String(e) }); }
}

// Who runs the servers: the first name with admin on a saved server, else one with run access; none = unassigned.
function serverOwner() {
  const all = require('./servers').list().flatMap(s => Object.entries(s.access || {}));
  return (all.find(([, v]) => v === 'admin') || all.find(([, v]) => v === 'run') || [''])[0];
}
// A request form (AIG-731). Only 'server' for now; adding a kind = one more entry here and one in the page's form list.
const FORMS = {
  server: ({ name, why }) => ({ title: 'New server: ' + name, description: '- ' + why.replace(/\s*\n\s*/g, ' '), assignee: serverOwner() }),
};
function request(kind, f, slug) {
  const form = FORMS[kind];
  if (!form) throw bad('unknown request');
  const name = String((f && f.name) || '').replace(/\s+/g, ' ').trim().slice(0, 80), why = String((f && f.why) || '').trim().slice(0, 500);
  post({ at: now(), mine: true, text: `/request ${kind}: ${name} - ${why}` });
  const p = slug && load(slug);
  let line;
  if (!p) line = tr('srv.smc.noproject');
  else if (!name || !why) line = tr('srv.smc.req.missing');
  else {
    const c = call('POST', `/api/projects/${p.slug}/cards`, { ...form({ name, why }), type: 'task', status: 'todo', priority: 'normal', createdBy: tr('sm.noai.lead') });
    line = c.assignee ? tr('srv.smc.req.done.to', { id: c.id, title: c.title, who: c.assignee }) : tr('srv.smc.req.done', { id: c.id, title: c.title });
  }
  say(line);
  return { ok: true, auto: true, reply: line };
}

// A message from the owner: a command, or the help.
function handle(text, slug) {
  text = String(text || '').trim();
  if (!text) throw bad('text is required');
  if (/^\W*(clear|wipe|empty)\b.*\b(chat|messages?|history)\W*$/i.test(text)) { write({ msgs: [], readAt: now() }); return { ok: true }; }
  post({ at: now(), mine: true, text });
  const [cmd, ...rest] = text.split(/\s+/), arg = rest.join(' ');
  let line;
  if (/^\/sort$/i.test(cmd)) line = sort(slug, rest[0]);
  else if (/^\/new$/i.test(cmd) && /^project\b/i.test(arg)) line = newProject(arg.replace(/^project\s*/i, ''));
  else if (/^\/move$/i.test(cmd)) line = move(rest[0], rest.slice(1).join(' '));
  else if (/^\/request$/i.test(cmd)) line = tr('srv.smc.req.open');
  else line = tr('srv.smc.help');
  say(line);
  return { ok: true, auto: true, reply: line };
}

module.exports = { chat, thread, handle, request, sort, move, newProject, serverOwner };
