// 💬 DM tidy (AIG-873): done 💬 DM cards (`dm: true`, or quick cards titled 💬) move into the project's Lead chat (lib/leadchat.js),
// each as chat messages in time order (description by its author, then its comments), merged into the thread by time. The card then
// leaves p.cards. Before that the whole card is appended to data/<slug>.dm-archive.json (never overwritten; listSlugs skips it).
// Explicit and idempotent: `aigile dms tidy <proj> [--dry-run]` / POST /api/projects/:slug/dms/tidy; never run at start-up.
const fs = require('fs');
const path = require('path');
const { DATA, load, save, now, isRich, writeAtomic } = require('./store');
const LC = require('./leadchat');

const archiveFile = slug => path.join(DATA, String(slug).replace(/[\/]/g, '') + '.dm-archive.json');
// Only a missing archive is empty; any other trouble stops the tidy before anything is removed.
const readArchive = slug => {
  let raw; try { raw = fs.readFileSync(archiveFile(slug), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const a = JSON.parse(raw);
  if (!Array.isArray(a)) throw new Error('the DM archive of ' + slug + ' is not a list: tidy stopped');
  return a;
};
const isDm = c => c.status === 'done' && (c.dm === true || (c.quick === true && /^\s*💬/.test(c.title || '')));

// The chat messages one card becomes, oldest first.
function messagesOf(c) {
  const out = [], at = c.created || c.updated || now();
  const mk = (when, author, text, attachments) => ({ at: when, author, text, mine: isRich(author), ...(attachments && attachments.length ? { attachments } : {}) });
  if (String(c.description || '').trim() || (c.attachments || []).length) out.push(mk(at, c.createdBy || 'Owner', String(c.description || '').trim(), c.attachments));
  for (const m of c.comments || []) if (String(m.text || '').trim() || (m.attachments || []).length) out.push(mk(m.at || at, m.author || 'Owner', String(m.text || '').trim(), m.attachments));
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

function tidy(slug, { dryRun } = {}) {
  const p = load(slug); if (!p) return null;
  const cards = p.cards.filter(isDm);
  const moved = cards.map(c => ({ id: c.id, title: c.title, messages: messagesOf(c).length }));
  const res = { dryRun: !!dryRun, moved, cards: moved.length, messages: moved.reduce((n, m) => n + m.messages, 0) };
  if (dryRun || !cards.length) return res;
  const arch = readArchive(slug), have = new Set(arch.map(a => a.card && a.card.id + '|' + a.card.created));
  const at = now();
  for (const c of cards) if (!have.has(c.id + '|' + c.created)) arch.push({ movedAt: at, card: c });
  writeAtomic(archiveFile(slug), JSON.stringify(arch, null, 1));   // backup first: nothing is removed before it is on disk
  LC.merge(slug, cards.flatMap(messagesOf));
  const gone = new Set(cards.map(c => c.id));
  p.cards = p.cards.filter(c => !gone.has(c.id));
  save(p);
  return res;
}

// Where a moved card went (for `aigile show`): its archive entry, or null.
function movedCard(slug, id) {
  const a = readArchive(slug).filter(a => a.card && String(a.card.id).toLowerCase() === String(id).toLowerCase()).pop();
  return a ? { id: a.card.id, title: a.card.title, movedAt: a.movedAt, to: 'Lead chat', archive: path.basename(archiveFile(slug)) } : null;
}
module.exports = { tidy, movedCard, isDm, messagesOf };
