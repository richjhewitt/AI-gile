// ✉️ Mail 6/8 (AIG-908, docs/MAIL-PLAN.md card 6): agents read a mailbox and draft replies; they never send. Off until the owner
// ticks "Let agents read this mailbox" in Setup > Mail (box.agents, saved with the secrets page token like the rest of the box).
// Agents get the cached list and plain text only (no HTML, no attachments), and the CLI prints it inside an "untrusted email"
// fence. A draft is text kept in data/mail/drafts.json; the owner sees "Draft by X" on the mail and can use it in ↩️ Reply,
// which still sends only from the page (lib/mailsend.js). Every read and draft is a line in data/mail/log.jsonl (no bodies).
// Not yet: the automatic watch (a run on new mail with a daily cap) and summaries.
const fs = require('fs');
const path = require('path');
const { DATA, bad, now } = require('./store');

const DRAFTS = () => path.join(DATA, 'mail', 'drafts.json');
const MAX_DRAFT = 20 * 1024, MAX_PER_MAIL = 5;
const who = s => String(s == null ? '' : s).replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 60) || 'an agent';
const log = o => { fs.mkdirSync(path.join(DATA, 'mail'), { recursive: true }); fs.appendFileSync(path.join(DATA, 'mail', 'log.jsonl'), JSON.stringify({ at: now(), ...o }) + '\n'); };
const mail = () => require('./mail');

function allowed(boxId) {
  const b = mail().config().boxes.find(x => x.id === boxId) || (!boxId && mail().config().boxes[0]);
  if (!b) throw bad('no such mailbox', 404);
  if (!b.agents) throw bad('agents may not read this mailbox: the owner can allow it in Setup > Mail', 403);
  return b;
}
async function list(boxId, by) {
  const b = allowed(boxId), r = await mail().inbox(b.id, false);
  log({ what: 'list', by: who(by), box: b.id });
  return { box: { id: b.id, name: b.name }, at: r.at, items: (r.items || []).map(m => ({ uid: m.uid, from: m.from, subject: m.subject, date: m.date, unread: m.unread })) };
}
async function read(boxId, uid, by) {
  const b = allowed(boxId), m = await mail().message(b.id, uid);
  log({ what: 'read', by: who(by), box: b.id, uid: m.uid, subject: m.subject });
  return { box: { id: b.id, name: b.name }, uid: m.uid, from: m.from, to: m.to, subject: m.subject, date: m.date, text: m.text || '(no plain text: only an HTML version, which agents do not get)', attachments: (m.attachments || []).map(a => a.name) };
}

function readDrafts() { try { return JSON.parse(fs.readFileSync(DRAFTS(), 'utf8')); } catch { return {}; } }
const key = (boxId, uid) => boxId + ':' + Number(uid);
// POST { box, uid, text, by }: agents only on an allowed mailbox; the owner's page can always save (it holds the box anyway).
function draft(b, fromPage) {
  const box = fromPage ? mail().config().boxes.find(x => x.id === b.box) : allowed(String(b.box || ''));
  if (!box) throw bad('no such mailbox', 404);
  const uid = Number(b.uid); if (!(Number.isInteger(uid) && uid > 0)) throw bad('which mail? (uid)');
  const text = String(b.text == null ? '' : b.text).replace(/\r\n/g, '\n');
  if (!text.trim()) throw bad('the draft is empty');
  if (text.length > MAX_DRAFT) throw bad('that draft is too long');
  const all = readDrafts(), k = key(box.id, uid), d = { at: now(), by: who(b.by), text };
  all[k] = [...(all[k] || []), d].slice(-MAX_PER_MAIL);
  fs.mkdirSync(path.dirname(DRAFTS()), { recursive: true }); fs.writeFileSync(DRAFTS(), JSON.stringify(all));
  log({ what: 'draft', by: d.by, box: box.id, uid });
  return { ok: true, drafts: all[k] };
}
const drafts = (boxId, uid) => ({ drafts: readDrafts()[key(boxId, uid)] || [] });

module.exports = { list, read, draft, drafts };
