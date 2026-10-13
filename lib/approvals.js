// Approvals (AIG-814, AIG-815): with the project setting `approvals` on, a card a friend sends into my 📥 lane arrives as
// approval: 'waiting'. A waiting card is only in the link file, never a project card, so no team, `next`, dispatcher,
// swarm worker or night watch can pick it up or count it as To do. Only the owner (ownerOnly, on every /api/shares route)
// approves it into my To do, or declines it with a short note the friend sees on their side.
// Built on share-base.js and share-board.js.
const { now, load, save, bad } = require('./store');
const { t: tr } = require('./i18n');
const { all, change, read, shown, isShare, cleanText, unfence, sendOn } = require('./share-base');
const { cardChanged } = require('./share-cards');

const isOn = slug => !!(slug && (load(slug) || {}).approvals);
const waiting = c => !!c && c.approval === 'waiting';

// Every card waiting for my OK, across projects (the inbox tab). Friend text, so for the page only (owner routes).
function list() {
  const out = [];
  for (const L of all()) {
    if (L.forgotten || !L.slug) continue;
    const s = shown(L), p = load(L.slug);
    for (const x of Object.values((L.inbound || {}).cards || {})) {
      if (!waiting(x)) continue;
      out.push({ link: L.id, share: x.share, friend: s.friend, project: L.slug, projectName: p ? p.name : L.slug, title: x.title, description: x.description || '', type: x.type, priority: x.priority, at: x.first || x.updated });
    }
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
function cardOf(id, share) {
  const L = read(id), x = L && ((L.inbound || {}).cards || {})[share];
  if (!L || !isShare(share) || !x) throw bad('card not found', 404);
  if (!waiting(x)) throw bad('this card is not waiting for your OK', 409);
  return { L, x };
}
// ✅ Approve: the card comes onto my board as To do (title only, like Take; their description stays in the link file).
function approve(id, share) {
  const { L, x } = cardOf(id, share);
  const p = load(L.slug);
  if (!p) throw bad('project not found', 404);
  const at = now(), friend = shown(L).friend;
  const c = { id: p.key + '-' + p.nextId++, title: unfence(x.title).trim() || '(untitled)', description: '', testSteps: '', type: x.type, priority: x.priority, status: 'todo',
    assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: friend + ' (via 🔗)', from: 'share:' + id, share: { link: id, id: share, theirs: true },
    created: at, updated: at, comments: [] };
  p.cards.push(c); cardChanged(p, c); save(p);
  change(id, L => { const y = L.inbound.cards[share]; delete y.approval; y.taken = c.id; y.approvedAt = at; });
  return c;
}
// ✋ Decline: closed (done), with my note as a comment on their card and a done label, both going to the friend.
async function decline(id, share, b = {}) {
  const { L } = cardOf(id, share);
  const note = cleanText(b.note).trim();
  if (!note) throw bad('a short note is required', 400);
  const text = tr('srv.approvals.declined', { note });
  await require('./share-board').laneComment(id, share, { text, force: true });
  change(id, L => { const y = L.inbound.cards[share]; y.approval = 'declined'; y.declinedAt = now(); y.declineNote = note.slice(0, 500); });
  try { await sendOn(id, 'status', { share, status: 'done' }); } catch {}
  return { share, declined: true, note };
}

module.exports = { isOn, waiting, list, approve, decline };
