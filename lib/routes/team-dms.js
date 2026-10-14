// API routes: team, log, updates feed; private DMs (AIG-110) (split from lib/routes.js, AIG-297).
const emojis = require('../emojis');
const { S, now, load, save, bad, need, heard, gone, nudge, ownerNews, pickAvatar, dm, share, ask } = require('./ctx');

// Every /api/shares route, and ask a mate's list / ✅ / ✋ (AIG-381), is the owner's (AIG-307): the page, or the CLI as the owner, never a team (share.ownerOnly).
// The team's one door, GET /api/projects/:slug/cards/:id/friend, is not under /api/shares and stays open to them.
const ownerOnly = list => list.map(([m, re, fn]) => (re.source.startsWith(String.raw`^\/api\/shares`) || re.source.startsWith(String.raw`^\/api\/dms\/asks`) || re.source.startsWith(String.raw`^\/api\/friend-pics`)) ? [m, re, (a, b, q, req) => { share.ownerOnly(req); return fn(a, b, q, req); }] : [m, re, fn]);

module.exports = function routes() {
return ownerOnly([
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
    // The engine that runs this agent (AIG-704): claude (default, also for entries saved before this) or codex, with Codex's own model ('' = its default).
    if ('engine' in b) { if (!['claude', 'codex', 'gemini', 'copilot', 'cursor'].includes(b.engine)) throw bad('engine must be claude, codex, gemini, copilot or cursor'); m.engine = b.engine; }
    if ('geminiModel' in b) m.geminiModel = String(b.geminiModel || '').trim().slice(0, 80);
    if ('codexModel' in b) m.codexModel = String(b.codexModel || '').trim().slice(0, 80);
    if ('copilotModel' in b) m.copilotModel = String(b.copilotModel || '').trim().slice(0, 80);
    if ('cursorModel' in b) m.cursorModel = String(b.cursorModel || '').trim().slice(0, 80);
    // AIG-1007: a Codex / Gemini agent with no model yet gets the ready-made one for its role (lib/engines.js ROLE_MODELS).
    if (m.engine && m.engine !== 'claude' && m.kind !== 'person' && ('role' in b || 'engine' in b)) {
      const f = m.engine + 'Model', rm = require('../engines').roleModel(m.engine, m.role);
      if (!m[f] && !(f in b) && rm) m[f] = rm;
    }
    // A person on the team (AIG-582): no model, no library picture; may be linked to a friend (a DM contact id); noAi = no agent is woken for their cards.
    if (b.kind === 'person' || m.kind === 'person') {
      m.kind = 'person'; delete m.model;
      if ('friend' in b) { if (b.friend && !require('../dm').contacts().some(c => c.id === b.friend)) throw bad('that friend is not one of your contacts'); if (b.friend) m.friend = b.friend; else delete m.friend; }
      if ('noAi' in b) { if (b.noAi) m.noAi = true; else delete m.noAi; }
    } else if (b.avatar || !m.avatar) pickAvatar(slug, m, b.avatar);   // a library picture the first time (AIG-150), or the one asked for
    m.updated = now();
    save(p);
    return m;
  }],

  // Rename a teammate (AIG-634): { from, to }. The roster entry, the cards assigned to the old name and the project's
  // `renames` list (the brief tells the lead: "use the new name in --as") all follow.
  ['POST', /^\/api\/projects\/([^/]+)\/team\/rename$/, ([slug], b) => {
    const p = need(load(slug));
    const from = String(b.from || '').trim(), to = String(b.to || '').trim().replace(/\s+/g, ' ');
    if (!from || !to) throw bad('from and to are required');
    if (to.length > 60) throw bad('that name is too long');
    const team = p.team || [], m = team.find(x => x.name.toLowerCase() === from.toLowerCase());
    if (!m) throw bad('no teammate called "' + from + '"', 404);
    if (to === m.name) return m;
    if (team.some(x => x !== m && x.name.toLowerCase() === to.toLowerCase())) throw bad('"' + to + '" is already on the team');
    const old = m.name; m.name = to; m.updated = now();
    for (const c of p.cards || []) if (String(c.assignee || '').toLowerCase() === old.toLowerCase()) c.assignee = to;
    p.renames = [...(p.renames || []).filter(r => r.from.toLowerCase() !== to.toLowerCase()).map(r => r.to.toLowerCase() === old.toLowerCase() ? { ...r, to } : r), { from: old, to, at: now() }].slice(-10);
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

  // What the owner did since the team last looked: his comments, verdicts and new cards.
  // ?mark=1 moves the team's "seen" cursor to now (the UI shows "seen by team" from it).
  ['GET', /^\/api\/projects\/([^/]+)\/updates$/, ([slug], _, q) => {
    const p = need(load(slug));
    heard(p.slug, undefined, q.get('wait') === '0' ? false : !!q.get('wait'));   // wait=0: a wait just returned with news (AIG-523)
      // hooks and 'aigile wait' call this: the team's session is alive
    const since = q.get('since') || p.teamSeenAt || '';
    const cards = ownerNews(p, since).map(({ c, items, space }) => ({ id: c.id, title: c.title, status: c.status, prevStatus: c.prevStatus || '', type: c.type, priority: c.priority, items, ...(c.leadChat ? { chat: true } : {}), ...(space ? { space } : {}) }));   // the same rule wakes teams (AIG-272); space: a space this lead leads (AIG-439)
    const am = require('../agentmsg');   // AIG-675: agents' messages, never the owner's
    const msgs = am.pending(p).map(m => ({ from: m.from, to: m.to, text: m.text, at: m.at }));
    const forTeam = p.cards.filter(c => c.status === 'team').map(c => ({ id: c.id, title: c.title, prevStatus: c.prevStatus || '' }));
    if (q.get('mark')) {
      p.teamSeenAt = now(); am.markSeen(p); save(p);
      for (const s of require('../spacelead').ledFrom(p.slug)) { const sp = load(s.slug); if (sp) { sp.teamSeenAt = p.teamSeenAt; save(sp); } }   // 🪐 AIG-439: the spaces it leads are seen too
    }
    // Tidy cards (AIG-234): an owner who writes quick, messy cards can ask leads to neaten each new one first.
    return { project: p.slug, since, cards, msgs, forTeam, chat: require('../leadchat').unanswered(p.slug).length, retro: require('../retro').dueOf(p) ? require('../retro').line(p.slug) : '', tidy: !!(S.localSettings().lead || {}).tidyCards };
  }],
  // AIG-675: one agent writes to another (a roster name, Lead or Scrum Master): { from, to, text }
  ['POST', /^\/api\/projects\/([^/]+)\/agentmsg$/, ([slug], b) => require('../agentmsg').send(slug, b || {})],
  // A session's heartbeat (PostToolUse hook, AIG-447): the CLI's where header marks it live.
  ['GET', /^\/api\/projects\/([^/]+)\/ping$/, ([slug]) => { need(load(slug)); return { ok: true }; }],
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
  // Your picture for a friend or a pending invite (AIG-883): owner only, kept on this board, never sent to the friend.
  ['GET', /^\/api\/friend-pics\/([0-9a-f]{12})$/, ([id]) => ({ __file: require('../friendpics').fileOf(id) })],
  ['GET', /^\/api\/friend-pics\/([0-9a-f]{12})\/theirs$/, ([id]) => ({ __file: require('../friendpics').fileOf(id, true) })],
  ['POST', /^\/api\/friend-pics\/([0-9a-f]{12})$/, ([id], b) => require('../friendpics').set(id, b)],   // { name, type, data: base64 } like /api/me-picture
  ['DELETE', /^\/api\/friend-pics\/([0-9a-f]{12})$/, ([id]) => require('../friendpics').remove(id)],
  ['POST', /^\/api\/dms\/invites$/, (_, b) => dm.createInvite(b)],   // { name? } of the person it's for
  ['POST', /^\/api\/dms\/accept$/, (_, b) => dm.acceptInvite(b)],    // { code, name, me? }
  ['GET', /^\/api\/dms\/contacts$/, () => dm.contacts()],
  ['PATCH', /^\/api\/dms\/contacts\/([^/]+)$/, ([id], b) => dm.patchContact(id, b)],   // { name?, checked?, blocked? }
  ['DELETE', /^\/api\/dms\/contacts\/([^/]+)$/, ([id]) => dm.removeContact(id)],
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/messages$/, ([id]) => dm.messages(id)],
  ['POST', /^\/api\/dms\/contacts\/([^/]+)\/messages$/, ([id], b) => dm.send(id, b)],   // { text }
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/files\/([^/]+)$/, ([id, fid]) => ({ __file: dm.fileOf(id, fid) })],   // an attachment of a DM
  // Custom emojis a friend sent (AIG-650): list, picture, and Save into my own list ({ as? } = a new name).
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/emojis$/, ([id]) => { dm.contactRaw(id); return emojis.listFrom(id); }],
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/emojis\/([a-z0-9_]+)$/, ([id, n]) => { dm.contactRaw(id); const f = emojis.fileFrom(id, n); if (!f) throw bad('no such emoji', 404); return { __file: f }; }],
  ['POST', /^\/api\/dms\/contacts\/([^/]+)\/emojis\/([a-z0-9_]+)\/save$/, ([id, n], b) => { dm.contactRaw(id); return emojis.saveFrom(id, n, b); }],
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/usage$/, ([id]) => require('../usageshare').glance(id)],   // the token use this friend shares with me (AIG-686)
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/messages\/([^/]+)\/raw$/, ([id, mid]) => dm.rawMessage(id, mid)],   // what the relay sees

  /* ---------- sharing a project (AIG-304) ---------- */
  // Links between my project and a friend's, over the DMs (lib/share.js, docs/SHARING-DESIGN.md).
  ['GET', /^\/api\/shares$/, (_, __, q) => share.list(q.get('slug') || '')],
  ['POST', /^\/api\/shares$/, (_, b) => share.offer(b)],   // { slug, contact, allow? }: needs a checked safety code
  ['PATCH', /^\/api\/shares\/([^/]+)$/, ([id], b) => share.patch(id, b)],   // { on }: the project's 🔗 switch; { teamRead }; { role } (AIG-307)
  ['POST', /^\/api\/shares\/([^/]+)\/accept$/, ([id], b) => share.accept(id, b)],   // { slug, allow? }
  ['POST', /^\/api\/shares\/([^/]+)\/decline$/, ([id]) => share.decline(id)],
  ['POST', /^\/api\/shares\/([^/]+)\/ping$/, ([id]) => share.ping(id)],   // 👋 check the link
  ['POST', /^\/api\/shares\/([^/]+)\/unlink$/, ([id], b) => share.unlink(id, b)],   // { forget? }
  // Shared cards and comments (AIG-305). Friend text lives only in the link file and these routes, never in a project.
  ['GET', /^\/api\/shares\/([^/]+)\/preview$/, ([id], _, q) => share.preview(id, q.get('card'))],   // exactly what 🔗 would send
  ['POST', /^\/api\/shares\/([^/]+)\/cards$/, ([id], b) => share.shareCard(id, b)],   // { card, force? }: tick 🔗 (again: update)
  ['DELETE', /^\/api\/shares\/([^/]+)\/cards\/([^/]+)$/, ([id, card]) => share.unshareCard(id, card)],   // untick 🔗
  ['PATCH', /^\/api\/shares\/([^/]+)\/cards\/([^/]+)$/, ([id, card], b) => share.assignCard(id, card, b)],   // { assigned }: a Member / Tester acts on it (AIG-307)
  ['POST', /^\/api\/shares\/([^/]+)\/held$/, ([id], b) => share.sendHeld(id, b)],   // { card, at }: send a held comment anyway
  ['GET', /^\/api\/shares\/([^/]+)\/inbound$/, ([id]) => share.inbound(id)],   // the 📥 lane and their comments
  ['POST', /^\/api\/shares\/([^/]+)\/inbound\/([^/]+)\/comments$/, ([id, s], b) => share.laneComment(id, s, b)],   // { text, force? }
  ['GET', /^\/api\/shares-approvals$/, () => ({ cards: require('../approvals').list() })],   // AIG-815: every card waiting for my OK
  ['POST', /^\/api\/shares\/([^/]+)\/inbound\/([^/]+)\/approve$/, ([id, s]) => require('../approvals').approve(id, s)],   // AIG-814
  ['POST', /^\/api\/shares\/([^/]+)\/inbound\/([^/]+)\/decline$/, ([id, s], b) => require('../approvals').decline(id, s, b)],   // { note }
  ['POST', /^\/api\/shares\/([^/]+)\/inbound\/([^/]+)\/take$/, ([id, s]) => share.takeCard(id, s)],   // into my backlog
  // AIG-324: a project a friend shares with me, as its own board, and what the role they gave me lets me do there.
  ['GET', /^\/api\/shares\/([^/]+)\/board$/, ([id]) => share.boardView(id)],
  ['POST', /^\/api\/shares\/([^/]+)\/raise$/, ([id], b) => share.raise(id, b)],   // { type, title, description?, force? }
  ['POST', /^\/api\/shares\/([^/]+)\/vote$/, async ([id], b) => {   // AIG-858: my go / no-go on a change card on THEIR board { change: 'AIG-12', go, note }
    const base = require('../share-base'), L = base.link(id);
    if (L.state !== 'live') throw bad('this link is not live', 409);
    const note = base.cleanText((b || {}).note).trim().slice(0, 500);
    if (!/^[A-Za-z0-9]{1,8}-\d{1,9}$/.test(String((b || {}).change || ''))) throw bad('change is a card id like AIG-12', 400);
    if (typeof b.go !== 'boolean') throw bad('go is true or false', 400);
    if (!b.go && !note) throw bad('a No go needs a note', 400);
    await base.sendOn(id, 'vote', { change: b.change, go: b.go, ...(note ? { note } : {}) });
    return { sent: true };
  }],
  ['POST', /^\/api\/shares\/([^/]+)\/request$/, ([id], b) => share.request(id, b)],   // AIG-846: { title, want, why?, custom?, force? }
  ['POST', /^\/api\/shares\/([^/]+)\/board\/([^/]+)\/comments$/, ([id, s], b) => share.boardComment(id, s, b)],   // { text, force? }
  ['POST', /^\/api\/shares\/([^/]+)\/board\/([^/]+)\/status$/, ([id, s], b) => share.boardStatus(id, s, b)],   // { status }
  // AIG-306: tests handed to the friend and their verdicts (labels only), their attachments (downloads, data only),
  // and what a team is given about a shared card (friend text fenced, or only that there is some).
  ['POST', /^\/api\/shares\/([^/]+)\/test$/, ([id], b) => share.handTest(id, b)],   // { card, text, force? }
  ['POST', /^\/api\/shares\/([^/]+)\/inbound\/([^/]+)\/verdict$/, ([id, s], b) => share.laneVerdict(id, s, b)],   // { verdict: accept|back, note?, force? }
  ['GET', /^\/api\/shares\/([^/]+)\/files\/([^/]+)$/, ([id, f]) => share.friendFile(id, f)],
  ['GET', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/friend$/, ([slug, card]) => share.teamView(slug, card)],

  /* ---------- ask a mate (AIG-210) ---------- */
  // A friend's short question for my AI (lib/ask.js): it waits for my ✅ / ✋; ✅ starts one capped, tool-less run.
  ['POST', /^\/api\/dms\/contacts\/([^/]+)\/ask$/, ([id], b) => ask.ask(id, b)],   // { text }: ask their AI (up to 1000 characters)
  // Closed alpha invites (AIG-347, lib/join.js): one-use links for friends to download the app.
  ['GET', /^\/api\/join$/, () => require('../join').list()],
  ['POST', /^\/api\/join\/codes$/, (_, b) => require('../join').make(b)],   // { help: 1|2|3, name? }
  ['POST', /^\/api\/join\/settings$/, (_, b) => require('../join').setUrl(b)],   // { url, site? }: the join service and test site addresses
  ['POST', /^\/api\/join\/site$/, (_, b) => require('../join').makeSite(b)],   // 🌐 test site pass (AIG-699): { name? }
  ['POST', /^\/api\/join\/revoke$/, (_, b) => require('../join').revoke(b)],   // { code }: end that site pass
  ['GET', /^\/api\/dms\/asks$/, () => ({ asks: ask.pending(), ...ask.askStatus() })],
  ['POST', /^\/api\/dms\/asks\/([^/]+)\/([^/]+)\/yes$/, ([cid, id]) => ask.approve(cid, id)],
  ['POST', /^\/api\/dms\/asks\/([^/]+)\/([^/]+)\/no$/, ([cid, id]) => ask.decline(cid, id)],

]);
};
