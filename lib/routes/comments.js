// API routes: comments, verdicts, tasks, pokes (split from lib/routes.js, AIG-297).
const { S, now, load, save, SNOOZE_MS, waitingOnRich, isRich, toTeam, bad, need, findCard, nudge, saveAttachment, attachmentsFor, fileOf } = require('./ctx');

module.exports = function routes() {
return [
  /* ---------- comments, verdicts, tasks, pokes ---------- */
  // Comments: the conversation channel between Rich and a team.
  // { author, text, needsYou?: true }  -> "ask Rich"  /  Rich replying clears needsYou unless told otherwise.
  // Attachments (AIG-77): upload { name, type, data: base64 } before sending the comment; GET returns the file itself.
  ['POST', /^\/api\/projects\/([^/]+)\/attachments$/, ([slug], b) => { need(load(slug)); return saveAttachment(slug, b); }],
  ['GET', /^\/api\/projects\/([^/]+)\/attachments\/([^/]+)$/, ([slug, id]) => ({ __file: fileOf(slug, id) })],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/comments$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    if (!text && !files.length) throw bad('text is required');
    const author = String(b.author || S.owner()).trim();
    // Answer buttons the team picked for this message (AIG-176): up to 4 short ones.
    const options = (Array.isArray(b.options) ? b.options : String(b.options || '').split(',')).map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 4);
    c.comments.push({ author, text, at: now(), ...(files.length ? { attachments: files } : {}), ...(options.length ? { options } : {}) });
    if (!isRich(author)) delete c.snoozedUntil;   // something new from the team brings a put-off card back (AIG-167)
    if ('needsYou' in b) { c.needsYou = !!b.needsYou; if (c.needsYou) c.asked = true; }   // asked: part of the lead chat for good
    else if (c.quick && !isRich(author)) c.needsYou = true;   // the team's answer to a quick question goes to Messages
    else if (isRich(author)) c.needsYou = false;
    if (isRich(author)) c.blocked = false;   // Rich answering clears a block; the team blocks again if still stuck
    // Rich replying hands the card to the team, including a task he'd been given (it leaves his inbox).
    if (isRich(author)) {
      toTeam(c);
      if (isRich(c.assignee)) c.assignee = c.prevAssignee || '';
    }
    c.updated = now();
    save(p);
    if (isRich(author)) nudge(slug);
    return c;
  }],

  // Wait and see: hide a card in 'verify' from Rich's inbox for an hour and send it to the back of the queue. DELETE brings it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/snooze$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    // Anything waiting on the owner can be put off for a while: a test, a question or a block (AIG-167).
    if (!waitingOnRich(c)) throw bad('only something waiting on you can be put off');
    c.snoozedUntil = new Date(Date.now() + SNOOZE_MS).toISOString();
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

  // Rich's verdict on a card in 'verify': { accept: true } -> done, { accept: false, text } -> back to doing.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/verdict$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    if (!b.accept && !text && !files.length) throw bad('say what is wrong when sending a card back');
    if (b.accept) c.status = 'done'; else toTeam(c);
    c.needsYou = false;
    delete c.snoozedUntil;
    c.comments.push({ author: S.owner(), text: (b.accept ? '✅ Accepted' : '🔁 Sent back') + (text ? ': ' + text : ''), at: now(), verdict: b.accept ? 'accept' : 'sendback', ...(files.length ? { attachments: files } : {}) });
    c.updated = now();
    save(p);
    if (!b.accept || text || files.length) nudge(slug);
    return c;
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
    if (b.result === 'fail') toTeam(c);
    c.updated = now();
    save(p);
    if (b.result === 'fail') nudge(slug);
    return c;
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

  // Rich finished a task the team gave him: tell them (moves to For the team) and hand it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/taskdone$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    c.comments.push({ author: S.owner(), text: '✅ Done' + (text ? ': ' + text : ''), at: now(), ...(files.length ? { attachments: files } : {}) });
    c.assignee = c.prevAssignee || '';
    c.needsYou = false;
    toTeam(c);
    c.updated = now();
    save(p);
    nudge(slug);
    return c;
  }],

  // Rich's poke:a one-line nudge on work that seems stuck. Wakes the team (it's a Rich comment)
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

];
};
