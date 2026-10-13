// API routes: docs and inbox (split from lib/routes.js, AIG-297).
const { fs, spawn, path, S, now, load, save, listSlugs, waitingOnRich, isRich, docList, bad, need, findCard, watchMessages, watchLastNight, watchMarkRead, watchRelay, watchSay, watchBusy, discover, openInEditor, proofOf, findMd, chatCards, chatComments, watchChat, leadOf, picOf } = require('./ctx');

const realAsk = c => c.needsYou && (c.asked || (c.quiz && !c.quiz.done) || c.comments.some(m => m.mark === 'ask'));   // AIG-375: a plain note never makes a question
module.exports = function routes() {
return [
  /* ---------- docs and inbox ---------- */
  // Project docs: the .md files in the project's folder and its docs/ folder (read-only).
  ['GET', /^\/api\/projects\/([^/]+)\/docs$/, ([slug]) => docList(need(load(slug)))],
  ['GET', /^\/api\/projects\/([^/]+)\/docs\/(.+)$/, ([slug, name]) => {
    const p = need(load(slug));
    if (!docList(p).includes(name)) throw bad('doc not found', 404); // whitelist: no path tricks
    return { name, text: fs.readFileSync(path.join(p.path, name), 'utf8') };
  }],

  // Any .md file inside the project folder: relative, project-name-prefixed or absolute path.
  ['GET', /^\/api\/projects\/([^/]+)\/file$/, ([slug], body, q) => {
    const p = need(load(slug));
    const raw = String(q.get('path') || '').trim().replace(/\\/g, '/');
    if (!raw || !/\.md$/i.test(raw)) throw bad('a .md path is required');
    // This project's folder first, then the other projects': a card can mention another project's file
    // (AIG-85). The name then says which project it came from.
    const own = findMd(p.path, raw);
    if (own) return own;
    for (const o of listSlugs().map(load).filter(o => o && o.slug !== p.slug && !o.archived)) {
      const hit = findMd(o.path, raw);
      if (hit) return { ...hit, name: o.name + ': ' + hit.name, project: o.slug };
    }
    throw bad('file not found in any project folder', 404);
  }],

  // Proof on hand-back (AIG-166): { commit } -> the board reads the commit and keeps a short proof on the card.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/proof$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id);
    c.proof = proofOf(p.path, b.commit); c.updated = now(); save(p);
    return c.proof;
  }],

  // 📝 Open a file in the owner's editor (AIG-156): { path }.
  ['POST', /^\/api\/open-file$/, (_, b) => openInEditor(b.path)],

  // ☀️ Start-the-day tasks (AIG-546): open cards marked startDay, across projects. The page shows them when you come back from time away.
  ['GET', /^\/api\/startday$/, () => listSlugs().map(load).filter(p => p && !p.archived).flatMap(p => (p.cards || []).filter(c => c.startDay && c.status !== 'done')
    .map(c => ({ slug: p.slug, project: p.name, id: c.id, title: c.title, status: c.status }))).slice(0, 30)],

  // 💬 Discord bridge (AIG-481): state only (never the token), and a test DM
  ['GET', /^\/api\/discord$/, () => require('../discord').status()],
  ['GET', /^\/api\/discord\/config$/, () => ({ bots: require('../discord').config(), state: require('../discord').status() })],
  ['POST', /^\/api\/discord\/config$/, (_, b) => ({ bots: require('../discord').saveConfig(b.bots) })],
  ['POST', /^\/api\/discord\/test$/, (_, b) => require('../discord').test(b.name)],
  // The Discord tab in the DM window (AIG-557/559): linked? + unread (cheap, polled), the chats and channels, a chat's messages, a reply.
  ['GET', /^\/api\/discord\/unread$/, () => require('../discord').unreadStatus()],
  ['GET', /^\/api\/discord\/chats$/, () => require('../discord').listChats()],
  ['GET', /^\/api\/discord\/messages$/, (_, __, q) => require('../discord').history(q.get('bot'), q.get('channel'))],
  ['POST', /^\/api\/discord\/send$/, (_, b) => require('../discord').send(b.bot, b.channel, b.text)],
  ['POST', /^\/api\/discord\/stub-message$/, (_, b) => require('../discord').stubMessage(b)],   // tests only (AIGILE_DISCORD_STUB)
  ['GET', /^\/api\/twitch\/config$/, () => require('../twitch').config()],
  ['POST', /^\/api\/twitch\/config$/, (_, b) => require('../twitch').saveConfig(b)],
  ['POST', /^\/api\/twitch\/token$/, (_, b) => require('../twitch').saveToken(b || {})],
  ['POST', /^\/api\/twitch\/send$/, (_, b) => require('../twitch').send(b || {})],
  ['GET', /^\/api\/twitch\/stub-sent$/, () => require('../twitch').stubSent()],   // tests only
  ['GET', /^\/api\/twitch\/messages$/, (_, __, q) => require('../twitch').messages(q.get('after'))],
  ['POST', /^\/api\/twitch\/stub-message$/, (_, b) => require('../twitch').stubMessage(b || {})],   // tests only (AIGILE_TWITCH_STUB)
  // ✉️ Mail (AIG-902, lib/mail.js): the password never comes out; saving and testing take the secrets page token.
  ['GET', /^\/api\/mail\/config$/, () => require('../mail').config()],
  ['POST', /^\/api\/mail\/config$/, (_, b, q, req) => require('../mail').save(req, b || {})],
  ['POST', /^\/api\/mail\/test$/, (_, b, q, req) => require('../mail').test(req, b || {})],
  ['POST', /^\/api\/mail\/find$/, (_, b) => require('../mail').find(b || {})],
  ['GET', /^\/api\/mail\/inbox$/, (_, __, q) => require('../mail').inbox(q.get('box') || '', q.get('fresh') === '1')],
  ['POST', /^\/api\/mail\/forget$/, (_, b) => require('../mail').forget(String((b || {}).box || ''))],

  // 🌙 Assumptions log (AIG-477)
  ['GET', /^\/api\/assumptions$/, () => require('../assumptions').list()],
  ['POST', /^\/api\/assumptions\/resolve$/, (_, b) => require('../assumptions').resolve(b)],
  ['GET', /^\/api\/assumptions\/summary$/, (_, __, q) => require('../assumptions').summary(q.get('ai') === '1')],   // AIG-781

  // 🖥️ My servers (AIG-374): the Desktop shortcuts to pick from, and open a saved server by name.
  ['GET', /^\/api\/servers\/shortcuts$/, () => require('../servers').shortcuts()],
  ['POST', /^\/api\/servers\/open$/, (_, b) => require('../servers').open(b.name)],
  // ✏️ Small code editor (AIG-536): the board page only (the terminal's token); lib/editor.js has the fence.
  ['POST', /^\/api\/editor\/read$/, (_, b, q, req) => { require('../terminal').gate(req, b.token); return require('../editor').read(b); }],
  ['POST', /^\/api\/editor\/save$/, (_, b, q, req) => { require('../terminal').gate(req, b.token); return require('../editor').save(b); }],
  ['POST', /^\/api\/editor\/quick$/, (_, b, q, req) => { require('../terminal').gate(req, b.token); return require('../editor').quick(b.project); }],

  // 🔑 Secrets (AIG-585..587, lib/secrets.js has the fence): names only come out; a value goes in from the board page (its token) and
  // out only as a one-use file for `aigile secret run`.
  ['GET', /^\/api\/secrets\/token$/, (_, b, q, req) => require('../secrets').token(req)],
  ['GET', /^\/api\/secrets$/, () => require('../secrets').list()],
  ['POST', /^\/api\/secrets\/save$/, (_, b, q, req) => { const X = require('../secrets'); X.gate(req, b.token); return X.put(b); }],
  ['POST', /^\/api\/secrets\/delete$/, (_, b, q, req) => { const X = require('../secrets'); X.gate(req, b.token); return X.forget(String(b.slug || ''), String(b.name || '')); }],
  ['POST', /^\/api\/secrets\/hours$/, (_, b, q, req) => { const X = require('../secrets'); X.gate(req, b.token); return X.setHours(b.hours); }],
  ['POST', /^\/api\/secrets\/grant$/, (_, b, q, req) => require('../secrets').grantRoute(req, String(b.slug || ''), String(b.name || ''), b)],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/secret-ask$/, ([slug, id], b) => require('../secrets').ask(slug, id, b)],

  // ⌨ The built-in terminal (AIG-471): the board page only, with its token (lib/terminal.js has the fence).
  ['GET', /^\/api\/terminal\/token$/, (_, b, q, req) => require('../terminal').token(req)],
  ['POST', /^\/api\/terminal\/install$/, (_, b, q, req) => { const T = require('../terminal'); T.gate(req, b.token); return T.install(); }],
  ['POST', /^\/api\/terminal\/open$/, (_, b, q, req) => { const T = require('../terminal'); T.gate(req, b.token); return T.open(b); }],
  ['GET', /^\/api\/terminal\/([^/]+)\/([^/]+)\/stream$/, ([slug, id], b, q, req) => { const T = require('../terminal'); T.gate(req, q.get('token')); return { __sse: T.stream(T.sessionOf(slug, id)) }; }],
  ['POST', /^\/api\/terminal\/([^/]+)\/([^/]+)\/(input|resize|run|stop|close)$/, ([slug, id, what], b, q, req) => {
    const T = require('../terminal'); T.gate(req, b.token);
    const s = T.sessionOf(slug, id);
    return what === 'input' ? T.input(s, b.data) : what === 'resize' ? T.resize(s, b) : what === 'run' ? T.run(s, b) : what === 'stop' ? T.stop(s) : (T.close(s), { ok: true });
  }],
  // The transcript, ANSI stripped, for the lead: `aigile termlog <proj> <id>`.
  ['GET', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/termlog$/, ([slug, id]) => require('../terminal').termlog(slug, id)],

  // New user mode (AIG-94): the projects found in a folder (default: the folder AI-gile sits in).
  ['GET', /^\/api\/discover$/, (_, __, q) => discover(q.get('dir') || undefined)],

  // ▶ Open it (AIG-146): start the app with the card's start command if its page doesn't answer yet (the owner
  // confirms the command first), then wait until it does. The page itself opens in the owner's browser.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/openit$/, async ([slug, id]) => {
    const p = need(load(slug)), c = findCard(p, id);
    if (!c.openUrl) throw bad('this card has no address to open');
    const answers = async () => { try { await fetch(c.openUrl, { signal: AbortSignal.timeout(1500) }); return true; } catch { return false; } };
    if (await answers()) return { url: c.openUrl, started: false };
    if (!c.startCmd) throw bad("the page doesn't answer and the card has no start command");
    if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first');
    // Windows (AIG-462): a detached start command gets a console window of its own; start it hidden, outside the board's job.
    if (process.platform === 'win32') { const log = path.join(require('os').tmpdir(), `aigile-open-${slug}.log`); await require('../presence').spawnHidden(c.startCmd, [], { cwd: p.path, env: process.env, out: log, err: log, shell: true }); }
    else spawn(c.startCmd, { cwd: p.path, shell: true, detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); if (await answers()) return { url: c.openUrl, started: true }; }
    throw bad('started it, but the page still does not answer after a minute');
  }],

  // A lead starting a DM (AIG-140): only when the owner switched on a chatty lead. It's a closed card, so it
  // shows in the chat without adding to the board.
  ['POST', /^\/api\/projects\/([^/]+)\/dm$/, ([slug], b) => {
    const p = need(load(slug)), text = String(b.text || '').trim(), author = String(b.author || '').trim() || 'Lead';
    if (!p.chatty) throw bad('chatty lead is off for this project (🎨 Look)');
    if (!text) throw bad('text is required');
    const c = { id: p.key + '-' + p.nextId++, title: '💬 ' + text.split('\n')[0].slice(0, 80), description: text, testSteps: '', type: 'task', priority: 'low', status: 'done',
      assignee: '', sprint: '', blocked: false, needsYou: false, quick: true, dm: true, createdBy: author, created: now(), updated: now(), comments: [] };
    p.cards.push(c); save(p);
    return c;
  }],

  // 💬 DM me about this (AIG-684): the owner asks an agent (the lead, a teammate, or a named team) to open a DM about a card.
  // It opens a chat message "About AIG-1: title" (a quick card, so it is a fold in Messages) and wakes that agent with a
  // short prompt line (dispatch.setHint). The agent answers with the usual `aigile comment <proj> <dm card> "..." --as NAME`.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/dmme$/, ([slug, id], b) => {
    require('../notokens').guard();   // also refuses in No AI mode
    const p = need(load(slug)), card = findCard(p, id), lead = leadOf(p);
    const who = String(b.who || '').trim().slice(0, 80) || lead;
    const text = require('../i18n').t('srv.dmme.about', { id: card.id, title: card.title });
    const c = { id: p.key + '-' + p.nextId++, title: '💬 ' + text.slice(0, 120), description: text + '\n\n[' + card.id + '](#/p/' + slug + '/' + card.id + ')', testSteps: '', type: 'task', priority: 'low', status: 'team',
      assignee: '', sprint: '', blocked: false, needsYou: false, quick: true, dmAbout: card.id, dmWith: who, createdBy: S.owner(), created: now(), updated: now(), comments: [] };
    p.cards.push(c); save(p);
    let woke = false, why = '';
    try {
      require('../dispatch').setHint(slug, `Dispatcher: the owner asked ${who} to DM them about ${card.id}. Run \`aigile show ${slug} ${card.id}\` to read it, then open the conversation with the owner in the DM card ${c.id}: \`aigile comment ${slug} ${c.id} "..." --as "${who}"\`. If you are not ${who}, answer as that role. Start with a short, useful opener, not a question about what they want.`);
      const r = require('../presence').startTeam(load(slug), true, false, undefined, false, true, true);
      woke = !!(r && (r.running || r.queued || r.terminal || r.opened));
    } catch (e) { why = e.message; }
    return { ok: true, dm: c.id, who, woke, ...(why ? { why } : {}) };
  }],

  // 📜 Team news (AIG-319): every comment on the project's cards, newest first (the pop-out #/pop-news/<slug>).
  ['GET', /^\/api\/projects\/([^/]+)\/news$/, ([slug]) => {
    const p = need(load(slug));
    return p.cards.flatMap(c => c.comments.map(m => ({ card: c.id, title: c.title, author: m.author, text: m.text, at: m.at, mine: isRich(m.author) })))
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
  }],

  // DMs with the team leads (AIG-137/138): one chat per project. A chat holds the owner's quick questions
  // and the team's questions to the owner, as messages; "open" ones are still waiting on the owner.
  // 🌙 While you are going quiet (AIG-211) only the night watchman's chat is listed: the leads' wait for the morning.
  // Awake: the 🧭 Lead Scrum Master's chat (with last night's messages until cleared, AIG-283) is listed below the leads.
  ['GET', /^\/api\/chats$/, () => { if (require('../noai').isOn()) return [require('../smcmd').chat()]; const wm = watchMessages(); if (wm) return [watchChat(wm)]; const night = watchLastNight(); return [...S.byOrder(listSlugs().map(load).filter(p => p && !p.archived).map(p => {
    const open = p.cards.filter(c => c.status !== 'done' && c.status !== 'verify' && realAsk(c) && !c.blocked);
    const last = chatCards(p).flatMap(c => chatComments(c, p).map(m => m.at)).sort().pop() || null;
    return { slug: p.slug, name: p.name, ...S.look(p), lead: leadOf(p), leadPic: picOf(p, leadOf(p)), unread: open.length, last };
  })), watchChat(night || [])]; }],   // 🧭 always listed by day, so you can write to it (AIG-359)
  ['GET', /^\/api\/chats\/_watchman$/, () => {
    if (require('../noai').isOn()) return require('../smcmd').thread();   // 🧭 No AI (AIG-729): fixed commands in plain code, no model
    const wm = watchMessages() || watchLastNight() || [];
    watchMarkRead();   // opening the chat reads it (AIG-278)
    return { ...watchChat(wm), open: [], cards: { _night: { title: 'Tonight', kind: 'other' } }, busy: watchBusy(), sm: require('../scrummaster').status(),
      messages: wm.map(m => ({ card: '_night', title: 'Tonight', author: m.author || '🧭 Lead Scrum Master', text: m.text, at: m.at, mine: !!m.mine, pick: m.pick, attachments: m.attachments, auto: m.auto })) };
  }],
  // Write to the watchman (AIG-221): it passes the message on to one team, or all of them.
  ['POST', /^\/api\/chats\/_watchman\/request$/, (_, b) => { if (!require('../noai').isOn()) throw bad('requests are for the No AI Scrum Master', 409); return require('../smcmd').request(b.kind, b, b.project); }],   // AIG-731
  ['POST', /^\/api\/chats\/_watchman$/, (_, b) => require('../noai').isOn() ? require('../smcmd').handle(b.text, b.project) : watchRelay(b.text, b.attachments, !!b.anyway)],
  ['POST', /^\/api\/chats\/_watchman\/say$/, (_, b) => watchSay(b.text, b.options)],   // the watchman agent's answer (AIG-262)
  // AIG-319: the chat is just the owner and the lead. A 💬 card shows in full; a question card only shows the owner's
  // replies, the question each one answered and the question still waiting. Folds, tester notes and handovers go to 📜 Team news.
  ['GET', /^\/api\/chats\/([^/]+)$/, ([slug]) => {
    if (slug === '_allhands') return listSlugs().map(load).filter(p => p && !p.archived).flatMap(p =>
      p.cards.filter(c => c.allhands).map(c => {
        const reply = c.comments.filter(m => !isRich(m.author)).sort((a, b) => b.at.localeCompare(a.at))[0];
        return { slug: p.slug, project: p.name, id: c.id, title: c.title, reply, at: reply ? reply.at : c.created };
      })).sort((a, b) => b.at.localeCompare(a.at));
    const p = need(load(slug)), since = new Date(Date.now() - 30 * 864e5).toISOString();
    // AIG-811: the lead tidies a hurried card (bullets) and keeps his words in an "Original: ..." comment. In the chat that showed
    // the same message twice, so his own words stand in for the tidied description and the Original comment is skipped.
    const isOrig = m => !isRich(m.author) && /^\s*Original:/i.test(m.text || '');
    const messages = chatCards(p).flatMap(c => {
      const cm = chatComments(c, p), orig = c.quick && cm.find(isOrig);
      return [
      ...(c.quick && c.created >= since ? [{ card: c.id, title: c.title, author: c.createdBy || S.owner(), text: orig ? orig.text.replace(/^\s*Original:\s*/i, '') : c.description, at: c.created, attachments: c.attachments }] : []),
      ...cm.filter(m => m.at >= since && m !== orig).map(m => ({ card: c.id, title: c.title, author: m.author, text: m.text, at: m.at, attachments: m.attachments, options: m.options, auto: m.auto })),
    ]; }).map(m => ({ ...m, mine: isRich(m.author) })).sort((a, b) => a.at.localeCompare(b.at));
    const open = p.cards.filter(c => c.status !== 'done' && c.status !== 'verify' && realAsk(c) && !c.blocked).sort((a, b) => b.updated.localeCompare(a.updated)).map(c => ({ id: c.id, title: c.title }));
    // Each card in the chat (AIG-157): what kind it is and whether it's waiting on the owner, for the folds.
    const cards = Object.fromEntries([...new Set(messages.map(m => m.card))].map(id => { const c = p.cards.find(x => x.id === id) || {};
      return [id, { title: c.title, kind: c.status === 'verify' ? 'test' : realAsk(c) ? 'question' : c.quick ? 'idea' : 'other', waiting: open.some(o => o.id === id), done: c.status === 'done', ...(c.followUp && p.cards.some(x => x.id === c.followUp) ? { followUp: { id: c.followUp, title: p.cards.find(x => x.id === c.followUp).title } } : {}) }]; }));
    return { slug: p.slug, key: p.key, name: p.name, ...S.look(p), lead: leadOf(p), leadPic: picOf(p, leadOf(p)), team: (p.team || []).map(m => ({ name: m.name, avatar: m.avatar })), messages, open, cards };
  }],

  // Everything waiting on the owner, across all projects.
  ['GET', /^\/api\/inbox$/, () =>
    (S.clearMorning(), listSlugs()).map(load).filter(p => p && !p.archived).flatMap(p =>
      p.cards.filter(waitingOnRich)
        .map(c => ({ project: p.slug, projectName: p.name, projectColor: S.look(p).color, projectEmoji: S.look(p).emoji, projectRank: (i => i < 0 ? 1e6 : i)(S.projectOrder().indexOf(p.slug)), projectLogo: S.look(p).logo, ...c })))
      .sort((a, b) => (b.bumpedAt || '').localeCompare(a.bumpedAt || '') || a.updated.localeCompare(b.updated))], // a queue: a bumped reminder first (AIG-373), then longest-waiting first
];
};
