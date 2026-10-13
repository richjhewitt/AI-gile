// Share a project offline (AIG-446): one .aigile file (JSON) with the board's cards, comments and pictures, and the way back in.
// The file is built from allow-lists, so nothing else can leak: no local settings, keys, DM data, share links, folder paths or start commands.
// Opening checks the whole file before anything is written, then makes a new project that is linked to no folder.
const fs = require('fs');
const path = require('path');
const { DATA, bad, slugify, now, load, save, listSlugs, cleanCard, keepTicks, STATUSES, TYPES, PRIORITIES } = require('./store');
const risksLib = require('./risks');
const { fileOf, saveAttachment, MAX: MAX_ONE } = require('./attachments');

const FORMAT = 'aigile-project', VERSION = 1;
const MAX_FILES_BYTES = 20 * 1024 * 1024;   // all pictures and files together, before base64
const MAX_CARDS = 5000, MAX_COMMENTS = 2000, MAX_FILES = 20;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

// What goes into the file (everything else is left out on purpose).
const CARD_KEEP = ['title', 'description', 'testSteps', 'type', 'priority', 'status', 'assignee', 'sprint', 'group', 'blocked', 'needsYou', 'step', 'holds', 'waitsFor', 'ownerPrio', 'kind', 'mins', 'server', 'serverName', 'outside', 'info', 'focus', 'checklist'];
const CARD_PLAIN = ['createdBy', 'prevStatus', 'prevAssignee', 'reopenTo', 'quick', 'rootCause', 'workaround', 'incidents', 'problemId', 'changeId', 'riskId', 'change'];   // the last seven: problem cards (AIG-887) and risk links (AIG-863)
const RISK_KEEP = ['id', 'n', 'risk', 'card', 'category', 'owner', 'mitigation', 'warning', 'status', 'review', 'createdBy', 'created', 'updated', 'incident'];
const COMMENT_KEEP = ['author', 'text', 'at', 'verdict', 'mark'];

/* ---------- save ---------- */
function filesOf(slug, list, budget) {
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    let buf; try { buf = fs.readFileSync(fileOf(slug, a.id)); } catch { continue; }   // a file that went missing is left out
    budget.used += buf.length;
    if (budget.used > MAX_FILES_BYTES) throw bad('this project has more than ' + MAX_FILES_BYTES / 1048576 + ' MB of pictures and files, too big to save as one file: remove some attachments first', 413);
    out.push({ name: a.name, type: a.type || '', size: buf.length, data: buf.toString('base64') });
  }
  return out;
}
function exportProject(p) {
  const budget = { used: 0 };
  const cards = p.cards.map(c => {
    const o = { id: c.id, created: c.created, updated: c.updated };
    for (const k of [...CARD_PLAIN, ...CARD_KEEP]) if (c[k] !== undefined) o[k] = c[k];
    o.comments = (c.comments || []).map(m => {
      const x = {};
      for (const k of COMMENT_KEEP) if (m[k] !== undefined) x[k] = m[k];
      if (Array.isArray(m.options)) x.options = m.options.filter(s => typeof s === 'string');
      const files = filesOf(p.slug, m.attachments, budget);
      if (files.length) x.attachments = files;
      return x;
    });
    const files = filesOf(p.slug, c.attachments, budget);
    if (files.length) o.attachments = files;
    return o;
  });
  const reg = risksLib.read(p.slug), risks = reg.risks.map(r => {   // AIG-863: the risk register travels with the board
    const o = { likelihood: r.likelihood, impact: r.impact };
    for (const k of RISK_KEEP) if (r[k] !== undefined) o[k] = r[k];
    return o;
  });
  return {
    format: FORMAT, version: VERSION, exported: now(),
    project: { name: p.name, key: p.key, description: p.description || '', nextId: p.nextId, ...(p.color ? { color: p.color } : {}), ...(p.emoji ? { emoji: p.emoji } : {}), cards, risks },
  };
}

/* ---------- open: strict checks ---------- */
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, what, max, req) => {
  if (v === undefined || v === null || v === '') { if (req) throw bad('not a project file: ' + what + ' is missing'); return ''; }
  if (typeof v !== 'string') throw bad('not a project file: ' + what + ' must be text');
  if (v.length > max) throw bad('not a project file: ' + what + ' is too long');
  return v;
};
const flag = (v, what) => { if (v !== undefined && typeof v !== 'boolean') throw bad('not a project file: ' + what + ' must be true or false'); };
const list = (v, what, max) => { if (v === undefined) return []; if (!Array.isArray(v)) throw bad('not a project file: ' + what + ' must be a list'); if (v.length > max) throw bad('not a project file: ' + what + ' has too many entries'); return v; };
const when = (v, what) => { const s = str(v, what, 40); if (s && isNaN(Date.parse(s))) throw bad('not a project file: ' + what + ' is not a date'); };

// A file name with no path in it: no slashes, no .., no control characters or drive letters.
function fileName(v, what) {
  const n = str(v, what, 120, true);
  if (/[\\/\x00-\x1f:]/.test(n) || /^\.+$/.test(n) || n.includes('..')) throw bad('not a project file: "' + n.replace(/[^\x20-\x7e]/g, '?').slice(0, 40) + '" is not a safe file name (' + what + ')');
  return n;
}
function checkFiles(v, what, budget) {
  return list(v, what, MAX_FILES).map((a, i) => {
    if (!isObj(a)) throw bad('not a project file: ' + what + ' #' + (i + 1) + ' is not a file');
    const name = fileName(a.name, what + ' name'), type = str(a.type, what + ' type', 100), data = str(a.data, what + ' data', 30e6, true);
    if (!BASE64.test(data)) throw bad('not a project file: ' + what + ' "' + name + '" is damaged');
    const size = Buffer.from(data, 'base64').length;
    if (!size) throw bad('not a project file: ' + what + ' "' + name + '" is empty');
    if (size > MAX_ONE) throw bad('"' + name + '" is bigger than 10 MB');
    if (a.size !== undefined && a.size !== size) throw bad('not a project file: ' + what + ' "' + name + '" is damaged');
    budget.used += size;
    if (budget.used > MAX_FILES_BYTES) throw bad('this file holds more than ' + MAX_FILES_BYTES / 1048576 + ' MB of pictures and files: too big to open', 413);
    return { name, type, data };
  });
}
// Returns a clean project plus its files. Throws a plain-words error for anything wrong; writes nothing.
function check(file) {
  if (!isObj(file) || file.format !== FORMAT) throw bad('this is not an AI-gile project file');
  if (!Number.isInteger(file.version) || file.version < 1) throw bad('not a project file: no version');
  if (file.version > VERSION) throw bad('this project file is from a newer AI-gile (version ' + file.version + '): update AI-gile to open it');
  const pr = file.project;
  if (!isObj(pr)) throw bad('not a project file: the project is missing');
  const name = str(pr.name, 'the project name', 80, true).trim();
  if (!slugify(name)) throw bad('not a project file: the project name needs some letters or numbers');
  const key = str(pr.key, 'the project key', 8).toUpperCase();
  if (key && !/^[A-Z0-9]{1,8}$/.test(key)) throw bad('not a project file: the project key is not valid');
  const color = str(pr.color, 'the colour', 20), emoji = str(pr.emoji, 'the emoji', 16);
  if (color && !/^#[0-9a-f]{3,8}$/i.test(color)) throw bad('not a project file: the colour is not valid');
  const budget = { used: 0 }, ids = new Set();
  const cards = list(pr.cards, 'the cards', MAX_CARDS).map((c, i) => {
    const at = 'card #' + (i + 1);
    if (!isObj(c)) throw bad('not a project file: ' + at + ' is not a card');
    const id = str(c.id, at + ' id', 20, true).toUpperCase();
    if (!/^[A-Z0-9]{1,8}-\d{1,9}$/.test(id)) throw bad('not a project file: ' + at + ' has a bad id');
    if (ids.has(id)) throw bad('not a project file: card ' + id + ' appears twice');
    ids.add(id);
    if (!STATUSES.includes(c.status)) throw bad('not a project file: ' + id + ' has a bad status');
    if (c.type !== undefined && !TYPES.includes(c.type)) throw bad('not a project file: ' + id + ' has a bad type');
    if (c.priority !== undefined && !PRIORITIES.includes(c.priority)) throw bad('not a project file: ' + id + ' has a bad priority');
    if (!str(c.title, id + ' title', 400, true).trim()) throw bad('not a project file: ' + id + ' has no title');
    for (const k of ['description', 'testSteps', 'assignee', 'sprint', 'group', 'step', 'createdBy', 'prevStatus', 'prevAssignee', 'reopenTo', 'serverName']) str(c[k], id + ' ' + k, k === 'description' || k === 'testSteps' ? 100000 : 400);
    for (const k of ['rootCause', 'workaround', 'problemId', 'changeId', 'riskId']) str(c[k], id + ' ' + k, k === 'rootCause' || k === 'workaround' ? 2000 : 40);
    if (c.change !== undefined) {   // AIG-857: the change request fields
      if (!isObj(c.change)) throw bad('not a project file: ' + id + ' change must be an object');
      for (const k of ['kind', 'what', 'why', 'undo', 'riskId', 'from']) str(c.change[k], id + ' change ' + k, 600);
    }
    list(c.incidents, id + ' incidents', 50).forEach(x => str(x, id + ' incident', 40));
    for (const k of ['blocked', 'needsYou', 'server', 'outside', 'info', 'focus', 'quick']) flag(c[k], id + ' ' + k);
    for (const k of ['created', 'updated']) when(c[k], id + ' ' + k);
    const o = {};
    for (const k of [...CARD_KEEP, ...CARD_PLAIN, 'created', 'updated']) if (c[k] !== undefined) o[k] = c[k];
    o.id = id;
    o.comments = list(c.comments, id + ' comments', MAX_COMMENTS).map((m, j) => {
      const mt = id + ' comment #' + (j + 1);
      if (!isObj(m)) throw bad('not a project file: ' + mt + ' is not a comment');
      str(m.author, mt + ' author', 80, true); str(m.text, mt + ' text', 100000); when(m.at, mt + ' time');
      if (m.verdict !== undefined && !['accept', 'sendback'].includes(m.verdict)) throw bad('not a project file: ' + mt + ' has a bad verdict');
      if (m.mark !== undefined && !['task', 'ask', 'assume'].includes(m.mark)) throw bad('not a project file: ' + mt + ' has a bad mark');
      const x = {};
      for (const k of COMMENT_KEEP) if (m[k] !== undefined) x[k] = m[k];
      if (m.options !== undefined) x.options = list(m.options, mt + ' options', 12).map(s => str(s, mt + ' option', 300));
      const files = checkFiles(m.attachments, mt + ' files', budget);
      if (files.length) x.files = files;
      return x;
    });
    const files = checkFiles(c.attachments, id + ' files', budget);
    if (files.length) o.files = files;
    return o;
  });
  const risks = list(pr.risks, 'the risks', 500).map((r, i) => {
    const at = 'risk #' + (i + 1);
    if (!isObj(r)) throw bad('not a project file: ' + at + ' is not a risk');
    str(r.id, at + ' id', 20, true); str(r.risk, at + ' text', 300, true);
    for (const k of ['card', 'incident', 'category', 'owner', 'createdBy']) str(r[k], at + ' ' + k, 80);
    str(r.mitigation, at + ' mitigation', 1000); str(r.warning, at + ' warning', 500); str(r.review, at + ' review', 10);
    if (!risksLib.STATUSES.includes(r.status)) throw bad('not a project file: ' + at + ' has a bad status');
    for (const k of ['likelihood', 'impact']) if (![1, 2, 3].includes(r[k])) throw bad('not a project file: ' + at + ' has a bad ' + k);
    if (!/^R-\d{1,9}$/.test(r.id)) throw bad('not a project file: ' + at + ' has a bad id');
    when(r.created, at + ' created'); when(r.updated, at + ' updated');
    const o = { likelihood: r.likelihood, impact: r.impact };
    for (const k of RISK_KEEP) if (r[k] !== undefined) o[k] = r[k];
    o.n = Number.isInteger(r.n) && r.n > 0 ? r.n : Number(r.id.slice(2));
    return o;
  });
  if (new Set(risks.map(r => r.id)).size !== risks.length) throw bad('not a project file: a risk appears twice');
  const prefixes = new Set(cards.map(c => c.id.split('-')[0]));
  if (prefixes.size > 1) throw bad('not a project file: the cards use more than one key');
  return { name, key, description: str(pr.description, 'the description', 2000), color, emoji, nextId: Number.isInteger(pr.nextId) && pr.nextId > 0 ? pr.nextId : 0, cards, risks, bytes: budget.used, from: [...prefixes][0] || '' };
}

/* ---------- open: make the project ---------- */
// The new project's slug: the name's own, or with -2, -3... when it is taken.
function describeFile(file) {
  const c = check(file), taken = new Set(listSlugs()), base = slugify(c.name);
  let slug = base, n = 2;
  while (taken.has(slug)) slug = base + '-' + n++;
  return { c, slug, renamed: slug !== base };
}
function preview(file) {
  const { c, slug, renamed } = describeFile(file);
  const count = x => (x.files || []).length;
  return { name: c.name, slug, renamed, cards: c.cards.length, comments: c.cards.reduce((a, x) => a + x.comments.length, 0), files: c.cards.reduce((a, x) => a + count(x) + x.comments.reduce((b, m) => b + count(m), 0), 0), bytes: c.bytes };
}
function importProject(file) {
  const { c, slug } = describeFile(file);
  // The key: the file's own if free, else made up the way a new project's is; cards are renumbered to match.
  const taken = new Set(listSlugs().map(load).filter(Boolean).map(o => o.key)), letters = c.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'P';
  const key = c.key && !taken.has(c.key) ? c.key : [letters.slice(0, 3), ...[...letters.slice(3)].map(l => letters.slice(0, 2) + l), ...[2, 3, 4, 5, 6, 7, 8, 9].map(k => letters.slice(0, 2) + k)].find(k => !taken.has(k)) || letters.slice(0, 2) + Date.now() % 100;
  const renum = id => c.from && c.from !== key && id.startsWith(c.from + '-') ? key + id.slice(c.from.length) : id;
  const ids = v => (Array.isArray(v) ? v : []).map(x => renum(String(x).toUpperCase()));
  const put = files => files.map(f => saveAttachment(slug, f));
  try {
    const cards = c.cards.map(({ files, comments, id, created, updated, ...rest }) => {
      const clean = cleanCard(rest, false), at = now();
      for (const k of ['holds', 'waitsFor']) if (clean[k]) clean[k] = ids(clean[k]);
      if (clean.checklist) clean.checklist = keepTicks(null, clean.checklist);
      const card = { ...clean, ...Object.fromEntries(CARD_PLAIN.filter(k => rest[k] !== undefined).map(k => [k, rest[k]])), id: renum(id), created: created || at, updated: updated || created || at };
      for (const k of ['problemId', 'changeId']) if (card[k]) card[k] = renum(String(card[k]).toUpperCase());
      if (card.change && card.change.from) card.change = { ...card.change, from: renum(String(card.change.from).toUpperCase()) };   // the incident/problem it came from follows the new key
      if (card.incidents) card.incidents = ids(card.incidents);
      card.comments = comments.map(({ files: mf, ...m }) => ({ ...m, ...(mf ? { attachments: put(mf) } : {}) }));
      if (files) card.attachments = put(files);
      return card;
    });
    const top = Math.max(0, ...cards.map(x => Number(x.id.split('-')[1]) || 0));
    save({
      slug, name: c.name, key, description: c.description, path: '',   // no folder until the owner connects one
      ...(c.color ? { color: c.color } : {}), ...(c.emoji ? { emoji: c.emoji } : {}),
      created: now(), updated: now(), nextId: Math.max(c.nextId, top + 1), archived: false,
      cards, team: [], log: [],
    });
    if (c.risks.length) {   // the risk register: its card links follow the renumbering
      const rid = v => v ? renum(String(v).toUpperCase()) : v;
      const list = c.risks.map(r => ({ ...r, ...(r.card ? { card: rid(r.card) } : {}), ...(r.incident ? { incident: rid(r.incident) } : {}) }));
      risksLib.write(slug, { next: Math.max(1, ...list.map(r => r.n + 1)), risks: list });
    }
    return { slug, name: c.name, key, cards: cards.length };
  } catch (e) {
    try { fs.rmSync(path.join(DATA, 'attachments', slug), { recursive: true, force: true }); } catch {}
    throw e;
  }
}

module.exports = { exportProject, preview, importProject, check, FORMAT, VERSION, MAX_FILES_BYTES };
