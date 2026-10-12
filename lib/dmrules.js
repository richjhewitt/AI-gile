// DM housekeeping without AI (AIG-551, usage saver 4/4). While the usage saver is on or No Token Mode is on, the owner's DM to a
// project lead or to the 🧭 Lead Scrum Master gets a rule-based reply (free) instead of an AI run: status, list <column>,
// move <id> <column>, park <id>, crucial <id>, help. Anything else is answered once ("waits until usage is back"). A lead's DM
// stays on its card, so the lead reads it as normal when it next runs; the Scrum Master's message is not kept.
// Replies carry `auto: true` so the page can label them as automated (AIG-566).
const { STATUSES, load, save, listSlugs, findCard, now } = require('./store');
const { t: tr } = require('./i18n');

const hook = { patch: null };   // set by lib/routes/projects-cards.js: the PATCH card route, so a move is exactly a normal move
// True while AI is held back: the usage saver is on, or No Token Mode.
function on() {
  try { if (require('./notokens').isOn()) return true; } catch {}
  try { return !!require('./budget').saving(); } catch { return false; }
}

const ALIAS = { backlog: 'backlog', todo: 'todo', 'to do': 'todo', doing: 'doing', progress: 'doing', 'in progress': 'doing', review: 'review',
  verify: 'verify', test: 'verify', testing: 'verify', team: 'team', done: 'done' };
const status = w => ALIAS[String(w || '').trim().toLowerCase().replace(/\s+/g, ' ')] || null;
const ID = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const short = c => `${c.id} ${String(c.title || '').slice(0, 60)}`;

// scope: one project (a lead's DM), or null (the Scrum Master: every active project).
function find(scope, id) {
  const ps = scope ? [scope] : listSlugs().map(load).filter(p => p && !p.archived);
  for (const p of ps) { const c = (p.cards || []).find(x => x.id.toLowerCase() === id.toLowerCase()); if (c) return { p: load(p.slug), c }; }
  return null;
}
const projects = scope => scope ? [scope] : listSlugs().map(load).filter(p => p && !p.archived);

function reply(scope, text) {
  const w = String(text || '').trim().replace(/\s+/g, ' ').split(' '), cmd = (w[0] || '').toLowerCase().replace(/[.!?:]+$/, '');
  const rest = w.slice(1).join(' ');
  if (cmd === 'help' || cmd === '?') return tr('srv.dmr.help');
  if (cmd === 'status') {
    const lines = projects(scope).map(p => {
      const n = Object.fromEntries(STATUSES.map(s => [s, 0])); for (const c of p.cards) if (n[c.status] !== undefined) n[c.status]++;
      const doing = p.cards.filter(c => c.status === 'doing').map(short);
      return tr('srv.dmr.status', { name: p.name, ...n, active: doing.length ? doing.join('; ') : tr('srv.dmr.nothing') });
    });
    return lines.join('\n') || tr('srv.dmr.nothing');
  }
  if (cmd === 'list') {
    const st = status(rest); if (!st) return tr('srv.dmr.badstatus', { word: rest || '?', list: STATUSES.join(', ') });
    const rows = projects(scope).flatMap(p => p.cards.filter(c => c.status === st).map(c => (scope ? '' : p.name + ': ') + short(c)));
    return rows.length ? tr('srv.dmr.list', { status: st, n: rows.length }) + '\n' + rows.slice(0, 20).join('\n') + (rows.length > 20 ? '\n…' : '') : tr('srv.dmr.listnone', { status: st });
  }
  if (cmd === 'move' || cmd === 'park' || cmd === 'crucial') {
    const id = (rest.split(' ')[0] || ''), more = rest.split(' ').slice(1).join(' ');
    if (!ID.test(id)) return tr('srv.dmr.needid', { cmd });
    const hit = find(scope, id); if (!hit) return tr('srv.dmr.nocard', { id });
    if (!hook.patch) return tr('srv.dmr.unknown');
    if (cmd === 'move') {
      const st = status(more); if (!st) return tr('srv.dmr.badstatus', { word: more || '?', list: STATUSES.join(', ') });
      hook.patch([hit.p.slug, hit.c.id], { status: st }); return tr('srv.dmr.moved', { id: hit.c.id, status: st });
    }
    if (cmd === 'park') { hook.patch([hit.p.slug, hit.c.id], { status: 'backlog' }); return tr('srv.dmr.parked', { id: hit.c.id }); }
    hook.patch([hit.p.slug, hit.c.id], { crucial: true }); return tr('srv.dmr.crucial', { id: hit.c.id });
  }
  return null;   // not a command
}

// The reply to a lead's DM (scope = the project). Text is always set.
function replyLead(scope, text) { return reply(scope, text) || tr('srv.dmr.unknown'); }
function replySM(text) { return reply(null, text) || tr('srv.dmr.unknownsm'); }

// Put a reply on a lead's DM card as the lead, flagged automated. Reloads the project (a move has just saved it).
function postLead(slug, cardId, author, text) {
  const p = load(slug), c = p && findCard(p, cardId); if (!c) return;
  c.comments.push({ author, text, at: now(), auto: true }); c.updated = now(); save(p);
}

module.exports = { on, hook, replyLead, replySM, postLead, reply };
