// API routes: comments, verdicts, tasks, pokes (split from lib/routes.js, AIG-297).
const { S, now, load, save, SNOOZE_MS, waitingOnRich, isRich, toTeam, bad, need, findCard, nudge, saveAttachment, attachmentsFor, fileOf, share } = require('./ctx');
const { thumbOf, seeProject } = require('../attachments');
const uploads = require('../uploads');
const dmrules = require('../dmrules');
const undo = require('../undo');   // ↩ Undo (AIG-403)
const pack = require('../pack');   // the AIGILE pack (AIG-357)
const follow = require('../follow');   // the chat follows the lead (AIG-426)

/* ---------- bump: an open task / question is reminded, never re-sent (AIG-373) ---------- */
// A structured assumption (AIG-526): { decided, options[], chose, why, ifNo }, short strings only.
const cleanAssume = a => {
  const s = v => String(v || '').trim().slice(0, 600), o = {};
  for (const k of ['decided', 'chose', 'why', 'ifNo']) if (s(a[k])) o[k] = s(a[k]);
  const opts = (Array.isArray(a.options) ? a.options : String(a.options || '').split('|')).map(x => s(x).slice(0, 200)).filter(Boolean).slice(0, 8);
  if (opts.length) o.options = opts;
  return o;
};
const norm =s => String(s || '').replace(/\s+/g, ' ').trim();
const UPD = /\n+Updated: [^\n]*$/;
// The open marked comment of this kind on the card, if the owner is still waiting on it (no owner comment after it).
function openMarked(c, mark) {
  const open = mark === 'task' ? isRich(c.assignee) : c.needsYou && !c.blocked;
  if (!open) return null;
  for (let i = c.comments.length - 1; i >= 0; i--) {
    const m = c.comments[i];
    if (isRich(m.author) && (mark !== 'task' || /^✅ Done/.test(m.text))) return null;   // a plain reply doesn't finish a task, only Done does
    if (m.mark === mark) return m;
  }
  return null;
}
// One-off clean-up (AIG-373): open copies of the same task / question (same text once whitespace is tidied) collapse into the newest.
// Returns what it removed; { dry: true } only reports.
function dedupeOpen(c, dry) {
  const out = [];
  for (const mark of ['task', 'ask']) {
    if (!(mark === 'task' ? isRich(c.assignee) : c.needsYou && !c.blocked)) continue;
    let from = c.comments.length;
    while (from > 0 && !isRich(c.comments[from - 1].author)) from--;
    const seen = new Map(), drop = new Set();
    for (let i = c.comments.length - 1; i >= from; i--) {
      const m = c.comments[i];
      if (m.mark !== mark) continue;
      const k = norm(m.text);
      if (seen.has(k)) drop.add(i); else seen.set(k, i);
    }
    if (drop.size) { out.push({ card: c.id, mark, removed: drop.size, text: norm(c.comments[[...drop][0]].text).slice(0, 80) }); if (!dry) c.comments = c.comments.filter((m, i) => !drop.has(i)); }
  }
  return out;
}
function bumpOne(c, m, text, options) {
  const at = now();
  m.bumpedAt = at; m.bumps = (m.bumps || 0) + 1;
  c.bumpedAt = at; c.bumps = m.bumps;
  const base = norm(String(m.text).replace(UPD, ''));
  if (text && norm(text) !== base && !norm(m.text).endsWith('Updated: ' + norm(text))) m.text = String(m.text).replace(UPD, '') + '\nUpdated: ' + norm(text);
  if (options && options.length) m.options = options;
}


// 🗂️ Close the open Topic with ONE comment from the owner (AIG-361/445). Questions filled by a card reply read "Q3/Q4: see reply".
function closeTopic(c) {
  const qz = c.quiz, parts = [];
  qz.done = true;
  qz.items.forEach((x, n) => {
    const last = parts[parts.length - 1];
    if (x.viaReply) { if (last && last.reply) last.ns.push(n + 1); else parts.push({ reply: true, ns: [n + 1] }); }
    else parts.push({ ns: [n + 1], a: x.answer });
  });
  c.comments.push({ author: S.owner(), text: `Topic: ${qz.topic} — ` + parts.map(x => `${x.ns.map(n => 'Q' + n).join('/')}: ${x.reply ? 'see reply' : x.a}`).join(', '), at: now() });
  c.needsYou = false; c.blocked = false;
  toTeam(c);
  if (isRich(c.assignee)) c.assignee = c.prevAssignee || '';
}

module.exports = function routes() {
return [
  /* ---------- comments, verdicts, tasks, pokes ---------- */
  // Comments: the conversation channel between the owner and a team.
  // { author, text, needsYou?: true }  -> "ask the owner"  /  the owner replying clears needsYou unless told otherwise.
  // Attachments (AIG-77): upload { name, type, data: base64 } before sending the comment; GET returns the file itself.
  ['POST', /^\/api\/projects\/([^/]+)\/attachments$/, ([slug], b) => { if (slug !== '_watchman') need(load(slug)); return saveAttachment(slug, b); }],
  ['GET', /^\/api\/projects\/([^/]+)\/attachments\/([^/]+)$/, ([slug, id], b, q, req) => { seeProject(req, slug); return { __file: (q && q.get('thumb') && thumbOf(slug, id)) || fileOf(slug, id) }; }],   // AIG-1165: not for another project's team
  // Resumable uploads (AIG-1165, lib/uploads.js): start { name, type, size } -> { id, chunk, chunks, received }; send each piece
  // { data: base64 } to /<n>; GET says which pieces arrived (resume); /done { thumb? } joins them into an attachment; DELETE cancels.
  ['POST', /^\/api\/projects\/([^/]+)\/uploads$/, ([slug], b, _q, req) => { if (slug !== '_watchman') need(load(slug)); return uploads.start('project:' + slug, 'project', b, req); }],
  ['GET', /^\/api\/projects\/([^/]+)\/uploads\/([0-9a-f]{32})$/, ([slug, id], b, _q, req) => uploads.status('project:' + slug, id, req)],
  ['POST', /^\/api\/projects\/([^/]+)\/uploads\/([0-9a-f]{32})\/(\d{1,4})$/, ([slug, id, n], b, _q, req) => uploads.chunk('project:' + slug, id, n, b, req)],
  ['POST', /^\/api\/projects\/([^/]+)\/uploads\/([0-9a-f]{32})\/done$/, ([slug, id], b, _q, req) => uploads.finishProject(slug, id, b, req)],
  ['DELETE', /^\/api\/projects\/([^/]+)\/uploads\/([0-9a-f]{32})$/, ([slug, id], b, _q, req) => uploads.cancel('project:' + slug, id, req)],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/comments$/, ([slug, id], b, _q, req) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    if (!text && !files.length) throw bad('text is required');
    const author = String(b.author || S.owner()).trim();
    // AIG-1234: the same msgId again is that message resent (a retry, also across a restart): it is already here, or already in the bin.
    const fwl = require('../firewall'), msgId = fwl.msgIdOf(b);
    if (msgId && (c.comments || []).some(m => m.msgId === msgId)) return { ...c, already: true };
    { const before = !fwl.bypassed() && fwl.caughtBefore(slug, msgId); if (before) return before; }
    // Answer buttons the team picked for this message (AIG-176): up to 4 short ones.
    const options = (Array.isArray(b.options) ? b.options : String(b.options || '').split(',')).map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 4);
    // Never the same task or question twice (AIG-373): an open one for the owner is bumped, not copied.
    if ((b.mark === 'task' || b.mark === 'ask') && !isRich(author)) {
      const m = openMarked(c, b.mark);
      if (m) {
        bumpOne(c, m, text, options);
        c.updated = now();
        save(p);
        return { ...c, bumped: true };
      }
      delete c.bumpedAt; delete c.bumps;
    }
    // Message firewall (AIG-839): duplicates, "Original:" copies and empty pokes from the team are kept in the bin, not the inbox.
    { const fw = require('../firewall'), why = fw.bypassed() ? '' : fw.reason(author, text, c.comments, files.length > 0, { log: b.log === true });
      if (why) return fw.keep({ project: slug, card: c.id, author, kind: b.mark === 'task' || b.mark === 'ask' ? b.mark : 'comment', text, why, mark: b.mark, needsYou: b.needsYou, options, attachments: files, assume: b.mark === 'assume' && b.assume && typeof b.assume === 'object' ? b.assume : undefined, msgId, log: b.log === true }); }
    const keepsTask = isRich(author) && !!openMarked(c, 'task');   // the owner talking about an open task doesn't drop it (AIG-373)
    c.comments.push({ author, text, at: now(), ...(msgId ? { msgId } : {}), ...(b.log === true ? { log: true } : {}), ...(typeof b.auto === 'boolean' ? { auto: b.auto } : {}), ...(files.length ? { attachments: files } : {}), ...(options.length ? { options } : {}), ...(b.mark === 'assume' && b.assume && typeof b.assume === 'object' ? { assume: cleanAssume(b.assume) } : {}), ...(b.mark === 'task' || b.mark === 'ask' || b.mark === 'assume' ? { mark: b.mark } : {}) });   // mark: the comment that IS the task / question (AIG-367)
    if (isRich(author) && c.retro && !c.retro.done && (share.ownerOnly(req), true) && require('../retro').answer(p, c, text)) { c.updated = now(); save(p); return c; }   // 🔁 AIG-865: Go adds the retro line, Not yet closes the card
    if (isRich(author) && c.runbookProposal && !c.runbookProposal.done && (share.ownerOnly(req), true) && require('../pir').answer(p, c, text)) { c.updated = now(); save(p); return c; }   // 📘 AIG-1109: Go writes docs/runbooks/<name>.md, Not yet closes the card
    if (isRich(author) && c.needsYou && /sprint/i.test(c.title) && /\bgo\s*\?/i.test(((c.comments || []).filter(m => m.mark === 'ask').pop() || {}).text || '')) require('../retro').due(p, 'sprint', c.id);   // a sprint go/no-go is answered: the lead is told to run a retro
    if (!isRich(author)) delete c.snoozedUntil;   // something new from the team brings a put-off card back (AIG-167)
    if ('needsYou' in b) { c.needsYou = !!b.needsYou; if (c.needsYou) c.asked = true; }   // asked: part of the lead chat for good
    else if (c.quick && !isRich(author) && !(isRich(c.createdBy) && b.mark !== 'ask' && b.mark !== 'task')) c.needsYou = true;   // a friend's quick question goes to Messages; the owner's own 💬 is an instruction (AIG-1215): only a real ask/task flags it
    else if (isRich(author)) c.needsYou = false;
    if (isRich(author)) { c.blocked = false; if (!keepsTask) { delete c.bumpedAt; delete c.bumps; } }   // The owner answering clears a block; the team blocks again if still stuck
    // The owner replying hands the card to the team, but an open task stays his until he clicks Done (AIG-373).
    if (isRich(author) && !keepsTask) {
      toTeam(c);
      if (isRich(c.assignee)) c.assignee = c.prevAssignee || '';
    }
    // A normal reply on a card with an open Topic fills the still-unanswered questions and closes it (AIG-445): one combined comment, one wake.
    if (isRich(author) && text && c.quiz && !c.quiz.done) {
      c.quiz.items.forEach(x => { if (!x.answer) { x.answer = text.slice(0, 200); x.typed = true; x.viaReply = true; } });
      closeTopic(c);
    }
    if (!isRich(author)) follow.track(p, c);
    c.updated = now();
    share.commentAdded(p, c, c.comments[c.comments.length - 1]);   // a shared card (AIG-305): it goes to the friend too
    share.cardChanged(p, c);   // and its status label, if it moved (AIG-306)
    save(p);
    if (c.quick && isRich(author) && text && dmrules.goReply(slug, c.id, require('./ctx').leadOf(p))) {   // AIG-609: GO on a list of backlog cards, by rule
      if (!dmrules.on()) nudge(slug);   // the reply is free, but the team still starts on the cards (unless AI is held back)
      return findCard(load(slug), c.id);
    }
    if (c.quick && isRich(author) && text && dmrules.on()) {   // AIG-551: a DM to the lead while AI is held back: a free, rule-based reply
      dmrules.postLead(slug, c.id, require('./ctx').leadOf(p), dmrules.replyLead(load(slug), text));
      return findCard(load(slug), c.id);
    }
    if (isRich(author)) nudge(slug);
    return c;
  }],

  // ➡️ The lead carries on in another card (AIG-426): { to, author }. Rich's chat offers to follow.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/followup$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id);
    follow.set(p, c, b.to);
    c.updated = now();
    save(p);
    return c;
  }],

  // 📤 / 📥 The AIGILE pack (AIG-357, docs/HANDOFF.md): a card for an outside chat AI, and its reply pasted back.
  // The reply is a comment by the Outside AI: never the owner, never a wake (no nudge, no needsYou, no toTeam), not shared.
  ['GET', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/pack$/, ([slug, id], _b, q) => { const p = need(load(slug)); return pack.build(p, findCard(p, id), q && q.get ? q.get('want') : ''); }],
  // ✨ Copy with AI help (AIG-377): one tiny Haiku run rewrites the scrubbed pack for the owner to edit.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/pack\/ai$/, ([slug, id], b, _q, req) => { share.ownerOnly(req); const p = need(load(slug)); return pack.aiHelp(p, findCard(p, id), b && b.want); }],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/unpack$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id);
    const r = pack.unpack(p, c, b.text);
    save(p);
    return r;
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/outside\/cards$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id);
    const r = pack.addCards(p, c, String(b.at || ''), b.pick);
    save(p);
    return r;
  }],

  // 🗂️ Topic (AIG-361): a few quick questions on one card. POST quiz { author, topic, items: [{ q, options }] } flags the
  // card needs-owner; POST quiz/answer { index, answer } stores one answer, and when all are in they go back as ONE comment.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/quiz$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const topic = String(b.topic || '').trim().slice(0, 60);
    const items = (Array.isArray(b.items) ? b.items : []).map(i => ({
      q: String(i.q || '').trim().slice(0, 200),
      options: (Array.isArray(i.options) ? i.options : String(i.options || '').split(',')).map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 4),
      answer: '',
    })).filter(i => i.q).map(i => ({ ...i, options: i.options.length ? i.options : ['Yes', 'No'] }));
    if (!topic) throw bad('topic is required');
    if (!items.length || items.length > 8) throw bad('give 1 to 8 questions');
    const author = String(b.author || S.owner()).trim();
    c.quiz = { topic, by: author, at: now(), items };
    c.comments.push({ author, text: `**${topic}** (${items.length} quick questions)\n` + items.map((i, n) => `${n + 1}. ${i.q} (${i.options.join(' / ')})`).join('\n'), at: now() });
    delete c.snoozedUntil;
    c.needsYou = true; c.asked = true;
    c.updated = now();
    save(p);
    return c;
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/quiz\/answer$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const qz = c.quiz;
    if (!qz || qz.done) throw bad('no open topic on this card');
    const i = Number(b.index), item = qz.items[i], answer = String(b.answer || '').trim().slice(0, 200);
    if (!item) throw bad('no such question');
    if (!answer) throw bad('answer is required');
    const u = undo.begin(c);
    item.answer = answer;
    if (b.typed) item.typed = true; else delete item.typed;   // ✏️ Other… (AIG-445): text typed by the owner
    if (qz.items.every(x => x.answer)) {   // all answered: one comment from the owner, one wake
      closeTopic(c);
      c.updated = now();
      share.cardChanged(p, c);
      const r = undo.record(slug, c, u);
      save(p);
      undo.nudgeSoon(slug);
      return { ...c, ...r };
    }
    c.updated = now();
    save(p);
    return c;
  }],

  // Wait and see: hide a card in 'verify' from the owner's inbox for an hour and send it to the back of the queue. DELETE brings it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/snooze$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    // Anything waiting on the owner can be put off for a while: a test, a question or a block (AIG-167).
    if (!waitingOnRich(c)) throw bad('only something waiting on you can be put off');
    const u = undo.begin(c);
    c.snoozedUntil = new Date(Date.now() + SNOOZE_MS).toISOString();
    c.updated = now();
    const r = undo.record(slug, c, u);
    save(p);
    return { ...c, ...r };
  }],
  // Timed card (AIG-385): { until: ISO, or "2026-10-12 14:00" / "+2h" / "tomorrow 9:00" in the board's local time }. DELETE clears it.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/timer$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const raw = String(b.until || '').trim();
    const iso = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(raw) ? raw : require('../timed').parseWhen(raw);
    if (!iso || isNaN(Date.parse(iso))) throw bad('cannot read that time; try "2026-10-12 14:00", "+2h" or "tomorrow 9:00"');
    if (iso <= now()) throw bad('that time has already passed');
    if (c.status === 'done') throw bad('a done card has nothing to come back to');
    c.timedUntil = new Date(iso).toISOString();
    c.updated = now();
    save(p);
    return c;
  }],
  ['DELETE', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/timer$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    delete c.timedUntil;
    c.updated = now();
    save(p);
    return c;
  }],
  ['DELETE', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/snooze$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    delete c.snoozedUntil;
    c.updated = now();
    save(p);
    return c;
  }],

  // The owner's verdict on a card in 'verify': { accept: true } -> done, { accept: false, text } -> back to doing.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/verdict$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    if (b.reply) {   // 📖 To read (AIG-392): a reply to the team on an info-only card; it stays in verify
      if (!c.info) throw bad('only a 📖 To read card takes a reply');
      if (!text && !files.length) throw bad('write a reply first');
      c.comments.push({ author: S.owner(), text, at: now(), ...(files.length ? { attachments: files } : {}) });
      c.updated = now(); save(p); nudge(slug); return c;
    }
    if (!b.accept && !text && !files.length) throw bad('say what is wrong when sending a card back');
    if (b.accept) require('../problems').checkDone(p, c);   // AIG-887: a problem waits for its change request
    const u = undo.begin(c);
    if (b.accept) c.status = 'done'; else toTeam(c, 'todo');
    c.needsYou = false;
    delete c.snoozedUntil;
    c.comments.push({ author: S.owner(), text: (b.accept ? '✅ Accepted' : '🔁 Sent back') + (text ? ': ' + text : ''), at: now(), verdict: b.accept ? 'accept' : 'sendback', ...(files.length ? { attachments: files } : {}) });
    c.updated = now();
    share.cardChanged(p, c);   // a shared card's status label (AIG-306); the verdict itself is never sent
    const r = undo.record(slug, c, u);
    save(p);
    if (!b.accept || text || files.length) undo.nudgeSoon(slug);
    return { ...c, ...r };
  }],

  // AI tester (AIG-163): its check of a test waiting for the owner. pass: stays for the owner with the evidence (one click
  // to accept); fail: back to the team with what went wrong; skip: it couldn't check (login, keys, a restart), the owner does.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/aicheck$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    if (c.status !== 'verify') throw bad('only a test waiting for ' + S.owner() + ' can be checked');
    if (!['pass', 'fail', 'skip'].includes(b.result)) throw bad('result must be pass, fail or skip');
    const note = String(b.note || '').trim().slice(0, 600), files = attachmentsFor(slug, b.attachments), by = String(b.by || 'Tester').trim();
    if (!note) throw bad('say in a line or two what you saw');
    c.aiCheck = { result: b.result, note, by, at: now(), ...(files.length ? { shots: files } : {}) };
    c.comments.push({ author: by, text: { pass: '🤖 Passed: ', fail: '🤖 Failed: ', skip: '🤖 Could not check: ' }[b.result] + note, at: now(), ...(files.length ? { attachments: files } : {}) });
    if (b.result === 'pass') c.aiCheck.sure = b.sure === true || b.confidence === 'sure';   // how sure (AIG-467)
    if (b.result === 'fail') toTeam(c);
    // Trust the AI tester (AIG-467): the one path where the server, not the owner, moves a card to done.
    const tester = require('../tester');
    if (b.result === 'pass' && tester.mayAutoDone(c, c.aiCheck.sure) && !(() => { try { require('../problems').checkDone(p, c); } catch { return true; } })()) {   // AIG-887: never auto-done a problem whose change is open
      c.reopenTo = 'verify'; c.status = 'done'; c.needsYou = false; delete c.snoozedUntil;
      c.testerDone = { at: now(), sure: c.aiCheck.sure };
      c.comments.push({ author: by, text: `✅ Moved to done by the AI tester (${c.aiCheck.sure ? 'sure' : 'likely'})`, at: now() });
    }
    c.updated = now();
    share.cardChanged(p, c);
    save(p);
    if (b.result === 'fail') nudge(slug);
    return c;
  }],

  // ✅ Done by the tester (AIG-467): what the AI tester closed today, for the For you page; Reopen is a plain move back to verify.
  ['GET', /^\/api\/tester\/done$/, () => {
    const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    return S.listSlugs().map(load).filter(p => p && !p.archived).flatMap(p => p.cards.filter(c => c.status === 'done' && c.testerDone && c.testerDone.at >= since)
      .map(c => ({ project: p.slug, projectName: p.name, id: c.id, title: c.title, at: c.testerDone.at, sure: c.testerDone.sure }))).sort((a, b) => b.at.localeCompare(a.at));
  }],

  // Fold (AIG-190/193): a card about the same feature joins another. Its test steps go under the target's,
  // both get a note, and it closes (even when it was waiting on the owner: folding is how the pile stays small).
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/fold$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id), into = findCard(p, String(b.into || ''));
    if (c === into) throw bad('a card cannot fold into itself');
    if (c.status === 'done') throw bad(c.id + ' is already done');
    const by = String(b.author || 'Lead').trim();
    if (c.testSteps) { into.testSteps = (into.testSteps || '') + `\n\n**Also (was ${c.id}: ${c.title}):**\n${c.testSteps}`; delete into.aiCheck; }
    into.comments.push({ author: by, text: `- Folded in **${c.id}** (${c.title})`, at: now() });
    c.comments.push({ author: by, text: `- Folded into **${into.id}**: test it all there`, at: now() });
    c.status = 'done'; c.needsYou = false; c.blocked = false; delete c.snoozedUntil;
    c.updated = into.updated = now();
    share.cardChanged(p, c);
    save(p);
    return into;
  }],
  // 🧹 Tidy my pile (AIG-193): a job card for the lead to fold related cards in For you. One open job at a time.
  ['POST', /^\/api\/projects\/([^/]+)\/tidy$/, ([slug]) => {
    const p = need(load(slug));
    let c = p.cards.find(x => x.tidy && x.status !== 'done');
    if (c) return { ...c, already: true };
    c = { id: p.key + '-' + p.nextId++, title: '🧹 Tidy the For you pile', description: "- The owner asked you to tidy their **For you** pile\n- Cards about the same feature: fold them into one with `aigile fold <proj> <target> <id> [<id>...] --as <you>` (test steps move across, the others close)\n- Muddled titles: give them a short, recognisable one (`aigile edit ... --title`)\n- Then comment here: \"Folded N → M\" and what went where, and move this card to done", testSteps: '', type: 'task', priority: 'high', status: 'team',
      assignee: '', sprint: '', blocked: false, needsYou: false, tidy: true, createdBy: S.owner(), created: now(), updated: now(), comments: [] };
    p.cards.push(c); save(p); nudge(slug);
    return c;
  }],

  // Remind the owner of what is already waiting (AIG-373): moves the open task / question to the top, adds no copy.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/bump$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const m = (isRich(c.assignee) && openMarked(c, 'task')) || openMarked(c, 'ask');
    if (!m) throw bad('nothing is waiting on ' + S.owner() + ' on this card');
    bumpOne(c, m, '', []);
    c.updated = now();
    save(p);
    return c;
  }],

  ['POST', /^\/api\/projects\/([^/]+)\/dedupe$/, ([slug], b) => {
    const p = need(load(slug));
    const changes = p.cards.flatMap(c => dedupeOpen(c, !!b.dry));
    if (changes.length && !b.dry) save(p);
    return { slug, dry: !!b.dry, changes };
  }],

  // The owner finished a task the team gave him: tell them (moves to For the team) and hand it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/taskdone$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments), u = undo.begin(c);
    c.comments.push({ author: S.owner(), text: '✅ Done' + (text ? ': ' + text : ''), at: now(), ...(files.length ? { attachments: files } : {}) });
    c.assignee = c.prevAssignee || '';
    c.needsYou = false; delete c.bumpedAt; delete c.bumps;
    toTeam(c);
    c.updated = now();
    const r = undo.record(slug, c, u);
    save(p);
    undo.nudgeSoon(slug);
    return { ...c, ...r };
  }],

  // 🏡 Real life (AIG-394): the owner ticks a life task done. Quiet: no comment, no team woken.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/lifedone$/,([slug, id]) => {
    const p = need(load(slug)), c = findCard(p, id);
    if (!c.lifeType) throw bad('not a real-life task', 400);
    const u = undo.begin(c);
    require('../life').done(c);
    const r = undo.record(slug, c, u);
    save(p); return { ...c, ...r };
  }],

  // ↩ Undo (AIG-403): put the card back as it was before the owner's last move (within a minute), auto-comments gone.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/undo$/, ([slug, id]) => undo.undo(slug, id)],

  // The owner's poke:a one-line nudge on work that seems stuck. Wakes the team (it's an owner comment)
  // but, unlike a reply, leaves the card where it is.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/poke$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    c.comments.push({ author: S.owner(), text: '👉 any update?', at: now(), poke: true });
    c.updated = now();
    save(p);
    nudge(slug);
    return c;
  }],

  // 👉 Poke a whole column (AIG-527): { status } or { ids }. Each card gets the note, the team is woken once.
  ['POST', /^\/api\/projects\/([^/]+)\/pokeall$/, ([slug], b) => {
    const p = need(load(slug));
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : null;
    const live = ['todo', 'doing', 'review', 'team'];
    const hit = (p.cards || []).filter(c => ids ? ids.includes(c.id) : c.status === b.status && live.includes(c.status)).slice(0, 60);
    if (!hit.length) throw bad('nothing to poke here');
    const at = now();
    for (const c of hit) { c.comments.push({ author: S.owner(), text: '👉 any update?', at, poke: true }); c.updated = at; }
    save(p);
    nudge(slug);
    return { poked: hit.map(c => c.id) };
  }],

];
};
module.exports.openMarked = openMarked; module.exports.bumpOne = bumpOne;   // the Lead Scrum Master's one reminder (AIG-441)
