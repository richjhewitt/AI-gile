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
const CARD_PLAIN = ['createdBy', 'prevStatus', 'prevAssignee', 'reopenTo', 'quick', 'rootCause', 'workaround', 'incidents', 'problemId', 'changeId', 'riskId', 'change', 'review', 'runbookProposal', 'runbook', 'ci', 'desk', 'major', 'ciWatch'];   // the last seven: problem cards (AIG-887) and risk links (AIG-863)
const RISK_KEEP = ['id', 'n', 'risk', 'card', 'category', 'owner', 'mitigation', 'warning', 'status', 'review', 'createdBy', 'created', 'updated', 'incident'];
const CI_KINDS = require('./ci').KINDS;   // AIG-1160: configuration items, releases and the service fields on cards travel too
const COMMENT_KEEP = ['author', 'text', 'at', 'verdict', 'mark'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
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
    if (isObj(o.runbookProposal)) { const { file, ...rp } = o.runbookProposal; o.runbookProposal = rp; }   // the file is a path on this computer
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
    project: { name: p.name, key: p.key, description: p.description || '', nextId: p.nextId, ...(p.color ? { color: p.color } : {}), ...(p.emoji ? { emoji: p.emoji } : {}), ...(Array.isArray(p.ci) && p.ci.length ? { ci: p.ci, ciN: p.ciN || 0 } : {}), ...(Array.isArray(p.releases) && p.releases.length ? { releases: p.releases } : {}), cards, risks },
  };
}

/* ---------- open: strict checks ---------- */
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
const DAY = /^\d{4}-\d{2}-\d{2}$/, CARD_ID = /^[A-Z0-9]{1,8}-\d{1,9}$/i, CI_ID = /^ci-\d{1,9}$/i;
const day = (v, what) => { const s = str(v, what, 10); if (s && (!DAY.test(s) || isNaN(Date.parse(s)))) throw bad('not a project file: ' + what + ' is not a date'); return s; };
const cardId = (v, what) => { const s = str(v, what, 40); if (s && !CARD_ID.test(s)) throw bad('not a project file: ' + what + ' is not a card id'); return s; };
const pick = (o, obj) => { for (const [k, v] of Object.entries(obj)) if (v !== '' && v !== undefined) o[k] = v; return o; };
// The service fields on a card (AIG-1160): each one is rebuilt from known keys only.
function serviceFields(c, id, o) {
  const at = id + ' ';
  if (c.review !== undefined) {
    const r = c.review; if (!isObj(r)) throw bad('not a project file: ' + at + 'review must be an object');
    if (!['asked', 'manual', 'posted'].includes(r.state)) throw bad('not a project file: ' + at + 'review has a bad state');
    when(r.at, at + 'review time');
    o.review = pick({ state: r.state }, { at: str(r.at, at + 'review time', 40), by: str(r.by, at + 'review by', 80), timeline: str(r.timeline, at + 'review timeline', 20000), helped: str(r.helped, at + 'review helped', 20000), runbook: cardId(r.runbook, at + 'review runbook') });
    if (r.actions !== undefined) o.review.actions = list(r.actions, at + 'review actions', 50).map(a => {
      if (!isObj(a)) throw bad('not a project file: ' + at + 'a review action is not an object'); flag(a.ok, at + 'review action ok');
      return pick({ text: str(a.text, at + 'review action', 1000, true) }, { ok: a.ok, card: cardId(a.card, at + 'review action card') });
    });
  }
  if (c.runbookProposal !== undefined) {
    const r = c.runbookProposal; if (!isObj(r)) throw bad('not a project file: ' + at + 'runbookProposal must be an object');
    flag(r.done, at + 'runbook done');
    o.runbookProposal = pick({ name: str(r.name, at + 'runbook name', 120, true), text: str(r.text, at + 'runbook text', 50000) }, { from: cardId(r.from, at + 'runbook from'), done: r.done });   // no file path
  }
  if (c.runbook !== undefined) o.runbook = str(c.runbook, at + 'runbook', 120);
  if (c.ci !== undefined) o.ci = list(c.ci, at + 'ci', 200).map(x => { const s = str(x, at + 'ci item', 20); if (!CI_ID.test(s)) throw bad('not a project file: ' + at + 'has a bad item id'); return s.toLowerCase(); });
  if (c.desk !== undefined) {
    const d = c.desk; if (!isObj(d)) throw bad('not a project file: ' + at + 'desk must be an object');
    flag(d.auto, at + 'desk auto'); flag(d.ai, at + 'desk ai');
    o.desk = pick({ kind: str(d.kind, at + 'desk kind', 40, true) }, { auto: d.auto, ai: d.ai, was: str(d.was, at + 'desk was', 40), linked: cardId(d.linked, at + 'desk linked') });
    if (d.dup !== undefined) { if (!isObj(d.dup)) throw bad('not a project file: ' + at + 'desk dup must be an object'); o.desk.dup = { id: cardId(d.dup.id, at + 'desk dup'), how: str(d.dup.how, at + 'desk dup how', 20) }; }
    if (d.cand !== undefined) o.desk.cand = list(d.cand, at + 'desk cand', 10).map(x => cardId(x, at + 'desk cand'));
  }
  if (c.major !== undefined) {
    const m = c.major; if (!isObj(m)) throw bad('not a project file: ' + at + 'major must be an object');
    flag(m.swarm, at + 'major swarm'); flag(m.alerted, at + 'major alerted'); when(m.at, at + 'major time'); when(m.nudged, at + 'major nudge');
    o.major = pick({}, { at: str(m.at, at + 'major time', 40), by: str(m.by, at + 'major by', 80), swarm: m.swarm, alerted: m.alerted, nudged: str(m.nudged, at + 'major nudge', 40) });
  }
  if (c.ciWatch !== undefined) {
    const w = c.ciWatch; if (!isObj(w) || !CI_ID.test(String(w.ci)) || !['expiry', 'backup', 'restore'].includes(w.why)) throw bad('not a project file: ' + at + 'ciWatch is not valid');
    o.ciWatch = { ci: String(w.ci).toLowerCase(), why: w.why };
  }
}
// The project's configuration items and releases.
function ciItems(v) {
  return list(v, 'the configuration items', 200).map((x, i) => {
    const at = 'item #' + (i + 1); if (!isObj(x)) throw bad('not a project file: ' + at + ' is not an item');
    const id = str(x.id, at + ' id', 20, true); if (!CI_ID.test(id)) throw bad('not a project file: ' + at + ' has a bad id');
    if (!CI_KINDS.includes(x.kind)) throw bad('not a project file: ' + at + ' has a bad kind');
    const o = { id: id.toLowerCase(), kind: x.kind, name: str(x.name, at + ' name', 120, true), detail: str(x.detail, at + ' detail', 500) };
    const exp = day(x.expires, at + ' expires'); if (exp) o.expires = exp;
    if (x.backup !== undefined) {
      const b = x.backup; if (!isObj(b)) throw bad('not a project file: ' + at + ' backup must be an object');
      if (!Number.isInteger(b.everyDays) || b.everyDays < 1 || b.everyDays > 3650) throw bad('not a project file: ' + at + ' has a bad backup interval');
      o.backup = pick({ where: str(b.where, at + ' backup place', 200, true), everyDays: b.everyDays }, { last: day(b.last, at + ' backup date'), since: day(b.since, at + ' backup start') });
    }
    o.links = list(x.links, at + ' links', 40).map(l => {
      if (typeof l === 'string') return str(l, at + ' link', 300);
      if (!isObj(l)) throw bad('not a project file: ' + at + ' has a bad link');
      return { card: cardId(l.card, at + ' link card'), type: str(l.type, at + ' link type', 20), at: str(l.at, at + ' link time', 40) };
    });
    return o;
  });
}
function releaseList(v) {
  return list(v, 'the releases', 500).map((r, i) => {
    const at = 'release #' + (i + 1); if (!isObj(r)) throw bad('not a project file: ' + at + ' is not a release');
    when(r.at, at + ' time');
    return pick({ name: str(r.name, at + ' name', 40, true), at: str(r.at, at + ' time', 40), by: str(r.by, at + ' by', 60), cards: list(r.cards, at + ' cards', MAX_CARDS).map(x => cardId(x, at + ' card')), notes: str(r.notes, at + ' notes', 50000) }, { rollback: cardId(r.rollback, at + ' roll-back card') });
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
    for (const k of ['review', 'runbookProposal', 'runbook', 'ci', 'desk', 'major', 'ciWatch']) delete o[k];
    serviceFields(c, id, o);
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
  const ci = ciItems(pr.ci), releases = releaseList(pr.releases);
  if (new Set(ci.map(x => x.id)).size !== ci.length) throw bad('not a project file: an item appears twice');
  const ciN = Number.isInteger(pr.ciN) && pr.ciN > 0 ? pr.ciN : 0;
  const prefixes = new Set(cards.map(c => c.id.split('-')[0]));
  if (prefixes.size > 1) throw bad('not a project file: the cards use more than one key');
  return { name, key, description: str(pr.description, 'the description', 2000), color, emoji, nextId: Number.isInteger(pr.nextId) && pr.nextId > 0 ? pr.nextId : 0, cards, risks, ci, ciN, releases, bytes: budget.used, from: [...prefixes][0] || '' };
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
      const rn = v => v ? renum(String(v).toUpperCase()) : v;   // AIG-1160: card ids inside the service fields follow the new key
      if (card.review) { if (card.review.runbook) card.review.runbook = rn(card.review.runbook); if (card.review.actions) card.review.actions = card.review.actions.map(a => (a.card ? { ...a, card: rn(a.card) } : a)); }
      if (card.runbookProposal && card.runbookProposal.from) card.runbookProposal.from = rn(card.runbookProposal.from);
      if (card.desk) { if (card.desk.linked) card.desk.linked = rn(card.desk.linked); if (card.desk.dup) card.desk.dup = { ...card.desk.dup, id: rn(card.desk.dup.id) }; if (card.desk.cand) card.desk.cand = card.desk.cand.map(rn); }
      card.comments = comments.map(({ files: mf, ...m }) => ({ ...m, ...(mf ? { attachments: put(mf) } : {}) }));
      if (files) card.attachments = put(files);
      return card;
    });
    const top = Math.max(0, ...cards.map(x => Number(x.id.split('-')[1]) || 0));
    save({
      slug, name: c.name, key, description: c.description, path: '',   // no folder until the owner connects one
      ...(c.color ? { color: c.color } : {}), ...(c.emoji ? { emoji: c.emoji } : {}),
      created: now(), updated: now(), nextId: Math.max(c.nextId, top + 1), archived: false,
      ...(c.ci.length ? { ci: c.ci.map(x => ({ ...x, links: x.links.map(l => (typeof l === 'string' ? l : { ...l, card: renum(String(l.card).toUpperCase()) })) })), ciN: Math.max(c.ciN, ...c.ci.map(x => Number(x.id.slice(3)))) } : {}),
      ...(c.releases.length ? { releases: c.releases.map(r => ({ ...r, cards: r.cards.map(x => renum(x.toUpperCase())), ...(r.rollback ? { rollback: renum(r.rollback.toUpperCase()) } : {}) })) } : {}),
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
