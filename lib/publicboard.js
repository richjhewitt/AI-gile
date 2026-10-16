// 🌍 Public boards (AIG-602..605): a project marked Public is published to the relay (relay/relay.js, GET /b/<name>) as a clean
// snapshot that viewers watch live. Private is the default; a project is never both Private (🔒, hidden while streaming) and Public.
// What goes out: the project name, the columns, and per card its id, title, type, priority, status and assignee, and the team
// roster (name and role). Left out on purpose: descriptions, test steps, comments, checklists, cards ticked "Hide from public",
// life cards, quick DM questions, secrets, DMs, picture files. Every text runs through lib/mask.js (the page's Streamer.mask) first.
// Publishing is signed with this board's relay key (lib/dm.js relayCall, the same Ed25519 key as the mailbox), so the relay
// gives the name to the first key and only that key can update or delete it. A change is sent about 3 s after the last one.
const crypto = require('crypto');
const { load, bad } = require('./store');

const DEFAULT_COLS = [['backlog', 'Backlog'], ['todo', 'To do'], ['doing', 'In progress'], ['review', 'Team checking'], ['verify', 'For you to test'], ['team', 'For the team'], ['done', 'Done']];
const NAME_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const MS = () => Number(process.env.AIGILE_PUBLIC_MS) || 3000;
const state = new Map();   // slug -> { hash, name, at, error, viewers }
const timers = new Map();
const dm = () => require('./dm');
const relay = () => { const r = dm().relayAddress(); if (!r) throw new Error('set the relay address in Setup (DMs) first'); return r; };

function defaultName(p) {
  const n = String(p.slug || p.name || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return n.length >= 3 ? n : (n + '-board').slice(0, 40);
}
const nameOf = p => p.publicName || defaultName(p);

function snapshot(p) {
  const mask = require('./mask').make(), m = s => mask(String(s == null ? '' : s));
  const saved = (p.columns || []).filter(c => c && c.status);
  const cols = (saved.length ? saved.map(c => ({ id: c.status, label: ((c.emoji ? c.emoji + ' ' : '') + (c.name || (DEFAULT_COLS.find(d => d[0] === c.status) || [])[1] || c.status)), hidden: !!c.hidden })) : DEFAULT_COLS.map(([id, label]) => ({ id, label }))).filter(c => !c.hidden);
  const shown = new Set(cols.map(c => c.id));
  // AIG-1338: the owner's own 💬 questions stay off only while titles show (their words would go out); with titles hidden they are
  // just bars, so the public board's counts match the real board.
  const cards = (p.cards || []).filter(c => !c.hidePublic && !c.lifeType && (!c.quick || p.publicHideTitles) && shown.has(c.status))
    // 🙈 Titles hidden (AIG-698): no title goes out, only a length step (1-8) so the page can draw a bar of about that size.
    .map(c => ({ id: c.id, ...(p.publicHideTitles ? { title: '', len: Math.max(1, Math.min(8, Math.ceil(String(c.title || '').length / 10))) } : { title: m(c.title) }), type: c.type, priority: c.priority, status: c.status, assignee: m(c.assignee) }));
  // AIG-1257: only the active team goes out, the same rule as the board's Team panel (AIG-1211): working or in review, updated in the last 12 hours.
  // AIG-1344: the one rule in lib/teamlive.js (running now counts too).
  const TL = require('./teamlive'), lctx = TL.ctxOf(p, (() => { try { return require('./presence').presenceOf(p.slug); } catch { return {}; } })()), live = t => TL.live(t, lctx);
  const team = (p.team || []).filter(t => !t.friend && live(t)).map(t => ({ name: m(t.name), role: m(t.role), avatar: '' }));
  return { title: m(p.name), titlesHidden: !!p.publicHideTitles || undefined, columns: cols.map(c => ({ id: c.id, label: m(c.label) })), cards, team };
}
const hashOf = s => crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex');

async function publish(slug, force) {
  const p = load(slug); if (!p || !p.public) return;
  const name = nameOf(p), snap = snapshot(p), hash = hashOf(snap), st = state.get(slug) || {};
  if (!force && st.hash === hash && st.name === name && !st.error) return;
  try {
    const r = await dm().relayCall(relay(), 'POST', '/b/' + name, snap);
    state.set(slug, { hash, name, at: new Date().toISOString(), error: '', viewers: r.viewers || 0 });
    if (p.feedback && p.feedback.on) require('./feedback').push(slug).catch(() => {});   // the relay needs to know (AIG-969)
  } catch (e) {   // a name that belongs to another board stays an error; anything else (slow down, relay down) is tried again a few times
    const tries = (st.tries || 0) + 1;
    state.set(slug, { ...st, hash: '', name, error: e.message, tries });
    if (!/another board|private first|set the relay/.test(e.message) && tries <= 5) changed(slug);
  }
}
// A save happened on a public project: send it once things have been quiet for about 3 s.
function changed(slug) {
  clearTimeout(timers.get(slug));
  timers.set(slug, setTimeout(() => { timers.delete(slug); publish(slug).catch(() => {}); }, MS()));
}
async function unpublish(name) {
  try { await dm().relayCall(relay(), 'POST', '/f/' + name + '/config', { on: false }); } catch {}   // no reports for a private name (AIG-969)
  try { await dm().relayCall(relay(), 'DELETE', '/b/' + name); } catch {}
}
// The PATCH route: { public, publicName } and { private } together. Public and Private exclude each other.
function setFlags(p, b) {
  if ([b.public, b.private, b.personal].filter(v => v === true).length > 1) throw bad('a project is either private or public, not both (and personal is on its own too)');
  const was = { on: !!p.public, name: nameOf(p) };
  if ('publicName' in b) {
    const n = String(b.publicName || '').trim().toLowerCase();
    if (n && !NAME_RE.test(n)) throw bad('the public name is 3 to 40 letters, digits or - (like my-board)');
    p.publicName = n || undefined;
  }
  if ('public' in b) p.public = !!b.public || undefined;
  if ('private' in b) p.private = !!b.private || undefined;
  if ('personal' in b) p.personal = !!b.personal || undefined;
  const hideWas = !!p.publicHideTitles;
  if ('publicHideTitles' in b) p.publicHideTitles = !!b.publicHideTitles || undefined;   // 🙈 AIG-698   // 🏡 Personal (AIG-637): life stuff, never shown while streaming
  if (b.public === true) p.private = p.personal = undefined; else if (b.private === true) p.public = p.personal = undefined; else if (b.personal === true) p.public = p.private = undefined;   // the one just ticked wins
  const now = { on: !!p.public, name: nameOf(p) };
  // Done after the route has saved the project.
  setImmediate(() => {
    if (was.on && (!now.on || was.name !== now.name)) { clearTimeout(timers.get(p.slug)); unpublish(was.name); state.delete(p.slug); }
    if (now.on && (!was.on || was.name !== now.name || hideWas !== !!p.publicHideTitles)) publish(p.slug, true).catch(() => {});
  });
}
// For the page: the link, the viewer count (asked from the relay's public JSON) and any error.
async function status(slug) {
  const p = load(slug); if (!p) throw bad('no such project', 404);
  if (!p.public) return { on: false, name: nameOf(p) };
  const name = nameOf(p), st = state.get(slug) || {};
  let base = ''; try { base = relay(); } catch {}
  let viewers = st.viewers || 0, live = false;
  if (base) { try { const r = await fetch(base + '/b/' + name + '.json', { signal: AbortSignal.timeout(4000) }); if (r.ok) { viewers = (await r.json()).viewers || 0; live = true; } } catch {} }
  const shownBase = String(require('./store').localSettings().publicBase || process.env.AIGILE_PUBLIC_BASE || base).replace(/\/+$/, '');
  return { on: true, name, url: shownBase + '/b/' + name, viewers, live, publishedAt: st.at || null, error: st.error || '' };
}
module.exports = { snapshot, publish, changed, unpublish, setFlags, status, nameOf, NAME_RE };
