// 💬 Public feedback (AIG-968..970): visitors to a project's own website report a problem through the relay's form
// (relay/relay.js, /f/<name>) and each report lands here as a bug card in To do. Project setting `feedback {on, group}`
// (owner only; needs the project to be public). The board tells the relay when the setting changes (signed, POST /f/<name>/config),
// pulls the waiting reports every 60 s while it is on (signed GET /f/<name>/pull), files them, then acks them (POST .../ack).
// A report is outside text: it goes inside the friend-text fence, only a clean path is put in the title, the screenshot is
// checked again (png/jpeg bytes, 300 KB) and saved as an attachment, and nothing in it is ever followed or run. It never
// adds a comment, so nothing is woken as if the owner had written it.
const { bad, load, save, now, listSlugs } = require('./store');

const EVERY_MS = 60e3;
const dm = () => require('./dm');
const pub = () => require('./publicboard');
const base = () => String(dm().relayAddress() || '').replace(/\/+$/, '');
const group = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);

// The PATCH route: { on, group }. Done before the route saves; the relay is told afterwards.
function setFlags(p, b) {
  const v = b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  const on = !!v.on, g = group(v.group);
  if (on && !p.public) throw bad('make the board public first: the feedback form belongs to the public name');
  p.feedback = on || g ? { on, group: g } : undefined;
  setImmediate(() => push(p.slug, true).catch(() => {}));
}
// Tell the relay whether this name takes reports. Needs the name published; publicboard calls this again after each publish.
async function push(slug, force) {
  const p = load(slug); if (!p || !base()) return;
  const want = !!p.public && !!(p.feedback && p.feedback.on);
  if (!want && !force) return;
  await dm().relayCall(base(), 'POST', '/f/' + pub().nameOf(p) + '/config', { on: want });
}

const PNG = [0x89, 0x50, 0x4e, 0x47], JPG = [0xff, 0xd8, 0xff];
function shot(slug, data) {
  const m = String(data || '').match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64'), magic = m[1] === 'png' ? PNG : JPG;
  if (!buf.length || buf.length > 300 * 1024 || !magic.every((x, i) => buf[i] === x)) return null;
  return require('./attachments').saveAttachment(slug, { name: 'visitor-screenshot.' + (m[1] === 'png' ? 'png' : 'jpg'), type: 'image/' + m[1], data: m[2] });
}
const pathOnly = s => String(s || '').replace(/[^A-Za-z0-9_\-./~%]+/g, '').slice(0, 80);

// One card per report (a bug in To do, in the setting's group).
function cardFor(p, r) {
  const { fence } = require('./share-base'), at = now(), lang = String(r.lang || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12);
  const text = `Page: ${r.page || '-'}\nLanguage: ${lang || '-'}\n\nWhat went wrong:\n${r.says || ''}\n\nWhat should have happened:\n${r.should || '-'}`;
  const c = { id: p.key + '-' + p.nextId++, title: '🌐 ' + (lang || '??') + ': ' + (pathOnly(r.page) || '/'),
    description: fence('Website visitor', text), testSteps: '', type: 'bug', priority: 'normal', status: 'todo', assignee: '', sprint: '', blocked: false, needsYou: false,
    createdBy: 'Website visitor', from: 'feedback', created: at, updated: at, comments: [] };
  const g = group(p.feedback && p.feedback.group); if (g) c.group = g;
  const f = r.screenshot ? shot(p.slug, r.screenshot) : null;
  if (f) c.attachments = [f];
  return c;
}

// Collect one project's waiting reports: file them as cards, save, then ack. Returns how many were filed.
async function pull(slug) {
  const p = load(slug);
  if (!p) throw bad('no such project', 404);
  if (!p.public || !(p.feedback && p.feedback.on)) return { filed: 0, off: true };
  if (!base()) throw bad('set the relay address in Setup (DMs) first', 409);
  const got = (await dm().relayCall(base(), 'GET', '/f/' + pub().nameOf(p) + '/pull')).reports || [];
  const ids = [];
  for (const r of got) {
    if (!r || typeof r !== 'object' || !/^\d{13}-[0-9a-f]{16}$/.test(String(r.id))) continue;
    if (String(r.says || '').trim()) p.cards.push(cardFor(p, { ...r, says: String(r.says).slice(0, 2000), should: String(r.should || '').slice(0, 2000), page: String(r.page || '').slice(0, 200) }));
    ids.push(r.id);
  }
  if (ids.length) { save(p); await dm().relayCall(base(), 'POST', '/f/' + pub().nameOf(p) + '/ack', { ids }); }
  return { filed: ids.length };
}
let busy = false;
async function pullAll() {
  if (busy) return; busy = true;
  try { for (const s of listSlugs()) { const p = load(s); if (p && p.public && p.feedback && p.feedback.on) await pull(s).catch(() => {}); } } finally { busy = false; }
}
function start() {
  if (process.env.AIGILE_NO_FEEDBACK_POLL) return;   // tests trigger it with POST /api/projects/:slug/feedback/pull
  setInterval(() => { pullAll().catch(() => {}); }, EVERY_MS).unref();
}

module.exports = { setFlags, push, pull, pullAll, start };
