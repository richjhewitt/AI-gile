// API routes: team, log, updates feed; private DMs (AIG-110) (split from lib/routes.js, AIG-297).
const { S, now, load, save, bad, need, heard, gone, nudge, ownerNews, pickAvatar, dm, share } = require('./ctx');

module.exports = function routes() {
return [
  /* ---------- team, log, updates feed ---------- */
  // Team roster: upsert by name. { name, model?, role?, task?, status?, avatar? }
  ['POST', /^\/api\/projects\/([^/]+)\/team$/, ([slug], b) => {
    const p = need(load(slug));
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    p.team = p.team || [];
    let m = p.team.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!m) { m = { name }; p.team.push(m); }
    for (const k of ['model', 'role', 'task', 'status']) if (k in b) m[k] = b[k];
    if (b.avatar || !m.avatar) pickAvatar(slug, m, b.avatar);   // a library picture the first time (AIG-150), or the one asked for
    m.updated = now();
    save(p);
    return m;
  }],

  // Project log: { author, text, kind?: 'log' | 'decision' }
  ['POST', /^\/api\/projects\/([^/]+)\/log$/, ([slug], b) => {
    const p = need(load(slug));
    const text = String(b.text || '').trim();
    if (!text) throw bad('text is required');
    const entry = { at: now(), author: String(b.author || S.owner()), kind: b.kind === 'decision' ? 'decision' : 'log', text };
    (p.log = p.log || []).push(entry);
    save(p);
    return entry;
  }],

  // What Rich did since the team last looked: his comments, verdicts and new cards.
  // ?mark=1 moves the team's "seen" cursor to now (the UI shows "seen by team" from it).
  ['GET', /^\/api\/projects\/([^/]+)\/updates$/, ([slug], _, q) => {
    const p = need(load(slug));
    heard(p.slug, undefined, !!q.get('wait'));   // hooks and 'aigile wait' call this: the team's session is alive
    const since = q.get('since') || p.teamSeenAt || '';
    const cards = ownerNews(p, since).map(({ c, items }) => ({ id: c.id, title: c.title, status: c.status, prevStatus: c.prevStatus || '', type: c.type, priority: c.priority, items }));   // the same rule wakes teams (AIG-272)
    const forTeam = p.cards.filter(c => c.status === 'team').map(c => ({ id: c.id, title: c.title, prevStatus: c.prevStatus || '' }));
    if (q.get('mark')) { p.teamSeenAt = now(); save(p); }
    // Tidy cards (AIG-234): an owner who writes quick, messy cards can ask leads to neaten each new one first.
    return { project: p.slug, since, cards, forTeam, tidy: !!(S.localSettings().lead || {}).tidyCards };
  }],
  // The team's window closed (SessionEnd hook, AIG-219): a background run picks up whatever is still for the team.
  ['POST', /^\/api\/projects\/([^/]+)\/bye$/, ([slug]) => {
    const p = need(load(slug));
    gone(p.slug);
    const left = p.cards.some(c => c.status === 'team');
    if (left) nudge(p.slug);
    return { ok: true, woke: left };
  }],

  /* ---------- private DMs (AIG-110) ---------- */
  // End-to-end encrypted messages between people's boards, through a relay (lib/dm.js, docs/DMS-DESIGN.md).
  ['GET', /^\/api\/dms$/, () => dm.status()],
  ['POST', /^\/api\/dms\/settings$/, (_, b) => dm.setSettings(b)],   // { on?, relay? }: on: false is the killswitch
  ['POST', /^\/api\/dms\/check$/, (_, b) => dm.checkRelay(b)],   // { relay? }: fetch <relay>/health -> { ok, reason? }
  ['POST', /^\/api\/dms\/poll$/, () => dm.poll()],
  ['POST', /^\/api\/dms\/invites$/, (_, b) => dm.createInvite(b)],   // { name? } of the person it's for
  ['POST', /^\/api\/dms\/accept$/, (_, b) => dm.acceptInvite(b)],    // { code, name, me? }
  ['GET', /^\/api\/dms\/contacts$/, () => dm.contacts()],
  ['PATCH', /^\/api\/dms\/contacts\/([^/]+)$/, ([id], b) => dm.patchContact(id, b)],   // { name?, checked?, blocked? }
  ['DELETE', /^\/api\/dms\/contacts\/([^/]+)$/, ([id]) => dm.removeContact(id)],
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/messages$/, ([id]) => dm.messages(id)],
  ['POST', /^\/api\/dms\/contacts\/([^/]+)\/messages$/, ([id], b) => dm.send(id, b)],   // { text }
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/files\/([^/]+)$/, ([id, fid]) => ({ __file: dm.fileOf(id, fid) })],   // an attachment of a DM
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/messages\/([^/]+)\/raw$/, ([id, mid]) => dm.rawMessage(id, mid)],   // what the relay sees

  /* ---------- sharing a project (AIG-304) ---------- */
  // Links between my project and a friend's, over the DMs (lib/share.js, docs/SHARING-DESIGN.md).
  ['GET', /^\/api\/shares$/, (_, __, q) => share.list(q.get('slug') || '')],
  ['POST', /^\/api\/shares$/, (_, b) => share.offer(b)],   // { slug, contact, allow? }: needs a checked safety code
  ['PATCH', /^\/api\/shares\/([^/]+)$/, ([id], b) => share.patch(id, b)],   // { on }: the project's 🔗 switch
  ['POST', /^\/api\/shares\/([^/]+)\/accept$/, ([id], b) => share.accept(id, b)],   // { slug, allow? }
  ['POST', /^\/api\/shares\/([^/]+)\/decline$/, ([id]) => share.decline(id)],
  ['POST', /^\/api\/shares\/([^/]+)\/ping$/, ([id]) => share.ping(id)],   // 👋 check the link
  ['POST', /^\/api\/shares\/([^/]+)\/unlink$/, ([id], b) => share.unlink(id, b)],   // { forget? }

];
};
