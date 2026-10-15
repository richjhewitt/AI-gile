// ✉️ Mail rules without AI (AIG-906, docs/MAIL-PLAN.md card 5). A rule matches on from / subject (contains, any case; has-
// attachment waits, the list only reads envelopes), then adds a label and/or suggests a card (a 📋 chip on the row). Rules
// are local only: nothing is written to the mailbox (no move, no mark read, no delete), so a rule can never lose a mail. Four
// starter rules (bills, appointments, deliveries, newsletters) are on from the start and can be switched off. data/mail/rules.json.
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');

const FILE = () => path.join(DATA, 'mail', 'rules.json');
const STARTER = [
  { id: 'bills', name: 'Bills', subject: 'invoice|bill|payment due|receipt', label: '💷 Bill', card: true },
  { id: 'appointments', name: 'Appointments', subject: 'appointment|booking|reminder|confirmed', label: '📅 Appointment', card: true },
  { id: 'deliveries', name: 'Deliveries', subject: 'delivery|dispatched|shipped|parcel|out for delivery', label: '📦 Delivery' },
  { id: 'newsletters', name: 'Newsletters', subject: 'newsletter|unsubscribe|weekly|digest', label: '📰 Newsletter' },
];
const clip = (s, n) => String(s == null ? '' : s).replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, n);

function list() {
  try { const r = JSON.parse(fs.readFileSync(FILE(), 'utf8')); if (Array.isArray(r.rules)) return r.rules; } catch {}
  return STARTER.map(r => ({ ...r, on: true }));
}
function write(rules) { fs.mkdirSync(path.dirname(FILE()), { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify({ rules }, null, 1)); return { rules }; }
function cleanRule(r, i) {
  const out = { id: clip(r.id, 40).replace(/[^a-z0-9-]/gi, '') || 'r' + Date.now().toString(36) + i, name: clip(r.name, 60), from: clip(r.from, 200), subject: clip(r.subject, 200), label: clip(r.label, 40), card: !!r.card, on: r.on !== false };
  if (!out.name) throw bad('a rule needs a name');
  if (!out.from && !out.subject) throw bad('a rule needs something to match: from or subject');
  if (!out.label && !out.card) throw bad('a rule needs a label or Suggest a card');
  return out;
}
// POST { rules: [...] } replaces the list (max 50); POST { reset: true } brings the starter rules back.
function save(b) {
  if (b.reset) { try { fs.rmSync(FILE()); } catch {} return { rules: list() }; }
  if (!Array.isArray(b.rules) || b.rules.length > 50) throw bad('rules must be a list of at most 50');
  return write(b.rules.map(cleanRule));
}
// "a|b" in a field means a or b; plain text, never a regex from the page.
const has = (hay, field) => !field || field.split('|').map(s => s.trim().toLowerCase()).filter(Boolean).some(w => hay.includes(w));
function match(r, m) {
  if (!r.on) return false;
  const from = ((m.from && (m.from.name + ' ' + m.from.address)) || '').toLowerCase(), subj = String(m.subject || '').toLowerCase();
  return has(from, r.from) && has(subj, r.subject);
}
// Adds labels and suggestCard to each item of an inbox answer; the cache on disk stays as it was.
function tag(res) {
  const rules = list().filter(r => r.on);
  for (const m of res.items || []) {
    const hit = rules.filter(r => match(r, m));
    m.labels = [...new Set(hit.map(r => r.label).filter(Boolean))];
    m.suggestCard = hit.some(r => r.card);
  }
  return res;
}

module.exports = { list: () => ({ rules: list() }), save, tag, _match: match };
