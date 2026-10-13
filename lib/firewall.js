// Message firewall (AIG-839): plain rules (no AI, works in No AI mode) that keep a team's duplicates and resends out of the owner's inbox.
// reason() is called by the comment, Lead chat and DM routes before a team message is saved. A caught message is not lost: keep() puts it
// in data/firewall.conf (JSON, not .json: every .json in data/ is a project) so a bin page (AIG-840) can let it through and each kind of
// catch can become a team card (AIG-841). Reasons: duplicate | original | empty. A re-sent open task / ask is a bump (routes/comments.js).
const fs = require('fs');
const path = require('path');
const { DATA, now, isRich } = require('./store');

const FILE = () => path.join(DATA, 'firewall.conf');
const WINDOW_MS = 24 * 3600 * 1000, KEEP = 500;
const REASONS = { duplicate: 'duplicate', original: 'an "Original:" copy', empty: 'empty' };
const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const readAll = () => { try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return Array.isArray(j.items) ? j.items : []; } catch { return []; } };
const writeAll = items => fs.writeFileSync(FILE(), JSON.stringify({ items }));

// prior: earlier messages of the same place [{ author, text, at }], oldest first. Returns a reason or ''.
function reason(author, text, prior, hasFiles) {
  if (isRich(author)) return '';
  const t = String(text || '');
  // The first "Original:" is the lead's tidy note (AIG-811); another one on the card is a copy.
  if (/^\s*original:/i.test(t) && prior.some(m => !isRich(m.author) && /^\s*original:/i.test(m.text || ''))) return 'original';
  if (!hasFiles && !/[\p{L}\p{N}]/u.test(t)) return 'empty';
  const n = norm(t), since = Date.now() - WINDOW_MS;
  for (let i = prior.length - 1; i >= 0; i--) {   // newest first: an owner message after the match opens the topic again
    const m = prior[i];
    if (isRich(m.author)) return '';
    if (Date.parse(m.at) < since) return '';
    if (norm(m.text) === n) return 'duplicate';
  }
  return '';
}
// Keeps the catch; returns what the CLI shows.
function keep({ project, card, author, kind, text, why, mark, needsYou, options }) {
  const items = readAll();
  const e = { id: 'fw-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: now(), project, card: card || '', author, kind, reason: why, text: String(text || ''), ...(mark ? { mark } : {}), ...(needsYou ? { needsYou: true } : {}), ...(options && options.length ? { options } : {}) };
  items.push(e); writeAll(items.slice(-KEEP));
  return { firewalled: true, reason: why, id: e.id, card: card || '', message: `kept out by the firewall: ${REASONS[why] || why} (saved in the Assistant's bin, not lost)` };
}
const list = project => readAll().filter(e => !project || e.project === project).reverse();

module.exports = { reason, keep, list, REASONS };
